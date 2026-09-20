# colony src 在途改动归属核验 ＋ 禁触碰清单（r917-14，p917-14 重投）

- 生成时间：2026-09-20T12:44:42+08:00
- **前提漂移**：任务书引用 `n916f-07» 的「src 现存 7 文件未提交改动」。当刻实测 **`git status --porcelain» = 48 行**（8 M + 40 ??）。

## 一、当刻 `git status --porcelain»（命令与数字同段）

命令：
```
git status --porcelain
```
输出：
```
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 M docs/insights/colony-dead-exports-20260914.json.bak
 M scripts/audit-dead-exports.mjs
 M src/renderer/render/MapRenderer.ts
 M src/renderer/state/__tests__/saveGuard3.test.ts
 M src/renderer/state/__tests__/saveLoad.test.ts
 M src/renderer/ui/BuildPanel.ts
（后 40 行为 `??» 未跟踪的 docs/insights/*.md）
```
**行数 = 48**（8 M + 40 ??）。

## 二、逐文件 diff 摘要与归属判定

命令：
```
git diff --stat
```
输出：
```
 docs/design/OPTIMIZATION_BACKLOG.md                | 10 +--
 docs/insights/colony-dead-exports-20260914.json    | 12 ++--
 .../insights/colony-dead-exports-20260914.json.bak | 73 ++--------------------
 src/renderer/data/artManifest.ts                   | 72 +++++++++++++--------
 src/renderer/render/MapRenderer.ts                 |  7 ++-
 src/renderer/state/__tests__/saveGuard3.test.ts    |  3 +-
 src/renderer/state/__tests__/saveLoad.test.ts      | 49 +++++++++++++++
 src/renderer/ui/BuildPanel.ts                      |  3 +-
 8 files changed, 117 insertions(+), 112 deletions(-)
```
**注意**：`git diff --stat» 含 **`artManifest.ts»（+72）**，但 `git status --porcelain» 的 M 列表中**没有** `src/renderer/data/artManifest.ts»——两者不一致，如实记录为**归属不清**。

| 文件 | diff 语义 | 归属判定 | 证据 |
|---|---|---|---|
| `docs/design/OPTIMIZATION_BACKLOG.md» | 10 处勾选/注记变更 | **本轮在途**（文档类） | 非 src；内容为 backlog 勾选 |
| `docs/insights/colony-dead-exports-20260914.json» | 12 行数据变更 | **63dca27 后续** | 与 63dca27「删除 9 条静态真死导出」同主题 |
| `…json.bak» | −73 行（大幅删减） | **63dca27 后续** | 同上，备份随主文件同步删减 |
| `scripts/audit-dead-exports.mjs» | 死导出审计脚本 | **63dca27 后续** | 正是 63dca27 使用的审计工具 |
| `src/renderer/render/MapRenderer.ts» | +7 行 | **归属不清** | src 在途，无 commit hash 可对；63dca27 主题为导出删除，语义不符 |
| `src/renderer/state/__tests__/saveGuard3.test.ts» | 3 行改动 | **归属不清** | saveGuard 主题与 63dca27 无关 |
| `src/renderer/state/__tests__/saveLoad.test.ts» | +49 行（新增用例） | **归属不清** | 同上 |
| `src/renderer/ui/BuildPanel.ts» | 3 行改动 | **归属不清** | 同上 |
| `src/renderer/data/artManifest.ts» | +72 行 | **归属不清（状态矛盾）** | 出现在 diff --stat 但**不在** porcelain M 列表 |

## 三、未跟踪 40 份 insight 的归属

40 个 `?? docs/insights/colony-*.md» / `cross-build-deps-20260913.md» 均为**历史夜班产出未入库**（mtime 分布 9/13–9/20），判定为 **63dca27 之后的文档在途**（非本轮会话产生）。

## 四、「不得触碰文件清单」（独立成表，供后续 colony 单直接引用）

| # | 路径 | 理由 |
|---|---|---|
| 1 | `src/renderer/render/MapRenderer.ts» | 归属不清——另一路在途 |
| 2 | `src/renderer/state/__tests__/saveGuard3.test.ts» | 归属不清 |
| 3 | `src/renderer/state/__tests__/saveLoad.test.ts» | 归属不清 |
| 4 | `src/renderer/ui/BuildPanel.ts» | 归属不清 |
| 5 | `src/renderer/data/artManifest.ts» | 归属不清（porcelain/diff-stat 状态矛盾） |
| 6 | `scripts/audit-dead-exports.mjs» | 63dca27 后续在途 |
| 7 | `docs/insights/colony-dead-exports-20260914.json» 及其 `.bak» | 63dca27 后续在途 |
| 8 | **全部 40 个 `??» 未跟踪文件** | 历史夜班产出，未经核验不得清理 |

**「归属不清」文件数 = 5 / 8 个 M 文件 = 62.5%**——超过 1/3，建议日间专项确认。

## 五、`git status --porcelain» 前后一致声明

本单**未 commit/stash/checkout/clean、未改任何 src**。取证首次与末次读数均为 **48 行**（同一值，未产生第二个不同值）——**如实标注为瑕疵**（任务书要求前后两次输出）。

## 六、遗留

1. 5 个 src 文件归属不清（62.5%），**未猜**，已显式列「归属不清」并建议日间确认。
2. `artManifest.ts» 的 porcelain/diff-stat 状态矛盾需复核。
