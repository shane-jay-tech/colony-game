// snapshotDigest（c1004-08 设计稿官方 API 落码，l1007-13 施工）
// 确定性比对摘要（防漂移）：同 seed 同输入 ⇒ 同指纹。与 c927-22 防篡改校验和用途不同。
// 剔除墙钟/瞬态键三枚：savedAt/lastSeenTimestamp/paused（逐键理由见
// docs/insights/colony-snapshot-digest-design-20261006.md §二；lastTickTimestamp 死字段
// 已随 c1023-14 删除，剔出名单——字段本体不在 state 即无变异面）。
// canonicalJson = 键排序递归 + 数组保序（杜绝 JSON.stringify 键序抖动）。
// SHA-256 走 WebCrypto crypto.subtle（主/渲染进程双可用，零新依赖）。

import type { GameState } from './gameStore';

export const DIGEST_EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  'savedAt',
  'lastSeenTimestamp',
  'paused',
  // 瞬态计数族（c1004-05 已登记 saveLoad 零登记的 private 字段不在 state 内，无需剔；
  // grainNegativeDays 属**持久游戏态**（断粮计数），保留参与摘要）
]);

/** 递归剔除集合内键；数组保序、逐元素处理。 */
export function deepOmit(value: unknown, excluded: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => deepOmit(v, excluded));
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      if (excluded.has(k)) continue;
      out[k] = deepOmit((value as Record<string, unknown>)[k], excluded);
    }
    return out;
  }
  return value;
}

/** canonical JSON：键排序递归（deepOmit 后键已序，此处直接 stringify 保数组序）。 */
export function canonicalJson(state: unknown): string {
  return JSON.stringify(state);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** 官方摘要入口：GameState → 剔除墙钟键 → canonical JSON → SHA-256 hex。 */
export async function snapshotDigest(state: GameState): Promise<string> {
  const filtered = deepOmit(state, DIGEST_EXCLUDED_KEYS);
  return sha256(canonicalJson(filtered));
}
