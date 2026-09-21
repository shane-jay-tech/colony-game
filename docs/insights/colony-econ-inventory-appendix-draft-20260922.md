# colony 0905 经济参数清单 · 附录增补稿（c922-123，2026-09-22）

> 性质：**只读增补稿**。红线域（经济平衡数值）——**本稿零数值改动**，不改 `balanceConfig.ts`、不改 `buildings.ts`、不改 0905 原文（终检见 §〇.3）。
> 权威基线仍是 `docs/insights/economy-params-inventory-20260905.md`；本稿只做「逐键全表＋行号化＋账实差异登记」，**不替代**它。

---

## 〇、先报三件事

### 〇.1 任务前提已失效一条（重要，影响后续派单）

派单锚点 `colony-econ-params-audit-20260918.md:31` 称「0905 报告的参数清单表已过时（**缺 STORY_BALANCE 起始包**），建议日间重盘一次并入档」。

**盘上实测：该段已于 2026-09-20 由 c919-51 补入并入库**，不在途：

```
$ awk 'NR==19' docs/insights/economy-params-inventory-20260905.md
19: **故事模式 STORY_BALANCE（balanceConfig.ts:83-99，c919-51 补段，生成日期 2026-09-20）**
$ git log --oneline -1 -- docs/insights/economy-params-inventory-20260905.md
4a7bb16 docs(colony): STORY_BALANCE入档+饱和校准方案(c919-51,授权A3但零数值改动)——0905清单补STORY_BALANCE段…
$ git diff HEAD -- docs/insights/economy-params-inventory-20260905.md | wc -l   → 0（已入库，非在途）
```

⇒ 「为 0905 补 STORY_BALANCE 段」这件事**已经完成**，再做就是重复建设。审计档 `:31` 那句本身没错（它写于 9/18，补段在 9/20），**错在把 9/18 的口径当 9/22 的现值**——这正是该档 `:30` 自己要求的「日间立单」被隔了 4 天才接、却没重取前提。

**本稿据此把范围收窄为三项真缺口**（下面 §一/§二/§四），并保留任务书点名的「14 键全表＋buildings 散点行号化」两项——这两项补段里**确实没有**。

### 〇.2 计数口径必须先讲清（否则「14 键」这条判据字面不可满足）

`colony-storybalance-20260919.md:30` 称「STORY_BALANCE 全部 **14 键**」。盘上实测：**14 = 该档 §一 表格的行数**，而**标量叶子是 16 个**——因为 `time.msPerDay (1/2/3)` 那一行把 3 个值并进了 1 行（`colony-storybalance-20260919.md:20`），`startingResources` 在 0905 补段里同样被并成 1 行（`:23`）。

⇒ **凡拿「14」去 grep 计数或对表的单，一律会错位**。本稿 §一 同时给「14 行视图」与「16 叶视图」两栏，并逐叶标行号。

### 〇.3 零改动终检（先命令后数字）

```
$ git diff HEAD -- src/renderer/data/balanceConfig.ts            → 0 行（零漂移前提复验，同 storybalance 档 :39 的口径）
$ git diff HEAD -- src/renderer/data/buildings.ts                → 0 行
$ git diff HEAD -- docs/insights/economy-params-inventory-20260905.md → 0 行（原 0905 文件零触碰）
$ rg -n "SAVE_SCHEMA_VERSION = " src/renderer/state/saveLoad.ts  → 19: = 9（本稿不涉存档）
$ git diff HEAD -- src/renderer/state/__tests__/sandboxSimulation.test.ts src/renderer/state/__tests__/sandboxSnapshot.test.ts → 0 行
    ⇒ **未动 harness**：720 日终局的精确值锚（贪心 gold 6052／stone 4388、均衡 stone 9999／cloth 1499、milestone day41／161）
      不因本稿而变；本稿只在 §四 引用其归因链，不引用它来"凑好看"。
```

---

## 一、STORY_BALANCE 逐键全表（14 行 = 16 标量叶）

现值全部取自 `src/renderer/data/balanceConfig.ts:83-97`（`STORY_BALANCE` 定义体），逐行给行号；对照源为 `colony-storybalance-20260919.md:13-26`（c919-07 的 9/5 快照对照表）。

| # | 键（叶路径） | 源码行号 | 现值 | 9/5 快照 | 漂移 | c919-07 表行 |
|---|---|---|---|---|---|---|
| 1 | `startingResources.wood` | :86 | 100 | 100 | 无 | `:13` |
| 2 | `startingResources.stone` | :86 | 40 | 40 | 无 | `:14` |
| 3 | `startingResources.people` | :86 | 30 | 30 | 无 | `:15` |
| 4 | `startingResources.grain` | :86 | 320 | 320 | 无 | `:16` |
| 5 | `startingResources.gold` | :86 | 50 | 50 | 无 | `:17` |
| 6 | `startingResources.cloth` | :86 | 40 | 40 | 无 | `:18` |
| 7 | `startingResources.bronze` | :86 | 25 | 25 | 无 | `:19` |
| 8 | `time.msPerDay[1]` | :87 | 2000 | 2000 | 无 | `:20`（并行） |
| 9 | `time.msPerDay[2]` | :87 | 1000 | 1000 | 无 | `:20`（并行） |
| 10 | `time.msPerDay[3]` | :87 | 500 | 500 | 无 | `:20`（并行） |
| 11 | `event.minDaysBetween` | :88 | 40 | 40 | 无 | `:21` |
| 12 | `population.baseHousingCap` | :91 | 55 | 55 | 无 | `:22` |
| 13 | `population.growthRatePerDay` | :92 | 0.02 | 0.02 | 无 | `:23` |
| 14 | `population.minDailyGrowth` | :93 | 1.2 | 1.2 | 无 | `:24` |
| 15 | `population.homelessDeclineRate` | :94 | 0.02 | 0.02 | 无 | `:25` |
| 16 | `population.homelessDeclineMax` | :95 | 2 | 2 | 无 | `:26` |

**行数 = 14**（把 #8/#9/#10 折成 `time.msPerDay` 一行即与 c919-07 表逐行对齐）、**叶数 = 16**。c919-07 的 14 行**一条不缺、一条不多**，本表是它的**逐叶展开＋源码行号化**。

取用侧（不是数值，属接线，一并登记以免被当成"第 15 键"）：
- `getBalanceConfig(mode)` 定义在 `:100-102`，`:101` 为 `return mode === 'story' ? STORY_BALANCE : BALANCE;`——0905 补段 `:29` 记的「`:101`」正是这一行，**未漂**。
- 结构体 `BalanceConfig` 在 `:18` 注释声明「沙盒 BALANCE 与故事 STORY_BALANCE 共用，便于双表分离」。
- ⚠ **浅表覆盖事实**（做校验类单要先知道）：`STORY_BALANCE` 只写了这 4 个顶层分支，**未列的分支不从沙盒继承**——它是 `BalanceConfig` 类型的完整字面量，不是 spread 覆写。故「故事模式某分支缺省」与「沙盒某分支缺省」是两件事，别按"覆盖表"理解。

---

## 二、buildings.ts 产出行行号化散点（15 行全量）

任务书点名补「农田 12／用工 4／口粮 0.8」的**行号化**。完成标准命令原文：

```
$ rg -n "output|perDay" src/renderer/data/buildings.ts | head -20
13:    output: [{ resource: 'grain', perDay: 12 }],
19:      { condition: 'self.output.grain == 0', badge: 'badge_idle', priority: 10 },
24:      { partnerDefId: 'bld_well', range: 3, resource: 'grain', outputMul: 1.30, … },
25:      { partnerDefId: 'bld_water_mill', range: 3, resource: 'grain', outputMul: 1.20, … },
…
```

⚠ 该命令**同时命中 `badgeRules[].condition` 与 `adjacencyBonus[].outputMul`**，两类都不是产出。⇒ 拿 `rg -c "output"` 当"产出方条数"会虚高（实测命中远多于 15）。下面的表用**逐字段锚定**取数（`^\s{4}output: \[` 且非空），不是字面 grep 计数。

| 建筑 | id | `output` 行号 | 产出 | `cost` 行号 | 造价 |
|---|---|---|---|---|---|
| 农田 | `bld_farm` | **:13** | 粮 12/日 | :11 | 木20 + **人4** |
| 市集 | `bld_market` | :77 | **金 3/日** | :71 | 木30 石20 布5 人4 |
| 伐木场 | `bld_woodcutter` | :105 | 木 8/日 | :100 | 石10 人2 |
| 采石场 | `bld_quarry` | :125 | 石 6/日 | :123 | 木15 人3 |
| 锡矿 | `bld_tin_mine` | :145 | 锡 2/日 | :143 | 木15 石8 人3 |
| 陶窑 | `bld_pottery_kiln` | :164 | 金 2/日 | :162 | 木12 石8 人3 |
| 织官 | `bld_loom_house` | :189 | 布 4/日 | :186 | 木30 石15 人8 |
| 铜冶坊 | `bld_smithy` | :216 | 铜 3/日 | :213 | 木25 石25 人5 |
| 祖庙 | `bld_ancestor_shrine` | :244 | 礼 2/日 | :241 | 木40 石30 人3 |
| 驿道 | `bld_post_road` | :348 | 金 2/日 | :345 | 石20 人6 |
| 水碓 | `bld_water_mill` | :371 | 木 6/日 ＋ 粮 3/日（**双产出**） | :368 | 木30 石25 人3 |
| 冶铁坊 | `bld_iron_forge` | :397 | 铜 4/日 | :394 | 木30 石30 铜5 人5 |
| 桑园 | `bld_mulberry_grove` | :423 | 布 2/日 | :421 | 木15 人4 |
| 麻田 | `bld_hemp_field` | :443 | 麻 3/日 | :441 | 木12 人2 |
| 太庙 | `bld_grand_temple` | :664 | 礼 2/日 | :661 | 石100 铜40 礼30 金60 人10 |

农田三元组的行号落点（任务书点名）：

| 要素 | 值 | 权威位置 | 备注 |
|---|---|---|---|
| 产出 12 粮/日 | `perDay: 12` | `buildings.ts:13` | 结构化字段 |
| 用工 4 民 | `people: 4` | `buildings.ts:11`（在 `cost` 里，**不是**独立的"用工"字段） | ⚠ 见下 |
| 口粮 0.8 粮/农/日 | `0.8` | **不在 buildings.ts**，在 `populationClass.ts:39` 的 farmer 供养额 | 0905 `:33` 记的 `populationClass.ts:38-45` 段 |

⚠ **口径提醒**：农田的「用工 4」是**造价里的 people 支出**（`cost: { wood: 20, people: 4 }`），buildings.ts **没有**独立的 workforce/labour 字段。0905 `:40` 那句「农田 12 粮/日，**占 4 农**（4×0.8=3.2 粮/日）→ 净 +8.8」把造价 4 人当常驻占用人口用，链路推演成立，但**字段语义上 `cost.people` 与"占用农位"不是同一回事**。要立「用工」类判据请先确认取哪一个（本稿不改，只登记）。

---

## 三、与 c919-07 表逐键一致（抽 3 键，命令内联可复跑）

抽取原则：跨三个顶层分支各取一（资源／人口／事件），且 `minDailyGrowth` 选它是因为它**只存在于故事表**、最容易在重盘时被漏。

```
$ # K1 startingResources.grain
$ awk 'NR==86' src/renderer/data/balanceConfig.ts | grep -o "grain: [0-9]*"   → grain: 320
$ awk 'NR==16' docs/insights/colony-storybalance-20260919.md
  | startingResources.grain | 320 | 320 | 无 |                                ✓ 一致

$ # K2 population.minDailyGrowth
$ awk 'NR==93' src/renderer/data/balanceConfig.ts                             →     minDailyGrowth: 1.2,
$ awk 'NR==24' docs/insights/colony-storybalance-20260919.md
  | population.minDailyGrowth | 1.2 | 1.2 | 无 |                              ✓ 一致

$ # K3 event.minDaysBetween
$ awk 'NR==88' src/renderer/data/balanceConfig.ts                             →   event: { minDaysBetween: 40 },
$ awk 'NR==21' docs/insights/colony-storybalance-20260919.md
  | event.minDaysBetween | 40 | 40 | 无 |                                     ✓ 一致
```

抽 3 键**全等**，且 §一 是 16 叶全表逐键比对，同样全等（漂移列 16 个「无」）。

---

## 四、账实不符登记（两处，性质不同，勿混）

### 四.1 【原始算错，非漂移】「产出方 12 条」

0905 `:35` 称「**产出方 12 条**」，但其**同句自己列了 14 个名字**（农田、伐木、采石、锡矿、陶窑、桑园、麻田、织官、铜冶坊、冶铁坊、市集、驿道、水碓、太庙），盘上真值 **15**：

```
$ rg -c "^    output: \[\{" src/renderer/data/buildings.ts            → 15
$ git show cc9c378:src/renderer/data/buildings.ts | grep -c "^    output: \[\{"  → 15
$ git show cc9c378:src/renderer/data/buildings.ts | grep -c "^    id: 'bld_"     → 35
$ grep -c "^    id: 'bld_" src/renderer/data/buildings.ts                        → 35
   （cc9c378 ＝ 0905 之前最后一次触及 buildings.ts 的提交）
```

⇒ **不是后来加了建筑**：9/05 当时盘上就已是 15 条产出／35 栋。12 这个数**在写下的那天就不对**，且与该档自己的 14 名列举冲突。差额最可能出在双产出建筑 `bld_water_mill`（木6＋粮3，`:371`）被按"1 条"或"2 条"不同口径重复／漏计。**属基线档的字面错误**，修正需回写 0905 原文＝**越出本单边界**，登记交人工。

### 四.2 【真实漂移，已被后续提交改掉】市集 金 5 → 金 3

0905 `:35` 记「市集(金**5**,布5+粮3维持)」，盘上 `buildings.ts:77` 现为 **金 3**：

```
$ awk 'NR==77' src/renderer/data/buildings.ts
    output: [{ resource: 'gold', perDay: 3 }],
$ git log --oneline -S "resource: 'gold', perDay: 3" -- src/renderer/data/buildings.ts
e7cecd3 balance(colony): 市集金5→3饱和校准(c919-51 apply 单)——720日贪心 gold 9999→6052 不再触顶,
        saturatedResources ["wood","gold"]→["wood"]（方案验收"≤1项"达标）
```

⇒ 这条**是有授权的真实调参落地**（c919-51 的 apply 单），不是码错。它同时把 720 日贪心终局的 gold 从 9999 触顶压到 **6052**——与本分区在册的精确值锚**同向吻合**。0905 原文写于该改动之前，故其「金5」对 9/05 时点为真、对今日为陈旧。**回写同样属人工域**（经济数值）。

**两处的处置差异必须分清**：四.1 是「从来没有对过」，改它不需要追溯任何历史；四.2 是「曾经对、后来被合法改掉」，改它要绑 `e7cecd3` 作归因。**别把四.1 也写成"漂移"**，那会让下一次重盘又找一个不存在的变更提交。

---

## 五、出口（交人工/规划裁决，本稿不代选）

1. **`colony-econ-params-audit-20260918.md:31` 这条待办是否直接关单**：它要求的「重盘并入档」已由 c919-51 的 `4a7bb16` 完成，剩下的只有 §一（逐叶行号化）、§二（buildings 行号化）、§四（账实差异）。关单／改述／保留，请拍。
2. **§一 的逐叶表要不要真并入 0905 原文替换现有 7 行补段**？本稿是**增补稿**，两种收口方向相反：(a) 0905 保持精简＋指向本稿；(b) 用本稿 §一 覆写补段。选 (b) 要动 0905 原文，**属越界**，需授权。
3. **§四 两处账实不符是否开一单只读回写**（含"绑 commit 归因"的写法），以及 0905 `:35` 那段无行号的建账户是否整体行号化（该段还含住房/仓储/军事面，本稿只做了产出方 15 行）。
4. **§二 末「用工」字段语义**要不要立判据：若要，得先拍 `cost.people`（造价一次性支出）与 0905 `:40` 推演里"占 4 农"（常驻占用）是否同物——**这条会牵动链路推演的复算口径**，不是文档改动。
