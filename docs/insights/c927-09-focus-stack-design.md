# c927-09 一次 ESC 关掉多层：焦点栈最小设计稿（OPTIMIZATION_BACKLOG 候选）

- 工单：`c927-09`（cwd `D:\code\colony-game`）
- 班次：`qoder-executor-20260927-1820-colony40`（波次 22 只读采集班）
- 取证时点：2026-09-27 18:0x–18:1x（`date` 连读 `Sun Sep 27 18:11:01 2026`）
- 仓现值：HEAD `27c00b0`；`git status --porcelain -- src/` ＝ 0 行
- **零码改动**：本文是唯一入库产物（`docs/insights/`）；复现件只落 `D:\code\tmp\qoder-executor-20260927-1820-colony40\`，收班自清，**不进仓、不进 pre-commit 全量**
- 锚点：`done/20260925-120433-4686.result.md:114-115`（按 brief §3a 从 `done/` 取，`outbox/` 无此件＝路径搬家非缺陷）

---

## 0. 结论速览

1. **缺陷成立且已跑成行为读数**（不是文字推断）：一次 `keydown-ESC` 同时关掉**三层**——拆除模式（`BuildMode.isActive()` false）＋建筑弹窗（`BuildingPopover.isVisible()` false）＋国策树全屏幕板（`PolicyTreePanel.isVisible()` false）。复现件 3 例全绿、`rc=0`（§3）。
2. **机制根因在 Phaser 的键盘拓扑，不在本仓代码写法**：单个 `KeyboardManager` 收一次 DOM keydown → 推入**共享 queue** → 每个场景的 `KeyboardPlugin` 各自 `update()` 消费同一 queue（`node_modules/phaser/src/input/keyboard/KeyboardManager.js:183-210`、`KeyboardPlugin.js:220/:731-775`），闸门只有 `this.enabled && this.scene.sys.canInput()`（`KeyboardPlugin.js:240`）⇒ **GameScene 与 UIScene 的监听天然同时触发**。且 Phaser 给了 `stopPropagation`（把 `event.cancelled` 置 -1 阻断后续场景，`KeyboardPlugin.js:758-768`）——**本仓 3 处 ESC 处理器没有一个用它**（全仓 8 处 `stopPropagation` **全部挂在 `on('pointerdown', …)`**，键盘面 0 处；见 §1a 末列与 §4）⇒ 这就是"无栈"的物理形态。
3. **好消息：不需要新造轮子级重构**。全仓 ESC 注册点只有 **3 处**（下表），面板 API 面窄（`open/close/toggle/show/hide/isVisible`）。最小设计＝**一个栈对象＋一个 ESC 入口＋逐层注册**，改动集中在 3 个文件的 6 行绑定/解绑＋各面板 open/close 各一行。
4. **但它是产品裁决**，不是纯技术清理：现状"`ESC`＝退出一切临时态"很可能是**故意**的（`GameScene.ts:152` 注释「v2 DeepSeek 复审[边界]：ESC 同时关掉可能开着的建筑 popover，避免残留悬浮 UI」）。改成逐层退之前，要先裁"一个键到底关几层"。设计稿给的是**能承载两种裁定的结构**，不预设结论。

---

## 1. 判据①：ESC 监听点清单（全仓穷举，带 file:line）

### 1a. 有 ESC 监听的（全集＝3 处注册／3 处解绑）

| # | 层 | 注册 | 解绑 | 处理器实际行为 | 归属场景 | 是否用 `stopPropagation`/`cancelled` |
|---|---|---|---|---|---|---|
| E1 | 建造/拆除模式 ＋ 建筑弹窗 | `src/renderer/scenes/GameScene.ts:240` | `GameScene.ts:582` | `GameScene.ts:153` `escHandler = () => { this.buildMode?.cancel(); this.buildingPopover?.hide(); }`（**一处代码关两层**） | GameScene | **否** |
| E2 | 建筑弹窗（自身 ALSO 独立监听） | `src/renderer/ui/BuildingPopover.ts:188`（在 `show()` 内绑） | `BuildingPopover.ts:374`（`hide()`/`destroy()` 内解） | `BuildingPopover.ts:187` `escHandler = () => this.hide()` | GameScene（`GameScene.ts:199` 传入 `this`） | **否** |
| E3 | 国策树／朝令全屏幕板 | `src/renderer/ui/PolicyTreePanel.ts:190`（构造期绑，常驻） | `PolicyTreePanel.ts:787` | `PolicyTreePanel.ts:304` `onEsc = () => { if (this.isOpen) this.close(); }`（`close()` 内 `releasePause`，见 `:789` 同路径） | UIScene | **否** |

⇒ E1 与 E2 都关弹窗（同一层被关两次，幂等但说明**无归属仲裁**）；E1 与 E3 跨场景，一次按键双关。

### 1b. **注释声称能用 ESC、实际零监听**的（新增缺陷，锚点未记）

普查 20 个 UI 类的 `keydown-ESC` 命中数（命令见 §4）：`DiplomacyPanel／SaveLoadPanel／SettingsPanel／CodexPanel／InfluencePanel／GradePanel／MilitaryPanel／EventModal／CrisisModal／TutorialModal／FactionDemandModal／PopulationPanel／ProductionPanel／MegaProjectPanel／ScoreCardPanel／Legend／StoryBar／ZoomControl／HUD／BuildPanel ＝ 全 0`。

其中 **`src/renderer/ui/DiplomacyPanel.ts:19` 的类注释写「不暂停游戏（玩家可以一边看 NPC 一边推日子）；按 ESC 或外区点击关闭」** ⇒ 注释承诺的 ESC 分支**在生产码里不存在**（本仓唯一一处"文档说有、代码说没有"的 ESC 承诺）。另 `PolicyTreePanel.ts:164` 的屏上提示文案 `'… ESC 关闭'` 是**真能兑现**的（E3），`CodexPanel.ts:47` 帮助文里的「右键/ESC 退出拆除」兑现的也是 E1 ⇒ 玩家读到的三处"ESC"里，只有一处半靠得住。

⇒ 这条不是焦点栈缺陷，是**文案/注释与实现的口径缺口**，最小改法两种（补 E 监听 or 改文案），属裁决项，已登记在 §6 遗留。

### 1c. 键盘面总盘（防重复计数）

在册棘轮 `src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts:133` 钉死**全仓键盘绑定＋解绑共 14 处（7 绑 7 解）**，键名全集＝`ESC/SPACE/ONE/TWO/THREE`（unique 清单在 `:123-131`）。ESC 占其中 3 绑 3 解。**任何焦点栈改动的第一个红点就是这两行。**

---

## 2. 层清单与"该谁关"的现值口径

栈排序要有依据，本仓天然依据＝**渲染 depth**（c927-08 的 depth 全表，本单不重列，见 `docs/insights/c927-08-pause-mask-depth-adjudication.md §2a`）：

| 层类 | depth（同场景内） | ESC 现状 | 键盘可达性 |
|---|---|---|---|
| 模态（EventModal/CrisisModal/FactionDemandModal 2000、TutorialModal 2050） | 最高 | **无监听** | 只有指针口（在册 ③ 组已钉：`keyboardFlowFocusOrder.test.ts` ③ 组） |
| 全屏幕板（政策树/军务/邦交/大业/史官/国格/记分牌/存档/设置/图鉴/人口/生产 2000，背板 1999） | 次高 | 仅政策树 E3 | 部分 |
| HUD／BuildPanel 及其 tooltip／跳字（1000/1100） | 中 | E1 连带关弹窗 | — |
| 图例／缩放条／故事栏（950/999） | 中低 | 无 | — |
| 地图侧（GameScene，含弹窗 1100） | 独立场景 | E1/E2 | — |

⇒ **depth 与"该先关谁"目前恰好同向**（越亮越该先退），这是"用 depth 当栈序"的天然理由；但 depth 是**场景内**可比、跨场景不可比（c927-08 §2b），所以栈序不能直接拿 depth 数字当键，必须显式登记层类秩（见 §5 的 `LayerKind`）。

---

## 3. 判据②：双层（实为三层）关闭的复现路径 ＋ 实测读数

### 3a. 触发路径（四条，按可达性排序）

| 路径 | 前置态 | 一次 ESC 的实际后果 | 玩家体感 |
|---|---|---|---|
| **P1 跨场景双关**（本单主案） | 打开国策树（HUD 主功能条 → `HUD.ts:468-506` 的 `policyTreePanel`）**且**地图上正开着建筑弹窗 | E3 关树 ＋ E1/E2 关弹窗（弹窗被两处各关一次）＋ 若正在建造/拆除则一并取消 | 想退一层，三层全没了；得重新点开 |
| **P2 同场景双关** | 建造模式激活 ＋ 弹窗开（无面板） | `GameScene.ts:153` 一行取消模式＋关弹窗 | 同上，且这是 `:152` 注释里**故意**的 |
| **P3 ESC 穿透模态**（反向缺陷） | EventModal／CrisisModal 开着（自动持暂停锁），底下建造模式仍激活 | 模态**不关**（无监听），但**底下的建造模式被取消** | 最坏形态：该关的没关、不该动的被改了——背景层被"穿透"改动 |
| **P4 常驻监听空转** | 政策树已关（面板隐藏），弹窗开 | E3 的 `onEsc` 因 `isOpen` 为假而空转，E1/E2 正常关 | 无异常，但说明监听**与可见性解耦**：栈必须按"活层"而非"已构造层"计数 |

### 3b. 复现件（只落 tmp，已跑）

- `D:\code\tmp\qoder-executor-20260927-1820-colony40\esc-double-close.repro.test.ts`（P1/P4 行为面，真类别：`GameScene`/`BuildingPopover`/`PolicyTreePanel`/`BuildMode`/`GameStore` 全部生产实现，fake scene 复用在册共享夹具 `src/renderer/ui/__tests__/fakeScene.ts`）
- `D:\code\tmp\qoder-executor-20260927-1820-colony40\vitest.repro.config.ts`（`root` 仍指仓根，`include` 越界点到 tmp ⇒ 复现件不进仓）
- `D:\code\tmp\qoder-executor-20260927-1820-colony40\phaser-stub.ts`（**坑**：仓外文件的 `vi.mock('phaser')` 键解析不到真 id，收集期加载真 phaser ⇒ `ReferenceError: window is not defined`；改 `resolve.alias.phaser` 才命中。已在册的写单若要落长期桩，**必须放仓内**，别复用这条 tmp 路径）

跑法与读数（定向 3 例，未跑全量）：

```
$ npx vitest run --config D:/code/tmp/qoder-executor-20260927-1820-colony40/vitest.repro.config.ts
 ✓ ../tmp/qoder-executor-20260927-1820-colony40/esc-double-close.repro.test.ts  (3 tests) 29ms
 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  18:11:01
VITEST_RC=0
```

三例断言：①广播面上 `keydown-ESC` 监听数＝**3**；②一次 `emit('keydown-ESC')` 后 `panel.isVisible()／buildMode.isActive()／popover.isVisible()` **三者齐 false**（前置态三者齐 true）；③连按两次无"逐层弹栈"语义（第二次按键无可关层，监听数不随层数收敛）。

---

## 4. 取证命令（可复算）

```
$ grep -rn "ESC\b" src/ --include=*.ts | grep -v "__tests__"           # 注册/解绑/文案三类命中，见 §1
$ for f in <20 个 ui 类>; do grep -c "keydown-ESC" src/renderer/ui/$f.ts; done   # 1a 之外全 0
$ grep -rn "stopPropagation\|cancelled\|stopImmediatePropagation" src/ --include=*.ts | grep -v __tests__
  # 8 命中，全部在 on('pointerdown', …) 里（DiplomacyPanel.ts:130/185/195/205、GradePanel.ts:109、
  # PopulationPanel.ts:99、ProductionPanel.ts:135、ScoreCardPanel.ts:122）——用途＝点面板不吃到地图。
  # 键盘面 0 处 ⇒ 一次 ESC 没有"已消费"标志可停，天然全广播。
  # 反面价值：本仓已经会用"吃掉事件"这套机制，只是只用在了指针面。
$ grep -n "expect(got.length).toBe(14)" src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts  # :133 棘轮
$ sed -n '238,241p;731,775p' node_modules/phaser/src/input/keyboard/KeyboardPlugin.js                   # canInput 闸门 + queue 广播
$ sed -n '183,215p' node_modules/phaser/src/input/keyboard/KeyboardManager.js                            # 单一 queue + MANAGER_PROCESS
$ npx vitest run --config D:/code/tmp/qoder-executor-20260927-1820-colony40/vitest.repro.config.ts       # 3 passed rc=0
```

---

## 5. 判据③：焦点栈最小设计稿

### 5a. 数据结构（新文件，建议 `src/renderer/ui/focusStack.ts`）

```ts
/** 层类秩：跨场景不可比的 depth 数字不做栈序，改用显式秩（同秩内后入先出）。 */
export type LayerKind = 'modal' | 'fullscreen' | 'drawer' | 'transient' | 'map';   // 2000/2050 | 2000 面板 | HUD 抽屉 | popover/建造模式 | 地图选择态

export interface FocusLayer {
  readonly id: string;              // 'policyTreePanel' / 'buildingPopover' / 'buildMode' …（与 registry 键同名，便于对账）
  readonly kind: LayerKind;
  isOpen: () => boolean;            // 由层自己判活（P4 要求：常驻监听不等于活层）
  close: () => void;                // 必须幂等（现状 popover 就被两处各关一次）
  /** true＝这一层"吃掉"ESC，不再向更底层传播；false＝允许 ESC 继续穿透（默认按裁定给）。 */
  consumesEsc: () => boolean;
}

export class FocusStack {
  push(layer: FocusLayer): void;    // 幂等：同 id 已在册则移到栈顶
  pop(id: string): void;            // close() 里调用；栈里无此 id 即 no-op
  top(): FocusLayer | null;         // 栈序＝(kind 秩, 入栈时刻) 双键，非 depth 数字
  clear(): void;                    // 场景 shutdown / STATE_REPLACED（读档）用
  handleEsc(): boolean;             // 唯一入口：自顶向下找第一个 isOpen() 的活层，close()，返回是否已消费
}
```

要点（都是**从现状读出来的约束**，不是审美）：
- `isOpen` 必须现问，不缓存层数 ⇒ 避开 P4 的"构造期常驻监听"陷阱（`PolicyTreePanel.ts:190` 在构造期绑、`isVisible()` 读 `isOpen`）。
- `consumesEsc` 让"一个键关几层"这个**产品问题**变成一个数据字段，而不是散在 3 个 handler 里的写法；裁"ESC＝退出一切临时态"时全给 `false`＋保留 `GameScene.ts:153` 的批量取消，裁"逐层退"时给栈顶 `true`。
- 栈是**单例**，跨场景共享 ⇒ 挂 `game.registry`（与 `REGISTRY_KEYS` 同族新增一键，见 `src/renderer/ui/registry.ts`），避免"每场景一个栈"（那正是 P3 的成因：UIScene 的模态与 GameScene 的监听互不可见）。

### 5b. 挂载点（改动面清单，最小 6 行删＋每层 2 行加）

| 位置 | 现在 | 改成 |
|---|---|---|
| `GameScene.ts:240` / `:582` | `on/off('keydown-ESC', escHandler)` | **保留为全仓唯一 ESC 入口**：handler 体改为 `focusStack.handleEsc()`（`GameScene.ts:153` 的 `buildMode.cancel()+popover.hide()` 降级为两个 `FocusLayer` 注册） |
| `BuildingPopover.ts:188` / `:374` | 自己绑/解 ESC | 删；改在 `show()` 里 `stack.push({id:'buildingPopover', …})`、`hide()` 里 `stack.pop('buildingPopover')`（`:98` `show()` 首行已 `this.hide()`，天然幂等） |
| `PolicyTreePanel.ts:190` / `:787` | 构造期绑/解 ESC | 删；`open()`(`:283`)/`close()`(`:293`) 各加一行 push/pop；`:304` `onEsc` 删除（其 `releasePause` 逻辑留在 `close()`，`:789` 同路径已覆盖） |
| 模态×4（`EventModal.ts`/`CrisisModal.ts`/`FactionDemandModal.ts`/`TutorialModal.ts`） | 零 ESC | `open/close` 加 push/pop；`kind:'modal'`；**`consumesEsc` 给 true 才能修掉 P3 的穿透**（这是行为变化，需裁） |
| HUD 抽屉（`SettingsPanel`/`SaveLoadPanel`/`ScoreCardPanel`/`InfluencePanel`，入口 `HUD.ts:367-432`、`:468-506`） | 零 ESC | 同上，`kind:'drawer'|'fullscreen'`；注意 HUD 主功能条**点开新面板前会先 `hide()` 别的**（`HUD.ts:367`、`:395` 是硬编码互斥）⇒ 栈接管后这层互斥可由"顶替栈顶"表达，别双写 |

API 适配面（现状命名不齐，栈要能吃下两套）：`toggle()/show()/hide()/isVisible()`（Settings `:126/:130/:136`、SaveLoad `:119/:133`、Influence `:107/:112/:119`）vs `open()/close()/toggle()`（ScoreCard `:134/:142/:148`、Codex `:162-170`、Diplomacy `:224/:233/:239`、PolicyTree `:281-293`）。⇒ 设计要求：**每层自己提供 `isOpen`/`close` 两个闭包**，不要求面板统一命名（统一命名＝20 个文件的机械改动，属另一张单）。

### 5c. 影响面与回归账（给排期用）

- **测试红点（确定会红，非猜测）**：`keyboardFlowFocusOrder.test.ts:123-131` 的 unique 7 项清单（含 `ui/BuildingPopover.ts#ESC`、`ui/PolicyTreePanel.ts#ESC`）＋ `:133` 的 `toBe(14)` 棘轮 ＋ ② 组"三文件 on/off 各 1:1"三例 ⇒ **删 2 处绑定就至少红 3 例**；另有 `BuildingPopover.test.ts`（`show 后 ESC 关` 例）与 `PolicyTreePanel.test.ts` 的 ESC 面用例依赖各自监听。方向是**改桩不是加桩**，但必须同批改，否则 pre-commit（type-check＋全量）判红。
- **门禁**：改动落 `src/**` ⇒ 触发全量套件（约 40–60 秒）＋`npm run type-check`。`FocusStack` 是纯 TS 类、无 Phaser 依赖 ⇒ 可单测，不需要新夹具。
- **读档/重启**：`STATE_REPLACED` 与场景重启路径必须 `stack.clear()`（现状 `GameScene.ts:167` 的 SHUTDOWN 手动绑、`PolicyTreePanel.ts:123` 的 `onReplaced` 已说明"读档会重装配面板"）⇒ 漏 clear 会长出幽灵层，表现与今天的"多层同关"相反（ESC 关不掉任何东西）。
- **与暂停的耦合**：模态与政策树都持暂停锁（`gameStore.ts:742-755`、`PolicyTreePanel.ts:789`）。`handleEsc()` 只关层、**不碰暂停**（现有 `close()` 链路已自带 release），否则会与 c927-08 的遮罩语义打架。
- **回滚成本**：低。栈是加法（新文件）＋ 6 行删；回滚＝恢复那 6 行绑定、去掉 push/pop。不存在数据迁移。
- **可分两步落**：第一步只做"入口单点化＋栈数据结构＋P3 穿透修复"（不动 P2 的故意批关），第二步再裁逐层退。两步各自可回滚。

---

## 6. 判据④：零码改动自证 ＋ 遗留

- `git status --porcelain -- src/` ＝ **0 行**；本班唯一入库产物＝本文件；`docs/design/OPTIMIZATION_BACKLOG.md` **未写**（它是外部在途脏件，且"是否进 BACKLOG"本身是裁决动作）——拟登记条目文本已在本文 §0/§5c，人工放行后由写单搬。
- 未跑 `npm run type-check`、未跑全量测试（并发窗禁跑）；只跑了定向 3 例复现件（tmp，rc=0）。⇒ §5c 的"测试红点"是按断言文本静态比对得出，采方案时须实跑复核。
- 遗留／需裁决：
  1. **一个键关几层**是产品口径（`GameScene.ts:152` 注释显示批关是刻意为之）⇒ 用 `consumesEsc` 承载，先裁再落。
  2. **`DiplomacyPanel.ts:19` 注释承诺 ESC 而代码零监听**（§1b）＋ `PolicyTreePanel.ts:164`、`CodexPanel.ts:47` 的屏上/帮助文案三处 ESC 口径不齐 ⇒ 补监听还是改文案，二选一，属另一张单。
  3. **模态零键盘口**（EventModal/CrisisModal/FactionDemandModal/TutorialModal 只有指针口，已在册 ③ 组）与本案同域：焦点栈是它们的天然挂载点，但"模态能否用 ESC 关"＝可访问性裁决（ESC 关事件模态可能等于"丢掉一次选择"）。
  4. 复现件按 brief 要求**自清**，不入仓。若要长期钉桩，正解是仓内新增 `src/renderer/scenes/__tests__/escFocusStack.repro.test.ts`（用 `vi.mock('phaser')` 在册手法），属 `src/` 改动＝写单。
  5. tmp 的 `vi.mock` 在仓外不命中（`window is not defined`）这条**已在 §3b 记录**，是信箱可复用的坑。
