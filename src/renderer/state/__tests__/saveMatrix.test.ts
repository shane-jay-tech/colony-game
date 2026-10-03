// saveMatrix——存档迁移入口全档位连通矩阵（d914-76 N3）。
// 补上唯一没有 fixture 的 v8→v9 入口，并加「迁移链完整」前向守护：
// 以后 bump SAVE_SCHEMA_VERSION 时若忘了写 migrations[N]，组 A 会当场变红
// （No migration path 会被逐档收集，而不是静默放过）。
// 只用 deserialize / serialize / SAVE_SCHEMA_VERSION，零产品码改动。
//
// c923-22＝c922-122 result 遗留问题④的**出口 (a) 落地**：组 A 的**末档**（v8→v9，
// 即 SAVE_SCHEMA_VERSION-1）不再用 blobAt 合成档，改读 __fixtures__/save-v9.json
// 真档降级深驱动 ⇒ saveLoad.ts:707 起的「Slice-G hardening：校验 buildings 每条 shape」
// 整段自此被**真实 buildings（4 条）**走过（合成档 buildings: [] 从未覆盖到）。
// 低档 v1..7 仍用 blobAt 合成档（过链快、断言薄），「只有末档换真档」由分派自证用例钉住。
// 与 saveV9Fixture.test.ts 的分工（不重复计账）：那件钉 v9 现档自身（零迁移分支），
// 本件末档钉「v8 真档过 8→9 链后仍是当版真档的不动点」。
import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, deserialize, serialize } from '../saveLoad';
import fixture from './__fixtures__/save-v9.json';

type SerializedSave = ReturnType<typeof serialize>;

/** 组 A 末档＝迁入当版的那一档（现值 v8）；bump SAVE_SCHEMA_VERSION 后自动跟随。 */
const LAST_TIER = SAVE_SCHEMA_VERSION - 1;

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

/** 真档降级成 vN 老档：夹具由 serialize 真实导出（c922-122，51 个 state 顶层键），
 *  只改 schemaVersion 即得「全字段老档」。
 *  structuredClone 必需——migrations[N] 是**原地改写** blob 的（saveLoad.ts:188-195），
 *  不克隆会污染 JSON 模块单例、把改动串给后续用例。 */
function realBlobAt(version: number): SerializedSave {
  const blob = structuredClone(fixture) as unknown as SerializedSave;
  blob.schemaVersion = version;
  return blob;
}

/** serialize 在 saveLoad.ts:310 无条件写 savedAt: Date.now()（生产码，本单未改），
 *  往返比对先归一掉这个 wall-clock 字段。 */
function withoutSavedAt<T extends { savedAt: number }>(blob: T): Omit<T, 'savedAt'> {
  const { savedAt: _dropped, ...rest } = blob;
  return rest;
}

/** 组 A 循环就地采集「每档实际喂进 deserialize 的档版本号＋state 键数」，供末档分派自证用例读。
 *  不在用例里重算分派式——重算＝测我自己，对分派改动零判别力。
 *  版本号必须一起采：只采键数的话，把真档标成 **当版** 会走 deserialize 的零迁移分支
 *  （saveLoad.ts:395 的 `< SAVE_SCHEMA_VERSION` 判据不成立）而全例仍绿＝对断线失明。 */
const tierInputs: { version: number; stateKeys: number }[] = [];

// 收集器：组 A 用「逐档 it」落数；任何一档抛错（含 No migration path）都会让该档变红
describe('saveMatrix 迁移链全档位连通（v1..SAVE_SCHEMA_VERSION-1 → 最新）', () => {
  const failedVersions: { version: number; message: string }[] = [];
  const collected: number[] = [];

  for (let v = 1; v < SAVE_SCHEMA_VERSION; v++) {
    it(`v${v} 老档可无异常迁到最新（No migration path 即红）`, () => {
      collected.push(v);
      // c923-22 出口(a)：末档真档深驱动，低档仍合成档。
      const blob = v === LAST_TIER ? realBlobAt(v) : blobAt(v);
      tierInputs.push({ version: blob.schemaVersion, stateKeys: Object.keys(blob.state).length });
      try {
        deserialize(blob);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failedVersions.push({ version: v, message });
      }
      expect(failedVersions.filter((f) => f.version === v)).toEqual([]);
    });
  }

  it('A 组收尾：所有档位零失败（failedVersions 显式断言，不靠没报错就算过）', () => {
    // n916x-34：遍历范围由版本常量派生（bump 后自动要求新档在列），替代原手写 [1..8]
    expect(collected).toEqual(
      Array.from({ length: SAVE_SCHEMA_VERSION - 1 }, (_, i) => i + 1),
    );
    expect(failedVersions).toEqual([]);
  });
});

describe('saveMatrix 组 A 末档真档深驱动（c923-22 出口 a：末档读 __fixtures__/save-v9.json）', () => {
  const REAL_STATE_KEYS = Object.keys(fixture.state).length;
  const SYNTH_STATE_KEYS = Object.keys(blobAt(1).state).length;

  it(`驱动分派自证：只有末档 v${LAST_TIER} 换真档，v1..${LAST_TIER - 1} 仍是合成档`, () => {
    // 读的是组 A 循环**实际喂进 deserialize** 的档版本号＋键数（tierInputs），不是本用例重算的分派式。
    expect(tierInputs.length).toBe(SAVE_SCHEMA_VERSION - 1);
    expect(tierInputs.map((t) => t.version)).toEqual(
      Array.from({ length: SAVE_SCHEMA_VERSION - 1 }, (_, i) => i + 1),
    );
    expect(tierInputs.map((t) => t.stateKeys)).toEqual([
      ...Array.from({ length: LAST_TIER - 1 }, () => SYNTH_STATE_KEYS),
      REAL_STATE_KEYS,
    ]);
    // 末档必须真的被喂进去、且标在**当版之下** ⇒ 真档走的是 runMigrations 而不是 deserialize 的零迁移分支
    // （`?.` 是 noUncheckedIndexedAccess 的写法要求；读数缺失 → undefined → 两条断言都红，不会静默放过）
    expect(tierInputs[LAST_TIER - 1]?.version).toBe(LAST_TIER);
    expect(tierInputs[LAST_TIER - 1]?.version).toBeLessThan(SAVE_SCHEMA_VERSION);
    // 判别力前置：真档与合成档必须真的不同形，否则上面的等式会退化成恒真
    expect(REAL_STATE_KEYS).toBeGreaterThan(SYNTH_STATE_KEYS);
  });

  it('末档输入是真档（≥50 键 + buildings 非空 ⇒ Slice-G buildings shape 校验被真实数据走过）', () => {
    const s = realBlobAt(LAST_TIER).state as unknown as Record<string, unknown>;
    expect(Object.keys(s).length).toBeGreaterThanOrEqual(50);
    expect(Array.isArray(s['buildings'])).toBe(true);
    expect((s['buildings'] as unknown[]).length).toBeGreaterThan(0);
    // 合成档的失明面对照：buildings 为空 ⇒ 校验整段被跳过
    expect((blobAt(LAST_TIER).state as unknown as Record<string, unknown>)['buildings']).toEqual([]);
  });

  it(`末档真档 deserialize→serialize 往返字节稳定：v${LAST_TIER} 真档迁到当版后与 v9 现档夹具同形`, () => {
    const roundTrip = serialize(deserialize(realBlobAt(LAST_TIER)));
    expect(withoutSavedAt(roundTrip)).toEqual(withoutSavedAt(structuredClone(fixture)));
    expect(roundTrip.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('末档真档过链后 state 顶层键集 == 当版 serialize 产出键集，且无 undefined 值键', () => {
    const roundTrip = serialize(deserialize(realBlobAt(LAST_TIER)));
    expect(Object.keys(roundTrip.state).sort()).toEqual(Object.keys(fixture.state).sort());
    // 序列化面出现 undefined 是「夹具腐烂／迁移漏字段」的典型形态（JSON 会静默丢键），显式钉住
    for (const [k, v] of Object.entries(roundTrip.state)) {
      expect(v, `state.${String(k)}`).not.toBeUndefined();
    }
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

  // n916x-34（v10 前向守护设计稿落地）：组 A 收尾的遍历范围已改为版本常量派生
  // （bump 后自动扩展，替代原手写 [1..8]）——见上方「组 A 收尾」用例。
  it('C 组版本恒等配套：最新前一档（SAVE_SCHEMA_VERSION-1）必须有迁移路径（漏写 migrations[N] 即红）', () => {
    // 直接证明「新版本号必须有迁移项」：v(N-1) 档 deserialize 若无迁移路径会抛
    // 'No migration path from schema version N'（saveLoad.ts），此处断言不抛该错。
    let message: string | null = null;
    try {
      deserialize(blobAt(SAVE_SCHEMA_VERSION - 1));
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toBeNull();
  });
});

// ── c1002-19（c924-20 设计稿 §4 A1 判别性断言独立落地，不与选案捆绑）──────────
// 设计稿原话：A1 证「迁移确实跑了、且会覆盖」——只有两路语义差才能满足的判据，
// 是 c923-22「删注入行 0 红」空洞的那把牙。锚＝migrations[8] 的 `s['wrathUltimatumEndDay'] = null;`（saveLoad.ts:192）。
// 红形态说明：设计稿预判「现在就会红」；本班首跑实测两行判据**绿**（迁移赢 ⇒ null；不跑链 ⇒ 兜底保留 999）
// ——即 A1 作为**回归哨兵**当下成立，其红名触发条件是「将来有人删 migrations[8] 注入行」（那刻第一行读到 999 即红）。
// 「现在就会红」的原预判指的应是 c923-22 旧断言族（无分叉值的断言在删行后仍 0 红）——A1 正是补那个洞，非自身红。
// 落地订正：设计稿的浅拷贝两面写法踩「migrations 原地改写」坑（首跑实测第二行假红 null≠999），已改独立克隆两台。
describe('A1 分叉值断言（c1002-19，设计稿 §4 A1 逐字；回归哨兵形态实测绿）', () => {
  it('v8 档带分叉值走链 → migrations[8] 注入赢（999 被覆盖为 null）；同 blob 标当版 → 兜底保留 999', () => {
    // ⚠ 两面必须各自独立克隆：migrations[N] 是**原地改写** blob 的（本文件 realBlobAt 注与
    // c922-122 教训同源）——若两行共享 state，第一行走链后 999 已被原地改成 null，第二行必假红。
    // 设计稿的 `{ ...blob, schemaVersion: 9 }` 浅拷贝写法正踩此坑，本落地改为独立 realBlobAt 两台。
    const chained = realBlobAt(8) as unknown as { schemaVersion: number; state: Record<string, unknown> };
    delete chained.state.wrathUltimatumEndDay;   // 先钉「键不存在」（夹具来自 serialize，键本在）
    chained.state.wrathUltimatumEndDay = 999;    // ← 造一个 v8 期不可能有、但链会遇到的值
    // 走链面：migrations[8] 注入赢 ⇒ null
    expect(deserialize(chained).wrathUltimatumEndDay).toBeNull();
    // 不跑链面：当版零迁移 ⇒ 兜底（finite → floor）保留 999
    const asCurrent = realBlobAt(9) as unknown as { schemaVersion: number; state: Record<string, unknown> };
    asCurrent.state.wrathUltimatumEndDay = 999;
    expect(deserialize(asCurrent).wrathUltimatumEndDay).toBe(999);
    // 断线即红自证：删 migrations[8] 注入行 ⇒ 走链面读到 999 ⇒ 本例红（对比 c923-22 旧断言族删行 0 红）
  });
});
