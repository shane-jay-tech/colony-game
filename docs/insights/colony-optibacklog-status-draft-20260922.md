# colony OPTIMIZATION_BACKLOG 完成态逐行对账草稿（c922-19，2026-09-22，只读）

> **性质**：出稿不改档。`docs/design/OPTIMIZATION_BACKLOG.md` 是**他班在途件（工作树 `M`）**，本单按派单令**一个字未动**（收工 `git status` 该件仍为 `M` 且 diff 仍 5+/5−）。
> **用法**：每条形如「建议合入哪一行 → 可粘贴文本 → 为什么与实况不符 → 复算命令」。合入交主班/规划侧执行；**行号一律按 2026-09-22 02:2x 工作树（含他在途 P1 段改动）取，合入前须重取**。
> **判读四态**（沿用 c922-16 台账口径）：✅=建议打勾｜◐=建议半勾并加「现状」注｜○=维持未勾但须改写残余项｜⚑=本单不可判（需人审/试玩/联网/构建）。

## 一、总账（未勾 11 项逐条判定）

| # | 行号 | 项 | 判定 | 一句话依据 |
|---|---|---|---|---|
| 1 | 24 | P0-1 无头 8h 沙盒模拟（主项） | ✅建议勾或删 | 与 31 行 `[x] P0-1` 同事双挂；被测件在档（`sandboxSimulation.test.ts:245` describe 名即「P0-1 无头 8 小时沙盒模拟」） |
| 2 | 41 | P1-4 资产清单权威化 | ◐改残余项 | 行内点名的 terrain **已经**是 manifest 派生；真残余只有 scatter + audio（+ event 的 URL 侧） |
| 3 | 42 | P1-5 启动配置清理 | ✅建议勾 | 9/17 已做全量复核并落档，本单复核三判据仍成立（零命中/6 场景全注册/文档在 HEAD） |
| 4 | 47 | P2-1 新手引导完备性 | ◐拆两半 | 「走查」这半已完成且落档（c918-24 → insight），未做的是「补 4 缺口」；tutorial 实测只 3 步非 1 步 |
| 5 | 51 | P2-3 操作反馈 | ◐点名残余 | 5 类反馈里 4 类有接线提交，唯「完工/晋升」缺 toast/audio（提交自述），「建筑放置」只有音效无 toast |
| 6 | 60 | P3-1 建筑美术覆盖 | ○数字对但残留口径矛盾 | 35/33/2 实测逐位吻合；但「已清理 28 个 manifest_*.json」与 `public/art` 仍跟踪 4 个 `manifest_portraits_*.json` 冲突 |
| 7 | 62 | P3-2 插画/立绘覆盖核对 | ✅建议勾（附残余项另立） | 对账已由 4 个测试文件永久钉住（10 evt_art = 静 4+动 3+零引 3；generals 5/5 在盘） |
| 8 | 63 | P3-3 地形与 UI 皮精修 | ⚑不可判 | 判据是「单帧不判小作坊」的人审截图基线，无客观文件锚；本单不代判 |
| 9 | 72 | P4-1 发行说明 / README | ✅建议勾（或与 61 行去重） | 同编号一条已勾（61 行）一条未勾（72 行），根 `README.md` 4,489 B 实存含 v0.10.0 口径 |
| 10 | 73 | P4-2 版本与图标 | ◐拆半 | 版本号 0.10.0 与 `resources/icon.ico` 370,070 B 均就位；「最终态」属人审 ⚑ |
| 11 | 74 | P4-3 终检 | ○真未做（机器侧 9/19 预演双绿） | verify+build 曾双 EXIT=0（c918-27 在档），但 9/19 后未再跑、末次出包停 Aug 14，人工走查与分发包成型无证据 |

**加和自洽**：✅3 + ◐4 + ○2 + ⚑1 = 10，另 1 条（P0-1 主项）与 31 行重复故同判 ✅ → 未勾 11 项全覆盖，零遗漏。

## 二、逐条明细（建议合入文本）

### 1. 行 24｜P0-1 主项与行 31 重复挂账

> **前科在册**：本条**不是新发现**——`docs/insights/colony-backlog-dup-ids-20260917.md`（916p-a2-007）第二节已把重号 3 组（P0-1×2／P2-2×3／P4-1×2）全列，第三节已给整改口径「:24 翻 [x] 并注『已落地见 :28』」。**它给的行号现已漂**：完成注记行 :28 → 现 **:31**（P2-2 三行 :48-50 与 P4-1 两行 :61/:72 实测未漂）。 ⇒ 本条＝催办，不是取证。

- 现文：`- [ ] **P0-1 无头 8 小时沙盒模拟**（对应设计稿最大风险…）` + 3 个缩进子条（断言不变量/产出节奏数据）。
- 实况：同一件事在行 31 已有 `[x] P0-1 无头模拟已落地`，且**测试文件顶层 describe 名就是主项原标题**。
- 建议：勾上并加指针，或删主项只留 31 行。可粘贴：
  `- [x] **P0-1 无头 8 小时沙盒模拟**：落地与读数记在下条（同名 describe 见 src/renderer/state/__tests__/sandboxSimulation.test.ts:245，2 例=720 日贪心 / 720 日均衡产布）。`
- 注意（**本单不动**）：主项 4 条不变量里「失败低谷可翻身」是否各成断言，需读 245-283 断言体；该文件挂着终局精确值锚（gold 6052 / grain 9894 / milestone day41），属**经济平衡数值红线**，本单只读存在性不读结论。

```
$ git grep -n "P0-1 无头 8 小时沙盒模拟" -- src/renderer/state/__tests__/sandboxSimulation.test.ts
src/renderer/state/__tests__/sandboxSimulation.test.ts:245:describe('P0-1 无头 8 小时沙盒模拟', () => {
src/renderer/state/__tests__/sandboxSimulation.test.ts:246:  it('720 日贪心经营：…')
src/renderer/state/__tests__/sandboxSimulation.test.ts:266:  it('720 日均衡经营（产布策略）：…')
```

### 2. 行 41｜P1-4 的「terrain 仍硬编码」已过期（与 c922-16 同判，本单独立复算）

> **错误源可追溯（漂移链，合入方必读）**：`colony-backlog-dup-ids-20260917.md:32` 第四节白纸黑字写「BootScene.ts terrain/scatter/audio 仍为硬编码清单（:53/:57/:71）」——**在 9/17 当时成立**（terrain 改由 manifest 派生是 c918-04/05 之后落地的，见 BootScene.ts:49-50 的行内注释「清单改由 manifest 派生…（B-139 销项）」）；9/21-22 他在途把它原样抄进 P1-4 的「现状」注 ⇒ 一处过期结论经两次转抄变成今天的台账错账。**教训＝P1 段每条引 BootScene 行号者都须重测**。

- 现文：`… terrain/scatter/audio 仍为硬编码清单（BootScene.ts:53/57/71），故未收口`。
- 实况：`BootScene.ts:6` 从 `../data/artManifest` 导入 `EVENT_ART, TERRAIN_ART, getBootLoadList`；terrain 循环在 **:51-53**（`for (const asset of TERRAIN_ART) this.load.image(asset.key, asset.path)`）⇒ **manifest 派生**，且其行注释自证「清单改由 manifest 派生…（B-139 销项）」。真残余只有 **scatter**（:58-60 用 `../data/scatterConfig` 的 `ALL_SCATTER_IDS` + 模板 URL，manifest 无 scatter 类目）与 **audio**（:77-82 硬编码 BGM/SFX 键）。另有一处行内未提的半个残余：**event 侧键来自 manifest（:70）但 URL 由本地模板 `art/events/${name}.webp` 拼（:71-72），即 path 不来自 manifest**。
- 建议可粘贴：
  `- [ ] **P1-4 资产清单权威化**：BootScene 以 artManifest 为唯一加载源。（现状 2026-09-22 复算：building/general/terrain/event 四类目的**键清单**均已 manifest 派生（BootScene.ts:44/51/64/70）；残余三处＝scatter 清单另起于 data/scatterConfig（:58-60）、audio 键全硬编码（:77-82）、event 与 scatter 的 URL 用本地模板拼而非 manifest.path（:59/:71-72）。已排单 c922-110 同域）`
- 依据（逐行，双路互证 `git grep` + `sed -n`）：

```
$ git grep -n "TERRAIN_ART\|SCATTER_IDS\|load.audio" -- src/renderer/scenes/BootScene.ts
:5:import { ALL_SCATTER_IDS as SCATTER_IDS } from '../data/scatterConfig';
:6:import { EVENT_ART, TERRAIN_ART, getBootLoadList } from '../data/artManifest';
:51:    for (const asset of TERRAIN_ART) {        :52:  this.load.image(asset.key, asset.path);
:58:    for (const id of SCATTER_IDS) {           :59:  this.load.image(`scatter_${id}`, `art/scatter/${id}.webp`);
:77/:80  for (const key of ALL_BGM_KEYS|SFX_KEYS) { this.load.audio(...) }
```

### 3. 行 42｜P1-5「本轮未做全量启动配置复核」与在档结论相反 → 建议勾

- 现文（此半句是**他在途 diff 新加**的）：`（现状：不可达模块已退役 3 件（git aad0592 + docs/insights/colony-unreachable-resourceSystem-20260912.md）；本轮未做全量启动配置复核）`
- 实况：**全量复核已于 2026-09-17 做完并落档** `docs/insights/colony-startup-config-audit-20260917.md`（916p-a3-009，链路 8 文件逐个 rg 命中数 + 结论「启动配置全量复核已收口」）。该文件在 HEAD 里（`git ls-files` 命中）。本单独立复算三条判据仍成立：退役件在 `src/**`（排除测试）**零命中**、6 个场景全部在 `main.ts:52` 注册、无「仅测试可达」场景。
- 建议可粘贴：
  `- [x] **P1-5 启动配置清理**：接线或删除不可达的启动配置分支（PLAN 工作项 2 末条）。（不可达模块退役 3 件＝aad0592；全量复核已于 2026-09-17 收口，见 docs/insights/colony-startup-config-audit-20260917.md：链路 8 文件全可达、退役件零命中。2026-09-22 c922-19 复核：6 场景在 main.ts:52 全注册，git grep 退役名非测试面零命中）`
- 出口提示：若合入方坚持「本轮」指 9/22 这一浪，则应改写为「复核已于 9/17 收口」而非「未做」——两种改法都成立，但**现文那句是过期陈述**（它否定了一份已提交文档的结论）。

### 4. 行 47｜P2-1：走查已做、补缺口未做 → 半勾

- 现文：`序章教学 + JIT + 典册三件套走查，补「第一局 15 分钟能自解释」的缺口。`
- 实况：前半（走查）已完成并落档 `docs/insights/colony-onboarding-walkthrough-20260918.md`（c918-24 材料单），给出 4 条缺口 + 优先级；后半（补）未做。三件套本体在位且有测试：`data/tutorial.ts`、`data/jitHints.ts`、`ui/CodexPanel.ts`、`ui/TutorialModal.ts`、`ui/JitHintManager.ts`，测试 `ui/__tests__/TutorialModal.test.ts`、`ui/__tests__/CodexPanel.test.ts`、`data/__tests__/jitHints.test.ts`。
- **顺带纠走查报告的引数表述**（不是判错方向）：它写「TUTORIAL_STEPS 只覆盖授田单步（grep 全文件仅 1 个 step id `tut_grant_field` 前缀的连续步）」——实测 `tutorial.ts` 全文 37 行、**3 个 step id**（`tut_grant_field` :9 / `tut_wait_grain` :19 / `tut_population_5` :29），按字面「仅 1 个」是低的；但它「覆盖止于开局首步、后续动线缺失」的实质结论**成立**（3 步远够不上「第一局 15 分钟自解释」）。 ⇒ 引数改钉「3 步、末步止于人口 5」，别再用「1 步」。
- 建议可粘贴：
  `- [ ] **P2-1 新手引导完备性**：◐走查已落档（c918-24 → docs/insights/colony-onboarding-walkthrough-20260918.md，4 缺口），未做＝补动线。现状 tutorial.ts 37 行 / 3 个 step（:9/:19/:29），需补「授田→建屋→首日结算→调速」连续动线；典册与 JIT 无联动、IntroScene 无跳过回流（后两条属产品裁决）。`

### 5. 行 51｜P2-3：四类已接线、残余可点名 → 半勾

> **既有盘点件已部分过期（引数前必读）**：`docs/insights/colony-p23-hooks-map-20260919.md`（s918-13）当时给的五类事件缺口矩阵是「**全部缺反馈钩子**、GameScene+UIScene 音效调用＝0」。两处失真：①**时点**——其后的 `51f46ed`（危机）/`4ecc2b6`（资源不足）/`4699166`（完工·晋升）三个接线提交把它的一半结论推翻；②**口径**——它只 grep 两个场景文件，而 `AudioManager.ts:31/35/36/39` 的 `onPlaced`→`sfx_place`、`onDefenseAlert`/`onUltimatum`→`sfx_warn`、晋格/降格→`sfx_gong`/`sfx_warn` 是**事件监听面**接线（且 :34 注释自证 2026-06-19 就在），所以「建筑放置零音效」「晋升零音效」是口径造成的假缺口。 ⇒ 后续班次引这份矩阵必须补 AudioManager 面，或直接改用本表。

| 反馈类（行内枚举） | 接线证据 | 缺口 |
|---|---|---|
| 资源不足 | commit `4ecc2b6`（c919-03b）`GameScene.toastFailure` → `sfx_warn`（GameScene.ts:508/522） | — |
| 危机时刻 | commit `51f46ed`（c919-03a）UIScene `onCrisisTriggered` 告急 toast | — |
| 国格晋升 | AudioManager.ts:39 ascend→`sfx_gong`/降格→`sfx_warn` | 完工/晋升侧 **无 toast/audio**（commit `4699166` 自述如实留痕） |
| 建筑完工 | `4699166` 完工脉冲 + 金色飘字 | 同上（缺 toast/audio 接线） |
| 建筑放置 | AudioManager.ts:31 `onPlaced`→`sfx_place` | 无视觉反馈测试钉桩（`git grep sfx_place` 非测试面仅 2 命中，均音频侧） |
- 建议可粘贴：
  `- [ ] **P2-3 操作反馈**：◐四批接线已落（c919-03a 危机 / c919-03b 资源不足 / c920-13 完工·晋升脉冲+飘字 / 放置 sfx_place）。残余＝完工与晋升缺 toast+audio 接线（4699166 自述现状）、建筑放置无视觉反馈钉桩、A-8 Juice 走查未做。`

### 6. 行 60｜P3-1：主数对，但「已清理 28 个 manifest_*.json」与在盘 4 个冲突

- 实测吻合：`src/renderer/data/buildings.ts` 的 `id: 'bld_` **35** 处；`public/art/buildings/*.webp` **33** 件（png 0 件）；`artManifest.ts:28` `NO_OWN_ART = new Set(['bld_tin_mine','bld_hemp_field'])` = 2 个走沙印回退（:125-126 借图 quarry / mulberry_grove）。⇒ 「35 中 33 有成品图，2 个回退」逐位成立，**不必改**。
- 不成立处（**取证到提交级**）：`git show --name-only --diff-filter=D 18f92a8`（commit 标题即「清理 28 个 manifest 生成残留」）实测删 **28 个文件 = 21 个 .json + 7 个 .png** ⇒ 行内「已清理 28 个 `manifest_*.json`」**把文件数当 json 数**（多算 7 张 png）。且删的 21 件按名分类＝buildings 9 / scatter 3 / terrain 3 / 无类目名 6，**portraits 一类从未进入清理范围**：`git ls-files public/art | grep manifest_portraits` → **仍有 4 个 `manifest_portraits_1781872*.json` 被跟踪**（生成器 `scripts/gen_portraits_events.py:154` 每跑一次落一个新时间戳文件，属设计内残留）。9/20 的 `colony-artmanifest-relink-20260920.md:173` 已把它们连同 scatter 9 图记为 `orphansArtFiles=13`。
- 建议可粘贴（在原行「已清理 28 个」处改口径）：
  `…清理口径修正（2026-09-22 复算 18f92a8）：该提交删 28 个文件＝21 json＋7 png，覆盖 buildings/scatter/terrain 三类目 manifest；portraits 类从未纳入，public/art 根仍跟踪 4 个 manifest_portraits_<ts>.json 孤儿（scripts/gen_portraits_events.py:154 每跑一次留一件）。删文件或改覆盖式写入属人工授权（9/20 报告 orphansArtFiles=13 在册）。`
- 麻田/锡矿 2 图待补＝真未动（需 image_gen / 用户确认，本单禁网络未碰）。

### 7. 行 62｜P3-2 实质已被测试钉住 → 建议勾（残余项另立）

> **前科在册**：`docs/insights/colony-p32-closure-20260918.md`（s918-14，只读）已判「P3-2 可通过闭单」并**给出与本文同一处**的勾选建议（`OPTIMIZATION_BACKLOG.md:62 [ ]→[x]`，附证据指针），当时以「backlog 属并发在途 M 域，避免踩写」为由未落笔。本单**复核其结论仍成立**，且证据形态已从「grep 差集」升级为「4 个永久守护测试」——勾它比 9/19 时更稳。
> **一处口径差未归因（引数时别混用）**：s918-14 记「渲染层实际引用 evt_art_* 键 **6** 个」，c922-10 的 `artManifestEvtArtUsage.test` 口径是「静态 **4** 键 + 动态 **3** 键 = 消费 **7**」。差 1 未归因（疑为 ending 模板前缀计入口径不同），两数不可互换引用；本单未深挖（属对账族既有域）。

- 「manifest 与数据 id 对齐」现在有 4 个永久守护件：`data/__tests__/artManifest.test.ts`、`artManifestEvtArtUsage.test.ts`（c922-10：10 个 evt_art 键 = 静态 4 + 动态 3 + 零引用 3，三面互斥且并集恰 10，新增第 11 个无人引用键即漂红）、`artManifestReuse.test.ts`、`scenes/__tests__/…`+`data/__tests__/bootLoadList.test.ts`（c922-04：63 条加载项逐条 `existsSync` 验盘 + 同 key 的 manifest.path 与运行时 loadUrl 归一同义 + NO_OWN_ART 逐名例外）。
- 立绘面：`public/art/generals/` 实 **5** 件（gen_barbarian / hu_ben / pei_shao / tian_zhong / xie_changqing）＝与 P3-1 记的「将领 5/5」一致。
- 建议可粘贴：
  `- [x] **P3-2 事件插画 / 将领立绘覆盖核对**：manifest 与数据 id 对齐已由守护测试长期钉住（artManifest.test / artManifestEvtArtUsage.test 三面并集＝10 / bootLoadList.test 63 条 existsSync）；generals 5/5、events 10/10 在盘。遗留另立＝3 个零引用 evt_art 键（coronation/feast/unification，接线还是删键属人工裁决）＋行 60 的 4 个 manifest_portraits 孤儿。`

### 8. 行 63｜P3-3 ⚑不可判（并撤回本单初判的一句过头话）

- 判据是「按单帧不判小作坊基线**自检截图**」——需人眼看图定「质感」，本仓无截图基线在档 ⇒ 本单**不代判、不勾**。
- **撤回**：本单初稿曾写「9/19 之后皮面零改动」，实测不成立并已改为可核口径——`git log --since=2026-09-19 -- src/renderer/ui src/renderer/render public/art/terrain` 命中 **22 个提交**，逐名读为 fakeScene 测试收编批一/二/三（`82206f7`/`1b7142c`/`30a8ab3`）与资产转码（`14336fc`/`f0c9754`，含 `public/art/terrain/*.png → .webp`）⇒ **动过皮面文件 ≠ 做过皮精修**，两者不可互证；要从这 22 个提交里挑出「视觉重绘」需另做 diff 级审查，不属本单预算。
- terrain 现值（供人审前对表）：`public/art/terrain/` 实 5 件 webp（forest/hills/mountain/plain/river），`BootScene.ts:51-53` 由 `TERRAIN_ART` 派生加载 ⇒ 若判「皮够」则真能勾；本单不判。
- 建议（只加时效注，保持未勾）：
  `- [ ] **P3-3 地形与 UI 皮精修**：…（2026-09-22 c922-19 复核：判据需人审截图、无自动化完成锚；terrain 五型自 c921-02 起已是 webp，属体积动作非质感动作 ⇒ 维持未勾）`

### 9. 行 72｜P4-1 与行 61 同编号双条（一勾一未勾）

> **前科在册**：`colony-backlog-dup-ids-20260917.md` 第二节已判 :61「**错置**——发行说明属 P4 发布域」且与 :72「状态相反」，第三节给的整改是「:61 移入 P4 节与 :72 合并为『README 已落地 [x]；键位/分发说明 [ ]』两条」。本单**独立复算后与其一致**，并补一条它没说的：合并后的「键位/分发说明」半条在现 README 里其实**已有**（本单复读：README 4,489 B，含玩法/国格阶梯/**操作**段与 v0.10.0 口径），所以真正缺的只有「给朋友的分发说明＝分发渠道/免安装版指引」。

- 实况：根 `README.md` 4,489 B 在 HEAD，10 个二级节含 `## 玩法与系统`（:57）/`## 操作速查`（:70，键位已覆盖）/`## 打包（Windows）`（:41）/`## 文档`（:97）；行 61 已勾并写明「玩法/运行/打包/操作/文档/开发纪律」。行 72 是同事项的旧残留。全文件 `grep -c 分发` = **0** ⇒ 唯「分发说明」确无载体。
- 建议：**删 72 行**（或改勾并指向 61 行）。两条并存会让任何「未勾项计数」虚高 1。
- 若主班要保留成对结构，则应把 72 行改成 61 行未覆盖的差集（＝给朋友的分发说明：分发渠道/免安装版指引，现 README 零命中），否则无判据可勾。

### 10. 行 73｜P4-2 版本与图标：客观部分已就位

- `package.json:3 "version": "0.10.0"`；`electron-builder.yml` win/portable 均引 `resources/icon.ico`；该文件 **370,070 B** 在盘（Aug 14 生成），生成器 `scripts/gen-icon.mjs` 已接进 `electron:build:win` 前置步（`package.json` scripts）。
- 「最终态」＝人审；建议 ◐ 写法：`- [ ] **P4-2 版本与图标**：◐版本号 0.10.0 与 icon.ico（370,070 B，gen-icon.mjs 已入 build 前置）就位；未做＝图标终态确认与 0.10.0 出包（见 P4-3）。`

### 11. 行 74｜P4-3 终检：机器侧 9/19 跑过、本轮未跑、出包停在 Aug 14 → ○（改写）

- 先纠本单初判的一处口径（**按在档证据改写**）：`docs/insights/colony-p43-dress-20260918.md`（c918-27，9/19 05:1x）**实跑过终检机器侧两步**——`npm run verify` EXIT=0（107 文件/1208 例全绿）＋ `npm run build` EXIT=0（5.04s）。所以「build 从没跑过」是错的；真状态是**预演绿过，但 9/19 之后未再跑**，且该文档自己列的 3 项收尾（8 项在途收口 / 人工走查 / 可分发包成型）至今无在档完成证据。
- 该文档顺手给出的一条**读数与 c922-18 互相坐实**：9/19 那次 production `npm run build` 的产物是 `index-*.js 726.80 kB + phaser-*.js 6,777.62 kB` ⇒ **走的是正式构建、phaser 仍是未压缩的 6.78 MB**。这与本单实测的 8/14 发布 asar 内 `phaser-CWlhwGg6.js` = 6,777,632 B（文件名哈希即内容哈希，与现 dist 逐位同）构成**两条独立时间的证据**：electron-vite 这条链的 renderer 产物从来没被 minify 过。⇒ c922-18 的「方案 B（补 minify，−5.3 MB raw / −78%）」从推测升为**有历史构建读数支撑的判读**。
- verify 侧本轮证据：c922-17 于 00:45 全量 **124 文件 / 1295 例全绿**（工作树脏态快照），HEAD 干净态口径 **1291 例**（c922-13）。
- 出包侧：`dist-out/` 最新 exe 时间戳 **Aug 14 01:51**（邦国录-0.10.0-x64.exe 230,976,170 B / portable 230,766,558 B），其后 src 已落 20+ 提交 ⇒ 该包不可作「可分发包」交。
- 建议：本行**不要勾**，追加前置依赖与已完成量，可粘贴：
  `（现状 2026-09-22：机器侧两步 9/19 预演双 EXIT=0（colony-p43-dress-20260918.md），本轮 verify 由 c922-17 复证 1295 例全绿；未做＝重跑 build+electron:build:win 出包（末次包 Aug 14）、一轮完整人工走查。前置＝c922-18 判定的 phaser minify 出口未落地前，出包含 6.78MB 未压缩 phaser＝已知冗余）`

## 三、已勾项锚点过期 6 处（非未勾项，但属「与实况不符」，一并给文本）

| 行 | 现文 | 实况 | 建议 |
|---|---|---|---|
| 6 | 基线（2026-08-13 实测）：975 测试全绿 | 现 HEAD 干净态 1291 例 / 工作树 1295 例（c922-13、c922-17） | 加时效标注（照 c922-16 手法）：「本数为 2026-08-13 快照，此后每轮递增，勿当静态量引」 |
| 32 | P0-2 …saveLoad 45 测试 | `git show HEAD:…saveLoad.test.ts` 声明 45 条，**工作树 49 条**（他在途件 +4） | 待他在途收口后改 49，或写成「45→49（在途）」；本轮别钉死 |
| 40 | P1-3 …gameStore.ts:54/939 buildDayPipeline 被 GameStore 调用 | :54 是 import，调用在 **:948**；:939 只是注释行 | 改 `:54 import / :948 调用`（与 c922-16 同判） |
| 43 | P1-6 …cameraMath.ts 79 行纯函数 | `wc -l` 90、去注释空行 **60**，两口径都不是 79 | 改为「90 行（代码 60）」并写明口径，别留第三种数 |
| 33 | P0-3 …主包 727KB + phaser 6.78MB | 体积成立但是**未压缩口径**：发布 asar 内 phaser 同为 6,777,632 B（文件名哈希一致 ⇒ 内容相同）；补 minify 即 1.48MB | 追加一句「6.78MB 为未 minify 实测；minify 出口见 c922-18 判定」 |
| 31 | P0-1 落地注记「1001 测试」「人口 20→38」「第 33 天晋城邑」 | 本单收班 pre-commit 全量输出实读：**1295 例**、`[P0-1] finalPopulation:117`、`gradeMilestones:[{day:41,grade:1}]`、`finalBuildings:40`（行内写 37）——五个读数四个漂；`hostileNpcActions:26` **仍与行内一致**；另一例 `[P0-1-diversify]` 人口 140、day48/161 两阶 | **只加时效注、数值不许手改**（经济平衡数值红线）：改法＝行尾标「读数随 harness 重跑漂移，引数取最近一次 stdout，本行 2026-08 快照」 |

## 四、旁生发现：insights 索引自身账不齐（合入本档时一并处理）

本单按惯例要给 `colony-insights-index-20260919.md` 追加 1 行，落笔前做了 comm 双向差（c922-13 立的规矩），实测**不闭合**：

```
$ ls docs/insights/*.md | wc -l                                            → 77（含索引自身＋本档）
$ grep -oE "^- [a-z0-9-]+\.md" docs/insights/colony-insights-index-20260919.md | wc -l → 74
$ comm -23 <磁盘> <索引>   → colony-insights-index-20260919.md（按「不自列」设计不列，正常）
                            colony-optibacklog-status-draft-20260922.md（本档，随本单补）
                            colony-unreachable-resourceSystem-20260912.md ← 真缺，非本单留下
$ comm -13 <磁盘> <索引>   → 空（无幽灵条目）
```

- **缺 1 条目**：`colony-unreachable-resourceSystem-20260912.md` 在盘、在 HEAD，却不在索引里。c922-13（9/21 22:52）当时记「71 条目＋索引自身＝磁盘 72 份，comm 双向差为空」⇒ 缺口出现在 c922-13 之后的某次追加（该族文件时间戳 Sep 13，说明是**索引被重写时漏抄**，不是新文件忘登记）。
- **头部自述数也不实**：索引第 1 行写「条目 75 份 ＋ 本索引自身 1 份 = 磁盘 .md 76 份」，实测条目 **74**、磁盘 .md（本单前）**76**。 ⇒ 头部口径比自身设计少 1，与「磁盘数」的加和式同时错一位。
- **本单处置**：只补自己那 1 行（守 c920-01「不自列」＋不顺手改他班文件既有语义），**不代补 unreachable 那行、不改头部自述数**——头部行是逐班追加式自述（每班写一次「追加 1 条」），改它等于重写别人的账。**出口**：请主班在收班时一次性重建索引（`ls | sort` 反推条目＋按实测重算头部自述数），或授权单开一「索引重建」执行单（该族已有先例：c920-01 生成 / c922-01 刷新）。

## 五、合并冲突面（合入方必读）

- 他在途 diff 只动 **行 39-43（P1 段 5 行）**：P1-2/P1-3/P1-6 改勾加证据串、P1-4/P1-5 改「现状」注（`git diff --stat` = 5 insertions / 5 deletions，实测逐条相符）。
- **直接重叠**＝行 41（P1-4）与行 42（P1-5）：本单第 2、3 条建议是在他那两条注之上再纠一处过期（terrain 已派生 / 复核已收口）。若分两次改，第二次会覆盖第一次的措辞 ⇒ **建议 P1 段五条一次性合入**。
- 不重叠：行 6/24/32/33/47/51/60/62/63/72/73/74 均不在他的 diff 范围内，可独立合。
- 本单对 `OPTIMIZATION_BACKLOG.md` **零写入**（见第六节自证），所有文本都在本文件里等合入。

## 六、只读与红线自证

```
$ git diff --stat docs/design/OPTIMIZATION_BACKLOG.md      # 收工复跑
 docs/design/OPTIMIZATION_BACKLOG.md | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)            # 与开工逐字相同＝本单零写入
$ git status --short                                        # 收工＝开工：仍只他班在途 7 件 + 未跟踪 .audit-b151-tmp/
$ wc -l docs/design/OPTIMIZATION_BACKLOG.md                 # 81（开工同数）
```

- **经济平衡数值红线**：本单只登记文档中的**数值口径**（测试数、行数、体积、件数）与实况差异，未读未改任何平衡参数；`sandboxSimulation` 的 60 格槽位探测与终局精确值锚一律未触碰（未跑该文件、未动 harness）。凡涉及数值结论处（P0-1 主项 4 条不变量、P2-2 三条已勾项的读数）本单一律标 ⚑ 或只引在档结果，不自取数。
- 行号锚点：`Read` 工具在本仓返回过磁盘上不存在的文件（c922-12 前科），故本文所有 `file:line` 均由 `git grep -n` 与 `sed -n`/`wc` 双路互证后取，未采信任何单次工具输出。
- 本轮过期锚合计 **12 处**（逐条可复算，分布在三个载体）：
  - **backlog 现文 7 处**：行 41 terrain 判错（连带 :53/:57/:71 三组行号）、行 40 :939、行 43 79 行、行 32 45 测试、行 6 基线 975、行 31 P0-1 落地注记三读数（1001 例→实读 1295、人口 38→117、day33 晋城邑→day41）、行 60「28 个 manifest_*.json」（实为 28 文件＝21 json＋7 png，且 portraits 类从不在清理范围）。
  - **既有 insight 文档 4 处**：`colony-backlog-dup-ids-20260917.md:32` terrain 硬编码结论已被 c918-04/05 之后的改动否证（同一文档给 P0-1 的行号 :28 亦漂至 :31）、`colony-onboarding-walkthrough-20260918.md` 「仅 1 个 step」（实 3）、`colony-p32-closure-20260918.md` 消费 evt_art「6 键」与 c922-10 守护测试「静 4＋动 3＝7」口径差 1 未归因、`colony-p23-hooks-map-20260919.md` 五类全缺矩阵被其后 3 个接线提交推翻且漏算 AudioManager 监听面。
  - **索引自身 1 处**：头部自述 75 条目 vs 实测 74，且 `colony-unreachable-resourceSystem-20260912.md` 未列（详见第四节）。
  - 其中 **3 处落在他在途 diff 新写的证据串里**（P1-3/P1-4/P1-6）⇒ 他在途件收口前，这 3 处只能由主班一次性合入。
- 本单留下的可复用判据（供后续班次直接引，不必重测）：未勾 11 项行号 24/41/42/47/51/60/62/63/72/73/74 ＋ 已勾但锚过期 5 行 6/32/33/40/43。
