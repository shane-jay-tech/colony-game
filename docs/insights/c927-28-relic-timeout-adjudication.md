# c927-28 · relic 挂起事件无超时出口：三案裁决材料（bd0f E3）

- 班次：`qoder-executor-20260927-2006-colony44`
- 日期：2026-09-27
- 性质：**只读裁决材料**。零产品码改动、零新增测试件；下文 diff 全是**草案文本**，未经人工放行不得落地。
- 锚点：`zcode-bridge/done/20260925-154205-bd0f.result.md` 遗留问题①（卷宗写 `outbox/`，实已在 `done/`，按 brief §3a 取用）

---

## 0. 一句话结论

**缺陷为真、但 bd0f 写的根因是错的**：`relic_*` 挂起 id 并非"表外 id"——`buildRelicEvents()` 已把每一阶段物化进 `this.events`，`find` 命中；真正的死因是**物化时没带 `defaultTimeoutDays` 字段**，令 `checkEventTimeout` 在 `:147` 首行就 `return null`。
同时探出一条 bd0f 未见的**更重路径**：`chainId` 失配时物化表为空，`getPendingEvent()` 才真的返回 `null`，而 `EventModal.handleTriggered()` 对 `null` 是**静默 `return`**（不搭模态、不占暂停）⇒ 这才是"玩家侧永不可解"的活锁。
**推荐案 B（`checkEventTimeout` 接受兜底阈值）＋案 C 的失 def 兜底作必要补强**；案 A 单独用会把"古迹自动选了首选项"这个产品语义偷偷决定掉。

---

## 1. 锚点复核：三处漂移，逐条点名

| # | bd0f 原述 | 磁盘实况 | 判定 |
|---|---|---|---|
| ① | "根因是超时兜底只对『EVENTS 表内 id』生效（`gameStore.ts:1171` 的 `this.events.find(…)` 对合成 id 返回 `undefined`）" | `:432` `this.events = [...this.baseEvents, ...this.buildRelicEvents()]`，物化 id 与挂起 id 同式（`:443` / `:1230` 都是 `relic_${site.id}_s${i}`）。实测 `getPendingEvent() === null` → **false**，def 命中 | **否证**。真死因是 def 里 `defaultTimeoutDays` 缺省 |
| ② | "修法①需『在 `runEventTick:1171` 的 `def` 为空时走 relic 自己的超时』" | `:1171` 条件是 `if (def && pendingEventDayStart !== null)`，正常链下 def 非空，该分支进得去；是 `checkEventTimeout` 自己返回 null | **否证其定位**。修法①的落点写错了位置 |
| ③ | "实测一挂 359 日、期间朝议采样停摆" | 复现量级一致：真实 83 条 EVENTS 下**首个 relic 挂起在 day 42、末态已挂 358 日**、`eventResolved` 仅 1 次、`eventHistory` 停在 1 | **成立**（日数随种子 ±1，不影响定性） |
| ④ | 未提及 | `timeSystem.ts:19` `if (this.store.isPaused()) return;`，而 `EventModal.handleTriggered()` 会 `acquirePause()` | **新增事实**，改变三案的严重度分级：见 §2 |
| ⑤ | 未提及 | `saveLoad.ts:519` 把 `stage` 夹成 `Math.min(2, …)`（写死链长 3），但**不校验 `chainId` 是否存在**（`:510-516` 只验 `typeof chainId === 'string'`） | **新增事实**：未知 chainId 能活过读档 ⇒ 案 A 的覆盖面缺口 |

> 附带复核：`EVENTS` 83 条、82 条带 `defaultTimeoutDays`（区间 1..14、均值 8.30）与 bd0f 逐字符一致；唯一缺字段的是 `evt_locust`。`RELIC_CHAINS` 3 条链 × 3 阶段 × 每阶段 2 抉择。

---

## 2. 现状代码与两条独立的死因链

```
runEventTick (gameStore.ts:1167)
  ├─ pendingEventId !== null 时：
  │    def = this.events.find(...)        ← :1170，正常 relic **命中**（漂移①）
  │    if (def && dayStart !== null)
  │        checkEventTimeout(def, elapsed) ← eventEngine.ts:143
  │            if (event.defaultTimeoutDays === undefined) return null;   ← :147 ★死因 A
  │    return                              ← :1177 每相白白跳过采样（"停摆"即此）
  └─ pendingEventId === null 且采样无戏 → tryTriggerRelic() :1227
         pendingEventId = `relic_${site.id}_s${site.stage}`   ← :1230
```

**死因 A（正常链也中招）**：`buildRelicEvents` 造 def 时（`:442-450`）根本没写 `defaultTimeoutDays`，于是 `:147` 直接返回 null。表内 82/83 有该字段，relic 合成事件 0/3 有。

**死因 B（仅 def 失配时，最重）**：`chainId` 不在 `RELIC_CHAINS` 里 → `:440` `continue` → 物化表空 → `:1230` 仍会把 `pendingEventId` 设上（该处**不查表**）→ `getPendingEvent()` 返回 null → `EventModal:146` `if (!evt) return;` **既不搭模态也不 requestPause** ⇒ 时间照常流、顶栏无提示、事件通道被 `:1177` 永久锁死。玩家**看不到任何可点的东西**，也没有超时能救。

**案 ④ 的分级影响**：正常链下模态会挂出并持有暂停持有者（`acquirePause`），时间冻结 ⇒ 挂起在**真人玩法里表现为"弹窗不消失"而非"359 日空转"**；359/358 日空转是**无头/快进**形态。死因 B 不受此保护（因为它压根没进模态）。

---

## 3. 三案 diff 草案（**草案文本，不落码**）

### 案 A · 给 `tryTriggerRelic` 的 pending 配 relic 自己的超时

思路：把 relic 视作"有独立超时口径的事件类"，在 `buildRelicEvents` 造 def 时补字段。

```diff
--- a/src/renderer/state/gameStore.ts   (buildRelicEvents, :436-454)
+++ b/src/renderer/state/gameStore.ts
@@ -439,6 +439,11 @@
       chain.stages.forEach((st, i) => {
         out.push({
           id: `relic_${site.id}_s${i}`,
           tags: ['抉择'],
           triggers: [{ condition: 'random', value: 0 }],
+          // c927-28 案 A：古迹链纳入超时口径。
+          // ⚠ 语义＝"玩家不理它，就自动按第 1 选项把考古推进"——这是产品决策，非纯技术修。
+          // 常量勿写死在此处：链长/超时属平衡面，应上收到 data/balanceConfig（见 §5 反对理由）。
+          defaultTimeoutDays: RELIC_PENDING_TIMEOUT_DAYS,
           contexts: [{ condition: 'default', title: st.title, desc: st.desc, descPlain: st.descPlain }],
```

- 改动面：1 处、+5 行（含常量声明）。`runEventTick` / `checkEventTimeout` / UI 全不动。
- 覆盖面：**只治死因 A**。死因 B（物化表空）依旧无解——因为 def 根本不存在，补字段的时机也没有。
- 需人工补一处：`RELIC_CHAINS.length` 与 `saveLoad.ts:519` 的写死 `Math.min(2, …)` 目前是两处独立口径，案 A 不解决，但会被"链长改动"再次引爆。

### 案 B · 让 `checkEventTimeout` 接受"表外 id／缺字段 def"的兜底阈值

思路：把"没有超时口径"从**沉默**改成**有兜底**，判据从"读 def 字段"上移到"调用方给下限"。

```diff
--- a/src/renderer/state/eventEngine.ts   (:137-150)
+++ b/src/renderer/state/eventEngine.ts
@@ -137,14 +137,24 @@
 /**
  * 超时回退：调用方记录 pendingEventId 起的 daysSincePending。
  * 一旦 ≥ defaultTimeoutDays 就当作选了 choices[0]（保守默认）。
  *
+ * c927-28 案 B：新增 fallbackTimeoutDays——def 缺 defaultTimeoutDays（古迹合成事件即此）
+ * 或 def 为 null（chainId 失配／链裁剪后残留档）时，用它兜底，
+ * 保证「任何 pending 都有出口」成为函数级不变量，而非逐表字段的巧合。
+ *
  * @returns 'pick0' 表示要按 choices[0] 应用；null 表示还没超时
  */
 export function checkEventTimeout(
   event: CourtEvent,
   daysSincePending: number,
+  fallbackTimeoutDays?: number,
 ): 'pick0' | null {
-  if (event.defaultTimeoutDays === undefined) return null;
-  if (daysSincePending >= event.defaultTimeoutDays) return 'pick0';
+  const timeout = event.defaultTimeoutDays ?? fallbackTimeoutDays;
+  if (timeout === undefined) return null;
+  if (daysSincePending >= timeout) return 'pick0';
   return null;
 }
```

```diff
--- a/src/renderer/state/gameStore.ts   (runEventTick, :1167-1178)
+++ b/src/renderer/state/gameStore.ts
@@ -1168,9 +1168,17 @@
     if (this.state.pendingEventId !== null) {
-      // 已有挂起事件：检查是否超时
       const def = this.events.find(e => e.id === this.state.pendingEventId);
-      if (def && this.state.pendingEventDayStart !== null) {
+      if (this.state.pendingEventDayStart === null) return;
+      if (def) {
         const elapsed = this.state.currentDay - this.state.pendingEventDayStart;
-        if (checkEventTimeout(def, elapsed) === 'pick0') {
+        if (checkEventTimeout(def, elapsed, RELIC_PENDING_TIMEOUT_DAYS) === 'pick0') {
           this.resolveEvent(0);
         }
+        return;
       }
+      // 死因 B：def 查无（chainId 失配／链被裁）。bd0f 原述的"表外 id"其实只在这一支成立。
+      // 静默 return 会让事件通道永久锁死（:1177 每相空跳），故按同一兜底阈值强制放行。
+      const orphanElapsed = this.state.currentDay - this.state.pendingEventDayStart;
+      if (orphanElapsed >= RELIC_PENDING_TIMEOUT_DAYS) {
+        this.resolveEvent(0);   // resolveEvent 对 !def 已有清理支（:1276-1280）
+      }
       return;
     }
```

- 改动面：2 文件、约 +14/−4 行。`resolveEvent` 的 `!def` 清理支（`:1276`，发 `EVENT_RESOLVED(applied:false)` 并复位 `lastEventDay`）**已存在且可用**，案 B 正是复用它，不新造结算语义。
- 覆盖面：**A、B 两条死因一起治**。
- 兼容性：`fallbackTimeoutDays` 可选参，现有调用点（仅 `gameStore.ts:1173` 一处，测试除外）签名不破。

### 案 C · UI 侧强制提供"稍后再说"出口

思路：不改状态机，改"玩家一定能点掉"。

```diff
--- a/src/renderer/ui/EventModal.ts   (handleTriggered, :144-150)
+++ b/src/renderer/ui/EventModal.ts
@@ -144,7 +144,16 @@
   /** 当一个新事件被触发时，搭模态、暂停游戏 */
   private handleTriggered(): void {
     const evt = this.store.getPendingEvent();
-    if (!evt) return;
+    if (!evt) {
+      // c927-28 案 C：失 def 的 pending 过去是静默吞掉——既不搭模态也不占暂停，
+      // 玩家看到的就是"事件再也没来过"。改为兜一个最小模态，唯一按钮放行。
+      if (this.store.getPendingEventId() !== null) this.showOrphanFallback();
+      return;
+    }
     this.currentEvent = evt;
```

```diff
--- a/src/renderer/ui/EventModal.ts   (rebuildButtons 内，抉择按钮之后追加)
+++ b/src/renderer/ui/EventModal.ts
@@ @@
+    // 案 C：古迹链追加"稍后再说"——只关模态、不结算，pending 原样留着。
+    // ⚠ 这条支**不解除**事件通道锁死（pendingEventId 仍在 ⇒ runEventTick 仍 return），
+    //    只把"看不见"变成"看得见但仍是死局"，故案 C 单独用不足以结案 E3。
+    if (this.isRelicEvent()) this.appendDeferButton();
```

- 改动面：UI 单文件 2 支 + 新按钮/新布局函数，**是本三案里唯一必须动渲染层布局的**（`EventModal.layout()` / `clearButtons()` / `refreshTexts()` 都要认得新按钮）。
- 覆盖面：治"看得见"，不治"通道锁死"。对死因 B 只有在补了 `showOrphanFallback()` 之后才有出口。

---

## 4. 对"古迹链与朝议共用一条叙事流"设计意图的影响（`:1226` 注释）

`:1226` 原文：**C1：普通朝议无戏时，唤起下一个空闲古迹阶段（与朝议共用一条叙事流，互不抢占）。**

"共用一条流"落到代码上是三件事，三案对它们的冲击不同：

| 设计意图载体 | 现状 | 案 A | 案 B | 案 C（放行式 defer） |
|---|---|---|---|---|
| **单挂位**：`pendingEventId` 一次只挂一个（`:1168`／`eventEngine.ts:20`） | 成立 | 不变 | 不变 | **不变**（defer 不清 id）；若 defer 改成"清 id"则**破**——古迹被踢出流，且 `tryTriggerRelic` 会在下个无戏日**立刻重挂同一个 id**（`:1228` 的 `find(s => !s.done)` 不看是否刚 defer 过）⇒ 变成每相弹一次的弹窗风暴 |
| **互不抢占**：古迹只在朝议无戏时补位（`:1220`） | 成立 | 不变 | 不变 | 同上不破则不变 |
| **一条流的结算口径**：超时按 `choices[0]`"保守默认"（`eventEngine.ts:9`） | 朝议侧 82/83 生效 | **把古迹也拖进这条口径**＝古迹获得与朝议完全相同的"不理它就自动保守"语义——一致性最好，代价是首次替玩家做主 | 同 A，另对 def 失配者给 `applied:false` 的**不结算放行**（只清 pending、不推链），比 A 更保守 | 完全不改结算语义，一致性最好但问题没解决 |

关键不对称：朝议 `choices[0]` 是"一次性事件效果"；古迹 `choices[0]` 会经 `applyRelicChoice`（`:1304`）**永久推进链阶段**并可能挂上 `remainingDays: -1` 的永久 modifier（`:1316-1326` 之 `mod_relic_*`）、`eventHistory.push`（`:1328`）。⇒ 古迹的"保守默认"是**不可逆的叙事推进**，比朝议重一档。这是本案真正的产品语义争议点，也是 A/B 必须经人工放行、不能当纯 bugfix 合的理由。

---

## 5. 推荐与反对

### 推荐：**案 B 为主，案 C 的"失 def 兜底模态"为辅**；案 A 不作为独立方案。

三条理由：

1. **案 B 是唯一覆盖两条死因的方案**，且它复用了 `resolveEvent` 里现成的 `!def` 清理支，不新造结算语义；改动面 2 文件 +14 行，是全案里"每行换来最多覆盖"的。
2. **案 A 单独用是半成品**：它给"存在的 def"补字段，对"def 压根不存在"（未知 chainId 能活过 `saveLoad.ts:511-516` 的校验）无所作——而那恰是玩家侧唯一**完全不可见**的活锁。案 A 能做到的事，案 B 的 `event.defaultTimeoutDays ?? fallbackTimeoutDays` 一行全包了。
3. **案 C 单独用不改状态机**：defer 若不结算，`:1177` 的"每相空跳"照旧，事件通道仍锁死；若 defer 清了 id，则撞 `:1228` 的立即重挂 ⇒ 弹窗风暴。案 C 唯一无争议的增量是 `showOrphanFallback()`——把静默死局变可见，**作为案 B 的 UX 补强**很值，作为独立修法不够。

### 对推荐案的反对意见（须一并交人工）

- **反对 1（最硬）**：案 B 让古迹链在玩家不理时**自动永久推进**（`:1304` → `advanceRelic`、可能挂永久 modifier）。这与"古迹是玩家主动探索的奖励"这一定位相冲；若产品认定"古迹不可被自动推进"，则应把案 B 的兜底行为从 `resolveEvent(0)` 改为**新增一个 `dismissPendingEvent()`**（只清 pending + 记 `lastEventDay`，不推链）——那是**第四种形状**，需另开写单，本只读位不猜其平衡后果。
- **反对 2**：兜底阈值 `RELIC_PENDING_TIMEOUT_DAYS` 是**新的经济/节奏数值**。按红线，本单**不给具体数字建议**（下表只给"必须显式定义"这个形状），取值与是否分链差异交人工。
- **反对 3**：案 B 在 `runEventTick` 里开了"def 查无也放行"的支，等于把静默失败变显式策略——好处是再也藏不住数据错，坏处是**未来任何内容表的 id 拼错都会被超时机制悄悄洗成"放行"**，掩盖数据缺陷。缓解：放行同时 `console.warn` 一条（该 warn 正是 c927-29 运行时日志的天然写入点，两单在此处有接口）。
- **反对 4**：`timeSystem.ts:19` 的暂停闸意味着**正常链在真人玩法里根本不推进日相**，案 A/B 的超时在真人路径上触发得比无头慢得多（要玩家主动不点且时间继续跑才可能——实为"手动暂停 + 不点"这种边角）。所以"超时兜底"对真人更多是**语义完备性**收益，真给玩家解困的是案 C 那个可见出口。

---

## 6. 回归测试面（**列举，本单不建 `__tests__`**）

判据若要落地，最少要覆盖这些支：

1. `runEventTick` 单挂位支：正常 relic 挂起到第 `N` 日 → 自动 `resolveEvent(0)` → `relicSites[0].stage` 前进、`eventHistory` 含 `relic_r0_s0`。
2. 兜底阈值边界：`elapsed === N-1` 不放行、`elapsed === N` 放行（`>=` 语义，`eventEngine.ts:148`）。
3. **死因 B**：未知 `chainId` 的 relicSites → `getPendingEvent() === null` 且 `elapsed >= N` → pending 被清、`lastEventDay` 复位、后续朝议能再采样（这条是 E3 的正证）。
4. `fallbackTimeoutDays` 省略时的向后兼容：现有朝议 82 条超时行为逐字符不变（可用 `eventOrderingSnapshot.test.ts` 的账本形状做基线）。
5. `evt_locust`（表内唯一缺 `defaultTimeoutDays` 者）：案 B 会**顺手**让它获得兜底超时——这是行为变更，必须显式断言"变或不变"，别让它当隐雷过关。
6. 存档往返：挂起中 `serialize/deserialize` 后 `pendingEventDayStart` 存活，超时计时不从读档日重算。
7. `saveLoad.ts:519` 写死 `Math.min(2, …)` 与 `RELIC_CHAINS` 实际链长的一致性（链长 ≠3 时案 A/B 都会与它打架）。
8. UI：`EventModal.handleTriggered` 对 `null` def 不再静默（案 C 支）；`clearButtons` 认识新增按钮。

⚠ 若在判据里加"超时必须在 X ms 内完成"这类性能断言：**`vitest.config.ts` 没有 `testTimeout`**（vitest 1.6.1 默认 5e3 ms），必须同时给显式第三参形状，否则该判据是死闸：
`it('400 日超时兜底不放水', () => { ... }, 30_000)`

---

## 7. 取证命令（可复跑）

```
$ npx vite-node tmp/qoder-executor-20260927-2006-colony44/relic-timeout-probe.mts
pendingEventId = relic_r0_s0 / getPendingEvent() 返回 === null ? false / def.defaultTimeoutDays = undefined
表内事件带 defaultTimeoutDays 的条数 = 0 / 空跑 360 日后已挂起天数 = 360 / EVENT_RESOLVED 发射 = 0
```
（探针件均在本仓 `tmp/` 下，已被 `.gitignore` 覆盖、不入库。）

```
$ npx vite-node tmp/qoder-executor-20260927-2006-colony44/relic-realcontent-probe.mts
[正常 chainId]   relic 合成 id 数 = 3 / 首个挂起日 = 42 / getPendingEvent() 为 null ? false / 已挂起 358 日
[未知 chainId]   relic 合成 id 数 = 0 / 首个挂起日 = 42 / getPendingEvent() 为 null ? true  / 已挂起 358 日  ← 死因 B
[stage=2 未 done] relic 合成 id 数 = 3 / 首个挂起日 = 42 / getPendingEvent() 为 null ? false / 已挂起 358 日
```

```
$ npx vite-node tmp/qoder-executor-20260927-2006-colony44/data-shape-probe.mts
EVENTS 条数 = 83 / 带 defaultTimeoutDays = 82 / 缺字段者 = evt_locust / 超时区间 1..14 均值 8.30
RELIC_CHAINS 链数 = 3，各 stages=3、每阶段抉择数 [2,2,2]
```

判据行原文复核：

```
$ sed -n '432p;1171p;1226p;1230p' src/renderer/state/gameStore.ts
    this.events = [...this.baseEvents, ...this.buildRelicEvents()];      ← :432 物化进表 ⇒ 否证 bd0f 根因
      if (def && this.state.pendingEventDayStart !== null) {             ← :1171
  /** C1：普通朝议无戏时，唤起下一个空闲古迹阶段（与朝议共用一条叙事流，互不抢占）。 */
    this.state.pendingEventId = `relic_${readyRelic.id}_s${readyRelic.stage}`;
$ sed -n '147,148p' src/renderer/state/eventEngine.ts
  if (event.defaultTimeoutDays === undefined) return null;                ← 真死因所在
```

---

## 8. 交人工裁的问题（本单不代答）

1. `RELIC_PENDING_TIMEOUT_DAYS` 取值（**经济/节奏数值**，红线，本单不给数）。
2. 古迹"保守默认"是否允许自动推进不可逆链阶段；否 → 需第四形状 `dismissPendingEvent()`。
3. `evt_locust` 缺 `defaultTimeoutDays` 是有意的"永不超时"还是漏写（表内 82/83 唯一例外）。
4. `saveLoad.ts:519` 写死链长 2 上限是否收敝到 `RELIC_CHAINS` 派生。
5. 案 C 是否接受"defer 后同 id 会立即重挂"这一现状（不接受则 `tryTriggerRelic` 需加 defer 记忆，改动面继续外溢）。
