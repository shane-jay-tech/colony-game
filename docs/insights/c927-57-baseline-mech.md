# c927-57 — storyTarget 套件台账基线漂移机制修复（c922-09 遗留）

- 日期：2026-09-30
- 任务：zcode-bridge/inbox/c927-57.task.md（result: outbox/c927-57.result.md）
- 锚点：done/c922-09-colony-storytargets.result.md 遗留 1（台账静态快照随测试增删即时过期，且生成器住 tmp/ 不可复跑）

## 机制落地（两件套）

### 1. 生成器扶正：`scripts/suite_timings_ledger.py`（新增）

c922-09 遗留 1 点名「要长期可复跑得把生成器挪进 scripts/」——本单落地。刷新从"临时脚本+手工拼 JSON"变成一条命令：

```
npx vitest run --reporter=json --outputFile=tmp/<班名>/vitest.json
python scripts/suite_timings_ledger.py --from tmp/<班名>/vitest.json --produced-by <班名>
```

- 读 vitest JSON → 重算 totals（testFiles=文件数；⚠ `numTotalTestSuites` 含嵌套 describe 是 600 级，不能用作文件数——首版实现踩过，已修）/逐文件墙钟/top10/byDir 聚合；
- 自动继承既有台账的刷新史为新 `refreshHistory` 首条（c924-12 的 1711 例快照不丢），逐次追加本次（at/producedBy/totals）——**漂移量逐次留痕**；
- 只读 vitest 输出与旧台账，唯一写点 = 台账文件。

### 2. 台账头注升格：`driftPolicy` 字段（区间容忍+自更新语义）

台账新增头注字段（本单实测全文在盘）：**计数与耗时是【生成时点值】不是断言基线**——功能单新增/删除测试不构成台账失真、不阻塞任何功能单、也不得被当回归信号；刷新前后的计数差即漂移量，由 refreshHistory 逐次留痕；要新鲜读数就跑上面两条命令。原 `ledgerMaintenanceNote` 的口径（文件墙钟/并发污染/跨次只比 totals 与 top 序）原样保留并注明"沿 c922-07 不变"。

## 复跑读数验证（2026-09-30 实测）

- 全量：`npx vitest run --reporter=json` → **totals = 162 文件 / 1826 例（1825 passed / 1 failed）**；
- 对 9/25 c924-12 快照（157 文件 / 1711 例）漂移量 = **tests +115、files +5**——已按新机制记入 refreshHistory，属正常漂移（两日多班增测），不再是"失真事故"；
- 那 1 例 failed：`hudRefreshCost.test.ts`（c927-26 HUD/订阅件 refresh 毫秒成本，热身 20＋测量 200 轮的计时敏感型）——**单文件复跑即绿（1 passed, 1.73s）**，定性为全量并发负载下的抖动，非回归、非本班造成（本班零产品码改动）；
- top1：`fullLifecycleLayerTriage.test.ts` 37.16s / 27.49%（与历届台账同序）。

## 验收情况

- ① 机制 diff：✅ 生成器入 scripts/（约 150 行）＋台账 driftPolicy/refreshHistory 字段
- ② 复跑读数：✅ 上节（162/1826，漂移 +115/+5 留痕）
- ③ 既有断言不回归：✅ 台账无断言型消费者（grep 全仓 0 个测试/源码引用）；头注口径逐字保留；1 failed 计时抖动单测即绿定性

## 遗留问题

- 本班台账在工作树为「未提交叠加态」：基线本就带着 c924-12 的未提交重生成（git diff 2199 行级），本班在其上按正式机制再生成——主班代提交时以本版为准（c924-12 快照已折叠进 refreshHistory 首条，不丢）。
- refreshHistory 里 c927-57 出现 3 条：系本班修生成器两处 bug 的三次调用如实留痕（审计链不删不改），后续刷新自然稀释。
- hudRefreshCost 计时型测试在全量并发窗有抖动史（本班 1 例）——是否给该件加负载豁免阈值，属 c927-26 判据面，留主班。
