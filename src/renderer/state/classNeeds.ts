/**
 * A2 阶层需求环（Cities:Skylines 式服务覆盖 + ONI 士气）。
 *
 * 每阶层有一张需求表（建成相应建筑 / 持有相应资源）。满足度聚合为 0..1，
 * 再映射为 0.5..1 的「民足系数」，乘到建筑产出与人口增长率上——缺市集的工匠、
 * 缺营伍的兵士都会肉眼可见地低效。纯函数，无副作用。
 */
import type { BuildingInstance } from '../data/schema';
import type { PopulationClass, PopulationClasses } from '../data/populationClass';
import { POPULATION_CLASSES } from '../data/populationClass';
import type { ResourceId } from '../data/resourceRegistry';

export interface ClassNeed {
  id: string;
  /** 玩家可读需求名（半文白，禁偏字） */
  name: string;
  /** 满足需求所需的建筑（status === 'working'） */
  buildingDefId?: string;
  /** 满足需求所需的资源余量（≥ resourceAmount） */
  resourceId?: ResourceId;
  resourceAmount?: number;
}

export const CLASS_NEEDS: Record<PopulationClass, readonly ClassNeed[]> = {
  farmer: [
    { id: 'shelter', name: '安居', buildingDefId: 'bld_house' },
    { id: 'food', name: '足食', resourceId: 'grain', resourceAmount: 1 },
  ],
  worker: [
    { id: 'shelter', name: '安居', buildingDefId: 'bld_house' },
    { id: 'market', name: '市集', buildingDefId: 'bld_market' },
    { id: 'food', name: '足食', resourceId: 'grain', resourceAmount: 1 },
  ],
  soldier: [
    { id: 'shelter', name: '安居', buildingDefId: 'bld_house' },
    { id: 'barracks', name: '营伍', buildingDefId: 'bld_barracks' },
    { id: 'food', name: '足食', resourceId: 'grain', resourceAmount: 1 },
  ],
  scholar: [
    { id: 'shelter', name: '安居', buildingDefId: 'bld_house' },
    { id: 'school', name: '教化', buildingDefId: 'bld_academy' },
    { id: 'rites', name: '礼器', resourceId: 'rite', resourceAmount: 1 },
  ],
};

export interface ClassNeedState {
  /** 0..1 需求满足比 */
  metRatio: number;
  /** 0.5..1 产出/增长系数 */
  factor: number;
  /** 未满足的需求名 */
  unmet: string[];
}

/** 满足比 → 系数：0 满足给 0.5 保底，全满足给 1.0（线性）。 */
export function fulfillmentFactor(metRatio: number): number {
  const r = Math.max(0, Math.min(1, metRatio));
  return 0.5 + 0.5 * r;
}

export function computeClassNeedState(
  classId: PopulationClass,
  buildings: readonly BuildingInstance[],
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): ClassNeedState {
  const needs = CLASS_NEEDS[classId];
  const workingIds = new Set(
    buildings.filter(b => b.status === 'working').map(b => b.defId),
  );
  const unmet: string[] = [];
  for (const need of needs) {
    const buildingOk = need.buildingDefId === undefined || workingIds.has(need.buildingDefId);
    const resourceOk = need.resourceId === undefined
      || (resources[need.resourceId] ?? 0) >= (need.resourceAmount ?? 0);
    if (!buildingOk || !resourceOk) unmet.push(need.name);
  }
  const met = needs.length - unmet.length;
  const metRatio = needs.length === 0 ? 1 : met / needs.length;
  return { metRatio, factor: fulfillmentFactor(metRatio), unmet };
}

/** 按各阶层人数加权平均的全国民足系数（无人时 = 1，不给开局惩罚）。 */
export function populationFulfillment(
  pop: PopulationClasses,
  buildings: readonly BuildingInstance[],
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): number {
  let weight = 0;
  let sum = 0;
  for (const cls of POPULATION_CLASSES) {
    const n = pop[cls];
    if (n <= 0) continue;
    sum += computeClassNeedState(cls, buildings, resources).factor * n;
    weight += n;
  }
  return weight === 0 ? 1 : sum / weight;
}

/** 单栋建筑的民足系数（按其阶层；无阶层按农夫计）。 */
export function buildingFulfillmentFactor(
  classType: PopulationClass | undefined,
  buildings: readonly BuildingInstance[],
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): number {
  return computeClassNeedState(classType ?? 'farmer', buildings, resources).factor;
}
