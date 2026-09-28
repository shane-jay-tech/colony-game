# c927-60 · wood 出口 apply 单前置材料（模板核位 ＋ apply 任务书草案，零数值改动）

- 班次：`qoder-executor-20260929-0632-colony65`（cwd `D:\code\colony-game`，分支 `codex/architecture-hardening`，开工 HEAD `6bc186e`）
- 时刻：2026-09-29 06:5x +0800（`date` 实取）
- 性质：**前置材料**。经济平衡数值属红线 ⇒ 本班**未改任何数值、未动任何生产码/测试件**，只核设计稿与模板在位状态，并把 apply 单的**任务书写成可直投草案**（§3）。
- 前手来历：本枚曾被 `colony64` 领过（盘上零产出，骨架留档 `D:\code\tmp\handover-w74\colony64-c927-54-skeleton.result.md`），本班从零接手。

---

## 1. 模板核位（完成标准①）

### 1.1 设计稿本体：在位 ✓

| 项 | 读数 | 命令 |
|---|---|---|
| 路径 | `D:\code\colony-game\docs\design\wood-outlet-design-20260922.md` | `ls -la` |
| 大小／行数 | 15,013 B ／ **161 行**（与 c922-105 记载逐字相同） | `wc -l` |
| 工作树状态 | **干净**（`git status --porcelain -- <该件>` 零输出） | — |
| 入库提交 | `3144c15`（c922-105，9-22 03:36），此后无第二笔 | `git log --oneline -2 -- <该件>` |
| 章节骨架 | §一 现值锚点 / §二 接线点（含 §2.1 三条越界面、§2.2 决定性发现）/ §三 A、B 草案表＋叠加测算 / §四 720 日对照报告模板＋R1..R5 / §五 建议排程 4 步 / §六 零改动声明 | `grep -nE "^#+ \|^\| R[0-9]"` |

**四件套齐备判定**：①候选表（A 案 `:80`、B 案 `:95`）✓ ②接线点分析（`:45`、`:55`）✓ ③720 日对照模板（`:118`–`:148`，含主断言／护栏／不倒退／回读／翻桩登记／栋数为 0 作废／人工目检七件）✓ ④逐项回滚 R1..R5（`:140`–`:147`，明写禁止打包）✓。

### 1.2 锚点复点（HEAD `6bc186e` vs 设计稿记载的 `32f7693`）

设计稿自称「行号为 2026-09-22 @`32f7693` 现值」⇒ **7 天后有 3 处漂移、1 处路径歧义**，apply 单必须按下面这版行号写，不能照抄设计稿：

| 设计稿记载 | `6bc186e` 实测 | 判定 |
|---|---|---|
| `buildings.ts:105` 伐木场 `output wood perDay 8` | **105** ✓ | 未漂 |
| `buildings.ts:166` 陶窑 `consumes: { wood: 2 }`（全仓唯一 `consumes` 木耗） | **166** ✓ | 未漂 |
| `consumes` 五处 166/191/218/246/399 | **166 / 191 / 218 / 246 / 399** ✓ 逐字 | 未漂 |
| `upkeep` 木耗六处 217/306/398/557/665/719 | **217 / 306 / 398 / 557 / 665 / 719** ✓ 逐字 | 未漂 |
| `buildings.ts:371/:381/:385` 水碓（wood 6 + grain 3／`upgradesFrom: bld_woodcutter`／邻接 `outputMul: 1.20`） | **371 / 381 / 385** ✓ | 未漂 |
| `buildings.ts:102-104` c919-51「木 8→6 未落盘」现场注释；`:74` 金 5→3 校准注释 | **102** / **74** ✓ | 未漂（红线依据仍在位） |
| `policies.ts:81` `pol_loom_workshop`、`policies.ts:124` `pol_water_works` | **81** / **124** ✓ | 未漂 |
| `bld_loom_house:191` `consumes: { hemp: 2 }`（现网布唯一来源） | **191** ✓ | 未漂 |
| `resourceRegistry.ts:20` `'cloth', // 布（瓦房阶层需求）` | **20** ✓ | 未漂 |
| `buildingRegistry.ts:35` `BUILDING_REGISTRY = createBuildingRegistry(BUILDINGS)`（自动入表 ⇒ 新增出口建筑零代码） | **35** ✓ | 未漂 |
| `productionSystem.ts:142-147` 「B3：原料消耗（`consumes`）与维护合并进同一净额」 | **142-147** ✓（`consumes` 全文件仅命中 :142/:143） | 未漂 |
| `sandboxSimulation.test.ts:134` 算了 `counts` 却没打印／`:135`+`:140-143` `shortfallRes`／`:156-164` 选楼排序 | **133-134 / 135 / 140-143 / 156-165** ✓ | 未漂 |
| `gameStore.ts:629 RESOURCE_CAP_BASE = 9999`、`:643` 倍率取整 | **631** / **645** | 🔴 **漂 +2** |
| `schema.ts:44` `consumes?: ResourceCost` 字段已在 | **:83**（:44 现为 `ModifierInstance.stackable`） | 🔴 **漂 +39**（字段本身仍在 ⇒ 结论"零迁移"不变） |
| `schema.ts:70-106` `BuildingDef` 字段全集（民心直连不可行的依据） | `interface BuildingDef` 起点仍 **:70** ✓；A2 系数注释 `productionSystem.ts:157` → 现 **:162**（漂 +5） | 🟡 局部漂 |
| `productionSystem.ts`（设计稿只写裸文件名） | 真身 **`src/renderer/state/productionSystem.ts`**（另有同名测试 `src/renderer/state/__tests__/productionSystem.test.ts`） | 🟡 **路径歧义**，apply 单须写全路径 |

**§2.2 决定性发现复点（最关键一条）**：`grep -n "consumes" src/renderer/state/__tests__/sandboxSimulation.test.ts` ⇒ **零命中** ⇒ 「harness 选楼只看 `output`、不看 `consumes`」在 `6bc186e` 上**仍然成立** ⇒ A 案产出物**必须**落在短板集（`grain/cloth/rite/bronze`）内，且「新建筑栋数＝0 时本组作废」条款与人工目检步骤**都还得留着**。

**顺带复点（继承 c922-105 顺带发现，仍成立）**：`buildings.ts:102-104` 与 `e7cecd3` 共同引用的证据档 `D:\code\colony-game\docs\decisions\2026-09-20-colony-econ-and-jsdom-exec.md` **磁盘与 `git ls-files` 双路皆无**（`ls` No such file；`git ls-files \| grep -c "2026-09-20-colony-econ"` → 0）⇒ 「四组沙盒对照」原始档仍不可得，现只剩 commit message 正文。apply 单引用该结论时应注一句"原始档缺失，证据为 commit message"。

---

## 2. 基线数值（照录，非本班实跑）

本班**未跑** 720 日沙盒（该件在全量并跑下计时敏感，且单跑一次约 30-40 s 会随基线红件波动；更重要的是：**没有授权就不该产生"新基线读数"的口径争议**）。下表为引用值，apply 单开工时必须**自己实跑重取**：

| 组 | 引用读数 | 出处 |
|---|---|---|
| `[P0-1]` 贪心 | `finalDay 720 / finalBuildings 40 / gradeReached 1 / wood 9999 / stone 4388 / people 117 / grain 9894 / gold 6052 / cloth 0 / bronze 6 / rite 4`，`saturatedResources ["wood"]` | c922-105 §证据（9-22 实跑两次一致） |
| `[P0-1-diversify]` 均衡 | `finalBuildings 56 / gradeReached 2 / wood 9999 / stone 9999 / people 140 / cloth 1499 / bronze 0`，`saturatedResources ["wood","stone"]` | 同上 |
| 现环境差异 | 用例面自 9-22 已漂（9-27 实测 157 文件/1711 例；`6bc186e` 静态面 162 文件/1711 声明，见兄弟单 c927-55 §2），沙盒件本身自 `a203fb2` 等批次未被改动 | c927-42 档 ＋ 本班只读计数 |

---

## 3. apply 单任务书草案（完成标准②；**可整段粘进 `pending/` 或 `inbox/`，id 由规划侧定**）

> ⚠ 本班**未投递**、**未落地**：这是草案，等日间授权后由规划侧/主班投放。

```markdown
---
id: <规划侧分配>
model: <档位由 CLAUDE.md 定；本单属经济平衡域，建议不走 Flash 单判>
cwd: D:\code\colony-game
max_minutes: 45
---

## 任务
wood 消化口 A 案（薪炭窑 bld_charcoal_kiln）落地 apply 单——按 docs/design/wood-outlet-design-20260922.md
§三 A 案草案表与 §四 模板执行，前置量测步骤见本单「步骤 0」。

## 背景与锚点（行号 = HEAD 6bc186e 实测，已订正设计稿的 3 处漂移）
- 草案表：docs/design/wood-outlet-design-20260922.md §三 A 案（:80 起）
- 报告模板：同上 §四（:118-:148）；回滚粒度 R1..R5 同上 :140-:147
- 木源：src/renderer/data/buildings.ts:105（伐木场 wood perDay 8）；:371/:381/:385（水碓 wood 6+grain 3、
  upgradesFrom bld_woodcutter、邻接 outputMul 1.20）
- 木汇现状：:166 陶窑 consumes { wood: 2 } ＝ 引擎侧全仓唯一木料 consume；upkeep 木耗六处 :217/:306/:398/:557/:665/:719
- 装配链：src/renderer/data/schema.ts:83（consumes?: ResourceCost，设计稿写 :44 已漂）→
  src/renderer/data/buildingRegistry.ts:35（BUILDING_REGISTRY 自动入表）→
  src/renderer/state/productionSystem.ts:142-147（consumes 与 upkeep 合并进同一 rawUpkeep 净额、按栋数计）
- 上限源：src/renderer/state/gameStore.ts:631 RESOURCE_CAP_BASE = 9999（:645 倍率取整；设计稿写 :629/:643 已漂）
- 前置国策：src/renderer/data/policies.ts:81 pol_loom_workshop（出口 ①，零新增数据）
- 布语义现网唯一来源：buildings.ts:191 bld_loom_house consumes { hemp: 2 }
- 红线依据（不得反向）：buildings.ts:102-104 现场注释 ＋ commit e7cecd3 —— 方案项 1「木 8→6」单独落地
  即让 720 日贪心基线崩解（gradeReached 1→0、人口冻结 45、石/金归零）⇒ 本单严禁再动任何产出方数值
- 证据档缺失登记：docs/decisions/2026-09-20-colony-econ-and-jsdom-exec.md 磁盘与 git ls-files 双路皆无，
  「四组沙盒对照」只剩 e7cecd3 的 commit message 正文

## 做什么（顺序固定，一步一 commit）
- 步骤 0（只读量测，属测试件、零经济风险）：给 src/renderer/state/__tests__/sandboxSimulation.test.ts
  的 :133-134 已有 counts 加一行栋数分布打印（design §三 叠加测算式 8W+6M−(2K+2冶+4宫+3铁+3车+3太+6鼎)−6n
  的两边钉成实数）。禁改断言、禁改阈值。
- 步骤 1（需授权）：按草案表新增 A 案 def（buildings.ts 新增一个对象，位置在陶窑块之后）。
  字段草案值全部照 §三 A 案表：tier 2、cost { wood 25, stone 15, people 4 }、consumes { wood 6 }、
  output [{ cloth, perDay 1 }]、upkeep { grain 1 }、size {2,2}、assetKey bld_charcoal_kiln、
  upgradeRequires 走出口 ①（pol_loom_workshop）、不加 adjacencyBonus / badgeRules。
  ⚠ assetKey 需美术：无图时按现网占位/回退形态声明，不得新增 ResourceId（design §2.1 越界面）。
- 步骤 2：跑 §四 模板的基线/实验组对照，逐组填报告（一次一组，禁止打包）。
- 步骤 3：consumes 三档对照 2/4/6（R2 形态，每档一个 commit）。

## 数值变更逐项（本单允许被授权触碰的**全部**位点；未列者一律禁改）
| # | 文件:行（HEAD 6bc186e） | 键 | 现值 → 草案值 | 期望值来源 | 授权级 |
|---|---|---|---|---|---|
| 1 | src/renderer/data/buildings.ts（陶窑块后新增） | 整栋 def | 无 → 草案对象 | design §三 A 案表（c922-105 出稿，数值标「待授权」） | 🔴 日间授权 |
| 2 | 同上（新 def 内） | consumes.wood | — → 6（对照档 2/4/6） | design §三「核心旋钮」＋§四 三档试验 | 🔴 日间授权 |
| 3 | 同上（新 def 内） | output[cloth].perDay | — → 1 | design §2.2 短板集约束（产出必须落在 grain/cloth/rite/bronze） | 🔴 日间授权 |
| 4 | 同上（新 def 内） | cost / upkeep / tier | 草案 25/15/4、{grain 1}、2 | 参照 :162 陶窑与 :241 祖庙量级 | 🔴 日间授权 |
| 5 | src/renderer/state/__tests__/sandboxSimulation.test.ts :133-134 | 打印语句 | 无 → 一行 console 输出 | 步骤 0，属测试件、零经济风险 | 🟡 免授权（纯观测） |
| — | **严禁**：伐木场 :105 的 8、水碓 :371 的 6/:3、陶窑 :166 的 2、六处 upkeep、:74/:102-104 已定档校准、RESOURCE_CAP_BASE | — | — | 任一改动＝重新打开 c919-51 崩解风险 | ⛔ 红线，本单不含 |

## 验收（完成标准；全部先命令、后现值，逐字填 design §四 模板）
① 步骤 0 打印生效且不改变任何既有断言结果：npx vitest run src/renderer/state/__tests__/sandboxSimulation.test.ts
   → 两例仍绿、finalDay 720、`counts` 分布被打印出来。
② 主断言：两策略 `saturatedResources` 中 `wood` 均消失，且集合长度 ≤1（对齐 c919-51 口径）。
③ 护栏断言：`saturatedResources` 不得新增 stone/gold/cloth/bronze/rite 任一项（防"把饱和搬家"，
   B 案即因此挂起）。
④ 不倒退断言：gradeReached ≥1（贪心）／≥2（均衡）、finalPopulation ≥110、badResource == []、crisisCount == 0
   四项与**本单自取的基线**同档（c919-51 崩解教训的正面形式）。
⑤ 回读断言：npx vitest run src/renderer/data/__tests__/economyBalance.test.ts 全绿（e7cecd3 立过防回退桩）。
⑥ 栋数＝0 作废条款：若实验组里新建筑被建 0 栋 ⇒ **本组作废**，不得记为「不经济」（design §2.2：
   harness 只看 output 的失明面，本班 6bc186e 复点该件仍零 consumes 引用）。
⑦ 人工目检：npm run dev 手建 3 栋薪炭窑，看木库存斜率是否在 60 日内转负。
⑧ 门禁：npm run type-check exit 0；pre-commit 全量绿（⚠ 现途有一枚前手未归因测试件
   src/renderer/ui/__tests__/hudRefreshCost.test.ts 会让全量并跑因计时敏感而红 ⇒ 主班按其排程处理，
   执行班不得改它、删它或加白名单）。
⑨ 翻桩登记：若 economyBalance.test.ts / v08_j3_content.test.ts 因条目数变化而红，commit message 必须写
   「有意平衡变更＋原因」（e7cecd3 规矩）。

## 回滚点（各自独立 commit，禁止打包；design §四 :140-147）
- R1 撤 A 案 def：buildings.ts 删新增对象 → 回到本稿状态（1 commit 1 文件）。
- R2 只调 consumes 单键（2↔4↔6）：git checkout <基线hash> -- src/renderer/data/buildings.ts。
- R3 只换 output 资源（cloth↔gold）——⚠ 换 gold 即踩 §2.2「模拟测不到」坑，须在报告里注明。
- R4 只换 upgradeRequires 前置（pol_loom_workshop ↔ 新国策 pol_charcoal）。
- R5 B 案整体（若放行，独立于 A，不共用 commit）。
- 全部不动 SAVE_SCHEMA_VERSION ⇒ 任一 R 单独可 revert，revert 后老档仍可开（design §二 论证：
  新增 def 不触存档结构，老档没这栋楼即不解锁）。

## 禁止事项
- ⛔ 经济平衡数值：未列入「数值变更逐项」表的一位都不许动；表内各位也**必须有日间授权记录**才可动。
- ⛔ 不得单调伐木场/水碓等任何产出方数值（c919-51 双证：buildings.ts:102-104 ＋ e7cecd3）。
- ⛔ 不得新增 ResourceId、不得给 BuildingDef 加 modifier/民心直连字段、不得加季节冷需求（design §2.1 三条越界面）。
- ⛔ 不得 bump SAVE_SCHEMA_VERSION；若发现必须 bump ⇒ 停手落 partial 交回（属存档兼容硬触发面，需 GPT 独立复核）。
- ⛔ 禁 git push；脏工作树禁 git add -A/-u/.，只按精确路径 add；不得为 hudRefreshCost.test.ts 写白名单。
- ⛔ 结论只出材料：资金/统计/平衡结论不下定判，须 GPT 或人工复核。
```

---

## 4. 待授权 / 待人工项（本班不代定）

1. **A 案语义取舍**（设计稿 §三 明写「此取舍请 GPT/人工复核时重点看」）：现网布的唯一来源是织官（`bld_loom_house:191` 耗麻），薪炭窑产布＝「以炭易布」的**贸易抽象**而非新产线；若判不贴，替代是产 `gold`——但那会踩 §2.2「模拟测不到」的验收失明面。
2. **解锁前置**：出口 ①（复用 `pol_loom_workshop`，零新增数据）vs 出口 ②（新建 `pol_charcoal`，加政策树节点，须产品拍板）。
3. **B 案挂起**：均衡策略下 `stone` 已顶 9999 ⇒「木→石」＝把饱和搬家；B2/B3 分别与铜冶坊（`:218`）、祖庙（`:246`）抢定位。
4. **`consumes` 档位**（2/4/6 三档）最终选哪档：属平衡决策，须由平衡方定；本班只提供实验模板与断言形状。
5. **是否给 harness 加「sink 优先」信号**（design 遗留 ④）：能把"测不到"变成自动覆盖，但那是测试件行为改动，另立单。
6. **`docs/design/OPTIMIZATION_BACKLOG.md` 的 P3-5 残余句回写**（"留 P2-2 加薪炭/建材出口"现可由 A 案接续）：⚠ 该件此刻是**未归因在途 ` M`** ⇒ 任何回写都要等它闭合，本班未动。
7. **证据档补建**：`docs/decisions/2026-09-20-colony-econ-and-jsdom-exec.md` 缺失是否补一份替代说明——交人工。

---

## 5. 零数值改动自证（完成标准③）

```
$ git status --porcelain -- src/renderer/data/ src/renderer/state/ src/renderer/systems/
（零输出 ⇒ 经济数值目录与状态层零 diff）
$ git diff --name-only src/renderer/data/ | wc -l   → 0
$ git diff --cached --numstat                        → 零输出（本班未 add 任何东西）
$ git ls-files --others --exclude-standard | grep -c ""   → 本班仅新增 docs/insights/c927-60-wood-apply-draft.md 一枚
$ grep -nE "perDay|consumes|upkeep" <被点名文件>      → 全部只读定位，无任何写形命令
```

未跑项（如实登记）：720 日沙盒实跑、`npm run type-check`、任何 vitest 跑动（§2 基线数为引用值）——**理由**：本单是"前置"性质，跑这些只会产出一个未经授权的新对照读数、并被误当成基线；apply 单开工时自己跑。

**必须同笔入库的件（给主班）**：只有 `docs/insights/c927-60-wood-apply-draft.md`（纯新增材料，零生产码耦合，可单独成笔）。§3 的草案文本若由规划侧投成 `pending/` 任务包，属信箱侧动作、不入库本仓。
