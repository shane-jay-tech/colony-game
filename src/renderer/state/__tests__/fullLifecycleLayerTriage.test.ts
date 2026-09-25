/**
 * 20260925-120444-913e（B/test）：一局的全生命周期（新建→推进→暂停→保存→加载→事件→异常恢复）
 * ＋ 两条验收：① 固定 seed 测试稳定；② **失败能区分逻辑 / 存档 / 渲染**。
 *
 * 名词先验世（派单只给"test 全生命周期"，卷宗正文七项逐个在仓内找到落点）：
 *   新建 = `new GameStore(ee, {rngSeed,...}, content)`（IntroScene.ts:571 走的就是这条路；仓内**没有** newGame/resetGame 门面）
 *   推进 = `tickDay()`；暂停 = `setPaused/requestPause/releasePause`
 *        （🔴 实测：`tickDay()` **不看 paused**，暂停住在驱动层 GameScene/UIScene.ts:167 —— 第 3 段把这条事实钉住，
 *          否则"暂停没停住模拟"这类红会被误归给逻辑层）
 *   保存/加载 = `saveToSlot`/`loadFromSlot`（saveLoad.ts:833/844，经 window.colonyApi）
 *   事件 = runEventTick＋resolveEvent 的账本（eventHistory/pendingEventId/lastEventDay）
 *   异常恢复 = loadFromSlot 把截断档的裸 SyntaxError 统一成 SaveLoadError（c922-103）＋ 回退 `.bak` 前一代后**能追上被损坏的那一代**
 *
 * 与同仓既有件不重复：seedSnapshotDeterminism（c925-6938）＝决定性公理；atomicSaveCrash（e89f）＝主进程写盘原子性；
 * replaySnapshotContent（da6f，同波兄弟单）＝快照载荷是否为回放所足依；saveIoSemantics（c922-103）＝写档异常语义。
 * 本件独有的是**分层归因**：八段各产出带层标签读数，再用 5 个合成故障证明"红只点亮该点的那一层"。
 *
 * 盘面纪律：存档层走**产品函数**（saveToSlot/loadFromSlot）＋真 FS（os.tmpdir() 下 mkdtemp，afterAll 删除）；
 *   colonyApi 替身与主进程同语义（写 `<slot>.json`、覆盖前复制 `.bak`）；全程不 import src/main/index.ts。
 *   🔴 本仓一手实测：`getState()` 返回 `Object.freeze(structuredClone(state))`（gameStore.ts:457-458）
 *   ⇒ 往它上面 push 任何字段都是**假注入**（静默无效或 strict-mode TypeError）；本件的 state 注入一律走 `replaceState`。
 */
import { afterEach, beforeAll, afterAll, describe, expect, it } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type GameState, type IEventEmitter } from '../gameStore';
import { SaveLoadError, deserialize, loadFromSlot, saveToSlot, serialize } from '../saveLoad';
import { createRng } from '../rng';
import { dayToCalendar } from '../calendar';
import { DECREES, EVENTS, POLICIES } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import { BUILDING_REGISTRY, getBuildingDef } from '../../data/buildingRegistry';
import type { BuildingInstance } from '../../data/schema';
import type { ResourceId } from '../../data/resourceRegistry';

const SEED = 91377;
const ADVANCE_DAYS = 40;   // 第一次落盘前推进的天数（gen1）
const RESUME_DAYS = 25;    // 读档后续跑天数（>= 事件间隔下限，保证能采到事件）
const RES_SAMPLE: ResourceId[] = ['grain', 'wood', 'stone', 'gold', 'people', 'cloth', 'bronze', 'rite', 'influence'];

type Layer = 'logic' | 'save' | 'render';
type Fault = 'none' | 'seed-skew' | 'corrupt-semantics' | 'truncated-json' | 'ghost-building' | 'offgrid-building';

interface Reading { stage: string; layer: Layer; ok: boolean; detail: string }

interface LifeReport {
  readings: Reading[];
  redLayers(): Layer[];
  redStages(): string[];
}

function makeStore(seed: number): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, {
    rngSeed: seed,
    resources: { ...BALANCE.startingResources },
  }, { policies: POLICIES, events: EVENTS, decrees: DECREES });
}

/** 输入按 (seed, **绝对游戏日**) 派生 ⇒ 一次跑完与中途存读后续跑的注入序列逐位相同（本仓硬口径 3）。 */
function injectForDay(store: GameStore, seed: number, day: number): void {
  const pick = createRng((seed ^ (day * 2654435761)) >>> 0);
  if (pick.next() < 0.3) {
    const id = RES_SAMPLE[pick.nextInt(0, RES_SAMPLE.length - 1)]!;
    store.addResource(id, pick.nextInt(1, 20), 'seeded-input');
  }
}

interface Row { day: number; eventId: string | null; choice: number }

function runDays(store: GameStore, seed: number, count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    store.tickDay();
    const day = store.getState().currentDay;
    injectForDay(store, seed, day);
    const eventId = store.getState().pendingEventId;
    let choice = -1;
    if (eventId !== null) {
      choice = day % 3; // 越界 choiceIdx 在 applyEventChoice 里是"仅清空不回执"（已读源码），可安全派生
      store.resolveEvent(choice);
    }
    rows.push({ day, eventId, choice });
  }
  return rows;
}

const streamKey = (rows: Row[]): string => rows.map(r => `${r.day}:${r.eventId ?? '-'}:${r.choice}`).join('|');
const triggeredCount = (rows: Row[]): number => rows.filter(r => r.eventId !== null).length;

/** 逻辑层指纹：只取模拟驱动面；显式剔除墙钟位 lastSeenTimestamp（saveToSlot 会写它，属存档层副作用）。 */
function logicFp(store: GameStore): string {
  const g = store.getState();
  return JSON.stringify({
    day: g.currentDay,
    seed: g.rngSeed,
    resources: g.resources,
    buildings: g.buildings.length,
    population: g.populationClasses,
    grade: g.grade,
    modifiers: g.activeModifiers.map(m => `${m.id}@${m.remainingDays ?? '-'}`).sort(),
    eventHistory: g.eventHistory,
    lastEventDay: g.lastEventDay,
    activeDecrees: g.activeDecrees.map(d => `${d.id}:${d.currentStage}`).sort(),
    wrath: g.publicWrath,
    wariness: g.worldWariness,
  });
}

function building(defId: string, x: number, y: number): BuildingInstance {
  return { defId, position: { x, y }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] };
}

const A_REAL_DEF = [...BUILDING_REGISTRY.keys()][0]!;

/** 🔴 注入必须走 replaceState：getState() 是 frozen clone（见文件头）。 */
function applyBuildingFault(store: GameStore, fault: Fault): void {
  if (fault !== 'ghost-building' && fault !== 'offgrid-building') return;
  const st = store.getState();
  const extra = fault === 'ghost-building'
    ? [building('ghost_fort_913e', 1, 1)]
    : [building(A_REAL_DEF, st.worldMap.width + 999, st.worldMap.height + 998)];
  store.replaceState({ ...st, buildings: [...st.buildings, ...extra] } as GameState);
}

// ---------- 隔离盘（真 FS，只此一个目录，收工删除） ----------

let isoRoot = '';
let isoSaves = '';

function slotPath(slot: string): string {
  if (!isoSaves) throw new Error('isoSaves 未初始化：禁止在 describe 正文里落盘（会回落 cwd）');
  return join(isoSaves, `${slot}.json`);
}

beforeAll(() => {
  isoRoot = mkdtempSync(join(tmpdir(), 'colony34-913e-'));
  isoSaves = join(isoRoot, 'saves');
  mkdirSync(isoSaves, { recursive: true });
});

afterAll(() => {
  const probe = isoRoot;
  if (probe) rmSync(probe, { recursive: true, force: true });
  expect(existsSync(probe)).toBe(false);
});

/** 与主进程 handler 同语义的 colonyApi 替身：写 `<slot>.json`，覆盖前把旧档复制成 `.bak`。 */
function installColonyApi(): void {
  (globalThis as Record<string, unknown>)['window'] = {
    colonyApi: {
      saveGame: async (slot: unknown, json: unknown): Promise<boolean> => {
        const target = slotPath(String(slot));
        if (existsSync(target)) copyFileSync(target, `${target}.bak`);
        writeFileSync(target, String(json), 'utf-8');
        return true;
      },
      loadGame: async (slot: unknown): Promise<string | null> => {
        const fp = slotPath(String(slot));
        return existsSync(fp) ? readFileSync(fp, 'utf-8') : null;
      },
      getSaveMeta: async (): Promise<null> => null,
    },
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['window'];
});

/**
 * 一局全生命周期（八段）。某段失败只把**该层**置红，其余层在"最佳已知 state"上照常评估
 * ⇒ 红面集合可按层归因；异常恢复段要求"回退 .bak 一代 ＋ 续跑一日 == 被损坏的那一代"。
 */
async function lifecycle(tag: string, fault: Fault): Promise<LifeReport> {
  const readings: Reading[] = [];
  const push = (stage: string, layer: Layer, ok: boolean, detail: string): void => {
    readings.push({ stage, layer, ok, detail });
  };
  installColonyApi();
  const slot = `lc${tag}`;
  let gen1Day = 0;
  let gen2Day = 0;

  // ---- 1 新建 ----
  const store = makeStore(SEED);
  const fresh = store.getState();
  push('1-新建', 'logic',
    fresh.currentDay === 0 && fresh.rngSeed === SEED && fresh.eventHistory.length === 0 && fresh.buildings.length === 0,
    `day=${fresh.currentDay} seed=${fresh.rngSeed} events=${fresh.eventHistory.length} buildings=${fresh.buildings.length}`);

  // ---- 2 推进（含"固定 seed 稳定"双跑：纯内存、不落盘） ----
  const rowsA = runDays(store, SEED, ADVANCE_DAYS);
  const twin = makeStore(fault === 'seed-skew' ? SEED + 1 : SEED);
  const rowsB = runDays(twin, fault === 'seed-skew' ? SEED + 1 : SEED, ADVANCE_DAYS);
  const logicSame = logicFp(store) === logicFp(twin) && streamKey(rowsA) === streamKey(rowsB);
  push('2-推进', 'logic', logicSame,
    logicSame ? `双跑指纹全等，触发事件 ${triggeredCount(rowsA)} 条` : '同 seed 双跑指纹不等（模拟层不确定或被换 seed）');

  // ---- 3 暂停 ----
  let pauseEmits = 0;
  store.on(STATE_EVENTS.PAUSED_CHANGED, () => { pauseEmits++; });
  store.setPaused(true);
  const effectivePaused = store.isPaused() && store.getUserPaused();
  store.requestPause('event-modal');
  store.requestPause('event-modal');            // holder 重入须 idempotent
  store.setPaused(false);
  const stillHeld = store.isPaused() && !store.getUserPaused(); // 用户解暂停、模态仍持有
  store.releasePause('event-modal');
  const released = !store.isPaused();
  store.releasePause('event-modal');            // 重复释放须安全
  const tickIgnoresPause = (() => {
    store.setPaused(true);
    const before = store.getState().currentDay;
    store.tickDay();
    const after = store.getState().currentDay;
    store.setPaused(false);
    return after === before + 1;                 // 实况：暂停在驱动层，tickDay 本身不看 paused
  })();
  push('3-暂停', 'logic',
    // PAUSED_CHANGED 只在"有效暂停态翻转"时发：setPaused(true)=1 → requestPause(已暂停)=0 → setPaused(false)(模态仍持有)=0
    // → releasePause=2 → 下面 IIFE 的 setPaused(true)=3 / setPaused(false)=4 ⇒ 合计 4，且中途 holder 重入不多发
    effectivePaused && stillHeld && released && pauseEmits === 4 && tickIgnoresPause,
    `effective=${effectivePaused} 模态持有=${stillHeld} 释放=${released} PAUSED_CHANGED=${pauseEmits}(期望4，holder重入不多发) tickDay忽略paused=${tickIgnoresPause}`);

  // ---- 4 保存（两代：gen1 = 当前日，gen2 = 再跑一日；.bak 里是 gen1） ----
  applyBuildingFault(store, fault);
  let saveOk = false;
  let saveDetail = '';
  let gen2Fp = '';
  try {
    gen1Day = store.getState().currentDay;       // 暂停段自己 tick 过一日 ⇒ 日号现取，不按 ADVANCE_DAYS 硬算
    await saveToSlot(slot, store);               // gen1
    runDays(store, SEED, 1);                     // 前进一日
    gen2Day = store.getState().currentDay;
    gen2Fp = logicFp(store);
    await saveToSlot(slot, store);               // gen2（.bak := gen1）
    const bytes = readFileSync(slotPath(slot), 'utf-8');
    const bakBytes = readFileSync(`${slotPath(slot)}.bak`, 'utf-8');
    const env = JSON.parse(bytes) as { schemaVersion?: unknown; state?: { currentDay?: unknown } };
    const envBak = JSON.parse(bakBytes) as { state?: { currentDay?: unknown } };
    saveOk = env.schemaVersion !== undefined
      && env.state?.currentDay === gen1Day + 1
      && envBak.state?.currentDay === gen1Day;
    saveDetail = `gen2 day=${String(env.state?.currentDay)}（${bytes.length} B）/ .bak day=${String(envBak.state?.currentDay)}，两代日号差=${gen2Day - gen1Day}`;
  } catch (err) {
    saveOk = false;
    saveDetail = `写档抛出：${err instanceof Error ? err.message : String(err)}`;
  }

  // 故障注入：改盘上字节（存档层的"语义损坏 / 传输损坏"）
  if (fault === 'corrupt-semantics' || fault === 'truncated-json') {
    const fp = slotPath(slot);
    const bytes = readFileSync(fp, 'utf-8');
    if (fault === 'truncated-json') {
      writeFileSync(fp, bytes.slice(0, Math.floor(bytes.length / 2)), 'utf-8');
    } else {
      const env = JSON.parse(bytes) as { state: { resources: Record<string, unknown> } };
      env.state.resources['grain'] = null;       // 形状合法、语义非法（resources 必须全有限数）
      writeFileSync(fp, JSON.stringify(env), 'utf-8');
    }
  }
  push('4-保存', 'save', saveOk, saveDetail || '未执行');

  // ---- 5 加载 ----
  let loaded: GameState | null = null;
  let loadOk = false;
  let loadDetail = '';
  try {
    loaded = await loadFromSlot(slot);
    if (loaded === null) {
      loadDetail = 'loadFromSlot 返回 null（缺档）';
    } else {
      const restored = makeStore(SEED);
      restored.replaceState(loaded);
      loadOk = logicFp(restored) === gen2Fp;
      loadDetail = loadOk ? '往返后逻辑指纹全等' : `往返后指纹漂移：${logicFp(restored).slice(0, 70)}`;
    }
  } catch (err) {
    loadOk = false;
    loadDetail = err instanceof SaveLoadError
      ? `SaveLoadError：${err.message.slice(0, 90)}`
      : `🔴 非 SaveLoadError 通道：${err instanceof Error ? String(err.name) : String(err)}`;
  }
  push('5-加载', 'save', loadOk, loadDetail);

  // ---- 6 事件（跨读档复现同一条事件流）----
  let eventOk = false;
  let eventDetail = '';
  if (loaded !== null) {
    const resumed = makeStore(SEED);
    resumed.replaceState(loaded);
    const tailRows = runDays(resumed, SEED, RESUME_DAYS);
    const neverInterrupted = makeStore(SEED);
    runDays(neverInterrupted, SEED, ADVANCE_DAYS);
    applyBuildingFault(neverInterrupted, fault); // 与 live 侧同源注入，保证只比"是否经过读档"
    runDays(neverInterrupted, SEED, 1 + RESUME_DAYS);
    const refRows = neverInterrupted.getState().eventHistory;
    const resumedHist = resumed.getState().eventHistory;
    eventOk = triggeredCount(tailRows) > 0 && JSON.stringify(resumedHist) === JSON.stringify(refRows);
    eventDetail = `续跑 ${RESUME_DAYS} 日新触发 ${triggeredCount(tailRows)} 条；账本与不中断基准${eventOk ? '逐位相同' : '不同'}`;
  } else {
    eventDetail = '跳过：加载未成功，无 state 可续跑';
  }
  push('6-事件', 'save', eventOk, eventDetail);

  // ---- 7 异常恢复（坏档后：原局仍在跑 ＋ 回退 .bak 一代后续跑一日能追上被损坏的那一代）----
  let threwAsSaveLoadError = true;
  try {
    await loadFromSlot(slot);
  } catch (err) {
    threwAsSaveLoadError = err instanceof SaveLoadError;
  }
  const survivor = makeStore(SEED);
  runDays(survivor, SEED, ADVANCE_DAYS);
  applyBuildingFault(survivor, fault);
  runDays(survivor, SEED, 1);
  const probe = makeStore(SEED);
  runDays(probe, SEED, ADVANCE_DAYS);
  applyBuildingFault(probe, fault);
  runDays(probe, SEED, 1);
  // 试过失败读档之后继续跑 3 日，须与"从未碰过存档系统"的同 seed 局同轨
  const untouched = streamKey(runDays(survivor, SEED, 3)) === streamKey(runDays(probe, SEED, 3))
    && logicFp(survivor) === logicFp(probe);
  let bakRecovered = false;
  const bakPath = `${slotPath(slot)}.bak`;
  if (existsSync(bakPath)) {
    copyFileSync(bakPath, slotPath(slot));       // 玩家式回退：把上一代提正
    try {
      const back = await loadFromSlot(slot);
      const s2 = makeStore(SEED);
      s2.replaceState(back ?? s2.getState());
      const recoveredDay = s2.getState().currentDay;
      runDays(s2, SEED, Math.max(0, gen2Day - recoveredDay)); // 补跑到 gen2 那一日的绝对日
      bakRecovered = recoveredDay === gen1Day && logicFp(s2) === gen2Fp;
    } catch {
      bakRecovered = false;
    }
  }
  push('7-异常恢复', 'save',
    threwAsSaveLoadError && untouched && bakRecovered,
    `坏档走SaveLoadError=${threwAsSaveLoadError} 原局未被失败读档污染=${untouched} 回退一代(gen1 day=${gen1Day})补跑至 day=${gen2Day} 追上gen2=${bakRecovered}`);

  // ---- 8 渲染可消费面（不 import Phaser；用渲染器真正依赖的纯查表/派生） ----
  {
    const subject: GameState = loaded ?? store.getState();
    const mapW = subject.worldMap.width;
    const mapH = subject.worldMap.height;
    const unresolvable = subject.buildings.filter(b => getBuildingDef(b.defId) === undefined).map(b => b.defId);
    const offGrid = subject.buildings
      .filter(b => b.position.x < 0 || b.position.y < 0 || b.position.x >= mapW || b.position.y >= mapH)
      .map(b => `${b.defId}@${b.position.x},${b.position.y}`);
    const tilesMatch = subject.worldMap.tiles.length === mapW * mapH;
    const cal = dayToCalendar(subject.currentDay);
    const finiteRes = Object.values(subject.resources).every(v => Number.isFinite(v));
    const renderOk = unresolvable.length === 0 && offGrid.length === 0 && tilesMatch && finiteRes && cal.season !== undefined;
    push('8-渲染可消费面', 'render', renderOk,
      `defId不可解析=${JSON.stringify(unresolvable)} 越界建筑=${JSON.stringify(offGrid.slice(0, 3))} tiles匹配=${tilesMatch} 资源有限=${finiteRes} 季节=${cal.season}`);
  }

  const red = readings.filter(r => !r.ok);
  return {
    readings,
    redLayers: () => [...new Set(red.map(r => r.layer))],
    redStages: () => red.map(r => r.stage),
  };
}

const summarize = (r: LifeReport): string =>
  r.readings.map(x => `${x.stage}[${x.layer}]=${x.ok ? 'ok' : 'RED'} ${x.detail}`).join('\n  ');

const stageOf = (r: LifeReport, name: string): Reading => r.readings.find(x => x.stage === name)!;

describe('全生命周期八段（干净局）：固定 seed 稳定 ＋ 三层读数全绿', () => {
  it('L0 干净局八段全绿，且事件面非空（比对轴不是两个空串互证）', async () => {
    const r = await lifecycle('clean', 'none');
    expect(r.readings.map(x => x.stage)).toEqual([
      '1-新建', '2-推进', '3-暂停', '4-保存', '5-加载', '6-事件', '7-异常恢复', '8-渲染可消费面',
    ]);
    expect(r.redStages(), `\n${summarize(r)}`).toEqual([]);
    expect(stageOf(r, '6-事件').detail).toMatch(/新触发 [1-9]/);
  });

  it('L1 固定 seed 稳定：同一场景连跑三遍，八段读数序列逐位相同（测试自身不漂）', async () => {
    const once = summarize(await lifecycle('stable', 'none'));
    const twice = summarize(await lifecycle('stable', 'none'));
    const thrice = summarize(await lifecycle('stable', 'none'));
    expect(twice).toBe(once);
    expect(thrice).toBe(once);
    expect(once).toContain('1-新建[logic]=ok');
  });
});

describe('分层归因：每个合成故障只点亮它那一层', () => {
  it('F1 逻辑故障（孪生局换 seed）⇒ 只有 logic 红', async () => {
    const r = await lifecycle('f1', 'seed-skew');
    expect(r.redLayers()).toEqual(['logic']);
    expect(r.redStages()).toEqual(['2-推进']);
  });

  it('F2 存档语义故障（盘上 resources 落 null）⇒ 只有 save 红，且走 SaveLoadError 通道', async () => {
    const r = await lifecycle('f2', 'corrupt-semantics');
    expect(r.redLayers()).toEqual(['save']);
    expect(r.redStages()).toEqual(['5-加载', '6-事件']);
    const load = stageOf(r, '5-加载');
    expect(load.detail).toContain('SaveLoadError');
    expect(load.detail).toContain('resources must be a record of finite numbers');
  });

  it('F3 存档传输故障（半截 JSON）⇒ 只有 save 红，且读数与 F2 **可区分**（不是同一条红）', async () => {
    const r2 = await lifecycle('f3a', 'corrupt-semantics');
    const r3 = await lifecycle('f3b', 'truncated-json');
    expect(r3.redLayers()).toEqual(['save']);
    const d2 = stageOf(r2, '5-加载').detail;
    const d3 = stageOf(r3, '5-加载').detail;
    expect(d3).not.toBe(d2);
    expect(d3).toContain('corrupted (not valid JSON)');
    expect(d3).toContain('SaveLoadError');      // 截断档不得裸抛 SyntaxError（c922-103 口径）
    // 两代都在盘上 ⇒ 截断只伤最新一代，异常恢复段仍应绿（这正是要给玩家的定位读数："回退 .bak 即可"）
    expect(r3.redStages()).toEqual(['5-加载', '6-事件']);
  });

  it('F4 渲染故障（未注册 defId 的建筑）⇒ 存档层全绿，只有 render 红（MapRenderer:675 会静默 continue 吞建筑）', async () => {
    const r = await lifecycle('f4', 'ghost-building');
    expect(r.redLayers(), `\n${summarize(r)}`).toEqual(['render']);
    expect(stageOf(r, '8-渲染可消费面').detail).toContain('defId不可解析=["ghost_fort_913e"]');
  });

  it('F5 渲染故障（建筑越界）⇒ 存档层全绿，只有 render 红（saveLoad 只验整数、不验地图界）', async () => {
    const r = await lifecycle('f5', 'offgrid-building');
    expect(r.redLayers(), `\n${summarize(r)}`).toEqual(['render']);
    expect(stageOf(r, '8-渲染可消费面').detail).toContain('越界建筑');
  });

  it('F6 反向对照：不注入故障时零红（证明 F1–F5 的红来自注入本身，不是本件的测量手法）', async () => {
    const r = await lifecycle('f6', 'none');
    expect(r.redLayers()).toEqual([]);
  });
});

describe('归因边界的两条产品事实（把"存档放行、渲染吞"钉死，不改产品码）', () => {
  it('B1 未注册 defId 与越界坐标都能原样往返存档 ⇒ 存档层看不见它们，只有渲染层会吞', () => {
    const src = makeStore(SEED);
    runDays(src, SEED, 5);
    const st = src.getState();                   // frozen clone：只读，不当作注入口
    const tampered = { ...st, buildings: [...st.buildings, building('ghost_fort_913e', 1, 1), building(A_REAL_DEF, 999_999, 999_998)] };
    const back = deserialize(serialize(tampered)) as GameState;
    expect(back.buildings.length).toBe(st.buildings.length + 2);
    expect(back.buildings.some(b => b.defId === 'ghost_fort_913e')).toBe(true);
    expect(back.buildings.some(b => b.position.x >= back.worldMap.width)).toBe(true);
    expect(getBuildingDef('ghost_fort_913e')).toBeUndefined();
    expect(getBuildingDef(A_REAL_DEF)).toBeDefined();
    // 前提自证：注入的两枚确实"形状合法"，否则上面那条"存档放行"是假结论
    expect(() => deserialize(serialize(tampered))).not.toThrow();
  });

  it('B2 getState() 是 frozen clone ⇒ 任何"往 getState() 上改"的测试写法都是假注入', () => {
    const store = makeStore(SEED);
    const view = store.getState();
    const day = view.currentDay;
    expect(Object.isFrozen(view)).toBe(true);
    let threw: string | null = null;
    try {
      (view as { currentDay: number }).currentDay = day + 999;
    } catch (err) {
      threw = err instanceof Error ? err.name : String(err);
    }
    expect(threw).toBe('TypeError');             // strict mode 下静默失败会直接变红
    expect(store.getState().currentDay).toBe(day);
  });
});
