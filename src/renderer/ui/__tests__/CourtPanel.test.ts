/**
 * CourtPanel 纯逻辑测试。Phaser scene/graphics/text/zone 全部 mock，
 * 验证：tab 切换 / 点击 row 调用 adoptPolicy / adoptDecree / 已激活朝令进度状态 /
 * 资源不足时点击产生 toast / destroy 解绑事件。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { PolicyNode, RoyalDecree } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { CourtPanel } from '../CourtPanel';

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setMask: vi.fn().mockReturnThis(),
    clearMask: vi.fn().mockReturnThis(),
    setLineSpacing: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    setFontSize: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    displayHeight: 18,
    text: '',
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  return t;
}

function makeFakeGraphics() {
  const fakeMask = { destroy: vi.fn() };
  return {
    clear: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeRect: vi.fn().mockReturnThis(),
    // Slice I #67：装饰边框需要 path/圆形 API
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setMask: vi.fn().mockReturnThis(),
    clearMask: vi.fn().mockReturnThis(),
    createGeometryMask: vi.fn(() => fakeMask),
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
  return {
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeFakeScene(scale = { width: 1366, height: 800 }, toast?: { show: ReturnType<typeof vi.fn> }) {
  return {
    scale,
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
      zone: vi.fn(makeFakeZone),
    },
    input: {
      on: vi.fn(),
      off: vi.fn(),
    },
    tweens: {
      add: vi.fn(() => ({ stop: vi.fn(), remove: vi.fn() })),
      killTweensOf: vi.fn(),
    },
    registry: { get: vi.fn().mockReturnValue(toast) },
  } as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

const POL_FREE: PolicyNode = {
  id: 'pol_a', name: '甲策', branch: '农桑', x: 0, y: 0, cost: {},
  effects: [{ target: 'country_grain_output', op: 'add', value: 1 }],
  prerequisites: [], tier: 1, description: '', descPlain: '',
};

const POL_NEEDS_PREREQ: PolicyNode = {
  id: 'pol_b', name: '乙策', branch: '农桑', x: 0, y: 0, cost: {},
  effects: [{ target: 'country_grain_output', op: 'add', value: 1 }],
  prerequisites: ['pol_a'], tier: 2, description: '', descPlain: '',
};

const POL_EXPENSIVE: PolicyNode = {
  id: 'pol_c', name: '丙策', branch: '工坊', x: 0, y: 0, cost: { gold: 9999 },
  effects: [{ target: 'country_wood_output', op: 'add', value: 1 }],
  prerequisites: [], tier: 1, description: '', descPlain: '',
};

const DECREE_FREE: RoyalDecree = {
  id: 'decree_a',
  name: '甲令',
  category: '内政',
  description: '', descPlain: '',
  unlockCondition: [],
  stages: [
    { order: 1, cost: {}, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
    { order: 2, cost: {}, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
  ],
};

const DECREE_EXPENSIVE: RoyalDecree = {
  id: 'decree_b',
  name: '乙令',
  category: '内政',
  description: '', descPlain: '',
  unlockCondition: [],
  stages: [
    { order: 1, cost: { gold: 9999 }, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
  ],
};

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(
    ee,
    { worldMap: allPlainMap() },
    { policies: [POL_FREE, POL_NEEDS_PREREQ, POL_EXPENSIVE], decrees: [DECREE_FREE, DECREE_EXPENSIVE] },
  );
}

describe('CourtPanel', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let panel: CourtPanel;
  let toast: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { show: vi.fn() };
    scene = makeFakeScene(undefined, toast);
    store = makeStore();
    panel = new CourtPanel(scene, store);
  });

  it('starts on policy tab by default', () => {
    expect(panel.getCurrentTab()).toBe('policy');
  });

  it('switchTo("decree") changes tab', () => {
    panel.switchTo('decree');
    expect(panel.getCurrentTab()).toBe('decree');
  });

  it('clicking the first (free, no-prereq) policy row calls store.adoptPolicy', () => {
    const spy = vi.spyOn(store, 'adoptPolicy');
    panel.clickPolicyRow(0);
    expect(spy).toHaveBeenCalledWith('pol_a');
  });

  it('clicking a prereq-locked policy still calls adoptPolicy but result is rejected and toast shown', () => {
    const spy = vi.spyOn(store, 'adoptPolicy');
    // pol_b has prereq pol_a (not yet adopted)
    panel.clickPolicyRow(1);
    expect(spy).toHaveBeenCalledWith('pol_b');
    expect(toast.show).toHaveBeenCalled();
    const [msg] = toast.show.mock.calls[0]!;
    expect(String(msg)).toContain('前置');
  });

  it('clicking an unaffordable policy emits a toast', () => {
    const spy = vi.spyOn(store, 'adoptPolicy');
    panel.clickPolicyRow(2); // pol_c needs 9999 gold
    expect(spy).toHaveBeenCalledWith('pol_c');
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('资源不足');
  });

  it('clicking a free decree row calls store.adoptDecree', () => {
    const spy = vi.spyOn(store, 'adoptDecree');
    panel.clickDecreeRow(0);
    expect(spy).toHaveBeenCalledWith('decree_a');
  });

  it('clicking an unaffordable decree emits a toast', () => {
    panel.clickDecreeRow(1);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('资源不足');
  });

  it('clicking an already-active decree shows "已在推进" toast', () => {
    // 先采纳一次 decree_a
    const r = store.adoptDecree('decree_a');
    expect(r.ok).toBe(true);
    toast.show.mockClear();
    panel.clickDecreeRow(0);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('已在推进');
  });

  it('refreshes when POLICY_ADOPTED is emitted', () => {
    // 直接访问 store.adoptPolicy 会触发 POLICY_ADOPTED → onAdopted → refresh
    // 我们没法直接 spy 私有 refresh()，但可以 spy 一个被 refresh 调用的 store getter
    const spy = vi.spyOn(store, 'getResources');
    spy.mockClear();
    store.adoptPolicy('pol_a');
    expect(spy).toHaveBeenCalled();
  });

  it('destroy unsubscribes all listeners', () => {
    const before = {
      res: store.listenerCount(STATE_EVENTS.RESOURCES_CHANGED),
      pol: store.listenerCount(STATE_EVENTS.POLICY_ADOPTED),
      dec: store.listenerCount(STATE_EVENTS.DECREE_ADOPTED),
      day: store.listenerCount(STATE_EVENTS.DAY_TICK),
    };
    panel.destroy();
    expect(store.listenerCount(STATE_EVENTS.RESOURCES_CHANGED)).toBe(before.res - 1);
    expect(store.listenerCount(STATE_EVENTS.POLICY_ADOPTED)).toBe(before.pol - 1);
    expect(store.listenerCount(STATE_EVENTS.DECREE_ADOPTED)).toBe(before.dec - 1);
    expect(store.listenerCount(STATE_EVENTS.DAY_TICK)).toBe(before.day - 1);
  });
});
