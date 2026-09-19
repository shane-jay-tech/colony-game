// c919-02（c918-21 遗留改钉）：IntroScene「立邦→registry→GameScene」真实链路。
// mock phaser（sceneClassMock）；add.dom 用纯对象 input node（node 环境无 DOM）；
// store 用真实 GameStore。钉：守卫（名/身份）→registry 双写→modifier+模式→introDone→start('GameScene')。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { IntroScene } from '../IntroScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';

const { registryStore } = sceneClassMock;

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

/** 立邦就绪场景：registry 预置 store＋mode=story，输入框 node 置合法邦名，身份选 lord_minor。 */
function makeReadyScene(store: GameStore): IntroScene {
  registryStore.set(REGISTRY_KEYS.store, store);
  registryStore.set(REGISTRY_KEYS.gameMode, 'story');
  const scene = new IntroScene();
  scene.create();
  const inner = scene as unknown as {
    countryInputDom: { node: { value: string } };
    selectIdentity: (id: string) => void;
    tryStart: () => void;
  };
  inner.countryInputDom.node.value = '大夏';
  inner.selectIdentity('lord_minor');
  return scene;
}

describe('IntroScene 立邦真实链路', () => {
  beforeEach(() => {
    registryStore.clear();
    sceneClassMock.sceneStart.mockClear();
  });

  it('立邦完成：registry 写邦名/身份/introDone，store 加起始 modifier，进入 GameScene', () => {
    const store = makeStore();
    const modSpy = vi.spyOn(store, 'addModifier');
    const storySpy = vi.spyOn(store, 'startStoryMode');
    const scene = makeReadyScene(store);
    (scene as unknown as { tryStart: () => void }).tryStart();

    expect(registryStore.get(REGISTRY_KEYS.countryName)).toBe('大夏');
    expect(registryStore.get(REGISTRY_KEYS.identity)).toBe('lord_minor');
    expect(registryStore.get(REGISTRY_KEYS.introDone)).toBe(true);
    expect(modSpy).toHaveBeenCalledTimes(1);
    expect((modSpy.mock.calls[0]![0] as { id: string }).id).toBe('mod_intro_lord_minor');
    expect(storySpy).toHaveBeenCalledTimes(1);
    expect(sceneClassMock.sceneStart).toHaveBeenCalledWith('GameScene');
  });

  it('守卫：邦名非法（>3 字）时 tryStart 早返回——不写 registry 不进场', () => {
    const store = makeStore();
    registryStore.set(REGISTRY_KEYS.store, store);
    registryStore.set(REGISTRY_KEYS.gameMode, 'story');
    const scene = new IntroScene();
    scene.create();
    const inner = scene as unknown as {
      countryInputDom: { node: { value: string } };
      tryStart: () => void;
    };
    inner.countryInputDom.node.value = '大夏王朝帝国'; // 6 字，越 VALID_NAME_RE 上限
    inner.tryStart();

    expect(registryStore.get(REGISTRY_KEYS.introDone)).toBeUndefined();
    expect(sceneClassMock.sceneStart).not.toHaveBeenCalled();
  });

  it('守卫：未择身份时 tryStart 早返回', () => {
    const store = makeStore();
    registryStore.set(REGISTRY_KEYS.store, store);
    registryStore.set(REGISTRY_KEYS.gameMode, 'story');
    const scene = new IntroScene();
    scene.create();
    const inner = scene as unknown as {
      countryInputDom: { node: { value: string } };
      tryStart: () => void;
    };
    inner.countryInputDom.node.value = '大夏';
    inner.tryStart();

    expect(registryStore.get(REGISTRY_KEYS.introDone)).toBeUndefined();
    expect(sceneClassMock.sceneStart).not.toHaveBeenCalled();
  });
});
