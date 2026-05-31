import { describe, it, expect } from 'vitest';
import {
  isDualZero,
  planCrisisEffects,
  CRISIS_POP_FLOOR,
  CRISIS_MORALE_DROP,
} from '../crisis';

describe('isDualZero', () => {
  it('gold 与 grain 都 ≤0 → true（含缺失/负值）', () => {
    expect(isDualZero({ gold: 0, grain: 0 })).toBe(true);
    expect(isDualZero({})).toBe(true);
    expect(isDualZero({ gold: -5, grain: -1 })).toBe(true);
  });
  it('任一为正 → false', () => {
    expect(isDualZero({ gold: 1, grain: 0 })).toBe(false);
    expect(isDualZero({ gold: 0, grain: 10 })).toBe(false);
  });
});

describe('planCrisisEffects', () => {
  it('人口 ×0.7 向下取整', () => {
    const eff = planCrisisEffects(100);
    expect(eff.newPeople).toBe(70);
    expect(eff.peopleDelta).toBe(-30);
  });
  it('低人口触下限保护（不灭国）', () => {
    const eff = planCrisisEffects(6); // floor(4.2)=4 < 5 → 保 5
    expect(eff.newPeople).toBe(CRISIS_POP_FLOOR);
    expect(eff.peopleDelta).toBe(-1);
  });
  it('民心固定跌幅（调用方负责 clamp）', () => {
    expect(planCrisisEffects(100).moraleDelta).toBe(-CRISIS_MORALE_DROP);
  });
});
