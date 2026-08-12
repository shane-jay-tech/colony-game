/**
 * B-1 军事系统逻辑（纯函数）。
 * 出征/防御/威慑/士气/兵种解锁判定。
 */

import type { UnitType, ExpeditionConfig, ActiveExpedition, BattleResult, BattleOutcome, DefenseAlert } from '../data/military';
import { UNIT_DEFS, MORALE_CONFIG, DETER_CONFIG, DEFENSE_CONFIG, EXPEDITION_DAYS } from '../data/military';
import type { BuildingInstance } from '../data/schema';
import type { RngHandle } from './rng';

export interface MilitaryContext {
  grade: number;
  buildings: readonly BuildingInstance[];
  adoptedPolicies: ReadonlySet<string>;
  soldierCount: number;
  grain: number;
}

export function getAvailableUnitTypes(ctx: MilitaryContext): UnitType[] {
  const workingBuildings = new Set(
    ctx.buildings.filter(b => b.status === 'working').map(b => b.defId),
  );
  return Object.values(UNIT_DEFS)
    .filter(def => {
      if (ctx.grade < def.gradeRequired) return false;
      if (!workingBuildings.has(def.buildingRequired)) return false;
      if (def.policyRequired && !ctx.adoptedPolicies.has(def.policyRequired)) return false;
      return true;
    })
    .map(d => d.id);
}

export function computeArmyStrength(units: Partial<Record<UnitType, number>>, morale: number, generalCommand?: number): number {
  let totalAtk = 0;
  for (const [type, count] of Object.entries(units)) {
    const def = UNIT_DEFS[type as UnitType];
    if (!def || !count || count <= 0) continue;
    totalAtk += def.attack * count;
  }
  const generalMul = generalCommand ? (1 + generalCommand / 100) : 1;
  const moraleMul = morale / MORALE_CONFIG.initial;
  return totalAtk * generalMul * moraleMul;
}

export function computeDefenseStrength(units: Partial<Record<UnitType, number>>, morale: number, generalCommand?: number): number {
  let totalDef = 0;
  for (const [type, count] of Object.entries(units)) {
    const def = UNIT_DEFS[type as UnitType];
    if (!def || !count || count <= 0) continue;
    totalDef += def.defense * count;
  }
  const generalMul = generalCommand ? (1 + generalCommand / 100) : 1;
  const moraleMul = morale / MORALE_CONFIG.initial;
  return totalDef * generalMul * moraleMul;
}

export function totalUnitCount(units: Partial<Record<UnitType, number>>): number {
  let total = 0;
  for (const count of Object.values(units)) {
    if (count && count > 0) total += count;
  }
  return total;
}

export function computeGrainCost(units: Partial<Record<UnitType, number>>, days: number): number {
  let perDay = 0;
  for (const [type, count] of Object.entries(units)) {
    const def = UNIT_DEFS[type as UnitType];
    if (!def || !count || count <= 0) continue;
    perDay += def.grainPerDay * count;
  }
  return perDay * days;
}

export function canLaunchExpedition(
  config: ExpeditionConfig,
  ctx: MilitaryContext,
): { ok: true } | { ok: false; reason: string } {
  const available = getAvailableUnitTypes(ctx);
  for (const [type, count] of Object.entries(config.units)) {
    if (!count || count <= 0) continue;
    if (!available.includes(type as UnitType)) {
      return { ok: false, reason: `unit_locked:${type}` };
    }
  }
  const total = totalUnitCount(config.units);
  if (total <= 0) return { ok: false, reason: 'no_units' };
  const maxDeploy = Math.floor(ctx.soldierCount * 0.8);
  if (total > maxDeploy) return { ok: false, reason: 'exceed_max_deploy' };

  const days = EXPEDITION_DAYS[config.target];
  const minGrain = computeGrainCost(config.units, days.min);
  if (config.grainAllocated < minGrain) return { ok: false, reason: 'insufficient_grain' };
  if (ctx.grain < config.grainAllocated) return { ok: false, reason: 'insufficient_grain_stock' };

  return { ok: true };
}

export function createExpedition(config: ExpeditionConfig, rng: RngHandle): ActiveExpedition {
  const range = EXPEDITION_DAYS[config.target];
  const days = config.target === 'intercept' ? 0 : rng.nextInt(range.min, range.max);
  return {
    config,
    daysRemaining: days,
    totalDays: days,
    morale: MORALE_CONFIG.initial,
    eventTriggered: false,
  };
}

export function tickExpedition(exp: ActiveExpedition, grainAvailable: number): ActiveExpedition {
  const next = { ...exp, daysRemaining: exp.daysRemaining - 1 };
  const neededGrain = computeGrainCost(exp.config.units, 1);
  if (grainAvailable < neededGrain) {
    next.morale = Math.max(MORALE_CONFIG.min, next.morale + MORALE_CONFIG.grainShortagePerDay);
  }
  return next;
}

export function resolveBattle(
  myStrength: number,
  enemyStrength: number,
  myUnits: number,
  rng: RngHandle,
  isDefense: boolean,
): BattleResult {
  const effectiveMyStrength = isDefense ? myStrength * DEFENSE_CONFIG.homeBonus : myStrength;
  const enemyRoll = enemyStrength * (0.85 + rng.next() * 0.3);
  const denom = effectiveMyStrength + enemyRoll;
  const winChance = denom > 0 ? effectiveMyStrength / denom : 0.5; // 防 0/0=NaN（双方军力皆 0 时算平局）

  let outcome: BattleOutcome;
  let lossRate: number;
  let lootMul: number;
  let renown: number;
  let stanceDelta: number;

  if (winChance > 0.6) {
    outcome = 'victory';
    lossRate = 0.10 + rng.next() * 0.10;
    lootMul = 1;
    renown = 10;
    stanceDelta = -15;
  } else if (winChance > 0.4) {
    outcome = 'pyrrhic';
    lossRate = 0.30 + rng.next() * 0.20;
    lootMul = 0.5;
    renown = 3;
    stanceDelta = -5;
  } else {
    outcome = 'defeat';
    lossRate = 0.50 + rng.next() * 0.20;
    lootMul = 0;
    renown = -5;
    stanceDelta = 10;
  }

  // 伤亡封顶不超己方实际兵数；0 兵时不产生"损失不存在之兵"
  const unitsLost = myUnits > 0 ? Math.min(myUnits, Math.max(1, Math.round(myUnits * lossRate))) : 0;
  const baseLoot = Math.round(enemyStrength * 0.4);
  const lootGrain = Math.round(baseLoot * lootMul * 0.6);
  const lootGold = Math.round(baseLoot * lootMul * 0.4);

  return {
    outcome,
    winChance,
    unitsLost,
    lootGrain,
    lootGold,
    renownGain: renown,
    npcStanceDelta: stanceDelta,
  };
}

export function resolveDeter(
  myMilitary: number,
  npcMilitary: number,
): { ok: boolean; grainCost: number; deterDays: number; stanceGain: number } {
  const grainCost = Math.round(myMilitary * DETER_CONFIG.grainCostMul * DETER_CONFIG.deterDays);
  if (myMilitary < npcMilitary * DETER_CONFIG.minStrengthRatio) {
    return { ok: false, grainCost, deterDays: 0, stanceGain: 0 };
  }
  return {
    ok: true,
    grainCost,
    deterDays: DETER_CONFIG.peaceDays,
    stanceGain: DETER_CONFIG.stanceGain,
  };
}

export function computeNoInterceptLoss(
  resources: { grain: number; gold: number; people: number },
  rng: RngHandle,
): { grainLost: number; goldLost: number; peopleLost: number } {
  const rate = DEFENSE_CONFIG.noInterceptLootRate.min + rng.next() * (DEFENSE_CONFIG.noInterceptLootRate.max - DEFENSE_CONFIG.noInterceptLootRate.min);
  return {
    grainLost: Math.round(resources.grain * rate),
    goldLost: Math.round(resources.gold * rate),
    peopleLost: Math.round(resources.people * DEFENSE_CONFIG.noInterceptPopLoss),
  };
}

export function applyMoraleChange(morale: number, delta: number): number {
  return Math.max(MORALE_CONFIG.min, Math.min(MORALE_CONFIG.max, morale + delta));
}

export function isRouted(morale: number): boolean {
  return morale < MORALE_CONFIG.routeThreshold;
}

export function computeRouteExtraLoss(unitsLost: number): number {
  return Math.round(unitsLost * MORALE_CONFIG.routeExtraLoss);
}
