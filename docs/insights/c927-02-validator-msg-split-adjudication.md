# c927-02 · `saveLoad` 校验消息「类型错被报成越界」（E4①）拆分裁决材料

> 性质：**裁决材料，零产品码改动**（`src/**` 未写入，自证见 §6）。
> 生成班：`qoder-executor-20260927-1400-colony38`（波次 19）。锚点：`done/20260925-120418-82c6.result.md` 遗留2
> （卷宗写 `outbox/…`，该批全局路径搬家，已按 brief §3a 在 `done/` 取到，未判缺陷）。
> 仓现值 HEAD `102c65d`，`git status --porcelain` 7 行（全他班在途件）；本单取证对象
> `saveLoad.ts`／`saveGuard.test.ts`／`saveGuard2.test.ts`／`badSampleRestore.test.ts`／`replaySnapshotContent.test.ts`／
> `fullLifecycleLayerTriage.test.ts` 逐枚 `git diff --numstat HEAD -- <路径>` 为**空** ⇒ 下文 file:line 对 HEAD 与工作树同时成立。

---

## 1. 口径先定：什么叫「类型错被报成越界」

一条判据同时含 **①typeof/可表示性检查** 与 **②取值域/范围检查**，而**只有一条消息** ⇒ 按消息**断言的类别**分三档：

- **A 档＝误报类别**（本案硬目标）：消息**指名**了某一类（`out of range`），类型错时该指认是**假的**。
- **B 档＝笼统不错报**：消息只陈述要求（`must be a positive integer`），两类输入下这句话都为真，只是不告诉你是哪一类。
- **C 档＝纯判据**（无需动，也是拆分后的目标形状范本）：`schemaVersion must be a number`（`saveLoad.ts:385-387`，判据只有 `typeof`）。

判档依据不是读码推断，而是 §2 的**实机两态对喂**（同一判据分别喂类型错与取值错，打出真实消息串）。

---

## 2. ① 现值清单（全部混合判据 + 实机消息）

### 2.1 跑法（可复算）

临时件留在仓外 ⇒ 仓内 `vitest.config.ts:18` 的 `include` 收不到、且仓外文件 import 不到 `vitest`
（同班 c927-01 实测 `Cannot find module 'vitest/config'`）⇒ 采 `vite-node` 直跑、只打读数：

```
$ cd D:/code/colony-game && npx vite-node "D:/code/tmp/qoder-executor-20260927-1400-colony38/c927-02.probe.ts"   # RC=0
```

探针：`D:\code\tmp\qoder-executor-20260927-1400-colony38\c927-02.probe.ts`，输出留档 `c927-02.out.txt`（同目录，本班收班自清）。
每条 `MSG|<判据/输入类别>|<实际消息>`，共 37 读数。

### 2.2 A 档｜误报类别（3 条，**拆分硬目标**）

| # | 判据位置 | 判据形状（现值） | 类型错输入 → 实际消息 | 取值错输入 → 实际消息 |
|---|---|---|---|---|
| **A1** | `saveLoad.ts:452-460`（判据 `:454-455`，消息 `:458`） | `typeof !== 'number' \|\| !Number.isFinite \|\| <0 \|\| >MAX` 四因一判 | `currentDay:'12'` → **`currentDay out of range: 12 (allowed 0..3600)`** | `currentDay:4000` → `currentDay out of range: 4000 (allowed 0..3600)` |
| **A2** | `saveLoad.ts:288-291`（消息 `:290`） | `!Number.isInteger(px) \|\| px<0 \|\| px>=width` | `position.x:'3'` → **`worldMap.resourceNodes[0].position.x out of range`** | `position.x:99` → 同串（无值、无界，纯靠玩家猜） |
| **A3** | `saveLoad.ts:292-295`（消息 `:293`） | 同 A2 的 y 轴 | `position.y` 非整数 → **同串** | `position.y` 越界 → 同串 |

A1 附证（本单新增）：`currentDay: NaN` → `out of range: NaN`（NaN 是 number，被"越界"概括）；
**`currentDay: null` → `NO_THROW` 静默放行**（`:452` 的 `s.currentDay ?? 0` 把 null 兜成 0）——类型错**连消息都没有**，属 82c6 遗留4「坏值沉默渗透」同族，**不在"拆分消息"射程内**，见 §5 附带项。

### 2.3 B 档｜笼统不错报（11 条，实机两态同串）

| # | 判据位置 | 消息（现值） | 覆盖的因 | 两态实机读数 |
|---|---|---|---|---|
| B1 | `:226-228` / `:229-231` | `worldMap.width\|height must be a positive integer` | 非数字／非整数／≤0 **三因** | `'10'`、`0`、`2.5` **同串** |
| B2 | `:232-234` | `worldMap.seed must be a finite number` | 非数字／NaN／Infinity | `'x'`、`NaN` **同串** |
| B3 | `:295-297` | `worldMap.resourceNodes[i].remaining must be a non-negative number` | 非数字／负值 | `'5'`、`-1` **同串** |
| B4 | `:255-258` | `worldMap.tiles[i].terrain is not a valid terrain` | 非字符串／越枚举 | `7`、`'lava'` **同串** |
| B5 | `:279-281` | `worldMap.resourceNodes[i].kind is not a valid kind` | 非字符串／越枚举 | （探针未单独喂，判据形状与 B4 逐字同构） |
| B6 | `:441-448` | `resources must be a record of finite numbers` | 非对象／数组／值非有限，**且不带键名** | `[]`、`{grain:NaN}`、`{grain:'3'}` **同串** |
| B7 | `:773-775` | `buildings[i].defId must be a non-empty string` | 非字符串／空串 | `7`、`''` **同串** |
| B8 | `:781-783` | `buildings[i].position.{x,y} must be integers` | x 或 y 任一非数字／非整数，**且不分轴** | `x:0.5`、`y:'0'` **同串** |
| B9 | `:785-787` | `buildings[i].status invalid: "<值>"` | 非字符串／越枚举（带值 ⇒ 可自辨） | `7`、`'exploded'` 同模板、值不同 |
| B10 | `:788-790` | `buildings[i].tier invalid: "<值>"` | 非数字／越枚举（带值） | `'1'`、`9` 同模板、值不同 |
| B11 | `:802-805` | `buildings[i].upgradingTo must be a non-empty string when present` | 非字符串／空串 | `7`、`''` **同串** |

### 2.4 反向缺陷（**不是拆分问题，别混进本案一起改**）

| # | 位置 | 实机读数 | 说明 |
|---|---|---|---|
| **R1** | `:791-796` constructionProgress | 类型错 `'5'` → `must be finite number`；**`1e9` 与 `-50` → `NO_THROW`** | 判据在 `:792`（只管 `typeof`＋`isFinite`）、消息 `:793`，范围面被 `:796 Math.min(100, Math.max(0, rawProgress))` **静默钳制**（`p911r-40` 注释为刻意设计）。⇒ 这条消息**只管类型不管范围**，拆分会让人误读成"范围也收了"。要收范围属**判据改动**（今天读得开的档改后拒载）＝人工闸，不属本单 |
| **R2** | `:422-425` speed | `99` → NO_THROW（钳成 1）；`'1'` → NO_THROW（钳成 1） | 刻意 clamp 族，与 R1 同性质 |
| **R3** | `:452` currentDay `?? 0` | `null` → NO_THROW | 见 §2.2 A1 附证 |

---

## 3. ② 拆分映射表（A 档逐条给两条新文案）

命名口径：与 C 档范本（`schemaVersion must be a number`）和仓内既有风格（`mapGen.ts:167/170` 的 `…, got ${x}`、
`modifierValidator.ts:54/71` 同形）**对齐**，不另造第三套话术。类型条统一用 `must be …, got <原文>（type <typeof>）`，
范围条统一保留 `out of range: <值> (allowed <下界>..<上界>)` 原骨架。

| # | 现单条消息 | 拆后**类型条**（新增） | 拆后**范围条**（保留原骨架） |
|---|---|---|---|
| A1 | `currentDay out of range: 12 (allowed 0..3600)` | `currentDay must be a finite number, got "12" (type string)` | `currentDay out of range: 4000 (allowed 0..3600)` |
| A2 | `worldMap.resourceNodes[0].position.x out of range` | `worldMap.resourceNodes[0].position.x must be an integer, got "3" (type string)` | `worldMap.resourceNodes[0].position.x out of range: 99 (allowed 0..1)`（界＝`width-1`，**现串根本不给界**） |
| A3 | 同 A2 的 y | `worldMap.resourceNodes[0].position.y must be an integer, got … (type …)` | `worldMap.resourceNodes[0].position.y out of range: 99 (allowed 0..1)`（界＝`height-1`） |
| A1-NaN | `out of range: NaN` | **NaN/Infinity 归类型条**（判据拆法：先 `typeof` → 再 `Number.isFinite` → 再范围） | 范围条只在"是有限数但越界"时可达 |

B 档**建议不拆**（§5 推荐案），理由与例外写在那里；若主班要一并拆，B1-B11 的映射同一口径，逐条为：
`must be an integer, got …` ＋ `must be positive`（B1）、`must be a number, got …` ＋ `must be finite`（B2/B3）、
`must be a string, got …` ＋ `is not a valid terrain/kind`（B4/B5）、`must be an object (record), got array` ＋
`resources.<键> must be a finite number`（B6，**顺带补键名定位**）、`must be a string, got …` ＋ `must not be empty`（B7/B11）、
`position.x/y must be a number, got …` ＋ `position.x/y must be an integer`（B8，**顺带分轴**）、
`status/tier must be a string/number, got …` ＋ `… not in allowed set`（B9/B10）。

---

## 4. ③ 受影响测试件与断言数清单

### 4.1 全部在册消息断言面（现取：`grep -rn --include=*.ts -E "toThrow\(/…|msg: /…|locator: /…|toContain\(…\)" src/renderer/state/__tests__ src/renderer/ui/__tests__`）

| 测试件 | 触到混合判据消息的断言处数 | 具体位置 |
|---|---|---|
| `saveGuard2.test.ts` | **14** | `:88`(terrain) `:95`(boolean，C 档) `:117``:118`(defId) `:122``:123`(position) `:128`(status) `:132``:133`(tier) `:138``:140``:193``:201`(progress) `:150`(upgradingTo)；另 `:53`(malformed) `:81`(width\*height) `:109`(an array) `:113`(is not an object) `:64-66``:75-76` 为**类级** `toThrow(SaveLoadError)`，改文案免疫 |
| `badSampleRestore.test.ts` | **4** | `:117`(constructionProgress 前缀) `:122`(resources **全串**) `:127`(tiles[3].terrain 前缀) `:266`(position.{x,y} **全串**) |
| `replaySnapshotContent.test.ts` | **3** | `:323`(resources 全串) `:324`(**currentDay `/out of range/`**，输入＝真越界数) `:325`(seed 全串) |
| `fullLifecycleLayerTriage.test.ts` | **1** | `:409` `toContain('resources must be a record of finite numbers')` |
| 合计 | **22 处 / 4 件** | — |

### 4.2 按拆分方案的红绿归因（**关键读数**）

| 方案 | 变红的在册断言 | 数 |
|---|---|---|
| **只做 A 档（A1-A3 ＋ NaN 归属）** | **无一条** | **0** |
| 加做 B6（resources 拆两条／补键名） | `badSampleRestore:122`、`replaySnapshotContent:323`、`fullLifecycleLayerTriage:409` | 3 |
| 加做 B8（position 分轴） | `badSampleRestore:266`（全串 `…{x,y} must be integers`）、`saveGuard2:123`（`/integers/` 若改成按轴文案即不匹） | 2 |
| 加做 B10（tier 类型/枚举分两条） | `saveGuard2:133`（`tier:'1'` 是**类型错**却被断言 `/tier invalid/`——测试把误报**固化**了） | 1（另 `:132` 真越枚举仍绿） |
| 加做 B4/B5（terrain/kind 拆两条） | `saveGuard2:88`（输入 `'lava'`＝真越枚举，仍绿）；`badSampleRestore:127` 只匹前缀 ⇒ 绿 | 0（但需保证两条都留 `worldMap.tiles[i].terrain` 前缀） |
| 加做 B1/B2/B3/B7/B11 | 类级断言或前缀断言为主 ⇒ 全绿 | 0 |

**归因要点**：A 档 3 条之所以 **0 红**，是因为唯一触到 `/out of range/` 的 `replaySnapshotContent:324` 喂的是
**真越界数值**（`MAX_SAVE_CURRENT_DAY + 1`），拆分后仍命中保留原骨架的范围条。
⇒ **本单否证锚点（82c6 遗留2）的影响面判断**：原文「消息串是他单在册断言面（**saveGuard 组多条** `/out of range/`）」——
现取 `grep -rn "out of range" src/renderer/state/__tests__/saveGuard*.test.ts` → **rc=1，0 命中**；全仓 `/out of range/`
**仅 1 条**且不在 saveGuard 组、也不会被拆分红。⇒ 锚点把拆分的成本**估重了**，这是本案最值钱的一条读数。

### 4.3 覆盖面空白（本单顺手钉出，交主班排单）

- **A2/A3（resourceNodes 位置）零断言**：`grep -rn --include=*.ts "resourceNodes" src/renderer/state/__tests__` 现取 20+ 处命中里，
  **存档夹具一律写成 `resourceNodes: []`**（`badSampleRestore:87`、`dayPipeline:46`、`economyBalance:21`、`gameStore:17`、`influence:13` 等），
  唯二读到真实节点的是 `mapGen.test.ts:9/68/73/83`——那测的是**生成侧** `mapGen`，不经过 `validateWorldMap`
  ⇒ 这三条判据（A2/A3/B1/B3）**当前完全无测试覆盖**，拆分它们不会红，但也**没有回归网**。
- UI 侧无文本分支：`SaveLoadPanel.ts:206` 只把 `err.message` 原样塞 toast ⇒ 改文案不触逻辑。

---

## 5. 推荐案与最强反对意见

### 推荐（1 条）

**只拆 A 档三条（A1 `currentDay`、A2/A3 `resourceNodes[i].position.{x,y}`），采 §3 口径：类型条 `must be … , got …（type …）`、
范围条保留 `out of range: <值> (allowed <下>..<上>)` 原骨架并**给上界**（A2/A3 现串连界都不报）；NaN/Infinity 归类型条；
B 档 11 条维持现状、以本件 §2.3 表登记；R1（progress 范围沉默）与 R3（`currentDay:null` 静默兜 0）**另案**——
它们要动的是判据而非文案，会让今天读得开的档改后拒载，属人工闸。**
成本读数：在册断言红数 **0**（§4.2），改动局限在 `saveLoad.ts` 的 3 处 throw 表达式（含把合一 `if` 拆成两段），
且 `saveLoad.ts` 在 `npm run type-check`（`tsconfig.renderer.json` `include:["src/renderer/**/*"]`）覆盖内。
落地前置：A2/A3 面**零覆盖**（§4.3），改前须先补三条判别用例（类型错→类型条、真越界→范围条且带界），
否则改完只是"看起来绿"。

### 最强反对意见（1 条）

**「A2/A3 在盘面上近乎不可达（`resourceNodes` 由 `mapGen` 生成，只有玩家手改存档才会出现非整数坐标），
而唯一被证明会误报类别的 A1 也只影响一条 toast 文案；花一次存档错误面的改动预算去修文案，
换来的只是把消息串从 3 条变 6 条——**从此同一族里"有的字段报两类、有的字段报一类"，
可机检性反而下降**（下游若按消息串归类错误，得维护两套规则），
不如把预算给 R1/R3 那两条"坏值静默渗透"的**真**判据缺口。」**

这条反对的强度在 §4.3 与 §2.4 都自证过：A2/A3 无覆盖、可达性低；而消息族一旦**部分拆分**，
"按文案分类"的调用方面对确实更不一致。**本材料不否定它**，只补两条供裁：
①A1 恰是 82c6 探针当年唯一抓到的 E4 实例（`PROBE_P4[currentDay 字符串] → out of range: 12`），
且 `currentDay` 是玩家**最常手改**的字段（改天数＝改进度），可达性远高于 A2/A3；
②若只拆 A1 一条，"两套规则"的批评同样成立但面更小——**折中案＝只拆 A1，A2/A3 与 B 档一并登记为现状**。
⇒ 三条可裁路径：全拆 A（推荐）／只拆 A1（折中）／全不拆只做案 B 式文档声明（最省，但 E4① 继续在册）。

---

## 6. 守线自证

```
$ cd D:/code/colony-game && git rev-parse HEAD
102c65d225dd3631e17b486c5bb8c45144d85f4f
$ git status --porcelain          # 与开工 13:45 逐字同（7 行，全他班在途件）
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
 M docs/insights/colony-suite-timings-20260921.json
 M src/renderer/data/index.ts
?? src/renderer/data/__tests__/loadGate.test.ts
?? src/renderer/data/loadGate.ts
```

- 本单唯一写入：`docs/insights/c927-02-validator-msg-split-adjudication.md`（未跟踪，交主班按精确路径代提交）。**`src/` 零写入**、diff 未落盘。
- 未跑全量 `npm test`（并发窗约束）；探针全程只在内存对象上构造 blob，**不读写任何真实存档目录**、不进 `src/main/index.ts`。
- 临时件：`D:\code\tmp\qoder-executor-20260927-1400-colony38\c927-02.probe.ts` ＋ `c927-02.out.txt`，本班收班自清。
- `docs/insights/` 索引本仓无权威版本，**未代登**。
- 本件不含经济平衡／数值口径结论；§5 只是材料，判据类改动（R1/R3）按波次 brief §4 属人工闸。
