# colony 测试套件慢尾定位（c922-17，只读，2026-09-22T00:5x 取数）

> 用途：回收「28s 慢因材料单」（B 路让位单），给 pre-commit（全量 vitest）提速排单用。
> 边界：**未改任何测试码／生产码／配置**；`vitest.config.ts` 原样；全程只读跑测试。
> 取数：`npx vitest run --reporter=json --outputFile=tmp/vitest-c922-17.json` 于 HEAD `99dcaa7`，2026-09-22T00:45 起跑，`success=True`，**124 文件 / 1295 例全绿、0 fail、0 pending**。

## 一、三句话结论

1. **「28s」不是结构量，是负载量**：本班 00:22 / 00:33 / 00:41 三次 pre-commit 全量分别是 **20.67 / 18.91 / 21.12 s**，本次 JSON 跑跨度 **22.02 s**；而 c921-08 记 38.58s、c921-09 记 30.13s（同一 HEAD 同一脏态）。绝对秒数在本机摆动 **±45%**，拿它当基线会误判提速效果。
2. **墙钟的唯一硬下界是最长那一件**：124 件 per-file 区间之和 57.5 s ÷ 跨度 22.02 s ⇒ **有效并行只有 2.61×**（机器 16 CPU、空闲内存仅 3.39 GiB），因为最长件 `sandboxSnapshot.test.ts` **16.64 s** 一项就占跨度的 **76%**。加线程、调 `pool` 都不会动这个下界。
3. **两处「免费」CPU 浪费占了和的一半**：① `auditDeadExportsReadonly.test.ts` 13.85 s 里有 **10.33 s 在被测脚本自己身上**，其算法是 `O(导出数 × 文件数)` 的**无缓存重复读盘**（≈26,784 次 `readFileSync`／189 MiB，实际唯一数据只有 1.75 MiB）；② `sandboxSnapshot.test.ts` 因 `import … from './sandboxSimulation.test'` **把隔壁 2 个用例重复注册进来跑了一遍**（实测该文件单独跑就是 3 例）。

## 二、Top5 慢测试文件清单＋分类

per-file 区间 = `endTime − startTime`（含该文件在其 worker 内的 collect＋执行）；之和 57.5 s > 墙钟（并行所致），占比一律按「之和」口径给。

| # | 文件 | 区间 s | 例数 | 占和 % | 最大单例 | 慢因分类 | 判据（本单实测） |
|---|---|---|---|---|---|---|---|
| 1 | `src/renderer/state/__tests__/sandboxSnapshot.test.ts` | **16.64** | 3 | 29.0% | 7.41 s | **大 fixture／纯 CPU＋重复注册**（非 sleep、非 IO） | 3 例＝4.02＋7.41＋3.64 s；其中前两例标题属 `sandboxSimulation.test.ts`（定向单跑该文件复现，见第三节 S2） |
| 2 | `src/renderer/state/__tests__/sandboxSimulation.test.ts` | **15.96** | 2 | 27.8% | 8.09 s | **大 fixture／纯 CPU**（720 游戏日 ×2 条策略） | `HORIZON_DAYS = 720`（`:30`）、每例 `runSimulation(720)`（`:247`、`:267`），全文件 `grep` **零** `setTimeout`／`sleep`／`advanceTimers` |
| 3 | `scripts/__tests__/auditDeadExportsReadonly.test.ts` | **13.85** | 1 | 24.1% | 13.85 s | **子进程启动＋被测脚本 IO**（不是断言慢） | 脚本单独计时 `node scripts/audit-dead-exports.mjs` **elapsed=10325ms**（exit 0、只读）；余 ~3.5 s 为 `execSync` 冷启 node ＋ 该 worker 的 import/collect |
| 4 | `src/renderer/scenes/__tests__/UIScene.test.ts` | 3.91 | 4 | 6.8% | 1.03 s | **大 fixture（每例重建全套面板＋registry）** | 4 例分别 1.03／1.01／0.95／0.93 s ⇒ 每例 setup ≈ 1 s，**没有一例是断言重**（平均 0.98 s/例 vs 全盘中位 0.021 s） |
| 5 | `src/renderer/state/__tests__/gameStore.test.ts` | 1.22 | 106 | 2.1% | 0.07 s | **不是慢因**（列它只为给「第五名」定界） | 106 例 ÷ 1.22 s ＝ 0.012 s/例，与第 4 名差 3.2 倍、与第 3 名差 11.4 倍 |

分布全貌：`top3 = 46.4 s（80.8%）`、`top5 = 51.6 s（89.7%）`、**其余 119 件合计 5.9 s（10.3%）、中位 0.021 s**；`≥1 s` 的文件**只有 5 个**。
⇒ 与 c922-13 的「慢尾三件占墙钟 85%」同向，但本单把口径改成 per-file 区间之和后是 **80.8%／89.7%**，且**第一次指出这三件里有 2 件是可以整件消掉的**（第四节 S1/S2）。

## 三、逐件解剖（慢在哪一行）

### S1 `audit-dead-exports.mjs`：O(导出数 × 文件数) 的**无缓存重复读盘**

```js
// scripts/audit-dead-exports.mjs:56-73（实测原文）
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  while ((m = EXPORT_RE.exec(src)) !== null) {
    const wordRe = new RegExp(`\\b${name…}\\b`, 'g');
    for (const other of files) {
      if (other === file) continue;
      nonTestHits += (fs.readFileSync(other, 'utf8').match(wordRe) || []).length;   ← 每个导出名重读全部文件
    }
    for (const t of testFiles) {
      const txt = fs.readFileSync(t, 'utf8');                                        ← 同上，再一遍
      testHits += (txt.match(wordRe) || []).length;
    }
```

实测规模：`scanned files=124 entries=108 summary={"dead":0,"testsOnly":87,"internalOnly":21}`；盘上非测试 `.ts` 124 件 1.12 MiB ＋ 测试 `.ts` 124 件 0.63 MiB ＝ **唯一数据 1.75 MiB**，但被读 **≈108×248 ≈ 26,784 次、约 189 MiB**。
⇒ 一个 `const cache = new Map(files.map(f => [f, readFileSync(f)]))` 即可把 10.3 s 降到亚秒，**输出完全不变**（纯读盘次数问题）。

### S2 `sandboxSnapshot.test.ts` 把隔壁文件的用例**重复注册**了一遍

```ts
// sandboxSnapshot.test.ts:13
import { runSimulation } from './sandboxSimulation.test';   // ← 被 import 的文件里顶层有 describe/it
```

`runSimulation` 是从 `sandboxSimulation.test.ts` 顶层 `export` 的（`:75`），而该文件顶层同时挂着 2 个 `it` ⇒ import 它们时**全局注册表里又登记了一遍**，于是本文件跑 3 例（自己 1 例＋隔壁 2 例）。定向实测（只跑这一个文件）：

```
$ npx vitest run src/renderer/state/__tests__/sandboxSnapshot.test.ts --reporter=json
FILE sandboxSnapshot.test.ts 区间 15.06s tests= 3
     4.02s  720 日贪心经营：持续推进、资源有界、人口成长、国格可达、外部张力存在
     7.41s  720 日均衡经营（产布策略）：国格阶梯至少爬到邦国（第 2 格）——修复贪心卡布的证据
     3.64s  终局精确值：finalDay/人口/建筑/国格/关键资源快照
```

⇒ 720 日贪心在整个套件里被跑了 **3 次**、均衡 **2 次**，其中 **11.43 s 是白烧的**。文件头注释（`:1-2`）写的是「复用 sandboxSimulation.test 的贪心 720 日 harness（本班已 export）」——**意图是复用函数，重复注册是副作用**，不是有意为之；且 c922-13 当时把这三件记成「62.4 s 只跑 6 例」，那 6 例中的 2 例正是这里的重复。

### S3 `sandboxSimulation.test.ts`：真实计算量（不可白拿）

720 日 × 每日贪心建造，建造段内有 `for (let k = 0; k < 60; k++)` 的 60 格槽位探测（`:171-176`），每次探测调 `store.placeBuilding(...)`（失败也计）。
⇒ 想砍这 60 次探测（例如「先判资源够不够再探测」）**会改变终局数值**，而 `sandboxSnapshot.test.ts` 钉的是精确值锚（`gold 6052`、`grain 9894`、`gradeMilestones [{day:41,grade:1}]`，文件头还明写「任何数值改动必须是有意的…漂移＝回归」）。**所以本单不把它列为提速项**，只登记：任何 harness 裁剪都必须由该锚的作者裁决。

### S4 `UIScene.test.ts`：每例 ~1 s 的 setup 重复

4 例各 ~1 s、断言本身轻（`SHUTDOWN`／`create`／`P2-3 危机时刻`）⇒ 成本在「每例重造全套面板＋registry」。
⇒ 可提 `beforeAll` 共享构造（省 ~3 s 之和）。但**这会削弱用例间的隔离性**，属"改测试结构、不改断言"的边缘动作，列为需裁决项（第五节 S4 行）。

## 四、墙钟与负载的口径账（为什么「28s」这个提问要换掉）

```
本次 JSON 跑：per-file 之和 57.5 s ／ 池跨度 22.02 s ／ 有效并行 2.61×（16 CPU）
本机现况：os.cpus()=16，totalmem 15.73 GiB，freemem 3.39 GiB（另有 5 路并行子班在跑别的仓）
今日三次 pre-commit 全量：20.67 s(00:22:47) / 18.91 s(00:33:36) / 21.12 s(00:41)   均 124 文件 1295 例绿
历史同 HEAD 同脏态：c921-08 38.58 s / c921-09 30.13 s
```

判读：
- 墙钟 ≈ `max(最长件) + worker 启动/collect 余量` ＝ 16.64 s ＋ ~5 s ⇒ **不动最长件，提速无处可施**；并行度 2.61× 说明瓶颈不是调度。
- 因此「28 s 慢因」这个提问的正确答案是：**结构慢因是三件（S1/S2/S3），28 s 本身是负载态读数**。今后引用请连同「最长件 ＋ 之和 ＋ 并行度」三个数一起给，单给秒数会被机器负载骗。
- 附：`collect 26-30 s` 这一项（pre-commit stdout）是**之和口径**，与 tests 之和同级，不代表墙钟；这是 c922-13 已点名过的坑，本次再确认一次。

## 五、提速建议（不改测试语义，按收益/风险排序）

| # | 动作 | 落点 | 预期效果 | 是否改测试语义／需谁的裁决 |
|---|---|---|---|---|
| S1 | `audit-dead-exports.mjs` 加**文件内容缓存**（读一次进 `Map`，后续正则只在内存里跑） | `scripts/audit-dead-exports.mjs:56-73` | 脚本 10.33 s → 亚秒；该测试件 13.85 s → **~3.5 s**；最长件下界随之从 16.64 s 换人 | **不改语义**（输出 JSON 必须逐字节不变，用现有 `auditDeadExportsReadonly.test.ts` ＋ 本次 `[read-only]` 打印自证）。属生产脚本改动，需排执行单 |
| S2 | 把 `runSimulation` harness 从 `sandboxSimulation.test.ts` 挪进**非 `*.test.ts`** 模块（如 `state/__tests__/sandboxHarness.ts`，不被 `vitest.config.ts` 的 `include` 命中） | `sandboxSimulation.test.ts:75` ＋ `sandboxSnapshot.test.ts:13` 的 import 改指新模块 | 消掉重复注册的 2 例（**省 11.43 s 之和**）；`sandboxSnapshot` 区间 16.64 → ~3.6 s；**断言逐条不变、用例数从 1295 → 1293（−2 重复例）** | 断言语义**不变**，但**用例总数会变** ⇒ 必须同步更新一切引 1295/1291 的基线数（c922-13 的分布档、START_HERE、若干 result 文案）。建议主班先决定"是否接受计数变化" |
| S3 | 拆 `sandboxSimulation.test.ts` 的 2 例到 2 个文件（贪心／均衡各一件） | 同上文件 | 单件 ~8 s ⇒ 配合 S1 后最长件落到 ~8 s，**墙钟预计 22 → 12-14 s** | 纯文件搬运，**零语义改动**；代价是多一个 worker 的启动开销（本次实测该开销 ~1 s/件量级，需跑一次确认净收益） |
| S4 | `UIScene.test.ts` 用 `beforeAll` 共享面板构造 | `scenes/__tests__/UIScene.test.ts` | 之和 −3 s 左右；墙钟基本无感（不在最长件上） | ⚠️ **需裁决**：牺牲用例隔离性，与「每例自建」的现有测试风格冲突；收益小，建议**不做** |
| S5 | 把 S1/S3 之后仍长的 sandbox 两件标 `sequential` 或从 pre-commit 移出、改夜间跑 | `package.json` 的 `verify`／pre-commit 钩子 | 墙钟 → ~6-8 s | ⛔ **超出"不改测试语义"范围**（改的是门禁覆盖），且 c921-08/09 的整条结论链依赖 pre-commit 全量；本单只登记，不建议现在做 |

**推荐序列**：S1 →（S2 与主班裁决计数）→ S3。只做 S1 就能把最长件从 16.64 s 压到 sandboxSimulation 的 15.96 s……**仍然受限于最长件**；所以 S1 单做**几乎不动墙钟**（它省的是 CPU 之和）。真正降墙钟要 S1＋S2＋S3 一起做（预计 22 → 12-14 s，−40%）。这一条是本次分析里最容易排错顺序的地方，已写明防止主班先做 S1 就宣布提速完成。

## 六、复算命令

```bash
npx vitest run --reporter=json --outputFile=tmp/vitest-c922-17.json   # ~25 s，全绿
# 逐文件区间与占比（本节所有数的来源）：读 tmp/vitest-c922-17.json 的 testResults[i].startTime/endTime
#   python: rt=(r['endTime']-r['startTime'])/1000；assertionResults[i].duration 给单例
npx vitest run src/renderer/state/__tests__/sandboxSnapshot.test.ts --reporter=json --outputFile=tmp/vitest-snap.json
node scripts/audit-dead-exports.mjs          # 单独计时；无参＝只读（脚本自印 [read-only]）
git status --short docs/insights/            # 跑完仍只有他人那两件，证明只读守护成立
```

## 七、判别力（这些结论怎么被咬住）

- **S1 是计时坐实的**，不是看代码猜的：单独跑脚本 `elapsed=10325ms`，且**跑前跑后 `docs/insights/colony-dead-exports-20260914.json` 的 mtime（1789760392→1789760392）与 md5（74c8a587ac→74c8a587ac）不变**、`git status --short docs/insights/` 收工＝开工（他人那 2 件原样）。
- **S2 是定向跑复现的**：只跑 `sandboxSnapshot.test.ts` 一个文件即得 3 例（含 2 例标题属隔壁文件），不依赖整套数据推断。
- **不是 sleep/IO 的判据是穷举式的**：三件慢文件 `grep -n "setTimeout|sleep|await new Promise|advanceTimers"` **零命中**（S3 类另有 `execSync` 子进程，已单列）⇒ 慢因分类不是"看着像 CPU"。
- **全绿不受扰**：本单 2 次全量/定向跑都 `success=True / 0 failed`；未改任何文件即完成分析，`git show --stat HEAD` 只含 `docs/insights/` 两路径。
- **未做（如实）**：没跑「加缓存后的脚本」实测 S1 收益（那是生产脚本改动，越本单授权），10.33 s → 亚秒 是按「唯一数据 1.75 MiB、重复读 189 MiB」的比例推算，**执行单落地时需自行复计时**；也没做变异自证（本单零实现码）。
