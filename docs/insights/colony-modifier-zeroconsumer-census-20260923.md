# colony 修饰注册表「四表零消费」5 键普查：预留位 or 死注册 · 2026-09-23

- 任务：`c923-06`　班：`qoder-executor-20260923-0022-colony3`　cwd `D:\code\colony-game`　开工 HEAD `c7171e9`
- 性质：**纯只读普查。零 src 改动、零数据表改动、零 value 读取**（键名与 op 面）。
- 上游：`c922-128`（9/22 交人工的两条数据侧观察之一）。本单**独立重跑**其判据，不复用其结论。

---

## 〇、红线声明（先说清楚本报告不含什么）

按「经济平衡数值红线（`CRISIS_*`／`SAVE_SLOTS`／产出消耗常数只作符号名引用，零读值零改值）」执行：

- 本报告**不含任何 effect 的 value 数值**，只含**键名、命中次数、有无读取口**。
- 普查过程中 `git grep` 的上下文行**可能**在终端瞬时带出过 `value: …`，**一律未采信、未抄录、未入档**。
- 「预留位」还是「死注册」是**数值/产品语义判断**，本单**不拍板**，只交证据矩阵 ⇒ status 见 result（按纪律：命中红线域只出只读报告）。

---

## 一、注册表现值：27 键（复核通过，与 c922-128 一致）

`src/renderer/data/resourceRegistry.ts:58-98` → `export const MODIFIER_TARGETS = [...] as const`，实测 **27 个键**：

```
python -c "import io,re; s=io.open('src/renderer/data/resourceRegistry.ts',encoding='utf-8').read();
m=re.search(r'export const MODIFIER_TARGETS = \[(.*?)\n\]', s, re.S); print(len(re.findall(r\"'([a-z_]+)'\", m.group(1))))"
→ 27
```

四表事实源（本机无 `rg`，`rg` 判据一律改 `git grep --no-index`；详见第五节坑）：

| 表 | 文件 | 条数口径（c922-128 锚，本单复核其存在性）|
|---|---|---|
| POLICIES | `src/renderer/data/policies.ts:24` `export const POLICIES` | 39 国策节点 |
| DECREES | `src/renderer/data/decrees.ts:20` `export const DECREES` | 12 政令／24 阶段 |
| STORY_EVENTS | `src/renderer/data/storyEvents.ts:19` | 35 事件 |
| 沙盒池 BASE＋EXPANDED | `events.ts:8` **私有** `const BASE_EVENTS`（无 export）＋ `eventsExpanded.ts:734` `export const ALL_EXPANDED_EVENTS` | 8＋40＝48 事件 |

⚠️ 复核 c922-128 发现 ①「派单把 BASE_EVENTS 当成可 import 的事实源，盘上它没 export」⇒ **仍成立、零漂移**（`events.ts:8` 就是模块私有；对外只有 `events.ts:276` 的 `EVENTS = [...BASE_EVENTS, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS]`）。⇒ 「沙盒 48」只能靠 id 集合反推，不能直接 import 数。

---

## 二、主矩阵：5 键 × 四表命中数（每行命令内联，可复算）

### 复算命令（一次跑全 5 行；`-c` 是**行数**口径）

```
for k in building_construction_cost building_efficiency building_upkeep \
         population_class_growth_gong event_negative_probability; do echo "--- $k"; \
git grep --no-index -c -F "$k" -- src/renderer/data/policies.ts src/renderer/data/decrees.ts \
  src/renderer/data/storyEvents.ts src/renderer/data/events.ts src/renderer/data/eventsExpanded.ts; done
```
**读数：5 个键全部「无输出」（rc=1）＝四表命中 0。** 下面矩阵里的 0 均由此命令现取。

| # | 键 | POLICIES | DECREES | STORY | events.ts | eventsExpanded | **四表合计** | 注册行 | 中文标签 | 运行时**读取**口 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `building_construction_cost` | 0 | 0 | 0 | 0 | 0 | **0** | :80 | `营建耗费` | **无** |
| 2 | `building_efficiency` | 0 | 0 | 0 | 0 | 0 | **0** | :81 | `建筑效率` | **无** |
| 3 | `building_upkeep` | 0 | 0 | 0 | 0 | 0 | **0** | :82 | `建筑维护` | **无** |
| 4 | `population_class_growth_gong` | 0 | 0 | 0 | 0 | 0 | **0** | :88 | `工匠增长` | **无** |
| 5 | `event_negative_probability` | 0 | 0 | 0 | 0 | 0 | **0** | :92 | `灾祸概率` | **无** |

⇒ **c922-128 的 5 键名单 100% 复现**（集合完全相同，无增无减），HEAD 已从 `bee6310` 推进到 `c7171e9` 仍零漂移。

这 5 键在**整个 `src/`** 里的全部落点只有三处，且**都不是消费**：
1. `resourceRegistry.ts` 的注册行本身；
2. `modifierDescriber.ts` 的中文标签行（纯 i18n）；
3. `data/__tests__/storyEffectsTargets.test.ts:269-270` —— c922-128 自己加的**反向钉子**（钉住"这 5 键无人用"，新增/删除即红）。

---

## 三、两对对称键配对行（任务书完成标准②）

| 对称对 | 未消费侧 | 已消费侧（四表命中分布） | 已消费侧有运行时读取吗 |
|---|---|---|---|
| **cost / speed** | `building_construction_cost` = **0** | `building_construction_speed` 四表合计 **1**（DECREES 1）＋ 运行时**生产者** `seasonSystem.ts:32/56` | **有** ⇒ `gameStore.ts:1003` 真读 |
| **negative / positive** | `event_negative_probability` = **0** | `event_positive_probability` 四表合计 **5**（POLICIES 3 ＋ DECREES 2） | **无**（见下，本单新发现） |

两对形态**并不对称**，这个差别是本案最有价值的部分：

- **cost/speed 对**是「**反向键尚未接入**」：speed 一侧从数据到运行时**全链路通畅**（`gameStore.ts:1003` 有 `applyModifiers(1, 'building_construction_speed', …)`），cost 一侧连一行数据都没有。⇒ 典型的**配平键只建了名、没接线也没填数**。
- **negative/positive 对**是「**整条机制不存在**」：`event_positive_probability` 有 5 行数据，但全 `src/` 里 `probability` 这个词**只出现在 `modifierDescriber.ts:44/45` 的两行标签里**——即**没有任何系统读事件概率**：
  ```
  git grep --no-index -nE "probability|Probability" -- src/renderer/state/ ':!src/renderer/state/__tests__'
  → 仅 modifierDescriber.ts:44,45 两行（标签）
  ```
  ⇒ positive 那 5 条国策/朝令 effects **写了也不落地**（静默无效），negative 则是连数据都空。

---

## 四、【本单新发现，超出 c922-128 范围】把「消费」拆成两层后，死的不止 5 键

c922-128 只做了**数据表层**（四表并集消费 22 键／5 键不消费）。本单补做**运行时读取层**，结论更重。

### 4.1 消费面是完全枚举的（不是抽查）

运行时读修饰符的**入口只有 4 个函数**：`applyModifiers`／`aggregateModifiers`／`getMulFactor`／`getAddDelta`（`modifierAggregator.ts`，其 `:81/:95` 用 `e.target === target` 做通用匹配）。全仓非测试调用点实测穷尽为：

| 读取点 | 传入的 target |
|---|---|
| `gameStore.ts:476` | `country_population_cap` |
| `gameStore.ts:1003` | `building_construction_speed` |
| `gameStore.ts:1228` | `country_morale` |
| `gameStore.ts:1232`, `:1923` | `country_military_power` |
| `gameStore.ts:1474` | `country_renown` |
| `gameStore.ts:2555` | `country_population_growth` |
| `gameStore.ts:1230`, `:1386` | `country_wrath` |
| `productionSystem.ts:184/185/191/192/271/275` | 经 `outputTargetFor`(:38-48) 映射的 7 个 `country_<r>_output` ＋ `consumptionTargetFor`(:50-55) 的 `country_grain_consumption` |

⇒ 有运行时读取口的键 = **15 个**（＝去重后的上表 target 集）。且**已排除动态拼键**：全 `src/` 的模板字面量里没有任何拼出 modifier target 的形态（实测 8 处 `` `${}` `` 均为 id/portrait/bgm 用途），所以这张表是**闭合**的。

### 4.2 于是「无运行时读取口」的是 **12 键**，其中 7 键数据面还很肥

| 键 | 四表合计 | 运行时读取 | 形态判读（证据，非裁决）|
|---|---|---|---|
| `country_research_speed` | **16** | **无** | 数据肥、只被生产不被读（`gameStore.ts:1783` 是 `addModifier` 生产者）⇒ **effects 静默失效** |
| `country_diplomacy_weight` | **36** | **无** | 同上（`seasonSystem.ts:59` 生产，无人读）|
| `event_positive_probability` | 5 | **无** | 机制整条不存在（第三节）|
| `population_happiness` | 3 | **无** | `gameStore.ts:2335` 只是造 effect |
| `population_class_growth_shi` | 4 | **无** | 与 gong/nong 三兄弟里只有它有数据 |
| `population_class_growth_nong` | 3 | **无** | 同上 |
| `building_output_area` | 1 | **无** | J-3 v0.8 后加键，未接运行时的痕迹明显 |
| `building_construction_cost` | 0 | 无 | **本单主案 5 键**：名已注册、数未填、线未接 |
| `building_efficiency` | 0 | 无 | 同上 |
| `building_upkeep` | 0 | 无 | 同上（注：建筑维护**确有**结算逻辑，但走 `consumptionTargetFor` 的 grain 专用路径，不读此键）|
| `population_class_growth_gong` | 0 | 无 | 同上 |
| `event_negative_probability` | 0 | 无 | 同上 |

**22 + 5 = 27 ✓（数据面）**；**15 + 12 = 27 ✓（运行时面）**。

### 4.3 判读（**不作为结论，交主班/人工拍板**）

- 主案 5 键：具备「**死注册**」的全部特征——注册行有、中文标签有、**数据 0、读取 0**，且唯一提到它们的地方是**一条防止别人忘记它们没用的测试钉子**。若是有意的预留位，`resourceRegistry.ts` 那 5 行**没有任何一处写了「预留」**（同文件 :94/:96 的 `country_renown`/`building_output_area` 反而带了 J-3 v0.8 的来历注释）⇒「无关注释的预留位」与「死注册」在盘上不可区分，**这正是需要补注释或退役的理由**。
- 但 4.2 里那 **7 个数据肥而无人读**的键，严重度高于主案 5 键：它们不是"预留"，是**玩家可得的国策/朝令效果正在静默失效**（尤其 `country_diplomacy_weight` 36 行、`country_research_speed` 16 行）。这条已越过"数据侧观察"，属**行为缺陷**，**本单不判不改**，仅登记。

---

## 五、本单踩到／复核的分区坑（留痕）

1. **本机无可用 `rg`**（只有交互式 alias）⇒ 完成标准①写的「四表 rg 命中数」一律改 `git grep --no-index -c -F`，命令已在第二节内联可复算。
2. **`git grep` 默认不查未跟踪件**，故必须 `--no-index`（纪律档 §十三 那条）；本单四表事实源均已跟踪，两种口径同值。
3. **`-c` 是行数不是出现次数**：同一行出现两次会被少数。故矩阵用 python `str.count()` 复核（两种口径在本案 5 键上都是 0，不冲突）。
4. **字符类计数坑**（纪律档 §十三：`[a-z0-9-]` 漏 camelCase）：本单**未使用任何字符类正则**做计数，全部走**定长字符串 `-F` 精确匹配** ＋ python `count()`，从源头规避。
5. `docs/insights/colony-orphan-commit-precheck-20260922.md` 等历史文档里的计数**本单未采信**（一律现取）。

---

## 六、完成标准逐条自评

| 标准 | 结果 |
|---|---|
| ① 矩阵 5 行每行含四表 rg 命中数（命令内联） | **达成**（第二节；`rg` 改道 `git grep --no-index` 已在第五节留痕）|
| ② 含两对对称键配对行 | **达成**（第三节，并给出两对**形态不同**的差别）|
| ③ `git diff --stat src` = 0（零 src 改动） | **达成（本班净改动为 0）**。⚠️ 本仓 `src/` 下有 **4 件他班在途 ` M`**（`MapRenderer.ts`/`BuildPanel.ts`/`saveLoad.test.ts`/`saveGuard3.test.ts`，即 c923-04/05 两单的被试件），`git diff --stat -- src/` 现读 **4 files / +56 / -6**，**与本单开工时逐字相同** ⇒ 本班净增 0。要"src 字面全 0"须先由主班处置那两族，非本单可达成 ⇒ 该条按实况收窄，见 result「证据」 |

## 七、遗留问题

1. **4.2 那 7 个「有数据、无读取」的键是否算在册缺陷**，需主班拍板（踩经济/数值语义红线，本单不判）。建议优先级**高于**主案 5 键。
2. 主案 5 键的处置（补「预留位」注释 vs 退役注册行）是二选一的产品决定；退役会**动 `MODIFIER_TARGETS` 计数**，而 `storyEffectsTargets.test.ts:269-270` 已把它钉成反向钉子 ⇒ **退役即触发该用例改判**，属"改计数口径"，按纪律须停手交人工。
3. `event_positive_probability` 的 5 条 effects **当前不产生任何游戏内效果**，玩家可见。若确认，这是内容/文案与实现的偏差，建议单开一单。
