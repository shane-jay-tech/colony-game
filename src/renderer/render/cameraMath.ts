/**
 * P1-6 架构硬化：相机/视口纯数学（从 MapRenderer 抽出的可测公式）。
 * 无 Phaser 依赖；MapRenderer 的 fit/cover/clamp 全部委托到这里，口径单一。
 */

/** v1.0 #5：地图缩放名义范围（真实下限是 fitMinZoom 动态值；MAX=2.0 硬上限）。 */
export const MAP_ZOOM_MIN = 0.5;
export const MAP_ZOOM_MAX = 2.0;

export interface Rect { x: number; y: number; w: number; h: number; }

/**
 * fit 缩放：整张等距地图刚好完整装进视口（取较小比例 → 全图可见、四周留黑边）。
 * 地图巨大 → 很小，floor 到 0.08；退化视口/地图 → 0.2 兜底。
 */
export function fitZoomFor(vpW: number, vpH: number, mapPxW: number, mapPxH: number): number {
  if (vpW <= 0 || vpH <= 0 || mapPxW <= 0 || mapPxH <= 0) return 0.2;
  const fit = Math.min(vpW / mapPxW, vpH / mapPxH);
  return Math.max(0.08, Math.min(MAP_ZOOM_MAX, fit));
}

/** cover 缩放：铺满视口（取较大比例 → 较大维填满、另一维溢出可拖动）。 */
export function coverZoomFor(vpW: number, vpH: number, mapPxW: number, mapPxH: number): number {
  if (vpW <= 0 || vpH <= 0 || mapPxW <= 0 || mapPxH <= 0) return 0.2;
  const cover = Math.max(vpW / mapPxW, vpH / mapPxH);
  return Math.max(0.08, Math.min(MAP_ZOOM_MAX, cover));
}

/** 近景放大上限：N 栋建筑填满视口（两轴几何均值），clamp 到 [cover, MAP_ZOOM_MAX]。 */
export function closeZoomFor(vpW: number, vpH: number, buildingBoxW: number, buildingBoxH: number, targetCount: number, cover: number): number {
  if (vpW <= 0 || vpH <= 0) return Math.min(MAP_ZOOM_MAX, Math.max(cover, 1));
  const close = Math.sqrt((vpW * vpH) / (targetCount * buildingBoxW * buildingBoxH));
  if (!Number.isFinite(close)) return Math.min(MAP_ZOOM_MAX, Math.max(cover, 1));
  return Math.min(MAP_ZOOM_MAX, Math.max(cover, close));
}

/**
 * clamp 相机 scroll：地图始终至少完全填满视口。
 * - zoom 很小时地图小于视口 → 该轴居中（不是锁 0，否则偏一边）；
 * - zoom 大时地图大于视口 → 不允许地图边离开视口边。
 */
export function clampScrollFor(
  curX: number, curY: number,
  vp: Rect, zoom: number,
  mapLeft: number, mapTop: number, mapPxW: number, mapPxH: number,
): { x: number; y: number } {
  const z = zoom || 1;
  const mapRight = mapLeft + mapPxW;
  const mapBottom = mapTop + mapPxH;

  const minX = mapLeft - vp.x / z;
  const maxX = mapRight - (vp.x + vp.w) / z;
  let x: number;
  if (minX > maxX) {
    x = (mapLeft + mapRight) / 2 - (vp.x + vp.w / 2) / z;
  } else {
    x = Math.max(minX, Math.min(maxX, curX));
  }

  const minY = mapTop - vp.y / z;
  const maxY = mapBottom - (vp.y + vp.h) / z;
  let y: number;
  if (minY > maxY) {
    y = (mapTop + mapBottom) / 2 - (vp.y + vp.h / 2) / z;
  } else {
    y = Math.max(minY, Math.min(maxY, curY));
  }
  return { x, y };
}

/** 锚点缩放：给定屏幕锚点与新旧 zoom，算新 scroll 使锚点世界坐标不变。 */
export function scrollForZoomAtAnchor(
  anchorSx: number, anchorSy: number,
  oldZoom: number, newZoom: number,
  oldScrollX: number, oldScrollY: number,
): { x: number; y: number } {
  const oldZ = oldZoom || 1;
  const newZ = newZoom || 1;
  const worldX = anchorSx / oldZ + oldScrollX;
  const worldY = anchorSy / oldZ + oldScrollY;
  return { x: worldX - anchorSx / newZ, y: worldY - anchorSy / newZ };
}

/** clamp 目标 zoom 到 [min, max]；NaN/非有限值回退 1（渲染器对 NaN zoom 零容忍）。 */
export function clampZoom(target: number, minZoom: number, maxZoom: number): number {
  if (!Number.isFinite(target)) return 1;
  return Math.max(minZoom, Math.min(maxZoom, target));
}

// MAP_ZOOM_MIN/MAX 定义于本文件（MapRenderer 转发导出，避免环依赖）
