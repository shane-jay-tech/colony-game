// 存档守护第二包：worldMap 深校验与 buildings 数组逐字段对抗（B21 遗留补强）。
// 不改产品代码；以现行行为为准钉住，可疑处留 TODO 供日间。
// c1002-13（c923-30 遗留）：worldMap 族七支点名升 A——worldMap 字符串/width/seed 三支由泛化
// toThrow(SaveLoadError) 收紧为消息含子字段名（tiles.length/terrain/buildable 两支原已点名，
// 再生一致性支非对抗面）；消息现值 2026-10-04 探针实测（读数见 c1002-13 result）。例数不变。
import { describe, expect, it } from 'vitest';
import { SaveLoadError, deserialize } from '../saveLoad';

// 最小合法 v9 档（含可过校验的最小 worldMap 与一条合法 building）
function validV9(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 9,
    state: {
      rngSeed: 7,
      speed: 2,
      resources: { wood: 10 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
      // r5 B2：eventHistory 是载荷字段（缺它＝拒载）⇒ 最小合法档必须带上
      eventHistory: [],
      worldMap: {
        width: 2,
        height: 2,
        seed: 1,
        tiles: [
          { terrain: 'plain', buildable: true, walkable: true },
          { terrain: 'plain', buildable: true, walkable: true },
          { terrain: 'river', buildable: false, walkable: true },
          { terrain: 'plain', buildable: true, walkable: true },
        ],
        resourceNodes: [],
      },
      ...overrides,
    },
  };
}

function validBuilding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    defId: 'farm',
    position: { x: 0, y: 0 },
    status: 'idle',
    tier: 1,
    constructionProgress: 0,
    modifiers: [],
    ...overrides,
  };
}

// ---------- worldMap 深校验 ----------

describe('worldMap 深校验对抗', () => {
  it('worldMap 为字符串被拒', () => {
    // c1002-13 升 A：消息点名 worldMap 子字段
    expect(() => deserialize(validV9({ worldMap: 'map' }))).toThrow(/worldMap is malformed/);
  });

  it('width 为 0/负数/非整数被拒', () => {
    const mk = (width: unknown) => {
      const v = validV9();
      ((v.state as { worldMap: Record<string, unknown> }).worldMap as Record<string, unknown>)['width'] = width;
      return v;
    };
    for (const width of [0, -3, 2.5, '4']) {
      // c1002-13 升 A：泛化 SaveLoadError → 消息点名 worldMap.width
      expect(() => deserialize(mk(width))).toThrow(/worldMap\.width must be a positive integer/);
    }
  });

  it('seed 为 NaN/Infinity 被拒', () => {
    const mk = (seed: unknown) => {
      const v = validV9();
      ((v.state as { worldMap: Record<string, unknown> }).worldMap as Record<string, unknown>)['seed'] = seed;
      return v;
    };
    // c1002-13 升 A：泛化 SaveLoadError → 消息点名 worldMap.seed
    expect(() => deserialize(mk(NaN))).toThrow(/worldMap\.seed must be a finite number/);
    expect(() => deserialize(mk(Infinity))).toThrow(/worldMap\.seed must be a finite number/);
  });

  it('tiles 数量与 width*height 不符被拒', () => {
    const v = validV9();
    const wm = (v.state as { worldMap: Record<string, unknown> }).worldMap;
    (wm as { tiles: unknown[] }).tiles = [{ terrain: 'plain', buildable: true, walkable: true }];
    expect(() => deserialize(v)).toThrow(/does not match width\*height/);
  });

  it('单个瓦片 terrain 非法被拒（含下标定位）', () => {
    const v = validV9();
    const tiles = (v.state as { worldMap: { tiles: unknown[] } }).worldMap.tiles;
    tiles[2] = { terrain: 'lava', buildable: true, walkable: true };
    expect(() => deserialize(v)).toThrow(/tiles\[2\]\.terrain is not a valid terrain/);
  });

  it('瓦片 buildable/walkable 非布尔被拒', () => {
    const v = validV9();
    const tiles = (v.state as { worldMap: { tiles: unknown[] } }).worldMap.tiles;
    tiles[0] = { terrain: 'plain', buildable: 'yes', walkable: true };
    expect(() => deserialize(v)).toThrow(/buildable must be boolean/);
  });

  it('worldMap 在场时两次解析逐字符一致（再生路径由 saveLoad.test.ts:149 legacy save without worldMap regenerates from rngSeed 守）', () => {
    const a = deserialize(validV9());
    const b = deserialize(validV9());
    expect(JSON.stringify(a.worldMap)).toBe(JSON.stringify(b.worldMap));
  });
});

// ---------- buildings 数组逐字段对抗 ----------

describe('buildings 数组逐字段对抗', () => {
  it('buildings 非数组被拒', () => {
    expect(() => deserialize(validV9({ buildings: 'all' }))).toThrow(/must be an array/);
  });

  it('元素非对象被拒且带下标', () => {
    expect(() => deserialize(validV9({ buildings: [42] }))).toThrow(/buildings\[0\] is not an object/);
  });

  it('defId 空/非字符串被拒', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ defId: '' })] }))).toThrow(/defId/);
    expect(() => deserialize(validV9({ buildings: [validBuilding({ defId: 7 })] }))).toThrow(/defId/);
  });

  it('position 缺失或坐标非整数被拒', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ position: null })] }))).toThrow(/position/);
    expect(() => deserialize(validV9({ buildings: [validBuilding({ position: { x: 0.5, y: 0 } })] }))).toThrow(/integers/);
  });

  it('status 越出枚举被拒', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ status: 'exploded' })] })))
      .toThrow(/status invalid/);
  });

  it('tier 越出 1-4 枚举被拒（clamp 语义不适用于 tier）', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ tier: 9 })] }))).toThrow(/tier invalid/);
    expect(() => deserialize(validV9({ buildings: [validBuilding({ tier: '1' })] }))).toThrow(/tier invalid/);
  });

  it('constructionProgress 为 NaN/Infinity 被拒', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ constructionProgress: NaN })] })))
      .toThrow(/finite number/);
    expect(() => deserialize(validV9({ buildings: [validBuilding({ constructionProgress: Infinity })] })))
      .toThrow(/finite number/);
  });

  it('modifiers 含非字符串元素被拒', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ modifiers: ['ok', 3] })] })))
      .toThrow(/modifiers must be array of string/);
  });

  it('upgradingTo 空字符串被拒、非空字符串放行（可选字段两态）', () => {
    expect(() => deserialize(validV9({ buildings: [validBuilding({ upgradingTo: '' })] })))
      .toThrow(/upgradingTo must be a non-empty string/);
    const gs = deserialize(validV9({ buildings: [validBuilding({ upgradingTo: 'market' })] }));
    const b = gs.buildings[0] as { upgradingTo?: string };
    expect(b.upgradingTo).toBe('market');
  });

  it('constructionProgress 界内值（42）原样带出——[0,100] clamp 对界内值无操作（c919-04 翻桩去 TODO；越界钳制见 p911r-40 组）', () => {
    // clamp 已由 p911r-40 落地（saveLoad validateBuildingsArray Math.min/max）；本例守住界内不误伤。
    const gs = deserialize(validV9({ buildings: [validBuilding({ constructionProgress: 42 })] }));
    const b = gs.buildings[0] as { constructionProgress: number };
    expect(b.constructionProgress).toBe(42);
  });
});

// p911r-40：constructionProgress 钳制 + resources shape 校验
describe('saveGuard2 additions (p911r-40)', () => {
  it('constructionProgress 越界钳制到 [0,100]', () => {
    const high = validV9({ buildings: [validBuilding({ constructionProgress: 150 })] });
    const highState = deserialize(high);
    const highBuilding = highState.buildings[0] as { constructionProgress: number };
    expect(highBuilding.constructionProgress).toBe(100);
    const low = validV9({ buildings: [validBuilding({ constructionProgress: -5 })] });
    const lowState = deserialize(low);
    const lowBuilding = lowState.buildings[0] as { constructionProgress: number };
    expect(lowBuilding.constructionProgress).toBe(0);
  });

  it('resources 非有限数值记录 → SaveLoadError', () => {
    const bad = validV9({ resources: { wood: 'ten' } });
    expect(() => deserialize(bad)).toThrow(SaveLoadError);
    const bad2 = validV9({ resources: { wood: Number.NaN } });
    expect(() => deserialize(bad2)).toThrow(SaveLoadError);
  });
});

// c922-20：constructionProgress 语义校验的坏夹具族。按 c918-11 材料
// （docs/insights/colony-saveguard-bounds-20260918.md：语义天然 [0,100] 百分比、越界走 clamp 不 throw 以保旧档兼容）
// 补盲。生产校验本体在 saveLoad.ts validateBuildingsArray（e56d82a p911r-40 落地、1bdfcfc c919-04 翻掉本文件旧 TODO），
// 本块零生产码改动，只钉五面：类型面拒载 / 浮点过冲吸收 / 上界口径 / clamp 不改 status / 下标定位。
describe('constructionProgress 语义校验坏夹具族（c922-20）', () => {
  it('类型面坏夹具：字符串/布尔/null/数组一律拒载（finite number 谓词不吃隐式转换）', () => {
    for (const bad of ['50', true, null, [50]] as unknown[]) {
      expect(() => deserialize(validV9({ buildings: [validBuilding({ constructionProgress: bad })] })))
        .toThrow(/constructionProgress must be finite number/);
    }
  });

  it('字段缺失拒载（可选字段 upgradingTo 可缺，constructionProgress 不可缺）', () => {
    const missing = validBuilding();
    delete missing.constructionProgress;
    expect(() => deserialize(validV9({ buildings: [missing] })))
      .toThrow(/constructionProgress must be finite number/);
    // 同夹具只补回合法值即放行——证上一条红在字段本身，不在夹具其余部分
    expect(() => deserialize(validV9({ buildings: [validBuilding()] }))).not.toThrow();
  });

  it('浮点过冲 100.4 / -0.4 被 clamp 吸收（材料点名的旧档场景：严格 throw 会误拒旧档）', () => {
    const over = deserialize(validV9({ buildings: [validBuilding({ constructionProgress: 100.4 })] }));
    expect((over.buildings[0] as { constructionProgress: number }).constructionProgress).toBe(100);
    const under = deserialize(validV9({ buildings: [validBuilding({ constructionProgress: -0.4 })] }));
    expect((under.buildings[0] as { constructionProgress: number }).constructionProgress).toBe(0);
  });

  it('极端有限值收敛且不产生 NaN（1e308 → 100；-MAX_SAFE_INTEGER → 0）', () => {
    const huge = deserialize(validV9({ buildings: [validBuilding({ constructionProgress: 1e308 })] }));
    const hp = (huge.buildings[0] as { constructionProgress: number }).constructionProgress;
    expect(hp).toBe(100);
    expect(Number.isFinite(hp)).toBe(true);
    const tiny = deserialize(
      validV9({ buildings: [validBuilding({ constructionProgress: -Number.MAX_SAFE_INTEGER })] }),
    );
    expect((tiny.buildings[0] as { constructionProgress: number }).constructionProgress).toBe(0);
  });

  it('上界口径钉桩：界内值原样带出，证上界是 100 百分比而非 1 归一化', () => {
    for (const v of [0, 55.5, 99.999, 100]) {
      const gs = deserialize(validV9({ buildings: [validBuilding({ constructionProgress: v })] }));
      expect((gs.buildings[0] as { constructionProgress: number }).constructionProgress).toBe(v);
    }
  });

  it('clamp 只改数值不改 status（constructing + 150 载入后仍 constructing、进度归 100）', () => {
    const gs = deserialize(
      validV9({ buildings: [validBuilding({ status: 'constructing', constructionProgress: 150 })] }),
    );
    const b = gs.buildings[0] as { status: string; constructionProgress: number };
    expect(b.status).toBe('constructing');
    expect(b.constructionProgress).toBe(100);
    // 现状而非认可：下一 tick 由 gameStore.runConstructionPhase 的 >=99.999 闸门把它转成 working（gameStore.ts:1039-1043）。
  });

  it('拒载消息带数组下标（第二条坏值点名 buildings[1]）', () => {
    const doc = validV9({ buildings: [validBuilding(), validBuilding({ constructionProgress: 'x' })] });
    expect(() => deserialize(doc)).toThrow(/buildings\[1\]\.constructionProgress/);
  });
});
