/**
 * 朝堂（国策/朝令）UI 共享格式化 helper。
 * 从 CourtPanel 抽出，供 PolicyTreePanel 复用（Phase 6 退休 CourtPanel 后此处为唯一源）。
 */

import type { ResourceCost, ResourceId } from '../data/resourceRegistry';

export const RESOURCE_LABEL: Record<ResourceId, string> = {
  grain: '粮', wood: '木', stone: '石', gold: '钱',
  people: '民', cloth: '布', bronze: '铜', rite: '礼',
  hemp: '麻', tin: '锡',
};

/** 把 ResourceCost 拼成「粮20 · 木15」式字符串；全免费显示「免费」。 */
export function formatCost(cost: ResourceCost): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(cost)) {
    if (v && v > 0) parts.push(`${RESOURCE_LABEL[k as ResourceId] ?? k}${v}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '免费';
}

/** 采纳国策失败的人话提示（半文半白）。 */
export function failPolicyMsg(result: { reason: string; missingPrereqs?: string[]; blockingExclusives?: string[] }): string {
  switch (result.reason) {
    case 'insufficient_resources': return '资源不足，无法采纳此策';
    case 'already_adopted': return '此策已在国，无须再议';
    case 'prerequisites_unmet':
      return result.missingPrereqs && result.missingPrereqs.length > 0
        ? `尚需先行 ${result.missingPrereqs.length} 项前置之策`
        : '尚需先行其他国策';
    case 'mutually_excluded':
      return '已采纳互斥之策，此路不可兼行';
    case 'unknown_policy': return '未知国策（数据缺失）';
    default: return '无法采纳此策';
  }
}

/** 颁布朝令失败的人话提示（半文半白）。 */
export function failDecreeMsg(result: { reason: string }): string {
  switch (result.reason) {
    case 'insufficient_resources': return '资源不足，无以颁此朝令';
    case 'already_active': return '此令已在颁行';
    case 'unlock_condition_unmet': return '尚未满足颁令条件';
    case 'chain_locked': return '前置朝令未成，此令尚锁';
    case 'unknown_decree': return '未知朝令（数据缺失）';
    default: return '无法颁此朝令';
  }
}
