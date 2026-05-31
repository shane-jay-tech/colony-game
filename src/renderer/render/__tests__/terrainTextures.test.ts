/**
 * terrainTextures 单测：Slice H 古纸纹理叠层。
 *
 * 关键性质：
 *   - 5 种 terrain 各调用一次都不抛异常（基本 smoke）
 *   - 同一 (seed, x, y) → 同一 stroke 序列（确定性）
 *   - 不同 seed → 不同 stroke 序列（高概率）
 *   - 只用 palette 锁定的颜色（不引入第 12 色相）
 */
import { describe, it, expect, vi } from 'vitest';
import { drawTerrainHatching, type TextureTarget } from '../terrainTextures';
import { COLORS } from '../../ui/palette';
import type { Terrain } from '../../data/mapSchema';

function makeFakeTarget(): TextureTarget & {
  fills: Array<{ color: number; alpha: number | undefined }>;
  lines: Array<{ color: number; alpha: number | undefined }>;
  fillRectCount: number;
  lineBetweenCount: number;
  triangleCount: number;
} {
  const fills: Array<{ color: number; alpha: number | undefined }> = [];
  const lines: Array<{ color: number; alpha: number | undefined }> = [];
  let fillRectCount = 0;
  let lineBetweenCount = 0;
  let triangleCount = 0;
  const t: ReturnType<typeof makeFakeTarget> = {
    fillStyle: vi.fn((color: number, alpha?: number) => {
      fills.push({ color, alpha });
      return t;
    }) as never,
    fillRect: vi.fn(() => {
      fillRectCount++;
      t.fillRectCount = fillRectCount;
      return t;
    }) as never,
    lineStyle: vi.fn((width: number, color: number, alpha?: number) => {
      lines.push({ color, alpha });
      return t;
    }) as never,
    lineBetween: vi.fn(() => {
      lineBetweenCount++;
      t.lineBetweenCount = lineBetweenCount;
      return t;
    }) as never,
    strokeTriangle: vi.fn(() => {
      triangleCount++;
      t.triangleCount = triangleCount;
      return t;
    }) as never,
    fillTriangle: vi.fn(() => {
      triangleCount++;
      t.triangleCount = triangleCount;
      return t;
    }) as never,
    fills,
    lines,
    fillRectCount: 0,
    lineBetweenCount: 0,
    triangleCount: 0,
  };
  return t;
}

const TERRAINS: Terrain[] = ['plain', 'hills', 'forest', 'river', 'mountain'];

describe('drawTerrainHatching — smoke (no throws on any terrain)', () => {
  for (const terrain of TERRAINS) {
    it(`${terrain} draws without throwing`, () => {
      const t = makeFakeTarget();
      expect(() => drawTerrainHatching(t, terrain, 0, 0, 16, 12345, 3, 4, 8)).not.toThrow();
      // 至少要画点东西（hatching 不能完全空跑）
      const totalCalls = t.fillRectCount + t.lineBetweenCount + t.triangleCount;
      expect(totalCalls).toBeGreaterThan(0);
    });
  }
});

describe('drawTerrainHatching — determinism', () => {
  it('same (seed, x, y) → identical fillRect/lineBetween counts', () => {
    for (const terrain of TERRAINS) {
      const a = makeFakeTarget();
      const b = makeFakeTarget();
      drawTerrainHatching(a, terrain, 0, 0, 16, 999, 5, 7, 16);
      drawTerrainHatching(b, terrain, 0, 0, 16, 999, 5, 7, 16);
      expect(a.fillRectCount).toBe(b.fillRectCount);
      expect(a.lineBetweenCount).toBe(b.lineBetweenCount);
      expect(a.triangleCount).toBe(b.triangleCount);
    }
  });

  it('different seed → at least one terrain produces different output (high probability)', () => {
    // plain 和 forest 的 dot count 都依赖 prng() — 不同 seed 应有差异
    const seedA = 1;
    const seedB = 999_999;
    let differs = 0;
    for (const terrain of TERRAINS) {
      const a = makeFakeTarget();
      const b = makeFakeTarget();
      drawTerrainHatching(a, terrain, 0, 0, 16, seedA, 0, 0, 8);
      drawTerrainHatching(b, terrain, 0, 0, 16, seedB, 0, 0, 8);
      if (a.fillRectCount !== b.fillRectCount || a.lineBetweenCount !== b.lineBetweenCount) {
        differs++;
      }
    }
    expect(differs).toBeGreaterThan(0);
  });
});

describe('drawTerrainHatching — color discipline', () => {
  it('every fillStyle/lineStyle color is from the locked palette', () => {
    // palette = 11 锁定色（含 BG_INK），任何 hatching 用色必须落在这 11 个里
    const allowed = new Set<number>(Object.values(COLORS));
    for (const terrain of TERRAINS) {
      const t = makeFakeTarget();
      // 多个 tile 跑一遍，覆盖所有分支
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
          drawTerrainHatching(t, terrain, 0, 0, 16, 7, x, y, 4);
        }
      }
      for (const f of t.fills) {
        expect(allowed.has(f.color), `${terrain}: fillStyle ${f.color.toString(16)} not in palette`).toBe(true);
        expect(f.alpha, `${terrain} fillStyle alpha`).toBeLessThanOrEqual(0.4);
      }
      for (const l of t.lines) {
        expect(allowed.has(l.color), `${terrain}: lineStyle ${l.color.toString(16)} not in palette`).toBe(true);
        expect(l.alpha, `${terrain} lineStyle alpha`).toBeLessThanOrEqual(0.4);
      }
    }
  });
});

describe('drawTerrainHatching — geometry sanity', () => {
  it('mountain calls strokeTriangle exactly once (the peak)', () => {
    const t = makeFakeTarget();
    drawTerrainHatching(t, 'mountain', 0, 0, 16, 42, 0, 0, 4);
    // 主峰是 strokeTriangle，外加一条 lineBetween（山脊阴影）
    expect(t.triangleCount).toBe(1);
    expect(t.lineBetweenCount).toBe(1);
  });

  it('river never uses fillRect (only lineBetween waves)', () => {
    const t = makeFakeTarget();
    drawTerrainHatching(t, 'river', 0, 0, 16, 1, 0, 0, 4);
    expect(t.fillRectCount).toBe(0);
    expect(t.lineBetweenCount).toBeGreaterThan(0);
  });

  it('forest produces more dots than plain (denser stipple)', () => {
    // 同一 seed/coord 比同等条件下 forest > plain 的 fillRect
    let plainTotal = 0;
    let forestTotal = 0;
    for (let i = 0; i < 4; i++) {
      const p = makeFakeTarget();
      const f = makeFakeTarget();
      drawTerrainHatching(p, 'plain', 0, 0, 16, 100 + i, i, i, 4);
      drawTerrainHatching(f, 'forest', 0, 0, 16, 100 + i, i, i, 4);
      plainTotal += p.fillRectCount;
      forestTotal += f.fillRectCount;
    }
    expect(forestTotal).toBeGreaterThan(plainTotal);
  });
});
