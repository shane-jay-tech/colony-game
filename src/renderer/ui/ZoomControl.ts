import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import {
  MAP_ZOOM_MIN,
  MAP_ZOOM_MAX,
  MAP_ZOOM_STEP,
  type MapRenderer,
} from '../render/MapRenderer';

/**
 * v1.0 #5：地图缩放小工具条（视口右下角）。三键：+ / - / ⊙ 重置。
 * 不持久化 zoom（与 panel 折叠不同：zoom 是临时观察姿态而非偏好），所以本组件不写存档。
 *
 * 与 GameScene 解耦：直接拿 MapRenderer 引用调 setMapZoom / resetView。
 * 监听 PANEL_COLLAPSED_CHANGED 跟随右面板折叠位置重排。
 */

const BTN_SIZE = 30;
const BTN_GAP = 4;
const PAD = 8;
const PANEL_W = BTN_SIZE * 3 + BTN_GAP * 2 + PAD * 2;
const PANEL_H = BTN_SIZE + PAD * 2 + 16; // 底部留 16px 给 zoom 数字
const PANEL_DEPTH = 950;

interface Btn {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

export class ZoomControl {
  private scene: Phaser.Scene;
  private store: GameStore;
  private getRenderer: () => MapRenderer | null;
  private container: Phaser.GameObjects.Container;
  private bgGfx: Phaser.GameObjects.Graphics;
  private zoomText: Phaser.GameObjects.Text;
  private btnZoomIn: Btn;
  private btnZoomOut: Btn;
  private btnReset: Btn;
  /** 250ms 同步 zoom 数字的循环定时器；destroy 时必须移除，否则回调会打到已销毁的 zoomText */
  private zoomTimer?: Phaser.Time.TimerEvent;

  private onPanelCollapsed = (): void => this.layout();

  constructor(scene: Phaser.Scene, store: GameStore, getRenderer: () => MapRenderer | null) {
    this.scene = scene;
    this.store = store;
    this.getRenderer = getRenderer;
    this.container = scene.add.container(0, 0).setDepth(PANEL_DEPTH);
    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.zoomText = scene.add.text(0, 0, '×1.0', {
      ...FONTS.smallDim,
      color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
    this.container.add(this.zoomText);

    this.btnZoomIn = this.createBtn('+', () => {
      const r = this.getRenderer();
      if (!r) return;
      r.setMapZoom(r.getMapZoom() + MAP_ZOOM_STEP);
      this.refreshZoomText();
    });
    this.btnZoomOut = this.createBtn('−', () => {
      const r = this.getRenderer();
      if (!r) return;
      r.setMapZoom(r.getMapZoom() - MAP_ZOOM_STEP);
      this.refreshZoomText();
    });
    this.btnReset = this.createBtn('⊙', () => {
      const r = this.getRenderer();
      if (!r) return;
      r.resetView();
      this.refreshZoomText();
    });

    store.on(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.layout();
    // 每 250ms 同步一次 zoom 数字（滚轮也会触发，省了在 GameScene 显式回调）
    this.zoomTimer = scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => this.refreshZoomText(),
    });
  }

  private createBtn(label: string, onClick: () => void): Btn {
    const bg = this.scene.add.graphics();
    const t = this.scene.add.text(0, 0, label, {
      ...FONTS.body,
      color: COLORS_HEX.GOLD,
      fontStyle: 'bold',
      fontSize: '20px',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const z = this.scene.add.zone(0, 0, BTN_SIZE, BTN_SIZE).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    z.on('pointerup', onClick);
    z.on('pointerover', () => { bg.alpha = 0.6; });
    z.on('pointerout', () => { bg.alpha = 1; });
    this.container.add([bg, t, z]);
    return { bg, label: t, zone: z };
  }

  private drawBtnBg(b: Btn, x: number, y: number): void {
    b.bg.clear();
    b.bg.fillStyle(COLORS.WOOD, 0.95);
    b.bg.fillRect(x, y, BTN_SIZE, BTN_SIZE);
    b.bg.lineStyle(1, COLORS.GOLD_DIM, 0.85);
    b.bg.strokeRect(x, y, BTN_SIZE, BTN_SIZE);
    b.label.setPosition(x + BTN_SIZE / 2, y + BTN_SIZE / 2);
    b.zone.setPosition(x, y);
  }

  layout(): void {
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const W = cam.width;
    const H = cam.height;
    const rightCollapsed = this.store.getPanelCollapsed('right');
    const rightPanelW = rightCollapsed ? 28 : UI.rightPanelWidth;
    const x = W - rightPanelW - 8 - PANEL_W - 12;
    const y = H - PANEL_H - 12;
    this.container.setPosition(x, y);

    this.bgGfx.clear();
    this.bgGfx.fillStyle(COLORS.WOOD, 0.88);
    this.bgGfx.fillRect(0, 0, PANEL_W, PANEL_H);
    this.bgGfx.lineStyle(2, COLORS.GOLD_DIM, 1);
    this.bgGfx.strokeRect(0, 0, PANEL_W, PANEL_H);

    const btnY = PAD;
    const inX = PAD;
    const outX = PAD + BTN_SIZE + BTN_GAP;
    const resetX = PAD + (BTN_SIZE + BTN_GAP) * 2;
    this.drawBtnBg(this.btnZoomOut, outX, btnY);
    this.drawBtnBg(this.btnZoomIn, inX, btnY);
    this.drawBtnBg(this.btnReset, resetX, btnY);
    // 注：UI 上 + 在左、− 在中间、⊙ 在右；按钮文字本身是 inX 显示 +、outX 显示 −、resetX 显示 ⊙
    // 这里把按钮顺序与位置对齐：inX 位置画 +（btnZoomIn），outX 画 −，resetX 画 ⊙

    this.zoomText.setPosition(PANEL_W / 2, PAD + BTN_SIZE + 2);
    this.refreshZoomText();
  }

  private refreshZoomText(): void {
    const r = this.getRenderer();
    if (!r) return;
    const z = r.getMapZoom();
    const min = Math.abs(z - MAP_ZOOM_MIN) < 1e-3;
    const max = Math.abs(z - MAP_ZOOM_MAX) < 1e-3;
    const tag = min ? '（最远）' : max ? '（最近）' : '';
    this.zoomText.setText(`×${z.toFixed(1)}${tag}`);
  }

  destroy(): void {
    this.zoomTimer?.remove();
    this.zoomTimer = undefined;
    this.store.off(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.btnZoomIn.zone.destroy();
    this.btnZoomIn.label.destroy();
    this.btnZoomIn.bg.destroy();
    this.btnZoomOut.zone.destroy();
    this.btnZoomOut.label.destroy();
    this.btnZoomOut.bg.destroy();
    this.btnReset.zone.destroy();
    this.btnReset.label.destroy();
    this.btnReset.bg.destroy();
    this.zoomText.destroy();
    this.bgGfx.destroy();
    this.container.destroy();
  }
}
