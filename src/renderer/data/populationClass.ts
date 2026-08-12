/**
 * B-0 人口阶层类型定义。
 * 四阶层：农(farmer)/工(worker)/兵(soldier)/士(scholar)。
 */

export const POPULATION_CLASSES = ['farmer', 'worker', 'soldier', 'scholar'] as const;
export type PopulationClass = typeof POPULATION_CLASSES[number];

export interface PopulationClasses {
  farmer: number;
  worker: number;
  soldier: number;
  scholar: number;
}

export function createDefaultPopulation(total: number): PopulationClasses {
  return { farmer: total, worker: 0, soldier: 0, scholar: 0 };
}

export function totalPopulation(pop: PopulationClasses): number {
  return pop.farmer + pop.worker + pop.soldier + pop.scholar;
}

export interface ConversionOrder {
  from: PopulationClass;
  to: PopulationClass;
  count: number;
  daysRemaining: number;
}

export interface ClassConsumption {
  grain: number;
  cloth?: number;
  bronze?: number;
  gold?: number;
}

export const CLASS_CONSUMPTION: Record<PopulationClass, ClassConsumption> = {
  farmer: { grain: 1 },
  worker: { grain: 1.5, cloth: 0.2 },
  soldier: { grain: 2, bronze: 0.3 },
  scholar: { grain: 2, gold: 1 },
};

export const CONVERSION_DAYS = 4;

export const CONVERSION_REQUIRES: Record<string, string> = {
  'farmer->worker': 'bld_academy',
  'farmer->soldier': 'bld_barracks',
  'worker->scholar': 'bld_academy',
};

export interface StarvationConfig {
  graceDays: number;
  mildRate: number;
  severeThresholdDays: number;
  severeRate: number;
  moralePenaltyPerDay: number;
  minimumPopulation: number;
}

export const DEFAULT_STARVATION: StarvationConfig = {
  graceDays: 5,
  mildRate: 0.02,
  severeThresholdDays: 15,
  severeRate: 0.05,
  moralePenaltyPerDay: 3,
  minimumPopulation: 5,
};
