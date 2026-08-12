/**
 * A1 双轴民心：怨愤纯逻辑 + GameStore 集成 + 存档 v3→v4 迁移。
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import { serialize, deserialize, SAVE_SCHEMA_VERSION } from '../saveLoad';
import { FACTION_DEMANDS } from '../../data/factions';
import type { WorldMap } from '../../data/mapSchema';
import {
  clampSentiment, shouldForceWrathDemand, WRATH_DEMAND_THRESHOLD,
  WRATH_DEMAND_COOLDOWN_DAYS, WRATH_DEMAND_ACCEPTED, WRATH_DEMAND_REJECTED,
} from '../publicSentiment';

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() });
}

describe('publicSentiment 纯逻辑', () => {
  it('clampSentiment 夹在 0..100 并取整', () => {
    expect(clampSentiment(-3)).toBe(0);
    expect(clampSentiment(50.9)).toBe(50);
    expect(clampSentiment(120)).toBe(100);
    expect(clampSentiment(Number.NaN)).toBe(0);
  });

  it('shouldForceWrathDemand 遵守阈值与冷却', () => {
    expect(shouldForceWrathDemand(WRATH_DEMAND_THRESHOLD - 1, null, 100)).toBe(false);
    expect(shouldForceWrathDemand(WRATH_DEMAND_THRESHOLD, null, 100)).toBe(true);
    expect(shouldForceWrathDemand(WRATH_DEMAND_THRESHOLD, 100, 100 + WRATH_DEMAND_COOLDOWN_DAYS - 1)).toBe(false);
    expect(shouldForceWrathDemand(WRATH_DEMAND_THRESHOLD, 100, 100 + WRATH_DEMAND_COOLDOWN_DAYS)).toBe(true);
  });
});

describe('GameStore 怨愤行为', () => {
  it('初始怨愤为 0，太平日子每天自然回落', () => {
    const store = makeStore();
    expect(store.getPublicWrath()).toBe(0);
    store.replaceState({ ...store.getState(), publicWrath: 10, lastWrathDemandDay: null });
    store.tickDay();
    expect(store.getPublicWrath()).toBe(9);
  });

  it('危机期间怨愤不回落', () => {
    const store = makeStore();
    store.replaceState({ ...store.getState(), publicWrath: 10, crisisActive: true });
    store.tickDay();
    expect(store.getPublicWrath()).toBe(10);
  });

  it('民心鼎盛给颂声加成，回落即移除', () => {
    const store = makeStore();
    store.replaceState({ ...store.getState(), playerMorale: 85 });
    store.tickDay();
    expect(store.getState().activeModifiers.some(m => m.id === 'mod_praise_of_people')).toBe(true);
    store.replaceState({ ...store.getState(), playerMorale: 60 });
    store.tickDay();
    expect(store.getState().activeModifiers.some(m => m.id === 'mod_praise_of_people')).toBe(false);
  });

  it('怨愤临界触发警示 + 强推诉求，且遵守冷却', () => {
    const store = makeStore();
    const alerts: unknown[] = [];
    store.on(STATE_EVENTS.WRATH_ALERT, (p) => alerts.push(p));
    store.replaceState({ ...store.getState(), publicWrath: WRATH_DEMAND_THRESHOLD, lastWrathDemandDay: null });
    store.tickDay();
    expect(alerts).toHaveLength(1);
    expect(store.getState().lastWrathDemandDay).toBe(store.getState().currentDay);
    expect(store.getState().factionState.nextEventDay).toBeLessThanOrEqual(store.getState().currentDay + 1);
    // 冷却期内不再重复触发（怨愤仍高于阈值）
    store.tickDay();
    expect(alerts).toHaveLength(1);
  });

  it('拒绝诉求积怨、接受诉求消怨', () => {
    const store = makeStore();
    const demand = FACTION_DEMANDS[0];
    if (!demand) throw new Error('FACTION_DEMANDS empty');
    store.replaceState({
      ...store.getState(),
      publicWrath: 30,
      factionState: { ...store.getState().factionState, activeDemand: demand },
    });
    store.resolveFactionDemand(false);
    expect(store.getPublicWrath()).toBe(30 + WRATH_DEMAND_REJECTED);
    store.replaceState({
      ...store.getState(),
      factionState: { ...store.getState().factionState, activeDemand: demand },
    });
    store.resolveFactionDemand(true);
    expect(store.getPublicWrath()).toBe(30 + WRATH_DEMAND_REJECTED + WRATH_DEMAND_ACCEPTED);
  });
});

describe('存档 v3 → v4 迁移', () => {
  it('旧档迁移补 publicWrath/lastWrathDemandDay 安全初值', () => {
    const store = makeStore();
    const blob = serialize(store.getState()) as { schemaVersion: number; savedAt: number; state: Record<string, unknown> };
    blob.schemaVersion = 3;
    delete blob.state['publicWrath'];
    delete blob.state['lastWrathDemandDay'];
    const restored = deserialize(blob);
    expect(restored.publicWrath).toBe(0);
    expect(restored.lastWrathDemandDay).toBeNull();
    expect(SAVE_SCHEMA_VERSION).toBe(8);
  });

  it('roundtrip 保留怨愤与冷却日', () => {
    const store = makeStore();
    store.replaceState({ ...store.getState(), publicWrath: 42, lastWrathDemandDay: 33 });
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(store.getState()))));
    expect(restored.publicWrath).toBe(42);
    expect(restored.lastWrathDemandDay).toBe(33);
  });
});
