# c927-05 · 负库存可从存档进门且无存量清扫（E1）裁决材料

> 班次 `qoder-executor-20260927-1520-colony39` · 2026-09-27 · **零产品码改动**（本 md 是本单在仓内的唯一产物）
> **红线声明**：本件属经济平衡数值域 ⇒ **只钉行为差异、不改任何平衡值、不选案**。卷宗正文写"推荐（原文：本件倾向②）"，
> 按本班派单口径，那句"倾向"**只当线索、不作依据**，故本档 §⑤ 给的是"裁决要回答的问题"，不是结论。
> 卷宗锚点：`zcode-bridge/outbox/20260925-120431-24b8.result.md` 遗留 1 ⇒ 按波次 19 brief §3a 从 **`done/`** 取到，锚点有效、无漂移。
> 取证方式：判据要求"零产品码改动"⇒ 现状用例**不落仓内测试件**，临时探针写在 `D:\code\tmp\qoder-executor-20260927-1520-colony39\`（`c927-05-cases.ts`／`c927-05-probe2.ts`／`c927-05-probe3.ts`），命令见 §⑦，**收班自清**。

---

## ⓪ 现状闸门口径一句话（读码结论，非推断）

`saveLoad.ts:440-448`（p911r-40 落地）对 `resources` 的闸**只验 shape**：

```ts
!Object.values(rawResources).every(v => typeof v === 'number' && Number.isFinite(v))  // :445
  → throw new SaveLoadError('resources must be a record of finite numbers')            // :447
const gameState: GameState = { resources: rawResources as GameState['resources'], ...  // :462 原样直传
```

负数是有限数 ⇒ **值域面零处理**，`:462` 把原对象直插状态。写侧闸门 `gameStore.ts:657 setResourceClamped`
（`Math.min(cap, Math.max(0, Math.floor(value)))`）**只在"有 delta 要写"时生效**，读档不经过它。

---

## ① 进门路径用例（实测，逐条可复跑）

### A · `resources` 载荷面（12 条，`deserialize` 实测）

| 载荷 | 实测裁定 | 读回值 | 有限 | 非负 | 整数 |
|---|---|---|---|---|---|
| `grain:-5000` | 🔴 **进门** | `{"grain":-5000}` | ✅ | ❌ | ✅ |
| `wood:-0.5` | 🔴 **进门** | `{"wood":-0.5}` | ✅ | ❌ | ❌ |
| `grain:-0` | 进门 | `{"grain":0}` | ✅ | ✅ | ✅ |
| `wood:12.7`（正小数） | 🔴 **进门** | `{"wood":12.7}` | ✅ | ✅ | ❌ |
| `gold:1e30`（有限超上限） | 🔴 **进门** | `{"gold":1e+30}` | ✅ | ✅ | ✅ |
| `gold:99999999`（超 cap 9999） | 🔴 **进门** | `{"gold":99999999}` | ✅ | ✅ | ✅ |
| `grain:-Infinity` | ✅ 拒载 | — `SaveLoadError: resources must be a record of finite numbers` | | | |
| `grain:Infinity` | ✅ 拒载 | 同上 | | | |
| `grain:NaN` | ✅ 拒载 | 同上 | | | |
| `grain:"-5"`（字符串） | ✅ 拒载 | 同上 | | | |
| `grain:null` | ✅ 拒载 | 同上 | | | |
| `grain:false` | ✅ 拒载 | 同上 | | | |

**三条要点的诚实修正（这三条会让裁判决策差一个量级）**：

1. **`NaN`/`±Infinity` 从磁盘根本不可达**：JSON 文本没有这三个字面量（`serialize` 写出的档里它们是 `null` 或被 `JSON.stringify` 改写）。
   ⇒ 现状那道 `isFinite` 闸**在档面上真正挡住的是"字符串/null/布尔"这类类型错**，而**档面可达的值越界族＝负数／正小数／超上限有限数，三条全部无闸**。
2. **`-0` 不构成一条独立风险**：`JSON.stringify(-0) === "0"` ⇒ 存档文本里永远读不到 `-0`（A 组 readBack 已是 `0`）。
   （对照既有钉桩 `priceBoundaryClamp.test.ts:66` 的 `wood:-0` 是**造价侧内存路径**，不是档面。）
3. **上限面同样无闸**（`99999999`/`1e30` 进门）⇒ 这不是"负数专属"缺陷，而是 **resources 整条值域面（≥0、整数、≤cap）三缺**；
   卷宗与锚点原文只写了"负数"，本档按磁盘实况把范围**拓宽并点名**，不收窄也不替它选案。

### B · 同族字段的闸门对照（证明 resources 是**孤立缺口**）

| 字段 | 位置 | 非法值行为（实测） |
|---|---|---|
| `productionCarry` | `saveLoad.ts:470` `s.productionCarry ?? {}` | 🔴🔴 **完全无校验**：`{grain:-0.7}` 原样进门；`{grain:"1.5"}`（字符串！）原样进门；JSON 面上的 `null` 也进门 ⇒ **比 resources 还宽一道**，本单新发现，锚点未提 |
| `populationClasses` | `saveLoad.ts:600-612` | ✅ 静默修正：`{farmer:-30,…}` → 该格归 `0`（`:608 v >= 0 ? Math.floor(v) : 0`），四格全 0 且 `totalPeople>0` 时回退 `farmer=totalPeople`（`:610-612`）；小数被 `Math.floor` |
| `conversionQueue` | `saveLoad.ts:616-632` | ✅ 逐单丢弃：`count<=0`／非有限／阶层名非法 → `continue`（不入队） |

### C · 进门之后会不会被"存量清扫"（实测逐日读数）

夹具：档面 `resources = {grain:-5000, wood:-0.5, gold:-1e30}`，`replaceState` 后连跑 `tickDay`。

| 格子 | 当日是否有写入 delta | 第 1 日读数 | 第 10 日读数 | 结论 |
|---|---|---|---|---|
| `grain`（有人口 ⇒ `computeClassConsumption.totalGrain=48/日`，走 `addResource`） | 有 | **0** | 0 | ⚠️ **第一天就被钳回 0**（锚点原文"带着负库存长跑"对这一格不成立） |
| `wood`（无消耗/无产出建筑） | 无 | -0.5 | **-0.5** | 🔴 永不自愈 |
| `gold`（同上，`-1e30`） | 无 | -1e+30 | **-1e+30** | 🔴 永不自愈 |
| `people`（档面 `-10`） | — | 0 | — | ✅ `replaceState` 的"占用制迁移"块（`gameStore.ts:2892-2899`）把 `people<employed` 补足；`-10 < 0` ⇒ 读档即置 0 |

配套两条实测（比"不清扫"更要命的行为形状）：

- **负格子上的第一次写入会把"收益"一起吞掉**：`addResource('grain', -1)` → `0`；`addResource('grain', +100)` → **也是 `0`**
  （`Math.max(0, floor(-5000+100))`）。⇒ 现状不是"负库存一直挂着"这么简单，而是**谁先碰它谁背这笔损失**。
- **负库存会被"合法存档"再生产**：`replaceState` 灌入负值后 `serialize()` → 落盘 JSON **仍含 `-5000`/`-0.5`**（`jsonHasNegative:true`）。
  ⇒ 玩家一次正常点保存，就把这个负值写进**正式槽位**，此后它在这份档里就是"存档本体的一部分"，不再是"损坏"。
- **超上限格子同样不自愈**：`gold/wood/stone = 1e30` 跑 1 日仍是 `1e30`（`getResourceCap('gold')=9999` 只在写路径生效）。

> 🔴 **自报一处本班自己踩的取证坑（重要，否则读数会被误用）**：
> 第一版探针（`c927-05-cases.ts` C 组）把阶层写成 `{farmer:60, soldier:0, artisan:0, merchant:0, scholar:0, slave:0}`——
> 真实阶层只有四个（`POPULATION_CLASSES = ["farmer","worker","soldier","scholar"]`），**缺 `worker` 键**。
> 于是 `computeClassConsumption` 返回 `totalGrain = NaN`（`c927-05-probe3.ts` 实测：`{"totalGrain":null}`＝JSON 里的 NaN），
> `gameStore.ts:2673` 的 `if (consumption.totalGrain > 0)` **恒假** ⇒ 吃粮支路静默跳过 ⇒ 我第一版读到"负粮跑 10 日仍是 -5000"，
> **那是夹具坏了，不是产品行为**。上表以修正后的 `c927-05-probe2.ts` 为准。
> 顺带登记一条与本案无关的旁证：阶层对象缺键时消耗量算成 NaN 且比较恒假 ⇒ 支路静默跳过；但 `deserialize` 恒产出完整四键对象（`:605`），**档面不可达**，只属内存/测试路径，故不另开立案。

---

## ② 两案对"老档"的行为差异矩阵（① 拒载 vs ② 钳制）

两案的落点与判据形状（**diff 草案形态，未落地**）：

```diff
# 案①：把 shape 判据从"有限"收紧为"有限非负"（saveLoad.ts:445 一行改谓词）
-    !Object.values(rawResources).every(v => typeof v === 'number' && Number.isFinite(v))
+    !Object.values(rawResources).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)
```

```diff
# 案②：deserialize 侧逐格钳制（saveLoad.ts:448 之后插入，与 :608 同形）
+  // 值域面钳制（负 → 0），与 constructionProgress(:796)/populationClasses(:608) 同口径，静默不拒载
+  for (const k of Object.keys(rawResources)) {
+    const v = rawResources[k];
+    if (typeof v === 'number' && v < 0) rawResources[k] = 0;
+  }
```

| 存档样本 | 现状（实测） | 案① 拒载 | 案② 钳制 | 两案共同点／缺口 |
|---|---|---|---|---|
| **S1** 合法老档 `{grain:120,wood:30,gold:5}` | 进门，原值 | ✅ 仍进门（`OK`） | ✅ 原值不变（`{"grain":120,…}`） | 无差异：**两案都不误伤合法档**（实测） |
| **S2** `{grain:-5000,wood:30}` | 🔴 进门 -5000 | 🔴 **整档拒载**：该槽读不开，面板 toast「该存档不存在或已损坏」（`SaveLoadPanel.ts:197`） | ⚠️ 进门，`grain` 变 **0**（玩家视角："我的粮凭空没了"） | 两者都改变玩家可见结果；**都不可自动回退**（②读一次即"洗白"，再保存就把 0 写回档） |
| **S3** `{wood:-0.5,grain:10}` | 🔴 进门 -0.5 | 🔴 拒载 | ⚠️ `wood` 变 0 | 同上 |
| **S4** `{gold:1e30}` | 🔴 进门（超 cap） | ✅ **仍进门**（`OK`，判据只管非负） | ✅ **仍进门**（只钳负） | 🔴 **两案都不解决上限面**（S4/S5 实测两案都放行 1e30） |
| **S5** `{gold:1e30,grain:-1}` | 🔴 进门 | 🔴 拒载（因 grain 负） | ⚠️ `{gold:1e+30,grain:0}` | ①会把"只欠上限"的档连带拒掉；②留着 1e30 |
| **S6** `{grain:-0}` | 进门＝`0`（JSON 面无 -0） | `OK` | `0` | **无差异**（该案不存在） |
| **S7** `{wood:12.7}`（正小数） | 🔴 进门 12.7 | `OK`（仍进门） | ⚠️ **仍 12.7**（②草案不管小数） | 🔴 **整数性两案都不管**（与 `:608` 的 `Math.floor`、`gameStore.ts:657` 的 floor 不同步） |
| **S8** 旧档缺 `resources` 字段 | 进门 `{}` | `OK` | `{}` | 无差异 |
| **非有限／字符串／null／bool** | ✅ 已拒载（现状） | ✅ 已拒载 | ✅ 已拒载 | **两案都不触及**（shape 闸已在） |

**矩阵之外、裁决必须知道的三条覆盖缺口（两案共同）**：

1. 🔴 **`productionCarry` 仍在闸外**（§①-B 实测：负数与字符串都进门）。carry 是**小数残差的本体**（fixture 里就有 `{"grain":0.2000000000000064}`）⇒ 对它不能照搬"非负"，需要单独口径。
2. 🔴 **案②只补 `deserialize`，不补内存路径**：`replaceState` 可在不经 `deserialize` 的情况下被灌负值（`gameStore.ts:2836-2838` 注释自称服务 quick-save／测试场景；实测 `rateDisplayBoundary.test.ts:105-122` 走的就是这条路）。本仓现状 quick-save **尚未接线**（`grep -rn "replaceState(" src` 只有 `SaveLoadPanel.ts:200` 一处产品码调用）⇒ 缺口目前是理论面，但案②别被读成"全线封死"。
3. ⚠️ **上限（`≤getResourceCap`）放不进案②的那个位置**：cap 依赖建筑里的仓廪数（`gameStore.ts:638-646`），而 `saveLoad.ts` 不 import `GameStore`（同文件外已有先例说明"导入会成环故就地声明"，见 `gameStore.ts:956-957`）。⇒ 若裁决要连上限一起收，需决定"就地声明基数 9999（口径与 gameStore 漂移风险）"还是"留在 gameStore 侧做一次读档后清扫"，这是**第三种形状**，不是①②之差。

---

## ③ 与既有 clamp 口径的一致性论证（卷宗点名引 saveGuard2／p911r-40 先例）

### 3.1 本仓 `deserialize` 的实际分工定律：**shape/类型错 → 拒载；值域越界 → 静默钳制（不打日志）**

`constructionProgress`（`saveGuard2`，p911r-40，`e56d82a`）是这条分工最干净的样板（`saveLoad.ts:791-796`）：

```ts
if (typeof rawProgress !== 'number' || !Number.isFinite(rawProgress)) throw new SaveLoadError(...) // :792-793 类型 → 拒载
const progress = Math.min(100, Math.max(0, rawProgress));                                          // :796 范围 → 静默钳制
```

⇒ **`-50` 与 `1e9` 都不拒载，被钳到 `[0,100]`**（既有裁决档同口径记账：`docs/insights/c927-02-validator-msg-split-adjudication.md:69`
「这条消息只管类型不管范围……范围面被 `:796` 静默钳制（`p911r-40` 注释为刻意设计）」）。

### 3.2 同族先例清点（全部在 `saveLoad.ts` 同一个反序列化路径内，现取命令见 §⑦）

`Math.max(0` 在本文件出现 **25 次**；抛 `SaveLoadError` **43 处**。两者并存但有明确分工：

| 先例 | 位置 | 越界处理 | 与 resources 的关系 |
|---|---|---|---|
| `constructionProgress` | `:792`（类型拒）＋`:796`（范围钳 `[0,100]`） | 静默钳 | **案②就是把这一档补到 resources 上**；案①则是把范围塞回类型判据 |
| `populationClasses` | `:608` `v >= 0 ? Math.floor(v) : 0` | 静默归零＋取整 | **与案②完全同形**（非法值→0），是本仓最贴近的先例；且它连小数一起管 |
| `conversionQueue` | `:626-627` | 逐单丢弃 | 值域非法 → 丢条目，不整档拒载 |
| `lastEventDay` | `:474` `Math.max(0, Math.min(v, currentDay))` | 静默钳 | 同为"上限取自同档另一字段"的先例 |
| `playerMorale`/`playerMilitaryPower`/`publicWrath`/`worldWariness` | `:496-503`、`:533-534`（含 `clampSentiment`/`clampWariness`） | 静默钳到区间 | 同口径 |
| 各 `*Day` 计数（`lastWrathDemandDay`/`lastPropagandaDay`/`endgameAscendDay`/`wrathUltimatumEndDay`…） | `:500-531` `Math.max(0, Math.floor(...))` | 静默钳＋取整 | 同口径 |
| `dualZeroDays`/`crisisRecoverDays`/`crisisCount`/`grainNegativeDays` | `:541-556` | `Math.max(0, Math.floor(...))` | **注意 `grainNegativeDays` 是"缺粮天数计数器"，不是负库存**（见 3.4） |
| `storyFlags` 双轴 | `:582-592` `Math.max(-100, Math.min(100, …))` | 静默钳 | 同口径（允许负值的字段会**显式写清** `-100..100`，与库存的"非负"语义区分开） |
| `npcCountries` | `:734-747` | 静默钳 | 同口径 |
| `finiteNum(v, fallback)` | `:715` | **非有限也不拒载，直接回默认值** | ⚠️ 与本闸相反：说明"非有限"在本仓**有两套并存口径**（拒载 vs 回默认），这不是本单要裁的，但裁①时要意识到"拒载"并非全仓唯一惯例 |
| 读档期**存量改写**先例 | `gameStore.ts:2892-2899`（people 补足到已占用劳力）、`:2901-2904`（季节 modifier 强制重建） | 读档即静默修改状态 | ⇒ "在载入路径上把玩家状态改到自洽"**本仓已经在做**，不是案②新发明的动作 |

### 3.3 一致性结论（只报口径归属，不报推荐）

- **案②（钳制）**：与 §3.2 的 `:796`／`:608`／`:474`／`:500-534`／`:626` **同族同形**，是"把 resources 补进本仓既有分工里缺的那一档"；
  副作用是与那一条 `SaveLoadError` 消息**继续不同步**——`resources must be a record of finite numbers` 描述的仍是 shape 判据（案②不动它）。
  与案①相比它**不产生新的不可读档**，但会把"玩家以为有的粮"在载入瞬间静默改掉（S2/S3 实测），且**不留日志**（丙判据「错误有日志」在 24b8 E4 已被否证：本链路 `console.*` 零命中）。
- **案①（收紧 shape 谓词）**：与本仓分工**相反向**（把"范围"当"类型"处理，整档连坐），且会让 `:447` 那条消息**语义失真**
  （消息说 `finite`，判据实际变成 `finite && >=0`；这正是 c927-02 已裁过的"消息与判据不匹配"同一族问题）。
  它换来的收益是"拒绝被修改、拒绝静默吸收"，代价是**老档不可读且不可自动恢复**（要玩家手改 JSON）。
- **两案的共同盲区**：整数性、上限、`productionCarry`（§②-缺口 1/3）。
  ⇒ 若裁决目标是"库存值域自洽"，①②都只补了三分之一；这一点必须写进裁决，不能被"二选一"的框架掩盖。

### 3.4 顺手否证一条易被误读的点

`grainNegativeDays`（`gameStore.ts:2678`、`saveLoad.ts:556`）**不是**"负库存计数器"：
`runStarvationTick` 用「**扣前**库存 `grainBefore < consumption.totalGrain`」判缺粮（`:2676-2677` 注释明说"用扣后会被 clamp 到 0 而误判永久缺粮"），
而 `grain` 经 `setResourceClamped` **恒 ≥0**，`gameStore.ts:405-408`/`:2227` 两处注释也把"存粮 < 0"当成**永假**的死源处理。
⇒ **本仓设计口径是"库存不可能为负，负值只来自档面/内存灌入"**，因此"老档合法含负数"这条案①风险，
按 git 史实测也被压低：`setResourceClamped` 的 `Math.max(0, …)` **从 Initial commit（`15769cb`，2026-05-31）就在**
（`git show 15769cb:…/gameStore.ts:235-236` → `Math.min(9999, Math.max(0, Math.floor(value)))`），
即**全仓史内实时玩法从未产出过负库存** ⇒ 案①会拒的档，其负值来源只剩"手改档／修改器／磁盘损坏／案②落地前已被写回的档（§①-C 再生产）"。
这条是本单能给裁决的最硬的事实支点，**但它不等于"①安全"**：正因为 §①-C 的再生产路径存在，①一旦落地，
"已含负值的现役档"会变成永久砖，而玩家手上是否有这种档**本仓无从统计**（存档在 `D:/colony-game/user-data/saves`，本班未读真用户目录）。

---

## ④ 翻桩与回归影响面（落地任一案时会转红的既有钉桩）

| 用例 | 位置 | 案① | 案② | 说明 |
|---|---|---|---|---|
| 「🔴 甲判据的缺口（存档侧）：负数库存原样进门」 | `rateDisplayBoundary.test.ts:125-143`，断言 `:135 toBe(-5000)`、`:136 toBe(-0.5)`、`:141 toBeLessThan(0)` | 🔴 转红（`deserialize` 改抛 `SaveLoadError`） | 🔴 转红（钳成 0） | 24b8 遗留 4 **已预告**：「那是预期的翻桩信号，届时改期望值而不是删用例」 |
| 「乙判据：`replaceState` 灌 NaN/Infinity/`-1e30` 跑一日」 | `rateDisplayBoundary.test.ts:105-123`（`:122 gold < 0`） | ✅ 不转红 | ✅ 不转红 | 该例**不经 `deserialize`**（内存路径）⇒ 正好落在 §②-缺口 2 的覆盖缝上 |
| `save-v9.json` 兼容夹具 | `__fixtures__/save-v9.json`，`resources` 实测 `anyNegative=false` | ✅ 不受影响 | ✅ | 现取读数：`{"wood":5,"stone":5,"people":46,"grain":0,"gold":115,"cloth":0,"bronze":20,"influence":46}` |
| `saveGuard*.test.ts`／`saveMatrix*.test.ts`／`saveLoad*.test.ts` | 未点名负库存档面用例（`grep -rln "grain: -5000|wood: -0.5|gold: -1e30" src/renderer` **只命中 1 个文件**＝`rateDisplayBoundary.test.ts`） | 预期不转红 | 预期不转红 | **静态普查**，非全量实跑（并发窗禁跑全量）⇒ 落地时由主班收班取全量数 |
| `priceBoundaryClamp.test.ts:65-69`（负**造价**侧）、`crisis.test.ts:18`（`isDualZero` 纯函数） | 与库存读档闸无关 | ✅ | ✅ | 明确划界，免得被当成"两案都会翻" |

定向基线（本单实跑，供落地后对照）：
`npx vitest run` 点名 `rateDisplayBoundary／saveGuard／saveGuard2／saveGuard3／priceBoundaryClamp／saveLoad`（state 侧六件）
⇒ `VITEST_RC=0 · Test Files 6 passed (6) · Tests 135 passed (135)`（**未跑全量**，并发窗约束）。

---

## ⑤ 裁决要点（**不选案**）

裁决实际要回答的是四个问题，本档把每条都配了可核对的实测读数：

1. **静默吸收还是明确拒绝**：案②在载入瞬间改变玩家可见库存且**零日志**（24b8 E4 已否证"错误有日志"）；案①把档变成读不开的砖且**需手改 JSON 才能救**。两条路都不可自动回退——差别在"谁能发现"。
2. **要收到哪一层**：只收"负"（①②都能），还是连同"整数性"＋"≤cap"＋`productionCarry` 一起收（①②都不够，见 §②-缺口 1/3 与 §③-3.2 的 `:608` 同形先例其实**连 floor 一起给了**）。
3. **cap 放哪**：`saveLoad.ts` 拿不到 `getResourceCap`（建筑依赖＋import 成环，`gameStore.ts:956-957` 先例）， ⇒ 若裁定要管上限，位置只能在 gameStore 读档后清扫，属第三种形状。
4. **要不要先补可观测性**：本链路 `console.*` 零命中（24b8 E4）⇒ 无论选哪案，"静默"这个前置疑案不解决，下次同样只能靠复现排查；这可以独立于①②先裁。

**平衡数值**：本单未改任何一个平衡值（cap 9999 / 消耗 48/日 / `RESOURCE_CAP_BASE` / 宽限 5 日 / 减员 2%·5% 等全部原样引用，只作描述不作变更）。

---

## ⑥ 判据自查（卷宗「完成标准」逐句）

| 判据 | 命中 | 取证 |
|---|---|---|
| ① 用例可复跑 | ✅ | §① 表 A（12 条）／B（3 族）／C（逐日 3 格＋3 条附加实测），三条探针均可用 §⑦ 命令原样复跑；**未落仓内测试件**（判据④要求零产品码改动） |
| ② 两案对老档的行为差异矩阵（拒载 vs 钳制） | ✅ | §②：S1–S8 实测 × 现状／案①／案② ＋ 两案共同缺口 3 条 ＋ 两案 diff 草案 |
| ③ 一致性论证引 saveGuard2 先例 | ✅ | §③：`constructionProgress :792/:796`（p911r-40/saveGuard2）为主，另列同路径 11 族先例；`Math.max(0` 25 次 vs `SaveLoadError` 43 处 |
| ④ 零产品码改动（平衡数值只钉不改） | ✅ | `git status --porcelain`：外部在途 4 件未碰 ＋本班仅 1 件新增 md；`src/` 零改动；未改任何平衡值 |

## ⑦ 证据（命令＋读数；取 rc 一律重定向不接管道）

```
# 盘上现值（brief §5 表已过期：HEAD 现 6f4057a，porcelain 现 4 行；本班 17:2x 现取）
$ cd D:/code/colony-game && git rev-parse --short HEAD        → 6f4057a
$ git status --porcelain                                     → M docs/design/OPTIMIZATION_BACKLOG.md
                                                               M docs/insights/colony-dead-exports-20260914.json
                                                               D docs/insights/colony-dead-exports-20260914.json.bak
                                                               M docs/insights/colony-suite-timings-20260921.json
                                                             ＋ ?? docs/insights/c927-04-…md ＋ ?? docs/insights/c927-05-…md
  ⇒ 本单引用的 saveLoad.ts / gameStore.ts **不在脏件列表内**，工作树版＝HEAD 版（无差，无需对照读）

# 现状用例（临时探针，跑完不留在仓内；vite-node 来自 vitest 依赖，不做类型检查）
$ cd D:/code/colony-game && npx vite-node D:/code/tmp/qoder-executor-20260927-1520-colony39/c927-05-cases.ts   → RC=0（4,147 B 输出）
   A 组 12 条：负整数/负小数/正小数/1e30/99999999 = 进门；-Infinity/Infinity/NaN/'-5'/null/false = 拒载（消息一致）
   B 组：productionCarry 负数/字符串/null 全进门；populationClasses 负数与小数 → {"farmer":10,…}（归零+回退）
   C 组（⚠️ 夹具错误，见 §①-C 自报）：withPeople 三行"负粮 10 日不变"不成立
   D 组矩阵读数见 §②；E 组 serialize→deserialize 往返仍含 -5000
$ npx vite-node D:/code/tmp/qoder-executor-20260927-1520-colony39/c927-05-probe2.ts   → RC=0
   classes: POPULATION_CLASSES=["farmer","worker","soldier","scholar"], sampleConsumption totalGrain=48
   tickTrace: day=6 grain=0 wood=-0.5 gold=-1e+30 people=60 negDays=1 → day=10 people=59 negDays=5
   addResourceProbe: afterNegMinus1=0, afterNegPlus100=0
   serializeRoundTrip: writtenResources {"grain":-5000,"wood":-0.5}, jsonHasNegative true
   overCapProbe: before/afterOneTick 均 1e+30，cap9999=9999
$ npx vite-node D:/code/tmp/qoder-executor-20260927-1520-colony39/c927-05-probe3.ts
   {"badKeys":{"totalGrain":null,…},"goodKeys":{"totalGrain":48},"badGrainGt0":false,"goodGrainGt0":true}
   ⇒ 缺 worker 键 → NaN → `> 0` 恒假 → 吃粮支路跳过（第一版 C 组误读的成因）

# 先例普查
$ grep -c "Math.max(0" src/renderer/state/saveLoad.ts                    → 25
$ grep -c "SaveLoadError(" src/renderer/state/saveLoad.ts                → 43（含 class 定义与 throw 点，粗口径）
$ grep -rn "resources\[[^]]*\] *=[^=]" src --include=*.ts | grep -v __tests__ → 仅 gameStore.ts:657（setResourceClamped 本体）
$ grep -rn "resources\.people *=[^=]" src --include=*.ts | grep -v __tests__  → 仅 gameStore.ts:2899（读档期存量改写先例）
$ grep -rn "replaceState(" src --include=*.ts | grep -v gameStore.ts | grep -v __tests__ → 仅 SaveLoadPanel.ts:200
$ grep -rln "grain: -5000\|wood: -0.5\|gold: -1e30" src/renderer --include=*.ts → 仅 rateDisplayBoundary.test.ts
$ node -e "<读 __fixtures__/save-v9.json>" → resources anyNegative=false；productionCarry {"grain":0.2000000000000064}

# 历史支点（负库存是否可能来自老版本实时玩法）
$ git log -S "setResourceClamped" --oneline -- src/renderer/state/gameStore.ts | tail -3 → 54eafe9 / d7c6070 / 15769cb
$ git log --format="%h %ad %s" --date=short -S "setResourceClamped" -- … | tail -2       → d7c6070 2026-06-01 · 15769cb 2026-05-31 Initial commit
$ git show 15769cb:src/renderer/state/gameStore.ts | grep -n -A2 "setResourceClamped(id: ResourceId"
   235:  private setResourceClamped(id: ResourceId, value: number): void {
   236:    this.state.resources[id] = Math.min(9999, Math.max(0, Math.floor(value)));   ⇒ 全仓史内写侧恒非负

# 定向回归基线（未跑全量，并发窗禁跑）
$ npx vitest run src/renderer/state/__tests__/{rateDisplayBoundary,saveGuard,saveGuard2,saveGuard3,priceBoundaryClamp,saveLoad}.test.ts
   VITEST_RC=0 · Test Files 6 passed (6) · Tests 135 passed (135)（saveLoad 49 / rateDisplayBoundary 12 等，逐件行见 tmp 快照 c927-05-vitest.txt）

# type-check 两条口径（结论必须点名是哪条）
$ npm run type-check                                → TYPECHECK_RC=0（= tsc -p tsconfig.renderer.json --noEmit）
$ npx tsc -p tsconfig.main.json --noEmit            → MAIN_RC=2（2 条存量红 index.ts(93,9)/(93,18) TS18048，与本案无关，未动）

# 锚点复核（brief §3a：outbox → done）
$ ls D:/code/zcode-bridge/done/ | grep 24b8 → 20260925-120431-24b8.result.md ＋ .task.md  ✅
  遗留 1 原文命中该档 :102-105；"本件倾向 ②"在 :105（按派单口径只当线索）
```

## ⑧ 遗留问题

1. 🔴 **交人工闸（本单不选案、不动数值）**：案①／案②／§②-缺口 3 的"第三形状"（读档后在 gameStore 侧统一清扫 非负＋整数＋≤cap）三选一，
   以及"是否先独立补可观测性（日志/记账）"。本档把每条的用户可见后果、不可逆点、翻桩清单都配了实测读数。
2. 🔴 **本单新发现、锚点未提**：`productionCarry` 在 `saveLoad.ts:470` **完全无校验**（负数、字符串、`null` 都进门）。
   carry 是设计上的小数字段，故**不能照搬 resources 的"非负/整数"口径** ⇒ 若要一起收需单独定口径（建议另开单，不并入本案以免混判据）。
3. 🔴 **本单对锚点的一条否证**：24b8 结论"（负库存）在游戏里带着负库存长跑"仅对**当日无写入的格子**成立；
   `grain` 在有人口消耗时**第一天即被钳回 0**（实测 `day=6 grain=0`）。且第一次写入会**连正增量一起吞成 0**（`addResourceProbe`）。
   若日后按 ② 落地，这条差别会消失（钳制点从"第一次写入"前移到"读档"），届时翻桩期望值请照此改。
4. ⚠️ **两案共同盲区**：整数性、`≤cap`、内存 `replaceState` 路径（quick-save 尚未接线，现属理论面）。
5. ⚠️ **案①的"误伤历史档"概率无法在本仓统计**：存档在 `D:/colony-game/user-data/saves`（真用户目录，本班**未读未写**），
   且 §①-C 的"负值再生产"路径使含负值的**合法保存**可能存在。要定量需一次真机存档普查（属人工授权面）。
6. ➖ 全量 `npm test` 现值未取（并发窗），§④ 的"其余件不转红"目前是 **grep 静态普查**，不是实跑结论 ⇒ 交主班收班用全量补齐。
7. ➖ 本班临时探针在 `D:\code\tmp\qoder-executor-20260927-1520-colony39\`，随班自清；仓内除本 md 外零新增。
