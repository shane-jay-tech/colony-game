# c927-16 人口双生效来源消歧裁决材料（people vs populationClasses）

- 工单：`c927-16`（cwd `D:\code\colony-game`，软预算 ≤30 分钟）
- 班次：`qoder-executor-20260927-1850-colony41`（波次 24 只读采集班）
- 取证时点：2026-09-27 18:4x–18:5x；仓现值 HEAD `d435c59`
- 锚点：`zcode-bridge/outbox/20260925-154153-f127.result.md` outbox **查无此件** → `done/20260925-154153-f127.result.md`（12,203 B，遗留1 在 `:116-119`）取到；按 brief §3a 属路径搬家。
- 🔴 **红线自觉（班令第 6 条）**：人口是**经济平衡数值**的输入面（粮上限 / 派系诉求 / 国格门槛 / 评分卡 / 闲置劳力全部直读它）。本档**只出影响矩阵与两案材料**：**不选案、不改任何平衡值、不写迁移、不改业务码**。
- ⚠ 卷宗完成标准④要求"推荐"，班令红线要求"不选案" ⇒ **冲突已登记**（§7），本档按红线走，§6 给的是**条件式裁决前置**而不是一把尺子。

---

## 0. 结论速览

1. **锚点的五条 `people` 直读行号 5/5 全部原样在世**（`gameStore.ts:1203/:1240/:1626/:1649/:1749`）——这条锚点**没漂**。
2. 🔴 **但锚点的承重前提"无反向回写"已被磁盘否证**：现役有 **4 处 阶层→people 的回写**（`:2072`、`:2292`、`:2620-2621`、`:2796`），其中 `:2619-2621` 是**每天必跑**的无条件归一。⇒ 两源**不是"并存且互不理睬"，而是"每日由阶层侧单方面覆写 people"**。
3. ⇒ **事实权威已经在阶层侧**，`resources.people` 已是**每日一刷的缓存镜像**。探针 D2/D6 直接看到：注入 `people=100 / classes=40` ⇒ 次日两者同时变 `38`；注入 `people=500 / classes=10` ⇒ 次日 `people=8`，**492 口在一日之间凭空消失**，无日志、无事件播报、无 UI 回执。
4. ⇒ 因此**"两案"不是同一根轴上的两个选项**（这是本单最重要的形状发现）：**案① 治运行时、案② 治盘面**。锚点把它们并列成互斥二选一，会误导裁决——见 §5.4。
5. 🔴 **构造出一例真实回归**（D3）：`replaceState` 的**防软锁补足**（`:2890-2900`，把 `people` 抬到"在役建筑占用劳力"以解"一栋都建不了"的死局）**写在了被覆写的那一侧**——`people` 被抬到 4，而 `populationClasses` 仍是 2；次日 `:2621` 把 `people` 拉回 3 ⇒ **补足被静默撤销，软锁原样回来**。这是"两源并存"已经造成的**现役**代价，不是假想风险。
6. **盘路两侧都存、且无对账闸**（D4）：`serialize` 原样带走两个口径（`saveLoad.ts:312` 直传 `state.resources`、`:340` 一带直传 `populationClasses`），`deserialize` 也原样回读 ⇒ 不一致**可长期驻留磁盘**。前向兜底（people→阶层）**只在"阶层总和恰为 0 或键整个缺失"时触发**（`:610-612`）；D5 实测"真不一致"（Σ=10、people=50）**兜底不触发、不一致直接进内存**。
7. **UI 面已经会把矛盾直接摆给玩家**：同一个 `getPopulationStatus()`（`:2629`）同时返回 `total`（读 people）与 `classes`（读阶层），`PopulationPanel.ts:176` 渲染"总口：N 人"、`:199` 逐阶层渲染 ⇒ 两源背离时**同面板自相矛盾**；HUD 顶栏 `HUD.ts:552` 的"民 X/Y"也用 `total`。
8. 一处**假设已被本班自己否证**（记下来免得后人重踩）：曾疑"案① 的 getter 会被 `getState()` 的 `structuredClone`（`:457-459`）丢掉访问器 ⇒ 全 UI 读不到 people"。**实测不成立**——`structuredClone` 按值拷贝可枚举自有属性、**会调用 getter**（`node -e` 复算见 §5.2 末）。⇒ 该风险**不存在**，案① 的代价不在这里，而在 24 处读点与 `Partial<Record<…>>` 的数据形状。

---

## 1. 判据①：五处＋七处清单复核表

### 1.1 `resources.people` 直读——锚点点名的 5 处：5/5 行号原样在世

| # | 文件:行 | 现役代码（截断） | 语义 | 锚点判定 |
|---|---|---|---|---|
| 1 | `src/renderer/state/gameStore.ts:1203` | `const grainCap = Math.max(1, (this.state.resources['people'] ?? 20) * 5);` | 粮仓上限的**基数**（进 `NationStateInput.grainCapacityRatio`） | ✓ 在世 |
| 2 | `:1240` | `const population = this.state.resources['people'] ?? 0;` | `computeMetrics()` 的 `population` ⇒ 事件条件/权重口径 | ✓ 在世 |
| 3 | `:1626` | `population: this.state.resources['people'] ?? 0,` | `computeScoreCard()` 评分卡人口项 | ✓ 在世 |
| 4 | `:1649` | `const population = this.state.resources['people'] ?? 0;` | `buildGradeInput()` **国格门槛**（注释自述"与 computeMetrics 一致"） | ✓ 在世 |
| 5 | `:1749` | `const people = this.state.resources['people'] ?? 0;` | `runFactionTick()` 派系诉求的规模输入 | ✓ 在世 |

### 1.2 全量直读面（锚点未穷举的部分；本案真实改动面）

`grep -E "resources(\['people'\]|\.people)"` 非测试命中 **24 行**，除去 `def.cost.people`（建筑劳力造价，另一语义）与 2 行注释，**真读点 16 处**：

| 文件:行 | 用途 | 是否锚点已列 |
|---|---|---|
| `gameStore.ts:416` | 构造期 `peoplePassed`（前向兜底判据） | 否 |
| `:491` | `getIdleLabor()` = **people − employed**（盖房闸门） | 否 |
| `:2066` | `computeNoInterceptLoss` 入参 | 否 |
| `:2197` | `runBreathingTick` 的 `populationRatio` | 否 |
| `:2241` | `populationAtCap` 快照位 | 否 |
| `:2286` | 通牒爆发效果入参 | 否 |
| `:2453` | `evaluatePlayerStrength`（列国合纵） | 否 |
| `:2565` | `runPopulationTick` 的 `people`（增长的**被修改量**） | 否 |
| `:2607`/`:2609` | clamp 前后差值取实际增量 | 否 |
| `:2620` | 归一比对（读 people 与 classTotal 比） | 否 |
| `:2639` | **`getPopulationStatus().total`** ⇒ HUD＋人口面板 | 否 |
| `:2791` | 民变效果入参 | 否 |
| `:2898` | 软锁补足判据 | 否 |
| `militarySystem.ts:199` | `peopleLost`（不拦截战损） | 否 |

⇒ **案① 的真实调用面是"5 处锚点已列 ＋ 11 处未列"＝16 处读点**，锚点低估了 3 倍。这条直接影响两案代价估算。

### 1.3 `populationClasses` 直写——锚点说 7 处，现值 **11 处语句**（漂移 +4）

| # | 文件:行 | 写形 | 类别 |
|---|---|---|---|
| 1 | `gameStore.ts:418` | `= createDefaultPopulation(peoplePassed)` | 前向兜底（构造） |
| 2 | `:512` | `[from] -= count` | 转阶出项 |
| 3 | `:713` | `[src] -= transfer` | 缺粮/动员转移 |
| 4 | `:714` | `[targetCls] += transfer` | 同上入项 |
| 5 | `:2092` | `.soldier -= lost` | 战损（与 `:2093` people 侧**成对**） |
| 6 | `:2552` | `[cls] -= take`（`shrinkPopulationClasses` 体内） | 级联扣减**唯一出口**；4 个调用点 `:2071/:2291/:2615/:2795` |
| 7 | `:2612` | `.farmer += actual` | 增长全归农 |
| 8 | `:2663` | `[order.to] += order.count` | 转阶队列结算 |
| 9 | `:2700` | `= result.pop` | 饥荒（与 `:2701` people 侧**成对**） |
| 10 | `:2886` | `= createDefaultPopulation(people)` | 前向兜底（replaceState） |
| 11 | `saveLoad.ts:130` | `s['populationClasses'] = createDefaultPopulation(people)` | **migrations[1] 无条件覆写** |

另：`:361` 为初值字面量（`createDefaultPopulation(0)`）、`:270` 为类型声明，不计入写点。

### 1.4 🔴 锚点否证：反向回写**存在**，共 4 处（锚点称"无反向回写"）

| # | 文件:行 | 代码 | 触发频率 |
|---|---|---|---|
| 1 | `gameStore.ts:2072` | `setResourceClamped('people', totalPopulation(this.state.populationClasses))` | 不拦截战损后 |
| 2 | `:2292` | 同上 | 通牒爆发后 |
| 3 | **`:2620-2621`** | `if (classTotal !== people) setResourceClamped('people', classTotal);` | 🔴 **每日、无条件**（见 §2） |
| 4 | `:2796` | 同 1 | 民变后 |

⇒ 前向兜底也确实存在（`:418`、`:2886`、`saveLoad:610-612` 三处 ＋ `saveLoad:130` 迁移一处＝**4 处**，锚点记 3 处应是指前三）。
⇒ **真实结构是"双向都有写、但只有阶层→people 那侧有每日无条件闸"**，不是"单向兜底、无反向回写"。**锚点的这一句在本仓当前版本上不成立。**

---

## 2. 归一方向：谁覆盖谁（决定两案语义的根问题）

`runPopulationTick()`（`:2564-2623`）尾部：

```
2618: // B-0：同步 populationClasses 总和 → resources.people（防漂移）；经 setResourceClamped，不绕过 [0,9999]
2619: const classTotal = totalPopulation(this.state.populationClasses);
2620: if (classTotal !== (this.state.resources['people'] ?? 0)) {
2621:   this.setResourceClamped('people', classTotal);
2622: }
```

- 该函数注册在**每日流水线**的 `population` 阶段（`:972`），而 `runDayPipeline` 是 `for (const phase of phases) phase.run();`（`src/renderer/state/dayPipeline.ts:116-118`）——**无跳过、无早退**。
- ⇒ **每个 `tickDay()` 必执行一次 `people := classTotal`**。`resources.people` 的一切"独立取值"寿命**不超过一天**。
- 阶段顺序（`:961-984`）已核：`production(966) → … → events(969) → … → population(972) → conversion(973) → starvation(975) → …`。归一之后只有 `conversion`（阶层间搬动、**总和不变**）与 `starvation`（`:2700`＋`:2701` **两侧成对扣**）动过人口面 ⇒ **本班未发现日内阶段顺序造成的额外背离**；这条按"查过、没有"登记，不当卖点。
- 结论口径：**阶层侧是事实上的唯一权威；people 是每日一刷的镜像**。三处"people 独立写入"（`:2899` 软锁补足、任何 `addResource('people', …)` 不带阶层联动者）都会在该镜像上写、并在次日被权威抹平。

---

## 3. 判据②：不一致用例（可执行，实测读数）

复算件：`D:\code\tmp\qoder-executor-20260927-1850-colony41\population-dual-source-probe.mts`（**已按班令自清**，跑法见 §3.1）。
注入姿势＝`serialize → 改 blob → deserialize → store.replaceState`——即生产读档链路的同一形状。**全程内存，不落盘、不碰真存档目录。**
（不能用 `getState()` 就地改：`:457-459` 返回 `Object.freeze(structuredClone(this.state))`，实测直接赋型报 `TypeError: Cannot assign to read only property 'populationClasses'`。）

### 3.1 跑法

```
cd D:/code/colony-game
npx.cmd tsx ../tmp/qoder-executor-20260927-1850-colony41/population-dual-source-probe.mts      # rc=0
```
刻意**不走 vitest**：避开班令在册两坑（仓外 `vi.mock('phaser')` 不命中⇒`window is not defined`；仓外 config 引不到 `vitest/config`）。

### 3.2 D0 基线——不变式在正常玩法路径下成立

```
new GameStore(BALANCE.start)    people=20  classTotal=20  一致=Y  idleLabor=20  classes={"farmer":20,...}
tickDay() x5                    people=25  classTotal=25  一致=Y  idleLabor=25
```
⇒ **本案不是"游戏天天错"**。要证的是**它能从哪里被破**，破之后谁赢。

### 3.3 D1 同刻两读者两个答案（数据面风险本体）

```
inject people=100 / classes=40   people=100  classTotal=40  一致=N  idleLabor=100  employed=0
  读者A computeMetrics().population = 100   ← 直读 resources.people（:1240）
  读者B totalPopulation(classes)    = 40    ← 阶层口径（:2619）
  ⇒ "我有多少人口"当场有两个生效答案，差 60 人；两侧都无报错
```

### 3.4 D2 次日归一：阶层侧胜出

```
tickDay() 之后   people=38  classTotal=38  一致=Y
  ⇒ 注入的 100 被静默抹平为 38（38 而非 40：同日人口阶段自身还结算了 ±）
```

### 3.5 🔴 D3 真回归——防软锁补足写在了会被覆写的那一侧

```
replaceState 后（bld_farm 在役）  people=4  classTotal=2  一致=N  idleLabor=0  employed=4
  bld_farm.cost.people=4 ⇒ :2893-2899 把 people 从 2 抬到 4；实读 people=4 classTotal=2
再 tickDay() 一次                 people=3  classTotal=3  一致=Y  idleLabor=0  employed=4
  ⇒ :2621 把 people 拉回 classTotal=3，补足被撤销；idleLabor 仍 0（负值被 :491 的 Math.max(0,…) 吃掉）
```

机制钉死（源码原文）：

- `:2890` 注释自述场景——「旧档 people 曾被"建筑消耗 people"的老 bug 吃空，但建筑仍在、仍占编制。若 people < 已占用劳力，读档后闲置劳力恒为 0 → **一栋都建不了的硬软锁**。补足 people 到已占用量解死局。」
- `:2899` `if (curPeople < employed) newState.resources.people = employed;` —— **只抬 people，不抬阶层**。
- 次日 `:2621` 无条件 `people := classTotal` ⇒ **软锁原样回来**。

⇒ 该缺陷**现役、可由两段代码直接指出**，且**修法必须在两案之间先做选择**（抬阶层 vs 抬 people）——抬阶层＝给玩家补农民（改变经济与人口结果），触红线，**本单不开此药方**。

### 3.6 D6 终局症状：人数一日蒸发

```
inject people=500 / classes=10   people=500  classTotal=10  一致=N  idleLabor=500
tickDay() 之后                    people=8   classTotal=8   一致=Y  idleLabor=8
  ⇒ 492 人口在一日之间消失：无日志、无事件播报、无 UI 回执（:2621 只有赋值）
```

### 3.7 D4/D5 盘路：不一致可长期驻留，且兜底条件覆盖不到"真不一致"

```
D4  serialize 落盘  : resources.people=55 / populationClasses={"farmer":7,"worker":1,"soldier":1,"scholar":1}
    deserialize 回读: resources.people=55 / classTotal=10
    ⇒ 两侧都进盘、都回读，盘路无对账闸

D5  classes 全 0 + people=50          -> classes={"farmer":50} Σ=50 people=50  兜底触发/已一致
    classes Σ=10 + people=50（真不一致）-> classes 原样 Σ=10     people=50      兜底不触发，不一致直接进内存
    classes 键整个缺失 + people=50      -> classes={"farmer":50} Σ=50 people=50  兜底触发/已一致
    触发位：saveLoad.ts:610-612 —— if (Σ==0 && totalPeople > 0) result.farmer = totalPeople
```

⇒ **盘路只防"阶层全空"，不防"两边各说各话"**。而 D3 恰好证明：**产品代码自己**就能造出"两边各说各话"的内存态，并把它 `serialize` 回盘（`:2899` 抬完 people 后若立刻存档，落盘的就是不一致 blob）。

---

## 4. 两案逐条拆解（判据③的前置）

### 案① `people` 改为 `totalPopulation(populationClasses)` 派生 getter

| 项 | 内容 |
|---|---|
| 运行时改动面 | **16 处读点**（§1.2 全表）需改口径或删除；`getIdleLabor()`（`:491`）、`getPopulationStatus().total`（`:2639`）自然变派生 |
| 写入侧 | **7 处 people 写入**（`:2072/:2093/:2292/:2608/:2621/:2701/:2796`）里，`:2621` 归一闸**直接消失**（派生量无需归一）；`:2072/:2292/:2796` 三处"先 shrink 再同步 people"的**成对写**退化为只 shrink |
| 数据形状 | `resources: Partial<Record<ResourceId, number>>`（`gameStore.ts:196`）是**纯数据记录**，被 `addResource`/`setResourceClamped`（`:655-658`，内部 `this.state.resources[id] = …`）、`canAfford`、`getResourceCap`（`:639` 对 people 特判）直接索引。派生 ⇒ 要么给该键装访问器、要么把 people 从 resources 里**迁出** |
| ⚠ 已排查并**排除**的风险 | "访问器会被 `getState()` 的 `structuredClone`（`:457-459`）丢掉"——**实测不成立**：`Object.defineProperty(o,'people',{get(){return 42}})` 后 `Object.keys(structuredClone(o))` 含 `people`、值为 `42`；`JSON.stringify` 与 `{...o}` 同样调用 getter。⇒ **本案代价不在克隆面** |
| 存档 | 两种子形：(a) 继续写 people 到盘＝纯冗余、盘面不变、无需升版；(b) 不再写 people＝**serialize 面变更 ⇒ 需 `SAVE_SCHEMA_VERSION` 9→10 ＋ `migrations[9]`**（现值 9，见 `saveLoad.ts:19`；升版先例见 §5.3） |
| 触红线处 | **D3 的修法**：案① 下 `:2899` 无处安放，只能改成"抬阶层"⇒ 等于给玩家补农民＝改经济与人口结果 ⇒ **人工裁** |
| 回滚成本 | 中—高：读点分散，回滚要逐点还原；若已升 schema 版则**老档不可回读**（回滚成本从"改代码"升级为"改盘"） |

### 案② 存档只留一份、读档时派生另一份

| 项 | 内容 |
|---|---|
| 治什么 | **只治盘、不治运行时**。内存里 people 仍是可独立写的字段 ⇒ D1/D2/D6 类背离**依旧可构造**（虽然 D0 证正常玩法下不构造） |
| 存档兼容 | 老档两侧都在 ⇒ 读档时**取一侧、忽略另一侧**＝**零拒载**（比案①(b) 温和）。但"忽略哪一侧"本身就是裁决，且现役行为已经**偏向阶层优先**（`:610-612` 只在 Σ=0 时才用 people 反推） |
| 迁移 | 若"只留阶层"：`migrations[9]` 需在 v9→v10 时**删** `resources.people` 键，同时 `deserialize` 尾部补 `resources['people'] = totalPopulation(classes)`。⚠ 与 `:440-448` 的 `resources must be a record of finite numbers` 校验无冲突（派生发生在校验之后） |
| 与 c927-12 的耦合 | 🔴 **`saveLoad.ts:410-418` 的载荷字段拒载闸把 `rngSeed`/`eventHistory` 当"当版必存在"**。案② 若把 people 移出盘面，**必须同步决定它属不属于"载荷性字段"**——属，则低版档升上来缺 people 会在 `:410` 之外另长一道闸；不属，则要写明"派生量不入载荷清单"。本单不代裁，仅登记两单咬合点 |
| 调用面 | **零运行时改动**（案② 不改 16 处读点）⇒ 这是它相对案① 唯一明确的便宜 |
| D3 | **治不到**。`:2899` 是内存写、发生在 `replaceState` 里，与盘面留几份无关 ⇒ 案② 不修 D3 |
| 回滚成本 | 低—中：盘上多留一份无害；回滚只需让 `serialize` 重新写两键，老档仍可读 |

---

## 5. 判据③：两案影响矩阵

| 影响维度 | 案① 派生 getter | 案② 存档单份＋读档派生 |
|---|---|---|
| 消灭运行时背离 | ✅ 彻底（无独立可写位） | ❌ 不消灭（内存照写照漂） |
| 消灭盘路背离 | ⚠ 取决于子形 (a)/(b) | ✅ 彻底（盘上只有一份事实） |
| 修 D3 软锁回归 | ⚠ **逼着修、但怎么修＝改平衡值**（抬阶层） | ❌ 碰不到（纯内存写路径） |
| 修 D6 人数蒸发 | ✅ 结构上不可能（无镜像可抹） | ⚠ 仍在（`:2621` 照旧抹内存值） |
| 代码改动面 | **16 读点 ＋ 7 写点**，含 `resources` 类型形状 | `serialize`/`deserialize`/`migrations[9]` **3 处集中** |
| 是否需升 schema 版 | 子形 (b) 需 9→10；(a) 不需 | **需要**（否则"只留一份"无从表达） |
| 老档可读性 | 不升版则不变；升版须补 `migrations[9]` | ✅ 老档两侧都有 ⇒ 取一侧即可，零拒载 |
| 与 c927-12 拒载闸咬合 | 需裁"people 算不算载荷字段" | 同左，且**更尖锐**（案② 直接改变盘面字段集） |
| 测试面破坏 | `grep -c` 现值：引用 populationClasses/people 的测试件见 §5.1 | 同 §5.1，另加 `saveMatrix*.test.ts`／`saveV9Fixture.test.ts`／`migrationGapMessage.test.ts` 族 |
| 可观测性收益 | 高（口径唯一，读点无需记忆谁权威） | 中（盘唯一、内存仍二） |
| 失败模式 | 改坏一处派生 ⇒ 全库人口口径同时错 | 迁移写歪 ⇒ 老档人口被单侧覆写，且**已在盘上的档不可追损** |
| 回滚成本 | 中→**高**（一旦升版，回滚要连盘一起退） | 低→中 |

### 5.1 测试面锚（**只列数，不改**；供主班估工）

```
$ grep -rl "populationClasses" src --include=*.test.ts | wc -l                              -> 13
$ grep -rlE "resources(\['people'\]|\.people)" src --include=*.test.ts | wc -l               ->  6
$ grep -rlE "populationClasses|resources(\['people'\]|\.people)" src --include=*.test.ts | wc -l -> 16 个测试件
```
专族件（两案落地都绕不过）：`population.test.ts`／`populationClass.test.ts`／`saveMatrix.test.ts`／`saveMatrix.extend.test.ts`／`saveV9Fixture.test.ts`／`migrationGapMessage.test.ts`。

### 5.1b 现役闸全绿（现跑，证明 D1/D2/D6 是**潜伏**而非**现役红**）

```
$ cd D:/code/colony-game && npx.cmd vitest run \
    src/renderer/state/__tests__/population.test.ts \
    src/renderer/state/__tests__/populationClass.test.ts \
    src/renderer/state/__tests__/saveGuard.test.ts \
    src/renderer/state/__tests__/saveGuard2.test.ts
```
⇒ 读数（现跑 18:55:10）：`population.test.ts 18`／`populationClass.test.ts 21`／`saveGuard.test.ts 17`／`saveGuard2.test.ts 26` ＝ **4 files 82 passed，rc=0**。
⇒ **现役不变式由 `:2621` 每日归一撑住**，所以本单所有背离都是"注入即现形、玩法路径不自行现形"的形态——这既是 D3 可以被长期低估的原因，也是案① 边际收益被压扁的原因（§6 反对意见 1）。

### 5.2 ⚠ 已被本班否证的假设（防止后人重算）

"案① 的 getter 会在 `structuredClone` 处丢属性" —— **错**。`node -e` 实测：
```
原对象 keys: [ 'grain', 'people' ] people=42
structuredClone : [ 'grain', 'people' ] people=42
JSON.stringify   : {"grain":5,"people":42}
展开 {...o}      : {"grain":5,"people":42}
```
⇒ structuredClone **按值拷贝可枚举自有属性、会调用 getter**。案① 的真实代价在 16 个读点与 `Partial<Record<…>>` 形状，不在此。

### 5.3 升版的既有先例（案② 若落地要走的路）

`SAVE_SCHEMA_VERSION` 现值 **9**（`saveLoad.ts:19`）；1→9 共 7 次抬版，每次配一个 `migrations[N]`（`saveLoad.ts:125-196`），先例见 §c927-12 产物 §4 的考古表。**关键约束**：`migrations[9]` 一旦补上，`:410-418` 的拒载闸语义随之改变（c927-12 §2 已证：**迁移链是这两字段的默认值唯一负责人，而它现在不负责它们**）。

---

## 6. 判据④：本档给到什么、不给什么

🔴 **按班令红线：不选案。** 本节是**条件式裁决前置**，不是一把尺子；把它读成"推荐"即越线。

**若人工要择一，本案材料给出的三条前置判据（按决定性排序）：**

1. **先答"案① 和案② 是不是互斥"这个形状问题。** 本档 §0.4／§5 的证据是：**不互斥**——一个治运行时、一个治盘面。锚点把两者并列成二选一，是其**表述缺陷**。⇒ 若裁决者接受此形状，真选项集应是 `{只①, 只②, ①＋②, 都不做}` 而不是 `{①, ②}`。
2. **先单独处理 D3，不要等消歧。** D3（`:2899` 抬 people、`:2621` 次日抹平）是一例**现役软锁回归**，两案都不修它（案① 只是逼它现形）。它有一个**不触平衡值**的候选形：把 `:2899` 的补足目标从 people 改为**同步扩阶层**，或在 `replaceState` 末尾就地跑一次 `:2619-2621` 的反向口径——**但"给玩家补多少"就是经济数值** ⇒ **人工裁，本班不给数**。
3. **裁决前必须补的一次取证**：真存档目录 `D:/colony-game/user-data/saves` 的**盘路普查**——`schemaVersion` 分布、`people ≠ totalPopulation(classes)` 的份数、以及 `.bak` 侧车里有多少。
   - 本班按班令第 7 条**一律未碰该目录**。
   - 这个数**决定性**：若盘上背离份数＝0，案② 的收益主要在"防未来"，可缓；若显著 >0，则案② 变成数据抢救，优先级压过案①。
   - 本案全部读数来自内存构造与 `mkdtemp` 隔离目录，**不能替代该普查**。

**两案各自的最强反对意见（对称给出，不偏置）：**

- **对案① 的最强反对**：它把"每日一刷的镜像"升级成"编译期唯一"，代价是**动 16 个读点＋7 个写点＋一个 `Partial<Record<…>>` 的数据形状**，而 `:2621` 这道闸**已经在事实上交付了案① 的 95% 收益**（D0 基线不变式成立就是它的功劳）。⇒ 花大改动去买一个"已经每天在发生"的不变式，**边际收益是把"日内可背离窗口（最多一天）"清零**——而 §2 末已证：该窗口内没有任何阶段读点会撞上背离（conversion 不改总和、starvation 两侧成对）。⇒ 案① 买的是一个**当前无人能构造出来的窗口**。
- **对案② 的最强反对**：案② 的核心动作是"读档时忽略一侧、派生另一侧"，而**现役代码已经在读档时忽略 people 侧**（`:610-612` 只在阶层全空时反推，其余一律按盘上阶层走），且 `:2621` 在首个 tick 就把 people 抹平。⇒ **案② 的运行时结果与现状几乎逐位相同**，它真正改的只是"盘上少写一个键"。而少写这个键要付：`SAVE_SCHEMA_VERSION` 9→10、`migrations[9]`、与 c927-12 载荷字段闸的重新咬合、以及"老档不可追损"的失败模式。⇒ **付升版的代价买一个字节数收益**。

---

## 7. 冲突与否证登记（交主班）

| # | 出处 | 原文 | 磁盘实况 | 处置 |
|---|---|---|---|---|
| 1 | 锚点 f127 `:117-118` | "**无反向回写**" | `gameStore.ts:2072/:2292/:2620-2621/:2796` **4 处**，其中 1 处每日无条件 | 🔴 **否证**，据以重写本案前提 |
| 2 | 锚点 `:116` | people "5 处当人口直读" | 5 处行号 5/5 在世✓，但全量真读点 **16 处** | 不判失效，**改动面按 16 处估** |
| 3 | 锚点 `:117` | populationClasses "7 处直写" | 现值 **11 处语句**（＋4 处 `shrink` 调用点） | 漂移，按 11 处估 |
| 4 | 锚点 `:118` | people→阶层 单向兜底"3 处" | 3 处成立（`:418`/`:2886`/`saveLoad:610-612`），另 `migrations[1]`（`saveLoad:130`）为第 4 处 | 补列 |
| 5 | 锚点 `:118-119` | "两案"＝二选一 | 案① 治运行时／案② 治盘面，**不互斥**（§5、§6 前置 1） | 形状修正，真选项集是 4 元 |
| 6 | **卷宗完成标准④** | "推荐＋反对"／"推荐一案" | **班令第 6 条：不选案**（经济平衡数值红线） | 🔴 **冲突，按红线走**：本档只给条件式前置＋对称反对。若主班认为应按卷宗出推荐，请回令，本班可另附 |
| 7 | brief §5 表 | colony HEAD `102c65d`／porcelain 7 行 | 现值 `d435c59`／开工 4 行 | 以磁盘为准（§0） |
| 8 | 本班自测 | "案① getter 被 structuredClone 丢" | **不成立**（§5.2） | 自我否证，防后人重算 |

---

## 8. 零改动自证

- 产物＝本档 1 枚；`src/`／`scripts/`／`public/` **零改动**（`git status --porcelain -- src/ scripts/ public/` ＝ 0 行）。
- **未改任何平衡值**：`balanceConfig.ts`／`populationClass.ts`／`population.ts` 等数据档全程只读；本案所有数字（100/40/500/10/55/4/2 等）都是**探针注入的临时内存值**，无一写回产品。
- **未写迁移**：`migrations[9]` 只在 §4/§5 作为**待裁方案的描述**出现，未落一行码。
- **未跑全量 `npm test`**（并发窗，班令第 4 条）；本单取证全为内存探针＋`grep`/`awk`/`node -e` 只读命令。
- 未碰真存档目录 `D:/colony-game/user-data/saves`（班令第 7 条）；探针不落盘（连临时文件都不写）。
- 未还原/重建波次 18 移出的 `loadGate` 组；未改 `eventOrderingSnapshot.test.ts:295`。
- 临时件 `population-dual-source-probe.mts` 已自清（跑法留 §3.1 与本 result 证据节）。
