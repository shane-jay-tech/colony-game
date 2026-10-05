# 暂停态与瞬态字段持久化口径材料（c1004-10，2026-10-06，只读）

- 承 6938 L4＋da6f#2＋913e#2。三面同属「暂停与瞬态的持久化口径」，现值逐处复核。

## 一、三处现值（行号与断言名）

| 面 | 现值 | 断言/出处 |
|---|---|---|
| paused 不落档 | saveLoad.ts:480 deserialize 恒 `paused: false`（serialize 侧不带 paused ⇒ 存档无此键）；且 :754 `paused` 只作为**建筑状态**枚举（非全局暂停） | fullLifecycleLayerTriage.test.ts:7-8「🔴 实测：tickDay() **不看 paused**，暂停住在驱动层 GameScene/UIScene.ts:167」＋:220 `after===before+1`（暂停中手动 tickDay 照推进） |
| breathing 瞬态 | `private breathingState = createBreathingState()`（gameStore.ts:400）——saveLoad 零登记 ⇒ 读档重置为新态 | 6938 L4/da6f#2 登记面 |
| historianIdleDays 瞬态 | private :409；:818/:1356/:1379 三处归零（c1004-05 已验=hist_08 读档清零） | 同上（913e#2） |

另：tickDay **不看 paused** 是设计事实（913e#2「非缺陷」）——驱动层（Scene.update 的 `if (paused) return`）是唯一暂停执行点。

## 二、落档/不落档两案

### 案「落档」（paused+breathing+historianIdleDays 全持久化）

- 改动：serialize/deserialize 对 +3 键（paused 布尔、breathingState 结构、historianIdleDays 数字）＋deserialize 的 :480 `paused: false` 改读档值。
- **将红清单**：fullLifecycleLayerTriage（:220 的「暂停中手动 tickDay 照推进」不受影响，但「读档恒非暂停」语义例若有则翻）；saveLoad 快照族（键集+3 ⇒ 指纹/键集断言同批，参照 c1004-07 gameVersion 同型）；gameStore.test:543 `paused: true` 构造例（deserialize 后保持 true ⇒ 语义变化需断言翻新）。
- **连带**：paused 落档后「读档即暂停」——若读档流程无解除暂停的 UI 路径，玩家读档面对静滞画面（**必须**配套「读档后强制 paused=false」或暂停菜单可见，二选一写入设计）；breathing 落档=呼吸提示节奏跨会话延续（体验向）。

### 案「不落档」（维持现状＋口径文档化）

- 零改动；口径声明：「paused/breathing/historianIdleDays 均为会话瞬态——存档代表『世界状态』不含『会话状态』；暂停由驱动层持有，读档即恢复运行」。
- **将红清单**：零。
- **理由**：三字段都是**体验层瞬态**（暂停是 UI 态、breathing 是提示节奏、idleDays 是提示计数）——落档反而引入「读档即暂停」类新问题；c1004-05 的 hist_07/08 读档漂移已在册（修复走 saveLoad +2 序列化对的独立小单，与本案「全局口径」解耦）。

## 三、建议

**不落档案**（口径文档化写进 saveLoad.ts 头注释）：三字段维持瞬态；c1004-05 的两字段修复独立走（若日间认为 idleDays 该跨会话，再单摘）。
