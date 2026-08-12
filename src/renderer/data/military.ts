/**
 * B-1 军事系统数据定义。
 * 设计原则：军事收益="防御性价值"（避损、杠杆、威望），不是盈利手段。
 */

export const UNIT_TYPES = ['militia', 'infantry', 'archer', 'elite_infantry', 'cavalry', 'chariot', 'imperial_guard', 'siege'] as const;
export type UnitType = typeof UNIT_TYPES[number];

export interface UnitDef {
  id: UnitType;
  name: string;
  attack: number;
  defense: number;
  grainPerDay: number;
  /** 解锁所需国格等级 */
  gradeRequired: number;
  /** 解锁所需建筑（must be working） */
  buildingRequired: string;
  /** 额外解锁条件：国策 id */
  policyRequired?: string;
}

export const UNIT_DEFS: Record<UnitType, UnitDef> = {
  militia: { id: 'militia', name: '民兵', attack: 3, defense: 4, grainPerDay: 2, gradeRequired: 1, buildingRequired: 'bld_barracks' },
  infantry: { id: 'infantry', name: '步卒', attack: 6, defense: 5, grainPerDay: 3, gradeRequired: 2, buildingRequired: 'bld_barracks', policyRequired: 'pol_conscript' },
  archer: { id: 'archer', name: '弓兵', attack: 5, defense: 3, grainPerDay: 2, gradeRequired: 2, buildingRequired: 'bld_barracks', policyRequired: 'pol_conscript' },
  elite_infantry: { id: 'elite_infantry', name: '精锐步卒', attack: 9, defense: 8, grainPerDay: 5, gradeRequired: 3, buildingRequired: 'bld_training_ground' },
  cavalry: { id: 'cavalry', name: '骑射', attack: 8, defense: 4, grainPerDay: 4, gradeRequired: 3, buildingRequired: 'bld_stable' },
  chariot: { id: 'chariot', name: '战车', attack: 12, defense: 6, grainPerDay: 6, gradeRequired: 3, buildingRequired: 'bld_chariot_works' },
  imperial_guard: { id: 'imperial_guard', name: '禁卫军', attack: 15, defense: 12, grainPerDay: 8, gradeRequired: 4, buildingRequired: 'bld_imperial_guard' },
  siege: { id: 'siege', name: '攻城器械', attack: 6, defense: 2, grainPerDay: 4, gradeRequired: 4, buildingRequired: 'bld_imperial_guard' },
};

export type ExpeditionTarget = 'raid' | 'deter' | 'siege' | 'intercept';

export interface ExpeditionConfig {
  target: ExpeditionTarget;
  npcId: string;
  units: Partial<Record<UnitType, number>>;
  generalId?: string;
  grainAllocated: number;
}

export interface ActiveExpedition {
  config: ExpeditionConfig;
  daysRemaining: number;
  totalDays: number;
  morale: number;
  eventTriggered: boolean;
}

export type BattleOutcome = 'victory' | 'pyrrhic' | 'defeat';

export interface BattleResult {
  outcome: BattleOutcome;
  winChance: number;
  unitsLost: number;
  lootGrain: number;
  lootGold: number;
  renownGain: number;
  npcStanceDelta: number;
  deterDays?: number;
}

export interface DefenseAlert {
  npcId: string;
  daysUntilAttack: number;
  npcStrength: number;
}

export const EXPEDITION_DAYS: Record<ExpeditionTarget, { min: number; max: number }> = {
  raid: { min: 3, max: 5 },
  deter: { min: 2, max: 3 },
  siege: { min: 7, max: 10 },
  intercept: { min: 0, max: 0 },
};

export const MORALE_CONFIG = {
  initial: 80,
  max: 100,
  min: 10,
  winBonus: 20,
  lossPenalty: -30,
  grainShortagePerDay: -5,
  routeThreshold: 30,
  routeExtraLoss: 0.20,
  inspireMoralFloor: 50,
};

export const DETER_CONFIG = {
  grainCostMul: 0.3,
  deterDays: 2,
  stanceGain: 20,
  peaceDays: 60,
  minStrengthRatio: 0.8,
};

export const DEFENSE_CONFIG = {
  homeBonus: 1.20,
  noInterceptLootRate: { min: 0.15, max: 0.25 },
  noInterceptPopLoss: 0.10,
  vassalageThreshold: 3,
};
