/**
 * 20260925-120441-da6f（B/test）：回放（快照复跑）内容四要素清点 + 隔离目录复现同一事件 + 缺字段拒收面。
 *
 * 卷宗原文：「检查回放是否包含版本、seed、输入事件和关键状态。验收：快照可在隔离目录复现同一事件；缺字段明确拒绝。」
 *
 * 先点名两处**派单/卷宗概念与仓库实况的分歧**（收窄依据，均在本文件里有可复算断言）：
 *  ① 「回放」在本仓**不是一条已实现的输入重放链**：`rg -F inputLog|actionLog|commandLog|intentLog|eventLog|replayFrame|userInput`
 *     在 src/ 与 scripts/ 下全部 0 命中（只有 docs/insights 里的「重跑审计脚本」义项）。仓内**唯一**能承载"复跑同一段"的
 *     制品是 `state/saveLoad.ts` 的存档信封（serialize/deserialize）＋按日派生的 rng。⇒ 本件把"回放"落到**快照复跑**上。
 *  ② 「输入事件」在信封里对应 `state.eventHistory`（已结算朝议 id 账本，供防重复采样）＋`pendingEventId`/`lastEventDay`
 *     （事件节拍位点），**不是玩家操作日志**（见 ①）。⇒ 清点按"事件面位点是否随快照走"判，并在 A3 把"无输入日志"钉成事实。
 *
 * 与同仓既有闸的分工（避免重复建设）：
 *   `seedSnapshotDeterminism.test.ts`（c925-6938）判"同 seed＋输入＋版本 ⇒ 同快照"与随机源时间纯度，全程**在内存里**往返；
 *   `atomicSaveCrash.test.ts`（e89f）判写盘原子性与断电残体，载荷是 3 字段手写 JSON；
 *   本件判的是**载荷内容**：四要素是否真落在**盘上字节**里、盘上字节能否复现同一条事件流、
 *   以及"缺字段"这一面**哪些真拒、哪些静默回填**（回填里哪些会改变回放轨迹）。
 *
 * 盘面纪律（B 档）：真 FS 只碰 `os.tmpdir()` 下本件自己 mkdtemp 的一个目录，afterAll 删除；
 *   主进程 handler 不可 import（import 期 `ensureDDrivePaths()` 会往 cwd 外 mkdirSync）⇒ D 组走**源码字节钉桩**；
 *   全程不改产品码：C2 测出的"缺字段不拒绝"一律登记进 result 待裁，不在本件里顺手改语义。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type GameState, type IEventEmitter } from '../gameStore';
import { MAX_SAVE_CURRENT_DAY, SAVE_SCHEMA_VERSION, SaveLoadError, deserialize, serialize } from '../saveLoad';
import { createRng } from '../rng';
import { TERRAIN_KINDS } from '../../data/mapSchema';
import { DECREES, EVENTS, POLICIES } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import type { ResourceId } from '../../data/resourceRegistry';

const SEED = 20260925;
const PRE_DAYS = 60;   // 落盘前跑的天数（也是"一次跑完"vs"中断续跑"的切点）
const POST_DAYS = 60;  // 续跑天数：>= forceMaxDays(50)+冷却 ⇒ 保证这一窗内必然采到事件

const RES_SAMPLE: ResourceId[] = ['grain', 'wood', 'stone', 'gold', 'people', 'cloth', 'bronze', 'rite', 'influence'];

function makeSeededStore(seed: number): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, {
    rngSeed: seed,
    resources: { ...BALANCE.startingResources },
  }, { policies: POLICIES, events: EVENTS, decrees: DECREES });
}

/**
 * 事件流行：绝对游戏日 + 当日触发（并结算）的事件 id + 注入的抉择号。
 * 这是"复现同一事件"的比对轴——不是整串 state hash（那种读数不可定位）。
 */
interface StreamRow {
  day: number;
  eventId: string | null;
  choice: number;
}

/** 输入按 (seed, **绝对游戏日**) 派生 ⇒ 同一段日子无论一次跑完还是中断续跑，注入序列逐位相同。 */
function injectForDay(store: GameStore, seed: number, day: number): void {
  const pick = createRng((seed ^ (day * 2654435761)) >>> 0);
  if (pick.next() < 0.3) {
    const id = RES_SAMPLE[pick.nextInt(0, RES_SAMPLE.length - 1)]!;
    store.addResource(id, pick.nextInt(1, 20), 'seeded-input');
  }
}

/** 跑 count 天，返回事件流（含当日 pending 的结算）。日号一律取 store 自己的 currentDay（不假设起点）。 */
function runDays(store: GameStore, seed: number, count: number): StreamRow[] {
  const rows: StreamRow[] = [];
  for (let i = 0; i < count; i++) {
    store.tickDay();
    const day = store.getState().currentDay;
    injectForDay(store, seed, day);
    const eventId = store.getState().pendingEventId;
    let choice = -1;
    if (eventId !== null) {
      // 越界 choiceIdx 在 eventEngine.applyEventChoice 里是"仅清空不回执"（已读源码确认），故可安全派生 0..2
      choice = day % 3;
      store.resolveEvent(choice);
    }
    rows.push({ day, eventId, choice });
  }
  return rows;
}

function streamKey(rows: StreamRow[]): string {
  return rows.map(r => `${r.day}:${r.eventId ?? '-'}:${r.choice}`).join('|');
}

function triggeredIds(rows: StreamRow[]): string[] {
  return rows.map(r => r.eventId).filter((x): x is string => x !== null);
}

/** 事件流的"驱动面"读数（除 id 外再带关键状态指纹），用于证明比对不是拿两个空串比。 */
function driveKey(store: GameStore): string {
  const g = store.getState();
  return JSON.stringify({
    day: g.currentDay,
    seed: g.rngSeed,
    eventHistory: g.eventHistory,
    lastEventDay: g.lastEventDay,
    resources: g.resources,
    buildings: g.buildings.length,
    populationClasses: g.populationClasses,
    grade: g.grade,
    modifiers: g.activeModifiers.length,
  });
}

// ---------- 隔离目录（真 FS，只此一个，收工删除） ----------

let isoRoot = '';
let isoSaves = '';

beforeAll(() => {
  isoRoot = mkdtempSync(join(tmpdir(), 'colony34-da6f-'));
  isoSaves = join(isoRoot, 'saves');
  mkdirSync(isoSaves, { recursive: true });
});

afterAll(() => {
  const probe = isoRoot;
  if (probe) rmSync(probe, { recursive: true, force: true });
  expect(existsSync(probe)).toBe(false);
});

/** 主进程 handler 的读盘面口径：只认 `<slot>.json` 的 utf-8 字节，不做任何 JSON 加工。 */
function writeSlotJson(slot: string, bytes: string): string {
  // 🔴 门禁：本仓实测踩过——把建目录/写盘语句写在 `describe` 正文里会在 **vitest 收集期**执行，
  //   那时 beforeAll 还没跑、isoSaves 还是空串，`join('', f)` 退化成相对路径 ⇒ 把 355 KB 存档
  //   真写进仓库根（本班 porcelain 里那枚 `?? a_inventory.json` 的成因）。缺目录直接抛，不许回落 cwd。
  if (!isoSaves) throw new Error('isoSaves 未初始化：写盘只允许发生在 beforeAll 之后（禁止在 describe 正文里落盘）');
  const fp = join(isoSaves, `${slot}.json`);
  writeFileSync(fp, bytes, 'utf-8');
  return fp;
}

function readSlotJson(fp: string): string {
  return readFileSync(fp, 'utf-8');
}

type SaveBlob = Record<string, unknown>;

function envelopeOf(bytes: string): SaveBlob {
  return JSON.parse(bytes) as SaveBlob;
}

function stateOf(env: SaveBlob): SaveBlob {
  return env['state'] as SaveBlob;
}

// ---------- A：回放四要素清点（判据看**盘上字节**，不看内存对象） ----------

interface InventoryFixture {
  store: GameStore;
  rows: StreamRow[];
  bytes: string;
  env: SaveBlob;
  st: SaveBlob;
}

/**
 * 🔴 惰性夹具（不是 describe 正文）：A 组要在**盘上**验字节，而 `describe` 正文在 vitest 收集期就执行，
 * 那时隔离目录还没建 ⇒ 写盘会回落到 cwd（本班一手踩到，见 writeSlotJson 的门禁注释）。
 */
let inventoryFixture: InventoryFixture | null = null;

function getInventoryFixture(): InventoryFixture {
  if (inventoryFixture) return inventoryFixture;
  const store = makeSeededStore(SEED);
  const rows = runDays(store, SEED, PRE_DAYS);
  const bytes = JSON.stringify(serialize(store.getState()));
  const env = envelopeOf(readSlotJson(writeSlotJson('a_inventory', bytes)));
  inventoryFixture = { store, rows, bytes, env, st: stateOf(env) };
  return inventoryFixture;
}

describe('A 快照内容清点：版本 / seed / 事件面 / 关键状态 是否真在盘上字节里', () => {
  it('A0 前提自证：这一段确实采到过事件（否则"复现同一事件"会拿两个空流互证）', () => {
    const { rows, st } = getInventoryFixture();
    expect(triggeredIds(rows).length, `前 ${PRE_DAYS} 日事件流为空 ⇒ 本件的比对轴失效，需加长窗或换 seed`).toBeGreaterThan(0);
    expect(st['eventHistory']).toBeInstanceOf(Array);
    expect((st['eventHistory'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('A1 版本要素：信封顶层带 schemaVersion，值等于产品常量（不是手写数字）', () => {
    const { env } = getInventoryFixture();
    expect(env['schemaVersion']).toBe(SAVE_SCHEMA_VERSION);
    expect(typeof env['schemaVersion']).toBe('number');
    // savedAt 是墙钟位（Date.now），它必然随写盘时刻变 ⇒ 显式点名，防止被当成回放坐标
    expect(typeof env['savedAt']).toBe('number');
  });

  it('A2 seed 要素：state.rngSeed 与 worldMap.seed 双位点都在盘上，且都是有限数', () => {
    const { st } = getInventoryFixture();
    expect(typeof st['rngSeed']).toBe('number');
    expect(Number.isFinite(st['rngSeed'] as number)).toBe(true);
    expect(st['rngSeed']).toBe(SEED);
    const wm = st['worldMap'] as SaveBlob;
    expect(typeof wm['seed']).toBe('number');
    expect(Number.isFinite(wm['seed'] as number)).toBe(true);
    // 两个 seed 位点在盘面各自独立存在（worldMap.seed 只喂地图，rngSeed 喂模拟）
    expect(Object.keys(wm).sort()).toEqual(['height', 'resourceNodes', 'seed', 'tiles', 'width']);
  });

  it('A3 输入事件要素：盘上只有"事件账本"，没有任何玩家输入日志位点（否证卷宗字面前提）', () => {
    const { st } = getInventoryFixture();
    const keys = Object.keys(st);
    // 事件面位点齐备（回放一条已触发事件所需）
    for (const k of ['eventHistory', 'pendingEventId', 'lastEventDay', 'seenJitHints']) {
      expect(keys, `信封 state 缺事件面位点 ${k}`).toContain(k);
    }
    // 🔴 否证：仓内不存在"操作序列回放"制品 ⇒ 信封里也不可能有。命中即说明有人新增了输入日志，需回来复核本件口径。
    const inputLogKeys = ['inputLog', 'actionLog', 'commandLog', 'intentLog', 'eventLog', 'replayFrames', 'userInputs', 'inputs'];
    expect(keys.filter(k => inputLogKeys.includes(k))).toEqual([]);
  });

  it('A4 关键状态要素：资源/建筑/人口/日号/国格 在盘上字节里逐一对应内存 state', () => {
    const { store, bytes, st } = getInventoryFixture();
    const live = store.getState();
    expect(st['currentDay']).toBe(live.currentDay);
    expect(st['resources']).toEqual(live.resources);
    expect(st['buildings']).toEqual(live.buildings);
    expect(st['populationClasses']).toEqual(live.populationClasses);
    expect(st['grade']).toBe(live.grade);
    expect(st['eventHistory']).toEqual(live.eventHistory);
    // 反向对照：盘上字节与"随便改一个字段的字节"不同 ⇒ 关键状态真在字节里参与身份，不是恒等串
    const tampered = bytes.replace('"currentDay":' + live.currentDay, '"currentDay":' + (live.currentDay + 1));
    expect(tampered).not.toBe(bytes);
    expect(envelopeOf(tampered)['state']).not.toEqual(st);
  });
});

// ---------- B：隔离目录复现同一事件 ----------

describe('B 隔离目录复现：盘上字节 → 读档续跑 ⇒ 与一次跑完同一条事件流', () => {
  it('B1 中断一次（真写盘/真读盘）后续跑，事件流与"从未中断"逐位相同', () => {
    // 基准：一次跑完 PRE+POST
    const uninterrupted = makeSeededStore(SEED);
    const fullRows = runDays(uninterrupted, SEED, PRE_DAYS + POST_DAYS);
    expect(triggeredIds(fullRows).length).toBeGreaterThan(1); // 比对轴非空

    // 中断：跑 PRE 天 → serialize → 真写盘 → 换进程态（新 store）→ 真读盘 → deserialize → replaceState → 续跑
    const interrupted = makeSeededStore(SEED);
    const headRows = runDays(interrupted, SEED, PRE_DAYS);
    const fp = writeSlotJson('b_replay', JSON.stringify(serialize(interrupted.getState())));
    const restored = deserialize(JSON.parse(readSlotJson(fp))) as GameState;
    const fresh = makeSeededStore(SEED); // 全新实例，只灌存档
    fresh.replaceState(restored);
    const tailRows = runDays(fresh, SEED, POST_DAYS);

    const reconstructed = [...headRows, ...tailRows];
    expect(streamKey(reconstructed)).toBe(streamKey(fullRows));
    expect(triggeredIds(reconstructed).length).toBe(triggeredIds(fullRows).length);
    // 驱动面也一致（含资源/人口/建筑/国格）⇒ 差异不来自序列化层
    expect(driveKey(fresh)).toBe(driveKey(uninterrupted));
  });

  it('B2 反向对照：同一盘上字节，只把 rngSeed 改掉再续跑 ⇒ 事件流必须变（证明 B1 有判别力）', () => {
    const base = makeSeededStore(SEED);
    runDays(base, SEED, PRE_DAYS);
    const fp = writeSlotJson('b_control', JSON.stringify(serialize(base.getState())));
    const onDisk = envelopeOf(readSlotJson(fp));
    const seedA = stateOf(onDisk)['rngSeed'] as number;

    // 注入扰动：只改 rngSeed 一个字段，其余字节逐字不动
    const perturbed = JSON.parse(JSON.stringify(onDisk)) as SaveBlob;
    const seedB = stateOf(perturbed)['rngSeed'] !== undefined ? (stateOf(perturbed)['rngSeed'] as number) ^ 0x5a5a : 0;
    stateOf(perturbed)['rngSeed'] = seedB;

    const a = makeSeededStore(seedA);
    a.replaceState(deserialize(onDisk) as GameState);
    const rowsA = runDays(a, seedA, POST_DAYS);

    const b = makeSeededStore(seedB);
    b.replaceState(deserialize(perturbed) as GameState);
    const rowsB = runDays(b, seedB, POST_DAYS);

    expect(seedA).not.toBe(seedB);            // 前提自证：扰动确实生效
    expect(streamKey(rowsA)).not.toBe(streamKey(rowsB));
  });

  it('B3 隔离自证：本件写盘全部落在 os.tmpdir() 的自建目录，仓内与用户数据目录零新增', () => {
    expect(isoRoot.startsWith(tmpdir())).toBe(true);
    expect(existsSync(join(process.cwd(), 'saves'))).toBe(false);
    // 🔴 本仓一手踩过的形态：收集期写盘回落到 cwd ⇒ 点名此刻应存在的三个槽位，两处对照一起看
    for (const slot of ['a_inventory', 'b_replay', 'b_control']) {
      expect(existsSync(join(process.cwd(), `${slot}.json`)), `槽位 ${slot} 落到了仓库根（隔离失效）`).toBe(false);
      expect(existsSync(join(isoSaves, `${slot}.json`)), `槽位 ${slot} 没进隔离目录`).toBe(true);
    }
    const listed = readFileSync('src/main/index.ts', 'utf-8');
    expect(listed).toContain("app.getPath('userData')"); // 真盘路径由主进程持有，本件从不触它
  });
});

// ---------- C：缺字段的两副面孔（真拒 / 静默回填） ----------

function minimalBlob(): SaveBlob {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: 1700000000000,
    // r5 B2：eventHistory 是载荷字段（缺它＝拒载）⇒ 本组"最小合法档"必须带上它，
    // 否则 C1 的形状反例会被缺字段闸先拦下，测不到目标判据（下面 C2 组专门测"删掉它"）。
    state: { currentDay: 30, rngSeed: 777, resources: { grain: 10 }, buildings: [], eventHistory: [] },
  };
}

function withState(mut: (st: SaveBlob) => void): SaveBlob {
  const b = minimalBlob();
  mut(stateOf(b));
  return b;
}

describe('C1 缺字段明确拒绝（成立的那一面）：每个反例都要抛 SaveLoadError 且消息可定位', () => {
  const cases: Array<{ name: string; blob: SaveBlob; msg: RegExp }> = [
    { name: 'blob 非对象', blob: null as unknown as SaveBlob, msg: /non-null object/ },
    { name: '缺 schemaVersion', blob: (() => { const b = minimalBlob(); delete b['schemaVersion']; return b; })(), msg: /missing schemaVersion field/ },
    { name: 'schemaVersion 非数', blob: { ...minimalBlob(), schemaVersion: '9' }, msg: /schemaVersion must be a number/ },
    { name: 'schemaVersion 超前', blob: { ...minimalBlob(), schemaVersion: SAVE_SCHEMA_VERSION + 1 }, msg: /future schema version/ },
    { name: '缺 state', blob: (() => { const b = minimalBlob(); delete b['state']; return b; })(), msg: /missing state field/ },
    { name: 'resources 含非有限值', blob: withState(s => { s['resources'] = { grain: Number.NaN }; }), msg: /resources must be a record of finite numbers/ },
    { name: 'currentDay 越界', blob: withState(s => { s['currentDay'] = MAX_SAVE_CURRENT_DAY + 1; }), msg: /currentDay out of range/ },
    { name: 'worldMap.seed 非有限', blob: withState(s => { s['worldMap'] = { width: 2, height: 2, tiles: tileBlob(4), resourceNodes: [], seed: 'x' }; }), msg: /worldMap\.seed must be a finite number/ },
    { name: 'worldMap.tiles 长度不匹配', blob: withState(s => { s['worldMap'] = { width: 2, height: 2, tiles: tileBlob(3), resourceNodes: [], seed: 1 }; }), msg: /tiles\.length=3 does not match width\*height=4/ },
    { name: 'buildings 形状坏', blob: withState(s => { s['buildings'] = { nope: true }; }), msg: /building/i },
  ];

  for (const c of cases) {
    it(`拒绝 ${c.name}`, () => {
      expect(() => deserialize(c.blob), `${c.name} 应当抛错，实际静默通过`).toThrowError(SaveLoadError);
      expect(() => deserialize(c.blob)).toThrow(c.msg);
    });
  }

  it('反向对照：同一批用例的"字段齐全"版本必须通过（证明上面的红来自缺字段本身）', () => {
    expect(() => deserialize(minimalBlob())).not.toThrow();
    expect(() => deserialize(withState(s => {
      s['worldMap'] = { width: 2, height: 2, tiles: tileBlob(4), resourceNodes: [], seed: 1 };
      s['buildings'] = [];
    }))).not.toThrow();
  });
});

function tileBlob(n: number): SaveBlob[] {
  // 地形字面量取自数据注册表（写死 'grass' 会被 validateWorldMap 当场拒：合法值 plain/hills/forest/mountain/river）
  const terrain = TERRAIN_KINDS[0] as string;
  return Array.from({ length: n }, () => ({ terrain, buildable: true, walkable: true }));
}

describe('C2 缺失字段的处置（r5 B2 裁决已落地）：载荷字段拒载，UI 字段仍回填默认', () => {
  /**
   * 手法：跑 PRE 天拿真快照 → 从**盘上字节**里删掉一个字段 → 读档续跑 → 与"未删字段"的真值流比。
   * 三个结局分开钉：
   *   - 删 rngSeed：回填 12345 ⇒ 后续事件流**变**（回放静默换轨，卷宗「缺字段明确拒绝」在产品侧不成立）
   *   - 删 eventHistory：回填 [] ⇒ 防重复账本丢失 ⇒ 后续事件流**变**（同上）
   *   - 删 panelCollapsed：回填默认且**不影响**回放（纯 UI 位点）⇒ 对照组，证明差异归因于字段载荷性
   */
  function replayAfterDeleting(field: 'rngSeed' | 'eventHistory' | 'panelCollapsed'): {
    restoredValue: unknown;
    diverged: boolean;
    throws: string | null;
  } {
    const store = makeSeededStore(SEED);
    const head = runDays(store, SEED, PRE_DAYS);
    const env = envelopeOf(JSON.stringify(serialize(store.getState())));
    const fp = writeSlotJson(`c_${field}`, JSON.stringify(env));
    const onDisk = envelopeOf(readSlotJson(fp));

    // 真值流（未删字段）
    const truth = makeSeededStore(SEED);
    truth.replaceState(deserialize(JSON.parse(JSON.stringify(onDisk))) as GameState);
    const truthRows = runDays(truth, SEED, POST_DAYS);

    const edited = JSON.parse(JSON.stringify(onDisk)) as SaveBlob;
    const original = stateOf(edited)[field];
    delete stateOf(edited)[field];

    let restoredValue: unknown;
    let rows: StreamRow[];
    let throws: string | null = null;
    try {
      const restored = deserialize(edited) as GameState;
      // 🔴 必须深拷一份再留：`restored` 随后被 replaceState 装成 s2 的活 state，
      //    直接存引用会被后续 runDays 改写（实测：eventHistory 读成跑完 60 日后的 4 条，假"未回填"）
      const raw = (restored as unknown as SaveBlob)[field];
      restoredValue = raw === undefined ? undefined : (JSON.parse(JSON.stringify(raw)) as unknown);
      const s2 = makeSeededStore(SEED);
      s2.replaceState(restored);
      rows = runDays(s2, SEED, POST_DAYS);
    } catch (err) {
      throws = err instanceof Error ? err.message : String(err);
      rows = [];
    }
    void head;
    return { restoredValue, diverged: streamKey(rows) !== streamKey(truthRows), throws };
  }

  it('删 rngSeed ⇒ **拒载**（r5 B2：载荷字段缺失不再静默回填、不静默换轨）', () => {
    const r = replayAfterDeleting('rngSeed');
    expect(r.throws).toMatch(/missing load-bearing field/);
    expect(r.throws).toContain('rngSeed');
    expect(r.restoredValue).toBeUndefined();
  });

  it('删 eventHistory ⇒ **拒载**（r5 B2：防重复账本丢失，不许当空账本放行）', () => {
    const r = replayAfterDeleting('eventHistory');
    expect(r.throws).toMatch(/missing load-bearing field/);
    expect(r.throws).toContain('eventHistory');
    expect(r.restoredValue).toBeUndefined();
  });

  it('反向对照：删 panelCollapsed ⇒ 不拒绝、回填默认、事件流不变（证明上面两条差异归因于字段载荷性）', () => {
    const r = replayAfterDeleting('panelCollapsed');
    expect(r.throws).toBe(null);
    expect(r.restoredValue).toEqual({ left: false, right: false });
    expect(r.diverged).toBe(false);
  });
});

// ---------- D：写盘链路不吞四要素（源码字节钉桩，不 import 主进程） ----------

describe('D 主进程透传钉桩：save/load 不加工载荷，四要素不会在盘路上被吞', () => {
  const mainSrc = readFileSync('src/main/index.ts', 'utf-8');
  const saveStart = mainSrc.indexOf("ipcMain.handle('save-game'");
  const saveEnd = mainSrc.indexOf("ipcMain.handle('load-game'", saveStart);
  const loadEnd = mainSrc.indexOf("ipcMain.handle('list-saves'", saveEnd);
  if (saveStart === -1 || saveEnd === -1 || loadEnd === -1) throw new Error('save-game / load-game handler not found in src/main/index.ts');
  const saveBody = mainSrc.slice(saveStart, saveEnd);
  const loadBody = mainSrc.slice(saveEnd, loadEnd);

  it('save-game 对载荷零加工：整段没有 JSON.parse / JSON.stringify ⇒ 不会重排或丢键', () => {
    expect(saveBody).not.toMatch(/JSON\.(parse|stringify)/);
    expect(saveBody).toContain('await writeFile(tmp, json');
  });

  it('载荷必须是 string：非字符串直接抛（杜绝"半截对象落盘"）', () => {
    expect(saveBody).toContain("if (typeof json !== 'string')");
  });

  it('load-game 原样 readFile 返回，不读 .tmp/.bak ⇒ 渲染层拿到的字节与写进去的同一份', () => {
    expect(loadBody).toContain('await readFile(fp,');
    expect(loadBody).not.toMatch(/JSON\.(parse|stringify)/);
    expect(loadBody).toContain('${slot}.json');
    expect(loadBody).not.toContain('.tmp');
  });

  it('往返字节全等（把 D 组绑到 A/B 的真盘序列上）', () => {
    const store = makeSeededStore(SEED);
    runDays(store, SEED, 12);
    const bytes = JSON.stringify(serialize(store.getState()));
    const fp = writeSlotJson('d_passthrough', bytes);
    expect(readSlotJson(fp)).toBe(bytes);
    const st = stateOf(envelopeOf(readSlotJson(fp)));
    for (const k of ['rngSeed', 'eventHistory', 'currentDay', 'resources', 'buildings', 'worldMap']) {
      expect(st, `往返后盘上缺 ${k}`).toHaveProperty(k);
    }
  });

  it('收面总隔离检查（本组是文件里最后一组）：全部槽位只在 tmpdir，仓库根零残留', () => {
    const slots = ['a_inventory', 'b_replay', 'b_control', 'c_rngSeed', 'c_eventHistory', 'c_panelCollapsed', 'd_passthrough'];
    for (const slot of slots) {
      expect(existsSync(join(isoSaves, `${slot}.json`)), `槽位 ${slot} 未落在隔离目录`).toBe(true);
      expect(existsSync(join(process.cwd(), `${slot}.json`)), `槽位 ${slot} 泄漏到仓库根`).toBe(false);
    }
  });
});
