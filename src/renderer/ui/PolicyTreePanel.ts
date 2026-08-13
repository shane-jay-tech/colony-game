import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from './palette';
import { REGISTRY_KEYS, registryGet, registrySet } from './registry';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { PolicyNode, RoyalDecree } from '../data/schema';
import { canAfford } from '../data/resourceRegistry';
import { describeEffects } from '../state/modifierDescriber';
import { formatCost, failPolicyMsg, failDecreeMsg } from './courtFormat';

/**
 * PolicyTreePanel：全屏「朝堂」界面（钢铁雄心式国策树 + 朝令时间轨道）。
 *
 * - 打开时游戏时停（requestPause('policyTree')，与 EventModal 同款引用计数）。
 * - 两个视图 tab：国策（按 def.x/def.y 摆成分支树，prerequisites 画连线）/ 朝令（按类别分行、chainPrev 串链、多阶进度）。
 * - 节点/卡片 hover 弹效果浮窗（descPlain + describeEffects 精确数值 + 成本 + 状态）——解决"看不懂效果没法颁布"。
 * - 内层 treeContainer 做缩放(滚轮)/平移(拖拽)；默认 fit-to-screen，整棵树一屏可见，平移缩放为增强。
 * - 取代旧的右侧折叠 CourtPanel（Phase 6 退休）。
 *
 * 渲染：纯 Phaser-native。容器 depth=2000（同 EventModal），浮窗元素加在最后→最上层。
 * 销毁：UIScene.shutdown 调 destroy()，off 监听 + 释放 pause。
 */

const HEADER_H = 56;
const NODE_W = 140;
const NODE_H = 48;
/** 分支列标题在该列 tier1 节点上方的距离（DeepSeek obj4：从魔法数字提为常量）。 */
const BRANCH_HEADER_DY = 28;
/** resetView 顶部留白：让列标题（在内容 minY 上方约 BRANCH_HEADER_DY+边距）可见。 */
const TREE_TOP_PAD = 44;
const CARD_W = 222;
const CARD_H = 88;
const CARD_GAP_X = 22;
const CARD_GAP_Y = 16;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 1.8;
const DRAG_THRESHOLD = 4;

type Tab = 'policy' | 'decree';

/** 把 storyAxisDelta 译成"集权/还权·私有/公有"倾向文案（让封建→三主义的取向可见）。无倾向返回 ''。 */
function axisLeanText(delta?: { power?: number; production?: number }): string {
  if (!delta) return '';
  const parts: string[] = [];
  const p = delta.power ?? 0;
  const r = delta.production ?? 0;
  if (p < 0) parts.push('集权'); else if (p > 0) parts.push('还权');
  if (r < 0) parts.push('私有'); else if (r > 0) parts.push('公有');
  return parts.join('·');
}

interface PolicyNodeUI {
  def: PolicyNode;
  box: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  /** 树画布坐标（节点中心） */
  cx: number;
  cy: number;
}

interface DecreeCardUI {
  def: RoyalDecree;
  box: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Graphics;
  zone: Phaser.GameObjects.Zone;
  cx: number; // 卡片左上角（树画布坐标）
  cy: number;
}

export class PolicyTreePanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly headerBg: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private readonly tabBg: Phaser.GameObjects.Graphics;
  private readonly tabPolicyText: Phaser.GameObjects.Text;
  private readonly tabDecreeText: Phaser.GameObjects.Text;
  private readonly tabPolicyZone: Phaser.GameObjects.Zone;
  private readonly tabDecreeZone: Phaser.GameObjects.Zone;
  private readonly hintText: Phaser.GameObjects.Text;

  /** 内层可平移/缩放容器（节点/连线/卡片挂这里）。 */
  private readonly treeContainer: Phaser.GameObjects.Container;
  private readonly edgesGfx: Phaser.GameObjects.Graphics;
  private policyNodes: PolicyNodeUI[] = [];
  private decreeCards: DecreeCardUI[] = [];
  /** 分支竖直列标题（农桑/工坊/…），随树平移缩放；仅国策 tab 可见。 */
  private branchHeaders: { text: Phaser.GameObjects.Text; cx: number; cy: number }[] = [];

  // 浮窗
  private readonly tipBg: Phaser.GameObjects.Graphics;
  private readonly tipText: Phaser.GameObjects.Text;

  private currentTab: Tab = 'policy';
  private isOpen = false;
  private holdsPause = false;
  private destroyed = false;
  private static readonly PAUSE_HOLDER = 'policyTree';

  // 平移/缩放状态
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private pointerDown = false;
  private dragMoved = false;
  private lastPx = 0;
  private lastPy = 0;

  // 监听器
  private onResources = (): void => { if (this.isOpen) this.refresh(); };
  private onPolicyAdopted = (): void => { if (this.isOpen) this.refresh(); };
  private onDecreeChanged = (): void => { if (this.isOpen) this.refresh(); };
  private onDayTick = (): void => { if (this.isOpen && this.currentTab === 'decree') this.refresh(); };
  private onReplaced = (): void => { if (this.isOpen) this.close(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    // 全屏遮罩 + 命中区（吃点击，不穿透；点遮罩不关闭，用 × 或 ESC）
    this.overlay = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0).setInteractive({ useHandCursor: false });
    this.container.add([this.overlay, this.overlayZone]);

    // 内层树容器（在遮罩之上、header 之下）
    this.treeContainer = scene.add.container(0, 0);
    this.edgesGfx = scene.add.graphics();
    this.treeContainer.add(this.edgesGfx);
    this.container.add(this.treeContainer);

    // header（加在 treeContainer 之后→盖住平移上溢的节点）
    this.headerBg = scene.add.graphics();
    this.titleText = scene.add.text(0, 0, '朝堂', {
      ...FONTS.title, color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
    this.tabBg = scene.add.graphics();
    this.tabPolicyText = scene.add.text(0, 0, '国策', {
      ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.tabDecreeText = scene.add.text(0, 0, '朝令', {
      ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.tabPolicyZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.tabDecreeZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.tabPolicyZone.on('pointerup', () => this.setTab('policy'));
    this.tabDecreeZone.on('pointerup', () => this.setTab('decree'));
    this.closeBg = scene.add.graphics();
    this.closeText = scene.add.text(0, 0, '✕', {
      ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.closeZone = scene.add.zone(0, 0, 36, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerup', () => this.close());
    this.hintText = scene.add.text(0, 0, '滚轮缩放 · 拖拽平移 · 点节点采纳 · 悬停看效果 · ESC 关闭', {
      ...FONTS.small, color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(1, 0.5);
    this.container.add([
      this.headerBg, this.titleText, this.tabBg, this.tabPolicyText, this.tabDecreeText,
      this.tabPolicyZone, this.tabDecreeZone, this.closeBg, this.closeText, this.closeZone, this.hintText,
    ]);

    // 浮窗（最后加→最上层）
    this.tipBg = scene.add.graphics();
    this.tipText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: COLORS_HEX.PAPER, wordWrap: { width: 260 }, lineSpacing: 3,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.tipBg.setVisible(false);
    this.tipText.setVisible(false);
    this.container.add([this.tipBg, this.tipText]);

    this.buildPolicyNodes();
    this.buildBranchHeaders();
    this.buildDecreeCards();

    // 输入：缩放/平移（仅 open 时生效，handler 内自查）
    scene.input.on('wheel', this.onWheel, this);
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.keyboard?.on('keydown-ESC', this.onEsc, this);

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.POLICY_ADOPTED, this.onPolicyAdopted);
    store.on(STATE_EVENTS.DECREE_ADOPTED, this.onDecreeChanged);
    store.on(STATE_EVENTS.DECREE_ADVANCED, this.onDecreeChanged);
    store.on(STATE_EVENTS.DECREE_COMPLETED, this.onDecreeChanged);
    store.on(STATE_EVENTS.DECREE_STALLED, this.onDecreeChanged);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onPolicyAdopted);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
  }

  // ---------- 节点/卡片构建（一次性，位置在 layout 设置） ----------

  private buildPolicyNodes(): void {
    for (const def of this.store.getPolicies()) {
      const box = this.scene.add.graphics();
      const label = this.scene.add.text(0, 0, def.name, {
        ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold', align: 'center',
        wordWrap: { width: NODE_W - 16 },
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      const zone = this.scene.add.zone(0, 0, NODE_W, NODE_H).setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.handlePolicyClick(def));
      zone.on('pointerover', (p: Phaser.Input.Pointer) => this.showPolicyTip(def, p));
      zone.on('pointerout', () => this.hideTip());
      this.treeContainer.add([box, label, zone]);
      this.policyNodes.push({ def, box, label, zone, cx: def.x, cy: def.y });
    }
  }

  /** 按 branch 分组，在每列顶部（tier1 上方）放一个金色列标题——HOI4 式分支辨识。 */
  private buildBranchHeaders(): void {
    const groups = new Map<string, PolicyNodeUI[]>();
    for (const n of this.policyNodes) {
      const arr = groups.get(n.def.branch) ?? [];
      arr.push(n);
      groups.set(n.def.branch, arr);
    }
    for (const [branch, nodes] of groups) {
      const minX = Math.min(...nodes.map(n => n.cx));
      const maxX = Math.max(...nodes.map(n => n.cx));
      const minY = Math.min(...nodes.map(n => n.cy));
      const text = this.scene.add.text(0, 0, branch, {
        ...FONTS.body, color: COLORS_HEX.GOLD, fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
      this.treeContainer.add(text);
      this.branchHeaders.push({ text, cx: (minX + maxX) / 2, cy: minY - NODE_H / 2 - BRANCH_HEADER_DY });
    }
  }

  private buildDecreeCards(): void {
    const CATEGORY_ORDER: Record<string, number> = { 内政: 0, 工坊: 1, 军事: 2, 外交: 3, 礼制: 4 };
    const decrees = this.store.getDecrees();
    // 计算每条 decree 在其链中的深度（chainPrev 跳几跳）
    const byId = new Map(decrees.map(d => [d.id, d]));
    const depthOf = (d: RoyalDecree): number => {
      let depth = 0; let cur: RoyalDecree | undefined = d;
      const seen = new Set<string>();
      while (cur?.chainPrev && byId.has(cur.chainPrev) && !seen.has(cur.id)) {
        seen.add(cur.id); depth++; cur = byId.get(cur.chainPrev);
      }
      return depth;
    };
    for (const def of decrees) {
      const row = CATEGORY_ORDER[def.category] ?? 5;
      const col = depthOf(def);
      const cx = 20 + col * (CARD_W + CARD_GAP_X);
      const cy = 20 + row * (CARD_H + CARD_GAP_Y);
      const box = this.scene.add.graphics();
      const label = this.scene.add.text(0, 0, `【${def.category}】${def.name}`, {
        ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const status = this.scene.add.text(0, 0, '', {
        ...FONTS.small, color: COLORS_HEX.PAPER_DIM,
        wordWrap: { width: CARD_W - 20 }, lineSpacing: 2, // 防成本文字溢出到邻卡(Image#11)
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const pips = this.scene.add.graphics();
      const zone = this.scene.add.zone(0, 0, CARD_W, CARD_H).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => this.handleDecreeClick(def));
      zone.on('pointerover', (p: Phaser.Input.Pointer) => this.showDecreeTip(def, p));
      zone.on('pointerout', () => this.hideTip());
      this.treeContainer.add([box, label, status, pips, zone]);
      this.decreeCards.push({ def, box, label, status, pips, zone, cx, cy });
    }
  }

  // ---------- 开关 / 时停 ----------

  toggle(): void { this.isOpen ? this.close() : this.open(); }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    if (!this.holdsPause) { this.store.requestPause(PolicyTreePanel.PAUSE_HOLDER); this.holdsPause = true; }
    registrySet(this.scene.registry, REGISTRY_KEYS.treePanelOpen, true); // GameScene 据此跳过地图滚轮缩放
    this.resetView();
    this.layout();
    this.container.setVisible(true);
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.hideTip();
    this.container.setVisible(false);
    registrySet(this.scene.registry, REGISTRY_KEYS.treePanelOpen, false);
    if (this.holdsPause) { this.store.releasePause(PolicyTreePanel.PAUSE_HOLDER); this.holdsPause = false; }
  }

  isVisible(): boolean { return this.isOpen; }

  private onEsc = (): void => { if (this.isOpen) this.close(); };

  private setTab(tab: Tab): void {
    if (this.currentTab === tab) return;
    this.currentTab = tab;
    this.hideTip();
    this.resetView();
    this.layout();
  }

  // ---------- 视图（fit-to-screen + 平移缩放） ----------

  /** 计算当前 tab 内容包围盒（树画布坐标）。 */
  private contentBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    if (this.currentTab === 'policy') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of this.policyNodes) {
        minX = Math.min(minX, n.cx - NODE_W / 2); maxX = Math.max(maxX, n.cx + NODE_W / 2);
        minY = Math.min(minY, n.cy - NODE_H / 2); maxY = Math.max(maxY, n.cy + NODE_H / 2);
      }
      if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
      return { minX, minY, maxX, maxY };
    }
    let maxX = -Infinity, maxY = -Infinity;
    for (const c of this.decreeCards) {
      maxX = Math.max(maxX, c.cx + CARD_W); maxY = Math.max(maxY, c.cy + CARD_H);
    }
    if (!Number.isFinite(maxX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    return { minX: 0, minY: 0, maxX, maxY };
  }

  /** 重置缩放/平移为 fit-to-screen（居中、整屏可见、不过度放大）。 */
  private resetView(): void {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const areaTop = HEADER_H;
    const areaW = sw - 24;
    const areaH = sh - areaTop - 16;
    const b = this.contentBounds();
    const contentW = Math.max(1, b.maxX - b.minX);
    const contentH = Math.max(1, b.maxY - b.minY);
    if (this.currentTab === 'policy') {
      // 国策树很宽（6 列横排）：fit-to-width 会把字缩到看不清。改为"可读下限 0.8、最多 1.0"，
      // 竖直方向一般一屏可见，横向溢出靠平移（HOI4 式：默认看到左侧若干列，拖动看其余）。
      const fitW = areaW / contentW;
      this.zoom = Math.max(0.8, Math.min(1.0, fitW));
      const scaledW = contentW * this.zoom;
      // 内容比可视窄→居中；否则左对齐（从农桑开始，向右拖）。
      this.panX = scaledW <= areaW
        ? 12 + (areaW - scaledW) / 2 - b.minX * this.zoom
        : 24 - b.minX * this.zoom;
      // 顶对齐：留 TREE_TOP_PAD 给列标题（标题在 minY 上方约 BRANCH_HEADER_DY 处）。
      this.panY = areaTop + TREE_TOP_PAD - b.minY * this.zoom;
      return;
    }
    const fit = Math.min(areaW / contentW, areaH / contentH, MAX_ZOOM);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fit));
    // 居中：让内容包围盒中心对齐内容区中心
    const cxCenter = (b.minX + b.maxX) / 2;
    const cyCenter = (b.minY + b.maxY) / 2;
    this.panX = 12 + areaW / 2 - cxCenter * this.zoom;
    this.panY = areaTop + areaH / 2 - cyCenter * this.zoom;
  }

  /** 平移边界 clamp：保证内容包围盒至少有 CLAMP_MARGIN 像素留在可视区，防止把树拖出屏幕找不回。 */
  private clampPan(): void {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    const MARGIN = 160;
    const b = this.contentBounds();
    const left = this.panX + b.minX * this.zoom;
    const right = this.panX + b.maxX * this.zoom;
    const top = this.panY + b.minY * this.zoom;
    const bottom = this.panY + b.maxY * this.zoom;
    if (right < MARGIN) this.panX += MARGIN - right;
    else if (left > sw - MARGIN) this.panX -= left - (sw - MARGIN);
    if (bottom < HEADER_H + MARGIN) this.panY += (HEADER_H + MARGIN) - bottom;
    else if (top > sh - MARGIN) this.panY -= top - (sh - MARGIN);
  }

  private applyTreeTransform(): void {
    this.clampPan();
    this.treeContainer.setScale(this.zoom);
    this.treeContainer.setPosition(this.panX, this.panY);
  }

  private inContentArea(p: Phaser.Input.Pointer): boolean {
    return this.isOpen && p.y > HEADER_H;
  }

  private onWheel = (p: Phaser.Input.Pointer, _go: unknown[], _dx: number, dy: number): void => {
    if (!this.inContentArea(p)) return;
    const old = this.zoom;
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, dy < 0 ? old * 1.12 : old / 1.12));
    if (Math.abs(next - old) < 1e-4) return;
    // 以鼠标为锚点缩放：保持指针下的树坐标不动
    const worldX = (p.x - this.panX) / old;
    const worldY = (p.y - this.panY) / old;
    this.zoom = next;
    this.panX = p.x - worldX * next;
    this.panY = p.y - worldY * next;
    this.applyTreeTransform();
  };

  private onPointerDown = (p: Phaser.Input.Pointer): void => {
    if (!this.inContentArea(p)) return;
    this.pointerDown = true;
    this.dragMoved = false;
    this.lastPx = p.x;
    this.lastPy = p.y;
  };

  private onPointerMove = (p: Phaser.Input.Pointer): void => {
    if (!this.pointerDown) return;
    // obj1：指针在画布外松开时全局 pointerup 可能不触发 → 这里发现按键已抬起就复位，避免"粘滞拖拽"。
    if (!p.isDown) { this.pointerDown = false; return; }
    // 越过 4px 阈值才算拖拽（防误判点击为拖拽）
    if (!this.dragMoved) {
      if (Math.hypot(p.x - this.lastPx, p.y - this.lastPy) <= DRAG_THRESHOLD) return;
      this.dragMoved = true;
    }
    this.panX += p.x - this.lastPx;
    this.panY += p.y - this.lastPy;
    this.lastPx = p.x;
    this.lastPy = p.y;
    this.hideTip();
    this.applyTreeTransform();
  };

  private onPointerUp = (): void => {
    this.pointerDown = false;
    // dragMoved 在 zone 的 pointerup 里用于判断是否算"点击采纳"
    // 这里延迟清，让 zone pointerup（同帧稍后）能读到；下次 pointerdown 会重置
  };

  // ---------- 采纳 ----------

  private handlePolicyClick(def: PolicyNode): void {
    if (this.dragMoved) return; // 刚才是拖拽平移，不当作点击采纳
    const r = this.store.adoptPolicy(def.id);
    if (!r.ok) this.toast(failPolicyMsg(r));
    // 成功→POLICY_ADOPTED→refresh
  }

  private handleDecreeClick(def: RoyalDecree): void {
    if (this.dragMoved) return;
    const active = this.store.getActiveDecrees().find(a => a.id === def.id);
    if (active) { this.toast(`「${def.name}」已在推进，第 ${active.currentStage + 1} 阶段`); return; }
    const r = this.store.adoptDecree(def.id);
    if (!r.ok) this.toast(failDecreeMsg(r));
  }

  private toast(msg: string): void {
    const t = registryGet(this.scene.registry, REGISTRY_KEYS.toast);
    t?.show?.(msg, 'error');
  }

  // ---------- 浮窗 ----------

  private showPolicyTip(def: PolicyNode, p: Phaser.Input.Pointer): void {
    if (!this.isOpen || this.pointerDown) return; // 拖拽中（按住）不弹浮窗；松手后悬停正常显示
    const adopted = this.store.getAdoptedPolicyIds();
    const lines: string[] = [];
    const focusTag = def.focus ? `·${def.focus}` : '';
    lines.push(`${def.name}　【${def.branch}${focusTag}】T${def.tier}`);
    if (def.descPlain) lines.push(def.descPlain);
    const eff = describeEffects(def.effects);
    if (eff.length) lines.push('效果：' + eff.join('；'));
    const lean = axisLeanText(def.storyAxisDelta);
    if (lean) lines.push('倾向：' + lean);
    lines.push('耗费：' + formatCost(def.cost));
    lines.push('状态：' + this.policyStatusText(def, adopted));
    this.renderTip(lines.join('\n'), p);
  }

  private showDecreeTip(def: RoyalDecree, p: Phaser.Input.Pointer): void {
    if (!this.isOpen || this.pointerDown) return;
    const lines: string[] = [];
    lines.push(`${def.name}　【${def.category}】`);
    if (def.descPlain) lines.push(def.descPlain);
    const lean = axisLeanText(def.storyAxisDelta);
    if (lean) lines.push('倾向：' + lean);
    def.stages.forEach((s, i) => {
      const eff = describeEffects(s.effects);
      lines.push(`第${i + 1}阶（${formatCost(s.cost)}，${s.days}日）：${eff.length ? eff.join('；') : '推进'}`);
    });
    this.renderTip(lines.join('\n'), p);
  }

  private renderTip(text: string, p: Phaser.Input.Pointer): void {
    this.tipText.setText(text);
    const w = Math.min(280, this.tipText.width + 20);
    const h = this.tipText.height + 16;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    let px = p.x + 16;
    let py = p.y + 16;
    if (px + w > sw - 8) px = p.x - w - 16;
    if (px < 8) px = 8;
    if (py + h > sh - 8) py = sh - h - 8;
    if (py < HEADER_H + 4) py = HEADER_H + 4;
    this.tipBg.clear();
    this.tipBg.fillStyle(COLORS.BG_INK, 0.96);
    this.tipBg.fillRect(px, py, w, h);
    this.tipBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.tipBg.strokeRect(px, py, w, h);
    this.tipText.setPosition(px + 10, py + 8);
    this.tipBg.setVisible(true);
    this.tipText.setVisible(true);
  }

  private hideTip(): void {
    this.tipBg.setVisible(false);
    this.tipText.setVisible(false);
  }

  // ---------- 布局 + 着色 ----------

  layout(): void {
    if (!this.isOpen) return;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    // 全屏遮罩
    this.overlay.clear();
    // 近不透明：建造栏/HUD/图例都在 depth<2000，0.92 会透出（Image#9 左侧穿帮）→ 0.985 基本盖死。
    this.overlay.fillStyle(COLORS.BG_INK, 0.985);
    this.overlay.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);

    // header
    this.headerBg.clear();
    this.headerBg.fillStyle(COLORS.WOOD, 1);
    this.headerBg.fillRect(0, 0, sw, HEADER_H);
    this.headerBg.lineStyle(2, COLORS.GOLD_DIM, 1);
    this.headerBg.strokeRect(0, 0, sw, HEADER_H);
    this.titleText.setPosition(16, HEADER_H / 2);

    // tabs（标题右侧）
    const tabW = 88; const tabH = 32; const tabY = (HEADER_H - tabH) / 2;
    const tabPolicyX = 150; const tabDecreeX = tabPolicyX + tabW + 8;
    this.tabBg.clear();
    this.tabBg.fillStyle(this.currentTab === 'policy' ? COLORS.GOLD : COLORS.WOOD_LIGHT, 0.95);
    this.tabBg.fillRect(tabPolicyX, tabY, tabW, tabH);
    this.tabBg.fillStyle(this.currentTab === 'decree' ? COLORS.GOLD : COLORS.WOOD_LIGHT, 0.95);
    this.tabBg.fillRect(tabDecreeX, tabY, tabW, tabH);
    this.tabBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.tabBg.strokeRect(tabPolicyX, tabY, tabW, tabH);
    this.tabBg.strokeRect(tabDecreeX, tabY, tabW, tabH);
    this.tabPolicyText.setPosition(tabPolicyX + tabW / 2, HEADER_H / 2)
      .setColor(this.currentTab === 'policy' ? COLORS_HEX.INK : COLORS_HEX.PAPER);
    this.tabDecreeText.setPosition(tabDecreeX + tabW / 2, HEADER_H / 2)
      .setColor(this.currentTab === 'decree' ? COLORS_HEX.INK : COLORS_HEX.PAPER);
    this.tabPolicyZone.setPosition(tabPolicyX, tabY).setSize(tabW, tabH);
    this.tabDecreeZone.setPosition(tabDecreeX, tabY).setSize(tabW, tabH);

    // 关闭按钮（右上）
    const closeX = sw - 44; const closeY = (HEADER_H - 36) / 2;
    this.closeBg.clear();
    this.closeBg.fillStyle(COLORS.CINNABAR, 0.85);
    this.closeBg.fillRect(closeX, closeY, 36, 36);
    this.closeBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.closeBg.strokeRect(closeX, closeY, 36, 36);
    this.closeText.setPosition(closeX + 18, closeY + 18);
    this.closeZone.setPosition(closeX, closeY).setSize(36, 36);
    this.hintText.setPosition(sw - 56, HEADER_H / 2);

    this.applyTreeTransform();
    this.layoutNodes();
    this.refresh();
  }

  /** 把节点/卡片放到各自树画布坐标（treeContainer 内的局部坐标）。 */
  private layoutNodes(): void {
    const showPolicy = this.currentTab === 'policy';
    for (const h of this.branchHeaders) {
      h.text.setVisible(showPolicy);
      if (showPolicy) h.text.setPosition(h.cx, h.cy);
    }
    for (const n of this.policyNodes) {
      n.box.setVisible(showPolicy);
      n.label.setVisible(showPolicy);
      n.zone.setVisible(showPolicy);
      if (showPolicy) {
        n.label.setPosition(n.cx, n.cy);
        n.zone.setPosition(n.cx, n.cy);
      }
    }
    for (const c of this.decreeCards) {
      c.box.setVisible(!showPolicy);
      c.label.setVisible(!showPolicy);
      c.status.setVisible(!showPolicy);
      c.pips.setVisible(!showPolicy);
      c.zone.setVisible(!showPolicy);
      if (!showPolicy) {
        c.label.setPosition(c.cx + 10, c.cy + 8);
        c.status.setPosition(c.cx + 10, c.cy + 32);
        c.zone.setPosition(c.cx, c.cy);
      }
    }
    this.edgesGfx.setVisible(showPolicy);
  }

  private refresh(): void {
    if (!this.isOpen) return;
    if (this.currentTab === 'policy') this.refreshPolicies();
    else this.refreshDecrees();
  }

  private policyStatusText(def: PolicyNode, adopted: ReadonlySet<string>): string {
    if (adopted.has(def.id)) return '已采纳';
    const blocking = (def.mutuallyExclusive ?? []).filter(ex => adopted.has(ex));
    if (blocking.length > 0) return '互斥已锁';
    const missing = def.prerequisites.filter(p => !adopted.has(p));
    if (missing.length > 0) return `需 ${missing.length} 项前置`;
    if (!canAfford(this.store.getResources(), def.cost)) return '资源不足';
    return '可采纳';
  }

  private refreshPolicies(): void {
    const resources = this.store.getResources();
    const adopted = this.store.getAdoptedPolicyIds();
    // 连线：prereq → 本节点
    this.edgesGfx.clear();
    const posById = new Map(this.policyNodes.map(n => [n.def.id, n]));
    for (const n of this.policyNodes) {
      for (const pid of n.def.prerequisites) {
        const parent = posById.get(pid);
        if (!parent) continue;
        const adoptedEdge = adopted.has(pid);
        this.edgesGfx.lineStyle(2, adoptedEdge ? COLORS.GOLD : COLORS.GOLD_DIM, adoptedEdge ? 0.9 : 0.5);
        // 正交折线：父下沿 → 中段 → 子上沿
        const x1 = parent.cx, y1 = parent.cy + NODE_H / 2;
        const x2 = n.cx, y2 = n.cy - NODE_H / 2;
        const midY = (y1 + y2) / 2;
        this.edgesGfx.beginPath();
        this.edgesGfx.moveTo(x1, y1);
        this.edgesGfx.lineTo(x1, midY);
        this.edgesGfx.lineTo(x2, midY);
        this.edgesGfx.lineTo(x2, y2);
        this.edgesGfx.strokePath();
      }
    }
    // 互斥连接符（HOI4 式"二选一"门闩）：在互斥兄弟顶部上方画红色横杠 + 中点 ×。
    const mutexDrawn = new Set<string>();
    for (const n of this.policyNodes) {
      for (const exId of n.def.mutuallyExclusive ?? []) {
        const other = posById.get(exId);
        if (!other || other === n) continue; // obj3：防数据把自己列入互斥→红×画在自身上
        const key = [n.def.id, exId].sort().join('|');
        if (mutexDrawn.has(key)) continue;
        mutexDrawn.add(key);
        const yBar = Math.min(n.cy, other.cy) - NODE_H / 2 - 12;
        const xL = Math.min(n.cx, other.cx);
        const xR = Math.max(n.cx, other.cx);
        const midX = (xL + xR) / 2;
        this.edgesGfx.lineStyle(3, COLORS.CINNABAR, 0.9);
        this.edgesGfx.beginPath();
        this.edgesGfx.moveTo(n.cx, n.cy - NODE_H / 2); this.edgesGfx.lineTo(n.cx, yBar);
        this.edgesGfx.moveTo(other.cx, other.cy - NODE_H / 2); this.edgesGfx.lineTo(other.cx, yBar);
        this.edgesGfx.moveTo(xL, yBar); this.edgesGfx.lineTo(xR, yBar);
        this.edgesGfx.strokePath();
        this.edgesGfx.lineStyle(2, COLORS.CINNABAR, 1);
        this.edgesGfx.beginPath();
        this.edgesGfx.moveTo(midX - 6, yBar - 6); this.edgesGfx.lineTo(midX + 6, yBar + 6);
        this.edgesGfx.moveTo(midX - 6, yBar + 6); this.edgesGfx.lineTo(midX + 6, yBar - 6);
        this.edgesGfx.strokePath();
      }
    }
    // 节点着色（五态，迁移自 CourtPanel.refresh）
    for (const n of this.policyNodes) {
      const def = n.def;
      const isAdopted = adopted.has(def.id);
      const blocking = (def.mutuallyExclusive ?? []).filter(ex => adopted.has(ex));
      const mutexLocked = !isAdopted && blocking.length > 0;
      const missing = def.prerequisites.filter(p => !adopted.has(p));
      const prereqMissing = !isAdopted && !mutexLocked && missing.length > 0;
      const affordable = canAfford(resources, def.cost);
      let fill: number; let alpha = 0.95; let nameColor: string = COLORS_HEX.PAPER;
      if (isAdopted) { fill = COLORS.STONE_GREEN; }
      else if (mutexLocked) { fill = COLORS.CINNABAR; alpha = 0.45; nameColor = '#8A6E3E'; } // GOLD_DIM
      else if (prereqMissing) { fill = COLORS.ASH; alpha = 0.55; nameColor = '#E6DCC3'; } // PAPER_DIM
      else if (!affordable) { fill = COLORS.WOOD_LIGHT; alpha = 0.7; nameColor = '#E6DCC3'; } // PAPER_DIM
      else { fill = COLORS.GOLD_DIM; }
      const x = n.cx - NODE_W / 2; const y = n.cy - NODE_H / 2;
      n.box.clear();
      n.box.fillStyle(fill, alpha);
      n.box.fillRect(x, y, NODE_W, NODE_H);
      n.box.lineStyle(isAdopted ? 2 : 1, isAdopted ? COLORS.GOLD : COLORS.GOLD_DIM, 1);
      n.box.strokeRect(x, y, NODE_W, NODE_H);
      // 已采纳显 ✓ 前缀（一眼看出哪些点过了，修截图反馈"静态看不出已采纳"）；互斥已锁显 ⊘。
      const mark = isAdopted ? '✓ ' : (mutexLocked ? '⊘ ' : '');
      n.label.setText(mark + def.name).setColor(nameColor);
    }
  }

  private refreshDecrees(): void {
    const resources = this.store.getResources();
    const active = this.store.getActiveDecrees();
    const completedSet = new Set(this.store.getCompletedDecreeIds());
    for (const c of this.decreeCards) {
      const def = c.def;
      const act = active.find(a => a.id === def.id);
      const completed = completedSet.has(def.id);
      const chainLocked = !!def.chainPrev && !completedSet.has(def.chainPrev) && !act && !completed;
      const stage0 = def.stages[0];
      const affordable = stage0 ? canAfford(resources, stage0.cost) : false;
      let fill: number = COLORS.GOLD_DIM; let alpha = 0.95;
      let nameColor: string = COLORS_HEX.PAPER; let statusColor: string = COLORS_HEX.PAPER_DIM; let statusText: string;
      let curStage = -1; let stagePct = 0;
      if (act) {
        const stage = def.stages[act.currentStage];
        const stageDays = stage?.days ?? 0;
        const stalled = stageDays > 0 && act.daysElapsed > stageDays;
        curStage = act.currentStage;
        if (stalled) { fill = COLORS.CINNABAR; statusText = `第${act.currentStage + 1}阶 · 资源不足停滞`; statusColor = '#E6DCC3'; } // PAPER_DIM
        else {
          fill = COLORS.STONE_GREEN;
          stagePct = stageDays > 0 ? Math.min(100, Math.floor((act.daysElapsed / stageDays) * 100)) : 100;
          statusText = `第${act.currentStage + 1}阶 · ${act.daysElapsed}/${stageDays}日 (${stagePct}%)`;
        }
      } else if (completed) {
        fill = COLORS.ASH; alpha = 0.5; nameColor = '#4A7C59'; statusColor = '#4A7C59'; // STONE_GREEN
        statusText = '✓ 已颁行 永久生效'; curStage = def.stages.length;
      } else if (chainLocked) {
        fill = COLORS.WOOD; alpha = 0.55; nameColor = '#E6DCC3'; statusColor = '#8A6E3E';
        const prev = def.chainPrev ? this.store.getDecrees().find(d => d.id === def.chainPrev) : null;
        statusText = prev ? `待「${prev.name}」颁成` : '前置未成';
      } else if (!stage0) {
        fill = COLORS.ASH; alpha = 0.5; nameColor = '#E6DCC3'; statusText = '数据缺失';
      } else if (!affordable) {
        fill = COLORS.WOOD_LIGHT; alpha = 0.7; nameColor = '#E6DCC3';
        statusText = `首阶 ${formatCost(stage0.cost)} · 资源不足`;
      } else {
        statusText = `首阶 ${formatCost(stage0.cost)} · ${stage0.days}日`;
      }
      c.box.clear();
      c.box.fillStyle(fill, alpha);
      c.box.fillRect(c.cx, c.cy, CARD_W, CARD_H);
      c.box.lineStyle(1, COLORS.GOLD_DIM, 1);
      c.box.strokeRect(c.cx, c.cy, CARD_W, CARD_H);
      c.label.setColor(nameColor);
      c.status.setText(statusText).setColor(statusColor);
      // 多阶进度格（底部）：已过阶满格、当前阶按百分比、未到阶空格
      c.pips.clear();
      const n = def.stages.length;
      if (n > 0) {
        const pipW = (CARD_W - 20 - (n - 1) * 4) / n;
        const pipY = c.cy + CARD_H - 12;
        for (let i = 0; i < n; i++) {
          const px = c.cx + 10 + i * (pipW + 4);
          c.pips.fillStyle(COLORS.WOOD, 0.7);
          c.pips.fillRect(px, pipY, pipW, 5);
          let filled = 0;
          if (i < curStage) filled = 1;
          else if (i === curStage && act) filled = stagePct / 100;
          if (filled > 0) {
            c.pips.fillStyle(COLORS.GOLD, 1);
            c.pips.fillRect(px, pipY, Math.floor(pipW * filled), 5);
          }
        }
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    // 防御：即便未走 close() 直接被拆解（场景重启），也复位地图交互标志，避免地图永久卡死。
    registrySet(this.scene.registry, REGISTRY_KEYS.treePanelOpen, false);
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.POLICY_ADOPTED, this.onPolicyAdopted);
    this.store.off(STATE_EVENTS.DECREE_ADOPTED, this.onDecreeChanged);
    this.store.off(STATE_EVENTS.DECREE_ADVANCED, this.onDecreeChanged);
    this.store.off(STATE_EVENTS.DECREE_COMPLETED, this.onDecreeChanged);
    this.store.off(STATE_EVENTS.DECREE_STALLED, this.onDecreeChanged);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onPolicyAdopted);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.scene.input.off('wheel', this.onWheel, this);
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.onEsc, this);
    if (this.holdsPause) { this.store.releasePause(PolicyTreePanel.PAUSE_HOLDER); this.holdsPause = false; }
    this.container.destroy(true);
  }

  // ---------- 测试 hooks ----------
  getCurrentTab(): Tab { return this.currentTab; }
  switchTo(tab: Tab): void { this.setTab(tab); }
  clickPolicyByIndex(i: number): void { const n = this.policyNodes[i]; if (n) this.handlePolicyClick(n.def); }
  clickDecreeByIndex(i: number): void { const c = this.decreeCards[i]; if (c) this.handleDecreeClick(c.def); }
  policyCount(): number { return this.policyNodes.length; }
  decreeCount(): number { return this.decreeCards.length; }
}
