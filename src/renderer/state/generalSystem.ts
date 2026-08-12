/**
 * B-2 将领系统逻辑（纯函数）。
 * 将领招募、忠诚度管理、出征加成、叛逃判定。
 */

import type { GeneralDef, GeneralState, GeneralTrait } from '../data/generals';
import {
  GENERAL_POOL, MAX_GENERALS, LOYALTY_DEFECT_THRESHOLD, LOYALTY_DEFECT_CHANCE,
  LOYALTY_DECAY_PER_MONTH, LOYALTY_WIN_BONUS, LOYALTY_LOSS_PENALTY, TRAIT_EFFECTS,
} from '../data/generals';
import type { RngHandle } from './rng';

export function getGeneralDef(id: string): GeneralDef | undefined {
  return GENERAL_POOL.find(g => g.id === id);
}

export function canRecruit(currentGenerals: readonly GeneralState[]): boolean {
  return currentGenerals.length < MAX_GENERALS;
}

export function recruitGeneral(id: string, currentGenerals: GeneralState[]): GeneralState[] {
  if (currentGenerals.length >= MAX_GENERALS) return currentGenerals;
  if (currentGenerals.some(g => g.id === id)) return currentGenerals;
  return [...currentGenerals, { id, loyalty: 80, deployed: false }];
}

export function dismissGeneral(id: string, generals: GeneralState[]): GeneralState[] {
  return generals.filter(g => g.id !== id);
}

export function getAvailableGenerals(generals: readonly GeneralState[]): GeneralState[] {
  return generals.filter(g => !g.deployed);
}

export function deployGeneral(id: string, generals: GeneralState[]): GeneralState[] {
  return generals.map(g => g.id === id ? { ...g, deployed: true } : g);
}

export function returnGeneral(id: string, generals: GeneralState[]): GeneralState[] {
  return generals.map(g => g.id === id ? { ...g, deployed: false } : g);
}

export interface GeneralCombatBonus {
  attackMul: number;
  defenseMul: number;
  grainMul: number;
  moraleFloor: number;
  hasAmbush: boolean;
  command: number;
}

export function computeGeneralBonus(id: string): GeneralCombatBonus {
  const def = getGeneralDef(id);
  if (!def) return { attackMul: 1, defenseMul: 1, grainMul: 1, moraleFloor: 0, hasAmbush: false, command: 0 };

  let attackMul = 1;
  let defenseMul = 1;
  let grainMul = 1;
  let moraleFloor = 0;
  let hasAmbush = false;

  for (const trait of def.traits) {
    const fx = TRAIT_EFFECTS[trait];
    if (fx.attackMul) attackMul *= fx.attackMul;
    if (fx.defenseMul) defenseMul *= fx.defenseMul;
    if (fx.grainMul) grainMul *= fx.grainMul;
    if (fx.moraleFloor) moraleFloor = Math.max(moraleFloor, fx.moraleFloor);
    if (fx.ambushBonus) hasAmbush = true;
  }

  return { attackMul, defenseMul, grainMul, moraleFloor, hasAmbush, command: def.command };
}

export function tickLoyalty(generals: GeneralState[], rng: RngHandle): { generals: GeneralState[]; defected: string[] } {
  const defected: string[] = [];
  const updated = generals.map(g => {
    const loyalty = Math.max(0, g.loyalty - LOYALTY_DECAY_PER_MONTH);
    // 出征在外的将领不在此叛逃（否则 activeExpeditions 会留下悬空 generalId）；忠诚仍照常衰减。
    if (!g.deployed && loyalty < LOYALTY_DEFECT_THRESHOLD && rng.next() < LOYALTY_DEFECT_CHANCE) {
      defected.push(g.id);
      return null;
    }
    return { ...g, loyalty };
  }).filter((g): g is GeneralState => g !== null);
  return { generals: updated, defected };
}

export function applyBattleResult(generals: GeneralState[], generalId: string, won: boolean): GeneralState[] {
  return generals.map(g => {
    if (g.id !== generalId) return g;
    const delta = won ? LOYALTY_WIN_BONUS : -LOYALTY_LOSS_PENALTY;
    return { ...g, loyalty: Math.max(0, Math.min(100, g.loyalty + delta)) };
  });
}

export function getCapturedGeneralTraits(rng: RngHandle): GeneralTrait[] {
  const allTraits: GeneralTrait[] = ['attack_boost', 'defense_boost', 'ambush', 'inspire', 'frugal'];
  const count = rng.nextInt(1, 2);
  const traits: GeneralTrait[] = [];
  for (let i = 0; i < count; i++) {
    const pick = rng.pick(allTraits.filter(t => !traits.includes(t)));
    if (pick) traits.push(pick);
  }
  return traits;
}
