// c924-26（c923-32 盘点档缺口 2）：IntroScene 的 DOM `input` 监听**配对**守护。
// 五景唯一 DOM 面：`add.dom(...).createFromHTML()` 造出的 node **不随 Phaser 场景销毁**，
// 所以 `addEventListener('input', this.inputListener)`（:254）与 `removeEventListener`（:582）
// 必须**成对且同引用**——错一个形态（shutdown 里重新构造闭包／只 add 不 remove）就是切到
// GameScene 后输入框监听仍活着、闭包持有整景的单向内存泄漏。既有 `IntroScene.test.ts` 3 例
// 全在「立邦→registry→start」链路，**无一例碰 shutdown 清理**（缺口 2 原话）。
//
// 🔴 恒真防线：先钉「add 确实发生且第二参就是场景字段」（例 1），再钉「remove 收到**同一个 fn**」
// （例 2）——只写例 2 的话「两次都没注册」也能让它假绿；例 3 再钉「注册的那个 fn 真有清洗语义」，
// 防「注册了个空函数」这种两边计数都对的假绿。
// ⚠ 零生产码改动；`fakeScene.ts` 未改（其 `add.dom` 工厂本就每次调用返回**新** node 与独立 vi.fn）。
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

const { registryStore, shutdownHandlers } = sceneClassMock;

/** 假 dom input node（fakeScene 的 `node` 是纯对象：value ＋ add/removeEventListener 两个 vi.fn）。 */
interface FakeInputNode {
  value: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}
interface IntroSceneInternals {
  countryInputDom: { node: FakeInputNode };
  inputListener: (() => void) | null;
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeScene(): { scene: IntroScene; node: FakeInputNode } {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  registryStore.clear();
  registryStore.set(REGISTRY_KEYS.store, new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] }));
  registryStore.set(REGISTRY_KEYS.gameMode, 'story');
  const scene = new IntroScene();
  scene.create();
  return { scene, node: (scene as unknown as IntroSceneInternals).countryInputDom.node };
}

/** 只取 'input' 这一路的调用（node 上理论上还会挂别的监听）。 */
function inputCalls(spy: ReturnType<typeof vi.fn>): unknown[][] {
  return spy.mock.calls.filter((c: unknown[]) => c[0] === 'input');
}

function fireShutdown(): void {
  for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
}

describe('IntroScene DOM input 监听配对（c923-32 缺口 2）', () => {
  beforeEach(() => {
    registryStore.clear();
    shutdownHandlers.length = 0;
  });

  it('create：假 node 上恰 1 次 addEventListener("input")，且第二参就是场景自己的 inputListener（注册面坐实，下例才不是空集恒真）', () => {
    const { scene, node } = makeScene();
    const adds = inputCalls(node.addEventListener);
    expect(adds.length).toBe(1);
    const inner = scene as unknown as IntroSceneInternals;
    expect(typeof inner.inputListener).toBe('function');
    expect(adds[0]![1], 'addEventListener 传的不是场景字段 inputListener ⇒ 字段与 DOM 上的监听已脱钩').toBe(
      inner.inputListener,
    );
    expect(node.removeEventListener).not.toHaveBeenCalled();
  });

  it('SHUTDOWN：removeEventListener 收到与 addEventListener **同一个 fn 引用**、各恰 1 次，随后 inputListener 归 null', () => {
    const { scene, node } = makeScene();
    const added = inputCalls(node.addEventListener)[0]![1];
    expect(node.addEventListener).toHaveBeenCalledTimes(1);

    fireShutdown();
    const removes = inputCalls(node.removeEventListener);
    expect(removes.length).toBe(1);
    // 两参都是 [Function]，vitest 自己分不出 ⇒ 断言消息必须点名「同引用」这件事。
    expect(removes[0]![1], 'SHUTDOWN 解绑传的不是注册时那个 fn：新闭包 ⇒ DOM 上的监听永远解不掉').toBe(added);
    expect((scene as unknown as IntroSceneInternals).inputListener).toBeNull();
  });

  it('注册的那个 fn 确有清洗语义：混进非汉字的邦名跑一遍被裁成纯汉字（钉成空函数／错闭包即红）', () => {
    const { node } = makeScene();
    const registered = inputCalls(node.addEventListener)[0]![1] as () => void;
    node.value = '大夏A1';
    registered();
    expect(node.value).toBe('大夏');
  });
});
