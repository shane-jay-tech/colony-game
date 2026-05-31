import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import { drawDecorativePanelFrame } from './panelDecoration';
import { terrainColor, resourceNodeColor } from '../render/mapColors';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';

/**
 * v1.0 #7：地形/资源图例。用户原话「地图上的各个资源不明所以，我根本看不懂这些色块到底代表什么东西」。
 *
 * 一个浮动小面板，固定在地图视口左下角；可折叠为 28px 标题条。颜色直接调用 mapColors，
 * 保证图例与地图永远同源。
 *
 * 不持久化折叠态（轻量 UI helper，不污染存档）；监听 PANEL_COLLAPSED_CHANGED 跟随左面板宽度。
 */

const TERRAIN_ROWS: ReadonlyArray<{ name: string; color: number; desc: string }> = [
  { name: '平原', color: terrainColor('plain'), desc: '宜耕宜居' },
  { name: '丘陵', color: terrainColor('hills'), desc: '可垦可牧' },
  { name: '林地', color: terrainColor('forest'), desc: '伐木所自' },
  { name: '河泽', color: terrainColor('river'), desc: '渔盐之利' },
  { name: '山岳', color: terrainColor('mountain'), desc: '不可耕作' },
];

const NODE_ROWS: ReadonlyArray<{ name: string; color: number; desc: string }> = [
  { name: '林木', color: resourceNodeColor('forest_node'), desc: '加产木' },
  { name: '石脉', color: resourceNodeColor('stone_node'), desc: '加产石' },
  { name: '河汊', color: resourceNodeColor('river_node'), desc: '加产粮' },
];

const PANEL_W = 200;
const ROW_H = 18;
const PAD = 12;
const TITLE_H = 22;
const SECTION_GAP = 8;
const COLLAPSED_H = 28;
const SWATCH_SIZE = 14;
const PANEL_DEPTH = 950;

/** 展开态总高 = 边距 + 主标题 + (5 行+小节标题 + 间距) + (3 行+小节标题) + 边距 */
const EXPANDED_H =
  PAD * 2 +
  TITLE_H +
  TITLE_H + TERRAIN_ROWS.length * ROW_H +
  SECTION_GAP +
  TITLE_H + NODE_ROWS.length * ROW_H;

export class Legend {
  private scene: Phaser.Scene;
  private store: GameStore;
  private container: Phaser.GameObjects.Container;
  private bgGfx: Phaser.GameObjects.Graphics;
  private rowsGfx: Phaser.GameObjects.Graphics;
  private toggleZone: Phaser.GameObjects.Zone;
  private toggleLabel: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private collapsed = false;

  private onPanelCollapsed = (): void => this.layout();

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setDepth(PANEL_DEPTH);
    this.bgGfx = scene.add.graphics();
    this.rowsGfx = scene.add.graphics();
    this.container.add(this.bgGfx);
    this.container.add(this.rowsGfx);

    this.titleText = scene.add.text(0, 0, '山川物产 ▾', {
      ...FONTS.panelHeading,
      fontSize: '16px',
      color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    this.toggleLabel = scene.add.text(0, 0, '', { ...FONTS.smallDim } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.toggleLabel);

    this.toggleZone = scene.add.zone(0, 0, PANEL_W, TITLE_H + PAD).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.toggleZone.on('pointerup', () => {
      this.collapsed = !this.collapsed;
      this.layout();
    });
    this.container.add(this.toggleZone);

    store.on(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.layout();
  }

  layout(): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const W = cam.width;
    const H = cam.height;
    // 视口左下：跟随左面板折叠态。展开 256 + 8 padding；折叠 28 + 8 padding。
    const leftCollapsed = this.store.getPanelCollapsed('left');
    const leftPanelW = leftCollapsed ? 28 : UI.buildPanelWidth;
    const x = 8 + leftPanelW + 12;
    const panelH = this.collapsed ? COLLAPSED_H : EXPANDED_H;
    const y = H - panelH - 12;
    this.container.setPosition(x, y);

    // 背景框 + 装饰
    this.bgGfx.clear();
    drawDecorativePanelFrame(this.bgGfx, 0, 0, PANEL_W, panelH, 'left');

    // 标题
    this.titleText.setPosition(PAD, PAD - 2);
    this.titleText.setText(this.collapsed ? '山川物产 ▸' : '山川物产 ▾');

    // 折叠态只画标题；展开态画两节内容
    this.toggleZone.setSize(PANEL_W, this.collapsed ? COLLAPSED_H : TITLE_H + PAD);
    this.toggleZone.setPosition(0, 0);

    this.rowsGfx.clear();
    // 复用 rowTexts 池：先全部隐藏，按需亮
    for (const t of this.rowTexts) t.setVisible(false);
    this.toggleLabel.setVisible(false);

    if (this.collapsed) return;

    let cursorY = PAD + TITLE_H;
    let textIdx = 0;

    // ---- 山川（地形）----
    cursorY = this.drawSection('— 山川 —', cursorY, TERRAIN_ROWS, textIdx);
    textIdx += TERRAIN_ROWS.length + 1;

    cursorY += SECTION_GAP;

    // ---- 物产（资源点）----
    cursorY = this.drawSection('— 物产 —', cursorY, NODE_ROWS, textIdx);
  }

  private drawSection(
    title: string,
    startY: number,
    rows: ReadonlyArray<{ name: string; color: number; desc: string }>,
    textIdxBase: number,
  ): number {
    // 小节标题
    const titleT = this.ensureText(textIdxBase);
    titleT.setStyle({
      ...FONTS.small,
      color: COLORS_HEX.GOLD_DIM,
      fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    titleT.setPosition(PAD, startY);
    titleT.setText(title);
    titleT.setVisible(true);

    let y = startY + TITLE_H - 4;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      // swatch
      const sx = PAD + 2;
      const sy = y + (ROW_H - SWATCH_SIZE) / 2;
      this.rowsGfx.fillStyle(row.color, 1);
      this.rowsGfx.fillRect(sx, sy, SWATCH_SIZE, SWATCH_SIZE);
      this.rowsGfx.lineStyle(1, COLORS.INK, 0.7);
      this.rowsGfx.strokeRect(sx, sy, SWATCH_SIZE, SWATCH_SIZE);

      // name + desc
      const t = this.ensureText(textIdxBase + 1 + i);
      t.setStyle({
        ...FONTS.small,
        color: COLORS_HEX.PAPER,
      } as Phaser.Types.GameObjects.Text.TextStyle);
      t.setPosition(sx + SWATCH_SIZE + 8, y + 1);
      t.setText(`${row.name} · ${row.desc}`);
      t.setVisible(true);

      y += ROW_H;
    }
    return y;
  }

  private ensureText(idx: number): Phaser.GameObjects.Text {
    let t = this.rowTexts[idx];
    if (!t) {
      t = this.scene.add.text(0, 0, '', { ...FONTS.small } as Phaser.Types.GameObjects.Text.TextStyle);
      this.container.add(t);
      this.rowTexts[idx] = t;
    }
    return t;
  }

  destroy(): void {
    this.store.off(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.toggleZone.destroy();
    this.toggleLabel.destroy();
    this.titleText.destroy();
    this.bgGfx.destroy();
    this.rowsGfx.destroy();
    for (const t of this.rowTexts) t.destroy();
    this.rowTexts = [];
    this.container.destroy();
  }
}
