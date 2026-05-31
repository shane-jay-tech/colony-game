import type { DefeatCondition } from './schema';

/**
 * 软失败 / 出公奔卫机制（Kimi 调研 B.11 + 反审 #8 必修）。
 *
 * 不弹"Game Over"。国库 + 存粮双归零持续 60 天 → 流亡至卫国边邑，
 * 人口回退到 20，建筑降级茅屋，资源清零，但科技保留 50%、地图保留。
 * 每次倾覆获得 1 枚天命碎片（permanentBuffs）。
 */
export const DEFEAT_CONDITIONS: DefeatCondition[] = [
  {
    id: 'defeat_treasury_collapse',
    type: 'soft',
    metricTarget: 'country_gold_output', // 实际系统层会查 SaveData.world.resources.gold
    threshold: 0,
    graceDays: 60,
    exileToCountryId: 'wei_border',
    retainTechRatio: 0.5,
  },
  {
    id: 'defeat_famine',
    type: 'soft',
    metricTarget: 'country_grain_consumption',
    threshold: 0,
    graceDays: 60,
    exileToCountryId: 'wei_border',
    retainTechRatio: 0.5,
  },
];
