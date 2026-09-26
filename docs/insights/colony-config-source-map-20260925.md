# 邦国录 · 配置来源与生效面唯一性取证（2026-09-25，信箱单 `20260925-154153-f127`，风险档 B / 工作类型 audit）

> **本档是证据与读数，不是 CONCLUSION**（卷宗只读采集类第④条：禁下通过/不通过的最终判定）。
> 全部探针为**只读**（读文件 ＋ 跑脚本），零写业务码、零改数值、零跑全量套件。
> 记录者：信箱执行班 `qoder-executor-20260925-2030-colony35`；本机时钟在册双向跳，故读数一律带命令原文供复算。

## 0. 六个名词先证其在世（否证即收窄，不造概念）

| 卷宗名词 | 在世判定 | 实测命令与读数 |
|---|---|---|
| 资源 | ✅ 在世 | `RESOURCE_IDS`（`data/resourceRegistry.ts:11`）**11 项** |
| 🔴 价格 | **不存在** | `$ rg -n "价格" src --glob '!**/__tests__/**'` → **0 命中**（无输出）。仓内在世形态＝**造价 `cost`**（`ResourceCost` 类型 ＋ `canAfford` 判定 ＋ 各 data 表的 `cost:` 字段）⇒ 本档按「造价」取证 |
| 产出 | ✅ 在世 | `buildings.ts` 内 `output:` **35 处**；算式在 `state/productionSystem.ts:7-11` |
| 消耗 | ✅ 在世 | `buildings.ts` 内 `upkeep:` **35 处**；阶层侧 `computeClassConsumption`（`gameStore.ts:671`） |
| 人口 | ✅ 在世，**但两字段** | `RESOURCE_IDS` 含 `people` ＋ `POPULATION_CLASSES`（`data/populationClass.ts:6`）四阶层 ⇒ 见 §4 候选项 |
| 事件 | ✅ 在世 | `EVENTS`（`data/events.ts:276`）**83 条**聚合 |

## 1. 来源总表（唯一声明处 → 运行期读者 → 覆盖者）

| 参数类 | 唯一声明处（权威） | 运行期读取者 | 可覆盖它的东西（优先级从低到高） |
|---|---|---|---|
| 资源 id／分组 | `data/resourceRegistry.ts:11`（总表）、`:35` 顶栏 8 项、`:40` 中间品 2 项 | `canAfford`／`addBags` 逐 id 遍历（同文件 `:109/:127`）；HUD 按 `TOP_BAR_RESOURCE_IDS` 展示 | 展示分组表＝视图划分，**不改数值**；无 JSON/env 覆盖层（`public/data/` 不存在，实测 `(no public/data)`） |
| 全局经济旋钮 | `data/balanceConfig.ts`：`BALANCE:35`、`STORY_BALANCE:83`、取用函数 `getBalanceConfig:100` | `gameStore.ts:476`、`:2568`（人口参数按模式）、`:2134`（**字面 `'story'`** 取起始资源）；`main.ts` 开局发放 | 模式选表（`mode === 'story' ? STORY_BALANCE : BALANCE`）；`state/crisis.ts` `CRISIS_*`、`state/diplomacySystem.ts`、`data/countryGrades.ts` 三处**刻意不入本表**（文件头注释点名，`balanceConfig.ts:7-11`） |
| 造价 cost | 条目各自声明：`buildings.ts` 35／`policies.ts` 39／`decrees.ts` 24／`megaProjects.ts` 13 处 `cost:` | `canAfford`（`resourceRegistry.ts:127`）＝**唯一支付判定**；`buildingRegistry.ts` 启动校验负数／非有限值 | `building_construction_cost` 修饰键**无读取口**（在册白名单，见 §3）⇒ 造价目前实际不可被修饰器改写 |
| 产出 output | `buildings.ts` 35 处（**唯一数据源**；policies/decrees/military/megaProjects 的 `output:` 全 0 处，实测见 §5） | `productionSystem.ts:128` 累加 → `× mul(country_<r>_output) + add(...)`（同文件 `:7-8`） | 国家级修饰键（仅已登记的 `country_*_output`）；相邻加成 |
| 消耗 upkeep | `buildings.ts` 35 处 ＋ 阶层 `computeClassConsumption` | `productionSystem.ts:136-137`（`people` 显式 `continue`，民不按 upkeep 扣）→ `consumptionTargetFor` | 🔴 **只有 grain 接了 consumption 修饰键**（`productionSystem.ts:50-53` 硬编码 `if (resId === 'grain')`，其余资源 mul=1/add=0）⇒ 代码位优先于数据位的一处例外 |
| 人口 | `balanceConfig.population`（5 键）＋ `data/populationClass.ts`（4 阶层结构）＋ `resources['people']` | `getIdlePeople()`（`gameStore.ts:491`＝`people − 已用工`）、`getPopulationClasses()`（`:494`）、`totalPopulation`（仅 3 文件读，实测 §5） | 单向派生兜底 3 处：`gameStore.ts:418`、`:2886`、`saveLoad.ts:130`（people → 全记 farmer）；**无反向回写点**（实测 `rg "\['people'\]\s*[-+]?="` 于非测试源 **0 命中**） |
| 事件池 | `data/events.ts:276` `EVENTS = [...BASE_EVENTS, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS]` | `data/index.ts:8` barrel 再导出；节奏 `BALANCE.event.minDaysBetween` | 三池合并＝**单点聚合**；探针实测跨池＋池内 id **重复 0 条** ⇒ 顺序不参与覆盖 |
| 修饰器 target | `resourceRegistry.ts:58` `MODIFIER_TARGETS`（27 键） | 运行时入口只有 `state/modifierAggregator.ts` 的 4 个函数（在册 census 结论，本档按字面串双轨复算，见 §3） | `modifierValidator.ts` ＋ 门禁 `state/__tests__/modifierReadPortGate.test.ts`（`NO_READER_WHITELIST` 12 键存量例外登记表） |
| 贴图／美术 | `data/artManifest.ts`（键）＋ `public/art/**`（盘）＋ 生成器脚本 | `data/__tests__/artManifest*.test.ts`、`scatterAssets.test.ts` 对账 | 🔴 三方（生成器／键／盘）**不一致已在册**：`d48c2aa` → `docs/insights/colony-rockcluster-mismatch-20260924.md`（缺"生成器↔键"这条对账边） |

## 2. 生效来源唯一性探针（三类读数，全部为脚本实测）

**A. 资源：三分组精确划分总表 ⇒ 唯一登记处成立**

```
A. RESOURCE_IDS 11 | TOP_BAR 8 | INTERMEDIATE 2
   三分组并集==RESOURCE_IDS ? True | 组间相交 [] []
   未分组差集 [] | 多出项 []
```
即 11 = 顶栏 8 ＋ 中间品 2 ＋ 名望 `influence` 1，无遗漏、无多余、组间不相交。
⚠ 顺带一条**口径漂移**（只登记不处置）：`docs/release-notes-v0.10.0.md` 与 `README.md` 写"**8 资源**"，
而登记处是 11 个 id ⇒ 8 是**顶栏展示口径**、11 是**资源口径**；两文档未标明这一点。

**B. 事件：三池 83 条零 id 重复 ⇒ 无覆盖竞争**

```
events.ts/BASE: 8 条 id，去重后 8
eventsExpanded.ts: 40 条 id，去重后 40
storyEvents.ts: 35 条 id，去重后 35
跨池/池内重复 id 数: 0 []
聚合行: export const EVENTS: CourtEvent[] = [...BASE_EVENTS, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS];
```

**C. 修饰器：字面串轨 vs 运行时入口轨，双轨对到位并解释差额**

- 本档轨道（全部非注册表、非测试源里的 `'键'` **带引号字面串**计数）：**27 键中 5 键零引用**
  ＝ `building_construction_cost`、`building_efficiency`、`building_upkeep`、`population_class_growth_gong`、`event_negative_probability`。
  🔴 **本轨口径经实测订正**：`state/modifierDescriber.ts:37-45` 把键名写成**不带引号的对象属性**（`building_upkeep: '建筑维护',`），
  带引号计数看不见它 ⇒ 追加一轨 `\b<键名>\b` 全形计数复核五键：**quoted=0 / any=1，且那唯一 1 处五个键全在 `modifierDescriber.ts` 同一张中文标签表里**。
  ⇒ 订正后的准确表述＝**五键的全部非注册表引用只剩一张显示名表**（既无数据表条目、也无运行时读者），
  比"零引用"弱一档但更强一档：标签已备好、语义与接线双缺。
- 在册轨道一（**数据表消费面**）：`data/__tests__/storyEffectsTargets.test.ts:259-276` 钉"四表并集 22 键"＋"注册表内四表未消费 5 键"，
  其 5 键名与本档 5 键**逐名相同**。⚠ 如实标注：本档 corpus 含 data 表，两轨判据高度接近 ⇒ **5=5 属预期一致（口径对齐核验），不当独立发现计**。
  本档多出的覆盖面是"代码侧（state/scenes/ui/render）除标签表外零读者"这一条，在册轨道不查。
- 在册轨道二（**运行时读取面**，`modifierReadPortGate.test.ts` ＋ `docs/insights/colony-modifier-zeroconsumer-census-20260923.md`）：
  **12 键无运行时读取口**（`NO_READER_WHITELIST`，同文件 `:43-56`）。
- 差额归因：运行时轨只认 `modifierAggregator` 4 个入口的调用点，故"数据表引用了但线未接"的键也进 12；
  本档 5 键**全部是 12 键的子集**（逐名核对：五键均在 `NO_READER_WHITELIST` 内），
  它们多一重性质＝**连数据表都不引用**，正对白名单注释里的"名已注册、数未填、线未接"三件全空型
  （`event_negative_probability` 注释即"数据 0 行；所在机制整条不存在"）。
  ⇒ 结论留给主班：本档不判"通过/不通过"。

## 3. 覆盖优先级链（谁最后改写谁）

```
data/*.ts 常量（表）
  ↓ 模式选表：getBalanceConfig(mode)（balanceConfig.ts:100；读者 gameStore.ts:476/:2134/:2568）
  ↓ 开局注入：main.ts 一次性发放在 registry（GameScene.ts:254 注释点名"seedStartingResources 已在 main.ts 启动时
    一次性下发，避免 STATE_REPLACED 加载一份资源恰好为零的合法存档时被错误地再次注入"＝一条已修的**重复覆盖**缺陷）
  ↓ 运行期改写：modifierAggregator 4 入口（只有已接线的 15 键真生效，12 键在存量白名单）
  ↓ 读档覆盖：saveLoad 迁移链 migrations[1..8] 逐级升版 → 未来 schemaVersion 拒载（:388）
    → shape 校验与钳制（e56d82a）→ 人口字段兜底（:130 people → farmer 全额）
展示层：TOP_BAR_/INTERMEDIATE_ 分组、Legend 文案 —— 只读，不改数值
```
证据面：以上每个箭头都能 `rg` 到具体行（本档 §1 表最后一列）。

## 4. 留给主班的两条"单一来源"候选（本档不下判定）

1. **人口两字段并存**：`resources['people']`（总量口径，多处直读当"人口"：`gameStore.ts:1203/:1240/:1626/:1649/:1749`）
   与 `state.populationClasses`（四阶层，写点在 `:512/:713-714/:2552/:2663/:2700`）。
   实测：非测试源里 `resources['people'] = ` 形态的**直接赋值 0 处**（people 走通用资源 delta 写），
   而 `populationClasses` 有 7 处直接写；存档两侧都存（`saveLoad.ts:363` 序列化、`:540` 反序列化时把两者都喂进去）；
   方向性＝**只有 people → populationClasses 的兜底派生（3 处），无反向回写**。
   ⇒ 是否算"同一参数两个生效来源"请主班裁；最小消歧动作候选：把 `people` 改为 `totalPopulation(populationClasses)` 的派生 getter，
   或存档只留一份并在读档时派生另一份。**均需改业务码与存档语义 ⇒ 越过本单授权（属产品＋人工裁决面）。**
2. **消耗修饰键只有 grain 接线**（`productionSystem.ts:50-53` 硬编码分支）⇒ 其余 7 种资源的 upkeep 不可被修饰器改写。
   同族：`building_upkeep`／`building_construction_cost`／`building_efficiency` 三键在册白名单里，注释即"线未接"。

## 5. 支撑读数（全部同一次跑批，命令见 §6）

```
D. buildings        cost: 35 output: 35 upkeep: 35 处
D. policies         cost: 39 output:  0 upkeep:  0 处
D. decrees          cost: 24 output:  0 upkeep:  0 处
D. military         cost:  0 output:  0 upkeep:  0 处
D. megaProjects     cost: 13 output:  0 upkeep:  0 处
D. events/eventsExpanded/storyEvents/balanceConfig  cost/output/upkeep 全 0 处
C. POPULATION_CLASSES ['farmer','worker','soldier','scholar']
   growth 侧 target ['population_class_growth_shi','population_class_growth_nong','population_class_growth_gong']
   ⇒ 4 阶层对 3 个 growth 键（soldier 无对应键），且阶层命名两套并存：数据侧英文、修饰器侧拼音，无编译期联动
   读者实测：data 表只引用 nong/shi（`gong` 数据表零引用，其唯一非注册表引用是 `state/modifierDescriber.ts` 的中文标签行）
   谁读 totalPopulation：data/populationClass.ts、state/gameStore.ts、state/populationClassSystem.ts（3 文件）
```

## 6. 复算命令（原文）

```
$ rg -n "价格" src --glob '!**/__tests__/**'      # 0 命中（取 rc 不接管道：rc=1、0 行）
$ rg -in "寻路|pathfind|a-star|astar|breadth|BFS|shortestPath" src --glob '!**/__tests__/**'   # 0 命中，rc=1 ⇒ 「寻路」确不存在
$ rg -c "cost" src/renderer/data/buildings.ts                    # 36
$ rg -n "export const (RESOURCE_IDS|TOP_BAR_RESOURCE_IDS|INTERMEDIATE_RESOURCE_IDS|MODIFIER_TARGETS|BALANCE|STORY_BALANCE|EVENTS|POPULATION_CLASSES)" src/renderer/data
$ rg -n "STORY_BALANCE" src --glob '!**/__tests__/**'            # 定义 2 处 + 取用 :101 + 读者注释 gameStore.ts:2567
$ rg -n "getBalanceConfig\(" src --glob '!**/__tests__/**'       # 3 个读者：gameStore.ts:476 / :2134 / :2568
$ rg -n "forest_node|stone_node|river_node" src/renderer --glob '!**/__tests__/**'   # 节点→资源映射只活在 UI 文案（Legend.ts:26-28「加产木/石/粮」）与配色（mapColors.ts:43-45），非数据表
$ rg -c "population_class_growth" src/renderer --glob '!**/__tests__/**'
   → data/decrees.ts 3、data/policies.ts 3、data/events.ts 1、state/modifierDescriber.ts 3、data/resourceRegistry.ts 3
$ for k in shi nong gong; do rg -o "population_class_growth_$k" src --glob '!**/__tests__/**' | wc -l; done   # 6 / 5 / 2
   → gong 的 2 处＝注册表条目 ＋ modifierDescriber 标签行 ⇒ **数据表零引用**（nong/shi 才是被表引用的那两个）
$ for k in <五键>; do rg -o "'$k'|\"$k\"" …|wc -l; rg -o "\b$k\b" …|wc -l; done
   → 五键一律 quoted=0 / any=1，any 的那 1 处全在 state/modifierDescriber.ts:37-45（对象属性名不带引号）
$ rg -n "\['people'\]\s*[-+]?=" src/renderer --glob '!**/__tests__/**'   # 0 命中
$ rg -n "populationClasses" src/renderer/state/saveLoad.ts       # :104 字段、:130 兜底、:363 序列化、:540 反序列化
$ python - <<'PY'   # §2 A/B 与 §5 C/D 的探针（只读；正则抽表 + 字面串计数 + id 去重）
  # 关键片段：
  #  RES/TOP/INT/MOD = 从 resourceRegistry.ts 抽四个 as const 数组
  #  corpus = os.walk('src/renderer') 排除 __tests__ 与 resourceRegistry.ts，逐文件数 "'key'"
  #  pools = events.ts / eventsExpanded.ts / storyEvents.ts 的 id: '...' 计数与 set 去重
  #  D 表 = 各 data 文件里 \bcost\b\s*: / \boutput\b\s*: / \bupkeep\b\s*: 的计数
PY
```
⚠ 探针口径自带局限，读数只到这一层：
① **带引号字面串计数会漏掉"对象属性名"形态的引用**（本档就中招一次并被自己的第二轨抓出来 ⇒ §2C 已按订正后表述写）；
② 字面串计数也认不出**模板动态拼键**——实测 `productionSystem.ts:36-47` 的
`outputTargetFor()` 是一张**显式字面量 map**（`grain: 'country_grain_output'` 等 7 项，非 `` `country_${r}_output` `` 拼法），
故本档 27 键计数不受动态拼键影响；顺带一条同处读数：该 map 只覆盖 7 种资源 ⇒
`people / hemp / tin / influence` **无 `country_*_output` 键可接**（注册表里也确实没有这四条 output 键）；
③ "某键零引用"仍是**弱证**，强证是在册 `modifierReadPortGate` 的入口函数调用点判据 ⇒ 两轨已在 §2C 对齐并解释差额。

## 7. 与在册邻居的分工（勿重复计账）

| 已有档／门禁 | 它管哪一面 | 本档差异 |
|---|---|---|
| `docs/insights/economy-params-inventory-20260905.md`（09-20 补故事段） | 经济参数**数值清单＋消费方** | 本档管**来源唯一性与覆盖链**，不含数值；该档 `getBalanceConfig` 行号现读为 `:100`（其写作 `:101`，1 行漂） |
| `docs/insights/colony-modifier-zeroconsumer-census-20260923.md` ＋ `state/__tests__/modifierReadPortGate.test.ts` | 修饰器**运行时读取面**（15 有／12 无） | 本档补**字面串轨**（5 键连数据都不引用）与差额归因，不新判据不消红 |
| `data/__tests__/storyEffectsTargets.test.ts:256-274` | 数据表消费面（四表并集 22／未消费 5） | 口径不同（白名单档 §"与在册邻居的分工"已点名），本档不重算 |
| `d48c2aa` → `colony-rockcluster-mismatch-20260924.md` | 贴图面三方不一致 | 本档只把它列为覆盖链末端的一格证据 |
| `docs/design/p1-4-manifest-authority-20260922.md`、`docs/design/registry-neutralization-design-20260924.md` | manifest 权威／registry 中性化设计稿 | 设计稿面，本档不改不裁 |
