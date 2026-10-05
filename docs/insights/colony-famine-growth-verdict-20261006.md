# 断粮日人口仍增长平衡口径材料（c1004-03，2026-10-06，只读）

- 承 db58 L1。**现值复核订正**：`computePopulationGrowth`（population.ts:96-101）**已有断粮闸**——`if (grainStock <= 0) return { peopleDelta: 0, reason: 'idle' }`（矿源「grain=0 时 +2/日」的形态在现值**不成立**）；「+2/日」实为 `minDailyGrowth` 保底（:117 `Math.max(people*growthRate, minDailyGrowth)`），只在 **grainStock>0** 时走到。另：population.ts:83 `grainStock <= 0` 即 idle——**余粮=1 也算有粮**（可长），真正的减员在 `runStarvationTick`/`applyStarvation`（grainBefore<消耗 即 negDays+1）。

## 一、现状语义（读码口径）

| 粮况 | growth 面 | starvation 面 | 净值 |
|---|---|---|---|
| grain≥当日消耗 | 按档增长 | 无减员 | 正 |
| 0<grain<当日消耗 | **仍在增长档**（grainStock>0 不 idle；若 ≥cap 则 cap） | negDays+1（宽限 5 天后开始减员） | 增长与减员并存期 |
| grain=0 | **idle（0 增长）** | negDays 续计减员 | 负 |

**矿源形态的准确复述**：断粮「宽限 5 天＋温和 2%」期间，若 grain 未触 0（如每日进账 1-2 粮的涓流），growth 面仍按「有粮」增长——「断粮日仍增长」的真形态是**涓流续粮下的增长/减员并存**，非 grain=0 直增长。

## 二、量化沙盒（只读推演，60 人起步 grain=0 连续 30 天）

| 天 | neg | 档 | 人口 |
|---|---|---|---|
| 1-4 | 1-4 | 宽限 | 60（零死亡） |
| 5-14 | 5-14 | 温和 2% | 60→50（每日 -1~-2） |
| 15+ | 15+ | 重度 5% | 50→28（day30） |

地板=5（minimumPopulation）；30 天累计死亡 32 人（53%）。**结论**：断粮减员机制**真实存在且量级显著**——db58 L1「断粮日仍净增」在现值双闸（growth idle＋starvation 减员）下不成立。

## 三、两案（按任务书格式，实际裁口已变）

- **案「加闸」**：growth 面再补闸（如 grain<当日消耗即 idle）——**影响面**：`0<grain<消耗` 区间的涓流增长消失（现值这是“饥饿边缘挣扎”期的正反馈残余）；将红既有读数＝starvationSequenceSaveUi.test:120 口径注释＋computePopulationGrowth 相关快照（`rg -n "reason: 'idle'|'grow'" tests/` 现取）。**不建议**：会杀掉涓流续粮的正反馈设计（:2580 余粮正反馈 comment）。
- **案「维持＋文案」**：机制双闸已在（idle 闸＋starvation 减员），矿源缺陷不成立 ⇒ 只需在 HUD 飘红预警（:2630 已有「缺粮提前飘红」在册）确认文案点明「断粮期人口将逐日减员」。**推荐维持**。
- 红名单：两案都无新红（维持零改动；加闸才需同批快照）。

## 附：沙盒脚本

node 内联推演（参数照抄 DEFAULT_STARVATION：graceDays 5/mild 0.02/severe 0.05@15/min 5），读数见 §二表；零落码零数值改动。
