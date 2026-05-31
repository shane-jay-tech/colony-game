import type { WorldMap, MapTile, ResourceNode } from '../data/mapSchema';

export class WorldMapAccessor {
  constructor(private readonly map: WorldMap) {}

  inBounds(x: number, y: number): boolean {
    return (
      Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && x < this.map.width &&
      y >= 0 && y < this.map.height
    );
  }

  getTile(x: number, y: number): MapTile | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.map.tiles[y * this.map.width + x];
  }

  /** True iff the [x..x+w) × [y..y+h) rect is entirely inside the map AND every tile's buildable=true. */
  isBuildable(x: number, y: number, w: number, h: number): boolean {
    if (w <= 0 || h <= 0) return false;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const t = this.getTile(x + dx, y + dy);
        if (!t || !t.buildable) return false;
      }
    }
    return true;
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.map.width, height: this.map.height };
  }

  /**
   * O(n) over all resource nodes. Designed for click handlers and tooltips,
   * NOT per-frame use. If a future system needs per-frame queries, add a
   * spatial index keyed by `${x},${y}` in the constructor.
   */
  getResourceNodesAt(x: number, y: number): readonly ResourceNode[] {
    const out: ResourceNode[] = [];
    for (const n of this.map.resourceNodes) {
      if (n.position.x === x && n.position.y === y) out.push(n);
    }
    return out;
  }

  /**
   * Escape hatch — only saveLoad and debug tools should use this. The returned
   * reference is the live internal map; callers MUST NOT mutate it, otherwise
   * the accessor's queries silently drift from reality.
   */
  toRaw(): Readonly<WorldMap> {
    return this.map;
  }
}
