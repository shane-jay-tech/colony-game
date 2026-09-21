# colony 三退役模块不可达性复查＋历史文档头注建议清单（c922-114，2026-09-22T05:0x）

> 性质：**核查＋建议级**。本单**不删码、不删档、不改写任何历史正文**（任务书即此口径），头注只成文案清单（§五），由人工/规划侧决定是否落。
> 三模块＝`resourceSystem.ts`（state）／`storyNpcs.ts`（data）／`terrainTextures.ts`（render）。
> 判据不另造：符号面沿用 `colony-retired-render-20260917.md` §二 的逐符号清单与 `colony-retired-module-residual-20260916.md` 的双向口径；「死码判定须双向证据」沿用 l922-124 门槛（运行时不可达证据＋全仓调用点证据，缺一条就不许删）。

## 〇、结论三句

1. **不可达性在两口径下均成立**（HEAD 与工作树各跑一次，`rg -w` 词边界、11 个符号合并正则、含动态面与构建/测试入口配置），复核查零反例 ⇒ **判定不改**。
2. **但"备份在盘"这句话现在是有条件的**：`tmp/` 与 `_archive/` **都在 `.gitignore` 里**（`:25`／`:26`，本单实测 exit=0 命中规则），备份件既不被 git 记账、也不被任何探针对账，一次磁盘清理就永久失去；而 **git 历史本身就是逐字节可恢复的权威副本**（§四 6 对文件实测：LF 归一后全部相等）。⇒ 头注应指向提交号，不该指向 `tmp/`。
3. **docs/ 里 18 个文件仍把这三部模块当"实存交付物/文案源"陈述**，但只有 **6 处**需要头注（其余是退役报告本体、索引记账、或已自带退役标注）；另点名 **2 处文档读数与磁盘不符**（§五 H5/H6），属勘误而非风格问题。

## 一、锚点复核（3 条未漂；外部锚漂 2 处）

| 任务书锚点 | 磁盘现值 | 判定 |
|---|---|---|
| `docs/history/SLICE_A_SPEC.md:137` `## DELIVERABLE 3: src/renderer/state/resourceSystem.ts` | **:137** | 未漂（同档另有 `:287` 的测试交付条目，任务书未列） |
| `docs/reviews/2026-09-05-copy-quality-review.md:4` 文案源花括号清单 | **:4** | 未漂（含 `storyNpcs`；实测七文件中**仅此一个不在盘**） |
| `docs/insights/colony-retired-render-20260917.md:13` 「备份在盘：tmp/…当前工作树三文件均已不存在（ls 实证）」 | **:13** | 未漂（后半句仍为真，前半句见 §二之 5／§四） |

**外部锚漂 2 处（按实况修正，不据此判 failed）**：

1. 退役报告与 `PLAN.md` 的互引已错位：`colony-unreachable-resourceSystem-20260912.md:35` 写「PLAN.md:31 条目（不可达模块退役）」，但盘上 `PLAN.md:31` 现在是 **"Make the asset manifest the authoritative boot-loading source…remove duplicate loading lists"**（＝P1-4，正是 c922-110/c922-113 的单），**"Remove superseded production modules that are reachable only from their own legacy tests" 已在 `:32`**，同段相邻的 `:29`（story NPC roster）/`:33`（startup config）亦分别对应本单与 P1-5。⇒ 引 PLAN 条目一律**用内容定位不用行号**。（`colony-plan-ledger-20260922.md:45` 引同一子条写 `:28`，是同型第 2 例。）
2. `colony-retired-render-20260917.md:11` 记 resourceSystem「-168 行测试」，实测删除面为 **实现 79 行＋测试 168 行**（`git show aad0592^:…| wc -l`），同档 `:9/:10` 的两行则实现/测试行数齐备（-173/-164、-88/-49）⇒ 只有 resourceSystem 那格漏写实现行数，属可读性缺陷不是错数。

## 二、不可达性复核查（双口径＋四路互证，全部现场跑）

| # | 判据 | 命令 | 读数 |
|---|---|---|---|
| 1 | 工作树 src/ 零命中 | `rg -n -w "terrainTextures\|storyNpcs\|resourceSystem" src/` | **0 命中，exit=1**（★完成标准第一条；用 `-w` 词边界防 `resourceSystemX` 型误合，且**未加 `-r`**） |
| 2 | **HEAD 口径**零命中 | `git grep -q -w -e terrainTextures -e storyNpcs -e resourceSystem HEAD -- src` | **exit=1** ⇒ 不是"工作树被谁删了"，提交树里同样没有（★双口径） |
| 3 | 符号面（比模块名更严） | 11 符号合并 `rg -n -w`：三模块名＋`computeDayDeltas`/`tickModifierLifecycle`/`STORY_NPC_DEFS`/`STORY_NPC_ARC_BEATS`/`StoryNpcArcBeat`/`makeTilePrng`/`drawTerrainHatching`/`TextureTarget` | `scripts/`、`src/main`、`src/preload`、`electron.vite.config.ts`、`electron-builder.yml`、`vitest.config.ts`、`tsconfig*.json` 上 **全部零命中，exit=1**（★动态调用面与构建/测试入口） |
| 4 | 文件面 | `find src -iname "*resourceSystem*" -o -iname "*storyNpcs*" -o -iname "*terrainTextures*"` | 0（仅 `docs/insights/` 两档文件名含该字样，不在 src） |
| 5 | gitignore 排除面 | `git check-ignore -v tmp/backup-colony-20260913-1532/storyNpcs.ts`、`_archive/v0.5.bak.html` | 均 **exit=0 命中规则**（`.gitignore:25 tmp/`、`:26 _archive/`）⇒ 备份件在探针盲区；**与 `colony-untracked-residue-20260917.md:5/:6` 自述的「无输出，exit=1（未被忽略）」相反**（见 §五 H6） |
| 6 | 删除事件可归因 | `git log --all --oneline --diff-filter=D -- '*resourceSystem*' '*storyNpcs*' '*terrainTextures*'` | `7d3aee3`（c914-38，terrainTextures＋storyNpcs）、`aad0592`（h912-14，resourceSystem）⇒ 与 `:13` 自述、与任务书"见 a-45/aad0592"的口径同源（`a-45` 记在 `colony-storynpcs-terrain-reachability-20260913.md:1` 标题里） |

⇒ **双向证据齐**：运行时不可达（2/3/4）＋全仓含动态面零调用点（1/3）＋外部入口（npm scripts / .bat / electron 入口 / vitest include / tsconfig）亦零（3）。**判定维持"已退役"，且本单不产生任何删除动作**（即便证据齐，任务书口径即"不删"）。

## 三、docs/ 残留引用全清单（18 文件，逐个性质判定）

```
$ rg -ln -w "terrainTextures|storyNpcs|resourceSystem" docs/ | wc -l  → 18
$ git grep -l -w -e terrainTextures -e storyNpcs -e resourceSystem HEAD -- docs | wc -l  → 17
```
**两口径差 1 件，且差的就是他班在途件**：多出来的是 `docs/design/OPTIMIZATION_BACKLOG.md`（其 `:42` 的 P1-5 条目提到"不可达的启动配置分支"）——该文件在在册在途清单里（` M`），与 `colony-optibacklog-status-draft-20260922.md:65` 自述「此半句是他在途 diff 新加的」**互相印证**。⇒ 本单不碰它。

| 文件 | 命中处 | 性质 | 是否需头注 |
|---|---|---|---|
| `docs/history/SLICE_A_SPEC.md` | `:137`（DELIVERABLE 3 全节）／`:287`（测试交付） | **历史规格稿**，通篇以现在祈使式要求"Write the complete file" | **H1 需要** |
| `docs/reviews/2026-09-05-copy-quality-review.md` | `:4` 文案源清单 | **历史评审稿**，但清单读起来像现役取材面 | **H2 需要** |
| `docs/decisions/2026-06-08-impl-full-roadmap-phase-b-e.md` | `:43`「C-4：storyNpcs.ts 4 固定故事 NPC…数据层已就绪」 | 历史决策，**"已就绪"三字会被当现状** | **H3 需要** |
| `docs/decisions/2026-06-07-impl-labor-occupancy-model.md` | `:29`「#1 resourceSystem.computeDayDeltas 没 skip people（采纳-保险）」 | 历史决策留痕（讲的是当年评审采纳），**动作已完成** | **H4 需要**（一行即可，防"还要去改 computeDayDeltas"） |
| `docs/decisions/2026-06-15-impl-health-fixes-and-music-verify.md` | `:13`「…`resourceSystem.test`（makeState 补 populationClasses/…）」 | 历史决策留痕：记的是**当年给该测试补类型债**，同测试文件 3 个月后随 `aad0592` 一起删除 | 低危，**不强制**（提及对象是"当时的修复动作"，不承诺文件现役；若做 H 批处理可并入一句） |
| `docs/insights/colony-retired-render-20260917.md` | `:13` 备份在盘＋`:11` 行数格 | **本单的权威出处之一**，但备份指向需勘误 | **H5 需要** |
| `docs/insights/colony-untracked-residue-20260917.md` | `:5/:6` check-ignore 读数 | 历史取证，**读数与磁盘相反** | **H6 需要**（勘误注，非"已退役"注） |
| `docs/insights/colony-unreachable-resourceSystem-20260912.md` | 全档 | **退役报告本体**（头注指向目标） | 不需要 |
| `docs/insights/colony-storynpcs-terrain-reachability-20260913.md` | 全档 | 同上（a-45 出处在 `:1` 标题） | 不需要 |
| `docs/insights/colony-retired-module-residual-20260916.md` | `:8/:11/:14` | 同上（复核留痕） | 不需要 |
| `docs/insights/colony-startup-config-audit-20260917.md` | `:31`（rg 命令原文） | 取证命令留痕 | 不需要 |
| `docs/insights/colony-saveload-ui-gap-20260913.md` | `:8` | **已自带标注**（"storyNpcs.ts 生产零引用、已于本日 a-45 退役"）＝正面范式 | 不需要 |
| `docs/insights/colony-insights-index-20260915.md`／`-20260919.md`／`colony-insights-unref-20260917.md` | `:59`／`:65`+`:77`／`:28`+`:48` | 索引记账（列的是退役报告档名，非声称模块在盘）＝正确 | 不需要 |
| `docs/insights/colony-plan-ledger-20260922.md` | `:45/:48` | 活文档（PLAN 对账），但 `:45` 的行号锚已漂（§一.1） | 由落地单顺手改，本单只登记 |
| `docs/insights/colony-optibacklog-status-draft-20260922.md` | `:65/:161/:165/:191` | 活文档（今日建议稿），已带上下文 | 不需要 |
| `docs/design/OPTIMIZATION_BACKLOG.md` | `:42` | **他班在途禁区** | 禁止动 |

## 四、备份件可恢复性实测（头注该指向什么的依据）

对 6 个文件做「git 末次提交 blob × 盘上备份」逐字节比对（`subprocess` 取 `git show <删除提交>^:<路径>` 原始字节 vs `open(f,'rb').read()`）：

| 文件 | raw 相等 | **LF 归一后相等** | git CRLF | 盘 CRLF |
|---|---|---|---|---|
| `resourceSystem.ts`（79 行） | ✗ | **✓** | 0 | 79 |
| `resourceSystem.test.ts`（168 行） | ✗ | **✓** | 0 | 168 |
| `storyNpcs.ts`（88 行） | ✗ | **✓** | 0 | 88 |
| `storyNpcs.test.ts`（49 行） | ✗ | **✓** | 0 | 49 |
| `terrainTextures.ts`（173 行） | ✓ | ✓ | 0 | 0 |
| `terrainTextures.test.ts` | ✓ | ✓ | 0 | 0 |

⇒ **六份备份与 git 版本逐字节同型**，raw 差异全部来自行尾（盘上 CRLF／库内 LF，`core.autocrlf=true` 的产物），**没有任何一份携带 git 里没有的内容**。
⇒ 由此得两条硬结论：① 恢复路径以 git 为权威（`git show aad0592^:src/renderer/state/resourceSystem.ts > src/...`，可逆、可审计）；② `tmp/` 里的副本是**冗余且随时可失**的（gitignored＋探针失明），文档把它写成"备份在盘"是**把最脆弱的一层当成了保障**。

## 五、头注建议清单（**只建议，本单一字未改历史正文**）

统一形态：在目标档**首行标题下**插一行 `> ⚑ 现状标注（c922-114 复核查，2026-09-22）：…`，正文一字不动（历史留痕不重写）。逐条文案：

- **H1 `docs/history/SLICE_A_SPEC.md:137` 节首（同档 `:287` 复用一个词）**
  `> ⚑ 本 DELIVERABLE 3 指向的 src/renderer/state/resourceSystem.ts（＋其 __tests__）已于 aad0592（h912-14）退役，src/ 现零命中；本节约为 6 月施工规格留痕，勿按图索骥。恢复用 git show aad0592^:src/renderer/state/resourceSystem.ts，不要依赖 tmp/（tmp/ 在 .gitignore:25）。`
- **H2 `docs/reviews/2026-09-05-copy-quality-review.md:4` 行下**
  `> ⚑ 花括号清单里的 storyNpcs 已随 a-45/7d3aee3 退役（实测七文件中仅此一个不在盘）；其余六个（storyEvents/events/eventsExpanded/buildings/jitHints/storyChapters）在盘，本档抽样结论不受影响。`
- **H3 `docs/decisions/2026-06-08-impl-full-roadmap-phase-b-e.md:43` 行下**
  `> ⚑ 此处「数据层已就绪」的 storyNpcs.ts 已于 a-45（7d3aee3）退役（生产零引用）；PLAN.md「story 用固定 NPC roster」子条因此失去承接对象，是否重开属规划域（现读 PLAN.md:29，行号勿引死）。`
- **H4 `docs/decisions/2026-06-07-impl-labor-occupancy-model.md:29` 行下**
  `> ⚑ 被评审的 resourceSystem.computeDayDeltas 已随 aad0592 退役；本条"采纳-保险"是当时决策留痕，现在没有可改之处。`
- **H5 `docs/insights/colony-retired-render-20260917.md:13` 行下**
  `> ⚑ 补充（c922-114）：上述 tmp/ 备份与 git 末次提交逐字节同型（raw 差仅行尾，六对文件实测），且 tmp/ 被 .gitignore:25 忽略、探针对其失明——权威可恢复副本是 git，不是 tmp/。`（＋同档 `:11` 那格宜补"实现 −79 行"）
- **H6 `docs/insights/colony-untracked-residue-20260917.md:5/:6` 两处读数旁**
  `> ⚑ 更正（c922-114 现跑）：两条 git check-ignore -v 实为 exit=0 且命中规则（.gitignore:25 tmp/、:26 _archive/），本档所记「无输出，exit=1（未被忽略）」不成立。疑因即当班纪律点名的 check-ignore --stdin × text=True 陷阱（Windows 把 \n 翻成 \r\n 致判定静默失效）。`

**不建议加头注的**：三份退役报告本体与两份索引（它们的价值正是"记录退役"）、`OPTIMIZATION_BACKLOG.md:42`（在途禁区）、`colony-saveload-ui-gap-20260913.md:8`（已自带标注，可当范式）。

## 六、与其它在册单的衔接

- 与 **c922-109**（`manifest_portraits` 孤儿）同属"退役面处置材料"，且共用同一判据风格（先出材料不删件）；本单 §四 的"git 才是权威副本"结论，同样适用于它那三案表里的 B 案（`mv` 到 gitignored `tmp/`）——**B 案的可逆性比它自评的更差一档**，建议主班在并单时把这条补进去。
- 与 **c922-110／c922-113** 无交叠：二者动 `data/artManifest` 面，本单零生产码；唯一间接关系是 §一.1 指出的 `PLAN.md:31` 错位（现指 P1-4），**引用 PLAN 子条的档请一并改内容定位**。
- 索引登记：本档已在 `colony-insights-index-20260919.md` 追加 1 行；该档自述条目数 74/75 争议在册待人工（主班 03:0x），**本单未碰**。
  ⚠ 但本单顺带取到一个可用于结案的事实：索引头部（`:1`，c922-19 写的）称"少列 1 份＝`colony-unreachable-resourceSystem-20260912.md`"，而**该条现已在列**（`-20260919.md:78`＝本档插入后的位置，插入前在 `:77`；本单实测 `grep -n "colony-unreachable"` 两处命中＝它＋本档）⇒ 那条"缺列"疑已被后续班次补上，人工结案时请先复核再定口径（本单未改条目数自述）。

## 七、遗留问题

1. §五 六条头注是否落、由谁落（历史正文不动、只加标注行，属文档域授权）。
2. `PLAN.md`「story 用固定 NPC roster」子条（现 `:29`）在 storyNpcs 退役后已不可承接——**是否重开或删除属规划域**，本单只登记。
3. `tmp/backup-colony-20260912/`（1 项：`state/` 子目录 2 件）与 `tmp/backup-colony-20260913-1532/`（4 件）要不要**改为 git 内留档**（如 `_archive/` 也 gitignored ⇒ 实质只有 `docs/` 里贴出 diff 或建 `git tag`）＝人工裁决；本单不动任何 tmp 件（纪律：来源不明的 tmp 残留不删）。
4. H6 那条勘误同样牵动"未跟踪残留"族其余读数（同法取数），本单只证两条。
