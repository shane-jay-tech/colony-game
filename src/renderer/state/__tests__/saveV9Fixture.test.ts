// saveV9Fixture——v9 现档夹具守护（c922-122）。
//
// 与 saveMatrix.test.ts 的分工（不重复计账）：
//   · saveMatrix 组 A/B/C 用 blobAt() 手搓的**最小合成档**（6 个 state 键）跑 v1..8 迁移链；
//   · 本件用 **serialize 真实导出的当版全字段档**（51 个 state 键）钉 v9 本身。
//   v10-guard-spec §一.1 说「组 A 用各档位老 fixture 驱动」——盘上实测该句不准（组 A 是合成档，
//   仓内此前**零** fixture，本件是第一个），已在 c922-122 result 留痕。
//
// 本单**不 bump 版本号**：SAVE_SCHEMA_VERSION 仍 9（saveLoad.ts:19）。
// 组 C 已钉「恒为 9」，本件不重复钉数值，改钉「夹具与当版恒等 ⇒ 零迁移触发」这条组 C 管不到的面。
//
// 夹具再生产（字节确定，实测两次跑 sha256 逐位相同）：
//   npx tsx scripts/gen-save-v9-fixture.mts
// 注意 serialize 在 saveLoad.ts:310 无条件写 savedAt: Date.now()（生产码，本单未改），
// 故生成脚本把 savedAt 钉成常量；本件的往返比对同样先归一 savedAt。
import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, deserialize, serialize } from '../saveLoad';
import fixture from './__fixtures__/save-v9.json';

type SerializedSave = ReturnType<typeof serialize>;
type StateKey = keyof SerializedSave['state'];

/** 夹具落盘时的 schemaVersion——与 SAVE_SCHEMA_VERSION 分离断言，bump 时才有「旧档」可用。 */
const FIXTURE_SCHEMA_VERSION = 9;

function v9Blob(): SerializedSave {
  return structuredClone(fixture) as unknown as SerializedSave;
}

/** 归一掉 wall-clock 字段，使 serialize 输出可与夹具逐字节比。 */
function withoutSavedAt<T extends { savedAt: number }>(blob: T): Omit<T, 'savedAt'> {
  const { savedAt: _dropped, ...rest } = blob;
  return rest;
}

describe('saveV9Fixture v9 现档可原样载入且零迁移触发', () => {
  it('夹具落盘版本 == 当版常量 ⇒ deserialize 走「不迁移」分支（saveLoad.ts:395 的 < 判据不成立）', () => {
    expect(FIXTURE_SCHEMA_VERSION).toBe(9);
    expect(fixture.schemaVersion).toBe(FIXTURE_SCHEMA_VERSION);
    // 这条等式就是「零迁移触发」的机理：schemaVersion < SAVE_SCHEMA_VERSION 为假 ⇒ runMigrations 不被调用。
    // bump 到 10 而漏写 migrations[9] 时，本用例本身仍绿（它只证夹具是 v9 档），
    // 但下一条「不抛」会当场红成 'No migration path from schema version 9'——即 v10-guard-spec §二.1 的期望红形态。
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(fixture.schemaVersion);
  });

  it('v9 夹具 deserialize 不抛，且玩家字段逐值原样保留（无迁移改写）', () => {
    const s = fixture.state;
    const restored = deserialize(v9Blob()) as unknown as Record<string, unknown>;
    // 「原样」用真值钉，而不是只看不抛：这些值全部来自 30 日真实模拟
    expect(restored['currentDay']).toBe(s.currentDay);
    expect(restored['rngSeed']).toBe(s.rngSeed);
    expect(restored['resources']).toEqual(s.resources);
    expect(restored['buildings']).toEqual(s.buildings);
    expect(restored['npcCountries']).toEqual(s.npcCountries);
    expect(s.buildings.length).toBeGreaterThan(0); // 夹具非空壳：Slice-G buildings shape 校验面被真覆盖
  });
});

describe('saveV9Fixture 往返字节稳定（夹具是当版 schema 的不动点）', () => {
  it('serialize(deserialize(夹具)) 除 savedAt 外与夹具逐字节相等', () => {
    const roundTrip = serialize(deserialize(v9Blob()));
    expect(withoutSavedAt(roundTrip)).toEqual(withoutSavedAt(v9Blob()));
  });
});

describe('saveV9Fixture 字段面一致（防夹具自身腐烂）', () => {
  it('夹具 state 顶层键集 == serialize() 当版产出的键集，且无 undefined 值键', () => {
    const roundTrip = serialize(deserialize(v9Blob()));
    expect(Object.keys(fixture.state).sort()).toEqual(Object.keys(roundTrip.state).sort());
    // 序列化面出现 undefined 是"夹具腐烂"的典型形态（JSON 会静默丢键），显式钉住
    for (const [k, v] of Object.entries(fixture.state)) {
      expect(v, `state.${String(k)}`).not.toBeUndefined();
    }
    expect(Object.keys(fixture).sort()).toEqual(['savedAt', 'schemaVersion', 'state']);
  });

  it('state 键数 ≥ 50（合成档只有 6 键；夹具必须覆盖全字段面）', () => {
    const keys = Object.keys(fixture.state) as StateKey[];
    expect(keys.length).toBeGreaterThanOrEqual(50);
  });
});

describe('saveV9Fixture 新字段缺省合理（向后兼容加法的正反两向）', () => {
  // v8→v9 只加了一个字段（migrations[8]，saveLoad.ts:188-195 注入 wrathUltimatumEndDay=null）。
  // 把当版夹具里"v9 期才有的字段"整批抽掉，模拟旧档缺字段的读入面：
  // 缺省必须等于真实生成值，否则说明 deserialize 的兜底与 serialize 的产出不同源。
  const V9_ERA_KEYS = [
    'wrathUltimatumEndDay',
  ] as const;

  it('抽掉 v9 新增字段后仍读得开，且缺省值与夹具真值逐字段相等', () => {
    const stripped = v9Blob();
    const full = structuredClone(fixture).state as unknown as Record<string, unknown>;
    const s = stripped.state as unknown as Record<string, unknown>;
    for (const key of V9_ERA_KEYS) {
      expect(s[key], `夹具应含 ${key}`).toBeDefined();
      delete s[key];
    }
    const restored = deserialize(stripped) as unknown as Record<string, unknown>;
    for (const key of V9_ERA_KEYS) {
      expect(restored[key], `缺省值应等于夹具真值 ${String(full[key])}`).toEqual(full[key]);
    }
  });

  it('反向：v9 夹具降级标成 v1..8 逐档仍读得开（真实全字段档过整条迁移链不炸）', () => {
    // saveMatrix 组 A 用的是 6 键合成档；这条用 51 键真档过链，覆盖「迁移函数撞真实字段」的面。
    for (let v = 1; v < FIXTURE_SCHEMA_VERSION; v++) {
      const blob = v9Blob();
      blob.schemaVersion = v;
      let message: string | null = null;
      try {
        deserialize(blob);
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message, `v${String(v)} 真档迁移应不抛`).toBeNull();
    }
  });
});
