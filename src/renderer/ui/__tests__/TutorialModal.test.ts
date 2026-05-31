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

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    displayHeight: 22,
    text: '',
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  return t;
}

function makeFakeGraphics() {
  return {
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

interface FakeZone {
  x: number; y: number; width: number; height: number;
  setOrigin: ReturnType<typeof vi.fn>;
  setInteractive: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeFakeZone(): FakeZone {
  const z: FakeZone = {
    x: 0, y: 0, width: 1, height: 1,
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockImplementation(function (this: FakeZone, x: number, y: number) {
      this.x = x; this.y = y; return this;
    }),
    setSize: vi.fn().mockImplementation(function (this: FakeZone, w: number, h: number) {
      this.width = w; this.height = h; return this;
    }),
    setVisible: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  return z;
}

function makeFakeContainer() {
  const c = {
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
    visible: false,
  };
  c.setVisible = vi.fn().mockImplementation((v: boolean) => { c.visible = v; return c; });
  return c;
}

function makeFakeScene(scale = { width: 1366, height: 800 }) {
  return {
    scale,
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
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
