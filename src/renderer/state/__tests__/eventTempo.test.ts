import { describe, it, expect } from 'vitest';
import {
  assessNationState,
  shouldSampleEvent,
  filterEventsByState,
  DEFAULT_TEMPO_CONFIG,
  type NationStateInput,
} from '../eventTempo';
import type { CourtEvent, NpcCountryState } from '../../data/schema';

function npc(over: Partial<NpcCountryState> = {}): NpcCountryState {
  return {
    id: 'npc_a', stance: 10, militaryPower: 20, renown: 0,
    tradeRoute: false, tradeCooldown: 0, warStatus: 'peace',
    lastEnvoyDay: 0, lastWarDay: 0, allyIds: [], aggression: 0, lastActionDay: 0,
    ...over,
  };
}

function makeInput(over: Partial<NationStateInput> = {}): NationStateInput {
  return {
    crisisActive: false,
    npcCountries: [npc()],
    grainCapacityRatio: 0.7,
    goldAmount: 30,
    ...over,
  };
}

// ─── assessNationState ──────────────────────────────────────

describe('assessNationState', () => {
  it('returns crisis when crisisActive', () => {
    expect(assessNationState(makeInput({ crisisActive: true }))).toBe('crisis');
  });

  it('crisis takes priority over tense indicators', () => {
    expect(assessNationState(makeInput({
      crisisActive: true,
      grainCapacityRatio: 0.1,
    }))).toBe('crisis');
  });

  it('returns tense when grain ratio < 0.2', () => {
    expect(assessNationState(makeInput({ grainCapacityRatio: 0.15 }))).toBe('tense');
  });

  it('returns tense when gold < 5', () => {
    expect(assessNationState(makeInput({ goldAmount: 3 }))).toBe('tense');
  });

  it('returns tense when any NPC hostile (stance < -30)', () => {
    expect(assessNationState(makeInput({
      npcCountries: [npc({ id: 'x', stance: -40, militaryPower: 10 })],
    }))).toBe('tense');
  });

  it('returns peaceful when grain > 50% and gold > 20 and no hostiles', () => {
    expect(assessNationState(makeInput({
      grainCapacityRatio: 0.6,
      goldAmount: 25,
      npcCountries: [npc({ id: 'x', stance: 20, militaryPower: 10 })],
    }))).toBe('peaceful');
  });

  it('returns developing as default when not clearly peaceful or tense', () => {
    expect(assessNationState(makeInput({
      grainCapacityRatio: 0.35,
      goldAmount: 15,
    }))).toBe('developing');
  });
});

// ─── shouldSampleEvent ──────────────────────────────────────

describe('shouldSampleEvent', () => {
  it('blocks during anti-combo window', () => {
    const d = shouldSampleEvent(5, 'developing', 0.5);
    expect(d.shouldSample).toBe(false);
    expect(d.reason).toBe('anti_combo');
  });

  it('forces trigger after forceMaxDays', () => {
    const d = shouldSampleEvent(50, 'peaceful', 0.99);
    expect(d.shouldSample).toBe(true);
    expect(d.reason).toBe('force_trigger');
  });

  it('force trigger overrides anti-combo (config edge case)', () => {
    const config = { ...DEFAULT_TEMPO_CONFIG, forceMaxDays: 5, antiComboDays: 10 };
    const d = shouldSampleEvent(6, 'peaceful', 0.5, config);
    expect(d.shouldSample).toBe(true);
    expect(d.reason).toBe('force_trigger');
  });

  it('peaceful: samples when past threshold (rng=0 → min=35)', () => {
    const d = shouldSampleEvent(35, 'peaceful', 0);
    expect(d.shouldSample).toBe(true);
    expect(d.reason).toBe('interval_met');
  });

  it('peaceful: waits when below threshold (rng=1 → max=50)', () => {
    const d = shouldSampleEvent(40, 'peaceful', 1);
    expect(d.shouldSample).toBe(false);
    expect(d.reason).toBe('waiting');
  });

  it('crisis: short interval triggers quickly (rng=0 → min=10)', () => {
    const d = shouldSampleEvent(10, 'crisis', 0);
    expect(d.shouldSample).toBe(true);
  });

  it('developing: mid range (rng=0.5 → threshold=30)', () => {
    const d = shouldSampleEvent(30, 'developing', 0.5);
    expect(d.shouldSample).toBe(true);
  });

  it('developing: below mid range waits (rng=0.5 → threshold=30)', () => {
    const d = shouldSampleEvent(28, 'developing', 0.5);
    expect(d.shouldSample).toBe(false);
  });

  it('respects custom config (lower anti-combo)', () => {
    const config = { ...DEFAULT_TEMPO_CONFIG, antiComboDays: 12 };
    // daysSinceLast=10 < antiComboDays=12 → blocked
    const d = shouldSampleEvent(10, 'crisis', 0, config);
    expect(d.shouldSample).toBe(false);
    expect(d.reason).toBe('anti_combo');
  });

  it('respects custom config (lower forceMax)', () => {
    const config = { ...DEFAULT_TEMPO_CONFIG, forceMaxDays: 30 };
    const d = shouldSampleEvent(30, 'peaceful', 1, config);
    expect(d.shouldSample).toBe(true);
    expect(d.reason).toBe('force_trigger');
  });
});

// ─── filterEventsByState ────────────────────────────────────

function evt(id: string, tags: CourtEvent['tags']): CourtEvent {
  return {
    id,
    tags,
    triggers: [{ condition: 'random', value: 0.5 }],
    contexts: [{ condition: 'default', title: id, desc: '', descPlain: '' }],
  };
}

describe('filterEventsByState', () => {
  const pool = [
    evt('good', ['正']),
    evt('bad', ['负']),
    evt('choice_bad', ['抉择', '负']),
    evt('choice_good', ['抉择', '正']),
    evt('neutral', ['中']),
  ];

  it('peaceful: blocks pure negative, keeps choices', () => {
    const filtered = filterEventsByState(pool, 'peaceful');
    const ids = filtered.map(e => e.id);
    expect(ids).toContain('good');
    expect(ids).toContain('choice_bad');
    expect(ids).toContain('choice_good');
    expect(ids).toContain('neutral');
    expect(ids).not.toContain('bad');
  });

  it('crisis: blocks pure positive, keeps choices', () => {
    const filtered = filterEventsByState(pool, 'crisis');
    const ids = filtered.map(e => e.id);
    expect(ids).toContain('bad');
    expect(ids).toContain('choice_bad');
    expect(ids).toContain('choice_good');
    expect(ids).toContain('neutral');
    expect(ids).not.toContain('good');
  });

  it('developing: no filtering', () => {
    const filtered = filterEventsByState(pool, 'developing');
    expect(filtered.length).toBe(pool.length);
  });

  it('tense: no filtering', () => {
    const filtered = filterEventsByState(pool, 'tense');
    expect(filtered.length).toBe(pool.length);
  });
});
