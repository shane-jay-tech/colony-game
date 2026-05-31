import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import { RESOURCE_IDS } from '../data/resourceRegistry';
import type { ResourceId } from '../data/resourceRegistry';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { dayToCalendar } from '../state/calendar';

const SEASON_CN: readonly string[] = ['春', '夏', '秋', '冬'];

/**
 * HUD：顶栏。资源 + 日历 + 时间控制按钮。
 *
 * Slice E 设计：
 *   - 一个 Container 占据顶部 UI.topbarHeight (48px)
 *   - 8 个资源 token：[图标(色块) + 数字]
 *   - 中央显示当前日期（年/季/日）
 *   - 右侧 4 个按钮：⏸ ▶ ▶▶ ▶▶▶（暂停 / 1x / 2x / 3x）
 *   - 全部用 Phaser-native（Graphics + Text），不引 DOM
 *
 * 事件订阅 + 清理：HUD.destroy() 由 UIScene.shutdown 调用，会 off 所有事件 + 销毁子对象。
 */

const RESOURCE_LABEL: Record<ResourceId, string> = {
  grain: '粮',
  wood: '木',
  stone: '石',
  gold: '钱',
  people: '民',
  cloth: '布',
  bronze: '铜',
  rite: '礼',
};

const RESOURCE_COLOR: Record<ResourceId, number> = {
  grain: COLORS.GOLD,
  wood: COLORS.WOOD_LIGHT,
  stone: COLORS.ASH,
  gold: COLORS.GOLD,
  people: COLORS.PAPER_DIM,
  cloth: COLORS.CINNABAR,
  bronze: COLORS.GOLD_DIM,
  rite: COLORS.STONE_GREEN,
};

interface SpeedButton {
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  speed: 0 | 1 | 2 | 3;
}

interface ResourceToken {
  swatch: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  txt: Phaser.GameObjects.Text;
}

export class HUD {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private container: Phaser.GameObjects.Container;
  private resourceTokens: Map<ResourceId, ResourceToken> = new Map();
  private dateText: Phaser.GameObjects.Text;
  private speedButtons: SpeedButton[] = [];
  private bgGfx: Phaser.GameObjects.Graphics;
  // Phase1：国格徽章（印章风金框小匾，置于日期右侧）。
  // Phase4 可在此换万相原画：BootScene 试加载 grade_emblem_<level> 纹理，有图则贴图、无图回退本印章绘制。
  private gradeBadgeBg: Phaser.GameObjects.Graphics | null = null;
  private gradeBadgeText: Phaser.GameObjects.Text | null = null;
  private gradeBadgeX = 0;
  private gradeBadgeTween: Phaser.Tweens.Tween | null = null;
  // Slice I 动画顺滑化：资源数字差值 tween（300ms 缓动到目标值）
  private prevResourceValues: Map<ResourceId, number> = new Map();
  private resourceTweens: Map<ResourceId, Phaser.Tweens.Tween> = new Map();
  private snapNextResourceUpdate = false; // STATE_REPLACED 时跳过 tween（读档不该看到数字飞）
  // 日期文字软淡入：每次文本变化淡入一下，给"日推进"一点呼吸感
  private dateFadeTween: Phaser.Tweens.Tween | null = null;
  // Slice G 教程：右上角的 "?" 按钮，重开欢迎引导
  private helpBg: Phaser.GameObjects.Graphics | null = null;
  private helpLabel: Phaser.GameObjects.Text | null = null;
  private helpZone: Phaser.GameObjects.Zone | null = null;
  // v1.0 #6：邦交按钮，开关 DiplomacyPanel（位于 ? 按钮左侧）
  private diplomacyBg: Phaser.GameObjects.Graphics | null = null;
  private diplomacyLabel: Phaser.GameObjects.Text | null = null;
  private diplomacyZone: Phaser.GameObjects.Zone | null = null;

  // 监听器引用（destroy 解绑）
  private onResources = (): void => this.refreshResources();
  private onDayTick = (): void => this.refreshDate();
  private onSeasonTick = (): void => this.refreshDate();
  private onYearTick = (): void => this.refreshDate();
  private onPaused = (): void => this.refreshSpeed();
  private onSpeed = (): void => this.refreshSpeed();
  private onGradeChanged = (): void => this.refreshGrade(true);
  private onReplaced = (): void => {
    // 读档/重置：数字直接 snap，不要让玩家看到从 0 缓动到几百
    this.snapNextResourceUpdate = true;
    this.refreshResources();
    this.refreshDate();
    this.refreshSpeed();
    this.refreshGrade(false);
  };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0).setDepth(1000);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.dateText = scene.add.text(0, 0, '', { ...FONTS.body, color: '#F5ECD7' } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.dateText);

    // 国格徽章：印章风金框小匾（bg + 篆意级名）
    this.gradeBadgeBg = scene.add.graphics();
    this.container.add(this.gradeBadgeBg);
    this.gradeBadgeText = scene.add.text(0, 0, '', {
      ...FONTS.glyph,
      color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.container.add(this.gradeBadgeText);

    this.layout();
    this.refreshResources();
    this.refreshDate();
    this.refreshSpeed();
    this.refreshGrade(false);

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.SEASON_TICK, this.onSeasonTick);
    store.on(STATE_EVENTS.YEAR_TICK, this.onYearTick);
    store.on(STATE_EVENTS.PAUSED_CHANGED, this.onPaused);
    store.on(STATE_EVENTS.SPEED_CHANGED, this.onSpeed);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
  }

  /** 重排子元素（resize 时调用）。 */
  layout(): void {
    const w = this.scene.scale.width;
    const h = UI.topbarHeight;

    this.bgGfx.clear();
    this.bgGfx.fillStyle(COLORS.BG_INK, 0.96);
    this.bgGfx.fillRect(0, 0, w, h);
    this.bgGfx.lineStyle(1, COLORS.GOLD_DIM, 0.6);
    this.bgGfx.lineBetween(0, h - 0.5, w, h - 0.5);
    this.bgGfx.lineStyle(1, COLORS.GOLD_DIM, 0.8);
    this.bgGfx.lineBetween(0, h, w, h);

    // 资源区域：左侧起，每个资源占 ~84px（J-1 修缺陷 #4：tokenW 92→84
    // 给中央日期腾出空间，1280px 最小宽度下不再和资源 token 重叠）
    const tokenW = 84;
    const padX = 12;
    let cursorX = padX;
    const tokenY = Math.floor(h / 2);

    // 重建 / 更新每个资源 token（Slice E High #1：layout 必须重定位 swatch/label/txt 三件套，
    // 否则窗口缩放后色块和资源名会卡在初始坐标，只有数字跟着走）
    for (const id of RESOURCE_IDS) {
      let token = this.resourceTokens.get(id);
      if (!token) {
        const swatch = this.scene.add.graphics();
        swatch.fillStyle(RESOURCE_COLOR[id], 1);
        swatch.fillRect(0, -7, 14, 14);
        swatch.lineStyle(1, COLORS.INK, 0.8);
        swatch.strokeRect(0, -7, 14, 14);
        this.container.add(swatch);

        // Slice H：资源字形改墨笔金字（serif + bold + GOLD），小字号比 swatch 略高一点
        const label = this.scene.add.text(0, 0, RESOURCE_LABEL[id], {
          ...FONTS.glyph,
        } as Phaser.Types.GameObjects.Text.TextStyle);
        this.container.add(label);

        const txt = this.scene.add.text(0, 0, '0', {
          ...FONTS.number,
          color: '#F5ECD7',
        } as Phaser.Types.GameObjects.Text.TextStyle);
        this.container.add(txt);

        token = { swatch, label, txt };
        this.resourceTokens.set(id, token);
      }
      token.swatch.setPosition(cursorX, tokenY);
      token.label.setPosition(cursorX + 18, tokenY - 9);
      token.txt.setPosition(cursorX + 36, tokenY - 9);
      cursorX += tokenW;
    }

    // 日期文字：放在资源区右侧，紧跟 cursorX（J-1 修缺陷 #4：v0.7 用 w/2-80
    // 固定位置，资源 token 多时会和日期重叠；现在动态贴在最后一个 token 后面）
    const dateGapX = 18;
    this.dateText.setPosition(cursorX + dateGapX, tokenY - 9);

    // 国格徽章：日期块右侧固定偏移处（为日期文本预留 ~175px，避免随日期长度抖动）
    this.gradeBadgeX = cursorX + dateGapX + 175;
    this.layoutGradeBadge(tokenY);

    // 速度按钮（右侧）
    const btnSize = 32;
    const btnGap = 6;
    const btnY = Math.floor((h - btnSize) / 2);
    const labels: { speed: 0 | 1 | 2 | 3; text: string }[] = [
      { speed: 0, text: '||' },
      { speed: 1, text: '>' },
      { speed: 2, text: '>>' },
      { speed: 3, text: '>>>' },
    ];
    // 先给"?"按钮留位（speed 按钮往左挪一格）
    const helpBtnW = 28;
    const helpBtnX = w - padX - labels.length * (btnSize + btnGap) + btnGap - helpBtnW - btnGap * 2;
    if (!this.helpZone) {
      this.helpBg = this.scene.add.graphics();
      this.helpLabel = this.scene.add.text(0, 0, '?', {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      this.helpZone = this.scene.add.zone(0, 0, helpBtnW, btnSize).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      this.helpZone.on('pointerdown', () => this.store.setTutorialStepId('tut_welcome'));
      this.container.add([this.helpBg, this.helpLabel, this.helpZone]);
    }
    if (this.helpZone && this.helpBg && this.helpLabel) {
      this.helpZone.setPosition(helpBtnX, btnY).setSize(helpBtnW, btnSize);
      this.helpBg.clear();
      this.helpBg.fillStyle(COLORS.WOOD, 0.7);
      this.helpBg.fillRect(helpBtnX, btnY, helpBtnW, btnSize);
      this.helpBg.lineStyle(1, COLORS.GOLD_DIM, 1);
      this.helpBg.strokeRect(helpBtnX, btnY, helpBtnW, btnSize);
      this.helpLabel.setPosition(helpBtnX + helpBtnW / 2, btnY + btnSize / 2);
    }

    // v1.0 #6：邦交按钮（位于 ? 按钮左侧，56px 容下「邦交」二字）
    const diplomacyBtnW = 56;
    const diplomacyBtnX = helpBtnX - btnGap - diplomacyBtnW;
    if (!this.diplomacyZone) {
      this.diplomacyBg = this.scene.add.graphics();
      this.diplomacyLabel = this.scene.add.text(0, 0, '邦交', {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      this.diplomacyZone = this.scene.add.zone(0, 0, diplomacyBtnW, btnSize).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      this.diplomacyZone.on('pointerdown', () => {
        const panel = this.scene.registry.get('diplomacyPanel') as { toggle?: () => void } | undefined;
        panel?.toggle?.();
      });
      this.container.add([this.diplomacyBg, this.diplomacyLabel, this.diplomacyZone]);
    }
    if (this.diplomacyZone && this.diplomacyBg && this.diplomacyLabel) {
      this.diplomacyZone.setPosition(diplomacyBtnX, btnY).setSize(diplomacyBtnW, btnSize);
      this.diplomacyBg.clear();
      this.diplomacyBg.fillStyle(COLORS.WOOD, 0.7);
      this.diplomacyBg.fillRect(diplomacyBtnX, btnY, diplomacyBtnW, btnSize);
      this.diplomacyBg.lineStyle(1, COLORS.GOLD_DIM, 1);
      this.diplomacyBg.strokeRect(diplomacyBtnX, btnY, diplomacyBtnW, btnSize);
      this.diplomacyLabel.setPosition(diplomacyBtnX + diplomacyBtnW / 2, btnY + btnSize / 2);
    }

    let btnX = w - padX - labels.length * (btnSize + btnGap) + btnGap;

    if (this.speedButtons.length === 0) {
      for (const cfg of labels) {
        const bg = this.scene.add.graphics();
        const label = this.scene.add.text(0, 0, cfg.text, {
          ...FONTS.body,
          color: '#F5ECD7',
          fontStyle: 'bold',
        } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
        const zone = this.scene.add.zone(0, 0, btnSize, btnSize).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.onSpeedButton(cfg.speed));
        this.container.add([bg, label, zone]);
        this.speedButtons.push({ bg, label, zone, speed: cfg.speed });
      }
    }

    for (const btn of this.speedButtons) {
      btn.zone.setPosition(btnX, btnY).setSize(btnSize, btnSize);
      btn.label.setPosition(btnX + btnSize / 2, btnY + btnSize / 2);
      btnX += btnSize + btnGap;
    }
    this.refreshSpeed();
  }

  private onSpeedButton(speed: 0 | 1 | 2 | 3): void {
    if (speed === 0) {
      this.store.setPaused(!this.store.isPaused());
    } else {
      this.store.setPaused(false);
      this.store.setSpeed(speed);
    }
  }

  private refreshResources(): void {
    const resources = this.store.getResources();
    const snap = this.snapNextResourceUpdate;
    this.snapNextResourceUpdate = false;
    for (const [id, token] of this.resourceTokens) {
      const v = resources[id] ?? 0;
      const prev = this.prevResourceValues.get(id);
      // 首次绘制 / snap / 值未变：直接 setText，不起 tween
      if (prev === undefined || snap || prev === v) {
        const old = this.resourceTweens.get(id);
        if (old) { old.stop(); this.resourceTweens.delete(id); }
        token.txt.setText(String(v));
        this.prevResourceValues.set(id, v);
        continue;
      }
      // 值有变动：起新 counter。若旧 tween 还在飞，先停掉，并用"当前正在显示的数字"
      // 作为新 tween 的起点（不是 prev），否则快速连续变动时会看见数字短暂回弹。
      const old = this.resourceTweens.get(id);
      if (old) { old.stop(); this.resourceTweens.delete(id); }
      const parsed = parseInt(token.txt.text, 10);
      const fromValue = Number.isFinite(parsed) ? parsed : prev;
      const tween = this.scene.tweens.addCounter({
        from: fromValue,
        to: v,
        duration: 300,
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => {
          // Phaser 3.7 类型：getValue() 可能返回 null（tween 已 stop / removed）
          const cur = tw.getValue();
          if (cur !== null) token.txt.setText(String(Math.round(cur)));
        },
        onComplete: () => {
          token.txt.setText(String(v));
          this.resourceTweens.delete(id);
        },
      });
      this.resourceTweens.set(id, tween);
      this.prevResourceValues.set(id, v);
    }
  }

  /** 仅重排徽章位置（layout 调用）；匾宽随级名变化由 paintGradeBadge 处理。 */
  private layoutGradeBadge(centerY: number): void {
    if (this.gradeBadgeText) this.gradeBadgeText.setPosition(this.gradeBadgeX + 10, centerY);
    this.paintGradeBadge();
  }

  /** 画印章风金框小匾（按当前级名宽度自适应）。 */
  private paintGradeBadge(): void {
    if (!this.gradeBadgeBg || !this.gradeBadgeText) return;
    const padX = 10;
    const h = 28;
    const w = Math.ceil(this.gradeBadgeText.width) + padX * 2;
    const x = this.gradeBadgeX;
    const y = Math.floor(UI.topbarHeight / 2) - h / 2;
    const g = this.gradeBadgeBg;
    g.clear();
    g.fillStyle(COLORS.WOOD, 0.82);
    g.fillRect(x, y, w, h);
    g.lineStyle(2, COLORS.GOLD, 1);
    g.strokeRect(x, y, w, h);
    g.lineStyle(1, COLORS.WOOD_LIGHT, 1);
    g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  }

  /** 刷新国格徽章文本；pulse=true 时做一次放大淡入（晋阶/降格的"呼吸"反馈）。 */
  private refreshGrade(pulse: boolean): void {
    if (!this.gradeBadgeText) return;
    const def = this.store.getGradeDef();
    const next = `${def.name}`;
    const changed = this.gradeBadgeText.text !== next;
    this.gradeBadgeText.setText(next);
    this.paintGradeBadge();
    if (pulse && changed) {
      // 纯 alpha 呼吸（不放大文字——放大会让级名溢出金框小匾）
      if (this.gradeBadgeTween) this.gradeBadgeTween.stop();
      this.gradeBadgeText.setAlpha(0.35);
      this.gradeBadgeTween = this.scene.tweens.add({
        targets: this.gradeBadgeText,
        alpha: 1,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.gradeBadgeText?.setAlpha(1);
          this.gradeBadgeTween = null;
        },
      });
    }
  }

  private refreshDate(): void {
    const day = this.store.getCurrentDay();
    const cal = dayToCalendar(day);
    const seasonName = SEASON_CN[cal.season] ?? '?';
    const next = `第 ${cal.year + 1} 年 · ${seasonName} · 第 ${cal.dayOfSeason + 1} 日`;
    if (this.dateText.text === next) return; // 文本没变就别折腾
    this.dateText.setText(next);
    // 软淡入：alpha 0.55→1 200ms。即便快进 3x（3Hz 刷）也只是温柔脉动，不刺眼。
    if (this.dateFadeTween) this.dateFadeTween.stop();
    this.dateText.setAlpha(0.55);
    this.dateFadeTween = this.scene.tweens.add({
      targets: this.dateText,
      alpha: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.dateText.setAlpha(1);
        this.dateFadeTween = null;
      },
    });
  }

  private refreshSpeed(): void {
    const paused = this.store.isPaused();
    const speed = this.store.getSpeed();
    for (const btn of this.speedButtons) {
      const active =
        (btn.speed === 0 && paused) ||
        (btn.speed !== 0 && !paused && btn.speed === speed);
      btn.bg.clear();
      btn.bg.fillStyle(active ? COLORS.GOLD : COLORS.WOOD, active ? 0.9 : 0.7);
      btn.bg.fillRect(btn.zone.x, btn.zone.y, btn.zone.width, btn.zone.height);
      btn.bg.lineStyle(1, COLORS.GOLD_DIM, 1);
      btn.bg.strokeRect(btn.zone.x, btn.zone.y, btn.zone.width, btn.zone.height);
      btn.label.setColor(active ? '#1A1410' : '#F5ECD7');
    }
  }

  destroy(): void {
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.SEASON_TICK, this.onSeasonTick);
    this.store.off(STATE_EVENTS.YEAR_TICK, this.onYearTick);
    this.store.off(STATE_EVENTS.PAUSED_CHANGED, this.onPaused);
    this.store.off(STATE_EVENTS.SPEED_CHANGED, this.onSpeed);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    // 先停所有进行中的 tween，避免 destroy 后 onUpdate / onComplete 仍触发 NPE
    for (const tw of this.resourceTweens.values()) tw.stop();
    this.resourceTweens.clear();
    if (this.dateFadeTween) { this.dateFadeTween.stop(); this.dateFadeTween = null; }
    if (this.gradeBadgeTween) { this.gradeBadgeTween.stop(); this.gradeBadgeTween = null; }
    this.container.destroy(true);
  }
}
