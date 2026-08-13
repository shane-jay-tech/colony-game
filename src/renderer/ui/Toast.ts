import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import { REGISTRY_KEYS, registryGet } from './registry';

/**
 * Toast：屏幕**正中偏上**的悬浮提示（2026-06-19 从右下角挪来——用户反馈右下角太不显眼）。
 * 用于建造失败、呼吸事件、史官谏言、来犯预警等反馈。字号加大 + 居中 + 淡入，确保看得见。
 *
 * 单条 toast 自动消失，多条不堆叠——后到的覆盖前一条（避免高频 spamming）。
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
    // A-2：error toast 播放警告音效
    if (kind === 'error') {
      const am = registryGet(this.scene.registry, REGISTRY_KEYS.audioManager);
      am?.playUi?.('sfx_warn');
    }
    this.clearCurrent();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    this.bg = this.scene.add.graphics().setScrollFactor(0).setDepth(2400);
    this.text = this.scene.add.text(0, 0, message, {
      ...FONTS.body,
      fontSize: '18px', // 加大，醒目
      fontStyle: 'bold',
      color: '#F5ECD7',
      align: 'center',
      wordWrap: { width: Math.min(560, w - 80) },
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2400);

    const padX = 20;
    const padY = 12;
    const tw = this.text.width + padX * 2;
    const th = this.text.height + padY * 2;
    // 正中偏上：水平居中、竖直在顶栏下方一点（不挡 HUD，也不沉到角落）
    const bx = Math.floor((w - tw) / 2);
    const by = UI.topbarHeight + UI.toolbarHeight + 16; // 主功能工具栏下方

    const fillColor = kind === 'error' ? COLORS.CINNABAR : COLORS.WOOD;
    this.bg.fillStyle(fillColor, 0.95);
    this.bg.fillRect(bx, by, tw, th);
    this.bg.lineStyle(2, COLORS.GOLD, 1);
    this.bg.strokeRect(bx, by, tw, th);
    this.text.setPosition(w / 2, by + padY);

    // 淡入，进一步抓眼球
    this.bg.setAlpha(0); this.text.setAlpha(0);
    this.scene.tweens.add({ targets: [this.bg, this.text], alpha: 1, duration: 160, ease: 'Cubic.easeOut' });

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
