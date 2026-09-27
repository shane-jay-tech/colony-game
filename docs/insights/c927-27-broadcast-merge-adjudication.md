# c927-27 · `resourcesChanged` 碎片化广播 vs 空转广播 —— 合帧广播修法裁决材料（a2e3 遗留 2）

> 班：`qoder-executor-20260927-1945-colony43`｜裁决时刻 2026-09-27 19:5x｜仓 colony-game，分支 `codex/architecture-hardening`，开工 HEAD `4c1d608`
> 锚点：`zcode-bridge/done/20260925-154203-a2e3.result.md:100` 遗留 2（卷宗写 `outbox/`，该批已被 13:11 `--consume` 搬进 `done/`＝路径搬家、内容未变，按波次 brief §3a 先到 `done/` 取；**锚点在世**）
> 🔴 **本件是只读裁决材料**：零产品码改动、**零新增测试件**。
> ⚠ **术语钉死**：本文 §3 的"时序影响用例"＝**文档内列举会被时序变化影响的场景**（编号 T1–T12），**不是 vitest 用例文件**；本班不建、不改任何 `__tests__`。需要"可跑的用例"属写位，须另开放行单。

---

## 0. 结论先行（三句）

1. **锚点担心的两个消费方，只有一个真依赖逐次 deltas**：`JitHintManager.ts:39-45` 确实读 `payload.deltas` 的四个键；而 `BuildPanel.ts:80` 的处理器签名是 `(): void`（**零参数**），其 `refreshAffordance()`（`:544-574`）从 `store.getResources()` 读全量态 ⇒ **它依赖的是"次数"，不是"载荷"**。⇒ "合帧会破坏 BuildPanel 高亮"这一半前提**不成立**（详见 §1）。
2. **合帧必须区分"合广播"与"合变更"**：本仓逐笔应用带 clamp（`setResourceClamped` `gameStore.ts:657`＝`min(cap, max(0, floor(v)))`），**日内"先扣后补"与"净扣"不等值**（§2.4 的算术反例）。⇒ 任何把 `addResource` 的多次调用合并成一次调用的做法都属**改经济/状态语义**（触卷宗红线"经济平衡数值"），只能做"状态逐步照旧、只合并发射"。
3. **推荐案α（同 tick 内按 reason 分桶、tick 末尾 flush ＋ 玩家操作类即时发）**；不推荐按帧跨 tick 合并（案β），因为案β 会同时踩 T5/T6/T7/T8 四条（§3）。

---

## 1. 发射点面（合帧的作用域边界，先钉住"谁在发")

| 发射点 file:line | 载荷 | reason | 触发者 | 合帧归属 |
|---|---|---|---|---|
| `gameStore.ts:689`（`addResource` 内，方法起 `:681`） | `{ deltas: {单键: amount}, reason }` | 由调用方给；**每改 1 个资源键发 1 次** | 26 处调用（`grep -rn "addResource(" src --include=*.ts \| grep -v __tests__`）：`:1313 relic`、`:1417 influence_spend`、`:1710/:1714/:1715 endgame`、`:1832 mega_project`、`:1958 recruit_general`、`:1979 expedition`、`:2042/:2043 war_loot`、`:2068/:2069 raided`、`:2093 war_loss`、`:2325 influence`、`:2496 npc_action`、`:2608 population`、`:2674/:2689 consumption` | 🔴 **碎片化主源**（a2e3：consumption 4.00/tick） |
| `gameStore.ts:812`（`placeBuilding` 内扣料） | 多键 `deltas` | `building_cost` | 玩家点击 | 玩家操作 ⇒ **必须即时**（T1/T8） |
| `gameStore.ts:903`（升级扣料） | 多键 | `building_upgrade` | 玩家点击 | 同上（T4） |
| `gameStore.ts:934`（拆除返还） | 多键 | `building_refund` | 玩家点击；**紧接 `:935` 发 `BUILDING_REMOVED`** | 同上（T3，含**跨事件顺序**） |
| `gameStore.ts:947`（`applyDayDeltas`，方法起 `:940`） | 多键、**无 reason 字段** | — | 引擎每日产出，7 处调用（`:1096/:1162/:1346/:1372/:1507/:1588`） | 自动类 ⇒ 可合帧（已是 1 次/tick，压无可压） |

> `reason` 缺省（`:947`）与 `reason: 'consumption'`（`:2674/:2689`）在合并时**不可互相吞并**：在册件 `starvationSequenceSaveUi.test.ts` 正是靠 `reason` 分桶取证（见 §3 T5）。

---

## 2. 消费方依赖表（判据 ①）

### 2.1 十枚订阅件（订阅发生在**构造期**，故在世上限恒＝10；`isOpen` 只决定 handler 是否干活）

| # | 消费方 | 订阅／解绑 file:line | 处理函数 | 读 payload？ | `isOpen` 门控？ | 每次回调的成本结构 | 合帧后的语义风险 | 严重度 |
|---|---|---|---|---|---|---|---|---|
| C1 | **HUD**（顶栏） | `ui/HUD.ts:189`／`:764` | `:123 onResources → refreshResources()`（`:533-600`） | ❌（`:534` 读 `store.getResources()`） | ❌ **常开** | 遍历 **11 枚 token**（`resourceRegistry.ts:11`）`setText`；值变则 `spawnResourceFloat`（`:574`）＋起 300 ms `addCounter` tween（`:581-597`）；末尾再 `refreshCraftResources()`（`:599`） | 飘字合并（一帧一次大字而非多次小字）；tween 重定目标次数下降（**视觉更稳**）；数字终值不变 | 低（视觉语义，需产品认） |
| C2 | **BuildPanel**（可建性高亮） | `ui/BuildPanel.ts:177`／`:583` | `:80 onResources = (): void → refreshAffordance()`（`:544-574`） | ❌ **零参数** | ❌ 常开 | 遍历全部 `rows`（`BUILDINGS` 35 枚，`data/buildings.ts` 实测 `id:` 35 处；行创建 `:231/:262`）⇒ **每行一次 `getBuildingUnlockInfo`**（`gameStore.ts:533-546`：内含 `getAdoptedPolicyIds()` `:566-568` 新分配 1 Set ＋ `new Set(buildings.filter().map())` ＋ `new Set(completedDecreeIds)` ⇒ **每行 3 次 Set 分配＋O(建筑) 扫描**），再逐行 `graphics.clear/fillStyle/strokeRect` | 高亮**终值不变**（纯 state 推导）；只有"多久刷一次"变 | 🔴 **真成本大户**（见 §2.3） |
| C3 | **JitHintManager** | `ui/JitHintManager.ts:64`／`:78` | `:39-45 onResources(payload)` | ✅ **真读 `payload.deltas`** 四键（`gold/cloth/bronze/rite` 各自 `> 0`） | — | O(4) 判定＋`markJitHintSeen` 去重闸（`:25`） | 🔴 **唯一真语义依赖**：同帧正负抵消 ⇒ 净 ≤0 ⇒ 首次教学提示**永久丢失**（去重闸只放第一次） | 高（T2） |
| C4 | ProductionPanel | `ui/ProductionPanel.ts:142`／`:348` | `:62 → if (isOpen) refresh()` | ❌ | ✅ | 开面板时全量重排 | 频率变化；终值不变 | 低 |
| C5 | PolicyTreePanel | `ui/PolicyTreePanel.ts:192`／`:774` | `:119 → if (isOpen) refresh()` | ❌ | ✅ | 全屏树重绘（`:128` container＋遮罩） | 同 C4；**开着树时它是最大 secondary 成本** | 低-中 |
| C6 | PopulationPanel | `ui/PopulationPanel.ts:106`／`:221` | `:49 → if (isOpen) refresh()` | ❌ | ✅ | 全量重排 | 同 C4 | 低 |
| C7 | GradePanel | `ui/GradePanel.ts:116`／`:283` | `:52 → if (isOpen) refresh()` | ❌ | ✅ | 全量重排；另有 `onDayTick`（`:53`）同效 ⇒ **本就冗余** | 同 C4 | 低 |
| C8 | DiplomacyPanel | `ui/DiplomacyPanel.ts:138`／`:396` | `:72 → if (isOpen) refresh()` | ❌ | ✅ | 全量重排 | 同 C4 | 低 |
| C9 | MilitaryPanel | `ui/MilitaryPanel.ts:79`／`:305` | `:52 → if (this.isOpen) refresh()` | ❌ | ✅ | 全量重排 | 同 C4 | 低 |
| C10 | MegaProjectPanel | `ui/MegaProjectPanel.ts:106`／`:260` | `:76 → if (isOpen) layout()` | ❌ | ✅ | **`layout()` 重排**（比 refresh 更重） | 同 C4，但单次更贵 | 低-中 |
| — | （**反例：已知的规避先例**）BuildingPopover | `ui/BuildingPopover.ts:88` 注释 | — | — | — | 白纸黑字：**"不再监听 RESOURCES_CHANGED 重绘：产出每 tick 变 → 每 tick hide+show 造成弹窗漂移+闪烁"** | ⇒ 本仓已有一次"因广播太碎而放弃订阅"的产品决定；合帧案若落地，这条注释是**回归候选**（是否重新订阅属另裁） | 参考 |

### 2.2 静态挂载面（**收窄 a2e3 E3 的"挂载数未知"**）
`scenes/UIScene.ts:203-254` 在 `create()`（`:193`）里**一次性构造 15 枚面板／管理器**，其中 10 枚订 `RESOURCES_CHANGED` ⇒ **订阅者数不是"开了几件面板"，而是恒 10**（订阅在构造期，见上表"订阅 file:line"）。
⇒ a2e3 E3 的保留意见（"真机同一时刻挂载几件取决于开了哪些面板，55.9 是全挂载上界，不是稳态值"）**按磁盘实况修正为**：回调**调用**数稳态就是 5.59×10＝55.9（10 个 listener 都在世、都会被调），但**干活的只有 C1/C2 两件**（其余 8 件 handler 是 `if (isOpen)` 短路）。

### 2.3 🔴 对 a2e3 "55.9 次刷新" 的量化修正（真正该省的不是那 8 个空转 listener）

| 量 | a2e3 口径 | 本单按静态展开修正 |
|---|---|---|
| 每 tick 回调数 | 55.9（10 件 × 5.59） | 55.9 **成立**，但其中 8 件＝布尔短路（O(1)） |
| HUD `setText` | 61.5 次/tick（11 token × 5.59） | 成立（C1 无门控） |
| **BuildPanel 解锁扫描** | **未计入** | `35 行 × 5.59 ≈ 196 次 getBuildingUnlockInfo/tick` ⇒ **每次 3 个 Set 分配 ≈ 588 个 Set/tick**，且每次内含 O(working 建筑数) 的 filter＋map ⇒ 40 建夹具下 ≈ **7,840 次建筑判定/tick**；speed3（500 ms/日，`data/balanceConfig.ts:56`）⇒ **≈1,176 Set 分配/秒只为重画同一个高亮** |
⇒ 合帧收益的主战场是 **C2**（以及其次 C1），**不是**"回调数好看"。任何方案的验收指标都应写成"C2 的 `getBuildingUnlockInfo` 调用数"，而不是"emit 次数"。

### 2.4 为什么不能"合变更"（clamp 非线性反例，纯算术，不涉平衡数值）
`setResourceClamped`（`gameStore.ts:657`）＝ `min(cap, max(0, floor(v)))` ⇒ 逐笔与净笔**不等值**：
- 现语义（同 tick 内先 `consumption −36` 再 `production +40`）：`5 → max(0,−31)=0 → 40`，终值 **40**，且途中触零 ⇒ 影响 `grainNegativeDays`（在册件 `starvationSequenceSaveUi.test.ts` 断言该计数）。
- 合变更后（净 `+4` 一次应用）：`5 → 9`，终值 **9**。
⇒ 差 **31**，且是**状态差异**不是时序差异 ⇒ 直接触卷宗红线（经济平衡）。**任何修法必须"逐步应用照旧＋只合发射"**，并把合并载荷定义为"Σ 名义 delta"（现语义），若要让消费方看到"实际状态差值"，需**另加字段**而非改写 `deltas`。

---

## 3. 时序影响用例（判据 ②，文档场景清单 T1–T12）

> 用法：每条＝"现语义 → 合帧后 → 是否可观测 → 涉及点 → 判定"。⚠ **不是测试文件**；"现有可观察该场景的在册件"一列只是点名（复算时由放行班跑，本班未跑）。

| # | 场景 | 现语义 | 合帧后（案α／案β） | 可观测面 | 涉及 file:line | 判定 |
|---|---|---|---|---|---|---|
| **T1** | 玩家放置建筑后按钮**当帧置灰** | `placeBuilding` 内 `:812` 即时广播 `building_cost` → C2 重算高亮 | α：玩家类**不入缓冲** ⇒ 无差；β：延到帧末 ⇒ **至少 1 帧"钱不够还亮着"**，玩家可能连点 | 视觉（连点期） | `gameStore.ts:812`、`BuildPanel.ts:80/544` | α 安全／🔴 β 需守卫（操作类同步发） |
| **T2** | **首次收入教学提示**（金/布/青铜/礼器） | `addResource` 逐笔带正 delta，C3 见 `>0` 即 `fire`，`markJitHintSeen` 一次性去重（`:25`） | α：同 tick 内 consumption(负)＋production(正) 合并 ⇒ **净额可能 ≤0 ⇒ 提示永久丢失**（去重闸导致不可恢复）；β 同理且窗口更宽 | 教学提示不再出现（且不可复现，最坏的一类缺陷） | `JitHintManager.ts:39-45/25`、`gameStore.ts:689` | 🔴 **需人裁**：要么保留 C3 走同步发射（推荐），要么改 C3 为"读 state 趋势"而非 deltas |
| **T3** | 拆除建筑的**事件相对顺序** | `:934` `building_refund` **先于** `:936` `BUILDING_REMOVED`；`GameScene.ts:103-105` removedListener 重画建筑层 | α：refund 属玩家类 ⇒ 同步 ⇒ 顺序保持；β：refund 落到 REMOVED **之后** ⇒ "先重画空位、再补资源数"，与 popover 关闭时机交错 | 拆除瞬间的顶栏与地图交错 | `gameStore.ts:934-935`、`GameScene.ts:103/588-596` | α 安全／🔴 β 需守卫 |
| **T4** | 升级扣料 vs 金边脉冲 | `:903` upgrade 广播先于 `BUILDING_UPGRADED`（`GameScene.ts:94-101` 重画＋pulse） | 同 T3 形状 | 建造成功率感 | `gameStore.ts:903`、`GameScene.ts:94` | α 安全 |
| **T5** | **按 reason 分桶取证**（饥饿/消耗审计） | 每笔带 `reason`；在册件用 `hits.filter(h => h.reason === 'consumption')` 断言"单日 grain 只扣 1 次"并取 `deltas.grain === −36` | α：**同 tick 同 reason 合 1 发** ⇒ `consumption` 从 4 发/tick → 1 发/tick，**在册件的 `cons.length === 1` 断言仍可能成立或反而更稳，但 `deltas.grain` 会与同桶其它键混在同一个载荷**（现在是分开发）⇒ 逐键断言需重算；跨 reason 合（→1 发）则 **`reason` 字段失去含义**，`starvation` 死亡数读不出来 | 🔴 在册断言直接红：`starvationSequenceSaveUi.test.ts:75-91`（`cons.length` 与 `deltas.grain`）、`:120-148`（`h.reason === 'starvation'` 计数死亡） | `gameStore.ts:689`＋reason 调用点、上述两区间 | 🔴 **需人裁**（合帧粒度与"审计可读性"直接对撞） |
| **T6** | clamp 逐步 vs 净笔 | 见 §2.4 | 只合发射 ⇒ 无差；合变更 ⇒ 状态差（示例差 31） | 状态与 `grainNegativeDays` | `gameStore.ts:657` | α 安全／🔴 合变更＝越红线 |
| **T7** | **一帧补多 tick**（TimeSystem catch-up） | 每 tick 各发 ⇒ HUD 每 tick 一次 tween（300 ms，`HUD.ts:581-597`，起点取"当前显示值"防回弹） | β（按帧合）⇒ 卡顿后一帧最多 `MAX_TICKS_PER_UPDATE = 400`（`timeSystem.ts:14/27-31`）个 tick 的变化压成 1 发 ⇒ **数字一次跳几百点**＋飘字只发一次大字（`HUD.ts:573-574` `delta = v − prev` 会变巨值） | 明显（顶栏爆跳） | `timeSystem.ts:14/27-31`、`HUD.ts:533-600` | 🔴 β 需专门守卫（飘字/tween 需按 tick 归一） |
| **T8** | **暂停态玩家操作必须有反馈** | `timeSystem.ts:19` 暂停即 `return` ⇒ **没有 tick 边界**；但 `placeBuilding` 等仍会即时广播 | 若实现成"只在 `tickDay` 末尾 flush" ⇒ 暂停期缓冲永不落地 ⇒ 🔴 **HUD/BuildPanel 在暂停时点了没反应**（灰不掉、数字不动） | 极明显（暂停建造是常规玩法） | `timeSystem.ts:18-21`、`gameStore.ts:812/903/934` | 🔴 **案α 的必备守卫**：操作类同步发 ＋ `setPaused` 时强制 flush |
| **T9** | 读档／`STATE_REPLACED` | `GameScene.ts:80-86` replacedListener 重画并 refit；HUD `:132-135` 用 `snapNextResourceUpdate` 跳过 tween | 残留缓冲若在 replace 后仍 flush ⇒ **用旧 tick 的 deltas 覆盖新档显示**（α/β 同险） | 读档后 1 帧闪回旧值 | `GameScene.ts:80`、`HUD.ts:132-135` | 🔴 需守卫：`STATE_REPLACED`／`resetForLoad`（`timeSystem.ts:36-38`）时**丢弃缓冲** |
| **T10** | NaN 拒收与"零变更不发" | `:684` NaN 连库存带事件一起拒；`:812/903/934` 有 `Object.keys(deltas).length > 0` 才发（在册件 `gameStore.test.ts:355` 钉住"cost 为空不发"） | 合并需保持"空桶不发"⇒ 否则多出 `deltas: {}` 空发，`gameStore.test.ts:355` 与 `pauseResumeTimeAdvance.test.ts:132`（"连 RESOURCES_CHANGED 都没发过一条"）会红 | 事件计数 | `gameStore.ts:684/811/902/933`、`gameStore.test.ts:343-361`、`pauseResumeTimeAdvance.test.ts:97/132` | α 安全（只要保留既有守卫） |
| **T11** | 与其它事件的跨域顺序（`BUILDING_PLACED`） | `:812` 广播 → `:814` `BUILDING_PLACED` → `GameScene.ts:65-68` 重画＋落地脉冲；C3 两路各自 `fire` 不同提示 | 合帧改变两路先后 ⇒ 提示文案与音效先后（`toast.show` 队列）交错；HUD tween 起点取"当前显示值" ⇒ 顺序变了**数字轨迹**就变（终值不变） | 音频/Toast 队列顺序 | `gameStore.ts:812→:814`、`GameScene.ts:65-68`、`HUD.ts:579-582` | α 安全（玩家类同步） |
| **T12** | **"空转广播"是另一种病，不构成本案理由** | a2e3 E5：`npcDynamicsTick` 48 发中 47 发负载与前次逐字相同（**97.9%**）、`productionTick` 173/300（**57.7%**）；而 `resourcesChanged` 的 dup 计数＝**0** | 合帧**治不到**空转（它每次负载都不同）；反之加"值变了才发"守卫治不到碎片化（4.00/tick 的 consumption） | 两者独立 | `gameStore.ts:689/947`（碎片）、`productionTick`/`npcDynamicsTick` 发射点（空转） | 🔴 **必须两案分做**，混在一枚工单里会出现"合并了个 dup=0 的事件"的空成绩 |

---

## 4. 灰度方案（卷宗点名"按帧合并阈值"）＋ 候选案对比

### 4.1 候选案

| 案 | 形状 | 合并窗口 | 省下的 emit | 踩到的 T | 语义改动 |
|---|---|---|---|---|---|
| **α**（推荐） | **同 tick 内按 reason 分桶、`tickDay` 末尾 flush ＋ 玩家操作类同步发** | 1 tick（＝speed3 500 ms） | consumption 4.00→1.00；总量 **5.59 → ≈2.59/tick**（换算见 §4.3；**再往下就必须跨 reason 合**，直接踩 T5） | T5（reason 桶内混键）需人裁 | 仅"发射时机"，状态逐步照旧 ⇒ 不触经济红线 |
| β | 按帧合并（rAF 边界，跨 tick） | 1 帧（catch-up 时可含 400 tick，`timeSystem.ts:14`） | 理论 → 1.0/tick | 🔴 T1/T3/T7/T8/T9/T11 | 视觉与操作反馈语义都变 |
| γ | 值变了才发（dedup 守卫） | 不合并，改判重 | **0**（`resourcesChanged` dup＝0，T12） | — | 无（但白做） |
| δ | 新增轻量事件（如 `resourcesChangedLite`）双轨 | — | 视实现 | 造出"两套事件口径"（同 c927-25 的病） | 面最大、维护两套订阅 |

### 4.2 灰度（α 的分批推法，每批可单独回滚，指标同表）

- **批 0（零产品码，先做）**：把计数型探针（`tmp/20260925-154203-a2e3/ui-freq*.mts`）跑成**基线快照**并归档到 `docs/insights/`（现读数在 `tmp/`，被 `.gitignore:25` 忽略 ⇒ 无版本化时间序列，改完无从对比）。指标三枚：① `resourcesChanged` emit/tick；② `getBuildingUnlockInfo` 调用/tick；③ HUD `setText`/tick。
- **批 1（最低风险，语义零变化）**：只合 `consumption` 单桶（`:2674`＋`:2689` 循环 ⇒ 每 tick 1 发）。理由：它是 4.00/tick 的全部来源、且**唯一被 T5 在册断言直接钉住的是"单日恰好 1 次"这一形状**——批 1 恰好把它压成 1 次，需先与在册件对账（`starvationSequenceSaveUi.test.ts:75-91` 的 `cons.length === 1` 现值是靠"日粒度只有一次 grain 扣减"成立的，批 1 后 grain/布/青铜/礼器会进同一载荷 ⇒ **`deltas.grain` 断言仍成立，但 `cons.length` 的语义从"资源级"变成"日级"**，须人工确认这是否正是想要的口径）。
- **批 2**：`population`／`influence`／`npc_action` 各桶 tick 内合并（这些本就 ≤1/tick，**批 2 是"零收益的结构统一"，可跳过**——如实登记，别为凑合并而多改）。
- **批 3（可选，需人工放行才谈"**按帧合并阈值 K**"）**：若仍要更少的 emit，引入**配置化阈值**而非硬编码：开关位建议 `data/balanceConfig.ts` 新增一项（与 `time.msPerDay` `:56` 同表，取值 `tick`（＝α 默认）／`frame-K`（每 K 帧 flush，K≥1，speed3 下 K=1 ≈ 2 日）／`off`（现语义）；**默认必须 `tick` 或 `off`**。⇒ 这就是"按帧合并阈值"的可灰度形状，但**它改变 T7/T8 的风险敞口**，属人工闸，本单不代拍默认值。
- **回滚**：批 1 是单点改动（一个 flush 调用＋一个桶），`git revert` 一枚提交即回；开关形态下回滚＝改配置值。
- **判停（写死在灰度里，防"优化到看不见"）**：① 顶栏数字 tween 单帧跳变幅度上限（人工定数值）；② 首次教学提示必须 100% 可达（T2 回归）；③ 暂停态任何玩家操作后**同帧**面板状态改变（T8 回归）；④ 事件计数类在册件零红。
- **回归必带件（点名在册件，本班未跑）**：`state/__tests__/starvationSequenceSaveUi.test.ts`、`state/__tests__/gameStore.test.ts:343-361`、`state/__tests__/pauseResumeTimeAdvance.test.ts:97-132`、`state/__tests__/tickPerf.test.ts`（事件面改动会挪 tick 成本）、以及 a2e3 E6 点名的 `saveMatrix`／`saveV9Fixture`。

### 4.3 换算（不是目标值，是"为什么 1.0 买不到"）

以 a2e3 的 300 日／5.59 每 tick 分解：`consumption 4.00`＋`无 reason(applyDayDeltas) 1.00`＋`population 0.373`＋`influence 0.133`＋`npc_action 0.087`。
- **保 reason 分桶**（案α）：下界＝`1.00 + 1.00 + 0.373 + 0.133 + 0.087 ≈ **2.59/tick**`。
- 要拿 a2e3 E6 预期的 `1.0–1.5` ⇒ **必须跨 reason 合一** ⇒ 直接踩 T5（`reason` 失去含义，死亡数/消耗审计从载荷里读不出来）。
⇒ **本单在此否证/收窄锚点的一处预期**：a2e3 E6 写"合帧广播（每 tick 末尾一次、带合并 deltas）应把 5.59 → 1.0–1.5"——"每 tick 末尾一次"这句与其自身 E2 的 reason 分解**互相矛盾**（一次＝丢 reason）。
成本面换算：C2 的 `getBuildingUnlockInfo` 调用 `196 → 90.7/tick`（α，−54%）或 `→ 35/tick`（合一，−82%）；HUD `setText` `61.5 → 28.5`（α）或 `→ 11`。

---

## 5. 推荐（判据 ③）＋ 反对

**推荐：案α ＋ 四条守卫（灰度批 1 先行）**，即"同 tick 内、按 reason 分桶、tick 末尾 flush；玩家操作类（`building_cost`／`building_upgrade`／`building_refund`／`relic`／`mega_project`／`influence_spend`／recruit／expedition／war／raided）**同步发射不进缓冲**；`STATE_REPLACED`／`resetForLoad`／`setPaused(true)` 三处**强制 flush 或丢弃缓冲**"。

理由五条：
1. α 是**唯一不动状态语义**的合帧形式（T6/§2.4 是硬约束），而 β 省下的那点 emit 要拿 T7/T8/T11 三处视觉与操作语义换。
2. 收益主战场在 C2（`BuildPanel`，≈196 次解锁扫描/tick＋≈588 Set 分配/tick，§2.3），α 直接砍 54%；而 α 不碰那 8 件 `isOpen` 短路的 listener（它们本就不是成本）。
3. 锚点（a2e3 遗留 2）担心的"影响依赖逐次 deltas 的消费方"**实测只剩 C3 一枚**，且它的失效模式（首次提示永久丢失）由"操作类同步发＋**C3 走同步通道**"完全隔离 ⇒ 风险面比锚点假设的小一个数量级。
4. α 与在册审计件的冲突（T5）是**可谈的口径问题**（日粒度 vs 资源粒度），而 β 的冲突是不可谈的视觉回归（暂停期无反馈＝玩法级故障）。
5. 可灰度、可回滚、指标可复算（三枚计数指标＋两枚在册件），不需要新增测试件即可验收。

**反对（点名与理由）**：
- **反对 γ（值变了才发）作为 `resourcesChanged` 的修法**：dup＝0（a2e3 E5），治的是另一种病（`npcDynamicsTick` 97.9%/`productionTick` 57.7%）；两案混做会出现"合并了个从不重复的事件"的空成绩 ⇒ γ 应**单独成一枚工单**，对象是那两个 tick 事件。
- **反对"每 tick 只发一次"的合一形态**（含 a2e3 E6 的 1.0–1.5 预期）：与 reason 分解自相矛盾（§4.3），代价是审计面可读性。
- **反对 δ（双轨事件）**：再造两套数，与 c927-25 同型病灶。
- **反对以 `BuildingPopover.ts:88` 那条"放弃订阅"的旧规避为合帧验收标准**：它证明的是"碎广播会逼消费方退订"，合帧后是否让 popover 重新订阅属**独立产品裁**，不应顺手绑进本单。
- 反对"改探针凑指标"（a2e3 E2 的 `populationClasses` 配平纪律：阶层分布把 5.59 直接挪到 2.32，**任何 before/after 必须同夹具**）。

---

## 6. 本单未做／交人工

1. **未跑任何测试／探针**（零码改动位；波次 brief §5 并发口径；主班 19:35 全量 157 files／1,711 tests 已绿）。
2. **emit 阈值与"每帧 K"默认值不代拍**（红线：统计数值结论／经济平衡数值）；§4.2 批 3 只给开关形状与取值域。
3. **C1 的飘字合并是否可接受、C3 走同步通道还是改读 state 趋势**＝产品语义裁，交人工（本单只给隔离法）。
4. **T5 的口径选择（日粒度 vs 资源粒度）**必须由人工先定，再谈批 1；否则批 1 落地即红在册件。
5. 未在盘上发现兄弟班撞单：开工前两枚 `result` 位置（outbox／done）均不存在（实测 `HAVE_TASK c927-27`／无 RESULT），零覆写。

## 附：可复算命令

```bash
cd /d/code/colony-game
grep -rn "RESOURCES_CHANGED" src --include=*.ts | grep -v __tests__          # 5 发射点 + 10 订阅件 + 1 注释反例
grep -n "private onResources\|private onRefresh" src/renderer/ui/{HUD,BuildPanel,JitHintManager,ProductionPanel,PolicyTreePanel,PopulationPanel,GradePanel,DiplomacyPanel,MilitaryPanel,MegaProjectPanel}.ts
grep -n "private refreshAffordance" -A 6 src/renderer/ui/BuildPanel.ts        # :544-574 逐行 getBuildingUnlockInfo
grep -n "getBuildingUnlockInfo(" -A 14 src/renderer/state/gameStore.ts | head # :533-546 三 Set 分配
grep -n "setResourceClamped(id" src/renderer/state/gameStore.ts               # :657 clamp（T6 反例的依据）
grep -n "new .*Panel(\|new JitHintManager\|new HUD(" src/renderer/scenes/UIScene.ts | head -20   # :203-254 恒挂载
python -c "import re;print(len(re.findall(r\"\n    id: '\", open('src/renderer/data/buildings.ts',encoding='utf-8').read())))"   # 35 枚建筑 def = C2 行数量级
```
