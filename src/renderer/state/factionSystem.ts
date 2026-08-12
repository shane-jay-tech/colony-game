/**
 * B-4.1 阶层博弈逻辑（纯函数）。
 * 人口 > 80 后触发，每 60-90 天一次事件。
 */

import type { FactionId, FactionDemand, FactionEffect } from '../data/factions';
import { FACTION_DEMANDS, FACTION_TRIGGER_POPULATION, FACTION_EVENT_INTERVAL_MIN, FACTION_EVENT_INTERVAL_MAX } from '../data/factions';
import type { RngHandle } from './rng';

export interface FactionState {
  active: boolean;
  lastEventDay: number;
  nextEventDay: number;
  activeDemand: FactionDemand | null;
  acceptedDemands: string[];
  rejectedDemands: string[];
}

export function createFactionState(): FactionState {
  return {
    active: false,
    lastEventDay: -1,
    nextEventDay: -1,
    activeDemand: null,
    acceptedDemands: [],
    rejectedDemands: [],
  };
}

export function shouldActivateFactions(population: number): boolean {
  return population >= FACTION_TRIGGER_POPULATION;
}

/**
 * 计算下一次阶层诉求的日子。
 * @param intervalFactor 监察台加成：>1 拉长间隔（诉求更稀）。缺省 1=无加成。
 */
export function scheduleFactionEvent(currentDay: number, rng: RngHandle, intervalFactor = 1): number {
  const base = FACTION_EVENT_INTERVAL_MIN + rng.nextInt(0, FACTION_EVENT_INTERVAL_MAX - FACTION_EVENT_INTERVAL_MIN);
  const interval = Math.max(1, Math.round(base * intervalFactor));
  return currentDay + interval;
}

export function pickDemand(
  alreadyUsed: readonly string[],
  rng: RngHandle,
): FactionDemand | null {
  const available = FACTION_DEMANDS.filter(d => !alreadyUsed.includes(d.demandId));
  if (available.length === 0) {
    // Recycle: all used, reset pool
    return rng.pick(FACTION_DEMANDS) ?? null;
  }
  return rng.pick(available) ?? null;
}

export function resolveDemand(
  demand: FactionDemand,
  accepted: boolean,
): { effect: FactionEffect; demandId: string } {
  return {
    effect: accepted ? demand.acceptEffect : demand.rejectEffect,
    demandId: demand.demandId,
  };
}

export function tickFaction(
  state: FactionState,
  population: number,
  currentDay: number,
  rng: RngHandle,
  intervalFactor = 1,
): FactionState {
  if (!state.active && shouldActivateFactions(population)) {
    return {
      ...state,
      active: true,
      nextEventDay: scheduleFactionEvent(currentDay, rng, intervalFactor),
    };
  }
  if (!state.active) return state;

  if (state.activeDemand) return state;

  if (currentDay >= state.nextEventDay) {
    const used = [...state.acceptedDemands, ...state.rejectedDemands];
    const demand = pickDemand(used, rng);
    return {
      ...state,
      activeDemand: demand,
      lastEventDay: currentDay,
      nextEventDay: demand ? state.nextEventDay : scheduleFactionEvent(currentDay, rng, intervalFactor),
    };
  }

  return state;
}
