import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import { POLICIES, EVENTS, DECREES } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import { ScoreCardPanel, loadBestScore, saveBestScore } from '../ScoreCardPanel';

/**
 * P2 终局记分牌面板纯逻辑测试。Phaser 全 mock；localStorage mock 验证历史最高分。
 */

function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    width: 100, height: 18, text: '',
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  t.setColor.mockImplementation(function (this: typeof t, c: string) { (this as unknown as { color?: string }).color = c; return this as typeof t; });
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
    fillCircle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

interface FakeZone {
  x: number; y: number; width: number; height: number;
  handlers: Record<string, (...args: unknown[]) => void>;
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
    x: 0, y: 0, width: 1, height: 1, handlers: {},
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockImplementation(function (this: FakeZone, x: number, y: number) { this.x = x; this.y = y; return this; }),
    setSize: vi.fn().mockImplementation(function (this: FakeZone, w: number, h: number) { this.width = w; this.height = h; return this; }),
    setVisible: vi.fn().mockReturnThis(),
    on: vi.fn().mockImplementation(function (this: FakeZone, ev: string, fn: (...args: unknown[]) => void) { this.handlers[ev] = fn; return this; }),
    destroy: vi.fn(),
  };
  return z;
}

function makeFakeContainer() {
  return {
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
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
    registry: { get: vi.fn(() => undefined), set: vi.fn() },
  };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { rngSeed: 20260814, resources: { ...BALANCE.startingResources } }, { policies: POLICIES, events: EVENTS, decrees: DECREES });
}

describe('ScoreCardPanel — 终局记分牌', () => {
  it('打开后显示总分与草创评语（空国起点）', () => {
    const scene = makeFakeScene();
    const store = makeStore();
    const panel = new ScoreCardPanel(scene as never, store);
    panel.open();
    const texts = (scene.add.text as unknown as ReturnType<typeof vi.fn>).mock.results.map(r => r.value);
    const total = texts.find((t: { text: string }) => t.text.startsWith('总分'));
    expect(total).toBeDefined();
    const verdict = texts.find((t: { text: string }) => t.text.includes('草创'));
    expect(verdict).toBeDefined();
    // 历史最高：无 localStorage（node 环境）→ 显示「此为当前最高」
    const best = texts.find((t: { text: string }) => t.text.includes('当前最高'));
    expect(best).toBeDefined();
    panel.destroy();
  });

  it('store.getScoreCard 返回有效多维条目', () => {
    const store = makeStore();
    const card = store.getScoreCard();
    expect(card.items.length).toBeGreaterThanOrEqual(4);
    expect(card.total).toBeGreaterThanOrEqual(0);
    expect(card.verdict.length).toBeGreaterThan(0);
  });

  it('loadBestScore/saveBestScore：无 localStorage 安全降级', () => {
    expect(loadBestScore()).toBeNull();
    expect(() => saveBestScore({ total: 100, day: 3 })).not.toThrow();
  });
});
