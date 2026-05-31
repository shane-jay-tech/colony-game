import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { CourtEvent, CourtEventChoice, CourtEventContext } from '../data/schema';

/**
 * EventModal：朝议事件对话框。
 *
 * Slice G UI 玩法：
 *   - 监听 store EVENT_TRIGGERED：弹出居中模态，显示当前 pendingEvent 的 title/古文/白话/选项
 *   - 监听 EVENT_RESOLVED：销毁模态
 *   - 古文 / 白话 toggle：右上角小按钮
 *   - 选项按钮：调 store.resolveEvent(idx)
 *   - 倒计时：event.defaultTimeoutDays 天后自动按 choices[0]，UI 在角落显示倒计时
 *   - 模态打开期间自动 setPaused(true)；关闭时恢复 prevPaused（不强制玩家继续）
 *   - 非抉择类（无 choices）：显示 [知道了] 单按钮，点击即 resolveEvent(0) 走默认路径
 *
 * 渲染层：纯 Phaser-native（Container + Graphics + Text + Zone）。深度 = 2000（盖在 HUD 上）。
 *
 * 销毁：UIScene.shutdown 调 .destroy()，会 off store 监听 + destroy container。
 */

const PANEL_WIDTH = 480;
const PANEL_MIN_HEIGHT = 280;
const PANEL_MAX_HEIGHT = 520;

interface ChoiceButton {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  idx: number;
}

export class EventModal {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics; // 半透明遮罩（绘制层）
  private readonly overlayZone: Phaser.GameObjects.Zone; // 拦截点击的命中区
  private readonly panelBg: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly countdownText: Phaser.GameObjects.Text;
  private readonly toggleBg: Phaser.GameObjects.Graphics;
  private readonly toggleText: Phaser.GameObjects.Text;
  private readonly toggleZone: Phaser.GameObjects.Zone;
  private buttons: ChoiceButton[] = [];

  private currentEvent: CourtEvent | null = null;
  private activeContext: CourtEventContext | null = null; // Phase3：按状态选中的文本变体（OQ-S3）
  private showPlain = true; // 默认白话；用户可切到古文
  private holdsPause = false; // Slice G hardening：destroy 时若仍 hold 必须释放
  private destroyed = false;
  private static readonly PAUSE_HOLDER = 'event';

  // 监听器引用（destroy 解绑）
  private onTriggered = (): void => this.handleTriggered();
  private onResolved = (): void => this.handleResolved();
  private onDayTick = (): void => this.refreshCountdown();
  private onReplaced = (): void => {
    // 加载新存档：旧模态关掉；若 hold 着 pause 必须释放（新 state 的 paused 是权威）
    if (this.currentEvent) {
      this.currentEvent = null;
      this.container.setVisible(false);
      this.clearButtons();
      this.releaseHeldPause();
    }
    if (this.store.getPendingEventId() !== null) this.handleTriggered();
  };

  private acquirePause(): void {
    if (this.holdsPause) return;
    this.store.requestPause(EventModal.PAUSE_HOLDER);
    this.holdsPause = true;
  }

  private releaseHeldPause(): void {
    if (!this.holdsPause) return;
    this.store.releasePause(EventModal.PAUSE_HOLDER);
    this.holdsPause = false;
  }

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    this.overlay = scene.add.graphics();
    // 点遮罩不关闭模态（朝议必须做选择），但要吃掉点击避免穿透到 GameScene
    // 用 Zone 做命中区（Phaser.Geom.Rectangle 是 runtime 值，在 node test 环境会拉
    // 起 Phaser.OS 初始化触发 window 引用错误；Zone 自带 hit area 不依赖 Geom）。
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: false });
    this.container.add([this.overlay, this.overlayZone]);

    this.panelBg = scene.add.graphics();
    this.container.add(this.panelBg);

    this.titleText = scene.add.text(0, 0, '', {
      ...FONTS.title,
      color: '#C9A84C',
      wordWrap: { width: PANEL_WIDTH - 48 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    this.bodyText = scene.add.text(0, 0, '', {
      ...FONTS.body,
      color: '#F5ECD7',
      wordWrap: { width: PANEL_WIDTH - 48 },
      lineSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.bodyText);

    this.countdownText = scene.add.text(0, 0, '', {
      ...FONTS.small,
      color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.countdownText);

    // 古文/白话 toggle
    this.toggleBg = scene.add.graphics();
    this.toggleText = scene.add.text(0, 0, '古文', {
      ...FONTS.small,
      color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.toggleZone = scene.add.zone(0, 0, 56, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.toggleZone.on('pointerdown', () => this.toggleLanguage());
    this.container.add([this.toggleBg, this.toggleText, this.toggleZone]);

    store.on(STATE_EVENTS.EVENT_TRIGGERED, this.onTriggered);
    store.on(STATE_EVENTS.EVENT_RESOLVED, this.onResolved);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);

    // 启动时若已经有 pending（开发热重载 / 加载存档场景）
    if (store.getPendingEventId() !== null) this.handleTriggered();
  }

  /** 当一个新事件被触发时，搭模态、暂停游戏 */
  private handleTriggered(): void {
    const evt = this.store.getPendingEvent();
    if (!evt) return;
    this.currentEvent = evt;
    this.activeContext = this.store.pickEventContext(evt); // 按当前状态选文本变体
    this.showPlain = true;
    // 用 refcount API：玩家手动暂停态不被覆盖；多模态嵌套时不会互踩
    this.acquirePause();
    this.rebuildButtons();
    this.layout();
    this.container.setVisible(true);
  }

  /** 选择落地或被外部 resolve：销毁按钮、隐藏模态、恢复暂停状态 */
  private handleResolved(): void {
    if (!this.currentEvent) return;
    this.currentEvent = null;
    this.container.setVisible(false);
    this.clearButtons();
    this.releaseHeldPause();
  }

  private toggleLanguage(): void {
    if (!this.currentEvent) return;
    this.showPlain = !this.showPlain;
    this.refreshTexts();
    this.toggleText.setText(this.showPlain ? '古文' : '白话');
  }

  private rebuildButtons(): void {
    this.clearButtons();
    if (!this.currentEvent) return;
    const choices: CourtEventChoice[] = this.currentEvent.choices ?? [];
    if (choices.length === 0) {
      // 非抉择事件：单 [知道了] 按钮
      this.buttons.push(this.makeChoiceButton(0, '知道了'));
      return;
    }
    for (let i = 0; i < choices.length; i++) {
      const ch = choices[i]!;
      const text = this.showPlain ? (ch.textPlain || ch.text) : (ch.text || ch.textPlain);
      this.buttons.push(this.makeChoiceButton(i, text));
    }
  }

  private makeChoiceButton(idx: number, label: string): ChoiceButton {
    const bg = this.scene.add.graphics();
    const text = this.scene.add.text(0, 0, label, {
      ...FONTS.body,
      color: '#F5ECD7',
      fontStyle: 'bold',
      wordWrap: { width: PANEL_WIDTH - 80 },
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const zone = this.scene.add.zone(0, 0, PANEL_WIDTH - 48, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.handleChoice(idx));
    this.container.add([bg, text, zone]);
    return { bg, text, zone, idx };
  }

  private handleChoice(idx: number): void {
    if (!this.currentEvent) return;
    // resolveEvent 会触发 EVENT_RESOLVED → handleResolved 关掉模态
    this.store.resolveEvent(idx);
  }

  private clearButtons(): void {
    for (const b of this.buttons) {
      b.bg.destroy();
      b.text.destroy();
      b.zone.destroy();
    }
    this.buttons = [];
  }

  private refreshTexts(): void {
    if (!this.currentEvent) return;
    const ctx = this.activeContext ?? this.currentEvent.contexts[0];
    if (!ctx) return;
    this.titleText.setText(ctx.title);
    const body = this.showPlain ? ctx.descPlain : ctx.desc;
    this.bodyText.setText(body);
    // 重渲染按钮文本（古文 / 白话）
    const choices = this.currentEvent.choices ?? [];
    for (let i = 0; i < this.buttons.length; i++) {
      const ch = choices[i];
      if (!ch) continue;
      const text = this.showPlain ? (ch.textPlain || ch.text) : (ch.text || ch.textPlain);
      this.buttons[i]?.text.setText(text);
    }
  }

  private refreshCountdown(): void {
    if (!this.currentEvent) return;
    const timeout = this.currentEvent.defaultTimeoutDays;
    if (timeout === undefined) {
      this.countdownText.setText('');
      return;
    }
    const start = this.store.getPendingEventDayStart();
    if (start === null) {
      this.countdownText.setText('');
      return;
    }
    const elapsed = this.store.getCurrentDay() - start;
    const remaining = Math.max(0, timeout - elapsed);
    this.countdownText.setText(remaining > 0 ? `（${remaining} 日内须答复，否则按首选项）` : '（即将自动按首选项）');
  }

  /** 重新计算位置，每次 layout / show 时调用 */
  layout(): void {
    if (!this.currentEvent) return;
    const sceneW = this.scene.scale.width;
    const sceneH = this.scene.scale.height;
    const ctx = this.activeContext ?? this.currentEvent.contexts[0];
    const choices = this.currentEvent.choices ?? [];
    const buttonsCount = choices.length === 0 ? 1 : choices.length;

    this.refreshTexts();
    this.refreshCountdown();

    // 文本测量后决定面板高度
    const titleH = this.titleText.displayHeight;
    const bodyH = this.bodyText.displayHeight;
    const buttonsH = buttonsCount * 40 + (buttonsCount - 1) * 8;
    const padding = 20;
    const sectionGap = 16;
    let panelH = padding + titleH + sectionGap + bodyH + sectionGap + buttonsH + padding + 24; // 24 留给 countdown
    panelH = Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, panelH));

    const panelX = Math.floor((sceneW - PANEL_WIDTH) / 2);
    const panelY = Math.floor((sceneH - panelH) / 2);

    // 全屏遮罩（重画跟着 sceneSize）
    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, sceneW, sceneH);
    // 同步命中 zone 尺寸（窗口缩放后仍吃掉穿透点击）
    this.overlayZone.setPosition(0, 0).setSize(sceneW, sceneH);

    // 面板背景 — 三层嵌套（PAPER + GOLD_DIM + WOOD）
    this.panelBg.clear();
    this.panelBg.fillStyle(COLORS.PAPER, 1);
    this.panelBg.fillRect(panelX, panelY, PANEL_WIDTH, panelH);
    this.panelBg.lineStyle(UI.panelBorderWidth, COLORS.GOLD_DIM, 1);
    this.panelBg.strokeRect(panelX, panelY, PANEL_WIDTH, panelH);
    this.panelBg.lineStyle(UI.panelInnerWoodWidth, COLORS.WOOD_LIGHT, 0.7);
    this.panelBg.strokeRect(panelX + 4, panelY + 4, PANEL_WIDTH - 8, panelH - 8);

    // 标题
    this.titleText.setPosition(panelX + padding, panelY + padding);
    this.titleText.setColor(ctx ? '#3E2723' : '#3E2723');

    // 内容文本
    this.bodyText.setPosition(panelX + padding, panelY + padding + titleH + sectionGap);
    this.bodyText.setColor('#2B2118');

    // 倒计时（紧贴 body 下方）
    this.countdownText.setPosition(panelX + padding, panelY + padding + titleH + sectionGap + bodyH + 4);
    this.countdownText.setColor('#6D635B');

    // toggle 按钮（右上角）
    const toggleX = panelX + PANEL_WIDTH - 64;
    const toggleY = panelY + 12;
    this.toggleZone.setPosition(toggleX, toggleY).setSize(56, 22);
    this.toggleBg.clear();
    this.toggleBg.fillStyle(COLORS.WOOD, 0.9);
    this.toggleBg.fillRect(toggleX, toggleY, 56, 22);
    this.toggleBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.toggleBg.strokeRect(toggleX, toggleY, 56, 22);
    this.toggleText.setPosition(toggleX + 28, toggleY + 11);

    // 按钮（底部）
    const btnAreaTop = panelY + panelH - padding - buttonsH;
    let cy = btnAreaTop;
    for (const b of this.buttons) {
      const x = panelX + padding;
      const w = PANEL_WIDTH - padding * 2;
      b.zone.setPosition(x, cy).setSize(w, 40);
      b.bg.clear();
      b.bg.fillStyle(COLORS.WOOD, 0.92);
      b.bg.fillRect(x, cy, w, 40);
      b.bg.lineStyle(1, COLORS.GOLD_DIM, 1);
      b.bg.strokeRect(x, cy, w, 40);
      b.text.setPosition(x + w / 2, cy + 20);
      cy += 40 + 8;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.EVENT_TRIGGERED, this.onTriggered);
    this.store.off(STATE_EVENTS.EVENT_RESOLVED, this.onResolved);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.clearButtons();
    // hot reload 留下的 pause holder 必须释放，否则新场景仍处于"软暂停"
    this.releaseHeldPause();
    this.container.destroy(true);
  }

  // 测试 / 调试用 hooks
  isVisible(): boolean { return this.container.visible; }
  getCurrentEventId(): string | null { return this.currentEvent?.id ?? null; }
  getButtonCount(): number { return this.buttons.length; }
  /** 测试触发 idx 选择 */
  clickChoice(idx: number): void { this.handleChoice(idx); }
}
