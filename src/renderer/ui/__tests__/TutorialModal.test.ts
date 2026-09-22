/**
 * TutorialModal 纯逻辑测试。Phaser scene/graphics/text/zone 全部 mock，
 * 验证：默认弹起 / 点击"开始游戏" → setTutorialStepId(null) + hide /
 * 重置回 'tut_welcome' 重开 / 暂停语义保留 / destroy 解绑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { TutorialModal } from '../TutorialModal';
import { makeFakeContainer, makeFakeGraphics, makeFakeTextSized, makeFakeZone } from './fakeScene';

type FakeZone = ReturnType<typeof makeFakeZone>;

// c923-02（批五）：本地 makeFakeText/makeFakeGraphics 副本收编进共享 fakeScene。
// 本模态把 text.displayHeight 当**布局输入**（TutorialModal.ts:210/215 直读），原副本是 22，
// 故经 makeFakeTextSized(22) 显式声明而非退回共享件默认 18；graphics 方法表是共享件子集、直用共享件。

function makeFakeScene(scale = { width: 1366, height: 800 }) {
  return {
    scale,
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(() => makeFakeTextSized(22)),
      zone: vi.fn(makeFakeZone),
    },
    registry: { get: vi.fn().mockReturnValue(undefined) },
  } as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() });
}

describe('TutorialModal', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let modal: TutorialModal;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore();
  });

  it('opens automatically when default state has tutorialStepId="tut_welcome"', () => {
    expect(store.getTutorialStepId()).toBe('tut_welcome');
    modal = new TutorialModal(scene, store);
    expect(modal.isVisible()).toBe(true);
  });

  it('opening pauses the store', () => {
    expect(store.isPaused()).toBe(false);
    modal = new TutorialModal(scene, store);
    expect(store.isPaused()).toBe(true);
  });

  it('clickStart() hides modal and clears tutorialStepId', () => {
    modal = new TutorialModal(scene, store);
    expect(modal.isVisible()).toBe(true);
    modal.clickStart();
    expect(modal.isVisible()).toBe(false);
    expect(store.getTutorialStepId()).toBeNull();
  });

  it('clickStart() restores prevPaused (false → false)', () => {
    modal = new TutorialModal(scene, store);
    expect(store.isPaused()).toBe(true);
    modal.clickStart();
    expect(store.isPaused()).toBe(false);
  });

  it('clickStart() preserves prevPaused if user was already paused', () => {
    store.setPaused(true);
    modal = new TutorialModal(scene, store);
    expect(store.isPaused()).toBe(true);
    modal.clickStart();
    expect(store.isPaused()).toBe(true);
  });

  it('does NOT auto-open when state has tutorialStepId=null (e.g. loaded save)', () => {
    store.setTutorialStepId(null);
    modal = new TutorialModal(scene, store);
    expect(modal.isVisible()).toBe(false);
  });

  it('reopens when setTutorialStepId("tut_welcome") is called after dismissal', () => {
    modal = new TutorialModal(scene, store);
    modal.clickStart();
    expect(modal.isVisible()).toBe(false);
    store.setTutorialStepId('tut_welcome');
    expect(modal.isVisible()).toBe(true);
  });

  it('STATE_REPLACED with tutorialStepId=null hides an open modal but does NOT touch paused', () => {
    modal = new TutorialModal(scene, store);
    expect(modal.isVisible()).toBe(true);
    // 模拟加载存档：直接改 state 字段，再 emit STATE_REPLACED
    (store as unknown as { state: { tutorialStepId: string | null } }).state.tutorialStepId = null;
    store.setPaused(false); // 假装新存档是 unpaused
    store['emitter'].emit(STATE_EVENTS.STATE_REPLACED, undefined);
    expect(modal.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
  });

  it('STATE_REPLACED with tutorialStepId="tut_welcome" reopens modal (e.g. fresh-game save)', () => {
    store.setTutorialStepId(null);
    modal = new TutorialModal(scene, store);
    expect(modal.isVisible()).toBe(false);
    (store as unknown as { state: { tutorialStepId: string | null } }).state.tutorialStepId = 'tut_welcome';
    store['emitter'].emit(STATE_EVENTS.STATE_REPLACED, undefined);
    expect(modal.isVisible()).toBe(true);
  });

  it('destroy unsubscribes from TUTORIAL_STEP_CHANGED + STATE_REPLACED', () => {
    modal = new TutorialModal(scene, store);
    const before = {
      step: store.listenerCount(STATE_EVENTS.TUTORIAL_STEP_CHANGED),
      replaced: store.listenerCount(STATE_EVENTS.STATE_REPLACED),
    };
    modal.destroy();
    expect(store.listenerCount(STATE_EVENTS.TUTORIAL_STEP_CHANGED)).toBe(before.step - 1);
    expect(store.listenerCount(STATE_EVENTS.STATE_REPLACED)).toBe(before.replaced - 1);
  });

  // DeepSeek critical #2：destroy 时若仍开着模态，必须释放 pause hold（避免 hot reload 幽灵）
  it('destroy releases pause hold if modal is open', () => {
    modal = new TutorialModal(scene, store);
    expect(store.isPaused()).toBe(true);
    modal.destroy();
    expect(store.isPaused()).toBe(false);
  });

  // DeepSeek critical #1 衍生：嵌套 EventModal + TutorialModal 不互踩
  it('two modal-like holders coexist (event + tutorial)', () => {
    modal = new TutorialModal(scene, store);
    expect(store.isPaused()).toBe(true); // tutorial holds
    store.requestPause('event'); // 模拟 EventModal 也开
    modal.clickStart(); // tutorial 释放
    expect(store.isPaused()).toBe(true); // event 还 holds
    store.releasePause('event');
    expect(store.isPaused()).toBe(false);
  });
});
