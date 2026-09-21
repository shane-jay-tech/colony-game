# colony `public/art/manifest_portraits_*.json` 四件孤儿裁决材料（c922-109，2026-09-22T04:0x）

> 性质：**只出材料，不删件、不改生成器**。任务书正文即写「只出材料不删文件」，
> 与派单口径（P3-1/P4-1 的删件或改生成器属待人工授权）一致。
> 本单对 `public/art` 的唯一动手是一次**可逆受控移件实验**（§五），已原地还原、blob 未变（§六）。

## 一、现场读数（先命令后数字）

```
$ ls public/art/manifest_portraits_*.json | wc -l
4

$ find public/art -type f | wc -l
66                      # 与 9/20 报告的 diskArtFiles=66 仍一致（c921-02 转码是同名换后缀，不改计数）

$ git ls-files public/art | grep -c manifest_portraits
4                       # 四件全部被 git 跟踪 ⇒ 任何删除都可经 git 恢复

$ git log --oneline --diff-filter=A -- public/art/manifest_portraits_1781872115.json
54eafe9 chore: 快照提交 6-7 月工作树（… 季节散布 / 音频接入等）   # 四件同源，均随 6-7 月快照入库

$ du -bc public/art/manifest_portraits_*.json | tail -1
5112 total              # 四件合计 5.0 KiB（仓库体积影响可忽略，删除的收益不是体积）
```

## 二、逐件台账（时间戳 ＋ 内容首键）

**锚点更正**：四件 JSON 的顶层是**数组**（`[{id, saved, error}, …]`），**没有「首键」**；
任务书完成标准里的「内容首键」按磁盘实况改读为「首条记录的键集」，四件皆为 `id / saved / error`。

| 文件 | 文件名时间戳 → 本地时刻 | 条数 | `saved` 成功 | `error` 记录 | 生成时刻的语义 |
|---|---|---|---|---|---|
| `manifest_portraits_1781872115.json` | 2026-06-19T20:28:35 | 2 | 2 | 0 | 首发批次（2 项） |
| `manifest_portraits_1781872230.json` | 2026-06-19T20:30:30 | 13 | 5 | 8 | 重试一：8 条 `submit 429 Throttling.RateQuota` |
| `manifest_portraits_1781872304.json` | 2026-06-19T20:31:44 | 8 | 5 | 3 | 重试二：3 条 429（`ending_*`） |
| `manifest_portraits_1781872377.json` | 2026-06-19T20:32:57 | 3 | 3 | 0 | 重试三：收口，全部成功 |

- 四件时间戳跨度 **112 秒**，是同一次 6/19 出图的**「首发＋三次限流重试」链**，不是四次独立美术活动。
- 26 条记录 = 15 条成功 ＋ 11 条 429 失败；**成功项去重后恰好 15 个唯一 id** = 5 将领 + 10 事件，
  与 `scripts/gen_portraits_events.py` 的 `GENERALS(5)+EVENTS(10)` 全集一一对应 ⇒ 该批任务**已完成且无遗漏**。
- `saved` 字段是**硬编码绝对路径**（`D:\code\colony-game\public\art\…`，含 `.png` 后缀）：
  26 条里 **26 条指向的文件现已不存在**（100%），15 个成功项的对应物均已由 c921-02 转码为同干 `.webp` 并在盘。

## 三、脚本输出物语义：重跑会不会覆盖/新增？

生成器唯一写点在 `scripts/gen_portraits_events.py:154`（锚点未漂）：

```python
manifest = base / f"manifest_portraits_{int(time.time())}.json"     # base = Path("D:/code/colony-game/public/art")  :111
```

- **设计上不覆盖**：文件名带 `int(time.time())` ⇒ 每跑一次**净增 1 件**，永不覆盖旧件。
  这正是四件并存的成因，也是它必然继续增殖的机制（同型缺陷在另外三个生成器上完全一致：
  `gen_buildings_art.py:142`、`gen_scatter_art.py:84`、`gen_terrain_art.py:76`）。
- **但现在跑不动**——实测否证「重跑」这个前提：

```
$ python scripts/gen_portraits_events.py --help
ModuleNotFoundError: No module named 'gen_wanxiang_batch'    （脚本 :20 处，rc=1）

$ ls D:/code/scripts/gen_wanxiang_batch.py
No such file or directory
```

  脚本靠 `sys.path.insert(0, "D:/code/scripts")` 借 `gen_wanxiang_batch` 的异步管线，该模块**在盘上已不存在**；
  且其默认模型 `wan2.7-image-pro`（万象）按 `D:/code/CLAUDE.md` 2026-09-13 阵容定稿**已退役**。
  ⇒ 结论：**「重跑会新增第 5 件」在当前工作区不成立**；四件 JSON 是**静态残留**，不是活跃流水线的中间产物。
  这一条直接改变了三案的代价排序（§四 C 案）。

## 四、与 `artManifest` 事实源的关系（含一处假孤儿口径）

`tmp/art-exists-check.mts`（c921-01 留的盘→清单反查，一次性探针、未进 CI）现跑读数：

```
$ npx tsx tmp/art-exists-check.mts | tail -3
requiredTrueMissing=0
diskArtFiles=66
orphansArtFiles=13 ["art/manifest_portraits_1781872115.json", ×4,
                    "art/scatter/bush_dry.webp", "art/scatter/bush_shrub.webp", … ×9]
```

两点必须写清，否则「13 个孤儿」会被误读成同一性质的 13 件：

1. **4 件 JSON 是真孤儿**：零引用、且其内容自身也已失效（指 `.png` 绝对路径）。
2. **9 件 scatter `.webp` 是假孤儿**：它们被 `scatterConfig.ts` 的 `ALL_SCATTER_IDS` 引用、
   由 `BootScene.ts` 的 scatter 循环加载，只是**没进 `ART_MANIFEST`** ⇒ 探针按「是否被 manifest 声明」判它们孤儿。
   该假孤儿面**正是 P1-4 未收口的直接产物**（c922-110 在做的那件事）：
   scatter 进 `artManifest` 后，这 9 项里的 **8 项**会自动从 orphan 集消失（`bush_dry.webp` 不在 `ALL_SCATTER_IDS` 内，
   它仍是真孤儿、等人工裁决，见 `colony-scatter-bidir-20260922.md:59`）⇒ `orphansArtFiles` 13 → **5**（4 件 JSON ＋ `bush_dry.webp`），
   再处置本单四件后落到 **1**，不是 0。（注：9/20 报告记的 13 件里 scatter 半区当时是 `.png`，现为 `.webp`，**件数巧合相同、成员不同名**。）
3. 与在册反向哨兵**不重复**：c922-107 的 `scatterDiskReconcile.test.ts:37` 只扫 `public/art/scatter/` 且只看 `.webp`
   （白名单 `bush_dry.webp`），**扫不到 `public/art` 根的 `.json`** ⇒ 四件孤儿目前无任何测试面看守，
   新增同类残留也不会红。若将来要长期钉住，落点应在「根目录 JSON 白名单＝空」这一条，别塞进 scatter 那族。

## 五、断言牵动实测（可逆受控移件，本单唯一动手处）

把四件临时移到 `tmp/c922-109-hold/`（`tmp/` 在本仓 `.gitignore:25` 内），跑断言面，再原样移回。

| 口径 | 命令 | 在位（前） | 移走（中） |
|---|---|---|---|
| 美术族定向 | `npx vitest run` × 9 个 art/boot/scatter 测试文件 | 9 files / **63 passed** | 9 files / **63 passed** |
| 全量 | `npx vitest run` | （在位基线由 pre-commit 守） | 126 files / **1338 passed / 0 failed**，15.85 s |
| 盘→清单探针 | `npx tsx tmp/art-exists-check.mts` | diskArtFiles=66 / orphans=13 | diskArtFiles=**62** / orphans=**9**（余 9 项＝scatter 假孤儿） |

被点的 9 个文件即「可能牵动」的全体：`artManifest` / `artManifestEvtArtUsage` / `artManifestReuse` /
`bootLoadList` / `scatterAssets` / `scatterDiskReconcile` / `terrainPaths` / `bootLoadErrorDedup` / `scatterSourceGuard`。

**结论**：删除这 4 件对 `scatterAssets`、`bootLoadList`（63 条 `existsSync`）、terrain 三方互等三族断言
**零牵动**——因为 `bootLoadList` 与 `existsSync` 断言判的是「manifest 声明的 path 在不在盘」，
而 4 件 JSON 从未被任何 path 声明，也没有任何测试枚举 `public/art` 根目录。
唯一会变的是**那份一次性探针的两个数字**（66→62、13→9），而这两个数字目前**没有测试引用、没有基线档钉**
（`docs/insights/colony-art-full-20260919.md:12` 的「public/art 66」是**文档叙述**，删件后该行需同步，属文字账）。

## 六、三案对比（＋一案变体）与回滚

| 案 | 动作 | 影响的现值 | 代价 / 风险 | 回滚方式 | 可逆性评级 |
|---|---|---|---|---|---|
| **A 删除** | `git rm public/art/manifest_portraits_*.json`（4 件同批） | `public/art` 跟踪数 −4；探针 66→62、13→9；`colony-art-full-20260919.md:12` 的 66 过期 | 一次性丢掉 11 条 429 `request_id`（6/19 那三次限流的唯一实物证据，无再生途径，但对后续决策无用途）；`colony-artmanifest-relink-20260920.md:173` 的 13 孤儿清单需加时效注（他班档，按纪律不代改） | `git revert <删除提交>`；或按件 `git checkout 54eafe9 -- public/art/manifest_portraits_1781872115.json`（四件同源，`--diff-filter=A` 已逐件验到 54eafe9） | **高**：四件均在 HEAD，blob 永久可取；实测 `git diff --quiet HEAD -- public/art` rc=0 |
| **B 移 `tmp/`** | `git mv public/art/manifest_portraits_*.json tmp/assets-backup-20260922/art/` | 与 A 的仓内效果相同（跟踪数 −4），另在盘上留一份副本 | `tmp/` 被 `.gitignore:25` 忽略 ⇒ **副本不受 git 看守、也不被 `git status` 探针看见**（失明面）；`tmp/` 历来是随时可清的一次性区，"备份"语义弱；好处是照搬了 `tmp/assets-backup-20260920/`（c921-02 转码留的 png 回滚件）这条既有惯例 | 从 git 历史取（同 A），或直接 `mv` 回来 | 中：两条独立退路，但都会与「tmp 随时可清」的默契冲突 |
| **C 保留＋改生成器** | `scripts/gen_portraits_events.py:154` 改固定名覆盖写／改写 `tmp/`；**并须同批改** `gen_buildings_art.py:142`、`gen_scatter_art.py:84`、`gen_terrain_art.py:76` | 现存 4 件不动（历史留痕保住）；未来不再增殖 | **当前是「给死码做手术」**：四个脚本全依赖已缺盘的 `gen_wanxiang_batch`（实测 rc=1），且万象已退役 ⇒ 无法用运行验证改动，改完只能靠目检，且 18f92a8 那次清理（21 json＋7 png）之后 buildings/scatter/terrain 三族的同类残留**并未再增殖**，说明缺盘即事实封存。单独只改 portraits 还会留下三处同型缺陷＝判据不一致 | 单文件 `git revert`；改动面 1～4 行 | 高（代码层面），但**必要性最低** |
| **D 变体** | 保留文件＋在 `.gitignore` 加 `public/art/manifest_portraits_*.json` ＋ `git rm --cached` | 盘上留件、仓内脱管 | 与 A 同样丢跟踪，却**更隐蔽**（新同事 clone 后无此件、本地仍见旧件，状态不一致）；且只治 portraits 一类，四族同型缺陷只堵一个口 | `git revert` 后 `git add -f` 即回 | 中偏低：不推荐 |

**代价横向比较**：A 与 B 的**净仓内效果一致**（四件不再被跟踪），差别只在"盘上是否另留一份不受 git 看守的副本"。
既然 §六实测表明四件在盘与不在盘对全部 1338 例、对 boot 清单与 scatter 断言**都零影响**，
B/D 引入的"副本/git 脱管"复杂度买不到额外安全 ⇒ **若人工授权处置，A（直接 `git rm`，一次一提交）是代价最低的一案**。
但 **C 案若被采纳，A/B 就只是治标**：真正的增殖机制在生成器；只是该机制现已因依赖缺盘而停摆，
「先改生成器再清残留」的次序在没有重跑能力时不成立。

**处置与 P1-4 的耦合提示**：假孤儿半区（scatter 9 件）的正解不是删，而是 c922-110 的清单权威化。
若两单并行，建议**先合 P1-4**，再处置这 4 件——那样 `orphansArtFiles` 分两步落：**13 → 5 → 1**
（第一步 8 件被声明、第二步本四件离场；余 1 件＝ `bush_dry.webp`，去留待人工，非执行班可裁）。
**落不到 0**，探针读数与 BACKLOG 清理口径的解释成本只需付一次。

## 七、交回人工裁决的点（本单不代决定）

1. 4 件是否删（A/B/D）或留（C）——三案的实测代价见 §六，**零测试牵动已证**。
2. 若删：`docs/insights/colony-art-full-20260919.md:12` 的「public/art 66」与
   `colony-artmanifest-relink-20260920.md:173` 的「orphansArtFiles=13」两处文字账同步由谁做
   （两份均他班产物，按纪律执行班不代改）。
3. `docs/design/OPTIMIZATION_BACKLOG.md` 的 P3-1/P4-1 行（**他班 ` M` 在途件，本单未触碰、未提交**）
   的合入文本需按本档 §五 的实测读数改写「清理口径」一句——该批五条证据串须一次性合入，勿分次覆盖。
4. 是否给「`public/art` 根目录不留 `manifest_*.json`」建一条常驻哨兵（现只有 scatter 族反向探测器，
   根目录 JSON 面无守护）；建测试属执行班可为，但**建了就把 A/B 案的口径写死**，故仍等人工拍板。
