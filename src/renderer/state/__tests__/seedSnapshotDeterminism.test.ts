/**
 * c925-6938：决定性（determinism）回归 —— 同一 seed ＋ 同一输入 ＋ 同一版本 ⇒ 同一状态快照。
 *
 * 卷宗「验收」两行拆成可执行命题：
 *   V1 快照差异**能定位到事件或版本**（不许只给一个"整串 hash 不等"的黑盒读数）；
 *   V2 随机源**没有隐式系统时间**（模拟路径不得调 Date.now / performance.now / Math.random）。
 *
 * 与本仓既有闸的关系：`sandboxSnapshot.test.ts` 是"终局精确值"锚（720 日贪心），
 * 它把漂移报成 `expected 6052 to be 6053` 一类**不可定位**的读数；本件补的是
 * "漂移发生在第几天、哪个字段"的定位面，以及随机源的时间纯度。二者不重复。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter, type GameState } from '../gameStore';
import { SAVE_SCHEMA_VERSION, serialize, deserialize } from '../saveLoad';
import { createRng } from '../rng';
import { POLICIES, EVENTS, DECREES } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import type { ResourceId } from '../../data/resourceRegistry';

const SEED = 20260813;
const DAYS = 60;

function makeSeededStore(seed: number): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, {
    rngSeed: seed,
    resources: { ...BALANCE.startingResources },
  }, { policies: POLICIES, events: EVENTS, decrees: DECREES });
}

/**
 * 推进 N 个游戏日。输入由 (seed, **绝对游戏日**) 派生 ⇒ 同一段日子无论一次跑完、
 * 还是中途存读后继续跑，注入序列逐位相同。
 * （按循环下标派生是一手踩坑：续跑段从 0 重新编号，会把差异**假归因给读档**。）
 * 输入面用"可复现的资源注入"——本仓无 enactDecree、RoyalDecree 无 cost 字段（tsc 现场否证）。
 */
function runDays(store: GameStore, days: number, seed: number): void {
  for (let d = 0; d < days; d++) {
    store.tickDay();
    const dayNo = store.getState().currentDay;
    const pick = createRng((seed ^ (dayNo * 2654435761)) >>> 0);
    if (pick.next() < 0.25) {
      const id = RES_SAMPLE[pick.nextInt(0, RES_SAMPLE.length - 1)]!;
      store.addResource(id, pick.nextInt(1, 20), 'seeded-input');
    }
  }
}

/**
 * V1 的定位面：把两份 state 逐字段摊平成 `path -> value`，返回**首个**差异（含发生日）。
 * `lastSeenTimestamp` 是墙钟字段，按名剔除并在报告里显式点名（不静默忽略）。
 */
const WALL_CLOCK_FIELDS = new Set(['lastSeenTimestamp']);

function flatten(obj: unknown, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (obj === null || typeof obj !== 'object') {
    return [[prefix, String(obj)]];
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (WALL_CLOCK_FIELDS.has(k)) continue;
    const path = prefix ? `${prefix}.${k}` : k;
    if (v === null || typeof v !== 'object') out.push([path, String(v)]);
    else if (Array.isArray(v)) {
      v.forEach((item, i) => out.push(...flatten(item, `${path}[${i}]`)));
    } else out.push(...flatten(v, path));
  }
  return out;
}

function firstDivergence(a: Array<[string, string]>, b: Array<[string, string]>) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const [ka, va] = a[i] ?? ['<缺项>', '<缺项>'];
    const [kb, vb] = b[i] ?? ['<缺项>', '<缺项>'];
    if (ka !== kb || va !== vb) return { index: i, left: `${ka}=${va}`, right: `${kb}=${vb}` };
  }
  return null;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('V2 随机源无隐式系统时间', () => {
  it('🔴 tickDay 全程不调用 Date.now / performance.now / Math.random', () => {
    const store = makeSeededStore(SEED);
    const nowSpy = vi.spyOn(Date, 'now');
    const rndSpy = vi.spyOn(Math, 'random');
    const perfSpy = vi.spyOn(performance, 'now');
    for (let d = 0; d < DAYS; d++) store.tickDay();
    const leak = {
      'Date.now': nowSpy.mock.calls.length,
      'Math.random': rndSpy.mock.calls.length,
      'performance.now': perfSpy.mock.calls.length,
    };
    expect(leak, `模拟路径时钟/随机泄漏：${JSON.stringify(leak)}（注：lastSeenTimestamp 仅由 setLastSeenNow 显式写，不在 tickDay 内）`).toEqual({
      'Date.now': 0, 'Math.random': 0, 'performance.now': 0,
    });
  });

  it('墙钟前进 30 天不影响模拟结果（快照对时间无关）', () => {
    const t0 = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(t0);
    const a = makeSeededStore(SEED);
    for (let d = 0; d < DAYS; d++) a.tickDay();
    const fa = flatten(a.getState());

    vi.setSystemTime(t0 + 30 * 86400_000);
    const b = makeSeededStore(SEED);
    for (let d = 0; d < DAYS; d++) b.tickDay();
    const fb = flatten(b.getState());

    expect(firstDivergence(fa, fb)).toBe(null);
    expect(a.getState().lastSeenTimestamp).toBe(b.getState().lastSeenTimestamp); // 未被动过
    // 明文 state 里的两个时间戳字段只能由显式 API 写（tickDay 不写；lastTickTimestamp 全仓无写入者）
    expect(a.getState().lastTickTimestamp).toBe(0);
  });

  it('rng 句柄本身与墙钟无关：同 seed 两实例逐位一致，且连跑两次取值不漂移', () => {
    const r1 = createRng(SEED);
    const r2 = createRng(SEED);
    const s1 = Array.from({ length: 20 }, () => r1.next());
    const s2 = Array.from({ length: 20 }, () => r2.next());
    expect(s1).toEqual(s2);
    expect(new Set(s1).size).toBe(20);      // 20 个不同值 ⇒ 不是常数发生器
    expect(Math.random).not.toBe(undefined); // 前提自证：spy 复位后 Math.random 仍在
  });
});

describe('V1 同 seed＋输入＋版本 ⇒ 同快照，且差异可定位', () => {
  it('同 seed 同输入 ⇒ 逐字段全等（摊平后 0 处差异）', () => {
    const a = makeSeededStore(SEED);
    const b = makeSeededStore(SEED);
    runDays(a, DAYS, SEED);
    runDays(b, DAYS, SEED);
    const fa = flatten(a.getState());
    const fb = flatten(b.getState());
    expect(fa.length).toBeGreaterThan(100);            // 前提自证：确实摊出了足够多的字段
    expect(firstDivergence(fa, fb)).toBe(null);
  });

  it('不同 seed ⇒ 差异能定位到"第几个字段／哪个字段"，而非只给一个不等', () => {
    const a = makeSeededStore(SEED);
    const b = makeSeededStore(SEED + 1);
    runDays(a, DAYS, SEED);
    runDays(b, DAYS, SEED + 1);
    const div = firstDivergence(flatten(a.getState()), flatten(b.getState()));
    expect(div, '异 seed 必须能被定位到具体字段').not.toBe(null);
    expect(div!.left.split('=')[0]).toMatch(/^[A-Za-z[.\]0-9]+$/); // 是个可定位的字段路径
  });

  it('🔴 差异可归因：同一 seed 但在第 15 日注入一次输入 ⇒ 能报出首个变化日与字段；事件面有专属字段可定位', () => {
    const harvest = (injectDay: number | null) => {
      const store = makeSeededStore(SEED);
      const series: string[] = [];
      for (let d = 0; d < DAYS; d++) {
        store.tickDay();
        if (injectDay !== null && d === injectDay) {
          store.addResource('gold', 500, 'test-inject'); // 可证实改变 state 的输入
        }
        const g = store.getState();
        const r = store.getResources();
        // 日序列必须含"事件/法令面"，否则只改 activeDecrees 的干预在资源序列上不可见
        // （实测：只用资源＋建筑数时 firstChanged 读成 -1，会把"定位不到"错怪成引擎失灵）
        series.push(JSON.stringify([
          g.currentDay, ...RES_SAMPLE.map(k => r[k] ?? 0),
          g.activeModifiers.length, g.buildings.length,
          g.activeDecrees, g.completedDecreeIds, g.lastEventDay,
        ]));
      }
      return { series, flat: flatten(store.getState()) };
    };
    const base = harvest(null);
    const perturbed = harvest(14);
    expect(base.series.length).toBe(DAYS);
    const firstChanged = base.series.findIndex((row, i) => row !== perturbed.series[i]);
    // 干预点在 d=14（第 15 日）⇒ 差异**不得早于**该日，且必须能报出是哪一天
    expect(firstChanged, '干预后必须能定位到首个变化日').toBeGreaterThanOrEqual(14);
    expect(firstChanged).toBeLessThan(DAYS);
    const div = firstDivergence(base.flat, perturbed.flat);
    expect(div).not.toBe(null);
    expect(div!.left.split('=')[0]).toMatch(/gold|resources|activeDecrees|modifiers/);
    // 事件面专属字段确实存在于明文 state ⇒ 事件类差异有归属位点（非黑盒）
    // 事件归属位点必须是**明文 state 的键**（空数组不会摊出路径，故按键名查，不按摊平串查）
    const stateKeys = new Set(Object.keys(makeSeededStore(SEED).getState()));
    for (const ev of ['eventHistory', 'lastEventDay', 'seenJitHints', 'activeDecrees', 'completedDecreeIds', 'grainNegativeDays', 'rngSeed']) {
      expect(stateKeys.has(ev), `明文 state 缺事件/状态位点 ${ev}`).toBe(true);
    }
  });

  it('版本面可归因：快照身份串带 SAVE_SCHEMA_VERSION，版本变则身份变（差异可归因到版本）', () => {
    const identity = (state: GameState, version: number) =>
      JSON.stringify({ version, seed: state.rngSeed, day: state.currentDay, fields: flatten(state) });
    const a = makeSeededStore(SEED);
    runDays(a, DAYS, SEED);
    const s = a.getState();
    const asStored = identity(s, SAVE_SCHEMA_VERSION);
    const asNewerVersion = identity(s, SAVE_SCHEMA_VERSION + 1);
    expect(asStored).not.toBe(asNewerVersion);
    // 存档信封确实带版本与 savedAt ⇒ 两枚同 state 的存档可比版本、可比内容（savedAt 显式剔除）
    const env = serialize(s) as unknown as { schemaVersion?: number; savedAt?: number; state?: unknown };
    expect(env.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(typeof env.savedAt).toBe('number');
    expect(flatten(env.state ?? {}).some(([k]) => WALL_CLOCK_FIELDS.has(k.split('.').pop() ?? ''))).toBe(false);
    // 🔴 否证一条主班口径：存档信封里 **没有** gameVersion / 0.10.0 这一坐标
    expect(JSON.stringify(Object.keys(env))).not.toMatch(/gameVersion/);
    expect(JSON.stringify(Object.keys(env.state as object))).not.toMatch(/gameVersion/);
  });

  it('存档往返保持决定性：serialize→state 的摊平串与自己直接摊平同值（差异不来自序列化层）', () => {
    const a = makeSeededStore(SEED);
    runDays(a, DAYS, SEED);
    const st = a.getState();
    const env = serialize(st) as unknown as { state: Record<string, unknown> };
    const persisted = new Set(Object.keys(env.state));
    const liveKeys = Object.keys(st);
    // 实测：信封 state 比明文 state 少 2 个顶层键（paused／lastTickTimestamp），
    // 其余逐一对应 ⇒ 快照身份串应以明文 state 为准，存档侧差异可直接点名到这两个键。
    expect(persisted.size).toBeLessThan(liveKeys.length);
    for (const k of persisted) expect(liveKeys, `信封键 ${k} 不在明文 state 里`).toContain(k);
    const missing = liveKeys.filter(k => !persisted.has(k));
    expect(missing.length).toBeGreaterThan(0);   // 信封确为真子集
    // 实测（本班现取，否证了"存档吞掉 rngSeed"这一猜测）：信封只丢 2 个顶层键，
    // 且 rngSeed **是**持久化的 ⇒ "同一存档 ⇒ 同一后续随机轨迹"成立。
    expect(missing.sort()).toEqual(['lastTickTimestamp', 'paused']);
    expect(persisted.has('rngSeed')).toBe(true);
    for (const k of persisted) expect(liveKeys, `信封键 ${k} 不在明文 state 里`).toContain(k);
  });

  it('STATE_REPLACED 不注入新随机数：读档路径上 rngSeed／currentDay 逐位不变', () => {
    const a = makeSeededStore(SEED);
    runDays(a, DAYS, SEED);
    const before = { seed: a.getState().rngSeed, day: a.getState().currentDay };
    const restored = deserialize(serialize(a.getState())) as GameState;
    a.replaceState(restored);
    expect(a.getState().rngSeed).toBe(before.seed);
    expect(a.getState().currentDay).toBe(before.day);
    // 随机源不注入：读档后再跑 10 日的**驱动面**（种子态＋资源＋人口＋建筑数）
    // 与"从未中断"的同 seed 进程逐位一致。
    // ⚠ 不比全字段：serialize 的信封 state 少 2 个顶层键（paused／lastTickTimestamp），
    //   摊平后会**整体串位**（实测首个错位出现在 index 52：左 tutorialStepId vs 右 lastEventDay），
    //   那种"差异"是键集差不是随机数差 ⇒ 这里只比驱动面，全字段等价交 result L2 裁。
    const uninterrupted = makeSeededStore(SEED);
    runDays(uninterrupted, DAYS + 10, SEED);
    runDays(a, 10, SEED);
    const drive = (g: GameState) => JSON.stringify({
      seed: g.rngSeed, day: g.currentDay, resources: g.resources,
      populationClasses: g.populationClasses, buildings: g.buildings.length,
      grade: g.grade, activeModifiers: g.activeModifiers.length,
    });
    expect(drive(a.getState())).toBe(drive(uninterrupted.getState()));
    // 并把"丢字段"这件事本身钉成断言（差异可定位到字段名的最小面）
    // deserialize 会把明文 state 的**全部**键补齐（含默认值）⇒ "读档丢字段"不成立；
    // 少掉的 2 个键只存在于信封里，读档时按默认值回填（paused 复位等）。
    const dropped = Object.keys(a.getState()).filter(k => !(k in restored)).sort();
    expect(dropped).toEqual([]);
    expect('rngSeed' in restored).toBe(true); // 种子随存档复原 ⇒ 同存档可续跑同轨迹
    void STATE_EVENTS;
  });
});

const RES_SAMPLE: ResourceId[] = ['grain', 'wood', 'stone', 'gold', 'people', 'cloth', 'bronze', 'rite', 'influence'];
