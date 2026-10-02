# c927-07 · 键盘无鼠标完成核心流程：三入口最小实现（走查表与交付说明）

> 📌 **重落登记（c1001-01，2026-10-03）**：本档描述的实现曾被 `97fef2b`（9/28）回退（tmp/handover 留档现已被清），
> 现按 c927-07 材料逐字重落盘（ModeSelectScene/IntroScene/EventModal 三生产件＋keyboardThreeEntries.test.ts 19 例＋
> keyboardFlowFocusOrder 现状钉 5 处改钉同笔）。普查读数 32 处／21 键名与本档 §2 下方 c927-07 记录**原样复现**。
> §2 表内「落点行号」仍是 9/28 工作树版的行号，对现盘已漂，引用时按 HEAD 现取，勿沿用。
> 本登记为 append-only 注记，正文零改写。

- 班：`qoder-executor-20260928-0255-colony52`（波次 42 · 代码写位）
- 卷宗：`zcode-bridge/inbox/c927-07.task.md`（现随结果件移至 `done/`）
- 上游裁决来源：`zcode-bridge/done/20260925-120433-4686.result.md` 遗留问题 1（「最小可派实现」）
- 仓／分支：`D:\code\colony-game` @ `codex/architecture-hardening`（本班开工现点 HEAD `9e084b3`）

## 1. 这三处为什么可以「零数值风险」

4686 档给的最小形状只做一件事：**给已经存在的鼠标入口再开一个键盘入口**。
被调用的选择函数（`chooseSandbox`／`chooseStory`／`tryStart`／`resolveEvent`）一个都没新增、没改写，
守卫（IntroScene 的邦名正则与身份必选、EventModal 的 pending 判定）也全部原样复用 ⇒
键盘路径能做到的事，鼠标路径本来就能做；反之不新增任何可达状态。

## 2. 逐入口键盘路径走查表

| 入口 | 文件 | 键 | 落点（生产码行号＝本班改后工作树版） | 与鼠标路径的关系 | 走查要点 |
|---|---|---|---|---|---|
| ① 择途屏 | `src/renderer/scenes/ModeSelectScene.ts` | `UP` | `keyboardCursorUp` → `moveKeyboardCursor('sandbox')` | 复用卡片既有 `hovered` 态的 `paintCard`，不新增绘制分支 | 光标初值 `null`（进屏即按 ENTER 落第一张＝沙盒） |
| | | `DOWN` | `keyboardCursorDown` → `moveKeyboardCursor('story')` | 同上 | 两卡高亮互斥（一张亮另一张必灭） |
| | | `ENTER` | `keyboardConfirm` → `chooseStory()` 或 `chooseSandbox()` | **与点卡片 `pointerup` 同一个函数** | 不写第三条选择路径；`scene.start('IntroScene')` 走原链 |
| | | 解绑 | `shutdown()` 首行 `unbindKeyboard()` | 与 `bindKeyboard()` 三枚键 1:1 | 本仓「焦点丢失」真形态＝漏 `off`（4686 ② 组口径） |
| ② 立国屏 | `src/renderer/scenes/IntroScene.ts` | 进屏自动聚焦 | `create()` 里 input HTML 补 `autofocus` ＋ `typeof inputEl.focus === 'function'` 时显式 `focus()` | 免掉「先用鼠标点输入框」这一步 | ⚠ 单靠 `autofocus` 不成立：DOMElement 是**运行中注入**的节点，Chromium 只对首次解析的 HTML 触发 autofocus ⇒ 显式 focus 才是真落点。测试 fake 的 node 无该方法（`fakeScene.ts` 属在册待裁决件，本班不动）⇒ 先验再调，既有 `IntroScene.test.ts` 因此零受影响 |
| | | `ENTER` | `keyboardEnterHandler` → `tryStart()` | **与点「立 邦」`pointerdown` 同一个函数** | 邦名非法或未选身份时按 ENTER 不推进（守卫同源，不会误受其位） |
| | | 焦点在输入框时 | Phaser 的 keydown 挂在 `window`（`KeyboardManager.target`，本仓未配 `inputKeyboardEventTarget`） | — | 故打字途中按 ENTER 仍会到 Phaser ⇒ 直接受其位；这是**期望行为**，不是串扰 |
| | | 解绑 | `shutdown()` 首行 `input?.keyboard?.off('keydown-ENTER', …)` | 1:1 | 同上 |
| ③ 朝议模态 | `src/renderer/ui/EventModal.ts` | `1`…`N` | `bindChoiceKeys()` 逐枚选项绑 `keydown-ONE`…（N＝实有按钮数） | 只做「选中」，**不直接结算** | 两步式防误触：数字键改 `keyboardChoiceIdx` 并走既有 `layout()` 重绘高亮（GOLD 实色，复用既有色值） |
| | | `ENTER` | `handleChoice(keyboardChoiceIdx)` → `store.resolveEvent(idx)` | **与点选项 `pointerdown` 同一个函数** | 没按过数字键时 ENTER 什么都不做（不会默认结掉第 0 格） |
| | | 绑定时机 | `handleTriggered()` 内 `rebuildButtons()` 之后 | 只在模态可见期间挂着 | 解绑点在 `clearButtons()` ⇒ 结清 / 换档（`STATE_REPLACED`）/ `destroy()` 三条路径都自动解绑，与绑定 1:1 |
| | | 越界保护 | `CHOICE_KEY_EVENTS` 表长 9 | — | 在册事件最大选项数＝4（本班脚本实测：2 选项 27 个、3 选项 10 个、4 选项 35 个）⇒ 9 格有余；真出现 >9 枚时多出的格子保持只有鼠标口，不抛错 |

## 3. 已知串扰与未闭合项（本班没有顺手改，属越界面）

1. **数字键 1/2/3 与 GameScene 的速度档共用**：`UIScene` 是 `GameScene` 并行 launch 的独立场景
   （`GameScene.ts:249`），两景各挂各的 keyboard ⇒ 模态开着时按 `2` 会**同时**「选第二枚选项」与
   「恢复用户口暂停＋定档 2」。因模态持 `pauseHolders` 引用计数，`isPaused()` 仍为 true，
   游戏不会在抉择期间跑起来；但速度档会被静默改掉。要消掉得改 `GameScene` 的键处理（不在本单产出内）。
2. **`NUMPAD_ENTER` 未接**：三处都只钉主键盘 `ENTER`（Phaser 把两者当两个键码名）。
   数字小键盘回车在立国屏与模态上不会确认。
3. **屏上无键位提示**：三入口都没加「↑↓ 选择 · Enter 确认」这类文案，鼠标用户不受影响，
   键盘首launch 者只能靠猜。加提示要动文案面（另属产品裁量），本班未加。
4. **择途屏高亮会被鼠标打断**：`pointerout` 把 `hovered` 置 false ⇒ 键盘光标仍在该卡但视觉熄灭，
   此时按 ENTER 仍按键盘光标走。要做到鼠标与键盘不打架，需把 hovered 拆成 hover/focus 两态（改动面更大）。

## 4. 零数值改动自证（可复跑）

对三处生产码的 diff 取「新增行数字多重集 − 删除行数字多重集」（先剥掉注释行与行尾注释）：

```
新增行数字 = {"0":1, "3":1, "0.92":1}
删除行数字 = {"3":1, "0.92":1}
净变化     = {"0":1, "3":0, "0.92":0}
```

唯一净增的数字 `0` 来自 `for (let i = 0; i < this.buttons.length; i++)` 的循环下标初值；
`3`（`maxlength="3"`）与 `0.92`（按钮底色 alpha）是**原样搬过来的旧值**，净变化为 0。
diff 里没有 `data/` 与 `balanceConfig` 的任何一面，也没有新增任何资源／产出／消耗／时长量。

## 5. 测试面

- 新增：`src/renderer/scenes/__tests__/keyboardThreeEntries.test.ts`（19 例，三入口逐一真触发生产回调）
- 定向三件（卷宗点名的既有对应测试件）：`ModeSelectScene.test.ts` 4 例／`IntroScene.test.ts` 3 例／`EventModal.test.ts` 13 例全绿
- 邻居（同场景装配链）：`ModeSelectSceneShutdown.test.ts` 3 例／`IntroSceneShutdown.test.ts` 3 例／`UIScene.test.ts` 4 例全绿
- 🔴 在册缺口现状钉 `keyboardFlowFocusOrder.test.ts`：**5 例转红**（该件 ①③ 两组钉的正是「这两屏与四张模态只能鼠标」，
  本单把缺口关掉 ⇒ 现状钉必然失效）。本班未动该件（不在卷宗产出点名范围内），改法交主班裁，见 result「遗留问题」。
