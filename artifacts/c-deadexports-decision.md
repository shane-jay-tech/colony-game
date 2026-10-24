# dead-exports 开关两案终版影响面（c1025-16 · 2026-10-25）

> 拍板现值：**D1025-nod #7「dead-exports 开关两案→不加开关（维持口径）」**（2026-10-25 已落）——案 A 收口。本件＝终版影响面＋拍板包条目归档；两案并陈底稿见 `artifacts/c-deadexports-switch.md`（c1023-16）。
> 本单零改码零工具改动（案 A＝维持现状，无实施面）。

## 一、现值复跑（2026-10-25，story 三批后）

`$ node scripts/audit-dead-exports.mjs --summary`（read-only）
→ `scanned files=134 entries=123 summary={"dead":1,"testsOnly":99,"internalOnly":23}`

| 项 | c1023-16 档（10-24） | 现值（10-25） | Δ 归因 |
|---|---|---|---|
| scanned files | 128 | 134 | +6＝六域 domains/*.ts（c1023-10 密度档同口径） |
| entries | 122 | 123 | +1 |
| dead | 1 | 1 | 零变化（唯一 dead＝OFFLINE_REWARD，甲案接线工单已备 c1025-15） |
| testsOnly | 98 | 99 | +1＝story 系新增 export 面（story 三批引入文件的测试消费面；非三名相关） |
| internalOnly | 23 | 23 | 零变化 |

**三名现值逐名核**（`--out tmp/c1025-16-dead.json` 实测）：TRADE_AGREEMENT_CONFIG@diplomacyExpanded.ts:41 / ALLIANCE_CONFIG@:54 / PERSONALITY_MUL@:67 —— **全部维持 internal-only、hitsInTests=0**，与 c1023-16 档读数逐字段一致（案 A 收口后三名判罚不漂移）。

## 二、案 A 收口终版影响面（拍板 #7 生效语义）

1. **工具零改动**：`--count-test-imports` 开关不实施——c1023-16 §三方案（5-8 行＋G2 守卫同笔）**归档不激活**；audit-dead-exports.mjs 维持「import≠消费」单口径。
2. **三名处置指引（案 A 语义）**：维持 internal-only＝「文件内自用、非死、export 面存疑」保守判罚；若未来要收 export 面走 internal-only→去 export 化（c1023-15 乙案 D 类先例），另立单。
3. **在档 JSON 脱节维持**：docs/insights/colony-dead-exports-20260914.json（9/18 旧口径 108{0,108,0}）与现值脱节——案 A 落地后建议下次审计批随 `--write` 刷新（附 .bak），非本单面。
4. **复活后果（案 B 若激活的反事实，供未来复议参考）**：3 名 internal-only→tests-only、summary 变 123{1,101,21}；「测试只 import 不用」的断言缺口信号被吞——案 A 拒绝的正是该信号损失。

## 三、拍板包条目（归档格式）

- **#7 dead-exports 开关两案**：按推荐**不加开关（维持口径）**（D1025-nod，2026-10-25）——三名维持 internal-only；工具单口径零改动；开关方案归档 c1023-16 档待未来复议（复议触发：主班认定测试依赖面属公开 API 契约钉价值时）。
