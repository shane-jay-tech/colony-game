/**
 * 地形纹理叠层（Slice H）：在已 bake 的色块上加一层"墨笔点描"细节。
 *
 * 设计原则：
 *   - 只用 palette.ts 锁定的颜色（不引入第 12 色相）
 *   - 全部低 alpha（0.08–0.30），保证 terrain 主色仍占视觉主导
 *   - 确定性：同一 seed + 同一 (x,y) → 同一 pattern；存档 reload 后纹理不变
 *   - 廉价：所有 stroke 绘进 bakeTerrain 已分配的 Graphics，不开新 layer
 *
 * 五型映射（古纸地图惯例）：
 *   plain    点描     —— 稀疏 INK 小点，paper texture 感
 *   hills    斜线     —— 短斜线丘脊
 *   forest   点状簇   —— 密点 + 偶尔小三角，林冠暗示
 *   river    波浪     —— 横向 PAPER 波纹，水光反射
 *   mountain 三角峰   —— 中央山形 INK 三角
 */

import type { Terrain } from '../data/mapSchema';
import { COLORS } from '../ui/palette';

/**
 * mulberry32：32-bit seeded PRNG，纯函数。Slice C mapGen 之外的渲染层
 * 不需要 RNGState，重新实现一份简版避免 import 循环。
 */
export function makeTilePrng(mapSeed: number, x: number, y: number, mapWidth: number): () => number {
  // 把 (mapSeed, x, y) 折进 32-bit state；low-bits 互掺，避免 (0,0) (1,0) 几乎相邻。
  // DeepSeek 二审 nit：(x=0,y=0) 时 idxMix=0，state 直接 = mapSeed，对小 seed 几乎无熵。
  // 多一步 splitmix64-style 折叠，让 (0,0) 也有完整 mix。
  let s = (mapSeed ^ ((y * mapWidth + x) * 0x9e3779b1)) >>> 0;
  s = (Math.imul(s ^ (s >>> 16), 0x21f0aaad) ^ (mapSeed | 1)) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 任意 Phaser Graphics 的最小子集——单元测试中可传入 mock。
 * 不依赖 Phaser 类型，避免测试中拉 WebGL/canvas。
 */
export interface TextureTarget {
  fillStyle(color: number, alpha?: number): TextureTarget;
  fillRect(x: number, y: number, w: number, h: number): TextureTarget;
  lineStyle(width: number, color: number, alpha?: number): TextureTarget;
  lineBetween(x1: number, y1: number, x2: number, y2: number): TextureTarget;
  strokeTriangle(
    x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  ): TextureTarget;
  fillTriangle(
    x1: number, y1: number, x2: number, y2: number, x3: number, y3: number,
  ): TextureTarget;
}

/**
 * 主入口：在 (px,py) 起点的 size×size 像素方块上画一层 terrain 对应纹理。
 * 调用方负责 g.clear() / 最外层 fillRect 已画好。本函数只追加 strokes。
 */
export function drawTerrainHatching(
  g: TextureTarget,
  terrain: Terrain,
  px: number,
  py: number,
  size: number,
  mapSeed: number,
  tx: number,
  ty: number,
  mapWidth: number,
): void {
  const prng = makeTilePrng(mapSeed, tx, ty, mapWidth);
  switch (terrain) {
    case 'plain': drawPlainDots(g, px, py, size, prng); return;
    case 'hills': drawHillsDiagonals(g, px, py, size, prng); return;
    case 'forest': drawForestStipple(g, px, py, size, prng); return;
    case 'river': drawRiverWaves(g, px, py, size, prng); return;
    case 'mountain': drawMountainPeak(g, px, py, size, prng); return;
    default: return;
  }
}

// ---- 五型纹理实现 ----------------------------------------------------------

/** plain：3-5 颗 1×1 INK 浅点 */
function drawPlainDots(g: TextureTarget, px: number, py: number, size: number, prng: () => number): void {
  const count = 3 + Math.floor(prng() * 3); // 3..5
  g.fillStyle(COLORS.INK, 0.10);
  for (let i = 0; i < count; i++) {
    const dx = Math.floor(prng() * (size - 2)) + 1;
    const dy = Math.floor(prng() * (size - 2)) + 1;
    g.fillRect(px + dx, py + dy, 1, 1);
  }
}

/** hills：2-3 条短斜线（45°），暗示丘脊 */
function drawHillsDiagonals(g: TextureTarget, px: number, py: number, size: number, prng: () => number): void {
  const strokes = 2 + Math.floor(prng() * 2); // 2..3
  g.lineStyle(1, COLORS.INK, 0.18);
  for (let i = 0; i < strokes; i++) {
    const len = 3 + Math.floor(prng() * 3); // 3..5
    const sx = Math.floor(prng() * (size - len - 1)) + 1;
    const sy = Math.floor(prng() * (size - len - 1)) + 1;
    g.lineBetween(px + sx, py + sy + len, px + sx + len, py + sy);
  }
}

/** forest：6-9 颗暗色 stipple 点 + 1 小三角（林冠形态） */
function drawForestStipple(g: TextureTarget, px: number, py: number, size: number, prng: () => number): void {
  const count = 6 + Math.floor(prng() * 4); // 6..9
  g.fillStyle(COLORS.INK, 0.20);
  for (let i = 0; i < count; i++) {
    const dx = Math.floor(prng() * (size - 2)) + 1;
    const dy = Math.floor(prng() * (size - 2)) + 1;
    g.fillRect(px + dx, py + dy, 1, 1);
  }
  // 一棵小三角（树冠暗示）
  if (size >= 12) {
    const tx = Math.floor(prng() * (size - 6)) + 3;
    const ty = Math.floor(prng() * (size - 6)) + 3;
    g.fillStyle(COLORS.INK, 0.30);
    g.fillTriangle(
      px + tx, py + ty + 3,
      px + tx + 3, py + ty + 3,
      px + tx + 1, py + ty,
    );
  }
}

/** river：2 条横向波浪线（zigzag），偏 PAPER 浅色，水光感 */
function drawRiverWaves(g: TextureTarget, px: number, py: number, size: number, prng: () => number): void {
  g.lineStyle(1, COLORS.PAPER, 0.30);
  const lines = 2;
  for (let i = 0; i < lines; i++) {
    // 错位：第一条偏上、第二条偏下，有相位差
    const baseY = Math.floor(size * (0.30 + i * 0.35)) + Math.floor(prng() * 2);
    const amp = 1;
    let prevX = 1;
    let prevY = py + baseY;
    // step=2 在 16px tile 上画出 ~7 段波纹，比 step=3 的 4 段更接近"水波"的视觉密度
    // （DeepSeek 二审 nit）。同时随 size 自适应：>24px 切 3，避免巨幅 tile 过密。
    const step = size >= 24 ? 3 : 2;
    for (let x = 1 + step; x < size - 1; x += step) {
      const yOff = ((x / step) % 2 === 0 ? amp : -amp);
      const newY = py + baseY + yOff;
      g.lineBetween(px + prevX, prevY, px + x, newY);
      prevX = x;
      prevY = newY;
    }
  }
}

/** mountain：中央三角峰（中线对称的山形线），加 1 条山脊阴影 */
function drawMountainPeak(g: TextureTarget, px: number, py: number, size: number, prng: () => number): void {
  // 主峰：上窄下宽的三角形 stroke
  const cx = Math.floor(size / 2);
  const peakOffset = Math.floor(prng() * 2) - 1; // -1, 0, 1 微抖
  const top = Math.floor(size * 0.20);
  const bot = Math.floor(size * 0.80);
  const halfBase = Math.floor(size * 0.30);
  g.lineStyle(1, COLORS.INK, 0.35);
  g.strokeTriangle(
    px + cx + peakOffset, py + top,            // 峰顶
    px + cx - halfBase, py + bot,              // 左底
    px + cx + halfBase, py + bot,              // 右底
  );
  // 山脊阴影：左半山从峰往左下一条暗线
  g.lineStyle(1, COLORS.INK, 0.20);
  g.lineBetween(
    px + cx + peakOffset, py + top + 1,
    px + cx - Math.floor(halfBase / 2), py + bot - 1,
  );
}
