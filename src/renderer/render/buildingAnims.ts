/**
 * A-4 建筑微动画 — 配置 + 类型。
 * 实际粒子管理在 MapRenderer 内（它已有坐标+建筑遍历）。
 */

export const SMOKE_BUILDING_IDS = new Set(['bld_smithy', 'bld_iron_forge']);
export const MARKET_BUILDING_IDS = new Set(['bld_market']);
export const FARM_BUILDING_IDS = new Set(['bld_farm']);

export const FARM_SEASON_TINTS: Record<0 | 1 | 2 | 3, number> = {
  0: 0x88cc44,
  1: 0x66aa22,
  2: 0xccaa33,
  3: 0x887766,
};

export const SMOKE_TEX_KEY = '__smoke__';
export const SPARKLE_TEX_KEY = '__sparkle__';
