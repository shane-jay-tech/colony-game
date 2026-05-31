import { describe, expect, it } from 'vitest';
import { WorldMapAccessor } from '../worldMap';
import type { WorldMap, MapTile, ResourceNode } from '../../data/mapSchema';

function plainTile(): MapTile {
  return { terrain: 'plain', buildable: true, walkable: true };
}
function riverTile(): MapTile {
  return { terrain: 'river', buildable: false, walkable: true };
}
function mountainTile(): MapTile {
  return { terrain: 'mountain', buildable: false, walkable: false };
}

function makeMap(width: number, height: number, factory: (x: number, y: number) => MapTile, nodes: ResourceNode[] = []): WorldMap {
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) tiles.push(factory(x, y));
  }
  return { width, height, tiles, resourceNodes: nodes, seed: 0 };
}

describe('WorldMapAccessor.inBounds', () => {
  const acc = new WorldMapAccessor(makeMap(10, 10, plainTile));

  it('accepts (0,0)', () => expect(acc.inBounds(0, 0)).toBe(true));
  it('accepts (9,9)', () => expect(acc.inBounds(9, 9)).toBe(true));
  it('rejects negative x', () => expect(acc.inBounds(-1, 0)).toBe(false));
  it('rejects negative y', () => expect(acc.inBounds(0, -1)).toBe(false));
  it('rejects x===width', () => expect(acc.inBounds(10, 0)).toBe(false));
  it('rejects y===height', () => expect(acc.inBounds(0, 10)).toBe(false));
  it('rejects non-integer x', () => expect(acc.inBounds(1.5, 0)).toBe(false));
  it('rejects NaN', () => expect(acc.inBounds(NaN, 0)).toBe(false));
});

describe('WorldMapAccessor.getTile', () => {
  it('returns the tile at (x,y)', () => {
    const acc = new WorldMapAccessor(makeMap(4, 4, (x, y) => (x === 2 && y === 1 ? riverTile() : plainTile())));
    expect(acc.getTile(2, 1)?.terrain).toBe('river');
    expect(acc.getTile(0, 0)?.terrain).toBe('plain');
  });

  it('returns undefined for out-of-bounds', () => {
    const acc = new WorldMapAccessor(makeMap(4, 4, plainTile));
    expect(acc.getTile(-1, 0)).toBeUndefined();
    expect(acc.getTile(0, 4)).toBeUndefined();
    expect(acc.getTile(1.5, 0)).toBeUndefined();
  });
});

describe('WorldMapAccessor.isBuildable', () => {
  it('returns true for 1x1 on plain', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8, plainTile));
    expect(acc.isBuildable(0, 0, 1, 1)).toBe(true);
  });

  it('returns false for 1x1 on river', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8, () => riverTile()));
    expect(acc.isBuildable(0, 0, 1, 1)).toBe(false);
  });

  it('returns false for 1x1 on mountain', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8, () => mountainTile()));
    expect(acc.isBuildable(0, 0, 1, 1)).toBe(false);
  });

  it('returns true for 2x2 fully on plain', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8, plainTile));
    expect(acc.isBuildable(2, 2, 2, 2)).toBe(true);
  });

  it('returns false when 2x2 partially overlaps a river tile', () => {
    // river at (3,3); 2x2 at (2,2) covers (2,2),(3,2),(2,3),(3,3) → false
    const acc = new WorldMapAccessor(makeMap(8, 8, (x, y) => (x === 3 && y === 3 ? riverTile() : plainTile())));
    expect(acc.isBuildable(2, 2, 2, 2)).toBe(false);
  });

  it('returns false when footprint extends out of bounds', () => {
    const acc = new WorldMapAccessor(makeMap(4, 4, plainTile));
    expect(acc.isBuildable(3, 3, 2, 2)).toBe(false); // (4,3) and (3,4) are oob
  });

  it('returns false for w=0', () => {
    const acc = new WorldMapAccessor(makeMap(4, 4, plainTile));
    expect(acc.isBuildable(0, 0, 0, 1)).toBe(false);
  });

  it('returns false for negative h', () => {
    const acc = new WorldMapAccessor(makeMap(4, 4, plainTile));
    expect(acc.isBuildable(0, 0, 1, -1)).toBe(false);
  });
});

describe('WorldMapAccessor.getDimensions', () => {
  it('returns the input width and height', () => {
    const acc = new WorldMapAccessor(makeMap(16, 24, plainTile));
    expect(acc.getDimensions()).toEqual({ width: 16, height: 24 });
  });
});

describe('WorldMapAccessor.getResourceNodesAt', () => {
  it('returns nodes at the exact tile', () => {
    const node: ResourceNode = { kind: 'forest_node', position: { x: 3, y: 5 }, remaining: 50 };
    const acc = new WorldMapAccessor(makeMap(8, 8, plainTile, [node]));
    expect(acc.getResourceNodesAt(3, 5)).toEqual([node]);
  });

  it('returns empty array on a tile with no node', () => {
    const node: ResourceNode = { kind: 'forest_node', position: { x: 3, y: 5 }, remaining: 50 };
    const acc = new WorldMapAccessor(makeMap(8, 8, plainTile, [node]));
    expect(acc.getResourceNodesAt(0, 0)).toEqual([]);
  });

  it('returns multiple nodes at the same tile', () => {
    const a: ResourceNode = { kind: 'forest_node', position: { x: 1, y: 1 }, remaining: 50 };
    const b: ResourceNode = { kind: 'stone_node', position: { x: 1, y: 1 }, remaining: 80 };
    const acc = new WorldMapAccessor(makeMap(4, 4, plainTile, [a, b]));
    expect(acc.getResourceNodesAt(1, 1)).toHaveLength(2);
  });
});

describe('WorldMapAccessor.toRaw', () => {
  it('returns the original WorldMap reference', () => {
    const map = makeMap(4, 4, plainTile);
    const acc = new WorldMapAccessor(map);
    expect(acc.toRaw()).toBe(map);
  });
});
