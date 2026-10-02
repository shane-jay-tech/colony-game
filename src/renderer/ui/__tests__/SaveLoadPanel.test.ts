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
import { makeFakeScene, makeFakeText, makeFakeGraphics, makeFakeZone, makeFakeContainer } from './fakeScene';

// c921-02 批 2：本地 FakeText/FakeGraphics builder 收编到 ./fakeScene（批一 3 文件同管道）。
// c922-02 批 3：本地 FakeZone/FakeContainer 及其 interface 一并收编——共享件是本地件的方法超集
//（Zone 本地 6 法 ⊂ 共享 7 法＋4 字段；Container 本地 6 法 ⊂ 共享 13 法），且本面板对两者的
// 运行时依赖只有链式返回：container.add(...) 在 SaveLoadPanel.ts 的 4 个调用点均不接返回值链用，
// 故共享件 add: vi.fn()（返回 undefined）与本地 add: () => c 在本文件等价。
// 类型用 ReturnType 派生，保持 makeFakeScene 的 texts 数组与 add.* 签名引用不变。
type FakeText = ReturnType<typeof makeFakeText>;
type FakeGraphics = ReturnType<typeof makeFakeGraphics>;
type FakeZone = ReturnType<typeof makeFakeZone>;
type FakeContainer = ReturnType<typeof makeFakeContainer>;

// c1002-04（c930-13 遗留收尾）：本地 FakeScene/makeFakeScene 收编到 ./fakeScene——
// 共享件经本批扩 texts 收集面（超集）后与本地面同形；类型用 ReturnType 派生。
type FakeScene = ReturnType<typeof makeFakeScene> & { texts: FakeText[] };

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
    scene = makeFakeScene() as unknown as FakeScene; // 共享件返回类型 FakeSceneLike 的超集断言（texts 运行时在位）
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
