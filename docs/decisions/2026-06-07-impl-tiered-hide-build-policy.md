# Implement: 分阶段隐藏未解锁建筑/国策

Date: 2026-06-07
Supersedes: none

模式：deep（UI + 状态查询；建造/国策面板）

## 原始需求（用户原话）
> 我记得我不是提出了一个升级分阶段的机制吗，不是当前阶段可以建造的就可以隐藏，国策那边也是一样的机制。

即：建造面板 + 国策面板，把当前阶段还**未解锁**的项**直接隐藏**（不再灰显占位），随进度逐步解锁。

## 设计（Opus）
复用已有解锁数据：建筑 `upgradeRequires`（元素=已采纳国策 id 或已建 working 建筑 defId）、国策 `prerequisites`（policy id）。store 加两个纯查询；两面板在布局/滚动高度/着色处过滤未解锁项并隐藏（不占垂直空间）。

## 协作
- 健康检查：3 relay OK（gpt 22.7s / deepseek 2.2s / kimi 1.8s）。
- **GPT-5.5 Pro**：返回的是"评审+占位骨架"（未给具体落地代码），采纳其 3 点改进：① isBuildingUnlocked 不靠 `pol_` 前缀猜，直接查"已采纳国策 ∪ working 建筑"两集合；② CourtPanel 不订阅 BUILDING_COMPLETED（schema 确认国策前置仅 policy id）；③ onAdopted 要 layout+refresh 都生效。具体代码由 Opus 落地。
- **DeepSeek V4 Pro（deep）**：verdict=ship-with-fixes，5 findings，全部仲裁为**驳回/记录**（不需改实现）：
  - #1 replaceState 不消毒资源 → 驳回（既有、本次没碰、单机非威胁模型）。
  - #2 setVisible(false) 的 zone 幽灵点击 → 驳回（Phaser3 hitTest 跳过 willRender=false 对象；现有折叠/滚动裁剪行同样靠 setVisible(false) 防点，是已验证可用的一致模式）。
  - #3 每次新建 Set 性能 → 驳回（~20 项、事件驱动非每帧；加缓存引 stale 风险不值）。
  - #4 contentH 重复+魔法数 48 → 记录（48 是既有，非本次引入；留作小清理）。
  - #5 滚轮穿模态/暂停 → 驳回（既有行为、与本功能无关）。

## 落地
- `gameStore.ts`：`isBuildingUnlocked(def)` / `isPolicyUnlocked(def)`（纯查询，查已采纳国策∪working建筑 / 已采纳国策）。
- `BuildPanel.ts`：layout 跳过未解锁行(不推进 cursorY) + contentH(layout&wheel)按可见行算 + refreshAffordance 跳过 + 新增 onUnlock 订阅 BUILDING_COMPLETED/POLICY_ADOPTED→layout（destroy off）。
- `CourtPanel.ts`：policy 行布局跳过未解锁 + activeRowsCount/wheel 按可见 policy 算 + refresh 跳过 + onAdopted 由 refresh 改 layout(覆盖 refresh)。decree(朝令) tab 完全不动。
- `gameStore.test.ts`：+3 测试（空 requires→解锁；未满足→未解锁；国策同）。

## 验证
type-check 干净；`npm test` **639 passed**（636+3）；`npm run electron:build:win` 成功刷新 dist-out。

## 给用户摘要
建造/国策面板现在只显示当前阶段能解锁的项，未解锁的随进度再出现；列表更清爽。
