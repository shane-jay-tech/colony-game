/**
 * 域一：经济/资源域逻辑（gameStore 拆分批 1/5 · c1023-01 外迁件）。
 *
 * 拆分约束（done/c1011-13 存档兼容面）：「拆逻辑不拆 GameState 容器；字段全集零增删改」——
 * 本模块只收**纯计算**（资源上限 / 钳制换算 / 每日速率快照 / 日增量应用循环），
 * 副作用（RESOURCES_CHANGED 事件发射、NaN 丢弃告警去重）仍归 GameStore 薄委托层。
 * 纯结构重构授权：下列常量与公式逐字搬运自 gameStore.ts，零数值行为变更。
 */
import { RESOURCE_IDS } from '../../data/resourceRegistry';
import type { ResourceId } from '../../data/resourceRegistry';
import type { BuildingInstance, ModifierInstance } from '../../data/schema';
import type { PopulationClasses } from '../../data/populationClass';
import { computeDailyRates, type DailyRateRow } from '../productionSystem';
import { buildingFulfillmentFactor } from '../classNeeds';
import { computeClassConsumption } from '../populationClassSystem';
import { getBuildingDef } from '../../data/buildingRegistry';

/** 资源存储上限基数（无仓廪时）。原 GameStore.RESOURCE_CAP_BASE 私有静态，随逻辑外迁（值不变）。 */
export const RESOURCE_CAP_BASE = 9999;

/**
 * 资源存储上限。BUG-B（2026-06-19）：接线 bld_granary 的"储量上限 +50%"死功能——
 * 每座 working 仓廪让存储类资源上限 ×1.5 线性叠加、封顶 ×3（防把"爆仓"重新架空）。
 * people 不走此路（其真实约束是住房上限 getHousingCap），仅用基数防溢出。
 * 原 GameStore.getResourceCap 主体，逐字搬运。
 */
export function resourceCapFor(id: ResourceId, buildings: readonly BuildingInstance[]): number {
  if (id === 'people') return RESOURCE_CAP_BASE;
  let granaries = 0;
  for (const b of buildings) {
    if (b.status === 'working' && b.defId === 'bld_granary') granaries++;
  }
  const mul = Math.min(3, 1 + granaries * 0.5);
  return Math.round(RESOURCE_CAP_BASE * mul);
}

/**
 * 库存写入前的钳制换算（原 setResourceClamped 内联式，抽出纯函数）。
 * 返回 null = NaN：调用方按既有策略丢弃并告警（c925-6c4b），不把 NaN 写进库存。
 * 旧式 `Math.min(cap, Math.max(0, Math.floor(NaN)))` 逐层透传 NaN ⇒ 顶栏从此恒显 NaN，
 * 且 `NaN >= 造价` 恒 false 会让玩家永久买不起该资源。
 * 溢出（±Infinity）**不走此闸**：Math.max/min 已把它稳定钳到 0 / 上限，属既有正确行为，
 * 由 priceBoundaryClamp.test.ts 的溢出例钉住（收窄口径见 result A2）。
 */
export function clampResourceValue(value: number, cap: number): number | null {
  if (Number.isNaN(value)) return null;
  return Math.min(cap, Math.max(0, Math.floor(value)));
}

/**
 * 日增量应用循环（原 GameStore.applyDayDeltas 主体，逐字搬运）：
 * 按 RESOURCE_IDS 稳定序遍历，undefined 增量跳过，其余交调用方注入的钳制写入器。
 * RESOURCES_CHANGED 事件仍由 GameStore 在循环后统一发射（与本模块无关）。
 */
export function applyResourceDeltas(
  resources: Partial<Record<ResourceId, number>>,
  deltas: Partial<Record<ResourceId, number>>,
  setClamped: (id: ResourceId, value: number) => void,
): void {
  for (const id of RESOURCE_IDS) {
    const delta = deltas[id];
    if (delta === undefined) continue;
    const current = resources[id] ?? 0;
    setClamped(id, current + delta);
  }
}

export interface DailyRatesInput {
  buildings: readonly BuildingInstance[];
  populationClasses: PopulationClasses;
  resources: Readonly<Partial<Record<ResourceId, number>>>;
  activeModifiers: readonly ModifierInstance[];
}

/**
 * P1 信息可视化：每日出入快照（纯读、无副作用）（原 GameStore.getDailyRates 主体，逐字搬运）。
 * 复用 computeDailyRates（与每日生产 tick 同源口径）+ 当前人口阶层口粮/衣甲/俸钱消耗。
 * 给 HUD 供需面板（ProductionPanel）用——生产面板即主战场（戴森球/纪元 1800 供需表启示）。
 */
export function dailyRatesSnapshot(input: DailyRatesInput): Partial<Record<ResourceId, DailyRateRow>> {
  const { buildings, populationClasses, resources, activeModifiers } = input;
  const factorFor = (defId: string): number => buildingFulfillmentFactor(
    getBuildingDef(defId)?.classType,
    buildings,
    resources,
  );
  const cls = computeClassConsumption(populationClasses);
  return computeDailyRates(
    buildings,
    getBuildingDef,
    activeModifiers,
    { grain: cls.totalGrain, cloth: cls.totalCloth, bronze: cls.totalBronze, gold: cls.totalGold },
    factorFor,
  );
}
