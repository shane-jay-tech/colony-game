# colony P2-3 反馈钩子批次一核对（c922-106，2026-09-22T03:44 取数）

> 用途：批次一（危机 warn ＋ 资源不足）落地状态核对，供后续批次（放置/完工/晋升）派单用真实现值。
> 边界：**本单零代码改动、零测试新增、未触碰 public/ 与任何在途禁区文件**。取数 cwd `D:\code\colony-game`，HEAD `918de49`（分支 `codex/architecture-hardening`，ahead 33）。
> 写档人：Qoder 执行班 `qoder-executor-20260922-0000-colony5`。

## 一、结论速览

1. **任务书前提已过期**：`docs/insights/colony-p23-hooks-map-20260919.md`（c919 前浪写的只读缺口表）称「五类事件在场景层全部缺反馈钩子」，但该表落地后紧接的两笔提交已把批次一两类做完——
   - `51f46ed` **c919-03a** 危机时刻：`src/renderer/scenes/UIScene.ts:107-110` `onCrisisTriggered` 告急 toast（注释即写明「P2-3 危机时刻反馈（c919-03）」）。
   - `4ecc2b6` **c919-03b** 资源不足：`src/renderer/scenes/GameScene.ts:519-523` `toastFailure` 对 `insufficient_resources`/`insufficient_labor` 播 `sfx_warn`（并把 `AudioManager.playSfx` 转公开以走 registry）。
   两者各自带防回归用例（见第四节），本单无缺口可补。
2. 因此本单**不新增接线**：按任务书再往 UIScene 加一次 `sfx_warn` 会变成三重播放（第三节实测推导），属主动引入噪声化缺陷，故拒绝执行。
3. 批次二/三（放置、完工、晋升）同样**早已非零**：音效侧全部由 `AudioManager` 的 store 监听承担，toast 侧晋升有 `UIScene.ts:79-83`。⇒ P2-3 的实质工作已全部落地，`docs/design/OPTIMIZATION_BACKLOG.md:51` 的 `[ ]` 未勾属**关单动作缺失**而非工作量缺失（该文件是他班 ` M` 在途件，本单未改）。

## 二、五类事件现状核对（磁盘实测，行号为 2026-09-22 HEAD 现值）

| 事件 | toast 落点 | 音效落点 | 判定 |
|---|---|---|---|
| 建筑放置 | 视觉脉冲 `GameScene.ts:200` + 金边（无文案 toast） | `AudioManager.ts:31` `onPlaced` → `sfx_place` | 有反馈 |
| 建筑完工 | 同上（`GameScene.ts:201` 完成脉冲） | `AudioManager.ts:30` `onBuildingDone` → `sfx_chime` | 有反馈 |
| 资源不足 | `GameScene.ts:518` `'资源不足，无法建造'` / `'劳力不足——…'`，kind `error` | `GameScene.ts:522` `playSfx('sfx_warn', 0.5)` ＋ Toast error 分支（见第三节） | **批次一，已落地** |
| 国格晋升 | `UIScene.ts:82` `国格晋阶 · …`，仅 `reason === 'ascend'` | `AudioManager.ts:38-40` `onGradeSfx` → 晋格 `sfx_gong` / 降格 `sfx_warn` | 有反馈 |
| 危机时刻 | `UIScene.ts:109` `邦中告急：…`，kind `error` | `AudioManager.ts:33` `onCrisis` → `sfx_gong` ＋ Toast error 分支 | **批次一，已落地** |

场景层 `playSfx|playUi` 字面量分布（`rg -c` 实测）：`GameScene.ts` **1** 处、`UIScene.ts` **0** 处、`AudioManager.ts` **11** 处。UIScene 零字面量是**设计使然**——音效集中在 AudioManager 的 store 监听，场景层只出文案，避免两处各播一份。

## 三、本浪新发现：`sfx_warn` 双重播放（在册缺陷，未修）

`src/renderer/ui/Toast.ts:21-26`（A-2 批）对 **kind==='error'** 的 toast 已经自行播放 `playUi('sfx_warn')`（`AudioManager.ts:149-152` 内 `sfx_warn` 音量 0.5）。而批次一两类恰好都走 error toast：

- 资源不足：`GameScene.ts:518` `toast.show(..., 'error')` → 第一声 `sfx_warn`；`GameScene.ts:522` 再 `playSfx('sfx_warn', 0.5)` → 第二声，**同键同音量叠两次**。
- 危机时刻：`UIScene.ts:109` error toast → `sfx_warn`；`AudioManager.ts:33` 另播 `sfx_gong`（不同键，属和声不算重复）。

⇒ 若按 c922-106 任务书在 UIScene 再补显式 `sfx_warn`，危机会是 `sfx_gong + sfx_warn × 2`，与 `4ecc2b6` 提交说明「避免噪声化」的意图直接相反，故本单不动。
⇒ 真正该修的是**资源不足那一侧的叠播**（`GameScene.ts:522` 的显式调用与 Toast 的 A-2 分支二者择一，出口：删显式调用 / 或给 `Toast.show` 加 `silent` 入参让调用方接管）。这属行为改动＋触及 A-2 既有裁决，**不在本单范围，交主班派单**。

## 四、既有防回归用例（本单复核为绿，未改）

- `src/renderer/scenes/__tests__/GameSceneToastFailure.test.ts` 3 例：`:35-36` 钉 `show('资源不足，无法建造','error')` ＋ `playSfx('sfx_warn',0.5)`；`:49` 第二路（劳力不足）。
- `src/renderer/scenes/__tests__/UIScene.test.ts` 4 例：`:92-93` 以「邦中告急」子串过滤后断言 toast，注释明确排除 CrisisModal 等其它监听者的 show。

现场复跑：`npx vitest run src/renderer/scenes/__tests__/GameSceneToastFailure.test.ts src/renderer/scenes/__tests__/UIScene.test.ts` ⇒ **7 passed / rc=0**（UIScene 798 ms 仍是全仓最慢件之一，本单未改其 setup）。

⚠️ 上述用例都用 mock toast/registry，**第三节的双声叠放对单测不可见**——这正是它活到今天的原因。

## 五、给派单侧的出口

1. **P2-3 可关单候选**：五类事件 toast/音效双向均非零（第二节表），关闭前请先裁决第三节的双播缺陷（修完再关，或关 P2-3 另开一条「warn 双声」）。`OPTIMIZATION_BACKLOG.md:51` 那条 `[ ]` 由主班/规划侧勾，本单无授权改在途件。
2. **c922-106 完成标准第 1 条判据需重定义**：`rg -c "sfx_warn|sfx_click" GameScene.ts UIScene.ts ≥2` 实测 1（UIScene 恒 0 属设计）。要么改成「跨 GameScene/UIScene/AudioManager 三文件 ≥2」，要么按第一节结论直接判本单前提失效。
3. **本档未进 insights 索引**（索引重建需授权，见 `colony-dead-exports`／insights 索引在册项）。
