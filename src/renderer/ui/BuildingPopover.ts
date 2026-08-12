import Phaser from 'phaser';
import type { BuildingInstance, BuildingDef } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';
import { getBuildingDef } from '../data/buildingRegistry';
import { GameStore, STATE_EVENTS } from '../state/gameStore';
import { computeAdjacencyMul } from '../state/productionSystem';
import { COLORS, COLORS_HEX, FONTS } from './palette';
import { drawDecorativePanelFrame } from './panelDecoration';
import type { Toast } from './Toast';

/**
 * v0.9 Pillar 2.4：建筑升级 popover。
 *
 * 玩家点击地图上一栋已建建筑 → 弹出小卡片：
 *   - 标题：建筑名 + 当前 Tier
 *   - 描述：descPlain（一两行）
 *   - 升级行：若 def.upgradesTo 存在 → 「升级到 <名字>」按钮 + 资源/前置摘要
 *     - 资源够 + 前置满足 → 金边按钮，点击触发 store.upgradeBuilding
 *     - 资源不足或前置缺 → 灰按钮 + 下面给一行红字解释
 *   - 关闭：右上角 × 或 ESC 或点 popover 外
 *
 * 不重复 BuildPanel 的样式：用同一份 panelDecoration（双线 + 铜角 + 不画铆钉）。
 * 资源不够时按钮变灰但仍可点（点击给 toast，不闪烁）；前置未满足时按钮直接禁用。
 */

const POPOVER_W = 280;
const POPOVER_PAD = 14;
const TITLE_H = 26;
const DESC_LINE_H = 18;
const BUTTON_H = 36;
const ROW_GAP = 8;
const DEPTH = 1100; // 高于 panel(900)、低于 EventModal(1500)/Toast(2000)

/** 资源中文名（与 HUD 同一份；本地保留以避免循环 import） */
const RES_LABEL: Record<ResourceId, string> = {
  grain: '粮',
  wood: '木',
  stone: '石',
  gold: '钱',
  cloth: '布',
  bronze: '铜',
  rite: '礼器',
  people: '民',
  hemp: '麻',
  tin: '锡',
};

/** v1.0 #4：阶段名 fallback——若 def.tierName 缺，回退到「茅屋/瓦房/殿宇」三档 */
const TIER_FALLBACK: Record<number, string> = { 1: '茅屋', 2: '瓦房', 3: '殿宇' };
function tierStageName(def: BuildingDef): string {
  return def.tierName ?? TIER_FALLBACK[def.tier] ?? `T${def.tier}`;
}

export class BuildingPopover {
  private scene: Phaser.Scene;
  private store: GameStore;
  private toast: Toast | null;

  private container: Phaser.GameObjects.Container | null = null;
  private bg: Phaser.GameObjects.Graphics | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private descText: Phaser.GameObjects.Text | null = null;
  private hintText: Phaser.GameObjects.Text | null = null;
  private upgradeBtnZone: Phaser.GameObjects.Zone | null = null;
  private upgradeBtnGfx: Phaser.GameObjects.Graphics | null = null;
  private upgradeBtnLabel: Phaser.GameObjects.Text | null = null;
  private closeZone: Phaser.GameObjects.Zone | null = null;
  private closeText: Phaser.GameObjects.Text | null = null;

  private currentInstance: BuildingInstance | null = null;
  private outsideClickHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private escHandler: (() => void) | null = null;
  private upgradedListener: (...args: unknown[]) => void;
  private adjacencyTexts: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene, store: GameStore, toast: Toast | null) {
    this.scene = scene;
    this.store = store;
    this.toast = toast;
    this.upgradedListener = (...args: unknown[]): void => {
      const payload = args[0] as { instance?: BuildingInstance } | undefined;
      if (!payload?.instance) return;
      // 当前展示的建筑刚升级完 → 关闭，让玩家看到金边脉冲
      if (this.currentInstance && payload.instance === this.currentInstance) this.hide();
    };
    this.store.on(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener);
    // 不再监听 RESOURCES_CHANGED 重绘：产出每 tick 变 → 每 tick hide+show 造成弹窗漂移+闪烁。
    // 弹窗改为开启时画一次快照；升级能否点在点击时由 upgradeBuilding 重新校验，不影响功能。
  }

  /** 是否正在显示（GameScene handlePointerDown 用来防误关） */
  isVisible(): boolean {
    return this.container !== null;
  }

  show(instance: BuildingInstance, anchorScreenX: number, anchorScreenY: number): void {
    this.hide();
    const def = getBuildingDef(instance.defId);
    if (!def) return;
    this.currentInstance = instance;

    // 估算高度：title + desc(≤3 行) + (相邻加成行) + 升级行（若有）+ hint + padding
    const descLines = wrapText(def.descPlain, 28);
    const descLineCount = Math.min(3, descLines.length);
    // v1.0 #3：算当前激活的相邻加成（依次扫描 def.output 每种资源）
    const activeAdj = this.computeActiveAdjacency(instance, def);
    const adjacencyRowH = activeAdj.length > 0 ? DESC_LINE_H * activeAdj.length + ROW_GAP : 0;
    const upgradeRowH = def.upgradesTo ? BUTTON_H + ROW_GAP : 0;
    const hintH = def.upgradesTo ? DESC_LINE_H : 0;
    const totalH =
      POPOVER_PAD * 2 + TITLE_H + ROW_GAP + descLineCount * DESC_LINE_H + adjacencyRowH + ROW_GAP + upgradeRowH + hintH;

    // 锚到点击位置上方；越界则贴边
    const { px, py } = this.computePos(anchorScreenX, anchorScreenY, totalH);

    this.container = this.scene.add.container(px, py).setScrollFactor(0).setDepth(DEPTH);

    // 背景框（双线 + 铜角，不画铆钉——popover 不挂边，铆钉无意义）
    this.bg = this.scene.add.graphics();
    drawDecorativePanelFrame(this.bg, 0, 0, POPOVER_W, totalH, 'right');
    this.container.add(this.bg);

    // 标题
    this.titleText = this.scene.add
      .text(POPOVER_PAD, POPOVER_PAD, `${def.name} · ${tierStageName(def)}（T${def.tier}）`, {
        ...FONTS.panelHeading,
        color: COLORS_HEX.GOLD,
      } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.titleText);

    // 关闭按钮（右上角 ×）
    const closeX = POPOVER_W - POPOVER_PAD - 4;
    const closeY = POPOVER_PAD - 2;
    this.closeText = this.scene.add
      .text(closeX, closeY, '×', {
        ...FONTS.panelHeading,
        color: COLORS_HEX.GOLD,
        fontSize: '20px',
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(1, 0);
    this.container.add(this.closeText);
    this.closeZone = this.scene.add.zone(closeX - 18, closeY, 22, 22).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerdown', () => this.hide());
    this.container.add(this.closeZone);

    // 描述
    let cy = POPOVER_PAD + TITLE_H + ROW_GAP;
    this.descText = this.scene.add.text(POPOVER_PAD, cy, descLines.slice(0, 3).join('\n'), {
      ...FONTS.body,
      color: COLORS_HEX.PAPER,
      wordWrap: { width: POPOVER_W - POPOVER_PAD * 2 },
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.descText);
    cy += descLineCount * DESC_LINE_H + ROW_GAP;

    // v1.0 #3：相邻加成（已激活）—— 金色一行 emoji + 古风短句 + 百分比
    this.adjacencyTexts = [];
    if (activeAdj.length > 0) {
      for (const adj of activeAdj) {
        const pct = Math.round((adj.mul - 1) * 100);
        const label = `✦ ${adj.description}　+${pct}% ${RES_LABEL[adj.resource]}`;
        const t = this.scene.add.text(POPOVER_PAD, cy, label, {
          ...FONTS.smallDim,
          color: COLORS_HEX.GOLD,
          fontSize: '14px',
        } as Phaser.Types.GameObjects.Text.TextStyle);
        this.container.add(t);
        this.adjacencyTexts.push(t);
        cy += DESC_LINE_H;
      }
      cy += ROW_GAP;
    }

    // 升级行（如有 upgradesTo）
    if (def.upgradesTo) {
      const toDef = getBuildingDef(def.upgradesTo);
      if (toDef) {
        this.drawUpgradeRow(def, toDef, cy);
      }
    }

    // 点 popover 之外 → 关闭。延一帧绑定，避免 show 调用所在的同一次 pointerdown 把自己关掉
    this.scene.time.delayedCall(0, () => this.bindOutsideClick());

    // ESC 关
    this.escHandler = (): void => this.hide();
    this.scene.input.keyboard?.on('keydown-ESC', this.escHandler);
  }

  /** 计算 popover 左上角屏幕坐标：默认锚点上方居中，越界则翻到下方/贴边。 */
  private computePos(anchorScreenX: number, anchorScreenY: number, totalH: number): { px: number; py: number } {
    const sw = this.scene.scale.width;
    const sh = this.scene.scale.height;
    let px = anchorScreenX - POPOVER_W / 2;
    let py = anchorScreenY - totalH - 12;
    if (px < 8) px = 8;
    if (px + POPOVER_W > sw - 8) px = sw - POPOVER_W - 8;
    if (py < 8) py = anchorScreenY + 16; // 上方放不下就放下方
    if (py + totalH > sh - 8) py = sh - totalH - 8;
    return { px, py };
  }

  /**
   * v1.0 #3：扫描本建筑的所有 output 资源，列出当前有 partner 命中的相邻加成。
   * 同一资源只取最高那条（与 productionSystem 同 max-mul 语义）。
   */
  private computeActiveAdjacency(
    instance: BuildingInstance,
    def: BuildingDef,
  ): Array<{ resource: ResourceId; mul: number; description: string; partnerName: string }> {
    if (!def.adjacencyBonus || def.adjacencyBonus.length === 0) return [];
    const buildings = this.store.getBuildings();
    const out: Array<{ resource: ResourceId; mul: number; description: string; partnerName: string }> = [];
    const seen = new Set<ResourceId>();
    for (const o of def.output) {
      if (seen.has(o.resource)) continue;
      seen.add(o.resource);
      const adj = computeAdjacencyMul(instance, def, o.resource, buildings, getBuildingDef);
      if (adj.mul > 1 && adj.activeRule) {
        const partnerDef = getBuildingDef(adj.activeRule.partnerDefId);
        out.push({
          resource: o.resource,
          mul: adj.mul,
          description: adj.activeRule.description,
          partnerName: partnerDef?.name ?? adj.activeRule.partnerDefId,
        });
      }
    }
    return out;
  }

  private drawUpgradeRow(fromDef: BuildingDef, toDef: BuildingDef, cy: number): void {
    if (!this.container) return;
    const cost = toDef.upgradeCost ?? toDef.cost;
    const resources = this.store.getResources();
    const adopted = this.store.getAdoptedPolicyIds();
    const builtIds = new Set(
      this.store.getBuildings().filter(b => b.status === 'working').map(b => b.defId),
    );

    // 前置缺失
    const completedDecrees = new Set(this.store.getCompletedDecreeIds());
    const missing: string[] = [];
    for (const req of toDef.upgradeRequires) {
      if (req.startsWith('pol_')) {
        if (!adopted.has(req)) missing.push(req);
      } else if (req.startsWith('decree_')) {
        if (!completedDecrees.has(req)) missing.push(req);
      } else if (!builtIds.has(req) && req !== fromDef.id) {
        missing.push(req);
      }
    }
    const prereqOk = missing.length === 0;

    // 资源足够
    let resOk = true;
    const lacking: string[] = [];
    for (const id of Object.keys(cost) as ResourceId[]) {
      const need = cost[id] ?? 0;
      if (need <= 0) continue;
      const have = resources[id] ?? 0;
      if (have < need) {
        resOk = false;
        lacking.push(`${RES_LABEL[id]}${have}/${need}`);
      }
    }

    const ok = prereqOk && resOk;

    // 按钮
    const btnX = POPOVER_PAD;
    const btnW = POPOVER_W - POPOVER_PAD * 2;
    this.upgradeBtnGfx = this.scene.add.graphics();
    this.drawButtonBg(this.upgradeBtnGfx, btnX, cy, btnW, BUTTON_H, ok);
    this.container.add(this.upgradeBtnGfx);

    const costStr = formatCost(cost);
    const label = `升级到 ${toDef.name}　${costStr}　${toDef.upgradeTime ?? 0}日`;
    this.upgradeBtnLabel = this.scene.add
      .text(btnX + btnW / 2, cy + BUTTON_H / 2, label, {
        ...FONTS.body,
        color: ok ? COLORS_HEX.GOLD : COLORS_HEX.ASH,
        fontSize: '14px',
      } as Phaser.Types.GameObjects.Text.TextStyle)
      .setOrigin(0.5, 0.5);
    this.container.add(this.upgradeBtnLabel);

    this.upgradeBtnZone = this.scene.add.zone(btnX, cy, btnW, BUTTON_H).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.upgradeBtnZone.on('pointerdown', () => this.attemptUpgrade(prereqOk, missing, resOk, lacking));
    this.container.add(this.upgradeBtnZone);

    // 提示行
    cy += BUTTON_H + ROW_GAP;
    let hint = '';
    if (!prereqOk) {
      hint = `缺：${missing.map(m => translatePrereq(m)).join('、')}`;
    } else if (!resOk) {
      hint = `资源不足：${lacking.join('、')}`;
    } else {
      hint = `点击升级，${toDef.upgradeTime ?? 0} 日后变形态`;
    }
    this.hintText = this.scene.add.text(POPOVER_PAD, cy, hint, {
      ...FONTS.smallDim,
      color: ok ? COLORS_HEX.PAPER_DIM : COLORS_HEX.CINNABAR,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.hintText);
  }

  private drawButtonBg(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, enabled: boolean): void {
    g.clear();
    g.fillStyle(enabled ? COLORS.WOOD_LIGHT : COLORS.WOOD, 1);
    g.fillRect(x, y, w, h);
    g.lineStyle(1.5, enabled ? COLORS.GOLD : COLORS.GOLD_DIM, 1);
    g.strokeRect(x, y, w, h);
  }

  private attemptUpgrade(prereqOk: boolean, missing: string[], resOk: boolean, lacking: string[]): void {
    if (!this.currentInstance) return;
    if (!prereqOk) {
      this.toast?.show(`需先${missing.map(m => translatePrereq(m)).join('、')}`, 'error');
      return;
    }
    if (!resOk) {
      this.toast?.show(`资源不足：${lacking.join('、')}`, 'error');
      return;
    }
    const result = this.store.upgradeBuilding(this.currentInstance.position.x, this.currentInstance.position.y);
    if (result.ok) {
      const toDefId = getBuildingDef(this.currentInstance.defId)?.upgradesTo;
      const toDef = toDefId ? getBuildingDef(toDefId) : null;
      this.toast?.show(`已开工升级 → ${toDef?.name ?? '更高阶'}`, 'info');
      this.hide();
    } else {
      this.toast?.show(this.upgradeFailureMsg(result.reason, result.missing), 'error');
    }
  }

  private upgradeFailureMsg(reason: string, missing?: string[]): string {
    const map: Record<string, string> = {
      unknown_building: '建筑未找到',
      already_upgrading: '已在升级中',
      not_working: '建筑未运转',
      unknown_def: '建筑数据缺失',
      no_upgrade_path: '此建筑无更高阶',
      unknown_target_def: '升级目标缺失',
      prerequisites_unmet: missing?.length ? `缺：${missing.map(translatePrereq).join('、')}` : '前置未满足',
      insufficient_resources: '资源不足',
    };
    return map[reason] ?? `升级失败：${reason}`;
  }


  private bindOutsideClick(): void {
    if (!this.container) return;
    this.outsideClickHandler = (p: Phaser.Input.Pointer): void => {
      if (!this.container) return;
      const local = { x: p.x - this.container.x, y: p.y - this.container.y };
      const w = POPOVER_W;
      // 高度从 bg 的 fillRect 推回——简单用 currentInstance.def 的 desc 估值再算一次
      // 直接用 100..600 范围内的 quick check：popover 高度 < 280 大概率
      const inside = local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= 600;
      if (!inside) this.hide();
    };
    this.scene.input.on('pointerdown', this.outsideClickHandler);
  }

  hide(): void {
    if (this.outsideClickHandler) {
      this.scene.input.off('pointerdown', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
    if (this.escHandler) {
      this.scene.input.keyboard?.off('keydown-ESC', this.escHandler);
      this.escHandler = null;
    }
    this.container?.destroy(true);
    this.container = null;
    this.bg = null;
    this.titleText = null;
    this.descText = null;
    this.hintText = null;
    this.upgradeBtnZone = null;
    this.upgradeBtnGfx = null;
    this.upgradeBtnLabel = null;
    this.closeZone = null;
    this.closeText = null;
    this.adjacencyTexts = [];
    this.currentInstance = null;
  }

  destroy(): void {
    this.hide();
    this.store.off(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener);
  }
}

function wrapText(s: string, charsPerLine: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of s) {
    cur += ch;
    if (cur.length >= charsPerLine && (ch === '，' || ch === '。' || ch === '；' || ch === '、' || ch === ' ')) {
      out.push(cur);
      cur = '';
    }
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

function formatCost(cost: Partial<Record<ResourceId, number>>): string {
  const parts: string[] = [];
  for (const id of Object.keys(cost) as ResourceId[]) {
    const v = cost[id] ?? 0;
    if (v > 0) parts.push(`${RES_LABEL[id]}${v}`);
  }
  return parts.length > 0 ? `耗 ${parts.join(' ')}` : '免费';
}

function translatePrereq(req: string): string {
  if (req.startsWith('pol_')) {
    const policyMap: Record<string, string> = {
      pol_market: '通市',
      pol_silkworm: '育蚕',
      pol_metallurgy: '采铜',
      pol_iron_smelt: '冶铁',
      pol_imperial: '王制',
      pol_school: '兴学',
      pol_water_works: '水利',
      pol_lookout: '烽燧守望',
      pol_post_road: '驿道',
      pol_conscript: '征兵',
      pol_diplomacy: '邦交',
    };
    return `采纳「${policyMap[req] ?? req.replace('pol_', '')}」`;
  }
  if (req.startsWith('decree_')) {
    return `颁「${req.replace('decree_', '')}」`;
  }
  // 建筑前置：尝试 lookup name
  const def = getBuildingDef(req);
  return def ? `先建「${def.name}」` : req;
}
