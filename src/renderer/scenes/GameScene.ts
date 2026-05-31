import Phaser from 'phaser';
import { GameStore, STATE_EVENTS } from '../state/gameStore';
import { MapRenderer, MAP_ZOOM_STEP } from '../render/MapRenderer';
import { BuildMode, checkBuildAt } from '../state/buildMode';
import type { BuildingInstance } from '../data/schema';
import { getBuildingDef } from '../data/buildingRegistry';
import type { Toast } from '../ui/Toast';
import { BuildingPopover } from '../ui/BuildingPopover';
import { TimeSystem } from '../state/timeSystem';
import { FONTS, UI } from '../ui/palette';
import { DYNASTY_TRANSITION_NARRATION, ENDING_NARRATION } from '../data/storyChapters';
import type { TransitionData } from './TransitionScene';
import type { EndingId } from '../state/storyDriver';

/**
 * GameScene：主舞台。
 *
 * Slice E 责任：
 *   - 从 game.registry 取出 GameStore + BuildMode
 *   - 用 MapRenderer 把 worldMap 画到屏幕上
 *   - 监听 BUILDING_PLACED / BUILDING_COMPLETED / STATE_REPLACED 重画 buildings layer
 *   - pointer move：BuildMode 激活时显示 hover 预览（绿/红）
 *   - pointer down：BuildMode 激活时尝试 placeBuilding；ESC 取消选中
 *   - 驱动 TimeSystem（按 store.speed/paused 推进 day）
 */
export class GameScene extends Phaser.Scene {
  private mapRenderer: MapRenderer | null = null;
  private store: GameStore | null = null;
  private buildMode: BuildMode | null = null;
  private timeSystem: TimeSystem | null = null;
  private offBuildModeChange: (() => void) | null = null;
  // v0.9 Pillar 2.4：建筑升级 popover（点击已建建筑时弹出）
  private buildingPopover: BuildingPopover | null = null;
  // pointermove last-frame cache（DeepSeek Medium：避免同格重绘 hover 预览）
  private lastHoverGridX = Number.NaN;
  private lastHoverGridY = Number.NaN;
  private lastHoverValid: boolean | null = null;
  // v0.9 hotfix#4：handleResize debounce + 安全网（同 UIScene 思路）。
  // maximize 时 Phaser RESIZE mode 会发若干次 resize 事件，每次同步 recenter() 会重画
  // viewport mask graphic；中间帧若给 0×0 / 极小尺寸，mask 形状变成 0×0 让整个地图层不可见。
  private resizeDebounce: number | null = null;
  private resizeSafetyNet: number | null = null;

  // v1.0 #5：中键拖动平移地图状态
  private isPanning = false;
  private lastPanX = 0;
  private lastPanY = 0;

  // Slice I：建筑落地额外触发 fade+scale 脉冲（与 BUILDING_PLACED 一起接线，建造瞬间给玩家反馈）
  private placedListener = (...args: unknown[]): void => {
    this.rerenderBuildings();
    const b = args[0] as BuildingInstance | undefined;
    if (b && b.position) this.mapRenderer?.pulseBuildingPlacement(b);
  };
  // Slice H：建造完成额外触发金边脉冲（先重画再 pulse 顺序很重要——pulse 画在最上层）
  private completedListener = (...args: unknown[]): void => {
    this.rerenderBuildings();
    const b = args[0] as BuildingInstance | undefined;
    if (b && b.position) this.mapRenderer?.pulseBuildingCompleted(b);
  };
  // STATE_REPLACED：除了重画 buildings 还要把 BuildMode 重置（DeepSeek Medium #5）
  private replacedListener = (): void => {
    this.rerenderBuildings();
    this.buildMode?.cancel();
    this.invalidateHoverCache();
    // v0.9：state replaced（读档）后，可能折叠态变了，刷一次视口
    this.mapRenderer?.recenter();
  };
  // v0.9：面板折叠 → 重算视口（同时 hover preview cache 失效）
  private panelCollapsedListener = (): void => {
    this.mapRenderer?.recenter();
    this.invalidateHoverCache();
  };
  // v0.9：建筑升级完成 → 重画 + 金边脉冲
  private upgradedListener = (...args: unknown[]): void => {
    this.rerenderBuildings();
    const b = args[0] as BuildingInstance | undefined;
    if (b && b.position) this.mapRenderer?.pulseBuildingCompleted(b);
  };

  // Phase2：序章统一 → 暂停游戏 + UI → 播建朝跳变旁白 → 推进第一章 → 恢复
  private storyUnifiedListener = (): void => {
    const store = this.store;
    if (!store) return;
    this.scene.pause();
    // 只在确实暂停了 UIScene 时才在结束后 resume（避免 resume 一个未暂停的场景）
    const uiWasActive = this.scene.isActive('UIScene');
    if (uiWasActive) this.scene.pause('UIScene');
    const data: TransitionData = {
      lines: DYNASTY_TRANSITION_NARRATION,
      onDone: () => {
        store.advanceStoryChapter(1);
        this.scene.resume();
        if (uiWasActive) this.scene.resume('UIScene');
      },
    };
    this.scene.launch('TransitionScene', data);
  };

  private endingShown = false;
  // Phase2：终章三结局兑现 → 暂停 + 全屏结局旁白（占位；结局后 resume 留在世界，重开流程 Phase4）
  private storyEndingListener = (...args: unknown[]): void => {
    if (this.endingShown) return; // 防重入（结局只放一次）
    const ending = (args[0] as { ending?: EndingId } | undefined)?.ending;
    if (!ending || !ENDING_NARRATION[ending]) return;
    this.endingShown = true;
    this.scene.pause();
    const uiWasActive = this.scene.isActive('UIScene');
    if (uiWasActive) this.scene.pause('UIScene');
    const data: TransitionData = {
      lines: ENDING_NARRATION[ending],
      onDone: () => {
        this.scene.resume();
        if (uiWasActive) this.scene.resume('UIScene');
      },
    };
    this.scene.launch('TransitionScene', data);
  };
  private escHandler = (): void => { this.buildMode?.cancel(); };

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const store = this.registry.get('store') as GameStore | undefined;
    const buildMode = this.registry.get('buildMode') as BuildMode | undefined;
    if (!store || !buildMode) {
      console.error('[GameScene] missing store or buildMode in registry');
      this.add.text(16, 16, '初始化失败：找不到 GameStore', {
        ...FONTS.title,
        color: '#B71C1C',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      return;
    }
    this.store = store;
    this.buildMode = buildMode;

    this.mapRenderer = new MapRenderer(this, store.getWorldMap());
    // v0.9：注入折叠态 source，让 MapRenderer 视口考虑面板折叠
    this.mapRenderer.setPanelLayoutSource({
      isLeftCollapsed: () => store.getPanelCollapsed('left'),
      isRightCollapsed: () => store.getPanelCollapsed('right'),
    });
    // v1.0 #5：注册到 registry，让 UIScene 的 ZoomControl 能拿到引用
    this.registry.set('mapRenderer', this.mapRenderer);
    this.rerenderBuildings();

    this.timeSystem = new TimeSystem(store);

    // v0.9 Pillar 2.4：升级 popover 在 toast 之后挂；popover 失败时 toast.show 反馈
    const toastForPopover = (this.registry.get('toast') as Toast | undefined) ?? null;
    this.buildingPopover = new BuildingPopover(this, store, toastForPopover);

    store.on(STATE_EVENTS.BUILDING_PLACED, this.placedListener);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.completedListener);
    store.on(STATE_EVENTS.STATE_REPLACED, this.replacedListener);
    // v0.9：面板折叠态变化 → 重算视口 + 居中
    store.on(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.panelCollapsedListener);
    // v0.9：建筑升级完成 → 走完成脉冲（与 BUILDING_COMPLETED 同款金边）
    store.on(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener);
    // Phase2：序章统一 → 建朝跳变过场 → 推进第一章
    store.on(STATE_EVENTS.STORY_UNIFIED, this.storyUnifiedListener);
    // Phase2：终章 → 三结局画面
    store.on(STATE_EVENTS.STORY_ENDING, this.storyEndingListener);

    // BuildMode 取消时清掉 hover 预览
    this.offBuildModeChange = buildMode.onChange((def) => {
      if (def === null) {
        this.mapRenderer?.setHoverPreview(null);
        this.invalidateHoverCache();
      } else {
        // 切换到不同建筑时也得让下一次 pointermove 强制重算
        this.invalidateHoverCache();
      }
    });

    // pointer 路由
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    // v1.0 #5：松开任何键都退出 panning（避免拖出窗口卡 panning 态）
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    // v1.0 #5：滚轮缩放（命中地图区，不抢面板/HUD）
    this.input.on('wheel', this.handleWheel, this);

    // ESC 取消建造模式（Slice E High #2：保存引用以便 shutdown 解绑）
    this.input.keyboard?.on('keydown-ESC', this.escHandler);

    // v0.9 hotfix#6：删掉 Slice E 临时标题（"邦国录 — Slice E（...）"）。
    // 这条本是 Slice D 占位，HUD 上线后忘了清；title depth=900 透过 HUD 看像水印金字残留。

    // 启动 UIScene（HUD + BuildPanel）
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

    // 监听 ScaleManager resize；Slice E 仅 resize 相机
    this.scale.on('resize', this.handleResize, this);

    // 注：seedStartingResources 已在 main.ts 启动时一次性下发，避免 STATE_REPLACED 加载
    // 一份资源恰好为零的合法存档时被错误地再次注入（Kimi cross-critique 提报的 High）
  }

  override update(_time: number, delta: number): void {
    this.timeSystem?.update(delta);
  }

  private invalidateHoverCache(): void {
    this.lastHoverGridX = Number.NaN;
    this.lastHoverGridY = Number.NaN;
    this.lastHoverValid = null;
  }

  /** v1.0 #5：判断 pointer 是否在 HUD/左面板/右面板覆盖区。命中时滚轮归面板/HUD，不缩放地图。 */
  private isPointerOverPanel(pointer: Phaser.Input.Pointer): boolean {
    const store = this.store;
    if (!store) return false;
    const cam = this.cameras.main;
    if (!cam) return false;
    const leftCollapsed = store.getPanelCollapsed('left');
    const rightCollapsed = store.getPanelCollapsed('right');
    const leftW = leftCollapsed ? 28 : UI.buildPanelWidth;
    const rightW = rightCollapsed ? 28 : UI.rightPanelWidth;
    const x = pointer.x;
    const y = pointer.y;
    if (y < UI.topbarHeight) return true;
    if (x < 8 + leftW + 8) return true;
    if (x > cam.width - rightW - 8 - 8) return true;
    return false;
  }

  /** v1.0 #5：滚轮 → 缩放地图，锚定鼠标位置（鼠标停哪缩哪）。 */
  private handleWheel = (
    pointer: Phaser.Input.Pointer,
    _go: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
  ): void => {
    if (!this.mapRenderer) return;
    if (this.isPointerOverPanel(pointer)) return;
    const cur = this.mapRenderer.getMapZoom();
    const target = cur + (dy < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP);
    this.mapRenderer.setMapZoom(target, pointer.x, pointer.y);
    this.invalidateHoverCache();
  };

  /** v1.0 #5：松开任何鼠标键 → 退出 panning */
  private handlePointerUp = (): void => {
    this.isPanning = false;
  };

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const renderer = this.mapRenderer;
    const store = this.store;
    const bm = this.buildMode;
    if (!renderer || !store || !bm) return;
    // v1.0 #5：中键拖动平移。需要在 build hover 之前，因为 pan 时不该再画 hover preview。
    const middleDown = typeof pointer.middleButtonDown === 'function' && pointer.middleButtonDown();
    if (middleDown) {
      if (!this.isPanning) {
        if (this.isPointerOverPanel(pointer)) return;
        this.isPanning = true;
        this.lastPanX = pointer.x;
        this.lastPanY = pointer.y;
        return;
      }
      const dx = pointer.x - this.lastPanX;
      const dy = pointer.y - this.lastPanY;
      this.lastPanX = pointer.x;
      this.lastPanY = pointer.y;
      renderer.panBy(dx, dy);
      this.invalidateHoverCache();
      return;
    }
    if (this.isPanning) this.isPanning = false;
    const def = bm.getSelected();
    if (!def) return;
    const grid = renderer.screenToGrid(pointer.worldX, pointer.worldY);
    if (!grid) {
      if (this.lastHoverValid !== null) {
        renderer.setHoverPreview(null);
        this.invalidateHoverCache();
      }
      return;
    }
    // 同格 + 可行性未变 → 跳过 graphics 重画（Slice E Medium：减少 clear/fill）
    if (grid.x === this.lastHoverGridX && grid.y === this.lastHoverGridY && this.lastHoverValid !== null) {
      const result = checkBuildAt(store, def, grid.x, grid.y);
      if (result.ok === this.lastHoverValid) return;
      this.lastHoverValid = result.ok;
      renderer.setHoverPreview({
        gridX: grid.x, gridY: grid.y, w: def.size.width, h: def.size.height, valid: result.ok,
      });
      return;
    }
    const result = checkBuildAt(store, def, grid.x, grid.y);
    this.lastHoverGridX = grid.x;
    this.lastHoverGridY = grid.y;
    this.lastHoverValid = result.ok;
    renderer.setHoverPreview({
      gridX: grid.x,
      gridY: grid.y,
      w: def.size.width,
      h: def.size.height,
      valid: result.ok,
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const renderer = this.mapRenderer;
    const store = this.store;
    const bm = this.buildMode;
    if (!renderer || !store || !bm) return;
    const def = bm.getSelected();
    // 右键统一释义：建造模式下取消选中；空闲态下若 popover 开着也关掉
    if (pointer.rightButtonDown()) {
      if (def) bm.cancel();
      else this.buildingPopover?.hide();
      return;
    }
    if (!def) {
      // v0.9 Pillar 2.4：空闲态——点击地图上已建建筑 → 弹升级 popover
      const grid = renderer.screenToGrid(pointer.worldX, pointer.worldY);
      if (!grid) return;
      const inst = this.findBuildingAt(grid.x, grid.y);
      if (inst) {
        this.buildingPopover?.show(inst, pointer.x, pointer.y);
      } else {
        // 点空地 → 关闭 popover（如果开着）
        this.buildingPopover?.hide();
      }
      return;
    }
    const grid = renderer.screenToGrid(pointer.worldX, pointer.worldY);
    if (!grid) return;
    const dim = renderer.getDimensions();
    const result = store.placeBuilding(def, grid.x, grid.y, { width: dim.width, height: dim.height });
    if (result.ok) {
      // 放置成功后建筑列表已变化，强制下一次 hover 重算
      this.invalidateHoverCache();
      const newCheck = checkBuildAt(store, def, grid.x, grid.y);
      this.lastHoverGridX = grid.x;
      this.lastHoverGridY = grid.y;
      this.lastHoverValid = newCheck.ok;
      renderer.setHoverPreview({ gridX: grid.x, gridY: grid.y, w: def.size.width, h: def.size.height, valid: newCheck.ok });
    } else {
      this.toastFailure(result.reason);
    }
  }

  /** v0.9 Pillar 2.4：grid (gx, gy) 命中的已建建筑（含多 tile occupancy） */
  private findBuildingAt(gx: number, gy: number): BuildingInstance | null {
    if (!this.store) return null;
    for (const b of this.store.getBuildings()) {
      const d = getBuildingDef(b.defId);
      if (!d) continue;
      const x0 = b.position.x;
      const y0 = b.position.y;
      const x1 = x0 + d.size.width - 1;
      const y1 = y0 + d.size.height - 1;
      if (gx >= x0 && gx <= x1 && gy >= y0 && gy <= y1) return b;
    }
    return null;
  }

  private toastFailure(reason: string): void {
    const toast = this.registry.get('toast') as Toast | undefined;
    if (!toast) return;
    const msg: Record<string, string> = {
      insufficient_resources: '资源不足，无法建造',
      out_of_bounds: '超出地图范围',
      overlap: '此处已有建筑',
      unbuildable_terrain: '此地形不可建造',
    };
    toast.show(msg[reason] ?? '无法建造此处', 'error');
  }

  private rerenderBuildings(): void {
    if (!this.mapRenderer || !this.store) return;
    this.mapRenderer.rerenderBuildings(this.store.getBuildings());
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    // v0.9 hotfix#4：guard + debounce + 安全网。
    // 直接调 cameras.resize 是稳的（Phaser 内部就是 setter），但 recenter 会重画
    // viewport mask graphic——中间帧 0×0 会把 mask 变 0×0 让地图全部裁掉。
    const rawW = gameSize.width;
    const rawH = gameSize.height;
    if (!Number.isFinite(rawW) || !Number.isFinite(rawH)) return;
    const w = Math.max(rawW, 320);
    const h = Math.max(rawH, 240);
    this.cameras.resize(w, h);
    // recenter 走 80ms debounce —— rapid resize 期间不反复重画 mask
    if (this.resizeDebounce !== null) window.clearTimeout(this.resizeDebounce);
    this.resizeDebounce = window.setTimeout(() => {
      this.mapRenderer?.recenter();
      this.invalidateHoverCache();
      this.resizeDebounce = null;
    }, 80);
    // 280ms 安全网：maximize 动画结束后再 recenter 一次
    if (this.resizeSafetyNet !== null) window.clearTimeout(this.resizeSafetyNet);
    this.resizeSafetyNet = window.setTimeout(() => {
      this.mapRenderer?.recenter();
      this.invalidateHoverCache();
      this.resizeSafetyNet = null;
    }, 280);
  }

  shutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    if (this.resizeDebounce !== null) {
      window.clearTimeout(this.resizeDebounce);
      this.resizeDebounce = null;
    }
    if (this.resizeSafetyNet !== null) {
      window.clearTimeout(this.resizeSafetyNet);
      this.resizeSafetyNet = null;
    }
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    // v1.0 #5：解绑 zoom/pan 输入
    this.input.off('pointerup', this.handlePointerUp, this);
    this.input.off('pointerupoutside', this.handlePointerUp, this);
    this.input.off('wheel', this.handleWheel, this);
    this.isPanning = false;
    // Slice E High #2：解绑 ESC keyboard 监听
    this.input.keyboard?.off('keydown-ESC', this.escHandler);
    if (this.store) {
      this.store.off(STATE_EVENTS.BUILDING_PLACED, this.placedListener);
      this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.completedListener);
      this.store.off(STATE_EVENTS.STATE_REPLACED, this.replacedListener);
      this.store.off(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.panelCollapsedListener);
      this.store.off(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener);
      this.store.off(STATE_EVENTS.STORY_UNIFIED, this.storyUnifiedListener);
      this.store.off(STATE_EVENTS.STORY_ENDING, this.storyEndingListener);
    }
    if (this.offBuildModeChange) {
      this.offBuildModeChange();
      this.offBuildModeChange = null;
    }
    this.buildingPopover?.destroy();
    this.buildingPopover = null;
    this.registry.set('mapRenderer', null);
    this.mapRenderer?.destroy();
    this.mapRenderer = null;
    this.store = null;
    this.buildMode = null;
    this.timeSystem = null;
    this.invalidateHoverCache();
  }
}
