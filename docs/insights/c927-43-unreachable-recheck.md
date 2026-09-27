# c927-43 — 两份 unreachable 报告点名模块的现状复核（只读，零删码）

- 出班：`qoder-executor-20260927-2224-colony48`（分支 `codex/architecture-hardening`，HEAD `b23ef89`，复核时刻 2026-09-27 22:26–22:3x，本机 `date` 实取）
- 被复核的两份报告：`docs/insights/colony-unreachable-recheck-20260922.md`（c922-114，三模块）、`docs/insights/colony-unreachable-resourceSystem-20260912.md`（h912-14，resourceSystem ＋ 点名另两件的后续单）
- 判据沿用 c922-114 §二，不另造符号清单：**3 模块名 ＋ 8 导出符号 ＝ 11 项合并正则**，`rg -w`（词边界、**不带 `-r`**）与 `git grep -w` **双口径分开写**，另加 `--no-ignore` 第三口径（补 c922-114 未做的那层：`.gitignore` 会让"零命中"假绿，c922-116 已立此训）。
- **本单一字未删、未改任何码或历史正文**，只出这份报告。

## 〇、结论四句

1. **三模块全部维持"已退役/不可达"**：工作树、HEAD、`--no-ignore` 三口径下 11 项符号在 `src`／`scripts`／全部构建与测试入口配置上**零命中（rc=1）**，与 9/22 那次读数一字不差。
2. **9/25 卷宗批没有激活它们**：9/25 01:46 的 `c924-34`（P1 合入前置核验）当场**独立复跑过同样两条命令、同样 rc=1**，其产物 `colony-p1-premerge-verify-20260924.md:100-101` 就是复证记录；`17b8498..b23ef89`（9/25 后 18 枚提交）里 `src` 侧对这 4 个名的 pickaxe 命中 **0**。
3. **恢复路径仍然完备**：6 枚 blob（3 实现＋3 测试）在 git 对象库里逐枚可取（`git cat-file -s` 全部返回字节数），而**盘上 tmp 备份仍是 gitignored 的脆弱层**（`check-ignore` 实测 rc=0 命中 `.gitignore:25/:26`）——c922-114 §四"以 git 为权威"的结论继续成立。
4. ⚠ **9/22 那批 6 条头注建议（H1–H6）至今一条未落**，docs 残留面从 18 枚涨到 **25 枚**——涨的都是记账/复核性引用，**没有一处新把这三模块当现役交付物**，但其中 2 条是**读数与磁盘相反**的勘误项（H5/H6），继续悬着会继续误导后人。

## 一、A 栏：仍不可达（逐个点名复核）

| 模块 | 退役提交 | 工作树 `src`+`scripts` | HEAD 口径 | `--no-ignore` 11 符号 | 文件面 | 判定 |
|---|---|---|---|---|---|---|
| `src/renderer/state/resourceSystem.ts`（＋ `__tests__/resourceSystem.test.ts`） | `aad0592`（h912-14，2026-09-13） | **0 命中 rc=1** | **rc=1** | **rc=1** | `git ls-files`/`find` 在 `src` 下 **0** | **仍不可达** |
| `src/renderer/data/storyNpcs.ts`（＋ `__tests__/storyNpcs.test.ts`） | `7d3aee3`（c914-38，2026-09-15） | **0 命中 rc=1** | **rc=1** | **rc=1** | 同上 **0** | **仍不可达** |
| `src/renderer/render/terrainTextures.ts`（＋ `__tests__/terrainTextures.test.ts`） | `7d3aee3`（c914-38） | **0 命中 rc=1** | **rc=1** | **rc=1** | 同上 **0** | **仍不可达** |

- 11 项符号＝`terrainTextures`／`storyNpcs`／`resourceSystem`／`computeDayDeltas`／`tickModifierLifecycle`／`STORY_NPC_DEFS`／`STORY_NPC_ARC_BEATS`／`StoryNpcArcBeat`／`makeTilePrng`／`drawTerrainHatching`／`TextureTarget`。
- 扫描面（第三口径点名给出，防"目录不存在当零命中"）：`src scripts electron.vite.config.ts electron-builder.yml vitest.config.ts package.json tsconfig.renderer.json` → **rc=1（零命中）**。
- 全仓 `--no-ignore` 反查这三枚模块名，命中只落在**两类地方**：`tmp/`（备份件 ＋ 历史取证工件，gitignored）与 `docs/`（25 枚，见 §三）⇒ **代码面零、文档面全为留痕**。
- 双向证据齐（c922-114 口径）：运行时不可达（HEAD 口径＋`--no-ignore`＋文件名面）＋全仓含动态入口零调用点 ⇒ **维持"已退役"，删除判据成立但本单不执行**。

## 二、B 栏：已激活（**空集**）——以及"去哪里看会不会被激活"的四条查法

| 激活渠道 | 查法 | 读数 | 结论 |
|---|---|---|---|
| 代码复活（新提交重新 import） | `git log --since=2026-09-22 --all -S <名> -- src` 逐名 | 4 个名全部 **0** 笔 | 未复活 |
| 9/25 卷宗批（规划/核验档） | `rg -w <11 符号>` `docs/night-plans` | 命中只在 **9/14、9/16 的退役期文案**与 `BACKLOG.md` 的 B-132/B-141 **done** 行；9/24–9/27 的规划档 **0 命中** | 未排期重开 |
| 信箱侧新单（卷宗把模块当现役派工） | 扫 `zcode-bridge/{inbox,done,outbox}` 全部点名文件 ＋ mtime 排序 | 49 枚命中件里 **9/24 之后只有 3 枚**：`c924-34.result.md`(9/25)、`c927-40`、`c927-41`——前者的"命中"就是**复跑零命中的取证命令本身**（:72-73 `rc=1`），后两枚是把 `colony-unreachable-resourceSystem-20260912.md` 当**索引缺条目**讨论 | 无激活单 |
| 台账口径切换（dead-exports 台账另立） | `rg -c` `colony-dead-exports-20260914.json`（108 条导出级 entries） | **rc=1 零命中** | 未进新台账（模块整体已不在盘，导出级台账无从记） |

⇒ **B 栏为空**：三模块既没被接线、也没被重新排期。**唯一还"活着"的是规划意图**——`PLAN.md:28`「Wire story mode to the fixed story NPC roster…」仍挂在该节裸 bullet 列表里（**PLAN 用无状态标记的 bullet，没有勾选位，故"未完成"无法从格式上判**，只能从"承接件不在盘"判），但承接件 `storyNpcs.ts` 已不在盘 ⇒ 该条自 9/15 起就是**无承接对象的悬空需求**（c922-114 §五 H3 已点名，本单复点：内容定位在 `:28`，行号勿引死）。

## 三、文档残留面：18 → 25 枚（涨的是记账，不是激活）

$ rg -ln -w "terrainTextures|storyNpcs|resourceSystem" docs | wc -l → **25**（9/22 时点为 18）

新增 7 枚的逐枚性质：

| 文件 | 何时成文 | 性质 | 是否需要标注 |
|---|---|---|---|
| `colony-unreachable-recheck-20260922.md` | 9/22 05:0x | 复核报告本体（c922-114，含自身命令） | 不需要（记录退役＝其价值） |
| `colony-retired-backup-verify-20260922.md` | 9/22 05:17 | 同批备份对账 | 不需要 |
| `colony-retired-outarg-recheck-20260922.md` | 9/22 05:26 | 同批桥面复核 | 不需要 |
| `colony-p1-premerge-verify-20260924.md` | 9/24 | 9/25 批前置核验，:100-101 是**零命中取证原文**；:146 判 BACKLOG P1-5 的"退役 3 件＝aad0592"为**半真**（另两件在 `7d3aee3`） | 不需要，但**其"半真"裁定未被 BACKLOG 吸收** |
| `c927-15-changelog-index-adjudication.md` | 9/27 | 只把它当**索引条目文件名**引用 | 不需要 |
| `c927-40-optibacklog-health.md` | 9/27 | 复核 `aad0592` 提交标题，指出"3 件 1 commit"半真 | 不需要 |
| `c927-41-uncommitted-audit.md` | 9/27 | 记索引真缺条目 `-resourceSystem-20260912.md` | 不需要 |

⇒ 9/22 §五 点名的 6 枚"需头注"目标**一条未落**（`rg -c "⚑ 现状标注|⚑ 补充|⚑ 更正|c922-114"` 对那 6 份文件 → **rc=1，零命中**），其中两份的**在册读数至今与磁盘相反**：

- **H5 仍在**：`colony-retired-render-20260917.md:11` 的 resourceSystem 那格仍写「-168 行测试」（实现 79 行未记）；`:13` 仍写「备份在盘：tmp/…」（tmp 系 gitignored，见 H6）。
- **H6 仍在**：`colony-untracked-residue-20260917.md:5/:6` 仍记「无输出，exit=1（未被忽略）」——本单**当场复跑**：两条 `git check-ignore -v` 均 **rc=0** 并命中 `.gitignore:25 tmp/`、`:26 _archive/` ⇒ 该档两条读数**至今仍不成立**。

## 四、锚点复点（用前必核，逐条给现值）

| 9/22 报告所引锚点 | 磁盘现值 | 判定 |
|---|---|---|
| `docs/history/SLICE_A_SPEC.md:137`「DELIVERABLE 3: …resourceSystem.ts」 | **:137 原样在**（同档 `:287` 测试交付条目亦在） | 未漂 |
| `docs/reviews/2026-09-05-copy-quality-review.md:4` 文案源花括号清单含 `storyNpcs` | **:4 原样在**，七名里仍仅此一枚不在盘 | 未漂 |
| `docs/insights/colony-retired-render-20260917.md:13`「备份在盘 tmp/…当前工作树三文件均已不存在」 | **:13 原样在**（ls 复点：`tmp/backup-colony-20260912/state/` 2 件、`tmp/backup-colony-20260913-1532/` 4 件均在盘，`src` 下三模块 0 件） | 未漂（但"备份"含义仍待 H5 勘误） |
| `colony-unreachable-resourceSystem-20260912.md:20` 称 `colony-module-reachability-20260911.md` 不存在、真身在 `tmp/reach_table.md:86` | 该档**至今仍不在盘**；`tmp/reach_table.md` **在**，`:86` 逐字符＝`| src/renderer/state/resourceSystem.ts | 2 | 0 | 0 | 1 | 0 | 疑似不可达（仅测试引用） |`，且全表**只有 3 行**「疑似不可达」＝:36 storyNpcs／:47 terrainTextures／:86 resourceSystem | 未漂；**盘点面确认"点名模块"总数就是 3，无第 4 件** |
| `PLAN.md` 条目行号（该报告 :35 引 `:31`、c922-114 引 `:32`／`:29`） | 现值：story roster＝**:28**、"Remove superseded production modules…"＝**:31**、startup config＝**:32** | **两度各漂 1 行 ⇒ 一律按内容定位，禁止引行号**（本单不再据此判 failed） |

## 五、处置建议（退役/保留两栏 ＋ 恢复条件）

> 本单只出建议。**「删除」这一支其实已经执行完毕（9/13、9/15 两笔提交）**，现在悬着的不是删不删，而是**文档要不要收口、需求要不要重开**。

| 模块 | 建议 | 理由（现状证据） | **恢复条件（要满足什么才重新接线）** |
|---|---|---|---|
| `resourceSystem.ts` | **维持退役 ＋ 落 H1/H4/H5 三条头注**（文档域，不碰码） | `docs/decisions/2026-06-07-impl-labor-occupancy-model.md:29` 原文即「确认该函数当前未被调用（已被 computeProductionTick 取代），仍补 people-skip guard 防将来误引复活 bug」——**退役理由在当时就已成立**；生产引用 0；本单三口径 rc=1 | 只有当出现**与 `computeProductionTick` 语义不同**的日增量子系统（例：需要独立于生产 tick 修饰符生命周期）才谈恢复。恢复＝`git show aad0592^:src/renderer/state/resourceSystem.ts > src/renderer/state/resourceSystem.ts`（**blob 3,356 B**，测试 **5,856 B**，本单 `git cat-file -s` 实测可取），随后必须补：① 在 `gameStore` 组合根接线并给出**调用点测试**；② 与 `computeProductionTick` 的差异写成决策档（否则退役理由复活）；③ 跑 `npm run verify`（现值 157 文件/1711 例，见 c927-42） |
| `storyNpcs.ts` | **维持退役 ＋ 落 H2/H3 头注**；**PLAN.md:28 那条需求单独裁决**（重开或删，属规划域） | 它是三件里唯一**仍有活需求挂着**的一件（PLAN roster 条未勾）；本单复点仍零命中、`STORY_NPC_DEFS`/`STORY_NPC_ARC_BEATS`/`StoryNpcArcBeat` 三面皆零 | 恢复前置＝先回答「story 模式是否还要固定 NPC roster」。要，则**不必回滚旧件**：按今日 schema/类型面重写更省（旧件 88 行、无 barrel、无存档字段）；不要，则**在 PLAN.md 上把 :28 划掉**（那是唯一让这条继续钓人的活文档）。回滚命令：`git show 7d3aee3^:src/renderer/data/storyNpcs.ts`（**blob 3,073 B**／测试 1,762 B） |
| `terrainTextures.ts` | **维持退役，无附加动作**；只在文档里补一句"terrain 取材面已改走 `artManifest.TERRAIN_ART`" | c924-34 产物 :146 已记 BACKLOG「terrain 仍硬编码」描述**过期**（自 c918-04/05 起键与 path 全走 manifest），退役后本单三口径零命中 | 仅当**放弃 manifest 驱动的程序化贴图路线**（回到本地画布烘纹理）才恢复；该前提与 P1-4「manifest 权威化」直接冲突 ⇒ 实际上不可逆，建议在文档里明写"除非 manifest 路线整体作废"。回滚命令：`git show 7d3aee3^:src/renderer/render/terrainTextures.ts`（**blob 7,052 B**／测试 6,054 B） |
| `tmp/` 六枚备份件 ＋ `_archive/` | **不再当"备份"陈述**；要留就转 git 内留档，不留就清理（**本单未动一件**） | `check-ignore` 实测两枚均 rc=0（gitignored、探针对其失明）；六枚与 git blob 已被 c922-114 逐字节判同型、c922-115 复判 LF 归一 6/6 相等 ⇒ **盘上副本零增量信息** | 无需恢复条件；若要保留物证，正解是**在文档里指提交号**（`aad0592^`／`7d3aee3^`）而不是指 `tmp/` |

### 5.1 交人工/主班的三条待办（本单不自批）

1. **H1–H6 头注是否落**：属文档域授权，c922-114 已写好逐条文案，5 天无人执行；其中 **H5/H6 是"读数与磁盘相反"的勘误**，优先级高于其余四条。（本单已当场复证 H6 两条 rc 现值＝0/0。）
2. **BACKLOG P1-5 的"半真"未吸收**：`docs/design/OPTIMIZATION_BACKLOG.md:42`（⚠ **工作树版**，该件是在途脏件 ` M`，本单未碰）仍写「不可达模块已退役 3 件（git aad0592 ＋ 那份 912 报告）」——另两件实际在 `7d3aee3`，c927-40 与 c924-34 各判过一次半真。**改它属他班在途件域，本单不动一字**，只把改法写成一句话：把「git aad0592」改为「git aad0592（resourceSystem）＋ 7d3aee3（storyNpcs/terrainTextures）」。
3. **索引欠账**：本档与 c927-42 产物均需进 `colony-insights-index-*.md`，该件是**主班单点重建**件（无测试哨兵，门禁不红只静默欠账），本班未碰。

## 六、复点命令（复制即用，全为只读）

```bash
cd /d/code/colony-game
rg -n -w "terrainTextures|storyNpcs|resourceSystem" src scripts; echo rc=$?                 # 期望 rc=1
git grep -c -w -e terrainTextures -e storyNpcs -e resourceSystem HEAD -- src; echo rc=$?    # 期望 rc=1
rg -q -n -w --no-ignore -g '!node_modules/**' -g '!dist/**' \
  "terrainTextures|storyNpcs|resourceSystem|computeDayDeltas|tickModifierLifecycle|STORY_NPC_DEFS|STORY_NPC_ARC_BEATS|StoryNpcArcBeat|makeTilePrng|drawTerrainHatching|TextureTarget" \
  src scripts electron.vite.config.ts electron-builder.yml vitest.config.ts package.json tsconfig.renderer.json; echo rc=$?   # 期望 1
git log --since=2026-09-22 --all --oneline -S resourceSystem -- src                          # 期望空
git cat-file -s aad0592^:src/renderer/state/resourceSystem.ts                                # 期望 3356
git check-ignore -v tmp/backup-colony-20260913-1532/storyNpcs.ts _archive/v0.5.bak.html      # 期望 rc=0（两枚均被忽略）
rg -ln -w "terrainTextures|storyNpcs|resourceSystem" docs | wc -l                            # 现值 25
```

## 七、本单未做（口径边界）

- **未删任何码/件/`tmp` 残留**（纪律：来源不明的 tmp 残留不删；本单也未清理自己的 `tmp/` 物证）。
- 未跑任何测试、未做 git 写操作、未碰四枚在途脏件（`OPTIMIZATION_BACKLOG.md`／两枚 `colony-*.json`／一枚 `.bak` 删除）。
- 未"顺手"扩面到 dead-exports 台账那 108 条导出级死导出口径——那是另一张台账、另一个域（本单只证三模块**不在**该台账里）。
