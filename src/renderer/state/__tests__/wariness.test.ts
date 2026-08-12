/**
 * B1 列国警惕值：纯档位 + GameStore 漂移/邦交调整 + 存档 v4→v5 迁移。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type IEventEmitter } from '../gameStore';
import { makeInitialNpcStates } from '../../data/npcCountries';
import { serialize, deserialize, SAVE_SCHEMA_VERSION } from '../saveLoad';
import type { WorldMap } from '../../data/mapSchema';
import {
  warinessBand, clampWariness, WARINESS_BASELINE,
  WARINESS_COALITION_THRESHOLD, WARINESS_DELTAS,
} from '../wariness';

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() });
}

describe('wariness 纯逻辑', () => {
  it('档位阈值', () => {
    expect(warinessBand(0).key).toBe('calm');
    expect(warinessBand(29).key).toBe('calm');
    expect(warinessBand(30).key).toBe('watch');
    expect(warinessBand(54).key).toBe('watch');
    expect(warinessBand(55).key).toBe('wary');
    expect(warinessBand(69).key).toBe('wary');
    expect(warinessBand(WARINESS_COALITION_THRESHOLD).key).toBe('hostile');
  });

  it('clampWariness 夹在 0..100', () => {
    expect(clampWariness(-5)).toBe(0);
    expect(clampWariness(55.9)).toBe(55);
    expect(clampWariness(200)).toBe(100);
    expect(clampWariness(Number.NaN)).toBe(WARINESS_BASELINE);
  });
});

describe('GameStore 警惕值', () => {
  it('初始为基线 20', () => {
    expect(makeStore().getWorldWariness()).toBe(WARINESS_BASELINE);
  });

  it('太平日子每日向基线回落 / 回升', () => {
    const store = makeStore();
    store.replaceState({ ...store.getState(), worldWariness: 30, npcCountries: makeInitialNpcStates() });
    store.tickDay();
    expect(store.getWorldWariness()).toBe(29);
    store.replaceState({ ...store.getState(), worldWariness: 10 });
    store.tickDay();
    expect(store.getWorldWariness()).toBe(11);
  });

  it('通商成功降警惕并记录原因', () => {
    const store = makeStore();
    store.replaceState({
      ...store.getState(),
      npcCountries: makeInitialNpcStates(),
      resources: { ...store.getState().resources, gold: 200, cloth: 20 },
    });
    const r = store.tradeWithNpc('npc_qi');
    expect(r.ok).toBe(true);
    expect(store.getWorldWariness()).toBe(WARINESS_BASELINE + WARINESS_DELTAS.peaceAction);
    expect(store.getWarinessInfo().reason).toBe('通商睦邻');
    expect(store.getWarinessInfo().band.key).toBe('calm');
  });
});

describe('存档 v4 → v5 迁移', () => {
  it('旧档补警惕值基线/无原因', () => {
    const store = makeStore();
    const blob = serialize(store.getState()) as { schemaVersion: number; savedAt: number; state: Record<string, unknown> };
    blob.schemaVersion = 4;
    delete blob.state['worldWariness'];
    delete blob.state['lastWarinessReason'];
    const restored = deserialize(blob);
    expect(restored.worldWariness).toBe(WARINESS_BASELINE);
    expect(restored.lastWarinessReason).toBeNull();
    expect(SAVE_SCHEMA_VERSION).toBe(6);
  });

  it('roundtrip 保留警惕值与原因', () => {
    const store = makeStore();
    store.replaceState({ ...store.getState(), worldWariness: 66, lastWarinessReason: '兴师宣战' });
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(store.getState()))));
    expect(restored.worldWariness).toBe(66);
    expect(restored.lastWarinessReason).toBe('兴师宣战');
  });
});
