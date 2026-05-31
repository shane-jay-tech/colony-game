import { describe, it, expect } from 'vitest';
import { sampleEventTrigger, applyEventChoice, checkEventTimeout } from '../eventEngine';
import type { CourtEvent } from '../../data/schema';
import type { CountryMetrics } from '../dslEval';

function ev(over: Partial<CourtEvent> = {}): CourtEvent {
  return {
    id: 'evt_a',
    tags: ['负'],
    triggers: [{ condition: 'country_grain < 50' }],
    contexts: [{ condition: 'default', title: 'A', desc: 'desc', descPlain: 'plain' }],
    ...over,
  };
}

function ctx(over: Partial<CountryMetrics> = {}): CountryMetrics {
  return {
    resources: {}, population: 0, morale: 50, militaryPower: 0,
    year: 0, season: 0, dayOfYear: 0, rng: () => 0.5, ...over,
  };
}

describe('sampleEventTrigger — comparison triggers', () => {
  it('returns event id when trigger condition true', () => {
    const id = sampleEventTrigger([ev()], [], ctx({ resources: { grain: 10 } }));
    expect(id).toBe('evt_a');
  });

  it('returns null when condition false', () => {
    const id = sampleEventTrigger([ev()], [], ctx({ resources: { grain: 100 } }));
    expect(id).toBeNull();
  });

  it('AND semantics — all triggers must pass', () => {
    const e = ev({ triggers: [{ condition: 'country_grain < 50' }, { condition: 'year >= 5' }] });
    expect(sampleEventTrigger([e], [], ctx({ resources: { grain: 10 }, year: 2 }))).toBeNull();
    expect(sampleEventTrigger([e], [], ctx({ resources: { grain: 10 }, year: 5 }))).toBe('evt_a');
  });

  it('skips events already in history', () => {
    expect(sampleEventTrigger([ev()], ['evt_a'], ctx({ resources: { grain: 10 } }))).toBeNull();
  });

  it('returns first matching event when multiple defined', () => {
    const a = ev({ id: 'a', triggers: [{ condition: 'country_grain < 50' }] });
    const b = ev({ id: 'b', triggers: [{ condition: 'country_grain < 50' }] });
    expect(sampleEventTrigger([a, b], [], ctx({ resources: { grain: 10 } }))).toBe('a');
  });
});

describe('sampleEventTrigger — random triggers', () => {
  it('random fires when rng < probability', () => {
    const e = ev({ triggers: [{ condition: 'random', value: 0.5 }] });
    const id = sampleEventTrigger([e], [], ctx({ rng: () => 0.1 }));
    expect(id).toBe('evt_a');
  });

  it('random does not fire when rng >= probability', () => {
    const e = ev({ triggers: [{ condition: 'random', value: 0.5 }] });
    const id = sampleEventTrigger([e], [], ctx({ rng: () => 0.9 }));
    expect(id).toBeNull();
  });

  it('random missing value never fires (defensive)', () => {
    const e = ev({ triggers: [{ condition: 'random' }] });
    expect(sampleEventTrigger([e], [], ctx({ rng: () => 0 }))).toBeNull();
  });

  it('random + comparison both required (AND)', () => {
    const e = ev({ triggers: [
      { condition: 'random', value: 0.5 },
      { condition: 'season == summer' },
    ]});
    // random passes (0.1 < 0.5) but season=spring (0) → fail
    expect(sampleEventTrigger([e], [], ctx({ rng: () => 0.1, season: 0 }))).toBeNull();
    // both pass
    expect(sampleEventTrigger([e], [], ctx({ rng: () => 0.1, season: 1 }))).toBe('evt_a');
  });
});

describe('applyEventChoice', () => {
  const choiceEvt = ev({
    id: 'choice_evt',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 1 }],
    choices: [
      {
        text: 'opt 0', textPlain: '0',
        effects: [{ target: 'country_morale', op: 'add', value: 5 }],
        removeEffects: [],
      },
      {
        text: 'opt 1', textPlain: '1',
        effects: [],
        removeEffects: ['mod_to_remove'],
      },
    ],
    defaultTimeoutDays: 7,
  });

  it('applying choice 0 yields modifier with the right effects', () => {
    const r = applyEventChoice(choiceEvt, 0);
    expect(r.modifierToAdd).not.toBeNull();
    expect(r.modifierToAdd?.effects[0]?.value).toBe(5);
    expect(r.modifierToAdd?.remainingDays).toBe(30); // v0.7 default
    expect(r.modifiersToRemove).toEqual([]);
  });

  it('applying choice 1 yields no modifier but a removal request', () => {
    const r = applyEventChoice(choiceEvt, 1);
    expect(r.modifierToAdd).toBeNull();
    expect(r.modifiersToRemove).toEqual(['mod_to_remove']);
  });

  it('out-of-range idx returns no-op', () => {
    const r = applyEventChoice(choiceEvt, 99);
    expect(r.modifierToAdd).toBeNull();
    expect(r.modifiersToRemove).toEqual([]);
  });

  it('non-choice event returns no-op', () => {
    const r = applyEventChoice(ev(), 0);
    expect(r.modifierToAdd).toBeNull();
  });

  it('modifier id includes event id and choice idx (for stable de-dup)', () => {
    const r = applyEventChoice(choiceEvt, 0);
    expect(r.modifierToAdd?.id).toContain('choice_evt');
    expect(r.modifierToAdd?.id).toContain('choice0');
  });
});

describe('checkEventTimeout', () => {
  const e = ev({ defaultTimeoutDays: 7 });

  it('not yet timed out → null', () => {
    expect(checkEventTimeout(e, 6)).toBeNull();
  });

  it('exactly at timeout → pick0', () => {
    expect(checkEventTimeout(e, 7)).toBe('pick0');
  });

  it('past timeout → pick0', () => {
    expect(checkEventTimeout(e, 100)).toBe('pick0');
  });

  it('event with no defaultTimeoutDays never times out', () => {
    expect(checkEventTimeout(ev(), 1000)).toBeNull();
  });
});
