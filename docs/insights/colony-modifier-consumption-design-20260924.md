# colony 修饰键零消费处置设计稿（12 键 · 案 A/B 并列，只出稿不改码）

> **班次**：`qoder-executor-20260924-0955-colony17`（zcode-bridge 执行班 · **只读位**）· 取数时刻 2026-09-24T12:08+08:00
> **被测 HEAD**：`c48413a`（`git log --oneline -1` 现取）
> **红线声明**：本案命中**经济平衡数值域**（修饰符 target ＝ 国策/朝令/季节/阶层的数值出口）。按纪律档 §五.3，
> 本班**只出只读报告**：**零 value 读取入稿、零数据表改动、零生产码改动**。两案并列、不拍板，
> 处置选择交主班 → 待人工台账。**本文件是本单唯一入库产物。**
> **上游**：`docs/insights/colony-modifier-zeroconsumer-census-20260923.md`（c923-06 普查）＋ 门禁件
> `src/renderer/state/__tests__/modifierReadPortGate.test.ts`（c924-09 案 B）。

---

## 〇、结论先行

1. **12 键的定性从"发现死键"升级为"门禁已就位、缺的是数值语义裁决"**。c923-06 之后本仓**新增了一道机读门禁**
   （`modifierReadPortGate.test.ts`，5 例，现全绿），把"注册表 27 键 ＝ 15 有读取口 ＋ 12 白名单例外"钉成可执行断言，
   并显式声明案 A 未授权。**⇒ 卷宗给的钉子清单（只列 `storyEffectsTargets.test.ts:92/:269-270`）已经不完整**，
   见第六节否证 ①。这道门禁是本设计稿全部"必红测试"的**主要来源**。

2. **7 键静默失效里，有 3 枚是引擎自己每回合生产的死状态**，不只是"数据表白填了数"：
   `seasonSystem.ts:59`（冬季注入 `country_diplomacy_weight` ×1.3）、`gameStore.ts:1783`（阶层博弈注入
   `country_research_speed`）、`gameStore.ts:2335`（民心颂声注入 `population_happiness` +5）。
   三处都有**活着的写入方**、**零读取方** ⇒ 修饰符每回合进 `activeModifiers`、进存档、进 UI 文案，然后被丢弃。
   最重的一枚是**民心颂声整条机制空转**（详见 §三.5）。

3. **退役那 5 枚键不是"删 5 行"，是"删一处、红五处、且埋一颗存档雷"**：
   除 `resourceRegistry.ts` 5 行注册，还**必须同批**改 `modifierDescriber.ts` 的 `TARGET_LABEL`
   （否则 `npm run type-check` 报 **TS2353**，已沙盒实测）＋ 摘 `NO_READER_WHITELIST` 5 条
   （否则门禁 ③⑤ 红）＋ 改 `storyEffectsTargets.test.ts:271-274` 的反向钉子 ＋ 改门禁件 :266-269 的计数与标题。
   **存档雷**：`GameStore.replaceState` 对每条 `activeModifier` 跑 `validateModifierInstance` 且**抛异常**，
   该判据最终落到 `isValidModifierTarget` ⇒ **退役后旧存档若带这些 target 就是载入即崩，不是静默忽略**。
   沙盒反证已实测（§四.2）。今日 5 键数据面 0 行 ⇒ 无已知活载体，属**潜伏**风险而非现前风险，
   但这道闸门是"硬抛"不是"忽略"，**这是退役案最大的不确定项，必须人工点头**。

4. **两案的"注释案"其实已经做了一半**：c923-06 遗留 3 抱怨"注册行无预留注释、盘上不可区分预留与死注册"。
   现值：**门禁件的 `NO_READER_WHITELIST` 每键都带了逐键来历注释**（如 `building_upkeep` → "建筑维护结算走
   `consumptionTargetFor` 的 grain 专用路径，不读此键"，该说法本班已独立复核为**真**，见 §四.1），
   而 `resourceRegistry.ts:58-98` 本体**仍无注释**（仅 `country_renown`/`building_output_area` 两行带 J-3 来历）。
   ⇒ 注释案的成本＝**把门禁件已有的注释搬一份到注册表行尾**，近零风险。

---

## 一、实测现状：12 键普查（本班独立重跑，非抄上游）

口径：数据面 ＝ 各表 `target: '<键>'` 字面量出现**次数**（python `re.findall` 定长串，不用字符类正则，
规避纪律档 §十三 camelCase 漏计坑）。注册表 ＝ `resourceRegistry.ts:58-98` 的 `MODIFIER_TARGETS`。

**现值复核**：`MODIFIER_TARGETS` **27 键**；五表 `target:` 行合计 **411**（69+56+134+33+119）；
数据面并集 **22 键**；`注册表 − 并集` **恰等于 5 键**（下表 B 组）；`并集 − 注册表` **空集**。
四数与 c923-06 在 `c7171e9` 上的读数**逐项相同、零漂移**。

### A 组：7 枚「有数据、无运行时读取」（案 A 对象）

| # | 键 | 中文标签 | policies | decrees | storyEvents | events | eventsExpanded | 合计 | 引擎内是否有活写入方 |
|---|---|---|--:|--:|--:|--:|--:|--:|---|
| 1 | `country_diplomacy_weight` | 邦交分量 | 10 | 7 | 6 | 3 | 10 | **36** | ✅ `seasonSystem.ts:59`（冬 ×1.3） |
| 2 | `country_research_speed` | 学问进展 | 5 | 2 | 8 | 1 | 0 | **16** | ✅ `gameStore.ts:1783`（阶层博弈） |
| 3 | `event_positive_probability` | 吉事概率 | 3 | 2 | 0 | 0 | 0 | **5** | ❌ 仅数据表 |
| 4 | `population_class_growth_shi` | 士人增长 | 3 | 1 | 0 | 0 | 0 | **4** | ❌ 仅数据表 |
| 5 | `population_happiness` | 民众安乐 | 1 | 2 | 0 | 0 | 0 | **3** | ✅ `gameStore.ts:2335`（民心颂声） |
| 6 | `population_class_growth_nong` | 农人增长 | 0 | 2 | 0 | 1 | 0 | **3** | ❌ 仅数据表 |
| 7 | `building_output_area` | 区域产出加成 | 0 | 1 | 0 | 0 | 0 | **1** | ❌ 仅数据表 |

合计 **68 行**已上架效果数据处于静默失效状态（36+16+5+4+3+3+1）。

### B 组：5 枚「注册了、四表一行不填」（案 B 对象）

| # | 键 | 中文标签 | 五表合计 | 门禁件逐键来历注释（现值） | 本班复核 |
|---|---|---|--:|---|---|
| 8 | `building_construction_cost` | 营建耗费 | **0** | 名已注册、数未填、线未接 | 成立 |
| 9 | `building_efficiency` | 建筑效率 | **0** | 同上 | 成立 |
| 10 | `building_upkeep` | 建筑维护 | **0** | 维护结算走 `consumptionTargetFor` 的 grain 专用路径，不读此键 | **成立**：该函数除 `grain → country_grain_consumption` 外一律 `return null`（`productionSystem.ts:50-54` 实读） |
| 11 | `population_class_growth_gong` | 工匠增长 | **0** | 数据 0 行 | 成立；⚠️ 与 A 组 shi/nong **同族而异命**（士/农有数据无读取口，工连数据都没有）⇒ 三兄弟不能同一处置 |
| 12 | `event_negative_probability` | 灾祸概率 | **0** | 所在机制整条不存在 | **成立**：全 `src/renderer` 非测试源里 `probability` 一词**只出现在** `resourceRegistry.ts:91/92` 与 `modifierDescriber.ts:44/45` 四处，`eventEngine.ts`/`storyDriver.ts` **零命中** ⇒ 无任何概率抽取机制可挂 |

**运行时读取面（案 A 的接入口现状）**：入口函数**只有 4 个**，全在 `state/modifierAggregator.ts`——
`aggregateModifiers:34` / `applyModifiers:61` / `getMulFactor:74` / `getAddDelta:88`。
非测试调用点 14 处（`gameStore.ts` 8 处、`productionSystem.ts` 6 处）＋ `productionSystem` 的
`outputTargetFor`/`consumptionTargetFor` 生产位 8 键 ⇒ 并集 **15 键有读取口**。
该"只有 4 个入口"本身也被门禁 ① 钉住（名字表 ⇄ 实现签名双向等式），**加第 5 个入口函数即红**。

---

## 二、既有门禁地图（处置前必读：三处钉子，卷宗只说了两处）

| 钉子 | 位置 | 判据 | A 案（接线）会红吗 | B 案（退役）会红吗 |
|---|---|---|---|---|
| N1 数据消费面并集 | `storyEffectsTargets.test.ts:262-269` | `union` 22 键逐名钉桩 | ❌ 不红（7 键本就在并集里） | ❌ 不红（并集不含被退役键） |
| **N2 未消费反向钉子** | `storyEffectsTargets.test.ts:270-274` | `unconsumed` **恰等 5 键清单** | ❌ 不红 | 🔴 **红**（退役后变 `[]`） |
| N3 "键在注册表"包含式 | `storyEffectsTargets.test.ts:92` | `for (t of used) expect(MODIFIER_TARGETS).toContain(t)` | ❌ 不红 | ❌ 不红（:92 只查**已用**键，5 键未被用）；⚠️ 但**若有人给退役键填数据**即红 |
| **N4 计数钉子** | `modifierReadPortGate.test.ts:267` | `REGISTRY.length` **toBe(27)** | ❌ 不红 | 🔴 **红**（变 22） |
| N5 读取口计数 | `modifierReadPortGate.test.ts:268` | `SORTED_READ.length` **toBe(15)** | 🔴 **红**（每接一键 +1） | ❌ 不红 |
| **N6 白名单条数** | `modifierReadPortGate.test.ts:248` | `WHITELIST.length` **toBe(12)** | 🔴 **红**（须摘牌） | 🔴 **红**（须摘牌 5 条） |
| **N7 白名单自锁** | `modifierReadPortGate.test.ts:251` | `IN_BOTH` 须 `[]`（白名单键不得已有读取口） | 🔴 **红**（接线键同时留在白名单＝登记表腐烂） | ❌ 不红 |
| N8 两面并集闭合 | `modifierReadPortGate.test.ts:253` | 读取口 ∪ 白名单 **== 注册表** | ❌ 同批改白名单即平 | 🔴 **红**（注册表缩而白名单未同步则集合不等） |
| N9 间接面闭合 | `modifierReadPortGate.test.ts:260-263` | `INDIRECT_FILES` 恰 `['state/productionSystem.ts']`；生产位解析 **8 键** | ⚠️ **可能红**：若接线采用"新文件动态传 target"或改 `outputTargetFor`/`consumptionTargetFor` 映射 ⇒ 红（见 §三.7） | ❌ 不红 |
| N10 类型穷举 | `modifierDescriber.ts:15` `TARGET_LABEL: Record<ModifierTargetKey, string>` | TS 字面量穷举 | ❌ 不红（标签 27 枚已在） | 🔴 **`npm run type-check` 红**：**TS2353** 沙盒实测（§四.2） |
| N11 载入闸门 | `gameStore.ts:2820-2830` `replaceState` → `validateModifierInstance` → `isValidModifierTarget` | 未知 target **抛异常** | ❌ 不红 | 🔴 **存档行为风险**（非测试红，是**载入即崩**） |

现值自证：`npx vitest run src/renderer/state/__tests__/modifierReadPortGate.test.ts src/renderer/data/__tests__/storyEffectsTargets.test.ts src/renderer/state/__tests__/modifierDescriber.test.ts` → **3 文件 / 37 例全绿**。

---

## 三、案 A：7 键接线方案（逐键 · 数值语义一律留人工）

> 三要素齐者方可开工：**消费点选点** ＋ **读取时机** ＋ **storyEffects 出口**。
> 🔴 本节**不给出任何 value 语义**（`op=add` 的 3 与 `op=mul` 的 1.3 各代表什么、是否叠加、是否钳制）
> ⇒ 那些是经济平衡数值裁决，按 §五.3 交人工。**下面只定"在哪读"，不定"读出来乘多少"**，两件事可分离。

统一模式（本仓既有先例）：`applyModifiers(base, '<key>', this.state.activeModifiers)`
—— 参照 `gameStore.ts:476`（人口上限）、`:1228`（民心）、`:1474`（`country_renown`，**最贴近的同类先例**：
同为"国家级总量"、同由 J-3 版本加键、已接通）。

| # | 键 | 建议消费点（file:line） | 读取时机 | storyEffects 出口 | 特有风险 |
|---|---|---|---|---|---|
| 1 | `country_diplomacy_weight` | `diplomacySystem.ts`（邦交作用力结算处）；`diplomacyExpanded.ts` 为第二消费候选 | 每次外交动作求解时（无回合副作用，可随时读） | 国策/朝令 effects 已 36 行，**接上即全部生效**，无需改数据 | ⚠️ 冬季季节修饰符也写这枚 ⇒ 接线瞬间**季节与政策两路同时激活**，平衡位移幅度是本组最大 |
| 2 | `country_research_speed` | 研究/学问进度累加处（`gameStore.ts:1782` 是该键的**写入方**，读取方需另点） | 每回合进度结算 | 同上，16 行数据 | 🔴 已有活写入方 ＝ **存档里已躺着历次 `country_research_speed` 实例**；接线会**改变既有存档载入后的推演结果**（可载入集合不变，但数值轨迹变），需人工确认是否要版本号抬升 |
| 3 | `event_positive_probability` | `eventEngine.ts` / `storyDriver.ts` 的抽取权重 | 抽事件前求权重 | 5 行数据 | 🔴 **语义未定**：与 B 组 `event_negative_probability` 是一对，**只接正向不接负向**会造成"吉事可变、凶事恒定"的半边机制。人工须同时定负向键的命运（⇒ 案 A 与案 B 在此键**耦合，不可各自拍板**） |
| 4 | `population_class_growth_shi` | `populationClassSystem.ts` 阶层增殖 | 每回合人口结算 | 4 行 | ⚠️ 与 nong/gong 三兄弟同族；接两弃一（gong 无数据）会留"家族不对称"，评审官易挑 |
| 5 | `population_happiness` | 候选：并入 `playerMorale`/`publicSentiment` 双轴，或另立第三轴 | 每回合民心结算 | 3 行 | 🔴🔴 **概念重名**：注册表**同时**有 `country_morale`（标签"民心"，`gameStore.ts:1228` **已真读**）与 `population_happiness`（标签"民众安乐"）。两键是否同一量？**若是 → 接线会双重计入**；若否 → 需人工先定义"安乐"与"民心"的分离语义。**本案最高不确定项**，见 §三.5 |
| 6 | `population_class_growth_nong` | 同 #4 | 每回合人口结算 | 3 行 | 同 #4 |
| 7 | `building_output_area` | `productionSystem.ts:182-192`/`:269-275` 的产出求解（相邻/区域加成应乘在此） | 每回合产出结算 | 1 行 | 🔴 **会动 N9**：若实现选择"扩 `outputTargetFor` 映射"而非"新增字面量调用点"，`PRODUCED_KEYS` 数从 8 变 ⇒ 门禁 ④ 红；且 `INDIRECT_FILES` 若引入新文件也红。**建议实现走"既有文件内字面量实参"，可完全避开 N9**（唯一需要为此改同批文件的键） |

### 三.5 `population_happiness` 的"整条机制空转"实证（本案最重单条）

`gameStore.ts:2328-2340`：当 `playerMorale >= PRAISE_MORALE_THRESHOLD` 时 `addModifier` 一枚
"民心颂声"（`descPlain: '民心鼎盛，百姓颂声载道。'`），其 **effects 数组只有一条**：
`{ target: 'population_happiness', op: 'add', value: 5 }`。而 `population_happiness` 在门禁白名单内＝**零读取方**。
⇒ **"民心鼎盛"这个玩家可见成就的全部数值后果 ＝ 0**。`publicSentiment.ts:4-5` 的模块自述
"民心高 = 颂声加成"因此是**文档级假陈述**。

这条不是"接线选点"问题，而是**已有子系统的主出口断了** ⇒ 建议人工优先裁决 #5，
因为它一旦定语义，`publicSentiment` / `PRAISE_MORALE_THRESHOLD` 整族的验证成本比"新接一键"低得多。

### 案 A 的同批改动清单与预期红名单（接第 k 键，k ∈ 7）

**同批必改（不改即红）**
1. `src/renderer/state/__tests__/modifierReadPortGate.test.ts` — 从 `NO_READER_WHITELIST`（声明 :43，12 条体 :44-55）
   **删掉该键那一行**；
   `:248` 的 `toBe(12)` 改为 12−1；`:268` 的 `toBe(15)` 改为 15+1；`:266` 用例**标题文本**（"注册表 27 键 ＝ 15 有读取口 ＋ 12 白名单例外"）同步改写。
2. 生产码：新增该键的读取口（1 处 `applyModifiers`/`getMulFactor` 调用，位置见上表）。

**同批建议改**
3. `src/renderer/data/resourceRegistry.ts` — 该键行尾注释由"待接线"改为消费点指针（保持盘上自描述）。
4. 若键属 #7 且实现扩了 `outputTargetFor`/`consumptionTargetFor` ⇒ 还要同批复核门禁 ④ 的 `toBe(8)`。

**预期红名单（接线后、改白名单前那一刻的集）**
`modifierReadPortGate.test.ts` 的 **③**（N6 条数 ＋ N7 `IN_BOTH` 非空，两断言同例）**＋ ⑤**（N5 计数）＝**恰 2 例红**，
其余 3 例应绿。
> 🔴 **判别性守卫**：若接线后 **②（N8 主门禁）也变红** ⇒ 说明读取口**没被门禁识别**（例如 target 实参写成了变量、
> 或新增文件未进 `INDIRECT_FILES` 解析路径）＝ **"看着接了其实没接"**。这条是本案最可能的假绿形态，务必盯。
> 若 ①（N 入口穷举）红 ⇒ 有人加了第 5 个入口函数，属越出本案范围的架构改动，停手回报。

**案 A 完全不会红的钉子**：N1/N2/N3/N4/N10（`storyEffectsTargets.test.ts` 全部 ＋ `type-check`）。
⇒ **案 A 的改动面比案 B 小得多**（案 B 要动 4 个文件＋埋存档雷），
"两案哪个更省事"的直觉是**反的**，请人工按此重排优先级。

---

## 四、案 B：5 键处置（补预留注释 vs 退役注册行，两案并列）

### 四.1 B-注释案（低风险，本班实测**零测试红**）

做法：`resourceRegistry.ts` 那 5 行行尾各加一句来历注释，文案沿用门禁件 `NO_READER_WHITELIST` 已写好的逐键注释
（§一 B 组表已逐条复核其为真）。**注册表键数不变（仍 27）、白名单不变、TARGET_LABEL 不变。**

- **必红测试**：**无**（纯注释）。
- **同批改动文件**：`src/renderer/data/resourceRegistry.ts` 1 件。
- 残余风险：**注释会腐烂**。门禁 ③（N7）已提供反腐烂机制（键被接线 ⇒ 红 ⇒ 强制摘牌），但**注释本身没有看守**。
  ⇒ 若走此案，建议同时在门禁件加一条"注释存在性"断言（读源文本查这 5 行行尾是否含标记串），
  否则一年后又是一次 c923-06 式普查。这一条属**新增门禁判据**，超出执行手授权，交人工。
- 附带收益：直接销掉 c923-06 遗留 3（"盘上不可区分预留与死注册"）。
- ⚠️ **定性诚实提示**：`event_negative_probability` 的"预留"说法**站不住**——该机制整条不存在（§一 B 组复核），
  称其为"预留位"是给死注册一个好名字。若走注释案，此键注释宜写"机制未实现"而非"预留"。

### 四.2 B-退役案（高风险，**实测**红四处 ＋ 存档雷）

做法：从 `MODIFIER_TARGETS` 删 5 行 ⇒ 27→22。

**同批必改清单（缺一即红/崩）**

| 序 | 文件 | 必改内容 | 不改的后果 |
|---|---|---|---|
| 1 | `src/renderer/data/resourceRegistry.ts` | 删 5 行注册 | — |
| 2 | `src/renderer/state/modifierDescriber.ts` | 删 `TARGET_LABEL` 对应 5 条中文标签（:35/:36/:37/:42/:45） | 🔴 `npm run type-check` **TS2353**（下附实测） |
| 3 | `src/renderer/state/__tests__/modifierReadPortGate.test.ts` | `NO_READER_WHITELIST` 删 5 条（12→7）；`:267` `toBe(27)`→22；`:266` 标题文本改写 | 🔴 门禁 ③⑤ 红（N4 计数 ＋ N6 条数 ＋ N8 并集不等） |
| 4 | `src/renderer/data/__tests__/storyEffectsTargets.test.ts` | `:271-274` 的 `unconsumed` 期望值改为 `[]`（N2） | 🔴 该例红 |
| 5 | （可选）本普查档 ＋ 门禁件头注 | 27/22/5 等口径文字 | 文档失真（无测试看守） |

**预期红名单（退役后、同步改动前的裸读数）**

- `modifierReadPortGate.test.ts`：**③、⑤ 两例红**（N4/N6/N7/N8 落在这两例内）。
- `storyEffectsTargets.test.ts`：**「四表并集 22 个 target 逐名钉桩」那 1 例红**（N2 反向钉子）。
- `npm run type-check`（`tsc -p tsconfig.renderer.json --noEmit`）：**红**，N10。
- `modifierDescriber.test.ts` **不红**：`findUnlabeledTargets()` 是 `MODIFIER_TARGETS.filter(...)` 方向
  （注册表 → 标签），退役只减查询集；**多余标签对它不可见** ⇒ 这是"标签孤儿"的看守缺口，
  只能靠 N10 的类型穷举拦住 ⇒ ⇒ **第 2 项必改不可省**。
- `modifierValidator.test.ts` / `decrees.test.ts` **不红**：两者都刻意用 `[...MODIFIER_TARGETS]` 动态取集
  （`modifierValidator.test.ts:52` 注释原文："不钉死字面量，防与注册表漂移"），`decrees.test.ts:247` 只把
  `MODIFIER_TARGETS.length` 印进 message ⇒ 无字面计数钉桩。**这是本仓测试写得好的一处，退役案受益。**
- **合计：定向件口径 2 文件 / 3 例红 ＋ type-check 红。**

**存档雷（实测，非推理）** —— 沙盒反证：把 `src/renderer/data` 整份复制到 `tmp/c924-06/retired/data`，
从副本注册表删这 5 行（**生产码一字未动**），跑校验：

```
改前（生产口径，27 键）：
  building_upkeep            | inRegistry= true  | validateModifierInstance -> PASS
  event_negative_probability | inRegistry= true  | validateModifierInstance -> PASS
  country_morale             | inRegistry= true  | PASS                          <- 对照组
改后（沙盒 22 键）：
  sandbox registry size = 22
  building_upkeep            | inRegistry= false | THROW: [ModifierValidation] Modifier(x).effects[0].target: unknown modifier target "b…
  event_negative_probability | inRegistry= false | THROW: ...同样报 unknown modifier target
  country_morale             | inRegistry= true  | PASS                          <- 对照组仍通过 ⇒ 探针有牙，不是全抛
```

后果链：`deserialize` 只兜 `activeModifiers ?? []`（`saveLoad.ts:451`，**不校验 target**）
→ 灌进 `GameStore.replaceState` → `:2823` 注释自述"运行时 modifier shape 出错会让 tickDay NaN 蔓延，所以这里再过一道"
→ `validateModifierInstance` **抛** → `throw new Error('[GameStore.replaceState] invalid activeModifier …')`。
⇒ **退役不是"旧键被忽略"，而是"含旧键的存档载入即崩"**。
今日 5 键**数据面 0 行** ⇒ 现前无已知载体可产生这类存档；
但**历史版本若曾填过数**（未查，需 git 史取证）则雷是真的 ⇒ **退役前必须由人工先答这题**，
本班未查 git 历史（超出 35 分钟预算，且结论不改变"交裁决"的处置）。

---

## 五、交人工裁决清单（本案不拍板的部分）

1. **案 A 的 7 个 value 语义**（尤其 #5 `population_happiness` 与既有 `country_morale` 是否同一量 ⇒ 双重计入风险；
   #3 正负概率键是否必须同批）。
2. **案 B 选 注释 还是 退役**；若退役，先答 §四.2 的 git 史问题（历史上这 5 键是否曾进过存档）。
3. **案 A 与案 B 在 `event_positive/negative_probability` 上耦合**：不能一个班接正向、另一个班退役负向。
4. 优先级建议（按本班实测的红/险比）：**#5 民心颂声（机制断裂）> #1 邦交分量（36 行＋季节双路）> #2 学问增速（改既有存档推演）> 案 A 其余 > B-注释案 > B-退役案**。
   前 3 项属"存量玩家可见缺陷"，案 B 属"整洁性问题"，不该抢占案 A 的评审带宽。
5. 若走 B-注释案，是否允许在门禁件加"注释存在性"断言（＝**新增判据**，按纪律需人工授权）。

---

## 六、本班否证与增量（相对卷宗 / 相对上游 c923-06）

- 🔴 **否证 ①（最重要）**：卷宗说退役钉子是 `storyEffectsTargets.test.ts:92/:269-270` **两处**。
  实读：**该文件真正的 `unconsumed` 反向钉子在 `:270-274`**（`:269` 是上一条 `toEqual` 的收尾 `]);`），
  且卷宗**完全没提** `modifierReadPortGate.test.ts` 这道**更严的门禁**（:248/:251/:253/:267/:268 五处独立判据、
  外加 :260/:263 两处闭合判据）。⇒ 按卷宗清单施工会**漏改 1 个文件、漏红 2 例**。
  本班全部钉子位置为现取：`grep -n "WHITELIST.length\|IN_BOTH\|SORTED_READ.length\|REGISTRY.length" src/renderer/state/__tests__/modifierReadPortGate.test.ts`。
- **否证 ②**：卷宗称退役"会动 `MODIFIER_TARGETS` 计数" ⇒ 属实但**不完整**：还会动 `TARGET_LABEL` 的**类型穷举**
  （`Record<ModifierTargetKey, string>` ＝ TS2353，**沙盒实测 rc=2**）与**存档可载入集合**（§四.2 实测）。
  这三面里只有第一面在卷宗里。
- **否证 ③（对上游 c923-06 遗留 3）**："注册行无预留注释 ⇒ 盘上不可区分预留与死注册"**已半过期**：
  门禁件 `NO_READER_WHITELIST`（:43 声明、:44-55 十二条例外）提供了**逐键来历注释**，盘上其实可区分，只是不在注册表本体上。
- **增量**：查出 **3 枚 A 组键有引擎内活写入方**（`seasonSystem.ts:59`、`gameStore.ts:1783`、`gameStore.ts:2335`），
  上游普查只统计到"数据表行数"，未看运行时写入方 ⇒ 因此把"7 键静默失效"的严重度从"数据白填"上抬到
  "引擎每回合生产死状态"，并单点定位出**民心颂声整条机制空转**。
- **增量**：独立复核并通过门禁件的 `building_upkeep` 来历注释（实读 `consumptionTargetFor` 只映射 grain）。
- **口径**：全程未用字符类正则计数（`re.findall` 定长串），未用 `wc -l`；`rg` 在本机可用但本班统一用
  `grep -n`／python，避免 §廿二 的 stdin 假阴。

---

## 七、盘态与自证（完成标准③）

**零生产码改动、零数值改动。本单唯一盘上入库产物就是本文件。**

```
$ git status --porcelain
 M docs/design/OPTIMIZATION_BACKLOG.md                     ← 他班在册（禁碰）
 M docs/insights/colony-dead-exports-20260914.json          ← 他班在册（禁碰）
 D docs/insights/colony-dead-exports-20260914.json.bak      ← 他班在册（禁碰，是在册实况未"恢复"）
 M src/renderer/state/__tests__/saveLoad.test.ts            ← 本班 c924-05 的单，非本单
?? docs/insights/colony-modifier-consumption-design-20260924.md  ← 本单产物
```

⚠️ **完成标准③的字面口径在本波不可达，已按实况收窄并留痕**：卷宗写 `git diff --stat = 0`，但开工时工作树里
就躺着 **3 项他班在册件**，且**同一个班（本班）的 c924-05 已留下一笔受版改动尚未被主班提交**
⇒ 裸读数必然非 0，且**两种非 0 都不是本单造成的**。三种读法全部现取：

```
$ git diff --stat | tail -3                                        # 读法 A：字面口径
 4 files changed, 18 insertions(+), 849 deletions(-)               # ← 非 0，被 1 件本班 c924-05 ＋ 3 件他班污染
$ git diff --numstat -- src docs ':!src/renderer/state/__tests__/saveLoad.test.ts'
 5      5     docs/design/OPTIMIZATION_BACKLOG.md                  # ← 读法 B：只排本班 c924-05，余 3 件全是他班在册
 6      6     docs/insights/colony-dead-exports-20260914.json
 0      830   docs/insights/colony-dead-exports-20260914.json.bak
$ git diff --numstat | grep -vE "saveLoad.test.ts|OPTIMIZATION_BACKLOG.md|colony-dead-exports-20260914.json(.bak)?"
（空输出）                                                          # ← 读法 C：排掉本班 c924-05 与 3 件他班在册
```

⇒ **本单净改动 ＝ 0 个受版文件**，以读法 C 为准；本班两单合计的受版足迹只有 `saveLoad.test.ts`（属 c924-05）
＋ 本文件（未跟踪新档）。读法 B 曾在本班初稿被误写成"空输出"，落盘前自查 `git diff --numstat` 才发现并更正。

**非入库探针**（`tmp/` 已 gitignore：`git check-ignore -v tmp/... ` → `.gitignore:25:tmp/`）：
`tmp/c924-06/scan.py`（12 键普查）、`tmp/c924-06/tsrepro/retire.ts` 与 `retire_after.ts`（TS2353 复现）、
`tmp/c924-06/retired/data/**`（退役沙盒，**生产码的整份副本＋5 行删除**）、
`tmp/c924-06/validate-probe.mts`、`tmp/c924-06/retire-probe.mts`。全部可复跑，命令见 result 的「证据」节。
