/**
 * 域二：人口/社会域外迁件直测（c1023-02 测试随迁批 2/5）。
 * 与 gameStore.test.ts 的人口/供养/阶层 facade 用例互补：这里直接钉
 * domains/populationDomain 纯函数（劳动/招募/级联扣减/转化门槛/饥荒链），
 * 并含「域模块 ↔ GameStore 同源」对照例（同输入同输出，自证零行为漂移）。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  housingCapFor, employedLaborOf, idleLaborOf, recruitToClasses, shrinkClasses,
  tryStartConversion, starvationTickStep,
} from '../domains/populationDomain';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { BuildingInstance } from '../../data/schema';
import type { PopulationClasses } from '../../data/populationClass';

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function inst(defId: string, status: BuildingInstance['status'] = 'working'): BuildingInstance {
  return { defId, position: { x: 0, y: 0 }, status, tier: 1, constructionProgress: 100, modifiers: [] };
}

function classes(farmer = 0, worker = 0, soldier = 0, scholar = 0): PopulationClasses {
  return { farmer, worker, soldier, scholar };
}

describe('populationDomain.housingCapFor / employedLaborOf / idleLaborOf ↔ GameStore 同源对照', () => {
  it('空盘 store：三函数输出与 facade 全等', () => {
    const store = new GameStore(makeEmitter());
    expect(housingCapFor(store.getMode(), [], [])).toBe(store.getHousingCap());
    expect(employedLaborOf([])).toBe(store.getEmployedLabor());
    expect(idleLaborOf(0, store.getEmployedLabor())).toBe(store.getIdleLabor());
  });

  it('带在建/在役建筑：占用只算 constructing+working，废弃不计（同源自证）', () => {
    const store = new GameStore(makeEmitter(), {
      resources: { people: 20 },
      buildings: [inst('bld_farm'), inst('bld_well', 'constructing'), inst('bld_granary', 'derelict')],
      populationClasses: classes(20),
    });
    const buildings = store.getState().buildings;
    expect(employedLaborOf(buildings)).toBe(store.getEmployedLabor());
    expect(employedLaborOf(buildings)).toBeGreaterThan(0);
  });
});

describe('populationDomain.recruitToClasses（原 autoRecruitToClass）', () => {
  it('优先从农民抽调补足目标阶层', () => {
    const pop = classes(10, 0, 0, 0);
    recruitToClasses(pop, { farmer: 0, worker: 0, soldier: 0, scholar: 0 }, 'worker', 3);
    expect(pop).toEqual(classes(7, 3, 0, 0));
  });

  it('目标阶层已有闲置先抵扣，不足再从他阶层抽', () => {
    const pop = classes(5, 4, 0, 0);
    recruitToClasses(pop, { farmer: 0, worker: 2, soldier: 0, scholar: 0 }, 'worker', 5);
    // 已有 2 闲置 worker，缺口 3 全从 farmer 抽
    expect(pop).toEqual(classes(2, 7, 0, 0));
  });

  it('needed<=0 或无缺口时不动作', () => {
    const pop = classes(10, 2, 0, 0);
    recruitToClasses(pop, { farmer: 0, worker: 0, soldier: 0, scholar: 0 }, 'worker', 2);
    expect(pop).toEqual(classes(10, 2, 0, 0));
    recruitToClasses(pop, { farmer: 0, worker: 0, soldier: 0, scholar: 0 }, 'worker', 0);
    expect(pop).toEqual(classes(10, 2, 0, 0));
  });
});

describe('populationDomain.shrinkClasses（原 shrinkPopulationClasses，BUG-A 级联）', () => {
  it('从农→工→兵→士级联扣减、不扣穿 0；返回实际扣减数', () => {
    const pop = classes(2, 2, 2, 2);
    const removed = shrinkClasses(pop, 5);
    expect(removed).toBe(5);
    expect(pop).toEqual(classes(0, 0, 1, 2));
  });

  it('总人数不足时扣到全 0 为止（floor 取整）', () => {
    const pop = classes(1, 1, 0, 0);
    expect(shrinkClasses(pop, 99)).toBe(2);
    expect(pop).toEqual(classes(0, 0, 0, 0));
    expect(shrinkClasses(pop, 2.9)).toBe(0);
  });
});

describe('populationDomain.tryStartConversion（原 startConversion）', () => {
  it('缺前置建筑 → false 且零副作用', () => {
    const pop = classes(10);
    const queue: unknown[] = [];
    const ok = tryStartConversion({ buildings: [], populationClasses: pop, conversionQueue: queue as never }, 'farmer', 'worker', 2);
    expect(ok).toBe(false);
    expect(queue).toHaveLength(0);
    expect(pop).toEqual(classes(10));
  });

  it('与 facade 同源：有建筑 + 名额足够 → 入队 + 即时扣源阶层（与 store.startConversion 一致）', () => {
    const mine = new GameStore(makeEmitter(), {
      resources: { people: 10 },
      buildings: [inst('bld_barracks')],
      populationClasses: classes(10),
    });
    const local = {
      buildings: [inst('bld_barracks')] as BuildingInstance[],
      populationClasses: classes(10),
      conversionQueue: [] as { from: 'farmer'; to: 'soldier'; count: number; daysRemaining: number }[],
    };
    const facadeOk = mine.startConversion('farmer', 'soldier', 2);
    const localOk = tryStartConversion(local, 'farmer', 'soldier', 2);
    expect(facadeOk).toBe(true);
    expect(localOk).toBe(true);
    expect(local.populationClasses).toEqual(classes(8));
    expect(local.conversionQueue).toHaveLength(1);
    expect(local.conversionQueue[0]!.count).toBe(2);
    expect(mine.getState().conversionQueue.length).toBe(1);
  });
});

describe('populationDomain.starvationTickStep（原 runStarvationTick）', () => {
  function io() {
    const ledger: string[] = [];
    const resLog: { id: string; delta: number; reason: string }[] = [];
    let morale = 0;
    let wrath = 0;
    return {
      ledger, resLog, moraleRef: () => morale, wrathRef: () => wrath,
      impl: {
        addResource: (id: string, delta: number, reason: string) => { resLog.push({ id, delta, reason }); },
        adjustMorale: (delta: number, _reason: string) => { ledger.push(`morale:${delta}`); morale += delta; },
        adjustWrath: (delta: number, _reason: string) => { ledger.push(`wrath:${delta}`); wrath += delta; },
        moraleShortPenalty: () => { ledger.push('short:-1'); morale += -1; },
      },
    };
  }

  it('粮足：真实扣粮扣供、缺口计数清零、零减员零罚值', () => {
    const h = io();
    const out = starvationTickStep(
      {
        resources: { grain: 100, cloth: 10, bronze: 10, gold: 10 },
        populationClasses: classes(0, 10, 10, 5),
        grainNegativeDays: 3,
      },
      h.impl as never,
    );
    expect(out.grainNegativeDays).toBe(0);
    const grainCut = h.resLog.filter(l => l.id === 'grain').reduce((s, l) => s + l.delta, 0);
    expect(grainCut).toBeLessThan(0); // 吃粮真实扣（旧 bug：只比较不扣）
    expect(h.ledger.filter(l => l.startsWith('short') || l.startsWith('morale') || l.startsWith('wrath'))).toEqual([]);
  });

  it('缺粮进入宽限：grainNegativeDays 累加；未到 5 日不减员', () => {
    const h = io();
    const out = starvationTickStep(
      {
        resources: { grain: 0 },
        populationClasses: classes(10, 0, 0, 0),
        grainNegativeDays: 2,
      },
      h.impl as never,
    );
    expect(out.grainNegativeDays).toBe(3);
    expect(out.populationClasses).toEqual(classes(10, 0, 0, 0));
  });

  it('次序回归钉：供养短缺直扣(-1)先于 applyStarvation 罚值 adjustMorale(-3)——读同一 state 不漂移', () => {
    const h = io();
    const out = starvationTickStep(
      {
        resources: { grain: 0, cloth: 0 },
        populationClasses: classes(0, 10, 0, 5),
        grainNegativeDays: 15, // 已过宽限 + 温和期 → 罚值 -3
      },
      h.impl as never,
    );
    expect(out.grainNegativeDays).toBe(16);
    expect(h.ledger).toEqual(['short:-1', 'morale:-3', 'wrath:2']);
    expect(h.moraleRef()).toBe(-4);
  });

  it('与 facade 同源：持续缺粮 6 日后出现 starvation 减员（store 直跑对照）', () => {
    const store = new GameStore(makeEmitter(), { resources: { people: 10, grain: 1 } });
    for (let i = 0; i < 6; i++) store.tickDay();
    const st = store.getState();
    expect(st.grainNegativeDays).toBeGreaterThanOrEqual(1);
    // 宽限 5 日后开始温和减员：总人口不高于 10
    expect(st.resources.people ?? 0).toBeLessThanOrEqual(10);
  });
});
