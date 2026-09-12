// 存档守护第二包：worldMap 深校验与 buildings 数组逐字段对抗（B21 遗留补强）。
// 不改产品代码；以现行行为为准钉住，可疑处留 TODO 供日间。
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
    expect(() => deserialize(validV9({ worldMap: 'map' }))).toThrow(/malformed/);
  });

  it('width 为 0/负数/非整数被拒', () => {
    const mk = (width: unknown) => {
      const v = validV9();
      ((v.state as { worldMap: Record<string, unknown> }).worldMap as Record<string, unknown>)['width'] = width;
      return v;
    };
    for (const width of [0, -3, 2.5, '4']) {
      expect(() => deserialize(mk(width))).toThrow(SaveLoadError);
    }
  });

  it('seed 为 NaN/Infinity 被拒', () => {
    const mk = (seed: unknown) => {
      const v = validV9();
      ((v.state as { worldMap: Record<string, unknown> }).worldMap as Record<string, unknown>)['seed'] = seed;
      return v;
    };
    expect(() => deserialize(mk(NaN))).toThrow(SaveLoadError);
    expect(() => deserialize(mk(Infinity))).toThrow(SaveLoadError);
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

  it('worldMap 缺失时按 rngSeed 确定性重建（不抛错）', () => {
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

  it('TODO: constructionProgress 未 clamp 到 [0,1]——现状接受任意有限数（如 42）', () => {
    // 现行校验只要求 finite，不约束进度语义范围；超界值会流入生产 tick。
    // TODO(日间)：constructionProgress 加 [0,1] 或 [0,100] 语义校验。
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
    expect(highState.buildings[0].constructionProgress).toBe(100);
    const low = validV9({ buildings: [validBuilding({ constructionProgress: -5 })] });
    const lowState = deserialize(low);
    expect(lowState.buildings[0].constructionProgress).toBe(0);
  });

  it('resources 非有限数值记录 → SaveLoadError', () => {
    const bad = validV9({ resources: { wood: 'ten' } });
    expect(() => deserialize(bad)).toThrow(SaveLoadError);
    const bad2 = validV9({ resources: { wood: Number.NaN } });
    expect(() => deserialize(bad2)).toThrow(SaveLoadError);
  });
});
