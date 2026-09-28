# c927-54 · `colony-dead-exports-20260914.json` 在途件收口材料（归因 + 两案，零 git 写操作）

- 班次：`qoder-executor-20260929-0632-colony65`（cwd `D:\code\colony-game`，分支 `codex/architecture-hardening`，开工 HEAD `6bc186e`）
- 本档写入时点：2026-09-29 06:38 +0800
- 性质：**只出材料**。本班零 git 写操作（无 add／commit／checkout／restore／stash），未跑 `scripts/audit-dead-exports.mjs` 的任何形态（`--write`／`--out` 皆写口），未碰四枚未归因在途件。
- 前手来历：本枚曾被 `colony64` 领过，该班 05:56 后静默被停班、**盘上零产出**（只留一枚 337 B 空 result 骨架，已改名留档 `D:\code\tmp\handover-w74\colony64-c927-54-skeleton.result.md`）。本档为**从零接手**，不复用其结论。

---

## 0. 一句话结论

在途 diff 是 **c918-15「只读语义守护测试」的注入验证残留**（不是谁的"台账刷新"），且**HEAD 版与工作树版都是修复前（pre-B-151）脚本的过期产物**：两版的桶故事 `{dead:0, testsOnly:108, internalOnly:0}` 已被 `355e9ec`（9-21 00:12）的 walkTests 修复整体推翻，行号面又各自漂了两代 ⇒ **「提交在途版」与「回退到 HEAD 版」都没有信息增益**；唯一有实质意义的收口是主班在 `src/` 零脏件时重跑一次真刷新（案 A2），并与 `.bak` 复活同批处置。本班按禁写令**不执行**，两案清单见 §4／§5。

---

## 1. HEAD 版／工作树版双报（逐字段）

| 字段 | HEAD 版（`067aeb3c…`） | 工作树在途版 | 现值（源码/脚本现态） |
|---|---|---|---|
| `generatedAt` | `2026-09-18T18:45:50.388Z` | `2026-09-18T19:39:52.078Z` | — |
| 本地墙钟（+0800） | 09-19 02:45:50 | 09-19 **03:39:52**（文件 mtime 逐毫秒吻合） | — |
| `summary` | `{dead:0, testsOnly:108, internalOnly:0}` | **同一值**（diff 未触及 summary） | 修复后脚本在 9-22 实跑为 `{86,22}`（c922-06）、9-27 实跑为 `{86,20}`＋entries 106（c927-56）⇒ **两版皆过期口径** |
| `entries` 条数 | 108 | 108 | — |
| 字节数 | 16,715（`git cat-file -s` 同 index blob） | 16,859 | — |
| sha256 | — | `c531140ea96cc5c669c521e06719abb7e00a564a1b4eeaa11c144a9bc4ec72a0` | — |
| 行尾 | LF | **纯 LF**（CRLF 0 / LF 766），工作树里 git 已报 `LF will be replaced by CRLF` | `core.autocrlf=true`、**无 `.gitattributes`**、`git check-attr text eol` 均 `unspecified` |
| `artManifest.ts` 四条 `line` | 77 / 84 / 102 / 120 | **80 / 87 / 105 / 123**（各 +3） | 现值 **98 / 105 / 124 / 142** ⇒ 两版都指不到导出 |
| `mapSchema.ts` `TERRAIN_KINDS` `hitsInTests` | 12 | **13** | 真实测试命中现值 23（另 3 处是声明文件自身） |
| `name`／`bucket`／其余条目 | — | **零变更**（diff 只有 6+/6−） | — |

配套件（同批、禁碰，只报状态）：

| 件 | porcelain | index blob | 内容 |
|---|---|---|---|
| `docs/insights/colony-dead-exports-20260914.json.bak` | ` D`（工作树无此件，blob 仍在库） | `dfc12c8019b245ec84bc1cf80d35ee1edf5a87b3`（830 行 / 18,217 B） | `generatedAt 2026-09-17T00:29:58.335Z`、`entries 117`、`{dead:0,testsOnly:117,internalOnly:0}` ＝ `63dca27` 删 9 条**之前**的快照，由 `c784868`（c918-02）有意入库（"`.bak` 快照随附"） |
| `.gitignore` | 干净 | — | **不含** `*.json.bak`：`git check-ignore -v docs\insights\colony-dead-exports-20260914.json.bak` ⇒ rc=1（未忽略）⇒ 任何一次 `--write` 都会再长出它 |

diff 全文形状（`git diff -- <json>` 读数，6 处变更）：`generatedAt` ×1、`artManifest.ts` 的 `line` ×4、`mapSchema.ts` 的 `hitsInTests` ×1。

---

## 2. 归因：写手是 c918-15 的注入验证，不是"谁在刷台账"

### 2.1 证据链（五条，全部可复算，命令见 §7）

1. **时点落在单一认领窗口内**。本地 09-19 03:36 `c918-15` claim → 03:41 done（commit `7c1eaab` 03:40:17）；窗口 03:36–03:41 内 `claims.log` **只有 c918-15 一路**。在途 `generatedAt` ＝ 03:39:52.078（与文件 mtime 同一毫秒）落在该窗口正中。
2. **该单自述做了"直写注入"**。`D:\code\zcode-bridge\done\c918-15-colony-audit-readonly-guard-test.result.md` 原文：「**注入验证（试后还原）**：临时把脚本 `writeDefault` 注入为 true（直写语义）→ 用例红；还原后绿」＋「注入验证：`writeDefault=true` 注入 → **1 failed**（mtime 被改写被捕获）」。
3. **注入态下连"无参跑"都会写盘**。守护测试本体是 `execSync('node scripts/audit-dead-exports.mjs')`（`scripts/__tests__/auditDeadExportsReadonly.test.ts:16`），而写口判据在 `scripts/audit-dead-exports.mjs:113/132-138`：`writeDefault` 为真即 `copyFileSync(DEFAULT_JSON, DEFAULT_JSON.bak)` ＋ `writeFileSync(DEFAULT_JSON, …)` ⇒ 注入期间每次跑测试都产出一份新 JSON ＋ 覆盖 `.bak`。**脚本还原了，盘上产物没还原**。
4. **算术指纹对得上"修复前脚本 + 03:39 的源码态"**。`hitsInTests` 12→13：`TERRAIN_KINDS` 的真实测试命中在 `c784868` 是 9、在 `7818fbc`（c918-04，03:08）起是 10；修复前（pre-`355e9ec`）的 `walkTests` 把 `src` 下**全部** `.ts` 当测试文件（`git show c784868:scripts/audit-dead-exports.mjs` 第 26-35 行，无 `__tests__` 过滤），声明文件 `mapSchema.ts` 自身 3 处被计入 ⇒ 9+3=**12**（HEAD 版）、10+3=**13**（在途版）。两版都恰好等于"真命中＋3 处自计污染"＝**同一支修复前脚本的两次输出**。
5. **行号面锁死生成时刻**。在途版的 `artManifest.ts` 80/87/105/123 与 `git show 7818fbc:src/renderer/data/artManifest.ts` 的导出行**逐条相等**；HEAD 版 77/84/102/120 与 `git show c784868:…` 逐条相等。⇒ 在途版反映的是 09-19 03:08–03:39 之间的源码态，之后 `39c90c6`／`14336fc`（9-20 资产瘦身，＋45/−27 与 ＋34/−33）把导出又顶下去 18–21 行，此后无人重刷。

### 2.2 结论与对既有材料的订正

- **写手/为何长期在途**：c918-15 注入验证的**测试副作用残留**。该单只提交了守护测试与 `vitest.config.ts`（`git show --stat 7c1eaab` ⇒ 2 files, 23+/1−），JSON 与 `.bak` 留在工作树；此后每个班都只登记"在途、勿动"，从未有人重跑或回退 ⇒ 挂到今天（10 天 11 班）。
- **订正 `docs/insights/c927-41-uncommitted-audit.md` §2.2** 的归属表述（该档是前手未跟踪件，本班只读不碰）：它写「与 c918-02 同族同脚本（`node scripts/audit-dead-exports.mjs --write`），删除者/写入者无独立 result 留痕」。**修正为**：写入者是 **c918-15**（其 result 自述注入过程＝留痕），触发路径是"注入 `writeDefault=true` 后跑守护测试"，而非有人手跑 `--write`。该档其余判断（"提交它不改变任何现值准确度""不需要 add"）**与本班独立复算同向**，可继续引用。
- **`.bak` 的 ` D` 删除者仍不可判定**（本班未找到留痕）。可判定的部分：注入那次跑动**必然覆盖过** `.bak`（内容当时变成 18:45 版），所以现在这条 ` D` 与 HEAD 的 9-17 快照之间的差额只是"未 stage 的删除动作"；**blob `dfc12c8` 经 `c784868` 永久可达 ⇒ 无论删除还是复原都不毁数据**（与 c927-41 §2.3 的"风险下调"一致）。

---

## 3. 为什么"回退"和"提交"都不解决问题（供主班定调）

1. **桶故事两版皆错**：`355e9ec` 修复自计污染后，`internalOnly` 不再恒 0（9-21 实跑 `{86,22}`／9-27 实跑 `{86,20}`）。任何读这份 JSON 做退役决策的人，拿 HEAD 版或在途版都会得到同一个错故事（108 条全 tests-only）。
2. **行号面两版皆漂**：`artManifest.ts` 四条现值 98/105/124/142，HEAD 版记 77/84/102/120、在途版记 80/87/105/123。
3. ⇒ 在途 diff 的信息含量＝"9-19 03:39 那一刻跑过一次带注入的脚本"，**这条事实的价值在归因（本档），不在这 6 行字节**。
4. ⚠ **本班不得执行项**：`scripts/audit-dead-exports.mjs` 的 `--write`／`--out` 两个写口、以及"跑无参版"（无参版当前虽只打印，但工作树脚本干净不保证下次跑时无人注入）——按波次纪律，本班**一次都没跑**。§4／§5 的配方一律是**给主班的可粘贴文本**，本班未执行、不代为验证执行结果。

---

## 4. 案 A（提交侧）——两个子形态

### A1 · 原样提交在途版（**不推荐**，只登记代价）

代价：把一条已被 `355e9ec` 推翻的过期口径钉进历史，并让 `artManifest` 行号从"错 21 行"变成"错 18 行"；收益＝零。仅当主班判定"必须先让工作树干净、且不接受此刻重跑"时才用。

可粘贴（主班位，逐条精确路径，禁 `-A/-u/.`）：

```
git diff -- docs/insights/colony-dead-exports-20260914.json > D:\code\tmp\c927-54\inflight-6-6.patch
git add docs/insights/colony-dead-exports-20260914.json
git commit -m "chore(insights): dead-exports 在途 6/6 抖动入库（归因 c918-15 注入残留，非刷新；口径已被 355e9ec 推翻，真刷新走 A2）"
```

- ⚠ A1 不含 `.bak`：那枚 ` D` 是独立裁决项（§6）。
- ⚠ 行尾：`git add` 在 `core.autocrlf=true` 下把 LF→LF 原样收（工作树已是纯 LF），入库 blob 与在途版字节一致 ⇒ A1 不引入行尾翻面；翻面风险在**案 B 的 checkout 还原**（见 §5）。

### A2 · 真刷新（**正解**，需写位＋同批处置 `.bak`）

```
git status --porcelain -- src/            # 前置：必须 0 行，否则把在途测试烤进台账
node scripts/audit-dead-exports.mjs --write   # 写 JSON，并当场复活 docs/insights/colony-dead-exports-20260914.json.bak
git add docs/insights/colony-dead-exports-20260914.json
git add docs/insights/colony-dead-exports-20260914.json.bak   # 对已消失的 tracked 件，git add 即 stage 删除（与 §5 的 B2 决定同批）
git commit -m "chore(insights): dead-exports 台账按 B-151 修复后口径真刷新（entries/summary 以本次实跑为准）"
```

- 复验：`python -c "import json;d=json.load(open('docs/insights/colony-dead-exports-20260914.json',encoding='utf-8'));print(d['generatedAt'],d['summary'],len(d['entries']))"` ⇒ `internalOnly` 应 **>0**（9-27 前手实跑为 20；现值请主班现取，本班不代取）。
- 与 `.gitignore` 的关系：`.json.bak` 未被忽略（rc=1）⇒ 若主班要一次了断，把 `docs/insights/*.json.bak` 追加进 `.gitignore` 与 A2 同批，否则每次刷新都会长出 `??`（c927-41 §2.3 残余风险①，本班复核 `.gitignore` 现文无该行）。
- ⚠ 这条**同时是统计/退役决策的输入**：刷新后的桶计数会改 22 条 `internal-only` 的登记面（c922-06 已判定其 internal-only 全部成立）。本班**不下任何退役结论**。

---

## 5. 案 B（回退侧）——可逆形状，两步不可换序

### B1 · 先留档（**必做且先做**）

```
mkdir D:\code\tmp\c927-54
git diff -- docs/insights/colony-dead-exports-20260914.json > D:\code\tmp\c927-54\inflight-6-6.patch
copy docs\insights\colony-dead-exports-20260914.json D:\code\tmp\c927-54\inflight-worktree.json
certutil -hashfile D:\code\tmp\c927-54\inflight-worktree.json SHA256
```

留档基准（本班 06:38 实测，主班复点应逐字相同）：字节 16,859、sha256 `c531140ea96cc5c669c521e06719abb7e00a564a1b4eeaa11c144a9bc4ec72a0`、纯 LF（CRLF 0 / LF 766）。

### B2 · 再反向还原（**行尾安全形态优先**）

```
git cat-file blob 067aeb3c7c47feab68fc4eb8af85df474407be8a > docs\insights\colony-dead-exports-20260914.json
git show HEAD:docs/insights/colony-dead-exports-20260914.json.bak > docs\insights\colony-dead-exports-20260914.json.bak    # 仅当主班决定复原 .bak
git status --porcelain -- docs/insights/
```

- 🔴 **本仓 `core.autocrlf=true` 且无 `.gitattributes`**（`git check-attr text eol -- <json>` 均 `unspecified`）⇒ 若改用 `git checkout HEAD -- <json>`／`git restore <json>`，checkout 走 smudge 管线，**会把 LF 文件刷成 CRLF**：git status 仍显示干净（clean 侧会再转回 LF，往返自洽），但**盘上字节与 index blob 不再相等**，于是 ① 后续任何"字节比对／sha 校验"的对照全废，② 那枚计时敏感的 pre-commit 若用字节比较会莫名翻红，③ `git diff` 可能整文件翻面（766 行）而不是"已复原"。这正是"行尾翻面"的具体形状。
- 用上面的 `git cat-file blob > 文件`（或 `git show <blob-id> > 文件`）取回**裸 blob 字节**，不经 smudge ⇒ 还原后 sha256 应等于 HEAD 版裸 blob 的行尾化前值；复验命令：`python -c "import hashlib;b=open('docs/insights/colony-dead-exports-20260914.json','rb').read();print(len(b),b.count(b'\r\n'),hashlib.sha256(b).hexdigest())"` ⇒ 期望 **CRLF 计数 0**、字节 16,715 侧（若得 16,859 级且 CRLF≠0 即翻面，按 B1 留档重新还原一次并点名）。
- 可逆性：B1 的 patch ＋ 留档件让"再变回在途态"零成本（`git apply D:\code\tmp\c927-54\inflight-6-6.patch` —— ⚠ 反向 apply 也可能带行尾告警，`whitespace`/CRLF 冲突时改走"直接 copy 留档件回原位"这条不依赖 git 的路）。
- ⚠ 本班对 B1／B2 **一条都没跑**（含 `git diff` 之外的任何写形）。

---

## 6. 待人工／待主班裁决项（材料，不判定）

1. **A2 还是 B2**：本班推荐 **A2（真刷新）**，因为两版皆过期，回退＝把错口径钉回原处；但 A2 需写位与 `src/` 零脏件窗口，属主班排程。
2. **`.bak` 命运**：三选（复原 / `git rm` 退役 / 退役＋`.gitignore` 追加）。事实：tracked、blob `dfc12c8` 永久可达、内容＝117 条 pre-`63dca27` 快照、`c784868` 有意入库。**删除不毁数据**，但退役决定属人工级（它同时是"改前快照"惯例的唯一存证）。
3. **删除者**：`.bak` 的 ` D` 至今无留痕 ⇒ 不并入本次归因，留给归属方。
4. **禁碰面（本班全程未动）**：`docs/insights/colony-suite-timings-20260921.json`（1147+/1052−）、`docs/design/OPTIMIZATION_BACKLOG.md`（5/5）、前手 `?? docs/insights/c927-*.md` 九枚、`?? scripts/clean-install-verify.ps1`、`?? src/renderer/ui/__tests__/hudRefreshCost.test.ts`。
5. **卡点**：本枚判据①②③可在**不动该 JSON** 的前提下全部满足（本档即材料），故 result 不因此落 partial；但**完成标准里的"收口"动作本身（提交或回退）超出只读位权限**，本班未做，须由主班按 §4／§5 精确路径执行。

---

## 7. 复算命令清单（全部只读，本班实跑过）

```
git diff --numstat -- docs/insights/colony-dead-exports-20260914.json          # → 6  6
git diff -- docs/insights/colony-dead-exports-20260914.json                    # → 12 行变更，全为 generatedAt/line/hitsInTests
git ls-files -s -- docs/insights/colony-dead-exports-20260914.json docs/insights/colony-dead-exports-20260914.json.bak
git cat-file -s dfc12c8019b245ec84bc1cf80d35ee1edf5a87b3                        # → 18217（.bak HEAD 字节）
git show HEAD:docs/insights/colony-dead-exports-20260914.json.bak              # → generatedAt 2026-09-17T00:29:58.335Z / 117 条
git log --format="%h %ad %s" --date=iso -3 -- docs/insights/colony-dead-exports-20260914.json
git show c784868:src/renderer/data/artManifest.ts | grep -nE "^export (const|function) (ART_MANIFEST|getArtByCategory|BUILDING_ART_REUSE|isArtAvailable)"   # 77 84 102 120
git show 7818fbc:src/renderer/data/artManifest.ts | grep -nE "同上"                                                                            # 80 87 105 123
grep -nE "^export (const|function) (ART_MANIFEST|getArtByCategory|BUILDING_ART_REUSE|isArtAvailable)" src/renderer/data/artManifest.ts          # 98 105 124 142（现值）
git show c784868:scripts/audit-dead-exports.mjs | sed -n '26,35p'              # 修复前 walkTests 无 __tests__ 过滤
git log --format="%h %ad %s" --date=iso --since=2026-09-19 -- scripts/audit-dead-exports.mjs   # 355e9ec 09-21 00:12（B-151）／ff2a9e7 09-28 15:07（c927-64 记忆化）
git show --stat 7c1eaab                                                        # c918-15 只提交测试件＋vitest.config.ts
git check-ignore -v docs/insights/colony-dead-exports-20260914.json.bak        # rc=1
git config --get core.autocrlf                                                 # true
python -c "import os,datetime;st=os.stat('docs/insights/colony-dead-exports-20260914.json');print(datetime.datetime.fromtimestamp(st.st_mtime).isoformat(' '))"   # 2026-09-19 03:39:52.078
```

外部锚点（可读、本班未改）：`D:\code\zcode-bridge\logs\claims.log` 第 2137-2138 行（c918-15 claim 03:36 / done 03:41）、`D:\code\zcode-bridge\done\c918-15-colony-audit-readonly-guard-test.result.md`（注入自述）、`D:\code\zcode-bridge\done\c922-06-colony-internal22-review.result.md` §遗留 1（最早点名该在途件）。
