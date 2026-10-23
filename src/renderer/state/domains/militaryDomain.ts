/**
 * 域三：军事/外交域逻辑（gameStore 拆分批 3/5 · c1023-03 外迁件）。
 *
 * 拆分约束（done/c1011-13 存档兼容面）：「拆逻辑不拆 GameState 容器；字段全集零增删改」——
 * 本模块只收军力派生 / 兵员可用数 / 守土选型 / 邦交日tick聚合 / NPC 数据钳制 /
 * 邦交 modifier·警惕值映射等**纯计算**；addResource / adjustMorale / adjustWariness /
 * emit 等副作用仍归 GameStore（薄委托）。公式逐字搬运，零数值行为变更。
 */
import type { ResourceId } from '../../data/resourceRegistry';
import type { BuildingInstance, ModifierInstance, NpcCountryState } from '../../data/schema';
import type { ActiveExpedition, UnitType } from '../../data/military';
import { UNIT_DEFS } from '../../data/military';
import type { GeneralState } from '../../data/generals';
import { getGeneralDef } from '../generalSystem';
import { getAvailableUnitTypes, type MilitaryContext } from '../militarySystem';
import { computeTradeTick, computeStanceDrift } from '../diplomacySystem';
import { getNpcDef } from '../../data/npcCountries';
import { applyModifiers } from '../modifierAggregator';
import { WARINESS_DELTAS } from '../wariness';

/** 可调遣的兵 = 兵阶层 − 已在出征中的兵（防重复派同一批）（原 availableSoldiers 主体）。 */
export function availableSoldiersOf(
  soldierClass: number,
  activeExpeditions: readonly ActiveExpedition[],
): number {
  const onExpedition = activeExpeditions.reduce(
    (s, e) => s + Object.values(e.config.units).reduce((a, n) => a + (n ?? 0), 0), 0);
  return Math.max(0, soldierClass - onExpedition);
}

/**
 * 常备军力：基础征召 + 兵阶层×可用最强兵种攻击×最强将领指挥，再经 country_military_power modifier
 * （原 computeCurrentMilitaryPower 主体，逐字搬运）。让"兵阶层 + 军事建筑 + 将领"真正驱动军力。
 * soldierClassCount 用兵阶层原值（与 militaryCtx.soldierCount 的"扣出征可用数"是两个口径，与原实现一致）。
 */
export function militaryPowerOf(
  soldierClassCount: number,
  ctx: MilitaryContext,
  generals: readonly GeneralState[],
  activeModifiers: readonly ModifierInstance[],
): number {
  const available = getAvailableUnitTypes(ctx);
  const bestAtk = available.length
    ? Math.max(...available.map(u => UNIT_DEFS[u].attack))
    : UNIT_DEFS.militia.attack;
  const bestCmd = generals.reduce((m, g) => Math.max(m, getGeneralDef(g.id)?.command ?? 0), 0);
  const raw = 20 + soldierClassCount * bestAtk * (1 + bestCmd / 100); // 20=无常备兵时的乡勇守土基数
  return Math.round(applyModifiers(raw, 'country_military_power', activeModifiers));
}

/** 守军以"现有最强可用兵种"列阵（而非恒按民兵），让练兵场/马厩等防御也增益（原 resolveIncomingAttack 内选型段）。 */
export function bestDefenseUnit(ctx: MilitaryContext): UnitType {
  const available = getAvailableUnitTypes(ctx);
  return available.length
    ? available.reduce((a, b) => (UNIT_DEFS[b].defense > UNIT_DEFS[a].defense ? b : a))
    : 'militia';
}

export interface DiplomacyDayTickOutcome {
  deltas: Partial<Record<ResourceId, number>>;
  tradeIncomeFired: boolean;
}

/**
 * 每日：通商节拍 + stance 漂移（原 runDiplomacyTick 主体，逐字搬运）。
 * 直接改写传入的 npcCountries（与原 this.state.npcCountries 同址）；
 * 资源聚合增量经 outcome 返回，TRADE_TICK 事件与 applyDayDeltas 副作用仍归 GameStore。
 */
export function diplomacyDayTick(npcCountries: NpcCountryState[], playerRenown: number): DiplomacyDayTickOutcome {
  const aggregateDeltas: Partial<Record<ResourceId, number>> = {};
  let tradeIncomeFired = false;
  for (const npcState of npcCountries) {
    const def = getNpcDef(npcState.id);
    if (!def) continue;
    // 通商
    const tick = computeTradeTick(def, npcState);
    Object.assign(npcState, tick.stateDelta);
    for (const [k, v] of Object.entries(tick.resourceDeltas) as [ResourceId, number | undefined][]) {
      if (v === undefined || v === 0) continue;
      aggregateDeltas[k] = (aggregateDeltas[k] ?? 0) + v;
      tradeIncomeFired = true;
    }
    // stance 漂移
    const drift = computeStanceDrift(def, npcState, playerRenown);
    if (drift !== 0) {
      npcState.stance = Math.max(-100, Math.min(100, npcState.stance + drift));
    }
  }
  return { deltas: aggregateDeltas, tradeIncomeFired };
}

/** 邦交结算后 NPC 数据钳制：stance/militaryPower/renown 防溢出（原 applyDiplomacyResult 钳制段）。 */
export function clampNpcVitals(npcState: NpcCountryState): void {
  npcState.stance = Math.max(-100, Math.min(100, npcState.stance));
  npcState.militaryPower = Math.max(0, Math.min(500, npcState.militaryPower));
  npcState.renown = Math.max(0, Math.min(200, npcState.renown));
}

/** 邦交产生的临时声望 modifier（原 applyDiplomacyResult 内联工厂，逐字搬运）。 */
export function diplomacyRenownModifier(
  kind: 'trade' | 'envoy' | 'war',
  npcId: string,
  currentDay: number,
  renownDelta: number,
  message: string,
): ModifierInstance {
  return {
    id: `mod_diplomacy_renown_${kind}_${npcId}_${currentDay}`,
    name: kind === 'trade' ? '通商之誉' : kind === 'envoy' ? '使节之誉' : '征伐之誉',
    category: 'diplomacy',
    stackable: true,
    effects: [{ target: 'country_renown', op: 'add', value: renownDelta }],
    visualBadge: null,
    remainingDays: -1,
    description: message,
    descPlain: message,
  };
}

/** B1：宣战升警惕、通商/出使降警惕（原 applyDiplomacyResult 尾段映射，逐字搬运）。 */
export function diplomacyWarinessAdjust(kind: 'trade' | 'envoy' | 'war'): { delta: number; reason: string } {
  if (kind === 'war') return { delta: WARINESS_DELTAS.declareWar, reason: '兴师宣战' };
  return { delta: WARINESS_DELTAS.peaceAction, reason: kind === 'trade' ? '通商睦邻' : '遣使修好' };
}
