// c-13：类型化事件面行为断言（GameStore 泛型 on/off/emit + STATE_EVENTS 值域收窄）。
import { describe, expect, it } from 'vitest';
import { GameStore, STATE_EVENTS, type StateEventName } from '../gameStore';

function makeStore(): GameStore {
  const listeners = new Map<string, Set<(...a: unknown[]) => void>>();
  const emitter = {
    on(e: string, fn: (...a: unknown[]) => void) { listeners.set(e, (listeners.get(e) ?? new Set()).add(fn)); },
    off(e: string, fn: (...a: unknown[]) => void) { listeners.get(e)?.delete(fn); },
    emit(e: string, ...args: unknown[]) { listeners.get(e)?.forEach(fn => fn(...args)); },
    listenerCount(e: string) { return listeners.get(e)?.size ?? 0; },
  };
  return new GameStore(emitter as never);
}

describe('c13 typed event surface', () => {
  it('泛型 on/off/emit：合法事件名（StateEventName）可订阅、触发、注销', () => {
    const store = makeStore();
    const seen: unknown[] = [];
    const ev: StateEventName = STATE_EVENTS.DAY_TICK;
    const fn = (...a: unknown[]) => seen.push(a[0]);
    store.on(ev, fn);
    store.emit(ev, 7);
    expect(seen).toEqual([7]);
    expect(store.listenerCount(ev)).toBe(1);
    store.off(ev, fn);
    expect(store.listenerCount(ev)).toBe(0);
  });

  it('StateEventName 覆盖全部 STATE_EVENTS 值（新增事件自动入联合类型）', () => {
    const values = Object.values(STATE_EVENTS) as StateEventName[];
    expect(values.length).toBeGreaterThan(20);
    expect(values).toContain('state:resourcesChanged');
    expect(values).toContain('state:gradeChanged');
  });

  it('拼错事件名被类型层拒绝（@ts-expect-error 编译期守卫）', () => {
    const store = makeStore();
    // @ts-expect-error 非法事件名必须在编译期被拒
    expect(() => store.on('state:not-a-real-event', () => {})).not.toThrow();
  });
});
