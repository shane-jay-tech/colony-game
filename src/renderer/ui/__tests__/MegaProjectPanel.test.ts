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
});
