/**
 * 供应链提示（P1 信息可视化 · 需求因果链）——纯函数、无副作用。
 *
 * 玩家看到「布 -3/日」后该知道怎么办：找哪些建筑产布、它现在能不能建、
 * 还差什么（国格/国策）。给 ProductionPanel 的补阙区提供数据。
 */

import type { BuildingDef } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';

/** 产某资源的一栋建筑。 */
export interface ProducerEntry {
  defId: string;
  name: string;
  /** 单栋日产（取该资源的第一条 output，供「建几栋」的直觉） */
  perDay: number;
}

/**
 * 找出所有产出指定资源的建筑（按单栋日产降序，大产者优先推荐）。
 */
export function producersFor(resource: ResourceId, defs: readonly BuildingDef[]): ProducerEntry[] {
  const out: ProducerEntry[] = [];
  for (const d of defs) {
    const hit = d.output.find(o => o.resource === resource);
    if (!hit) continue;
    out.push({ defId: d.id, name: d.name, perDay: hit.perDay });
  }
  out.sort((a, b) => b.perDay - a.perDay);
  return out;
}
