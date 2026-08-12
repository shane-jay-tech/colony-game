/**
 * MapRenderer 的纯逻辑层测试。Phaser scene/graphics 部分用 mock 替代——
 * 我们只验证 coordinate math 和事件路径，不验证 WebGL 渲染本身。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapRenderer, MAP_ZOOM_MAX } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';
import { TILE_SIZE } from '../mapColors';
import { UI } from '../../ui/palette';

function makeMap(w = 8, h = 8): WorldMap {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

function makeFakeGraphics() {
  const fakeMask = { destroy: vi.fn() };
  return {
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
    strokeTriangle: vi.fn().mockReturnThis(),
    fillTriangle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(),
    strokePoints: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    closePath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setMask: vi.fn().mockReturnThis(),
    clearMask: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    createGeometryMask: vi.fn(() => fakeMask),
    destroy: vi.fn(),
  };
}

interface FakeText {
  x: number; y: number; visible: boolean; text: string; alpha: number; style: Record<string, unknown>;
  fontSize: number | null; color: string;
  setOrigin: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setText: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setStyle: ReturnType<typeof vi.fn>;
  setFontSize: ReturnType<typeof vi.fn>;
  setColor: ReturnType<typeof vi.fn>;
  setDepth: ReturnType<typeof vi.fn>;
  setMask: ReturnType<typeof vi.fn>;
  clearMask: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeFakeText(): FakeText {
  const t: FakeText = {
    x: 0, y: 0, visible: true, text: '', alpha: 1, style: {}, fontSize: null, color: '',
    setOrigin: vi.fn().mockImplementation(function (this: FakeText) { return this; }),
    setPosition: vi.fn().mockImplementation(function (this: FakeText, x: number, y: number) {
      this.x = x; this.y = y; return this;
    }),
    setVisible: vi.fn().mockImplementation(function (this: FakeText, v: boolean) { this.visible = v; return this; }),
    setText: vi.fn().mockImplementation(function (this: FakeText, s: string) { this.text = s; return this; }),
    setAlpha: vi.fn().mockImplementation(function (this: FakeText, a: number) { this.alpha = a; return this; }),
    setStyle: vi.fn().mockImplementation(function (this: FakeText, s: Record<string, unknown>) {
      this.style = { ...this.style, ...s }; return this;
    }),
    setFontSize: vi.fn().mockImplementation(function (this: FakeText, n: number) { this.fontSize = n; return this; }),
    setColor: vi.fn().mockImplementation(function (this: FakeText, c: string) { this.color = c; return this; }),
    setDepth: vi.fn().mockImplementation(function (this: FakeText) { return this; }),
    setMask: vi.fn().mockImplementation(function (this: FakeText) { return this; }),
    clearMask: vi.fn().mockImplementation(function (this: FakeText) { return this; }),
    destroy: vi.fn(),
  };
  return t;
}

interface TweenConfig {
  targets: unknown;
  alpha?: number;
  duration?: number;
  onComplete?: () => void;
}

function makeFakeImage() {
  const im = {
    x: 0, y: 0, visible: true, alpha: 1, key: '', width: 256, height: 256,
    setScale: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    setOrigin: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    setPosition: vi.fn().mockImplementation(function (this: typeof im, x: number, y: number) {
      this.x = x; this.y = y; return this;
    }),
    setVisible: vi.fn().mockImplementation(function (this: typeof im, v: boolean) { this.visible = v; return this; }),
    setAlpha: vi.fn().mockImplementation(function (this: typeof im, a: number) { this.alpha = a; return this; }),
    setDisplaySize: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    setFlipX: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    setDepth: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    setTexture: vi.fn().mockImplementation(function (this: typeof im, k: string) { this.key = k; return this; }),
    setMask: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    clearMask: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    destroy: vi.fn(),
  };
  return im;
}

function makeFakeScene(camWidth = 1366, camHeight = 800, textureExists: (key: string) => boolean = () => false) {
  const graphicsCalls: ReturnType<typeof makeFakeGraphics>[] = [];
  const textCalls: FakeText[] = [];
  const imageCalls: ReturnType<typeof makeFakeImage>[] = [];
  const tweenCalls: TweenConfig[] = [];
  const fakeEmitter = { setDepth: vi.fn(), destroy: vi.fn() };
  return {
    cameras: { main: { width: camWidth, height: camHeight } },
    textures: { exists: vi.fn(textureExists) },
    make: {
      graphics: vi.fn(() => {
        const g = makeFakeGraphics();
        (g as unknown as Record<string, unknown>).generateTexture = vi.fn();
        return g;
      }),
    },
    add: {
      graphics: vi.fn(() => {
        const g = makeFakeGraphics();
        graphicsCalls.push(g);
        return g;
      }),
      text: vi.fn((_x?: number, _y?: number, content?: string) => {
        const t = makeFakeText();
        if (typeof content === 'string') t.text = content;
        textCalls.push(t);
        return t;
      }),
      image: vi.fn((_x: number, _y: number, key: string) => {
        const im = makeFakeImage();
        im.key = key;
        imageCalls.push(im);
        return im;
      }),
      particles: vi.fn(() => fakeEmitter),
    },
    tweens: {
      add: vi.fn((cfg: TweenConfig) => {
        tweenCalls.push(cfg);
        const tween = { stop: vi.fn() };
        (cfg as TweenConfig & { _tween?: { stop: ReturnType<typeof vi.fn> } })._tween = tween;
        return tween;
      }),
    },
    _graphics: graphicsCalls,
    _texts: textCalls,
    _images: imageCalls,
    _tweens: tweenCalls,
  } as never;
}

describe('MapRenderer.screenToGrid', () => {
  let renderer: MapRenderer;
  const mapW = 8;
  const mapH = 8;
  // origin 居中于"可用视口"——扣 HUD 顶栏 + 左右面板后的中央矩形（与 MapRenderer.computeOrigin 同步）
  const camW = 1366;
  const camH = 800;

  beforeEach(() => {
    const acc = new WorldMapAccessor(makeMap(mapW, mapH));
    renderer = new MapRenderer(makeFakeScene(camW, camH), acc);
  });

  it('gridToScreen(tile中心) → screenToGrid 往返回原格（等距）', () => {
    for (const [gx, gy] of [[0, 0], [1, 0], [0, 1], [3, 4], [7, 7], [5, 2]]) {
      const s = renderer.gridToScreen(gx!, gy!);
      expect(renderer.screenToGrid(s.x, s.y)).toEqual({ x: gx, y: gy });
    }
  });

  it('地图菱形之外的点返回 null', () => {
    const s = renderer.gridToScreen(0, 0);
    expect(renderer.screenToGrid(s.x - 100000, s.y)).toBeNull(); // 远左
    expect(renderer.screenToGrid(s.x, s.y - 100000)).toBeNull(); // 远上
    expect(renderer.screenToGrid(s.x + 100000, s.y)).toBeNull(); // 远右
  });

  it('returns null for NaN / Infinity inputs', () => {
    expect(renderer.screenToGrid(NaN, 0)).toBeNull();
    expect(renderer.screenToGrid(0, NaN)).toBeNull();
    expect(renderer.screenToGrid(Infinity, 0)).toBeNull();
    expect(renderer.screenToGrid(0, -Infinity)).toBeNull();
  });
});

describe('MapRenderer.gridToScreen / introspection', () => {
  it('gridToScreen is the inverse of screenToGrid for tile-centered coords', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const renderer = new MapRenderer(makeFakeScene(1366, 800), acc);
    const screen = renderer.gridToScreen(3, 4);
    // top-left of (3,4) tile, plus 1px to be strictly inside that tile
    const back = renderer.screenToGrid(screen.x + 1, screen.y + 1);
    expect(back).toEqual({ x: 3, y: 4 });
  });

  it('getTileSize / getOrigin / getDimensions surface basic geometry', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const renderer = new MapRenderer(makeFakeScene(1366, 800), acc);
    expect(renderer.getTileSize()).toBeGreaterThan(0);
    expect(renderer.getDimensions()).toEqual({ width: 8, height: 8 });
    const origin = renderer.getOrigin();
    expect(Number.isInteger(origin.x)).toBe(true);
    expect(Number.isInteger(origin.y)).toBe(true);
  });
});

describe('MapRenderer.setHoverPreview', () => {
  it('null preview clears the hover layer', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview(null);
    expect(hoverGfx.clear).toHaveBeenCalled();
    expect(hoverGfx.fillPoints).not.toHaveBeenCalled();
  });

  it('valid preview draws a green diamond (1 fillPoints + 1 strokePoints)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview({ gridX: 2, gridY: 3, w: 2, h: 2, valid: true });
    expect(hoverGfx.clear).toHaveBeenCalledTimes(1);
    expect(hoverGfx.fillPoints).toHaveBeenCalledTimes(1);
    expect(hoverGfx.strokePoints).toHaveBeenCalledTimes(1);
  });

  it('invalid preview also draws (red) — same call shape', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview({ gridX: 0, gridY: 0, w: 1, h: 1, valid: false });
    expect(hoverGfx.fillPoints).toHaveBeenCalledTimes(1);
    expect(hoverGfx.strokePoints).toHaveBeenCalledTimes(1);
  });

  it('NaN gridX / non-positive size silently clears (no throw)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview({ gridX: NaN, gridY: 0, w: 1, h: 1, valid: true });
    renderer.setHoverPreview({ gridX: 0, gridY: 0, w: 0, h: 1, valid: true });
    expect(hoverGfx.fillPoints).not.toHaveBeenCalled();
  });
});

describe('MapRenderer.bake (terrain / nodes)', () => {
  it('skips out-of-bounds resource nodes with a warning instead of drawing them', () => {
    const tiles = [];
    for (let i = 0; i < 4 * 4; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
    const map: WorldMap = {
      width: 4, height: 4, tiles, seed: 0,
      resourceNodes: [
        { kind: 'forest_node', position: { x: 1, y: 1 }, remaining: 50 }, // valid
        { kind: 'forest_node', position: { x: 99, y: 0 }, remaining: 50 }, // OOB → skip
        { kind: 'river_node', position: { x: -1, y: 0 }, remaining: 100 }, // OOB → skip
      ],
    };
    const acc = new WorldMapAccessor(map);
    const scene = makeFakeScene();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    new MapRenderer(scene, acc);
    const nodesGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[1]!;
    // only the 1 valid node should be drawn（菱形 pip：每个节点一个高光 fillCircle）
    expect(nodesGfx.fillCircle).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('calls fillRect at least once per tile + once per resource node', () => {
    const tiles = [];
    for (let i = 0; i < 4 * 4; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
    tiles[0] = { terrain: 'river' as const, buildable: false, walkable: true };
    const map: WorldMap = {
      width: 4, height: 4, tiles, seed: 0,
      resourceNodes: [
        { kind: 'river_node', position: { x: 0, y: 0 }, remaining: 100 },
        { kind: 'forest_node', position: { x: 2, y: 2 }, remaining: 50 },
      ],
    };
    const acc = new WorldMapAccessor(map);
    const scene = makeFakeScene();
    new MapRenderer(scene, acc);
    // first graphics = terrain：等距每 tile 画一个菱形 fillPoints（4×4=16 个）；
    // 河格额外画一次"深水内芯"双色填充 → 本例 1 个河格 → 16+1=17。
    const terrainGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[0]!;
    expect(terrainGfx.fillPoints.mock.calls.length).toBe(17);
    // second graphics = nodes (2 nodes)：菱形 pip 用 fillPoints（每节点 2 个：描边+本体）+ 高光 fillCircle（每节点 1）
    const nodesGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[1]!;
    expect(nodesGfx.fillPoints).toHaveBeenCalledTimes(4);
    expect(nodesGfx.fillCircle).toHaveBeenCalledTimes(2);
  });
});

describe('MapRenderer.rerenderBuildings', () => {
  it('clears and redraws each frame the method is called', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const buildingsGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[2]!;
    renderer.rerenderBuildings([]);
    expect(buildingsGfx.clear).toHaveBeenCalledTimes(1);
    renderer.rerenderBuildings([]);
    expect(buildingsGfx.clear).toHaveBeenCalledTimes(2);
  });

  it('destroy is idempotent (safe to call twice) — destroys all 5 graphics layers (4 paint + 1 viewport mask)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const gfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics;
    // v0.9 Pillar 1.1：terrainGfx + nodesGfx + buildingsGfx + hoverGfx + viewportMaskGfx
    expect(gfx).toHaveLength(5);
    renderer.destroy();
    for (let i = 0; i < 5; i++) expect(gfx[i]!.destroy).toHaveBeenCalledTimes(1);
    // second call is a no-op, must not crash or re-destroy
    renderer.destroy();
    for (let i = 0; i < 5; i++) expect(gfx[i]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('sigil pool shrinks when buildings decrease (no memory leak)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    // 3 buildings → pool grows to 3
    renderer.rerenderBuildings([
      { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
      { defId: 'bld_house', position: { x: 1, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
      { defId: 'bld_well', position: { x: 2, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ]);
    const texts = (scene as unknown as { _texts: FakeText[] })._texts;
    expect(texts).toHaveLength(3);
    // 后续只剩 1 building → pool 应缩到 1，多余的 2 个 destroy()
    renderer.rerenderBuildings([
      { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ]);
    // 后两个 text destroy 应被调用一次
    expect(texts[1]!.destroy).toHaveBeenCalledTimes(1);
    expect(texts[2]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('reusing a sigil with same fontPx + color does NOT call setFontSize/setColor (perf)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const b = { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] };
    renderer.rerenderBuildings([b]);
    const t = (scene as unknown as { _texts: FakeText[] })._texts[0]!;
    // 第一次构造时不会调 setFontSize（构造 style 已带），重置 mock 计数后第二次重画
    t.setFontSize.mockClear();
    t.setColor.mockClear();
    renderer.rerenderBuildings([b]);
    expect(t.setFontSize).not.toHaveBeenCalled();
    expect(t.setColor).not.toHaveBeenCalled();
  });

  it('reusing a sigil with status change (working ↔ constructing) DOES call setColor', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.rerenderBuildings([
      { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ]);
    const t = (scene as unknown as { _texts: FakeText[] })._texts[0]!;
    t.setFontSize.mockClear();
    t.setColor.mockClear();
    renderer.rerenderBuildings([
      { defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'constructing', tier: 1, constructionProgress: 50, modifiers: [] },
    ]);
    expect(t.setColor).toHaveBeenCalledTimes(1);
  });

  it('v0.9 sprite path: when texture exists, image is created and sigil is hidden', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    // 自定义 textureExists：仅 bld_house 有图，其他都没
    const scene = makeFakeScene(1366, 800, (key) => key === 'bld_house');
    const renderer = new MapRenderer(scene, acc);
    renderer.rerenderBuildings([
      { defId: 'bld_house', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ]);
    const images = (scene as unknown as { _images: ReturnType<typeof makeFakeImage>[] })._images;
    const texts = (scene as unknown as { _texts: FakeText[] })._texts;
    // sprite 命中 → 创建 image
    expect(images).toHaveLength(1);
    expect(images[0]!.key).toBe('bld_house');
    // sprite 命中 → 沙印 setVisible(false)（最后一次调用是 hide）
    expect(texts[0]!.visible).toBe(false);
  });

  it('v0.9 sprite fallback: when texture missing, sigil is shown and no image is created', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene(1366, 800, () => false);  // 全部缺图
    const renderer = new MapRenderer(scene, acc);
    renderer.rerenderBuildings([
      { defId: 'bld_house', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ]);
    const images = (scene as unknown as { _images: ReturnType<typeof makeFakeImage>[] })._images;
    const texts = (scene as unknown as { _texts: FakeText[] })._texts;
    expect(images).toHaveLength(0);
    expect(texts).toHaveLength(1);
    expect(texts[0]!.visible).toBe(true);
  });

  it('skips buildings whose defId is unknown', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const buildingsGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[2]!;
    renderer.rerenderBuildings([
      { defId: 'bld_does_not_exist', position: { x: 1, y: 1 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ]);
    // skipping → no fillRect calls for buildings
    expect(buildingsGfx.fillRect).not.toHaveBeenCalled();
  });
});

describe('MapRenderer.recenter (Slice G hardening)', () => {
  function makeFakeSceneWithSetPosition(camW: number, camH: number) {
    const cam = { width: camW, height: camH };
    const graphicsCalls: Array<ReturnType<typeof makeFakeGraphics> & { setPosition: ReturnType<typeof vi.fn> }> = [];
    const textCalls: FakeText[] = [];
    const tweenCalls: TweenConfig[] = [];
    const scene = {
      cameras: { main: cam },
      textures: { exists: vi.fn(() => false) }, // 地貌贴图不存在 → 回退色块路径
      add: {
        graphics: vi.fn(() => {
          const g = { ...makeFakeGraphics(), setPosition: vi.fn().mockReturnThis() };
          graphicsCalls.push(g);
          return g;
        }),
        text: vi.fn(() => {
          const t = makeFakeText();
          textCalls.push(t);
          return t;
        }),
      },
      tweens: {
        add: vi.fn((cfg: TweenConfig) => {
          tweenCalls.push(cfg);
          const tween = { stop: vi.fn() };
          (cfg as TweenConfig & { _tween?: { stop: ReturnType<typeof vi.fn> } })._tween = tween;
          return tween;
        }),
      },
      _graphics: graphicsCalls,
      _texts: textCalls,
      _tweens: tweenCalls,
      _setCamSize(w: number, h: number) { cam.width = w; cam.height = h; },
    };
    return scene as never;
  }

  it('recenter on enlarged window moves origin and re-positions all 4 layers', () => {
    const scene = makeFakeSceneWithSetPosition(800, 600);
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const renderer = new MapRenderer(scene, acc);
    const initial = renderer.getOrigin();

    // simulate window resize
    (scene as unknown as { _setCamSize(w: number, h: number): void })._setCamSize(1600, 1000);
    renderer.recenter();

    const updated = renderer.getOrigin();
    expect(updated.x).toBeGreaterThan(initial.x);
    expect(updated.y).toBeGreaterThan(initial.y);

    // 4 paint layers (terrain/nodes/buildings/hover) should have setPosition called.
    // 第 5 个是 viewportMaskGfx —— 它不画任何东西、固定 (0,0)，不参与 setPosition。
    const gfx = (scene as unknown as { _graphics: Array<{ setPosition: ReturnType<typeof vi.fn> }> })._graphics;
    expect(gfx).toHaveLength(5);
    for (let i = 0; i < 4; i++) {
      expect(gfx[i]!.setPosition).toHaveBeenCalledWith(updated.x, updated.y);
    }
  });

  it('recenter is a no-op if camera dimensions unchanged', () => {
    const scene = makeFakeSceneWithSetPosition(800, 600);
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const renderer = new MapRenderer(scene, acc);
    renderer.recenter();
    const gfx = (scene as unknown as { _graphics: Array<{ setPosition: ReturnType<typeof vi.fn> }> })._graphics;
    // 仅检查 4 个 paint layer 没被 setPosition；viewportMaskGfx 索引 4 跳过
    for (let i = 0; i < 4; i++) {
      expect(gfx[i]!.setPosition).not.toHaveBeenCalled();
    }
  });
});

describe('MapRenderer zoom floor + resize re-fit (DeepSeek Finding 1)', () => {
  // 带状态的相机：支持 zoom / setZoom / scrollX/Y / 改尺寸，用于验证缩放下限与 resize 重夹。
  function makeZoomScene(camW: number, camH: number) {
    const cam = {
      width: camW, height: camH, zoom: 1, scrollX: 0, scrollY: 0,
      setZoom: vi.fn(function (this: { zoom: number }, z: number) { this.zoom = z; return this; }),
      setBackgroundColor: vi.fn(),
    };
    return {
      cameras: { main: cam },
      textures: { exists: vi.fn(() => false) },
      add: {
        graphics: vi.fn(() => ({ ...makeFakeGraphics(), setPosition: vi.fn().mockReturnThis() })),
        text: vi.fn(() => makeFakeText()),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
      _setCamSize(w: number, h: number) { cam.width = w; cam.height = h; },
      _cam: cam,
    } as never;
  }

  it('v4: large map opens at default cover zoom (getDefaultZoom) and zoom-out floor is whole-map fit (min)', () => {
    const scene = makeZoomScene(1366, 800);
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    const cover = renderer.getDefaultZoom();
    const fit = renderer.getMinZoom();
    expect(cover).toBeGreaterThan(0.08);          // 受 floor 0.08 约束以上
    expect(cover).toBeLessThan(1);                // 80×80 远大于视口 → cover < 1
    expect(cover).toBeGreaterThanOrEqual(fit);    // 铺满档 ≥ 整图档（2:1 菱形 + 横屏 → 严格更大）
    // 开局 = 铺满档（默认视图；v4 起可继续放大到近景，见下一条测试）
    expect(renderer.getMapZoom()).toBeCloseTo(cover, 5);
  });

  it('v4: getMaxZoom is a close-up ceiling above cover (玩家可放大到近景), capped by MAP_ZOOM_MAX', () => {
    const scene = makeZoomScene(1920, 1080);
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    const cover = renderer.getDefaultZoom();
    const maxIn = renderer.getMaxZoom();
    expect(maxIn).toBeGreaterThan(cover);         // 近景上限严格高于铺满档 → 解锁了放大
    expect(maxIn).toBeLessThanOrEqual(MAP_ZOOM_MAX + 1e-9);
    expect(Number.isFinite(maxIn)).toBe(true);    // 永不为 NaN（渲染器对 NaN zoom 零容忍）
    // 玩家放大到上限后，确实停在近景档而非铺满档
    renderer.setMapZoom(99, 960, 540);
    expect(renderer.getMapZoom()).toBeCloseTo(maxIn, 5);
    expect(renderer.getMapZoom()).toBeGreaterThan(cover);
  });

  it('v2: setMapZoom cannot exceed getMaxZoom (max-zoom lock)', () => {
    const scene = makeZoomScene(1366, 800);
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    renderer.setMapZoom(99); // 尝试放到很大
    expect(renderer.getMapZoom()).toBeCloseTo(renderer.getMaxZoom(), 5);
    renderer.setMapZoom(0); // 尝试缩到很小
    expect(renderer.getMapZoom()).toBeCloseTo(renderer.getMinZoom(), 5);
  });

  it('v2: rebuildAfterResize re-fits to the whole-map max zoom (a below-fit zoom is lifted back)', () => {
    const scene = makeZoomScene(1366, 800);
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    (scene as unknown as { _cam: { zoom: number } })._cam.zoom = 0.02;
    (scene as unknown as { _setCamSize(w: number, h: number): void })._setCamSize(1920, 1080);
    renderer.rebuildAfterResize();
    expect(renderer.getMapZoom()).toBeCloseTo(renderer.getDefaultZoom(), 5);
    expect(renderer.getMapZoom()).toBeGreaterThanOrEqual(renderer.getMinZoom() - 1e-6);
  });

  it('v2: rebuildAfterResize always re-fits to whole map (never keeps an above-fit zoom)', () => {
    const scene = makeZoomScene(1366, 800);
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    (scene as unknown as { _cam: { zoom: number } })._cam.zoom = 1.5;  // 强塞一个不可能的放大值
    renderer.rebuildAfterResize();
    expect(renderer.getMapZoom()).toBeCloseTo(renderer.getDefaultZoom(), 5);  // 始终回到铺满默认档
  });

  it('v2: ensureFittedToViewport re-fits + centers on size change, no-ops when size unchanged', () => {
    const camW = 1920, camH = 1080;
    const scene = makeZoomScene(1366, 800);
    const cam = (scene as unknown as { _cam: { scrollX: number; scrollY: number; zoom: number } })._cam;
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    // 模拟构造在配置尺寸、真实尺寸更大：心跳应在真实尺寸上重新 fit + 居中
    (scene as unknown as { _setCamSize(w: number, h: number): void })._setCamSize(camW, camH);
    renderer.ensureFittedToViewport();
    const z = renderer.getMapZoom();
    expect(z).toBeCloseTo(renderer.getDefaultZoom(), 5);
    const w = renderer.gridToScreen(40, 40);
    const sx = (w.x - cam.scrollX) * z;
    const sy = (w.y - cam.scrollY) * z;
    expect(sx).toBeGreaterThan(camW * 0.25); expect(sx).toBeLessThan(camW * 0.75);
    expect(sy).toBeGreaterThan(camH * 0.25); expect(sy).toBeLessThan(camH * 0.75);
    // 尺寸不变再调 → no-op（不动 scroll）
    const beforeX = cam.scrollX;
    renderer.ensureFittedToViewport();
    expect(cam.scrollX).toBe(beforeX);
  });

  it('v2: ensureFittedToViewport skips a degenerate viewport (vp<=0), preserving prior camera state', () => {
    const scene = makeZoomScene(1920, 1080);
    const cam = (scene as unknown as { _cam: { scrollX: number; scrollY: number; zoom: number } })._cam;
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    renderer.ensureFittedToViewport();          // 先在 1920 fit 一次
    const beforeX = cam.scrollX, beforeZoom = cam.zoom;
    (scene as unknown as { _setCamSize(w: number, h: number): void })._setCamSize(320, 240); // 退化帧
    renderer.ensureFittedToViewport();
    expect(cam.scrollX).toBe(beforeX);          // 不被退化帧污染
    expect(cam.zoom).toBe(beforeZoom);
  });

  it('re-centres the camera after a startup maximize (no shove to a corner)', () => {
    // 复现截图 bug：开局窗口从 1366×800 最大化到 1920×1080，recenter 只挪 origin 不挪 scroll
    // → 地图缩到右下角、左上一片黑。修复后地图中心应仍落在屏幕中央带内。
    const camW = 1920, camH = 1080;
    const scene = makeZoomScene(1366, 800);
    const cam = (scene as unknown as { _cam: { scrollX: number; scrollY: number; zoom: number } })._cam;
    const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap(80, 80)));
    (scene as unknown as { _setCamSize(w: number, h: number): void })._setCamSize(camW, camH);
    renderer.rebuildAfterResize();
    // 地图中心 tile 的屏幕坐标 = (世界坐标 - scroll) * zoom
    const z = renderer.getMapZoom();
    const w = renderer.gridToScreen(40, 40);
    const screenX = (w.x - cam.scrollX) * z;
    const screenY = (w.y - cam.scrollY) * z;
    // 必须落在屏幕中央带（25%~75%），而不是被推到角落
    expect(screenX).toBeGreaterThan(camW * 0.25);
    expect(screenX).toBeLessThan(camW * 0.75);
    expect(screenY).toBeGreaterThan(camH * 0.25);
    expect(screenY).toBeLessThan(camH * 0.75);
  });
});

describe('MapRenderer.pulseBuildingCompleted (Slice H)', () => {
  it('allocates a 6th graphics, draws gold strokeRect twice, and queues an alpha tween of 800ms', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.pulseBuildingCompleted({
      defId: 'bld_farm', position: { x: 2, y: 2 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    const gfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics;
    // 4 paint layers (terrain/nodes/buildings/hover) + 1 viewport mask + 1 pulse graphics
    expect(gfx).toHaveLength(6);
    const pulseGfx = gfx[5]!;
    // 等距：金边菱形脉冲（strokePoints 一次，tier1）
    expect(pulseGfx.strokePoints).toHaveBeenCalledTimes(1);
    // 一个 800ms alpha:0 tween
    const tweens = (scene as unknown as { _tweens: TweenConfig[] })._tweens;
    expect(tweens).toHaveLength(1);
    expect(tweens[0]!.duration).toBe(800);
    expect(tweens[0]!.alpha).toBe(0);
  });

  it('unknown defId is a no-op (no graphics, no tween)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const before = (scene as unknown as { _graphics: unknown[] })._graphics.length;
    renderer.pulseBuildingCompleted({
      defId: 'bld_does_not_exist', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    const after = (scene as unknown as { _graphics: unknown[] })._graphics.length;
    expect(after).toBe(before);
    const tweens = (scene as unknown as { _tweens: TweenConfig[] })._tweens;
    expect(tweens).toHaveLength(0);
  });

  it('onComplete callback removes the pulse from active list and destroys its graphics', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.pulseBuildingCompleted({
      defId: 'bld_farm', position: { x: 1, y: 1 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    const tweens = (scene as unknown as { _tweens: TweenConfig[] })._tweens;
    // index 5 = pulse (0..3 paint layers, 4 viewportMask, 5 pulse)
    const pulseGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[5]!;
    // run the registered onComplete to simulate tween end
    tweens[0]!.onComplete!();
    expect(pulseGfx.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroy() stops the tween before destroying graphics (DeepSeek 二审 critical)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.pulseBuildingCompleted({
      defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    const tweens = (scene as unknown as { _tweens: Array<TweenConfig & { _tween?: { stop: ReturnType<typeof vi.fn> } }> })._tweens;
    const stopFn = tweens[0]!._tween!.stop;
    renderer.destroy();
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it('onComplete fired after destroy is a no-op (destroyed-guard)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.pulseBuildingCompleted({
      defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    const tweens = (scene as unknown as { _tweens: TweenConfig[] })._tweens;
    renderer.destroy();
    // 模拟 tween 引擎在 destroy 之后才触发 onComplete（理论竞态）
    expect(() => tweens[0]!.onComplete!()).not.toThrow();
  });

  it('destroy() while pulses still active destroys them too (no leak)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.pulseBuildingCompleted({
      defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    renderer.pulseBuildingCompleted({
      defId: 'bld_house', position: { x: 1, y: 1 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    });
    const gfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics;
    expect(gfx).toHaveLength(7); // 4 paint + 1 viewportMask + 2 pulses
    renderer.destroy();
    // 4 paint + 1 viewportMask + 2 pulse = 7 个 destroy 各被调一次
    for (let i = 0; i < 7; i++) expect(gfx[i]!.destroy).toHaveBeenCalledTimes(1);
  });

  it('pulseBuildingCompleted after destroy() is a silent no-op', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.destroy();
    expect(() => renderer.pulseBuildingCompleted({
      defId: 'bld_farm', position: { x: 0, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    })).not.toThrow();
    const tweens = (scene as unknown as { _tweens: TweenConfig[] })._tweens;
    expect(tweens).toHaveLength(0);
  });
});

describe('MapRenderer.floatTextAtTile (Phase4 Juice)', () => {
  it('creates a rising+fading text and queues an 1100ms tween', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const before = (scene as unknown as { _texts: FakeText[] })._texts.length;
    renderer.floatTextAtTile(2, 3, '粮仓　成', 0xe0b94a);
    const texts = (scene as unknown as { _texts: FakeText[] })._texts;
    expect(texts.length).toBe(before + 1);
    expect(texts[texts.length - 1]!.text).toBe('粮仓　成');
    const tweens = (scene as unknown as { _tweens: TweenConfig[] })._tweens;
    expect(tweens).toHaveLength(1);
    expect(tweens[0]!.duration).toBe(1100);
    expect(tweens[0]!.alpha).toBe(0);
  });

  it('empty text / non-finite coords are silent no-ops', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const before = (scene as unknown as { _texts: FakeText[] })._texts.length;
    renderer.floatTextAtTile(1, 1, '', 0xffffff);
    renderer.floatTextAtTile(Number.NaN, 1, 'x', 0xffffff);
    expect((scene as unknown as { _texts: FakeText[] })._texts.length).toBe(before);
    expect((scene as unknown as { _tweens: TweenConfig[] })._tweens).toHaveLength(0);
  });

  it('onComplete destroys the text; destroy() stops the tween and destroys leftover labels', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.floatTextAtTile(0, 0, 'a', 0xffffff);
    renderer.floatTextAtTile(1, 1, 'b', 0xffffff);
    const tweens = (scene as unknown as { _tweens: Array<TweenConfig & { _tween?: { stop: ReturnType<typeof vi.fn> } }> })._tweens;
    const texts = (scene as unknown as { _texts: FakeText[] })._texts;
    const labelA = texts[texts.length - 2]!;
    // 模拟第一条飘字 tween 结束 → 自销
    tweens[0]!.onComplete!();
    expect(labelA.destroy).toHaveBeenCalledTimes(1);
    // destroy() 停掉剩余 tween 并销毁剩余 label
    const stopFn = tweens[1]!._tween!.stop;
    renderer.destroy();
    expect(stopFn).toHaveBeenCalledTimes(1);
    expect(texts[texts.length - 1]!.destroy).toHaveBeenCalled();
  });

  it('floatTextAtTile after destroy() is a silent no-op', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    renderer.destroy();
    expect(() => renderer.floatTextAtTile(0, 0, 'x', 0xffffff)).not.toThrow();
  });

  it('caps concurrent float labels at 6, dropping the oldest (DeepSeek 复审)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const texts = (scene as unknown as { _texts: FakeText[] })._texts;
    const before = texts.length;
    for (let i = 0; i < 9; i++) renderer.floatTextAtTile(i % 8, 0, `t${i}`, 0xffffff);
    // 9 次创建，但活跃上限 6；最早 3 个应被 destroy
    const created = texts.slice(before);
    const destroyedCount = created.filter(t => t.destroy.mock.calls.length > 0).length;
    expect(destroyedCount).toBe(3);
    // destroy() 把剩余 6 个也清掉，无泄漏
    renderer.destroy();
    expect(created.every(t => t.destroy.mock.calls.length > 0)).toBe(true);
  });
});
