# colony `.audit-b151-tmp/` 未跟踪残留处置三案建议（c922-133，2026-09-22）

> 班次：`qoder-executor-20260922-0000-colony14`；HEAD `90211aa`；分支 `codex/architecture-hardening`。
> 🔴 **本单是建议单，零处置**：未 `rm`、未 `mv`、未改 `.gitignore`、未 `git add` 该目录任何一件。四件原件在写档全程 mtime/sha256 未变（见第八节自证）。
> 去留属人工裁决（同题已登记 `docs/insights/drain-20260922-pending-human.md` 第 31 条）。本档的作用是：**把不可再生的证据誊写进 git 历史**，让三案里的「删除」不再是毁证。

## 一、结论（一句话）

**推荐案 B（`.gitignore` 一行）为处置出口，A 的「证据入档」这一步已由本档代为完成，C（删除）仅在本档入库之后降为「可接受但无额外收益」**；三案的回滚代价完全不对称：B 一行可 revert、A 把 52,121B 永久钉进历史、C 在 git 层面无解。

## 二、盘存读数（先命令后数字，逐件）

```
$ ls -la .audit-b151-tmp/          # 4 件，目录本身 total 72
$ sha256sum .audit-b151-tmp/*
$ stat -c '%s bytes | mtime=%y' …
$ wc -lc .audit-b151-tmp/*         → 2324 行 / 52,121 字节（合计）
$ du -sb / du -s --block-size=1    → 52121B 表观 / 65536B 实占（4 文件 × 4KB 簇，零子目录）
```

| # | 文件 | sha256（64 位全串） | 体积 B | wc -l | 行尾实量 | mtime（本机 +0800） | 内部 generatedAt |
|---|---|---|---|---|---|---|---|
| 1 | `de-before.json` | `df009f526521037fa053a24c7aa660a55a54fb425b843b86cc2f3520c4f0a6ab` | 16,861 | 766 | CRLF 0 ／ bare LF 766 ／ `\r` 0（纯 LF，末行无换行符 ⇒ splitlines 767） | 2026-09-21 00:10:28.657 | `2026-09-20T16:10:28.653Z` |
| 2 | `de-after.json` | `43ffcc73406550a32d330b4feb5501f830d306f347654093c8de492c8b7220f7` | 16,918 | 766 | CRLF 0 ／ bare LF 766 ／ `\r` 0 | 2026-09-21 00:11:47.106 | `2026-09-20T16:11:47.106Z` |
| 3 | `diff-summary.txt` | `49245ed5f93f9eb3a675023375a16f23317f634517b2ae75e4f5a9016ba7a2d5` | 1,424 | 26 | CRLF 0 ／ bare LF 26 ／ `\r` 0 | 2026-09-21 00:11:59.153 | 无（手抄差集，非脚本产物） |
| 4 | `c922-06-after.json` | `13bbf7310907977f8dcfca50337ea48d8dab3a9799099f44249a684a19d5bbb4` | 16,918 | 766 | CRLF 0 ／ bare LF 766 ／ `\r` 0 | 2026-09-21 21:42:43.897 | `2026-09-21T13:42:43.894Z` |

- 三件 JSON 同构：顶层键 `generatedAt / rule / summary / entries`，`entries` 各 108 条，条目键 `file/line/name/bucket/hitsInTests`，`rule` 串三件逐字相同（`value-exports-only; word-boundary; buckets dead|tests-only|internal-only|wired-dynamicall…`）。
- summary 读数：`de-before {dead:0,testsOnly:108,internalOnly:0}`；`de-after` 与 `c922-06-after` 均为 `{dead:0,testsOnly:86,internalOnly:22}`。
- ⚠️ 行尾口径提醒（纪律档 colony 第 7/8 段坑）：这四件是**未跟踪件 ⇒ 没有 HEAD blob 可对照**，所以「工作树 CRLF 而 blob LF」那条在此不适用；四件实测纯 LF，是本机脚本 `writeFileSync` 直写、未经 autocrlf 翻转。若日后入库（案 A），仓内 `core.autocrlf=true` 且**无 `.gitattributes`**（`ls .gitattributes` → 不存在；`git check-attr text eol -- …` → 两键均 `unspecified`）⇒ blob 存 LF、但**干净 checkout 会把工作树落成 CRLF**，届时本表 sha256 对不上是预期行为，复核请改用 `git show <commit>:<path> | sha256sum`（推演项，未实测入库，因本单不许 add）。

## 三、被谁引用（三口径分别取数；`rg -c` 数的是行数不是出现次数 ⇒ 出现次数一律 `rg -o` 计）

```
$ rg -FoFn '<文件名>' --glob '!.audit-b151-tmp/**' src scripts tests package.json vitest.config.ts tsconfig.json | wc -l   # 代码/门禁面
$ rg -FoFn '<文件名>' --glob '!.audit-b151-tmp/**' docs | wc -l                                                              # tracked 文档面
$ rg -FoFn '<文件名>' --no-ignore D:/code/zcode-bridge D:/code/docs | wc -l                                                   # 信箱面（outbox/done/logs 被根 .gitignore:31-33/43 整层忽略 ⇒ 必须 --no-ignore，否则静默 0 行假绿）
```

| 引用对象 | 代码/门禁面 | tracked 文档面 | 信箱面（含根 docs） |
|---|---|---|---|
| `de-before.json` | **0** | 0 | 3（全在 `outbox/c921-05-…result.md:37/64/70`） |
| `de-after.json` | **0** | 1（`colony-deadexports-refresh-recon-20260922.md:77`） | 4（c921-05 ×3 ＋ c922-118 ×1） |
| `c922-06-after.json` | **0** | 0 | 3（`outbox/c922-06-…result.md:28/93` ＋ `c922-08-…result.md:32`） |
| `diff-summary.txt` | **0** | 0 | 3（c921-05，其中 `:46` 那句是「全 22 条见 diff-summary.txt」= 指针） |
| 目录名 `.audit-b151-tmp` | **0** | 14 命中行 / 12 份 tracked 文档 | 64 |

- **结论 1（承重面为零）**：没有任何 `.ts`／测试／脚本／`package.json` 脚本位／vitest `include` 读它。`vitest.config.ts:6` 的 include 只有 `src/**/__tests__/**/*.test.ts` 与 `scripts/__tests__/**/*.test.ts` ⇒ 删/移/忽略都不动用例数（本班全量实测亦证，见第八节）。
- **结论 2（唯一"活"引用在 git 历史里）**：`git log --all --grep='audit-b151-tmp' --oneline | wc -l` → **24 条 commit message 点名该目录**。其中只有 `355e9ec`（c921-05，9/21 00:12）把它当**留档地点**指：原句「新旧差集留档 `.audit-b151-tmp/de-before.json+de-after.json+diff-summary.txt`」；其余 23 条（`d52e1a0`…`90211aa`）只是「未跟踪 `.audit-b151-tmp/` 零夹带」的自证句 ⇒ 案 C 落地后前者永久悬空、后者无害。
- **结论 3（.gitignore 现不覆盖，已实测否证任务书前提）**：`git check-ignore -v` 对四件与目录本身 **5 次全返回非零 ⇒ 未被忽略**；`rg -n 'audit|tmp' .gitignore` 只有 `:8 .tmp/` 与 `:25 tmp/`，两条都不匹配 `.audit-b151-tmp/`（前者要名字以 `.tmp/` 结尾、后者要名字恰为 `tmp`）。任务书「grep .gitignore 无命中＝未被覆盖」**成立、未漂**。
- 附带风险实测：因未被忽略，任何 `git add .` / `-A` 都会把 52,121B 吞进暂存区（本族纪律已多次为此点名）。这是案 B 的真实收益，不是纯洁癖。

## 四、可再生性与冗余度（三组对照，决定「删除是否＝毁证」）

```
$ node scripts/audit-dead-exports.mjs --out tmp/c14-replay.json          # 今日现行脚本回放
scanned files=124 entries=107 summary={"dead":0,"testsOnly":86,"internalOnly":21}   rc=0
$ git show 355e9ec^:scripts/audit-dead-exports.mjs > tmp/c14-prefix-audit.mjs && node tmp/c14-prefix-audit.mjs --out tmp/c14-before-replay.json
scanned files=124 entries=107 summary={"dead:0,"testsOnly":107,"internalOnly":0}     rc=0     # 修复前规则也能跑，但跑不回 9/21 那份
（两个 tmp 回放件与探针脚本已随本班清理；--out 路径为新建 ⇒ 未触发 .bak 保护，在途默认 JSON md5 全程 74c8a587… 未变、`.bak` 全程保持不存在）
```

| 对照 | 键集 `(file,name)` | 桶 | hits | line | 判读 |
|---|---|---|---|---|---|
| `de-before.json` **vs tracked** `docs/insights/colony-dead-exports-20260914.json`（工作树 ` M` 版） | 交集 108，两侧独有 **0** | 差异 **0** | 3 | 8 | 「修复前规则报 108 全 tests-only」这一**事实已有 tracked 存证**（默认 JSON 本身就是修复前产物）；de-before 独有部分只有 3 个 hits 与 8 个行号的时点差 |
| `de-before.json` vs 同文件 HEAD blob | 交集 108，独有 0 | 0 | 4 | 8 | 同上 |
| `de-after.json` vs `de-before.json` | 交集 108，独有 0 | **22** | 108 | 0 | 修复的真实效果＝22 条翻案＋全表去自计，与 `diff-summary.txt` 首行/末行的恒等式（22 翻案／86 同桶／0 完全不变）自洽 |
| `de-after.json` vs `c922-06-after.json` | 108 全同 | 0（summary 逐字同 `86/22`） | **2**（`ART_MANIFEST` 13→15、`BUILDING_ART_REUSE` 8→9） | 0 | **近重复件**：16,918B 只多记 2 个计数器＋一个时间戳。成因可归因：`c922-06-after` 生成于 9/21 21:42，而 DSL 搬家 `d52e1a0` 是 9/21 **22:37** ⇒ 两份都还把 `SEASON_NAMES_DSL` 钉在旧路径 `state/dslEval.ts`（c922-118 §4.4 记的正是这件事） |
| `de-before.json` vs 今日「修复前规则」回放 | 交集 106，de-before 独有 2（`state/dslEval.ts#DslSyntaxError`、`#SEASON_NAMES_DSL`），回放独有 1（`data/dslCore.ts#DslSyntaxError`） | 0 | 5 | 2 | **规则可回放，快照不可回放**：`d52e1a0` 之后旧路径的两条永久消失 ⇒ de-before 是那个时点的唯一存证 |

**「证据已入 insight」这句前提的真假（逐条机验，别当已成立）**

```
$ python -c "解析 diff-summary.txt 的 22 条 'X tests-only->internal-only hits N->0' 与 colony-deadexports-refresh-recon-20260922.md 比对"
名字在 tracked recon 档内: 22 / 22        # 全覆盖
hits 旧值以「名(旧→0)」在册: 6 / 22        # 16 条旧值不在任何 tracked 文档
逐条原文行在信箱 c921-05 result 内逐字出现: 4 / 22（而 outbox 是 gitignored 磁盘件，且受 `_emptied/` 轮转，不算入历史）
```

⇒ 未在册的 16 条为：`FACTION_IDS 2`、`GENERAL_TRAITS 2`、`UNIT_TYPES 2`、`validatePolicyNode 2`、`validateCourtEvent 2`、`validateRoyalDecree 2`、`MAP_BUILDING_MAX_SCALE 2`、`CRISIS_POP_PCT 2`、`CRISIS_POP_PCT_FLOOR 2`、`CRISIS_ESCALATION_POP_PCT 2`、`CRISIS_ESCALATION_MORALE 3`、`CESSION_MORALE_DROP 2`、`SEASON_NAMES_DSL 2`、`NPC_ACTION_COOLDOWN 2`、`ALLY_STANCE_THRESHOLD 2`、`setMuted 2`（旧值→0）。
**这 16 条已在下面第 4.1 节全量誊写 ⇒ 自本档入库那刻起，「删除」不再等于毁掉唯一逐条记录。**

### 4.1 全量誊写：`diff-summary.txt` 26 行原样（入库后即为 git 历史内唯一逐条表）

```
summary before {"dead":0,"testsOnly":108,"internalOnly":0}
summary after  {"dead":0,"testsOnly":86,"internalOnly":22}
桶翻案 22 条(全部 tests-only->internal-only, hits归0):
FACTION_IDS tests-only->internal-only hits 2->0
GENERAL_TRAITS tests-only->internal-only hits 2->0
UNIT_TYPES tests-only->internal-only hits 2->0
validateResourceCost tests-only->internal-only hits 3->0
validatePolicyNode tests-only->internal-only hits 2->0
validateCourtEvent tests-only->internal-only hits 2->0
validateRoyalDecree tests-only->internal-only hits 2->0
AVG_BUILDING_TILES tests-only->internal-only hits 5->0
BUILDINGS_ON_SCREEN_TARGET tests-only->internal-only hits 5->0
MAP_BUILDING_MAX_SCALE tests-only->internal-only hits 2->0
CRISIS_POP_PCT tests-only->internal-only hits 2->0
CRISIS_POP_PCT_FLOOR tests-only->internal-only hits 2->0
CRISIS_ESCALATION_POP_PCT tests-only->internal-only hits 2->0
CRISIS_ESCALATION_MORALE tests-only->internal-only hits 3->0
CESSION_MORALE_DROP tests-only->internal-only hits 2->0
SEASON_NAMES_DSL tests-only->internal-only hits 2->0
NPC_ACTION_COOLDOWN tests-only->internal-only hits 2->0
DEFAULT_ACT_PARAMS tests-only->internal-only hits 3->0
GRADE_NAMES tests-only->internal-only hits 3->0
ALLY_STANCE_THRESHOLD tests-only->internal-only hits 2->0
SAVE_SLOTS tests-only->internal-only hits 6->0
setMuted tests-only->internal-only hits 2->0
同桶仅hits去自计 86 条;完全不变 0 条
```

（`diff-summary.txt` 是 24 行翻案清单＋首 2 行 summary＋末 1 行恒等式，`wc -l` 26 与 `22+1+2+1` 自洽。）

## 五、三案影响面对比

| 维度 | A 归档进 `docs/insights`（原样入库 4 件） | B 加 `.gitignore` 一行 | C 删除（证据已入 insight） |
|---|---|---|---|
| 历史体积 | **+52,121B 永久**（`git rm` 也回收不了，只能重写历史＝违纪） | 0 | 0 |
| 工作树基线 | 8 → 7（`?? ` 消失，代价＝目录变成受版件继续漂） | **8 → 7**（且文件留本机） | 8 → 7（文件消失） |
| 可再生性收益 | 原件跨机可取；但 autocrlf 使 sha256 在别的 checkout 上失配（第 2 节⚠️） | 无（原件仅本机） | 无 |
| 证据保全 | 最优（含 22 条翻案的逐条 JSON） | 与今日等长（盘上件仍在） | **依赖本档先入库**；否则 16 条 hits 旧值＋9/21 时点快照永久消失 |
| 近重复件问题 | **把两件近重复一起入库**（`c922-06-after` 比 `de-after` 只多 2 个计数器；`de-before` 与 tracked 默认 JSON 桶差 0） | 不涉及 | 不涉及 |
| 悬空指针 | 无（`355e9ec` 的「留档」句改为「已入库到 docs/insights/…」更佳但非必需） | 无（目录仍在原地） | **`355e9ec` 留档指针永久悬空**，另 23 条自证句无害 |
| 误吞风险（`git add .`） | 归零 | 归零 | 归零 |
| 回滚难度 | 中：`git revert` 可，但历史体积不可回收 | **低：一行提交即可，零数据损失** | **高：git 层面无解**，只能靠盘外备份 |
| 需要人工同步的台账 | 无强制 | **有**：`drain-…-pending-human.md` 第 31 行 + 12 份 tracked 文档里的「8 项＝开工数」自证句 + 分区纪律档「colony 基线 8 项」 | 同 B（还要加一条「已删」说明） |
| 本班是否执行 | **否** | **否** | **否**（任务书与派单双令：删除案不许落地） |

## 六、三案各自完整回滚说明（含采纳步骤；命令均可直接粘贴）

### 案 A —— 归档进 `docs/insights`

采纳步骤
1. 前置：等 `docs/insights/colony-dead-exports-20260914.json`（` M`）与其 `.bak`（` D`）两笔在途收口，否则 `docs/insights` 面 add 极易夹带他班件（c922-01/c922-08 均已点名同源）。
2. 建议取 **A2 子案**：只入 `diff-summary.txt` ＋ `de-before.json`（两件各有不可再生内容），弃 `de-after.json`/`c922-06-after.json`（前者已被本档 §4.1 覆盖且与 tracked recon §4.3 表冗余，后者只多 2 个计数器）。
3. `mkdir -p docs/insights/auditb151-evidence && mv .audit-b151-tmp/diff-summary.txt .audit-b151-tmp/de-before.json docs/insights/auditb151-evidence/`
4. `git add docs/insights/auditb151-evidence/diff-summary.txt docs/insights/auditb151-evidence/de-before.json`（**禁 `-A`/`-u`/`.`**）→ `git diff --cached --stat` 复核只含 2 路径 → `git commit`（本仓 pre-commit 会跑 type-check＋全量测试）。
5. 入库后复验：`git show HEAD:docs/insights/auditb151-evidence/de-before.json | sha256sum` 应为 `df009f52…`（源件纯 LF ⇒ 不会被 clean 侧改动；若不等立即停手回报）。
6. 可选：`docs/insights/colony-insights-index-20260919.md` 补 1 行（该档纯 CRLF，89 行；按 c922-19 的字节级插入＋前后行 assert 姿势，勿整体重写行尾）。

回滚 A
- `git revert --no-edit <A 的 sha>` ⇒ 生成删除提交，工作树里 `docs/insights/auditb151-evidence/` 消失；**`.git` 内 blob 永久留存，体积不可回收**（要回收只能重写历史＝越界）。
- 把原件放回原位（若 A 采纳时留了盘外副本）：`cp <备份>/de-before.json <备份>/diff-summary.txt .audit-b151-tmp/ && sha256sum .audit-b151-tmp/*` 逐项对 §二表（`df009f52…` / `49245ed5…`）。
- 若 A 落地后又想回到今日态：`git revert <A>` ＋ `git checkout <A^> -- .audit-b151-tmp` 不适用（该目录从未被跟踪 ⇒ 此路**取不回被 mv 走的原件**，所以 A 的「回滚」必须以 §二表 sha256 复核为闭合条件，而不是以 git 为保险）。

### 案 B —— 加 `.gitignore`

采纳步骤
1. 在 `.gitignore` 末段（与 `:8 .tmp/`、`:25 tmp/` 同类位置）追加**注释＋一行**：
   `# c921-05 B-151 对账证据留档（本机物证，不入库；见 docs/insights/colony-auditb151-tmp-20260922.md）` / `.audit-b151-tmp/`
2. 复验命中：`git check-ignore -v .audit-b151-tmp/de-before.json` ⇒ 输出应含新行号；`git status --porcelain | wc -l` ⇒ **8 → 7**。
3. `git add .gitignore`（唯一路径）→ `git commit`。
4. 台账同步（必做，否则下一班把它当新脏件）：`docs/insights/drain-20260922-pending-human.md` 第 31 行结案、分区纪律档「colony 工作树基线 8 项」改 7 项、12 份 tracked 文档中含 `.audit-b151-tmp` 的「8 项＝开工数」自证句（`rg -ln '\.audit-b151-tmp' docs`）。信箱历史 result 属留痕，**不改**。

回滚 B（三案里唯一「一行提交＝完全复原」）
- `git revert --no-edit <B 的 sha>`，或手工删掉那一行（含注释）后 `git add .gitignore && git commit`。
- 复验：`git status --porcelain | wc -l` 回到 **8**、`git check-ignore .audit-b151-tmp/de-before.json` 返回非零。
- 数据面零损失（文件从未被删）：`sha256sum .audit-b151-tmp/*` 应与 §二表逐字相同。
- 台账面若已改成 7 项，需同批改回（`rg -n '基线.*7 项|8 项' docs/insights/drain-20260922-pending-human.md`）。

### 案 C —— 删除（**本班不执行，本档也不代执行**）

采纳前置（三条不齐就别删）
1. 本档已入库（§二表 4 个 sha256 ＋ §四可再生性对照 ＋ §4.1 二十二条全表 ⇒ 不可再生内容已在 git 历史内）。
2. 等 dead-exports 默认 JSON 的刷新批闭合（c922-118 §六：现刷会复活他班待删的 `.bak`＝硬阻塞；`de-before` 与那份 JSON 桶差 0，同批处置更经济）。
3. 人工点头并接受：`355e9ec` 的「留档 `.audit-b151-tmp/…`」指针自此悬空（建议同时在该 commit 之后补一条 `docs/insights` 说明行指回本档，**不改写历史**）。

采纳步骤（交人工执行）
`cd /d/code/colony-game && sha256sum .audit-b151-tmp/* > /d/code/tmp/auditb151.sha256 && rm -rf .audit-b151-tmp`（删前先落校验单；是否另存 `D:/attic/` 归档 tar 由人工定——那是 cwd 外路径，子班不得代做）。

回滚 C —— **git 层面无解**：四件从未被跟踪 ⇒ 不在任何 blob/tree 里，`git log --all`、reflog、stash 全取不回。仅有三条出口：
1. 盘外备份：`sha256sum -c /d/code/tmp/auditb151.sha256` 校验后放回；或 Windows「文件历史记录」/卷影副本还原该目录。
2. 若曾走 A（先归档再删）：`git show <A^或A>:docs/insights/auditb151-evidence/de-before.json > .audit-b151-tmp/de-before.json` ⇒ 这是「A 之后再 C」唯一的取回保险，也是 A 唯一实打实的价值。
3. 语义重建：按 §四命令重跑现行脚本与 `git show 355e9ec^:scripts/audit-dead-exports.mjs` 回放 ⇒ 可得 `107 / 86+21` 的**今日**读数，**但拿不回** 9/21 时点的 `108`、`86/22`，也拿不回旧路径 `state/dslEval.ts#SEASON_NAMES_DSL(hits 2)`、`#DslSyntaxError(hits 11)` 两条（`d52e1a0` 后物理消失）。⇒ 这一条就是「删除不可逆」的硬证据。

## 七、推荐与理由 ＋ 需裁决项

**推荐：B 为主出口；A 的「证据入档」部分由本档代为完成（不额外入库原 JSON）；C 不在本轮做。**
1. 承重面实测为零（代码/测试/门禁/`vitest include` 全 0 命中）⇒ 忽略它不影响任何门禁判定，B 的收益（消误吞、porcelain 归 7、留原件）比 A 大而代价比 A 低。
2. A 的真实收益只有「跨机可取原件」，但代价不对称：52,121B 永久历史＋两件近重复（16,918B 换 2 个计数器）＋`de-before` 与 tracked JSON 桶差 0 ⇒ 性价比最低；autocrlf 还让它连 sha256 稳定性都不给（第 2 节⚠️）。
3. C 的唯一正当性前提「证据已入 insight」**此前不成立**（16/22 条 hits 旧值与 9/21 时点快照都在未跟踪件里）；本档誊写之后该前提**才成立**，但删了相对 B 只多省一个本机目录，且历史指针悬空、回滚无解 ⇒ 建议 B 生效一个复核窗（≥2 周或下一次人工审计）后再单独议 C，届时删除的是「已被忽略、且逐条内容已入历史」的目录，风险最低。
4. 若人工更看重「审计原件随仓库走」，那就取 **A2 子案**（只入 `diff-summary.txt` ＋ `de-before.json`，弃两件 after），并同时做 B 对剩余两件——两案不互斥，这是本单能给出的最省历史体积的归档形态。

需人工裁决（子班一律不动）
- ① 三案择一（推荐 B；A2 可叠加）。
- ② 案 B 的台账连带项：「colony 工作树基线 8 项」→ 7 项（`drain-…-pending-human.md:31` 已要求），以及 12 份 tracked 文档的自证句是否逐份改写（还是只在头部加一条「基线自 <sha> 起为 7 项」的集中说明）。
- ③ `355e9ec` 留档指针在 C 情景下的补偿方式（补说明行 vs 接受悬空）。
- ④ 本档与 `colony-deadexports-refresh-recon-20260922.md`（c922-118）是否合并索引条目（同族第 5 份 dead-exports 档）。

## 八、只读守护自证（本单零处置）

```
$ git status --porcelain | wc -l     → 8（写档前） / 8（写档后，剔除本档自身与其索引行）
$ sha256sum .audit-b151-tmp/*        → 与 §二表四串逐字相同（写档后复跑）
$ ls -la .audit-b151-tmp/            → 4 件、mtime 四值不变、无新增无删除
$ md5sum docs/insights/colony-dead-exports-20260914.json      → 74c8a587ac143751d29564d9267ff67b（写档前后同值，零夹带）
$ ls docs/insights/colony-dead-exports-20260914.json.bak       → 不存在（他班删除态未被任何动作复活）
$ git diff --numstat -- <7 件在途>   → 与开工同（本班一行未改）
```
- 本班全量自取基线（不抄上班数）：`npx vitest run` → **Test Files 130 passed (130) ／ Tests 1395 passed (1395) ／ Duration 27.39s @`90211aa`（脏树 8 项原样）**。与 colony13 的 130/1395 逐位相同 ⇒ 本档改动不触碰用例面（vitest include 不含 `docs/`，见第三节）。
- 红线遵守：经济平衡数值零触碰（`CRISIS_*`／`SAVE_SLOTS` 等只作**符号名**引用 §4.1 既有清单，未读未改任何数值定义）；未 `git add`／未 `rm`／未 `mv` 该目录任何一件；未 push、未改历史、未 `--no-verify`；`zcode-bridge/inbox` 任务书只读，信箱三步在桥侧目录内完成。
- 本班自留临时件已清理：`tmp/c14-vitest-baseline.log`、`tmp/c14-replay.json`、`tmp/c14-prefix-audit.mjs`、`tmp/c14-before-replay.json`（都在 gitignored 的 `tmp/`，收班前删除）；`tmp/` 内他班件一件未动。

## 九、复取命令（复制即用）

```bash
cd /d/code/colony-game
ls -la .audit-b151-tmp/ && sha256sum .audit-b151-tmp/* && wc -lc .audit-b151-tmp/* && du -sb .audit-b151-tmp
python -c "import pathlib;b=pathlib.Path('.audit-b151-tmp/diff-summary.txt').read_bytes();print('crlf',b.count(b'\r\n'),'bare_lf',b.count(b'\n')-b.count(b'\r\n'))"
git check-ignore -v .audit-b151-tmp/de-before.json ; echo "rc=$? (非零＝未被忽略)"
rg -FoFn 'de-after.json' --glob '!.audit-b151-tmp/**' src scripts tests docs | wc -l
rg -FoFn '.audit-b151-tmp' --no-ignore D:/code/zcode-bridge | wc -l      # 信箱面必须 --no-ignore
git log --all --oneline --grep='audit-b151-tmp' | wc -l                   # 现值 24
node scripts/audit-dead-exports.mjs --out tmp/replay.json                 # 今日读数：124 文件 / 107 条 / 86+21
npx vitest run                                                           # 现值 130 文件 / 1395 例
```

## 十、落案 B 执行记录（2026-09-23 夜，`20260922-1833-pd04`／班 `qoder-executor-20260923-0022-colony1`）

> 用户 2026-09-22 18:2x 拍板采纳**案 B**（见 §六「案 B —— 加 `.gitignore`」）。本节＝执行留痕 ＋ **基线变更集中说明**（§六 采纳步骤 4 点名的「12 份 tracked 文档自证句」按集中处理、**不逐份改写**）。

### 10.1 改了什么

- `.gitignore`：末段追加**注释一行＋规则一行**（规则行 `.audit-b151-tmp/` 现落第 29 行，注释自带指回本档的指针）。其余 26 行规则一字未动。
- **未 `rm`、未 `mv`、未 `git add`、未 commit**：四件原件仍在原地，§二表 sha256 逐字未变（复算见 10.3）。
- 台账同步三处：`docs/insights/drain-20260922-pending-human.md` 编号 31 条（物理第 51 行）结案 ＋ 第 70／71／99 行同批标注、分区纪律档 `tmp/executor-drain-discipline-20260923.md`「colony-game 段」8 项→7 项、本节。

### 10.2 「colony 工作树基线」变更集中说明（覆盖全部历史自证句）

**基线变更：自 `.gitignore` 落 `.audit-b151-tmp/` 一行起，colony-game `git status --porcelain` 由 8 项 → 7 项。**

- 本节生效**之前**写入的档里，凡「脏树 8 项＝开工同数」／「未跟踪 `.audit-b151-tmp/` 零夹带」式自证句，都是**当时盘态的真实读数，一律不回改**（信箱历史 result 同属留痕，§六 步骤 4 已明令不改）。
- 份数订正：本夜现取 `git grep -l "\.audit-b151-tmp" -- docs` ＝ **14 份／42 命中行**（不是 §六 写的 12 份），其中同时含「8 项」字样的仅 **6 份**。＋2 份＝本档自身与其在 `colony-insights-index` 的登记行，属 c922-133 之后新增。集中说明按**目录命中面**生效，故 14 份同样适用。
- ⚠️ 复验口径两条坑：① **"改完即 7"是错的**——本单两笔受版件（`.gitignore` ＋ 本档）在主班代提交前各自占一行脏位：只落 `.gitignore` 时 porcelain 读 **8**（`?? .audit-b151-tmp/` 消失、`.gitignore` 转 ` M`），本档也写完即读 **9**（他班 7 ＋ 本单 2）；**主班按精确路径提交这两笔后才落 7 项稳态**。② `wc -l` 口径坑（本夜实测）：`?? .audit-b151-tmp/` 作 porcelain **末行**时，`git status --porcelain | wc -l` 报 **7 而权威行数是 8**（末行不带换行符）；忽略生效后无 `?? ` 行，`wc -l` 与权威行数相等（9＝9）。计数一律用 `python` splitlines 或 `cat -n`。§六 步骤 2 的「8 → 7」即时读数因此不成立。
- 本机无 ripgrep（夜纪律档 §四 已点名）⇒ §六／§九 里的 `rg` 命令本夜一律以 `git grep` 等价复算。

### 10.3 本夜实测读数（命令可复算）

```bash
cd /d/code/colony-game
git check-ignore -v .audit-b151-tmp .audit-b151-tmp/*   # 5 目标全命中 .gitignore:29:.audit-b151-tmp/（改前 5 次全 rc=1）
git status --porcelain                                  # `?? .audit-b151-tmp/` 已消失
sha256sum .audit-b151-tmp/*                             # 四串与 §二表逐字相同 ⇒ 案 B 零数据面动作
git diff --cached --name-only | wc -l                   # 0：子班未 add
```

- **案 C 未采纳的后果留痕（§七 需裁决项 ③ 自此不适用）**：走的是 B 而非 C ⇒ 目录保留、只忽略，故 `355e9ec` 的「留档 `.audit-b151-tmp/de-before.json+de-after.json+diff-summary.txt`」指针**不悬空**，无需再补"改指新档"的说明行；另 23 条点名 commit message 的自证句本就无害。若将来改走 C，须回 §六「回滚 C」三条出口重议，且 `git` 层面无解这一点不因本案改变。
- **§七 需裁决项 ② 已收口**：14 份文档的自证句走「集中说明」（本节），未逐份改写。
- 未触碰面（红线自查）：经济平衡数值／`CRISIS_*`／存档兼容／`SAVE_SLOTS` 零改动；`vitest.config.ts` 的 include 不含 `docs/`，故本档与 `.gitignore` 都不动用例面（§三 结论 1）。
- 本机在途他班 7 项一行未改；`.bak` 的 ` D` 状态保持原样未复活。
