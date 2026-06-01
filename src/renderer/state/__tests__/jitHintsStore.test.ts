import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import { serialize, deserialize } from '../saveLoad';

const newStore = (): GameStore => new GameStore(new EventEmitter() as unknown as IEventEmitter);

describe('GameStore JIT 提示去重 + 持久化', () => {
  it('markJitHintSeen 首次返回 true、再次返回 false', () => {
    const store = newStore();
    expect(store.getSeenJitHints().has('first_build')).toBe(false);
    expect(store.markJitHintSeen('first_build')).toBe(true);
    expect(store.markJitHintSeen('first_build')).toBe(false);
    expect(store.getSeenJitHints().has('first_build')).toBe(true);
  });

  it('seenJitHints 经 serialize→deserialize 往返保留', () => {
    const store = newStore();
    store.markJitHintSeen('first_crisis');
    store.markJitHintSeen('first_grade');
    const blob = serialize((store as unknown as { state: Parameters<typeof serialize>[0] }).state);
    const restored = deserialize(JSON.parse(JSON.stringify(blob)));
    expect(restored.seenJitHints.sort()).toEqual(['first_crisis', 'first_grade']);
  });

  it('损坏存档 lastEventDay 超大 → clamp 到 currentDay（防事件永久不触发）', () => {
    const store = newStore();
    const blob = serialize((store as unknown as { state: Parameters<typeof serialize>[0] }).state);
    blob.state.currentDay = 100;
    (blob.state as { lastEventDay?: number }).lastEventDay = 999999;
    const restored = deserialize(JSON.parse(JSON.stringify(blob)));
    expect(restored.lastEventDay).toBe(100);
  });

  it('旧存档无 seenJitHints 字段 → 反序列化为空数组（向后兼容）', () => {
    const store = newStore();
    const blob = serialize((store as unknown as { state: Parameters<typeof serialize>[0] }).state);
    delete (blob.state as { seenJitHints?: unknown }).seenJitHints;
    const restored = deserialize(JSON.parse(JSON.stringify(blob)));
    expect(restored.seenJitHints).toEqual([]);
  });
});
