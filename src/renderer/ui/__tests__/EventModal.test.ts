/**
 * EventModal 纯逻辑测试。Phaser scene/graphics/text/zone 全部 mock，
 * 不验证像素渲染——只验证：监听 EVENT_TRIGGERED → 弹出 → 选项调用 store.resolveEvent →
 * EVENT_RESOLVED → 关闭 + 恢复暂停 / 倒计时 / 古文白话 toggle。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { CourtEvent } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { EventModal } from '../EventModal';

// ---- fake Phaser scene ---------------------------------------------------

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    displayHeight: 24,
    text: '',
  };
  // 让 setText 同步更新 text 字段，方便断言
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
    input: { hitArea: { width: 0, height: 0 } },
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
  _handlers: Map<string, () => void>;
}

function makeFakeZone(): FakeZone {
  const handlers = new Map<string, () => void>();
  const zone: FakeZone = {
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
    on: vi.fn().mockImplementation(function (this: FakeZone, evt: string, fn: () => void) {
      handlers.set(evt, fn); return this;
    }),
    destroy: vi.fn(),
    _handlers: handlers,
  };
  zone.setOrigin.mockReturnValue(zone);
  zone.setInteractive.mockReturnValue(zone);
  return zone;
}

function makeFakeContainer() {
  return {
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
    visible: false,
  };
}

function makeFakeScene(scale = { width: 1366, height: 800 }) {
  const containers: ReturnType<typeof makeFakeContainer>[] = [];
  const zones: FakeZone[] = [];
  const texts: ReturnType<typeof makeFakeText>[] = [];
  const scene = {
    scale,
    add: {
      container: vi.fn(() => {
        const c = makeFakeContainer();
        // 让 setVisible 反映到 .visible 字段，便于断言 isVisible()
        c.setVisible = vi.fn().mockImplementation((v: boolean) => { c.visible = v; return c; });
        containers.push(c); return c;
      }),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(() => {
        const t = makeFakeText();
        texts.push(t); return t;
      }),
      zone: vi.fn(() => {
        const z = makeFakeZone();
        zones.push(z); return z;
      }),
    },
    registry: { get: vi.fn().mockReturnValue(undefined) },
    _containers: containers,
    _zones: zones,
    _texts: texts,
  };
  return scene as never;
}

// ---- fixtures ------------------------------------------------------------

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(events: CourtEvent[] = []): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { events });
}

const EVT_CHOICE: CourtEvent = {
  id: 'evt_test_choice',
  tags: ['抉择'],
  triggers: [],
  contexts: [{ condition: 'default', title: '邻邦遣使', desc: '齐使持璧来朝。', descPlain: '齐使来访。' }],
  choices: [
    { text: '设宴', textPlain: '答应结盟。', effects: [], removeEffects: [] },
    { text: '却之', textPlain: '婉拒。', effects: [], removeEffects: [] },
  ],
  defaultTimeoutDays: 7,
};

const EVT_NOTIFY: CourtEvent = {
  id: 'evt_locust',
  tags: ['负'],
  triggers: [],
  contexts: [{ condition: 'default', title: '飞蝗蔽天', desc: '蝗虫过境。', descPlain: '夏季蝗灾。' }],
  // 没有 choices → 单 [知道了] 按钮路径
};

// ---- tests ---------------------------------------------------------------

describe('EventModal', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let modal: EventModal;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore([EVT_CHOICE, EVT_NOTIFY]);
    modal = new EventModal(scene, store);
  });

  it('initially hidden when no pending event', () => {
    expect(modal.isVisible()).toBe(false);
    expect(modal.getCurrentEventId()).toBeNull();
  });

  it('shows when EVENT_TRIGGERED is emitted', () => {
    // 直接通过 store 设置 pending：模拟 tickDay 路径
    // store.runEventTick 是 private — 用 'as any' 取一下，或者直接 emit + 设状态
    // 这里用 emit 模拟（store 端 pendingEventId 必须先设上，否则 getPendingEvent 拿 null）
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 5;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(modal.isVisible()).toBe(true);
    expect(modal.getCurrentEventId()).toBe(EVT_CHOICE.id);
    expect(modal.getButtonCount()).toBe(2);
  });

  it('clicking choice calls store.resolveEvent and hides modal', () => {
    const resolveSpy = vi.spyOn(store, 'resolveEvent');
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(modal.isVisible()).toBe(true);

    modal.clickChoice(0);
    expect(resolveSpy).toHaveBeenCalledWith(0);
    // resolveEvent 内部会 emit EVENT_RESOLVED → handleResolved → hide
    expect(modal.isVisible()).toBe(false);
    expect(modal.getCurrentEventId()).toBeNull();
  });

  it('non-choice event shows single [知道了] button', () => {
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_NOTIFY.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_NOTIFY.id });
    expect(modal.getButtonCount()).toBe(1);
  });

  it('opening pauses the store; closing restores prev paused state', () => {
    expect(store.isPaused()).toBe(false);
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(store.isPaused()).toBe(true);
    modal.clickChoice(0);
    // resolveEvent 路径关闭 modal 并 setPaused(prevPaused=false)
    expect(store.isPaused()).toBe(false);
  });

  it('paused state is preserved if user was already paused', () => {
    store.setPaused(true);
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(store.isPaused()).toBe(true);
    modal.clickChoice(0);
    // prevPaused 是 true → 关闭后保持 paused
    expect(store.isPaused()).toBe(true);
  });

  it('STATE_REPLACED with no pending event closes modal but does NOT touch paused', () => {
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(modal.isVisible()).toBe(true);
    // 模拟加载新存档：清掉 pendingEventId 后 emit STATE_REPLACED
    (store as unknown as { state: { pendingEventId: string | null } }).state.pendingEventId = null;
    store.setPaused(false); // 假装 deserialize 把 paused 重置了
    store['emitter'].emit(STATE_EVENTS.STATE_REPLACED, undefined);
    expect(modal.isVisible()).toBe(false);
    // 应该不被强制改回 prevPaused（true）
    expect(store.isPaused()).toBe(false);
  });

  it('destroy unsubscribes from store events', () => {
    const before = store.listenerCount(STATE_EVENTS.EVENT_TRIGGERED);
    modal.destroy();
    const after = store.listenerCount(STATE_EVENTS.EVENT_TRIGGERED);
    expect(after).toBe(before - 1);
  });

  // Slice G hardening DeepSeek critical #2：destroy 时若仍持 pause hold 必须释放，
  // 否则 hot reload 会留一个永远软暂停的幽灵 holder。
  it('destroy releases pause hold if still open', () => {
    (store as unknown as { state: { pendingEventId: string | null; pendingEventDayStart: number | null } })
      .state.pendingEventId = EVT_CHOICE.id;
    (store as unknown as { state: { pendingEventDayStart: number | null } }).state.pendingEventDayStart = 0;
    store['emitter'].emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: EVT_CHOICE.id });
    expect(store.isPaused()).toBe(true);
    modal.destroy();
    // 没有 resolveEvent 路径，但 destroy 必须释放 pause hold
    expect(store.isPaused()).toBe(false);
  });
});
