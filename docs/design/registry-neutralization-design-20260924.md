# Registry 层「置中性化」设计稿 · 2026-09-24

> 单号 `c924-31` · 执行班 `qoder-executor-20260924-2341-colony25` · cwd `D:\code\colony-game`
> 取数 HEAD `cc29179`（本文所有 file:line 只在该 HEAD 有效；引数前请复跑附录 A）
>
> 🔴 **性质：只出稿。** 本班不写门禁、不写迁移代码、不改任何测试与配置；§5-§6 的批次与计数是**阶梯推演**，
> 落库顺序与终值须由主班排单＋人工评审决定。本单不触经济平衡数值域（架构面），但**架构改动面本身按"需评审"处理**。

---

## 0. 任务书前提复核（逐条实测，含否证）

| # | 任务书前提/锚点 | 实测 | 结论 |
|---|---|---|---|
| A1 | `src/renderer/ui/registry.ts:29` `export const REGISTRY_KEYS = {` | 该行逐字一致 | ✅ 零漂移 |
| A2 | `ui/registry.ts:86` `registryGet` 签名 | 该行逐字一致（含 `dm: Phaser.Data.DataManager` 入参） | ✅ 零漂移 |
| A3 | `ui/registry.ts:91` `registrySet` 签名 | 该行逐字一致 | ✅ 零漂移 |
| A4 | 「五景 create 注入形态三样」 | 盘上 scenes 共 **6 景**（Boot/Game/Intro/ModeSelect/Transition/UI），**BootScene 也读 registry**（:97 `introDone`） | ⚠ 口径修正：卷宗与 c923-32 都刻意把 Boot 排除在"五景"外（c923-32 已由 c923-13 覆盖）。本文按**六景**成稿，完成标准①的 5 个逐景小节全部具备 |
| A5 | 「TransitionScene scene data 载荷」 | 该景 registryGet/registrySet **各 0 次**；注入走 `create(data: TransitionData)`（:45） | ✅ 成立，但要正名：它是**唯一零 registry 耦合**的景，形是 `scene.launch(key, data)` 的**启动载荷**，不是 `scene.data` |
| A6 | 「与**在箱** pd09 键读取口门禁不撞」 | `zcode-bridge/inbox/` **无 pd09**；实际件在 `done/20260924-0045-pd09.task.md` ＋ `outbox/20260924-0045-pd09.result.md`（status **done**，产物 `src/renderer/state/__tests__/modifierReadPortGate.test.ts` 已入库于 `c07c461`） | 🔴 否证：pd09 不在箱、已完成 |
| A7 | 承接 A6：pd09 与本单是"同一套键的分工"吗 | pd09 的"键"是 **`MODIFIER_TARGETS` 27 键**（`data/resourceRegistry.ts:58`，修饰符 target）；本单的"键"是 **`REGISTRY_KEYS` 22 键**（Phaser DataManager 的 scene 注入口） | 🔴 否证：两套键**不同域**，"不撞"不是分工而是**根本不相干**（表述歧义已在 §8 消歧） |
| A8 | c923-32 缺口 4「6 个 registry 键有写无读」 | 本班三轨复扫（附录 A 第 3 条）：**仅 2 键真无读**（`countryName`、`identity`）；c923-32 名单里的 `policyTreePanel`/`diplomacyPanel`/`militaryPanel`/`megaProjectPanel`/`influencePanel` **有读取方**——读取写在 `HUD.ts:506` 的**动态派发** `registryGet(this.scene.registry, REGISTRY_KEYS[d.reg])` 里，按静态单键正则扫必然漏 | 🔴 否证（在册数与盘上不符第 N 例）：6 → **2**（且这 2 键生产侧仍无人读，见 §3-2）。c923-32 自查过"裸 `registry.get(`"，但没自查"helper 的动态键实参" |
| A9 | c923-32「scenes/\_\_tests\_\_ 现役 9 件／31 例」 | 现读 **13 件**，其中 **3 件未跟踪**（`IntroSceneShutdown`、`ModeSelectSceneShutdown`、`UISceneEventSet`），系同仓写位兄弟班 colony24 的 c924-25/26/30 **在途件**（本班禁碰）。本班收班复验时同仓又净增 1 件未跟踪 `src/renderer/data/__tests__/particlesKeys.test.ts` ⇒ 读数在窗口内即变 | ⚠ 计数已过期且**仍在变动**：本文不据"件数"下任何结论，只在 §5 把它当排序约束 |
| A10 | c923-32 矩阵「GameScene registry 读 **6 键**（含 `mapRenderer`）」 | `rg -n "registryGet\(" src/renderer/scenes/GameScene.ts` → 10 个读点、**5 个键**；`mapRenderer` 在本景只出现在 `registrySet`（:189/:604） | 🔴 否证：6 键 → **5 键**（c923-32 把写侧键同时记进了读侧列） |

> 结论：**A6/A7/A8/A10 四条为否证**（A8/A10 属「在册档读数与盘上不符」），本文一律按磁盘实况成稿；A4/A5/A9 为口径修正。

---

## 1. 键面与调用面盘点（registry.ts:29 / :86 / :91 现状）

- `REGISTRY_KEYS`（:29-52）**22 键**；`RegistryKey`（:54）由 `typeof REGISTRY_KEYS` 派生；`RegistryTypes`（:57-80）键→值类型映射。
- `registryGet`（:86）/`registrySet`（:91）入参都是 `Phaser.Data.DataManager` —— 注释自己点明"scene.registry 与 game.registry 皆可（main.ts 启动期没有 scene 只有 game）"。**这一句就是本稿要消掉的口子。**
- `REGISTRY_KEY_COUNT = Object.keys(REGISTRY_KEYS).length`（:99），唯一钉子：`ui/__tests__/registry.test.ts:45` `expect(REGISTRY_KEY_COUNT).toBe(22)`（该件共 3 例）。

调用面（非测试件、剥注释后，脚本见附录 A 第 2 条）：

| 轨 | 口径 | 读数 |
|---|---|---|
| T1 静态 helper | `registryGet/registrySet(dm, REGISTRY_KEYS.X)` 字面实参 | **get 39 ＋ set 38 ＝ 77 处**，散布 **16 个非测试文件** |
| T2 动态派发 | `REGISTRY_KEYS[expr]` | **1 处**（`ui/HUD.ts:506`，覆盖 5 个 panel 键） |
| T3 裸访问 | `registry.get(/set(` | **1 处**命中且属另一对象（`data/buildingRegistry.ts:30`，是 Map 不是 DataManager）⇒ Phaser 侧 helper 覆盖率 100% |

按文件的分布（T1，降序）：`UIScene` 3/26、`HUD` 14/0、`GameScene` 10/2、`IntroScene` 2/3、`PolicyTreePanel` 1/3、`main.ts` 0/2、`ModeSelectScene` 0/2、`BootScene` 1/0，其余 8 个 UI 模块各 1/0（`BuildPanel`、`DiplomacyPanel`、`InfluencePanel`、`JitHintManager`、`MegaProjectPanel`、`MilitaryPanel`、`SaveLoadPanel`、`Toast`）。

> ⚠ 别把 registry.ts 头注释里的"旧况：77 处散落字符串"当锚点：那是**迁移前**裸字符串调用数，与今天 T1 的 77 纯属撞数，不同口径。
> 关键读数：**`UIScene` 一处就占 26 个写点**，`HUD` 占 14 个读点 —— 这对组合就是"服务定位器"形态的心跳。

---

## 2. 现状形态矩阵（六景 × 注入面）

| 景（行数） | create 签名 | 形态判定 | registry 读 | registry 写 | 启动方式（实测调用点） |
|---|---|---|---|---|---|
| BootScene（103） | **`async create(): Promise<void>` :85**（六景唯一 async create，等字体 ready） | **E 只读分流**：仅 `introDone` 决定去 GameScene 还是 ModeSelectScene（:96-101） | `introDone` :97 | 0 | autostart（`main.ts:52` scene[0]） |
| ModeSelectScene（246） | `create(): void` | **D 只写不读**：把选择结果塞进 registry 当"跨景传参" | 0 | `gameMode` :192/:197 | `scene.start('ModeSelectScene')` BootScene:100（**无载荷**） |
| IntroScene（586） | `create(): void` | **C 取件＋写回**：读 store/gameMode，写 countryName/identity/introDone | `store` :560、`gameMode` :564 | 上述 3 键 :557/:558/:574 | `scene.start('IntroScene')` :193/:198（无载荷） |
| GameScene（612） | `create(): void` :164 | **B 纯 registry 取件**：**5 键读**、1 键写（`mapRenderer`，注册＋shutdown 清） | :168/:169/:198/:338/:460/:510（toast×4）、:312/:364/:443（treePanelOpen×3）、:522（audioManager）＝10 读点 | `mapRenderer` :189、shutdown :604（undefined） | `scene.start('GameScene')` BootScene:98 / IntroScene:575（无载荷） |
| UIScene（437） | `create(): void` :193 | **B′ 取件＋自建自注入**（最重）：读 3 键、**create 段写 14 键**（全件 26 写点） | :196 store、:197 buildMode、:281 mapRenderer（懒取） | 14 键 :207-255；shutdown 段 12 点 :406-416（11 键写 undefined ＋ `treePanelOpen=false` :411） | `scene.launch('UIScene')` GameScene:249（无载荷，`active:false` :190） |
| TransitionScene（146） | `create(data: TransitionData)` :45 | **A 启动载荷注入**（五景唯一，也是**唯一零 registry 耦合**） | 0 | 0 | `scene.launch('TransitionScene', data)` GameScene:124/:145 |

三样判定按卷宗口径归位：**A ＝ TransitionScene 载荷形**、**B/B′ ＝ Game/UI 自取形**、**C/D/E ＝ Intro/ModeSelect/Boot 的"写侧/半侧"形**（卷宗把 ModeSelect 归入"取件"，实测它是**只写不读**；已在 §0-A7 留痕）。

---

## 3. 为什么值得做「置中性化」（全部是实测证据，不是理念）

1. **"场景作用域"是幻觉。** Phaser 的 `Scene#registry` 由 `Systems#registry` 注入，注释原文：*"A reference to the global registry. This is a **game-wide** instance of the Data Manager"*（`node_modules/phaser/src/scene/Systems.js:150-153`，`InjectionMap.js:25`）。⇒ 六景的 `this.registry` 与 `main.ts` 的 `game.registry` 是**同一个 Map**。所谓"景内自取"实际是**读全局单例**，这正是"测试需要真 DataManager / 或自建 `registryStore` Map"的根因。
2. **跨景传参已经烂过一次。** `REGISTRY_KEYS.countryName`（字符串值 `'introCountryName'`）与 `identity`（`'introIdentity'`）由 `IntroScene:557/:558` 写入，**生产侧零读取方**（T1/T2/T3 三轨皆无），`gameStore.ts` 内亦查无 `countryName` 字段。⇒ 玩家输入的邦名经 registry 传出后被丢弃（若 UI 另有呈现通道，属 registry 面之外，需人工核，见 §9-3）。
   ⚠ 加重项：`rg "REGISTRY_KEYS\.(countryName|identity)" src/` 的**唯一读侧命中在测试件** `scenes/__tests__/IntroScene.test.ts:61-62`，断言的是"值写进去了"而非"有人用它"——**门禁把死键钉成绿灯**，反而掩盖了零消费者。这正是 §4 验收口径③要显式处理的情形。
3. **清理面天生不对称，且只有"写方"知道要清。** `UIScene.shutdown()` 销毁 25 个对象（:380-404），但只回写 11 个键为 undefined（:406-416）——`productionPanel`:388、`gradePanel`:389、`scoreCardPanel`:390 **对象已 destroy 而 registry 槽仍持引用**。今天无读取方所以不炸，属**潜伏悬垂**。中性化后"引用随作用域消失"，这类 11-vs-14 的对不齐**按构造不可能出现**。
4. **动态派发把静态门禁打成瞎子。** §0-A8 已经用 `HUD.ts:506` 的 `REGISTRY_KEYS[d.reg]` 把 c923-32 的"6 键无读"证成"2 键无读"。⇒ 任何"键有无读取口"式门禁（pd09 型）**必须先处理动态实参**，否则结论不稳。
5. **测试缝在"registry 类型"上是 any／裸串混用。** `ui/__tests__/fakeScene.ts:144` `registry: any`、`:159` `registry: { get: vi.fn(), set: vi.fn() }`、`:191/:199/:235-237` 另建 `registryStore: Map` 充当假 DataManager；`MegaProjectPanel.test.ts:46`、`PolicyTreePanel.test.ts:33` 更用**裸字符串** `'toast'` 当键。⇒ 类型化收益在测试侧被 `any` 与字面串回吐。
6. **启动根只有一个，却被当成通用总线。** 真正的"一次性根注入"只有 `main.ts:174-175`（store、buildMode）2 处。除它之外的 38 处写，本质是**把参数总线伪装成注册表**。中性化要保留的是这 2 处，要消掉的是其余。

---

## 4. 目标形态（中性注入面）

**定义（本稿口径）**：一个对象所需的协作者，在**它被创建的那一刻**由创建者作为**形参/依赖对象**给它；被创建者**不得**在执行期从全局可変容器里自行取件。⇒ 协作者集成为**编译期可见的构造签名**，测试传替身即可，不需要任何 DataManager。

三种候选（只描述形态与代价，**不定稿选哪个**）：

| 案 | 形态 | 能吃到什么 | 代价 |
|---|---|---|---|
| 甲 | **显式依赖对象**：`interface SceneDeps { store: GameStore; buildMode: BuildMode; … }`，由 `main.ts` 构造一份，经 Phaser `scene.start(key, { deps })` 载荷逐景传；景内 `create(data)` 收 | 复用 §2-A 的 TransitionScene 既有形（盘上已有先例，非新造抽象）；测试直接 `create({deps: fake} as any)` 或干脆不用 Scene | `scene.start` 载荷在**热重载/dev 重启**下会丢（BootScene:96-98 正是靠 registry 常驻躲过这坑，见 §7 R2） |
| 乙 | **构造/工厂注入**：面板与 manager 一律 `new XxxPanel(scene, deps)`，`deps` 由**唯一的组合根**（`main.ts` 或新 `compositionRoot.ts`）装配；`UIScene` 的 14 个"注册"退化为**字段**＋一个 `PanelSet` 出参 | §3-3/§3-5 两条一次性消失（无槽可漏清、无 any registry）；HUD 工具栏的 5 个按钮从"查表取件"改为**持有 `PanelSet`**，顺带消掉 §3-4 的动态键 | `HUD.ts` 14 个读点要改签名，是**唯一跨 UI 层**的批量改面（§5 批 3 的主体） |
| 丙 | **保留 registry 但降级为"根容器"**：只允许 `main.ts` 那 2 键常驻；其余 20 键改为**类型化上下文对象**（乙案），registry 侧加一道守护测试禁止新增键 | 迁移最慢、可增量；`REGISTRY_KEY_COUNT` 钉子直接当"下降曲线"看守 | 双轨期最长，"同一对象两条获取路径"最易腐（要配套 §6 的门禁才敢开） |

**验收口径（写单时用，本稿不实现）**：中性化"完成"的判据建议钉成三条可复算事实——
① `rg -c "registryGet\(|registrySet\(" src/renderer --glob '!**/__tests__/**'` 从 **77** 降到只剩组合根的 **≤2**；
② 五景（Game/UI/Intro/ModeSelect/Transition）测试件里 `registry` 字样 **0 命中**（今天 `fakeScene.ts` 的 3 处 registry 面退役）；
③ `countryName`/`identity` 两键要么有读取方、要么**整键删除**（22 键不靠"留着占位"存活）。

---

## 5. 逐景迁移梯队（4 批，含每景小节 ＝ 完成标准①）

排序原则：**先动零耦合/单侧的景把形态跑通，最后动读写核心；每批都以"兄弟班在途测试件全绿"为放行闸。**

### 5.0 批 0（前置，不属于迁移）：等 colony24 三单入库

`scenes/__tests__/IntroSceneShutdown.test.ts`、`ModeSelectSceneShutdown.test.ts`、`UISceneEventSet.test.ts` 现为**未跟踪在途件**（§0-A9）。
它们钉的正是"SHUTDOWN 清理面/事件集配对"——**恰好是 §7 R1/R3 的回归网**。梯队第一批不得与这三件同窗改同一文件。

### 5.1 批 1｜TransitionScene ＋ BootScene（试点，验证"载荷形"与"只读形"两端）

- **TransitionScene**：已是目标形（`create(data)`、registry 0 接触）⇒ **零改动，当活样板**，并在设计层把它记为"形 A 的参考实现"。
- **BootScene**：唯一读点是 `introDone`（:97），写点在 `IntroScene:574`。这一对是**纯热重载旗标**，与"传参"无关 ⇒ 保留 registry 或改 `game.registry` 单点皆可，但**必须显式命名成"跨重启旗标"这一特例**（否则批 4 收口时会把它当漏网键误删，直接踩 dev 重启重复放楔子的老坑）。
  ⚠ 本景是六景里**唯一 `async create()`**（:85，等 `document.fonts.ready`）⇒ 若给它加"载荷必传"约束，要注意 await 之后 `scene.start` 才发生（:98/:100），载荷形在这条异步路径上比 registry 更脆（R2 同因）。
- 放行判据：`rg -c` 的 T1 计数从 77 起降（Boot/Transition 侧不动也可，只要根形跑通）；两景测试件零改。

### 5.2 批 2｜ModeSelectScene ＋ IntroScene（"写侧传参"退化为显式载荷）

- **ModeSelectScene**：0 读 2 写（`gameMode` :192/:197）。中性化形：`scene.start('IntroScene', { mode })`（:193/:198 两处），`gameMode` 键退役。风险点：`IntroScene` 读它的地方是 :564，改成 `create(data)` 形参与 TransitionScene 同构。
- **IntroScene**：2 读 3 写。`store` 改由载荷/根传入；`countryName`/`identity` **直接面对 §3-2 的死键裁决**（删键 or 建读取方，二者都要人拍板，见 §9-3）；`introDone` 归批 1 的特例处置。DOM 面（`inputEl` 监听 :254↔:582）与 registry 无关，**本批不碰**（那是兄弟班在途件的地盘）。
- 放行判据：`REGISTRY_KEYS` 键数只可能因删 `gameMode`/`countryName`/`identity` 而**下降**；`registry.test.ts:45` 的钉子必须与本批同步改（§6）。

### 5.3 批 3｜GameScene ＋ UIScene ＋ HUD（读写核心，本梯队的主体与风险集中处）

- **GameScene**：6 读 1 写。`store`/`buildMode` 走根注入（保持与 `main.ts:174-175` 同源），`toast`/`audioManager`/`mapRenderer`/`treePanelOpen` 四键必须改**乙案 `deps`**——注意 `toast` 被 12 处读、`audioManager` 6 处（T1 口径），这是全仓最大的一组隐式依赖。
- **UIScene**：2 读 14 写 ＋ shutdown 清 11。改乙案后 14 个"注册"退化为字段＋一个 `PanelSet` 出参；**§3-3 的 3 个漏清键（productionPanel/gradePanel/scoreCardPanel）在该形下无槽可漏**。
- **HUD**：14 读 0 写 ＋ 1 动态派发。动态实参 `REGISTRY_KEYS[d.reg]`（:506）必须在这一批改持 `PanelSet`，**否则 §3-4 的失明门禁会一路跟到批 4**。
- 连带测试面（本班不写，仅登记）：`UIScene.test.ts`（钉"create 全套注册进 registry"）、`GameSceneLifecycle.test.ts`、`scenes/__tests__/UISceneEventSet.test.ts`（在途）——**这三件的断言面与迁移形直接冲突，属"改测试"而不是"加测试"**，需与写位班错峰并单独排单。
- 放行判据：T1 读数应落在个位数；UI 层 8 个"各 1 读"模块（BuildPanel/DiplomacyPanel/…）随 `deps` 一并退役。

### 5.4 批 4｜收口与守卫

- 处置 `registryGet`/`registrySet`/`RegistryTypes`/`REGISTRY_KEY_COUNT` 四件套：留（作根容器，见丙案）或删（T1 归 0）。
- 把 §4 的三条验收口径写成常驻守护（**手法照抄 pd09 型门禁的"白名单＋牙齿证明"**，见 §8）。
- `docs/insights/colony-registry-keys-20260913.md`、c923-32 缺口 4 的"6 键"结论需**按 §0-A8 改判为 2 键**（文档面，属人工）。

### 5.5 逐景要点（完成标准①：五景各有一小节，另附第六景 Boot）

**① GameScene（批 3）** — 现状形 B：`create()` :164 零参，**读 5 键 10 点**（`store`:168、`buildMode`:169、`toast`:198/338/460/510、`treePanelOpen`:312/364/443、`audioManager`:522）；`mapRenderer` 在本景**只写不读**（:189 注册、:604 清）。目标形：`store`/`buildMode` 由根给、其余走 `SceneDeps`。兼容期：`shutdown:604` 的 `mapRenderer=undefined` 回写必须与新形"同批消失"，否则出现"字段已中性化、槽仍在清"的半吊子。验收点：`registryGet` 在本件 0 命中。

**② UIScene（批 3，主体）** — 现状形 B′：`create()` :193 读 3 键（:196/:197/:281）、写 14 键（:207-255）；`shutdown` :347 销毁 25 个对象（:380-404）却只回写 11 键（:406-416）＋ `treePanelOpen=false`（:411）。目标形：14 个键退化为字段，对外以**一个 `PanelSet` 出参**交给 HUD/组合根。兼容期：批内**先加出参、后删注册**，两次提交之间旧读点仍可活。验收点：漏清 3 键（productionPanel/gradePanel/scoreCardPanel）在形上消失，且"写了未清"对称性核查脚本读 0。

**③ TransitionScene（批 1，样板）** — 现状形 A：`create(data)` :45，registry **0 接触**，由 `GameScene:124/:145` 的 `scene.launch(key, data)` 给载荷（`lines`/`onDone`/`imageKey`）。目标形：**不变**——它已是中性注入面的既成事实，本稿只把它升格为"其余五景的形参考"。验收点：本件在整场迁移中**零改动**（若需要改，说明目标形设计跑偏）。

**④ ModeSelectScene（批 2）** — 现状形 D：`create()` :61 **只写不读**（`gameMode` :192 `'sandbox'` / :197 `'story'`，随后 :193/:198 `scene.start('IntroScene')`）。目标形：把模式作为 `IntroScene` 的启动载荷，`gameMode` 键退役。兼容期：`IntroScene` 的读点（:564）与写点**必须同批改**，否则模式静默落回沙盒臂（`else` 分支 :567-568 会把 undefined 兜成沙盒；另 :561 `if (store)` 若 store 缺失则整段静默跳过）。验收点：`REGISTRY_KEYS.gameMode` 在非测试件 0 命中。

**⑤ IntroScene（批 2）** — 现状形 C：`create()` :196，读 `store`:560 与 `gameMode`:564，写 `countryName`:557/`identity`:558/`introDone`:574，然后 :575 `scene.start('GameScene')`（**无载荷**）。目标形：store 由根传入、`introDone` 归 R2 特例、**两个死键直面删或接的裁决（§9-3）**。⚠ 本景另有五景唯一 DOM 监听面（:254↔:582），**与 registry 无关、本梯队不碰**。验收点：`tryStart()`（:550-576）里 `registrySet` 计数从 3 降到 ≤1。

**⑥ BootScene（批 1，第六景）** — 见上文批 1 两条。

### 5.6 批次的放行闸（每批同一套）

批内改动 ⇒ ① `npm run type-check` 0 错误；② 定向跑受影响测试件（`scenes/__tests__` 与 `ui/__tests__` 的相关件，**不在并发窗跑全量**）；③ 三轨扫描（附录 A 第 2 条）读数按预期下降并写进 result；④ `REGISTRY_KEY_COUNT` 与本批键集同步（§6 选法后）。

> 🔴 每批的**回滚点**：批内单文件改；批间以 `git revert` 单笔为界（子班不 add/commit，实际由主班按批合笔）。

---

## 6. `REGISTRY_KEY_COUNT` 守卫怎么沿用

- 现状：值 **22**（`Object.keys` 派生），唯一钉子 `registry.test.ts:45` `toBe(22)`，另有该件 3 例（含"源码不再散落 registry.get/set 字符串"的文件遍历守护）。
- 钉子的性质：它是**计数钉子**（新增/更名必须先改中央表）。迁移期键数**只可能下降** ⇒ 三种改法，各有代价，**本班不选**：

| 法 | 写法 | 适用批次 | 弱点 |
|---|---|---|---|
| ①逐批下调 | 每批把 `toBe(22)` 改成该批目标值 | 甲/丙案 | 每批都要动同一行，与他班并发时最易冲突；且"下调"本身无方向感（写错方向也绿） |
| ②改成上界断言 | `toBeLessThanOrEqual(22)` ＋ 单独钉"已退役键不得回流" | 批 2 起 | 丢失"精确计数"信号，`REGISTRY_KEY_COUNT` 的注释语义（"新增必先改中央表"）弱化 |
| ③退役清单制 | 计数钉子冻结在 22，另加一张 `RETIRED_REGISTRY_KEYS` 白名单，断言 实际键集 ⊆ 22 − 已退役 | 批 4 收口 | 与 pd09 的 `NO_READER_WHITELIST` 同形，**白名单＝替退役签字**，属人工裁决位 |

- 🔴 **不做的事**：不为让测试变绿而把 `toBe(22)` 直接改成"当前实际值"却不同时改中央表——那正是 `registry.ts:96-97` 注释点名的"散落字符串回流"路径。

---

## 7. 迁移期兼容策略与风险面

| # | 风险 | 实测依据 | 处置方向（不定稿） |
|---|---|---|---|
| R1 | **双轨期取件路径不一致**：某键已改载荷但仍有旧读点，读侧拿到 undefined 走 `?? null`/早返回 ⇒ **静默降级**而非崩 | 现成的三例同型：`GameScene:198` `?? null`、`UIScene:281` `?? null`、`GameScene:338/460` `?.show(...)` | 双写单读（写两路、只读新路）过渡；每批加一条"旧路 0 命中"的字面门禁。**注意纪律档 §九.4 的坑：判据要"某字面串 0 命中"时，解释性注释也不能含该串** |
| R2 | **热重载/dev 重启丢载荷**：`scene.start(key, data)` 的载荷不跨重启常驻，而 `introDone` 正是靠 registry 常驻才避免重复放楔子 | `BootScene:96-98` 注释与分支；`IntroScene:574` 写 | `introDone` 明确列为"允许留在 game registry 的跨重启旗标"特例（批 1），其余键不因这条特例复活 |
| R3 | **悬垂引用**：迁移中若先删 `shutdown` 的回写、后改注册形，会留下"registry 持已 destroy 对象" | §3-3 的 3 个现网漏清键即此形态的活标本 | 每批收口跑一次"写了未清/清了未写"的对称性核查（本班脚本 `scan_uiscene_cleanup.py` 口径可复用，属临时件非交付件） |
| R4 | **动态实参让门禁失真** | §3-4 / §0-A8：`HUD.ts:506` | 迁移前先禁动态实参（或让门禁把 `REGISTRY_KEYS[...]` 展开为定义域并集），否则计数/读取口两条守卫都不可信 |
| R5 | **测试大面连带**：`fakeScene.ts` 在册禁碰，但它承载 8+ 个 UI 面板测试的 registry fake | §3-5 读数 | 任何需要动 `fakeScene.ts` 的批次**必须单开一单**交人工（它一改，`docs/insights/colony-test-asset-map` 那类映射全过期） |
| R6 | **同仓并发**：写位兄弟班正产 SHUTDOWN/事件集类测试件（§0-A9） | porcelain 现读 3 件未跟踪 | 见 §5.0：批 0 未放行前，批 1 不开 |

---

## 8. 与 pd09 的分工边界（完成标准⑤）

**先把一条歧义消掉**（§0-A6/A7 的否证）：pd09 **不在箱**，已于 `c07c461` 入库；且它管的是 **`MODIFIER_TARGETS` 27 键**（修饰符 target），与本单的 **`REGISTRY_KEYS` 22 键**（Phaser DataManager 注入口）**同名不同域**。

| 维度 | pd09（已入库） | c924-31（本稿） |
|---|---|---|
| 对象 | `MODIFIER_TARGETS`（数据层键） | `REGISTRY_KEYS`（场景注入键） |
| 问题 | 键"上架即无读取口"⇒ 效果静默失效 | 键被当跨景参数总线 ⇒ 值丢/悬垂/测试需真 DataManager |
| 手法 | 门禁测试（入口函数穷举 ＋ `NO_READER_WHITELIST` 12 键 ＋ 探针"牙齿证明"） | 设计稿（形态矩阵 ＋ 4 批梯队），**不写门禁** |
| 交集 | 唯一可借的是**手法**：§5.4/§6 的"退役清单制"就是 `NO_READER_WHITELIST` 的同形物 | — |
| 不相交 | 本稿不改 `resourceRegistry.ts`、不碰修饰符数值、不碰 `modifierReadPortGate.test.ts`；pd09 也不涉及 Phaser DataManager | — |

⇒ "不撞"成立，但成立理由是**两套键不同域**，不是因为排队分工。派单文案需按此修订（§9-1）。

---

## 9. 遗留问题

1. 卷宗 A6/A7 两处表述要改：pd09 的"在箱"应改为"已入库 `c07c461`"；"键读取口门禁"须加限定词"修饰符 target 键"，否则后续班会把两套 22/27 读成同一条。
2. **c923-32 缺口 4 的"6 键有写无读"需按 §0-A8 改判为 2 键**（`countryName`/`identity`）。原档：`docs/insights/colony-scenes-di-census-20260923.md` 第三节缺口 4（已入库洞察件，本班不修订；**改判属人工**，且它牵动 `docs/insights/` 那 3 份并存索引的一致性）。
3. **邦名是否真的没呈现**：registry 面零读取已证；玩家可见的国号是否经别的通道（store/HUD）取得，本班未测 ⇒ 需人工核后再决定"删 2 键"还是"补读取方"（这条同时是 §5.2 批 2 的入口裁决）。
4. §4 三案（甲/乙/丙）与 §6 三法未选。选案的真正约束是 R5（`fakeScene.ts` 禁碰面）与批 3 的 UI 层批量改面，二者都超出执行手授权。
5. §5.0 批 0 依赖兄弟班 3 件未跟踪测试入库 ⇒ 梯队的**绝对时点**由主班排期定，本文只给相对顺序。
6. `docs/insights/` 索引未补（派单：3 份并存无权威，属待人工）。

---

## 附录 A：复算命令（cwd `D:\code\colony-game`，HEAD `cc29179`）

```bash
# 1) 三锚点（A1/A2/A3）
rg -n "export const REGISTRY_KEYS|export function registryGet|export function registrySet|export const REGISTRY_KEY_COUNT" src/renderer/ui/registry.ts
# 2) T1/T2/T3 三轨调用面（§1 表；脚本剥注释后按文件计，落盘件在 gitignored tmp/，非交付物）
python tmp/qoder-executor-20260924-2341-colony25/scan_registry.py
rg -n "REGISTRY_KEYS\[" src/ --glob '!**/__tests__/**'      # T2：恰 1 处，HUD.ts:506
rg -n "registry\.(get|set)\(" src/ --glob '!**/__tests__/**' # T3：1 处且属 buildingRegistry（非 Phaser）
# 3) 有写无读的真实名单（A8 否证：2 而非 6）——把 T1 的 get 计数与 T2 展开并集相减
rg -n "REGISTRY_KEYS\.(countryName|identity)" src/          # 只出现"写"侧
rg -n "countryName|identity" src/renderer/state/gameStore.ts # 无匹配 ⇒ store 侧亦无承接
# 4) 六景形态矩阵
wc -l src/renderer/scenes/*.ts
rg -n "scene\.(start|launch)\(" src/renderer --glob '!**/__tests__/**'
rg -n "registryGet|registrySet|create\(data" src/renderer/scenes/*.ts
# 5) UIScene 写了未清（§3-3）
python tmp/qoder-executor-20260924-2341-colony25/scan_uiscene_cleanup.py
# 6) 钉子与测试缝（§3-5 / §6）
rg -n "REGISTRY_KEY_COUNT" src/
rg -n "registry" src/renderer/ui/__tests__/fakeScene.ts
# 7) Phaser registry 是全局单例（§3-1）
rg -n "game-wide instance of the Data Manager|registry: 'registry'" node_modules/phaser/src/scene/Systems.js node_modules/phaser/src/scene/InjectionMap.js
# 8) 零代码改动自证（完成标准④）
git status --porcelain src/          # 期望：无 ' M '（他班未跟踪在途件另列，非本班产物）
git diff --stat                      # 与接班基线逐字相同（基线快照见附录 B）
```

> ⚠ 三条本机坑：`rg -rn` 的 `-r` 是 **replace**（会把命中词替换掉，分布当场变假象）⇒ 本附录一律 `rg -n`；
> 在册计数常与盘上不符（本文 A8/A9 两例）；`comm -13` 在本机 locale 下会假报无差异 ⇒ 零夹带自证用 `diff <(sort a) <(sort b)`。

## 附录 B：改动面声明

- 本班产出：**仅新增本文件 1 份** `docs/design/registry-neutralization-design-20260924.md`（LF 行尾）。
- 未改：`src/**`（含 `ui/registry.ts`、六景、`ui/HUD.ts`）、任何测试件、任何配置、`fakeScene.ts`、`vitest.config.ts`、三份 `tsconfig*.json`。
- 未碰（他班在册/在途）：`docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-dead-exports-20260914.json` 及 `.bak`、`src/renderer/scenes/__tests__/` 内 3 件未跟踪测试（colony24）。
- 临时件：`tmp/qoder-executor-20260924-2341-colony25/`（gitignored，`.gitignore:25`），内含两份扫描脚本与 `git diff --stat` 基线快照；**非交付物**，附录 A 引用它们只为可复算。
- 未跑测试套件、未跑 tsc/build：判据④只要求零改动，且同仓写位班并发（跑了不可归因）。
