/**
 * 域四：建设/生产域逻辑（gameStore 拆分批 4/5 · c1023-04 外迁件）。
 *
 * 拆分约束（done/c1011-13 存档兼容面）：「拆逻辑不拆 GameState 容器；字段全集零增删改」——
 * 本模块只收解锁判定 / 升级目标归一 / 前置核查 / 费用核算 / 拆除返还 / 可割让筛选 /
 * 工期推进 / 生产 tick 组装等**纯计算**；资源扣减（setResourceClamped）、招募、事件发射
 * 仍归 GameStore（薄委托）。公式逐字搬运，零数值行为变更。
 */
import { RESOURCE_IDS } from '../../data/resourceRegistry';
import type { ResourceId } from '../../data/resourceRegistry';
import type { BuildingDef, BuildingInstance, ModifierInstance, PolicyNode } from '../../data/schema';
import { getBuildingDef } from '../../data/buildingRegistry';
import { applyModifiers } from '../modifierAggregator';
import { gradeDefAt } from '../../data/countryGrades';
import { computeProductionTick, type ProductionTickResult } from '../productionSystem';
import { buildingFulfillmentFactor } from '../classNeeds';

/** 解锁判定输入快照（调用方从 state 组装；与 isBuildingUnlocked 原取数一致）。 */
export interface UnlockInput {
  grade: number;
  adoptedPolicyIds: ReadonlySet<string>;
  builtWorkingDefIds: ReadonlySet<string>;
  completedDecreeIds: ReadonlySet<string>;
}

/**
 * 分阶段：建筑是否在当前阶段已解锁（原 isBuildingUnlocked 主体，逐字搬运）。
 * 条件一：tier 对应国格门槛（T1→grade0, T2→grade1, T3→grade2, T4→grade3）
 * 条件二：upgradeRequires 全满足（国策/前置建筑/朝令）。
 */
export function buildingUnlocked(input: UnlockInput, def: BuildingDef): boolean {
  const requiredGrade = Math.max(0, def.tier - 1);
  if (input.grade < requiredGrade) return false;
  if (def.upgradeRequires.length === 0) return true;
  return def.upgradeRequires.every(req =>
    input.adoptedPolicyIds.has(req) || input.builtWorkingDefIds.has(req) || input.completedDecreeIds.has(req));
}

/**
 * 建筑解锁详情（供 BuildPanel 区分展示，解决"国策采纳了但建筑没出现、玩家以为没生效"）：
 *  - buildable：可建（= buildingUnlocked true）
 *  - grade_locked：前置(国策/前置建筑/朝令)已满足，但国格不够 → 灰显 + "需晋X"提示
 *  - prereq_locked：前置未满足 → 仍隐藏（不剧透后期内容）
 * （原 getBuildingUnlockInfo 主体，逐字搬运。）
 */
export function buildingUnlockInfo(input: UnlockInput, def: BuildingDef): { state: 'buildable' | 'grade_locked' | 'prereq_locked'; reason: string } {
  const requiredGrade = Math.max(0, def.tier - 1);
  const prereqMet = def.upgradeRequires.length === 0
    || def.upgradeRequires.every(req =>
      input.adoptedPolicyIds.has(req) || input.builtWorkingDefIds.has(req) || input.completedDecreeIds.has(req));
  if (!prereqMet) return { state: 'prereq_locked', reason: '' };
  if (input.grade < requiredGrade) {
    const gname = gradeDefAt(requiredGrade)?.name ?? `国格${requiredGrade}`;
    return { state: 'grade_locked', reason: `需晋「${gname}」` };
  }
  return { state: 'buildable', reason: '' };
}

/** 分阶段：国策是否已解锁（国格门槛 + prerequisites 全部已采纳）（原 isPolicyUnlocked 主体）。 */
export function policyUnlocked(input: UnlockInput, def: PolicyNode): boolean {
  const requiredGrade = Math.max(0, def.tier - 1);
  if (input.grade < requiredGrade) return false;
  if (def.prerequisites.length === 0) return true;
  return def.prerequisites.every(p => input.adoptedPolicyIds.has(p));
}

/**
 * c1012-01 案a：upgradesTo 数组化——取首目标（现数据各建筑 ≤1 目标）。
 * 旧标量形态（外部内容/旧夹具）在此归一为单元素数组——读写两侧兼容（原 upgradeBuilding 内联式）。
 */
export function normalizeUpgradeTargets(def: BuildingDef): string[] {
  const rawTargets = def.upgradesTo;
  return rawTargets == null ? [] : Array.isArray(rawTargets) ? rawTargets : [rawTargets];
}

/**
 * 费用预检：people 之外的任一资源库存不足 → true（原 upgradeBuilding 预检循环，fail-fast 同序）。
 * people 不参检（占用制劳力，升级不消耗人口）。
 */
export function costUnaffordable(
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  cost: Partial<Record<ResourceId, number>> | undefined,
): boolean {
  if (!cost) return false;
  for (const id of RESOURCE_IDS) {
    if (id === 'people') continue; // 民=占用制劳力，升级不消耗人口
    const need = cost[id];
    if (need === undefined || need === 0) continue;
    if ((resources[id] ?? 0) < need) return true;
  }
  return false;
}

/**
 * 费用扣减：逐项经注入的钳制写入器扣库存并累计 deltas（原 placeBuilding/upgradeBuilding 扣费循环）。
 * RESOURCES_CHANGED 事件仍归 GameStore 统一发射。
 */
export function chargeBuildingCost(
  resources: Partial<Record<ResourceId, number>>,
  cost: Partial<Record<ResourceId, number>> | undefined,
  setClamped: (id: ResourceId, value: number) => void,
): Partial<Record<ResourceId, number>> {
  const deltas: Partial<Record<ResourceId, number>> = {};
  if (!cost) return deltas;
  for (const id of RESOURCE_IDS) {
    if (id === 'people') continue; // 民=占用制劳力，建造/升级不消耗人口
    const amount = cost[id];
    if (amount === undefined || amount === 0) continue;
    const current = resources[id] ?? 0;
    setClamped(id, current - amount);
    deltas[id] = -amount;
  }
  return deltas;
}

/**
 * 拆除返还：50% 非民材料（原 removeBuilding 返还循环，逐字搬运；Math.floor 半价，≤0 跳过）。
 * BUILDING_REMOVED / RESOURCES_CHANGED 事件与库存写入仍归 GameStore。
 */
export function buildingRefundDeltas(cost: Partial<Record<ResourceId, number>> | undefined): Partial<Record<ResourceId, number>> {
  const deltas: Partial<Record<ResourceId, number>> = {};
  if (!cost) return deltas;
  for (const id of RESOURCE_IDS) {
    if (id === 'people') continue; // 占用制：民没被消耗，不返还
    const amount = cost[id];
    if (!amount || amount <= 0) continue;
    const refund = Math.floor(amount * 0.5);
    if (refund <= 0) continue;
    deltas[id] = refund;
  }
  return deltas;
}

/** 核心建筑（不可被割让）：基本民生（原 GameStore.CORE_BUILDING_IDS 私有静态，随逻辑外迁，值不变）。 */
export const CORE_BUILDING_IDS: ReadonlySet<string> = new Set(['bld_farm', 'bld_well', 'bld_house']);

/** 可被割让的 working 非核心建筑（最近建的在数组末尾）（原 cedableBuildings 主体）。 */
export function cedableBuildings(buildings: readonly BuildingInstance[]): BuildingInstance[] {
  return buildings.filter(b => b.status === 'working' && !CORE_BUILDING_IDS.has(b.defId));
}

/** A-3：季节影响建筑工期乘数（春 +20% / 冬 -33%）——仅有在建时才算（原 runConstructionPhase 头段）。 */
export function constructionSpeedMultiplier(
  buildings: readonly BuildingInstance[],
  activeModifiers: readonly ModifierInstance[],
): number {
  const hasConstructing = buildings.some(b => b.status === 'constructing');
  return hasConstructing
    ? applyModifiers(1, 'building_construction_speed', activeModifiers)
    : 1;
}

export interface ConstructionPhaseIo {
  /** 新建完工（store：emit BUILDING_COMPLETED）。 */
  onCompleted(inst: BuildingInstance): void;
  /** 升级完工收尾（store：defId/tier 切换写回 + 阶层招募 + emit BUILDING_UPGRADED）。 */
  finishUpgrade(inst: BuildingInstance, targetDef: BuildingDef): void;
}

/**
 * 工期推进（原 runConstructionPhase 主体，逐字搬运）：constructing 建筑按乘数累加进度，
 * ≥99.999 浮点闸门兜底（DeepSeek findings）；ct<=0 视作 instant 当 tick 完工。
 * 进度数字与状态翻转在本模块（无副作用），完工收尾经 io 回调（emit/招募归 store）。
 */
export function advanceConstruction(buildings: readonly BuildingInstance[], speedMul: number, io: ConstructionPhaseIo): void {
  for (const b of buildings) {
    if (b.status !== 'constructing') continue;
    const isUpgrade = !!b.upgradingTo;
    // 升级用 target def 的 upgradeTime；新建用 def.constructionTime
    const targetDef = isUpgrade ? getBuildingDef(b.upgradingTo!) : getBuildingDef(b.defId);
    if (!targetDef) continue;
    const time = isUpgrade ? (targetDef.upgradeTime ?? 1) : targetDef.constructionTime;
    // ct<=0 means instant build (degenerate static-content case); complete in this tick
    if (time <= 0) {
      b.constructionProgress = 100;
      b.status = 'working';
      if (isUpgrade) io.finishUpgrade(b, targetDef);
      else io.onCompleted(b);
      continue;
    }
    b.constructionProgress += (100 / time) * speedMul;
    // 浮点累加可能停在 99.9999 而少建一天；以 99.999 为闸门兜底（DeepSeek findings）
    if (b.constructionProgress >= 99.999) {
      b.constructionProgress = 100;
      b.status = 'working';
      if (isUpgrade) io.finishUpgrade(b, targetDef);
      else io.onCompleted(b);
    }
  }
}

/**
 * 当日生产 tick 组装（原 runProductionTick 主体）：每栋建筑按自己阶层的需求满足度打折
 * （A2 缺市集的工匠低效），复用 computeProductionTick（与每日速率快照同源口径）。
 * 残差写回 / applyDayDeltas / PRODUCTION_TICK 事件仍归 GameStore。
 */
export function productionTick(
  buildings: readonly BuildingInstance[],
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  activeModifiers: readonly ModifierInstance[],
  carry: Partial<Record<ResourceId, number>>,
): ProductionTickResult {
  const factorFor = (defId: string): number => buildingFulfillmentFactor(
    getBuildingDef(defId)?.classType,
    buildings,
    resources,
  );
  return computeProductionTick(buildings, getBuildingDef, activeModifiers, carry, factorFor);
}
