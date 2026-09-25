/**
 * inbox `20260925-120429-ad32`（风险档 B · 工作类型 test）
 *
 * 卷宗原文：「对同 tick 同优先级事件和跨 tick 事件建立确定顺序。验收：顺序写入快照并有回归样例；不依赖对象枚举顺序。」
 *
 * 🔴 前提否证（先 rg 证其在世）：**本仓没有"事件优先级"这个运行时概念**。
 *   `priority?: number` 只挂在 `schema.ts` 的 `BadgeRule`（建筑角标）上，而 `badgeRules` 在非测试源里
 *   **除类型声明与数据表外零消费者**（③ 组静态桩实测命中文件集＝{data/buildings.ts, data/schema.ts}）。
 *   ⇒ 「同优先级」在盘上只有两种真实形态：**① 同一比较键上的并列（tie）**，如 `supplyChain.producersFor`
 *     的 `perDay` 相同；**② 声明序即隐式优先级**，如 `eventEngine.sampleEventTrigger` 取"第一条全部
 *     trigger 通过"的事件。这两种序面本件都钉。
 *   「同 tick 两条事件并存」也不成立：`runEventTick` 有 `pendingEventId` 单挂约束（一次只挂一条），
 *   本件把它钉成行为桩（② 组）。
 *
 * 判据落成的四根柱子（全部零生产码改动）：
 *   ① 显式序表 vs 对象枚举序（`buildDayPipeline` 按 `DAY_PHASE_ORDER`，handler 对象的 key 插入序被忽略）
 *   ② 同 tick 面（并列 tie 落输入序 ＋ 隐式优先级＝声明序 ＋ 单挂约束）
 *   ③ 跨 tick 面写入快照（`eventHistory` 的 push 序 ≡ 触发序，且随 serialize→deserialize 逐位不变）
 *   ④ 结算面与对象枚举序无关（resources 键插入序颠倒 ⇒ 同一日结算结果逐位相同）
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import { TimeSystem, SPEED_MS_PER_DAY } from '../timeSystem';
import { serialize, deserialize } from '../saveLoad';
import {
  DAY_PHASE_DEFS, DAY_PHASE_ORDER, buildDayPipeline, runDayPipeline, type DayPhaseId,
} from '../dayPipeline';
import { producersFor } from '../supplyChain';
import { sampleEventTrigger } from '../eventEngine';
import { BUILDINGS, EVENTS } from '../../data';
import type { BuildingDef, CourtEvent } from '../../data/schema';
import type { CountryMetrics } from '../dslEval';
import type { WorldMap } from '../../data/mapSchema';
import { RESOURCE_IDS, type ResourceId } from '../../data/resourceRegistry';

const RENDERER_ROOT = resolve(__dirname, '../..'); // src/renderer
const D1 = SPEED_MS_PER_DAY[1];

function listProdSources(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
      out.push(...listProdSources(p));
    } else if (ent.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}
/** src/renderer 下 state/ 与 data/ 两个"顺序敏感"目录的非测试源 */
function stateAndDataSources() {
  return ['state', 'data']
    .flatMap((d) => listProdSources(resolve(RENDERER_ROOT, d)))
    .map((p) => ({ rel: relative(RENDERER_ROOT, p).replace(/\\/g, '/'), src: readFileSync(p, 'utf8') }));
}

function allPlainMap(w = 16, h = 16): WorldMap {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(seed: number): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, { rngSeed: seed, worldMap: allPlainMap() }, {
    policies: [], events: EVENTS, decrees: [],
  });
  const s = store.getState();
  store.replaceState({
    ...s,
    resources: { ...s.resources, people: 60, grain: 1200, wood: 800, stone: 400, gold: 300 },
    populationClasses: { ...s.populationClasses, farmer: 45, worker: 10, soldier: 3, scholar: 2 },
  });
  return store;
}

function bdef(id: string, perDay: number): BuildingDef {
  return {
    id, name: id, category: '民生', tier: 1, cost: {}, constructionTime: 1,
    output: [{ resource: 'grain' as ResourceId, perDay }], upkeep: {},
    size: { width: 1, height: 1 }, assetKey: id, upgradeRequires: [],
    badgeRules: [], description: '', descPlain: '',
  };
}

// ─────────────────────────────────────────────────────────────
// ① 显式序表 vs 对象枚举序
// ─────────────────────────────────────────────────────────────
describe('ad32 ① 同 tick 阶段序：显式表承重，对象枚举序不承重', () => {
  it('handlers 的 key 以逆序/乱序插入，buildDayPipeline 仍按 DAY_PHASE_ORDER 产出，且每位绑的是自己的 handler', () => {
    const reversed = [...DAY_PHASE_ORDER].reverse();
    const marker: string[] = [];
    const handlers = {} as Record<DayPhaseId, () => void>;
    for (const id of reversed) handlers[id] = () => { marker.push(id); };
    const phases = buildDayPipeline(handlers);
    expect(phases.map((p) => p.id)).toEqual([...DAY_PHASE_ORDER]);
    runDayPipeline(phases);
    expect(marker).toEqual([...DAY_PHASE_ORDER]); // 执行序＝表序，与插入序（逆序）无关
  });

  it('缺任一 handler 直接抛错（顺序表与实现不同步即暴露，不会静默少跑一阶段）', () => {
    const handlers = {} as Record<DayPhaseId, () => void>;
    for (const id of DAY_PHASE_ORDER) handlers[id] = () => {};
    delete (handlers as Partial<Record<DayPhaseId, () => void>>).starvation;
    expect(() => buildDayPipeline(handlers)).toThrow(/day pipeline missing handlers: starvation/);
  });

  it('DAY_PHASE_ORDER 是无重复全序，且与 DEFS 键集双向闭合（枚举序即便变了也不会影响管道）', () => {
    expect(new Set(DAY_PHASE_ORDER).size).toBe(DAY_PHASE_ORDER.length);
    expect([...DAY_PHASE_ORDER].sort()).toEqual(Object.keys(DAY_PHASE_DEFS).sort());
  });
});

// ─────────────────────────────────────────────────────────────
// ② 同 tick 面：并列 tie ＋ 隐式优先级 ＋ 单挂约束
// ─────────────────────────────────────────────────────────────
describe('ad32 ② 同 tick：并列项按输入序，事件按声明序，且一次只挂一条', () => {
  it('producersFor 的 perDay 并列（本仓唯一真实存在的"同优先级"）⇒ 全等组保持输入数组序，重复调用逐位相同', () => {
    const defs = [bdef('a', 5), bdef('b', 9), bdef('c', 5), bdef('d', 5), bdef('e', 9)];
    const first = producersFor('grain', defs);
    expect(first.map((p) => p.defId)).toEqual(['b', 'e', 'a', 'c', 'd']); // 降序组内＝输入序
    expect(producersFor('grain', defs).map((p) => p.defId)).toEqual(first.map((p) => p.defId));
    // 同一批定义换一种输入序 ⇒ 并列组随之变 ⇒ 证明序面来自输入数组，不是内部键序或哈希
    const shuffled = [defs[3]!, defs[0]!, defs[4]!, defs[2]!, defs[1]!]; // d5 a5 e9 c5 b9
    expect(producersFor('grain', shuffled).map((p) => p.defId)).toEqual(['e', 'b', 'd', 'a', 'c']);
  });

  it('真实 BUILDINGS 表上，grain 产家的并列组＝数据声明序（可复算，非 Object.keys 抖动）', () => {
    const r = producersFor('grain', BUILDINGS);
    const declared = BUILDINGS.filter((d) => d.output.some((o) => o.resource === 'grain')).map((d) => d.id);
    for (const entry of r) {
      const sameRate = r.filter((x) => x.perDay === entry.perDay).map((x) => x.defId);
      const expected = declared.filter((id) => r.some((x) => x.defId === id && x.perDay === entry.perDay));
      expect(sameRate, `perDay=${entry.perDay} 并列组`).toEqual(expected);
    }
    expect(r.length).toBe(declared.length);
  });

  it('sampleEventTrigger 的隐式优先级＝数组声明序：两条都满足时取先声明者，反序数组即取另一条', () => {
    const mk = (id: string): CourtEvent => {
      const base = EVENTS[0]!;
      return { ...base, id, triggers: [{ condition: 'country_population >= 0' }] };
    };
    const metrics: CountryMetrics = {
      resources: {}, population: 10, morale: 50, wrath: 0, militaryPower: 0,
      year: 0, season: 0, dayOfYear: 0, rng: () => 0.5, grade: 1,
      storyChapter: -1, storyPowerAxis: 0, storyResourceAxis: 0,
    };
    const a = mk('evt_zzz_first');
    const b = mk('evt_aaa_second');
    expect(sampleEventTrigger([a, b], [], metrics)).toBe('evt_zzz_first');
    expect(sampleEventTrigger([b, a], [], metrics)).toBe('evt_aaa_second');
    // 已触发过的不再触发（防重复）⇒ 序面同时受 eventHistory 过滤，顺序可复算
    expect(sampleEventTrigger([a, b], ['evt_zzz_first'], metrics)).toBe('evt_aaa_second');
    expect(sampleEventTrigger([a, b], ['evt_zzz_first', 'evt_aaa_second'], metrics)).toBeNull();
  });

  it('同一天不会挂出第二条事件（pendingEventId 单挂约束）：触发日严格递增，槽位至多一条', () => {
    // ⚠ 实况修正：本仓不是"挂着不解就永远不再采样"——`runEventTick` 开头对挂起事件先做
    //   `checkEventTimeout`，超时即 `resolveEvent(0)` 并 **return**（当天不再采样）。
    //   ⇒ 玩家不点，事件也会按 defaultTimeoutDays 自动让位；但"一次只挂一条"这条不变量成立。
    const store = makeStore(31337);
    const ts = new TimeSystem(store);
    const days: number[] = [];
    const ids: string[] = [];
    store.on(STATE_EVENTS.EVENT_TRIGGERED, (p) => {
      days.push(store.getCurrentDay());
      ids.push(String((p as { eventId?: string }).eventId));
    });
    for (let i = 0; i < 600; i++) ts.update(D1);
    expect(days.length).toBeGreaterThanOrEqual(2); // 600 日内确有自动让位后再触发（非空桩）
    for (let i = 1; i < days.length; i++) {
      expect(days[i]!, `第 ${i} 次触发必须晚于前一次（同 tick 不并发两条）`).toBeGreaterThan(days[i - 1]!);
    }
    const st = store.getState();
    expect(st.pendingEventId === null || st.pendingEventId === ids[ids.length - 1]!).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// ③ 跨 tick 顺序写入快照
// ─────────────────────────────────────────────────────────────
describe('ad32 ③ 跨 tick：触发序 → eventHistory → 存档信封，逐位不失真', () => {
  it('按触发序结算若干事件后，serialize 的 eventHistory ≡ 触发序，且触发日严格递增', () => {
    const store = makeStore(20260925);
    const ts = new TimeSystem(store);
    const fired: { day: number; id: string }[] = [];
    for (let i = 0; i < 900; i++) {
      ts.update(D1);
      const st = store.getState();
      const pending = st.pendingEventId;
      if (pending !== null) {
        fired.push({ day: st.pendingEventDayStart ?? -1, id: pending });
        store.resolveEvent(0); // 模拟玩家按触发序点掉 ⇒ 腾出单挂位
      }
    }
    expect(fired.length).toBeGreaterThanOrEqual(3); // 自证非空对空
    for (let i = 1; i < fired.length; i++) {
      expect(fired[i]!.day, `第 ${i} 条的触发日必须晚于前一条`).toBeGreaterThan(fired[i - 1]!.day);
      expect(fired[i]!.id).not.toBe(fired[i - 1]!.id);
    }
    const env = serialize(store.getState()) as unknown as { state: { eventHistory: string[] } };
    expect(env.state.eventHistory).toEqual(fired.map((f) => f.id)); // 顺序真的进了快照
  });

  it('serialize→deserialize→serialize：所有序面数组逐位不变（含 eventHistory / activeModifiers / buildings / completedDecreeIds / seenJitHints）', () => {
    const store = makeStore(999);
    const ts = new TimeSystem(store);
    for (let i = 0; i < 400; i++) {
      ts.update(D1);
      const st = store.getState();
      if (st.pendingEventId !== null) store.resolveEvent(0);
    }
    const s1 = serialize(store.getState()) as unknown as { state: Record<string, unknown> };
    const restored = deserialize(s1);
    const s2 = serialize(restored) as unknown as { state: Record<string, unknown> };
    const arr = (o: Record<string, unknown>, k: string): unknown[] => (o[k] as unknown[]) ?? [];
    for (const key of ['eventHistory', 'completedDecreeIds', 'seenJitHints', 'policies', 'activeDecrees']) {
      expect(arr(s2.state, key), key).toEqual(arr(s1.state, key));
    }
    expect(
      (s2.state.activeModifiers as { id: string }[]).map((m) => m.id),
    ).toEqual((s1.state.activeModifiers as { id: string }[]).map((m) => m.id));
    expect(
      (s2.state.buildings as { defId: string; position: { x: number; y: number } }[])
        .map((b) => `${b.defId}@${b.position.x},${b.position.y}`),
    ).toEqual(
      (s1.state.buildings as { defId: string; position: { x: number; y: number } }[])
        .map((b) => `${b.defId}@${b.position.x},${b.position.y}`),
    );
    expect(restored.currentDay).toBe(store.getCurrentDay());
  });

  it('同一 state 连 serialize 两次 ⇒ 序面数组键序与内容全等（序列化层不自带抖动）', () => {
    const store = makeStore(555);
    const ts = new TimeSystem(store);
    for (let i = 0; i < 120; i++) ts.update(D1);
    const a = serialize(store.getState()) as unknown as { state: Record<string, unknown> };
    const b = serialize(store.getState()) as unknown as { state: Record<string, unknown> };
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(Object.keys(a.state)).toEqual(Object.keys(b.state));
  });
});

// ─────────────────────────────────────────────────────────────
// ④ 结算面与对象枚举序无关 ＋ 排序点静态门禁
// ─────────────────────────────────────────────────────────────
describe('ad32 ④ 不依赖对象枚举顺序', () => {
  it('resources 的键以**逆序**插入构造，跑满 60 日终局值与正序构造逐位相同（结算走 RESOURCE_IDS 显式表）', () => {
    const build = (reverseKeys: boolean): GameStore => {
      const ee = new EventEmitter() as unknown as IEventEmitter;
      const store = new GameStore(ee, { rngSeed: 4321, worldMap: allPlainMap() }, {
        policies: [], events: EVENTS, decrees: [],
      });
      const s = store.getState();
      const ids = reverseKeys ? [...RESOURCE_IDS].reverse() : [...RESOURCE_IDS];
      const base: Partial<Record<ResourceId, number>> = {
        people: 60, grain: 1200, wood: 800, stone: 400, gold: 300,
      };
      const reordered: Partial<Record<ResourceId, number>> = {};
      for (const id of ids) if (id in base) reordered[id] = base[id]!;
      store.replaceState({ ...s, resources: reordered, populationClasses: { ...s.populationClasses, farmer: 45, worker: 10, soldier: 3, scholar: 2 } });
      return store;
    };
    const fwd = build(false);
    const rev = build(true);
    expect(Object.keys(fwd.getState().resources)).not.toEqual(Object.keys(rev.getState().resources)); // 枚举序确实相反
    const tsF = new TimeSystem(fwd);
    const tsR = new TimeSystem(rev);
    for (let i = 0; i < 60; i++) { tsF.update(D1); tsR.update(D1); }
    const read = (s: GameStore): string =>
      RESOURCE_IDS.map((id) => `${id}=${s.getState().resources[id] ?? 0}`).join('|');
    expect(read(rev)).toBe(read(fwd));
  });

  it('门禁：state/ 与 data/ 非测试源里的 .sort( 调用点只有 supplyChain 一处（新增排序必须写清 tie-break）', () => {
    const sorters = stateAndDataSources()
      .filter((f) => /\.sort\s*\(/.test(f.src))
      .map((f) => f.rel);
    expect([...new Set(sorters)].sort()).toEqual(['state/supplyChain.ts']);
  });

  it('门禁：Object.keys/entries/values 在 state/＋data/ 的命中文件集钉成现状（新增顺序敏感用法先红）', () => {
    const hits = [...new Set(stateAndDataSources()
      .filter((f) => /Object\.(keys|entries|values)\s*\(/.test(f.src))
      .map((f) => f.rel))].sort();
    // 现状 7 件，逐一都是"顺序无关"用法（求和 / 判空 / 计数 / 建注册表后另配显式序表）；
    // 谁新增第 8 件，本用例即红 ⇒ 逼一次"这个枚举序会不会流进快照或结算"的人工 review。
    expect(hits).toEqual([
      'data/buildingRegistry.ts',
      'data/modifierValidator.ts',
      'state/gameStore.ts',
      'state/megaProjectSystem.ts',
      'state/militarySystem.ts',
      'state/productionSystem.ts',
      'state/saveLoad.ts',
    ]);
  });

  it('前提否证桩：priority 只活在 BadgeRule 上，badgeRules 无运行时消费者 ⇒ "同优先级事件"当前无从谈起', () => {
    const users = [...new Set(listProdSources(RENDERER_ROOT)
      .filter((p) => /\.badgeRules|badgeRules\s*[:?]|priority/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(RENDERER_ROOT, p).replace(/\\/g, '/')))].sort();
    expect(users).toEqual(['data/buildings.ts', 'data/schema.ts']);
  });
});
