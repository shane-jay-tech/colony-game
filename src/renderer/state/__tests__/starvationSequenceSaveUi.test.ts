/**
 * c925-db58：缺粮四态序列回归 —— 食物为零 / 连续饥饿 / 恢复供给 / 死亡事件顺序。
 *
 * 判据（卷宗「验收」两行拆成可执行命题）：
 *   E1 状态转换**无重复扣减**（口粮每日恰好扣一次；减员既进 populationClasses 也只扣 people 一次）；
 *   E2 **UI 与存档结果一致**（存档往返后饥饿计数与人口逐位不变，读档不重跑扣减；
 *      且史官 UI 看到的"缺粮天数"就是存档里那个字段，不是另一个运行时计数器）。
 *
 * 常量现取（勿抄旧档）：CLASS_CONSUMPTION.farmer.grain=0.8、baseHousingCap(default)=45
 * ⇒ 本档统一用 **pop=45 农（恰在住房上限，不增不减）**，日口粮 = 0.8×45 = 36。
 * 用 45 而非 50 是一手实测纠正：pop>上限时 runPopulationTick 每日回落人口，
 * 会把"每日恰好扣一次"的精确算术读成 -39.2/-296（那是住房回落，不是重复扣减）。
 * DEFAULT_STARVATION={graceDays:5, mildRate:.02, severeThresholdDays:15, severeRate:.05,
 * moralePenaltyPerDay:3, minimumPopulation:5}。
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter, type GameState } from '../gameStore';
import { serialize, deserialize } from '../saveLoad';
import { computeClassConsumption } from '../populationClassSystem';
import { CLASS_CONSUMPTION, DEFAULT_STARVATION, totalPopulation } from '../../data/populationClass';
import type { PopulationClasses } from '../../data/populationClass';
import type { ResourceId } from '../../data/resourceRegistry';

const POP: PopulationClasses = { farmer: 45, worker: 0, soldier: 0, scholar: 0 }; // = baseHousingCap，人口稳态

function makeStore(overrides: Partial<GameState> = {}): { store: GameStore; ee: EventEmitter } {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, {
    populationClasses: { ...POP },
    resources: { grain: 0, gold: 500, people: 45 },
    buildings: [],
    playerMorale: 80,
    ...overrides,
  });
  return { store, ee: ee as unknown as EventEmitter };
}

type DeltaPayload = { deltas: Partial<Record<ResourceId, number>>; reason?: string };

/** 收集一次操作内的资源变动载荷（临时挂 listener，用完必摘，防跨用例串计数）。 */
function collectDeltas(store: GameStore, fn: () => void): DeltaPayload[] {
  const hits: DeltaPayload[] = [];
  const listener = (p: DeltaPayload) => { hits.push(p); };
  store.on(STATE_EVENTS.RESOURCES_CHANGED, listener);
  try {
    fn();
  } finally {
    store.off(STATE_EVENTS.RESOURCES_CHANGED, listener);
  }
  return hits;
}

const consumptionEvents = (hits: DeltaPayload[]) => hits.filter(h => h.reason === 'consumption');
const grainOf = (store: GameStore) => store.getResources().grain ?? 0;
const negDays = (store: GameStore) => store.getState().grainNegativeDays;
const popTotal = (store: GameStore) => totalPopulation(store.getState().populationClasses);

// ================= 1. 食物为零：扣到 0 即止，且每日只扣一次 =================

describe('食物为零 · 钳制与单次日扣减', () => {
  it('前置自证：45 农日口粮 = 36（0.8×45，恰为整数便于断言）', () => {
    const c = computeClassConsumption(POP);
    expect(c.totalGrain).toBeCloseTo(45 * CLASS_CONSUMPTION.farmer.grain, 10);
    expect(c.totalGrain).toBe(36);
  });

  it('存粮 5 < 日耗 36 ⇒ 钳到 0 为止，不出现负粮或非有限值', () => {
    const { store } = makeStore({ resources: { grain: 5, gold: 500, people: 45 } });
    store.tickDay();
    expect(grainOf(store)).toBe(0);
    expect(Number.isFinite(grainOf(store))).toBe(true);
  });

  it('🔴 E1 口粮每日恰好扣一次：单日 consumption 事件里 grain 只出现 1 次', () => {
    const { store } = makeStore({ resources: { grain: 100, gold: 500, people: 45 } });
    const cons = consumptionEvents(collectDeltas(store, () => store.tickDay()));
    expect(cons.length).toBe(1);
    expect(cons[0]!.deltas.grain).toBe(-36);
  });

  it('🔴 E1 连跑 8 日：grain 侧扣减合计 = 8×36（无某日双扣、无累加器漂移）', () => {
    const { store } = makeStore({ resources: { grain: 1000, gold: 500, people: 45 } });
    let sum = 0;
    for (let d = 0; d < 8; d++) {
      for (const h of consumptionEvents(collectDeltas(store, () => store.tickDay()))) {
        if (h.deltas.grain !== undefined) sum += h.deltas.grain;
      }
    }
    expect(sum).toBe(-288);
    expect(negDays(store)).toBe(0); // 粮够 ⇒ 饥饿计数不启动
  });
});

// ================= 2. 连续饥饿：宽限期与两档减员阈值 =================

describe('连续饥饿 · 计数器与阈值', () => {
  it('缺粮逐日 +1，宽限期（graceDays=5）之内零减员', () => {
    const { store } = makeStore();
    for (let d = 1; d < DEFAULT_STARVATION.graceDays; d++) {
      store.tickDay();
      expect(negDays(store)).toBe(d);
      expect(popTotal(store)).toBe(45);
    }
  });

  it('越过宽限期当日开始减员，且 people 与 populationClasses 扣减量相等（无双扣）', () => {
    const { store } = makeStore();
    for (let d = 0; d < DEFAULT_STARVATION.graceDays; d++) store.tickDay();
    expect(negDays(store)).toBe(5);
    const popBefore = popTotal(store);
    const peopleBefore = store.getResources().people ?? 0;
    store.tickDay();
    expect(popBefore - popTotal(store)).toBeGreaterThan(0);
    expect(peopleBefore - (store.getResources().people ?? 0)).toBe(popBefore - popTotal(store));
    expect(negDays(store)).toBe(6);
  });

  it('严重档（≥15 日）日损耗不低于温和档，且不破 minimumPopulation', () => {
    // 口径纠正（本班实测）：pop 净值 = 增长 − 死亡，而 planPopulationGrowth 的基准净增
    // 即使在 grain=0 时也是 +2/日（余粮只给倍率，不做"无粮即停长"闸），
    // 故**不能用 pop 净变化量饥饿力度**（温和档死 1、净增 2 ⇒ 读成 −1）。此处直接取
    // reason='starvation' 的 people 扣减量＝真实死亡数。
    const { store } = makeStore();
    const deaths: number[] = [];
    for (let d = 0; d < 18; d++) {
      let lost = 0;
      for (const h of collectDeltas(store, () => store.tickDay())) {
        if (h.reason === 'starvation') lost -= h.deltas.people ?? 0;
      }
      deaths.push(lost);
    }
    expect(negDays(store)).toBe(18);
    expect(deaths.slice(0, 4)).toEqual([0, 0, 0, 0]);   // 宽限期（graceDays=5 之前）零死亡
    expect(deaths[4]).toBeGreaterThanOrEqual(1);        // 第 5 日起温和档 2%（45×.02=0.9→至少 1）
    const mild = deaths[4] as number;                   // 第 5 日温和档
    const severe = deaths[deaths.length - 1] as number; // 第 18 日严重档 5%
    expect(severe).toBeGreaterThanOrEqual(mild);
    expect(deaths.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    expect(popTotal(store)).toBeGreaterThanOrEqual(DEFAULT_STARVATION.minimumPopulation);
  });

  it('减员下界：持续饥饿只减到 minimumPopulation，各阶层恒非负有限', () => {
    const { store } = makeStore({
      populationClasses: { farmer: 8, worker: 0, soldier: 0, scholar: 0 },
      resources: { grain: 0, gold: 500, people: 8 },
    });
    for (let d = 0; d < 20; d++) store.tickDay();
    expect(popTotal(store)).toBeGreaterThanOrEqual(DEFAULT_STARVATION.minimumPopulation);
    for (const v of Object.values(store.getState().populationClasses)) {
      expect(Number.isFinite(v as number)).toBe(true);
      expect(v as number).toBeGreaterThanOrEqual(0);
    }
  });
});

// ================= 3. 恢复供给：计数归零与"重新起计" =================

describe('恢复供给 · 饥饿中断必须归零而不是继续累加', () => {
  it('补粮当日计数即归 0，此后不再减员', () => {
    const { store } = makeStore();
    for (let d = 0; d < 3; d++) store.tickDay();
    expect(negDays(store)).toBe(3);
    store.addResource('grain', 5000);
    store.tickDay();
    expect(negDays(store)).toBe(0);
    const pop = popTotal(store);
    for (let d = 0; d < 10; d++) store.tickDay();
    expect(negDays(store)).toBe(0);
    expect(popTotal(store)).toBeGreaterThanOrEqual(pop);
  });

  it('再次断粮 ⇒ 从 1 重新起计（不得沿用旧计数提前饿死人）', () => {
    const { store } = makeStore();
    for (let d = 0; d < 4; d++) store.tickDay(); // 4 天缺粮（仍在宽限期）
    store.addResource('grain', 5000);
    store.tickDay();                              // 恢复 ⇒ 归零
    expect(negDays(store)).toBe(0);
    store.addResource('grain', -99999);           // 再次断供（addResource 自带 clamp≥0）
    expect(grainOf(store)).toBe(0);
    for (let d = 1; d <= 4; d++) {
      store.tickDay();
      expect(negDays(store)).toBe(d);
      expect(popTotal(store)).toBe(45); // 宽限期内不应减员
    }
  });
});

// ================ 4. 死亡事件顺序：阶层次序 + 士气/怨愤各只推一次 ================

describe('死亡事件顺序', () => {
  it('阶层消耗次序 farmer→worker→soldier→scholar：先死农，士最后才动', () => {
    const { store } = makeStore({
      populationClasses: { farmer: 25, worker: 10, soldier: 5, scholar: 5 },
      resources: { grain: 0, gold: 500, people: 45 },
    });
    for (let d = 0; d < 6; d++) store.tickDay(); // 越过宽限期，触发温和档
    const pop = store.getState().populationClasses;
    expect(pop.farmer).toBeLessThan(25);
    expect(pop.worker).toBeLessThanOrEqual(10);
    expect(pop.soldier).toBe(5);     // 一轮温和档（1 人）打不到兵
    expect(pop.scholar).toBe(5);     // 更打不到士
  });

  it('🔴 E1 严重档下士气/怨愤每日各只被饥饿推动一次（不双发）', () => {
    const { store, ee } = makeStore();
    for (let d = 0; d < 15; d++) store.tickDay(); // 进严重档才有 moralePenaltyPerDay
    const moraleSpy = vi.fn();
    const wrathSpy = vi.fn();
    ee.on(STATE_EVENTS.MORALE_CHANGED, moraleSpy);
    ee.on(STATE_EVENTS.WRATH_CHANGED, wrathSpy);
    store.tickDay();
    const byStarvation = (spy: ReturnType<typeof vi.fn>) =>
      spy.mock.calls.filter(c => (c[0] as { reason?: string }).reason === 'starvation');
    expect(byStarvation(moraleSpy).length).toBe(1);
    expect(byStarvation(wrathSpy).length).toBe(1);
    // UI 事件载荷里的值必须等于改后的明文状态（E2 的"UI 即状态"最小面）
    expect((moraleSpy.mock.calls.find(c => (c[0] as { reason?: string }).reason === 'starvation')![0] as { value: number }).value)
      .toBe(store.getState().playerMorale);
  });

  it('减员与自然增长互斥：饥饿日 people 侧不得同时出现正增量（两路各写＝双加/双扣）', () => {
    const { store } = makeStore();
    for (let d = 0; d < 6; d++) store.tickDay();
    const peopleDeltas = collectDeltas(store, () => store.tickDay())
      .flatMap(h => Object.entries(h.deltas))
      .filter(([k, v]) => k === 'people' && typeof v === 'number');
    expect(peopleDeltas.length).toBeGreaterThanOrEqual(1);
    for (const [, v] of peopleDeltas) expect(v as number).toBeLessThanOrEqual(0);
  });
});

// ========= 5. 🔴 E2 UI 与存档一致：饥饿计数的唯一事实源必须是存档字段 =========

describe('UI 与存档一致 · 史官（HUD 侧提示）读的必须是存档里的饥饿计数', () => {
  it('存档往返：饥饿计数 / 存粮 / 人口 / 民心逐位不变，且读档不产生任何扣减', () => {
    const { store } = makeStore();
    for (let d = 0; d < 7; d++) store.tickDay();
    const snap = store.getState();
    const before = {
      days: negDays(store), grain: grainOf(store),
      pop: JSON.stringify(snap.populationClasses), morale: snap.playerMorale,
    };
    const restored = deserialize(serialize(snap)) as GameState;
    const { store: loader } = makeStore();
    expect(collectDeltas(loader, () => loader.replaceState(restored)).length)
      .toBe(0); // replaceState 只换状态，不得重跑日结算
    expect(negDays(loader)).toBe(before.days);
    expect(grainOf(loader)).toBe(before.grain);
    expect(JSON.stringify(loader.getState().populationClasses)).toBe(before.pop);
    expect(loader.getState().playerMorale).toBe(before.morale);
    loader.tickDay();
    expect(negDays(loader)).toBe(before.days + 1); // 从存档值接着走，不重置为 0
  });

  it('🔴 连续饥饿 ≥3 日 ⇒ 史官必须提示"粮已见底"（hist_02_grain_low）', () => {
    const { store, ee } = makeStore();
    const advice: string[] = [];
    ee.on(STATE_EVENTS.HISTORIAN_ADVICE, (p: { advice?: { id?: string } }) => {
      if (p?.advice?.id) advice.push(p.advice.id);
    });
    for (let d = 0; d < 5; d++) store.tickDay();
    expect(negDays(store)).toBe(5);
    expect(advice).toContain('hist_02_grain_low');
  });

  it('🔴 读入"已饥饿 7 日"的存档 ⇒ 史官当日就按 7 日提示，而不是从 0 重新数', () => {
    const { store } = makeStore();
    for (let d = 0; d < 7; d++) store.tickDay();
    const restored = deserialize(serialize(store.getState())) as GameState;
    expect(restored.grainNegativeDays).toBe(7);
    restored.seenJitHints = []; // 模拟新会话首次读档：没有任何"已提示过"记录
    const { store: fresh, ee } = makeStore();
    fresh.replaceState(restored);
    expect(negDays(fresh)).toBe(7);
    const advice: string[] = [];
    ee.on(STATE_EVENTS.HISTORIAN_ADVICE, (p: { advice?: { id?: string } }) => {
      if (p?.advice?.id) advice.push(p.advice.id);
    });
    fresh.tickDay();
    expect(advice).toContain('hist_02_grain_low');
  });

  it('提示只打扰一次：seenJitHints 持久化后，读档不得再重播同一条', () => {
    const { store } = makeStore();
    for (let d = 0; d < 5; d++) store.tickDay();
    expect(store.getState().seenJitHints).toContain('hist_02_grain_low');
    const restored = deserialize(serialize(store.getState())) as GameState;
    const { store: fresh, ee } = makeStore();
    fresh.replaceState(restored);
    const advice: string[] = [];
    ee.on(STATE_EVENTS.HISTORIAN_ADVICE, (p: { advice?: { id?: string } }) => {
      if (p?.advice?.id) advice.push(p.advice.id);
    });
    fresh.tickDay();
    expect(advice).not.toContain('hist_02_grain_low');
  });
});
