/**
 * FactionDemandModal 逻辑测试。验证：FACTION_DEMAND_TRIGGERED 弹出 + 时停；
 * 接受/拒绝调 resolveFactionDemand + 关闭 + 恢复；destroy 解绑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import { FactionDemandModal } from '../FactionDemandModal';
import { FACTION_DEMANDS } from '../../data/factions';
import { makeFakeGraphics, makeFakeTextSized, makeFakeZone } from './fakeScene';

function fakeScene() {
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => ({
        setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(), add: vi.fn(), destroy: vi.fn(),
      })),
      graphics: vi.fn(() => makeFakeGraphics()),
      // c930-13：本模态布局只直读 .height（FactionDemandModal.ts:138-139），不读 displayHeight
      // ⇒ 首参取 20（与旧本地 fakeText 的 height 同值），size 对齐旧 {width:120, height:20}。
      text: vi.fn(() => makeFakeTextSized(20, { width: 120, height: 20 })),
      zone: vi.fn(() => makeFakeZone()),
    },
  } as never;
}

describe('FactionDemandModal', () => {
  let store: GameStore;
  let raw: IEventEmitter;
  let modal: FactionDemandModal;

  beforeEach(() => {
    raw = new EventEmitter() as unknown as IEventEmitter;
    store = new GameStore(raw);
    modal = new FactionDemandModal(fakeScene(), store);
  });

  function trigger() {
    const demand = FACTION_DEMANDS[0]!; // 豪强请减赋
    raw.emit(STATE_EVENTS.FACTION_DEMAND_TRIGGERED, { demand, factionName: '豪强' });
  }

  it('诉求触发 → 弹出并时停', () => {
    const wasPaused = store.isPaused();
    trigger();
    expect(modal.isVisible()).toBe(true);
    expect(store.isPaused()).toBe(true);
    expect(wasPaused).toBe(false);
  });

  it('接受 → 调 resolveFactionDemand(true) + 关闭 + 恢复', () => {
    const spy = vi.spyOn(store, 'resolveFactionDemand');
    trigger();
    modal.resolveForTest(true);
    expect(spy).toHaveBeenCalledWith(true);
    expect(modal.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
  });

  it('拒绝 → 调 resolveFactionDemand(false) + 关闭', () => {
    const spy = vi.spyOn(store, 'resolveFactionDemand');
    trigger();
    modal.resolveForTest(false);
    expect(spy).toHaveBeenCalledWith(false);
    expect(modal.isVisible()).toBe(false);
  });

  it('FACTION_DEMAND_RESOLVED（外部解决）→ 关闭兜底', () => {
    trigger();
    expect(modal.isVisible()).toBe(true);
    raw.emit(STATE_EVENTS.FACTION_DEMAND_RESOLVED, { demandId: 'x', accepted: true });
    expect(modal.isVisible()).toBe(false);
  });

  it('destroy 解绑监听 + 释放时停', () => {
    trigger();
    expect(store.isPaused()).toBe(true);
    const before = store.listenerCount(STATE_EVENTS.FACTION_DEMAND_TRIGGERED);
    modal.destroy();
    expect(store.listenerCount(STATE_EVENTS.FACTION_DEMAND_TRIGGERED)).toBe(before - 1);
    expect(store.isPaused()).toBe(false);
  });
});
