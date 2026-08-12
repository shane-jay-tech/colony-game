import { describe, it, expect } from 'vitest';
import { computePopulationGrowth, sumHousingCapacity, type PopulationConfig } from '../population';
import type { BuildingDef, BuildingInstance } from '../../data/schema';

const CFG: PopulationConfig = { growthRatePerDay: 0.004, minDailyGrowth: 0.05 };

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
  it('缺粮 → 不在此流失（reason=idle；减员已移交 applyStarvation，避免双重扣减）', () => {
    // 2026-06-17 ID-2 修复：computePopulationGrowth 缺粮时只判 idle、不再负流失。
    const r = computePopulationGrowth({ people: 100, housingCap: 200, grainStock: 0, carry: 0 }, CFG);
    expect(r.reason).toBe('idle');
    expect(r.peopleDelta).toBe(0);
    expect(r.rawNet).toBe(0);
  });
  it('缺粮但人口为 0 → idle，无变化', () => {
    const r = computePopulationGrowth({ people: 0, housingCap: 50, grainStock: 0, carry: 0 }, CFG);
    expect(r.reason).toBe('idle');
    expect(r.peopleDelta).toBe(0);
  });
});

describe('computePopulationGrowth — BUG-A 超住房上限温和回落', () => {
  // 用带回落旋钮的 cfg（rate 0.02、单日封顶 2）
  const OCFG: PopulationConfig = { growthRatePerDay: 0.02, minDailyGrowth: 1.2, homelessDeclineRate: 0.02, homelessDeclineMax: 2 };

  it('超上限且有余粮 → 负增长（reason=overflow），按 ceil(overflow×rate) 且封顶 2', () => {
    // 187/175：overflow=12，ceil(12×0.02)=ceil(0.24)=1 → 回落 1（未触顶）
    const r = computePopulationGrowth({ people: 187, housingCap: 175, grainStock: 999, carry: 0, minimumPopulation: 5 }, OCFG);
    expect(r.reason).toBe('overflow');
    expect(r.peopleDelta).toBe(-1);
    expect(r.rawNet).toBe(-1);
    expect(r.carry).toBe(0);
  });

  it('严重超上限 → 单日回落被 homelessDeclineMax 封顶（防雪崩）', () => {
    // overflow=300，ceil(300×0.02)=6，但封顶 2 → 回落 2
    const r = computePopulationGrowth({ people: 475, housingCap: 175, grainStock: 999, carry: 0, minimumPopulation: 5 }, OCFG);
    expect(r.reason).toBe('overflow');
    expect(r.peopleDelta).toBe(-2);
  });

  it('缺粮时超上限不回落（让位 applyStarvation，防双扣）→ idle', () => {
    const r = computePopulationGrowth({ people: 187, housingCap: 175, grainStock: 0, carry: 0, minimumPopulation: 5 }, OCFG);
    expect(r.reason).toBe('idle');
    expect(r.peopleDelta).toBe(0);
  });

  it('超上限但存粮不足以喂饱当前人口 → 不回落（reason=cap，让位饥荒，防 DOUBLE-PENALTY 双扣）', () => {
    // 存粮 10 < 当日口粮 20：虽有粮(>0)但不够喂，超限回落让位 applyStarvation，本函数不减员
    const r = computePopulationGrowth(
      { people: 187, housingCap: 175, grainStock: 10, carry: 0, minimumPopulation: 5, dailyConsumption: 20 },
      OCFG,
    );
    expect(r.reason).toBe('cap');
    expect(r.peopleDelta).toBe(0);
  });

  it('超上限且存粮够喂当前人口 → 正常温和回落（真余粮才回落）', () => {
    const r = computePopulationGrowth(
      { people: 187, housingCap: 175, grainStock: 100, carry: 0, minimumPopulation: 5, dailyConsumption: 20 },
      OCFG,
    );
    expect(r.reason).toBe('overflow');
    expect(r.peopleDelta).toBe(-1);
  });

  it('回落不跌破最小人口', () => {
    // people=6, cap=0, minPop=5 → maxDecline=1 → 只回落 1（不到封顶 2）
    const r = computePopulationGrowth({ people: 6, housingCap: 0, grainStock: 999, carry: 0, minimumPopulation: 5 }, OCFG);
    expect(r.peopleDelta).toBe(-1);
    // people==minPop 时不再回落
    const r2 = computePopulationGrowth({ people: 5, housingCap: 0, grainStock: 999, carry: 0, minimumPopulation: 5 }, OCFG);
    expect(r2.peopleDelta).toBe(0);
    expect(r2.reason).toBe('cap');
  });

  it('恰满上限（people==cap）→ 不增不减（reason=cap）', () => {
    const r = computePopulationGrowth({ people: 175, housingCap: 175, grainStock: 999, carry: 0, minimumPopulation: 5 }, OCFG);
    expect(r.reason).toBe('cap');
    expect(r.peopleDelta).toBe(0);
  });

  it('多 tick 从超限收敛回上限、且停在上限不破（187→175）', () => {
    let people = 187;
    let carry = 0;
    for (let i = 0; i < 50 && people > 175; i++) {
      const r = computePopulationGrowth({ people, housingCap: 175, grainStock: 999, carry, minimumPopulation: 5 }, OCFG);
      people += r.peopleDelta;
      carry = r.carry;
    }
    expect(people).toBe(175); // 精确收敛到上限，不过冲
  });

  it('默认 cfg（无回落旋钮）仍用内置默认 0.02/2 回落', () => {
    const r = computePopulationGrowth({ people: 187, housingCap: 175, grainStock: 999, carry: 0, minimumPopulation: 5 }, CFG);
    expect(r.reason).toBe('overflow');
    expect(r.peopleDelta).toBe(-1);
  });
});
