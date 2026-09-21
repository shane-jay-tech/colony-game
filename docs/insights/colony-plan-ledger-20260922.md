# colony PLAN.md 完成度逐项对账台账（c922-16，只读，2026-09-22T00:4x 取数）

> 用途：PLAN.md 7 个 Work Item 的**逐子条**完成度对账，输出「夜间可切残余清单」。
> 边界：未改 PLAN.md、未改任何生产码／测试码、未 push、未联网；只在 `docs/insights/` 落两笔（本档＋索引 1 行）。
> 取数 cwd `D:\code\colony-game`，HEAD `3c60324`，工作树脏态＝他人 7 在途＋`?? .audit-b151-tmp/`。

## 一、判据口径（避免「半勾」变成万能词）

| 状态 | 定义 |
|---|---|
| ✅ 勾 | 子条要求的事实在磁盘上成立，且本单亲自取到文件锚（不是引历史结论） |
| ◐ 半勾 | 主路径成立但有显式残余（残余点名到行） |
| ○ 未动 | 磁盘上找不到该子条的实现（或实现的前提已被后续裁决移除） |
| ⚑ 不可判 | 判据需越界（联网／push／读凭据内容），本单授权外 |

**共 30 条子条**（item2／item3 各 5 条，其余 5 项各 4 条）；总账：**✅ 17、◐ 8、○ 3、⚑ 2**（逐条状态见第三节，本节各行已按此自洽加和）。

## 二、7 项总账（项 × 状态 × 证据（文件锚））

| 项 | PLAN.md 标题 | 状态 | 证据（文件锚） |
|---|---|---|---|
| 1 | Establish a reproducible baseline | **✅ 完成（3 勾／1 半）** | 分支实存：`git branch --show-current` = `codex/architecture-hardening`；快照提交＝`15769cb`（`git log --oneline --reverse` 首条，125 个文件条目）；lockfile＋验证命令：`package-lock.json` 在盘、`package.json:17-19`（`type-check`／`test`／`verify`）；失败记录：`docs/insights/colony-test-asset-map-20260921.md`＋`colony-build-size-20260920.md`（今日 pre-commit 复跑仍 124 文件/1295 例全绿） |
| 2 | Repair composition and feature reachability | **◐ 半勾（2 勾／2 半／1 未动）** | 见第三节 2.1-2.5。硬残余：scatter／audio 两域仍非 manifest 权威（`BootScene.ts:55-59`、`:77-81`，`artManifest.ts` 无该两类目），story 固定 NPC roster **未接**（`gameStore.ts:2392-2394` 两模式共用 seeded random） |
| 3 | Type communication and composition boundaries | **◐ 半勾（4 勾／1 半）** | typed events：`state/stateEvents.ts` 的 `GameStateEventMap`＋消费点 `scenes/GameScene.ts:4,65,70,94`；registry：`ui/registry.ts:29 REGISTRY_KEYS`＋`:86 registryGet`＋`:91 registrySet`＋`ui/__tests__/registry.test.ts`；UI adapter：`ui/__tests__/uiAdapterGuard.test.ts`；DSL 下沉：`data/dslCore.ts`(204 行)＋`state/dslEval.ts`(9 行再导出)＋门禁 `data/__tests__/dataLayerBoundary.test.ts`。**半勾处＝shared 视觉常量**（详见 3.4，HEAD 零引用） |
| 4 | Reduce simulation-kernel concentration | **◐ 半勾（3 勾／1 未动）** | `state/dayPipeline.ts:52 DAY_PHASE_DEFS`＋`:116-117 runDayPipeline`；接线点 `state/gameStore.ts:54 import`＋`:948 runDayPipeline(buildDayPipeline({…}))`；域分组＝`DAY_PHASE_DEFS` 的 `domain` 字段（`:43`、`:53-63` economy/time/military/progression/diplomacy/population）；facade＝`GameStore` 保留 `tickDay`。**未动＝phase 事件批界**：`runDayPipeline` 只有 `for (const phase of phases) phase.run();`，无批／无分隔标记 |
| 5 | Split renderer responsibilities incrementally | **◐ 大体未动（1 勾／2 半／1 未动）** | 已做＝视口/相机数学（`render/cameraMath.ts` 6 函数＋`__tests__/cameraMath.test.ts` 9 例）与公共 API 保持（`scenes/GameScene.ts` 仍走 `mapRenderer.*`）。**未动＝等距复用**（`iso.ts:44-56` 的 `isoToGrid/isoToGridF` 生产零引用，`MapRenderer.ts:805-808`/`:826-829` 两份手抄 ⇒ 与子条「reuse rather than maintaining duplicate projection formulas」正相反）；map-layer 生命周期助手未抽（`render/` 目录仅 7 模块，`MapRenderer.ts` 仍 1208 行、`destroy()` 调用站点 27 处内联（`grep -c`）） |
| 6 | Verification and documentation | **✅ 完成（3 勾／1 半）** | 五类测试齐全：`scenes/__tests__/ModeSelectScene.test.ts`＋`IntroScene.test.ts`（story/sandbox 组成）、`ui/__tests__/SaveLoadPanel.test.ts`、`ui/__tests__/registry.test.ts`、`state/__tests__/dayPipeline.test.ts`、`render/__tests__/cameraMath.test.ts`；scene smoke＝`scenes/__tests__/GameSceneLifecycle.test.ts`；proof＝`npm run verify`（`package.json:19`）＋`git diff --check` 本单实测无输出。半＝START_HERE 数字（`docs/insights/colony-start-here-count-drift-20260917.md`，且 c922-13 记其维持草稿态＝用户 M 域） |
| 7 | GitHub backup | **◐ 半勾（1 勾／1 半／2 不可判）** | `git remote -v` ＝ `origin https://github.com/shane-jay-tech/colony-game.git`；远端跟踪分支实存 `origin/codex/architecture-hardening`＝`e7cecd3`（2026-09-20 11:03）⇒ **确实推过**；但 `git rev-list --count origin/codex/architecture-hardening..HEAD` ＝ **20** ⇒ 本地领先 20 提交未推。draft PR 与 push 均越本单授权（⚑） |

## 三、逐子条拆解（30 条，每条带文件锚）

### item 1 — Establish a reproducible baseline

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 1.1 | 从 master 建 `codex/architecture-hardening`（:21） | ✅（分支面）／派生关系未复核 | `git branch --show-current`＝`codex/architecture-hardening`；`git branch -r` 有 `origin/master`。本仓**无本地 master**，`merge-base` 对照会指向 `origin/master`——属历史动作，本单不重做判定 |
| 1.2 | 敏感文件审计后提交完整快照（:22） | ◐ | 快照＝`15769cb`（125 条目）。审计**只可证其半**：`.env.local` 从未入库（`git log --all --diff-filter=A -- .env.local` 空）；但 `.env.development`（6 行）**自始被跟踪**（`git ls-files --error-unmatch` 命中），且不被 `.gitignore:19-21` 的 `.env`／`.env.local`／`.env.*.local` 三条命中 ⇒ 与 PLAN.md:14 的字面（"ignored secrets"）不冲突（它压根没被 ignore），但**是否含凭据本单未读内容、不判定**，交人工 |
| 1.3 | 按 lockfile 装依赖并跑既有验证命令（:23） | ✅ | `package-lock.json` 在盘；`package.json:18 "test": "vitest run"`、`:17 type-check`、`:19 verify`；本单 pre-commit 复跑＝124 文件/1295 例全绿 |
| 1.4 | 架构改动前记录既有失败（:24） | ✅（口径为「当时无失败」） | `docs/insights/colony-test-asset-map-20260921.md`（测试资产分布＋慢尾）、`colony-build-size-20260920.md`（构建基线）；首提交信息自带 "501 tests passing" |

### item 2 — Repair composition and feature reachability

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 2.1 | story 用固定 NPC roster、sandbox 保留 seeded random（:28） | **○ 未动** | `gameStore.ts:2392-2394 startNewGameNpcs(seed)` 唯一 NPC 阵容注入口，两模式共用；`startStoryMode()`（`:2108`）只设 `mode`＋`storyFlags`＋`getBalanceConfig('story')`（`:2120`），**不碰 npcCountries**。且固定 roster 的载体模块 `data/storyNpcs.ts` 已于 9/13 退役删除（`docs/insights/colony-storynpcs-terrain-reachability-20260913.md`：生产引用 0 ⇒ 备份到 `tmp/backup-colony-20260913-1537/` 后移除），本单复核 `ls src/renderer/data/storyNpcs.ts` ＝ No such file ⇒ **该子条的前提已不在盘上**，接它要先决定恢复退役件（产品裁决，非纯工程） |
| 2.2 | 用既有 IPC＋`saveLoad.ts` 把存/读做成游戏内 UI（:29） | ✅ | `ui/SaveLoadPanel.ts` 实存；场景接线 `scenes/UIScene.ts:29 import`、`:71 字段`、`:251 new SaveLoadPanel(this, store)`；registry 类型位 `ui/registry.ts:23,72`；测试 `ui/__tests__/SaveLoadPanel.test.ts` |
| 2.3 | manifest 为 boot 唯一加载源、删重复清单（:30） | ◐ | 已派生 4 类：`BootScene.ts:44-46`(building)／`:51`(TERRAIN_ART)／`:64-66`(general)／`:69-73`(EVENT_ART)，源侧 `artManifest.ts:30,55,70,88,98`。**残余 2 类**：scatter `BootScene.ts:55-59`（注释原文「manifest 无 scatter 类目，保留原清单」）、audio `BootScene.ts:77-81`（`ALL_BGM_KEYS`/`SFX_KEYS` 来自 `state/audioDirector.ts:29`，非 manifest）⇒ 与已排单 `zcode-bridge/inbox/c922-110-p14-manifest-authority.task.md` 同一域 |
| 2.4 | 移除只被自家 legacy 测试引用的超期模块（:31） | ✅ | 退役记录：`docs/insights/colony-unreachable-resourceSystem-20260912.md`、`colony-storynpcs-terrain-reachability-20260913.md`、`colony-retired-module-residual-20260916.md`、`colony-retired-render-20260917.md`；`HEAD` 侧另有 `63dca27`「删除 9 条静态真死导出」。零直接测试生产模块的 15/124 明细在 `colony-test-asset-map-20260921.md`（c922-13） |
| 2.5 | 处理 stale/unreachable 启动配置（:32） | ◐ | 不可达模块已退役 3 件（`git aad0592`，同上 2.4 档案），但**未做全量启动配置复核**——此项在他人**在途** `docs/design/OPTIMIZATION_BACKLOG.md` 的 P1-5 行里也被自述为「本轮未做」，两侧口径一致 |

### item 3 — Type communication and composition boundaries

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 3.1 | 状态事件面改 typed event map＋泛型 on/off/emit（:36） | ✅ | `state/stateEvents.ts` 的 `GameStateEventMap`；泛型消费点 `scenes/GameScene.ts:4`（import type）、`:65,70,94`（listener 签名直接取 `GameStateEventMap['state:buildingX']` 载荷类型）；台账 `docs/insights/colony-typed-events-20260913.md` |
| 3.2 | Phaser registry key 集中＋typed helper（:37） | ✅ | `ui/registry.ts:29 REGISTRY_KEYS`（单一事实源）、`:86 registryGet<K extends RegistryKey>`、`:91 registrySet`；守护用例 `ui/__tests__/registry.test.ts`；台账 `colony-registry-keys-20260913.md` |
| 3.3 | UI 只做 adapter，不得改 state 内部（:38） | ✅（以门禁存在为判据） | `ui/__tests__/uiAdapterGuard.test.ts`（另有 `paletteGuard`／`fontSizeGuard` 两件同源守护）；台账 `colony-ui-adapter-guard-20260913.md`。⚠️ 口径提示：本条是「有守护测试」级判据，**不等于**全 UI 面已逐个审过 |
| 3.4 | render/UI 共用视觉常量下沉到中立模块（:39） | ◐ **本项唯一硬残余** | 模块在：`src/shared/visualConstants.ts` 8 行、**只 1 个常量** `MASK_FILL_WHITE`（:8）。但 **HEAD 里零引用**（`git grep -l "shared/visualConstants" HEAD -- src/renderer` 输出为空），唯一引用者是他人在途的 `MapRenderer.ts:2`（`git diff -U0` 实测）⇒ 在 HEAD 口径下该下沉**尚未开始发生**。反向依赖面仍在：`render/mapColors.ts`、`render/MapRenderer.ts`、`scenes/GameScene.ts`、`IntroScene.ts`、`ModeSelectScene.ts`、`TransitionScene.ts` 共 **6 个生产文件** import `../ui/palette`；台账 `colony-shared-visual-constants-20260913.md` |
| 3.5 | DSL 校验契约下沉到中性 core/data 边界（:40） | ✅ | c922-11 落地：`data/dslCore.ts`（204 行）＋ `state/dslEval.ts` 退化为 9 行 `export * from '../data/dslCore'`（文件头注释即标 `PLAN.md:40`）＋门禁 `data/__tests__/dataLayerBoundary.test.ts`（生产源文件面 `../state/` import 恒 0，另 2 例钉对象同一性与契约行为）。注：`data/__tests__` 下 4 处跨层 import 属既有测试越界，门禁按生产源文件面判定，未改 |

### item 4 — Reduce simulation-kernel concentration

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 4.1 | 把 `tickDay` 的有序日阶段抽成命名可测 pipeline（:44） | ✅ | `state/dayPipeline.ts:52 DAY_PHASE_DEFS: Record<DayPhaseId, DayPhaseDef>`、`:116 runDayPipeline`；`gameStore.ts:54 import { buildDayPipeline, runDayPipeline }`、`:948` 调用；`state/__tests__/dayPipeline.test.ts` |
| 4.2 | 按域分组阶段回调、不改顺序（:45） | ✅ | `DayPhaseDef.domain`（`:43`）＋ `:53-63` 逐阶段映射（economy/time/military/progression/diplomacy/population）；顺序表在 `:96` 一带的 id 数组，测试侧钉顺序 |
| 4.3 | `GameStore` 保留兼容 facade（:46） | ✅ | `gameStore.ts` 仍导出 `tickDay` 等既有方法（UI/测试零迁移），组合点在 `:948` |
| 4.4 | 批处理或显式分隔阶段事件，防订阅者读到半更新日状态（:47） | **○ 未动** | `runDayPipeline(phases)` 全体＝`for (const phase of phases) phase.run();`（`:116-117`），无 batch 队列、无 begin/end 分隔标记、无「阶段边界才 flush」的机制；订阅者面仍直接 `this.emitter.emit(…)`（例：`gameStore.ts:2386`）。⇒ 这条是 PLAN 里少见的**真残余**，且它和 item4 已勾的三条放一起最容易被误读成「pipeline 已完备」 |

### item 5 — Split renderer responsibilities incrementally

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 5.1 | 复用既有等距投影模块，不维护重复投影公式（:51） | **○ 未动，且现状相反** | 权威版 `render/iso.ts:44-56`（`isoToGridF`/`isoToGrid`，`iso.test.ts:18,27` 已测往返）**生产零引用**（`grep -rn isoToGridF src scripts --include='*.ts'` 只命中定义＋内部＋测试）；重复的两份在 `MapRenderer.ts:805-808`（floor）与 `:826-829`（round＋夹边），且 `MapRenderer.ts:10` 的 import 列表里没有 `isoToGrid*`。⇒ 详单见 `docs/insights/colony-maprenderer-viewport-material-20260922.md` 第四节（c922-15） |
| 5.2 | 从 MapRenderer 抽出视口/相机计算＋map-layer 生命周期助手（:52） | ◐（半抽，一半未动） | 已抽＝`cameraMath.ts` 6 函数（`:16,23,30,42,72,85`）＋`cameraMath.test.ts` 9 例；**未抽**＝视口反向映射与格子映射 A-F 段（`MapRenderer.ts:192-197`、`287-289`、`308-311`、`800-811`、`819-831`、`841-848`）、共享前置 `computeViewportRect`（`:120-135`）、相机读数 20 次 `as number \| undefined`；map-layer 生命周期助手**完全未成模块**（`render/` 仅 `MapRenderer/cameraMath/iso/mapColors/buildingSigils/buildingAnims/buildingAnchorOverrides(+generated)` 7 件，`MapRenderer.ts` 仍 1208 行） |
| 5.3 | 保持 GameScene 用的 MapRenderer 公共 API，不做场景重写（:53） | ✅ | 调用面仍在：`scenes/GameScene.ts:315 setMapZoom`、`:329 screenToGrid`、`:344 gridToScreenPixel`、`:378,395 panBy`；`cameraMath.ts` 通过 `MapRenderer.ts:23` 转发导出 `MAP_ZOOM_MIN/MAX` 避免环依赖 |
| 5.4 | terrain／building／scatter／effects 生命周期可独立销毁且 resize 安全（:54） | ◐ | 销毁站点齐（全文件 `.destroy()` 共 27 处）：`MapRenderer.ts:528`（terrainTexLayers sprite＋maskGfx）、`:549`、`:565`（scatterImages）、`:773,778`（sigilTexts/buildingImages）、`:895`；resize 面 `grep -c resize` ＝ 12 处（含 `viewportCenterTile` 用格子做锚以扛 origin/zoom 双变，`:813-816` 注释）。半勾原因：这套生命周期仍在同一 1208 行类内，**独立性只在语句层、不在模块层**，改一处即需回归全文件 |

### item 6 — Verification and documentation

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 6.1 | 补 story/sandbox 组成、存读 UI、typed registry、tick 阶段序、抽出的渲染计算测试（:58） | ✅（五类齐） | `scenes/__tests__/ModeSelectScene.test.ts`＋`IntroScene.test.ts`＋`state/__tests__/storyPlaythrough.test.ts`；`ui/__tests__/SaveLoadPanel.test.ts`；`ui/__tests__/registry.test.ts`；`state/__tests__/dayPipeline.test.ts`；`render/__tests__/cameraMath.test.ts`（合计本单定向跑：render 三文件 56 例绿） |
| 6.2 | 至少一个 scene/组成 smoke，覆盖监听清理或 registry wiring（:59） | ✅ | `scenes/__tests__/GameSceneLifecycle.test.ts`（含 listener 清理面）＋`GameSceneFeedbackBatch2.test.ts`／`GameSceneToastFailure.test.ts` |
| 6.3 | 更新 START_HERE 与架构说明到实际版本/可达性/验证计数（:60） | ◐ | 计数脚本与漂移记录在案：`docs/insights/colony-starthere-count-check-20260917.md`、`colony-start-here-count-drift-20260917.md`、c922-07 的 start-here 脚本；但 **START_HERE 文本维持草稿未改**（c922-13 记：属用户 M 域，按任务书不动）。可粘贴文本与 HEAD 干净态计数（124 文件/1291 例）已由 c922-13 写在提交信息与报告里，本单不重复抄具体分项数（它们随 HEAD 变，引报告而非引台账） |
| 6.4 | 跑 type-check、单测、生产构建、`git diff --check`（:61） | ✅ | `package.json:19 verify`；本单两次 pre-commit＝type-check 0 错误＋1295 例绿；`git diff --check` 本单实测**无告警行**（仅他人 `colony-dead-exports-*.json` 的 CRLF 提示，非空格错误）；构建基线见 `colony-build-size-20260920.md`（本单未重建，理由见第五节 R7） |

### item 7 — GitHub backup

| # | 子条（PLAN.md 行） | 状态 | 证据 |
|---|---|---|---|
| 7.1 | 安装/校验 GitHub CLI 并认证会话（:65） | ⚑ 不可判（判据需联网） | `gh` 在 PATH（`/c/Program Files/GitHub CLI`）；认证状态**未测**——`gh auth status` 会打网络，本单禁止联网 |
| 7.2 | 无 target remote 时建私有 `colony-game` 仓库（:66） | ✅（remote 已存在，无需建） | `git remote -v` ＝ `origin https://github.com/shane-jay-tech/colony-game.git`（fetch＋push 同址） |
| 7.3 | 推快照与 architecture-hardening 分支（:67） | ◐ **本地领先 20 提交** | 远端跟踪 ref 实存：`origin/codex/architecture-hardening`＝`e7cecd3`（2026-09-20 11:03）；`git rev-list --count origin/codex/architecture-hardening..HEAD` ＝ **20**（含本班 3 笔）。⚠️ 该计数按**本地缓存的远端 ref**，未 fetch ⇒ 若他处已推则会偏大；push 属主班/用户授权，本单未执行 |
| 7.4 | 远端支持 PR 时开 draft PR（:68） | ⚑ 不可判 | 需 `gh pr create/list`（网络）；PLAN 的 Completion Criteria 末条「pre-refactor 快照与完成分支都在私有 remote 上」因此只能判到「快照与分支**曾**上过远端」（7.3 证据），不能判「当前同步」 |

## 四、对既有台账的三处纠正（本单复核时踩到，均已按磁盘实况登记）

1. **在途 `OPTIMIZATION_BACKLOG.md` 的 P1-4 行**写「terrain/scatter/audio 仍为硬编码清单（BootScene.ts:53/57/71）」——**terrain 那半句已过期**：`BootScene.ts:49-51` 明写「c918-04/05：TERRAIN_ART 已 5 型——清单改由 manifest 派生」并 `for (const asset of TERRAIN_ART)`。真实残余只有 **scatter（:55-59，注释自称因 manifest 无该类目而保留）＋ audio（:77-81）**。行号也对不上（:53/:57/:71 → 实况 :51/:55-59/:77-81）。
2. **同文件 P1-6 行**写「cameraMath.ts 79 行纯函数」——口径混用：磁盘 `wc -l` ＝ 90 行，非空 79，代码 60。数字本身没错（＝非空行），但**引为「行数」时会漂**，台账里应写口径。
3. **同文件 P1-3 行**写「gameStore.ts:54/939 buildDayPipeline 被 GameStore 调用」——`54` 命中，`939` 已漂到 **`:948`**（`runDayPipeline(buildDayPipeline({…}))`）。另注：那三行 P1-x 本身是该在途件的**未提交改动**（`git diff` 实证），归属方尚未闭合，本班只登记不改写他人文档（c922-08 口径）。

## 五、夜间可切残余清单（可直接抄成排单）

| # | 残余 | 建议单形态 | 交叉引用 |
|---|---|---|---|
| R1 | 3.4 shared 视觉常量下沉：把 6 个生产文件的 `ui/palette` 共用常量挪进 `src/shared/`，并**仿 `dataLayerBoundary.test.ts` 加一条 render↛ui 反向 import 门禁** | 纯代码＋新门禁测试，零平衡数值 | 本项即 PLAN item3 唯一硬残余；c922-11 的下沉手法与门禁写法可整体复用 |
| R2 | 5.1 等距逆投影三合一（`isoToGrid` 转生产引用，删 `MapRenderer.ts:805-808`/`:826-829` 手抄） | 签名与测试清单已给全（T6/T7） | `colony-maprenderer-viewport-material-20260922.md` §3 D/E 行＋§4 缺陷 1 |
| R3 | 5.2 视口反向映射提取（A＋F 先做，互为逆可当场钉 T8） | 材料已备；**前置＝等他人在途 `MapRenderer.ts` 闭合** | 同上 §3 A-H、§6 在途保护账 |
| R4 | 4.4 phase 事件批界/分隔：给 `runDayPipeline` 加显式阶段边界（或批处理队列），并钉「订阅者不得读到半更新日状态」的契约测试 | 需先定语义（改行为面），建议先出设计单 | 本档 4.4 行 |
| R5 | 2.3 manifest 权威化收口：只剩 scatter＋audio 两类目要不要进 manifest | **已排单** `c922-110-p14-manifest-authority`（inbox 在册），本档给出精确残余行号供其复用 | `BootScene.ts:55-59,77-81` |
| R6 | 2.1 story 固定 roster：**前置是产品裁决**（退役件是否恢复），不是工程单 | 交主班→用户 | `colony-storynpcs-terrain-reachability-20260913.md` |
| R7 | 7.3/7.1/7.4 push＋gh 认证＋draft PR：授权域外，且 push 前需先定「20 未推提交里他人 7 在途怎么办」 | 主班决定；本单未 push、未联网 | c922-08 的 8 项孤儿清单 |
| R8 | 6.3 START_HERE 计数同步：文本仍是草稿（用户 M 域） | 需用户放行才动 | c922-13 第五节 |

## 六、复算命令与零改动自证

```bash
# 项级
git branch --show-current; git log --oneline --reverse | head -1
git remote -v; git branch -r; git rev-list --count origin/codex/architecture-hardening..HEAD
grep -n '"verify"\|"test"\|"type-check"' package.json
# 子条级
sed -n '44,60p;77,82p' src/renderer/scenes/BootScene.ts            # 2.3 残余（scatter/audio）
sed -n '2392,2394p;2108,2121p' src/renderer/state/gameStore.ts     # 2.1 story 不碰 npcCountries
grep -n "DAY_PHASE_DEFS\|runDayPipeline" src/renderer/state/dayPipeline.ts   # 4.1 / 4.4（:116-117 只有 for-run）
grep -rn "isoToGridF" src scripts --include='*.ts'                 # 5.1 生产零引用
git grep -l "shared/visualConstants" HEAD -- src/renderer          # 3.4 HEAD 零引用（输出为空）
grep -rln "ui/palette" src/renderer/render src/renderer/scenes     # 3.4 反向面 8 文件（6 生产＋2 测试）
git diff --check                                                   # 6.4
```

- 判据一律**双路互证**：`grep -n` 定位＋`sed -n` 复读该行，Read 显示不作数（本仓 c922-12 有 Read 返回磁盘不存在版本的先例）。
- 台账内每个 ✅/◐/○ 都可由上面命令在 HEAD `3c60324` 上复算；⚑ 三条明确写了为什么不可判。
- 零改动自证：`git show --stat HEAD` 只含 2 个 `docs/insights/` 路径；`git status --short` 收工＝开工（他人 7 在途＋`?? .audit-b151-tmp/`）；未 add 任何他人脏件、未回退、未 push、未联网；`.env.development` 只查跟踪状态与行数，**未读内容**。
