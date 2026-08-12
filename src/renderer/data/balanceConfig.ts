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

/** 平衡数值表结构（沙盒 BALANCE 与故事 STORY_BALANCE 共用，便于双表分离）。 */
export interface BalanceConfig {
  startingResources: Partial<Record<ResourceId, number>>;
  time: { msPerDay: Record<1 | 2 | 3, number> };
  /** 事件节奏：两次朝堂事件之间至少间隔多少游戏日（纪元式沉稳，给经营留呼吸） */
  event: { minDaysBetween: number };
  population: {
    baseHousingCap: number;
    growthRatePerDay: number;
    minDailyGrowth: number;
    /** BUG-A：人口超住房上限时，每日"无家可归"流失比例（仅在有余粮时回落，缺粮让位饥荒）。 */
    homelessDeclineRate: number;
    /** BUG-A：单日回落人口的硬顶，防"人口雪崩"。 */
    homelessDeclineMax: number;
  };
}

export const BALANCE: BalanceConfig = {
  /** 新局起始资源（main.ts 据此发放；cloth/bronze/rite 起始为 0，靠建筑/国策积累） */
  startingResources: {
    wood: 80,
    stone: 30,
    people: 20,
    // BUG-B（2026-06-19）：人口开始真实吃粮后，20 民 = 20 粮/天，旧值 50 仅撑 2.5 天会开局速饿。
    // 抬到 250（约 12 天起步窗口）+ 饥荒宽限 5 日：评审(Kimi)指 7 天对新手偏紧，故给更宽容的开局。
    // 仍为 playtest 锚点，真实手感待主理人试玩微调（参考同类经营游戏 1-2 年安全期）。
    grain: 250,
    // 破"黄金死锁"：产金建筑(市集/驿道)都被需花 gold 的国策(pol_market 10/pol_post_road 20)前置，
    // 起始 0 金则永远拿不到第一笔钱→永远升不了城邑。给一笔启动金，够采纳一条产金国策并起步货币循环。
    gold: 40,
    // P3（2026-06-19）：阶层供养闭环开启后，首次把农民转工/兵时若 0 布/0 铜会立刻短缺扣民心。
    // 给一点起始缓冲，留出"先建蚕桑/铸造再扩阶层"的窗口。非致命，仍鼓励尽快自产。
    cloth: 30,
    bronze: 20,
  },
  /** 时间尺度：每"游戏日"对应多少真实毫秒。仅影响 wall-clock 播放快慢，不改任何按"天"计的平衡。
   *  1x≈1400ms（约 1.4 秒/天；纪元式沉稳，看着小城慢慢长）——比旧值放慢约 5.6×。 */
  time: {
    msPerDay: { 1: 2000, 2: 1000, 3: 500 },
  },
  /** 事件冷却：约一季（50 天）内不弹新朝堂事件，避免接二连三。 */
  event: { minDaysBetween: 50 },
  /** 人口增长（state/population.ts 消费）。people 是核心资源，有余粮且未满住房上限时自然增长。 */
  population: {
    // 2026-06-17 重平衡（适中加快 + 余粮正反馈，见 docs/decisions/2026-06-17-review-...）：
    //   baseHousingCap 25→45：开局给充裕自然增长窗口，能长到 pop30+ 摸到第一个国格门槛再撞顶
    //     （旧值 25 距起始 20 仅 5，约 34 秒就悄悄冻结、且无提示，玩家误以为坏了）。
    //   minDailyGrowth 0.3→1.2：开局每游戏日必涨约 1 人（1x≈2 秒/日），肉眼可见，不再"像没动"。
    //   growthRatePerDay 0.012→0.02：中期百分比驱动也更有体感。
    //   余粮正反馈（粮越足长越快，封顶 ×1.5）在 gameStore.runPopulationTick 施加，本表只放基准值。
    baseHousingCap: 45,
    growthRatePerDay: 0.02,
    minDailyGrowth: 1.2,
    // BUG-A（2026-06-19）：拆房/割地/+cap modifier 到期会让住房上限掉到人口之下，旧逻辑下人口
    // 永久"卡"在上限之上（民187/175）。现改为：超上限且有余粮时温和回落，单日封顶 2 人防雪崩。
    homelessDeclineRate: 0.02,
    homelessDeclineMax: 2,
  },
};

/**
 * Phase2 §8.1 双表分离骨架：故事模式戏剧化数值表（drama）。
 * 故事模式用本表**覆盖**沙盒 BALANCE，通关后恢复——绝不在共享代码里改数值。
 * ⚠️ 本轮先与沙盒同值占位（仅起始资源略宽以支撑剧情展开），真正的"戏剧化数值"（刻意粮荒等）留后续填。
 */
export const STORY_BALANCE: BalanceConfig = {
  // BUG-B：故事 30 民 = 30 粮/天，起始粮 80→320（约 11 天起步窗口）+ 饥荒宽限。待 playtest 微调。
  // P3：阶层供养缓冲 cloth/bronze（同沙盒，略宽）。
  startingResources: { wood: 100, stone: 40, people: 30, grain: 320, gold: 50, cloth: 40, bronze: 25 },
  time: { msPerDay: { 1: 2000, 2: 1000, 3: 500 } },
  event: { minDaysBetween: 40 },
  population: {
    // 故事起始 people 30；同步沙盒重平衡（2026-06-17），cap 给足自然增长窗口。
    baseHousingCap: 55,
    growthRatePerDay: 0.02,
    minDailyGrowth: 1.2,
    homelessDeclineRate: 0.02,
    homelessDeclineMax: 2,
  },
};

/** 按模式取数值表（故事用 drama 覆盖；沙盒用裸 BALANCE）。 */
export function getBalanceConfig(mode: 'sandbox' | 'story'): BalanceConfig {
  return mode === 'story' ? STORY_BALANCE : BALANCE;
}
