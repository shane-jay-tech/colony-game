import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BuildMode, checkBuildAt } from '../buildMode';
import { GameStore, type IEventEmitter } from '../gameStore';
import { getBuildingDef } from '../../data/buildingRegistry';
import type { BuildingDef } from '../../data/schema';

function makeStore(): GameStore {
  const emitter = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(emitter);
}

const farmDef = getBuildingDef('bld_farm')!;
const wellDef = getBuildingDef('bld_well')!;

describe('BuildMode', () => {
  let bm: BuildMode;
  beforeEach(() => { bm = new BuildMode(); });

  it('starts inactive', () => {
    expect(bm.isActive()).toBe(false);
    expect(bm.getSelected()).toBeNull();
  });

  it('select activates and stores the def', () => {
    bm.select(farmDef);
    expect(bm.isActive()).toBe(true);
    expect(bm.getSelected()).toBe(farmDef);
  });

  it('cancel deactivates', () => {
    bm.select(farmDef);
    bm.cancel();
    expect(bm.isActive()).toBe(false);
    expect(bm.getSelected()).toBeNull();
  });

  it('selecting same def twice does NOT emit second event (idempotent)', () => {
    const fn = vi.fn();
    bm.onChange(fn);
    bm.select(farmDef);
    bm.select(farmDef);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('selecting different def fires event with new def', () => {
    const fn = vi.fn();
    bm.onChange(fn);
    bm.select(farmDef);
    bm.select(wellDef);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(wellDef);
  });

  it('cancel from inactive is no-op (does not emit)', () => {
    const fn = vi.fn();
    bm.onChange(fn);
    bm.cancel();
    expect(fn).not.toHaveBeenCalled();
  });

  it('onChange returns unsubscribe', () => {
    const fn = vi.fn();
    const off = bm.onChange(fn);
    bm.select(farmDef);
    off();
    bm.cancel();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('listener that throws does not break other listeners', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const good = vi.fn();
    bm.onChange(() => { throw new Error('bad listener'); });
    bm.onChange(good);
    bm.select(farmDef);
    expect(good).toHaveBeenCalledWith(farmDef);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('listener can unsubscribe inside callback without breaking iteration', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = bm.onChange((def) => { a(def); offA(); });
    bm.onChange(b);
    bm.select(farmDef);
    bm.select(wellDef);
    // a fired once (then unsubscribed), b fired both
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
});

describe('checkBuildAt (thin wrapper over canPlace)', () => {
  it('rejects out-of-bounds placement', () => {
    const store = makeStore();
    const r = checkBuildAt(store, farmDef, -1, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('out_of_bounds');
  });

  it('rejects when insufficient resources', () => {
    const store = makeStore();
    // Default state has no resources; farm needs wood:20 + people:5
    // First find a buildable plain tile
    const map = store.getWorldMap();
    const dim = map.getDimensions();
    let foundTile: { x: number; y: number } | null = null;
    for (let y = 0; y < dim.height && !foundTile; y++) {
      for (let x = 0; x < dim.width && !foundTile; x++) {
        if (map.isBuildable(x, y, farmDef.size.width, farmDef.size.height)) {
          foundTile = { x, y };
        }
      }
    }
    if (!foundTile) throw new Error('no buildable tile in test map');
    const r = checkBuildAt(store, farmDef, foundTile.x, foundTile.y);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('insufficient_resources');
  });

  it('accepts placement when bounds + buildable + resources all OK', () => {
    const store = makeStore();
    store.addResource('wood', 100);
    store.addResource('people', 100);
    const map = store.getWorldMap();
    const dim = map.getDimensions();
    let foundTile: { x: number; y: number } | null = null;
    for (let y = 0; y < dim.height && !foundTile; y++) {
      for (let x = 0; x < dim.width && !foundTile; x++) {
        if (map.isBuildable(x, y, farmDef.size.width, farmDef.size.height)) {
          foundTile = { x, y };
        }
      }
    }
    if (!foundTile) throw new Error('no buildable tile in test map');
    const r = checkBuildAt(store, farmDef, foundTile.x, foundTile.y);
    expect(r.ok).toBe(true);
  });

  it('handles NaN coords gracefully (out_of_bounds, no crash)', () => {
    const store = makeStore();
    const r = checkBuildAt(store, farmDef, NaN, NaN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('out_of_bounds');
  });
});

describe('BuildMode is decoupled from BuildingDef internals', () => {
  it('accepts any BuildingDef-shaped object', () => {
    const bm = new BuildMode();
    const fakeDef = { id: 'fake', size: { width: 1, height: 1 } } as unknown as BuildingDef;
    bm.select(fakeDef);
    expect(bm.getSelected()).toBe(fakeDef);
  });
});

// Slice E Critical 锁定：checkBuildAt 不能调用 store.getState()，否则会触发 structuredClone
// 整个 worldMap，pointermove 60Hz 热路径会被严重拖慢。
describe('checkBuildAt (Critical perf lock)', () => {
  it('does NOT call store.getState() (avoids per-frame structuredClone)', () => {
    const store = makeStore();
    const spy = vi.spyOn(store, 'getState');
    checkBuildAt(store, farmDef, 0, 0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('uses lightweight getResources + getBuildings (per-frame safe)', () => {
    const store = makeStore();
    const resSpy = vi.spyOn(store, 'getResources');
    const bldSpy = vi.spyOn(store, 'getBuildings');
    checkBuildAt(store, farmDef, 0, 0);
    expect(resSpy).toHaveBeenCalled();
    expect(bldSpy).toHaveBeenCalled();
    resSpy.mockRestore();
    bldSpy.mockRestore();
  });
});
