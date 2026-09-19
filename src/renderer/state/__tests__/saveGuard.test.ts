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

  it('必填字段整体缺失（state 为 undefined）：抛 SaveLoadError（020c 已收口）', () => {
    const blob = { schemaVersion: 9 };
    expect(() => deserialize(blob)).toThrow(SaveLoadError);
    expect(() => deserialize(blob)).toThrow('missing state field');
  });

  it('resources 为字符串：抛 SaveLoadError（p911r-40 shape 校验已收口原「可疑」项）', () => {
    // 原 TODO(日间) 已由 p911r-40 落地：resources 必须是有限数值记录，否则 SaveLoadError。
    expect(() => deserialize(validV9({ resources: 'oops' }))).toThrow(SaveLoadError);
  });

  it('currentDay 超上界（>3600）：拒载 SaveLoadError（c919-04 TODO① 落地翻桩）', () => {
    // 超大值流入 UI 与事件判定是攻击面；MAX_SAVE_CURRENT_DAY=3600（HORIZON_DAYS=720 的 5 倍护栏）。
    expect(() => deserialize(validV9({ currentDay: Number.MAX_SAFE_INTEGER + 1 }))).toThrow(SaveLoadError);
  });

  it('currentDay 界内值原样带出（正常档不受上界影响）', () => {
    const gs = deserialize(validV9({ currentDay: 365 }));
    expect(gs.currentDay).toBe(365);
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

// ---------------- 020c：异常语义统一 SaveLoadError（两处收口回归） ----------------

describe('020c：SaveLoadError 通道统一', () => {
  it('截断档（非法 JSON 字符串）→ SaveLoadError 而非裸 SyntaxError', () => {
    // deserialize 入口层面的表征：截断 JSON 在 parse 阶段即失败，
    // deserialize 收到非对象输入时走同一条 SaveLoadError 通道。
    expect(() => deserialize('{ "schemaVersion": 9, "state": { "spe')).toThrow(SaveLoadError);
  });

  it('缺 state 的档 → SaveLoadError 且信息明确（不再是裸 TypeError）', () => {
    expect(() => deserialize({ schemaVersion: 9 })).toThrow(/missing state field/);
  });
});
