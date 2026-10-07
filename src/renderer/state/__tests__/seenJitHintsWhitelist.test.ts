// c1007-29：孤儿键 seenJitHints 白名单 filter（c1007-10 遗留）。
// 场景：未来删 JIT_HINTS 某键后，旧档 seenJitHints 里残留该孤儿 trigger——
// 未过滤时会进 seen 集（JitHintManager 判重面被污染）。本件钉：反序列化时
// 孤儿键被白名单弃置、在册键原样保留。
import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../saveLoad';
import { JIT_HINTS } from '../../data/jitHints';
import type { GameState } from '../gameStore';

function makeState(seen: unknown[]): GameState {
  return {
    resources: { grain: 100, wood: 50 },
    buildings: [],
    policies: [],
    activeModifiers: [],
    activeDecrees: [],
    eventHistory: [],
    pendingEventId: null,
    pendingEventDayStart: null,
    tutorialStepId: null,
    seenJitHints: seen,
    lastEventDay: 0,
    lastSeenTimestamp: 12345678,
    rngSeed: 42,
    paused: false,
    speed: 1,
  } as unknown as GameState;
}

function roundtrip(seen: unknown[]): string[] {
  const blob = JSON.parse(JSON.stringify(serialize(makeState(seen))));
  // 模拟旧档：把 seenJitHints 灌成含孤儿键的数组（serialize 后篡改，同旧档实形）
  (blob.state as Record<string, unknown>).seenJitHints = seen;
  return deserialize(blob).seenJitHints as string[];
}

describe('c1007-29 seenJitHints 白名单 filter', () => {
  it('孤儿键（不在 JIT_HINTS）被弃置；在册键原样保留', () => {
    const keeper = Object.keys(JIT_HINTS)[0];
    const out = roundtrip([keeper, 'deleted_hint_ghost', 'another_ghost']);
    expect(out).toEqual([keeper]);
    expect(out).not.toContain('deleted_hint_ghost');
  });

  it('首提示不吞：孤儿残键不进 seen 集，判重面对真删键后的新键恒放行', () => {
    const out = roundtrip(['first_build', 'first_build_legacy_removed']);
    expect(out).toEqual(['first_build']);
    expect(new Set(out).has('first_build_legacy_removed')).toBe(false);
  });

  it('非字符串条目维持既有过滤（typeof 守卫保留）', () => {
    const out = roundtrip([123, null, 'first_build']);
    expect(out).toEqual(['first_build']);
  });
});
