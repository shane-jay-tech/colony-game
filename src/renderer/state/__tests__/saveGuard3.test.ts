// 存档守护第三包：损坏防御（#4/#5）＋中间断代迁移（#1/#2）＋回归保险（#3/#6/#7）。
// 候选清单来源：docs/insights/savegame-compat-audit-20260905.md §三/§四。
// 不改产品代码；以现行行为为准钉住，可疑处留 TODO 供日间。
import { describe, expect, it } from 'vitest';
import { SaveLoadError, SAVE_SCHEMA_VERSION, deserialize } from '../saveLoad';
import { WARINESS_BASELINE } from '../wariness';

// 最小 v4 档（手工构造，不依赖 git 历史）：省略 worldMap（旧档由 rngSeed 再生）
function v4Blob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 4,
    state: {
      rngSeed: 7,
      speed: 2,
      resources: { wood: 10 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
      ...overrides,
    },
  };
}

// v7 档：C1 古迹链已上线（v6 迁移引入 relicSites），C2 终局波次未上线
function v7Blob(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 7,
    state: {
      rngSeed: 7,
      speed: 2,
      resources: { wood: 10 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
      relicSites: [],
      ...overrides,
    },
  };
}

// ---------- #4 损坏防御：非对象/截断输入 ----------

describe('#4 顶层非对象输入一律 SaveLoadError', () => {
  it('截断 JSON 字符串被入口拒绝（不裸抛 SyntaxError）', () => {
    // serialize 产物截断后是 string；deserialize 只收对象——现状在入口即拒。
    // TODO(日间): loadFromSlot(saveLoad.ts:771) 的 JSON.parse 不包异常，真·截断档
    // 从磁盘路径会裸抛 SyntaxError——若要收敛需包一层 SaveLoadError（本测试不钉该路径）。
    const truncated = '{"schemaVersion":9,"state":{"rngSeed":7,"speed":2,"resou';
    expect(() => deserialize(truncated)).toThrow(SaveLoadError);
    expect(() => deserialize(truncated)).toThrow(/must be a non-null object/);
  });

  it('null 与数字等标量输入被拒', () => {
    expect(() => deserialize(null)).toThrow(SaveLoadError);
    expect(() => deserialize(42)).toThrow(SaveLoadError);
  });
});

// ---------- #5 损坏防御：顶层缺 state ----------

describe('#5 顶层缺 state / state 为 null', () => {
  it('缺 state：现状裸 TypeError（TODO 日间换明确 SaveLoadError 信息）', () => {
    // 现状：版本检查通过后直接读 s.speed，s 为 undefined → TypeError。
    expect(() => deserialize({ schemaVersion: 9 })).toThrow(TypeError);
    expect(() => deserialize({ schemaVersion: 9 })).toThrow(/speed/);
  });

  it('state 为 null：同类 TypeError', () => {
    expect(() => deserialize({ schemaVersion: 9, state: null })).toThrow(TypeError);
  });
});

// ---------- #3 回归保险：迁移缺失 ----------

describe('#3 无迁移路径', () => {
  it('浮点 schemaVersion 5.5 报 No migration path 且含原始版本号', () => {
    expect(() => deserialize(v4Blob({} as Record<string, unknown>))).not.toThrow();
    const float = { schemaVersion: 5.5, state: { rngSeed: 1, speed: 1 } };
    expect(() => deserialize(float)).toThrow(/No migration path from schema version 5\.5/);
  });
});

// ---------- #7 回归保险：未来版本 ----------

describe('#7 未来版本报错含版本号', () => {
  it('schemaVersion=10 的报错信息包含 "10"', () => {
    expect(() => deserialize({ schemaVersion: 10, state: {} })).toThrow(/10/);
    expect(() => deserialize({ schemaVersion: 10, state: {} })).toThrow(SaveLoadError);
  });

  it('当前版本常量仍为 9（迁移链钉桩前提）', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(9);
  });
});

// ---------- #1 中间断代：v4 → v9 ----------

describe('#1 v4 起步迁移注入 worldWariness 基线', () => {
  it('v4 档迁移到 v9 后 worldWariness=WARINESS_BASELINE(20)', () => {
    const gs = deserialize(v4Blob());
    expect(gs.worldWariness).toBe(WARINESS_BASELINE);
    expect(gs.worldWariness).toBe(20);
    expect(gs.lastWarinessReason).toBeNull();
  });

  it('v4 档迁移链尾注入齐全：endgame 两字段与通牒日均为 null', () => {
    const gs = deserialize(v4Blob());
    expect(gs.endgameAscendDay).toBeNull();
    expect(gs.endgameLastWaveDay).toBeNull();
    expect(gs.wrathUltimatumEndDay).toBeNull();
    expect(gs.relicSites).toEqual([]);
  });
});

// ---------- #2 中间断代：v7 → v9 ----------

describe('#2 v7 起步迁移注入 endgame 字段且 relicSites 保留', () => {
  it('v7 档迁移后 endgameAscendDay/endgameLastWaveDay 注入为 null', () => {
    const gs = deserialize(v7Blob());
    expect(gs.endgameAscendDay).toBeNull();
    expect(gs.endgameLastWaveDay).toBeNull();
  });

  it('v7 档自带合法 relicSite 迁移后原样保留（字段归一）', () => {
    const site = {
      id: 'site_a',
      chainId: 'chain_1',
      name: '先农坛',
      position: { x: 2.6, y: 3 },
      stage: 1,
      done: false,
    };
    const gs = deserialize(v7Blob({ relicSites: [site] }));
    expect(gs.relicSites).toHaveLength(1);
    const kept = gs.relicSites[0]!;
    expect(kept).toMatchObject({ id: 'site_a', chainId: 'chain_1', stage: 1, done: false });
    expect(kept.position).toEqual({ x: 2, y: 3 }); // 现状：position 逐字段取整
  });

  it('v7 档 relicSites 中非法项被静默过滤（现状兜底）', () => {
    const gs = deserialize(v7Blob({ relicSites: [{ id: 7 }, 'junk', null] }));
    expect(gs.relicSites).toEqual([]);
  });
});

// ---------- #6 回归保险：迁移保真 ----------

describe('#6 迁移不丢玩家字段', () => {
  it('v3 档 resources.grain=123 迁移到 v9 后仍为 123', () => {
    const v3 = {
      schemaVersion: 3,
      state: {
        rngSeed: 7,
        speed: 2,
        resources: { grain: 123, wood: 4 },
        buildings: [],
        policies: [],
        activeModifiers: [],
        activeDecrees: [],
      },
    };
    const gs = deserialize(v3);
    expect(gs.resources['grain']).toBe(123);
    expect(gs.resources['wood']).toBe(4);
  });

  it('v1 最老档走全迁移链不炸且注入 populationClasses', () => {
    const v1 = {
      schemaVersion: 1,
      state: {
        rngSeed: 7,
        speed: 2,
        resources: { people: 5, grain: 123 },
        buildings: [],
        policies: [],
        activeModifiers: [],
        activeDecrees: [],
      },
    };
    const gs = deserialize(v1);
    expect(gs.resources['grain']).toBe(123);
    expect(gs.populationClasses).toBeTruthy();
    expect(gs.grainNegativeDays).toBe(0); // 迁移 1 注入
  });
});
