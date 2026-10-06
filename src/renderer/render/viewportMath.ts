/**
 * R3 视口反向映射纯数学（c924-27 从 MapRenderer 抽出的最后两段内联公式；
 * 可提取面清单见 docs/insights/colony-maprenderer-viewport-material-20260922.md 第三节 A/E 两行）。
 * 无 Phaser 依赖、无副作用；MapRenderer 的 refreshViewportMask / screenToGrid 全部委托到这里，口径单一。
 *
 * 三条不可动摇的行为契约（提取=零行为变化，改这里前先读）：
 *  1. 相机读数沿用旧的 `(v as number | undefined) || 兜底` 语义：zoom 的 0/NaN/undefined → 1，
 *     scroll 的 NaN/undefined → 0；负值原样透传（现网不出现，也不在这里新增判断）。
 *  2. `screenToGrid` 名为 screen、实为 world→grid：运行时调用点传的是 pointer.worldX/worldY。
 *     因此这里**绝不除 zoom、绝不减 scroll**（材料档第四节缺陷 2 点名：补上 /z 会让点击落位全体偏移）。
 *  3. 越界返 null 的语义不与 viewportCenterTile 的「夹回边界」合并（材料档 T7），两者保持两份实现。
 */

import type { Rect } from './cameraMath';
import { isoToGridF } from './iso';

/**
 * H 段（c1007-03/c1002-23 材料档 §三）：cam zoom/scroll 的唯一读取口径——沿用本文件顶部
 * 契约 1 的 `(v as number | undefined) || 兜底` 语义（zoom 的 0/NaN/undefined → 1，
 * scroll 的 NaN/undefined → 0；负值原样透传）。MapRenderer 内一切读子改调这里，不再散写。
 */
export function readZoom(cam: { zoom?: number }): number {
    return (cam.zoom as number | undefined) || 1;
}

export function readScroll(cam: { scrollX?: number; scrollY?: number }): { x: number; y: number } {
    return {
        x: (cam.scrollX as number | undefined) || 0,
        y: (cam.scrollY as number | undefined) || 0,
    };
}

/**
 * A：把「固定的 screen 视口矩形」反向映射成世界矩形——mask 是世界坐标对象，会被相机一起变换，
 * 故反向除 zoom 再把 scroll 补偿加回来；宽高同样除以 zoom。z=1 且 scroll=0 时恒等于 vp。
 */
export function worldRectForMask(
  vp: Rect,
  zoom: number | undefined,
  scrollX: number | undefined,
  scrollY: number | undefined,
): Rect {
  const z = zoom || 1;
  const sx = scrollX || 0;
  const sy = scrollY || 0;
  return { x: vp.x / z + sx, y: vp.y / z + sy, w: vp.w / z, h: vp.h / z };
}

/**
 * E：世界点 → 整数格子（floor 取整）。世界点先减去地图 origin 与 isoOffsetX 平移成图层局部坐标，
 * 再走 iso.ts 的权威逆投影 isoToGridF（本仓第三份逆投影抄本由此并成一份，材料档第四节缺陷 1）。
 * 非有限输入或落在 width×height 之外 → null。
 */
export function worldToGridCell(
  worldX: number, worldY: number,
  originX: number, originY: number, isoOffsetX: number,
  width: number, height: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;
  const f = isoToGridF(worldX - originX - isoOffsetX, worldY - originY);
  const x = Math.floor(f.gx);
  const y = Math.floor(f.gy);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}
