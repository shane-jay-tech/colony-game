# snapshotDigest 官方 API 设计稿（c1004-08，2026-10-06，设计稿零落码）

- 承 6938 L2＋da6f#3。差异注：c927-22 是**存档完整性校验和**（防篡改，三落点），本单是**确定性比对摘要**（防漂移，同 seed 同输入应得同指纹）——用途不同、算法可共用 SHA-256 但剔除键集不同。

## 一、现值键差复核（信封/state 三墙钟键）

| 键 | 写点 | 现值语义 |
|---|---|---|
| savedAt | saveLoad.ts:310（serialize 时 Date.now()） | 每次存档必变——**摘要必剔** |
| lastSeenTimestamp | :324 透传＋:849 setLastSeenNow | 每次保存必变——**必剔** |
| lastTickTimestamp | :481 反序列化归 0（serialize 不带） | 信封侧不出现；state 侧若现值非 0 属内存瞬态——**必剔**（防御内存灌入形态） |
| paused | :480 反序列化恒 false；state 内可 true | 会话瞬态——**必剔**（暂停与否不该改指纹） |

## 二、snapshotDigest API 设计

```ts
// src/renderer/state/snapshotDigest.ts（新公共面，落码另派）
export const DIGEST_EXCLUDED_KEYS: ReadonlySet<string> = new Set([
  'savedAt', 'lastSeenTimestamp', 'lastTickTimestamp', 'paused',
  // 瞬态计数族（c1004-05 已登记 saveLoad 零登记的 private 字段不在 state 内，无需剔；
  // grainNegativeDays 属**持久游戏态**（断粮计数），保留参与摘要）
]);

export function snapshotDigest(state: GameState): string {
  const filtered = deepOmit(state, DIGEST_EXCLUDED_KEYS);
  return sha256(canonicalJson(filtered));   // canonicalJson = 键排序递归（防键序抖动）
}
```

- **逐键理由**：savedAt/lastSeen＝墙钟必变体；lastTick＝反序列化归零的瞬态；paused＝UI 瞬态。breathing/historianIdleDays 系 **private 类字段不在 GameState**（c1004-05 已证），digest 天然不触及。
- **哈希选型**：SHA-256（WebCrypto `crypto.subtle.digest`，主进程/渲染进程双可用，零新依赖；canonicalJson 用键排序+数组保序，杜绝 JSON.stringify 的键序抖动）。

## 三、与 seedSnapshotDeterminism 的衔接

- 现件实测 **12 cases**（任务书「43 例」与盘面不符——已按实数登记，差值成因=矿源口径或另一分 variant 未合入，不阻塞本设计）。
- 12 例中「🔴 tickDay 全程不调用 Date.now」「墙钟前进 30 天不影响模拟」两例与 digest **同哲学互补**：它们证明模拟面对墙钟无关，digest 提供一个**单值指纹**让该性质可被一行断言（`digest(before)===digest(after)`）。
- **升级路径**：新件 tests/test_snapshot_digest.test.ts 三例（①同 seed 同输入 digest 相等；②剔除键单独变异 ⇒ digest 不变【剔除非厘剔判别力】；③实质字段变异 ⇒ digest 变【防恒等假实现】）——**不改造既有 12 例**（它们测 tickDay 面本就稳定），digest 例作新增第三层。

## 四、零落码自证

设计稿；新公共面（snapshotDigest.ts）落码属另派。
