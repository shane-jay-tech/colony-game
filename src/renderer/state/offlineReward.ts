// c1028-04（OFFLINE_REWARD 甲案接线，D1025-nod #6 放行）：离线收益结算器（纯函数面）。
// 数值红线：OFFLINE_REWARD 四常量逐字零改动（data/offline.ts）——本件只让既有常量生效。
// 语义：读档/回归时按离线时长结算快照资源收益；人口/科技不增长（不在快照集，天然零结算）；
// 仅 economy/population 类 modifier 参与产量聚合；系统时钟回拨（时长<0）零结算静默通过。
import { OFFLINE_REWARD } from '../data/offline';
import { getBuildingDef } from '../data/buildingRegistry';
import type { BuildingDef, BuildingInstance, ModifierInstance } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';
import { computeDailyRates } from './productionSystem';

export interface OfflineSettlement {
  /** 计入结算的离线时长（小时，已按 maxOfflineHours 封顶；零结算时为 0）。 */
  hours: number;
  /** 结算增量（已向下取整；仅含 snapshotResources 内、产量为正的资源）。 */
  deltas: Partial<Record<ResourceId, number>>;
}

export function settleOfflineReward(
  now: number,
  lastSeen: number,
  buildings: readonly BuildingInstance[],
  modifiers: readonly ModifierInstance[],
  defLookup: (defId: string) => BuildingDef | undefined = getBuildingDef,
): OfflineSettlement {
  if (lastSeen <= 0) {
    // 新局（lastSeenTimestamp=0）没有"上次在线"锚点 ⇒ 无从谈离线，零结算。
    return { hours: 0, deltas: {} };
  }
  const elapsedMs = now - lastSeen;
  if (elapsedMs <= 0) {
    // 系统时钟回拨 ⇒ 时长为负，零结算静默通过（不做负收益、不报错）。
    return { hours: 0, deltas: {} };
  }
  const hours = Math.min(elapsedMs / 3_600_000, OFFLINE_REWARD.maxOfflineHours);
  const filtered = modifiers.filter((m) =>
    (OFFLINE_REWARD.applicableModifiers as readonly string[]).includes(m.category),
  );
  // 离线期人口冻结 ⇒ 人口消耗置零；按"日产量"口径（不含维护/吃粮扣减）结算。
  const rates = computeDailyRates(
    buildings,
    defLookup,
    filtered,
    { grain: 0, cloth: 0, bronze: 0, gold: 0 },
  );
  const days = (hours / 24) * OFFLINE_REWARD.decayFactor;
  const deltas: Partial<Record<ResourceId, number>> = {};
  for (const r of OFFLINE_REWARD.snapshotResources) {
    const produced = rates[r]?.produced ?? 0;
    if (produced > 0) {
      // round 而非 floor：短离线（2h）在低产量下 floor 会归零，学生看不到任何反馈；
      // 四舍五入让 ≥半单位都可见（舍入策略属实现细节，四常量红线不受影响）。
      const amount = Math.round(produced * days);
      if (amount > 0) deltas[r] = amount;
    }
  }
  return { hours, deltas };
}
