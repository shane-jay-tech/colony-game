import { describe, it, expect } from 'vitest';
import { describeEffect, describeEffects, findUnlabeledTargets, TARGET_LABEL } from '../modifierDescriber';
import { MODIFIER_TARGETS } from '../../data/resourceRegistry';
import type { ModifierEffect } from '../../data/schema';

describe('modifierDescriber', () => {
  it('mul 正向 → 百分比加成', () => {
    const e: ModifierEffect = { target: 'country_grain_output', op: 'mul', value: 1.2 };
    expect(describeEffect(e)).toBe('粮食产出 +20%');
  });

  it('mul 负向 → 百分比削减（U+2212 负号）', () => {
    const e: ModifierEffect = { target: 'country_grain_consumption', op: 'mul', value: 0.8 };
    expect(describeEffect(e)).toBe('粮食消耗 −20%');
  });

  it('mul value=1 → +0%（边界）', () => {
    const e: ModifierEffect = { target: 'country_morale', op: 'mul', value: 1 };
    expect(describeEffect(e)).toBe('民心 +0%');
  });

  it('add 正整数 → 带 + 号', () => {
    const e: ModifierEffect = { target: 'country_population_cap', op: 'add', value: 15 };
    expect(describeEffect(e)).toBe('人口上限 +15');
  });

  it('add 负值 → 带负号', () => {
    const e: ModifierEffect = { target: 'country_military_power', op: 'add', value: -5 };
    expect(describeEffect(e)).toBe('兵力 −5');
  });

  it('add 小数 → 保留一位', () => {
    const e: ModifierEffect = { target: 'country_military_power', op: 'add', value: 8.5 };
    expect(describeEffect(e)).toBe('兵力 +8.5');
  });

  it('describeEffects 逐条映射；空数组 → []', () => {
    const effects: ModifierEffect[] = [
      { target: 'country_grain_output', op: 'mul', value: 1.2 },
      { target: 'country_population_cap', op: 'add', value: 15 },
    ];
    expect(describeEffects(effects)).toEqual(['粮食产出 +20%', '人口上限 +15']);
    expect(describeEffects([])).toEqual([]);
  });

  it('MODIFIER_TARGETS 全部 key 都有非空中文标签（防新增 target 漏翻译）', () => {
    expect(findUnlabeledTargets()).toEqual([]);
    // 双保险：逐个断言
    for (const t of MODIFIER_TARGETS) {
      expect(TARGET_LABEL[t], `target ${t} 缺中文标签`).toBeTruthy();
    }
  });

  it('未知 target（理论不应发生）→ 回退显示原 key', () => {
    const e = { target: 'not_a_real_target', op: 'mul', value: 1.5 } as unknown as ModifierEffect;
    expect(describeEffect(e)).toBe('not_a_real_target +50%');
  });
});
