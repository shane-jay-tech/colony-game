/**
 * c930-02：数字键串扰守卫——模态软暂停持有中（pauseHolders>0）时，1/2/3 不再
 * 静默改速度档/解暂停；非模态（用户 space 暂停或运行中）行为零变化
 * （「先恢复再定档」由 keyboardFlowFocusOrder.test.ts ④ 组既有钉桩承担，此处只做对照）。
 */
import { EventEmitter } from 'eventemitter3';
import { describe, expect, it, vi } from 'vitest';
import { GameScene } from '../GameScene';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

function plainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: plainMap() }, { policies: [], decrees: [] });
}

interface SpeedHandlers {
  store?: GameStore;
  spaceHandler: () => void;
  speedKeyHandler1: () => void;
  speedKeyHandler2: () => void;
  speedKeyHandler3: () => void;
}

function bareScene(): SpeedHandlers {
  return new GameScene() as unknown as SpeedHandlers;
}

describe('c930-02 数字键串扰守卫', () => {
  it('模态软暂停持有中：按 1/2/3 不解暂停、不改速度档', () => {
    const scene = bareScene();
    const store = makeStore();
    scene.store = store;
    store.requestPause('EventModal'); // 模态开（软暂停持有中）
    const speedBefore = store.getSpeed();
    scene.speedKeyHandler1();
    scene.speedKeyHandler2();
    scene.speedKeyHandler3();
    expect(store.hasPauseHolders()).toBe(true);
    expect(store.isPaused()).toBe(true); // 暂停未被解（游戏不会在抉择期间跑起来）
    expect(store.getSpeed()).toBe(speedBefore); // 速度档未被静默改掉
  });

  it('非模态对照：用户 space 暂停后按 2 照旧「先恢复再定档」', () => {
    const scene = bareScene();
    const store = makeStore();
    scene.store = store;
    scene.spaceHandler(); // 用户口暂停（无 pauseHolders）
    expect(store.hasPauseHolders()).toBe(false);
    scene.speedKeyHandler2();
    expect(store.isPaused()).toBe(false);
    expect(store.getSpeed()).toBe(2);
  });
});
