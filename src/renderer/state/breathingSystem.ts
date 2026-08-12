/**
 * A-5 世界呼吸系统 — 触发逻辑。
 *
 * - 轻通知(toast)：每 8-12 天触发一条（与正式事件间隔 >= 5 天）
 * - 报文(bulletin)：每 15-25 天触发一条
 * - 同一条 30 天内不重复
 * - 内容必须与当前状态匹配
 */

import type { BreathingEntry, BreathingCondition } from '../data/breathingContent';
import { BREATHING_TOASTS, BREATHING_BULLETINS } from '../data/breathingContent';

export interface BreathingState {
  lastToastDay: number;
  lastBulletinDay: number;
  recentIds: Map<string, number>; // id → day it was last shown
}

export interface BreathingContext {
  currentDay: number;
  season: 0 | 1 | 2 | 3;
  resources: Record<string, number>;
  populationRatio: number; // idle/total, 0-1
  buildingDefIds: Set<string>;
  hasHostileNpc: boolean;
  hasFriendlyNpc: boolean;
  crisisActive: boolean;
  grade: number;
  lastEventDay: number;
}

export interface BreathingConfig {
  toastIntervalMin: number;
  toastIntervalMax: number;
  bulletinIntervalMin: number;
  bulletinIntervalMax: number;
  eventCooldown: number;
  repeatCooldown: number;
}

export const DEFAULT_BREATHING_CONFIG: BreathingConfig = {
  toastIntervalMin: 8,
  toastIntervalMax: 12,
  bulletinIntervalMin: 15,
  bulletinIntervalMax: 25,
  eventCooldown: 5,
  repeatCooldown: 30,
};

export function createBreathingState(): BreathingState {
  return { lastToastDay: -100, lastBulletinDay: -100, recentIds: new Map() };
}

function matchesCondition(cond: BreathingCondition, ctx: BreathingContext): boolean {
  switch (cond.type) {
    case 'always': return true;
    case 'season': return ctx.season === cond.season;
    case 'resource_low': return (ctx.resources[cond.resource] ?? 0) < cond.threshold;
    case 'resource_high': return (ctx.resources[cond.resource] ?? 0) >= cond.threshold;
    case 'population_ratio':
      if (cond.min !== undefined && ctx.populationRatio < cond.min) return false;
      if (cond.max !== undefined && ctx.populationRatio > cond.max) return false;
      return true;
    case 'has_building': return ctx.buildingDefIds.has(cond.defId);
    case 'npc_hostile': return ctx.hasHostileNpc;
    case 'npc_friendly': return ctx.hasFriendlyNpc;
    case 'crisis_active': return ctx.crisisActive;
    case 'grade_min': return ctx.grade >= cond.grade;
  }
}

function filterAvailable(
  entries: BreathingEntry[],
  ctx: BreathingContext,
  state: BreathingState,
  config: BreathingConfig,
): BreathingEntry[] {
  return entries.filter(e => {
    const lastShown = state.recentIds.get(e.id);
    if (lastShown !== undefined && ctx.currentDay - lastShown < config.repeatCooldown) return false;
    return matchesCondition(e.condition, ctx);
  });
}

export interface BreathingResult {
  entry: BreathingEntry | null;
  reason: string;
}

export function tickBreathingToast(
  state: BreathingState,
  ctx: BreathingContext,
  rng: () => number,
  config: BreathingConfig = DEFAULT_BREATHING_CONFIG,
): BreathingResult {
  const daysSinceToast = ctx.currentDay - state.lastToastDay;
  const threshold = config.toastIntervalMin + rng() * (config.toastIntervalMax - config.toastIntervalMin);
  if (daysSinceToast < threshold) return { entry: null, reason: 'cooldown' };
  if (ctx.currentDay - ctx.lastEventDay < config.eventCooldown) return { entry: null, reason: 'event_recent' };

  const pool = filterAvailable(BREATHING_TOASTS, ctx, state, config);
  if (pool.length === 0) return { entry: null, reason: 'no_match' };

  const pick = pool[Math.floor(rng() * pool.length)];
  if (!pick) return { entry: null, reason: 'no_match' };
  state.lastToastDay = ctx.currentDay;
  state.recentIds.set(pick.id, ctx.currentDay);
  return { entry: pick, reason: 'triggered' };
}

export function tickBreathingBulletin(
  state: BreathingState,
  ctx: BreathingContext,
  rng: () => number,
  config: BreathingConfig = DEFAULT_BREATHING_CONFIG,
): BreathingResult {
  const daysSinceBulletin = ctx.currentDay - state.lastBulletinDay;
  const threshold = config.bulletinIntervalMin + rng() * (config.bulletinIntervalMax - config.bulletinIntervalMin);
  if (daysSinceBulletin < threshold) return { entry: null, reason: 'cooldown' };

  const pool = filterAvailable(BREATHING_BULLETINS, ctx, state, config);
  if (pool.length === 0) return { entry: null, reason: 'no_match' };

  const pick = pool[Math.floor(rng() * pool.length)];
  if (!pick) return { entry: null, reason: 'no_match' };
  state.lastBulletinDay = ctx.currentDay;
  state.recentIds.set(pick.id, ctx.currentDay);
  return { entry: pick, reason: 'triggered' };
}
