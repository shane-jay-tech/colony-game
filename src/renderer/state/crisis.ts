/**
 * 低谷危机（纯函数，无副作用）——供 gameStore 判定与施加"可翻身低谷"。
 *
 * 设计哲学（见 GAME_DESIGN_LIFECYCLE.md 第 7 节）：邦国录没有 Game Over，
 * 国库+存粮长期双零只触发一次性可恢复的危机（掉人口/降格/挫士气），玩家留在同一局爬回来。
 */

import type { ResourceId } from '../data/resourceRegistry';

/** 国库+存粮双零持续多少天才触发危机 */
export const CRISIS_GRACE_DAYS = 60;
/** 危机时人口乘数 */
export const CRISIS_POP_MULT = 0.7;
/** 危机时人口下限（不至于灭国） */
export const CRISIS_POP_FLOOR = 5;
/** 危机时民心跌幅 */
export const CRISIS_MORALE_DROP = 20;
/** 资源回正连续多少天后解除危机态（可再次触发，不永久免疫） */
export const CRISIS_RECOVER_DAYS = 30;

/** 国库(gold) + 存粮(grain) 是否双零（<=0，含负值/缺失） */
export function isDualZero(resources: Readonly<Partial<Record<ResourceId, number>>>): boolean {
  return (resources.gold ?? 0) <= 0 && (resources.grain ?? 0) <= 0;
}

export interface CrisisEffects {
  /** 危机后人口 */
  newPeople: number;
  /** 人口增量（负） */
  peopleDelta: number;
  /** 民心增量（负，调用方负责 clamp 到 0..100） */
  moraleDelta: number;
}

/**
 * 计算危机后果：人口 = max(floor(people×0.7), 5)；民心 -20（此处不 clamp，调用方 clamp）。
 * 注意 people 已极低（≤7）时 ×0.7 仍触下限保护，不会归零灭国。
 */
export function planCrisisEffects(currentPeople: number): CrisisEffects {
  const safePeople = Math.max(0, Math.floor(currentPeople));
  const newPeople = Math.max(CRISIS_POP_FLOOR, Math.floor(safePeople * CRISIS_POP_MULT));
  return {
    newPeople,
    peopleDelta: newPeople - safePeople,
    moraleDelta: -CRISIS_MORALE_DROP,
  };
}
