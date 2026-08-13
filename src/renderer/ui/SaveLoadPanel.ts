import Phaser from 'phaser';
import { COLORS, FONTS } from './palette';
import { REGISTRY_KEYS, registryGet } from './registry';
import { getSaveMeta, loadFromSlot, saveToSlot, type SaveMeta } from '../state/saveLoad';
import type { GameStore } from '../state/gameStore';

/**
 * SaveLoadPanel：游戏内存档 / 读档浮层。
 *
 * 引擎侧（saveLoad.ts + Electron IPC）早已存在，这里补齐玩家可见入口：
 * 三个固定槽（存档一/二/三），展示"第 X 日 · 保存时间"；覆盖与读入均需二次点击确认，
 * 避免误覆盖进度。读入走 store.replaceState()，HUD/地图已有 STATE_REPLACED 订阅自动刷新。
 */
export const SAVE_SLOTS = [
  { id: 'slot1', label: '存档一' },
  { id: 'slot2', label: '存档二' },
  { id: 'slot3', label: '存档三' },
] as const;

export type SaveSlotId = (typeof SAVE_SLOTS)[number]['id'];

const CONFIRM_WINDOW_MS = 3000;

// 全屏点击兜底 hitArea：避免在纯逻辑测试里引入 Phaser.Geom.Rectangle 运行时值
// （其余可测面板均只把 Phaser 当类型用，import 会被编译期摇掉）。
const FULLSCREEN_HIT = { contains: (): boolean => true };
const HIT_CALLBACK = (): boolean => true;

export function formatSavedAt(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '时间未知';
  const d = new Date(ts);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface SlotRow {
  label: Phaser.GameObjects.Text;
  meta: Phaser.GameObjects.Text;
  saveBtn: Phaser.GameObjects.Text;
  loadBtn: Phaser.GameObjects.Text;
}

type PendingConfirm = { slot: SaveSlotId; action: 'save' | 'load'; until: number };

export class SaveLoadPanel {
  static readonly PANEL_W = 470;
  static readonly PANEL_H = 288;
  static readonly ROW_H = 56;

  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly rows: Map<SaveSlotId, SlotRow> = new Map();
  private visible = false;
  private busy = false;
  private pendingConfirm: PendingConfirm | null = null;

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;

    this.container = scene.add.container(0, 0).setDepth(2000).setVisible(false).setScrollFactor(0);
    this.backdrop = scene.add.graphics();
    this.backdrop.fillStyle(0x000000, 0.4);
    this.backdrop.fillRect(0, 0, scene.scale.width, scene.scale.height);
    this.backdrop.setDepth(1999).setVisible(false).setScrollFactor(0);
    this.backdrop.setInteractive(FULLSCREEN_HIT, HIT_CALLBACK);
    this.backdrop.on('pointerdown', () => this.hide());

    const panelBg = scene.add.graphics();
    panelBg.fillStyle(COLORS.WOOD, 0.97);
    panelBg.fillRect(0, 0, SaveLoadPanel.PANEL_W, SaveLoadPanel.PANEL_H);
    panelBg.lineStyle(2, COLORS.GOLD, 1);
    panelBg.strokeRect(0, 0, SaveLoadPanel.PANEL_W, SaveLoadPanel.PANEL_H);
    panelBg.lineStyle(1, COLORS.GOLD_DIM, 0.6);
    panelBg.strokeRect(4, 4, SaveLoadPanel.PANEL_W - 8, SaveLoadPanel.PANEL_H - 8);
    panelBg.setInteractive(FULLSCREEN_HIT, HIT_CALLBACK);
    this.container.add(panelBg);

    const title = scene.add.text(SaveLoadPanel.PANEL_W / 2, 22, '存档与读档', {
      ...FONTS.panelHeading, color: '#C9A84C',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);
    this.container.add(title);

    SAVE_SLOTS.forEach((slot, i) => {
      const rowY = 60 + i * SaveLoadPanel.ROW_H;
      const label = scene.add.text(24, rowY + SaveLoadPanel.ROW_H / 2, slot.label, {
        ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
      const meta = scene.add.text(110, rowY + SaveLoadPanel.ROW_H / 2, '读取中…', {
        ...FONTS.small, color: '#E6DCC3',
      } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
      const saveBtn = this.makeButton(slot.id, 'save', 322, rowY + 10);
      const loadBtn = this.makeButton(slot.id, 'load', 400, rowY + 10);
      this.container.add([label, meta, saveBtn, loadBtn]);
      this.rows.set(slot.id, { label, meta, saveBtn, loadBtn });
    });

    const closeBtn = scene.add.text(SaveLoadPanel.PANEL_W - 30, 10, 'X', {
      ...FONTS.body, color: '#F5ECD7', fontStyle: 'bold',
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    this.layout();
  }

  private makeButton(slot: SaveSlotId, action: 'save' | 'load', x: number, y: number): Phaser.GameObjects.Text {
    const btn = this.scene.add.text(x, y, action === 'save' ? '存档' : '读档', {
      ...FONTS.small, color: '#F5ECD7', backgroundColor: '#5D4037', padding: { x: 8, y: 6 },
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => void this.onButton(slot, action));
    return btn;
  }

  toggle(): void {
    if (this.visible) this.hide();
    else void this.show();
  }

  async show(): Promise<void> {
    this.visible = true;
    this.pendingConfirm = null;
    this.container.setVisible(true);
    this.backdrop.setVisible(true);
    this.refreshConfirmLabels();
    await this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.pendingConfirm = null;
    this.container.setVisible(false);
    this.backdrop.setVisible(false);
  }

  isVisible(): boolean { return this.visible; }

  layout(): void {
    const px = Math.floor((this.scene.scale.width - SaveLoadPanel.PANEL_W) / 2);
    const py = Math.floor((this.scene.scale.height - SaveLoadPanel.PANEL_H) / 2);
    this.container.setPosition(px, py);
    this.backdrop.clear();
    this.backdrop.fillStyle(0x000000, 0.4);
    this.backdrop.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height);
  }

  private async refresh(): Promise<void> {
    const metas = await Promise.all(
      SAVE_SLOTS.map(async (s) => ({ id: s.id, meta: await getSaveMeta(s.id) })),
    );
    for (const { id, meta } of metas) {
      this.renderSlot(id, meta);
    }
  }

  private renderSlot(id: SaveSlotId, meta: SaveMeta | null): void {
    const row = this.rows.get(id);
    if (!row) return;
    if (meta === null) {
      row.meta.setText('空槽');
      row.loadBtn.setAlpha(0.35);
      row.loadBtn.disableInteractive();
    } else {
      const day = meta.currentDay !== null ? `第 ${meta.currentDay} 日` : '天数未知';
      row.meta.setText(`${day} · ${formatSavedAt(meta.savedAt)}`);
      row.loadBtn.setAlpha(1);
      row.loadBtn.setInteractive({ useHandCursor: true });
    }
  }

  private async onButton(slot: SaveSlotId, action: 'save' | 'load'): Promise<void> {
    if (this.busy) return;
    const now = Date.now();
    const pending = this.pendingConfirm;
    if (pending === null || pending.slot !== slot || pending.action !== action || now > pending.until) {
      // 第一次点击：进入确认态；换按钮/超时即失效。
      this.pendingConfirm = { slot, action, until: now + CONFIRM_WINDOW_MS };
      this.refreshConfirmLabels();
      return;
    }

    this.pendingConfirm = null;
    this.busy = true;
    try {
      if (action === 'save') {
        await saveToSlot(slot, this.store);
        const slotDef = SAVE_SLOTS.find(s => s.id === slot);
        this.toast()?.show(`${slotDef?.label ?? slot} 已保存`, 'info', 2200);
        await this.refresh();
      } else {
        const state = await loadFromSlot(slot);
        if (state === null) {
          this.toast()?.show('该存档不存在或已损坏', 'error', 2600);
          await this.refresh();
        } else {
          this.store.replaceState(state);
          this.toast()?.show('读档成功', 'info', 2200);
          this.hide();
        }
      }
    } catch (err) {
      this.toast()?.show(`操作失败：${err instanceof Error ? err.message : String(err)}`, 'error', 3200);
    } finally {
      this.busy = false;
      this.refreshConfirmLabels();
    }
  }

  private refreshConfirmLabels(): void {
    const now = Date.now();
    const pending = this.pendingConfirm;
    for (const slot of SAVE_SLOTS) {
      const row = this.rows.get(slot.id);
      if (!row) continue;
      const saving = pending !== null && pending.slot === slot.id && pending.action === 'save' && now <= pending.until;
      const loading = pending !== null && pending.slot === slot.id && pending.action === 'load' && now <= pending.until;
      row.saveBtn.setText(saving ? '覆盖？' : '存档');
      row.loadBtn.setText(loading ? '读入？' : '读档');
    }
  }

  private toast(): { show: (m: string, kind?: 'info' | 'error', durationMs?: number) => void } | null {
    return registryGet(this.scene.registry, REGISTRY_KEYS.toast) as { show: (m: string, kind?: 'info' | 'error', durationMs?: number) => void } | undefined ?? null;
  }

  destroy(): void {
    this.container.destroy(true);
    this.backdrop.destroy(true);
  }
}
