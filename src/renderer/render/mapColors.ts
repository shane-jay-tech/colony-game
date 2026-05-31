/**
 * 地形 / 资源点 → Phaser 0xRRGGBB 颜色（Slice D）。
 *
 * 锁色板（v0.7 视觉系统）：
 *   plain    PAPER_DIM   E6DCC3
 *   hills    GOLD_DIM    8A6E3E
 *   forest   STONE_GREEN 4A7C59
 *   river    WOOD_LIGHT  5D4037（暗水带）
 *   mountain ASH         6D635B
 *
 * 资源点用强调色（叠加在 tile 上方的小标记）：
 *   forest_node CINNABAR   B71C1C
 *   stone_node  GOLD       C9A84C
 *   river_node  PAPER      F5ECD7
 */

import type { Terrain, ResourceNodeKind } from '../../renderer/data/mapSchema';
import { COLORS } from '../ui/palette';

// 校验由 saveLoad 的 deep-validate 守住，但渲染层再加一道兜底：万一 raw map 绕过校验
// 进来（mapGen bug、未来加新 terrain 忘了同步），返回 fallback 调试色而不是让 Phaser
// 拿到 undefined 渲染出黑块。
const FALLBACK_COLOR = 0xFF00FF;

export function terrainColor(t: Terrain): number {
  switch (t) {
    case 'plain': return COLORS.PAPER_DIM;
    case 'hills': return COLORS.GOLD_DIM;
    case 'forest': return COLORS.STONE_GREEN;
    case 'river': return COLORS.WOOD_LIGHT;
    case 'mountain': return COLORS.ASH;
    default: {
      console.warn('[mapColors] unknown terrain:', t);
      return FALLBACK_COLOR;
    }
  }
}

export function resourceNodeColor(k: ResourceNodeKind): number {
  switch (k) {
    case 'forest_node': return COLORS.CINNABAR;
    case 'stone_node': return COLORS.GOLD;
    case 'river_node': return COLORS.PAPER;
    default: {
      console.warn('[mapColors] unknown resource node kind:', k);
      return FALLBACK_COLOR;
    }
  }
}

/** Tile rendering size in CSS pixels.
 *  v0.9 hotfix：16 → 24，应用户「像素太低看不清」。地图 80×80 在 24 下是 1920×1920，
 *  视口 mask 已在 v0.9 装好，超出部分被精确裁掉，不会渗到 HUD/侧栏。 */
export const TILE_SIZE = 24;

/** Resource node marker is a small inset square. */
export const NODE_MARKER_INSET = 6;
