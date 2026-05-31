/**
 * DiplomacySystem (v1.0 #6) — 玩家对 NPC 邦国采取的三类动作。
 *
 * Pure functions：拿到当前 NpcCountryState + cost + RNG，返回 result + state delta。
 * GameStore 收到 result 后：扣资源 / 改 state / 发事件 / refresh UI。
 *
 * 三类动作：
 *   - trade（通商）：一次性 50 gold + 2 cloth，开通后每 30 日自动入 +20 gold +3 cloth
 *   - envoy（出使）：30 gold + 5 cloth，stance +20、player_renown +5、cooldown 30 日
 *   - war（兴师）：消耗军力，胜率取决于双方 militaryPower 比；胜 → +50 gold +10 renown +NPC.renown × 0.2 战利品
 *                   败 → -20 morale -15 player_militaryPower
 *
 * 反垃圾机制：每 NPC 每 14 日只能再次对其执行 envoy / war；trade 只能一次开通。
 */

import type { NpcCountryDef, NpcCountryState } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';

export type DiplomacyFailReason =
  | 'unknown_npc'
  | 'insufficient_resources'
  | 'on_cooldown'
  | 'already_at_war'
  | 'already_trading'
  | 'insufficient_military';

/** 通用结果：成功带 state patch + resource deltas + 描述；失败带原因 */
export type DiplomacyResult =
  | {
      ok: true;
      stateDelta: Partial<NpcCountryState>;
      resourceDeltas: Partial<Record<ResourceId, number>>;
      /** 玩家国家级 metric 改动（player_renown / player_morale / player_military_power） */
      playerDeltas: { renown?: number; morale?: number; militaryPower?: number };
      message: string;
    }
  | { ok: false; reason: DiplomacyFailReason; details?: string };

const ENVOY_COOLDOWN_DAYS = 14;
const WAR_COOLDOWN_DAYS = 30;
const TRADE_TICK_DAYS = 30;

// ====================== Trade（通商） =====================================

export function tryTrade(
  npcDef: NpcCountryDef,
  npcState: NpcCountryState,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): DiplomacyResult {
  if (npcState.warStatus === 'war') {
    return { ok: false, reason: 'already_at_war' };
  }
  if (npcState.tradeRoute) {
    return { ok: false, reason: 'already_trading' };
  }
  const goldCost = 50;
  const clothCost = 2;
  const goldHave = resources.gold ?? 0;
  const clothHave = resources.cloth ?? 0;
  if (goldHave < goldCost || clothHave < clothCost) {
    return { ok: false, reason: 'insufficient_resources' };
  }
  return {
    ok: true,
    stateDelta: { tradeRoute: true, tradeCooldown: TRADE_TICK_DAYS, stance: clamp(npcState.stance + 5) },
    resourceDeltas: { gold: -goldCost, cloth: -clothCost },
    playerDeltas: { renown: 2 },
    message: `与「${npcDef.name}」开通商路：每 30 日得钱与布；好感 +5。`,
  };
}

/**
 * Daily trade tick：当 tradeRoute=true 且 cooldown 归 0，发放本期收益。
 * archetype=commercial 给加成。返回 patch；调用方在 day tick 里 batch apply。
 */
export function computeTradeTick(
  npcDef: NpcCountryDef,
  npcState: NpcCountryState,
): {
  resourceDeltas: Partial<Record<ResourceId, number>>;
  stateDelta: Partial<NpcCountryState>;
} {
  if (!npcState.tradeRoute || npcState.warStatus === 'war') {
    return { resourceDeltas: {}, stateDelta: {} };
  }
  if (npcState.tradeCooldown > 0) {
    return { resourceDeltas: {}, stateDelta: { tradeCooldown: npcState.tradeCooldown - 1 } };
  }
  // cooldown 归 0：发放
  const baseGold = 20;
  const baseCloth = 3;
  const mul = npcDef.archetype === 'commercial' ? 1.5 : 1.0;
  return {
    resourceDeltas: {
      gold: Math.round(baseGold * mul),
      cloth: Math.round(baseCloth * mul),
    },
    stateDelta: { tradeCooldown: TRADE_TICK_DAYS },
  };
}

// ====================== Envoy（出使） =====================================

export function trySendEnvoy(
  npcDef: NpcCountryDef,
  npcState: NpcCountryState,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  currentDay: number,
): DiplomacyResult {
  if (npcState.warStatus === 'war') {
    return { ok: false, reason: 'already_at_war' };
  }
  // 14 日冷却
  if (npcState.lastActionDay >= 0 && currentDay - npcState.lastActionDay < ENVOY_COOLDOWN_DAYS) {
    return {
      ok: false,
      reason: 'on_cooldown',
      details: `下次出使需等 ${ENVOY_COOLDOWN_DAYS - (currentDay - npcState.lastActionDay)} 日`,
    };
  }
  const goldCost = 30;
  const clothCost = 5;
  const goldHave = resources.gold ?? 0;
  const clothHave = resources.cloth ?? 0;
  if (goldHave < goldCost || clothHave < clothCost) {
    return { ok: false, reason: 'insufficient_resources' };
  }
  // 文化邦（鲁）外交受效益高；武邦（晋）受效益低
  const stanceGain = npcDef.archetype === 'cultural' ? 25 : npcDef.archetype === 'martial' ? 12 : 18;
  return {
    ok: true,
    stateDelta: {
      stance: clamp(npcState.stance + stanceGain),
      lastActionDay: currentDay,
    },
    resourceDeltas: { gold: -goldCost, cloth: -clothCost },
    playerDeltas: { renown: 5 },
    message: `使节出访「${npcDef.name}」：好感 +${stanceGain}、信誉 +5。`,
  };
}

// ====================== War（兴师） =======================================

/**
 * 兴师攻打。胜率 = playerMP / (playerMP + npcMP)，archetype=martial 的 NPC 享 +0.10 防御加成。
 * 输入 rng（0..1 random）便于测试可重放。
 */
export function tryDeclareWar(
  npcDef: NpcCountryDef,
  npcState: NpcCountryState,
  playerMilitaryPower: number,
  currentDay: number,
  rng: () => number,
): DiplomacyResult {
  if (npcState.warStatus === 'war') {
    return { ok: false, reason: 'already_at_war' };
  }
  // 30 日冷却（war 比 envoy 长）
  if (npcState.lastActionDay >= 0 && currentDay - npcState.lastActionDay < WAR_COOLDOWN_DAYS) {
    return { ok: false, reason: 'on_cooldown' };
  }
  // 至少要 NPC 军力一半才能开战（否则就是送菜）
  if (playerMilitaryPower < npcState.militaryPower * 0.5) {
    return { ok: false, reason: 'insufficient_military' };
  }
  let winChance = playerMilitaryPower / (playerMilitaryPower + npcState.militaryPower);
  if (npcDef.archetype === 'martial') winChance -= 0.10;
  winChance = Math.max(0.05, Math.min(0.95, winChance));
  const roll = rng();
  const win = roll < winChance;
  if (win) {
    // 胜：掠夺资源，玩家信誉提升，NPC 军力减半 stance 暴跌
    const loot = 50 + Math.round(npcState.renown * 0.2);
    return {
      ok: true,
      stateDelta: {
        stance: -80,
        militaryPower: Math.max(10, Math.round(npcState.militaryPower * 0.5)),
        renown: Math.max(5, npcState.renown - 15),
        warStatus: 'peace',
        lastActionDay: currentDay,
      },
      resourceDeltas: { gold: loot, bronze: 5 },
      playerDeltas: { renown: 10 },
      message: `兴师伐「${npcDef.name}」：克敌制胜，掠 ${loot} 钱、5 铜，信誉 +10。`,
    };
  } else {
    // 败：玩家军力跌、士气挫
    return {
      ok: true,
      stateDelta: {
        stance: -90,
        warStatus: 'tension',
        lastActionDay: currentDay,
      },
      resourceDeltas: {},
      playerDeltas: { morale: -20, militaryPower: -15, renown: -5 },
      message: `兴师伐「${npcDef.name}」：兵败而归，军力 -15、士气 -20、信誉 -5。`,
    };
  }
}

// ====================== Daily stance drift ================================

/**
 * 每日 stance 漂移：
 *   - 玩家 renown ≥ NPC.renown → 漂向友好（+1/14 日）
 *   - 否则 → 漂向中立（向 0 拉近）
 *   - 武邦（晋）抗漂移幅度减半
 */
export function computeStanceDrift(
  npcDef: NpcCountryDef,
  npcState: NpcCountryState,
  playerRenown: number,
): number {
  if (npcState.warStatus === 'war') return 0;
  let drift = 0;
  if (playerRenown >= npcState.renown) {
    drift = 1;
  } else if (npcState.stance > 0) {
    drift = -1;
  } else if (npcState.stance < 0) {
    drift = 1;
  }
  if (npcDef.archetype === 'martial') drift = Math.round(drift / 2);
  return drift;
}

// ====================== Helpers ===========================================

function clamp(v: number, min = -100, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export function stanceLabel(stance: number): string {
  if (stance >= 60) return '盟友';
  if (stance >= 20) return '友好';
  if (stance >= -20) return '中立';
  if (stance >= -60) return '冷淡';
  return '敌对';
}
