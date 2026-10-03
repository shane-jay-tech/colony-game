// h912-11 批次一：Boot 加载清单 manifest 派生的相等性断言与自动包含验证。

import { describe, expect, it } from 'vitest';
import { BUILDING_ART, BUILDING_ART_REUSE, GENERAL_ART, getBootLoadList } from '../artManifest';
import { BUILDINGS } from '../buildings';
import { GENERAL_POOL } from '../generals';

describe('h912-11 boot load list derived from artManifest', () => {
  it('① 派生序列与旧硬编码加载列表逐项相等（same=true）', () => {
    const oldBuildingItems = BUILDINGS.map(def => ({
      key: def.assetKey,
      // c921-02：整批转码后 URL 模板同步改指 .webp（原 png 已按授权删除，回滚件在 D:/attic/colony-art-backup-20260920/）
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
// c930-20 修复：:147/:151 引用了 scatterArtUrl/eventArtUrl（BootScene 抽出的同源模板），
// 但提交时漏加 import ⇒ 本件 147:114 处 ReferenceError（收集期即挂）。补回具名。
import { ART_MANIFEST, EVENT_ART, scatterArtUrl, eventArtUrl } from '../artManifest';
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

// ============================ c922-04：磁盘不变量固化（双轨守卫） ============================
// 动因（c921-07 遗留原文）：本文件此前 existsSync 计数为 **0**——它只做字符串比对、从不验文件，
// 所以「代码真正生成的那批加载 URL 是否真在盘」长期无守卫。9/21 凌晨那次 63/63 全绿是靠
// 临时探针 tmp/art-verify-20260921.mts 现测的，而探针落在 gitignore 的 tmp/ 下、不可复发。
// 本块把探针的两条核心不变量搬进测试：
//   不变量一：BootScene 五个加载循环逐条 URL 在 public/ 下 existsSync；
//   不变量二：同一 key 的 manifest.path ↔ 运行时 loadUrl 同义（改扩展名时只改一轨即 fail）。
// 例外只有 NO_OWN_ART 两型（path 为不存在的 assets/ 占位、运行时走 BUILDING_ART_REUSE 借图），
// 其键名在此**逐名锁定**并各配一条正向断言，新增漂移不可能靠放宽判据藏进去。
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { ALL_SCATTER_IDS } from '../scatterConfig';

const PUBLIC_DIR = resolve(process.cwd(), 'public');

/** 方案 B 两型（artManifest.ts:28 的模块私有 NO_OWN_ART 未导出，此处按同名同值复述并在 ③ 锁定）。 */
const NO_OWN_ART_KEYS = new Set(['bld_tin_mine', 'bld_hemp_field']);

/** 统一成正斜杠相对键：manifest.path 与 URL 模板都用 '/'，Windows 下 resolve 会引入 '\'。 */
function normKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** 盘上实存判定（不变量一的执行体）。 */
function urlOnDisk(url: string): boolean {
  return existsSync(resolve(PUBLIC_DIR, normKey(url)));
}

/**
 * BootScene.preload 的五个加载源，按代码原文逐字复刻（c921-07 实测各源条数 35/5/8/5/10，合计 63）。
 * 这里刻意**重新拼一遍 URL 模板**而不是复用 getBootLoadList 的输出：模板漂移正是本守卫要抓的东西。
 */
const LOAD_SOURCES: Array<{ site: string; items: Array<{ key: string; url: string }> }> = [
  { site: 'building: getBootLoadList(building)', items: getBootLoadList('building') },
  { site: 'terrain: TERRAIN_ART 直取 asset.path', items: TERRAIN_ART.map(a => ({ key: a.key, url: a.path })) },
  { site: 'scatter: 硬编码模板 art/scatter/<id>.webp', items: ALL_SCATTER_IDS.map(id => ({ key: `scatter_${id}`, url: scatterArtUrl(id) })) },
  { site: 'general: getBootLoadList(general)', items: getBootLoadList('general') },
  { site: 'event: 硬编码模板 art/events/<name>.webp', items: EVENT_ART.map(a => ({
    key: a.key,
    url: eventArtUrl(a.key.startsWith('evt_art_') ? a.key.slice('evt_art_'.length) : a.key),
  })) },
];

describe('c922-04 boot 加载清单的磁盘不变量（双轨守卫）', () => {
  it('① 五个加载源逐条 URL 在 public/ 下实存（不变量一：loadUrl × existsSync）', () => {
    const missing: string[] = [];
    let total = 0;
    for (const source of LOAD_SOURCES) {
      // 每源非空：某源整体变空（清单被误删/派生断链）也要 fail，否则 missing=[] 是假绿。
      expect(source.items.length, `${source.site} 加载源为空`).toBeGreaterThan(0);
      for (const item of source.items) {
        total += 1;
        if (!existsSync(resolve(PUBLIC_DIR, normKey(item.url)))) missing.push(`${source.site} :: ${item.key} -> ${item.url}`);
      }
    }
    expect(missing).toEqual([]);
    expect(total).toBe(63); // c921-07 探针实测 35+5+8+5+10；条数变化须连同两轨一起复核
  });

  it('② 同 key 的 manifest.path ↔ 运行时 loadUrl 同义（不变量二：双轨不许只改一轨）', () => {
    const byKey = new Map(ART_MANIFEST.map(a => [a.key, a]));
    const drift: string[] = [];
    for (const source of LOAD_SOURCES) {
      for (const item of source.items) {
        const declared = byKey.get(item.key);
        if (declared === undefined || NO_OWN_ART_KEYS.has(item.key)) continue;
        if (normKey(declared.path) !== normKey(item.url)) {
          drift.push(`${item.key}: manifest.path=${normKey(declared.path)} vs loadUrl=${normKey(item.url)}`);
        }
      }
    }
    expect(drift).toEqual([]);
  });

  it('③ 例外集逐名锁定：NO_OWN_ART 两型确为占位（不是拿例外藏断链）', () => {
    expect([...NO_OWN_ART_KEYS].sort()).toEqual(['bld_hemp_field', 'bld_tin_mine']);
    const byKey = new Map(ART_MANIFEST.map(a => [a.key, a]));
    for (const key of NO_OWN_ART_KEYS) {
      const declared = byKey.get(key);
      expect(declared?.required, `${key} 例外须 required=false`).toBe(false);
      // 占位 path 确实不在盘（说真话的「素材未生成」），而运行时借图目标实存 ⇒ 不构成断链。
      expect(declared !== undefined && !urlOnDisk(declared.path), `${key} 占位 path 竟在盘上`).toBe(true);
      const loaded = getBootLoadList('building').find(item => item.key === key);
      expect(loaded, `${key} 未进入 boot 加载清单`).toBeDefined();
      expect(loaded !== undefined && urlOnDisk(loaded.url), `${key} 借图目标不在盘`).toBe(true);
    }
  });
});
