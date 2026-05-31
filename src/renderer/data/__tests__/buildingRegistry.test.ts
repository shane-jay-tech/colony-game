import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../buildings';
import { BUILDING_REGISTRY, getBuildingDef, validateBuildingDef } from '../buildingRegistry';
import type { BuildingDef } from '../schema';

function baseDef(overrides: Partial<BuildingDef> = {}): BuildingDef {
  return {
    id: 'bld_test', name: 'Test', category: '民生', tier: 1, cost: {}, constructionTime: 1,
    output: [], upkeep: {}, size: { width: 1, height: 1 },
    assetKey: 'bld_test', upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
    ...overrides,
  };
}

describe('buildingRegistry', () => {
  it('contains one entry per building def', () => {
    expect(BUILDING_REGISTRY.size).toBe(BUILDINGS.length);
  });

  it('returns the farm def by id', () => {
    const def = getBuildingDef('bld_farm');
    expect(def).toBeDefined();
    expect(def?.id).toBe('bld_farm');
  });

  it('returns undefined for unknown id', () => {
    expect(getBuildingDef('nope')).toBeUndefined();
  });

  // J-3 v0.8：从 12 扩到 20（+8 新建筑：烽燧/驿道/水碓/冶铁坊/桑园/石碑场/学塾/客馆）
  it('all 20 buildings registered with unique ids (v0.8 J-3 扩 +8)', () => {
    expect(BUILDING_REGISTRY.size).toBe(20);
    const ids = new Set(BUILDINGS.map(b => b.id));
    expect(ids.size).toBe(BUILDINGS.length);
  });
});

describe('validateBuildingDef', () => {
  it('accepts a clean def', () => {
    expect(() => validateBuildingDef(baseDef())).not.toThrow();
  });

  it('rejects zero width', () => {
    expect(() => validateBuildingDef(baseDef({ size: { width: 0, height: 1 } }))).toThrow(/non-positive size/);
  });

  it('rejects negative height', () => {
    expect(() => validateBuildingDef(baseDef({ size: { width: 2, height: -1 } }))).toThrow(/non-positive size/);
  });

  it('rejects negative constructionTime', () => {
    expect(() => validateBuildingDef(baseDef({ constructionTime: -5 }))).toThrow(/negative constructionTime/);
  });

  it('rejects negative cost entry', () => {
    expect(() => validateBuildingDef(baseDef({ cost: { wood: -10 } }))).toThrow(/negative cost for wood/);
  });

  it('rejects negative upkeep entry', () => {
    expect(() => validateBuildingDef(baseDef({ upkeep: { grain: -1 } }))).toThrow(/negative upkeep for grain/);
  });

  it('all shipped BUILDINGS pass validation', () => {
    for (const b of BUILDINGS) {
      expect(() => validateBuildingDef(b)).not.toThrow();
    }
  });
});
