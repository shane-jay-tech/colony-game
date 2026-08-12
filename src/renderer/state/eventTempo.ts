/**
 * EventTempo — 状态驱动的事件节奏控制器（A-7）。
 *
 * 按国家当前状态动态调整事件采样间隔，替代固定 minDaysBetween。
 * 纯函数、无副作用、可测。GameStore.tickDay 调用它决定"今天该不该尝试采样事件"。
 */

import type { CourtEvent, CourtEventTag } from '../data/schema';
import type { NpcCountryState } from '../data/schema';

// ─── 国家状态分级 ───────────────────────────────────────────

export type NationState = 'peaceful' | 'developing' | 'tense' | 'crisis';

export interface NationStateInput {
  crisisActive: boolean;
  npcCountries: readonly NpcCountryState[];
  grainCapacityRatio: number;  // grain / estimated storage (0..1+), clamped ≥0
  goldAmount: number;
}

/**
 * 评估当前国家状态。优先级：crisis > tense > peaceful > developing（默认）。
 *
 * - crisis: crisis.active === true
 * - tense: 任一关键资源 < 20% 或存在敌对 NPC (stance < -30)
 * - peaceful: 粮 > 50% 储量、金 > 20、无敌对 NPC
 * - developing: 其他所有情况
 */
export function assessNationState(input: NationStateInput): NationState {
  if (input.crisisActive) return 'crisis';

  const hasHostileNpc = input.npcCountries.some(n => n.stance < -30);
  const grainLow = input.grainCapacityRatio < 0.2;
  const goldLow = input.goldAmount < 5;

  if (grainLow || goldLow || hasHostileNpc) return 'tense';

  if (input.grainCapacityRatio > 0.5 && input.goldAmount > 20 && !hasHostileNpc) return 'peaceful';

  return 'developing';
}

// ─── 动态间隔 ────────────────────────────────────────────────

export interface EventTempoConfig {
  intervals: Record<NationState, [min: number, max: number]>;
  forceMaxDays: number;   // 超过此天数无事件 → 强制触发
  antiComboDays: number;  // 两事件最小间距
}

export const DEFAULT_TEMPO_CONFIG: EventTempoConfig = {
  intervals: {
    peaceful:   [35, 50],
    developing: [25, 35],
    tense:      [15, 25],
    crisis:     [10, 20],
  },
  forceMaxDays: 50,
  antiComboDays: 8,
};

export interface EventTempoDecision {
  shouldSample: boolean;
  reason: 'anti_combo' | 'waiting' | 'interval_met' | 'force_trigger';
}

/**
 * 决定今天是否应该尝试采样事件。
 *
 * @param daysSinceLastEvent 距上次事件的天数
 * @param nationState 当前国家状态
 * @param rng 0..1 随机数（用于在 [min, max] 区间内选阈值）
 * @param config 节奏配置
 */
export function shouldSampleEvent(
  daysSinceLastEvent: number,
  nationState: NationState,
  rng: number,
  config: EventTempoConfig = DEFAULT_TEMPO_CONFIG,
): EventTempoDecision {
  // Force trigger always wins (even over anti-combo)
  if (daysSinceLastEvent >= config.forceMaxDays) {
    return { shouldSample: true, reason: 'force_trigger' };
  }

  if (daysSinceLastEvent < config.antiComboDays) {
    return { shouldSample: false, reason: 'anti_combo' };
  }

  const [min, max] = config.intervals[nationState];
  const threshold = min + rng * (max - min);

  if (daysSinceLastEvent >= threshold) {
    return { shouldSample: true, reason: 'interval_met' };
  }

  return { shouldSample: false, reason: 'waiting' };
}

// ─── 状态权重：事件池筛选 ─────────────────────────────────────

const PEACEFUL_BLOCKED: ReadonlySet<CourtEventTag> = new Set<CourtEventTag>(['负']);
const CRISIS_BLOCKED: ReadonlySet<CourtEventTag> = new Set<CourtEventTag>(['正']);

function filterExcluding(events: readonly CourtEvent[], blocked: ReadonlySet<CourtEventTag>): CourtEvent[] {
  return events.filter(evt => {
    if (evt.tags.includes('抉择')) return true;
    return !evt.tags.some(t => blocked.has(t));
  });
}

/**
 * 按国家状态过滤事件候选池。
 * - 太平时过滤掉纯负面事件（不含 '抉择' 的纯 '负'）
 * - 危机时过滤掉纯正面事件（不含 '抉择' 的纯 '正'）
 * - 其他状态不过滤
 */
export function filterEventsByState(
  events: readonly CourtEvent[],
  nationState: NationState,
): readonly CourtEvent[] {
  if (nationState === 'peaceful') return filterExcluding(events, PEACEFUL_BLOCKED);
  if (nationState === 'crisis') return filterExcluding(events, CRISIS_BLOCKED);
  return events;
}
