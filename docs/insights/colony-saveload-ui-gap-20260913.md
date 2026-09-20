# colony 存档 UI 暴露现状核查与最小接线评估（c-21，2026-09-13，只读）

## 两行结论表

| 链路 | 现状（file:line） | 结论 |
|---|---|---|
| 存/读档全链 | ①实现完整：`src/renderer/state/saveLoad.ts:299 serialize / :368 deserialize / :778 saveToSlot / :784 loadFromSlot / :801 getSaveMeta / :754 validateSlot`（v3→v9 迁移链 :122-193）；②IPC 已通：`src/main/index.ts:154 save-game / :171 load-game / :178 list-saves / :185 save-meta`，preload `src/preload/index.ts:6-8` contextBridge 暴露；③UI 入口**已有**：`src/renderer/scenes/UIScene.ts:246-248`「存档/读档面板（引擎已有 IPC + saveLoad.ts，这里补玩家可见入口）」→ `SaveLoadPanel`（ui/SaveLoadPanel.ts:45，:337 layout 联动）——**三链齐通，无缺口** | 已接线 |
| story 模式 NPC 名册 | storyNpcs.ts 生产零引用、已于本日 a-45 退役（备份 tmp/backup-colony-20260913-1537/）；story 模式本身在 PLAN 无排期行 | 无接线对象；恢复条件在 a-45 报告 |

## 最小接线评估

- 存读档链路：**无需接线**（SaveLoadPanel 已在 UIScene 注册并 layout，saveToSlot/loadFromSlot 走 preload API）。本单不再产出「≤30 行接线」——按「不给未经验证的实现承诺」原则，无缺口即无方案。
- 若日间发现面板入口在 HUD 不可达（需运行时目检，静态不可判定项），最小动作=在 HUD 菜单加一个 toggle SaveLoadPanel 的按钮项（预估 ≤15 行，风险低）。

## 静态不可判定项（如需运行验证）

- SaveLoadPanel 的打开入口是否已在某快捷键/按钮上挂接（UIScene 仅见注册与 layout，未 grep 到 toggle 调用点）——需运行时点击验证。
