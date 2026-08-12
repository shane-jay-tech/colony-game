# Implement: 民改"占用制"劳力（修人口被吃空 bug）

Date: 2026-06-07
Supersedes: none

模式：deep（核心经济）

## 原始需求（用户原话）
> 顺便看一下我的民为什么容易归零啊 …… A是正确的，改完之后继续完成任务

## 诊断
`people`(民)被双重消耗：① 建造一次性 `cost.people`；② 每 tick `upkeep.people`（productionSystem 把 people 当普通资源算 net=产出−upkeep，但无建筑产出 people）。建一堆建筑后日 upkeep 几十、增长才 0.05/天 → 民被持续吃到 0，连带国格人口门槛爬不动。本质是"工人干活把自己消耗掉"的模型 bug。

用户拍板方案 **A 占用制**：民=总人口（只由 population.ts 改变），建筑"占用"劳力不消耗人口。

## 落地（GPT 主程序员产出具体 diff，Opus 核对真实代码后落地）
1. productionSystem upkeep 循环 skip `people`（不再扣人口）。
2. gameStore.placeBuilding：扣费 skip people + canPlace 后加门槛 `idleLabor < cost.people → insufficient_labor`。
3. gameStore.upgradeBuilding：校验+扣费 skip people。
4. gameStore 新增 `getEmployedLabor()`（Σ 在役建筑[constructing+working] cost.people）/ `getIdleLabor()`（max(0, people−employed)）。
5. placementSystem.canPlace 材料校验排除 people；PlacementFailReason 加 'insufficient_labor'。
6. BuildPanel：formatCost 去掉民、显示"占劳N"；affordable=材料(除民)够 && idle≥cost.people。
7. HUD：民显示 `闲置/总人口`。
8. population.ts/国格口径不变（people 现在=稳定总人口，更准）。

## DeepSeek 复审 verdict=do-not-ship，仲裁：
- **#2 旧档软锁(critical,采纳)**：旧档 people 被老 bug 吃空但建筑仍占编制 → 读档 idle 恒 0 → 死局。**已修**：replaceState 加迁移——people<已占用则补足到已占用量（+测试）。
- **#3 增长太慢(采纳)**：minDailyGrowth 0.05→0.3、growthRatePerDay 0.004→0.012（两表都改），标注待 8h playtest 校准。
- **#1 resourceSystem.computeDayDeltas 没 skip people(采纳-保险)**：确认该函数当前未被调用（已被 computeProductionTick 取代），仍补 people-skip guard 防将来误引复活 bug。
- #3安全(篡改存档)/#4性能(相邻O(n²))/#5可读(laborCost独立字段) → 驳回/记录（单机非威胁/既有/留后续重构）。
- 采纳额外：getEmployedLabor 过滤 paused/derelict（只算在役）。

## 验证
type-check 干净；`npm test` **642 passed**（+ 占用门槛/民不消耗/读档迁移 等新测试）；`electron:build:win` 成功。

## 给用户摘要
民现在=总人口，建筑只"占用"劳力不再吃人口；顶部显示"闲置/总人口"；劳力不够建不了（建造列表标"占劳N"）；旧档自动补足防卡死；人口增长调快（待手感校准）。
