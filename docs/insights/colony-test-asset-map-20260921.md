# colony 测试资产分布图（c922-13，2026-09-21 22:45～22:52 现场取数）

- 任务：c922-13-colony-testmap（软预算 ≤40 分钟，实耗约 8 分钟）
- 执行：Qoder 执行班（shift `qoder-executor-20260921-2223-colony`），零生产码改动，仅新增本档 + 索引 1 行
- 取代：任务书锚点里的「1269 基线 / 120 文件」——该数出自 `f0c9754`（c921-02）提交信息，现已失效

## 一、口径与复现命令

```bash
npx vitest run --reporter=json --outputFile=tmp/c922-13/vitest.json   # 工作树实跑（含他人在途 2 个测试文件 M）
node tmp/c922-13/analyze.mjs                                          # 聚合脚本，一次性件
```

两条纪律（都抄自 c922-07 的同类纠正）：

1. `durationMs` 是**文件墙钟**（`endTime - startTime`，含 collect/setup）。文件之间并发跑，所以「各文件时长之和」不是套件总时长——本次和值 73.3 s，而 vitest 终端报的 Duration 约 25～32 s。
2. 「零测清单」的判据是**直接 import 可达性**：该模块的 basename 是否出现在任一 `.test.ts` 的 import specifier 末段。它**不是行覆盖率**——被产码链路间接跑到的模块（例：`calendar.ts` 由 `gameStore` 调）若没人直接 import 就落进清单；同名模块也会互相误判（本库内 basename 无重名，实测该风险为零）。

## 二、基线实数（纠正「1269」）

| 口径 | 文件 | 用例 | 备注 |
|---|---|---|---|
| 工作树实跑（本次） | **124** | **1295** | 0 fail / 0 pending；含在途 `saveLoad.test.ts` 的 +4 |
| HEAD `8580982` 干净态（推算） | 124 | **1291** | 1295 − 4；+4 的实测依据：`saveLoad.test.ts` 声明数 HEAD 45 → 工作树 49，`saveGuard3.test.ts` 14 → 14（零差） |
| `f0c9754`（旧「120 文件 / 1269 用例」出处） | 120 | 1269 | 该文件的 it/test **声明**合计实测 1206，与 1269 用例差 63，差额来自 `it.each` 展开——故声明数不能当用例数用 |

桥接不闭合，如实点名：1269 → 1291 名义上应由 5 处新增解释（c922-04 `bootLoadList` 7→10、c922-09 `storyEffectsTargets` +10、c922-10 `artManifestEvtArtUsage` +5、c922-11 `dataLayerBoundary` +3、c922-12 `calendar` +5 ＝ 声明级 +26），但用例级只涨 22。**−4 未归因**，与 c922-07 已点名的「1269 与 1268 差 1 例未归因」同类；要结案得逐文件跑 `--reporter=json` 对齐 f0c9754，不属本单预算。后续班次引用基线请直接用 **124 文件 / 1291 例（HEAD 态）**。

## 三、目录 × 文件数 × 用例数

| 目录 | 文件 | 用例 | 用例占比 | 文件墙钟合计 |
|---|---|---|---|---|
| `src/renderer/state/__tests__` | 58 | 814 | 62.9% | 45.1 s |
| `src/renderer/data/__tests__` | 23 | 235 | 18.1% | 0.9 s |
| `src/renderer/ui/__tests__` | 25 | 126 | 9.7% | 2.3 s |
| `src/renderer/render/__tests__` | 7 | 86 | 6.6% | 0.4 s |
| `src/renderer/scenes/__tests__` | 9 | 31 | 2.4% | 3.5 s |
| `src/shared/__tests__` | 1 | 2 | 0.2% | 0.01 s |
| `scripts/__tests__` | 1 | 1 | 0.1% | 21.1 s |
| 合计 | 124 | 1295 | 100% | 73.3 s |

锚点纠偏（任务书写的是「state 57/data 20/ui 26/render 7/scenes 9/shared 1=120」）：

- 总数 120 对，**逐目录拆分有两处错配**：`ui` 实为 **25**（非 26），且漏列 `scripts` 的 1 件——`git ls-tree` 在 f0c9754 上逐目录点数得 `57/20/25/9/7/1/1`，两处误差正好互相抵消，所以总数没露馅。
- 120 → 124 的全部来源＝上述 4 个新增测试文件（`git log --diff-filter=A` 自 9/21 00:00 起只命中这 4 件，零改名零删除）。state +1、data +3。
- 结构性观察：**`scenes` 的「文件墙钟 3.5 s / 31 例」是全场最差的时间-用例比**（`UIScene.test.ts` 单件 2.99 s 跑 4 例），而 state 侧 45.1 s 里有 41.3 s 是三个沙盒/审计大件（见下）。data 侧最快：235 例只花 0.9 s。

## 四、Top 测试文件

按用例数（前 8）：

| 文件 | 用例 | 墙钟 ms |
|---|---|---|
| `state/__tests__/gameStore.test.ts` | 106 | 1181 |
| `data/__tests__/v08_j3_content.test.ts` | 68 | 35 |
| `state/__tests__/saveLoad.test.ts` | 49 | 132 |
| `render/__tests__/MapRenderer.test.ts` | 41 | 327 |
| `state/__tests__/productionSystem.test.ts` | 28 | 6 |
| `state/__tests__/diplomacySystem.test.ts` | 27 | 8 |
| `state/__tests__/eventEngine.test.ts` | 23 | 10 |
| `state/__tests__/worldMap.test.ts` | 23 | 14 |

按文件墙钟（前 5，慢尾全部集中在 3 件）：

| 文件 | 墙钟 ms | 用例 |
|---|---|---|
| `state/__tests__/sandboxSnapshot.test.ts` | 21708 | 3 |
| `scripts/__tests__/auditDeadExportsReadonly.test.ts` | 21133 | 1 |
| `state/__tests__/sandboxSimulation.test.ts` | 19549 | 2 |
| `scenes/__tests__/UIScene.test.ts` | 2985 | 4 |
| `state/__tests__/gameStore.test.ts` | 1181 | 106 |

三件慢尾（sandboxSnapshot + auditDeadExports + sandboxSimulation）＝ 62.4 s / **6 个用例**，占墙钟合计 85%。`auditDeadExportsReadonly` 的 21.1 s 是 `execSync` 起子进程跑 `node scripts/audit-dead-exports.mjs` 的开销（c918-15 的只读守护，语义上不可省）；两件 sandbox 是 720 日无头模拟。**要压 pre-commit 时长，动这三件才有意义，动其余 121 件是白忙**——这与 c922-07 台账「top3 占 78%」同向，比例升高是因为本次分母含 collect 且新增件都极快。

碎片度：用例数 ≤2 的测试文件 11 件（占文件数 8.9%），最低限度不是问题，只是提示「一文件一断言」的守卫件偏多。

## 五、零直接测试的生产模块清单（15 / 124）

判据见第一节。生产 `.ts`（排除 `__tests__` 与 `*.test.ts`）共 124 件，其中 15 件不被任何测试文件直接 import：

| 模块 | 判读 |
|---|---|
| `src/main/index.ts`、`src/preload/index.ts` | Electron 壳/IPC 面，无 DOM 无测试基建，属结构性豁免（不是漏） |
| `src/renderer/main.ts` | 入口装配（Phaser game 创建），同上 |
| `src/renderer/scenes/BootScene.ts` | **真缺口**：它的加载清单已被 `bootLoadList.test.ts` + `artManifest.test.ts` 从数据侧钉住，但 BootScene **自身的错误处理/进度逻辑**没被直接测（`bootLoadErrorDedup.test.ts` 只测去重工具）。c921-07 只读探针与 c922-04 双轨守卫都在数据侧，运行时面仍空 |
| `src/renderer/data/offline.ts`、`particles.ts`、`policyExclusions.ts`、`tutorial.ts`、`data/index.ts` | 纯数据桶/再导出件；`data/index.ts` 是聚合门面（可豁免），四个数据桶靠 `v08_j3_content` / `policies` 等内容测试**间接**跑过，直接钉桩确缺 |
| `src/renderer/ui/courtFormat.ts`、`panelDecoration.ts`、`Toast.ts`、`CrisisModal.ts`、`JitHintManager.ts`、`MilitaryPanel.ts` | UI 面：`MilitaryPanel`/`CrisisModal` 有组件文件但无同名测试（同目录已有 25 件 ui 测试，加这两件的路径与脚手架都现成）；`courtFormat`/`panelDecoration` 是纯函数/常量，钉桩成本最低、收益最直接 |

按「可钉性 × 缺口价值」排序的建议出口（不在本单做）：① `courtFormat.ts` 与 `panelDecoration.ts`（纯函数，最廉）→ ② `BootScene` 的 error/progress 面 → ③ `MilitaryPanel` / `CrisisModal` 组件面。Electron 壳与数据门面建议显式标注豁免，免得下次普查又把它们算成缺口。

注意 `calendar.ts` **不在**本清单里：c922-12 落 `state/__tests__/calendar.test.ts` 后它已有直接测试（任务书把它当例子是 c922-12 之前的状态，现已闭合）。

## 六、START_HERE 订正草稿（维持草稿，不改文件）

`docs/design/00_上手须知_START_HERE.md` 属用户 M 域（c922-07 已判定，本单沿用），只给可粘贴文本：

```
- 🟢 已跑通：资源/建筑(35)/国策(39)/朝令(12)/事件(沙盒48+故事35)/邦交(NPC动态成长)/存档(游戏内三槽 UI)，
  124 文件 / 1291 测试 + type-check 干净（2026-09-21 实测，取数命令见 docs/insights/colony-test-asset-map-20260921.md；
  域计数随时复核：npx tsx scripts/domain-counts.mts）
```

现文为「国策(23)/沙盒40/故事23 … **1154 测试** …（2026-09-17 实测：91 文件 / 1154 用例全绿）」。`npx tsx scripts/domain-counts.mts` 本次实跑 exit 0、报 3 项漂（国策 +16、沙盒 +8、故事 +12，正数＝文档低估），测试面则从 91 文件 / 1154 例漂到 124 文件 / 1291 例（低估约 12%）。更稳的写法是把计数整行改成「运行 `npx tsx scripts/domain-counts.mts` 取当前值」，让 c922-07 的脚本当唯一事实源。

## 七、关联

- 本文落档后，`docs/insights/colony-suite-timings-20260921.json`（c922-07，120 文件口径）**即时过期**：文件数、总用例、top3 占比三项都变了（120→124、1272 工作树→1295 工作树、78%→85%）。两个口径并存会误导，建议下一班要么用同一条 `--reporter=json` 命令重生成，要么在 JSON 里加 `superseded` 字段指向本文。
- `docs/insights/colony-dead-exports-20260914.json` 仍挂他人在途 M，值 `{108,0}` 既非 HEAD 也非现口径 `{86,22}`——本文零引用它，零测清单全部现场重取。
