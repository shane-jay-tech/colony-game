# Implement — 邦国录 v1.0 补审发现问题修复

- **日期**：2026-05-31
- **来源**：承接同日 review（`2026-05-31-review-colony-v1.0-seven-critique.md`）。用户指示"把你觉得该修的修一下"。
- **模式**：deep 档（核心模块：邦交状态机 + 存档迁移）
- **协作情况**：GPT relay 今日 3 次 RemoteProtocolError 不可用 → 主程序员由 Opus 兜底（单模型实现），DeepSeek 担任复审官。健康检查此前已过。

## 决定要修的范围（3 条 + 复审追加）

从 review 的清单里筛真实成立、且值得修的：

| # | 问题 | 严重度 | 状态 |
|---|---|---|---|
| 1 | ZoomControl 250ms 循环定时器 destroy 时未移除 | 建议修 | ✅ 修 |
| 2 | 邦交 envoy(14d)/war(30d) 冷却共用 lastActionDay → 互相误锁 | 建议修 | ✅ 修 |
| 3 | tryDeclareWar 双方军力 0 → winChance=0/0=NaN→必败 | 建议修 | ✅ 修 |
| — | isPolicyAvailable 不查互斥 | （review 列） | ❌ 撤销：CourtPanel.ts:493-514 实际 UI 已正确处理互斥锁死，该函数未被 UI 调用，契约本就只查前置 |

## 改动清单

- **ZoomControl.ts**：新增 `zoomTimer?: Phaser.Time.TimerEvent` 字段，`addEvent` 结果存引用，`destroy()` 里 `this.zoomTimer?.remove()` + 置 undefined。
- **schema.ts / npcCountries.ts**：`NpcCountryState.lastActionDay` 拆为 `lastEnvoyDay` + `lastWarDay`，初始 -1。
- **diplomacySystem.ts**：`trySendEnvoy` 读写 lastEnvoyDay；`tryDeclareWar` 读写 lastWarDay；winChance 加 `totalMP>0 ? p/total : 0.5` 兜底。
- **saveLoad.ts**：迁移逻辑——新字段缺失时回退到旧 lastActionDay（两路都继承，保守锁定）；新增 `finiteNum()` helper 拒绝 NaN/Infinity。
- **diplomacySystem.test.ts**：4 字段引用迁移 + 新增 5 条回归测试（envoy/war 独立计时各 1、0 军力 NaN 兜底 commercial/martial 各 1）。

## DeepSeek 复审（diff 二轮，verbatim 摘要）

Verdict: **ship-with-fixes**，7 条 objection。Opus 仲裁：

| Obj | DeepSeek 主张 | 仲裁 |
|---|---|---|
| 1 | saveLoad `typeof==='number'` 放过 NaN/Infinity（可绕过/永锁冷却）major | ✅ **采纳** → 加 `finiteNum`（Number.isFinite） |
| 2 | 旧档迁移两字段同赋值 → 可能虚锁 war 30 天 major | ⚖️ **保留行为**（保守锁无漏洞，单机老档一次性小等待）+ 修正注释说明 |
| 3 | 负军力时 0.5 兜底不对 minor | ❌ **驳回**：第 163 行 insufficient_military 守卫已拦负军力，0/0 是唯一可达分支 |
| 4 | 缺 martial+0军力测试 minor | ✅ **采纳** → 补 1 条（winChance 0.40 边界） |
| 5 | 嵌套三元难读 nit | ✅ **采纳** → finiteNum helper 化解 |
| 6 | 全局 lastActionDay 残留风险 | ❌ **驳回**：已 grep 清净 + type-check 零错误 |
| 7 | 重复读属性 micro | ✅ 随 helper 一并解决 |

## 验证

- `npm run type-check`：零错误
- `npm test`：**505 passed**（落地前 501 → +4 净增测试，含复审追加的 martial 边界）
- 多轮 fix-recheck：**1 轮（默认）**，未追加。

## 落地

git commit + 重建桌面 exe（D:\colony-game\dist-out\win-unpacked\邦国录.exe）。

## 元教训

review 列的 4 条"建议修"，落地核查时又撤掉 1 条（isPolicyAvailable——UI 实际已正确）。**连"建议修"级别也要在动手前回真实调用方确认**，否则会改无用代码。本轮真实修复 3 条 + 复审硬化 2 处（NaN 过滤、martial 测试覆盖）。
