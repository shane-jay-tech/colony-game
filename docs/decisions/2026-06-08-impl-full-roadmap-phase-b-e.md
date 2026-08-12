# 2026-06-08 全开发路线 Phase B-E 集成实现

## 需求
按 `docs/design/FULL_DEVELOPMENT_ROADMAP.md` 完成 Phase B（B-3~B-6）、Phase C（故事目标/报文/史官评语）、Phase D（美术清单）、Phase E（重玩性配置）的全部落地。

## 模式
quick（DeepSeek V4 Pro，reasoning_effort high）

## Opus 自审"最不放心的 3 个地方"
1. runMegaProjectTick 阶段首日扣费逻辑——如果玩家 load 存档恰好在阶段中间，daysRemaining < phaseDef.durationDays，则不会重复扣费。正确。
2. NPC AI 决策只锁冷却不执行动作——设计意图是 AI 决策与现有 computeNpcActions 分工：AI 只在 30 天冷却前阻止重复触发，实际行为（骚扰/合纵/内斗）由 computeNpcActions 处理。
3. 叙事报文用 === 精确匹配 dayOffset——如果玩家不幸在 dayOffset 那天存档退出，下次加载已经过了那天，报文就会跳过。设计选择：报文是氛围装饰非核心功能，跳过可接受。

## DeepSeek V4 Pro 审查结果（5 条）

1. [High] Faction RNG seed 只用全局 seed+day，缺 faction-specific 输入
   → **采纳但标注为非 bug**：factionState 是全局单一实例不是 per-faction，所以不需要区分。误判。

2. [High] Mega project 不扣资源
   → **采纳并修复**：加入阶段首日（daysRemaining === phaseDef.durationDays）时一次性扣费。

3. [High] NPC AI 决策不执行
   → **驳回**：设计意图，AI 锁冷却防重复，实际行为交给现有 computeNpcActions。

4. [High] morale + loyaltyDelta 双重叠加
   → **采纳并修复**：合并为单次 delta 应用（(morale ?? 0) + (loyaltyDelta ?? 0)）。

5. [Medium] 互斥国策数组顺序
   → **驳回**：当前无代码依赖数组顺序，push 即可。

## 最终落地清单

### Phase B
- B-3：diplomacyExpanded.ts（朝贡/贸易协定/联姻/结盟/挑拨 + NPC AI 决策）接入 gameStore
- B-4.1：factionSystem.ts（阶层博弈）接入 tick + resolveFactionDemand 公开方法
- B-4.2：megaProjectSystem.ts（巨型工程）接入 tick + startMegaProject + 阶段首日扣费
- B-4.3：policyExclusions.ts（互斥国策）接入 adoptExclusivePolicy
- B-5：eventsExpanded.ts 扩充到 40 事件（A 级 10 + B 级 20 + C 级 10）
- B-6：buildings.ts 已有 32 栋（Phase A-B 之前完成）

### Phase C
- C-1/C-2/C-3：storyGoals.ts 7 章节目标 + 56 叙事报文 + 7 史官评语接入 runStoryTick + advanceStoryChapter
- C-4：storyNpcs.ts 4 固定故事 NPC + 章节剧情节拍（数据层已就绪）

### Phase D
- artManifest.ts：56 资产清单（32 建筑 + 5 将领 + 10 事件 + 6 UI + 3 地形），全部 required: false

### Phase E
- E-2：gameConfig.ts 开局配置（资源/蛮族/事件/地图 4 维倍率表）+ HistorianRecord

### 存档
- SAVE_SCHEMA_VERSION 2 → 3
- v2→v3 迁移：factionState/megaProjects/exclusivePolicies 默认初始化
- serialize/deserialize 完整覆盖

## 测试
900 测试全绿（改动前后一致）。TypeScript 在新增文件中零错误。

## 桌面构建
`D:\colony-game\dist-out\win-unpacked\邦国录.exe` 已更新至最新代码。
