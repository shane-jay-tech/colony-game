import type { OfflineReward } from './schema';

/**
 * 离线收益规则（Kimi 调研 B.8 + 反审 #8 必修）。
 *
 * 上限 8 小时，离线产出 50%；人口与科技不自动增长（防"被代玩"感）；
 * 仅 economy / population 类 modifier 仍生效。
 */
export const OFFLINE_REWARD: OfflineReward = {
  maxOfflineHours: 8,
  decayFactor: 0.5,
  applicableModifiers: ['economy', 'population'],
  snapshotResources: ['grain', 'wood', 'stone', 'gold', 'cloth'],
};
