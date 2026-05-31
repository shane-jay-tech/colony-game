import { describe, it, expect } from 'vitest';
import {
  clampAxis, checkUnification, axisSeedForPath, powerBand, resourceBand,
  SUBJUGATE_MP_THRESHOLD, UNIFY_RENOWN_THRESHOLD,
} from '../storyDriver';

describe('clampAxis', () => {
  it('钳制到 -100..100', () => {
    expect(clampAxis(200)).toBe(100);
    expect(clampAxis(-200)).toBe(-100);
    expect(clampAxis(30)).toBe(30);
  });
});

describe('checkUnification（序章多途径）', () => {
  it('无 NPC → 不算统一', () => {
    expect(checkUnification({ npcs: [], playerRenown: 999 })).toEqual({ unified: false, path: null });
  });
  it('武途：所有 NPC 军力被打服 → martial', () => {
    const npcs = [{ militaryPower: SUBJUGATE_MP_THRESHOLD, stance: -50 }, { militaryPower: 10, stance: 0 }];
    expect(checkUnification({ npcs, playerRenown: 0 })).toEqual({ unified: true, path: 'martial' });
  });
  it('文途：信誉达标 + 多数归附 → cultural', () => {
    const npcs = [
      { militaryPower: 80, stance: 70 }, { militaryPower: 90, stance: 65 },
      { militaryPower: 60, stance: 10 }, { militaryPower: 50, stance: 80 },
    ]; // 4 个里 3 个 stance≥60 = 多数(⌈2.4⌉=3)
    expect(checkUnification({ npcs, playerRenown: UNIFY_RENOWN_THRESHOLD })).toEqual({ unified: true, path: 'cultural' });
  });
  it('两途均不达 → 不统一', () => {
    const npcs = [{ militaryPower: 80, stance: 10 }, { militaryPower: 90, stance: -20 }];
    expect(checkUnification({ npcs, playerRenown: 50 })).toEqual({ unified: false, path: null });
  });
  it('信誉够但归附不过半 → 不统一', () => {
    const npcs = [{ militaryPower: 80, stance: 70 }, { militaryPower: 90, stance: 0 }, { militaryPower: 60, stance: 0 }];
    expect(checkUnification({ npcs, playerRenown: 200 }).unified).toBe(false);
  });
});

describe('axisSeedForPath', () => {
  it('武途偏集权(负)、文途偏还权(正)', () => {
    expect(axisSeedForPath('martial').power).toBeLessThan(0);
    expect(axisSeedForPath('cultural').power).toBeGreaterThan(0);
  });
});

describe('双轴档位', () => {
  it('powerBand 三档', () => {
    expect(powerBand(-50)).toBe('centralize');
    expect(powerBand(0)).toBe('neutral');
    expect(powerBand(50)).toBe('devolve');
  });
  it('resourceBand 三档', () => {
    expect(resourceBand(-50)).toBe('private');
    expect(resourceBand(0)).toBe('neutral');
    expect(resourceBand(50)).toBe('public');
  });
});
