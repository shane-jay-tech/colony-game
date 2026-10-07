// c1007-30：lastPlayerActionDay 字段兼容用例（c1007-12 遗留——随瞬态批）。
// 钉三面：①旧档（无字段）backfill=currentDay——idleDays 从读档日起算不虚增；
// ②新档往返保持——读档后 idleDays 计数不再归零（c1004-05 缺陷修复本身）；
// ③钳制——损坏存档超大值钳到 currentDay（idleDays 恒 ≥0）。
import { describe, expect, it } from 'vitest';
import { deserialize, serialize } from '../saveLoad';
import type { GameState } from '../gameStore';

function makeState(overrides: Record<string, unknown> = {}): GameState {
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
    seenJitHints: [],
    lastEventDay: 0,
    lastPlayerActionDay: 0,
    lastSeenTimestamp: 0,
    rngSeed: 42,
    paused: false,
    speed: 1,
    currentDay: 40,
  } as unknown as GameState;
}

describe('c1007-30 lastPlayerActionDay 兼容', () => {
  it('旧档无字段：backfill=currentDay，idleDays 首读=0 不虚增（hist_08 不误触发）', () => {
    const blob = JSON.parse(JSON.stringify(serialize(makeState())));
    delete (blob.state as Record<string, unknown>).lastPlayerActionDay; // 旧档形态
    const restored = deserialize(blob);
    expect(restored.lastPlayerActionDay).toBe(40); // = 读档时 currentDay
    expect(restored.currentDay - restored.lastPlayerActionDay).toBe(0); // idleDays 首读 0
  });

  it('新档往返：字段保持——读档后 idleDays 计数保持（修复读档归零缺陷）', () => {
    const state = makeState();
    state.lastPlayerActionDay = 33; // 7 天前最后一次动作
    const restored = deserialize(serialize(state));
    expect(restored.lastPlayerActionDay).toBe(33);
    expect(restored.currentDay - restored.lastPlayerActionDay).toBe(7); // idleDays 跨读档保持
  });

  it('损坏存档超大值钳到 currentDay（idleDays 恒 ≥0）', () => {
    const blob = JSON.parse(JSON.stringify(serialize(makeState())));
    (blob.state as Record<string, unknown>).lastPlayerActionDay = 99999;
    const restored = deserialize(blob);
    expect(restored.lastPlayerActionDay).toBe(40);
  });
});
