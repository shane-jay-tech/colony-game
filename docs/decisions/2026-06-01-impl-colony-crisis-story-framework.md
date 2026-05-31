# Implement — 邦国录 危机§7补强 + Phase 2 故事框架（第一截）

- **日期**：2026-06-01
- **来源**：设计稿补全为 567 行完整定稿后，主理人指示按稿推进。本轮 = 危机模型补强到 §7 + Phase 2 故事框架做到"能跳变进第一章"。
- **模式**：deep 档（核心模块：危机/存档/场景流程/故事导演层）
- **协作**：Opus 集成 + DeepSeek 复审 + 仲裁。多轮 fix-recheck 1 轮（默认）。
- **计划**：`twinkling-imagining-turtle.md`（已批准）。

## 主理人决策（对账后）
- 国格判定：**保持 AND**（已建）→ 反向把设计稿 B.2.1 改成 AND。
- 危机：**补强到 §7**（40 天触发 + 三种低谷 + 防刷递增）。
- Phase 2：**先做到"能跳变进第一章"**就 playtest（三结局完整判定/史官半可视化/HUD 差异化全套留下轮）。

## 交付
**文档对账**：设计稿 B.2.1 OR→AND；§9.1 标 Phase1 已建；附录 A 失败描述更新。

**危机 §7**：crisis.ts 触发 60→40；chooseCrisisKind 按情境选 民变/纳贡附庸/割地；planUnrestEffects 防刷递增（整数百分比避浮点）；gameStore applyCrisis 分派三 kind + crisisCount/vassalOf 新 state + redeemVassalage/季抽成。

**Phase 2 故事框架（到第一章入口）**：
- 引擎分层：balanceConfig STORY_BALANCE + getBalanceConfig（**已接进 runPopulationTick + startStoryMode**，双表真生效非死代码）；GameState.storyFlags（sandbox 恒 null）；storyDriver.ts 纯函数（checkUnification 多途径/axisSeedForPath/clampAxis/band）；gameStore runStoryTick（mode 门控）。
- 序章多途径统一：武途(NPC 全打服)/文途(信誉≥120+多数归附)→播种权力轴→STORY_UNIFIED。
- 跳变：TransitionScene 全屏旁白；GameScene 收 STORY_UNIFIED→pause→过场→advanceStoryChapter(1)→resume。第一章「血堤」占位（storyChapters.ts + UIScene 长 Toast banner）。
- 隐性双轴：schema storyAxisDelta（optional）+ pushStoryAxis（mode 门控，跨档发史官评语 Toast）。
- 故事可进：ModeSelectScene 故事卡启用 + startStoryMode。

## DeepSeek 复审（故事 diff，verbatim 摘要）
Verdict: **do-not-ship**，6 objection + nits。Opus 仲裁：

| Obj | 主张 | 仲裁 |
|---|---|---|
| 2 | deserializeStoryFlags `up` 未定义变量（critical） | ❌ **驳回**：`const up=(raw as).unifyPath` 明确定义，type-check 零错误证伪（看截断 diff 误判） |
| 6a/5 | getBalanceConfig 死代码、故事 housingCap 18 没生效 | ✅ **采纳**：接进 runPopulationTick + startStoryMode，双表真生效 |
| 3 | onDone 无条件 resume('UIScene') | ✅ **采纳**：uiWasActive 标记对称 pause/resume |
| 1/4 | storyEventsTriggered 不限长→加载 OOM | ✅ **采纳**：deserialize slice(0,500) 截断 |
| 6b | pause 生效前 while 多 tick | ⚖️ **接受为非问题**：unified 标志挡重复触发，过场前几 game-day 不可见 |
| nit | checkUnification 未加类型/TransitionScene.layout 未挂载 | ❌ **驳回**：均已有类型/已挂载（误读截断 diff） |

## 验证
- type-check 零错误；`npm test` **590 passed**（564→+26：crisis 三kind/storyDriver/故事集成/存档 round-trip）。
- electron:build:win 重建 exe。
- 沙盒零污染：runStoryTick/pushStoryAxis mode 门控 early-return，storyFlags sandbox 恒 null（集成测试验证）。

## 元教训
- DeepSeek 这轮 1 个 critical 是看截断 diff 的误判（type-check 是最硬的证伪工具）；但 6a"双表死代码"是真问题且有价值——搭了机制不接 = 留隐患，质量优先就该接上。
- 故事层全程 mode 门控 + storyFlags|null，是"同一引擎不分裂"的关键；测试显式验证沙盒模式 storyFlags 恒 null。
- **本轮只搭框架不填七卷内容**（占位），严格控"内容量爆炸"风险；剧情血肉 = Phase 3 取材小说。
