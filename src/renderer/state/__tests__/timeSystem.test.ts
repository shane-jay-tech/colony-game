import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import { TimeSystem, dayToCalendar } from '../timeSystem';

function makeStore(speed: 0 | 1 | 2 | 3 = 1, paused = false) {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { speed, paused });
}

describe('dayToCalendar', () => {
  it('day 0 is year=0 season=0 dayOfSeason=0', () => {
    expect(dayToCalendar(0)).toEqual({ year: 0, season: 0, dayOfSeason: 0 });
  });

  it('day 29 is last day of season 0', () => {
    expect(dayToCalendar(29)).toEqual({ year: 0, season: 0, dayOfSeason: 29 });
  });

  it('day 30 starts season 1', () => {
    expect(dayToCalendar(30)).toEqual({ year: 0, season: 1, dayOfSeason: 0 });
  });

  it('day 120 starts year 1', () => {
    expect(dayToCalendar(120)).toEqual({ year: 1, season: 0, dayOfSeason: 0 });
  });
});

describe('TimeSystem.update', () => {
  it('speed=0 does not advance day', () => {
    const store = makeStore(0);
    const ts = new TimeSystem(store);
    ts.update(5000);
    expect(store.getCurrentDay()).toBe(0);
  });

  it('speed=2 in 1000ms advances exactly 2 days', () => {
    const store = makeStore(2);
    const ts = new TimeSystem(store);
    ts.update(1000);
    expect(store.getCurrentDay()).toBe(2);
  });

  it('speed=1 in 3500ms advances 3 days', () => {
    const store = makeStore(1);
    const ts = new TimeSystem(store);
    ts.update(3500);
    expect(store.getCurrentDay()).toBe(3);
  });

  it('accumulator remainder preserved across two calls', () => {
    const store = makeStore(1);
    const ts = new TimeSystem(store);
    ts.update(600);
    expect(store.getCurrentDay()).toBe(0);
    ts.update(600);
    expect(store.getCurrentDay()).toBe(1);
  });

  it('season tick fires after crossing 30 days', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(30000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('year tick fires after crossing 120 days', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.YEAR_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(120000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('large delta fires multiple dayTick events', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.DAY_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(5000);
    expect(cb).toHaveBeenCalledTimes(5);
  });

  // DeepSeek #1 / Kimi agree: crossing N seasons in one frame must fire N season ticks
  it('crossing 3 seasons in one frame fires 3 season ticks', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(90000); // 90 days = 3 seasons
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('crossing 2 years in one frame fires 2 year ticks', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.YEAR_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(240000); // 240 days = 2 years
    expect(cb).toHaveBeenCalledTimes(2);
  });

  // DeepSeek #3: paused must halt time even when speed != 0
  it('paused=true with speed=1 does not advance day', () => {
    const store = makeStore(1, true);
    const ts = new TimeSystem(store);
    ts.update(5000);
    expect(store.getCurrentDay()).toBe(0);
  });

  it('unpause resumes ticking', () => {
    const store = makeStore(1, true);
    const ts = new TimeSystem(store);
    ts.update(2000);
    expect(store.getCurrentDay()).toBe(0);
    store.setPaused(false);
    ts.update(2000);
    expect(store.getCurrentDay()).toBe(2);
  });

  // Kimi 新#4: load must reset accumulator
  it('resetForLoad clears accumulated remainder', () => {
    const store = makeStore(1);
    const ts = new TimeSystem(store);
    ts.update(800); // accumulator = 800ms, no tick yet
    ts.resetForLoad();
    ts.update(800); // accumulator should be 800ms (not 1600)
    expect(store.getCurrentDay()).toBe(0);
  });
});
