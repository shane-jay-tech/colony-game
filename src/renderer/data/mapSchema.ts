/**
 * 地图数据 schema（Slice C）。
 *
 * 纯类型 — 任何运行时逻辑放在 state/mapGen.ts 或 state/worldMap.ts 中。
 * 这里登记的形状是存档协议的一部分；改动 MapTile / ResourceNode 字段
 * 必须同步升级 SAVE_SCHEMA_VERSION。
 */

export const TERRAIN_KINDS = ['plain', 'hills', 'forest', 'river', 'mountain'] as const;
export type Terrain = typeof TERRAIN_KINDS[number];

export interface MapTile {
  terrain: Terrain;
  /** 是否可建造（river / mountain = false） */
  buildable: boolean;
  /** 是否可通行（mountain = false；river 可过桥所以保持 true） */
  walkable: boolean;
}

export const RESOURCE_NODE_KINDS = ['forest_node', 'stone_node', 'river_node'] as const;
export type ResourceNodeKind = typeof RESOURCE_NODE_KINDS[number];

export interface ResourceNode {
  kind: ResourceNodeKind;
  position: { x: number; y: number };
  /** 剩余产出；0 = 已枯竭 */
  remaining: number;
}

export interface WorldMap {
  width: number;
  height: number;
  /** length === width * height；row-major（idx = y*width + x） */
  tiles: MapTile[];
  resourceNodes: ResourceNode[];
  /** 生成种子；存档迁移 / 调试用 */
  seed: number;
}

export function isValidTerrain(t: string): t is Terrain {
  return (TERRAIN_KINDS as readonly string[]).includes(t);
}

export function isValidResourceNodeKind(k: string): k is ResourceNodeKind {
  return (RESOURCE_NODE_KINDS as readonly string[]).includes(k);
}
