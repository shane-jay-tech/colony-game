import Phaser from 'phaser';
import type { GameStore } from '../state/gameStore';
import type { BuildMode } from '../state/buildMode';
import { HUD } from '../ui/HUD';
import { BuildPanel } from '../ui/BuildPanel';
import { Toast } from '../ui/Toast';
import { CourtPanel } from '../ui/CourtPanel';
import { DiplomacyPanel } from '../ui/DiplomacyPanel';
import { EventModal } from '../ui/EventModal';
import { TutorialModal } from '../ui/TutorialModal';
import { Legend } from '../ui/Legend';
import { ZoomControl } from '../ui/ZoomControl';
import type { MapRenderer } from '../render/MapRenderer';

/**
 * UIScene：HUD 顶栏 + 左侧建造面板 + 右侧朝堂面板 + Toast + EventModal + TutorialModal。
 *
 * Slice E 实装 HUD/BuildPanel/Toast；Slice G 加 CourtPanel + EventModal + TutorialModal。
 *   - 从 game.registry 取 GameStore + BuildMode
 *   - 监听 scale.on('resize') 做 debounce 重排（含模态居中）
 *   - shutdown 时拆解所有监听器（避免 hot reload 留下幽灵 listener）
 *
 * Toast 暴露在 game.registry['toast']，CourtPanel/GameScene 用它反馈失败。
 */
export class UIScene extends Phaser.Scene {
  private resizeTimer: number | null = null;
  /** v0.9 hotfix#4：maximize 动画结束后 250ms 安全网；Windows 给最终尺寸时再 layout 一次 */
  private safetyNetTimer: number | null = null;
  private hud: HUD | null = null;
  private buildPanel: BuildPanel | null = null;
  private courtPanel: CourtPanel | null = null;
  private diplomacyPanel: DiplomacyPanel | null = null;
  private eventModal: EventModal | null = null;
  private tutorialModal: TutorialModal | null = null;
  private toast: Toast | null = null;
  private legend: Legend | null = null;
  private zoomControl: ZoomControl | null = null;

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create(): void {
    const store = this.registry.get('store') as GameStore | undefined;
    const buildMode = this.registry.get('buildMode') as BuildMode | undefined;
    if (!store || !buildMode) {
      console.error('[UIScene] missing store or buildMode in registry');
      return;
    }

    this.hud = new HUD(this, store);
    this.buildPanel = new BuildPanel(this, store, buildMode);
    this.courtPanel = new CourtPanel(this, store);
    this.legend = new Legend(this, store);
    this.toast = new Toast(this);
    // Slice G：toast 必须先注册才能让 EventModal/CourtPanel 失败时回报
    this.registry.set('toast', this.toast);
    // v1.0 #6：邦交面板（中央模态，HUD 按钮触发开关）
    this.diplomacyPanel = new DiplomacyPanel(this, store);
    this.registry.set('diplomacyPanel', this.diplomacyPanel);
    this.eventModal = new EventModal(this, store);
    // 教程模态最后构造：它在欢迎步骤会立即 setPaused(true)，HUD 的 speed 显示需要先就绪
    this.tutorialModal = new TutorialModal(this, store);
    // v1.0 #5：缩放工具条。MapRenderer 由 GameScene 在 create 时注册到 registry，
    // ZoomControl 通过 lazy getter 拿引用——避免 UIScene 比 GameScene 先 create 时拿到 null。
    this.zoomControl = new ZoomControl(this, store, () => {
      return (this.registry.get('mapRenderer') as MapRenderer | null) ?? null;
    });

    this.scale.on('resize', this.scheduleResize, this);
  }

  private scheduleResize(): void {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = window.setTimeout(() => {
      this.applyResize();
      this.resizeTimer = null;
    }, 80);
    // v0.9 hotfix#4：maximize 安全网。Windows maximize 动画 ~200ms，结束后再 layout 一次，
    // 捕捉动画期间 RESIZE 中间帧之后的最终尺寸。每次 resize 都重置这个 timer。
    if (this.safetyNetTimer !== null) {
      window.clearTimeout(this.safetyNetTimer);
    }
    this.safetyNetTimer = window.setTimeout(() => {
      this.applyResize();
      this.safetyNetTimer = null;
    }, 280);
  }

  private applyResize(): void {
    const rawW = this.scale.width;
    const rawH = this.scale.height;
    // v0.9 hotfix#4：软化 guard。早期硬 return 让 maximize 中间帧后再没有 layout 触发的话
    // 就一直停在错位。改成 clamp 到 min size——保证 layout 总能跑一次合理布局。
    // 安全网 timer 会在 280ms 后再 fire 一次，那时 Windows 已经给到最终尺寸。
    if (!Number.isFinite(rawW) || !Number.isFinite(rawH)) return;
    const width = Math.max(rawW, 320);
    const height = Math.max(rawH, 240);
    this.cameras.resize(width, height);
    this.hud?.layout();
    this.buildPanel?.layout();
    this.courtPanel?.layout();
    this.legend?.layout();
    this.zoomControl?.layout();
    this.eventModal?.layout();
    this.tutorialModal?.layout();
    this.diplomacyPanel?.layout();
  }

  shutdown(): void {
    this.scale.off('resize', this.scheduleResize, this);
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.safetyNetTimer !== null) {
      window.clearTimeout(this.safetyNetTimer);
      this.safetyNetTimer = null;
    }
    this.hud?.destroy();
    this.buildPanel?.destroy();
    this.courtPanel?.destroy();
    this.diplomacyPanel?.destroy();
    this.legend?.destroy();
    this.zoomControl?.destroy();
    this.eventModal?.destroy();
    this.tutorialModal?.destroy();
    this.toast?.destroy();
    this.registry.set('toast', undefined);
    this.registry.set('diplomacyPanel', undefined);
    this.hud = null;
    this.buildPanel = null;
    this.courtPanel = null;
    this.diplomacyPanel = null;
    this.legend = null;
    this.zoomControl = null;
    this.eventModal = null;
    this.tutorialModal = null;
    this.toast = null;
  }
}
