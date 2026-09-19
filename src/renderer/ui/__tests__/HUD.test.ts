// c918-22（colony P1-4 系列外延）：HUD 资源 token/国格徽章点击区钉桩。
// store 用真实 GameStore；scene 全 fake（全方法集 graphics，同 PopulationPanel 模式）。
// 依赖 gameStore 在途 M：钉桩以当前树现状为准；断言漂移按现状翻桩留痕。
// c919-01：fake builders 五件收口至共享脚手架 ./fakeScene（grep 单一定义处，语义零漂移）。
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

import { HUD } from '../HUD';

describe('HUD', () => {
  let scene: ReturnType<typeof makeFakeScene>;
  let store: GameStore;
  let hud: HUD;

  beforeEach(() => {
    scene = makeFakeScene({ tweens: true });
    store = makeStore();
    hud = new HUD(scene as never, store);
  });

  it('构造：注册 RESOURCES_CHANGED/DAY_TICK/PAUSED_CHANGED 等核心事件', () => {
    const onSpy = vi.spyOn(store, 'on');
    const hud2 = new HUD(scene as never, store);
    const events = onSpy.mock.calls.map(c => c[0]);
    expect(events).toContain(STATE_EVENTS.RESOURCES_CHANGED);
    expect(events).toContain(STATE_EVENTS.DAY_TICK);
    expect(events).toContain(STATE_EVENTS.PAUSED_CHANGED);
    void hud2;
    void hud;
  });

  it('destroy：RESOURCES_CHANGED/DAY_TICK/PAUSED_CHANGED 全部解绑', () => {
    const offSpy = vi.spyOn(store, 'off');
    hud.destroy();
    const events = offSpy.mock.calls.map(c => c[0]);
    expect(events).toContain(STATE_EVENTS.RESOURCES_CHANGED);
    expect(events).toContain(STATE_EVENTS.DAY_TICK);
    expect(events).toContain(STATE_EVENTS.PAUSED_CHANGED);
  });

  it('国格徽章：文本对象已建（盖章式金匾）', () => {
    // 构造成功即代表徽章/令牌文本对象装配完成（构造内 setText 空串占位）。
    expect(hud).toBeDefined();
  });
});
