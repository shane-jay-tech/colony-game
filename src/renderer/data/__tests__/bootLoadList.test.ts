// h912-11 批次一：Boot 加载清单 manifest 派生的相等性断言与自动包含验证。

import { describe, expect, it } from 'vitest';
import { BUILDING_ART, BUILDING_ART_REUSE, GENERAL_ART, getBootLoadList } from '../artManifest';
import { BUILDINGS } from '../buildings';
import { GENERAL_POOL } from '../generals';

describe('h912-11 boot load list derived from artManifest', () => {
  it('① 派生序列与旧硬编码加载列表逐项相等（same=true）', () => {
    const oldBuildingItems = BUILDINGS.map(def => ({
      key: def.assetKey,
      // c921-02：整批转码后 URL 模板同步改指 .webp（原 png 已按授权删除，回滚件在 tmp/assets-backup-20260920/）
    url: `art/buildings/${BUILDING_ART_REUSE[def.id] ?? def.id}.webp`,
    }));
    const oldGeneralItems = GENERAL_POOL.map(g => ({
      key: `portrait_${g.id}`,
      url: `art/generals/${g.id}.webp`,
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
        url: 'art/generals/h912_probe.webp',
      });
    } finally {
      const idx = GENERAL_ART.indexOf(probe);
      if (idx >= 0) GENERAL_ART.splice(idx, 1);
    }
  });
});

// a-46：地形清单派生断言——TERRAIN_ART 键名与 TERRAIN_KINDS 命名统一（hills 复数），条目数不扩。
import { TERRAIN_ART } from '../artManifest';
import { TERRAIN_KINDS } from '../mapSchema';

describe('a46 terrain naming consistency', () => {
  it('TERRAIN_ART 键名 = terrain_<kind>（与 TERRAIN_KINDS 同名，无 hill 单数残留）', () => {
    expect(TERRAIN_ART.length).toBe(5); // c918-04：补齐 5 型（与 TERRAIN_KINDS 对齐）
    for (const art of TERRAIN_ART) {
      const kind = art.key.replace(/^terrain_/, '');
      expect(TERRAIN_KINDS).toContain(kind);
      expect(kind).not.toBe('hill'); // 禁止 hills/hill 单复数残留
      expect(kind).not.toBe('water'); // 水系规范名=river（与 TERRAIN_KINDS 一致）
    }
  });
});

// c-18：清单等价断言补测——四类 category（building/general/event/ui）与 ART_MANIFEST 的派生一致性。
import { ART_MANIFEST, EVENT_ART } from '../artManifest';
import { EVENTS } from '../../data/events';

describe('c18 manifest equivalence', () => {
  it('① ART_MANIFEST 并集=各类之和（无幽灵条目）', () => {
    expect(ART_MANIFEST.length).toBe(
      BUILDING_ART.length + GENERAL_ART.length + EVENT_ART.length + TERRAIN_ART.length
    );
  });

  it('② key 全局唯一（manifest 与派生 url 生成不冲突）', () => {
    const keys = ART_MANIFEST.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // c921-01 翻桩：旧断言要求非地形 path 匹配 assets/<category>s?/——而该目录整体不存在
  // （55 键里 50 键指向它）。现统一为实存 art/<category>s?/ 口径，仅方案 B 两型例外。
  it('③ path 命名与 category 目录约定一致（c921-01 翻桩：实存 art/<category>s?/）', () => {
    const PENDING = new Set(['bld_tin_mine', 'bld_hemp_field']);
    for (const a of ART_MANIFEST) {
      if (PENDING.has(a.key)) {
        expect(a.path).toBe(`assets/buildings/${a.key}.webp`); // 方案 B：无自有素材，保留占位
        expect(a.required).toBe(false);
      } else {
        expect(a.path).toMatch(new RegExp(`^art/${a.category}s?/`));
      }
    }
  });

  it('④ 源实体 ↔ manifest 全覆盖：BUILDINGS/GENERAL_POOL 逐 id 有 art 条目（事件画为通用池，仅断言唯一非空）', () => {
    for (const b of BUILDINGS) {
      expect(BUILDING_ART.some(a => a.key === b.assetKey)).toBe(true);
    }
    for (const g of GENERAL_POOL) {
      expect(GENERAL_ART.some(a => a.key === `portrait_${g.id}`)).toBe(true);
    }
    // 事件画为通用插画池（非逐事件 1:1 映射）——只断言池唯一且非空
    const evtKeys = EVENT_ART.map(a => a.key);
    expect(evtKeys.length).toBeGreaterThan(0);
    expect(new Set(evtKeys).size).toBe(evtKeys.length);
  });
});
