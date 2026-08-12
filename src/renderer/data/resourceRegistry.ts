/**
 * 资源 + Modifier target 的类型化注册表。
 * 解决 Kimi 反审 #5 #6：ResourceCost 封闭枚举无法扩"布/青铜/礼器"，
 * 以及 ModifierEffect.target 裸 string 拼错静默 NaN 的问题。
 *
 * 任何新资源 / 新 modifier target 都在这里登记，编译期类型 + 运行时校验联动。
 */

// ------ Resources --------------------------------------------------------

export const RESOURCE_IDS = [
  // 前期基础资源（v0.6 既有）
  'grain', // 粮
  'wood', // 木
  'stone', // 石
  'gold', // 钱
  'people', // 闲民

  // 中后期阶层资源（v0.7 调研要求扩展）
  'cloth', // 布（瓦房阶层需求）
  'bronze', // 青铜（殿宇阶层需求）
  'rite', // 礼器（士阶层需求）

  // B3 加工链中间品（Anno 式原料，不在顶栏主 token 行显示）
  'hemp', // 麻（织官原料）
  'tin', // 锡（青铜合金原料）

  // B2 影响力（史官/名望资源，产自国格，花在宣传/斡旋/修史）
  'influence', // 名望
] as const;

export type ResourceId = typeof RESOURCE_IDS[number];

/** 顶栏主 token 行展示的基础资源（B3 中间品另放工具栏，避免 1280px 溢出） */
export const TOP_BAR_RESOURCE_IDS = [
  'grain', 'wood', 'stone', 'gold', 'people', 'cloth', 'bronze', 'rite',
] as const;

/** B3 加工链中间品（工具栏右侧小字展示） */
export const INTERMEDIATE_RESOURCE_IDS = ['hemp', 'tin'] as const;

export type ResourceCost = Partial<Record<ResourceId, number>>;
export type ResourceBag = Partial<Record<ResourceId, number>>;

export function isValidResourceId(id: string): id is ResourceId {
  return (RESOURCE_IDS as readonly string[]).includes(id);
}

// ------ Modifier targets -------------------------------------------------
//
// 命名约定：scope_thing_op，统一全小写蛇形。
//   scope: country | building | settlement | population
//   thing: 资源名 / 概念
//   op:    output | consumption | growth | power | morale | speed | cost ...
//
// 注：保留 v0.6 命名风格 country_<thing>_<op>，并补 building_/population_/morale_ 前缀。

export const MODIFIER_TARGETS = [
  // 国家级产出 / 消耗
  'country_grain_output',
  'country_grain_consumption',
  'country_wood_output',
  'country_stone_output',
  'country_gold_output',
  'country_cloth_output',
  'country_bronze_output',
  'country_rite_output',

  // 国家级总量
  'country_population_growth',
  'country_population_cap',
  'country_military_power',
  'country_morale',
  'country_wrath',
  'country_research_speed',
  'country_diplomacy_weight',

  // 建筑级
  'building_construction_speed',
  'building_construction_cost',
  'building_efficiency',
  'building_upkeep',

  // 民心 / 阶层
  'population_happiness',
  'population_class_growth_shi', // 士阶层
  'population_class_growth_nong', // 农阶层
  'population_class_growth_gong', // 工阶层

  // 朝议触发概率调整
  'event_positive_probability',
  'event_negative_probability',

  // J-3 v0.8：周邦认同度（立信路径核心 metric；烽燧/驿道/石碑场/扶弱事件累积）
  'country_renown',
  // J-3 v0.8：建筑产出区域加成（驿道/水碓沿河等增益相邻 building）
  'building_output_area',
] as const;

export type ModifierTargetKey = typeof MODIFIER_TARGETS[number];

export function isValidModifierTarget(target: string): target is ModifierTargetKey {
  return (MODIFIER_TARGETS as readonly string[]).includes(target);
}

// ------ Helpers ----------------------------------------------------------

/** 把两个 ResourceBag 相加（任一缺字段视为 0）。 */
export function addBags(a: ResourceBag, b: ResourceBag): ResourceBag {
  const out: ResourceBag = { ...a };
  for (const id of RESOURCE_IDS) {
    const av = a[id] ?? 0;
    const bv = b[id] ?? 0;
    if (av + bv !== 0) out[id] = av + bv;
  }
  return out;
}

/** 检查 bag 是否能支付 cost。负数 cost 视为非法定义，按"付不起"处理（见 buildingRegistry 启动校验）。 */
export function canAfford(bag: ResourceBag, cost: ResourceCost): boolean {
  for (const id of RESOURCE_IDS) {
    const required = cost[id] ?? 0;
    if (required < 0) return false;
    if (required > 0 && (bag[id] ?? 0) < required) return false;
  }
  return true;
}
