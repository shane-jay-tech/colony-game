/**
 * C2 终局危机升级「八方来朝」（Stellaris 终局危机 → 春秋开放终局）。
 * 登顶天下共主后每 20 日一波随机压力（天灾/合纵/来犯），烈度随持续天数三阶递增；
 * 每扛过一波给「盛名」小额信誉——给开放式终局一个持续心跳，不设强制结束。
 */

export const ENDGAME_WAVE_INTERVAL_DAYS = 20;
export const ENDGAME_WAVE_KINDS = ['disaster', 'coalition', 'invasion'] as const;
export type EndgameWaveKind = typeof ENDGAME_WAVE_KINDS[number];

export interface EndgameWave {
  kind: EndgameWaveKind;
  severity: 1 | 2 | 3;
  text: string;
}

/** 登顶持续越久，波次越烈（每 240 日升一阶，封顶 3）。 */
export function endgameSeverity(daysSinceAscend: number): 1 | 2 | 3 {
  const days = Math.max(0, Math.floor(daysSinceAscend));
  return Math.min(3, 1 + Math.floor(days / 240)) as 1 | 2 | 3;
}

/** 是否到点放一波（登顶后首个间隔满即放，此后按固定间隔）。 */
export function shouldFireEndgameWave(
  currentDay: number,
  lastWaveDay: number | null,
  daysSinceAscend: number,
): boolean {
  if (daysSinceAscend < ENDGAME_WAVE_INTERVAL_DAYS) return false;
  if (lastWaveDay === null) return daysSinceAscend >= ENDGAME_WAVE_INTERVAL_DAYS;
  return currentDay - lastWaveDay >= ENDGAME_WAVE_INTERVAL_DAYS;
}

const KIND_TEXT: Record<EndgameWaveKind, string> = {
  disaster: '天灾骤降，禾稼伤损。',
  coalition: '列国合纵，环伺压境。',
  invasion: '四方来犯，边烽告急。',
};

export function pickEndgameWave(kindIdx: number, severity: 1 | 2 | 3): EndgameWave {
  const kind = ENDGAME_WAVE_KINDS[kindIdx % ENDGAME_WAVE_KINDS.length]!;
  return { kind, severity, text: KIND_TEXT[kind] };
}
