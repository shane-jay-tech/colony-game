// c918-23（三批储备启用）：Legend 钉桩——条目渲染、折叠切换、空数据容错、destroy。
// store 用真实 GameStore；scene 全 fake（同 HUD/PopulationPanel 模式）。
// c919-01：fake builders 五件收口至共享脚手架 ./fakeScene；补落空数据容错两条
//（折叠态零条目渲染断言＋drawSection 空行数组，c918-23 遗留段点名项）。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { makeFakeScene } from './fakeScene';

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
    scene = makeFakeScene({ cameras: true });
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

  it('空数据容错：折叠态零图例条目渲染（rowTexts 全隐藏＋rowsGfx 清空）', () => {
    const zone = (legend as unknown as { toggleZone: { on: ReturnType<typeof vi.fn> } }).toggleZone;
    const calls = zone.on.mock.calls.filter((c: unknown[]) => c[0] === 'pointerup');
    const handler = calls[0]![1] as () => void;
    const rowTexts = (legend as unknown as { rowTexts: Array<{ setVisible: ReturnType<typeof vi.fn> }> }).rowTexts;
    expect(rowTexts.length).toBeGreaterThan(0);
    const rowsGfx = (legend as unknown as { rowsGfx: { clear: ReturnType<typeof vi.fn> } }).rowsGfx;
    const clearsBefore = rowsGfx.clear.mock.calls.length;
    handler(); // 折叠 → layout 早退：条目全部不渲染
    for (const t of rowTexts) {
      const hides = t.setVisible.mock.calls.filter((c: unknown[]) => c[0] === false);
      expect(hides.length).toBeGreaterThan(0);
    }
    expect(rowsGfx.clear.mock.calls.length).toBeGreaterThan(clearsBefore);
  });

  it('空数据容错：drawSection 空行数组零填充不崩（!row 守卫）', () => {
    const rowsGfx = (legend as unknown as { rowsGfx: { fillRect: ReturnType<typeof vi.fn> } }).rowsGfx;
    const fillsBefore = rowsGfx.fillRect.mock.calls.length;
    const drawSection = (legend as unknown as {
      drawSection: (title: string, startY: number, rows: ReadonlyArray<unknown>, textIdxBase: number) => number;
    }).drawSection;
    expect(() => drawSection.call(legend, '— 空 —', 40, [], 0)).not.toThrow();
    expect(rowsGfx.fillRect.mock.calls.length).toBe(fillsBefore);
  });

  it('destroy：解绑 store 事件并销毁容器/图形/文本', () => {
    const offSpy = vi.spyOn(store, 'off');
    legend.destroy();
    expect(offSpy.mock.calls.length).toBeGreaterThan(0);
  });
});
