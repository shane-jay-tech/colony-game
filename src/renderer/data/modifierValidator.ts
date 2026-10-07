/**
 * 运行时校验器：解决 Kimi 反审 #6（ModifierEffect.target 拼错静默 NaN）。
 *
 * 编译期 TypeScript 已经把 target 限制为 ModifierTargetKey 联合字面量，
 * 但 JSON 反序列化（存档读取、远端同步）会绕过类型系统，所以仍要运行时兜一层。
 */

import {
  isValidModifierTarget,
  isValidResourceId,
  RESOURCE_IDS,
  type ResourceCost,
} from './resourceRegistry';
import type {
  CourtEvent,
  ModifierEffect,
  ModifierInstance,
  PolicyNode,
  RoyalDecree,
} from './schema';
import { validateDslExpr } from './dslCore';

export class ModifierValidationError extends Error {
  constructor(message: string, public readonly path: string) {
    super(`[ModifierValidation] ${path}: ${message}`);
    // c1002-14（c923-31 遗留）：覆写 name——继承默认 name='Error' 使按 err.name 分流的调用方
    // 永远走空；分流面核查（rg err.name/\.name === src/ 生产码）现值零调用方 ⇒ 纯工程面提前补齐。
    this.name = new.target.name;
  }
}

export function validateModifierEffect(e: ModifierEffect, path: string): void {
  if (!isValidModifierTarget(e.target)) {
    throw new ModifierValidationError(
      `unknown modifier target "${e.target}" (typo? 检查 resourceRegistry.MODIFIER_TARGETS)`,
      `${path}.target`,
    );
  }
  if (e.op !== 'add' && e.op !== 'mul') {
    throw new ModifierValidationError(
      `op must be 'add' or 'mul', got "${e.op}"`,
      `${path}.op`,
    );
  }
  // ⚠ 边界说明：本处 message 写的是 "finite number"，但下面的判据只有
  //   `typeof !== 'number' || Number.isNaN(value)` 两关 ⇒ **Infinity / -Infinity 现在可通过**
  //   （拦 NaN、不拦无穷）。文案是"应有判据"的口径，代码是"现有判据"的事实，二者不等值。
  //   同族对照：state 层 saveLoad.ts:232/431/741 用 `Number.isFinite`（无穷也拦），
  //   两处判据不同形 —— 排查"非有限值怎么没报错"时别互相指望。
  //   c1006-05（L3 DEV 门 throw 落地）：判据换 `!Number.isFinite(e.value)` 一并拦无穷。
  //   c1007-24：ErrorBoundary 在位 ⇒ 降级 console.error 撤销，DEV/生产双 throw——
  //   生产错误冒泡 window 级监听进崩溃 overlay（main.ts 注入），不再整页无声崩死。
  if (typeof e.value !== 'number' || !Number.isFinite(e.value)) {
    // c1007-24（c1006-05 遗留 1）：ErrorBoundary（src/renderer/data/ErrorBoundary.ts）补建后
    // 升回 DEV/生产双 throw——错误统一冒泡 window 级监听进崩溃层，不再静默降级 console.error。
    const msg = `value must be a finite number, got ${e.value}`;
    throw new ModifierValidationError(msg, `${path}.value`);
  }
}

export function validateResourceCost(cost: ResourceCost, path: string): void {
  for (const key of Object.keys(cost)) {
    if (!isValidResourceId(key)) {
      throw new ModifierValidationError(
        `unknown resource id "${key}" (合法值: ${RESOURCE_IDS.join(', ')})`,
        `${path}.${key}`,
      );
    }
    const v = (cost as Record<string, number | undefined>)[key];
    if (v !== undefined && (typeof v !== 'number' || v < 0)) {
      throw new ModifierValidationError(
        `cost must be non-negative number, got ${v}`,
        `${path}.${key}`,
      );
    }
  }
}

export function validateModifierInstance(m: ModifierInstance): void {
  m.effects.forEach((e, i) =>
    validateModifierEffect(e, `Modifier(${m.id}).effects[${i}]`),
  );
}

export function validatePolicyNode(p: PolicyNode): void {
  validateResourceCost(p.cost, `Policy(${p.id}).cost`);
  p.effects.forEach((e, i) =>
    validateModifierEffect(e, `Policy(${p.id}).effects[${i}]`),
  );
}

export function validateCourtEvent(ev: CourtEvent): void {
  // Slice G hardening: trigger.condition 是 DSL 字符串，启动期 dry-run 解析
  // （'random' 走单独路径，validateDslExpr 自身会跳过）
  ev.triggers.forEach((t, ti) => {
    try {
      validateDslExpr(t.condition);
    } catch (err) {
      throw new ModifierValidationError(
        `invalid DSL "${t.condition}": ${err instanceof Error ? err.message : String(err)}`,
        `Event(${ev.id}).triggers[${ti}].condition`,
      );
    }
  });
  ev.choices?.forEach((c, ci) => {
    c.effects.forEach((e, ei) =>
      validateModifierEffect(e, `Event(${ev.id}).choices[${ci}].effects[${ei}]`),
    );
  });
}

export function validateRoyalDecree(d: RoyalDecree): void {
  // Slice G hardening: unlockCondition.type 必须是合法 DSL 标识符（且 != 'random'）
  // 否则运行时 evalPredicate 会抛 → decree 永远解不开（虽不崩游戏但玩家被坑）
  d.unlockCondition.forEach((cond, ci) => {
    if (cond.type === 'random') {
      throw new ModifierValidationError(
        `unlockCondition.type cannot be 'random' (random 不是阈值检查)`,
        `Decree(${d.id}).unlockCondition[${ci}].type`,
      );
    }
    try {
      // 用 ">= 0" 拼一个最小可解析谓词，仅检查 lhs 标识符合法性
      validateDslExpr(`${cond.type} >= 0`);
    } catch (err) {
      throw new ModifierValidationError(
        `unknown identifier "${cond.type}": ${err instanceof Error ? err.message : String(err)}`,
        `Decree(${d.id}).unlockCondition[${ci}].type`,
      );
    }
  });
  d.stages.forEach((stage, si) => {
    validateResourceCost(stage.cost, `Decree(${d.id}).stages[${si}].cost`);
    stage.effects.forEach((e, ei) =>
      validateModifierEffect(
        e,
        `Decree(${d.id}).stages[${si}].effects[${ei}]`,
      ),
    );
  });
}

/**
 * 系统启动时调用一次，全量扫静态数据；任何非法字段抛错让游戏不能启动，
 * 比上线后静默 NaN 强百倍。
 */
export function validateAllStaticData(data: {
  policies: PolicyNode[];
  events: CourtEvent[];
  decrees: RoyalDecree[];
}): void {
  data.policies.forEach(validatePolicyNode);
  data.events.forEach(validateCourtEvent);
  data.decrees.forEach(validateRoyalDecree);
}
