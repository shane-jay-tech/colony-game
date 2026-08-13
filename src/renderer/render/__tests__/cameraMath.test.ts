import { describe, it, expect } from 'vitest';
import {
  fitZoomFor, coverZoomFor, closeZoomFor, clampScrollFor, scrollForZoomAtAnchor, clampZoom,
  MAP_ZOOM_MIN, MAP_ZOOM_MAX,
} from '../cameraMath';

/**
 * P1-6 相机数学纯函数测试（fit/cover/close/clamp/锚点缩放/NaN 防护）。
 */

describe('cameraMath — fit/cover/close', () => {
  it('fit：地图更大 → 小于 1；视口更大 → 大于 1（clamp 到 2.0）', () => {
    expect(fitZoomFor(1000, 800, 4000, 2000)).toBeCloseTo(0.25);
    expect(fitZoomFor(4000, 2000, 1000, 800)).toBeCloseTo(2.0); // clamp 上限
  });

  it('cover：取较大比例（铺满）', () => {
    // 视口 1000×800，地图 4000×2000：宽比 0.25、高比 0.4 → cover=0.4
    expect(coverZoomFor(1000, 800, 4000, 2000)).toBeCloseTo(0.4);
  });

  it('退化视口/地图 → 0.2 兜底，不产 NaN', () => {
    expect(fitZoomFor(0, 800, 4000, 2000)).toBe(0.2);
    expect(coverZoomFor(1000, 800, 0, 2000)).toBe(0.2);
  });

  it('close：建筑包围盒/目标数驱动，clamp 到 [cover, 2.0]', () => {
    const cover = coverZoomFor(1000, 800, 4000, 2000); // 0.4
    const z = closeZoomFor(1000, 800, 96, 48, 25, cover);
    expect(z).toBeGreaterThanOrEqual(cover);
    expect(z).toBeLessThanOrEqual(MAP_ZOOM_MAX);
    expect(Number.isFinite(z)).toBe(true);
  });
});

describe('cameraMath — clampScrollFor', () => {
  const vp = { x: 100, y: 100, w: 800, h: 600 };

  it('地图大于视口：cur 在合法范围内不动', () => {
    const r = clampScrollFor(500, 300, vp, 1, 0, 0, 2000, 1000);
    expect(r).toEqual({ x: 500, y: 300 });
  });

  it('地图大于视口：cur 越界被拉回边界', () => {
    const r = clampScrollFor(5000, 300, vp, 1, 0, 0, 2000, 1000);
    expect(r.x).toBe(2000 - (vp.x + vp.w)); // 1100
    expect(r.y).toBe(300);
  });

  it('地图小于视口：该轴居中', () => {
    const r = clampScrollFor(0, 0, vp, 1, 0, 0, 500, 300);
    expect(r.x).toBeCloseTo(250 - (vp.x + vp.w / 2)); // 居中
    expect(r.y).toBeCloseTo(150 - (vp.y + vp.h / 2));
  });
});

describe('cameraMath — 锚点缩放与 clamp', () => {
  it('锚点世界坐标在缩放前后不变', () => {
    const next = scrollForZoomAtAnchor(500, 400, 1, 2, 100, 50);
    // 世界点 (600, 450) 缩放后仍落在屏幕 (500,400)：scroll = 600 - 250 = 350；450 - 200 = 250
    expect(next.x).toBeCloseTo(350);
    expect(next.y).toBeCloseTo(250);
  });

  it('clampZoom：NaN 回退 1，越界被钳制', () => {
    expect(clampZoom(Number.NaN, MAP_ZOOM_MIN, MAP_ZOOM_MAX)).toBe(1);
    expect(clampZoom(99, MAP_ZOOM_MIN, MAP_ZOOM_MAX)).toBe(MAP_ZOOM_MAX);
    expect(clampZoom(0.01, MAP_ZOOM_MIN, MAP_ZOOM_MAX)).toBe(MAP_ZOOM_MIN);
    expect(clampZoom(1.2, MAP_ZOOM_MIN, MAP_ZOOM_MAX)).toBe(1.2);
  });
});
