// snapshotDigest 三例（c1004-08 设计稿 §二升级路径逐字落地）：
// ①同 seed 同输入 digest 相等；②剔除键单独变异 ⇒ digest 不变（剔除非厘剔）；
// ③实质字段变异 ⇒ digest 变（防恒等假实现）。
import { describe, expect, it } from 'vitest';
import { deepOmit, snapshotDigest, DIGEST_EXCLUDED_KEYS } from '../snapshotDigest';

function makeState(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    rngSeed: 7,
    currentDay: 42,
    resources: { wood: 100, grain: 55 },
    buildings: [
      { defId: 'bld_farm', position: { x: 1, y: 2 }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] },
    ],
    policies: ['pol_a'],
    activeModifiers: [],
    savedAt: 1_000,
    lastSeenTimestamp: 2_000,
    paused: false,
    ...over,
  };
}

describe('snapshotDigest', () => {
  it('①同 seed 同输入 → digest 相等（键序抖动免疫）', async () => {
    const a = makeState();
    const b = makeState();
    // 故意打乱 b 的键插入顺序（JSON.stringify 键序抖动面）
    const reordered = Object.fromEntries(Object.entries(b).reverse());
    expect(await snapshotDigest(a as never)).toBe(await snapshotDigest(reordered as never));
  });

  it('②剔除键单独变异 ⇒ digest 不变（savedAt/lastSeen/paused 三键逐一；c1023-14 起 lastTick 出列）', async () => {
    const base = await snapshotDigest(makeState() as never);
    for (const k of DIGEST_EXCLUDED_KEYS) {
      const mutated = makeState({ [k]: k === 'paused' ? true : 999_999_999 });
      expect(await snapshotDigest(mutated as never)).toBe(base), `剔除键 ${k} 变异却改变了 digest`;
    }
  });

  it('③实质字段变异 ⇒ digest 变（防恒等假实现）', async () => {
    const base = await snapshotDigest(makeState() as never);
    const mutated = makeState({ currentDay: 43 });
    expect(await snapshotDigest(mutated as never)).not.toBe(base);
    const mutatedRes = makeState({ resources: { wood: 101, grain: 55 } });
    expect(await snapshotDigest(mutatedRes as never)).not.toBe(base);
  });

  it('deepOmit 直接验证：剔除键深度清除（含嵌套），数组保序', () => {
    const out = deepOmit(
      { paused: true, keep: 1, nest: { savedAt: 2, inner: [{ lastSeenTimestamp: 3, ok: 4 }] } },
      DIGEST_EXCLUDED_KEYS,
    );
    expect(JSON.stringify(out)).toBe(JSON.stringify({ keep: 1, nest: { inner: [{ ok: 4 }] } }));
  });
});
