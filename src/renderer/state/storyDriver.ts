/**
 * StoryDriver（故事导演层 · 纯函数，无副作用）—— §8.1 插件式挂在 Simulation 之上。
 *
 * 只负责：序章统一胜利判定 + 隐性双轴累积辅助 + 章节推进判定。
 * 不触碰沙盒逻辑（gameStore 仅 mode==='story' 时调用）。具体内容/结局兑现 = Phase 3。
 */

/** 双轴钳制到 -100..100 */
export function clampAxis(v: number): number {
  return Math.max(-100, Math.min(100, v));
}

// ---- 序章多途径统一（S.6）----

/** 武途：NPC 军力被打到此值及以下视为"被打服/吞并" */
export const SUBJUGATE_MP_THRESHOLD = 20;
/** 文途：会盟感召所需玩家信誉阈值 */
export const UNIFY_RENOWN_THRESHOLD = 120;
/** 文途：归附所需 NPC stance（盟友档） */
export const ALLY_STANCE_THRESHOLD = 60;

export interface UnificationNpc {
  militaryPower: number;
  stance: number;
}
export interface UnificationInput {
  npcs: readonly UnificationNpc[];
  playerRenown: number;
}

export type UnifyPath = 'martial' | 'cultural';
export interface UnifyResult {
  unified: boolean;
  path: UnifyPath | null;
}

/**
 * 序章统一判定（多途径，任一达成即统一）：
 *   - 武途·征服：所有 NPC 军力 ≤ SUBJUGATE_MP_THRESHOLD（被打服）。
 *   - 文途·会盟：玩家信誉 ≥ 阈值 且 多数（≥⌈n×0.6⌉）NPC stance ≥ 盟友档。
 * 无 NPC（空列表）不算统一（无人可统）。武途优先级判定在前（兵戎为先决）。
 */
export function checkUnification(input: UnificationInput): UnifyResult {
  const n = input.npcs.length;
  if (n === 0) return { unified: false, path: null };

  const allSubjugated = input.npcs.every(npc => npc.militaryPower <= SUBJUGATE_MP_THRESHOLD);
  if (allSubjugated) return { unified: true, path: 'martial' };

  const allied = input.npcs.filter(npc => npc.stance >= ALLY_STANCE_THRESHOLD).length;
  const majority = Math.ceil(n * 0.6);
  if (input.playerRenown >= UNIFY_RENOWN_THRESHOLD && allied >= majority) {
    return { unified: true, path: 'cultural' };
  }
  return { unified: false, path: null };
}

/**
 * 统一途径给隐性双轴的初始倾向种子（S.6）：
 *   武途→偏集权（权力轴负）；文途→偏还权（权力轴正）。生产资料轴起始中立。
 */
export function axisSeedForPath(path: UnifyPath): { power: number; resource: number } {
  return path === 'martial'
    ? { power: -20, resource: 0 }
    : { power: 20, resource: 0 };
}

// ---- 隐性双轴档位（半可视化氛围反馈用）----

export type AxisBand = 'centralize' | 'neutral' | 'devolve';
/** 权力轴落档：用于触发史官评语（跨档时报一句）。 */
export function powerBand(v: number): AxisBand {
  if (v <= -34) return 'centralize';
  if (v >= 34) return 'devolve';
  return 'neutral';
}
export type ResourceBand = 'private' | 'neutral' | 'public';
export function resourceBand(v: number): ResourceBand {
  if (v <= -34) return 'private';
  if (v >= 34) return 'public';
  return 'neutral';
}

// ---- 三结局判定（终章兑现）----

/** 架空名结局（禁现实政治词；公=社会主义大同 / 家=封建固守 / 货=资本异化）。 */
export type EndingId = 'gong' | 'jia' | 'huo';

/**
 * 双轴落区域 → 三结局（D2 架空名）：
 *   还权 + 公有 → 公天下（撤龙椅·大同）
 *   集权（不论资料）→ 家天下（权位当家业，停滞循环）
 *   其余（还权/中立 + 私有/中立）→ 货天下（天下为货，富强而异化）
 */
export function checkEnding(powerAxis: number, resourceAxis: number): EndingId {
  const p = powerBand(powerAxis);
  const r = resourceBand(resourceAxis);
  if (p === 'devolve' && r === 'public') return 'gong';
  if (p === 'centralize') return 'jia';
  return 'huo';
}
