/**
 * 散布层配置（W4）：每种地形撒哪些 2.5D 自然物、多密、多大。
 *
 * 设计：每 tile 对若干"插槽"独立 roll（确定性 PRNG）。命中则从 pool 按 prng 选一个素材，
 * 在子格内 jitter + 缩放抖动 + 50% 水平翻转 → 破重复、出有机感（学《法老》/英雄无敌3 散布）。
 * scaleTiles = 显示高度占多少个 TILE（如树 ≈2.4 格高）。
 * 纯数据，便于 playtest 调密度（改这里一处即可）。素材 key = 'scatter_' + id（见 gen_scatter_art.py）。
 */

export interface ScatterSlot {
  /** 该插槽放一个散布物的概率 0..1 */
  prob: number;
  /** 候选素材 id（无 'scatter_' 前缀） */
  pool: string[];
  minScale: number;
  maxScale: number;
}

export interface TerrainScatter {
  slots: ScatterSlot[];
}

/** 五型地形的散布表。river 不用 slots（仅在与非水相邻的边缘 tile 放芦苇，见 RIVER_EDGE）。 */
export const SCATTER_BY_TERRAIN: Record<string, TerrainScatter> = {
  forest: {
    slots: [
      { prob: 0.92, pool: ['tree_pine', 'tree_locust', 'tree_mulberry'], minScale: 1.9, maxScale: 2.8 },
      { prob: 0.5, pool: ['tree_pine', 'tree_locust', 'tree_willow'], minScale: 1.6, maxScale: 2.3 },
      { prob: 0.14, pool: ['rock_cluster', 'bush_shrub', 'grass_tuft'], minScale: 0.7, maxScale: 1.1 },
    ],
  },
  plain: {
    slots: [
      { prob: 0.13, pool: ['grass_tuft', 'bush_shrub', 'rock_cluster'], minScale: 0.6, maxScale: 1.0 },
      { prob: 0.035, pool: ['tree_locust', 'tree_mulberry'], minScale: 1.6, maxScale: 2.2 },
    ],
  },
  hills: {
    slots: [
      { prob: 0.26, pool: ['rock_boulder', 'rock_cluster', 'bush_dry'], minScale: 0.9, maxScale: 1.5 },
    ],
  },
  mountain: {
    slots: [
      { prob: 0.42, pool: ['rock_boulder', 'rock_cluster'], minScale: 1.1, maxScale: 1.9 },
    ],
  },
  river: { slots: [] },
};

/** 河岸：仅当某 river tile 4-邻里有非 river 时，按此概率放芦苇/水草。 */
export const RIVER_EDGE: ScatterSlot = {
  prob: 0.55, pool: ['reed_clump', 'grass_tuft'], minScale: 0.9, maxScale: 1.4,
};

export const SCATTER_KEY_PREFIX = 'scatter_';

/** 全部可能用到的散布素材 id（BootScene 据此尝试加载；缺则跳过）。 */
export const ALL_SCATTER_IDS: readonly string[] = [
  'tree_pine', 'tree_locust', 'tree_mulberry', 'tree_willow',
  'rock_boulder', 'rock_cluster', 'bush_shrub', 'bush_dry',
  'reed_clump', 'grass_tuft',
];
