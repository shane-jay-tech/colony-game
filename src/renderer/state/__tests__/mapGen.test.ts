import { describe, expect, it } from 'vitest';
import { generateMap, MapGenError } from '../mapGen';

describe('generateMap — determinism', () => {
  it('same seed produces identical map (tiles + nodes)', () => {
    const a = generateMap({ width: 32, height: 32, seed: 42 });
    const b = generateMap({ width: 32, height: 32, seed: 42 });
    expect(a.tiles).toEqual(b.tiles);
    expect(a.resourceNodes).toEqual(b.resourceNodes);
    expect(a.seed).toBe(b.seed);
  });

  it('different seeds produce different maps', () => {
    const a = generateMap({ width: 32, height: 32, seed: 42 });
    const b = generateMap({ width: 32, height: 32, seed: 43 });
    expect(a.tiles).not.toEqual(b.tiles);
  });
});

describe('generateMap — shape', () => {
  it('tiles.length === width * height', () => {
    const m = generateMap({ width: 16, height: 24, seed: 1 });
    expect(m.tiles.length).toBe(16 * 24);
  });

  it('width and height are preserved', () => {
    const m = generateMap({ width: 16, height: 24, seed: 1 });
    expect(m.width).toBe(16);
    expect(m.height).toBe(24);
  });

  it('seed field stores input seed', () => {
    const m = generateMap({ width: 8, height: 8, seed: 7 });
    expect(m.seed).toBe(7);
  });

  it('every tile has a valid terrain', () => {
    const m = generateMap({ width: 32, height: 32, seed: 100 });
    for (const t of m.tiles) {
      expect(['plain', 'hills', 'forest', 'river', 'mountain']).toContain(t.terrain);
    }
  });

  it('river tiles have buildable=false, walkable=true', () => {
    const m = generateMap({ width: 32, height: 32, seed: 100 });
    const river = m.tiles.filter(t => t.terrain === 'river');
    expect(river.length).toBeGreaterThan(0);
    for (const t of river) {
      expect(t.buildable).toBe(false);
      expect(t.walkable).toBe(true);
    }
  });

  it('mountain tiles have buildable=false, walkable=false', () => {
    const m = generateMap({ width: 32, height: 32, seed: 100 });
    const mountains = m.tiles.filter(t => t.terrain === 'mountain');
    if (mountains.length === 0) return; // small chance no mountain on tiny maps; tolerate
    for (const t of mountains) {
      expect(t.buildable).toBe(false);
      expect(t.walkable).toBe(false);
    }
  });
});

describe('generateMap — resource nodes', () => {
  it('produces at least one river_node', () => {
    const m = generateMap({ width: 32, height: 32, seed: 100 });
    expect(m.resourceNodes.some(n => n.kind === 'river_node')).toBe(true);
  });

  it('all resource nodes are inside map bounds', () => {
    const m = generateMap({ width: 32, height: 32, seed: 100 });
    for (const n of m.resourceNodes) {
      expect(n.position.x).toBeGreaterThanOrEqual(0);
      expect(n.position.x).toBeLessThan(32);
      expect(n.position.y).toBeGreaterThanOrEqual(0);
      expect(n.position.y).toBeLessThan(32);
    }
  });

  it('all resource nodes have remaining > 0', () => {
    const m = generateMap({ width: 32, height: 32, seed: 100 });
    for (const n of m.resourceNodes) {
      expect(n.remaining).toBeGreaterThan(0);
    }
  });
});

describe('generateMap — validation', () => {
  it('throws on width below minimum', () => {
    expect(() => generateMap({ width: 4, height: 32, seed: 1 })).toThrow(MapGenError);
  });

  it('throws on height above maximum', () => {
    expect(() => generateMap({ width: 32, height: 999, seed: 1 })).toThrow(MapGenError);
  });

  it('throws on non-integer width', () => {
    expect(() => generateMap({ width: 32.5, height: 32, seed: 1 })).toThrow(MapGenError);
  });

  it('throws on NaN seed', () => {
    expect(() => generateMap({ width: 32, height: 32, seed: NaN })).toThrow(MapGenError);
  });

  it('throws on Infinity seed', () => {
    expect(() => generateMap({ width: 32, height: 32, seed: Infinity })).toThrow(MapGenError);
  });
});
