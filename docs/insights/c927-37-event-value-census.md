# c927-37 沙盒随机事件 value 域实测普查（值域分布表＋离群值清单）

- 工单：`c927-37`（cwd `D:\code\colony-game`，软预算 ≤30 分钟）
- 班次：`qoder-executor-20260927-2041-colony46`（只读裁决／普查班）
- 取证时点：2026-09-27 20:5x（`date` 连读 `Sun Sep 27 20:52:04 2026`）
- 仓现值：分支 `codex/architecture-hardening`，HEAD `ab09c23`；`git status --porcelain -- src/` ＝ **0 行**（在途脏件全在 docs 侧）⇒ 本文全部读数为工作树版＝HEAD 版
- **零产品码改动、零新增测试件、未跑任何测试**（兄弟班 `qoder-executor-20260927-2024-colony45` 同仓在跑）
- 锚点复核：`20260925-120439-1394.result.md`（`outbox/` 无此件，按 brief §3a 到 `done/` 取，**锚点在世且成立**）`:27` 原文「事件 random 触发的 value 范围校验未加（DSL 解析走 validateDslExpr 已覆盖 condition 面；value 语义宽，需产品口径后再收）」
- 🔴 **红线自觉**：本档只出**取值形态与分布**，不评"某个数值该不该这么大"（经济平衡＝人工闸）；所有"离群"一律指**形态离群**（该通道里的极值／孤值／零值／无值），不是"数值配错"
- 与在档单的关系：`c927-11`（`docs/insights/c927-11-event-value-caliber.md`）只裁了**触发概率**这一条通道 ⇒ 本单补其余四条通道，并把"全域界不可定"这件事数据化

---

## 0. 结论速览

1. **`random` 事件的 value 不是一个域，是**六条**互不可比的通道**（§1）：①触发概率 `triggers[].value`（48 处，域 `[0, 0.15]`）／②效果加值 `choices[].effects[].value`（`op:'add'`，146 处，域 `[-10, +15]`）／③效果乘子（`op:'mul'`，3 处，域 `[1.05, 1.1]`）／④超时天数 `defaultTimeoutDays`（46 处有值，域 `[1, 10]`）／⑤故事双轴 `storyAxisDelta`（70 处，**仅故事事件**，随机事件 0 处）／⑥**古迹旁路字段** `wrathDelta`/`moraleDelta`/`renownDelta`/`resources.*`（18×3 ＋ 12 处，域见 §2d —— 它在运行时才灌进 `value`，静态普查与静态门都够不到）。⇒ 任何"给 value 加上下界"的口径若不先按通道分域，**数学上就写不出来**（同名字段跨度 25 倍且含负）。
2. **门禁现状高度不齐**（§2e，这是给 c927-11 的最要紧一条数据面）：**通道②③有门**（`modifierValidator.ts:52` 对每个 `ModifierEffect.value` 判 `typeof/NaN` ⇒ NaN 抛错、**Infinity 可过**），**通道①零门**（`validateCourtEvent` 只 `validateDslExpr(t.condition)`，`dslCore.ts:189` 显式跳过 `'random'`，value 完全不看），**通道④⑤零门且类型可选**；**通道⑥（古迹旁路字段）连静态门都够不到（§2d）**。⇒ "加校验"在②③是**补洞**（无穷），在①是**从零建**，两者不是同一件事，别在同一条口径里拍。
3. **通道①实测：48 处注册、静态 47 处全在 `[0.04, 0.15]`，形态 100% 齐一（字面量、无缺省、无变量、无字符串）**；唯一形态离群＝`src/renderer/state/gameStore.ts:445` 的 `value: 0`（运行时合成的古迹链事件，语义是"不参与随机抽取、靠 `pendingEventId` 显式唤起"）。与 c927-11 的 47 处读数**逐值吻合**（本单独立复算，非引用）。
4. **通道②实测：`add` 值 146 处分布在 13 个 target 上，per-target 域相差一个数量级**——`country_diplomacy_weight` 域 `[-10, +15]`（最宽）／`country_morale` `[-5, +8]`／`country_grain_output` `[-4, +2]`（最窄的产出类）／`country_population_growth` `{3, 5}`。**零值（`value: 0`）在②③通道一条都没有** ⇒ c927-35 规格里"`add: 0` 是空写"这一分支在现役数据中无实例（登记为"防御性分支"而非"现存现象"）。
5. **通道④实测出两条新离群（c927-11 未覆盖）**：10 处 `defaultTimeoutDays: 1`（`eventsExpanded.ts:667-730` 的 `evt_c_*` 呼吸事件，**全部同时是"零效果"事件**）＋1 处 `defaultTimeoutDays: 10`（`:216`，全库最大）；另 `evt_locust`（`events.ts:13`）是**唯一"有 random 触发、无 choices、无 timeout"** 的事件 ⇒ 它走的是"无 choices 自动关"分支（c927-35 的口径对象）。
6. **11 处"随机触发但零效果"事件**（`evt_locust` ＋ 10 枚 `evt_c_*`）：这些事件的 value 域问题与效果域问题无关，任何按效果值收的口径**够不到它们** ⇒ 若要"每个随机事件必有可结算效果"，那是另一条产品口径（§6 遗留 3）。

---

## 1. 判据①：六条取值通道（定义＋消费点＋现状门）

| 通道 | 字段路径 | 消费点（实测） | 语义 | 现状门 |
|---|---|---|---|---|
| ① 触发概率 | `CourtEvent.triggers[].value` | `state/eventEngine.ts:85-89`：`const p = t.value ?? 0; if (metrics.rng() >= p) return false;`；`rng()` 值域 `[0,1)`（`state/rng.ts` mulberry32） | 每天掷一次，`rng() < p` 通过；多条 trigger 是 **AND** | 🔴 **零门**：`data/modifierValidator.ts:91-103` 只看 `condition`；`data/dslCore.ts:189` `if (expr === 'random') return;` 显式跳过 |
| ② 效果加值 | `choices[].effects[].value`（`op:'add'`） | `state/modifierAggregator.ts:61-69`：`(base + addSum) × mulProduct` | 与"基准值"相加；`base` 由调用点给（如 `applyModifiers(50,'country_morale',…)` `gameStore.ts:1241`、`applyModifiers(0,'country_military_power',…)` `:1245`） | 有：`modifierValidator.ts:52` NaN 抛；**Infinity／-Infinity 可过**（`:43-51` 注释自证在册） |
| ③ 效果乘子 | 同上（`op:'mul'`） | 同上：`mulProduct *= e.value` | 百分比因子（`1.05`＝＋5%）；与②**同名字段不同量纲** | 同② |
| ④ 超时天数 | `CourtEvent.defaultTimeoutDays` | `eventEngine` 的 `checkEventTimeout` 路径（未处理 N 天按 `choices[0]`；注释 `:9`） | 天（游戏内） | 🔴 零门；类型可选（`schema.ts:235` `defaultTimeoutDays?: number`） |
| ⑤ 故事双轴 | `choices[].storyAxisDelta` | `state/storyDriver.ts`（`clampAxis`） | 隐性双轴位移 | 🔴 零门；**随机事件面上 0 处**（只在 storyEvents） |
| ⑥ 古迹旁路 | `relicSystem.ts` 的 `wrathDelta`/`moraleDelta`/`renownDelta`/`resources.<id>` | `gameStore.ts:1321`（把 `renownDelta` 直接写成 `value`）＋ `adjustMorale/adjustWrath`（clamp 0..100） | 与①②同族但**字段名不同**；只在运行时进 `ModifierEffect.value` | 🔴 **静态门够不到**（详见 §2d） |

事件总盘（`data/events.ts:276` `export const EVENTS = [...BASE_EVENTS, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS]`）：

| 文件 | 顶层事件数 | 其中带 `random` 触发 | 说明 |
|---|---|---|---|
| `src/renderer/data/events.ts` | 8 | 7 | `evt_emissary`（`:26`）是唯一"无 random、靠 DSL 阈值触发"的静态事件（`country_morale > 60` ∧ `year >= 5`） |
| `src/renderer/data/eventsExpanded.ts` | 40 | 40 | 全部带 random |
| `src/renderer/data/storyEvents.ts` | 35 | 0 | 按章触发（`ACT`/章进度），**不属"随机事件"域** |
| `src/renderer/state/gameStore.ts:442-450`（运行时合成） | 逐 relic stage | 1 处注册（×N 次实例化） | `buildRelicEvents()`：`value: 0` 语义位 |
| 合计 | 83 静态 ＋ 合成链 | **47 静态 ＋ 1 注册位 ＝ 48** | 静态 random 事件覆盖率＝47/83 ≈ 56.6% |

---

## 2. 判据①（续）：值域分布表

### 2a. 通道①：触发概率分布（Σ=47 静态 ＋1 语义位）

```
value     0    0.04  0.05  0.06  0.07  0.08  0.09  0.10  0.12  0.15
静态处数   1*    1     6     8     7    12     2     8     2     1     ← Σ=47（*=gameStore 语义位，不在 47 内）
```

- min／max（静态 47）＝ **0.04 ／ 0.15**；众数 **0.08**（12 处）；无缺省值、无字符串、无表达式（48/48 全为 `{ condition: 'random', value: <字面量> }` 单行形态）。
- 分布形状：全部落在 `[0.04, 0.15]` 的窄带内，**没有一条 ≥ 0.2**；期望节拍＝`1/p` 天（0.15≈6.7 天/次、0.04≈25 天/次），本单不评这个节拍合不合理（人工闸）。
- 测试夹具面（不进启动门）：`value: 0.5` ×4、`value: 1` ×1、**无 `value` 键** ×1（`state/__tests__/eventEngine.test.ts:65`）⇒ `undefined → ?? 0` 的分支在测试面有覆盖，在静态数据面 0 覆盖。

### 2b. 通道②③：效果值 per-target 分布（**仅随机事件**，n(add)=146 / n(mul)=3）

| target | n(add) | min | max | 实测取值集 | 极值位置（file:line） |
|---|---|---|---|---|---|
| `country_morale` | 46 | −5 | +8 | {−5,−4,−3,−2,1,2,3,5,6,8} | `eventsExpanded.ts:110`、`:201`、`:357`、`:526` |
| `country_gold_output` | 27 | −4 | +5 | {−4,−3,−2,−1,1,2,3,5} | `eventsExpanded.ts:87`、`:323` |
| `country_renown` | 26 | −8 | +8 | {−8,−5,−3,−2,2,3,4,5,6,8} | `events.ts:158`、`eventsExpanded.ts:88` |
| `country_diplomacy_weight` | 12 | **−10** | **+15** | {−10,−8,−5,−3,5,6,10,15} | `eventsExpanded.ts:46`、`:525`、`:547` |
| `country_grain_output` | 11（另 1 处 mul 同 target） | −4 | +2 | {−4,−3,−2,−1,1,2} ＋ mul 1.05（`events.ts:123`） | `eventsExpanded.ts:242`、`:436`、`:480` |
| `country_military_power` | 7 | −2 | +10 | {−2,3,5,7,8,10} | `events.ts:219`、`:230` |
| `country_bronze_output` | 7 | −1 | +4 | {−1,1,2,4} | `events.ts:267`、`eventsExpanded.ts:151`、`:356` |
| `country_cloth_output` | 4 | −2 | +2 | {−2,−1,1,2} | `eventsExpanded.ts:415`、`:468` |
| `country_wood_output` | 3 | −1 | +2 | {−1,2} | `events.ts:264`、`eventsExpanded.ts:366`、`:501` |
| `country_population_growth` | 2 | +3 | +5 | {3,5} | `eventsExpanded.ts:119`、`:514` |
| `country_stone_output` | 1 | +1 | +1 | {1} | `eventsExpanded.ts:458` |
| `country_research_speed` | 0（1 mul） | — | — | mul {1.1} | `events.ts:184` |
| `population_class_growth_nong` | 0（1 mul） | — | — | mul {1.05} | `events.ts:229` |

- **add 全域**：`[−10, +15]`，17 个不同取值，**60 处为负**、**0 处为零**、0 处非整数。
- **mul 全域**：`{1.05, 1.1}`，3 处全在 `events.ts`（`:123`、`:184`、`:229`）；`eventsExpanded.ts` 的 40 枚事件 **mul 零使用** ⇒ 乘子只活在早期 8 枚事件里，是**通道内的形态断层**。
- **对照面（非随机，仅供口径参照）**：`storyEvents.ts` 的 add 域 `[−4, +20]`、mul `{1.1, 1.12}`（8 处）、timeout `{7,12,14}`、`storyAxisDelta` 70 处；`decrees.ts` add 域 `[−8, +15]` 且 mul 域 `[1.05, 1.2]`（22 处）、`policies.ts` add 域 `[1, 25]`、mul 域 `[1.1, 1.4]`（31 处）⇒ **同一个 `value` 字段在全仓至少四种量纲里复用**（万分比／整数点／倍率／天）。

### 2c. 通道④：`defaultTimeoutDays` 分布（随机事件 47 枚，有值 46）

| 值 | 处数 | 位置（`random` 触发行号即事件首行附近，逐枚可复算） | 备注 |
|---|---|---|---|
| 1 | **10** | `eventsExpanded.ts:667/674/681/688/695/702/709/716/723/730` | 全是 `evt_c_*` 呼吸事件，且**同时零效果** |
| 3 | 2 | `eventsExpanded.ts`（`evt_b_granary_fire`、`evt_b_eclipse`） | — |
| 4 | 6 | `eventsExpanded.ts`（`evt_b_merchant_caravan`/`_mine_collapse`/`_refugee_influx`/`_spy_caught`/`_deserters`/`_strange_beast`） | — |
| 5 | 17 | `events.ts`（`evt_drought_grain:65`、`evt_bandit_raid:205`）＋ `eventsExpanded.ts` 15 枚 | **众数** |
| 6 | 4 | `events.ts:100`、`:240` ＋ `eventsExpanded.ts:98`、`:544` | — |
| 7 | 5 | `events.ts:170` ＋ `eventsExpanded.ts:57`、`:139`、`:262`、`:344` | — |
| 8 | 1 | `events.ts:134`（`evt_neighbor_starve`） | — |
| **10** | 1 | `eventsExpanded.ts:216`（`evt_a_heir_dispute`） | 全库最大 |
| 缺省（无该键） | 1 | `events.ts:10-24`（`evt_locust`） | 🔴 唯一"有 random、无 choices、无 timeout"的事件 |

（合计 10＋2＋6＋17＋4＋5＋1＋1＋1 ＝ 47 枚随机事件 ✓）

### 2d. 通道⑥（普查中新增，1394/11 均未登记）：随机事件的**旁路 value 字段**

古迹链事件（唯一"注册了 random 触发但 `value: 0`"的那族）**不走 `ModifierEffect.value`**：其数值定义在 `src/renderer/state/relicSystem.ts` 的 `RELIC_CHAINS`（`:42`，3 条链／10 个 stage（`title:` 10 处）／18 枚 choice），字段名是另一套：

| 旁路字段 | n | min | max | 实测取值集 | 流向 |
|---|---|---|---|---|---|
| `wrathDelta` | 18 | −8 | +6 | {−8,−6,−4,−3,0,2,3,4,5,6} | `adjustWrath`（clamp 0..100，`gameStore.ts:1456-1460`） |
| `moraleDelta` | 18 | 0 | +8 | {0,4,5,6,8} | `adjustMorale`（clamp 0..100，`:1465-1470`） |
| `renownDelta` | 18 | 0 | +8 | {0,2,4,5,6,8} | 🔴 **被塞进 `ModifierEffect.value`**：`gameStore.ts:1321` `effects: [{ target:'country_renown', op:'add', value: e.renownDelta }]` |
| `resources.<id>` | 12 | −10 | +15 | bronze{5,6,8,10}／gold{−10,15}／rite{2,3,6}／stone{12}／wood{−5} | 直接入库存（`resources` 侧另有 `getResourceCap` 夹取，`gameStore.ts:657`） |

⇒ 三点后果（都直接关系到"校验加在哪"）：

1. `renownDelta` 走的是**运行时合成** ⇒ `validateAllStaticData` 的启动门（`data/index.ts:33`）**扫不到它**，`modifierValidator.ts:52` 的 NaN 门也**扫不到它**（它只在运行时把值灌进 `value`）。若数据里写一个 `renownDelta: NaN`，现役所有门都放行。
2. `buildRelicEvents()`（`gameStore.ts:436-455`）把 relic choices 的 `effects` 写成**空数组**（`:448`）⇒ 这族事件在**通道②③上是零覆盖**，它的数值全在通道⑥。⇒ "随机事件效果值域"这句话若不含⑥，就漏掉整个古迹链。
3. 同类旁路还有 4 处在 `gameStore.ts` 内以**表达式**灌 `value`：`:1321 value: e.renownDelta`、`:1522 value: result.playerDeltas.renown`、`:1727 value: 3 + severity`、`:1846 value: reward.renown`、`:2049 value: r.renownGain`（外加 `:2350 value: 5` 一枚常量）⇒ **静态字面普查天然覆盖不到这些**，任何"按字面值定界"的口径对它们是空门。

### 2e. 门禁矩阵（现状，实测）

| 通道 | 类型层是否可缺省 | 启动门 | 消费点守卫 | 非有限值（NaN/Inf）后果 |
|---|---|---|---|---|
| ① 概率 | `schema.ts:207` `value?: number` ⇒ **可缺省** | **无** | `?? 0`（缺省→永不触发） | `NaN` ⇒ `rng() >= NaN` 恒 false ⇒ **每天必刷**（c927-11 §1c 已推，本单不重跑） |
| ②③ 效果 | `schema.ts:28` `value: number` 必填 | 有（NaN 抛） | 无 clamp（`modifierAggregator.ts:61-69`） | `Infinity` 能过门 ⇒ 到 `(base+add)×mul` 直接发散 |
| ④ 超时 | `schema.ts:235` 可选 | 无 | `checkEventTimeout` 路径 | 无界：`0`／负数／`1e9` 都进得来（本单**未**在运行时验证行为，见 §6 遗留 4） |
| ⑤ 双轴 | 可选 | 无 | `storyDriver.ts` 有 `clampAxis` | 消费点有夹取 ⇒ 与①②的"无守卫"不同形 |

---

## 3. 判据②：离群值清单（全部带 file:line；"离群"＝形态／位置／孤值，不判平衡）

| # | 通道 | 离群物 | 位置 | 为什么算离群 | 危害判定 |
|---|---|---|---|---|---|
| L1 | ① | `value: 0` | `src/renderer/state/gameStore.ts:445` | 全 48 处里唯一 0；且不在静态数组，是 `buildRelicEvents()` 运行时合成 | **现役合法例外**（c927-11 §0-2 已点名）：任何 `> 0` 下界会当场打死古迹链 |
| L2 | ① | `value: 0.04` | `src/renderer/data/eventsExpanded.ts:714`（`evt_c_shooting_star`） | 静态最小值，唯一一枚 < 0.05 | 无（形态合法）；但白名单口径会**误伤它** |
| L3 | ① | `value: 0.15` | `src/renderer/data/events.ts:13`（`evt_locust`） | 静态最大值，唯一一枚 ≥ 0.12 之上 | 同 L2（白名单口径误伤面 6 处，与 c927-11 §2 逐值一致） |
| L4 | ① | `value: 0.09` ×2 / `0.12` ×2 | `eventsExpanded.ts:487`、`:511`；`:432`、`:432`-adjacent 块 | 非众数档，落在 0.08/0.10 之间 | 仅白名单口径相关 |
| L5 | ② | `value: -10` ×2 | `eventsExpanded.ts:46`、`:525`（均 `country_diplomacy_weight`） | add 全域最小 | 与 target 基线相比是最大单笔回撤，但**属平衡判断＝人工闸**，本单只登记 |
| L6 | ② | `value: 15` | `eventsExpanded.ts:547`（`evt_b_hostage_exchange`，`country_diplomacy_weight`） | add 全域最大（正向） | 同 L5 |
| L7 | ② | 零值缺失 | 全 146 处无 `value: 0` | "空写"分支在数据面 0 实例 | 对 c927-35 规格有意义：那条"add 0＝空写"是**防御性**条款，不是现存现象 |
| L8 | ③ | mul 仅 3 处、且仅在 `events.ts:123/184/229` | 见左 | 40 枚扩展事件乘子零使用 ⇒ 通道断层 | 若口径要"mul 必带 target 白名单"，样本量只有 3，**统计上撑不起结论** |
| L9 | ④ | `defaultTimeoutDays: 1` ×10 | `eventsExpanded.ts:667-730`（`evt_c_*`） | 全库最小；且与"零效果"完全重合 | 1 天超时＝当日必按 `choices[0]`；与 c927-28（relic timeout）同族，本单不重开 |
| L10 | ④ | `defaultTimeoutDays: 10` | `eventsExpanded.ts:216`（`evt_a_heir_dispute`） | 全库最大 | 无 |
| L11 | ④ | **缺 `defaultTimeoutDays`** | `events.ts:10-24`（`evt_locust`） | 48 枚随机事件里唯一"random＋无 choices＋无 timeout" | 触发后走"无 choices 自动关"分支 ⇒ 正是 c927-35 的口径对象（本单补数据面） |
| L12 | ⑤ | `storyAxisDelta` 70 处 | `storyEvents.ts`（35 枚事件 ×2 choice） | 随机事件面上 **0 处** | 通道⑤与本案口径无交集，登记以免被误当成"事件 value" |
| L13 | 类型 | `triggers[].value` 可选 | `data/schema.ts:204-208` | 允许"忘了写"与"故意 0"不可区分 | c927-11 §3a 小问题 1，仍需人工拍 |
| L14 | 门 | `Infinity` 可过效果门 | `modifierValidator.ts:43-55` | 注释自称 "finite number"，判据只挡 NaN | 在册（注释自证），修它要连带两例测试红 ⇒ 另单 |
| L15 | ⑥ | relic 旁路字段 | `state/relicSystem.ts:52-105`（18 枚 choice 的 `wrathDelta/moraleDelta/renownDelta` ＋ 12 处 `resources`） | 与①②同族数值却**换了字段名**，且 `gameStore.ts:1321` 在运行时才把它写成 `value` | 🔴 **静态门与静态普查双盲区**：给 `renownDelta` 写 NaN，现役所有启动门放行（本单未实跑验证，见 §6 遗留 7） |

---

## 4. 给 c927-11 口径裁决补的数据面（三句可直接写进口径的话）

1. **"事件 value 域"这句话本身不成立**：48 枚随机事件身上的 `value` 至少分五种量纲（概率 `[0,0.15]`／整数点 `[-10,15]`／倍率 `{1.05,1.1}`／天 `[1,10]`／轴位移），且 `country_diplomacy_weight` 与 `country_grain_output` 同为 `op:'add'` 却域差 5 倍 ⇒ **口径必须写成"按通道×target 分域"，不能写成"value ∈ [a,b]"**；否则要么形同虚设，要么误伤现役。
2. **通道①的零误伤面已两次独立复算吻合**（本单与 c927-11 各自从磁盘现取，均得"静态 47 处全在 `[0.04,0.15]`＋唯一 `value: 0` 在 `gameStore.ts:445`"）⇒ 采"有限数 ∧ `0 ≤ p ≤ 1` 且加在启动面 `validateCourtEvent`"对现役数据零波及、对古迹链零波及，这条**可以收口**；剩下要拍的仍是 c927-11 §3a 的两问（`0` 的语义、`1` 是否允许进静态）。
3. **真正的新增风险在"门不齐"**：效果通道已有 NaN 门（缺无穷），概率通道全无门，超时通道全无门。若只按 c927-11 单点收概率，仓里会长期留着"④⑤无门＋②③半门＋①有门"的三态；建议口径落成**一张四通道门禁表**（本单 §2e 即初稿），一次把"每通道要不要门、门在哪、NaN/Inf 怎么办"三列填满。

---

## 5. 判据③：零码改动自证 ＋ 取证命令

```
$ git status --porcelain -- src/ | wc -l
0                                    # 判据：src 零改动（工作树＝HEAD）
$ grep -rn "condition: 'random'" src/ --include=*.ts | grep -v __tests__ | awk -F: '{print $1}' | sort | uniq -c
      7 src/renderer/data/events.ts
     40 src/renderer/data/eventsExpanded.ts
      1 src/renderer/state/gameStore.ts     # Σ=48 注册位
$ grep -rhoE "condition: 'random', value: [0-9.]+" src/renderer/data/events.ts src/renderer/data/eventsExpanded.ts src/renderer/state/gameStore.ts | grep -oE "[0-9.]+$" | sort -g | uniq -c
      1 0 / 1 0.04 / 6 0.05 / 8 0.06 / 7 0.07 / 12 0.08 / 2 0.09 / 8 0.10 / 2 0.12 / 1 0.15   # Σ=48（含 gameStore 的 0）
$ grep -rn --include=*.ts "condition: 'random', value: \(0\|0.5\|1\)[,} ]" src
src/renderer/state/gameStore.ts:445:          triggers: [{ condition: 'random', value: 0 }],
src/renderer/state/__tests__/eventEngine.test.ts:53/59/71 value: 0.5 ; :85 value: 1
src/renderer/state/__tests__/eventTempo.test.ts:145 value: 0.5      # 极值全在语义位与测试夹具，静态数据无 0.5/1
$ python 解析（按 4 空格缩进的顶层 `id:` 切事件块）→ 见本文 §2b/§2c/附录表：
  static events = 83 | random-bearing = 47 | events.ts 8(7) / eventsExpanded 40(40) / storyEvents 35(0)
  add: n=146 min=-10 max=15 uniq=17 neg=60 zero=0 noninteger=0
  mul: n=3 values={1.05,1.1} lines=events.ts:123,184,229
  defaultTimeoutDays: n=46 min=1 max=10 uniq=[1,3,4,5,6,7,8,10]；缺省 1 枚（evt_locust）
  零效果随机事件 11 枚：evt_locust + evt_c_{good_weather,minor_quake,auspicious_cloud,wolf_sighting,
                       folk_song,well_dried,baby_boom,shooting_star,heavy_snow,wild_bloom}
$ grep -n "value: -10\|value: 15 }" src/renderer/data/eventsExpanded.ts
46:…country_diplomacy_weight', op: 'add', value: -10 }
525:…country_diplomacy_weight', op: 'add', value: -10 }]
547:…country_diplomacy_weight', op: 'add', value: 15 }]
$ grep -c "defaultTimeoutDays: 1," src/renderer/data/eventsExpanded.ts; grep -n "defaultTimeoutDays: 10" src/renderer/data/eventsExpanded.ts
10
216:    defaultTimeoutDays: 10,
$ sed -n '52,55p;91,110p' src/renderer/data/modifierValidator.ts
  if (typeof e.value !== 'number' || Number.isNaN(e.value)) { throw … }   # 效果通道：挡 NaN
  validateCourtEvent: 只 validateDslExpr(t.condition) ＋ choices[].effects 逐条   # 概率通道：不看 value
$ sed -n '189p' src/renderer/data/dslCore.ts
  if (expr === 'random') return;          # 显式跳过 ⇒ 概率 value 完全无门
$ sed -n '85,89p' src/renderer/state/eventEngine.ts
  if (t.condition === 'random') { const p = t.value ?? 0; if (metrics.rng() >= p) return false; }
$ sed -n '38,69p' src/renderer/state/modifierAggregator.ts
  addSum += e.value / mulProduct *= e.value … return (base + b.addSum) * b.mulProduct;   # 无 clamp
$ grep -n "export const EVENTS" src/renderer/data/events.ts
276:export const EVENTS: CourtEvent[] = [...BASE_EVENTS, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS];
```

未跑 type-check、未跑任何 vitest（并发窗：兄弟班 colony45 同仓在跑；本单判据是纯静态分布，不含运行时读数）。**未修改任何数据文件**（`data/`、`state/` 全零写）。

中间件（可复算，收班自清）：`tmp/qoder-executor-20260927-2041-colony46/per_event.txt`、`tmp/qoder-executor-20260927-2041-colony46/table.md`（`tmp/` 命中 `.gitignore:25`）。

---

## 6. 遗留问题（交主班／人工）

1. **通道④（超时天数）无任何门禁**：类型可选、`0`/负数/`1e9` 都进得来。本单只登记分布，**未在运行时验证 `timeout: 0` 或负数会怎样**（要跑得动 dayPipeline 时钟）⇒ 若口径要收这条，需另开单，且注意"加性能／时序判据必须同时给 timeout 形状"（`vitest.config.ts` 无 `testTimeout`，默认 5e3）。
2. **通道②③是否要设界属平衡裁决**：`add` 域 `[-10,15]`、`mul` 域 `{1.05,1.1}` 要不要卡界＝经济平衡数值口径 ⇒ **红线**，本单不出建议，只出分布。
3. **11 枚"随机触发但零效果"事件**要不要"每个随机事件必有可结算效果"属产品口径（它们当前只刷一条朝议消息／Toast）⇒ 交人工。
4. **c927-11 §1c 的 NaN 恒触发**本单**未重跑**（属行为读数，需运行时）；本文 §2d 那行是按 `rng() ∈ [0,1)` 与一句比较的语义推得，与 c927-11 同法，采方案前须实跑复核。
5. `mul` 在随机事件面仅 3 处样本（且集中在 `events.ts` 早期 8 枚），`eventsExpanded.ts` 40 枚零使用 ⇒ 若口径想给 mul 定专门规则，**样本撑不起**；建议口径按"op 形态"而不是"历史使用率"写。
7. **通道⑥的"NaN 直通"未实跑**：§2d/§3-L15 的结论（`renownDelta: NaN` 能过所有启动门）是按"静态门只扫 `data/index.ts` 的四个数组、relic 值在运行时才进 `value`"两条读码推得的 ⇒ 采口径前须实跑一次（属行为读数，并发窗不跑）。旧文档亦未登记这一族，`gameStore.ts:447-449` 的 relic choices 是 `effects: []`（零效果）。
6. **对照面未穷举**：本单的 per-target 域只统计随机事件（`events.ts` ＋ `eventsExpanded.ts`），`policies.ts`／`decrees.ts`／`storyEvents.ts` 只在 §2b 末给了汇总域作参照；若口径要覆盖"全仓所有 ModifierEffect"，需再一枚普查单（预计 4 文件 300＋ 处）。

---

## 附录 A．判据①全量覆盖表：47 枚静态随机事件逐枚取值（逐行可复算）

列义：`事件 id` | `tags` | `random value` @行号（`—`＝该事件无 random 触发）| `效果条数 add/mul` | `add 值域` | `mul 值` | `defaultTimeoutDays`。
文件归属：第一小节＝`src/renderer/data/events.ts`（8 枚），第二小节＝`src/renderer/data/eventsExpanded.ts`（40 枚）；行号均为**该文件内行号**。

| 事件 | tags | random | 效果 n(add/mul) | add 域 | mul | timeout |
|---|---|---|---|---|---|---|
<!-- src/renderer/data/events.ts -->
| `evt_locust` | 负 | 0.15 `:13` | 0/0 | 无 | — | — |
| `evt_emissary` | 抉择 | — | 3/0 | 2…10 | — | 7 |
| `evt_drought_grain` | 抉择,负 | 0.10 `:65` | 4/0 | -3…6 | — | 5 |
| `evt_river_flood` | 抉择,负 | 0.08 `:100` | 3/1 | -4…6 | 1.05 | 6 |
| `evt_neighbor_starve` | 抉择 | 0.06 `:134` | 6/0 | -3…8 | — | 8 |
| `evt_old_scholar` | 抉择,正 | 0.05 `:170` | 3/1 | 1…4 | 1.1 | 7 |
| `evt_bandit_raid` | 抉择,负 | 0.10 `:205` | 4/1 | -2…10 | 1.05 | 5 |
| `evt_artisan_offer` | 抉择,正 | 0.07 `:240` | 7/0 | -1…8 | — | 6 |
<!-- src/renderer/data/eventsExpanded.ts -->
| `evt_a_flood_relief` | 抉择,负 | 0.07 `:16` | 6/0 | -10…3 | — | 5 |
| `evt_a_foreign_envoy` | 抉择,正 | 0.07 `:57` | 6/0 | -8…5 | — | 7 |
| `evt_a_rebel_leader` | 抉择,负 | 0.06 `:98` | 6/0 | -5…3 | — | 6 |
| `evt_a_iron_technique` | 抉择,正 | 0.06 `:139` | 6/0 | -3…4 | — | 7 |
| `evt_a_heir_dispute` | 抉择 | 0.05 `:180` | 6/0 | -5…3 | — | 10 |
| `evt_a_drought_prayer` | 抉择,负 | 0.08 `:221` | 6/0 | -3…5 | — | 5 |
| `evt_a_scholar_sect` | 抉择,正 | 0.06 `:262` | 5/0 | -3…5 | — | 7 |
| `evt_a_general_defect` | 抉择,负 | 0.05 `:302` | 6/0 | -8…5 | — | 5 |
| `evt_bronze_vein` | 抉择 | 0.08 `:344` | 6/0 | -5…10 | — | 7 |
| `evt_plague_cattle` | 抉择,负 | 0.10 `:385` | 6/0 | -3…3 | — | 5 |
| `evt_b_harvest_bumper` | 正 | 0.12 `:432` | 2/0 | 2…5 | — | 5 |
| `evt_b_merchant_caravan` | 正 | 0.10 `:443` | 2/0 | 3…3 | — | 4 |
| `evt_b_mine_collapse` | 负 | 0.08 `:454` | 4/0 | -2…3 | — | 4 |
| `evt_b_silk_demand` | 正 | 0.10 `:465` | 2/0 | 2…2 | — | 5 |
| `evt_b_granary_fire` | 负 | 0.07 `:476` | 3/0 | -4…2 | — | 3 |
| `evt_b_tax_dispute` | 抉择 | 0.09 `:487` | 3/0 | -3…5 | — | 5 |
| `evt_b_trade_route` | 正 | 0.08 `:498` | 4/0 | -2…3 | — | 5 |
| `evt_b_refugee_influx` | 抉择 | 0.09 `:511` | 3/0 | -3…5 | — | 4 |
| `evt_b_tribute_demand` | 负 | 0.08 `:522` | 4/0 | -10…5 | — | 5 |
| `evt_b_border_skirmish` | 负 | 0.10 `:533` | 4/0 | -5…5 | — | 5 |
| `evt_b_hostage_exchange` | 抉择 | 0.06 `:544` | 2/0 | 2…15 | — | 6 |
| `evt_b_spy_caught` | 负 | 0.07 `:555` | 4/0 | -5…5 | — | 4 |
| `evt_b_talent_exam` | 正 | 0.08 `:568` | 3/0 | 1…3 | — | 5 |
| `evt_b_festival` | 正 | 0.10 `:579` | 3/0 | -2…8 | — | 5 |
| `evt_b_road_repair` | 抉择 | 0.08 `:590` | 3/0 | -3…2 | — | 5 |
| `evt_b_corruption` | 负 | 0.07 `:601` | 3/0 | 2…5 | — | 5 |
| `evt_b_deserters` | 负 | 0.08 `:614` | 3/0 | -2…3 | — | 4 |
| `evt_b_weapon_cache` | 正 | 0.06 `:625` | 2/0 | 2…5 | — | 5 |
| `evt_b_eclipse` | 抉择 | 0.05 `:638` | 3/0 | -1…5 | — | 3 |
| `evt_b_strange_beast` | 抉择 | 0.05 `:649` | 3/0 | -2…5 | — | 4 |
| `evt_c_good_weather` | 正 | 0.12 `:665` | 0/0 | 无 | — | 1 |
| `evt_c_minor_quake` | 负 | 0.05 `:672` | 0/0 | 无 | — | 1 |
| `evt_c_auspicious_cloud` | 正 | 0.06 `:679` | 0/0 | 无 | — | 1 |
| `evt_c_wolf_sighting` | 负 | 0.07 `:686` | 0/0 | 无 | — | 1 |
| `evt_c_folk_song` | 正 | 0.08 `:693` | 0/0 | 无 | — | 1 |
| `evt_c_well_dried` | 负 | 0.06 `:700` | 0/0 | 无 | — | 1 |
| `evt_c_baby_boom` | 正 | 0.08 `:707` | 0/0 | 无 | — | 1 |
| `evt_c_shooting_star` | 正 | 0.04 `:714` | 0/0 | 无 | — | 1 |
| `evt_c_heavy_snow` | 负 | 0.10 `:721` | 0/0 | 无 | — | 1 |
| `evt_c_wild_bloom` | 正 | 0.08 `:728` | 0/0 | 无 | — | 1 |

外加运行时合成位（不在静态数组内）：

| `relic_<siteId>_s<i>` | 抉择 | 0 `state/gameStore.ts:445` | **0/0**（`buildRelicEvents()` 的 choices 写死 `effects: []`，`gameStore.ts:447-449`） | 无 | — | 无（古迹链走 relicSystem 自己的结算路，见 §2d 通道⑥） |

=> Σ 覆盖：8（events.ts，含 1 枚无 random）＋40（eventsExpanded.ts）＋1（合成注册位）= **49 行**，对应 48 个 random 注册位（`evt_emissary` 无 random，故随机事件 47 静态＋1 语义位）。
