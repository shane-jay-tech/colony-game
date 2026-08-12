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

// ====================== Buildings (33) =====================================

export const BUILDING_ART: ArtAssetDef[] = [
  'bld_farm', 'bld_well', 'bld_house', 'bld_market', 'bld_woodcutter',
  'bld_quarry', 'bld_pottery_kiln', 'bld_loom_house', 'bld_smithy', 'bld_ancestor_shrine',
  'bld_barracks', 'bld_academy', 'bld_palace', 'bld_beacon_tower',
  'bld_post_road', 'bld_water_mill', 'bld_iron_forge', 'bld_mulberry_grove',
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

// ====================== UI elements ========================================

export const UI_ART: ArtAssetDef[] = [
  { key: 'ui_panel_bamboo', path: 'assets/ui/panel_bamboo.webp', category: 'ui', required: false },
  { key: 'ui_panel_silk', path: 'assets/ui/panel_silk.webp', category: 'ui', required: false },
  { key: 'ui_btn_wood', path: 'assets/ui/btn_wood.webp', category: 'ui', required: false },
  { key: 'ui_btn_bronze', path: 'assets/ui/btn_bronze.webp', category: 'ui', required: false },
  { key: 'ui_border_gold', path: 'assets/ui/border_gold.webp', category: 'ui', required: false },
  { key: 'ui_scroll_bg', path: 'assets/ui/scroll_bg.webp', category: 'ui', required: false },
];

// ====================== Terrain (3 types) ==================================

export const TERRAIN_ART: ArtAssetDef[] = [
  { key: 'terrain_plain', path: 'assets/terrain/plain.webp', category: 'terrain', required: false },
  { key: 'terrain_hill', path: 'assets/terrain/hill.webp', category: 'terrain', required: false },
  { key: 'terrain_water', path: 'assets/terrain/water.webp', category: 'terrain', required: false },
];

// ====================== Full manifest ======================================

export const ART_MANIFEST: ArtAssetDef[] = [
  ...BUILDING_ART,
  ...GENERAL_ART,
  ...EVENT_ART,
  ...UI_ART,
  ...TERRAIN_ART,
];

export function getArtByCategory(category: ArtAssetDef['category']): ArtAssetDef[] {
  return ART_MANIFEST.filter(a => a.category === category);
}

export function isArtAvailable(key: string, loadedKeys: ReadonlySet<string>): boolean {
  return loadedKeys.has(key);
}
