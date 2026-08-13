/**
 * P0-3 tick 性能回归闸门：只拦「灾难性退化」（如每 tick 从毫秒级退化成百毫秒级），
 * 不做微基准（CI 波动无意义）。同时验证长跑后资源仍有限非 NaN。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type IEventEmitter } from '../gameStore';
import { POLICIES, EVENTS, DECREES } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import { RESOURCE_IDS } from '../../data/resourceRegistry';
import type { ResourceId } from '../../data/resourceRegistry';

describe('P0-3 tick 性能闸门', () => {
  it('300 日 tick 总量不超 30s（灾难退化拦截），且终局资源有限非 NaN', () => {
    const ee = new EventEmitter() as unknown as IEventEmitter;
    const store = new GameStore(ee, { rngSeed: 7 }, {
      policies: POLICIES, events: EVENTS, decrees: DECREES,
    });
    for (const [id, amount] of Object.entries(BALANCE.startingResources)) {
      if (amount && amount > 0) store.addResource(id as ResourceId, amount);
    }
    // 铺一些建筑与人口，让 tick 的 production/occupation 路径充分展开
    store.replaceState({
      ...store.getState(),
      resources: { ...store.getState().resources, people: 200, grain: 5000, wood: 2000, stone: 2000, gold: 2000, cloth: 200, bronze: 200 },
      populationClasses: { farmer: 120, worker: 40, soldier: 20, scholar: 20 },
    });

    const start = performance.now();
    for (let i = 0; i < 300; i++) store.tickDay();
    const elapsedMs = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`[tickPerf] 300 days in ${elapsedMs.toFixed(0)}ms (${(elapsedMs / 300).toFixed(2)}ms/tick)`);
    expect(elapsedMs).toBeLessThan(30_000);

    for (const id of RESOURCE_IDS) {
      const v = store.getState().resources[id] ?? 0;
      expect(Number.isFinite(v), `${id} NaN`).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(9999);
    }
  });
});
