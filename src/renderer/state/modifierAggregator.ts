/**
 * ModifierAggregator — 把一个 target key 的 base 值经过 active modifiers 加工成"现行值"。
 *
 * 语义约定（v0.7）：
 *   - 'add' op 是绝对增量（policies.ts: "+5" / events.ts: "country_morale +3"）
 *   - 'mul' op 是乘法因子（policies.ts: 1.2 = +20%）
 *   - 顺序：先把所有 add 累加到 base，再乘以所有 mul 的乘积
 *   - 多个相同 target 的 modifier 都会叠加 / 累乘
 *
 *   effective = (base + Σ add_i) × Π mul_j
 *
 * 这是 ProductionSystem 计算 country_grain_output / country_wood_output 等总产出系数的依据。
 */

import type { ModifierEffect, ModifierInstance } from '../data/schema';
import type { ModifierTargetKey } from '../data/resourceRegistry';

export interface ModifierBreakdown {
  /** 命中此 target 的所有 add 累加 */
  addSum: number;
  /** 命中此 target 的所有 mul 累乘（恒等元 = 1） */
  mulProduct: number;
  /** 命中此 target 的 modifier 个数（用于诊断 / UI 显示） */
  hitCount: number;
}

/**
 * 在 active modifiers 列表里找出命中给定 target 的所有 effect，分别累加 add 和累乘 mul。
 * 返回的 breakdown 单独存在，调用方可以再叠加 base 值算 effective。
 *
 * 性能：O(modifiers × effects-per-modifier)。Slice F 阶段 active modifiers 数量上限 ~20，
 * 完全不是热路径瓶颈。
 */
export function aggregateModifiers(
  target: ModifierTargetKey,
  modifiers: readonly ModifierInstance[],
): ModifierBreakdown {
  let addSum = 0;
  let mulProduct = 1;
  let hitCount = 0;
  for (const m of modifiers) {
    for (const e of m.effects) {
      if (e.target !== target) continue;
      hitCount++;
      if (e.op === 'add') {
        addSum += e.value;
      } else if (e.op === 'mul') {
        mulProduct *= e.value;
      }
    }
  }
  return { addSum, mulProduct, hitCount };
}

/**
 * 用 (base + addSum) × mulProduct 公式算 effective 值。
 *
 * 注：mulProduct 默认 1（无 mul 命中），addSum 默认 0。所以 base 没有任何 modifier 时
 * effective = base，正确。
 */
export function applyModifiers(
  base: number,
  target: ModifierTargetKey,
  modifiers: readonly ModifierInstance[],
): number {
  const b = aggregateModifiers(target, modifiers);
  return (base + b.addSum) * b.mulProduct;
}

/**
 * 仅查询 mul 因子（base × factor 由调用方决定）。production 算 country_<resource>_output
 * 时常用：factor = mulProduct(country_grain_output) × productionRate；add 单独处理。
 */
export function getMulFactor(
  target: ModifierTargetKey,
  modifiers: readonly ModifierInstance[],
): number {
  let mul = 1;
  for (const m of modifiers) {
    for (const e of m.effects) {
      if (e.target === target && e.op === 'mul') mul *= e.value;
    }
  }
  return mul;
}

/** 仅查询 add 累加值。 */
export function getAddDelta(
  target: ModifierTargetKey,
  modifiers: readonly ModifierInstance[],
): number {
  let add = 0;
  for (const m of modifiers) {
    for (const e of m.effects) {
      if (e.target === target && e.op === 'add') add += e.value;
    }
  }
  return add;
}

/** 把 ModifierEffect 数组实例化为一个 ModifierInstance（policy / decree 采纳后调用）。 */
export function effectsToModifierInstance(args: {
  id: string;
  name: string;
  category: ModifierInstance['category'];
  effects: ModifierEffect[];
  remainingDays: number;
  description?: string;
  descPlain?: string;
  stackable?: boolean;
}): ModifierInstance {
  return {
    id: args.id,
    name: args.name,
    category: args.category,
    stackable: args.stackable ?? false,
    effects: args.effects,
    visualBadge: null,
    remainingDays: args.remainingDays,
    description: args.description ?? '',
    descPlain: args.descPlain ?? '',
  };
}
