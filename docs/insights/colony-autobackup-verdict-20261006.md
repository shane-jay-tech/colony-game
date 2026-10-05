# 坏档自动回退功能裁决材料（c1004-16，2026-10-06，只读）

- 承 913e 遗留 4。**现值**：loadFromSlot（saveLoad.ts:858-873）失败即抛 SaveLoadError（JSON 损坏 :867＋deserialize 域 :223-457 各类）；UI 接错点唯一=SaveLoadPanel.ts:195（catch 后 toast「操作失败/该存档不存在或已损坏」，:199-206）——**无产品侧自动回退**。而 main/index.ts:162-165 **.bak 前一代已在写侧就绪**（覆盖前 copyFile，每槽保留前一代），**但 preload 未暴露 bak 读接口**（load-game 只读 .json；list-saves 只滤 .json）——回退的数据在盘上、通道缺失。

## 一、自动回退功能案

### 触发条件
loadFromSlot(slot) 抛 SaveLoadError（含 JSON 损坏与 deserialize 域两类）时触发；`loadGame 返回 null`（档不存在）**不**触发（无档≠坏档）。

### .bak 选取规则
- 取 `slot.json.bak`（写侧唯一前代）；无更早代（写侧每槽只保一代）。
- .bak 也坏 ⇒ 停止回退，维持现状抛错+提示（不无限链）。
- 前置依赖 **c927-03**（写盘次序改法）：若该案把「先写 .bak 再 rename」的次序调整，回退取的「前一代」语义需按新次序复核——**依赖标注：本功能落地须排在 c927-03 之后（或同笔）**，否则可能回退到半截写。

### 提示文案
「存档 X 已损坏，已自动恢复到上一次保存的版本（.bak）」/「.bak 同样损坏，无法恢复」两态（SaveLoadPanel toast，error/warn 分级）。

### 改动面（三处）
1. main/index.ts：+`load-game-bak` IPC handler（读 slot.json.bak，~8 行）；
2. preload/index.ts：+`loadGameBak(slot)` 暴露（~2 行）；
3. SaveLoadPanel.ts:195：catch SaveLoadError → 试 loadGameBak → 成功则 replaceState+warn toast、失败维持现 toast（~12 行）。
合计 ~22 行，UI 面单点。

## 二、红名单与风险

- badSampleRestore.test：loadFromSlot 抛错路径例**不翻**（回退在 UI 层，saveLoad 契约不变）；新增回退路径例 +2（成功恢复/.bak 也坏两态）。
- 风险：.bak 本身可能是**更旧的世界状态**——玩家会丢「损坏档之后到上一次保存」的进度；提示文案必须明示（已含）。
- 数据面：回退**只读不改写**（不把 .bak 提正覆盖坏档——保留坏档供排障/抢救，与 913e 测试内「.bak 提正」手法不同，更保守）。
