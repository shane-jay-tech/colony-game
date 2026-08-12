/**
 * dayPipeline + GameStore.tickDay 顺序守护测试。
 * 验证：阶段表无重复/全覆盖、buildDayPipeline 缺 handler 抛错、runDayPipeline 严格按序、
 * GameStore.tickDay 实际执行顺序与 DAY_PHASE_ORDER 一致（防就地调换顺序回归）。
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type IEventEmitter } from '../gameStore';
import type { WorldMap } from '../../data/mapSchema';
import {
  DAY_PHASE_ORDER,
  DAY_PHASE_DEFS,
  buildDayPipeline,
  runDayPipeline,
  type DayPhaseId,
} from '../dayPipeline';

const PHASE_METHOD: Record<DayPhaseId, string> = {
  modifierExpiry: 'runModifierExpiryPhase',
  seasonTransition: 'runSeasonTransitionPhase',
  construction: 'runConstructionPhase',
  calendarEvents: 'runCalendarEventsPhase',
  production: 'runProductionTick',
  military: 'runMilitaryTick',
  decrees: 'runDecreeTick',
  events: 'runEventTick',
  diplomacy: 'runDiplomacyTick',
  npcDynamics: 'runNpcDynamicsTick',
  population: 'runPopulationTick',
  conversion: 'runConversionTick',
  starvation: 'runStarvationTick',
  crisis: 'runCrisisTick',
  grade: 'runGradeTick',
  factions: 'runFactionTick',
  megaProjects: 'runMegaProjectTick',
  story: 'runStoryTick',
  breathing: 'runBreathingTick',
  historian: 'runHistorianTick',
};

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() });
}

describe('dayPipeline', () => {
  it('阶段表无重复且与 defs 完全对应', () => {
    expect(new Set(DAY_PHASE_ORDER).size).toBe(DAY_PHASE_ORDER.length);
    expect(DAY_PHASE_ORDER).toHaveLength(Object.keys(DAY_PHASE_DEFS).length);
    for (const id of DAY_PHASE_ORDER) {
      expect(DAY_PHASE_DEFS[id], `missing def for ${id}`).toBeTruthy();
      expect(DAY_PHASE_DEFS[id].domain).toBeTruthy();
      expect(DAY_PHASE_DEFS[id].name.length).toBeGreaterThan(0);
    }
  });

  it('关键跨域依赖顺序保持（军事→邻国→人口→饥荒→危机→国格）', () => {
    const idx = (id: DayPhaseId): number => DAY_PHASE_ORDER.indexOf(id);
    expect(idx('military')).toBeLessThan(idx('npcDynamics'));
    expect(idx('npcDynamics')).toBeLessThan(idx('population'));
    expect(idx('population')).toBeLessThan(idx('starvation'));
    expect(idx('starvation')).toBeLessThan(idx('crisis'));
    expect(idx('crisis')).toBeLessThan(idx('grade'));
  });

  it('buildDayPipeline 缺 handler 直接抛错', () => {
    const handlers = {} as Record<DayPhaseId, () => void>;
    expect(() => buildDayPipeline(handlers)).toThrow(/missing handlers/);
  });

  it('runDayPipeline 严格按 DAY_PHASE_ORDER 执行', () => {
    const order: DayPhaseId[] = [];
    const handlers = {} as Record<DayPhaseId, () => void>;
    for (const id of DAY_PHASE_ORDER) handlers[id] = () => order.push(id);
    const pipeline = buildDayPipeline(handlers);
    runDayPipeline(pipeline);
    expect(order).toEqual([...DAY_PHASE_ORDER]);
  });
});

describe('GameStore.tickDay 阶段顺序', () => {
  it('按 DAY_PHASE_ORDER 依次执行全部阶段', () => {
    const store = makeStore();
    const observed: DayPhaseId[] = [];
    const spies = DAY_PHASE_ORDER.map((id) => {
      const method = PHASE_METHOD[id];
      return vi
        .spyOn(store as unknown as Record<string, () => void>, method)
        .mockImplementation(() => { observed.push(id); });
    });
    try {
      store.tickDay();
      expect(observed).toEqual([...DAY_PHASE_ORDER]);
      expect(spies.every((s) => s.mock.calls.length === 1)).toBe(true);
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });
});
