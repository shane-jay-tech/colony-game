# c927-36 抽屉／侧栏「全局 Esc 关闭」裁决材料（现状盘点＋两案影响面）

- 工单：`c927-36`（cwd `D:\code\colony-game`，软预算 ≤15 分钟）
- 班次：`qoder-executor-20260927-2041-colony46`（只读裁决／普查班）
- 取证时点：2026-09-27 20:4x（本机 `date` 连读 `Sun Sep 27 20:49:38 2026`）
- 仓现值：分支 `codex/architecture-hardening`，HEAD `ab09c23`；`git status --porcelain` ＝ 6 行（在途脏件：`docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-dead-exports-20260914.json`、一枚 `.bak` 删除、`colony-suite-timings-20260921.json`、两枚他班未跟踪产物）⇒ **本文所有 `src/` 读数取自 HEAD 工作树，且 `git status --porcelain -- src/` ＝ 0 行**（脏件全在 docs 侧，`src/` 与 HEAD 无差）
- **零产品码改动、零新增测试件**：唯一入库产物＝本文件
- 兄弟班并发：`qoder-executor-20260927-2024-colony45` 同仓跑 c927-33／c927-35，本单不碰其产物；未跑任何测试（并发窗）

---

## 0. 结论速览

1. 🔴 **锚点的前提在本仓不成立（否证一条初读）**：`20260925-120510-2b5b.result.md`（盘位在 `zcode-bridge/done/`，`outbox/` 无此件＝路径搬家非缺陷）原文写「`Escape` 处理依赖焦点在抽屉内（aside onKeyDown）；焦点在 body 时按 Esc 不关」——它的对象是 **kaoyan-system 的 Next.js DOM 抽屉**（同档 `:8` 点名 `src/components/layout/Sidebar.tsx:115-118`），**不是 colony-game**。本仓 `src/renderer/index.html` 只有一个 `<div id="game-container">`（`:61`），**零 DOM 抽屉／零 `aside`／零 `onKeyDown`** ⇒ 卷宗里"哪些依赖焦点、哪些全局"这一问法在本仓**没有对应物**。
2. **本仓现役 3 处 Esc 已经全部是"全局"**：走 Phaser 键盘插件 `scene.input.keyboard.on('keydown-ESC')`，其 DOM 事件目标默认＝ **`window`**（`node_modules/phaser/src/input/keyboard/KeyboardManager.js:158-165`：`this.target = config.inputKeyboardEventTarget` → 缺省时 `this.target = window`；本仓 `src/renderer/main.ts:28-55` 的 GameConfig **未设** `input.keyboardEventTarget`）⇒ 与 DOM 焦点在不在画布上无关。⇒ **真问题不是"焦点 vs 全局"，而是"全局之后没有栈／没有归属仲裁"**（已在册：`docs/insights/c927-09-focus-stack-design.md`）。
3. **抽屉／侧栏／模态件全量＝21 件**（§2）：有 Esc 监听的 3 件（GameScene 一处代码关两层／BuildingPopover／PolicyTreePanel），其余 **18 件纯指针关闭**（× 钮或背板点击），另有 4 件常驻无需关闭。
4. **一处"文案承诺 ESC、代码零监听"**：`src/renderer/ui/DiplomacyPanel.ts:19` 类注释写「按 ESC 或外区点击关闭」，但全文件 `keydown-ESC` 命中 **0**（§2b）。这是本单唯一"改一行文档就能闭合"的缺陷。
5. **两案影响面（§4）**：案 A（统一全局 Esc＝单入口＋栈）要动 3 个文件的绑定/解绑＋UIScene 一处，并**当场判红在册棘轮测试至少 3 例**；实现形状还被 `vitest.config.ts` 的 `environment: 'node'` 卡住（`window.addEventListener` 在 `UIScene.test.ts:39` 直接跑 `scene.create()` 的路径上会 `ReferenceError`）。案 B（维持现状＋文档／文案收口）改动面＝2 处注释文案，**零测试波及**，但 P1/P3 两类行为缺陷原样保留。
6. **推荐：B 立即做＋A 并入 c927-09 分期做**（§5）——两案不是互斥选项，是**不同时间常数**：B 收"承诺与实现不符"这种纯口径缺口（今天可闭），A 收"一次键关几层"这一产品裁决（必须先拍语义，且与焦点栈是同一件事，**不要做两遍**）。

---

## 1. 键盘面的物理事实（为什么"依赖焦点"在本仓不存在）

| 面 | 实测位置 | 读数 |
|---|---|---|
| 事件目标 | `node_modules/phaser/src/input/keyboard/KeyboardManager.js:158-165` | `this.target = config.inputKeyboardEventTarget`；`if (!this.target && window) this.target = window` |
| 本仓是否覆写目标 | `src/renderer/main.ts:28-55` | GameConfig 只有 `type/parent/backgroundColor/scale/render/dom/fps/scene` 八键 ⇒ **未覆写**，目标＝`window` |
| 绑定动作 | `KeyboardManager.js:226-231` | `target.addEventListener('keydown', this.onKeyDown, false)` |
| DOM 面 | `src/renderer/index.html:61` | 仅 `<div id="game-container">`；全 `src` 内 DOM 焦点 API 零命中（在册断言：`src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts:143-154`「DOM 焦点面同样为空：src 与 public 无 tabindex / focus() / activeElement / autofocus」） |
| 唯一 DOM 元素 | `src/renderer/scenes/IntroScene.ts:245` | 国号输入框 `add.dom(...).createFromHTML(...)`——在**进游戏前**的 IntroScene，与抽屉无交集；全仓 `add.dom` 仅此 1 处（§5 命令） |

⇒ **结论**：本仓 Esc 的"可达性"闸门不是 DOM 焦点，而是 Phaser 的两条内部条件（`KeyboardPlugin` 的 `enabled` 与 `scene.sys.canInput()`）＋ 场景是否在跑。因此卷宗问的「哪些依赖焦点」在本仓应读作「**哪些监听常驻、哪些随开合绑解**」——这才是真差异，见 §2 的「注册生命周期」列。

---

## 2. 判据①：抽屉／侧栏／模态件清单（带 Esc 行为标注）

### 2a. 有 Esc 监听（全集＝3 处注册／3 处解绑，`grep -c "keydown-ESC"` 实测）

| # | 件 | 形态 | 注册 | 解绑 | 生命周期 | Esc 语义 | depth | 归属场景 |
|---|---|---|---|---|---|---|---|---|
| E1 | `scenes/GameScene.ts` | 地图场景（非抽屉） | `:240` | `:582`（SHUTDOWN） | **常驻** | 一处代码关两层：`escHandler`（`:153`）＝ `buildMode.cancel()` ＋ `buildingPopover.hide()` | — | GameScene |
| E2 | `ui/BuildingPopover.ts` | 建筑弹窗（锚定悬浮） | `:188`（在 `show()` 内） | `:374`（`hide()` 内） | **随开合绑解** | 关自己 | `DEPTH = 1100`（`:32`） | GameScene |
| E3 | `ui/PolicyTreePanel.ts` | 国策树／朝令全屏幕板 | `:190`（构造期） | `:787` | **常驻**（`onEsc = () => { if (this.isOpen) this.close(); }`，`:304`） | 开着才关；`close()` 内 `releasePause`（`:299`） | 2000 | UIScene |

⇒ E1/E3 **跨场景同时触发**（Phaser 单 `KeyboardManager` → 各场景 `KeyboardPlugin` 消费同一 queue），E1/E2 **同层双关**（弹窗被关两次）。实测行为读数与四条触发路径已在册：`docs/insights/c927-09-focus-stack-design.md §3a`（P1 跨场景双关／P2 同场景双关／P3 **ESC 穿透模态改背景层**／P4 常驻监听空转）。本单不重跑复现（并发窗＋他班产物重叠），只登记为已知现状。

### 2b. 无 Esc 监听的抽屉／面板／模态（18 件，`grep -c "keydown-ESC"` ＝ 0）

| 件 | 形态 | 现有关闭路径 | 暂停锁 | 背板 | 备注 |
|---|---|---|---|---|---|
| `ui/PopulationPanel.ts` | 全屏幕板 | `× 钮 :98` ＋ 背板 `pointerdown :61` | 无 | 有（点即关） | 纯指针 |
| `ui/ProductionPanel.ts` | 全屏幕板 | `× :134` ＋ 背板 `:75` | 无 | 有 | 纯指针 |
| `ui/GradePanel.ts` | 全屏幕板 | `× :108` ＋ 背板 `:64` | 无 | 有 | 纯指针 |
| `ui/ScoreCardPanel.ts` | 全屏幕板（终局） | `× :121` ＋ 背板 `:80` | 无 | 有 | 纯指针 |
| `ui/MilitaryPanel.ts` | 全屏幕板 | `× :72` ＋ 背板 `:61` | 有（4 处 pause 引用） | 有 | 纯指针 |
| `ui/MegaProjectPanel.ts` | 全屏幕板 | `× :98` ＋ 背板 `:86` | 有 | 有 | 纯指针 |
| `ui/CodexPanel.ts` | 全屏幕板（史官／图鉴） | `× :148` ＋ 背板 `:137` | 有 | 有 | 纯指针 |
| `ui/DiplomacyPanel.ts` | 全屏幕板（邦交） | `× :129` ＋ 背板 `:109` | 无 | 有 | 🔴 注释 `:19` 承诺「按 ESC … 关闭」而**代码零监听** |
| `ui/SettingsPanel.ts` | 模态式面板 | `X 文本钮 :122` ＋ 背板 `:44` | 无 | 有 | 纯指针 |
| `ui/SaveLoadPanel.ts` | 模态式面板（存读档） | `X :104` ＋ 背板 `:69` | 无 | 有 | 纯指针；`show()` 是 **async**（`:124`） |
| `ui/InfluencePanel.ts` | 模态式面板（名望） | `X :101` ＋ 背板 `:32` | 无 | 有 | 纯指针 |
| `ui/EventModal.ts` | 模态（事件） | 仅 choice 按钮 `:198` | 有（5 处） | 无 | 无 Esc ⇒ 只能点选；`choices` 缺省时走自动关（见 c927-35 规格） |
| `ui/CrisisModal.ts` | 模态（危机） | 单按钮 `dismiss :75` | 有 | 无 | 无 Esc |
| `ui/FactionDemandModal.ts` | 模态（通牒） | choice 按钮 `:99` | 有 | 无 | 无 Esc；外部解决时 `hide()`（`:61`） |
| `ui/TutorialModal.ts` | 模态（引导） | 按钮 `:105` | 有（5 处） | 无 | 无 Esc |
| `ui/BuildPanel.ts` | **左侧常驻建造栏**（可折叠 28px 竖条） | 折叠钮 `:111` ＋ tooltip 自隐 `:339` | 无 | — | 折叠件，Esc 语义不适用（"ESC 退建造模式"由 E1 承担） |
| `ui/Legend.ts` | 右下角图例（可折叠） | 标题条 `toggleZone :82` | 无 | — | 同上 |
| `ui/Toast.ts` / `ui/StoryBar.ts` / `ui/ZoomControl.ts` / `ui/HUD.ts` | 通知／旁白／缩放条／顶栏 | 自动消失或常驻 | 无 | — | 非抽屉，Esc 无意义 |

**「全局 vs 常驻 vs 随开合」标注口径**（本仓的真差异，替代卷宗的"焦点依赖"问法）：E1/E3 **常驻**＝窗口级全局且与可见性解耦（P4 空转即此）；E2 **随开合绑解**＝只在弹窗活着时全局；其余 18 件**无键盘面**＝只能指针关闭。⇒ 现状既不是"焦点依赖"也不是"统一全局"，而是**"两处全局常驻＋一处全局随开合＋十八处零键盘"**。

---

## 3. 数据面补充（为什么不能只说"加个全局 Esc 就完了"）

| 事实 | 读数 | 对裁决的意义 |
|---|---|---|
| 关闭 API 面不统一 | `open/close/toggle/isVisible`（如 `PolicyTreePanel.ts:281/293/302`）vs `show/hide/toggle/isVisible`（`SettingsPanel.ts:126-141`、`SaveLoadPanel.ts:119-140`）；`SaveLoadPanel.show()` 是 **async** | 统一入口要面对两套动词＋一个异步件；"注册表"得先约定接口，属设计动作不是改文案 |
| depth 注释与实值不符 | `BuildingPopover.ts:32` 注释「高于 panel(900)、低于 EventModal(1500)/Toast(2000)」，而实测 EventModal/CrisisModal/各全屏板＝**2000**、TutorialModal＝2050、Toast＝**2400**（各文件 `setDepth` 读数，§5 命令） | 案 A 若按 c927-09 §2 的设想"用 depth 当栈序"，注释给的是**错序依据**；须先修注释或显式登记层类秩 |
| 背板语义分裂 | 多数全屏板"点背板即关"，`PolicyTreePanel.ts:130` 注释明写「点遮罩不关闭，用 × 或 ESC」 | "外区点击＝关"与"遮罩＝不吃点击"两派并存 ⇒ 全局 Esc 的"该关谁"没有统一直觉 |
| 暂停锁双源 | 11 件里 6 件持 `acquirePause/releasePause`（`PolicyTreePanel.ts:299` 等），其余不持 | Esc 关层必须连带 release，漏一件＝游戏卡暂停 ⇒ 这是案 A 的真实回归面 |
| 在册棘轮 | `keyboardFlowFocusOrder.test.ts:133` `expect(got.length).toBe(14)` ＋ `:123-131` 键名 unique 清单 ＋ `:165-175`「三文件 ESC 的 on/off 各 1:1」 | **案 A 的第一个红点在这三处**（见 §4 表） |

---

## 4. 判据②：两案影响面

### 案 A：统一全局 Esc（单入口＋栈/归属仲裁）

| 维度 | 形状 A1：Phaser 单入口（`UIScene.create()` 内一处 `keydown-ESC` ＋ 面板注册表按层秩派发） | 形状 A2：DOM `window.addEventListener('keydown')` 统一入口 |
|---|---|---|
| 代码改动点 | 删 E2（`BuildingPopover.ts:187-188/373-375`）与 E3（`PolicyTreePanel.ts:190/787`）的自带监听 → 改注册进 `ui/registry.ts` 表；`GameScene.ts:153/240/582` 保留或并入；UIScene 新增 1 处绑定＋1 处解绑＋SHUTDOWN 清理 | 同 A1，但入口在 DOM 层 |
| 面板侧改动 | 18 件里"该有键盘面"的（全屏板 12 ＋模态 5）各加 open/close 注册或删除自带监听 ⇒ **一件一行，最多 ~17 文件** | 同 |
| **必红在册测试** | ①`:123-131` unique 清单（若仍用 `keydown-ESC` 而删两处绑定 ⇒ 清单不变，但 `:133` 的 `toBe(14)` **必红**，删 2 绑即 10）；②`:165-175` 三文件 on/off 1:1 ⇒ **2 例红**（BuildingPopover／PolicyTreePanel 变 0:0）；③`ui/__tests__/BuildingPopover.test.ts:60-64` 的「ESC 关闭」例依赖自带监听 ⇒ **1 例红**；④`UIScene.test.ts:38-39` 真跑 `scene.create()` ⇒ 新增绑定必须对 `input.keyboard` 缺省安全（`fakeScene.ts:158` 只在 `opts.keyboard` 为真时才造 keyboard 对象） | | ①`environment: 'node'`（`vitest.config.ts:17`）下 **`window` 不存在** ⇒ `UIScene.test.ts:39` 的 `scene.create()` 路径当场 `ReferenceError` ⇒ 需先给测试环境加 jsdom 或做 `typeof window` 守卫；②注意 `keydownBindings` 正则（`:73`）要的是 `keydown-<大写键名>`，`addEventListener('keydown')` **不会**被计入 ⇒ `:133` 的 14 **不涨**，但那是"逃过棘轮"不是"无影响"，反而使普查口径失真 |
| 行为回归面 | P1/P2/P4 改变（一次键只退一层＝新语义）；P3（模态开着时 Esc 穿透改背景层）可被"模态优先／模态吃键"顺手治好 | 同 |
| 附带必修 | release-pause 泄漏防护（6 件持锁件）、`SaveLoadPanel.show()` async 的注册时序、`BuildingPopover` 外区点击监听（`:184` `delayedCall(0)`）的对称清理 | 同＋DOM 键与 Phaser queue 的双触发风险（两条通道并存＝同一按键两次处理） |
| 门禁 | 改 `src/` ⇒ 本仓 pre-commit 跑 type-check＋全量 vitest（40–60 s） | 同 |
| 死闸警告 | 若为"一次 Esc 关几层"加**时序／多帧**断言：`vitest.config.ts` **没有 `testTimeout`**（默认 5e3）⇒ 新断言必须同时给出 timeout 形状（`it(name, fn, ms)` 或 `testTimeout` 显式化），否则性能类断言是死闸 | 同 |
| 与其它单重叠 | 🔴 与 `docs/insights/c927-09-focus-stack-design.md` **同一件事**（该文已给栈设计＋层类秩＋改动面）；另与 `c927-08`（暂停遮罩 depth）、`c927-35`（无 choices 自动关规格）互相牵连 | — |
| 工作量／风险 | 中大（17 文件＋4 组测试同批改）／风险＝暂停锁泄漏、双触发 | 大（要动测试环境）／风险＝DOM 与 Phaser 双通道 |

### 案 B：维持现状＋文档／文案收口

| 维度 | 内容 |
|---|---|
| 改动点（3 处，全为注释或屏上文案） | ①`ui/DiplomacyPanel.ts:19` 删掉「按 ESC 或」四字（或改口径：补监听＝滑向案 A）；②`ui/BuildingPopover.ts:32` 的 depth 注释订正为实值（面板 2000／Toast 2400）；③把「ESC ＝ 退出一切临时态」这一现状语义写进 `docs/`（现有语义只藏在 `GameScene.ts:152` 的一行注释里，且那是"v2 DeepSeek 复审"留下的，无产品口径档） |
| 测试波及 | **0**（`:133` 的 14 不变、②组 1:1 不变、`BuildingPopover.test.ts:60` 不变；文案无断言覆盖 ⇒ 也不会新增守护） |
| 行为 | 完全不变（P1/P2/P3/P4 原样保留） |
| 用户可感知缺陷是否消除 | 只消除"读到假承诺"这一条；"一次 Esc 关三层"与"模态下 Esc 改背景层"仍在 |
| 成本 | 极小（一次写单，3 行） |
| 反向风险 | 把现状**文档化**＝给"无栈"背书；将来真做案 A 时要同步改这份口径档（一处 docs） |

---

## 5. 判据③：推荐

**推荐＝B 立即执行 ＋ A 以「与 c927-09 合并」的形式分期，且 A 采形状 A1。** 理由四条：

1. 卷宗问的"焦点依赖"在本仓不存在（§1 否证），所以"统一全局 Esc"这个动作**没有它看起来的必要性**——现役 3 处 Esc 已经是窗口级全局。把案 A 当成"修 Esc 关不掉"的缺陷来排期会修错东西。
2. 案 A 的真实收益不是"全局"，而是**"一个键关几层的归属仲裁"＋"修掉 P3 穿透"**——这恰是 c927-09 的对象。同一件事在两处排期＝必然漂移。**建议：本单与 c927-09 合并成一张写单**，本档作为其"抽屉侧现状清单"补件。
3. 案 A 有**硬前置**：必须先拍"一个 ESC 关几层"的产品口径（c927-09 §0 结论 4 已把这条列为裁决项），并同步改 4 组在册测试（§4 表列出精确行号）；在口径未拍前排写单＝把红点留给收班。
4. 案 B 三项里没有一项需要裁决：假承诺（`DiplomacyPanel.ts:19`）与错注释（`BuildingPopover.ts:32`）是纯事实订正，第三条（口径档）是把它写下来的地方——**唯一需要人工点头的是"要不要顺便补 DiplomacyPanel 的 Esc 监听"**（那一步＝滑向案 A，本档建议**不补**，等 A 一起做，避免半套键盘面）。

落地顺序建议：B 三项（一张小写单，零测试波及）→ 人工裁"一个 ESC 关几层／模态是否吃键"→ A1（与 c927-09 合并的写单，含测试同步与 timeout 形状）。

---

## 6. 判据④：零码改动自证 ＋ 取证命令

```
$ git branch --show-current; git rev-parse --short HEAD
codex/architecture-hardening
ab09c23
$ git status --porcelain -- src/ | wc -l
0                                   # src 与 HEAD 无差：脏件全在 docs 侧
$ grep -rc "keydown-ESC" src/renderer/ui/*.ts src/renderer/scenes/*.ts | grep -v ":0$"
src/renderer/ui/BuildingPopover.ts:2
src/renderer/ui/PolicyTreePanel.ts:2
src/renderer/scenes/GameScene.ts:2  # 3 文件 × (on+off) = 6 处，与在册棘轮 14 里的 ESC 份额一致
$ grep -rn "keydown-ESC" src --include=*.ts | grep -v __tests__ | wc -l
6
$ grep -rn "addEventListener" src --include=*.ts | grep -iE "key|document|window"
src/renderer/main.ts:82  window.addEventListener('error', ...)      # 崩溃捕捉，非键盘
src/renderer/main.ts:85  window.addEventListener('unhandledrejection', ...)
                                    # ⇒ 全仓零 DOM 键盘监听，无第二通道
$ sed -n '158,165p;226,231p' node_modules/phaser/src/input/keyboard/KeyboardManager.js
this.target = config.inputKeyboardEventTarget;  if (!this.target && window) { this.target = window; }
target.addEventListener('keydown', this.onKeyDown, false);   # 目标＝window，与 DOM 焦点无关
$ sed -n '28,55p' src/renderer/main.ts | grep -c "keyboardEventTarget"
0                                   # 本仓未覆写事件目标
$ grep -rn "add.dom\|createFromHTML" src/renderer --include=*.ts | grep -v __tests__
src/renderer/scenes/IntroScene.ts:245   # 全仓唯一 DOM 元素（国号输入框，进游戏前）
$ grep -n "environment" vitest.config.ts
17:    environment: 'node',          # 案 A 形状 A2 的拦路条件
$ grep -c "testTimeout" vitest.config.ts
0                                    # 无 testTimeout ⇒ 任何新性能/时序断言须自带 timeout 形状
$ grep -n "expect(got.length).toBe(14)" src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts
133                                  # 案 A 第一个红点
$ grep -rn "setDepth" src/renderer/ui/{Toast,EventModal,TutorialModal,CrisisModal}.ts | head
src/renderer/ui/Toast.ts:…2400 ; src/renderer/ui/EventModal.ts:…2000 ; src/renderer/ui/TutorialModal.ts:…2050 ; src/renderer/ui/CrisisModal.ts:…2000
$ grep -n "DEPTH = 1100" src/renderer/ui/BuildingPopover.ts
32:const DEPTH = 1100; // 高于 panel(900)、低于 EventModal(1500)/Toast(2000)   # 注释里 1500/2000 与实值 2000/2400 不符
```

未跑 `npm run type-check`、未跑 `npx tsc -p tsconfig.main.json --noEmit`、未跑任何 vitest（并发窗：兄弟班 colony45 同仓在跑；本单判据不含运行时读数）。§2/§3 全部断言为读码结论，可在上列命令下复算；案 A 的"必红 4 组测试"是静态推断（断言文本与目标改动直接矛盾），采案时须自跑 `npx vitest run src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts src/renderer/ui/__tests__/BuildingPopover.test.ts src/renderer/scenes/__tests__/UIScene.test.ts` 复核。

临时件：`tmp/qoder-executor-20260927-2041-colony46/per_event.txt`（c927-37 用的中间清单）——`tmp/` 在本仓 `.gitignore:25` 内（实测 `git check-ignore -v` 命中该条），收班前自清。

---

## 7. 遗留问题（交主班／人工）

1. 🔴 **卷宗口径缺陷（本单最重要的一条）**：`c927-36`／`c927-35` 两单共用 `2b5b` 锚点，而 2b5b 的正文对象是 **kaoyan-system 的 DOM 抽屉**，cwd 却是 colony-game。若规划班本意是裁 kaoyan 的抽屉 Esc（那侧才有"焦点在 body 时不关"的真缺陷），本单**答不了那一问**——需另开 kaoyan 域的对应单（`src/components/layout/Sidebar.tsx:115-118` 为起点）。本档按 cwd 只答 colony-game 侧。
2. "一个 ESC 关几层"未拍（案 A 前置）；模态是否应吃 Esc（P3 穿透）未拍 ⇒ 两条都在 c927-09 的裁决面上，建议合并。
3. `DiplomacyPanel.ts:19` 假承诺：采案 B 时**改文案**；采案 A 时**补监听**。两者不可同时做，本档不代拍。
4. `BuildingPopover.ts:32` 的 depth 注释与实值不符（1500/2000 vs 2000/2400）——纯事实订正，可与 B 同批；另注 c927-08 已裁"不抬暂停遮罩层级"，本单不重开那一题。
5. 背板语义两派（点遮罩关 vs 遮罩不吃点击）与 `SaveLoadPanel.show()` 的 async 形状，是案 A 注册表设计必须处理的两个不一致点，c927-09 设计稿未覆盖 ⇒ 合并时补进它的 §5。
6. 本班未跑任何测试／type-check；判据④"零码改动"以 `git status --porcelain -- src/` ＝ 0 自证，未覆盖 docs 侧（docs 侧脏件是他班在途，本单不碰）。
