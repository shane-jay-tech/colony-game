/**
 * 低谷危机（纯函数，无副作用）——供 gameStore 判定与施加"可翻身低谷"。
 *
 * 设计哲学（GAME_DESIGN_LIFECYCLE.md §7）：邦国录没有 Game Over，国库+存粮长期双零
 * 触发一次性可恢复的危机。§7 规格：触发 ~40 天 + 三种低谷按情境选 + 防刷递增。
 *   - 民变(unrest)：掉人口/降格/挫士气（默认；无强邻无外城时）
 *   - 纳贡附庸(vassalage)：被军力远超的敌对强邻逼为附庸，每季抽成，可赎身
 *   - 割地(cession)：丢一座外城/非核心建筑 + 民心小挫
 * 防刷：crisisCount 递增惩罚（越救越亏）+ 恢复期内不重复触发。
 */

import type { ResourceId } from '../data/resourceRegistry';

/** 国库+存粮双零持续多少天才触发危机（§7：比原 60 短，更早给反馈） */
export const CRISIS_GRACE_DAYS = 40;
/** 民变基础人口保留百分比（整数，避免浮点漂移）。70 = 留 70% */
export const CRISIS_POP_PCT = 70;
/** 人口保留百分比下限（多次危机不无限恶化） */
export const CRISIS_POP_PCT_FLOOR = 40;
/** 人口下限（不至于灭国） */
export const CRISIS_POP_FLOOR = 5;
/** 民变基础民心跌幅 */
export const CRISIS_MORALE_DROP = 20;
/** 资源回正连续多少天后解除危机态（可再次触发，不永久免疫） */
export const CRISIS_RECOVER_DAYS = 30;
/** 防刷递增：每经历一次危机，人口保留百分比再降这么多 */
export const CRISIS_ESCALATION_POP_PCT = 5;
/** 防刷递增：每经历一次危机，民心额外再跌这么多 */
export const CRISIS_ESCALATION_MORALE = 5;
/** 割地的民心小挫 */
export const CESSION_MORALE_DROP = 10;
/** 附庸每季抽成比例（gold/grain） */
export const VASSAL_TRIBUTE_RATE = 0.15;
/** 赎身所需 gold */
export const VASSAL_REDEEM_GOLD = 200;

export type CrisisKind = 'unrest' | 'vassalage' | 'cession';

/** 国库(gold) + 存粮(grain) 是否双零（<=0，含负值/缺失） */
export function isDualZero(resources: Readonly<Partial<Record<ResourceId, number>>>): boolean {
  return (resources.gold ?? 0) <= 0 && (resources.grain ?? 0) <= 0;
}

export interface CrisisChooseInput {
  /** 是否存在军力远超玩家的敌对 NPC（可逼为附庸） */
  hasStrongHostileNpc: boolean;
  /** 可被割让的外城/非核心 working 建筑数（>0 才能割地） */
  cedableBuildingCount: number;
}

/**
 * 按情境选低谷类型（避免一刀切）：
 * 强敌当前 → 纳贡附庸；有外城可割 → 割地；否则 → 民变。
 */
export function chooseCrisisKind(input: CrisisChooseInput): CrisisKind {
  if (input.hasStrongHostileNpc) return 'vassalage';
  if (input.cedableBuildingCount > 0) return 'cession';
  return 'unrest';
}

export interface UnrestEffects {
  newPeople: number;
  peopleDelta: number;
  moraleDelta: number;
}

/**
 * 民变后果（含防刷递增）：人口乘数随 crisisCount 变狠（下限 0.4），民心跌幅随次数加重。
 * crisisCount = 本次之前已经历的危机数（0 = 首次）。
 */
export function planUnrestEffects(currentPeople: number, crisisCount: number): UnrestEffects {
  const safePeople = Math.max(0, Math.floor(currentPeople));
  // 整数百分比避免浮点漂移：留存率 = max(40, 70 - 5×已历危机) %
  const pct = Math.max(CRISIS_POP_PCT_FLOOR, CRISIS_POP_PCT - crisisCount * CRISIS_ESCALATION_POP_PCT);
  const newPeople = Math.max(CRISIS_POP_FLOOR, Math.floor((safePeople * pct) / 100));
  const moraleDelta = -(CRISIS_MORALE_DROP + crisisCount * CRISIS_ESCALATION_MORALE);
  return { newPeople, peopleDelta: newPeople - safePeople, moraleDelta };
}

/** 割地民心跌幅（含递增）。 */
export function planCessionMoraleDrop(crisisCount: number): number {
  return -(CESSION_MORALE_DROP + crisisCount * CRISIS_ESCALATION_MORALE);
}

/** 附庸单季抽成（向下取整，资源不足则抽到 0）。 */
export function planTribute(resource: number): number {
  return Math.max(0, Math.floor((resource ?? 0) * VASSAL_TRIBUTE_RATE));
}
