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
import { NPC_POOL, STORY_NPC_ROSTER } from '../../data/npcCountries';
import { BALANCE, STORY_BALANCE } from '../../data/balanceConfig';
import type { ResourceId } from '../../data/resourceRegistry';

const { registryStore } = sceneClassMock;

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
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

  // c1023-07（c1011-14 缺口2·立国序列）→ c1023-06 改钉：story 立国后 mode=story＋序章 flags＋固定 roster（PLAN#2 接线）＋故事资源覆盖。
  // IntroScene.tryStart 的 story 接线序列 = startStoryMode → startStoryRosterNpcs；种子随机 startNewGameNpcs 只属 sandbox 分支。
  it('立国序列断言：story 立国后 mode/序章 flags/固定 roster 与池一致/故事资源覆盖沙盒基线，接线次序 story→roster', () => {
    const store = makeStore();
    // 模拟 main.ts Slice E：沙盒基线先行发放，证故事表是真覆盖而非「初始恰好为 0」
    for (const [id, amount] of Object.entries(BALANCE.startingResources)) {
      if (amount && amount > 0) store.addResource(id as ResourceId, amount);
    }
    const storySpy = vi.spyOn(store, 'startStoryMode');
    const rosterSpy = vi.spyOn(store, 'startStoryRosterNpcs');
    const npcsSpy = vi.spyOn(store, 'startNewGameNpcs');
    const scene = makeReadyScene(store);
    (scene as unknown as { tryStart: () => void }).tryStart();

    // ① mode=story + 序章 storyFlags（chapter 0、未统一）
    expect(store.getMode()).toBe('story');
    const flags = store.getStoryFlags();
    expect(flags).not.toBeNull();
    expect(flags!.chapter).toBe(0);
    expect(flags!.unified).toBe(false);

    // ② 固定阵容（c1023-06）：= STORY_NPC_ROSTER 全量、与 8 国池一致（含蛮夷 npc_rong 恒真）、非随机
    const npcs = store.getNpcCountries();
    expect(npcs.map(n => n.id)).toEqual([...STORY_NPC_ROSTER]);
    const poolIds = new Set(NPC_POOL.map(d => d.id));
    expect(npcs.every(n => poolIds.has(n.id))).toBe(true);
    expect(new Set(npcs.map(n => n.id)).size).toBe(NPC_POOL.length);
    const tribalIds = NPC_POOL.filter(d => d.archetype === 'tribal').map(d => d.id);
    expect(npcs.some(n => tribalIds.includes(n.id))).toBe(true);

    // ③ 故事双表覆盖：STORY_BALANCE.startingResources 全数落地（沙盒基线被改写）
    const res = store.getResources();
    for (const [id, v] of Object.entries(STORY_BALANCE.startingResources)) {
      expect(res[id as ResourceId]).toBe(v);
    }
    expect(res.grain).not.toBe(BALANCE.startingResources.grain); // 320 vs 250——覆盖确已发生

    // ④ 接线次序：startStoryMode 先于 startStoryRosterNpcs（同一 tryStart 序列内）；story 分支不走种子随机
    expect(storySpy.mock.invocationCallOrder[0]!).toBeLessThan(rosterSpy.mock.invocationCallOrder[0]!);
    expect(npcsSpy).not.toHaveBeenCalled();
  });

  // c1023-06 补面：sandbox 立国序列 = setMode('sandbox') → startNewGameNpcs（种子随机保留），roster 注入不触发。
  it('立国序列断言（sandbox）：随机 4 国含蛮夷保留，story roster 注入不触发', () => {
    const store = makeStore();
    const rosterSpy = vi.spyOn(store, 'startStoryRosterNpcs');
    const npcsSpy = vi.spyOn(store, 'startNewGameNpcs');
    const scene = makeReadyScene(store);
    registryStore.set(REGISTRY_KEYS.gameMode, 'sandbox'); // 在 makeReadyScene 预置 story 之后覆写为 sandbox
    (scene as unknown as { tryStart: () => void }).tryStart();

    expect(store.getMode()).toBe('sandbox');
    const npcs = store.getNpcCountries();
    expect(npcs.length).toBe(4);
    const poolIds = new Set(NPC_POOL.map(d => d.id));
    expect(npcs.every(n => poolIds.has(n.id))).toBe(true);
    const tribalIds = NPC_POOL.filter(d => d.archetype === 'tribal').map(d => d.id);
    expect(npcs.some(n => tribalIds.includes(n.id))).toBe(true);
    expect(npcsSpy).toHaveBeenCalledTimes(1);
    expect(rosterSpy).not.toHaveBeenCalled();
    expect(sceneClassMock.sceneStart).toHaveBeenCalledWith('GameScene');
  });
});
