// -*- coding: utf-8 -*-
// c1012-04 三件套钉桩（c1004-19 选型）：②半位对称 ③幅值上限（①闸已有钉）
import { describe, expect, it } from 'vitest';
import { formatRate } from '../../state/productionSystem';

describe('formatRate 三件套（c1012-04）', () => {
  it('② symRound 半位对称：-0.05 → \'-0.1\'（改前 \'0\'）；-0.06 → \'-0.1\'', () => {
    expect(formatRate(-0.05)).toBe('-0.1');
    expect(formatRate(-0.06)).toBe('-0.1');
    expect(formatRate(-0.04)).toBe('0');    // 非半位：正常舍入到 0
    expect(formatRate(0.05)).toBe('0.1');   // 正半位行为不变
  });

  it('③ 幅值上限：|v|≥1e21 上溢字面形态渲染 \'—\'（c1004-19 第三盲点）', () => {
    expect(formatRate(1e21)).toBe('—');
    expect(formatRate(-1e21)).toBe('—');
    expect(formatRate(9.7e20)).not.toBe('—');  // 界内大值照常
  });

  it('回归：常规面零变化（整数/一位小数/非有限闸）', () => {
    expect(formatRate(12)).toBe('12');
    expect(formatRate(0.4)).toBe('0.4');
    expect(formatRate(NaN)).toBe('—');
    expect(formatRate(Infinity)).toBe('—');
  });
});
