/**
 * NPC 动态成长（纯函数，无副作用）——把静态齐晋鲁变成有生命的外部张力（设计稿钩子3）。
 *
 * 三条主轴：
 *   - 军力随时间成长（archetype 决定速率）
 *   - 玩家强 → NPC 合纵结盟围攻；玩家弱 → NPC 互相攻伐 / 骚扰
 *   - 蛮夷(tribal) 任何阶段都可能南下骚扰，且永不结盟
 *
 * 纯函数只产出"意图 + delta 描述"，资源/state 结算与发事件在 gameStore（runNpcDynamicsTick）。
 */

import type { NpcArchetype, NpcCountryDef, NpcCountryState } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';

// ---- 常量（初版锚点，待 playtest）----
/** 军力成长间隔（游戏日），每到点按 archetype 加一档 */
export const NPC_MP_GROWTH_INTERVAL = 30;
/** 军力上限 */
export const NPC_MP_CAP = 220;
/** NPC 主动行动冷却（日），防刷屏 */
export const NPC_ACTION_COOLDOWN = 24;
/** 单日对玩家的敌对行动（骚扰/围攻）上限——防多邦同日齐揍堆成不公平爆击（DeepSeek 复审采纳） */
export const MAX_PLAYER_HOSTILE_PER_DAY = 2;

export type PlayerStrengthTier = 'weak' | 'balanced' | 'strong';

export interface PlayerStrengthInput {
  grade: number;          // 0..5
  militaryPower: number;
  renown: number;
  population: number;
}

/** archetype → 每个成长间隔的军力增量 */
export function npcMilitaryGrowthStep(archetype: NpcArchetype): number {
  switch (archetype) {
    case 'martial': return 4;
    case 'tribal': return 3;
    case 'cultural': return 2;
    case 'commercial': return 1;
    default: return 2;
  }
}

/**
 * 综合 grade/军力/信誉/人口 给玩家强弱分档（NPC 据此决定结盟/骚扰策略）。
 * 用加权分：grade 权重最高（它已是综合里程碑），再叠军力/信誉/人口的档。
 */
export function evaluatePlayerStrength(input: PlayerStrengthInput): PlayerStrengthTier {
  let score = 0;
  score += input.grade * 2;                          // 0..10
  score += input.militaryPower >= 120 ? 3 : input.militaryPower >= 60 ? 1 : 0;
  score += input.renown >= 80 ? 2 : input.renown >= 50 ? 1 : 0;
  score += input.population >= 150 ? 2 : input.population >= 60 ? 1 : 0;
  if (score >= 9) return 'strong';
  if (score >= 4) return 'balanced';
  return 'weak';
}

/** 结盟评估结果：每个 npc id → 新盟友 id 列表（替换式）。 */
export type AlliancePatch = Record<string, string[]>;

/**
 * 玩家 strong 时，敌对（stance<0）的非蛮夷 NPC 倾向合纵：两两结盟围攻。
 * tribal 永不入盟。返回需要更新 allyIds 的 patch（互相填对方）。
 * 玩家非 strong 时联盟自然瓦解（返回把所有人 allyIds 清空的 patch）。
 */
export function computeNpcAlliances(
  states: readonly NpcCountryState[],
  defOf: (id: string) => NpcCountryDef | undefined,
  tier: PlayerStrengthTier,
  rng: () => number,
): AlliancePatch {
  const patch: AlliancePatch = {};
  if (tier !== 'strong') {
    // 非威胁阶段：解散现有联盟
    for (const s of states) if (s.allyIds.length > 0) patch[s.id] = [];
    return patch;
  }
  // 候选：非 tribal 且对玩家 stance<0
  const candidates = states.filter(s => {
    const d = defOf(s.id);
    return d && d.archetype !== 'tribal' && s.stance < 0;
  });
  // 两两以概率结盟（确定性 rng）
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i]!; const b = candidates[j]!;
      if (a.allyIds.includes(b.id)) continue;
      if (rng() < 0.5) {
        patch[a.id] = [...(patch[a.id] ?? a.allyIds), b.id];
        patch[b.id] = [...(patch[b.id] ?? b.allyIds), a.id];
      }
    }
  }
  return patch;
}

export type NpcActionKind = 'harass_player' | 'assault_player' | 'npc_vs_npc' | 'idle';

export interface NpcAction {
  kind: NpcActionKind;
  actorId: string;
  targetId?: string;                 // npc_vs_npc 的被打方
  /** 对玩家：劫掠的资源（负值） */
  resourceRaid?: Partial<Record<ResourceId, number>>;
  /** 对玩家军力的冲击（负值） */
  playerMilitaryDelta?: number;
  /** 对玩家民心的冲击（负值） */
  playerMoraleDelta?: number;
  /** A1：对玩家怨愤的冲击（正值 = 民怨积压） */
  playerWrathDelta?: number;
  /** npc_vs_npc：被打方军力损失（负值，结算时夹 ≥10） */
  targetMilitaryDelta?: number;
  /** 半文半白通告文案（gameStore 拼 actor 名后发 Toast/事件） */
  summary: string;
}

/**
 * 计算本次 NPC 主动行动（每个 NPC 至多一条，受 lastActionDay 冷却节流）。
 * - tribal：任何阶段按 aggression 概率南下骚扰（劫资源 + 轻挫军力）。
 * - 玩家 strong + 该 NPC 有盟友：联军压境 assault（重挫军力/民心）。
 * - 玩家 weak：强 NPC 攻伐弱 NPC（npc_vs_npc）。
 * - 其余：idle。
 */
export function computeNpcActions(
  states: readonly NpcCountryState[],
  defOf: (id: string) => NpcCountryDef | undefined,
  tier: PlayerStrengthTier,
  currentDay: number,
  rng: () => number,
): NpcAction[] {
  const actions: NpcAction[] = [];
  let hostileCount = 0; // 当日对玩家敌对行动计数（上限保护）
  for (const s of states) {
    const d = defOf(s.id);
    if (!d) continue;
    // 冷却节流
    if (s.lastActionDay >= 0 && currentDay - s.lastActionDay < NPC_ACTION_COOLDOWN) continue;
    const aggr = s.aggression / 100;

    if (d.archetype === 'tribal') {
      if (hostileCount < MAX_PLAYER_HOSTILE_PER_DAY && rng() < 0.15 + aggr * 0.25) {
        actions.push({
          kind: 'harass_player', actorId: s.id,
          resourceRaid: { grain: -8, gold: -6 },
          playerMilitaryDelta: -3,
          playerWrathDelta: 6,
          summary: '南下犯边，掠民劫粮',
        });
        hostileCount++;
      }
      continue; // 蛮夷不参与结盟/内斗
    }

    if (tier === 'strong' && s.allyIds.length > 0 && s.stance < 0) {
      if (hostileCount < MAX_PLAYER_HOSTILE_PER_DAY && rng() < 0.2 + aggr * 0.2) {
        actions.push({
          kind: 'assault_player', actorId: s.id,
          playerMilitaryDelta: -10, playerMoraleDelta: -8,
          playerWrathDelta: 10,
          resourceRaid: { gold: -10 },
          summary: '合纵列邦，兴兵压境',
        });
        hostileCount++;
      }
      continue;
    }

    if (tier === 'weak') {
      // 攻伐一个比自己弱的非 tribal NPC
      const prey = states.find(t => t.id !== s.id && defOf(t.id)?.archetype !== 'tribal'
        && t.militaryPower < s.militaryPower * 0.8);
      if (prey && rng() < 0.12 + aggr * 0.2) {
        actions.push({
          kind: 'npc_vs_npc', actorId: s.id, targetId: prey.id,
          targetMilitaryDelta: -Math.round(prey.militaryPower * 0.2),
          summary: `兴兵伐${''}`, // gameStore 拼"actor 伐 target"
        });
      }
      continue;
    }
    // balanced 阶段大体安宁
  }
  return actions;
}
