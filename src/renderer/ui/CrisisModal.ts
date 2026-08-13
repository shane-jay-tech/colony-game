import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { GameStateEventMap } from '../state/stateEvents';

/**
 * CrisisModal：低谷危机通告（Phase1 失败模型）。
 *
 * 监听 store CRISIS_TRIGGERED：弹居中模态，半文半白说明后果（掉人口/降格/挫士气），
 * 单 [知道了] 按钮。打开期间 requestPause 软暂停给玩家喘息；关闭恢复。
 *
 * 与 EventModal 区分：这不是朝议抉择（无 choices、不走 pendingEvent），是一次性通告。
 * 深度 2000（与 EventModal 同层，但二者不会同时触发同类堆叠）。
 */

const PANEL_WIDTH = 460;
const PANEL_MIN_HEIGHT = 200;

export class CrisisModal {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly panelBg: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly btnBg: Phaser.GameObjects.Graphics;
  private readonly btnText: Phaser.GameObjects.Text;
  private readonly btnZone: Phaser.GameObjects.Zone;

  private visible = false;
  private holdsPause = false;
  private destroyed = false;
  private static readonly PAUSE_HOLDER = 'crisis';

  private onCrisis = (payload: GameStateEventMap['state:crisisTriggered']): void => this.handleCrisis(payload);
  private onReplaced = (): void => { if (this.visible) this.dismiss(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    this.overlay = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0).setInteractive({ useHandCursor: false });
    this.container.add([this.overlay, this.overlayZone]);

    this.panelBg = scene.add.graphics();
    this.container.add(this.panelBg);

    this.titleText = scene.add.text(0, 0, '国势倾颓', {
      ...FONTS.title,
      color: COLORS_HEX.CINNABAR,
      wordWrap: { width: PANEL_WIDTH - 48 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    this.bodyText = scene.add.text(0, 0, '', {
      ...FONTS.body,
      color: '#2B2118',
      wordWrap: { width: PANEL_WIDTH - 48 },
      lineSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.bodyText);

    this.btnBg = scene.add.graphics();
    this.btnText = scene.add.text(0, 0, '知道了', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.btnZone = scene.add.zone(0, 0, PANEL_WIDTH - 48, 40).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.btnZone.on('pointerdown', () => this.dismiss());
    this.container.add([this.btnBg, this.btnText, this.btnZone]);

    store.on(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
  }

  private handleCrisis(payload: GameStateEventMap['state:crisisTriggered']): void {
    const summary = payload.summary
      || '国库空、仓廪罄，旷日六旬。民有流散、士气大挫。励精图治，尚可再起。';
    this.bodyText.setText(summary);
    if (!this.holdsPause) {
      this.store.requestPause(CrisisModal.PAUSE_HOLDER);
      this.holdsPause = true;
    }
    this.visible = true;
    this.layout();
    this.container.setVisible(true);
  }

  private dismiss(): void {
    if (!this.visible) return;
    this.visible = false;
    this.container.setVisible(false);
    if (this.holdsPause) {
      this.store.releasePause(CrisisModal.PAUSE_HOLDER);
      this.holdsPause = false;
    }
  }

  layout(): void {
    if (!this.visible) return;
    const sceneW = this.scene.scale.width;
    const sceneH = this.scene.scale.height;

    const padding = 20;
    const sectionGap = 16;
    const titleH = this.titleText.displayHeight;
    const bodyH = this.bodyText.displayHeight;
    const btnH = 40;
    let panelH = padding + titleH + sectionGap + bodyH + sectionGap + btnH + padding;
    panelH = Math.max(PANEL_MIN_HEIGHT, panelH);

    const panelX = Math.floor((sceneW - PANEL_WIDTH) / 2);
    const panelY = Math.floor((sceneH - panelH) / 2);

    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(0, 0, sceneW, sceneH);
    this.overlayZone.setPosition(0, 0).setSize(sceneW, sceneH);

    this.panelBg.clear();
    this.panelBg.fillStyle(COLORS.PAPER, 1);
    this.panelBg.fillRect(panelX, panelY, PANEL_WIDTH, panelH);
    this.panelBg.lineStyle(UI.panelBorderWidth, COLORS.CINNABAR, 0.9);
    this.panelBg.strokeRect(panelX, panelY, PANEL_WIDTH, panelH);
    this.panelBg.lineStyle(UI.panelInnerWoodWidth, COLORS.WOOD_LIGHT, 0.7);
    this.panelBg.strokeRect(panelX + 4, panelY + 4, PANEL_WIDTH - 8, panelH - 8);

    this.titleText.setPosition(panelX + padding, panelY + padding);
    this.bodyText.setPosition(panelX + padding, panelY + padding + titleH + sectionGap);

    const btnY = panelY + panelH - padding - btnH;
    const btnX = panelX + padding;
    const btnW = PANEL_WIDTH - padding * 2;
    this.btnZone.setPosition(btnX, btnY).setSize(btnW, btnH);
    this.btnBg.clear();
    this.btnBg.fillStyle(COLORS.WOOD, 0.92);
    this.btnBg.fillRect(btnX, btnY, btnW, btnH);
    this.btnBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.btnBg.strokeRect(btnX, btnY, btnW, btnH);
    this.btnText.setPosition(btnX + btnW / 2, btnY + btnH / 2);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    if (this.holdsPause) {
      this.store.releasePause(CrisisModal.PAUSE_HOLDER);
      this.holdsPause = false;
    }
    this.container.destroy(true);
  }

  // 测试 hooks
  isVisible(): boolean { return this.container.visible; }
}
