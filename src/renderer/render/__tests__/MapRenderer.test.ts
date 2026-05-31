/**
 * MapRenderer 的纯逻辑层测试。Phaser scene/graphics 部分用 mock 替代——
 * 我们只验证 coordinate math 和事件路径，不验证 WebGL 渲染本身。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';
import { TILE_SIZE } from '../mapColors';
import { UI } from '../../ui/palette';

/** 与 MapRenderer.computeOrigin 同步的 expected origin 算法。 */
function expectedOrigin(camW: number, camH: number, mapW: number, mapH: number): { x: number; y: number } {
  const leftInset = 8 + UI.buildPanelWidth + 8;
  const rightInset = UI.rightPanelWidth + 8 + 8;
  const topInset = UI.topbarHeight + 8;
  const bottomInset = 8;
  const usableW = camW - leftInset - rightInset;
  const usableH = camH - topInset - bottomInset;
  return {
    x: leftInset + Math.floor((usableW - mapW * TILE_SIZE) / 2),
    y: topInset + Math.floor((usableH - mapH * TILE_SIZE) / 2),
  };
}

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
    x: 0, y: 0, visible: true, alpha: 1, key: '',
    setOrigin: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
    setPosition: vi.fn().mockImplementation(function (this: typeof im, x: number, y: number) {
      this.x = x; this.y = y; return this;
    }),
    setVisible: vi.fn().mockImplementation(function (this: typeof im, v: boolean) { this.visible = v; return this; }),
    setAlpha: vi.fn().mockImplementation(function (this: typeof im, a: number) { this.alpha = a; return this; }),
    setDisplaySize: vi.fn().mockImplementation(function (this: typeof im) { return this; }),
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
  return {
    cameras: { main: { width: camWidth, height: camHeight } },
    textures: { exists: vi.fn(textureExists) },
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
  const _o = expectedOrigin(camW, camH, mapW, mapH);
  const expectedOriginX = _o.x;
  const expectedOriginY = _o.y;

  beforeEach(() => {
    const acc = new WorldMapAccessor(makeMap(mapW, mapH));
    renderer = new MapRenderer(makeFakeScene(camW, camH), acc);
  });

  it('returns (0,0) at the origin', () => {
    expect(renderer.screenToGrid(expectedOriginX, expectedOriginY)).toEqual({ x: 0, y: 0 });
  });

  it('returns (1,0) one tile right of origin', () => {
    expect(renderer.screenToGrid(expectedOriginX + TILE_SIZE, expectedOriginY)).toEqual({ x: 1, y: 0 });
  });

  it('returns (0,1) one tile below origin', () => {
    expect(renderer.screenToGrid(expectedOriginX, expectedOriginY + TILE_SIZE)).toEqual({ x: 0, y: 1 });
  });

  it('returns null for points left of origin', () => {
    expect(renderer.screenToGrid(expectedOriginX - 1, expectedOriginY)).toBeNull();
  });

  it('returns null for points above origin', () => {
    expect(renderer.screenToGrid(expectedOriginX, expectedOriginY - 1)).toBeNull();
  });

  it('returns null for points past right edge', () => {
    const justPastRight = expectedOriginX + mapW * TILE_SIZE;
    expect(renderer.screenToGrid(justPastRight, expectedOriginY)).toBeNull();
  });

  it('returns last tile (mapW-1, mapH-1) at the bottom-right interior pixel', () => {
    const lastX = expectedOriginX + mapW * TILE_SIZE - 1;
    const lastY = expectedOriginY + mapH * TILE_SIZE - 1;
    expect(renderer.screenToGrid(lastX, lastY)).toEqual({ x: mapW - 1, y: mapH - 1 });
  });

  it('returns null for NaN inputs (guards against uninitialized pointer events)', () => {
    expect(renderer.screenToGrid(NaN, expectedOriginY)).toBeNull();
    expect(renderer.screenToGrid(expectedOriginX, NaN)).toBeNull();
    expect(renderer.screenToGrid(NaN, NaN)).toBeNull();
  });

  it('returns null for Infinity inputs', () => {
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
    expect(hoverGfx.fillRect).not.toHaveBeenCalled();
  });

  it('valid preview draws a green box (1 fillRect + 1 strokeRect)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview({ gridX: 2, gridY: 3, w: 2, h: 2, valid: true });
    expect(hoverGfx.clear).toHaveBeenCalledTimes(1);
    expect(hoverGfx.fillRect).toHaveBeenCalledTimes(1);
    expect(hoverGfx.strokeRect).toHaveBeenCalledTimes(1);
  });

  it('invalid preview also draws (red) — same call shape', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview({ gridX: 0, gridY: 0, w: 1, h: 1, valid: false });
    expect(hoverGfx.fillRect).toHaveBeenCalledTimes(1);
    expect(hoverGfx.strokeRect).toHaveBeenCalledTimes(1);
  });

  it('NaN gridX / non-positive size silently clears (no throw)', () => {
    const acc = new WorldMapAccessor(makeMap(8, 8));
    const scene = makeFakeScene();
    const renderer = new MapRenderer(scene, acc);
    const hoverGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[3]!;
    renderer.setHoverPreview({ gridX: NaN, gridY: 0, w: 1, h: 1, valid: true });
    renderer.setHoverPreview({ gridX: 0, gridY: 0, w: 0, h: 1, valid: true });
    expect(hoverGfx.fillRect).not.toHaveBeenCalled();
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
    // only the 1 valid node should be drawn
    expect(nodesGfx.fillRect).toHaveBeenCalledTimes(1);
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
    // first graphics = terrain (16 tiles + grid lines + Slice H hatching dots/forest/etc)
    const terrainGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[0]!;
    // 至少 16 次（每 tile 一次 solid fill），hatching 会追加额外 fillRect（plain 点、forest 点）
    expect(terrainGfx.fillRect.mock.calls.length).toBeGreaterThanOrEqual(16);
    // second graphics = nodes (2 nodes)
    const nodesGfx = (scene as unknown as { _graphics: ReturnType<typeof makeFakeGraphics>[] })._graphics[1]!;
    expect(nodesGfx.fillRect).toHaveBeenCalledTimes(2);
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
    // 双层金边：3px 主框 + 1px 外光晕
    expect(pulseGfx.strokeRect).toHaveBeenCalledTimes(2);
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
});
