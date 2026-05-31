import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { TUTORIAL_STEPS } from '../data/tutorial';

/**
 * TutorialModal：首次启动欢迎引导。
 *
 * Slice G 教程玩法：
 *   - 新建游戏时 store.tutorialStepId='tut_welcome'，本模态自动显示
 *   - 加载存档：tutorialStepId 由存档决定（已通关的玩家不会再被打扰）
 *   - 内容：邦国录介绍 + 三步上手清单（取自 TUTORIAL_STEPS.textPlain）
 *   - 玩家点击"开始游戏" → setTutorialStepId(null) → 模态关闭
 *   - HUD 提供"?"按钮，再次调用 setTutorialStepId('tut_welcome') 即可重读
 *
 * 暂停语义：与 EventModal 一致——打开时 setPaused(true)；关闭时恢复 prevPaused，
 * 不强制 unpause（玩家可能为读说明先按了暂停）。
 *
 * 渲染层：纯 Phaser-native（Container + Graphics + Text + Zone），depth=2050（高于
 * EventModal=2000，因为引导是"先打开/后处理事件"的语义）。
 */

const PANEL_WIDTH = 520;
const PANEL_HEIGHT = 380;
const WELCOME_STEP_ID = 'tut_welcome';

const WELCOME_TITLE = '邦国录 · 入门';
const WELCOME_INTRO = '春秋之世，主公新立。请掌邦国之柄，徐图王业。';

export class TutorialModal {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly panelBg: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly introText: Phaser.GameObjects.Text;
  private readonly stepsText: Phaser.GameObjects.Text;
  private readonly footerText: Phaser.GameObjects.Text;
  private readonly btnBg: Phaser.GameObjects.Graphics;
  private readonly btnText: Phaser.GameObjects.Text;
  private readonly btnZone: Phaser.GameObjects.Zone;

  private holdsPause = false; // Slice G hardening：destroy 时若仍 hold 必须释放
  private destroyed = false;
  private static readonly PAUSE_HOLDER = 'tutorial';

  // store 监听器引用（destroy 解绑）
  private onTutorialStep = (id: unknown): void => this.handleStepChanged(id);
  private onReplaced = (): void => this.handleReplaced();

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2050).setVisible(false);

    this.overlay = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: false });
    this.container.add([this.overlay, this.overlayZone]);

    this.panelBg = scene.add.graphics();
    this.container.add(this.panelBg);

    this.titleText = scene.add.text(0, 0, WELCOME_TITLE, {
      ...FONTS.title,
      color: '#3E2723',
      wordWrap: { width: PANEL_WIDTH - 48 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    this.introText = scene.add.text(0, 0, WELCOME_INTRO, {
      ...FONTS.body,
      color: '#2B2118',
      wordWrap: { width: PANEL_WIDTH - 48 },
      lineSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.introText);

    this.stepsText = scene.add.text(0, 0, this.formatSteps(), {
      ...FONTS.body,
      color: '#2B2118',
      wordWrap: { width: PANEL_WIDTH - 48 },
      lineSpacing: 6,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.stepsText);

    this.footerText = scene.add.text(0, 0, '稍后可在顶栏右侧"?"按钮再阅。', {
      ...FONTS.small,
      color: '#6D635B',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.footerText);

    // 单按钮：开始游戏
    this.btnBg = scene.add.graphics();
    this.btnText = scene.add.text(0, 0, '开始游戏', {
      ...FONTS.body,
      color: '#F5ECD7',
      fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.btnZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.btnZone.on('pointerdown', () => this.handleDismiss());
    this.container.add([this.btnBg, this.btnText, this.btnZone]);

    store.on(STATE_EVENTS.TUTORIAL_STEP_CHANGED, this.onTutorialStep);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);

    // 启动时若已经处于 welcome step，立即弹起
    if (store.getTutorialStepId() === WELCOME_STEP_ID) this.openModal();
  }

  /** 把 TUTORIAL_STEPS 的 textPlain 拼成一个有序清单 */
  private formatSteps(): string {
    const lines: string[] = [];
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
      const step = TUTORIAL_STEPS[i]!;
      lines.push(`${i + 1}. ${step.textPlain}`);
    }
    return lines.join('\n');
  }

  private openModal(): void {
    if (this.destroyed) return;
    this.acquirePause();
    this.layout();
    this.container.setVisible(true);
  }

  private closeModal(): void {
    this.container.setVisible(false);
    this.releaseHeldPause();
  }

  private acquirePause(): void {
    if (this.holdsPause) return;
    this.store.requestPause(TutorialModal.PAUSE_HOLDER);
    this.holdsPause = true;
  }

  private releaseHeldPause(): void {
    if (!this.holdsPause) return;
    this.store.releasePause(TutorialModal.PAUSE_HOLDER);
    this.holdsPause = false;
  }

  private handleDismiss(): void {
    if (!this.container.visible) return;
    // 把 step 推进到 null（已结束教程）；setTutorialStepId 会触发 TUTORIAL_STEP_CHANGED → handleStepChanged → 关闭
    // 但因为 closeModal 会改 paused 而 paused 又会触发事件回灌，先手动关再 set
    this.closeModal();
    this.store.setTutorialStepId(null);
  }

  private handleStepChanged(id: unknown): void {
    if (id === WELCOME_STEP_ID) {
      if (!this.container.visible) this.openModal();
    } else {
      // 任何非 welcome 值（包括 null）都关掉模态
      if (this.container.visible) this.closeModal();
    }
  }

  private handleReplaced(): void {
    // 加载新存档：按存档里的 tutorialStepId 决定是否显示
    const id = this.store.getTutorialStepId();
    if (id === WELCOME_STEP_ID) {
      if (!this.container.visible) this.openModal();
      else this.layout();
    } else if (this.container.visible) {
      // 新存档已通关 → 关掉；释放 hold（存档自己的 paused 是权威）
      this.container.setVisible(false);
      this.releaseHeldPause();
    }
  }

  /** 重新计算位置；resize 时由 UIScene 调用 */
  layout(): void {
    if (!this.container.visible && this.store.getTutorialStepId() !== WELCOME_STEP_ID) {
      // 不可见时不必重排子件，只更新 overlay zone
      this.overlayZone.setPosition(0, 0).setSize(this.scene.scale.width, this.scene.scale.height);
      return;
    }
    const sceneW = this.scene.scale.width;
    const sceneH = this.scene.scale.height;
    const padding = 24;

    // 全屏遮罩
    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, sceneW, sceneH);
    this.overlayZone.setPosition(0, 0).setSize(sceneW, sceneH);

    const panelX = Math.floor((sceneW - PANEL_WIDTH) / 2);
    const panelY = Math.floor((sceneH - PANEL_HEIGHT) / 2);

    // 面板背景：纸面 + 双边框
    this.panelBg.clear();
    this.panelBg.fillStyle(COLORS.PAPER, 1);
    this.panelBg.fillRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT);
    this.panelBg.lineStyle(UI.panelBorderWidth, COLORS.GOLD_DIM, 1);
    this.panelBg.strokeRect(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT);
    this.panelBg.lineStyle(UI.panelInnerWoodWidth, COLORS.WOOD_LIGHT, 0.7);
    this.panelBg.strokeRect(panelX + 4, panelY + 4, PANEL_WIDTH - 8, PANEL_HEIGHT - 8);

    // 标题
    this.titleText.setPosition(panelX + padding, panelY + padding);
    const titleH = this.titleText.displayHeight;

    // 导言
    const introY = panelY + padding + titleH + 12;
    this.introText.setPosition(panelX + padding, introY);
    const introH = this.introText.displayHeight;

    // 三步清单
    const stepsY = introY + introH + 16;
    this.stepsText.setPosition(panelX + padding, stepsY);

    // 底注（紧贴按钮上方）
    const btnW = 160;
    const btnH = 44;
    const btnX = panelX + Math.floor((PANEL_WIDTH - btnW) / 2);
    const btnY = panelY + PANEL_HEIGHT - padding - btnH;
    this.footerText.setPosition(panelX + padding, btnY - 22);

    // 按钮
    this.btnZone.setPosition(btnX, btnY).setSize(btnW, btnH);
    this.btnBg.clear();
    this.btnBg.fillStyle(COLORS.WOOD, 0.95);
    this.btnBg.fillRect(btnX, btnY, btnW, btnH);
    this.btnBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.btnBg.strokeRect(btnX, btnY, btnW, btnH);
    this.btnText.setPosition(btnX + btnW / 2, btnY + btnH / 2);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.TUTORIAL_STEP_CHANGED, this.onTutorialStep);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    // hot reload 留下的 pause holder 必须释放
    this.releaseHeldPause();
    this.container.destroy(true);
  }

  // 测试 / 调试用 hooks
  isVisible(): boolean { return this.container.visible; }
  clickStart(): void { this.handleDismiss(); }
}
