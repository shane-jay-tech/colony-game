import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../gameStore';
import type { IEventEmitter, GameState } from '../gameStore';
import { canPlace } from '../placementSystem';
import type { MapBounds } from '../placementSystem';
import { getBuildingDef } from '../../data/buildingRegistry';
import type { BuildingDef } from '../../data/schema';
import { WorldMapAccessor } from '../worldMap';
import type { WorldMap, MapTile } from '../../data/mapSchema';

const bounds: MapBounds = { width: 10, height: 10 };

function farmDef(): BuildingDef {
  const def = getBuildingDef('bld_farm');
  if (!def) throw new Error('bld_farm not registered');
  return def;
}

function allPlainAccessor(w = 10, h = 10): WorldMapAccessor {
  const tiles: MapTile[] = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
  return new WorldMapAccessor({ width: w, height: h, tiles, resourceNodes: [], seed: 0 });
}

const PLAIN_WM = allPlainAccessor();

function makeState(overrides: Partial<GameState> = {}): GameState {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, overrides);
  return store.getState() as GameState;
}

describe('canPlace', () => {
  it('ok on empty map with sufficient resources', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, 0, bounds, PLAIN_WM)).toEqual({ ok: true });
  });

  it('out_of_bounds when x is negative', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    expect(canPlace(state.resources, state.buildings, farmDef(), -1, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('out_of_bounds when y is negative', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, -1, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('out_of_bounds when x + width exceeds bounds', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    // farm is 2x2, bounds.width=10 → x=9 puts x+w=11 > 10
    expect(canPlace(state.resources, state.buildings, farmDef(), 9, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('out_of_bounds when x is NaN (Slice C)', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    expect(canPlace(state.resources, state.buildings, farmDef(), NaN, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('out_of_bounds when y is Infinity (Slice C)', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, Infinity, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('overlap when placing exactly on existing building', () => {
    const state = makeState({
      resources: { wood: 50, people: 20 },
      buildings: [{
        defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'overlap' });
  });

  it('overlap when new 2x2 footprint partially overlaps existing 2x2', () => {
    const state = makeState({
      resources: { wood: 50, people: 20 },
      buildings: [{
        defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    // existing occupies [0..2)x[0..2), new at (1,1) occupies [1..3)x[1..3) → overlap
    expect(canPlace(state.resources, state.buildings, farmDef(), 1, 1, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'overlap' });
  });

  it('ok when adjacent without overlap', () => {
    const state = makeState({
      resources: { wood: 50, people: 20 },
      buildings: [{
        defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    // existing [0..2)x[0..2), new at (2,0) occupies [2..4)x[0..2) → no overlap
    expect(canPlace(state.resources, state.buildings, farmDef(), 2, 0, bounds, PLAIN_WM)).toEqual({ ok: true });
  });

  it('insufficient_resources when not enough wood', () => {
    const state = makeState({ resources: { wood: 5, people: 20 } });
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'insufficient_resources' });
  });

  it('out_of_bounds wins over overlap when both fail', () => {
    const state = makeState({
      resources: { wood: 50, people: 20 },
      buildings: [{
        defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    // negative x AND would overlap if it weren't OOB
    expect(canPlace(state.resources, state.buildings, farmDef(), -1, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('overlap wins over insufficient_resources when both fail', () => {
    const state = makeState({
      resources: {}, // no resources
      buildings: [{
        defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, 0, bounds, PLAIN_WM)).toEqual({ ok: false, reason: 'overlap' });
  });
});

describe('canPlace — unbuildable_terrain (Slice C)', () => {
  function makeWorldMapWithRiverAt(rx: number, ry: number, w = 10, h = 10): WorldMap {
    const tiles: MapTile[] = [];
    for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    tiles[ry * w + rx] = { terrain: 'river', buildable: false, walkable: true };
    return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
  }

  it('rejects placement on river tile', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    const wm = new WorldMapAccessor(makeWorldMapWithRiverAt(3, 3));
    // farm is 2x2; placing at (3,3) covers river at (3,3)
    expect(canPlace(state.resources, state.buildings, farmDef(), 3, 3, bounds, wm)).toEqual({ ok: false, reason: 'unbuildable_terrain' });
  });

  it('out_of_bounds wins over unbuildable_terrain', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    // every tile is river — but placement is OOB → expect out_of_bounds
    const tiles: MapTile[] = [];
    for (let i = 0; i < 10 * 10; i++) tiles.push({ terrain: 'river', buildable: false, walkable: true });
    const wm = new WorldMapAccessor({ width: 10, height: 10, tiles, resourceNodes: [], seed: 0 });
    expect(canPlace(state.resources, state.buildings, farmDef(), -1, 0, bounds, wm)).toEqual({ ok: false, reason: 'out_of_bounds' });
  });

  it('unbuildable_terrain wins over overlap', () => {
    // existing farm at (0,0) and river at (5,5); place 2x2 at (4,4) → covers (5,5) river before any overlap
    const state = makeState({
      resources: { wood: 50, people: 20 },
      buildings: [{
        defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    const wm = new WorldMapAccessor(makeWorldMapWithRiverAt(5, 5));
    expect(canPlace(state.resources, state.buildings, farmDef(), 4, 4, bounds, wm)).toEqual({ ok: false, reason: 'unbuildable_terrain' });
  });

  it('unbuildable_terrain wins over insufficient_resources', () => {
    const state = makeState({ resources: {} });
    const wm = new WorldMapAccessor(makeWorldMapWithRiverAt(3, 3));
    expect(canPlace(state.resources, state.buildings, farmDef(), 3, 3, bounds, wm)).toEqual({ ok: false, reason: 'unbuildable_terrain' });
  });

  it('ok when placing on plain with worldMap provided', () => {
    const state = makeState({ resources: { wood: 50, people: 20 } });
    const wm = new WorldMapAccessor(makeWorldMapWithRiverAt(8, 8)); // far from placement
    expect(canPlace(state.resources, state.buildings, farmDef(), 0, 0, bounds, wm)).toEqual({ ok: true });
  });
});
