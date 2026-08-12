/**
 * B-0 人口阶层管理逻辑（纯函数）。
 *
 * - 阶层占用检查：指定阶层是否有足够闲置人口操作某建筑
 * - 转化队列 tick：每日推进转化，完成时扣源加目标
 * - 饥饿减员：缺粮持续 N 天后按比例减员（从低消耗阶层开始扣）
 * - 阶层消耗计算：各阶层日消耗资源
 */

import type { PopulationClass, PopulationClasses, ConversionOrder, StarvationConfig, ClassConsumption } from '../data/populationClass';
import { CLASS_CONSUMPTION, CONVERSION_DAYS, DEFAULT_STARVATION, totalPopulation } from '../data/populationClass';
import type { BuildingDef, BuildingInstance } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';

export interface ClassOccupation {
  farmer: number;
  worker: number;
  soldier: number;
  scholar: number;
}

export function computeClassOccupation(
  buildings: readonly BuildingInstance[],
  defLookup: (id: string) => BuildingDef | undefined,
): ClassOccupation {
  const occ: ClassOccupation = { farmer: 0, worker: 0, soldier: 0, scholar: 0 };
  for (const b of buildings) {
    if (b.status !== 'constructing' && b.status !== 'working') continue;
    const def = defLookup(b.defId);
    if (!def) continue;
    const people = def.cost.people ?? 0;
    if (people <= 0) continue;
    const cls: PopulationClass = def.classType ?? 'farmer';
    occ[cls] += people;
  }
  return occ;
}

export function getIdleByClass(pop: PopulationClasses, occ: ClassOccupation): PopulationClasses {
  return {
    farmer: Math.max(0, pop.farmer - occ.farmer),
    worker: Math.max(0, pop.worker - occ.worker),
    soldier: Math.max(0, pop.soldier - occ.soldier),
    scholar: Math.max(0, pop.scholar - occ.scholar),
  };
}

export function canAffordClass(pop: PopulationClasses, occ: ClassOccupation, cls: PopulationClass, count: number): boolean {
  const idle = pop[cls] - occ[cls];
  return idle >= count;
}

export interface ConversionTickResult {
  completed: ConversionOrder[];
  remaining: ConversionOrder[];
}

export function tickConversionQueue(queue: ConversionOrder[]): ConversionTickResult {
  const completed: ConversionOrder[] = [];
  const remaining: ConversionOrder[] = [];
  for (const order of queue) {
    const next = { ...order, daysRemaining: order.daysRemaining - 1 };
    if (next.daysRemaining <= 0) {
      completed.push(next);
    } else {
      remaining.push(next);
    }
  }
  return { completed, remaining };
}

export function applyConversion(pop: PopulationClasses, order: ConversionOrder): PopulationClasses {
  const result = { ...pop };
  result[order.from] = Math.max(0, result[order.from] - order.count);
  result[order.to] += order.count;
  return result;
}

export interface ClassConsumptionResult {
  totalGrain: number;
  totalCloth: number;
  totalBronze: number;
  totalGold: number;
}

export function computeClassConsumption(pop: PopulationClasses): ClassConsumptionResult {
  let totalGrain = 0, totalCloth = 0, totalBronze = 0, totalGold = 0;
  for (const cls of ['farmer', 'worker', 'soldier', 'scholar'] as PopulationClass[]) {
    const count = pop[cls];
    if (count <= 0) continue;
    const c = CLASS_CONSUMPTION[cls];
    totalGrain += count * c.grain;
    totalCloth += count * (c.cloth ?? 0);
    totalBronze += count * (c.bronze ?? 0);
    totalGold += count * (c.gold ?? 0);
  }
  return { totalGrain, totalCloth, totalBronze, totalGold };
}

export interface StarvationResult {
  pop: PopulationClasses;
  peopleLost: number;
  moralePenalty: number;
}

const STARVATION_ORDER: PopulationClass[] = ['farmer', 'worker', 'soldier', 'scholar'];

export function applyStarvation(
  pop: PopulationClasses,
  grainNegativeDays: number,
  config: StarvationConfig = DEFAULT_STARVATION,
): StarvationResult {
  if (grainNegativeDays < config.graceDays) {
    return { pop: { ...pop }, peopleLost: 0, moralePenalty: 0 };
  }

  const total = totalPopulation(pop);
  if (total <= config.minimumPopulation) {
    return { pop: { ...pop }, peopleLost: 0, moralePenalty: config.moralePenaltyPerDay };
  }

  const rate = grainNegativeDays >= config.severeThresholdDays ? config.severeRate : config.mildRate;
  let toLose = Math.max(1, Math.floor(total * rate));
  const minPop = config.minimumPopulation;

  const result = { ...pop };
  let lost = 0;

  for (const cls of STARVATION_ORDER) {
    if (toLose <= 0) break;
    if (totalPopulation(result) <= minPop) break;
    const canLose = Math.min(result[cls], toLose, totalPopulation(result) - minPop);
    if (canLose > 0) {
      result[cls] -= canLose;
      lost += canLose;
      toLose -= canLose;
    }
  }

  const moralePenalty = grainNegativeDays >= config.severeThresholdDays ? config.moralePenaltyPerDay : 0;
  return { pop: result, peopleLost: lost, moralePenalty };
}
