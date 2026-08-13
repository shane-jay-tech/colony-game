import Phaser from 'phaser';
import { GameStore, STATE_EVENTS } from '../state/gameStore';
import { REGISTRY_KEYS, registryGet, registrySet } from '../ui/registry';
import type { GameStateEventMap } from '../state/stateEvents';
import { MapRenderer, MAP_ZOOM_STEP_FACTOR } from '../render/MapRenderer';
import { BuildMode, checkBuildAt } from '../state/buildMode';
import type { BuildingInstance } from '../data/schema';
import { getBuildingDef } from '../data/buildingRegistry';
import type { Toast } from '../ui/Toast';
import { BuildingPopover } from '../ui/BuildingPopover';
import { TimeSystem } from '../state/timeSystem';
import { dayToCalendar } from '../state/calendar';
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
  // 相机状态快照（每帧比对：相机一动就关 popover，避免屏幕固定弹窗错位）
  private lastCamZoom = -1;
  private lastCamScrollX = Number.NaN;
  private lastCamScrollY = Number.NaN;
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

  // v2：左键拖动平移地图（空闲态）。用阈值区分"点击选建筑/关 popover"与"拖动平移"。
  private isLeftPanning = false;
  private leftPanStartX = 0;
  private leftPanStartY = 0;
  private leftPanDragging = false;
  private lastLeftPanX = 0;
  private lastLeftPanY = 0;

  // Slice I：建筑落地额外触发 fade+scale 脉冲（与 BUILDING_PLACED 一起接线，建造瞬间给玩家反馈）
  private placedListener = (b: GameStateEventMap['state:buildingPlaced']): void => {
    this.rerenderBuildings();
    if (b && b.position) this.mapRenderer?.pulseBuildingPlacement(b);
  };
  // Slice H：建造完成额外触发金边脉冲（先重画再 pulse 顺序很重要——pulse 画在最上层）
  private completedListener = (b: GameStateEventMap['state:buildingCompleted']): void => {
    this.rerenderBuildings();
    if (b && b.position) {
      this.mapRenderer?.pulseBuildingCompleted(b);
      // Phase4 Juice：建成飘字（建筑名）——金色，与金边脉冲呼应
      const def = getBuildingDef(b.defId);
      this.mapRenderer?.floatTextAtTile(b.position.x, b.position.y, `${def?.name ?? '营建'}　成`, 0xe0b94a);
    }
  };
  // STATE_REPLACED：除了重画 buildings 还要把 BuildMode 重置（DeepSeek Medium #5）
  private replacedListener = (): void => {
    this.rerenderBuildings();
    this.buildMode?.cancel();
    this.invalidateHoverCache();
    // v0.9/v2：state replaced（读档）后布局可能变了，请求下一帧重新整图居中。
    this.mapRenderer?.requestRefit();
  };
  // v0.9：面板折叠 → 重算视口（同时 hover preview cache 失效）
  // v2：折叠/展开让可用区变了但画布尺寸没变——请求下一帧重新整图居中，避免地图被挤偏。
  private panelCollapsedListener = (): void => {
    this.mapRenderer?.requestRefit();
    this.invalidateHoverCache();
  };
  // v0.9：建筑升级完成 → 重画 + 金边脉冲
  private upgradedListener = (payload: GameStateEventMap['state:buildingUpgraded']): void => {
    this.rerenderBuildings();
    const b = 'instance' in payload ? payload.instance : payload;
    if (b && b.position) {
      this.mapRenderer?.pulseBuildingCompleted(b);
      this.mapRenderer?.floatTextAtTile(b.position.x, b.position.y, '营建　升', 0xe0b94a);
    }
  };
  // 拆除 → 重画建筑层（建筑已移除，无需脉冲）
  private removedListener = (): void => {
    this.rerenderBuildings();
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
  private storyEndingListener = (payload: GameStateEventMap['state:storyEnding']): void => {
    if (this.endingShown) return; // 防重入（结局只放一次）
    const ending = payload.ending as EndingId;
    if (!ending || !ENDING_NARRATION[ending]) return;
    this.endingShown = true;
    this.scene.pause();
    const uiWasActive = this.scene.isActive('UIScene');
    if (uiWasActive) this.scene.pause('UIScene');
    const data: TransitionData = {
      lines: ENDING_NARRATION[ending],
      imageKey: `evt_art_ending_${ending}`, // 公/家/或 三结局插画；缺图 TransitionScene 静默回退纯文字
      onDone: () => {
        this.scene.resume();
        if (uiWasActive) this.scene.resume('UIScene');
      },
    };
    this.scene.launch('TransitionScene', data);
  };
  // A-3/A-4：季节色调切换（散布层 tint + 农田色 + 雪花）
  private seasonTintListener = (payload: GameStateEventMap['state:seasonTick']): void => {
    this.mapRenderer?.setSeasonTint(payload.season);
    this.rerenderBuildings();
  };
  // v2 DeepSeek 复审[边界]：ESC 同时关掉可能开着的建筑 popover，避免残留悬浮 UI
  private escHandler = (): void => { this.buildMode?.cancel(); this.buildingPopover?.hide(); };
  // A-9：速度快捷键
  private spaceHandler = (): void => { this.store?.setPaused(!this.store.isPaused()); };
  private speedKeyHandler1 = (): void => { this.store?.setPaused(false); this.store?.setSpeed(1); };
  private speedKeyHandler2 = (): void => { this.store?.setPaused(false); this.store?.setSpeed(2); };
  private speedKeyHandler3 = (): void => { this.store?.setPaused(false); this.store?.setSpeed(3); };

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // 关键修复(2026-06-02)：Phaser 不自动调 scene.shutdown()——必须手动绑 SHUTDOWN 事件，
    // 否则 scene 重启/停止后 store 监听 + scale 'resize' 监听全部残留泄漏。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    const store = registryGet(this.registry, REGISTRY_KEYS.store);
    const buildMode = registryGet(this.registry, REGISTRY_KEYS.buildMode);
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
      // 2026-06-19：右侧朝堂面板已退休（改为全屏国策树），右侧恒按"已折叠"算，地图多占右边空间。
      isRightCollapsed: () => true,
    });
    // v1.0 #5：注册到 registry，让 UIScene 的 ZoomControl 能拿到引用
    registrySet(this.registry, REGISTRY_KEYS.mapRenderer, this.mapRenderer);
    this.rerenderBuildings();
    // A-3：初始季节色调
    const initSeason = dayToCalendar(store.getCurrentDay()).season;
    this.mapRenderer.setSeasonTint(initSeason);

    this.timeSystem = new TimeSystem(store);

    // v0.9 Pillar 2.4：升级 popover 在 toast 之后挂；popover 失败时 toast.show 反馈
    const toastForPopover = registryGet(this.registry, REGISTRY_KEYS.toast) ?? null;
    this.buildingPopover = new BuildingPopover(this, store, toastForPopover);

    store.on(STATE_EVENTS.BUILDING_PLACED, this.placedListener);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.completedListener);
    store.on(STATE_EVENTS.BUILDING_REMOVED, this.removedListener);
    store.on(STATE_EVENTS.STATE_REPLACED, this.replacedListener);
    // v0.9：面板折叠态变化 → 重算视口 + 居中
    store.on(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.panelCollapsedListener);
    // v0.9：建筑升级完成 → 走完成脉冲（与 BUILDING_COMPLETED 同款金边）
    store.on(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener);
    // Phase2：序章统一 → 建朝跳变过场 → 推进第一章
    store.on(STATE_EVENTS.STORY_UNIFIED, this.storyUnifiedListener);
    // Phase2：终章 → 三结局画面
    store.on(STATE_EVENTS.STORY_ENDING, this.storyEndingListener);
    // A-3：季节色调切换
    store.on(STATE_EVENTS.SEASON_TICK, this.seasonTintListener);

    // BuildMode 取消时清掉 hover 预览
    this.offBuildModeChange = buildMode.onChange((def) => {
      if (def === null) {
        this.mapRenderer?.setHoverPreview(null);
        this.invalidateHoverCache();
      } else {
        // v2：进入建造态时取消进行中的左键拖动，避免拖动态残留
        this.isLeftPanning = false;
        this.leftPanDragging = false;
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

    // A-9：速度快捷键（空格=暂停切换，1/2/3=速度档）
    this.input.keyboard?.on('keydown-SPACE', this.spaceHandler);
    this.input.keyboard?.on('keydown-ONE', this.speedKeyHandler1);
    this.input.keyboard?.on('keydown-TWO', this.speedKeyHandler2);
    this.input.keyboard?.on('keydown-THREE', this.speedKeyHandler3);

    // 启动 UIScene（HUD + BuildPanel）
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

    // 监听 ScaleManager resize；Slice E 仅 resize 相机
    this.scale.on('resize', this.handleResize, this);

    // 注：seedStartingResources 已在 main.ts 启动时一次性下发，避免 STATE_REPLACED 加载
    // 一份资源恰好为零的合法存档时被错误地再次注入（Kimi cross-critique 提报的 High）
  }

  override update(_time: number, delta: number): void {
    // v2：每帧守护——视口尺寸真正稳定后把地图重新 fit 到整图并居中（修构造/最大化时序导致的右下角偏移）。
    // 尺寸不变时为 O(1) no-op，不影响用户缩放/拖动。
    this.mapRenderer?.ensureFittedToViewport();
    this.timeSystem?.update(delta);
    // 相机一动（缩放/平移/重新 fit）就关掉建筑详情弹窗：屏幕固定的弹窗跟随相机换算易错位，
    // 关掉最干净（再点建筑重开）。点击本身不移动相机，故开窗当帧不会被误关。
    const pop = this.buildingPopover;
    const cam = this.cameras.main;
    if (pop?.isVisible() && cam) {
      if (this.lastCamZoom !== cam.zoom || this.lastCamScrollX !== cam.scrollX || this.lastCamScrollY !== cam.scrollY) {
        pop.hide();
      }
    }
    if (cam) {
      this.lastCamZoom = cam.zoom;
      this.lastCamScrollX = cam.scrollX;
      this.lastCamScrollY = cam.scrollY;
    }
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
    const leftW = leftCollapsed ? 28 : UI.buildPanelWidth;
    const rightW = 28; // 朝堂面板退休：右侧只留 28px 边距，不再预留整块面板
    const x = pointer.x;
    const y = pointer.y;
    if (y < UI.topbarHeight + UI.toolbarHeight) return true; // 顶栏 + 主功能工具栏区域不放置/不平移
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
    // 2026-06-19：全屏国策树打开时，滚轮归它缩放树，不缩放底层地图。
    if (registryGet(this.registry, REGISTRY_KEYS.treePanelOpen)) return;
    const cur = this.mapRenderer.getMapZoom();
    // v2：乘法步进（每档 ×/÷ MAP_ZOOM_STEP_FACTOR）。开局 zoom 很小（fit≈0.1），加法步进会一步越界。
    const target = dy < 0 ? cur * MAP_ZOOM_STEP_FACTOR : cur / MAP_ZOOM_STEP_FACTOR;
    this.mapRenderer.setMapZoom(target, pointer.x, pointer.y);
    this.invalidateHoverCache();
  };

  /** v1.0 #5：松开任何鼠标键 → 退出 panning。
   *  v2：左键空闲态——若本次没有越过拖动阈值（= 点击而非拖动），在松开时执行 popover 显隐。 */
  private handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    this.isPanning = false;
    if (this.isLeftPanning) {
      if (!this.leftPanDragging) {
        const renderer = this.mapRenderer;
        const store = this.store;
        const bm = this.buildMode;
        if (renderer && store && bm && !bm.getSelected()) {
          const grid = renderer.screenToGrid(pointer.worldX, pointer.worldY);
          if (grid) {
            const inst = this.findBuildingAt(grid.x, grid.y);
            if (bm.isDemolish()) {
              // 拆除工具：点中建筑即拆，保持模式以连拆（ESC/右键/再点工具退出）。
              if (inst) {
                const name = getBuildingDef(inst.defId)?.name ?? '建筑';
                store.removeBuilding(inst);
                registryGet(this.registry, REGISTRY_KEYS.toast)?.show(`已拆除${name}，返还半数材料`, 'info');
              }
            } else if (inst) {
              // popover 锚到建筑地基中心的屏幕位置（而非鼠标点——点高屋顶会离地基很远导致飘）。
              const def = getBuildingDef(inst.defId);
              const ccx = inst.position.x + ((def?.size.width ?? 1) - 1) / 2;
              const ccy = inst.position.y + ((def?.size.height ?? 1) - 1) / 2;
              const anchor = renderer.gridToScreenPixel(ccx, ccy);
              this.buildingPopover?.show(inst, anchor.x, anchor.y);
            } else {
              this.buildingPopover?.hide();
            }
          }
        }
      }
      this.isLeftPanning = false;
      this.leftPanDragging = false;
    }
  };

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const renderer = this.mapRenderer;
    const store = this.store;
    const bm = this.buildMode;
    if (!renderer || !store || !bm) return;
    // 2026-06-19：全屏国策树打开时，所有地图交互（平移/hover/放置预览）让位给它。
    if (registryGet(this.registry, REGISTRY_KEYS.treePanelOpen)) return;
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
    // v2：左键拖动平移（空闲态）。越过 4px 阈值才算拖动，避免误判点击。
    if (this.isLeftPanning) {
      const leftDown = typeof pointer.leftButtonDown === 'function' && pointer.leftButtonDown();
      if (!leftDown) {
        // 失焦等异常导致没走 pointerup：直接清理
        this.isLeftPanning = false;
        this.leftPanDragging = false;
      } else {
        const totalDx = pointer.x - this.leftPanStartX;
        const totalDy = pointer.y - this.leftPanStartY;
        if (!this.leftPanDragging && Math.hypot(totalDx, totalDy) > 4) this.leftPanDragging = true;
        if (this.leftPanDragging) {
          renderer.panBy(pointer.x - this.lastLeftPanX, pointer.y - this.lastLeftPanY);
          this.invalidateHoverCache();
        }
        this.lastLeftPanX = pointer.x;
        this.lastLeftPanY = pointer.y;
        return;
      }
    }
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
    // 2026-06-19：全屏国策树打开时，点击归它处理，不在底层地图放置建筑/平移。
    if (registryGet(this.registry, REGISTRY_KEYS.treePanelOpen)) return;
    const def = bm.getSelected();
    // 右键统一释义：建造模式下取消选中；空闲态下若 popover 开着也关掉
    if (pointer.rightButtonDown()) {
      if (def || bm.isDemolish()) bm.cancel();
      else this.buildingPopover?.hide();
      return;
    }
    // 2026-06-19：拆除模式左键"按下即拆"——不再依赖 pointerup + 4px 拖动判定（之前"点了拆不掉"的真因）。
    // 点中建筑即拆并 return；点空地则不拦截，落到下面的左键拖动平移（拆除模式仍可拖地图找目标）。
    // 保持拆除模式以便连拆（右键/ESC/再点工具退出）。
    if (bm.isDemolish() && pointer.leftButtonDown() && !this.isPointerOverPanel(pointer)) {
      const grid = renderer.screenToGrid(pointer.worldX, pointer.worldY);
      const inst = grid ? this.findBuildingAt(grid.x, grid.y) : null;
      if (inst) {
        const name = getBuildingDef(inst.defId)?.name ?? '建筑';
        store.removeBuilding(inst);
        registryGet(this.registry, REGISTRY_KEYS.toast)?.show(`已拆除${name}，返还半数材料`, 'info');
        return; // 拆掉了才结束；点空地继续往下走平移
      }
    }
    if (!def) {
      // v2：空闲态左键按下——开始左键拖动追踪。popover 显隐延到 pointerup（按拖动阈值判定），
      // 这样一次"拖动平移"不会误弹 popover；一次"点击"才在松开时弹/关 popover。
      if (pointer.leftButtonDown() && !this.isPointerOverPanel(pointer)) {
        this.isLeftPanning = true;
        this.leftPanStartX = pointer.x;
        this.leftPanStartY = pointer.y;
        this.lastLeftPanX = pointer.x;
        this.lastLeftPanY = pointer.y;
        this.leftPanDragging = false;
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
    const toast = registryGet(this.registry, REGISTRY_KEYS.toast);
    if (!toast) return;
    const msg: Record<string, string> = {
      insufficient_resources: '资源不足，无法建造',
      insufficient_labor: '劳力不足——需要对应阶层的闲置民力',
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
      // 真实画布 resize：重居中 + 重烘焙地貌/散布 RT（清掉切换可能污染的 framebuffer）
      this.mapRenderer?.rebuildAfterResize();
      this.invalidateHoverCache();
      this.resizeDebounce = null;
      // DeepSeek 复审[perf]：debounce 正常触发即已 rebuild 到终态，取消冗余的安全网，
      // 避免一次 resize 重烘焙两遍（80ms + 280ms）。真有更晚的 resize 会再 arm 一次。
      if (this.resizeSafetyNet !== null) { window.clearTimeout(this.resizeSafetyNet); this.resizeSafetyNet = null; }
    }, 80);
    // 280ms 安全网：仅当 debounce 因故未触发时兜底（正常路径会被上面清掉）
    if (this.resizeSafetyNet !== null) window.clearTimeout(this.resizeSafetyNet);
    this.resizeSafetyNet = window.setTimeout(() => {
      this.mapRenderer?.rebuildAfterResize();
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
    this.isLeftPanning = false;
    this.leftPanDragging = false;
    // Slice E High #2：解绑 ESC keyboard 监听
    this.input.keyboard?.off('keydown-ESC', this.escHandler);
    this.input.keyboard?.off('keydown-SPACE', this.spaceHandler);
    this.input.keyboard?.off('keydown-ONE', this.speedKeyHandler1);
    this.input.keyboard?.off('keydown-TWO', this.speedKeyHandler2);
    this.input.keyboard?.off('keydown-THREE', this.speedKeyHandler3);
    if (this.store) {
      this.store.off(STATE_EVENTS.BUILDING_PLACED, this.placedListener);
      this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.completedListener);
      this.store.off(STATE_EVENTS.BUILDING_REMOVED, this.removedListener);
      this.store.off(STATE_EVENTS.STATE_REPLACED, this.replacedListener);
      this.store.off(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.panelCollapsedListener);
      this.store.off(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener);
      this.store.off(STATE_EVENTS.STORY_UNIFIED, this.storyUnifiedListener);
      this.store.off(STATE_EVENTS.STORY_ENDING, this.storyEndingListener);
      this.store.off(STATE_EVENTS.SEASON_TICK, this.seasonTintListener);
    }
    if (this.offBuildModeChange) {
      this.offBuildModeChange();
      this.offBuildModeChange = null;
    }
    this.buildingPopover?.destroy();
    this.buildingPopover = null;
    registrySet(this.registry, REGISTRY_KEYS.mapRenderer, undefined);
    this.mapRenderer?.destroy();
    this.mapRenderer = null;
    this.store = null;
    this.buildMode = null;
    this.timeSystem = null;
    this.invalidateHoverCache();
  }
}
