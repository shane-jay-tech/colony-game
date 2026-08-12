import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from './palette';
import { drawDecorativePanelFrame } from './panelDecoration';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { getNpcDef } from '../data/npcCountries';
import { UNIT_DEFS, EXPEDITION_DAYS, type UnitType, type ExpeditionTarget } from '../data/military';
import { computeGrainCost } from '../state/militarySystem';
import { getGeneralDef } from '../state/generalSystem';

/**
 * MilitaryPanel：军务面板（B-1 军事 + B-2 将领，P4 接入）。
 *
 * 此前军事系统是死代码、"兴师"只是标量掷骰。现在本面板把它接成可玩：
 *  - 军力总览：常备军力（由兵阶层/军事建筑/将领派生）+ 可调遣兵 + 已解锁兵种。
 *  - 将领：招募(耗金)/遣散/忠诚/出征态。
 *  - 出征：选目标邦国 + 突袭/威慑/围攻 → 以现有最强兵种 + 可用将领发兵，militarySystem 真实结算。
 *  - 进行中出征倒计时 + 来犯预警。
 * 打开时时停。HUD「军务」按钮 toggle。
 */

const PANEL_W = 600;
const PANEL_H = 540;
const EXP_TARGETS: { t: ExpeditionTarget; label: string }[] = [
  { t: 'raid', label: '突袭(掠)' }, { t: 'deter', label: '威慑' }, { t: 'siege', label: '围攻' },
];

export class MilitaryPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text; // 多行只读信息（军力/出征/预警）
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  /** 动态按钮（招募/遣散/换目标/出征）——每次 refresh 重建。 */
  private dynBtns: { bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  /** 每次 refresh 重建的杂项显示对象（将领立绘画廊、战事文字等）。 */
  private extras: Phaser.GameObjects.GameObject[] = [];

  private isOpen = false;
  private holdsPause = false;
  private destroyed = false;
  private targetIdx = 0;
  private static readonly PAUSE_HOLDER = 'military';

  private onRefresh = (): void => { if (this.isOpen) this.refresh(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
    this.overlay = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0).setInteractive({ useHandCursor: false });
    this.overlayZone.on('pointerup', () => this.close());
    this.container.add([this.overlay, this.overlayZone]);

    this.bg = scene.add.graphics();
    this.title = scene.add.text(0, 0, '军务', { ...FONTS.title, color: COLORS_HEX.GOLD } as Phaser.Types.GameObjects.Text.TextStyle);
    this.body = scene.add.text(0, 0, '', {
      ...FONTS.small, color: COLORS_HEX.INK, wordWrap: { width: PANEL_W - 48 }, lineSpacing: 5,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.closeBg = scene.add.graphics();
    this.closeText = scene.add.text(0, 0, '✕', { ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold' } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.closeZone = scene.add.zone(0, 0, 32, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerup', () => this.close());
    this.container.add([this.bg, this.title, this.body, this.closeBg, this.closeText, this.closeZone]);

    store.on(STATE_EVENTS.MILITARY_CHANGED, this.onRefresh);
    store.on(STATE_EVENTS.GENERALS_CHANGED, this.onRefresh);
    store.on(STATE_EVENTS.EXPEDITION_RESOLVED, this.onRefresh);
    store.on(STATE_EVENTS.DEFENSE_ALERT, this.onRefresh);
    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onRefresh);
    store.on(STATE_EVENTS.DAY_TICK, this.onRefresh);
  }

  toggle(): void { this.isOpen ? this.close() : this.open(); }
  open(): void {
    if (this.destroyed || this.isOpen) return;
    this.isOpen = true;
    if (!this.holdsPause) { this.store.requestPause(MilitaryPanel.PAUSE_HOLDER); this.holdsPause = true; }
    this.layout();
    this.refresh();
    this.container.setVisible(true);
  }
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.setVisible(false);
    if (this.holdsPause) { this.store.releasePause(MilitaryPanel.PAUSE_HOLDER); this.holdsPause = false; }
  }
  isVisible(): boolean { return this.isOpen; }

  private toast(msg: string, kind: 'info' | 'error' = 'info'): void {
    (this.scene.registry.get('toast') as { show?: (m: string, k?: string) => void } | undefined)?.show?.(msg, kind);
  }

  layout(): void {
    if (!this.isOpen) return;
    const sw = this.scene.scale.width, sh = this.scene.scale.height;
    const px = Math.floor((sw - PANEL_W) / 2), py = Math.floor((sh - PANEL_H) / 2);
    this.overlay.clear();
    this.overlay.fillStyle(COLORS.BG_INK, 0.6);
    this.overlay.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);
    this.bg.clear();
    drawDecorativePanelFrame(this.bg, px, py, PANEL_W, PANEL_H, 'left');
    this.title.setPosition(px + 24, py + 20);
    this.body.setPosition(px + 24, py + 64);
    const cx = px + PANEL_W - 44, cy = py + 16;
    this.closeBg.clear();
    this.closeBg.fillStyle(COLORS.CINNABAR, 0.85);
    this.closeBg.fillRect(cx, cy, 32, 32);
    this.closeText.setPosition(cx + 16, cy + 16);
    this.closeZone.setPosition(cx, cy).setSize(32, 32);
  }

  private clearDynBtns(): void {
    for (const b of this.dynBtns) { b.bg.destroy(); b.txt.destroy(); b.zone.destroy(); }
    this.dynBtns = [];
    for (const o of this.extras) o.destroy();
    this.extras = [];
  }

  private addBtn(x: number, y: number, w: number, h: number, label: string, fill: number, onClick: (() => void) | null): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(fill, onClick ? 0.92 : 0.45);
    bg.fillRect(x, y, w, h);
    bg.lineStyle(1, COLORS.GOLD_DIM, 1);
    bg.strokeRect(x, y, w, h);
    const txt = this.scene.add.text(x + w / 2, y + h / 2, label, {
      ...FONTS.small, color: COLORS_HEX.PAPER, fontStyle: 'bold', align: 'center',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    const zone = this.scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: !!onClick });
    if (onClick) zone.on('pointerup', onClick);
    this.container.add([bg, txt, zone]);
    this.dynBtns.push({ bg, txt, zone });
  }

  private refresh(): void {
    if (!this.isOpen) return;
    this.clearDynBtns();
    const sw = this.scene.scale.width, sh = this.scene.scale.height;
    const px = Math.floor((sw - PANEL_W) / 2), py = Math.floor((sh - PANEL_H) / 2);

    const power = this.store.computeCurrentMilitaryPower();
    const deployable = this.store.getDeployableSoldiers();
    const unitTypes = this.store.getAvailableUnitTypesForUi();
    const unitNames = unitTypes.length ? unitTypes.map(u => UNIT_DEFS[u].name).join('、') : '（仅乡勇，需建兵营/采纳徵兵）';
    const generals = this.store.getGenerals();
    const exps = this.store.getActiveExpeditions();
    const alerts = this.store.getDefenseAlerts();

    // 顶部：军力概览（body 只放这两行，简短不挤）
    this.body.setText(`常备军力 ${power}　·　可调遣兵 ${deployable}\n已解锁兵种：${unitNames}`);
    this.body.setPosition(px + 24, py + 58);

    // ── 麾下将领：立绘画廊（图 + 名 + 指挥/忠诚） ──
    const galY = py + 108;
    const hdr = this.scene.add.text(px + 24, galY - 2, '── 麾下将领 ──', {
      ...FONTS.small, color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(hdr); this.extras.push(hdr);
    if (generals.length === 0) {
      const t = this.scene.add.text(px + 24, galY + 20, '（暂无将领，下方可招募贤才）', {
        ...FONTS.small, color: COLORS_HEX.INK_SMALL,
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.container.add(t); this.extras.push(t);
    } else {
      const cardW = 90, imgW = 50, imgH = 75;
      generals.forEach((g, i) => {
        const def = getGeneralDef(g.id);
        const cx = px + 24 + i * cardW;
        const iy = galY + 18;
        const key = `portrait_${g.id}`;
        if (this.scene.textures.exists(key)) {
          const im = this.scene.add.image(cx + imgW / 2, iy, key).setOrigin(0.5, 0);
          const tex = this.scene.textures.get(key).getSourceImage() as { width: number; height: number };
          im.setScale(imgW / (tex.width || imgW), imgH / (tex.height || imgH));
          this.container.add(im); this.extras.push(im);
        } else {
          // 缺图回退：文字框
          const fb = this.scene.add.graphics();
          fb.fillStyle(COLORS.WOOD_LIGHT, 0.8); fb.fillRect(cx, iy, imgW, imgH);
          this.container.add(fb); this.extras.push(fb);
        }
        const nm = this.scene.add.text(cx + imgW / 2, iy + imgH + 3, `${def?.name ?? g.id}`, {
          ...FONTS.small, color: g.deployed ? COLORS_HEX.ASH : COLORS_HEX.INK,
        } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
        const st = this.scene.add.text(cx + imgW / 2, iy + imgH + 23, `指${def?.command ?? 0} 忠${g.loyalty}`, {
          ...FONTS.small, color: COLORS_HEX.INK_SMALL,
        } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
        this.container.add([nm, st]); this.extras.push(nm, st);
        if (g.deployed) {
          const dep = this.scene.add.text(cx + imgW / 2, iy + imgH / 2, '出征中', {
            ...FONTS.small, color: COLORS_HEX.GOLD,
          } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
          this.container.add(dep); this.extras.push(dep);
        }
      });
    }

    // ── 战事（出征/来犯） ──
    const warLines: string[] = ['── 战事 ──'];
    if (exps.length === 0 && alerts.length === 0) warLines.push('（无出征、无来犯）');
    for (const e of exps) warLines.push(`出征 ${getNpcDef(e.config.npcId)?.name ?? e.config.npcId}：余 ${e.daysRemaining} 日 · 士气 ${e.morale}`);
    for (const a of alerts) warLines.push(`⚠ ${getNpcDef(a.npcId)?.name ?? a.npcId} 来犯：${a.daysUntilAttack} 日后 · 敌军力 ${a.npcStrength}`);
    const warText = this.scene.add.text(px + 24, galY + 130, warLines.join('\n'), {
      ...FONTS.small, color: COLORS_HEX.INK, lineSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(warText); this.extras.push(warText);

    // ── 动态按钮区（面板下半部） ──
    let by = py + PANEL_H - 200;
    // 招募将领（最多列 3 个可招募）
    const recruitable = this.store.getRecruitableGenerals().slice(0, 3);
    let bx = px + 24;
    for (const r of recruitable) {
      this.addBtn(bx, by, 150, 32, `招募 ${r.name}(钱40)`, COLORS.GOLD_DIM, () => {
        if (this.store.recruitGeneral(r.id)) this.toast(`${r.name} 来投，可委以征伐`);
        else this.toast('招募失败（钱不足/已满编）', 'error');
        this.refresh();
      });
      bx += 158;
    }
    // 遣散（已招募将领，未出征的）
    by += 40;
    bx = px + 24;
    for (const g of generals.filter(x => !x.deployed)) {
      const def = getGeneralDef(g.id);
      this.addBtn(bx, by, 110, 30, `遣散 ${def?.name ?? g.id}`, COLORS.WOOD_LIGHT, () => {
        this.store.dismissGeneral(g.id); this.refresh();
      });
      bx += 118;
    }

    // ── 出征区：目标选择 + 三种出征 ──
    by += 44;
    const npcs = this.store.getNpcCountries();
    if (npcs.length > 0) {
      if (this.targetIdx >= npcs.length) this.targetIdx = 0;
      const target = npcs[this.targetIdx]!;
      const tname = getNpcDef(target.id)?.name ?? target.id;
      this.addBtn(px + 24, by, 40, 34, '◀', COLORS.WOOD, () => { this.targetIdx = (this.targetIdx - 1 + npcs.length) % npcs.length; this.refresh(); });
      this.addBtn(px + 24 + 220, by, 40, 34, '▶', COLORS.WOOD, () => { this.targetIdx = (this.targetIdx + 1) % npcs.length; this.refresh(); });
      const tBtn = this.scene.add.text(px + 24 + 70, by + 17, `目标：${tname}（军力${target.militaryPower}）`, {
        ...FONTS.small, color: COLORS_HEX.INK,
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
      this.container.add(tBtn);
      this.dynBtns.push({ bg: this.scene.add.graphics(), txt: tBtn, zone: this.scene.add.zone(0, 0, 1, 1) });

      by += 40;
      bx = px + 24;
      const canDeploy = deployable > 0 && unitTypes.length > 0; // 有可调兵且有已解锁兵种（民兵为基础兵种，常驻 unitTypes）
      for (const et of EXP_TARGETS) {
        this.addBtn(bx, by, 110, 36, et.label, canDeploy ? COLORS.CINNABAR : COLORS.ASH,
          canDeploy ? () => this.launch(target.id, et.t) : null);
        bx += 118;
      }
    }
  }

  /** 以"全部可调遣兵编为当前最强可用兵种 + 最强可用将领"自动成军出征。 */
  private launch(npcId: string, target: ExpeditionTarget): void {
    const deployable = this.store.getDeployableSoldiers();
    if (deployable <= 0) { this.toast('无可调遣之兵（先转农为兵、建兵营）', 'error'); return; }
    const unitTypes = this.store.getAvailableUnitTypesForUi();
    const best: UnitType = unitTypes.length
      ? unitTypes.reduce((a, b) => (UNIT_DEFS[b].attack > UNIT_DEFS[a].attack ? b : a))
      : 'militia';
    const units = { [best]: deployable } as Partial<Record<UnitType, number>>;
    // 选一个未出征、指挥最高的将领（可无）
    const avail = this.store.getGenerals().filter(g => !g.deployed);
    const general = avail.length
      ? avail.reduce((a, b) => ((getGeneralDef(b.id)?.command ?? 0) > (getGeneralDef(a.id)?.command ?? 0) ? b : a))
      : null;
    const grainAllocated = computeGrainCost(units, EXPEDITION_DAYS[target].max);
    const r = this.store.launchExpedition({ target, npcId, units, generalId: general?.id, grainAllocated });
    if (r.ok) this.toast(`大军开拔，直指${getNpcDef(npcId)?.name ?? npcId}`);
    else this.toast(this.failMsg(r.reason ?? ''), 'error');
    this.refresh();
  }

  private failMsg(reason: string): string {
    if (reason.startsWith('unit_locked')) return '兵种未解锁';
    if (reason === 'no_units' || reason === 'exceed_max_deploy') return '兵力不足或超出可遣上限';
    if (reason === 'insufficient_grain' || reason === 'insufficient_grain_stock') return '军粮不足，无以远征';
    if (reason === 'general_unavailable') return '所选将领不可用';
    return '无法出征';
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.MILITARY_CHANGED, this.onRefresh);
    this.store.off(STATE_EVENTS.GENERALS_CHANGED, this.onRefresh);
    this.store.off(STATE_EVENTS.EXPEDITION_RESOLVED, this.onRefresh);
    this.store.off(STATE_EVENTS.DEFENSE_ALERT, this.onRefresh);
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onRefresh);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onRefresh);
    if (this.holdsPause) { this.store.releasePause(MilitaryPanel.PAUSE_HOLDER); this.holdsPause = false; }
    this.clearDynBtns();
    this.container.destroy(true);
  }

  // 测试 hooks
  recruitFirstAvailable(): boolean {
    const r = this.store.getRecruitableGenerals();
    return r.length > 0 ? this.store.recruitGeneral(r[0]!.id) : false;
  }
  launchAt(npcId: string, target: ExpeditionTarget): void { this.launch(npcId, target); }
}
