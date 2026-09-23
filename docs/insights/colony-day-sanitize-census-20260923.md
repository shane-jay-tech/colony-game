# colony「day 入口净化链」普查 · c923-11（2026-09-23，只读）

> 班 `qoder-executor-20260923-0022-colony5` · cwd `D:\code\colony-game` · HEAD 开工时 `74cbfa6`
> 本单**零 src 改动**（判据 ③），产物只有本文件与 `tmp/c923-11/` 下的只读探针（`tmp/` 已被 `.gitignore:25` 忽略）。
> 命题来自 `zcode-bridge/done/c922-12-colony-calendar-pin.result.md`：「若有人要收口，应先在 `dayClamp` 侧证一次『进 calendar 的 day 恒为有限非负整数』」。本文件就是那次求证的结果。

---

## 0. 结论三句

1. **`dayClamp` 是个不存在的名字**：全仓 `src` 内它只出现 1 次，且是 `calendar.test.ts:83` 的注释（实测见 §1）。真身是**两处不同的东西**——`saveLoad.ts:22` 的 `MAX_SAVE_CURRENT_DAY` 范围**拒载**，与 `gameStore.ts:943-945` tickDay 里就地声明的 `Math.min(prevDay + 1, 3600)` 封顶。**那条注释需要订正，但订正本身属 src 改动，本单不做**（见 §7）。
2. **『有限、非负、≤3600』成立；『整数』不成立**。生产可达的全部 day 入口都保证有限非负（探针 A 列实测），但 `deserialize` **唯独对 `currentDay` 不取整**——`100.5 / 0.0001 / 3599.999` 能原样穿过校验进 state（探针 B/C 实测 `int=false`）。所以**命题按字面为假**，按「有限非负」为真。
3. **`dayToCalendar` 内部那层 `Math.max(0, Math.floor(day))` 恰恰是把这个缺口吞掉的地方**——`floor` 分支生产可达（小数档）、`Math.max(0, …)` 分支生产不可达（负值全被上游拒）。⇒ 对 c922-12「再考虑删掉这层 clamp」的答复是：**只能删 `Math.max(0,` 半个表达式，且要先补 saveLoad 的整数校验；两层都删等于把小数/负值直接送进 `% 120` 与 season 索引**（推演见 §4）。

---

## 1. `dayClamp` 实现位重定位（判据 ②）

```
$ rg -n "dayClamp" src
src/renderer/state/__tests__/calendar.test.ts:83:    // 上游若把存档脏值直接喂进来（saveLoad 侧另有 dayClamp 兜底），这里没有任何守卫。
```

- 卷宗写的是 `:82`，**现读 `:83`**——不是上游锚点错，是**同班 c923-10 给本文件净增 1 行**（`+6/-5`）后集体下移，符合「按行号锚的文档会因插行 +1，历史档不回改」的在册口径。
- **实现位结论：仓内不存在 `dayClamp` 这个符号**（`rg -n "dayClamp" src` 仅此 1 行且为注释）。同名文件 `src/renderer/state/__tests__/dayClamp.test.ts` 在盘（1092B，c919-04），但它测的是 **tickDay 到 3600 停走**，内部靠 `inner.state.currentDay = 3600` 直接改私有状态，**没有一个叫 dayClamp 的函数被它 import**。
- 注释里「saveLoad 侧的 dayClamp」两半都对不上号，逐条订正：

| 注释里的说法 | 磁盘实况 | 判定 |
|---|---|---|
| 「saveLoad 侧另有 dayClamp 兜底」 | `saveLoad.ts:22 export const MAX_SAVE_CURRENT_DAY = 3600;` ＋ `:437-446` 范围校验，**越界是 `throw SaveLoadError`（拒载），不是 clamp（不夹回边界）** | 名不副实：兜底确实有，但形态是**拒载**，且**不保证整数** |
| 隐含「tick 侧也有一层」 | `gameStore.ts:943` 注释自述「与 saveLoad MAX_SAVE_CURRENT_DAY 同值；导入会成环故就地声明」，`:944 const MAX_CURRENT_DAY = 3600;`，`:945 this.state.currentDay = Math.min(prevDay + 1, MAX_CURRENT_DAY)` | 真身在此，**只截上界，不截下界、不取整、不查 NaN** |
| 「这里没有任何守卫」（指 calendar） | `calendar.ts:6-13`：仅 `Math.max(0, Math.floor(day))`，NaN 直通（`Math.max(0, NaN) === NaN`） | **成立**，c922-12 的 ⑤ 例已按现状钉桩 |

复核命令（本单实跑，非引用）：

```
$ rg -n "MAX_SAVE_CURRENT_DAY|MAX_CURRENT_DAY" src
src/renderer/state/saveLoad.ts:22:export const MAX_SAVE_CURRENT_DAY = 3600;
src/renderer/state/saveLoad.ts:441:    || rawCurrentDay < 0 || rawCurrentDay > MAX_SAVE_CURRENT_DAY
src/renderer/state/gameStore.ts:944:    const MAX_CURRENT_DAY = 3600;      ← 就地重复声明（成环所致，非疏漏）
src/renderer/state/gameStore.ts:945:    this.state.currentDay = Math.min(prevDay + 1, MAX_CURRENT_DAY);
src/renderer/state/__tests__/saveGuard.test.ts:104（护栏来源注释：3600 = HORIZON_DAYS=720 的 5 倍）
```

---

## 2. 证明矩阵：day 的全部写入口（判据 ①）

`dayToCalendar` 的实参**只有一个来源族**：`state.currentDay`（含 `replaceState` 的入参态）。消费点实测：

```
$ rg -n "dayToCalendar\(" src | grep -v __tests__
src/renderer/scenes/GameScene.ts:192   dayToCalendar(store.getCurrentDay()).season
src/renderer/ui/HUD.ts:727             dayToCalendar(day)            ← day = this.store.getCurrentDay()  (:726)
src/renderer/state/gameStore.ts:942    dayToCalendar(prevDay)         ← tickDay 前值
src/renderer/state/gameStore.ts:946    dayToCalendar(this.state.currentDay)
src/renderer/state/gameStore.ts:1224   dayToCalendar(this.state.currentDay)   ← runSeasonTransitionPhase 侧
src/renderer/state/gameStore.ts:2182   dayToCalendar(this.state.currentDay)
src/renderer/state/gameStore.ts:2216   dayToCalendar(this.state.currentDay)
src/renderer/state/gameStore.ts:2397   dayToCalendar(this.state.currentDay)
src/renderer/state/gameStore.ts:2888   dayToCalendar(newState.currentDay)     ← replaceState 内，赋值之前
```

（`rg -n "currentDay\s*(=|\+=|-=)" src` 的写点全集见下表；`rg -n "currentDay:.*=" -c src` 之外的 `currentDay: number` 命中全是**函数形参/接口字段**，即只读消费，不构成写入口。）

| # | 写入口 file:line | 写入表达式 | 有限 | 非负 | ≤3600 | **整数** | 生产可达 | 证据 |
|---|---|---|---|---|---|---|---|---|
| W1 | `gameStore.ts:332` `makeDefaultState()` | 字面量 `currentDay: 0` | ✅ | ✅ | ✅ | ✅ | ✅ 新开局 | 直接读数；探针 E 第 1 断言 `=0` |
| W2 | `gameStore.ts:412` 构造器 `Object.assign(makeDefaultState(), initialState ?? {})` | 外部整包覆盖，**无任何 currentDay 校验** | ❌ | ❌ | ❌ | ❌ | ⚠️ **仅测试**：`rg -n "new GameStore\(" src \| grep -v __tests__` 生产只 1 处 `src/renderer/main.ts:168`，第 2 参传 `undefined` | 探针 C/D 用这条路灌 100.5 / NaN，都成功进 state |
| W3 | `gameStore.ts:945` `tickDay()` | `Math.min(prevDay + 1, 3600)` | 继承 | 继承 | ✅（上界） | **继承**（无 floor） | ✅ 每tick | `TimeSystem.update` 是唯一定时驱动：`timeSystem.ts:29`，`rg -n "tickDay\(" src` 非测试面仅此 1 + 定义 |
| W4 | `saveLoad.ts:437-462` `deserialize()` | `rawCurrentDay = s.currentDay ?? 0` → 范围校验 → `currentDay: rawCurrentDay` | ✅ | ✅ | ✅ | **❌ 无 `Number.isInteger`/`floor`** | ✅ 读档（磁盘 JSON 唯一入口） | 探针 A/B 读数见 §5；`rg -n "isInteger" src \| grep -i currentDay` 空 |
| W5 | `gameStore.ts:2891` `replaceState()` `this.state = newState` | **30 余个字段逐个兜底，唯独没有 currentDay**；:2888 先把它喂给 `dayToCalendar` | ❌ | ❌ | ❌ | ❌ | ⚠️ 生产只 1 个调用者且入参已校验：`SaveLoadPanel.ts:200` ← `loadFromSlot`（=W4） | `rg -n "replaceState" src \| grep -v __tests__` → 定义 2820 / 注释 386 / 调用 SaveLoadPanel:200 |
| W6 | 事件效果、剧本、UI | — | — | — | — | — | **不存在** | `rg -n "currentDay\s*(\+=\|-=)\|setDay\|advanceDay\|skipDay\|jumpDay" src --glob '!**/__tests__/**'` → **0 命中**；`rg -n "tickDay\(\)\|advanceDays\?(" …` 非测试面只有 timeSystem 那一处。⇒ 没有任何「效果直接改日」的通道 |

**矩阵判定**：W1+W3+W4 构成生产闭环，`有限 & 非负 & ≤3600` **可证**；`整数` **不可证**（W4 缺口 + W3 不取整）。W2/W5 是测试/内存面，本就不承诺净化（W5 连兜底都没有）。

### 2.1 同族 day 字段（不进 calendar，但共用同一污染面）

`deserialize` 内部对「日」的处理**并不一致**，这恰好反证 W4 的整数缺口更像疏漏而非设计：

```
$ rg -n "Day: typeof|Day: Math|Day: s\.|Day: finiteNum" src/renderer/state/saveLoad.ts
455:  pendingEventDayStart: s.pendingEventDayStart ?? null            ← 零校验（连 typeof 都没有）
460:  lastEventDay:         Math.max(0, Math.min(s.lastEventDay, rawCurrentDay))  ← 夹范围、不取整
486:  lastWrathDemandDay:   … && Number.isFinite(…) ? Math.max(0, Math.floor(…))   ← 取整
491:  lastPropagandaDay:    同上 floor
509:  endgameAscendDay:     同上 floor
512:  endgameLastWaveDay:   同上 floor
516:  wrathUltimatumEndDay: 同上 floor
580:  chapterStartDay:      Math.max(0, Math.floor(finiteNum(…, currentDay)))     ← 取整
631:  lastEventDay(NPC/派系): typeof number ? Math.floor(…) : -1                   ← 取整
632:  nextEventDay:         同上 floor
692:  lastEnvoyDay / 693: lastWarDay / 697: lastActionDay: finiteNum(…, -1)        ← 只保有限，不取整、可负（-1 是哨兵）
```

⇒ **本文件里被 floor 的「日」有 8 处，唯一没被 floor 的「主日」正是喂给 calendar 的那一个**（`currentDay`），而 `pendingEventDayStart` 是连数值类型都不查的一个（可被存成字符串，`gameStore.ts:1159` 的 `currentDay - pendingEventDayStart` 随即变 NaN）。

---

## 3. 缺口清单（按可达性排序，全部**未修**）

| id | 缺口 | 可达性 | 后果面（实测/推演） |
|---|---|---|---|
| **G1** | `deserialize` 不保证 `currentDay` 为整数（W4） | **磁盘可直达**：手改存档写 `100.5` 即可，JSON 完全合法 | `dayToCalendar` 用 floor 吞掉小数 ⇒ 日历显示正常；但 ① `tickDay` 之后**永远是 .5**（探针 C `after2ticks=102.5 int=false`），② `d % 30 === 0` 型「每 30 天」判定（`gameStore.ts:1999`）**永不成立**（探针 `mod30=12.5`），③ `dayOfYear: this.state.currentDay % 120`（`gameStore.ts:1245`）把小数送进 DSL 的 `day_of_year`。**属经济/节奏面，本单不动数值也不补码** |
| **G2** | `replaceState` 对 `currentDay` 零兜底（W5），且在 :2888 **先算日历再赋值** | 生产不可达（唯一调用者入参已校验）；测试面可达 | 实测：喂 NaN 不报 `SaveLoadError`，而是**崩在 `seasonSystem.ts:68` `def.name`**（`SEASON_EFFECTS[NaN]` → undefined）——错误面不可归因（探针 D 原文见 §5）。⇒ 「无守卫」不是"静默损坏"，是"在第三个文件里炸" |
| **G3** | `pendingEventDayStart` 零类型/数值校验（`saveLoad.ts:455`） | 磁盘可直达（`"abc"` 也能过） | `gameStore.ts:1159` 的 `currentDay - pendingEventDayStart` → NaN ⇒ 事件超时判定 `elapsed > N` 恒假，弹窗**永不超时关闭**。**属行为面，只登记** |
| **G4** | 同一文件内 8 处 floor、主日不 floor（§2.1） | 口径不一致本身 | 不是独立缺陷，是 G1 的「上游知道该怎么做但漏了一处」证据；修 G1 时按 :486 那行同型写即可 |

---

## 4. 回 c922-12 的出口问题：`dayToCalendar` 里那层 clamp 能不能删

按矩阵逐分支回答（这里只出结论，**不改码**）：

- `Math.max(0, …)`：**生产链上负值确实不可达**（W1 是 0、W3 单调不减、W4 直接拒负）。但可达性依赖「W2/W5 只被测试用」这一事实，而 W5 恰恰**没有兜底**，`replaceState` 的注释（`gameStore.ts:2821-2823`）自己写着「也可能从内存里灌进 quick-save / 测试场景」。⇒ 删掉下界后，任何一次 `replaceState(负 day)` 会从「钳到开局日」变成「`dayInYear` 为负 ⇒ `season` 为负 ⇒ `SEASON_EFFECTS[-1]` → undefined ⇒ 崩在 `seasonSystem.ts:68`」。**收益是少一个 `Math.max`，代价是把钳制换成崩溃**，不建议。
- `Math.floor(…)`：**生产可达地有用**（G1 的小数档正是它在工作）。删它等于把 `100.5` 直接送进 `% 120`、`/ 30`、`as 0|1|2|3` 断言，且 `season` 会变成 `3.5` 这种**索引 3.5 的 undefined 渲染**（c922-12 原本担心的形态）。
- **前置证明的正确形式**：c922-12 说的「先证 dayClamp 侧恒为有限非负整数」——**要先把『整数』补上（G1 一行 `Math.floor` 或 `Number.isInteger` 拒绝），才谈得上删 `floor`；『有限非负』则已被 W4 的 `throw` 证成，删 `Math.max(0,` 的充要条件是同时给 `replaceState` 补一道 currentDay 校验**。两笔都不属本单范围。

⇒ **本单建议交主班裁定的最小可执行集**（若要做，是新单，不是本单）：`saveLoad.ts:437-446` 的谓词加 `!Number.isInteger(rawCurrentDay)`（1 行，拒载面与既有错误面同型）＋ `replaceState` 补 currentDay 兜底（1 行）。二者都会**改变现有存档的可载入集合**（小数档从「能载」翻「不能载」），属行为改动，故不在普查单里做。

---

## 5. 探针与复跑（只读，产物在 `tmp/`，不入版本库）

```
$ npx vitest run --config tmp/c923-11/vitest.probe.config.ts
DESERIALIZE ::NaN→THROW(currentDay out of range) Infinity→THROW -0→OK(0) -1→THROW -0.5→THROW '42'→THROW
  null→OK(0) true→THROW {}→THROW 3600→OK(3600) 3600.5→THROW 1e9→THROW
  100.5→OK(100.5)  0.0001→OK(0.0001)  3599.999→OK(3599.999)      ← 只有小数这族被接受
TICK-FRACTION ::after2ticks=102.5 int=false mod30=12.5
REPLACE-NAN   ::THROW TypeError: Cannot read properties of undefined (reading 'name')
                 @ makeSeasonModifier (src/renderer/state/seasonSystem.ts:68:15)
 Test Files  1 passed (1)   ·   5 probe cases   ·   rc=0
```

- 探针用 `serialize(正常态) → JSON.parse(JSON.stringify(…)) → 只改 currentDay`，即**每一行都是「磁盘上真能存在的档」**，不是给 `deserialize` 硬喂 JS 独有值（`NaN/Infinity` 在 JSON 里根本没有字面量，实测 `JSON.parse('{"d":NaN}')` 抛）。这也是 §0-2「唯一磁盘可达缺口是 G1」的依据。
- 探针文件与配置在 `tmp/c923-11/`（`dayProbe.probe.test.ts` / `vitest.probe.config.ts` / `probe.log`）。**故意不放进 `src/**/__tests__`**：根 `vitest.config.ts:6` 的 include 是 `src/**/__tests__/**/*.test.ts` ＋ `scripts/__tests__/**`，放 src 会立刻被并发子班的全量口径吃进去，放 tmp 则要显式 `--config` 才跑——既留了可复算件，也不污染别人读数。他班要清 `tmp/` 可直接删。

---

## 6. 未证面 / 边界

1. **未跑全量**：多路并发口径。本单只跑了自己的探针（1 文件 5 例）与读码，未对 1395 例套件取数。
2. **W3 只证了「不产生新的非整数」，没证「tick 序列不可能被外部拉长」**：`TimeSystem.update(realDeltaMs)` 的 `realDeltaMs` 来自 Phaser 帧回调（`MAX_TICKS_PER_UPDATE = 400` 封顶），只影响**推进多少天**、不改**日的整数性**，故未展开。
3. **`main` 进程的 `save-meta` 面未纳入矩阵**（不进 calendar，且只读展示）：`src/main/index.ts:201-206` 只 `typeof data.state.currentDay === 'number'`，**无范围/整数校验**，故「存档列表显示 day」可以把 `100.5` 或 `1e9` 原样显示——但它不构成写入口。列此免他班再找。
4. **存档写入侧（serialize）未审**：本命题只关心「进 calendar 的 day」，写侧对称性（day 是否可能以非整数落盘）与 G1 同因，未另开。
5. **矩阵的行号会漂**：本文件所有 `file:line` 是 **HEAD `74cbfa6` ＋ c923-10 未提交三件** 的盘态读数。c923-10 已让 `calendar.test.ts` 净 +1 行（注释锚 `:82→:83`）；后续任何在 `gameStore.ts`（2900+ 行）中段的插入都会让 W3/W5 的锚点集体下移。

---

## 7. 一句话给主班的处置建议（不在本单执行）

- 若要消掉在册注释债：把 `calendar.test.ts:83` 那句改成「（saveLoad 侧 `MAX_SAVE_CURRENT_DAY` 只保证有限非负且**不保证整数**；tick 侧 `Math.min` 只截上界）」——1 行注释，可与后续任何 calendar 单并笔。
- 若要真收口净化链：见 §4 的两行最小集，**但它改变存档可载入集合**，属行为改动 ⇒ 建议进待人工台账，勿由执行手自取。
- G3（`pendingEventDayStart` 零校验）与本命题正交但同源，建议单列一条死档拒载面的单。
