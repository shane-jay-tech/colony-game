import { describe, it, expect } from 'vitest';
import { tryAdoptDecree, tickActiveDecree } from '../decreeSystem';
import type { ActiveDecreeRecord } from '../decreeSystem';
import type { RoyalDecree } from '../../data/schema';
import type { CountryMetrics } from '../dslEval';

function decree(over: Partial<RoyalDecree> = {}): RoyalDecree {
  return {
    id: 'd1',
    name: '徵役令',
    category: '军事',
    description: '',
    descPlain: '',
    unlockCondition: [{ type: 'country_population', value: 100 }],
    stages: [
      {
        order: 1, cost: { gold: 50 }, days: 10,
        effects: [{ target: 'country_military_power', op: 'add', value: 8 }],
        removeEffects: [],
      },
      {
        order: 2, cost: { gold: 80 }, days: 15,
        effects: [{ target: 'country_military_power', op: 'mul', value: 1.2 }],
        removeEffects: [],
      },
    ],
    ...over,
  };
}

function ctx(over: Partial<CountryMetrics> = {}): CountryMetrics {
  return {
    resources: {}, population: 200, morale: 50, wrath: 0, militaryPower: 0,
    year: 0, season: 0, dayOfYear: 0, rng: () => 0.5, ...over,
  };
}

describe('tryAdoptDecree', () => {
  it('happy path — affordable + unlock met', () => {
    const result = tryAdoptDecree(decree(), [], { gold: 100 }, ctx());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deltas.gold).toBe(-50);
      expect(result.activeRecord).toEqual({ id: 'd1', currentStage: 0, daysElapsed: 0 });
    }
  });

  it('already_active blocks', () => {
    const result = tryAdoptDecree(
      decree(),
      [{ id: 'd1', currentStage: 0, daysElapsed: 5 }],
      { gold: 100 }, ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_active');
  });

  it('unlock condition unmet', () => {
    const result = tryAdoptDecree(decree(), [], { gold: 100 }, ctx({ population: 50 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unlock_condition_unmet');
  });

  it('insufficient resources', () => {
    const result = tryAdoptDecree(decree(), [], { gold: 10 }, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_resources');
  });

  // v1.0 #2：chain_locked 链路前置
  it('chain_locked: chainPrev set but not in completedIds → blocked', () => {
    const d2 = decree({ id: 'd2', chainPrev: 'd1' });
    const result = tryAdoptDecree(d2, [], { gold: 100 }, ctx(), []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('chain_locked');
  });

  it('chain_locked: chainPrev satisfied via completedIds → allowed', () => {
    const d2 = decree({ id: 'd2', chainPrev: 'd1' });
    const result = tryAdoptDecree(d2, [], { gold: 100 }, ctx(), ['d1']);
    expect(result.ok).toBe(true);
  });

  it('no chainPrev: completedIds irrelevant', () => {
    const result = tryAdoptDecree(decree(), [], { gold: 100 }, ctx(), []);
    expect(result.ok).toBe(true);
  });

  it('chain_locked checked before unlock_condition (so player sees clearer locked hint first)', () => {
    const d2 = decree({ id: 'd2', chainPrev: 'd1' });
    const result = tryAdoptDecree(d2, [], { gold: 100 }, ctx({ population: 0 }), []);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('chain_locked');
  });
});

describe('tickActiveDecree — staging', () => {
  it('not yet expired returns null', () => {
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 0, daysElapsed: 5 };
    expect(tickActiveDecree(decree(), rec, { gold: 1000 })).toBeNull();
  });

  it('stage 0 expires → advance to stage 1, deduct stage 1 cost', () => {
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 0, daysElapsed: 9 };
    const adv = tickActiveDecree(decree(), rec, { gold: 1000 });
    expect(adv).not.toBeNull();
    if (!adv) return;
    expect(adv.didStall).toBe(false);
    expect(adv.applyEffects).toBe(true);
    expect(adv.next).toEqual({ currentStage: 1, daysElapsed: 0 });
    expect(adv.costDeltas.gold).toBe(-80);
    expect(adv.modifier.effects[0]?.target).toBe('country_military_power');
  });

  it('stage 0 expires but cant afford stage 1 → didStall (first hit applies effects)', () => {
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 0, daysElapsed: 9 };
    const adv = tickActiveDecree(decree(), rec, { gold: 10 });
    expect(adv).not.toBeNull();
    if (!adv) return;
    expect(adv.didStall).toBe(true);
    expect(adv.applyEffects).toBe(true); // first stall: do apply effects
    expect(adv.next?.currentStage).toBe(0);
    // sentinel: daysElapsed > stage.days marks "effects applied, waiting for cost"
    expect(adv.next?.daysElapsed).toBe(11);
    expect(adv.costDeltas).toEqual({});
    expect(adv.modifier.effects[0]?.value).toBe(8);
  });

  it('subsequent stall ticks return null (no re-apply, no re-emit)', () => {
    // record already in stall sentinel (daysElapsed > stage.days)
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 0, daysElapsed: 11 };
    const adv = tickActiveDecree(decree(), rec, { gold: 10 });
    expect(adv).toBeNull();
  });

  it('stall recovery — when player pays up, advance without re-applying effects', () => {
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 0, daysElapsed: 11 };
    const adv = tickActiveDecree(decree(), rec, { gold: 1000 });
    expect(adv).not.toBeNull();
    if (!adv) return;
    expect(adv.applyEffects).toBe(false); // already applied earlier — skip add/remove
    expect(adv.next).toEqual({ currentStage: 1, daysElapsed: 0 });
    expect(adv.costDeltas.gold).toBe(-80);
  });

  it('last stage expires → next: null (decree completes)', () => {
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 1, daysElapsed: 14 };
    const adv = tickActiveDecree(decree(), rec, { gold: 1000 });
    expect(adv).not.toBeNull();
    if (!adv) return;
    expect(adv.next).toBeNull();
    expect(adv.didStall).toBe(false);
  });

  it('out-of-range stage returns null', () => {
    const rec: ActiveDecreeRecord = { id: 'd1', currentStage: 99, daysElapsed: 5 };
    expect(tickActiveDecree(decree(), rec, { gold: 1000 })).toBeNull();
  });
});

describe('tickActiveDecree — modifier id stability', () => {
  it('two stages produce different modifier ids', () => {
    const adv0 = tickActiveDecree(
      decree(),
      { id: 'd1', currentStage: 0, daysElapsed: 9 },
      { gold: 1000 },
    );
    const adv1 = tickActiveDecree(
      decree(),
      { id: 'd1', currentStage: 1, daysElapsed: 14 },
      { gold: 1000 },
    );
    expect(adv0?.modifier.id).not.toBe(adv1?.modifier.id);
  });
});
