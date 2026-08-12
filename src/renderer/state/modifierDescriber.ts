/**
 * Modifier → 人话效果说明（纯函数，无 Phaser 依赖，便于单测）。
 *
 * 背景：国策/朝令的 effects[] 是机器可读的 { target, op, value }，玩家看不懂。每条数据本身带手写的
 * descPlain（白话 flavor），但缺"精确数值"那一行。本模块把 effects 拼成「粮食产出 +20%」「人口上限 +15」
 * 这类精确文字，供国策树节点/浮窗在 descPlain 之外补一行硬数字。
 *
 * 文案守"半文半白、禁偏字"。新增 modifier target 时务必在 TARGET_LABEL 补中文（有测试断言全覆盖）。
 */

import type { ModifierEffect } from '../data/schema';
import { MODIFIER_TARGETS, type ModifierTargetKey } from '../data/resourceRegistry';

/** modifier target → 玩家可读中文标签。覆盖 resourceRegistry.MODIFIER_TARGETS 全部 key。 */
export const TARGET_LABEL: Record<ModifierTargetKey, string> = {
  // 国家级产出 / 消耗
  country_grain_output: '粮食产出',
  country_grain_consumption: '粮食消耗',
  country_wood_output: '木材产出',
  country_stone_output: '石料产出',
  country_gold_output: '钱币产出',
  country_cloth_output: '布匹产出',
  country_bronze_output: '青铜产出',
  country_rite_output: '礼器产出',
  // 国家级总量
  country_population_growth: '人口增长',
  country_population_cap: '人口上限',
  country_military_power: '兵力',
  country_morale: '民心',
  country_wrath: '民怨',
  country_research_speed: '学问进展',
  country_diplomacy_weight: '邦交分量',
  // 建筑级
  building_construction_speed: '营建速度',
  building_construction_cost: '营建耗费',
  building_efficiency: '建筑效率',
  building_upkeep: '建筑维护',
  // 民心 / 阶层
  population_happiness: '民众安乐',
  population_class_growth_shi: '士人增长',
  population_class_growth_nong: '农人增长',
  population_class_growth_gong: '工匠增长',
  // 朝议概率
  event_positive_probability: '吉事概率',
  event_negative_probability: '灾祸概率',
  // 其它
  country_renown: '周邦声望',
  building_output_area: '区域产出加成',
};

/** 把一条 modifier 拼成人话。mul→百分比增减；add→带符号绝对值。 */
export function describeEffect(e: ModifierEffect): string {
  const label = TARGET_LABEL[e.target] ?? e.target;
  if (e.op === 'mul') {
    const pct = Math.round((e.value - 1) * 100);
    const sign = pct >= 0 ? '+' : '−'; // 负号用 U+2212 与前缀连字符区分，视觉更清楚
    return `${label} ${sign}${Math.abs(pct)}%`;
  }
  // add：绝对增量。整数直显，小数保留一位。
  const v = Number.isInteger(e.value) ? String(e.value) : e.value.toFixed(1);
  const sign = e.value >= 0 ? '+' : '−';
  return `${label} ${sign}${v.replace('-', '')}`;
}

/** 把一组 effects 拼成多行人话（供节点/浮窗逐行展示）。空数组返回 []。 */
export function describeEffects(effects: readonly ModifierEffect[]): string[] {
  return effects.map(describeEffect);
}

/** 校验：MODIFIER_TARGETS 每个 key 都有非空中文标签（防新增 target 漏翻译）。供启动校验/测试用。 */
export function findUnlabeledTargets(): ModifierTargetKey[] {
  return MODIFIER_TARGETS.filter((t) => !TARGET_LABEL[t] || TARGET_LABEL[t].trim() === '');
}
