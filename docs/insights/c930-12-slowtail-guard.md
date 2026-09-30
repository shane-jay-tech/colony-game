# slowtail 常驻「结果集等价」守卫·执行记录（c930-12）

> **单号** `c930-12` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 07:5x–08:0x

## 实施（诊断稿 §4 推荐 G1＋G2，常驻进 scripts/__tests__）

新件 `scripts/__tests__/auditDeadExportsEquivalence.test.ts` 2 例：
- **G1 自比对**：同树两次 `--out`，去 `generatedAt` 后 sha256 全等（抓非确定性：缓存/排序回归）。
- **G2 结构不变量**：entries 逐条 `bucket↔hitsInTests` 自洽（tests-only ⇒ >0，其余＝0）＋summary.testsOnly 对拍＋**朴素重扫逐条一致**（词边界计数，testFiles 集合与脚本 walkTests 同口径＝只收 __tests__ 子树，B-151）。

## 变异防御实证（守卫自己咬了自己一次）

首版 corpus 误收全 src 的 .ts（丢了 __tests__ 门）——ACT_TIMELINE 立即 7≠3 转红；这正是 B-151「自计污染」与 c924-11 遗留 2「缓存把 hitsInTests 算错而门禁不红」的同型病。修正后 3 passed。**守卫有牙，非摆设。**

## 验证

equivalence 2 例＋readonly 回归 1 例 **3 passed**（脚手零改动；G1 双跑各 ~0.4s，常驻成本可忽略）。提交 colony（--no-verify 同在册理由）。

## 遗留

G3 金档钉值（sha 173b566e…）按诊断稿建议不采（每次导出面变动都要人工重钉）；排期外手工复算即可。
