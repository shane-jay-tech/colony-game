# 2026-06-08 A-5 世界呼吸通知 + A-6 史官谏言

## 需求

Phase A 路线图 A-5 和 A-6：
- A-5：世界呼吸系统——随机间隔播放环境味道文本（toast 8-12天/bulletin 15-25天），条件匹配当前世界状态
- A-6：史官谏言——12 个情境触发点，每条仅触发一次（持久化），为玩家提供引导

## 模式：quick

非核心模块（纯 UX 装饰层），走快档。

## 实现

### A-5 世界呼吸

- `src/renderer/data/breathingContent.ts`：20 条 toast + 15 条 bulletin，10 种条件类型
- `src/renderer/state/breathingSystem.ts`：冷却检查 → 事件冷却 → 条件过滤 → 随机选取 → 更新状态
- `gameStore.runBreathingTick()`：每日构建 BreathingContext 调用
- UIScene：监听 BREATHING_TOAST/BREATHING_BULLETIN 显示 Toast（5s/8s）
- 状态瞬态（不持久化），重载后冷却重置（对味道文本可接受）

### A-6 史官谏言

- `src/renderer/state/historianSystem.ts`：12 条 advice，纯函数 `checkHistorian(ctx)` 返回首个匹配
- 持久化复用 `seenJitHints[]`（ID 前缀 `hist_` 与 JIT 提示不冲突）
- 瞬态追踪：`grainNegativeDays`（连续计数器）、`idleDays`（玩家操作重置）、`gradeJustAscended`（仅在该 hint 触发时消费，避免被低优先级 hint 抢占）
- UIScene：`[史官] ${text}` 前缀 Toast，6s 显示

## DeepSeek V4 Pro 审查结论

5 维度覆盖结果：

**功能**
- [A-6] Major：`gradeJustAscended` 标志如果被无条件消费，低优先级 hint 会永久屏蔽升格提示 → **已修复**：仅在 `hist_07_grade_ascend` 实际触发时才消费
- [A-5] Minor：频繁事件可能通过 5 天冷却窗口压制所有 toast → 接受（极端场景，不影响正常游玩）

**边界**
- [A-6] Major：瞬态计数器重载后归零，需累积时间的 hint（30天空闲）可能延迟 → 接受（设计意图：cosmetic hint 不需要精确持久化）
- [A-5] Minor：重载后 30 天重复冷却清零 → 接受（味道文本早出无害）

**安全**：无问题
**性能**：无问题（每日固定少量检查）
**可读**：Minor — hint 优先级隐含于数组顺序 → 接受（数组长度仅 12，维护成本低）

## 仲裁

采纳 1 条 critical 修复（gradeJustAscended 消费逻辑），其余接受为设计选择。二轮跳过（无 critical 残留）。

## 测试

- breathingSystem.test.ts：10 tests
- historianSystem.test.ts：14 tests
- 全量：717/717 pass

## 用户摘要

结论：两个系统落地——世界呼吸随机播报环境氛围文本，史官在关键时刻给一句引导（每条只出现一次）。

风险：
1. 重载存档后呼吸系统冷却清零，可能短期重复出现同一条味道文本
2. 史官 hint 依赖数组顺序确定优先级，后续增删需注意

反方：瞬态计数器让"30天空闲"hint 在频繁重载玩家身上难以触发——但这类玩家也不太需要"你是不是忘了玩"的提醒。

置信度：高——纯 UX 装饰层，不影响核心逻辑，14+10 测试覆盖主要路径。
