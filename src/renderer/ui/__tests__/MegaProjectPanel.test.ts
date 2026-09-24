/**
 * MegaProjectPanel 逻辑测试。验证：open/close 时停；兴建无前置工程(修直道)成功、
 * 有前置(铸九鼎需太庙)被挡；destroy 解绑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import { MegaProjectPanel } from '../MegaProjectPanel';

function fakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(), setColor: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), setFontSize: vi.fn().mockReturnThis(),
    destroy: vi.fn(), width: 80, height: 18,
  };
  return t;
}
function fakeGfx() {
  return {
    clear: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(), strokeRect: vi.fn().mockReturnThis(), beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(), lineTo: vi.fn().mockReturnThis(), strokePath: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(), strokeCircle: vi.fn().mockReturnThis(), lineBetween: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}
function fakeZone() {
  return {
    setOrigin: vi.fn().mockReturnThis(), setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(), setSize: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(), destroy: vi.fn(),
  };
}
function fakeContainer() {
  return {
    setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
    add: vi.fn(), destroy: vi.fn(),
  };
}
function fakeScene(toast?: { show: ReturnType<typeof vi.fn> }) {
  return {
    scale: { width: 1366, height: 800 },
    add: { container: vi.fn(fakeContainer), graphics: vi.fn(fakeGfx), text: vi.fn(fakeText), zone: vi.fn(fakeZone) },
    registry: { get: vi.fn((k: string) => (k === 'toast' ? toast : undefined)) },
  } as never;
}

describe('MegaProjectPanel', () => {
  let store: GameStore;
  let panel: MegaProjectPanel;
  let toast: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { show: vi.fn() };
    const raw = new EventEmitter() as unknown as IEventEmitter;
    store = new GameStore(raw);
    panel = new MegaProjectPanel(fakeScene(toast), store);
  });

  it('构建了 3 个工程卡', () => {
    expect(panel.getCardCount()).toBe(3);
  });

  it('open 时停、close 恢复', () => {
    const was = store.isPaused();
    panel.open();
    expect(panel.isVisible()).toBe(true);
    expect(store.isPaused()).toBe(true);
    panel.close();
    expect(store.isPaused()).toBe(was);
  });

  it('兴建无前置工程(修直道,idx2) → 进入 megaProjects', () => {
    const spy = vi.spyOn(store, 'startMegaProject');
    panel.open();
    panel.startByIndex(2); // proj_royal_road，无前置
    expect(spy).toHaveBeenCalledWith('proj_royal_road');
    expect(store.getMegaProjects().some(p => p.projectId === 'proj_royal_road')).toBe(true);
  });

  it('兴建有前置工程(铸九鼎,idx0,需太庙) → 无太庙被挡 + error toast', () => {
    panel.open();
    panel.startByIndex(0); // proj_nine_cauldrons，需 bld_grand_temple
    expect(store.getMegaProjects().some(p => p.projectId === 'proj_nine_cauldrons')).toBe(false);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls.at(-1)?.[0])).toContain('太庙');
  });

  it('destroy 解绑 + 释放时停', () => {
    panel.open();
    const before = store.listenerCount(STATE_EVENTS.MEGA_PROJECT_STARTED);
    panel.destroy();
    expect(store.listenerCount(STATE_EVENTS.MEGA_PROJECT_STARTED)).toBe(before - 1);
    expect(store.isPaused()).toBe(false);
  });

  // c924-18（面板 handlers 真路径扩面批二）：下面两例**不调 startByIndex 测试后门**（:268），
  // 而是触发生产代码亲手经 zone.on('pointerup', …) 登记的那个回调本体（MegaProjectPanel.ts:86/:98/:127）。
  // ⚠ 本件用的是文件内本地 fakeZone（:29-35）：它的 on 只 vi.fn().mockReturnThis()、不建 handlers 表
  //   （与 fakeScene.makeFakeZone 不同型），故从 on.mock.calls 取回回调——取到的仍是面板自己的闭包。
  type ZoneWithSpy = { on: { mock: { calls: Array<[string, (...a: unknown[]) => void]> } } };
  const internals = (p: MegaProjectPanel) =>
    p as unknown as { overlayZone: ZoneWithSpy; closeZone: ZoneWithSpy;
      cards: Array<{ def: { id: string; name: string }; zone: ZoneWithSpy }> };
  function clickOf(zone: ZoneWithSpy, ev: string): (...a: unknown[]) => void {
    const hit = zone.on.mock.calls.find((c) => c[0] === ev);
    expect(hit, `面板未在该 zone 上登记 ${ev}（断线即红）`).toBeTruthy();
    expect(typeof hit![1]).toBe('function');
    return hit![1];
  }

  it('真路径：点工程卡 zone 的 pointerup → 立项落账 + info toast；重放被面板自己挡住', () => {
    const card = internals(panel).cards[2]!; // proj_royal_road（无前置，同 :75 老例的卡）
    const click = clickOf(card.zone, 'pointerup');
    panel.open();
    const spy = vi.spyOn(store, 'startMegaProject');
    const hasIt = () => store.getMegaProjects().some((p) => p.projectId === card.def.id);
    expect(hasIt()).toBe(false); // 动手前基线
    click();
    expect(spy).toHaveBeenCalledWith(card.def.id);
    expect(hasIt()).toBe(true);
    expect(String(toast.show.mock.calls.at(-1)?.[0])).toContain('已兴');
    const n = store.getMegaProjects().length;
    click(); // 反向：同一 handler 重放不得再加条目
    expect(store.getMegaProjects()).toHaveLength(n);
    expect(String(toast.show.mock.calls.at(-1)?.[0])).toContain('已在兴建或已成');
  });

  it('真路径：✕ zone 与遮罩 zone 的 pointerup 各自关面板并释放时停（不经 close() 直调）', () => {
    const { closeZone, overlayZone } = internals(panel);
    const clickClose = clickOf(closeZone, 'pointerup');
    const clickOverlay = clickOf(overlayZone, 'pointerup');
    panel.open();
    expect(panel.isVisible()).toBe(true);
    expect(store.isPaused()).toBe(true);
    clickClose();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
    clickClose(); // 反向：已关再点 → close() 早退，不得复活面板
    expect(panel.isVisible()).toBe(false);
    panel.open();
    clickOverlay();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
  });
});
