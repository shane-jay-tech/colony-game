/**
 * 人口增长（纯函数，无副作用）——8h 沙盒核心循环之一。
 *
 * 缺口背景：此前 people 资源只被建筑维护消耗、无任何自然增长，导致国格阶梯门槛
 * （pop 30→320）爬不上去。本模块补上"有余粮 + 有住房 → 人口自然增长；缺粮 → 流失"。
 *
 * 与 productionSystem 同款分数残差风格：每日增量多为小数，用独立 carry 累积成整数，
 * 避免"每天 +0.08 永远取整为 0"。carry 存在 GameState.populationCarry（不混 productionCarry）。
 */

import type { BuildingDef, BuildingInstance } from '../data/schema';

export interface PopulationConfig {
  growthRatePerDay: number;
  minDailyGrowth: number;
  starveRatePerDay: number;
}

export interface PopulationGrowthInput {
  people: number;
  /** 住房上限（gameStore 用 baseCap + 建筑 housingCapacity + cap modifier 算好后传入） */
  housingCap: number;
  /** production tick 之后的当前存粮 */
  grainStock: number;
  /** 上一 tick 的人口小数残差 */
  carry: number;
}

export interface PopulationGrowthResult {
  /** 本 tick 取整后人口增量（正=增、负=饥荒流失） */
  peopleDelta: number;
  /** 结转到下一 tick 的小数残差 */
  carry: number;
  reason: 'grow' | 'starve' | 'cap' | 'idle';
}

/** 累加所有 working 建筑提供的住房容量。 */
export function sumHousingCapacity(
  buildings: readonly BuildingInstance[],
  defLookup: (id: string) => BuildingDef | undefined,
): number {
  let sum = 0;
  for (const b of buildings) {
    if (b.status !== 'working') continue;
    const def = defLookup(b.defId);
    if (def && typeof def.housingCapacity === 'number') sum += def.housingCapacity;
  }
  return sum;
}

/**
 * 计算本 tick 人口变化。
 * - 缺粮（grainStock<=0）→ 饥荒，按 people×starveRate 流失（日常软惩罚，与 60 日双零危机分层并存）。
 * - 已满住房上限 → 不增（reason='cap'），不强制回落（拆房不杀人口）。
 * - 有余粮且未满 → 按 max(people×growthRate, minDailyGrowth) 增长，clamp 到 cap 余量。
 * 增量与 carry 合并后取整，余数留 carry。
 */
export function computePopulationGrowth(
  input: PopulationGrowthInput,
  cfg: PopulationConfig,
): PopulationGrowthResult {
  const { people, housingCap, grainStock, carry } = input;

  let rawNet: number;
  let reason: PopulationGrowthResult['reason'];

  if (grainStock <= 0) {
    // 饥荒流失（人口为 0 时无可流失）
    rawNet = people > 0 ? -(people * cfg.starveRatePerDay) : 0;
    reason = people > 0 ? 'starve' : 'idle';
  } else if (people >= housingCap) {
    rawNet = 0;
    reason = 'cap';
  } else {
    const desired = Math.max(people * cfg.growthRatePerDay, cfg.minDailyGrowth);
    const room = housingCap - people;
    rawNet = Math.min(desired, room);
    reason = 'grow';
  }

  const total = rawNet + carry;
  const peopleDelta = Math.trunc(total);
  const nextCarry = total - peopleDelta;
  return {
    peopleDelta,
    // |carry| < 1（trunc 保证），极小残差归零避免浮点尘埃累积
    carry: Math.abs(nextCarry) > 1e-9 ? nextCarry : 0,
    reason,
  };
}
