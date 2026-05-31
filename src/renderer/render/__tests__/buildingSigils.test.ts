/**
 * 建筑沙印映射测试。
 * 完整性兜底：任何新加的 BuildingDef 没配 sigil → 测试红，强制开发者补字。
 */
import { describe, it, expect } from 'vitest';
import { BUILDINGS } from '../../data/buildings';
import { BUILDING_SIGIL, getBuildingSigil, findUnconfiguredSigils } from '../buildingSigils';

describe('buildingSigils', () => {
  it('every BuildingDef has a sigil configured', () => {
    const missing = findUnconfiguredSigils();
    expect(missing).toEqual([]);
  });

  it('all sigils are exactly one Chinese character', () => {
    for (const [id, sigil] of Object.entries(BUILDING_SIGIL)) {
      // 单字 + 在 CJK 统一汉字范围内
      expect(sigil.length, `${id} sigil "${sigil}" must be 1 char`).toBe(1);
      const code = sigil.charCodeAt(0);
      expect(
        code >= 0x4e00 && code <= 0x9fff,
        `${id} sigil "${sigil}" not in CJK Unified range`,
      ).toBe(true);
    }
  });

  it('getBuildingSigil returns explicit mapping when configured', () => {
    expect(getBuildingSigil('bld_farm')).toBe('田');
    expect(getBuildingSigil('bld_palace')).toBe('宫');
  });

  it('getBuildingSigil falls back to first char of name when unmapped', () => {
    expect(getBuildingSigil('bld_unknown_future', '某楼')).toBe('某');
  });

  it('getBuildingSigil returns "？" when no fallback name available', () => {
    expect(getBuildingSigil('bld_unknown_future')).toBe('？');
    expect(getBuildingSigil('bld_unknown_future', '')).toBe('？');
  });

  it('no two sigils collide (every building visually distinct)', () => {
    const seen = new Set<string>();
    for (const sigil of Object.values(BUILDING_SIGIL)) {
      expect(seen.has(sigil), `duplicate sigil "${sigil}"`).toBe(false);
      seen.add(sigil);
    }
  });

  it('sigil count matches BUILDINGS count', () => {
    expect(Object.keys(BUILDING_SIGIL).length).toBe(BUILDINGS.length);
  });
});
