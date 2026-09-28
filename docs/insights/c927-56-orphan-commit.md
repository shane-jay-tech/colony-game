# c927-56 · colony 孤儿交付物归位提交（四批单）磁盘复核＋可批形状 —— 只读位，零 add／零 commit

- 班名：`qoder-executor-20260928-0210-colony51`｜档位：**只读位**（波次 41 横幅）
- cwd：`D:\code\colony-game`｜分支：`codex/architecture-hardening`
- 取数时 HEAD：`cc75103`（`git log -1` → `2026-09-28 01:46:48 +0800 docs(colony): c927-44/47/49 三单收口…`）
- 取数时戳：`2026-09-28 11:3x`（本机 `date` 连取 11:34:53 / 11:35:31 / 11:37:00；跨时点引用须复跑下方命令）
- 性质：**裁决/执行材料**。本班 `git add`／`commit`／`stash`／`checkout`／`restore`／`clean`／`push` **一律未执行**（横幅与波次 brief §5 双禁），
  下文「命令留档」＝**给主班的输入**，一步未做。

---

## 0. 结论速览（先否证再给形状）

1. 🔴 **卷宗前提过期 2/4**：任务书写「按 c922-08 执行**前 2 族**归位」——族 A、族 B **早已入库**，
   落库班分别是 `86b27c7`（`c923-04`，族 A MASK_FILL_WHITE）与 `9d9fcbf`（`c923-05`，族 B saveLoad＋4 例／saveGuard3 注释）。
   两族四件 `git diff --stat HEAD --` **全空**、工作树不再脏 ⇒ 本单无 A/B 可做，「前 2 族归位」这条判据**已在 9-23 由他人闭合**。
2. 盘上现存 **4 枚脏件**，与 c922-08 当年 8 项清单的交集只剩族 C／族 D 两枚 ＋ 卷宗**未列**的两枚（BACKLOG、suite-timings 台账）。
   `.audit-b151-tmp/` 已由 `bee6310` 落 `.gitignore:29`（原判据 #8 已闭合，实测 `git check-ignore` rc=0）。
3. **只有 1 件是"可直接精确路径 add"形状**：族 E `docs/insights/colony-suite-timings-20260921.json`（c924-12 于 09-25 21:58 整体重生成的欠账入库）。
   本班在 `cc75103` 独立复算：台账 157 文件 ∩ 磁盘 tracked 测试件 157 枚，**双向差集皆空**；`files[].tests` 加和 1711 ＝ `totals.tests`；
   `durationMs` 加和 122108 ms ＝ `totals.sumFileWallClockMs`；`git merge-base --is-ancestor 17b8498 HEAD` **rc=0**。
4. 🔴 **族 C 与族 D 结构上绑死，不能分两笔**：`scripts/audit-dead-exports.mjs:121-124` 在写默认 JSON 前会
   `copyFileSync(DEFAULT_JSON, DEFAULT_JSON.bak)` ⇒ 任何"真刷新"都**当场复活**族 D 那枚待删 `.bak`。
   且 `.gitignore` 不含 `*.json.bak`（`git check-ignore` rc=1）⇒ 删完之后每次刷新都会长出 `??` 噪声。**两笔必须同批＋配一条 ignore 追加**才闭合。
5. 本班对族 C 取到了**可直接用的现值读数**（只读探针，零写盘）：`node scripts/audit-dead-exports.mjs` @ `cc75103`
   → `scanned files=126 entries=106 summary={"dead":0,"testsOnly":86,"internalOnly":20}`，rc=0，**耗时 114 s**；
   跑后 `git status --porcelain` 仍 4 行（未写）。对照：在册 JSON（工作树版）是 9-18 19:39 那次污染口径刷新的 `entries=108 / {dead:0,testsOnly:108,internalOnly:0}`，
   HEAD 版同 summary、仅 `generatedAt` 与 5 处 `line`／1 处 `hitsInTests` 之差（＝c927-41 §2.2 判定的"语义零变化空转刷新"）。
6. **`OPTIMIZATION_BACKLOG.md` 不进任何代提交范围**：归属 `d914-85`（用户本人改动，含 P1 段 5+/5− 销项结论），
   属拍板域；本班照读不碰（波次 brief §4／§5）。
7. ⇒ 本班 status **partial**：完成标准①「前 2 族归位」已过期无从执行、②「pre-commit 每族过」需 stage 才能触发（只读位禁做）、③「零 `-A`」自然满足（本班零 add）。

---

## 1. 逐族磁盘复核

| 族 | 卷宗／c922-08 的要求 | 磁盘实况（`cc75103`） | 取证命令 | 判定 |
|---|---|---|---|---|
| A（d913c-15 补交） | MapRenderer＋BuildPanel 接 `MASK_FILL_WHITE` | 两件与 HEAD **零差**；HEAD 内已含 `MapRenderer.ts:2/:201/:543/:1136` 与 `BuildPanel.ts:1/:444`，定义 `shared/visualConstants.ts:8` | `git log --oneline -1 -- src/renderer/ui/BuildPanel.ts` → `86b27c7`；`git diff --stat HEAD -- <两件>` 空；`git grep -n "MASK_FILL_WHITE" HEAD -- src` | **已闭合**，非本单任务 |
| B（d913c-22＋d914-17 补交） | saveLoad ＋4 例／saveGuard3 注释 | 两件与 HEAD **零差**；B 入库后 `saveLoad.test.ts` 又被 `4c9b8cb`（c924-05）正常演过 | `git log --oneline -1 -- src/renderer/state/__tests__/saveGuard3.test.ts` → `9d9fcbf` | **已闭合**；卷宗要求 message 写死的「1268→1272 跳变」整体过期（现口径 157 文件／1711 例；`colony-orphan-commit-precheck-20260922.md` 档首早已否证同一句） |
| C（dead-exports JSON） | **不要提交现值**；正解＝归属方 `--write` 重刷成 `{86,22}` 再提交 | 仍 ` M`；工作树版＝9-18 19:39 污染口径（mtime `Sep 19 03:39`）；本班只读探针现值 `{86,20}`／entries 106（**注意：与 c922-08 预言的 `{86,22}` 差 2**，因 9-23 后测试集变化，internalOnly 现测 20） | `node scripts/audit-dead-exports.mjs`（无 `--write` ⇒ 打印 `[read-only]` 不写）；`python` 解析两版 JSON | **待写位动作**：刷新＝改 tracked 台账件，只读位禁做；数值只作材料，不当结论（c922-08 的 `--write` 会把他班在途测试烤进台账这条风险，此刻 `src/` 零脏件 ⇒ 当前不存在，但引用本读数时要复跑确认） |
| D（`colony-dead-exports-20260914.json.bak`） | **先别删**；若退役，先归档 117 条快照再 `git rm --cached` | 仍 ` D`（工作树无此件，`ls` No such file）；index 存 `100644 dfc12c80…`；`.gitignore` 不含它（rc=1） | `git ls-files -s -- docs/insights/ \| grep bak`；`git check-ignore -v …bak` | **人工裁决级**：c927-41 §2.3 已订正 c922-08「唯一存证，删了不可复原」——该件 tracked，删除后 blob 经 `c784868` 永久可达 ⇒ 风险下调，但"退役 or 复原"仍是人的决定，且必须与族 C 同批（见 §0.4） |
| E（卷宗未列：suite-timings 台账） | — | ` M`；件内自述 `regeneratedAt=2026-09-25T21:58:15+0800`／`producedBy=c924-12`／`gitHead=17b8498`；`totals 157/1711/1711/0` | 见 §0.3 四条复算 | **可直接精确路径 add**（这批脏件里唯一自证完备且仍与磁盘同集的一件；与 c927-41 §2.4 判定一致，本班在新 HEAD 上重验未失效） |
| F（卷宗未列：BACKLOG） | 不在任何代提交范围 | ` M`，10848 B，mtime `Sep 15 03:08` | `ls -la`；c927-41 §2.1 认作者 `d914-85` | **不碰**（用户拍板域） |

---

## 2. 命令留档（**未执行**，交主班按笔做）

> 每笔都用精确路径，**不使用** `git add -A/-u/.`。四笔里只需三笔全量门禁（C/D 同批）。

**笔 1｜族 E：套件耗时台账入库（c924-12 欠账）**

```
git add docs/insights/colony-suite-timings-20260921.json
git commit -m "docs(colony): suite-timings 台账入库（c924-12 于 09-25 21:58 整体重生成，157 文件/1711 例全绿 @17b8498；c927-56 在 cc75103 复验双向差集空＋内部加和自洽）"
```
- 回滚成本：单 `git revert`，纯 JSON 台账，无源码耦合。

**笔 2｜族 C＋族 D 同批（真刷新 ＋ `.bak` 退役 ＋ ignore 追加）**

```
node scripts/audit-dead-exports.mjs --write          # 写 JSON，并当场复活 docs/insights/colony-dead-exports-20260914.json.bak
del docs\insights\colony-dead-exports-20260914.json.bak   # 复活即删（或用 --out 到 docs/insights 之外规避，见下方备注）
git add docs/insights/colony-dead-exports-20260914.json
git add docs/insights/colony-dead-exports-20260914.json.bak     # 对已消失的 tracked 文件，git add 即 stage 删除
git add .gitignore                                            # 追加一行 docs/insights/*.json.bak（防每次刷新长回）
git commit -m "docs(colony): dead-exports 台账按现口径重刷（entries 108→106，testsOnly 108→86，internalOnly 0→20）＋ .bak 快照退役并加 ignore"
```
- 备注①：`.bak` 内容若要先留证，`git show HEAD:docs/insights/colony-dead-exports-20260914.json.bak` 可无损取回（117 条 / 2026-09-17T00:29:58Z，c927-41 §2.3 实测可取）；
  若要留**盘上**归档面，得由人工指定目录（本班不代选，避免在仓根造临时件）。
- 备注②：`--write` 会把"当前工作树态"烤进台账 ⇒ 执行前必须 `git status --porcelain -- src/` **为 0 行**（本班 11:34 实测为 0）；否则改走 `--out tmp/...` 再整体替换。
- 回滚成本：一笔 `git revert` 同时退回 JSON 与 ignore；`.bak` 退役若反悔，`git checkout` 不可（那是毁灭动作）——用 `git show <笔前HEAD>:…bak > …` 复原。
- **本笔＝写位＋文件删除，属人工/主班裁决级**，本班只给形状。

**笔 3｜本波产物档（若主班要一并入库）**

```
git add docs/insights/c927-56-orphan-commit.md docs/insights/c927-58-retire3.md docs/insights/c927-59-gpt-review-request.md
```
- 纯新增，零冲突。⚠ 三枚新档会让 `docs/insights/` 的四份索引快照差集各 +3；**索引择权威＝人工闸**（本班不选，见 §5）。

**不做**：BACKLOG（用户拍板域，笔 4 由用户自签）。

---

## 3. 门禁现值（引前自己复跑；本表＝`cc75103` 现取）

`.git/hooks/pre-commit` 正文只有两步：`npm run --silent type-check` ＋ `npm run --silent test`，任一非 0 即拦截；`--no-verify` 可绕（在册先例：`1104e33` 显式绕过入库过一枚测试件）。

| 项 | 命令 | 现取读数 |
|---|---|---|
| type-check | `npm run --silent type-check`（＝`tsc -p tsconfig.renderer.json --noEmit`） | **rc=0，4 s**（11:35:31 第二次计时；输出 0 字节） |
| 全量测试 | `npm run test`（＝裸 `vitest run`） | **本班未跑**（并发窗纪律）。横幅在册读数：本次 01:46 入库那笔 35.97 s；另测 80–120 s 区间 ⇒ 主班落笔前现取 |
| 只读探针 | `node scripts/audit-dead-exports.mjs` | rc=0，**114 s**，打印 entries=106／summary 见 §0.5，零写盘 |
| 门禁覆盖缺口（在册，非本班新发现） | — | `type-check` 只跑 `tsconfig.renderer.json`，**不含 `src/main/index.ts`**；vitest 不做类型检查 ⇒ 涉及主进程码的笔要在 message 里自述这一层 |

⇒ 「pre-commit 每族过」的判据在只读位**不可达成**（需 stage），且每笔都要吃一次全量套件；剩两笔实做（族 E、C/D 合批），门禁成本＝**两次全量** ≈ 80–250 s 视并发。

---

## 4. 只读自证

- 开工 porcelain（11:30）＝ 收工 porcelain（11:34:53 探针后）＝ **4 行同一集合**（`M OPTIMIZATION_BACKLOG.md`／`M colony-dead-exports…json`／`D …json.bak`／`M colony-suite-timings…json`）。
- 未执行：`git add`／`commit`／`stash`／`checkout --`／`restore`／`clean`／`push`／`npm test` 全量／`--write`。
- 临时件：`D:\code\tmp\qoder-executor-20260928-0210-colony51\`（`de-readonly-probe.txt`／`typecheck.txt`／`typecheck2.txt`／`head-de-tmp.json`／`head-timings-tmp.json`），本班自清；仓根零残留。
- 引用在途件时均标了工作树版／HEAD 版对照（族 C、族 E 两枚各跑了双版 JSON 解析）。

## 5. 完成标准对照与遗留

| 卷宗完成标准 | 结论 | 说明 |
|---|---|---|
| ① 前 2 族归位（命令留档） | **不适用／判据过期** | A/B 已在 `86b27c7`／`9d9fcbf` 入库；本班把留档面重算到盘上真实剩余三族（C/D/E） |
| ② pre-commit 每族过 | **未达成（档位所限）** | 需 stage＋全量套件；只读位禁做，主班按 §2 落笔时现取 |
| ③ 零 `-A` 使用 | **满足** | 本班零 add |

遗留（交人工／主班）：
1. 族 C 的 `--write` ＋ 族 D 的 `.bak` 退役 ＋ `.gitignore` 追加 = **写位＋删除＋受版件改动** 三合一，按 §2 笔 2 一次做完；谁做都要在 message 里写死 `entries 108→106`、`internalOnly 0→20` 两处跳变，避免下一个拿旧数当基线。
2. `docs/insights/` 四份索引快照（`…-20260915.md`／`…-20260919.md`／`…-recount-20260917.md`／`…-20260927.md`）**无权威、无闭合哨兵**；本单新增文档使差集 +N。**择一与重建＝人工闸**，本班不选、不改旧快照。
3. 波次 brief 在册的「跑全量会自写 tracked 的 suite-timings json」已被 `c927-42` 否证，本单再次确认：`npm test` 是裸 `vitest run`，无 `--reporter=json --outputFile`，台账只由刷新单整体重生成 ⇒ 族 E 的脏态来自 `c924-12` 那一次显式刷新，不是随手跑出来的。
