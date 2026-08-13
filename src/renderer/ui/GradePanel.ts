import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { drawDecorativePanelFrame } from './panelDecoration';
import { meetsThreshold, meetsSignature } from '../state/countryGrade';
import type { SignatureAchievement } from '../data/countryGrades';
import { getBuildingDef } from '../data/buildingRegistry';
import { RESOURCE_LABEL } from './courtFormat';
import type { ResourceId } from '../data/resourceRegistry';

/**
 * 升格目标面板（中央模态）——P1 信息可视化第二件（2026-08-14）。
 *
 * 点 HUD 国格徽章打开。列出「下一格还差什么」：人口/资源门槛 + 标志成就，逐项打勾。
 * 修复「无头模拟 720 天卡国格 1」暴露的目标不可见问题——
 * 玩家从此永远看得见下一步（C:S 里程碑 / HOI4 焦点树的共同启示）。
 *
 * 已是天下共主时展示圆满文案 + 终局波次提示。
 * 不暂停游戏；点关闭按钮 / 点面板外区关闭。文案半文半白、禁生僻偏字。
 * 销毁：UIScene.shutdown 调 .destroy()。
 */

const PANEL_WIDTH = 560;
const PANEL_HEIGHT = 420;

interface GradeItemTexts {
  label: Phaser.GameObjects.Text;
  value: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
}

export class GradePanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlayBg: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bgGfx: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly currentText: Phaser.GameObjects.Text;
  private readonly nextTitleText: Phaser.GameObjects.Text;
  private readonly nextBlurbText: Phaser.GameObjects.Text;
  private readonly itemTexts: GradeItemTexts[] = [];
  private readonly footerText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeLabel: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private isOpen = false;
  private destroyed = false;

  private onResources = (): void => { if (this.isOpen) this.refresh(); };
  private onDayTick = (): void => { if (this.isOpen) this.refresh(); };
  private onGradeChanged = (): void => { if (this.isOpen) this.refresh(); };
  private onReplaced = (): void => { if (this.isOpen) this.refresh(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);

    this.overlayBg = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.overlayZone.on('pointerdown', () => this.close());
    this.container.add([this.overlayBg, this.overlayZone]);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.titleText = scene.add.text(0, 0, '国格 · 升格之途', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.currentText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#F5ECD7',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.nextTitleText = scene.add.text(0, 0, '', {
      ...FONTS.body, color: '#C9A84C', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.nextBlurbText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add([this.titleText, this.currentText, this.nextTitleText, this.nextBlurbText]);

    for (let i = 0; i < 5; i++) {
      const label = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#F5ECD7',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const value = scene.add.text(0, 0, '', {
        ...FONTS.body, color: '#E6DCC3',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const mark = scene.add.text(0, 0, '', {
        ...FONTS.body, fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle);
      this.itemTexts.push({ label, value, mark });
      this.container.add([label, value, mark]);
    }

    this.footerText = scene.add.text(0, 0, '', {
      ...FONTS.small, color: '#E6DCC3',
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.container.add(this.footerText);

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
    store.on(STATE_EVENTS.DAY_TICK, this.onDayTick);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
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

    let cy = y + 56;
    this.currentText.setPosition(x + 20, cy); cy += 30;
    this.nextTitleText.setPosition(x + 20, cy); cy += 30;
    this.nextBlurbText.setPosition(x + 20, cy); cy += 34;
    for (const t of this.itemTexts) {
      t.label.setPosition(x + 24, cy);
      t.value.setPosition(x + 330, cy);
      t.mark.setPosition(x + 470, cy);
      cy += 30;
    }
    this.footerText.setPosition(x + 20, cy + 8);
  }

  /** 标志成就的人类可读名（建筑名/国策名/朝令名/邦交语义）。 */
  private signatureName(s: SignatureAchievement): string {
    switch (s.kind) {
      case 'building': return getBuildingDef(s.id)?.name ?? s.label;
      case 'policy': return this.store.getPolicies().find(p => p.id === s.id)?.name ?? s.label;
      case 'decree': return this.store.getDecrees().find(d => d.id === s.id)?.name ?? s.label;
      case 'diplomacy': return '列国皆与我修好';
      default: return s.label;
    }
  }

  private refresh(): void {
    if (this.destroyed) return;
    const progress = this.store.getGradeProgress();
    const cur = progress.current;
    const next = progress.next;
    const input = progress.input;

    this.currentText.setText('当前：' + cur.name + (cur.level > 0 ? '（第 ' + cur.level + ' 格）' : ''));

    if (!next) {
      // 已是天下共主：圆满 + 终局提示
      this.nextTitleText.setText('已至「天下共主」，山河任君纵横');
      this.nextBlurbText.setText(cur.ascendBlurb);
      for (const t of this.itemTexts) {
        t.label.setText(''); t.value.setText(''); t.mark.setText('');
      }
      this.footerText.setText('登顶之后仍有风浪：每约二十日一波四方来犯，扛过者史书留名。经营无有尽头。');
      this.footerText.setColor('#E6DCC3');
      return;
    }

    this.nextTitleText.setText('下一格 · ' + next.name);
    this.nextBlurbText.setText(next.ascendBlurb);

    // 逐项：人口 / 资源门槛 / 标志成就
    const items: { label: string; met: boolean; value: string }[] = [];
    const res = input.resources;
    items.push({
      label: '人口',
      met: input.population >= next.threshold.population,
      value: input.population + ' / ' + next.threshold.population,
    });
    const resourceChecks: [keyof typeof next.threshold, ResourceId][] = [
      ['gold', 'gold'], ['cloth', 'cloth'], ['rite', 'rite'], ['bronze', 'bronze'],
    ];
    for (const [key, rid] of resourceChecks) {
      const need = next.threshold[key];
      if (need === undefined) continue;
      const have = res[rid] ?? 0;
      items.push({
        label: RESOURCE_LABEL[rid] ?? rid,
        met: have >= need,
        value: Math.floor(have) + ' / ' + need,
      });
    }
    if (next.signature) {
      const name = this.signatureName(next.signature);
      items.push({
        label: '标志 · ' + next.signature.label,
        met: meetsSignature(next.signature, input),
        value: name,
      });
    }

    for (let i = 0; i < this.itemTexts.length; i++) {
      const t = this.itemTexts[i]!;
      const item = items[i];
      if (!item) { t.label.setText(''); t.value.setText(''); t.mark.setText(''); continue; }
      t.label.setText(item.label);
      t.value.setText(item.value);
      t.mark.setText(item.met ? '✓' : '✗');
      t.mark.setColor(item.met ? '#4A7C59' : '#B71C1C');
      t.value.setColor(item.met ? '#E6DCC3' : '#F5ECD7');
    }

    // 门槛与标志的独立达成状态（供页脚明示缺什么）
    const thresholdMet = meetsThreshold(next.threshold, input);
    const signatureMet = meetsSignature(next.signature, input);
    let footer: string;
    if (thresholdMet && signatureMet) {
      footer = '诸般已备，国格自当晋阶——静候佳音。';
      this.footerText.setColor('#4A7C59');
    } else if (!thresholdMet) {
      footer = '尚欠人口或资财。逐项对照，缺什么补什么。';
      this.footerText.setColor('#C9A84C');
    } else {
      footer = '资财已足，唯欠标志一事——按「标志」所列去办。';
      this.footerText.setColor('#C9A84C');
    }
    this.footerText.setText(footer);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
    this.store.off(STATE_EVENTS.DAY_TICK, this.onDayTick);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onReplaced);
    this.container.destroy(true);
  }
}
