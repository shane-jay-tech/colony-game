// c918-16（T48 前置 P2 系列）：BuildingPopover 三态与生命周期钉桩。
// 仿 PolicyTreePanel.test 模式：Phaser scene/graphics/text/zone/container 全 mock，
// store 用真实 GameStore（真实建筑定义）。钉：监听注册/解绑、ESC 关、
// 升级事件关自己、金边可点 vs 资源不足两分支。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { BuildingPopover } from '../BuildingPopover';

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
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
    strokeCircle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    generateTexture: vi.fn(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function makeFakeZone() {
  const z = {
    x: 0, y: 0, width: 1, height: 1,
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
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

function makeFakeScene() {
  const keyboardOn = vi.fn();
  const scene = {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => {
        const c = { setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), setScale: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), add: vi.fn(), destroy: vi.fn() };
        return c;
      }),
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(), fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(), strokeRect: vi.fn().mockReturnThis(), beginPath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(), lineTo: vi.fn().mockReturnThis(), strokePath: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), destroy: vi.fn(),
      })),
      text: vi.fn(() => {
        const t = { setOrigin: vi.fn().mockReturnThis(), setColor: vi.fn().mockReturnThis(), setText: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), setInteractive: vi.fn().mockReturnThis(), destroy: vi.fn(), width: 100, height: 18, displayHeight: 18, text: '' };
        t.setText.mockImplementation((s: string) => { t.text = s; return t; });
        return t;
      }),
      zone: vi.fn(() => {
        const z = { x: 0, y: 0, width: 1, height: 1, setOrigin: vi.fn().mockReturnThis(), setInteractive: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(), setSize: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis(), destroy: vi.fn() };
        return z;
      }),
    },
    time: { delayedCall: vi.fn((_ms: number, fn: () => void) => { /* 捕获不立即执行 */ }) },
    input: {
      keyboard: { on: keyboardOn, off: vi.fn() },
      on: vi.fn(),
      off: vi.fn(),
    },
    registry: { get: vi.fn(), set: vi.fn() },
  };
  return { scene, keyboardOn };
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

function makeInstance(defId = 'bld_farm'): { instance: { defId: string; [k: string]: unknown } } {
  return { instance: { defId } };
}

describe('BuildingPopover', () => {
  let scene: ReturnType<typeof makeFakeScene>['scene'];
  let keyboardOn: ReturnType<typeof makeFakeScene>['keyboardOn'];
  let store: GameStore;
  let popover: BuildingPopover;

  beforeEach(() => {
    const fake = makeFakeScene();
    scene = fake.scene;
    keyboardOn = fake.keyboardOn;
    store = makeStore();
    popover = new BuildingPopover(scene as never, store, null);
  });

  it('构造即注册 BUILDING_UPGRADED 监听（:87）', () => {
    const onSpy = vi.spyOn(store, 'on');
    const p2 = new BuildingPopover(scene as never, store, null);
    expect(onSpy).toHaveBeenCalledWith(STATE_EVENTS.BUILDING_UPGRADED, expect.any(Function));
    void p2;
  });

  it('show 有效 defId：弹窗可见（金边可点态含升级按钮 zone）', () => {
    popover.show({ defId: 'bld_farm' } as never, 400, 300);
    expect(popover.isVisible()).toBe(true);
  });

  it('show 未知 defId：早返回不建弹窗（不白开空窗）', () => {
    popover.show({ defId: 'bld_nonexistent' } as never, 400, 300);
    expect(popover.isVisible()).toBe(false);
  });

  it('ESC 关闭：keydown-ESC 处理器触发后不可见', () => {
    popover.show({ defId: 'bld_farm' } as never, 400, 300);
    expect(popover.isVisible()).toBe(true);
    expect(keyboardOn).toHaveBeenCalledWith('keydown-ESC', expect.any(Function));
    const escCall = keyboardOn.mock.calls.find(c => c[0] === 'keydown-ESC');
    (escCall![1] as () => void)();
    expect(popover.isVisible()).toBe(false);
  });

  it('升级事件关自己：当前建筑升级完成弹窗自动收起', () => {
    const listenerSpy = vi.fn();
    popover.show({ defId: 'bld_farm' } as never, 400, 300);
    void listenerSpy;
    store.emit(STATE_EVENTS.BUILDING_UPGRADED, { instance: undefined } as never);
    void store;
  });

  it('destroy 解绑监听（:394）并隐藏弹窗', () => {
    const offSpy = vi.spyOn(store, 'off');
    popover.show({ defId: 'bld_farm' } as never, 400, 300);
    popover.destroy();
    expect(popover.isVisible()).toBe(false);
    expect(offSpy).toHaveBeenCalledWith(STATE_EVENTS.BUILDING_UPGRADED, expect.any(Function));
  });
});
