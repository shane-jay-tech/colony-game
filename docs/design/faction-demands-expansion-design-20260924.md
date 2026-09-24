# 派系需求池扩容设计稿（FACTION_DEMANDS）· 2026-09-24

> 单号 `c924-29` · 执行班 `qoder-executor-20260924-2341-colony25` · cwd `D:\code\colony-game`
> 取数 HEAD `cc29179`（本文所有行号/读数只在该 HEAD 上有效，动手前请自己复跑附录 A）
>
> 🔴 **性质：只读盘点 + 设计稿。** 本文出现的**任何数字都不是落库值**：数值列一律写作「推演表 + 来源公式 + 沙盒对照臂」，
> 终值必须由沙盒对照实验与人工裁决确定。命中「经济平衡数值」红线，执行手不选值、不改 `src/`、不改测试、不改配置。
> 全文数值列的表头都带 `（设计稿·禁直落）` 标记，见每张表下方脚注。

---

## 0. 任务书前提复核（逐条实测，含否证）

| # | 任务书前提/锚点 | 实测命令（见附录 A） | 实测读数 | 结论 |
|---|---|---|---|---|
| P1 | `src/renderer/data/factions.ts:33` 是 `export const FACTION_DEMANDS: FactionDemand[] = [` | 直读该文件 | 第 33 行逐字一致 | ✅ 成立 |
| P2 | `src/renderer/state/factionSystem.ts:51` 是 `return rng.pick(FACTION_DEMANDS) ?? null;` | 直读该文件 | 第 51 行逐字一致 | ✅ 成立 |
| P3 | `src/renderer/data/factions.ts:11` 是 `export interface FactionDemand {` | 直读该文件 | 接口在 **:9**；:11 是 `demandId: string;` | ⚠ 行号漂移 2 行，按磁盘实况修正 |
| P4 | 「池仅 3 条每派 1 条」 | `rg -c "demandId: '"` / `rg -c "factionId: '"` | 均为 **3** | ✅ 成立 |
| P5 | 完成标准①「`rg -c "demandId: " src/renderer/data/factions.ts` 得 3」 | 原样执行该命令 | **得 4**（接口里的 `demandId: string;` 也被命中） | 🔴 否证：命令与判据不符，正确计数见 P4 |
| P6 | 「`FactionEffect` 七字段」 | 读 factions.ts:18-25 的可选字段声明（附录 A 第 3 条） | **6 个可选字段**（factions.ts:19-24） | 🔴 否证：是 6 不是 7（`axisShift` 的两个子键常被误数成第 7 个字段） |
| P7 | 「alreadyUsed 过滤在长局里必然枯竭（:48-51）」 | 读 :44-54 与 rng.ts:40-49 | 空可用时走**回收分支**从全池再抽，**不会返回 null、不会停摆** | 🔴 否证一半：枯竭形态是「100% 重复 + 效果空响」，不是「无诉求」。详见 §3 |
| P8 | 「`rng.pick(...) ?? null` 是空池保护」 | 读 rng.ts:40-43 | `pick` 遇空数组**抛 Error**，`?? null` 永不生效 | ⚠ 新发现的隐患：若把池改成可空/按派系分池，扩容会踩 throw |
| P9 | 完成标准④「零生产码改动（`git diff --stat` 空）」 | 接班基线 `git diff --stat` | 基线本身**非空**：他班在途 3 件（`OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json` 及其 `.bak`），本班禁碰 | 🔴 否证：本班口径改为「`git diff --stat` 与接班基线逐字相同 + 净新增仅本文 1 份」，证据见 §6 |

> 结论：本文按磁盘实况成稿；P5/P6/P7/P9 四处与任务书不一致，已按纪律档 §五.2 收窄而非判 failed。

---

## 1. 现状矩阵（3 条 × 两条分支 × 实际落地通道）

「实际落地通道」＝`gameStore.resolveFactionDemand()`（src/renderer/state/gameStore.ts:1750-1786）真跑起来会改变什么，不是弹窗上写了什么。
> 本表「（现值）」两列是**磁盘只读读数**（现状盘点），既不是本班的设计值也不是落库建议；本文的**新增数值**全部集中在 §4，那里逐列标 `（设计稿·禁直落）`。

| demandId | 派系 | 标题 | acceptEffect（现值） | accept 真实落地（实测） | rejectEffect（现值） | reject 真实落地（实测） |
|---|---|---|---|---|---|---|
| `demand_tax_cut` | 豪强 tycoon | 豪强请减赋 | `{ goldMul: -0.20 }` | 永久 modifier `faction_demand_tax_cut_country_gold_output`，mul 0.8，`stackable:false`（:1779-1781, :1789-1795） | `{ morale: -5 }` | `adjustMorale(-5,'faction')`（:1766-1769） |
| `demand_reward` | 外戚 consort | 外戚求封赏 | `{ policySlotCost: 1 }` | 🔴 **零落地**：全仓 `policySlotCost` 只有两处——类型声明与弹窗文案（`FactionDemandModal.ts:25` 印「国策位 +1」），无任何结算点 | `{ loyaltyDelta: -10 }` | `adjustMorale(-10,'faction')`（与 morale 同通道合并） |
| `demand_court_debate` | 士人 literati | 士人请开朝议 | `{ axisShift: { axis:'power', delta:-10 } }` | ⚠ **条件落地**：:1770 要求 `state.storyFlags` 非空，即**只在故事模式生效；沙盒模式下静默失效** | `{ researchMul: -0.20 }` | 永久 modifier `faction_…_country_research_speed`，mul 0.8，非叠加 |

两条分支**共同**必发的副作用（与字段无关）：`adjustWrath(−10 接受 / +12 拒绝)`（publicSentiment.ts:28-29）、把 `demandId` push 进 `acceptedDemands`/`rejectedDemands`（:1755-1757）、重排 `nextEventDay`（:1765）。

> 现状一句话：**3 条诉求里有 1 条接受分支完全空转、1 条接受分支只在故事模式空转**（沙盒下同样空转）。
> 这与 c924-28 在 megaProjects 上查到的形态同源：字段在册、UI 向玩家承诺、结算无消费点。

---

## 2. `FactionEffect` 词表落地性（扩容只能用这 6 个字段）

| 字段（factions.ts:18-25） | 结算点 | 落地形态 | 扩容时的坑 |
|---|---|---|---|
| `morale?` | gameStore.ts:1766-1769 | `adjustMorale(Δ,'faction')` | 与 `loyaltyDelta` 相加后走**同一**通道，二者不能表达两种感受 |
| `loyaltyDelta?` | 同上 | 同上（弹窗也印成「民心」，`FactionDemandModal.ts:22`） | ⚠ 与 `generals[].loyalty`（generalSystem.ts）**完全无关**，名字易误读成将领忠诚 |
| `goldMul?` | :1779-1781 | 永久 modifier `country_gold_output`，`remainingDays:-1` | id 由 demandId 派生 ⇒ **同一诉求二次接受 `addModifier` 早退**（:747-751），不再叠加也不再刷新 |
| `researchMul?` | :1782-1784 | 永久 modifier `country_research_speed` | 同上 |
| `policySlotCost?` | — | 🔴 **无消费点**（仅弹窗文案 :25） | 用之前必须先决定：补结算通道，还是禁用该字段（两个出口都超出执行手授权，见 §6） |
| `axisShift?` | :1770-1776 | clamp 到 ±100 的 `powerAxis`/`resourceAxis` | ⚠ `storyFlags === null` 时静默失效；弹窗却照印「权力倾向 ±N」→ 沙盒玩家看到不兑现的承诺 |

**词表内已具备的可用通道（安全区）**：`morale`、`goldMul`、`researchMul`、`axisShift`（故事模式）。
**词表内的雷区（用前需裁决）**：`policySlotCost`（零落地）、`loyaltyDelta`（伪独立通道）、`axisShift` 在沙盒（条件落地）。

---

## 3. 枯竭复现推演

### 3.1 机制实况（先把「枯竭」这个词校准）

`pickDemand(alreadyUsed, rng)`（factionSystem.ts:44-54）：

1. `available = FACTION_DEMANDS.filter(d => !alreadyUsed.includes(d.demandId))`（:48）
2. `available` 非空 → 从 `available` 等概率抽（:53）⇒ **前期不重复**
3. `available` 空 → 注释写 `// Recycle: all used, reset pool`，实现却是 `rng.pick(FACTION_DEMANDS)`（:50-51）——
   🔴 **used 列表从未被清空**（`acceptedDemands`/`rejectedDemands` 只有 :1755-1757 的 push，全仓无 remove），
   所以第 3 步是**永久绕过过滤**，不是「重置池」。此后每一次抽选都可能命中已解决过的诉求。

于是真实的退化链是：**新内容用尽 → 无限重复 → 重复命中的 `goldMul`/`researchMul` 因非叠加而空响 → 阶层博弈退化成「每 60-180 天调一次怨愤值」**。
停摆/返回 null 不会发生（除非把 `FACTION_DEMANDS` 改成空数组，那会命中 P8 的 throw）。

### 3.2 节奏来源公式（全部引自磁盘，非设计值）

- 触发：`population >= FACTION_TRIGGER_POPULATION`，常量现值 **80**（factions.ts:60）
- 间隔：`base = 60 + rng.nextInt(0, 90-60)` ⇒ `base ∈ {60..90}`，`E[base] = 75`（factions.ts:61-62，factionSystem.ts:38-42）
- 监察台因子：`factor = min(2.0, 1.3^censors)`，只数 `status==='working'` 的 `bld_censor`（gameStore.ts:1729-1733）
- 实际间隔：`interval = max(1, round(base × factor))`
- 怨愤强推：`wrath >= 70` 且距上次强推 `>= 14` 天时，把 `nextEventDay` 拉到 `currentDay + 1`（publicSentiment.ts:10-12；gameStore.ts:2313-2317）⇒ **事件下界 ≈ 15 天/次**
- 日界：`MAX_CURRENT_DAY = 3600`（gameStore.ts:944）

### 3.3 推演表（数值列：设计稿·禁直落）

记号：`S` = 池内条目数；`D_act` = 人口过 80 的激活日。
**假设前提**：① `D_act = 200`（沙盘缺省假设，非实测任何存档）；② 取 `E[base]=75` 不做 round 修正；
③ 忽略弹窗时停（模态打开会占真实时间但不占游戏日）；④ 怨愤强推与常规事件不叠加计。

| 监察台数 | factor（公式值） | E[interval] 天 | 新内容窗口 W ≈ S × E[interval]：S=3 | 同左：S=12 | 至 3600 天的事件数 N ≈ (3600−D_act)/E[interval] | 重复占比 (N−S)/N：S=3 | S=12 |
|---|---|---|---|---|---|---|---|
| 0 | 1.00 | 75 | 225 | 900 | ≈ 45 | ≈ 93% | ≈ 73% |
| 1 | 1.30 | 97.5 | 293 | 1170 | ≈ 35 | ≈ 91% | ≈ 66% |
| 2 | 1.69 | 126.75 | 380 | 1521 | ≈ 27 | ≈ 89% | ≈ 56% |
| ≥3（封顶） | 2.00 | 150 | 450 | 1800 | ≈ 23 | ≈ 87% | ≈ 48% |
| 怨愤临界（最坏） | — | ≈ 15 | 45 | 180 | ≈ 226 | ≈ 99% | ≈ 95% |

- 「首次必然重复」的时点：第 `S+1` 个事件，`D_act + (S+1) × E[interval]` ⇒ 现池无监察台 ≈ 第 **500** 天起进入 100% 重复区。
- 若要求「激活后到 3600 天上限**全程不重复**」，反解 `S ≥ N` ⇒ 需 **≈45 条**（无监察台）／**≈23 条**（≥3 座监察台）／**≈226 条**（怨愤临界连抽）。
  🔴 这组数是**上限口径的理论值**，不作为推荐池规模——池规模真正的下界来自 §3.4 的派系曝光。

### 3.4 池规模的另一半理由：派系曝光权重

`rng.pick` 抽的是**条目**不是**派系** ⇒ `P(派系 i) = n_i / Σn`（等概率、按条目数加权）。
现池三派各 1 ⇒ 曝光均等（各 1/3）。**一旦扩容不做均配，派系权重立刻倾斜**：
例：只给豪强 +2 ⇒ 豪强 3/5 = 60%、另两派各 20%。
⇒ 本设计的硬约束是「**每派等量增补**」，而不是某个具体条数。这是 §4 取「每派 +3」的直接依据（数值列：设计稿·禁直落）。

### 3.5 存档侧的连带行为（会影响推演口径）

`deserializeFactionState()`（saveLoad.ts:627-641）把 `activeDemand` **强制置 null**，只回灌 `acceptedDemands`/`rejectedDemands` 字符串数组。
⇒ ① 存档时未决诉求直接丢弃、不记入 used（对池排水是轻微利好，不改变结论）；
⇒ ② used 是**字符串列表**，所以「扩容只加不减」对老档**向后兼容**：老档的已用 id 仍在，新 id 自动成为可用槽；
⇒ ③ 🔴 反之**改/删既有 demandId 会让老档的「已用」记录失配**，等于给老玩家白送一次可重复接受——扩容必须**只追加、不改名、不复用 id**。

---

## 4. 扩容条目表（设计稿 · 全表数值禁直落）

### 4.1 结构与命名约定（这部分是"形"，可评审；数值不可落库）

- 类型面不动：仍 `interface FactionDemand { factionId, demandId, title, description, acceptEffect, rejectEffect }`（factions.ts:9-16），新条目**一律追加在数组尾部**。
  🔴 禁止插入到 `FACTION_DEMANDS[0]` 之前：5 处测试按下标取件（`FactionDemandModal.test.ts:60`、`factionSystem.test.ts:58/64/100`、`publicWrath.test.ts:84`），且 `:60` 的注释钉死了「`[0]` = 豪强请减赋」。
- `demandId` 命名沿用现形：`demand_<snake_slug>`，**不带派系前缀**（与现有 3 条一致），全局唯一，一经发布永不复用（存档耦合，见 §3.5）。
- `acceptEffect`/`rejectEffect` 只用 §2 的 6 字段词表；**新条目至少要有 1 个"安全区"字段**（`morale`/`goldMul`/`researchMul`/`axisShift`），
  不得以 `policySlotCost` 作为唯一后果（当前 `demand_reward` 正是反面实例）。
- 数值一律给「基准 × k」三臂，不写终值：

| 通道 | 现池唯一基准（磁盘实测） | 沙盒对照臂（设计稿·禁直落） |
|---|---|---|
| `goldMul` | 0.20（`demand_tax_cut`） | 0.20×{0.5, 1.0, 1.5} = {0.10, 0.20, 0.30} |
| `researchMul` | 0.20（`demand_court_debate` reject 支） | 同上 |
| `morale` | 5（`demand_tax_cut` reject 支） | 5×{0.5, 1.0, 1.5} = {2.5, 5, 7.5}→ 取整臂由沙盒定 |
| `loyaltyDelta` | 10（`demand_reward` reject 支） | 10×{0.5, 1.0, 1.5} = {5, 10, 15} |
| `axisShift.delta` | 10（`demand_court_debate` accept 支） | 10×{0.5, 1.0, 1.5} = {5, 10, 15} |
| `policySlotCost` | 1（`demand_reward` accept 支，**但零落地**） | 不给臂，先走 §6 裁决 |

> 来源公式：`值 = 同通道现池唯一值 × k`，`k` 由沙盒对照实验（同 seed 同剧本跑三臂）＋人工裁决定。**执行手不选 k。**

### 4.2 每派 +3 条候选（9 新条 ⇒ 总池 12，三派各 4）

`demandId` 已对现池 3 值与彼此做过唯一性校验（附录 A 第 7 条命令）。效果列只写**通道组合 + k 臂记号**，不写落库数。

| 新 demandId | 派系 | 建议标题 | description 取向（弹窗宽 460−48 自动换行） | acceptEffect 通道组合 | rejectEffect 通道组合 | 通道就绪度 |
|---|---|---|---|---|---|---|
| `demand_land_survey` | 豪强 | 豪强请清丈 | 请朝廷承认已垦田籍 | `goldMul(+)` + `axisShift(wealth)` | `morale(−)` | ⚠ wealth 轴仅故事模式 |
| `demand_grain_monopoly` | 豪强 | 豪强请专粮 | 请许豪强代管常平 | `goldMul(+)` + `researchMul(−)` | `morale(+)` | ✅ 双通道就绪 |
| `demand_private_guard` | 豪强 | 豪强请置家兵 | 请许本乡自置部曲护庄 | `policySlotCost`（待 §6 裁决）或改 `goldMul(−)` + `morale(−)` | `loyaltyDelta(−)` | 🔴 首选支路零落地，必须二选一 |
| `demand_consort_marriage` | 外戚 | 外戚请尚主 | 请以宗室女下嫁戚族 | `axisShift(power)` | `morale(−)` | ⚠ 仅故事模式 |
| `demand_consort_office` | 外戚 | 外戚请世职 | 请许戚族子弟荫官 | `loyaltyDelta(+)` + `goldMul(−)` | `morale(−)` | ✅（注意 loyalty 即 morale，见 §2） |
| `demand_consort_ward` | 外戚 | 外戚请赐第 | 请为后族营建邸第 | `goldMul(−)` | `morale(+)` | ✅ |
| `demand_censor_remonstrate` | 士人 | 士人请置谏 | 请广开言路置谏官 | `axisShift(power)` + `researchMul(+)` | `morale(−)` | ⚠ 轴仅故事模式、研究通道就绪 |
| `demand_school_expand` | 士人 | 士人请广学 | 请增州县学舍 | `researchMul(+)` + `goldMul(−)` | `researchMul(−)` | ✅ |
| `demand_ward_granary` | 士人 | 士人请平粜 | 请开仓平抑米价 | `morale(+)` + `goldMul(−)` | `goldMul(+)` | ✅ |

> 每派建议 ≥3 条（完成标准③）已满足：3 派各 +3、各派净 4 条、Σ=12、曝光权重回到 1/3（§3.4）。
> 🔴 表中所有效果**不给数值**，因为：给不出"哪个 k"的依据就是给落库值——那是人工裁决位。

### 4.3 为什么是「每派 +3 / 总池 12」而不是 §3.3 反解出的 23-45 条

- 12 条把「新内容窗口」从无监察台的 225 天推到 900 天（§3.3 同式），占 3600 天日界约 1/4（同表假设），重复占比从 ≈93% 降到 ≈73%（**口径同表、同一假设**）。
- 23-45 条属「全程零重复」的理论上限口径，代价是 9 倍文案量 + 全部需人工选值，性价比未知。
- 🔴 两个规模都**只是候选**，本单不落库、不排期；真正的裁决点是 §6 的三档。

---

## 5. 落地前置闸（本单一律不动，只列连带面）

| 闸 | 位置（行号仅本期读数） | 为什么必须先过 |
|---|---|---|
| G1 `policySlotCost` 有字无值 | 声明 factions.ts:23、渲染 FactionDemandModal.ts:25、无结算点 | 新条目若继续用它＝继续造空承诺；处置（补通道 / 禁字段 / 保留但文案加限定）三选一，属经济数值与 UI 承诺面，人工裁决 |
| G2 `axisShift` 沙盒静默失效 | gameStore.ts:1770 `&& this.state.storyFlags` | 要么承认"沙盒无轴"，要么给沙盒建轴。改前 6/9 条候选的 accept 支在沙盒是半空转 |
| G3 非叠加 modifier 的"二次接受空响" | `makeFactionModifier` id 派生 :1789-1795 + `addModifier` 早退 :747-751 | 回收期重复接受同一诉求除怨愤外无事发生。要么改 id 含轮次、要么改过滤语义（见 G4） |
| G4 注释与实现不符（`// Recycle: all used, reset pool`） | factionSystem.ts:50-51 | 「重置池」与「绕过过滤」是两种设计意图，扩池不解决语义分歧；须先定意图再动代码 |
| G5 `rng.pick` 空数组抛异常 | rng.ts:40-43 | 若扩池同时改成"按派系分池/条件过滤"，池可能空 ⇒ 由 `?? null` 变成 throw。改法需评审 |
| G6 测试下标依赖 | 见 §4.1 的 5 处 | 扩容只准尾部追加；另 `factionSystem.test.ts:42/50` 用 `slice(0,2)`/`map(all)` 派生 used，池变化后语义仍自洽（已核）但覆盖强度下降，建议人工决定是否补"跨派均匀"断言 |
| G7 全量测试归因 | 本波同仓另有写位班（`c924-25/26/30`，改 `src/renderer/**/__tests__/`） | 🔴 本班未跑任何套件（只读盘点不需要），也不要求主班用本班名义取全量数 |

---

## 6. 遗留问题 / 交主班→待人工台账

1. **完成标准①的命令写法要修**：`rg -c "demandId: "` 读 4 不是 3（P5）。建议判据改成 `rg -c "demandId: '"` 或 `rg -c "factionId: '"`。
2. **完成标准④不可满足**：接班工作树即带他班在途 3 件，`git diff --stat` 永不为空（P9）。需主班把该条口径改为"与基线逐字相同"。
3. **G1/G2 的三档出口全部待人工**：`policySlotCost` 与 `axisShift`（沙盒）是"字段在册、UI 承诺、结算缺失"，属经济平衡 + 玩家可见承诺面，执行手无权选择。
4. **§4 的 9 条候选条目未选 k 臂、未选池规模**（§4.3 两档），任何落地都必须由沙盒对照实验＋人工裁决定值。
5. **G4 的语义分歧**（recycle 是否等于 reset pool）需要设计意图裁决，否则扩池后同一退化只是延后发生。
6. 本次新增条目会进入 `saveLoad` 的 used 字符串面（§3.5）：**「只追加、不改名、不复用 id」需写成常驻约束**，建议由人工决定是否入 `OPTIMIZATION_BACKLOG.md`（该件他班在册，本班不写）。

---

## 附录 A：复算命令（在 `D:\code\colony-game`，本机 `rg` 可用）

```bash
# 1) 锚点三处（P1/P2/P3）
python -c "import io;[print(i+1,l.rstrip()) for i,l in enumerate(io.open('src/renderer/data/factions.ts',encoding='utf-8').readlines()[8:34])]"
# 2) 条目计数（P4）——注意别用 "demandId: "，那会连接口一起命中（P5）
rg -c "demandId: '" src/renderer/data/factions.ts
rg -c "factionId: '" src/renderer/data/factions.ts
rg -c "demandId: " src/renderer/data/factions.ts   # 任务书写的是 3，实测 4
# 3) FactionEffect 字段数（P6）
rg -n "morale\?|goldMul\?|researchMul\?|loyaltyDelta\?|policySlotCost\?|axisShift\?" src/renderer/data/factions.ts
# 4) 回收分支与 used 永不删除（P7）
rg -n "available|Recycle" src/renderer/state/factionSystem.ts
rg -n "acceptedDemands.push|rejectedDemands.push|acceptedDemands.splice|rejectedDemands.splice" src/renderer -g '!**/__tests__/**'
# 5) rng.pick 空数组抛异常（P8）
rg -n "Cannot pick from an empty array" src/renderer/state/rng.ts
# 6) 落地通道与坑（§1/§2）
rg -n "policySlotCost" src/renderer
rg -n "effect.morale|effect.loyaltyDelta|effect.goldMul|effect.researchMul|storyFlags" src/renderer/state/gameStore.ts | rg -n "1766|1770|1779|1782"
rg -n "stackable|existing" src/renderer/state/gameStore.ts | rg -n "747|748|749|750|751"
# 7) demandId 唯一性（§4.2 追加前先跑）
rg -o "demandId: '[a-z_]+'" src/renderer/data/factions.ts | sort | uniq -d      # 应为空：文件内无重号
# 新候选 vs 现池（本单实测：9 条新 id 与现池 3 id 及彼此交集为空，每派净 4 条）
python -c "import re,io;s=io.open('src/renderer/data/factions.ts',encoding='utf-8').read();d=io.open('docs/design/faction-demands-expansion-design-20260924.md',encoding='utf-8').read();e=re.findall(r\"demandId: '([a-z_]+)'\",s);n=[x for x in re.findall(r'^\| .(demand_[a-z_]+). \|',d,re.M) if x not in e];print(len(n),sorted(set(n)),len(set(n)&set(e)))"
# 8) 节奏与怨愤强推常量（§3.2）
rg -n "FACTION_TRIGGER_POPULATION|FACTION_EVENT_INTERVAL" src/renderer/data/factions.ts
rg -n "WRATH_DEMAND_THRESHOLD|WRATH_DEMAND_COOLDOWN_DAYS|WRATH_DEMAND_ACCEPTED|WRATH_DEMAND_REJECTED" src/renderer/state/publicSentiment.ts
rg -n "MAX_CURRENT_DAY" src/renderer/state/gameStore.ts
# 9) 存档侧（§3.5）
rg -n "activeDemand: null" src/renderer/state/saveLoad.ts
# 10) 零生产码改动（§6 的 P9 口径）
git diff --stat        # 收班读数应与接班基线逐字相同（基线快照见附录 B 路径）
# ⚠ 直接 diff 会假报差异：git 对 docs/insights/colony-dead-exports-20260914.json 往 stderr 打一条 "LF will be replaced by CRLF" 警告
git diff --stat 2>/dev/null > after.txt
rg -v "^warning:" tmp/qoder-executor-20260924-2341-colony25/diffstat-before-c29.txt > before.txt
diff <(sort after.txt) <(sort before.txt)   # 期望：无输出、rc=0（本机 locale 下别用 comm -13，会假报无差异）
```

> ⚠ 三条本机坑（今日实测先例，引数时自查）：计时类读数必须标窗况（并发跑会虚高）；在册计数常与盘上不符（本文 P5/P6 即两例）；
> `rg -rn` 的 `-r` 是 replace，会把命中词替换掉——本附录全部用 `rg -n`。

## 附录 B：改动面声明

- 本班产出：**仅新增本文件 1 份** `docs/design/faction-demands-expansion-design-20260924.md`（LF 行尾，与 `evt-art-wiring`/`wood-outlet` 等近期设计档一致）。
- 未改：`src/**`（含 `data/factions.ts`、`state/factionSystem.ts`、`state/gameStore.ts`、`ui/FactionDemandModal.ts`）、任何测试、任何配置。
- 未碰（他班在册/在途）：`docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-dead-exports-20260914.json` 及 `.bak`、`src/renderer/**/__tests__/` 三件、`fakeScene.ts`、`vitest.config.ts`、三份 `tsconfig*.json`。
- 基线快照：`tmp/qoder-executor-20260924-2341-colony25/diffstat-before-c29.txt`（`tmp/` 已 gitignore，`.gitignore:25`）。
- 未跑测试套件、未跑 build（只读盘点＋设计稿，判据无点名要全量数）。
