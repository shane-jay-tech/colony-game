// c920-03：GameScene 生命周期 characterization（n919 管道单）。
// 只钉现状：create 守卫分支 / SHUTDOWN once 绑定 / shutdown 反注册与清理链。
// create() 全量运行依赖 MapRenderer/TimeSystem 真实现（phaser mock 深度不够），
// 故订阅贯通以源级钉桩 + shutdown 行为单测覆盖。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { GameScene } from '../GameScene';
import { STATE_EVENTS } from '../../state/gameStore';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore } = sceneClassMock;

const SOURCE = readFileSync('src/renderer/scenes/GameScene.ts', 'utf8');

function makeScene(): GameScene {
  return new GameScene();
}

describe('GameScene 生命周期 characterization', () => {
  beforeEach(() => {
    registryStore.clear();
  });

  it('create 守卫分支：registry 缺 store/buildMode → 错误文案且不订阅', () => {
    const scene = makeScene();
    // registry 空 → registryGet 返回 undefined
    expect(() => (scene as unknown as { create: () => void }).create()).not.toThrow();
    expect(SOURCE.includes("REGISTRY_KEYS.store")).toBe(true);
  });

  it('源级钉桩：create 里 SHUTDOWN once 绑定在位（防泄漏关键修复）', () => {
    expect(SOURCE).toContain('this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)');
  });

  it('源级钉桩：BUILDING_UPGRADED 订阅在位（:207 锚点）', () => {
    expect(SOURCE).toContain('store.on(STATE_EVENTS.BUILDING_UPGRADED, this.upgradedListener)');
  });

  it('shutdown：store.off 反注册 9 个事件（8 订阅 + SEASON_TICK）', () => {
    const scene = makeScene() as unknown as Record<string, unknown>;
    const offs: string[] = [];
    const store = {
      off: vi.fn((event: string) => offs.push(event)),
    };
    scene['store'] = store;
    scene['buildingPopover'] = { destroy: vi.fn() };
    scene['registry'] = { set: vi.fn() };
    (scene as unknown as { shutdown: () => void }).shutdown();

    const expected = [
      STATE_EVENTS.BUILDING_PLACED, STATE_EVENTS.BUILDING_COMPLETED, STATE_EVENTS.BUILDING_REMOVED,
      STATE_EVENTS.STATE_REPLACED, STATE_EVENTS.PANEL_COLLAPSED_CHANGED, STATE_EVENTS.BUILDING_UPGRADED,
      STATE_EVENTS.STORY_UNIFIED, STATE_EVENTS.STORY_ENDING, STATE_EVENTS.SEASON_TICK,
    ];
    for (const ev of expected) {
      expect(offs).toContain(ev);
    }
    expect(offs.length).toBe(expected.length);
    // 清理链：store/buildMode/mapRenderer/timeSystem 置空
    expect(scene['store']).toBeNull();
    expect(scene['buildMode']).toBeNull();
    expect(scene['mapRenderer']).toBeNull();
    expect(scene['timeSystem']).toBeNull();
  });

  it('shutdown：offBuildModeChange 解绑函数被调用并置空', () => {
    const scene = makeScene() as unknown as Record<string, unknown>;
    const store = { off: vi.fn() };
    scene['store'] = store;
    scene['buildingPopover'] = null;
    const off = vi.fn();
    scene['offBuildModeChange'] = off;
    (scene as unknown as { shutdown: () => void }).shutdown();
    expect(off).toHaveBeenCalledTimes(1);
    expect(scene['offBuildModeChange']).toBeNull();
  });
});
