import { describe, it, expect } from 'vitest';
import { computeProductionTick, applyDeltasToBag, computeDailyRates, formatRate } from '../productionSystem';
import type { BuildingDef, BuildingInstance, ModifierInstance } from '../../data/schema';
import type { ResourceId } from '../../data/resourceRegistry';

function def(
  id: string,
  output: { resource: ResourceId; perDay: number }[] = [],
  upkeep: Partial<Record<ResourceId, number>> = {},
): BuildingDef {
  return {
    id, name: id, category: '民生', tier: 1, cost: {}, constructionTime: 5,
    output, upkeep, size: { width: 1, height: 1 },
    assetKey: id, upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
  };
}

function inst(defId: string, status: 'working' | 'constructing' | 'paused' = 'working'): BuildingInstance {
  return {
    defId, position: { x: 0, y: 0 }, status,
    tier: 1, constructionProgress: status === 'working' ? 100 : 50, modifiers: [],
  };
}

const lookup = (defs: BuildingDef[]) => (id: string) => defs.find(d => d.id === id);

describe('computeProductionTick — output basics', () => {
  it('working farm gives +10 grain', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const result = computeProductionTick([inst('farm')], lookup([farm]), []);
    expect(result.deltas.grain).toBe(10);
  });

  it('constructing farm contributes 0', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const result = computeProductionTick([inst('farm', 'constructing')], lookup([farm]), []);
    expect(result.deltas.grain ?? 0).toBe(0);
  });

  it('paused farm contributes 0', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const result = computeProductionTick([inst('farm', 'paused')], lookup([farm]), []);
    expect(result.deltas.grain ?? 0).toBe(0);
  });

  it('two farms aggregate', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const result = computeProductionTick([inst('farm'), inst('farm')], lookup([farm]), []);
    expect(result.deltas.grain).toBe(20);
  });

  it('consumes 原料按栋数进净额（麻→布链）', () => {
    const loom = def('loom', [{ resource: 'cloth', perDay: 4 }]);
    loom.consumes = { hemp: 2 };
    const result = computeProductionTick([inst('loom')], lookup([loom]), []);
    expect(result.deltas.cloth).toBe(4);
    expect(result.deltas.hemp).toBe(-2);
  });
});

describe('computeProductionTick — modifiers', () => {
  it('country_grain_output mul 1.5 applies to raw output', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const mods: ModifierInstance[] = [{
      id: 'mul', name: 'mul', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_output', op: 'mul', value: 1.5 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    }];
    const result = computeProductionTick([inst('farm')], lookup([farm]), mods);
    expect(result.deltas.grain).toBe(15);
  });

  it('country_grain_consumption mul 2 doubles upkeep', () => {
    const camp = def('camp', [], { grain: 5 });
    const mods: ModifierInstance[] = [{
      id: 'cons', name: 'cons', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_consumption', op: 'mul', value: 2 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    }];
    const result = computeProductionTick([inst('camp')], lookup([camp]), mods);
    expect(result.deltas.grain).toBe(-10);
  });
});

describe('computeProductionTick — robustness', () => {
  it('missing def is silently skipped (no NaN)', () => {
    const result = computeProductionTick([inst('missing')], () => undefined, []);
    expect(result.deltas).toEqual({});
  });

  it('zero buildings yields empty deltas', () => {
    expect(computeProductionTick([], () => undefined, []).deltas).toEqual({});
  });

  it('detail records raw values even when net is 0', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 5 }], { grain: 5 });
    const result = computeProductionTick([inst('farm')], lookup([farm]), []);
    expect(result.detail.grain?.rawOutput).toBe(5);
    expect(result.detail.grain?.rawUpkeep).toBe(5);
    expect(result.detail.grain?.net).toBe(0);
    // net=0 should NOT pollute deltas
    expect(result.deltas.grain).toBeUndefined();
  });
});

describe('computeProductionTick — fractional accumulator (Slice G hardening)', () => {
  it('0.4 grain/day accumulates over multiple ticks instead of always rounding to 0', () => {
    // 用 mul 0.04 把 raw 10 拉成 0.4 — 模拟微小产出场景
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const mods: ModifierInstance[] = [{
      id: 'frac', name: 'frac', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_output', op: 'mul', value: 0.04 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    }];
    let carry: Partial<Record<ResourceId, number>> = {};
    const sequence: number[] = [];
    for (let i = 0; i < 5; i++) {
      const result = computeProductionTick([inst('farm')], lookup([farm]), mods, carry);
      sequence.push(result.deltas.grain ?? 0);
      carry = result.fractionalCarry;
    }
    // 5 days × 0.4 = 2.0；任意分布只要总和=2 即可
    expect(sequence.reduce((a, b) => a + b, 0)).toBe(2);
    // 至少要有一天非 0 — 证明累加器在工作
    expect(sequence.some(d => d !== 0)).toBe(true);
  });

  it('exact integer outputs leave no carry', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const result = computeProductionTick([inst('farm')], lookup([farm]), [], {});
    expect(result.deltas.grain).toBe(10);
    expect(result.fractionalCarry).toEqual({});
  });

  it('previous carry is honored even when buildings produce nothing', () => {
    // 玩家拆光所有 farm 之后，残留的 0.7 grain carry 应该最终 emit 出来
    const farm = def('farm', [{ resource: 'grain', perDay: 0 }]);
    let carry: Partial<Record<ResourceId, number>> = { grain: 0.7 };
    const r1 = computeProductionTick([inst('farm')], lookup([farm]), [], carry);
    // 0.7 不到 1 → 这一 tick 还是 0，但 carry 应继续持有
    expect(r1.deltas.grain ?? 0).toBe(0);
    expect(r1.fractionalCarry.grain).toBeCloseTo(0.7);
  });
});

// v1.0 #3：相邻加成（参纪元 1800）
describe('computeProductionTick — adjacency bonus', () => {
  function defWithAdjacency(
    id: string,
    output: { resource: ResourceId; perDay: number }[],
    adjacencyBonus: BuildingDef['adjacencyBonus'],
    size: { width: number; height: number } = { width: 1, height: 1 },
  ): BuildingDef {
    return {
      id, name: id, category: '民生', tier: 1, cost: {}, constructionTime: 5,
      output, upkeep: {}, size,
      assetKey: id, upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
      adjacencyBonus,
    };
  }
  function instAt(defId: string, x: number, y: number, status: BuildingInstance['status'] = 'working'): BuildingInstance {
    return {
      defId, position: { x, y }, status,
      tier: 1, constructionProgress: status === 'working' ? 100 : 50, modifiers: [],
    };
  }

  it('no partner → multiplier defaults to 1', () => {
    const farm = defWithAdjacency('farm', [{ resource: 'grain', perDay: 10 }], [
      { partnerDefId: 'well', range: 3, resource: 'grain', outputMul: 1.30, description: 't' },
    ]);
    const well = def('well');
    const result = computeProductionTick([instAt('farm', 0, 0)], lookup([farm, well]), []);
    expect(result.deltas.grain).toBe(10);
  });

  it('partner within range → multiplier applies', () => {
    const farm = defWithAdjacency('farm', [{ resource: 'grain', perDay: 10 }], [
      { partnerDefId: 'well', range: 3, resource: 'grain', outputMul: 1.30, description: 't' },
    ]);
    const well = def('well');
    const result = computeProductionTick(
      [instAt('farm', 0, 0), instAt('well', 2, 0)],
      lookup([farm, well]),
      [],
    );
    // 10 * 1.30 = 13
    expect(result.deltas.grain).toBe(13);
  });

  it('partner just out of range (Manhattan) → no bonus', () => {
    const farm = defWithAdjacency('farm', [{ resource: 'grain', perDay: 10 }], [
      { partnerDefId: 'well', range: 2, resource: 'grain', outputMul: 1.30, description: 't' },
    ]);
    const well = def('well');
    // Manhattan distance: well at (5,0) - farm at (0,0) → 5 > 2
    const result = computeProductionTick(
      [instAt('farm', 0, 0), instAt('well', 5, 0)],
      lookup([farm, well]),
      [],
    );
    expect(result.deltas.grain).toBe(10);
  });

  it('non-working partner does NOT trigger bonus', () => {
    const farm = defWithAdjacency('farm', [{ resource: 'grain', perDay: 10 }], [
      { partnerDefId: 'well', range: 3, resource: 'grain', outputMul: 1.30, description: 't' },
    ]);
    const well = def('well');
    const result = computeProductionTick(
      [instAt('farm', 0, 0), instAt('well', 2, 0, 'constructing')],
      lookup([farm, well]),
      [],
    );
    expect(result.deltas.grain).toBe(10);
  });

  it('two competing rules → take max mul (no stacking)', () => {
    const farm = defWithAdjacency('farm', [{ resource: 'grain', perDay: 10 }], [
      { partnerDefId: 'well', range: 3, resource: 'grain', outputMul: 1.30, description: 'w' },
      { partnerDefId: 'mill', range: 3, resource: 'grain', outputMul: 1.20, description: 'm' },
    ]);
    const well = def('well');
    const mill = def('mill');
    const result = computeProductionTick(
      [instAt('farm', 0, 0), instAt('well', 2, 0), instAt('mill', 1, 1)],
      lookup([farm, well, mill]),
      [],
    );
    // max(1.30, 1.20) = 1.30 → 10 * 1.30 = 13
    expect(result.deltas.grain).toBe(13);
  });

  it('multi-tile bounding box: distance is from nearest cell, not center', () => {
    const farm = defWithAdjacency('farm', [{ resource: 'grain', perDay: 10 }], [
      { partnerDefId: 'shrine', range: 1, resource: 'grain', outputMul: 1.50, description: 't' },
    ], { width: 2, height: 2 });
    // shrine 3×3 at (3,0) — farm 包围盒 (0..1, 0..1)，shrine (3..5, 0..2)，dx=2 > range=1
    // 但若 shrine 紧贴 farm 在 (2,0) — dx=0, dy=0 → distance 0
    const shrine = def('shrine');
    shrine.size = { width: 3, height: 3 };
    const result = computeProductionTick(
      [instAt('farm', 0, 0), instAt('shrine', 2, 0)],
      lookup([farm, shrine]),
      [],
    );
    // Manhattan 距离 = 0 ≤ 1 → 应 apply 1.50 → 15
    expect(result.deltas.grain).toBe(15);
  });
});

// P1 信息可视化：每日出入快照（供需面板数据源）
describe('computeDailyRates — 供需面板口径', () => {
  const noPop = { grain: 0, cloth: 0, bronze: 0, gold: 0 };

  it('产出与人口口粮合并进日耗，净额正确', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 12 }]);
    const rows = computeDailyRates([inst('farm')], lookup([farm]), [], { ...noPop, grain: 8 });
    expect(rows.grain?.produced).toBe(12);
    expect(rows.grain?.consumed).toBe(8);
    expect(rows.grain?.net).toBe(4);
  });

  it('建筑维护计入日耗（布 2 维护 + 人口 1 布）', () => {
    const camp = def('camp', [], { cloth: 2 });
    const rows = computeDailyRates([inst('camp')], lookup([camp]), [], { ...noPop, cloth: 1 });
    expect(rows.cloth?.consumed).toBe(3);
    expect(rows.cloth?.net).toBe(-3);
  });

  it('country 产出/消耗 modifier 同时生效（与生产 tick 同源）', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }], { grain: 2 });
    const mods: ModifierInstance[] = [
      {
        id: 'mo', name: 'mo', category: 'economy', stackable: true,
        effects: [{ target: 'country_grain_output', op: 'mul', value: 1.5 }],
        visualBadge: null, remainingDays: -1, description: '', descPlain: '',
      },
      {
        id: 'mc', name: 'mc', category: 'economy', stackable: true,
        effects: [{ target: 'country_grain_consumption', op: 'mul', value: 2 }],
        visualBadge: null, remainingDays: -1, description: '', descPlain: '',
      },
    ];
    const rows = computeDailyRates([inst('farm')], lookup([farm]), mods, { ...noPop, grain: 1 });
    // produced = 10×1.5 = 15；consumed = 2×2 + 1 = 5；net = 10
    expect(rows.grain?.produced).toBe(15);
    expect(rows.grain?.consumed).toBe(5);
    expect(rows.grain?.net).toBe(10);
  });

  it('产耗双零的资源不出现（噪音过滤）', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    const rows = computeDailyRates([inst('farm')], lookup([farm]), [], noPop);
    expect(rows.grain).toBeDefined();
    expect(rows.gold).toBeUndefined();
  });

  it('相邻加成与阶层折扣同口径（农田贴水井 1.3×）', () => {
    const farm = def('farm', [{ resource: 'grain', perDay: 10 }]);
    farm.adjacencyBonus = [{ partnerDefId: 'well', range: 3, resource: 'grain', outputMul: 1.3, description: 't' }];
    const well = def('well');
    const rows = computeDailyRates(
      [{ ...inst('farm'), position: { x: 0, y: 0 } }, { ...inst('well'), position: { x: 2, y: 0 } }],
      lookup([farm, well]),
      [],
      noPop,
    );
    expect(rows.grain?.produced).toBeCloseTo(13);
  });

  it('formatRate：整数无小数、非整数 1 位小数', () => {
    expect(formatRate(12)).toBe('12');
    expect(formatRate(0.4)).toBe('0.4');
    expect(formatRate(-3)).toBe('-3');
    expect(formatRate(1.25)).toBe('1.3');
  });
});

describe('applyDeltasToBag', () => {
  it('adds positive delta', () => {
    const out = applyDeltasToBag({ grain: 100 }, { grain: 5 });
    expect(out.grain).toBe(105);
  });
  it('adds negative delta', () => {
    const out = applyDeltasToBag({ grain: 100 }, { grain: -5 });
    expect(out.grain).toBe(95);
  });
  it('does not mutate input', () => {
    const bag = { grain: 100 };
    applyDeltasToBag(bag, { grain: 5 });
    expect(bag.grain).toBe(100);
  });
});
