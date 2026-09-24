# colony 存档面「migrations[N] 注入 × deserialize 兜底」双写同字段结构设计稿（首例 wrathUltimatumEndDay）

- 单号：c924-20（只读设计稿）· 班次 `qoder-executor-20260924-0955-colony21` · 2026-09-24
- 仓与现值：`D:\code\colony-game` @ HEAD `eaaa3817`（c924-18）· `SAVE_SCHEMA_VERSION = 9`（`saveLoad.ts` 唯一文本锚 `export const SAVE_SCHEMA_VERSION = 9;`）
- 🔴 **本稿不改任何生产码、不改任何存档、不动任何数值**（`git diff --stat` 除本新档外为 0）。**选案交人工**，理由见 §5。
- 探针与复算件全在 gitignored `D:\code\colony-game\tmp\c924-20\`（`git check-ignore -v` → `.gitignore:25:tmp/`）。

## 0. 结论速览

1. **双写不是个例，是全量重叠**：`migrations` 8 步一共注入 **15 个 state 字段**，这 15 个**每一个**都同时被 `deserialize` 的 gameState 字面量再写一遍（含类型收窄/clamp）。双写率 **15/15 = 100%**，"只迁移不兜底"= **0** 个。正则轨与 AST 轨各自独立数出 15、交集 15、差 0（§1）。
2. **今天这两路对真实老档产出逐位相同的状态**（八档全测，§2.1）⇒ 迁移注入面在断言里**完全不可见**。⚠ **实测**：把 `migrations[8]` 的注入行 `s['wrathUltimatumEndDay'] = null;` **整行删掉**，6 个存档族测试文件（`saveMatrix`／`saveV9Fixture`／`saveIoSemantics`／`saveGuard3`／`ultimatum`／`saveLoad`）**仍然全绿 rc=0** ⇒ c923-22 那句"断言无判别力"从推断升级为**读数**（§2.2）。
3. **两案的真实差异只有一个可达入口**：同一个键**在低版本档里已经带值**（谎标版本／手改档／"先加字段后补 bump"的构建）。此时**迁移赢**（无条件覆盖），兜底会**保留原值**。本仓历史 15 个字段全部与各自 bump **同 commit 引入**（§2.3 考古）⇒ 该入口对既有真实档**不可达**，但它是未来 bump 的陷阱。
4. **案 A（迁移优先）治不全**：另有 **34 个字段只兜底不迁移**（其中含真档必然缺键的 `playerMorale`/`grade`/`storyFlags`/`generals`/`dualZeroDays`… ），删兜底 ⇒ 直接 `undefined`、`GameState` 类型说谎 ⇒ 存档兼容面**必然改判**（§3）。
5. **建议交人工选"案 B＋判别性断言"或"案 C 共表"，不建议案 A**；本稿按卷宗要求把两案的红绿与改判面都列全（§3、§4），**不代主班裁决**。

## 1. 双写字段清单（完成标准①：rg 实测，附命中行；行号为 @HEAD `eaaa3817` 现值，锚文本在括号内）

普查对象 = `src/renderer/state/saveLoad.ts` 一个文件内的两处写点：`const migrations: Partial<Record<number, MigrationFn>> = {`（:125 起）与 `deserialize()` 里 `const gameState: GameState = {`（:447 起）。

**双轨取数（纪律档 §九.3／§十.3 要求，两轨独立且互不遮蔽）**

```
$ # 轨 1 正则：迁移注入行（含键名捕获）
$ grep -cE "^    s\['[A-Za-z]+'\] = " src/renderer/state/saveLoad.ts            → 15
$ grep -oE "^    s\['[A-Za-z]+'\]" src/renderer/state/saveLoad.ts | … | sort -u  → 15 个去重字段
$ # 轨 2 AST（TypeScript Compiler API，tmp/c924-20/census.mts）：
$ #   定位 migrations 变量初值 → 逐 step 取 ArrowFunction 的 Block.statements → 收集 ElementAccess 赋值左侧字符串字面量
$ node --experimental-transform-types --experimental-loader ./tmp/c924-20/loader.mjs tmp/c924-20/census.mts
    → AST census ok: dual=15 fbOnly=34
$ python -c "…集合比对两轨…"  → AST=15 正则=15 交集=15 仅AST=[] 仅正则=[]（差额 0，无需人工归因）
```

**双写矩阵（15 字段，全部两路都写）**

| 字段 | migrations 注入（行） | deserialize 兜底（行） | 兜底写法（是否含 clamp/深校验） |
|---|---|---|---|
| populationClasses | :130 `s['populationClasses'] = createDefaultPopulation(people)` | :540 | `deserializePopulationClasses(…)` ⇒ **缺键时转调同一个 `createDefaultPopulation`**（:590）＝同源，非巧合 |
| conversionQueue | :131 | :541 | `deserializeConversionQueue` |
| grainNegativeDays | :132 | :542 | `Math.max(0, Math.floor(finiteNum(…, 0)))` |
| factionState | :139 | :543 | `deserializeFactionState` |
| megaProjects | :140 | :544 | `deserializeMegaProjects` |
| exclusivePolicies | :141 | :545 | `Array.isArray ? filter(typeof string) : []` |
| publicWrath | :149 | :485 | `clampSentiment(typeof number ? v : 0)` |
| lastWrathDemandDay | :150 | :486 | `isFinite → Math.max(0,floor)` : 否则 `null` |
| worldWariness | :158 | :489 | `clampWariness(typeof number ? v : WARINESS_BASELINE)` |
| lastWarinessReason | :159 | :490 | `typeof string ? v : null` |
| lastPropagandaDay | :167 | :491 | `isFinite → floor` : 否则 `null` |
| relicSites | :175 | :494 | `Array.isArray ? 逐条深校验 : []` |
| endgameAscendDay | :183 | :509 | `isFinite → floor` : 否则 `null` |
| endgameLastWaveDay | :184 | :512 | 同上 |
| **wrathUltimatumEndDay（首例）** | **:192** `s['wrathUltimatumEndDay'] = null;` | **:516** `typeof … === 'number' && Number.isFinite ? Math.max(0, Math.floor(…)) : null` | 卷宗点名的首例，形态与本族其余 14 个**完全同构** |

- **只迁移不兜底：0 个。** ⇒ 不存在"删了兜底就没人写"的字段，双写面是**纯冗余**（不是两条互补路径）。
- 另有 **34 个字段只兜底不迁移**（`tmp/c924-20/census-ast.txt` 全列表；其中 `paused`／`lastTickTimestamp` 是 deserialize 侧的运行时初值、不在 `serialize` 的 state 面 ⇒ 真·存档字段 **32 个**）。⇒ `serialize()` 写 51 键、`deserialize` 读 49 键，两边键集**本就不动等**。
- 首例字段的完整生命周期四处（与 c923-22 result:84 一致，复核无漂移）：`gameStore.ts` 类型 `wrathUltimatumEndDay: number | null;`／初值 `:  null`、`saveLoad.ts` 的 `SerializedSave` 可选声明 `?: number | null`、migrations 注入、serialize 出、deserialize 读。

## 2. 为什么"看不见"：生效顺序与等价性实测

### 2.1 八档等价矩阵（案 B 的行为前提）
`deserialize` 只在 `schemaVersion < SAVE_SCHEMA_VERSION` 时跑链，且链跑完后**所有字段仍要过一遍 gameState 字面量**。把夹具 `src/renderer/state/__tests__/__fixtures__/save-v9.json`（真 serialize 产物）逐档降版本、**删掉全部 15 个双写键**，再对比"跑迁移链" vs "只手工 bump 到 9（＝等效于删掉注入行）"的 15 字段读数：

```
$ node --experimental-transform-types --experimental-loader ./tmp/c924-20/loader.mjs tmp/c924-20/probe.mts
[D] 逐档等价矩阵
  v1 → 等价=true   v2 → true   v3 → true   v4 → true   v5 → true   v6 → true   v7 → true   v8 → true
```
⇒ **键缺失时两路同值**（不是巧合：注入值与兜底缺省值取自同一批常量/工厂）。⇒ 案 B 对"真·老档形状"**零改判**。

真档侧复证（仓内唯一一份"真·v8 磁盘字节"，`saveIoSemantics.test.ts` 的 `V8_ON_DISK_FIXTURE`）：
```
F1 真·v8 磁盘档：state 顶层键数=49  含 15 双写字段中的 14 个（缺：wrathUltimatumEndDay）
    跑迁移 vs 只 bump：15 字段逐位相同=true
    注入前后 wrathUltimatumEndDay：undefined → null
```
⇒ 真实 v8 档里**其余 14 个双写键是带着值进 deserialize 的**（它们各自的迁移步对 v8 档根本不会跑），这 14 个键的实际事实源**已经是兜底**，迁移只是历史噪音。

### 2.2 判别力归零的直接实跑（不是推断）
```
$ # tmp/c924-20/ 内先备份，再整行删掉 migrations[8] 的 s['wrathUltimatumEndDay'] = null;
$ npx vitest run --reporter=basic src/renderer/state/__tests__/{saveMatrix,saveV9Fixture,saveIoSemantics,saveGuard3,ultimatum,saveLoad}.test.ts > tmp/c924-20/caseB-run.log 2>&1; echo rc=$?
rc=0     Test Files 6 passed / Tests 全绿（tmp/c924-20/caseB-parsed.txt）
$ # 当场按字节还原：sha256_12 删前=删后=1465cd7aa6ef，git diff -- src/renderer/state/saveLoad.ts 输出为空
```
⇒ **今天没有任何一条用例能证明 `migrations[8]` 存在**。`saveMatrix.test.ts` 的『v8 老档迁移后 wrathUltimatumEndDay 注入 null（8→9）』与 `saveIoSemantics.test.ts:128` 的『8→9 新增字段按缺省注入 null』断的是**结果值**，而结果值两路同源 ⇒ 这就是 c923-22 撞到的那面墙（"兜底也是 null ⇒ 断言恒绿"）。

### 2.3 两路的唯一分叉面（＝改判面）
```
[C]/[F2] 同键带值 999：走 v8 链 → null（迁移无条件覆盖）   走 v9 不迁移 → 999（兜底原样保留）   ⇒ 分叉=true
```
可达性考古（15 字段逐个 `git log -S` 取**最早**引入 commit，比较 state 侧与 saveLoad 侧）：
```
$ python tmp/c924-20/firsttouch.py → tmp/c924-20/git-first-touch.txt
  15 个字段全部 state首现 commit == saveLoad首现 commit（同一笔），无一例"字段先于 bump 存在"
  例：wrathUltimatumEndDay 两侧同为 589ddf2 2026-08-14「feat(P2): 通牒压力系统…（存档 v9）」
      populationClasses 等 6 个同为 54eafe9 2026-08-13「chore: 快照提交 6-7 月工作树」
```
⇒ **本仓历史存档不会命中分叉**：真实老档不可能在低版本带上"该版本还不存在"的键。⇒ 改判面是**面向未来**的风险敞口：一旦有人"先加字段（不 bump）、日后补 bump"，案 A/B 就会在那批档上给出不同答案，且**只有迁移优先案会清掉玩家数据**。

## 3. 两案（卷宗完成标准②：各列红绿影响与存档兼容面）

### 案 A：迁移优先（单一事实源＝`migrations`，删/收敛 `deserialize` 的兜底）

| 面 | 内容（实测/现取） |
|---|---|
| 改动面 | 15 个键的兜底表达式改为"直接取 `s[k]`（或 assert 存在）"；`SerializedSave` 里 15 个 `?:` 转必选。行数≈15–20 行，集中在 :485-:545 区段 |
| **测试红面** | ①"v9 现档缺键"类用例立刻红（兜底被删即 undefined）；②`finiteNum`/`clampSentiment`/`clampWariness` 的越界钳制用例红——**兜底同时是防损坏档的守卫**，案 A 删它等于把守卫面搬家（`saveGuard*.test.ts` 一族共 3 件点名这些字段：`saveGuard3.test.ts:98-110` 逐字段断 `worldWariness/endgameAscendDay/endgameLastWaveDay/wrathUltimatumEndDay` 的钳制与 null 化）；③跨面 **203 行命中、19 个测试文件**引用这 15 个字段（`tmp/c924-20/test-touch.txt`），其中 `gameStore.test.ts:645-670` 是"初值表"型断言，不依赖迁移但仍会被 undefined 波及 ⇒ 归因成本最高的方案 |
| **存档兼容面（谁会改判）** | 🔴 **改判主体＝"当前版本号但缺这些键"的档**：(a) 手工编辑/被裁剪的档；(b) 谎标 v9 的老构建档；(c) 未来"先加字段后补 bump"期间产生的档。这三类今天靠兜底得 `null/0/[]`，案 A 后得 `undefined` ⇒ 下游按 `number | null` 写的判定全部走偏，实测口径（`ultimatum.ts` 四个纯函数逐条读）：`ultimatumDaysLeft()` 只在 `endDay === null` 早退 ⇒ `undefined` 走到 `Math.max(0, undefined - currentDay)`＝**NaN**；`shouldStartUltimatum()` 判 `endDay === null` ⇒ **永不为 true（新通牒再也起不来）**；`shouldExplodeUltimatum()` 判 `currentDay >= endDay` ⇒ NaN 比较恒 false（**永不爆发**）；`shouldLiftUltimatum()` 判的是 `wrath ≤ 55` 与 endDay 无关 ⇒ 只有把怨愤压回安全线才救得回来。合起来：`getUltimatum().active` 对 undefined 取 **true**，玩家看到"进行中、剩余 NaN 日"的死条，而**自动路径全部走不到**——这是玩法级后果，不是类型级噪声。另有 **32 个真存档字段没有迁移可依附**（§1），案 A 对它们无能为力 ⇒ "单一事实源"名不副实，双写面只是从 15 缩到 15+0 |
| 判别力 | ✅ 天然解决 §2.2（迁移成为唯一写点，删一行必红）。代价是把损坏档守卫面另起炉灶（要新增"必选键缺失即 reject"的守卫，见 `docs/insights/colony-deadsave-reject-design-20260924.md` 的 reject 口径） |
| 一句话 | 语义最纯、**改动最贵、存档面最险**；它把"兜底 = 防损坏"这一职责挪走了，而 `SAVE_SCHEMA_VERSION` 已冻结在 9、无版本可 bump，挪不走 |

### 案 B：兜底优先（单一事实源＝`deserialize`，`migrations` 退为"只 bump 版本号"）

| 面 | 内容（实测/现取） |
|---|---|
| 改动面 | 删 15 条 `s['k'] = …` 注入行（保留每步末的 `data.schemaVersion = N+1;`），或在 `migrations` 上方一句话声明"字段初值的唯一事实源在 deserialize，本表只管版本推进"。行数 **−15 / +注释**，零逻辑重写、零类型面变化 |
| **测试红面** | **实测 0 红**（§2.2 就是删 `migrations[8]` 注入行的读数：6 个存档族文件全绿）。⇒ 落地**必须与 §4 的判别性断言同笔提交**，否则是"安静删码"，且 `saveMatrix.test.ts`『v8 老档迁移后 … 注入 null』与 `saveIoSemantics.test.ts:128` 那两条**用例标题里的"迁移注入"字样变成假话**（结果对、归因错），需同步改文案 —— 这是本案唯一的红源（文案/标题与实际写点不一致，属"字面串"级修正，注意纪律档 §九.4：解释性注释不得含被判据点名的字面串） |
| **存档兼容面（谁会改判）** | ✅ 对"键缺失"的真·老档：**八档全等价、零改判**（§2.1 实测）。⚠ 唯一改判＝"低版本档里键带值"（§2.3 的 999 形态）：现状 null、案 B 保留原值。考古证 15 字段无一例"字段先于 bump"⇒ **既有存档集上改判数 = 0**；但这条改动把语义从"迁移覆盖一切"换成"玩家数据优先保留"，**方向上更保守**，需人工确认这是否是本仓想要的口径（`colony-deadsave-reject-design` 与 `colony-day-sanitize-census` 两档都倾向"兜底/clamp 是守卫层"，与本案一致） |
| 判别力 | ❌ 不解决"看不见"（本来就没东西可看了——它把不可见的东西删掉）。**必须**配 §4 断言，把"版本推进链"自身的判别力建起来（否则 `migrations` 变成无人看守的空壳，断链报错面 `migrationGapMessage.test.ts` 仍守着） |
| 一句话 | **最小面、零改判、可逆**；它承认"今天的事实源已经是兜底"，把双写变成单写，代价是要同步洗 15 个字段相关的用例标题/注释与 bump 流程文档 |

### 两案对照（择一即结构性决定，故 §5 交人工）

| | 案 A 迁移优先 | 案 B 兜底优先 |
|---|---|---|
| 代码改动量 | 15–20 行表达式重写 + 15 处类型必选化 | −15 行删除（＋注释） |
| 实测测试红面 | 跨 19 文件 203 行命中面，含守卫族必红 | **0 红（实跑）** |
| 既有存档改判数 | "版本号对但缺键"的档 → `undefined`/NaN 级后果 | 0（键缺失八档逐位等价） |
| 键带值的谎标档 | 覆盖为初值（现状即如此） | 保留玩家数据 |
| 32 个只兜底字段的处置 | 无解（无版本可挂） | 天然一致（它们本来就单写） |
| 损坏档守卫面 | 需搬家（另建 reject 层） | 原地不动 |
| 判别力 | 自动获得 | 需 §4 断言补 |

## 4. 判别性断言设计（两案都要，且这是本稿真正可即刻落地的部分）

要钉的不是"值对不对"（两路同值，恒绿），而是**"哪一路生效"**。三条配方，每条给"断线即红"的变异点：

**A1（分叉值断言：证"迁移确实跑了、且会覆盖"）** — 现网零风险，只喂内存档，落 `saveMatrix.test.ts` 同族新例：
```ts
// 锚：migrations[8] 的 `s['wrathUltimatumEndDay'] = null;`
const blob = realBlobAt(8) as { schemaVersion: number; state: Record<string, unknown> };
delete blob.state.wrathUltimatumEndDay;              // 先钉"键不存在"
blob.state.wrathUltimatumEndDay = 999;               // ← 关键：造一个 v8 期不可能有、但链会遇到的值
expect(deserialize(blob).wrathUltimatumEndDay).toBeNull();   // 迁移赢 ⇒ null
expect(deserialize({ ...blob, schemaVersion: 9 }).wrathUltimatumEndDay).toBe(999); // 不跑链 ⇒ 兜底保留
// 断线即红：删掉 migrations[8] 的注入行 ⇒ 第一行读到 999 ⇒ 红（对比 §2.2：今天删它 0 红）
```
⇒ 这两行放一起构成**只有两路语义差才能满足的判据**，正是 c923-22 缺的那把牙。

**A2（双写守卫用例：把"冗余"变成可检测的不变量）** — 脚本面（`scripts/__tests__/`），AST 轨复用本稿 `tmp/c924-20/census.mts` 的取数器：
```
断言：migrations 各步注入的字段集合 ⊆ deserialize gameState 字面量键集   // 今天 =15/15，恒真
若案 A 胜：反向断言"注入字段的兜底表达式必须是裸 s[k]（无 ??/finiteNum/clamp）"
若案 B 胜：把本断言改成硬不变量「migrations 不得出现任何 `s['k'] =` 赋值，只允许 data.schemaVersion =」
            ⇒ 将来有人往迁移里塞初值当场红，双写面不再复活（这是案 B 的守门条）
```

**A3（字面量同源断言：钉"两路同值"是巧合还是契约）** — 现状两路的缺省值各写各的字面量（`WARINESS_BASELINE`／`0`／`null`／`createDefaultPopulation`）。唯一同源的是 `populationClasses`（:130 与 :590 调同一工厂）。⇒ 建议把 15 个缺省值收进一张 `LEGACY_STATE_DEFAULTS` 表、两路共读（＝案 C），这样"A1 分叉断言"退化为回归哨兵而不是语义仲裁。

**A4（不 bump 就加字段＝本仓真实发生过的 32 例）** 现存事实：`migrations` 有 8 步、`SAVE_SCHEMA_VERSION` 冻结 9，而 32 个字段只在兜底面出现 ⇒ 说明**本仓的实际惯例已是案 B**（加字段不 bump、靠兜底吃旧档）。任何断言设计都该先把这条惯例写死（否则新字段既进不了迁移表、又没兜底 ⇒ 老档 `undefined`，那是真正的事故形态）。可即刻落的一条：AST 守卫"A4：`GameState` 的每个非运行时键，必须同时出现在 `serialize` 的 state 字面量与 `deserialize` 的 gameState 字面量里"（现值 49/51，差 `paused`/`lastTickTimestamp` 两个运行时键 ⇒ 断言需显式豁免清单）。

## 5. 交人工的裁决条目（🔴 本单不选案）

1. **选案 A 还是 B**：这决定"存档字段初值的单一事实源"归属，并直接决定 §3 表里两类档会不会改判 ⇒ 落人工闸（纪律档 §五.3：存档兼容属结构裁决；§十.2：需要重钉基线/会改数据判定的单停在人工闸后）。执行手授权内不出裁决。
2. **是否接受案 C（`LEGACY_STATE_DEFAULTS` 共表）**：它能同时消掉双写与"两路字面量漂移"，但要新增一张跨 `migrations`/`deserialize` 的共享表，属新增结构 ⇒ 亦需人工点头。
3. **案 B 落地时的用例文案清洗范围**：`saveMatrix.test.ts`『v8 老档迁移后 … 注入 null（8→9）』与 `saveIoSemantics.test.ts:128` 的标题/注释要不要一起改写（改写 ⇒ 触发纪律档 §九.4 的字面串禁忌；不改 ⇒ 留下假归因）。
4. **A1 分叉断言是否先行**：它**不依赖选案**（两案下都能写，且都能立刻抓到"删注入行 0 红"这个既成事实）。若人工短期不裁决，建议先单开一测试单落 A1（它把 §2.2 的空洞显式化，是纯增量）。
5. **`migrations` 若被清空是否退役**：退役 ⇒ `migrationGapMessage.test.ts`（断链报错面）与 `runMigrations` 的存在理由要重述；保留空壳 ⇒ 需要 §4 A2 的守门断言。

## 6. 复算配方（全部只读，逐条可重跑）

```
cd D:/code/colony-game
# ① 双轨普查（正则＋AST），两轨差 0
grep -cE "^    s\['[A-Za-z]+'\] = " src/renderer/state/saveLoad.ts            # 15
node tmp/c924-20/census.mts                                                    # AST=15 fbOnly=34 → tmp/c924-20/census-ast.txt
# ② 八档等价矩阵 + 分叉探针 + 真 v8 磁盘档
node --experimental-transform-types --experimental-loader ./tmp/c924-20/loader.mjs tmp/c924-20/probe.mts
node --experimental-transform-types --experimental-loader ./tmp/c924-20/loader.mjs tmp/c924-20/probe2.mts
# ③ 「删掉 migrations[8] 注入行 → 6 个存档族文件全绿」（临时改、当场按字节还原、核 sha）
python - <<'EOF'  # 见 tmp/c924-20/ 内的同型脚本；还原后 sha256_12 必须仍为 1465cd7aa6ef
EOF
# ④ 键触面（19 文件 203 行）→ tmp/c924-20/test-touch.txt；考古首现 commit → tmp/c924-20/git-first-touch.txt
```
⚠ `--experimental-transform-types` 是必需项：`src/renderer/data/modifierValidator.ts` 用了 TS 参数属性（`constructor(message: string, public readonly path: string)`），裸 strip-only 模式会 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`；且本仓源码 import 无扩展名，需 `tmp/c924-20/loader.mjs` 补 `.ts`/`@/` 解析（未碰 `vitest.config.ts` 与任何 tsconfig）。

## 7. 本稿自己的边界

- 生产码与测试件**零改动**；`fakeScene.ts`／`vitest.config.ts`／在册他班三件（`OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json` 及其 `.bak`）未碰；`docs/insights/` 索引未自补（现存 3 份并存、无权威）。
- 未跑全量套件（并行约束；本仓全量由主班 pre-commit 代跑）。§2.2 的 vitest 读数只覆盖 6 个存档族文件，**不代表全量**。
- 行号锚点均为 @HEAD `eaaa3817` 现值；本稿引用一律"唯一文本 ＋ 括注行号"，改码后按文本重取（纪律档 §十.4）。
- 真档样本面**只有仓内语料**：`__fixtures__/save-v9.json` ＋ `saveIoSemantics.test.ts` 内联的 V8 字节。Electron `userData/saves/`（`src/main/index.ts` 的 `join(app.getPath('userData'), 'saves')`）在 cwd 之外，按卷宗禁止事项**未读**；那批才是玩家真档，其版本/键分布需人工跑一次只读普查才能把 §3 的"改判数=0"从"考古级"升为"实测级"。
