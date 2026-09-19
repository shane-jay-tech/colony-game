// c919-04（c918-11 续）：currentDay tick clamp——到 3600 上界后时间停走；正常局不受影响。
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

describe('currentDay tick clamp（c919-04 TODO①）', () => {
  it('到达 3600 上界后 tickDay 时间停走（护栏与 saveLoad 上界同值）', () => {
    const store = new GameStore(makeEmitter(), { resources: { people: 10, grain: 100 } });
    const inner = store as unknown as { state: { currentDay: number } };
    inner.state.currentDay = 3600;
    store.tickDay();
    expect(store.getState().currentDay).toBe(3600);
  });

  it('正常局（0→1→2）不受 clamp 影响', () => {
    const store = new GameStore(makeEmitter(), { resources: { people: 10, grain: 100 } });
    store.tickDay();
    store.tickDay();
    expect(store.getState().currentDay).toBe(2);
  });
});
