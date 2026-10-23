# colony 测试面密度复核（c1023-26，2026-10-24）

> 口径：被测面＝`src` 下非 `__tests__`、非 `*.test.*` 的 `.ts/.tsx`；测试件＝`src/**/__tests__/*.ts`＋`scripts/__tests__/*.test.ts`；
> 未测判定＝测试面零 basename 共现（文件级启发式，与上批 plan-0127 §一同口径，故可比）。
> 在途区分＝porcelain 现值（本单盘点时全仓 CLEAN）。

## 一、现值表（vs 上批 128/176/未测 1）

| 指标 | 上批口径（plan-0127 §一） | 本单现值 | 增量 |
|---|---|---|---|
| 被测面（src 非测试件） | 128 | **128** | 0 |
| 测试件（src/__tests__ 盘面） | 176 | **176**（175 个 `*.test.ts`＋1 件辅助 `fakeScene.ts`） | 0 |
| 未测清单 | 仅 1 件 | **1 件：`src/renderer/data/offline.ts`**（同一件） | 0 |

### 测试面细分（盘面 vs 实跑）

- `src/**/__tests__/`：176 件（含 1 件非测试辅助件 `fakeScene.ts`——`*.test.ts` 口径外）。
- `scripts/__tests__/`：4 件（dualLiteralReconcileA4 / auditDeadExportsEquivalence / dualwriteAstGuard / auditDeadExportsReadonly）。
- vitest 主套件实跑：**178 files / 1948 tests**（src 175 − exclude 的 `hudRefreshCost.test.ts` ＋ scripts 4；本班 c1023-24 pre-commit 全量实测，178/1948 全绿）。
- perf 单线程件：`hudRefreshCost.test.ts`（vitest.perf.config.ts 串行跑，主班 2026-10-04 决定摘出门禁面）。

## 二、密度画像

- 测试件/被测件比：176 / 128 ≈ **1.375**；主套件用例/被测件比：1948 / 128 ≈ **15.2**。
- gameStore 拆分五批（c1023-01..05）**未落地**：`src/renderer/state/__tests__/` 仍只有单件 `gameStore.test.ts`（106 tests），无五批拆出件；三路证据见 §四。

## 三、增量归因

1. **本批新增＝0**：现值三指标与上批完全持平；本班此前后仅 c1023-24 一笔（artifacts 文档件，不入 src 口径）。
2. **在途＝0**：盘点时 porcelain 全 CLEAN（0 条），无未归属编辑。
3. **c1023-01..05（gameStore 拆分五批）状态**：已认领未落地——zcode-bridge outbox/done 无五单 result、colony git log 近 30 笔无 c1023-01..05 字样、工作树零在途。**若五批后续落地，src 非测试件与测试件将同步增长（拆分件＋配套测试），本表届时需重扫；门条件（「若已闭合则计入门」）现值未触发。**

## 四、证据命令

```
$ find src -name "*.ts" -o -name "*.tsx" | grep -v __tests__ | grep -v "\.test\." | wc -l
128
$ find src -path "*__tests__*" -name "*.ts" | wc -l
176
$ find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l
175
$ for f in $(find src -name "*.ts" -o -name "*.tsx" | grep -v __tests__ | grep -v "\.test\."); do ... done   # basename 共现扫描
UNTESTED: src/renderer/data/offline.ts
$ git status --porcelain | wc -l
0
$ git log --oneline -30 | grep -E "c1023-0[1-5]"   # rc=1 零命中
$ ls src/renderer/state/__tests__/ | grep -i gamestore
gameStore.test.ts
```

## 五、遗留与建议

1. `offline.ts` 为全仓唯一未测 src 件；其域内在册材料（c1023-15 OFFLINE_REWARD 12 名分层底稿）已指认部分导出待裁——若主班裁「留」，建议随裁决补最小钉；若裁「删」，未测面自然收零。
2. 五批 gameStore 拆分落地后，本密度表的重扫触发条件：`src/renderer/state` 目录件数变化或 gameStore.test.ts 不再唯一。
