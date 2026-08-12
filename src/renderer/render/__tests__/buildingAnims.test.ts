import { describe, it, expect } from 'vitest';
import {
  SMOKE_BUILDING_IDS,
  MARKET_BUILDING_IDS,
  FARM_BUILDING_IDS,
  FARM_SEASON_TINTS,
} from '../buildingAnims';

describe('buildingAnims config', () => {
  it('smoke buildings include smithy and iron forge', () => {
    expect(SMOKE_BUILDING_IDS.has('bld_smithy')).toBe(true);
    expect(SMOKE_BUILDING_IDS.has('bld_iron_forge')).toBe(true);
    expect(SMOKE_BUILDING_IDS.has('bld_farm')).toBe(false);
  });

  it('market buildings include market', () => {
    expect(MARKET_BUILDING_IDS.has('bld_market')).toBe(true);
    expect(MARKET_BUILDING_IDS.has('bld_smithy')).toBe(false);
  });

  it('farm buildings include farm', () => {
    expect(FARM_BUILDING_IDS.has('bld_farm')).toBe(true);
    expect(FARM_BUILDING_IDS.has('bld_market')).toBe(false);
  });

  it('farm season tints has all 4 seasons with distinct values', () => {
    const values = new Set(Object.values(FARM_SEASON_TINTS));
    expect(values.size).toBe(4);
    for (const s of [0, 1, 2, 3] as const) {
      expect(typeof FARM_SEASON_TINTS[s]).toBe('number');
      expect(FARM_SEASON_TINTS[s]).toBeGreaterThan(0);
    }
  });
});
