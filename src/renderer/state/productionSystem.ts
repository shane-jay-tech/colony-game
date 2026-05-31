/**
 * ProductionSystem — 每天结束时计算所有 working 建筑的产出 / 维护开销，
 * 应用 country_<resource>_output / country_<resource>_consumption modifier，
 * 返回当日资源 deltas（正为产出，负为消耗）。
 *
 * 公式（per resource）：
 *   net_output  = (Σ building.output[r].perDay over working buildings) × mul(country_<r>_output)
 *               + add(country_<r>_output)                    （add 是绝对增量，作用于总产出）
 *   net_upkeep  = (Σ building.upkeep[r] over working buildings) × mul(country_<r>_consumption)
 *               + add(country_<r>_consumption)
 *   delta[r]    = round(net_output - net_upkeep)
 *
 * 设计取舍：
 *   - 只对 status === 'working' 的建筑计入产出（'constructing' / 'paused' / 'derelict' 不产）
 *   - upkeep 应用到 consumption modifier；output 应用到 output modifier。两组分开。
 *   - 取整：分数累加器（Slice G hardening 落地）。每个资源维护小数残差（caller 持有），
 *     本 tick 的 effOutput-effUpkeep 加上残差后取整为 delta；剩下的小数留给下一 tick。
 *     这样 grain 产出 0.4 持续 5 天就会变成 deltaSequence [0, 1, 0, 1, 0]（不再永远是 0）。
 */

import { RESOURCE_IDS } from '../data/resourceRegistry';
import type { ResourceId, ResourceBag, ModifierTargetKey } from '../data/resourceRegistry';
import type { BuildingDef, BuildingInstance, ModifierInstance } from '../data/schema';
import { getAddDelta, getMulFactor } from './modifierAggregator';

export interface ProductionTickResult {
  /** 当日要应用到 GameState.resources 的 deltas（正/负皆有） */
  deltas: Partial<Record<ResourceId, number>>;
  /** 用于诊断 / UI 显示的明细：每种资源的 raw 总产出 / 总维护 */
  detail: Partial<Record<ResourceId, { rawOutput: number; rawUpkeep: number; net: number }>>;
  /** 取整后剩下的小数残差，caller 在下一 tick 把它加回去（分数累加器） */
  fractionalCarry: Partial<Record<ResourceId, number>>;
}

/** 把 resource id 映射到对应的 modifier target key（output / consumption）。 */
function outputTargetFor(resId: ResourceId): ModifierTargetKey | null {
  // 只列出 schema MODIFIER_TARGETS 中真正存在的 country_<r>_output keys
  const map: Partial<Record<ResourceId, ModifierTargetKey>> = {
    grain: 'country_grain_output',
    wood: 'country_wood_output',
    stone: 'country_stone_output',
    gold: 'country_gold_output',
    cloth: 'country_cloth_output',
    bronze: 'country_bronze_output',
    rite: 'country_rite_output',
  };
  return map[resId] ?? null;
}

function consumptionTargetFor(resId: ResourceId): ModifierTargetKey | null {
  // 当前 schema 仅给 grain 定义了 country_grain_consumption；其他资源的 upkeep
  // 不带 consumption modifier，默认 mul=1 add=0。
  if (resId === 'grain') return 'country_grain_consumption';
  return null;
}

/**
 * v1.0 #3：算两栋 working building 包围盒的最小 Manhattan 距离。
 * 若包围盒重叠（升级/重叠态——理论不应发生）返回 0。
 */
function tileDistance(a: BuildingInstance, aDef: BuildingDef, b: BuildingInstance, bDef: BuildingDef): number {
  const ax0 = a.position.x, ay0 = a.position.y;
  const ax1 = ax0 + aDef.size.width - 1, ay1 = ay0 + aDef.size.height - 1;
  const bx0 = b.position.x, by0 = b.position.y;
  const bx1 = bx0 + bDef.size.width - 1, by1 = by0 + bDef.size.height - 1;
  const dx = ax1 < bx0 ? bx0 - ax1 : (bx1 < ax0 ? ax0 - bx1 : 0);
  const dy = ay1 < by0 ? by0 - ay1 : (by1 < ay0 ? ay0 - by1 : 0);
  return dx + dy;
}

/**
 * v1.0 #3：算单栋建筑某资源的相邻加成倍率（取所有命中规则中最大的 mul，不叠乘）。
 * 没有规则或没有命中 → 返回 1。export 给 BuildingPopover 复用同一份逻辑显示当前生效加成。
 */
export function computeAdjacencyMul(
  self: BuildingInstance,
  selfDef: BuildingDef,
  resource: ResourceId,
  allBuildings: readonly BuildingInstance[],
  defLookup: (id: string) => BuildingDef | undefined,
): { mul: number; activeRule: { partnerDefId: string; description: string } | null } {
  if (!selfDef.adjacencyBonus || selfDef.adjacencyBonus.length === 0) return { mul: 1, activeRule: null };
  let bestMul = 1;
  let bestRule: { partnerDefId: string; description: string } | null = null;
  for (const rule of selfDef.adjacencyBonus) {
    if (rule.resource !== resource) continue;
    const ruleMul = rule.outputMul ?? 1;
    if (ruleMul <= bestMul) continue;
    // 寻找一个 working 的相邻 partner
    let hit = false;
    for (const other of allBuildings) {
      if (other === self) continue;
      if (other.defId !== rule.partnerDefId) continue;
      if (other.status !== 'working') continue;
      const otherDef = defLookup(other.defId);
      if (!otherDef) continue;
      if (tileDistance(self, selfDef, other, otherDef) <= rule.range) {
        hit = true;
        break;
      }
    }
    if (hit) {
      bestMul = ruleMul;
      bestRule = { partnerDefId: rule.partnerDefId, description: rule.description };
    }
  }
  return { mul: bestMul, activeRule: bestRule };
}

/**
 * 算单日产出 deltas。pure function — 不修改任何输入；调用方拿 result.deltas 自行
 * apply 到 store 的 resources（GameStore 内通过 applyDayDeltas 走 setResourceClamped 路径）。
 */
export function computeProductionTick(
  buildings: readonly BuildingInstance[],
  defLookup: (defId: string) => BuildingDef | undefined,
  modifiers: readonly ModifierInstance[],
  /** 上一 tick 留下的小数残差；首次调用传 {} */
  prevCarry: Readonly<Partial<Record<ResourceId, number>>> = {},
): ProductionTickResult {
  // 1) 累加 raw output / upkeep（不含 country modifier，但已应用相邻加成）
  const rawOutput: Partial<Record<ResourceId, number>> = {};
  const rawUpkeep: Partial<Record<ResourceId, number>> = {};

  for (const b of buildings) {
    if (b.status !== 'working') continue;
    const def = defLookup(b.defId);
    if (!def) continue; // 损坏数据：跳过，不让 NaN 污染整体

    for (const o of def.output) {
      const r = o.resource;
      // v1.0 #3：相邻加成（如农田旁有水井 +30%）
      const adj = computeAdjacencyMul(b, def, r, buildings, defLookup);
      const cur = rawOutput[r] ?? 0;
      rawOutput[r] = cur + o.perDay * adj.mul;
    }
    for (const id of RESOURCE_IDS) {
      const u = def.upkeep[id];
      if (u === undefined || u <= 0) continue;
      const cur = rawUpkeep[id] ?? 0;
      rawUpkeep[id] = cur + u;
    }
  }

  // 2) 对每种资源：计算 effective output / upkeep，得到 net delta（带分数累加器）
  const deltas: Partial<Record<ResourceId, number>> = {};
  const detail: Partial<Record<ResourceId, { rawOutput: number; rawUpkeep: number; net: number }>> = {};
  const fractionalCarry: Partial<Record<ResourceId, number>> = {};

  for (const r of RESOURCE_IDS) {
    const ro = rawOutput[r] ?? 0;
    const ru = rawUpkeep[r] ?? 0;
    const carryIn = prevCarry[r] ?? 0;
    if (ro === 0 && ru === 0 && carryIn === 0) continue;

    let effOutput = ro;
    let effUpkeep = ru;

    const oTarget = outputTargetFor(r);
    if (oTarget) {
      const mul = getMulFactor(oTarget, modifiers);
      const add = getAddDelta(oTarget, modifiers);
      effOutput = ro * mul + add;
    }

    const cTarget = consumptionTargetFor(r);
    if (cTarget) {
      const mul = getMulFactor(cTarget, modifiers);
      const add = getAddDelta(cTarget, modifiers);
      effUpkeep = ru * mul + add;
    }

    // 分数累加器：把 carryIn 加进 raw net，向 0 截断取整为本 tick delta，剩下作为下次 carry
    const rawNet = effOutput - effUpkeep + carryIn;
    const intNet = Math.trunc(rawNet);
    const carryOut = rawNet - intNet;
    if (intNet !== 0) deltas[r] = intNet;
    if (Math.abs(carryOut) > 1e-9) fractionalCarry[r] = carryOut;
    detail[r] = { rawOutput: ro, rawUpkeep: ru, net: intNet };
  }

  return { deltas, detail, fractionalCarry };
}

/** 便利函数：把 ProductionTickResult.deltas 加到一个现有 ResourceBag（用于 dry-run / UI 预览）。 */
export function applyDeltasToBag(bag: ResourceBag, deltas: Partial<Record<ResourceId, number>>): ResourceBag {
  const out: ResourceBag = { ...bag };
  for (const r of RESOURCE_IDS) {
    const d = deltas[r];
    if (d === undefined || d === 0) continue;
    out[r] = (out[r] ?? 0) + d;
  }
  return out;
}
