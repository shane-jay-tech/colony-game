/**
 * DecreeSystem — 朝令的采纳与多阶段推进。
 *
 * 与 PolicySystem 的区别：
 *   - Policy 是一次付费 → 永久效果；
 *   - Decree 是分阶段：付 stage[0].cost 进入第一阶，等 stage[0].days 天 → 应用 stage[0].effects
 *     + 进入第二阶（再付 stage[1].cost），如此推进直到无更多 stage。
 *
 * 状态字段（state.activeDecrees）：
 *   { id, currentStage: 0..N, daysElapsed: 0..stage.days }
 *   - currentStage = 0 表示"已付第 0 阶 cost，正在等待第 0 阶 days 完成"
 *   - 第 0 阶到期 → 应用 stage[0].effects + currentStage++ + 扣 stage[1].cost + daysElapsed=0
 *   - 最后一阶到期 → 应用 effects + 从 activeDecrees 移除
 *
 * 注：stage[i+1] 的 cost 在到期时一次扣除；如果 cost 付不起，**该 decree 卡在当前阶**
 * （已应用的 effects 保留，但不再前进）。Slice F 简化为"卡死"；UI 用 stage 状态显示。
 */

import type { RoyalDecree, ModifierInstance } from '../data/schema';
import type { ResourceCost, ResourceId } from '../data/resourceRegistry';
import { RESOURCE_IDS, canAfford } from '../data/resourceRegistry';
import { effectsToModifierInstance } from './modifierAggregator';
import { evalPredicate, type CountryMetrics } from './dslEval';

export type AdoptDecreeFailReason =
  | 'unknown_decree'
  | 'already_active'
  | 'unlock_condition_unmet'
  | 'insufficient_resources'
  | 'chain_locked';

export type AdoptDecreeResult =
  | { ok: true; deltas: Partial<Record<ResourceId, number>>; activeRecord: ActiveDecreeRecord }
  | { ok: false; reason: AdoptDecreeFailReason };

export interface ActiveDecreeRecord {
  id: string;
  currentStage: number;
  daysElapsed: number;
}

/**
 * 校验 + 计算采纳一份 decree 时产生的 state 变化。pure function。
 * v1.0 #2：completedIds 用于检查 chainPrev——若 decree.chainPrev 设置且未在 completedIds 中
 * → 'chain_locked'。旧调用方不传该参数时默认空数组（含 chainPrev 的 decree 永远 locked，
 * 这是符合预期的：调用方应传完整 completed 列表）。
 */
export function tryAdoptDecree(
  decree: RoyalDecree,
  active: readonly ActiveDecreeRecord[],
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  metrics: CountryMetrics,
  completedIds: readonly string[] = [],
): AdoptDecreeResult {
  if (active.some(a => a.id === decree.id)) {
    return { ok: false, reason: 'already_active' };
  }

  // v1.0 #2：链路前置——必须先完成 chainPrev 那条
  if (decree.chainPrev && !completedIds.includes(decree.chainPrev)) {
    return { ok: false, reason: 'chain_locked' };
  }

  // unlockCondition 是结构化的 [{ type: 'country_population', value: 200 }] 数组：
  // 每条都得满足（AND）。type 字符串复用 DSL 的 lhs 命名空间，value 是阈值。
  for (const cond of decree.unlockCondition) {
    if (!checkDecreeUnlockCondition(cond, metrics)) {
      return { ok: false, reason: 'unlock_condition_unmet' };
    }
  }

  const stage0 = decree.stages[0];
  if (!stage0) {
    // 无 stage 的 decree 是数据 bug；防御性返回失败
    return { ok: false, reason: 'unlock_condition_unmet' };
  }

  if (!canAfford(resources, stage0.cost)) {
    return { ok: false, reason: 'insufficient_resources' };
  }

  return {
    ok: true,
    deltas: costToDeltas(stage0.cost),
    activeRecord: { id: decree.id, currentStage: 0, daysElapsed: 0 },
  };
}

/**
 * 一条 unlockCondition 的约定（非 DSL 字符串而是结构化对象）：
 *   { type: 'country_population', value: 200 } → country_population >= 200
 *   { type: 'year', value: 5 } → year >= 5
 * 即统一为 ">=" 阈值检查。
 */
function checkDecreeUnlockCondition(
  cond: { type: string; value: number },
  metrics: CountryMetrics,
): boolean {
  // 用 evalPredicate 走 DSL 路径以复用 identifier 校验。
  // 数据手误（cond.type 是非法标识符 / 'random'）→ DSL 抛 → 捕获后视为"不满足"。
  // 这样朝令永远解不开，比 tickDay 崩游戏要好。
  try {
    return evalPredicate(`${cond.type} >= ${cond.value}`, metrics);
  } catch {
    return false;
  }
}

export interface DecreeStageAdvance {
  decreeId: string;
  /** 旧阶（已完成） */
  fromStage: number;
  /** 旧阶 effects 实例化为 ModifierInstance（永久） */
  modifier: ModifierInstance;
  /** removeEffects: 旧阶要从 activeModifiers 中移除的 modifier id 列表 */
  modifiersToRemove: string[];
  /** 推进后状态（null = decree 完成需要从 activeDecrees 移除）。
   *  正常 advance 时 daysElapsed=0；didStall 时用 sentinel >= stage.days 标记"已应用、待付下阶 cost" */
  next: { currentStage: number; daysElapsed: number } | null;
  /** 推进时如果新阶段有 cost 需要扣（无则空对象）。
   *  注：cost 付不起会让 advance 失败 → 见 didStall 字段 */
  costDeltas: Partial<Record<ResourceId, number>>;
  /** 因新阶段付不起 cost 卡住：true 时 next 仍非空但 daysElapsed 不重置（卡在已 advance 的 stage） */
  didStall: boolean;
  /** false = 调用方应跳过 addModifier / removeModifier（已在更早一次 tick 应用过）。
   *  防止 stall 状态下每天重复"应用本阶 effects"（DeepSeek findings #3）。 */
  applyEffects: boolean;
}

/** stall 状态下用此 sentinel 标记"effects 已在前一次 tick 应用过" */
const STALL_SENTINEL_OFFSET = 1;

/**
 * 每天 tick 时调用一次，给一份 active decree 推进 daysElapsed +1，并在阶段结束时
 * 返回需要应用的 effects / 进入下阶 / 完成移除。
 *
 * @returns null 表示当前 stage 还没到期（仅 daysElapsed +1，调用方更新 record）
 */
export function tickActiveDecree(
  decree: RoyalDecree,
  record: ActiveDecreeRecord,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): DecreeStageAdvance | null {
  const stage = decree.stages[record.currentStage];
  if (!stage) return null; // out-of-range 防御

  // STALLED 重试路径：daysElapsed > stage.days = "effects 已应用，等付得起就 advance"
  if (record.daysElapsed > stage.days) {
    const nextStage = decree.stages[record.currentStage + 1];
    if (!nextStage) {
      // 不该到这里（最后一阶应直接完成而非 stall），防御性返回 null
      return null;
    }
    if (!canAfford(resources, nextStage.cost)) {
      // 仍卡着 — 不再重新发 advance / 重应用 modifier，调用方应只保持 record 原样
      return null;
    }
    // 现在付得起了 → 真正 advance（不再重复 addModifier）
    return {
      decreeId: decree.id,
      fromStage: record.currentStage,
      modifier: makeStageModifier(decree, stage),
      modifiersToRemove: stage.removeEffects,
      next: { currentStage: record.currentStage + 1, daysElapsed: 0 },
      costDeltas: costToDeltas(nextStage.cost),
      didStall: false,
      applyEffects: false, // 关键：之前 tick 已 apply，不要再发 addModifier
    };
  }

  const newDaysElapsed = record.daysElapsed + 1;
  if (newDaysElapsed < stage.days) {
    // 未到期，调用方应只更新 record.daysElapsed
    return null;
  }

  // 首次到期 — 应用本阶 effects 为永久 modifier
  const modifier = makeStageModifier(decree, stage);

  const nextStage = decree.stages[record.currentStage + 1];
  if (!nextStage) {
    // 这是最后一阶 → decree 完成
    return {
      decreeId: decree.id,
      fromStage: record.currentStage,
      modifier,
      modifiersToRemove: stage.removeEffects,
      next: null,
      costDeltas: {},
      didStall: false,
      applyEffects: true,
    };
  }

  // 检查下阶 cost
  if (!canAfford(resources, nextStage.cost)) {
    // 首次 stall：应用本阶 effects，但 daysElapsed 推到 stage.days+1 sentinel，
    // 下次 tick 走 stall-retry 分支，不再重复 apply。
    return {
      decreeId: decree.id,
      fromStage: record.currentStage,
      modifier,
      modifiersToRemove: stage.removeEffects,
      next: { currentStage: record.currentStage, daysElapsed: stage.days + STALL_SENTINEL_OFFSET },
      costDeltas: {},
      didStall: true,
      applyEffects: true,
    };
  }

  return {
    decreeId: decree.id,
    fromStage: record.currentStage,
    modifier,
    modifiersToRemove: stage.removeEffects,
    next: { currentStage: record.currentStage + 1, daysElapsed: 0 },
    costDeltas: costToDeltas(nextStage.cost),
    didStall: false,
    applyEffects: true,
  };
}

function makeStageModifier(decree: RoyalDecree, stage: RoyalDecree['stages'][number]): ModifierInstance {
  return effectsToModifierInstance({
    id: `decree_modifier_${decree.id}_stage${stage.order}`,
    name: `${decree.name} · 第${stage.order}阶`,
    category: 'military', // 多数 decree 是军事/经济组合；UI 不强依赖此 key
    effects: stage.effects,
    remainingDays: -1,
    description: decree.description,
    descPlain: decree.descPlain,
    stackable: false,
  });
}

function costToDeltas(cost: ResourceCost): Partial<Record<ResourceId, number>> {
  const deltas: Partial<Record<ResourceId, number>> = {};
  for (const id of RESOURCE_IDS) {
    const v = cost[id];
    if (v !== undefined && v > 0) deltas[id] = -v;
  }
  return deltas;
}
