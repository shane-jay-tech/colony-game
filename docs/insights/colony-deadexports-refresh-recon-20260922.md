# colony dead-exports 默认 JSON 108 vs 复跑值对账（c922-118，2026-09-22）

> 只读对账。全程未写 `docs/insights/colony-dead-exports-20260914.json`（他班在途 ` M`），未 `git add` 任何文件。
> 班次：`qoder-executor-20260922-0000-colony9`；HEAD `3f1c8d2`；工作树 8 项（开工/收工同数）。

## 一、结论（一句话）

**净差为零**：committed 108 条 vs 本班复跑 108 条，`(file,name)` 键集只差 2 增 2 消、**且那 4 条是同一对符号换了文件**（c922-11 的 DSL 搬家）。真正未清的欠账不是条数，是**分桶口径**——committed JSON 仍带 B-151 修复前的自计污染语义（108 条全标 `tests-only`），复跑实测其中 **21 条真实测试引用为 0、应归 `internal-only`**。

任务书标题里的「vs 复跑值 117」这个前提**已过期**：117 是 9/17 修复前脚本的读数，现网跑不出 117（详见第四节）。

## 二、锚点复核（三处，两处未漂、一处口径失效）

| 锚点 | 结果 |
|---|---|
| `scripts/audit-dead-exports.mjs:27`「B-151 修复（917 案卷二节定谳）：walkTests 曾把 src 下全部 .ts 当测试文件」 | 逐字命中，未漂 |
| `docs/insights/colony-deadexports-out-param-20260917.md:22`「scanned files=123 entries=117 summary={"dead":0,"testsOnly":117,"internalOnly":0}」 | 逐字命中，未漂；但该读数是**修复前脚本**产物，不可再当现值引 |
| `355e9ec`（c921-05，9/21）「默认 JSON 未 --write 刷新（该文件有 19:39 在途未提交状态，归 audit 刷新批闭合时一并重跑）」 | 存在且原句复现 ⇒ 本单前提成立 |

## 三、读数（命令原文 → 输出）

```
$ node scripts/audit-dead-exports.mjs --out tmp/de-recon-20260922.json
[out] 已写入 tmp/de-recon-20260922.json
scanned files=124 entries=108 summary={"dead":0,"testsOnly":87,"internalOnly":21}
real 0m12.647s   rc=0
```

```
committed : scanned(生成时 123) entries=108 summary={"dead":0,"testsOnly":108,"internalOnly":0}  generatedAt 2026-09-18T19:39:52Z
HEAD 版本  : entries=108 summary 同上（generatedAt 2026-09-18T18:45:50Z）；与在途工作树版 (file,name) 键集全等、交集 108
复跑       : entries=108 summary={"dead":0,"testsOnly":87,"internalOnly":21}
```

三数对照：**scanned 123→124（+1）**、**entries 108→108（0）**、**summary testsOnly 108→87 / internalOnly 0→21**。

## 四、差异逐条归因

### 4.1 scanned 123→124（+1，可精确归因）

```
$ git ls-tree -r --name-only <9/17 HEAD=66dbdc3> -- src | grep '\.ts$' | grep -v '__tests__' | wc -l   → 123
$ 同口径 @HEAD(3f1c8d2)                                                                              → 124
$ git diff --name-status --diff-filter=A 66dbdc3 HEAD -- src | grep '\.ts$' | grep -v __tests__       → A src/renderer/data/dslCore.ts
$ git diff --name-status --diff-filter=D 66dbdc3 HEAD -- src（.ts，非测试）                          → 零命中
```

单文件净增，来源 `d52e1a0`（c922-11「DSL 校验反向依赖消除」，9/21）。

### 4.2 entries 键集：2 增 2 消 ＝ 同一对符号搬文件，非增删导出

| 方向 | file | name |
|---|---|---|
| 消失 | `src/renderer/state/dslEval.ts` | `DslSyntaxError`、`SEASON_NAMES_DSL` |
| 新增 | `src/renderer/data/dslCore.ts` | `DslSyntaxError`、`SEASON_NAMES_DSL` |

机制：`d52e1a0` 把整文件下沉到 `data/dslCore.ts`，`state/dslEval.ts` 退化为 9 行 `export *` 再导出桩（实测该文件现 499 字节）。扫描器 `EXPORT_RE`（`:53`）只匹配 `^export (const|function|class|let) <Name>`，**再导出桩不产生条目** ⇒ 名字总数不变、位置迁移。生产引用面：`DslSyntaxError` 被 `state/__tests__/dslEval.test.ts:2` 经桩消费、`SEASON_NAMES_DSL` 被 `data/__tests__`→`state/__tests__/calendar.test.ts:10` 直接 import 新路径。⇒ **4 条差异全部记为「口径/位置变化」，不记新增或删除导出**。

### 4.3 21 条 tests-only → internal-only ＝ B-151 修复的应有之义（committed 未刷新的实质欠账）

全部 21 条在 committed 与复跑中 **line 号完全一致**，只有 `hitsInTests` 从 ≥2 归 0（旧值含本文件声明行＋同文件消费行＝自计污染）。按文件聚合：

| 文件 | 条数 | 符号 |
|---|---|---|
| `data/modifierValidator.ts` | 4 | validateResourceCost(3→0) / validatePolicyNode / validateCourtEvent / validateRoyalDecree |
| `state/crisis.ts` | 5 | CRISIS_POP_PCT / CRISIS_POP_PCT_FLOOR / CRISIS_ESCALATION_POP_PCT / CRISIS_ESCALATION_MORALE / CESSION_MORALE_DROP |
| `render/MapRenderer.ts` | 3 | AVG_BUILDING_TILES(5→0) / BUILDINGS_ON_SCREEN_TARGET(5→0) / MAP_BUILDING_MAX_SCALE |
| `state/npcDynamics.ts` | 2 | DEFAULT_ACT_PARAMS(3→0) / NPC_ACTION_COOLDOWN |
| `state/scoreCard.ts` | 1 | GRADE_NAMES(3→0) |
| `state/storyDriver.ts` | 1 | ALLY_STANCE_THRESHOLD |
| `ui/SaveLoadPanel.ts` | 1 | SAVE_SLOTS(6→0) |
| `ui/settingsStore.ts` | 1 | setMuted |
| `data/factions.ts` / `data/generals.ts` / `data/military.ts` | 各 1 | FACTION_IDS / GENERAL_TRAITS / UNIT_TYPES |

合计 21。`dead` 桶两条口径下都是 0 ⇒ **这批不是死码**，是「导出只被自己文件内消费」，删除会连带炸编译面，属清理候选而非必删项。

### 4.4 与 `.audit-b151-tmp/de-after.json`（他班 9/21 00:11 复跑）的差：恰好 1 条

他班读数 `{"dead":0,"testsOnly":86,"internalOnly":22}`，本班 `87/21`。逐条对拍（106 交集）**零分桶翻转**，唯一差异是搬家的 `SEASON_NAMES_DSL`：他班那份仍钉在旧路径 `state/dslEval.ts`＝internal-only，本班在新路径 `data/dslCore.ts`＝tests-only（`calendar.test.ts:10` 的真实引用是 `d52e1a0` 同时引入的）。⇒ **355e9ec 自述的「22 条翻案」在当日成立、今天已变 21 条**，脚本 `:28` 注释里的「22/108」随之过期（见第六节）。

余下 5 条只有 `hitsInTests` 上涨、桶不变：`ART_MANIFEST` 13→15、`BUILDING_ART_REUSE` 8→9、`TERRAIN_KINDS` 10→21、`SaveLoadError` 90→103、`serialize` 35→41（9/21 后新增/在途测试所致，含 `saveLoad.test.ts`、`saveGuard3.test.ts` 两件他班在途 ` M`）。

## 五、「117」的真身（前提修正）

`117` 从未出现在 committed JSON 里，它活在**同目录那份 `.bak`**：

```
$ git ls-tree HEAD -- docs/insights/colony-dead-exports-20260914.json.bak
100644 blob dfc12c80…   docs/insights/colony-dead-exports-20260914.json.bak
$ git show HEAD:…bak | entries → 117, generatedAt 2026-09-17T00:29:58Z, summary testsOnly=117
```

版本轨迹（默认 JSON 全部历史只有两个提交态）：`fa63ff0`(9/16)=116 → `c784868`(9/19)=108 → 在途 ` M`(9/18 19:39 生成)=108。⇒ 「108 vs 117」不是「committed 落后于复跑」，而是**修复前脚本的两次读数（116/117）与修复后读数（108）被并列了**；修复后脚本从 9/20 起就跑 108。

## 六、刷新时机建议（按优先级）

1. **现在不能刷**：`--write` 分支（`:119-125`）在写回前会 `copyFileSync(DEFAULT_JSON, DEFAULT_JSON + '.bak')`。而 `colony-dead-exports-20260914.json.bak` 当前是**他班在途 ` D`（HEAD 仍跟踪、工作树已删）**——一旦 `--write` 就会**把这份待删件原地复活**，把别班的删除决定静默改成「修改」。这是硬阻塞，与「JSON 本身在途 ` M`」是两个独立问题。
2. 待该 `.bak` 删除与 JSON 的 ` M` 两笔都落地后，再执行 `node scripts/audit-dead-exports.mjs --write`，并在同一批里把 `scripts/audit-dead-exports.mjs:28` 的「22/108」改到实测值（现值 **21**），否则注释会变成新的「常量说谎」。
3. 刷新属**默认产出件回写**，建议与 `docs/insights/` 索引重建、`colony-dead-exports` 系列的既有刷新批合并，不单开一次写盘。
4. 建议**不要在刷新批里顺手处理这 21 条 internal-only**：`dead=0` 说明没有可直接删的死导出，21 条都要逐个判「是否降级为模块内私有」，属行为改动。

## 七、只读守护自证（本单零写回）

```
pre  md5 74c8a587ac143751d29564d9267ff67b size 16859 mtime_ns 1789760392078176300
post md5 74c8a587ac143751d29564d9267ff67b size 16859 mtime_ns 1789760392078176300   ← 逐位相同
$ git status --short -- docs/insights/colony-dead-exports-20260914.json   →  M（状态未变）
$ git diff --numstat --  该文件                                            → 6  6（前后同值）
$ git status --porcelain | wc -l   → 8（开工/收工同数，零夹带）
```

未新建 `tmp/de-recon-20260922.json.bak`（`--out` 只在目标已存在时建 bak，本班路径为新建）。`docs/insights/colony-dead-exports-20260914.json.bak` 在本单全程保持不存在（＝他班删除态未被复活）。沿用既有只读守护，未另造探针。

## 八、口径边界（在册盲区，非本班结论）

扫描根为 `:13 ROOT='src'` ＋ `:20` 只收 `.ts` 且排除 `__tests__` ⇒ **`scripts/` 工具面导出不在这 108 条的覆盖面内**。该盲区由 **c922-112 点名在册**，本单只沿用不新证、不据此外推「全仓死导出＝108」。

另记两条本机坑（本单实测避开）：`--out` 由脚本内部 `fs.writeFileSync` 落盘，不经 stdout 重定向 ⇒ 未触发在册「子进程 stdout 重定向进 tmp 文件＝0 字节」；对 `zcode-bridge/` 的任何存在性判据须 `--no-ignore`，本单未涉信箱扫描。
