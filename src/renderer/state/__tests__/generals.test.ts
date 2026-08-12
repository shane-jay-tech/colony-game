import { describe, it, expect } from 'vitest';
import {
  canRecruit, recruitGeneral, dismissGeneral, getAvailableGenerals,
  deployGeneral, returnGeneral, computeGeneralBonus, tickLoyalty,
  applyBattleResult, getCapturedGeneralTraits,
} from '../generalSystem';
import type { GeneralState } from '../../data/generals';
import { MAX_GENERALS, LOYALTY_DEFECT_THRESHOLD } from '../../data/generals';
import { createRng } from '../rng';

function makeGenerals(count: number): GeneralState[] {
  const ids = ['gen_pei_shao', 'gen_hu_ben', 'gen_xie_changqing', 'gen_tian_zhong'];
  return ids.slice(0, count).map(id => ({ id, loyalty: 80, deployed: false }));
}

describe('B-2 general recruitment', () => {
  it('canRecruit returns true when below MAX_GENERALS', () => {
    expect(canRecruit(makeGenerals(3))).toBe(true);
    expect(canRecruit(makeGenerals(4))).toBe(false);
  });

  it('recruitGeneral adds a new general', () => {
    const before = makeGenerals(1);
    const after = recruitGeneral('gen_hu_ben', [...before]);
    expect(after).toHaveLength(2);
    expect(after[1]!.id).toBe('gen_hu_ben');
    expect(after[1]!.loyalty).toBe(80);
  });

  it('recruitGeneral rejects duplicate', () => {
    const before = makeGenerals(1);
    const after = recruitGeneral('gen_pei_shao', [...before]);
    expect(after).toHaveLength(1);
  });

  it('recruitGeneral rejects when at MAX_GENERALS', () => {
    const full = makeGenerals(MAX_GENERALS);
    const after = recruitGeneral('gen_barbarian', [...full]);
    expect(after).toHaveLength(MAX_GENERALS);
  });

  it('dismissGeneral removes by id', () => {
    const gens = makeGenerals(3);
    const after = dismissGeneral('gen_hu_ben', gens);
    expect(after).toHaveLength(2);
    expect(after.find(g => g.id === 'gen_hu_ben')).toBeUndefined();
  });
});

describe('B-2 general deployment', () => {
  it('getAvailableGenerals excludes deployed', () => {
    const gens: GeneralState[] = [
      { id: 'gen_pei_shao', loyalty: 80, deployed: true },
      { id: 'gen_hu_ben', loyalty: 70, deployed: false },
    ];
    const available = getAvailableGenerals(gens);
    expect(available).toHaveLength(1);
    expect(available[0]!.id).toBe('gen_hu_ben');
  });

  it('deployGeneral marks as deployed', () => {
    const gens = makeGenerals(2);
    const after = deployGeneral('gen_pei_shao', gens);
    expect(after.find(g => g.id === 'gen_pei_shao')?.deployed).toBe(true);
    expect(after.find(g => g.id === 'gen_hu_ben')?.deployed).toBe(false);
  });

  it('returnGeneral marks as not deployed', () => {
    const gens: GeneralState[] = [{ id: 'gen_pei_shao', loyalty: 80, deployed: true }];
    const after = returnGeneral('gen_pei_shao', gens);
    expect(after[0]!.deployed).toBe(false);
  });
});

describe('B-2 general combat bonus', () => {
  it('裴绍: attack +20%, inspire morale floor 50', () => {
    const bonus = computeGeneralBonus('gen_pei_shao');
    expect(bonus.attackMul).toBeCloseTo(1.2);
    expect(bonus.defenseMul).toBe(1);
    expect(bonus.moraleFloor).toBe(50);
    expect(bonus.command).toBe(15);
  });

  it('虎贲子: attack +20%, ambush', () => {
    const bonus = computeGeneralBonus('gen_hu_ben');
    expect(bonus.attackMul).toBeCloseTo(1.2);
    expect(bonus.hasAmbush).toBe(true);
    expect(bonus.command).toBe(20);
  });

  it('谢长卿: defense +20%, grain -30%', () => {
    const bonus = computeGeneralBonus('gen_xie_changqing');
    expect(bonus.defenseMul).toBeCloseTo(1.2);
    expect(bonus.grainMul).toBeCloseTo(0.7);
  });

  it('田仲: inspire + frugal', () => {
    const bonus = computeGeneralBonus('gen_tian_zhong');
    expect(bonus.moraleFloor).toBe(50);
    expect(bonus.grainMul).toBeCloseTo(0.7);
    expect(bonus.command).toBe(10);
  });

  it('unknown general returns neutral bonus', () => {
    const bonus = computeGeneralBonus('nonexistent');
    expect(bonus.attackMul).toBe(1);
    expect(bonus.command).toBe(0);
  });
});

describe('B-2 loyalty and defection', () => {
  it('tickLoyalty decreases loyalty by DECAY each month', () => {
    const gens: GeneralState[] = [{ id: 'gen_pei_shao', loyalty: 80, deployed: false }];
    const rng = createRng(1);
    const { generals } = tickLoyalty(gens, rng);
    expect(generals[0]!.loyalty).toBe(78); // 80 - 2
  });

  it('defection triggers when loyalty < threshold and rng rolls', () => {
    const gens: GeneralState[] = [{ id: 'gen_pei_shao', loyalty: 5, deployed: false }];
    // Find a seed that causes defection
    let defected = false;
    for (let seed = 0; seed < 200 && !defected; seed++) {
      const rng = createRng(seed);
      const result = tickLoyalty([{ ...gens[0]! }], rng);
      if (result.defected.length > 0) defected = true;
    }
    expect(defected).toBe(true);
  });

  it('applyBattleResult increases loyalty on win', () => {
    const gens: GeneralState[] = [{ id: 'gen_pei_shao', loyalty: 60, deployed: true }];
    const after = applyBattleResult(gens, 'gen_pei_shao', true);
    expect(after[0]!.loyalty).toBe(65); // +5
  });

  it('applyBattleResult decreases loyalty on loss', () => {
    const gens: GeneralState[] = [{ id: 'gen_pei_shao', loyalty: 60, deployed: true }];
    const after = applyBattleResult(gens, 'gen_pei_shao', false);
    expect(after[0]!.loyalty).toBe(50); // -10
  });

  it('loyalty clamps to [0, 100]', () => {
    const gens: GeneralState[] = [{ id: 'gen_pei_shao', loyalty: 98, deployed: true }];
    const after = applyBattleResult(gens, 'gen_pei_shao', true);
    expect(after[0]!.loyalty).toBe(100);
  });
});

describe('B-2 captured general traits', () => {
  it('getCapturedGeneralTraits returns 1-2 random traits', () => {
    const rng = createRng(42);
    const traits = getCapturedGeneralTraits(rng);
    expect(traits.length).toBeGreaterThanOrEqual(1);
    expect(traits.length).toBeLessThanOrEqual(2);
    // No duplicates
    expect(new Set(traits).size).toBe(traits.length);
  });
});
