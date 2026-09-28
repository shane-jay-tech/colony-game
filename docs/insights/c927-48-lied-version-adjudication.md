# c927-48 · 旧档「谎标 schemaVersion」是否应拒收 —— 裁决材料附页

- 工单：`c927-48`（cwd `D:\code\colony-game`，档位＝写位但**只加测试**）
- 班名：`qoder-executor-20260928-0340-colony54`｜取数时 HEAD `504c36e`（分支 `codex/architecture-hardening`）
- 时戳：2026-09-28 13:5x（`date` 现取）｜开工 `git status --porcelain` 4 行，全部为在册在途件，本班未动
- 钉桩件：`src/renderer/state/__tests__/liedVersionMigration.test.ts`（新增，43 例全绿）
- **本单零产品码改动**：`src/renderer/state/saveLoad.ts` 未被本班写过一行；本档内所有 diff 只作为**草案**存在。
- 🔴 钉桩件钉的是**现状**，不是理想行为。人工若裁「应拒收」，那 43 例里组 A/组 B/组 D 应当场变红——
  那是设计内判别力，**不要改期望值让它重新变绿**。

---

## 0. 结论速览

1. **现状是一张不对称的表**：`schemaVersion > 9` 一律**拒收**（`saveLoad.ts:388-392`），
   `schemaVersion < 9` 一律**照收并原地覆写**（`:394-397` → `:125-196`）。
   也就是说：**把版本号往高里谎标会被挡，往低里谎标不但不挡、还会造成不可逆的字段损失。**
2. 往低里谎标的净损失实测＝**4 枚字段**（真 v9 档标 v1），分组 `4/2/1/0`（详见 §2）——与上游 `e29e` E5 同向，
   本班把它从"一次性探针读数"升成**盘上常驻用例**。
3. 15 枚注入键**全部无条件覆盖**原值（§3 用 canary 逐键证），迁移链里**没有一处** `if (!(k in s))` 护栏。
4. 谎标低版本还是 **2026-09-27 r5 B2「载荷性字段缺失＝拒载」闸的一条完整旁路**（§5，组 D 已钉）：
   同一份缺 `rngSeed`/`eventHistory` 的档，标 9 拒载、标 1 静默回填 `12345`／`[]`。
   这半条不是本班新发现——`docs/insights/c927-12-loadbearing-hold-backfill-note.md` §0.2／§2／§3 已系统取证，
   本班只把它的**现状**落成了会红的测试。
5. **"是否应拒收"这一裁，盘上给得起一个便宜的判据**（§6.2 三档共用的检测面）：`migrations[L..8]` 的注入键对真 L 版档是**天然不存在**的字段，
   而谎标档会带着它们。实测夹具 51 键里 **15/15 命中**，真·稀疏 v1 档 **0/15 命中** ⇒ 零误伤的检测面存在。
6. 本班**未**改任何护栏、**未**加校验和、**未**碰 `SAVE_SCHEMA_VERSION`（动 schema＝人工闸，w40 §4）。

---

## 1. 术语与三张样例档（组 A/B/C/D 的输入）

夹具：`src/renderer/state/__tests__/__fixtures__/save-v9.json`（35 223 B，mtime 2026-09-22 06:18，
入库笔 `47c12dd`；`state` 顶层 **51 键**，`schemaVersion: 9`，`resources.people: 46`）。

| 代号 | 构造法（全部可复现，见测试件） | 标称版本 vs 内容真实版本 |
|---|---|---|
| 诚实档 | 夹具原样 | 9 ＝ 9（基线） |
| **谎标低档** | `structuredClone(夹具)` 只改 `schemaVersion = 1..8` | 标称 < 实际（＝e29e 的 realDowngrade） |
| **谎标高档（稀疏）** | `saveMatrix.test.ts:23-36` 的 7 键稀疏形制，标 `schemaVersion = 9` | 标称 > 实际 |
| **超前档** | 夹具标 `schemaVersion = 9 + 1` | 高于当版 ⇒ 走 future 分支 |

⚠ 卷宗标题写的是「谎标**高于**实际」。锚点 `e29e` E5 的 4 字段擦除发生在「谎标**低于**实际」方向
（真 v9 内容标成 v1）。两种读法本班**都钉了**（组 A＝低标、组 C＝高标），不把口径判断留给下游猜：
**擦除只存在于低标方向；高标方向迁移链根本不执行**（∴ 组 C 的读数是"跳过迁移＋吃兜底"）。

---

## 2. 逐字段擦除快照（组 A，现状）

基线（诚实档 deserialize 后）：
`populationClasses {farmer:42,worker:4,soldier:0,scholar:0}`｜`grainNegativeDays 13`｜
`lastWarinessReason "国格晋阶"`｜`relicSites` 3 条（ids `r0/r1/r2`）。

| 标称档 | 擦除字段（前值 → 后值） | 净损失数 | e29e E5 报的数 |
|---|---|---|---|
| v1 | `populationClasses` → `{farmer:46,worker:0,soldier:0,scholar:0}`；`grainNegativeDays` 13 → `0`；`lastWarinessReason` "国格晋阶" → `null`；`relicSites` 3 条 → `[]` | **4** | 4 ✔ |
| v2 / v3 / v4 | `lastWarinessReason` → `null`；`relicSites` 3 条 → `[]` | **2** | 2 ✔ |
| v5 / v6 | `relicSites` 3 条 → `[]` | **1** | 1 ✔ |
| v7 / v8 | —（注入值与夹具现值相同，覆盖不可见） | **0** | 0 ✔ |

机理（`saveLoad.ts:126-196` 逐行）：标称 L 会跑 `migrations[L..8]`，只有落在链**前段**的注入步才会压到真值：
`migrations[1]` → populationClasses/grainNegativeDays；`migrations[4]` → lastWarinessReason；`migrations[6]` → relicSites。

三条**只有测试能钉住**的补充现状：
- **擦除发生在 caller 手里那份对象上**（原地改写，`blob.state` 引用不变、`blob.schemaVersion` 被推到 9），
  不是返回值的加工副产品 ⇒ 调用方若在 `deserialize` 前抓了引用、之后再用它，拿到的已是被改过的档（组 A 第 9 例）。
- **返回值面不可恢复**：迁完 `JSON.stringify(GameState)` 里 `"国格晋阶"` 与 `"r0"` 都不再出现（组 A 第 10 例）。
- 净损失字段只有 4 枚，**不是 15 枚**：其余 11 枚注入值恰好等于夹具现值（`conversionQueue []`、
  `factionState` 与 `createFactionState()` 逐字段同、`megaProjects []`、`exclusivePolicies []`、`publicWrath 0`、
  `lastWrathDemandDay null`、`worldWariness 20 = WARINESS_BASELINE`、`lastPropagandaDay null`、
  `endgameAscendDay null`、`endgameLastWaveDay null`、`wrathUltimatumEndDay null`）⇒ **覆盖照样发生，只是看不见**。

---

## 3. 15 枚注入键「无条件覆盖」的 canary 证据（组 B）

给 15 枚键各喂一个可辨识值（`worldWariness 999`、`grainNegativeDays 99`、`lastWarinessReason 'CANARY-REASON'`…），
标称 v1 走链后：**每枚键的落点与"没喂 canary 的同档"逐字节相同**，且返回值序列化里 `canary`/`CANARY` 零命中。
⇒ 现状确证：迁移链对既有值**零尊重**，没有"缺字段才补"的分支。
测试件里还钉了一条 `expect(INJECTED_KEYS).toHaveLength(15)`：**将来 bump 版本加第 16 枚注入键时该用例即红**，
逼后来的人来这张表上对一次账（防的是"材料过期"，不是防改动）。

---

## 4. 锚点漂移与行号实况（按磁盘修正，留痕）

| 锚点原文 | 盘上实况（现取） | 处置 |
|---|---|---|
| `zcode-bridge/outbox/20260925-154159-e29e.result.md` | 该件在 `done/`（17 611 B，mtime 09-26 23:56），outbox 查无 | 路径搬家，按 brief §3 取 done 版使用 |
| E5 表：`relicSites` **1 条**（序列化 305 B） | 夹具 `relicSites` 是 **3 条**（r0/r1/r2），紧凑序列化**恰好 305 B** | 字节数相符、条数是锚点笔误 ⇒ 本档以 3 条为准 |
| 产品码注释 `saveLoad.ts:407` 自述"本文件 :413 回填 12345 ／ :453 回填 []" | 实为 **`:427`**（`rngSeed … : 12345`）与 **`:467`**（`eventHistory: s.eventHistory ?? []`）；c927-12 §0.5 记的就是同一条，**今天两处行号未再漂** | 引用行号一律以本班现取为准 |
| `deserialize` 载荷键拒载块 | `:406-418`（注释在 `:406`，`if` 闭合 `:418`） | 已在 HEAD `504c36e` 内，非在途件 |

夹具自 09-22 起未再改（`git log -- …/save-v9.json` 末笔 `47c12dd`）⇒ §2 的读数在夹具被重导出前有效。

---

## 5. 谎标低档 = 载荷键闸的旁路（组 D，与 c927-12 的分工）

同一份档，只删 `rngSeed` 与 `eventHistory` 两枚载荷键：

| 标称版本 | 现状读数 |
|---|---|
| 9（诚实） | 抛 `Save missing load-bearing field(s): rngSeed, eventHistory` |
| 1（谎标低） | **不抛**；`GameState.rngSeed === 12345`、`eventHistory === []` |

原因是一处行号级事实：`:410` 的判据 `if (schemaVersion === SAVE_SCHEMA_VERSION)` 里的 `schemaVersion`
取自**入参标称值**（`:384`），不是迁移后的值。⇒ 把标称值写低即可绕过 2026-09-27 那道裁决。

**c927-12** 已把这条缺口的取证面（九格矩阵、git 考古"存量真档天然带这两字段"）做透，并给出案 C
（判据挪到迁移之后，改动＝**一个标识符**）。本班不重复其结论，只补一句：
**同一条"用标称值判据"的写法，也正是 §2 那 4 枚字段能被擦掉的同一扇门**——
低标既绕过载荷键闸，又主动请迁移链来覆写自己的真值。裁"要不要拒收谎标档"时，这两件事宜同一张桌上看。

---

## 6. 两问要分开裁（问 1 在册已有三案；本单的题只有问 2）

### 6.1 问 1「migrations 注入 × deserialize 兜底，事实源选谁」——**在册已展开，本单不重开**

`docs/insights/colony-migration-deserialize-dualwrite-design-20260924.md` 已给出
案 A（迁移优先）／案 B（兜底优先，删注入行）／案 C（`LEGACY_STATE_DEFAULTS` 共表）三案与其 §2.1 等价矩阵、§2.3 考古。
**本单只补一条它缺的执行面事实**：该稿 §2.2 的原话是

> ⇒ **今天没有任何一条用例能证明 `migrations[8]` 存在**……结果值两路同源 ⇒ 断言恒绿。

本班组 B 的 15 例 canary 就是那条缺失的证明，且它**只在"迁移确实在世并确在覆写"时才绿**
（`wrathUltimatumEndDay` canary `33` → 被压成 `null` 那一例即 `migrations[8]` 的存在性证明）。
⇒ 三案今天之所以"零改判"，正因为**分叉面只有"低版档已带值"这一格**（该稿 §2.3 自述），
而那格的**唯一现实入口就是谎标档**——于是有问 2。
⚠ 落点区分：该稿 §A2 另提过一个 AST 轨的"双写守卫用例"（落 `scripts/__tests__/`）。本班这条是**运行时轨**，
两者不等价，主班收编时别当重复建设合掉。

### 6.2 问 2「要不要拒收谎标档」——本单的题，三档处置（**本班不选**，命名用甲／乙／丙以免与 §6.1 撞车）

**共同的检测判据**（三档共用，盘上已验证其判别力）：标称 L 的档，`state` 里**不该**含 `migrations[L..8]` 的任一注入键
（真 L 版档那些字段尚未出生）。实取：真 v9 夹具标 v1 ⇒ **15/15 命中**；`saveMatrix` 式 7 键真·稀疏 v1 档 ⇒ **0/15 命中**。
⇒ 该判据零误伤、成本＝一次键集求交，且不需要校验和（e29e 遗留 1 那条"改 schema"的人工闸**不必触发**）。

| 档 | 处置 | 最小改动面 | 连带代价（最重要） | 回滚成本 |
|---|---|---|---|---|
| **甲** | **拒收**一切可证谎标档（判据命中即 `SaveLoadError`） | `deserialize` 内、`runMigrations` **之前**加一道检查（约 +8～12 行），不动 `SAVE_SCHEMA_VERSION` | 🔴 会砸掉在册件的既有输入面：`saveMatrix.test.ts` 组 A 末档靠"真 v9 档标 v8"（`realBlobAt(LAST_TIER)`）驱动，本班组 A 同法；拒收后这批"过链连通性"用例失去输入，要改用"字段真删"的合成档 ⇒ **连带改测试口径约 2 件**，不是纯新增 | 低（单点判据，一次 revert） |
| **乙** | **不拒收，只取消覆写**：判据用于让 15 处注入各加 `if (s[k] === undefined)` 护栏 | `:125-196` 的 15 处赋值加护栏 ⇒ §2 的净损失**当场归零**，没人被拒载 | 等价于 §6.1 的**案 B 弱形式**（保留注入行、但让它尊重原值）⇒ 需要人工同时确认它与该稿"案 B＝删注入行"的取舍关系，别让两案在盘上并存成第三种行为 | 低 |
| **丙** | **维持现状**，只补上报面：`deserialize` 返回面上今天**没有 `schemaVersion`**（c927-12 §0.5 已登记），调用方事后无从知道档从哪版迁上来 | 透出来源版本＋UI 提示；不动判据 | 触及 `GameState` 类型面（加运行时字段或返回元组），改动面比甲/乙大，但**零改判**；4 字段损失照旧发生，只是"看得见" | 中（类型面散到调用方） |

三档共同红线：**都不需要**动 `SAVE_SCHEMA_VERSION` ⇒ 都不触发"改 schema＝人工闸＋补 `migrations[N]`＋改
`saveMatrix.test.ts:156-157` 的『`SAVE_SCHEMA_VERSION` 恒为 9』恒等断言"那一串（e29e 遗留 1）。

**本单交付面**：组 A/B/C/D 把三档的**输入现状**钉成常驻用例。人工落任一档后，
本件应当场变红的部分是：甲＝组 A 全部（抛错而非擦除）；乙＝组 A 净损失数＋组 B 的 15 例（canary 会活下来）；
丙＝组 0/组 E 之外全绿（丙不改行为，只新增可读面）。**这份"谁该红"的对照表是裁完之后的验收尺，不要当 bug 修测试。**

---

## 7. 验收自证（原文命令）

```
cd D:/code/colony-game
npx vitest run src/renderer/state/__tests__/liedVersionMigration.test.ts --reporter=basic
  → Test Files 1 passed (1) / Tests 43 passed (43) / Duration 666ms
npx tsc -p tsconfig.renderer.json --noEmit   → rc=0
git status --porcelain                        → 4 行，全部为在册在途件（本班零改动面）
```
未跑全量套件（同仓并发，w40 §5／w42 §B.4）；全量口径交主班收班取。

## 8. 索引处置声明

`docs/insights` 现有**四份**索引快照（`colony-insights-index-20260915.md`／`-recount-20260917.md`／`-20260919.md`／`-20260927.md`），
**无权威、无哨兵**（w42 §C-colony）。本班**未选权威、未改任何旧快照**，本档是否入索引、入哪一份，交主班随代提交决定。
