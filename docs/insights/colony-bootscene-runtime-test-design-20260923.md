# colony BootScene 运行时错误面测试设计稿（c923-13，只设计不实现）

- 单号：`c923-13` · 班：`qoder-executor-20260923-0022-colony6` · 取数时刻 2026-09-23T11:0x（+08:00）
- cwd `D:\code\colony-game`，HEAD `127f4d0`，开工工作树 3 项在册在途（`docs/design/OPTIMIZATION_BACKLOG.md` ` M`、`docs/insights/colony-dead-exports-20260914.json` ` M`、其 `.bak` ` D`），**本单零触碰**
- 性质：**设计稿**。生产码/测试码/经济数值/存档常量零改动；`git diff --stat` 收工为 0（见 §8）
- 上游：`zcode-bridge/done/c922-13-colony-testmap.result.md` 遗留 3——「零测清单 15 件里 BootScene 运行时面（错误处理/进度，非加载清单）是唯一的高价值真缺口，建议按此排序派下一单」

---

## 1. 结论先行（三句）

1. **两处 catch 的真实覆盖面只有 4 条路径，且其中 2 条在真链上结构不可达**：`:24` 的重抛在生产上会被 `main.ts:119` 的同名校验**抢先抛掉**（BootScene 的 preload 要等 Phaser 的 RAF 第一步才跑）；`:90` 捕获的 `document.fonts.ready` **在浏览器里基本不会 reject**（`FontFaceSet.ready` 对单个 face 失败只置 `status='error'`，仍 resolve），而本仓 `vitest.config.ts` 是 `environment: 'node'` ⇒ `:87` 的外层守卫直接短路，**`:90` 在现有测试环境下 100% 不可达**。
2. **任务书的前提「进度条副作用」按字面为假**：BootScene 全文 103 行里 `this.add.*` **0 处**、`load.on('progress')` **0 处**、`src/renderer/index.html` 无 loading 遮罩（只有 3 段 `@font-face`）。BootScene 根本没有进度 UI，「进度」只剩 Phaser LoaderPlugin 内部那条没人听的 `progress` 事件。真实可观测的"进度副作用"是 **preload 抛错后 Loader 一次都不 start、纹理缓存全空 ⇒ 下游 MapRenderer/AudioManager 全量走缺图/静音降级**。设计稿把这条改写成可钉的**降级面契约**（§3 B 组）。
3. **最高价值的可钉物不是那两处 catch，而是 catch 抓不到的三类静默失败**：① `preload` 抛错 ⇒ RAF 循环**永久停摆**（Phaser 源码级证据，§4），比"崩一屏"更糟，且现网唯一可见信号是 `main.ts` 的崩溃覆盖层；② `this.load.image(key,…)` 键冲突 ⇒ LoaderPlugin **静默丢弃该文件**（无 warn、无 loaderror、无事件），键一旦重名就是"图不显示且零线索"；③ `async create()` 的 await 之后抛错 ⇒ Phaser 不 await、catch 也管不到 ⇒ 变成 `unhandledrejection`。这三类都可用**零 Phaser 依赖**的桩钉死（§5 档 A/档 C），估工 0.5 人日。

---

## 2. 锚点复核（卷宗每句前提的实测，含否证）

| # | 卷宗前提 | 实测命令 | 读数 | 判定 |
|---|---|---|---|---|
| A1 | `BootScene.ts:24`「} catch (err) {」 | `rg -n --glob '!tmp/**' catch src/renderer/scenes/BootScene.ts` | `24:` `90:` 两行，**仅此两处** | ✅ 成立（无漂移） |
| A2 | 同上的"两处 catch" | `rg -c` | `2` | ✅ |
| A3 | 「运行时错误处理/**进度**分支」——BootScene 有进度副作用可测 | `rg -n "this\.add\.\|load.on('progress'\|Progress"` ＋ `rg -i progress src/renderer/index.html` | BootScene 内 `this.add` **0 处**、`load.on('progress')` **0 处**；index.html 仅命中 `@font-face` 3 段（:12/:19/:26），无 loading 遮罩 | ❌ **否证**：BootScene 无进度条。已按实况收窄为「降级面契约」（§3 B 组），不判 failed |
| A4 | 上游锚点「BootScene 运行时面是 15 件零测清单里唯一高价值真缺口」 | `rg -n "BootScene" src/renderer/**/__tests__` | 命中 3 件：`bootLoadErrorDedup.test.ts`（源级，2 例）、`scatterSourceGuard.test.ts`（源级，3 例）、`bootLoadList.test.ts`（数据面，10 例）。**无任何测试 import BootScene 类**（`rg "import.*BootScene" src scripts` 只命中 `main.ts:3`） | ✅ 成立：现有 15 例全在「源文本字面」与「清单/磁盘」两面，**行为面 0 覆盖** |
| A5 | c922-04 §二 的「模板复刻」教训仍相关 | `docs/insights`（c922-04 result 遗留 2）＋ `bootLoadList.test.ts:141` 注释自述 | 该文件明写"BootScene.preload 的五个加载源，按代码原文逐字复刻" ⇒ **复刻面**已有一把守卫，但只比 URL 与磁盘，不比行为 | ✅ 引用于 §5 档 B/C 的边界说明 |
| A6 | 现有 fake 脚手架能否直接跑 BootScene.preload | 读 `src/renderer/ui/__tests__/fakeScene.ts:196-270` | `makeSceneClassMock()` 的 `FakeScene` 有 `add/textures/cache/sound/events/scale/input/tweens/time/cameras/registry/scene/sys`，**唯独没有 `this.load`** | ❌ 关键否证（对"直接套现有 mock 就能测"的想当然）：`new BootScene().preload()` 会在 `:34 this.load.on(...)` 抛 `TypeError`。桩方案必须先补 `load` facet（§5 档 B） |
| A7 | 测试环境能否走到 `:90` | `cat vitest.config.ts` | `environment: 'node'`，`include: ['src/**/__tests__/**/*.test.ts','scripts/__tests__/**/*.test.ts']` ⇒ node 下 `typeof document === 'undefined'`，`:87` 守卫整块跳过 | ❌ **`:90` 默认不可达**；且 `rg -n "globalThis.document\|stubGlobal" src` **0 命中** ⇒ 全仓无注入 `document` 的先例（§5 档 B 的第 2 个前置） |
| A8 | 加载清单现值（B 组用例的分母） | `npx tsx tmp/c923-13/probe.mts` | 图 **63** 条（building 35 / terrain 5 / scatter 8 / general 5 / event 10，与 c922-04 钉的 63 一致）＋ 音频 **15** 条（bgm 9 / sfx 6）＝**78** 个加载项；同类型键冲突 **0**、图/音跨类型重叠 **0**、空键 **0** | ✅ 现状干净 ⇒ 冲突守卫是**未来 canary**，不是现网修 bug |
| A9 | 字体文件在盘（决定 `fonts.ready` 的真实形态） | `ls -la public/fonts` | **空目录**（0 项，mtime 2026-05-28）；`index.html` 三处 url 为 `/fonts/NotoSerifSC-Regular.otf` 等 | ✅ 与纪律档 §十二 在册缺陷一致（3 处 `@font-face` 指向从未入库的空目录）。**本单不补不删**，只在 §6 标为「不可用真字体做夹具」的约束 |

---

## 3. 分支清单（完成标准 ①）

### A 组：两处 catch 本体（卷宗点名）

| 锚点 | 受保护语句 | 可抛类型（实测来源） | 覆盖路径数 | catch 内动作 | 恢复路径 |
|---|---|---|---|---|---|
| `BootScene.ts:24`（`preload()` 内） | `:23 validateStaticData()` | `ModifierValidationError`（`data/modifierValidator.ts:20` `class … extends Error`，抛点 :31/:37/:43/:53/:60/:88/:106/:115 共 **8 处**）；深层 DSL 校验的 `DslSyntaxError`（`data/dslCore.ts:95/:125/:132/:168` 共 **4 处**）——两者都从 `validateStaticData → validateAllStaticData` 冒上来，catch 收 `err: unknown` **不区分类别** | **2**（正常返回 / 抛错） | `console.error('[BootScene] static data validation failed:', err)` | **无恢复**：`:26 throw err` 原样重抛 ⇒ 见 §4 传播链。此 catch 的全部作用是"多打一条 console.error" |
| `BootScene.ts:90`（`create()` 内） | `:89 await document.fonts.ready` | 浏览器侧：`FontFaceSet.ready` 的 reject（实践上仅在不支持/被中止时；**单个字体 404 不 reject**，见 §2 A9 语境）；node 侧：不可达（`:87` 守卫先短路） | **2**（resolve / reject）＋外层 `:87` 守卫的 **3** 条前置路径：①`document` undefined ②`document.fonts` falsy ③两者齐备 | `console.warn('[BootScene] fonts.ready rejected; FOUT may occur:', err)` | **吞掉并继续**：不 rethrow、不设标志位，直接落到 `:97` 的分支 ⇒ 唯一副作用是 FOUT（文字先回退字体后回流） |

> 合计：两处 catch 的**受保护路径 4 条**；含 `:87` 守卫前置则 A 组共 **7** 条可分岔路径。

### B 组：catch **抓不到**的运行时错误/降级面（本单真正建议测的对象）

| # | 位置 | 行为 | 谁捕获它 | 可测性 |
|---|---|---|---|---|
| B1 | `:24` 重抛之后 | `preload` 抛 ⇒ Phaser `SceneManager.bootScene` 的 `settings.status = LOADING`／`loader.start()` 两行**都不执行**，且异常沿 `RAF step → callback 先跑、后重排`（`src/core/TimeStep.js`→`src/dom/RequestAnimationFrame.js` 的 `step`，见 §4）逃逸 ⇒ **本帧之后再无帧**，画面永久停在 `backgroundColor: COLORS.BG_INK` | 无人：`Game.js`/`SceneManager.js` **零 try/catch**；只有 `main.ts:88-94` 的 `window 'error'` 覆盖层给用户看 | 高（源级契约＋纯函数复算，见 §5 档 A） |
| B2 | `:34-37` `loaderror` 回调 | 缺图 → `console.debug` 单条；键进不了 TextureManager → 下游 `textures.exists(key)` 返 false | Phaser Loader；本仓 `bootLoadErrorDedup.test.ts` 已钉「注册恰 1 处 + 回调体单条 debug」 | **已覆盖**（不重复建），本设计只补「注册次数 == 1」之外的**回调行为**（传 `file.key` 打的是 debug 而非 error、不抛） |
| B3 | `:44-82` 七个加载循环 | `this.load.image/audio(key,url)` 撞键（同类型已在 cache/list/inflight）⇒ `LoaderPlugin.addFile` 的 `if (!this.keyExists(item))` **整支跳过**：**无 warn、无 loaderror、无 ADD 事件**，静默少一个文件 | 无人 | 高：纯数据可钉（78 键跨源唯一性），现值 0 冲突 ⇒ canary（§5 档 C，A8 实测即夹具） |
| B4 | `:44`/`:64` `getBootLoadList(...)` | 生产函数本体**不抛**（`artManifest.ts:129-140` 仅 `map`；`BUILDING_ART_REUSE[a.key] ?? a.key` 有 `??` 兜底），但若 manifest 键与 `REUSE` 值漂了只会拼出 404 URL → 落回 B2 | — | 中（磁盘轨已由 c922-04 钉；行为轨只剩 B2 一条） |
| B5 | `:70` `asset.key.startsWith('evt_art_')` 重拼 URL | 键若不带前缀则 `name = key` 原样使用 ⇒ 得到 `art/events/<key>.webp`。这是「manifest.path 与运行时 URL 两轨」的老洞（c921-01 登记） | 无人 | 中：c922-04 的不变量二已在数据面钉住**同义性**，BootScene 侧不必重复；本设计只要求**别把重拼模板再复刻一遍**（见 §5 复刻红线） |
| B6 | `:87` 守卫本身 | node / 无 DOM 环境下整块跳过 ⇒ 同一份 create() 在两种环境走两条不同路径 | 无人 | 高：`vi.stubGlobal('document', undefined)` 与真 node 环境对跑，可钉「跳过时不产生任何 console 输出」 |
| B7 | `:97-101` `registryGet → scene.start` | `registryGet` 是 `dm.get(key)`（`ui/registry.ts:85`），值缺失即 `undefined` → falsy → 走 `ModeSelectScene`。**写错的键名（拼错/退休）在 TS 层被 `RegistryTypes` 拦住**，但 `scene.start('GameScene')` 的**字符串键**不受类型保护：键不存在时 `SceneManager.start` 只 `console.warn('Scene key not found: ' + key)`（`SceneManager.js:1209`，同函数 `start: function (key, data)` 起 :1192）后 `return this` ⇒ **静默不进任何场景**，游戏停在 Boot 黑屏 | 无人（warn 而已） | 高：可钉「BootScene.create 用到的两个场景键 ∈ `main.ts:41` `scene: [...]` 注册表的 key 集合」——**跨文件一致性**，纯字符串比对，零 Phaser |
| B8 | `:85 async create()` 的 await 之后 | `SceneManager.create`（:613-644）里 `scene.create.call(scene, …)` **返回值被丢弃**，随后同步 `settings.status = RUNNING`。故 `:97` 起代码跑在微任务里：这里若抛错，既过不了 `:90` 的 catch（catch 只包 `await document.fonts.ready`），也过不了 Phaser ⇒ 成 `unhandledrejection` ⇒ 由 `main.ts:95-100` 覆盖层显示「Promise 未捕获」（并显式放过 `decodeAudioData`/`Unable to decode audio` 两类） | `main.ts` 的 `unhandledrejection` 监听 | 高（源级契约可钉：catch 只包一句 await，不吞 `:97` 之后） |
| B9 | 二次 boot（hot reload / 手动重启 BootScene） | `bootScene` 会 `loader.reset()`，但 **TextureManager 不清** ⇒ 重跑 preload 时 63 图全部 `hasCacheConflict()` 为真 → 全被 B3 的静默分支丢掉，但 `textures.exists` 仍为真 ⇒ 表现正常而 **loaderror 一次不触发**（任何依赖 loaderror 计数的断言会在重启态下假绿） | 无人 | 中：只能作为「断言不得依赖 loaderror 次数」的设计约束登记（本设计**不**测，见 §6） |
| B10 | 音频降级 | `:77-82` 的 15 个 key 缺文件时 `cache.audio.exists(key)` 为 false ⇒ `AudioManager.ts:65` 静音降级 | `AudioManager.test.ts:58` 已钉 | **已覆盖**，不重复 |

**覆盖面小结**：A 组 7 条 + B 组新增可钉 6 条（B1/B3/B6/B7/B8 + B2 的行为补半）＝**13 条**建议覆盖路径；已在册 3 条（B2 的注册计数、B4/B5 的数据轨、B10）沿用现成出口不重做。

---

## 4. 错误传播路径（Phaser 3.90 源码级实测，非推断）

本机 `node_modules/phaser` 带 `src/`，以下每行都是现场读到的（`rg -n`）：

1. `src/scene/SceneManager.js:470 bootScene(scene)` → `:491 loader.reset()` → `:498-500 if (loader && scene.preload) { scene.preload.call(scene); …}` → `:502 settings.status = CONST.LOADING` → `:505 loader.once(Events.COMPLETE, this.loadComplete)` → `:507 loader.start()`。
   ⇒ **`:24` 的重抛发生在 :500 这一行**，其后的 `status=LOADING`／`loader.start()` **都不执行**；BootScene 的 Loader 一个文件都不拉。
2. `bootScene` 由 `SceneManager.start`（:1192）经 `processQueue`（:274）驱动，`processQueue` 又是 `SceneManager.update`（:555-557 首行 `this.processQueue();`）的第一步；`update` 由 `Game.js:498`/`:567 this.scene.update(time, delta)` 调用。
3. `Game.js` **全文 `try {` 0 处**（`rg -c "try \{" node_modules/phaser/src/core/Game.js` → 无输出＝0）；`SceneManager.js` 的 `processQueue` 亦无 try/catch。⇒ 异常不被 Phaser 捕获，继续外抛。
4. 最外层是 `src/core/TimeStep.js:690/739 this.callback(time, delta)`，其宿主 `src/dom/RequestAnimationFrame.js` 的 `step`（现场读到 :86-97）形如：
   ```js
   this.step = function step (time) { _this.callback(time); if (_this.isRunning) { _this.timeOutID = window.requestAnimationFrame(step); } };
   ```
   ⇒ **回调先跑、下一帧后排**。回调抛错 ⇒ `requestAnimationFrame` 永不再注册 ⇒ **主循环永久停摆**（`isRunning` 仍为 true，`TimeStep.tick` 不再被驱动，`smoothFix/`setTimeOut` 路径不适用：`main.ts:43` 是 `forceSetTimeOut: false`）。
   对照：同文件 `stepTimeout`（:104-113）**先排下一帧再回调**，那条路抛错后循环能活。⇒ 一旦有人把 `forceSetTimeOut` 改 true，B1 的症状会从"冻帧"变成"只黑一屏但循环还在"。**建议 §5 档 A 的用例把这条口径写进断言**（源级钉 `main.ts` 的 `forceSetTimeOut: false`），否则将来测试会静默失真。
5. `create` 侧：`SceneManager.js:613-644`——`if (scene.create) { status = CREATING; scene.create.call(scene, data); … }`，返回值不 await，随后 `status = RUNNING` 并 emit CREATE。⇒ B8 的"async 边界"坐实。
6. 未知场景键：`SceneManager.js:1205-1211`（`start`，函数起 :1192）——`getScene(key)` 为空时只 `console.warn('Scene key not found: ' + key)` 后 `return this`。⇒ B7 的静默形态坐实。
7. 键冲突：`src/loader/LoaderPlugin.js:533-556 addFile`——`if (!this.keyExists(item)) { this.list.set(item); this.emit(Events.ADD, …); … }`，**else 分支不存在**；`keyExists`（:568 起）依次查 `file.hasCacheConflict()` → `this.list` → `this.inflight`。⇒ B3「无 warn 无事件」坐实。

---

## 5. 桩方案（完成标准 ②：Phaser externality 规避口径）

**先声明为什么不能用 externals 把 Phaser 换掉**：`c922-18`（`zcode-bridge/done/c922-18-colony-phaser-externality.result.md`）已判定 **不做 phaser externals 化**——收益只有安装包的 0.369%，代价是 CSP `script-src 'self'` 放行远程源（该档 R1）、打包环境无 node_modules 可 external（R2）、离线可玩性（R3）、^3.70.0 与实装 3.90.0 的 20 个 minor 漂移被钉死（R4）。⇒ **测试侧不存在"把 phaser 外置成 CDN 后 node 环境就没有 phaser 了"这条路**，Phaser 在测试里必须以模块 mock 的形式被挡掉，而不是从构建里移掉。externals 判不通过 ≠ 可以省掉 mock，但**理由要写准**（c923-14 同日实测修正本档原句"import 会牵进 WebGL/DOM"——**过强**）：真 phaser 在 node 环境下 `import Phaser from 'phaser'` 本身可用，本仓 `MapRenderer.ts:1` 就是值位 import，而 `render/__tests__/MapRenderer.test.ts` **无 `vi.mock('phaser')` 仍全绿**（c923-14 实跑 2 文件 46 例）。BootScene 的真实障碍是 `:15 class BootScene extends Phaser.Scene` 在**求值期**就要 `Phaser.Scene`，且 `new BootScene()` 需要真 Scene 生命周期（Systems/Loader/TextureManager）⇒ **档 B 仍必须 `vi.mock('phaser')`**（本仓 6+ 场景测试既有口径），但依据是"构造期要真生命周期"，不是"import 会炸"。这正是 c922-04 §二 记的教训——BootScene 顶层 `:1 import Phaser from 'phaser'`（现场复核 `rg -n "^import Phaser" src/renderer/scenes/*.ts` 命中 BootScene:1 等 5 个场景），所以**清单类测试一律走"复刻/源文本"而非 import 被测类**（`bootLoadList.test.ts` 即为此复刻了五个加载源，代价是 c922-04 遗留 2 自认的「模板复刻残余风险」）。

**分档（按"值多少测试"与"要不要碰共享件"排）**：

- **档 A｜源文本契约（0 依赖，首选）**
  形态：`readFileSync(resolve(process.cwd(),'src/renderer/scenes/BootScene.ts'),'utf-8')` 上做字面/结构断言——与本仓既有 3 件（`bootLoadErrorDedup`、`scatterSourceGuard`、`GameSceneLifecycle` 的"源级钉桩"用例）同型，沿用其写法。
  适用：B1（catch 体必须是 `console.error` + `throw err`，禁"吞成 warn"）、B7（两个 `scene.start('…')` 字面量 ∈ `main.ts` 注册表键集）、B8（`:88-92` 的 try 块**只**包 `await document.fonts.ready`，即源码里 catch 之前不出现 `scene.start`）、B6（守卫写的是 `typeof document !== 'undefined'` 而非裸 `document.fonts`）。
  优点：不动共享件、不改生产码、跨环境恒定。缺点：**钉的是文本不是行为**，对"等价改写"（把 `throw err` 改成 `throw new Error(...)`）不敏感——文档里必须如实标这一层残余风险（照 c922-04 遗留 2 的坦白口径）。
- **档 B｜行为桩（需要两处前置，成本集中在这里）**
  前置 1：给 `fakeScene.ts` 的 `makeSceneClassMock().FakeScene` **追加 `load` facet**：`load = { on: vi.fn(), once: vi.fn(), image: vi.fn(), audio: vi.fn(), reset: vi.fn(), start: vi.fn() }`。
  ⚠ 纪律约束：`src/renderer/ui/__tests__/fakeScene.ts` 是 **c919-01 立、c922-125/c923-02 两次收编的"唯一定义处"**，现被 UIScene/Intro/ModeSelect/Transition/GameScene 等 6+ 件共享。追加 facet 属**纯增量**（新增字段、零改既有方法表），但**必须同批改跑全部 fakeScene 消费者**并把跳变写进 result——与 learning 仓"FakeStreamlit 基类多班共用不得改"同罪同理。若主班不愿动共享件，退路是新测试文件内**自带局部 `class BootSceneUnderTest` 桩**（不引 fakeScene），代价是桩面第二份化（本设计**不推荐**，但给出出口）。
  前置 2：覆盖 `:90` 需 `vi.stubGlobal('document', { fonts: { ready: Promise.reject(new Error('boom')) } })`（本仓首例，`rg "globalThis.document|stubGlobal" src` 现 0 命中）＋ `finally` 里 `vi.unstubAllGlobals()`，否则会污染同 worker 的其他文件；node 环境下 `document` 未声明，故必须走 `stubGlobal` 而非赋值。
  适用：`:24` 的「重抛 + 恰好一条 console.error」（`vi.mock('@/data')` 让 `validateStaticData` 可控抛；注意 `:2` 的 import specifier 是 `@/data` 别名，mock 路径必须逐字相同）、`:90` 的「warn 且不 rethrow 并继续走到 scene.start」、B7 的「introDone 真/假 → start 键分别为 GameScene/ModeSelectScene」。
- **档 C｜纯数据 canary（0 依赖，最高性价比）**
  形态：直接 import 三个纯数据源（`data/artManifest.ts`、`data/scatterConfig.ts`、`state/audioDirector.ts`；本单实测三者**均无 phaser import**）复刻出 78 个 `(key, type)`，断言**同类型键全局唯一**。
  依据：§4-7 的静默丢弃语义 ⇒ 一旦有人加图撞键，今天没有任何信号。A8 实测现值 0 冲突，所以这是一条**从零成本上手的现状钉**。
  **复刻红线**：档 C 复刻的是"键集合"，**绝不再复刻第二份 URL 模板**（URL 轨已由 c922-04 不变量二钉住；再复刻一份就是给自己新增第三个事实源，正是 BootScene:56-57 注释自述的"manifest 之外的第二事实源"之病）。
- **不推荐**：真 `new BootScene()` 挂到 `Phaser.Game` 上跑（需 headless WebGL，本仓 `vitest.config.ts` 无 jsdom/happy-dom 依赖，装依赖越界）；`--config` 换 environment（改全局门禁）。

**落地文件建议**：新建 `src/renderer/scenes/__tests__/BootScene.runtime-error.test.ts`（档 A＋档 B＋档 C 同件，避免再散第三件源级测试）；若主班要控制件尺寸，拆成 `BootScene.source-contract.test.ts`（档 A/C）＋`BootScene.create-error.test.ts`（档 B）。

---

## 6. 用例清单与估工

| # | 用例（建议标题） | 档 | 断言（判据） | 前置成本 |
|---|---|---|---|---|
| U1 | `:24` 校验失败＝记一条 error 并原样重抛 | A＋B | 源文本含 `console.error('[BootScene] static data validation failed:'` 且其后一行是 `throw err`（禁 `throw new Error`、禁改 warn）；行为面：mock `@/data` 抛 `ModifierValidationError` ⇒ `expect(() => scene.preload()).toThrow(ModifierValidationError)` ＋ `console.error` 恰 1 次 | 低（B 部分依赖档 B 前置 1） |
| U2 | `:24` 之外的 preload 主体不受 catch 保护 | A | `:22-27` 的 try 只包 `validateStaticData()`：源码里 `try {` 到 `} catch` 之间**不含** `this.load` | 低 |
| U3 | preload 抛错时 Loader 一次都不 start（B1 契约） | B | 桩 load facet 记 call 数：`validateStaticData` 抛 ⇒ `image/audio/start` 调用数**全 0**，`on('loaderror')` 注册数 1 | 低 |
| U4 | `:90` fonts.ready 被拒＝warn 且继续启动 | B | stub `document.fonts.ready = Promise.reject()` ⇒ `console.warn` 恰 1 次、**不抛**、`scene.start` 被调用 1 次 | 中（首例 stubGlobal ＋ unstub） |
| U5 | 无 DOM 环境整块跳过（B6） | A＋B | 默认 node（不 stub）⇒ `console.warn` 0 次、`scene.start` 恰 1 次（守卫不吞后续流程） | 低 |
| U6 | `introDone` 双分支（`:97-101`） | B | registry 预置 true/false ⇒ `sceneStart` 分别收到 `'GameScene'` / `'ModeSelectScene'` | 低（`registryStore` 现成） |
| U7 | 场景键与注册表一致（B7） | A | 源文本取 BootScene 两处 `scene.start('X')` 字面量 ⊆ `main.ts` 里 `scene: [ … ]` 的类名→key 集（key 由 `super({key:'…'})` 逐类取）；断言附「未知键只 warn 不抛」的源码依据注释 | 中（跨文件解析，但零依赖） |
| U8 | await 之后的抛错不归 `:90` 管（B8） | A | 源码级：`catch` 之前不存在 `scene.start`；并在注释钉 §4-5 的 Phaser `create` 不 await 事实 | 低 |
| U9 | 78 个加载键同类型唯一（B3 canary） | C | 由三纯数据源派生 `[{key,type}]`，`new Set` 前后长度相等；跨图/音重叠单独断言（现值 0） | 低 |
| U10 | `forceSetTimeOut: false` 在位（§4-4 前提） | A | `main.ts` 源文本含 `forceSetTimeOut: false`，注释写明"改成 true 会让 U3/B1 的症状与断言失真" | 低 |
| 合计 | **10 例**（档 A 6 / 档 B 4，U2/U5 等可 A/B 并钉） | | | **≈0.5 人日**（档 A＋C：1.5–2h；档 B 的 fakeScene `load` facet ＋ 全量消费者复跑：2–3h；含 result/台账）。若主班**不批动 fakeScene**，档 B 4 例改由局部桩承担 ⇒ 再 +1.5h 且桩面第二份化，建议按"档 A/C 先落、档 B 另单"切两刀 |

不测清单（刻意留白，勿顺手扩）：loaderror 实际触发次数（B9 重启态会假绿）、真字体加载成功路径（A9：`public/fonts/` 空目录属在册缺陷，补字体是产品决定）、真实 Loader 网络失败（需 headless 资源服务）、`Phaser.Loader.File` 的 `file.key` 类型面（依赖真 phaser 对象）。

---

## 7. 与在册缺陷/他单的关系（避免重做、避免顺手修）

- **纪律档 §十二 colony 节的在册假绿**：`calendar.test.ts:21` 恒真断言已由 **c923-10 收口**（改为 `toBe` 身份断言），本设计不回改、不引用旧口径。
- **经济验收失明面**（`sandboxSimulation.test.ts:156-164` 只看 `output`、`shortfallRes` 只收 grain/cloth/rite/bronze）：本单**不涉任何资源/产出/消耗数值**，故不进该失明面；文中出现的 `main.ts:126` 起始资源循环仅为现状描述，未读未写任何常数。红线零读写：`CRISIS_*`、`SAVE_SLOTS`、产出消耗常数均未出现在本单任何命令的取值路径上。
- **c922-04 遗留 2（模板复刻残余风险）**：本设计选择**不扩大复刻面**（档 C 只复刻键、不复刻 URL），并把"若 BootScene 模板漂移则复刻守卫失明"这条已知残余继续挂在 c922-04 名下，不另立第二份台账。
- **c922-13 的"15 件零测清单"**：本设计只处理 BootScene 一件；`courtFormat.ts`/`panelDecoration.ts`（该档判为"纯函数最廉可钉"）不在本单范围。
- **§十六 派单口径**：本档所有数字均为现场复跑值，未从任何批量 dump 抄数。

---

## 8. 自证（完成标准逐条）

```
① 分支清单含 :24/:90 实锚与覆盖路径数
   §3 A 组：:24 → 2 条（含 8+4 个真实抛点来源）；:90 → 2 条 ＋ 守卫前置 3 条。含锚点：rg 实测 catch 仅 24/90。
② 桩方案注明 Phaser externality 规避口径
   §5 首段引 c922-18（externals 判不通过：0.369% 收益 vs CSP/离线/版本钉死）＋ c922-04 §二（模板复刻教训 ⇒ 清单类不 import 被测类），
   并给档 A/B/C 三档与本仓 fakeScene 的实测缺口（FakeScene 无 this.load）。
③ git diff --stat = 0
   本单只新建本文件（未跟踪）＋ gitignored 探针 tmp/c923-13/probe.mts（git check-ignore -v → .gitignore:25:tmp/）。
   收工实测见 result「验收情况」节：git diff --stat 空、porcelain 仍 3 项在册他班件。
```
