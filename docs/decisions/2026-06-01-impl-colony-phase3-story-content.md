# Implement — 邦国录 Phase 3 故事内容（七卷剧情 + 真实章节目标解锁）

- **日期**：2026-06-01
- **模式**：自主推进（主理人"全部做完再通知"）+ deep 协作复审。
- **来源**：设计稿 Phase 3 + S.2/S.2.1/OQ-S3，取材《天下人书记》。

## 交付
- **基础设施**：dslEval 加 story_chapter/story_power_axis/story_resource_axis；computeMetrics 注入（沙盒 storyFlags=null→chapter=-1，零污染）；ChapterDef.advanceGoal + chapterGoalMet 纯函数；runStoryTick 用 advanceGoal（替占位 dwell）——解决本章关键剧情事件即解锁下一章/兑现结局；resolveEvent 记 '故事' 事件入 storyEventsTriggered；eventEngine.selectContext + store.pickEventContext + EventModal 用之（OQ-S3 文本变体）。
- **七卷剧情**：data/storyEvents.ts 7 个关键🔀抉择事件（血堤查贪/分田立碑/淬火纪检/铁与火专利公私/海与灯共同体/惊蛰任期/归根交权），按章 trigger 门控、带 storyAxisDelta 推双轴导向三结局；3/6 章带 context 滤镜变体。每章 advanceGoal 锚到其关键事件，七卷全程目标驱动。
- 文案半文半白、架空名 公/家/货天下、不喊口号用情节演绎。

## DeepSeek 复审（ship-with-fixes，6 条）Opus 仲裁
- ✅ **Obj1（critical：剧情事件 random 门控可能卡章）**：去掉 random，章节匹配且无挂起即触发，推进确定化。
- ✅ **Obj5（注释过时）**：改。
- ✅ **Obj2（沙盒污染）**：AND+chapter=-1 已安全，补 3 条门控锁测。
- ❌ Obj3（测试 flaky）：相关测试未加载 events content（确定性），非问题。
- ❌ Obj4（每 tick new Set）：仅故事模式有目标时一次/tick、数组极小，可忽略。
- ❌ Obj6（双轴 delta 散落）：每 choice 的 delta 是 choice 专属、内联才合理。

## 验证
- type-check 零错；npm test **608 passed**（598→+10）。
- 章节目标解锁集成测试（解决关键事件→进章/未全解决→不进）+ 沙盒零污染门控测试 + selectContext/chapterGoalMet 单测。

## 增量验证决策（S.4）
七卷主干（每章一关键🔀，OQ-S3 80% 主干）已落地、双轴可跑通到三结局。**第五章 3 套独立内容（OQ-S3 5%，最重项）暂按主干单 fork 处理**——按设计稿"做完第 5 章雏形再评估保 3 路/降 2 路"，留待主理人 playtest 后定（当前 2-3-2 路均可达，框架支持扩展）。
