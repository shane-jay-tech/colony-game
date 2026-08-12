// Building anchor pipeline — manual overrides + merge helper.
//
// Source of truth is layered:
//   1. buildingAnchors.generated.ts  (auto-measured from art pixels by scripts/gen_building_anchors.py)
//   2. BUILDING_ANCHOR_OVERRIDES below (hand-tuned corrections for art the auto-pass gets wrong:
//      buildings whose footprint is skewed by a protruding tree / signboard / shadow, or whose
//      drawn ground diamond does not match the engine's 2:1 projection).
//   3. ANCHOR_FALLBACK (used when an assetKey has no generated entry at all).
//
// To re-measure after changing art:  python scripts/gen_building_anchors.py
// Then tweak only the offenders here. Override merges field-by-field over the generated values.

import { BUILDING_ANCHORS } from './buildingAnchors.generated';

export interface BuildingAnchor {
  /** Horizontal position of the footprint centre, as a fraction of image width (0..1). */
  anchorXFrac: number;
  /** Vertical position of the footprint front-bottom vertex, as a fraction of image height (0..1). */
  anchorYFrac: number;
  /** Drawn ground-footprint width as a fraction of image width (0..1); maps to the tile iso-width. */
  footprintWidthFrac: number;
}

const ANCHOR_FALLBACK: BuildingAnchor = {
  anchorXFrac: 0.5,
  anchorYFrac: 1.0,
  footprintWidthFrac: 1.0,
};

// Hand-tuned corrections. Provide only the fields that need fixing.
// Example: bld_house: { anchorXFrac: 0.46, footprintWidthFrac: 0.74 },
export const BUILDING_ANCHOR_OVERRIDES: Record<string, Partial<BuildingAnchor>> = {
};

// Memoise the merged result per assetKey: rerenderBuildings asks for it once per building,
// and the value only changes when the generated data or overrides change (i.e. never at runtime).
const _cache = new Map<string, BuildingAnchor>();

/** Merge generated anchor data with any manual override for the given assetKey. */
export function getBuildingAnchor(assetKey: string): BuildingAnchor {
  const cached = _cache.get(assetKey);
  if (cached) return cached;
  const base: BuildingAnchor = BUILDING_ANCHORS[assetKey] ?? ANCHOR_FALLBACK;
  const override = BUILDING_ANCHOR_OVERRIDES[assetKey];
  const merged: BuildingAnchor = override ? { ...base, ...override } : base;
  _cache.set(assetKey, merged);
  return merged;
}
