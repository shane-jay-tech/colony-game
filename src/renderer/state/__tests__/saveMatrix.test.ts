// saveMatrix——存档迁移入口全档位连通矩阵（d914-76 N3）。
// 补上唯一没有 fixture 的 v8→v9 入口，并加「迁移链完整」前向守护：
// 以后 bump SAVE_SCHEMA_VERSION 时若忘了写 migrations[N]，组 A 会当场变红
// （No migration path 会被逐档收集，而不是静默放过）。
// 只用 deserialize / SAVE_SCHEMA_VERSION / SaveLoadError，零产品码改动。
import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, deserialize } from '../saveLoad';

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

// 收集器：组 A 用「逐档 it」落数；任何一档抛错（含 No migration path）都会让该档变红
describe('saveMatrix 迁移链全档位连通（v1..SAVE_SCHEMA_VERSION-1 → 最新）', () => {
  const failedVersions: { version: number; message: string }[] = [];
  const collected: number[] = [];

  for (let v = 1; v < SAVE_SCHEMA_VERSION; v++) {
    it(`v${v} 老档可无异常迁到最新（No migration path 即红）`, () => {
      collected.push(v);
      try {
        deserialize(blobAt(v));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failedVersions.push({ version: v, message });
      }
      expect(failedVersions.filter((f) => f.version === v)).toEqual([]);
    });
  }

  it('A 组收尾：所有档位零失败（failedVersions 显式断言，不靠没报错就算过）', () => {
    expect(collected).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(failedVersions).toEqual([]);
  });
});

describe('saveMatrix v8 首覆盖（8→9 通牒注入 + 迁移不丢玩家字段）', () => {
  it('v8 老档迁移后 wrathUltimatumEndDay 注入 null（8→9）', () => {
    const gs = deserialize(blobAt(8)) as unknown as Record<string, unknown>;
    expect(gs['wrathUltimatumEndDay']).toBeNull();
  });

  it('v8 老档迁移后 lastPropagandaDay 仍为 null（5→6 旧注入对 v8 起点档保持成立）', () => {
    const gs = deserialize(blobAt(8)) as unknown as Record<string, unknown>;
    expect(gs['lastPropagandaDay']).toBeNull();
  });

  it('v8 老档迁移不丢玩家字段（grain=123 原值保留）', () => {
    const gs = deserialize(blobAt(8)) as unknown as { resources: { grain: number } };
    expect(gs.resources['grain']).toBe(123);
  });
});

describe('saveMatrix 迁移链完整前向守护', () => {
  it(`SAVE_SCHEMA_VERSION 恒为 9（bump 版本号时必须同时给 migrations[N]，组 A 会在漏写时变红）`, () => {
    expect(SAVE_SCHEMA_VERSION).toBe(9);
  });
});
