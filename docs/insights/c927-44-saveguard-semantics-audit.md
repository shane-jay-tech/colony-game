# c927-44 · saveGuard 系测试「标题 ↔ 断言」语义复核（只建议改名，零码改动）

- 班名：`qoder-executor-20260928-0120-colony49`｜档位：只读／文档位
- cwd：`D:\code\colony-game`｜取数时 HEAD：`abdf13d`｜取数时 `git status --porcelain | wc -l`：`4`
- 现取时戳：`Mon Sep 28 01:26:13 2026`（写盘前另取一次，见 §7）
- 本单**未改动任何 `.ts`**：产出仅本文件（新增未跟踪文档）。改名建议全部写成裁决条目交主班，本单不动测试文件。

---

## 1. 锚点复核（卷宗写的 outbox 路径 → 实体在 done/）

| 卷宗锚点 | 盘上实况 | 结论 |
|---|---|---|
| `zcode-bridge/outbox/20260925-120418-82c6.result.md` 遗留 1 末段 | outbox 查无此件；实体在 `D:\code\zcode-bridge\done\20260925-120418-82c6.result.md`（12,658 B） | 路径搬家不是缺陷（波次 40 brief §3 的批量投递缺陷，本单命中并在 `done/` 取到） |
| 「`saveGuard.test.ts:122-128` 的 d) 迁移幂等每次调用各自 `JSON.parse(JSON.stringify(blob))`」 | 本文件现盘 `describe('d) 迁移幂等')` 在 **`:124-131`**，两次深拷贝在 **`:127-128`** | **行号漂 +2**，实质成立（与在册 `docs/insights/c927-01-deserialize-clone-adjudication.md` §1 同读数） |
| 82c6 的自我否证（「本班曾据标题推断它传同一 blob 两次 ⇒ 恒跳过迁移，读原文后否证」） | 否证**成立且本单再加一层**：真按标题把同一对象喂两次，现状不是「恒跳过迁移」而是**第二次直接拒载**（详见 §4-A3） | 82c6 结论方向正确，量级仍偏轻——它只说「测不到幂等」，实际是**标题描述的行为会让用例红** |

在册前案（引而不重复计算）：`c927-01` §4 **I2** 已判 d) 用例「对克隆案零判别力」，本单复核与该结论**一致**；本单的增量是把口径从一枚用例扩到**整文件 17 枚 + 家族（saveGuard2/3）**。

---

## 2. 复核方法（可复算）

1. 逐用例读 `it()` 标题原文与断言体（`D:\code\colony-game\src\renderer\state\__tests__\saveGuard.test.ts` 全文 146 行，17 枚 `it`）。
2. 把每条标题的**因果承诺**拿去对生产码：`src/renderer/state/saveLoad.ts`（878 行）关键位——入口守卫 `:376-392`、载荷字段判缺 `:406-418`、speed `:420-425`、rngSeed `:427`、worldMap 再生 `:429-435`、resources `:440-448`、currentDay `:451-460`、`migrations` 表 `:124-196`、`runMigrations` `:198-217`、`deserializePopulationClasses` `:600-614`、`loadFromSlot` 的 JSON.parse `:858-872`。
3. 家族覆盖归属核对（避免把「本文件没钉」误报成「全仓没钉」）：`saveGuard2.test.ts`（26 枚）／`saveGuard3.test.ts`（14 枚）／`saveLoad.test.ts`／`saveLoadIo.test.ts`／`badSampleRestore.test.ts`／`fullLifecycleLayerTriage.test.ts`。
4. 定向跑（**非全量套件**）：见 §7 读数。

判定档位：**高**＝标题会让读者形成与断言体不符的 assurance（含"断言无论如何都绿"的弱牙）；**中**＝措辞强于断言或因果未钉；**低**＝对齐，仅有维护性提示。

---

## 3. 主表：`saveGuard.test.ts` 全部 17 枚用例（标题语义 vs 实际断言）

| # | 行:标题（原文） | 断言实际做了什么 | 标题诱导的读法 | 生产码现值 | 风险 | 改名建议（**只建议**） |
|---|---|---|---|---|---|---|
| 1 | `:34` 「v1 最小输入可迁移并被反序列化，缺省字段落到安全默认」 | `expect(gs.resources).toBeDefined()` ＋ `expect(gs.speed).toBe(2)` | 读成"默认资源集/默认速度被钉住" | `resources = s.resources ?? {}`（`:441`）⇒ 该夹具下实为**空对象 `{}`**；`speed:2` 是**入参透传**非默认 | **中** | 「v1 最小档可载入：resources 落空对象兜轨、speed 原样透传（不断言默认值内容）」 |
| 2 | `:41` 「v1→v9 迁移注入 populationClasses（migration 1 的行为）」 | 仅 `expect(gs.populationClasses).toBeDefined()` | 读成"钉住了 `migrations[1]` 这一步" | `migrations[1]` 注入（`:130`），但 **反序列化兜底同样给出**（`:554` → `deserializePopulationClasses(undefined, people)` → `createDefaultPopulation`，`:600-602`）⇒ 删掉迁移注入，本例**仍绿**＝**弱牙** | **高** | 「v1 档载入后 populationClasses 非空（迁移注入与反序列化兜底任一路径都满足 ⇒ 不点名 migration 1）」 |
| 3 | `:51` 「当前版本 roundtrip：serialize → deserialize 关键字段保真」 | `deserialize(blob)` → `serialize(gs)` → 断 `again` 的 `schemaVersion/rngSeed/currentDay`；**没有第二次 deserialize** | 读成"字节可回读的双向往返"，且方向写反（实际是 deserialize→serialize） | `serialize` 只出对象（`:307-374`）；往返的另一腿在 `saveLoad.test.ts:85` 「roundtrips worldMap tiles + resourceNodes」才有双腿 | **高** | 「v9 档 deserialize→serialize **单向**：产物 schemaVersion=9 且 rngSeed/currentDay 透传（未回读，非 roundtrip）」 |
| 4 | `:62` 「截断 JSON 字符串被拒（不是对象）」 | `expect(() => deserialize('{"schemaVersion":9,…')).toThrow(SaveLoadError)` | 读成"损坏 JSON 解析面被本文件守住" | `deserialize` **根本不 parse**：`typeof blob !== 'object'` 即拒（`:377-379`）；文件内 `JSON.parse` 只 1 处（`:865`，属 `loadFromSlot`）⇒ 截断与否无关，任意字符串同绿 | **高** | 「字符串入参被**入口非对象门**拒（parse 通道归 `loadFromSlot`，其钉桩在 `saveLoadIo.test.ts:27`）」 |
| 5 | `:66` 「数组冒充对象被拒（缺 schemaVersion）」 | `toThrow(SaveLoadError)`（只钉类，不钉消息） | 读成"有针对数组的专门防线" | 数组 `typeof==='object'` 且非 null ⇒ **过第一道门**；真正拒它的是 `'schemaVersion' in raw`（`:381-383`）。标题括号**因果写对了**，但断言无法证伪该因果；现状**无** `Array.isArray` 顶层防线 | **中** | 「数组入参被拒（现状经"缺 schemaVersion"通道；本例只钉错误类不钉消息）」（若要钉因由：`/missing schemaVersion/`＝**改断言，本单不做**） |
| 6 | `:70` 「null / 数字 / 布尔被拒」 | 三条 `toThrow(SaveLoadError)` | 与断言一致 | 同 `:377-379` 一条码路径（与 #4、`saveGuard3:54` 重复） | 低 | 不必改；家族重复面记 §5 |
| 7 | `:76` 「schemaVersion 为字符串被拒」 | `toThrow(/schemaVersion must be a number/)` | 与断言一致 | 消息即 `:386` | 低（**正面样板**：因果被消息钉住） | 无 |
| 8 | `:82` 「speed 越界（99 / -1 / "2"）被 clamp 回默认 1」 | 三值各 `toBe(1)` | 读成"越界被夹到合法边界"（clamp） | 实为**字面量联合成员判定**，非成员整体回落 `1`（`:422-425`）：99 不会夹成 3；`"2"` 属**类型错**非"越界"；合法下界 `0` 未测 | **中** | 「speed 不属于 `0\|1\|2\|3`（99/-1/"2"）时整体回落默认 1（非边界 clamp；0 为合法值本例未覆盖）」 |
| 9 | `:88` 「rngSeed 为 NaN/Infinity/字符串 回退默认 12345」 | 三值各 `toBe(12345)` | 易扩读成"rngSeed 缺失也回退 12345" | 兜底只在**值非法**时成立（`:427`）；**当版档缺失即拒载**（`:410-418`，r5 B2），低版档才由迁移链负责 | **低-中** | 「rngSeed **值非法**（NaN/Infinity/字符串）回退 12345（缺失在当版档＝拒载，见 `:410-418`）」 |
| 10 | `:94` 「必填字段整体缺失（state 为 undefined）：抛 SaveLoadError（020c 已收口）」 | 双断言：`toThrow(SaveLoadError)` ＋ `toThrow('missing state field')` | 与断言一致 | `:400-402` | 低（与 #17 同输入，**类断言只在这里有**） | 无 |
| 11 | `:100` 「resources 为字符串：抛 SaveLoadError（p911r-40 shape 校验已收口原「可疑」项）」 | 仅 `toThrow(SaveLoadError)` | 读成"钉住了 resources shape 因由" | 真实消息 `resources must be a record of finite numbers`（`:447`）未被钉 | **低-中** | 「resources 为字符串 → SaveLoadError（消息面 `/record of finite numbers/` 未钉）」 |
| 12 | `:105` 「currentDay 超上界（>3600）：拒载 SaveLoadError（c919-04 TODO① 落地翻桩）」 | 入参 `Number.MAX_SAFE_INTEGER + 1`，只一条 | 读成"3600 上界已钉" | 命中的确是 `> MAX_SAVE_CURRENT_DAY` 分支（`:455`），但**边界 3600/3601、负值、NaN、非数值**均不在本例 | **中** | 「currentDay 极大值拒载（走 `>3600` 分支；**边界值与下界另组，本例不含**）」 |
| 13 | `:110` 「currentDay 界内值原样带出（正常档不受上界影响）」 | `toBe(365)` | 与断言一致（未取 3600 边界，但标题未承诺边界） | `:452` 起 | 低 | 无 |
| 14 | `:117` 「v10 明确报错，不静默降级」 | `toThrow(/future schema version/)`，入参用 `SAVE_SCHEMA_VERSION + 1` | 标题写死 "v10"，实现是动态 +1 | `:388-392` | 低（**维护提示**：升版即标题失真） | 「高于当前版的档明确报错，不静默降级（现值＝9+1）」 |
| 15 | `:125`（`describe('d) 迁移幂等')` 唯一用例）「同一旧档迁移两次结果深比较一致」 | 两次**各自深拷贝**（`:127-128`）后 `expect(JSON.stringify(a)).toBe(JSON.stringify(b))` | 三重误导：①"同一旧档"读成"同一对象"；②"迁移幂等"读成"迁移可重入/不改入参"；③"深比较"读成"结构等价已验" | 见 **§4-A3**（本单主角） | **高** | 「v1 档两次**独立深拷贝**反序列化结果逐字符一致（**决定论**钉桩，不覆盖"同一对象复用／迁移幂等"）」＋ `describe('d) 迁移幂等')` → `describe('d) 反序列化决定论')` |
| 16 | `:136` 「截断档（非法 JSON 字符串）→ SaveLoadError 而非裸 SyntaxError」 | 与 #4 同一码路径（另一条字符串），仍只 `toThrow(SaveLoadError)` | 读成"parse 阶段的 SyntaxError 已收敛" | `deserialize` 无 parse；SyntaxError 收敛发生在 `loadFromSlot` 的 try/catch（`:862-870`）；该处**删掉 try/catch 本例不会红** | **高** | 「字符串入参（截断样式样本）走同一非对象通道；**"而非裸 SyntaxError"属 `loadFromSlot`，钉桩在 `saveLoadIo.test.ts:27`／`fullLifecycleLayerTriage:419-420`**」 |
| 17 | `:142` 「缺 state 的档 → SaveLoadError 且信息明确（不再是裸 TypeError）」 | **只有** `toThrow(/missing state field/)`（vitest 正则只比消息子串，**不比类型**） | 读成"本例既钉类又钉消息"，且读成"裸 TypeError 已绝迹" | ①类未在本例钉（同输入的 `:94` 才钉）；②「不再是裸 TypeError」**只对当版档成立**：`schemaVersion:3, state:null` 在 `runMigrations` 里解引用 → **原生 TypeError**（`:396` 早于 `:400`），该现状已由 `saveLoad.test.ts:673-678`（c924-05）钉成 `toThrow(TypeError)` | **高** | 「**当版（v9）**档缺 state：报错消息含 `missing state field`（类断言见 `:94`；**低版档仍走原生 TypeError**，见 `saveLoad.test.ts:678`）」 |

`describe` 层标题一并复核：

| 行:describe 标题 | 实况 | 风险 | 建议 |
|---|---|---|---|
| `:33` 「a) 版本链边界：v1 最小档**逐级**迁移到 v9」 | 块内 3 枚用例只验**终态**（可载入＋两字段非空＋单向序列化），`migrations[1..8]` 各档效果无一被点名（逐档现状由 `saveGuard3.test.ts` #1/#2/#6 与 `saveLoad.test.ts` v3 组分散守） | **中** | 「a) 版本链边界：v1 档经迁移链后**可载入（只验终态）**」 |
| `:61` 「b) 损坏与类型错乱对抗」 | 与内容相符（拒载/兜底/回落混合） | 低 | 无 |
| `:116` 「c) 未来版本档」 | 相符 | 低 | 无 |
| `:124` 「d) 迁移幂等」 | **不符**（见 #15） | **高** | 「d) 反序列化决定论」 |
| `:135` 「020c：SaveLoadError 通道统一」 | 只覆盖 v9 顶层两例；通道统一本身**有条件**（见 #17） | **中** | 「020c：**当版档**顶层损坏走 SaveLoadError 通道（低版档 `state:null` 走原生 TypeError，另册钉桩）」 |

**统计（17 枚用例，逐条计数）**：**高 6**（#2、#3、#4、#15、#16、#17）｜**中 4**（#1、#5、#8、#12）｜**低-中 2**（#9、#11）｜**低 5**（#6、#7、#10、#13、#14）＝17，无遗漏。`describe` 层另有 3 处需改（`d)` 高、`a)` 中、`020c` 中）。完成标准②（≥1 枚误读风险）满足且远超。

---

## 4. 三枚高风险用例的展开（判据证据）

### A1 · `:51` 「roundtrip」方向与腿数都不符
断言体只有 `deserialize(blob)` → `serialize(gs)` 一条腿，标题写的顺序（`serialize → deserialize`）还与实际相反。
可直接复算的最小反例形状：若 `serialize` 漏写某字段而 `deserialize` 兜底成默认，本例照样绿（它从不把 `again` 读回去）。真正的双腿往返在 `saveLoad.test.ts:85-92`（`toEqual` 逐字段）。⇒ **本文件的这枚不宜被引用为"往返保真"证据**；引用者应改引 `saveLoad.test.ts:85`。

### A2 · `:62`／`:136` 「截断 JSON」名不副实（**标题↔断言**错位，不是覆盖率缺口）
`deserialize(blob: unknown)` 的第一行就是 `typeof blob !== 'object' || blob === null` ⇒ `saveGuard.test.ts` 的两枚"截断"用例钉的是**非对象入参门**，与 JSON 是否截断无关。文件内 `JSON.parse` 出现 **1 次**，位置 `:865`（`loadFromSlot`）。
真正的 parse 通道现状**已被别处钉住**：`saveLoadIo.test.ts:27-31`（`/not valid JSON/`）、`badSampleRestore.test.ts:107`（槽位定位消息）、`fullLifecycleLayerTriage.test.ts:419-420`。
⇒ 结论应是**改名＋把引用指向正确用例**，而不是"补测试"（补测试属改码，本单档位禁止）。

### A3 · `:125` d)「迁移幂等」——标题描述的行为**会让用例红**
1. 深拷贝在**每次调用内部**（`:127-128`）⇒ 两次 `deserialize` 收到的是两个互不相干的对象；`JSON.stringify(a) === JSON.stringify(b)` 只能抓**不确定性**（时钟/随机/`Map` 迭代序），**抓不到迁移对错，也抓不到就地改写**。
2. 迁移函数**就地改写**入参：`migrations[N]` 直接 `const s = data.state; s[...] = …; data.schemaVersion = N+1; return data;`（`:126-195`），`runMigrations` 只做 `let current = blob`（`:199`）⇒ 若真按标题把**同一对象**喂两次，第一次后 `blob.schemaVersion` 已是 **9**。
3. 第二次调用于是落入 `schemaVersion === SAVE_SCHEMA_VERSION` 的载荷字段判缺门（`:410-418`），而该夹具（v1 起步、从无 `eventHistory`）此时 `s.eventHistory` 仍 `undefined` ⇒ **抛 `SaveLoadError: Save missing load-bearing field(s): eventHistory`**，用例红。
   - 定性：本条是**静态推演**（读 `saveLoad.ts:126-195/396/410-418` ＋ 测试原文得出），本单**未实跑**该构造——实跑要在 `src/**/__tests__/**` 落新用例＝改码，档位禁止。主班若要实证，可临时把 `:127-128` 的两处深拷贝换成同一对象复跑（预期红于上述消息）。
   - 与在册一致：`c927-01` §4 I2「它对本案零判别力，不能拿它的绿来支持"改法安全"」＋ §1「82c6 严重度判断被 `102c65d` 放大」。本单增量的只是**标题层**：这枚用例的名字正是误导源。
4. 真正的"同一对象复用"语义现状钉桩在 `badSampleRestore.test.ts:243-270`（`expect(JSON.stringify(blob)).not.toBe(before)` ＋ `toBe(SAVE_SCHEMA_VERSION)`，即**就地升版**是现状）。⇒ 引用"迁移幂等"该引 d) 之外的那两枚，本文件不应被当那枚钉。

---

## 5. 家族补充：`saveGuard2/3`（本单范围内最尖的三枚）

| 位置:标题 | 实况 | 风险 | 建议 |
|---|---|---|---|
| `saveGuard2.test.ts:98` 「worldMap 缺失时按 rngSeed **确定性重建**（不抛错）」 | 该文件的 `validV9()` 夹具 **自带 worldMap**（`:20-31`），用例两次调用都未删字段 ⇒ 走的是**校验入参 worldMap**分支（`saveLoad.ts:433-434`），再生分支（`:431-432`）**从未命中**；断言只是把两个相同夹具的产物逐字符比 ⇒ 标题承诺的"缺失时重建"在本文件**空转** | **高** | 「worldMap **在场**时两次解析逐字符一致（再生路径由 `saveLoad.test.ts:149`「legacy save without worldMap regenerates from rngSeed」守）」 |
| `saveGuard3.test.ts:46` 「截断 JSON 字符串被入口拒绝（不裸抛 SyntaxError）」 | **正面样板**：双断言（类＋消息 `/must be a non-null object/`），把 `deserialize` 的"入口非对象"因由钉死。⇒ 同一场景，`saveGuard.test.ts:62/:136` 只钉类 ⇒ 家族内**同题不同强**，引用时该引本枚或 `saveLoadIo.test.ts:27` | 低（作对照样板引用） | 标题可补「（入口非对象门）」以彻底消歧 |
| `saveGuard3.test.ts:76` 「浮点 schemaVersion 5.5 报 No migration path 且含原始版本号」 | 体内**第一行**塞了一条无关前置：`expect(() => deserialize(v4Blob())).not.toThrow()` ⇒ 一条用例两职责；v4 链一旦变红，该"浮点"用例会红并**误指**浮点判据 | **中** | 「v4 链完好 ＋ 浮点 schemaVersion 报 No migration path」（或把前置挪进 `beforeEach`＝改码，本单不做） |

`saveGuard2/3` 其余用例复核结论（简表，全绿无高危）：`saveGuard2:52/56/67/77/84/91/108/112/116/121/126/131/136/143/148/156/166/177/190/197/206/213/224/231/241` 与 `saveGuard3:54/63/68/86/91/99/106/118/124/140/149/167` 标题与断言方向一致；两处次要提示——`saveGuard2:62` 把字符串 `'4'`（类型错）并入"非整数被拒"的表述；`saveGuard3:86` 用 `/10/` 这种极松正则（任何含 "10" 的消息都绿，未来若换成 `No migration path … 10` 类消息也会绿），`saveGuard3:91` 的 `expect(SAVE_SCHEMA_VERSION).toBe(9)` 是"升版即红"的钉桩（属刻意钉，保留但标题已自述前提）。

---

## 6. 改名建议汇总（可直接批的形状）

- **必改（高，6 枚）**：`saveGuard.test.ts` `:41`、`:51`、`:62`、`:125`、`:136`、`:142` ＋ `describe('d) 迁移幂等')`（`:124`）；`saveGuard2.test.ts` `:98`。
- **建议改（中，6 处）**：`saveGuard.test.ts` `:34`、`:66`、`:82`、`:105`、`describe a)`（`:33`）、`describe 020c`（`:135`）；`saveGuard3.test.ts` `:76`。
- **可不动（低）**：`:70`、`:76`、`:88`、`:94`、`:100`、`:110`、`:117` 及 §5 末列其余用例。
- **可不动（低）**：`:70`、`:76`、`:88`、`:94`、`:100`、`:110`、`:117` 及 §5 末列其余用例。
- **改动面（回滚成本）**：纯字符串字面量改动，**不动断言体、不动生产码**；`npx vitest run` 的三文件 57 枚计数不变。
  盘上引用面实测：`grep -rl --include=*.md --include=*.ts --include=*.json` 逐条标题检索 ⇒
  「同一旧档迁移两次」「截断 JSON 字符串被拒」「关键字段保真」「clamp 回默认 1」「数组冒充对象」「worldMap 缺失时按 rngSeed」**只在该测试文件内出现**（改名零外部引用断裂）；
  仅泛词「迁移幂等」另见 `docs/insights/c927-01-deserialize-clone-adjudication.md`、`c927-38-dossier-leftover-register.md` ⇒ 若把 `d) 迁移幂等` 块改名，这两份在册文档的引用需一并注记（**建议主班在 c927-01 追加一行"块名已改，语义不变"**，本单不改它）。
- **风险**：改名会动 `it()` 标题＝快照/基线类文档若按标题字符串比对则需复核。仓内 `docs/insights/colony-test-baseline-20260921*` 一类是**按文件计数**（非按标题），实测计数见 §7，不受影响。

---

## 7. 验收自证（命令＋原文读数）

```
$ npx vitest run src/renderer/state/__tests__/saveGuard.test.ts \
    src/renderer/state/__tests__/saveGuard2.test.ts \
    src/renderer/state/__tests__/saveGuard3.test.ts
 ✓ src/renderer/state/__tests__/saveGuard3.test.ts  (14 tests) 25ms
 ✓ src/renderer/state/__tests__/saveGuard.test.ts  (17 tests) 29ms
 Test Files  3 passed (3)
      Tests  57 passed (57)
rc_vitest=0                      ← 未接管道直取（brief §6）
```

```
$ grep -c "JSON.parse" src/renderer/state/saveLoad.ts
1        # 即 :865，属 loadFromSlot；deserialize 体（:376-460）内无 parse
```

零码改动自证（`git hash-object` 现取，本单只新增本文档）：

```
c35ee3ce54bad068cde3cb593dd3b5bbf1bf63a6  src/renderer/state/saveLoad.ts
35d560e0a1810b67b1e6da68d5132f8a38778149  src/renderer/state/__tests__/saveGuard.test.ts
63ddb5631dcfbabec6a1b0cd1c9d4b395609b795  src/renderer/state/__tests__/saveGuard2.test.ts
a75290b4a8db927c1f8a3e4908a4e2b0a4332216  src/renderer/state/__tests__/saveGuard3.test.ts
```

四枚均与 `HEAD`（`abdf13d`）一致：`git status --porcelain -- src/renderer/state/` 输出**空**（0 行）⇒ 无在途改动，上表即 HEAD 版读数。
`git status --porcelain` 取数时 4 件、收单时应仍为 4 件（＋本文档 1 件未跟踪＝预期 5）。4 件在册在途＝`docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-dead-exports-20260914.json`、其 `.bak` 的在途删除、`docs/insights/colony-suite-timings-20260921.json`——**照读未碰**（本单不引用其中读数；横幅已注记「跑全量 vitest 不会自写 timings」这条在册说法已被否证，本单也**未跑全量**，故与该件无涉）。

---

## 8. 遗留问题（交主班）

1. 🔴 **改名是唯一被建议的动作，本单没做**：档位＝只读／文档位，`it()` 标题虽属文档性质文本，但它落在 `src/**` 文件内 ⇒ 按 brief §9 与横幅「只建议改名、不改码」执行，全部改法已在 §3/§5/§6 写成可直接批的条目，等主班落。
2. **`saveGuard.test.ts:142` 暴露一个真实现状分歧（不属本单修）**：`020c` 的"通道统一"只对**当版档**成立；`{schemaVersion:3, state:null}` 走**原生 TypeError**（`saveLoad.ts:396` 早于 `:400`），并被 `saveLoad.test.ts:673-678` 当作现状钉住。若主班想把低版档也纳入 `SaveLoadError`，**同时会红**的在册断言就是那枚（＋本文件 `describe 020c` 标题）。此为语义项，交裁。
3. **家族重复**：`saveGuard.test.ts:62` ↔ `:136` ↔ `saveGuard3.test.ts:46/54` 四条同一码路径（非对象入口），且强度不一（只有 `saveGuard3:46` 钉消息）。合并＝减用例＝可能触到基线计数档，本单只登记不动。
4. `:105`/`:110` 的 `currentDay` 只测了「极大值拒载」与「365 放行」，**3600/3601 边界、负值、NaN 未测**；`020c` 的同类边界若补＝新增断言面，超出本单档位，仅登记。
5. 本文档引用了 `c927-01`（在册裁决）与 `82c6`（在档 result）的结论而未重算其探针读数；若主班要 d) 用例的"同一对象"实证，按 §4-A3 步骤跑（预期红于 `Save missing load-bearing field(s): eventHistory`），本单档位不允许落测试文件，故**未实证**。
