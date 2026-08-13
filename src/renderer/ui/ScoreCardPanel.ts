import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { drawDecorativePanelFrame } from './panelDecoration';

/**
 * 终局记分牌（中央模态）——P2 目标感系统（2026-08-14，对标群星多维胜利分 + HOI4 胜利点）。
 *
 * 触发：沙盒登顶天下共主 / 故事三结局（UIScene 自动弹）；平时点 HUD「记」随时查。
 * 内容：多维功业（国格/人口/城建/盟邦/慑服/低谷/古迹/大业/终局风浪/结局/存续）+ 总分 + 评语，
 * 历史最高分存 localStorage（meta 数据，不进存档 schema）。
 * 不暂停游戏；点关闭按钮 / 点面板外区关闭。销毁：UIScene.shutdown 调 .destroy()。
 */

const PANEL_WIDTH = 580;
const PANEL_HEIGHT = 600;
const BEST_KEY = 'bgl_best_score';

export interface BestScore {
  total: number;
  day: number;
}

export function loadBestScore(): BestScore | null {
  try {
    const raw = window.localStorage?.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { total?: unknown; day?: unknown };
    if (typeof parsed.total !== 'number' || typeof parsed.day !== 'number') return null;
    return { total: parsed.total, day: parsed.day };
  } catch {
    return null;
  }
}

export function saveBestScore(score: BestScore): void {
  try {
    window.localStorage?.setItem(BEST_KEY, JSON.stringify(score));
  } catch {
    // 存储不可用（隐私模式等）静默降级：只当次显示，不记历史
  }
}

interface RowTexts {
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  points: Phaser.GameObjects.Text;
}

export class ScoreCardPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlayBg: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bgGfx: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly verdictText: Phaser.GameObjects.Text;
  private readonly totalText: Phaser.GameObjects.Text;
  private readonly rows: RowTexts[] = [];
  private readonly bestText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeLabel: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private isOpen = false;
  private destroyed = false;

  private onDayTick = (): void => { if (this.isOpen) this.refresh(); };
  private onGradeChanged = (): void => { if (this.isOpen) this.refresh(); };
  private onReplaced = (): void => { if (this.isOpen) this.refresh(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    this.overlayBg = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.overlayZone.on('pointerdown', () => this.close());
    this.container.add([this.overlayBg, this.overlayZone]);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.titleText = scene.add.text(0, 0, '功业 · 记分牌', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.verdictText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.totalText = scene.add.text(0, 0, '', {
      ...FONTS.number, color: '#C9A84C', fontSize: '30px',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add([this.titleText, this.verdictText, this.totalText]);

    for (let i = 0; i < 12; i++) {
      const label = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#F5ECD7',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const value = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#E6DCC3',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const points = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#4A7C59',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.rows.push({ label, value, points });
      this.container.add([label, value, points]);
    }

    this.bestText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.bestText);

    this.closeBg = scene.add.graphics();
    this.closeLabel = scene.add.text(0, 0, '×', {
      ...FONTS.panelHeading, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.closeZone = scene.add.zone(0, 0, 28, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.close();
    });
    this.container.add([this.closeBg, this.closeLabel, this.closeZone]);

    this.layout();

    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
  }

  open(): void {
    if (this.destroyed || this.isOpen) return;
    this.isOpen = true;
    this.container.setVisible(true);
    this.layout();
    this.refresh();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.setVisible(false);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  isVisible(): boolean { return this.isOpen; }

  layout(): void {
    if (this.destroyed) return;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    this.overlayBg.clear();
    this.overlayBg.fillStyle(0x000000, 0.55);
    this.overlayBg.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);

    const w = Math.min(PANEL_WIDTH, sw - 40);
    const h = Math.min(PANEL_HEIGHT, sh - 40);
    const x = Math.floor((sw - w) / 2);
    const y = Math.floor((sh - h) / 2);

    this.bgGfx.clear();
    drawDecorativePanelFrame(this.bgGfx, x, y, w, h, 'left');

    this.titleText.setPosition(x + 20, y + 16);

    const closeSize = 28;
    const closeX = x + w - closeSize - 14;
    const closeY = y + 14;
    this.closeZone.setPosition(closeX, closeY).setSize(closeSize, closeSize);
    this.closeBg.clear();
    this.closeBg.fillStyle(COLORS.CINNABAR, 0.9);
    this.closeBg.fillRect(closeX, closeY, closeSize, closeSize);
    this.closeBg.lineStyle(1, COLORS.GOLD, 1);
    this.closeBg.strokeRect(closeX, closeY, closeSize, closeSize);
    this.closeLabel.setPosition(closeX + closeSize / 2, closeY + closeSize / 2);

    this.verdictText.setPosition(x + 24, y + 56);
    this.totalText.setPosition(x + 24, y + 84);
    let cy = y + 130;
    for (const row of this.rows) {
      row.label.setPosition(x + 24, cy);
      row.value.setPosition(x + 240, cy);
      row.points.setPosition(x + 460, cy);
      cy += 30;
    }
    this.bestText.setPosition(x + 24, cy + 4);
  }

  private refresh(): void {
    if (this.destroyed) return;
    const score = this.store.getScoreCard();
    this.verdictText.setText(score.verdict);
    this.totalText.setText('总分　' + score.total);

    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]!;
      const item = score.items[i];
      if (!item) { row.label.setText(''); row.value.setText(''); row.points.setText(''); continue; }
      row.label.setText(item.label);
      row.value.setText(item.valueText);
      row.points.setText('+' + item.points);
    }

    // 历史最高：更新并展示
    const best = loadBestScore();
    const day = this.store.getCurrentDay();
    if (!best || score.total > best.total) {
      saveBestScore({ total: score.total, day });
      this.bestText.setText('此为当前最高功业（第 ' + (day + 1) + ' 日）。');
      this.bestText.setColor('#4A7C59');
    } else {
      this.bestText.setText('历史最高 ' + best.total + '（第 ' + (best.day + 1) + ' 日）。再进一步，改写青史。');
      this.bestText.setColor('#E6DCC3');
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.container.destroy(true);
  }
}
