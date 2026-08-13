import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { drawDecorativePanelFrame } from './panelDecoration';
import { formatRate } from '../state/productionSystem';
import { RESOURCE_LABEL } from './courtFormat';
import type { ResourceId } from '../data/resourceRegistry';
import { producersFor } from '../state/supplyChain';
import { BUILDINGS } from '../data/buildings';
import { getBuildingDef } from '../data/buildingRegistry';
import { populationFulfillment } from '../state/classNeeds';
import type { PopulationClass } from '../data/populationClass';

/**
 * 供需速率面板（中央模态）——P1 信息可视化第一件（2026-08-14）。
 *
 * 点 HUD 顶栏任一资源 token 打开。把「每种资源每天进多少、出多少、是盈是亏」一次讲清——
 * 生产面板即主战场（戴森球计划/纪元 1800 供需表启示），玩家从此不用靠猜。
 *
 * 行 = 7 种基础资源（粮/木/石/钱/布/铜/礼）+ 中间品（麻/锡）+ 名望；
 * 「民」不列此表（其出入见人口面板）。
 * 不暂停游戏；点关闭按钮 / 点面板外区关闭。文案半文半白、禁生僻偏字。
 * 销毁：UIScene.shutdown 调 .destroy()。
 */

const PANEL_WIDTH = 620;
const PANEL_HEIGHT = 640;

/** 面板行序：顶栏七资源 → 中间品 → 名望。 */
const ROW_IDS: ResourceId[] = ['grain', 'wood', 'stone', 'gold', 'cloth', 'bronze', 'rite', 'hemp', 'tin', 'influence'];

interface RateRowTexts {
  label: Phaser.GameObjects.Text;
  produced: Phaser.GameObjects.Text;
  consumed: Phaser.GameObjects.Text;
  net: Phaser.GameObjects.Text;
}

export class ProductionPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlayBg: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bgGfx: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly rows = new Map<ResourceId, RateRowTexts>();
  private readonly rowBgs = new Map<ResourceId, Phaser.GameObjects.Graphics>();
  private readonly footerText: Phaser.GameObjects.Text;
  /** P1-4：民足系数行（幸福度→产出折扣显性化，A2 引擎补呈现） */
  private readonly fulfillmentText: Phaser.GameObjects.Text;
  /** 补阙提示行：缺 X → 建哪栋 / 还差什么（最多 3 条） */
  private readonly hintTexts: Phaser.GameObjects.Text[] = [];
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeLabel: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private isOpen = false;
  private destroyed = false;

  private onResources = (): void => { if (this.isOpen) this.refresh(); };
  private onProductionTick = (): void => { if (this.isOpen) this.refresh(); };
  private onDayTick = (): void => { if (this.isOpen) this.refresh(); };
  private onReplaced = (): void => { if (this.isOpen) this.refresh(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    // 半透黑遮罩 + 点击外区关闭
    this.overlayBg = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.overlayZone.on('pointerdown', () => this.close());
    this.container.add([this.overlayBg, this.overlayZone]);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.titleText = scene.add.text(0, 0, '国计 · 每日出入', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.headerText = scene.add.text(0, 0, '资源　　　　　日产　　　　日耗　　　　净变', {
      ...FONTS.small, color: '#8A6E3E',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add([this.titleText, this.headerText]);

    for (const id of ROW_IDS) {
      const rowBg = scene.add.graphics();
      const label = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#F5ECD7',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const produced = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#4A7C59',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const consumed = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#B71C1C',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const net = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.rows.set(id, { label, produced, consumed, net });
      this.rowBgs.set(id, rowBg);
      this.container.add([rowBg, label, produced, consumed, net]);
    }

    this.footerText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.footerText);

    // P1-4：民足系数行
    this.fulfillmentText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.fulfillmentText);

    // 补阙提示行（缺什么 → 建什么 → 还差什么）
    for (let i = 0; i < 3; i++) {
      const t = scene.add.text(0, 0, '', {
        ...FONTS.small, color: '#E6DCC3',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.hintTexts.push(t);
      this.container.add(t);
    }

    // 关闭按钮
    this.closeBg = scene.add.graphics();
    this.closeLabel = scene.add.text(0, 0, '×', {
      ...FONTS.panelHeading, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.closeZone = scene.add.zone(0, 0, 28, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.close();
    });
    this.container.add([this.closeBg, this.closeLabel, this.closeZone]);

    this.layout();

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.PRODUCTION_TICK, this.onProductionTick);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
  }

  open(): void {
    if (this.destroyed || this.isOpen) return;
    this.isOpen = true;
    this.container.setVisible(true);
    this.layout();
    this.refresh();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.setVisible(false);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  isVisible(): boolean { return this.isOpen; }

  layout(): void {
    if (this.destroyed) return;
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;

    this.overlayBg.clear();
    this.overlayBg.fillStyle(0x000000, 0.55);
    this.overlayBg.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);

    const w = Math.min(PANEL_WIDTH, sw - 40);
    const h = Math.min(PANEL_HEIGHT, sh - 40);
    const x = Math.floor((sw - w) / 2);
    const y = Math.floor((sh - h) / 2);

    this.bgGfx.clear();
    drawDecorativePanelFrame(this.bgGfx, x, y, w, h, 'left');

    this.titleText.setPosition(x + 20, y + 16);

    const closeSize = 28;
    const closeX = x + w - closeSize - 14;
    const closeY = y + 14;
    this.closeZone.setPosition(closeX, closeY).setSize(closeSize, closeSize);
    this.closeBg.clear();
    this.closeBg.fillStyle(COLORS.CINNABAR, 0.9);
    this.closeBg.fillRect(closeX, closeY, closeSize, closeSize);
    this.closeBg.lineStyle(1, COLORS.GOLD, 1);
    this.closeBg.strokeRect(closeX, closeY, closeSize, closeSize);
    this.closeLabel.setPosition(closeX + closeSize / 2, closeY + closeSize / 2);

    this.headerText.setPosition(x + 24, y + 60);

    // 列锚点：名称列 / 日产列 / 日耗列 / 净变列
    const colName = x + 24;
    const colProduced = x + 210;
    const colConsumed = x + 350;
    const colNet = x + 500;

    let cy = y + 88;
    const rowH = 32;
    for (const id of ROW_IDS) {
      const bg = this.rowBgs.get(id)!;
      bg.clear();
      if ((ROW_IDS.indexOf(id) & 1) === 1) {
        bg.fillStyle(COLORS.WOOD, 0.55);
        bg.fillRect(x + 14, cy - 5, w - 28, rowH - 4);
      }
      const t = this.rows.get(id)!;
      t.label.setPosition(colName, cy);
      t.produced.setPosition(colProduced, cy);
      t.consumed.setPosition(colConsumed, cy);
      t.net.setPosition(colNet, cy);
      cy += rowH;
    }

    this.fulfillmentText.setPosition(x + 24, cy + 4);
    this.footerText.setPosition(x + 24, cy + 26);
    let hy = cy + 48;
    for (const t of this.hintTexts) {
      t.setPosition(x + 24, hy);
      hy += 22;
    }
  }

  private refresh(): void {
    if (this.destroyed) return;
    const rates = this.store.getDailyRates();
    const stock = this.store.getResources();
    const influenceCap = this.store.getInfluenceCap();
    const grade = this.store.getGrade();

    for (const id of ROW_IDS) {
      const t = this.rows.get(id)!;
      t.label.setText(RESOURCE_LABEL[id] ?? id);
      if (id === 'influence') {
        // 名望：随国格日产（grade+1/日，有上限），无日耗（花在宣传/斡旋/修史）
        const capRoom = Math.max(0, influenceCap - (stock.influence ?? 0));
        const produced = Math.min(grade + 1, capRoom);
        t.produced.setText('+' + formatRate(produced));
        t.consumed.setText('—');
        t.net.setText(formatRate(produced));
        t.net.setColor('#4A7C59');
        continue;
      }
      const row = rates[id];
      if (!row) {
        // 产耗双零：整行标灰，明示"这条链现在没动静"
        t.produced.setText('0');
        t.consumed.setText('0');
        t.net.setText('0');
        t.produced.setColor('#6D635B');
        t.consumed.setColor('#6D635B');
        t.net.setColor('#6D635B');
        continue;
      }
      t.produced.setText('+' + formatRate(row.produced));
      t.consumed.setText('-' + formatRate(row.consumed));
      const netText = (row.net > 0 ? '+' : '') + formatRate(row.net);
      t.net.setText(netText);
      // 净变配色：盈=石绿、亏=朱砂、平=灰（守 11 色板）
      t.net.setColor(row.net > 1e-9 ? '#4A7C59' : (row.net < -1e-9 ? '#B71C1C' : '#6D635B'));
      t.produced.setColor('#4A7C59');
      t.consumed.setColor('#B71C1C');
    }

    // 页脚：净亏资源点名（供"下一步"直觉）+ 民数说明
    const deficits: string[] = [];
    for (const id of ROW_IDS) {
      if (id === 'influence') continue;
      const row = rates[id];
      if (row && row.net < -1e-9) deficits.push(RESOURCE_LABEL[id] ?? id);
    }
    // P1-4：民足系数（阶层需求满足度 → 产出折扣，显性化）
    const factor = populationFulfillment(
      this.store.getPopulationClasses(),
      this.store.getBuildings(),
      stock,
    );
    if (factor >= 0.999) {
      this.fulfillmentText.setText('民足：十成力，各安其业，产出无损。');
      this.fulfillmentText.setColor('#4A7C59');
    } else {
      const gaps = this.store.getClassNeedsGaps();
      const classNames: Record<PopulationClass, string> = {
        farmer: '农', worker: '工', soldier: '兵', scholar: '士',
      };
      const gapParts: string[] = [];
      for (const cls of Object.keys(gaps) as PopulationClass[]) {
        if (gaps[cls] && gaps[cls]!.length > 0) gapParts.push(classNames[cls] + '缺' + gaps[cls]!.join('·'));
      }
      const pct = Math.round(factor * 100);
      const gapText = gapParts.length > 0 ? '（' + gapParts.join('、') + '）' : '';
      this.fulfillmentText.setText('民足：仅' + pct + '成力' + gapText + '——补其所需，产出自回。');
      this.fulfillmentText.setColor('#B71C1C');
    }

    const deficitLine = deficits.length > 0
      ? '眼下入不敷出：' + deficits.join('、') + '——须早作安排。'
      : '诸资源出入相抵，或有盈余，国计安稳。';
    this.footerText.setText(deficitLine + '（「民」之增减见人口面板）');
    this.footerText.setColor(deficits.length > 0 ? '#B71C1C' : '#4A7C59');

    // 补阙：对净亏最严重的 3 种资源，给出「建哪栋、还差什么」的因果链提示
    const deficitIds = ROW_IDS
      .filter(id => id !== 'influence' && rates[id] !== undefined && rates[id]!.net < -1e-9)
      .sort((a, b) => (rates[b]!.net - rates[a]!.net)) // 亏得越多越靠前
      .slice(0, 3);
    for (let i = 0; i < this.hintTexts.length; i++) {
      const t = this.hintTexts[i]!;
      const id = deficitIds[i];
      if (!id) { t.setText(''); continue; }
      t.setText(this.buildHintLine(id));
    }
  }

  /**
   * 因果链一行：『补布：桑园可建、织官需晋「邦国」』。
   * 只列 buildable（可建）与 grade_locked（还差国格）的产家；
   * 前置未满的产家按项目惯例不剧透（留白给探索）。
   */
  private buildHintLine(resource: ResourceId): string {
    const label = RESOURCE_LABEL[resource] ?? resource;
    const producers = producersFor(resource, BUILDINGS);
    const parts: string[] = [];
    for (const p of producers.slice(0, 3)) {
      const def = getBuildingDef(p.defId);
      if (!def) continue;
      const info = this.store.getBuildingUnlockInfo(def);
      if (info.state === 'buildable') parts.push(p.name + '可建');
      else if (info.state === 'grade_locked') parts.push(p.name + info.reason);
    }
    const tail = parts.length > 0 ? parts.join('、') : '可与邻邦通商，或以事件补之';
    return '补' + label + '：' + tail;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.PRODUCTION_TICK, this.onProductionTick);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.container.destroy(true);
  }
}
