# c927-04 · 无 fsync 的 OS 掉电面评估登记（主进程写盘点全清单 + 改造代价）

> 班次 `qoder-executor-20260927-1520-colony39` · 2026-09-27 · **零码改动**（本文件是本单唯一产物，产品码/测试码 0 改动）
> 卷宗锚点：`zcode-bridge/outbox/20260925-120420-e89f.result.md` 遗留 2 ⇒ **按波次 19 brief §3a 到 `done/` 取**，实测命中 `D:\code\zcode-bridge\done\20260925-120420-e89f.result.md`（路径搬家、内容有效，锚点成立）。
> 一句话结论：**「崩溃面」已被现有 13 例钉住且成立；「掉电面」是真缺口，缺口只在一步（`writeFile` 到 `.tmp` 与 `rename` 之间缺一次数据刷盘）。改造在依赖/性能/兼容三面几乎免费，主要代价落在"两条既有测试钉桩会转红"与"跨平台目录刷盘不可移植"两处，且改造上限受硬件写缓存封顶——本单不建议按"绝对掉电安全"立项。**

---

## ① 写盘点清单（主进程全量，file:line）

主进程只有一个源文件：`src/main/index.ts`（227 行，`find src/main -type f` → 1 命中）。全仓 `src/main` + `src/preload` 的 fs 写面 grep 命中如下（`grep -rn "writeFile|appendFile|createWriteStream|mkdir|rename|copyFile|rm(|unlink|truncate|sync()" src/main src/preload`）⇒ **除下表 5 条外零命中**：

| # | 写盘点 | 位置 | 目标 | 类型 |
|---|---|---|---|---|
| W1 | `mkdirSync(dir,{recursive:true})` × 3 | `src/main/index.ts:19`（循环体；目录常量 `:6-8`） | `D:/colony-game/user-data`、`/temp`、`/logs` | 目录创建，**import 期同步执行**（`:33 ensureDDrivePaths()`），失败走 `:27-30` fallback |
| W2 | `await mkdir(savesDir,{recursive:true})` | `src/main/index.ts:159` | `…/user-data/saves` | 目录创建，异步 |
| W3 | `await writeFile(tmp, json, 'utf-8')` | `src/main/index.ts:165` | `…/saves/<slot>.json.tmp` | **新代数据落盘（无刷盘）** |
| W4 | `await copyFile(target, bak)`（`existsSync(target)` 前置：`:166`） | `src/main/index.ts:166` | `…/saves/<slot>.json.bak` | 旧代复制到 bak（无刷盘） |
| W5 | `await rename(tmp, target)` | `src/main/index.ts:167` | `…/saves/<slot>.json` | 元数据替换（权威生效点） |

**链路入口（谁触发 W2–W5，一条）**：
`SaveLoadPanel.ts:190 await saveToSlot()` → `saveLoad.ts:852 getColonyApi().saveGame(slot, JSON.stringify(serialize(...)))` → `preload/index.ts:5-6 ipcRenderer.invoke('save-game')` → `main/index.ts:154 handler` → W2→W5。
`saveToSlot` 只认严格 `false`（`saveLoad.ts:853`），主进程 handler 恒 `return true`（`:168`），异常以 IPC rejection 跨进程 ⇒ 现状**没有任何"刷盘失败"可辨形态**。
全仓无自动存档（`grep -rn "autosave|autoSave|定时保存" src` → 0 命中），W3–W5 只在玩家点保存时发生。

**只读面（不受影响，列出以示边界）**：`:174-175` load-game `existsSync`+`readFile`；`:180-182` list-saves `readdir`（`.tmp`/`.bak` 被 `.json` 后缀过滤挡住）；`:187-196` save-meta `stat`+`readFile`。

**本项目代码之外的写盘（本改造覆盖不到，必须单列）**：
- Electron 自管目录：`index.ts:22-26` 把 `temp/logs/crashDumps/cache/sessionData` 全指到 `D:/colony-game/user-data` ⇒ Chromium 日志、GPU/HTTP 缓存、session 存储由 Chromium 自己的刷盘策略管，应用层 fsync 无法代管。
- 渲染层 `localStorage`：`ScoreCardPanel.ts:39 setItem`（历史最高分）、`settingsStore.ts:33 setItem`（设置缓存）⇒ 走 Chromium LevelDB，同样不在本改造面内。
- `dist/`、`.tsbuildinfo/`、`docs/insights/colony-suite-timings-*.json` 等构建/脚本产物：非运行时。

---

## ② 两档分级表（崩溃安全 / 掉电安全）

「崩溃安全」＝进程被杀/异常退出（OS 仍在，页缓存仍在）；「掉电安全」＝OS 突然断电（页缓存丢失，只有已刷盘字节存活）。

| 写盘点 | 崩溃安全 | 掉电安全 | 依据 / 暴露后果 |
|---|---|---|---|
| W1 `mkdirSync` ×3 | ✅ 幂等，崩了下次重建 | ✅ 目录创建是元数据操作，OS 侧 journalling（NTFS `$MFT` 日志 / ext4 htree+journal）自成一体 | 后果面：无数据 |
| W2 `mkdir saves` | ✅ 同上 | ✅ 同上 | 后果面：无数据 |
| W3 `writeFile(tmp)` | ✅ **已钉**：target 未动，读档读到上一代（13 例，含 `torn-tmp-write` 半截 tmp 实测 `JSON.parse` 抛错） | 🔴 **缺口（唯一实质缺口）**：数据页留在 OS 写缓存，未 `FlushFileBuffers`。掉电后 `.tmp` 可能 0 字节 / 部分字节 / 旧内容 | 与 W5 联动才是事故：见下行 |
| W4 `copyFile(target,bak)` | ⚠️ 崩溃面另有一处退化（不是 fsync 问题）：`copyFile` 在 `rename` **之前** ⇒ 死在这两步之间时旧 bak 已被同代覆盖，"每槽保留前一代"退化成只有一代（e89f E3 已钉死：`bak==target==gen81`，gen80 永久消失） | ⚠️ bak 自身也无刷盘 ⇒ 掉电后 bak 可能撕裂。**注意这是"回退面"**：真需要回退时读的正是它 | 次序问题与刷盘问题叠加在同一对相邻语句 |
| W5 `rename(tmp,target)` | ✅ 原子替换，读侧永不见半截（`atomicSaveCrash.test.ts` 组 2 钉"绝不对 target 直写"） | 🔴 **这才是掉电事故形态**：rename 是元数据操作、走 OS 日志，可能**先于 W3 的数据落盘**而持久化。重启后 target "存在且是权威名"，内容却是**旧代 / 0 字节 / 半截** ⇒ 玩家看到的是"存档在，但打开报损坏"或"回滚到前一天"，而 `.tmp` 残体反而可能带着新代 | e89f 遗留 2 原话所指即此；本机无法验真（见 §⑥） |
| Electron/Chromium 写面、localStorage | ➖ 不归本仓代码 | ➖ 不归本仓代码 | 单列，别把它算进改造收益 |

**分级小结**：主进程写盘链共 5 个点，**崩溃面 4✅+1⚠️（W4 次序退化）**；**掉电面 3✅+2🔴（W3+W5 是一对，补一次文件级刷盘即闭合）+1⚠️（W4 bak 无刷盘）**。
⇒ 掉电面改造的**最小充分集**只有两处：W3 之后（rename 之前）刷 `tmp` 的数据；可选第二处：W4 之后刷 `bak`（若把 bak 当回退面看待就该刷，否则留旧 bak 撕裂风险）。目录级刷盘在 Windows 上是 no-op（实测 EPERM，见 §④-C3）。

---

## ③ 现状风险的量级评估（供拍板，不是缺陷判红）

| 维度 | 读数 | 说明 |
|---|---|---|
| 触发条件 | 需要「保存的瞬间恰逢 OS 掉电」 | 本仓无自动存档 ⇒ 掉电窗口 = 玩家手点保存那一秒前后，且窗口宽度 ≈ 页缓存回收延迟（通常数秒量级，不可控） |
| 暴露面 | 单槽 `target` + 单槽 `bak`，其余 2 槽不受影响 | slot 由 `VALID_SLOT_RE`（`:151`）限 3 个左右（`SaveLoadPanel` 面板枚举），事故不跨槽 |
| 现有缓解 | `.bak` 提供一代回退 | 但 W4 的次序退化（崩溃面）与 bak 无刷盘（掉电面）都会削弱它 |
| 用户侧感知 | 无提示，只有"该存档不存在或已损坏"toast（`SaveLoadPanel.ts:197`；`loadFromSlot` `SaveLoadError` 路径 `saveLoad.ts:867-869`） | 现状不会告诉玩家"是不是刷盘失败" |
| 是否属新增缺陷 | **否**，e89f 已登记（2026-09-25），本单只补量级与代价 | 本单**不判红**，与 e89f 同口径 |

---

## ④ 改造代价（`open → write → sync → close → rename`，共 6 条，含实测数字）

### C1 · 依赖面：≈ 零成本（实测 API 在世，无新依赖）
- 目标运行时是 **Electron 28.2.5 / 内嵌 Node 18.18.2**（实测：`ELECTRON_RUN_AS_NODE=1 node_modules/.bin/electron c927-04-probe.cjs` → `runOn.node=18.18.2, electron=28.2.5`）。
- 运行时探测 `FileHandle` 原型（注意 `require('fs/promises').FileHandle` **不存在**，`typeof` → `undefined`，只能开一次句柄实测）：`protoOwnKeys = ["getAsyncId","datasync","sync"]` ⇒ `fh.sync()`（FlushFileBuffers）**与 `fh.datasync()` 在目标运行时都在世**，Node 侧 24.15.0 同样在世。
- 改动形态（**未落地的草案**）：`:4` 的 `fs/promises` import 里 `writeFile` 可被 `open` 取代（`mkdir/rename/copyFile` 保留），`FileHandle` 类型可从 `fh` 推导无需新增 import ⇒ **零新增依赖、零构建配置改动**。

### C2 · 性能面：每次手点保存 +约 2–3 ms（本机 D 盘实测，n=20，单机，非随机化）
同一探针、三种序列，写向 `D:/code/tmp/<班名>/probe-saves`（与真实存档同盘同卷 `D:`）：

| 序列 | 载荷 | A：现状（writeFile+copy+rename） | B：open→write→**sync**→close→rename | C：open→write→**datasync**→close→rename(+尝试目录刷) |
|---|---|---|---|---|
| 20 次连存 | 65,652 B（fixture 量级） | 0.92 ms/次（node 24）· 5.67 ms/次（electron/Node18） | 2.90 · 7.67 ms/次（**+2.0 ms**） | 3.11 · 6.50 ms/次 |
| 20 次连存（两轮） | 696,436 B（≈ 真实 80×80 存档量级，见 C6） | 2.79 → 3.31 ms/次（electron/Node18） | 5.35 → 5.47 ms/次（**+2.56 / +2.16 ms**） | 5.59 → 5.90 ms/次 |

- 结论：**增量约 2–3 ms/次**，对"玩家点一次保存"完全无感；且 `fh.sync()` 走 libuv 线程池、不阻塞主进程事件循环，`await` 只在 IPC 回程上加时间。
- 诚实边界：① n=20、单机、缓存温、未做 A/B 交替与随机化 ⇒ 只做量级判断，不是基准结论；② 同一段代码在机械硬盘 / USB 外置盘 / 被杀软实时扫描的机器上，`FlushFileBuffers` 可能是 **数十至数百 ms**，而 `SaveLoadPanel.ts:187-192` 在 `await` 期间是 `busy=true` 阻塞态 ⇒ **改造要配一条 UI 侧的"保存中"预期**，否则低端机上表现为点保存后短暂无响应。

### C3 · 跨平台面：文件级刷盘可移植，目录级刷盘**不可**（本机实测 EPERM）
- POSIX（Linux/macOS）语义：`rename` 的持久化要靠**父目录 fsync**，只刷文件数据不完整。
- Windows 语义：`CreateFile/FlushFileBuffers` 是文件级；对目录开句柄本机实测 `open(dir,'r') → fh.sync()` 抛 **`EPERM`**（探针字段 `dirFsyncError:"EPERM"`，两轮一致）。⇒ 改造里若照抄"rename 后 fsync 目录"这段，**Windows（本仓唯一交付平台，`electron-builder --win`）会直接抛错**，必须 `process.platform !== 'win32'` 守卫，且那条分支在本仓**永远跑不到、测不到**。
- 另一个平台差：Windows 上 `rename` 目标已存在时需要 `MOVEFILE_REPLACE_EXISTING` 语义；Node 的 `fs.rename` 在 Windows 已处理覆盖（现状 `atomicSaveCrash.test.ts:156` 实测"rename 覆盖式替换不留残体"），改造不触碰该行为。
- 收益上限要写清：`FlushFileBuffers` 只把数据交到**设备**；若盘（含消费级 SSD）自带易失写缓存且掉电，仍可能丢。真"掉电安全"需要企业级带保护缓存的介质或 UPS ⇒ **改造上限是"OS 页缓存层安全"，不是物理掉电安全**（这条若不在立项文档写明，就是过度承诺）。

### C4 · 测试面：这是**主要代价**，两条既有钉桩会转红，必须同步改（否则门禁红）
本仓对这段产品码的既有取法是「真 FS 行为面（复刻序列）＋ 源码静态结构钉桩」两面（`atomicSaveCrash.test.ts` 组 1/组 2 ＋ `saveIoSemantics.test.ts`）。改造命中面逐条：

| 既有断言 | 位置 | 改造后 | 原因 |
|---|---|---|---|
| 三步顺序 `await writeFile(tmp, json` < `await copyFile(target, bak)` < `await rename(tmp, target)` | `atomicSaveCrash.test.ts:235-242` | 🔴 红 | 改后正文不再有 `await writeFile(tmp, json` 字面串（换成 `fh.writeFile`），`indexOf` → −1 |
| 「`await writeFile(` 调用点**恰好 1 处**且目标是 tmp」 | `atomicSaveCrash.test.ts:244-249` | 🔴 红 | `body.match(/await writeFile\(\s*[A-Za-z_$][\w$]*/g)` 匹配数变 0 |
| 「10MB 上限与槽位校验早于任何写盘」用 `iWrite` 作基准下标 | `atomicSaveCrash.test.ts:257-263` | 🔴 红 | 基准 `iWrite` 塌成 −1，`toBeLessThan` 必失败 |
| 复刻件 `saveGameSequence()`（13 例的行为面本体） | `atomicSaveCrash.test.ts:39-60` | ⚠️ 必须手工镜像 | e89f 遗留 3 已警告：产品码在四步之间插入新语句时**复刻件不会自动跟进**；不镜像则"绿而无效" |
| 三个文件名后缀 / `load-game` 不含 `.tmp` | `atomicSaveCrash.test.ts:251-255`、`:265-269` | ✅ 不受影响 | 命名与读侧不变 |
| 校验消息带上下文（静态串匹配） | `saveIoSemantics.test.ts:77-86` | ✅ 不受影响 | 只要三条 throw 消息不动；注意它按 `ipcMain.handle('save-game'` 到 `('load-game'` 取正文，**新增语句落在该区间内不会破** |
| 渲染侧 IPC/返回值语义 | `saveIoSemantics.test.ts:55-67`、`saveLoad.ts:853` | ✅ 不受影响 | 返回值仍 `true` |

- 定向复跑基线（本单实测，`npx vitest run` 点名三件）：`atomicSaveCrash(13) + rateDisplayBoundary(12) + saveIoSemantics(10)` ⇒ `VITEST_RC=0 · 35 passed`。改造后这三件必须仍全绿（且是**镜像后**的全绿）。
- 全量：本波并发窗内禁跑全量 `npm test` ⇒ **改造件的全量数交主班收班取**（本单只提供定向基线）。
- 另有一处**结构性**代价：`src/main/index.ts` **不在 `npm run type-check` 覆盖面内**（`package.json` 的 `type-check` = `tsc -p tsconfig.renderer.json --noEmit`）。本单实测点名命令：`npx tsc -p tsconfig.main.json --noEmit` → `MAIN_RC=2`，且已挂 **2 条存量红**：`src/main/index.ts(93,9)`、`(93,18)` 均 TS18048（`w`/`h` possibly undefined，属 `:92-93 sendCleanSize`，与写盘链无关）。⇒ 改造者要预期"这条命令本来就不干净"，否则会把存量红误判成自己弄坏的（本 brief 现场条 §5 同口径）。

### C5 · 语义/失败模式面：新增两类要处理的路径（改造不是纯加法）
1. **`sync` 自身会抛**（`EIO`/`ENOSPC`/`EPERM`）⇒ 现状一次 `writeFile` 变成"开-写-刷-关"四次可抛点；要不要在刷盘失败时**保留旧 target 并返回 `false`**（渲染侧 `saveLoad.ts:853` 已有 `SaveLoadError` 通道，`saveIoSemantics` 已钉"只认严格 false"）是**语义决定**，属裁决面，不是执行手能顺手定的。
2. **`finally` 里的 `close`** 与句柄泄漏：漏 `close` 会在 Windows 上让 `.tmp` 被占用，下一次 `rename` 撞 `EBUSY`——这是新增的、只在 Windows 出现的失败模式。
3. `open(tmp,'w')` 的**截断语义**与现状 `writeFile` 相同（新建/截断），但落在 rename 之前 ⇒ 崩溃面不变（target 未动），需要新用例把"`sync` 失败后 target 仍是旧代"钉住。
4. **顺带修复机会与风险**：W4 的 bak 次序退化（e89f 遗留 1）落在**同一对相邻行**，两案若同批改，测试镜像面要一起改；若分两批，第二批要重新复核第一批的复刻件。这是排期成本，不是代码成本。

### C6 · 兼容/回滚面：零迁移、可一键回退（改造的免费项，列出来供对冲 C4/C5）
- 存档格式、`schemaVersion`（恒 9）、槽名、`.tmp/.bak` 命名**全不变** ⇒ 老档零迁移、零拒载风险（与 c927-05 的"存档语义变更"不同档，本改造不落在语义面上）。
- 回滚成本：单函数体内 5→9 行的局部改动，`git revert` 一笔即可；无数据库、无计划任务、无 tag。
- 载荷量级参考（估算，非实测产品码）：`__fixtures__/save-v9.json` = 35,106 B，其中 worldMap 14,381 B/256 tile（56.2 B/tile）＋ 非图 20,725 B ⇒ 真实 `DEFAULT_MAP_SIZE=80`（`gameStore.ts:311`）的 6,400 tile 外推 ≈ **380 KB**（`projected80x80Bytes:380250`）。距 `MAX_SAVE_BYTES` 10 MB（`:152`）余量充足，刷盘增量不随之外扩。

### 代价排序（给拍板用，非推荐落地顺序）
按"要付的力气"排：**C4（测试镜像＋3 条断言转红）> C3（跨平台守卫＋收益上限要说清）> C5（新失败模式与语义决定）> C2（+2–3 ms，低端机要配 UI 预期）> C1 ≈ C6（≈ 零）**。

---

## ⑤ 可选形状对照（**只列形状，不选案**，卷宗判据只要代价）

| 形状 | 改动面 | 闭合的缺口 | 未闭合 |
|---|---|---|---|
| S0 仅登记（现状） | 0 | — | W3+W5 掉电对、bak 撕裂、bak 代数退化 |
| S1 `open→write→sync→close→rename`（卷宗点名，仅刷 tmp） | 1 个 handler，约 +4 行；测试镜像 3 条断言 | W3+W5 掉电对 | bak 面无刷盘；bak 次序退化；POSIX 目录刷（非 win 平台才需要） |
| S2 = S1 ＋ rename 前对 bak 也刷（或 bak 挪到 rename 后） | 同上 +2 行；复刻件要加一个断点用例 | 再加 bak 面 | 平台守卫仍要写；"保存变两步 await" 时延翻倍 |
| S3 双槽轮换（写 `slot.next.json` 后 rename，保留两代） | 命名面改动 ⇒ `.tmp/.bak` 三条静态断言（`:251-255`）＋ list-saves 过滤都要复核 | 代数退化 + 掉电面 | 破坏面比 S1 大，`saveMatrix`/`saveV9Fixture` 一类兼容夹具要复核 |
| S4 交给 OS：`before-quit` 时统一 flush + 提示玩家"保存后别断电" | 0 写盘改动，加一条 UI 提示 | 观感 | 真掉电面**完全未闭合** |

**S1 是"代价最低的形状"而不是"结论"**：是否值得为掉电面付 C4 的测试镜像成本，取决于产品是否把"玩家手点保存后立刻断电"视为需要负责的场景——这属人工裁决。

---

## ⑥ 本机不可验真项（诚实声明，别把这条读成"已验证"）

- 「rename 元数据先于数据落盘」这一条**在本机无法实测**：要真验必须硬断电/重启，本波次无重启权限、也不允许对真存档目录动手。
- 本单实测到的只是**代理事实**：① 现状序列里确实没有任何刷盘调用（grep 面 0 命中，见 §⑤-1 证据）；② `fh.sync`/`fh.datasync` 在目标运行时可用（Node 18.18.2）；③ Windows 上目录刷盘抛 `EPERM`；④ 补文件刷盘的时延增量 ≈ 2–3 ms。
- 因此本档给的是**代价评估**，不是"改造后掉电安全"的承诺；与 e89f 原登记口径一致（"本件名'断电模拟'实为'崩溃点模拟'"）。

---

## ⑦ 判据自查（卷宗「完成标准」逐句对账）

| 判据 | 命中 | 取证 |
|---|---|---|
| ① 写盘点清单带 file:line | ✅ | §①：W1–W5 五条 `src/main/index.ts:19/159/165/166/167`，另列 Electron/localStorage 面外条目；grep 全量命中 0 条漏项 |
| ② 分级表（崩溃安全/掉电安全两档） | ✅ | §②，含每格依据 |
| ③ 改造代价 ≥3 条 | ✅（6 条：C1 依赖、C2 性能、C3 跨平台、C4 测试、C5 语义/失败模式、C6 兼容/回滚） | 数字均为本单命令实测或可复算外推 |
| ④ 零码改动 | ✅ | 工作树仅 4 枚外部在途脏件未碰（见 §⑧）；本单只新增本 md |

## ⑧ 证据（命令＋读数，均在 `D:\code\colony-game` 下执行；取 rc 一律重定向不接管道）

```
# 现值（brief 表里的 HEAD=102c65d / 7 行脏 已过期，以下为本班 17:1x 现取）
$ git rev-parse --short HEAD                → 6f4057a
$ git status --porcelain                    → 4 行：
   M docs/design/OPTIMIZATION_BACKLOG.md
   M docs/insights/colony-dead-exports-20260914.json
   D docs/insights/colony-dead-exports-20260914.json.bak
   M docs/insights/colony-suite-timings-20260921.json
  ⇒ 全部是外部在途件，本班未 add/checkout/restore/stash/clean；本单产出＝本 md 一件

# 现场条复核（loadGate 移出是有意状态，本班未还原、未重建）
$ ls src/renderer/data/loadGate.ts          → No such file or directory
$ ls D:/code/tmp/handover-w19/colony-loadGate/ → README.md / index.ts.patch / index.ts.worktree-version / loadGate.test.ts / loadGate.ts

# 写盘面普查
$ grep -rn "writeFile|appendFile|createWriteStream|fs\.|mkdir|rename|copyFile|rm(|unlink|truncate|sync()" src/main src/preload
  → 9 行命中，全部落在 src/main/index.ts（import 行 + W1/W2/W3/W4/W5），preload 0 命中
$ grep -rn "autosave|autoSave|定时保存" src → 0 命中
$ grep -rn "localStorage|sessionStorage|indexedDB" src → ScoreCardPanel.ts:27,39 / settingsStore.ts:17,33

# 探针（临时件；写向 D:/code/tmp/<班名>/probe-saves，脚本跑完即 rmSync 自删该目录，未碰真存档目录 D:/colony-game/user-data）
$ node c927-04-probe.cjs                                                  # 系统 node 24.15.0，65,652 B
  PROBE_JSON={"runOn":{"node":"24.15.0"},"api":{"sync":"function","datasync":"function","protoOwnKeys":["getAsyncId","datasync","sync"]},
  "A_writeOnly_current":{"perSaveMs":0.92},"B_write_sync_close_rename":{"perSaveMs":2.9},
  "dirFsyncError":"EPERM","C_write_datasync_close_rename_dirsync":{"perSaveMs":3.11}}   rc=0
$ BLOB_KB=64 ELECTRON_RUN_AS_NODE=1 D:/code/colony-game/node_modules/.bin/electron c927-04-probe.cjs   # Node 18.18.2，65,652 B
  A=5.67 B=7.67 C=6.50  dirFsyncError=EPERM   rc=0
$ BLOB_KB=680 ELECTRON_RUN_AS_NODE=1 D:/code/colony-game/node_modules/.bin/electron c927-04-probe.cjs  # 696,436 B，第 1 轮
  A=2.79 B=5.35(+2.56) C=5.59  dirFsyncError=EPERM   rc=0
$ BLOB_KB=680 同上，第 2 轮复跑（696,436 B）
  A=3.31 B=5.47(+2.16) C=5.90  dirFsyncError=EPERM   rc=0
  ⇒ 两轮 sync 增量 +2.16 / +2.56 ms，绝对值 A 在 2.79~3.31 间波动 ⇒ 单次 n=20 只够量级判断（本机 D 盘，与真实存档同卷）

$ node fixture-size.cjs
  {"fixtureTotalBytes":35106,"worldMapBytes":14381,"tileCount":256,"bytesPerTile":56.2,
   "nonMapBytes":20725,"projected80x80Bytes":380250,"projectedKB":371.3}

# 定向测试基线（未跑全量，并发窗禁跑）
$ npx vitest run src/renderer/state/__tests__/{atomicSaveCrash,rateDisplayBoundary,saveIoSemantics}.test.ts
  VITEST_RC=0 · Test Files 3 passed (3) · Tests 35 passed (35)（13/12/10）

# type-check 两条口径分列（结论必须点名是哪一条）
$ npm run type-check                       # = tsc -p tsconfig.renderer.json --noEmit，**不含 src/main**
  TYPECHECK_RC=0
$ npx tsc -p tsconfig.main.json --noEmit   → MAIN_RC=2
   src/main/index.ts(93,9): error TS18048: 'w' is possibly 'undefined'.
   src/main/index.ts(93,18): error TS18048: 'h' is possibly 'undefined'.
  ⇒ 存量红，与写盘链无关；本班未改该文件

# 锚点复核（brief §3a：outbox → done 取）
$ ls D:/code/zcode-bridge/done/ | grep e89f → 20260925-120420-e89f.{result,task}.md   ✅ 遗留 2 原文命中 :103-105
```

## ⑨ 遗留 / 交裁决项

1. 🔴 **是否立项做 S1/S2**（人工裁决）：代价集中在 C4 测试镜像；收益是"OS 页缓存层"的掉电面，且受硬件写缓存封顶（C3）。
2. 🔴 **`sync` 失败要不要回报 `false`**（C5-1）：会改 `save-game` 的返回语义，涉及渲染侧 `SaveLoadError` 通道既有钉桩（`saveIoSemantics.test.ts:55-67`）⇒ 属存档语义变更，按纪律过人工闸。
3. ⚠️ **bak 次序退化（e89f 遗留 1）与本单改造同对相邻行**：建议一并排期，否则复刻件要改两遍。
4. ⚠️ **低端机时延**：C2 的"数十至数百 ms"分支未在本机复现（无 HDD/无外置盘），若要立项需一次低端机实测。
5. ➖ 全量 `npm test` 现值未取（并发窗约束），交主班收班取。
6. ➖ `tsconfig.main` 的 2 条存量红（`:93`）不属本单范围，未动。
