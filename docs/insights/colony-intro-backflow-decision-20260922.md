# colony IntroScene 单向门回流出口裁决材料（c922-121，2026-09-22）

> 性质：**裁决材料，不实施**。本单零生产码改动、零测试改动。
> 三条落点（A 左上常驻 / B 首屏仅 / C 迷路检测触发）**结论不同、存档兼容状态也不同，不打包裁决**（沿用 c922-113「三键各自出口」的先例）。
> ⚠ **本稿 §四 方案 C 命中「存档兼容」升级硬触发，该分支产物需 GPT 独立复核后方可当定稿**；方案 A/B 经取证判为**不触**该硬触发（依据见 §三）。

---

## 一、结论先行

1. **「单向门」成立且比走查记录的更严重**：不止序章无回退——**全仓场景图里没有任何一条反向边**。`BootScene.ts:100` 是 `ModeSelectScene` 的唯一生产入口，`GameScene`/`UIScene` 内**零**「回主菜单/重新开始」面（`rg -n "主菜单|menu|restart|重新开始|scene\.start"` 在两个场景文件里**无输出**，exit=1）。⇒ 加回流出口不是「补一个漏」，而是**全仓第一条反向边**，交互范式要从零立。
2. **回退窗口期内确实零已写入状态**（这是本单最有价值的取证结论）：IntroScene 的**全部** registry/store 写入都集中在 `tryStart()`（`:550-576`）这一个函数体内，且 `:575` 的 `scene.start('GameScene')` 紧随其后。玩家能按下「返回」的时刻 ⇒ 必然在 `tryStart()` 之前 ⇒ **回退不撤销任何状态**。方案 A/B 因此**不触存档兼容**。
3. **代价不在状态、在输入**：邦名只活在 DOM 输入框的 `.value` 里（`:378/:385-387`），身份只活在实例字段 `selectedIdentityId`（`:395`）。`scene.start` 会触发 IntroScene shutdown 并重建，回流后再进来 ⇒ **玩家手输的邦名与已选身份双双丢失、候选邦名重洗**（`:257 this.currentCandidates = this.sampleCandidates()`）。这是三条落点共有的成本，且**不是一句「零状态写入」就能勾掉的**。

---

## 二、场景流转全景（rg 实证）

完成标准命令原文：

```
$ rg -n "scene.start|Scene\.start|start\(" \
    src/renderer/scenes/IntroScene.ts src/renderer/scenes/ModeSelectScene.ts
src/renderer/scenes/ModeSelectScene.ts:193:    this.scene.start('IntroScene');   // chooseSandbox()
src/renderer/scenes/ModeSelectScene.ts:198:    this.scene.start('IntroScene');   // chooseStory()
src/renderer/scenes/IntroScene.ts:575:    this.scene.start('GameScene');        // tryStart()
```

补测的上下游边（同上口径，逐条 file:line）：

| 边 | 位置 | 前置写入 |
|---|---|---|
| Boot → ModeSelect | `BootScene.ts:100` | 仅当 `introDone` 为假 |
| Boot → GameScene | `BootScene.ts:98` | `introDone` 为真时跳过引导（hot reload 分支） |
| ModeSelect → Intro | `ModeSelectScene.ts:193` | `:192 registrySet(gameMode,'sandbox')` |
| ModeSelect → Intro | `ModeSelectScene.ts:198` | `:197 registrySet(gameMode,'story')` |
| Intro → Game | `IntroScene.ts:575` | `:557-574`（见 §三） |

**反向边计数：0。** 全仓搜 `ModeSelectScene` 的生产引用（`rg -n "ModeSelectScene" src/ --glob '!**/__tests__/**'`）共 11 处命中，其中**只有 `BootScene.ts:100` 是流转**，其余是 import（`main.ts:4`）、场景表注册（`main.ts:52`）、注释（`BootScene.ts:95`、`IntroScene.ts:190/563`、`ModeSelectScene.ts:6`、`TransitionScene.ts:39`）与类型引用（`registry.ts:11`）。⇒ 「回到模式选择」在应用内**无路可走**，唯一事实上的出口是**刷新页面**。

⚠ 顺带暴露一条**与回流无关但同源**的既有缺陷（登记，不在本单修）：刷新页面会清空 registry（见 §三「registry 非持久化」），`BootScene.ts:97` 的 `introDone` 因此归零 ⇒ **老玩家一旦刷新，就被强制重走一遍模式选择＋序章**，哪怕磁盘上有存档。这条既是「要不要加回流出口」的产品诉求来源，也是「回流后邦名丢失」的真实放大器。是否单列一单待裁决。

---

## 三、状态写入点清单与回退窗口期判定

完成标准命令原文与输出：

```
$ rg -n "store|registrySet" src/renderer/scenes/IntroScene.ts
3:import { REGISTRY_KEYS, registryGet, registrySet } from '../ui/registry';
557:    registrySet(this.registry, REGISTRY_KEYS.countryName, countryName);
558:    registrySet(this.registry, REGISTRY_KEYS.identity, identity.id);
560:    const store = registryGet(this.registry, REGISTRY_KEYS.store);
561:    if (store) {
562:      store.addModifier(structuredClone(identity.startingModifier));
566:        store.startStoryMode(); // 设 mode='story' + 初始化 storyFlags（序章态）
568:        store.setMode('sandbox');
571:      store.startNewGameNpcs(Math.floor(Math.random() * 0x7fffffff));
574:    registrySet(this.registry, REGISTRY_KEYS.introDone, true);
```

（`5/6/12/13...` 等行号未列出＝该串在 import 段与注释里另有命中，上表为**写入点全集**；`:563` 是注释行。）

**关键判定：9 个写入点全部位于 `tryStart()`（`:550-576`）内**，函数前有三道早返回守卫：`:551` 邦名非法 / `:552` 未择身份 / `:554` 身份找不到。守卫任一命中即 `return`，**一个字节都不写**（此行为已被 `IntroScene.test.ts:70/:87` 两例钉住：「邦名非法时 tryStart 早返回——不写 registry 不进场」「未择身份时 tryStart 早返回」）。

⇒ **回退窗口期（玩家看得见「返回」按钮的全部时刻）＝ `tryStart()` 之外 ＝ 零写入。** 唯一需要留意的是 `:575` 紧跟 `:574`，两者之间没有 await/回调，浏览器事件循环插不进来，故**不存在「写了一半时被按下返回」的中间态**。

两条附带事实：

- **registry 非持久化**：`src/renderer/ui/registry.ts` 全文对 `localStorage|sessionStorage|persist|WeakMap` **零命中**（实测），读写走 `registryGet/registrySet(dm: Phaser.Data.DataManager, ...)`（`:86/:91`），即挂在 Phaser 的 game registry 上。⇒ `introDone`/`countryName`/`identity`/`gameMode` **四键全不进存档**，A/B 两案加任何「返回」按钮都**不会新增或改动存档字段**。
- **存档里真正有的引导相关字段只有两个**：`saveLoad.ts:349 mode` 与 `:353-361 storyFlags`（序列化侧），反序列化侧 `:531/:538`。这两者由 `:566/:568` 写入，即**仍在 `tryStart()` 内**，同样落在回退窗口之外。

---

## 四、三种落点的成本／风险／回滚对比

| 维度 | A 左上常驻「返回重选」 | B 首屏仅（第一屏给、进入立邦段后收起） | C 迷路检测触发 |
|---|---|---|---|
| 触达性 | 最强，全程可见 | 中，玩家往下走就没了 | 取决于检测器质量 |
| 实现面（未实施，仅估算） | 1 个 Zone＋1 个 Text＋1 个回调 `scene.start('ModeSelectScene')`，约 15–25 行；**须复用 `:199 events.once(SHUTDOWN, ...)` 既有防护**，否则 DOM 输入框监听器泄漏（`shutdown()` 体在 `:578-585`） | A 的代码量 ＋ 1 个「当前处于第几段」的显隐条件。**但该条件盘上不存在**：IntroScene 是**单屏三段并列**（`countrySectionLabel :162` / `identitySectionLabel :172` / `prologueTitleText :176`），无翻页/步骤游标（`rg "step\|phase\|index\|screen"` 在本文件内**无**步骤量命中）⇒ B 案要么先引入步骤状态（＝把单屏改分步，属 UX 变更），要么退化成「滚动态判断」 | **前置数据不存在**：`rg "Date\.now\|performance\.now\|setTimeout\|idle\|停留"` 在 IntroScene 内只有 `:193` 那一个 80ms 排版防抖 `setTimeout` ⇒ **没有可用于「迷路」判定的任何计时/无操作通道**，需新建信号源 |
| 副作用：玩家输入 | **丢**（§一.3：邦名在 DOM `.value`、身份在实例字段） | 同 A | 同 A，且玩家在「已输入后」被弹出提示，主观剥夺感最强 |
| 副作用：`gameMode` | 无损——`ModeSelectScene.ts:3` **只 import 了 `registrySet`，没有 `registryGet`** ⇒ 回 ModeSelect 不读旧值、不报错，但**也不会高亮上次选的那张卡**（重选无「当前选择」提示） | 同 A | 同 A |
| 存档兼容 | **不触**（§三：四键均在 registry，不入档） | **不触** | **会触** ⇒ 见下 ⚠ |
| 误触风险 | 中：常驻按钮离「开始立邦」近，可能把已输入邦名的玩家直接踢走 | 低 | 高（判错＝在玩家即将完成时打断） |
| 回滚成本 | 最低：删按钮＋回调即回到现状，**无状态迁移、无存档字段** | 低（若未引入步骤状态） | 最高：检测阈值/计数一旦落盘就得处理旧档缺省，回滚要连带做兼容 |
| 测试增量 | `IntroScene.test.ts` 现 3 例／103 行，加 1 例「点返回→`scene.start('ModeSelectScene')` 且 registry 四键全未写」 | A 的那 1 例 ＋ 显隐条件用例 | A 的那 1 例 ＋ 检测器用例（需注时钟，参照本仓既有假钟做法） |

⚠ **只有 C 命中存档兼容硬触发**：若「迷路」要跨会话生效（例如「这玩家上次卡住了，下次直接给提示」），判定数据**放不进 registry**（它不进档，§三），必须新增存档字段 ⇒ 属**向后兼容的加法**，需照 `saveLoad.ts:52/:54/:56` 已确立的「旧存档没此字段时 deserialize 兜底」范式处理，且产物**需 GPT 独立复核后方可当定稿**。
反过来说：**若 C 只做「本会话内」的检测（不落盘），它就不触存档兼容**——这时它与 A/B 的差异只剩阈值与误触风险。**C 的两副面孔请在裁决时明确拆开**，别以一句「迷路检测」混着批。

---

## 五、与 c918-21 / c918-24 的衔接

- **c918-24**（`docs/insights/colony-onboarding-walkthrough-20260918.md:18` 与 `:23`）把「IntroScene 单向门」记为 P2-1 负相关项，并列第 3 条待办「IntroScene 回流出口做产品裁决（c918-21 核报已列）」。**本稿即该待办的裁决材料**，把「是否要做」细化为「三条落点各自做/不做」。
- **c918-21**（`zcode-bridge/outbox/c918-21-colony-introscene-test.result.md`，实为 **partial／只读核报，零测试落地**）原话：「任务书前提『跳过序章→ModeSelect』出口与『故事 NPC 装配』在码内不存在——grep 实测 IntroScene 内 ModeSelectScene 零命中、无跳过语义，唯一出口＝立邦流程 `scene.start('GameScene')`（:575）」。
  - **衔接更正（措辞层面，不改结论）**：c918-24 的 `:18` 转述成「序章无『**跳过**→ModeSelect』回流」。而 c918-21 的实测是「**返回/回流**边不存在」，两者不是同一件事——**「跳过序章」和「退回重选」是两个独立出口**：前者只解决「老玩家不想再看」，后者解决「选错了想改」。c918-24 用「跳过」一词覆盖了「回流」，**可能让后续派单只做一个而漏掉另一个**。本稿按磁盘实况取「反向边计数为 0」这一更宽的口径。裁决时请先明确：**要的是跳过、回流，还是两者**。
  - c918-21 的 `:22` 遗留问题「产品裁决项：序章回流出口是否需要（当前设计单向）」＝本稿正题。它当时的锚点复核（`:16 grep 'ModeSelectScene' IntroScene → 零命中`）在本稿 `:563` 处**已不再成立**——那是**注释**里的 `ModeSelectScene`（"按 ModeSelectScene 选定的模式落进 state"），非流转边。本稿的 `rg "scene.start"` 口径不受影响，结论仍是单向。
  - c918-21 `:21` 建议的「立邦→registry→GameScene」测试切片**已由后浪落地**：`src/renderer/scenes/__tests__/IntroScene.test.ts` 现 3 例（`:54` 正向链路、`:70/:87` 两道守卫），**无需再做**。
- **对 P2-1「第一局自解释」目标**：§二 揭示的「刷新页面即强制重走引导」意味着**当前最常被使用的『回流』手段其实是刷新**，而刷新代价最大（丢输入＋老玩家重看引导）。⇒ 三条落点里任何一条的净收益，都应相对「刷新」这个既有事实出口来衡量，不是相对「零出口」。

---

## 六、留给裁决的未决问题（本稿不代选）

1. **要「跳过」还是「回流」还是两者？**（§五 衔接更正的直接后果）
2. **邦名/身份在回流后是否要保**？若要保，就必须把两者从 DOM/实例字段上收到 registry——`countryName`/`identity` 两个 registry 键**已经存在**（`:557/:558` 在写），所以这更像「提前写、写完再回退」的顺序问题，不是新增字段问题。但**一旦提前写，§三 的「回退窗口零写入」结论即失效**，A/B 是否仍不触存档兼容需重判。⇒ 这条单独拍。
3. **是否接受在 IntroScene 之前引入「步骤状态」**？B 案的成立前提（§四 第 3 行），与 P2-1 的分步引导诉求可能合批，也可能互斥。
4. **C 案是否落盘**？不落盘＝不触存档兼容、但下次进来就忘；落盘＝触硬触发、需 GPT 独立复核。
5. §二 末尾登记的「刷新即重走引导」缺陷是并单还是另单。

---

## 七、零改动自证

本单只在 `docs/insights/` 新增本文件，未动任何 `.ts`／测试／fixture／经济参数。取证命令全部只读（`rg`／`awk` 打印／`wc`），无 `>` 重定向落盘（避在册「子进程 stdout 重定向进 tmp 静默 0 字节」坑）。
