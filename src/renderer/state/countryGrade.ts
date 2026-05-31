/**
 * 国格判定（纯函数，无副作用）——供 gameStore 每日 tick 调用。
 *
 * 升级语义：从当前级 +1 起逐级检查，**综合门槛（人口+经济）AND 标志成就**都满足才进位；
 * 一次调用最多升 1 级（保证每级解锁感 + Toast 不连跳）；绝不降级（降级由低谷危机负责）。
 */

import type { ResourceId } from '../data/resourceRegistry';
import {
  COUNTRY_GRADES,
  MAX_GRADE,
  type GradeThreshold,
  type SignatureAchievement,
} from '../data/countryGrades';

export interface GradeInput {
  population: number;
  resources: Readonly<Partial<Record<ResourceId, number>>>;
  /** status==='working' 的建筑 defId */
  builtDefIds: ReadonlySet<string>;
  adoptedPolicyIds: ReadonlySet<string>;
  completedDecreeIds: ReadonlySet<string>;
  /** 邦交语义旗标，如 'all_npc_friendly' */
  diplomacyFlags: ReadonlySet<string>;
}

/** 综合门槛：人口必达 + 列出的各资源必达；未列出的资源项不要求。 */
export function meetsThreshold(t: GradeThreshold, input: GradeInput): boolean {
  if (input.population < t.population) return false;
  const res = input.resources;
  const checks: [keyof GradeThreshold, ResourceId][] = [
    ['gold', 'gold'],
    ['cloth', 'cloth'],
    ['rite', 'rite'],
    ['bronze', 'bronze'],
  ];
  for (const [key, rid] of checks) {
    const need = t[key];
    if (need !== undefined && (res[rid] ?? 0) < need) return false;
  }
  return true;
}

/** 标志成就：null 视为已满足；否则按 kind 查对应集合是否含 id。 */
export function meetsSignature(s: SignatureAchievement | null, input: GradeInput): boolean {
  if (s === null) return true;
  switch (s.kind) {
    case 'building': return input.builtDefIds.has(s.id);
    case 'policy': return input.adoptedPolicyIds.has(s.id);
    case 'decree': return input.completedDecreeIds.has(s.id);
    case 'diplomacy': return input.diplomacyFlags.has(s.id);
    default: return false;
  }
}

/** 单级达成 = 门槛 AND 标志。 */
function meetsGrade(level: number, input: GradeInput): boolean {
  const def = COUNTRY_GRADES[level];
  if (!def) return false;
  return meetsThreshold(def.threshold, input) && meetsSignature(def.signature, input);
}

/**
 * 返回"应处级别"：从 currentGrade+1 起检查下一级是否达成，达成则 +1（一次最多 +1）；
 * 否则维持 currentGrade。绝不返回低于 currentGrade 的值。
 */
export function evaluateGrade(currentGrade: number, input: GradeInput): number {
  const cur = Math.max(0, Math.min(MAX_GRADE, Math.floor(currentGrade)));
  const next = cur + 1;
  if (next > MAX_GRADE) return cur;
  return meetsGrade(next, input) ? next : cur;
}
