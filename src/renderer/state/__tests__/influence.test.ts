/**
 * B2 影响力（名望）：产出/上限/三用（宣传/斡旋/修史）+ 存档 v5→v6 迁移。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type IEventEmitter } from '../gameStore';
import { serialize, deserialize, SAVE_SCHEMA_VERSION } from '../saveLoad';
import type { WorldMap } from '../../data/mapSchema';

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() });
}

function setInfluence(store: GameStore, amount: number): void {
  store.replaceState({ ...store.getState(), resources: { ...store.getState().resources, influence: amount } });
}

describe('B2 影响力', () => {
  it('每日按国格产出，满上限不再累积', () => {
    const store = makeStore();
    expect(store.getInfluence()).toBe(0);
    store.tickDay();
    expect(store.getInfluence()).toBe(1);
    setInfluence(store, 39);
    store.tickDay();
    expect(store.getInfluence()).toBe(40); // grade0 上限 40
    store.tickDay();
    expect(store.getInfluence()).toBe(40);
  });

  it('宣扬德政：扣名望、压怨愤涨民心，7 日内重复减半', () => {
    const store = makeStore();
    expect(store.spendPropaganda().ok).toBe(false); // 名望不足
    setInfluence(store, 50);
    store.replaceState({ ...store.getState(), publicWrath: 40, playerMorale: 40 });
    const first = store.spendPropaganda();
    expect(first.ok).toBe(true);
    expect(first.diminished).toBe(false);
    expect(store.getInfluence()).toBe(30);
    expect(store.getPublicWrath()).toBe(28); // -12
    expect(store.getPlayerMorale()).toBe(46); // +6
    const second = store.spendPropaganda();
    expect(second.ok).toBe(true);
    expect(second.diminished).toBe(true);
    expect(store.getPublicWrath()).toBe(22); // 第二次 -6
  });

  it('遣使斡旋：扣名望、降列国警惕', () => {
    const store = makeStore();
    setInfluence(store, 30);
    store.replaceState({ ...store.getState(), worldWariness: 30 });
    expect(store.spendDiplomacyInfluence().ok).toBe(true);
    expect(store.getInfluence()).toBe(15);
    expect(store.getWorldWariness()).toBe(22);
  });

  it('修史立传：30 日信誉加成，进行中不可重复', () => {
    const store = makeStore();
    setInfluence(store, 50);
    expect(store.spendChronicle().ok).toBe(true);
    expect(store.getInfluence()).toBe(25);
    expect(store.getState().activeModifiers.some(m => m.id === 'mod_chronicle_renown')).toBe(true);
    expect(store.spendChronicle().reason).toBe('修史未竟，不可重开');
  });
});

describe('存档 v5 → v6 迁移', () => {
  it('旧档补 lastPropagandaDay=null', () => {
    const store = makeStore();
    const blob = serialize(store.getState()) as { schemaVersion: number; savedAt: number; state: Record<string, unknown> };
    blob.schemaVersion = 5;
    delete blob.state['lastPropagandaDay'];
    const restored = deserialize(blob);
    expect(restored.lastPropagandaDay).toBeNull();
    expect(SAVE_SCHEMA_VERSION).toBe(8);
  });

  it('roundtrip 保留宣传冷却日', () => {
    const store = makeStore();
    store.replaceState({ ...store.getState(), lastPropagandaDay: 77 });
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(store.getState()))));
    expect(restored.lastPropagandaDay).toBe(77);
  });
});
