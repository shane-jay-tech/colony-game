# Implement — 邦国录 Phase 1（部分）：国格阶梯 + 失败模型重写 + 模式外壳

- **日期**：2026-05-31
- **来源**：`docs/design/GAME_DESIGN_LIFECYCLE.md` Phase 1。主理人指示按路线图开工，本轮做 3/5 块（国格+软认可 / 失败模型 / 模式外壳），并要求"美术也要跟上"。
- **模式**：deep 档（核心模块：状态机 + 存档迁移）
- **协作**：Opus 主导集成 + GPT-coder 并行起草纯函数（交叉校验）+ DeepSeek 复审全量 diff。健康检查三家均通过。
- **计划**：plan 文件 `twinkling-imagining-turtle.md`（已批准）。

## 主理人决策（AskUserQuestion）
1. 本轮范围 = 国格 + 失败模型（+ 外壳）；8h 重平衡/NPC 成长留下轮。
2. 国格升级 = 综合门槛（人口+经济）**AND** 标志成就（混合）。
3. 模式外壳先搭壳，故事入口灰掉"敬请期待"。
4. 美术先做**考究引擎内视觉**（印章/篆书风），万相原画留 Phase 4，留好换图 hook。

## 交付内容

**国格阶梯**：新 `data/countryGrades.ts`（6 级定义 + 占位门槛 + 标志成就映射现有 id：市集/宗庙/王宫/称霸/铸鼎）+ `state/countryGrade.ts`（纯函数 evaluateGrade：AND 语义/一 tick 最多 +1/不降级/越界防御）。gameStore `runGradeTick`（插 tickDay 末尾，crisis 之后）+ getter + GRADE_CHANGED/TIANXIA_ACKNOWLEDGED 事件。HUD 印章风金框徽章（alpha 呼吸，留 Phase4 原画 hook）+ UIScene 软认可 Toast。

**失败模型**：删死代码（defeat.ts / DefeatCondition / defeatCount / permanentBuffs，确认全仓无业务消费）。新 `state/crisis.ts`（纯函数）。gameStore `runCrisisTick`：gold+grain 双零 60 日 → 一次性危机（人口×0.7 保底5 / 民心-20 / 国格降1级，gradeReached 不退）；双正 30 日解除危机态可再触发。新 `ui/CrisisModal.ts`（居中通告 + 软暂停）。

**模式外壳**：新 `scenes/ModeSelectScene.ts`（纪元风金框双卡，沙盒可点/故事灰显不可点）+ BootScene→ModeSelect→Intro→Game 接线 + GameState.mode + getMode/setMode。

**存档**：SAVE_SCHEMA_VERSION 不 bump；6 新字段走 `?? 默认`兜底 + finiteNum/clampGrade 防 NaN/越界；旧档残留 defeatCount 被忽略（显式白名单构造，不泄漏）。

## DeepSeek 复审（diff 二轮，verbatim 摘要）

Verdict: **do-not-ship**，5 objection + nits。Opus 仲裁：

| Obj | 主张 | 仲裁 |
|---|---|---|
| 1 | 危机降级后同 tick 可能 re-ascend，"倾颓"紧接"晋阶" | ✅ **采纳**（实际被 gold=0 门槛隐式挡住，但脆弱）→ runGradeTick 加 `crisisActive` 守卫（恢复期不晋阶）+ 回归测试 |
| 2 | population 用 country_population_cap 而非裸 people | ❌ **驳回**：有意复用 computeMetrics/DSL 的"有效人口"口径保持全游戏一致，加注释 |
| 3 | deserialize 不剥未知属性（安全） | ❌ **驳回（误报）**：deserialize 显式白名单构造，不 spread s，未知属性不进 state（测试已断言 defeatCount 不泄漏） |
| 4 | buildGradeInput 每日 O(n) 扫建筑 | ✅ **采纳-lite**：grade≥MAX 提前返回（终局免扫）；全量缓存判 YAGNI 暂不做 |
| 5 | gradeReached 嵌套三元难读 | ✅ **采纳**：抽 `clampGrade` helper |
| nits | 徽章 scale 致文字溢框 / 未用参数 / 魔法色 / 缺 re-ascend 测试 | ✅ 全采纳：pulse 改纯 alpha / 删参数 / 用 COLORS_HEX.CINNABAR / 补测试 |

DeepSeek 肯定：纯函数核心干净可测、UI 监听清理到位。

## 验证
- `npm run type-check`：零错误。
- `npm test`：**529 passed**（501 基线 + 28 净增；新增 countryGrade 单测/crisis 单测/gameStore 集成/saveLoad 迁移）。
- 多轮 fix-recheck：**1 轮**（默认）。
- 待跑：`npm run electron:build:win` 重建桌面 exe。

## 元教训
- 集成测试用真实建筑做 fixture 时要警惕其副作用（bld_market 产 gold 破坏了"双零"前提，一度误判守卫失效）——改用 initialState 预置 crisisActive 直测守卫。
- DeepSeek 5 条里 2 条驳回（1 误报、1 设计取舍），3 条采纳 + 全部 nits 采纳——复审价值主要在 Obj1 的脆弱性提示和 nits。
