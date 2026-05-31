# Implement — 邦国录 Phase 1 收尾：经济重平衡 + NPC 动态成长

- **日期**：2026-05-31
- **来源**：`GAME_DESIGN_LIFECYCLE.md` Phase 1 剩余两块。主理人指示"继续接着做"。
- **模式**：deep 档（核心模块：经济曲线 + NPC AI + 存档）
- **协作**：Opus 集成 + GPT 并行起草纯函数（交叉校验）+ DeepSeek 复审。健康检查三家通过。
- **计划**：`twinkling-imagining-turtle.md`（已批准）。

## 主理人决策
- 经济：① 实装人口增长（核心缺口）② 集中平衡常量 ③ 初版数值 ④ **连时间尺度一起改**；手感精调待 playtest。
- NPC：**NPC 池随机选 4/局**（含蛮夷）+ 动态成长（军力增长/合纵围攻/互攻骚扰）。

## 交付
**经济**：`data/balanceConfig.ts`（起始资源/时间尺度/人口参数单一事实源）；时间尺度 1x=1000→**250ms**（8h 内可登顶，timeSystem.test 派生重写）；`state/population.ts` 人口增长纯函数（余粮+住房→渐增、缺粮→流失、分数残差）接 `runPopulationTick`；people 口径改裸资源（`country_population_cap` 转作住房上限）；bld_house +10 / bld_palace +30 housingCapacity。

**NPC**：`npcCountries.ts` 扩 8 邦池（含 tribal 戎狄）+ `selectNpcsForGame(seed,4)`（内联 mulberry32 确定性、保证含 ≥1 蛮夷）+ `makeInitialNpcStates` wrapper；IntroScene 立国随机种子换阵容。新 archetype `tribal` + NpcCountryState 加 allyIds/aggression/lastActionDay + saveLoad 兜底。`state/npcDynamics.ts` 纯函数（军力成长/玩家强弱档/合纵结盟/NPC行动）。gameStore `runNpcDynamicsTick`（diplomacy 后、population 前；每30日军力涨；劫掠/围攻/内斗结算 + NPC_ACTION Toast）。DiplomacyPanel 固定3卡→Map 动态4卡（合纵/【夷】/虎视眈眈）。

## GPT 交叉校验（第一轮派发，本轮完成）
GPT-5.5 Pro 独立实现的 countryGrade.ts / crisis.ts（耗时 106min，deep 太慢降 quick）**与 Opus 上一轮实现完全一致**（evaluateGrade 的 AND + 一次最多 +1 + 不降级；crisis `max(floor(people×0.7),5)` + morale -20）。免费独立验证，确认实现正确。

## DeepSeek 复审（NPC diff 二轮，verbatim 摘要）
Verdict: **do-not-ship**，7 objection。Opus 仲裁：

| Obj | 主张 | 仲裁 |
|---|---|---|
| 1 | 存档非确定/种子没存 | ❌ **驳回**：rngSeed 已序列化，每 tick createRng(seed^day) 重建，读档从 currentDay 推进不重放，确定性成立；阵容存 npcCountries 无需种子复现 |
| 2 | 联盟不对称 | ❌ **驳回**：每对 (i<j) 同填双向，成对对称（星型非团但合理），非 bug |
| 3 | 同日多 NPC 围攻死亡螺旋/无每日上限 | ✅ **采纳**：加 MAX_PLAYER_HOSTILE_PER_DAY=2（危机本就 60 日门控，无"即时死亡"，但防爆击不公平）+ 测试。保留 tick 顺序（劫掠计入危机=有意张力） |
| 4 | targetMilitaryDelta 符号/猎物卡 10 | ⚖️ **保留**：本轮有意不做 NPC 灭国（阵容固定4，灭国破 UI/存档），保底 10 是设计 |
| 5 | DiplomacyPanel 泄漏/Map 迭代删除 | ❌ **驳回**：Phaser Container.destroy() 默认销毁子对象（仍补 destroy(true) 显式化）；迭代中 Map.delete 当前键安全 |
| 6 | saveLoad 无 allyIds 完整性校验 | ⚖️ **驳回**：悬空 ally id 在 UI/逻辑均 getNpcDef(id)?? 优雅降级不崩 |
| 7 | 加密种子 + 存档校验和 | ❌ **驳回**：单机无排行榜/多人，反作弊过度设计 |
| nit | mulberry32(0) 退化 | ✅ 采纳：seed `|| 1` 保底 |

## 验证
- type-check 零错误；`npm test` **564 passed**（529→+35：population/npcCountries/npcDynamics 单测 + gameStore/saveLoad 集成）。
- 多轮 fix-recheck：1 轮（默认）。
- 待跑 electron:build:win 重建 exe。

## 元教训
- 集成测试拿真实建筑/NPC 当 fixture 要防副作用（bld_market 产 gold 破坏"双零"前提；人口饥荒在 crisis 前跑使危机测试的 people 精确值失效——已改为断言"减少"而非定值）。
- RngHandle 是对象（.next()）不是 `()=>number`，传纯函数要包 `()=>h.next()`，否则运行时抛错且会级联破坏 timeSystem tick 测试。
- DeepSeek 7 条仅采纳 1.5 条——复审在单机沙盒语境下倾向 over-flag（确定性/安全/泄漏多为误判），价值主要在 Obj3 的"齐揍爆击"防护。
