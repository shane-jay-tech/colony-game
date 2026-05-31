/**
 * PolicySystem — 玩家"采纳国策"动作。
 *
 * 操作语义（v0.7）：
 *   - 检查：所有 prerequisites 都已 adopted ✓ 资源足够付 cost ✓
 *   - 扣资源、push 进 state.policies（设置 adopted=true，不存在则新增）
 *   - 把 policy.effects 实例化为永久 ModifierInstance（remainingDays = -1）
 *   - 不可撤销 — Slice F 阶段简化；Slice F.2/G 再加废止/降级
 *
 * 失败原因（与 PlacementResult 风格保持一致）：
 *   - 'unknown_policy' — 传入的 id 在 POLICIES 里找不到
 *   - 'already_adopted'
 *   - 'prerequisites_unmet' — 含未采纳的前置
 *   - 'insufficient_resources' — cost 付不起
 */

import type { PolicyNode, ModifierInstance } from '../data/schema';
import type { ResourceCost, ResourceId } from '../data/resourceRegistry';
import { RESOURCE_IDS, canAfford } from '../data/resourceRegistry';
import { effectsToModifierInstance } from './modifierAggregator';

export type AdoptPolicyFailReason =
  | 'unknown_policy'
  | 'already_adopted'
  | 'prerequisites_unmet'
  | 'mutually_excluded'
  | 'insufficient_resources';

export type AdoptPolicyResult =
  | { ok: true; modifier: ModifierInstance; deltas: Partial<Record<ResourceId, number>> }
  | {
      ok: false;
      reason: AdoptPolicyFailReason;
      missingPrereqs?: string[];
      blockingExclusives?: string[];
    };

export interface PolicyAdoptedRecord {
  id: string;
  adopted: boolean;
}

/**
 * 校验 + 计算"采纳"会产生哪些 state 变化。pure function — 不修改输入；GameStore 拿到
 * result 后自己做：扣资源 / push policy / addModifier。
 *
 * @param policy 静态 PolicyNode 定义（来自 POLICIES）
 * @param adopted 当前已采纳的 policy id 集合（O(1) 查询）
 * @param resources 当前资源 bag
 */
export function tryAdoptPolicy(
  policy: PolicyNode,
  adopted: ReadonlySet<string>,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): AdoptPolicyResult {
  if (adopted.has(policy.id)) {
    return { ok: false, reason: 'already_adopted' };
  }

  // v1.0 #1：互斥兄弟检查 —— 任一已采纳即锁本条（HOI4 国策"二选一"分歧）
  if (policy.mutuallyExclusive && policy.mutuallyExclusive.length > 0) {
    const blocking: string[] = [];
    for (const ex of policy.mutuallyExclusive) {
      if (adopted.has(ex)) blocking.push(ex);
    }
    if (blocking.length > 0) {
      return { ok: false, reason: 'mutually_excluded', blockingExclusives: blocking };
    }
  }

  const missing: string[] = [];
  for (const pre of policy.prerequisites) {
    if (!adopted.has(pre)) missing.push(pre);
  }
  if (missing.length > 0) {
    return { ok: false, reason: 'prerequisites_unmet', missingPrereqs: missing };
  }

  if (!canAfford(resources, policy.cost)) {
    return { ok: false, reason: 'insufficient_resources' };
  }

  const deltas = costToDeltas(policy.cost);
  const modifier = effectsToModifierInstance({
    id: `pol_modifier_${policy.id}`,
    name: policy.name,
    category: policyBranchToCategory(policy),
    effects: policy.effects,
    remainingDays: -1, // 永久
    description: policy.description,
    descPlain: policy.descPlain,
    stackable: false,
  });

  return { ok: true, modifier, deltas };
}

function costToDeltas(cost: ResourceCost): Partial<Record<ResourceId, number>> {
  const deltas: Partial<Record<ResourceId, number>> = {};
  for (const id of RESOURCE_IDS) {
    const v = cost[id];
    if (v !== undefined && v > 0) deltas[id] = -v;
  }
  return deltas;
}

/**
 * 把 PolicyNode.branch（中文）映射到 ModifierCategory（英文）。
 * 不是一一对应（branch 6 个，category 7 个），按主旨：
 *   农桑/工坊 → economy；保甲 → military；礼制/学问 → culture；外交 → diplomacy
 */
function policyBranchToCategory(policy: PolicyNode): ModifierInstance['category'] {
  switch (policy.branch) {
    case '农桑': return 'economy';
    case '工坊': return 'economy';
    case '礼制': return 'culture';
    case '保甲': return 'military';
    case '外交': return 'diplomacy';
    case '学问': return 'tech';
    // 防御：存档反序列化绕过类型系统时若 branch 损坏为非法值，
    // 兜底为 economy 而不是 undefined（DeepSeek findings #2 Slice F defer）
    default: return 'economy';
  }
}

/**
 * 检查 policy 是否对当前玩家"可见"（前置全部满足）。UI 用来显示哪些 policy 可点击。
 * 不检查 cost — affordability 由 UI 单独算（这样 policy 能显示但灰掉）。
 */
export function isPolicyAvailable(policy: PolicyNode, adopted: ReadonlySet<string>): boolean {
  if (adopted.has(policy.id)) return false;
  for (const pre of policy.prerequisites) {
    if (!adopted.has(pre)) return false;
  }
  return true;
}
