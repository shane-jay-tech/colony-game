/**
 * P2 目标感 · 通牒压力系统（对标冰汽时代「最后通牒」）：纯逻辑层。
 *
 * 怨愤 ≥ 阈值 → 限期通牒（Frostpunk 式倒计时而非瞬间判死）：
 *   - 期限内把怨愤压回安全线 → 通牒解除（人心可挽回）；
 *   - 到期仍高企 → 民变爆发（掉人口、挫士气），怨愤重置——压力变成「看得见的倒计时」。
 * 阈值/天数/回收线全部在此定义，便于单测与平衡调参（初版锚点待 playtest 校准）。
 */

/** 怨愤 ≥ 此值触发通牒 */
export const ULTIMATUM_WRATH_THRESHOLD = 85;
/** 通牒倒计时（游戏日） */
export const ULTIMATUM_DAYS = 10;
/** 通牒期间怨愤回落到此值即解除 */
export const ULTIMATUM_RECOVER_WRATH = 55;
/** 民变爆发后怨愤重置值（怨气发泄过了，回到警戒线下） */
export const ULTIMATUM_EXPLOSION_WRATH_RESET = 60;

/** 是否应触发通牒：怨愤够高且当前没有进行中的通牒。 */
export function shouldStartUltimatum(wrath: number, endDay: number | null): boolean {
  return endDay === null && wrath >= ULTIMATUM_WRATH_THRESHOLD;
}

/** 是否应解除通牒：怨愤已压回安全线以下。 */
export function shouldLiftUltimatum(wrath: number, endDay: number | null): boolean {
  return endDay !== null && wrath <= ULTIMATUM_RECOVER_WRATH;
}

/** 是否已到期爆发：当前日越过期限仍居高不下。 */
export function shouldExplodeUltimatum(currentDay: number, endDay: number | null): boolean {
  return endDay !== null && currentDay >= endDay;
}

/** 剩余天数（HUD 倒计时显示用；未激活返回 0）。 */
export function ultimatumDaysLeft(currentDay: number, endDay: number | null): number {
  if (endDay === null) return 0;
  return Math.max(0, endDay - currentDay);
}
