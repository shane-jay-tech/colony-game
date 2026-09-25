/**
 * c925-6c4b：价格（资源造价 / 资源增减量）边界面回归。
 *
 * 判据（卷宗「验收」）：边界输入 ⇒ **稳定拒绝**或**稳定钳制**，不得出现负库存或 NaN。
 * 覆盖面 = 仓内把"价格"变成库存的三道闸：
 *   1. `canAfford`（resourceRegistry）—— 唯一的支付门槛纯函数；
 *   2. `GameStore.addResource` → `setResourceClamped` —— 扣减 / 入账的唯一钳制口；
 *   3. `canPlace` / `placeBuilding` —— 造价（def.cost）经闸门落到库存的真实路径。
 *
 * 口径：不断言实现细节（发射几个事件、走哪个分支），只断言"值域"不变量：
 * 每格资源恒为**有限非负整数**。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, type IEventEmitter } from '../gameStore';
import { canPlace, type MapBounds } from '../placementSystem';
import { canAfford, addBags, RESOURCE_IDS, type ResourceBag, type ResourceId } from '../../data/resourceRegistry';
import { getBuildingDef } from '../../data/buildingRegistry';
import type { BuildingDef } from '../../data/schema';
import { WorldMapAccessor } from '../worldMap';
import type { MapTile } from '../../data/mapSchema';

const OVERFLOW = Number.MAX_VALUE;         // 浮点溢出（Infinity 的邻域）
const SAFE_MAX = Number.MAX_SAFE_INTEGER;  // 整数溢出边界

/** 全格不变量：每格都是有限、非负、整数。 */
function assertResourcesSane(res: ResourceBag, ctx: string): void {
  for (const id of RESOURCE_IDS) {
    const v = res[id];
    if (v === undefined) continue;
    expect(Number.isFinite(v), `${ctx}: ${id} 非有限值`).toBe(true);
    expect(Number.isNaN(v), `${ctx}: ${id} 是 NaN`).toBe(false);
    expect(v, `${ctx}: ${id} 负库存`).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(v), `${ctx}: ${id} 非整数`).toBe(true);
  }
}

const bounds: MapBounds = { width: 10, height: 10 };

function plainAccessor(w = 10, h = 10): WorldMapAccessor {
  const tiles: MapTile[] = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain', buildable: true, walkable: true });
  return new WorldMapAccessor({ width: w, height: h, tiles, resourceNodes: [], seed: 0 });
}
const PLAIN = plainAccessor();

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee);
}

/** 取一件真实建筑的 def 并把某一格材料造价换成边界值（不改注册表原件）。 */
function defWithCost(id: string, res: ResourceId, price: number): BuildingDef {
  const def = getBuildingDef(id);
  if (!def) throw new Error(`建筑 ${id} 未注册（前提否证）`);
  return { ...def, cost: { ...def.cost, [res]: price } };
}

// ========================= 1. canAfford：价格闸 =========================

describe('canAfford · 价格边界必须稳定拒绝', () => {
  const bag: ResourceBag = { wood: 100, gold: 100 };

  it('下限：负价与 −Infinity 一律付不起（不得变成"倒找钱"）', () => {
    expect(canAfford(bag, { wood: -5 })).toBe(false);
    expect(canAfford(bag, { wood: -0 })).toBe(true); // -0 === 0，免费项放行
    expect(canAfford(bag, { wood: -OVERFLOW })).toBe(false);
    expect(canAfford(bag, { wood: -SAFE_MAX })).toBe(false);
    expect(canAfford(bag, { wood: 20, gold: -1 })).toBe(false); // 任一格负价即整单拒
  });

  it('零价：视为免费，放行且不产生扣减面', () => {
    expect(canAfford(bag, {})).toBe(true);
    expect(canAfford(bag, { wood: 0 })).toBe(true);
    expect(canAfford({}, { wood: 0 })).toBe(true);
  });

  it('上限：刚好付得起 / 差一点付不起 / 溢出量级全部拒绝', () => {
    expect(canAfford(bag, { wood: 100 })).toBe(true);   // 恰好等于余额
    expect(canAfford(bag, { wood: 100.0001 })).toBe(false);
    expect(canAfford(bag, { wood: SAFE_MAX })).toBe(false);
    expect(canAfford(bag, { wood: OVERFLOW })).toBe(false);
    expect(canAfford(bag, { wood: Infinity })).toBe(false);
  });

  it('🔴 NaN 价必须拒绝：NaN 参与 < 比较恒为 false，裸写会"静默放行"（本单主案）', () => {
    expect(Number.isNaN(NaN)).toBe(true);
    expect(NaN < 0).toBe(false);            // 躲过负价检查
    expect((bag.wood ?? 0) < NaN).toBe(false); // 躲过余额检查 ⇒ 旧实现返回 true
    expect(canAfford(bag, { wood: NaN })).toBe(false);
  });

  it('缺字段 / 非法资源名不参与判定（不得凭白放行也不得凭白拒绝）', () => {
    expect(canAfford(bag, { grain: NaN } as ResourceBag)).toBe(false);
    expect(canAfford(bag, { stone: NaN })).toBe(false);
    expect(canAfford(bag, { notAResource: NaN } as never)).toBe(true); // 未登记键不参与
  });

  it('addBags：价格累加不得造出 NaN / 非有限值（clamp 前的中间态）', () => {
    const merged = addBags({ wood: 100 }, { wood: SAFE_MAX });
    expect(Number.isFinite(merged.wood ?? 0)).toBe(true);
    const withNaN = addBags({ wood: 100 }, { wood: NaN });
    // 累加本身按 JS 语义可为 NaN，但它绝不能被当成"付得起"
    expect(canAfford({ wood: 100 }, withNaN)).toBe(false);
  });
});

// ==================== 2. addResource：扣减 / 入账钳制口 ====================

describe('GameStore.addResource · 边界量不得造出负库存或 NaN', () => {
  it('🔴 NaN 增量：整局拒绝，库存保持原值（不得写成 NaN）', () => {
    const store = makeStore();
    store.addResource('wood', 50);
    store.addResource('wood', NaN);
    expect(store.getResources().wood).toBe(50);
    assertResourcesSane(store.getResources(), 'NaN 增量后');
  });

  it('溢出（+Infinity / MAX_VALUE / MAX_SAFE_INTEGER）：钳到存储上限，不越界', () => {
    const store = makeStore();
    const cap = store.getResourceCap('wood');
    for (const big of [Infinity, OVERFLOW, SAFE_MAX, cap * 4]) {
      store.addResource('wood', big);
      expect(store.getResources().wood).toBe(cap);
    }
    assertResourcesSane(store.getResources(), '正向溢出后');
  });

  it('下溢（−Infinity / 巨大负值）：钳到 0，绝不出现负库存', () => {
    const store = makeStore();
    store.addResource('grain', 10);
    store.addResource('grain', -Infinity);
    expect(store.getResources().grain).toBe(0);
    store.addResource('grain', 10);
    store.addResource('grain', -OVERFLOW);
    expect(store.getResources().grain).toBe(0);
    assertResourcesSane(store.getResources(), '负向溢出后');
  });

  it('零值 / 小数：零值不动存量，小数向下取整（库存恒整数）', () => {
    const store = makeStore();
    store.addResource('gold', 30);
    store.addResource('gold', 0);
    expect(store.getResources().gold).toBe(30);
    store.addResource('gold', 5.9);
    expect(store.getResources().gold).toBe(35);
    assertResourcesSane(store.getResources(), '零值/小数后');
  });

  it('NaN 库存一旦写进任意一格，不得靠后续正常增量自愈成有限值以外的形态', () => {
    const store = makeStore();
    store.addResource('cloth', NaN);          // 被拒绝
    store.addResource('cloth', 7);            // 正常入账
    expect(store.getResources().cloth).toBe(7);
    assertResourcesSane(store.getResources(), '拒绝后再入账');
  });
});

// ============= 3. 造价 → 库存的真实路径（canPlace / placeBuilding） =============

describe('建筑造价边界 · 经真实路径不得造出 NaN 库存', () => {
  const FARM = 'bld_farm';

  it('前置自证：bld_farm 造价本身是有限正整数（否则本节判据无意义）', () => {
    const def = getBuildingDef(FARM);
    expect(def, 'bld_farm 未注册').toBeTruthy();
    for (const [k, v] of Object.entries(def!.cost)) {
      expect(Number.isFinite(v as number), `造价 ${k} 非有限`).toBe(true);
      expect((v as number) >= 0, `造价 ${k} 为负`).toBe(true);
    }
  });

  it('🔴 NaN 材料造价：canPlace 必须拒绝（不得放行后把库存冲成 NaN）', () => {
    const store = makeStore();
    store.addResource('wood', 500);
    store.addResource('people', 50);
    const state = store.getState();
    const res = state.resources;
    expect(canAfford(res, { wood: NaN })).toBe(false);
    const r = canPlace(res, state.buildings, defWithCost(FARM, 'wood', NaN), 0, 0, bounds, PLAIN);
    expect(r.ok).toBe(false);
    assertResourcesSane(store.getResources(), 'NaN 造价 canPlace 后');
  });

  it('溢出材料造价：拒绝且库存不变', () => {
    const store = makeStore();
    store.addResource('wood', 500);
    store.addResource('people', 50);
    const before = { ...store.getResources() };
    for (const price of [Infinity, OVERFLOW, SAFE_MAX]) {
      const state = store.getState();
      const r = canPlace(state.resources, state.buildings, defWithCost(FARM, 'wood', price), 0, 0, bounds, PLAIN);
      expect(r.ok).toBe(false);
    }
    expect(store.getResources().wood).toBe(before.wood);
    assertResourcesSane(store.getResources(), '溢出造价后');
  });

  it('负造价：拒绝（不得"建造反而无限刷资源"）', () => {
    const store = makeStore();
    store.addResource('wood', 500);
    store.addResource('people', 50);
    const state = store.getState();
    const r = canPlace(state.resources, state.buildings, defWithCost(FARM, 'wood', -99999), 0, 0, bounds, PLAIN);
    expect(r.ok).toBe(false);
    assertResourcesSane(store.getResources(), '负造价后');
  });

  it('零造价：放行，且库存一格不少（拒绝/放行两种行为都要可预期）', () => {
    const store = makeStore();
    store.addResource('people', 50);
    const before = { ...store.getResources() };
    const state = store.getState();
    const r = canPlace(state.resources, state.buildings, defWithCost(FARM, 'wood', 0), 0, 0, bounds, PLAIN);
    expect(r.ok).toBe(true);
    expect(store.getResources().wood).toBe(before.wood);
  });

  it('placeBuilding 全边界扫：任何一格造价被打成边界值后，库存仍恒有限非负', () => {
    const store = makeStore();
    store.addResource('wood', 500);
    store.addResource('people', 50);
    let placed = 0;
    for (const price of [NaN, Infinity, -Infinity, OVERFLOW, -OVERFLOW, SAFE_MAX, -SAFE_MAX, 0, -20]) {
      const def = defWithCost(FARM, 'wood', price);
      const res = store.placeBuilding(def, placed, 5, bounds);
      if (res.ok) placed++;
      assertResourcesSane(store.getResources(), `placeBuilding 价格=${String(price)}`);
    }
    expect(placed, '边界价全被拒绝时也应 >=0 次成功').toBeGreaterThanOrEqual(0);
  });
});
