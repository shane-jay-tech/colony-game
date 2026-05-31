import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import { TimeSystem, dayToCalendar, SPEED_MS_PER_DAY } from '../timeSystem';

// 期望全部从 SPEED_MS_PER_DAY 派生，时间尺度再调也不破（D = 1x 每天毫秒）
const D = SPEED_MS_PER_DAY[1];

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
    ts.update(D * 5);
    expect(store.getCurrentDay()).toBe(0);
  });

  it('speed=2 advances 2 days per 1x-day worth of ms', () => {
    const store = makeStore(2);
    const ts = new TimeSystem(store);
    ts.update(SPEED_MS_PER_DAY[2] * 2);
    expect(store.getCurrentDay()).toBe(2);
  });

  it('speed=1 in 3.5 days worth of ms advances 3 days', () => {
    const store = makeStore(1);
    const ts = new TimeSystem(store);
    ts.update(Math.floor(D * 3.5));
    expect(store.getCurrentDay()).toBe(3);
  });

  it('accumulator remainder preserved across two calls', () => {
    const store = makeStore(1);
    const ts = new TimeSystem(store);
    ts.update(Math.floor(D * 0.6));
    expect(store.getCurrentDay()).toBe(0);
    ts.update(Math.ceil(D * 0.6));
    expect(store.getCurrentDay()).toBe(1);
  });

  it('season tick fires after crossing 30 days', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(D * 30);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('year tick fires after crossing 120 days', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.YEAR_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(D * 120);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('large delta fires multiple dayTick events', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.DAY_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(D * 5);
    expect(cb).toHaveBeenCalledTimes(5);
  });

  // DeepSeek #1 / Kimi agree: crossing N seasons in one frame must fire N season ticks
  it('crossing 3 seasons in one frame fires 3 season ticks', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(D * 90); // 90 days = 3 seasons
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('crossing 2 years in one frame fires 2 year ticks', () => {
    const store = makeStore(1);
    const cb = vi.fn();
    store.on(STATE_EVENTS.YEAR_TICK, cb);
    const ts = new TimeSystem(store);
    ts.update(D * 240); // 240 days = 2 years
    expect(cb).toHaveBeenCalledTimes(2);
  });

  // DeepSeek #3: paused must halt time even when speed != 0
  it('paused=true with speed=1 does not advance day', () => {
    const store = makeStore(1, true);
    const ts = new TimeSystem(store);
    ts.update(D * 5);
    expect(store.getCurrentDay()).toBe(0);
  });

  it('unpause resumes ticking', () => {
    const store = makeStore(1, true);
    const ts = new TimeSystem(store);
    ts.update(D * 2);
    expect(store.getCurrentDay()).toBe(0);
    store.setPaused(false);
    ts.update(D * 2);
    expect(store.getCurrentDay()).toBe(2);
  });

  // Kimi 新#4: load must reset accumulator
  it('resetForLoad clears accumulated remainder', () => {
    const store = makeStore(1);
    const ts = new TimeSystem(store);
    ts.update(Math.floor(D * 0.8)); // accumulator < 1 day, no tick yet
    ts.resetForLoad();
    ts.update(Math.floor(D * 0.8)); // should still be < 1 day (not 1.6)
    expect(store.getCurrentDay()).toBe(0);
  });
});
