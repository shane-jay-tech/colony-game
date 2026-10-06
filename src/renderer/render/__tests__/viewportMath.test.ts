/**
 * R3 视口反向映射测试（c924-27）。用例名对齐材料档
 * docs/insights/colony-maprenderer-viewport-material-20260922.md 第五节的
 * T1（mask 屏幕不变性）/ T2（退化视口）/ T6（与 isoToGrid 相等）/ T7（null 而非夹边），
 * 另加两段的「与提取前内联式逐位对拍」和一处 MapRenderer 调用点接线桩
 * （除最后那节，其余用例零 Phaser、零 mock scene）。
 */
import { describe, it, expect, vi } from 'vitest';
import { clampScrollFor } from '../cameraMath';
import { readScroll, readZoom, worldRectForMask, worldToGridCell } from '../viewportMath';
import { gridToIso, gridCenterToIso, isoToGrid, ISO_TILE_W, ISO_TILE_H } from '../iso';
import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';
import { UI } from '../../../shared/palette';

describe('viewportMath — worldRectForMask（screen 视口 → 世界矩形）', () => {
  const vp = { x: 100, y: 80, w: 800, h: 600 };

  it('z=1 且 scroll=0：恒等于视口矩形', () => {
    expect(worldRectForMask(vp, 1, 0, 0)).toEqual(vp);
  });

  it('mask 屏幕不变性：世界矩形的 4 角经相机正向变换 (world-scroll)*z 落回 vp 4 角', () => {
    const scrolls: Array<[number, number]> = [[0, 0], [-321.5, 77.25], [1200, -800]];
    for (const z of [0.08, 0.25, 1, 1.5, 2]) {
      for (const [sx, sy] of scrolls) {
        const r = worldRectForMask(vp, z, sx, sy);
        const back = (wx: number, wy: number) => ({ x: (wx - sx) * z, y: (wy - sy) * z });
        const corners = [
          [r.x, r.y, vp.x, vp.y],
          [r.x + r.w, r.y, vp.x + vp.w, vp.y],
          [r.x, r.y + r.h, vp.x, vp.y + vp.h],
          [r.x + r.w, r.y + r.h, vp.x + vp.w, vp.y + vp.h],
        ] as const;
        for (const [wx, wy, ex, ey] of corners) {
          expect(back(wx, wy).x).toBeCloseTo(ex, 6);
          expect(back(wx, wy).y).toBeCloseTo(ey, 6);
        }
      }
    }
  });

  it('scroll 补偿在除法之后加回（不是 (vp.x+scroll)/z）', () => {
    const r = worldRectForMask(vp, 2, 30, 40);
    expect(r.x).toBe(80);   // 100/2 + 30；误写成 (100+30)/2 会是 65
    expect(r.y).toBe(80);   // 80/2 + 40；误写成 (80+40)/2 会是 60
    expect(r.w).toBe(400);  // 800/2；误乘 z 会是 1600
    expect(r.h).toBe(300);
  });

  it('zoom 退化（0 / NaN / undefined）→ 按 1 处理，不产 Infinity 或 NaN', () => {
    const identity = worldRectForMask(vp, 1, 5, 5);
    expect(worldRectForMask(vp, 0, 5, 5)).toEqual(identity);
    expect(worldRectForMask(vp, Number.NaN, 5, 5)).toEqual(identity);
    expect(worldRectForMask(vp, undefined, 5, 5)).toEqual(identity);
  });

  it('scroll 退化（NaN / undefined）→ 按 0 处理', () => {
    expect(worldRectForMask(vp, 2, 0, 0)).toEqual(worldRectForMask(vp, 2, Number.NaN, undefined));
  });

  it('退化视口（w/h=0）不产 Infinity/NaN（呼应 refreshViewportMask 的 hotfix#4）', () => {
    const r = worldRectForMask({ x: 0, y: 0, w: 0, h: 0 }, 2, 10, 20);
    expect(r).toEqual({ x: 10, y: 20, w: 0, h: 0 });
  });

  it('贴边：cover 主导轴 clamp 区间塌缩为一点（T2 贴边界，c1007-02 溯源结论的纯函数钉）', () => {
    // 80×80 图、vp.h=696：cover=max(798/7680, 696/3840)=0.18125 → Y 轴贴合
    // ⇒ clampScrollFor 的 Y 区间 min==max（scrollY 唯一合法值，即 c1007-02 的 -2005.7 形态）
    const z = 696 / 3840;
    const originY = -1476;
    const mapPxH = 3840;
    const vp = { x: 272, y: 96, w: 798, h: 696 };
    const r = clampScrollFor(0, 0, vp, z, -3169, originY, 7680, mapPxH);
    const minY = originY - vp.y / z;
    const maxY = originY + mapPxH - (vp.y + vp.h) / z;
    expect(minY).toBeCloseTo(maxY, 0);          // Y 贴边＝区间塌缩
    expect(r.y).toBeCloseTo(minY, 0);           // scrollY 收敛到塌缩点
    expect(r.x).toBeGreaterThan(Math.min(-4669, 0)); // X 非主导轴仍有区间（不塌缩）
  });
  it('出界：scroll 极大偏移下世界矩形整体移位但宽高不变（T2 出边界，c1007-04）', () => {
    const r1 = worldRectForMask({ x: 100, y: 80, w: 800, h: 600 }, 2, 10, 20);
    const r2 = worldRectForMask({ x: 100, y: 80, w: 800, h: 600 }, 2, 10 + 1e6, 20 + 5e5);
    expect(r2.w).toBe(r1.w);              // 尺寸只随 zoom，不随 scroll
    expect(r2.h).toBe(r1.h);
    expect(r2.x - r1.x).toBeCloseTo(1e6, 0);   // 平移量=scroll 差（补偿加回在除法后）
    expect(r2.y - r1.y).toBeCloseTo(5e5, 0);
  });
});

describe('viewportMath — worldToGridCell（world → 整数格子，越界 null）', () => {
  const originX = 37;
  const originY = -11;
  const isoOffsetX = 211;
  const W = 8;
  const H = 8;
  const at = (sx: number, sy: number) =>
    worldToGridCell(sx + originX + isoOffsetX, sy + originY, originX, originY, isoOffsetX, W, H);

  const cells: Array<[number, number]> = [[0, 0], [1, 0], [0, 1], [3, 4], [7, 7], [5, 2]];

  it('tile 顶点世界坐标 → 原格（且 origin/isoOffsetX 平移真的被减掉了）', () => {
    for (const [gx, gy] of cells) {
      const v = gridToIso(gx, gy);
      expect(at(v.sx, v.sy)).toEqual({ x: gx, y: gy });
    }
  });

  it('tile 中心 → 同格：取整口径是 floor 而非 round', () => {
    for (const [gx, gy] of [[0, 0], [3, 4], [7, 7]] satisfies Array<[number, number]>) {
      const c = gridCenterToIso(gx, gy);
      expect(at(c.sx, c.sy)).toEqual({ x: gx, y: gy }); // round 会跳到 (gx+1, gy+1)
    }
  });

  it('格子外返回 null 而不是夹回边界（T7：与 viewportCenterTile 的夹边语义不可合并）', () => {
    expect(at(-48, -24)).toBeNull();            // gx = -1
    expect(at(0, 24 * (W + H))).toBeNull();     // gx/gy 双双越界
    expect(at(gridToIso(W, 0).sx, gridToIso(W, 0).sy)).toBeNull(); // gx = width 越右界
    expect(at(gridToIso(0, H).sx, gridToIso(0, H).sy)).toBeNull(); // gy = height 越下界
    // 远离菱形的点（gy 冲到 40）同样 null，不返边界格
    expect(at(-48 * 40, 24 * 40)).toBeNull();
  });

  it('非有限输入（NaN / ±Infinity）→ null', () => {
    expect(worldToGridCell(Number.NaN, 0, originX, originY, isoOffsetX, W, H)).toBeNull();
    expect(worldToGridCell(0, Number.NaN, originX, originY, isoOffsetX, W, H)).toBeNull();
    expect(worldToGridCell(Number.POSITIVE_INFINITY, 0, originX, originY, isoOffsetX, W, H)).toBeNull();
    expect(worldToGridCell(0, Number.NEGATIVE_INFINITY, originX, originY, isoOffsetX, W, H)).toBeNull();
  });

  it('界内点与 iso.ts 权威逆投影 isoToGrid 逐点相等（三份抄本并一的收口钉 T6）', () => {
    for (let gx = 0; gx < W; gx++) {
      for (let gy = 0; gy < H; gy++) {
        const v = gridToIso(gx, gy);
        const ref = isoToGrid(v.sx + 5, v.sy + 3);
        expect(at(v.sx + 5, v.sy + 3)).toEqual({ x: ref.gx, y: ref.gy });
      }
    }
  });

  it('现状桩：origin 自身非有限时越界判定失效，会漏出 NaN 格（记录缺陷而非认可）', () => {
    expect(worldToGridCell(0, 0, Number.NaN, originY, isoOffsetX, W, H)).toEqual({ x: Number.NaN, y: Number.NaN });
  });
});

/**
 * 行为等价的**地面真值**对拍：右式是提取前 `MapRenderer.ts` 里的内联原文（逐字照抄），
 * 左式是提取后的纯函数。零行为变化这条判据就钉在这里，不靠人工比对。
 */
describe('viewportMath — 与提取前 MapRenderer 内联式逐位对拍', () => {
  const lcg = (seed: number) => {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000);
  };

  it('A：worldRectForMask ≡ `vp.x / z + sx`（z=cam.zoom||1，sx/sy=cam.scrollX/Y||0）', () => {
    const rnd = lcg(20260925);
    const weird: Array<number | undefined> = [undefined, Number.NaN, 0, -0, 0.08, 1, 2, 5.5];
    for (let i = 0; i < 400; i++) {
      const vp = {
        x: Math.floor(rnd() * 400), y: Math.floor(rnd() * 200),
        w: Math.floor(rnd() * 2000), h: Math.floor(rnd() * 1200),
      };
      const zoom = weird[Math.floor(rnd() * weird.length)!]!;
      const scrollX = weird[Math.floor(rnd() * weird.length)!]!;
      const scrollY = weird[Math.floor(rnd() * weird.length)!]!;
      const z = zoom || 1;
      const sx = scrollX || 0;
      const sy = scrollY || 0;
      expect(worldRectForMask(vp, zoom, scrollX, scrollY)).toEqual({
        x: vp.x / z + sx, y: vp.y / z + sy, w: vp.w / z, h: vp.h / z,
      });
    }
  });

  it('E：worldToGridCell ≡ 原 `lx/ISO_HW … floor … 越界 null` 内联式', () => {
    const ISO_HW = ISO_TILE_W / 2;
    const ISO_HH = ISO_TILE_H / 2;
    const rnd = lcg(987654321);
    for (let i = 0; i < 400; i++) {
      const ox = (rnd() - 0.5) * 4000, oy = (rnd() - 0.5) * 4000;
      const oX = Math.floor(rnd() * 600) - 300, oY = Math.floor(rnd() * 600) - 300;
      const off = Math.floor(rnd() * 500);
      const w = 1 + Math.floor(rnd() * 12), h = 1 + Math.floor(rnd() * 12);
      // 提取前 MapRenderer.screenToGrid 的原文（screen 实为 world 坐标）
      const inline = (screenX: number, screenY: number): { x: number; y: number } | null => {
        if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
        const lx = screenX - oX - off;
        const ly = screenY - oY;
        const a = lx / ISO_HW;
        const bb = ly / ISO_HH;
        const x = Math.floor((a + bb) / 2);
        const y = Math.floor((bb - a) / 2);
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        return { x, y };
      };
      const pts: Array<[number, number]> = [];
      for (let k = 0; k < 4; k++) {
        // 以连续格坐标反推世界点：既覆盖界内也覆盖界外（gridToIso 对非整格同样线性成立）
        const gxf = (rnd() - 0.15) * (w + 2), gyf = (rnd() - 0.15) * (h + 2);
        const p = gridToIso(gxf, gyf);
        pts.push([p.sx + oX + off, p.sy + oY]);
        pts.push([p.sx + oX + off + 0.5, p.sy + oY - 0.25]);
      }
      pts.push([Number.NaN, oy]);
      pts.push([ox, Number.POSITIVE_INFINITY]);
      for (const [px, py] of pts) {
        expect(worldToGridCell(px, py, oX, oY, off, w, h)).toEqual(inline(px, py));
      }
    }
  });
});

/**
 * 调用点接线桩：纯函数对了不代表 MapRenderer 传参对了。本节钉 refreshViewportMask
 * 交给 worldRectForMask 的确实是**当前相机**的 zoom/scrollX/scrollY，且画出来的确实是返回矩形
 * （既有 MapRenderer 测试族只读相机三个数，从未看过 mask 的 fillRect 参数——这条是补的空位）。
 */
describe('viewportMath — MapRenderer.refreshViewportMask 调用点接线', () => {
  type Spy = ReturnType<typeof vi.fn>;
  interface ChainGO { [key: string]: unknown; fillRect: Spy; createGeometryMask: Spy }

  const NOOP_METHODS = [
    'clear', 'fillStyle', 'lineStyle', 'strokeRect', 'fillCircle', 'strokeCircle', 'fillPoints',
    'strokePoints', 'fillTriangle', 'strokeTriangle', 'beginPath', 'moveTo', 'lineTo', 'closePath',
    'strokePath', 'fillPath', 'generateTexture', 'setOrigin', 'setDepth', 'setVisible',
    'setScrollFactor', 'setInteractive', 'disableInteractive', 'setPosition', 'setScale', 'setSize',
    'setDisplaySize', 'setRotation', 'setAlpha', 'setTint', 'setFlipX', 'setFrame', 'setTexture',
    'setName', 'setText', 'setColor', 'setStyle', 'setFontSize', 'setLineSpacing', 'setWordWrapWidth',
    'setPadding', 'setShadow', 'setBlendMode', 'setMask', 'clearMask', 'setResolution', 'play', 'stop',
  ];

  function makeChainGO(): ChainGO {
    const shared = vi.fn().mockReturnThis();
    const go: Record<string, unknown> = {
      x: 0, y: 0, width: 16, height: 16, visible: true, alpha: 1, text: '',
      destroy: vi.fn(),
      createGeometryMask: vi.fn(() => ({ destroy: vi.fn() })),
    };
    for (const m of NOOP_METHODS) go[m] = shared;
    // fillRect 必须是独立 spy：接线桩要读的正是它的入参
    go.fillRect = vi.fn().mockReturnThis();
    return go as unknown as ChainGO;
  }

  /** 视口矩形（与 MapRenderer.computeViewportRect 同一套 inset 口径，panelSource 为空＝两侧展开） */
  function expectedVp(camW: number, camH: number) {
    const leftInset = 8 + UI.buildPanelWidth + 8;
    const rightInset = UI.rightPanelWidth + 8 + 8;
    const topInset = UI.topbarHeight + UI.toolbarHeight + 8;
    return {
      x: leftInset, y: topInset,
      w: Math.max(0, camW - leftInset - rightInset),
      h: Math.max(0, camH - topInset - 8),
    };
  }

  function makeWiredRenderer() {
    const graphics: ChainGO[] = [];
    const cam = {
      width: 1366, height: 800, zoom: 1, scrollX: 0, scrollY: 0,
      setBackgroundColor: vi.fn(), setZoom: vi.fn() as unknown as Spy,
    };
    cam.setZoom = vi.fn((z: number) => { cam.zoom = z; return cam; }) as unknown as Spy;
    const go = () => { const g = makeChainGO(); graphics.push(g); return g; };
    const scene = {
      cameras: { main: cam },
      textures: { exists: vi.fn(() => false), get: vi.fn() },
      add: { graphics: vi.fn(go), text: vi.fn(go), image: vi.fn(go), tileSprite: vi.fn(go) },
      make: { graphics: vi.fn(go), geometryMask: vi.fn(() => ({ destroy: vi.fn() })) },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
      time: { delayedCall: vi.fn(), addEvent: vi.fn(() => ({ remove: vi.fn() })) },
      load: { texture: vi.fn() },
      cache: { json: { get: vi.fn() }, audio: { exists: vi.fn(() => false) } },
      sound: { add: vi.fn(), play: vi.fn(), stop: vi.fn() },
      events: { once: vi.fn(), on: vi.fn(), off: vi.fn() },
    };
    const tiles = Array.from({ length: 80 * 80 }, () => ({
      terrain: 'plain' as const, buildable: true, walkable: true,
    }));
    const map: WorldMap = { width: 80, height: 80, resourceNodes: [], seed: 0, tiles };
    const renderer = new MapRenderer(scene as never, new WorldMapAccessor(map));
    const maskOwners = graphics.filter((g) => g.createGeometryMask.mock.calls.length > 0);
    expect(maskOwners.length).toBe(1);            // 只有一个 geometryMask 形状源
    return { renderer, cam, mask: maskOwners[0]! };
  }

  /** 提取前 refreshViewportMask 画的那个矩形，按当时的相机读数手算一遍。 */
  function inlineMaskRect(cam: { zoom: number; scrollX: number; scrollY: number }) {
    const vp = expectedVp(1366, 800);
    const z = cam.zoom || 1;
    const sx = cam.scrollX || 0;
    const sy = cam.scrollY || 0;
    return [vp.x / z + sx, vp.y / z + sy, vp.w / z, vp.h / z];
  }

  it('panBy 之后：mask 的 fillRect 参数 ≡ 手算的反除 zoom＋加 scroll 矩形', () => {
    const { renderer, cam, mask } = makeWiredRenderer();
    renderer.panBy(40, 25);
    const args = (mask.fillRect.mock.lastCall as unknown as number[]).slice(0, 4);
    expect(args).toEqual(inlineMaskRect(cam));
    expect(args.every((n) => Number.isFinite(n))).toBe(true);
  });

  it('相机读数变了 mask 矩形就跟着变（传的是当前 cam 三读数，不是构造期快照）', () => {
    const { renderer, cam, mask } = makeWiredRenderer();
    renderer.panBy(40, 25);
    const first = (mask.fillRect.mock.lastCall as unknown as number[]).slice(0, 4);

    cam.zoom = 0.7;
    cam.scrollX = -820.5;
    cam.scrollY = 333;
    renderer.panBy(0, 0);
    const second = (mask.fillRect.mock.lastCall as unknown as number[]).slice(0, 4);

    expect(second).toEqual(inlineMaskRect(cam));
    expect(second).not.toEqual(first);
    // 屏幕不变性：世界矩形再经相机正向变换要落回同一个 screen 视口
    const vp = expectedVp(1366, 800);
    expect((second[0]! - cam.scrollX) * cam.zoom).toBeCloseTo(vp.x, 6);
    expect(second[2]! * cam.zoom).toBeCloseTo(vp.w, 6);
  });
});

describe('viewportMath — H 段 readZoom/readScroll（c1007-03 提纯；契约 1 口径）', () => {
  it('zoom 的 0/NaN/undefined → 1；正常值与负值原样透传', () => {
    expect(readZoom({ zoom: 0 })).toBe(1);          // 0 是 falsy：旧 || 口径即兜 1
    expect(readZoom({ zoom: NaN })).toBe(1);
    expect(readZoom({})).toBe(1);
    expect(readZoom({ zoom: 0.1812 })).toBe(0.1812);
    expect(readZoom({ zoom: -2 })).toBe(-2);        // 负值透传（契约 1：不新增判断）
  });

  it('scroll 的 NaN/undefined → 0；负值原样透传（构造态 -2005.66 形态）', () => {
    expect(readScroll({ scrollX: NaN, scrollY: undefined })).toEqual({ x: 0, y: 0 });
    expect(readScroll({})).toEqual({ x: 0, y: 0 });
    expect(readScroll({ scrollX: -2005.66, scrollY: -3079.07 }))
      .toEqual({ x: -2005.66, y: -3079.07 });
  });

  it('与提取前内联式逐位对拍（同输入同输出）', () => {
    const cam = { zoom: 2.5, scrollX: -100.5, scrollY: 7.25 };
    const legacyZ = (cam.zoom as number | undefined) || 1;
    const legacyX = (cam.scrollX as number | undefined) || 0;
    const legacyY = (cam.scrollY as number | undefined) || 0;
    expect(readZoom(cam)).toBe(legacyZ);
    expect(readScroll(cam)).toEqual({ x: legacyX, y: legacyY });
  });
});
