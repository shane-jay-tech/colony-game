# c927-33 · 沙盒读数规范（登记档）：econ 与 perf 两族读数的可比性口径

- 班次：`qoder-executor-20260927-2024-colony45`｜日期：2026-09-27 20:3x（本机 `date`）｜仓/分支：`D:\code\colony-game` @ `codex/architecture-hardening`（开工 HEAD `6b2e639`）
- 形状：**登记档，零产品码改动、零新增测试件、未复跑任何样本**。本文不产生任何新读数结论（红线：统计数值结论／经济平衡数值一律留人工）。
- 两枚汇总对象（卷宗写 `outbox/`，实际在 `D:\code\zcode-bridge\done\`＝波次 brief §3a 的路径搬家，内容在世）：
  - `done/20260925-154156-0304.result.md`（3 778 B）——720 日 econ 沙盒期末库存，**单次采样**，无硬件/并发记录。
  - `done/20260925-154201-11e4.result.md`（13 316 B）——tick/存档/渲染三腿，**5 轮 × 60 次＋p50/p95**，E1 硬件表齐但缺 5 项，机内 5 个 node.exe 并发＋同仓兄弟班。

## 0. 为什么要这张规范（一句话）

同一台机上、相隔一天、同一个 harness，两族读数各自给出了**看起来冲突**的口径：0304 说"单次采样、每轮 ~10.3 s"，11e4 说"5 轮取 p50/p95，同一腿两次测量散布 1.9×/7.4×，且本单读数不可作对外基准"。没有一张登记规范，后续任何单都会把"某一轮的中位数"当成"本仓的数"。本档只定**记录格式与可比性标签**，不定任何数值判定。

## 1. 两枚 result 的口径限制汇总（读自磁盘原文）

| 维度 | 0304（econ） | 11e4（perf） | 差异后果 |
|---|---|---|---|
| 采样参数自述 | 「seed=0，60×60 全平原」（`:12,:18`） | 三档 `40²/80²/200²`、people `46/200/2000`（判据表 ①②） | 0304 自述与它在册 harness 现值不符（见 §5 否证 N1） |
| 实际 harness | `npx vitest run …sandboxSimulation.test.ts --reporter=verbose`（`:34`），读 stdout `[P0-1]`/`[P0-1-diversify]` JSON | `vite-node tmp/20260925-154201-11e4/perf{,2,3}.mts`（隔离探针，不碰 src） | 两族指标不同（状态量 vs 毫秒量），不可混表 |
| 重复次数 | **每策略 1 次**，明说"单次采样不能给出分布区间"（遗留 1） | **REPS=5 × N=60 ＋ 预热**（`perf.mts:24-25,82-92`），逐轮数组＋min/max 全给 | 0304 无区间；11e4 有 |
| 统计量 | 期末快照原值（无数值加工） | p50/p95，取法 `pct(arr,p)=升序 ceil(p/100·n)−1`（`perf.mts:34-36`） | "中位数"与"唯一值"在 0304 里是同一个数，易被误当分布中心 |
| 硬件条件 | **完全未记** | E1：cpuModel/`cpuMHz 3187`/16 逻辑核/15.73 GB/起始空闲 2.873 GB/node v24.15.0/win32 10.0.26200 | 0304 无法判定"是否空载"（它的 ~10.3 s/轮耗时因此不可引用） |
| 并发条件 | 未记 | `nodeProcsAliveDuringRun 5` ＋ 同仓兄弟班 `colony37` 在跑（E1/遗留 2） | 11e4 自己判"不可作对外基准"；0304 无从判断 |
| 缺项自述 | — | 「GPU 型号与显存、磁盘类型、电源计划、温度限速——**这五项本单只读面拿不到**」（E1 尾） | ⚠ 其中三项实测可取（§5 否证 N2） |
| 钳位/饱和 | 已登记 wood 双策略触顶 9999；`RESOURCE_CAP_BASE=9999`（`gameStore.ts:631`）＋住房侧第二道闸未记 | 无关（三腿是耗时，不被资源 cap 影响） | 0304 的"产能冗余"必须按**截尾数据**读 |
| 时间戳 | 采集 2026-09-26 13:34–13:40、commit `17b8498` | 探针 `generatedAt 2026-09-26T16:00:35.806Z`（＝本地 09-27 00:00:35），HEAD 同日 `1104e33` | 两者跨两个 commit；econ 侧已复算 `17b8498..HEAD` 对 sim 输入零改动（§3） |
| 全量/定向 | 定向 2 文件 | **刻意不跑全量**（并发污染，E6） | 一致遵守波次 brief §5 |

## 2. 沙盒读数规范（登记格式，四节为卷宗点名项，另加两节为汇总时发现的真实缺口）

### A · 空载条件（可判、必须判）

| 项 | 口径 | 现值实测（本班 20:3x，本机） |
|---|---|---|
| A1 同机重进程 | `node.exe` 计数（不含自己）必须 ≤1 且 `electron.exe`＝0 | `Get-Process node`=1、`electron`=0、`python`=1 ⇒ **接近空载但非严格空载**（Qoder 会话自身） |
| A2 起始可用内存 | 记 `os.freemem()` 于采样前一刻，且给"同机前次读数"对照 | 本次 `freeMemGBAtStart 3.82` vs 11e4 当时 `2.873` ⇒ **同一台机两批相差 33%**，这就是必须记该字段的理由 |
| A3 同仓他班在跑 | 见 D 的 claims 时间窗 gate（**结构性主因**） | 本次 gate 读数：45 min 窗内他班 5 枚未收口，但**均不在 colony-game**；兄弟班 `colony44` 的 `c927-30` 已于 20:27 写 done |
| A4 温度/降频 | 允许登记 `NA`＋命令原文（§5 N2：本机 `root/wmi MSAcpi_ThermalZoneTemperature` 零实例） | 唯一真取不到的一项 |
| A5 判定 | A1–A3 任一不满足 ⇒ 该读数只能进"污染样本"表，**禁入基准表**（ms 级尤其） | — |

### B · 硬件条件记录字段（**≥6 必记，本档定 10 项**；每项标可采性）

| # | 字段 | 采法（只读命令原文） | 本机现值 |
|---|---|---|---|
| B1 | CPU 型号／逻辑核 | `node -e "os.cpus()"` | `13th Gen Intel Core i5-13500H`／16 |
| B2 | 上报主频 | `node -e "os.cpus()[0].speed"` | 3187 MHz（11e4 同值） |
| B3 | 内存总量／起始空闲 | `node -e "os.totalmem()/os.freemem()"` | 15.73 GB／3.82 GB |
| B4 | Node／OS 版本 | `node -v`＋`os.release()` | v24.15.0／win32 10.0.26200 x64 |
| B5 | **GPU 型号与显存** | `powershell -NoProfile -Command "Get-CimInstance Win32_VideoController \| Select -Expand Name"` | `Intel(R) Iris(R) Xe Graphics`＋`NVIDIA GeForce RTX 3050 4GB Laptop GPU`（＋`Honor Virtual Display Device`） |
| B6 | **磁盘介质/总线** | `powershell -NoProfile -Command "Get-PhysicalDisk \| Select MediaType,BusType"` | `SSD / NVMe` |
| B7 | **电源计划** | `MSYS_NO_PATHCONV=1 powercfg /getactivescheme \| iconv -f GBK -t UTF-8` | `电源方案 GUID: b8a2c9f4-… (Honor Performance)` |
| B8 | 并发进程计数 | `powershell -NoProfile -Command "@(Get-Process node).Count"`（避开 `tasklist` 的 GBK 表头与 MSYS 参数吞噬） | 1 |
| B9 | 仓/版本三元组 | `git rev-parse --short HEAD`＋`--abbrev-ref HEAD`＋`git status --porcelain \| wc -l` | `6b2e639`／`codex/architecture-hardening`／8 |
| B10 | 温度限速／实时主频 | 允许 `NA`：本机 `Win32_Processor.CurrentClockSpeed` 恒等于 `MaxClockSpeed`＝2600（标称值非实时），ACPI 热区零实例 | `NA（附上述两行读数）` |

> ⚠ 两条 Windows 侧踩坑（必须写进采法，否则后人会重演"拿不到"的误判）：
> ① Git Bash 里 `powercfg /getactivescheme` 的 `/…` 会被 MSYS 当路径吃掉 ⇒ 必须 `MSYS_NO_PATHCONV=1`；
> ② `powercfg`/`tasklist` 输出是 GBK ⇒ 中文项（电源计划名）要么 `iconv -f GBK -t UTF-8`，要么只用 ASCII 字段。

### C · 轮数与统计量

1. **预热段必跑并单独登记**（11e4 在册口径：轮前预热 20 tick，`perf.mts:82`；首轮含 JIT，其 tick small `0.069→0.029` 单调下行即证据）。
2. **轮数 REPS ≥5，每轮 N ≥60 次操作**（下限取 11e4 已在用的 `REPS=5`／`N=60`，`perf.mts:24-25`）； econ 侧的"1 轮"＝1 个 720 日整局，必须显式写成 `REPS=1` 并挂 §3 标签，禁止与 5 轮样本同表混排。
3. **统计量最小集**：`p50 / p95 / min / max / 逐轮原始数组`，分位取法必须写明（本档采用 11e4 的 `ceil(p/100·n)−1` 升序索引，`perf.mts:34-36`）。只报均值判不合格。
4. **散布上限**：同腿重复测量比值必须登记（11e4 E4 给出 `bake 1.795/4.857/18.349` vs `3.409/5.112/10.657` ⇒ 同腿散布 **1.9×/7.4×**）；比值 >1.5× 时该腿一律标"单次快照无效"。
5. **样本量与区间**：凡"某值 = X"要进对外表，须给 n 与极差；econ 侧的区间只能来自**多种子**（`c927-18` 已交 5 seed × 2 策略分布表，本班不复算）。
6. 🔴 **timeout 形状与样本量绑定**（在册缺陷，别造死闸）：`vitest.config.ts` 现值仍**无 `testTimeout`**（只有 `environment: 'node'`＋`include`，`:17-18`）⇒ vitest 1.6.1 默认 **5 000 ms**。凡把重样本（720 日模拟、5 轮 × N 计时）写进 `it()`，**必须同行尾给显式第三参**——本仓重样本件正是靠它活着：`sandboxSimulation.test.ts:264,282` 的 `}, 120000);`。反向案例见 `c927-25` §0：`tickPerf.test.ts:35` 的 `toBeLessThan(30_000)` 永远不是第一个触发者。
7. **截尾/钳位登记**：读数触及上限时必须写"截尾"而非数值本身（econ：`RESOURCE_CAP_BASE 9999`（`gameStore.ts:631`）之外还有**住房侧第二道闸**，人口侧另有独立约束 ⇒ `wood 9999` 是"产能冗余"不是"产量"）；perf：无 cap，但 `MAX_SAVE_BYTES 10 MB`（`src/main/index.ts:152`）是存档腿的对外可比性上限。

### D · 并发窗禁令（硬规则）

1. **ms 级读数禁与同仓他班并发**：采前跑一次 gate（见下），窗内存在同 cwd 他班未收口 claim ⇒ 改采"分布/方向"口径或延后，**不得**产出基准数字（11e4 E6/遗留 2 是这条的来源）。
2. **gate 必须带时间窗，不能用"全量未收口 claim"当并发信号**：本班实测 `logs/claims.log` 共 5 237 行，其中 **45 枚历史班次（`sweep-20260916/18/19-*` 等）永久停在 claim 态** ⇒ 不设窗则禁令恒真、等于自锁。gate 原文（只读，粘进 result 的证据节即可）：

```python
# 并发窗 gate：45 min 内其它班次仍未收口的 claim（只读，不改信箱任何文件）
import re,datetime,collections
pat=re.compile(r"^\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([a-z]+)\s*\|")
now=datetime.datetime.now(); win=now-datetime.timedelta(minutes=45); recs=[]
for ln in open("D:/code/zcode-bridge/logs/claims.log",encoding="utf-8",errors="replace"):
    m=pat.match(ln)
    if not m: continue
    ts=datetime.datetime(int(m[1]),int(m[2]),int(m[3]),int(m[4]),int(m[5]))
    if ts>=win: recs.append((ts,m[6],m[7],m[8]))
st=collections.defaultdict(set)
for ts,tid,shift,act in recs:
    (st[shift].add(tid) if act=="claim" else st[shift].discard(tid))
print(len(recs),{s:sorted(v) for s,v in st.items() if v})
```
读数（本班 20:34）：`61 行 / 5 个他班未收口（k927-17×2、q927-29、s927-23、q927-31）⇒ colony-game 方向 0 枚`。
注：该 log 时戳形状不统一（`unparsed 2145` 行属更旧格式），故 gate 只保证"新格式行"覆盖，读数要连带登记 `lines_in_window`。
3. **跨班同日读数不互认**：他班在同一日同一机上采的数，引用时必须带其班次名＋其 E1 表（没有 E1 表 ⇒ 直接标"不可比"，见 §3）。
4. **状态量与计时量分表**：econ 期末库存受 seed 支配、**不受并发支配**；ms 读数受并发支配、不受 seed 支配 ⇒ 两族各用各的可比性判据（§3 即按此拆标）。

### E · 附加两节（汇总时发现的真实缺口，卷宗未点名但不写就会再翻车）

1. **harness 身份必须逐常量钉死**：`sandboxSimulation.test.ts` 的 `HORIZON_DAYS=720`（`:30`）／`MAP_W=MAP_H=80`（`:31-32`，即 6 400 格）／`rngSeed: 20260813`（`:41`，**编译期常量、`runSimulation` 无 seed 形参** ⇒ 换 seed 必须改码，见 `c927-18` §2）；写读数时"seed/地图尺寸"必须引这四处行号，不许写自然语言。
2. **探针留存**：读数件的探针与 report JSON 必须留在 `tmp/<班名>/` 直到裁决归档（11e4 三枚 `perf*.mts`＋`perf*-report.json`＋`saves/` 今日**仍在盘**，本班逐行读过、未复跑；0304 则只有在册 vitest 一条命令可复跑）。探针消失 ⇒ 后人只能重采 ⇒ 一律判"不可复算"。

## 3. 两单（加一枚同域在途件）现有读数的可比性标注

标签定义：
- **可比-内**＝同机同族条件下可与之对照／可复算；
- **可比-外**＝可进对外基准表；
- **不可比**＝缺 §2B/§2D 关键字段，只能当"某时刻的一次观测"。

| 读数 | 来源 | 指标族 | 标注 | 依据（缺哪几项） |
|---|---|---|---|---|
| 720 日期末库存（贪心 117 人/40 建/国格 1/wood 9999/grain 9894…；均衡 140 人/56 建/国格 2/cloth 1499…） | 0304 表二 | econ 状态量 | **可比-内 ✅／可比-外 ❌** | 状态量由 seed 支配：`c927-18` 20:3x 前已用同一在册 vitest **逐字段复现**（其证据 ① 明写"0304 的读数今天仍然可复现"）⇒ 可比性坐实；但"可比-外"仍不给——缺 §2C5 的区间（REPS=1、无多种子），且 wood/stone 是截尾值 |
| 0304「seed=0，60×60 全平原」 | 0304 `:12,:18` | 采样参数 | **不可比（作废，不得引用）** | 与在册 harness 现值直接矛盾（`rngSeed 20260813`、80²），见 §5 N1 |
| 0304「每轮 ~10.3 s」 | 0304 `:58` | 计时量 | **不可比** | 无 §2B 任一硬件字段、无 §2D 并发计数、REPS=1、无 p50/p95 ⇒ 连"机内可比"都不成立 |
| 0304 消耗侧 `economyBalance.test.ts 12 passed` | 0304 `:52` | 不变量（非数值） | **可比-内 ✅** | 断言型读数，与负载/seed 无关（复跑成本 ~数秒） |
| tick 三档 p50/p95 `0.041/0.069`、`0.095/0.180`、`0.481/0.607` ms | 11e4 E2 | perf | **可比-内 ✅／可比-外 ❌（11e4 自判）** | 字段最全（E1＋5 轮＋逐轮＋min/max），但 `nodeProcsAliveDuringRun 5`＋兄弟班并发 ⇒ 违 §2D1；缺 §2B5–B7（现已可补，见 N2）；规模弹性 11.7× 这类**比值**在并发窗内不稳（同腿散布 1.9×） |
| 存档三腿（内存/写盘/parse 各 p50/p95＋档体字节） | 11e4 E3 | perf（含磁盘腿） | **可比-内 ✅／可比-外 ❌，且"写盘腿"额外降级** | 磁盘腿在 §2B6 未记介质时不可跨机比；档体字节 `91 536/360 068/2 222 868 B` 属**状态量**、可单独外引（与负载无关，且对 `MAX_SAVE_BYTES 10 MB` 的占比是纯算术） |
| 渲染 CPU 腿 bake `3.409/5.112/10.657` ms 等 | 11e4 E4 | perf | **不可比（同腿自证散布 1.9×/7.4×）** | 违 §2C4：两次探针同腿互相否证 ⇒ 只能登记区间，不得登记点值；且 CPU-only，GPU/present 腿未量（其遗留 1，插桩属人工放行，`c927-24` 已在设计该腿） |
| 10 样本分布表（5 seed × 2 策略，含「首达邦国日 ∈[49,182]」、12 格零方差/23 格种子敏感） | 同仓 `c927-18`（在途，已入库 `4c1d608`） | econ 状态量＋**每行耗时 ms** | 分布部分 **可比-内 ✅（区间齐、逐样本原表在档）**；其**耗时列 不可比** | 该档未记 §2B/§2D 任何一项（只有 `耗时ms` 一列）⇒ 按 §2D1 其 ms 列只能当污染样本，别让后人拿它做 harness 提速依据 |
| 本班 §5 N2 的三项硬件读数 | 本班 20:34 | 硬件条件 | **可比（事实陈述，无负载依赖）** | GPU/磁盘/电源计划三项由命令原文直取，任何班次可复算 |

**跨单结论**：0304 与 11e4 之间**不构成"同一口径谁更准"**——两族量不同；两单之间唯一真正的可比性冲突是"能不能引用某一次读数"：econ 状态量能（seed 决定、已复现），perf 点值不能（并发决定、自证散布 1.9×/7.4×）。

## 4. 判据对照（完成标准 3/3）

| # | 卷宗判据 | 本文位置 | 命中 |
|---|---|---|---|
| ① | 规范含 ≥6 个必记字段 | §2B 定 **10** 项（B1–B10，逐项附命令原文＋本机现值），另 §2A 空载 5 项、§2C 采样 7 项、§2D 并发 4 项 | ✅ |
| ② | 两单读数标注完成 | §3 表（0304 四组＋11e4 三组＋同域 `c927-18` 一列，逐组给标签与依据） | ✅ |
| ③ | 零码改动 | `git status --porcelain src/` 空、`git diff` 空（读数见 result 证据节）；`tmp/` 零新件（本文 gate 走 stdin 未落盘） | ✅ |

## 5. 否证／收窄清单

- **N1（否证 0304 的采样参数自述）**：0304 两次写「seed=0，60×60 全平原」（`:12` 摘要、`:18` 样本行），而在册 harness 现值＝`rngSeed: 20260813`（`sandboxSimulation.test.ts:41`）、`MAP_W=MAP_H=80`（`:31-32`，6 400 格）。它跑的正是这条命令（其证据 `:34`）⇒ **自述参数与实际所跑不一致**。本班独立复核（`git diff --stat 17b8498 HEAD -- src/`＝仅 6 件、全是 `__tests__`＋`saveLoad.ts`，模拟输入零改动），与 `c927-18` 的"逐字段复现"互不矛盾：读数真、口径标注假。
- **N2（否证 11e4 的"只读面拿不到"）**：11e4 E1 尾声明「GPU 型号与显存、磁盘类型、电源计划、温度限速——**这五项都会直接挪动 ms 级读数，本单只读面拿不到**」。本班同一台机、纯只读实测：**GPU、磁盘、电源计划三项可取**（`Win32_VideoController`→`Intel Iris Xe`＋`RTX 3050 4GB`；`Get-PhysicalDisk`→`SSD/NVMe`；`powercfg /getactivescheme`→`Honor Performance`）。真取不到的是**温度限速**（`root/wmi MSAcpi_ThermalZoneTemperature` 零实例）与**实时主频**（`Win32_Processor.CurrentClockSpeed`＝`MaxClockSpeed`＝2600，标称值）。⇒ 规范 §2B 因此把三项定为**必采**而非缺项；**但 11e4 的核心结论（读数不可作对外基准）不变**，其主因是 `nodeProcsAliveDuringRun 5`＋同仓并发，不是这三项。
- **N3（收窄"空载"可判性）**：并发窗 gate 若按"全量未收口 claim"实现会**恒真**——`logs/claims.log` 5 237 行里 45 枚历史班次（`sweep-*`）永不收口 ⇒ 必须带时间窗（§2D2）。
- **N4（收窄 11e4 硬件表的时间戳可读性）**：其 `generatedAt 2026-09-26T16:00:35.806Z` 与本地 09-27 00:00:35 已在原档两边同写（合规），引用时别只取一个。

## 6. 遗留

1. **规范落地方式未定**（属主班裁决）：本档是登记口径，不是强制闸。要变闸只有两条路——① 结果件 frontmatter 加 `sandbox_caliber` 键并写信箱层校验（＝信箱脚本改动，人工闸）；② 在 docs 侧靠引用纪律。本班两者都未做。
2. **11e4 缺的三项硬件字段可回补**：其探针仍在盘（`tmp/20260925-154201-11e4/perf*.mts`），按 §2B5–B7 三条命令可补齐同机条件而**不必重采 ms**；要不要补登进 `c927-25` 的合并口径，交主班。
3. **对外基准仍缺一次真·空载复跑**：本班按卷宗形状未复跑任何样本（零新读数）；A1–A3 此刻虽接近空载，但同仓兄弟班随时起（`colony44` 20:20–20:27 刚跑完一枚），故基准表仍是空白。
4. GPU／present 腿（`c927-24` 设计中的那条）本规范不覆盖——它需要真机插桩，属人工放行。
5. `RESOURCE_CAP_BASE=9999` 之外的**住房侧第二道闸**具体常量名/行号本班未逐一定位（只登记"存在第二道闸，读数须标截尾"），要精确到常量请另派只读单。
