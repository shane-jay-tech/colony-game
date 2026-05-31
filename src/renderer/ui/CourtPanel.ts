import Phaser from 'phaser';
import { COLORS, FONTS, UI } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { PolicyNode, RoyalDecree } from '../data/schema';
import type { ResourceCost, ResourceId } from '../data/resourceRegistry';
import { canAfford } from '../data/resourceRegistry';
import { drawDecorativePanelFrame } from './panelDecoration';
import { PANEL_COLLAPSED_WIDTH } from '../render/MapRenderer';

/**
 * CourtPanel：右侧"朝堂"面板，包含两个 tab：
 *   - 国策 (PolicyTab)：可采纳的 policies；前置已满足显示金色，前置未满足灰显
 *   - 朝令 (DecreeTab)：可采纳的 decrees + 进行中的 decrees 进度
 *
 * 设计：
 *   - tab 切换在面板内部完成，不重建 container
 *   - 资源变动 / 政策采纳 / 朝令推进 时刷新可见 tab
 *   - 点击 row → store.adoptPolicy / adoptDecree；失败时通过 toast 告知
 *   - 进行中的朝令以"阶段进度条 + 当前阶 effect"展示
 *
 * 销毁：UIScene.shutdown 调 .destroy()
 */

const TAB_HEIGHT = 36;
const ROW_HEIGHT = 56;
const ROW_GAP = 4;

const RESOURCE_LABEL: Record<ResourceId, string> = {
  grain: '粮', wood: '木', stone: '石', gold: '钱',
  people: '民', cloth: '布', bronze: '铜', rite: '礼',
};

interface PolicyRow {
  def: PolicyNode;
  bg: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  costLabel: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

interface DecreeRow {
  def: RoyalDecree;
  bg: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  statusLabel: Phaser.GameObjects.Text;
  progressBg: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
}

type Tab = 'policy' | 'decree';

export class CourtPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bgGfx: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly tabPolicyZone: Phaser.GameObjects.Zone;
  private readonly tabDecreeZone: Phaser.GameObjects.Zone;
  private readonly tabPolicyText: Phaser.GameObjects.Text;
  private readonly tabDecreeText: Phaser.GameObjects.Text;
  private readonly tabBg: Phaser.GameObjects.Graphics;

  private policyRows: PolicyRow[] = [];
  private decreeRows: DecreeRow[] = [];
  private currentTab: Tab = 'policy';
  private destroyed = false;

  // v0.9 折叠/展开
  private collapseBg!: Phaser.GameObjects.Graphics;
  private collapseLabel!: Phaser.GameObjects.Text;
  private collapseZone!: Phaser.GameObjects.Zone;
  private rowsFadeTween: Phaser.Tweens.Tween | null = null;

  // v0.9 滚动
  private rowsMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private rowsMask: Phaser.Display.Masks.GeometryMask | null = null;
  private rowsAreaRect: { x: number; y: number; w: number; h: number } | null = null;
  /** 两个 tab 各自的滚动位置；切换 tab 时不丢失对方的滚动 */
  private scrollY: { policy: number; decree: number } = { policy: 0, decree: 0 };
  private scrollbarGfx: Phaser.GameObjects.Graphics | null = null;

  // store 监听器（refresh policy/decree 状态）
  private onResources = (): void => this.refresh();
  private onAdopted = (): void => this.refresh();
  private onAdvanced = (): void => this.refresh();
  private onCompleted = (): void => this.refresh();
  private onStalled = (): void => this.refresh();
  private onReplaced = (): void => {
    this.refresh();
    // 读档可能换了折叠态，重排
    this.layout();
  };
  private onDayTick = (): void => {
    // 朝令进度条每天会变；只在 decree tab 可见时刷新，省一点点开销
    if (this.currentTab === 'decree') this.refresh();
  };
  private onPanelCollapsed = (...args: unknown[]): void => {
    const payload = args[0] as { side: 'left' | 'right'; collapsed: boolean } | undefined;
    if (!payload || payload.side !== 'right') return;
    if (!payload.collapsed) this.beginExpandFade();
    this.layout();
  };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.titleText = scene.add.text(0, 0, '朝堂', {
      ...FONTS.panelHeading,
      color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    // tab 标题
    this.tabBg = scene.add.graphics();
    this.tabPolicyText = scene.add.text(0, 0, '国策', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.tabDecreeText = scene.add.text(0, 0, '朝令', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.tabPolicyZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.tabDecreeZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.tabPolicyZone.on('pointerdown', () => this.setTab('policy'));
    this.tabDecreeZone.on('pointerdown', () => this.setTab('decree'));
    this.container.add([this.tabBg, this.tabPolicyText, this.tabDecreeText, this.tabPolicyZone, this.tabDecreeZone]);

    // v0.9：折叠/展开 toggle 按钮（右面板：▶ 折叠/◀ 展开）
    this.collapseBg = scene.add.graphics();
    this.collapseLabel = scene.add.text(0, 0, '▶', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.collapseZone = scene.add.zone(0, 0, 22, 22).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.collapseZone.on('pointerdown', () => {
      const cur = this.store.getPanelCollapsed('right');
      this.store.setPanelCollapsed('right', !cur);
    });
    this.container.add([this.collapseBg, this.collapseLabel, this.collapseZone]);

    // v0.9 滚动：创建 row 区域 mask + 滚动条 graphic
    this.rowsMaskGfx = scene.add.graphics().setVisible(false);
    this.rowsMask = this.rowsMaskGfx.createGeometryMask();
    this.scrollbarGfx = scene.add.graphics();
    this.container.add(this.scrollbarGfx);

    // build initial rows
    // v1.0 #1：政策按 branch → tier 排序，让树形分支在面板里"先 branch 内分组、内部 T1→T4 递进"
    const BRANCH_ORDER: Record<string, number> = {
      农桑: 1, 工坊: 2, 礼制: 3, 保甲: 4, 外交: 5, 学问: 6,
    };
    const sortedPolicies = [...store.getPolicies()].sort((a, b) => {
      const ba = BRANCH_ORDER[a.branch] ?? 99;
      const bb = BRANCH_ORDER[b.branch] ?? 99;
      if (ba !== bb) return ba - bb;
      if (a.tier !== b.tier) return a.tier - b.tier;
      // 同 tier：focus 标签的（互斥岔路）排在无 focus 的后面，便于玩家辨识
      const fa = a.focus ? 1 : 0;
      const fb = b.focus ? 1 : 0;
      return fa - fb;
    });
    for (const def of sortedPolicies) {
      this.policyRows.push(this.makePolicyRow(def));
    }
    // v1.0 #2：按类别排序后建 row，layout/refresh 时插入 category 头
    const CATEGORY_ORDER: Record<string, number> = {
      内政: 1, 工坊: 2, 军事: 3, 外交: 4, 礼制: 5,
    };
    const sortedDecrees = [...store.getDecrees()].sort((a, b) => {
      const ca = CATEGORY_ORDER[a.category] ?? 99;
      const cb = CATEGORY_ORDER[b.category] ?? 99;
      if (ca !== cb) return ca - cb;
      // 同类内 chainPrev 先后排：无前置在前，有前置在后
      const ha = a.chainPrev ? 1 : 0;
      const hb = b.chainPrev ? 1 : 0;
      return ha - hb;
    });
    for (const def of sortedDecrees) {
      this.decreeRows.push(this.makeDecreeRow(def));
    }

    this.layout(); // layout() 末尾会 refresh，无需再调一次

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.POLICY_ADOPTED, this.onAdopted);
    store.on(STATE_EVENTS.DECREE_ADOPTED, this.onAdopted);
    store.on(STATE_EVENTS.DECREE_ADVANCED, this.onAdvanced);
    store.on(STATE_EVENTS.DECREE_COMPLETED, this.onCompleted);
    store.on(STATE_EVENTS.DECREE_STALLED, this.onStalled);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);

    // v0.9 滚动：监听 wheel；命中 row 区域才滚（不影响其他面板）
    scene.input.on('wheel', this.onWheel, this);
  }

  private onWheel = (
    pointer: Phaser.Input.Pointer,
    _go: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
  ): void => {
    if (!this.rowsAreaRect) return;
    if (this.store.getPanelCollapsed('right')) return;
    const r = this.rowsAreaRect;
    if (pointer.x < r.x || pointer.x > r.x + r.w) return;
    if (pointer.y < r.y || pointer.y > r.y + r.h) return;
    const rows = this.currentTab === 'policy' ? this.policyRows.length : this.decreeRows.length;
    const contentH = rows * (ROW_HEIGHT + ROW_GAP);
    const maxScroll = Math.max(0, contentH - r.h);
    if (maxScroll <= 0) return;
    const cur = this.scrollY[this.currentTab];
    const next = Math.max(0, Math.min(maxScroll, cur + dy * 0.5));
    if (next === cur) return;
    this.scrollY[this.currentTab] = next;
    this.layout();
  };

  private beginExpandFade(): void {
    if (this.rowsFadeTween) { this.rowsFadeTween.stop(); this.rowsFadeTween = null; }
    const all: Phaser.GameObjects.GameObject[] = [];
    for (const r of this.policyRows) {
      r.bg.setAlpha(0); r.nameLabel.setAlpha(0); r.costLabel.setAlpha(0);
      all.push(r.bg, r.nameLabel, r.costLabel);
    }
    for (const r of this.decreeRows) {
      r.bg.setAlpha(0); r.nameLabel.setAlpha(0); r.statusLabel.setAlpha(0); r.progressBg.setAlpha(0);
      all.push(r.bg, r.nameLabel, r.statusLabel, r.progressBg);
    }
    // tabs 也淡入
    this.tabBg.setAlpha(0); this.tabPolicyText.setAlpha(0); this.tabDecreeText.setAlpha(0);
    all.push(this.tabBg, this.tabPolicyText, this.tabDecreeText);
    this.rowsFadeTween = this.scene.tweens.add({
      targets: all,
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => { this.rowsFadeTween = null; },
    });
  }

  private makePolicyRow(def: PolicyNode): PolicyRow {
    const bg = this.scene.add.graphics();
    const nameLabel = this.scene.add.text(0, 0, `${def.name} · T${def.tier}`, {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const costLabel = this.scene.add.text(0, 0, formatCost(def.cost), {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const zone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.handlePolicyClick(def));
    this.container.add([bg, nameLabel, costLabel, zone]);
    if (this.rowsMask) {
      bg.setMask(this.rowsMask);
      nameLabel.setMask(this.rowsMask);
      costLabel.setMask(this.rowsMask);
    }
    return { def, bg, nameLabel, costLabel, zone };
  }

  private makeDecreeRow(def: RoyalDecree): DecreeRow {
    const bg = this.scene.add.graphics();
    const nameLabel = this.scene.add.text(0, 0, def.name, {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const statusLabel = this.scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const progressBg = this.scene.add.graphics();
    const zone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.handleDecreeClick(def));
    this.container.add([bg, nameLabel, statusLabel, progressBg, zone]);
    if (this.rowsMask) {
      bg.setMask(this.rowsMask);
      nameLabel.setMask(this.rowsMask);
      statusLabel.setMask(this.rowsMask);
      progressBg.setMask(this.rowsMask);
    }
    return { def, bg, nameLabel, statusLabel, progressBg, zone };
  }

  private setTab(tab: Tab): void {
    if (this.currentTab === tab) return;
    this.currentTab = tab;
    this.layout(); // layout() 末尾会 refresh
  }

  private handlePolicyClick(def: PolicyNode): void {
    const result = this.store.adoptPolicy(def.id);
    if (!result.ok) this.showFailToast(failPolicyMsg(result));
    // 成功路径会触发 POLICY_ADOPTED → onAdopted → refresh（包含资源扣除提示）
  }

  private handleDecreeClick(def: RoyalDecree): void {
    // 已激活：禁止重复点
    const active = this.store.getActiveDecrees().find(a => a.id === def.id);
    if (active) {
      this.showFailToast(`「${def.name}」已在推进，第 ${active.currentStage + 1} 阶段`);
      return;
    }
    const result = this.store.adoptDecree(def.id);
    if (!result.ok) this.showFailToast(failDecreeMsg(result));
  }

  private showFailToast(msg: string): void {
    const toast = this.scene.registry.get('toast') as { show?: (t: string, k?: string) => void } | undefined;
    toast?.show?.(msg, 'error');
  }

  layout(): void {
    const collapsed = this.store.getPanelCollapsed('right');
    const w = collapsed ? PANEL_COLLAPSED_WIDTH : UI.rightPanelWidth;
    const x = this.scene.scale.width - w - 8;
    const top = UI.topbarHeight + 8;
    const h = this.scene.scale.height - top - 8;

    this.bgGfx.clear();
    if (collapsed) {
      this.bgGfx.fillStyle(COLORS.WOOD, 0.95);
      this.bgGfx.fillRect(x, top, w, h);
      this.bgGfx.lineStyle(2, COLORS.GOLD_DIM, 1);
      this.bgGfx.strokeRect(x, top, w, h);
      this.bgGfx.lineStyle(1, COLORS.GOLD, 0.6);
      this.bgGfx.strokeRect(x + 2, top + 2, w - 4, h - 4);
    } else {
      drawDecorativePanelFrame(this.bgGfx, x, top, w, h, 'left');
    }

    // 标题
    if (collapsed) {
      this.titleText.setText('朝\n堂');
      this.titleText.setOrigin(0.5, 0);
      this.titleText.setPosition(x + w / 2, top + 36);
      this.titleText.setLineSpacing(2);
    } else {
      this.titleText.setText('朝堂');
      this.titleText.setOrigin(0, 0);
      this.titleText.setPosition(x + 12, top + 10);
      this.titleText.setLineSpacing(0);
    }

    // 折叠/展开按钮：右面板上的按钮永远靠面板左边（朝向地图那一侧），玩家心智一致
    //   展开态 → 面板左上角内侧（不挡 row）
    //   折叠态 → 居中（28px 窄条）
    const btnSize = 22;
    const btnX = collapsed
      ? x + Math.floor((w - btnSize) / 2)
      : x + 8;
    const btnY = top + 8;
    this.collapseZone.setPosition(btnX, btnY).setSize(btnSize, btnSize);
    this.collapseBg.clear();
    this.collapseBg.fillStyle(COLORS.GOLD_DIM, 0.85);
    this.collapseBg.fillRect(btnX, btnY, btnSize, btnSize);
    this.collapseBg.lineStyle(1, COLORS.GOLD, 1);
    this.collapseBg.strokeRect(btnX, btnY, btnSize, btnSize);
    this.collapseLabel.setText(collapsed ? '◀' : '▶');
    this.collapseLabel.setPosition(btnX + btnSize / 2, btnY + btnSize / 2);

    // tabs：折叠时全部隐藏
    const tabsY = top + 40;
    const halfW = (w - 24) / 2;
    if (collapsed) {
      this.tabPolicyZone.setVisible(false);
      this.tabDecreeZone.setVisible(false);
      this.tabPolicyText.setVisible(false);
      this.tabDecreeText.setVisible(false);
      this.tabBg.setVisible(false);
    } else {
      this.tabPolicyZone.setVisible(true).setPosition(x + 12, tabsY).setSize(halfW, TAB_HEIGHT);
      this.tabDecreeZone.setVisible(true).setPosition(x + 12 + halfW, tabsY).setSize(halfW, TAB_HEIGHT);
      this.tabPolicyText.setVisible(true).setPosition(x + 12 + halfW / 2, tabsY + TAB_HEIGHT / 2);
      this.tabDecreeText.setVisible(true).setPosition(x + 12 + halfW + halfW / 2, tabsY + TAB_HEIGHT / 2);
      this.tabBg.setVisible(true);
      this.tabBg.clear();
      this.tabBg.fillStyle(this.currentTab === 'policy' ? COLORS.GOLD : COLORS.WOOD_LIGHT, 0.9);
      this.tabBg.fillRect(x + 12, tabsY, halfW, TAB_HEIGHT);
      this.tabBg.fillStyle(this.currentTab === 'decree' ? COLORS.GOLD : COLORS.WOOD_LIGHT, 0.9);
      this.tabBg.fillRect(x + 12 + halfW, tabsY, halfW, TAB_HEIGHT);
      this.tabBg.lineStyle(1, COLORS.GOLD_DIM, 1);
      this.tabBg.strokeRect(x + 12, tabsY, halfW * 2, TAB_HEIGHT);
      this.tabPolicyText.setColor(this.currentTab === 'policy' ? '#1A1410' : '#F5ECD7');
      this.tabDecreeText.setColor(this.currentTab === 'decree' ? '#1A1410' : '#F5ECD7');
    }

    // rows
    const rowsTop = tabsY + TAB_HEIGHT + 8;
    const rowsBottom = top + h - 8;
    const rowsAreaH = Math.max(0, rowsBottom - rowsTop);
    const rowX = x + 12;
    const rowW = w - 24;
    this.rowsAreaRect = collapsed ? null : { x: rowX, y: rowsTop, w: rowW, h: rowsAreaH };

    // 重画 mask 矩形
    if (this.rowsMaskGfx && !collapsed) {
      this.rowsMaskGfx.clear();
      this.rowsMaskGfx.fillStyle(0xffffff, 1);
      this.rowsMaskGfx.fillRect(rowX, rowsTop, rowW, rowsAreaH);
    } else if (this.rowsMaskGfx) {
      this.rowsMaskGfx.clear();
    }

    // clamp 当前 tab 的 scrollY；切换 tab 时另一 tab 的滚动量保留
    const activeRowsCount = this.currentTab === 'policy' ? this.policyRows.length : this.decreeRows.length;
    const contentH = activeRowsCount * (ROW_HEIGHT + ROW_GAP);
    const maxScroll = Math.max(0, contentH - rowsAreaH);
    if (this.scrollY[this.currentTab] > maxScroll) this.scrollY[this.currentTab] = maxScroll;
    if (this.scrollY[this.currentTab] < 0) this.scrollY[this.currentTab] = 0;
    const offsetY = this.scrollY[this.currentTab];

    let cy = rowsTop - offsetY;
    const showPolicy = !collapsed && this.currentTab === 'policy';
    for (const r of this.policyRows) {
      if (showPolicy) {
        r.zone.setPosition(rowX, cy).setSize(rowW, ROW_HEIGHT);
        r.bg.setVisible(true);
        r.nameLabel.setVisible(true);
        r.costLabel.setVisible(true);
        r.nameLabel.setPosition(rowX + 8, cy + 8);
        r.costLabel.setPosition(rowX + 8, cy + 30);
        // 完全在可视区外 → 关 zone（mask 只裁视觉，不裁交互）
        const fullyAbove = cy + ROW_HEIGHT < rowsTop;
        const fullyBelow = cy > rowsBottom;
        r.zone.setVisible(!fullyAbove && !fullyBelow);
        cy += ROW_HEIGHT + ROW_GAP;
      } else {
        r.zone.setVisible(false);
        r.bg.setVisible(false);
        r.nameLabel.setVisible(false);
        r.costLabel.setVisible(false);
      }
    }
    if (!showPolicy) cy = rowsTop - offsetY;
    const showDecree = !collapsed && this.currentTab === 'decree';
    for (const r of this.decreeRows) {
      if (showDecree) {
        r.zone.setPosition(rowX, cy).setSize(rowW, ROW_HEIGHT);
        r.bg.setVisible(true);
        r.nameLabel.setVisible(true);
        r.statusLabel.setVisible(true);
        r.progressBg.setVisible(true);
        r.nameLabel.setPosition(rowX + 8, cy + 6);
        r.statusLabel.setPosition(rowX + 8, cy + 24);
        const fullyAbove = cy + ROW_HEIGHT < rowsTop;
        const fullyBelow = cy > rowsBottom;
        r.zone.setVisible(!fullyAbove && !fullyBelow);
        cy += ROW_HEIGHT + ROW_GAP;
      } else {
        r.zone.setVisible(false);
        r.bg.setVisible(false);
        r.nameLabel.setVisible(false);
        r.statusLabel.setVisible(false);
        r.progressBg.setVisible(false);
      }
    }

    // 滚动条提示：右侧 4px 金色条，仅 maxScroll > 0 时显示
    if (this.scrollbarGfx) {
      this.scrollbarGfx.clear();
      if (!collapsed && maxScroll > 0) {
        const sbW = 4;
        const sbX = rowX + rowW - sbW - 2;
        const trackY = rowsTop;
        const trackH = rowsAreaH;
        const thumbH = Math.max(24, Math.floor(trackH * (rowsAreaH / contentH)));
        const thumbY = trackY + Math.floor((offsetY / maxScroll) * (trackH - thumbH));
        this.scrollbarGfx.fillStyle(COLORS.WOOD, 0.5);
        this.scrollbarGfx.fillRect(sbX, trackY, sbW, trackH);
        this.scrollbarGfx.fillStyle(COLORS.GOLD, 0.85);
        this.scrollbarGfx.fillRect(sbX, thumbY, sbW, thumbH);
      }
    }

    // 折叠时不需要 refresh（row 全隐藏），节省一次空 fillStyle 调用
    if (!collapsed && (this.policyRows.length > 0 || this.decreeRows.length > 0)) this.refresh();
  }

  private refresh(): void {
    const resources = this.store.getResources();
    const adopted = this.store.getAdoptedPolicyIds();

    // policies — affordance + prereq + mutex + already adopted (v1.0 #1)
    for (const r of this.policyRows) {
      const def = r.def;
      const prereqMissing = def.prerequisites.filter(p => !adopted.has(p));
      const isAdopted = adopted.has(def.id);
      // v1.0 #1：互斥兄弟检测 —— 任一已采纳即锁死本条
      const blockingExclusives = (def.mutuallyExclusive ?? []).filter(ex => adopted.has(ex));
      const mutexLocked = !isAdopted && blockingExclusives.length > 0;
      const affordable = canAfford(resources, def.cost);

      r.bg.clear();
      let fill: number;
      let alpha = 0.85;
      let nameColor = '#F5ECD7';
      let costColor = '#E6DCC3';
      let costSuffix = '';
      if (isAdopted) {
        fill = COLORS.STONE_GREEN;
        nameColor = '#F5ECD7';
        costSuffix = ' · 已采纳';
      } else if (mutexLocked) {
        // v1.0 #1：互斥锁死，深红底 + ⊘
        fill = COLORS.CINNABAR;
        alpha = 0.4;
        nameColor = '#C9B69E';
        costColor = '#C9B69E';
        costSuffix = ' · ⊘ 互斥已锁';
      } else if (prereqMissing.length > 0) {
        fill = COLORS.ASH;
        alpha = 0.5;
        nameColor = '#A89A8A';
        costColor = '#857B71';
        costSuffix = ` · 需 ${prereqMissing.length} 前置`;
      } else if (!affordable) {
        fill = COLORS.WOOD_LIGHT;
        alpha = 0.6;
        nameColor = '#D8C9A8';
        costColor = '#A89A8A';
        costSuffix = ' · 资源不足';
      } else {
        fill = COLORS.GOLD_DIM;
        alpha = 0.9;
      }
      r.bg.fillStyle(fill, alpha);
      r.bg.fillRect(r.zone.x, r.zone.y, r.zone.width, r.zone.height);
      r.bg.lineStyle(1, COLORS.GOLD_DIM, 1);
      r.bg.strokeRect(r.zone.x, r.zone.y, r.zone.width, r.zone.height);
      // v1.0 #1：名字加 [branch·focus] 前缀，让玩家直观看到树状归属
      const focusTag = def.focus ? `·${def.focus}` : '';
      r.nameLabel.setText(`【${def.branch}${focusTag}】${def.name} · T${def.tier}`).setColor(nameColor);
      r.costLabel.setText(formatCost(def.cost) + costSuffix).setColor(costColor);
    }

    // decrees — adoption affordance + active stage progress bar
    const activeDecrees = this.store.getActiveDecrees();
    const completedSet = new Set(this.store.getCompletedDecreeIds());
    for (const r of this.decreeRows) {
      const def = r.def;
      const active = activeDecrees.find(a => a.id === def.id);
      const completed = completedSet.has(def.id);
      const chainLocked = !!def.chainPrev && !completedSet.has(def.chainPrev) && !active && !completed;
      const stage0 = def.stages[0];
      const affordable = stage0 ? canAfford(resources, stage0.cost) : false;

      r.bg.clear();
      r.progressBg.clear();
      let fill: number = COLORS.GOLD_DIM;
      let alpha = 0.9;
      let nameColor = '#F5ECD7';
      let statusColor = '#E6DCC3';
      let statusText: string;

      if (active) {
        const stage = def.stages[active.currentStage];
        const stageDays = stage?.days ?? 0;
        const isStalled = stageDays > 0 && active.daysElapsed > stageDays;
        if (isStalled) {
          fill = COLORS.CINNABAR;
          statusText = `第 ${active.currentStage + 1} 阶 · 资源不足，停滞`;
          statusColor = '#FFE6E1';
        } else {
          fill = COLORS.STONE_GREEN;
          const pct = stageDays > 0 ? Math.min(100, Math.floor((active.daysElapsed / stageDays) * 100)) : 100;
          statusText = `第 ${active.currentStage + 1} 阶 · ${active.daysElapsed}/${stageDays} 日 (${pct}%)`;
          // 进度条
          const barX = r.zone.x + 8;
          const barY = r.zone.y + r.zone.height - 8;
          const barW = r.zone.width - 16;
          r.progressBg.fillStyle(COLORS.WOOD, 0.7);
          r.progressBg.fillRect(barX, barY, barW, 4);
          r.progressBg.fillStyle(COLORS.GOLD, 1);
          r.progressBg.fillRect(barX, barY, Math.floor(barW * pct / 100), 4);
        }
      } else if (completed) {
        // v1.0 #2：已完成的 decree 也保留在列表里以示成就，灰底 + ✓
        fill = COLORS.ASH;
        alpha = 0.45;
        nameColor = '#9AAB8E';
        statusColor = '#9AAB8E';
        statusText = '✓ 已颁行 永久生效';
      } else if (chainLocked) {
        // v1.0 #2：链路前置未完成 → 锁住，名字暗红，给"待 X 完成"提示
        fill = COLORS.WOOD;
        alpha = 0.5;
        nameColor = '#A89A8A';
        statusColor = '#C9B69E';
        const prevDef = def.chainPrev ? this.store.getDecrees().find(d => d.id === def.chainPrev) : null;
        statusText = prevDef ? `🔒 待「${prevDef.name}」颁成` : '🔒 前置未成';
      } else if (!stage0) {
        fill = COLORS.ASH;
        alpha = 0.5;
        nameColor = '#A89A8A';
        statusText = '数据缺失';
      } else if (!affordable) {
        fill = COLORS.WOOD_LIGHT;
        alpha = 0.6;
        nameColor = '#D8C9A8';
        statusText = `首阶 ${formatCost(stage0.cost)} · 资源不足`;
      } else {
        statusText = `首阶 ${formatCost(stage0.cost)} · ${stage0.days} 日`;
      }
      r.bg.fillStyle(fill, alpha);
      r.bg.fillRect(r.zone.x, r.zone.y, r.zone.width, r.zone.height);
      r.bg.lineStyle(1, COLORS.GOLD_DIM, 1);
      r.bg.strokeRect(r.zone.x, r.zone.y, r.zone.width, r.zone.height);
      // v1.0 #2：名字加 [类别] 前缀做分组识别
      r.nameLabel.setText(`【${def.category}】${def.name}`).setColor(nameColor);
      r.statusLabel.setText(statusText).setColor(statusColor);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.POLICY_ADOPTED, this.onAdopted);
    this.store.off(STATE_EVENTS.DECREE_ADOPTED, this.onAdopted);
    this.store.off(STATE_EVENTS.DECREE_ADVANCED, this.onAdvanced);
    this.store.off(STATE_EVENTS.DECREE_COMPLETED, this.onCompleted);
    this.store.off(STATE_EVENTS.DECREE_STALLED, this.onStalled);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.scene.input.off('wheel', this.onWheel, this);
    if (this.rowsFadeTween) { this.rowsFadeTween.stop(); this.rowsFadeTween = null; }
    if (this.rowsMask) {
      this.rowsMask.destroy();
      this.rowsMask = null;
    }
    this.rowsMaskGfx?.destroy();
    this.rowsMaskGfx = null;
    this.container.destroy(true);
  }

  // 测试 hooks
  getCurrentTab(): Tab { return this.currentTab; }
  switchTo(tab: Tab): void { this.setTab(tab); }
  clickPolicyRow(idx: number): void {
    const r = this.policyRows[idx];
    if (r) this.handlePolicyClick(r.def);
  }
  clickDecreeRow(idx: number): void {
    const r = this.decreeRows[idx];
    if (r) this.handleDecreeClick(r.def);
  }
}

function formatCost(cost: ResourceCost): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cost)) {
    if (v && v > 0) parts.push(`${RESOURCE_LABEL[k as ResourceId] ?? k}${v}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '免费';
}

function failPolicyMsg(result: { reason: string; missingPrereqs?: string[]; blockingExclusives?: string[] }): string {
  switch (result.reason) {
    case 'insufficient_resources': return '资源不足，无法采纳此策';
    case 'already_adopted': return '此策已在国，无须再议';
    case 'prerequisites_unmet':
      return result.missingPrereqs && result.missingPrereqs.length > 0
        ? `尚需先行 ${result.missingPrereqs.length} 项前置之策`
        : '尚需先行其他国策';
    case 'mutually_excluded':
      return '已采纳互斥之策，此路不可兼行';
    case 'unknown_policy': return '未知国策（数据缺失）';
    default: return '无法采纳此策';
  }
}

function failDecreeMsg(result: { reason: string }): string {
  switch (result.reason) {
    case 'insufficient_resources': return '资源不足，无以颁此朝令';
    case 'already_active': return '此令已在颁行';
    case 'unlock_condition_unmet': return '尚未满足颁令条件';
    case 'chain_locked': return '前置朝令未成，此令尚锁';
    case 'unknown_decree': return '未知朝令（数据缺失）';
    default: return '无法颁此朝令';
  }
}
