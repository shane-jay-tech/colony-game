import { createRng } from './rng';
import type { RngHandle } from './rng';
import type {
  WorldMap,
  MapTile,
  ResourceNode,
  Terrain,
} from '../data/mapSchema';

export interface MapGenOptions {
  width: number;
  height: number;
  seed: number;
}

export class MapGenError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'MapGenError';
  }
}

const MIN_DIM = 8;
const MAX_DIM = 200;

const HILL_RATIO = 0.10;
const FOREST_RATIO = 0.14;
const MOUNTAIN_RATIO = 0.05;

const FOREST_NODE_PER_N_TILES = 7;
const STONE_NODE_PER_N_TILES = 6;
const RIVER_NODE_EVERY_N = 10;

/** Cluster size targets — large enough to form coherent regions, small enough to leave plain in between. */
const FOREST_CLUSTER_SIZE = 28;   // ≈ 1 grove
const HILL_CLUSTER_SIZE = 22;
const MOUNTAIN_CLUSTER_SIZE = 14; // 山比丘陵小一点，更密集

function defaultTile(): MapTile {
  return { terrain: 'plain', buildable: true, walkable: true };
}

function applyTerrain(tile: MapTile, terrain: Terrain): void {
  tile.terrain = terrain;
  switch (terrain) {
    case 'plain':
    case 'hills':
    case 'forest':
      tile.buildable = true;
      tile.walkable = true;
      return;
    case 'river':
      tile.buildable = false;
      tile.walkable = true;
      return;
    case 'mountain':
      tile.buildable = false;
      tile.walkable = false;
      return;
  }
}

/**
 * 从 (sx, sy) 用 BFS 生长一片同地形 blob，最多 targetSize tile。
 * 只覆盖当前 terrain === 'plain' 的 tile（不重写河 / 已有山林）。
 * 边界扩散概率 0.6 让 blob 形状自然不规则。
 */
function growCluster(
  tiles: MapTile[],
  width: number,
  height: number,
  sx: number,
  sy: number,
  targetSize: number,
  terrain: Terrain,
  rng: RngHandle,
): { placed: number; placedIndices: number[] } {
  const idx = (x: number, y: number): number => y * width + x;
  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height;

  const start = tiles[idx(sx, sy)];
  if (!start || start.terrain !== 'plain') return { placed: 0, placedIndices: [] };

  // BFS frontier: 每次随机从 frontier 选一个，让 blob 形状不规则
  const frontier: number[] = [idx(sx, sy)];
  const seen = new Set<number>([idx(sx, sy)]);
  const placedIndices: number[] = [];
  let placed = 0;

  while (frontier.length > 0 && placed < targetSize) {
    // 从 frontier 随机抽一个（不是先进先出），blob 形态更自然
    const pickPos = rng.nextInt(0, frontier.length - 1);
    const cur = frontier[pickPos]!;
    frontier[pickPos] = frontier[frontier.length - 1]!;
    frontier.pop();

    const cx = cur % width;
    const cy = Math.floor(cur / width);
    const tile = tiles[cur];
    if (!tile || tile.terrain !== 'plain') continue;

    applyTerrain(tile, terrain);
    placed++;
    placedIndices.push(cur);

    // 4 邻居加入 frontier，每个 0.6 概率（再低就死得太早，再高就太规则）
    const neighbors: [number, number][] = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (!inBounds(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (seen.has(ni)) continue;
      const nt = tiles[ni];
      if (!nt || nt.terrain !== 'plain') continue;
      if (rng.chance(0.6)) {
        seen.add(ni);
        frontier.push(ni);
      }
    }
  }

  return { placed, placedIndices };
}

/**
 * 找一个还是 plain 的随机起点；若失败（map 已被填满）返回 null。
 * 不只是随机点 ——还检查 8 邻居至少 5 个也 plain，避免 cluster 起点正好挨着河 / 已有 blob 让生长立即停。
 */
function pickClusterSeed(
  tiles: MapTile[],
  width: number,
  height: number,
  rng: RngHandle,
  maxAttempts = 80,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = rng.nextInt(2, width - 3);
    const y = rng.nextInt(2, height - 3);
    const tile = tiles[y * width + x];
    if (!tile || tile.terrain !== 'plain') continue;
    // 8 邻居 plain 计数
    let plainCount = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nt = tiles[ny * width + nx];
        if (nt && nt.terrain === 'plain') plainCount++;
      }
    }
    if (plainCount >= 5) return { x, y };
  }
  return null;
}

export function generateMap(opts: MapGenOptions): WorldMap {
  const { width, height, seed } = opts;

  if (!Number.isFinite(seed)) {
    throw new MapGenError(`seed must be a finite number, got ${seed}`);
  }
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new MapGenError(`width and height must be integers, got ${width}x${height}`);
  }
  if (width < MIN_DIM || height < MIN_DIM) {
    throw new MapGenError(`map too small (min ${MIN_DIM}x${MIN_DIM}), got ${width}x${height}`);
  }
  if (width > MAX_DIM || height > MAX_DIM) {
    throw new MapGenError(`map too large (max ${MAX_DIM}x${MAX_DIM}), got ${width}x${height}`);
  }

  const rng = createRng(seed);
  const tiles: MapTile[] = [];
  for (let i = 0; i < width * height; i++) tiles.push(defaultTile());

  const idx = (x: number, y: number): number => y * width + x;
  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height;

  const resourceNodes: ResourceNode[] = [];

  // --- 1. carve a river top→bottom -----------------------------------------
  const startMinX = Math.floor(width * 0.2);
  const startMaxX = Math.floor(width * 0.8);
  let riverX = rng.nextInt(startMinX, startMaxX);
  let stepsSinceLastNode = 0;
  for (let y = 0; y < height; y++) {
    if (inBounds(riverX, y)) {
      const t = tiles[idx(riverX, y)];
      if (t) applyTerrain(t, 'river');
      if (stepsSinceLastNode === 0) {
        resourceNodes.push({
          kind: 'river_node',
          position: { x: riverX, y },
          remaining: 100,
        });
      }
      stepsSinceLastNode = (stepsSinceLastNode + 1) % RIVER_NODE_EVERY_N;
    }
    if (rng.chance(0.4)) {
      riverX += rng.chance(0.5) ? -1 : 1;
      riverX = Math.max(0, Math.min(width - 1, riverX));
    }
  }

  // --- 2. compute terrain budgets ------------------------------------------
  const totalTiles = width * height;
  const targetForestTotal = Math.floor(totalTiles * FOREST_RATIO);
  const targetHillTotal = Math.floor(totalTiles * HILL_RATIO);
  const targetMountainTotal = Math.floor(totalTiles * MOUNTAIN_RATIO);

  // --- 3. grow forest clusters ---------------------------------------------
  // 把总预算切成 ~targetForestTotal/FOREST_CLUSTER_SIZE 片，但限制最多次数避免死循环
  let forestPlaced = 0;
  let forestClusterCount = 0;
  const maxForestClusters = Math.max(1, Math.ceil(targetForestTotal / FOREST_CLUSTER_SIZE) + 2);
  while (forestPlaced < targetForestTotal && forestClusterCount < maxForestClusters) {
    const seedPt = pickClusterSeed(tiles, width, height, rng);
    if (!seedPt) break;
    const targetThis = Math.min(
      FOREST_CLUSTER_SIZE + rng.nextInt(-6, 8),
      targetForestTotal - forestPlaced,
    );
    const { placed, placedIndices } = growCluster(
      tiles, width, height, seedPt.x, seedPt.y, Math.max(4, targetThis), 'forest', rng,
    );
    forestPlaced += placed;
    forestClusterCount++;

    // 把 forest_node 撒到这一片森林 — 根据 cluster 大小放 1-3 个，比之前"每 7 tile 一个"更克制
    const nodeCount = Math.max(1, Math.floor(placed / FOREST_NODE_PER_N_TILES));
    for (let i = 0; i < nodeCount && i < placedIndices.length; i++) {
      const tileIdx = placedIndices[Math.floor((i + 0.5) * placedIndices.length / nodeCount)]!;
      const tx = tileIdx % width;
      const ty = Math.floor(tileIdx / width);
      resourceNodes.push({
        kind: 'forest_node',
        position: { x: tx, y: ty },
        remaining: 50,
      });
    }
  }

  // --- 4. grow hill clusters -----------------------------------------------
  let hillPlaced = 0;
  let hillClusterCount = 0;
  const maxHillClusters = Math.max(1, Math.ceil(targetHillTotal / HILL_CLUSTER_SIZE) + 2);
  while (hillPlaced < targetHillTotal && hillClusterCount < maxHillClusters) {
    const seedPt = pickClusterSeed(tiles, width, height, rng);
    if (!seedPt) break;
    const targetThis = Math.min(
      HILL_CLUSTER_SIZE + rng.nextInt(-4, 6),
      targetHillTotal - hillPlaced,
    );
    const { placed } = growCluster(
      tiles, width, height, seedPt.x, seedPt.y, Math.max(3, targetThis), 'hills', rng,
    );
    hillPlaced += placed;
    hillClusterCount++;
  }

  // --- 5. grow mountain clusters -------------------------------------------
  let mountainPlaced = 0;
  let mountainClusterCount = 0;
  const maxMountainClusters = Math.max(1, Math.ceil(targetMountainTotal / MOUNTAIN_CLUSTER_SIZE) + 2);
  while (mountainPlaced < targetMountainTotal && mountainClusterCount < maxMountainClusters) {
    const seedPt = pickClusterSeed(tiles, width, height, rng);
    if (!seedPt) break;
    const targetThis = Math.min(
      MOUNTAIN_CLUSTER_SIZE + rng.nextInt(-3, 4),
      targetMountainTotal - mountainPlaced,
    );
    const { placed, placedIndices } = growCluster(
      tiles, width, height, seedPt.x, seedPt.y, Math.max(3, targetThis), 'mountain', rng,
    );
    mountainPlaced += placed;
    mountainClusterCount++;

    // stone_node 撒到山堆中心
    const nodeCount = Math.max(1, Math.floor(placed / STONE_NODE_PER_N_TILES));
    for (let i = 0; i < nodeCount && i < placedIndices.length; i++) {
      const tileIdx = placedIndices[Math.floor((i + 0.5) * placedIndices.length / nodeCount)]!;
      const tx = tileIdx % width;
      const ty = Math.floor(tileIdx / width);
      resourceNodes.push({
        kind: 'stone_node',
        position: { x: tx, y: ty },
        remaining: 80,
      });
    }
  }

  return {
    width,
    height,
    tiles,
    resourceNodes,
    seed,
  };
}
