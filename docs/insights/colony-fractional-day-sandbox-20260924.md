# colony saveLoad 小数 `currentDay` 兜底沙盒对照（G1/G4 · 改前 vs 改后 20 格全填，生产码不落）

> **班次**：`qoder-executor-20260924-0955-colony17`（zcode-bridge 执行班 · **只读位**）· 取数时刻 2026-09-24T12:20+08:00
> **被测 HEAD**：`c48413a`
> **红线声明**：本案在**存档 ＋ 经济/节奏数值域**（`currentDay` 喂 `% 30` 门控与 `% 120` DSL 输入）。
> 按纪律档 §五.3 与上游 c923-11 的裁决，**行为改动只出设计稿、生产码不落**。本班全程只在
> `tmp/c924-08/after_renderer/`（**生产码的整份副本**）上打补丁跑对照，`src/**` 一字未改。
> **本文件是本单唯一入库产物。**
> **上游**：`docs/insights/colony-day-sanitize-census-20260923.md`（c923-11，G1/G4 在此登记未修）。

---

## 〇、结论先行（四条，都是量出来的不是推的）

1. **"最小修法两行"里真正改变可载入集合的只有第一行，且它删掉的是恰好一个等价类**：
   `[0, 3600] ∩ ℝ ∖ ℤ`（区间内的非整数）。沙盒对照 **20 格里只有 6 格行为翻转**（3 个小数值 × 磁盘/内存两面）。
   **其它一切脏形态改前改后一字不变**：NaN / Infinity 改前就已被 `!Number.isFinite` 拒（:440），
   越界整数改前就已被 `> MAX_SAVE_CURRENT_DAY` 拒，字符串改前就已被 `typeof !== 'number'` 拒。
   ⇒ **不存在"新接受任何档"**，这排除了"修一个洞开出另一个洞"的担忧。

2. 🔴 **第一行的错误文案会失真**（本班实测，卷宗与上游都未提）：把 `!Number.isInteger` 塞进现有 `if` 后，
   载入 `1.5` 抛的是 **`currentDay out of range: 1.5 (allowed 0..3600)`** —— **1.5 明明白白在 0..3600 之内**。
   这不是装饰问题：该 message 是 `SaveLoadError` 唯一对外面（`getSaveMeta` / toast 都走它），
   会把"存档是小数"误报成"存档越界"，人工排查方向直接被带偏。
   ⇒ **开工时必须拆成独立分支、独立文案**，别复用这一条 `throw`。
   同一条 `throw` 还有个既有歧义：字符串 `'100'` 的报错是 `out of range: 100`（`String()` 后与数字 100 无法区分），
   而数字 100 是**合法**的 ⇒ 现有文案在**类型面**也已经不可诊断，本单顺手记录。

3. **第二行（`replaceState` 兜底）不是冗余，但它的价值面与第一行不重叠**：
   UI 读档链是 `SaveLoadPanel:195 loadFromSlot` → `saveLoad.ts:820 deserialize` → `:200 replaceState`，
   ⇒ 第一行已在上游拦下，第二行对**读档路径**只是 defense-in-depth。
   但 `replaceState` 另有**内存面入口**（其自身注释 `:2821-2822`："也可能从内存里灌进 quick-save / 测试场景"），
   实测该面上 **5 格里 4 格行为变化**：`NaN`/`undefined` 改前是**崩在第三个文件的裸 `TypeError`**
   （`Cannot read properties of undefined (reading 'name')`，即上游 c923-11 定位的 `seasonSystem.ts:68 def.name`），
   改后是**边界处一条明确 `Error`**；`1.5`/`-3` 改前**静默存活**（`1.5 → tick → 2.5`、`-3 → tick → -2`），
   改后拒。⇒ **第一行管"磁盘能不能进"，第二行管"内存进来后崩得难不难看"**，两行各自独立成立。

4. 🔴 **改完之后没有任何测试看守它**（本班实测）：定向件口径下 **改前/改后 18 文件 298 例逐位相同、全绿**，
   且全 `src` 里**找不到一个小数 day 字面量**（grep 0 命中）。
   ⇒ 这既是好消息（**零回归面**，人工批准的成本比想象低），也是坏消息
   （**这行守卫落地后是裸奔的**，谁都能顺手删回去且全绿）。
   ⇒ 本班建议：**放行时必须同批补一条正向断言**（`expect(() => deserialize({... currentDay: 100.5})).toThrow(SaveLoadError)`），
   否则本次修复本身会重演 c922/c923 那一轮"修了没人看"的路径。

---

## 一、锚点复核（卷宗前提逐条，含一处精度否证）

```
$ sed -n '438,442p' src/renderer/state/saveLoad.ts
438    const rawCurrentDay = s.currentDay ?? 0;
439    if (
440      typeof rawCurrentDay !== 'number' || !Number.isFinite(rawCurrentDay)   ← 卷宗锚点，零漂移
441      || rawCurrentDay < 0 || rawCurrentDay > MAX_SAVE_CURRENT_DAY
442    ) {
443      throw new SaveLoadError(`currentDay out of range: ${String(s.currentDay)} (allowed 0..${MAX_SAVE_CURRENT_DAY})`);
```
`MAX_SAVE_CURRENT_DAY = 3600`（`saveLoad.ts:22`）；`:462 currentDay: rawCurrentDay` **不 floor、不查整数**。

**G4 的"同文件 8 处 floor"精度否证**：上游 c923-11 记的是"另有 8 处 `*Day` 字段是 floor 过的"。本班现测：

```
$ grep -o "Math\.floor" src/renderer/state/saveLoad.ts | wc -l          → 24   （全文件 Math.floor 出现次数）
$ grep -cE "Math\.floor" src/renderer/state/saveLoad.ts                 → 23   （所在行数）
$ grep -oE "Math\.floor\([^)]*[Dd]ay[^)]*\)" … | wc -l                  → 13   （作用在 *Day* 字段上的）
$ grep -n "Number.isInteger" src/renderer/state/saveLoad.ts             → :226 :229 :289 :292 :731
       （worldMap 宽高 2 处 ＋ 像素坐标 3 处，**无一处涉 day** —— 这条与上游一致）
```
⇒ **G4 的真实形状是"同文件 13 处 day 级 floor，主日 `currentDay` 独占豁免"**，比上游的"8 处"更严重也更精确。
最尖锐的一条：**同一个 `currentDay` 值，流进 `storyFlags.chapterStartDay` 时被 floor（`:580`），
留在主字段时不 floor（`:462`）** ⇒ 一个存档里会同时存在 `currentDay = 100.5` 与 `chapterStartDay = 100`，
两个"今天"不同源。这一条**上游没写**，是本次对照的增量。

---

## 二、沙盒方法（两版并列跑，生产码零改动）

| 版本 | 来源 | 补丁 |
|---|---|---|
| **改前** | 直接 `import * as B from '../../src/renderer/state/saveLoad'` | 无（生产码原样） |
| **改后** | `import * as A from './after_renderer/state/saveLoad'`，`after_renderer` ＝ `cp -r src/renderer tmp/c924-08/after_renderer` | 第一行：`if` 内加 `\|\| !Number.isInteger(rawCurrentDay)`；第二行：`replaceState` 开头加整数/区间守卫（上界**就地声明** `const MAX_DAY = 3600`，因 `gameStore` 导入 `saveLoad` 会成环，见 `:943` 同型先例） |

构造存档的两条面（这是本案最容易做错的地方）：
- **磁盘面**：`JSON.parse(JSON.stringify(serialize(state)))` —— 真·落盘字节回读。**NaN/Infinity 在这一面会被
  `JSON.stringify` 打成 `null`**，所以"NaN 脏存档"在磁盘面**不可达**（复现上游 c923-11 否证 2）。
- **内存面**：`{ schemaVersion, mode:'sandbox', state: {...} }` 不经 JSON —— NaN/Infinity 只有这一面能进。
  ⚠️ 外层键是 `state` 不是 `data`（本班首版探针误写成 `data`，整列报 `Save data missing state field`，
  幸而被"改前＝改后"的**同异列**当场暴露）。

---

## 三、对照表 A：`deserialize` 面（11 值 × 磁盘/内存 × 改前后，20 格全填）

「可载入」列 ＝ 是否成功返回 state；「★」＝ 改前改后**行为不同**。

| 值 | 面 | **改前** | **改后** | 异 | 改前 `calendar(day)` | 改前 `% 30` | 改前 `tick→` |
|---|---|---|---|---|---|---|---|
| `1.5` | DISK | **OK(1.5)** | **SaveLoadError** `out of range: 1.5` | ★ | `{y0,s0,days:1}` | `1.5` 非整数 | `2.5` 仍非整数 |
| `1.5` | MEM | **OK(1.5)** | **SaveLoadError** | ★ | 同上 | 同上 | 同上 |
| `0.0001` | DISK | **OK(0.0001)** | **SaveLoadError** | ★ | `{y0,s0,days:0}` | `0.0001` 非整数 | `1.0001` 仍非整数 |
| `0.0001` | MEM | **OK(0.0001)** | **SaveLoadError** | ★ | 同上 | 同上 | 同上 |
| `3599.999` | DISK | **OK(3599.999)** | **SaveLoadError** | ★ | `{y29,s3,days:29}` | `29.998999999999796` 非整数 | `3600` **变整数**（见 §五.3） |
| `3599.999` | MEM | **OK(3599.999)** | **SaveLoadError** | ★ | 同上 | 同上 | 同上 |
| `NaN` | MEM | SaveLoadError `out of range: NaN` | SaveLoadError（同） | 同 | — | — | — |
| `Infinity` | MEM | SaveLoadError `out of range: Infinity` | SaveLoadError（同） | 同 | — | — | — |
| `1e9` | DISK | SaveLoadError `out of range: 1000000000` | SaveLoadError（同） | 同 | — | — | — |
| `1e9` | MEM | SaveLoadError（同） | SaveLoadError（同） | 同 | — | — | — |
| `-0.5` | DISK | SaveLoadError `out of range: -0.5` | SaveLoadError（同） | 同 | — | — | — |
| `-0.5` | MEM | SaveLoadError（同） | SaveLoadError（同） | 同 | — | — | — |
| `3600` | DISK | OK(3600) | OK(3600) | 同 | `{y30,s0,days:0}` | `0` 整数 | `3600` 停走 |
| `3600` | MEM | OK(3600) | OK(3600) | 同 | 同上 | 同上 | 同上 |
| `42` **（对照）** | DISK | OK(42) | OK(42) | 同 | `{y0,s1,days:12}` | `12` 整数 | `43` |
| `42` **（对照）** | MEM | OK(42) | OK(42) | 同 | 同上 | 同上 | 同上 |
| `'100'` | DISK | SaveLoadError `out of range: 100` | SaveLoadError（同） | 同 | — | — | — |
| `'100'` | MEM | SaveLoadError（同） | SaveLoadError（同） | 同 | — | — | — |
| `null` | DISK | **OK(0)**（`?? 0` 回落） | OK(0) | 同 | `{y0,s0,days:0}` | `0` 整数 | `1` |
| `null` | MEM | OK(0) | OK(0) | 同 | 同上 | 同上 | 同上 |

**逐格读数出处**：`tmp/c924-08/probe.log`（复跑命令见 §七）。统计：**20 格 / 6 格 ★不同**，
`★不同` **全部**落在"区间内非整数"这一类，无一例外；**合法整数（42 / 3600）与所有改前被拒形态 14 格逐位不变**。

---

## 四、对照表 B：`replaceState` 内存面（第二行的独立价值）

| 值 | **改前（生产码）** | **改后（沙盒）** | 异 |
|---|---|---|---|
| `NaN` | 🔴 **THROW `TypeError` :: Cannot read properties of undefined (reading 'name')** —— 崩在**第三个文件**（`seasonSystem.ts:68` 的 `def.name`），栈里看不到 `currentDay` 半个字 | THROW `Error` :: `[GameStore.replaceState] currentDay must be an integer in range` | ★ |
| `undefined` | 同 NaN（裸 `TypeError('name')`） | 同上一条明确 `Error` | ★ |
| `1.5` | **静默存活**：`tickDay` 后 `currentDay=2.5`，`calendar={y0,s0,days:2}` | THROW 明确 `Error` | ★ |
| `-3` | **静默存活**：`tickDay` 后 `currentDay=-2`，`calendar={y0,s0,days:0}`（`Math.max(0,…)` 把负数吞成 0，**内部日与显示日分家**） | THROW 明确 `Error` | ★ |
| `42` **（对照）** | 存活 `currentDay=43`，`calendar={y0,s1,days:13}` | **完全相同** | 同 |

⇒ **5 格 4 ★**，且对照格逐位相同 ⇒ 该面确实有独立于第一行的行为改动，**第二行不冗余**。

### 四.1 本表附一条取证自纠（值得下传）

上表**前两版都作废**过：本班最初用"手搓全量 state"喂 `replaceState`，结果**连合法对照值 `42` 都抛**
（`TypeError … reading 'reduce'`，再改一版又 `reading 'emit'`＝漏传 `GameStore` 构造器的 emitter 形参）。
⇒ 那两版读数**全部弃用**（第一版一度把 5 格都记成"★不同"，是彻底的假象）。
正解＝**以真 store 自己的态为底、只覆盖 `currentDay`**（`{ ...s.getState(), currentDay: day }`，
与在册 `gameStore.test.ts:278` 同法），对照格转正后本表才算数。
🔴 **通用口径**：任何"改前/改后对照"探针，**必须带一个已知合法的对照格，且它必须落在"同"**；
对照格自己就不同时，整张表都是探针故障而非被测件行为。

---

## 五、由对照表得到的四条判据级结论

1. **可载入集合的收缩是"单类、无伴生"** —— 见 §三统计。这条直接回答 c923-11 留的"改变存档可载入集合"到底有多大盘子。
2. **老玩家的实际暴露面**：只有"曾经把小数 day 存进盘"的档会**从可载入变成不可载入**。
   本班**未查**线上/本机存档是否真存在此类档（需扫 `public/` 或用户槽位，属越界且超预算）。
   ⇒ 这是**放行前人工必须答的第三问**（§六）。若答"可能存在"，则修法要改成**兼容式订正**
   （`currentDay = Math.floor(raw)` 而非拒载）——那是**另一种行为改动**（静默改玩家进度），
   两案利弊见 §六.2，本班不选。
3. **一个反直觉的上界巧合**（实测，不是推）：`3599.999` 载入后 `tickDay` → `Math.min(3599.999+1, 3600) = 3600`
   **恰好落回整数** ⇒ 现有 `:943-945` 的上界 clamp 会在**极个别**情形下"顺带治好"小数性。
   含义：**G1 的表现有一部分被上界 clamp 间歇性掩盖**，只在 `day < 3599` 时永久存活 ⇒ 观察到的症状是
   "绝大多数档小数永不自愈，接近终局的档会自己好"。做缺陷归因时别被这个尾部假象骗了。
4. **`% 30` 门控实测永不成立**：`1.5 % 30 = 1.5`、`0.0001 % 30 = 0.0001`、`3599.999 % 30 = 29.998999999999796`
   ⇒ 复现上游实测（本班独立填格）。**受损面比上游记的大**：现测全 `gameStore.ts` 有**两处** `% 30 === 0` 门，
   上游只点了第一处 ——

   ```
   $ grep -n "% 30" src/renderer/state/gameStore.ts
   1999:    if (this.state.currentDay > 0 && this.state.currentDay % 30 === 0 && this.state.generals.length > 0) {
   2715:    if (this.state.vassalOf !== null && this.state.currentDay > 0 && this.state.currentDay % 30 === 0) {
   ```
   ⇒ 小数 day 会**同时**掐断这两条 30 日节律（第一处涉 `generals`、第二处涉 `vassalOf` 附庸进贡）。
   同时 `dayOfSeason` 却显示成整数（`calendar.ts:6-13` 内 `Math.max(0, Math.floor(day))`）
   ⇒ **玩家看得见日历在走，看不见任何 30 日节律在触发**，且 UI 没有任何一处会提示"少了两族事件"。

---

## 六、交人工裁决清单（本案不拍板）

1. **是否放行第一行**（区间内非整数改为拒载）。技术面本班已铺平：零回归（298/298）、零新增接受面。
   剩余是**产品面**问题："小数 day 的档要不要给救"。
2. **若要救，走哪案**（两案都是行为改动，都需授权）：
   - 案 甲（拒载，＝本沙盒的改后版）：错误面清晰，**代价是旧档打不开**。
   - 案 乙（`Math.floor` 订正后放行）：旧档能开，**代价是静默改玩家进度**（100.5 天 → 100 天），
     且要与 §五.3 的上界 clamp 行为对齐，避免"某些档 floor 前后不同"。
     ⚠️ 案 乙还会与 `:580 chapterStartDay` 的既有 floor 产生**双订正**，需一并核。
3. **线上是否真存在此类档**（§五.2）——决定 1/2 的紧迫度。本班未查。
4. **错误文案是否同批改**（〇.2）：若放行第一行，务必拆独立分支＋独立 message，
   并顺手处理 `'100'` 与 `100` 在 message 里不可区分的老问题。
5. **同批补正向断言**（〇.4）：`src/renderer/state/__tests__/saveLoad.test.ts` 现**零**条覆盖小数 day；
   放行那笔必须带上，否则守卫裸奔。
6. **G4 精度已修正为 13 处**（§一），另附"主日与其派生字段 floor 不同源"的新面 ⇒ 台账里那句"8 处 floor"建议更正。

---

## 七、探针与复算（完成标准③：可复跑、不入库）

探针件全在 gitignored 的 `tmp/c924-08/`（`git check-ignore -v` → `.gitignore:25:tmp/`）：
`dayFrac.probe.test.ts`、`replaceState.probe.test.ts`、`vitest.probe.config.ts`、`vitest.after.config.ts`、
`after_renderer/**`（生产码副本＋两行补丁）、`probe.log`、`probe2.log`。

```
# 对照表 A（§三）
$ npx vitest run --config tmp/c924-08/vitest.probe.config.ts tmp/c924-08/dayFrac.probe.test.ts
# 对照表 B（§四）
$ npx vitest run --config tmp/c924-08/vitest.probe.config.ts tmp/c924-08/replaceState.probe.test.ts
# 改前定向套件
$ npx vitest run src/renderer/state/__tests__/{saveLoad,saveGuard,saveGuard2,saveGuard3,dayClamp,saveIoSemantics,gameStore,calendar,migrationGapMessage,saveV9Fixture,saveLoadIo,tickPerf,influence,publicWrath,ultimatum,wariness,relicSystem,endgameEscalation}.test.ts
  → Test Files 18 passed (18) / Tests 298 passed (298)
# 改后定向套件（跑的是 tmp 副本，src 不动）
$ npx vitest run --config tmp/c924-08/vitest.after.config.ts tmp/c924-08/after_renderer/state/__tests__/<同名 18 件>
  → Test Files 18 passed (18) / Tests 298 passed (298)
```

⚠️ **复跑注意**：`vitest.after.config.ts` 的 include 若不限定到那 18 件、让它吃满 `after_renderer/**`，
会得到 **37 failed / 100 passed** 的**假红**——红因是"测试件被搬进 tmp 后按 `__dirname` 解析仓库路径失效"
（实测 `ENOENT scandir 'D:\code\colony-game\tmp\public\audio'`），**与补丁无关**。
本班首跑就撞上了，按 18 件定向后归零。⇒ **搬副本跑测试，必须先跑"未打补丁的副本"确认基线，再跑打补丁版**。

---

## 八、盘态（完成标准②：生产码 `git diff = 0`）

```
$ git status --porcelain
 M docs/design/OPTIMIZATION_BACKLOG.md                     ← 他班在册（禁碰，未动）
 M docs/insights/colony-dead-exports-20260914.json          ← 他班在册（禁碰，未动）
 D docs/insights/colony-dead-exports-20260914.json.bak      ← 他班在册（在册实况，未"顺手恢复"）
 M src/renderer/state/__tests__/saveLoad.test.ts            ← 本班 c924-05（另一单），非本单
?? docs/insights/colony-modifier-consumption-design-20260924.md  ← 本班 c924-06，非本单
?? docs/insights/colony-fractional-day-sandbox-20260924.md        ← 本单唯一产物
```

**本单对生产码的改动 ＝ 0**：

```
$ git diff --numstat -- src/renderer/state/saveLoad.ts src/renderer/state/gameStore.ts src/renderer/state/calendar.ts
（空输出 ⇒ 三件被测生产码逐字未动）
$ git diff --numstat | grep -vE "saveLoad.test.ts|OPTIMIZATION_BACKLOG.md|colony-dead-exports-20260914.json(.bak)?"
（空输出）
```
⚠️ 卷宗完成标准②的字面式 `git diff = 0` 在本波**结构上不可达**（树里有 3 项他班在册 ＋ 本班另两单未代提交），
按纪律档 §五.2 以"排除法读数为空"收窄并留痕，与 c924-06 同型。
