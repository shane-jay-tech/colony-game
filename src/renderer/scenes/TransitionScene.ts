import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from '../ui/palette';

/**
 * TransitionScene — 全屏旁白过场（Phase2 跳变）。
 *
 * 用于"序章统一→建朝→千年渐腐"的时代跳变叙事：逐段淡入旁白文字，点击/到时推进，
 * 末段后回调 onDone 并自动 stop 本场景，由调用方 resume 游戏并推进章节。
 *
 * 启动数据（scene.start('TransitionScene', data)）：
 *   { lines: string[]; onDoneEvent?: string }  —— onDoneEvent 通过 registry 回调；
 * 但为简单稳妥，本场景结束直接调 registry 上挂的 'transitionDone' 回调（函数）。
 */

export interface TransitionData {
  lines: string[];
  /** 结束后调用（推进章节 + resume 游戏）。 */
  onDone: () => void;
}

export class TransitionScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private lineText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private lines: string[] = [];
  private idx = 0;
  private onDone: (() => void) | null = null;
  private advancing = false;
  private layoutTimer: number | null = null;

  constructor() {
    super({ key: 'TransitionScene' });
  }

  /** 防抖延后排版：避免 resize 同步 layout→setStyle→Text.updateText 崩溃（见 ModeSelectScene 同注）。 */
  private scheduleLayout = (): void => {
    if (this.layoutTimer !== null) window.clearTimeout(this.layoutTimer);
    this.layoutTimer = window.setTimeout(() => { this.layoutTimer = null; this.layout(); }, 80);
  };

  create(data: TransitionData): void {
    this.lines = data?.lines?.length ? data.lines : ['……'];
    this.onDone = data?.onDone ?? null;
    this.idx = 0;
    this.advancing = false;

    const W = this.scale.width;
    const H = this.scale.height;
    this.bg = this.add.graphics();
    this.bg.fillStyle(COLORS.BG_INK, 1);
    this.bg.fillRect(0, 0, W, H);

    this.lineText = this.add.text(0, 0, '', {
      ...FONTS.body,
      fontSize: '22px',
      color: COLORS_HEX.PAPER,
      align: 'center',
      wordWrap: { width: Math.min(760, W - 120), useAdvancedWrap: true },
      lineSpacing: 10,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);

    this.hintText = this.add.text(0, 0, '— 点击继续 —', {
      ...FONTS.smallDim, fontSize: '13px',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);

    this.layout();
    this.scale.on('resize', this.scheduleLayout);

    // 全屏点击推进
    this.input.on('pointerdown', () => this.next());

    this.showLine();
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bg.clear();
    this.bg.fillStyle(COLORS.BG_INK, 1);
    this.bg.fillRect(0, 0, W, H);
    this.lineText.setPosition(Math.floor(W / 2), Math.floor(H / 2));
    this.lineText.setStyle({ wordWrap: { width: Math.min(760, W - 120), useAdvancedWrap: true } });
    this.hintText.setPosition(Math.floor(W / 2), H - 48);
  }

  private showLine(): void {
    this.lineText.setText(this.lines[this.idx] ?? '');
    this.lineText.setAlpha(0);
    this.tweens.add({ targets: this.lineText, alpha: 1, duration: 600, ease: 'Cubic.easeOut' });
  }

  private next(): void {
    if (this.advancing) return;
    if (this.idx < this.lines.length - 1) {
      this.idx += 1;
      this.showLine();
    } else {
      this.finish();
    }
  }

  private finish(): void {
    if (this.advancing) return;
    this.advancing = true;
    const done = this.onDone;
    this.scale.off('resize', this.scheduleLayout);
    if (this.layoutTimer !== null) { window.clearTimeout(this.layoutTimer); this.layoutTimer = null; }
    this.input.removeAllListeners();
    this.tweens.add({
      targets: [this.lineText, this.hintText], alpha: 0, duration: 400,
      onComplete: () => {
        this.scene.stop();
        if (done) done();
      },
    });
  }

  shutdown(): void {
    this.scale.off('resize', this.scheduleLayout);
    if (this.layoutTimer !== null) { window.clearTimeout(this.layoutTimer); this.layoutTimer = null; }
  }
}
