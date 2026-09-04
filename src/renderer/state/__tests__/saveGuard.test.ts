// 特征+对抗测试：存档迁移链守护（task 20260904-194639-6bb2, B21）。
// 不改产品代码；以现行行为为准钉住，可疑处留 TODO 供日间。
import { describe, expect, it } from 'vitest';
import {
  SAVE_SCHEMA_VERSION,
  SaveLoadError,
  deserialize,
  serialize,
} from '../saveLoad';

// 造一个最小合法 v9 存档（状态面收敛到 deserialize 必需字段）
function validV9(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 9,
    savedAt: '2026-09-04T12:00:00',
    state: {
      rngSeed: 7,
      day: 5,
      speed: 2,
      resources: { wood: 100, grain: 50, people: 10 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
      storyFlags: {},
      ...overrides,
    },
  };
}

describe('a) 版本链边界：v1 最小档逐级迁移到 v9', () => {
  it('v1 最小输入可迁移并被反序列化，缺省字段落到安全默认', () => {
    const blob = { schemaVersion: 1, state: { speed: 2, rngSeed: 7 } };
    const gs = deserialize(blob);
    expect(gs.resources).toBeDefined();
    expect(gs.speed).toBe(2);
  });

  it('v1→v9 迁移注入 populationClasses（migration 1 的行为）', () => {
    const blob = {
      schemaVersion: 1,
      state: { resources: { people: 12 } },
    };
    const gs = deserialize(blob);
    // migration 1 会注入 populationClasses（具体类目数值结构由 createDefaultPopulation 决定）
    expect(gs.populationClasses).toBeDefined();
  });

  it('当前版本 roundtrip：serialize → deserialize 关键字段保真', () => {
    const blob = validV9({ currentDay: 5, rngSeed: 7 });
    const gs = deserialize(blob);
    const again = serialize(gs);
    expect(again.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect((again.state as { rngSeed: number }).rngSeed).toBe(7);
    expect((again.state as { currentDay: number }).currentDay).toBe(5);
  });
});

describe('b) 损坏与类型错乱对抗', () => {
  it('截断 JSON 字符串被拒（不是对象）', () => {
    expect(() => deserialize('{"schemaVersion":9,"state":{"resou')).toThrow(SaveLoadError);
  });

  it('数组冒充对象被拒（缺 schemaVersion）', () => {
    expect(() => deserialize([1, 2, 3])).toThrow(SaveLoadError);
  });

  it('null / 数字 / 布尔被拒', () => {
    expect(() => deserialize(null)).toThrow(SaveLoadError);
    expect(() => deserialize(42)).toThrow(SaveLoadError);
    expect(() => deserialize(true)).toThrow(SaveLoadError);
  });

  it('schemaVersion 为字符串被拒', () => {
    const blob = validV9();
    (blob as { schemaVersion: unknown }).schemaVersion = '9';
    expect(() => deserialize(blob)).toThrow(/schemaVersion must be a number/);
  });

  it('speed 越界（99 / -1 / "2"）被 clamp 回默认 1', () => {
    expect(deserialize(validV9({ speed: 99 })).speed).toBe(1);
    expect(deserialize(validV9({ speed: -1 })).speed).toBe(1);
    expect(deserialize(validV9({ speed: '2' })).speed).toBe(1);
  });

  it('rngSeed 为 NaN/Infinity/字符串 回退默认 12345', () => {
    expect(deserialize(validV9({ rngSeed: NaN })).rngSeed).toBe(12345);
    expect(deserialize(validV9({ rngSeed: Infinity })).rngSeed).toBe(12345);
    expect(deserialize(validV9({ rngSeed: '42' })).rngSeed).toBe(12345);
  });

  it('必填字段整体缺失（state 为 undefined）现状：抛错', () => {
    // 现行 deserialize 解构 s = data.state 后立即读 s.speed → TypeError 而非 SaveLoadError。
    // TODO(日间)：把"缺 state"纳入 SaveLoadError 通道，而非让 TypeError 冒泡。
    const blob = { schemaVersion: 9 };
    expect(() => deserialize(blob)).toThrow(TypeError);
  });

  it('resources 为字符串：现状被原样保留（可疑）', () => {
    // TODO(日间)：resources 缺 shape 校验，字符串会流入渲染层；
    // 现钉住现状：不抛错且原样带出。
    const gs = deserialize(validV9({ resources: 'oops' }));
    expect(gs.resources as unknown).toBe('oops');
  });

  it('currentDay 超大数：现状不做 clamp 原样带出（可疑）', () => {
    // TODO(日间)：给 currentDay 加上界；超大值会流入 UI 与事件判定。
    const gs = deserialize(validV9({ currentDay: Number.MAX_SAFE_INTEGER + 1 }));
    expect(gs.currentDay).toBe(9007199254740992);
  });
});

describe('c) 未来版本档', () => {
  it('v10 明确报错，不静默降级', () => {
    const blob = validV9();
    blob.schemaVersion = SAVE_SCHEMA_VERSION + 1;
    expect(() => deserialize(blob)).toThrow(/future schema version/);
  });
});

describe('d) 迁移幂等', () => {
  it('同一旧档迁移两次结果深比较一致', () => {
    const blob = { schemaVersion: 1, state: { speed: 2, rngSeed: 7, resources: { people: 12 } } };
    const a = deserialize(JSON.parse(JSON.stringify(blob)));
    const b = deserialize(JSON.parse(JSON.stringify(blob)));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
