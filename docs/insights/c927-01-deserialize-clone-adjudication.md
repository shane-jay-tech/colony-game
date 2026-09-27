# c927-01 · `saveLoad.deserialize` 就地注入迁移字段（E3）裁决材料

> 性质：**裁决材料，不改产品码**。本单 `src/` 零写入（收工 `git status --porcelain` 自证见 §6）。
> 生成班：`qoder-executor-20260927-1400-colony38`（波次 19 只读采集子班）。落笔时点 2026-09-27 13:5x（本机 `date` 双向跳，引 UTC 需两侧同写）。
> 仓现值：cwd `D:\code\colony-game`，HEAD `102c65d225dd3631e17b486c5bb8c45144d85f4f`，`git status --porcelain` 7 行。
> 本单引用的五枚取证对象（`saveLoad.ts`／`badSampleRestore.test.ts`／`saveGuard.test.ts`／`saveMatrix.test.ts`／`gameStore.ts`）**逐一经 `git diff --numstat HEAD -- <路径>` 验为工作树＝HEAD**，故下文 file:line 对 HEAD 与对工作树同时成立。
> 归档口径：本仓 `docs/insights/` 索引无权威版本，本件**不代登索引**，由主班决定。

---

## 1. 锚点复核（先证其在世，再用它）

| 卷宗锚点 | 盘上实况 | 结论 |
|---|---|---|
| `zcode-bridge/outbox/20260925-120418-82c6.result.md` 遗留1 | outbox 查无此件；实体在 `zcode-bridge/done/20260925-120418-82c6.result.md`（12,658 B，mtime 9-25 16:06） | **路径搬家不是缺陷**（波次 19 brief §3a 的全局投递缺陷，本单命中并已在 `done/` 取到） |
| 「`saveGuard.test.ts:122-128` 迁移幂等用例每次各自 `JSON.parse` 深拷贝」 | 该 `describe('d) 迁移幂等')` 块实为 **`:124-131`**；`JSON.parse(JSON.stringify(blob))` 两行在 `:127-128` | 实质成立，**行号漂 +2**；按磁盘实况收窄 |
| 「最小改法：`runMigrations` 入口 `structuredClone(blob)`」 | 现盘 `runMigrations` 在 `saveLoad.ts:198-217`，`:199` 为 `let current = blob;` | 改点存在且唯一，见 §3 |
| 82c6 遗留1 的严重度判断：「真正会受影响的只是任何**复用同一对象**的新调用方」 | 🔴 **已被 HEAD 之后的产品码放大**：`102c65d`（r5 B2「缺载荷字段即拒载」，`saveLoad.ts:410-418`）引入了「**仅当版档判缺**」这道门，而复用同一对象会让第二次读**直接拒载**。见 §2 P2 | 锚点结论**方向对但量级偏轻**，本材料据此改判 |

> 另：82c6 当时把 E3 记为「未改语义、只立钉桩」，那两枚钉桩（`badSampleRestore.test.ts:243-256`、`:258-270`）**正是本次改法唯一会撞红的断言面**——锚点自己没点到这一条，见 §4 影响面 I1。

---

## 2. ① 现状钉桩：可跑用例与实机输出

### 2.1 临时件位置（**未落仓、已自清**）

- 探针：`D:\code\tmp\qoder-executor-20260927-1400-colony38\c927-01.probe.ts`
- 成本/逃逸探针：同目录 `clonecost.ts`；类型片段：同目录 `clone-typecheck-snippet.ts`
- 跑法说明：仓内 `vitest.config.ts:18` 的 `include` 只收 `src/**/__tests__/**`，临时件留在仓外时**既收集不到、也 import 不到 `vitest`**（首次尝试已实测 `Cannot find module 'vitest/config'`）⇒ 本单改用 `npx vite-node <绝对路径>` 直跑，探针内不写断言、只打读数。

### 2.2 命令与输出（`cwd=D:\code\colony-game`，`RC=0`）

```
$ npx vite-node "D:/code/tmp/qoder-executor-20260927-1400-colony38/c927-01.probe.ts"
P1_speed_of_result=2 P1_version_after=9 P1_injected=["conversionQueue","endgameAscendDay","endgameLastWaveDay",
  "exclusivePolicies","factionState","grainNegativeDays","lastPropagandaDay","lastWarinessReason",
  "lastWrathDemandDay","megaProjects","populationClasses","publicWrath","relicSites","worldWariness",
  "wrathUltimatumEndDay"] P1_input_changed=true
P2_second_call_on_same_object=SaveLoadError: Save missing load-bearing field(s): eventHistory
  (refusing to load: silent backfill would switch the replay track)
P2b_fresh_parse_each_time_equal=true
P3_thrown=SaveLoadError: currentDay out of range: 12 (allowed 0..3600) P3_version_after_reject=9
  P3_injected_after_reject=[…同上 15 键，另含调用方自己塞的 currentDay…]
P4_input_untouched=true P4_repeat_equal=equal P4_version_of_input=1
SAVE_SCHEMA_VERSION=9

$ npx vite-node "D:/code/tmp/qoder-executor-20260927-1400-colony38/clonecost.ts"
P5_today_deserialize=ok
P5_structuredClone_on_same_input=DataCloneError: fn() {
  return 1;
} could not be cloned.
P6_blob_bytes=1045911 structuredClone_ms=9.0 json_roundtrip_ms=4.8
```

### 2.3 四条读数说的是什么

| 编号 | 构造 | 读数 | 钉住的现状 |
|---|---|---|---|
| **P1** | 一份典型 v1 档 `JSON.parse` 成对象 `obj`，`deserialize(obj)` 一次 | `obj` 被就地升到 `schemaVersion=9`，并被塞进 **15 个**迁移字段；返回值本身正确（`speed=2`） | `deserialize` 对入参**不纯**（与 82c6 E3 同型，本单复算未漂移） |
| **P2** | 同一 `obj` **第二次** `deserialize` | 🔴 **抛 `SaveLoadError: Save missing load-bearing field(s): eventHistory`** | 复用同一对象的调用方**第一次读得开、第二次读不开**。机制：`saveLoad.ts:410` 的判缺门条件是 `schemaVersion === SAVE_SCHEMA_VERSION`，而 `:411` 读的正是被就地改过的 `state`——第一次调用把版本号伪造成当版，第二次就落进这道只为当版档设计的门里。老档本来就没有 `eventHistory`，**这道门对真·当版档是安全网，对"被自己升过版的老档"是误杀** |
| **P2b** | 每次各自 `JSON.parse`（＝在册幂等用例的形状） | 两次结果深相等 | 现有守护**结构上看不见** P2 这一面（只有复用对象才暴露） |
| **P3** | v1 档 + `currentDay:'12'`，首次即拒载 | 抛错后 `obj` 仍自称 9 版并带 15 个注入键 | **拒载不回滚**：调用方手里留下一份"看起来合法、其实从没被接受"的假档 |
| **P4** | 假设改法生效（调用方侧先 `structuredClone`） | 入参字节不变、两次读结果一致、入参仍是 v1 | 改法方向自证：**同一份档可以重复读** |
| **P5** | 入参 `state` 里带一个函数（导出签名 `blob: unknown` 允许） | 今天 `deserialize` **静默成功**；`structuredClone` 同一入参抛 **`DataCloneError`** | 改法的**副作用面**：裸 clone 会把一类今天能过的输入变成**逃逸 SaveLoadError 通道**的裸 TypeError（撞 020c 立的「不得出现裸栈话术」不变量，见 `badSampleRestore.test.ts` 乙判据） |
| **P6** | 合成 1.05 MB 档 | `structuredClone` 9.0 ms；`JSON` 往返 4.8 ms | 代价量级：**读档是冷路径**（一次用户动作），毫秒级、瞬时约 2× 该档字节数；不是性能闸 |

**生产侧真实暴露面（本单现取）**：`deserialize` 虽是 `export`（`saveLoad.ts:376`），但全仓**产品码里唯一调用点在 `saveLoad.ts:871` 的 `loadFromSlot`**，而它每次 `JSON.parse` 新对象（`:865`）⇒ **今天盘面不受 P2 影响**。仓内 `import … from '../state/saveLoad'` 的产品码只有 `src/renderer/ui/SaveLoadPanel.ts:4`，且它只引 `getSaveMeta/loadFromSlot/saveToSlot`，**不含 `deserialize`**。⇒ P2 目前是**导出 API 的地雷**，不是正在流血的缺陷；但 `102c65d` 之后它从「语义不洁」升级为「**同一份输入两次调用结果不同的硬失败**」，埋雷的性质变了。

---

## 3. ② 最小改法 diff 草案（**草案，未落 `src/`**）

### 改点唯一性先证

`deserialize` 体内（`:376-573`）**既无属性赋值、也无 push/splice/delete**——现取三条命令全部 0 命中（rc=1）：

```
$ awk 'NR>=376 && NR<=573 {printf "%d:%s\n", NR, $0}' src/renderer/state/saveLoad.ts \
    | grep -E "^[0-9]+:\s*[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*|\[[^]]+\])\s*=[^=]"   # PROPASS_RC=1
$ awk 'NR>=376 && NR<=573' src/renderer/state/saveLoad.ts | grep -nE "\.push\(|\.splice\(|delete "   # MUT_RC=1
```

（该区间内的 `=` 全部是 `const`/`let` 局部量声明与 `worldMap` 局部赋值，见 `:380/384/394/432/434` 等，写入对象都不是入参。）写入全在 `migrations` 表体内（`:124-196` 内 16 处 `s['…'] =`）。⇒ **`runMigrations` 入口是唯一的注入口**，在那里克隆即可封住全部就地改写；`schemaVersion === 9` 时 `deserialize:395` 的根本不进 `runMigrations`，无需克隆、零额外开销。

### 案 A′｜裸 clone（锚点原文的最小形状）

```diff
--- a/src/renderer/state/saveLoad.ts
+++ b/src/renderer/state/saveLoad.ts
@@ -195,10 +195,14 @@ const migrations: Partial<Record<number, MigrationFn>> = {
 
 function runMigrations(blob: unknown, fromVersion: number): unknown {
-  let current = blob;
+  // c927-01（E3）：迁移链就地改写调用方传入的 blob（P1/P3 实测），而 :410 的「仅当版判缺」门
+  // 读的正是这份被改过的入参 ⇒ 复用同一对象的调用方会「首读成功、再读即拒载」（P2 实测）。
+  // 在唯一注入口断开别名：本函数之后的所有改写都落在克隆体上，入参保持调用方读到的原样。
+  // 已知副作用：blob: unknown 允许不可克隆值（函数/symbol），裸 clone 抛 DataCloneError
+  // 会逃逸 SaveLoadError 统一通道 ⇒ 采 A″ 而非 A′，见案 A″与 §5 反对意见。
+  let current = structuredClone(blob);
   let version = fromVersion;
   while (version < SAVE_SCHEMA_VERSION) {
     const migrate = migrations[version];
```

净改动：**1 行语义 + 6 行注释**。类型面已单独验：`structuredClone(unknown)→unknown` 在 renderer 工程口径（`tsconfig.base.json` strict＋`noUncheckedIndexedAccess`、`tsconfig.renderer.json` `lib:["ES2022","DOM","DOM.Iterable"]`＋`types:[]`）下 **rc=0**（`npx tsc --noEmit --strict --noUncheckedIndexedAccess --target ES2022 --lib ES2022,DOM,DOM.Iterable --types --module esnext --moduleResolution Bundler <片段>`，片段＝`declare const blob: unknown; export const current: unknown = structuredClone(blob);`）。仓内同项目已有先例：`gameStore.ts:458`、`IntroScene.ts:562`。**本文件在 `npm run type-check` 覆盖内**（`include:["src/renderer/**/*"]`），与 c927-03 那单的 `src/main/index.ts` 覆盖面情况相反。

### 案 A″｜带通道的 clone（**推荐形状**，把 P5 的逃逸面一并封掉）

```diff
--- a/src/renderer/state/saveLoad.ts
+++ b/src/renderer/state/saveLoad.ts
@@ -195,10 +195,24 @@ const migrations: Partial<Record<number, MigrationFn>> = {
 
 function runMigrations(blob: unknown, fromVersion: number): unknown {
-  let current = blob;
+  // c927-01（E3）：见案 A′ 注释——唯一注入口，克隆即断开对调用方对象的别名。
+  // 包一层通道：blob 的导出签名是 unknown，含函数/symbol 的入参在 structuredClone 下抛
+  // DataCloneError（实测 P5），裸抛会绕开 020c 立起来的 SaveLoadError 统一面
+  // （badSampleRestore 乙判据＝消息里不得出现裸栈话术）。
+  let current: unknown;
+  try {
+    current = structuredClone(blob);
+  } catch (err) {
+    throw new SaveLoadError(
+      `Save state cannot be cloned for migration (non-serializable field present): ` +
+        `${(err as Error).message}`,
+    );
+  }
   let version = fromVersion;
```

代价：+14 行、无控制流变更、无格式/字段/schemaVersion/迁移判据改动。**行为差异面**：一类今天**静默成功**的输入（带函数的 blob）改后变**显式拒载**。P5 已实测该差异存在；但这类输入在盘面上不可达（`loadFromSlot` 的入参恒为 `JSON.parse` 产物）⇒ 差异**只在导出 API 的直调面上成立**。

### 案 B｜零产品码：把「非纯函数」写成契约

不改 `runMigrations`，改为：①`deserialize` 的 JSDoc 明写「**会就地注入迁移字段；对同一 blob 重复调用不保证结果相同；调用方须自带 `JSON.parse`/clone**」；②`badSampleRestore.test.ts` 追加 P2 型钉桩，把「第二次读同一对象即拒载」永久钉成在册现状。**代价**：地雷仍在，只是从"隐性"变"显性"；防的是"后人不知道"，防不了"后人忘了"。

---

## 4. ③ 影响面清单（5 条，含卷宗点名的迁移幂等用例分析）

| # | 面 | 位置 | 改法落地后的走向 | 判别证据 |
|---|---|---|---|---|
| **I1** 🔴 | **两枚现状钉桩会直接变红**（语义翻转，非回归） | `badSampleRestore.test.ts:243-256`（`:253` `expect(JSON.stringify(blob)).not.toBe(before)`、`:254` `toBe(SAVE_SCHEMA_VERSION)`）＋ `:258-270`（`:268-269`） | 案 A′/A″ 下这两条**必红**——它们断言的正是"入参被就地升版"。改法与它们是**同一批**（82c6）产物，主班改码时必须同批把断言翻成 `expect(JSON.stringify(blob)).toBe(before)` ＋ 用例标题同步改写。**案 B 不动它们** | 本单实测基线：`npx vitest run` 该三件 → `3 passed / 56 passed RC=0`（13:51 现取） |
| **I2** | 卷宗点名的迁移幂等用例：**前后都绿** | `saveGuard.test.ts:124-131`（卷宗写 122-128，漂 2 行） | 该用例每次各自 `JSON.parse(JSON.stringify(blob))`（`:127-128`）⇒ 克隆前后结论不变 ⇒ **它对本案零判别力**，不能拿它的绿来支持"改法安全"。锚点这条推断本单复核成立 | 探针 P2b 同型构造 → `true`；且其 blob 形状（v1、无 `eventHistory`）正是 P2 的爆点形状，说明"每次重 parse"就是它不红的唯一原因 |
| **I3** | 测试侧已有的**自我防护**会变冗余，注释会失真 | `saveMatrix.test.ts:36-45` `realBlobAt()`：`structuredClone(fixture)`，注释原文「structuredClone 必需——migrations[N] 是**原地改写** blob 的（saveLoad.ts:188-195），不克隆会污染 JSON 模块单例、把改动串给后续用例」 | 产品码补 clone 后该防护不再"必需"（留着无害），但注释会变成**过时的现状描述**（且 `:188-195` 行号已漂：迁移体现在 `:124-196`、`runMigrations` 在 `:198-217`）。改法落地时该注释要一并复核 | 现取 grep：`saveMatrix.test.ts:40` |
| **I4** | 存档格式／兼容口径：**零影响** | `SAVE_SCHEMA_VERSION`、`serialize`、`migrations` 表体、盘上字节 | 本改法只改"内存里改谁"，不改**任何**写入内容、版本号、字段口径、迁移判据 ⇒ 老档可读性、往返字节、以及经济/平衡数值面**全部不受影响**（这也是 82c6 把同类改法定性为「语义项」而非「格式项」的原因） | `saveMatrix` 组 A（v1..v8 连通）＋ `realBlobAt` 51 键往返，本单未改动即绿（I1 基线内） |
| **I5** | 错误通道新增一类**可达差异**（仅 A″ 处理） | P5：带函数/symbol 的 blob | 案 A′ ⇒ 裸 `DataCloneError` 逃逸统一通道（撞 020c/badSampleRestore 乙判据的不变量）；案 A″ ⇒ 收进 `SaveLoadError`。盘面不可达（入参恒 `JSON.parse` 产物），**只有直调导出 API 才会碰到** | 探针 P5 两条读数 |
| **I6** | 性能/内存 | 读档路径 | 1 MB 级档 9.0 ms、瞬时峰值约 2× 档字节；读档是**冷路径**（用户点一次「读取」），且仓内在**每帧**路径上刻意**回避** `structuredClone`（`gameStore.ts:458` 的 `getState()` 是已知热点、`buildMode.ts:24`／`placementSystem.ts:41` 注释均以"无 structuredClone 开销"为卖点）⇒ 本案不在热路径，不构成闸 | 探针 P6 |

---

## 5. ④ 两案对比与推荐

### 对比

| 维度 | 案 A″（带通道的 clone） | 案 A′（裸 clone） | 案 B（文档声明非纯） |
|---|---|---|---|
| 消除 P2（复用对象二次读即拒载） | ✅ 根治 | ✅ 根治 | ❌ 地雷仍在 |
| 撞红面 | I1 两枚钉桩必须同批改写（**这是唯一硬代价**） | 同 A″ | 无 |
| 引入新裸抛面 | ❌ 无（DataCloneError 已收进 SaveLoadError） | 🔴 有（I5） | 无 |
| 盘上兼容／格式 | 零影响 | 零影响 | 零影响 |
| 改动量 | 1 处函数入口，+14 行 | +7 行 | 0 产品码，测试 +若干例 |
| 运行时代价 | 冷路径 ms 级 | 同 | 0 |

### 推荐案（1 条）

**采 A″：在 `runMigrations` 入口 `structuredClone(blob)` 并把 `DataCloneError` 收进 `SaveLoadError`；同批把 `badSampleRestore.test.ts:243-270` 两枚现状钉桩的断言**方向翻转**（从"入参必被改"改为"入参必不被改"），并新增一枚 P2 型判别用例（同一对象连读两次，改前红／改后绿）作为承重守护；`saveMatrix.test.ts:40` 的注释一并复核。** 落地前需先加那枚判别用例看它**改前是否真红**（变异四步），再改产品码。

理由（按证据）：①P2 让 E3 从"洁癖问题"升级为"同一输入两次调用结果不同的硬失败"，而放大它的 `102c65d` 是**今天刚落的 HEAD**——这道组合现在只在盘路径外，但任何"读档后把 blob 缓存下来再读一次"的改动（存档面板/回放/双开对比都是自然演进方向）都会立刻踩中；②改动面被证明是**单点**（改点唯一性先证，§3）；③代价全部可枚举（I1 两枚钉桩 + I3 一句注释）；④案 B 只能防"不知道"，防不了"忘了"，而 P2 的失败形态（`Save missing load-bearing field(s): eventHistory`）报的是**字段缺失**，与真实成因（版本号被伪造）之间没有字面线索，排查成本极高——这正是"只写文档"在这个案上兜不住的原因。

### 最强反对意见（1 条）

**「本仓没有任何复用同一 blob 的生产调用方，为假想调用方去改存档读入路径不划算，而且这次要付的代价是**把两枚写来固化现状的守护用例推翻重写**——那等于用"改测试"来给"改产品码"发通行证，此后任何人无法再从测试面读出'这里曾经是就地改写'。」**

这条反对意见的强度在于：①§2.3 末段已自证盘面暴露面为 0；②I1 的红是本改法**唯一**的既有断言冲击，而冲击的正是"上一批人刚立的钉桩"（82c6 的 E3 钉桩与本单 A″ 案相隔两天），连续两批改写同一处语义、容易把测试面改成产品码的回声。

**本材料的回应（供主班裁，不代表裁决）**：反对意见把"改测试"当成成本，但这两枚钉桩的**文体**本来就是"现状登记"（用例标题原文「现状钉桩（20260925-120418-82c6 **登记，未改产品码**）」），它们登记的是**缺陷存在**，不是**缺陷应当存在**——翻向后仍留有"这里改过一次"的痕迹（标题＋注释指向 c927-01），不会形成盲区。若主班要一条**不留翻案痕迹**的替代：走案 B ＋ 追加 P2 型钉桩，把"复用对象即拒载"钉成在册缺陷，等出现真复用调用方时再一次性做 A″。**两条路都比现在的"无人知情"好，差别只在何时付 I1 那笔账。**

---

## 6. 本单守线自证

```
$ cd D:/code/colony-game && git rev-parse HEAD
102c65d225dd3631e17b486c5bb8c45144d85f4f
$ git status --porcelain            # 开工 13:45 与收工同读数
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
 M docs/insights/colony-suite-timings-20260921.json
 M src/renderer/data/index.ts
?? src/renderer/data/__tests__/loadGate.test.ts
?? src/renderer/data/loadGate.ts
```

- 7 行全部是**兄弟班/主班在途件**，本单**未 add／未 commit／未 restore／未 checkout／未 stash／未 clean**，也未触碰其中任何一枚。
- 本单**唯一**写入：`docs/insights/c927-01-deserialize-clone-adjudication.md`（未跟踪，交主班按精确路径代提交）。`src/` 零写入。
- 全量 `npm test` **未跑**（并发窗约束）；取的定向读数是三枚在册件 `3 files / 56 tests passed RC=0`。
- `npm run type-check` 基线现取 `TYPECHECK_RC=0`（含他班在途件）。
- 临时件全部留在 `D:\code\tmp\qoder-executor-20260927-1400-colony38\`，**收班自清**（见结果件遗留）。
- 未读写任何真实存档目录（探针全程在内存对象上；`vite-node` 只加载 `saveLoad.ts` 的 renderer 侧，不进 `src/main/index.ts` ⇒ 不触 `ensureDDrivePaths()`）。
- 数值口径：本件**不含**经济平衡／数值结论；§5 的推荐与反对都只是**材料**，存档读入语义改动按波次 brief §4 属人工闸，裁决权在人工/主班。
