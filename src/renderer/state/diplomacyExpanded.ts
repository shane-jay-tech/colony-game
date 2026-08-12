/**
 * B-3 扩展外交操作 + NPC AI 决策（纯函数）。
 * 在 v1.0 的 trade/envoy/war 基础上新增：
 * - tribute（朝贡）：我弱→示弱止战，每季缴金5粮10
 * - tradeAgreement（贸易协定）：双方+3金/日，60天
 * - marriage（联姻）：关系+50锁定120天
 * - alliance（结盟）：被攻击时盟友援兵
 * - provoke（挑拨）：花金/信誉让两NPC关系-40
 * - deter 已在 militarySystem 中实现
 *
 * NPC AI: 每30天决策一次（简单规则）。
 * NPC 军力公式: national_power × 0.4 × personality_mul，每30天成长。
 */

import type { NpcCountryState, NpcArchetype } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';
import type { RngHandle } from './rng';

export type ExpandedDiploAction = 'tribute' | 'trade_agreement' | 'marriage' | 'alliance' | 'provoke';

export interface ExpandedDiploResult {
  ok: boolean;
  reason?: string;
  resourceDeltas?: Partial<Record<ResourceId, number>>;
  npcStateDelta?: Partial<NpcCountryState>;
  secondNpcId?: string;
  secondNpcStanceDelta?: number;
  message?: string;
}

// ====================== Config Constants ===================================

export const TRIBUTE_CONFIG = {
  goldPerSeason: 5,
  grainPerSeason: 10,
  durationSeasons: 5,
  minMilitaryRatio: 1.3,
  stanceBonus: 30,
} as const;

export const TRADE_AGREEMENT_CONFIG = {
  minStance: 0,
  goldPerDay: 3,
  durationDays: 60,
} as const;

export const MARRIAGE_CONFIG = {
  stanceRequired: 30,
  riteCost: 10,
  stanceBonus: 50,
  durationDays: 120,
} as const;

export const ALLIANCE_CONFIG = {
  stanceRequired: 50,
  reinforcementMul: 0.3,
} as const;

export const PROVOKE_CONFIG = {
  goldCost: 20,
  renownCost: 10,
  stanceDelta: -40,
} as const;

// ====================== NPC Military Growth ================================

export const PERSONALITY_MUL: Record<NpcArchetype, number> = {
  martial: 1.3,
  commercial: 0.8,
  cultural: 0.9,
  tribal: 1.1,
};

export function computeNpcMilitary(nationalPower: number, archetype: NpcArchetype): number {
  return Math.round(nationalPower * 0.4 * PERSONALITY_MUL[archetype]);
}

export function tickNpcGrowth(
  nationalPower: number,
  currentDay: number,
): number {
  return nationalPower + 2 * (1 + currentDay / 360);
}

// ====================== Expanded Operations ================================

export function tryTribute(
  npcState: NpcCountryState,
  playerMilitary: number,
): ExpandedDiploResult {
  if (npcState.militaryPower < playerMilitary * TRIBUTE_CONFIG.minMilitaryRatio) {
    return { ok: false, reason: 'npc_too_weak' };
  }
  return {
    ok: true,
    npcStateDelta: {
      stance: Math.min(100, npcState.stance + TRIBUTE_CONFIG.stanceBonus),
    },
    message: '向其朝贡，换取暂安。每季缴金五、粮十。',
  };
}

export function tryTradeAgreement(
  npcState: NpcCountryState,
): ExpandedDiploResult {
  if (npcState.stance < TRADE_AGREEMENT_CONFIG.minStance) {
    return { ok: false, reason: 'stance_too_low' };
  }
  if (npcState.warStatus === 'war') {
    return { ok: false, reason: 'at_war' };
  }
  return {
    ok: true,
    message: '缔结贸易协定，双方互通有无。每日各得三金。',
  };
}

export function tryMarriage(
  npcState: NpcCountryState,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): ExpandedDiploResult {
  if (npcState.stance < MARRIAGE_CONFIG.stanceRequired) {
    return { ok: false, reason: 'stance_too_low' };
  }
  const rite = resources.rite ?? 0;
  if (rite < MARRIAGE_CONFIG.riteCost) {
    return { ok: false, reason: 'insufficient_rite' };
  }
  return {
    ok: true,
    resourceDeltas: { rite: -MARRIAGE_CONFIG.riteCost },
    npcStateDelta: {
      stance: Math.min(100, npcState.stance + MARRIAGE_CONFIG.stanceBonus),
    },
    message: '联姻结好，邦交益固。',
  };
}

export function tryAlliance(
  npcState: NpcCountryState,
): ExpandedDiploResult {
  if (npcState.stance < ALLIANCE_CONFIG.stanceRequired) {
    return { ok: false, reason: 'stance_too_low' };
  }
  return {
    ok: true,
    message: '结为盟邦，共御外敌。',
  };
}

export function tryProvoke(
  targetNpcId: string,
  secondNpcId: string,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  playerRenown: number,
): ExpandedDiploResult {
  if (targetNpcId === secondNpcId) {
    return { ok: false, reason: 'same_target' };
  }
  const gold = resources.gold ?? 0;
  if (gold < PROVOKE_CONFIG.goldCost) {
    return { ok: false, reason: 'insufficient_gold' };
  }
  if (playerRenown < PROVOKE_CONFIG.renownCost) {
    return { ok: false, reason: 'insufficient_renown' };
  }
  return {
    ok: true,
    resourceDeltas: { gold: -PROVOKE_CONFIG.goldCost },
    secondNpcId,
    secondNpcStanceDelta: PROVOKE_CONFIG.stanceDelta,
    message: '挑拨离间，使两邦反目。',
  };
}

// ====================== NPC AI Decision ====================================

export interface NpcDecision {
  kind: 'attack' | 'seek_trade' | 'seek_alliance' | 'unite_against';
  targetId?: string;
  daysUntilExecution?: number;
}

/**
 * NPC AI 每30天决策一次（B-3.4 规则）。
 * 用 RNG 而非 Math.random()，保证可测 + 种子一致。
 */
export function computeNpcDecision(
  npcState: NpcCountryState,
  playerMilitary: number,
  otherNpcs: readonly NpcCountryState[],
  currentDay: number,
  rng: RngHandle,
): NpcDecision | null {
  if (npcState.lastActionDay >= 0 && currentDay - npcState.lastActionDay < 30) return null;

  // 玩家弱 + 关系差 → 攻击
  if (playerMilitary < npcState.militaryPower * 0.7 && npcState.stance < -20) {
    return { kind: 'attack', daysUntilExecution: 5 + rng.nextInt(0, 5) };
  }

  // 玩家强 → 寻求贸易
  if (playerMilitary > npcState.militaryPower * 2) {
    return { kind: 'seek_trade' };
  }

  // 被威胁 → 向玩家求盟
  const dominant = otherNpcs.find(n => n.militaryPower > npcState.militaryPower * 1.5);
  if (dominant) {
    return { kind: 'seek_alliance' };
  }

  // 均势被打破 → 联合对抗强者
  if (otherNpcs.length > 0) {
    const strongest = otherNpcs.reduce((max, n) => n.militaryPower > max.militaryPower ? n : max, otherNpcs[0]!);
    if (strongest.militaryPower > npcState.militaryPower * 1.3) {
      return { kind: 'unite_against', targetId: strongest.id };
    }
  }

  return null;
}
