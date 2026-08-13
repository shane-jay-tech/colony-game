import { describe, it, expect, vi } from 'vitest';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { CONVERSION_DAYS, totalPopulation } from '../../data/populationClass';
import { computeClassOccupation, getIdleByClass, canAffordClass, tickConversionQueue, applyConversion, applyStarvation, computeClassConsumption } from '../populationClassSystem';
import type { BuildingInstance } from '../../data/schema';
import { getBuildingDef } from '../../data/buildingRegistry';

function makeEmitter(): IEventEmitter {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    on(ev, fn) { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev)!.add(fn); },
    off(ev, fn) { listeners.get(ev)?.delete(fn); },
    emit(ev, ...args) { listeners.get(ev)?.forEach(fn => fn(...args)); },
    listenerCount(ev) { return listeners.get(ev)?.size ?? 0; },
  };
}

function allPlainMap(): WorldMap {
  const tiles = Array.from({ length: 80 * 80 }, () => ({ terrain: 'plain' as const, buildable: true, walkable: true }));
  return { width: 80, height: 80, tiles, resourceNodes: [], seed: 1 };
}

const BIG_BOUNDS = { width: 80, height: 80 };

function newStore(overrides: Record<string, unknown> = {}): GameStore {
  return new GameStore(makeEmitter(), { worldMap: allPlainMap(), ...overrides } as any);
}

// ============== Pure function unit tests ==============

describe('populationClassSystem pure functions', () => {
  it('computeClassOccupation sums people by classType', () => {
    const buildings: BuildingInstance[] = [
      { defId: 'bld_market', position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] },
      { defId: 'bld_barracks', position: { x: 3, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] },
      { defId: 'bld_farm', position: { x: 6, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
      { defId: 'bld_smithy', position: { x: 0, y: 3 }, status: 'paused', tier: 2, constructionProgress: 100, modifiers: [] },
    ];
    const occ = computeClassOccupation(buildings, getBuildingDef);
    expect(occ.farmer).toBe(4); // bld_farm: 4 farmer（P2 农田用工下调）
    expect(occ.worker).toBe(4); // bld_market: 4 worker (smithy paused, not counted)
    expect(occ.soldier).toBe(6); // bld_barracks: 6 soldier
    expect(occ.scholar).toBe(0);
  });

  it('getIdleByClass returns max(0, pop - occ)', () => {
    const pop = { farmer: 10, worker: 5, soldier: 3, scholar: 2 };
    const occ = { farmer: 8, worker: 6, soldier: 1, scholar: 0 };
    const idle = getIdleByClass(pop, occ);
    expect(idle.farmer).toBe(2);
    expect(idle.worker).toBe(0); // clamped: 5-6=-1 → 0
    expect(idle.soldier).toBe(2);
    expect(idle.scholar).toBe(2);
  });

  it('canAffordClass checks idle >= count', () => {
    const pop = { farmer: 10, worker: 3, soldier: 2, scholar: 1 };
    const occ = { farmer: 5, worker: 3, soldier: 0, scholar: 0 };
    expect(canAffordClass(pop, occ, 'farmer', 5)).toBe(true);
    expect(canAffordClass(pop, occ, 'farmer', 6)).toBe(false);
    expect(canAffordClass(pop, occ, 'worker', 1)).toBe(false); // all occupied
    expect(canAffordClass(pop, occ, 'soldier', 2)).toBe(true);
  });

  it('tickConversionQueue decrements and separates completed', () => {
    const queue = [
      { from: 'farmer' as const, to: 'worker' as const, count: 3, daysRemaining: 1 },
      { from: 'farmer' as const, to: 'soldier' as const, count: 2, daysRemaining: 3 },
    ];
    const { completed, remaining } = tickConversionQueue(queue);
    expect(completed).toHaveLength(1);
    expect(completed[0]!.to).toBe('worker');
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.daysRemaining).toBe(2);
  });

  it('applyConversion moves count from source to target class', () => {
    const pop = { farmer: 10, worker: 2, soldier: 0, scholar: 0 };
    const order = { from: 'farmer' as const, to: 'worker' as const, count: 3, daysRemaining: 0 };
    const result = applyConversion(pop, order);
    expect(result.farmer).toBe(7);
    expect(result.worker).toBe(5);
  });

  it('computeClassConsumption totals per-class resource needs', () => {
    const pop = { farmer: 10, worker: 5, soldier: 3, scholar: 2 };
    const c = computeClassConsumption(pop);
    expect(c.totalGrain).toBeCloseTo(10 * 0.8 + 5 * 1.5 + 3 * 2 + 2 * 2); // 8+7.5+6+4=25.5
    expect(c.totalCloth).toBeCloseTo(5 * 0.2); // 1
    expect(c.totalBronze).toBeCloseTo(3 * 0.3); // 0.9
    expect(c.totalGold).toBeCloseTo(2 * 1); // 2
  });

  it('applyStarvation: no loss within grace period', () => {
    const pop = { farmer: 100, worker: 0, soldier: 0, scholar: 0 };
    const result = applyStarvation(pop, 4); // graceDays=5
    expect(result.peopleLost).toBe(0);
    expect(result.moralePenalty).toBe(0);
  });

  it('applyStarvation: mild loss after grace (2%)', () => {
    const pop = { farmer: 100, worker: 0, soldier: 0, scholar: 0 };
    const result = applyStarvation(pop, 6);
    expect(result.peopleLost).toBe(2); // floor(100*0.02)=2
    expect(result.pop.farmer).toBe(98);
    expect(result.moralePenalty).toBe(0); // mild has no morale penalty
  });

  it('applyStarvation: severe loss after 15 days (5% + morale)', () => {
    const pop = { farmer: 100, worker: 0, soldier: 0, scholar: 0 };
    const result = applyStarvation(pop, 16);
    expect(result.peopleLost).toBe(5); // floor(100*0.05)=5
    expect(result.pop.farmer).toBe(95);
    expect(result.moralePenalty).toBe(3); // moralePenaltyPerDay
  });

  it('applyStarvation respects minimumPopulation', () => {
    const pop = { farmer: 5, worker: 0, soldier: 0, scholar: 0 };
    const result = applyStarvation(pop, 20);
    expect(result.peopleLost).toBe(0); // at minimum, no further loss
    expect(result.pop.farmer).toBe(5);
  });
});

// ============== GameStore integration tests ==============

describe('B-0 Population class system (GameStore integration)', () => {
  it('constructor syncs resources.people → populationClasses.farmer', () => {
    const store = newStore({ resources: { people: 25 } });
    const classes = store.getPopulationClasses();
    expect(classes.farmer).toBe(25);
    expect(totalPopulation(classes)).toBe(25);
  });

  it('placeBuilding rejects when total idle < needed (auto-recruit)', () => {
    const store = newStore({
      resources: { wood: 200, stone: 200, cloth: 50, people: 3 },
      populationClasses: { farmer: 3, worker: 0, soldier: 0, scholar: 0 },
      policies: [{ id: 'pol_market', adopted: true }],
    });
    const marketDef = getBuildingDef('bld_market')!; // requires 4 people
    const result = store.placeBuilding(marketDef, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'insufficient_labor' });
  });

  it('placeBuilding succeeds and auto-recruits idle to target class', () => {
    const store = newStore({
      resources: { wood: 200, stone: 200, cloth: 50, people: 20 },
      populationClasses: { farmer: 15, worker: 3, soldier: 2, scholar: 0 },
      policies: [{ id: 'pol_market', adopted: true }],
    });
    const marketDef = getBuildingDef('bld_market')!; // needs 4 worker-class
    const result = store.placeBuilding(marketDef, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: true });
    // Auto-recruit: 1 farmer converted to worker to fill deficit
    const classes = store.getPopulationClasses();
    expect(classes.worker).toBe(4); // was 3, recruited 1 from farmer
    expect(classes.farmer).toBe(14); // was 15, lost 1
  });

  it('startConversion deducts from source class and queues', () => {
    const store = newStore({
      resources: { people: 20, grain: 100 },
      populationClasses: { farmer: 15, worker: 5, soldier: 0, scholar: 0 },
      buildings: [
        { defId: 'bld_barracks', position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] },
      ],
    });
    const ok = store.startConversion('farmer', 'soldier', 3);
    expect(ok).toBe(true);
    expect(store.getPopulationClasses().farmer).toBe(12); // 15 - 3
    expect(store.getConversionQueue()).toHaveLength(1);
    expect(store.getConversionQueue()[0]).toMatchObject({
      from: 'farmer', to: 'soldier', count: 3, daysRemaining: CONVERSION_DAYS,
    });
  });

  it('startConversion fails without required building', () => {
    const store = newStore({
      resources: { people: 20 },
      populationClasses: { farmer: 15, worker: 5, soldier: 0, scholar: 0 },
      buildings: [], // no barracks
    });
    const ok = store.startConversion('farmer', 'soldier', 3);
    expect(ok).toBe(false);
    expect(store.getPopulationClasses().farmer).toBe(15);
  });

  it('startConversion fails with insufficient idle class population', () => {
    const store = newStore({
      resources: { people: 20 },
      populationClasses: { farmer: 2, worker: 18, soldier: 0, scholar: 0 },
      buildings: [
        { defId: 'bld_barracks', position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] },
      ],
    });
    // Trying to convert 3 farmers but only 2 exist (and bld_farm might be occupying some)
    const ok = store.startConversion('farmer', 'soldier', 3);
    expect(ok).toBe(false);
  });

  it('conversion queue completes after CONVERSION_DAYS ticks', () => {
    const store = newStore({
      resources: { people: 20, grain: 1000 },
      populationClasses: { farmer: 15, worker: 5, soldier: 0, scholar: 0 },
      buildings: [
        { defId: 'bld_barracks', position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] },
      ],
    });
    store.startConversion('farmer', 'soldier', 2);
    expect(store.getPopulationClasses().soldier).toBe(0);
    // Tick CONVERSION_DAYS times
    for (let i = 0; i < CONVERSION_DAYS; i++) store.tickDay();
    expect(store.getPopulationClasses().soldier).toBe(2);
    expect(store.getConversionQueue()).toHaveLength(0);
  });

  it('starvation kicks in when grain < consumption after grace period', () => {
    const store = newStore({
      resources: { people: 50, grain: 0 },
      populationClasses: { farmer: 50, worker: 0, soldier: 0, scholar: 0 },
      buildings: [],
    });
    const peopleBefore = store.getResources().people ?? 0;
    // Grace period: first 4 days no loss (graceDays=5 means day 5 onwards hurts)
    for (let i = 0; i < 4; i++) store.tickDay();
    expect(store.getResources().people).toBe(peopleBefore);
    // Day 5+: starvation begins (grainNegativeDays reaches graceDays threshold)
    store.tickDay();
    expect((store.getResources().people ?? 0)).toBeLessThan(peopleBefore);
  });

  it('populationClasses stays in sync with resources.people', () => {
    const store = newStore({
      resources: { people: 30, grain: 500 },
      populationClasses: { farmer: 30, worker: 0, soldier: 0, scholar: 0 },
      buildings: [
        { defId: 'bld_house', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
      ],
    });
    // After many ticks, people should grow (house gives housing cap)
    for (let i = 0; i < 30; i++) store.tickDay();
    const people = store.getResources().people ?? 0;
    const classTotal = totalPopulation(store.getPopulationClasses());
    expect(classTotal).toBe(people);
  });

  it('new population growth goes to farmer class', () => {
    const store = newStore({
      resources: { people: 10, grain: 500 },
      populationClasses: { farmer: 8, worker: 2, soldier: 0, scholar: 0 },
      buildings: [
        { defId: 'bld_house', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
      ],
    });
    for (let i = 0; i < 20; i++) store.tickDay();
    const classes = store.getPopulationClasses();
    // Workers stay at 2, all growth went to farmer
    expect(classes.worker).toBe(2);
    expect(classes.farmer).toBeGreaterThan(8);
  });

  it('getIdleByClass returns per-class idle counts', () => {
    const store = newStore({
      resources: { people: 20 },
      populationClasses: { farmer: 10, worker: 5, soldier: 3, scholar: 2 },
      buildings: [
        { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
        { defId: 'bld_market', position: { x: 3, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] },
      ],
    });
    const idle = store.getIdleByClass();
    expect(idle.farmer).toBe(6); // 10 - 4(farm)
    expect(idle.worker).toBe(1); // 5 - 4(market)
    expect(idle.soldier).toBe(3); // no soldier buildings
    expect(idle.scholar).toBe(2);
  });
});
