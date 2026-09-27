# c927-29 · 主进程有界运行日志：承载体设计稿（bd0f E6）

- 班次：`qoder-executor-20260927-2006-colony44`
- 日期：2026-09-27
- 性质：**设计稿**。零产品码改动、零新增测试件；下文出现的文件路径／函数名／常量都是**将要新增的**，不是现状。
- 锚点：`zcode-bridge/done/20260925-154205-bd0f.result.md` 遗留问题②（卷宗写 `outbox/`，实已在 `done/`）

---

## 0. 一句话结论

E6 成立且**比锚点写得更彻底**：不只是"产品码无日志写入面"，而是**主进程连一个自建的落盘文件都没有**——`app.setPath('logs', …)` 只把 Electron/Chromium 的日志根指过去，本仓代码从头到尾只调 `console.*`，打包后无控制台 ⇒ 全部蒸发。
承载体设计的核心难点**不是滚动，是跨进程**：任务点名的三类写入点（日相耗时／队列变更／事件挂起）**全部活在渲染进程**，主进程一行都看不见；而 `nodeIntegration:false + contextIsolation:true` 决定了渲染层不能自己写文件 ⇒ 必须"渲染层产事件 → IPC → 主进程有界落盘"。
量级上最危险的分支已被现状代码锁定：`timeSystem.ts:14` 的 `MAX_TICKS_PER_UPDATE = 400` × `DAY_PHASE_ORDER` 的 **22 相** ⇒ **单帧最坏 8800 条日相记录**。任何"逐日逐相都写"的方案都会在这个分支上先撑破自己的上限，故本稿把**日相面定为"按日聚合 + 只在超阈值时升档"**，不逐相写。

---

## 1. 现状盘点（逐条实测，含否证）

| # | 现状 | 读数／出处 | 对设计的影响 |
|---|---|---|---|
| 1 | 日志根目录已设 | `src/main/index.ts:8` `const D_DRIVE_LOGS = 'D:/colony-game/user-data/logs'`；`:23` `app.setPath('logs', D_DRIVE_LOGS)` | 承载体应**复用** `app.getPath('logs')`，不要再新造路径常量 |
| 2 | 🔴 该目录**存在且为空** | `ls -la /d/colony-game/user-data/logs/` → `total 0`（目录 mtime 2026-05-28） | **E6 的直接物证**：设了路径、没写东西。锚点"应用面没有承载体"由磁盘坐实 |
| 3 | 主进程只有 `console.*` | `index.ts:28 / :124 / :131 / :141 / :225` 共 5 处，无一处 `fs.write` | 打包无控制台 ⇒ 现状等于**零持久化** |
| 4 | 主进程唯一写盘面是存档 | `:165-167` `writeFile(tmp) → copyFile(bak) → rename`（原子写＋留一代） | **本稿沿用同一写入纪律**（tmp+rename），不新造第二套 IO 风格 |
| 5 | 写盘体积上限已有先例常量 | `:152` `MAX_SAVE_BYTES = 10 * 1024 * 1024` | 滚动参数命名向它对齐（`MAX_LOG_BYTES`），评审心智成本低 |
| 6 | 渲染层 → 主进程仅 4 条 invoke＋1 条 on | `src/preload/index.ts`：`save-game / load-game / list-saves / save-meta / window-resized` | 日志通道是**第 6 条**，须显式限流，且要防成注入面（见 §5） |
| 7 | 日相管道**零计时** | `dayPipeline.ts:116-118` `runDayPipeline` 就是 `for (const phase of phases) phase.run();` | 日相耗时今天**根本没被测**，要新插桩；插桩点选这里（1 处）而非 22 个调用点 |
| 8 | 相数＝22 | `DAY_PHASE_ORDER` 实测 22 项 | 聚合行里 22 个 ms 值太长 ⇒ 采"总和＋最慢 top-N"，不摊开全相 |
| 9 | 单帧最坏补 400 日 | `timeSystem.ts:14` `MAX_TICKS_PER_UPDATE = 400`；`:27-30` 循环内 `this.store.tickDay()` | **最坏 8800 相/帧**。逐相写必炸，是本稿降档策略的第一依据 |
| 10 | 日速基准 | `balanceConfig.ts:56` `msPerDay: {1:2000, 2:1000, 3:500}` | 稳态最快 2 日/秒 ⇒ 决定"按日一行"的可读速率与小时体积 |
| 11 | 🔴 `disable-gpu-vsync` | `index.ts:35` | **帧距不是 16.7 ms**。凡"按帧数换算时间／按 60fps 定预算"的推导一律作废（前一路班已实测否证过一次），本稿所有预算**只用墙钟** |
| 12 | 🔴 `backgroundThrottling: false` | `index.ts:72`（`webPreferences` 内） | 失焦**不降频**。窗口最小化／被遮挡时游戏继续全速跑 ⇒ 不能用"失焦即静音"当日志闸；且无人观看时仍会持续产出，预算必须按连续满速算 |
| 13 | `disable-features=CalculateNativeWinOcclusion` | `index.ts:36` | 连"窗口被遮挡"这个事件源都被关了 ⇒ 没有可靠的 occlusion 信号可拿来关日志，进一步坐实 12 |
| 14 | type-check 覆盖面不含主进程 | `npm run type-check` = `tsc -p tsconfig.renderer.json`；主进程要另跑 `npx tsc -p tsconfig.main.json --noEmit`，**现存 2 枚遗留错** `index.ts(93,9)/(93,18) TS18048` | 新增日志模块**不会**被 `npm run type-check` 兜住；验收判据必须点名跑 main 工程，并声明基线是 2 枚错（不得增加） |
| 15 | 无根 tsconfig、vitest 无 `testTimeout` | `vitest.config.ts` 的 `test` 块只有 `environment`＋`include` | 若本设计要配性能判据，**必须同时给显式 timeout 第三参**，否则判据是死闸（见 §6） |

**对锚点的一处收窄**：bd0f 遗留②还提到"`src/main/index.ts:8` 把 logs 硬编码到 cwd 之外的 `D:/…` 绝对路径，是否为预期需人工确认"。复核：`:16-31` 的 `ensureDDrivePaths()` 有 try/catch 回退到 Electron 默认 `userData`，**且这是用户明示的 D 盘存储硬要求**（`:11` 注释），故不属缺陷；但它给日志带来一条硬约束——**回退发生时 `app.setPath('logs')` 那一行没执行**，所以日志器**必须在写时读 `app.getPath('logs')`，绝不能缓存 `D_DRIVE_LOGS` 常量**，否则无 D 盘的机器上日志写进一个不存在/不该写的位置。

---

## 2. 承载体形状（选型）

```
渲染进程                          IPC                    主进程
gameStore / timeSystem   →  环形缓冲(渲染侧, 128 条)  →  runtime-log IPC(send, 非 invoke)
   订阅 STATE_EVENTS            满则丢最旧并计数              ↓
   或在 runDayPipeline 插桩   ← 背压信号(可选) ←      BoundedRuntimeLog
                                                    - 内存队列(有界)
                                                    - 每 500ms / 64KB 刷一次
                                                    - tmp + rename 滚动
                                                          ↓
                                              app.getPath('logs')/runtime.log
```

三条选型理由：

1. **写手必须在主进程**：渲染层 `nodeIntegration:false`（`index.ts:71`）拿不到 fs；且渲染层随时可能 `render-process-gone`（`index.ts:122`），由它持有文件句柄会在崩溃当场丢日志。主进程写还能天然接住 `render-process-gone` / `child-process-gone` / `unresponsive` 这三条**现在只 `console.error` 的事件**（`:124/:141/:225`）——它们正是"为什么这一局没日志了"的关键行。
2. **IPC 用 `send`（单向）不用 `invoke`**：日志不能反过来卡主循环；`invoke` 每次留一个 promise，满速下会堆积。
3. **渲染侧先做环形缓冲**：`MAX_TICKS_PER_UPDATE=400` 的病态帧会一次产 8800 条，缓冲的作用是把这一坨**在渲染侧就地聚合掉**（见 §3 的 D 类），不让它穿 IPC。

新增文件（设计目标，本单不建）：`src/main/runtimeLog.ts`（写手）＋`src/preload/index.ts` 增 1 个方法＋`src/renderer/state/runtimeLogSink.ts`（订阅 `STATE_EVENTS` 并降级成日志行）。主进程侧只做"接收已格式化好的行"，**不在主进程解释游戏语义**，避免状态机知识渗进 Electron 层。

---

## 3. 写入点清单（判据①）

四类。**R**＝渲染层产出、**M**＝主进程自发。

### A · 日相耗时（任务点名）

| id | 触发时机 | 字段 | 频率 |
|---|---|---|---|
| `day.tick` | `tickDay()` 走完 22 相后**一条**（`runDayPipeline` 返回处插桩，`dayPipeline.ts:116-118`） | `day`、`sum_ms`、`slowest=<phaseId>:<ms>`、`speed` | 每游戏日 1 条；稳态最快 2 条/秒 |
| `day.phaseburst` | 单帧 `ticks` 达 `MAX_TICKS_PER_UPDATE` 上限或积压被丢（`timeSystem.ts:33`） | `ticks`、`dropped=1`、`sum_ms` | 罕见，**必须无条件写**（这是"死亡螺旋兜底"唯一可证痕迹） |
| `day.slowphase` | 某相 `ms ≥ SLOW_PHASE_MS` 且**非**逐日全摊 | 升档明细 | **仅超阈时**；同一 phaseId 每 20 日最多 1 条 |

🔴 明确**否掉**"每相一条"方案：22 条/日 × 2 日/秒 = 44 行/秒，按 §5 的字节预算约 **8 分钟**就轮掉一整份历史，等于没有日志。故 A 类默认按日聚合；只有 `day.slowphase` 升档才落到相粒度。

### B · 队列变更（任务点名）

| id | 挂钩处（现状） | 字段 |
|---|---|---|
| `queue.conversion` | `gameStore.ts:511` `conversionQueue.push`；`:2659-2661` `tickConversionQueue` 出列 | `op=add/done/drop`、`from`、`to`、`count`、`len` |
| `queue.decree` | `STATE_EVENTS.DECREE_ADOPTED / ADVANCED / COMPLETED / STALLED`（`:128-131`，发射点如 `:1375`／`:1148`） | `op`、`decreeId`、`stage`、`len(activeDecrees)` |
| `queue.build` | `BUILDING_PLACED / COMPLETED / UPGRADED / REMOVED`（`:121/:122/:138/:139`） | `op`、`buildingId`、`len(buildings)` |

订阅**既有 `STATE_EVENTS` 通道**即可，**不改状态机任何一行**——这是本稿最重要的一条约束：日志承载体不该要求业务码插 call site，否则它会随功能增长而漏。B 类只在 `len` 变化时写，避免每 tick 复述队列。

### C · 事件挂起（任务点名，与 c927-28 直接接口）

| id | 触发 | 字段 |
|---|---|---|
| `evt.pending` | `EVENT_TRIGGERED`（`gameStore.ts:1198/1223/1232`） | `id`、`day`、`has_def`（`getPendingEvent() !== null`）、`timeout_days` |
| `evt.resolved` | `EVENT_RESOLVED`（`:1278/1300/1332`） | `id`、`choice`、`applied`、`held_days` |
| `evt.orphan` | 同一 `pendingEventId` 已连续 `ORPHAN_WARN_DAYS` 日未解 **且** `has_def=false` | `id`、`held_days` |

`has_def` 这条字段是把 c927-28 的结论变成**线上可观测**的最小接口：bd0f 那种"一挂 359 日"在日志里会显形成 `evt.pending has_def=0` 之后连续 358 日无 `evt.resolved`。`evt.orphan` 做节流（同一 id 每 50 日 1 条），否则退化成一个死 id 就会自刷满文件。

### D · 生命周期／错误（M 类，收编既有 `console.*`）

| id | 挂钩处 | 备注 |
|---|---|---|
| `app.start` / `app.quit` | `app.whenReady()`（`:212`）/ `window-all-closed`（`:220`） | 含 `logs_path`、`fallback=0/1`（`ensureDDrivePaths` catch 走到即 1） |
| `main.rendergone` | `:122-138` 现有 `console.error` | **必须写盘**：这是"日志从此断了"的那一行 |
| `main.unresponsive` | `:140-142` | 限流 1 条/30 秒 |
| `save.write` | `:165-167` 原子写成功/失败 | 与存档域接口，不带 json 内容 |

**不列进日志的**（防成隐私/凭据面）：存档 JSON 正文、玩家名、任何 `resources` 全量快照（体积大且无必要）。

---

## 4. 格式（判据③）：结构化单行

单行、`|` 分隔定长头 ＋ `k=v` 尾。**不用 JSON 行**：日志自身若被截断半行，JSON 整行作废而 `k=v` 只丢最后一个字段；且 `grep`-only 取证是本仓日常。

```
2026-09-27T20:15:03.482+08:00|I|m|day.tick       day=400 sum_ms=3.17 slowest=population:0.94 speed=3
2026-09-27T20:15:03.484+08:00|I|r|evt.pending    id=relic_r0_s0 day=42 has_def=1 timeout_days=-
2026-09-27T20:15:09.120+08:00|W|m|day.phaseburst ticks=400 dropped=1 sum_ms=612.4
2026-09-27T20:15:09.121+08:00|E|m|main.rendergone reason=crashed retry=2/3
2026-09-27T20:21:44.007+08:00|W|r|evt.orphan     id=relic_r7_s0 held_days=358 has_def=0
```

字段纪律（写进设计的硬约束）：

1. **头四段固定**：`ISO8601 毫秒+时区` `|` `级别 D/I/W/E` `|` `来源 m=main / r=renderer` `|` `事件 id`，列间**单空格**、id 后**补齐到 20 列**，便于肉眼扫。
2. `k=v` 之间单空格，值含空格或 `=` 时**整值加双引号**；缺省值统一写 `-`，**不省字段**（下游 awk 列位才稳定）。
3. 时间戳由**主进程**打（渲染层时钟不可信且 `performance.now()` 与 `Date.now()` 混用过会漂移）；渲染层只带 `day`，不带自己的 ISO 串。
4. 🔴 禁写自由文本／中文长句到 `msg` 位——那是体积失控和截断的主要来源。人话解释留在文档和 §4 的表里，日志只留 id 与 k=v。
5. 单行硬上限 `MAX_LOG_LINE_BYTES = 240`，超了就在写手内截断并追加 `trunc=1`（宁丢尾巴不断行）。

---

## 5. 滚动策略与参数（判据②）

主进程写手内存队列 ＋ 定时刷盘，**不在每次 `log()` 里同步 fs**：

| 参数 | 建议值 | 依据 |
|---|---|---|
| `MAX_LOG_BYTES`（单份） | **2 MiB** | 见下方算术；与 `MAX_SAVE_BYTES`（`:152`）同一命名族，量级差 5× |
| `MAX_LOG_FILES`（保留份数） | **3**（`runtime.log`＋`.1`＋`.2`） | 常驻 3×2 MiB ＝ 6 MiB；滚动瞬间多一枚 `.tmp` ⇒ **磁盘硬上界 8 MiB** |
| 滚动方式 | 写满即 `rename(runtime.log → runtime.log.N)`，`.2` 丢弃，再开新 `runtime.log` | 与存档同用 `rename` 原子语义（`:167`） |
| 刷盘触发 | 攒到 **64 KiB** 或每 **500 ms**，以先到者 | 崩溃现场最多丢 500 ms；64 KiB 上限防满速帧 |
| 写盘方式 | 先写 `runtime.log.tmp` 再 `rename`（仅滚动时）；常态 `appendFile` | 常态 append 避免每次 rename 的开销 |
| 内存队列上限 | **512 行**，满则**丢最旧**并 `dropped=<n>` 计数进下一行 | 主进程写不动时不能反向撑爆渲染层 |
| 渲染侧环形缓冲 | **128 条 / 250 ms** 一批 IPC `send` | 病态帧的 8800 条在渲染侧先聚合成 ≤3 条 |
| `SLOW_PHASE_MS` | 5（升档明细阈值） | 稳态单日 22 相合计应在个位数 ms；给"哪一相变贵"留一个门 |
| `ORPHAN_WARN_DAYS` / 节流 | 10 日起报、同 id 每 50 日 1 条 | 接 c927-28 的 C 类，同时防死 id 自刷 |
| 启动期 | `app.start` 必写；`ensureDDrivePaths` 走了 catch ⇒ `fallback=1` 必写 | 满足 §1#收窄：路径回退要留痕 |

**体积算术（为什么是 2 MiB／3 份）**

- 稳态满速（speed 3，2 日/秒）：A 类 2 行/秒 ＋ B 类约 0.3 行/秒 ＋ C 类约 0.15 行/秒 ≈ **2.5 行/秒**，按均值 90 B/行 ⇒ **≈ 225 B/秒 ≈ 13.5 KiB/分 ≈ 0.8 MiB/小时**。
- ⇒ 单份 2 MiB ≈ **2.5 小时**连续满速；3 份 ≈ **7.5 小时**回溯窗。一局长会话（数小时）落在窗内，且磁盘上界钉死 8 MiB。
- 病态帧（8800 相/帧）**不改变**上式，因为 §3-A 已把它压成 1 条 `day.phaseburst`；这正是"按日聚合"而非"逐相写"的理由。
- 🔴 预算**不能**按"失焦就慢下来"省：`backgroundThrottling:false`（`:72`）＋ 无 occlusion 信号（`:36`）意味着挂机一夜也在 2.5 行/秒。0.8 MiB/小时 × 8 小时 ≈ 6.4 MiB，落在 3 份窗内、不会溢出到别的文件——这是本稿唯一能自证的"有界"。

**与 Electron 现状的整合（判据④的前半）**

- 复用 `app.setPath('logs')`（`:23`）与 `ensureDDrivePaths()` 的回退语义；**写时取 `app.getPath('logs')`**，不缓存常量。
- 文件名必须与 Chromium 自己的日志件**错开**：Electron 在启用 `--enable-logging` 时通常会在 logs 根写自有轮转件（**本仓当前未启用，故磁盘上只有我们建的空目录，见 §1#2——此条按预防性约束处理，不当已验事实**）。本稿因此用**独立名 `runtime.log`**，并让轮转只匹配 `/^runtime\.log(\.\d+)?$/` —— **绝不做"清空 logs 目录"**，否则会顺手删掉非本模块创建的诊断件。
- 收编而非新增：`index.ts:28/:124/:131/:141/:225` 那 5 处 `console.*` 改为"同时 `console.*` ＋ 写日志"（保留 dev 时控制台可读性），不删不改语义。
- 用户可见提示已有先例：`:135` 的 `dialog.showErrorBox` 文案已经写着"请反馈日志（user-data/logs）"——**今天是句空话（那目录是空的，§1#2）**，本承载体落地后它才第一次成立。这是这条设计最直接的验收口径。

---

## 6. 若配套性能判据（**必须带 timeout 形状**）

`vitest.config.ts` 无 `testTimeout` ⇒ 默认 5e3 ms。任何形如"日志开销不得使日相耗时上涨 >X%"的判据在默认闸下会**先超时红**，属死闸。正确形状（写进设计，本单不建）：

```ts
// 目标文件：src/renderer/state/__tests__/runtimeLog.test.ts（将来）
it('22 相聚合日志不拖慢 tickDay', () => {
  // 2000 次 tickDay 的对照计时
}, 30_000);   // ← 显式第三参，缺此则该判据永不绿
```

主进程侧另有一条**无法用 vitest 覆盖**的面：`tsconfig.main.json` 才含 `src/main/**/*`，而 `npm run type-check` 走的是 renderer 工程 ⇒ 新日志模块必须**单独点名验**，且基线是现存 2 枚遗留错（`index.ts(93,9)/(93,18) TS18048`，与本设计无关、不得顺手修）：

```
npx tsc -p tsconfig.main.json --noEmit     # 期望：仍恰为 2 错，且不含 runtimeLog.ts
```

---

## 7. 遗留／交人工

1. **落盘位置是否要离开 cwd 之外**：`D_DRIVE_LOGS` 指向仓外 `D:/colony-game/user-data/logs`（`:8`）。若产品要"反馈日志"随工程走，需改路径口径——属既有用户硬要求，本单不动、只登记。
2. **IPC 频控闸**：日志通道是渲染层能主动打主进程文件的唯一新通道。写手必须**只接受定长头校验过的行**（长度 ≤240 B、`id` 白名单正则），否则渲染层一个 bug 就能把 `runtime.log` 轮转刷成噪声、或写出 `../` 型文件名。这条是本设计的安全底线，不得省。
3. `evt.*` 的 `id` 含古迹链 id，理论上来自存档可被外部构造（长度已由 `VALID_SLOT_RE` 类思路约束）⇒ 写前对 `id` 限长 64 字符。
4. 是否要把日志摘要透到渲染层 HUD（"本局最慢相"）——属可见性裁决，另开单。
5. 与 c927-28 的 `console.warn` 放行支（案 B 反对 3）共用一个写入点，两单若同时落地需合流，避免同一事件双写。
