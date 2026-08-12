import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import { getAudioSettings, setBgmVolume, setSfxVolume, toggleMuted } from './settingsStore';

/**
 * SettingsPanel：音量设置浮层。
 * 点击 HUD 的设置按钮弹出，再点关闭或面板外区域消失。
 * 纯 Phaser Graphics+Text，无 DOM。
 */
export class SettingsPanel {
  private readonly scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Graphics;
  private visible = false;

  private bgmBar: Phaser.GameObjects.Graphics;
  private sfxBar: Phaser.GameObjects.Graphics;
  private bgmZone: Phaser.GameObjects.Zone;
  private sfxZone: Phaser.GameObjects.Zone;
  private bgmLabel: Phaser.GameObjects.Text;
  private sfxLabel: Phaser.GameObjects.Text;
  private bgmValue: Phaser.GameObjects.Text;
  private sfxValue: Phaser.GameObjects.Text;
  private muteBtn: Phaser.GameObjects.Text;
  private closeBtn: Phaser.GameObjects.Text;

  private static readonly PANEL_W = 280;
  private static readonly PANEL_H = 200;
  private static readonly BAR_W = 180;
  private static readonly BAR_H = 16;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(2000).setVisible(false).setScrollFactor(0);

    // Semi-transparent backdrop (click to close)
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.4);
    this.backdrop.fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.backdrop.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height),
      Phaser.Geom.Rectangle.Contains,
    );
    this.backdrop.on('pointerdown', () => this.hide());
    this.container.add(this.backdrop);

    // Panel background
    const px = Math.floor((scene.scale.width - SettingsPanel.PANEL_W) / 2);
    const py = Math.floor((scene.scale.height - SettingsPanel.PANEL_H) / 2);
    const panelBg = scene.add.graphics();
    panelBg.fillStyle(COLORS.WOOD, 0.96);
    panelBg.fillRect(px, py, SettingsPanel.PANEL_W, SettingsPanel.PANEL_H);
    panelBg.lineStyle(2, COLORS.GOLD, 1);
    panelBg.strokeRect(px, py, SettingsPanel.PANEL_W, SettingsPanel.PANEL_H);
    panelBg.lineStyle(1, COLORS.GOLD_DIM, 0.6);
    panelBg.strokeRect(px + 4, py + 4, SettingsPanel.PANEL_W - 8, SettingsPanel.PANEL_H - 8);
    // Block clicks from passing through panel to backdrop
    panelBg.setInteractive(
      new Phaser.Geom.Rectangle(px, py, SettingsPanel.PANEL_W, SettingsPanel.PANEL_H),
      Phaser.Geom.Rectangle.Contains,
    );
    this.container.add(panelBg);

    const leftX = px + 16;
    const barX = px + 84;

    // Title
    const title = scene.add.text(px + SettingsPanel.PANEL_W / 2, py + 20, '音量设置', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
    this.container.add(title);

    // BGM row
    const rowY1 = py + 60;
    this.bgmLabel = scene.add.text(leftX, rowY1, '音乐', {
      ...FONTS.body, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.bgmBar = scene.add.graphics();
    this.bgmZone = scene.add.zone(barX, rowY1 - SettingsPanel.BAR_H / 2, SettingsPanel.BAR_W, SettingsPanel.BAR_H)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.bgmZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const pct = Math.max(0, Math.min(1, (p.x - barX) / SettingsPanel.BAR_W));
      setBgmVolume(Math.round(pct * 100));
      this.refresh();
    });
    this.bgmValue = scene.add.text(barX + SettingsPanel.BAR_W + 8, rowY1, '', {
      ...FONTS.small, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.container.add([this.bgmLabel, this.bgmBar, this.bgmZone, this.bgmValue]);

    // SFX row
    const rowY2 = py + 100;
    this.sfxLabel = scene.add.text(leftX, rowY2, '音效', {
      ...FONTS.body, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.sfxBar = scene.add.graphics();
    this.sfxZone = scene.add.zone(barX, rowY2 - SettingsPanel.BAR_H / 2, SettingsPanel.BAR_W, SettingsPanel.BAR_H)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.sfxZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const pct = Math.max(0, Math.min(1, (p.x - barX) / SettingsPanel.BAR_W));
      setSfxVolume(Math.round(pct * 100));
      this.refresh();
    });
    this.sfxValue = scene.add.text(barX + SettingsPanel.BAR_W + 8, rowY2, '', {
      ...FONTS.small, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.container.add([this.sfxLabel, this.sfxBar, this.sfxZone, this.sfxValue]);

    // Mute button
    this.muteBtn = scene.add.text(px + SettingsPanel.PANEL_W / 2 - 40, py + 145, '', {
      ...FONTS.body, color: '#F5ECD7', backgroundColor: '#5D4037', padding: { x: 10, y: 4 },
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on('pointerdown', () => { toggleMuted(); this.refresh(); });
    this.container.add(this.muteBtn);

    // Close button
    this.closeBtn = scene.add.text(px + SettingsPanel.PANEL_W - 30, py + 8, 'X', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.closeBtn.on('pointerdown', () => this.hide());
    this.container.add(this.closeBtn);
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  show(): void {
    this.visible = true;
    this.refresh();
    this.container.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  isVisible(): boolean { return this.visible; }

  private refresh(): void {
    const s = getAudioSettings();
    const barX = this.bgmZone.x;
    const rowY1 = this.bgmZone.y + SettingsPanel.BAR_H / 2;
    const rowY2 = this.sfxZone.y + SettingsPanel.BAR_H / 2;

    // BGM bar
    this.bgmBar.clear();
    this.bgmBar.fillStyle(COLORS.ASH, 0.6);
    this.bgmBar.fillRect(barX, rowY1 - SettingsPanel.BAR_H / 2, SettingsPanel.BAR_W, SettingsPanel.BAR_H);
    const bgmFill = (s.bgmVolume / 100) * SettingsPanel.BAR_W;
    this.bgmBar.fillStyle(COLORS.GOLD, 0.9);
    this.bgmBar.fillRect(barX, rowY1 - SettingsPanel.BAR_H / 2, bgmFill, SettingsPanel.BAR_H);
    this.bgmValue.setText(`${s.bgmVolume}`);

    // SFX bar
    this.sfxBar.clear();
    this.sfxBar.fillStyle(COLORS.ASH, 0.6);
    this.sfxBar.fillRect(barX, rowY2 - SettingsPanel.BAR_H / 2, SettingsPanel.BAR_W, SettingsPanel.BAR_H);
    const sfxFill = (s.sfxVolume / 100) * SettingsPanel.BAR_W;
    this.sfxBar.fillStyle(COLORS.GOLD, 0.9);
    this.sfxBar.fillRect(barX, rowY2 - SettingsPanel.BAR_H / 2, sfxFill, SettingsPanel.BAR_H);
    this.sfxValue.setText(`${s.sfxVolume}`);

    // Mute button text
    this.muteBtn.setText(s.muted ? '[ 已静音 ] 点击恢复' : '[ 静音 ]');
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
