import { describe, it, expect } from 'vitest';
import { meetsThreshold, meetsSignature, evaluateGrade, type GradeInput } from '../countryGrade';
import { COUNTRY_GRADES, MAX_GRADE } from '../../data/countryGrades';

/** 造一个满足 level1（城邑：pop≥30 & gold≥80 & 建成 bld_market）的输入。 */
function level1Input(over: Partial<GradeInput> = {}): GradeInput {
  return {
    population: 30,
    resources: { gold: 80 },
    builtDefIds: new Set(['bld_market']),
    adoptedPolicyIds: new Set<string>(),
    completedDecreeIds: new Set<string>(),
    diplomacyFlags: new Set<string>(),
    ...over,
  };
}

describe('meetsThreshold', () => {
  it('人口或资源不足 → false', () => {
    const t = { population: 30, gold: 80 };
    expect(meetsThreshold(t, level1Input({ population: 29 }))).toBe(false);
    expect(meetsThreshold(t, level1Input({ resources: { gold: 79 } }))).toBe(false);
  });
  it('都达标 → true；未列出的资源项不要求', () => {
    const t = { population: 30, gold: 80 }; // 不要求 cloth
    expect(meetsThreshold(t, level1Input({ resources: { gold: 100 } }))).toBe(true);
  });
});

describe('meetsSignature', () => {
  it('null → 视为满足', () => {
    expect(meetsSignature(null, level1Input())).toBe(true);
  });
  it('四种 kind 命中 / 未命中', () => {
    const base = level1Input();
    expect(meetsSignature({ kind: 'building', id: 'bld_market', label: '' }, base)).toBe(true);
    expect(meetsSignature({ kind: 'building', id: 'bld_palace', label: '' }, base)).toBe(false);
    expect(meetsSignature({ kind: 'policy', id: 'pol_x', label: '' },
      level1Input({ adoptedPolicyIds: new Set(['pol_x']) }))).toBe(true);
    expect(meetsSignature({ kind: 'policy', id: 'pol_x', label: '' }, base)).toBe(false);
    expect(meetsSignature({ kind: 'decree', id: 'decree_x', label: '' },
      level1Input({ completedDecreeIds: new Set(['decree_x']) }))).toBe(true);
    expect(meetsSignature({ kind: 'decree', id: 'decree_x', label: '' }, base)).toBe(false);
    expect(meetsSignature({ kind: 'diplomacy', id: 'all_npc_friendly', label: '' },
      level1Input({ diplomacyFlags: new Set(['all_npc_friendly']) }))).toBe(true);
    expect(meetsSignature({ kind: 'diplomacy', id: 'all_npc_friendly', label: '' }, base)).toBe(false);
  });
});

describe('evaluateGrade', () => {
  it('门槛达标但标志成就缺 → 不升（验 AND 语义）', () => {
    const noMarket = level1Input({ builtDefIds: new Set<string>() });
    expect(evaluateGrade(0, noMarket)).toBe(0);
  });
  it('门槛 + 标志都满足 → 升 1 级', () => {
    expect(evaluateGrade(0, level1Input())).toBe(1);
  });
  it('即使资源极高也一次只升 1 级（不连跳）', () => {
    const huge = level1Input({
      population: 99999,
      resources: { gold: 99999, cloth: 99999, rite: 99999, bronze: 99999 },
      builtDefIds: new Set(['bld_market', 'bld_ancestor_shrine', 'bld_palace']),
      completedDecreeIds: new Set(['decree_hegemony', 'decree_cast_ding']),
    });
    expect(evaluateGrade(0, huge)).toBe(1); // 0→1 only
    expect(evaluateGrade(1, huge)).toBe(2); // 1→2 only
  });
  it('不降级：输入啥都不满足时维持当前级', () => {
    const empty = level1Input({ population: 0, resources: {}, builtDefIds: new Set<string>() });
    expect(evaluateGrade(3, empty)).toBe(3);
  });
  it('已是最高级 → 维持 MAX_GRADE，不越界', () => {
    expect(evaluateGrade(MAX_GRADE, level1Input())).toBe(MAX_GRADE);
  });
  it('表里确有 6 级（0..5）', () => {
    expect(COUNTRY_GRADES).toHaveLength(6);
    expect(MAX_GRADE).toBe(5);
  });
});
