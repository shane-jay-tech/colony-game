import { describe, it, expect } from 'vitest';
import { computePopulationGrowth, sumHousingCapacity, type PopulationConfig } from '../population';
import type { BuildingDef, BuildingInstance } from '../../data/schema';

const CFG: PopulationConfig = { growthRatePerDay: 0.004, minDailyGrowth: 0.05, starveRatePerDay: 0.01 };

function inst(defId: string, status: BuildingInstance['status'] = 'working'): BuildingInstance {
  return { defId, position: { x: 0, y: 0 }, status, tier: 1, constructionProgress: 100, modifiers: [] };
}
function def(id: string, housingCapacity?: number): BuildingDef {
  return {
    id, name: id, category: '民生', tier: 1, cost: {}, constructionTime: 1,
    output: [], upkeep: {}, size: { width: 1, height: 1 }, assetKey: id,
    upgradeRequires: [], badgeRules: [], description: '', descPlain: '', housingCapacity,
  };
}

describe('sumHousingCapacity', () => {
  const lookup = (id: string): BuildingDef | undefined =>
    ({ bld_house: def('bld_house', 10), bld_palace: def('bld_palace', 30), bld_farm: def('bld_farm') }[id]);
  it('累加 working 居住建筑容量，跳过无 housingCapacity 与非 working', () => {
    const bs = [inst('bld_house'), inst('bld_palace'), inst('bld_farm'), inst('bld_house', 'constructing')];
    expect(sumHousingCapacity(bs, lookup)).toBe(40); // 10 + 30（farm 无、在建 house 不计）
  });
  it('空列表 → 0', () => {
    expect(sumHousingCapacity([], lookup)).toBe(0);
  });
});

describe('computePopulationGrowth', () => {
  it('有余粮且未满 cap → 正增长（按 people 复利，下限保底）', () => {
    // people=20: 20×0.004=0.08 < minDaily 0.05? 否，0.08>0.05 → desired 0.08
    const r = computePopulationGrowth({ people: 20, housingCap: 100, grainStock: 50, carry: 0 }, CFG);
    expect(r.reason).toBe('grow');
    expect(r.peopleDelta).toBe(0); // 0.08 取整为 0
    expect(r.carry).toBeCloseTo(0.08, 5);
  });
  it('残差累积跨多 tick 攒成 +1', () => {
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const r = computePopulationGrowth({ people: 20, housingCap: 100, grainStock: 50, carry }, CFG);
      carry = r.carry;
      total += r.peopleDelta;
    }
    expect(total).toBeGreaterThanOrEqual(1); // 20×0.08=1.6 → 至少 +1
  });
  it('人口很少时用 minDailyGrowth 下限', () => {
    // people=5: 5×0.004=0.02 < 0.05 → desired 0.05
    const r = computePopulationGrowth({ people: 5, housingCap: 100, grainStock: 50, carry: 0 }, CFG);
    expect(r.carry).toBeCloseTo(0.05, 5);
  });
  it('达住房上限 → 不增（reason=cap）', () => {
    const r = computePopulationGrowth({ people: 100, housingCap: 100, grainStock: 50, carry: 0 }, CFG);
    expect(r.reason).toBe('cap');
    expect(r.peopleDelta).toBe(0);
  });
  it('增长被 cap 余量截断', () => {
    // people=99, cap=100 → room=1；desired=max(0.396,0.05)=0.396 → min(0.396,1)=0.396
    const r = computePopulationGrowth({ people: 99, housingCap: 100, grainStock: 50, carry: 0.7 }, CFG);
    expect(r.reason).toBe('grow');
    expect(r.peopleDelta).toBe(1); // 0.396+0.7=1.096 → +1
  });
  it('缺粮 → 饥荒流失（reason=starve, 负增量）', () => {
    // people=100, grain=0 → -100×0.01=-1.0
    const r = computePopulationGrowth({ people: 100, housingCap: 200, grainStock: 0, carry: 0 }, CFG);
    expect(r.reason).toBe('starve');
    expect(r.peopleDelta).toBe(-1);
  });
  it('缺粮但人口为 0 → idle，无变化', () => {
    const r = computePopulationGrowth({ people: 0, housingCap: 50, grainStock: 0, carry: 0 }, CFG);
    expect(r.reason).toBe('idle');
    expect(r.peopleDelta).toBe(0);
  });
});
