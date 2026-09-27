# c927-08 暂停遮罩层级：UIScene.ts:284 注释与实现相反——两案裁决材料

- 工单：`c927-08`（cwd `D:\code\colony-game`）
- 班次：`qoder-executor-20260927-1820-colony40`（波次 22 只读采集班）
- 取证时点：2026-09-27 17:5x（本机 `date`＝`Sun Sep 27 17:58:35 2026`）
- 仓现值：HEAD `27c00b0`，`git status --porcelain` 4 行（外部在途件，本班未碰）
- **本班零码改动**：本文是唯一新增文件，`src/` 未写一字节；未跑测试、未跑 type-check（并发窗禁跑全量，见 §5）
- 性质：**裁决材料单**。两案（抬层级／改注释）的取舍＝产品语义裁决，属人工闸，本班不自行落任何一案的代码。

---

## 0. 结论速览（给人工的三行）

1. **缺陷是真的，但形态与卷宗锚点描述不完全一致**：遮罩（900）确实低于所有 UI 容器（950/999/1000/1100/1999/2000/2050/2400），面板开着时暂停"不变暗"成立；但**"已暂停"三字被 HUD 压住**这一条**不成立于常规窗口**——HUD 只占顶部 48px，遮罩文字在屏幕正中，只有窄窗口（宽度 ≲520px）才会被左侧 BuildPanel（8..264px）盖住。详见 §4 否证。
2. **本案不是一个数的事，是"depth 只在同场景内可比"这个结构没人写下来**：遮罩活在 `UIScene`，地图活在 `GameScene`，`UIScene` 整体压在 `GameScene` 之上 ⇒ **地图侧的 -10…10000 全表与遮罩无竞争关系**。抬遮罩到 1500 只会压住 UI 面板，抬到 2500 才会连 Toast 一起压；而"压住地图"这件事**当前已经生效**，不是待修项。
3. **推荐 B 案（改注释）先行，A 案只在产品明确要"暂停即全屏压暗 UI"时才做，且必须走 A2 落点**。理由核心：本仓暂停是**双源**的（用户主动 `state.paused` ＋ 模态自动持锁 `pauseHolders`），绝大多数暂停发生在事件／危机／教程模态打开时；把遮罩抬到模态之上（A3）会把模态自己压暗，是直接错的设计。

---

## 1. 现场原文（先证其在世，再谈改法）

`src/renderer/scenes/UIScene.ts:284-291`（工作树版，本班只读）：

```
284:    // A-9：暂停遮罩（灰色半透明 + "已暂停" 文字，depth 在 toast 之下、面板之上）
285:    this.pauseOverlay = this.add.graphics().setDepth(900).setVisible(false);
286:    this.pauseText = this.add.text(0, 0, '已暂停', {
...
289:    }).setOrigin(0.5, 0.5).setDepth(901).setVisible(false).setAlpha(0.85);
290:    store.on(STATE_EVENTS.PAUSED_CHANGED, this.onPausedChanged);
291:    this.onPausedChanged();
```

- 注释断言"面板之上"；实现是 **900/901** ⇒ 与实现相反，缺陷确认。
- 绘制参数：`UIScene.ts:165-179` `onPausedChanged()`——`fillStyle(0x000000, 0.35)` 全屏 `fillRect(0,0,w,h)`；文字 `setPosition(w/2, h/2)`。
- 遮罩**没有 `setInteractive`** ⇒ 只压暗、不挡点击（`keyboardFlowFocusOrder.test.ts:273-280` 已把它钉成现状桩）。
- 遮罩是 **per-scene 全屏 rect，读的是 `this.scale.width/height` 当下值**；`applyResize()`（`UIScene.ts:315-345`）里**没有**重新调 `onPausedChanged` ⇒ **暂停期间改窗口尺寸，遮罩不会跟着长**（残留旧尺寸矩形）。这是本班读码新发现，属同一处代码的第三个问题，一并交裁决（见 §6 附）。

---

## 2. 判据①：depth 现值全表（file:line，全部现读自工作树）

### 2a. `UIScene` 场景内（遮罩的真实竞争面）

| depth | 对象 | file:line | 备注（遮罩 900/901 相对位置） |
|---|---|---|---|
| 900 | **pauseOverlay**（暂停压暗矩形） | `src/renderer/scenes/UIScene.ts:285` | 本体 |
| 901 | **pauseText**（"已暂停"） | `src/renderer/scenes/UIScene.ts:289` | 本体 |
| 950 | Legend 容器（`PANEL_DEPTH` 常量） | `src/renderer/ui/Legend.ts:38`（常量）／`:65`（应用） | **高于遮罩** |
| 950 | ZoomControl 容器（同名独立常量） | `src/renderer/ui/ZoomControl.ts:20`／`:47` | **高于遮罩** |
| 999 | StoryBar 容器（故事顶栏） | `src/renderer/ui/StoryBar.ts:43` | **高于遮罩** |
| 1000 | HUD 容器 | `src/renderer/ui/HUD.ts:147` | 高于遮罩；bg 只画顶部 48px（`HUD.ts:208-211`，`UI.topbarHeight: 48` 见 `src/shared/palette.ts:108`） |
| 1000 | BuildPanel 容器 | `src/renderer/ui/BuildPanel.ts:100` | 高于遮罩；几何 x=8、宽 `UI.buildPanelWidth: 256`（`palette.ts:111`）⇒ 覆盖 x∈[8,264] |
| 1100 | BuildPanel tooltip 容器 | `src/renderer/ui/BuildPanel.ts:147` | 高于遮罩 |
| 1100 | HUD 资源跳字（`+N/-N` 浮动） | `src/renderer/ui/HUD.ts:639` | 高于遮罩；先 `scene.add.text().setDepth(1100)` 再 `container.add(t)` |
| 1999 | InfluencePanel 背板（全屏黑 0.4） | `src/renderer/ui/InfluencePanel.ts:30` | **高于遮罩**（模态背板本身也不被暂停遮罩压暗） |
| 1999 | SaveLoadPanel 背板 | `src/renderer/ui/SaveLoadPanel.ts:67` | 同上 |
| 2000 | CodexPanel | `src/renderer/ui/CodexPanel.ts:133` | 同上 |
| 2000 | CrisisModal | `src/renderer/ui/CrisisModal.ts:44` | 同上（**会持暂停锁**，见 §3） |
| 2000 | DiplomacyPanel | `src/renderer/ui/DiplomacyPanel.ts:104` | 同上 |
| 2000 | EventModal | `src/renderer/ui/EventModal.ts:89` | 同上（**会持暂停锁**） |
| 2000 | FactionDemandModal | `src/renderer/ui/FactionDemandModal.ts:67` | 同上 |
| 2000 | GradePanel | `src/renderer/ui/GradePanel.ts:60` | 同上 |
| 2000 | MegaProjectPanel | `src/renderer/ui/MegaProjectPanel.ts:81` | 同上 |
| 2000 | MilitaryPanel | `src/renderer/ui/MilitaryPanel.ts:57` | 同上 |
| 2000 | PolicyTreePanel | `src/renderer/ui/PolicyTreePanel.ts:128` | 同上 |
| 2000 | PopulationPanel | `src/renderer/ui/PopulationPanel.ts:56` | 同上 |
| 2000 | ProductionPanel | `src/renderer/ui/ProductionPanel.ts:70` | 同上 |
| 2000 | SaveLoadPanel 容器 | `src/renderer/ui/SaveLoadPanel.ts:63` | 同上 |
| 2000 | ScoreCardPanel | `src/renderer/ui/ScoreCardPanel.ts:76` | 同上 |
| 2000 | SettingsPanel | `src/renderer/ui/SettingsPanel.ts:34` | 同上 |
| 2000 | InfluencePanel 容器 | `src/renderer/ui/InfluencePanel.ts:25` | 同上 |
| 2050 | TutorialModal | `src/renderer/ui/TutorialModal.ts:57` | 唯一高于 2000 的模态（**会持暂停锁**；`UIScene.ts:237` 注释解释它必须最后构造） |
| 2400 | Toast 背景 | `src/renderer/ui/Toast.ts:31` | 表内最高，非本场景 UI 的天花板 |
| 2400 | Toast 文本 | `src/renderer/ui/Toast.ts:39` | 注释里说的"toast 之下"目前＝事实 |

取值分布（`grep -oE "setDepth\(-?[0-9]+\)"` 去噪后自算，供复核）：`2000×15、2400×2、1999×2、1100×2、1000×2、9999×1、999×1、901×1、900×1、60×1、2050×1、-9×1、-10×1` ＋ 符号常量 `950×2`（Legend/ZoomControl）、`1100×1`（BuildingPopover）。

### 2b. `GameScene` 场景内（**与遮罩不可比**，列出来是为了防止误当成竞争面）

| depth | 对象 | file:line |
|---|---|---|
| -10 | 纯色地形垫 | `src/renderer/render/MapRenderer.ts:436` |
| -9 | 地形贴图层 | `MapRenderer.ts:559` |
| 动态（按世界 y 排序） | 建筑 sprite／印记／sigil | `MapRenderer.ts:619`（`setDepth(wy)`）、`:734`、`:772`（`setDepth(depth)`） |
| 60 | 地图浮字（注释自称"在建筑/脉冲之上"） | `MapRenderer.ts:957` |
| 9999 | 雪／粒子发射器 | `MapRenderer.ts:1153` |
| 10000 | 烟火／闪光发射器 | `MapRenderer.ts:1077`、`:1092` |
| 1100 | BuildingPopover 容器 | `src/renderer/ui/BuildingPopover.ts:32`（常量）／`:117`（应用）——**实例化在 GameScene**：`src/renderer/scenes/GameScene.ts:199` `new BuildingPopover(this, …)` |

⇒ 地图侧最高 10000 也**不会**盖住遮罩：`main.ts:52` 场景表 `[BootScene, ModeSelectScene, IntroScene, GameScene, TransitionScene, UIScene]`，`GameScene.ts:249` 用 `this.scene.launch('UIScene')` 启动 ⇒ UIScene 在场景列表末位、整体压在 GameScene 之上。**"暂停时地图变暗"这条语义现在就已成立**，两案争的只是"UI 面板要不要一起变暗"。

### 2c. 顺带查出的第二处注释漂移（同一病灶）

`src/renderer/ui/BuildingPopover.ts:32`：`const DEPTH = 1100; // 高于 panel(900)、低于 EventModal(1500)/Toast(2000)`
⇒ **三个参照值全错**：BuildPanel 现值 1000（非 900）、EventModal 现值 2000（非 1500）、Toast 现值 2400（非 2000）；且 Popover 挂在 GameScene、参照的三者全在 UIScene，**跨场景本就不成立**。⇒ 说明"depth 注释是一张不存在的全局阶梯"是本仓反复出现的模式，不是单点笔误。改注释若只改 `UIScene.ts:284` 一行，会留下同类病灶。

---

## 3. 决定性事实：暂停是**双源**的（这决定了 A 案的可用落点）

`src/renderer/state/gameStore.ts`：

- `:391-392` 注释即口径：`state.paused 仅由 setPaused 写（HUD 速度按钮）`；`effective isPaused = state.paused || pauseHolders.size > 0`
- `:464` `isPaused()`／`:466` `getUserPaused()`／`:728` `setPaused()`／`:742-755` 持锁与释放（只在 effective 由 false→true 时 emit `PAUSED_CHANGED`）
- 遮罩只读 `isPaused()`（`UIScene.ts:167`）⇒ **模态自动暂停同样会画遮罩**。
- 自动暂停方：`EventModal.ts:16`（"模态打开期间自动 setPaused(true)；关闭时恢复 prevPaused"）、`TutorialModal.ts:17`（同语义）、`UIScene.ts:237-238`（教程欢迎步骤立即 `setPaused(true)`）；CrisisModal 同属通告模态。
- 主动暂停入口：`HUD.ts:526`（速度按钮切）、`GameScene.ts:155`（SPACE）、`GameScene.ts:156-158`（1/2/3 先解除再定档）、`main.ts:178`（开局即暂停等首次操作）。

⇒ 统计意义上，**屏幕上出现遮罩时，多数时候有一个 2000/2050 的模态正开着**。这条把"抬到模态之上"直接排除掉（见 A3）。

---

## 4. 判据②：两案语义矩阵

### 4a. 锚点否证（先收窄再判）

| 锚点原话（`done/20260925-120433-4686.result.md:24-26`） | 磁盘实况（本班复测） | 处置 |
|---|---|---|
| 「遮罩实际在所有面板之下」 | **成立**：900/901 < 同场景最低容器 950 | 沿用 |
| 「面板/模态开着时暂停既不变暗」 | **成立**：面板不被压暗 | 沿用 |
| 「"已暂停"三字也被 HUD 压住」 | **常规窗口不成立**：HUD bg 只画 48px 顶栏（`HUD.ts:208-211`），文字在 `(w/2, h/2)`；只有 `scale.width ≲ 520` 时中心 x 才落入 BuildPanel 的 x∈[8,264]（`applyResize` 下限 clamp 到 320×240，`UIScene.ts:322-323`）⇒ **窄窗/最小窗才遮字** | 按实况收窄，不沿用原话 |
| 卷宗「HUD 1000→遮罩 1500」的示例数值 | 1500 这个点恰好只压住 1000/1100 一档，**压不住 1999/2000/2050/2400**（即"抬了但模态背板仍在遮罩之上"）⇒ 半抬态 | 必须写进裁决口径，否则人工容易选到一个不自洽的中点 |

### 4b. 两案矩阵（核心判据）

| 维度 | **A 案：抬遮罩层级**（改码） | **B 案：改注释承认"只压暗地图"**（改文档） |
|---|---|---|
| 玩家可见语义 | 暂停＝全屏进暗房；**暂停时看面板数据被压暗**（0.35 黑仍可读，但明度降） | 暂停＝地图静默变暗、UI 保持可用亮度；**允许边暂停边读面板** |
| 与"双源暂停"（§3）的相容性 | 差：事件/危机/教程模态自动暂停属高频路径，遮罩压到面板上＝每次弹事件都把整块 UI 压暗，玩家会误以为"模态不可读" | 好：模态自动暂停时地图变暗是"世界停了"的提示，UI 亮度不变正好配合"要你读面板" |
| 与 Toast（2400）的关系 | 抬到 <2400 ⇒ Toast 比遮罩亮（不一致）；抬到 >2400 ⇒ 暂停期间提示被压暗，**软反馈看不见**（本仓大量软反馈走 Toast，见 `UIScene.ts:257-277` 的 17 类事件） | Toast 始终高于遮罩，语义单一："Toast 与暂停无关" |
| 需改的生产码 | `UIScene.ts:285`（900→目标值）、`:289`（901→目标值+1）；若要一致还需 `StoryBar/Legend/ZoomControl` 的 950/999 档重排（**它们与遮罩的相对次序会翻转**，属连带回归面） | `UIScene.ts:284` 一行注释；建议同时修 `BuildingPopover.ts:32` 的 3 个错值（§2c） |
| 测试影响面（**硬门**） | `src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts` **⑤ 组 3 例全红**：`:255-263`（`toContain(900)`／`toContain(901)`）、`:265-271`（`overlayDepth < min(1000,2000,2400)`）、`:267` 正则还硬绑定构造形态 `pauseOverlay = this.add.graphics().setDepth(N)`。⇒ 抬层级**必须同步改这 3 例**，否则 pre-commit（跑 type-check＋全量）直接把提交判红 | **零测试改动**（⑤ 组的桩只读遮罩与 min(1000,2000,2400) 的大小关系，不校验注释文字） |
| pre-commit／门禁风险 | 高：改 `src/` ⇒ 触发全量套件；且并发窗内兄弟班在跑，红不可归因 | 零：纯 `docs/` 产物不进门禁 |
| 视觉/布局回归 | 需人眼确认 950/999 两档（图例、缩放条、故事顶栏）被压暗后可读性；窄窗（320×240）下遮罩与面板叠色 | 无 |
| 是否掩盖真问题 | 是：`setInteractive` 缺失（遮罩不挡点击）与 resize 不重画（§1 末条）都不会因抬层级而修好；反而给玩家"UI 被禁用了"的错觉却没有真禁用 | 否：B 案下"遮罩只压暗地图、不拦操作"是**自洽**的设计，与现状一致 |
| 语义可辩护度 | 需产品先答："暂停时是否禁止读面板数据"——**这问的答案大概率是'不禁止'**（本仓暂停常用于观察资源曲线，见 §3 的 1/2/3 键先解除暂停再定档） | 无需产品新增口径，只需把既有行为写准 |
| 回滚成本 | 中：两个 depth＋3 例测试；一旦图例/故事栏次序被牵动，回滚面扩大 | 极低：一行注释 |

### 4c. A 案的三个落点亚型（若人工仍选 A，必须挑一个并说明其不自洽点）

| 亚型 | 落点 | 压住什么 | 压不住什么 | 代价 |
|---|---|---|---|---|
| A1 | 900→1050 | HUD 1000、BuildPanel 1000 | 1100 起的 tooltip/跳字、1999/2000/2050 模态、2400 Toast | "抬了个寂寞"：仍低于绝大多数面板，缺陷观感不消 |
| A2 | 900→1500（卷宗示例值） | 950/999/1000/1100 档（图例、缩放条、故事栏、HUD、建造面板、tooltip、跳字） | 1999/2000/2050/2400（模态与其背板、Toast） | 与模态暂停高频路径仍冲突；且 **1999 的模态背板比模态本体低 1，夹在 1500 与 2000 之间**，需一并说明；改 3 例测试 |
| A3 | 900→2500（全表最高） | 全部 UI，含模态与 Toast | 无 | **语义错误**：事件/危机/教程模态被压暗＝玩家读不了要读的内容；Toast 软反馈消失；不可采 |

---

## 5. 判据③：推荐

**推荐 B 案（改注释）为默认解；A 案只在产品明确要求"暂停时 UI 也应压暗"时采 A2，并连带处理 1999/2050/2400 三档的说明。**

给人工的裁决措辞（可直接抄进 OPTIMIZATION_BACKLOG／backlog 卡片）：

> 暂停遮罩语义定为：**只压暗地图（GameScene），不压暗任何 UI 面板；遮罩不拦截输入**。
> 依据：①暂停在本仓是双源的（`gameStore.ts:464` effective isPaused），模态自动暂停占多数，压暗 UI 会与"要你读模态/面板"直接冲突；②Toast 2400 与本仓 17 类软反馈事件（`UIScene.ts:257-277`）必须在暂停期可见；③抬层级要同步 `keyboardFlowFocusOrder.test.ts:255-271` 的 3 例现状钉，改动面与回归面都大于收益。
> 随 B 案一起做（同属"改文档"面，零测试影响）：把 `UIScene.ts:284` 改写为真实阶梯，并在 `BuildingPopover.ts:32` 修正 3 个失效参照值、注明"跨场景 depth 不可比"。

建议注释新写法（**只是文本建议，本班未写入 `src/`**）：

> `// A-9：暂停遮罩（全屏压暗 0.35 黑 + "已暂停"）。depth 900/901 ⇒ 只压暗 GameScene 地图，不压暗本场景任何 UI（Legend/ZoomControl 950、StoryBar 999、HUD/BuildPanel 1000、模态 2000/2050、Toast 2400 皆在上）。遮罩不 setInteractive：暂停不拦操作。`

PLAYTEST_CHECKLIST.md 是否加条目：**建议加，但加在"五、手感与观感"，1 行、不加表格行**。

- 文件现位：`docs/design/PLAYTEST_CHECKLIST.md`（87 行；节次＝一 基本信息／二 国格到达时间／三 资源曲线感受／四 系统上手度(表)／五 手感与观感／六 故事模式专项／七 结论；`:11` 已有一条涉及"空格＝暂停/继续"的键盘口径）。
- 理由：本案是**主观可见性**问题（"暂停时你看清没看清'已暂停'""暂停时面板亮度对不对"），最适合真人试玩捕获，不该靠断言代替。
- 反理由（须在条目里规避）：第四节是"系统上手度 1-5 分"表，**逐行是游戏系统而非 UI 缺陷**；遮罩属观感，塞进表会污染表的口径（该表 4 行是 9-22 c922-124 后补的，已有"补行说明"体例，别再动它）。
- 拟加条目文本（人工放行后由写单落盘）：
  `docs/design/PLAYTEST_CHECKLIST.md` 第五节末追加：
  `- 暂停时：地图有没有变暗？"已暂停"看得见吗（**窄窗口/最大化前**特别看一下）？面板这时该不该一起变暗——你的直觉是什么？`
  ⇒ 这条同时为 B 案的语义收集"玩家预期"证据，一次试玩能反哺裁决。

---

## 6. 判据④：零码改动自证 ＋ 连带发现登记

**零码改动**（本班实测，非声明）：

```
$ git status --porcelain                      # 收班前复跑，应仍为 4 行、不含 src/
$ ls docs/insights/c927-08-*.md               # 本班唯一产物
```

本班未跑 `npm run type-check`、未跑 `npx tsc -p tsconfig.main.json --noEmit`、未跑 vitest（并发窗禁跑全量，兄弟班 `psy76`／`quant48`／`learn47` 在别仓同刻）。⇒ **本文所有断言均为读码结论，不含运行时读数**；A 案"3 例测试会红"是静态推断（断言文本与目标值直接矛盾），若人工采 A 案须自己跑 `npx vitest run src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts` 复核。

**连带发现（同属本案代码区，交人工一并裁决，本班未动）**：

1. **resize 期间遮罩尺寸不更新**：`UIScene.ts:315-345` `applyResize()` 逐个调各面板 `layout()`，**未调 `onPausedChanged()`** ⇒ 暂停态下改窗口尺寸，压暗矩形仍是旧尺寸（`onPausedChanged` 只在 `PAUSED_CHANGED` 与构造时跑，`:290-291`）。B 案里若把语义写准，这条会变成"看得见的口径缺口"，建议与本案同批修（改法＝`applyResize` 末尾加一次 `onPausedChanged()`，属 `src/` 改动＝另开写单）。
2. **BuildingPopover 的 depth 注释三值全失效**（§2c），与本案同病灶，建议同批改注释。
3. **遮罩不 `setInteractive`**（§1）：与"面板可继续操作"自洽，但若将来采 A2/A3，玩家会预期"压暗＝禁用"，届时需同步决定是否加输入拦截——这是 A 案的隐藏第三问，卷宗没写，人工裁决时要点名。

## 7. 引证清单（便于复核）

- 锚点件（按 brief §3a 从 `done/` 取，非 `outbox/`）：`D:\code\zcode-bridge\done\20260925-120433-4686.result.md:24-26, :39, :54, :98, :111-112`
- 现状钉测试：`src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts:248-281`
- 场景表／启动：`src/renderer/main.ts:52`、`src/renderer/scenes/GameScene.ts:249`、`:199`
- 暂停双源：`src/renderer/state/gameStore.ts:391-392, 464, 466, 728, 742-755`
- 几何常量：`src/shared/palette.ts:106-113`（`topbarHeight: 48`、`buildPanelWidth: 256`）
- 试玩表：`docs/design/PLAYTEST_CHECKLIST.md:1-87`（节次见 §5）
