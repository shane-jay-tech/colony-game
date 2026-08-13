import { describe, it, expect } from 'vitest';
import { producersFor } from '../supplyChain';
import type { BuildingDef } from '../../data/schema';
import type { ResourceId } from '../../data/resourceRegistry';

/**
 * P1 信息可视化 · 供应链提示纯函数测试：产家筛选与日产降序。
 */

function def(id: string, name: string, output: { resource: ResourceId; perDay: number }[]): BuildingDef {
  return {
    id, name, category: '民生', tier: 1, cost: {}, constructionTime: 1,
    output, upkeep: {}, size: { width: 1, height: 1 },
    assetKey: id, upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
  };
}

describe('producersFor — 因果链数据源', () => {
  it('只返回产出该资源的建筑，按单栋日产降序', () => {
    const defs = [
      def('a', '甲', [{ resource: 'cloth', perDay: 2 }]),
      def('b', '乙', [{ resource: 'cloth', perDay: 6 }]),
      def('c', '丙', [{ resource: 'grain', perDay: 9 }]),
    ];
    const r = producersFor('cloth', defs);
    expect(r.map(p => p.defId)).toEqual(['b', 'a']);
    expect(r[0]!.perDay).toBe(6);
  });

  it('无产家返回空表', () => {
    const defs = [def('a', '甲', [{ resource: 'grain', perDay: 9 }])];
    expect(producersFor('rite', defs)).toEqual([]);
  });

  it('多产出建筑取该资源第一条 output 的日产', () => {
    const defs = [def('a', '甲', [
      { resource: 'grain', perDay: 5 },
      { resource: 'cloth', perDay: 3 },
    ])];
    const r = producersFor('cloth', defs);
    expect(r).toHaveLength(1);
    expect(r[0]!.perDay).toBe(3);
  });
});
