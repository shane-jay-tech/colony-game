/**
 * SeasonSystem — A-3 季节机制绑定。
 *
 * 每个季节注入一组 ModifierInstance 到 activeModifiers，影响经济/建筑/人口。
 * 季节切换时移除旧季节 modifier、注入新季节 modifier（不叠加，互斥）。
 *
 * 设计参考：Banished 冬季停工 + Frostpunk 温度经济影响。
 * 产出 modifier 走 productionSystem 已有管道；建筑工期走 construction tick；
 * 人口增长需 gameStore.runPopulationTick 读 country_population_growth modifier。
 */

import type { ModifierInstance, ModifierEffect } from '../data/schema';

export const SEASON_MODIFIER_PREFIX = 'season_modifier_';

export interface SeasonEffects {
  name: string;
  effects: ModifierEffect[];
}

/**
 * 四季 modifier 定义。
 * 每季 remainingDays = 30（一季恰好 30 天），season 切换时旧的已到 0 自动移除。
 */
export const SEASON_EFFECTS: Record<0 | 1 | 2 | 3, SeasonEffects> = {
  0: {
    name: '春·播种季',
    effects: [
      // 2026-06-19：人口开始真实吃粮后，季节产出大起大落让农田数极难配平。把粮食 swing 从 ~30% 收窄到 ~15%
      // （春 1.3→1.1，秋仍为最高 1.15），并软化冬季消耗（见下），让全年净粮更平稳、便于规划。待 playtest 微调。
      { target: 'country_grain_output', op: 'mul', value: 1.1 },
      { target: 'building_construction_speed', op: 'mul', value: 1.2 },
    ],
  },
  1: {
    name: '夏·灾害季',
    effects: [
      { target: 'country_population_growth', op: 'mul', value: 1.5 },
    ],
  },
  2: {
    name: '秋·丰收季',
    effects: [
      { target: 'country_grain_output', op: 'mul', value: 1.15 }, // 全年最高，但与春的差距收窄（防大起大落）

      { target: 'country_wood_output', op: 'mul', value: 1.2 },
      { target: 'country_stone_output', op: 'mul', value: 1.2 },
      { target: 'country_cloth_output', op: 'mul', value: 1.2 },
      { target: 'country_bronze_output', op: 'mul', value: 1.2 },
      { target: 'country_gold_output', op: 'mul', value: 1.3 },
    ],
  },
  3: {
    name: '冬·休整季',
    effects: [
      { target: 'building_construction_speed', op: 'mul', value: 0.67 },
      { target: 'country_grain_consumption', op: 'mul', value: 1.1 }, // 1.2→1.1：冬季无产出加成，消耗再 +20% 太苦，软化

      { target: 'country_diplomacy_weight', op: 'mul', value: 1.3 },
    ],
  },
};

export function makeSeasonModifier(season: 0 | 1 | 2 | 3): ModifierInstance {
  const def = SEASON_EFFECTS[season];
  return {
    id: `${SEASON_MODIFIER_PREFIX}${season}`,
    name: def.name,
    category: 'economy',
    effects: def.effects.map(e => ({ ...e })),
    remainingDays: -1, // permanent; removed explicitly at season transition
    description: def.name,
    descPlain: def.name,
    stackable: false,
    visualBadge: null,
  };
}

export function isSeasonModifier(m: ModifierInstance): boolean {
  return m.id.startsWith(SEASON_MODIFIER_PREFIX);
}

/**
 * 移除旧季节 modifier + 注入新季节 modifier。返回新的 activeModifiers 数组。
 */
export function applySeasonTransition(
  activeModifiers: ModifierInstance[],
  newSeason: 0 | 1 | 2 | 3,
): ModifierInstance[] {
  const filtered = activeModifiers.filter(m => !isSeasonModifier(m));
  filtered.push(makeSeasonModifier(newSeason));
  return filtered;
}
