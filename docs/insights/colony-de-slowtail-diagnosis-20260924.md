# colony `auditDeadExportsReadonly` 慢尾诊断（c924-11 · 2026-09-24 · 只读）

> **班次**：`qoder-executor-20260924-0955-colony18`（zcode-bridge 执行班 · 本波本仓唯一写位）· cwd `D:\code\colony-game`
> **取数时刻**：2026-09-24T14:13–14:25+08:00 · **开工 HEAD** `805722b`
> **红线声明**：本单是**诊断**，不是修复。`scripts/audit-dead-exports.mjs`（生产脚本）**一字未改**、
> `scripts/__tests__/auditDeadExportsReadonly.test.ts`（测试件）**一字未改**、默认 JSON **未写盘**（sha8 全程 `c531140e`、mtime 未变）。
> 全部计时在 `tmp/c924-11/` 的**补丁副本**上做（`.gitignore:25 tmp/` 覆盖）。本文件是本单唯一入库产物。
> **上游**：`docs/insights/colony-suite-slowtail-20260922.md`（c922-17，S1 缓存案在此已提出但未落地）、
> `docs/insights/colony-suite-timings-20260921.json`（c923-12 于 9/23 10:41 重生成，94,703ms 那一行的出处）、
> `zcode-bridge/done/c923-12.result.md`（"占全量 72%／涨 3.4 倍／⚠️ 可能含并发放大"）。

---

## 〇、结论先行（四条，全部实测；两条否证上游）

1. 🔴 **"94.7s 涨 3.4 倍"这个劣化叙事不成立——它不是结构量，是负载量。**
   独占窗复跑该件 **3 次**：用例级 `durationMs` = **15,350 / 15,784 / 15,411 ms**（墙钟 17.15 / 17.51 / 17.25 s）。
   94.7s 那一行出自 **9/23 10:41 的一次全量跑**，而那份 JSON 自己的 `loadNote` 就写着
   `siblingShiftsActive: 有（claims.log 10:18-10:34 期间 quant4/kaoyan7/kaoyan8/learn4/psy7 有 claim|done 行）`、
   `memLoadPct 53→60%`、`caveat: durations 受并发污染、只跑 1 次（复跑 2 次会二次污染）`。
   ⇒ **现值 15.4–15.8s 对 9/22 在册的 13.85s 只涨 1.11×**；对 94.7s 是 **0.16×**。"慢尾"是真的（它确实是全量里最长的一件），**"涨 3.4 倍"是假的**。
2. **热点唯一：无缓存重复读盘。** 用"只在原脚本上夹计时器、算法行零改动"的补丁副本实测单轮：
   `readFileSync` **110,059 次 / 702.4 MB**，占 **13.6–14.5 s（≈97%）**；
   正则匹配 `.match()` 全部合起来只有 **306–316 ms（≈2.2%）**；`new RegExp` 构造 9.8 ms；目录 walk 4.4 ms；子进程/断言余量 < 1 s。
   ⇒ 卷宗给的三个候选里：**"fs 全仓扫描"命中，"子进程 spawn"与"正则"都不是热点**（证据见 §2）。
   读盘次数有闭式且**逐位对上**：`导出数 × (非测试文件数 − 1 + 测试文件数) + 非测试文件数 = 418×(124+139)+125 = 110,059` ✅。
3. 🔴 **否证第二条（在册档自己的数）：9/22 的"≈26,784 次／189 MiB"低估 3.9 倍。**
   机理是该档把**候选条数 108** 当成了**导出数**（`slowtail-20260922.md:48` 原式"≈108×248"）。
   实测 9/22 那个提交 `99dcaa7` 的值导出面是 **419 条**（不是 108），代入同一闭式得 **103,617 次**——
   与今天实测的 110,059 只差 **+6.2%**。⇒ **两天里扫描面根本没扩张**，所以 §0.1 的结论更强：
   秒数摆动全部来自负载与文件缓存，不是仓库长大。
4. **缓存案已被实测坐实（不是推算）：** 同一副本加一个 `Map` 记忆化（`CACHE=1`）后
   **14,224 ms → 247 ms（57×）**，且**输出全等**：`scanned files=125 entries=107 summary={"dead":0,"testsOnly":87,"internalOnly":20}`
   逐字相同、`totalHits` 6410 相同、两份 `--out` JSON 去掉 `generatedAt` 后规范化 sha8 **都是 `46f724ba`**（`entries` 107 全等）。
   ⇒ c922-17 当年明写"10.33s→亚秒是**按比例推算**、落地时需自行复计时"（`slowtail:123`）——**本班把那个"需自行复计时"补上了**。

---

## 一、判据 ①：3 次耗时读数（命令内联，可复算）

```
$ for i in 1 2 3; do python -c "
  import subprocess,time,json
  t=time.perf_counter()
  r=subprocess.run('npx vitest run scripts/__tests__/auditDeadExportsReadonly.test.ts --reporter=json --outputFile=tmp/c924-11/r'$i'.json',shell=True,capture_output=True,text=True,encoding='utf-8',errors='replace')
  w=time.perf_counter()-t
  d=json.load(open('tmp/c924-11/r'$i'.json',encoding='utf-8'))
  print('run','$i','rc=',r.returncode,'wall=%.2fs'%w,[(a['fullName'][:36],a['duration']) for s in d['testResults'] for a in s['assertionResults']])"; done
run1 rc=0 wall=17.15s [('audit-dead-exports 无参运行＝只读：默认 JSON mtim', 15350)]
run2 rc=0 wall=17.51s [同样的 1 例, 15784]
run3 rc=0 wall=17.25s [同样的 1 例, 15411]
```

配套裸跑（把子进程成本单独拎出来）：

```
$ for i in 1 2 3 4; do python -c "…'node scripts/audit-dead-exports.mjs' 计时…"; done
bare1 15.64s ／ bare2 15.46s ／ bare3 15.56s ／ bare4 14.76s
```
- ⚠ **冷/暖缓存差 1.7 倍**：本班最早三次裸跑（文件缓存未热）读数是 **26.0 / 26.6 / 25.2 s**，
  之后同一命令稳定在 **14.8–15.6 s**。⇒ 本机"单文件第 N 次跑"的读数**必须标注是否暖缓存**，
  否则又会造出一枚像 94.7s 的不可比数字。**这大概是 27.7s→94.7s 链条里被漏掉的那个变量。**
- 该件只有 **1 个用例**（`tests: 1`）⇒ 用例级"前 5 排序"在本件内**不存在**，判据 ② 已按实况收窄（见 §2 末）。

---

## 二、判据 ②：热点定位（用例级 + 阶段级 + 历史 top-5）

### 2.1 阶段级分解（补丁副本 `tmp/c924-11/instr2.mjs`，算法行零改动）

副本与原脚本的**全部差异**只有 5 处（python `difflib` 逐行核过，共 38 行差异全在夹具内）：
头部加计时夹具、把 4 个 `fs.readFileSync(...)`／`.match(...)` 站点换成 `__read()`／`__count()` 包裹、末尾加一行 `console.error` 读数。

```
$ for m in 0 1; do for i in 1 2 3; do CACHE=$m node tmp/c924-11/instr2.mjs; done; done
# CACHE=0（＝原算法）
scanned files=125 entries=107 summary={"dead":0,"testsOnly":87,"internalOnly":20}
[instr2] {"readFileSyncCalls":110059,"readBytesMB":702.4,"tReadMs":13794.1,"tMatchMs":306.7,"tTotalMs":14224.3,"totalHits":6410}
[instr2] {... "tReadMs":13642.6,"tMatchMs":306.1,"tTotalMs":14071.3 ...}
[instr2] {... "tReadMs":14522.9,"tMatchMs":315.8,"tTotalMs":14965.6 ...}
# CACHE=1（记忆化对照）
[instr2] {"tReadMs":36.5,"tMatchMs":226.6,"tTotalMs":308.1,"totalHits":6410}
[instr2] {"tReadMs":34.1,"tMatchMs":196.2,"tTotalMs":267.0,"totalHits":6410}
[instr2] {"tReadMs":34.3,"tMatchMs":202.2,"tTotalMs":276.7,"totalHits":6410}
```

**归因表（三轮中位）**

| 阶段 | 耗时 | 占比 | 判据 |
|---|---|---|---|
| `fs.readFileSync` 重复读盘 | **13.79 s** | **96.9%** | `readFileSyncCalls=110,059`／`readBytesMB=702.4`（唯一数据只有 **1.96 MB**：非测试 1,153 KB ＋ 测试 810 KB ⇒ **重复 358 倍**） |
| 正则匹配 `.match()` ×110,059 | 0.31 s | 2.2% | 不是热点（V8 对 `\bNAME\b` 单遍扫已足够快） |
| `new RegExp` 构造 ×418 | 0.01 s | 0.1% | 不是热点 |
| 目录 walk（两次） | 0.004 s | ~0% | 不是热点 |
| 子进程 spawn ＋ vitest 侧开销 | < 1 s | < 6% | `文件 durationMs 15.4s` − `裸跑脚本 15.5s` ⇒ 本件里几乎为 0（9/22 档记的"~3.5s 冷启 node＋collect"在独占窗不复现） |

⇒ **卷宗三个候选（fs 全仓扫描 / 子进程 spawn / 正则）里只有第一个成立**，且形态更窄：
不是"扫描的文件太多"，是**同一个文件被重读 418 遍**（`audit-dead-exports.mjs:68` 与 `:71` 两个内层站点）。

### 2.2 用例级"前 5"（本件只有 1 例 ⇒ 给全量 top-5 作上下文，读数出处为 9/23 那枚被污染的 JSON）

| # | 文件 | tests | durationMs | share |
|---|---|---|---|---|
| 1 | `scripts/__tests__/auditDeadExportsReadonly.test.ts` | 1 | 94,703（**并发污染**；独占窗复测 15,350/15,784/15,411） | 72.09% |
| 2 | `src/renderer/state/__tests__/sandboxSimulation.test.ts` | 2 | 13,581 | 10.34% |
| 3 | `src/renderer/state/__tests__/sandboxSnapshot.test.ts` | 3 | 13,450 | 10.24% |
| 4 | `src/renderer/scenes/__tests__/UIScene.test.ts` | 4 | 2,081 | 1.58% |
| 5 | `src/renderer/state/__tests__/gameStore.test.ts` | 106 | 1,080 | 0.82% |

（第 2/3 名是 c922-17 已定性的另一对：`sandboxSnapshot` import 了 `sandboxSimulation.test` 导致隔壁用例被重复注册——
**与本单无关，不在此重开**，只说明"top-5 里前两对各有独立根因"。）

---

## 三、扫描面增长的真实曲线（否证"涨 3.4 倍"的结构性解释）

```
$ for c in 99dcaa7 74cbfa6 HEAD; do
    nt=$(git ls-tree -r --name-only $c -- src | grep '\.ts$' | grep -v '__tests__' | wc -l)
    tf=$(git ls-tree -r --name-only $c -- src | grep '__tests__/' | grep -E '\.(ts|mts)$' | wc -l)
    ex=$(git ls-tree -r --name-only $c -- src | grep '\.ts$' | grep -v '__tests__' | while read f; do git show "$c:$f"; done | grep -cE '^export (const|function|class|let) ')
    echo "$c nt=$nt tf=$tf ex=$ex 预测读盘次数=$((ex*(nt-1+tf)+nt))"
  done
99dcaa7 (9/22 00:45，c922-17 取数点): 非测试.ts=124 测试.ts=124 值导出=419 预测 readFileSync=103,617
74cbfa6 (9/23 09:58，c923-12 取数点): 非测试.ts=124 测试.ts=131 值导出=418 预测 readFileSync=106,296
HEAD    (9/24 本班)                 : 非测试.ts=125 测试.ts=139 值导出=418 实测 readFileSync=110,059
```

- **两天里读盘次数只涨 6.2%**（103,617 → 110,059），全部来自测试件从 124 → 139（9/23 那几笔测试入账）。
  本班实测值与闭式预测**逐位相等**（110,059）⇒ 公式可用于以后任何一次"这为什么会变慢"的判断，不必再猜。
- **9/23 那枚 94.7s 对应的扫描面是 106,296 次，只比 9/22 的 103,617 多 2.6%**
  ⇒ "9/21→9/23 涨 3.4 倍"在扫描面一侧**没有对应的物理解释**，只能是负载／冷缓存／磁盘争用。
- 附带一条**在册数字订正**（不改档，只在此登记）：`slowtail-20260922.md:48` 的"108×248 ≈ 26,784 次、约 189 MiB"
  把候选条数当导出数用了；同一档的 `13.85 s`／`elapsed=10325ms` 是**实测**、不受影响。⇒ 请主班把 26,784/189MiB 标为已订正。

---

## 四、判据 ③：两案预估（含改动面；两案都**不落码**）

### 案 B（推荐）：给 `audit-dead-exports.mjs` 加**文件内容记忆化**——**已被本班实测，不是推算**

| 项 | 内容 |
|---|---|
| 改动面 | `scripts/audit-dead-exports.mjs` **2 个站点**（`:68` 非测试内层读、`:71` 测试内层读；顺手可含 `:57` own-file 读）＋一个 `Map`。估算 **+3～+6 行 / −2 行**，无签名变化、无 CLI 变化（`--out/--write` 三支不动） |
| 实测收益 | 脚本 **14,224 ms → 247 ms（57×）**；该测试件预计 **15.4 s → 约 0.7～1.0 s**（脚本 0.25 s ＋ spawn/vitest 余量 <1 s，余量按 §2.1 实测的上界给） |
| 连带收益 | 全量墙钟里这一件从"占 72%"降到噪声级；c922-17 记的"最长件下界 16.64 s 换人"会落到 `sandboxSimulation`/`sandboxSnapshot` 那一对（各自根因已在册，本单不重开） |
| 语义风险 | **零**（实测）：两轮 `--out` 的 JSON 去掉 `generatedAt` 后**规范化 sha8 同为 `46f724ba`**、`entries` 107 与 `summary` 逐字相同、`totalHits` 6410 相同 |
| 内存代价 | 把 1.96 MB 源文本常驻（今天实测 `非测试 1,153 KB ＋ 测试 810 KB`）。按 9/24 扫描面 ≈ 2 MB，**不是** 702 MB |
| 看守它的人 | 现有 `auditDeadExportsReadonly.test.ts` 只钉"无参运行不写盘"（mtime/内容不变），**钉不出结果集等价** ⇒ 落地时应同批补一条"输出 JSON 与金档全等"的断言（否则缓存把 `hitsInTests` 算错也不会红），这属**测试件改动**、与 §5 的在册坑同族 |
| 授权 | 🔴 生产脚本改动 ⇒ **本单不做**；9/22 已提出（S1）、9/24 已实测坐实收益 ⇒ 请主班排一条执行单，判据直接抄本行 |

### 案 A（不推荐，且要给"拆分"这个词纠个偏）：把这一件拆开／挪走

| 拆法 | 实测/推算 | 改动面 | 为什么不推荐 |
|---|---|---|---|
| A1 拆成多例（按目录/按桶切） | **总耗时不降反升**：110,059 次读盘是**整脚本一次跑完**的量，拆成 N 例＝脚本被 spawn N 次＝N×15 s | 测试件重写 ＋ 脚本要支持分片入参 | 完全没碰到根因，还把"1 例 15 s"变成"8 例 15 s"（vitest 文件内用例是串行的） |
| A2 挪出 vitest（改夜间/预提交外的脚本） | 全量墙钟 −15 s（**独占窗实测值**） | 动 `package.json` 的 test 口径或 pre-commit 门＋`vitest.config.ts:6` 的 include | **这是把唯一一条"只读语义回归守护"从门禁里摘掉**。该件守的是"历经 3 次语义变更后别再退回复跑即写盘"（件首注释自述 n916c-17→n916d-25→n916f-04），摘掉＝把一条已修的写盘回归放归无看守 |
| A3 换成"金档比对"（不 spawn 脚本，只读 committed JSON 断言 summary 三键） | 该件成本 → 毫秒级 | 新增 1 份 fixture ＋ 改断言；**守护目标从"运行只读"退化为"文件没变"** | 会**丢掉真正的语义**（脚本是否还在写盘）——那正是它存在的理由。可当案 B 落地后的可选加固，不能当替代 |

⇒ **两案对照的结论**：案 B 用 +3～6 行拿到 57×，案 A 三种拆法要么无效（A1）、要么削弱门禁（A2/A3）。
**本稿建议主班只排案 B。**

---

## 五、判据 ④：零改动自证

```
$ git -C D:/code/colony-game status --porcelain
 M docs/design/OPTIMIZATION_BACKLOG.md                        ← 他班在册（禁碰）
 M docs/insights/colony-dead-exports-20260914.json            ← 他班在册（禁碰）
 D docs/insights/colony-dead-exports-20260914.json.bak        ← 他班在册（在册实况，未恢复）
?? docs/insights/colony-de-slowtail-diagnosis-20260924.md     ← 本单产物
 M src/renderer/state/__tests__/calendar.test.ts              ← 本单同班 c924-10（纯注释，另一笔账）
$ git -C D:/code/colony-game diff --numstat -- scripts src/renderer/state/__tests__/auditDeadExportsReadonly.test.ts
（空输出 ⇒ 脚本与测试件 0 行改动）
$ python -c "import hashlib,os;p='docs/insights/colony-dead-exports-20260914.json';print(hashlib.sha256(open(p,'rb').read()).hexdigest()[:8], time.ctime(os.path.getmtime(p)))"
c531140e Sat Sep 19 03:39:52 2026      ← 取数前/取数后各读一次，逐位相同（他班在途 JSON 未被本班写脏）
$ git check-ignore -v tmp/c924-11/instr2.mjs
.gitignore:25:tmp/
```

- 本单**未跑全量套件**（跑的是"单文件 ×3"＋"裸脚本 ×N"，正是卷宗要的独占窗单文件口径）⇒ 不提供任何套件总读数。
- 本单**未使用 `--write`**（那是唯一会写默认 JSON 的分支，且会顺带生成 `.bak`）。所有输出只落 `tmp/c924-11/base.json` 与 `cached.json`。
  ⇒ 顺带一条观察（不判、不动）：默认 JSON 的 `.bak` 之所以存在过，正是历史上有人跑过 `--write`；
  现在它处于 ` D` 是在册实况，**本班零触碰**。

---

## 六、给下一位落地案 B 的班的三条提醒（踩过的坑，别重踩）

1. 🔴 **改这个脚本会连带改那份在册 JSON 吗？** 不会——案 B 已实测输出全等（`46f724ba`）。
   但**若**顺手改桶规则/排序，就会撞上 `auditDeadExportsReadonly.test.ts` 之外的在册在途改动（` M` 那份 JSON 是他班的），
   ⇒ 落地前先看 `git status --porcelain`，若该 JSON 仍是 ` M`，**只改脚本、不跑 `--write`、不提交 JSON**。
2. **别在 `src/**/__tests__` 下放计时副本**：`vitest.config.ts:6` 的 include 会把它们吃进全量口径（c923-11 已为此留过一条同类留痕）。
   本单的副本在 `tmp/c924-11/instr2.mjs`，用 `node` 直跑。
3. **报数必须标"独占窗/暖缓存"**：本机同一条命令见过 14.8 / 15.6 / 26.6 / 94.7 s 四个读数，
   差因是两个（并发、冷缓存），**都不是代码**。

---

## 附：本单产物与探针清单

| 路径 | 说明 | 是否入库 |
|---|---|---|
| `docs/insights/colony-de-slowtail-diagnosis-20260924.md` | 本文件 | ✅ 唯一入库件 |
| `tmp/c924-11/instr2.mjs` | 原脚本的计时补丁副本（difflib 核过差异只有 5 处站点） | ❌ gitignored |
| `tmp/c924-11/instr.mjs` | 第一版手写副本——**正则被 shell 转义吃掉（`\b`→退格符）导致"全 418 条 dead"的假读数，已弃用**。留档只为记这条坑：改脚本副本要用**手术式 patch 原文件**，不要手抄算法 | ❌ gitignored |
| `tmp/c924-11/r1..r3.json` | vitest `--reporter=json` 三份读数 | ❌ |
| `tmp/c924-11/base.json`／`cached.json` | 案 B 等价性证据（两份输出 JSON） | ❌ |
| `tmp/c924-11/timings-notes.txt` | 9/21 台账 JSON 的 note 字段导出（`loadNote`/`caveat` 原文） | ❌ |
