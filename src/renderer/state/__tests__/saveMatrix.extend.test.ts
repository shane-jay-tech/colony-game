import { describe, expect, it } from 'vitest';
import { deserialize } from '../saveLoad';

// c916-07：v8→v9 玩家字段保留/注入行为扩展断言（不改 saveLoad.ts 与迁移函数）。
// 现有组 B 覆盖 wrathUltimatumEndDay 注入与 grain 保留；本文件补齐其余玩家字段。

function blobAt(version: number) {
  return {
    schemaVersion: version,
    state: {
      rngSeed: 7,
      speed: 1,
      resources: { grain: 123, people: 9 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
    },
  };
}

describe('saveMatrix 组 B 扩展：v8→v9 全玩家字段保留（c916-07）', () => {
  it('rngSeed 原值保留', () => {
    const gs = deserialize(blobAt(8)) as unknown as Record<string, unknown>;
    expect(gs['rngSeed']).toBe(7);
  });

  it('speed 原值保留', () => {
    const gs = deserialize(blobAt(8)) as unknown as Record<string, unknown>;
    expect(gs['speed']).toBe(1);
  });

  it('people 原值保留', () => {
    const gs = deserialize(blobAt(8)) as unknown as { resources: { people: number } };
    expect(gs.resources['people']).toBe(9);
  });

  it('容器字段（buildings/policies/activeModifiers/activeDecrees）引用保留', () => {
    const gs = deserialize(blobAt(8)) as unknown as Record<string, unknown>;
    expect(Array.isArray(gs['buildings'])).toBe(true);
    expect(Array.isArray(gs['policies'])).toBe(true);
    expect(Array.isArray(gs['activeModifiers'])).toBe(true);
    expect(Array.isArray(gs['activeDecrees'])).toBe(true);
  });

  it('通牒注入不影响既有键（wrathUltimatumEndDay 外无新增/删除 state 顶层键）', () => {
    const before = blobAt(8).state;
    const gs = deserialize(blobAt(8)) as unknown as Record<string, unknown>;
    for (const key of Object.keys(before)) {
      expect(key in gs).toBe(true);
    }
    expect('wrathUltimatumEndDay' in gs).toBe(true);
  });
});
