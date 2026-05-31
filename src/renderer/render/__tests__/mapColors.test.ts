import { describe, it, expect, vi } from 'vitest';
import { terrainColor, resourceNodeColor, TILE_SIZE, NODE_MARKER_INSET } from '../mapColors';
import { COLORS } from '../../ui/palette';
import { TERRAIN_KINDS, RESOURCE_NODE_KINDS } from '../../data/mapSchema';

describe('terrainColor', () => {
  it('returns a valid 0xRRGGBB color for every terrain kind', () => {
    for (const t of TERRAIN_KINDS) {
      const c = terrainColor(t);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('plain → PAPER_DIM', () => expect(terrainColor('plain')).toBe(COLORS.PAPER_DIM));
  it('hills → GOLD_DIM', () => expect(terrainColor('hills')).toBe(COLORS.GOLD_DIM));
  it('forest → STONE_GREEN', () => expect(terrainColor('forest')).toBe(COLORS.STONE_GREEN));
  it('river → WOOD_LIGHT', () => expect(terrainColor('river')).toBe(COLORS.WOOD_LIGHT));
  it('mountain → ASH', () => expect(terrainColor('mountain')).toBe(COLORS.ASH));

  it('all five terrains map to distinct colors', () => {
    const set = new Set(TERRAIN_KINDS.map(terrainColor));
    expect(set.size).toBe(TERRAIN_KINDS.length);
  });
});

describe('resourceNodeColor', () => {
  it('returns a valid 0xRRGGBB color for every node kind', () => {
    for (const k of RESOURCE_NODE_KINDS) {
      const c = resourceNodeColor(k);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('forest_node → CINNABAR', () => expect(resourceNodeColor('forest_node')).toBe(COLORS.CINNABAR));
  it('stone_node → GOLD', () => expect(resourceNodeColor('stone_node')).toBe(COLORS.GOLD));
  it('river_node → PAPER', () => expect(resourceNodeColor('river_node')).toBe(COLORS.PAPER));
});

describe('unknown kinds (defense-in-depth)', () => {
  it('terrainColor returns fallback color for invalid terrain string', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const c = terrainColor('lava' as never);
    expect(c).toBe(0xFF00FF);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resourceNodeColor returns fallback color for invalid kind', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const c = resourceNodeColor('gold_node' as never);
    expect(c).toBe(0xFF00FF);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('layout constants', () => {
  it('TILE_SIZE is positive integer', () => {
    expect(Number.isInteger(TILE_SIZE)).toBe(true);
    expect(TILE_SIZE).toBeGreaterThan(0);
  });

  it('NODE_MARKER_INSET fits within tile', () => {
    expect(NODE_MARKER_INSET).toBeGreaterThan(0);
    expect(NODE_MARKER_INSET * 2).toBeLessThan(TILE_SIZE);
  });
});
