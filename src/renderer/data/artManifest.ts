/**
 * Phase D 美术资产清单。
 * 定义所有需要的美术资源（建筑/将领/事件/UI/地形），
 * BootScene 按此清单预加载；未就绪的资源 fallback 到沙印/色块。
 *
 * 资产文件约定（c921-01 改指实存文件；c921-02 整批转码后统一为 public/art/<类别>/*.webp）：
 *   - 建筑：art/buildings/{id}.webp (256×256 等距)
 *   - 将领：art/generals/{id}.webp (512×768 半身)
 *   - 事件：art/events/{name}.webp (800×450 场景)
 *   - 地形：art/terrain/{type}.webp (tileable 128×128)
 *   - 例外：无自有素材的两型建筑（bld_tin_mine / bld_hemp_field）保持 Phase D 占位口径，
 *     path 仍是 assets/buildings/{id}.webp（方案 B：待补素材，required=false，见 NO_OWN_ART）。
 * 口径：path 一律相对 public/；除上述两型外，每条 path 都由 tmp/art-exists-check.mts 逐键断言实存。
 */

export interface ArtAssetDef {
  key: string;
  path: string;
  category: 'building' | 'general' | 'event' | 'ui' | 'terrain';
  required: boolean;
}

// ====================== Buildings (35) =====================================

// c921-01：无自有立绘的缺图建筑（经 BUILDING_ART_REUSE 复用同族贴图）——
// 同 id 的 png 在 public/art/buildings/ 下不存在 ⇒ 走方案 B：不改 path（保留占位口径，
// 不谎报一个同样不存在的 png），required 保持 false，并登记进报告的「待补素材清单」。
const NO_OWN_ART = new Set(['bld_tin_mine', 'bld_hemp_field']);

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
  // c921-01 方案 A：同 id 的 png 实存 ⇒ 改指 public/art/buildings/<id>.png（说真话）；
  // c921-02 整批转码后同提交改指 .webp（原 png 已按授权删除，见 f0c9754；回滚件在 tmp/assets-backup-20260920/）。
  // 方案 B：NO_OWN_ART 两型无同 id 素材 ⇒ 保持原占位 path，不改。
  path: NO_OWN_ART.has(id) ? `assets/buildings/${id}.webp` : `art/buildings/${id}.webp`,
  category: 'building' as const,
  // c921-01：素材实存且被 getBootLoadList('building') 消费 ⇒ 校正为 true；
  // 仍缺素材的两型保持 false（禁止 required=true 而文件不存在）。
  required: !NO_OWN_ART.has(id),
}));

// ====================== Generals (5) =======================================

export const GENERAL_ART: ArtAssetDef[] = [
  'gen_pei_shao', 'gen_hu_ben', 'gen_xie_changqing', 'gen_tian_zhong', 'gen_barbarian',
].map(id => ({
  key: `portrait_${id}`,
  // c921-01 方案 A 改指实存文件；c921-02 转码后为 .webp（实存断言见 tmp/art-exists-check.mts）
  path: `art/generals/${id}.webp`,
  category: 'general' as const,
  required: true, // c921-01：实存且被 getBootLoadList('general') 消费
}));

// ====================== Event illustrations (10 core scenes) ===============

// c921-01 方案 A：10 型事件插画改指实存文件（原为不存在的 assets/events/*.webp）；
// c921-02 整批转码后同提交统一为 public/ 下落盘的 .webp，required 保持 true（实存且被
// BootScene.ts 的 EVENT_ART 循环消费）。
export const EVENT_ART: ArtAssetDef[] = [
  { key: 'evt_art_unification', path: 'art/events/unification.webp', category: 'event', required: true },
  { key: 'evt_art_coronation', path: 'art/events/coronation.webp', category: 'event', required: true },
  { key: 'evt_art_battle', path: 'art/events/battle.webp', category: 'event', required: true },
  { key: 'evt_art_flood', path: 'art/events/flood.webp', category: 'event', required: true },
  { key: 'evt_art_feast', path: 'art/events/feast.webp', category: 'event', required: true },
  { key: 'evt_art_diplomacy', path: 'art/events/diplomacy.webp', category: 'event', required: true },
  { key: 'evt_art_rebellion', path: 'art/events/rebellion.webp', category: 'event', required: true },
  { key: 'evt_art_ending_gong', path: 'art/events/ending_gong.webp', category: 'event', required: true },
  { key: 'evt_art_ending_jia', path: 'art/events/ending_jia.webp', category: 'event', required: true },
  { key: 'evt_art_ending_huo', path: 'art/events/ending_huo.webp', category: 'event', required: true },
];

// ====================== Terrain (5 types, c918-04 实存对账) ==================
// path 统一为 public/art/terrain/*.webp 实存文件（forest/hills/mountain/plain/river;c921-02 转码）

// c921-01：path 本就实存（c918-04 已对账）——不动 path，仅把 required 校正为 true
// （5 型均被 BootScene.ts:51 的 TERRAIN_ART 循环以 asset.path 直接消费）。
export const TERRAIN_ART: ArtAssetDef[] = [
  { key: 'terrain_forest', path: 'art/terrain/forest.webp', category: 'terrain', required: true },
  { key: 'terrain_hills', path: 'art/terrain/hills.webp', category: 'terrain', required: true },
  { key: 'terrain_mountain', path: 'art/terrain/mountain.webp', category: 'terrain', required: true },
  { key: 'terrain_plain', path: 'art/terrain/plain.webp', category: 'terrain', required: true },
  { key: 'terrain_river', path: 'art/terrain/river.webp', category: 'terrain', required: true },
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
// URL 约定说明（c921-02 更正）：仓库真实落盘为 public/art/<类别>/<id>.webp（c921-02 整批转码；
// 原 png 已按授权删除、回滚件在 tmp/assets-backup-20260920/），本表 path 字段与下方 URL 模板**同义且同扩展名**（仅 NO_OWN_ART 两型保留占位）。
// 派生仍只取「键与顺序」（+ 复用表），URL 模板保留在此以免多层派生。
// 地形/散布/音频 manifest 地形已等价描述（c918-04：TERRAIN_ART 5 型指向实存 art/terrain/*；c921-02 转码后为 .webp）；散布/音频 manifest 未等价描述，仍由 BootScene 保留。

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
      url: `art/buildings/${BUILDING_ART_REUSE[a.key] ?? a.key}.webp`,
    }));
  }
  return GENERAL_ART.map(a => {
    const id = a.key.startsWith('portrait_') ? a.key.slice('portrait_'.length) : a.key;
    return { key: a.key, url: `art/generals/${id}.webp` };
  });
}

export function isArtAvailable(key: string, loadedKeys: ReadonlySet<string>): boolean {
  return loadedKeys.has(key);
}
