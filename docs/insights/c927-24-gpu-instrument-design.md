# c927-24 · 渲染 GPU／合成／present 真机帧时插桩**设计稿**（11e4 遗留 1）

> 班：`qoder-executor-20260927-1945-colony43`（波次 19 只读裁决班）｜设计时刻 2026-09-27 19:4x
> 仓：colony-game，分支 `codex/architecture-hardening`，开工 HEAD `4c1d608`
> 锚点：`zcode-bridge/done/20260925-154201-11e4.result.md` 遗留 1（卷宗写 `outbox/`，按波次 brief §3a 该批已搬进 `done/`，内容未变 ⇒ 锚点在世，非路径失效）
> 🔴 **本件是纯设计稿：零产品码改动、零新增测试件、未落地任何探针。** 判据 ④「零码改动」＝本档只写 `docs/insights/`。落地前须人工放行（§6）。

---

## 0. 先复核锚点：三处必须修正，否则照抄会做出量不到东西的插桩

| 锚点／直觉说法 | 磁盘与 Phaser 3.70 源码实况 | 结论 |
|---|---|---|
| 「在 `GameScene` 里挂 **`this.game.loop` 帧时**」 | `game.loop`（`TimeStep`）在 3.70 类型面只暴露 `actualFps`（`node_modules/phaser/types/phaser.d.ts:6349`）与 `delta`（`:6417`）；**`delta` 是"平滑且有上限"的值**，不是逐帧真耗时（同文件 `smoothDelta` `:6512`）。真正的分段缝在 `game.events`：`Game.step` 依次发 `PRE_STEP / STEP / POST_STEP / PRE_RENDER / POST_RENDER`，且 `PRE_RENDER/POST_RENDER` 带 `(renderer, time, delta)` 参数（`node_modules/phaser/dist/phaser.esm.js:17167-17215`，`eventEmitter = this.events` 在 `:17182`） | 🔴 **挂点错**：帧时主轴必须挂 `game.events` 的三对事件，`game.loop.delta` 只能当旁证 |
| 「`performance.getEntriesByType('measure')`」 | 该 API 本身可用，但 Chromium 的 **user-timing 缓冲有上限**（默认 250 条量级），`mark`/`measure` 不 `clearMarks/clearMeasures` 就会静默丢样；且它只覆盖 **JS 侧**，量不到 GPU | ⚠ **口径不足**：只能当"CPU 腿分段"用；present/GPU 腿需另两条手段（§1 腿 3／腿 4） |
| 隐含前提「真机帧间隔 ≈ 16.7 ms，超出即卡顿」 | `src/main/index.ts:35` 生产开关 `app.commandLine.appendSwitch('disable-gpu-vsync')` ＋ `:36` `disable-features=CalculateNativeWinOcclusion` | 🔴 **不成立**：vsync 被关 ⇒ 帧间隔没有 60 Hz 量化基准，"rAF 间隔 vsync 抖动"这类读法本机无效。任何帧距读数必须与该开关同表登记 |
| 11e4 E4「MapRenderer 无每帧 update」 | 复核：`src/renderer/render/MapRenderer.ts` 方法表面确无 `update`（构造在 `:410`，热路径 `rerenderBuildings` `:662`、`rebuildAfterResize` `:354`、`ensureFittedToViewport` `:394`、`requestRefit` `:381`、`setSeasonTint` `:1108`） | ✅ 准（沿用） |

> 另记一处现场漂移（不影响本单判据，但按波次 brief §0「一切以磁盘现值为准」必须点名）：波次 brief 表列 colony-game HEAD `102c65d`／脏 7 项，**实测** HEAD `4c1d608`、`git status --porcelain` **4 行**（` M docs/design/OPTIMIZATION_BACKLOG.md`、3 枚 ` M docs/insights/colony-*.json`、1 枚 ` D ...json.bak`）。本档所有读数取自我自己跑的命令。

---

## 1. 要把"渲染耗时"拆成四条腿（设计前提：一条腿一个手段，不许混报）

| # | 腿 | 物理含义 | 可测性（本机 Electron＋Chromium） | 手段（Tier 见 §4） |
|---|---|---|---|---|
| L1 | **逻辑/更新腿** | `GameScene.update` 内 `ensureFittedToViewport` ＋ `TimeSystem.update`（内含最多 400 次 `tickDay`）＋ 相机比对 | ✅ 高，纯 JS | `POST_STEP→PRE_RENDER` 时间差；或 `update` 首尾 `performance.now()` |
| L2 | **提交腿（JS→GL 命令）** | `renderer.preRender()` → 各 scene/camera 遍历 → `renderer.postRender()`，含批处理（batch）flush、纹理切换、stencil mask 绑定 | ✅ 高，纯 JS（不含 GPU 真执行） | `PRE_RENDER→POST_RENDER` 时间差（`phaser.esm.js:17204/17214` 两点之间的 `this.scene.render(renderer)`） |
| L3 | **GPU 执行腿** | 顶点/片元真跑：1 全屏清屏＋N 层 geometry/stencil mask＋M 张纹理上屏 | ⚠ **条件可测**：需 WebGL2 `EXT_disjoint_timer_query_webgl2`。**能力必须先探测**（`game.renderer.gl` 存在性＝`phaser.d.ts:99527`/`:100489`；扩展是否被本机 ANGLE/Chromium 暴露＝**本单未知，属运行时事实**），不支持则整腿降级 | Tier1 插桩：每帧 query 配对（begin/end）＋ disjoint 标志；降级态＝只报"不可测" |
| L4 | **合成＋present 腿** | Chromium 合成器把 canvas 叠进页面、SwapBuffers、上屏 | ❌ **renderer 进程内不可自量**（跨进程）。可测的是它的**残差** | 三件并行：① `PerformanceObserver({type:'long-animation-frame'})`（Chromium LoAF：`duration`/`renderStart`/`styleAndLayoutStart`/`blockingDuration` 把"渲染阶段（样式/布局/绘制）"从 JS 里剥出来）；② 帧距残差 `Δt(frame N 起点) − (L1+L2)`＝阻塞在非游戏线程那段；③ 外部 GPU 轨迹（Windows PresentMon / GPUView / Electron `--trace-category-filter=*disabled-by-default-gpu.*`）——**这三条都不需要改产品码**（Tier0） |

**设计结论 D1**：本班被要求"设计 GPU/合成/present 插桩"，而 **L4 在 renderer 里根本不可能直读**。所以方案必须是"**内部插桩（L1/L2/条件 L3）＋ 外部轨迹（L4）**"双轨，且两轨按**同一时刻基准**对齐（用 `performance.timeOrigin` ＋ `Date.now()` 各取一次做原点，写进每轮表头），否则帧号对不上、两轨读数是两套故事。

---

## 2. 挂点清单（判据 ①：file:line，逐点给"采什么／成本／解绑位置"）

命名：`P*` ＝插桩点。所有 `P*` 都**不改被挂函数的内部逻辑**，只在其前后取值。

### 2.1 帧轨主轴（挂在 `game.events`，不侵入任何业务函数）

| 挂点 | file:line（挂载位置） | 采 | 备注 |
|---|---|---|---|
| P1 `PRE_STEP` | `src/renderer/scenes/GameScene.ts:164` `create()` 体内注册（建议插在 `:214` 那批 `store.on(...)` 之后、`:252` `this.scale.on('resize', ...)` 之前） | `t_pre_step = now()`、`game.loop.frame` | 一帧的 JS 起点 |
| P2 `POST_STEP` | 同上注册 | `t_post_step` | **L1 ＝ P2−P1**（含全部 scene update，即 `GameScene.update`＋`UIScene`） |
| P3 `PRE_RENDER` | 同上注册（回调签名 `(renderer, time, delta)`，见 `phaser.esm.js:17204`） | `t_pre_render`、`renderer.name`、`renderer.gl ? 'webgl' : 'canvas'` | L2 起点；顺带登记当帧实际渲染后端（`Phaser.AUTO` 可能回退 Canvas，`src/renderer/main.ts:29`） |
| P4 `POST_RENDER` | 同上注册（`phaser.esm.js:17214`） | `t_post_render` ＋ `renderer.drawCalls`／纹理切换计数（若该版本暴露；**暴露与否属运行时事实，须以能力探测写法取值**） | **L2 ＝ P4−P3**；`P4→下帧 P1` ＝ L4 残差 |
| P5 `SHUTDOWN` 解绑 | `src/renderer/scenes/GameScene.ts:562` `shutdown()`（该方法已在 `:167` 用 `events.once(SHUTDOWN, this.shutdown, this)` 注册，是现成的干净解绑点） | 移除 P1–P4 四个 listener | 🔴 **必须成对**：本文件里 `:588-596` 那批 `store.off` 就是给"scene 重启泄漏"打的补丁，插桩不得成为第一个漏解绑的 |

**为什么不能只挂 `GameScene.update`（P6 备选）**：`update` 在 `GameScene.ts:258-277`，它只是 L1 的一部分；`UIScene.create()`（`src/renderer/scenes/UIScene.ts:193`）起的 HUD/面板 scene 也在同一帧跑，只挂 GameScene 会把 UI 腿的耗时记到"present"头上。⇒ **若产品上只允许改一个文件**，退化为 P6（`GameScene.ts:258` 首尾＋`:261`/`:262` 两处内分段），并在报告里明写"本表不含 UI scene 与真实 present"。

### 2.2 内部分段（在 L1/L2 内部再切三刀，全在既有函数边界，不动逻辑）

| 挂点 | file:line | 采 | 为什么是它 |
|---|---|---|---|
| P7 tick 归因 | `src/renderer/state/timeSystem.ts:18`（`update(realDeltaMs)` 首尾）＋ `:27-31`（while 循环，**一帧最多 400 次 `tickDay`**，`MAX_TICKS_PER_UPDATE` 在 `:14`） | `ticksThisFrame`、`msTicksThisFrame`、`realDeltaMs` 入参 | 11e4 量的 ms/tick 只有乘上"当帧补了几个 tick"才能进帧轨；speed3＝500 ms/日（`src/renderer/data/balanceConfig.ts:56`），正常帧 1 个 tick，**卡顿后的补帧帧会一次吞几十 tick**，那正是"单帧尖峰"的来源（a2e3 E4 已量到 `rerenderBuildings` 1.113 ms 与 tick 同帧出现） |
| P8 广播放大面 | `src/renderer/state/gameStore.ts:689`（`addResource` 发射点）与 `:947`（`applyDayDeltas`，无 reason） | 每帧 `resourcesChanged` 发射次数（计数器，不逐次 `now()`） | a2e3 实测 **5.59 发/tick × 10 订阅件**；本插桩要证的是"这些回调落在 L1 还是被算进 L2" |
| P9 地图重绘尖峰 | `src/renderer/render/MapRenderer.ts:662` `rerenderBuildings`（入口/出口）、`:354` `rebuildAfterResize`、`:1108` `setSeasonTint` | 单次 ms ＋ 每帧调用次数 | GPU 侧代理量：`:447-450` 四层 `setMask`（stencil）、`:471-482` 两次 `generateTexture`（一次性 RT）、`:535-558` TileSprite＋GeometryMask、`:691-700` 缺图占位分支（11e4 E4① 已点名该分支被 stub 覆盖、真机走不到） |
| P10 画布尺寸/DPR | `src/renderer/main.ts:113`（`const dpr = Math.min(3, Math.max(1, devicePixelRatio‖1))`）与 `:28-56`（`new Phaser.Game(config)`，`scale.mode: RESIZE` `:33`、`render.antialias: true` `:43`、`fps.target: 60` `:50-53`） | 一次性写进轮次表头：backing store 像素数＝逻辑×dpr²、`antialias`、`fps.target` | **片元成本的唯一分母**。11e4 的 CPU 读数与真机 ms 不可比，主因就是这条没人登记 |

### 2.3 采样点数据形状（每帧一条，定长，便于落盘）

`{ frame, t_pre_step, t_post_step, t_pre_render, t_post_render, rafGap, ticksThisFrame, msTicks, rcEmits, rerenderCalls, drawCalls?, fps? }`
⇒ 每帧约 12 个数值 ≈ 120 B 序列化。**60 s @60 fps ≈ 3,600 帧 ≈ 430 KB/轮**；5 轮 ×6 场景 ≈ 13 MB —— 落盘方案必须先按这个量级选（§5）。

---

## 3. 采样协议（判据 ②：可直接抄成执行班工单）

1. **轮次**：每场景 **≥5 轮独立**，轮间隔 ≥2 s（让 JIT/GC 落定）；**每轮重新 `create()` 场景**（读档或 `scene.restart()`），不共享上一轮的累积态。
2. **每轮内部**：预热 10 s（丢弃）→ 正式录 **60 s**；`tickDay` 相关态每轮起始 `currentDay` 必须相同（用同一存档位或 `replaceState` 钉住），否则 P7 的 ticks/帧不可比。
3. **分位数口径**：**p50/p95 用"帧"做样本单位**（不是轮、不是 tick）；每轮报 `p50/p95/min/max/样本数`，场景级再报 5 轮的**逐轮数组**——与 11e4 的 `pct(a,p)=a.sort()[ceil(p/100·n)-1]`（`tmp/20260925-154201-11e4/perf2.mts:15`）**同式**，禁止两种定义混用。
4. **必备派生量**（否则读数为零信息）：
   - `L1 = P2−P1`、`L2 = P4−P3`、`presentGap = 下帧P1 − P4`；
   - **掉帧定义**：`presentGap > 2×中位数` 的帧数与最长连段（vsync 已关 ⇒ 不可用"是否错过 16.7 ms"判掉帧，见 §0）；
   - `worst frame` 明细：帧号＋当帧 `ticksThisFrame`/`rcEmits`/`rerenderCalls`——尖峰必须能归因到 P7/P8/P9 三源之一，归不进去就如实写"未归因"。
5. **空载对照（两态必跑，差值才是插桩自身的成本）**：
   - `S0 空载`：主菜单/空图（无 tick、无建筑），`paused: true`；
   - `S1 沙盒中档`：`80²`（`DEFAULT_MAP_SIZE`，`gameStore.ts:311`）、people 200、`populationClasses {140,40,20,20}`、40 栋 `bld_farm`、全资源 5000、speed3；**夹具与 a2e3 E1 逐项对齐**（其 E2 末段已自证"阶层分布直接决定广播频率 2.32→5.59"，不配平＝两单读数不可比）。
6. **场景矩阵**（`S2/S3` 是"真机才量得到"的增量，S0/S1 的 CPU 腿 11e4 已离线量过）：
   | 场景 | 挂载面 | 要答的问题 |
   |---|---|---|
   | S1-裸 | 只 HUD（顶栏 11 个资源 token，`resourceRegistry.ts:11` `RESOURCE_IDS`；`HUD.ts:533 refreshResources`） | 稳态帧成本 |
   | S2-全屏面板 | HUD＋ProductionPanel＋PolicyTreePanel（`:106`/`:192` 都订 `RESOURCES_CHANGED`） | a2e3 E3 的"55.9 回调/帧上界"在真机是多少 ms |
   | S3-特效 | S2 ＋ 建筑落成脉冲（`GameScene.ts:66/71` 两个 listener → `pulseBuilding*`） | 每对象 stencil mask（`MapRenderer.ts:447-450`）＋生成纹理（`:471-482`）的 GPU 代价 |
   | S4-重绘尖峰 | S1 ＋ 一次 resize 触发 `rebuildAfterResize`（`MapRenderer.ts:354`，debounce 80/280 ms 见 `GameScene.ts:544-559`） | resize 帧是不是最大尖峰 |
7. **速度档**：S1–S3 各跑 speed3（500 ms/日）与 paused 两态；speed1/2 可选。**paused 态是天然的"零 L1 对照组"**——同场景暂停时的帧距即纯 L2＋L4，与 S1 相减就是逻辑腿，这一条能省掉一半插桩需求（Tier0 就能做）。
8. **环境同表登记（缺一即该轮作废）**：CPU 型号/逻辑核/内存（`node:os`，同 11e4 E1）、`nodeProcsAliveDuringRun`、GPU 型号＋驱动（`WEBGL_debug_renderer_info`，运行时一行可取）、`dpr`/backing store、`Phaser` 版本、**Electron 开关现值**（`src/main/index.ts:35-36` 两条 `appendSwitch`，必须原样抄进表头）、电源计划、**窗口是否前台**（`CalculateNativeWinOcclusion` 已关 ⇒ 后台不再被隐藏；且 `webPreferences.backgroundThrottling: false`（`src/main/index.ts:67-72`，同处另有 `sandbox:false`/`contextIsolation:true`/`nodeIntegration:false`）⇒ **失焦窗口仍按全速跑**，"切到别的窗口去录 60 s"这条路不会像常规 Electron 应用那样被降频，但也失去合成器节流，读数与玩家真实前台态不同型 ⇒ 必须录前台态，或至少两态各一轮）。
9. **禁止事项（写进执行班工单，防复发）**：不得以单帧/单轮宣称"优化了几 ms"——11e4 E4 同腿两次散布已达 **1.9×/7.4×**；不得跨探针混口径（CPU 腿离线条 vs 真机线条不可比，见其 E4②③与本档 §2.2 P10）。

---

## 4. 对正式包的零侵入策略（判据 ③：三层，推荐 Tier2）

现状事实（决定策略形状）：
- 本仓**产品码目前零处 `performance.mark/measure`、零处 `requestAnimationFrame`、零处 `import.meta.env`**（`grep -rn "performance.mark|performance.measure|actualFps|getEntriesByType|requestAnimationFrame|PerformanceObserver" src --include=*.ts` → **0 命中**，本单实测）⇒ 插桩是**从零加**，无历史包袱，也**无现成 dev 开关可复用**；
- 构建面：`electron-vite.config.ts` renderer 段（`root: src/renderer`，`build.outDir: dist/renderer`）**无 `define`、无 `drop`**；`package.json` 有 `dev`（`electron-vite dev`，vite `mode=development`）与 `build`（`electron-vite build`，`mode=production`）⇒ `import.meta.env.DEV` 可用，但**本仓尚无人用过**（属新引入约定，需在放行单里点名）。

| Tier | 做法 | 产品码改动面 | 生产包残留风险 | 适用腿 |
|---|---|---|---|---|
| **T0 零改动**（🥇 先榨干这层） | DevTools 控制台注入 `game.events.on('prestep'…)`（`game` 需可达：现 `src/renderer/main.ts:56` 的 `game` 是**模块级 const、未挂 window** ⇒ 严格 T0 需一条"取 game 句柄"的路；退路：直接在 Console 里用 Phaser 的 `window.Phaser`＋`Phaser.GAMES[0]`（Phaser 3.60+ 的全局游戏注册表）拿实例）；LoAF `PerformanceObserver`；`--trace-gpu` 外部轨迹；PresentMon | **0 行** | 0（不进包） | L1/L2 粗略、L4 全部、能力探测 |
| **T1 dev-only 模块＋编译期排除** | 新增 `src/renderer/dev/PerfProbe.ts`（新文件），入口只在 `main.ts` 用 `if (import.meta.env.DEV) { import('./dev/PerfProbe').then(m => m.install(game)) }` 三行挂载；生产包靠 vite 静态求值＋tree-shake 把 dev 目录整体丢出 bundle（`import()` 动态边界让排除可证），**再加一道 `build.rollupOptions.treeshake`/`define` 双保险** | 新文件 1 ＋ **`main.ts` 改 3 行**（`src/renderer/main.ts:56` 之后） | 低，且**可机器验证**：`electron-vite build` 后 `grep -r "PerfProbe\|prestep" dist/renderer/assets/*.js` 必须 0 命中；再 `grep "performance.mark" dist` 必须 0 命中 | L1/L2/条件 L3 |
| **T2 挂载式，不碰任何被插函数**（推荐） | 探针**只订阅 `game.events` 与 `store.on(...)`**（P1–P5、P8 全走事件），对 P7/P9 这类"函数内分段"**改用统计代理**：不插函数，而是每帧读 `game.loop.frame`＋计数器 ⇒ 放弃 L1 内部的 ms 级细分，换来**零侵入被插类** | 新文件 1 ＋ `main.ts` 3 行（同 T1 的门） ＋ `GameScene` **0 行** | 低（同上可验证） | L1 总时长、L2、L4 残差、事件计数 |
| T3 改被插函数（**不推荐**） | 在 `GameScene.update`／`MapRenderer.rerenderBuildings` 体内塞 `performance.mark` | 触及 2–3 个热路径文件＋对应快照/行为测试 | 中：忘删即生产包每帧产生 user-timing 条目（缓冲 250 上限、有内存/字符串成本） | 仅当 T1 读数不够归因时按点申请 |

**推荐**：**T0 → T2/T1 组合**。具体：
1. 先跑 T0（含 paused 对照组，§3.7）——**很可能 L4 与"值不值 60 fps"这两个问题在 T0 就答完了**，人工放行面缩到零。
2. 若必须归因到 tick/广播/重绘三源，才上 T2/T1，且遵守四条硬约束：
   - ① 编译期门（`import.meta.env.DEV`）＋**动态 import 边界**（保证可 tree-shake）；② 落盘"包内无探针"的双 grep 自检（上表）；③ 探针**自带解绑**（成对注册进 `GameScene.ts:562 shutdown` 语义之外——由探针自己 `game.events.off`，避免为它改被插类）；④ 采样上限与降频：**每帧只 `now()`，不 `mark()`**；`measure` 仅在 1/20 帧（避免 user-timing 缓冲溢出把真实样本挤掉）。
3. 🔴 明确**禁止**的两种"省事做法"：把开关做成运行时 `localStorage` 读（生产包里仍留代码路径与字符串，且无法用 grep 自证排除）；用 `Phaser.Config.debug: true`／`fps: { debug: true }`（会在正式包画 FPS 文本层，属可见行为改动）。

---

## 5. 数据落盘方案（本机现实：渲染进程写不了文件，除非加 IPC）

实测约束：`src/preload/index.ts:3-24` 暴露的 `colonyApi` 只有 `getVersion/saveGame/loadGame/listSaves/getSaveMeta/onWindowResized` **六个通道**，`src/main/index.ts:154-197` 只有对应四个 `ipcMain.handle`——**没有通用写文件通道**；且 `webPreferences` 为 `sandbox:false, contextIsolation:true, nodeIntegration:false, backgroundThrottling:false`（`src/main/index.ts:67-72`）⇒ 渲染层拿不到 `fs`；**`backgroundThrottling:false` 还意味着"窗口失焦后主循环仍全速跑"**（失焦不是空载对照，见 §3.8）。

| 方案 | 改动面 | 容量适配（§2.3：~430 KB/轮、峰值 ~13 MB） | 结论 |
|---|---|---|---|
| A 控制台 `console.table` ＋人工复制 | 0 | 只能到几百帧 ⇒ 必须降频（1/10 帧）或缩到 10 s | T0 阶段可用，做不了 60 s 全帧轨 |
| B `Blob`＋`<a download>`（Chromium 走保存对话框，落 userData 之外由用户选点） | 0（探针内部自造 DOM，不碰产品文件） | ✅ 够 | **推荐**（T0/T1 通吃）；注意 Electron 默认 `will-download` 行为，弹窗式落点＝自动化不友好，但插桩是一次性人工动作，可接受 |
| C 剪贴板 `navigator.clipboard.writeText` | 0 | ~1 MB 内可 | 辅助 |
| D 新增 dev-only IPC（`perf-dump`） | **产品码**：preload＋main 各 +1 通道 ⇒ 触碰 `src/main/index.ts`（注意：本仓 `npm run type-check` 的 tsconfig **不含 main**，须单跑 `npx tsc -p tsconfig.main.json --noEmit` 才看得到它） | ✅ | 🔴 需人工放行，**且已知该文件现存 2 枚遗留 TS 错**（`index.ts(93,9)/(93,18) TS18048`）⇒ 放行单里要预先声明"跑 type-check 会见到这 2 枚非本班错"，否则执行班会误判自己搞坏 |
| E 复用 `saveGame` 通道塞 JSON | 0 | ⚠ 会覆盖玩家存档位 | **禁止**（污染存档，且 `MAX_SAVE_BYTES = 10 MB` 闸在 `src/main/index.ts:152`，13 MB 直接被拒＝半截写） |

**落盘格式要求**（防"数据回来了但没人能读"）：单文件 **NDJSON（每行一帧）＋ 表头行（§3.8 环境）**；文件名 `perf-<场景>-<轮次>-<ISO本地>_<UTC>.ndjson`（本地与 UTC 同时戳，波次 brief §6 的时戳纪律）；表头必须含 `timeOrigin`，否则外部轨迹（PresentMon）与内部帧号对不齐 ⇒ §1 结论 D1 落空。

---

## 6. 交人工放行的最小改动面（本单一行码都没落）

| 项 | 文件 | 行数估计 | 回滚成本 |
|---|---|---|---|
| 探针模块（新文件） | `src/renderer/dev/PerfProbe.ts` | ~120–180 行（只订阅事件，不改任何被插函数） | 删文件即可，零牵连 |
| 挂载门 | `src/renderer/main.ts`（`:56` 之后） | **3 行**（`import.meta.env.DEV` 动态 import） | 删 3 行；`git revert` 单提交 |
| （可选）解绑挂钩 | `src/renderer/scenes/GameScene.ts` `shutdown` `:562` | 0（改由探针自己 `game.events.off`） | — |
| （可选）dev-only 写盘 IPC | `src/preload/index.ts` ＋ `src/main/index.ts` | +6 行 | 中（main 无 type-check 覆盖，须单跑 `tsconfig.main.json`） |

**放行前建议先做的三件零成本事**（都不需批）：① §3.7 的 **paused 对照组**；② §0 的 **T0 `Phaser.GAMES[0]` 控制台取实例**；③ **能力探测**（L3 的 timer-query 是否可用、`drawCalls` 是否暴露、GPU 字符串）——三条做完可能已经把"值不值 60fps、瓶颈在 L1 还是 L2"定死了，剩下只有 L3/L4 需要外部轨迹。

**本单未做（如实登记）**：未写探针、未改产品码、未新建测试件、未跑 vitest／type-check（判据 ④ 要求零码改动，跑测试只为"证明没改动"，主班 19:35 已跑全量 157 files／1,711 tests 全绿，本班不重复占并发负载）。

---

## 附：本档引用的 file:line 复核命令（可复算）

```bash
cd /d/code/colony-game
grep -n "appendSwitch" src/main/index.ts                       # :35 disable-gpu-vsync / :36 CalculateNativeWinOcclusion
grep -n "new Phaser.Game\|const dpr" src/renderer/main.ts       # :56 / :113
grep -n "override update(\|create(): void\|shutdown(): void" src/renderer/scenes/GameScene.ts   # :258 / :164 / :562
grep -n "update(realDeltaMs\|MAX_TICKS_PER_UPDATE" src/renderer/state/timeSystem.ts              # :18 / :14
grep -n "RESOURCES_CHANGED" src/renderer/state/gameStore.ts      # :115 :689 :812 :903 :934 :947
grep -n "rerenderBuildings(\|rebuildAfterResize(\|setSeasonTint(" src/renderer/render/MapRenderer.ts  # :662 / :354 / :1108
grep -n "PRE_STEP\|POST_STEP\|preRender()" node_modules/phaser/dist/phaser.esm.js | sed -n '1,20p'   # 17182-17214 Game.step 事件序列
```
