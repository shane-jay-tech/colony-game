# c927-47 · colony 侧 manifest/verifier 同型结构普查（否定式结论＋归属核对，零码改动）

- 班名：`qoder-executor-20260928-0120-colony49`｜档位：只读／文档位
- cwd：`D:\code\colony-game`｜取数时 HEAD：`abdf13d`｜开班 `git status --porcelain | wc -l`：`4`｜收班：`5`（第 5 件＝本档＋c927-44 档各一枚，见 §6）
- 现取时戳：`Mon Sep 28 01:34:27 2026`（本机 `date`，写盘前复取）

## 结论（一行）

**本仓无 1318 同型结构**——colony-game 内既无 `assets/demo-manifest.json` 族文件，也无任何 `verifier`／`last_result`／`storage.key` 字段的 manifest，故 1318 那两处「manifest↔代码不一致」**在本仓没有可订正的对象**；1318 实体归**根仓 `D:\code` 的 `learning-system-demo/`**（该目录无自有 `.git`），与 colony-game 路径无重叠。

> 但本仓有**同名不同型**的 manifest 族，且其中一处确属「清单声称 ↔ 磁盘实存」不同步的同族风险，**已在册**（c922-109／c924-35），本单只点名不重算，见 §5。

---

## 1. 锚点复核

| 卷宗锚点 | 盘上实况 | 结论 |
|---|---|---|
| `zcode-bridge/outbox/20260925-154234-1318.result.md`「两处 manifest 与代码不一致（`verifier.last_result` 的复现条件、`storage.key` 键名）」 | outbox 查无此件；实体在 `D:\code\zcode-bridge\done\20260925-154234-1318.result.md`（10,971 B） | 路径搬家不是缺陷（brief §3 的批量投递缺陷，本单命中并在 `done/` 取到） |
| 1318 的 cwd | 其任务件 frontmatter `cwd: D:\code\learning-system-demo` | 与本单 cwd（colony-game）**不同仓**；本单被要求「核对 1318 所在仓路径归属」⇒ 见 §4 |

---

## 2. 普查矩阵（命令原文＋读数＋**未接管道的真 rc**）

| # | 命令（均在 `D:\code\colony-game` 执行） | 读数 | rc | 判读 |
|---|---|---|---|---|
| E1 | `rg --files -g "*manifest*"` | 13 行：4 枚 `public\art\manifest_portraits_<ts>.json` ＋ 1 枚 `docs\design\p1-4-manifest-authority-20260922.md` ＋ 8 枚 `docs\insights\colony-*manifest*.md` | 0 | 本仓**有** manifest 字样文件，但**无** `demo-manifest` 一枚 |
| E2 | `rg --files -g "*verifier*"` | 空 | **1** | 本仓无名为 verifier 的文件 |
| E3 | `ls -d assets` | `cannot access 'assets': No such file or directory` | **2** | 1318 的 `assets/` 目录在本仓**不存在**（本仓资产面是 `public/art/`） |
| E4 | `rg -n --hidden -g '!node_modules' -g '!dist' -g '!dist-out' -g '!tmp' -g '!_archive' -g '!public/art/*.json' "verifier"` | 空 | **1** | 全仓（含隐藏件）无 `verifier` 字面串 |
| E5 | `rg -n -g '!node_modules' -g '!dist*' -g '!tmp' -g '!_archive' "last_result\|demo-manifest\|storage\.key\|storageKey"` | 空 | **1** | 1318 两处不一致所涉的**三个字段名在本仓零命中** |
| E6 | `rg -n -g '*.json' "…"` 同 E4/E5 口径（`"verifier"\|"storage"`） | 0 行 | **1** | 本仓任何 JSON 都**不声明** `verifier`/`storage` 段 |
| E7 | `rg --files -g "*demo*" -g '!node_modules' -g '!dist*' -g '!tmp/**'` | 2 行，均为 `docs\decisions\2026-06-07-impl-demolish-*.md`（`demo` 是 `demolish` 的子串） | 0 | 阴性对照：本仓无 demo 域资产，命中全是词形巧合 |
| E8 | `rg -n "sha256\|bytes\|last_result\|verifier\|generatedAt" src/renderer/data/artManifest.ts` | 0 行 | **1** | 代码侧清单 `artManifest.ts` 的字段面是 `key/path/category/required`（`ArtAssetDef`，`:18-23`），**无**自述运行结果/哈希/键名声明 ⇒ 与 1318 那份 manifest **不同型** |
| E9 | `rg -n "manifest_portraits" -g '!public/art/**' -g '!tmp/**'` | 55 行：`docs\insights\colony-portraits-orphan-triage-20260924.md`(19)／`colony-manifest-portraits-orphan-20260922.md`(14)／`colony-manifest-disk-snapshot-20260922.md`(6)／其余散见 ＋ **仅 1 行** 来自 `scripts\gen_portraits_events.py` | 0 | 四枚 json 无**运行时读取者**（`src/**` 0 命中）⇒ 它们是生成器留下的落库日志，不是被消费的清单 |

> E4/E5/E6/E8 是本单的**否定式主证**：均按纪律「取 rc 不接管道」（brief §6），先把输出重定向到本班 `D:\code\tmp\qoder-executor-20260928-0120-colony49\` 下临时件再 `echo $?`，rc=1＝ripgrep 的「无命中」正常退出码，rc=2＝`ls` 的「无此目录」。

---

## 3. 「若有则订正」的裁决：**本仓零订正项**

1318 的两处不一致各自依赖一个本仓不存在的载体：

| 1318 待订正项 | 依赖载体 | colony 侧对应物 | 结论 |
|---|---|---|---|
| `verifier.last_result = "PASS 18/18"` 的复现条件（默认 locale 实为 RC=1） | `learning-system-demo/assets/demo-manifest.json` 的 `verifier` 段 | 无（E2/E4/E5/E6 四重零命中） | 无对象可订正 |
| `storage.key` 声明值与 `app.js:9` 实际键 `lsdemo_done_v1` 不符 | 同文件的 `storage` 段 | 无（E5/E6 零命中）；本仓的"存储键"面是存档槽名（`saveLoad.ts` 的 `loadFromSlot(slot)`），不由任何 manifest 声明 | 无对象可订正 |

⇒ **不产出订正件、不改任何码**；订正动作留在 1318 自己的仓（且其 json 在根仓是未跟踪在途件，见 §4）。

---

## 4. 归属结论：1318 所在仓路径

```
$ ls -d /d/code/learning-system-demo/.git
ls: cannot access '/d/code/learning-system-demo/.git': No such file or directory   rc=2

$ cd /d/code && git ls-files -- learning-system-demo
learning-system-demo/README_部署指南.md
learning-system-demo/assets/app.js
learning-system-demo/assets/data.js
learning-system-demo/assets/runners.js
learning-system-demo/assets/styles.css
learning-system-demo/index.html
learning-system-demo/tools/verify-question-bank.mjs
learning-system-demo/作业一：方案说明.docx          ← 已跟踪 8 件（与 1318 E10 同读数）

$ git ls-files -- learning-system-demo/assets/demo-manifest.json      （空）
$ git status --porcelain -- learning-system-demo
?? learning-system-demo/INVENTORY.md
?? learning-system-demo/OPERATIONS.md
?? learning-system-demo/assets/demo-manifest.json
```

判读：
1. `learning-system-demo` **没有自己的 `.git`** ⇒ 它是**根仓 `D:\code` 工作树内的子目录**（与 brief §5 表末行「`training-reminder`／`learning-system-demo` 没有自己的 .git，写落点在根仓」一致，本单实测复核）。
2. 两处不一致所落的 `assets/demo-manifest.json` **在根仓是未跟踪 `??`**（连同 `INVENTORY.md`／`OPERATIONS.md`）⇒ 1318 的订正若要落，属**根仓**的一次新文件写入，且该件归属未坐实（1318 自己就把它记作「他班在途、禁改禁撤销」）。
3. 与 colony-game（独立 `.git`、HEAD `abdf13d`）**无任何路径重叠** ⇒ 本波次不该把这处订正派给 colony 档；本档即"派错域"的登记件。

---

## 5. 本仓同名不同型族：登记而不重算（同族风险真实存在）

普查中发现的**另一支** manifest 族，属卷宗问的「同族」而非「同型」，且**已在册**：

**(a) `public/art/manifest_portraits_*.json` 四枚（tracked，`git ls-files -s` 见 blob `2ebeae00/050a9e60/4bb338ad/e7a7fa19`）**：结构是 `[{id, saved, error}]` 的生成日志，`saved` 写的是**本机绝对路径的 .png**；本班当场复点磁盘核对：

```
$ python - <<'PY'   # 逐枚 entries / missing_on_disk / with_error
manifest_portraits_1781872115.json entries=2  missing_on_disk=2  with_error=0
manifest_portraits_1781872230.json entries=13 missing_on_disk=5  with_error=8
manifest_portraits_1781872304.json entries=8  missing_on_disk=5  with_error=3
manifest_portraits_1781872377.json entries=3  missing_on_disk=3  with_error=0
PY   rc_py=0
```
⇒ 26 条 `saved` 声称里 **15 条在盘上不存在**（且盘上实存的是同名 `.webp`，c921-02 整批转码所致）。这与 1318 的缺陷**同一形状**（清单声称 vs 实际状态不随动），但**已由两份在册档处置过**：`docs/insights/colony-manifest-portraits-orphan-20260922.md`（c922-109，三案表＋可逆移件实测）与 `colony-portraits-orphan-triage-20260924.md`（c924-35，差异表＋案 A 处置材料，其自述「零删除、零移件、零改生成器」）。⇒ **本单一律不重算、不删、不改**，只把「四枚仍 tracked、仍无运行时读取者（E9：`src/**` 0 命中）」这层现状补上。

**(b) 代码侧清单 `src/renderer/data/artManifest.ts`**：`ArtAssetDef{key,path,category,required}`，字段面无哈希/无自述结果（E8）⇒ 不同型。但其文档注释自己声明了一条**非常驻**的实存保证：「除上述两型外，每条 path 都由 `tmp/art-exists-check.mts` 逐键断言实存」（`:13`）——`tmp/` 在本仓被 `.gitignore` 覆盖（`.gitignore:25`）⇒ 该校核是**一次性本机脚本、不进门禁**；另两型例外（`bld_tin_mine`/`bld_hemp_field`）**刻意保留不存在的 `assets/buildings/{id}.webp` path**（`required=false`，`:26-28` 自述"不谎报一个同样不存在的 png"）。⇒ 这是本仓真实的「清单↔磁盘」同族风险面，但**是否构成缺陷由 c921-01/c921-02 的在册裁决管**，本单只登记，不新下判据。

---

## 6. 零码改动自证 ＋ 纪律

```
$ git status --porcelain -- src scripts assets package.json vitest.config.ts electron.vite.config.ts | wc -l
0
```
- 未触碰生产码（横幅要求的单列自证）：本班对 `src/**`／`scripts/**`／`public/**` 全程只用 Read/Grep/rg，**零 Write/Edit**；未跑任何测试（本单判据不依赖测试读数 ⇒ 也**未跑全量套件**）。
- 盘上新增仅本文档一枚（`docs/insights/c927-47-manifest-consistency-check.md`，未跟踪；字节数以 result「改动清单」现取为准，本文不写自身大小以免自指失真）；`git status --porcelain` 由开班 4 件变 **6 件**＝4 件开班在途 ＋ 本域两单新增档（c927-44／c927-47），**无一件是本班改动他人原件**。
- 在途件照读未碰：`docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-dead-exports-20260914.json`、其 `.bak` 的在途删除、`docs/insights/colony-suite-timings-20260921.json`；`docs/insights/colony-dead-exports-20260914.json.bak` 的删除动作**归属未坐实** ⇒ 本单一律不动。
- 🔴 **卷宗内部冲突点名（brief §9 要求）**：卷宗「禁止事项」写「禁止…触碰 cwd 之外的路径」，而同卷宗「做什么」要求「核对 1318 所在仓路径归属」——1318 实体在 cwd 外。按 brief §9「卷宗正文优先」，本班执行"做什么"，并把它窄化为**纯查询**（`ls -d`／`git ls-files`／`git status --porcelain` 三条只读命令，见 §4 原文），**零写、零 checkout、零 stash**，未在 cwd 外创建任何文件。
- 临时件：`D:\code\tmp\qoder-executor-20260928-0120-colony49\`（e8/e13/e16/e17.txt ＋ vitest 日志），收班自清，仓根无残留。

## 7. 遗留（交主班）

1. 本单判据形状是「若无则如实记」⇒ 结论为**否定式**，未产出订正件。**建议主班把 1318 的两处订正回归 `learning-system-demo` 域**（根仓写位），colony 档不再派同型订正单。
2. 若主班要动 §5(a) 四枚 tracked 陈旧 json，走**已在册**的 c924-35 案 A 材料，别按本档重算（本档的 15/26 缺失读数只在 `abdf13d` 时点有效）。
3. §5(b) 的「实存校验脚本落在 gitignored `tmp/` ⇒ 不进门禁」是一条可复用的结构观察：若要它常驻，需把 `art-exists-check` 从 `tmp/` 提升进 `scripts/` ＋ 配一条定向 vitest/CI 判据 ⇒ 属**新增排定任务/改门禁**，人工闸，本班不动。
