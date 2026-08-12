# 2026-06-07 A-7 事件节奏控制器（状态驱动）

## 需求

替代 eventEngine 中固定的 `minDaysBetween` 冷却，改为按国家当前状态动态调整事件采样间隔。

参考设计：Frostpunk 温度驱动事件密度。

## 实现方案

新建 `src/renderer/state/eventTempo.ts`，纯函数模块：

1. `assessNationState()` — 评估国家状态四档：crisis > tense > peaceful > developing
2. `shouldSampleEvent()` — 状态驱动的间隔决策（含强制触发 + 防连击）
3. `filterEventsByState()` — 按状态过滤事件池（太平不出负面，危机不出正面）

集成点：`gameStore.ts runEventTick()` 替换旧 `minDaysBetween` 逻辑。

## Mode

quick（日常补齐，非核心架构选型）

## DeepSeek V4 Pro 审查（5 维度）

### 功能
- 状态评估逻辑合理，优先级正确

### 边界
- **Critical（已修）**：`forceMaxDays < antiComboDays` 时力触发被 anti-combo 挡住
  - 修复：force trigger 检查提前到 anti-combo 之前

### 安全
- RNG 可预测（save scum）——接受，与现有事件系统一致

### 性能
- **Warning（已修）**：每 tick 都算 nationState 即使在 anti-combo 窗口
  - 修复：gameStore 加 fast-path 早退

### 可读性
- **Suggestion（已修）**：filter 函数重复 → 提取 `filterExcluding` 辅助函数
- **Suggestion（已修）**：删除未使用的 `resources` 字段

### 设计
- **Warning（已修）**：tempo RNG 与 event selection RNG 使用相同种子导致相关性
  - 修复：tempo stream 加独立异或鉴别符 `0x1F4E9`

## 二轮 cross-critique

未触发（DeepSeek 无 critical 未修——唯一 critical 已即时修复）。

## 仲裁

5 条 finding 全部采纳修复。DeepSeek #1（RNG 可预测 save scum）标记为 accepted-risk——与现有事件系统设计一致，不是本次引入的新问题。

## 用户摘要

已落地事件节奏控制器：太平/发展/紧张/危机四档动态调频 + 50天保底 + 8天防连击 + 按状态过滤事件池。678 测试全绿。
