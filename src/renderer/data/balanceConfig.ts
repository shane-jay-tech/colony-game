/**
 * 平衡配置——8h 沙盒的"全局难度旋钮"单一事实源。
 *
 * 收纳"开局即影响整局曲线"的全局参数：起始资源、时间尺度、人口增长。
 * 单个内容条目的数值（建筑/国策/朝令/事件）仍留各自 data 文件。
 *
 * 注（语义内聚，未迁入此处，改时去对应文件）：
 *   - 国格门槛 → data/countryGrades.ts（COUNTRY_GRADES）
 *   - 危机阈值 → state/crisis.ts（CRISIS_*）
 *   - 外交 cost/冷却/通商系数 → state/diplomacySystem.ts
 *
 * ⚠️ 本表数值为初版锚点，8h 真实手感需主理人 playtest 后微调——改这里一处即可，无需碰逻辑。
 * 设计稿 8.1 的"沙盒/故事双表分离"是 Phase 2 才强制；本轮只集中、不分表。
 */

import type { ResourceId } from './resourceRegistry';

export const BALANCE = {
  /** 新局起始资源（main.ts 据此发放；cloth/bronze/rite 起始为 0，靠建筑/国策积累） */
  startingResources: {
    wood: 80,
    stone: 30,
    people: 20,
    grain: 50,
  } as Partial<Record<ResourceId, number>>,

  /** 时间尺度：每"游戏日"对应多少真实毫秒。仅影响 wall-clock 播放快慢，不改任何按"天"计的平衡。
   *  1x=250ms（4 天/秒；1 年=120 天=30 秒；8h≈960 年）——配人口增长，前 10-20 分钟逐级晋阶、8h 可登顶。 */
  time: {
    msPerDay: { 1: 250, 2: 125, 3: 83 } as Record<1 | 2 | 3, number>,
  },

  /** 人口增长（state/population.ts 消费）。people 是核心资源，有余粮且未满住房上限时自然增长。 */
  population: {
    /** 住房上限基数（无任何民居时的兜底容纳量） */
    baseHousingCap: 15,
    /** 日增速率（按当前人口复利）。people×rate */
    growthRatePerDay: 0.004,
    /** 日增下限（人口很少时也给固定增量，避免开局复利过慢） */
    minDailyGrowth: 0.05,
    /** 饥荒（存粮≤0）日减速率。people×rate */
    starveRatePerDay: 0.01,
  },
} as const;
