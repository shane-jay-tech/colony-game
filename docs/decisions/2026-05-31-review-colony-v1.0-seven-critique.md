# Review — 邦国录 v1.0 七条 critique 落地补审

- **日期**：2026-05-31
- **触发原因**：v1.0（NPC 邦交 / HOI4 国策 / Anno 联动 / Tier 命名 / 缩放 / 资源图例 / 政令扩展）当时单模型裸推落地，未走协作系统、无审查存档（见 memory `project_colony_game_v1.0_solo_landing`）。用户要求补审找隐患缺陷。
- **模式**：deep 档（核心模块 + 用户明确要查隐患）
- **审查范围**：diplomacySystem.ts / DiplomacyPanel.ts / policies.ts / policySystem.ts / decrees.ts / decreeSystem.ts / ZoomControl.ts / Legend.ts / npcCountries.ts（~2200 行）
- **三路情况**：Opus（仲裁）+ DeepSeek（两遍）。**GPT relay 今日 3 次 RemoteProtocolError 失败**，按 CLAUDE.md 规则由 DeepSeek 顶替第二路。故 GPT 实际未参与。

---

## Opus 仲裁结论（核对真实代码后）

**没有真正的 critical。审查官报出的 3 个 critical 全部为误报**，根因是 sub-agent 只拿到被审文件片段、未读调用方实现：

| 审查官主张 | 严重度（主张） | 仲裁结果 | 依据 |
|---|---|---|---|
| 政令 stall 路径重复叠加 modifier | critical（两路都报） | ❌ **误报** | `gameStore.ts:525` `if (advance.applyEffects)` 已正确门控 add/remove；`applyEffects:false` 时跳过，无重复 |
| DSL 求值注入 | critical | ❌ **误报** | `dslEval.evalPredicate` 是手写白名单微解析器（仅固定比较运算 + identifier 白名单），**非 eval/new Function**；且 unlockCondition 是静态数据不入存档，无注入面 |
| warStatus 从不置 'war' | critical | ❌ **误报（设计如此）** | war 为即时结算（胜→peace/败→tension），无持久 war 态。唯一副作用：顶部 `already_at_war` 守卫成死代码（minor） |

**真实成立的问题（均为建议修 / 可不修级别）：**

### 建议修
1. **ZoomControl 定时器泄漏**（ZoomControl.ts:82 + destroy 157-170）：250ms `loop:true` timer 未存引用、destroy 不移除。真实但低风险——Phaser `scene.time` 在场景关闭时连带清理，仅当组件在场景存活期内单独重建才会让孤儿 timer 回调访问已销毁的 zoomText。修法：存 `TimerEvent` 引用，destroy 里 `.remove()`。
2. **邦交冷却字段共用**（diplomacySystem.ts:114/159）：envoy(14d) 与 war(30d) 共用 `lastActionDay`，导致出使后须等 30 天才能宣战、宣战后 14 天不能出使，与文件头注释承诺的"独立冷却"矛盾。属游戏逻辑 bug。修法：拆 `lastEnvoyDay`/`lastWarDay`。
3. **winChance NaN 边界**（diplomacySystem.ts:166）：双方军力均为 0 时 `0/(0+0)=NaN` → `Math.max/min` 透传 NaN → 必败（不崩溃）。低概率（需 npcMP=0）。修法：分母为 0 时给默认胜率。
4. **isPolicyAvailable 不查互斥**（policySystem.ts:130-136）：被互斥兄弟锁死的国策 UI 仍显"可采纳"，点了才在 tryAdoptPolicy 被拒。UX。

### 可不修
- 出使按钮 envoyEnabled 只看 warStatus 不显冷却态（DiplomacyPanel.ts:323）——UX 小瑕疵
- martial 抗漂移 `Math.round(drift/2)` 不对称（diplomacySystem.ts:225）：drift 仅 ±1，+1 未减半、-1 变 0。设计小瑕疵
- decrees.ts 各 stage `removeEffects` 全空 → 多阶 decree 效果累加（疑似设计意图"保留前阶"，非明确 bug）
- `costToDeltas` 在 policySystem 与 decreeSystem 重复 → 抽公共工具
- policies.ts effects.target 为裸字符串无类型约束 → 拼写错静默失效；建议 union 类型
- makeStageModifier 硬编码 `category:'military'`（decreeSystem.ts:227）→ 礼制/外交类被错误归类
- Legend.ts textIdxBase 手动偏移、npcCountries 无 ID 唯一性断言、ZoomControl 用 pointerup 与 Panel 的 pointerdown 不一致

---

## DeepSeek 第一遍（verbatim 摘要）

Verdict: do-not-ship。报 5 条主轴 objection：
1. (Security/critical) decreeSystem:41-48 DSL eval 注入 —— **Opus 否决：非 eval**
2. (Design/major) diplomacy 共用 lastActionDay —— **Opus 采纳（建议修#2）**
3. (Edge/major) stall 路径 modifiersToRemove 双移除 —— **Opus 否决：gameStore 已门控**
4. (Perf/minor) ZoomControl timer 未清 —— **Opus 采纳（建议修#1）**
5. (Readability/minor) policies.ts 硬编码坐标 —— **Opus 采纳（可不修）**
nits：trade 无冷却、layoutCard 魔法数字、decree 状态机偏复杂、npcCountries 魔法数字。
赞：pure-function 架构利于测试、DiplomacyPanel 监听清理到位。

## DeepSeek 第二遍（GPT 顶替，verbatim 摘要）

5 维度逐条，共 22 条：
- 功能正确性 9 条（含主张 critical×3：warStatus 未置 war、stall 双 add、winChance NaN）—— **Opus：前两条否决，NaN 采纳**
- 边界 3 条（NaN/refresh 前坐标未初始化/npc ID 唯一性）
- 安全 1 条（DSL 注入）—— **否决**
- 性能 2 条（ZoomControl timer，同源）—— **采纳**
- 可读性 7 条（costToDeltas 重复 / Legend 偏移 / target 无类型 / category 硬编码 等）—— **采纳为可不修**

---

## 落地动作

本次为 review（找问题），**未改代码**。等用户决定是否进入 /implement 修建议修 4 条。501 测试当前全绿。

## 元教训

本轮印证多模型协作 + Opus 仲裁的价值：sub-agent 在只见片段时倾向 over-flag（3 个 critical 全误报）。**仲裁必须回到真实调用方代码核对，不能照搬 sub-agent 严重度。** 同时记录 GPT relay 今日不稳定。
