/**
 * Phase D 美术资产清单。
 * 定义所有需要的美术资源（建筑/将领/事件/UI/地形），
 * BootScene 按此清单预加载；未就绪的资源 fallback 到沙印/色块。
 *
 * 资产文件约定：
 *   - 建筑：assets/buildings/{id}.webp (256×256 等距)
 *   - 将领：assets/generals/{id}.webp (512×768 半身)
 *   - 事件：assets/events/{id}.webp (800×450 场景)
 *   - UI：assets/ui/{name}.webp
 *   - 地形：assets/terrain/{type}.webp (tileable 128×128)
 */

export interface ArtAssetDef {
  key: string;
  path: string;
  category: 'building' | 'general' | 'event' | 'ui' | 'terrain';
  required: boolean;
}

// ====================== Buildings (35) =====================================

export const BUILDING_ART: ArtAssetDef[] = [
  // h912-11：条目顺序与 data/buildings.ts 权威序对齐（原 hemp_field/tin_mine 排在末尾，
  // 与数据表顺序不一致会导致派生加载序漂移；仅调序，条目内容零改动）
  'bld_farm', 'bld_well', 'bld_house', 'bld_market', 'bld_woodcutter',
  'bld_quarry', 'bld_tin_mine', 'bld_pottery_kiln', 'bld_loom_house', 'bld_smithy',
  'bld_ancestor_shrine', 'bld_barracks', 'bld_academy', 'bld_palace', 'bld_beacon_tower',
  'bld_post_road', 'bld_water_mill', 'bld_iron_forge', 'bld_mulberry_grove', 'bld_hemp_field',
  'bld_stele_yard', 'bld_village_school', 'bld_envoy_lodge',
  'bld_training_ground', 'bld_stable', 'bld_chariot_works', 'bld_city_wall',
  'bld_imperial_guard', 'bld_granary', 'bld_watchtower', 'bld_censor',
  'bld_grand_temple', 'bld_observatory', 'bld_relay_station', 'bld_nine_cauldrons',
].map(id => ({
  key: id,
  path: `assets/buildings/${id}.webp`,
  category: 'building' as const,
  required: false,
}));

// ====================== Generals (5) =======================================

export const GENERAL_ART: ArtAssetDef[] = [
  'gen_pei_shao', 'gen_hu_ben', 'gen_xie_changqing', 'gen_tian_zhong', 'gen_barbarian',
].map(id => ({
  key: `portrait_${id}`,
  path: `assets/generals/${id}.webp`,
  category: 'general' as const,
  required: false,
}));

// ====================== Event illustrations (10 core scenes) ===============

export const EVENT_ART: ArtAssetDef[] = [
  { key: 'evt_art_unification', path: 'assets/events/unification.webp', category: 'event', required: false },
  { key: 'evt_art_coronation', path: 'assets/events/coronation.webp', category: 'event', required: false },
  { key: 'evt_art_battle', path: 'assets/events/battle.webp', category: 'event', required: false },
  { key: 'evt_art_flood', path: 'assets/events/flood.webp', category: 'event', required: false },
  { key: 'evt_art_feast', path: 'assets/events/feast.webp', category: 'event', required: false },
  { key: 'evt_art_diplomacy', path: 'assets/events/diplomacy.webp', category: 'event', required: false },
  { key: 'evt_art_rebellion', path: 'assets/events/rebellion.webp', category: 'event', required: false },
  { key: 'evt_art_ending_gong', path: 'assets/events/ending_gong.webp', category: 'event', required: false },
  { key: 'evt_art_ending_jia', path: 'assets/events/ending_jia.webp', category: 'event', required: false },
  { key: 'evt_art_ending_huo', path: 'assets/events/ending_huo.webp', category: 'event', required: false },
];

// ====================== Terrain (3 types) ==================================

export const TERRAIN_ART: ArtAssetDef[] = [
  { key: 'terrain_plain', path: 'assets/terrain/plain.webp', category: 'terrain', required: false },
  { key: 'terrain_hills', path: 'assets/terrain/hills.webp', category: 'terrain', required: false },
  { key: 'terrain_river', path: 'assets/terrain/river.webp', category: 'terrain', required: false },
];

// ====================== Full manifest ======================================

export const ART_MANIFEST: ArtAssetDef[] = [
  ...BUILDING_ART,
  ...GENERAL_ART,
  ...EVENT_ART,
  ...TERRAIN_ART,
];

export function getArtByCategory(category: ArtAssetDef['category']): ArtAssetDef[] {
  return ART_MANIFEST.filter(a => a.category === category);
}

// ====================== Boot 启动加载清单派生（h912-11 批次一） ======================
//
// PLAN.md：manifest 已描述的资产以 manifest 为权威 boot-loading 源，删除重复加载列表。
// URL 约定说明：仓库真实落盘为 public/art/<类别>/<id>.png；本表 path 字段（assets/*.webp）
// 是 Phase D 占位约定、与实际文件不对应——故派生只取「键与顺序」，URL 模板在此固化。
// 地形/散布/音频 manifest 未等价描述（TERRAIN_ART 仅 3 型且命名不一），仍由 BootScene 保留。

export interface BootLoadItem {
  key: string;
  url: string;
}

// n916d-23：缺图建筑复用同族既有美术（key 不变，存档/命名语义不受扰）——
// 锡矿→采石场（挖掘族）、麻田→桑园（种植族）；正式立绘制作后删除本表即可。
export const BUILDING_ART_REUSE: Record<string, string> = {
  bld_tin_mine: 'bld_quarry',
  bld_hemp_field: 'bld_mulberry_grove',
};

export function getBootLoadList(category: 'building' | 'general'): BootLoadItem[] {
  if (category === 'building') {
    return BUILDING_ART.map(a => ({
      key: a.key,
      url: `art/buildings/${BUILDING_ART_REUSE[a.key] ?? a.key}.png`,
    }));
  }
  return GENERAL_ART.map(a => {
    const id = a.key.startsWith('portrait_') ? a.key.slice('portrait_'.length) : a.key;
    return { key: a.key, url: `art/generals/${id}.png` };
  });
}

export function isArtAvailable(key: string, loadedKeys: ReadonlySet<string>): boolean {
  return loadedKeys.has(key);
}
