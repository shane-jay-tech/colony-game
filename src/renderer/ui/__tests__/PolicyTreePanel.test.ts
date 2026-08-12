/**
 * PolicyTreePanel 纯逻辑测试。Phaser scene/graphics/text/zone/container 全 mock。
 * 验证：tab 切换 / open 时停 + close 恢复 / 点节点调 adoptPolicy / 点卡片调 adoptDecree /
 * 资源不足 toast / 已激活朝令提示 / destroy 解绑。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { PolicyNode, RoyalDecree } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { PolicyTreePanel } from '../PolicyTreePanel';

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    width: 100, height: 18, displayHeight: 18, text: '',
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
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
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
    setPosition: vi.fn().mockImplementation(function (this: FakeZone, x: number, y: number) { this.x = x; this.y = y; return this; }),
    setSize: vi.fn().mockImplementation(function (this: FakeZone, w: number, h: number) { this.width = w; this.height = h; return this; }),
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
    setScale: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeFakeScene(toast?: { show: ReturnType<typeof vi.fn> }) {
  const registryStore = new Map<string, unknown>();
  if (toast) registryStore.set('toast', toast);
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
      zone: vi.fn(makeFakeZone),
    },
    input: { on: vi.fn(), off: vi.fn() }, // 无 keyboard → 代码用 ?. 跳过
    registry: {
      get: vi.fn((k: string) => (k === 'toast' ? toast : registryStore.get(k))),
      set: vi.fn((k: string, v: unknown) => { registryStore.set(k, v); }),
    },
  } as never;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

const POL_FREE: PolicyNode = {
  id: 'pol_a', name: '甲策', branch: '农桑', x: 60, y: 80, cost: {},
  effects: [{ target: 'country_grain_output', op: 'mul', value: 1.2 }],
  prerequisites: [], tier: 1, description: '', descPlain: '增产',
};
const POL_NEEDS_PREREQ: PolicyNode = {
  id: 'pol_b', name: '乙策', branch: '农桑', x: 60, y: 200, cost: {},
  effects: [{ target: 'country_grain_output', op: 'add', value: 1 }],
  prerequisites: ['pol_a'], tier: 2, description: '', descPlain: '',
};
const POL_EXPENSIVE: PolicyNode = {
  id: 'pol_c', name: '丙策', branch: '工坊', x: 200, y: 80, cost: { gold: 9999 },
  effects: [{ target: 'country_wood_output', op: 'add', value: 1 }],
  prerequisites: [], tier: 1, description: '', descPlain: '',
};
const DECREE_FREE: RoyalDecree = {
  id: 'decree_a', name: '甲令', category: '内政', description: '', descPlain: '',
  unlockCondition: [],
  stages: [
    { order: 1, cost: {}, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
    { order: 2, cost: {}, days: 5, effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
  ],
};
const DECREE_EXPENSIVE: RoyalDecree = {
  id: 'decree_b', name: '乙令', category: '军事', description: '', descPlain: '',
  unlockCondition: [],
  stages: [{ order: 1, cost: { gold: 9999 }, days: 5, effects: [], removeEffects: [] }],
};

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() },
    { policies: [POL_FREE, POL_NEEDS_PREREQ, POL_EXPENSIVE], decrees: [DECREE_FREE, DECREE_EXPENSIVE] });
}

describe('PolicyTreePanel', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let panel: PolicyTreePanel;
  let toast: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { show: vi.fn() };
    scene = makeFakeScene(toast);
    store = makeStore();
    panel = new PolicyTreePanel(scene, store);
  });

  it('默认在国策 tab，构建了全部节点/卡片', () => {
    expect(panel.getCurrentTab()).toBe('policy');
    expect(panel.policyCount()).toBe(3);
    expect(panel.decreeCount()).toBe(2);
  });

  it('switchTo("decree") 切换 tab', () => {
    panel.switchTo('decree');
    expect(panel.getCurrentTab()).toBe('decree');
  });

  it('open() 让游戏时停，close() 恢复', () => {
    const wasPaused = store.isPaused();
    panel.open();
    expect(store.isPaused()).toBe(true);
    expect(panel.isVisible()).toBe(true);
    panel.close();
    expect(store.isPaused()).toBe(wasPaused);
    expect(panel.isVisible()).toBe(false);
  });

  it('toggle 在开/关之间切换', () => {
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('点免费无前置国策 → 调 adoptPolicy', () => {
    const spy = vi.spyOn(store, 'adoptPolicy');
    panel.clickPolicyByIndex(0);
    expect(spy).toHaveBeenCalledWith('pol_a');
  });

  it('点前置未满足的国策 → adoptPolicy 被拒，toast 提示前置', () => {
    panel.clickPolicyByIndex(1);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('前置');
  });

  it('点资源不足的国策 → toast 资源不足', () => {
    panel.clickPolicyByIndex(2);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('资源不足');
  });

  it('点免费朝令 → 调 adoptDecree', () => {
    const spy = vi.spyOn(store, 'adoptDecree');
    panel.clickDecreeByIndex(0);
    expect(spy).toHaveBeenCalledWith('decree_a');
  });

  it('点资源不足朝令 → toast 资源不足', () => {
    panel.clickDecreeByIndex(1);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('资源不足');
  });

  it('点已激活朝令 → toast 已在推进', () => {
    expect(store.adoptDecree('decree_a').ok).toBe(true);
    toast.show.mockClear();
    panel.clickDecreeByIndex(0);
    expect(toast.show).toHaveBeenCalled();
    expect(String(toast.show.mock.calls[0]?.[0])).toContain('已在推进');
  });

  it('open() 后 layout/refresh 不抛错（节点着色 + 连线 + 朝令进度跑通）', () => {
    expect(() => { panel.open(); panel.switchTo('decree'); panel.switchTo('policy'); }).not.toThrow();
  });

  it('destroy 解绑监听 + 释放时停', () => {
    panel.open();
    expect(store.isPaused()).toBe(true);
    const before = store.listenerCount(STATE_EVENTS.RESOURCES_CHANGED);
    panel.destroy();
    expect(store.listenerCount(STATE_EVENTS.RESOURCES_CHANGED)).toBe(before - 1);
    expect(store.isPaused()).toBe(false); // 释放了 pause holder
  });
});
