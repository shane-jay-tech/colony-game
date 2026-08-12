import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { ModifierInstance, BuildingDef, BuildingInstance, PolicyNode } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';
import { ModifierValidationError } from '../../data/modifierValidator';
import * as buildingRegistry from '../../data/buildingRegistry';

// All-plain map so terrain checks always pass; overrides the default seed-12345 map
// (which contains a river + mountains that would block fixed-coordinate placement tests).
function allPlainMap(width = 100, height = 100): WorldMap {
  const tiles = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  }
  return { width, height, tiles, resourceNodes: [], seed: 0 };
}

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function makeStore(overrides?: ConstructorParameters<typeof GameStore>[1]) {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, overrides);
  return { store, ee: new EventEmitter() as unknown as IEventEmitter & EventEmitter, rawEe: ee };
}

function makeValidModifier(id = 'mod1'): ModifierInstance {
  return {
    id, name: id, category: 'economy', stackable: true,
    effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
    visualBadge: null, remainingDays: -1, description: '', descPlain: '',
  };
}

function makeInvalidModifier(): ModifierInstance {
  return {
    id: 'bad', name: 'bad', category: 'economy', stackable: true,
    effects: [{ target: 'not_valid_target' as never, op: 'add', value: 5 }],
    visualBadge: null, remainingDays: -1, description: '', descPlain: '',
  };
}

function makeDef(overrides: Partial<BuildingDef> = {}): BuildingDef {
  return {
    id: 'bld_farm', name: 'Farm', category: '民生', tier: 1, cost: {}, constructionTime: 5,
    output: [], upkeep: {}, size: { width: 1, height: 1 },
    assetKey: 'bld_farm', upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
    ...overrides,
  };
}

const BIG_BOUNDS = { width: 100, height: 100 };

// Helper for placement tests: GameStore with all-plain map (so terrain doesn't block fixed placements).
function newStorePlain(overrides: ConstructorParameters<typeof GameStore>[1] = {}): GameStore {
  return new GameStore(makeEmitter(), { worldMap: allPlainMap(), ...overrides });
}

describe('GameStore.addResource', () => {
  it('negative amount clamps to 0', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addResource('grain', -100);
    expect(store.getState().resources.grain ?? 0).toBe(0);
  });

  it('amount over 9999 clamps to 9999', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addResource('grain', 10000);
    expect(store.getState().resources.grain).toBe(9999);
  });

  it('fractional amount is floored (5.9 -> 5)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addResource('grain', 5.9);
    expect(store.getState().resources.grain).toBe(5);
  });
});

describe('GameStore.getResourceCap (BUG-B 仓廪上限接线)', () => {
  function granaryInst(): BuildingInstance {
    return { defId: 'bld_granary', position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] };
  }
  it('无仓廪 → 上限 9999', () => {
    const store = new GameStore(makeEmitter());
    expect(store.getResourceCap('grain')).toBe(9999);
  });
  it('一座 working 仓廪 → 存储类资源上限 ×1.5', () => {
    const store = new GameStore(makeEmitter(), { buildings: [granaryInst()] });
    expect(store.getResourceCap('grain')).toBe(Math.round(9999 * 1.5));
  });
  it('多座仓廪线性叠加但封顶 ×3', () => {
    const many = [granaryInst(), granaryInst(), granaryInst(), granaryInst(), granaryInst()]; // 5 座
    const store = new GameStore(makeEmitter(), { buildings: many });
    expect(store.getResourceCap('grain')).toBe(Math.round(9999 * 3)); // min(3, 1+5×0.5)=3
  });
  it('people 不受仓廪影响（其约束是住房上限）', () => {
    const store = new GameStore(makeEmitter(), { buildings: [granaryInst()] });
    expect(store.getResourceCap('people')).toBe(9999);
  });
  it('在建/废弃仓廪不计入', () => {
    const constructing: BuildingInstance = { ...granaryInst(), status: 'constructing' };
    const store = new GameStore(makeEmitter(), { buildings: [constructing] });
    expect(store.getResourceCap('grain')).toBe(9999);
  });
});

describe('GameStore 人口每日真实吃粮 (BUG-B)', () => {
  it('一日 tick 后粮食被人口消耗（无产粮建筑时严格减少）', () => {
    // 10 农民吃 10 粮/天；无任何建筑 → 无产出，grain 必减少
    const store = new GameStore(makeEmitter(), { resources: { people: 10, grain: 100 } });
    const before = store.getState().resources.grain ?? 0;
    store.tickDay();
    const after = store.getState().resources.grain ?? 0;
    expect(after).toBeLessThan(before); // 消耗真实发生（旧 bug：只比较不扣，after===before）
  });

  it('长跑不会把粮食堆到 9999 爆仓（无产粮时反而走向枯竭）', () => {
    const store = new GameStore(makeEmitter(), { resources: { people: 10, grain: 500 } });
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(store.getState().resources.grain ?? 0).toBeLessThan(500); // 持续净消耗，不爆仓
  });
});

describe('GameStore 阶层供养闭环 (P3：工要布/兵要铜/士要钱)', () => {
  function staffedStore(res: Record<string, number>) {
    return new GameStore(makeEmitter(), {
      resources: { people: 25, ...res },
      populationClasses: { farmer: 0, worker: 10, soldier: 10, scholar: 5 },
    });
  }
  it('一日 tick 后 布/铜/钱 被阶层供养真实扣减（之前算了不扣→囤积）', () => {
    const store = staffedStore({ grain: 9999, cloth: 100, bronze: 100, gold: 100 });
    store.tickDay();
    const r = store.getState().resources;
    expect(r.cloth ?? 0).toBeLessThan(100); // 工 10×0.2 布
    expect(r.bronze ?? 0).toBeLessThan(100); // 兵 10×0.3 铜
    expect(r.gold ?? 0).toBeLessThan(100); // 士 5×1 钱
  });
  it('布/铜/钱短缺非致命：不饿死减员，仅民心轻微下滑', () => {
    const store = staffedStore({ grain: 9999, cloth: 0, bronze: 0, gold: 0 });
    const popBefore = store.getState().resources.people ?? 0;
    const moraleBefore = store.getState().playerMorale;
    store.tickDay();
    // 粮足→无饥荒死亡；供养短缺不杀人（人口只会因增长上升，不下降）
    expect(store.getState().resources.people ?? 0).toBeGreaterThanOrEqual(popBefore);
    expect(store.getState().playerMorale).toBeLessThan(moraleBefore); // 短缺扣民心
  });
});

describe('GameStore 军事+将领 (P4：接成可玩)', () => {
  function barracks(): BuildingInstance {
    return { defId: 'bld_barracks', position: { x: 0, y: 0 }, status: 'working', tier: 2, constructionProgress: 100, modifiers: [] };
  }
  it('军力由兵阶层派生：有兵 > 无兵（兵不再是摆设）', () => {
    const noArmy = new GameStore(makeEmitter(), { grade: 1, buildings: [barracks()] });
    const withArmy = new GameStore(makeEmitter(), {
      grade: 1, buildings: [barracks()],
      resources: { people: 20 }, populationClasses: { farmer: 0, worker: 0, soldier: 20, scholar: 0 },
    });
    expect(withArmy.computeCurrentMilitaryPower()).toBeGreaterThan(noArmy.computeCurrentMilitaryPower());
  });

  it('招募将领：扣金、入编、hasAvailableGeneral 变真', () => {
    const store = new GameStore(makeEmitter(), { resources: { gold: 100 } });
    expect(store.hasAvailableGeneral()).toBe(false);
    const id = store.getRecruitableGenerals()[0]!.id;
    expect(store.recruitGeneral(id)).toBe(true);
    expect(store.getGenerals().some(g => g.id === id)).toBe(true);
    expect(store.hasAvailableGeneral()).toBe(true);
    expect(store.getState().resources.gold).toBe(60); // 100-40
  });

  it('出征：发兵进 activeExpeditions、扣粮；推进到期后结算清空、将领归队', () => {
    const store = new GameStore(makeEmitter(), {
      grade: 1, buildings: [barracks()],
      resources: { people: 20, grain: 500, gold: 100 },
      populationClasses: { farmer: 0, worker: 0, soldier: 20, scholar: 0 },
    });
    const npcId = store.getNpcCountries()[0]!.id; // 用真实初始 NPC
    const gid = store.getRecruitableGenerals()[0]!.id;
    store.recruitGeneral(gid);
    const r = store.launchExpedition({ target: 'raid', npcId, units: { militia: 8 }, generalId: gid, grainAllocated: 120 });
    expect(r.ok).toBe(true);
    expect(store.getActiveExpeditions().length).toBe(1);
    expect(store.getGenerals().find(g => g.id === gid)?.deployed).toBe(true);
    for (let i = 0; i < 8; i++) store.tickDay(); // raid 3-5 日，足够结算
    expect(store.getActiveExpeditions().length).toBe(0); // 已结算清空
    expect(store.getGenerals().find(g => g.id === gid)?.deployed).toBe(false); // 将领归队
  });

  it('出征前置：无兵或兵种未解锁 → 被拒', () => {
    const store = new GameStore(makeEmitter(), { grade: 0, resources: { grain: 500 } });
    const r = store.launchExpedition({ target: 'raid', npcId: 'x', units: { militia: 5 }, grainAllocated: 60 });
    expect(r.ok).toBe(false);
  });
});

describe('GameStore.addModifier', () => {
  it('invalid modifier effect throws ModifierValidationError', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    expect(() => store.addModifier(makeInvalidModifier())).toThrow(ModifierValidationError);
  });

  it('valid modifier is added', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    store.addModifier(makeValidModifier());
    expect(store.getState().activeModifiers).toHaveLength(1);
  });
});

describe('GameStore event unsubscription', () => {
  it('after off() listener is not called on next addResource', () => {
    const ee = new EventEmitter() as unknown as IEventEmitter & { on: EventEmitter['on']; off: EventEmitter['off'] };
    const store = new GameStore(ee);
    const cb = vi.fn();
    ee.on(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.addResource('grain', 5);
    expect(cb).toHaveBeenCalledTimes(1);
    ee.off(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.addResource('grain', 5);
    expect(cb).toHaveBeenCalledTimes(1); // unchanged
    expect(ee.listenerCount(STATE_EVENTS.RESOURCES_CHANGED)).toBe(0);
  });
});

describe('GameStore.placeBuilding (Slice B)', () => {
  it('places building with status=constructing and progress=0', () => {
    const store = newStorePlain();
    const result = store.placeBuilding(makeDef(), 3, 4, BIG_BOUNDS);
    expect(result).toEqual({ ok: true });
    const b = store.getState().buildings[0];
    expect(b?.status).toBe('constructing');
    expect(b?.constructionProgress).toBe(0);
    expect(b?.position).toEqual({ x: 3, y: 4 });
  });

  it('deducts cost from resources on placement', () => {
    const store = newStorePlain({ resources: { wood: 100, people: 10 } });
    const def = makeDef({ cost: { wood: 20, people: 5 } });
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: true });
    expect(store.getState().resources.wood).toBe(80);
    expect(store.getState().resources.people).toBe(10); // 占用制：民是劳力，不被造价消耗
  });

  it('rejects with insufficient_labor when idle labor < 占用 (占用制)', () => {
    const store = newStorePlain({ resources: { wood: 100, people: 3 } });
    const def = makeDef({ cost: { wood: 20, people: 5 } }); // 需占用 5 劳力，只有 3
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'insufficient_labor' });
    expect(store.getState().buildings).toHaveLength(0);
    expect(store.getState().resources.wood).toBe(100); // 失败不扣材料
  });

  it('民不被建造消耗，闲置劳力 = 总人口 − 占用 (占用制)', () => {
    const store = newStorePlain({ resources: { wood: 200, people: 10 } });
    const def = makeDef({ cost: { wood: 20, people: 4 } });
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(store.getState().resources.people).toBe(10); // 总人口不变（未被造价消耗）
    expect(store.getEmployedLabor()).toBeGreaterThan(0); // 建了占编制的建筑 → 占用>0
    expect(store.getIdleLabor()).toBe(10 - store.getEmployedLabor()); // 闲置 = 总 − 占用
  });

  it('读档迁移：people < 已占用劳力 → 补足到已占用(解旧档软锁,占用制)', () => {
    const store = newStorePlain({ resources: { wood: 200, people: 20 } });
    store.placeBuilding(makeDef({ cost: { wood: 20 } }), 0, 0, BIG_BOUNDS);
    const employed = store.getEmployedLabor();
    expect(employed).toBeGreaterThan(0);
    // 模拟旧档：people 被老 bug 吃到 0，建筑仍在
    const tampered = { ...store.getState(), resources: { ...store.getState().resources, people: 0 } };
    store.replaceState(tampered);
    expect(store.getState().resources.people).toBe(employed); // 补足，闲置劳力回到 0 而非负/卡死
    expect(store.getIdleLabor()).toBe(0);
  });

  it('removeBuilding：移除建筑 + 释放占用劳力 + 返还材料 (占用制收尾)', () => {
    const store = newStorePlain({ resources: { wood: 200, people: 10 } });
    const def = makeDef({ cost: { wood: 20, people: 5 } });
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    const inst = store.getState().buildings[0]!;
    expect(store.getEmployedLabor()).toBeGreaterThan(0);
    const woodAfterBuild = store.getState().resources.wood ?? 0;
    const ok = store.removeBuilding(inst);
    expect(ok).toBe(true);
    expect(store.getState().buildings).toHaveLength(0);
    expect(store.getEmployedLabor()).toBe(0); // 劳力释放
    expect(store.getState().resources.wood).toBeGreaterThanOrEqual(woodAfterBuild); // 返还部分材料(≥)
    expect(store.removeBuilding(inst)).toBe(false); // 已移除，再拆同一引用 → false
  });

  it('rejects with insufficient_resources when cost cannot be paid', () => {
    const store = newStorePlain({ resources: { wood: 5 } });
    const def = makeDef({ cost: { wood: 20 } });
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'insufficient_resources' });
    expect(store.getState().buildings).toHaveLength(0);
    expect(store.getState().resources.wood).toBe(5);
  });

  it('rejects with out_of_bounds and does not deduct cost', () => {
    const store = newStorePlain({ resources: { wood: 100 } });
    const def = makeDef({ cost: { wood: 20 }, size: { width: 2, height: 2 } });
    const result = store.placeBuilding(def, 9, 9, { width: 10, height: 10 });
    expect(result).toEqual({ ok: false, reason: 'out_of_bounds' });
    expect(store.getState().resources.wood).toBe(100);
  });

  it('rejects with overlap when placing on top of existing building', () => {
    const store = newStorePlain({ resources: { wood: 200 } });
    const def = makeDef({ cost: { wood: 20 }, size: { width: 2, height: 2 } });
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    const result = store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'overlap' });
    expect(store.getState().buildings).toHaveLength(1);
    expect(store.getState().resources.wood).toBe(180); // only first deducted
  });

  it('emits BUILDING_PLACED on success', () => {
    const store = newStorePlain();
    const cb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_PLACED, cb);
    store.placeBuilding(makeDef(), 0, 0, BIG_BOUNDS);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT emit BUILDING_PLACED on rejection', () => {
    const store = newStorePlain({ resources: { wood: 5 } });
    const def = makeDef({ cost: { wood: 20 } });
    const cb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_PLACED, cb);
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(cb).not.toHaveBeenCalled();
  });

  it('emits RESOURCES_CHANGED with negative deltas after deduction', () => {
    const store = newStorePlain({ resources: { wood: 100, people: 10 } });
    const def = makeDef({ cost: { wood: 20, people: 5 } });
    const cb = vi.fn();
    store.on(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.placeBuilding(def, 0, 0, BIG_BOUNDS);
    expect(cb).toHaveBeenCalledTimes(1);
    const payload = cb.mock.calls[0]?.[0] as { deltas: Record<string, number>; reason?: string };
    expect(payload.deltas).toEqual({ wood: -20 }); // 占用制：民不计入消耗 deltas
    expect(payload.reason).toBe('building_cost');
  });

  it('does NOT emit RESOURCES_CHANGED when cost is empty', () => {
    const store = newStorePlain();
    const cb = vi.fn();
    store.on(STATE_EVENTS.RESOURCES_CHANGED, cb);
    store.placeBuilding(makeDef({ cost: {} }), 0, 0, BIG_BOUNDS);
    expect(cb).not.toHaveBeenCalled();
  });

  it('rejects with unbuildable_terrain on river tile (Slice C)', () => {
    // Construct a worldMap with a river at (5,5)
    const tiles = [];
    for (let i = 0; i < 100 * 100; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
    tiles[5 * 100 + 5] = { terrain: 'river' as const, buildable: false, walkable: true };
    const store = new GameStore(makeEmitter(), {
      worldMap: { width: 100, height: 100, tiles, resourceNodes: [], seed: 0 },
    });
    const result = store.placeBuilding(makeDef(), 5, 5, BIG_BOUNDS);
    expect(result).toEqual({ ok: false, reason: 'unbuildable_terrain' });
  });
});

describe('GameStore construction progress (Slice B)', () => {
  it('tickDay advances constructing building by 100/constructionTime', () => {
    const store = newStorePlain();
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockReturnValue(
      makeDef({ id: 'bld_farm', constructionTime: 3 }),
    );
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    store.tickDay();
    const b = store.getState().buildings[0];
    expect(b?.constructionProgress).toBeCloseTo(100 / 3, 5);
    expect(b?.status).toBe('constructing');
    spy.mockRestore();
  });

  it('tickDay completes building when progress reaches 100, emits BUILDING_COMPLETED once', () => {
    const store = newStorePlain();
    const completedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_COMPLETED, completedCb);
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockReturnValue(
      makeDef({ id: 'bld_farm', constructionTime: 3 }),
    );
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    store.tickDay();
    store.tickDay();
    store.tickDay();
    const b = store.getState().buildings[0];
    expect(b?.status).toBe('working');
    expect(b?.constructionProgress).toBe(100);
    expect(completedCb).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('tickDay completes ct<=0 building instantly on first tick (degenerate static-content case)', () => {
    const store = newStorePlain();
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    // override registry to return ct=0 for this defId
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockReturnValue(
      makeDef({ id: 'bld_farm', constructionTime: 0 }),
    );
    const completedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_COMPLETED, completedCb);
    store.tickDay();
    expect(store.getState().buildings[0]?.status).toBe('working');
    expect(store.getState().buildings[0]?.constructionProgress).toBe(100);
    expect(completedCb).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('tickDay does not advance already-working buildings', () => {
    const store = newStorePlain();
    store.placeBuilding(makeDef({ constructionTime: 3 }), 0, 0, BIG_BOUNDS);
    store.tickDay();
    store.tickDay();
    store.tickDay(); // completes (registry says ct=3 for bld_farm)
    expect(store.getState().buildings[0]?.status).toBe('working');
    const completedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_COMPLETED, completedCb);
    store.tickDay();
    expect(completedCb).not.toHaveBeenCalled();
    expect(store.getState().buildings[0]?.constructionProgress).toBe(100);
  });
});

describe('GameStore.tickDay', () => {
  it('increments currentDay by 1 and emits DAY_TICK with new day', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const cb = vi.fn();
    store.on(STATE_EVENTS.DAY_TICK, cb);
    store.tickDay();
    expect(store.getCurrentDay()).toBe(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  it('decrements modifier remainingDays from N to N-1', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const m = makeValidModifier('m1');
    m.remainingDays = 3;
    store.addModifier(m);
    store.tickDay();
    expect(store.getActiveModifiers()[0]?.remainingDays).toBe(2);
  });

  it('removes modifier when remainingDays reaches 0 and emits MODIFIER_REMOVED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const m = makeValidModifier('m_short');
    m.remainingDays = 1;
    store.addModifier(m);
    const cb = vi.fn();
    store.on(STATE_EVENTS.MODIFIER_REMOVED, cb);
    store.tickDay();
    expect(store.getActiveModifiers()).toHaveLength(0);
    expect(cb).toHaveBeenCalledWith({ id: 'm_short' });
  });

  it('does not decrement permanent modifier (remainingDays = -1)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const m = makeValidModifier('perm');
    m.remainingDays = -1;
    store.addModifier(m);
    store.tickDay();
    store.tickDay();
    expect(store.getActiveModifiers()[0]?.remainingDays).toBe(-1);
  });

  it('crossing season boundary emits SEASON_TICK exactly once', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { currentDay: 29 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    store.tickDay(); // 29 -> 30 (season 0 -> 1)
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('crossing year boundary emits YEAR_TICK exactly once', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { currentDay: 119 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.YEAR_TICK, cb);
    store.tickDay(); // 119 -> 120 (year 0 -> 1)
    expect(cb).toHaveBeenCalledWith({ year: 1 });
  });

  it('within-season tick does not emit SEASON_TICK', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { currentDay: 5 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SEASON_TICK, cb);
    store.tickDay();
    expect(cb).not.toHaveBeenCalled();
  });
});

describe('GameStore.setSpeed / setPaused', () => {
  it('setSpeed emits SPEED_CHANGED on change', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { speed: 1 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SPEED_CHANGED, cb);
    store.setSpeed(2);
    expect(cb).toHaveBeenCalledWith(2);
  });

  it('setSpeed is a no-op when value unchanged', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { speed: 1 });
    const cb = vi.fn();
    store.on(STATE_EVENTS.SPEED_CHANGED, cb);
    store.setSpeed(1);
    expect(cb).not.toHaveBeenCalled();
  });

  it('setPaused emits PAUSED_CHANGED on change', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    const cb = vi.fn();
    store.on(STATE_EVENTS.PAUSED_CHANGED, cb);
    store.setPaused(true);
    expect(cb).toHaveBeenCalledWith(true);
    expect(store.isPaused()).toBe(true);
  });

  it('setPaused is a no-op when value unchanged', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: true });
    const cb = vi.fn();
    store.on(STATE_EVENTS.PAUSED_CHANGED, cb);
    store.setPaused(true);
    expect(cb).not.toHaveBeenCalled();
  });

  // Slice G: pause refcount — modal hold 不会覆盖玩家手动暂停
  it('requestPause holds effective paused even when state.paused is false', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    expect(store.isPaused()).toBe(false);
    store.requestPause('event');
    expect(store.isPaused()).toBe(true);
    expect(store.getUserPaused()).toBe(false); // 玩家手动暂停标志没动
  });

  it('releasePause drops effective paused back to user state', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    store.requestPause('event');
    store.releasePause('event');
    expect(store.isPaused()).toBe(false);
  });

  it('multiple holders nest correctly (event + tutorial)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    store.requestPause('event');
    store.requestPause('tutorial');
    expect(store.isPaused()).toBe(true);
    store.releasePause('event');
    expect(store.isPaused()).toBe(true); // 还有 tutorial 持有
    store.releasePause('tutorial');
    expect(store.isPaused()).toBe(false);
  });

  it('user paused remains true after all modal holders release', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: true });
    store.requestPause('event');
    expect(store.isPaused()).toBe(true);
    store.releasePause('event');
    expect(store.isPaused()).toBe(true); // 玩家手动暂停态保留
    expect(store.getUserPaused()).toBe(true);
  });

  it('PAUSED_CHANGED emits only on effective paused transitions', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    const cb = vi.fn();
    store.on(STATE_EVENTS.PAUSED_CHANGED, cb);
    store.requestPause('a'); // false → true
    store.requestPause('b'); // 已 true，不再 emit
    store.releasePause('a'); // 仍 true，不 emit
    store.releasePause('b'); // true → false
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, true);
    expect(cb).toHaveBeenNthCalledWith(2, false);
  });

  it('requestPause is idempotent for same holder', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { paused: false });
    store.requestPause('event');
    store.requestPause('event'); // 重入：什么都不做
    store.releasePause('event'); // 释放一次就够
    expect(store.isPaused()).toBe(false);
  });
});

describe('GameStore.replaceState / setLastSeenNow', () => {
  it('replaceState swaps state and emits STATE_REPLACED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const cb = vi.fn();
    store.on(STATE_EVENTS.STATE_REPLACED, cb);
    const newState = {
      resources: { grain: 500 },
      buildings: [],
      policies: [],
      activeModifiers: [],
      activeDecrees: [],
      eventHistory: [],
      pendingEventId: null,
      pendingEventDayStart: null,
      tutorialStepId: null,
      seenJitHints: [],
      lastEventDay: 0,
      lastSeenTimestamp: 0,
      paused: false,
      speed: 2 as const,
      lastTickTimestamp: 0,
      currentDay: 50,
      rngSeed: 7,
      worldMap: allPlainMap(8, 8),
      productionCarry: {},
      panelCollapsed: { left: false, right: false },
      completedDecreeIds: [],
      npcCountries: [],
      playerMorale: 50,
      playerMilitaryPower: 30,
      publicWrath: 0,
      lastWrathDemandDay: null,
      worldWariness: 20,
      lastWarinessReason: null,
      lastPropagandaDay: null,
      relicSites: [],
      grade: 0,
      gradeReached: 0,
      tianxiaAcknowledged: false,
      dualZeroDays: 0,
      crisisActive: false,
      crisisRecoverDays: 0,
      mode: 'sandbox' as const,
      populationCarry: 0,
      crisisCount: 0,
      vassalOf: null,
      storyFlags: null,
      populationClasses: { farmer: 0, worker: 0, soldier: 0, scholar: 0 },
      conversionQueue: [],
      grainNegativeDays: 0,
      factionState: { active: false, lastEventDay: -1, nextEventDay: -1, activeDemand: null, acceptedDemands: [], rejectedDemands: [] },
      megaProjects: [],
      exclusivePolicies: [],
      generals: [],
      activeExpeditions: [],
      defenseAlerts: [],
    };
    store.replaceState(newState);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(store.getCurrentDay()).toBe(50);
    expect(store.getSpeed()).toBe(2);
    expect(store.getState().resources.grain).toBe(500);
  });

  it('setLastSeenNow updates timestamp to current time', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee);
    const before = Date.now();
    store.setLastSeenNow();
    expect(store.getLastSeenTimestamp()).toBeGreaterThanOrEqual(before);
  });
});

// Slice E Critical patch：lightweight resources getter（避免 getState 的 structuredClone 在
// pointermove 热路径上每帧拷贝整个 worldMap）
describe('GameStore.getResources (lightweight, per-frame safe)', () => {
  it('returns current resources snapshot', () => {
    const { store } = makeStore();
    store.addResource('wood', 50);
    store.addResource('grain', 30);
    const r = store.getResources();
    expect(r.wood).toBe(50);
    expect(r.grain).toBe(30);
  });

  it('returns frozen object (mutation attempts have no effect on store state)', () => {
    const { store } = makeStore();
    store.addResource('wood', 10);
    const r = store.getResources();
    expect(Object.isFrozen(r)).toBe(true);
    // store internal state stays at 10 even if a caller hostile-tries to mutate the snapshot
    store.addResource('wood', 5);
    expect(store.getResources().wood).toBe(15);
  });

  it('subsequent calls reflect latest state (snapshot, not cached reference)', () => {
    const { store } = makeStore();
    store.addResource('wood', 10);
    const first = store.getResources();
    store.addResource('wood', 5);
    const second = store.getResources();
    expect(first.wood).toBe(10);
    expect(second.wood).toBe(15);
  });

  it('does NOT include the worldMap (proves no structuredClone of full state)', () => {
    const { store } = makeStore();
    store.addResource('wood', 1);
    const r = store.getResources() as Record<string, unknown>;
    // resources dict only — no worldMap, buildings, etc. Cheap to call per frame.
    expect('worldMap' in r).toBe(false);
    expect('buildings' in r).toBe(false);
  });
});

// Slice F integration — content engines wired into tickDay
describe('GameStore Slice F integration', () => {
  it('adoptPolicy: deducts cost, marks adopted, adds permanent modifier', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      policies: [{
        id: 'p1', name: 'P', branch: '农桑', x: 0, y: 0,
        cost: { gold: 20 },
        effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
        prerequisites: [], tier: 1, description: '', descPlain: '',
      }],
    });
    store.addResource('gold', 100);
    const result = store.adoptPolicy('p1');
    expect(result.ok).toBe(true);
    expect(store.getResources().gold).toBe(80);
    expect(store.getAdoptedPolicyIds().has('p1')).toBe(true);
    expect(store.getActiveModifiers().some(m => m.id === 'pol_modifier_p1')).toBe(true);
  });

  it('adoptPolicy: unknown id returns failure', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, { policies: [] });
    const result = store.adoptPolicy('nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown_policy');
  });

  it('adoptDecree: deducts stage[0].cost and pushes activeDecrees', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      decrees: [{
        id: 'd1', name: 'D', category: '军事', description: '', descPlain: '',
        unlockCondition: [], // no condition
        stages: [
          { order: 1, cost: { gold: 50 }, days: 5,
            effects: [{ target: 'country_military_power', op: 'add', value: 8 }],
            removeEffects: [] },
        ],
      }],
    });
    store.addResource('gold', 100);
    const result = store.adoptDecree('d1');
    expect(result.ok).toBe(true);
    expect(store.getResources().gold).toBe(50);
    expect(store.getActiveDecrees()).toHaveLength(1);
  });

  it('decree stall does NOT re-emit DECREE_STALLED every tick', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      decrees: [{
        id: 'd1', name: 'D', category: '军事', description: '', descPlain: '',
        unlockCondition: [],
        stages: [
          { order: 1, cost: { gold: 10 }, days: 2,
            effects: [{ target: 'country_military_power', op: 'add', value: 1 }],
            removeEffects: [] },
          { order: 2, cost: { gold: 9999 }, days: 5,
            effects: [], removeEffects: [] },
        ],
      }],
    });
    store.addResource('gold', 10);
    store.adoptDecree('d1');
    const spy = vi.fn();
    store.on(STATE_EVENTS.DECREE_STALLED, spy);
    // tick past stage 0 expiry → first stall
    store.tickDay();
    store.tickDay();
    const stallsAfterFirst = spy.mock.calls.length;
    expect(stallsAfterFirst).toBe(1);
    // continue ticking — should NOT re-emit on each tick
    store.tickDay();
    store.tickDay();
    store.tickDay();
    expect(spy.mock.calls.length).toBe(1);
  });

  it('decree stall recovery: paying up advances without re-applying effects', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, undefined, {
      decrees: [{
        id: 'd1', name: 'D', category: '军事', description: '', descPlain: '',
        unlockCondition: [],
        stages: [
          { order: 1, cost: { gold: 10 }, days: 1,
            effects: [{ target: 'country_military_power', op: 'add', value: 5 }],
            removeEffects: [] },
          { order: 2, cost: { gold: 50 }, days: 10,
            effects: [], removeEffects: [] },
        ],
      }],
    });
    store.addResource('gold', 10);
    store.adoptDecree('d1');
    store.tickDay(); // stage 0 expires, stalls (can't afford 50)
    const modCountAfterStall = store.getActiveModifiers().length;
    store.addResource('gold', 100); // now can afford
    const addSpy = vi.fn();
    store.on(STATE_EVENTS.MODIFIER_ADDED, addSpy);
    store.tickDay(); // should advance, NOT re-add modifier
    expect(addSpy).not.toHaveBeenCalled();
    expect(store.getActiveModifiers().length).toBe(modCountAfterStall);
    // and gold has been deducted for stage 1 cost
    const after = store.getResources().gold ?? 0;
    expect(after).toBeLessThan(110); // started at 110, stage 1 cost is 50
  });

  it('event triggered when condition met; resolveEvent applies choice and writes history', () => {
    const ee = makeEmitter();
    // lastEventDay 设很早，避开新的事件冷却（本用例只验事件触发/结算机制，非冷却）
    const store = new GameStore(ee, { lastEventDay: -1000 }, {
      events: [{
        id: 'evt_low_grain',
        tags: ['抉择'],
        triggers: [{ condition: 'country_grain < 50' }],
        contexts: [{ condition: 'default', title: 'Hunger', desc: '', descPlain: '' }],
        choices: [
          { text: 'A', textPlain: 'A',
            effects: [{ target: 'country_morale', op: 'add', value: 3 }],
            removeEffects: [] },
          { text: 'B', textPlain: 'B', effects: [], removeEffects: [] },
        ],
        defaultTimeoutDays: 7,
      }],
    });
    // make grain low (10 < 50) so trigger fires
    store.addResource('grain', 10);
    store.tickDay();
    expect(store.getPendingEventId()).toBe('evt_low_grain');
    store.resolveEvent(0);
    expect(store.getPendingEventId()).toBeNull();
    expect(store.getActiveModifiers().some(m => m.id.includes('evt_low_grain'))).toBe(true);
    // history written → not re-triggered
    store.tickDay();
    expect(store.getPendingEventId()).toBeNull();
  });

  it('event timeout auto-picks choice 0 after defaultTimeoutDays', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { lastEventDay: -1000 }, {
      events: [{
        id: 'evt_t',
        tags: ['抉择'],
        triggers: [{ condition: 'country_grain < 50' }],
        contexts: [{ condition: 'default', title: 'T', desc: '', descPlain: '' }],
        choices: [
          { text: 'A', textPlain: 'A',
            effects: [{ target: 'country_morale', op: 'add', value: 1 }],
            removeEffects: [] },
        ],
        defaultTimeoutDays: 3,
      }],
    });
    store.addResource('grain', 10);
    store.tickDay(); // event triggers, pending set
    expect(store.getPendingEventId()).toBe('evt_t');
    store.tickDay();
    store.tickDay();
    store.tickDay(); // 3 days elapsed → auto-pick0
    expect(store.getPendingEventId()).toBeNull();
    expect(store.getActiveModifiers().some(m => m.id.includes('evt_t'))).toBe(true);
  });

  it('event cooldown: 冷却期内不触发，满 minDaysBetween 后才触发', () => {
    const ee = makeEmitter();
    // lastEventDay=0，沙盒冷却 50 天；事件条件永真（grain<50）
    const store = new GameStore(ee, { lastEventDay: 0 }, {
      events: [{
        id: 'evt_cd',
        tags: ['抉择'],
        triggers: [{ condition: 'country_grain < 50' }],
        contexts: [{ condition: 'default', title: 'CD', desc: '', descPlain: '' }],
        choices: [{ text: 'A', textPlain: 'A', effects: [], removeEffects: [] }],
        defaultTimeoutDays: 999,
      }],
    });
    store.addResource('grain', 10);
    store.tickDay(); // day1：1-0=1 < 50 → 冷却中，不触发
    expect(store.getPendingEventId()).toBeNull();
    for (let i = 0; i < 49; i++) store.tickDay(); // 推进到 day50：50-0=50 ≥ 50 → 可触发
    expect(store.getPendingEventId()).toBe('evt_cd');
  });

  it('production tick runs in tickDay: working farm gives grain', () => {
    const ee = makeEmitter();
    const farm = makeDef({
      id: 'bld_farm', constructionTime: 1,
      output: [{ resource: 'grain', perDay: 5 }],
    });
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockReturnValue(farm);
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(farm, 0, 0, BIG_BOUNDS);
    // tick 1 day — building should complete (constructionTime=1) but production this tick
    // operates on the post-update buildings list; confirm via grain change after another tick.
    store.tickDay(); // construction completes
    const grainBefore = store.getResources().grain ?? 0;
    store.tickDay(); // first production tick post-completion
    const grainAfter = store.getResources().grain ?? 0;
    // BUG-B（2026-06-19）：人口现在真实吃粮，且 minDailyGrowth 会让人口从 0 自然冒出并开始进食，
    // 故净增 < 产出 5。这里只断言"working 农田让粮净增"（产 5 > 早期口粮）——精确收支由
    // economyBalance.test 的 30 天模拟守护。
    expect(grainAfter).toBeGreaterThan(grainBefore);
    spy.mockRestore();
  });
});

// v0.9 Pillar 2.3：upgradeBuilding 行为；4 路径覆盖：成功、资源不足、前置未满足、已升级中
describe('GameStore.upgradeBuilding (v0.9)', () => {
  const T1 = makeDef({
    id: 'bld_t1', constructionTime: 1,
    upgradesTo: 'bld_t2',
  });
  const T2 = makeDef({
    id: 'bld_t2', tier: 2, cost: { wood: 100 }, constructionTime: 5,
    upgradeCost: { wood: 30 }, upgradeTime: 4,
    upgradeRequires: [],
  });

  function defLookup(id: string): BuildingDef | undefined {
    if (id === 'bld_t1') return T1;
    if (id === 'bld_t2') return T2;
    return undefined;
  }

  function makeStoreWithT1Working(resources: Record<string, number> = { wood: 100 }) {
    const ee = makeEmitter();
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation(defLookup);
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(T1, 0, 0, BIG_BOUNDS);
    store.tickDay(); // ct=1 → working
    expect(store.getState().buildings[0]?.status).toBe('working');
    for (const [k, v] of Object.entries(resources)) store.addResource(k as 'wood', v);
    return { store, spy };
  }

  it('success: deducts upgradeCost, sets upgradingTo, status=constructing, emits BUILDING_UPGRADED on completion', () => {
    const { store, spy } = makeStoreWithT1Working({ wood: 100 });
    const upgradedCb = vi.fn();
    store.on(STATE_EVENTS.BUILDING_UPGRADED, upgradedCb);
    const before = store.getResources().wood ?? 0;
    const result = store.upgradeBuilding(0, 0);
    expect(result).toEqual({ ok: true });
    expect(store.getResources().wood).toBe(before - 30);
    const inst = store.getState().buildings[0];
    expect(inst?.upgradingTo).toBe('bld_t2');
    expect(inst?.status).toBe('constructing');
    expect(inst?.constructionProgress).toBe(0);
    // upgradeTime=4 → 4 ticks finishes
    store.tickDay();
    store.tickDay();
    store.tickDay();
    expect(upgradedCb).not.toHaveBeenCalled();
    store.tickDay();
    expect(upgradedCb).toHaveBeenCalledTimes(1);
    const finalInst = store.getState().buildings[0];
    expect(finalInst?.defId).toBe('bld_t2');
    expect(finalInst?.tier).toBe(2);
    expect(finalInst?.upgradingTo).toBeUndefined();
    expect(finalInst?.status).toBe('working');
    spy.mockRestore();
  });

  it('insufficient_resources: rejects without mutating instance or resources', () => {
    const { store, spy } = makeStoreWithT1Working({ wood: 10 }); // need 30
    const before = store.getResources().wood ?? 0;
    const result = store.upgradeBuilding(0, 0);
    expect(result).toEqual({ ok: false, reason: 'insufficient_resources' });
    expect(store.getResources().wood).toBe(before);
    expect(store.getState().buildings[0]?.upgradingTo).toBeUndefined();
    expect(store.getState().buildings[0]?.status).toBe('working');
    spy.mockRestore();
  });

  it('prerequisites_unmet: rejects with missing[] when upgradeRequires include unbuilt id / unadopted policy', () => {
    const ee = makeEmitter();
    const T2gated = { ...T2, upgradeRequires: ['pol_market', 'bld_other'] };
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation((id: string) => {
      if (id === 'bld_t1') return T1;
      if (id === 'bld_t2') return T2gated;
      return undefined;
    });
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(T1, 0, 0, BIG_BOUNDS);
    store.tickDay();
    store.addResource('wood', 100);
    const result = store.upgradeBuilding(0, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('prerequisites_unmet');
      expect(result.missing).toEqual(expect.arrayContaining(['pol_market', 'bld_other']));
    }
    spy.mockRestore();
  });

  it('already_upgrading: second call rejects', () => {
    const { store, spy } = makeStoreWithT1Working({ wood: 200 });
    const r1 = store.upgradeBuilding(0, 0);
    expect(r1.ok).toBe(true);
    const r2 = store.upgradeBuilding(0, 0);
    expect(r2).toEqual({ ok: false, reason: 'already_upgrading' });
    spy.mockRestore();
  });

  it('no_upgrade_path: T1 without upgradesTo cannot be upgraded', () => {
    const ee = makeEmitter();
    const TLeaf = makeDef({ id: 'bld_leaf', constructionTime: 1 }); // no upgradesTo
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation((id: string) =>
      id === 'bld_leaf' ? TLeaf : undefined,
    );
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.placeBuilding(TLeaf, 0, 0, BIG_BOUNDS);
    store.tickDay();
    const r = store.upgradeBuilding(0, 0);
    expect(r).toEqual({ ok: false, reason: 'no_upgrade_path' });
    spy.mockRestore();
  });

  it('unknown_building: clicking empty grid rejects gracefully', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    expect(store.upgradeBuilding(99, 99)).toEqual({ ok: false, reason: 'unknown_building' });
  });

  it('not_working: cannot upgrade a still-constructing building', () => {
    const ee = makeEmitter();
    const spy = vi.spyOn(buildingRegistry, 'getBuildingDef').mockImplementation(defLookup);
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    const T1Slow = { ...T1, constructionTime: 5 };
    store.placeBuilding(T1Slow, 0, 0, BIG_BOUNDS);
    // status=constructing after placeBuilding
    store.addResource('wood', 100);
    expect(store.upgradeBuilding(0, 0)).toEqual({ ok: false, reason: 'not_working' });
    spy.mockRestore();
  });
});

describe('Phase1 国格阶梯（集成）', () => {
  function workingMarket() {
    return {
      defId: 'bld_market', position: { x: 1, y: 1 }, status: 'working' as const,
      tier: 1 as const, constructionProgress: 100, modifiers: [],
    };
  }

  it('达 level1 门槛 + 建成 bld_market → 一 tick 后晋阶到 1 并发 GRADE_CHANGED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { people: 40, gold: 120, grain: 50 },
      buildings: [workingMarket()],
      npcCountries: [],
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.GRADE_CHANGED, spy);
    expect(store.getGrade()).toBe(0);
    store.tickDay();
    expect(store.getGrade()).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ from: 0, to: 1, reason: 'ascend' });
  });

  it('门槛达标但缺标志建筑 → 不晋阶', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { people: 40, gold: 120, grain: 50 },
      buildings: [], // 无 market
      npcCountries: [],
    });
    store.tickDay();
    expect(store.getGrade()).toBe(0);
  });

  it('一 tick 最多升 1 级（不连跳）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      // 资源全顶 + 多标志建筑，但仍应只升到 1
      resources: { people: 9999, gold: 9999, cloth: 9999, rite: 9999, bronze: 9999, grain: 9999 },
      buildings: [
        workingMarket(),
        { defId: 'bld_ancestor_shrine', position: { x: 2, y: 2 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] },
      ],
      npcCountries: [],
    });
    store.tickDay();
    expect(store.getGrade()).toBe(1);
  });
});

describe('Phase1 低谷危机（集成）', () => {
  it('国库+存粮双零满 §7 阈值(40 日) → 触发危机：人口降、crisisActive、发 CRISIS_TRIGGERED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [],
      npcCountries: [], // 无 NPC → 走民变 unrest
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    // 注：双零期间存粮=0 → 人口同时在饥荒流失（population tick 先于 crisis）。
    // B-0 新增：缺粮 > 5 日开始减员 + > 15 日扣士气（starvation tick）。
    // 只验"危机触发 + 人口确实降 + 民心挫"。§7 阈值 40 天。
    const peopleBefore = store.getResources().people ?? 0;
    for (let i = 0; i < 39; i++) store.tickDay();
    expect(spy).not.toHaveBeenCalled();
    store.tickDay(); // 第 40 日触发
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ kind: 'unrest' });
    expect(store.getResources().people ?? 0).toBeLessThan(peopleBefore);
    // B-0：starvation morale penalty（日 15 后每日 -3）叠加 crisis penalty(-20)
    expect(store.getPlayerMorale()).toBeLessThan(30);
  });

  it('§7 纳贡附庸：双零+军力远超的敌对强邻 → 成附庸，可赎身', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [],
      playerMilitaryPower: 20,
      npcCountries: [{
        id: 'npc_jin', stance: -50, militaryPower: 200, renown: 40, tradeRoute: false, tradeCooldown: 0,
        warStatus: 'tension' as const, lastEnvoyDay: -1, lastWarDay: -1, allyIds: [], aggression: 60, lastActionDay: -1,
      }],
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ kind: 'vassalage' });
    expect(store.isVassal()).toBe(true);
    // 赎身：钱不够失败，够了成功
    expect(store.redeemVassalage().ok).toBe(false);
    store.addResource('gold', 500);
    expect(store.redeemVassalage().ok).toBe(true);
    expect(store.isVassal()).toBe(false);
  });

  it('§7 割地：双零+无强敌+有外城 → 丢一座非核心建筑', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [
        // 用产礼器（非 gold/grain）的非核心建筑，确保双零前提不被产出破坏
        { defId: 'bld_ancestor_shrine', position: { x: 1, y: 1 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] },
      ],
      npcCountries: [], // 无强敌
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ kind: 'cession' });
    const shrine = store.getState().buildings.find(b => b.defId === 'bld_ancestor_shrine');
    expect(shrine?.status).toBe('derelict');
  });

  it('资源回正 → dualZeroDays 归零，不触发', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { gold: 0, grain: 0, people: 100 },
      buildings: [],
      npcCountries: [],
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.CRISIS_TRIGGERED, spy);
    for (let i = 0; i < 30; i++) store.tickDay(); // 未到 40 天阈值
    store.addResource('gold', 100); // 补回国库 → 下一 tick 计数归零
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(spy).not.toHaveBeenCalled();
  });

  it('危机恢复期（crisisActive）内不晋阶——即使满足 level1 门槛也不 ascend', () => {
    const ee = makeEmitter();
    // 预置：处于危机态 + 已满足 level1（人口/钱达标 + 建成 bld_market）
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      crisisActive: true,
      resources: { gold: 500, grain: 200, people: 80 },
      buildings: [
        { defId: 'bld_market', position: { x: 1, y: 1 }, status: 'working' as const, tier: 1 as const, constructionProgress: 100, modifiers: [] },
      ],
      npcCountries: [],
    });
    expect(store.getGrade()).toBe(0);
    const gradeSpy = vi.fn();
    ee.on(STATE_EVENTS.GRADE_CHANGED, gradeSpy);
    store.tickDay();
    expect(store.getGrade()).toBe(0); // crisisActive 守卫挡住晋阶
    expect(gradeSpy).not.toHaveBeenCalled();
  });
});

describe('Phase1 NPC 动态成长（集成）', () => {
  function npc(id: string, mp: number, over: Record<string, unknown> = {}) {
    return {
      id, stance: -30, militaryPower: mp, renown: 40, tradeRoute: false, tradeCooldown: 0,
      warStatus: 'peace' as const, lastEnvoyDay: -1, lastWarDay: -1,
      allyIds: [] as string[], aggression: 50, lastActionDay: -1, ...over,
    };
  }

  it('startNewGameNpcs：换成池中 4 个、含 ≥1 蛮夷', () => {
    const store = new GameStore(makeEmitter(), { worldMap: allPlainMap() });
    store.startNewGameNpcs(42);
    const roster = store.getNpcCountries();
    expect(roster).toHaveLength(4);
  });

  it('NPC 军力随季成长（晋 martial 每 30 日 +4）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 500, gold: 100 },
      npcCountries: [npc('npc_jin', 50)],
    });
    for (let i = 0; i < 30; i++) store.tickDay(); // 到第 30 日触发一次成长
    expect(store.getNpcCountries()[0]!.militaryPower).toBeGreaterThan(50);
  });

  it('蛮夷在场 → 长期推进会触发 NPC_ACTION 骚扰', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 9999, gold: 9999 },
      npcCountries: [npc('npc_rong', 70, { aggression: 90 })], // 戎狄 tribal
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.NPC_ACTION, spy);
    for (let i = 0; i < 240; i++) store.tickDay();
    expect(spy).toHaveBeenCalled(); // 240 日内高侵略蛮夷几乎必有骚扰
  });
});

describe('Phase1 人口增长（集成）', () => {
  it('有余粮 + 未满住房上限 → 人口随天数增长', () => {
    const ee = makeEmitter();
    // BUG-B（2026-06-19）：人口真实吃粮后，"余粮"必须有可持续的产出来源，否则 500 存粮会被吃光
    // 后人口饥荒回落到下限。注入 6 座 working 农田（产 60 粮/天 > 满员 45 口粮）保证真·余粮。
    const farms: BuildingInstance[] = Array.from({ length: 6 }, (_, i) => ({
      defId: 'bld_farm', position: { x: i * 3, y: 0 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [],
    }));
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 500, people: 5, gold: 100 }, // gold>0 防误触危机
      buildings: farms,
      npcCountries: [],
    });
    for (let i = 0; i < 80; i++) store.tickDay();
    expect((store.getResources().people ?? 0)).toBeGreaterThan(5);
  });

  it('缺粮 → 人口流失', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 0, people: 100, gold: 100 }, // 仅缺粮、不双零，故饥荒非危机
      buildings: [],
      npcCountries: [],
    });
    for (let i = 0; i < 20; i++) store.tickDay();
    expect((store.getResources().people ?? 0)).toBeLessThan(100);
  });

  it('达住房上限后不再增长（people 不超过 cap）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 500, people: 14, gold: 100 }, // baseHousingCap=45，无居住建筑
      buildings: [],
      npcCountries: [],
    });
    for (let i = 0; i < 200; i++) store.tickDay();
    // "人口不超过住房上限"这一不变量；用动态 getHousingCap() 而非写死数字，配置再调也不挂
    expect((store.getResources().people ?? 0)).toBeLessThanOrEqual(store.getHousingCap());
  });
});

describe('Phase2 故事框架（集成）', () => {
  function npc(id: string, mp: number, stance: number) {
    return {
      id, stance, militaryPower: mp, renown: 40, tradeRoute: false, tradeCooldown: 0,
      warStatus: 'peace' as const, lastEnvoyDay: -1, lastWarDay: -1,
      allyIds: [] as string[], aggression: 40, lastActionDay: -1,
    };
  }
  const renownMod = {
    id: 'm_renown', name: 'r', category: 'diplomacy' as const, stackable: true,
    effects: [{ target: 'country_renown' as const, op: 'add' as const, value: 100 }],
    visualBadge: null, remainingDays: -1, description: '', descPlain: '',
  };

  it('startStoryMode：mode=story + storyFlags 序章态', () => {
    const store = new GameStore(makeEmitter(), { worldMap: allPlainMap() });
    store.startStoryMode();
    expect(store.getMode()).toBe('story');
    const sf = store.getStoryFlags();
    expect(sf?.chapter).toBe(0);
    expect(sf?.unified).toBe(false);
  });

  it('沙盒模式：runStoryTick 不触发统一（storyFlags=null）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(), resources: { grain: 500, gold: 100 },
      npcCountries: [npc('npc_qi', 5, -50)], // 军力被打服，但沙盒模式不该统一
    });
    const spy = vi.fn();
    ee.on(STATE_EVENTS.STORY_UNIFIED, spy);
    store.tickDay();
    expect(spy).not.toHaveBeenCalled();
    expect(store.getStoryFlags()).toBeNull();
  });

  it('武途统一：所有 NPC 被打服 → STORY_UNIFIED martial + 权力轴偏集权(负)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(), resources: { grain: 500, gold: 100 },
      npcCountries: [npc('npc_qi', 10, -30), npc('npc_jin', 15, -40)],
    });
    store.startStoryMode();
    const spy = vi.fn();
    ee.on(STATE_EVENTS.STORY_UNIFIED, spy);
    store.tickDay();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ path: 'martial' });
    expect(store.getStoryFlags()?.unified).toBe(true);
    expect(store.getStoryFlags()!.powerAxis).toBeLessThan(0);
    // 再 tick 不重复触发
    store.tickDay();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('文途统一：信誉高 + 多数归附 → STORY_UNIFIED cultural + 权力轴偏还权(正)', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(), resources: { grain: 500, gold: 100 },
      activeModifiers: [renownMod], // renown=50+100=150 ≥120
      npcCountries: [npc('npc_qi', 80, 70), npc('npc_lu', 60, 80)], // 都 ≥60 归附
    });
    store.startStoryMode();
    const spy = vi.fn();
    ee.on(STATE_EVENTS.STORY_UNIFIED, spy);
    store.tickDay();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ path: 'cultural' });
    expect(store.getStoryFlags()!.powerAxis).toBeGreaterThan(0);
  });

  it('advanceStoryChapter：推进章节 + 发 STORY_CHAPTER_CHANGED', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { worldMap: allPlainMap() });
    store.startStoryMode();
    const spy = vi.fn();
    ee.on(STATE_EVENTS.STORY_CHAPTER_CHANGED, spy);
    store.advanceStoryChapter(1);
    expect(store.getStoryFlags()?.chapter).toBe(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ chapter: 1 });
  });

  it('抉择推双轴：故事模式采纳带 storyAxisDelta 的国策 → 轴变；沙盒模式不变', () => {
    const policy = {
      id: 'pol_test', name: '试', branch: '农桑' as const, x: 0, y: 0, cost: {},
      effects: [], prerequisites: [], tier: 1, description: '', descPlain: '',
      storyAxisDelta: { power: 40, production: -40 },
    };
    // 故事模式
    const ee1 = makeEmitter();
    const s1 = new GameStore(ee1, { worldMap: allPlainMap() }, { policies: [policy] });
    s1.startStoryMode();
    s1.adoptPolicy('pol_test');
    expect(s1.getStoryFlags()!.powerAxis).toBe(40);
    expect(s1.getStoryFlags()!.resourceAxis).toBe(-40);
    // 沙盒模式：同国策不推轴（storyFlags=null）
    const s2 = new GameStore(makeEmitter(), { worldMap: allPlainMap() }, { policies: [policy] });
    s2.adoptPolicy('pol_test');
    expect(s2.getStoryFlags()).toBeNull();
  });
});

describe('Phase2 故事框架闭环（集成）', () => {
  function npc(id: string, mp: number, stance: number) {
    return {
      id, stance, militaryPower: mp, renown: 40, tradeRoute: false, tradeCooldown: 0,
      warStatus: 'peace' as const, lastEnvoyDay: -1, lastWarDay: -1,
      allyIds: [] as string[], aggression: 40, lastActionDay: -1,
    };
  }

  it('序章统一→（模拟跳变进第一章）→章节占位推进→第七章兑现三结局 STORY_ENDING', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { grain: 9999, gold: 9999, people: 50 }, // 充足，途中不触危机
      npcCountries: [npc('npc_qi', 10, -30), npc('npc_jin', 12, -40)], // 已被打服
    });
    store.startStoryMode();
    const unified = vi.fn();
    const ended = vi.fn();
    ee.on(STATE_EVENTS.STORY_UNIFIED, unified);
    ee.on(STATE_EVENTS.STORY_ENDING, ended);

    store.tickDay(); // 序章统一
    expect(unified).toHaveBeenCalledTimes(1);
    // 模拟逐章达成目标推进（章节目标判定本身由 chapterGoalMet 单测覆盖）。一路推到第七章。
    for (let ch = 1; ch <= 7; ch++) store.advanceStoryChapter(ch);
    // 第七章目标 = 解决 evt_s_ch7_war_vote + stele + throne（全章关键剧情）；注入"已解决"再 tick → 终章判定结局
    const s7 = store.getState();
    store.replaceState({ ...s7, storyFlags: { ...s7.storyFlags!, chapter: 7, storyEventsTriggered: ['evt_s_ch7_war_vote', 'evt_s_ch7_stele', 'evt_s_ch7_throne'] } });
    for (let i = 0; i < 5 && ended.mock.calls.length === 0; i++) store.tickDay();

    expect(ended).toHaveBeenCalledTimes(1);
    const sf = store.getStoryFlags()!;
    expect(sf.chapter).toBe(7);
    expect(['gong', 'jia', 'huo']).toContain(sf.ending);
    // 双轴中立（martial 种子 -20 仍在 neutral 档）→ 默认货天下
    expect(sf.ending).toBe('huo');
  });

  it('防 softlock：统一后未推进就重载（unified+chapter0）→ tick 自动恢复进第一章', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { worldMap: allPlainMap(), resources: { grain: 9999, gold: 9999 } });
    store.startStoryMode();
    const snap = store.getState();
    // 灌入"过场中存档→重载"的卡住态：chapter 0 + unified true（瞬态 pending 不持久 → 新读档为 false）
    store.replaceState({
      ...snap,
      storyFlags: { ...snap.storyFlags!, chapter: 0, unified: true, unifyPath: 'martial' },
    });
    store.tickDay();
    expect(store.getStoryFlags()?.chapter).toBe(1);
  });

  it('结局只兑现一次（到结局后不再重复 emit）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, {
      worldMap: allPlainMap(), resources: { grain: 9999, gold: 9999, people: 50 },
      npcCountries: [npc('npc_qi', 10, -30)],
    });
    store.startStoryMode();
    const ended = vi.fn();
    ee.on(STATE_EVENTS.STORY_ENDING, ended);
    store.tickDay();
    for (let ch = 1; ch <= 7; ch++) store.advanceStoryChapter(ch);
    const s7 = store.getState();
    store.replaceState({ ...s7, storyFlags: { ...s7.storyFlags!, chapter: 7, storyEventsTriggered: ['evt_s_ch7_war_vote', 'evt_s_ch7_stele', 'evt_s_ch7_throne'] } });
    for (let i = 0; i < 5; i++) store.tickDay();
    const callsAtEnd = ended.mock.calls.length;
    expect(callsAtEnd).toBe(1);
    for (let i = 0; i < 200; i++) store.tickDay(); // 继续推进
    expect(ended.mock.calls.length).toBe(callsAtEnd); // 不再重复
  });
});

describe('Phase3 章节目标解锁（集成）', () => {
  it('解决本章关键剧情事件 → 解锁下一章（advanceGoal story_events）', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { worldMap: allPlainMap(), resources: { grain: 9999, gold: 9999 }, npcCountries: [] });
    store.startStoryMode();
    store.advanceStoryChapter(1); // 进第一章
    expect(store.getStoryFlags()?.chapter).toBe(1);
    // 模拟第一章全部关键剧情事件已解决（注入 storyEventsTriggered）
    const snap = store.getState();
    store.replaceState({
      ...snap,
      storyFlags: { ...snap.storyFlags!, chapter: 1, storyEventsTriggered: ['evt_s_ch1_dike', 'evt_s_ch1_cadre', 'evt_s_ch1_arrest', 'evt_s_ch1_oath'] },
    });
    store.tickDay();
    expect(store.getStoryFlags()?.chapter).toBe(2); // 目标达成 → 解锁第二章
  });

  it('章节关键事件未全解决 → 不解锁', () => {
    const ee = makeEmitter();
    const store = new GameStore(ee, { worldMap: allPlainMap(), resources: { grain: 9999, gold: 9999 }, npcCountries: [] });
    store.startStoryMode();
    store.advanceStoryChapter(1);
    const snap = store.getState();
    store.replaceState({
      ...snap,
      storyFlags: { ...snap.storyFlags!, chapter: 1, storyEventsTriggered: ['evt_s_ch1_dike'] }, // 只解决一个
    });
    for (let i = 0; i < 300; i++) store.tickDay(); // 久等也不进章（非时间驱动）
    expect(store.getStoryFlags()?.chapter).toBe(1);
  });
});

describe('分阶段解锁判定 (isBuildingUnlocked / isPolicyUnlocked)', () => {
  it('建筑无 upgradeRequires → 直接解锁', () => {
    const { store } = makeStore();
    expect(store.isBuildingUnlocked({ upgradeRequires: [] } as unknown as BuildingDef)).toBe(true);
  });

  it('建筑有未满足的前置（国策或建筑）→ 未解锁', () => {
    const { store } = makeStore();
    expect(store.isBuildingUnlocked({ upgradeRequires: ['pol_nonexist'] } as unknown as BuildingDef)).toBe(false);
    expect(store.isBuildingUnlocked({ upgradeRequires: ['bld_nonexist'] } as unknown as BuildingDef)).toBe(false);
  });

  it('国策无 prerequisites → 直接解锁；有未满足前置 → 未解锁', () => {
    const { store } = makeStore();
    expect(store.isPolicyUnlocked({ prerequisites: [] } as unknown as PolicyNode)).toBe(true);
    expect(store.isPolicyUnlocked({ prerequisites: ['pol_x'] } as unknown as PolicyNode)).toBe(false);
  });
});
