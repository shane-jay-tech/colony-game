import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS, UI } from './palette';
import { REGISTRY_KEYS, registryGet } from './registry';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { BuildMode } from '../state/buildMode';
import { BUILDINGS } from '../data/buildings';
import { canAfford } from '../data/resourceRegistry';
import type { BuildingDef } from '../data/schema';
import { drawDecorativePanelFrame } from './panelDecoration';
import { PANEL_COLLAPSED_WIDTH } from '../render/MapRenderer';

/**
 * BuildPanel：左侧建造列表。
 *
 * Slice E 简化设计：纯按钮列表（中文名 + 资源消耗 + tier 标记）。
 * 按钮颜色随"资源是否足够"变化：金=可建，灰=资源不足。
 * 点击按钮 → BuildMode.select(def)；再次点同一个 → cancel。
 *
 * 注：tier 2/3 的 upgradeRequires (国策/前置建筑)校验留到 Slice F——
 * Slice E 暂时所有建筑都列出来，让玩家可以选；点击后 placeBuilding
 * 时会被 canPlace 内部的资源/边界拒掉。
 */

interface ButtonRow {
  def: BuildingDef;
  bg: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  costLabel: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  thumb: Phaser.GameObjects.Image | null; // 建筑缩略图（缺贴图时 null）
}

const TOOLTIP_WIDTH = 280;
const TOOLTIP_PADDING = 12;
const TOOLTIP_GAP_FROM_PANEL = 8;

export class BuildPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly buildMode: BuildMode;
  private container: Phaser.GameObjects.Container;
  private bgGfx: Phaser.GameObjects.Graphics;
  private titleText: Phaser.GameObjects.Text;
  private rows: ButtonRow[] = [];
  private offBuildModeChange: () => void;

  // v0.9 折叠/展开（用户原话「如果非要重合，加折叠展开按钮」）
  // 折叠态下面板缩成 28px 竖条 + 中央 toggle 按钮 + 竖向"建\n造"标题
  private collapseBg: Phaser.GameObjects.Graphics;
  private collapseLabel: Phaser.GameObjects.Text;
  private collapseZone: Phaser.GameObjects.Zone;
  private rowsFadeTween: Phaser.Tweens.Tween | null = null;
  // 拆除工具 toggle（Anno 式：激活后点建筑即拆，不用先点开建筑）
  private demolishGfx!: Phaser.GameObjects.Graphics;
  private demolishLabel!: Phaser.GameObjects.Text;
  private demolishZone!: Phaser.GameObjects.Zone;
  private demolishRect: { x: number; y: number; w: number; h: number } | null = null;

  // v0.9 滚动（用户原话「建造和朝堂还有超出页面范围的，可以如果太多了可以上下滑动」）
  // 用一个 GeometryMask 矩形把 row 区域裁出来，row 的 y 加上 -rowsScrollY 即得到滚动效果。
  // wheel 命中区域 = rowsAreaRect；超出范围 clamp，避免把 row 滚到看不见。
  private rowsMaskGfx: Phaser.GameObjects.Graphics | null = null;
  private rowsMask: Phaser.Display.Masks.GeometryMask | null = null;
  private rowsAreaRect: { x: number; y: number; w: number; h: number } | null = null;
  private rowsScrollY = 0;
  /** 滚动条提示（窄金色条，仅 contentH > visibleH 时显示） */
  private scrollbarGfx: Phaser.GameObjects.Graphics | null = null;

  // J-1 修缺陷 #7：建筑无说明 → 鼠标悬停时显示 tooltip
  // 写在独立 container 而不是 panel container，避免被裁剪/盖住
  private tooltipContainer: Phaser.GameObjects.Container;
  private tooltipBg: Phaser.GameObjects.Graphics;
  private tooltipNameText: Phaser.GameObjects.Text;
  private tooltipDescText: Phaser.GameObjects.Text;
  private tooltipFlavorText: Phaser.GameObjects.Text;
  private hoveredDef: BuildingDef | null = null;

  private onResources = (): void => this.refreshAffordance();
  // 分阶段：建成建筑 / 采纳国策可能解锁新建筑 → 重排显示（layout 末尾会调 refreshAffordance）。
  private onUnlock = (): void => this.layout();
  private onReplaced = (): void => {
    this.refreshAffordance();
    // 读档可能换了折叠态，重排
    this.layout();
  };
  private onPanelCollapsed = (...args: unknown[]): void => {
    const payload = args[0] as { side: 'left' | 'right'; collapsed: boolean } | undefined;
    if (!payload || payload.side !== 'left') return;
    // 折叠时立刻隐藏 row（视觉上面板瞬间收窄），展开时 row 用 alpha 淡入
    if (!payload.collapsed) this.beginExpandFade();
    this.layout();
  };

  constructor(scene: Phaser.Scene, store: GameStore, buildMode: BuildMode) {
    this.scene = scene;
    this.store = store;
    this.buildMode = buildMode;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.titleText = scene.add.text(0, 0, '建造', {
      ...FONTS.panelHeading,
      color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    // v0.9：折叠/展开 toggle 按钮（左面板：◀ 折叠/▶ 展开）
    this.collapseBg = scene.add.graphics();
    this.collapseLabel = scene.add.text(0, 0, '◀', {
      ...FONTS.body,
      color: '#F5ECD7',
      fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.collapseZone = scene.add.zone(0, 0, 22, 22).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    this.collapseZone.on('pointerdown', () => {
      const cur = this.store.getPanelCollapsed('left');
      this.store.setPanelCollapsed('left', !cur);
    });
    this.container.add([this.collapseBg, this.collapseLabel, this.collapseZone]);

    // 拆除工具 toggle 按钮（标题下、列表上方一行）
    this.demolishGfx = scene.add.graphics();
    this.demolishLabel = scene.add.text(0, 0, '拆除工具', {
      ...FONTS.body,
      color: COLORS_HEX.CINNABAR,
      fontSize: '14px',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.demolishZone = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.demolishZone.on('pointerdown', () => {
      if (this.buildMode.isDemolish()) this.buildMode.cancel();
      else this.buildMode.enterDemolish();
    });
    this.container.add([this.demolishGfx, this.demolishLabel, this.demolishZone]);

    // v0.9 滚动：创建 row 区域的 GeometryMask（layout 时刷新矩形位置/大小）
    this.rowsMaskGfx = scene.add.graphics().setVisible(false);
    this.rowsMask = this.rowsMaskGfx.createGeometryMask();
    this.scrollbarGfx = scene.add.graphics();
    this.container.add(this.scrollbarGfx);

    // J-1 缺陷 #7：tooltip container（独立 depth=1100 显示在 panel 之上、模态之下）
    this.tooltipContainer = scene.add.container(0, 0).setScrollFactor(0).setDepth(1100);
    this.tooltipContainer.setVisible(false);
    this.tooltipBg = scene.add.graphics();
    this.tooltipNameText = scene.add.text(0, 0, '', {
      ...FONTS.body,
      color: '#C9A84C',
      fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.tooltipDescText = scene.add.text(0, 0, '', {
      ...FONTS.small,
      color: '#F5ECD7',
      wordWrap: { width: TOOLTIP_WIDTH - TOOLTIP_PADDING * 2 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.tooltipFlavorText = scene.add.text(0, 0, '', {
      ...FONTS.small,
      color: '#E6DCC3',
      fontStyle: 'italic',
      wordWrap: { width: TOOLTIP_WIDTH - TOOLTIP_PADDING * 2 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.tooltipContainer.add([
      this.tooltipBg,
      this.tooltipNameText,
      this.tooltipDescText,
      this.tooltipFlavorText,
    ]);

    this.buildRows();
    this.layout();
    this.refreshAffordance();

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.onUnlock);
    store.on(STATE_EVENTS.POLICY_ADOPTED, this.onUnlock);
    store.on(STATE_EVENTS.BUILDING_REMOVED, this.onUnlock);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onUnlock);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    store.on(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.offBuildModeChange = buildMode.onChange(() => { this.refreshAffordance(); this.refreshDemolishToggle(); });

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
    if (this.store.getPanelCollapsed('left')) return;
    const r = this.rowsAreaRect;
    if (pointer.x < r.x || pointer.x > r.x + r.w) return;
    if (pointer.y < r.y || pointer.y > r.y + r.h) return;
    // 与 layout 的可见性口径一致（含 grade_locked 灰显行），否则滚动高度算少、灰行滚不到底。
    const visibleCount = this.rows.filter(row => this.store.getBuildingUnlockInfo(row.def).state !== 'prereq_locked').length;
    const contentH = visibleCount * 48; // rowH + rowGap，按可见行数算
    const maxScroll = Math.max(0, contentH - r.h);
    if (maxScroll <= 0) return;
    const next = Math.max(0, Math.min(maxScroll, this.rowsScrollY + dy * 0.5));
    if (next === this.rowsScrollY) return;
    this.rowsScrollY = next;
    this.layout();
  };

  private beginExpandFade(): void {
    if (this.rowsFadeTween) { this.rowsFadeTween.stop(); this.rowsFadeTween = null; }
    // 立刻把 row alpha 拉低，layout 后再 tween 到 1（layout 会把 alpha 设回 1，这里覆盖一次）
    for (const r of this.rows) {
      r.bg.setAlpha(0);
      r.nameLabel.setAlpha(0);
      r.costLabel.setAlpha(0);
      r.thumb?.setAlpha(0);
    }
    this.rowsFadeTween = this.scene.tweens.add({
      targets: this.rows.flatMap(r => (r.thumb ? [r.bg, r.nameLabel, r.costLabel, r.thumb] : [r.bg, r.nameLabel, r.costLabel])),
      alpha: 1,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => { this.rowsFadeTween = null; },
    });
  }

  private buildRows(): void {
    for (const def of BUILDINGS) {
      const bg = this.scene.add.graphics();
      const stage = def.tierName ?? `T${def.tier}`;
      const nameLabel = this.scene.add.text(0, 0, `${def.name} · ${stage}`, {
        ...FONTS.body,
        color: '#F5ECD7',
        fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const costLabel = this.scene.add.text(0, 0, this.formatCost(def), {
        ...FONTS.small,
        color: '#E6DCC3',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const zone = this.scene.add.zone(0, 0, UI.buildPanelWidth - 16, 44).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onRowClick(def));
      // J-1 缺陷 #7：hover 进入显示 tooltip，pointerout 隐藏
      zone.on('pointerover', () => this.showTooltip(def, zone));
      zone.on('pointerout', () => this.hideTooltip(def));
      // 建筑缩略图（纪元式图标）：有贴图才建；缺图则 null（行只显文字）
      let thumb: Phaser.GameObjects.Image | null = null;
      if (this.scene.textures.exists(def.assetKey)) {
        thumb = this.scene.add.image(0, 0, def.assetKey).setOrigin(0, 0.5);
        this.container.add(thumb);
        if (this.rowsMask) thumb.setMask(this.rowsMask);
      }
      this.container.add([bg, nameLabel, costLabel, zone]);
      // v0.9 滚动：把 row 的渲染层（bg + 两个 text）挂到 mask；zone 不可见无需 mask
      if (this.rowsMask) {
        bg.setMask(this.rowsMask);
        nameLabel.setMask(this.rowsMask);
        costLabel.setMask(this.rowsMask);
      }
      this.rows.push({ def, bg, nameLabel, costLabel, zone, thumb });
    }
  }

  private showTooltip(def: BuildingDef, zone: Phaser.GameObjects.Zone): void {
    this.hoveredDef = def;
    // 内容
    const stageLabel = def.tierName ? `${def.tierName}（T${def.tier}）` : `T${def.tier}`;
    this.tooltipNameText.setText(`${def.name}　·　${stageLabel}　·　${def.category}`);
    const lines: string[] = [];
    lines.push(def.descPlain);
    lines.push('');
    lines.push(`造价：${this.formatCost(def)}`);
    if (def.upgradeRequires.length > 0) {
      lines.push(`需先：${def.upgradeRequires.join('、')}`);
    }
    if (def.constructionTime > 0) {
      lines.push(`工期：${def.constructionTime} 日`);
    }
    if (def.output.length > 0) {
      const labelMap: Record<string, string> = {
        grain: '粮', wood: '木', stone: '石', gold: '钱', people: '民',
        cloth: '布', bronze: '铜', rite: '礼',
      };
      const out = def.output.map((o) => `${labelMap[o.resource] ?? o.resource}+${o.perDay}/日`).join('、');
      lines.push(`产出：${out}`);
    }
    if (def.upkeep && Object.keys(def.upkeep).length > 0) {
      const labelMap: Record<string, string> = {
        grain: '粮', wood: '木', stone: '石', gold: '钱', people: '民',
        cloth: '布', bronze: '铜', rite: '礼',
      };
      const up = Object.entries(def.upkeep)
        .filter(([, v]) => v && v > 0)
        .map(([k, v]) => `${labelMap[k] ?? k}${v}/日`).join('、');
      if (up) lines.push(`维护：${up}`);
    }
    this.tooltipDescText.setText(lines.join('\n'));
    this.tooltipFlavorText.setText(def.description ? `「${def.description}」` : '');

    // 位置：右贴 panel，纵向跟随 hovered row
    const panelRight = 8 + UI.buildPanelWidth;
    const tipX = panelRight + TOOLTIP_GAP_FROM_PANEL;

    const padInner = TOOLTIP_PADDING;
    const nameH = this.tooltipNameText.height;
    const descH = this.tooltipDescText.height;
    const flavorH = this.tooltipFlavorText.height;
    const blockH = padInner + nameH + 6 + descH + (flavorH > 0 ? 8 + flavorH : 0) + padInner;

    // 纵向：尝试与 row 顶对齐；超过窗口底则上挪
    let tipY = zone.y;
    const sceneH = this.scene.scale.height;
    if (tipY + blockH > sceneH - 8) {
      tipY = Math.max(8, sceneH - 8 - blockH);
    }
    if (tipY < 8) tipY = 8;

    // 画 tooltip 背景（木色 + 金边）
    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(COLORS.WOOD, 0.95);
    this.tooltipBg.fillRect(tipX, tipY, TOOLTIP_WIDTH, blockH);
    this.tooltipBg.lineStyle(2, COLORS.GOLD_DIM, 1);
    this.tooltipBg.strokeRect(tipX, tipY, TOOLTIP_WIDTH, blockH);
    this.tooltipBg.lineStyle(1, COLORS.GOLD, 0.6);
    this.tooltipBg.strokeRect(tipX + 3, tipY + 3, TOOLTIP_WIDTH - 6, blockH - 6);

    this.tooltipNameText.setPosition(tipX + padInner, tipY + padInner);
    this.tooltipDescText.setPosition(tipX + padInner, tipY + padInner + nameH + 6);
    this.tooltipFlavorText.setPosition(
      tipX + padInner,
      tipY + padInner + nameH + 6 + descH + 8,
    );

    this.tooltipContainer.setVisible(true);
  }

  private hideTooltip(def: BuildingDef): void {
    if (this.hoveredDef === def) {
      this.hoveredDef = null;
      this.tooltipContainer.setVisible(false);
    }
  }

  private formatCost(def: BuildingDef): string {
    const parts: string[] = [];
    const labelMap: Record<string, string> = {
      grain: '粮', wood: '木', stone: '石', gold: '钱',
      cloth: '布', bronze: '铜', rite: '礼',
    };
    for (const [k, v] of Object.entries(def.cost)) {
      if (k === 'people') continue; // 民不消耗，下面单独显示"占劳"
      if (v && v > 0) parts.push(`${labelMap[k] ?? k}${v}`);
    }
    const laborN = def.cost.people ?? 0;
    if (laborN > 0) parts.push(`占劳${laborN}`); // 占用劳力（借用，非消耗）
    return parts.length > 0 ? parts.join(' · ') : '免费';
  }

  layout(): void {
    // 窗口缩放时若 tooltip 正在显示，先隐藏（位置可能失效，下次 hover 会重算）
    if (this.tooltipContainer.visible) {
      this.tooltipContainer.setVisible(false);
      this.hoveredDef = null;
    }

    const collapsed = this.store.getPanelCollapsed('left');
    const w = collapsed ? PANEL_COLLAPSED_WIDTH : UI.buildPanelWidth;
    const top = UI.topbarHeight + UI.toolbarHeight + 8; // 2026-06-19：让出主功能工具栏一行
    const x = 8;
    const h = this.scene.scale.height - top - 8;

    this.bgGfx.clear();
    // 折叠态用更简化的边框（双线无角铜，宽度太窄塞不下铆钉链）；展开态保持完整装饰
    if (collapsed) {
      this.bgGfx.fillStyle(COLORS.WOOD, 0.95);
      this.bgGfx.fillRect(x, top, w, h);
      this.bgGfx.lineStyle(2, COLORS.GOLD_DIM, 1);
      this.bgGfx.strokeRect(x, top, w, h);
      this.bgGfx.lineStyle(1, COLORS.GOLD, 0.6);
      this.bgGfx.strokeRect(x + 2, top + 2, w - 4, h - 4);
    } else {
      drawDecorativePanelFrame(this.bgGfx, x, top, w, h, 'right');
    }

    // 标题：展开 = 横排「建造」左上角；折叠 = 居中竖排（'建\n造'）
    if (collapsed) {
      this.titleText.setText('建\n造');
      this.titleText.setOrigin(0.5, 0);
      this.titleText.setPosition(x + w / 2, top + 36);
      this.titleText.setLineSpacing(2);
    } else {
      this.titleText.setText('建造');
      this.titleText.setOrigin(0, 0);
      this.titleText.setPosition(x + 12, top + 10);
      this.titleText.setLineSpacing(0);
    }

    // 折叠/展开按钮位置：
    //   展开态 → 顶部右上角（不挡 row）
    //   折叠态 → 顶部居中（28px 窄条里只能居中）
    const btnSize = 22;
    const btnX = collapsed
      ? x + Math.floor((w - btnSize) / 2)
      : x + w - btnSize - 8;
    const btnY = top + 8;
    this.collapseZone.setPosition(btnX, btnY).setSize(btnSize, btnSize);
    this.collapseBg.clear();
    this.collapseBg.fillStyle(COLORS.GOLD_DIM, 0.85);
    this.collapseBg.fillRect(btnX, btnY, btnSize, btnSize);
    this.collapseBg.lineStyle(1, COLORS.GOLD, 1);
    this.collapseBg.strokeRect(btnX, btnY, btnSize, btnSize);
    this.collapseLabel.setText(collapsed ? '▶' : '◀');
    this.collapseLabel.setPosition(btnX + btnSize / 2, btnY + btnSize / 2);

    // 拆除工具按钮（展开态：标题下方一行；折叠态隐藏）
    const DEMOLISH_H = 26;
    if (collapsed) {
      this.demolishGfx.setVisible(false);
      this.demolishLabel.setVisible(false);
      this.demolishZone.setVisible(false);
      this.demolishRect = null;
    } else {
      const dy = top + 40;
      const dx = x + 8;
      const dw = w - 16;
      this.demolishRect = { x: dx, y: dy, w: dw, h: DEMOLISH_H };
      this.demolishZone.setPosition(dx, dy).setSize(dw, DEMOLISH_H).setVisible(true);
      this.demolishLabel.setPosition(dx + dw / 2, dy + DEMOLISH_H / 2).setVisible(true);
      this.demolishGfx.setVisible(true);
      this.refreshDemolishToggle();
    }

    // v0.9 滚动：定义 row 可视区域（标题+工具按钮下方到面板底部 - 8 边距）
    const rowsAreaTop = top + 40 + DEMOLISH_H + 6;
    const rowsAreaBottom = top + h - 8;
    const rowsAreaH = Math.max(0, rowsAreaBottom - rowsAreaTop);
    this.rowsAreaRect = collapsed ? null : { x: x + 8, y: rowsAreaTop, w: w - 16, h: rowsAreaH };

    // 重画 mask 矩形
    if (this.rowsMaskGfx && !collapsed) {
      this.rowsMaskGfx.clear();
      this.rowsMaskGfx.fillStyle(0xffffff, 1);
      this.rowsMaskGfx.fillRect(x + 8, rowsAreaTop, w - 16, rowsAreaH);
    } else if (this.rowsMaskGfx) {
      this.rowsMaskGfx.clear();
    }

    // clamp scroll：内容比可视区短就归零，避免折叠/缩放导致 row 被滚到看不见
    const rowH = 44;
    const rowGap = 4;
    // 显示"可建 + 仅差国格(灰显提示)"，只隐藏前置未满足的（prereq_locked）。
    const visibleRowCount = this.rows.filter(row => this.store.getBuildingUnlockInfo(row.def).state !== 'prereq_locked').length;
    const contentH = visibleRowCount * (rowH + rowGap); // 按已解锁行数算，隐藏行不占滚动高度
    const maxScroll = Math.max(0, contentH - rowsAreaH);
    if (this.rowsScrollY > maxScroll) this.rowsScrollY = maxScroll;
    if (this.rowsScrollY < 0) this.rowsScrollY = 0;

    // 行：折叠时全部隐藏，展开时按 rowsScrollY 偏移
    let cursorY = rowsAreaTop - this.rowsScrollY;
    for (const row of this.rows) {
      // 分阶段：前置未满足的建筑隐藏且不占位；"仅差国格"的会灰显（见 refreshAffordance）。
      if (collapsed || this.store.getBuildingUnlockInfo(row.def).state === 'prereq_locked') {
        row.bg.setVisible(false);
        row.nameLabel.setVisible(false);
        row.costLabel.setVisible(false);
        row.zone.setVisible(false);
        row.thumb?.setVisible(false);
      } else {
        // 视觉层：始终 visible，由 mask 裁剪；交互层 zone：完全在可视区外才禁掉，
        // 否则裁剪后玩家点不到却仍触发 hover（DeepSeek nit）
        const ICON = 34;
        const textX = row.thumb ? x + 12 + ICON + 6 : x + 16;
        if (row.thumb) {
          const nw = (row.thumb.width as number) || ICON;
          const nh = (row.thumb.height as number) || ICON;
          row.thumb.setScale(ICON / Math.max(nw, nh)); // 等比缩进 ICON 见方
          row.thumb.setPosition(x + 12, cursorY + rowH / 2).setVisible(true);
        }
        row.bg.setVisible(true);
        row.nameLabel.setVisible(true);
        row.costLabel.setVisible(true);
        row.zone.setPosition(x + 8, cursorY).setSize(w - 16, rowH);
        row.nameLabel.setPosition(textX, cursorY + 6);
        row.costLabel.setPosition(textX, cursorY + 24);
        const fullyAbove = cursorY + rowH < rowsAreaTop;
        const fullyBelow = cursorY > rowsAreaBottom;
        row.zone.setVisible(!fullyAbove && !fullyBelow);
        cursorY += rowH + rowGap;
      }
    }

    // 滚动条提示：右侧 4px 金色条，仅 contentH > visibleH 时显示
    if (this.scrollbarGfx) {
      this.scrollbarGfx.clear();
      if (!collapsed && maxScroll > 0) {
        const sbW = 4;
        const sbX = x + w - sbW - 4;
        const trackY = rowsAreaTop;
        const trackH = rowsAreaH;
        const thumbH = Math.max(24, Math.floor(trackH * (rowsAreaH / contentH)));
        const thumbY = trackY + Math.floor((this.rowsScrollY / maxScroll) * (trackH - thumbH));
        this.scrollbarGfx.fillStyle(COLORS.WOOD, 0.5);
        this.scrollbarGfx.fillRect(sbX, trackY, sbW, trackH);
        this.scrollbarGfx.fillStyle(COLORS.GOLD, 0.85);
        this.scrollbarGfx.fillRect(sbX, thumbY, sbW, thumbH);
      }
    }

    if (!collapsed) this.refreshAffordance();
  }

  private onRowClick(def: BuildingDef): void {
    // 仅差国格的建筑不可选建，点了给提示（别让玩家以为没反应）。
    const info = this.store.getBuildingUnlockInfo(def);
    if (info.state === 'grade_locked') {
      registryGet(this.scene.registry, REGISTRY_KEYS.toast)
        ?.show?.(`${def.name}：${info.reason}方可营建`, 'info');
      return;
    }
    if (this.buildMode.getSelected() === def) {
      this.buildMode.cancel();
    } else {
      this.buildMode.select(def);
    }
  }

  /** 刷新拆除工具按钮视觉（激活=朱砂底，否则木底）。位置在 layout 里设。 */
  private refreshDemolishToggle(): void {
    if (!this.demolishRect) return;
    const r = this.demolishRect;
    const active = this.buildMode.isDemolish();
    this.demolishGfx.clear();
    this.demolishGfx.fillStyle(active ? COLORS.CINNABAR : COLORS.WOOD, active ? 0.9 : 0.85);
    this.demolishGfx.fillRect(r.x, r.y, r.w, r.h);
    this.demolishGfx.lineStyle(1.5, COLORS.CINNABAR, 1);
    this.demolishGfx.strokeRect(r.x, r.y, r.w, r.h);
    this.demolishLabel
      .setText(active ? '拆除中·点建筑拆（右键/ESC退）' : '拆除工具')
      .setColor(active ? '#F5ECD7' : COLORS_HEX.CINNABAR);
  }

  private refreshAffordance(): void {
    const resources = this.store.getResources();
    const selected = this.buildMode.getSelected();
    for (const row of this.rows) {
      const info = this.store.getBuildingUnlockInfo(row.def);
      // 前置未满足：已在 layout 隐藏，跳过。
      if (info.state === 'prereq_locked') continue;
      // 仅差国格：灰显 + 显示"需晋X"，不可建（让玩家明白国策已生效、还差国格）。
      if (info.state === 'grade_locked') {
        row.bg.clear();
        row.bg.fillStyle(COLORS.ASH, 0.4);
        row.bg.fillRect(row.zone.x, row.zone.y, row.zone.width, row.zone.height);
        row.bg.lineStyle(1, COLORS.GOLD_DIM, 0.5);
        row.bg.strokeRect(row.zone.x, row.zone.y, row.zone.width, row.zone.height);
        row.nameLabel.setColor('#8A8079');
        row.costLabel.setColor('#C9A84C').setText(info.reason);
        if (row.thumb) row.thumb.setAlpha(0.3);
        continue;
      }
      // 占用制：可建 = 材料(除民)够 且 闲置劳力 ≥ 该建筑占用数。
      const matCost = { ...row.def.cost };
      delete matCost.people;
      const affordable = canAfford(resources, matCost) && this.store.getIdleLabor() >= (row.def.cost.people ?? 0);
      const isSelected = selected === row.def;
      row.bg.clear();
      const fill = isSelected ? COLORS.GOLD : (affordable ? COLORS.WOOD_LIGHT : COLORS.ASH);
      const alpha = isSelected ? 0.95 : (affordable ? 0.85 : 0.5);
      row.bg.fillStyle(fill, alpha);
      row.bg.fillRect(row.zone.x, row.zone.y, row.zone.width, row.zone.height);
      row.bg.lineStyle(1, isSelected ? COLORS.GOLD : COLORS.GOLD_DIM, 1);
      row.bg.strokeRect(row.zone.x, row.zone.y, row.zone.width, row.zone.height);
      row.nameLabel.setColor(isSelected ? '#1A1410' : (affordable ? '#F5ECD7' : '#A89A8A'));
      // 从"灰显需国格"恢复为可建时，重置成本文案（grade_locked 改过 costLabel 文本）。
      row.costLabel.setColor(isSelected ? '#1A1410' : (affordable ? '#E6DCC3' : '#857B71')).setText(this.formatCost(row.def));
      if (row.thumb) row.thumb.setAlpha(isSelected || affordable ? 1 : 0.45); // 买不起的图标变暗
    }
  }

  destroy(): void {
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.onUnlock);
    this.store.off(STATE_EVENTS.POLICY_ADOPTED, this.onUnlock);
    this.store.off(STATE_EVENTS.BUILDING_REMOVED, this.onUnlock);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.store.off(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, this.onPanelCollapsed);
    this.scene.input.off('wheel', this.onWheel, this);
    if (this.rowsFadeTween) { this.rowsFadeTween.stop(); this.rowsFadeTween = null; }
    if (this.rowsMask) {
      this.rowsMask.destroy();
      this.rowsMask = null;
    }
    this.rowsMaskGfx?.destroy();
    this.rowsMaskGfx = null;
    this.offBuildModeChange();
    this.container.destroy(true);
    this.tooltipContainer.destroy(true);
  }
}
