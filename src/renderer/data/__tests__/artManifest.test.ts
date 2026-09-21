import { describe, it, expect } from 'vitest';
// c921-01：path 存在性断言需要 fs（manifest 现在声明的是 public/ 下真实 png）
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ART_MANIFEST, BUILDING_ART, GENERAL_ART, EVENT_ART, TERRAIN_ART,
  getArtByCategory, isArtAvailable,
} from '../artManifest';
import { BUILDINGS } from '../buildings';

const PUBLIC = join(__dirname, '..', '..', '..', '..', 'public');
// c921-01 方案 B：无自有素材的缺图建筑（走 BUILDING_ART_REUSE），保留 .webp 占位、required=false。
const NO_OWN_ART_KEYS = ['bld_hemp_field', 'bld_tin_mine'];

describe('Phase D art manifest', () => {
  it('building art entries = 35 (matches BUILDINGS)', () => {
    expect(BUILDING_ART).toHaveLength(35);
    expect(BUILDING_ART).toHaveLength(BUILDINGS.length);
  });

  it('general portraits = 5', () => {
    expect(GENERAL_ART).toHaveLength(5);
  });

  it('event illustrations = 10', () => {
    expect(EVENT_ART).toHaveLength(10);
  });

  it('UI elements removed (d913c-afbc 三无清理)', () => {
    // UI_ART 已按人工授权删除（manifest 有/boot 不载/全库无消费点）
    expect(ART_MANIFEST.filter((a) => a.category === 'ui')).toHaveLength(0);
  });

  it('terrain types = 5 (c918-04 实存对账)', () => {
    expect(TERRAIN_ART).toHaveLength(5);
  });

  it('total manifest = 55 assets (UI 6 条已删 + 地形 5 型)', () => {
    expect(ART_MANIFEST).toHaveLength(35 + 5 + 10 + 5);
  });

  it('all keys are unique', () => {
    const keys = ART_MANIFEST.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  // c921-01 翻桩：旧断言「非地形一律 .webp」把 public/assets 整体不存在这个缺陷
  // 当成了契约（50 键指向不存在的 webp）。现改为断言 path 指向 public/ 下真实 png。
  it('paths 指向实存 png（c921-01 改指翻桩）；仅待补素材两型保留 .webp 占位', () => {
    for (const a of ART_MANIFEST) {
      if (NO_OWN_ART_KEYS.includes(a.key)) {
        expect(a.path).toBe(`assets/buildings/${a.key}.webp`);
        expect(existsSync(join(PUBLIC, a.path))).toBe(false); // 方案 B：确无素材，不是漏改
      } else {
        // c921-02 翻桩：整批转码后统一 .webp（c921-01 时为 .png；原 png 已按授权删除，回滚件在 D:/attic/colony-art-backup-20260920/）
        expect(a.path.endsWith('.webp')).toBe(true);
        expect(existsSync(join(PUBLIC, a.path))).toBe(true);
      }
    }
  });

  it('getArtByCategory filters correctly', () => {
    expect(getArtByCategory('building')).toHaveLength(35);
    expect(getArtByCategory('terrain')).toHaveLength(5);
  });

  it('isArtAvailable checks loaded set', () => {
    const loaded = new Set(['bld_farm', 'bld_house']);
    expect(isArtAvailable('bld_farm', loaded)).toBe(true);
    expect(isArtAvailable('bld_palace', loaded)).toBe(false);
  });

  // c921-01 翻桩：旧断言「required 全 false（素材尚未制作）」已过期——53 键素材实存。
  // 新契约：required=true ⇔ 该键 path 在 public/ 下实存（禁止 required=true 而文件不存在）。
  it('required = 素材实存（c921-01：53 true / 2 待补）', () => {
    const required = ART_MANIFEST.filter(a => a.required);
    expect(required).toHaveLength(53);
    for (const a of required) {
      expect(existsSync(join(PUBLIC, a.path))).toBe(true);
    }
    expect(ART_MANIFEST.filter(a => !a.required).map(a => a.key).sort()).toEqual(NO_OWN_ART_KEYS);
  });
});
