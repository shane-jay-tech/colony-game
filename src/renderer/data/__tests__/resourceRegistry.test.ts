import { describe, expect, it } from 'vitest';
import { canAfford, addBags, isValidResourceId, isValidModifierTarget } from '../resourceRegistry';

describe('canAfford', () => {
  it('returns true when bag covers cost exactly', () => {
    expect(canAfford({ wood: 20, grain: 5 }, { wood: 20, grain: 5 })).toBe(true);
  });

  it('returns true when bag exceeds cost', () => {
    expect(canAfford({ wood: 100 }, { wood: 20 })).toBe(true);
  });

  it('returns false when bag is short', () => {
    expect(canAfford({ wood: 5 }, { wood: 20 })).toBe(false);
  });

  it('returns false when a required resource is missing from bag', () => {
    expect(canAfford({}, { wood: 1 })).toBe(false);
  });

  it('returns true when cost has zero entries', () => {
    expect(canAfford({}, { wood: 0 })).toBe(true);
  });

  it('returns false when ANY cost entry is negative (corruption guard)', () => {
    expect(canAfford({ wood: 100 }, { wood: -5 })).toBe(false);
  });

  it('returns false when one of multiple costs is negative even if affordable', () => {
    expect(canAfford({ wood: 100, grain: 100 }, { wood: 20, grain: -1 })).toBe(false);
  });
});

describe('addBags', () => {
  it('sums two bags element-wise', () => {
    expect(addBags({ wood: 10, grain: 5 }, { wood: 3, stone: 2 })).toEqual({ wood: 13, grain: 5, stone: 2 });
  });

  it('handles missing keys as 0', () => {
    expect(addBags({}, { wood: 7 })).toEqual({ wood: 7 });
  });
});

describe('isValidResourceId / isValidModifierTarget', () => {
  it('grain is a valid resource', () => {
    expect(isValidResourceId('grain')).toBe(true);
  });

  it('typo is not a valid resource', () => {
    expect(isValidResourceId('grane')).toBe(false);
  });

  it('country_grain_output is valid', () => {
    expect(isValidModifierTarget('country_grain_output')).toBe(true);
  });

  it('typo modifier target is invalid', () => {
    expect(isValidModifierTarget('country_grane_output')).toBe(false);
  });
});
