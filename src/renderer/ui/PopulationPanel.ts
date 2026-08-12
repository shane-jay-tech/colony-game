import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { drawDecorativePanelFrame } from './panelDecoration';

/**
 * 人口详情面板（中央模态）——2026-06-17 加。
 *
 * 点 HUD 顶栏「民」token 打开。把顶栏放不下的细节一次讲清：
 *   - 总口 / 居室（当前 / 住房上限）
 *   - 今日趋势：▲ 约 +X（粮足生养）/ ━ 居室已满 / ▼ 仓廪将罄 / ─ 暂无增减
 *   - 农 / 工 / 兵 / 士 四阶层：各自人数 + 在岗 · 闲
 *   - 粮储约够几日（<3 日飘红）/ 居室余量
 *
 * 不暂停游戏；点关闭按钮 / 点面板外区关闭。文案半文半白、禁生僻偏字。
 * 销毁：UIScene.shutdown 调 .destroy()。
 */

const PANEL_WIDTH = 460;
const PANEL_HEIGHT = 440;

const CLASS_ROWS: { key: 'farmer' | 'worker' | 'soldier' | 'scholar'; name: string; verb: string }[] = [
  { key: 'farmer', name: '农 民', verb: '耕作' },
  { key: 'worker', name: '工 匠', verb: '劳作' },
  { key: 'soldier', name: '兵 士', verb: '戍守' },
  { key: 'scholar', name: '士 人', verb: '任职' },
];

export class PopulationPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlayBg: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bgGfx: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly summaryText: Phaser.GameObjects.Text;
  private readonly trendText: Phaser.GameObjects.Text;
  private readonly tableHeader: Phaser.GameObjects.Text;
  private readonly rowTexts: Phaser.GameObjects.Text[] = [];
  private readonly footerText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeLabel: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private isOpen = false;
  private destroyed = false;

  private onResources = (): void => { if (this.isOpen) this.refresh(); };
  private onDayTick = (): void => { if (this.isOpen) this.refresh(); };
  private onReplaced = (): void => { if (this.isOpen) this.refresh(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    // 半透黑遮罩 + 点击外区关闭
    this.overlayBg = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.overlayZone.on('pointerdown', () => this.close());
    this.container.add([this.overlayBg, this.overlayZone]);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.titleText = scene.add.text(0, 0, '国中之民', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.summaryText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.trendText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.tableHeader = scene.add.text(0, 0, '阶层　　人数　　在岗 · 闲', {
      ...FONTS.small, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.footerText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add([this.titleText, this.summaryText, this.trendText, this.tableHeader, this.footerText]);

    for (let i = 0; i < CLASS_ROWS.length; i++) {
      const t = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#F5ECD7',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.rowTexts.push(t);
      this.container.add(t);
    }

    // 关闭按钮
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

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
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

    let cy = y + 62;
    this.summaryText.setPosition(x + 20, cy); cy += 32;
    this.trendText.setPosition(x + 20, cy); cy += 38;
    this.tableHeader.setPosition(x + 20, cy); cy += 28;
    for (const t of this.rowTexts) { t.setPosition(x + 24, cy); cy += 30; }
    cy += 10;
    this.footerText.setPosition(x + 20, cy);
  }

  private refresh(): void {
    if (this.destroyed) return;
    const s = this.store.getPopulationStatus();

    this.summaryText.setText(`总口：${s.total} 人　　居室：${s.total} / ${s.cap} 间`);

    let trend: string;
    let trendColor: string;
    if (s.reason === 'grow') {
      const d = Math.round(s.dailyRaw * 10) / 10;
      trend = `今日：▲ 约 +${d} 口（仓有余粮，生养渐旺）`;
      trendColor = '#F5ECD7';
    } else if (s.reason === 'cap') {
      trend = '今日：━ 居室已满，须广厦方能纳新民';
      trendColor = '#C9A84C';
    } else if (s.reason === 'starve') {
      trend = '今日：▼ 仓廪将罄，民心浮动、恐有流散';
      trendColor = '#B71C1C';
    } else {
      trend = '今日：─ 暂无增减';
      trendColor = '#E6DCC3';
    }
    this.trendText.setText(trend);
    this.trendText.setColor(trendColor);

    for (let i = 0; i < CLASS_ROWS.length; i++) {
      const row = CLASS_ROWS[i]!;
      const total = s.classes[row.key];
      const occ = s.occupation[row.key];
      const idle = Math.max(0, total - occ);
      this.rowTexts[i]!.setText(`${row.name}　　${String(total).padStart(3, ' ')}　　${row.verb} ${occ} · 闲 ${idle}`);
    }

    const room = Math.max(0, s.cap - s.total);
    const grainLine = Number.isFinite(s.grainDays)
      ? `粮储：约够 ${Math.floor(s.grainDays)} 日`
      : '粮储：充盈';
    this.footerText.setText(`${grainLine}　　居室余量：${room} 间`);
    this.footerText.setColor(Number.isFinite(s.grainDays) && s.grainDays < 3 ? '#B71C1C' : '#E6DCC3');
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.container.destroy(true);
  }
}
