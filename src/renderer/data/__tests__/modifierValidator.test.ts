/**
 * c923-31：modifierValidator 独立直测（异常路径全税则）。
 *
 * 既有覆盖的实况（本件写前实测，与卷宗口径有差）：
 *   - 异常路径仅 1 例，且是经 GameStore.addModifier 间接触发
 *     （state/__tests__/gameStore.test.ts:205）。
 *   - 另有 1 例**只跑合法路径**：data/__tests__/storyEffectsTargets.test.ts:95
 *     对静态数据逐条 expect-not-to-throw。所以"异常路径零直测"成立，
 *     但"全库仅 1 例碰到本模块"不成立（见 result 的否证节）。
 *
 * 本件只钉**校验器的判据形状**（谁抛、抛什么类型、path 怎么拼），
 * 一律不比对任何数值大小 ⇒ 不触经济平衡红线。
 *
 * ⚠ 三处"现状钉桩"（用例名里带【现状】的）钉的是**当前行为**，不是**应有行为**：
 *   类未设 name、value 的 Infinity 漏网、instance 级字段零校验。
 *   任一条被改，本件必红 ⇒ 那是"改动被人看见"，不是回归。修不修交人工裁决。
 */

import { describe, expect, it } from 'vitest';
import {
  ModifierValidationError,
  validateModifierEffect,
  validateModifierInstance,
} from '../modifierValidator';
import { MODIFIER_TARGETS } from '../resourceRegistry';
import type { ModifierEffect, ModifierInstance } from '../schema';

/** 绕过类型系统喂坏值（这正是本校验器存在的理由：JSON 反序列化不受 TS 约束）。 */
function badEffect(target: unknown, op: unknown, value: unknown): ModifierEffect {
  return { target, op, value } as unknown as ModifierEffect;
}

function goodEffect(value: number = 1): ModifierEffect {
  return { target: 'country_grain_output', op: 'add', value };
}

function effectOf(op: 'add' | 'mul'): ModifierEffect {
  return { target: 'building_construction_speed', op, value: 0.1 }; // c1001-02：原夹具键已退役，换在役建筑级键
}

function badInstance(patch: unknown): ModifierInstance {
  return patch as unknown as ModifierInstance;
}

describe('c923-31 validateModifierEffect：合法路径', () => {
  it('add / mul 两种 op 各不抛', () => {
    expect(() => validateModifierEffect(effectOf('add'), 'E')).not.toThrow();
    expect(() => validateModifierEffect(effectOf('mul'), 'E')).not.toThrow();
  });

  it('注册表里运行时导出的 target 逐个不抛（不钉死字面量，防与注册表漂移）', () => {
    const sample = [...MODIFIER_TARGETS];
    expect(sample.length).toBeGreaterThan(0); // 覆盖面自证：空数组会让本例假绿
    for (const target of sample) {
      expect(() =>
        validateModifierEffect(badEffect(target, 'add', 1), `REG.${target}`),
      ).not.toThrow();
    }
  });

  it('负值与 0 都是合法 value（本模块只判类型不判大小）', () => {
    expect(() => validateModifierEffect(goodEffect(0), 'P')).not.toThrow();
    expect(() => validateModifierEffect(goodEffect(-3), 'P')).not.toThrow();
  });
});

describe('c923-31 validateModifierEffect：非法 target', () => {
  it('拼错的 target 抛 ModifierValidationError 并带 op 前无关的 .target 路径', () => {
    // 与 resourceRegistry.MODIFIER_TARGETS 中真实键只差一个字母（Kimi 反审 #6 的原始形态）
    const err = (() => {
      try {
        validateModifierEffect(badEffect('country_grain_outpu', 'add', 1), 'Policy(p)');
        return null;
      } catch (e) {
        return e as ModifierValidationError;
      }
    })();
    expect(err).toBeInstanceOf(ModifierValidationError);
    expect(err).not.toBeNull();
    expect(err!.path).toBe('Policy(p).target');
    expect(err!.message).toContain('unknown modifier target');
    expect(err!.message).toContain('country_grain_outpu');
    expect(err!.message).toContain('typo?');
  });

  it('空串 / 大小写错位 / 非字符串 target 同样被拒', () => {
    for (const target of ['', 'COUNTRY_GRAIN_OUTPUT', 'country_grain_output ', 42, null]) {
      expect(() => validateModifierEffect(badEffect(target, 'add', 1), 'X')).toThrow(
        ModifierValidationError,
      );
    }
  });
});

describe('c923-31 validateModifierEffect：非法 op', () => {
  it('白名单外的 op 抛错且路径为 .op', () => {
    // target 合法 ⇒ 错误必然来自 op 判据（短路顺序自证）
    try {
      validateModifierEffect(badEffect('country_grain_output', 'sub', 1), 'P');
      expect.unreachable('op=sub 应被拒');
    } catch (e) {
      const err = e as ModifierValidationError;
      expect(err).toBeInstanceOf(ModifierValidationError);
      expect(err.path).toBe('P.op');
      expect(err.message).toContain("op must be 'add' or 'mul'");
      expect(err.message).toContain('got "sub"');
    }
  });

  it('大小写 / 空串 / 非字符串 op 一律被拒（严格全等判据）', () => {
    for (const op of ['ADD', 'Add', '', 'add ', 0, undefined]) {
      expect(() => validateModifierEffect(badEffect('country_grain_output', op, 1), 'P')).toThrow(
        ModifierValidationError,
      );
    }
  });
});

describe('c923-31 validateModifierEffect：非法 value', () => {
  it('NaN 被拒且路径为 .value', () => {
    try {
      validateModifierEffect(goodEffect(Number.NaN), 'Decree(d).stages[0]');
      expect.unreachable('NaN 应被拒');
    } catch (e) {
      const err = e as ModifierValidationError;
      expect(err).toBeInstanceOf(ModifierValidationError);
      expect(err.path).toBe('Decree(d).stages[0].value');
      expect(err.message).toContain('value must be a finite number');
      expect(err.message).toContain('got NaN');
    }
  });

  it('非数值类型（字符串 / null / undefined / 对象 / 数组 / 布尔）一律被拒', () => {
    const cases: unknown[] = ['1', '0.1', null, undefined, {}, [], true, false, () => 1];
    for (const value of cases) {
      expect(() => validateModifierEffect(badEffect('country_grain_output', 'add', value), 'P')).toThrow(
        ModifierValidationError,
      );
    }
  });

  it('【现状】Infinity / -Infinity 不被拦：文案承诺 finite 但判据只查 typeof 与 NaN', () => {
    // 现状缺陷，非期望行为：错误文案写 "must be a finite number"，判据却是
    // `typeof value !== 'number' || Number.isNaN(value)` ⇒ 无穷大漏网。
    // 本例钉的是"当前不抛"，若将来改用 Number.isFinite 收紧，这里必红一次。
    expect(() => validateModifierEffect(goodEffect(Number.POSITIVE_INFINITY), 'P')).not.toThrow();
    expect(() => validateModifierEffect(goodEffect(Number.NEGATIVE_INFINITY), 'P')).not.toThrow();
  });
});

describe('c923-31 path 透传与异常形状', () => {
  it('path 同时进 err.path 与 message，且 message 前缀固定为 [ModifierValidation]', () => {
    const path = 'Event(ev).choices[2].effects[7]';
    try {
      validateModifierEffect(badEffect('nope', 'add', 1), path);
      expect.unreachable('应抛错');
    } catch (e) {
      const err = e as ModifierValidationError;
      // 传入的 path 原样透传，校验器只在其后追加被判字段名
      expect(err.path).toBe(`${path}.target`);
      expect(err.path.startsWith(path)).toBe(true);
      expect(err.message).toBe(`[ModifierValidation] ${path}.target: unknown modifier target "nope" (typo? 检查 resourceRegistry.MODIFIER_TARGETS)`);
      // 报错文案关键字（与 saveGuard 族的报错面对呼）
      expect(err.message).toMatch(/^\[ModifierValidation\] /);
      expect(err.message).toContain(path);
    }
  });

  it('判据短路顺序：target → op → value，三处全坏时只报 target', () => {
    expect(() => validateModifierEffect(badEffect('nope', 'sub', NaN), 'P')).toThrow(/unknown modifier target/);
    expect(() => validateModifierEffect(badEffect('country_grain_output', 'sub', NaN), 'P')).toThrow(/op must be/);
    expect(() => validateModifierEffect(badEffect('country_grain_output', 'add', NaN), 'P')).toThrow(/value must be/);
  });

  it('c1002-14 name 已覆写为类名（原【现状】「name 仍是 Error」已被构造覆写翻新）', () => {
    let caught: unknown;
    try {
      validateModifierEffect(badEffect('nope', 'add', 1), 'P');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ModifierValidationError);
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeNull();
    // c1002-14：constructor.name 与 err.name 现在一致——按 name 分流的调用方自此可达
    expect((caught as object).constructor.name).toBe('ModifierValidationError');
    expect((caught as Error).name).toBe('ModifierValidationError');
    expect((caught as ModifierValidationError).path).toBe('P.target');
  });
});

describe('c923-31 validateModifierInstance', () => {
  it('合法实例（含空 effects 数组）不抛', () => {
    expect(() =>
      validateModifierInstance(
        badInstance({ id: 'm_empty', effects: [] }),
      ),
    ).not.toThrow();
    expect(() =>
      validateModifierInstance(
        badInstance({ id: 'm_ok', effects: [effectOf('add'), effectOf('mul')] }),
      ),
    ).not.toThrow();
  });

  it('逐条校验并给第 2 条 effect 拼出正确下标路径', () => {
    try {
      validateModifierInstance(
        badInstance({
          id: 'bad2',
          effects: [effectOf('add'), badEffect('country_renown', 'div', 1)],
        }),
      );
      expect.unreachable('第二条 op=div 应被拒');
    } catch (e) {
      const err = e as ModifierValidationError;
      expect(err).toBeInstanceOf(ModifierValidationError);
      expect(err.path).toBe('Modifier(bad2).effects[1].op');
      expect(err.message).toContain('Modifier(bad2).effects[1]');
    }
  });

  it('实例内第一条坏 target 也带完整路径（instance 级 path 由 id 拼出）', () => {
    expect(() =>
      validateModifierInstance(
        badInstance({ id: 'bad1', effects: [badEffect('bogus_target', 'add', 1)] }),
      ),
    ).toThrow(/Modifier\(bad1\)\.effects\[0\]\.target/);
  });

  it('【现状】instance 级字段本身零校验：缺 effects / effects 非数组 / 整参 undefined 抛的是 TypeError 而非 ModifierValidationError', () => {
    // 现状缺陷，非期望行为：validateModifierInstance 只做 `m.effects.forEach(...)`，
    // 既不查 m.id / name / category 等必填字段，也不查 effects 本身是不是数组
    // ⇒ 坏存档（ModifierInstance 少 effects）会从校验器漏成裸 TypeError。
    // 下列形态都会抛，但抛的是裸 TypeError —— 与校验器"坏数据抛 ModifierValidationError"的契约不符
    const throwing: unknown[] = [
      { id: 'i1' }, // 缺 effects
      { id: 'i2', effects: 'oops' }, // effects 非数组
      { id: 'i3', effects: null }, // effects 为 null
      {}, // 全缺
      undefined,
      null,
    ];
    for (const patch of throwing) {
      let caught: unknown;
      try {
        validateModifierInstance(badInstance(patch));
        throw new Error(`should have thrown for patch=${String(JSON.stringify(patch))}`);
      } catch (e) {
        caught = e;
      }
      expect(caught, `patch=${JSON.stringify(patch)} 应抛错`).toBeInstanceOf(TypeError);
      expect(caught).not.toBeInstanceOf(ModifierValidationError);
    }
    // 对照：effects 为空数组但缺 id ⇒ 连抛都不抛（见下一条用例）
    expect(() => validateModifierInstance(badInstance({ effects: [] }))).not.toThrow();
  });

  it('【现状】只缺 id（effects 为空数组）时完全不抛：instance 级必填字段零看守', () => {
    // 上一例的对照组——证明"缺 id"与"缺 effects"是两种不同失效形态：
    //   缺 effects ⇒ 裸 TypeError（错误类型与校验器契约不符）
    //   缺 id     ⇒ 静默通过（id 只出现在报错 path 的模板串里，不抛就没人读它）
    expect(() => validateModifierInstance(badInstance({ effects: [] }))).not.toThrow();
    expect(() => validateModifierInstance(badInstance({}))).toThrow(TypeError);
  });
});
