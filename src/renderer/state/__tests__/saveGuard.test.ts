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
      // r5 B2：eventHistory 是载荷字段（缺它＝拒载）⇒ 最小合法档必须带上
      eventHistory: [],
      storyFlags: {},
      ...overrides,
    },
  };
}

describe('a) 版本链边界：v1 档经迁移链后可载入（只验终态）', () => {
  it('v1 最小档可载入：resources 落空对象兜轨、speed 原样透传（不断言默认值内容）', () => {
    const blob = { schemaVersion: 1, state: { speed: 2, rngSeed: 7 } };
    const gs = deserialize(blob);
    expect(gs.resources).toBeDefined();
    expect(gs.speed).toBe(2);
  });

  it('v1 档载入后 populationClasses 非空（迁移注入与反序列化兜底任一路径都满足 ⇒ 不点名 migration 1）', () => {
    const blob = {
      schemaVersion: 1,
      state: { resources: { people: 12 } },
    };
    const gs = deserialize(blob);
    // migration 1 会注入 populationClasses（具体类目数值结构由 createDefaultPopulation 决定）
    expect(gs.populationClasses).toBeDefined();
  });

  it('v9 档 deserialize→serialize 单向：产物 schemaVersion=9 且 rngSeed/currentDay 透传（未回读，非 roundtrip）', () => {
    const blob = validV9({ currentDay: 5, rngSeed: 7 });
    const gs = deserialize(blob);
    const again = serialize(gs);
    expect(again.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect((again.state as { rngSeed: number }).rngSeed).toBe(7);
    expect((again.state as { currentDay: number }).currentDay).toBe(5);
  });
});

describe('b) 损坏与类型错乱对抗', () => {
  it('字符串入参被入口非对象门拒（parse 通道归 loadFromSlot，其钉桩在 saveLoadIo.test.ts:27）', () => {
    expect(() => deserialize('{"schemaVersion":9,"state":{"resou')).toThrow(SaveLoadError);
  });

  it('数组入参被拒（现状经缺 schemaVersion 通道；本例只钉错误类不钉消息）', () => {
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

  it('speed 不属于 0|1|2|3（99/-1/字符串2）时整体回落默认 1（非边界 clamp；0 为合法值本例未覆盖）', () => {
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

  it('currentDay 极大值拒载（走 >3600 分支；边界值与下界另组，本例不含）', () => {
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

describe('d) 反序列化决定论', () => {
  it('v1 档两次独立深拷贝反序列化结果逐字符一致（决定论钉桩，不覆盖同一对象复用与迁移幂等）', () => {
    const blob = { schemaVersion: 1, state: { speed: 2, rngSeed: 7, resources: { people: 12 } } };
    const a = deserialize(JSON.parse(JSON.stringify(blob)));
    const b = deserialize(JSON.parse(JSON.stringify(blob)));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ---------------- 020c：异常语义统一 SaveLoadError（两处收口回归） ----------------

describe('020c：当版档顶层损坏走 SaveLoadError 通道（低版档 state:null 走原生 TypeError，另册钉桩）', () => {
  it('字符串入参（截断样式样本）走同一非对象通道；而非裸 SyntaxError 属 loadFromSlot，钉桩在 saveLoadIo.test.ts:27 与 fullLifecycleLayerTriage:419-420', () => {
    // deserialize 入口层面的表征：截断 JSON 在 parse 阶段即失败，
    // deserialize 收到非对象输入时走同一条 SaveLoadError 通道。
    expect(() => deserialize('{ "schemaVersion": 9, "state": { "spe')).toThrow(SaveLoadError);
  });

  it('当版（v9）档缺 state：报错消息含 missing state field（类断言见 :94；低版档仍走原生 TypeError，见 saveLoad.test.ts:678）', () => {
    expect(() => deserialize({ schemaVersion: 9 })).toThrow(/missing state field/);
  });
});

// ---- c930-24 覆盖缺口补齐（c927-44 遗留：currentDay 边界/负值/NaN、speed 下界 0）----
describe('c930-24 currentDay 边界与 speed 下界补口', () => {
  it('currentDay=3600（上界）可载入且值原样透传', () => {
    const gs = deserialize(validV9({ currentDay: 3600 }));
    expect(gs.currentDay).toBe(3600);
  });

  it('currentDay=3601（越上界 1）拒载且消息含 allowed 0..3600', () => {
    expect(() => deserialize(validV9({ currentDay: 3601 }))).toThrow(SaveLoadError);
    expect(() => deserialize(validV9({ currentDay: 3601 }))).toThrow(/out of range/);
    expect(() => deserialize(validV9({ currentDay: 3601 }))).toThrow(/allowed 0\.\.3600/);
  });

  it('currentDay 负值拒载（下界 0 在册）', () => {
    expect(() => deserialize(validV9({ currentDay: -5 }))).toThrow(/out of range/);
  });

  it('currentDay=NaN 拒载（Number.isFinite 门）', () => {
    expect(() => deserialize(validV9({ currentDay: NaN }))).toThrow(/out of range/);
  });

  it('speed=0（合法下界成员）原样载入不回落', () => {
    const gs = deserialize(validV9({ speed: 0 }));
    expect(gs.speed).toBe(0);
  });
});
