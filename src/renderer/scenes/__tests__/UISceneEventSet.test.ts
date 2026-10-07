// c924-25（c923-32 盘点档缺口 1 首批注入守护）：UIScene 的 `store.on` ↔ `store.off`
// **事件名集合等式**从「脚本算出来无人看守」升格为「测试钉住」。
//
// 与同族对照的差异（为什么不是照抄 GameSceneLifecycle.test.ts 的源级钉桩）：
//   GameSceneLifecycle:46 用 `{ off: vi.fn() }` 假 store 手抄 9 个事件名 ⇒ 列表是测试自己写的，
//   生产码新增第 10 条 `store.on` 而忘加 `off` 时**它不会红**（缺口 1 点名的正是这个失效形态）。
//   本件改为**运行时解析**：真 GameStore + 记录型 emitter，把 UIScene 亲自挂上/摘下的
//   (事件名, handler) 配对抓出来做集合等式 ⇒ 漏一行 off 当场红，且红名精确到那个事件。
//
// handler 归属判定：UIScene 的 20 个监听器都是**类字段箭头函数**（实例自有属性），
// 而各面板的监听器挂在面板实例上 ⇒ 按「scene 实例自有函数属性」过滤即可把自己和
// 15 个面板的订阅分开，无需在测试里重抄事件名清单（那等于又造一个会漂移的手抄表）。
//
// ⚠ 零生产码改动：本件只读 UIScene/GameStore/fakeScene。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { UIScene } from '../UIScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { BuildMode } from '../../state/buildMode';

const { registryStore, shutdownHandlers } = sceneClassMock;

type Handler = (...args: unknown[]) => void;
interface Pair {
  event: string;
  fn: Handler;
}
/** emitter 侧真实挂载表（eventemitter3 无 context 时 listeners() 原样返回注册的 fn）。 */
interface ListenerTable {
  listeners(event: string): unknown[];
}

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

/** 装配一个「记账 store」：所有 on/off 先落账再转发给真 emitter。 */
function mount(): { scene: UIScene; ons: Pair[]; offs: Pair[]; emitter: EventEmitter & ListenerTable } {
  const raw = new EventEmitter();
  const emitter = raw as EventEmitter & ListenerTable;
  const ons: Pair[] = [];
  const offs: Pair[] = [];
  const recorder: IEventEmitter = {
    on: (event: string, fn: Handler) => {
      ons.push({ event, fn });
      emitter.on(event, fn);
    },
    off: (event: string, fn: Handler) => {
      offs.push({ event, fn });
      emitter.off(event, fn);
    },
    emit: (event: string, ...args: unknown[]) => {
      emitter.emit(event, ...args);
    },
    listenerCount: (event: string) => emitter.listenerCount(event),
  };
  const store = new GameStore(recorder, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
  registryStore.clear();
  registryStore.set(REGISTRY_KEYS.store, store);
  registryStore.set(REGISTRY_KEYS.buildMode, new BuildMode());
  const scene = new UIScene();
  scene.create();
  return { scene, ons, offs, emitter };
}

/** UIScene 实例自有的函数属性 = 它自己的 20 个监听器（面板的监听器不在这里）。 */
function ownHandlers(scene: UIScene): Set<unknown> {
  const out = new Set<unknown>();
  for (const v of Object.values(scene as unknown as Record<string, unknown>)) {
    if (typeof v === 'function') out.add(v);
  }
  return out;
}

function pairsOf(list: Pair[], own: Set<unknown>): Pair[] {
  return list.filter((p) => own.has(p.fn));
}

function pairKeys(pairs: Pair[], ids: Map<unknown, number>): string[] {
  return pairs.map((p) => `${p.event}#${ids.get(p.fn) ?? -1}`).sort();
}

function eventNames(pairs: Pair[]): Set<string> {
  return new Set(pairs.map((p) => p.event));
}

function fireShutdown(): void {
  for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
}

/** 防恒真锚点：这 3 个事件是三条独立注册路径的代表（PAUSED_CHANGED 单点在 :290，离主块最远）。 */
const PINNED_EVENTS = [
  STATE_EVENTS.GRADE_CHANGED,
  STATE_EVENTS.EXPEDITION_RESOLVED,
  STATE_EVENTS.PAUSED_CHANGED,
];

describe('UIScene store.on/off 事件名集合等式（c923-32 缺口 1）', () => {
  beforeEach(() => {
    registryStore.clear();
    shutdownHandlers.length = 0;
  });

  it('等式：UIScene 挂在 store.on 的 (事件, handler) 集合与 shutdown 挂给 store.off 的集合逐对相等', () => {
    const { scene, ons, offs } = mount();
    const own = ownHandlers(scene);
    const onPairs = pairsOf(ons, own);
    // 判别力门 1：归属过滤器必须真抓到东西，否则「两个空集合相等」会假绿。
    expect(onPairs.length).toBeGreaterThanOrEqual(20);
    const onEvents = eventNames(onPairs);
    for (const ev of PINNED_EVENTS) expect(onEvents.has(ev), `create 未订阅 ${ev}`).toBe(true);

    fireShutdown();
    const offPairs = pairsOf(offs, own);
    const ids = new Map<unknown, number>();
    for (const fn of own) ids.set(fn, ids.size);

    expect(pairKeys(offPairs, ids), 'shutdown 的 store.off 配对与 create 的 store.on 不是一批').toEqual(
      pairKeys(onPairs, ids),
    );
    expect(eventNames(offPairs)).toEqual(onEvents);
  });

  it('基数：UIScene 对同一事件恰好注册一次（重复订阅会让集合等式照样成立却留下双份 listener）', () => {
    const { scene, ons, offs } = mount();
    const own = ownHandlers(scene);
    const onPairs = pairsOf(ons, own);
    fireShutdown();
    const offPairs = pairsOf(offs, own);

    expect(onPairs.length).toBe(eventNames(onPairs).size);
    expect(offPairs.length).toBe(eventNames(offPairs).size);
    expect(offs.length).toBeGreaterThanOrEqual(onPairs.length);
  });

  it('SHUTDOWN 前：emitter 上每个被订阅事件的挂载表里确有 UIScene 自己的 handler（给下一例做判别力基线）', () => {
    const { scene, ons, offs, emitter } = mount();
    const own = ownHandlers(scene);
    const onPairs = pairsOf(ons, own);
    for (const p of onPairs) {
      expect(emitter.listeners(p.event).some((l) => l === p.fn), `挂载表里没有 ${p.event} 的 UIScene handler`).toBe(
        true,
      );
    }
    void offs;
  });

  it('SHUTDOWN 后：emitter 上再也找不到任何 UIScene 自己的 handler（漏一行 store.off 即该事件红）', () => {
    const { scene, ons, offs, emitter } = mount();
    const own = ownHandlers(scene);
    const onPairs = pairsOf(ons, own);
    fireShutdown();
    const leaked = onPairs.filter((p) => emitter.listeners(p.event).some((l) => l === p.fn));
    expect(leaked.map((p) => p.event), 'SHUTDOWN 后仍挂着的 UIScene 事件').toEqual([]);
    expect(offs.length).toBeGreaterThanOrEqual(onPairs.length);
  });
});
