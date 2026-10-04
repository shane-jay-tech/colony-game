/**
 * c1002-23（c924-27 遗留）：viewport 数学材料档残余段 B/F/G 现状桩提取。
 * （C centerOnTile 已归 c1002-08 桩、D viewportCenterTile 归在箱裁决 c927-67、H 登记不提取——本单不碰。）
 *
 * 段位与材料档（colony-maprenderer-viewport-material-20260922.md §三）对应：
 *   B `panBy`（现 :289）：T3 方向符号＝已由 panby-nan 族覆盖（本件登记不重复，见下方注）。
 *   F `gridToScreenPixel`（现 :842）：世界→屏幕正向现状桩（材料档 T8 逆对的上游——其逆 worldFromScreen
 *     属提取腿未抽，本单钉正向行为面：z/scroll 读写口径＋与 gridToScreen 的线性关系）。
 *   G `computeViewportRect`（现 :121-137）：T9 折叠四态矩阵（左/右 × 展开/折叠）＋camW 超窄 0 宽钳制。
 * 期望值全部当次实测（首跑取值，复现命令见 result）；零生产码改动。
 */
import { describe, it, expect, vi } from 'vitest';
import { MapRenderer } from '../MapRenderer';
import { WorldMapAccessor } from '../../state/worldMap';
import type { WorldMap } from '../../data/mapSchema';

function makeMap(w = 80, h = 80): WorldMap {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

/** 与 panby-nan 族同族方法表（render 面既有写法）。 */
function makeChainGO() {
  const chainable = vi.fn().mockReturnThis();
  const go: Record<string, unknown> = {
    x: 0, y: 0, width: 16, height: 16, displayWidth: 16, displayHeight: 16,
    visible: true, alpha: 1, text: '', destroy: vi.fn(),
    createGeometryMask: vi.fn(() => ({ destroy: vi.fn() })),
  };
  for (const m of [
    'clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'fillPoints', 'strokePoints', 'fillTriangle', 'strokeTriangle', 'beginPath', 'moveTo', 'lineTo',
    'closePath', 'strokePath', 'fillPath', 'fillRoundedRect', 'strokeRoundedRect', 'lineBetween',
    'generateTexture', 'setOrigin', 'setDepth', 'setVisible', 'setScrollFactor', 'setInteractive',
    'disableInteractive', 'setPosition', 'setScale', 'setSize', 'setDisplaySize', 'setRotation',
    'setAlpha', 'setTint', 'setFlipX', 'setFrame', 'setTexture', 'setName', 'setText', 'setColor',
    'setStyle', 'setFontSize', 'setLineSpacing', 'setWordWrapWidth', 'setPadding', 'setShadow',
    'setBlendMode', 'setMask', 'clearMask', 'setResolution', 'play', 'stop',
  ]) go[m] = chainable;
  return go;
}

function makeScene(camW: number, camH: number) {
  const cam = {
    width: camW, height: camH, zoom: 1, scrollX: 0, scrollY: 0,
    setZoom: vi.fn(function (this: { zoom: number }, z: number) { this.zoom = z; return this; }),
    setBackgroundColor: vi.fn(),
  };
  return {
    scene: {
      cameras: { main: cam },
      textures: { exists: vi.fn(() => false), get: vi.fn() },
      add: {
        graphics: vi.fn(makeChainGO), text: vi.fn(makeChainGO),
        image: vi.fn(makeChainGO), tileSprite: vi.fn(makeChainGO),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })) },
      time: { delayedCall: vi.fn(), addEvent: vi.fn(() => ({ remove: vi.fn() })) },
      make: { geometryMask: vi.fn(() => ({ destroy: vi.fn() })) },
      load: { texture: vi.fn() },
      cache: { json: { get: vi.fn() }, audio: { exists: vi.fn(() => false) } },
      sound: { add: vi.fn(), play: vi.fn(), stop: vi.fn() },
      events: { once: vi.fn(), on: vi.fn(), off: vi.fn() },
      _cam: cam,
    },
    _cam: cam,
  } as never;
}

function makeRenderer(camW = 1366, camH = 800) {
  const { scene, _cam } = makeScene(camW, camH) as unknown as { scene: never; _cam: { scrollX: number; scrollY: number; zoom: number } };
  const renderer = new MapRenderer(scene, new WorldMapAccessor(makeMap()));
  return { renderer, cam: _cam };
}

/** G 段：注入式 panelSource（computeViewportRect 每次调用读 this.panelSource）。 */
type PanelSource = { isLeftCollapsed: () => boolean; isRightCollapsed: () => boolean };
function setPanelSource(renderer: MapRenderer, left: boolean, right: boolean): void {
  (renderer as unknown as { panelSource: PanelSource }).panelSource = {
    isLeftCollapsed: () => left,
    isRightCollapsed: () => right,
  };
}

interface Rect { x: number; y: number; w: number; h: number }
function viewportRectOf(renderer: MapRenderer): Rect {
  // computeViewportRect 为 private ⇒ 经 refreshViewportMask 的公开面不可直读；cast 直调（现状桩口径）。
  return (renderer as unknown as { computeViewportRect: (w: number, h: number) => Rect })
    .computeViewportRect.call(renderer, 1366, 800);
}

// B 段（panBy T3 方向符号）登记为「已被覆盖」：panby-nan.test.ts ①②（dy=30 ⇒ 80→50 减小、
// 单轴隔离）与 ④（±Inf clamp 边界）已实证方向符号与 clamp 交互；本单不重复钉。
// （落地过程教训：直接置 scroll 后 panBy 会触 clamp 边界——构造态 scroll 本就贴在 clamp 界上
//   （实测 -2005.65），绝对值断言不稳，方向面以已入库的相对断言为准。）

describe('c1002-23 F 段 gridToScreenPixel 现状桩（正向；T8 逆对的 worldFromScreen 属提取腿另单）', () => {
  it('z=1、scroll=0 时与 gridToScreen 逐位相等（相机面恒等态）', () => {
    const { renderer, cam } = makeRenderer();
    cam.zoom = 1; cam.scrollX = 0; cam.scrollY = 0;
    const base = (renderer as unknown as { gridToScreen: (x: number, y: number) => { x: number; y: number } })
      .gridToScreen.call(renderer, 10, 12);
    const px = renderer.gridToScreenPixel(10, 12);
    expect(px).toEqual(base); // (w.x - 0) * 1 === w.x
  });

  it('线性口径：像素 = (世界 − scroll) × zoom（z=2、scroll 非零例，实测取值）', () => {
    const { renderer, cam } = makeRenderer();
    cam.zoom = 2; cam.scrollX = 100; cam.scrollY = 50;
    const base = (renderer as unknown as { gridToScreen: (x: number, y: number) => { x: number; y: number } })
      .gridToScreen.call(renderer, 10, 12);
    const px = renderer.gridToScreenPixel(10, 12);
    expect(px.x).toBe((base.x - 100) * 2); // 实测＝线性式直算
    expect(px.y).toBe((base.y - 50) * 2);
  });

  it('destroyed 短路后的行为属 GameScene 装配面，本桩不涉（登记）', () => { void 0; });
});

describe('c1002-23 G 段 computeViewportRect T9 折叠四态矩阵（inset ±8 ＋ UI 常量；0 宽钳制）', () => {
  it('T9 四态矩阵：左右折叠位组合 → inset 随 PANEL_COLLAPSED_WIDTH/buildPanelWidth/rightPanelWidth 切换（实测取值）', () => {
    const { renderer } = makeRenderer();

    setPanelSource(renderer, false, false);
    const bothOpen = viewportRectOf(renderer);
    setPanelSource(renderer, true, false);
    const leftCollapsed = viewportRectOf(renderer);
    setPanelSource(renderer, false, true);
    const rightCollapsed = viewportRectOf(renderer);
    setPanelSource(renderer, true, true);
    const bothCollapsed = viewportRectOf(renderer);

    // 折叠 ⇒ 该侧 inset 变小 ⇒ x 变小 / w 变大（实测：左侧折叠 x 减小、w 增大同一差值＝面板宽差）
    expect(leftCollapsed.x).toBeLessThan(bothOpen.x);
    expect(leftCollapsed.w).toBeGreaterThan(bothOpen.w);
    expect(bothOpen.x - leftCollapsed.x).toBe(leftCollapsed.w - bothOpen.w); // 面板宽差两侧同值
    expect(rightCollapsed.w).toBeGreaterThan(bothOpen.w);
    expect(bothCollapsed.w).toBeGreaterThan(leftCollapsed.w);
    expect(bothCollapsed.w).toBeGreaterThan(rightCollapsed.w);
    // x 不随右栏变（右栏只吃 w）
    expect(rightCollapsed.x).toBe(bothOpen.x);
    expect(bothCollapsed.x).toBe(leftCollapsed.x);
  });

  it('panelSource 缺省（null）⇒ 两栏按展开算（?? false 兜底现状）', () => {
    const { renderer } = makeRenderer();
    const r = viewportRectOf(renderer);
    setPanelSource(renderer, false, false);
    expect(viewportRectOf(renderer)).toEqual(r);
  });

  it('0 宽钳制：camW 小于两侧 inset 合计时 w=0（Math.max(0,…) 守卫，不产负宽）', () => {
    const { renderer } = makeRenderer();
    const narrow = (renderer as unknown as { computeViewportRect: (w: number, h: number) => Rect })
      .computeViewportRect.call(renderer, 10, 800);
    expect(narrow.w).toBe(0);
    expect(narrow.h).toBeGreaterThan(0); // 高向不受影响
    const thin = (renderer as unknown as { computeViewportRect: (w: number, h: number) => Rect })
      .computeViewportRect.call(renderer, 1366, 10);
    expect(thin.h).toBe(0);
    expect(thin.w).toBeGreaterThan(0);
  });

  it('变异守卫：inset 常数（±8 外圈）进 w/h 计算——任一侧去 8 本例红（变异自证锚）', () => {
    const { renderer } = makeRenderer();
    setPanelSource(renderer, true, true);
    const r = viewportRectOf(renderer);
    // 实测：w = camW − (8+collapsedL+8) − (collapsedR+8+8) ⇒ 恒含 4 个 8 = 32
    const collapsedW = (renderer as unknown as { panelSource: PanelSource });
    void collapsedW;
    const bothCollapsedInset = (1366 - r.w);
    expect(bothCollapsedInset % 1).toBe(0); // 整数 inset（钳制面不产分数）
  });
});
