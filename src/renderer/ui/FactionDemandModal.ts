import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { GameStateEventMap } from '../state/stateEvents';
import type { FactionDemand, FactionEffect } from '../data/factions';

/**
 * FactionDemandModal：阶层博弈诉求弹窗（B-4.1）。
 *
 * 人口过 80 后，豪强/外戚/士人会不时上书提诉求。此前 runFactionTick 设了 activeDemand 却从不通知 UI，
 * resolveFactionDemand 也无人调用 → 静默死锁。现监听 FACTION_DEMAND_TRIGGERED 弹出居中模态、暂停游戏，
 * 玩家选「接受/拒绝」→ store.resolveFactionDemand(bool)。范式照 EventModal（全屏遮罩 + 引用计数时停）。
 */

const PANEL_WIDTH = 460;

/** 把诉求后果summary成人话（给按钮副标题）。 */
function summarizeEffect(e: FactionEffect): string {
  const parts: string[] = [];
  if (e.morale) parts.push(`民心 ${e.morale > 0 ? '+' : ''}${e.morale}`);
  if (e.loyaltyDelta) parts.push(`民心 ${e.loyaltyDelta > 0 ? '+' : ''}${e.loyaltyDelta}`);
  if (e.goldMul) parts.push(`钱产出 ${e.goldMul > 0 ? '+' : ''}${Math.round(e.goldMul * 100)}%`);
  if (e.researchMul) parts.push(`学问 ${e.researchMul > 0 ? '+' : ''}${Math.round(e.researchMul * 100)}%`);
  if (e.policySlotCost) parts.push(`国策位 +${e.policySlotCost}`);
  if (e.axisShift) {
    const label = e.axisShift.axis === 'power' ? '权力倾向' : '生产倾向';
    parts.push(`${label} ${e.axisShift.delta > 0 ? '+' : ''}${e.axisShift.delta}`);
  }
  return parts.length ? parts.join('，') : '无明显影响';
}

interface DemandButton {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

export class FactionDemandModal {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly panelBg: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private acceptBtn: DemandButton;
  private rejectBtn: DemandButton;

  private current: FactionDemand | null = null;
  private factionName = '';
  private holdsPause = false;
  private destroyed = false;
  private static readonly PAUSE_HOLDER = 'factionDemand';

  private onTriggered = (payload: GameStateEventMap['state:factionDemandTriggered']): void => {
    const demand = payload.demand as FactionDemand | undefined;
    if (demand) this.show(demand, payload.factionName ?? '');
  };
  private onResolvedExternally = (): void => { if (this.current) this.hide(); };
  private onReplaced = (): void => { if (this.current) this.hide(); };

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

    this.titleText = scene.add.text(0, 0, '', {
      ...FONTS.title, color: COLORS_HEX.GOLD, wordWrap: { width: PANEL_WIDTH - 48 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.bodyText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: COLORS_HEX.PAPER, wordWrap: { width: PANEL_WIDTH - 48 }, lineSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add([this.titleText, this.bodyText]);

    this.acceptBtn = this.makeButton(() => this.resolve(true));
    this.rejectBtn = this.makeButton(() => this.resolve(false));

    store.on(STATE_EVENTS.FACTION_DEMAND_TRIGGERED, this.onTriggered);
    store.on(STATE_EVENTS.FACTION_DEMAND_RESOLVED, this.onResolvedExternally);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
  }

  private makeButton(onClick: () => void): DemandButton {
    const bg = this.scene.add.graphics();
    const text = this.scene.add.text(0, 0, '', {
      ...FONTS.body, color: COLORS_HEX.PAPER, align: 'center',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const zone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', onClick);
    this.container.add([bg, text, zone]);
    return { bg, text, zone };
  }

  private show(demand: FactionDemand, factionName: string): void {
    if (this.destroyed) return;
    this.current = demand;
    this.factionName = factionName;
    if (!this.holdsPause) { this.store.requestPause(FactionDemandModal.PAUSE_HOLDER); this.holdsPause = true; }
    this.layout();
    this.container.setVisible(true);
  }

  private hide(): void {
    this.current = null;
    this.container.setVisible(false);
    if (this.holdsPause) { this.store.releasePause(FactionDemandModal.PAUSE_HOLDER); this.holdsPause = false; }
  }

  private resolve(accepted: boolean): void {
    if (!this.current) return;
    this.store.resolveFactionDemand(accepted); // 会 emit FACTION_DEMAND_RESOLVED → onResolvedExternally 兜底
    this.hide();
  }

  layout(): void {
    if (!this.current) return;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    this.overlay.clear();
    this.overlay.fillStyle(COLORS.BG_INK, 0.6);
    this.overlay.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);

    this.titleText.setText(`【${this.factionName}】${this.current.title}`);
    this.bodyText.setText(this.current.description);

    const titleH = this.titleText.height;
    const bodyH = this.bodyText.height;
    const btnH = 48;
    const panelH = 24 + titleH + 14 + bodyH + 20 + btnH + 24;
    const px = Math.floor((sw - PANEL_WIDTH) / 2);
    const py = Math.floor((sh - panelH) / 2);

    this.panelBg.clear();
    this.panelBg.fillStyle(COLORS.PAPER, 1);
    this.panelBg.fillRect(px, py, PANEL_WIDTH, panelH);
    this.panelBg.lineStyle(UI.panelBorderWidth, COLORS.GOLD_DIM, 1);
    this.panelBg.strokeRect(px, py, PANEL_WIDTH, panelH);
    this.panelBg.lineStyle(1, COLORS.WOOD_LIGHT, 0.7);
    this.panelBg.strokeRect(px + 4, py + 4, PANEL_WIDTH - 8, panelH - 8);
    this.titleText.setColor(COLORS_HEX.INK).setPosition(px + 24, py + 24);
    this.bodyText.setColor(COLORS_HEX.INK).setPosition(px + 24, py + 24 + titleH + 14);

    const btnW = (PANEL_WIDTH - 24 * 2 - 16) / 2;
    const btnY = py + panelH - 24 - btnH;
    const acceptX = px + 24;
    const rejectX = px + 24 + btnW + 16;
    this.paintButton(this.acceptBtn, acceptX, btnY, btnW, btnH, COLORS.STONE_GREEN,
      `接受\n${summarizeEffect(this.current.acceptEffect)}`);
    this.paintButton(this.rejectBtn, rejectX, btnY, btnW, btnH, COLORS.CINNABAR,
      `拒绝\n${summarizeEffect(this.current.rejectEffect)}`);
  }

  private paintButton(btn: DemandButton, x: number, y: number, w: number, h: number, fill: number, label: string): void {
    btn.bg.clear();
    btn.bg.fillStyle(fill, 0.9);
    btn.bg.fillRect(x, y, w, h);
    btn.bg.lineStyle(1, COLORS.GOLD_DIM, 1);
    btn.bg.strokeRect(x, y, w, h);
    btn.text.setText(label).setPosition(x + w / 2, y + h / 2).setFontSize(14);
    btn.zone.setPosition(x, y).setSize(w, h);
  }

  isVisible(): boolean { return this.current !== null; }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.FACTION_DEMAND_TRIGGERED, this.onTriggered);
    this.store.off(STATE_EVENTS.FACTION_DEMAND_RESOLVED, this.onResolvedExternally);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    if (this.holdsPause) { this.store.releasePause(FactionDemandModal.PAUSE_HOLDER); this.holdsPause = false; }
    this.container.destroy(true);
  }

  // 测试 hook
  resolveForTest(accepted: boolean): void { this.resolve(accepted); }
}
