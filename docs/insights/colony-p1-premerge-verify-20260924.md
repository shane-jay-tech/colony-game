# colony P1 六行合入前置核验（c924-34，2026-09-24/25 夜班，只读＋草稿）

> **性质**：「等 M 收口」前的现状核验＋合入稿**草稿**。本文零改 `OPTIMIZATION_BACKLOG.md`／`PLAN.md`／`src/`，
> 合入动作文本只作候选，**交人工/主班执行**。
> **取数时点**：colony HEAD `a75a7d57a4c6c3716f9bc341b9e85076bd220d6f`（2026-09-25T01:05 +0800）。
> **在册在途 3 件（本单禁碰、也未碰）**：` M docs/design/OPTIMIZATION_BACKLOG.md`、` M docs/insights/colony-dead-exports-20260914.json`、` D …json.bak`。
> **并发**：同仓写位兄弟班 `qoder-executor-20260924-2341-colony28` 正在改 `src/renderer/render/`＋`MapRenderer.ts`（c924-27）——
> 本文凡引该两处的行号/行数都标了「⚠ 兄弟班在写，取数即快照」。

---

## 〇、先否证任务书的两处前提（不否证就会做错方向）

| # | 任务书/卷宗前提 | 实测 | 结论 |
|---|---|---|---|
| 1 | 判据①「`rg -n "terrain\|scatter\|audio" src/renderer/scenes/BootScene.ts` **六行**逐字入表」 | 该命令实际返回 **8 行**（rc=0），且**不含**任何 building/general/event 行、**不含** terrain 的 `for` 行（rg 默认大小写敏感，源码里是 `TERRAIN_ART`）。改 `rg -ni` 才得 **12 行**，仍不是六行 | **判据自相矛盾**：它给的命令复现不出它要的六行表。本单按 BACKLOG:41 括号里的六个锚点号逐行取，另把两条 rg 读数都留下（§一表尾） |
| 2 | 卷宗标题「P1 **五行**合入前置」、做什么段「出『**五行**合入 PLAN.md』的合入稿草稿」，但同一句又点名 `P1-1/2/3/6` 已勾＋`P1-4/5` 开栏 = **六项** | `awk '/^## P1 /{f=1;next} /^## P2 /{f=0} f' docs/design/OPTIMIZATION_BACKLOG.md \| rg -c '^- \['` → **6**（其中 `[x]` 4 行、`[ ]` 2 行） | 「五行」是过期计数；本单交**六行**齐全草稿，勾选态与现档逐行一致 |

> 另：卷宗 §产出要求的 `docs/insights/` 索引**未补**（3 份并存无权威、属待人工，按派单纪律不自行添行）。

---

## 一、六行对照表（BACKLOG:41 的六个锚点 vs 今日 HEAD 逐行实况）

`BootScene.ts` 今日 **103 行**、`git status` 未标脏（工作树＝HEAD）。锚点号按 BACKLOG:41 原文顺序：
「building/general/event 已由 artManifest 派生（BootScene.ts:46/64/70）；terrain/scatter/audio 仍为硬编码清单（BootScene.ts:53/57/71）」。

| # | BACKLOG 锚点 | 锚点号所在行**逐字** | 语义正确的实际行 | 判定（一致/漂移） |
|---|---|---|---|---|
| 1 | `:46` building 已派生 | `    }` | `:44` `    for (const item of getBootLoadList('building')) {`（体 `:45`） | **行号漂移 −2**；语义成立。锚点落在循环闭括号上 |
| 2 | `:64` general 已派生 | `    for (const item of getBootLoadList('general')) {` | 同左（体 `:65`） | **一致**（六个锚点里唯一逐字有效的那一个） |
| 3 | `:70` event 已派生 | `      const name = asset.key.startsWith('evt_art_') ? asset.key.slice('evt_art_'.length) : asset.key;` | `:69` `    for (const asset of EVENT_ART) {` | **行号漂移 −1 ＋ 语义只有一半**：键来自 manifest，但 `:71` 的 URL 是 BootScene 本地重拼模板 `art/events/${name}.webp`，**没消费 `asset.path`** |
| 4 | `:53` terrain 硬编码 | `    }` | `:51` `    for (const asset of TERRAIN_ART) {`（体 `:52` `this.load.image(asset.key, asset.path);`） | **行号漂移 −2 ＋ 描述已过期（本表头号否证）**：terrain 自 c918-04/05 起就**不再是硬编码清单**，键与 path 全取自 `artManifest.TERRAIN_ART`（:88-94 五条 `art/terrain/*.webp`，`required:true`），注释 `:49-50` 与 `artManifest.ts:115` 双双自证 |
| 5 | `:57` scatter 硬编码 | `    // 属「manifest 之外的第二事实源」，改扩展名时必须与本行一起改（c921-01 报告第四节已登记）。` | `:58` `    for (const id of SCATTER_IDS) {`、`:59` `      this.load.image(\`scatter_${id}\`, \`art/scatter/${id}.webp\`);` | **行号漂移 −1（锚在注释上）**；语义成立 |
| 6 | `:71` audio 硬编码 | `      this.load.image(asset.key, \`art/events/${name}.webp\`);` | `:77` `    for (const key of ALL_BGM_KEYS) {`→`:78` `.mp3`；`:80` `    for (const key of SFX_KEYS) {`→`:81` `.wav` | **行号归错面**：`:71` 属 event 循环，audio 的真实位置是 **78/81 两处**（两循环扩展名不同构）。语义成立但锚点无一行指向 audio |

**表尾两条 rg 读数（判据①的两个口径都留，便于复算）**

```
$ rg -n 'terrain|scatter|audio' src/renderer/scenes/BootScene.ts     → 8 行，rc=0
  4:import { ALL_BGM_KEYS, SFX_KEYS } from '../state/audioDirector';
  5:import { ALL_SCATTER_IDS as SCATTER_IDS } from '../data/scatterConfig';
 55:    // h912-11：manifest 无 scatter 类目，保留原清单。
 59:      this.load.image(`scatter_${id}`, `art/scatter/${id}.webp`);
 75:    // AudioManager 通过 cache.audio.exists(key) 自动静音降级。资产（Mureka 生成的 mp3）
 76:    // 落在 public/audio/<key>.mp3；尚未生成的 key 直接跳过、无声。
 78:      this.load.audio(key, `audio/${key}.mp3`); // BGM：Mureka 生成的 mp3
 81:      this.load.audio(key, `audio/${key}.wav`); // 音效：本地合成的短 wav

$ rg -ni 'terrain|scatter|audio' src/renderer/scenes/BootScene.ts    → 12 行，rc=0（多出的 4 行：6/49/51/…）
$ rg -c 'terrain|scatter|audio' src/renderer/scenes/BootScene.ts     → 8
```

**六个锚点的存活率：1/6 逐字有效（仅 `:64`）。⇒ 合入稿里凡引 BootScene 行号者一律改「内容定位」，不写行号**
（同族教训：`artManifest.ts:87` 注释已自写「此处不写行号，以免再漂」）。

---

## 二、P1-4 修正后的真实残余面（合入稿的立论依据）

把上表按「事实源在不在 manifest」重排，**BACKLOG:41 的三分法（building/general/event 已办，terrain/scatter/audio 未办）应改为四分法**：

| 资产类 | 键源 | URL/path 源 | 是否 manifest 权威 | 今日锚点（内容定位） |
|---|---|---|---|---|
| building(35) | `artManifest.BUILDING_ART` | `getBootLoadList` 内模板 `art/buildings/…` | **半**：键✓ 路径✗（模板在 `artManifest.ts:133`，不在条目 `path`） | `BootScene.ts` `for (const item of getBootLoadList('building'))` |
| general(5) | `artManifest.GENERAL_ART` | 同上（`artManifest.ts:138`） | **半**：键✓ 路径✗ | `for (const item of getBootLoadList('general'))` |
| event(10) | `artManifest.EVENT_ART` | **BootScene 本地模板** | **半**：键✓ 路径✗（`BootScene.ts` `this.load.image(asset.key, \`art/events/${name}.webp\`)`） | 同上 |
| terrain(5) | `artManifest.TERRAIN_ART` | **`asset.path`（manifest）** | **✅ 全量收口**（生产码里唯一真消费 `path` 字段的一类） | `for (const asset of TERRAIN_ART)` |
| scatter(8) | `data/scatterConfig.ALL_SCATTER_IDS`（**非 manifest**） | **BootScene 本地模板** | ✗ 双面都在 manifest 外 | `for (const id of SCATTER_IDS)` |
| audio(bgm 9＋sfx 6) | `state/audioDirector.ALL_BGM_KEYS/SFX_KEYS`（**非 manifest**） | **BootScene 本地模板 ×2**（mp3/wav 不同构） | ✗ 双面都在 manifest 外 | 两条 `this.load.audio(...)` |

**本单新增、c922-110 设计稿未点名的一条**：`ART_MANIFEST` / `getArtByCategory` / `isArtAvailable` 三个聚合出口
**在生产码里零消费者**（`rg -n 'ART_MANIFEST|getArtByCategory|isArtAvailable' src/ -g '!**/__tests__/**'` → 只命中 `artManifest.ts` 自己的 3 行定义，rc=0 但零外部引用）。
⇒ 今天所谓「以 artManifest 为唯一加载源」，实际生效的是 **4 个子数组 + `getBootLoadList`**，聚合表是**测试专用面**。
合入稿措辞因此不能写成「manifest 已成为唯一加载源」，只能写「building/general/event/terrain 四类的**键**已由 manifest 描述」。

**前置设计稿仍在册**：`docs/design/p1-4-manifest-authority-20260922.md`（c922-110，设计级、零实施）。
本单复验其 §〇 六个锚点：`BootScene.ts:58/77/80`、`artManifest.ts:19/115/129` 与 `getBootLoadList` 的两处模板（:133/:138）
**今日全部未漂**（该稿写稿时已用内容定位，比 BACKLOG 抗漂）。⇒ P1-4 的收口路径不必重议，缺的只是**实施＋人工拍板 audio 方案 A/B/C**。

---

## 三、P1-5「启动配置全量复核」缺位面（判据②的答复）

### 3.1 先纠一条在册矛盾（本单最有决策价值的一条）

BACKLOG:42 的半句「**本轮未做全量启动配置复核**」与在档结论**相反**：
`docs/insights/colony-startup-config-audit-20260917.md`（916p-a3-009，**在 HEAD 里**，`git ls-files` 命中）§四结论
自写「**启动配置全量复核已收口**：8 个链路文件全部可达…退役 3 件零残留」。
`colony-optibacklog-status-draft-20260922.md:63-68` 已就此建议**勾 P1-5 并给出替换行**；`colony-plan-ledger-20260922.md:49` 却采信 BACKLOG 的「未做」口径 ⇒ **两份 9/22 档互斥**（属 `docs/insights/` 索引三档并存无权威的同型问题，待人工）。

**本单独立复算 9/17 档的三条判据（不抄它的数）**：

```
$ find src/main -type f                                   → 1（src/main/index.ts）
$ ls src/renderer/scenes/*.ts | wc -l                     → 6（Boot/Game/Intro/ModeSelect/Transition/UI）
$ wc -l src/renderer/main.ts                              → 185（与 9/17 档自述一致）
$ rg -n 'scene: \[' src/renderer/main.ts                   → :52  scene: [BootScene, ModeSelectScene, IntroScene, GameScene, TransitionScene, UIScene],
                                                            ⇒ 「6 场景全注册 @ main.ts:52」今日仍成立（未漂）
$ rg -n 'resourceSystem|terrainTextures|storyNpcs' src/ -g '*.ts'   → 无输出，rc=1
$ git grep -n -E 'resourceSystem|terrainTextures|storyNpcs' -- 'src' → 无输出，rc=1
  （双轨皆 0；再放宽到全仓则只命中 docs/**（历史决策/洞察档），src/ 与 tests/ 仍 0 ⇒ 退役 3 件零残留成立）
```

⇒ **复核确实做过、结论今日仍成立**。P1-5 缺的不是「再复核一遍」，而是「把在档结论回填 BACKLOG」这一动作本身（属人工闸）。

### 3.2 真正的缺面：9/17 审计**未覆盖**的启动配置面（逐条给命令与读数）

9/17 档的口径是「**文件级可达性**、8 个文件」。以下是它没碰过的面，合入稿据此**不能把 P1-5 写成"分支级全量"**：

| # | 缺面 | 实测读数 | 为什么算启动配置 |
|---|---|---|---|
| G1 | `src/preload/index.ts`（**40 行，不在 8 文件清单内**） | `:27 contextBridge.exposeInMainWorld('colonyApi', api)`；`:32` 有 catch 降级分支 | 主↔渲染 IPC 面的启动入口；审计只数了 `src/main` |
| G2 | `src/shared/`（2 个非测试件：`palette.ts`、`visualConstants.ts`） | 审计 8 文件不含 | PLAN §3「shared visual constants」的落点 |
| G3 | `src/main/index.ts` 的**分支级**可达性 | `rg -c 'if \(|isPackaged|process\.platform' src/main/index.ts` → **21 行命中**（⚠ 其中多数是 IPC 处理器的入参校验，非启动分支；**属启动配置的子集是这 4 处**：`:45 return app.isPackaged`、`:144-145 if (process.env.ELECTRON_RENDERER_URL) loadURL(...)`、`:221 if (process.platform !== 'darwin') app.quit()`、`:125-131` 崩溃重试） | 审计只判定「该文件可达」，未逐分支判 |
| G4 | `electron.vite.config.ts` 的 env 注入面 | `:18 loadEnv(mode, process.cwd(), '')`（**空前缀＝全量注入**）；`:30-31 define` 只转发 `ELECTRON_CACHE`／`ELECTRON_BUILDER_CACHE` 两键 | 打包期启动配置 |
| G5 | 仓根 env 档的**键可达性** | `git ls-files \| rg '\.env'` → 仅 `.env.development` 入库；键名清单：`.env.development` 6 键、`.env.local` 1 键（`MUREKA_API_KEY`，**已 gitignore，本单只取键名、未读值**）。逐键 grep `src/ electron.vite.config.ts`：`ELECTRON_CACHE`/`ELECTRON_BUILDER_CACHE` **各 1 文件读取**；`ELECTRON_DOWNLOAD_PATH`/`ELECTRON_MIRROR`/`ELECTRON_BUILDER_BINARIES_MIRROR`/`NODE_COMPILE_CACHE`/`MUREKA_API_KEY` **仓内读取点 = 0** | 「接线或删除」的字面命中面 |
| G6 | 渲染侧**启动路由分支** | `BootScene.ts` `create()` 内 `if (registryGet(this.registry, REGISTRY_KEYS.introDone)) { scene.start('GameScene') } else { scene.start('ModeSelectScene') }` | 这才是 BACKLOG:42 语义上的「启动配置分支」，9/17 档只在文件级出现 |
| G7 | 运行期开关 | `rg -n 'import\.meta\.env' src/` → **rc=1（0 命中）**；`rg -n 'URLSearchParams\|location\.search\|location\.hash' src/` → **rc=1（0 命中）**；`localStorage` 仅 3 个非测试/测试混合文件（`settingsStore.ts`、`ScoreCardPanel.ts`） | 结论：**无 URL/env 驱动的功能开关**，这条不是缺面而是「已排除项」（写明免得下次再查） |
| G8 | `gameConfig.ts`（E-2 旧桩，`docs/decisions/2026-08-14-…:103` 记其在 `24b03c8` 删除） | `rg -n 'gameConfig' --glob '!node_modules'` → 只命中 2 份历史决策档，源码 **0** ⇒ 删除自证成立 | 曾被点名过的桩 |

> ⚠ G5 的「0 命中」**不等于不可删**：`ELECTRON_MIRROR`／`ELECTRON_DOWNLOAD_PATH`／`ELECTRON_BUILDER_*`／`NODE_COMPILE_CACHE` 是被 **electron-vite / electron-builder / Node 进程自身**在仓外读取的工具链环境变量，仓内正则天然看不见。
> 唯一真正「仓内 0 读取且非工具链」的候选是 **`MUREKA_API_KEY`**（属凭据名，红线域，本单不判、不动、不读值）。

### 3.3 因此 P1-5 的可写口径（三档，按人工愿意承担哪档写哪档）

- **档 1（最保守）**：勾 `[ ]` 不动，只把「本轮未做全量启动配置复核」改成「文件级 8 件已复核（9/17 档，今日三判据复算仍成立）；**分支级/工具链 env 面未核**」。
- **档 2（本单建议）**：勾 `[x]`，措辞限定在「**启动链路文件级可达性**收口」，并显式点名 G1–G6 六个未覆盖面为后续项。
- **档 3（不建议）**：勾 `[x]` 且沿用 9/17 档「全量复核已收口」的原话——G1–G6 使这句话在**分支级口径下不成立**。

---

## 四、合入稿草稿（六行齐全，勾选态与现档逐行一致）

> 用途：M 收口后一次性替换 `docs/design/OPTIMIZATION_BACKLOG.md` 的 P1 六行（现档 `:38-43`）。
> **本文不代改**。每行都做了「证据锚点今日复算」，凡漂移者草稿里已改成**内容定位**（不写行号，理由见 §一头号教训）。

### 4.1 复算后与现档证据行的差额（先看这个再决定要不要合）

| 现档行 | 现档证据原文里的锚点 | 今日复算 | 判定 |
|---|---|---|---|
| P1-1 | 「**50 个事件**全覆盖」 | `stateEvents.ts` 的 `GameStateEventMap` 键 **55**、`STATE_EVENT_NAMES` 数组 **55**、`gameStore.ts:114 STATE_EVENTS` 表 **55**；三轨差集全空（python 正则计数＋rg 计数双轨一致） | **过期 +5** |
| P1-2 | `registry.ts:29` REGISTRY_KEYS；`:86/:91` 泛型 get/set；守护用例 | `:29` ✓、`registryGet` `:86` ✓、`registrySet` `:91` ✓、`src/renderer/ui/__tests__/registry.test.ts` 存在 ✓（文件 99 行） | **全中**（P1 六行里唯一证据一字未漂的） |
| P1-3 | `dayPipeline.ts:52` DAY_PHASE_DEFS；`gameStore.ts:**54/939**` | `:52` ✓（文件 118 行）、`gameStore.ts:54` import ✓；调用点实为 **`:948` `runDayPipeline(buildDayPipeline({`** | **漂移 +9**（一处） |
| P1-4 | BootScene 六锚点 | 见 §一 | **漂移 5/6 ＋ terrain 归类错** |
| P1-5 | 「退役 3 件＝aad0592」「本轮未做全量复核」 | `git cat-file -t aad0592` → commit ✓（2026-09-13，「resourceSystem.ts 不可达模块退役」）；「未做复核」与 9/17 档矛盾 | **半真**：退役件为 1 个 commit 里的 **1 档**，另 2 件（terrainTextures/storyNpcs）在别处退役，本单未逐一追 commit（不扩范围），只保证 src 零命中 |
| P1-6 | `cameraMath.ts` **79 行**；`MapRenderer.ts:11-12` 导入 | `wc -l src/renderer/render/cameraMath.ts` → **90 行**；`MapRenderer.ts:11`、`:12` 两条 import ✓（另有 `:23` re-export） | **行数漂移 +11 ⚠ 兄弟班在写，此为快照值**；import 锚点仍中 |

### 4.2 草稿正文（六行，可直接粘贴）

```markdown
- [x] **P1-1 类型化事件面（核心）**：`GameStateEventMap` 载荷契约 + 泛型 `on/off/emit`（**55 个事件全覆盖**，运行时双向守护测试）；监听方逆变兼容无需迁移。内部 emit 与逐订阅点迁移留后续低风险渐进。（证据：src/renderer/state/stateEvents.ts `interface GameStateEventMap` 与同档 `STATE_EVENT_NAMES` 各 55 键、`gameStore.ts` `STATE_EVENTS` 常量表 55 条，三轨差集为空；守护 src/renderer/state/__tests__/stateEvents.test.ts。c924-34 复算：原记「50」为 8 月旧数，已 +5）
- [x] **P1-2 registry key 类型化**：集中 Phaser registry key 常量 + typed get/set helper，替换散落的字符串。（证据：src/renderer/ui/registry.ts:29 REGISTRY_KEYS 单一事实源；registry.ts:86/91 泛型 registryGet/registrySet；src/renderer/ui/__tests__/registry.test.ts「不再有散落字符串」守护用例。c924-34 复算：三锚点逐字未漂）
- [x] **P1-3 tickDay 阶段管道抽取**：每日阶段顺序抽出为可测 pipeline，GameStore 保留兼容 facade，阶段顺序加显式测试。（证据：src/renderer/state/dayPipeline.ts:52 DAY_PHASE_DEFS；GameStore 侧以「import 行 + `runDayPipeline(buildDayPipeline(` 调用点」内容定位，不写行号以免再漂；src/renderer/state/__tests__/dayPipeline.test.ts。c924-34 复算：原记 gameStore.ts:939 已漂至调用点现值，故改内容定位）
- [ ] **P1-4 资产清单权威化**：BootScene 以 `artManifest` 为唯一加载源，删除重复加载列表。（现状 c924-34 修正版：**terrain 已完成收口**——键与 path 全取自 `artManifest.TERRAIN_ART` 并直取 `asset.path`，原「terrain 仍硬编码」的自述过期，故从开栏理由里删除；**仍开栏的残余是三类**：① scatter（键在 `data/scatterConfig.ALL_SCATTER_IDS`、URL 模板在 BootScene，两面都在 manifest 外）② audio（键在 `state/audioDirector` 的 `ALL_BGM_KEYS`/`SFX_KEYS`，两条加载循环扩展名不同构 .mp3/.wav）③ building/general/event 的**路径**仍由模板重拼、未消费 `path` 字段（⇒ 生产码里 `ArtAssetDef.path` 只有 terrain 真被读）。另记：`ART_MANIFEST`/`getArtByCategory`/`isArtAvailable` 三个聚合出口在生产码**零消费者**，只被测试读。收口路径见 docs/design/p1-4-manifest-authority-20260922.md（c922-110，设计级零实施），其 §五 audio 方案 A/B/C **待人工拍板**，本文不代决定）
- [ ] **P1-5 启动配置清理**：接线或删除不可达的启动配置分支（PLAN 工作项 2 末条＝PLAN.md §2 第 5 条「Resolve stale/unreachable startup configuration code」）。（现状 c924-34：**「本轮未做全量复核」这句与在档冲突**——docs/insights/colony-startup-config-audit-20260917.md 已自写「文件级 8 件全可达、退役 3 件零命中」，本单三判据独立复算仍成立（src/main 1 件、scenes 6 件全在 renderer/main.ts 的 `scene: [...]` 注册、`rg`＋`git grep` 双轨对退役三名均 rc=1 零命中；`gameConfig` 仅存历史决策档）。**但分支级/工具链面仍未核**，六项在册：`src/preload/index.ts`（40 行，含 contextBridge 失败降级分支）、`src/shared/` 2 件、`src/main/index.ts` 的 4 处启动相关分支（该文件 `if (／isPackaged／process.platform` 命中 21 行，多数为 IPC 入参校验，故不写成「21 个启动分支」）、`electron.vite.config.ts` 的 `loadEnv(mode, cwd, '')` 全量注入 + 仅转发 2 键、仓根 `.env.*` 键的逐键读取（4 个 electron/Node 工具链键仓内天然 0 读取、不可据此判删）、BootScene.create 的 `introDone` 路由分支。**已排除项**：`import.meta.env` 与 URL 参数开关在 src/ 均 0 命中。⇒ 是否把本行改勾＝人工裁决（三档措辞见 docs/insights/colony-p1-premerge-verify-20260924.md §3.3））
- [x] **P1-6 渲染职责拆分**：MapRenderer 的视口/相机计算抽出纯函数 + 测试（等距投影已有 `render/iso.ts`，先查重）。（证据：src/renderer/render/cameraMath.ts 纯函数模块；MapRenderer.ts 的 cameraMath import 与 `export { MAP_ZOOM_MIN, MAP_ZOOM_MAX } from './cameraMath'` re-export，均以内容定位不写行号；src/renderer/render/__tests__/cameraMath.test.ts。⚠ c924-34 取数时该模块**正被同仓写位班 c924-27 修改**（原记「79 行」读为 90 行），合入前须由收口班重取一次行数与用例数）
```

**勾选态对账（判据③）**

```
$ rg -c '\[x\]' docs/design/OPTIMIZATION_BACKLOG.md   → 22（全档）
$ awk '/^## P1 /{f=1;next} /^## P2 /{f=0} f' docs/design/OPTIMIZATION_BACKLOG.md | rg -c '^- \[x\]'  → 4
$ awk '/^## P1 /{f=1;next} /^## P2 /{f=0} f' docs/design/OPTIMIZATION_BACKLOG.md | rg -c '^- \[ \]'  → 2
⇒ 草稿仍为 P1 段 4 勾 / 2 开栏，与现档逐行一致（P1-1/2/3/6 勾、P1-4/5 开栏）；未新增未删除行
```

> 若人工选 §3.3 档 2，则 P1-5 转 `[x]` ⇒ P1 段变 **5 勾 / 1 开栏**、全档 `[x]` 22→**23**。这是**改计数口径**动作，
> 本单按纪律**不自行执行**，只把两个数写清供对账。

---

## 五、交人工／主班裁决出口（本单零处置动作）

1. **BootScene 六锚点怎么改**：(a) 整行删除行号、只留内容定位（本单推荐）；(b) 换成今日实测行号 `:44/:51/:58/:64/:69/:77/:80`；
   选 (b) 则**下次编辑必再漂**，不建议。
2. **P1-4 措辞**：terrain 已从"未收口"移到"已收口"，是否接受把开栏理由从三类改写成三类的新名单（scatter/audio/路径重拼面）？
   这是**口径改写**，不是勾与不勾，风险低于 P1-5。
3. **P1-5 勾/不勾**：§3.3 三档。**本单推荐档 2**，但改勾涉及"在档两互斥结论择一采信"（9/17 档 vs plan-ledger），属人工裁决，不属执行手判断。
4. **P1-6 是否等 c924-27 落地后再合**：兄弟班正在往 `render/` 加纯函数并改接 `MapRenderer`；现在合入稿会把一个**正在变的行**（cameraMath 行数/用例数）钉进 BACKLOG。
   出口：(a) 等其收口后由收口班重取；(b) 现在合但行数留「内容定位不写行数」。草稿采 (b)。
5. **`MUREKA_API_KEY` 读取点为 0 一事**：属凭据名，红线域——本单未读值、未判可达、未建议删除；需要人时再开只读单查 `scripts/` 与 CI 侧引用。
6. **`docs/insights/` 索引未补**：三份索引并存无权威（待人工在册项），本单按派单纪律**未自行加行**。

---

## 六、判据逐条对照与零改动自证

| 完成标准 | 实测 | 判定 |
|---|---|---|
| ① rg 六行逐字入表 | §一（六个锚点逐行给"锚点行原文"＋"语义正确行"）；两条 rg 口径读数（8 行/12 行）都在表尾 | **达成（口径已按判据自矛盾修正）** |
| ② 每行标注一致/漂移 | §一「判定」列：一致 1（`:64`）、漂移 5（`:46/:70/:53/:57/:71`，其中 `:53` 兼语义过期、`:71` 兼归错面） | 达成 |
| ③ 草稿五行齐全、勾选态与现档一致、`rg -c "\[x\]"` 对账 | §4.2 交**六行**（"五行"系过期计数，见 §〇之 2）；对账读数 22 / 4 / 2 已贴 | 达成（数量按实况修正为 6） |
| ④ 零 BACKLOG/PLAN 改动 | 见下方命令 | 达成 |

```
$ git status --porcelain                       # 收班时点
 M docs/design/OPTIMIZATION_BACKLOG.md         ← 在册在途，开工前即脏
 M docs/insights/colony-dead-exports-20260914.json   ← 在册在途
 D docs/insights/colony-dead-exports-20260914.json.bak ← 在册在途
?? docs/insights/colony-p1-premerge-verify-20260924.md ← 本单唯一产物
（另：兄弟班 c924-27 的 render/ 改动不在此列，本单未碰）

$ git diff docs/design/OPTIMIZATION_BACKLOG.md PLAN.md | sha256sum
开工时点 = 收班时点 = 08538b686d9b3e9c66fc70ebe388c56e46c819436bec7983a82f5c986c15623c（逐字相同 ⇒ BACKLOG/PLAN 零改动）
$ ls -la --time-style=full-iso PLAN.md docs/design/OPTIMIZATION_BACKLOG.md
PLAN.md mtime 2026-09-04 23:54:39 ／ BACKLOG mtime 2026-09-15 03:08:29（两值开工前即此，未刷新）
```

**计时（并发窗，不可与单跑窗比）**：`max_minutes: 20`；本单实际耗用约 12–15 分钟档（同窗有兄弟班在写 `render/`，
所有 vitest/构建类耗时本单一律**未跑**，故不产生可比的计时读数）。

---

## 七、遗留问题

1. `BootScene.ts` 六锚点 5/6 已漂——**BACKLOG 里同类"行号式证据"整体不可信**，本单只修了 P1 六行涉及的部分，P0/P2 段未扫（不在判据内）。
2. P1-5 的 `colony-startup-config-audit-20260917.md` 与 `colony-plan-ledger-20260922.md` **两份在档结论互斥**，需人工择一采信并留痕（本单证据偏向 9/17 档，因为三条判据今日复算仍成立）。
3. 9/17 审计档 §二表格里的 `main.ts:55`（写「Phaser.Game 实例化 :55」）今日读为**注释行**，实例化在其后 ⇒ 该档自身也有行号式证据在漂；属他班在册档，本单不改。
4. `MUREKA_API_KEY` 读取点 0（红线域，未判）；G1–G6 六个启动配置未覆盖面尚无任一档在核，若人工选 P1-5 档 1，需要另开单。
5. 本文未补 `docs/insights/` 索引（三份并存无权威，待人工）。
