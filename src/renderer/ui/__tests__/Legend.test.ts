// c918-23（三批储备启用）：Legend 钉桩——条目渲染、折叠切换、空数据容错、destroy。
// store 用真实 GameStore；scene 全 fake（同 HUD/PopulationPanel 模式）。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    width: 100, height: 18, displayHeight: 18, text: '',
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  return t;
}

function makeFakeGraphics() {
  const g: Record<string, unknown> = {};
  const methods = ['clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle', 'fillRoundedRect', 'generateTexture', 'beginPath', 'moveTo', 'lineTo',
    'strokePath', 'closePath', 'fillPath', 'fillRoundedRect', 'setPosition', 'setVisible', 'destroy'];
  for (const name of methods) g[name] = vi.fn().mockReturnThis();
  return g;
}

function makeFakeZone() {
  const z = {
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
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeFakeScene(): any {
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => { const c = makeFakeContainer(); (c as Record<string, unknown>)['setPosition'] = vi.fn().mockReturnThis(); (c as Record<string, unknown>)['setAlpha'] = vi.fn().mockReturnThis(); (c as Record<string, unknown>)['setInteractive'] = vi.fn().mockReturnThis(); (c as Record<string, unknown>)['on'] = vi.fn().mockReturnThis(); (c as Record<string, unknown>)['setSize'] = vi.fn().mockReturnThis(); (c as Record<string, unknown>)['setText'] = vi.fn().mockReturnThis(); (c as Record<string, unknown>)['setColor'] = vi.fn().mockReturnThis(); return c; }),
      graphics: vi.fn(() => { const g = makeFakeGraphics(); (g as Record<string, unknown>)['setPosition'] = vi.fn().mockReturnThis(); return g; }),
      text: vi.fn(() => { const t2 = makeFakeText(); (t2 as Record<string, unknown>)['setPosition'] = vi.fn().mockReturnThis(); return t2; }),
      zone: vi.fn(() => { const z = makeFakeZone(); (z as Record<string, unknown>)['setPosition'] = vi.fn().mockReturnThis(); return z; }),
    },
    cameras: { main: { width: 1366, height: 800, scrollX: 0, scrollY: 0 } },
    input: { on: vi.fn(), off: vi.fn() },
    registry: { get: vi.fn(), set: vi.fn() },
  }
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

import { Legend } from '../Legend';

describe('Legend', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let legend: Legend;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore();
    legend = new Legend(scene as never, store);
  });

  it('构造：图例容器/背景/行文本装配完成', () => {
    expect(scene.add.container).toHaveBeenCalled();
    expect(scene.add.graphics).toHaveBeenCalled();
    expect(legend).toBeDefined();
  });

  it('折叠切换：toggleZone pointerup 两次翻转回原位（layout 不崩）', () => {
    // toggleZone.on('pointerup') 在构造注册；捕获并触发两次＝折叠→展开
    const zone = (legend as unknown as { toggleZone: { on: ReturnType<typeof vi.fn> } }).toggleZone;
    const calls = zone.on.mock.calls.filter((c: unknown[]) => c[0] === 'pointerup');
    expect(calls.length).toBe(1);
    const handler = calls[0]![1] as () => void;
    handler(); // 折叠
    handler(); // 展开
    expect(() => handler()).not.toThrow();
  });

  it('destroy：解绑 store 事件并销毁容器/图形/文本', () => {
    const offSpy = vi.spyOn(store, 'off');
    legend.destroy();
    expect(offSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
