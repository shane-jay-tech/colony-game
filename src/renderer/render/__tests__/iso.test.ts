import { describe, it, expect } from 'vitest';
import {
  gridToIso, gridCenterToIso, isoToGrid, isoToGridF, isoMapBounds,
  ISO_TILE_W, ISO_TILE_H,
} from '../iso';

describe('等距投影 iso.ts', () => {
  it('原点格子 (0,0) → 屏幕原点', () => {
    expect(gridToIso(0, 0)).toEqual({ sx: 0, sy: 0 });
  });

  it('沿 +x 向屏幕右下、沿 +y 向屏幕左下（菱形朝向正确）', () => {
    expect(gridToIso(1, 0)).toEqual({ sx: ISO_TILE_W / 2, sy: ISO_TILE_H / 2 });   // 右下
    expect(gridToIso(0, 1)).toEqual({ sx: -ISO_TILE_W / 2, sy: ISO_TILE_H / 2 });  // 左下
    expect(gridToIso(1, 1)).toEqual({ sx: 0, sy: ISO_TILE_H });                    // 正下
  });

  it('gridToIso → isoToGridF 往返一致（顶点）', () => {
    for (const [gx, gy] of [[0, 0], [3, 5], [7, 2], [12, 9], [40, 40]]) {
      const p = gridToIso(gx!, gy!);
      const back = isoToGridF(p.sx, p.sy);
      expect(back.gx).toBeCloseTo(gx!, 6);
      expect(back.gy).toBeCloseTo(gy!, 6);
    }
  });

  it('isoToGrid 对 tile 内部任意点都 floor 回该格', () => {
    // tile(3,4) 顶点 + 小偏移仍落在 (3,4)
    const p = gridToIso(3, 4);
    expect(isoToGrid(p.sx + 1, p.sy + 1)).toEqual({ gx: 3, gy: 4 });
    // 菱形中心点也应落在 (3,4)
    const c = gridCenterToIso(3, 4);
    expect(isoToGrid(c.sx, c.sy - 0.01)).toEqual({ gx: 3, gy: 4 });
  });

  it('gridCenterToIso 比顶点低半个 tile 高（中心在菱形中部）', () => {
    const v = gridToIso(2, 2);
    const c = gridCenterToIso(2, 2);
    expect(c.sx).toBe(v.sx);
    expect(c.sy).toBe(v.sy + ISO_TILE_H / 2);
  });

  it('isoMapBounds：菱形包围盒尺寸正确', () => {
    const b = isoMapBounds(10, 10);
    expect(b.pxW).toBe(20 * (ISO_TILE_W / 2)); // (10+10)*32 = 640
    expect(b.pxH).toBe(20 * (ISO_TILE_H / 2)); // (10+10)*16 = 320
    expect(b.minSx).toBe(-9 * (ISO_TILE_W / 2)); // 最后一行最左
  });
});
