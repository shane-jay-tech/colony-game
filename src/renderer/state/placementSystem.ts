import type { BuildingDef, BuildingInstance } from '../data/schema';
import { canAfford } from '../data/resourceRegistry';
import type { ResourceId } from '../data/resourceRegistry';
import { getBuildingDef } from '../data/buildingRegistry';
import type { WorldMapAccessor } from './worldMap';

export interface MapBounds {
  width: number;
  height: number;
}

export type PlacementFailReason =
  | 'insufficient_resources'
  | 'out_of_bounds'
  | 'overlap'
  | 'unbuildable_terrain';

export type PlacementResult =
  | { ok: true }
  | { ok: false; reason: PlacementFailReason };

function isOutOfBounds(x: number, y: number, w: number, h: number, bounds: MapBounds): boolean {
  // NaN/Infinity make every comparison false → would silently look "in-bounds" without this guard.
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return true;
  }
  return x < 0 || y < 0 || x + w > bounds.width || y + h > bounds.height;
}

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * 放置可行性检查。Slice E Critical 修复后：仅依赖必要的轻量数据
 * （resources / buildings），不再要求传入完整的 GameState，因此可在
 * pointermove 等热路径每帧安全调用，无 structuredClone 开销。
 */
export function canPlace(
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  buildings: readonly BuildingInstance[],
  def: BuildingDef,
  x: number,
  y: number,
  bounds: MapBounds,
  worldMap: WorldMapAccessor,
): PlacementResult {
  if (isOutOfBounds(x, y, def.size.width, def.size.height, bounds)) {
    return { ok: false, reason: 'out_of_bounds' };
  }

  if (!worldMap.isBuildable(x, y, def.size.width, def.size.height)) {
    return { ok: false, reason: 'unbuildable_terrain' };
  }

  for (const existing of buildings) {
    const existingDef = getBuildingDef(existing.defId);
    // pessimistic: if any existing building has unknown def, refuse placement.
    // beats silently using 1x1 fallback that would let new buildings overlap a corrupted footprint.
    if (!existingDef) {
      return { ok: false, reason: 'overlap' };
    }
    const sz = existingDef.size;
    if (aabbOverlap(
      x, y, def.size.width, def.size.height,
      existing.position.x, existing.position.y, sz.width, sz.height,
    )) {
      return { ok: false, reason: 'overlap' };
    }
  }

  if (!canAfford(resources, def.cost)) {
    return { ok: false, reason: 'insufficient_resources' };
  }

  return { ok: true };
}
