import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import { POLICIES, EVENTS, DECREES } from '../../data';
import { ProductionPanel } from '../ProductionPanel';
import { GradePanel } from '../GradePanel';
import { getBuildingDef } from '../../data/buildingRegistry';

/**
 * P1 信息可视化面板（供需速率 / 升格目标）纯逻辑测试。Phaser 全 mock。
 * 验证：供需面板的净亏点名与配色 / 名望特行 / 升格面板的逐项 ✓✗ 与页脚引导。
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
  return new GameStore(ee, { rngSeed: 20260814 }, { policies: POLICIES, events: EVENTS, decrees: DECREES });
}

describe('ProductionPanel — 供需速率面板', () => {
  it('初始无建筑：全部行归零、页脚报安稳', () => {
    const scene = makeFakeScene();
    const store = makeStore();
    const panel = new ProductionPanel(scene as never, store);
    panel.open();
    const texts = (scene.add.text as unknown as ReturnType<typeof vi.fn>).mock.results.map(r => r.value);
    const grain = texts.find((t: { text: string }) => t.text === '粮');
    expect(grain).toBeDefined();
    // 名望行：国格 0 → 日产 1
    const influenceRow = texts.find((t: { text: string }) => t.text === '1' && panel.isVisible());
    expect(influenceRow).toBeDefined();
    const footer = texts.find((t: { text: string }) => t.text.includes('诸资源出入相抵'));
    expect(footer).toBeDefined();
    // P1-4 民足行：空国（无人口）→ 十成力，不给开局惩罚
    const fuf = texts.find((t: { text: string }) => t.text.startsWith('民足：十成力'));
    expect(fuf).toBeDefined();
    panel.destroy();
  });

  it('粮耗 mod → 粮行净亏标红、页脚点名缺粮', () => {
    const scene = makeFakeScene();
    const store = makeStore();
    store.addModifier({
      id: 't_grain_hunger', name: 't', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_consumption', op: 'add', value: 10 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    });
    const panel = new ProductionPanel(scene as never, store);
    panel.open();
    const texts = (scene.add.text as unknown as ReturnType<typeof vi.fn>).mock.results.map(r => r.value);
    // 粮行 net = -10，应为红色文本 '-10'
    const netMinus10 = texts.find((t: { text: string; color?: string }) => t.text === '-10' && t.color === '#B71C1C');
    expect(netMinus10).toBeDefined();
    const footer = texts.find((t: { text: string; color?: string }) =>
      t.text.includes('眼下入不敷出：粮') && t.color === '#B71C1C');
    expect(footer).toBeDefined();
    // 补阙因果链：缺粮 → 点出可建的产粮建筑
    const hint = texts.find((t: { text: string }) => t.text.startsWith('补粮：') && t.text.includes('农田可建'));
    expect(hint).toBeDefined();
    panel.destroy();
  });

  it('toggle 开关 + destroy 解绑不抛错', () => {
    const scene = makeFakeScene();
    const store = makeStore();
    const panel = new ProductionPanel(scene as never, store);
    expect(panel.isVisible()).toBe(false);
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
    panel.destroy();
    // 销毁后再开关不抛错
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });
});

describe('GradePanel — 升格目标面板', () => {
  it('初始聚落：下一格城邑，人口/钱未达标标 ✗，标志行显示市集名', () => {
    const scene = makeFakeScene();
    const store = makeStore();
    const panel = new GradePanel(scene as never, store);
    panel.open();
    const texts = (scene.add.text as unknown as ReturnType<typeof vi.fn>).mock.results.map(r => r.value);
    const current = texts.find((t: { text: string }) => t.text.includes('当前：聚落'));
    expect(current).toBeDefined();
    const next = texts.find((t: { text: string }) => t.text.includes('下一格 · 城邑'));
    expect(next).toBeDefined();
    const popRow = texts.find((t: { text: string }) => t.text === '0 / 30');
    expect(popRow).toBeDefined();
    const marks = texts.filter((t: { text: string }) => t.text === '✗' || t.text === '✓');
    expect(marks.length).toBeGreaterThanOrEqual(2); // 人口 + 钱 至少两 ✗
    expect(marks.every(m => m.text === '✗')).toBe(true);
    const marketName = getBuildingDef('bld_market')?.name ?? '设市通货';
    const sigRow = texts.find((t: { text: string }) => t.text === marketName);
    expect(sigRow).toBeDefined();
    panel.destroy();
  });

  it('人口与钱达标后：对应行转 ✓、页脚提示唯欠标志', () => {
    const scene = makeFakeScene();
    const store = makeStore();
    const panel = new GradePanel(scene as never, store);
    panel.open();
    store.addResource('people', 35); // 0→35 ≥ 30
    store.addResource('gold', 80);    // 0→80 ≥ 80
    const texts = (scene.add.text as unknown as ReturnType<typeof vi.fn>).mock.results.map(r => r.value);
    const popRow = texts.find((t: { text: string }) => t.text === '35 / 30');
    expect(popRow).toBeDefined();
    const goldRow = texts.find((t: { text: string }) => t.text === '80 / 80');
    expect(goldRow).toBeDefined();
    const checks = texts.filter((t: { text: string }) => t.text === '✓');
    expect(checks.length).toBe(2); // 人口 + 钱 达标
    const footer = texts.find((t: { text: string }) => t.text.includes('唯欠标志一事'));
    expect(footer).toBeDefined();
    panel.destroy();
  });
});
