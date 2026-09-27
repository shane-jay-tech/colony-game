# c927-20 · 万级人口压力样本构造方案设计（两路线对比 · 只出设计）

> 班：`qoder-executor-20260927-1915-colony42`（信箱波次 26 只读采集子班）｜设计时刻 2026-09-27 19:2x
> 基线：colony-game HEAD `d3f29d4`｜锚点：`done/20260925-154157-918a.result.md` 遗留 1「万级人口压力样本未做（需构造 save 注入或放宽 cap 的测试钩子，属写码需放行）」
> 🔴 **本件是设计稿**：不落实任何代码、**不改 cap、不改任何平衡值、不动测试配置/超时**；所有"脚本草案"是伪码，未落盘、未执行。

## 0. 先否证一半前提（这决定了推荐方向，必须先说）

918a 给的两句背景，盘上实测一句准、一句不准：

| 918a 的说法 | 磁盘实况 | 结论 |
|---|---|---|
| 「720 日上限受住房 cap 约束在 140 封顶量级」 | 住房 cap＝`baseHousingCap`(45) ＋ Σ`housingCapacity`，而**全仓只有 2 栋建筑带 housingCapacity**：`bld_house` 10（2×2 格，`buildings.ts:47-60`）、`bld_palace` 30（4×4 格，`:298-316`）；求解点 `gameStore.ts:474-479 getHousingCap()` | 准（当前 harness 确实撞 cap） |
| 「放宽 cap 的测试钩子」可作为到万级的一条路线 | **到不了**：`people` 另有一道与 cap 无关的硬顶——`GameStore.RESOURCE_CAP_BASE = 9999`（`gameStore.ts:631`），且 `getResourceCap('people')` **直接 return 基数**、不吃仓廪加成、也没有任何修饰键接在这道上（`gameStore.ts:639-640`） | 🔴 **不准（数量级差在别处）**：cap 提到 200 也只是把 140 的天花板抬到 200；人口轴的真天花板是 9999，且 `setResourceClamped` 逐笔 `Math.min(cap, …)`（`:655-658`） |

**⇒ 由此得本档第一结论**：「万级（≥10,000）人口」在 `resources.people` 这根轴上**当前不可表达**（会被截到 9999）。
压力样本必须先定义"万级"落在哪：**(P1)** people 封顶 9,999（=9999 口径，非字面万级）；
**(P2)** `populationClasses` 合计 ≥10,000（阶层侧可真万级，但会与该轴每日归一打架，见 §1.3）；
**(P3)** "万级人口所需的城市体量"＝**建筑实例数上千**（真正吃 CPU 的是这条，见 §5）。
不点明选哪个，测出来的东西没有对应物。

## 1. 引擎里"人口"到底是什么（注入/钩子清单的地基）

1. **人口实体只有 4 个整数**：`state.populationClasses = {farmer, worker, soldier, scholar}`；`resources.people` 是第二根轴。
   ⇒ 单纯把人数放大到 10,000 **几乎不增加每 tick 计算量**（阶层循环是 O(4)）；每 tick 的成本全在 **O(建筑数)** 的循环上
   （`gameStore.ts:483/506/523/536/641/848/1014/1018/1651/1743/1896/2196` 逐条扫 `state.buildings`，
   加 `productionSystem.ts:123-148` 每栋再扫邻居 ⇒ 相邻加成那一段实际是 **O(N²)**：`computeAdjacencyMul` 对每栋每资源全表扫 partner，`:91-100`）。
2. **口粮算术让"万级农庄"在一张 80×80 图上不成立**（只作可行性算术，不评平衡）：
   `CLASS_CONSUMPTION.farmer.grain = 0.8`（`populationClass.ts:39`）⇒ 10,000 农＝8,000 粮/日；
   农田 `grain 12/日`、`cost.people 4`、2×2 格（`buildings.ts` bld_farm）⇒ 需 ≈667 农田＝2,668 格，再加 1,000 民居＝4,000 格，
   **6,668 > 6,400 格（`DEFAULT_MAP_SIZE = 80`，`gameStore.ts:311`）**；且存粮顶 9,999（×3 仓廪＝29,997）只够 3.7 天。
   ⇒ 万级样本天然只能是**"正在崩的那一态"**（饥荒/回落通道），不是稳态。样本要测哪条通道必须写明。
3. **两条归一/回落闸会把注入态往回拽（时间尺度要预先算）**：
   - 每日无条件 `people ← totalPopulation(classes)`（`gameStore.ts:2618-2621`，经 `setResourceClamped` ⇒ classes 合计 10,000 时 people 恒被钉在 9,999，**差 1 永不收敛**；此即 c927-16 双源案的现役表现）；
   - 超限回落**封顶 2/日**（`population.ts:96-105`：`min(ceil(overflow×0.02), 2)`）⇒ 9,999 → cap45 需 ~4,977 日，
     而存档时钟上限 `MAX_SAVE_CURRENT_DAY = 3,600`（`saveLoad.ts:22`）⇒ **回落路径在存档语义里跑不完**；
   - 缺粮时回落让位饥荒（`population.ts:89-96`：`grainStock <= 0` 先 `idle`，`grainStock >= dailyConsumption` 才走 overflow），饥荒率 `mild 0.02 / severe 0.05 / minimumPopulation 5`（`populationClass.ts:62-69`）⇒ 万级走饥荒通道掉得动，但会一路掉回个位数量级。

## 2. 路线 A：存档注入（把状态从"载入闸"后面塞进去）

### 2.1 两个子变体（同一目标，覆盖面完全不同）

| 子变体 | 形状 | 走到的闸 | 现成先例（照抄即可） |
|---|---|---|---|
| **A1 档内注入** | 造 blob → `deserialize()` → `store.replaceState()` | **全套**：版本判定／迁移链／`rngSeed`＋`eventHistory` 载荷性字段必存在／`currentDay` 区间／resources 有限数值／buildings shape／阶层解析／`replaceState` 的 modifier 复检 | `saveMatrix.test.ts:23-46`（`blobAt()` 手搓最小档 ＋ `realBlobAt()` 改版本）／`saveV9Fixture.test.ts:18-27`（`__fixtures__/save-v9.json` ＋ `structuredClone`） |
| **A2 内存注入** | 直接 `new GameStore(ee, Partial<GameState>)` 或 `store.replaceState({...})` | **零载入闸**（构造器只做 `Object.assign(makeDefaultState(), initialState)` ＋ people→farmer 兜底，`gameStore.ts:414-420`） | `tickPerf.test.ts:23-27`（现役性能闸门件就是用 `replaceState` 塞 pop 200 的） |

⇒ **A1 测的是"载入万级档"，A2 测的是"引擎跑万级态"**。两件事不是一件事，别用一件替另一件。

### 2.2 注入字段清单（逐字段：必填？会被改写吗？带 file:line）

| 字段 | 约束（v9 现值） | 注入时要知道的事 |
|---|---|---|
| `schemaVersion` | 必须 `== 9`；`>9` 直接拒载（`saveLoad.ts:388-393`）；`<9` 走 `runMigrations`（`:395-397`，迁移函数**原地改写 blob** ⇒ 必须 `structuredClone`，先例注记 `saveMatrix.test.ts:38-41`） | 别图省事写 8，会静默进迁移链、字段被改 |
| `state.rngSeed`／`state.eventHistory` | 🔴 **当版缺任一即拒载**（`saveLoad.ts:409-419`，「r5 B2 2026-09-27 用户裁决：载荷性字段缺失=拒载，不再静默回填」） | **这条比 918a 那晚新**：老设计稿若写"缺字段会回填默认"已失效，合成档必须显式带这两枚 |
| `state.currentDay` | `[0, 3600]`，越界 `SaveLoadError`（`saveLoad.ts:451-459`） | 见 §1.3：万级回落要跑 ~5,000 日 ⇒ 时钟装不下，样本不能设计成"等它收敛" |
| `state.resources` | 只验"全部是有限数值"，**载入路径不 clamp**（`saveLoad.ts:440-450`→`:465` 原样进 state） | ⇒ `people: 50000` **能进内存**，但首个 `tickDay` 的归一（`gameStore.ts:2618-2621`）会把它钉回 9,999。要测"载入瞬间的顶栏/快照"与"跑一天之后"是两个读数 |
| `state.populationClasses` | 每阶层取 `floor`、非有限或负→0，**无上界**；四者全 0 且 people>0 则整体给 farmer（`saveLoad.ts:600-615`） | 万级真值只能放这里（P2 口径） |
| `state.buildings` | `validateBuildingsArray`（`saveLoad.ts:762-820`）逐条：`defId` 非空串／`position.{x,y}` 整数／`status ∈ {idle,constructing,working,paused,derelict}`／`tier ∈ {1,2,3,4}`／`constructionProgress` 有限数（钳 [0,100]）／`modifiers` 为 string[]／`upgradingTo` 若给须非空串 | 🔴 **无数量上限、无 overlap 校验、不校验 defId 是否存在**（查不到时 `productionSystem.ts:126` 直接跳过该栋）⇒ 注入能造出"叠楼／幽灵楼"这种**生产不可达**的阵，P3 口径若不检查重叠，测的是不存在的形状 |
| `state.worldMap` | 给了走 `validateWorldMap`（`saveLoad.ts:221`），不给则按 `rngSeed` 重生成 80×80（`:430-433`） | P3（1,600 栋楼）要么自带一致地图，要么留空让其生成——但留空后**位置与地形可能互斥**（建造门槛不重算，载入不查） |
| `state.activeModifiers` | `replaceState` 逐枚 `validateModifierInstance`，非法即抛（`gameStore.ts:2835-2845`） | 想顺带来一枚 `country_population_cap add` 是可以的（见 §3 B0），形状合法即可过 |
| 落盘位（若真写文件） | 生产档目录＝`app.getPath('userData')/saves/<slot>.json`（`src/main/index.ts:158-166`，userData 被 `ensureDDrivePaths()` 指到 D 盘） | 🔴 **真存档目录 `D:/colony-game/user-data/saves` 一律不碰**；现成隔离先例＝`saveIoSemantics.test.ts:21` 「全程在内存 Map ＋ mock `window.colonyApi` 上做，不读写仓内 save/、不碰 D:/colony-game/user-data」（`:47`/`:58` 挂/摘替身） |

### 2.3 构造脚本草案（**伪码，未落盘、未执行**）

```
# 草案 c927-20-A：scripts/gen-pop-pressure-fixture.mts（与 scripts/gen-save-v9-fixture.mts 同款：字节确定、savedAt 钉常量）
1. base = structuredClone(__fixtures__/save-v9.json)                  # 51 个顶层键全字段档，白捡 shape 合规
2. mode = 参数(P1|P2|P3)：
   P1: state.resources.people = 9999; populationClasses 四值和 = 9999（farmer 为主）; grain = 顶格后 ×N 天份
   P2: populationClasses 合计 = 10_000（people 保持 9999）            # 专测双源归一与顶栏读数
   P3: 追加 1600 栋 bld_house（2×2 顺序铺满 80×80，逐格算 overlap，**必须自检重叠=0**）
       + housingCapacity ⇒ cap = 45 + 16000；cost.people 无（民居造价只有 wood/stone）
3. 校验回环：deserialize(gen()) 不抛 && validateBuildingsArray 自写重叠扫描 == 0 && sumHousingCapacity() 与预期一致
4. 落盘：仅 __fixtures__/pop-pressure-v9-<mode>.json（fixture，不是真存档）
```

### 2.4 路线 A 的影响面

- 新增件＝1 个 fixture 生成脚本 ＋ 1 枚（或 3 枚）fixture ＋ 1 个测试件；**生产码 0 改动**。
- 与在册夹具守护**同族**：`saveV9Fixture.test.ts` 钉的是"夹具与当版恒零迁移"，新档若字段不全会撞它吗？——不会（各钉各的档），但**若 `SAVE_SCHEMA_VERSION` 以后 bump，新档立刻变"老档"**，需同步（该件注释 `:12-15` 已把这条风险写清）。
- 反脆弱点：A1 合成档越"贴近真档"越依赖当版字段集（当前 v9 全字段 51 键），字段漂移＝用例红，属**期望的红**。

## 3. 路线 B：测试钩子放宽 cap（四种形状，侵入度递增）

| 形状 | 做法 | 生产码改动 | 能到多少人口 | 风险 |
|---|---|---|---|---|
| **B0 用既有修饰键放宽 cap**（最轻，且**完全在产线上合法**） | 注入一枚 `{target:'country_population_cap', op:'add', value: 9955}` 的 activeModifier（`getHousingCap()` 经 `applyModifiers` 读它，`gameStore.ts:474-479`） | **0** | cap → 10,000，但 `people` 仍被 9999 截（§0）⇒ 只解 cap、不解硬顶 | 修饰器有 `remainingDays`，样本要每日重灌或设长时限；且 `replaceState` 会复检（须形状合法） |
| **B1 `vi.mock` 数据模块** | 测试件里 `vi.mock('../../data/balanceConfig', …)` 把 `baseHousingCap` 换成 10_000 | **0** | 同 B0（cap 侧） | 仓内有先例（`StoryBar.test.ts:28` mock `data/storyChapters`；`BootScene.runtime-error.test.ts:30` mock `@/data`）⇒ 形状不新；但 vitest 按文件隔离，**mock 只在本件生效**，读数不可与其他件互推 |
| **B2 运行时改 `BALANCE` 对象** | `BALANCE.population.baseHousingCap = 10000`（`balanceConfig.ts:35` 是**未冻结**的普通导出对象） | **0** | 同上 | 🔴 不 `finally` 还原就污染同文件后续用例；且 `economyBalance.test.ts:32` 有 `baseHousingCap >= 起始人口` 类不变量——同文件复用即假绿/假红 |
| **B3 生产侧加"测试钩子"**（env / DEV flag / 导出 setter） | 在 `balanceConfig` 或 `gameStore` 开一条覆盖口 | **有（生产码）** | — | 🔴 全仓现状＝**无任何 env 覆盖层**（f127 在册实测：`rg "process.env"` 在 state 域 0 命中、`public/data` 不存在 ⇒ 配置面全是编译期常量）。开这条口是给生产码加面，超出本档授权，且与"经济平衡数值红线"直接相邻 |

⇒ **B 路线的全部形状都只动"住房上限"这一道闸**，而 §0 已证万级撞的是 `RESOURCE_CAP_BASE = 9999`。
真要按 B 推到字面万级，唯一办法是改 9999 或给 `people` 也接修饰键 —— **两者都是经济平衡数值/生产语义改动，属红线＋人工闸，本档不设计其实现**。

## 4. 两路线对比矩阵

| 维度 | A 存档注入（A1/A2） | B 放宽 cap（B0-B3） |
|---|---|---|
| 能表达"万级"吗 | **P2/P3 能**（阶层合计 ≥10,000；建筑实例上千）；P1 停在 9,999 口径 | **不能**（cap 与 9999 是两道闸，B 只解前者） |
| 生产码改动面 | 0（新增 fixture＋脚本＋测试件） | B0/B1/B2 = 0；**B3 > 0** |
| 测到载入闸（shape/版本/载荷字段/时钟区间） | **A1 是**；A2 否 | 否 |
| 状态在生产是否可达 | **多数不可达**（P2 的双源分裂态、P3 的满图楼阵、万级农庄缺地） ⇒ 必须在档里标"合成压力态，不代表可玩态" | 可达性较高（cap 提高＝多盖房，几何上 1,600 栋民居可铺满 6,400 格） |
| 可复算/可审查 | 高：fixture 是**字节确定的入库工件**，任何人 `deserialize` 即可复现 | 中：读数依赖 mock/改常量那一刻，容易被后人在同文件加用例时静默改变 |
| 腐烂风险 | fixture 与 `SAVE_SCHEMA_VERSION` 绑定，bump 时必须同步（有现成守护件先例可仿） | B1/B2 是"测试内魔法"，不改生产语义 ⇒ **可能长期没人知道 cap 被抬过** |
| 与在册门禁的摩擦 | 无 | B3 会新开出读取口，可能触 `modifierReadPortGate`／`storyEffectsTargets` 一族钉子（同 c927-17 §4.4 的"接线须同批改白名单"逻辑） |
| 对现有性能断言的影响 | **直接**（见 §5） | 间接（cap 变了，增长/回落路径变） |

## 5. 对现有性能断言的影响（判据点名的第③项）

现状盘点（全仓 ms 级性能闸门只有 **1 枚**）：

| 在册闸 | 现值 | 万级样本撞它的哪一条 |
|---|---|---|
| `tickPerf.test.ts:35` `expect(elapsedMs).toBeLessThan(30_000)`（300 日，pop 200，`:23-27` 用 `replaceState` 注入） | 基线耗时 **217 ms**（工作树版读数，取自 `docs/insights/colony-suite-timings-20260921.json`，mtime 2026-09-25 22:00、`gitHead 17b8498`，1 test/0.18% share） | 若把万级塞进**同一用例**，30s 闸的含义从"300 日×200 民"变成"300 日×1,600 栋"⇒ **闸门语义被悄悄改写**（相邻加成 O(N²) 是主要放大器，`productionSystem.ts:91-100/131`）。结论：**新用例另立，不改这条** |
| `vitest.config.ts` **无 `testTimeout`** ⇒ vitest 1.6 默认 5,000 ms/用例 | 现役重样本件靠显式第三参活：`sandboxSimulation.test.ts:264/282` 与 `sandboxSnapshot` 用 `120_000`，另一件用 `300_000` | 万级样本**必须显式给 timeout**，否则首跑即红；"给多大"＝新排定预算，属人工（本档不定值） |
| 套件慢尾在册预算 | `fullLifecycleLayerTriage` 33.1s(27.1%)＞`sandboxSnapshot` 19.0s＞`auditDeadExportsReadonly` 18.8s＞`sandboxSimulation` 16.8s，top3≈58%，123/157 文件 <100 ms（同一 json，工作树版） | 新增一件"秒级"样本即进 top5；`docs/insights/colony-de-slowtail-diagnosis-20260924.md` §0.1 已钉死口径：**这类秒数摆动多是负载量不是结构量**（并发污染），所以新样本的耗时读数须**独占窗复跑 ≥3 次**再入册，且**本波不跑全量**（并发窗） |
| `getState()` = `Object.freeze(structuredClone(this.state))`（`gameStore.ts:457-458`） | 1,600 栋 ≈ 每次克隆 1,600 对象 | harness 日循环里**每天都在调 `getState()`**（`sandboxSimulation.test.ts:100`）⇒ 克隆成本随建筑数线性放大；此路已有在册裁决件在管（`docs/insights/c927-01-deserialize-clone-adjudication.md`），本档不重复其结论 |

## 6. 推荐与反对（带理由，落不了地的一律不写）

- **推荐（按性价比）**：① **A2 起步**——在 `tickPerf.test.ts` 同件另立新用例（或新建 `popPressure.test.ts`），用现役 `replaceState` 注入面跑 **P3（建筑实例 1,600）＋ P2（classes 合计 10,000）** 两个形状，先拿到"ms/tick 随 N 的曲线"，因为它**零新工件、零生产码、复用在册隔离**。
  ② 再补 **A1**：若人工要看"载入万级档"这条闸（版本/载荷字段/时钟区间/shape），才值得多付 1 枚 fixture ＋ 1 个生成脚本；生成脚本照 `scripts/gen-save-v9-fixture.mts` 的字节确定套路。
  ③ **B0 可作为 A 的配套**（用既有 `country_population_cap` add 修饰符抬 cap），因为它**不改任何常量、不新增读取口**——但要先接受一条：它解不了 9999 硬顶。
- **反对**：
  - **反对 B3**（生产侧测试钩子／env 覆盖口）：给生产码开新面，且紧邻经济平衡数值红线；仓内现状是"配置全编译期常量"，开这条口等于改架构约定，不是加一个测试。
  - **反对 B1/B2 作为主案**：mock 或裸改 `BALANCE` 会让"压力样本的前提"只活在单个测试文件的运行期里，后人读数时看不见前提；若确要用，**必须 `try/finally` 还原**（B2 尤其，见 §3 风险列）。
  - **反对"把 9999 抬到 20000"来凑字面万级**：那是平衡值＋存档语义双红线，且 `sandboxSimulation.test.ts:256/276`、`tickPerf.test.ts:41`、`sandboxSnapshot` 一族钉子都钉着 `≤9999`——抬它会**故意翻一堆桩**，不在本设计范围。
  - 反对把万级样本塞进现有 `tickPerf` 用例（§5 第 1 行理由）。
- **无论选哪条，先要人工答的两题**（否则样本没有对应物）：
  (a) "万级"定义取 P1/P2/P3 哪个？
  (b) 样本压的是**性能闸门**还是**规则收敛性**（§1.3 的 2/日回落 vs 时钟 3,600 日上限）？——后一条在现有常量下**不可能跑完**。

## 7. 本单明确未做 / 复算命令

未做：未写任何脚本/fixture/测试件（§2.3、§3 全为设计）；未执行任何注入；未改 `baseHousingCap`／`RESOURCE_CAP_BASE`／`MAX_SAVE_CURRENT_DAY`／`SAVE_SCHEMA_VERSION`；未改任何 timeout 或 `vitest.config.ts`；未跑全量；未碰 `D:/colony-game/user-data/saves`；未还原/重建 w18 的 `loadGate.ts` 组、未改 `eventOrderingSnapshot.test.ts:295`。

```bash
cd D:/code/colony-game
# 硬顶与 cap 两道闸
grep -n "RESOURCE_CAP_BASE\|getResourceCap\|setResourceClamped(id, value" src/renderer/state/gameStore.ts | head
sed -n '474,480p;2616,2622p' src/renderer/state/gameStore.ts
# 住房容量来源只有 2 栋
grep -n "housingCapacity" src/renderer/data/buildings.ts           # :60 =10(2x2) / :316 =30(4x4)
grep -n "baseHousingCap" src/renderer/data/balanceConfig.ts        # :68 =45 / :91 =55(story)
# 回落 2/日 与时钟上限
sed -n '95,106p' src/renderer/state/population.ts ; grep -n "MAX_SAVE_CURRENT_DAY" src/renderer/state/saveLoad.ts
# 载入闸清单（§2.2 出处）
sed -n '405,419p;440,465p;600,615p;762,820p' src/renderer/state/saveLoad.ts
# 两条注入先例 + 隔离先例 + 唯一性能闸
sed -n '23,27p' src/renderer/state/__tests__/tickPerf.test.ts
sed -n '23,46p' src/renderer/state/__tests__/saveMatrix.test.ts
sed -n '18,30p' src/renderer/state/__tests__/saveV9Fixture.test.ts ; sed -n '19,23p;45,58p' src/renderer/state/__tests__/saveIoSemantics.test.ts
grep -n "toBeLessThan(30_000)" src/renderer/state/__tests__/tickPerf.test.ts
# 计时基线（工作树版，注意它本身是外部在途脏件）
PYTHONIOENCODING=utf-8 python -c "import json;d=json.load(open('docs/insights/colony-suite-timings-20260921.json',encoding='utf-8'));print([r for r in d['files'] if 'tickPerf' in r['file'] or 'sandbox' in r['file']]);print(d['gitHead'],d['regeneratedAt'])"
# 无 env 覆盖层（B3 的"新面"确证）
grep -rn "process.env" src/renderer --include=*.ts | grep -v __tests__ ; ls public/data 2>&1 | head -1
```
