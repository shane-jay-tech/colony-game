# colony `public/art/manifest_portraits_*.json` 四件差异表＋案 A 处置材料（c924-35，2026-09-24/25 夜班）

> **性质**：盘点＋处置**建议**。本文**零删除、零移件、零改生成器、零改他班档**；处置动作全部交人工/主班。
> **取数时点**：colony HEAD `a75a7d57a4c6c3716f9bc341b9e85076bd220d6f`（2026-09-25T01:05 +0800）；
> 同仓写位兄弟班 `...-colony28` 正在改 `src/renderer/render/`＋`MapRenderer.ts`（c924-27），本单未碰、也未跑任何测试/构建。
> **前置在册档**：`docs/insights/colony-manifest-portraits-orphan-20260922.md`（c922-109，三案表＋可逆移件实测）——
> 本单是它的**时效复核＋差异画像**，不重做它的结论；凡本档与它数字冲突处，两读数都留下并标明谁在何时取的。

---

## 〇、接班先否证（四条；第一条会直接改变执行方向）

| # | 卷宗/在档前提 | 本单实测 | 结论 |
|---|---|---|---|
| **1** | 卷宗：「出**案 A（归档处置）**材料」 | 前置档 c922-109 §六 的字母表里 **A 案＝`git rm` 删除**，「移到别处留一份副本」是 **B 案**；卷宗把字母与动作**错位绑定** | 🔴 **字母撞名，属执行方向分歧**，必须人工先解：按字母做＝删；按括号语义做＝归档移件。本单**两套出口都写全**（§五），不替人工选 |
| 2 | 卷宗锚点：四件为 `{1781872115, **1781872177**, 1781872230, 1781872304}` | `ls public/art/manifest_portraits_*.json` → 实际是 `115 / 230 / 304 / **377**`；**`…177` 不在盘**，`…377` 未列入 | 名单**错 2 件**（判据① 的「恰 4 件」成立，但件名按磁盘实况修正） |
| 3 | 卷宗：「时间戳相差 **192 秒内**」；c922-109 §二：「跨度 **112 秒**」 | `python -c` 相邻差 `[115, 74, 73]`、首末差 **262 秒**（20:28:35 → 20:32:57） | **两个数都不对**（192 与 112 均非跨度）；真值 **262 秒**。派单点名的「本仓今天三次被实测打脸的在册数」在此复现第 4 次 |
| 4 | 卷宗：四件是「生成器多次运行的**冗余件**」 | 26 条记录里 **11 条是 `submit 429 Throttling.RateQuota` 失败记录**；四件 id 集互不相同（§二矩阵）；15 个成功 id 去重后恰好 = 5 将领＋10 事件 | **不是冗余副本**，是一条「首发＋三次限流重试」链的**逐次台账**。这直接抬高「删除」的信息代价（§五），也使「合并去重为一份批次史料」成为比原三案更贴身的第四选项 |

> 另：判据④ 字面命令 `rg -rn manifest_portraits src/` **不可照抄**——`rg` 的 `-r` 是 **replace**（会把命中词替换成 `n`），普查当场变假象。本单用 `rg -n` ＋ `git grep -n` 双轨（§四）。

---

## 一、四件差异表（判据①②）

顶层类型均为**数组**（`[{id, saved, error}, …]`，无「首键」——此点 c922-109 §二已更正过，本单复核仍成立）。
四件 `git diff --quiet HEAD -- public/art` → rc=0 ⇒ **工作树＝HEAD，逐字节同**（同型可比，sha256 可作身份证据）。

| 文件名（= 判据① 的四个在册件） | epoch → 本地时刻 | 字节 | 条目数（判据②） | `saved` 非 null | `error` 非 null | 覆盖目录 | HEAD blob | 盘上 sha256(12) |
|---|---|---|---|---|---|---|---|---|
| `manifest_portraits_1781872115.json` | 2026-06-19 20:28:35 | 273 | **2** | 2 | 0 | generals＋events | `2ebeae00…` | `df66da84ea13` |
| `manifest_portraits_1781872230.json` | 2026-06-19 20:30:30 | 2959 | **13** | 5 | 8（429） | generals＋events | `050a9e60…` | `b689993e352b` |
| `manifest_portraits_1781872304.json` | 2026-06-19 20:31:44 | 1482 | **8** | 5 | 3（429） | events | `4bb338ad…` | `cfef415bb2d3` |
| `manifest_portraits_1781872377.json` | 2026-06-19 20:32:57 | 398 | **3** | 3 | 0 | events | `e7a7fa19…` | `c8a4e35c3d02` |
| **合计** | 跨度 **262 秒** | **5112 B** | **26** | **15** | **11** | 唯一 id **15** | — | — |

- `error` 内容样张（本单只读，已扫凭据形态）：`submit 429: {'code': 'Throttling.RateQuota', 'message': '…aliyun.com/zh/model-studio/error-code#rate-limit', 'request_id': 'f92a…'}`；
  `rg '(sk-[A-Za-z0-9]{8,}|api[_-]?key\s*[:=]\s*\S+|Bearer\s+\S+)'` 对四件全文 → **0 命中** ⇒ 归档/删除**不涉密钥外泄**（红线域已核，未动任何数值）。
- 四件合计 5112 B = 5.0 KiB ⇒ **删除的收益不是体积**（c922-109 §一 同判）。

---

## 二、id 集差异结论（判据③：明确「不一致」＋证据）

**结论：四件 id 集两两不一致，但按时间序构成一条严格互补的重试链**（115 首发 2 件 → 230 补 11 件其中 8 件 429 → 304 补 5 件其中 3 件 429 → 377 补最后 3 件全成）。

| id | 115 | 230 | 304 | 377 | 成功于 | 该成功条目的 `saved` |
|---|---|---|---|---|---|---|
| `gen_pei_shao` | ✅ | — | — | — | 115 | `…\generals\gen_pei_shao.png` |
| `unification` | ✅ | — | — | — | 115 | `…\events\unification.png` |
| `gen_hu_ben` / `gen_xie_changqing` / `gen_tian_zhong` / `gen_barbarian` | — | ✅×4 | — | — | 230 | 各 `…\generals\<id>.png` |
| `coronation` | — | ✅ | — | — | 230 | `…\events\coronation.png` |
| `battle` / `flood` / `feast` / `diplomacy` / `rebellion` | — | ❌429×5 | ✅×5 | — | 304 | 各 `…\events\<id>.png` |
| `ending_gong` / `ending_jia` / `ending_huo` | — | ❌429×3 | ❌429×3 | ✅×3 | 377 | 各 `…\events\<id>.png` |

- 跨文件重复 id：`battle/flood/feast/diplomacy/rebellion`（2 次）、`ending_gong/jia/huo`（3 次）——**重复的都不是冗余成功件，而是失败记录的重试残留**。
- 唯一成功 id **15** = `GENERAL_ART` 5 ＋ `EVENT_ART` 10，与 `artManifest.ts` 现役清单**一一对应**（本单独立核对，未抄 c922-109）⇒ 该批出图**已完成且无遗漏**。
- 🔴 **`saved` 字段全部已失效**：15 条有路径的记录里，**15/15 的绝对 `.png` 路径今日盘上不存在**（c921-02 整批转码删原 png），
  而同干 `.webp` **15/15 在盘**。余 11 条 `saved: null`（无路径可判）。
  ⇒ 口径更正：c922-109 §二写「26 条里 26 条指向的文件现已不存在」，严格说是「15 条有路径者 100% 不存在，另 11 条本就没有路径」。
  ⇒ 这使「复用」这条出口几乎不成立（内容既不能当清单用、也不能喂任何加载器，BootScene 走的是 `artManifest`）。

---

## 三、与 `gen_portraits_events.py` 生成参数的关系（增殖机制与「现在跑不动」）

```
$ rg -n 'manifest_portraits|int\(time\.time' scripts/gen_portraits_events.py
154:    manifest = base / f"manifest_portraits_{int(time.time())}.json"     # 唯一写点，c922-109 记 :154 未漂
$ rg -n 'sys\.path|^import gen_wanxiang_batch' scripts/gen_portraits_events.py
19:    sys.path.insert(0, "D:/code/scripts")
20:    import gen_wanxiang_batch as gw
$ ls -la /d/code/scripts/gen_wanxiang_batch.py
ls: cannot access '/d/code/scripts/gen_wanxiang_batch.py': No such file or directory
```

1. **命名机制解释了四件并存**：文件名带 `int(time.time())` ⇒ 每跑一次**净增一件、永不覆盖**。
2. **同型缺陷是四族不是一族**（本单复跑，行号有 1 处漂移）：
   `gen_portraits_events.py:154`、`gen_buildings_art.py:142`、`gen_terrain_art.py:76`、**`gen_scatter_art.py:89`**（c922-109 记 `:84`，今日实为 `:89`，漂 +5）。
   ⇒ 任何「只治 portraits」的处置都会留下三处同型面（判据不一致），处置若通过应**四族同批口径**。
3. **「重跑会新增第 5 件」不成立**：依赖模块 `gen_wanxiang_batch` 缺盘 ⇒ import 期即失败；且其默认模型（万象）按 `D:/code/CLAUDE.md` 2026-09-13 阵容定稿**已退役**。
   ⚠ **本单刻意未执行该脚本**（含 `--help`）：它一旦越过 import 就会真发付费生成请求，属凭据/成本红线；上面两条只读证据（`rg` import ＋ `ls` 缺盘）已足以判「跑不动」，无需真跑。
4. 今日盘上另有 **4 份构建副本**：`dist/renderer/art/manifest_portraits_*.json`（`git check-ignore -v` → `.gitignore:2 dist/` 命中，**未跟踪**）。
   ⇒ 处置真件后 **`dist/` 里仍会留着旧副本**，直到下一次 `npm run build` 覆盖 ⇒ 归档/删除的"洁净"效果在建产物上是滞后的，需写进处置说明。

---

## 四、孤儿判定（判据④，双轨 ＋ 0 命中复核）

```
$ rg -n 'manifest_portraits' src/                        → 无输出，rc=1
$ git grep -n 'manifest_portraits' -- src                → 无输出，rc=1
$ rg -n 'manifest_portraits' --glob '!node_modules' -l   → 12 份命中，全部是 docs/**（历史/洞察/设计档）＋ scripts/gen_portraits_events.py 自身，rc=0
$ rg -n 'manifest_portraits' src/ -g '**/*.test.ts'      → 无输出，rc=1（无任何测试枚举 public/art 根目录的 .json）
```
⇒ **src／tests 零引用**成立（双轨均 rc=1，非单轨假零）。这四件今日唯一的"被读到"是**文档文字账**与探针统计。

**孤儿面现值（本单独立复算，不跑他班探针）**：`public/art` 盘上文件 **65**（c922-109 记 66 ⇒ **−1 已发生**，
归因：`2787251` c923-16/17/18 删掉了 `public/art/scatter/bush_dry.webp`，即 c922-109 §四留待人工的那 1 件真孤儿**已被处置**）。
按「未被 `artManifest` 声明」口径镜像复算：孤儿 **12 件 = 本 4 件 JSON ＋ 8 件 `art/scatter/*.webp`（假孤儿，属 P1-4 未收口面）**。

> 诚实标注：这条 12 是**本单正则推导值**，非 `tmp/art-exists-check.mts` 的官方读数（本单未跑该 tsx 探针：他班一次性件、并发窗、且会写 `tmp/` 输出）。
> 推导过程中本单第一版曾得 **17**（假高 5 件），原因是漏了 `GENERAL_ART` 的模板式 `path`——已修正并把两个数都留下，供执行前再核。
> 权威读数请由执行班跑 `npx tsx tmp/art-exists-check.mts` 现取（预期 `diskArtFiles=65`、`orphans=12`，与本推导对齐即采信）。

**牵动面（c922-109 §五已实测，本单未重复跑测，只复核其前提）**：移走四件后美术族定向 9 文件 63 例、全量 1338 例**零转红**。
本单独立复核「为什么零牵动」——把测试面所有目录枚举落点列出来逐条判：

```
$ rg -l 'public/art' src/ -g '**/*.test.ts' | wc -l        → 5 份
$ rg -n 'public/art' src/ -g '**/*.test.ts'
    artManifestReuse.test.ts:9      const BUILDINGS_DIR = … 'public/art/buildings'
    scatterAssets.test.ts:8         const SCATTER_DIR   = … 'public/art/scatter'
    scatterDiskReconcile.test.ts:36 反向断言只扫 public/art/scatter/ 的 .webp
    artManifestEvtArtUsage.test.ts:88 readdirSync(EVENTS_DIR).filter(.webp) == 10   # EVENTS_DIR = public/art/events
    terrainPaths.test.ts:26         三源互等读 public/art/terrain
$ rg -n "manifest_|readdirSync|\.json'" src/ -g '**/*.test.ts'   → 无一条枚举 public/art **根**、无一条按 `.json` 过滤
```
⇒ **结论：没有任何测试会因四件 JSON 离场而变红**（所有盘枚举都锁定在四个子目录且按 `.webp` 过滤）。
这条比 c922-109 的"移件实测"更强：它是**机制级**解释，不随测试文件数漂移。

---

## 五、案 A 处置建议（字母撞名 ⇒ 四条出口全给，动作写在名字上）

**共同前提（本单实测背书）**：四件均在 HEAD（blob 见 §一表）、`git diff --quiet HEAD -- public/art` rc=0；
删除/移件对 1338 例零牵动；内容自身已失效（15/15 png 路径不存在）；不涉密钥。
⇒ **可逆性高，但仍属"删档/移动跟踪件"＝人工闸后动作**，本班不执行。

| 出口 | 动作（按动作命名，不按字母） | 落点/命令 | 回滚指向 | 代价 | 本单评 |
|---|---|---|---|---|---|
| **甲** | **仓内归档**（受 git 看守，卷宗括号语义的正解） | `git mv public/art/manifest_portraits_*.json docs/artifacts/2026-06-19-portraits-batch/`（新建目录，`docs/` 不受 `.gitignore` 影响） | `git revert`；件仍在 HEAD，`git mv` 保 rename 检测 | `docs/` 里多 5 KiB 史料；文字账三处需同步（见下） | **若"归档"是人工本意，这是唯一不脱离 git 的归档形态**。比 c922-109 的 B 案（移 `tmp/`＝脱离 git 看守、`tmp/` 随时可清）更安全 |
| **乙** | **直接删除**（c922-109 字母表里的「A 案」） | `git rm public/art/manifest_portraits_*.json`（**四件一次一提交**） | `git revert <删除提交>`；或逐件 `git checkout 54eafe9 -- public/art/manifest_portraits_<ts>.json`。**本单逐件验过入库点**：`git log --diff-filter=A -- <每件>` → 四件均 `54eafe9 2026-08-13`（c922-109 只对首件做过此验） | 一次性丢掉 11 条 429 `request_id`（6/19 三次限流的唯一实物证据）；`orphans 12 → 8` | 净仓内效果与甲相同，只是不留件。c922-109 §六 已判它"代价最低"，但那时还没人把「案 A」读成"归档" |
| **丙** | **合并为一份批次史料**（§〇之 4 引出的第四形态） | 由甲/乙任一派生：把 26 条去重压成 `docs/artifacts/2026-06-19-portraits-batch/manifest_merged.json`（15 成功＋11 失败分节），再 `git rm` 原四件 | 同乙（原件在 HEAD） | 需要一次人工写件；新增一份需长期维护的档 | 保住了"重试链"这个唯一有价值的信息，又消掉四件增殖面。**若人工既想留痕又想清零，选这条** |
| **丁** | **保留不动＋改生成器**（c922-109 的 C 案） | 四个 `gen_*_art.py` 的 `int(time.time())` 写点改固定名覆盖或改写 `tmp/` | 单文件 `git revert`（1–4 行） | 生成器**当前不可运行**（缺 `gen_wanxiang_batch`＋万象退役）⇒ 改完无法运行验证，只能目检；且单独只改 portraits 会留三处同型 | **必要性最低**；但四族同批改才是完整口径，若采纳须一并改 |

**处置说明必须连带写清的三处文字账**（皆他班档，本单不代改）：
`docs/insights/colony-art-full-20260919.md:12` 的「public/art 66」→ 今日实为 **65**（bush_dry 已删，与本处置无关但同数）；
`docs/insights/colony-artmanifest-relink-20260920.md:173` 的「orphansArtFiles=13」→ 推导现值 **12**，处置四件后 **8**；
c922-109 §六 的「13 → 5 → 1」预测链**已失效**（末端的 1 件 `bush_dry.webp` 已被 c923-18 删除），新链应为 **12 →（P1-4 收口 8 件被声明）4 →（本处置）0**。
⇒ 「落不到 0」这句现在**不成立了**：scatter 假孤儿面被 P1-4 声明、`bush_dry` 已离场后，处置完四件 JSON 可以**真的归 0**——这是对 c922-109 §六 的一处**正向更正**。

**次序建议**：与 c922-109 同调——**先合 P1-4（scatter 进 manifest）再处置本四件**，`orphans` 走 12 → 4 → 0，解释成本只付一次。
但两单无硬依赖：若 P1-4 不落地，本四件也可单独处置（12 → 8）。

---

## 六、完成标准逐条对照 ＋ 零删除零移动自证

| 判据 | 结果 | 复算命令 |
|---|---|---|
| ① `ls` 复跑恰 4 件且文件名入表 | **达成**（4 件；**但件名与卷宗列的不符**，见 §〇之 2） | `ls public/art/manifest_portraits_*.json \| wc -l` → 4 |
| ② 每件条目数（`json.load` 后 `len`）入表 | 达成 **2 / 13 / 8 / 3**（合计 26） | `python -c "import json,glob;[print(f,len(json.load(open(f,encoding='utf-8')))) for f in sorted(glob.glob('public/art/manifest_portraits_*.json'))]"` |
| ③ id 集差异结论明确 | 达成：**不一致**（§二矩阵：两两不同＋8 个跨件重复 id 全为失败重试残留） | 同上，`[e['id'] for e in …]` 逐件打印 |
| ④ `rg … manifest_portraits src/` 零命中佐证 | 达成（**双轨**均 rc=1；卷宗字面的 `rg -rn` 是 replace 陷阱，未照抄） | `rg -n 'manifest_portraits' src/`／`git grep -n 'manifest_portraits' -- src` |
| ⑤ 零删除零移动，`git status` 只新增 1 个 md | **按实况修正**：本班两单（c924-34＋c924-35）各产 1 份 md ⇒ `??` 为 **2** 份，其中本单 1 份；零删除零移动成立 | `git status --porcelain` ＋ `git diff --quiet HEAD -- public/art`（rc=0）＋ `find . -newermt '<接班时刻>' -not -path './node_modules/*' -not -path './.git/*'`（见下） |

```
$ git status --porcelain                     # 收班时点
 M docs/design/OPTIMIZATION_BACKLOG.md                 ← 在册在途，开工前即脏
 M docs/insights/colony-dead-exports-20260914.json     ← 在册在途
 D docs/insights/colony-dead-exports-20260914.json.bak ← 在册在途（非本单所为）
?? docs/insights/colony-p1-premerge-verify-20260924.md  ← 本班上一单 c924-34 产物
?? docs/insights/colony-portraits-orphan-triage-20260924.md ← 本单产物（唯一）

$ git diff --quiet HEAD -- public/art ; echo rc=$?      → rc=0（四件字节级未动）
$ find . -path ./node_modules -prune -o -path ./.git -prune -o -path ./dist -prune -o -newermt '2026-09-25 01:47' -type f -print
  → 本单 1 份新 md ＋ 兄弟班 colony28 的在途件（`src/renderer/render/__tests__/viewportMath.test.ts`、`tmp/c924-27-*` 9 份），非本单所为
$ find /d/attic -maxdepth 1 -newermt '2026-09-25 01:00'  → **输出为空**（仓外零写入，沿上一班「取空即证」法；本命令未接管道，rc 可信）
$ find /d/code/tmp -maxdepth 1 -type f -newermt '2026-09-25 01:39'
  → 2 件 `qoder_k36_*`（**他班 kaoyan36 产物，非本班**）⇒ 本班两单的全部写面 = colony-game 内 2 份新 md ＋ 信箱 outbox 2 份 result，仓外零写
```

计时（并发窗，不可与单跑窗比）：`max_minutes: 25`，本单实耗约 12 分钟档；**未跑 vitest/tsc/build**（兄弟班正在写 `render/`，
牵动面直接引 c922-109 §五 已做的可逆移件实测，不重复跑）。

---

## 七、遗留问题

1. 🔴 **「案 A」字母与动作的绑定歧义**未解（§〇之 1）——本单两向都备好，但**主班派单/合入时必须点名动作**，否则会出现"要归档却被删"或"要删却留了副本"。
2. 三处文字账（§五末）与 c922-109 §六 的「13 → 5 → 1」预测链失效需更正；两份他班档本单**未代改**。
3. `orphans` 权威读数待执行班跑 `npx tsx tmp/art-exists-check.mts` 现取；本单只给正则推导值 **12**（并披露第一版假高 17 的成因）。
4. `dist/renderer/art/` 内 4 份未跟踪副本会使处置效果在建产物上滞后（§三之 4），处置说明里要点名"需 rebuild 后才净"。
5. 四族同型增殖面（portraits/buildings/scatter/terrain 四脚本）中只 `gen_scatter_art.py` 行号漂移（`:84 → :89`）；若采纳丁案须四族同批，否则判据不一致。
6. 本单未补 `docs/insights/` 索引（三份并存无权威，属待人工在册项）。
