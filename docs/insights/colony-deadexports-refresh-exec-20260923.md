# colony dead-exports 台账刷新批·前置核验执行档（c923-03，2026-09-23）

> 班次：`qoder-executor-20260923-0022-colony2`；cwd `D:\code\colony-game`；HEAD `bee6310`（开工/收工同数）。
> 性质：**零写分支执行档**——前置核验判为「未收口」，故本班**未执行** `--write`、未改 `audit-dead-exports.mjs` 任何一行。
> 上游：c922-118 对账档 `colony-deadexports-refresh-recon-20260922.md`（§六.1/§六.2 给出刷新时机与同批改注释的建议序）。

---

## 〇、档首必记：两文件现值与分支选择（完成标准①）

```
$ git status --porcelain -- docs/insights/colony-dead-exports-20260914.json docs/insights/colony-dead-exports-20260914.json.bak
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
$ ls docs/insights/colony-dead-exports-20260914.json.bak     → No such file or directory（删除态属实，盘上确无此件）
```

**两笔均未落地**（既非 ` M`→干净，也非 ` D`→彻底删除入库）⇒ **走「未收口」分支：零写，只落本档。**
两文件同列本夜纪律档 colony 段的**他班在途 7 项**，对本班是禁碰禁提交区；即便判为「已收口」也需主班先确认归属收口，本班不自行开写。

## 一、结论（一句话）

刷新**仍被硬阻塞**，但阻塞项比 c922-118 记的更精确：**只有 1 个真阻塞**（`--write` 的 `.bak` 复活），第 2 个（「JSON 本身在途 ` M`」）是**写侧**问题而非读数问题；本班另测出**第 3 个此前未记的事实**：在他班在途未收口的窗口里跑 `--write` 会把在途测试改动**烤进默认台账**（实测 1 条符号 +4 命中）。刷新的三个数本班已跑好、直接可用。

## 二、现值快照（完成标准②所需基线）

| 口径 | 命令 | 读数 |
|---|---|---|
| 工作树版（他班 ` M`） | `md5sum docs/insights/colony-dead-exports-20260914.json` | `74c8a587ac143751d29564d9267ff67b`／16,859 B／mtime 2026-09-19 03:39:52／`generatedAt 2026-09-18T19:39:52Z`／entries **108**、summary `{dead:0,testsOnly:108,internalOnly:0}` |
| HEAD 版 | `git show HEAD:…json` | md5 `8208adc6…`／同 16,859 B／`generatedAt 2026-09-18T18:45:50Z`／entries **108**、summary 同上 |
| 两版差异 | python 逐条比对 `(file,name)` 键集 | 键集**全等**；只有 `generatedAt` ＋ 5 条的 `line`（`artManifest.ts` 4 条 +3 行、`getArtByCategory` 等）＋ 1 条 `hitsInTests`（`TERRAIN_KINDS` 12→13）不同 ⇒ 那笔 ` M` 是 9/19 的一次重生成，**条数口径没变** |
| 今日回放 | `node scripts/audit-dead-exports.mjs`（**无参数＝只读**，见 `:126-128`） | `scanned files=124 entries=107 summary={"dead":0,"testsOnly":86,"internalOnly":21}`，48.4s，rc=0 |

台账 vs 今日回放的整体漂移面（`tmp/de-refresh-exec-20260923.json` 逐条对拍）：**105/108 条 `hitsInTests` 变了**、**8 条 `line` 漂**、**5 条从 tests-only 翻成 internal-only**（108→86/21）、**净 −1 条**。

## 三、`.bak` 复活风险复述（真阻塞项，带行号）

`scripts/audit-dead-exports.mjs`：

- `:119-125` `--write` 分支：`if (fs.existsSync(DEFAULT_JSON)) fs.copyFileSync(DEFAULT_JSON, `${DEFAULT_JSON}.bak`)` ⇒ **`:122` 就是复活点**（锚点未漂）。
- 该 `.bak` 是 **HEAD 仍跟踪、工作树已删** 的在册件（`git ls-tree HEAD` 可见 blob `dfc12c80…`，c922-118 §五已证其内容＝修复前 117 条的历史快照）。
- 后果：跑 `--write` 会把这份**他班已判定要删**的件原地写回，`porcelain` 从 ` D` 变 ` M`——把别班的删除决定静默改成「保留并修改」。且 `--out docs/insights/colony-dead-exports-20260914.json`（把默认路径显式当 out 目标）走 `:112-118` 同一复活逻辑，**没有绕行办法**：只要写默认 JSON 就必产 `.bak`。
- 附带：`--write` 还会覆盖他班那笔 ` M`（把 9/19 生成的在途版直接吞掉）。

⇒ **唯一安全序**：主班先按精确路径收口两笔（JSON 的 ` M` 与 `.bak` 的 ` D` 提交入库），此后再 `--write`。收口之后再跑时，`.bak` 已不在 HEAD ⇒ `copyFileSync` 新建的 `.bak` 会以 `?? ` 出现，**须同批把它删掉或写进 `.gitignore`**（这一条 c922-118 §六.2 未提，本班补记）。

## 四、新证：刷新读数受他班在途影响的面（实测很小但非零）

对 4 件在途受版文件逐一算「HEAD blob vs 工作树」在 107 条被扫符号上的词边界命中差：

```
src/renderer/render/MapRenderer.ts              → 无差（逐符号命中相等）
src/renderer/ui/BuildPanel.ts                   → 无差
src/renderer/state/__tests__/saveGuard3.test.ts → 无差
src/renderer/state/__tests__/saveLoad.test.ts   → SaveLoadError 42 → 46（+4）   ← 唯一污染点
docs/design/OPTIMIZATION_BACKLOG.md             → 不涉（扫描根 ROOT='src'，见 :13；docs 面不入台账）
```

⇒ 现在跑 `--write`，`SaveLoadError` 会以**含他班未提交测试改动的 103** 入册（本班实测工作树值；HEAD 侧同符号在测试面是 99）。这就是 c922-118 §六.2 所说「同批改注释」之外的第三个时机约束：**读数会随他班在途漂移**，虽然本窗口只有 1 条。

另核一条反向疑点并**否证**了「在途把 `serialize` 抬高」的猜测：`serialize` 命中 9/22 回放 41 → 今日 51，但 `saveLoad.test.ts` 自身 HEAD↔工作树的 `serialize` 命中都是 7 ⇒ 那 +10 来自 `3f1c8d2..bee6310` 之间**已入库**的三笔测试面提交（`47c12dd` v9 夹具、`c5a0ed7` data→state 测试迁移、`90211aa` 选曲键域钉桩），属正常漂移不是在途污染。

## 五、`:28` 的「22/108」改不改（完成标准③）

现文逐字命中、锚点未漂：

```
$ grep -n "22/108" scripts/audit-dead-exports.mjs
28:// hitsInTests＝测试命中＋本文件全部出现（含声明行），自计污染令 22/108 条 tests-only 无真实测试引用。
```

**本班不动它，并且建议刷新批也不要照字面把它改成 21。** 理由：`:26-29` 整段是 **B-151 缺陷的定谳记录**（"walkTests **曾**把 src 下全部 .ts 当测试文件"），`22/108` 说的是**修复前那版脚本**产出的 108 条里有多少是假 tests-only。而今日实测的 21 是**修复后**的 `internalOnly` 桶——两者不是同一个量：

| 数 | 出处 | 含义 |
|---|---|---|
| 22 | `.audit-b151-tmp/de-after.json`（9/21 00:11 回放）/ 355e9ec 案卷 | 修复**后**当日：假 tests-only（现 internal-only）条数 |
| 21 | 本班与 c922-118 各自回放 | 同一量随 `d52e1a0`（SEASON_NAMES_DSL 搬家）后的现值 |
| 108 | 台账 committed 版 summary | 修复**前**规则的 tests-only 总数（＝假数＝今天看着刺眼的那个） |

⇒ 把 `22/108` 改成 `21/107` 会让这句话读成「修复前污染了 21/107 条」，而修复前跑不出 107 这个数。**这是注释语义问题，不是数字过期问题。**

**出口（交主班二选一，本档不改脚本）**：
- **A（推荐，沿 colony 在册口径 c922-114／c922-124「加订正行、原句一字不删」）**：刷新批在 `:28` 后**追加一行**：`// 时效注记（2026-09-23 回放）：修复后规则现值 entries=107 / testsOnly=86 / internalOnly=21，其中 internalOnly 即本句所指「无真实测试引用」族。`
- **B（任务书原案）**：直接把 `22/108` 替换为实测值——需主班先确认接受上表的语义失真。

## 六、给刷新批的现成参数（照抄即可，不必再探）

1. 先决：主班按精确路径提交 `docs/insights/colony-dead-exports-20260914.json`（` M`）与 `…json.bak`（` D`）两笔，并确认 `git ls-tree HEAD -- …bak` 为空。
2. 跑 `node scripts/audit-dead-exports.mjs --write`（约 **48s**，非 c922-118 的 12.6s——本机现存 124 个受扫文件 × 107 条符号全仓重读；两读数都记过档）。
3. 预期读数：`scanned files=124 entries=107 summary={"dead":0,"testsOnly":86,"internalOnly":21}`；**若与本班值不符，差值应先归因到他班在途测试件**（第四节口径），再判是否有人动了 src 导出面。
4. 同批处理：新出现的 `…json.bak`（删除或入 `.gitignore`）＋ 第五节出口 A/B 的注释决定 ＋ `docs/insights/colony-insights-index-20260919.md` 加 1 行（该档自 c923-01 起头部带机读恒等式，新增 .md 必同步三个数）。
5. 不要顺手处理那 21 条 internal-only：`dead=0` ⇒ 无必删死导出，21 条都要逐条判「是否降级为模块内私有」，属行为改动（c922-118 §六.4 同判）。

## 七、零写自证

```
$ md5sum docs/insights/colony-dead-exports-20260914.json   （跑扫描前后各一次）
74c8a587ac143751d29564d9267ff67b   前
74c8a587ac143751d29564d9267ff67b   后          ← 逐位相同，未写
$ ls docs/insights/*.bak            → No such file   ← .bak 全程未复活
$ grep -n "22/108" scripts/audit-dead-exports.mjs → 第 28 行原样，未改（脚本零改动）
$ git status --porcelain -- docs/insights/
 M docs/insights/colony-dead-exports-20260914.json          ← 他班在途，未碰
 D docs/insights/colony-dead-exports-20260914.json.bak      ← 他班在途，未碰、未复活
 M docs/insights/colony-insights-index-20260919.md          ← 本班 c923-01＋c923-03 两单累计
?? docs/insights/colony-deadexports-refresh-exec-20260923.md ← 本班本单产出档
```

产出件 2 件（本档 ＋ 索引 1 行），均**未 add、未 commit**，交主班按精确路径代提交。
落盘临时件在 `tmp/`（`.gitignore:25` 命中，不进 porcelain）：`tmp/de-refresh-exec-20260923.json`（本班 `--out` 回放，新建故无 `.bak` 副作用）；另 `tmp/de-recon-20260922.json` 是 c922-118 未清理的在盘旧回放，本班只读未改——**顺带记一句本机坑**：`tmp/` 里的历史回放件会被后班当成"现值"误引，本班按其内 `generatedAt` 明确区分了两份。

## 八、命中纪律档 §十二／红线自查

- **经济平衡数值红线**：本档出现的 `SAVE_SLOTS`／`CRISIS_*` 一律**只作符号名出现**（第四、六节里连值都没取），未读未写任何定义处；`hitsInTests` 是引用计数，不是经济数值。
- **§十二 colony 段的「`sandboxSimulation.test.ts` 验收口径失明面」不适用本单**：本单零资源出口、零产码。
- **`calendar.test.ts:21` 恒真断言（在册假绿）与本单有一处耦合值得主班知道**：那一条之所以恒真，是 `c922-131`（`b8bb754`）把四季表唯一化到 `data/dslCore.ts:37`、`state/calendar.ts:4` 改再导出；而**同一次唯一化正是今天台账回放比 9/22 少 1 条的直接原因**（`SEASON_NAMES_DSL` 现有生产引用 ⇒ 扫描器 `:81` 直接 `continue` 不进清单）。也就是说：让断言失效的那笔改动，同时让死导出清单少了一条。本班按纪律**没有**去动 `calendar.test.ts`（不在本单范围）。
- 本机 `rg` 非可脚本化二进制（仅交互式 alias），本档所有计数改走 `git grep`／`grep`／python 并逐条留了命令。
