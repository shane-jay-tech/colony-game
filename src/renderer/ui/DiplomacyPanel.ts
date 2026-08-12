import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { getNpcDef } from '../data/npcCountries';
import type { NpcCountryDef, NpcCountryState } from '../data/schema';
import { stanceLabel } from '../state/diplomacySystem';
import { drawDecorativePanelFrame } from './panelDecoration';

/**
 * v1.0 #6：邦交面板（中央模态）。
 *
 * 默认隐藏，点 HUD 顶栏「邦交」按钮打开。展示 3 个 NPC 邦国卡片：
 *   - 名 + 原型徽（商/武/礼）+ stance 档（盟友/友好/中立/冷淡/敌对）
 *   - 军力 / 信誉 / 通商状态
 *   - 三个动作按钮：通商 / 出使 / 兴师
 *
 * 不暂停游戏（玩家可以一边看 NPC 一边推日子）；按 ESC 或外区点击关闭。
 *
 * 销毁：UIScene.shutdown 调 .destroy()
 */

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 660; // Phase1：容下每局 4 张 NPC 卡
const CARD_HEIGHT = 130;
const CARD_GAP = 12;
/** 邦交按钮宽度（READ-01：80px 容不下"通商(金50布2)"14px 文字，加宽到 120）。 */
const BTN_W = 120;

interface NpcCard {
  def: NpcCountryDef;
  bg: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  metaLabel: Phaser.GameObjects.Text;
  statsLabel: Phaser.GameObjects.Text;
  tradeBg: Phaser.GameObjects.Graphics;
  tradeLabel: Phaser.GameObjects.Text;
  tradeZone: Phaser.GameObjects.Zone;
  envoyBg: Phaser.GameObjects.Graphics;
  envoyLabel: Phaser.GameObjects.Text;
  envoyZone: Phaser.GameObjects.Zone;
  warBg: Phaser.GameObjects.Graphics;
  warLabel: Phaser.GameObjects.Text;
  warZone: Phaser.GameObjects.Zone;
}

const ARCHETYPE_TAG: Record<string, string> = {
  commercial: '【商】',
  martial: '【武】',
  cultural: '【礼】',
  tribal: '【夷】',
};

export class DiplomacyPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlayBg: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bgGfx: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeLabel: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  // Phase1：每局 NPC 阵容动态（池中选 4），卡片按 id 懒建/复用。
  private readonly cards = new Map<string, NpcCard>();
  private isOpen = false;
  private destroyed = false;

  private onResources = (): void => { if (this.isOpen) this.refresh(); };
  private onDiplomacy = (...args: unknown[]): void => {
    if (this.isOpen) this.refresh();
    const payload = args[0] as { npcId?: string; kind?: string; result?: { ok: boolean; message?: string; reason?: string; details?: string } } | undefined;
    if (payload?.result) {
      if (payload.result.ok) {
        this.toast(payload.result.message ?? '邦交动作已成', 'success');
      } else {
        this.toast(failMsg(payload.result.reason, payload.result.details), 'error');
      }
    }
  };
  private onTradeTick = (...args: unknown[]): void => {
    if (this.isOpen) this.refresh();
    const payload = args[0] as { deltas?: Record<string, number> } | undefined;
    if (payload?.deltas) {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(payload.deltas)) {
        if (v && v > 0) {
          const label = k === 'gold' ? '钱' : k === 'cloth' ? '布' : k;
          parts.push(`+${v} ${label}`);
        }
      }
      if (parts.length > 0) this.toast(`邦交通商入账：${parts.join('、')}`, 'success');
    }
  };
  private onDayTick = (): void => { if (this.isOpen) this.refresh(); };
  private onNpcDynamics = (): void => { if (this.isOpen) this.refresh(); };

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

    this.titleText = scene.add.text(0, 0, '邦交', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.subtitleText = scene.add.text(0, 0, '与四方诸侯通好、修聘、兴师', {
      ...FONTS.body, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add([this.titleText, this.subtitleText]);

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

    // 卡片在 open() 时按当前选中的 NPC 阵容懒建（不再固定 3 张）
    this.layout();

    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    store.on(STATE_EVENTS.DIPLOMACY_ACTION, this.onDiplomacy);
    store.on(STATE_EVENTS.TRADE_TICK, this.onTradeTick);
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.NPC_DYNAMICS_TICK, this.onNpcDynamics);
  }

  /** 按当前选中的 NPC 阵容同步卡片集合（缺则建、多余则销毁）。 */
  private syncCards(): void {
    const roster = this.store.getNpcCountries();
    const rosterIds = new Set(roster.map(s => s.id));
    // 删除已不在阵容的卡（读档换阵容时）
    for (const [id, card] of this.cards) {
      if (!rosterIds.has(id)) {
        card.bg.destroy(); card.nameLabel.destroy(); card.metaLabel.destroy(); card.statsLabel.destroy();
        card.tradeBg.destroy(); card.tradeLabel.destroy(); card.tradeZone.destroy();
        card.envoyBg.destroy(); card.envoyLabel.destroy(); card.envoyZone.destroy();
        card.warBg.destroy(); card.warLabel.destroy(); card.warZone.destroy();
        this.cards.delete(id);
      }
    }
    // 新建缺失的卡
    for (const s of roster) {
      if (this.cards.has(s.id)) continue;
      const def = getNpcDef(s.id);
      if (def) this.cards.set(s.id, this.makeCard(def));
    }
  }

  private makeCard(def: NpcCountryDef): NpcCard {
    const bg = this.scene.add.graphics();
    const nameLabel = this.scene.add.text(0, 0, '', {
      ...FONTS.panelHeading, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const metaLabel = this.scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    const statsLabel = this.scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle);

    const tradeBg = this.scene.add.graphics();
    const tradeLabel = this.scene.add.text(0, 0, '通商', {
      ...FONTS.body, color: '#1A1410', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const tradeZone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    tradeZone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.store.tradeWithNpc(def.id);
    });

    const envoyBg = this.scene.add.graphics();
    const envoyLabel = this.scene.add.text(0, 0, '出使', {
      ...FONTS.body, color: '#1A1410', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const envoyZone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    envoyZone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.store.sendEnvoyTo(def.id);
    });

    const warBg = this.scene.add.graphics();
    const warLabel = this.scene.add.text(0, 0, '兴师', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const warZone = this.scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    warZone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      this.store.declareWarOn(def.id);
    });

    this.container.add([
      bg, nameLabel, metaLabel, statsLabel,
      tradeBg, tradeLabel, tradeZone,
      envoyBg, envoyLabel, envoyZone,
      warBg, warLabel, warZone,
    ]);

    return {
      def, bg, nameLabel, metaLabel, statsLabel,
      tradeBg, tradeLabel, tradeZone,
      envoyBg, envoyLabel, envoyZone,
      warBg, warLabel, warZone,
    };
  }

  open(): void {
    if (this.destroyed || this.isOpen) return;
    this.isOpen = true;
    this.syncCards(); // 按当前阵容建卡
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

    // 全屏遮罩
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

    this.titleText.setPosition(x + 20, y + 14);
    this.subtitleText.setPosition(x + 20, y + 48);

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

    const cardX = x + 20;
    const cardW = w - 40;
    let cardY = y + 84;
    // 按阵容顺序排布
    for (const s of this.store.getNpcCountries()) {
      const card = this.cards.get(s.id);
      if (!card) continue;
      this.layoutCard(card, cardX, cardY, cardW);
      cardY += CARD_HEIGHT + CARD_GAP;
    }
  }

  private layoutCard(card: NpcCard, x: number, y: number, w: number): void {
    card.nameLabel.setPosition(x + 16, y + 12);
    card.metaLabel.setPosition(x + 16, y + 42);
    card.statsLabel.setPosition(x + 16, y + 64);

    // 三个按钮：右侧竖排
    const btnW = BTN_W;
    const btnH = 32;
    const btnGap = 8;
    const btnX = x + w - btnW - 16;
    const tradeY = y + 14;
    const envoyY = tradeY + btnH + btnGap;
    const warY = envoyY + btnH + btnGap;

    card.tradeZone.setPosition(btnX, tradeY).setSize(btnW, btnH);
    card.envoyZone.setPosition(btnX, envoyY).setSize(btnW, btnH);
    card.warZone.setPosition(btnX, warY).setSize(btnW, btnH);

    card.tradeLabel.setPosition(btnX + btnW / 2, tradeY + btnH / 2);
    card.envoyLabel.setPosition(btnX + btnW / 2, envoyY + btnH / 2);
    card.warLabel.setPosition(btnX + btnW / 2, warY + btnH / 2);
  }

  private refresh(): void {
    if (this.destroyed) return;
    const states = this.store.getNpcCountries();
    const playerMP = this.store.getPlayerMilitaryPower();
    const playerRenown = this.store.getPlayerRenown();
    for (const state of states) {
      const card = this.cards.get(state.id);
      if (!card) continue;
      this.refreshCard(card, state, playerMP, playerRenown);
    }
    // subtitle：玩家自身 metric
    this.subtitleText.setText(`本邦：信誉 ${playerRenown.toFixed(0)} · 军力 ${playerMP} · 士气 ${this.store.getPlayerMorale()}`);
  }

  private refreshCard(card: NpcCard, state: NpcCountryState, playerMP: number, _playerRenown: number): void {
    const tag = ARCHETYPE_TAG[card.def.archetype] ?? '';
    const stance = stanceLabel(state.stance);
    const warTag = state.warStatus === 'war' ? ' · ⚔️ 交战' : state.warStatus === 'tension' ? ' · 紧张' : '';

    card.nameLabel.setText(`${tag}${card.def.name}　·　${stance} (${state.stance >= 0 ? '+' : ''}${state.stance})${warTag}`);
    card.metaLabel.setText(card.def.descPlain);
    const tradeTag = state.tradeRoute ? `通商中（下次入账 ${state.tradeCooldown} 日）` : '未通商';
    // Phase1：合纵盟友 + 军力碾压威胁
    const allyNames = state.allyIds.map(id => getNpcDef(id)?.name ?? id).filter(Boolean);
    const allyTag = allyNames.length > 0 ? ` · 合纵：${allyNames.join('、')}` : '';
    const threatTag = state.militaryPower >= playerMP * 1.5 && state.stance < 0 ? ' · ⚠ 虎视眈眈' : '';
    card.statsLabel.setText(`军力 ${state.militaryPower} · 信誉 ${state.renown} · ${tradeTag}${allyTag}${threatTag}`);

    // 卡片底色 — stance 档色相
    card.bg.clear();
    let cardFill: number;
    if (state.warStatus === 'war') cardFill = COLORS.CINNABAR;
    else if (state.stance >= 60) cardFill = COLORS.STONE_GREEN;
    else if (state.stance >= 20) cardFill = COLORS.GOLD_DIM;
    else if (state.stance >= -20) cardFill = COLORS.WOOD_LIGHT;
    else cardFill = COLORS.WOOD;
    card.bg.fillStyle(cardFill, 0.88);
    card.bg.fillRect(card.nameLabel.x - 8, card.nameLabel.y - 8, card.tradeZone.x - card.nameLabel.x + BTN_W + 8, CARD_HEIGHT - 8);
    card.bg.lineStyle(1, COLORS.GOLD, 1);
    card.bg.strokeRect(card.nameLabel.x - 8, card.nameLabel.y - 8, card.tradeZone.x - card.nameLabel.x + BTN_W + 8, CARD_HEIGHT - 8);

    // 三按钮 affordance（含资源检查 + 费用提示）
    const res = this.store.getState().resources;
    const goldHave = res.gold ?? 0;
    const clothHave = res.cloth ?? 0;
    const tradeAfford = goldHave >= 50 && clothHave >= 2;
    const envoyAfford = goldHave >= 30 && clothHave >= 5;
    const tradeEnabled = !state.tradeRoute && state.warStatus !== 'war' && tradeAfford;
    const envoyEnabled = state.warStatus !== 'war' && envoyAfford;
    const warEnabled = state.warStatus !== 'war' && playerMP >= state.militaryPower * 0.5;

    // READ-01：去掉会溢出的" 不足"后缀——按钮置灰(ASH)本身即表示不可用，成本仍在标签内。
    card.tradeLabel.setText(state.tradeRoute ? '已通商' : '通商(金50布2)');
    card.envoyLabel.setText('出使(金30布5)');

    this.paintButton(card.tradeBg, card.tradeZone, card.tradeLabel, tradeEnabled ? COLORS.GOLD : COLORS.ASH, tradeEnabled ? '#1A1410' : '#A89A8A');
    this.paintButton(card.envoyBg, card.envoyZone, card.envoyLabel, envoyEnabled ? COLORS.GOLD : COLORS.ASH, envoyEnabled ? '#1A1410' : '#A89A8A');
    this.paintButton(card.warBg, card.warZone, card.warLabel, warEnabled ? COLORS.CINNABAR : COLORS.ASH, warEnabled ? '#F5ECD7' : '#A89A8A');
  }

  private paintButton(bg: Phaser.GameObjects.Graphics, zone: Phaser.GameObjects.Zone, label: Phaser.GameObjects.Text, fill: number, textColor: string): void {
    bg.clear();
    bg.fillStyle(fill, 0.95);
    bg.fillRect(zone.x, zone.y, zone.width, zone.height);
    bg.lineStyle(1, COLORS.GOLD, 1);
    bg.strokeRect(zone.x, zone.y, zone.width, zone.height);
    label.setColor(textColor);
  }

  private toast(msg: string, kind: 'success' | 'error' = 'success'): void {
    const t = this.scene.registry.get('toast') as { show?: (m: string, k?: string) => void } | undefined;
    t?.show?.(msg, kind);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.DIPLOMACY_ACTION, this.onDiplomacy);
    this.store.off(STATE_EVENTS.TRADE_TICK, this.onTradeTick);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.NPC_DYNAMICS_TICK, this.onNpcDynamics);
    this.container.destroy(true); // 连带销毁所有子对象（卡片/按钮）
  }
}

function failMsg(reason: string | undefined, details: string | undefined): string {
  switch (reason) {
    case 'unknown_npc': return '此邦未识';
    case 'insufficient_resources': return '资源不足以行此礼';
    case 'on_cooldown': return details ?? '尚需时日';
    case 'already_at_war': return '已交战，不可再议';
    case 'already_trading': return '已通商';
    case 'insufficient_military': return '兵力不足以兴师（至少需对方半数）';
    default: return reason ?? '邦交受阻';
  }
}
