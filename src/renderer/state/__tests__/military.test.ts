import { describe, it, expect } from 'vitest';
import {
  getAvailableUnitTypes,
  computeArmyStrength,
  computeDefenseStrength,
  totalUnitCount,
  computeGrainCost,
  canLaunchExpedition,
  createExpedition,
  tickExpedition,
  resolveBattle,
  resolveDeter,
  computeNoInterceptLoss,
  applyMoraleChange,
  isRouted,
  computeRouteExtraLoss,
  type MilitaryContext,
} from '../militarySystem';
import { UNIT_DEFS, MORALE_CONFIG, DETER_CONFIG, EXPEDITION_DAYS } from '../../data/military';
import type { BuildingInstance } from '../../data/schema';
import { createRng } from '../rng';

function workingBuilding(defId: string): BuildingInstance {
  return { defId, position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] };
}

function baseCtx(overrides: Partial<MilitaryContext> = {}): MilitaryContext {
  return {
    grade: 2,
    buildings: [workingBuilding('bld_barracks')],
    adoptedPolicies: new Set(['pol_conscript']),
    soldierCount: 50,
    grain: 500,
    ...overrides,
  };
}

describe('B-1 military unit availability', () => {
  it('militia available at grade 1 with barracks', () => {
    const ctx = baseCtx({ grade: 1, adoptedPolicies: new Set() });
    const units = getAvailableUnitTypes(ctx);
    expect(units).toContain('militia');
    expect(units).not.toContain('infantry'); // needs pol_conscript
  });

  it('infantry/archer available at grade 2 with barracks + pol_conscript', () => {
    const ctx = baseCtx({ grade: 2 });
    const units = getAvailableUnitTypes(ctx);
    expect(units).toContain('infantry');
    expect(units).toContain('archer');
  });

  it('elite units need grade 3 + specific buildings', () => {
    const ctx = baseCtx({
      grade: 3,
      buildings: [workingBuilding('bld_barracks'), workingBuilding('bld_training_ground'), workingBuilding('bld_stable')],
    });
    const units = getAvailableUnitTypes(ctx);
    expect(units).toContain('elite_infantry');
    expect(units).toContain('cavalry');
    expect(units).not.toContain('chariot'); // no chariot_works
  });

  it('imperial_guard needs grade 4', () => {
    const ctx = baseCtx({
      grade: 3,
      buildings: [workingBuilding('bld_barracks'), workingBuilding('bld_imperial_guard')],
    });
    expect(getAvailableUnitTypes(ctx)).not.toContain('imperial_guard');
    const ctx4 = { ...ctx, grade: 4 };
    expect(getAvailableUnitTypes(ctx4)).toContain('imperial_guard');
  });
});

describe('B-1 army strength calculation', () => {
  it('basic strength = sum(atk * count) * morale factor', () => {
    const units = { militia: 10, infantry: 5 };
    const strength = computeArmyStrength(units, MORALE_CONFIG.initial);
    // 10*3 + 5*6 = 60, morale = 80/80 = 1.0
    expect(strength).toBe(60);
  });

  it('general command adds multiplier', () => {
    const units = { militia: 10 }; // 30 base
    const withGeneral = computeArmyStrength(units, 80, 50); // +50% from general
    expect(withGeneral).toBeCloseTo(45);
  });

  it('low morale reduces strength', () => {
    const units = { infantry: 10 }; // 60 base at morale 80
    const lowMorale = computeArmyStrength(units, 40); // 40/80 = 0.5
    expect(lowMorale).toBeCloseTo(30);
  });

  it('defense strength uses defense stat', () => {
    const units = { militia: 10 }; // def=4 each
    const def = computeDefenseStrength(units, 80);
    expect(def).toBe(40);
  });
});

describe('B-1 grain cost and unit count', () => {
  it('totalUnitCount sums all units', () => {
    expect(totalUnitCount({ militia: 5, infantry: 3, archer: 2 })).toBe(10);
  });

  it('computeGrainCost = sum(grainPerDay * count) * days', () => {
    const cost = computeGrainCost({ militia: 10, infantry: 5 }, 3);
    // militia: 2*10=20, infantry: 3*5=15 → 35/day × 3 = 105
    expect(cost).toBe(105);
  });
});

describe('B-1 expedition launch validation', () => {
  it('rejects no_units', () => {
    const result = canLaunchExpedition({ target: 'raid', npcId: 'npc_qi', units: {}, grainAllocated: 100 }, baseCtx());
    expect(result).toEqual({ ok: false, reason: 'no_units' });
  });

  it('rejects exceed_max_deploy (>80% soldiers)', () => {
    const ctx = baseCtx({ soldierCount: 10 }); // max = 8
    const result = canLaunchExpedition(
      { target: 'raid', npcId: 'npc_qi', units: { militia: 9 }, grainAllocated: 100 },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: 'exceed_max_deploy' });
  });

  it('rejects locked units', () => {
    const ctx = baseCtx({ grade: 1, adoptedPolicies: new Set() }); // only militia available
    const result = canLaunchExpedition(
      { target: 'raid', npcId: 'npc_qi', units: { infantry: 5 }, grainAllocated: 100 },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toContain('unit_locked');
  });

  it('rejects insufficient grain', () => {
    const ctx = baseCtx({ grain: 5 });
    const result = canLaunchExpedition(
      { target: 'raid', npcId: 'npc_qi', units: { militia: 10 }, grainAllocated: 100 },
      ctx,
    );
    expect(result).toEqual({ ok: false, reason: 'insufficient_grain_stock' });
  });

  it('accepts valid expedition', () => {
    const result = canLaunchExpedition(
      { target: 'raid', npcId: 'npc_qi', units: { militia: 10 }, grainAllocated: 100 },
      baseCtx(),
    );
    expect(result).toEqual({ ok: true });
  });
});

describe('B-1 expedition tick + battle resolution', () => {
  it('createExpedition sets days within range', () => {
    const rng = createRng(42);
    const exp = createExpedition(
      { target: 'raid', npcId: 'npc_qi', units: { militia: 10 }, grainAllocated: 100 },
      rng,
    );
    expect(exp.daysRemaining).toBeGreaterThanOrEqual(EXPEDITION_DAYS.raid.min);
    expect(exp.daysRemaining).toBeLessThanOrEqual(EXPEDITION_DAYS.raid.max);
    expect(exp.morale).toBe(MORALE_CONFIG.initial);
  });

  it('tickExpedition decrements days, drops morale on grain shortage', () => {
    const exp = createExpedition(
      { target: 'raid', npcId: 'npc_qi', units: { militia: 10 }, grainAllocated: 100 },
      createRng(1),
    );
    const ticked = tickExpedition(exp, 0); // no grain available
    expect(ticked.daysRemaining).toBe(exp.daysRemaining - 1);
    expect(ticked.morale).toBe(exp.morale + MORALE_CONFIG.grainShortagePerDay); // -5
  });

  it('resolveBattle: overwhelming strength → victory', () => {
    const rng = createRng(7);
    const result = resolveBattle(200, 50, 20, rng, false);
    expect(result.outcome).toBe('victory');
    expect(result.unitsLost).toBeLessThan(20);
    expect(result.lootGrain).toBeGreaterThan(0);
    expect(result.renownGain).toBeGreaterThan(0);
  });

  it('resolveBattle: much weaker → defeat', () => {
    const rng = createRng(7);
    const result = resolveBattle(20, 200, 20, rng, false);
    expect(result.outcome).toBe('defeat');
    expect(result.unitsLost).toBeGreaterThanOrEqual(10);
    expect(result.lootGrain).toBe(0);
    expect(result.renownGain).toBeLessThan(0);
  });

  it('resolveBattle: defense gets home bonus', () => {
    const rng1 = createRng(99);
    const rng2 = createRng(99);
    const attack = resolveBattle(100, 100, 20, rng1, false);
    const defend = resolveBattle(100, 100, 20, rng2, true);
    expect(defend.winChance).toBeGreaterThan(attack.winChance);
  });
});

describe('B-1 deterrence', () => {
  it('deter succeeds when my military > npc * 0.8', () => {
    const result = resolveDeter(100, 80);
    expect(result.ok).toBe(true);
    expect(result.deterDays).toBe(DETER_CONFIG.peaceDays);
    expect(result.stanceGain).toBe(DETER_CONFIG.stanceGain);
    expect(result.grainCost).toBeGreaterThan(0);
  });

  it('deter fails when my military < npc * 0.8', () => {
    const result = resolveDeter(50, 100);
    expect(result.ok).toBe(false);
    expect(result.deterDays).toBe(0);
  });
});

describe('B-1 defense / no-intercept', () => {
  it('computeNoInterceptLoss takes 15-25% resources + 10% people', () => {
    const rng = createRng(1);
    const result = computeNoInterceptLoss({ grain: 1000, gold: 200, people: 100 }, rng);
    expect(result.grainLost).toBeGreaterThanOrEqual(150);
    expect(result.grainLost).toBeLessThanOrEqual(250);
    expect(result.goldLost).toBeGreaterThanOrEqual(30);
    expect(result.goldLost).toBeLessThanOrEqual(50);
    expect(result.peopleLost).toBe(10);
  });
});

describe('B-1 morale rules', () => {
  it('applyMoraleChange clamps to [min, max]', () => {
    expect(applyMoraleChange(90, 20)).toBe(100);
    expect(applyMoraleChange(15, -10)).toBe(10);
    expect(applyMoraleChange(50, -30)).toBe(20);
  });

  it('isRouted returns true below threshold', () => {
    expect(isRouted(29)).toBe(true);
    expect(isRouted(30)).toBe(false);
    expect(isRouted(80)).toBe(false);
  });

  it('computeRouteExtraLoss = 20% of units lost', () => {
    expect(computeRouteExtraLoss(10)).toBe(2);
    expect(computeRouteExtraLoss(7)).toBe(1);
  });
});
