import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';

/**
 * Toast：右下角悬浮提示。Slice E 用于"建造失败：粮不足"等反馈。
 *
 * 单条 toast 自动消失（fade in/out），多条堆叠不需要——同时只显示一条，
 * 后到的覆盖前一条（避免高频点击 spamming UI）。
 */
export class Toast {
  private scene: Phaser.Scene;
  private text: Phaser.GameObjects.Text | null = null;
  private bg: Phaser.GameObjects.Graphics | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(message: string, kind: 'info' | 'error' = 'info', durationMs = 2200): void {
    this.clearCurrent();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2000);
    this.text = this.scene.add.text(0, 0, message, {
      ...FONTS.body,
      color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle).setScrollFactor(0).setDepth(2000);

    const padX = 12;
    const padY = 8;
    const tw = this.text.width + padX * 2;
    const th = this.text.height + padY * 2;
    const bx = w - tw - 24;
    const by = h - th - 24;

    const fillColor = kind === 'error' ? COLORS.CINNABAR : COLORS.WOOD;
    this.bg.fillStyle(fillColor, 0.92);
    this.bg.fillRect(bx, by, tw, th);
    this.bg.lineStyle(1, COLORS.GOLD, 1);
    this.bg.strokeRect(bx, by, tw, th);
    this.text.setPosition(bx + padX, by + padY);

    this.hideTimer = this.scene.time.delayedCall(durationMs, () => this.clearCurrent());
  }

  private clearCurrent(): void {
    if (this.hideTimer) {
      this.hideTimer.remove(false);
      this.hideTimer = null;
    }
    this.text?.destroy();
    this.bg?.destroy();
    this.text = null;
    this.bg = null;
  }

  destroy(): void {
    this.clearCurrent();
  }
}
