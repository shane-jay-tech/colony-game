# c927-12 缺字段拒载落地复核 ＋ 低版档回填提示（C2 续单·出口②材料）

- 工单：`c927-12`（cwd `D:\code\colony-game`，软预算 ≤30 分钟）
- 班次：`qoder-executor-20260927-1850-colony41`（波次 24 只读采集班）
- 取证时点：2026-09-27 18:3x；仓现值 HEAD `d435c59`，`git status --porcelain` 开工时 4 行（全部为外部在途件，本班未动）
- 锚点复核：
  - `zcode-bridge/outbox/20260925-120441-da6f.result.md` **查无此件**，按 brief §3a 到 `done/20260925-120441-da6f.result.md` 取到（11,094 B）——**路径搬家，内容在世**，其「遗留1」原文（含两条出口）已作为本单前提使用。
  - 卷宗写的落地位置 `saveLoad.ts:410-416` ⇒ 实测拒载块为 **`:410-418`**（`if` 闭合在 418），**行号有 2 行漂移、结论成立**。
- **本单零产品码改动**（材料单）。所有 diff 只作为草案存在于本档内。

---

## 0. 结论速览

1. **出口① 真落地、真有效**：当版（`schemaVersion === 9`）缺 `rngSeed`/`eventHistory` 一律抛 `SaveLoadError`，消息含字段名，两字段全缺时同串报出。复跑 96 例全绿（§1）。
2. **出口② 确实还没做，而且缺口比"没上报"更硬**：判据用的是**原始版本号** `schemaVersion`（`:383` 取值、`:410` 判等），低版档先过 `runMigrations`（`:395`），迁移链 **1..8 全档都不补这两字段**（`:125-196` 逐档实读，见 §3）⇒ 低版缺字段档**一路静默回填** `12345`/`[]`，既不退钱也不吭声。九格矩阵逐格读数在 §2。
3. **但暴露面比原卷宗设想的小**：git 考古证实现存 `serialize` 面自**首笔 `15769cb`（v1 时代）**就同时写 `rngSeed`（`:179`）与 `eventHistory`（`:170`），且 `SAVE_SCHEMA_VERSION` 从 1 抬到 9 的历次功能笔**没有一次把这两字段移出盘面**（§4）。⇒ 理论上"真老档天然缺字段"的情形**在仓史里不存在**；能触发低版静默回填的只有**手改／截断／外部工具产出**的 blob。这条直接改变了三案的代价排序。
4. **因此最小改法不是"加上报面"而是"把判据挪到迁移之后"**（案 C，**一个标识符**）。它消掉的是这个象限本身，代价是要重新解释 `:409` 注释自述的模块契约（见 §5 最强反对）。
5. 顺带登记两处**存量小腐化**（本班未修，属人工）：`:407` 注释自称"本文件 :413 回填 12345 ／ :453 回填 []"，**实为 `:427` 与 `:467`**（两条各差 14 行）；`deserialize` 返回面上**没有 `schemaVersion`**（探针读数 `versionAfter=undefined`），调用方事后无从知道这份档是从哪版迁上来的。

---

## 1. 判据①：C2 组＋saveGuard 族复跑命令与读数

### 命令（本机 pwsh 禁跑 `npx.ps1`，用 `npx.cmd`）

```
cd D:/code/colony-game
npx.cmd vitest run \
  src/renderer/state/__tests__/replaySnapshotContent.test.ts \
  src/renderer/state/__tests__/saveGuard.test.ts \
  src/renderer/state/__tests__/saveGuard2.test.ts \
  src/renderer/state/__tests__/saveGuard3.test.ts \
  src/renderer/state/__tests__/rateDisplayBoundary.test.ts
```

### 读数（现取 2026-09-27 18:33:45，rc 用 `${PIPESTATUS[0]}` 取，未接管道吞码）

```
 ✓ src/renderer/state/__tests__/saveGuard2.test.ts          (26 tests) 29ms
 ✓ src/renderer/state/__tests__/saveGuard3.test.ts          (14 tests) 63ms
 ✓ src/renderer/state/__tests__/saveGuard.test.ts           (17 tests) 80ms
 ✓ src/renderer/state/__tests__/rateDisplayBoundary.test.ts (12 tests) 175ms
 ✓ src/renderer/state/__tests__/replaySnapshotContent.test.ts (27 tests) 13631ms

 Test Files  5 passed (5)
      Tests  96 passed (96)
   Duration  15.34s
RC=0
```

- 卷宗点名的 saveGuard 族实测是**三枚**（`saveGuard`/`saveGuard2`/`saveGuard3`），卷宗只写了两枚；本班按盘面把 `saveGuard3.test.ts`（14 例）一并纳入，无红。
- C2 组＝`replaySnapshotContent.test.ts:352` describe 块，**3 例**，已翻转为拒载断言：
  - `删 rngSeed ⇒ 拒载`：`expect(r.throws).toMatch(/missing load-bearing field/)` ＋ `toContain('rngSeed')` ＋ `restoredValue` 为 `undefined`
  - `删 eventHistory ⇒ 拒载`：同形，断 `eventHistory`
  - `反向对照：删 panelCollapsed ⇒ 不拒绝、回填 {left:false,right:false}、事件流不变`
- **注意 C2 组的覆盖面**：夹具由 `serialize(store.getState())` 现做，落盘即当版 v9 ⇒ **C2 三条全部只钉当版象限，低版象限现役零测试**。这就是出口②至今没被任何闸照到的直接原因。

### 当版构造件实测（卷宗"做什么 1"的第二半）

探针见 §6。当版缺单字段／双字段的实际抛码，**逐字读数**：

```
REJECTED  SaveLoadError: Save missing load-bearing field(s): rngSeed
          (refusing to load: silent backfill would switch the replay track)
REJECTED  SaveLoadError: Save missing load-bearing field(s): eventHistory
          (refusing to load: silent backfill would switch the replay track)
REJECTED  SaveLoadError: Save missing load-bearing field(s): rngSeed, eventHistory
          (refusing to load: silent backfill would switch the replay track)
```

⇒ 消息含字段名 ✓、含槽位定位符 ✗（`loadFromSlot` 的槽位名只加在 JSON.parse 失败那条上，`:866-869`；载荷缺字段这条不带槽位，面板 toast 会显示原文但**看不出是哪个槽**）。此条登记为出口②落地时的顺带可改进点，本单不动。

---

## 2. 判据②：四象限行为矩阵（新档/低版档 × 缺 rngSeed/缺 eventHistory），逐格实测

`SAVE_SCHEMA_VERSION = 9`。每格独立起一份真值 blob（seed `20260927`，跑 20 日，`serialize` 输出），按格改 `schemaVersion` 与删字段后进 `deserialize`。

| # | 版本 | 缺的字段 | 结果 | 回填读数 | 备注 |
|---|---|---|---|---|---|
| Q1 | v9（当版） | `rngSeed` | **REJECTED** | — | `:411` 命中，消息含 `rngSeed` |
| Q2 | v9（当版） | `eventHistory` | **REJECTED** | — | 消息含 `eventHistory` |
| Q3 | v9（当版） | 两者 | **REJECTED** | — | 一条消息串报 `rngSeed, eventHistory` |
| Q4 | v8（低版） | `rngSeed` | **ACCEPTED** | `rngSeed=12345` ⚠（真值 `20260927`） | 迁移链不补 ⇒ `:427` 兜底 |
| Q5 | v8（低版） | `eventHistory` | **ACCEPTED** | `eventHistory.len=0` ⚠（真值 `1`） | 迁移链不补 ⇒ `:467` 兜底 |
| Q6 | v5（低版） | 两者 | **ACCEPTED** | `rngSeed=12345` ⚠ / `len=0` ⚠ | 静默换轨双开 |
| Q7 | v1（最低版） | 两者 | **ACCEPTED** | `rngSeed=12345` ⚠ / `len=0` ⚠ | 同上，跑完 1..8 全链仍不补 |
| Q8 | v8 对照 | 无（齐全） | ACCEPTED | `rngSeed=20260927` / `len=1` | 证明 Q4/Q5 的差异归因于**缺字段**而非低版本 |
| Q9 | v9 对照 | 无（齐全） | ACCEPTED | `rngSeed=20260927` / `len=1` | 基线 |

### 逐版探活（迁移链到底补不补）

```
v1 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v2 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v3 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v4 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v5 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v6 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v7 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
v8 缺两字段 -> ACCEPTED rngSeed=12345 eventHistory.len=0
```

⇒ **8 档迁移全部 ACCEPTED 且全部回填同一对默认值**。结论：**"低版档先走 runMigrations（迁移链负责补默认）"这句契约（`:409`）对这两字段是假的**——迁移链压根不认识它们。

### 一格放大：`rngSeed` 回填的第二跳

`:429-432` 的 `worldMap` 分支拿 `rngSeed` 当派生种子：若 blob 同时缺 `worldMap`（真低版档的常见形态，`worldMap` 是后加的盘面），则地图**由回填后的 `12345` 重生成** ⇒ 低版缺 seed 档不只是事件流换轨，还会**换掉整张图**。Q4–Q7 未删 `worldMap` 故未触发此跳，此处按源码分支登记，不冒充实测。

---

## 3. 迁移链实读（`:125-196`，出口②的"归属"证据）

`migrations` 表 8 档逐条：

| 档 | 补的键 | 是否碰 rngSeed/eventHistory |
|---|---|---|
| 1→2 | `populationClasses`(由 `resources.people` 派生)、`conversionQueue`、`grainNegativeDays` | 否 |
| 2→3 | `factionState`、`megaProjects`、`exclusivePolicies` | 否 |
| 3→4 | `publicWrath`、`lastWrathDemandDay` | 否 |
| 4→5 | `worldWariness`、`lastWarinessReason` | 否 |
| 5→6 | `lastPropagandaDay` | 否 |
| 6→7 | `relicSites` | 否 |
| 7→8 | `endgameAscendDay`、`endgameLastWaveDay` | 否 |
| 8→9 | `wrathUltimatumEndDay` | 否 |

⇒ 两字段的默认值**只存在于 `deserialize` 尾部的两处 `??`/三元兜底**（`:427`、`:467`），与版本判定块 `:410` 是两套互不知情的机制。这是本单的结构性根因。

---

## 4. git 考古：真老档到底缺不缺这两字段（决定代价排序的关键）

| 命题 | 命令 | 读数 |
|---|---|---|
| 两字段何时进入 saveLoad | `git log --oneline -S "rngSeed" --reverse -- src/renderer/state/saveLoad.ts` | 首笔 `15769cb`（Initial commit: 邦国录 v1.0） |
| 首笔版面上是否已同时写两字段 | `git show 15769cb:src/renderer/state/saveLoad.ts` | **是**：`:28`/`:37` 类型声明，`:170`/`:179` serialize 写出，`:224`/`:244` deserialize 兜底 |
| `SAVE_SCHEMA_VERSION` 抬了几版 | `git log --oneline -G "SAVE_SCHEMA_VERSION = [0-9]" -- src/renderer/state/saveLoad.ts` | 首笔为 **`= 1`**，其后 7 次功能笔抬到 9（`54eafe9`/`87a79b2`/`710af94`/`3994e30`/`276d1a2`/`999c3a9`/`589ddf2`） |

⇒ **v1..v9 每一版的 serialize 盘面都带这两字段** ⇒ 由本仓自身写出的任何档都不天然缺它们。
⇒ 能落进 Q4–Q7 象限的，只有：手改 JSON、截断/断电残体、外部工具或测试夹具产出的低版 blob。
⇒ ⚠ **本单未验盘上真档**：真存档目录 `D:/colony-game/user-data/saves` 按班令一律不碰，本班全部读数以自己 mkdtemp 的临时目录为盘。**"玩家老档一定带这两字段"是由仓史推出的强结论，不是由盘面普查得出的结论**——案 C 的落地前置人工闸就是这一条。

---

## 5. 判据③＋④：出口②承载面清单（≥3，带文件:行）与最小改法 diff 草案

### 5.1 承载面清单（谁拿得到"字段被回填"这一事实）

| # | 文件:行 | 面 | 拿得到吗 | 说明 |
|---|---|---|---|---|
| 1 | `src/renderer/state/saveLoad.ts:427` | `rngSeed` 兜底表达式 | **唯一现场** | 取 fallback 分支的那一瞬知道，出表达式即丢；且无法区分"真缺"与"值非有限数" |
| 2 | `src/renderer/state/saveLoad.ts:467` | `eventHistory` 兜底表达式 `s.eventHistory ?? []` | **唯一现场** | 同上；注意 `[] ?? []` 走的是"存在但为空"，与"缺失"不可分 |
| 3 | `src/renderer/state/saveLoad.ts:858` | `loadFromSlot` 返回面 `Promise<GameState \| null>` | 否（形状不含旁路信息） | 改返回类型＝全量调用方改，见 §5.2 案 A 代价 |
| 4 | `src/renderer/state/saveLoad.ts:871` | `return deserialize(parsed)` | 否 | 唯一的生产侧 `deserialize` 传递点，加可选参数即可穿透 |
| 5 | `src/renderer/ui/SaveLoadPanel.ts:195` | 唯一生产消费方 `const state = await loadFromSlot(slot)` | 否 | 全仓 `loadFromSlot` 的非测试调用方**只有这一处**（`grep` 实测），是收口的理想位置 |
| 6 | `src/renderer/ui/SaveLoadPanel.ts:201` | `this.toast()?.show('读档成功', 'info', 2200)` | **现成出口** | toast 通道已接通（`:192/:197/:201/:206` 四处在用，`kind` 支持 `'error'`），回填警告**不需要新建 UI 面** |
| 7 | `src/renderer/state/gameStore.ts:2835` | `replaceState(newState)` | 否（只收到成品 state） | 它自己还有第二层回填（`productionCarry`/`panelCollapsed`/`completedDecreeIds`/`npcCountries`…），**同样零上报**——出口②若只做存档面会漏这层，登记之 |
| 8 | `src/preload/index.ts:7` | IPC `loadGame(slot): Promise<string \| null>` | 否 | 只送原文字符串 ⇒ 警告**只能**在 renderer 侧生成，不能指望主进程供数；这条封掉了"主进程报回填"的方案族 |

⇒ 命中"≥3 处"判据（本表 8 行，其中 1/2/6 三处是本案真正可承载的位置）。

### 5.2 三案 diff 草案（**逐行，只存在于本档，不落 `src/`**）

#### 案 A —— 返回值加 `warnings: string[]`（卷宗点名的第一直觉形）

```diff
 // src/renderer/state/saveLoad.ts
-export async function loadFromSlot(slot: string): Promise<GameState | null> {
+export type LoadOutcome = { state: GameState | null; warnings: string[] };
+
+export async function loadFromSlot(slot: string): Promise<LoadOutcome> {
+  const warnings: string[] = [];
   validateSlot(slot);
   const raw = await getColonyApi().loadGame(slot);
-  if (raw === null) return null;
+  if (raw === null) return { state: null, warnings };
   ...
-  return deserialize(parsed);
+  return { state: deserialize(parsed, warnings), warnings };
 }
-
-export function deserialize(blob: unknown): GameState {
+export function deserialize(blob: unknown, warnings: string[] = []): GameState {
```
```diff
 // src/renderer/ui/SaveLoadPanel.ts
-        const state = await loadFromSlot(slot);
-        if (state === null) {
+        const { state, warnings } = await loadFromSlot(slot);
+        if (state === null) {
```
```diff
-          this.store.replaceState(state);
+          this.store.replaceState(state);
+          for (const w of warnings) this.toast()?.show(w, 'error', 4200);
```

**代价实测**：`deserialize(` 在测试面 **184 处**、分布在 **21 个测试件**；`loadFromSlot(` 测试面 **16 处**（含 `badSampleRestore.test.ts` 的 6 条 `await expect(loadFromSlot(...)).rejects...`，返回类型一改这些断言全要重写）。案 A 的必改集＝`null` 判定与解构两侧 ⇒ **破坏面最大、收益与案 B 相同**。⇒ **不推荐**。

#### 案 B —— 可选出参 sink（纯增量，零调用方改动）

```diff
 // src/renderer/state/saveLoad.ts  —— 新增导出（放在 SaveLoadError 之后，:28 附近）
+/** 出口②：低版档被静默回填时的通知面。只上报事实，不改行为。 */
+export type BackfillNotice = {
+  field: 'rngSeed' | 'eventHistory';
+  fallback: unknown;
+  sourceVersion: number;   // blob 原始 schemaVersion（迁移前），非 migrate 后
+};
+export type DeserializeOptions = { onBackfill?: (n: BackfillNotice) => void };
```
```diff
 // :376
-export function deserialize(blob: unknown): GameState {
+export function deserialize(blob: unknown, opts?: DeserializeOptions): GameState {
```
```diff
 // :427  —— 拆出布尔位，让"走了兜底"这个事实可被观察
-  const rngSeed = typeof s.rngSeed === 'number' && Number.isFinite(s.rngSeed) ? s.rngSeed : 12345;
+  const seedOk = typeof s.rngSeed === 'number' && Number.isFinite(s.rngSeed);
+  const rngSeed = seedOk ? (s.rngSeed as number) : 12345;
+  if (!seedOk) opts?.onBackfill?.({ field: 'rngSeed', fallback: 12345, sourceVersion: schemaVersion });
```
```diff
 // :467  —— 同上；`?? []` 会把"空账本"与"缺字段"混成一格，故判 undefined 而非判长度
-    eventHistory: s.eventHistory ?? [],
+    eventHistory: (() => {
+      const missing = s.eventHistory === undefined;
+      if (missing) opts?.onBackfill?.({ field: 'eventHistory', fallback: [], sourceVersion: schemaVersion });
+      return missing ? [] : (s.eventHistory as string[]);
+    })(),
```
```diff
 // :858 / :871
-export async function loadFromSlot(slot: string): Promise<GameState | null> {
+export async function loadFromSlot(
+  slot: string,
+  opts?: DeserializeOptions,
+): Promise<GameState | null> {
   ...
-  return deserialize(parsed);
+  return deserialize(parsed, opts);
```
```diff
 // src/renderer/ui/SaveLoadPanel.ts:195-202
-        const state = await loadFromSlot(slot);
+        const notices: BackfillNotice[] = [];
+        const state = await loadFromSlot(slot, { onBackfill: (n) => notices.push(n) });
         if (state === null) {
           this.toast()?.show('该存档不存在或已损坏', 'error', 2600);
           await this.refresh();
         } else {
           this.store.replaceState(state);
-          this.toast()?.show('读档成功', 'info', 2200);
+          if (notices.length > 0) {
+            this.toast()?.show(
+              `读档成功（${notices.map((n) => `${n.field}→默认`).join('、')}，续跑轨迹可能已偏）`,
+              'error', 4200,
+            );
+          } else {
+            this.toast()?.show('读档成功', 'info', 2200);
+          }
           this.hide();
         }
```

**代价**：新增 2 个导出类型 ＋ 4 处单点改写；`opts` 可选 ⇒ **184＋16 处既有调用方零改动**，21 个测试件零红。回滚成本＝删类型、还原 4 行。**风险**：`schemaVersion`（`:383`）是原始版，正是要报的信息；`sourceVersion` 与 `data.schemaVersion`（迁移后恒 9）二者不可混用，落地时须钉死取前者。

#### 案 C —— 判据从"原始版"改到"迁移后一律判"（一个标识符）

```diff
 // src/renderer/state/saveLoad.ts:410
-  if (schemaVersion === SAVE_SCHEMA_VERSION) {
+  if (data.schemaVersion === SAVE_SCHEMA_VERSION) {
```

**理由**：`data` 是 `migrated`（`:399`），迁移链每档尾都写 `data.schemaVersion = N+1`（`:131/…/:193`）⇒ 走完全链后**恒等于 9** ⇒ 判据从"只挡当版"变成"挡所有落地面"，Q4–Q7 四格从 ACCEPTED⚠ 变 REJECTED，与 Q1–Q3 同轨。
**代价实测**：一行；**语义＝低版缺字段档由"静默换轨"改为"拒载"**，这是行为变更不是上报变更 ⇒ 命中班令第 6 条的谨慎区（不选案）。
**前置人工闸**：§4 末 ⚠——必须先对真存档目录做一次**只读普查**（`schemaVersion < 9` 且缺两字段的份数），本班按班令未碰该目录，此数**缺**。

---

## 6. 判据⑤：推荐案 ＋ 最强反对意见

**推荐＝案 B（可选出参 sink）单独落地，不并案 C。**
理由三条：① 它是三案里唯一**只加观测、不改既有可加载集**的形，184＋16 处调用方与 21 个测试件零改动，回滚是删两类型还原四行；② §4 的考古把"真老档缺字段"的可能性压到很低，所以这个象限的**首要需求是"别骗玩家"而不是"别放进来"**——B 恰好给的是"读档成功"这条 toast 的真话版本；③ 案 A 与 B 收益同形而代价高一个量级，C 则是拿"拒载"去补一个还没盘查过的象限，属于用最大失败模式（不可恢复）去修一个未定量问题。若人工盘查（§4 ⚠）显示真档里确实存在缺字段低版份，再把 C 叠在 B 上——B 的 sink 正好是 C 上线前的过渡观测面。

**最强反对意见（对案 B）**：B 报的是**永远不该在正常玩法里出现的**事件，为一条只由"手改存档/工具产出"才触发的路径新增一条 `error` 级 toast，等于把 QA 与真玩家混在同一个告警面上；更要紧的是它**只报不管**——回填已经把 `rngSeed` 换成 `12345` 并重生成地图（`:429-432`），玩家看到"读档成功（rngSeed→默认，续跑轨迹可能已偏）"之后**没有任何可执行动作**（没有"改用别的 seed 重来"、没有"取消读档"分支，`replaceState` 在 toast 之前就已经执行，`:200` 与 `:201` 的先后就是既成事实）。⇒ 按这个读法，B 产出的是一条**不可应答的警告**，真正的最小诚实解反而是"在 `replaceState` 之前判、判不了就退成拒载"（＝C），而 B 只是让 C 显得不必做。
本班**不裁决这条反对**，原文交人工；它同时提示：任何案的落地都应把 toast 时机挪到 `replaceState` 之前（或提供"读档前预检"面），否则告警语义在两种案形下都是空的。

---

## 7. 复算件（临时件，跑完自清）

`D:\code\tmp\qoder-executor-20260927-1850-colony41\quadrant-probe.mts` —— §2/§3 全部读数的来源。跑法（cwd `D:/code/colony-game`）：

```
npx.cmd tsx ../tmp/qoder-executor-20260927-1850-colony41/quadrant-probe.mts
```

- 探针**只 import** `saveLoad`/`gameStore`/`data` 面，**不落盘、不碰真存档目录**（连临时文件都不写，全部在内存里过 `JSON.parse(JSON.stringify())`）。
- 刻意**不走 vitest**：班令在册两坑——仓外 `vi.mock('phaser')` 不命中会报 `window is not defined`、仓外 config 引不到 `vitest/config`；`tsx` 直调纯函数面绕开两者。
- 本班按班令自清该目录，**故本档就是该探针的唯一存证**；重跑需照本节描述重建。

---

## 8. 零改动自证

```
git status --porcelain     # 跑完只比开工时多本档一行
```
开工基线（18:32）4 行，均为外部在途件：`M docs/design/OPTIMIZATION_BACKLOG.md`、`M docs/insights/colony-dead-exports-20260914.json`、`D docs/insights/colony-dead-exports-20260914.json.bak`、`M docs/insights/colony-suite-timings-20260921.json`。
本班未跑 `git add`/`commit`/`checkout`/`restore`/`stash`/`clean`，未碰 `src/`，未碰波次 18 的 `loadGate` 移出件与 `eventOrderingSnapshot.test.ts:295`。
