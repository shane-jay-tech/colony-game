import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from '../ui/palette';

/**
 * ModeSelectScene — 进游戏第一屏（Phase 1 模式外壳）。
 *
 * 玩家二择一：
 *   - 沙盒（可玩）：自由经营，从聚落爬到天下共主，无限玩 → 进 IntroScene 立国。
 *   - 故事（敬请期待）：随《天下人书记》七卷的长线叙事，Phase 2 开放 → 当前灰显、不可点。
 *
 * 视觉：纪元风考究排版（BG_INK 底 + 金色双框卡片 + 印章式标题），不是裸色块。
 * 万相主视觉原画留 Phase 4 替换；本场景纯引擎绘制，达"单看一帧不简陋"基线。
 *
 * 约束：Phaser.Scale.RESIZE，所有元素在 layout() 重排；文案半文半白、禁偏字。
 */

export const MODE_REGISTRY_KEY = 'gameMode';
export type GameMode = 'sandbox' | 'story';

interface ModeCard {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  titleText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  tagText: Phaser.GameObjects.Text | null;
  zone: Phaser.GameObjects.Zone | null;
  enabled: boolean;
  hovered: boolean;
}

const CARD_W = 560;
const CARD_H = 124;
const CARD_GAP = 28;

export class ModeSelectScene extends Phaser.Scene {
  private bgGfx!: Phaser.GameObjects.Graphics;
  private frameGfx!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private footerText!: Phaser.GameObjects.Text;
  private sandboxCard!: ModeCard;
  private storyCard!: ModeCard;

  constructor() {
    super({ key: 'ModeSelectScene' });
  }

  create(): void {
    this.bgGfx = this.add.graphics();
    this.frameGfx = this.add.graphics();

    this.titleText = this.add.text(0, 0, '邦国录', {
      ...FONTS.title,
      fontSize: '52px',
      color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    this.subtitleText = this.add.text(0, 0, '春秋立国 · 经营天下', {
      ...FONTS.body,
      fontSize: '15px',
      color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    this.promptText = this.add.text(0, 0, '请 择 一 途', {
      ...FONTS.body,
      fontSize: '16px',
      color: COLORS_HEX.GOLD_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    this.sandboxCard = this.makeCard(
      '沙盒 · 经营天下',
      '白手起家，养一邦国从聚落到天下共主。自由经营，永无尽头。',
      true,
      null,
    );
    this.storyCard = this.makeCard(
      '故事 · 拆龙椅',
      '循《天下人书记》七卷，从春秋一路走到撤去龙椅的长线叙事。',
      false,
      '敬请期待',
    );

    this.footerText = this.add.text(0, 0, '——选沙盒可即刻立国；故事一途，来日开放。', {
      ...FONTS.smallDim,
      fontSize: '13px',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    // 沙盒卡片可点 → 写 mode → 进立国流程
    if (this.sandboxCard.zone) {
      this.sandboxCard.zone
        .on('pointerover', () => { this.sandboxCard.hovered = true; this.paintCard(this.sandboxCard); })
        .on('pointerout', () => { this.sandboxCard.hovered = false; this.paintCard(this.sandboxCard); })
        .on('pointerup', () => this.chooseSandbox());
    }

    this.layout();
    this.scale.on('resize', this.layout, this);
  }

  private makeCard(
    title: string,
    desc: string,
    enabled: boolean,
    tag: string | null,
  ): ModeCard {
    const container = this.add.container(0, 0);
    const bg = this.add.graphics();
    container.add(bg);

    const titleText = this.add.text(0, 0, title, {
      ...FONTS.title,
      fontSize: '26px',
      color: enabled ? COLORS_HEX.GOLD : COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    container.add(titleText);

    const descText = this.add.text(0, 0, desc, {
      ...FONTS.body,
      fontSize: '15px',
      color: enabled ? COLORS_HEX.PAPER : COLORS_HEX.ASH,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    container.add(descText);

    let tagText: Phaser.GameObjects.Text | null = null;
    if (tag) {
      tagText = this.add.text(0, 0, tag, {
        ...FONTS.small,
        fontSize: '13px',
        color: COLORS_HEX.GOLD_DIM,
        fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0);
      container.add(tagText);
    }

    let zone: Phaser.GameObjects.Zone | null = null;
    if (enabled) {
      // 仅可玩卡片绑交互区；灰卡不 setInteractive（防"灰显却可点"）
      zone = this.add.zone(0, 0, CARD_W, CARD_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      container.add(zone);
    }

    return { container, bg, titleText, descText, tagText, zone, enabled, hovered: false };
  }

  private paintCard(card: ModeCard): void {
    const bg = card.bg;
    bg.clear();
    if (card.enabled) {
      // 可玩：木底 + 悬停提亮，金色双框
      bg.fillStyle(COLORS.WOOD, card.hovered ? 0.92 : 0.78);
      bg.fillRect(0, 0, CARD_W, CARD_H);
      bg.lineStyle(2, card.hovered ? COLORS.GOLD : COLORS.GOLD_DIM, 1);
      bg.strokeRect(0, 0, CARD_W, CARD_H);
      bg.lineStyle(1, COLORS.WOOD_LIGHT, 1);
      bg.strokeRect(4, 4, CARD_W - 8, CARD_H - 8);
    } else {
      // 灰显：低饱和木底 + 暗框，传达"未开放"
      bg.fillStyle(COLORS.WOOD, 0.4);
      bg.fillRect(0, 0, CARD_W, CARD_H);
      bg.lineStyle(2, COLORS.GOLD_DIM, 0.5);
      bg.strokeRect(0, 0, CARD_W, CARD_H);
    }
  }

  private chooseSandbox(): void {
    this.registry.set(MODE_REGISTRY_KEY, 'sandbox');
    this.scene.start('IntroScene');
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;

    this.bgGfx.clear();
    this.bgGfx.fillStyle(COLORS.BG_INK, 1);
    this.bgGfx.fillRect(0, 0, W, H);

    // 外框装饰：四周一圈细金边，给"卷轴"质感
    this.frameGfx.clear();
    this.frameGfx.lineStyle(2, COLORS.GOLD_DIM, 0.6);
    this.frameGfx.strokeRect(18, 18, W - 36, H - 36);
    this.frameGfx.lineStyle(1, COLORS.WOOD_LIGHT, 0.5);
    this.frameGfx.strokeRect(24, 24, W - 48, H - 48);

    const cx = Math.floor(W / 2);

    // 标题区
    this.titleText.setPosition(cx, Math.max(48, Math.floor(H * 0.12)));
    this.subtitleText.setPosition(cx, this.titleText.y + 64);
    this.promptText.setPosition(cx, this.subtitleText.y + 40);

    // 两张卡片竖排居中
    const cardX = Math.floor((W - CARD_W) / 2);
    const blockTop = this.promptText.y + 44;
    this.placeCard(this.sandboxCard, cardX, blockTop);
    this.placeCard(this.storyCard, cardX, blockTop + CARD_H + CARD_GAP);

    this.footerText.setPosition(cx, blockTop + (CARD_H + CARD_GAP) * 2 + 8);
  }

  private placeCard(card: ModeCard, x: number, y: number): void {
    card.container.setPosition(x, y);
    this.paintCard(card);
    card.titleText.setPosition(28, 22);
    card.descText.setStyle({ wordWrap: { width: CARD_W - 56, useAdvancedWrap: true } });
    card.descText.setPosition(28, 64);
    if (card.tagText) card.tagText.setPosition(CARD_W - 20, 22);
    if (card.zone) card.zone.setPosition(0, 0);
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this);
  }
}
