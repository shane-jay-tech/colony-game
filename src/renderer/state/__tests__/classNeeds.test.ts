/**
 * A2 阶层需求环：纯逻辑 + 生产积分（buildingFactor 生效）+ 人口加权。
 */
import { describe, it, expect } from 'vitest';
import {
  CLASS_NEEDS, computeClassNeedState, fulfillmentFactor,
  populationFulfillment, buildingFulfillmentFactor,
} from '../classNeeds';
import { computeProductionTick } from '../productionSystem';
import type { BuildingDef, BuildingInstance } from '../../data/schema';
import type { PopulationClasses } from '../../data/populationClass';
import type { ResourceId } from '../../data/resourceRegistry';

function inst(defId: string, status: 'working' | 'constructing' = 'working'): BuildingInstance {
  return {
    defId, position: { x: 0, y: 0 }, status,
    tier: 1, constructionProgress: status === 'working' ? 100 : 50, modifiers: [],
  };
}

function def(id: string, output: { resource: ResourceId; perDay: number }[] = []): BuildingDef {
  return {
    id, name: id, category: '民生', tier: 1, cost: {}, constructionTime: 5,
    output, upkeep: {}, size: { width: 1, height: 1 },
    assetKey: id, upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
  };
}

const resources = { grain: 5, rite: 2 };

describe('fulfillmentFactor', () => {
  it('0 满足给 0.5 保底，全满足给 1.0，线性中间值', () => {
    expect(fulfillmentFactor(0)).toBe(0.5);
    expect(fulfillmentFactor(1)).toBe(1);
    expect(fulfillmentFactor(0.5)).toBe(0.75);
    expect(fulfillmentFactor(-1)).toBe(0.5);
    expect(fulfillmentFactor(2)).toBe(1);
  });
});

describe('computeClassNeedState', () => {
  it('农：有居所+足食 → 无缺口；拆居所 → 缺安居', () => {
    const buildings = [inst('bld_house')];
    const full = computeClassNeedState('farmer', buildings, resources);
    expect(full.unmet).toEqual([]);
    expect(full.factor).toBe(1);
    const noHouse = computeClassNeedState('farmer', [], resources);
    expect(noHouse.unmet).toEqual(['安居']);
    expect(noHouse.factor).toBe(0.75);
  });

  it('工：缺市集即低效，建市集恢复', () => {
    const buildings = [inst('bld_house')];
    const lacking = computeClassNeedState('worker', buildings, resources);
    expect(lacking.unmet).toContain('市集');
    expect(lacking.factor).toBeCloseTo(0.8333, 3);
    const withMarket = computeClassNeedState('worker', [inst('bld_house'), inst('bld_market')], resources);
    expect(withMarket.unmet).toEqual([]);
    expect(withMarket.factor).toBe(1);
  });

  it('士：需教化（学院）与礼器', () => {
    const lacking = computeClassNeedState('scholar', [inst('bld_house')], {});
    expect(lacking.unmet).toEqual(['教化', '礼器']);
    const full = computeClassNeedState(
      'scholar',
      [inst('bld_house'), inst('bld_academy')],
      resources,
    );
    expect(full.unmet).toEqual([]);
  });

  it('每个阶层的需求表都非空', () => {
    for (const cls of Object.keys(CLASS_NEEDS) as (keyof typeof CLASS_NEEDS)[]) {
      expect(CLASS_NEEDS[cls].length).toBeGreaterThan(0);
    }
  });
});

describe('populationFulfillment / buildingFulfillmentFactor', () => {
  it('按阶层人数加权平均', () => {
    const pop: PopulationClasses = { farmer: 10, worker: 10, soldier: 0, scholar: 0 };
    // 农夫全满足=1；工匠缺市集=2/3 → factor 0.8333；加权=(10+8.333)/20=0.9167
    const f = populationFulfillment(pop, [inst('bld_house')], resources);
    expect(f).toBeCloseTo(0.9167, 3);
  });

  it('无人口时系数为 1（不开局惩罚）', () => {
    const pop: PopulationClasses = { farmer: 0, worker: 0, soldier: 0, scholar: 0 };
    expect(populationFulfillment(pop, [], {})).toBe(1);
  });

  it('buildingFulfillmentFactor 按阶层取系数，缺省按农', () => {
    const buildings = [inst('bld_house'), inst('bld_market')];
    expect(buildingFulfillmentFactor('worker', buildings, resources)).toBe(1);
    expect(buildingFulfillmentFactor(undefined, buildings, resources)).toBe(1);
    expect(buildingFulfillmentFactor('worker', [inst('bld_house')], resources)).toBeCloseTo(0.8333, 3);
  });
});

describe('生产积分', () => {
  it('buildingFactor 按需求系数打折产出', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const lookup = (id: string) => (id === 'farm' ? farm : undefined);
    const half = computeProductionTick([inst('farm')], lookup, [], {}, () => 0.5);
    expect(half.deltas.grain).toBe(5);
    const full = computeProductionTick([inst('farm')], lookup, []);
    expect(full.deltas.grain).toBe(10);
  });
});
