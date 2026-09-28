# c927-70 全 `public/` 反向对账：归属判定材料＋脚本草案（2026-09-29T05:1x，colony62 班）

> **性质**：只读材料单。**零脚本落盘、零测试件落盘、零 git 写操作**。
> **HEAD** `6fbeb23`（分支 `codex/architecture-hardening`，本班现取）；开工 porcelain **15 件**，收口 **16 件**（差额＝本文档这枚新增 `??`，四枚禁碰件与前十枚前手段位一字未动）。
> **为什么 partial**：完成标准 ①「归属判定」是人工拍板面（红线：只出材料不下判定）；卷宗与锚点都把「脚本落地」排在决定之后（顺序不能反），故脚本以草案形态留在本档 §五，**不落 `scripts/`**。详见 §六。

---

## 一、前提复核（逐句改成命令实测；两处否证）

| # | 卷宗／锚点前提（原文） | 本单实测命令与读数 | 结论 |
|---|---|---|---|
| 1 | 锚点 c922-117 遗留 1：「必须先决定 **4 件 `manifest_portraits_*.json` 与 `bush_dry.webp`** 的归属……先落用例会当天**红 5 件**」 | `$ find public -iname "*bush*"` → 只有 `bush_shrub.webp`；`$ git log --oneline --all -3 -- public/art/scatter/bush_dry.webp` → `2787251 test(colony): c923-16/17/18 三单入账（…＋bush_dry 停产与资产清理）`；`$ grep -n KNOWN_SCATTER_ORPHANS src/renderer/data/__tests__/scatterDiskReconcile.test.ts` → `:34 const KNOWN_SCATTER_ORPHANS: readonly string[] = [];`（:31-:33 注释自述已按人工授权走 A+B 出口删件＋停产） | 🔴 **`bush_dry` 一支已在 HEAD 闭合**，决定项集从「4 json＋bush_dry＝5 件」缩为**只剩 4 件 json**；"红 5 件"现值 **红 4 件**（§三读数印证） |
| 2 | 锚点 c922-117 证据 6：「`public/` 文件总数=**81**……`.webp`:**62**」 | `$ find public -type f \| wc -l` → **80**；`$ find public -type f \| sed 's/.*\.//' \| sort \| uniq -c` → **61 webp / 4 json / 9 mp3 / 6 wav** | 9/22 快照已过期（差的正是 `bush_dry.webp`），本档按磁盘实况取数并留两读数 |
| 3 | 卷宗：「从 **c927-53 的双向对账**扩展」 | `$ git ls-files scripts/art-coverage-reconcile.mts` → 在册（该单产出的常驻打印器）；`$ head -1 scripts/art-coverage-reconcile.mts` → shebang；111 行、`node:fs` 只 import `readFileSync` | 扩展基线在世，未漂 |
| 4 | 横幅：「colony 此刻只有你一路」＋w58 记 HEAD `947075d`／脏 15 | `$ git rev-parse --short HEAD` → **`6fbeb23`**（brief 的 `947075d` 之后主班又入库过）；`$ git status --porcelain \| wc -l` → **15**，构成与 w58 §C 逐条同（4 枚未归因＋9 枚 `?? docs/insights/c927-*.md`＋`?? scripts/clean-install-verify.ps1`＋`?? …/hudRefreshCost.test.ts`） | 脏件**构成未变**，只是 HEAD 前进；四枚禁碰件一字未动 |
| 5 | c922-109 §一：生成器不可重跑 ⇒ 四件无再生途径 | `$ sed -n '18,20p' scripts/gen_portraits_events.py` → `sys.path.insert(0, "D:/code/scripts")` ＋ `import gen_wanxiang_batch as gw`；`$ ls scripts/ \| grep -i wanxiang` → **零命中**（模块不在本仓，注入路径 cwd 之外，本班按纪律不遍历） | 复核成立：唯一写方在本仓外，**四件不可重跑再生**（抬高"删除"这一出口的代价） |

---

## 二、归属判定材料（4 件 json 画像；**判定留人工**）

```
$ git ls-files -s public/art/ | grep manifest_portraits
100644 2ebeae000d72c748b666fb3f5c34960096a425f1 0  public/art/manifest_portraits_1781872115.json
100644 050a9e604f51ecd362cd288a2463457c16cbdf77 0  public/art/manifest_portraits_1781872230.json
100644 4bb338ad07ce8021ba11a9d3d235fd9186c1dbae 0  public/art/manifest_portraits_1781872304.json
100644 e7a7fa197ce37d014be2fa79748f39ae85a86404 0  public/art/manifest_portraits_1781872377.json

$ git diff --quiet HEAD -- public/art ; echo $?      → 0（工作树＝HEAD，逐字节同）
$ git check-ignore -v public/art/manifest_portraits_1781872115.json ; echo $?   → rc=1（**未被忽略**，是受 git 看守的跟踪件）
$ git log --oneline --diff-filter=A -- public/art/manifest_portraits_1781872115.json  → `54eafe9`（四件同源）
$ grep -rn "manifest_portraits" src/ | wc -l        → **0**（运行时无任何读取者）
$ grep -rn "manifest_portraits" scripts/            → 仅 `gen_portraits_events.py:154`（唯一写方）
$ stat -c '%s %y' public/art/manifest_portraits_*.json → 273／2959／1482／398 B，mtime 全部 **2026-09-04 23:54:39**
```

- **形态**：`[{id, saved, error}]` 出图流水（`saved` 写本机绝对路径的 `.png`），**不是清单**、不能被任何加载器消费。
- **内容差异**（c924-35 §一/§二 现档，本单不复算，只登记其可复算性）：26 条记录 = 15 成功 id ＋ 11 条 `submit 429 Throttling.RateQuota`；四件 id 集两两不同、构成"首发＋三次限流重试"链；对四件全文扫凭据形态 **0 命中** ⇒ 处置**不涉密钥外泄**。
- **mtime 与入库时点背离**：盘上 mtime `2026-09-04 23:54`，内容时间戳却是 `2026-06-19 20:28:35–20:32:57`（epoch 1781872115…377，跨度 **262 秒**）⇒ mtime 只反映 9/4 那次 `54eafe9` 快照落盘，**不反映内容时点**；用它做"最近还在用"的论证会读反。
- **体积**：合计 5,112 B ⇒ 删除的收益不是体积（c922-109 §一同判）。

### 二-A 决定项清单（人工拍板面，本单不选）

在册出口已在两档备齐，本单复核**均仍在世、均未被执行**（`git ls-files public/art | grep -c manifest_portraits` = **4**）：

| 出口 | 动作 | 出处 | 本单只读复核 |
|---|---|---|---|
| 甲 | 归档移件（留一份副本） | `colony-portraits-orphan-triage-20260924.md` §五「甲」；c922-109 §六「B 移 `tmp/`」 | 落点若选 `tmp/` ⇒ 撞 `.gitignore:25` ⇒ 副本不受 git 看守（c922-115 证据 7 同型失明面） |
| 乙 | 直接删除（c922-109 字母表里的「A 案」） | 同上 §五「乙」，`git rm` 四件一次一提交 | 回滚点本单复算：`git log --diff-filter=A` 四件均 `54eafe9` ⇒ blob 永久可取 |
| 丙 | 保留＋扩豁免集（把"未解释孤儿"变成"已登记孤儿"） | 由本单 §三读数新暴露的第四形态 | 走这条＝把反向对账从"红"改成"绿"，**豁免集内容本身即归属声明** ⇒ 必须与甲/乙同源拍板，不能由脚本作者代填 |
| 丁 | 合并去重为一份批次史料 | c924-35 §〇-4 提出 | 需新增件＋删四件，属写形状＋裁决面叠加 |

🔴 **仍未解的字母撞名**（c924-35 §〇-1 与 遗留 1 点名，本单复核仍在）：「案 A」在 c922-109 字母表＝**删除**、在卷宗话术里被读成**归档**。派单/合入时若不点名动作只点字母，会执行反方向。

---

## 三、反向对账读数（探针实跑，先命令后数字）

```
$ cd D:\code\colony-game && npx tsx tmp/c927-70-probe.mts      → rc=0

# 全 public/ 反向对账（只读探针）
  building: getBootLoadList(building)        n=35
  terrain:  TERRAIN_ART 直取 asset.path       n=5
  scatter:  硬编码模板 art/scatter/<id>.webp   n=8
  general:  getBootLoadList(general)         n=5
  event:    硬编码模板 art/events/<name>.webp  n=10
  bgm:      BootScene.ts:78 audio/<key>.mp3   n=9
  sfx:      BootScene.ts:81 audio/<key>.wav   n=6

盘侧枚举 public/ 文件总数=80  扩展名分布={".webp":61,".json":4,".mp3":9,".wav":6}
分目录={"art/buildings":33,"art/events":10,"art/generals":5,"art":4,"art/scatter":8,"art/terrain":5,"audio":15}
引用面不同 URL=76（art 61 / audio 15）
X 交叉核对：bootLoadList.test.ts ① 钉值=63（本探针 art 加载面合计=63）

【反向：盘有引用无】orphans n=4
  ORPHAN art/manifest_portraits_1781872115.json
  ORPHAN art/manifest_portraits_1781872230.json
  ORPHAN art/manifest_portraits_1781872304.json
  ORPHAN art/manifest_portraits_1781872377.json
  在册豁免集 KNOWN_SCATTER_ORPHANS 现值=[] ⇒ 未被豁免的未解释孤儿 n=4

【正向：引用有盘无】dangling n=0 []
【第三轨：ART_MANIFEST.path 有盘无】n=2 ["assets/buildings/bld_hemp_field.webp","assets/buildings/bld_tin_mine.webp"]

判定：存在未解释单边 ⇒ 反向孤儿 4 件（无任何在册豁免集覆盖）
```

**读数自洽核算**（三个独立口径互不派生）：
- 盘 80 ＝ 引用 76 ＋ 孤儿 4 ⇒ 正向 `dangling=0`（76 条引用 URL **全部实存**）。
- art 加载面 63 条 URL → 去重后 61 个不同文件（两型 `NO_OWN_ART` 复用，正是第三轨点名的那 2 条 `path` 轨缺位）⇒ 与 `bootLoadList.test.ts` ① 钉值 **63** 逐位同，复刻未分叉。
- 与 c922-117 的 9/22 读数对平：`81−80＝1`（bush_dry）、`78−76＝2`（同源去重口径差，其"被引用不同 URL=78"含两条复用槽）⇒ **无隐藏新增漂移**，除 bush_dry 外孤儿集成员未变。

**差异清单（完成标准 ③）**：仅 4 条，全部落在 §二-A 的待裁决集内，**没有出现第四类新孤儿**。

---

## 四、脚本落地形态的取证（为什么"必须先拍板"这条前提仍成立）

把上面的读数变成常驻件有两种形状，实测代价不同：

| 形状 | 落地后果（实测依据） | 是否需先拍板 |
|---|---|---|
| **vitest 用例**（盘 → 引用 断言恒 0） | 当天红：`expect(orphans).toEqual([])` 会拿到 §三那 4 条。仓内同型先例 `scatterDiskReconcile.test.ts:36-43` 正是靠 `KNOWN_SCATTER_ORPHANS` 白名单保绿，而该表白名单**清空是人工授权 `2787251` 的结果** | 🔴 **必须先拍板**（豁免集内容＝归属声明） |
| **常驻只读打印器＋`--check` 退出码**（c927-53 同型） | 打印器本身**不会让任何门变红**：`--check` 目前未接进 pre-commit／CI（c927-53 遗留 2 在册）。它会把 §三那句"存在未解释单边 4 件"如实打成 rc=1 | 🟡 技术上可先落，但它与用例形状共用同一个"是否豁免"的判断位；先落＝把裁决口径写进脚本作者手里 |

⇒ 本单按卷宗顺序口径（先材料后脚本）**两种都不落盘**，脚本以草案形态留本档 §五。

---

## 五、脚本草案（**未落盘**；目标落点 `scripts/public-reverse-reconcile.mts`）

- 与 c927-53 的关系：**不重做它的双向对账**（那是键↔加载面），本件补的是**盘↔引用面**这一维（HEAD 上只有 `scatter` 一个子目录有反向哨兵，其余全盲）。
- 只读自证：`node:fs` 只 import `readFileSync`/`readdirSync`/`statSync`，**无** `writeFileSync`/`appendFile`/`mkdirSync`/`copyFile`/`rmSync`/`unlinkSync`，**无 `--write`／`--out` 形态**（对齐 `audit-dead-exports.mjs` 那两个写口的在册坑）。
- ⚠ 落点必须与 `scripts/` 同深度：草案用 `join(dirname(fileURLToPath(import.meta.url)), '..')` 定位仓根，放进 `tmp/`（同为深度 1）可跑，放进 `tmp/<子目录>/` 会错一层。
- 草案本体＝本档所附探针源码原样（本班实跑件 `tmp/c927-70-probe.mts`，gitignored、非产出）。落地时需改的只有两处：
  1. 豁免集从"只读 `KNOWN_SCATTER_ORPHANS`"改为"读一份**人工签字的** `public/` 级豁免表"——表内容未拍板前**不得由脚本作者填**（这是本单卡点）。
  2. `判定` 行的 rc 语义（默认 0／`--check` 才 1）保持不变，避免给未来的门禁留一个"红是脚本作者定的"口子。

---

## 六、卡点（一句话版，交主班/人工）

**卡在这一决定项**：`public/art/manifest_portraits_*.json` 四件的归属出口（甲归档／乙删除／丙登记豁免／丁合并，见 §二-A），其中「案 A」字母与动作的撞名歧义（c924-35 §〇-1）必须先解——它决定脚本豁免表里写不写这四件、以及写的是"已处置"还是"已登记"。锚点里并列的 `bush_dry.webp` **已由 `2787251` 处置完毕**，不再属于待决集。

## 七、本单零改动自证（收口复点）

```
$ git status --porcelain | wc -l   → 开工 15 ／ 收口 **16**（差 1 ＝ 本文档这枚 ??）
$ git diff --cached --numstat      → 0 行（全程未 add 任何件）
```
新增件仅 1 枚：本文档（`?? docs/insights/c927-70-reverse-audit.md`，本班产物，交主班按精确路径代提交）。
四枚禁碰件（`OPTIMIZATION_BACKLOG.md` ` M`／`colony-dead-exports-20260914.json` ` M`／其 `.bak` ` D`／`colony-suite-timings-20260921.json` ` M`）与在册前十枚前手段位**逐条状态字面未变**。
探针 `tmp/c927-70-probe.mts` 在 `.gitignore:25` 区内，不是产出、不进 porcelain；**未删**（它是 §三读数的复算凭据，删除属人工裁决件，沿用 c927-53 遗留 3 同口径）。
未跑全量 vitest、未跑 build、未跑 `audit-dead-exports.mjs` 的任何形态（含无参）。
