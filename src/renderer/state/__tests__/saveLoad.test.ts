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
    seenJitHints: [],
    lastEventDay: 0,
    lastPlayerActionDay: 0,
    lastSeenTimestamp: 12345678,
    paused: false,
    speed: 1,
    currentDay: 42,
    rngSeed: 999,
    worldMap: generateMap({ width: 16, height: 16, seed: 999 }),
    productionCarry: {},
    panelCollapsed: { left: false, right: false },
    completedDecreeIds: [],
    npcCountries: [],
    playerMorale: 50,
    playerMilitaryPower: 30,
    publicWrath: 0,
    lastWrathDemandDay: null,
    worldWariness: 20,
    lastWarinessReason: null,
    lastPropagandaDay: null,
    relicSites: [],
    endgameAscendDay: null,
    endgameLastWaveDay: null,
    grade: 0,
    gradeReached: 0,
    tianxiaAcknowledged: false,
    dualZeroDays: 0,
    crisisActive: false,
    crisisRecoverDays: 0,
    mode: 'sandbox',
    populationCarry: 0,
    crisisCount: 0,
    vassalOf: null,
    storyFlags: null,
    populationClasses: { farmer: 0, worker: 0, soldier: 0, scholar: 0 },
    conversionQueue: [],
    grainNegativeDays: 0,
    factionState: { active: false, lastEventDay: -1, nextEventDay: -1, activeDemand: null, acceptedDemands: [], rejectedDemands: [] },
    megaProjects: [],
    exclusivePolicies: [],
    generals: [],
    activeExpeditions: [],
    defenseAlerts: [],
    wrathUltimatumEndDay: null,
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
  });

  // c1023-14（c1014-06 遗留·c1007-36 随批项）：lastTickTimestamp 死字段删除后的旧档兼容钉。
  // 该字段从未入档（serialize 不落盘、全仓无写入者，c927-22 census + seedSnapshotDeterminism 双证），
  // 故「旧档」＝任何在档存档形态：信封无此键 ⇒ deserialize 须成功且不复活该键。
  it('旧档兼容：信封无 lastTickTimestamp 字段 → deserialize 成功且状态完好、键不复活', () => {
    const original = makeGameState();
    const env = structuredClone(serialize(original)) as { state: Record<string, unknown> };
    delete env.state.lastTickTimestamp; // 旧档形态显式化（现值 serialize 本就不写此键）
    expect(Object.keys(env.state)).not.toContain('lastTickTimestamp');

    const restored = deserialize(env as unknown) as GameState;
    expect(restored.currentDay).toBe(original.currentDay);
    expect(restored.rngSeed).toBe(original.rngSeed);
    expect(restored.resources).toEqual(original.resources);
    expect((restored as unknown as Record<string, unknown>).lastTickTimestamp).toBeUndefined();
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

  it('d914-17：迁移入口（v2→current）遇畸形存档抛 SaveLoadError 而非 TypeError', () => {
    // v2 存档缺迁移目标字段：走 runMigrations 迁移链后仍因 shape 校验失败，
    // 错误类型必须是统一通道 SaveLoadError（不得裸抛 TypeError）。
    const legacy = { schemaVersion: 2, state: { resources: 'not-an-object' } };
    // c924-05：node 内置 assert 退场。旧 `try { deserialize(); assert.fail() } catch { instanceof }` 里
    // assert.fail 抛出的 AssertionError 会被自己的 catch 接住，判据只是"它不是 SaveLoadError"，
    // 不抛错时报错信息误导。toThrow(Class) 同时钉住"必抛"与"抛的是 SaveLoadError"，语义等价且更强。
    expect(() => deserialize(legacy)).toThrow(SaveLoadError);
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
        worldMap: { width: 8, height: 8, tiles: [{ terrain: 'plain', buildable: true }], resourceNodes: [], seed: 0 },
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
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true });
    tiles[0] = { terrain: 'lava', buildable: true } as never;
    const blob = {
      schemaVersion: 1,
      state: { rngSeed: 1, worldMap: { width: 8, height: 8, tiles, resourceNodes: [], seed: 0 } },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with non-boolean buildable throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true });
    tiles[3] = { terrain: 'plain', buildable: 'yes' } as never;
    const blob = {
      schemaVersion: 1,
      state: { rngSeed: 1, worldMap: { width: 8, height: 8, tiles, resourceNodes: [], seed: 0 } },
    };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });

  it('worldMap with NaN seed throws SaveLoadError (Slice C hardening)', () => {
    const tiles = [];
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true });
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
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true });
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
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true });
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
    for (let i = 0; i < 8 * 8; i++) tiles.push({ terrain: 'plain', buildable: true });
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

  it('tier 4 building passes deserialize (BuildingTier 扩到 4 的回归测试：禁军府/太庙/九鼎是 tier:4，存档校验白名单须含 4)', () => {
    const blob = {
      schemaVersion: 1,
      state: {
        rngSeed: 9,
        buildings: [{
          defId: 'bld_farm',
          position: { x: 1, y: 1 },
          status: 'working',
          tier: 4,
          constructionProgress: 100,
          modifiers: [],
        }],
      },
    };
    const out = deserialize(blob);
    expect(out.buildings[0]?.tier).toBe(4);
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

describe('Phase1 新字段存档（国格/低谷/模式）', () => {
  it('round-trip 保真：grade / gradeReached / tianxiaAcknowledged / 危机计数 / mode', () => {
    const s = makeGameState();
    s.grade = 3;
    s.gradeReached = 4;
    s.tianxiaAcknowledged = true;
    s.dualZeroDays = 12;
    s.crisisActive = true;
    s.crisisRecoverDays = 7;
    s.mode = 'story';
    const restored = deserialize(serialize(s));
    expect(restored.grade).toBe(3);
    expect(restored.gradeReached).toBe(4);
    expect(restored.tianxiaAcknowledged).toBe(true);
    expect(restored.dualZeroDays).toBe(12);
    expect(restored.crisisActive).toBe(true);
    expect(restored.crisisRecoverDays).toBe(7);
    expect(restored.mode).toBe('story');
  });

  it('旧存档（缺新字段 + 残留废弃 defeatCount/permanentBuffs）→ 走兜底默认，不抛错', () => {
    const legacyBlob = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: 0,
      state: {
        resources: { grain: 10 },
        buildings: [],
        policies: [],
        activeModifiers: [],
        activeDecrees: [],
        eventHistory: [],
        tutorialStepId: null,
        // 残留的废弃字段——deserialize 应忽略，不报错
        defeatCount: 3,
        permanentBuffs: ['mandate_x'],
        lastSeenTimestamp: 0,
        currentDay: 0,
        rngSeed: 1,
        speed: 1 as const,
        // 完全没有 grade / mode / 危机字段
      },
    };
    const restored = deserialize(legacyBlob);
    expect(restored.grade).toBe(0);
    expect(restored.gradeReached).toBe(0);
    expect(restored.tianxiaAcknowledged).toBe(false);
    expect(restored.dualZeroDays).toBe(0);
    expect(restored.crisisActive).toBe(false);
    expect(restored.mode).toBe('sandbox');
    // 废弃字段不应泄漏进 GameState
    expect('defeatCount' in restored).toBe(false);
    expect('permanentBuffs' in restored).toBe(false);
  });

  it('gradeReached 不低于 grade（迁移钳制）', () => {
    const blob = {
      schemaVersion: SAVE_SCHEMA_VERSION, savedAt: 0,
      state: {
        resources: {}, buildings: [], policies: [], activeModifiers: [], activeDecrees: [],
        eventHistory: [], tutorialStepId: null, lastSeenTimestamp: 0, currentDay: 0,
        rngSeed: 1, speed: 1 as const,
        grade: 4, gradeReached: 2, // 异常：reached < grade
      },
    };
    const restored = deserialize(blob);
    expect(restored.gradeReached).toBe(4);
  });
});

describe('B-0 人口阶层存档迁移', () => {
  it('v1 存档迁移到 v2：populationClasses 从 resources.people 推算', () => {
    const v1Blob = {
      schemaVersion: 1, savedAt: 0,
      state: {
        resources: { grain: 100, people: 25 },
        buildings: [], policies: [], activeModifiers: [], activeDecrees: [],
        eventHistory: [], tutorialStepId: null, lastSeenTimestamp: 0, currentDay: 10,
        rngSeed: 1, speed: 1 as const,
      },
    };
    const restored = deserialize(v1Blob);
    expect(restored.populationClasses).toEqual({ farmer: 25, worker: 0, soldier: 0, scholar: 0 });
    expect(restored.conversionQueue).toEqual([]);
    expect(restored.grainNegativeDays).toBe(0);
  });

  it('round-trip 保真：populationClasses + conversionQueue + grainNegativeDays', () => {
    const s = makeGameState();
    s.populationClasses = { farmer: 10, worker: 5, soldier: 3, scholar: 2 };
    s.conversionQueue = [{ from: 'farmer', to: 'worker', count: 2, daysRemaining: 3 }];
    s.grainNegativeDays = 7;
    const restored = deserialize(serialize(s));
    expect(restored.populationClasses).toEqual({ farmer: 10, worker: 5, soldier: 3, scholar: 2 });
    expect(restored.conversionQueue).toEqual([{ from: 'farmer', to: 'worker', count: 2, daysRemaining: 3 }]);
    expect(restored.grainNegativeDays).toBe(7);
  });

  it('损坏的 populationClasses → 全归 farmer 兜底', () => {
    const blob = {
      schemaVersion: SAVE_SCHEMA_VERSION, savedAt: 0,
      state: {
        resources: { people: 15 }, buildings: [], policies: [], activeModifiers: [], activeDecrees: [],
        eventHistory: [], tutorialStepId: null, lastSeenTimestamp: 0, currentDay: 0,
        rngSeed: 1, speed: 1 as const,
        populationClasses: 'corrupted', // invalid
        conversionQueue: null,
        grainNegativeDays: NaN,
      },
    };
    const restored = deserialize(blob as unknown as Parameters<typeof deserialize>[0]);
    expect(restored.populationClasses).toEqual({ farmer: 15, worker: 0, soldier: 0, scholar: 0 });
    expect(restored.conversionQueue).toEqual([]);
    expect(restored.grainNegativeDays).toBe(0);
  });
});

describe('P0-2 旧存档全链迁移回归（v1/v2 fixture → v8）', () => {
  /** 最简 v1 存档：只有当时 schema 的字段（其余全部靠迁移链补默认值）。 */
  const v1Fixture = () => ({
    schemaVersion: 1, savedAt: 1700000000000,
    state: {
      resources: { grain: 100, wood: 50, people: 25 },
      buildings: [], policies: [], activeModifiers: [], activeDecrees: [],
      eventHistory: [], tutorialStepId: null, lastSeenTimestamp: 0, currentDay: 10,
      rngSeed: 1, speed: 1 as const,
      playerMorale: 55,
    },
  });

  it('v1 旧档一路迁到 v8：逐段迁移字段全部就位', () => {
    const restored = deserialize(v1Fixture());
    // 1→2 人口阶层
    expect(restored.populationClasses).toEqual({ farmer: 25, worker: 0, soldier: 0, scholar: 0 });
    expect(restored.conversionQueue).toEqual([]);
    expect(restored.grainNegativeDays).toBe(0);
    // 2→3 阶层博弈/大工程/互斥
    expect(restored.factionState).toBeDefined();
    expect(restored.megaProjects).toEqual([]);
    expect(restored.exclusivePolicies).toEqual([]);
    // 3→4 双轴民心
    expect(restored.publicWrath).toBe(0);
    // 4→5 列国警惕
    expect(restored.worldWariness).toBeGreaterThanOrEqual(0);
    // 5→6 影响力
    expect(restored.lastPropagandaDay).toBeNull();
    // 6→7 古迹
    expect(restored.relicSites).toEqual([]);
    // 7→8 终局波次
    expect(restored.endgameAscendDay).toBeNull();
    expect(restored.endgameLastWaveDay).toBeNull();
    // 8→9 通牒
    expect(restored.wrathUltimatumEndDay).toBeNull();
    // 业务字段原样保留
    expect(restored.resources.people).toBe(25);
    expect(restored.playerMorale).toBe(55);
    expect(restored.currentDay).toBe(10);
  });

  it('v2 fixture（已有阶层字段）同样可迁到 v8，且人口阶层不被覆盖', () => {
    const blob = v1Fixture() as Record<string, unknown>;
    blob.schemaVersion = 2;
    (blob.state as Record<string, unknown>)['populationClasses'] = { farmer: 20, worker: 3, soldier: 2, scholar: 0 };
    (blob.state as Record<string, unknown>)['conversionQueue'] = [];
    (blob.state as Record<string, unknown>)['grainNegativeDays'] = 2;
    const restored = deserialize(blob);
    expect(restored.populationClasses).toEqual({ farmer: 20, worker: 3, soldier: 2, scholar: 0 });
    expect(restored.grainNegativeDays).toBe(2);
    expect(restored.relicSites).toEqual([]); // 6→7 仍补默认
  });

  it('越版本异常（version=0 或缺省）→ 报 SaveLoadError，不静默读坏档', () => {
    const blob = v1Fixture() as Record<string, unknown>;
    blob.schemaVersion = 0;
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
  });
});

describe('Phase2 故事 storyFlags 存档', () => {
  it('story 存档 round-trip 保真', () => {
    const s = makeGameState();
    s.mode = 'story';
    s.crisisCount = 2;
    s.vassalOf = 'npc_jin';
    s.storyFlags = {
      chapter: 3, unifyPath: 'cultural', unified: true,
      powerAxis: 40, resourceAxis: -30, storyEventsTriggered: ['evt_a'],
      chapterStartDay: 360, ending: null,
    };
    const r = deserialize(serialize(s));
    expect(r.mode).toBe('story');
    expect(r.crisisCount).toBe(2);
    expect(r.vassalOf).toBe('npc_jin');
    expect(r.storyFlags).not.toBeNull();
    expect(r.storyFlags?.chapter).toBe(3);
    expect(r.storyFlags?.unifyPath).toBe('cultural');
    expect(r.storyFlags?.powerAxis).toBe(40);
    expect(r.storyFlags?.resourceAxis).toBe(-30);
    expect(r.storyFlags?.storyEventsTriggered).toEqual(['evt_a']);
    expect(r.storyFlags?.chapterStartDay).toBe(360);
    expect(r.storyFlags?.ending).toBeNull();
  });

  it('sandbox 存档 storyFlags=null（即使误带 storyFlags 也按 mode 归 null）', () => {
    const blob = {
      schemaVersion: SAVE_SCHEMA_VERSION, savedAt: 0,
      state: {
        resources: {}, buildings: [], policies: [], activeModifiers: [], activeDecrees: [],
        eventHistory: [], tutorialStepId: null, lastSeenTimestamp: 0, currentDay: 0, rngSeed: 1,
        speed: 1 as const, mode: 'sandbox' as const,
        storyFlags: { chapter: 3, powerAxis: 50 }, // 误带：sandbox 应忽略
      },
    };
    expect(deserialize(blob).storyFlags).toBeNull();
  });
});

// c-22：schema v3 兼容读取回归（PLAN Constraints——存档格式兼容）。
describe('c22 schema v3 compat read', () => {
  const makeV3Blob = (overrides: Record<string, unknown> = {}) => ({
    schemaVersion: 3,
    state: {
      resources: { grain: 100, gold: 50, cloth: 10, timber: 20, tools: 5 },
      currentDay: 12,
      rngSeed: 42,
      speed: 1,
      paused: false,
      buildings: [],
      populationClasses: { farmer: 10, worker: 4, scholar: 2, merchant: 1, soldier: 3 },
      ...overrides,
    },
    worldMap: null,
  });

  it('v3 存档经迁移链读取成功且补齐 v4+ 新字段的默认值', () => {
    const restored = deserialize(makeV3Blob());
    expect(restored.currentDay).toBe(12);
    expect(restored.rngSeed).toBe(42);
  });

  it('v3 路径钳制生效（speed=99 腐化值仍钳到 1）', () => {
    const blob = makeV3Blob({ speed: 99 });
    const restored = deserialize(blob);
    expect(restored.speed).toBe(1);
  });

  it('v3 存档缺 state 形状非法 → 迁移中抛错而非静默（TypeError 会穿透为未处理异常）', () => {
    // 现行为：state=null 的 v3 blob 在迁移链里解引用抛原生 TypeError——
    // 是「报明确错误而非静默」的边界形态（非 SaveLoadError 类型，修复另批）。
    // c924-05 收紧：裸 .toThrow() 钉成实测类型 TypeError。SaveLoadError 继承 Error 而非 TypeError，
    // 故此断言同时排除"已统一通道化"——真要改判 SaveLoadError 得动生产码，不属本单。
    expect(() => deserialize({ schemaVersion: 3, state: null, worldMap: null })).toThrow(TypeError);
  });
});
