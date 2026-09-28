// c927-48 —— 旧档「谎标 schemaVersion」的迁移擦除行为：**现状钉桩**（e29e E5 延伸，只加测试、产品码零改动）。
//
// 🔴 本文件钉的是「**现在盘上是什么样**」，不是「**应该是什么样**」。
//   组 A 的擦除读数＝缺陷现状，不是理想行为；是否应拒收谎标档已写成裁决材料附页
//   `docs/insights/c927-48-lied-version-adjudication.md`，交人工裁。裁定改判时**本文件应当场变红**——
//   那是设计内的判别力，不要来"顺手把期望值改成新的"。
//
// 锚点复核（横幅口径「以磁盘现值为准」）：
// - 上游件 `zcode-bridge/done/20260925-154159-e29e.result.md`（原引 outbox/ 路径，件已搬家，两处都查过）
//   E5「真档谎标 v1 会擦掉 4 个字段」、E6「对真·缺字段老档迁移层净贡献 0」、遗留问题 2「交主班裁」。
// - 锚点 E5 表写 relicSites「1 条（序列化 305 B）」⇒ **磁盘实况是 3 条**（ids r0/r1/r2，紧凑序列化 305 B 与锚点相符）。
//   条数是锚点笔误，字节数相符；本文件以磁盘实取为准，差异已在附页 §四留痕。
//
// 只用到的产品码入口：`deserialize` / `SAVE_SCHEMA_VERSION`（`../saveLoad`），夹具 JSON 一份。
// 与在册件的分工（不复计账）：
// - `saveMatrix.test.ts` 钉「各档连通、断链即红」，不读擦除后的字段值；
// - `migrationGapMessage.test.ts:66` 钉 future-version 消息**文本**，本文件只把 `label = 当版+1 即拒`
//   当**不对称护栏**的对照组用一次，不重钉文本；
// - `replaySnapshotContent.test.ts:402` 钉「当版缺载荷键即拒」，本文件钉的是它的**旁路**（组 D）。
import { describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, deserialize } from '../saveLoad';
import fixture from './__fixtures__/save-v9.json';

type BlobShape = { schemaVersion: number; savedAt: number; state: Record<string, unknown> };

/**
 * E5 里"谎标会造成净损失"的那 4 枚字段：populationClasses / grainNegativeDays /
 * lastWarinessReason / relicSites（15 枚注入键中只有这 4 枚的夹具现值 ≠ 注入默认值）。
 * 计数口径用 snapshot() 的键名，其中 relicSites 以 relicSiteIds 代表（见 snapshot 注释）。
 */
const SNAPSHOT_KEYS = ['populationClasses', 'grainNegativeDays', 'lastWarinessReason', 'relicSiteIds'] as const;

/** 夹具真值＝诚实当版档（label 9） deserialize 后应看到的值，本文件的"无损基线"。 */
const HONEST = {
  populationClasses: { farmer: 42, worker: 4, soldier: 0, scholar: 0 },
  grainNegativeDays: 13,
  lastWarinessReason: '国格晋阶',
  relicSiteIds: ['r0', 'r1', 'r2'],
} as const;

/** migrations[1] 的注入值：createDefaultPopulation(resources.people)，夹具 people=46（populationClass.ts:16）。 */
const WIPED_POPULATION = { farmer: 46, worker: 0, soldier: 0, scholar: 0 } as const;

function realBlobAt(version: number): BlobShape {
  // structuredClone 必需——migrations[N] **原地改写** blob（saveLoad.ts:126-195 全程 `s['x'] = …`），
  // 不克隆会污染 JSON 模块单例、把擦除串给同文件后续用例（组 E 就是这条纪律的哨兵）。
  const blob = structuredClone(fixture) as unknown as BlobShape;
  blob.schemaVersion = version;
  return blob;
}

/** 逐字段快照：relicSites 取 id 序列（deserialize:508-522 会重建对象，逐字段比会掺进归一化噪音）。 */
function snapshot(g: {
  populationClasses: unknown;
  grainNegativeDays: unknown;
  lastWarinessReason: unknown;
  relicSites: unknown;
}): Record<(typeof SNAPSHOT_KEYS)[number], unknown> {
  return {
    populationClasses: g.populationClasses,
    grainNegativeDays: g.grainNegativeDays,
    lastWarinessReason: g.lastWarinessReason,
    relicSiteIds: (g.relicSites as Array<{ id: string }>).map((r) => r.id),
  };
}

/**
 * 现状推导（不是愿望）：label = L 跑 migrations[L..8]，每步**无条件**覆写自己那几枚键。
 * 注入键落在哪一步（saveLoad.ts:126-195）：
 *   migrations[1] → populationClasses / conversionQueue / grainNegativeDays
 *   migrations[4] → worldWariness / lastWarinessReason
 *   migrations[6] → relicSites
 * ⇒ 只有 L ≤ 1 / L ≤ 4 / L ≤ 6 的字段会被夹具真值压过，故净损失数＝4(L=1)／2(2≤L≤4)／1(5≤L≤6)／0(7≤L≤8)。
 */
function expectedSnapshot(label: number) {
  return {
    populationClasses: label <= 1 ? WIPED_POPULATION : HONEST.populationClasses,
    grainNegativeDays: label <= 1 ? 0 : HONEST.grainNegativeDays,
    lastWarinessReason: label <= 4 ? null : HONEST.lastWarinessReason,
    relicSiteIds: label <= 6 ? [] : [...HONEST.relicSiteIds],
  };
}

const EXPECTED_NET_LOSS_COUNT: Record<number, number> = { 1: 4, 2: 2, 3: 2, 4: 2, 5: 1, 6: 1, 7: 0, 8: 0 };

function netLossCount(label: number): number {
  const before = snapshot(deserialize(realBlobAt(SAVE_SCHEMA_VERSION)));
  const after = snapshot(deserialize(realBlobAt(label)));
  return SNAPSHOT_KEYS.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).length;
}

describe('c927-48 组 0 · 诚实当版档基线（零迁移分支，四字段无损）', () => {
  it('label = SAVE_SCHEMA_VERSION 时 deserialize 不跑迁移，四字段等于夹具真值', () => {
    const g = deserialize(realBlobAt(SAVE_SCHEMA_VERSION));
    expect(snapshot(g)).toEqual({
      populationClasses: { farmer: 42, worker: 4, soldier: 0, scholar: 0 },
      grainNegativeDays: 13,
      lastWarinessReason: '国格晋阶',
      relicSiteIds: ['r0', 'r1', 'r2'],
    });
  });

  it('对照组：label = 当版+1 直接拒载（不对称护栏的另一侧；文本已在 migrationGapMessage.test.ts:66 钉过）', () => {
    expect(() => deserialize(realBlobAt(SAVE_SCHEMA_VERSION + 1))).toThrow(/future schema version/);
  });
});

describe('c927-48 组 A · 谎标低于实际：真 v9 档标 v1..v8 → 迁移链擦除逐字段快照（e29e E5 复现）', () => {
  for (let label = 1; label < SAVE_SCHEMA_VERSION; label++) {
    it(`label v${label} → 四字段快照钉死（净损失 ${EXPECTED_NET_LOSS_COUNT[label]} 枚）`, () => {
      const blob = realBlobAt(label);
      const g = deserialize(blob);
      expect(snapshot(g)).toEqual(expectedSnapshot(label));
    });

    it(`label v${label} → 净损失字段数钉死（E5 分组 4/2/1/0 的现状）`, () => {
      expect(netLossCount(label)).toBe(EXPECTED_NET_LOSS_COUNT[label]);
    });
  }

  it('擦除发生在**入参对象**上（原地改写），不是返回值的加工产物', () => {
    const blob = realBlobAt(1);
    const stateRef = blob.state;
    deserialize(blob);
    // 原地改写：① 版本号被推到当版；② 真值已从** caller 手里那份对象**上消失
    expect(blob.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(blob.state).toBe(stateRef);
    expect(blob.state['relicSites']).toEqual([]);
    expect(blob.state['grainNegativeDays']).toBe(0);
    expect(blob.state['lastWarinessReason']).toBeNull();
    expect(blob.state['populationClasses']).toEqual(WIPED_POPULATION);
  });

  it('擦除不可由返回值恢复：迁完再 serialize 回来，夹具真值不会再出现', () => {
    const blob = realBlobAt(1);
    const g = deserialize(blob);
    const written = JSON.stringify(g);
    expect(written).not.toContain('国格晋阶');
    expect(written).not.toContain('"r0"');
  });
});

describe('c927-48 组 B · 15 枚注入键全部无条件覆盖（"无 if (!(k in s)) 护栏"的现状）', () => {
  /** migrations[1..8] 实际写下的 state 键全集（saveLoad.ts:126-195 逐行实数＝15）。 */
  const INJECTED_KEYS = [
    'populationClasses', 'conversionQueue', 'grainNegativeDays',
    'factionState', 'megaProjects', 'exclusivePolicies',
    'publicWrath', 'lastWrathDemandDay',
    'worldWariness', 'lastWarinessReason',
    'lastPropagandaDay',
    'relicSites',
    'endgameAscendDay', 'endgameLastWaveDay',
    'wrathUltimatumEndDay',
  ] as const;

  /** 每枚键喂一个"与默认值必然不同"的可辨识值；若迁移层肯尊重原值，它就该活下来。 */
  const CANARY: Record<(typeof INJECTED_KEYS)[number], unknown> = {
    populationClasses: { farmer: 1, worker: 2, soldier: 3, scholar: 4 },
    conversionQueue: [{ from: 'farmer', to: 'worker', count: 1, daysRemaining: 1 }],
    grainNegativeDays: 99,
    factionState: {
      active: true, lastEventDay: 5, nextEventDay: 6, activeDemand: null,
      acceptedDemands: ['canary'], rejectedDemands: [],
    },
    megaProjects: [{ id: 'canary' }],
    exclusivePolicies: ['canary-policy'],
    publicWrath: 77,
    lastWrathDemandDay: 88,
    worldWariness: 999,
    lastWarinessReason: 'CANARY-REASON',
    lastPropagandaDay: 66,
    relicSites: [{ id: 'canary', chainId: 'canary', name: 'canary', position: { x: 0, y: 0 }, stage: 0, done: false }],
    endgameAscendDay: 55,
    endgameLastWaveDay: 44,
    wrathUltimatumEndDay: 33,
  };

  it('注入键清单本身＝15 枚（bump SAVE_SCHEMA_VERSION 加第 16 枚时本用例即红，逼人来对表）', () => {
    expect(INJECTED_KEYS).toHaveLength(15);
  });

  it.each(INJECTED_KEYS)('canary 键 %s 被无条件压掉：与"不带 canary 的同档"结果逐字节相同', (key) => {
    const withCanary = realBlobAt(1);
    withCanary.state[key] = CANARY[key];
    const plain = realBlobAt(1);
    deserialize(withCanary);
    deserialize(plain);
    expect(withCanary.state[key]).toEqual(plain.state[key]);
    expect(JSON.stringify(withCanary.state[key])).not.toContain('CANARY');
  });

  it('canary 档 deserialize 后返回值里 canary 也不存在（覆盖发生在读之前）', () => {
    const blob = realBlobAt(1);
    for (const key of INJECTED_KEYS) blob.state[key] = CANARY[key];
    const json = JSON.stringify(deserialize(blob));
    expect(json).not.toContain('CANARY');
    expect(json).not.toContain('canary');
  });
});

describe('c927-48 组 C · 谎标高于实际：真·稀疏老档标当版 → 迁移链零执行，四字段走 deserialize 兜底', () => {
  /** 稀疏老档形制与 saveMatrix.test.ts:23-36 的 blobAt 同源（7 键），另补 eventHistory 以过 r5 B2 闸。 */
  function sparseLiedHigh(): BlobShape {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: 0,
      state: {
        rngSeed: 7,
        eventHistory: [],
        speed: 1,
        resources: { grain: 123, people: 9 },
        buildings: [],
        policies: [],
        activeModifiers: [],
        activeDecrees: [],
      },
    };
  }

  it('缺 eventHistory 的稀疏档标当版 ⇒ 当场拒载（r5 B2 载荷键闸，saveLoad.ts:410-418）', () => {
    const blob = sparseLiedHigh();
    delete blob.state['eventHistory'];
    expect(() => deserialize(blob)).toThrow(/Save missing load-bearing field\(s\): eventHistory/);
  });

  it('补齐载荷键后：四字段＝兜底默认值，不是夹具真值（谎标高档＝"跳过迁移"而非"擦字段"）', () => {
    const g = deserialize(sparseLiedHigh());
    expect(snapshot(g)).toEqual({
      populationClasses: { farmer: 9, worker: 0, soldier: 0, scholar: 0 }, // :600-602 createDefaultPopulation(people=9)
      grainNegativeDays: 0,                                                 // :556 finiteNum(?, 0)
      lastWarinessReason: null,                                             // :504 非 string → null
      relicSiteIds: [],                                                     // :522 非 Array → []
    });
  });

  it('同一份稀疏档：标当版（零迁移）vs 标 v1（走全链）四字段**逐字段相同** ⇒ 迁移层对真·缺字段老档净贡献 0（E6 侧）', () => {
    const high = snapshot(deserialize(sparseLiedHigh()));
    const asV1 = sparseLiedHigh();
    asV1.schemaVersion = 1;
    expect(snapshot(deserialize(asV1))).toEqual(high);
  });
});

describe('c927-48 组 D · 谎标**低**档可绕过 r5 B2 载荷键闸（现状＝静默回填，2026-09-27 裁决想防的正是这个）', () => {
  function stripLoadBearing(label: number): BlobShape {
    const blob = realBlobAt(label);
    delete blob.state['rngSeed'];
    delete blob.state['eventHistory'];
    return blob;
  }

  it('label = 当版：缺 rngSeed + eventHistory → 拒载（闸在世）', () => {
    expect(() => deserialize(stripLoadBearing(SAVE_SCHEMA_VERSION)))
      .toThrow(/Save missing load-bearing field\(s\): rngSeed, eventHistory/);
  });

  it('label = 1：同一份缺键档**不抛**，rngSeed 静默回填 12345、eventHistory 静默成 [] ⇒ 回放静默换轨', () => {
    const g = deserialize(stripLoadBearing(1)) as unknown as { rngSeed: number; eventHistory: unknown[] };
    expect(g.rngSeed).toBe(12345);          // saveLoad.ts:427 兜底常量（判据只看"是不是 finite number"）
    expect(g.eventHistory).toEqual([]);      // saveLoad.ts:467 `s.eventHistory ?? []`（非数组不校验，直接吞）
    // 而且闸的判据用的是**标称版本**，不是迁移后的版本：
    // :410 `if (schemaVersion === SAVE_SCHEMA_VERSION)` 里的 schemaVersion 取自入参 label。
    // 故"谎标低版本"是这道闸的一条完整旁路——本用例就是它的现状快照。
  });
});

describe('c927-48 组 E · 夹具单例零污染（结构化克隆纪律哨兵）', () => {
  it('跑完全部擦除用例后，import 进来的 fixture 仍是 v9 真值原样', () => {
    const s = (fixture as unknown as BlobShape);
    expect(s.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(s.state['populationClasses']).toEqual({ farmer: 42, worker: 4, soldier: 0, scholar: 0 });
    expect(s.state['grainNegativeDays']).toBe(13);
    expect(s.state['lastWarinessReason']).toBe('国格晋阶');
    expect(s.state['relicSites'] as unknown[]).toHaveLength(3);
  });
});
