import { describe, it, expect } from 'vitest';
import {
  createFactionState, shouldActivateFactions, scheduleFactionEvent,
  pickDemand, resolveDemand, tickFaction,
} from '../factionSystem';
import { FACTION_DEMANDS, FACTION_TRIGGER_POPULATION, FACTION_EVENT_INTERVAL_MIN, FACTION_EVENT_INTERVAL_MAX } from '../../data/factions';
import { createRng } from '../rng';

describe('B-4.1 faction activation', () => {
  it('activates at population >= 80', () => {
    expect(shouldActivateFactions(79)).toBe(false);
    expect(shouldActivateFactions(80)).toBe(true);
    expect(shouldActivateFactions(120)).toBe(true);
  });

  it('schedules event in 60-90 day range', () => {
    const rng = createRng(42);
    const day = scheduleFactionEvent(100, rng);
    expect(day).toBeGreaterThanOrEqual(100 + FACTION_EVENT_INTERVAL_MIN);
    expect(day).toBeLessThanOrEqual(100 + FACTION_EVENT_INTERVAL_MAX);
  });

  it('监察台 intervalFactor 拉长诉求间隔（同 seed 下 factor>1 不早于无加成）', () => {
    const baseDay = scheduleFactionEvent(100, createRng(7)) - 100;
    const extDay = scheduleFactionEvent(100, createRng(7), 1.3) - 100;
    // 同 rng 序列：基础间隔 * 1.3 四舍五入，必然 >= 基础（且通常更大）
    expect(extDay).toBe(Math.max(1, Math.round(baseDay * 1.3)));
    expect(extDay).toBeGreaterThanOrEqual(baseDay);
  });
});

describe('B-4.1 faction demand picking', () => {
  it('picks from available demands', () => {
    const rng = createRng(1);
    const demand = pickDemand([], rng);
    expect(demand).not.toBeNull();
    expect(FACTION_DEMANDS.some(d => d.demandId === demand!.demandId)).toBe(true);
  });

  it('excludes already used demands', () => {
    const rng = createRng(1);
    const used = FACTION_DEMANDS.slice(0, 2).map(d => d.demandId);
    const demand = pickDemand(used, rng);
    expect(demand).not.toBeNull();
    expect(used.includes(demand!.demandId)).toBe(false);
  });

  it('recycles when all used', () => {
    const rng = createRng(1);
    const allUsed = FACTION_DEMANDS.map(d => d.demandId);
    const demand = pickDemand(allUsed, rng);
    expect(demand).not.toBeNull();
  });
});

describe('B-4.1 faction resolve demand', () => {
  it('returns accept effect when accepted', () => {
    const demand = FACTION_DEMANDS[0]!;
    const { effect } = resolveDemand(demand, true);
    expect(effect).toEqual(demand.acceptEffect);
  });

  it('returns reject effect when rejected', () => {
    const demand = FACTION_DEMANDS[0]!;
    const { effect } = resolveDemand(demand, false);
    expect(effect).toEqual(demand.rejectEffect);
  });
});

describe('B-4.1 faction tick', () => {
  it('activates when population crosses threshold', () => {
    const state = createFactionState();
    const rng = createRng(1);
    const next = tickFaction(state, 85, 100, rng);
    expect(next.active).toBe(true);
    expect(next.nextEventDay).toBeGreaterThan(100);
  });

  it('does not activate below threshold', () => {
    const state = createFactionState();
    const rng = createRng(1);
    const next = tickFaction(state, 50, 100, rng);
    expect(next.active).toBe(false);
  });

  it('triggers demand when day >= nextEventDay', () => {
    const rng = createRng(1);
    const state = {
      ...createFactionState(),
      active: true,
      nextEventDay: 100,
    };
    const next = tickFaction(state, 90, 100, rng);
    expect(next.activeDemand).not.toBeNull();
    expect(next.lastEventDay).toBe(100);
  });

  it('does not re-trigger while demand is active', () => {
    const rng = createRng(1);
    const demand = FACTION_DEMANDS[0]!;
    const state = {
      ...createFactionState(),
      active: true,
      nextEventDay: 100,
      activeDemand: demand,
    };
    const next = tickFaction(state, 90, 120, rng);
    expect(next.activeDemand).toBe(demand);
  });
});
