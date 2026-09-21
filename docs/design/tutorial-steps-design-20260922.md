# colony tutorial 15 分钟动线补步设计单（c922-119，2026-09-22）

> **性质：设计稿，零实施。** 未写 `src/renderer/data/tutorial.ts`、未改 `schema.ts`、未改任何测试。
> 班次 `qoder-executor-20260922-0000-colony9`；HEAD `3f1c8d2`。
> 内容接线属产品拍板域；本单只出数据规格与分工判据。

## 一、现状复核：任务书前提比磁盘乐观一档

任务书称「TUTORIAL_STEPS 现仅 3 步（授田/等粮/人口 5）」。锚点三处逐字未漂：

| 锚点 | 磁盘实测 |
|---|---|
| `src/renderer/data/tutorial.ts:7` `export const TUTORIAL_STEPS: TutorialStep[] = [` | 命中，未漂 |
| `:9` `id: 'tut_grant_field'` | 命中，未漂 |
| `:29` `id: 'tut_population_5'` | 命中，未漂（走查档 c918-24 曾写 :19，已由 `colony-optibacklog-status-draft-20260922.md:75` 纠为 :29，该纠正与盘一致） |

`tutorial.ts` 全文 37 行、**纯 LF（CRLF 0／LF 37）**、3 个 step。但逐字段查消费方后，实况是：

**3 步里没有任何一步是可执行步——它们是 3 行清单文案。** 三条独立证据：

1. **推进引擎不存在**。`nextStepId` / `requiredAction` / `uiTarget` 三个字段在全 `src` 的命中**只落在 `schema.ts`（声明）＋ `tutorial.ts`（赋值）**，零读取方：
   ```
   $ rg -n "nextStepId|requiredAction|uiTarget" src -g '*.ts'
   → schema.ts:346/352/353/354 + tutorial.ts:11/14/15/21/24/31/34   ← 再无第三处
   ```
2. **step id 永不被写入 store**。生产码里 `setTutorialStepId(...)` **只有一个调用点**：`TutorialModal.ts:154` 传 `null`（关模态）。`'tut_welcome'` 仅以**初值**身份存在于 `gameStore.ts:326`，没有任何生产路径再赋它——`TutorialModal.ts:15` 那句「HUD 提供"?"按钮，再次调用 setTutorialStepId('tut_welcome') 即可重读」是**过期注释**：`HUD.ts:336-343` 的「?」区实测绑的是 `codex?.toggle?.()`（开典册），且 `:338` 的 2026-06-19 注记写明「改为打开典册……**比重放一次性欢迎引导更有用**」。⇒ 教程一旦关闭就无重放路径（只剩新开局/读档）。而 `tut_grant_field` 等三个 step id **从不出现在任何调用点**：`STATE_EVENTS.TUTORIAL_STEP_CHANGED`（`gameStore.ts:134/590`）唯一订阅方是 `TutorialModal.ts:108`，它只判 `=== WELCOME_STEP_ID`（`:112/:158/:169/:181`）决定弹/关。`TUTORIAL_STEPS` 的唯一活体消费者是 `TutorialModal.ts:118` 那个循环，取 `textPlain` 拼成有序清单。⇒ 每步的 `trigger`、`timeScale`、`uiTarget` 均为死字段。
3. **三步的 `uiTarget` 全部指向不存在的对象**。`btn_grant_field`／`hud_grain`／`btn_open_court` 在 `src` 的命中数各为 2，且**两处都在 tutorial.ts 内**（`uiTarget` ＋ `requiredAction` 各一次），无任何 UI 码用这些名字。其中 `btn_open_court` 最硬：朝议早于 Phase 6 就退休了 `CourtPanel`（`ui/courtFormat.ts:3`「Phase 6 退休 CourtPanel 后此处为唯一源」，`src/renderer/ui/CourtPanel.ts` 实测不存在），现网朝议是 `ui/EventModal.ts:35` 监听 `EVENT_TRIGGERED` **被动弹出**（`:11` 注释、`:76` `requestPause`），玩家侧根本没有「开朝议」这个按钮 ⇒ 第 3 步是一条**不可能完成的步**。

⇒ 补步设计必须挂在「先接线、后补数据」的次序上；只往数组里再塞 5 个对象，等于把死数据从 3 份复制到 8 份。这是本单第一优先交付物。

## 二、封闭联合：新步的服务半径由 `TutorialTrigger` 决定

`schema.ts:334-340` 的 `TutorialTrigger` 是 **6 值字面量联合**：
`first_login`｜`first_building_placed`｜`first_grain_harvest`｜`first_event`｜`population_threshold_5`｜`population_threshold_20`。

现用了 3 个，**闲置 3 个**（`first_building_placed`、`first_event`、`population_threshold_20` 在 tutorial.ts 零命中）。

推论（对产品拍板很值钱）：
- 落在闲置 3 值上的新步 ⇒ **零 `schema.ts` 改动**，只加数组元素。
- 首日结算、调速两条动线**没有对应 trigger** ⇒ 必须扩联合（`trigger: TutorialTrigger` 是强类型，写新字面量直接 TS 报错）。本单给出拟增 3 个值，见 §四。
- `first_building_placed` 与 `first_event` 虽可用，但**正是与 JIT 撞车的两个场景**（见 §三），启用前必须先定分工。

## 三、与 JitHint 的去重分工（同场景不双弹）

### 3.1 触发枚举现值（`rg -n "JitTrigger" src/renderer/data/jitHints.ts`）

命中 4 处：`:11` 类型定义、`:28` `JitHint.trigger`、`:33` `Record<JitTrigger, JitHint>`、`:54` `pickJitHint(trigger, seen)`。

`JitTrigger` **14 值**（`jitHints.ts:12-25`，逐字）：
`first_build`(首次落子建造)｜`first_complete`(首座建筑营建完成)｜`first_grade`(首次国格晋阶)｜`first_crisis`(首次跌入低谷危机)｜`first_event`(首次朝堂事件)｜`first_diplomacy`(首次邻邦动作)｜`game_start`(开局第一次进入)｜`first_policy`(首次采纳国策)｜`first_decree`(首次颁布朝令)｜`first_gold_income`｜`first_cloth_income`｜`first_bronze_income`｜`first_rite_income`｜`first_labor_fail`(首次因劳力不足失败)。

JIT 的事件接线集中在 `ui/JitHintManager.ts:56-64`（本类自述「只做事件→trigger 的接线」，选择/去重在 `pickJitHint` ＋ `store.markJitHintSeen`）：
`BUILDING_PLACED→first_build`｜`BUILDING_COMPLETED→first_complete`｜`EVENT_TRIGGERED→first_event`｜`CRISIS_TRIGGERED→first_crisis`｜`NPC_ACTION→first_diplomacy`｜`GRADE_CHANGED→first_grade`｜`POLICY_ADOPTED→first_policy`｜`DECREE_ADOPTED→first_decree`｜`RESOURCES_CHANGED→{gold,cloth,bronze,rite}_income`（`:41-44` 只判这四种增量，**grain 未接**）｜开局 `:55` 延迟 800ms 发 `game_start`。

### 3.2 撞车面与划法

| 场景 | tutorial 侧 | JIT 侧 | 判定 |
|---|---|---|---|
| 首次落子建造 | `first_building_placed`（闲置） | `first_build` | 🔴 **同场景双弹**，须裁决 |
| 首次朝议事件 | `first_event`（闲置） | `first_event`（**枚举字面同名**） | 🔴 同名同场景，最危险 |
| 首座建筑完成 | 无（拟新增） | `first_complete` | 🟡 若新增即撞，建议**只留 JIT** |
| 首日结算 | 无（拟新增） | 无 | 🟢 tutorial 独占 |
| 调速／暂停 | 无（拟新增） | 无 | 🟢 tutorial 独占 |
| 粮食首次产出 | `first_grain_harvest`（在用） | 无（JIT 资源面不含 grain） | 🟢 tutorial 独占，现状已安全 |
| 危机／晋格／国策／朝令／邦交／四资源／劳力失败 | 无 | JIT 全占 | 🟢 划归 JIT，tutorial 不介入 |

**建议划法（一句话可执行）**：`tutorialStepId` 处于**链内非哨兵值**（≠`null` 且 ≠`'tut_welcome'`）时压制 JIT 播报，出链后 JIT 全权接手。落地钩子**已存在**，不必新建闸门——`JitHintManager.ts:25` 的 `if (!this.store.markJitHintSeen(trigger)) return;` 是天然单闸（`:23` 注释自述「用返回值做唯一去重闸」），在它之前加一个 tutorial 激活判定即可；`markJitHintSeen` 的幂等语义（`gameStore.ts:596-599`）保证被压制的那次**不会**被误记为「已弹过」的前提是：**压制时必须先 return 再 mark**，顺序反了就变成「静默吞掉且永不补播」。这条是本单最容易写错的地方，须复核。

⚠ 副作用登记：`seenJitHints` 是**持久化字段**（`gameStore.ts:209`「已弹过的 JIT 即时提示 trigger（持久化，永不重复）」），压制策略一旦改动，旧档里「已弹过」的集合与新策略的交互结果与新档不同 ⇒ 属存档兼容面。

### 3.3 三条必须让位的既有设计冲突

- `jitHints.ts:34` 的 `game_start` 文案已经把「左栏选建筑 → 点地图放下 → 三类建筑用途 → 顶栏可点每日出入 → 国格徽章可点升格之途 → 开局暂停中」全讲完了。**再补 `tut_first_build` 就是第三次说同一句话**（`game_start`＋`first_build`＋tutorial 三重）。⇒ §四把首建步降级为「只做点亮、不再复述」。
- `schema.ts:5` 的「强制单线点亮一个按钮，其他 60% 灰遮罩」在当前实现里**无任何代码支撑**（无遮罩层、无高亮矩形消费方，`highlightRect` 也是死字段）。灰遮罩属新增 UI 能力，不在补步范围。
- `main.ts:177`：开局暂停，`autoUnpause` 在**首次 placeBuilding/adoptPolicy/setSpeed** 时恢复。⇒ 「调速」这一步天然与解暂停耦合，`tut_speed_*` 若排在解暂停之前会自相矛盾。

## 四、补步数据规格（5 条，含 1 条链尾）

字段命名严格对齐 `schema.ts:342-357`。每条给：id / trigger（含是否需扩联合）/ 触发谓词锚点（rg 实证）/ 文案 / 按钮行为 / 与 JIT 关系 / timeScale。

| # | id | trigger | 需扩联合？ | 触发谓词锚点（真实存在，已 rg） |
|---|---|---|---|---|
| 4 | `tut_first_build` | `first_building_placed` | 否（闲置值） | `STATE_EVENTS.BUILDING_PLACED` `gameStore.ts:121`；面板 `ui/BuildPanel.ts:39`；解暂停 `main.ts:177` |
| 5 | `tut_first_complete` | `first_building_completed` | **是** | `BUILDING_COMPLETED` `gameStore.ts:122`；JIT 侧 `JitHintManager.ts:33/57` |
| 6 | `tut_first_day_settle` | `first_day_settled` | **是** | `DAY_TICK` `gameStore.ts:116`，发射点 `:1052` `emit(STATE_EVENTS.DAY_TICK, this.state.currentDay)`；字段 `currentDay` 声明 `:215`／初值 `:332 = 0` |
| 7 | `tut_speed_up` | `first_speed_change` | **是** | `SPEED_CHANGED` `:124`、监听 `HUD.ts:198`、写点 `HUD.ts:529`；键盘 `GameScene.ts:155-157`（`speedKeyHandler1/2/3` 同时 `setPaused(false)`）；字段 `speed: 0|1|2|3` `:213`、初值 `:330 = 1` |
| 8 | `tut_population_20` | `population_threshold_20` | 否（闲置值） | `resources['people']`（`gameStore.ts:414/489/1190` 三处在用）；`runPopulationTick` 注册于 `:959` |

拟扩的 `TutorialTrigger` 新值共 3 个：`first_building_completed`、`first_day_settled`、`first_speed_change`。

### 4.1 逐条文案与按钮行为（≤15 字，半文半白）

```
4  tut_first_build      trigger: first_building_placed     uiTarget: <待定，见下>
   text: '选一座，点地图放下'      textPlain: '在左栏挑一种建筑，点地图格落子。'
   requiredAction: 'event:state:buildingPlaced'   nextStepId: tut_first_complete   timeScale: 1
   按钮行为：不点亮任何按钮，只做「左栏首格」箭头指引；建好前不推进。
   JIT 关系：与 first_build 同场景 —— 本步激活时须压制 first_build，且文案不复述 game_start 已给的三类用途。

5  tut_first_complete   trigger: first_building_completed  uiTarget: <待定>
   text: '屋已成，点它看详情'      textPlain: '营建完成。点开它可看产出与升级。'
   requiredAction: 'event:state:buildingCompleted'  nextStepId: tut_first_day_settle  timeScale: 1
   JIT 关系：建议**本步不建**、维持 JIT `first_complete` 独占（避免第三次讲「建成可点」）。
             保留此行仅为完整性，拍板时优先删。

6  tut_first_day_settle trigger: first_day_settled         uiTarget: <顶栏，待定>
   text: '首日已结，看粮钱出入'    textPlain: '每过一日结算一次产出。顶栏数字可点开明细。'
   requiredAction: 'observe:dayTick'  nextStepId: tut_speed_up  timeScale: 0.5
   JIT 关系：无冲突（JIT 无 day 道、资源面不含 grain）。tutorial 独占。

7  tut_speed_up         trigger: first_speed_change        uiTarget: <HUD 速度键，待定>
   text: '按 1/2/3 改时日流速'     textPlain: '速度键或 1/2/3 调流速，0 为暂停。'
   requiredAction: 'event:state:speedChanged'  nextStepId: tut_population_20  timeScale: 1
   JIT 关系：无冲突。tutorial 独占。
   ⚠ 必须排在解暂停之后：`setSpeed` 本身就是 `main.ts:177` 的 autoUnpause 触发点之一。

8  tut_population_20    trigger: population_threshold_20   uiTarget: <人口格，待定>
   text: '人满二十，百务并起'      textPlain: '人口到二十，朝议与危机渐多。教程至此。'
   requiredAction: 'none'  nextStepId: 缺省（链尾）  timeScale: 1
   链尾语义：到本步完成即 `setTutorialStepId(null)`，JIT 解除压制、全面接手。
```

`uiTarget` 全部标 `<待定>` 是**刻意为之**：现网不存在任何可寻址的 HUD 按钮名（§一第 3 条已证三个现有名字都是虚构的）。接线批必须先决定寻址方案（Phaser `setName` 注册表 vs DOM data 属性），否则新步会复制同一处假锚点。

### 4.2 接线次序（拍板建议）

1. 先补「trigger→step 推进」最小引擎（订阅 `STATE_EVENTS`，把 step id 真写进 `setTutorialStepId`）＋ `uiTarget` 寻址方案；同批**改掉第 3 步 `btn_open_court`**（指向已退休 CourtPanel 的不可完成步）。
2. 再按 §四 顺序加步：4 → 6 → 7 → 8 四步优先，5 建议删。
3. 分工闸门（§3.2）与步骤数据同批落，否则中间态必双弹。
4. 链尾从「人口 5」延到「人口 20」＝P2-1「15 分钟自解释」的度量边界变化，需产品确认时长目标是否随之改（现 3 步的 `timeScale` 1→0.5→0.2 递减是「越教越慢」，与 15 分钟目标反向）。

## 五、文案禁偏字自查（人工比对，未改测试）

`copyBias.test.ts` 现值 **4 tests / 4 passed（374ms，`npx vitest run src/renderer/data/__tests__/copyBias.test.ts`）**。

禁字表 15 字（`copyBias.test.ts:13` `BANNED_CHARS`，逐字）：**畿 耒 耜 胄 黔 嵎 泌 镞 鏖 诰 敕 漕 窳 筚 沤**。判据是 `:21` 的子串命中（`t.includes(ch)`），命中即红。

本单 5 条 `text` ＋ 5 条 `textPlain` 共 10 串，从稿面机检（正则抽 §4.1 代码块后逐串比字）：**禁字命中 0**。
- `text` 字数实测 9/9/10/13/9（最大 13），全部满足 `schema.ts:349` 的「≤15 字」。
- `textPlain` **不受该 15 字约束**——既有三步实测为 16/11/17（区间 11–17），本单五条为 16/16/21/21/19（区间 16–21），比现状最长者多 4 字，属同量级不属越界；若产品要求并轨，可把 21 字的两条（第 6、7 步）再压 4 字。

⚠ **但这条守护对 tutorial 是失明的**：`copyBias.test.ts` 的 4 个 it 分别扫「建筑文案／国策·朝令文案／古迹·终局文案／故事事件文案」（`:28/:33/:39/:48`），**导入面只到 `storyEvents`、`endgameEscalation` 等（`:10-11`），没有任何一处扫 `TUTORIAL_STEPS`**。⇒ 「文案自查过 copyBias 词表口径」在本仓只能通过人工比对达成（本单做法），**跑绿不构成证据**。若未来接线，建议把 tutorial 文案并入该测试的扫描面（属测试改动，本单未做）。

## 六、红线与本单边界

- 未写任何 `src/` 文件；`git diff --name-only src/` 仍为在册他班在途 4 件（`MapRenderer.ts`/`BuildPanel.ts`/`saveGuard3.test.ts`/`saveLoad.test.ts`），本班零夹带。
- 未碰经济平衡数值：本单只**引用** `resources['grain'|'people']` 等字段是否存在作谓词锚点，未读取、未评判任何产出/消耗/冷却数值。
- 未跑全量测试（本单无码改动，跑了也不构成新证据）；只跑了完成标准点名的 `copyBias.test.ts` 单项。
- 存档兼容属**升深档触发项**（`D:\code\CLAUDE.md:111` colony-game 行：「经济平衡、**存档兼容**、性能瓶颈、跨系统重构、发版审查」），本单不自行判定可否接线。
