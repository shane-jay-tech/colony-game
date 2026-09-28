# c927-77 · `dayClamp.test.ts` 名不副实重命名裁决材料（影响面清单 · 两案 · 推荐不执行）

- 班：`qoder-executor-20260929-0528-colony63`｜模型 qoder｜cwd `D:\code\colony-game`，分支 `codex/architecture-hardening`，HEAD `464a265`
- 上游锚点：`D:\code\zcode-bridge\done\c924-10.result.md` §遗留问题 1（118–119 行）＋ c923-11 §0.1 的"名不副实"登记（正文在 `docs/insights/colony-day-sanitize-census-20260923.md`）
- 定位：**只出材料**。本班**不改名、不改一行生产码／测试码、不跑全量**，推荐一案但不执行。

## 〇、名不副实的此刻实况（本班 05:38–05:42 命令现取，不抄上游）

| 前提 | 实测命令 | 读数 | 判定 |
|---|---|---|---|
| 文件在盘、干净、26 行 | `wc -l src/renderer/state/__tests__/dayClamp.test.ts`＋`git status --porcelain <同路径>` | **26 行**，porcelain **空**（＝跟踪且未改） | 成立 |
| 文件里没有 `dayClamp` 这个字样 | `grep -c "dayClamp" src/renderer/state/__tests__/dayClamp.test.ts` | **0**（rc=1） | 成立 |
| `dayClamp` 符号在 `src` 不存在 | `grep -rn "dayClamp" src` | 排除文件名后**内容面 0 命中**（c924-10 改前那 1 处注释已被替换，债已闭合） | 成立 |
| 它实际测什么 | `Read dayClamp.test.ts:11-25` | `describe('currentDay tick clamp（c919-04 TODO①）')` ＋ 两枚 `it`：① `currentDay=3600` 时 `tickDay()` 后仍 `toBe(3600)`（靠 `inner.state.currentDay` 直改私有态）② 正常局 `0→1→2` 不受影响 ⇒ **2 例** | 成立 |
| 被测对象真身（两处、都无同名符号） | `grep -n "MAX_SAVE_CURRENT_DAY" src/renderer/state/saveLoad.ts`；`grep -rn "MAX_CURRENT_DAY" src` | ① `saveLoad.ts:22 export const MAX_SAVE_CURRENT_DAY = 3600;` ＋ `:451/:455/:458` 范围校验＝**越界 throw 拒载**（不是夹回）；② `gameStore.ts:957 const MAX_CURRENT_DAY = 3600;`（**函数内局部量**）＋ `:958 Math.min(prevDay + 1, MAX_CURRENT_DAY)`＝**就地封顶** | 成立，但**行号已漂** |
| 上游登记的旧行号 | 对比 census 档 §1 | `saveLoad.ts:437-446` → 现 **:451-458**；`gameStore.ts:943-945` → 现 **:953-958**（`:953 tickDay()`） | 🔴 **漂移**（HEAD 自 09-23 前移） |

⇒ 形状定性：不是"测了个不存在的函数"，而是**文件名指向一个从未存在过的符号**（真身是 saveLoad 的拒载闸门＋tickDay 内的局部 `Math.min`），文件内容本身诚实（头注 `:1` 已写"currentDay tick clamp"）。

## 一、影响面清单（**两轨分开数**，本班现取）

### 1a. `.ts` 轨

| 计数口径 | 现值 | 复现命令 |
|---|---|---|
| 跟踪的 `*.test.ts` 全仓 | **161** | `git ls-files \| grep -c '\.test\.ts$'` |
| ├ `src/` | 160 | 同上管道加 `grep -c '^src/'` |
| └ `scripts/` | 1（`scripts/__tests__/auditDeadExportsReadonly.test.ts`） | 同上 |
| 未跟踪的 `*.test.ts` | **1**（`?? src/renderer/ui/__tests__/hudRefreshCost.test.ts`，禁碰） | `git ls-files -o --exclude-standard \| grep -c '\.test\.ts$'` |
| ⇒ 工作树套件文件数 | **162** | 161＋1 |
| 同目录（`src/renderer/state/__tests__`）件数 | **82** | `git ls-files src/renderer/state/__tests__ \| grep -c '\.test\.ts$'` |
| 收集口径会不会因改名漏件 | **不会**（只要新名仍 `*.test.ts` 且留在 `__tests__/`） | `vitest.config.ts:18 include: ['src/**/__tests__/**/*.test.ts','scripts/__tests__/**/*.test.ts']`；`package.json:18 "test": "vitest run"`（**无逐文件名硬编码**），`:19 verify`＝type-check＋test |
| 目录内命名先例（改名候选的落点参考） | `calendar`／`dayPipeline`／`pauseResumeTimeAdvance`／`tickPerf`／`timeSystem` 等**按被测行为命名** | `git ls-files src/renderer/state/__tests__ \| grep -iE "time\|day\|tick\|calendar\|pause"` |

### 1b. `.mjs` 轨

| 计数口径 | 现值 | 复现命令 |
|---|---|---|
| `*.test.mjs` 测试件 | **0**（本仓 vitest 只收 `.ts` 轨） | `git ls-files \| grep -c '\.test\.mjs$'` → 0 |
| 全仓 `.mjs` 文件 | **5**：`scripts/audit-dead-exports.mjs`／`gen-icon.mjs`／`pack-sprites.mjs`／`patch-7za-wrapper.mjs`／`postprocess-ai-png.mjs` | `git ls-files \| grep '\.mjs$'` |
| 其中提到 `dayClamp` 的 | **0 命中** | `git grep -l -i "dayclamp" -- '*.mjs'` → 空（rc=1） |

⇒ **重命名对 `.mjs` 轨零牵动**（既不计数、也不被任何脚本按名引用）。两轨都报，是因为卷宗要求"rg 两轨都要分别数"，实测结论是：只有一轨有东西可动。

### 1c. 文档／台账引用点（`git grep -c -i dayclamp`，共 **6 档 16 处**）

| 档 | 处数 | 是否按**文件名**引用（`dayClamp.test`） | 改名时是否要动 |
|---|---|---|---|
| `docs/insights/c927-66-g1g4.md` | 3 | **是**（:51 点名 2 例、:56「同名 `dayClamp.test.ts` 仍在盘」、:112「建桩范式照 `dayClamp.test.ts`」） | 历史档（纪律：不回改） |
| `docs/insights/colony-day-sanitize-census-20260923.md` | 9 | **是 1 处**（:25），其余 8 处讲的是"符号不存在"这一命题本身 | 历史档（不回改） |
| `docs/insights/colony-fractional-day-sandbox-20260924.md` | 1 | 是（在一条 `npx vitest run …{…,dayClamp,…}…` 命令原文里，:205） | 历史档（不回改）；⚠ 该命令**改名后即失效**（点名件查无） |
| `docs/insights/colony-insights-index-20260919.md` | 1 | 否（叙述"dayClamp 是不存在的名字"） | 不需动 |
| `docs/insights/colony-insights-index-20260927.md` | 1 | 否（同上，两枚索引并存＝既有待人工项） | 不需动 |
| `docs/insights/colony-suite-timings-20260921.json` | 1 | **是**（`files[]` 的 `file` 路径串） | 🔴 **禁碰在途件**（` M`，未归因） |

**台账双报（HEAD 版 vs 工作树版，同一枚 dayClamp 条目）**：

| 版本 | 条目位置 | 读数 | `totals` |
|---|---|---|---|
| `git show HEAD:…colony-suite-timings-20260921.json` | `files[47]`，**:553** | `tests: 2, durationMs: 41, sharePct: 0.03` | `testFiles 131 / tests 1395 / passed 1395 / suitesReportedByVitest 466` |
| 工作树（` M` 在途） | `files[62]`，**:582** | `tests: 2, durationMs: 42, sharePct: 0.03` | `testFiles 157 / tests 1711 / passed 1711 / suitesReportedByVitest 573` |

⇒ 三条由此得出的实况（都是给主班的材料，不是判定）：
1. **用例数不因改名而变**（两版都是 2 例）；改名改的是**路径串**，且串所在那枚 json 是禁碰件 ⇒ 案 A 的"同步引用点"与"禁碰令"正面相撞。
2. 台账**自身已过期**：HEAD 131／工作树 157，而今日跟踪面 `*.test.ts` 实测 **161**（未跟踪 1 枚 ⇒ 162）⇒ "重命名会牵动套件计数"这句更准的形状是：**套件计数早就和台账不一致**，改名不是原因、也不修它。
3. c924-10 的锚点里"牵动 `docs/insights/colony-test-asset-map-20260921.md` 的映射"这一条**被本班否证**：该档 108 行，`grep -n "dayClamp\|tickDay\|clamp"` → **0 命中**；它的 §四 Top 件／§五 零测清单判据是"**生产模块 basename 是否出现在任一 `.test.ts` 的 import 末段**"（该档 :17 自述），测试件自己的名字不进判据；且 dayClamp 2 例／41 ms 进不了任何 Top。⇒ **映射档不需同步**，真正需要同步的只有上表 3 处文件名引用＋台账 1 处。

## 二、两案材料（并列，不落地）

| 维度 | **案 A：重命名＋同步引用点** | **案 B：维持文件名＋头注** |
|---|---|---|
| 动作集 | ① 一次 `git mv`（建议落目录内既有命名族，如按被测行为命名——同目录先例见 1a 末行；具体新名**归人工定**，本班不代提名）② 同步 3 处文件名引用（c927-66/census/fractional-sandbox 各 1+ 处）③ 台账 `files[]` 路径串 1 处 ④ 若想让历史命令原文复算，`colony-fractional-day-sandbox-20260924.md:205` 那条 vitest 命令要重取 | ① 在 `dayClamp.test.ts:1` 追加 1 行头注，写明"clamp 无同名符号；真身＝`saveLoad.ts:22`＋`:451-458` 拒载 与 `gameStore.ts:957-958` 局部 `Math.min`" |
| 写的对象 | **`src/**` 改名（git 写）＋ 4 枚 docs 历史档 ＋ 🔴 1 枚禁碰在途件** | 仅 1 枚 `src/**` 测试件的**注释 1 行** |
| 套件计数影响 | 文件数不变（161/162）；`vitest.config.ts:18` glob 仍收（新名保持 `*.test.ts` 即可）；`.mjs` 轨 0 牵动 | 无（0 例增删，0 件增删） |
| 测试红风险 | 定向面：改名后任何按旧名点名的 `npx vitest run …dayClamp.test.ts` 命令**当场查无文件**；历史命令原文全部失效（至少 1 处） | 注释不进判据 ⇒ 无红（vitest 不解析注释文本） |
| 纪律冲突面 | 🔴 两处：①必写未归因在途件 `colony-suite-timings-20260921.json`；②要回改 4 枚历史档（纪律：历史档不回改，只留指针） | 无（只动本班被点名的测试文件自身，1 行注释） |
| 存档／经济／统计风险 | 无（测试件不参与运行时） | 无 |
| 收益 | `rg -i dayClamp` 盘上从"6 档 16 处含一个假符号名"收敛到纯历史叙述；新人不再误以为有 `dayClamp()` 可 import | 假符号名仍在文件名上，但**文件内已自证**（`:1` 现文已是"currentDay tick clamp"），头注补齐真身两址后 `rg` 一次即得全貌 |
| 成本量级 | 1 git 改名＋4 档同步＋1 枚禁碰件（＝当前**不可做**） | 1 行注释 |

## 三、推荐（**只推荐，不执行**）

**推荐案 B（维持文件名＋头注）**，三条理由：

1. **案 A 今天做不到干净**：它必写 `colony-suite-timings-20260921.json`——本仓四枚未归因在途件之一（` M`，`git diff --numstat HEAD` 现测 **1147 加／1052 减**），且该档 `ledgerMaintenanceNote` 自己规定（逐字）："本台账只由「刷新单」维护，不随功能单顺手改；每次刷新必须用同一条 command、同一次 run 的读数整体重生成，不得手填单个文件耗时"⇒ 单点改路径串违反台账自身口径，正确做法是**整册重生成**，那是刷新单的活。
2. **案 A 的收益已被 c924-10 拿走大半**：内容面 `dayClamp` 命中现为 **0**，"有人以为存在 `dayClamp()` 符号"的误导链最后一环（注释）已闭合；剩下的只是**文件名**这一层，用 1 行头注即可自证。
3. **成本不对称**：1 行注释 vs 1 次 git 改名＋4 档历史同步＋1 枚禁碰件冲突。

**若人工仍选案 A，前置条件三项**（缺一即会半途变脏）：① `colony-suite-timings-20260921.json` 在途改动**归因闭合**并由刷新单整册重生成（新名与新计数同笔）；② 改名与"引用点同步"**同一笔提交**（否则 `npx vitest run <旧名>` 在 HEAD 上查无＝红）；③ 4 枚历史档按纪律**不回改**，改为在其中最新一枚（`c927-66-g1g4.md` 或新档）留一行指针登记旧名→新名，避免历史命令原文被当成可复算。

## 四、红线与自检

- 本班**未改名、未写 `src/**`、未写台账、未跑全量 vitest／build／type-check**；本单唯一盘上新增产物＝本文件。
- 未碰四枚未归因在途件、前手 9 枚 `?? docs/insights/c927-*.md`、`?? scripts/clean-install-verify.ps1`、`?? src/renderer/ui/__tests__/hudRefreshCost.test.ts`；`git status --porcelain` 收工＝开工 15 行＋本单新增 `??` 档（外加同班 c927-73／c927-76 的两枚 `??` 材料档）。
- 经济平衡数值／存档兼容／统计结论：本单**零涉及**（`3600`／`41 ms` 等只作读数，不评好坏、不提改值建议）。
- 引台账类读数已**双报 HEAD 版与工作树版**（§一 1c 表）。
