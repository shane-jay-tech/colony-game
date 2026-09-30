/**
 * c927-45：事件队列公平性三件套复核续作（bd0f E1/E4 静态面延伸）——**四条策略各 1 例否定用例**
 *
 * 锚点（`zcode-bridge/done/20260925-154205-bd0f.result.md`；卷宗写的 `outbox/` 路径查无、
 * `done/` 取到＝w40-brief §3 说的路径搬家，不判 failed）第 4 条读数原文：
 * 「四条面各有明确策略且实测生效：日相流水线固定 22 相全跑（无饿死）；
 *  TimeSystem 400 tick 上限＋积压丢弃；conversionQueue 严格 FIFO（E4）；事件闸一次只挂一个」。
 *
 * 本件立场：这四条目前**只有"当时实测生效"的一次性读数**，没有桩在拦它们被重构无声移除。
 * 每条补一颗**否定用例**（策略失效时测试必须红），并**逐条验牙**：把被测行为临时改掉 ⇒ 亲眼看到那颗桩红。
 *
 * 验牙两档口径（按可行性分档，如实标注，别混为一谈）：
 *   🔬 **A 档＝真改行为（内存改＋finally 复原；产品码文件零改动）**
 *     - E1：`DAY_PHASE_ORDER` 是 `export const` 的**普通数组**（未 Object.freeze，实测可写）
 *       ⇒ 运行时摘掉一枚相／把相邻两相对调 ⇒ 桩当场红。
 *     - E2：`TimeSystem.MAX_TICKS_PER_UPDATE` 写的是 `private static readonly`，但 `readonly` 只活在编译期，
 *       `update()` 每次**运行时读这个静态属性**（`timeSystem.ts:27`）⇒ 运行时把上限抬掉／压成 0 ⇒ 桩当场红。
 *   🧪 **B 档＝不变式检查器＋反证对照（模块具名导出的绑定换不掉、守卫读的是实例状态）**
 *     - E3：`tickConversionQueue` 是 `populationClassSystem.ts:58` 的具名导出，`runConversionTick` 走
 *       ESM live binding 调它 ⇒ 测试侧无法在内存里换成 LIFO。改判据：把 FIFO 判据抽成**吃 tick 函数为参数**
 *       的检查器 ⇒ 真函数过、LIFO／优先级插队两枚**内存替身**必须被拒。
 *     - E4：单槽闸的守卫读 `this.state.pendingEventId`，"去掉守卫"等价于改产品码 ⇒ 无内存路径。
 *       改判据：①检查器喂"无守卫轨迹"必须拒；②**反证对照**——同一台 store 把槽清空后同一条路径确实会挂
 *       新事件，证明占用期间"0 次 EVENT_TRIGGERED"不是空判（采样本身是活的）。
 *
 * ⚠ 全程只加测试：产品码零改动（`timeSystem.ts`／`dayPipeline.ts`／`gameStore.ts`／`fakeScene.ts` 一件没动）；
 *   内存改动一律 `try/finally` 复原，并在复原后自证与在册常量逐字相同。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { GameState, IEventEmitter } from '../gameStore';
import type { WorldMap } from '../../data/mapSchema';
import type { ConversionOrder } from '../../data/populationClass';
import { CONVERSION_DAYS } from '../../data/populationClass';
import { DAY_PHASE_ORDER, buildDayPipeline, runDayPipeline } from '../dayPipeline';
import type { DayPhaseId } from '../dayPipeline';
import { TimeSystem, SPEED_MS_PER_DAY } from '../timeSystem';
import { tickConversionQueue } from '../populationClassSystem';
import { EVENTS } from '../../data/events';
import type { ConversionTickResult } from '../populationClassSystem';

function makeEmitter(): IEventEmitter {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev)!.add(fn); },
    off(ev, fn) { listeners.get(ev)?.delete(fn); },
    emit(ev, ...args) { listeners.get(ev)?.forEach(fn => fn(...args)); },
    listenerCount(ev) { return listeners.get(ev)?.size ?? 0; },
  };
}

/** 80×80 全平原（与 populationClass.test 同构，够跑真 tickDay 不越界）。 */
function plainMap(): WorldMap {
  const tiles = Array.from({ length: 80 * 80 }, () => ({ terrain: 'plain' as const, buildable: true, walkable: true }));
  return { width: 80, height: 80, tiles, resourceNodes: [], seed: 1 };
}

function newStore(overrides: Partial<GameState> = {}): GameStore {
  return new GameStore(makeEmitter(), { worldMap: plainMap(), ...overrides });
}

/**
 * 带**真事件池**的 store（`main.ts:168-172` 的 content 同构）。
 * 🔴 必读的现场事实：`gameStore.ts:431` 是 `this.baseEvents = content?.events ?? []` ⇒
 *   不传 content 的 store 事件池**只剩 relic 合成事件**，普通朝议根本不存在（锚点 bd0f 的
 *   "82/83 有 defaultTimeoutDays"说的是在册 EVENTS，不是空 content 的替身）。
 *   E4 组因此一律用本工厂，否则测的是"只有古迹链"的退化面。
 */
function newStoreWithEvents(overrides: Partial<GameState> = {}): GameStore {
  return new GameStore(makeEmitter(), { worldMap: plainMap(), ...overrides }, { policies: [], decrees: [], events: EVENTS });
}

// ============================== E1 · 日相流水线固定 22 相全跑 ==============================

/** 在册 22 相顺序表（逐字搬 bd0f 的顺序当对照常量，不读 DAY_PHASE_ORDER 自身）。 */
const CANONICAL_ORDER: readonly DayPhaseId[] = [
  'modifierExpiry', 'seasonTransition', 'construction', 'calendarEvents', 'production',
  'military', 'decrees', 'events', 'diplomacy', 'npcDynamics', 'population', 'conversion',
  'starvation', 'crisis', 'grade', 'factions', 'megaProjects', 'endgame', 'story',
  'breathing', 'historian', 'sentimentSettle',
];

/** id → tickDay 里实际注册的私有方法名（`gameStore.ts:961-984` 的 handler 表）。 */
const PHASE_METHODS: Record<DayPhaseId, string> = {
  modifierExpiry: 'runModifierExpiryPhase',
  seasonTransition: 'runSeasonTransitionPhase',
  construction: 'runConstructionPhase',
  calendarEvents: 'runCalendarEventsPhase',
  production: 'runProductionTick',
  military: 'runMilitaryTick',
  decrees: 'runDecreeTick',
  events: 'runEventTick',
  diplomacy: 'runDiplomacyTick',
  npcDynamics: 'runNpcDynamicsTick',
  population: 'runPopulationTick',
  conversion: 'runConversionTick',
  starvation: 'runStarvationTick',
  crisis: 'runCrisisTick',
  grade: 'runGradeTick',
  factions: 'runFactionTick',
  megaProjects: 'runMegaProjectTick',
  endgame: 'runEndgamePhase',
  story: 'runStoryTick',
  breathing: 'runBreathingTick',
  historian: 'runHistorianTick',
  sentimentSettle: 'runSentimentSettlePhase',
};

/**
 * 不变式检查器（抽成函数＝验牙的把手：真轨迹必须过、变异体必须被拒）。
 * 判"无饿死"三条：无缺项、无重复、执行序列＝顺序表。
 */
function assertNoStarvation(ran: readonly string[], expected: readonly DayPhaseId[]): void {
  const missing = expected.filter(id => !ran.includes(id));
  expect(missing, `饿死没跑的相：${missing.join(', ')}`).toEqual([]);
  const duplicated = ran.filter((id, i) => ran.indexOf(id) !== i);
  expect(duplicated, `重复跑的相：${duplicated.join(', ')}`).toEqual([]);
  expect([...ran], '日相执行序列 ≠ 在册顺序表').toEqual([...expected]);
}

/** 用记录型 handler 跑一遍 builder→runner（不碰 store，纯管道面）。 */
function recordPipelineRun(): string[] {
  const ran: string[] = [];
  const handlers = {} as Record<DayPhaseId, () => void>;
  for (const id of CANONICAL_ORDER) handlers[id] = () => { ran.push(id); };
  runDayPipeline(buildDayPipeline(handlers));
  return ran;
}

describe('E1 日相流水线：固定 22 相全跑（无饿死）', () => {
  it('E1-1 顺序表逐字钉死：22 相、顺序＝在册表（重排/增删必须先过本例）', () => {
    expect([...DAY_PHASE_ORDER]).toEqual([...CANONICAL_ORDER]);
    expect(DAY_PHASE_ORDER.length).toBe(22);
  });

  it('E1-2 管道面：buildDayPipeline＋runDayPipeline 把 22 相各跑恰一次、顺序＝表序', () => {
    assertNoStarvation(recordPipelineRun(), CANONICAL_ORDER);
  });

  it('E1-3 store 面：真 tickDay 逐相调用 22 个 handler（一个不落、顺序＝表序）', () => {
    const store = newStore();
    const calls: string[] = [];
    const host = store as unknown as Record<string, (...args: unknown[]) => void>;
    const spies = CANONICAL_ORDER.map(id =>
      vi.spyOn(host, PHASE_METHODS[id]).mockImplementation(() => { calls.push(id); }),
    );
    try {
      store.tickDay();
      assertNoStarvation(calls, CANONICAL_ORDER);
    } finally {
      for (const s of spies) s.mockRestore();
    }
    // 复原自证：桩拆掉后 22 个 handler 都还是真身（可调用）
    const after = store as unknown as Record<string, unknown>;
    for (const id of CANONICAL_ORDER) expect(typeof after[PHASE_METHODS[id]], id).toBe('function');
  });

  it('E1-4 缺 handler 守卫＝移除即抛（"实现被删但顺序表还留着"的形状当场暴露）', () => {
    const handlers: Record<DayPhaseId, (() => void) | undefined> =
      {} as Record<DayPhaseId, (() => void) | undefined>;
    for (const id of CANONICAL_ORDER) handlers[id] = () => { /* noop */ };
    delete handlers.conversion; // 模拟"conversion 相的实现被删掉，顺序表还留着"
    expect(() => buildDayPipeline(handlers as unknown as Record<DayPhaseId, () => void>))
      .toThrow(/day pipeline missing handlers: conversion/);
  });

  it('E1-5 🔬 验牙（A 档·真改行为）：摘一枚相／对调相邻两相 ⇒ E1-1 与 E1-2 当场红；复原后再绿', () => {
    const live = DAY_PHASE_ORDER as DayPhaseId[]; // 未 freeze，运行时可写（本例就靠这点）
    const backup = [...DAY_PHASE_ORDER];
    try {
      // 变异①：把 'conversion' 整相从顺序表里摘掉（＝重构时漏登记／被无声移除）
      const dropped = live.splice(11, 1);
      expect(dropped).toEqual(['conversion']); // 变异确实落上了（不然验牙是空验）
      expect(() => expect([...DAY_PHASE_ORDER]).toEqual([...CANONICAL_ORDER])).toThrow(); // E1-1 红
      expect(() => assertNoStarvation(recordPipelineRun(), CANONICAL_ORDER)).toThrow();     // E1-2 红
      live.splice(11, 0, ...backup.slice(11, 12));
      expect([...DAY_PHASE_ORDER]).toEqual([...CANONICAL_ORDER]); // 变异①复原自证

      // 变异②：相邻两相对调（＝文件头注释明令禁止的"在调用点就地调换"）
      const t = live[5]!;
      live[5] = live[6]!;
      live[6] = t;
      expect(() => expect([...DAY_PHASE_ORDER]).toEqual([...CANONICAL_ORDER])).toThrow(); // E1-1 红
      expect(() => assertNoStarvation(recordPipelineRun(), CANONICAL_ORDER)).toThrow();   // E1-2 红（序列错位）
    } finally {
      live.splice(0, live.length, ...backup);
    }
    // 复原后再跑：两例都该绿 ⇒ 红来自变异，不是桩自己坏了
    expect([...DAY_PHASE_ORDER]).toEqual([...CANONICAL_ORDER]);
    assertNoStarvation(recordPipelineRun(), CANONICAL_ORDER);
  });
});

// ============================== E2 · TimeSystem 400 tick 上限＋积压丢弃 ==============================

interface TickCounter { ticks: number }

/** 计数假 store：TimeSystem 只用到 isPaused/getSpeed/tickDay 三个方法（`timeSystem.ts:19-29`）。 */
function countingStore(counter: TickCounter): GameStore {
  const stub = {
    isPaused: () => false,
    getSpeed: () => 1 as const,
    tickDay: () => { counter.ticks += 1; },
  };
  return stub as unknown as GameStore;
}

/** 病态单帧：1e9 ms ÷ SPEED_MS_PER_DAY[1] ⇒ 理论 50 万个 tickDay（兜底要把它截成 400）。 */
const PATHOLOGICAL_DELTA_MS = 1_000_000_000;

/** 在册读数的桩：单帧恰 400 tick、积压被丢弃（accumulator 归 0）、下一帧不补账。 */
function assertBacklogCapHolds(): void {
  const counter: TickCounter = { ticks: 0 };
  const ts = new TimeSystem(countingStore(counter));
  ts.update(PATHOLOGICAL_DELTA_MS);
  expect(counter.ticks, '单帧 tick 数 ≠ 在册上限 400').toBe(400);
  expect((ts as unknown as { accumulator: number }).accumulator, '病态积压没被丢弃（accumulator 非 0）').toBe(0);
  // "丢弃"而非"结转"的反证：下一帧只按自己那点 delta 走，不补 1e9 的账
  ts.update(16.7);
  expect(counter.ticks, '积压被结转成下一帧补跑').toBe(400);
}

describe('E2 TimeSystem：400 tick 上限＋病态积压丢弃', () => {
  it('E2-1 上限桩：单帧 1e9 ms ⇒ 恰 400 tick、accumulator 归 0、下一帧不补账', () => {
    assertBacklogCapHolds();
  });

  it('E2-2 常量现值：MAX_TICKS_PER_UPDATE＝400（在册"死亡螺旋兜底"那一档本身）', () => {
    expect((TimeSystem as unknown as { MAX_TICKS_PER_UPDATE: number }).MAX_TICKS_PER_UPDATE).toBe(400);
    expect(SPEED_MS_PER_DAY[1]).toBeGreaterThan(0); // 上限换算基准在世
  });

  it('E2-3 🔬 验牙（A 档·真改行为）：把上限抬掉 ⇒ E2-1 当场红；复原后再绿', () => {
    const cls = TimeSystem as unknown as { MAX_TICKS_PER_UPDATE: number };
    const backup = cls.MAX_TICKS_PER_UPDATE;
    try {
      cls.MAX_TICKS_PER_UPDATE = 1_000_000; // ＝"上限被去掉"的形状（1e9/2000＝50 万 < 100 万 ⇒ 全跑光）
      expect(cls.MAX_TICKS_PER_UPDATE).toBe(1_000_000); // 变异确实落上了（不然验牙是空验）
      expect(() => assertBacklogCapHolds()).toThrow(); // 桩确实红
    } finally {
      cls.MAX_TICKS_PER_UPDATE = backup;
    }
    expect(cls.MAX_TICKS_PER_UPDATE).toBe(400); // 复原自证
    assertBacklogCapHolds();                     // 再绿
  });

  it('E2-4 🔬 验牙（A 档·反向）：上限压成 0 ⇒ 一 tick 都不跑，同样红', () => {
    const cls = TimeSystem as unknown as { MAX_TICKS_PER_UPDATE: number };
    const backup = cls.MAX_TICKS_PER_UPDATE;
    try {
      cls.MAX_TICKS_PER_UPDATE = 0;
      expect(cls.MAX_TICKS_PER_UPDATE).toBe(0); // 变异确实落上了
      expect(() => assertBacklogCapHolds()).toThrow();
    } finally {
      cls.MAX_TICKS_PER_UPDATE = backup;
    }
    assertBacklogCapHolds();
  });

  it('E2-5 上限不是"永远卡 400"：正常帧（阈值倍数）不受它约束，兜底只截病态暴增', () => {
    const counter: TickCounter = { ticks: 0 };
    const ts = new TimeSystem(countingStore(counter));
    ts.update(SPEED_MS_PER_DAY[1] * 3);
    expect(counter.ticks).toBe(3);
  });
});

// ============================== E3 · conversionQueue 严格 FIFO ==============================

function tag(o: ConversionOrder): string { return `${o.from}>${o.to}#${o.count}`; }

/**
 * FIFO 不变式检查器（**吃 tick 函数为参数**＝B 档验牙的把手）。
 * 口径：同日下单的多单，完成批次内顺序＝下单顺序；逐日残留队列必须是原顺序的子序列（不许重排）。
 */
function assertFifoDrain(orders: ConversionOrder[], tick: (q: ConversionOrder[]) => ConversionTickResult): void {
  const expected = orders.map(tag);
  let queue = orders.map(o => ({ ...o }));
  const done: string[] = [];
  for (let day = 0; day < 40 && queue.length > 0; day++) {
    const result = tick(queue);
    done.push(...result.completed.map(tag));
    queue = result.remaining;
    const survivors = expected.filter(t => queue.map(tag).includes(t));
    expect(queue.map(tag), `第 ${day} 日残留队列不是原顺序的子序列`).toEqual(survivors);
  }
  expect(done, '完成顺序不是先下单先完成（FIFO 被打断）').toEqual(expected);
}

/** 三单同日入队、不同 from→to（都不在 CONVERSION_REQUIRES 里 ⇒ 无需前置建筑即可下单）。 */
function threeOrders(): ConversionOrder[] {
  return [
    { from: 'farmer', to: 'scholar', count: 1, daysRemaining: CONVERSION_DAYS },
    { from: 'worker', to: 'soldier', count: 2, daysRemaining: CONVERSION_DAYS },
    { from: 'soldier', to: 'scholar', count: 3, daysRemaining: CONVERSION_DAYS },
  ];
}

describe('E3 conversionQueue：严格 FIFO（先下单先完成，无插队）', () => {
  it('E3-1 store 面：startConversion 入队顺序＝下单顺序、daysRemaining 一律 CONVERSION_DAYS', () => {
    const store = newStore({
      resources: { people: 40, grain: 5000 },
      populationClasses: { farmer: 20, worker: 10, soldier: 8, scholar: 0 },
    });
    for (const o of threeOrders()) {
      expect(store.startConversion(o.from, o.to, o.count), tag(o)).toBe(true);
    }
    expect(store.getConversionQueue().map(tag)).toEqual(threeOrders().map(tag));
    expect(store.getConversionQueue().every(q => q.daysRemaining === CONVERSION_DAYS)).toBe(true);
  });

  it('E3-2 真 tick 面：逐日排空，完成批次内顺序＝下单顺序（FIFO 桩）', () => {
    assertFifoDrain(threeOrders(), tickConversionQueue);
  });

  it('E3-3 混合期限面：早到期的先完成、同批内仍按下单顺序（FIFO 不是"最后入队先完成"）', () => {
    const mixed: ConversionOrder[] = [
      { from: 'farmer', to: 'scholar', count: 1, daysRemaining: CONVERSION_DAYS },
      { from: 'worker', to: 'soldier', count: 2, daysRemaining: 2 },
      { from: 'soldier', to: 'scholar', count: 3, daysRemaining: CONVERSION_DAYS },
    ];
    let queue = mixed;
    const done: string[] = [];
    for (let day = 0; day < 8 && queue.length > 0; day++) {
      const r = tickConversionQueue(queue);
      done.push(...r.completed.map(tag));
      queue = r.remaining;
    }
    expect(done).toEqual(['worker>soldier#2', 'farmer>scholar#1', 'soldier>scholar#3']);
    // 同批完成的第 1、3 单相对顺序＝下单顺序（farmer>scholar 在 soldier>scholar 之前）
    expect(done.indexOf('farmer>scholar#1')).toBeLessThan(done.indexOf('soldier>scholar#3'));
  });

  it('E3-4 队列项不可撤（在册"下单只能等 4 日"那半条，按**转化队列**口径）', () => {
    const store = newStore({
      resources: { people: 40, grain: 5000 },
      populationClasses: { farmer: 20, worker: 10, soldier: 8, scholar: 0 },
    });
    expect(store.startConversion('farmer', 'scholar', 2)).toBe(true);
    const names = [
      ...Object.keys(store as unknown as Record<string, unknown>),
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(store) as object),
    ];
    const unique = [...new Set(names)];
    // ① 转化面上只有"下单/读队列/日相节拍"三个口，没有任何撤单口
    expect(unique.filter(k => /conversion/i.test(k)).sort())
      .toEqual(['getConversionQueue', 'runConversionTick', 'startConversion']);
    // ② 🔴 否证锚点原文：bd0f 写「GameStore 上含 cancel|abort|remove|… 的公开方法 = 0 个」，
    //    现值**不是 0**——store 上有 removeBuilding／removeModifier 两枚。它们与本策略无关，
    //    故本例把口径收窄到"转化队列"，并把这条否证登记在 result。
    expect(unique.filter(k => /^remove/i.test(k)).sort()).toEqual(['removeBuilding', 'removeModifier']);
    // ③ 行为旁证：这两枚 remove* 碰不到队列（队列项只能等 daysRemaining 归零自己出队）
    const host = store as unknown as { removeBuilding: (x: number, y: number) => unknown; removeModifier: (id: string) => unknown };
    expect(() => host.removeBuilding(0, 0)).not.toThrow();
    expect(() => host.removeModifier('mod_not_there')).not.toThrow();
    expect(store.getConversionQueue()).toHaveLength(1);
  });

  it('E3-5 🧪 验牙（B 档·内存替身）：LIFO 与"按数量优先级插队"两枚变异体必须被检查器拒掉', () => {
    const orders = threeOrders();
    // 替身①：LIFO——完成批次倒过来产出
    const lifo: (q: ConversionOrder[]) => ConversionTickResult = (q) => {
      const r = tickConversionQueue(q);
      return { completed: [...r.completed].reverse(), remaining: r.remaining };
    };
    // 替身②：优先级插队——大单排前面（＝"高优先级任务长期占用、低优先级没机会"那种重构）
    const priorityJump: (q: ConversionOrder[]) => ConversionTickResult = (q) =>
      tickConversionQueue([...q].sort((a, b) => b.count - a.count));
    expect(() => assertFifoDrain(orders, lifo)).toThrow();
    expect(() => assertFifoDrain(orders, priorityJump)).toThrow();
    assertFifoDrain(orders, tickConversionQueue); // 真函数仍过 ⇒ 红来自变异，不是检查器坏了
  });

  it('E3-6 完成即出队且人口到账（FIFO 的下游形状：4 日整批完成）', () => {
    const store = newStore({
      resources: { people: 40, grain: 5000 },
      populationClasses: { farmer: 20, worker: 10, soldier: 8, scholar: 0 },
    });
    for (const o of threeOrders()) expect(store.startConversion(o.from, o.to, o.count)).toBe(true);
    const scholarBefore = store.getPopulationClasses().scholar;
    for (let d = 0; d < CONVERSION_DAYS; d++) store.tickDay();
    expect(store.getConversionQueue()).toHaveLength(0);
    expect(store.getPopulationClasses().scholar).toBe(scholarBefore + 1 + 3); // 第 1、3 单都进 scholar
  });
});

// ============================== E4 · 事件闸"一次只挂一个" ==============================

/** 触达私有面：runEventTick／resolveEvent／state 的挂起四键（本件只读＋造状态）。 */
interface StoreInternals {
  state: Pick<GameState, 'pendingEventId' | 'pendingEventDayStart' | 'currentDay' | 'lastEventDay'>;
  emitter: IEventEmitter;
  runEventTick: () => void;
  resolveEvent: (choiceIdx: number) => void;
}

/**
 * 沿真实采样路径把事件挂上：逐日推进 currentDay 后调 runEventTick。
 * ⚠ 必须推日数——`daysSinceLast` 不足防连击窗口时 `runEventTick` 直接 return（gameStore.ts:1183）。
 */
function driveUntilPending(store: GameStore, maxDays: number = 900): string | null {
  const host = store as unknown as StoreInternals;
  for (let d = 0; d < maxDays && store.getPendingEventId() === null; d++) {
    host.state.currentDay += 1;
    host.runEventTick();
  }
  return store.getPendingEventId();
}

/**
 * 单槽不变式检查器（B 档验牙的把手）：槽非空期间不得被另一个 id 覆盖。
 */
function assertSingleSlotTrace(pendings: readonly (string | null)[]): void {
  for (let i = 1; i < pendings.length; i++) {
    const prev = pendings[i - 1];
    const cur = pendings[i];
    if (prev !== null && cur !== null) {
      expect(cur, `第 ${i} 步挂起事件被换成 ${cur}（＝一次挂了不止一个）`).toBe(prev);
    }
  }
}

describe('E4 事件闸：一次只挂一个（占用即不采样）', () => {
  it('E4-1 占用期间：连调 200 次 runEventTick，槽里那个 id 纹丝不动、EVENT_TRIGGERED 零发射', () => {
    const store = newStoreWithEvents();
    const host = store as unknown as StoreInternals;
    const hooked = driveUntilPending(store);
    expect(typeof hooked, '真实采样路径 900 日都没挂上事件，本桩失去被测对象').toBe('string');
    // ⚠ 计数探针必须**挂上之后**再接：挂起那一步自身就发一条 EVENT_TRIGGERED（接早了必数到 1）
    let triggered = 0;
    const probe = (): void => { triggered += 1; };
    host.emitter.on(STATE_EVENTS.EVENT_TRIGGERED, probe);
    try {
      const dayAtHook = store.getPendingEventDayStart();
      const trace: (string | null)[] = [];
      for (let i = 0; i < 200; i++) {
        host.runEventTick();
        trace.push(store.getPendingEventId());
      }
      expect(store.getPendingEventId()).toBe(hooked);
      expect(triggered, '占用期间还在采样新事件＝单槽闸没了').toBe(0);
      expect(store.getPendingEventDayStart()).toBe(dayAtHook); // 挂起起始日也没被重置
      assertSingleSlotTrace(trace);                            // 200 步轨迹无覆盖
    } finally {
      host.emitter.off(STATE_EVENTS.EVENT_TRIGGERED, probe);
    }
  });

  it('E4-2 反证对照（证明 E4-1 的"零发射"不是空判）：槽清空后同一条路径确实会再挂', () => {
    const store = newStoreWithEvents();
    const host = store as unknown as StoreInternals;
    const first = driveUntilPending(store);
    expect(typeof first).toBe('string');
    host.state.pendingEventId = null;                           // 清空槽（＝玩家处理完）
    host.state.lastEventDay = host.state.currentDay - 999;       // 抹掉冷却，走"允许采样"一侧
    let triggered = 0;
    const probe = (): void => { triggered += 1; };
    host.emitter.on(STATE_EVENTS.EVENT_TRIGGERED, probe);
    try {
      const dayAtClear = host.state.currentDay;
      const second = driveUntilPending(store);
      expect(typeof second, '清空后仍挂不上＝采样本身是死的，E4-1 的零发射没有证明力').toBe('string');
      expect(triggered, '清空槽后没有重新采样＝采样链其实是死的').toBeGreaterThan(0);
      expect(store.getPendingEventDayStart() ?? -1).toBeGreaterThan(dayAtClear);
      // 本例只证"采样链是活的"：重新挂上＋重新发事件＋挂起日刷新。
      // 不断 id 异同——同一条事件被重挂是合法行为（history 只在 resolveEvent 里写）。
      void second;
    } finally {
      host.emitter.off(STATE_EVENTS.EVENT_TRIGGERED, probe);
    }
  });

  it('E4-3 承载体形状：pending 侧只有单值两键（出现 pendingEventIds 数组＝策略被换，本例红）', () => {
    const keys = Object.keys((newStoreWithEvents() as unknown as StoreInternals).state)
      .filter(k => /pending/i.test(k))
      .sort();
    expect(keys).toEqual(['pendingEventDayStart', 'pendingEventId']);
  });

  it('E4-4 超时回退选 choices[0]（在册第四条的组成部分：真调 resolveEvent 抓到的参数是 0）', () => {
    const store = newStoreWithEvents();
    const host = store as unknown as StoreInternals;
    // 超时面直接从在册 EVENTS 里取一条**带 defaultTimeoutDays** 的事件造挂起态，
    // 让本例只判超时分支、不受采样运气左右（只造 state，产品码一行没动）。
    // ⚠ 另注：relic 合成事件确实**无** defaultTimeoutDays（bd0f 遗留①"relic 型无超时出口"），
    //   本例的取法天然避开了那一类，不改变那条在册结论。
    const timed = store.getEvents().find(e => e.defaultTimeoutDays !== undefined);
    expect(timed, '事件池里没有任何带 defaultTimeoutDays 的事件，超时面失去被测对象').toBeDefined();
    const timeout = timed!.defaultTimeoutDays!;
    const start = host.state.currentDay;
    host.state.pendingEventId = timed!.id;
    host.state.pendingEventDayStart = start;
    const spy = vi.spyOn(host, 'resolveEvent').mockImplementation(() => { /* 只抓参数，不真结算 */ });
    try {
      // 未满期：不该回退（否则"超时"阈值本身没被钉住）
      host.state.currentDay = start + timeout - 1;
      host.runEventTick();
      expect(spy).toHaveBeenCalledTimes(0);
      // 满期：回退且选 choices[0]
      host.state.currentDay = start + timeout;
      host.runEventTick();
      expect(spy, `挂起满 ${timeout} 日没走超时回退`).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0], '超时回退选的不是 choices[0]').toBe(0);
    } finally {
      spy.mockRestore();
    }
  });

  it('E4-5 🧪 验牙（B 档·内存变异轨迹）：无守卫轨迹（占用期间被第二个 id 覆盖）必须被拒', () => {
    const guarded: (string | null)[] = ['evt_a', 'evt_a', 'evt_a', null, 'evt_b', 'evt_b'];
    expect(() => assertSingleSlotTrace(guarded)).not.toThrow();
    // 变异体：守卫摘掉后占用期间第二个请求直接盖上来（前一个无声丢失）
    const unguarded: (string | null)[] = ['evt_a', 'evt_b', 'evt_a', null];
    expect(() => assertSingleSlotTrace(unguarded)).toThrow();
  });

  it('E4-6 🧪 验牙（B 档·真路径红证）：手工改写挂起槽＝闸失效的形状，E4-1 的判据当场不成立', () => {
    const store = newStoreWithEvents();
    const host = store as unknown as StoreInternals;
    const hooked = driveUntilPending(store);
    expect(typeof hooked).toBe('string');
    // 模拟"守卫没了"：占用期间槽被别的事件盖掉（测试侧造，产品码不动）
    const overwritten: (string | null)[] = [store.getPendingEventId(), `${hooked}_second`];
    expect(() => assertSingleSlotTrace(overwritten)).toThrow();   // 检查器认得出这种轨迹
    host.state.pendingEventId = `${hooked}_second`;               // 真把槽改了
    expect(store.getPendingEventId()).not.toBe(hooked);           // 承载体层面确实守不住＝红
    host.state.pendingEventId = hooked;                            // 复原
    expect(store.getPendingEventId()).toBe(hooked);
  });
});

afterEach(() => {
  // 兜底：本件所有 vi.spyOn 都在各自 try/finally 里复原；这里再清一遍，防跨文件泄漏
  vi.restoreAllMocks();
});


// ─── c930-25 公平性相邻面：conversion 入队门槛＋runEventTick story/relic 分支 ───
describe('c930-25 conversionQueue 入队门槛', () => {
  function freshStore(): GameStore {
    return new GameStore(makeEmitter(), { worldMap: plainMap() }, { policies: [], decrees: [] });
  }
  function seedBuilding(s: GameStore, status: string): void {
    (s as unknown as { state: { buildings: Array<Record<string, unknown>> } }).state.buildings.push({
      defId: 'bld_academy', position: { x: 3, y: 3 }, status, tier: 1, constructionProgress: 100, modifiers: [],
    });
  }

  it('非 working 建筑拒入队（CONVERSION_REQUIRES 需 working；queue 不动）', () => {
    const s = freshStore();
    seedBuilding(s, 'constructing');
    expect(s.startConversion('farmer', 'worker', 1)).toBe(false);
    expect(s.getConversionQueue().length).toBe(0);
  });

  it('无闲劳力拒入队（canAffordClass：farmer idle=0 < count）', () => {
    const s = freshStore();
    seedBuilding(s, 'working');
    (s as unknown as { state: { populationClasses: Record<string, number> } }).state.populationClasses.farmer = 0;
    expect(s.startConversion('farmer', 'worker', 1)).toBe(false);
    expect(s.getConversionQueue().length).toBe(0);
  });
});

describe('c930-25 runEventTick story/relic 分支', () => {
  const storyEvt = {
    id: 'story_c93025_1', tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 1' }],
    contexts: [{ condition: 'default', title: 't', desc: 'd', descPlain: 'p' }],
    choices: [{ text: 'a', textPlain: 'a', effects: [], removeEffects: [] }],
  };
  const normalEvt = {
    id: 'evt_c93025_normal', tags: ['正'],
    triggers: [{ condition: 'random', value: 0 }], // 永不通过 ⇒ 采样池空 ⇒ relic 兜底
    contexts: [{ condition: 'default', title: 't', desc: 'd', descPlain: 'p' }],
    choices: [{ text: 'a', textPlain: 'a', effects: [], removeEffects: [] }],
  };
  function forceWindow(s: GameStore): void {
    (s as unknown as { state: { currentDay: number } }).state.currentDay = 60;
    (s as unknown as { state: { lastEventDay: number } }).state.lastEventDay = 0;
  }

  it('story 分支：chapter≥1 且未触发完 ⇒ 剧情事件越过 25-50 节奏无挂起即触发', () => {
    const s = new GameStore(makeEmitter(), { worldMap: plainMap() }, { events: [storyEvt] } as never);
    forceWindow(s);
    (s as unknown as { state: { storyFlags: unknown } }).state.storyFlags = { chapter: 1, ending: null, storyEventsTriggered: [] };
    (s as unknown as { runEventTick(): void }).runEventTick();
    expect((s as unknown as { state: { pendingEventId: string | null } }).state.pendingEventId).toBe('story_c93025_1');
  });

  it('relic 兜底：采样池穷尽（唯一候选永不通过）⇒ 挂 relic_{id}_s{stage}', () => {
    const s = new GameStore(makeEmitter(), { worldMap: plainMap() }, { events: [normalEvt] } as never);
    forceWindow(s);
    (s as unknown as { runEventTick(): void }).runEventTick();
    const pid = (s as unknown as { state: { pendingEventId: string | null } }).state.pendingEventId;
    expect(pid).toBeTruthy();
    expect(pid!.startsWith('relic_')).toBe(true);
  });
});
