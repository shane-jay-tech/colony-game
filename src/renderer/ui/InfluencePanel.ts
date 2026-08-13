import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import { REGISTRY_KEYS, registryGet } from './registry';
import type { GameStore } from '../state/gameStore';

/**
 * InfluencePanel（史官）：B2 影响力消费入口。
 * 名望（influence）由国格每日产出、有上限；三用：宣扬德政（压怨愤）/ 遣使斡旋（降警惕）/ 修史立传（升信誉）。
 * 纯 Phaser Graphics+Text，无 DOM；由 HUD 工具栏「史官」按钮开关。
 */
export class InfluencePanel {
  static readonly PANEL_W = 430;
  static readonly PANEL_H = 300;

  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly infoText: Phaser.GameObjects.Text;
  private visible = false;

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setDepth(2000).setVisible(false).setScrollFactor(0);

    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.4);
    this.backdrop.fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.backdrop.setDepth(1999).setVisible(false).setScrollFactor(0);
    this.backdrop.setInteractive({ contains: (): boolean => true } as never, (): boolean => true);
    this.backdrop.on('pointerdown', () => this.hide());

    const panelBg = scene.add.graphics();
    panelBg.fillStyle(COLORS.WOOD, 0.97);
    panelBg.fillRect(0, 0, InfluencePanel.PANEL_W, InfluencePanel.PANEL_H);
    panelBg.lineStyle(2, COLORS.GOLD, 1);
    panelBg.strokeRect(0, 0, InfluencePanel.PANEL_W, InfluencePanel.PANEL_H);
    panelBg.lineStyle(1, COLORS.GOLD_DIM, 0.6);
    panelBg.strokeRect(4, 4, InfluencePanel.PANEL_W - 8, InfluencePanel.PANEL_H - 8);
    panelBg.setInteractive({ contains: (): boolean => true } as never, (): boolean => true);
    this.container.add(panelBg);

    const title = scene.add.text(InfluencePanel.PANEL_W / 2, 22, '史官 · 名望', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
    this.container.add(title);

    this.infoText = scene.add.text(24, 64, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.container.add(this.infoText);

    const rows: { label: string; meta: string; action: () => { ok: boolean; reason?: string; diminished?: boolean } }[] = [
      {
        label: '宣扬德政（名望 20）',
        meta: '民怨 −12 · 民心 +6（7 日内重复减半）',
        action: () => this.store.spendPropaganda(),
      },
      {
        label: '遣使斡旋（名望 15）',
        meta: '列国警惕 −8',
        action: () => this.store.spendDiplomacyInfluence(),
      },
      {
        label: '修史立传（名望 25）',
        meta: '30 日信誉 +8',
        action: () => this.store.spendChronicle(),
      },
    ];

    rows.forEach((row, i) => {
      const y = 104 + i * 58;
      const label = scene.add.text(24, y, row.label, {
        ...FONTS.body, color: '#F5ECD7',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
      const meta = scene.add.text(24, y + 24, row.meta, {
        ...FONTS.small, color: '#C9A84C',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
      const btn = scene.add.text(InfluencePanel.PANEL_W - 118, y, '行', {
        ...FONTS.small, color: '#F5ECD7', backgroundColor: '#5D4037', padding: { x: 10, y: 6 },
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        const r = row.action();
        if (!r.ok) {
          this.toast()?.show(r.reason ?? '名望不足', 'error', 2600);
        } else {
          const extra = r.diminished ? '（粉饰不能持久，效果减半）' : '';
          this.toast()?.show(`${row.label.split('（')[0]} · 已施行${extra}`, 'info', 3000);
        }
        this.refresh();
      });
      this.container.add([label, meta, btn]);
    });

    const closeBtn = scene.add.text(InfluencePanel.PANEL_W - 30, 10, 'X', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    this.layout();
  }

  toggle(): void {
    if (this.visible) this.hide();
    else this.show();
  }

  show(): void {
    this.visible = true;
    this.refresh();
    this.container.setVisible(true);
    this.backdrop.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
    this.backdrop.setVisible(false);
  }

  isVisible(): boolean { return this.visible; }

  layout(): void {
    const px = Math.floor((this.scene.scale.width - InfluencePanel.PANEL_W) / 2);
    const py = Math.floor((this.scene.scale.height - InfluencePanel.PANEL_H) / 2);
    this.container.setPosition(px, py);
    this.backdrop.clear();
    this.backdrop.fillStyle(0x000000, 0.4);
    this.backdrop.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
  }

  private refresh(): void {
    const inf = this.store.getInfluence();
    const cap = this.store.getInfluenceCap();
    const gain = this.store.getState().grade + 1;
    this.infoText.setText(`名望：${inf} / ${cap}　每日 +${gain}（国格越高产出越多，满则不再累积）`);
  }

  private toast(): { show: (m: string, kind?: 'info' | 'error', durationMs?: number) => void } | null {
    return registryGet(this.scene.registry, REGISTRY_KEYS.toast) as { show: (m: string, kind?: 'info' | 'error', durationMs?: number) => void } | undefined ?? null;
  }

  destroy(): void {
    this.container.destroy(true);
    this.backdrop.destroy(true);
  }
}
