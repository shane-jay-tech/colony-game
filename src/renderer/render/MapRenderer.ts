import Phaser from 'phaser';
import type { WorldMapAccessor } from '../state/worldMap';
import type { BuildingInstance } from '../data/schema';
import { getBuildingDef } from '../data/buildingRegistry';
import { COLORS, COLORS_HEX, UI } from '../ui/palette';
import { terrainColor, resourceNodeColor, TILE_SIZE, NODE_MARKER_INSET } from './mapColors';
import { getBuildingSigil } from './buildingSigils';
import { drawTerrainHatching, makeTilePrng } from './terrainTextures';
import { SCATTER_BY_TERRAIN, RIVER_EDGE, SCATTER_KEY_PREFIX, ALL_SCATTER_IDS, type ScatterSlot } from '../data/scatterConfig';

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
  /** W3：手绘地貌烘焙层。地貌贴图齐备时 bake 进此 RT（单 GameObject，整图一次烘焙），
   *  缺贴图则为 null、回退 terrainGfx 的 fillRect 色块。 */
  private terrainRT: Phaser.GameObjects.RenderTexture | null = null;
  /** 每张贴图的 frame 网格边长（贴图边 / TILE_SIZE），用于 tile 取模采样 */
  private terrainGrid = new Map<string, number>();
  private static readonly TERRAIN_KEY_PREFIX = 'terrain_';
  /** W4：散布层（树/石/芦苇）。素材齐备时确定性 bake 进此 RT（深度 -5，介于地貌与建筑之间）。 */
  private scatterRT: Phaser.GameObjects.RenderTexture | null = null;
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

  /**
   * 计算地图 origin，使其居中于"可用视口"——扣除 HUD 顶栏 + 左 BuildPanel + 右 CourtPanel 后的中央矩形。
   * 这样地图在小屏 / 大屏 / 缩放后都不会被左右面板压出视觉黑边，对称性正确。
   * v0.9：地图大于视口时会被 mask 裁剪到视口内，绝对不会渗到 HUD/面板后面。
   */
  private computeOrigin(camWidth: number, camHeight: number): { x: number; y: number } {
    const vp = this.computeViewportRect(camWidth, camHeight);
    const mapW = this.width * TILE_SIZE;
    const mapH = this.height * TILE_SIZE;
    return {
      x: vp.x + Math.floor((vp.w - mapW) / 2),
      y: vp.y + Math.floor((vp.h - mapH) / 2),
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

  /** v1.0 #5：重置缩放与平移到默认（zoom=1, scroll=0；此时由 originX/originY 保证地图居中）。 */
  resetView(): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    if (typeof cam.setZoom === 'function') cam.setZoom(1);
    cam.scrollX = 0;
    cam.scrollY = 0;
    this.refreshViewportMask();
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
    const mapW = this.width * TILE_SIZE;
    const mapH = this.height * TILE_SIZE;
    const mapLeft = this.originX;
    const mapRight = this.originX + mapW;
    const mapTop = this.originY;
    const mapBottom = this.originY + mapH;
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

  constructor(scene: Phaser.Scene, accessor: WorldMapAccessor) {
    const dim = accessor.getDimensions();
    this.width = dim.width;
    this.height = dim.height;
    this.scene = scene;

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
    this.bakeScatter(accessor);
    this.bakeResourceNodes(accessor);
  }

  private bakeTerrain(accessor: WorldMapAccessor): void {
    const g = this.terrainGfx;
    if (!g) return;
    g.clear();
    // W3：地貌贴图齐备 → 烘焙手绘地貌进 RT（terrainGfx 留空）；否则回退色块+墨点。
    if (this.tryBakeTerrainTextures(accessor)) return;
    // DeepSeek 复审[major]：回退路径——若之前建过 RT，清空并隐藏，避免旧地貌从色块下透出。
    if (this.terrainRT) { this.terrainRT.clear(); this.terrainRT.setVisible(false); }

    const map = accessor.toRaw();
    // 第一遍：solid color fill
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = accessor.getTile(x, y);
        if (!tile) continue;
        g.fillStyle(terrainColor(tile.terrain), 1);
        g.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    // 第二遍：terrain hatching（Slice H 古纸纹理叠层）
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = accessor.getTile(x, y);
        if (!tile) continue;
        drawTerrainHatching(g, tile.terrain, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, map.seed, x, y, this.width);
      }
    }
    // 不画网格线 — 视觉路线对齐 Anno 1800：底层逻辑可方格但渲染层无任何格线
  }

  /** W3：把贴图切成 GRID×GRID 个 TILE_SIZE 的 frame（连续采样平铺用），只切一次。
   *  非正方贴图按短边取正方网格（多出的边丢弃，简单可控）。 */
  private sliceTerrainFrames(key: string): number {
    const tex = this.scene.textures.get(key);
    const cached = this.terrainGrid.get(key);
    // DeepSeek 复审[critical]：缓存命中也要确认 frame 仍在（贴图被重建时 frame 会丢）；丢了就重切。
    if (cached !== undefined && tex.has('t_0_0')) return cached;
    const src = tex.getSourceImage() as { width: number; height: number };
    const grid = Math.max(1, Math.floor(Math.min(src.width, src.height) / TILE_SIZE));
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const fn = `t_${c}_${r}`;
        if (!tex.has(fn)) tex.add(fn, 0, c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this.terrainGrid.set(key, grid);
    return grid;
  }

  /**
   * W3：手绘地貌烘焙。仅当地图用到的每种地形都已加载贴图时才走（全有或全无，
   * 否则回退色块保持现观感）。逐 tile 用连续采样的 frame（tile%grid）batchDrawFrame 进单个 RT，
   * 同型相邻 tile 取相邻 cell → 纹理连续流动，每 grid(≈42) tile 重复一次。
   * @returns true=已烘焙进 RT；false=贴图不全，调用方走色块回退
   */
  private tryBakeTerrainTextures(accessor: WorldMapAccessor): boolean {
    // 收集地图实际用到的地形类型
    const used = new Set<string>();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = accessor.getTile(x, y);
        if (t) used.add(t.terrain);
      }
    }
    // 任一类型缺贴图 → 放弃，回退色块
    for (const terr of used) {
      if (!this.scene.textures.exists(MapRenderer.TERRAIN_KEY_PREFIX + terr)) return false;
    }
    const mapW = this.width * TILE_SIZE;
    const mapH = this.height * TILE_SIZE;
    // DeepSeek 复审[major]：尺寸变化（理论上 dims 实例内不可变，防御）→ 重建 RT，避免旧尺寸裁切。
    if (this.terrainRT && (this.terrainRT.width !== mapW || this.terrainRT.height !== mapH)) {
      this.terrainRT.destroy();
      this.terrainRT = null;
    }
    if (!this.terrainRT) {
      this.terrainRT = this.scene.add.renderTexture(this.originX, this.originY, mapW, mapH).setOrigin(0, 0);
      this.terrainRT.setDepth(-10); // 在 nodes/buildings 之下
      if (this.viewportMask) this.terrainRT.setMask(this.viewportMask);
    }
    this.terrainRT.setVisible(true); // 回退后可能被隐藏过，恢复
    this.terrainRT.clear();
    this.terrainRT.beginDraw();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = accessor.getTile(x, y);
        if (!tile) continue;
        const key = MapRenderer.TERRAIN_KEY_PREFIX + tile.terrain;
        const grid = this.sliceTerrainFrames(key);
        const fn = `t_${x % grid}_${y % grid}`;
        this.terrainRT.batchDrawFrame(key, fn, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
    this.terrainRT.endDraw();
    return true;
  }

  /**
   * W4：散布层烘焙。把一棵棵树/石/芦苇（与建筑同 2.5D 角）确定性散布进 scatterRT，
   * 营造《法老》式有机大地 + 用立体物盖过"地面正俯视 vs 建筑斜视"的违和。
   * 缺素材（无任何 scatter_* 贴图）→ 跳过、不建 RT（优雅降级，回到无散布）。
   * 确定性：同 seed+tile → 同布局（makeTilePrng），存档重载不变。建筑层(depth0)自然盖住其下散布。
   */
  private bakeScatter(accessor: WorldMapAccessor): void {
    if (this.destroyed) return;
    const haveAny = ALL_SCATTER_IDS.some(id => this.scene.textures.exists(SCATTER_KEY_PREFIX + id));
    if (!haveAny) return; // 素材未就位 → 无散布
    const map = accessor.toRaw();
    const seed = map.seed;
    const mapW = this.width * TILE_SIZE;
    const mapH = this.height * TILE_SIZE;
    // 尺寸变化（dims 实例内不可变，防御）→ 重建（与 terrainRT 对齐）
    if (this.scatterRT && (this.scatterRT.width !== mapW || this.scatterRT.height !== mapH)) {
      this.scatterRT.destroy();
      this.scatterRT = null;
    }
    if (!this.scatterRT) {
      this.scatterRT = this.scene.add.renderTexture(this.originX, this.originY, mapW, mapH).setOrigin(0, 0);
      this.scatterRT.setDepth(-5); // 地貌(-10) 之上、建筑(0) 之下
      if (this.viewportMask) this.scatterRT.setMask(this.viewportMask);
    }
    this.scatterRT.clear();

    // 复用一个临时 Image 做逐个 draw（用完即毁，不进显示列表渲染帧）
    const firstKey = SCATTER_KEY_PREFIX + (ALL_SCATTER_IDS.find(id => this.scene.textures.exists(SCATTER_KEY_PREFIX + id)) ?? '');
    const tmp = this.scene.add.image(0, 0, firstKey).setOrigin(0.5, 1);
    tmp.setVisible(false);

    const placeOne = (slot: ScatterSlot, prng: () => number, gx: number, gy: number): void => {
      const id = slot.pool[Math.floor(prng() * slot.pool.length) % slot.pool.length]!;
      const key = SCATTER_KEY_PREFIX + id;
      if (!this.scene.textures.exists(key)) return; // 该素材缺 → 跳过这个
      const scaleTiles = slot.minScale + prng() * (slot.maxScale - slot.minScale);
      const px = gx * TILE_SIZE + TILE_SIZE / 2 + (prng() - 0.5) * TILE_SIZE * 0.6;
      const py = gy * TILE_SIZE + TILE_SIZE * 0.88 + (prng() - 0.5) * TILE_SIZE * 0.3;
      tmp.setTexture(key);
      tmp.setDisplaySize(scaleTiles * TILE_SIZE, scaleTiles * TILE_SIZE);
      tmp.setFlipX(prng() < 0.5);
      tmp.setPosition(px, py);
      // batchDraw 把当前 tmp 的顶点即时拷进批缓冲（复用 tmp 安全），比逐个 draw() 少几千次 GPU flush
      this.scatterRT!.batchDraw(tmp);
    };

    this.scatterRT.beginDraw();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const tile = accessor.getTile(x, y);
        if (!tile) continue;
        const prng = makeTilePrng(seed, x, y, this.width);
        if (tile.terrain === 'river') {
          // 河岸：仅与非水相邻的边缘 tile 放芦苇
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const n = accessor.getTile(x + dx!, y + dy!);
            return n != null && n.terrain !== 'river';
          });
          if (edge && prng() < RIVER_EDGE.prob) placeOne(RIVER_EDGE, prng, x, y);
          continue;
        }
        const cfg = SCATTER_BY_TERRAIN[tile.terrain];
        if (!cfg) continue;
        for (const slot of cfg.slots) {
          if (prng() < slot.prob) placeOne(slot, prng, x, y);
        }
      }
    }
    this.scatterRT.endDraw();
    tmp.destroy();
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
      const r = TILE_SIZE * 0.18; // 小菱形半径
      const cx = n.position.x * TILE_SIZE + TILE_SIZE * 0.72;
      const cy = n.position.y * TILE_SIZE + TILE_SIZE * 0.28;
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
      const w = def.size.width * TILE_SIZE;
      const h = def.size.height * TILE_SIZE;
      const px = b.position.x * TILE_SIZE;
      const py = b.position.y * TILE_SIZE;

      const isWorking = b.status === 'working';
      // v0.9 Pillar 3.2：sprite 命中检测——已加载就走 image 路径，否则回退 fillRect+沙印
      const hasSprite = !!textures && typeof textures.exists === 'function' && textures.exists(def.assetKey);

      // v1.0 #4：tier 视觉差异化——T1 单线、T2 双线（外金内金）、T3 三线（外金 + 内金 + 中央 GOLD 高亮）
      const tier = def.tier;
      if (!hasSprite) {
        const fill = isWorking ? COLORS.WOOD : COLORS.WOOD_LIGHT;
        const alpha = isWorking ? 1 : 0.6;
        g.fillStyle(fill, alpha);
        g.fillRect(px + 1, py + 1, w - 2, h - 2);
      }
      // 外金边：所有 tier 都有
      g.lineStyle(2, COLORS.GOLD_DIM, 1);
      g.strokeRect(px + 1, py + 1, w - 2, h - 2);
      // T2/T3：内嵌金线（双重边框，让高阶建筑一眼看出）
      if (tier >= 2) {
        g.lineStyle(1, COLORS.GOLD_DIM, 0.7);
        g.strokeRect(px + 4, py + 4, w - 8, h - 8);
      }
      // T3：再加一圈醒目 GOLD（最里），象征鼎盛
      if (tier >= 3) {
        g.lineStyle(1, COLORS.GOLD, 0.9);
        g.strokeRect(px + 7, py + 7, w - 14, h - 14);
      }

      // 取/建当前 idx 的 sprite 槽
      let im = this.buildingImages[sigilIdx];
      if (hasSprite) {
        if (!im) {
          im = this.scene.add.image(0, 0, def.assetKey).setOrigin(0.5, 0.5);
          if (this.viewportMask) im.setMask(this.viewportMask);
          this.buildingImages.push(im);
          this.buildingImageLastKey.push(def.assetKey);
        } else if (this.buildingImageLastKey[sigilIdx] !== def.assetKey) {
          im.setTexture(def.assetKey);
          this.buildingImageLastKey[sigilIdx] = def.assetKey;
        }
        im.setPosition(this.originX + px + w / 2, this.originY + py + h / 2);
        im.setDisplaySize(w - 2, h - 2);
        im.setAlpha(isWorking ? 1 : 0.55);
        im.setVisible(true);
      }

      // 取/建当前 idx 的沙印槽（fallback 时用；sprite 路径下隐藏）
      const sigil = getBuildingSigil(b.defId, def.name);
      const minSide = Math.min(w, h);
      const fontPx = Math.max(12, Math.floor(minSide * 0.6));
      const wantColor = isWorking ? COLORS_HEX.GOLD : COLORS_HEX.PAPER_DIM;
      let t = this.sigilTexts[sigilIdx];
      if (!t) {
        t = this.scene.add.text(0, 0, '', {
          fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
          fontSize: `${fontPx}px`,
          color: wantColor,
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5);
        t.setPosition(this.originX + px + w / 2, this.originY + py + h / 2);
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
        t.setPosition(this.originX + px + w / 2, this.originY + py + h / 2);
      }
      t.setText(sigil);
      t.setAlpha(isWorking ? 1 : 0.7);
      // sprite 命中时沙印整体隐藏（避免字浮在 sprite 上）；缺图时显示
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
    const lx = screenX - this.originX;
    const ly = screenY - this.originY;
    const x = Math.floor(lx / TILE_SIZE);
    const y = Math.floor(ly / TILE_SIZE);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    return { x, y };
  }

  /** 把 grid 坐标 → 屏幕像素（左上角）。Slice E 给 hover preview 等共享 origin 时用。 */
  gridToScreen(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: this.originX + gridX * TILE_SIZE,
      y: this.originY + gridY * TILE_SIZE,
    };
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
    const w = def.size.width * TILE_SIZE;
    const h = def.size.height * TILE_SIZE;
    const px = b.position.x * TILE_SIZE;
    const py = b.position.y * TILE_SIZE;

    // 用建筑中心做缩放原点：graphics x/y 设到中心 + 在本地坐标里画 -w/2 .. +w/2
    const g = this.scene.add.graphics({
      x: this.originX + px + w / 2,
      y: this.originY + py + h / 2,
    });
    g.fillStyle(COLORS.GOLD, 0.55);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(2, COLORS.GOLD, 0.9);
    g.strokeRect(-w / 2, -h / 2, w, h);
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
    const w = def.size.width * TILE_SIZE;
    const h = def.size.height * TILE_SIZE;
    const px = b.position.x * TILE_SIZE;
    const py = b.position.y * TILE_SIZE;

    const g = this.scene.add.graphics({ x: this.originX, y: this.originY });
    // 双层金边：3px 内框 + 1px 外光晕（4px 偏移）
    g.lineStyle(3, COLORS.GOLD, 1);
    g.strokeRect(px, py, w, h);
    g.lineStyle(1, COLORS.GOLD, 0.7);
    g.strokeRect(px - 3, py - 3, w + 6, h + 6);
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
    const cx = this.originX + gridX * TILE_SIZE + TILE_SIZE / 2;
    const cy = this.originY + gridY * TILE_SIZE;
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
    this.terrainRT?.setPosition(this.originX, this.originY);
    this.scatterRT?.setPosition(this.originX, this.originY);
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
    const px = gridX * TILE_SIZE;
    const py = gridY * TILE_SIZE;
    const pw = w * TILE_SIZE;
    const ph = h * TILE_SIZE;
    const fill = valid ? COLORS.STONE_GREEN : COLORS.CINNABAR;
    g.fillStyle(fill, 0.35);
    g.fillRect(px, py, pw, ph);
    g.lineStyle(2, fill, 1);
    g.strokeRect(px, py, pw, ph);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.terrainGfx?.destroy();
    this.terrainRT?.destroy();
    this.terrainRT = null;
    this.scatterRT?.destroy();
    this.scatterRT = null;
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
