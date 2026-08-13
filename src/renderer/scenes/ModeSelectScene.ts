import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from '../ui/palette';
import { REGISTRY_KEYS, registrySet } from '../ui/registry';

/**
 * ModeSelectScene — 进游戏第一屏（Phase 1 模式外壳）。
 *
 * 玩家二择一：
 *   - 沙盒：自由经营，从聚落爬到天下共主，无限玩 → 进 IntroScene 立国。
 *   - 故事：随《天下人书记》七卷的长线叙事（序章统一→七章→三结局，2026-06 已可玩）
 *     → 进 IntroScene 立国后入序章。
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
const CARD_H = 148;
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
  private layoutTimer: number | null = null;

  constructor() {
    super({ key: 'ModeSelectScene' });
  }

  /**
   * 关键修复（2026-06-02）：resize 事件里**同步**调 layout()→setStyle()→Text.updateText 会在
   * 画布缩放中途崩（Cannot read properties of null reading 'drawImage'）。改为**防抖延后**到 resize
   * 事件之后再排版（GameScene/UIScene 早已这么做、从不崩）。这是 maximize↔窗口切换崩溃的真因。
   */
  private scheduleLayout = (): void => {
    if (this.layoutTimer !== null) window.clearTimeout(this.layoutTimer);
    this.layoutTimer = window.setTimeout(() => { this.layoutTimer = null; this.layout(); }, 80);
  };

  create(): void {
    // 关键修复(2026-06-02)：Phaser 不自动调用 scene.shutdown() 方法（只自动调 init/preload/create）。
    // 必须手动把 shutdown 绑到 SHUTDOWN 事件，否则场景切走后 scale 'resize' 监听**永不移除**，
    // 残留监听在新场景里对**已销毁的文字**跑 layout→Text.updateText→null drawImage 崩溃（resize 崩的真因）。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
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
      '白手起家，养一邦国从聚落到天下共主。自由经营，永无尽头。\n'
      + '玩法：建造产粮、采集资源、招兵扩军、外交结盟，一步步爬升国格。无固定剧情，随机事件调味。',
      true,
      null,
    );
    this.storyCard = this.makeCard(
      '故事 · 拆龙椅',
      '循《天下人书记》七卷，从春秋一路走到撤去龙椅的长线叙事。\n'
      + '玩法：经营同沙盒，另有剧情事件、推荐目标、三条结局路线。你的每个决策影响最终走向。',
      true,
      '序章可玩',
    );

    this.footerText = this.add.text(0, 0, '——沙盒无拘无束；故事有七卷长剧，两个都好，慢慢挑。', {
      ...FONTS.smallDim,
      fontSize: '14px', // P2-4 字号铁律 ≥14px
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    // 沙盒卡片可点 → 写 mode → 进立国流程
    if (this.sandboxCard.zone) {
      this.sandboxCard.zone
        .on('pointerover', () => { this.sandboxCard.hovered = true; this.paintCard(this.sandboxCard); })
        .on('pointerout', () => { this.sandboxCard.hovered = false; this.paintCard(this.sandboxCard); })
        .on('pointerup', () => this.chooseSandbox());
    }
    // 故事卡片可点 → 写 mode='story' → 进立国流程（序章）
    if (this.storyCard.zone) {
      this.storyCard.zone
        .on('pointerover', () => { this.storyCard.hovered = true; this.paintCard(this.storyCard); })
        .on('pointerout', () => { this.storyCard.hovered = false; this.paintCard(this.storyCard); })
        .on('pointerup', () => this.chooseStory());
    }

    this.layout();
    this.scale.on('resize', this.scheduleLayout);
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
        fontSize: '14px', // P2-4 字号铁律 ≥14px
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
    registrySet(this.registry, REGISTRY_KEYS.gameMode, 'sandbox');
    this.scene.start('IntroScene');
  }

  private chooseStory(): void {
    registrySet(this.registry, REGISTRY_KEYS.gameMode, 'story');
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
    this.scale.off('resize', this.scheduleLayout);
    if (this.layoutTimer !== null) { window.clearTimeout(this.layoutTimer); this.layoutTimer = null; }
  }
}
