/**
 * SaveLoadPanel 纯逻辑测试。Phaser scene/graphics/text/zone/container 全 mock；
 * window.colonyApi 用 mock 提供 save/load/meta，验证：
 * 三槽元信息展示 / 覆盖与读入的二次确认 / 空槽读档报错 / 读档成功 replaceState 并关闭。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type IEventEmitter } from '../../state/gameStore';
import { serialize } from '../../state/saveLoad';
import type { WorldMap } from '../../data/mapSchema';
import { SaveLoadPanel, formatSavedAt } from '../SaveLoadPanel';

interface FakeText {
  text: string;
  alpha: number;
  handlers: Record<string, (...args: unknown[]) => void>;
  setOrigin(x?: number, y?: number): FakeText;
  setText(s: string): FakeText;
  setPosition(x?: number, y?: number): FakeText;
  setVisible(v?: boolean): FakeText;
  setAlpha(a: number): FakeText;
  setInteractive(o?: unknown): FakeText;
  disableInteractive(): FakeText;
  on(ev: string, fn: (...args: unknown[]) => void): FakeText;
  destroy(): void;
}

function makeFakeText(): FakeText {
  const t = {} as FakeText;
  t.text = '';
  t.alpha = 1;
  t.handlers = {};
  t.setOrigin = () => t;
  t.setText = (s: string) => { t.text = s; return t; };
  t.setPosition = () => t;
  t.setVisible = () => t;
  t.setAlpha = (a: number) => { t.alpha = a; return t; };
  t.setInteractive = () => t;
  t.disableInteractive = () => t;
  t.on = (ev: string, fn: (...args: unknown[]) => void) => { t.handlers[ev] = fn; return t; };
  t.destroy = () => undefined;
  return t;
}

interface FakeGraphics {
  handlers: Record<string, (...args: unknown[]) => void>;
  clear(): FakeGraphics;
  fillStyle(c?: number, a?: number): FakeGraphics;
  fillRect(x?: number, y?: number, w?: number, h?: number): FakeGraphics;
  lineStyle(w?: number, c?: number, a?: number): FakeGraphics;
  strokeRect(x?: number, y?: number, w?: number, h?: number): FakeGraphics;
  setDepth(d?: number): FakeGraphics;
  setVisible(v?: boolean): FakeGraphics;
  setScrollFactor(x?: number, y?: number): FakeGraphics;
  setInteractive(o?: unknown, fn?: unknown): FakeGraphics;
  on(ev: string, fn: (...args: unknown[]) => void): FakeGraphics;
  destroy(): void;
}

function makeFakeGraphics(): FakeGraphics {
  const g = {} as FakeGraphics;
  g.handlers = {};
  g.clear = () => g;
  g.fillStyle = () => g;
  g.fillRect = () => g;
  g.lineStyle = () => g;
  g.strokeRect = () => g;
  g.setDepth = () => g;
  g.setVisible = () => g;
  g.setScrollFactor = () => g;
  g.setInteractive = () => g;
  g.on = (ev: string, fn: (...args: unknown[]) => void) => { g.handlers[ev] = fn; return g; };
  g.destroy = () => undefined;
  return g;
}

interface FakeZone {
  setOrigin(x?: number, y?: number): FakeZone;
  setInteractive(o?: unknown): FakeZone;
  setPosition(x?: number, y?: number): FakeZone;
  setSize(w?: number, h?: number): FakeZone;
  on(ev: string, fn: (...args: unknown[]) => void): FakeZone;
  destroy(): void;
}

function makeFakeZone(): FakeZone {
  const z = {} as FakeZone;
  z.setOrigin = () => z;
  z.setInteractive = () => z;
  z.setPosition = () => z;
  z.setSize = () => z;
  z.on = () => z;
  z.destroy = () => undefined;
  return z;
}

interface FakeContainer {
  setDepth(d?: number): FakeContainer;
  setVisible(v?: boolean): FakeContainer;
  setScrollFactor(x?: number, y?: number): FakeContainer;
  setPosition(x?: number, y?: number): FakeContainer;
  add(o?: unknown): FakeContainer;
  destroy(): void;
}

function makeFakeContainer(): FakeContainer {
  const c = {} as FakeContainer;
  c.setDepth = () => c;
  c.setVisible = () => c;
  c.setScrollFactor = () => c;
  c.setPosition = () => c;
  c.add = () => c;
  c.destroy = () => undefined;
  return c;
}

interface FakeScene {
  scale: { width: number; height: number };
  add: {
    container(): FakeContainer;
    graphics(): FakeGraphics;
    text(): FakeText;
    zone(): FakeZone;
  };
  registry: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
  };
  texts: FakeText[];
}

function makeFakeScene(): FakeScene {
  const texts: FakeText[] = [];
  return {
    scale: { width: 1366, height: 800 },
    add: {
      container: makeFakeContainer,
      graphics: makeFakeGraphics,
      text: (initial?: string) => { const t = makeFakeText(); if (initial !== undefined) t.text = initial; texts.push(t); return t; },
      zone: makeFakeZone,
    },
    registry: { get: vi.fn(), set: vi.fn() },
    texts,
  };
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

const FIXED_TS = new Date(2026, 0, 2, 3, 4).getTime();

describe('SaveLoadPanel', () => {
  let scene: FakeScene;
  let store: GameStore;
  let panel: SaveLoadPanel;
  let saveGameMock: ReturnType<typeof vi.fn>;
  let loadGameMock: ReturnType<typeof vi.fn>;
  let getSaveMetaMock: ReturnType<typeof vi.fn>;
  let toastMock: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    scene = makeFakeScene();
    store = makeStore();
    saveGameMock = vi.fn().mockResolvedValue(true);
    loadGameMock = vi.fn().mockResolvedValue(null);
    getSaveMetaMock = vi.fn().mockImplementation(async (slot: string) =>
      slot === 'slot1' ? { slot, savedAt: FIXED_TS, currentDay: 42 } : null);
    toastMock = { show: vi.fn() };
    (globalThis as unknown as { window?: unknown }).window = {
      colonyApi: { saveGame: saveGameMock, loadGame: loadGameMock, getSaveMeta: getSaveMetaMock },
    };
    scene.registry.get.mockImplementation((k: string) => (k === 'toast' ? toastMock : undefined));
    panel = new SaveLoadPanel(scene as never, store);
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  function textOf(fragment: string): FakeText | undefined {
    return scene.texts.find(t => typeof t.text === 'string' && t.text.includes(fragment));
  }

  function click(label: string): void {
    const btn = scene.texts.find(t => t.text === label);
    expect(btn, `button "${label}" not found`).toBeTruthy();
    btn?.handlers.pointerdown?.();
  }

  it('formatSavedAt 输出确定格式', () => {
    expect(formatSavedAt(FIXED_TS)).toBe('2026-01-02 03:04');
    expect(formatSavedAt(0)).toBe('时间未知');
  });

  it('show 时拉取三个槽元信息并渲染（有存档显示天数，空槽显示空）', async () => {
    await panel.show();
    expect(panel.isVisible()).toBe(true);
    expect(getSaveMetaMock).toHaveBeenCalledTimes(3);
    expect(textOf('第 42 日')).toBeTruthy();
    expect(textOf('2026-01-02 03:04')).toBeTruthy();
    expect(scene.texts.filter(t => t.text === '空槽')).toHaveLength(2);
  });

  it('覆盖存档需要二次点击确认', async () => {
    await panel.show();
    click('存档');
    expect(saveGameMock).not.toHaveBeenCalled();
    expect(textOf('覆盖？')).toBeTruthy();
    click('覆盖？');
    await vi.waitFor(() => expect(saveGameMock).toHaveBeenCalledOnce());
    expect(saveGameMock).toHaveBeenCalledWith('slot1', expect.any(String));
    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledWith('存档一 已保存', 'info', 2200));
  });

  it('读空槽报错且不替换状态', async () => {
    await panel.show();
    const replaceSpy = vi.spyOn(store, 'replaceState');
    click('读档');
    expect(textOf('读入？')).toBeTruthy();
    click('读入？');
    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalled());
    expect(toastMock.show).toHaveBeenCalledWith('该存档不存在或已损坏', 'error', 2600);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('读档成功替换状态并关闭面板', async () => {
    loadGameMock.mockResolvedValue(JSON.stringify(serialize(store.getState())));
    await panel.show();
    const replaceSpy = vi.spyOn(store, 'replaceState');
    click('读档');
    click('读入？');
    await vi.waitFor(() => expect(replaceSpy).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledWith('读档成功', 'info', 2200));
    expect(panel.isVisible()).toBe(false);
  });

  it('destroy 不抛错', () => {
    expect(() => panel.destroy()).not.toThrow();
  });
});
