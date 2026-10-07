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
import { makeFakeContainer, makeFakeGraphics, makeFakeText, makeFakeZone } from './fakeScene';

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
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
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

  it('destroy 后释放 pause（不残留软暂停）', () => {
    panel.open();
    expect(store.isPaused()).toBe(true);
    panel.destroy();
    expect(store.isPaused()).toBe(false);
  });

  // c924-18（面板 handlers 真路径扩面批二）：下面两例不直调任何后门，触发面板自己
  // zone.on('pointerup', …) 登记的回调本体（CodexPanel.ts:137/:148/:156）。
  // c1002-18：原「测试 hook」成员（:223-224，仅 not.toThrow 老例在用）已退役删除，
  // 本两例真路径就是主题切换行为面的现役看守。
  // zone 即 fakeScene.makeFakeZone（其 on 把回调记进 handlers，见 fakeScene.ts:76/:87）——本件零改夹具。
  type HandlerHost = { handlers: Record<string, (...a: unknown[]) => void> };
  const internals = (p: CodexPanel) =>
    p as unknown as {
      selected: number;
      content: { text: string };
      closeZone: HandlerHost;
      overlayZone: HandlerHost;
      tabs: Array<{ txt: { color: string }; zone: HandlerHost }>;
    };
  function clickOf(host: HandlerHost, ev: string): (...a: unknown[]) => void {
    const h = host.handlers[ev];
    expect(h, `面板未在该对象上登记 ${ev}（断线即红）`).toBeTypeOf('function');
    return h!;
  }

  it('真路径：点主题条 zone 的 pointerup → selected 换、正文换、选中色互换', () => {
    panel.open();
    const box = internals(panel);
    const activeColor = box.tabs[0]!.txt.color; // open()→layout() 后第 0 条是选中态
    const inactiveColor = box.tabs[3]!.txt.color;
    expect(activeColor).not.toBe(inactiveColor); // 前提：布局确实区分选中态，否则本例无判别力
    const bodyBefore = box.content.text;
    const click3 = clickOf(box.tabs[3]!.zone, 'pointerup');
    expect(box.selected).toBe(0); // 动手前基线
    click3();
    expect(box.selected).toBe(3);
    expect(box.content.text).not.toBe(bodyBefore);
    expect(box.tabs[3]!.txt.color).toBe(activeColor);
    expect(box.tabs[0]!.txt.color).toBe(inactiveColor);
    const bodyAfter = box.content.text;
    click3(); // 反向：重复点同一条 → 状态与文案都不再变
    expect(box.selected).toBe(3);
    expect(box.content.text).toBe(bodyAfter);
  });

  it('真路径：✕ 与遮罩两条 zone 的 pointerup 各自关面板并释放暂停；关闭态重放无副作用', () => {
    const { closeZone, overlayZone } = internals(panel);
    const clickClose = clickOf(closeZone, 'pointerup');
    const clickOverlay = clickOf(overlayZone, 'pointerup');
    panel.open();
    expect(panel.isVisible()).toBe(true);
    expect(store.isPaused()).toBe(true);
    clickClose();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
    clickClose(); // 反向：close() 早退，不得把面板再打开、也不得多还一次暂停
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
    panel.open();
    clickOverlay();
    expect(panel.isVisible()).toBe(false);
    expect(store.isPaused()).toBe(false);
  });
});
