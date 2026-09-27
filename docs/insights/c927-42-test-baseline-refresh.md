# c927-42 — colony 测试基线刷新（对 `colony-suite-timings-20260921.json` 台账取漂移）

- 出班：`qoder-executor-20260927-2224-colony48`（分支 `codex/architecture-hardening`，开工 HEAD `b23ef89`）
- 时刻：起跑 **2026-09-27T22:19:33+0800**、收跑 **2026-09-27T22:20:54+0800**（本机 `date` 实取，全量套件**只跑了这一次**）
- 产物性质：只读采集 ＋ 本档；**零代码改动**（复核见 §5）

## 1. 一句话结论

**用例面零漂移（157 文件 / 1711 例 / 100% 绿，与台账逐文件例数完全一致、双向差集皆空），耗时面整体 ×2.2；台账 `colony-suite-timings-20260921.json` 跑前跑后 sha1 同值 ⇒ 「跑全量套件会自写这枚 json」这条环境断言被本次实测否证，可以钉死。**

## 2. 现值（实跑读数）

```
 Test Files  157 passed (157)
      Tests  1711 passed (1711)
  Duration  76.09s (transform 17.34s, setup 55ms, collect 127.38s, tests 275.41s, environment 148ms, prepare 101.59s)
EXIT=0
```

- 通过率 **1711/1711 ＝ 100%**；失败 0、pending 0、todo 0；`numTotalTestSuites 573`（＝台账 573，未变）。
- 命令（与台账 `command` 字段同一条形状，保证可比）：
  `npx vitest run --reporter=json --outputFile=tmp/qoder-executor-20260927-2224-colony48/vitest.json --reporter=default`
- 墙钟：命令发起到收 81 s；vitest 自报 Duration 76.09 s；台账 `loadNote.wallClockSec` 36 s。

## 3. 漂移表

### 3.1 三档时间线（引数请带 commit，别只带数字）

| 载体 | 时刻 | HEAD | 文件 | 用例 | 绿 | 套件墙钟 | 备注 |
|---|---|---|---|---|---|---|---|
| `colony-test-baseline-20260921.md` 追记 3 | 9-22 03:40 | `3144c15` | 126 | 1337 | 100% | 21.74 s | **md 基线档本身已过期两档**，不再是现行台账 |
| `colony-suite-timings-20260921.json`（台账） | 9-25 21:58 | `17b8498` | 157 | 1711 | 100% | 36 s | 无并发窗，`producedBy c924-12` |
| **本次实测** | 9-27 22:20 | `b23ef89` | **157** | **1711** | **100%** | **76.09 s** | 台账 HEAD 之后隔 **18 枚提交**，其中仅 6 枚文件在 `src/` |

⇒ 台账与本次**同一集**：`in_run_not_in_ledger = 0`、`in_ledger_not_in_run = 0`、逐文件 `tests` 差值 **0 处**（157 枚全等）。**新增红名：无**（failed 文件 0 枚）。

### 3.2 耗时漂移（台账 `files[].durationMs` ↔ 本次同字段，口径＝该文件 endTime−startTime 的并跑墙钟）

| # | 文件 | 台账 ms | 本次 ms | Δ | 倍 |
|---|---|---|---|---|---|
| 1 | `src/renderer/state/__tests__/fullLifecycleLayerTriage.test.ts` | 33,063 | 66,657 | +33,594 | 2.02× |
| 2 | `scripts/__tests__/auditDeadExportsReadonly.test.ts` | 18,828 | 43,320 | +24,492 | 2.30× |
| 3 | `src/renderer/state/__tests__/sandboxSimulation.test.ts` | 16,775 | 40,149 | +23,374 | 2.39× |
| 4 | `src/renderer/state/__tests__/replaySnapshotContent.test.ts` | 14,907 | 35,022 | +20,115 | 2.35× |
| 5 | `src/renderer/state/__tests__/sandboxSnapshot.test.ts` | 18,961 | 32,350 | +13,389 | 1.71× |
| 6 | `src/renderer/state/__tests__/seedSnapshotDeterminism.test.ts` | 5,635 | 14,698 | +9,063 | 2.61× |
| 7 | `src/renderer/scenes/__tests__/UIScene.test.ts` | 1,766 | 5,769 | +4,003 | 3.27× |
| 8 | `src/renderer/scenes/__tests__/UISceneEventSet.test.ts` | 1,721 | 5,562 | +3,841 | 3.23× |
| 9 | `src/renderer/state/__tests__/eventOrderingSnapshot.test.ts` | 950 | 3,203 | +2,253 | 3.37× |
| 10 | `src/renderer/state/__tests__/gameStore.test.ts` | 931 | 2,855 | +1,924 | 3.07× |

聚合项：

| 项 | 台账 | 本次 | 漂移 |
|---|---|---|---|
| `sumFileWallClockMs` | 122,108 | **274,647** | **+125%** |
| 套件墙钟 | 36 s（`loadNote`） | 76.09 s（自报）/ 81 s（起收差） | +111% |
| 并行比（sum ÷ 墙钟） | 3.39 | 3.61 | ≈ 持平 ⇒ **不是 worker 数变了** |
| top3 占比 | 58.0% | 54.7% | −3.3pt（慢件彼此同倍率放大，排序未失真） |
| `<100ms` 文件数 | 123 / 157 | **91 / 157** | −32 枚（轻量件被整体抬过 100 ms 线） |
| 慢件名单（top10 成员） | 同 10 枚 | 同 10 枚 | **成员零变化**，仅 2/3/5 名互换（`auditDeadExports` 3→2、`sandboxSimulation` 4→3、`sandboxSnapshot` 2→5） |
| 越线漂移（Δ≥3 s 或 ≥2×） | — | 15 枚 | top10 ＋ `pauseResumeTimeAdvance` +925 ms、`starvationSequenceSaveUi` +821、`keyboardFlowFocusOrder` +807、`economyBalance` +685、`PolicyTreePanel` +569 |
| 分目录 | state 95,902／scripts 18,828／scenes 4,405／ui 2,025／render 582／data 364／shared 2 | state 208,496／scripts 43,320／scenes 14,167／ui 6,020／render 1,456／data 1,181／shared 7 | **七个目录全部 2.0~3.3×**，无单目录异常突出 |

### 3.3 漂移归因（如实：判不满，两条并存）

- **反对「代码回归」解释**：`17b8498..b23ef89` 18 枚提交里只有 6 枚文件落在 `src/`（`keyboardFlowFocusOrder.test.ts` ＋281 行＝台账生成时的那枚未跟踪件，已计入台账；`saveLoad.ts` +14；`rateDisplayBoundary`/`replaySnapshotContent`/`saveGuard`/`saveGuard2` 小改）。**逐文件例数与套件总数一字未变**，且放大是**七目录齐涨、并行比不变**——单点性能回归不会长这样。
- **支持「并发/机器污染」解释**：台账自己的 `loadNote.caveat` 写着「durations 只在无并发窗才是干净墙钟，跨次比较只比 totals 与 top 序」；`slowTailNote` 更记着同型前例——`auditDeadExportsReadonly` 在并发窗 94.7 s、无并发窗 18.8 s（**5× 差**）。本次该枚 18.8→43.3 s（2.3×），与「被并发污染」的指纹一致。开窗期同秒还有兄弟班 `qoder-executor-20260927-2224-kaoyan89` 于 22:18 claim `k927-45`，收跑后 22:21 实测本机空闲内存 **2.25 GB / 15.73 GB（≈86% 已用）**，与台账那次的 85% 同级但**并发窗条件不满足台账口径**。
- ⇒ **本档的 durations 只能当「并发窗样本」用，不得据此重钉台账**。totals／top 成员／例数三项是本次可外推的硬读数。**只跑了一次（纪律要求），没有第二样本可切分这两种解释**——要钉死耗时漂移，需主班择无并发窗复跑一次再对表。

## 4. 慢件 top10（本次实测榜，含 timeout 形状）

| 名次 | 文件 | 本次 ms | 例数 | 占比 | 单例最长 ms | 该文件有无显式 timeout |
|---|---|---|---|---|---|---|
| 1 | `fullLifecycleLayerTriage.test.ts` | 66,657 | 10 | 24.27% | **25,921** | **无** |
| 2 | `auditDeadExportsReadonly.test.ts`（scripts 侧） | 43,320 | 1 | 15.77% | **43,320** | **无**（整枚套件只有 1 例） |
| 3 | `sandboxSimulation.test.ts` | 40,149 | 2 | 14.62% | 22,196 | 有 `120000`（:264 :282） |
| 4 | `replaySnapshotContent.test.ts` | 35,022 | 27 | 12.75% | **10,742** | **无** |
| 5 | `sandboxSnapshot.test.ts` | 32,350 | 3 | 11.78% | 15,071 | 有 `120000`（:31） |
| 6 | `seedSnapshotDeterminism.test.ts` | 14,698 | 9 | 5.35% | 3,230 | 无（未越默认闸） |
| 7 | `UIScene.test.ts` | 5,769 | 4 | 2.10% | 1,776 | 无 |
| 8 | `UISceneEventSet.test.ts` | 5,562 | 4 | 2.03% | 1,653 | 无 |
| 9 | `eventOrderingSnapshot.test.ts` | 3,203 | 14 | 1.17% | 1,783 | 无 |
| 10 | `gameStore.test.ts` | 2,855 | 106 | 1.04% | 133 | 无 |

top5 合占 **79.2%**；`<100 ms` 的轻量件 91 枚。

### 4.1 timeout 形状（给后续性能判据用，别再说「默认 5 s 会兜住」）

- `vitest.config.ts` 的 `test` 块只有 `environment` ＋ `include` 两项，**没有 `testTimeout`**；vitest 1.6.1 默认值实测在 `node_modules/vitest/dist/config.js`：`testTimeout: 5e3`、`hookTimeout: 1e4`。
- ⚠ **但这条默认闸在 colony 现状下对最慢的几枚根本不 binding**：单例实测 43,320 / 25,921 / 22,196 / 15,071 / 10,742 ms 全部是 5e3 的 2~8.7 倍，套件仍 rc=0 全绿。机制上有两条支撑：`auditDeadExportsReadonly.test.ts:16` 用 `execSync('node scripts/audit-dead-exports.mjs', …)` **同步阻塞** worker 事件循环，定时器无从触发；`fullLifecycleLayerTriage`／`replaySnapshotContent` 的 `it(..., async () => …)` 体内是同步重算，await 点不让出到定时器。**"绿"不等于"被 5 s 闸约束过"**。
- 全仓带显式 `}, <ms>)` 第三参的测试件**只有 3 枚**：`sandboxSimulation`、`sandboxSnapshot`、`storyPlaythrough`。
- **在册唯一的性能闸 `tickPerf.test.ts:35` 现值复点**：`expect(elapsedMs).toBeLessThan(30_000)` 本次实测 **550 ms**（台账 217 ms，2.53×，与全局漂移同倍率，余量仍 54×）；且 `:14` 的 `it(..., () => {…})` 是**同步体 300 次 tick 循环** ⇒ 这条 30 s 判据在超时维度上是**双保险失效**形状：撞不到 5 s 默认闸（定时器饿死），也远够不到 30 s 断言。它是现有形状里唯一"判据本身即兜底"的活例。
- ⇒ **提任何性能判据的最低形状要求**：① `expect(elapsedMs).toBeLessThan(X)` 必须与**同文件显式第三参 `X + 余量`** 配对（否则判据红之前先撞默认 5 s、错误信息会把「超时」冒充成「性能不达标」，归因不可分）；② 若被测体是同步重算，显式 timeout 也拦不住它，判据只能靠 `toBeLessThan` 自身；③ 阈值给**本次实测单例值 ×3** 起评（例：拟给 `fullLifecycleLayerTriage` 设闸→ ≥78 s，而非照抄 30 s 那种「按台账旧值设」的数）。参考在册旁证 `tickPerf.test.ts:35` 的 30_000 闸（基线 217 ms，余量 138×）。

## 5. 零改动 ＋ json 是否被自写（本单的钉死项）

| 时点 | `git status --porcelain` | `colony-suite-timings-20260921.json` |
|---|---|---|
| 跑前 22:19:33 | 4 行：` M docs/design/OPTIMIZATION_BACKLOG.md`／` M docs/insights/colony-dead-exports-20260914.json`／` D docs/insights/colony-dead-exports-20260914.json.bak`／` M docs/insights/colony-suite-timings-20260921.json` | size **29,156 B**、sha1 **`12ea4d46cc12a50228309a0682aef1af3458f87c`**、mtime `2026-09-25 22:00:58.055` |
| 跑后 22:20:54 复点 | **同 4 行，逐字符相同**（`diff` 空输出） | size **29,156 B**、sha1 **`12ea4d46cc12a50228309a0682aef1af3458f87c`**、mtime `2026-09-25 22:00:58.055`（**未变**） |

另外两枚在册脏件同时点 sha1 也未变：`colony-dead-exports-20260914.json` `8ea50733dfb9343285c906909d3b6ddead8c622c`、`OPTIMIZATION_BACKLOG.md` `eaf4dbf853651584545004d1ffcebf72c2dae664`。

**结论（钉死）**：
1. **跑一次全量套件不会改动这枚 tracked json** —— 前后两个数就是同一个数（size 29,156、sha1 `12ea4d46…f87c`），**因此没有需要写清前后差异的差值，也不存在回滚动作**；四枚他班在途脏件本班一律未碰、未「顺手恢复」。
2. 机理复证（不依赖他人结论）：`npm test` ＝ 裸 `vitest run`；`vitest.config.ts` 20 行里没有 `reporters`／`outputFile`／`setupFiles`；`.git/hooks/pre-commit` 只有 `type-check` ＋ `npm run --silent test` 两步；`grep -rln "suite-timings" scripts/ .git/hooks/ vitest.config.ts` **零命中**（无生成器在册）。⇒ 这枚 json 只由「刷新基线」类单**手工整体重生成**（本次也确是按 §2 命令＋人工换算落盘）。
3. ⇒ 任何以「跑套件会自写生产 json」为由暂缓基线刷新的说法，**本次实测否证**（与 c927-41 的仓内复证同向）。
4. **本班零代码改动**：`git status --porcelain -- src scripts vitest.config.ts package.json` ＝ **0 行**；新增文件只有本档与 gitignore 的 `tmp/`（`.gitignore:25`，实测 `git check-ignore -v` rc=0）。**未改任何测试判据、未用 `--no-verify`、未做任何 git 写操作。**

## 6. 复取命令（复制即用）

```bash
cd /d/code/colony-game
T=tmp/qoder-executor-20260927-2224-colony48 && mkdir -p $T
git status --porcelain | tee $T/porcelain-before.txt
sha1sum docs/insights/colony-suite-timings-20260921.json | tee $T/sha1-before.txt
date +%FT%T%z                                   # 起跑时刻
npx vitest run --reporter=json --outputFile=$T/vitest.json --reporter=default > $T/vitest.log 2>&1
echo "EXIT=$?"; date +%FT%T%z                   # 收跑时刻
git status --porcelain | diff $T/porcelain-before.txt - && echo "porcelain 未变"
sha1sum docs/insights/colony-suite-timings-20260921.json | diff $T/sha1-before.txt - && echo "json 未变"
# 台账 ↔ 本次 漂移换算见 $T/analyze.py（逐文件 durationMs／tests、set diff、top10、分目录）
```

## 7. 交回主班的三件事（本班不 self-apply）

1. **台账要不要按本次重钉**：⚠ 建议**不要**——本次是并发窗样本，durations 系统性 ×2.2，直接重生成会把慢尾读数污染成「整改失效」。要钉请等无并发窗复跑。
2. **pre-commit 门禁成本已越 40–60 s 档**：套件 76 s ＋ type-check ⇒ 提交等待实测上一档到 **约 80–120 s**。属环境读数，改判据需人工放行。
3. **`auditDeadExportsReadonly.test.ts` 一枚吃掉 15.8%（43 s）且只有 1 例**，其唯一动作是 `execSync` 复跑 `scripts/audit-dead-exports.mjs` 再比 mtime。它是台账在册的「重复读盘」慢尾诊断对象（c924-11）。真要削慢尾，这枚与 `fullLifecycleLayerTriage`（66.7 s）是唯二值得动的靶子——**均属改测试判据域，本班未动一字**。
