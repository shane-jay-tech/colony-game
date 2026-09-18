// c918-19：PopulationPanel 阶层行/缺口文案/undefined 容错钉桩。
// store 用真实 GameStore；scene 全 fake（同 PolicyTreePanel 模式）。
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
    destroy: vi.fn(),
    width: 100, height: 18, displayHeight: 18, text: '',
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  return t;
}

function makeFakeGraphics() {
  const g: Record<string, unknown> = {};
  const methods = ['clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'beginPath', 'moveTo', 'lineTo', 'strokePath', 'closePath', 'fillPath', 'fillRoundedRect',
    'strokeRoundedRect', 'generateTexture', 'setPosition', 'setVisible', 'destroy'];
  for (const name of methods) g[name] = vi.fn().mockReturnThis();
  return g;
}

function makeFakeZone() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function makeFakeScene() {
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => ({ setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(), add: vi.fn(), destroy: vi.fn() })),
      graphics: vi.fn(() => {
        const g: Record<string, unknown> = {};
        const methods = ['clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
          'beginPath', 'moveTo', 'lineTo', 'strokePath', 'closePath', 'fillPath', 'fillRoundedRect',
          'strokeRoundedRect', 'generateTexture', 'setPosition', 'setVisible', 'destroy'];
        for (const name of methods) g[name] = vi.fn().mockReturnThis();
        return g;
      }),
      text: vi.fn(() => makeFakeText()),
      zone: vi.fn(() => makeFakeZone()),
    },
    input: { on: vi.fn(), off: vi.fn() },
    registry: { get: vi.fn(), set: vi.fn() },
  };
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

import { PopulationPanel } from '../PopulationPanel';

describe('PopulationPanel', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let panel: PopulationPanel;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore();
    panel = new PopulationPanel(scene as never, store);
  });

  it('open 后各阶层行渲染含名称与数量（初始无 undefined/NaN 字样）', () => {
    panel.open();
    const texts = (scene.add.text as ReturnType<typeof vi.fn>).mock.results
      .map(r => r.value?.text ?? '');
    const all = texts.join('\n');
    expect(all).not.toMatch(/undefined|NaN/);
  });

  it('getClassNeedsGaps 缺口文案进阶层行（缺：安居·市集）', () => {
    vi.spyOn(store, 'getClassNeedsGaps').mockImplementation(() => {
      const record: Record<string, string[]> = { worker: ['安居', '市集'] };
      return new Proxy(record, {
        get: (target, prop) => (prop in target ? target[prop as string] : []),
      }) as Record<string, string[]>;
    });
    panel.open();
    const texts = (scene.add.text as ReturnType<typeof vi.fn>).mock.results
      .map(r => r.value?.text ?? '');
    expect(texts.some(t => t.includes('缺：安居·市集'))).toBe(true);
  });

  it('undefined 容错：某阶层键缺失时按 0 计而非 NaN', () => {
    const summary = store.getPopulationStatus() as unknown as {
      classes: Record<string, number | undefined>;
    };
    // 删掉一个阶层键模拟脏数据，行渲染仍不出现 undefined/NaN
    const firstKey = Object.keys(summary.classes)[0] as string;
    delete summary.classes[firstKey];
    panel.open();
    const texts = (scene.add.text as ReturnType<typeof vi.fn>).mock.results
      .map(r => r.value?.text ?? '');
    expect(texts.join('\n')).not.toMatch(/undefined|NaN/);
    void firstKey;
  });

  it('destroy 解绑 RESOURCES_CHANGED/DAY_TICK/STATE_REPLACED', () => {
    const offSpy = vi.spyOn(store, 'off');
    panel.destroy();
    const events = offSpy.mock.calls.map(c => c[0]);
    expect(events).toContain(STATE_EVENTS.RESOURCES_CHANGED);
    expect(events).toContain(STATE_EVENTS.DAY_TICK);
    expect(events).toContain(STATE_EVENTS.STATE_REPLACED);
  });
});
