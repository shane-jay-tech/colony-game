# c927-41 colony 工作树在途件收口审计（归属／完整性／可提交清单 · 只读）

- 班次：`qoder-executor-20260927-2146-colony47`（波次 19 只读盘点／审计位，本单为第二枚）
- 取证时点：本机 `date` 连读 `Sun Sep 27 22:0x 2026`（定向跑时刻 22:05:12 与 22:05:46，由 vitest 自报）
- 仓现值：`D:\code\colony-game`，分支 `codex/architecture-hardening`，HEAD `0939aa6`
- 性质：**纯审计**。🔴 本班**零 git 写操作**（`add`／`commit`／`stash`／`checkout`／`restore`／`clean`／`push` 一律未执行），
  下方「提交清单」是**给主班的输入**，本班一步未做。
- 对照前档：任务书锚点列的 5 件里 **3 件已不在途**（见 §1），本审计按磁盘现值取，不按卷宗正文取。

---

## 0. 结论速览

1. **磁盘现值 ＝ 5 件**：4 枚 tracked 脏件（3 `M` ＋ 1 `D`）＋ 1 枚未跟踪（本班 c927-40 产物）。`git status --porcelain | wc -l` = **5**，`src/` 侧 **0 件**（`git diff --stat HEAD -- src/` 空、`git ls-files --others --exclude-standard -- src/` = 0）。
2. 🔴 **任务书锚点已过期 3/5**：卷宗写的 `?? src/renderer/data/loadGate.ts`、`?? …/__tests__/loadGate.test.ts`、`M src/renderer/data/index.ts` 三件**都不在工作树里了**——已被主班 `qoder-main-drain-20260926-2341` 于 **2026-09-27 14:5x** 整组移到 `D:\code\tmp\handover-w19\colony-loadGate\`（用户选定"暂存到工作树外"）。⇒ 这三件**不是待修缺陷**，本班未碰、未"顺手恢复"。
3. **拦提交的那枚红已经解掉了**（本审计最有行动价值的读数）：移交件 README 记录该三件把 `eventOrderingSnapshot.test.ts:295` 的枚举桩顶成"期望 7 件、实到 8 件"，从而令 colony 任何提交（含纯 docs）都被 pre-commit 拦。本班定向复跑该桩 → **14 tests / 14 passed / rc=0** ⇒ 门禁现状对 HEAD 干净，**5 枚脏件都不再被这把闸拦**。
4. **`OPTIMIZATION_BACKLOG.md` 的在途改动认到了作者**：`d914-85-colony-doc-drift-fix`（result `finished: 2026-09-15T02:58`，status **done**）明文写"P1-2/P1-3/P1-6 改 `[x]` 并逐条补磁盘实证锚点；P1-4/P1-5 保持 `[ ]` 并各加『现状：』括注"，与本件 diff 的 5+/5− 逐行对得上；文件 mtime `2026-09-15 03:08:29` 与 c924-34 §六记的同值一致 ⇒ **写于 9/15、此后 13 天无人再动**。该班同时改的 `docs/design/00_上手须知_START_HERE.md` **已入库**（现 0 脏）⇒ **同一班的产物只收编了一半**，BACKLOG 这半漂到今天。
5. **`colony-dead-exports-20260914.json` 的 ` M` 是语义零变化的空转刷新**：diff 只碰 `generatedAt`(1) ＋ `line`(4) ＋ `hitsInTests`(1)，`name`/`bucket`/`summary` 全未动；本单对**两版各跑一次 108 条行号探针**，结果**完全相同**（91 中 / 17 漂 / 0 缺文件）⇒ 提交它不带来任何准确度提升。
6. **`.bak` 的 ` D` 与它的入库理由是冲突的**：`c784868`（c918-02，2026-09-19 02:46）的 result 收尾写"**无。.bak 随提交归档（改前快照可回退）**"，即当初是**有意**入库的改前回退点；本单复核其内容为 `117 条 / 2026-09-17T00:29:58Z`，是 `63dca27` 删 9 条之前那份的唯一快照。**但**：c922-08 给的拒绝理由是"唯一存证，删了不可复原"——**这句在本仓不成立**（该件 tracked，删提交后 blob 仍经 `c784868` 永久可达，`git show HEAD:…bak` 本班实测可取）。⇒ 风险等级要下调，裁决理由要重写。
7. **`colony-suite-timings-20260921.json` 是全部脏件里质量最高的一件**：c924-12 于 2026-09-25 21:58 整体重生成，本单验其**内部加和自洽**（`files[]` 157 条、tests 加和 1711 ＝ `totals.tests`；durationMs 加和 122,108 ms ＝ `totals.sumFileWallClockMs`）且**外部仍与磁盘同集**（台账 157 ∩ 磁盘 157，双向差集皆空；4 枚期间被改的测试件 `it(` 数逐一未变）⇒ 可直接 add。

---

## 1. 任务书锚点 vs 磁盘现值（先否证再审计）

| 卷宗「背景与锚点」列的件 | 磁盘现值 | 判定 |
|---|---|---|
| `?? src/renderer/data/loadGate.test.ts` | 工作树无、`git ls-files` 无（`tracked_rc=1`）；实体在 `D:\code\tmp\handover-w19\colony-loadGate\loadGate.test.ts`（3,561 B） | **已移出**，非缺陷 |
| `?? src/renderer/data/loadGate.ts` | 同上，实体 5,409 B 在移交目录 | **已移出**，非缺陷 |
| `M src/renderer/data/index.ts` | 该文件现与 HEAD **无差**（`git diff --quiet HEAD -- …` rc=0，`git status --porcelain -- src/` 空）；接线由 `index.ts.patch` 承载（`git apply --check` rc=0 可干净落回） | **已回退到 HEAD 版**，非缺陷 |
| `M docs/insights/colony-dead-exports-20260914.json` | 在途，属实 | 审 §2.3 |
| `D docs/insights/colony-dead-exports-20260914.json.bak` | 在途，属实（工作树文件不存在） | 审 §2.4 |
| 卷宗**未列**但盘上在途：`M docs/design/OPTIMIZATION_BACKLOG.md` | 在途（开工前即脏） | 审 §2.1 |
| 卷宗**未列**但盘上在途：`M docs/insights/colony-suite-timings-20260921.json` | 在途 | 审 §2.5 |
| 卷宗锚点引的 `zcode-bridge/outbox/c924-12.result.md` | 实际在 **`done/`**（波次 brief §3a：13:11 `--consume` 搬过家；路径搬家、内容未变） | 按 §3a 从 `done/` 取到并采信 |

> 卷宗正文那句"工作树既有 3 个测试相关在途件（含未跟踪 keyboardFlowFocusOrder.test.ts 14 例）非本班产物，未纳入提交"——其中 `keyboardFlowFocusOrder.test.ts` **已于 2026-09-26 19:58 由主班入库**（`1104e33`，该笔显式 `--no-verify`），现 `git ls-files` 命中 ⇒ 该锚点也属过期。

---

## 2. 逐件审计（5 件）

### 2.1 ` M docs/design/OPTIMIZATION_BACKLOG.md` —— 归属已认定：`d914-85`

| 维度 | 读数 |
|---|---|
| 改动面 | `git diff --stat` = **10 行（5 insertions / 5 deletions）**，全部落在 P1 段 `:38-:43` 五行；其余 P0/P2/P3/P4 段零动 |
| 归属证据 | `done/d914-85-colony-doc-drift-fix.result.md:10`：「`OPTIMIZATION_BACKLOG.md`：P1-2/P1-3/P1-6 改 `[x]` 并逐条补磁盘实证锚点（registry.ts:29/86/91、dayPipeline.ts:52、cameraMath.ts 79 行等）；P1-4/P1-5 保持 `[ ]` 并各加『现状：』括注」——与 diff 逐行对应 |
| 时点证据 | 文件 mtime `2026-09-15 03:08:29.225` vs result `finished: 2026-09-15T02:58`；`git diff … \| sha256sum` = `08538b686d9b3e9c66fc70ebe388c56e46c819436bec7983a82f5c986c15623c`，**与本单开工值＝c924-34 §六收班值三者逐字相同** ⇒ 9/15 起无人再改 |
| 完整性 | **自成一体**：改动是纯增补（勾＋注），未删任何既有句子；但它是**在 9/15 现值上写的**，其中 3 处证据锚今日已漂（`cameraMath.ts 79 行`→90、`gameStore.ts:939`→该行为 `  }`、真调用点在 `:961`；且 `:38` P1-1 原文「50 个事件」是 9/15 前既有正文，现为 55） |
| 同班另一半 | `docs/design/00_上手须知_START_HERE.md` 现 `git status --porcelain` = 空、其变更史含 `02de418`/`95a293e`/`7db6b1e` ⇒ **d914-85 的两件产物只入库了一件** |
| 判定 | **可提交**，但建议**先合 c924-34 §4.2 的六行合入稿**（那是 c924-34 为这一整段备好的、锚点已复算过的版本），否则会把 3 处已知过期锚钉进 HEAD |

### 2.2 ` M docs/insights/colony-dead-exports-20260914.json` —— 归属：9/19 凌晨的一次 `--write`

| 维度 | 读数 |
|---|---|
| diff 构成 | 12 行变更＝`generatedAt` ×1 ＋ `line` ×4 ＋ `hitsInTests` ×1（各带 −1）。`name`／`bucket`／`summary.{dead,testsOnly,internalOnly}` **零变更**；两版 `entries` 均 **108**、summary 均 `{dead:0, testsOnly:108, internalOnly:0}` |
| 内容语义 | 在 `generatedAt` 上比：HEAD 版 `2026-09-18T18:45:50.388Z` → 在途版 `2026-09-18T19:39:52.078Z`（相隔 **54 分**）；文件 mtime `2026-09-19 03:39:52` 与之逐秒吻合（＋8h 时区）⇒ 是 `c784868`（c918-02，02:46 提交）**之后 53 分钟**的第二次跑，未随该笔入库 |
| 归属 | 与 c918-02 同族同脚本（`node scripts/audit-dead-exports.mjs --write`），**删除者/写入者无独立 result 留痕**；c918-02 自己 §锚点复核那句"M 状态 diff 经核属同一任务族（9/17 recon 会话的脚本再生成残留）…非外来改动，按任务书可动"正是这族改动的定性 |
| 完整性 | JSON 可解析 ✓、`entries` 108 ✓、文件在库 ✓ ⇒ **形式自成一体**；但**实质上是空转**：本单对两版各跑一次"108 条 `line` 是否仍指向该导出"探针，结果**一模一样＝91 中 / 17 漂 / 0 缺文件** ⇒ 提交它不改变任何现值准确度 |
| 漂在哪 | `artManifest.ts` 五条全漂（如 `ART_MANIFEST` 记 80、实 98）、`modifierValidator.ts` 四条（如 `validatePolicyNode` 记 84、实 84？不——记 74/84 皆非现值）、`MapRenderer.ts` 三条差 1、`saveLoad.ts` `SaveLoadError` 记 21、实 24；另 `dslEval.ts` 两条探针未定位到 export 形（可能 re-export），**不判死** |
| 判定 | **不需要 add**（也不需回退——留着同样无害）。若主班要留一次"真刷新"的痕迹，正解是**在收口时重跑 `--write`**取现行号；⚠ 但该脚本 `:122` 会先 `copyFileSync(DEFAULT_JSON, DEFAULT_JSON.bak)` ⇒ **会复活 §2.4 那枚待删的 `.bak`**，两笔必须同批处置 |

### 2.3 ` D docs/insights/colony-dead-exports-20260914.json.bak` —— 删除者不可判定（在册结论，本单复核后**下调风险**）

| 维度 | 读数 |
|---|---|
| 被删内容 | HEAD 版 830 行、`generatedAt 2026-09-17T00:29:58.335Z`、`entries 117`、`summary {dead:0,testsOnly:117,internalOnly:0}` ⇒ 正是 `63dca27` 删 9 条**之前**那份快照（117 → 108） |
| 入库理由 | `c784868`（2026-09-19 02:46）"dead-exports JSON 刷新至现值 entries=108（63dca27 删 9 条后；**.bak 快照随附**）"；c918-02 result §遗留：「无。.bak 随提交归档（改前快照可回退）」⇒ 当初**有意**入库 |
| 删除者 | 三班次转手都判"**不可判定（无留痕）**"：`c922-08` §E-3 明文如此；`c921-04` 只在"可删清单"里点名它（"16.9KB，主 json 已在库且随本批刷新再覆盖；若重视改前审计可留"）＝**建议**非动作 |
| 本单订正 | `c922-08` 拒绝确认的理由「唯一存证，删了不可复原」**在本仓不成立**：该件是 **tracked** 文件，`git show HEAD:…bak` 本班实测可取（830 行、117 条解析成功）；删除落地后 blob 仍经 `c784868` 永久可达 ⇒ **删除不毁数据**，可无条件回退 |
| 残余风险 | ①`.gitignore` **不含** `*.json.bak`（`git check-ignore` rc=1），而 `audit-dead-exports.mjs:115/:122` 每次写盘都会再造它 ⇒ 删完之后每次刷新都会长出一枚 `?? …json.bak`；②`c922-118` 在册的批次序风险（"`--write` 会静默复活他班的删除决定"）仍成立 |
| 判定 | **可提交（属人工裁决级）**，但建议与一条 `.gitignore` 追加**同批**做，否则只是把脏态从 ` D` 变成周期性 `??` |

### 2.4 ` M docs/insights/colony-suite-timings-20260921.json` —— 归属：`c924-12` 台账刷新单

| 维度 | 读数 |
|---|---|
| 写手与时点 | 件内自述 `producedBy = c924-12（班 zcode-executor-20260925-2155，…）；刷新前版 c923-12；首版 c922-07`、`regeneratedAt = 2026-09-25T21:58:15+0800`、`gitHead = 17b8498`（本单验 `git merge-base --is-ancestor 17b8498 HEAD` rc=0 ✓） |
| 与 HEAD 版差额 | `producedBy` 由 c923-12（`regeneratedAt 2026-09-23T10:41:26`、`gitHead 74cbfa6`、totals **131 文件/1395 例**）→ c924-12（totals **157/1711/1711 passed/0 failed**）；`superseded` 字段完整保留旧快照并注明「c923-12 后两日 c924 执行班提交 25 个新测试件」 |
| 内部自洽 | `files[]` 长 **157** ＝ `totals.testFiles` ✓；逐条 `tests` 加和 **1711** ＝ `totals.tests` ✓；`durationMs` 加和 **122,108 ms** ＝ `totals.sumFileWallClockMs` ✓；`concentration` top3 占 58.0%、`filesUnder100ms` 123 |
| 外部仍对得上盘 | 本单做双向差集：**台账 157 ∩ 磁盘 157，「仅台账」空、「仅磁盘」空**（含 `scripts/__tests__/auditDeadExportsReadonly.test.ts` 这枚 include 第二根）；且 `17b8498..HEAD` 期间被改的 4 枚测试件（`rateDisplayBoundary`/`replaySnapshotContent`/`saveGuard`/`saveGuard2`）**`it(` 数逐一未变**（12/17/17/26），新增的 1 枚正是台账自己声明计入的那枚未入库件 ⇒ 台账钉在两天前的 HEAD，但**测试集构成至今未变** |
| 口径提醒（非缺陷） | `durationMs` 是文件级墙钟、并发互污（件内 `measureNote`/`loadNote` 自述），跨次只比 totals 与 top 序；静态 `it` 总数 1625 vs 台账 1711 的差 ＝ `it.each` 展开，**两口径不可互换** |
| 判定 | **可直接 add**（这批脏件里唯一"整体重生成、自证完备、且仍与磁盘一致"的一件） |

### 2.5 `?? docs/insights/c927-40-optibacklog-health.md` —— 本班前一枚产物

| 维度 | 读数 |
|---|---|
| 归属 | 本单同一班（`qoder-executor-20260927-2146-colony47`）第一枚单 `c927-40` 的卷宗点名产物，263 行 |
| 完整性 | 五节齐（三栏清单/建议归档行/证据/完成标准对照/只读自证），引证 42 项载体；`git diff` 目标件零改动已自证 |
| 判定 | **可直接 add**（纯新增，零冲突）。⚠ `docs/insights/colony-insights-index-*.md` 是主班单点重建件，本班未加行 ⇒ 索引侧的登记归主班收班一次做完 |

---

## 3. 工作树外移交件登记（不是待修缺陷，交回时要按此接）

`D:\code\tmp\handover-w19\colony-loadGate\` 五件，本班**只读**核对：

| 件 | 字节 | README 表列 sha1 | 本班 `sha1sum` 实测 | 判定 |
|---|---|---|---|---|
| `loadGate.ts` | 5,409 | `ace9b964…6982f3b` | **同值** | ✓ |
| `loadGate.test.ts` | 3,561 | `77075c10…f089ac9` | **同值** | ✓ |
| `index.ts.worktree-version` | 1,601 | `251bb616…61a946` | **同值** | ✓ |
| `index.ts.patch` | 1,150 | `ff501809…6344fe` | **同值** | ✓ |

**接得回去**：本单以 `git apply --check`（只读 dry-run）验 `index.ts.patch` 对**当前 HEAD 版** `src/renderer/data/index.ts` **rc=0 干净可落**；跑后 `git status --porcelain -- src/` 仍 **0 行** ⇒ 校验未写盘。

**仍未裁的那一问（本班不代答）**：README §"仍未裁的那一问" —— `loadGate.ts` 的枚举用法会不会把枚举顺序流进存档/结算？答"不会"就要给 `eventOrderingSnapshot.test.ts` 的 7 行清单加第 8 行＝**改门禁判据（人工闸）**；答"会"则校验闸形状要改＝**写位单**。两种都不是主班能自签的，README 自己建议**另派一枚写位单**、把该目录当输入，而不是"顺手把红消掉"。本班附议。

---

## 4. 两栏结论（给主班）

### A 栏：可直接按精确路径 add 的提交清单

> 路径逐字给、**建议分三笔**（每笔自成一体、可独立回滚）。本班一步未做。

**笔 1｜本波两枚只读产物（零风险，纯新增）**

```
git add docs/insights/c927-40-optibacklog-health.md
git add docs/insights/c927-41-uncommitted-audit.md
# 候选说明：docs(colony): c927-40/41 BACKLOG 条目健康度盘点与工作树在途件收口审计（两单同归本笔，零码零新测试件）
```
- 回滚成本：删两枚未跟踪→已跟踪文件，单 `git revert` 即可。

**笔 2｜套件耗时台账（c924-12 的欠账入库）**

```
git add docs/insights/colony-suite-timings-20260921.json
# 候选说明：docs(colony): suite-timings 台账入库（c924-12 于 09-25 21:58 整体重生成，157 文件/1711 例全绿 @ 17b8498；c927-41 复验内部加和与磁盘同集）
```
- 依据见 §2.4。⚠ 该笔会触发 pre-commit 全量（40–60 s），**本班未跑全量**，"现在全绿"是本班对唯一红因（loadGate）已移出的推断＋两枚相关桩的定向读数，不是全量读数。

**笔 3｜BACKLOG 的 P1 五段收编（建议**先**合 c924-34 §4.2，再 add）**

```
# 首选（两步）：
#   1) 用 docs/insights/colony-p1-premerge-verify-20260924.md §4.2 的六行替换 docs/design/OPTIMIZATION_BACKLOG.md :38-:43
#   2) 再执行：
git add docs/design/OPTIMIZATION_BACKLOG.md
# 次选（一步，但把 3 处已知过期锚钉进 HEAD）：直接 add 现有在途版
```
- 3 处过期锚清单（本班实测）：`cameraMath.ts 79 行`→**90**；`gameStore.ts:54/939`→`:939` 现为 `  }`、调用点 `:961`；P1-1 正文「50 个事件」→**55**（三轨差集空）。
- 归属：`d914-85-colony-doc-drift-fix`（9/15），status done，同班另一半已入库 ⇒ 这笔是**补收编**，不是新改动。

### B 栏：需回退／需补件／需人工裁

| 件 | 结论 | 为什么不能进 A 栏 | 出口 |
|---|---|---|---|
| ` M …dead-exports-20260914.json` | **不 add、也不急回退**（空转刷新，提交与不提交对磁盘准确度零差） | §2.2：12 行 diff 全是 `generatedAt`/`line`/`hitsInTests`，两版探针读数同为 91 中/17 漂 | 主班二选一：①留着，等下一次真刷新一并覆盖；②当场重跑 `--write` 取现行号——但**必须与 .bak 同批**（脚本 `:122` 会再造 `.bak`） |
| ` D …dead-exports-20260914.json.bak` | **需人工裁**（不是缺陷、也不是本班能定的事） | §2.3：与 c918-02「随提交归档、改前快照可回退」的入库理由正面对冲；三班次判"删除者不可判定" | 建议：确认删（内容经 `c784868` 永久可回取，风险已被本班下调）**＋同批**给 `.gitignore` 加 `docs/insights/*.json.bak`，否则每次 `--write` 都长回一枚 `??` |
| `loadGate` 三件套（工作树外） | **需补件＝需补一次裁决**，不是"回工作树" | §3：门禁第 8 行的加不加属**改判据**＝人工闸；写位则属另一枚单 | 按移交件 README 建议：另派一枚**写位单**，以 `D:\code\tmp\handover-w19\colony-loadGate\` 为输入（含还原法与四枚 sha1），**不"顺手消红"** |
| `docs/insights/colony-insights-index-*.md` | **需补件（索引登记）** | 本波新入库 15 枚 insight ＋ 本班 2 枚产物均未登记；索引是主班单点重建件，子班不得自加行 | 主班收班一次性重建（先例：c920-01 生成／c922-01 刷新／c922-19 §四已给重建口径：`ls \| sort` 反推条目＋按实测重算头部自述数；并补 `colony-unreachable-resourceSystem-20260912.md` 那枚真缺条目） |
| 全量绿灯读数 | **需补件** | §5 判据④：本班按纪律只跑定向，未取全量 | 主班收班跑一次 `npm run verify`（type-check 0 错＋全量），并把 totals 与笔 2 的台账对账 |

---

## 5. 完成标准逐条对照

| 判据 | 落点 | 自评 |
|---|---|---|
| ① 每件归属判定带证据 | §2 五件各给"写手 result 文件名＋行号／件内自述字段／mtime／sha256 一致性"至少两路；§3 移交件四枚 sha1 逐一复算；§1 另给三件锚点过期的证据 | **达成**（唯一"不可判定"＝`.bak` 删除者，已如实标注并给三班转手在册记录，不硬凑） |
| ② npm test 定向跑在途测试件结果如实记录 | §6：**当前在途测试件＝ 0 枚**（三件 loadGate 已移出、`keyboardFlowFocusOrder.test.ts` 已入库）；本班改跑两枚"与该批在途直接相关"的定向件并如实记录读数 | **达成（按磁盘实况收窄，见 §7 之 1）** |
| ③ 提交清单逐文件路径精确 | §4 A 栏三笔、每枚路径以 `git add <完整相对路径>` 形式给出，B 栏逐件给出口 | **达成** |
| ④ 零 git 操作 | §8：开工/收工 `git status --porcelain` 除本单产物外逐行相同；两枚 json 的 sha1 在两次定向跑前后**逐位未变**；`git apply --check` 为 dry-run 且跑后 src 仍 0 行 | **达成** |

---

## 6. 定向跑读数（判据②，两次，均单文件）

```
$ npx vitest run src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts
 ✓ src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts  (14 tests) 369ms
 Test Files  1 passed (1)      Tests  14 passed (14)      Duration  2.55s      rc=0
  → 该件即 c924-12 锚点里"未跟踪 14 例"那枚；现由主班 1104e33（2026-09-26 19:58，显式 --no-verify）入库，
    该笔说明自述"主班独立复算：该新测试件 14 passed"⇒ 本班复跑与之一致。

$ npx vitest run src/renderer/state/__tests__/eventOrderingSnapshot.test.ts
 ✓ src/renderer/state/__tests__/eventOrderingSnapshot.test.ts  (14 tests) 862ms
 Test Files  1 passed (1)      Tests  14 passed (14)      Duration  2.58s      rc=0
  → 这正是移交件 README 记载"被 loadGate 第 8 件顶红"的那枚门禁桩（:289 起，期望 7 文件清单）。
    loadGate 移出后本班复跑 14/14 绿 ⇒ 判定"拦提交的那把闸现已通"，A 栏三笔不再被它挡。
```

**先确认可跑对象**（判据②收窄的依据）：

```
$ git status --porcelain | grep -E '\.test\.ts'     → 无输出，rc=1   ⇒ 工作树内**零枚**在途测试件
```

**未跑**：全量套件（波次 brief §5 与派单横幅双重纪律）。⇒ "colony pre-commit 现在整体绿"在本档里是**推断＋定向佐证**，不是本班读数。

---

## 7. 本单否证／作废／订正清单

1. **作废初读（判据②形状）**：我先按任务书正文找"在途测试件"，`git status --porcelain | grep -E '\.test\.ts'` **零命中** ⇒ 若照字面执行就是"无事可做即收工"。改按"归属为波次 18-19 的测试相关件"重取对象，才定位到 `keyboardFlowFocusOrder.test.ts`（已入库）与 `eventOrderingSnapshot.test.ts`（被在途件顶红的那枚），两枚定向跑各 14/14 绿。**判据②按磁盘实况收窄为"跑与在途族相关的定向件"，不判 failed。**
2. **否证 `c922-08` 对 `.bak` 的处置理由**：其原文「**拒绝确认删除——唯一存证，删了不可复原**」。实测：该件 tracked（`git show HEAD:…bak` 本班成功取回 830 行／117 条并解析通过），删除后 blob 仍经 `c784868` 可达 ⇒ "**不可复原**"不成立，**结论方向（要人裁）保留，但风险等级要下调**。
3. **否证派单横幅与既有记忆档的一条环境断言**：横幅说"不要主动跑全量套件——它会自写 tracked 的 `docs/insights/colony-suite-timings-20260921.json`"。**从仓内复现不出该机制**：`package.json:18 "test": "vitest run"`（无 reporter 输出件）、`vitest.config.ts` 全文 20 行只有 `environment` ＋ `include`（**无** `reporters`／`outputFile`／`setupFiles`／`globalSetup`，无 `vitest.workspace*`，`ls` rc=2）、`.git/hooks/pre-commit` 全文只跑 `type-check` ＋ `test`、`post-commit` 空、`grep -rn "outputFile|reporters|globalSetup|setupFiles" vitest.config.ts electron.vite.config.ts package.json scripts/` **零命中**、全仓 `suite-timings` 字面只出现在 docs 里。⇒ 台账**只由刷新单自己整体重生成**（件内 `ledgerMaintenanceNote` 同此说）。本班两次定向跑前后两枚 json 的 sha1 逐位未变（§8），与该结论一致。**仍按纪律未跑全量**——纪律成立与否不依赖这条机制断言（并发污染与耗时才是主因）。
4. **订正本单 §2.2 的一处口径**：我在探针输出里一度把 `modifierValidator.ts` 四条都算成"漂"，实际其中 `validatePolicyNode` json 记 74、真实 export 行 **84**、而在途版把它改成了 84 ⇒ **在途版这一条是修对的**。故最终措辞按"两版整体同为 91/17"给（`generatedAt` 与 4 条 `line` 的更新确有实效，只是不足以改变"17 条仍漂"的结论）。
5. **未采信的读数**：c927-38 档头记「本批 outbox 26 枚／done 0 枚」是 21:0x 快照，收班时点已推进（本班开工时 `outbox/c927-*.result.md` 现 29 枚）⇒ 一律以本班自跑命令为准。

---

## 8. 只读与零 git 写自证

```
$ git rev-parse --abbrev-ref HEAD; git rev-parse --short HEAD
codex/architecture-hardening
0939aa6
$ git status --porcelain                      # 开工（21:4x）与收工（22:0x）各取一次，除本单产物外逐行相同
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
 M docs/insights/colony-suite-timings-20260921.json
?? docs/insights/c927-40-optibacklog-health.md
（收工 22:09:32 另加 ?? docs/insights/c927-41-uncommitted-audit.md ＝ 本档；本班在仓内新增共这 2 枚，均为卷宗点名的产出件）

$ sha1sum docs/insights/colony-suite-timings-20260921.json docs/insights/colony-dead-exports-20260914.json
                                                            # 跑测前（22:04）与两次定向跑后（22:05:46、22:06）各取一次，三取逐位相同：
12ea4d46cc12a50228309a0682aef1af3458f87c *docs/insights/colony-suite-timings-20260921.json
8ea50733dfb9343285c906909d3b6ddead8c622c *docs/insights/colony-dead-exports-20260914.json
$ git status --porcelain | wc -l            → 5（22:05:46 两次定向跑后复取仍 5＝无新增脏件；本档尚未落盘）
$ git diff --stat HEAD -- src/              → 空；git ls-files --others --exclude-standard -- src/ → 0 行
$ git diff --quiet HEAD -- src/renderer/data/index.ts; echo $?   → 0（该件与 HEAD 无差）
$ git apply --check ../tmp/handover-w19/colony-loadGate/index.ts.patch; echo $?  → 0（dry-run，跑后 src 仍 0 行）
$ git log --oneline -8                      → 0939aa6 / 0644554 / ab09c23 / 6b2e639 / 4c1d608 / d3f29d4 / d435c59 / 5cab9c7
```

- 本班执行的 git 命令全部是**只读类**：`rev-parse`／`status`／`diff`／`log`／`show`／`ls-files`／`cat-file`／`merge-base`／`check-ignore`／`rev-list`／`apply --check`（dry-run）。
  **未**执行任何 `add`／`commit`／`stash`／`checkout`／`restore`／`clean`／`push`／`rm`；未用 `--no-verify`；未改任何测试判据。
- **未"顺手恢复"任何脏件**：BACKLOG 的 5+/5−、json 的 ` M`、`.bak` 的 ` D` 一律保持原样。
- 临时件纪律：`tmp/` 在 `.gitignore:25` 内（`git check-ignore -v tmp/` 命中），本班探针落
  `D:\code\colony-game\tmp\qoder-executor-20260927-2146-colony47\`，**用完当场自清**（3 件删除＋`rmdir`，`TMP_CLEANED` 已回显），
  仓根与 `tmp/` 下均无本班残留；仓内唯一新增是本档与前一单的 c927-40 产物。
- 未碰主班独占件：`.executor.lock`／`000-QUEUE.md`／`claims.log`（仅经 `claims_writer.py` 写）／`consumed.jsonl`／`zcode-bridge/scripts/*.py`／`docs/insights/colony-insights-index-*.md`。
- 红线：未涉资金/仓位/风控、未涉凭据内容（移交件与 json 均未读值面之外的东西）、未做任何统计数值结论；`.bak` 与 dead-exports 的"条数/行号"属**文档口径**证据，非平衡数值。
