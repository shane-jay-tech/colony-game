/**
 * C1 古迹事件链：种子生成 / 阶段推进 / GameStore 完整三阶段游玩 / 存档 v6→v7 迁移。
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import { serialize, deserialize, SAVE_SCHEMA_VERSION } from '../saveLoad';
import { RELIC_CHAINS, generateRelicSites, advanceRelic } from '../relicSystem';
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

describe('relicSystem 纯逻辑', () => {
  it('种子确定性生成 2~4 个古迹点，链条不重复', () => {
    const a = generateRelicSites(42, 80, 80);
    const b = generateRelicSites(42, 80, 80);
    expect(a.length).toBeGreaterThanOrEqual(2);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(a.map(s => `${s.chainId}:${s.position.x},${s.position.y}`))
      .toEqual(b.map(s => `${s.chainId}:${s.position.x},${s.position.y}`));
    expect(new Set(a.map(s => s.chainId)).size).toBe(a.length);
  });

  it('advanceRelic 逐阶段推进，三阶段后完成', () => {
    const chain = RELIC_CHAINS[0]!;
    const site = { id: 'r0', chainId: chain.id, name: chain.name, position: { x: 0, y: 0 }, stage: 0, done: false };
    const r1 = advanceRelic(site, 0);
    expect(r1.site.stage).toBe(1);
    expect(r1.completed).toBe(false);
    const r2 = advanceRelic(r1.site, 1);
    expect(r2.site.stage).toBe(2);
    const r3 = advanceRelic(r2.site, 0);
    expect(r3.site.stage).toBe(3);
    expect(r3.completed).toBe(true);
    expect(r3.site.done).toBe(true);
  });
});

describe('GameStore 古迹链完整游玩', () => {
  function advanceUntilRelic(store: GameStore, pattern: RegExp): void {
    for (let i = 0; i < 120 && !pattern.test(store.getPendingEventId() ?? ''); i++) {
      store.tickDay();
    }
    expect(store.getPendingEventId() ?? '').toMatch(pattern);
  }

  it('古迹事件三阶段可通：抉择生效、完成发 RELIC_RESOLVED', () => {
    const store = makeStore();
    const chain = RELIC_CHAINS[0]!;
    store.replaceState({
      ...store.getState(),
      relicSites: [{ id: 'r0', chainId: chain.id, name: chain.name, position: { x: 0, y: 0 }, stage: 0, done: false }],
    });
    const resolved = vi.fn();
    store.on(STATE_EVENTS.RELIC_RESOLVED, resolved);

    advanceUntilRelic(store, /^relic_r0_s0$/);
    store.resolveEvent(0); // 战场链 S0 选择 0：民心 +5 / 怨愤 −3 / 信誉 +2
    expect(store.getState().relicSites[0]!.stage).toBe(1);
    expect(store.getState().activeModifiers.some(m => m.id === 'mod_relic_r0_0')).toBe(true);

    advanceUntilRelic(store, /^relic_r0_s1$/);
    store.resolveEvent(0);
    advanceUntilRelic(store, /^relic_r0_s2$/);
    store.resolveEvent(0);

    expect(store.getState().relicSites[0]!.done).toBe(true);
    expect(resolved).toHaveBeenCalledOnce();
    // 全部完成后再 tick，不再有古迹事件挂起
    for (let i = 0; i < 60 && store.getPendingEventId() !== null; i++) store.tickDay();
    const pending = store.getPendingEventId();
    expect(pending === null || !/^relic_/.test(pending)).toBe(true);
  });
});

describe('存档 v6 → v7 迁移', () => {
  it('旧档补 relicSites=[]', () => {
    const store = makeStore();
    const blob = serialize(store.getState()) as { schemaVersion: number; savedAt: number; state: Record<string, unknown> };
    blob.schemaVersion = 6;
    delete blob.state['relicSites'];
    const restored = deserialize(blob);
    expect(restored.relicSites).toEqual([]);
    expect(SAVE_SCHEMA_VERSION).toBe(9); // v9 = P2 通牒
  });

  it('roundtrip 保留古迹进度', () => {
    const store = makeStore();
    store.replaceState({
      ...store.getState(),
      relicSites: [{ id: 'r0', chainId: 'ancient_mine', name: '古矿坑', position: { x: 3, y: 4 }, stage: 2, done: false }],
    });
    const restored = deserialize(JSON.parse(JSON.stringify(serialize(store.getState()))));
    expect(restored.relicSites).toHaveLength(1);
    expect(restored.relicSites[0]!.stage).toBe(2);
  });
});
