/**
 * 域二：人口/社会域逻辑（gameStore 拆分批 2/5 · c1023-02 外迁件）。
 *
 * 拆分约束（done/c1011-13 存档兼容面）：「拆逻辑不拆 GameState 容器；字段全集零增删改」——
 * 本模块只收人口/劳动/转化/增长/饥荒的**计算件**；副作用（addResource / adjustMorale /
 * adjustWrath 的事件发射）经 GameStore 注入回调保留在原位，调用次序与公式逐字保持。
 * 纯结构重构授权：零数值行为变更（住房/增长/消耗/饥荒常量全部经既有数据面读取，本模块不含新数值）。
 */
import type { ResourceId } from '../../data/resourceRegistry';
import type { BuildingDef, BuildingInstance, ModifierInstance } from '../../data/schema';
import type { PopulationClasses, PopulationClass } from '../../data/populationClass';
import { totalPopulation, CONVERSION_DAYS, CONVERSION_REQUIRES, POPULATION_CLASSES, DEFAULT_STARVATION } from '../../data/populationClass';
import { computeClassOccupation, canAffordClass, applyStarvation, computeClassConsumption, type ClassOccupation } from '../populationClassSystem';
import { computePopulationGrowth, sumHousingCapacity } from '../population';
import { getBalanceConfig } from '../../data/balanceConfig';
import { applyModifiers } from '../modifierAggregator';
import { populationFulfillment, computeClassNeedState } from '../classNeeds';
import { getBuildingDef } from '../../data/buildingRegistry';

/** 当前住房上限 = 基数 + working 建筑 housingCapacity，经 country_population_cap modifier 聚合（原 getHousingCap 主体）。 */
export function housingCapFor(
  mode: 'sandbox' | 'story',
  buildings: readonly BuildingInstance[],
  activeModifiers: readonly ModifierInstance[],
): number {
  const popCfg = getBalanceConfig(mode).population;
  const base = popCfg.baseHousingCap + sumHousingCapacity(buildings, getBuildingDef);
  return Math.round(applyModifiers(base, 'country_population_cap', activeModifiers));
}

/** 在役建筑(constructing+working)占用的劳力总和 = Σ def.cost.people（原 getEmployedLabor 主体）。 */
export function employedLaborOf(buildings: readonly BuildingInstance[]): number {
  let total = 0;
  for (const b of buildings) {
    if (b.status !== 'constructing' && b.status !== 'working') continue;
    total += getBuildingDef(b.defId)?.cost.people ?? 0;
  }
  return total;
}

/** 闲置劳力 = 总人口 − 已占用，clamp≥0（原 getIdleLabor 内联式）。 */
export function idleLaborOf(people: number, employed: number): number {
  return Math.max(0, people - employed);
}

/**
 * 自动招募：将闲置人口从其他阶层转入目标阶层，优先从农民抽调（原 autoRecruitToClass 主体，逐字搬运）。
 * 直接改写传入的 populationClasses（调用方传 state 内对象，与原 this.state 直写同址）。
 */
export function recruitToClasses(
  populationClasses: PopulationClasses,
  occ: ClassOccupation,
  targetCls: PopulationClass,
  needed: number,
): void {
  if (needed <= 0) return;
  const alreadyIdle = Math.max(0, populationClasses[targetCls] - occ[targetCls]);
  let deficit = needed - alreadyIdle;
  if (deficit <= 0) return;
  const sourceOrder: PopulationClass[] = (['farmer', 'worker', 'soldier', 'scholar'] as const)
    .filter(c => c !== targetCls) as unknown as PopulationClass[];
  for (const src of sourceOrder) {
    if (deficit <= 0) break;
    const srcIdle = Math.max(0, populationClasses[src] - occ[src]);
    const transfer = Math.min(deficit, srcIdle);
    if (transfer > 0) {
      populationClasses[src] -= transfer;
      populationClasses[targetCls] += transfer;
      deficit -= transfer;
    }
  }
}

/**
 * BUG-A 负增长唯一出口——从农→工→兵→士级联扣减、不扣穿 0（原 shrinkPopulationClasses 主体）。
 * 与 applyStarvation 的 STARVATION_ORDER 同序。返回实际扣减数。
 */
export function shrinkClasses(populationClasses: PopulationClasses, n: number): number {
  let remaining = Math.floor(n);
  let removed = 0;
  for (const cls of POPULATION_CLASSES) {
    if (remaining <= 0) break;
    const take = Math.min(populationClasses[cls], remaining);
    if (take > 0) {
      populationClasses[cls] -= take;
      remaining -= take;
      removed += take;
    }
  }
  return removed;
}

/** B-0 发起阶层转化：建筑门槛 + 可承担判定 + 入队 + 即时扣源阶层（原 startConversion 主体，逐字搬运）。 */
export function tryStartConversion(
  input: {
    buildings: readonly BuildingInstance[];
    populationClasses: PopulationClasses;
    conversionQueue: { from: PopulationClass; to: PopulationClass; count: number; daysRemaining: number }[];
  },
  from: PopulationClass,
  to: PopulationClass,
  count: number,
): boolean {
  const key = `${from}->${to}`;
  const reqBuilding = CONVERSION_REQUIRES[key];
  if (reqBuilding) {
    const hasBuilding = input.buildings.some(b => b.defId === reqBuilding && b.status === 'working');
    if (!hasBuilding) return false;
  }
  const occ = computeClassOccupation(input.buildings, getBuildingDef);
  if (!canAffordClass(input.populationClasses, occ, from, count)) return false;
  input.conversionQueue.push({ from, to, count, daysRemaining: CONVERSION_DAYS });
  input.populationClasses[from] -= count;
  return true;
}

export interface PopulationTickInput {
  mode: 'sandbox' | 'story';
  resources: Readonly<Partial<Record<ResourceId, number>>>;
  populationClasses: PopulationClasses;
  buildings: readonly BuildingInstance[];
  activeModifiers: readonly ModifierInstance[];
  populationCarry: number;
  housingCap: number;
}

export interface PopulationTickIo {
  /** 落库 people 增量（原 addResource('people', delta, 'population')；返回 clamp 后实际差值，见 ID-1）。 */
  addPeople(delta: number, reason: string): number;
  /** 阶层总和回写（原 setResourceClamped('people', classTotal)）。 */
  setPeopleClamped(value: number): void;
  /** 超上限回落/负增长级联扣减（原 shrinkPopulationClasses）。 */
  shrinkClasses(n: number): number;
}

export interface PopulationTickOutcome {
  /** 小数残差累加器新值（Slice G hardening，store 写回 state.populationCarry）。 */
  carry: number;
  /** 趋势快照（运行时瞬态，不入存档）——store 写回 lastPopReason / lastPopRawNet。 */
  reason: 'grow' | 'cap' | 'idle' | 'overflow';
  rawNet: number;
}

/**
 * 每日人口增长（原 runPopulationTick 主体，逐字搬运）：
 * 有余粮 + 未满住房上限 → 渐增；缺粮减员**不在此**（runStarvationTick 独家负责，防双扣）。
 * 余粮正反馈（surplusDays → ×1.0..1.5）+ 季节/民足乘数；保底 minDailyGrowth 只随季节（DeepSeek 复审 ID-R4）。
 * 库存副作用经 io 注入（emit 留在 store），落库后 farmer 归入/级联扣减/阶层同步次序不变。
 */
export function populationTickStep(input: PopulationTickInput, io: PopulationTickIo): PopulationTickOutcome {
  const people = input.resources['people'] ?? 0;
  const grainStock = input.resources['grain'] ?? 0;
  // §8.1 双表：按模式取人口参数（故事用 STORY_BALANCE 覆盖）
  const popCfg = getBalanceConfig(input.mode).population;
  // A-3：季节 modifier 影响人口增长率（夏 +50%）
  const growthMul = applyModifiers(1, 'country_population_growth', input.activeModifiers);
  // A2：民足系数（阶层需求满足度加权）影响人口增长——缺安居/市集/营伍会压慢生养
  const fulfillMul = populationFulfillment(
    input.populationClasses,
    input.buildings,
    input.resources,
  );
  // 余粮正反馈（2026-06-17）：surplusDays = 存粮 / 当日阶层粮耗；够 1 日 ×1.0、3 日 ×1.2、≥6 日 ×1.5。
  // 缺粮时不起作用（computePopulationGrowth 会判 idle）。给"攒粮"一个正向回报，也加速中后期。
  const grainPerDay = computeClassConsumption(input.populationClasses).totalGrain;
  // 无消耗者（grainPerDay=0）按基准、不额外奖励，避免"撤掉所有消耗以刷满加成"（DeepSeek 复审 ID-R3）
  const surplusDays = grainPerDay > 0 ? grainStock / grainPerDay : 1;
  const surplusMul = Math.max(1, Math.min(1.5, 1 + (surplusDays - 1) * 0.1));
  const totalMul = growthMul * surplusMul * fulfillMul;
  const effectiveCfg = totalMul === 1 ? popCfg : {
    ...popCfg,
    // 季节(growthMul) + 余粮(surplusMul) 共同加速"百分比增长"；但保底 minDailyGrowth 只随季节、
    // 不被余粮抬高，否则夏季囤粮时保底被放大到 2.7/天、开局几天就撞顶（DeepSeek 复审 ID-R4）。
    growthRatePerDay: popCfg.growthRatePerDay * totalMul,
    minDailyGrowth: popCfg.minDailyGrowth * growthMul,
  };
  const result = computePopulationGrowth(
    {
      people, housingCap: input.housingCap, grainStock, carry: input.populationCarry,
      minimumPopulation: DEFAULT_STARVATION.minimumPopulation,
      dailyConsumption: grainPerDay, // 仅"够喂当前人口的真余粮"才触发超限回落，防与饥荒双扣
    },
    effectiveCfg,
  );
  // 趋势快照（运行时）——供 HUD 顶栏箭头 + 详情面板"今日约 +X"
  const outcome: PopulationTickOutcome = { carry: result.carry, reason: result.reason, rawNet: result.rawNet };
  if (result.peopleDelta !== 0) {
    // ID-1 修复：addResource 内部 clamp 到 [0,9999]，故用"调用前后的实际差值"同步阶层，
    // 不能直接用 result.peopleDelta（否则 clamp 掉的部分会经 classTotal 回写、绕过 9999 上限）。
    const actual = io.addPeople(result.peopleDelta, 'population');
    if (actual > 0) {
      // B-0：新增人口全部归入 farmer（最基础阶层）
      input.populationClasses.farmer += actual;
    } else if (actual < 0) {
      // BUG-A：超上限回落，从农→工→兵→士级联扣减（统一出口，不只扣 farmer）
      io.shrinkClasses(-actual);
    }
  }
  // B-0：同步 populationClasses 总和 → resources.people（防漂移）；经 setResourceClamped，不绕过 [0,9999]
  const classTotal = totalPopulation(input.populationClasses);
  if (classTotal !== (input.resources['people'] ?? 0)) {
    io.setPeopleClamped(classTotal);
  }
  return outcome;
}

export interface StarvationTickIo {
  addResource(id: ResourceId, delta: number, reason: string): void;
  adjustMorale(delta: number, reason: string): void;
  adjustWrath(delta: number, reason: string): void;
  /** 供养短缺的直接民心扣减（原 `state.playerMorale = Math.max(0, state.playerMorale - 1)` 直写、不发事件）。 */
  moraleShortPenalty(): void;
}

export interface StarvationTickState {
  resources: Partial<Record<ResourceId, number>>;
  populationClasses: PopulationClasses;
  grainNegativeDays: number;
}

export interface StarvationTickOutcome {
  grainNegativeDays: number;
  populationClasses: PopulationClasses;
}

/**
 * B-0 缺粮饥饿减员（宽限 5 日 → 温和 2% → 15 日后严重 5%）（原 runStarvationTick 主体，逐字搬运）：
 * 每日真实扣粮/布/铜/钱（BUG-B/P3 闭环），缺口判定用扣前库存；短缺非致命仅扣民心；
 * 减员由 applyStarvation 独家负责（杜绝双扣）。副作用经 io 注入，字段经 outcome 写回。
 */
export function starvationTickStep(state: StarvationTickState, io: StarvationTickIo): StarvationTickOutcome {
  const out: StarvationTickOutcome = {
    grainNegativeDays: state.grainNegativeDays,
    populationClasses: state.populationClasses,
  };
  const grainBefore = state.resources['grain'] ?? 0;
  const consumption = computeClassConsumption(state.populationClasses);
  // BUG-B（2026-06-19）：人口每日真实吃粮——此前只比较不扣库存，导致粮食爆仓(粮9999)、
  // 粮食几乎无消耗。现真实扣减（addResource 已 clamp≥0，扣到 0 即止）。
  if (consumption.totalGrain > 0) {
    io.addResource('grain', -consumption.totalGrain, 'consumption');
  }
  // 缺口判定用"扣前库存 grainBefore"：用扣后会被 clamp 到 0 而误判永久缺粮。
  if (grainBefore < consumption.totalGrain) {
    out.grainNegativeDays += 1;
  } else {
    out.grainNegativeDays = 0;
  }
  // P3（2026-06-19）：中后期供养闭环——工要布、兵要铜、士要钱。此前 computeClassConsumption 算了却不扣
  // → 布/铜囤到爆仓、阶层资源无意义。现真实扣减形成消耗出口。短缺**非致命**（不像缺粮饿死）：扣到 0 即止，
  // 仅按是否短缺给轻微民心下滑（-1/日，可随补给恢复），提示玩家"该建蚕桑/铸造、给士发俸"。
  let supplyShort = false;
  for (const [res, need] of [['cloth', consumption.totalCloth], ['bronze', consumption.totalBronze], ['gold', consumption.totalGold]] as const) {
    if (need > 0) {
      const before = state.resources[res] ?? 0;
      io.addResource(res, -need, 'consumption');
      if (before < need) supplyShort = true;
    }
  }
  if (supplyShort) {
    io.moraleShortPenalty();
  }
  if (out.grainNegativeDays <= 0) return out;
  // 缺口造成的减员由 applyStarvation 独家负责；此处只扣粮、不额外减员，杜绝双扣。
  const result = applyStarvation(state.populationClasses, out.grainNegativeDays);
  if (result.peopleLost > 0) {
    out.populationClasses = result.pop;
    io.addResource('people', -result.peopleLost, 'starvation');
  }
  if (result.moralePenalty > 0) {
    io.adjustMorale(-result.moralePenalty, 'starvation');
    io.adjustWrath(2, 'starvation');
  }
  return out;
}

/** A2：各阶层当前未满足的需求名（原 getClassNeedsGaps 主体）。 */
export function classNeedsGaps(
  buildings: readonly BuildingInstance[],
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): Record<PopulationClass, string[]> {
  const out = {} as Record<PopulationClass, string[]>;
  for (const cls of POPULATION_CLASSES) {
    out[cls] = computeClassNeedState(cls, buildings, resources).unmet;
  }
  return out;
}
