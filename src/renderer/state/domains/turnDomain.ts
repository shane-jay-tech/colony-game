/**
 * 域五：回合/系统域逻辑（gameStore 拆分批 5/5 · c1023-05 外迁件）。
 *
 * 拆分约束（done/c1011-13 存档兼容面）：「拆逻辑不拆 GameState 容器；字段全集零增删改」——
 * 本模块只收回合管线各阶段的**纯计算核**：modifier 到期、季节切换、朝令推进、
 * 国家指标快照、国格判定输入装配。emit（MODIFIER_REMOVED/ADDED、DECREE_*、
 * SEASON_TICK 等）与资源落库仍归 GameStore（事件序经 events 列表逐字保真）。
 * rng.ts 为存档一致性种子面（c1011-13 禁触项）——本模块只经 createRng 消费，不改其实现。
 * 公式逐字搬运，零数值行为变更。
 */
import type { ResourceId } from '../../data/resourceRegistry';
import type { BuildingInstance, ModifierInstance, NpcCountryState, RoyalDecree } from '../../data/schema';
import { applySeasonTransition, isSeasonModifier } from '../seasonSystem';
import { tickActiveDecree } from '../decreeSystem';
import type { CountryMetrics } from '../dslEval';
import { applyModifiers, aggregateModifiers } from '../modifierAggregator';
import { createRng } from '../rng';
import { dayToCalendar } from '../calendar';
import { clampSentiment } from '../publicSentiment';
import { DIPLO_FLAG_ALL_FRIENDLY } from '../../data/countryGrades';
import type { GradeInput } from '../countryGrade';

// ───────────────────────── modifier 到期（原 runModifierExpiryPhase 主体） ─────────────────────────

export interface ModifierExpiryOutcome {
  /** 未到期集合（store 在 expired 非空时写回 state.activeModifiers，与原条件写回一致）。 */
  kept: ModifierInstance[];
  /** 本次到期的 modifier（store 逐个 emit MODIFIER_REMOVED）。 */
  expired: ModifierInstance[];
}

/** remainingDays > 0 才递减；归 0 即到期；permanent(-1) 与 0 起点不动（逐字搬运）。 */
export function expireModifiersStep(modifiers: ModifierInstance[]): ModifierExpiryOutcome {
  for (const m of modifiers) {
    if (m.remainingDays > 0) m.remainingDays -= 1;
  }
  const expired = modifiers.filter(m => m.remainingDays === 0);
  const kept = modifiers.filter(m => m.remainingDays !== 0);
  return { kept, expired };
}

// ───────────────────────── 季节切换（原 runSeasonTransitionPhase 主体） ─────────────────────────

export interface SeasonTransitionOutcome {
  /** 切换后的 modifier 集合（store 写回 state.activeModifiers）。 */
  next: ModifierInstance[];
  /** 被移除的旧季节 modifier id（store 逐个 emit MODIFIER_REMOVED）。 */
  removedIds: string[];
}

/** A-3：换季时移除旧季节 modifier 并应用新季节集（applySeasonTransition 原样消费）。 */
export function seasonTransitionStep(
  modifiers: ModifierInstance[],
  season: ReturnType<typeof dayToCalendar>['season'],
): SeasonTransitionOutcome {
  const removed = modifiers.filter(isSeasonModifier);
  return {
    next: applySeasonTransition(modifiers, season),
    removedIds: removed.map(m => m.id),
  };
}

// ───────────────────────── 朝令推进（原 runDecreeTick 主体） ─────────────────────────

/**
 * 朝令推进的**有序**副作用意图：store 按数组序逐条执行/emit——与原内联实现的
 * 「每条 decree 先 modifier 增删、后 DECREE_* 事件」次序逐字一致。
 */
export type DecreeTickOp =
  | { kind: 'removeModifier'; id: string }
  | { kind: 'addModifier'; modifier: ModifierInstance }
  | { kind: 'completed'; decreeId: string; fromStage: number }
  | { kind: 'stalled'; decreeId: string; stage: number }
  | { kind: 'advanced'; decreeId: string; fromStage: number; toStage: number };

export interface AdvanceDecreesOutcome {
  /** 新的 activeDecrees 集合（store 写回）。 */
  next: { id: string; currentStage: number; daysElapsed: number }[];
  /** 有序副作用意图（store 逐条消费）。 */
  ops: DecreeTickOp[];
  /** 各朝令下阶 cost 聚合（store 经 applyDayDeltas 一次性应用）。 */
  accumulatedDeltas: Partial<Record<ResourceId, number>>;
}

/**
 * 推进 active decrees；阶段到期 → 产出 modifier 应用意图 / 下阶 cost / stall 处理。
 *
 * 关键不变量（DeepSeek 二审 #4，逐字保真）：循环开始前对 resources 取一次快照，每个 decree
 * 都基于同一份快照评估 affordability；扣费 deltas 累积到末尾一次性应用。
 */
export function advanceDecrees(
  activeDecrees: readonly { id: string; currentStage: number; daysElapsed: number }[],
  decrees: readonly RoyalDecree[],
  resourcesSnapshot: Readonly<Partial<Record<ResourceId, number>>>,
): AdvanceDecreesOutcome {
  const next: { id: string; currentStage: number; daysElapsed: number }[] = [];
  const ops: DecreeTickOp[] = [];
  const accumulatedDeltas: Partial<Record<ResourceId, number>> = {};
  for (const rec of activeDecrees) {
    const def = decrees.find(d => d.id === rec.id);
    if (!def) {
      // 未知 decree（数据丢失 / 已被移除）：保留但不推进，避免崩溃
      next.push(rec);
      continue;
    }
    const advance = tickActiveDecree(def, rec, resourcesSnapshot);
    if (advance === null) {
      // 未到期 OR 仍 stalled：daysElapsed +1（stall 状态下也累加，纯纯诊断用）
      next.push({ ...rec, daysElapsed: rec.daysElapsed + 1 });
      continue;
    }

    // 仅当 applyEffects=true 时才发 modifier 增删（防止 stall 重复 apply）
    if (advance.applyEffects) {
      for (const id of advance.modifiersToRemove) {
        ops.push({ kind: 'removeModifier', id });
      }
      ops.push({ kind: 'addModifier', modifier: advance.modifier });
    }

    if (advance.next === null) {
      // decree 完成 — v1.0 #2：completedDecreeIds 记入由 store 侧去重 push 后 emit
      ops.push({ kind: 'completed', decreeId: rec.id, fromStage: advance.fromStage });
      continue; // 不 push 进 next（从 active 列表移除）
    }

    if (advance.didStall) {
      // 首次卡住：保留 record（daysElapsed 推到 stage.days+1 sentinel），不扣 cost
      next.push({ id: rec.id, currentStage: advance.next.currentStage, daysElapsed: advance.next.daysElapsed });
      ops.push({ kind: 'stalled', decreeId: rec.id, stage: advance.next.currentStage });
      continue;
    }

    // 正常 advance（含从 stall 中恢复的"补 advance"）：把下阶 cost 累积到末尾再应用
    for (const [k, v] of Object.entries(advance.costDeltas) as [ResourceId, number | undefined][]) {
      if (v === undefined) continue;
      accumulatedDeltas[k] = (accumulatedDeltas[k] ?? 0) + v;
    }
    next.push({ id: rec.id, currentStage: advance.next.currentStage, daysElapsed: advance.next.daysElapsed });
    ops.push({ kind: 'advanced', decreeId: rec.id, fromStage: advance.fromStage, toStage: advance.next.currentStage });
  }
  return { next, ops, accumulatedDeltas };
}

// ───────────────────────── 国家指标快照（原 computeMetrics 主体） ─────────────────────────

export interface CountryMetricsInput {
  currentDay: number;
  resources: Readonly<Partial<Record<ResourceId, number>>>;
  activeModifiers: readonly ModifierInstance[];
  publicWrath: number;
  rngSeed: number;
  grade: number;
  storyFlags: { chapter: number; powerAxis: number; resourceAxis: number } | null;
}

/** 用当前 state + activeModifiers 算 DSL/事件采样所需的国家级指标快照（逐字搬运，rng 派生口径不变）。 */
export function computeCountryMetrics(input: CountryMetricsInput): CountryMetrics {
  const cal = dayToCalendar(input.currentDay);
  // Phase1：people 现在会真实增长 → population 直接取裸 people 资源（不再经 country_population_cap
  // 聚合，后者改作"住房上限"用于人口增长门槛，见 population.ts / runPopulationTick）。
  const population = input.resources['people'] ?? 0;
  const morale = applyModifiers(50, 'country_morale', input.activeModifiers);
  const wrath = clampSentiment(
    input.publicWrath + aggregateModifiers('country_wrath', input.activeModifiers).addSum,
  );
  const militaryPower = applyModifiers(0, 'country_military_power', input.activeModifiers);
  // RNG：每次 metrics 推进一步 rngSeed，保证 day-to-day 不同。
  // 用箭头包裹以防 createRng 实现被换成需要 this 的形式（DeepSeek 防御）。
  const rngHandle = createRng(input.rngSeed ^ input.currentDay);
  const sf = input.storyFlags;
  return {
    resources: input.resources,
    population,
    morale,
    wrath,
    militaryPower,
    year: cal.year,
    season: cal.season,
    dayOfYear: input.currentDay % 120,
    rng: () => rngHandle.next(),
    grade: input.grade,
    storyChapter: sf ? sf.chapter : -1,
    storyPowerAxis: sf ? sf.powerAxis : 0,
    storyResourceAxis: sf ? sf.resourceAxis : 0,
  };
}

// ───────────────────────── 国格判定输入（原 buildGradeInput 主体） ─────────────────────────

/** NPC 邦交"友好"阈值：stance ≥ 20（原 GameStore.NPC_FRIENDLY_STANCE 私有静态，随逻辑外迁，值不变）。 */
export const NPC_FRIENDLY_STANCE = 20;

/** 收集国格判定所需快照（人口口径与 computeMetrics 一致，逐字搬运）。 */
export function buildGradeInput(input: {
  people: number;
  resources: Readonly<Partial<Record<ResourceId, number>>>;
  buildings: readonly BuildingInstance[];
  npcCountries: readonly NpcCountryState[];
  adoptedPolicyIds: ReadonlySet<string>;
  completedDecreeIds: readonly string[];
}): GradeInput {
  // Phase1：国格人口门槛用裸 people（与 computeMetrics 一致）；country_population_cap 改作住房上限。
  const builtDefIds = new Set<string>();
  for (const b of input.buildings) {
    if (b.status === 'working') builtDefIds.add(b.defId);
  }
  const diplomacyFlags = new Set<string>();
  if (input.npcCountries.length > 0
    && input.npcCountries.every(n => n.stance >= NPC_FRIENDLY_STANCE)) {
    diplomacyFlags.add(DIPLO_FLAG_ALL_FRIENDLY);
  }
  return {
    population: input.people,
    resources: input.resources,
    builtDefIds,
    adoptedPolicyIds: input.adoptedPolicyIds,
    completedDecreeIds: new Set(input.completedDecreeIds),
    diplomacyFlags,
  };
}
