import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { serialize, deserialize, validateSlot, saveToSlot, SaveLoadError, SAVE_SCHEMA_VERSION } from '../saveLoad';
import { GameStore } from '../gameStore';
import type { GameState, IEventEmitter } from '../gameStore';
import { generateMap } from '../mapGen';

function makeGameState(): GameState {
  return {
    resources: { grain: 100, wood: 50 },
    buildings: [],
    policies: [],
    activeModifiers: [],
    activeDecrees: [],
    eventHistory: [],
    pendingEventId: null,
    pendingEventDayStart: null,
    tutorialStepId: null,
    defeatCount: 0,
    permanentBuffs: [],
    lastSeenTimestamp: 12345678,
    paused: false,
    speed: 1,
    lastTickTimestamp: 0,
    currentDay: 42,
    rngSeed: 999,
    worldMap: generateMap({ width: 16, height: 16, seed: 999 }),
    productionCarry: {},
    panelCollapsed: { left: false, right: false },
    completedDecreeIds: [],
    npcCountries: [],
    playerMorale: 50,
    playerMilitaryPower: 30,
  };
}

function makeStoreWithState(state: GameState): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee);
  store.replaceState(state);
  return store;
}

describe('serialize + deserialize round-trip', () => {
  it('produces structurally equal state', () => {
    const original = makeGameState();
    const restored = deserialize(serialize(original));
    expect(restored.resources).toEqual(original.resources);
    expect(restored.currentDay).toBe(original.currentDay);
    expect(restored.rngSeed).toBe(original.rngSeed);
    expect(restored.speed).toBe(original.speed);
    expect(restored.paused).toBe(false);
    expect(restored.lastTickTimestamp).toBe(0);
  });

  it('roundtrips worldMap tiles + resourceNodes (Slice C)', () => {
    const original = makeGameState();
    const restored = deserialize(serialize(original));
    expect(restored.worldMap.width).toBe(original.worldMap.width);
    expect(restored.worldMap.height).toBe(original.worldMap.height);
    expect(restored.worldMap.tiles).toEqual(original.worldMap.tiles);
    expect(restored.worldMap.resourceNodes).toEqual(original.worldMap.resourceNodes);
    expect(restored.worldMap.seed).toBe(original.worldMap.seed);
  });
});

describe('deserialize error handling', () => {
  it('schemaVersion=999 throws SaveLoadError', () => {
    const blob = { schemaVersion: 999, state: {} };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('missing schemaVersion throws SaveLoadError', () => {
    expect(() => deserialize({ data: 'something' })).toThrow(SaveLoadError);
  });

  it('null input throws SaveLoadError', () => {
    expect(() => deserialize(null)).toThrow(SaveLoadError);
  });

  it('number input throws SaveLoadError', () => {
    expect(() => deserialize(42)).toThrow(SaveLoadError);
  });

  it('speed=99 (corrupted) clamps to 1', () => {
    const blob = { schemaVersion: 1, state: { speed: 99 } };
    expect(deserialize(blob).speed).toBe(1);
  });

  it('speed=-1 (corrupted) clamps to 1', () => {
    const blob = { schemaVersion: 1, state: { speed: -1 } };
    expect(deserialize(blob).speed).toBe(1);
  });

  it('speed="2" (string) clamps to 1', () => {
    const blob = { schemaVersion: 1, state: { speed: '2' } };
    expect(deserialize(blob).speed).toBe(1);
  });

  it('speed=2 (valid) preserved', () => {
    const blob = { schemaVersion: 1, state: { speed: 2 } };
    expect(deserialize(blob).speed).toBe(2);
  });

  it('speed=0 (valid pause) preserved', () => {
    const blob = { schemaVersion: 1, state: { speed: 0 } };
    expect(deserialize(blob).speed).toBe(0);
  });

  it('legacy save without worldMap regenerates from rngSeed (Slice C)', () => {
    const blob = { schemaVersion: 1, state: { rngSeed: 42 } };
    const restored = deserialize(blob);
    expect(restored.worldMap).toBeDefined();
    expect(restored.worldMap.tiles.length).toBe(restored.worldMap.width * restored.worldMap.height);
    expect(restored.worldMap.seed).toBe(42);
  });

  it('worldMap with tiles.length mismatch throws SaveLoadError (Slice C)', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        worldMap: { width: 8, height: 8, tiles: [{ terrain: 'plain', buildable: true, walkable: true }], resourceNodes: [], seed: 0 },
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with non-array tiles throws SaveLoadError (Slice C)', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        worldMap: { width: 8, height: 8, tiles: 'not-array', resourceNodes: [], seed: 0 },
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with invalid terrain string throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    tiles[0] = { terrain: 'lava', buildable: true, walkable: true } as never;
    const blob = {
      schemaVersion: 1,
      state: { rngSeed: 1, worldMap: { width: 8, height: 8, tiles, resourceNodes: [], seed: 0 } },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with non-boolean buildable throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    tiles[3] = { terrain: 'plain', buildable: 'yes', walkable: true } as never;
    const blob = {
      schemaVersion: 1,
      state: { rngSeed: 1, worldMap: { width: 8, height: 8, tiles, resourceNodes: [], seed: 0 } },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with NaN seed throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    const blob = {
      schemaVersion: 1,
      state: { rngSeed: 1, worldMap: { width: 8, height: 8, tiles, resourceNodes: [], seed: NaN } },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with non-integer width throws SaveLoadError (Slice C hardening)', () => {
    const blob = {
      schemaVersion: 1,
      state: { rngSeed: 1, worldMap: { width: 8.5, height: 8, tiles: [], resourceNodes: [], seed: 0 } },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with bogus resource node kind throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        worldMap: {
          width: 8, height: 8, tiles, seed: 0,
          resourceNodes: [{ kind: 'gold_node', position: { x: 0, y: 0 }, remaining: 50 }],
        },
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with NaN resource node position throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        worldMap: {
          width: 8, height: 8, tiles, seed: 0,
          resourceNodes: [{ kind: 'forest_node', position: { x: NaN, y: 0 }, remaining: 50 }],
        },
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with negative remaining throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        worldMap: {
          width: 8, height: 8, tiles, seed: 0,
          resourceNodes: [{ kind: 'forest_node', position: { x: 0, y: 0 }, remaining: -10 }],
        },
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('buildings with bad status throws SaveLoadError (Slice G hardening)', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        buildings: [{
          defId: 'bld_farm',
          position: { x: 0, y: 0 },
          status: 'overclocked',  // not in {idle,constructing,working,paused,derelict}
          tier: 1,
          constructionProgress: 0,
          modifiers: [],
        }],
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('buildings with bad tier throws SaveLoadError (Slice G hardening)', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        buildings: [{
          defId: 'bld_farm',
          position: { x: 0, y: 0 },
          status: 'working',
          tier: 99,
          constructionProgress: 100,
          modifiers: [],
        }],
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('buildings with empty defId throws SaveLoadError (Slice G hardening)', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 1,
        buildings: [{
          defId: '',
          position: { x: 0, y: 0 },
          status: 'working',
          tier: 1,
          constructionProgress: 100,
          modifiers: [],
        }],
      },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('valid building shape passes deserialize unchanged', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 7,
        buildings: [{
          defId: 'bld_farm',
          position: { x: 3, y: 4 },
          status: 'working',
          tier: 2,
          constructionProgress: 100,
          modifiers: [],
        }],
      },
    };
    const out = deserialize(blob);
    expect(out.buildings).toHaveLength(1);
    expect(out.buildings[0]?.defId).toBe('bld_farm');
    expect(out.buildings[0]?.tier).toBe(2);
  });
});

describe('validateSlot', () => {
  it('.. throws SaveLoadError', () => {
    expect(() => validateSlot('..')).toThrow(SaveLoadError);
  });

  it('foo/bar throws SaveLoadError', () => {
    expect(() => validateSlot('foo/bar')).toThrow(SaveLoadError);
  });

  it('empty string throws SaveLoadError', () => {
    expect(() => validateSlot('' )).toThrow(SaveLoadError);
  });

  it('valid save_1 does not throw', () => {
    expect(() => validateSlot('save_1')).not.toThrow();
  });

  it('valid auto-save does not throw', () => {
    expect(() => validateSlot('auto-save')).not.toThrow();
  });
});

describe('saveToSlot', () => {
  afterEach(() => {
    // cleanup window mock
    delete (globalThis as Record<string, unknown>)['window'];
  });

  it('calls colonyApi.saveGame with correct slot and json', async () => {
    const saveGameMock = vi.fn().mockResolvedValue(true);
    // saveLoad.ts accesses (window as ...).colonyApi; in node env set globalThis.window
    (globalThis as Record<string, unknown>).window = {
      colonyApi: { saveGame: saveGameMock, loadGame: vi.fn() },
    };
    const store = makeStoreWithState(makeGameState());
    await saveToSlot('save_1', store);
    expect(saveGameMock).toHaveBeenCalledOnce();
    const [slot, json] = saveGameMock.mock.calls[0] as [string, string];
    expect(slot).toBe('save_1');
    const parsed = JSON.parse(json) as { schemaVersion: number };
    expect(parsed.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('invalid slot throws before calling api', async () => {
    const store = makeStoreWithState(makeGameState());
    await expect(saveToSlot('../evil', store)).rejects.toThrow(SaveLoadError);
  });

  // Kimi 新#5: saveToSlot must update lastSeenTimestamp before serializing
  it('updates lastSeenTimestamp to a fresh value before saving', async () => {
    const saveGameMock = vi.fn().mockResolvedValue(true);
    (globalThis as Record<string, unknown>).window = {
      colonyApi: { saveGame: saveGameMock, loadGame: vi.fn() },
    };
    const beforeMs = Date.now();
    const state = makeGameState();
    state.lastSeenTimestamp = 12345678; // stale
    const store = makeStoreWithState(state);
    await saveToSlot('save_1', store);
    const [, json] = saveGameMock.mock.calls[0] as [string, string];
    const parsed = JSON.parse(json) as { state: { lastSeenTimestamp: number } };
    expect(parsed.state.lastSeenTimestamp).toBeGreaterThanOrEqual(beforeMs);
    expect(parsed.state.lastSeenTimestamp).not.toBe(12345678);
  });
});
