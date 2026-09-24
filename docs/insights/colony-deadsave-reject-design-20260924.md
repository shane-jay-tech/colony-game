# colony 死档拒载面补全设计稿（c924-09 · 2026-09-24）

> **班次**：`qoder-executor-20260924-0955-colony18`（zcode-bridge 执行班 · 本仓唯一写位）· cwd `D:\code\colony-game`
> **开工 HEAD**：`805722b`（现取于 2026-09-24T13:52+08:00，引前请复跑 `git log -1`）
> **红线声明**：本案落在**存档兼容 ＋ 经济/资源数值域**（`productionCarry` 脏值实测能把 `resources.grain` 变成 NaN）。
> 按纪律档 `tmp/executor-drain-discipline-20260924.md` §五.3 与 §九 的点名口径：
> 🔴 **本文件是本单唯一入库产物。生产码一字未改、数值一字未改、测试件一字未改；所有行为改动只留稿交人工。**
> 探针全部在 `tmp/c924-09/`（`tmp/` 被 `.gitignore:25` 忽略，实测见 §7）。
> **上游**：`zcode-bridge/done/c923-11.result.md` G3（把本命题从 calendar 单里拆出来）、
> `docs/insights/colony-day-sanitize-census-20260923.md`（c923-11 普查）、
> `docs/insights/colony-saveguard-coverage-20260923.md`（c923-30 段①，38 支守卫的覆盖分档）、
> `docs/insights/colony-fractional-day-sandbox-20260924.md`（c924-08，`currentDay` 小数格已单独出稿，本稿不重复）。

---

## 〇、结论先行（五条，全部是量出来的）

1. **零校验透传不是一个字段，是一片**：`deserialize` 里 `s.<字段> ?? <缺省>` 这种"只兜缺键、不验类型"的写法实测 **11 处**，
   其中 **2 处**（`resources:427`／`currentDay:438`）后面紧跟一条真校验（拒载），余下 **9 处是纯透传**：
   `policies:450`／`activeModifiers:451`／`activeDecrees:452`／`eventHistory:453`／`pendingEventId:454`／
   **`pendingEventDayStart:455`（卷宗点名的首例）**／`productionCarry:456`／`tutorialStepId:457`／`lastSeenTimestamp:461`。
   另有 **2 处**（`generals:549`／`activeExpeditions:552`）形态不同但更糟：**校验前先解引用，脏档直接崩成裸 `TypeError`**（§2）。
2. 🔴 **`replaceState` 是第二道门，但它只拦 3 个字段**（`activeModifiers`／`panelCollapsed`／`productionCarry` 的**假值面**）。
   把两道门叠起来算，**双盲字段（两侧都无类型校验）实测 8 个**：
   `policies`、`eventHistory`、`pendingEventId`、`pendingEventDayStart`、`activeDecrees`、`tutorialStepId`、
   `lastSeenTimestamp`、`defenseAlerts`（＋ `lastEventDay` 的 NaN 半盲，实测读数见 §3 表 A 倒数第 3 行）。
   ⇒ 只给 `saveLoad.ts` 加校验**不够**，只给 `replaceState` 加也**不够**；两处的责任划分必须先定（§5 决策点 D1）。
3. **真危害不是"显示难看"，是"整条事件流永久停摆"**：脏 `pendingEventId`（数字 `123` 或不存在的 `"ghost_id"`）
   让 `runEventTick`（`gameStore.ts:1155-1164`）**每次都 early-return** ⇒ 实测 80 个 `tickDay` 后
   **新事件触发 0 次、`eventHistory` 长度 0**，而干净基线同种子同长度下是 **4 次／3 条**。
   `pendingEventDayStart` 的 NaN／1e9 两档同型停摆。**这是"死档"里最像"活档"的一类**：不弹错、不崩、资源照涨，只有叙事不再发生。
4. 🔴 **上游 c923-11 那句"字符串能过，随后 `gameStore.ts:1159` 的减法产 NaN"只对了半句**（本机实测否证，见 §1 表 C）：
   字符串 `'7'` 在 JS 里被隐式 coercion，`elapsed = 45 - '7' = 38`——**不 NaN，静默按错误的起算日继续跑**，
   超时照常触发（实测 80 tick 后新触发 3 次／history 4 条）。
   ⇒ 危害形态要分两栏写：**NaN 族 = 停摆**，**可 coercion 族 = 悄悄算错**，后者更难被发现，不能只按"会不会崩"排优先级。
5. **改判据的账要提前算清**：`saveV9Fixture.test.ts:60-62` 钉的是
   `serialize(deserialize(夹具))` 与夹具**逐字节相等**，且 `:67-74` 钉 **state 顶层键集 == `serialize()` 键集**；
   `saveGuard3.test.ts:140` 更把"非法 relicSite 项**被静默过滤**"当成现状钉桩。
   ⇒ 任何"钳制/消毒"必须对干净档**恒等**，任何"把静默过滤改成拒载"**必须连这两条断言一起翻**（§4 表末列逐条点名）。

---

## 一、锚点复核（卷宗前提逐条，含两处精度否证）

```
$ rg -n 's\.[A-Za-z]+ \?\? (null|\[\]|\{\}|0)' src/renderer/state/saveLoad.ts | wc -l
11
$ python -c "…同上判据逐行打印…"        # 双轨自证（纪律档 §九.3：凡"多少处"式判据要正则＋第二实现对到位）
python 计数: 11
```

| 卷宗/上游前提 | 实测 | 判定 |
|---|---|---|
| `saveLoad.ts:455` 是 `pendingEventDayStart: s.pendingEventDayStart ?? null,` | 该行原文一字未漂移 | **成立**（锚点 0 漂移） |
| c923-11：「连 typeof 都不查 ⇒ 字符串能过」 | `deserialize` 后 `state.pendingEventDayStart === '7'`（探针 B 表 A 行） | **成立** |
| c923-11：「随后 `gameStore.ts:1159` 的减法产 NaN」 | 行号 0 漂移（1159 确为该减法）；但 `'7'` → `elapsed=38` 不 NaN，只有 `NaN`/`1e9`-非数族才 NaN | **半成立**，按 §0.4 收窄 |
| 「与本命题正交（与本仓 calendar 单），应单列一条拒载单」 | `pendingEventDayStart` 全仓消费点仅 2 处非测试（`gameStore.ts:1159`／`ui/EventModal.ts:242-249`），与 `calendar.ts` 无耦合 | **成立** |
| 派单横幅引：「9/24 该仓实测 `Math.floor` 作用在 `*Day` 字段的是 13 处（不是上游记的 8 处）」 | 复跑两口径（§7 命令 P-9）：**全 src 非注释非测试、参数含 `*Day`/`*Days` 属性访问 = 14 处**；**剔除 `calendar.ts:8` 的本地量 `totalDays`（非字段）= 13 处** ✅ 与派单一致；**只数 `deserialize` 主字面量段 447-556 = 8 处** ✅ 与"上游记的 8"一致 | **两个数都对，是口径差**：13 = 全 src 字段面；8 = 存档消毒面。本稿取 **13** 作"新增钳制须对齐的既有形态全集"，取 **8** 作"存档侧已消毒字段数"，并在 §4 表 E 组里逐行列 13 处位置 |
| 派单横幅引：「`% 30` 门有两处（`gameStore.ts:1999`／`:2715`）」 | `rg -n "% 30" src/renderer/state/gameStore.ts` → 恰这 2 行；全 src 另有 `calendar.ts:11 dayInYear % 30`（季内日，不是门） | **成立**（且补一条：全仓 `% 30` 共 3 处，第 3 处不是门） |

⚠ **取数坑（新踩，供下一班）**：同一判据 `rg` 一次只回显了 11 行里的 5 行（终端/工具截断，非 MSYS 改写），
差点被读成"只有 5 处透传"。⇒ 凡"几处"式判据**一律 `| wc -l` 或落盘后数**，别信屏显。

---

## 二、双层守卫矩阵（`deserialize` 门 × `replaceState` 门）

`GameState` 的存档可达面 = `serialize` 写出的 **51 个 state 顶层键**（`saveV9Fixture.test.ts:77-79` 也钉 `≥50`）。
两道门的分工实测如下（"⛔"= 拒载 throw；"✂"= 钳制/消毒；"🟡"= 只兜缺值不验类型；"—"= 完全不管）：

| 字段（`saveLoad.ts:deserialize` 行） | 门 1 `deserialize` | 门 2 `replaceState`（`gameStore.ts:2820-2905`） | 双盲？ |
|---|---|---|---|
| `resources:427` | ⛔ 值必须 finite number（键名/负值不查） | 占用制补 `people` | 否 |
| `buildings:424` | ⛔ 逐条 shape（`:711-768`，11 支 throw） | — | 否 |
| `currentDay:438` | ⛔ 区间 [0,3600] ＋ isFinite，**不查整数**（c924-08 已单独出稿） | — | 半（小数） |
| `policies:450` | 🟡 `?? []` | — | **是** |
| `activeModifiers:451` | 🟡 `?? []` | ⛔ `validateModifierInstance` 逐条，抛普通 `Error` | 否 |
| `activeDecrees:452` | 🟡 `?? []` | — | **是** |
| `eventHistory:453` | 🟡 `?? []` | — | **是** |
| `pendingEventId:454` | 🟡 `?? null` | — | **是** |
| `pendingEventDayStart:455` | 🟡 `?? null` | — | **是** ← 卷宗首例 |
| `productionCarry:456` | 🟡 `?? {}` | 🟡 `if (!newState.productionCarry)`（**只看假值**） | **是**（非数值键） |
| `tutorialStepId:457` | 🟡 `?? null` | — | **是** |
| `seenJitHints:458` | ✂ Array+filter(string) | — | 否 |
| `lastEventDay:460` | ✂ `Math.max(0,Math.min(…,currentDay))` — **但 `typeof NaN === 'number'` 直接穿过**（实测落 NaN） | — | **半**（NaN/Infinity） |
| `lastSeenTimestamp:461` | 🟡 `?? 0` | — | **是**（且是**死字段**，见 §3 表 F） |
| `speed:408`／`rngSeed:413` | ✂ 枚举白名单／isFinite 兜底 | — | 否 |
| `worldMap:416` | ⛔ 深校验（缺失→按种子重生成） | 建 accessor | 否 |
| `panelCollapsed:469` | ✂ 两 boolean 齐查 | ✂ 假值兜底 | 否 |
| `completedDecreeIds:475` | ✂ Array+filter | ✂ `Array.isArray` | 否 |
| `npcCountries:479` | ⛔→✂（`validateNpcCountriesArray` 逐条消毒，**不 throw**） | ✂ 空数组兜底 | 否 |
| `playerMorale/playerMilitaryPower:482,519` | ✂ isFinite＋区间 | ✂ typeof | 否 |
| `publicWrath:485`／`worldWariness:489` | ✂ `clampSentiment`/`clampWariness`（内部 `!isFinite → 缺省`） | ✂ typeof | 否 |
| `lastWrathDemandDay:486`／`lastPropagandaDay:491`／`endgame*Day:509,512`／`wrathUltimatumEndDay:516` | ✂ `isFinite → Math.max(0,floor)` | ✂ typeof | 否 |
| `relicSites:494` | ✂ **静默过滤非法项**（`:504` 坐标 `Math.floor(NaN)=NaN` 不拦） | ✂ `Array.isArray` | 半（NaN 坐标） |
| `grade/gradeReached:523`／`dualZeroDays:527`／`crisisRecoverDays:529`／`crisisCount:535`／`grainNegativeDays:542` | ✂ `clamp`/`Math.floor(finiteNum)` | ✂ typeof | 否 |
| `mode:531`／`tianxiaAcknowledged:525`／`crisisActive:528`／`vassalOf:536`／`lastWarinessReason:490` | ✂ 枚举/`=== true`/typeof string | ✂ 同类 | 否 |
| `populationCarry:533` | ✂ `finiteNum` | ✂ `!isFinite` | 否 |
| `storyFlags:538` | ✂ 子字段逐条（`:562-586`，含 `slice(0,500)` 上限） | ✂ undefined 兜 null | 否 |
| `populationClasses:540`／`conversionQueue:541`／`factionState:543`／`megaProjects:544` | ✂ helper 消毒（`:588-658`，含 `slice(0,50)`／`slice(0,10)` 上限） | ✂ 假值/Array | 否 |
| `exclusivePolicies:545` | ✂ Array+filter | — | 否 |
| `generals:549` | 🔴 `Array.isArray` 后**直接 `g.id`** → `[{…}]` 里放 `null` 即 `TypeError`（不是 `SaveLoadError`） | — | **崩溃形态错位** |
| `activeExpeditions:552` | 🔴 `e.config.units` 无可选链 → `config` 缺即 `TypeError` | — | **崩溃形态错位** |
| `defenseAlerts:555` | 🟡 只 `Array.isArray` ＋ `{...a}` 浅拷（`['a']` 能过） | — | **是** |

**读表结论**：门 1 的 `SaveLoadError(` 总数现值 **38**（`rg -c` 与 python 双轨一致，与 c923-30 段① 同数 ⇒ 该文件守卫面自 9/23 未增未减），
但**这 38 支全部集中在 5 个"重字段"上**（worldMap 18／buildings 11／顶层入口 6／resources 1／currentDay 1／slot 与写盘 2），
其余 40+ 字段的消毒全靠"✂/🟡"，其中 🟡 的 11 处就是本稿要补的**拒载面缺口**。

---

## 三、逐字段实测损害表（探针读数，非推演）

探针跑法（**不入 `npm test` 口径**：`vitest.config.ts` 的 include 只有 `src/**/__tests__/**` 与 `scripts/__tests__/**`，
本班另配 `tmp/c924-09/vitest.config.ts` 指 `tmp/c924-09/**/*.probe.test.ts`，用 `--config` 显式跑）：

```
$ npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/deadsave2.probe.test.ts
```

### 表 A · 三段式：`deserialize` → `replaceState` → `tickDay×3` 各自结果

| 脏值喂法 | 门 1 | 门 2 | tick | 读数 |
|---|---|---|---|---|
| `pendingEventDayStart='7'`（同时挂真 `pendingEventId`） | OK | OK | OK | `elapsed=38`（**coercion，不 NaN**） |
| `pendingEventDayStart=1e9` | OK | OK | OK | `elapsed=-999999955` |
| `pendingEventDayStart=NaN` | OK | OK | OK | `elapsed=NaN` |
| `pendingEventDayStart=-5` | OK | OK | OK | `elapsed=50` |
| `pendingEventId=123`（数字） | OK | OK | OK | 落 state 后仍是数字 123 |
| `eventHistory='abc'` | OK | OK | OK | **字符串活着**（`new Set('abc')` 恰好可用，见 §表 C） |
| `eventHistory=[null,1]` | OK | OK | OK | 原样活着 |
| `policies='nope'` | OK | OK | 🔴 `TypeError: this.state.policies.filter is not a function` | 崩在 `gameStore.ts:565` |
| `policies=[null]` | OK | OK | 🔴 `TypeError: Cannot read properties of null` | 同一行 `p.adopted` |
| `activeModifiers=[{}]` | OK | 🔴 `Error: [GameStore.replaceState] invalid activeModifier` | — | **门 2 拦住了**（但抛的是普通 `Error`，不是 `SaveLoadError`） |
| `activeDecrees=[{id:'x'}]` | OK | OK | OK | 静默活着 |
| `productionCarry={grain:'x'}` | OK | OK | OK | 3 tick 后 **`grain=NaN`**（表 B） |
| `tutorialStepId=42` | OK | OK | OK | 静默活着（后果见 F 行） |
| `lastSeenTimestamp=NaN` / `'yesterday'` | OK | OK | OK | 静默活着 |
| `defenseAlerts=['a']` | OK | OK | OK | 表 D：**第 1 个 tick 就走"来犯结算"** |
| `generals=[null]` | 🔴 `TypeError`（`saveLoad.ts:550` `g.id`） | — | — | **不是 SaveLoadError** |
| `activeExpeditions=[{}]` | 🔴 `TypeError`（`:553` `e.config.units`） | — | — | **不是 SaveLoadError** |
| `lastEventDay=NaN` | OK | OK | OK | 落 `NaN`（`Math.max(0,Math.min(NaN,42))` = NaN） |
| `relicSites=[{…,position:{x:NaN,y:1},stage:9}]` | OK | OK | OK | 过滤没拦（`typeof NaN==='number'`），坐标 NaN 入 state |
| `currentDay=100.5` | OK | OK | OK | c924-08 已量（只有 6/20 格翻转） |

### 表 B · `productionCarry` 脏值的资源污染（**经济数值域，本稿不动任何数**）

```
$ npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/carry2.probe.test.ts
D in={}                含键=0 -> 112/{} -> 85/{}
D in={"grain":null}    含键=1 -> 112/{} -> 85/{}
D in={"grain":"x"}     含键=1 -> NaN/{} -> NaN/{}
```

机理（`productionSystem.ts:176-201`，纯读）：`carryIn = prevCarry[r] ?? 0` ⇒ `null/undefined` 被 `??` 救回，
**非数值字符串救不回**：`rawNet = 0-0+'x' = NaN` → `intNet = Math.trunc(NaN) = NaN` → `intNet !== 0` 成立 →
`deltas.grain = NaN` → `applyDayDeltas` → `setResourceClamped` → **`resources.grain` 永久 NaN**（下一 tick 起 carry 被覆盖成 `{}`，
但资源侧 NaN **不自愈**）。⇒ 这条是 9 处透传里**唯一能把经济数值打坏**的，优先级最高；
而"把 carry 钳成 0"就会改干净档的 `0.2000000000000064` 吗？—— 不会（它是合法小数，表 D 第 3 行证明合法值恒等通过），
**但**若钳制式写成"取整"就会破坏 `saveV9Fixture` 的逐字节相等 ⇒ 见 §4 R-3。

### 表 C · 事件流停摆（80 tick，逐档独跑排除串扰）

```
$ for i in 0 1 2 3 4 5; do ONLY_SCEN=$i npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/deadsave3.probe.test.ts; done
B clean 基线                 挂起未决=true 新触发=4 history=3
B pendingEventId=123(数字)    挂起未决=true 新触发=0 history=0
B pendingEventId="ghost_id"   挂起未决=true 新触发=0 history=0
B 真 id + dayStart=NaN        挂起未决=true 新触发=0 history=0
B 真 id + dayStart=1e9        挂起未决=true 新触发=0 history=0
B 真 id + dayStart="7"        挂起未决=false 新触发=3 history=4
```

- 前三档与第 4/5 档的差别只在**是否静默**：停摆由 `gameStore.ts:1155` 的 `if (pendingEventId !== null) { … return; }` 造成，
  而"解挂"只有两条路（玩家点 choice，或 `checkEventTimeout` 到期自动 `resolveEvent(0)`，`eventEngine.ts:143-150`）。
  `def` 查不到（ghost/数字）或 `elapsed` 为 NaN／负数 ⇒ 两条路都断 ⇒ **档还"能玩"，但叙事永久不再前进**。
- 最后一档 `'7'` **不停摆、只算错**（coercion）⇒ 停摆判据要写成"`pendingEventId` 必须 ∈ 事件表 ∪ {null}"，
  单纯 clamp `pendingEventDayStart` **治不了 ghost id 这一型**。
- 附带一条在册事实复证：`eventHistory` 是 `string[]`，脏成 `'abc'` 时 `new Set('abc')` 恰好能跑（字符集），
  所以**当前不炸**；但 `gameStore.ts:1281` 与 `:1315` 会 `eventHistory.push(...)` ⇒ 一旦有事件被解决就
  `TypeError: eventHistory.push is not a function`。属"延迟引爆"型，别按"跑绿了就没事"归档。

### 表 D · `defenseAlerts` 脏条目 → 无预警直接结算

```
$ npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/deadsave4.probe.test.ts
F ["a"] -> [] threw=
F [{id:x}] -> [] threw=
E 缺字段   仍在册=[{"id":"decree_conscript","daysElapsed":null}] threw=
E 正常初值 仍在册=[{"id":"decree_conscript","currentStage":0,"daysElapsed":41}] threw=
E 越界stage 仍在册=[{"id":"decree_conscript","currentStage":99,"daysElapsed":40}] threw=
```

- `gameStore.ts:1989-1996`：`daysUntilAttack: alert.daysUntilAttack - 1` → 脏条目得 `NaN` → `NaN > 0` 为假 →
  **第 1 个 tick 就进 `resolveIncomingAttack(next)`** ⇒ 玩家凭空吃一次"守土/被劫掠"结算（吃的是资源与兵力，**经济数值面**）。
- `activeDecrees` 三档全不崩：真 id 缺 `currentStage` → `decree.stages[undefined]` 为 `undefined` →
  `tickActiveDecree` 的 out-of-range 防御 `return null`（`decreeSystem.ts:141-142`）→ 调用方 `{...rec, daysElapsed: NaN+1}` →
  **该 decree 永久挂在册上**（`currentStage` 键还在，但 `daysElapsed` 落 `NaN`，`PolicyTreePanel.ts:722` 的进度百分比跟着变 NaN）。
  越界 stage 同理（不推进、不移除）。

### 表 E · `13 处 *Day 的 `Math.floor` 消毒形态`（新增钳制必须复刻的既有式，逐行）

存档侧 8 处（`deserialize` 主字面量段 447-556，**即"上游记的 8"**）：
`saveLoad.ts:487`（lastWrathDemandDay）／`:492`（lastPropagandaDay）／`:510`（endgameAscendDay）／`:513`（endgameLastWaveDay）／
`:517`（wrathUltimatumEndDay）／`:527`（dualZeroDays）／`:529`（crisisRecoverDays）／`:542`（grainNegativeDays）
—— 五式同型：`typeof/finiteNum` 把关 ＋ `Math.max(0, Math.floor(…))`。
存档侧另有 **3 处在这个区间之外**（所以 8 不是存档面全集）：`:580`（`storyFlags.chapterStartDay`）、`:631`、`:632`（`factionState.lastEventDay`/`nextEventDay`，**这两处只有 floor、没有 `Math.max(0,` 且语义上 -1 是合法哨兵**）。
非存档侧 2 处：`ui/PolicyTreePanel.ts:722`、`ui/PopulationPanel.ts:212`（显示层）。剔除 `calendar.ts:8` 的本地量 ⇒ **13**。

### 表 F · 两处"补校验等于白补"的死数据

- `lastSeenTimestamp`：全仓非测试只有 4 处（`schema.ts:442` 类型、`gameStore.ts:211/328` 声明与初值、`:554` getter、`:2817` setter、`saveLoad.ts:47/324/461`）。
  **`getLastSeenTimestamp()` 零非测试调用方**，`OFFLINE_REWARD` 也只有 `data/index.ts` 的再导出 ⇒ 脏值当前**无任何可见后果**（与 9/23 §十二"教程三步全是死数据"同族）。
- `tutorialStepId=42`：`TutorialModal.ts:112/168` 判 `=== WELCOME_STEP_ID`，非 welcome 一律"关掉模态"⇒
  脏值表现为**教程永久不弹**（fail-silent，且不崩）。
⇒ 这两格建议走"容忍＋注释点名"，不要为它们写 throw（写了也测不到，还会挤掉真缺口的位置）。

---

## 四、三策矩阵（拒载 / 钳制 / 容忍）× 影响用例 × 存档兼容风险

**列含义**：
- **拒载** = 抛 `SaveLoadError`（玩家看得见"档损坏"，代价是**这档再也读不开**）
- **钳制** = 消毒成合法值并继续（玩家无感，代价是**坏数据被静默改写**）
- **容忍** = 保持现状 `?? 缺省` ＋ 在类型面上收口（零风险，代价是**缺口继续裸奔**）
- 风险列里 **R-1..R-6** 定义见本节末。

| 字段 | 建议策略 | 拒载的影响用例 | 钳制的影响用例 | 容忍的代价 | 兼容风险 |
|---|---|---|---|---|---|
| `pendingEventDayStart:455` | **钳制**（非有限／`> currentDay` → 退回 `currentDay`，与 `lastEventDay:460` 同型；负值同处理） | 现有档里该字段只有 `null` 或合法日（夹具/合成档皆 `null`）⇒ 干净档恒等，但 R-1/R-2 面存在 | 表 C 里 NaN/1e9 两档从"停摆"变"当日重起算"（= 事件超时被重置，**方向对玩家有利**，可接受）；`'7'` 仍 coercion，除非钳制式同时查 `typeof` | 事件流永久停摆无人管 | R-1 R-2 |
| `pendingEventId:454` | 🔴 **钳制前先定"归属"（决策点 D2）**：`id ∈ 事件表` 是**内容层**判断，需要把 `this.events`/`content` 引进 `deserialize`（现在 `deserialize` 拿不到内容表）⇒ 只能退化成"必须 `typeof string` 或 null" | 数字型脏档被拒 ⇒ 玩家丢档；ghost id 型**拒载也拦不住**（它是合法 string） | `typeof string` 钳制只能杀掉 `123` 这一档，ghost 无效 | **ghost id 停摆仍无解** ⇒ 真正的修法在 `runEventTick:1155`（把"查不到 def"也当"无挂起"清掉），那属**行为改动**，超出本稿授权，交人工（§5 D2） | R-1 R-3 R-5 |
| `eventHistory:453` | **钳制**（`Array.isArray + filter(string)`，与 `:458 seenJitHints`／`:475 completedDecreeIds` 同型，**仓内已有两例现成式**） | 无（现有测试全喂数组） | `[null,1]` 被剔掉 2 项；`'abc'` 变 `[]` ⇒ **丢"已触发过"去重记忆**，老档可能重复触发一次已看过的朝议（可感但轻微） | `push is not a function` 的延迟引爆留在原地 | R-2 R-4 |
| `policies:450` | **钳制**（Array + 逐项 `{id:string, adopted:boolean}`） | `saveMatrix*.test.ts` 的合成薄档 `policies: []` 合法 ⇒ 不红；实测 30 件测试提到该字段（表 §7） ⇒ 改动前必按名跑 | `[null]` 项被剔 ⇒ `gameStore.ts:2224 policyPanelUnlocked` 的 `.every` 结果会变（**国格面板解锁判定**，属玩法面）⇒ 留人工 | 崩在 tick（表 A 两档 TypeError）继续存在 | R-2 R-4 |
| `activeDecrees:452` | **钳制**（逐项补 `currentStage=0`／`daysElapsed=0`，越界 stage 夹回 `stages.length-1`） | 薄档 `[]` ⇒ 不红 | 表 E 的"永久卡单"变"重头开始跑" ⇒ **decree 进度被改写**（经济：阶段 cost 重新扣）⇒ 🔴 经济数值域，**只出稿不落码** | 卡单＋NaN 进度条继续存在 | R-2 R-3 R-4 |
| `productionCarry:456` | **钳制**（`Object.fromEntries(entries.filter(Number.isFinite))`；**不得取整**） | `saveV9Fixture:60` 逐字节相等 ⇒ 若写成 `Math.floor` 立刻红（夹具真值 `0.2000000000000064`） | 表 B 的 NaN 型消失；合法小数残差**必须逐位保留**（否则改产出，属经济数值） | `grain=NaN` 继续存在（本表最严重的一格） | R-2 R-3 |
| `tutorialStepId:457` | **容忍**（＋注释点名"死字段/非 welcome 一律关模态"） | 无 | 无（无消费方可钳） | 教程永久不弹（cosmetic，且教程链本身在册为死数据） | 无 |
| `lastSeenTimestamp:461` | **容忍**（＋注释点名"写而不读"） | 🔴 若钳成"`<=0 → 0`"或"`>savedAt → savedAt`"：夹具真值就是 **`0`**，且 `saveV9Fixture:101` 钉"缺省值 == 夹具真值"⇒ **自洽但无意义**；若写成"拒载非正数"**直接打断 v9 真档夹具** | — | 无（死字段） | R-1 R-6 |
| `defenseAlerts:555` | **钳制**（逐项 shape：`npcId:string ∈ npcCountries`、`daysUntilAttack` 有限正整数，否则**丢弃该条**） | 夹具/薄档皆 `[]` ⇒ 不红 | 表 D 的"第 1 tick 凭空结算"消失（丢弃＝不结算）⇒ 少一次被劫掠，**经济面**，只出稿 | 无预警结算继续 | R-2 R-4 |
| `lastEventDay:460` | **钳制式缺陷修补**：`typeof` 换成 `finiteNum(…, 0)` 再夹（**与 :487 等同型**） | 无（现值合法） | NaN 型消失 | 事件节奏判定吃 NaN（`daysSinceLast` NaN → 采样判定永久 false，同"停摆"族） | R-2 |
| `relicSites:494` | 🔴 **不改**（`saveGuard3.test.ts:140` 已把"非法项被静默过滤"钉成现状） | 改拒载 ⇒ **该断言必红**，翻它＝改测试语义（§廿三"两笔一体"） | 坐标 NaN 可加 `isFinite` 剔除，但会改变过滤集合 ⇒ 同一条断言的"过滤数"读数变 | 遗迹链坐标 NaN（渲染层 `iso.ts` 会画飞） | R-4 R-5 |
| `generals:549`／`activeExpeditions:552` | **拒载（但改成"包一层 try → `SaveLoadError`"）**：现状是**崩溃形态错位**——同文件其余损坏面都走 `SaveLoadError`，这两条走裸 `TypeError`，`loadFromSlot:807-821` 与 UI 的 catch 都按 `SaveLoadError` 组织文案 | `saveIoSemantics`/`saveLoad.test` 里没有这两族的坏档用例 ⇒ 需**同时补用例**（否则新守卫裸奔，同 c924-08 §0.4 的教训） | — | 玩家看到的是"未预期的错误"而非"这档坏了" | R-2 R-5 |
| `currentDay:438`（小数） | 见 **c924-08 专稿**（本稿不重复给方案） | — | — | — | — |

**风险代号**：
- **R-1 干净档恒等**：新增判据必须对所有现存合法值恒等通过。反例已实测两枚：夹具 `lastSeenTimestamp=0`（"必须正数"式判据当场打断 v9 真档）、夹具 `productionCarry={grain:0.2000000000000064}`（"取整"式钳制破坏 `saveV9Fixture:60` 逐字节相等）。
- **R-2 薄档不被误伤**：`saveMatrix.test.ts:22-33` 与 `saveMatrix.extend.test.ts:7-18` 的合成档**只有 6 个键**。⇒ 判据必须写成"**键存在才校验**"（`?? 缺省` 语义不变），凡"字段必须存在"式拒载会**一次打断整条 v1..v9 迁移矩阵**（组 A 全档）。
- **R-3 经济数值域**：`productionCarry`／`activeDecrees`／`defenseAlerts`／`policies` 四格的钳制都会改产出、扣费或被劫掠判定 ⇒ **按纪律档 §五.3 只出稿、不落码、不选方案**，交人工裁决。
- **R-4 静默改写不可见**：`deserialize` 现在没有任何"我改了你的档"的上报通道（38 支守卫全是 throw 或无声消毒）⇒ 若采纳钳制策，建议同批开一条**一次性警告面**（如 `SaveSanitized` 事件／返回 `{state, sanitized: string[]}` 的第二形态），否则坏档会**静默变形**且永不可归因。这是**新增 UI/新增加载面**，超出执行手授权，列 §5 D3。
- **R-5 玩家档无还原点**：存档落在 electron `userData`（git 无覆盖），**拒载＝玩家档报废**，且本仓纪律禁跑任何"备份脚本"。⇒ 三策里**拒载只应用于"本来就会崩"的两格**（`generals`/`activeExpeditions` 的 TypeError 转 `SaveLoadError`，可载入率不降）。
- **R-6 键集不能变**：`saveV9Fixture.test.ts:67-74` 钉 `Object.keys(fixture.state) == Object.keys(serialize 产出)` ⇒ 任何"顺手删个死字段/换个字段名"的收口都会红，**且这是好事**（说明键集有看守）。

---

## 五、留给人工的三个决策点（本稿不代答）

- **D1 责任层**：补校验放**门 1（`deserialize`，磁盘态）**还是**门 2（`replaceState`，内存态）**？
  实况是两门都缺一半：门 2 已被册注释明确写成"deserialize 已深度校验，这里防内存路径"（`gameStore.ts:2821-2823`），
  而门 1 对 `policies` 等 9 格零校验 ⇒ **按现有分工，本稿缺口应全落门 1**。
  但门 1 **拿不到内容表**（`pendingEventId` 要查事件表才判得动），要补就得给 `deserialize` 注入 `content` —— 那是**签名改动**，牵动 `saveIoSemantics`／`saveMatrix` 全部调用点 ⇒ 需人工拍"是否值得"。
- **D2 ghost `pendingEventId` 的正解在哪**：`deserialize` 侧无表可查 ⇒ 更小的修法其实在
  `gameStore.ts:1155-1164`："`def` 查不到时视同无挂起并清 `pendingEventId`"。
  但这是**行为改动（会影响事件流推进）**，且会让"坏档"从"永久停摆"变"自我修复"—— 两案各有代价 ⇒ **只登记，不落码**。
- **D3 要不要"消毒上报"面**：采纳任一钳制策都应配 R-4 的上报通道，否则等于把 38 支"响亮拒载"换成"无声改写"。
  这条**同时是新 UI 入口**（psy 那类全局账本门在本仓的对应物是 `saveGuard*` 家族），需人工定形态。

**建议的落地次序（若人工放行，按性价比排）**：
P0 `productionCarry`（经济数值是唯一"不可逆污染"）＋ `generals`/`activeExpeditions` 的 `TypeError → SaveLoadError`（纯错误面，可载入率不变）；
P1 `eventHistory`/`policies`/`lastEventDay`（**照抄仓内现成式**，见各表"同型"列）；
P2 `pendingEventDayStart`（钳制）＋ D2（行为）；
P3 `activeDecrees`/`defenseAlerts`（经济面，单独走数值裁决流程）；
不做：`tutorialStepId`/`lastSeenTimestamp`（死字段，只补注释）；`relicSites`（现状钉桩，翻它要连带改测试语义）。

---

## 六、本稿**没有**做的、也**不该**被当成做了的

1. 没跑全量套件（纪律档 §四.2 并发不跑全量；本单判据也不需要全量数）。全量口径由本仓 pre-commit 代跑（现值见 claims 与主班收口）。
2. 没碰 `docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-dead-exports-20260914.json(.bak)`（他班在册在途 3 项）。
3. 没碰 `docs/insights/` 的 3 份索引件（`colony-insights-index-20260915/20260919/recount-20260917` 并存、无权威、无哨兵 ⇒ 属待人工择一，本档不补索引行）。
4. 没动 `currentDay` 小数案（c924-08 专稿已量，两稿在 `:438` 处不重叠）。
5. 没改任何生产码/数值/测试件：`git diff --stat` 对本班范围为 0（读数见 §7 P-1）。

---

## 七、复核命令附录（全部本班实跑，rc 均为 0 除非注明）

```
# P-1 零改动自证（只列 src 与本档；他班在册 3 项另计，本班未碰）
$ git -C D:/code/colony-game status --porcelain
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
?? docs/insights/colony-deadsave-reject-design-20260924.md      ← 本档
$ git -C D:/code/colony-game diff --stat -- src        # 空输出（src 侧零改动）
$ git -C D:/code/colony-game diff --numstat -- src     # 0 行（增删一律用 --numstat，纪律档 §十五）

# P-2 11 处 ?? 透传（双轨：rg + python 同读数）
$ rg -n 's\.[A-Za-z]+ \?\? (null|\[\]|\{\}|0)' src/renderer/state/saveLoad.ts | wc -l
11

# P-3 守卫总数（复证 c923-30 段① 的 38 未变）
$ rg -c 'SaveLoadError\(' src/renderer/state/saveLoad.ts
38

# P-4 事件域消费点（非测试；行号见正文）
$ rg -n 'pendingEventDayStart' src --glob '!**/__tests__/**' | wc -l
12        # gameStore.ts:205 323 577 1158 1159 1184 1209 1218 1260 ＋ saveLoad.ts:42 319 455
$ rg -n 'getPendingEventDayStart' src --glob '!**/__tests__/**'
gameStore.ts:577（getter 定义） ／ ui/EventModal.ts:242（唯一 UI 读方，大小写不同故不在上一式的 12 行内）

# P-5 % 30 门
$ rg -n '% 30' src/renderer/state/gameStore.ts
1999    2715

# P-6 replaceState 第二道门只拦 3 个字段
$ rg -n 'validateModifierInstance|newState\.productionCarry|newState\.panelCollapsed' src/renderer/state/gameStore.ts
2825（validateModifierInstance，门 2 的 modifier 闸） 2832（productionCarry 假值兜） 2834（panelCollapsed 假值兜）

# P-7 探针（三段式 / 停摆 / carry / decree-alert）
$ npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/deadsave2.probe.test.ts
$ ONLY_SCEN=0..5 npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/deadsave3.probe.test.ts
$ npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/carry2.probe.test.ts
$ npx vitest run --config tmp/c924-09/vitest.config.ts tmp/c924-09/deadsave4.probe.test.ts

# P-8 tmp 不进版本库
$ git check-ignore -v tmp/c924-09/deadsave2.probe.test.ts
.gitignore:25:tmp/

# P-9 *Day 的 Math.floor：两口径对到位（13 = 全 src 字段面，8 = deserialize 主段 447-556）
$ python - <<'PY'
import re,os
A=[]
for root,dirs,files in os.walk('src'):
    if '__tests__' in root: continue
    for fn in files:
        if not fn.endswith('.ts'): continue
        for i,l in enumerate(open(os.path.join(root,fn),encoding='utf-8').read().splitlines(),1):
            s=l.lstrip()
            if s.startswith('//') or s.startswith('*'): continue
            for m in re.finditer(r'Math\.floor\(',l):
                t=l[m.end():m.end()+90]
                if re.search(r"[A-Za-z_][A-Za-z0-9_]*Days?\b|\.\w*Days?\b|'\w*Days?'|\.\w*Day\b|'[A-Za-z]*Day'",t): A.append((os.path.join(root,fn),i))
print(len(A))          # 14
PY
$ # 剔除 calendar.ts:8（totalDays 是本地量，不是字段）⇒ 13；再只取 saveLoad.ts 447-556 ⇒ 8
```
