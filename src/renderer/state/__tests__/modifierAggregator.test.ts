import { describe, it, expect } from 'vitest';
import {
  aggregateModifiers,
  applyModifiers,
  getMulFactor,
  getAddDelta,
  effectsToModifierInstance,
} from '../modifierAggregator';
import type { ModifierInstance, ModifierEffect } from '../../data/schema';

function mod(id: string, effects: ModifierEffect[]): ModifierInstance {
  return {
    id, name: id, category: 'economy', stackable: true,
    effects, visualBadge: null, remainingDays: -1,
    description: '', descPlain: '',
  };
}

describe('aggregateModifiers', () => {
  it('empty list returns identity', () => {
    const b = aggregateModifiers('country_grain_output', []);
    expect(b.addSum).toBe(0);
    expect(b.mulProduct).toBe(1);
    expect(b.hitCount).toBe(0);
  });

  it('sums multiple add hits', () => {
    const ms = [
      mod('a', [{ target: 'country_grain_output', op: 'add', value: 5 }]),
      mod('b', [{ target: 'country_grain_output', op: 'add', value: 3 }]),
    ];
    const b = aggregateModifiers('country_grain_output', ms);
    expect(b.addSum).toBe(8);
    expect(b.mulProduct).toBe(1);
    expect(b.hitCount).toBe(2);
  });

  it('multiplies multiple mul hits', () => {
    const ms = [
      mod('a', [{ target: 'country_grain_output', op: 'mul', value: 1.2 }]),
      mod('b', [{ target: 'country_grain_output', op: 'mul', value: 0.5 }]),
    ];
    const b = aggregateModifiers('country_grain_output', ms);
    expect(b.mulProduct).toBeCloseTo(0.6);
    expect(b.addSum).toBe(0);
    expect(b.hitCount).toBe(2);
  });

  it('different targets do not interfere', () => {
    const ms = [
      mod('a', [{ target: 'country_grain_output', op: 'add', value: 5 }]),
      mod('b', [{ target: 'country_wood_output', op: 'add', value: 100 }]),
    ];
    const b = aggregateModifiers('country_grain_output', ms);
    expect(b.addSum).toBe(5);
  });
});

describe('applyModifiers — (base + add) × mul', () => {
  it('base 10 + add 5 × mul 2 = 30', () => {
    const ms = [
      mod('a', [{ target: 'country_grain_output', op: 'add', value: 5 }]),
      mod('b', [{ target: 'country_grain_output', op: 'mul', value: 2 }]),
    ];
    expect(applyModifiers(10, 'country_grain_output', ms)).toBe(30);
  });

  it('base 10 with no modifiers = 10', () => {
    expect(applyModifiers(10, 'country_grain_output', [])).toBe(10);
  });

  it('base 50 morale + add 10 + mul 1.2 = 72', () => {
    const ms = [
      mod('a', [{ target: 'country_morale', op: 'add', value: 10 }]),
      mod('b', [{ target: 'country_morale', op: 'mul', value: 1.2 }]),
    ];
    expect(applyModifiers(50, 'country_morale', ms)).toBe(72);
  });
});

describe('getMulFactor / getAddDelta', () => {
  it('getMulFactor returns 1 when no hits', () => {
    expect(getMulFactor('country_grain_output', [])).toBe(1);
  });
  it('getAddDelta returns 0 when no hits', () => {
    expect(getAddDelta('country_grain_output', [])).toBe(0);
  });
});

describe('effectsToModifierInstance', () => {
  it('factory sets defaults correctly', () => {
    const m = effectsToModifierInstance({
      id: 'm1',
      name: 'Test',
      category: 'culture',
      effects: [{ target: 'country_morale', op: 'add', value: 5 }],
      remainingDays: 30,
    });
    expect(m.id).toBe('m1');
    expect(m.stackable).toBe(false); // default
    expect(m.visualBadge).toBeNull();
    expect(m.description).toBe(''); // default
  });
});
