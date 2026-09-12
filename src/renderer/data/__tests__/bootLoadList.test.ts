// h912-11 批次一：Boot 加载清单 manifest 派生的相等性断言与自动包含验证。

import { describe, expect, it } from 'vitest';
import { BUILDING_ART, GENERAL_ART, getBootLoadList } from '../artManifest';
import { BUILDINGS } from '../buildings';
import { GENERAL_POOL } from '../generals';

describe('h912-11 boot load list derived from artManifest', () => {
  it('① 派生序列与旧硬编码加载列表逐项相等（same=true）', () => {
    const oldBuildingItems = BUILDINGS.map(def => ({
      key: def.assetKey,
      url: `art/buildings/${def.id}.png`,
    }));
    const oldGeneralItems = GENERAL_POOL.map(g => ({
      key: `portrait_${g.id}`,
      url: `art/generals/${g.id}.png`,
    }));

    const newBuildingItems = getBootLoadList('building');
    const newGeneralItems = getBootLoadList('general');

    expect(newBuildingItems).toEqual(oldBuildingItems);
    expect(newGeneralItems).toEqual(oldGeneralItems);
    // 离线逐字 diff：same=true
    expect(JSON.stringify(newBuildingItems)).toBe(JSON.stringify(oldBuildingItems));
    expect(JSON.stringify(newGeneralItems)).toBe(JSON.stringify(oldGeneralItems));
  });

  it('② manifest 增一项后派生加载列表自动包含该项', () => {
    const probe = {
      key: 'portrait_h912_probe',
      path: 'assets/generals/h912_probe.webp',
      category: 'general' as const,
      required: false,
    };
    GENERAL_ART.push(probe);
    try {
      const list = getBootLoadList('general');
      expect(list.some(item => item.key === 'portrait_h912_probe')).toBe(true);
      expect(list[list.length - 1]).toEqual({
        key: 'portrait_h912_probe',
        url: 'art/generals/h912_probe.png',
      });
    } finally {
      const idx = GENERAL_ART.indexOf(probe);
      if (idx >= 0) GENERAL_ART.splice(idx, 1);
    }
  });
});
