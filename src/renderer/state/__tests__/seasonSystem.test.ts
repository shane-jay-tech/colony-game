import { describe, it, expect } from 'vitest';
import {
  makeSeasonModifier,
  isSeasonModifier,
  applySeasonTransition,
  SEASON_EFFECTS,
  SEASON_MODIFIER_PREFIX,
} from '../seasonSystem';
import type { ModifierInstance } from '../../data/schema';

function fakeModifier(id: string): ModifierInstance {
  return { id, name: id, category: 'economy', effects: [], remainingDays: 10, description: '', descPlain: '', stackable: false, visualBadge: null };
}

describe('makeSeasonModifier', () => {
  it('creates spring modifier with correct id and effects', () => {
    const m = makeSeasonModifier(0);
    expect(m.id).toBe(`${SEASON_MODIFIER_PREFIX}0`);
    expect(m.name).toBe('春·播种季');
    expect(m.remainingDays).toBe(-1);
    expect(m.effects.length).toBeGreaterThan(0);
    expect(m.effects.some(e => e.target === 'country_grain_output' && e.op === 'mul')).toBe(true);
  });

  it('creates winter modifier with construction slowdown', () => {
    const m = makeSeasonModifier(3);
    expect(m.name).toBe('冬·休整季');
    expect(m.effects.some(e => e.target === 'building_construction_speed' && e.value < 1)).toBe(true);
  });

  it('creates summer modifier with population growth', () => {
    const m = makeSeasonModifier(1);
    expect(m.effects.some(e => e.target === 'country_population_growth' && e.value === 1.5)).toBe(true);
  });

  it('creates autumn modifier with all-resource boost', () => {
    const m = makeSeasonModifier(2);
    expect(m.effects.length).toBeGreaterThanOrEqual(5);
    expect(m.effects.some(e => e.target === 'country_gold_output' && e.value === 1.3)).toBe(true);
  });
});

describe('isSeasonModifier', () => {
  it('detects season modifier by prefix', () => {
    expect(isSeasonModifier(makeSeasonModifier(0))).toBe(true);
    expect(isSeasonModifier(makeSeasonModifier(3))).toBe(true);
  });

  it('rejects non-season modifiers', () => {
    expect(isSeasonModifier(fakeModifier('event_modifier_test'))).toBe(false);
    expect(isSeasonModifier(fakeModifier('policy_farm'))).toBe(false);
  });
});

describe('applySeasonTransition', () => {
  it('removes old season modifier and adds new one', () => {
    const modifiers = [fakeModifier('policy_a'), makeSeasonModifier(0)];
    const result = applySeasonTransition(modifiers, 1);
    expect(result.some(m => m.id === `${SEASON_MODIFIER_PREFIX}1`)).toBe(true);
    expect(result.some(m => m.id === `${SEASON_MODIFIER_PREFIX}0`)).toBe(false);
    expect(result.some(m => m.id === 'policy_a')).toBe(true);
  });

  it('works with no prior season modifier', () => {
    const modifiers = [fakeModifier('event_x')];
    const result = applySeasonTransition(modifiers, 2);
    expect(result.length).toBe(2);
    expect(result.some(m => m.id === `${SEASON_MODIFIER_PREFIX}2`)).toBe(true);
  });

  it('does not stack multiple season modifiers', () => {
    const modifiers = [makeSeasonModifier(0), makeSeasonModifier(1)];
    const result = applySeasonTransition(modifiers, 3);
    const seasonMods = result.filter(m => isSeasonModifier(m));
    expect(seasonMods.length).toBe(1);
    expect(seasonMods[0]!.id).toBe(`${SEASON_MODIFIER_PREFIX}3`);
  });
});

describe('SEASON_EFFECTS coverage', () => {
  it('all four seasons have definitions', () => {
    expect(SEASON_EFFECTS[0]).toBeDefined();
    expect(SEASON_EFFECTS[1]).toBeDefined();
    expect(SEASON_EFFECTS[2]).toBeDefined();
    expect(SEASON_EFFECTS[3]).toBeDefined();
  });

  it('no season has empty effects', () => {
    for (const s of [0, 1, 2, 3] as const) {
      expect(SEASON_EFFECTS[s].effects.length).toBeGreaterThan(0);
    }
  });
});
