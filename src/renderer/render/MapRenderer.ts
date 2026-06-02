import Phaser from 'phaser';
import type { WorldMapAccessor } from '../state/worldMap';
import type { BuildingInstance } from '../data/schema';
import { getBuildingDef } from '../data/buildingRegistry';
import { COLORS, COLORS_HEX, UI } from '../ui/palette';
import { terrainColor, resourceNodeColor, TILE_SIZE, NODE_MARKER_INSET } from './mapColors';
import { getBuildingSigil } from './buildingSigils';
import { ISO_TILE_W, ISO_TILE_H } from './iso';

/** v0.9：左右面板折叠时只露 28px 竖条；recompute 视口要靠它 */
export const PANEL_COLLAPSED_WIDTH = 28;

/** v1.0 #5：地图缩放范围。0.5 看全局，2.0 看细节。中间档由 ZOOM_STEP 控制 */
export const MAP_ZOOM_MIN = 0.5;
export const MAP_ZOOM_MAX = 2.0;
export const MAP_ZOOM_STEP = 0.1;

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
    const topInset = UI.topbarHeight + 8;
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

  /** 等距：格子顶点 → 图层局部坐标（含 isoOffsetX，保证 local x ≥ 0）。 */
  private isoVert(gx: number, gy: number): { x: number; y: number } {
    return { x: (gx - gy) * MapRenderer.ISO_HW + this.isoOffsetX, y: (gx + gy) * MapRenderer.ISO_HH };
  }

  /** 等距：格子中心 → 图层局部坐标（菱形中心，比顶点低半个 tile 高，便于精灵 bottom-center 落位）。 */
  private isoCenter(gx: number, gy: number): { x: number; y: number } {
    return {
      x: (gx - gy) * MapRenderer.ISO_HW + this.isoOffsetX,
      y: (gx + gy) * MapRenderer.ISO_HH + MapRenderer.ISO_HH,
    };
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
    const newZoom = Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, targetZoom));
    if (Math.abs(newZoom - oldZoom) < 1e-4) return oldZoom;
    const vp = this.computeViewportRect(cam.width, cam.height);
    const ax = anchorScreenX ?? (vp.x + vp.w / 2);
    const ay = anchorScreenY ?? (vp.y + vp.h / 2);
    // 锚点在世界坐标的位置（缩放前后必须一致 → 算 scroll 偏移）
    const sxOld = (cam.scrollX as number | undefined) || 0;
    const syOld = (cam.scrollY as number | undefined) || 0;
    const worldXAtAnchor = ax / oldZoom + sxOld;
    const worldYAtAnchor = ay / oldZoom + syOld;
    if (typeof cam.setZoom === 'function') cam.setZoom(newZoom);
    cam.scrollX = worldXAtAnchor - ax / newZoom;
    cam.scrollY = worldYAtAnchor - ay / newZoom;
    this.clampScroll();
    this.refreshViewportMask();
    return newZoom;
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
    if (typeof cam.setZoom === 'function') cam.setZoom(1);
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
    const mapLeft = this.originX;
    const mapRight = this.originX + this.mapPxW;
    const mapTop = this.originY;
    const mapBottom = this.originY + this.mapPxH;
    // X
    const minScrollX = mapLeft - vp.x / z;
    const maxScrollX = mapRight - (vp.x + vp.w) / z;
    if (minScrollX > maxScrollX) {
      cam.scrollX = 0;
    } else {
      const cur = (cam.scrollX as number | undefined) || 0;
      cam.scrollX = Math.max(minScrollX, Math.min(maxScrollX, cur));
    }
    // Y
    const minScrollY = mapTop - vp.y / z;
    const maxScrollY = mapBottom - (vp.y + vp.h) / z;
    if (minScrollY > maxScrollY) {
      cam.scrollY = 0;
    } else {
      const cur = (cam.scrollY as number | undefined) || 0;
      cam.scrollY = Math.max(minScrollY, Math.min(maxScrollY, cur));
    }
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
    // 只需重居中 + 重画各 Graphics 层。
    this.recenter();
    this.bakeTerrain(this.accessor);
    this.bakeResourceNodes(this.accessor);
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
    const o = this.computeOrigin(cam.width, cam.height);
    this.originX = o.x;
    this.originY = o.y;

    this.terrainGfx = scene.add.graphics({ x: this.originX, y: this.originY });
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

    // 等距大地图：开局把相机居中到地图中心（聚落区），而非几何包围盒中心，避免一进来看着偏。
    this.centerOnTile(Math.floor(this.width / 2), Math.floor(this.height / 2));
    // 地图外/菱形空角的底色用暗土色，避免露出刺眼纯黑（比 BG_INK 略暖、低调）。
    if (typeof scene.cameras.main.setBackgroundColor === 'function') {
      scene.cameras.main.setBackgroundColor(0x241d14);
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
        g.fillStyle(terrainColor(tile.terrain), 1);
        // 轻微外扩 0.5px 消相邻菱形抗锯齿缝
        g.fillPoints([top, right, bottom, left], true);
      }
    }
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
    let sigilIdx = 0;

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

      if (!hasSprite) {
        const fill = isWorking ? COLORS.WOOD : COLORS.WOOD_LIGHT;
        g.fillStyle(fill, isWorking ? 1 : 0.6);
        g.fillPoints(diamond, true);
      }
      // 金边 footprint 菱形（所有 tier）；高阶 tier 再叠一层提示
      g.lineStyle(2, COLORS.GOLD_DIM, 1);
      g.strokePoints(diamond, true);
      if (def.tier >= 3) {
        g.lineStyle(1, COLORS.GOLD, 0.9);
        g.strokePoints(diamond, true);
      }

      // sprite：bottom-center 锚在 footprint 前下角，宽度≈等距块宽（方形原画，等比）
      let im = this.buildingImages[sigilIdx];
      if (hasSprite) {
        if (!im) {
          im = this.scene.add.image(0, 0, def.assetKey).setOrigin(0.5, 1);
          if (this.viewportMask) im.setMask(this.viewportMask);
          this.buildingImages.push(im);
          this.buildingImageLastKey.push(def.assetKey);
        } else if (this.buildingImageLastKey[sigilIdx] !== def.assetKey) {
          im.setTexture(def.assetKey);
          this.buildingImageLastKey[sigilIdx] = def.assetKey;
        }
        // 等距原画自带菱形 footprint：bottom-center 锚在 tile footprint 的前下顶点，
        // 宽度=footprint 等距宽 → 原画的菱形地基正好叠在地块菱形上，建筑由此向上"立"起。
        im.setOrigin(0.5, 1);
        im.setPosition(this.originX + cx, this.originY + frontY);
        im.setDisplaySize(isoW * 1.05, isoW * 1.05);
        im.setAlpha(isWorking ? 1 : 0.55);
        im.setDepth(depth);
        im.setVisible(true);
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
    while (this.buildingImages.length > sigilIdx) {
      this.buildingImages.pop()?.destroy();
      this.buildingImageLastKey.pop();
    }
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

  /** grid 坐标 → 屏幕像素（该 tile 菱形中心）。 */
  gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    const c = this.isoCenter(gridX, gridY);
    return { x: this.originX + c.x, y: this.originY + c.y };
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
  }
}
