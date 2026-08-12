import { describe, it, expect } from 'vitest';
import { checkHistorian, HISTORIAN_ADVICES, type HistorianContext } from '../historianSystem';

function makeCtx(overrides: Partial<HistorianContext> = {}): HistorianContext {
  return {
    currentDay: 50,
    isFirstDay: false,
    grainNegativeDays: 0,
    gold: 30,
    hasGoldCostBuilding: false,
    policyPanelUnlocked: false,
    hasHostileNpc: false,
    populationAtCap: false,
    gradeJustAscended: false,
    idleDays: 0,
    crisisActive: false,
    noAdjacentBonus: false,
    isFirstWinter: false,
    hasAvailableGeneral: false,
    seenIds: new Set(),
    ...overrides,
  };
}

describe('historianSystem', () => {
  it('fires first_game on day 1', () => {
    const ctx = makeCtx({ isFirstDay: true, currentDay: 1 });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_01_first_game');
  });

  it('fires grain_low after 3 days negative', () => {
    const ctx = makeCtx({ grainNegativeDays: 3 });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_02_grain_low');
  });

  it('fires gold_empty when gold=0 and constructing', () => {
    const ctx = makeCtx({ gold: 0, hasGoldCostBuilding: true });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_03_gold_empty');
  });

  it('does not fire gold_empty when gold>0', () => {
    const ctx = makeCtx({ gold: 5, hasGoldCostBuilding: true });
    const result = checkHistorian(ctx);
    expect(result.advice?.id).not.toBe('hist_03_gold_empty');
  });

  it('fires hostile_npc', () => {
    const ctx = makeCtx({ hasHostileNpc: true });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_05_hostile_npc');
  });

  it('fires pop_cap', () => {
    const ctx = makeCtx({ populationAtCap: true });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_06_pop_cap');
  });

  it('fires grade_ascend', () => {
    const ctx = makeCtx({ gradeJustAscended: true });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_07_grade_ascend');
  });

  it('fires idle after 30 days', () => {
    const ctx = makeCtx({ idleDays: 30 });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_08_idle');
  });

  it('fires crisis', () => {
    const ctx = makeCtx({ crisisActive: true });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_09_crisis');
  });

  it('fires first_winter', () => {
    const ctx = makeCtx({ isFirstWinter: true });
    const result = checkHistorian(ctx);
    expect(result.advice).not.toBeNull();
    expect(result.advice!.id).toBe('hist_11_first_winter');
  });

  it('skips already-seen advice', () => {
    const ctx = makeCtx({ isFirstDay: true, currentDay: 1, seenIds: new Set(['hist_01_first_game']) });
    const result = checkHistorian(ctx);
    expect(result.advice?.id).not.toBe('hist_01_first_game');
  });

  it('returns null when all conditions false', () => {
    const ctx = makeCtx();
    const result = checkHistorian(ctx);
    expect(result.advice).toBeNull();
  });

  it('returns null when all advice already seen', () => {
    const allIds = new Set(HISTORIAN_ADVICES.map(a => a.id));
    const ctx = makeCtx({ isFirstDay: true, crisisActive: true, seenIds: allIds });
    const result = checkHistorian(ctx);
    expect(result.advice).toBeNull();
  });

  it('fires only the first matching advice (priority order)', () => {
    const ctx = makeCtx({ isFirstDay: true, crisisActive: true, currentDay: 1 });
    const result = checkHistorian(ctx);
    expect(result.advice!.id).toBe('hist_01_first_game');
  });
});
