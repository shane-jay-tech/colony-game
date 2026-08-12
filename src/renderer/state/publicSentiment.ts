/**
 * A1 双轴民心：怨愤（publicWrath）的纯逻辑层。
 *
 * 与既有 playerMorale（0–100「民心/希望」）配对，构成 Frostpunk 式双米：
 * 民心高 = 颂声加成；怨愤高 = 民变诉求。阈值/冷却/回落全部在此定义，便于单测与平衡调参。
 */
import type { CrisisKind } from './crisis';

/** 怨愤超过此值触发民变诉求（复用 factionSystem 诉求模态） */
export const WRATH_DEMAND_THRESHOLD = 70;
/** 两次「民怨沸腾」警示之间的最短间隔（天） */
export const WRATH_DEMAND_COOLDOWN_DAYS = 14;
/** 太平日子每天自然回落的怨愤量（危机期间不回落） */
export const WRATH_PASSIVE_DECAY_PER_DAY = 1;
/** 民心鼎盛（颂声加成）的门槛 */
export const PRAISE_MORALE_THRESHOLD = 80;
/** 民心回落移除颂声加成的门槛 */
export const PRAISE_MORALE_FALLBACK = 70;

/** 各危机种类对怨愤的一次性冲击 */
export const WRATH_CRISIS_DELTA: Record<CrisisKind, number> = {
  unrest: 16,
  vassalage: 10,
  cession: 8,
};

/** 诉求被拒/接受时的怨愤变化 */
export const WRATH_DEMAND_REJECTED = 12;
export const WRATH_DEMAND_ACCEPTED = -10;

export function clampSentiment(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.floor(value)));
}

/** 怨愤是否达到触发民变诉求的条件（含冷却） */
export function shouldForceWrathDemand(
  wrath: number,
  lastDemandDay: number | null,
  currentDay: number,
): boolean {
  if (wrath < WRATH_DEMAND_THRESHOLD) return false;
  if (lastDemandDay === null) return true;
  return currentDay - lastDemandDay >= WRATH_DEMAND_COOLDOWN_DAYS;
}
