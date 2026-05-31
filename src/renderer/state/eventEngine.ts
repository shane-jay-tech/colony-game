/**
 * EventEngine — 朝议事件的"触发采样 / 选择应用 / 超时回退"。
 *
 * 总体生命周期（与 GameStore 协作）：
 *   1) 每天 tick：sampleEventTrigger() 找出第一条所有 trigger 都通过的 event id
 *      → store 设置 pendingEventId，UI 弹模态框
 *   2) 玩家点 choice → applyEventChoice(choiceIdx) 算出新增 modifier / 要移除的 modifier
 *      → store 落盘，pendingEventId 清空，eventHistory.push
 *   3) defaultTimeoutDays 天没点 → checkEventTimeout 自动 choices[0]（"保守默认"）
 *      → 走同样的 applyEventChoice 路径
 *
 * trigger 语义：
 *   - 一个 event 的多条 trigger 是 **AND**（所有都得通过）
 *   - 'random' 单独路径：trigger.value 是概率，metrics.rng() < value 视为通过
 *     （每天采样一次，所以 0.15 ≈ 每 6.67 天一次的频率）
 *   - 其他 trigger 走 evalPredicate
 *
 * 设计约束：
 *   - 已经在 eventHistory 里的 event 不再触发（防重复）
 *   - 已经有 pendingEventId 时不采样新事件（一次只挂一个）
 *   - 抉择类（无 choices 字段）：不可被玩家"应用"，自动当作"展示完即归档"——
 *     由 applyAutoEvent 处理，effects 走 contexts[0] 默认应用？
 *     **简化**：v0.7 阶段 contexts[].effects 字段不存在（只有 desc/descPlain），
 *     所以非抉择类事件没有 effects 直接应用——它们只刷一条朝议消息然后归档。
 *     UI 用 "查看" 按钮把 pendingEventId 清掉。
 */

import type { CourtEvent, CourtEventChoice, ModifierInstance, ModifierEffect } from '../data/schema';
import { evalPredicate, type CountryMetrics } from './dslEval';
import { effectsToModifierInstance } from './modifierAggregator';

export interface EventApplyResult {
  /** 新增到 activeModifiers 的实例（来自 choice.effects；可能为空数组） */
  modifierToAdd: ModifierInstance | null;
  /** 要从 activeModifiers 移除的 modifier id（来自 choice.removeEffects） */
  modifiersToRemove: string[];
}

/**
 * 从 EVENTS 列表里挑一条满足触发条件的 event id。返回 null 表示当日无事件。
 *
 * 调用方约束（GameStore.tickDay）：
 *   - 仅当 pendingEventId === null 时才调用
 *   - 调用方拿到 id 后写入 pendingEventId，让 UI 弹窗
 *
 * @param events 全部静态事件定义
 * @param eventHistory 已经触发过的事件 id 列表（不重复触发）
 * @param metrics 国家级指标 + rng（DSL 求值上下文）
 */
export function sampleEventTrigger(
  events: readonly CourtEvent[],
  eventHistory: readonly string[],
  metrics: CountryMetrics,
): string | null {
  const seen = new Set(eventHistory);
  for (const evt of events) {
    if (seen.has(evt.id)) continue;
    if (allTriggersPass(evt, metrics)) {
      return evt.id;
    }
  }
  return null;
}

/** 检查一个事件的所有 trigger 是否全部通过（AND）。 */
function allTriggersPass(evt: CourtEvent, metrics: CountryMetrics): boolean {
  for (const t of evt.triggers) {
    if (t.condition === 'random') {
      // 'random' 走概率路径；缺 value 视为永不触发（保守）
      const p = t.value ?? 0;
      if (metrics.rng() >= p) return false;
    } else {
      if (!evalPredicate(t.condition, metrics)) return false;
    }
  }
  return true;
}

/**
 * 应用玩家选择。把 choice.effects 实例化为一个**有限期** ModifierInstance。
 *
 * 默认时长：30 天（约一季），与 v0.7 蓝图一致——朝议事件影响是"短中期"，
 * 不像国策那样永久。如果某 event 需要永久或更长，schema 需扩字段；这里先统一。
 *
 * @returns 调用方应用的指令：addModifier(...) + removeModifier(...) 各一组
 */
export function applyEventChoice(
  event: CourtEvent,
  choiceIdx: number,
): EventApplyResult {
  const choice = event.choices?.[choiceIdx];
  if (!choice) {
    // 该 event 不是抉择类，或 idx 越界：仅返回空（调用方仍要从 pendingEventId 清掉）
    return { modifierToAdd: null, modifiersToRemove: [] };
  }
  return choiceToResult(event, choice, choiceIdx);
}

function choiceToResult(
  event: CourtEvent,
  choice: CourtEventChoice,
  choiceIdx: number,
): EventApplyResult {
  if (choice.effects.length === 0) {
    return { modifierToAdd: null, modifiersToRemove: [...choice.removeEffects] };
  }
  const modifier = effectsToModifierInstance({
    id: `event_modifier_${event.id}_choice${choiceIdx}`,
    name: event.contexts[0]?.title ?? event.id,
    category: classifyEventCategory(choice.effects),
    effects: choice.effects,
    remainingDays: 30, // 一季左右，v0.7 默认
    description: event.contexts[0]?.desc ?? '',
    descPlain: event.contexts[0]?.descPlain ?? '',
    stackable: false,
  });
  return { modifierToAdd: modifier, modifiersToRemove: [...choice.removeEffects] };
}

/**
 * 超时回退：调用方记录 pendingEventId 起的 daysSincePending。
 * 一旦 ≥ defaultTimeoutDays 就当作选了 choices[0]（保守默认）。
 *
 * @returns 'pick0' 表示要按 choices[0] 应用；null 表示还没超时
 */
export function checkEventTimeout(
  event: CourtEvent,
  daysSincePending: number,
): 'pick0' | null {
  if (event.defaultTimeoutDays === undefined) return null;
  if (daysSincePending >= event.defaultTimeoutDays) return 'pick0';
  return null;
}

/**
 * 根据 effects 的 target 大致归类 ModifierCategory。多 target 时用第一个能识别的。
 * Slice F 用最简启发：morale → culture; military → military; gold/grain → economy; 默认 economy。
 */
function classifyEventCategory(effects: ModifierEffect[]): ModifierInstance['category'] {
  for (const e of effects) {
    const t = e.target;
    if (t.includes('military')) return 'military';
    if (t.includes('morale') || t.includes('rite') || t.includes('culture')) return 'culture';
    if (t.includes('diplomacy')) return 'diplomacy';
    if (t.includes('population') || t.includes('people')) return 'population';
    if (t.includes('grain') || t.includes('gold') || t.includes('wood') || t.includes('stone') ||
        t.includes('cloth') || t.includes('bronze')) return 'economy';
  }
  return 'economy';
}
