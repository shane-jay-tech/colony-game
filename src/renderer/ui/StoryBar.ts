import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { powerBand, resourceBand } from '../state/storyDriver';
import { chapterAt } from '../data/storyChapters';

/**
 * StoryBar（Phase2 故事模式顶栏差异化）—— 仅故事模式显示，置于主顶栏（48px）正下方。
 *
 * 展示：当前章节名 + 权力轴/生产资料轴的「半可视化倾向」（铁律：不显原始数值，只显倾向位置 + 档位词）
 * + 距下章天数。沙盒模式整条隐藏（getMode()!=='story'）。
 *
 * 双轴呈现 = 一条刻度槽 + 一个游标（marker 位置由轴值映射），左右端标档位词——
 * 玩家"感觉得到趋势但摸不到后台数值"（设计稿 S.4 半可视化）。
 */

const BAR_H = 34;
const TRACK_W = 120;
const TRACK_H = 6;

export class StoryBar {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly chapterText: Phaser.GameObjects.Text;
  private readonly powerLabel: Phaser.GameObjects.Text;
  private readonly powerTrack: Phaser.GameObjects.Graphics;
  private readonly resourceLabel: Phaser.GameObjects.Text;
  private readonly resourceTrack: Phaser.GameObjects.Graphics;
  private readonly distText: Phaser.GameObjects.Text;
  // 槽 x 坐标（layout 用固定偏移算好，refresh 直接用——不依赖 label.width，避免首帧文字未设宽度=0 错位）
  private powerTrackX = 0;
  private resourceTrackX = 0;
  private destroyed = false;

  private onRefresh = (): void => this.refresh();

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(999).setVisible(false);

    this.bg = scene.add.graphics();
    this.chapterText = scene.add.text(0, 0, '', {
      ...FONTS.glyph, fontSize: '16px', color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.powerLabel = scene.add.text(0, 0, '', {
      ...FONTS.small, fontSize: '12px', color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.powerTrack = scene.add.graphics();
    this.resourceLabel = scene.add.text(0, 0, '', {
      ...FONTS.small, fontSize: '12px', color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.resourceTrack = scene.add.graphics();
    this.distText = scene.add.text(0, 0, '', {
      ...FONTS.small, fontSize: '12px', color: COLORS_HEX.ASH,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0.5);

    this.container.add([
      this.bg, this.chapterText, this.powerLabel, this.powerTrack,
      this.resourceLabel, this.resourceTrack, this.distText,
    ]);

    this.layout();
    this.refresh();

    store.on(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onRefresh);
    store.on(STATE_EVENTS.STORY_NARRATION, this.onRefresh);
    store.on(STATE_EVENTS.STORY_UNIFIED, this.onRefresh);
    store.on(STATE_EVENTS.DAY_TICK, this.onRefresh);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onRefresh);
  }

  layout(): void {
    if (this.destroyed) return;
    const w = this.scene.scale.width;
    const y = UI.topbarHeight; // 紧贴主顶栏下方
    this.container.setPosition(0, 0);

    this.bg.clear();
    this.bg.fillStyle(COLORS.BG_INK, 0.92);
    this.bg.fillRect(0, y, w, BAR_H);
    this.bg.lineStyle(1, COLORS.GOLD_DIM, 0.5);
    this.bg.lineBetween(0, y + BAR_H, w, y + BAR_H);

    const cy = y + Math.floor(BAR_H / 2);
    // 固定偏移布局（不读 label.width，避免首帧宽度 0 错位）：
    // 章节名(14, 预留 150) | 权 label(164, 预留 48) | 权槽 | 资 label | 资槽 | 距下章(右对齐)
    const LABEL_W = 52;
    this.chapterText.setPosition(14, cy);
    const px = 172;
    this.powerLabel.setPosition(px, cy);
    this.powerTrackX = px + LABEL_W;
    const rx = this.powerTrackX + TRACK_W + 24;
    this.resourceLabel.setPosition(rx, cy);
    this.resourceTrackX = rx + LABEL_W;
    this.distText.setPosition(w - 14, cy);
    this.refresh();
  }

  /** 画一条倾向游标槽：轴值 -100..100 映射到槽内 marker x。 */
  private paintTrack(g: Phaser.GameObjects.Graphics, trackX: number, cy: number, axisValue: number): void {
    g.clear();
    if (trackX <= 0) return;
    const top = cy - TRACK_H / 2;
    g.fillStyle(COLORS.WOOD, 0.9);
    g.fillRect(trackX, top, TRACK_W, TRACK_H);
    g.lineStyle(1, COLORS.GOLD_DIM, 0.8);
    g.strokeRect(trackX, top, TRACK_W, TRACK_H);
    // 中线
    g.lineStyle(1, COLORS.ASH, 0.6);
    g.lineBetween(trackX + TRACK_W / 2, top - 2, trackX + TRACK_W / 2, top + TRACK_H + 2);
    // 游标
    const t = (Math.max(-100, Math.min(100, axisValue)) + 100) / 200;
    const mx = trackX + t * TRACK_W;
    g.fillStyle(COLORS.GOLD, 1);
    g.fillRect(mx - 2, top - 3, 4, TRACK_H + 6);
  }

  private refresh(): void {
    if (this.destroyed) return;
    const sf = this.store.getMode() === 'story' ? this.store.getStoryFlags() : null;
    if (!sf) { this.container.setVisible(false); return; }
    this.container.setVisible(true);

    const def = chapterAt(sf.chapter);
    this.chapterText.setText(def.title);

    // 半可视化：只显档位词 + 游标，不显原始数值
    const pBand = powerBand(sf.powerAxis);
    this.powerLabel.setText(`权 ${pBand === 'centralize' ? '集权' : pBand === 'devolve' ? '还权' : '——'}`);
    const rBand = resourceBand(sf.resourceAxis);
    this.resourceLabel.setText(`资 ${rBand === 'private' ? '私有' : rBand === 'public' ? '公有' : '——'}`);

    const cy = UI.topbarHeight + Math.floor(BAR_H / 2);
    this.paintTrack(this.powerTrack, this.powerTrackX, cy, sf.powerAxis);
    this.paintTrack(this.resourceTrack, this.resourceTrackX, cy, sf.resourceAxis);

    // 距下章
    if (sf.ending !== null) {
      this.distText.setText('终局已定');
    } else if (sf.chapter === 0) {
      this.distText.setText('序章 · 统一天下');
    } else {
      const dwell = def.advanceAfterDays ?? 0;
      const left = Math.max(0, dwell - (this.store.getCurrentDay() - sf.chapterStartDay));
      this.distText.setText(`距下章 ${left} 日`);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onRefresh);
    this.store.off(STATE_EVENTS.STORY_NARRATION, this.onRefresh);
    this.store.off(STATE_EVENTS.STORY_UNIFIED, this.onRefresh);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onRefresh);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onRefresh);
    this.container.destroy(true);
  }
}
