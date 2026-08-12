/**
 * P1 类型化事件面覆盖守护：STATE_EVENTS 值与 GameStateEventMap 名单双向一致、无重复。
 */
import { describe, it, expect } from 'vitest';
import { STATE_EVENTS } from '../gameStore';
import { STATE_EVENT_NAMES } from '../stateEvents';

describe('类型化事件面覆盖', () => {
  it('STATE_EVENTS 值 == STATE_EVENT_NAMES（双向无漏无多）', () => {
    const actual = Object.values(STATE_EVENTS);
    expect([...actual].sort()).toEqual([...STATE_EVENT_NAMES].sort());
  });

  it('事件名无重复', () => {
    expect(new Set(STATE_EVENT_NAMES).size).toBe(STATE_EVENT_NAMES.length);
    expect(new Set(Object.values(STATE_EVENTS)).size).toBe(Object.values(STATE_EVENTS).length);
  });
});
