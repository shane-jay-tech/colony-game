// c919-01：UIScene 钉桩（c918-23 遗留段点名项）——面板注册进 registry＋SHUTDOWN 触发后
// 注册面板逐一 destroy、toast 注册位清空。沿 ModeSelectScene.test 的 phaser-mock 类式路线
//（c919-01 起共享脚手架 sceneClassMock），store/buildMode 用真实类（GameScene 在真实流程
// 于 create 前写入 registry，此处同构预备）。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { UIScene } from '../UIScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { BuildMode } from '../../state/buildMode';

const { registryStore, shutdownHandlers } = sceneClassMock;

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

/** 与 GameScene→UIScene 真实装配序同构：store/buildMode 先进 registry，再 create。 */
function makeReadyScene(): UIScene {
  registryStore.set(REGISTRY_KEYS.store, makeStore());
  registryStore.set(REGISTRY_KEYS.buildMode, new BuildMode());
  const scene = new UIScene();
  scene.create();
  return scene;
}

describe('UIScene 面板注册/销毁钉桩', () => {
  beforeEach(() => {
    registryStore.clear();
    shutdownHandlers.length = 0;
  });

  it('create：全套面板/管理器注册进 registry（策略树/军务/典册/邦交/人口/供需/升格/记分牌/设置/存读档/史官/toast/音频）', () => {
    makeReadyScene();
    const keys = [
      'policyTreePanel', 'megaProjectPanel', 'militaryPanel', 'codexPanel', 'toast',
      'diplomacyPanel', 'populationPanel', 'productionPanel', 'gradePanel', 'scoreCardPanel',
      'settingsPanel', 'saveLoadPanel', 'influencePanel', 'audioManager',
    ] as const;
    for (const k of keys) {
      expect(registryStore.get(REGISTRY_KEYS[k]), `registry 缺 ${k}`).toBeDefined();
    }
  });

  it('SHUTDOWN：注册面板逐一 destroy 且不抛（hud/legend 私有位同销毁）', () => {
    const scene = makeReadyScene();
    const policyTree = registryStore.get(REGISTRY_KEYS.policyTreePanel) as { destroy: () => void };
    const spy = vi.spyOn(policyTree, 'destroy');
    const hud = (scene as unknown as { hud: { destroy: () => void } }).hud;
    expect(hud).toBeDefined();
    const hudSpy = vi.spyOn(hud!, 'destroy');
    expect(() => {
      for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
    }).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(hudSpy).toHaveBeenCalledTimes(1);
  });

  it('SHUTDOWN：toast 注册位清空（registry 写 undefined，防热重载幽灵引用）', () => {
    makeReadyScene();
    expect(registryStore.get(REGISTRY_KEYS.toast)).toBeDefined();
    for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
    expect(registryStore.get(REGISTRY_KEYS.toast)).toBeUndefined();
  });
});
