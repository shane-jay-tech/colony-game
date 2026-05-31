# Implement — 邦国录 Phase 2 故事框架收尾（双轴跑通到三结局）

- **日期**：2026-06-01
- **来源**：承接 Phase 2 第一截。主理人拍板"全骨架可跑通到结局"。
- **模式**：deep 档（核心：故事导演/章节推进/结局/HUD/存档）
- **协作**：Opus 集成 + DeepSeek 复审 + 仲裁。多轮 fix-recheck 1 轮。

## 交付
- **三结局判定**：storyDriver.checkEnding（还权+公有→公天下 / 集权→家天下 / 其余→货天下）纯函数+单测。
- **章节占位推进**：storyChapters 补 2-7 章占位 banner + advanceAfterDays（度过 120 天进下章，Phase3 换真目标）+ ENDING_NARRATION 三套结局旁白。StoryFlags 加 chapterStartDay/ending。runStoryTick：序章靠统一→chapter 1-6 dwell 推进→chapter 7 判定结局 emit STORY_ENDING（ending 守卫只一次）。
- **结局画面**：GameScene 收 STORY_ENDING→pause→复用 TransitionScene 放结局旁白→onDone resume。
- **HUD 故事差异化**：新 ui/StoryBar.ts（独立组件）故事模式主顶栏下方显示 章节名 + 双轴半可视倾向（刻度槽+游标，不显原始数值只显档位词）+ 距下章 N 日；沙盒隐藏。
- 存档：storyFlags 加 chapterStartDay/ending serialize/deserialize/夹具。

## DeepSeek 复审（verbatim 摘要）
Verdict: **do-not-ship**，7 objection + nits。Opus 仲裁：

| Obj | 主张 | 仲裁 |
|---|---|---|
| 2 | **critical**：统一后未推进就存档→重载永久卡 chapter 0 | ✅ **采纳（关键修复）**：瞬态 storyTransitionPending（不持久）+ runStoryTick 重载恢复（unified&!pending→自动进第一章）+ 回归测试 |
| 3 | chapterStartDay 缺省 0 → 大 currentDay 重载即瞬间连跳章 | ✅ **采纳**：deserialize 缺省取存档 currentDay |
| 4 | chapterAt 越界回退序章 → dwell 0 卡死 | ✅ **采纳**：chapterAt clamp 索引 |
| 6+nit | StoryBar setData/getData 脆弱 + layout 读 label 宽度时文字未设=宽度0 错位 | ✅ **采纳**：改私有 trackX 字段 + 固定偏移布局 |
| nit | 结局监听无防重入 | ✅ **采纳**：GameScene endingShown 守卫 |
| 1 | deserializeStoryFlags 浅校验/未知属性 | ❌ **驳回**：显式白名单构造（不 spread raw）+ storyEventsTriggered 已 cap 500 |
| 5 | checkUnification O(N) 每 tick | ❌ **驳回**：仅 4 NPC，可忽略 |
| 7 | catch-up 一帧多推进 | ⚖️ **接受为低风险**：需一帧 120+ 天才跳章，ending 守卫防重复结局 |

DeepSeek 肯定：checkEnding 纯净易测、ending 守卫有效防重复结局。

## 验证
- type-check 零错误；`npm test` **598 passed**（590→+8：checkEnding/章节推进/结局闭环/softlock 恢复/存档）。
- electron:build:win 重建 exe。
- 故事闭环集成测试：序章→统一→（模拟跳变）→1-7 章占位推进→第七章 STORY_ENDING（中立双轴→货天下），结局只兑现一次，softlock 重载恢复。沙盒零污染。

## 元教训
- DeepSeek 这轮抓到一个真 critical（重载 softlock）——存档时序边界是状态机隐患高发区，瞬态标记 + 重载恢复是稳妥解。
- StoryBar layout 读 label.width 时文字未设→宽度 0 的首帧错位，是"测量依赖未就绪"的经典坑，改固定偏移最稳。
- Phase 2 故事框架到此**闭环完整**（序章→七章占位→三结局），但七卷剧情/对白仍是占位——Phase 3 取材小说填肉。
