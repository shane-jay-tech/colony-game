/**
 * 域一：经济/资源域外迁件直测（c1023-01 测试随迁批 1/5）。
 * 与 gameStore.test.ts 的 facade 用例（addResource/getResourceCap）互补：
 * 这里直接钉 domains/resourceDomain 纯函数，并含「域模块 ↔ GameStore 同源」对照例
 * （同输入下 dailyRatesSnapshot 输出与 facade getDailyRates 全等，自证零行为漂移）。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  RESOURCE_CAP_BASE,
  resourceCapFor,
  clampResourceValue,
  applyResourceDeltas,
  dailyRatesSnapshot,
} from '../domains/resourceDomain';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { BuildingInstance } from '../../data/schema';
import type { ResourceId } from '../../data/resourceRegistry';

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function granaryInst(status: BuildingInstance['status'] = 'working'): BuildingInstance {
  return { defId: 'bld_granary', position: { x: 0, y: 0 }, status, tier: 2, constructionProgress: 100, modifiers: [] };
}

describe('resourceDomain.resourceCapFor（原 getResourceCap 主体）', () => {
  it('无仓廪 → 上限 9999（基数常量随迁）', () => {
    expect(RESOURCE_CAP_BASE).toBe(9999);
    expect(resourceCapFor('grain', [])).toBe(9999);
  });

  it('一座 working 仓廪 → 存储类资源上限 ×1.5', () => {
    expect(resourceCapFor('grain', [granaryInst()])).toBe(Math.round(9999 * 1.5));
  });

  it('多座仓廪线性叠加但封顶 ×3', () => {
    const many = [granaryInst(), granaryInst(), granaryInst(), granaryInst(), granaryInst()];
    expect(resourceCapFor('grain', many)).toBe(Math.round(9999 * 3)); // min(3, 1+5×0.5)=3
  });

  it('people 不受仓廪影响（其约束是住房上限）', () => {
    expect(resourceCapFor('people', [granaryInst()])).toBe(9999);
  });

  it('在建/废弃仓廪不计入', () => {
    expect(resourceCapFor('grain', [granaryInst('constructing')])).toBe(9999);
    expect(resourceCapFor('grain', [granaryInst('derelict')])).toBe(9999);
  });
});

describe('resourceDomain.clampResourceValue（原 setResourceClamped 内联式）', () => {
  it('NaN → null（丢弃判定交回调用方，c925-6c4b 契约）', () => {
    expect(clampResourceValue(Number.NaN, 9999)).toBeNull();
  });

  it('负值钳到 0；小数 floor；超上限钳到 cap', () => {
    expect(clampResourceValue(-100, 9999)).toBe(0);
    expect(clampResourceValue(5.9, 9999)).toBe(5);
    expect(clampResourceValue(0.4, 9999)).toBe(0);
    expect(clampResourceValue(99999, 9999)).toBe(9999);
  });

  it('溢出（±Infinity）不走 NaN 闸：min/max 自然钳到 0 / cap（既有正确行为）', () => {
    expect(clampResourceValue(Number.POSITIVE_INFINITY, 9999)).toBe(9999);
    expect(clampResourceValue(Number.NEGATIVE_INFINITY, 9999)).toBe(0);
  });
});

describe('resourceDomain.applyResourceDeltas（原 applyDayDeltas 循环）', () => {
  it('undefined 增量跳过；其余按 RESOURCE_IDS 序交 setClamped（current+delta）', () => {
    const resources: Partial<Record<ResourceId, number>> = { grain: 100, gold: 50 };
    const calls: [ResourceId, number][] = [];
    applyResourceDeltas(resources, { grain: -30, wood: undefined, gold: 5 }, (id, v) => calls.push([id, v]));
    expect(calls).toEqual([['grain', 70], ['gold', 55]]);
  });

  it('与 facade 同源：GameStore.applyDayDeltas 落库结果与直调循环一致', () => {
    const store = new GameStore(makeEmitter(), { resources: { grain: 100, gold: 50 } });
    store.applyDayDeltas({ grain: -30, wood: undefined, gold: 5 });
    const resources2: Partial<Record<ResourceId, number>> = { grain: 100, gold: 50 };
    const sink: Partial<Record<ResourceId, number>> = { grain: 100, gold: 50 };
    applyResourceDeltas(sink, { grain: -30, wood: undefined, gold: 5 }, (id, v) => {
      sink[id] = Math.max(0, Math.floor(v)); // store 侧基数 cap 同为 9999，此处不会触顶
    });
    expect(store.getState().resources.grain).toBe(sink.grain);
    expect(store.getState().resources.gold).toBe(sink.gold);
  });
});

describe('resourceDomain.dailyRatesSnapshot ↔ GameStore.getDailyRates 同源对照', () => {
  it('空盘 store：域模块输出与 facade 全等', () => {
    const store = new GameStore(makeEmitter());
    expect(dailyRatesSnapshot({
      buildings: [],
      populationClasses: { farmer: 0, worker: 0, soldier: 0, scholar: 0 },
      resources: {},
      activeModifiers: [],
    })).toEqual(store.getDailyRates());
  });

  it('带建筑/阶层/资源/modifier 的 store：同输入同输出（零行为漂移自证）', () => {
    const farm: BuildingInstance = { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] };
    const store = new GameStore(makeEmitter(), {
      buildings: [farm],
      populationClasses: { farmer: 10, worker: 4, soldier: 2, scholar: 1 },
      resources: { grain: 500, gold: 100, people: 17 },
    });
    store.addModifier({
      id: 'mod_test_grain', name: 'test', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_output', op: 'add', value: 3 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    });
    const state = store.getState();
    expect(dailyRatesSnapshot({
      buildings: state.buildings,
      populationClasses: state.populationClasses,
      resources: state.resources,
      activeModifiers: state.activeModifiers,
    })).toEqual(store.getDailyRates());
  });
});
