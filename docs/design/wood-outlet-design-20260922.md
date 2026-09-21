# colony 木材消化口设计稿（薪炭 / 建材出口）——c922-105，零数值落地

- 班次：`qoder-executor-20260922-0000-colony4`，2026-09-22 03:29 开工
- 性质：**经济平衡红线单**。本文件只出设计材料与只读取证，`src/renderer/data/` 一字未改（验收见末节）；后续数值落地须由日间授权另立 apply 单。
- 上游：`docs/design/OPTIMIZATION_BACKLOG.md` P3-5（已勾，残余「木材仍饱和，留 P2-2 加薪炭/建材出口」）、`docs/insights/colony-saturation-calibration-plan-20260920.md`（c919-51 四方案）
- 关键否证：**「调伐木场产出」这一方向不得再提**。`src/renderer/data/buildings.ts:102-104` 的现场注释与提交 `e7cecd3` 均记录：方案项 1（木 8→6）单独落地即让 720 日贪心基线崩解（`gradeReached 1→0`、人口冻结 45、石/金归零），故维持 8。

---

## 一、现值锚点（全部按磁盘实测，行号为 2026-09-22 @`32f7693` 现值）

### 1.1 木材供需账（唯一的木产出方 vs 全部木消耗方）

| 侧 | 建筑 | 日流量 | 锚点 | 字段 |
|---|---|---|---|---|
| 源 | 伐木场 `bld_woodcutter` | **+8 木/日** | `buildings.ts:105` | `output: [{ resource: 'wood', perDay: 8 }]` |
| 源 | 水碓 `bld_water_mill` | **+6 木/日**（兼 +3 粮） | `buildings.ts:371` | 伐木场升级链（`upgradesFrom: 'bld_woodcutter'` :381），邻接伐木场 ×1.20（:385） |
| 汇 | 陶窑 `bld_pottery_kiln` | **−2 木/日** | `buildings.ts:166` | **全仓唯一的 `consumes: { wood: 2 }`**（B3 原料引擎），换 +2 金（:164） |
| 汇 | 铜冶坊 `bld_smithy` | −2 木/日 | `buildings.ts:217` | `upkeep`（非 consumes） |
| 汇 | 王宫 `bld_palace` | −4 木/日 | `buildings.ts:306` | `upkeep: { grain: 10, wood: 4, gold: 4 }`，tier 3 |
| 汇 | 冶铁坊 `bld_iron_forge` | −3 木/日 | `buildings.ts:398` | `upkeep` |
| 汇 | 车工坊 `bld_chariot_works` | −3 木/日 | `buildings.ts:557` | `upkeep: { wood: 3, bronze: 1 }` |
| 汇 | 太庙 `bld_grand_temple` | −3 木/日 | `buildings.ts:665` | `upkeep: { gold: 5, wood: 3 }`，tier 4，前置 `pol_imperial` |
| 汇 | 九鼎 `bld_nine_cauldrons` | −6 木/日 | `buildings.ts:719` | `upkeep: { wood: 6, gold: 8 }`，终局物 |

另有**一次性**木汇＝各建筑 `cost.wood`（建/升级），本表不计入日流量。

> 结构性事实：**日流量唯一由 `consumes`（原料引擎）承担的木汇只有陶窑 1 个、2/日**，其余全是 `upkeep`；而上游两个产出方合计 14/日。P3-5 那句「金币饱和 9999→8780（沉没出口生效），木材仍饱和」正源于此——给金开了口、没给木开口。

### 1.2 上限与饱和现值（本单实跑，非引档）

命令（完成标准点名）：`npx vitest run src/renderer/state/__tests__/sandboxSimulation.test.ts`

```
[P0-1]           {"finalDay":720,"finalBuildings":40,"gradeReached":1,"finalResources":{"wood":9999,"stone":4388,"people":117,"grain":9894,"gold":6052,"cloth":0,"bronze":6,"influence":70,"rite":4},"saturatedResources":["wood"]}
[P0-1-diversify] {"finalDay":720,"finalBuildings":56,"gradeReached":2,"finalResources":{"wood":9999,"stone":9999,"people":140,"grain":8657,"gold":400,"cloth":1499,"bronze":0,"hemp":6308,"tin":3551,"rite":2956},"saturatedResources":["wood","stone"]}
```

- 上限源：`src/renderer/state/gameStore.ts:629 RESOURCE_CAP_BASE = 9999`（:643 按倍率取整，`people` 恒用基数）。
- ⚠ **任务书锚点已过期 1 处**：完成标准写「现值 `["wood","gold"]`」，实测是 **贪心 `["wood"]`、均衡 `["wood","stone"]`**。原因：c919-51 方案项 2（市集金 5→3）已于 `e7cecd3` 落盘、gold 现值 6052 不再触顶。**本设计稿一律按实跑读数立论。**
- 由此得两条硬约束：① wood 在**两种策略下都触顶**，是唯一双侧饱和的资源，出口必须开；② **stone 在均衡策略下也顶到 9999** ⇒ 任何「木→石」的建材出口在均衡路径上只是把饱和从木挪到石，属**假解**。

---

## 二、接线点分析（复用 P3-5 的 `consumes` 引擎，不新增引擎）

| 环节 | 现成的口子 | 位置 | 新增建筑要做什么 |
|---|---|---|---|
| 原料消耗结算 | `def.consumes` 与 `upkeep` **合并进同一净额** `rawUpkeep`，按栋数计 | `src/renderer/state/productionSystem.ts:142-147`（注释「B3：原料消耗」） | **零代码**：只在 def 里填 `consumes` |
| 字段合法性 | `consumes?: ResourceCost` 已在 schema | `src/renderer/data/schema.ts:44` | 零改动 |
| 注册表 | `BUILDING_REGISTRY = createBuildingRegistry(BUILDINGS)` | `src/renderer/data/buildingRegistry.ts:35` | 往 `BUILDINGS` 追加 def 即自动进表 |
| 美术 | `assetKey` 走 artManifest/BootScene 加载 | `bootLoadList.test.ts`、`artManifest.test.ts` 会扫 | **需 1 张成品图或声明沙印回退**（P3-1 已有麻田/锡矿回退先例） |
| 存档 | 新建筑只影响 `buildings[]` 数组实例，不加字段 | `saveLoad.ts` 的 buildings 校验 :708-748 | **零迁移、不必 bump `SAVE_SCHEMA_VERSION`**（老档没这栋楼＝不解锁而已） |

### 2.1 必须避开的三条引擎级诱惑（都属「新增引擎」，越界）

1. **不加新 `ResourceId`**（如「炭」「建材」）——`resourceRegistry.ts:11-30` 增键会连带顶栏（:35）、中间品行（:40）、clamp、存档校验、12 处枚举测试全改，且属经济结构变更。
2. **不做「民心维稳」直连**：`BuildingDef` 无 modifier 字段（`schema.ts:70-106` 全量字段为 cost/output/upkeep/consumes/adjacencyBonus/housingCapacity/classType），民心只有 `gameStore.ts:1455-1458` 的 `playerMorale` 调整口（由事件/古迹驱动）。⇒ 「薪炭窑稳民心」**只能借现有阶层需求间接表达**（见下 A 案），或另立「建筑 grants modifier」的引擎单（本单不推荐）。
3. **不给季节加冷需求**：`seasonSystem.ts:25 SEASON_EFFECTS` 是 modifier 通道，接木耗会牵动存档 v 位与国格链，属另案。

### 2.2 决定性发现：出口产出物必须落在 harness 的「短板集」里，否则模拟永远不会建它

`sandboxSimulation.test.ts:156-164` 的选楼逻辑**只看 `output`，不看 `consumes`**：

```
.filter((b) => store.isBuildingUnlocked(b) && affordable(...))
.sort: signatureIds 优先 → 均衡模式下 a.output.some(o => shortfallRes.has(o.resource)) ? 1 : 2 → tier 升序
```

而 `shortfallRes`（:135、:140-143）只收录 **grain / cloth / rite / bronze**（按下一档国格 `threshold` 判定缺不缺）。推论（**apply 单必须先验，别默认成立**）：

- 出口若产 **gold / stone**：优先级恒为 2，且 gold/stone 本就不在短板集 ⇒ 模拟里大概率**一栋不建**，`saturatedResources` 不会收敛，验收断言以「测不到」而非「不经济」失败。
- 出口若产 **cloth / rite / bronze**：在短板期被优先选中 ⇒ 木被真实吃掉，收敛可测。
- ⚠ 这条同时暴露**验收口径的失明面**：720 日模拟的收敛结论**依赖 AI 选楼启发式**，不等于玩家行为。人工验证仍需一条手建路径（设计稿第六节留了目检步骤）。

---

## 三、两个候选出口建筑（草案表；数值全为**待授权草案**，现值仅作参照）

### A 案 · 薪炭窑 `bld_charcoal_kiln`（推荐先行：改动面最小、可测性最好）

| 字段 | 草案值 | 依据 / 与现值的相对位置 |
|---|---|---|
| `category` / `tier` / `tierName` | 工坊 / **2** / 「薪炭」 | tier 2 卡在陶窑(T1)→水碓(T2) 之间，`upgradesFrom` 留空（独立新链，不动伐木链） |
| `cost` | `{ wood: 25, stone: 15, people: 4 }` | 参照陶窑 `{wood:12,stone:8,people:3}`（:162）与祖庙 `{wood:40,stone:30,people:3}`（:241），取中段。**建造成本本身就是第一道木汇** |
| `consumes` | **`{ wood: 6 }`** | 现值唯一木耗 `:166` 是 2；6 = 单栋抵掉 0.75 座伐木场。**这是本设计的核心旋钮**，见 §五 的三档试验 |
| `output` | **`[{ resource: 'cloth', perDay: 1 }]`** | 布＝瓦房阶层需求（`resourceRegistry.ts:20`），是 §2.2 短板集内**唯一与「御寒/薪炭」语义相邻**的现有资源；民心的间接表达即走阶层满足度→`buildingFactor`（`productionSystem.ts:157` 注释 A2） |
| `upkeep` | `{ grain: 1 }` | 与伐木场同量级（:106） |
| `size` / `assetKey` | `{2,2}` / `bld_charcoal_kiln` | 需 1 图或声明回退 |
| `upgradeRequires` | 出口 ①：复用 `pol_loom_workshop`（`policies.ts:81`）；出口 ②：新国策 `pol_charcoal`（工坊分支） | 现无「林政/薪炭」类国策（`policies.ts` 全量 id 实测无匹配）。**出口 ① 零新增数据、建议先走**；出口 ② 要给玩家叙事，但会加政策树节点，须人工拍板 |
| 不接线 | 无 `adjacencyBonus`、无 `badgeRules` 依赖 | 减少首批改动面 |

**语义自洽性说明（防止「布从哪来」的质疑）**：现网布的唯一来源是织官（`bld_loom_house:191` `consumes: { hemp: 2 }`，前置 `pol_silkworm`）。薪炭窑产布＝「以炭易布」的贸易抽象，不是新产线；若要更严格，可把 `output` 改 `gold` 但会踩 §2.2 的不可测坑。**此取舍请 GPT/人工复核时重点看。**

### B 案 · 建材坊 `bld_timber_yard`（后置：有把饱和搬到石头的风险）

| 字段 | 草案值 | 依据 / 风险 |
|---|---|---|
| `consumes` | **`{ wood: 8 }`** | 目标：1 栋抵 1 座伐木场 |
| `output` | 方案 B1 `{stone: 1}` ／ 方案 B2 `{bronze: 1}` ／ 方案 B3 `{rite: 1}` | **B1 已被本单实跑否证**（均衡策略 stone 9999，:1.2 读数）⇒ 只作对照保留。B2 与铜冶坊（`smithy`，锡→青铜 :218）抢定位；B3 与祖庙（铜金→礼器 :246）抢定位。**B 案三个出口都有重复建设问题，这是它排后面的实质理由，不是实现难度。** |
| `cost` | `{ wood: 30, stone: 40, people: 6 }` | 参照冶铁坊量级 |
| `tier` / 前置 | 3 / `pol_water_works`（`policies.ts:124`） | 高位建筑维护叙事 |
| 「供高位建筑维护」 | **本单不实现** | 「维护折抵」需给 `upkeep` 加减免通道＝引擎改动（§2.1）。现有可表达形态：靠 `adjacencyBonus` 给王宫/太庙加产出，语义不贴 |

### 叠加测算（与宫殿 / 太庙既有维护出口的合账，推演值）

设贪心终局 40 栋（实跑 `finalBuildings:40`），若其中 A 案 n 栋：

```
木净流/日 = 8·W_伐 + 6·M_碓 − (2·K_窑 + 2·冶 + 4·宫 + 3·铁 + 3·车 + 3·太 + 6·鼎) − 6·n
```

- 贪心 720 日 `wood` 稳定顶 9999 ⇒ 上式当前为**正**且余量足够大到触顶（`maxResource 9999`）。**具体余量本单测不出**：harness 只吐 `finalResources`，不吐各 `defId` 栋数（`sandboxSimulation.test.ts:134` 算了 `counts` 却没打印）⇒ apply 单第一步应是**打印栋数**（只动测试件、不动生产码），把上式两边钉成实数，再定 `consumes` 档位。这是本节最重要的可执行出口。
- 定性结论：`consumes` 从 2 → 6 的三档（2/4/6）× 栋数上限（不封顶 / `capOf` 限 3 栋）足以覆盖「从顶格 9999 收敛到非饱和」的参数面；不需要动任何产出方。

---

## 四、720 日沙盒对照实验报告模板（apply 单逐字填）

```markdown
### 实验 E-<n>（一次一组，禁止打包）
- 改动：<文件:行> <旧值> → <新值>（只允许 consumes/output/cost/upgradeRequires 四类键）
- 备份：`git rev-parse HEAD` = <hash>；还原命令 `git checkout <hash> -- src/renderer/data/buildings.ts`
- 基线（改前实跑）：`npx vitest run src/renderer/state/__tests__/sandboxSimulation.test.ts`
  - [P0-1]           saturatedResources = ["wood"]          wood=9999 stone=4388 gold=6052 cloth=0
  - [P0-1-diversify] saturatedResources = ["wood","stone"]  wood=9999 stone=9999 gold=400  cloth=1499
- 实验组（改后实跑，同一 commit 只差一处键）：
  - [P0-1]           saturatedResources = [<填>]  各资源终值 <填>  finalBuildings <填> gradeReached <填>
  - [P0-1-diversify] saturatedResources = [<填>]  各资源终值 <填>  finalBuildings <填> gradeReached <填>
  - 新建筑实际被建的栋数：<填>（＝0 时本组作废，属 §2.2 的「测不到」，不得记为「不经济」）
- 验收断言（草案）：
  1. **主断言**：两条策略的 `saturatedResources` 中 `wood` 均消失，且集合长度 ≤1（对齐 c919-51 的「收敛为 [] 或 ≤1 项」口径）。
  2. 护栏断言（防把出口做成新饱和）：`saturatedResources` **不得新增** stone/gold/cloth/bronze/rite 中任何一项。
  3. 不倒退断言（c919-51 崩解教训的正面形式）：`gradeReached ≥ 1`（贪心）与 `≥ 2`（均衡）、`finalPopulation ≥ 110`、`badResource == []`、`crisisCount == 0` 四项与基线同档。
  4. 回读断言：`npx vitest run src/renderer/data/__tests__/economyBalance.test.ts` 全绿（该族已在 `e7cecd3` 加过 2 例防回退桩）。
- 翻桩登记：若 `economyBalance.test.ts` / `v08_j3_content.test.ts` 因栋数/条目数变化而红，须在 commit message 写明「有意平衡变更＋原因」（`e7cecd3` 立的规矩）。
- 人工目检（§2.2 的 AI 启发式盲区）：`npm run dev` 手建 3 栋薪炭窑，看木库存斜率是否在 60 日内转负。
```

**逐项回滚粒度（硬要求）**：
- R1 撤 A 案 def（`buildings.ts` 删新增对象）——1 commit 1 文件，回滚即回到本稿状态；
- R2 只调 `consumes` 单键（2↔4↔6）——`git checkout <hash> -- src/renderer/data/buildings.ts`；
- R3 只换 `output` 资源（cloth↔gold）；
- R4 只换 `upgradeRequires` 前置（pol_loom_workshop ↔ 新国策）；
- R5 B 案整体（独立于 A，不共用 commit）。
- **禁止**把 R1-R5 或 A/B 案打包进同一 commit；任一 R 单独可 revert，且因不动存档结构，revert 后老档仍可开。

---

## 五、建议排程（交主班/规划侧）

1. 先做**只读量测**：给 harness 打印 `counts`（栋数分布）——这是把 §三 推演式变实数的前置，属测试件改动、零经济风险。
2. 再走 A 案 `consumes: 2/4/6` 三档对照（R1+R2 组合，每档一个 commit）。
3. B 案挂起，等 A 案结论与「礼器/青铜链是否被稀释」的判断一起做。
4. 本文档 §2.1 的三条引擎诱惑（新资源 / 民心直连 / 季节冷需求）若确有产品诉求，另立设计单，不混进 apply 单。

## 六、本单零改动声明

- 仅新增本文件；`src/renderer/data/` 及所有生产码零 diff（`git diff src/renderer/data/` 输出为空，见 result 取证）。
- 本单零测试改动；未跑 `--reporter=json` 之外的写侧操作；未动 `OPTIMIZATION_BACKLOG.md`（该件他班在途 M 态，本单只读引用）。
- 红线：经济平衡数值一律未动（本稿所有数字标为「草案/待授权」）。
