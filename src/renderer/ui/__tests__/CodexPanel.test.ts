/**
 * CodexPanel（典册/百科）纯逻辑测试。Phaser scene/graphics/text/zone/container 全 mock。
 * 验证：构建全部主题 / open 时停 + close 恢复 / 切换主题 / toggle / destroy 释放 pause。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { CodexPanel } from '../CodexPanel';

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
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
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function makeFakeZone() {
  return {
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
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

function makeFakeScene() {
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(makeFakeContainer),
      graphics: vi.fn(makeFakeGraphics),
      text: vi.fn(makeFakeText),
      zone: vi.fn(makeFakeZone),
    },
    registry: { get: vi.fn(), set: vi.fn() },
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

describe('CodexPanel', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let panel: CodexPanel;

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore();
    panel = new CodexPanel(scene, store);
  });

  it('构建了全部主题（≥8 条）', () => {
    expect(panel.topicCount()).toBeGreaterThanOrEqual(8);
  });

  it('open 时停、close 恢复', () => {
    expect(store.isPaused()).toBe(false);
    panel.open();
    expect(panel.isVisible()).toBe(true);
    expect(store.isPaused()).toBe(true);
    panel.close();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
  });

  it('toggle 在开/关之间切换', () => {
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('切换主题不报错且可在打开态调用', () => {
    panel.open();
    expect(() => panel.selectTopic(2)).not.toThrow();
    expect(() => panel.selectTopic(panel.topicCount() - 1)).not.toThrow();
  });

  it('destroy 后释放 pause（不残留软暂停）', () => {
    panel.open();
    expect(store.isPaused()).toBe(true);
    panel.destroy();
    expect(store.isPaused()).toBe(false);
  });
});
