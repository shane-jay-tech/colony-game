import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import { drawDecorativePanelFrame } from './panelDecoration';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { MEGA_PROJECTS, type MegaProjectDef, type MegaProjectReward } from '../data/megaProjects';
import { getBuildingDef } from '../data/buildingRegistry';
import { RESOURCE_LABEL } from './courtFormat';
import type { ResourceId } from '../data/resourceRegistry';

/**
 * MegaProjectPanel：巨型工程「大业」面板（B-4.2）。
 *
 * 铸九鼎/作春秋/修直道——逻辑(启动/分阶段/扣费/完成奖励)早已在 gameStore，但无 UI 入口。
 * 本面板列出 3 项工程：前置(太庙)、分阶段消耗、完成奖励、进行中进度条、启动按钮。打开时时停。
 * HUD「大业」按钮 toggle。范式照 EventModal/FactionDemandModal（居中模态 + 引用计数时停）。
 */

const PANEL_W = 560;
const CARD_H = 116;
const CARD_GAP = 12;

function rewardSummary(r: MegaProjectReward): string {
  const parts: string[] = [];
  if (r.renown) parts.push(`声望 +${r.renown}`);
  if (r.permanentDeter) parts.push('永镇四方（列国不再主动来犯）');
  if (r.researchMul) parts.push(`学问 +${Math.round(r.researchMul * 100)}%`);
  if (r.productionMul) parts.push(`产出 +${Math.round(r.productionMul * 100)}%`);
  if (r.tradeMul) parts.push(`贸易 +${Math.round(r.tradeMul * 100)}%`);
  return parts.join('，');
}

function totalCostSummary(def: MegaProjectDef): string {
  const total: Partial<Record<ResourceId, number>> = {};
  for (const ph of def.phases) {
    for (const [res, amt] of Object.entries(ph.cost)) {
      if (amt) total[res as ResourceId] = (total[res as ResourceId] ?? 0) + amt;
    }
  }
  const parts = Object.entries(total).map(([r, v]) => `${RESOURCE_LABEL[r as ResourceId] ?? r}${v}`);
  const days = def.phases.reduce((s, p) => s + p.durationDays, 0);
  return `${def.phases.length} 阶 · 共 ${days} 日 · 耗 ${parts.join('·')}`;
}

interface ProjectCard {
  def: MegaProjectDef;
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
  progress: Phaser.GameObjects.Graphics;
  btnBg: Phaser.GameObjects.Graphics;
  btnText: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

export class MegaProjectPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly panelBg: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private cards: ProjectCard[] = [];

  private isOpen = false;
  private holdsPause = false;
  private destroyed = false;
  private static readonly PAUSE_HOLDER = 'megaProject';

  private onRefresh = (): void => { if (this.isOpen) this.layout(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    this.overlay = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0).setInteractive({ useHandCursor: false });
    this.overlayZone.on('pointerup', () => this.close()); // 点遮罩外区关闭
    this.container.add([this.overlay, this.overlayZone]);

    this.panelBg = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, '大业 · 巨型工程', {
      ...FONTS.title, color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.closeBg = scene.add.graphics();
    this.closeText = scene.add.text(0, 0, '✕', {
      ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.closeZone = scene.add.zone(0, 0, 32, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerup', () => this.close());
    this.container.add([this.panelBg, this.titleText, this.closeBg, this.closeText, this.closeZone]);

    for (const def of MEGA_PROJECTS) this.cards.push(this.makeCard(def));

    store.on(STATE_EVENTS.MEGA_PROJECT_STARTED, this.onRefresh);
    store.on(STATE_EVENTS.MEGA_PROJECT_COMPLETED, this.onRefresh);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.onRefresh);
    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onRefresh);
    store.on(STATE_EVENTS.DAY_TICK, this.onRefresh);
  }

  private makeCard(def: MegaProjectDef): ProjectCard {
    const bg = this.scene.add.graphics();
    const nameText = this.scene.add.text(0, 0, def.name, {
      ...FONTS.panelHeading, color: COLORS_HEX.INK,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const descText = this.scene.add.text(0, 0, `${def.description}\n${rewardSummary(def.reward)}`, {
      ...FONTS.small, color: COLORS_HEX.INK_SMALL, wordWrap: { width: PANEL_W - 200 }, lineSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const statusText = this.scene.add.text(0, 0, '', {
      ...FONTS.small, color: COLORS_HEX.INK_SMALL,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const progress = this.scene.add.graphics();
    const btnBg = this.scene.add.graphics();
    const btnText = this.scene.add.text(0, 0, '兴建', {
      ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const zone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.onStartClick(def));
    this.container.add([bg, nameText, descText, statusText, progress, btnBg, btnText, zone]);
    return { def, bg, nameText, descText, statusText, progress, btnBg, btnText, zone };
  }

  private onStartClick(def: MegaProjectDef): void {
    const ok = this.store.startMegaProject(def.id);
    const toast = this.scene.registry.get('toast') as { show?: (m: string, k?: string) => void } | undefined;
    if (ok) toast?.show?.(`已兴「${def.name}」之役，国之大业自此始`, 'info');
    else toast?.show?.(this.startFailReason(def), 'error');
    this.layout();
  }

  private startFailReason(def: MegaProjectDef): string {
    if (this.store.getMegaProjects().some(p => p.projectId === def.id)) return `「${def.name}」已在兴建或已成`;
    if (def.prerequisiteBuilding && !this.hasPrereq(def)) {
      return `需先建「${getBuildingDef(def.prerequisiteBuilding)?.name ?? def.prerequisiteBuilding}」`;
    }
    return `无法兴建「${def.name}」`;
  }

  private hasPrereq(def: MegaProjectDef): boolean {
    if (!def.prerequisiteBuilding) return true;
    return this.store.getBuildings().some(b => b.defId === def.prerequisiteBuilding);
  }

  toggle(): void { this.isOpen ? this.close() : this.open(); }
  open(): void {
    if (this.destroyed || this.isOpen) return;
    this.isOpen = true;
    if (!this.holdsPause) { this.store.requestPause(MegaProjectPanel.PAUSE_HOLDER); this.holdsPause = true; }
    this.layout();
    this.container.setVisible(true);
  }
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.setVisible(false);
    if (this.holdsPause) { this.store.releasePause(MegaProjectPanel.PAUSE_HOLDER); this.holdsPause = false; }
  }
  isVisible(): boolean { return this.isOpen; }

  layout(): void {
    if (!this.isOpen) return;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const panelH = 80 + this.cards.length * (CARD_H + CARD_GAP);
    const px = Math.floor((sw - PANEL_W) / 2);
    const py = Math.floor((sh - panelH) / 2);

    this.overlay.clear();
    this.overlay.fillStyle(COLORS.BG_INK, 0.6);
    this.overlay.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);

    this.panelBg.clear();
    drawDecorativePanelFrame(this.panelBg, px, py, PANEL_W, panelH, 'left');
    this.titleText.setPosition(px + 24, py + 20);
    const closeX = px + PANEL_W - 44; const closeY = py + 16;
    this.closeBg.clear();
    this.closeBg.fillStyle(COLORS.CINNABAR, 0.85);
    this.closeBg.fillRect(closeX, closeY, 32, 32);
    this.closeText.setPosition(closeX + 16, closeY + 16);
    this.closeZone.setPosition(closeX, closeY).setSize(32, 32);

    const progs = this.store.getMegaProjects();
    let cy = py + 64;
    for (const card of this.cards) {
      this.layoutCard(card, px + 20, cy, PANEL_W - 40, progs);
      cy += CARD_H + CARD_GAP;
    }
  }

  private layoutCard(card: ProjectCard, x: number, y: number, w: number, progs: readonly { projectId: string; currentPhase: number; daysRemaining: number; completed: boolean }[]): void {
    const def = card.def;
    const prog = progs.find(p => p.projectId === def.id);
    const hasPrereq = this.hasPrereq(def);

    card.bg.clear();
    card.bg.fillStyle(COLORS.PAPER_DIM, 0.85);
    card.bg.fillRect(x, y, w, CARD_H);
    card.bg.lineStyle(1, COLORS.GOLD_DIM, 1);
    card.bg.strokeRect(x, y, w, CARD_H);
    card.nameText.setPosition(x + 14, y + 12);
    card.descText.setPosition(x + 14, y + 44);
    card.statusText.setPosition(x + 14, y + CARD_H - 32);

    // 按钮区域（右侧）
    const btnW = 120; const btnH = 40;
    const btnX = x + w - btnW - 14; const btnY = y + 14;
    card.progress.clear();

    let btnLabel = '兴建'; let btnFill: number = COLORS.GOLD_DIM; let btnEnabled = true; let status = '';

    if (prog?.completed) {
      btnLabel = '已成'; btnFill = COLORS.STONE_GREEN; btnEnabled = false;
      status = `✓ 功成 · ${rewardSummary(def.reward)}`;
    } else if (prog) {
      // 进行中：进度条
      btnLabel = '兴建中'; btnFill = COLORS.WOOD_LIGHT; btnEnabled = false;
      const phaseDays = def.phases[prog.currentPhase]?.durationDays ?? 1;
      const done = prog.currentPhase + (phaseDays > 0 ? (phaseDays - prog.daysRemaining) / phaseDays : 0);
      const pct = Math.min(100, Math.floor((done / def.phases.length) * 100));
      status = `第 ${prog.currentPhase + 1}/${def.phases.length} 阶 · ${prog.daysRemaining} 日 · ${pct}%`;
      const barX = x + 14; const barY = y + CARD_H - 10; const barW = w - 160;
      card.progress.fillStyle(COLORS.WOOD, 0.6);
      card.progress.fillRect(barX, barY, barW, 4);
      card.progress.fillStyle(COLORS.GOLD, 1);
      card.progress.fillRect(barX, barY, Math.floor(barW * pct / 100), 4);
    } else if (!hasPrereq) {
      btnLabel = '前置未足'; btnFill = COLORS.ASH; btnEnabled = false;
      status = `需先建「${getBuildingDef(def.prerequisiteBuilding ?? '')?.name ?? '前置建筑'}」 · ${totalCostSummary(def)}`;
    } else {
      status = totalCostSummary(def);
    }

    card.statusText.setText(status);
    card.btnBg.clear();
    card.btnBg.fillStyle(btnFill, btnEnabled ? 0.95 : 0.5);
    card.btnBg.fillRect(btnX, btnY, btnW, btnH);
    card.btnBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    card.btnBg.strokeRect(btnX, btnY, btnW, btnH);
    card.btnText.setText(btnLabel).setPosition(btnX + btnW / 2, btnY + btnH / 2);
    // zone 仅在可兴建时接收点击
    card.zone.setPosition(btnX, btnY).setSize(btnW, btnH).setVisible(btnEnabled);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.MEGA_PROJECT_STARTED, this.onRefresh);
    this.store.off(STATE_EVENTS.MEGA_PROJECT_COMPLETED, this.onRefresh);
    this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.onRefresh);
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onRefresh);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onRefresh);
    if (this.holdsPause) { this.store.releasePause(MegaProjectPanel.PAUSE_HOLDER); this.holdsPause = false; }
    this.container.destroy(true);
  }

  // 测试 hooks
  getCardCount(): number { return this.cards.length; }
  startByIndex(i: number): void { const c = this.cards[i]; if (c) this.onStartClick(c.def); }
}
