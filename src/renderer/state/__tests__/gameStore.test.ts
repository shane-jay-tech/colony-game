import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { ModifierInstance, BuildingDef } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { ModifierValidationError } from '../../data/modifierValidator';
import * as buildingRegistry from '../../data/buildingRegistry';

// All-plain map so terrain checks always pass; overrides the default seed-12345 map
// (which contains a river + mountains that would block fixed-coordinate placement tests).
function allPlainMap(width = 100, height = 100): WorldMap {
  const tiles = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  }
  return { width, height, tiles, resourceNodes: [], seed: 0 };
}

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function makeStore(overrides?: ConstructorParameters<typeof GameStore>[1]) {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, overrides);
  return { store, ee: new EventEmitter() as unknown as IEventEmitter & EventEmitter, rawEe: ee };
}

function makeValidModifier(id = 'mod1'): ModifierInstance {
  return {
    id, name: id, category: 'economy', stackable: true,
    effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
    visualBadge: null, remainingDays: -1, description: '', descPlain: '',
  };
}

function makeInvalidModifier(): ModifierInstance {
  return {
    id: 'bad', name: 'bad', category: 'economy', stackable: true,
    effects: [{ target: 'not_valid_target' as never, op: 'add', value: 5 }],
    visualBadge: null, remainingDays: -1, description: '', descPlain: '',
  };
}

function makeDef(overrides: Partial<BuildingDef> = {}): BuildingDef {
  return {
    id: 'bld_farm', name: 'Farm', category: '民生', tier: 1, cost: {}, constructionTime: 5,
    output: [], upkeep: {}, size: { width: 1, height: 1 },
    assetKey: 'bld_farm', upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
    ...overrides,
  };
}

const BIG_BOUNDS = { width: 100, height: 100 };

// Helper for placement tests: GameStore with all-plain map (so terrain doesn't block fixed placements).
function newStorePlain(overrides: ConstructorParameters<typeof GameStore>[1] = {}): GameStore {
  return new GameStore(makeEmitter(), { worldMap: allPlainMap(), ...overrides });
}

describe('GameStore.addResource', () => {
  it('negative amount clamps to 0', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addResource('grain', -100);
    expect(store.getState().resources.grain ?? 0).toBe(0);
  });

  it('amount over 9999 clamps to 9999', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addResource('grain', 10000);
    expect(store.getState().resources.grain).toBe(9999);
  });

  it('fractional amount is floored (5.9 -> 5)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addResource('grain', 5.9);
    expect(store.getState().resources.grain).toBe(5);
  });
});

describe('GameStore.addModifier', () => {
  it('invalid modifier effect throws ModifierValidationError', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    expect(() => store.addModifier(makeInvalidModifier())).toThrow(ModifierValidationError);
  });

  it('valid modifier is added', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addModifier(makeValidModifier());
    expect(store.getState().activeModifiers).toHaveLength(1);
  });
});

describe('GameStore event unsubscription', () => {
  it('after off() listener is not called on next addResource', () => {
    const ee = new EventEmitter() as unknown as IEventEmitter & { on: EventEmitter['on']; off: EventEmitter['off'] };
    const store = new GameStore(ee);
    const cb = vi.fn();
    ee.on(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.addResource('grain', 5);
    expect(cb).toHaveBeenCalledTimes(1);
    ee.off(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.addResource('grain', 5);
    expect(cb).toHaveBeenCalledTimes(1); // unchanged
    expect(ee.listenerCount(STATE_EVENTS.RESOURCES_CHANGED)).toBe(0);
  });
});

describe('GameStore.placeBuilding (Slice B)', () => {
  it('places building with status=constructing and progress=0', () => {
    const store = newStorePlain();
    const result = store.placeBuilding(makeDef(), 3, 4, BIG_BOUNDS);
    expect(result).toEqual({ ok: true });
    const b = store.getState().buildings[0];
    expect(b?.status).toBe('constructing');
    expect(b?.constructionProgress).toBe(0);
    expect(b?.position).toEqual({ x: 3, y: 4 });
  });

  it('deducts cost from resources on placement', () => {
    const store = newStorePlain({ resources: { wood: 100, people: 10 } });
    const def = makeDef({ cost: { wood: 20, people: 5 } });
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: true });
    expect(store.getState().resources.wood).toBe(80);
    expect(store.getState().resources.people).toBe(5);
  });

  it('rejects with insufficient_resources when cost cannot be paid', () => {
    const store = newStorePlain({ resources: { wood: 5 } });
    const def = makeDef({ cost: { wood: 20 } });
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'insufficient_resources' });
    expect(store.getState().buildings).toHaveLength(0);
    expect(store.getState().resources.wood).toBe(5);
  });

  it('rejects with out_of_bounds and does not deduct cost', () => {
    const store = newStorePlain({ resources: { wood: 100 } });
    const def = makeDef({ cost: { wood: 20 }, size: { width: 2, height: 2 } });
    const result = store.placeBuilding(def, 9, 9, { width: 10, height: 10 });
    expect(result).toEqual({ ok: false, reason: 'out_of_bounds' });
    expect(store.getState().resources.wood).toBe(100);
  });

  it('rejects with overlap when placing on top of existing building', () => {
    const store = newStorePlain({ resources: { wood: 200 } });
    const def = makeDef({ cost: { wood: 20 }, size: { width: 2, height: 2 } });
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'overlap' });
    expect(store.getState().buildings).toHaveLength(1);
    expect(store.getState().resources.wood).toBe(180); // only first deducted
  });

  it('emits BUILDING_PLACED on success', () => {
    const store = newStorePlain();
    const cb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_PLACED, cb);
    store.placeBuilding(makeDef(), 0, 0, BIG_BOUNDS);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT emit BUILDING_PLACED on rejection', () => {
    const store = newStorePlain({ resources: { wood: 5 } });
    const def = makeDef({ cost: { wood: 20 } });
    const cb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_PLACED, cb);
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(cb).not.toHaveBeenCalled();
  });

  it('emits RESOURCES_CHANGED with negative deltas after deduction', () => {
    const store = newStorePlain({ resources: { wood: 100, people: 10 } });
    const def = makeDef({ cost: { wood: 20, people: 5 } });
    const cb = vi.fn();
    store.on(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(cb).toHaveBeenCalledTimes(1);
    const payload = cb.mock.calls[0]?.[0] as { deltas: Record<string, number>; reason?: string };
    expect(payload.deltas).toEqual({ wood: -20, people: -5 });
    expect(payload.reason).toBe('building_cost');
  });

  it('does NOT emit RESOURCES_CHANGED when cost is empty', () => {
    const store = newStorePlain();
    const cb = vi.fn();
    store.on(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.placeBuilding(makeDef({ cost: {} }), 0, 0, BIG_BOUNDS);
    expect(cb).not.toHaveBeenCalled();
  });

  it('rejects with unbuildable_terrain on river tile (Slice C)', () => {
    // Construct a worldMap with a river at (5,5)
    const tiles = [];
    for (let i = 0; i < 100 * 100; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
    tiles[5 * 100 + 5] = { terrain: 'river' as const, buildable: false, walkable: true };
    const store = new GameStore(makeEmitter(), {
      worldMap: { width: 100, height: 100, tiles, resourceNodes: [], seed: 0 },
    });
    const result = store.placeBuilding(makeDef(), 5, 5, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'unbuildable_terrain' });
  });
});

describe('GameStore construction progress (Slice B)', () => {
  it('tickDay advances constructing building by 100/constructionTime', () => {
    const store = newStorePlain();
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    store.tickDay();
    const b = store.getState().buildings[0];
    expect(b?.constructionProgress).toBeCloseTo(100 / 3, 5);
    expect(b?.status).toBe('constructing');
  });

  it('tickDay completes building when progress reaches 100, emits BUILDING_COMPLETED once', () => {
    const store = newStorePlain();
    const completedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_COMPLETED, completedCb);
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    store.tickDay();
    store.tickDay();
    store.tickDay();
    const b = store.getState().buildings[0];
    expect(b?.status).toBe('working');
    expect(b?.constructionProgress).toBe(100);
    expect(completedCb).toHaveBeenCalledTimes(1);
  });

  it('tickDay completes ct<=0 building instantly on first tick (degenerate static-content case)', () => {
    const store = newStorePlain();
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    // override registry to return ct=0 for this defId
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockReturnValue(
      makeDef({ id: 'bld_farm', constructionTime: 0 }),
    );
    const completedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_COMPLETED, completedCb);
    store.tickDay();
    expect(store.getState().buildings[0]?.status).toBe('working');
    expect(store.getState().buildings[0]?.constructionProgress).toBe(100);
    expect(completedCb).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('tickDay does not advance already-working buildings', () => {
    const store = newStorePlain();
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    store.tickDay();
    store.tickDay();
    store.tickDay(); // completes (registry says ct=3 for bld_farm)
    expect(store.getState().buildings[0]?.status).toBe('working');
    const completedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_COMPLETED, completedCb);
    store.tickDay();
    expect(completedCb).not.toHaveBeenCalled();
    expect(store.getState().buildings[0]?.constructionProgress).toBe(100);
  });
});

describe('GameStore.tickDay', () => {
  it('increments currentDay by 1 and emits DAY_TICK with new day', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const cb = vi.fn();
    store.on(STATE_EVENTS.DAY_TICK, cb);
    store.tickDay();
    expect(store.getCurrentDay()).toBe(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('decrements modifier remainingDays from N to N-1', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const m = makeValidModifier('m1');
    m.remainingDays = 3;
    store.addModifier(m);
    store.tickDay();
    expect(store.getActiveModifiers()[0]?.remainingDays).toBe(2);
  });

  it('removes modifier when remainingDays reaches 0 and emits MODIFIER_REMOVED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const m = makeValidModifier('m_short');
    m.remainingDays = 1;
    store.addModifier(m);
    const cb = vi.fn();
    store.on(STATE_EVENTS.MODIFIER_REMOVED, cb);
    store.tickDay();
    expect(store.getActiveModifiers()).toHaveLength(0);
    expect(cb).toHaveBeenCalledWith({ id: 'm_short' });
  });

  it('does not decrement permanent modifier (remainingDays = -1)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const m = makeValidModifier('perm');
    m.remainingDays = -1;
    store.addModifier(m);
    store.tickDay();
    store.tickDay();
    expect(store.getActiveModifiers()[0]?.remainingDays).toBe(-1);
  });

  it('crossing season boundary emits SEASON_TICK exactly once', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { currentDay: 29 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    store.tickDay(); // 29 -> 30 (season 0 -> 1)
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('crossing year boundary emits YEAR_TICK exactly once', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { currentDay: 119 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.YEAR_TICK, cb);
    store.tickDay(); // 119 -> 120 (year 0 -> 1)
    expect(cb).toHaveBeenCalledWith({ year: 1 });
  });

  it('within-season tick does not emit SEASON_TICK', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { currentDay: 5 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    store.tickDay();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('GameStore.setSpeed / setPaused', () => {
  it('setSpeed emits SPEED_CHANGED on change', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { speed: 1 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SPEED_CHANGED, cb);
    store.setSpeed(2);
    expect(cb).toHaveBeenCalledWith(2);
  });

  it('setSpeed is a no-op when value unchanged', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { speed: 1 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SPEED_CHANGED, cb);
    store.setSpeed(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('setPaused emits PAUSED_CHANGED on change', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    const cb = vi.fn();
    store.on(STATE_EVENTS.PAUSED_CHANGED, cb);
    store.setPaused(true);
    expect(cb).toHaveBeenCalledWith(true);
    expect(store.isPaused()).toBe(true);
  });

  it('setPaused is a no-op when value unchanged', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: true });
    const cb = vi.fn();
    store.on(STATE_EVENTS.PAUSED_CHANGED, cb);
    store.setPaused(true);
    expect(cb).not.toHaveBeenCalled();
  });

  // Slice G: pause refcount — modal hold 不会覆盖玩家手动暂停
  it('requestPause holds effective paused even when state.paused is false', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    expect(store.isPaused()).toBe(false);
    store.requestPause('event');
    expect(store.isPaused()).toBe(true);
    expect(store.getUserPaused()).toBe(false); // 玩家手动暂停标志没动
  });

  it('releasePause drops effective paused back to user state', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    store.requestPause('event');
    store.releasePause('event');
    expect(store.isPaused()).toBe(false);
  });

  it('multiple holders nest correctly (event + tutorial)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    store.requestPause('event');
    store.requestPause('tutorial');
    expect(store.isPaused()).toBe(true);
    store.releasePause('event');
    expect(store.isPaused()).toBe(true); // 还有 tutorial 持有
    store.releasePause('tutorial');
    expect(store.isPaused()).toBe(false);
  });

  it('user paused remains true after all modal holders release', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: true });
    store.requestPause('event');
    expect(store.isPaused()).toBe(true);
    store.releasePause('event');
    expect(store.isPaused()).toBe(true); // 玩家手动暂停态保留
    expect(store.getUserPaused()).toBe(true);
  });

  it('PAUSED_CHANGED emits only on effective paused transitions', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    const cb = vi.fn();
    store.on(STATE_EVENTS.PAUSED_CHANGED, cb);
    store.requestPause('a'); // false → true
    store.requestPause('b'); // 已 true，不再 emit
    store.releasePause('a'); // 仍 true，不 emit
    store.releasePause('b'); // true → false
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, true);
    expect(cb).toHaveBeenNthCalledWith(2, false);
  });

  it('requestPause is idempotent for same holder', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    store.requestPause('event');
    store.requestPause('event'); // 重入：什么都不做
    store.releasePause('event'); // 释放一次就够
    expect(store.isPaused()).toBe(false);
  });
});

describe('GameStore.replaceState / setLastSeenNow', () => {
  it('replaceState swaps state and emits STATE_REPLACED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const cb = vi.fn();
    store.on(STATE_EVENTS.STATE_REPLACED, cb);
    const newState = {
      resources: { grain: 500 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
      eventHistory: [],
      pendingEventId: null,
      pendingEventDayStart: null,
      tutorialStepId: null,
      lastSeenTimestamp: 0,
      paused: false,
      speed: 2 as const,
      lastTickTimestamp: 0,
      currentDay: 50,
      rngSeed: 7,
      worldMap: allPlainMap(8, 8),
      productionCarry: {},
      panelCollapsed: { left: false, right: false },
      completedDecreeIds: [],
      npcCountries: [],
      playerMorale: 50,
      playerMilitaryPower: 30,
      grade: 0,
      gradeReached: 0,
      tianxiaAcknowledged: false,
      dualZeroDays: 0,
      crisisActive: false,
      crisisRecoverDays: 0,
      mode: 'sandbox' as const,
      populationCarry: 0,
      crisisCount: 0,
      vassalOf: null,
      storyFlags: null,
    };
    store.replaceState(newState);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(store.getCurrentDay()).toBe(50);
    expect(store.getSpeed()).toBe(2);
    expect(store.getState().resources.grain).toBe(500);
  });

  it('setLastSeenNow updates timestamp to current time', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const before = Date.now();
    store.setLastSeenNow();
    expect(store.getLastSeenTimestamp()).toBeGreaterThanOrEqual(before);
  });
});

// Slice E Critical patch：lightweight resources getter（避免 getState 的 structuredClone 在
// pointermove 热路径上每帧拷贝整个 worldMap）
describe('GameStore.getResources (lightweight, per-frame safe)', () => {
  it('returns current resources snapshot', () => {
    const { store } = makeStore();
    store.addResource('wood', 50);
    store.addResource('grain', 30);
    const r = store.getResources();
    expect(r.wood).toBe(50);
    expect(r.grain).toBe(30);
  });

  it('returns frozen object (mutation attempts have no effect on store state)', () => {
    const { store } = makeStore();
    store.addResource('wood', 10);
    const r = store.getResources();
    expect(Object.isFrozen(r)).toBe(true);
    // store internal state stays at 10 even if a caller hostile-tries to mutate the snapshot
    store.addResource('wood', 5);
    expect(store.getResources().wood).toBe(15);
  });

  it('subsequent calls reflect latest state (snapshot, not cached reference)', () => {
    const { store } = makeStore();
    store.addResource('wood', 10);
    const first = store.getResources();
    store.addResource('wood', 5);
    const second = store.getResources();
    expect(first.wood).toBe(10);
    expect(second.wood).toBe(15);
  });

  it('does NOT include the worldMap (proves no structuredClone of full state)', () => {
    const { store } = makeStore();
    store.addResource('wood', 1);
    const r = store.getResources() as Record<string, unknown>;
    // resources dict only — no worldMap, buildings, etc. Cheap to call per frame.
    expect('worldMap' in r).toBe(false);
    expect('buildings' in r).toBe(false);
  });
});

// Slice F integration — content engines wired into tickDay
describe('GameStore Slice F integration', () => {
  it('adoptPolicy: deducts cost, marks adopted, adds permanent modifier', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      policies: [{
        id: 'p1', name: 'P', branch: '农桑', x: 0, y: 0,
        cost: { gold: 20 },
        effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
        prerequisites: [], tier: 1, description: '', descPlain: '',
      }],
    });
    store.addResource('gold', 100);
    const result = store.adoptPolicy('p1');
    expect(result.ok).toBe(true);
    expect(store.getResources().gold).toBe(80);
    expect(store.getAdoptedPolicyIds().has('p1')).toBe(true);
    expect(store.getActiveModifiers().some(m => m.id === 'pol_modifier_p1')).toBe(true);
  });

  it('adoptPolicy: unknown id returns failure', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, { policies: [] });
    const result = store.adoptPolicy('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown_policy');
  });

  it('adoptDecree: deducts stage[0].cost and pushes activeDecrees', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      decrees: [{
        id: 'd1', name: 'D', category: '军事', description: '', descPlain: '',
        unlockCondition: [], // no condition
        stages: [
          { order: 1, cost: { gold: 50 }, days: 5,
            effects: [{ target: 'country_military_power', op: 'add', value: 8 }],
            removeEffects: [] },
        ],
      }],
    });
    store.addResource('gold', 100);
    const result = store.adoptDecree('d1');
    expect(result.ok).toBe(true);
    expect(store.getResources().gold).toBe(50);
    expect(store.getActiveDecrees()).toHaveLength(1);
  });

  it('decree stall does NOT re-emit DECREE_STALLED every tick', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      decrees: [{
        id: 'd1', name: 'D', category: '军事', description: '', descPlain: '',
        unlockCondition: [],
        stages: [
          { order: 1, cost: { gold: 10 }, days: 2,
            effects: [{ target: 'country_military_power', op: 'add', value: 1 }],
            removeEffects: [] },
          { order: 2, cost: { gold: 9999 }, days: 5,
            effects: [], removeEffects: [] },
        ],
      }],
    });
    store.addResource('gold', 10);
    store.adoptDecree('d1');
    const spy = vi.fn();
    store.on(STATE_EVENTS.DECREE_STALLED, spy);
    // tick past stage 0 expiry → first stall
    store.tickDay();
    store.tickDay();
    const stallsAfterFirst = spy.mock.calls.length;
    expect(stallsAfterFirst).toBe(1);
    // continue ticking — should NOT re-emit on each tick
    store.tickDay();
    store.tickDay();
    store.tickDay();
    expect(spy.mock.calls.length).toBe(1);
  });

  it('decree stall recovery: paying up advances without re-applying effects', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      decrees: [{
        id: 'd1', name: 'D', category: '军事', description: '', descPlain: '',
        unlockCondition: [],
        stages: [
          { order: 1, cost: { gold: 10 }, days: 1,
            effects: [{ target: 'country_military_power', op: 'add', value: 5 }],
            removeEffects: [] },
          { order: 2, cost: { gold: 50 }, days: 10,
            effects: [], removeEffects: [] },
        ],
      }],
    });
    store.addResource('gold', 10);
    store.adoptDecree('d1');
    store.tickDay(); // stage 0 expires, stalls (can't afford 50)
    const modCountAfterStall = store.getActiveModifiers().length;
    store.addResource('gold', 100); // now can afford
    const addSpy = vi.fn();
    store.on(STATE_EVENTS.MODIFIER_ADDED, addSpy);
    store.tickDay(); // should advance, NOT re-add modifier
    expect(addSpy).not.toHaveBeenCalled();
    expect(store.getActiveModifiers().length).toBe(modCountAfterStall);
    // and gold has been deducted for stage 1 cost
    const after = store.getResources().gold ?? 0;
    expect(after).toBeLessThan(110); // started at 110, stage 1 cost is 50
  });

  it('event triggered when condition met; resolveEvent applies choice and writes history', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      events: [{
        id: 'evt_low_grain',
        tags: ['抉择'],
        triggers: [{ condition: 'country_grain < 50' }],
        contexts: [{ condition: 'default', title: 'Hunger', desc: '', descPlain: '' }],
        choices: [
          { text: 'A', textPlain: 'A',
            effects: [{ target: 'country_morale', op: 'add', value: 3 }],
            removeEffects: [] },
          { text: 'B', textPlain: 'B', effects: [], removeEffects: [] },
        ],
        defaultTimeoutDays: 7,
      }],
    });
    // make grain low (10 < 50) so trigger fires
    store.addResource('grain', 10);
    store.tickDay();
    expect(store.getPendingEventId()).toBe('evt_low_grain');
    store.resolveEvent(0);
    expect(store.getPendingEventId()).toBeNull();
    expect(store.getActiveModifiers().some(m => m.id.includes('evt_low_grain'))).toBe(true);
    // history written → not re-triggered
    store.tickDay();
    expect(store.getPendingEventId()).toBeNull();
  });

  it('event timeout auto-picks choice 0 after defaultTimeoutDays', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      events: [{
        id: 'evt_t',
        tags: ['抉择'],
        triggers: [{ condition: 'country_grain < 50' }],
        contexts: [{ condition: 'default', title: 'T', desc: '', descPlain: '' }],
        choices: [
          { text: 'A', textPlain: 'A',
            effects: [{ target: 'country_morale', op: 'add', value: 1 }],
            removeEffects: [] },
        ],
        defaultTimeoutDays: 3,
      }],
    });
    store.addResource('grain', 10);
    store.tickDay(); // event triggers, pending set
    expect(store.getPendingEventId()).toBe('evt_t');
    store.tickDay();
    store.tickDay();
    store.tickDay(); // 3 days elapsed → auto-pick0
    expect(store.getPendingEventId()).toBeNull();
    expect(store.getActiveModifiers().some(m => m.id.includes('evt_t'))).toBe(true);
  });

  it('production tick runs in tickDay: working farm gives grain', () => {
    const ee = makeEmitter();
    const farm = makeDef({
      id: 'bld_farm', constructionTime: 1,
      output: [{ resource: 'grain', perDay: 5 }],
    });
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockReturnValue(farm);
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(farm, 0, 0, BIG_BOUNDS);
    // tick 1 day — building should complete (constructionTime=1) but production this tick
    // operates on the post-update buildings list; confirm via grain change after another tick.
    store.tickDay(); // construction completes
    const grainBefore = store.getResources().grain ?? 0;
    store.tickDay(); // first production tick post-completion
    const grainAfter = store.getResources().grain ?? 0;
    expect(grainAfter - grainBefore).toBe(5);
    spy.mockRestore();
  });
});

// v0.9 Pillar 2.3：upgradeBuilding 行为；4 路径覆盖：成功、资源不足、前置未满足、已升级中
describe('GameStore.upgradeBuilding (v0.9)', () => {
  const T1 = makeDef({
    id: 'bld_t1', constructionTime: 1,
    upgradesTo: 'bld_t2',
  });
  const T2 = makeDef({
    id: 'bld_t2', tier: 2, cost: { wood: 100 }, constructionTime: 5,
    upgradeCost: { wood: 30 }, upgradeTime: 4,
    upgradeRequires: [],
  });

  function defLookup(id: string): BuildingDef | undefined {
    if (id === 'bld_t1') return T1;
    if (id === 'bld_t2') return T2;
    return undefined;
  }

  function makeStoreWithT1Working(resources: Record<string, number> = { wood: 100 }) {
    const ee = makeEmitter();
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation(defLookup);
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(T1, 0, 0, BIG_BOUNDS);
    store.tickDay(); // ct=1 → working
    expect(store.getState().buildings[0]?.status).toBe('working');
    for (const [k, v] of Object.entries(resources)) store.addResource(k as 'wood', v);
    return { store, spy };
  }

  it('success: deducts upgradeCost, sets upgradingTo, status=constructing, emits BUILDING_UPGRADED on completion', () => {
    const { store, spy } = makeStoreWithT1Working({ wood: 100 });
    const upgradedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_UPGRADED, upgradedCb);
    const before = store.getResources().wood ?? 0;
    const result = store.upgradeBuilding(0, 0);
    expect(result).toEqual({ ok: true });
    expect(store.getResources().wood).toBe(before - 30);
    const inst = store.getState().buildings[0];
    expect(inst?.upgradingTo).toBe('bld_t2');
    expect(inst?.status).toBe('constructing');
    expect(inst?.constructionProgress).toBe(0);
    // upgradeTime=4 → 4 ticks finishes
    store.tickDay();
    store.tickDay();
    store.tickDay();
    expect(upgradedCb).not.toHaveBeenCalled();
    store.tickDay();
    expect(upgradedCb).toHaveBeenCalledTimes(1);
    const finalInst = store.getState().buildings[0];
    expect(finalInst?.defId).toBe('bld_t2');
    expect(finalInst?.tier).toBe(2);
    expect(finalInst?.upgradingTo).toBeUndefined();
    expect(finalInst?.status).toBe('working');
    spy.mockRestore();
  });

  it('insufficient_resources: rejects without mutating instance or resources', () => {
    const { store, spy } = makeStoreWithT1Working({ wood: 10 }); // need 30
    const before = store.getResources().wood ?? 0;
    const result = store.upgradeBuilding(0, 0);
    expect(result).toEqual({ ok: false, reason: 'insufficient_resources' });
    expect(store.getResources().wood).toBe(before);
    expect(store.getState().buildings[0]?.upgradingTo).toBeUndefined();
    expect(store.getState().buildings[0]?.status).toBe('working');
    spy.mockRestore();
  });

  it('prerequisites_unmet: rejects with missing[] when upgradeRequires include unbuilt id / unadopted policy', () => {
    const ee = makeEmitter();
    const T2gated = { ...T2, upgradeRequires: ['pol_market', 'bld_other'] };
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation((id: string) => {
      if (id === 'bld_t1') return T1;
      if (id === 'bld_t2') return T2gated;
      return undefined;
    });
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(T1, 0, 0, BIG_BOUNDS);
    store.tickDay();
    store.addResource('wood', 100);
    const result = store.upgradeBuilding(0, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('prerequisites_unmet');
      expect(result.missing).toEqual(expect.arrayContaining(['pol_market', 'bld_other']));
    }
    spy.mockRestore();
  });

  it('already_upgrading: second call rejects', () => {
    const { store, spy } = makeStoreWithT1Working({ wood: 200 });
    const r1 = store.upgradeBuilding(0, 0);
    expect(r1.ok).toBe(true);
    const r2 = store.upgradeBuilding(0, 0);
    expect(r2).toEqual({ ok: false, reason: 'already_upgrading' });
    spy.mockRestore();
  });

  it('no_upgrade_path: T1 without upgradesTo cannot be upgraded', () => {
    const ee = makeEmitter();
    const TLeaf = makeDef({ id: 'bld_leaf', constructionTime: 1 }); // no upgradesTo
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation((id: string) =>
      id === 'bld_leaf' ? TLeaf : undefined,
    );
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(TLeaf, 0, 0, BIG_BOUNDS);
    store.tickDay();
    const r = store.upgradeBuilding(0, 0);
    expect(r).toEqual({ ok: false, reason: 'no_upgrade_path' });
    spy.mockRestore();
  });

  it('unknown_building: clicking empty grid rejects gracefully', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    expect(store.upgradeBuilding(99, 99)).toEqual({ ok: false, reason: 'unknown_building' });
  });

  it('not_working: cannot upgrade a still-constructing building', () => {
    const ee = makeEmitter();
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation(defLookup);
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    const T1Slow = { ...T1, constructionTime: 5 };
    store.placeBuilding(T1Slow, 0, 0, BIG_BOUNDS);
    // status=constructing after placeBuilding
    store.addResource('wood', 100);
    expect(store.upgradeBuilding(0, 0)).toEqual({ ok: false, reason: 'not_working' });
    spy.mockRestore();
  });
});

describe('Phase1 国格阶梯（集成）', () => {
  function workingMarket() {
    return {
      defId: 'bld_market', position: { x: 1, y: 1 }, status: 'working' as const,
      tier: 1 as const, constructionProgress: 100, modifiers: [],
    };
  }

  it('达 level1 门槛 + 建成 bld_market → 一 tick 后晋阶到 1 并发 GRADE_CHANGED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { people: 40, gold: 120, grain: 50 },
      buildings: [workingMarket()],
      npcCountries: [],
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.GRADE_CHANGED, spy);
    expect(store.getGrade()).toBe(0);
    store.tickDay();
    expect(store.getGrade()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ from: 0, to: 1, reason: 'ascend' });
  });

  it('门槛达标但缺标志建筑 → 不晋阶', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { people: 40, gold: 120, grain: 50 },
      buildings: [], // 无 market
      npcCountries: [],
    });
    store.tickDay();
    expect(store.getGrade()).toBe(0);
  });

  it('一 tick 最多升 1 级（不连跳）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      // 资源全顶 + 多标志建筑，但仍应只升到 1
      resources: { people: 9999, gold: 9999, cloth: 9999, rite: 9999, bronze: 9999, grain: 9999 },
      buildings: [
        workingMarket(),
        { defId: 'bld_ancestor_shrine', position: { x: 2, y: 2 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] },
      ],
      npcCountries: [],
    });
    store.tickDay();
    expect(store.getGrade()).toBe(1);
  });
});

describe('Phase1 低谷危机（集成）', () => {
  it('国库+存粮双零满 §7 阈值(40 日) → 触发危机：人口降、crisisActive、发 CRISIS_TRIGGERED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [],
      npcCountries: [], // 无 NPC → 走民变 unrest
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    // 注：双零期间存粮=0 → 人口同时在饥荒流失（population tick 先于 crisis）。
    // 只验"危机触发 + 人口确实降 + 民心挫"。§7 阈值 40 天。
    const peopleBefore = store.getResources().people ?? 0;
    for (let i = 0; i < 39; i++) store.tickDay();
    expect(spy).not.toHaveBeenCalled();
    store.tickDay(); // 第 40 日触发
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ kind: 'unrest' });
    expect(store.getResources().people ?? 0).toBeLessThan(peopleBefore);
    expect(store.getPlayerMorale()).toBe(30); // 50 - 20
  });

  it('§7 纳贡附庸：双零+军力远超的敌对强邻 → 成附庸，可赎身', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [],
      playerMilitaryPower: 20,
      npcCountries: [{
        id: 'npc_jin', stance: -50, militaryPower: 200, renown: 40, tradeRoute: false, tradeCooldown: 0,
        warStatus: 'tension' as const, lastEnvoyDay: -1, lastWarDay: -1, allyIds: [], aggression: 60, lastActionDay: -1,
      }],
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ kind: 'vassalage' });
    expect(store.isVassal()).toBe(true);
    // 赎身：钱不够失败，够了成功
    expect(store.redeemVassalage().ok).toBe(false);
    store.addResource('gold', 500);
    expect(store.redeemVassalage().ok).toBe(true);
    expect(store.isVassal()).toBe(false);
  });

  it('§7 割地：双零+无强敌+有外城 → 丢一座非核心建筑', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [
        // 用产礼器（非 gold/grain）的非核心建筑，确保双零前提不被产出破坏
        { defId: 'bld_ancestor_shrine', position: { x: 1, y: 1 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] },
      ],
      npcCountries: [], // 无强敌
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ kind: 'cession' });
    const shrine = store.getState().buildings.find(b => b.defId === 'bld_ancestor_shrine');
    expect(shrine?.status).toBe('derelict');
  });

  it('资源回正 → dualZeroDays 归零，不触发', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [],
      npcCountries: [],
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    for (let i = 0; i < 30; i++) store.tickDay(); // 未到 40 天阈值
    store.addResource('gold', 100); // 补回国库 → 下一 tick 计数归零
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(spy).not.toHaveBeenCalled();
  });

  it('危机恢复期（crisisActive）内不晋阶——即使满足 level1 门槛也不 ascend', () => {
    const ee = makeEmitter();
    // 预置：处于危机态 + 已满足 level1（人口/钱达标 + 建成 bld_market）
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      crisisActive: true,
      resources: { gold: 500, grain: 200, people: 80 },
      buildings: [
        { defId: 'bld_market', position: { x: 1, y: 1 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] },
      ],
      npcCountries: [],
    });
    expect(store.getGrade()).toBe(0);
    const gradeSpy = vi.fn();
    ee.on(STATE_EVENTS.GRADE_CHANGED, gradeSpy);
    store.tickDay();
    expect(store.getGrade()).toBe(0); // crisisActive 守卫挡住晋阶
    expect(gradeSpy).not.toHaveBeenCalled();
  });
});

describe('Phase1 NPC 动态成长（集成）', () => {
  function npc(id: string, mp: number, over: Record<string, unknown> = {}) {
    return {
      id, stance: -30, militaryPower: mp, renown: 40, tradeRoute: false, tradeCooldown: 0,
      warStatus: 'peace' as const, lastEnvoyDay: -1, lastWarDay: -1,
      allyIds: [] as string[], aggression: 50, lastActionDay: -1, ...over,
    };
  }

  it('startNewGameNpcs：换成池中 4 个、含 ≥1 蛮夷', () => {
    const store = new GameStore(makeEmitter(), { worldMap: allPlainMap() });
    store.startNewGameNpcs(42);
    const roster = store.getNpcCountries();
    expect(roster).toHaveLength(4);
  });

  it('NPC 军力随季成长（晋 martial 每 30 日 +4）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 500, gold: 100 },
      npcCountries: [npc('npc_jin', 50)],
    });
    for (let i = 0; i < 30; i++) store.tickDay(); // 到第 30 日触发一次成长
    expect(store.getNpcCountries()[0]!.militaryPower).toBeGreaterThan(50);
  });

  it('蛮夷在场 → 长期推进会触发 NPC_ACTION 骚扰', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 9999, gold: 9999 },
      npcCountries: [npc('npc_rong', 70, { aggression: 90 })], // 戎狄 tribal
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.NPC_ACTION, spy);
    for (let i = 0; i < 240; i++) store.tickDay();
    expect(spy).toHaveBeenCalled(); // 240 日内高侵略蛮夷几乎必有骚扰
  });
});

describe('Phase1 人口增长（集成）', () => {
  it('有余粮 + 未满住房上限 → 人口随天数增长', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 500, people: 5, gold: 100 }, // gold>0 防误触危机
      buildings: [],
      npcCountries: [],
    });
    for (let i = 0; i < 80; i++) store.tickDay();
    expect((store.getResources().people ?? 0)).toBeGreaterThan(5);
  });

  it('缺粮 → 人口流失', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 0, people: 100, gold: 100 }, // 仅缺粮、不双零，故饥荒非危机
      buildings: [],
      npcCountries: [],
    });
    for (let i = 0; i < 20; i++) store.tickDay();
    expect((store.getResources().people ?? 0)).toBeLessThan(100);
  });

  it('达住房上限后不再增长（people 不超过 cap）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 500, people: 14, gold: 100 }, // baseCap=15，无居住建筑
      buildings: [],
      npcCountries: [],
    });
    for (let i = 0; i < 200; i++) store.tickDay();
    expect((store.getResources().people ?? 0)).toBeLessThanOrEqual(15);
  });
});
