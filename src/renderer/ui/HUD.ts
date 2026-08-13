import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import { REGISTRY_KEYS, registryGet } from './registry';
import { TOP_BAR_RESOURCE_IDS, INTERMEDIATE_RESOURCE_IDS } from '../data/resourceRegistry';
import type { ResourceId } from '../data/resourceRegistry';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { dayToCalendar } from '../state/calendar';
import { actFor } from '../data/actTimeline';

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
  hemp: '麻',
  tin: '锡',
  influence: '望',
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
  hemp: COLORS.STONE_GREEN,
  tin: COLORS.ASH,
  influence: COLORS.GOLD,
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
  // A-8：资源变化飘字
  private floatTexts: Array<{ t: Phaser.GameObjects.Text; tw: Phaser.Tweens.Tween }> = [];
  // Slice G 教程：右上角的 "?" 按钮，重开欢迎引导
  private helpBg: Phaser.GameObjects.Graphics | null = null;
  private helpLabel: Phaser.GameObjects.Text | null = null;
  private helpZone: Phaser.GameObjects.Zone | null = null;
  // A-1：设置按钮（音量），顶栏右侧工具角
  private settingsBg: Phaser.GameObjects.Graphics | null = null;
  private settingsLabel: Phaser.GameObjects.Text | null = null;
  private settingsZone: Phaser.GameObjects.Zone | null = null;
  private saveBg: Phaser.GameObjects.Graphics | null = null;
  private saveLabel: Phaser.GameObjects.Text | null = null;
  private saveZone: Phaser.GameObjects.Zone | null = null;
  // P2 目标感：终局记分牌入口（顶栏「记」按钮）
  private scoreBg: Phaser.GameObjects.Graphics | null = null;
  private scoreLabel: Phaser.GameObjects.Text | null = null;
  private scoreZone: Phaser.GameObjects.Zone | null = null;
  // 2026-06-19：主功能工具栏（朝堂/邦交/军务/大业）——顶栏下方独立一排大按钮（参考钢铁雄心）。
  private toolbarBg: Phaser.GameObjects.Graphics | null = null;
  private toolbarBtns: { bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  // 2026-06-17：点击"民"token 打开人口详情面板
  private populationZone: Phaser.GameObjects.Zone | null = null;
  private peopleTokenX = 0;
  // A1：双轴民心（心=希望 / 怨=不满），紧贴资源区右侧
  private moraleText: Phaser.GameObjects.Text | null = null;
  private wrathText: Phaser.GameObjects.Text | null = null;
  private sentimentX = 0;
  // B3：工具栏右侧的工坊物资（麻/锡）小字
  private craftText: Phaser.GameObjects.Text | null = null;
  // P2 三幕时间轴：工具栏行中段的当前幕名（随 actChanged 刷新）
  private actText: Phaser.GameObjects.Text | null = null;
  // P1 信息可视化：点击资源 token 打开供需面板；点击国格徽章打开升格目标面板
  private resourceTokenZones: Map<ResourceId, Phaser.GameObjects.Zone> = new Map();
  private gradeBadgeZone: Phaser.GameObjects.Zone | null = null;

  // 监听器引用（destroy 解绑）
  private onResources = (): void => this.refreshResources();
  private onDayTick = (): void => { this.refreshDate(); this.refreshCraftResources(); };
  private onSeasonTick = (): void => this.refreshDate();
  private onYearTick = (): void => this.refreshDate();
  private onPaused = (): void => this.refreshSpeed();
  private onSpeed = (): void => this.refreshSpeed();
  private onGradeChanged = (): void => this.refreshGrade(true);
  private onMoraleChanged = (): void => this.refreshSentiment();
  private onWrathChanged = (): void => this.refreshSentiment();
  private onReplaced = (): void => {
    // 读档/重置：数字直接 snap，不要让玩家看到从 0 缓动到几百
    this.snapNextResourceUpdate = true;
    this.refreshResources();
    this.refreshDate();
    this.refreshSpeed();
    this.refreshGrade(false);
    this.refreshSentiment();
    this.refreshCraftResources();
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

    // A1：双轴民心米（心/怨）
    this.moraleText = scene.add.text(0, 0, '', {
      ...FONTS.glyph, color: '#4A7C59',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.wrathText = scene.add.text(0, 0, '', {
      ...FONTS.glyph, color: '#B71C1C',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.craftText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0.5);
    // P2 三幕时间轴：幕名（工具栏中段）
    this.actText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.container.add([this.moraleText, this.wrathText, this.craftText, this.actText]);

    this.layout();
    this.refreshResources();
    this.refreshDate();
    this.refreshSpeed();
    this.refreshGrade(false);
    this.refreshSentiment();
    this.refreshCraftResources();
    this.refreshAct();

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.ACT_CHANGED, this.onActChanged);
    store.on(STATE_EVENTS.SEASON_TICK, this.onSeasonTick);
    store.on(STATE_EVENTS.YEAR_TICK, this.onYearTick);
    store.on(STATE_EVENTS.PAUSED_CHANGED, this.onPaused);
    store.on(STATE_EVENTS.SPEED_CHANGED, this.onSpeed);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    store.on(STATE_EVENTS.MORALE_CHANGED, this.onMoraleChanged);
    store.on(STATE_EVENTS.WRATH_CHANGED, this.onWrathChanged);
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

    // 资源区域：左侧起，每个资源占 ~104px。早期 84px 太挤（数字贴下一个色块），
    // 且"民"改成 X/Y 后更宽；放宽到 104 让每项有呼吸感。日期块动态贴在 cursorX 之后，
    // 1280px 最小宽度下 8×104 + 日期 + 国格仍排得下。
    const tokenW = 104;
    // 2026-06-19：「民」token 显示"现有/上限 + 趋势箭头"（如 120/120 ▲），三位数时远超普通 token 宽度，
    // 会顶到下一个"布"。给它略宽的槽位 + refreshResources 里把该数字字号调小到 16px，两者配合容下三位数；
    // 不取过大值(150)以免 1280 最小宽度下把日期挤进右侧按钮。
    const peopleTokenW = 120;
    const padX = 12;
    let cursorX = padX;
    const tokenY = Math.floor(h / 2);

    // 重建 / 更新每个资源 token（Slice E High #1：layout 必须重定位 swatch/label/txt 三件套，
    // 否则窗口缩放后色块和资源名会卡在初始坐标，只有数字跟着走）
    for (const id of TOP_BAR_RESOURCE_IDS) {
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
      const tokenX = cursorX;
      token.swatch.setPosition(cursorX, tokenY);
      token.label.setPosition(cursorX + 18, tokenY - 9);
      token.txt.setPosition(cursorX + 36, tokenY - 9);
      const tokenSpan = id === 'people' ? peopleTokenW : tokenW;
      if (id === 'people') { this.peopleTokenX = cursorX; }
      else {
        // P1：非「民」token 均可点 → 打开供需面板（民已有人口面板专属点击区）
        let zone = this.resourceTokenZones.get(id);
        if (!zone) {
          zone = this.scene.add.zone(0, 0, tokenW, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
          zone.on('pointerup', () => {
            registryGet(this.scene.registry, REGISTRY_KEYS.productionPanel)?.toggle?.();
          });
          this.resourceTokenZones.set(id, zone);
          this.container.add(zone);
        }
        zone.setPosition(tokenX, tokenY - 16).setSize(tokenW, 28);
      }
      cursorX += tokenSpan;
    }

    // A1：双轴民心（资源区右侧，日期左侧）
    const sentimentGap = 16;
    this.sentimentX = cursorX + sentimentGap;
    this.moraleText?.setPosition(this.sentimentX, tokenY - 9);
    this.wrathText?.setPosition(this.sentimentX + 92, tokenY - 9);
    cursorX = this.sentimentX + 184;

    // 2026-06-17：覆盖"民"token 的点击区，开关人口详情面板（PopulationPanel）
    if (!this.populationZone) {
      this.populationZone = this.scene.add.zone(0, 0, peopleTokenW, 28).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      // pointerup（非 pointerdown）：否则打开的那一下"松手"会落到刚弹出的面板遮罩上→秒关（"按着才看得见"bug）
      this.populationZone.on('pointerup', () => {
        const panel = registryGet(this.scene.registry, REGISTRY_KEYS.populationPanel);
        panel?.toggle?.();
      });
      this.container.add(this.populationZone);
    }
    this.populationZone.setPosition(this.peopleTokenX, tokenY - 16).setSize(peopleTokenW, 28);

    // 日期文字：放在资源区右侧，紧跟 cursorX（J-1 修缺陷 #4：v0.7 用 w/2-80
    // 固定位置，资源 token 多时会和日期重叠；现在动态贴在最后一个 token 后面）
    const dateGapX = 18;
    this.dateText.setPosition(cursorX + dateGapX, tokenY - 9);

    // 国格徽章：日期块右侧固定偏移处（为日期文本预留 ~175px，避免随日期长度抖动）
    this.gradeBadgeX = cursorX + dateGapX + 175;
    this.layoutGradeBadge(tokenY);

    // P1：国格徽章点击区 → 升格目标面板（徽章宽随级名变化，点击区给固定 112px 安全宽度）
    if (!this.gradeBadgeZone) {
      this.gradeBadgeZone = this.scene.add.zone(0, 0, 112, 30).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      this.gradeBadgeZone.on('pointerup', () => {
        registryGet(this.scene.registry, REGISTRY_KEYS.gradePanel)?.toggle?.();
      });
      this.container.add(this.gradeBadgeZone);
    }
    this.gradeBadgeZone.setPosition(this.gradeBadgeX, Math.floor(UI.topbarHeight / 2) - 15).setSize(112, 30);

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
      // 2026-06-19：「?」改为打开「典册」（新手引导/百科），比重放一次性欢迎引导更有用、可随时查
      this.helpZone.on('pointerup', () => {
        registryGet(this.scene.registry, REGISTRY_KEYS.audioManager)?.playUi?.('sfx_click');
        const codex = registryGet(this.scene.registry, REGISTRY_KEYS.codexPanel);
        codex?.toggle?.();
      });
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

    // A-1：设置按钮（顶栏右侧，? 按钮左侧，28px）。邦交已移到下方主功能工具栏。
    const settingsBtnW = 28;
    const settingsBtnX = helpBtnX - btnGap - settingsBtnW;
    if (!this.settingsZone) {
      this.settingsBg = this.scene.add.graphics();
      this.settingsLabel = this.scene.add.text(0, 0, '设', {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      this.settingsZone = this.scene.add.zone(0, 0, settingsBtnW, btnSize).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      this.settingsZone.on('pointerup', () => {
        registryGet(this.scene.registry, REGISTRY_KEYS.saveLoadPanel)?.hide?.();
        const panel = registryGet(this.scene.registry, REGISTRY_KEYS.settingsPanel);
        panel?.toggle?.();
      });
      this.container.add([this.settingsBg, this.settingsLabel, this.settingsZone]);
    }
    if (this.settingsZone && this.settingsBg && this.settingsLabel) {
      this.settingsZone.setPosition(settingsBtnX, btnY).setSize(settingsBtnW, btnSize);
      this.settingsBg.clear();
      this.settingsBg.fillStyle(COLORS.WOOD, 0.7);
      this.settingsBg.fillRect(settingsBtnX, btnY, settingsBtnW, btnSize);
      this.settingsBg.lineStyle(1, COLORS.GOLD_DIM, 1);
      this.settingsBg.strokeRect(settingsBtnX, btnY, settingsBtnW, btnSize);
      this.settingsLabel.setPosition(settingsBtnX + settingsBtnW / 2, btnY + btnSize / 2);
    }

    // 存档/读档按钮（顶栏右侧，设置按钮左侧，28px）
    const saveBtnW = 28;
    const saveBtnX = settingsBtnX - btnGap - saveBtnW;
    if (!this.saveZone) {
      this.saveBg = this.scene.add.graphics();
      this.saveLabel = this.scene.add.text(0, 0, '档', {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      this.saveZone = this.scene.add.zone(0, 0, saveBtnW, btnSize).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      this.saveZone.on('pointerup', () => {
        registryGet(this.scene.registry, REGISTRY_KEYS.audioManager)?.playUi?.('sfx_click');
        registryGet(this.scene.registry, REGISTRY_KEYS.settingsPanel)?.hide?.();
        const panel = registryGet(this.scene.registry, REGISTRY_KEYS.saveLoadPanel);
        panel?.toggle?.();
      });
      this.container.add([this.saveBg, this.saveLabel, this.saveZone]);
    }
    if (this.saveZone && this.saveBg && this.saveLabel) {
      this.saveZone.setPosition(saveBtnX, btnY).setSize(saveBtnW, btnSize);
      this.saveBg.clear();
      this.saveBg.fillStyle(COLORS.WOOD, 0.7);
      this.saveBg.fillRect(saveBtnX, btnY, saveBtnW, btnSize);
      this.saveBg.lineStyle(1, COLORS.GOLD_DIM, 1);
      this.saveBg.strokeRect(saveBtnX, btnY, saveBtnW, btnSize);
      this.saveLabel.setPosition(saveBtnX + saveBtnW / 2, btnY + btnSize / 2);
    }

    // P2：功业记分牌按钮（顶栏右侧，档按钮左侧，28px）
    const scoreBtnW = 28;
    const scoreBtnX = saveBtnX - btnGap - scoreBtnW;
    if (!this.scoreZone) {
      this.scoreBg = this.scene.add.graphics();
      this.scoreLabel = this.scene.add.text(0, 0, '记', {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      this.scoreZone = this.scene.add.zone(0, 0, scoreBtnW, btnSize).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      this.scoreZone.on('pointerup', () => {
        registryGet(this.scene.registry, REGISTRY_KEYS.audioManager)?.playUi?.('sfx_click');
        const panel = registryGet(this.scene.registry, REGISTRY_KEYS.scoreCardPanel);
        panel?.toggle?.();
      });
      this.container.add([this.scoreBg, this.scoreLabel, this.scoreZone]);
    }
    if (this.scoreZone && this.scoreBg && this.scoreLabel) {
      this.scoreZone.setPosition(scoreBtnX, btnY).setSize(scoreBtnW, btnSize);
      this.scoreBg.clear();
      this.scoreBg.fillStyle(COLORS.WOOD, 0.7);
      this.scoreBg.fillRect(scoreBtnX, btnY, scoreBtnW, btnSize);
      this.scoreBg.lineStyle(1, COLORS.GOLD_DIM, 1);
      this.scoreBg.strokeRect(scoreBtnX, btnY, scoreBtnW, btnSize);
      this.scoreLabel.setPosition(scoreBtnX + scoreBtnW / 2, btnY + btnSize / 2);
    }

    // 2026-06-19：主功能按钮（朝堂/邦交/军务/大业）移到顶栏下方独立工具栏（见 layoutFunctionToolbar）。
    this.layoutFunctionToolbar(w);

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

  /** 2026-06-19：主功能工具栏——顶栏正下方一排大按钮（朝堂/邦交/军务/大业），参考钢铁雄心主菜单的醒目布局。 */
  private layoutFunctionToolbar(w: number): void {
    const defs: { text: string; reg: 'policyTreePanel' | 'diplomacyPanel' | 'militaryPanel' | 'megaProjectPanel' | 'influencePanel' }[] = [
      { text: '朝堂', reg: 'policyTreePanel' },
      { text: '邦交', reg: 'diplomacyPanel' },
      { text: '军务', reg: 'militaryPanel' },
      { text: '大业', reg: 'megaProjectPanel' },
      { text: '史官', reg: 'influencePanel' },
    ];
    const tbY = UI.topbarHeight;
    const tbH = UI.toolbarHeight;
    if (!this.toolbarBg) {
      this.toolbarBg = this.scene.add.graphics();
      this.container.add(this.toolbarBg);
    }
    this.toolbarBg.clear();
    this.toolbarBg.fillStyle(COLORS.WOOD_LIGHT, 0.96);
    this.toolbarBg.fillRect(0, tbY, w, tbH);
    this.toolbarBg.lineStyle(2, COLORS.GOLD_DIM, 1);
    this.toolbarBg.lineBetween(0, tbY + tbH, w, tbY + tbH);

    // B3：工具栏右侧工坊物资（麻/锡），不挤占顶栏 8 资源 token
    this.craftText?.setPosition(w - 14, tbY + tbH / 2);
    this.refreshCraftResources();

    const btnW = 104, btnH = 30, gap = 8, padLeft = 12;
    // P2 三幕时间轴：幕名放在按钮组与工坊物资之间的空档
    this.actText?.setPosition(12 + 5 * (btnW + gap) + 16, tbY + tbH / 2);
    const y = tbY + Math.floor((tbH - btnH) / 2);
    defs.forEach((d, i) => {
      let b = this.toolbarBtns[i];
      if (!b) {
        const bg = this.scene.add.graphics();
        const label = this.scene.add.text(0, 0, d.text, {
          ...FONTS.panelHeading, fontSize: '18px', color: '#F5ECD7',
        } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
        const zone = this.scene.add.zone(0, 0, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        // pointerup：朝堂/邦交/军务/大业面板都会"点遮罩关闭"，若用 pointerdown，开面板那一下的松手会落在遮罩上秒关（军务 bug）
        zone.on('pointerup', () => {
          registryGet(this.scene.registry, REGISTRY_KEYS.audioManager)?.playUi?.('sfx_click');
          const panel = registryGet(this.scene.registry, REGISTRY_KEYS[d.reg]);
          panel?.toggle?.();
        });
        this.container.add([bg, label, zone]);
        b = { bg, label, zone };
        this.toolbarBtns[i] = b;
      }
      const x = padLeft + i * (btnW + gap);
      b.zone.setPosition(x, y).setSize(btnW, btnH);
      b.bg.clear();
      b.bg.fillStyle(COLORS.GOLD_DIM, 0.95);
      b.bg.fillRect(x, y, btnW, btnH);
      b.bg.lineStyle(1.5, COLORS.GOLD, 1);
      b.bg.strokeRect(x, y, btnW, btnH);
      b.label.setPosition(x + btnW / 2, y + btnH / 2);
    });
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
      // 纪元式：民 = 闲民/住房上限（现有可用人力 / 可容纳上限）。民是建造时会被消耗、之后回涨的人力池，
      // 单显"民0"会被误读为"没人"；显示成 0/40 一眼看懂"人都在岗、上限 40"。不走数字 tween（X/Y 无法插值）。
      if (id === 'people') {
        // 纪元式：民显示"当前/住房上限 + 趋势箭头"，一眼看出有多少民、还能长多少、在涨还是跌。
        // 闲置劳力 / 农工兵士分布 / 粮储等细节移到点击"民"打开的人口详情面板（PopulationPanel）。
        const status = this.store.getPopulationStatus();
        const old = this.resourceTweens.get(id);
        if (old) { old.stop(); this.resourceTweens.delete(id); }
        const arrow = status.reason === 'grow' ? '▲'
          : status.reason === 'starve' ? '▼'
          : status.reason === 'overflow' ? '▼'  // 超住房上限，人口正温和回落（BUG-A）
          : status.reason === 'cap' ? '●'
          : '─';
        token.txt.setText(`${status.total}/${status.cap} ${arrow}`);
        token.txt.setFontSize(16); // 「民」是 X/Y 复合文本，比纯数字宽；调小到 16px 容下三位数，不顶到"布"
        // 配色守 11 色板：缺粮→朱砂(CINNABAR #B71C1C)预警；满/超/接近上限→金(GOLD #C9A84C)；正常→奶纸(PAPER)
        const ratio = status.cap > 0 ? status.total / status.cap : 0;
        let color = '#F5ECD7';
        if (status.reason === 'starve') color = '#B71C1C';
        else if (status.reason === 'overflow' || status.reason === 'cap' || ratio >= 0.8) color = '#C9A84C';
        token.txt.setColor(color);
        this.prevResourceValues.set(id, v);
        continue;
      }
      const prev = this.prevResourceValues.get(id);
      // 首次绘制 / snap / 值未变：直接 setText，不起 tween
      if (prev === undefined || snap || prev === v) {
        const old = this.resourceTweens.get(id);
        if (old) { old.stop(); this.resourceTweens.delete(id); }
        token.txt.setText(String(v));
        this.prevResourceValues.set(id, v);
        continue;
      }
      // A-8：资源变化飘字
      const delta = v - prev;
      if (delta !== 0) this.spawnResourceFloat(token, delta);
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
    this.refreshCraftResources();
  }

  /** B3：刷新工坊物资小字（麻/锡）。 */
  private refreshCraftResources(): void {
    if (!this.craftText) return;
    const r = this.store.getResources();
    const parts = INTERMEDIATE_RESOURCE_IDS.map((id) => `${RESOURCE_LABEL[id]} ${r[id] ?? 0}`);
    const inf = r.influence ?? 0;
    const cap = this.store.getInfluenceCap();
    this.craftText.setText(`名望 ${inf}/${cap}　工坊物资　${parts.join(' · ')}`);
  }

  /** A1：刷新 心/怨 双米（阈值处变红提示）。 */
  private refreshSentiment(): void {
    if (!this.moraleText || !this.wrathText) return;
    const morale = this.store.getPlayerMorale();
    const wrath = this.store.getPublicWrath();
    this.moraleText.setText(`心 ${morale}`);
    this.moraleText.setColor(morale <= 25 ? '#B71C1C' : '#4A7C59');
    this.wrathText.setText(`怨 ${wrath}${wrath >= 70 ? '！' : ''}`);
    this.wrathText.setColor('#B71C1C');
  }

  private spawnResourceFloat(token: ResourceToken, delta: number): void {
    const isPositive = delta > 0;
    const isLarge = Math.abs(delta) > 20;
    const text = isPositive ? `+${delta}` : `${delta}`;
    const color = isPositive ? '#4CAF50' : '#E53935';
    const fontSize = isLarge ? 18 : 13;

    const x = token.txt.x + 20;
    const y = token.txt.y - 4;
    const t = this.scene.add.text(x, y, text, {
      fontFamily: '"Noto Sans SC", sans-serif',
      fontSize: `${fontSize}px`,
      color,
      fontStyle: 'bold',
    }).setOrigin(0.5, 1).setScrollFactor(0).setDepth(1100);
    this.container.add(t);

    const targetY = isPositive ? y - 22 : y + 18;
    const tw = this.scene.tweens.add({
      targets: t,
      y: targetY,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        t.destroy();
        this.floatTexts = this.floatTexts.filter(f => f.t !== t);
      },
    });
    this.floatTexts.push({ t, tw });

    if (isLarge) {
      this.scene.tweens.add({
        targets: t,
        x: x + 2,
        duration: 50,
        yoyo: true,
        repeat: 3,
      });
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

  /** P2 三幕：幕名刷到工具栏中段。 */
  private refreshAct(): void {
    if (!this.actText) return;
    const act = actFor(this.store.getCurrentDay());
    this.actText.setText(act.name);
  }
  private onActChanged = (): void => this.refreshAct();

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
    this.store.off(STATE_EVENTS.ACT_CHANGED, this.onActChanged);
    this.store.off(STATE_EVENTS.SEASON_TICK, this.onSeasonTick);
    this.store.off(STATE_EVENTS.YEAR_TICK, this.onYearTick);
    this.store.off(STATE_EVENTS.PAUSED_CHANGED, this.onPaused);
    this.store.off(STATE_EVENTS.SPEED_CHANGED, this.onSpeed);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    this.store.off(STATE_EVENTS.MORALE_CHANGED, this.onMoraleChanged);
    this.store.off(STATE_EVENTS.WRATH_CHANGED, this.onWrathChanged);
    // 先停所有进行中的 tween，避免 destroy 后 onUpdate / onComplete 仍触发 NPE
    for (const tw of this.resourceTweens.values()) tw.stop();
    this.resourceTweens.clear();
    if (this.dateFadeTween) { this.dateFadeTween.stop(); this.dateFadeTween = null; }
    if (this.gradeBadgeTween) { this.gradeBadgeTween.stop(); this.gradeBadgeTween = null; }
    for (const f of this.floatTexts) { f.tw.stop(); f.t.destroy(); }
    this.floatTexts = [];
    this.container.destroy(true);
  }
}
