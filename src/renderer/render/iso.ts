/**
 * 等距(isometric)投影 —— 等距重写的坐标基石（纯函数，可测，无 Phaser 依赖）。
 *
 * 设计：2:1 菱形 tile（业界标准等距比例）。格子 (gx,gy) → 屏幕菱形，建筑/散布/地面共用同一斜视角，
 * 化解"2.5D 建筑贴俯视地面"的违和（《法老》/《尼布甲尼撒》正是此投影）。
 *
 *   屏幕原点(0,0)处放 tile(0,0) 的**顶点**：
 *     sx = (gx - gy) * (TILE_W/2)
 *     sy = (gx + gy) * (TILE_H/2)
 *   逆变换（屏幕→格子，含 floor 取整定位点击/hover 命中的格）：
 *     gx = (sx/(TILE_W/2) + sy/(TILE_H/2)) / 2
 *     gy = (sy/(TILE_H/2) - sx/(TILE_W/2)) / 2
 *
 * 渲染层在此基础上再加地图居中偏移(originX/originY)，本模块只管纯投影。
 */

/** 菱形 tile 宽（屏幕像素，菱形左右对角线长）。2:1 → 高是宽的一半。
 *  96×48：比初版 64×32 大一半，地块/建筑更有存在感、更易辨识（用户反馈"地图太小"）。 */
export const ISO_TILE_W = 96;
/** 菱形 tile 高（屏幕像素，上下对角线长）。 */
export const ISO_TILE_H = 48;

export interface IsoPoint { sx: number; sy: number; }
export interface GridPoint { gx: number; gy: number; }

/** 格子坐标 → 屏幕坐标（tile 顶点对齐原点；tile 中心需调用方按需 + TILE_H/2 等偏移）。 */
export function gridToIso(gx: number, gy: number): IsoPoint {
  return {
    sx: (gx - gy) * (ISO_TILE_W / 2),
    sy: (gx + gy) * (ISO_TILE_H / 2),
  };
}

/** 格子中心 → 屏幕坐标（菱形中心，便于放置 origin 在底中的精灵时再下移半个 tile 高）。 */
export function gridCenterToIso(gx: number, gy: number): IsoPoint {
  // 中心 = (gx+0.5, gy+0.5) 的顶点投影
  return {
    sx: (gx - gy) * (ISO_TILE_W / 2),
    sy: (gx + gy) * (ISO_TILE_H / 2) + ISO_TILE_H / 2,
  };
}

/** 屏幕坐标 → 连续格子坐标（未取整，用于精确命中/插值）。 */
export function isoToGridF(sx: number, sy: number): { gx: number; gy: number } {
  const halfW = ISO_TILE_W / 2;
  const halfH = ISO_TILE_H / 2;
  const a = sx / halfW;
  const b = sy / halfH;
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

/** 屏幕坐标 → 整数格子（floor）。点击/hover 命中用。 */
export function isoToGrid(sx: number, sy: number): GridPoint {
  const f = isoToGridF(sx, sy);
  return { gx: Math.floor(f.gx), gy: Math.floor(f.gy) };
}

/**
 * 整张地图在屏幕上的菱形包围盒尺寸（用于相机居中/clamp）。
 * width×height 格的等距地图：屏幕宽 = (w+h)*TILE_W/2，屏幕高 = (w+h)*TILE_H/2。
 * 最左点 x = -(h-1)*TILE_W/2（最后一行最左），最上点 y = 0。
 */
export function isoMapBounds(width: number, height: number): {
  minSx: number; minSy: number; pxW: number; pxH: number;
} {
  const minSx = -(height - 1) * (ISO_TILE_W / 2);
  const pxW = (width + height) * (ISO_TILE_W / 2);
  const pxH = (width + height) * (ISO_TILE_H / 2);
  return { minSx, minSy: 0, pxW, pxH };
}
