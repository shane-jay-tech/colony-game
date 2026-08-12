/**
 * 建筑沙印（Slice H）：每个 BuildingDef.id 映射到一个汉字戳记，
 * 由 MapRenderer 居中盖在建筑色块之上，让玩家从地图上一眼分清建筑类型。
 *
 * 选字原则：
 *   - 单字、笔画≤8、与建筑名义相通（田/居/市/林/石 ...）
 *   - 与 RESOURCE_LABEL 不冲突（避免视觉歧义）
 *   - 全部出自常用字 GBK，确保 Noto Serif SC 渲染稳定
 *
 * 完整性由 buildingSigils.test.ts 兜底（任何新建筑没配 sigil → 测试红）。
 */

import { BUILDINGS } from '../data/buildings';

/** 建筑 id → 戳记汉字 */
export const BUILDING_SIGIL: Record<string, string> = {
  bld_farm: '田',
  bld_well: '泉',
  bld_house: '居',
  bld_market: '市',
  bld_woodcutter: '林',
  bld_quarry: '石',
  bld_pottery_kiln: '陶',
  bld_loom_house: '织',
  bld_smithy: '冶',
  bld_ancestor_shrine: '祖',
  bld_barracks: '兵',
  bld_academy: '学',
  bld_palace: '宫',

  // J-3 v0.8 新建筑沙印
  bld_beacon_tower: '燧',
  bld_post_road: '驿',
  bld_water_mill: '碓',
  bld_iron_forge: '铁',
  bld_mulberry_grove: '桑',
  bld_stele_yard: '碑',
  bld_village_school: '塾',
  bld_envoy_lodge: '宾',

  // B-6 扩展建筑沙印
  bld_training_ground: '武',
  bld_stable: '马',
  bld_chariot_works: '车',
  bld_city_wall: '城',
  bld_imperial_guard: '禁',
  bld_granary: '仓',
  bld_watchtower: '哨',
  bld_censor: '察',
  bld_grand_temple: '庙',
  bld_observatory: '星',
  bld_relay_station: '邮',
  bld_nine_cauldrons: '鼎',
};

/** 安全查询：未配 sigil 的兜底用首字（建筑名第一个汉字），不返回 undefined。 */
export function getBuildingSigil(defId: string, fallbackName?: string): string {
  const explicit = BUILDING_SIGIL[defId];
  if (explicit) return explicit;
  if (fallbackName && fallbackName.length > 0) return fallbackName.charAt(0);
  return '？';
}

/** 调试用：返回未配 sigil 的 BuildingDef.id 列表 */
export function findUnconfiguredSigils(): string[] {
  return BUILDINGS.filter(b => !(b.id in BUILDING_SIGIL)).map(b => b.id);
}
