// l1007-21：PolicyTreePanel ESC 分支行为覆盖（4686 遗留 4）——fake scene 补 keyboard 桩。
// 仅本档用带 keyboard 的 scene（与 PolicyTreePanel.test.ts 的无 keyboard fake 零重复）；
// 拖树装配最小化：复用该档的 allPlainMap/makeStore 形状自建（不 import 既有测试文件）。
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { PolicyTreePanel } from '../PolicyTreePanel';
import { GameStore } from '../../state/gameStore';
import type { PolicyNode, RoyalDecree } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import type { IEventEmitter } from '../../state/gameStore';

type KeyHandler = (event?: unknown) => void;

// c1014-06 类型修：ReturnType<typeof vi.fn> 在当前 vitest 泛型解析下与带实现重载互斥
// （TS2322），改普通可调用形——vi.fn 实现结构兼容，行为零变化。
interface FakeKeyboard { on: (tag: string, fn: KeyHandler) => void; off: (tag: string) => void; emit: (tag: string) => void; }
interface FakeScene { [k: string]: unknown; input: { on: (tag: string, fn?: KeyHandler) => void; off: (tag: string) => void; keyboard?: FakeKeyboard }; }

function makeFakeSceneWithKeyboard() {
  const registryStore = new Map<string, unknown>();
  const keyHandlers = new Map<string, KeyHandler>();
  const keyboard: FakeKeyboard = {
    on: vi.fn((tag: string, fn: KeyHandler) => { keyHandlers.set(tag, fn); }),
    off: vi.fn((tag: string) => { keyHandlers.delete(tag); }),
    emit: (tag: string) => { keyHandlers.get(tag)?.(); },
  };
  const chainStub = (): Record<string, unknown> => {
    const stub: Record<string, unknown> = new Proxy({}, {
      get: (_t, prop) => {
        if (prop === 'list') return [];
        if (prop === 'text' || prop === 'toString') return '';
        if (prop === 'length' || prop === 'width' || prop === 'height') return 0;
        return vi.fn(() => stub);
      },
    });
    return stub;
  };
  const scene: FakeScene = {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => chainStub()),
      graphics: vi.fn(() => chainStub()),
      text: vi.fn(() => chainStub()),
      zone: vi.fn(() => chainStub()),
    },
    input: { on: vi.fn(), off: vi.fn(), keyboard },
    registry: {
      get: vi.fn((k: string) => registryStore.get(k)),
      set: vi.fn((k: string, v: unknown) => { registryStore.set(k, v); }),
    },
  };
  return { scene: scene as unknown as Phaser.Scene, keyboard };
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

const POL: PolicyNode = {
  id: 'pol_a', name: '甲策', branch: '农桑', x: 60, y: 80, cost: {},
  effects: [{ target: 'country_grain_output', op: 'mul', value: 1.2 }],
  prerequisites: [], tier: 1, description: '', descPlain: '增产',
};
const DECREE: RoyalDecree = {
  id: 'decree_a', name: '甲令', category: '内政', description: '', descPlain: '',
  unlockCondition: [], stages: [{ order: 1, cost: {}, days: 5, effects: [], removeEffects: [] }],
};

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() },
    { policies: [POL], decrees: [DECREE] });
}

describe('PolicyTreePanel ESC 分支（带 keyboard 的 fake scene）', () => {
  let scene: Phaser.Scene;
  let keyboard: FakeKeyboard;
  let store: GameStore;
  let panel: PolicyTreePanel;

  beforeEach(() => {
    const env = makeFakeSceneWithKeyboard();
    scene = env.scene;
    keyboard = env.keyboard;
    store = makeStore();
    panel = new PolicyTreePanel(scene, store);
  });

  it('open 后按 ESC → 面板关闭且 keydown-ESC 监听已注册', () => {
    panel.open();
    expect(keyboard.on).toHaveBeenCalledWith('keydown-ESC', expect.anything(), panel);
    keyboard.emit('keydown-ESC');
    expect((panel as unknown as { isOpen: boolean }).isOpen).toBe(false);
  });

  it('未 open 时 ESC → 不触发 close 副作用（isOpen 守卫）', () => {
    keyboard.emit('keydown-ESC');
    expect((panel as unknown as { isOpen: boolean }).isOpen).toBe(false);
    expect(treePanelOpenFlag(scene)).toBeFalsy();
  });

  it('close 只隐藏面板（ESC 监听保留、再按无副作用），destroy 才解绑', () => {
    panel.open();
    panel.close();
    // 现值语义：close=隐藏不解绑（keydown-ESC 的 off 在 destroy :787）
    expect(keyboard.off).not.toHaveBeenCalledWith('keydown-ESC', expect.anything(), panel);
    keyboard.emit('keydown-ESC');
    expect((panel as unknown as { isOpen: boolean }).isOpen).toBe(false);
    panel.destroy();
    expect(keyboard.off).toHaveBeenCalledWith('keydown-ESC', expect.anything(), panel);
  });
});

function treePanelOpenFlag(s: unknown): unknown {
  return (s as { registry: { get: (k: string) => unknown } }).registry.get('treePanelOpen');
}
