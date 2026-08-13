import Phaser from 'phaser';
import type { WorldMapAccessor } from '../state/worldMap';
import type { BuildingInstance } from '../data/schema';
import { getBuildingDef } from '../data/buildingRegistry';
import { COLORS, COLORS_HEX, UI } from '../ui/palette';
import { terrainColor, resourceNodeColor, TILE_SIZE, NODE_MARKER_INSET } from './mapColors';
import { getBuildingSigil } from './buildingSigils';
import { getBuildingAnchor } from './buildingAnchorOverrides';
import { ISO_TILE_W, ISO_TILE_H, gridToIso, gridCenterToIso } from './iso';
import { MAP_ZOOM_MAX } from './cameraMath';
import { fitZoomFor, coverZoomFor, closeZoomFor, clampScrollFor, scrollForZoomAtAnchor, clampZoom } from './cameraMath';
import { SCATTER_BY_TERRAIN, RIVER_EDGE, SCATTER_KEY_PREFIX, type ScatterSlot } from '../data/scatterConfig';
import { createRng, type RngHandle } from '../state/rng';
import { SMOKE_BUILDING_IDS, MARKET_BUILDING_IDS, FARM_BUILDING_IDS, FARM_SEASON_TINTS, SMOKE_TEX_KEY, SPARKLE_TEX_KEY } from './buildingAnims';

/** v0.9：左右面板折叠时只露 28px 竖条；recompute 视口要靠它 */
export const PANEL_COLLAPSED_WIDTH = 28;

/** v1.0 #5：地图缩放范围。MAP_ZOOM_MAX 看细节；缩小**真实下限是 fitMinZoom()**（整张图刚好装进视口，
 *  随地图/视口大小动态变化），不是 MAP_ZOOM_MIN——后者只作为 ZoomControl 的名义参考，UI 实际锁止取
 *  getMinZoom()。中间档由 ZOOM_STEP 控制。 */
export { MAP_ZOOM_MIN, MAP_ZOOM_MAX } from './cameraMath';
export const MAP_ZOOM_STEP = 0.1;
/** v2：缩放每档乘法因子（放大 ×、缩小 ÷）。适配 fit≈0.1 的小 zoom 量级——加法步进会一步越界。 */
export const MAP_ZOOM_STEP_FACTOR = 1.2;
/** v4：近景放大上限的参数——最大放大时屏幕大约容纳 BUILDINGS_ON_SCREEN_TARGET 栋平均建筑。
 *  代表性建筑占地 AVG_BUILDING_TILES×AVG_BUILDING_TILES 格（多数 2×2~3×3，取 3）。
 *  想让建筑显得更小、屏里更多栋 → 调大 BUILDINGS_ON_SCREEN_TARGET；想更近 → 调小。MAP_ZOOM_MAX=2.0 是硬上限。 */
export const AVG_BUILDING_TILES = 3;
export const BUILDINGS_ON_SCREEN_TARGET = 8;
/** 建筑精灵缩放上限：防细高/窄地基建筑(footprintWidthFrac 极小)算出爆炸性 scale 撑满屏。
 *  正常建筑 scale≈0.2~0.6，1.5 留足余量又能拦住异常值。 */
export const MAP_BUILDING_MAX_SCALE = 1.5;

/** 折叠态查询接口；MapRenderer 不直接耦合 GameStore，由 GameScene 注入 */
export interface PanelLayoutSource {
  isLeftCollapsed(): boolean;
  isRightCollapsed(): boolean;
}

/**
 * MapRenderer：把 WorldMap + buildings 画到 Phaser Graphics 上（Slice D）。
 *
 * 设计原则：
 *   - 一次性 bake terrain 到底层 Graphics（少量重绘成本，大幅省掉 per-frame 开销）
 *   - 资源点画在 terrain 上方独立 layer
 *   - buildings 单独 layer，方便后续 Slice E 加 hover/click
 *   - rerender* 方法只在数据变化时调用（不放在 update loop）
 */

/** 按亮度因子 f 抖动一个 0xRRGGBB 颜色（每通道 ×f，clamp 0..255）。用于地形 per-tile 杂斑。 */
function jitterColor(c: number, f: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((c & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

export class MapRenderer {
  private terrainGfx: Phaser.GameObjects.Graphics | null;
  /** 等距投影：让最左 tile 的 local x = 0（最左点出现在 gy=height-1 行）。constructor 算定。 */
  private isoOffsetX = 0;
  /** 等距地图在屏幕上的菱形包围盒像素尺寸（相机居中/clamp 用）。constructor 算定。 */
  private mapPxW = 0;
  private mapPxH = 0;
  private nodesGfx: Phaser.GameObjects.Graphics | null;
  private buildingsGfx: Phaser.GameObjects.Graphics | null;
  private hoverGfx: Phaser.GameObjects.Graphics | null;
  /** Slice H：建筑沙印 Text 对象池 — rerender 时按需复用/扩展，避免每次 destroy+new */
  private sigilTexts: Phaser.GameObjects.Text[] = [];
  /** 平行数组：上次每个 sigil text 的 fontPx，用于跳过未变 setFontSize（DeepSeek 二审 perf） */
  private sigilLastFontPx: number[] = [];
  /** 平行数组：上次每个 sigil text 的颜色 hex，用于跳过未变 setColor */
  private sigilLastColor: string[] = [];
  /** v0.9 Pillar 3.2：建筑 sprite 池 — 与 sigilTexts 同 idx 平行，
   *  texture 已加载用 image，否则用 sigil；二者择一显示。 */
  private buildingImages: Phaser.GameObjects.Image[] = [];
  /** W4 散布层：树/石等绝对坐标精灵，一次性烘焙，随 recenter 平移（与建筑精灵同机制）。 */
  private scatterImages: Phaser.GameObjects.Image[] = [];
  /** 地形贴图层（TileSprite + 类型遮罩）：把 plain.png 等无缝纹理贴到对应地形 tile。
   *  不用当年出畸变的 RenderTexture，改 TileSprite+GeometryMask。每种地形一层。 */
  private terrainTexLayers: { sprite: Phaser.GameObjects.TileSprite; maskGfx: Phaser.GameObjects.Graphics }[] = [];
  /** 平行数组：上次每个 image 的 textureKey，用于跳过未变 setTexture（避免重测纹理） */
  private buildingImageLastKey: string[] = [];
  /** Slice H：建造完成 800ms 金边脉冲 — 一次一个临时 Graphics，淡出后销毁
   * 同时存 tween 引用，destroy 时能 stop()，避免 onComplete 在 destroy 之后还触发 NPE
   */
  private activePulses: Array<{ g: Phaser.GameObjects.Graphics; tween: Phaser.Tweens.Tween }> = [];
  /** Phase4 Juice：上浮淡出的飘字（建成/晋阶/资源大变动）。同 activePulses 做 tween 跟踪 + destroy 清理。 */
  private floatLabels: Array<{ t: Phaser.GameObjects.Text; tween: Phaser.Tweens.Tween }> = [];
  /** 脉冲淡出毫秒 */
  private static readonly PULSE_MS = 800;
  /** 飘字上浮淡出毫秒 */
  private static readonly FLOAT_MS = 1100;
  // origin 不再 readonly：resize 时需要 recenter
  private originX: number;
  private originY: number;
  private readonly width: number;
  private readonly height: number;
  private readonly scene: Phaser.Scene;
  /** 持有 accessor 以便窗口 resize 后重烘焙 RT（清掉可能被 renderer resize 污染的 framebuffer） */
  private readonly accessor: WorldMapAccessor;
  private destroyed = false;
  /** A-3：冬季雪花粒子发射器 */
  private snowEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  /** A-4：建筑微动画粒子发射器池 */
  private buildingEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  /** A-4：当前季节（农田色调用） */
  private currentSeason: 0 | 1 | 2 | 3 = 0;
  /** v0.9：可见视口 mask graphic（不渲染，仅作为 GeometryMask 形状源）。所有地图层 + sigil + pulse 走它。 */
  private viewportMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private viewportMask: Phaser.Display.Masks.GeometryMask | null = null;
  /** 折叠态来源（GameScene 注入；不传时所有面板视为展开） */
  private panelSource: PanelLayoutSource | null = null;

  /**
   * 计算可用视口（考虑 HUD + 左右面板的折叠态）。
   * v0.9 升级：折叠态下 left/right inset 缩到 PANEL_COLLAPSED_WIDTH+16；展开态保持原 256/280+16。
   */
  private computeViewportRect(camWidth: number, camHeight: number): { x: number; y: number; w: number; h: number } {
    const leftCollapsed = this.panelSource?.isLeftCollapsed() ?? false;
    const rightCollapsed = this.panelSource?.isRightCollapsed() ?? false;
    const leftPanelW = leftCollapsed ? PANEL_COLLAPSED_WIDTH : UI.buildPanelWidth;
    const rightPanelW = rightCollapsed ? PANEL_COLLAPSED_WIDTH : UI.rightPanelWidth;
    const leftInset = 8 + leftPanelW + 8;
    const rightInset = rightPanelW + 8 + 8;
    const topInset = UI.topbarHeight + UI.toolbarHeight + 8; // 2026-06-19：顶栏 + 主功能工具栏
    const bottomInset = 8;
    return {
      x: leftInset,
      y: topInset,
      w: Math.max(0, camWidth - leftInset - rightInset),
      h: Math.max(0, camHeight - topInset - bottomInset),
    };
  }

  private static readonly ISO_HW = ISO_TILE_W / 2;
  private static readonly ISO_HH = ISO_TILE_H / 2;
  /** 等距：格子顶点 → 图层局部坐标（iso.ts 纯投影 + isoOffsetX 平移，保证 local x ≥ 0）。 */
  private isoVert(gx: number, gy: number): { x: number; y: number } {
    const p = gridToIso(gx, gy);
    return { x: p.sx + this.isoOffsetX, y: p.sy };
  }

  /** 等距：格子中心 → 图层局部坐标（iso.ts 纯投影 + 平移，便于精灵 bottom-center 落位）。 */
  private isoCenter(gx: number, gy: number): { x: number; y: number } {
    const p = gridCenterToIso(gx, gy);
    return { x: p.sx + this.isoOffsetX, y: p.sy };
  }

  /** footprint(wT×hT 格) 块的菱形：中心局部坐标 cx/cy + 相对中心的 4 顶点 rel（脉冲缩放用）。 */
  private footprintDiamond(gx: number, gy: number, wT: number, hT: number):
    { cx: number; cy: number; rel: { x: number; y: number }[] } {
    const top = this.isoVert(gx, gy);
    const right = this.isoVert(gx + wT, gy);
    const bot = this.isoVert(gx + wT, gy + hT);
    const left = this.isoVert(gx, gy + hT);
    const cx = (top.x + bot.x) / 2;
    const cy = (top.y + bot.y) / 2;
    return {
      cx, cy, rel: [
        { x: top.x - cx, y: top.y - cy }, { x: right.x - cx, y: right.y - cy },
        { x: bot.x - cx, y: bot.y - cy }, { x: left.x - cx, y: left.y - cy },
      ],
    };
  }

  /**
   * 计算地图 origin，使等距菱形地图（mapPxW×mapPxH）居中于"可用视口"
   * （扣除 HUD 顶栏 + 左 BuildPanel + 右 CourtPanel 后的中央矩形）。
   */
  private computeOrigin(camWidth: number, camHeight: number): { x: number; y: number } {
    const vp = this.computeViewportRect(camWidth, camHeight);
    return {
      x: vp.x + Math.floor((vp.w - this.mapPxW) / 2),
      y: vp.y + Math.floor((vp.h - this.mapPxH) / 2),
    };
  }

  /** v0.9：把 mask graphic 重画到当前视口矩形，并把 mask 应用到所有地图 layer。
   *  hotfix#4：vp.w / vp.h <= 0 时**不重画**，保留上一帧正确的 mask；否则中间帧
   *  把 mask 变成 0×0 会让整个地图层不可见，肉眼看就是"卡死"。
   *  v1.0 #5：mask 是世界坐标对象，相机 zoom/scroll 后会被一起变换。要让它最终 render
   *  到固定的 screen viewport (vp.x..vp.x+vp.w)，反向除 zoom + 加 scroll 补偿。 */
  private refreshViewportMask(): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    const vp = this.computeViewportRect(cam.width, cam.height);
    if (vp.w <= 0 || vp.h <= 0) return;
    const mg = this.viewportMaskGfx;
    if (!mg) return;
    const z = (cam.zoom as number | undefined) || 1;
    const sx = (cam.scrollX as number | undefined) || 0;
    const sy = (cam.scrollY as number | undefined) || 0;
    mg.clear();
    mg.fillStyle(0xffffff, 1);
    mg.fillRect(vp.x / z + sx, vp.y / z + sy, vp.w / z, vp.h / z);
  }

  /**
   * v1.0 #5：缩放地图。anchorScreenX/Y 给定时在该屏幕点居中（鼠标滚轮放在哪缩在哪），
   * 否则在 viewport 中心缩。zoom clamp 到 [MAP_ZOOM_MIN, MAP_ZOOM_MAX]，缩放后调
   * clampScroll + refreshViewportMask 一并刷新。返回实际生效的 zoom 值。
   */
  setMapZoom(targetZoom: number, anchorScreenX?: number, anchorScreenY?: number): number {
    if (this.destroyed) return 1;
    const cam = this.scene.cameras.main;
    const oldZoom = (cam.zoom as number | undefined) || 1;
    // v2：上限 = 整图 fit（最大化锁止，不能再放大）；下限 = fit×0.4（可往外缩，居中由 clampScroll 保证）。
    const newZoom = clampZoom(targetZoom, this.getMinZoom(), this.getMaxZoom());
    if (Math.abs(newZoom - oldZoom) < 1e-4) return oldZoom;
    const vp = this.computeViewportRect(cam.width, cam.height);
    // DeepSeek 复审[安全]：锚点可能是异常 pointer 传来的 NaN——非有限值回退到视口中心，避免写 NaN scroll 崩渲染。
    const ax = (anchorScreenX !== undefined && Number.isFinite(anchorScreenX)) ? anchorScreenX : (vp.x + vp.w / 2);
    const ay = (anchorScreenY !== undefined && Number.isFinite(anchorScreenY)) ? anchorScreenY : (vp.y + vp.h / 2);
    const next = scrollForZoomAtAnchor(ax, ay, oldZoom, newZoom, (cam.scrollX as number | undefined) || 0, (cam.scrollY as number | undefined) || 0);
    if (typeof cam.setZoom === 'function') cam.setZoom(newZoom);
    cam.scrollX = next.x;
    cam.scrollY = next.y;
    this.clampScroll();
    this.refreshViewportMask();
    return newZoom;
  }

  /**
   * v4：开局/重置的默认缩放 = 铺满整图并居中（getDefaultZoom = coverZoom）。
   * 这也是放大上限（最大化锁止，不能再往里放大）。往外缩可缩到整图全可见（getMinZoom = fit）。
   */
  private initialZoom(): number {
    return this.getDefaultZoom();
  }

  /**
   * v4：近景放大上限——玩家能放大到的最近档（约 BUILDINGS_ON_SCREEN_TARGET 栋建筑填满屏幕）。
   * 按真实 ISO tile 尺寸 + 建筑 footprint + 当前视口面积算出；不低于 coverZoom，不超过 MAP_ZOOM_MAX。
   * ★注意：开局/重置/resize 用的是 getDefaultZoom()(=coverZoom)，**不是**这里——本方法只作 setMapZoom 放大方向的 clamp 上限。
   */
  getMaxZoom(): number {
    const cam = this.scene.cameras.main;
    const vp = this.computeViewportRect(cam.width, cam.height);
    const cover = this.coverZoom();
    if (vp.w <= 0 || vp.h <= 0) return Math.min(MAP_ZOOM_MAX, Math.max(cover, 1));
    // 一栋 AVG×AVG 建筑的等距包围盒（zoom=1）：宽 = AVG*ISO_TILE_W，高 = AVG*ISO_TILE_H。
    const bw = AVG_BUILDING_TILES * ISO_TILE_W;
    const bh = AVG_BUILDING_TILES * ISO_TILE_H;
    return closeZoomFor(vp.w, vp.h, bw, bh, BUILDINGS_ON_SCREEN_TARGET, cover);
  }

  /** v3：缩小下限 = fitMinZoom（整张地图刚好完整可见）。往外缩到这一档可看全图（带黑边），供 ZoomControl 判"最远"。 */
  getMinZoom(): number {
    return this.fitMinZoom();
  }

  /** 整张等距地图刚好装进可用视口的 fit 缩放（公式在 cameraMath.fitZoomFor）。 */
  private fitMinZoom(): number {
    const cam = this.scene.cameras.main;
    const vp = this.computeViewportRect(cam.width, cam.height);
    return fitZoomFor(vp.w, vp.h, this.mapPxW, this.mapPxH);
  }

  /** v3：铺满视口的缩放（公式在 cameraMath.coverZoomFor）。 */
  private coverZoom(): number {
    const cam = this.scene.cameras.main;
    const vp = this.computeViewportRect(cam.width, cam.height);
    return coverZoomFor(vp.w, vp.h, this.mapPxW, this.mapPxH);
  }

  /** v4：开局/重置/resize 的目标缩放 = 铺满整图并居中（= coverZoom）。
   *  从 getMaxZoom 解耦出来：抬高近景放大上限后，refit 仍回到这一档，不会跳到近景。 */
  getDefaultZoom(): number {
    return this.coverZoom();
  }

  /** v1.0 #5：当前相机 zoom（用于 UI 显示） */
  getMapZoom(): number {
    const cam = this.scene.cameras.main;
    return (cam.zoom as number | undefined) || 1;
  }

  /**
   * v1.0 #5：相机平移（屏幕像素）。dx/dy 正方向 = 鼠标向右/下拖。
   * 拖动逻辑：scrollX 减去 dx/zoom（向右拖 → 看到左边的世界 → scroll 减小）。
   */
  panBy(dxScreen: number, dyScreen: number): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    const z = (cam.zoom as number | undefined) || 1;
    cam.scrollX = ((cam.scrollX as number | undefined) || 0) - dxScreen / z;
    cam.scrollY = ((cam.scrollY as number | undefined) || 0) - dyScreen / z;
    this.clampScroll();
    this.refreshViewportMask();
  }

  /** v1.0 #5：重置——居中到地图中心 tile（等距大地图下比 scroll=0 更"对准聚落区"）。 */
  resetView(): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    if (typeof cam.setZoom === 'function') cam.setZoom(this.initialZoom());
    this.centerOnTile(Math.floor(this.width / 2), Math.floor(this.height / 2));
    this.refreshViewportMask();
  }

  /** 把相机居中到某格（世界点 origin+isoCenter 落在可用视口中心）。初始 + reset 用。 */
  centerOnTile(gx: number, gy: number): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    const c = this.isoCenter(gx, gy);
    const z = (cam.zoom as number | undefined) || 1;
    const vp = this.computeViewportRect(cam.width, cam.height);
    cam.scrollX = (this.originX + c.x) - (vp.x + vp.w / 2) / z;
    cam.scrollY = (this.originY + c.y) - (vp.y + vp.h / 2) / z;
    this.clampScroll();
  }

  /**
   * v1.0 #5：clamp camera scroll 让地图始终至少完全填满 viewport。
   * 当 zoom < 1 / 地图小于 viewport 时，scroll 锁回 0（由 originX 居中）。
   * 当 zoom > 1 / 地图大于 viewport 时，scroll 不能让 map 边离开 viewport 边。
   */
  private clampScroll(): void {
    const cam = this.scene.cameras.main;
    const vp = this.computeViewportRect(cam.width, cam.height);
    const z = (cam.zoom as number | undefined) || 1;
    const next = clampScrollFor(
      (cam.scrollX as number | undefined) || 0,
      (cam.scrollY as number | undefined) || 0,
      vp, z,
      this.originX, this.originY, this.mapPxW, this.mapPxH,
    );
    cam.scrollX = next.x;
    cam.scrollY = next.y;
  }

  /**
   * v0.9：注入折叠态查询源。GameScene 在 create 后调一次，传入读取 GameStore 的小 adapter。
   * 不传或 null 时视所有面板为展开。
   */
  setPanelLayoutSource(src: PanelLayoutSource | null): void {
    this.panelSource = src;
    this.refreshViewportMask();
    this.recenter();
  }

  /**
   * 窗口画布尺寸切换（maximize↔窗口化）后调：重新居中 + **重烘焙地貌/散布/资源点**。
   * renderer.resize() 理论上不毁 RT 的独立 framebuffer，但 Windows ANGLE 上切换瞬间可能留下
   * 损坏状态——重烘焙是廉价且确定的"复位"（仅真实 resize 时调，不在面板折叠时调）。
   */
  rebuildAfterResize(): void {
    if (this.destroyed) return;
    // 等距重写后地面是 Graphics 菱形（无 RenderTexture）→ resize 不再有 RT framebuffer 失效问题。
    // v2：退化帧（视口算出 ≤0，maximize 中间帧）一律跳过——既不重 fit 也不重烘焙，保留上一帧好状态；
    // 真正的居中由 ensureFittedToViewport() 在尺寸稳定后兜底完成（见 update 心跳）。
    const cam = this.scene.cameras.main;
    const vp = this.computeViewportRect(cam.width, cam.height);
    if (vp.w <= 0 || vp.h <= 0) return;
    this.recenter();
    // 视口变了 → fit 也变。统一回到"整图刚好装下"（最大化档）并居中到地图中心格。
    if (typeof cam.setZoom === 'function') cam.setZoom(this.getDefaultZoom());
    this.centerOnTile(Math.floor(this.width / 2), Math.floor(this.height / 2));
    this.lastFitW = cam.width;
    this.lastFitH = cam.height;
    this.bakeTerrain(this.accessor);
    this.bakeResourceNodes(this.accessor);
  }

  /** v2：上次完成"整图 fit + 居中"时的相机尺寸；用于 ensureFittedToViewport 的尺寸变化检测。 */
  private lastFitW = -1;
  private lastFitH = -1;

  /**
   * v2：请求下一帧强制重新 fit+居中（即使相机尺寸没变）。
   * 用于"视口可用区变了但画布尺寸没变"的场景——面板折叠/展开、读档后布局变化。
   * 重置 lastFit 让 ensureFittedToViewport 下一帧必然重算（避免在事件回调里直接动相机的时序坑）。
   */
  requestRefit(): void {
    this.lastFitW = -1;
    this.lastFitH = -1;
  }

  /**
   * v2（修右下角偏移真因）：每帧 O(1) 守护。
   * 真因：构造时相机可能还停在配置尺寸（1366）而非真实最大化尺寸，或 maximize 过程中夹了退化帧，
   * 导致"居中只在错误尺寸上发生过一次、之后再没人纠正"。这里在 update 里轮询——
   *   - 视口退化（vp≤0）：跳过，等下一帧（自愈）。
   *   - 相机尺寸相对上次 fit 变化 >1px：重新 fit 整图 + 居中（这才是权威的居中时机，与时序无关）。
   *   - 尺寸没变：直接 no-op，**不动用户的缩放/拖动**。
   */
  ensureFittedToViewport(): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;
    const vp = this.computeViewportRect(w, h);
    if (vp.w <= 0 || vp.h <= 0) return; // 退化帧：保留上一帧，等稳定
    if (Math.abs(w - this.lastFitW) <= 1 && Math.abs(h - this.lastFitH) <= 1) return; // 尺寸未变
    this.lastFitW = w;
    this.lastFitH = h;
    this.recenter();
    if (typeof cam.setZoom === 'function') cam.setZoom(this.getDefaultZoom());
    this.centerOnTile(Math.floor(this.width / 2), Math.floor(this.height / 2));
  }

  constructor(scene: Phaser.Scene, accessor: WorldMapAccessor) {
    const dim = accessor.getDimensions();
    this.width = dim.width;
    this.height = dim.height;
    this.scene = scene;
    this.accessor = accessor;

    // 等距投影几何：最左点在 gy=height-1 处 x = -(height-1)*HW；右移 isoOffsetX 让 local x≥0。
    this.isoOffsetX = (this.height - 1) * MapRenderer.ISO_HW;
    this.mapPxW = (this.width + this.height) * MapRenderer.ISO_HW;
    this.mapPxH = (this.width + this.height) * MapRenderer.ISO_HH;

    // 居中：地图放在"可用区域"（扣 HUD + 左右面板）中央，避免视觉黑边
    const cam = scene.cameras.main;
    // ★真因修复：把相机原点设为 (0,0)，让 zoom 以左上角为基准 → 屏幕坐标 = (世界 − scroll) × zoom，
    // 与本类所有 scroll/居中/clamp/锚点计算的简化模型一致。Phaser 默认原点 (0.5,0.5) 会让缩放绕画面中心，
    // 引入 中心×(1−zoom) 偏移项；zoom=1 时为 0（旧版无缩放故无碍），但 fit≈0.2 时该项达 ~768px，
    // 把整张地图（及 mask）整体推向右下角——这正是"开局甩到右下、缩放越小偏越多"的根因。
    if (typeof (cam as { setOrigin?: (x: number, y: number) => unknown }).setOrigin === 'function') {
      cam.setOrigin(0, 0);
    }
    const o = this.computeOrigin(cam.width, cam.height);
    this.originX = o.x;
    this.originY = o.y;

    this.terrainGfx = scene.add.graphics({ x: this.originX, y: this.originY });
    this.terrainGfx.setDepth(-10); // 纯色地形垫底；地形贴图层 -9 叠其上、节点/建筑/散布在 0+
    this.nodesGfx = scene.add.graphics({ x: this.originX, y: this.originY });
    this.buildingsGfx = scene.add.graphics({ x: this.originX, y: this.originY });
    // hover 在最上层（drawn last → 顶层），用于 Slice E 放置预览
    this.hoverGfx = scene.add.graphics({ x: this.originX, y: this.originY });

    // v0.9：viewport mask —— 一个不渲染的 graphic，作为 GeometryMask 的形状源。
    // 用 setVisible(false) 让它不参与绘制；只用做 mask alpha 测试。
    this.viewportMaskGfx = scene.add.graphics();
    this.viewportMaskGfx.setVisible(false);
    this.viewportMask = this.viewportMaskGfx.createGeometryMask();
    this.terrainGfx.setMask(this.viewportMask);
    this.nodesGfx.setMask(this.viewportMask);
    this.buildingsGfx.setMask(this.viewportMask);
    this.hoverGfx.setMask(this.viewportMask);
    this.refreshViewportMask();

    this.bakeTerrain(accessor);
    this.bakeResourceNodes(accessor);
    this.bakeScatter(accessor); // W4 散布层（树/石）
    this.bakeTerrainTexture(accessor); // 地形贴图层（测试：先贴平原）

    // 等距大地图：开局先缩到"概览"缩放（看到大片可用空地，破除"地图太小"错觉），再居中到地图中心。
    if (typeof cam.setZoom === 'function') cam.setZoom(this.initialZoom());
    this.centerOnTile(Math.floor(this.width / 2), Math.floor(this.height / 2));
    // 地图外/菱形空角的底色用暗土色，避免露出刺眼纯黑（比 BG_INK 略暖、低调）。
    if (typeof scene.cameras.main.setBackgroundColor === 'function') {
      scene.cameras.main.setBackgroundColor(0x241d14);
    }
    this.ensureAnimTextures();
  }

  private ensureAnimTextures(): void {
    const make = (this.scene as unknown as { make?: { graphics?: Function } }).make;
    if (!make?.graphics) return;
    if (!this.scene.textures.exists(SMOKE_TEX_KEY)) {
      const g = make.graphics({ x: 0, y: 0 }, false) as Phaser.GameObjects.Graphics;
      g.fillStyle(0x666666, 0.6);
      g.fillCircle(4, 4, 4);
      (g as unknown as { generateTexture(k: string, w: number, h: number): void }).generateTexture(SMOKE_TEX_KEY, 8, 8);
      g.destroy();
    }
    if (!this.scene.textures.exists(SPARKLE_TEX_KEY)) {
      const g = make.graphics({ x: 0, y: 0 }, false) as Phaser.GameObjects.Graphics;
      g.fillStyle(0xffdd88, 0.9);
      g.fillCircle(2, 2, 2);
      (g as unknown as { generateTexture(k: string, w: number, h: number): void }).generateTexture(SPARKLE_TEX_KEY, 4, 4);
      g.destroy();
    }
  }

  /**
   * 等距地面烘焙：每个 tile 画成一个菱形（四个格点 (x,y)(x+1,y)(x+1,y+1)(x,y+1) 投影成顶/右/底/左），
   * 按地形上色。无 RenderTexture（故 resize 不再畸变）、无网格线（同型相邻菱形融成大色块，Anno 风）。
   * 手绘地貌贴图留 Phase 2；本阶段先用纯色菱形验证投影/对位。
   */
  private bakeTerrain(accessor: WorldMapAccessor): void {
    const g = this.terrainGfx;
    if (!g) return;
    g.clear();
    // 从后往前（x+y 递增）画，保证视觉叠压顺序自然
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = accessor.getTile(x, y);
        if (!tile) continue;
        const top = this.isoVert(x, y);
        const right = this.isoVert(x + 1, y);
        const bottom = this.isoVert(x + 1, y + 1);
        const left = this.isoVert(x, y + 1);
        // 每格轻微色彩抖动：把死板纯色块变成有深浅的杂斑（尤其救平原/山岳大片纯色）。确定性 per-tile。
        const h = (Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
        const f = 0.91 + ((h % 1000) / 1000) * 0.17; // 0.91..1.08 亮度
        g.fillStyle(jitterColor(terrainColor(tile.terrain), f), 1);
        // 轻微外扩 0.5px 消相邻菱形抗锯齿缝
        g.fillPoints([top, right, bottom, left], true);
        if (tile.terrain === 'river') {
          // 河水双色：外缘保持图例蓝，内芯加深 → 读出"水深"层次而非死板蓝块。
          // 配合河岸芦苇(bakeScatter RIVER_EDGE) 一起软化硬边观感。
          const cx2 = (top.x + bottom.x) / 2;
          const cy2 = (top.y + bottom.y) / 2;
          const k = 0.58;
          const ins = (p: { x: number; y: number }) => ({ x: cx2 + (p.x - cx2) * k, y: cy2 + (p.y - cy2) * k });
          g.fillStyle(0x2d536e, 1); // 深水
          g.fillPoints([ins(top), ins(right), ins(bottom), ins(left)], true);
        }
      }
    }
  }

  /**
   * 地形贴图层：把无缝纹理(terrain_<t>.png)贴到对应地形 tile 上。
   * 用 TileSprite(平铺纹理)+ 类型 GeometryMask(裁成该地形的菱形群)——避开当年出畸变的 RenderTexture。
   * TileSprite 超尺寸覆盖整图、由遮罩裁形；深度 -9（纯色地形 -10 之上、节点/建筑/散布之下）。
   * 一次性烘焙；随 recenter 平移。缺纹理则跳过（该地形保留纯色）。
   * 测试期先只贴 'plain'（最大片米黄）；验证不畸变后再扩到其余地形。
   */
  private bakeTerrainTexture(accessor: WorldMapAccessor): void {
    for (const l of this.terrainTexLayers) { l.sprite.destroy(); l.maskGfx.destroy(); }
    this.terrainTexLayers = [];
    const textures = this.scene.textures;
    if (!textures || typeof textures.exists !== 'function') return;
    const TYPES = ['plain', 'hills', 'forest', 'mountain', 'river']; // 全地形真实地貌
    const margin = ISO_TILE_W;
    for (const terr of TYPES) {
      const key = `terrain_${terr}`;
      if (!textures.exists(key)) continue;
      const maskGfx = this.scene.add.graphics({ x: this.originX, y: this.originY }).setVisible(false);
      maskGfx.fillStyle(0xffffff, 1);
      let any = false;
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const tile = accessor.getTile(x, y);
          if (!tile || tile.terrain !== terr) continue;
          any = true;
          maskGfx.fillPoints(
            [this.isoVert(x, y), this.isoVert(x + 1, y), this.isoVert(x + 1, y + 1), this.isoVert(x, y + 1)], true);
        }
      }
      if (!any) { maskGfx.destroy(); continue; }
      const sprite = this.scene.add
        .tileSprite(this.originX - margin, this.originY, this.mapPxW + margin * 2, this.mapPxH, key)
        .setOrigin(0, 0);
      sprite.setMask(maskGfx.createGeometryMask());
      sprite.setDepth(-9);
      this.terrainTexLayers.push({ sprite, maskGfx });
    }
  }

  /**
   * W4 散布层：按 scatterConfig 在地形上撒树/石/草（确定性 PRNG，per-tile 不变）。
   * 绝对坐标精灵，一次性烘焙；resize 由 recenter() 平移（同建筑精灵），故不在热路径。
   * 缺素材的 pool 项自动跳过（texture 不存在）。深度 = 基底世界 y，与建筑精灵正确穿插。
   */
  private bakeScatter(accessor: WorldMapAccessor, occupied?: Set<string>): void {
    for (const im of this.scatterImages) im.destroy();
    this.scatterImages = [];
    const textures = this.scene.textures;
    if (!textures || typeof textures.exists !== 'function') return;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (occupied && occupied.has(`${x},${y}`)) continue; // 跳过建筑占用格，避免树/石叠在建筑上
        const tile = accessor.getTile(x, y);
        if (!tile) continue;
        const rng = createRng((Math.imul(x, 92837111) ^ Math.imul(y, 689287499)) >>> 0);
        const c = this.isoCenter(x, y);
        if (tile.terrain === 'river') {
          // 河岸：river tile 的 4-邻里有非 river → 按 RIVER_EDGE 放芦苇/水草。
          const isEdge = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([ddx, ddy]) => {
            const nt = accessor.getTile(x + ddx, y + ddy);
            return !!nt && nt.terrain !== 'river';
          });
          if (isEdge && rng.next() <= RIVER_EDGE.prob) this.emitScatter(RIVER_EDGE, rng, c.x, c.y, textures);
          continue;
        }
        const cfg = SCATTER_BY_TERRAIN[tile.terrain];
        if (!cfg || cfg.slots.length === 0) continue;
        for (const slot of cfg.slots) {
          if (rng.next() > slot.prob) continue;
          this.emitScatter(slot, rng, c.x, c.y, textures);
        }
      }
    }
  }

  /** 按一个 slot 放一个散布精灵：从有素材的 pool 项中 prng 选，jitter+缩放抖动+50%翻转。 */
  private emitScatter(
    slot: ScatterSlot, rng: RngHandle, cx: number, cy: number, textures: Phaser.Textures.TextureManager,
  ): void {
    const avail = slot.pool.filter((id) => textures.exists(SCATTER_KEY_PREFIX + id));
    if (avail.length === 0) return;
    const pick = avail[Math.floor(rng.next() * avail.length)] ?? avail[0];
    const key = SCATTER_KEY_PREFIX + pick;
    const scaleTiles = slot.minScale + rng.next() * (slot.maxScale - slot.minScale);
    const jx = (rng.next() - 0.5) * MapRenderer.ISO_HW * 0.7;
    const jy = (rng.next() - 0.5) * MapRenderer.ISO_HH * 0.7;
    const wx = this.originX + cx + jx;
    const wy = this.originY + cy + jy;
    const im = this.scene.add.image(wx, wy, key).setOrigin(0.5, 1);
    const nativeH = (im.height as number) || ISO_TILE_H;
    let s = (scaleTiles * ISO_TILE_H) / nativeH;
    if (!Number.isFinite(s) || s <= 0) s = 0.1;
    im.setScale(s);
    if (rng.next() < 0.5) im.setFlipX(true);
    im.setDepth(wy);
    if (this.viewportMask) im.setMask(this.viewportMask);
    this.scatterImages.push(im);
  }

  private bakeResourceNodes(accessor: WorldMapAccessor): void {
    const g = this.nodesGfx;
    if (!g) return;
    g.clear();
    const map = accessor.toRaw();
    for (const n of map.resourceNodes) {
      // 防御：mapGen 之外的 source（存档损坏 / 未来 bug）可能塞越界节点。
      // 越界就跳过 + warn，宁可丢失节点也不画到 graphics 区域外覆盖 UI。
      if (!accessor.inBounds(n.position.x, n.position.y)) {
        console.warn('[MapRenderer] skipping out-of-bounds resource node:', n);
        continue;
      }
      // 美术修：从刺眼的实心大方块改为**小而柔的菱形 pip**——半透明、贴在 tile 右上角，
      // 读作"此处有物产"的标记，不再是程序色块（手绘地貌上不违和）。
      const color = resourceNodeColor(n.kind);
      const r = ISO_TILE_H * 0.32; // pip 半径（相对 tile 高）
      const c = this.isoCenter(n.position.x, n.position.y);
      const cx = c.x;
      const cy = c.y - ISO_TILE_H * 0.25; // 稍微上移，浮在菱形上方
      // 暗色描边垫底（提升对比、像枚徽记）
      g.fillStyle(COLORS.INK, 0.45);
      g.fillPoints([
        { x: cx, y: cy - r - 1.2 }, { x: cx + r + 1.2, y: cy },
        { x: cx, y: cy + r + 1.2 }, { x: cx - r - 1.2, y: cy },
      ], true);
      // 物产色菱形（半透明，融进地面）
      g.fillStyle(color, 0.8);
      g.fillPoints([
        { x: cx, y: cy - r }, { x: cx + r, y: cy },
        { x: cx, y: cy + r }, { x: cx - r, y: cy },
      ], true);
      // 高光小点
      g.fillStyle(COLORS.PAPER, 0.5);
      g.fillCircle(cx - r * 0.25, cy - r * 0.3, r * 0.22);
    }
  }

  /** 重画 buildings layer。每次 BUILDING_PLACED / BUILDING_COMPLETED 触发。 */
  rerenderBuildings(buildings: readonly BuildingInstance[]): void {
    const g = this.buildingsGfx;
    if (!g) return;
    g.clear();
    // 池子先全部隐藏，下面按需逐个亮起
    for (const t of this.sigilTexts) t.setVisible(false);
    for (const im of this.buildingImages) im.setVisible(false);
    let sigilIdx = 0; // 沙印 text 池索引：每栋建筑占一槽
    let imgIdx = 0;   // 建筑精灵池索引：仅"有原画"的建筑占槽（与 sigil 池解耦，避免有图/无图交错时错位）

    const textures = this.scene.textures;
    for (const b of buildings) {
      const def = getBuildingDef(b.defId);
      if (!def) continue;
      const wT = def.size.width;
      const hT = def.size.height;
      // 等距：footprint 块的四个角（格点投影）→ 菱形；水平中心 cx、最低点 frontY、等距宽 isoW
      const topV = this.isoVert(b.position.x, b.position.y);
      const rightV = this.isoVert(b.position.x + wT, b.position.y);
      const botV = this.isoVert(b.position.x + wT, b.position.y + hT);
      const leftV = this.isoVert(b.position.x, b.position.y + hT);
      const cx = (topV.x + botV.x) / 2;
      const frontY = botV.y;
      const isoW = rightV.x - leftV.x;
      const diamond = [topV, rightV, botV, leftV];
      // 深度：按屏幕 y（块最低点）排序，越靠下越前，遮挡正确
      const depth = frontY;

      const isWorking = b.status === 'working';
      const hasSprite = !!textures && typeof textures.exists === 'function' && textures.exists(def.assetKey);

      // 仅"缺图占位"建筑才画菱形（填色 + 金边 footprint）。
      // 有原画的建筑不再画 footprint 金边：① 符合"地图无格线/像纪元"设计铁律；
      // ② AI 原画地基与引擎精确 2:1 网格无法像素级重合，画出参照线只会把这点误差暴露成"没对齐"。
      if (!hasSprite) {
        const fill = isWorking ? COLORS.WOOD : COLORS.WOOD_LIGHT;
        g.fillStyle(fill, isWorking ? 1 : 0.6);
        g.fillPoints(diamond, true);
        g.lineStyle(2, COLORS.GOLD_DIM, 1);
        g.strokePoints(diamond, true);
        if (def.tier >= 3) {
          g.lineStyle(1, COLORS.GOLD, 0.9);
          g.strokePoints(diamond, true);
        }
      }

      // sprite：bottom-center 锚在 footprint 前下角，宽度≈等距块宽（方形原画，等比）
      let im = this.buildingImages[imgIdx];
      if (hasSprite) {
        if (!im) {
          im = this.scene.add.image(0, 0, def.assetKey).setOrigin(0.5, 1);
          if (this.viewportMask) im.setMask(this.viewportMask);
          this.buildingImages.push(im);
          this.buildingImageLastKey.push(def.assetKey);
        } else if (this.buildingImageLastKey[imgIdx] !== def.assetKey) {
          im.setTexture(def.assetKey);
          this.buildingImageLastKey[imgIdx] = def.assetKey;
        }
        // 数据驱动锚点(buildingAnchors)：把"原画里地基的前下顶点"锚到 footprint 前下顶点，
        // 并让"原画里地基宽 = footprintWidthFrac×原画宽"缩放到地块等距宽 isoW，使菱形地基正好叠在地块上。
        // X 用 cx(footprint 水平中心，正方形 footprint 下 = botV.x；对非正方形也正确)，Y 用前下顶点 botV.y。
        const a = getBuildingAnchor(def.assetKey);
        im.setOrigin(a.anchorXFrac, a.anchorYFrac);
        im.setPosition(this.originX + cx, this.originY + botV.y);
        const nativeW = (im.width as number) || isoW;
        // 缩放：原画地基宽 → isoW。footprintWidthFrac/nativeW 异常时回退整宽；再 clamp 防细高建筑 scale 爆炸。
        const denom = a.footprintWidthFrac * nativeW;
        let scale = denom > 0 ? isoW / denom : (nativeW > 0 ? isoW / nativeW : 1);
        if (!Number.isFinite(scale)) scale = nativeW > 0 ? isoW / nativeW : 1;
        scale = Math.min(scale, MAP_BUILDING_MAX_SCALE);
        im.setScale(scale);
        im.setAlpha(isWorking ? 1 : 0.55);
        im.setDepth(depth);
        im.setVisible(true);
        if (FARM_BUILDING_IDS.has(b.defId) && isWorking) {
          im.setTint(FARM_SEASON_TINTS[this.currentSeason]);
        }
        imgIdx++;
      }

      // 沙印 fallback（缺图时）：footprint 中心
      const center = this.isoCenter(b.position.x + (wT - 1) / 2, b.position.y + (hT - 1) / 2);
      const sigil = getBuildingSigil(b.defId, def.name);
      const fontPx = Math.max(12, Math.floor(Math.min(isoW, ISO_TILE_H * (wT + hT)) * 0.4));
      const wantColor = isWorking ? COLORS_HEX.GOLD : COLORS_HEX.PAPER_DIM;
      let t = this.sigilTexts[sigilIdx];
      if (!t) {
        t = this.scene.add.text(0, 0, '', {
          fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
          fontSize: `${fontPx}px`,
          color: wantColor,
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5);
        if (this.viewportMask) t.setMask(this.viewportMask);
        this.sigilTexts.push(t);
        this.sigilLastFontPx.push(fontPx);
        this.sigilLastColor.push(wantColor);
      } else {
        if (this.sigilLastFontPx[sigilIdx] !== fontPx) {
          t.setFontSize(fontPx);
          this.sigilLastFontPx[sigilIdx] = fontPx;
        }
        if (this.sigilLastColor[sigilIdx] !== wantColor) {
          t.setColor(wantColor);
          this.sigilLastColor[sigilIdx] = wantColor;
        }
      }
      t.setPosition(this.originX + center.x, this.originY + center.y);
      t.setText(sigil);
      t.setAlpha(isWorking ? 1 : 0.7);
      t.setDepth(depth);
      t.setVisible(!hasSprite);
      sigilIdx++;
    }
    // 池只增不减会泄漏（DeepSeek 二审 memory）：截断多余槽位
    while (this.sigilTexts.length > sigilIdx) {
      this.sigilTexts.pop()?.destroy();
      this.sigilLastFontPx.pop();
      this.sigilLastColor.pop();
    }
    while (this.buildingImages.length > imgIdx) {
      this.buildingImages.pop()?.destroy();
      this.buildingImageLastKey.pop();
    }

    // A-4：建筑微动画 — 重建粒子发射器
    this.syncBuildingEmitters(buildings);

    // W4：建筑增减后重烘散布层，跳过建筑占用的格子（避免树/石叠在建筑上）。
    // 放置不频繁，一次性重烘可接受；散布是确定性的，重烘后位置稳定不变。
    const occupied = new Set<string>();
    for (const b of buildings) {
      const bd = getBuildingDef(b.defId);
      const bw = bd?.size.width ?? 1;
      const bh = bd?.size.height ?? 1;
      for (let dx = 0; dx < bw; dx++) {
        for (let dy = 0; dy < bh; dy++) occupied.add(`${b.position.x + dx},${b.position.y + dy}`);
      }
    }
    this.bakeScatter(this.accessor, occupied);
  }

  /** Slice E hooks: convert screen → grid coords. Useful for click-to-place. */
  screenToGrid(screenX: number, screenY: number): { x: number; y: number } | null {
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
    // 世界 → 图层局部 → 去 isoOffsetX → 等距逆投影 → floor 取格
    const lx = screenX - this.originX - this.isoOffsetX;
    const ly = screenY - this.originY;
    const a = lx / MapRenderer.ISO_HW;
    const bb = ly / MapRenderer.ISO_HH;
    const x = Math.floor((a + bb) / 2);
    const y = Math.floor((bb - a) / 2);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return { x, y };
  }

  /**
   * 当前视口中心对准的格子（resize 时用：origin/zoom 都会变，用格子坐标做"锚"最稳）。
   * 与 screenToGrid 不同——这里把超界点**夹回边界**而非返回 null，保证总能拿到一个对准目标。
   */
  private viewportCenterTile(): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    const z = (cam.zoom as number | undefined) || 1;
    const vp = this.computeViewportRect(cam.width, cam.height);
    // 视口中心屏幕点 → 世界点（world = scroll + screen/zoom）
    const worldX = ((cam.scrollX as number | undefined) || 0) + (vp.x + vp.w / 2) / z;
    const worldY = ((cam.scrollY as number | undefined) || 0) + (vp.y + vp.h / 2) / z;
    const lx = worldX - this.originX - this.isoOffsetX;
    const ly = worldY - this.originY;
    const a = lx / MapRenderer.ISO_HW;
    const bb = ly / MapRenderer.ISO_HH;
    const x = Math.max(0, Math.min(this.width - 1, Math.round((a + bb) / 2)));
    const y = Math.max(0, Math.min(this.height - 1, Math.round((bb - a) / 2)));
    return { x, y };
  }

  /** grid 坐标 → 屏幕像素（该 tile 菱形中心）。 */
  gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const c = this.isoCenter(gridX, gridY);
    return { x: this.originX + c.x, y: this.originY + c.y };
  }

  /** 格子中心 → 最终屏幕像素（含相机 scroll/zoom；相机 origin 已设 (0,0)）。
   *  用于把 popover 锚到建筑地基屏幕位置，而非鼠标点（点高屋顶会离地基很远）。 */
  gridToScreenPixel(gridX: number, gridY: number): { x: number; y: number } {
    const w = this.gridToScreen(gridX, gridY);
    const cam = this.scene.cameras.main;
    const z = (cam.zoom as number | undefined) || 1;
    const sx = (cam.scrollX as number | undefined) || 0;
    const sy = (cam.scrollY as number | undefined) || 0;
    return { x: (w.x - sx) * z, y: (w.y - sy) * z };
  }

  /** 单 tile 像素尺寸（DOM overlay 用同样的 TILE_SIZE）。 */
  getTileSize(): number {
    return TILE_SIZE;
  }

  /** 地图的左上角屏幕坐标（DOM overlay panel 对齐用）。 */
  getOrigin(): { x: number; y: number } {
    return { x: this.originX, y: this.originY };
  }

  /** 地图尺寸（grid）。 */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /**
   * Slice I：建筑落地（BUILDING_PLACED）的 fade+scale 入场动画。
   * 一个临时金色矩形从 1.5x scale + 高 alpha 缓动到 1x scale + alpha 0，350ms 内消失。
   * 不画金边只画半透明 fill —— 与 pulseBuildingCompleted 的金边脉冲视觉上能区分（落地=温和，建成=金边亮一下）。
   */
  pulseBuildingPlacement(b: BuildingInstance): void {
    if (this.destroyed) return;
    const def = getBuildingDef(b.defId);
    if (!def) return;
    const d = this.footprintDiamond(b.position.x, b.position.y, def.size.width, def.size.height);
    const g = this.scene.add.graphics({ x: this.originX + d.cx, y: this.originY + d.cy });
    g.fillStyle(COLORS.GOLD, 0.55);
    g.fillPoints(d.rel, true);
    g.lineStyle(2, COLORS.GOLD, 0.9);
    g.strokePoints(d.rel, true);
    g.setScale(1.5);
    g.setAlpha(0.85);
    // v0.9：脉冲也走视口 mask，避免脉冲在 HUD/面板上闪
    if (this.viewportMask) g.setMask(this.viewportMask);

    const tween = this.scene.tweens.add({
      targets: g,
      scale: 1,
      alpha: 0,
      duration: 350,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.destroyed) return;
        const idx = this.activePulses.findIndex(p => p.g === g);
        if (idx >= 0) this.activePulses.splice(idx, 1);
        g.destroy();
      },
    });
    this.activePulses.push({ g, tween });
  }

  /**
   * Slice H：建造完成时的金边脉冲——亮一下，800ms 内淡出并销毁。
   * 调用方在 BUILDING_COMPLETED 事件回调里调一次即可（GameScene 已接线）。
   * 多个 pulse 可以并存（玩家高速建多个建筑）。
   */
  pulseBuildingCompleted(b: BuildingInstance): void {
    if (this.destroyed) return;
    const def = getBuildingDef(b.defId);
    if (!def) return;
    const d = this.footprintDiamond(b.position.x, b.position.y, def.size.width, def.size.height);
    const g = this.scene.add.graphics({ x: this.originX + d.cx, y: this.originY + d.cy });
    // 金边菱形脉冲
    g.lineStyle(3, COLORS.GOLD, 1);
    g.strokePoints(d.rel, true);
    // v0.9：完成脉冲也走视口 mask
    if (this.viewportMask) g.setMask(this.viewportMask);

    // 淡出 + 自销。DeepSeek 二审 critical：destroyed-guard 防止 destroy 后 onComplete 仍触发；
    // 同时把 tween 入活跃池，destroy() 能 stop() 它（多保险）
    const tween = this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: MapRenderer.PULSE_MS,
      onComplete: () => {
        if (this.destroyed) return;
        const idx = this.activePulses.findIndex(p => p.g === g);
        if (idx >= 0) this.activePulses.splice(idx, 1);
        g.destroy();
      },
    });
    this.activePulses.push({ g, tween });
  }

  /**
   * Phase4 Juice：在某格中心上方冒一行飘字，1.1s 内上浮 ~34px 并淡出后自销。
   * 用于建成/晋阶/资源大变动等"有反馈"的瞬间。缺坐标/越界/destroyed 时静默 no-op。
   * 多条可并存；走视口 mask，避免在 HUD/面板上飘。
   */
  private static readonly MAX_FLOATS = 6;
  floatTextAtTile(gridX: number, gridY: number, text: string, colorHex: number): void {
    if (this.destroyed || !text) return;
    if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) return;
    // DeepSeek 复审：并发上限，防一 tick 内多座同时完工堆积过多 tween 卡帧——超限丢最早的。
    while (this.floatLabels.length >= MapRenderer.MAX_FLOATS) {
      const oldest = this.floatLabels.shift();
      if (oldest) { oldest.tween.stop(); oldest.t.destroy(); }
    }
    const c = this.isoCenter(gridX, gridY);
    const cx = this.originX + c.x;
    const cy = this.originY + c.y - ISO_TILE_H * 0.5;
    const t = this.scene.add.text(cx, cy, text, {
      fontFamily: 'serif',
      fontSize: '15px',
      color: `#${colorHex.toString(16).padStart(6, '0')}`,
      stroke: '#1a1208',
      strokeThickness: 3,
    });
    t.setOrigin(0.5, 1);
    t.setDepth(60); // 在建筑/脉冲之上
    if (this.viewportMask) t.setMask(this.viewportMask);
    const tween = this.scene.tweens.add({
      targets: t,
      y: cy - 34,
      alpha: 0,
      duration: MapRenderer.FLOAT_MS,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.destroyed) return;
        const idx = this.floatLabels.findIndex(f => f.t === t);
        if (idx >= 0) this.floatLabels.splice(idx, 1);
        t.destroy();
      },
    });
    this.floatLabels.push({ t, tween });
  }

  /**
   * Slice G hardening：窗口缩放后重新计算 origin，让地图保持在新视口中央。
   * 4 个 graphics layer 都跟着移动；hover 在调用方下一次 pointermove 自然刷新。
   */
  recenter(): void {
    // DeepSeek 复审：destroy 后若仍有 resize/折叠事件触达，提前返回（虽然各层已 ?. + 数组清空，显式守卫更稳）
    if (this.destroyed) return;
    // v0.9：先刷 mask（视口可能因折叠变化），再算 origin
    this.refreshViewportMask();
    const cam = this.scene.cameras.main;
    const o = this.computeOrigin(cam.width, cam.height);
    const newOriginX = o.x;
    const newOriginY = o.y;
    if (newOriginX === this.originX && newOriginY === this.originY) return;
    const dx = newOriginX - this.originX;
    const dy = newOriginY - this.originY;
    this.originX = newOriginX;
    this.originY = newOriginY;
    this.terrainGfx?.setPosition(this.originX, this.originY);
    this.nodesGfx?.setPosition(this.originX, this.originY);
    this.buildingsGfx?.setPosition(this.originX, this.originY);
    this.hoverGfx?.setPosition(this.originX, this.originY);
    // sigil text 不在 buildingsGfx 容器内，要单独平移；隐藏的 text 也要跟着，否则下次复用错位
    for (const t of this.sigilTexts) t.setPosition(t.x + dx, t.y + dy);
    // sprite 同理：不在 buildingsGfx 容器内，单独平移
    for (const im of this.buildingImages) im.setPosition(im.x + dx, im.y + dy);
    // W4 散布精灵同理（绝对坐标，随 origin 平移）
    for (const im of this.scatterImages) im.setPosition(im.x + dx, im.y + dy);
    // 地形贴图层（TileSprite 在 originX-margin，遮罩在 origin）随 origin 平移
    for (const l of this.terrainTexLayers) {
      l.sprite.setPosition(l.sprite.x + dx, l.sprite.y + dy);
      l.maskGfx.setPosition(this.originX, this.originY);
    }
    // 进行中的脉冲也跟着移动（不然 resize 时正在闪的金边会卡在旧坐标）
    for (const p of this.activePulses) p.g.setPosition(this.originX, this.originY);
    // 飘字也跟着平移（它们用绝对坐标，不在 origin 容器里）
    for (const f of this.floatLabels) f.t.setPosition(f.t.x + dx, f.t.y + dy);
  }

  /**
   * 显示 / 隐藏建造预览。
   * - preview=null 隐藏
   * - valid=true → 半透明绿框；false → 半透明红框
   * 调用方负责传入 gridX/gridY（建议先 screenToGrid 再过来）。
   * 越界或 NaN 输入直接清空（防御 Slice E pointer 边界）。
   */
  setHoverPreview(
    preview: { gridX: number; gridY: number; w: number; h: number; valid: boolean } | null,
  ): void {
    const g = this.hoverGfx;
    if (!g) return;
    g.clear();
    if (!preview) return;
    const { gridX, gridY, w, h, valid } = preview;
    if (!Number.isFinite(gridX) || !Number.isFinite(gridY) || w <= 0 || h <= 0) return;
    // 等距：footprint 块菱形高亮（绿=可放 / 红=不可放）
    const top = this.isoVert(gridX, gridY);
    const right = this.isoVert(gridX + w, gridY);
    const bot = this.isoVert(gridX + w, gridY + h);
    const left = this.isoVert(gridX, gridY + h);
    const pts = [top, right, bot, left];
    const fill = valid ? COLORS.STONE_GREEN : COLORS.CINNABAR;
    g.fillStyle(fill, 0.35);
    g.fillPoints(pts, true);
    g.lineStyle(2, fill, 1);
    g.strokePoints(pts, true);
  }

  // ─── A-4：建筑微动画 ───────────────────────────────────────────

  private syncBuildingEmitters(buildings: readonly BuildingInstance[]): void {
    for (const em of this.buildingEmitters) em.destroy();
    this.buildingEmitters = [];
    if (this.destroyed) return;
    const addParticles = (this.scene.add as unknown as { particles?: Function }).particles;
    if (!addParticles) return;

    let totalParticles = 0;
    for (const b of buildings) {
      if (b.status !== 'working') continue;
      if (totalParticles >= 200) break;

      const def = getBuildingDef(b.defId);
      if (!def) continue;
      const wT = def.size.width;
      const hT = def.size.height;
      const topV = this.isoVert(b.position.x, b.position.y);
      const botV = this.isoVert(b.position.x + wT, b.position.y + hT);
      const cx = this.originX + (topV.x + botV.x) / 2;
      const topY = this.originY + topV.y;

      if (SMOKE_BUILDING_IDS.has(b.defId)) {
        const em = this.scene.add.particles(cx, topY, SMOKE_TEX_KEY, {
          speedY: { min: -25, max: -45 },
          speedX: { min: -8, max: 8 },
          scale: { start: 0.4, end: 1.0 },
          alpha: { start: 0.5, end: 0 },
          lifespan: 2000,
          quantity: 1,
          frequency: 280,
          maxParticles: 20,
        });
        em.setDepth(10000);
        this.buildingEmitters.push(em);
        totalParticles += 20;
      } else if (MARKET_BUILDING_IDS.has(b.defId)) {
        const frontY = this.originY + botV.y;
        const em = this.scene.add.particles(cx, frontY - 10, SPARKLE_TEX_KEY, {
          speedY: { min: -10, max: -20 },
          speedX: { min: -15, max: 15 },
          scale: { start: 0.6, end: 0 },
          alpha: { start: 0.8, end: 0 },
          lifespan: 1500,
          quantity: 1,
          frequency: 500,
          maxParticles: 10,
        });
        em.setDepth(10000);
        this.buildingEmitters.push(em);
        totalParticles += 10;
      }
    }
  }

  // ─── A-3：季节色调 ─────────────────────────────────────────────

  private static readonly SEASON_TINTS: Record<0 | 1 | 2 | 3, number> = {
    0: 0xd4f0c0, // 春：嫩绿淡粉
    1: 0xf0e8a0, // 夏：深绿金黄
    2: 0xf0c070, // 秋：橙红棕褐
    3: 0xc8d8e8, // 冬：灰白青蓝
  };

  setSeasonTint(season: 0 | 1 | 2 | 3): void {
    this.currentSeason = season;
    const tint = MapRenderer.SEASON_TINTS[season];
    for (const im of this.scatterImages) {
      im.setTint(tint);
    }
    if (season === 3) {
      this.startSnow();
    } else {
      this.stopSnow();
    }
  }

  clearSeasonTint(): void {
    for (const im of this.scatterImages) {
      im.clearTint();
    }
    this.stopSnow();
  }

  private startSnow(): void {
    if (this.snowEmitter || this.destroyed) return;
    const addParticles = (this.scene.add as unknown as { particles?: Function }).particles;
    const make = (this.scene as unknown as { make?: { graphics?: Function } }).make;
    if (!addParticles || !make?.graphics) return;
    const texKey = '__snow_flake__';
    if (!this.scene.textures.exists(texKey)) {
      const g = make.graphics({ x: 0, y: 0 }, false) as Phaser.GameObjects.Graphics;
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(3, 3, 3);
      (g as unknown as { generateTexture(k: string, w: number, h: number): void }).generateTexture(texKey, 6, 6);
      g.destroy();
    }
    this.snowEmitter = this.scene.add.particles(0, 0, texKey, {
      x: { min: 0, max: this.mapPxW },
      y: -10,
      lifespan: 4000,
      speedY: { min: 20, max: 50 },
      speedX: { min: -10, max: 10 },
      scale: { start: 0.5, end: 0.2 },
      alpha: { start: 0.7, end: 0 },
      quantity: 1,
      frequency: 80,
      maxParticles: 50,
    });
    this.snowEmitter.setDepth(9999);
  }

  private stopSnow(): void {
    if (!this.snowEmitter) return;
    this.snowEmitter.destroy();
    this.snowEmitter = null;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.terrainGfx?.destroy();
    this.nodesGfx?.destroy();
    this.buildingsGfx?.destroy();
    this.hoverGfx?.destroy();
    this.terrainGfx = null;
    this.nodesGfx = null;
    this.buildingsGfx = null;
    this.hoverGfx = null;
    // v0.9 mask cleanup：destroy mask 实例 + mask graphic
    if (this.viewportMask) {
      this.viewportMask.destroy();
      this.viewportMask = null;
    }
    this.viewportMaskGfx?.destroy();
    this.viewportMaskGfx = null;
    for (const t of this.sigilTexts) t.destroy();
    this.sigilTexts = [];
    this.sigilLastFontPx = [];
    this.sigilLastColor = [];
    for (const im of this.buildingImages) im.destroy();
    for (const im of this.scatterImages) im.destroy();
    for (const l of this.terrainTexLayers) { l.sprite.destroy(); l.maskGfx.destroy(); }
    this.buildingImages = [];
    this.buildingImageLastKey = [];
    // 进行中的脉冲：先 stop tween（DeepSeek 二审 critical：避免 destroy 后 onComplete 仍触发），
    // 再 destroy graphics。onComplete 里也加了 this.destroyed 守卫，三层保险。
    for (const p of this.activePulses) {
      p.tween.stop();
      p.g.destroy();
    }
    this.activePulses = [];
    // 飘字同理：先停 tween 再销毁 Text
    for (const f of this.floatLabels) {
      f.tween.stop();
      f.t.destroy();
    }
    this.floatLabels = [];
    this.stopSnow();
    for (const em of this.buildingEmitters) em.destroy();
    this.buildingEmitters = [];
  }
}
