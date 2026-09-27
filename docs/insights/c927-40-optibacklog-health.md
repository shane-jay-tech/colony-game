# c927-40 colony `OPTIMIZATION_BACKLOG.md` 条目健康度盘点（卷宗批后刷新 · 只读）

- 班次：`qoder-executor-20260927-2146-colony47`（波次 19 只读盘点／审计位，本单为第一枚）
- 取证时点：本机 `date` 连读 `Sun Sep 27 21:53:29 2026`
- 仓现值：`D:\code\colony-game`，分支 `codex/architecture-hardening`，HEAD `0939aa6`
- 对象件：`docs/design/OPTIMIZATION_BACKLOG.md` —— 工作树 ` M` 在途件，**归属主班**，本单**零写入**（自证见 §6）
- 性质：**只读盘点**。三栏清单＋建议归档行；建议行一律是**候选文本**，本单不代改、不代勾、不代删
- 🔴 红线自约：凡经济平衡数值（沙盒人口/终局资源/加成倍率）与统计阈值，本单只**登记"行内数≠现值"这一口径事实**并指向在档出处，不判哪个数对、不写新数

---

## 0. 结论速览（六条）

1. **条目全集 = 33 条**（`grep -c '^- \[x\]'` = 22、`'^- \[ \]'` = 11，见 §7）。未勾 11 行的行号是 **24/41/42/47/51/60/62/63/72/73/74**，与 `colony-optibacklog-status-draft-20260922.md`（c922-19）当时**逐字相同、两日零漂移** ⇒ c922-19 那张表整体仍可直接当基线用，本单是它的**增量复核**，不是重写。
2. **P1 六行已被 c924-34 完整接管**：`docs/insights/colony-p1-premerge-verify-20260924.md` §4.2 备有**六行齐全、可直接粘贴**的合入稿，且该稿已把逐行复算做完。本单复核其六个 BootScene 锚点**今日仍 5/6 漂**（`BootScene.ts` 未再被改，103 行）、P1-2 三锚点**仍全中**、P1-3 的 `gameStore.ts` 调用点**在两日内又从 :948 漂到 :961**（+13）⇒ 该行"改内容定位、不写行号"的手法被二次验证为必要。
3. **P1 段的在途 diff 就是全部重叠面**：`git diff` 实测该文件只有 **5 insertions / 5 deletions、全在 P1 段（:38-43）**，与 c922-19 §五判断一致 ⇒ P0/P2/P3/P4 四段的建议行**可独立合入、不撞车**。
4. **头号新增否证（推翻 c922-19 的一条判断）**：c922-19 §二#9 说「全文件 `grep -c 分发` = 0 ⇒ 唯分发说明确无载体」。本单实测 **`README.md:73` 已明文引用 `docs/design/FRIEND_GUIDE.md`**（标题「邦国录 · 给朋友的三分钟上手」实盘在世），README 也已从 c922-19 记的 4,489 B 增至 **5,160 B** ⇒ **载体已由后续班次（c922-124 一系）补出来**。:72 的残余因此要重写，不能照抄 c922-19。
5. **四条"已勾项"的锚点集中失效**（不是勾错，是数过期）：`:32` 存档「迁移到 v8 / saveLoad 45 测试」→ 现 `SAVE_SCHEMA_VERSION = 9`（`saveLoad.ts:19`，migrations 1..8 全在）＋ saveLoad `it(` **49** 条；`:34` 出包「0.9.0 三件套」→ `dist-out/` 全是 **0.10.0**、mtime **2026-08-14 01:51**；`:38`「50 个事件全覆盖」→ 三轨复算各 **55** 且差集为空；`:43`「cameraMath.ts 79 行」→ `wc -l` **90**。
6. **11 条未勾项里只有 1 条可以立刻关单**：`:51` P2-3。`docs/insights/colony-p23-batch1-20260922.md` §一#3 已明文写「P2-3 的实质工作已全部落地，`OPTIMIZATION_BACKLOG.md:51` 的 `[ ]` 未勾属**关单动作缺失**而非工作量缺失」，本单独立复算其接线提交（`51f46ed`／`4ecc2b6`／`4699166`）与 `src/renderer/ui/AudioManager.ts:31/:35/:36/:39` 监听面**全部在世** ⇒ 建议直接勾。其余 10 条都还有真残余（或属人审 ⚑）。

---

## 1. 三栏清单 · 判据口径

「三栏」＝每条同时给三个标注，可并存：

- **①覆盖**：该条的实质结论／残余清单**已在 9/25 卷宗批结果件或 `docs/insights`／`docs/design` 落档**，后续班次引档即可、不必重做 → 必须带出处文件名。
- **②锚点失效**：行内写的、可复算的锚点（行号／文件／数字／版本／commit）**与磁盘现值不符** → 必须给现值与命令。
- **③仍有效**：确有未做的活 → 点名副残余是什么。

统计（§7 给逐条加和）：**①覆盖 26 条 / ②锚点失效 20 条 / ③仍有效 12 条**；三条全空的只有 **2 条**（`:54` P2-6、`:66` P3-6 属"已落地、锚点在世、无残余"，①覆盖仍成立）。

---

## 2. 三栏清单 · 表头（非 checkbox，但是全档锚点源）

| 行 | 现文锚点 | ②失效判定 | ①覆盖出处 |
|---|---|---|---|
| 5 | 约束「每轮落地后跑 `npm run verify` 全绿并**刷新桌面 exe**」 | **半失效**：exe 侧从未刷新——`dist-out/` 三件套 mtime 全为 `2026-08-14 01:51`，而 `git rev-list --count --since=2026-08-15 HEAD` = **212** | `colony-p43-dress-20260918.md`（c918-27：verify+build 双 EXIT=0 但**未出包**） |
| 6 | 基线「2026-08-13 实测：975 测试全绿」 | **失效**：`colony-test-baseline-20260921.md` 记 HEAD `3144c15` 干净态 **124 文件 / 1302 例**（脏态 126/1337）；本单静态复算 `find src -name '*.test.ts' \| wc -l` = **156** | 同上 ＋ c922-19 §三（已建议只加时效注、不当静态量引） |

> 建议归档行（:6，可粘贴）：
> `> **基线**（2026-08-13 快照）：type-check 干净，975 测试全绿，生产构建通过。⚠ 本数是**每轮递增的快照量**，勿当静态值引；取现值请读 docs/insights/colony-test-baseline-20260921.md 或按该档 §〇 命令现跑。`

---

## 3. 三栏清单 · P0 段（:24-:34，5 条）

| 行 | 条 | ①覆盖 | ②锚点失效 | ③仍有效 |
|---|---|---|---|---|
| 24 | P0-1 主项 `[ ]` | `colony-backlog-dup-ids-20260917.md` §二（重号三组在册：P0-1×2／P2-2×3／P4-1×2）＋ c922-19 §一#1（判「✅ 建议勾或删」） | **与 :28 同事实双挂**；行内无独立可复算数 | 无 → 建议**删行或改 `[x]` 指向 :28** |
| 28 | P0-1 落地 `[x]` | `c927-18-multiseed-econ-sampling.md`（本批；§Step1 在册基线 `2 files / 5 tests passed`、`[P0-1]` 读数可复现）＋ `c927-33-sandbox-caliber-spec.md` §口径表（把「状态量」与「毫秒量」两族指标分家） | **4/5 读数过期**：行内「1001 测试」「人口 20→38」「第 33 天晋城邑」「37 栋建筑」→ c927-18 现值 **117 / day41 / 40 栋**；仅「26 次敌对张力」未漂 | 闸门本体在世（`sandboxSimulation.test.ts:245` describe、2 个 `it(` 复算 ✓）→ 只加时效注 |
| 32 | P0-2 存档兼容 `[x]` | `colony-v10-guard-spec-20260915.md`／`colony-v10-guard-impl-20260916.md` ＋ 本批 `c927-01`（deserialize 就地注入）／`c927-02`（校验消息拆分）／`c927-03`（`.bak` 窗口）／`c927-05`（负库存入档面）四枚存档链续单 | **两处**：「全链迁移到 **v8**」→ 现 `SAVE_SCHEMA_VERSION = 9`（migrations 档位实测 1..8 齐）；「saveLoad **45** 测试」→ 现 **49** 条（c922-19 §三当时因"他在途未收口"故意不钉死，如今已可钉） | 无（是数要刷，不是活要干） |
| 33 | P0-3 性能基线 `[x]` | `colony-build-size-20260920.md`（体积基线可复现）＋ `colony-phaser-minify-diagnosis-20260923.md`（6.78 MB 未 minify **根因结案**）＋ 本批 `c927-24`（GPU 插桩设计）／`c927-25`（双 perf 口径合并裁决）／`c927-27`（合帧广播裁决） | **「0.04ms/日」＋「灾难退化拦截测试」组合失效**：c927-25 §0 实测 `tickPerf.test.ts:35` 的 `toBeLessThan(30_000)` 是**死闸**——本仓 `vitest.config.ts` 无 `testTimeout` ⇒ vitest 默认 5000 ms 先红。本单复算该档确在世（`src/renderer/state/__tests__/tickPerf.test.ts:14`） | 残余＝**修闸**（案C 职责拆分），阈值取值属统计数值红线 → 人工 |
| 34 | P0-4 打包链路 `[x]` | `colony-p43-dress-20260918.md`（机器侧两步预演）＋ `colony-phaser-minify-diagnosis-20260923.md`（出包体积已知冗余） | **「0.9.0 三件套」失效**：`dist-out/` 现 `邦国录-0.10.0-x64.exe`／`-portable-x64.exe`／`win-unpacked/`，`package.json:3` = **0.10.0** | 链路本身在世（`electron-builder.yml:6 output: dist-out`、`:33 icon: resources/icon.ico` 复算 ✓）→ 版本号刷新即可 |

**P0 段建议归档行（:28，可粘贴；⚑ 数值不手改）**
`- [x] **P0-1 无头模拟已落地**（sandboxSimulation.test，顶层 describe 同名）：720 日贪心可推进。⚠ 本行为 2026-08 快照，读数随 harness 漂移——现值与跑法见 docs/insights/c927-18-multiseed-econ-sampling.md（在册基线 2 files/5 tests passed），指标口径分族见 c927-33。校准发现 1／2 两条已移交 P2-2 与 docs/design/wood-outlet-design-20260922.md。`

---

## 4. 三栏清单 · P1 段（:38-:43，6 条）｜整段已被 c924-34 接管

| 行 | 条 | ①覆盖 | ②锚点失效 | ③仍有效 |
|---|---|---|---|---|
| 38 | P1-1 类型化事件面 `[x]` | `colony-p1-premerge-verify-20260924.md` §4.2 备有改写行 | **「50 个事件全覆盖」失效 +5**：本单三轨独立复算 `GameStateEventMap` **55** / `STATE_EVENT_NAMES` **55** / `gameStore.ts STATE_EVENTS` **55**，差集为空（与 c924-34 同数） | 契约本体在世（`stateEvents.test.ts` 在盘） |
| 39 | P1-2 registry key 类型化 `[x]` | c924-34 §4.1「P1 六行里唯一证据一字未漂」＋ `colony-registry-keys-20260913.md` | **无**。本单逐字复算：`registry.ts:29` = `export const REGISTRY_KEYS = {` ✓、`:86` `registryGet` ✓、`:91` `registrySet` ✓、`registry.test.ts` 在盘 ✓、文件 99 行 ✓ | 无 |
| 40 | P1-3 tickDay 管道 `[x]` | c924-34 §4.2（已改成"内容定位不写行号"） | **「gameStore.ts:54/939」半失效**：`:54` import ✓；`:939` 现读为 `  }`（既非调用也非注释），真实调用点 **`:961`** `runDayPipeline(buildDayPipeline({` ⇒ c924-34 记的 `:948` **两日内再漂 +13** | 本体在世（`dayPipeline.ts:52` `DAY_PHASE_DEFS` ✓、118 行 ✓、`dayPipeline.test.ts` ✓） |
| 41 | P1-4 资产清单权威化 `[ ]` | **三份**：`docs/design/p1-4-manifest-authority-20260922.md`（c922-110 收口路径，零实施）＋ c924-34 §一/§二（四分法重排）＋ `colony-bootscene-runtime-test-design-20260923.md` | **BootScene 六锚点 5/6 漂**（本单复算，文件仍 103 行、未被再改）：`:46`→`    }`、`:53`→`    }`、`:57`→注释行、`:71`→event 循环体；唯 `:64` `getBootLoadList('general')` 逐字有效。**且「terrain 仍硬编码」整句过期**——`:51` 是 `for (const asset of TERRAIN_ART)` | **真残余三类**（本单复算行位在世）：scatter `:58-59` 键在 `data/scatterConfig`、audio `:77`/`:80` 两条循环 .mp3/.wav 不同构、building/general/event 的 `path` 字段未消费。前置＝audio 方案 A/B/C 待人工 |
| 42 | P1-5 启动配置清理 `[ ]` | `colony-startup-config-audit-20260917.md`（916p-a3-009，自写「全量复核已收口」）＋ c924-34 §三（三档措辞）＋ `colony-unreachable-recheck-20260922.md` | **两处**：①「本轮未做全量启动配置复核」**否证了一份已提交文档的结论**（c924-34 三条判据复算仍成立）；②「不可达模块已退役 **3 件**（git aad0592…）」**半真**——`aad0592` 在世（2026-09-13，标题即 `resourceSystem.ts` 退役），但那是 **1 档 1 commit**，另 2 件在别处退役 | 真缺面＝c924-34 §3.2 的 **G1–G6** 六个未覆盖面（preload／shared／main 分支级／vite loadEnv／`.env` 逐键／BootScene `introDone` 路由）。勾与不勾＝人工三档裁决 |
| 43 | P1-6 渲染职责拆分 `[x]` | c924-34 §4.1/§4.2 ＋ `colony-maprenderer-viewport-material-20260922.md` ＋ `colony-orphan-commit-precheck-20260922.md` | **「cameraMath.ts 79 行」失效**：`wc -l` = **90**（c922-19→c924-34→本单**三度同数**，稳定值就是 90） | 本体在世：`MapRenderer.ts:11`+`:12` 两条 cameraMath import 复算 ✓、`cameraMath.test.ts` ✓ ⇒ c924-34 的"内容定位、不写行数"仍适用 |

**P1 段处置建议**：**整段一次替换**，正文直接取 `colony-p1-premerge-verify-20260924.md` §4.2 六行草稿，只补两处本单的新读数——
`P1-3` 的调用点从「:948」改写成「以 `runDayPipeline(buildDayPipeline(` 内容定位」（草稿已是此写法，不必动）；
`P1-1` 的「55」本单独立复算与草稿同数，可直接采信。
> 冲突提醒（不重叠但要说清）：`colony-plan-ledger-20260922.md:49` 采信了 BACKLOG 的「未做全量复核」口径，与 9/17 档**互斥**——c924-34 §五#3 已把这条列为人工裁决项，本单不择一采信。

---

## 5. 三栏清单 · P2 段（:47-:56，10 条）

| 行 | 条 | ①覆盖 | ②锚点失效 | ③仍有效 |
|---|---|---|---|---|
| 47 | P2-1 新手引导 `[ ]` | `colony-onboarding-walkthrough-20260918.md`（c918-24，4 缺口）＋ `docs/design/tutorial-steps-design-20260922.md`（c922-119 15 分钟动线补步稿）＋ `colony-intro-backflow-decision-20260922.md`（c922-121 单向门三落点**不打包裁决**） | 行内无锚点。⚠ 但 c922-19 纠过走查档的「仅 1 个 step」：本单复算 `tutorial.ts` = **37 行 / 3 个 step**（`:9/:19/:29`）⇒ 引数用 3 别用 1 | **真未做**：`git log --since=2026-09-22 -- src/renderer/data/tutorial.ts` **零命中** ⇒ 设计稿一行未实施。建议拆「走查（已落档）／补动线（未做）」 |
| 48 | P2-2 本轮收尾 `[x]` | `docs/design/wood-outlet-design-20260922.md`（c922-105 薪炭/建材出口，**零数值落地**）＋ `colony-saturation-calibration-plan-20260920.md` ＋ `colony-econ-params-audit-20260918.md` | 「木材上限是模拟偏差、真实玩家建宫殿后自然回落」这一**判断**被本批采样否证：`c927-18` 现值 `saturatedResources:["wood"]`、wood **9999** 仍饱和 ⚑（只登记口径，不判平衡） | 残余＝薪炭/建材出口未实施（`git log --since=2026-09-22 --grep=炭\|charcoal` 零命中） |
| 49 | P2-2 追加（农田）`[x]` | 同 :48；`colony-backlog-dup-ids-20260917.md` §二（P2-2 **三行重号**） | 「终局粮 0→4、人口 38→39」是**过程中间态**，已被 :50 与 c927-18 现值（117 / grain 9894）双双取代 ⚑ | 无 → 建议归档为历史记录（或三行合一） |
| 50 | P2-2 中期失衡 `[x]` | `c927-18-multiseed-econ-sampling.md`（现值出处）＋ `c927-20-pop-pressure-sample-design.md`（万级人口压力样本，**设计级、未实施**） | 「人口 38→92、终局粮 0→204、第 34 天晋城邑」三读数均非现值 ⚑ 红线：本单不判哪个对，只写「引用须取最近一次 stdout」 | 结构性结论仍有效：`c927-20` §0 明写压力样本**未做**（需构造 save 注入或放宽 cap，属写码需放行） |
| 51 | P2-3 操作反馈 `[ ]` | **`colony-p23-batch1-20260922.md`（c922-106）：明文判「P2-3 实质工作已全部落地，`:51` 的 `[ ]` 属关单动作缺失而非工作量缺失」** ＋ `colony-p23-hooks-map-20260919.md`（旧缺口表，须带 AudioManager 面才成立） | 旧表「五类全缺／场景层音效 0」**过期**：其后 `51f46ed`（危机）／`4ecc2b6`（资源不足）／`4699166`（完工·晋升）三笔均已落地（本单 `git cat-file -t` 三 commit 全在世） | 唯**真残余＝关单动作本身** ＋ A-8 Juice 走查。监听面复算：`src/renderer/ui/AudioManager.ts:31` onPlaced→`sfx_place`、`:35/:36` warn、`:39` 晋/降格 **全中** ⇒ **建议直接勾 `[x]`** |
| 52 | P2-4 可读性复扫 `[x]` | c922-19 §三 ＋ `colony-shared-visual-constants-20260913.md` | **「11 色板」本身仍准**（本单复算 `src/shared/palette.ts`：`COLORS` **11** 键、`COLORS_HEX` **12** = 11+`INK_SMALL`，与 `paletteGuard.test.ts` describe 逐字一致）。**行内漏了一处搬家**：`src/renderer/ui/palette.ts` 现是 **13 行再导出 shim**，真源已下沉 `src/shared/palette.ts`（c923-26） | 守护在世（`paletteGuard.test.ts` 扫 `ui`＋`scenes` 两层，本单读源码确认）→ 只补一句搬家指针 |
| 53 | P2-5 双轴民心 `[x]` | `colony-econ-params-audit-20260918.md` ＋ 本批 `c927-31-wrath-countdown-adjudication.md`（怨怒倒计时改法，直接续在 A1 上） | 行内无数可复算。commit `87a79b2` 在世 ✓ | 残余＝c927-31 的改法属待裁决（未在本行范围内勾） |
| 54 | P2-6 阶层需求环 `[x]` | `colony-modifier-zeroconsumer-census-20260923.md` ＋ `colony-modifier-consumption-design-20260924.md`（需求→产出乘子的**消费面普查与处置稿**已在册） | commit `3b69834` 在世 ✓；行内无数 | 无（处置稿属另立条目，不属本行） |
| 55 | P2-7 组合/邻接加成 `[x]` | c922-19（未列此行为过期项） | **无——本单主动复核后维持原数**：`buildings.ts` 的 `adjacencyBonus:` 定义块实测 **8** 条（规则条目 9 个花括号），与行内「8 条规则」吻合；消费侧 `productionSystem.ts:82/85` 逐条遍历 ✓；`ui/BuildingPopover.ts` 在世 ✓ | 无 |
| 56 | P2-8 列国警惕值 `[x]` | commit `710af94` 在世 ＋ 本批 `c927-16-population-dual-source-adjudication.md`（**partial**，人口/张力双源消歧已登记但未结） | 行内「0–100 张力闸门（≥70 强档合纵）」本单**未在 `diplomacySystem.ts` 取到同名字面**（`警惕` 中文串零命中，代码用 `tension`）⇒ 属**措辞与实现命名不同构**，非失效；不深判（数值阈值红线） | 残余＝c927-16 的双源裁决未收口 |

---

## 6. 三栏清单 · P3 段（:60-:68，9 条）＋ P4 段（:72-:74，3 条）

| 行 | 条 | ①覆盖 | ②锚点失效 | ③仍有效 |
|---|---|---|---|---|
| 60 | P3-1 建筑美术覆盖 `[ ]` | `colony-manifest-portraits-orphan-20260922.md`（c922-109，只出材料不删件）＋ `colony-portraits-orphan-triage-20260924.md`（c924-35 差异表＋四出口）＋ `colony-art-full-20260919.md` | **「已清理 28 个 `manifest_*.json`」不实**：`18f92a8`（commit 标题即「清理 28 个 manifest 生成残留」）实删 **28 文件 = 21 json + 7 png**，把文件数当 json 数；且 portraits 类**从未进清理范围**——本单复算 `git ls-files public/art \| grep -c manifest_` = **4**（全为 `manifest_portraits_<ts>.json`） | **主数逐位复算全中、不必改**：`id: 'bld_` **35**、`public/art/buildings/*.webp` **33**、`.png` **0**、`artManifest.ts:28` `NO_OWN_ART = {bld_tin_mine, bld_hemp_field}` **2**。真残余＝**麻田/锡矿 2 图仍未补**（`ls public/art/buildings \| grep -E 'tin_mine\|hemp'` **零命中**）＋ 4 枚 portraits 孤儿待人工 |
| 61 | P4-1（错置于 P3 段）`[x]` | `colony-backlog-dup-ids-20260917.md` §二（判本行**错置**：发行说明属 P4 域，应与 :72 合并）＋ c922-19 §二#9 | 无。README 在世，且已从 c922-19 记的 4,489 B 增至 **5,160 B**（本单 `wc -c`） | 无 → 建议**整行移入 P4 节**，与 :72 合并 |
| 62 | P3-2 插画/立绘覆盖 `[ ]` | `colony-p32-closure-20260918.md`（s918-14：明文「P3-2 可通过闭单」，给的就是 `:62 [ ]→[x]`，当时以「backlog 属并发在途 M 域」未落笔）＋ `docs/design/evt-art-wiring-20260922.md`（c922-113 零引用三键接线稿） | **口径差 1 未归因**：s918-14 记「渲染层实际引用 evt_art **6** 键」，`artManifestEvtArtUsage.test` 是「静 4＋动 3＝**7**」⇒ 两数**不可互换引用**（本单未深挖） | 钉桩已在世且可复算：守护 **3** 枚 `artManifest.test.ts`／`artManifestEvtArtUsage.test.ts`／`artManifestReuse.test.ts` ＋ `bootLoadList.test.ts`；`generals/` **5**、`terrain/` **5**、`events/*.webp` **10**（本单实测与行内 5/5、10/10 一致）→ 建议勾 ＋ 残余（3 零引用键／4 portraits 孤儿）另立 |
| 63 | P3-3 地形与 UI 皮精修 `[ ]` | `colony-font-chain-gap-20260922.md`（c922-111：三处 `@font-face` 指向**空目录** `public/fonts/`，全部 UI 实际走系统字体，且"补 otf 单独做也不生效"）＋ `colony-terrain-naming-inventory-20260921.md`／`colony-terrain-ab-equal-20260922.md` | 行内无锚点（判据本身是「单帧不判小作坊」的人审截图，无文件锚） | **真未做 ＋ 新增一条在档缺口（字体链）**。⚑ 质感判定本单不代判 |
| 64 | P3-4 文案校对 `[x]` | `colony-hardcoded-copy-units-audit-20260925.md`（9/25 批，文案面续单） | 无（`src/renderer/state/__tests__/copyBias.test.ts` 在盘 ✓） | 无 |
| 65 | P3-5 加工链纵深 B3 `[x]` | `docs/design/wood-outlet-design-20260922.md` ＋ `colony-econ-params-audit-20260918.md` | 「金币饱和 9999→8780」为当时读数 ⚑ 现值 gold **6052**／saturated 仅 `["wood"]`（出处 c927-18，本单不取新数） | 「木材仍饱和、待加薪炭/建材出口」——`wood-outlet` 设计稿**零数值落地** ⇒ 残余有效 |
| 66 | P3-6 影响力资源 B2 `[x]` | 本批 `c927-17-building-modifier-semantics-register.md`（修饰符语义登记，含名望类消费面） | 行内「存档 v5→v6 迁移」作历史动作成立；**隐含的"当前 schema"已至 v9**（`saveLoad.ts:19`）⇒ 若有人把本行当现状引会错 | 无 |
| 67 | P3-7 古迹事件链 C1 `[x]` | 本批 `c927-28-relic-timeout-adjudication.md`（**遗物超时三案**＝直接续在 C1 上，只出稿未实施） | 同上 v6→v7 属历史；本行无数漂 | 残余＝c927-28 三案待人工（不属本行勾选范围） |
| 68 | P3-8 终局危机升级 C2 `[x]` | `colony-b152-close-20260922.md` ＋ 本批 `c927-11`（事件 random 值域）／`c927-37`（事件值普查）——终局波次的随机取值面已被这两枚普查 | 行内「存档 v7→v8 迁移」历史成立；现值 v9（同 :66） | 本体在世：`src/renderer/state/endgameEscalation.ts` ＋ `__tests__/endgameEscalation.test.ts` 复算在盘 ✓ |
| 72 | P4-1 发行说明/README `[ ]` | `colony-p4-docs-audit-20260922.md`（c922-124：FRIEND_GUIDE × PLAYTEST_CHECKLIST 对 v0.10 现状逐段对账）＋ c922-19 §二#9 ＋ `colony-backlog-dup-ids-20260917.md` §三 | 🔴 **本单否证掉 c922-19 的一条**：其「全档 `grep -c 分发` = 0 ⇒ 分发说明**确无载体**」已过期——`README.md:73` 现明文写「键位口径与 `docs/design/FRIEND_GUIDE.md` 小抄段一致（c922-124 订正）」，`docs/design/FRIEND_GUIDE.md`（「给朋友的三分钟上手」）**实盘在世** ⇒ 载体已补上。同时 `dist-out/` 已有 `邦国录-0.10.0-发朋友.zip` 与 `发朋友-v0.10.0/` 两枚分发物 | 残余要重写＝**"分发渠道／版本更新告知"这一格仍空**（上手文档有、发布渠道无）。结构问题不变：与 :61 **同编号双条、一勾一未勾** ⇒ 任何"未勾计数"虚高 1。建议：删本行或改勾并指向 :61 |
| 73 | P4-2 版本与图标 `[ ]` | c922-19 §二#10 ＋ `colony-build-size-20260920.md` | 客观部分**全部仍就位**（本单复算：`package.json:3` = 0.10.0；`resources/icon.ico` **370,070 B / Aug 14** 未变；`electron-builder.yml:19`（files）与 `:33`（win.icon）双引 ✓）⇒ 无失效锚点 | 残余＝①图标"最终态"属人审 ⚑ ②0.10.0 包是 **Aug 14** 出的，其后 src 已落 **212** 笔提交 ⇒ 与 P4-3 绑定 |
| 74 | P4-3 终检 `[ ]` | `colony-p43-dress-20260918.md`（机器侧两步 9/19 预演双 `EXIT=0`）＋ `colony-phaser-minify-diagnosis-20260923.md`（出包含 6.78 MB 未 minify phaser＝已知冗余）＋ `colony-optibacklog-status-draft-20260922.md` §二#11 | c922-19 的「末次出包 Aug 14」本单复算**仍成立**（`ls -la --time-style` 读数 2026-08-14 01:51）⇒ 该行未失效；但行内**没写出包前置＝minify**，属欠精确 | **真未做**：重跑 `build` + `electron:build:win`、一轮完整人工走查（`docs/design/PLAYTEST_CHECKLIST.md` 是载体、无填写记录）。⚑ 本波纪律禁子班跑全量／出包，读数须由主班收班取 |

---

## 7. 建议归档行汇总（主班一次性合入用）

**分档**（每档给动作，不重叠）：

| 档 | 动作 | 行 | 条数 |
|---|---|---|---|
| A | **可直接勾**（在档结论已明文判"关单动作缺失"） | `:51` P2-3 | 1 |
| B | **整段替换**（用 c924-34 §4.2 六行稿） | `:38`–`:43` P1 全段 | 6 |
| C | **只刷新数字/版本**（不涉及裁决，机器可判） | `:6` 基线、`:24` 双挂去重、`:32` v8→v9 与 45→49、`:34` 0.9.0→0.10.0、`:38` 50→55（含在 B 内）、`:43` 79→90（含在 B 内）、`:52` 补色板搬家指针 | 5（扣与 B 重叠的 2） |
| D | **只加时效注、数值不许手改**（⚑ 经济平衡红线） | `:28`、`:48`、`:49`、`:50`、`:65` | 5 |
| E | **结构整改**（重号／错置／删行） | `:24`（与 :28 重号）、`:48/:49/:50`（P2-2 三行重号）、`:61`↔`:72`（P4-1 同编号双条且 :61 错置） | 3 组 |
| F | **交人工裁决，本单不代判** | `:33` 修闸阈值、`:41` audio 方案 A/B/C、`:42` P1-5 三档措辞、`:60` portraits 删件或改生成器、`:62` 3 个零引用 evt_art 键、`:63` 皮面质感、`:73` 图标终态、`:74` 出包放行 | 8 |
| G | **保持未勾、仅改写残余项** | `:47`、`:62`、`:72`、`:74` | 4 |

**可直接粘贴的三条（不与他档冲突、A/C/E 各一）**

A（`:51`）：
`- [x] **P2-3 操作反馈**：五类反馈已全部接线——危机（c919-03a \`51f46ed\`）、资源不足（c919-03b \`4ecc2b6\`）、完工·晋升脉冲＋飘字（c920-13 \`4699166\`）、建筑放置与晋/降格音效（\`src/renderer/ui/AudioManager.ts\` 的 store 监听面，内容定位不写行号）。核对出处 docs/insights/colony-p23-batch1-20260922.md（判：未勾属关单动作缺失）。残余＝A-8 Juice 主观手感走查，并入 P4-3。`

C（`:32`）：
`- [x] **P0-2 存档兼容性回归**（2026-08-14 第 2 轮）：v1/v2 fixture 全链迁移到**当前 schema（本单实测 \`SAVE_SCHEMA_VERSION = 9\`，migrations 1..8 档齐）**逐段断言 + 越版本报错，saveLoad **49** 条用例。⚠ 版本号随每次 bump 漂移，引数请现取 \`src/renderer/state/saveLoad.ts\` 顶部常量（c927-40 刷新）。`

E（`:24`）：
`- [x] **P0-1 无头 8 小时沙盒模拟**：落地与读数记在下一条（\`src/renderer/state/__tests__/sandboxSimulation.test.ts\` 顶层 describe 同名，2 例 = 720 日贪心 / 720 日均衡）。重号整改沿 docs/insights/colony-backlog-dup-ids-20260917.md §三 的口径。`

---

## 8. 证据（本单自己跑的命令，非转抄）

```
$ wc -l docs/design/OPTIMIZATION_BACKLOG.md                       → 81
$ git diff --stat docs/design/OPTIMIZATION_BACKLOG.md             → 10 ++++, 5 insertions(+), 5 deletions(-)
$ git diff docs/design/OPTIMIZATION_BACKLOG.md | sha256sum        → 08538b686d9b3e9c66fc70ebe388c56e46c819436bec7983a82f5c986c15623c  ← 与 c924-34 §六收班值逐字相同 ⇒ 该在途件自 9/25 起未再被改
$ grep -c '^- \[x\]' docs/design/OPTIMIZATION_BACKLOG.md           → 22
$ grep -c '^- \[ \]' docs/design/OPTIMIZATION_BACKLOG.md           → 11
$ grep -n '^- \[ \]' docs/design/OPTIMIZATION_BACKLOG.md | cut -c1-3  → 24/41/42/47/51/60/62/63/72/73/74

$ sed -n '29p;86p;91p' src/renderer/ui/registry.ts                → 三行分别为 REGISTRY_KEYS / registryGet / registrySet（逐字中）
$ wc -l src/renderer/ui/registry.ts                               → 99
$ ls src/renderer/ui/__tests__/registry.test.ts                    → 存在
$ sed -n '52p' src/renderer/state/dayPipeline.ts                   → export const DAY_PHASE_DEFS ...（中）
$ grep -n "buildDayPipeline\|runDayPipeline" src/renderer/state/gameStore.ts → 54: import ／ 961: runDayPipeline(buildDayPipeline({
$ sed -n '939p' src/renderer/state/gameStore.ts                    → "  }"（非调用点 ⇒ 行内锚失效）
$ wc -l src/renderer/render/cameraMath.ts                          → 90（行内写 79）
$ sed -n '11p;12p' src/renderer/render/MapRenderer.ts              → 两条 cameraMath import（中）
$ wc -l src/renderer/scenes/BootScene.ts                           → 103
$ sed -n '44p;46p;51p;53p;57p;58p;59p;64p;70p;71p;77p;78p;80p;81p' src/renderer/scenes/BootScene.ts
  :44 for (const item of getBootLoadList('building'))  :46     }        ← 行内 :46 落在闭括号
  :51 for (const asset of TERRAIN_ART)                 :53     }        ← 行内 :53 落在闭括号，且 terrain 已派生
  :57 // …c921-01 报告第四节已登记）                     :58 for (const id of SCATTER_IDS)   ← 行内 :57 是注释
  :64 for (const item of getBootLoadList('general'))                       ← 六锚点唯一逐字有效
  :70 const name = asset.key.startsWith('evt_art_')…   :71 this.load.image(asset.key, `art/events/${name}.webp`)
  :77 for (const key of ALL_BGM_KEYS)  :78 .mp3        :80 for (const key of SFX_KEYS)  :81 .wav
$ git status --porcelain src/renderer/scenes/BootScene.ts          → 空（工作树＝HEAD）

$ python（事件面三轨计数）GameStateEventMap keys: 55 / STATE_EVENT_NAMES: 55 / STATE_EVENTS entries: 55 / diff: set()
$ grep -c "^  it(" src/renderer/state/__tests__/saveLoad.test.ts   → 49（行内写 45）
$ grep -n "SAVE_SCHEMA_VERSION =" src/renderer/state/saveLoad.ts   → 19: export const SAVE_SCHEMA_VERSION = 9;（行内写 v8）
$ python（migrations 档位）→ ['1','2','3','4','5','6','7','8']
$ grep -n "P0-1 无头 8 小时沙盒模拟" src/renderer/state/__tests__/sandboxSimulation.test.ts → 2: 注释、245: describe
$ grep -c "^  it(" src/renderer/state/__tests__/sandboxSimulation.test.ts → 2

$ grep -c "id: 'bld_" src/renderer/data/buildings.ts               → 35
$ ls public/art/buildings/*.webp | wc -l                           → 33
$ ls public/art/buildings/*.png | wc -l                            → 0
$ grep -n "NO_OWN_ART" src/renderer/data/artManifest.ts | head -1  → 28: const NO_OWN_ART = new Set(['bld_tin_mine', 'bld_hemp_field']);
$ ls public/art/buildings/ | grep -E "tin_mine|hemp"; echo rc=$?   → 无输出，rc=1（2 图仍未补）
$ git ls-files public/art | grep -c manifest_                      → 4
$ ls public/art/generals/ | wc -l  → 5 ／ terrain → 5 ／ events/*.webp → 10
$ ls src/renderer/data/__tests__/ | grep -i artmanifest            → artManifest / artManifestEvtArtUsage / artManifestReuse（＋ bootLoadList.test.ts）

$ python（邻接）'adjacencyBonus:' 定义块 = 8 ／ 规则条目 = 9
$ grep -n "adjacencyBonus" src/renderer/state/productionSystem.ts  → 82 早退、85 for (const rule of selfDef.adjacencyBonus)
$ ls src/renderer/ui/ | grep -i popover                            → BuildingPopover.ts
$ grep -c "comboRules" src/renderer/data/buildings.ts               → 0（⇒ 初读"8 条查无此件"作废，真字段名是 adjacencyBonus）

$ python（色板）COLORS keys: 11 ／ COLORS_HEX keys: 12（= 11 + INK_SMALL）
$ wc -l src/renderer/ui/palette.ts                                  → 13（c923-26 再导出 shim，真源 src/shared/palette.ts）
$ grep -n "11 色板" src/renderer/ui/__tests__/paletteGuard.test.ts   → 8、24（describe/it 与行内措辞一致）

$ for h in 5758d9a 54eafe9 7c1b3c6 2a04165 87a79b2 3b69834 710af94 aad0592 18f92a8 51f46ed 4ecc2b6 4699166; do git cat-file -t $h; done
  → 全部 commit（12/12 在世；aad0592 标题＝「chore(assets): h912-14 resourceSystem.ts 不可达」2026-09-13）
$ grep -n "onPlaced\|sfx_gong\|sfx_warn" src/renderer/ui/AudioManager.ts → 31/33/35/36/39（监听面在世）
$ ls resources/icon.ico 大小                                       → 370070 B, Aug 14
$ grep -n '"version"' package.json                                 → 3:  "version": "0.10.0",
$ grep -n "output\|icon" electron-builder.yml                       → 6: output: dist-out ／ 19、33: resources/icon.ico
$ ls -la --time-style=+%Y-%m-%d_%H:%M dist-out/                     → 邦国录-0.10.0-x64.exe 230976170 B 2026-08-14_01:51
                                                                      邦国录-0.10.0-portable-x64.exe 2026-08-14_01:51
                                                                      win-unpacked/ 2026-08-14_01:51
                                                                      邦国录-0.10.0-发朋友.zip 2026-08-14_01:43 ／ 发朋友-v0.10.0/ 2026-08-14_01:30
$ git rev-list --count --since=2026-08-15 HEAD                      → 212
$ wc -c README.md                                                   → 5160
$ grep -n "^## " README.md                                          → 10 个二级节（技术架构/环境要求/启动/打包/玩法与系统/操作速查/验证与质量/已知待办/文档/目录）
$ grep -n "FRIEND_GUIDE" README.md                                  → 73: 「键位口径与 docs/design/FRIEND_GUIDE.md 小抄段一致（c922-124 订正…）」  ← 否证 c922-19 的"分发无载体"
$ head -1 docs/design/FRIEND_GUIDE.md                               → # 邦国录 · 给朋友的三分钟上手
$ git log --oneline --since=2026-09-22 -- src/renderer/data/tutorial.ts docs/design/tutorial-steps-design-20260922.md → 空（补步稿未实施）
$ grep -n "id: 'tut" src/renderer/data/tutorial.ts                  → 9/19/29（3 步）／ wc -l → 37
$ find src -name "*.test.ts" | wc -l                                → 156
```

**覆盖证据引用计数（判据②要 ≥10，本单实际引 22 份）**：
`colony-optibacklog-status-draft-20260922`／`colony-p1-premerge-verify-20260924`／`colony-backlog-dup-ids-20260917`／`colony-startup-config-audit-20260917`／`colony-unreachable-recheck-20260922`／`colony-p23-batch1-20260922`／`colony-p23-hooks-map-20260919`／`colony-p32-closure-20260918`／`colony-onboarding-walkthrough-20260918`／`colony-intro-backflow-decision-20260922`／`colony-font-chain-gap-20260922`／`colony-manifest-portraits-orphan-20260922`／`colony-portraits-orphan-triage-20260924`／`colony-p4-docs-audit-20260922`／`colony-p43-dress-20260918`／`colony-phaser-minify-diagnosis-20260923`／`colony-build-size-20260920`／`colony-test-baseline-20260921`／`colony-econ-params-audit-20260918`／`colony-modifier-consumption-design-20260924`／`colony-shared-visual-constants-20260913`／`colony-registry-keys-20260913`
＋ 9/25 批与本轮卷宗结果件：`colony-hardcoded-copy-units-audit-20260925`／`colony-config-source-map-20260925`／`c927-11`／`c927-12`／`c927-16`／`c927-17`／`c927-18`／`c927-20`／`c927-24`／`c927-25`／`c927-27`／`c927-28`／`c927-31`／`c927-33`／`c927-37`／`c927-38`／`docs/design/p1-4-manifest-authority-20260922`／`docs/design/wood-outlet-design-20260922`／`docs/design/tutorial-steps-design-20260922`／`docs/design/evt-art-wiring-20260922`（合计 **42 份**载体、去重后 insight/design 档 **38** 份）。

---

## 9. 完成标准对照与遗留问题

| 判据 | 实测 | 判定 |
|---|---|---|
| ① 条目逐条三栏标注 | 全 33 条 checkbox（22 勾 + 11 未勾）**逐条**给 ①/②/③ 三栏，另加 §2 两条头部锚点（:5/:6）＝ 35 行；零"未覆盖"行 | **达成** |
| ② 覆盖证据引用 ≥10 条 | 实引 **22** 份 docs/insights ＋ 2 份 9/25 批 ＋ 16 份本批卷宗结果件/设计稿 ＝ §8 末列 42 项，每条带文件名 | **达成（22 ≥ 10）** |
| ③ 零改动 `OPTIMIZATION_BACKLOG.md` | 见 §10 | **达成** |
| 产出 `docs/insights/c927-40-optibacklog-health.md` | 本文件 | 达成 |

**遗留问题（如实）**

1. **本单未跑任何测试／type-check**（波次纪律：全量套件会自写 tracked 的 `colony-suite-timings-20260921.json`；定向跑也无必要——本单判据全是静态复算）。⇒ 全档"测试数"类现值一律引在档读数（c921-09 `colony-test-baseline-20260921`、c927-18），未自取。
2. **`:56` P2-8 的 0–100／≥70 阈值本单未复算**：`diplomacySystem.ts` 里 `警惕` 中文串零命中、实现用 `tension`，且阈值属**经济/平衡数值红线**，只登记"措辞与实现命名不同构"，不判数值。
3. **`:62` 的口径差 1（6 vs 7）未归因**：属对账族既有域（c922-19 §二#7 同记），本单不深挖，只钉"两数不可互换引用"。
4. **`:55` P2-7 的"9 个规则条目"与行内"8 条规则"差 1**：本单口径是"花括号条目数"，行内可能是"有 `adjacencyBonus` 的建筑数＝8"⇒ **本单采"8 条定义块"与行内一致**，9 那个数写明口径差异，不改档。
5. **索引未补**：`docs/insights/colony-insights-index-*.md` 是主班单点重建件，本单**未加行**（c924-34 §五#6、c922-19 §四同口径）。本文件因此在索引里暂时缺席，属既有状态。
6. **在途 diff 归属未由本单裁定**：5+/5− 的 P1 段改动是谁写的，本单只登记"sha256 与 9/25 时点相同、未再被改"，归属判定交 c927-41（同班第二单，专做在途件收口审计）。

---

## 10. 只读自证（收工复跑，与开工逐字对照）

```
$ git diff --stat docs/design/OPTIMIZATION_BACKLOG.md   # 收工
 docs/design/OPTIMIZATION_BACKLOG.md | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)        ← 与开工同
$ git diff docs/design/OPTIMIZATION_BACKLOG.md | sha256sum
08538b686d9b3e9c66fc70ebe388c56e46c819436bec7983a82f5c986c15623c  ← 开工值，逐字相同
$ wc -c docs/design/OPTIMIZATION_BACKLOG.md              → 10848（开工同数）
$ git status --porcelain                                 # 收工
 M docs/design/OPTIMIZATION_BACKLOG.md                   ← 外部在途，开工即脏
 M docs/insights/colony-dead-exports-20260914.json       ← 外部在途
 D docs/insights/colony-dead-exports-20260914.json.bak   ← 外部在途
 M docs/insights/colony-suite-timings-20260921.json      ← 外部在途（钩子自写件，本班未跑测试故未刷新）
?? docs/insights/c927-40-optibacklog-health.md           ← 本单唯一产物（本文件）
$ git status --porcelain -- src/                         → 空（src/ 与 HEAD 无差，本单未碰）
```

- **零 git 写操作**：本单未执行 `add`／`commit`／`stash`／`checkout`／`restore`／`clean`／`push` 任一。
- **未"顺手恢复"任何脏件**：上述 4 枚外部在途件一律照读、照引、不动。
- **临时件**：本单**未产生临时件**（全部结论由一次性命令读数直落本文件），故 `tmp/` 下无本班残留、仓根无临时件。
- **红线**：未读未改任何平衡参数与阈值；凡数值处一律"只登记口径差 + 指向在档出处"。
