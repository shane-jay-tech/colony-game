# c927-17 · 建筑类数值修饰符语义清单登记（只登记不判）

> 班：`qoder-executor-20260927-1915-colony42`（信箱波次 26 只读采集子班）｜采集时刻 2026-09-27 19:0x（本机 `date`）
> 基线：colony-game HEAD `d3f29d4`，工作树 4 枚脏件为外部在途件（本单全程未读写）
> 锚点：`done/20260925-154153-f127.result.md` 遗留 2（卷宗写的 `outbox/…` 已由主班 13:11 搬进 `done/`，内容未变）

## 0. 本单的边界（先说清楚，免得后人不放心）

- 🔴 **经济平衡数值是红线**：本文件**只做登记表**——字段／现值／作用点／语义歧义点，一律带 `file:line`。
  **不评"哪个值才对"、不改任何平衡值、不选案、不接线**。凡"歧义点"都写成**给人拍的判断题**，附"选哪支会有什么后果"的**结构性**描述（不含数值主张）。
- 产物＝本 docs 件，**纯文档**：`src/**`、`data/**`、测试、CI、`package.json` 一字未动（`git status --porcelain` 见 §7）。
- 范围＝注册表里 scope 前缀为 `building_` 的**全部 5 枚键**（不是 f127 那 5 枚的交集，`building_output_area` 一并登记，因为它是"有数据无读取口"的半死形态，与另三枚死键互补）。

## 1. 登记表（主表 · 五键）

声明处全部在 `src/renderer/data/resourceRegistry.ts:58-98`（`MODIFIER_TARGETS`，共 27 键，建筑级 5 键）。

| # | 字段（键名） | 声明 | 中文标签 | 生产者（数据/运行时带值行） | 读取口 | 在册状态 | 一句话语义现状 |
|---|---|---|---|---|---|---|---|
| 1 | `building_construction_speed` | `resourceRegistry.ts:79` | `modifierDescriber.ts:34`「营建速度」 | **3 行**：`seasonSystem.ts:32` mul 1.2（春）／`seasonSystem.ts:56` mul 0.67（冬）／`decrees.ts:360` mul 1.10（朝令「通工易事」二阶） | **有**：`gameStore.ts:1016` | 活键 | 全链路通，唯一在跑的建筑级修饰符；工期倍率语义**未明文定义**（§3.1） |
| 2 | `building_construction_cost` | `resourceRegistry.ts:80` | `modifierDescriber.ts:35`「营建耗费」 | **0 行**（四表与运行时全零） | **无** | 死注册 | 名在册、数未填、线未接；底数（造价）目前**结构上不可被修饰** |
| 3 | `building_efficiency` | `resourceRegistry.ts:81` | `modifierDescriber.ts:36`「建筑效率」 | **0 行** | **无** | 死注册 | 同上；且"效率"在本仓已有**三条活通道**在算（§3.3），键名与它们的重叠关系未定 |
| 4 | `building_upkeep` | `resourceRegistry.ts:82` | `modifierDescriber.ts:37`「建筑维护」 | **0 行** | **无** | 死注册 | 同上；维护结算走 `country_grain_consumption` 的 **grain 单资源专用路径**（`productionSystem.ts:50-55`），本键不参与 |
| 5 | `building_output_area` | `resourceRegistry.ts:97` | `modifierDescriber.ts:48`「区域产出加成」 | **1 行**：`decrees.ts:393` mul 1.08（朝令「百工兴市」二阶，`days: 18`，`cost: gold 120 / bronze 14 / rite 4`） | **无** | 半死（有数无线） | 玩家已可见的文案承诺"市集类建筑加成 +8%"，运行时净后果 **0**；"区域"与"市集类"两个限定词都无承载位 |

**两枚在册钉子的现值（本单复核仍在世，行号零漂移）**
- `src/renderer/state/__tests__/modifierReadPortGate.test.ts:44-47` `NO_READER_WHITELIST`（12 键之一族）逐名注释：
  `:44 building_construction_cost // 数据 0 行：名已注册、数未填、线未接`；`:45 building_efficiency // 同上`；
  `:46 building_upkeep // 同上（建筑维护结算走 consumptionTargetFor 的 grain 专用路径，不读此键）`；`:47 building_output_area // J-3 v0.8 后加键，未接运行时`。
- `src/renderer/data/__tests__/storyEffectsTargets.test.ts:272` 四表未消费 5 键清单含本表 #2/#3/#4 三枚（另两枚 `event_negative_probability`／`population_class_growth_gong` 非建筑 scope，本单不登记）。
- ⚠ 这两枚钉子对**接线的处置**属写码＋改测试清单＝人工闸，本单未碰。

## 2. 五键的"底数"在哪（接线后会被修饰的量 · 只报位置与形状）

| 被修饰底数 | 声明/结算位置 | 现值形状（分布读数，非评价） |
|---|---|---|
| 新建/升级造价 `def.cost` | 逐栋声明：`src/renderer/data/buildings.ts`（35 栋 `cost:`）；判定 `resourceRegistry.ts:127 canAfford`（唯一支付判定，`:130` 把**负数与非有限值造价**判为"付不起"）→ 入门检查 `placementSystem.ts:79-81` → 扣减 `gameStore.ts:792-800`（逐资源 `setResourceClamped`，`:794` **显式跳过 `people`**） | 整数材料造价；`people` 走占用制（`gameStore.ts:780-790`），不进支付循环 |
| 升级造价 | `gameStore.ts:878` `const cost = toDef.upgradeCost ?? toDef.cost`（回退关系）；扣减 `gameStore.ts:888-896`（`:880` 判定与 `:890` 扣减两处均跳过 `people`） | `upgradeCost` 仅 7 栋声明（`buildings.ts:88/:201/:229/:294/:314/:382/:409`） |
| 工期 | `gameStore.ts:1043`（`time <= 0` 即建完）与 `:1050` `constructionProgress += (100 / time) * constructionSpeedMul`；`time` 新建取 `def.constructionTime`、升级取 `targetDef.upgradeTime`（`gameStore.ts:1022-1024`） | `constructionTime` 分布：1×9 栋／2×16 栋／3×7 栋／5×3 栋（合计 35） |
| 单栋产出 | `productionSystem.ts:128-134` `rawOutput[r] += o.perDay * adj.mul * buildingFactor(b.defId)` | 三条倍率通道串在同一行：相邻 `adj.mul` × 阶层折扣 `buildingFactor` ×（之后在 `:182-187` 再乘国家级 mul、加国家级 add） |
| 相邻加成（现成的"区域/效率"通道） | `productionSystem.ts:75-108 computeAdjacencyMul`，距离 `:61-69 tileDistance` | `adjacencyBonus` 8 栋声明；**同一资源多规则命中时取最大不叠乘**（`:88 if (ruleMul <= bestMul) continue`） |
| 阶层需求折扣（第二条"效率"通道） | `classNeeds.ts:56-59 fulfillmentFactor` = `0.5 + 0.5 × metRatio`（值域 **0.5..1**）；入口 `classNeeds.ts:100-106`，caller `gameStore.ts:666`（HUD 口径）／`:1081`（结算口径） | 与修饰器无关的独立固定映射，无键可改 |
| 维护/原料消耗 | `productionSystem.ts:135-147`：`def.upkeep` 与 `def.consumes` **合并进同一个 `rawUpkeep`**；`:136` 跳过 `people` | `upkeep: {` 35 处／`consumes` 5 处 |
| 国家级产出/消耗修饰 | `productionSystem.ts:36-48 outputTargetFor`（7 资源映射）＋ `:50-55 consumptionTargetFor`（**只映射 `grain`，其余一律 `return null`**）；读者 `:182-194` 与 `:269-276`（HUD 同源） | ⇒ "其余 7 种资源的 upkeep 结构上不可被修饰"是**在册否证**，非本单新发现 |
| 取整/残差 | `productionSystem.ts:197-201`（`Math.trunc` 向 0 截断 ＋ `fractionalCarry` 分数累加器）；资源钳制 `gameStore.ts setResourceClamped`（区间 [0,9999]） | 修饰器结果最终受这两道 shaping，任何"倍率类"接线的观感都经它们 |

## 3. 语义歧义点（逐键 · 给人拍的判断题，本单一律不选案）

### 3.1 `building_construction_speed`（活键 · 语义靠实现倒推，无一处明文）

1. **倍率 or 工期？** 实现是"每日进度增量 ×倍率"（`gameStore.ts:1050`），等价于**有效工期 = constructionTime ÷ mul**；除不尽时为小数日（2÷1.2=1.667 日），且 `:1052` 的 `>= 99.999` 闸门会**提前**判定完工。⇒ 待拍：是否接受"工期非整日"？若要整日，改的是**取整口径**（属数值行为）。
2. **这枚键允许哪种 `op`？** 读取形式 `applyModifiers(1, …)` ＝ `(1 + Σadd) × Πmul`（`modifierAggregator.ts:61-68`）。⇒ 在该 base 上 `add 0.1` 与 `mul 1.1` **数值同解**，但与其他 modifier 同时存在时**聚合顺序会分出差别**（多 add 先累加后统一乘）。`modifierValidator.ts:32` 一带只校验 target 是否注册、op ∈ {add,mul}，**不校验按键量纲** ⇒ 待拍：是否为建筑级键补一份"合法 op 白名单"？
3. **展示口径与运行时不同形**：`describeEffect`（`modifierDescriber.ts:52-63`）对 mul 显示「营建速度 +20%」、对 add 显示「营建速度 **+0.1**」（无量纲）。当前 3 行数据全为 mul ⇒ 若将来填 add，玩家会看到裸 0.1。待拍：无量纲 add 的文案口径。
4. **多路写入并存**：春 1.2 与冬 0.67 互斥（季节切换移除旧季节 modifier，`gameStore.ts:1004-1009`），但**朝令 1.10 与季节叠乘**（冬季＋朝令 ⇒ 0.67×1.10）。待拍：是否允许"冬天仍被朝令拉速"这类叠乘；这是平衡判断，本单只登记乘积形状。
5. **全局 vs 逐栋**：求值以 `hasConstructing` 为开关（`:1014-1017`）、**一次求值对所有在建建筑（含升级）统一施加**。待拍：键名前缀 `building_` 是否承诺逐栋差异化（见 §4.1）。

### 3.2 `building_construction_cost`（死键 · 一旦接线要一次拍四题）

1. **含不含 `people`？** 支付循环与判定都**显式跳过 people**（`gameStore.ts:795`、`:886` 一带；判定侧 `resourceRegistry.ts:127-134` 遍历 `RESOURCE_IDS` 含 people，但 people 造价走占用制 `gameStore.ts:779-789`）。待拍：造价修饰是否覆盖劳力占用需求。
2. **mul 后取整方向**：造价是整数、判定用严格 `<`（`resourceRegistry.ts:131`）。mul 1.10 ⇒ 小数造价，**四舍五入／向上取整／向下取整三案会分别改变"够不够付"的边界日**。待拍（红线：本单不选案、不测哪案更平衡）。
3. **打折的地板**：`canAfford` 把**负数与非有限值造价直接判"付不起"**（`resourceRegistry.ts:130`）。若 mul<1 或多路 add 负值把造价压到 ≤0，行为是"变免费"还是"永远建不了"？当前实现在**判定层**就会拒。待拍：是否设造价下限钳制。
4. **新建与升级共用一键还是分两键**：现两字段并存且有回退关系（`gameStore.ts:878`）。共用 ⇒ 一句"营建耗费 −10%"会同时改写升级价；分键 ⇒ 注册表要加第 6 枚建筑级键。
- 附带结构性事实（不是歧义）：此键接线后，UI 造价显示与实付是否联动？建筑浮窗读的是 `def.cost` 原文 ⇒ 若不联动会出现"显示 20 木、实付 18 木"。

### 3.3 `building_efficiency`（死键 · 最大风险是**概念重名**）

1. **它等于哪条既有通道？** 本仓已在算"单栋效率"的有三条：相邻 `adj.mul`（`productionSystem.ts:131`）、阶层折扣 `buildingFactor`（`classNeeds.ts:100-106`，值域 0.5..1）、国家级 `country_<r>_output`（`productionSystem.ts:182-187`）。待拍：本键与三者的**分工 or 合并**（若不定义，接线即成第四重乘积）。
2. **"效率"作用于产出、消耗，还是两者？** 键名不带方向；`building_upkeep` 已单独占住消耗侧（且消耗侧结构上只接 grain，见 §3.4），若"效率"含消耗即与 `building_upkeep` 语义交叉。
3. **重名先例在册**：同族"两键一量"的公开风险案例＝`population_happiness` 与 `country_morale`（`docs/insights/colony-modifier-consumption-design-20260924.md` §三.5 记为"本案最高不确定项"）。本键与三通道是否同类，**需人工先给定义再谈数值**（先例方向：定义在前、接线在后）。
- ⚠ 本键**唯一**在代码里带值出现处＝`src/renderer/data/__tests__/modifierValidator.test.ts:38`（`{ target: 'building_efficiency', op, value: 0.1 }`），是校验器的**探针形状**，不构成任何生产数值——登记以免后人误读为"现值 0.1"。

### 3.4 `building_upkeep`（死键 · 与 grain 专用路径撞位）

1. **逐栋 upkeep 倍率 or 资源级消耗倍率？** 后者已由 `country_grain_consumption` 承载（`productionSystem.ts:50-55`→`:189-194`）。若本键也走资源级 ⇒ **同一乘积两次计入**（grain 维护尤甚）。
2. **作用范围含不含 `consumes`（原料）？** 现状 `upkeep` 与 `consumes` 在 `productionSystem.ts:135-147` 合并成单一 `rawUpkeep` ⇒ "只减维护不减原料"这类语义**现形状表达不出**，要先拆累加器（＝写码）。待拍：是否要拆。
3. **`people` 算不算维护？** 现状显式排除（`productionSystem.ts:136`，注释理由＝否则人口被持续吃空）。待拍：本键是否重启该路径。
4. **"其余 7 种资源 upkeep 不可修饰"是既有硬编码还是缺陷？** 在册两处已登记该事实（`docs/insights/colony-config-source-map-20260925.md:26`「只有 grain 接了 consumption 修饰键」＋ `:97`；`colony-modifier-consumption-design-20260924.md` 表 #10）。本键的存在暗示"曾想做成通用建筑维护修饰"——两者取向**互斥**，需人工裁定走"本键通用化（并扩 consumptionTargetFor）"还是"承认 grain 单轨、退役本键"。

### 3.5 `building_output_area`（半死键 · 数据与文案已对玩家作出承诺）

1. **"区域"是什么空间概念？** 现仓内可计算的空间量只有 `tileDistance`（`productionSystem.ts:61-69`，包围盒 Manhattan）与 `adjacencyBonus.range`（`:97`）。"区域"是否＝range 内邻居？还是沿河／市内一类未实现的概念？（注册处注释 `resourceRegistry.ts:96` 写的是"驿道/水碓**沿河**等增益相邻 building"——"沿河"在盘上无对应判定，属**注释级承诺**）
2. **"市集类"这一限定如何承载？** 文案（`decrees.ts:371`）明写"市集类建筑加成 +8%"，但 `ModifierEffect` 形状只有 `{target, op, value}`（`schema.ts:25-29`），**无 defId/类别/范围参数位**。三条出路各有代价：① 扩 schema（写码＋存档形状变更）；② 键名多键化（注册表＋标签表同步扩，`modifierDescriber.ts` 有全覆盖断言）；③ 放弃选择性（与文案冲突）。待拍：走哪条——本单**只列形状约束，不选案**。
3. **与相邻加成的合成律**：现有 `computeAdjacencyMul` 是**取最大不叠乘**（`:88`），而本键走 `getMulFactor` 是**累乘**（`modifierAggregator.ts:74-85`）⇒ 同一栋楼两条区域类加成会表现成"邻居取最大、朝令照叠乘"两套规则。待拍：合成律是否统一。
4. **不接线的既有后果（结构性登记，非数值主张）**：采纳「百工兴市」二阶要付 `gold 120 / bronze 14 / rite 4` 并占 `days 18`（`decrees.ts:388-393`），当前该 effect 的数值后果为 0；同族"已上架静默失效"在册先例＝`country_diplomacy_weight`（四表 36 行）、`event_positive_probability`（5 行），出处同上 §1 引的设计档。

## 4. 跨键公共歧义（拍一次管五键）

1. **`building_` 前缀是否承诺"逐栋生效"——盘上不可区分。** 全仓唯一的逐栋修饰位＝`BuildingInstance.modifiers: string[]`（`src/renderer/data/schema.ts:133`，注释自称 "Per-instance modifiers (from local events / decrees)"），而它在**非测试代码里的唯一读者是存档校验**（`saveLoad.ts:798` 只验"是字符串数组"），**无任何数值读取口**；唯一活键的求值是全局一次（`gameStore.ts:1016`）。⇒ 待拍：建筑级 scope 到底＝"影响所有建筑"还是"影响某栋建筑"。此题不定，五键的读取点选择都缺判据。
2. **无钳制约定**：`applyModifiers`/`getMulFactor` 均不 clamp（`modifierAggregator.ts:34-99`），钳制只在资源层（`setResourceClamped`）与进度闸门（`gameStore.ts:1052`）。⇒ 倍率类键的上下界是**待拍题**。
3. **无按键量纲校验**：`modifierValidator.ts` 只查 target 注册与 op 合法性 ⇒ 死键一旦被填值，`add`/`mul` 混用不会被任何门禁拦下。
4. **登记腐烂风险（在册机制提醒）**：`modifierReadPortGate.test.ts:41` 注释要求"任一键真被接上读取口，③ 号用例即红 ⇒ 同笔把该键从白名单删掉"。⇒ 任何接线都**必须同批改两枚测试件清单**（属写码＋人工闸，本单不做）。

## 5. 与在册邻居的分工（避免重复劳动）

| 邻居档 | 它已经干了什么 | 本单增量 |
|---|---|---|
| `docs/insights/colony-modifier-zeroconsumer-census-20260923.md` | 五键零消费者的**普查**（表 :56-58、结论 :121-124） | 补"底数在哪＋歧义判断题"，普查档只到"有没有读者" |
| `docs/insights/colony-modifier-consumption-design-20260924.md` §三 | 案 A 7 键**接线选点**建议（含 `building_output_area` → `productionSystem.ts:182-192`）＋ `population_happiness` 重名实证 | 不重复选点；本单把 5 枚建筑键的**语义待拍项**逐条列成可裁决问题，并登记 `building_output_area` 的"文案限定词无承载位"这一新形状约束 |
| `docs/insights/colony-config-source-map-20260925.md` §1（`:24` 造价行） | 造价唯一来源＝`canAfford`，`building_construction_cost` **无读取口** ⇒ 造价不可修饰 | 直接引用，不再复核唯一性 |
| `done/20260925-154153-f127.result.md` 遗留 2 | 点名 5 键"需人工定数值语义"（含两枚非建筑 scope） | 本件即其**登记表落地**（建筑 scope 部分），非建筑两枚（`event_negative_probability`／`population_class_growth_gong`）不在本单范围 |

## 6. 明确未做（红线清单）

- 未评任何"现值合不合理"、未给任何建议数值、未选任何案（含 §3.2 取整三案、§3.5 三条出路）。
- 未改 `resourceRegistry.ts`（含"给死键补『预留』注释"这一低成本动作——**留人工**，因为它改的是 src 文件且 f127 遗留 4 已声明"预留位与死注册在盘上不可区分"的处置需拍板）。
- 未改两枚在册钉子测试（`modifierReadPortGate.test.ts`／`storyEffectsTargets.test.ts`），未碰 `NO_READER_WHITELIST`。
- 未接线、未扩 schema、未动经济平衡值、未提交 git。
- 全量 `npm test` 未跑（同刻他仓在途，并发窗禁跑；本单零代码改动，定向读数以 grep/读码取证）。

## 7. 复算命令（全部只读）

```bash
cd D:/code/colony-game
# ① 五键声明位
grep -n "building_" src/renderer/data/resourceRegistry.ts
# ② 逐键：非测试生产行 / 读取口 / 全部非测试引用（本档 §1 表的出处）
for k in building_construction_speed building_construction_cost building_efficiency building_upkeep building_output_area; do
  echo "== $k 生产者=$(grep -rn "target: '$k'" src --include=*.ts | grep -v __tests__ | wc -l) 读取口=$(grep -rn "'$k'" src --include=*.ts | grep -v __tests__ | grep -Ec 'applyModifiers|getMulFactor|getAddDelta|aggregateModifiers')"
  grep -rn "$k" src --include=*.ts | grep -v __tests__
done
# ③ 两枚在册钉子（白名单注释 / 未消费清单）
sed -n '40,55p' src/renderer/state/__tests__/modifierReadPortGate.test.ts
sed -n '260,276p' src/renderer/data/__tests__/storyEffectsTargets.test.ts
# ④ 底数形状
grep -c "id: 'bld_" src/renderer/data/buildings.ts                       # 35 栋
grep -o "constructionTime: [0-9]*" src/renderer/data/buildings.ts | sort | uniq -c   # 1×9 / 2×16 / 3×7 / 5×3
grep -c "upkeep: {" src/renderer/data/buildings.ts                        # 35
grep -c "consumes" src/renderer/data/buildings.ts                         # 5
sed -n '36,55p' src/renderer/state/productionSystem.ts                    # outputTargetFor / consumptionTargetFor(grain-only)
sed -n '1014,1017p;1043,1053p' src/renderer/state/gameStore.ts            # 唯一活键的读取口与工期公式
sed -n '25,29p;130,134p' src/renderer/data/schema.ts                      # ModifierEffect 三字段形状 / BuildingInstance.modifiers:133
sed -n '30,45p' src/renderer/data/__tests__/modifierValidator.test.ts      # building_efficiency 仅作校验探针（value 0.1，非生产数值）
# ⑤ 工作树自证（本单只新增本文件；4 枚脏件系外部在途）
git status --porcelain
```
