import { describe, it, expect } from 'vitest';
import {
  createBreathingState,
  tickBreathingToast,
  tickBreathingBulletin,
  DEFAULT_BREATHING_CONFIG,
  type BreathingContext,
} from '../breathingSystem';
import { BREATHING_BULLETINS } from '../../data/breathingContent';

function makeCtx(overrides: Partial<BreathingContext> = {}): BreathingContext {
  return {
    currentDay: 50,
    season: 0,
    resources: { grain: 80, wood: 60, stone: 40, gold: 30, people: 25, cloth: 10, bronze: 5, rite: 0 },
    populationRatio: 0.5,
    buildingDefIds: new Set(['bld_farm', 'bld_house', 'bld_market']),
    hasHostileNpc: false,
    hasFriendlyNpc: true,
    crisisActive: false,
    grade: 2,
    lastEventDay: 0,
    ...overrides,
  };
}

let rngVal = 0.5;
const rng = () => rngVal;

describe('breathingSystem toast', () => {
  it('respects cooldown period', () => {
    const state = createBreathingState();
    state.lastToastDay = 45;
    const ctx = makeCtx({ currentDay: 50 });
    const result = tickBreathingToast(state, ctx, rng);
    expect(result.entry).toBeNull();
    expect(result.reason).toBe('cooldown');
  });

  it('triggers after cooldown passes', () => {
    const state = createBreathingState();
    state.lastToastDay = 30;
    const ctx = makeCtx({ currentDay: 50 });
    const result = tickBreathingToast(state, ctx, rng);
    expect(result.entry).not.toBeNull();
    expect(result.reason).toBe('triggered');
    expect(state.lastToastDay).toBe(50);
  });

  it('respects event cooldown', () => {
    const state = createBreathingState();
    const ctx = makeCtx({ currentDay: 50, lastEventDay: 47 });
    const result = tickBreathingToast(state, ctx, rng);
    expect(result.entry).toBeNull();
    expect(result.reason).toBe('event_recent');
  });

  it('does not repeat same entry within 30 days', () => {
    const state = createBreathingState();
    const ctx = makeCtx({ currentDay: 50 });
    // Trigger once
    rngVal = 0;
    const first = tickBreathingToast(state, ctx, rng);
    expect(first.entry).not.toBeNull();
    const firstId = first.entry!.id;

    // Try again at day 60 - should still be in cooldown for that specific entry
    state.lastToastDay = 50;
    const ctx2 = makeCtx({ currentDay: 60 });
    // Run multiple attempts — the same id shouldn't appear
    rngVal = 0;
    const attempts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const s2 = { ...state, lastToastDay: 48, recentIds: new Map(state.recentIds) };
      rngVal = i / 10;
      const r = tickBreathingToast(s2, ctx2, rng);
      if (r.entry) attempts.push(r.entry.id);
    }
    expect(attempts.every(id => id !== firstId)).toBe(true);
  });

  it('filters by season condition', () => {
    const state = createBreathingState();
    const ctx = makeCtx({ currentDay: 50, season: 3 }); // winter
    rngVal = 0.1;
    const result = tickBreathingToast(state, ctx, rng);
    if (result.entry) {
      // If it matched a season condition, it should be winter or always
      const cond = result.entry.condition;
      if (cond.type === 'season') expect(cond.season).toBe(3);
    }
  });
});

describe('breathingSystem bulletin', () => {
  it('respects cooldown period', () => {
    const state = createBreathingState();
    state.lastBulletinDay = 40;
    const ctx = makeCtx({ currentDay: 50 });
    const result = tickBreathingBulletin(state, ctx, rng);
    expect(result.entry).toBeNull();
    expect(result.reason).toBe('cooldown');
  });

  it('triggers after cooldown passes', () => {
    const state = createBreathingState();
    state.lastBulletinDay = 20;
    const ctx = makeCtx({ currentDay: 50 });
    rngVal = 0.3;
    const result = tickBreathingBulletin(state, ctx, rng);
    expect(result.entry).not.toBeNull();
    expect(result.reason).toBe('triggered');
    expect(result.entry!.kind).toBe('bulletin');
  });

  it('returns no_match when no conditions met', () => {
    const state = createBreathingState();
    // Remove all buildings, no hostile, no friendly, no crisis, low grade
    const ctx = makeCtx({
      currentDay: 50,
      buildingDefIds: new Set(),
      hasHostileNpc: false,
      hasFriendlyNpc: false,
      crisisActive: false,
      grade: 0,
      season: 0, // only season 0 and 'always' match
      resources: { grain: 0, wood: 0, stone: 0, gold: 0 },
    });
    // Mark all 'always' and season-0 bulletins as recently used
    for (const b of BREATHING_BULLETINS) {
      if (b.condition.type === 'always' || (b.condition.type === 'season' && b.condition.season === 0)) {
        state.recentIds.set(b.id, 45);
      }
    }
    const result = tickBreathingBulletin(state, ctx, rng);
    expect(result.entry).toBeNull();
    expect(result.reason).toBe('no_match');
  });
});

describe('createBreathingState', () => {
  it('initializes with negative lastDays (ready to fire)', () => {
    const state = createBreathingState();
    expect(state.lastToastDay).toBeLessThan(0);
    expect(state.lastBulletinDay).toBeLessThan(0);
    expect(state.recentIds.size).toBe(0);
  });
});

describe('config', () => {
  it('default config has correct intervals', () => {
    expect(DEFAULT_BREATHING_CONFIG.toastIntervalMin).toBe(8);
    expect(DEFAULT_BREATHING_CONFIG.toastIntervalMax).toBe(12);
    expect(DEFAULT_BREATHING_CONFIG.bulletinIntervalMin).toBe(15);
    expect(DEFAULT_BREATHING_CONFIG.bulletinIntervalMax).toBe(25);
    expect(DEFAULT_BREATHING_CONFIG.eventCooldown).toBe(5);
    expect(DEFAULT_BREATHING_CONFIG.repeatCooldown).toBe(30);
  });
});
