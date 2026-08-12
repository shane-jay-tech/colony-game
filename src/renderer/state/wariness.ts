/**
 * B1 列国警惕值「天下侧目」（HOI4 世界紧张度）。
 *
 * 0..100 全局张力：扩军/称霸/宣战升，通商/出使降，太平日子每日向基线回落。
 * 阈值闸门：≥70 时即使玩家非「强」档，NPC 也按强档逻辑合纵——让「被打之前」变得可读。
 */

export const WARINESS_BASELINE = 20;
export const WARINESS_DRIFT_PER_DAY = 1;
/** 超过此值触发列国合纵（视为强档威胁） */
export const WARINESS_COALITION_THRESHOLD = 70;

export const WARINESS_DELTAS = {
  declareWar: 10,
  gradeAscend: 8,
  peaceAction: -2,
} as const;

export interface WarinessBand {
  key: 'calm' | 'watch' | 'wary' | 'hostile';
  text: string;
}

export function warinessBand(value: number): WarinessBand {
  if (value < 30) return { key: 'calm', text: '列国漠然' };
  if (value < 55) return { key: 'watch', text: '列国侧目' };
  if (value < WARINESS_COALITION_THRESHOLD) return { key: 'wary', text: '诸侯警惕' };
  return { key: 'hostile', text: '同仇敌忾' };
}

export function clampWariness(value: number): number {
  if (!Number.isFinite(value)) return WARINESS_BASELINE;
  return Math.max(0, Math.min(100, Math.floor(value)));
}
