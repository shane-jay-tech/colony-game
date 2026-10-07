// CrisisModal 纯逻辑测试（c1010-02 首测）。Phaser scene 全 mock（同 EventModal.test.ts 式），
// 不验证像素渲染——只验证类头契约：CRISIS_TRIGGERED → 弹出＋requestPause('crisis') 软暂停；
// 单 [知道了] 按钮关闭 → releasePause 恢复；未触发不弹；重复触发不叠双模态；深度 2000。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { CrisisModal } from '../CrisisModal';
import { makeFakeContainer, makeFakeGraphics, makeFakeTextSized, makeFakeZone } from './fakeScene';

type FakeZone = ReturnType<typeof makeFakeZone>;

function makeFakeScene(scale = { width: 1366, height: 800 }) {
  const containers: ReturnType<typeof makeFakeContainer>[] = [];
  const zones: FakeZone[] = [];
  const scene = {
    scale,
    add: {
      container: vi.fn(() => {
        const c = makeFakeContainer();
        containers.push(c); return c;
      }),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(() => makeFakeTextSized(24)),
      zone: vi.fn(() => {
        const z = makeFakeZone();
        zones.push(z); return z;
      }),
    },
    registry: { get: vi.fn().mockReturnValue(undefined) },
    _containers: containers,
    _zones: zones,
  };
  return scene as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, undefined);
}

const pauseHoldersOf = (s: GameStore): string[] =>
  [...((s as unknown as { pauseHolders: Set<string> }).pauseHolders)];

const btnZoneOf = (m: CrisisModal): FakeZone =>
  (m as unknown as { btnZone: FakeZone }).btnZone;

const bodyTextOf = (m: CrisisModal): { text: string } =>
  (m as unknown as { bodyText: { text: string } }).bodyText;

function triggerCrisis(s: GameStore, summary = '国库空、仓廪罄。'): void {
  s['emitter'].emit(STATE_EVENTS.CRISIS_TRIGGERED, { kind: 'crisis', summary, crisisCount: 1 });
}

describe('CrisisModal', () => {
  let store: GameStore;
  let modal: CrisisModal;

  beforeEach(() => {
    store = makeStore();
    modal = new CrisisModal(makeFakeScene(), store);
  });

  it('CRISIS_TRIGGERED → 模态可见＋requestPause 软暂停＋正文取 summary', () => {
    triggerCrisis(store, '国库空、仓廪罄，旷日六旬。');
    expect(modal.isVisible()).toBe(true);
    expect(pauseHoldersOf(store)).toContain('crisis');
    expect(bodyTextOf(modal).text).toBe('国库空、仓廪罄，旷日六旬。');
  });

  it('[知道了] 按钮（btnZone pointerdown）→ 关闭＋releasePause 恢复', () => {
    triggerCrisis(store);
    expect(modal.isVisible()).toBe(true);
    btnZoneOf(modal).handlers['pointerdown']?.();
    expect(modal.isVisible()).toBe(false);
    expect(pauseHoldersOf(store)).not.toContain('crisis');
  });

  it('未触发不弹（container 初始不可见）且不持暂停', () => {
    expect(modal.isVisible()).toBe(false);
    expect(pauseHoldersOf(store)).not.toContain('crisis');
  });

  it('重复触发不叠双模态：requestPause 只持一次（holdsPause 闸），可见性幂等', () => {
    triggerCrisis(store);
    triggerCrisis(store);
    triggerCrisis(store);
    expect(modal.isVisible()).toBe(true);
    expect(pauseHoldersOf(store).filter((h) => h === 'crisis').length).toBeLessThanOrEqual(1);
  });

  it('容器深度 2000（类头契约）：setDepth(2000) 链式调用在位', () => {
    const c = (modal as unknown as {
      container: { setDepth: ReturnType<typeof vi.fn>; visible: boolean };
    }).container;
    expect(c.setDepth).toHaveBeenCalledWith(2000);
  });
});
