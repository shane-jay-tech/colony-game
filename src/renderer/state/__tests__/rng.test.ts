import { describe, it, expect } from 'vitest';
import { createRng, restoreRng } from '../rng';

describe('createRng', () => {
  it('same seed produces same sequence of 10 values', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('getSeed then restoreRng gives identical continuation', () => {
    const rng = createRng(99);
    // advance 5 steps
    for (let i = 0; i < 5; i++) rng.next();
    const savedSeed = rng.getSeed();
    // collect next 10 values from original
    const origValues = Array.from({ length: 10 }, () => rng.next());
    // restore and collect 10 values
    const restored = restoreRng(savedSeed);
    const restoredValues = Array.from({ length: 10 }, () => restored.next());
    expect(restoredValues).toEqual(origValues);
  });

  it('nextInt stays within [1,6] over 100 draws', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('chance(1.0) always returns true', () => {
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) {
      expect(rng.chance(1.0)).toBe(true);
    }
  });

  it('chance(0.0) always returns false', () => {
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) {
      expect(rng.chance(0.0)).toBe(false);
    }
  });

  it('pick throws on empty array', () => {
    const rng = createRng(1);
    expect(() => rng.pick([])).toThrow();
  });
});
