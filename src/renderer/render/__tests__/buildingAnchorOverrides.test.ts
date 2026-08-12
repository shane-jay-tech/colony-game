import { describe, it, expect } from 'vitest';
import { getBuildingAnchor, BUILDING_ANCHOR_OVERRIDES } from '../buildingAnchorOverrides';
import { BUILDING_ANCHORS } from '../buildingAnchors.generated';

describe('getBuildingAnchor', () => {
  it('未知 assetKey 回退到 (0.5, 1.0, 1.0)', () => {
    const a = getBuildingAnchor('bld_does_not_exist_xyz');
    expect(a).toEqual({ anchorXFrac: 0.5, anchorYFrac: 1.0, footprintWidthFrac: 1.0 });
  });

  it('已知 assetKey 返回生成的元数据，三字段齐全且在 [0,1.x] 合理区间', () => {
    const keys = Object.keys(BUILDING_ANCHORS);
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) {
      const a = getBuildingAnchor(k);
      expect(Number.isFinite(a.anchorXFrac)).toBe(true);
      expect(Number.isFinite(a.anchorYFrac)).toBe(true);
      expect(a.footprintWidthFrac).toBeGreaterThan(0); // 不为 0 → 渲染缩放不会除零/爆炸
      expect(a.anchorXFrac).toBeGreaterThanOrEqual(0);
      expect(a.anchorXFrac).toBeLessThanOrEqual(1);
      expect(a.anchorYFrac).toBeGreaterThanOrEqual(0);
      expect(a.anchorYFrac).toBeLessThanOrEqual(1);
    }
  });

  it('覆写表按字段浅合并到生成值之上（若存在覆写）', () => {
    const overrideKeys = Object.keys(BUILDING_ANCHOR_OVERRIDES);
    for (const k of overrideKeys) {
      const merged = getBuildingAnchor(k);
      const ov = BUILDING_ANCHOR_OVERRIDES[k];
      if (!ov) continue;
      for (const [field, val] of Object.entries(ov)) {
        expect(merged[field as keyof typeof merged]).toBe(val);
      }
    }
  });

  it('同一 key 多次调用返回稳定结果（memo 不破坏正确性）', () => {
    const a1 = getBuildingAnchor('bld_house');
    const a2 = getBuildingAnchor('bld_house');
    expect(a1).toEqual(a2);
  });
});
