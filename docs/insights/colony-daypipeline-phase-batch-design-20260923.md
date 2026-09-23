# colony R4：dayPipeline 阶段事件批界契约设计稿（c923-27，**只设计不实现**）

- 任务：`c923-27`　班：`qoder-executor-20260923-0022-colony10`　日期：2026-09-23
- 台账出处：`docs/insights/colony-plan-ledger-20260922.md:110` R4 行——「需先定语义（改行为面），建议先出设计单」。**本单即该设计单，零代码改动。**
- 取证时盘态：HEAD `c4c4a98` ＋ 本班 c923-25/26 在途改动（与本单无关，本单不动任何 `src/`）。

## 〇、前提核验（先否证后设计）

| 卷宗前提 | 实测 | 判定 |
|---|---|---|
| `dayPipeline.ts:116` `export function runDayPipeline(phases: readonly DayPhase[]): void {` ＋ `:117` `for (const phase of phases) phase.run();` | 逐字命中（`:116-118`，函数体只有 1 行，**无任何批界/分隔语义**） | ✅ |
| `dayPipeline.ts:4` tickDay 日历推进是前置步的注释 | 逐字命中 | ✅ |
| 🔴 「**DAY_PHASE_ORDER 实测 21 阶段**」 | **实测 22 阶段**（`:77-100`，`DEFS` 亦 22，无重复） | ❌ **否证：21 → 22** |
| 顺序测试已在：`dayPipeline.test.ts:56` 去重断言 | 命中：`:56 expect(new Set(DAY_PHASE_ORDER).size).toBe(DAY_PHASE_ORDER.length);`。另有 `:57` 钉 `ORDER.length === Object.keys(DEFS).length`、`:65-72` 钉 5 组跨域先后、`:79-86` 钉「严格按 ORDER 执行」 | ✅ 且**加强**（守卫比卷宗所述更多一层） |
| 台账 `:110` R4 行文本 | 逐字命中 | ✅ |

⇒ 下文一律按 **22 阶段**行文。第 22 个是 `sentimentSettle`（民心沉淀），**这恰好是问题的最尖锐处**（见 §一.4）。

### 0.1 22 阶段现值清单（完成标准 ③；引自 `src/renderer/state/dayPipeline.ts:77-100` 的 `DAY_PHASE_ORDER` 与 `:52-75` 的 `DAY_PHASE_DEFS`，emit 数由 `gameStore.ts` enclosing-method 归组实测）

| # | `DayPhaseId` | 中文名 | domain | handler 方法 | 日内 emit 数 | 发的动作 |
|---|---|---|---|---|---|---|
| 1 | `modifierExpiry` | 调整到期 | economy | `runModifierExpiryPhase` | 1 | `MODIFIER_REMOVED` |
| 2 | `seasonTransition` | 季节切换 | time | `runSeasonTransitionPhase` | 2 | `MODIFIER_REMOVED` `MODIFIER_ADDED` |
| 3 | `construction` | 建造推进 | economy | `runConstructionPhase` | 3 | `BUILDING_UPGRADED` `BUILDING_COMPLETED`×2 |
| 4 | `calendarEvents` | 日历事件 | time | `runCalendarEventsPhase` | 3 | 🔴 **`DAY_TICK`** `SEASON_TICK` `YEAR_TICK` |
| 5 | `production` | 生产结算 | economy | `runProductionTick` | 1 | `PRODUCTION_TICK` |
| 6 | `military` | 军务节拍 | military | `runMilitaryTick` | 2 | `GENERALS_CHANGED` `DEFENSE_ALERT` |
| 7 | `decrees` | 朝令推进 | economy | `runDecreeTick` | 3 | `DECREE_COMPLETED` `DECREE_STALLED` `DECREE_ADVANCED` |
| 8 | `events` | 事件采样 | progression | `runEventTick` | 2 | `EVENT_TRIGGERED`×2 |
| 9 | `diplomacy` | 邦交节拍 | diplomacy | `runDiplomacyTick` | 1 | `TRADE_TICK` |
| 10 | `npcDynamics` | 邻国动态 | diplomacy | `runNpcDynamicsTick` | 3 | `ACT_CHANGED` `NPC_ACTION` `NPC_DYNAMICS_TICK` |
| 11 | `population` | 人口增长 | population | `runPopulationTick` | **0** | — |
| 12 | `conversion` | 阶层转化 | population | `runConversionTick` | **0** | — |
| 13 | `starvation` | 饥荒结算 | population | `runStarvationTick` | **0** | — |
| 14 | `crisis` | 危机判定 | progression | `runCrisisTick` | **0** | — |
| 15 | `grade` | 国格判定 | progression | `runGradeTick` | 2 | `GRADE_CHANGED` `TIANXIA_ACKNOWLEDGED` |
| 16 | `factions` | 阶层博弈 | population | `runFactionTick` | 1 | `FACTION_DEMAND_TRIGGERED` |
| 17 | `megaProjects` | 巨型工程 | progression | `runMegaProjectTick` | 1 | `MEGA_PROJECT_COMPLETED` |
| 18 | `endgame` | 终局波次 | progression | `runEndgamePhase` | 1 | `ENDGAME_WAVE` |
| 19 | `story` | 故事导演 | narrative | `runStoryTick` | 3 | `STORY_UNIFIED` `BREATHING_BULLETIN` `STORY_ENDING` |
| 20 | `breathing` | 世界呼吸 | narrative | `runBreathingTick` | 2 | `BREATHING_TOAST` `BREATHING_BULLETIN` |
| 21 | `historian` | 史官谏言 | narrative | `runHistorianTick` | 1 | `HISTORIAN_ADVICE` |
| 22 | `sentimentSettle` | 民心沉淀 | population | `runSentimentSettlePhase` | 1(+4 经内联) | `WRATH_ALERT`；并内联调 `runUltimatumPhase()`(`:2321`) ⇒ `ULTIMATUM_STARTED/LIFTED/EXPLODED` `WRATH_CHANGED` |

**读法**：22 个阶段里按**归组**口径 **18 个 emit、4 个静默**（#11–14）。⚠ 这个"静默"只是归组读数，**#11/#13/#14 实际经 helper 间接 emit**，真零事件阶段只有 #12——详见 §一.2 末尾的推翻性说明，勿据本表做"跳过静默阶段"的实现优化。日内 emit 站点合计 **37**；`runUltimatumPhase` 的 4 个 emit **不占独立阶段位**，它挂在 #22 内部（`gameStore.ts:2321` 直调），所以 #22 实际是「日内事件最密」的阶段之一，却又是最靠后的 ⇒ §一.3 的「#4 早通知」与「#22 晚结算」构成同一天的两头。

**四组已在的顺序守卫**（本设计一律不动顺序，故这四组继续有效）：
`dayPipeline.test.ts:56`（`DAY_PHASE_ORDER` 去重）、`:57`（`ORDER.length === Object.keys(DEFS).length` ⇒ **加阶段必须同改 DEFS**）、`:65-72`（军事→邻国→人口→饥荒→危机→国格 5 组先后）、`:79-86` + `:89-107`（`runDayPipeline` 与 `GameStore.tickDay` 均严格按 `DAY_PHASE_ORDER` 执行且每阶段恰 1 次）。

## 一、现状机制：为什么「半更新」是结构性的，不是偶发 bug

### 1. 订阅者读到的是「调用那一刻」的实时克隆，不是日末快照

```
$ python -c "import io;L=io.open('src/renderer/state/gameStore.ts',encoding='utf-8').read().split(chr(10));[print(k+1,'|',L[k]) for k in range(454,457)]"
455 |   getState(): Readonly<GameState> {
456 |     return Object.freeze(structuredClone(this.state));
457 |   }
```

`structuredClone` 意味着**没有引用漂移风险，但有时刻风险**：克隆发生在第几阶段，就只包含前 N−1 阶段的成果。契约要钉的是后者。

### 2. 日内 emit 的量级：22 个阶段里 18 个会 emit

```
$ rg -c "emitter\.emit\(STATE_EVENTS\." src/renderer/state/gameStore.ts
80
$ python -c "import io,re
L=io.open('src/renderer/state/gameStore.ts',encoding='utf-8').read().split(chr(10))
handlers={m.group(1):m.group(2) for l in L[947:971] for m in [re.match(r'\s+([a-zA-Z]+): \(\) => this\.([a-zA-Z]+)\(',l)] if m}
cur=None; per={}
for l in L:
    m=re.match(r'^  (?:private |public )?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',l)
    if m and not l.strip().startswith('//'): cur=m.group(1); per.setdefault(cur,[])
    for e in re.findall(r'emit\(STATE_EVENTS\.([A-Z_]+)',l): per.setdefault(cur,[]).append(e)
direct=sum(len(per.get(v,[])) for v in handlers.values())
ult=len(per.get('runUltimatumPhase',[]))
silent=[k for k,v in handlers.items() if not per.get(v,[])]
print('phases',len(handlers),'emitting',len(handlers)-len(silent),'silent',silent)
print('direct in-phase emits',direct,'+ nested runUltimatumPhase',ult,'= in-day',direct+ult,'| non-phase',sum(len(v) for v in per.values())-direct-ult)"
phases 22 emitting 18 silent ['population', 'conversion', 'starvation', 'crisis']
direct in-phase emits 33 + nested runUltimatumPhase 4 = in-day 37 | non-phase 43
```

**80 个 emit 站点分两类**（按 enclosing method 归组，阶段名以 `tickDay` `:948-971` 的 handler 表为准）：

- **37 个日内可达**＝**33 个直发在 18 个阶段方法体内** ＋ **4 个在 `runUltimatumPhase`**（它不是阶段，被 #22 `runSentimentSettlePhase` 于 `:2321` 内联直调）。
- **43 个在阶段外**（`placeBuilding` / `adoptPolicy` / `replaceState` / `setSpeed` / `resolveEvent` …）⇒ 用户输入与读档路径，**必须保持立即生效**，不得被批处理延迟。

**22 阶段中 18 个 emit、4 个静默**（`population` #11 / `conversion` #12 / `starvation` #13 / `crisis` #14——注意这 4 个恰是**台账 :65-72 顺序守卫链上最关键的一环**，静默不等于无关）。

**这条二分是本设计的地基**：批界只应包住前者，包住后者即为行为退化（点一下按钮界面不更新）。

⇒ 这条推翻了 §一.2 的"4 个静默阶段"表面读数，也决定了下面的实现口径。先给复算命令，再给逐 helper 结论。

```
$ python -c "import io,re
L=io.open('src/renderer/state/gameStore.ts',encoding='utf-8').read().split(chr(10))
cur=None; calls={}
for l in L:
    m=re.match(r'^  (?:private |public )?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(',l)
    if m and not l.strip().startswith('//'): cur=m.group(1)
    for t in ['applyDayDeltas','applyCrisis','adjustWrath','addResource']:
        if re.search(r'this\.'+t+r'\(',l): calls.setdefault(t,set()).add(cur)
[print('%-16s %d  %s'%(t,len(v),sorted(x for x in v if x))) for t,v in calls.items()]"
applyDayDeltas   6  ['adoptDecree', 'adoptPolicy', 'applyDiplomacyResult', 'runDecreeTick', 'runDiplomacyTick', 'runProductionTick']
adjustWrath      8  ['applyCrisis', 'applyRelicChoice', 'resolveFactionDemand', 'runEndgamePhase', 'runNpcDynamicsTick', 'runSentimentSettlePhase', 'runStarvationTick', 'spendPropaganda']
addResource      15 ['applyRelicChoice', 'killSoldiers', 'launchExpedition', 'recruitGeneral', 'redeemVassalage', 'resolveExpedition', 'resolveIncomingAttack', 'runCrisisTick', 'runEndgamePhase', 'runMegaProjectTick', 'runNpcDynamicsTick', 'runPopulationTick', 'runSentimentSettlePhase', 'runStarvationTick', 'spendInfluence']
applyCrisis      1  ['runCrisisTick']
```

🔴 **37 是下界，不是全量**：上表按 **enclosing method** 归组，只统计「阶段方法体内自己写的 emit」。阶段还会**经 helper 间接 emit**（下数条由 `this.<helper>(` 的 enclosing-method 归组实测）：

- `applyDayDeltas`（占 1 个 `RESOURCES_CHANGED`）被 **#5 `runProductionTick`、#7 `runDecreeTick`、#9 `runDiplomacyTick`** 三个阶段调用（另被 `adoptDecree` / `adoptPolicy` / `applyDiplomacyResult` 三个非阶段入口调用）。
- `adjustWrath`（占 1 个 `WRATH_CHANGED`）被 **#10 #13 #18 #22** 四个阶段调用。
- `addResource`（占 1 个 `RESOURCES_CHANGED`）被 **7 个阶段方法**调用：#10 `npcDynamics`、#11 `population`、#13 `starvation`、#14 `crisis`、#17 `megaProjects`、#18 `endgame`、#22 `sentimentSettle`（另有 8 个非阶段调用点：`applyRelicChoice` `killSoldiers` `launchExpedition` `recruitGeneral` `redeemVassalage` `resolveExpedition` `resolveIncomingAttack` `spendInfluence`）。
- `applyCrisis`（占 3 个：`BUILDING_UPGRADED` `GRADE_CHANGED` `CRISIS_TRIGGERED`）**只被 #14 `runCrisisTick` 调用**。

⇒ 🔴 **直接推翻 §一.2 的"4 个静默阶段"表面读数**：`population` #11 / `starvation` #13 / `crisis` #14 之所以在归组里是 0，只因它们的 emit 全在 helper 里；**真正全程零事件的阶段只有 #12 `conversion` 一个**。
⇒ 真实日内事件数 **> 37**，"43 个阶段外"偏高。
⇒ 对本设计的后果：**批界不能按"是不是阶段方法"来判断，必须挂在 emit 的唯一出口上**（见 §四 B.1 的 `emitNow` + `batchDepth` flag）。若照 37/43 的字面二分去实现，会把 helper 的日内事件漏在队列外，契约照样破。此点已由 §〇.1 的 `runUltimatumPhase`（挂在 #22 内、占 4 emit）同样印证。
⇒ **也顺带给"要不要用『某阶段是否 emit』做实现优化"提了醒**：按归组结果跳过静默阶段是个**会漏的优化**，别做。

### 3. 🔴 最尖锐实证：`DAY_TICK` 在**第 4/22 阶段**发出，且是该阶段的第一句话

```
$ rg -n "STATE_EVENTS.DAY_TICK" src/renderer/state/gameStore.ts
1052:    this.emitter.emit(STATE_EVENTS.DAY_TICK, this.state.currentDay);

$ python -c "import io,re;s=io.open('src/renderer/state/dayPipeline.ts',encoding='utf-8').read();ids=re.findall(r\"'([a-zA-Z]+)'\",re.search(r'DAY_PHASE_ORDER: readonly DayPhaseId\[\] = \[(.*?)\];',s,re.S).group(1));print('calendarEvents is phase #%d of %d'%(ids.index('calendarEvents')+1,len(ids)))"
calendarEvents is phase #4 of 22
```

即：`currentDay` 已在 `tickDay` 前置步 +1（`:945`），但 `production`(#5)、`decrees`(#7)、`population`(#11)、`starvation`(#13)、`crisis`(#14)、`grade`(#15)…**后面 18 个阶段尚未跑**。此刻收到 `DAY_TICK` 的订阅者，读到的是「**新日期 + 旧世界**」。

### 4. 二次实证：HUD 确实会同帧显示不一致

```
$ rg -n "onDayTick = " src/renderer/ui/HUD.ts
124:  private onDayTick = (): void => { this.refreshDate(); this.refreshCraftResources(); };
```

`refreshDate()` 读新 `currentDay`，`refreshCraftResources()` 读尚未结算的资源 ⇒ **不是理论风险，是可目检的错位**。（注意：`getState()` 在 `ui/`+`scenes/` 非测试代码里只出现 **2 次**，面板普遍走 `getResources()` / `getCurrentDay()` 等**实时轻 getter**，实测计数 8/5 次；所以契约探针**必须同时覆盖 getter 路径**，只测 `getState()` 会漏掉真正的消费面。）

### 5. 另一个方向的风险：`sentimentSettle`(#22) 在日末改 `publicWrath` 并发 `WRATH_ALERT`

`:2313-2321` 在最后一个阶段里判定怨愤、强推阶层诉求、调 `runUltimatumPhase()`，然后 `:2323-2324` 才做怨愤自然回落。**任何"日末 flush"都会把这个 #22 的事件推到所有订阅者面前、且晚于 DAY_TICK** ⇒ 现状「先 DAY_TICK 后 WRATH_ALERT」的相对顺序会被**反转**。这是方案 B 最硬的一条兼容性代价（§三.3）。

## 二、订阅者清单（完成标准 ① 要求逐件 file:line）

```
$ rg -n "\.on\(STATE_EVENTS\." src --glob '!**/__tests__/**' -c | sort -t: -k2 -rn
UIScene.ts:20  HUD.ts:14  AudioManager.ts:12  PolicyTreePanel.ts:9  JitHintManager.ts:9  GameScene.ts:9
BuildPanel.ts:7  MilitaryPanel.ts:6  StoryBar.ts:5  MegaProjectPanel.ts:5  DiplomacyPanel.ts:5
ProductionPanel.ts:4  GradePanel.ts:4  EventModal.ts:4  ScoreCardPanel.ts:3  PopulationPanel.ts:3
FactionDemandModal.ts:3  TutorialModal.ts:2  CrisisModal.ts:2  ZoomControl.ts:1  Legend.ts:1  BuildingPopover.ts:1
=> 22 个订阅文件 / 129 个 .on 订阅点；STATE_EVENTS 共 55 个事件键
```

**直接暴露于日内批界问题的核心受众 = 11 个 `DAY_TICK` 订阅者**（全部在 `ui/`，全部是"刷新"语义，**没有一个是逻辑消费者**）：

```
$ rg -n "\.on\(STATE_EVENTS\.DAY_TICK" src --glob '!**/__tests__/**' -c | wc -l
11
```

`EventModal.ts:136`、`DiplomacyPanel.ts:141`、`MilitaryPanel.ts:80`、`GradePanel.ts:117`、`MegaProjectPanel.ts:107`、`HUD.ts:190`、`PopulationPanel.ts:107`、`ScoreCardPanel.ts:129`、`PolicyTreePanel.ts:199`、`ProductionPanel.ts:144`、`StoryBar.ts:72`
（逐个 `off` 站点：`:355 / :399 / :306 / :284 / :261 / :765 / :222 / :229 / :781 / :350 / :165` —— **on/off 严格成对，22 文件 129 点无成对缺口**，这是 B 方案能安全落地的前提之一。）

`SEASON_TICK` / `YEAR_TICK` 另有一批订阅者（如 `HUD.ts:195-196`、`EventModal`），同属 #4 发出，问题与 `DAY_TICK` 同源。

## 三、方案 A：各阶段末发显式阶段边界事件

### A.1 伪码

```ts
// dayPipeline.ts —— 不动 DAY_PHASE_ORDER，只在执行器里插边界
export interface DayPhaseBoundary {
  readonly index: number;          // 0..N-1
  readonly id: DayPhaseId;
  readonly domain: DayPhaseDomain;
  readonly total: number;          // 22
}
export function runDayPipeline(
  phases: readonly DayPhase[],
  onBoundary?: (b: DayPhaseBoundary) => void,   // 可选注入，缺省＝零行为变化
): void {
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;                    // noUncheckedIndexedAccess: 判空
    phase.run();
    onBoundary?.({ index: i, id: phase.id, domain: phase.domain, total: phases.length });
  }
}
```

`tickDay` 侧把 `onBoundary` 接到 `emitter.emit(STATE_EVENTS.DAY_PHASE_END, b)`（新增事件键，55→56）。

### A.2 兼容面

- **旧订阅者零改动、零行为变化**：新增事件名，无人监听即无人受影响。129 个 `.on` 点一个不碰。
- `dayPipeline.test.ts` 现有 4 组断言（`:56/:57/:65-72/:74/:79-86`）**全部不受影响**——`:79` 记的是 `phase.run()` 往 `order` 里 push 的 id 序列，与边界回调无关。
- 🔴 **但 A 不满足本契约**：它只是把"你现在站在第几阶段"**披露**给订阅者，`DAY_TICK` 仍在 #4 发、HUD 仍读旧资源。要把契约变成**保证**，必须额外把 `DAY_TICK` 移到 #22 之后——那一步才是改行为，A 本身不动它。
- 结论：**A 是观测手段，不是契约**。它的价值是给 B 的迁移期提供可断言的锚（探针可以先监听边界来判定"我到底在第几阶段被叫起来的"）。

## 四、方案 B：日内事件批处理队列，`tickDay` 收尾统一 flush

### B.1 伪码

```ts
// gameStore.ts
private batchDepth = 0;
private readonly pending: Array<{ ev: string; payload: unknown }> = [];

/** 唯一的 emit 出口：批处理开则入队，关则直发。 */
private emitNow(ev: string, payload: unknown): void {
  if (this.batchDepth > 0) this.pending.push({ ev, payload });
  else this.emitter.emit(ev, payload);
}

/** 只有 tickDay 用。阶段外的 43 个 emit 站点因此保持立即生效。 */
private beginBatch(): void { this.batchDepth += 1; }
private endBatch(): void {
  this.batchDepth -= 1;
  if (this.batchDepth > 0) return;               // 嵌套：由最外层统一 flush
  const drained = this.pending.splice(0);        // 先清空再派发＝天然防重入放大
  for (const e of drained) this.emitter.emit(e.ev, e.payload);
  // ⚠ 回调里若再改状态：batchDepth 已回 0 ⇒ 直发（递归自然终止）；
  //   是否要"再排一轮直到收敛"属语义裁决，见 B.3-R3。
}

tickDay(): void {
  // ... 前置步 :941-946 不变（currentDay +1 与日历比较）...
  this.beginBatch();
  try {
    runDayPipeline(buildDayPipeline({ /* 22 个 handler，:949-970 不变 */ }));
  } finally {
    this.endBatch();                             // 🔴 必须 finally：阶段抛错也不能把事件永久压在队列里
  }
}
```

### B.2 效果

`DAY_TICK` 的**发出时刻**从 #4 之后挪到 #22 之后，且所有 37 个日内事件按**原相对顺序**在日末一次性派发 ⇒ 订阅者任何一次回调里读到的都是**整日结算完**的状态。**契约由"披露"升级为"保证"。**

### B.3 兼容性代价（逐条，含最硬的一条）

| 风险 | 说明 | 严重度 |
|---|---|---|
| **R1 相对顺序反转** | 现状：`DAY_TICK`(#4) 早于 `WRATH_ALERT`(#22)。B 之后 `WRATH_ALERT` 与 `DAY_TICK` 都进队列，**队列内顺序仍是 DAY_TICK → WRATH_ALERT（按产生序）**，但与**阶段外直发事件**的相对顺序会变。例：#22 里 `adjustWrath()`(`:2324`) 发的 `WRATH_CHANGED` 会入队，而用户此刻若点 `placeBuilding`（直发 `BUILDING_PLACED`）则先于全部日内事件到达 ⇒ **跨类事件的时序不再总可线性化** | 🔴 高：需人工判定是否可接受 |
| **R2 阶段内"emit 后紧接读"的自依赖** | 37 个日内 emit 里有 `MODIFIER_ADDED/REMOVED`(#1、#2) 与 `PRODUCTION_TICK`(#5)。若任何**后续阶段**间接依赖"前面阶段的事件已送达订阅者"，B 会破坏它 | 🟡 中：**未坐实**——需实现期逐个查。已知 `runUltimatumPhase` 由 `runSentimentSettlePhase` 内联直调(`:2321`)，**不依赖事件总线**，这一处是安全信号 |
| **R3 重入语义** | flush 期间订阅者回调再调 store 写方法（`HUD`/`EventModal` 都可能），batchDepth 已 0 ⇒ 直发 ⇒ 可能再触发 flush 里的后续事件派发。是否要"排到收敛"属裁决 | 🟡 中 |
| **R4 离线补日的放大** | `timeSystem.ts:29` 在**一帧内 while 循环**补 `tickDay`（注释自述"补几百个 tickDay"）。B 保持"每日 flush 一次"⇒ 帧内事件总量不变（**非改善**）。若想让补日只 flush 最后一次，那是**另一个行为改动**（toast 从几百条变 1 条），**刻意排除在本契约外**，须另单 | 🟡 中：明确划出边界 |
| **R5 异常路径** | 阶段抛错时未 flush ⇒ 事件永久丢失。伪码已用 `finally` 兜住；另需决定"抛错日的事件到底发不发" | 🟢 低：可判 |
| **R6 payload 时效** | 事件 payload 多已带具体值（如 `DAY_TICK` 带 `currentDay`、`WRATH_ALERT` 带 text），**入队不影响**；但 `RESOURCES_CHANGED` 的 `{ deltas }`(#5 与 #22 都会发) 若被 UI 合并处理，延迟到日末反而更正确 | 🟢 低：正向 |

### B.4 预估红数（**只给口径与下界，不报虚构读数**）

⚠ 本单不实现 ⇒ **无法给出实测红数**。可复算的影响面下界：

```
$ rg -l "DAY_TICK" src/renderer/state/__tests__ src/renderer/ui/__tests__ src/renderer/scenes/__tests__
gameStore.test.ts  typedEvents.test.ts  timeSystem.test.ts  + ui/scenes 侧 3 件  => 6 件直接引用 DAY_TICK

$ rg -l "invocationCallOrder|mock\.calls|emitOrder" src/renderer/state/__tests__ src/renderer/ui/__tests__ src/renderer/scenes/__tests__ | wc -l
15                                => 15 件测试件对「调用顺序/次数」敏感，是 B 的红名候选池
```

- **下界 6 件**（直接引用 `DAY_TICK` 的测试件）；**候选池 15 件**（对 mock 调用次序敏感的测试件）。
- 真实红数**必须**在实现第一步跑 `npx vitest run` 才能定，且要先排除并发干扰（colony 基线 134 文件 / 1416 例，含未跟踪件，别按 numstat 反推）。
- 另 `typedEvents.test.ts` 是**事件键清单型**门禁（55 键），A 方案新增 `DAY_PHASE_END` **必红该件** ⇒ 属"两笔一体"：新事件名与其记账行必须同 commit，不可只加不改账。

## 五、契约测试的写法（完成标准 ②：探针 + 快照一致性断言）

核心难点：**探针必须能区分"日末整量"与"日内半量"**。做法是给探针一个"只在特定阶段会不一致的字段对"作为 witness。选 **`currentDay` vs 资源结算**这一对（§一.3 的实证对），它天然横跨 #4 与 #5。

### 5.1 探针伪码

```ts
// src/renderer/state/__tests__/dayPhaseBatchContract.test.ts
import { EventEmitter } from 'eventemitter3';

interface Witness { day: number; grain: number; wrath: number; seenPhaseIndex: number | null }

it('契约：DAY_TICK 订阅者不得读到半更新日状态', () => {
  const store = new GameStore(new EventEmitter() as unknown as IEventEmitter, {
    worldMap: allPlainMap(),
    resources: { grain: 0 },
    // 造一个「working 产粮建筑」使 production(#5) 必然改变 grain
    buildings: [workingGrainBuilding()],
  });
  const observed: Witness[] = [];

  // 探针 1：DAY_TICK 订阅者——必须在日末才 sees 到一致态
  store.on(STATE_EVENTS.DAY_TICK, () => {
    const s = store.getState();                          // 深拷贝，冻结当下时刻
    observed.push({
      day: s.currentDay, grain: s.resources.grain ?? 0, wrath: store.getPublicWrath(),
      seenPhaseIndex: currentPhaseIndexProbe.value,     // A 方案的边界事件提供；B 落地后可删
    });
  });

  store.tickDay();

  const w = observed[0]!;
  // 断言 A：日期已推进，则当日产出必须**已经入账**（半更新的直接反证）
  expect(w.grain).toBeGreaterThan(0);
  // 断言 B：探针看到的 day 与 store 日末的 day 相同 ⇒ 没有读到"未来日期+过去世界"
  expect(w.day).toBe(store.getState().currentDay);
  // 断言 C：契约要求"一个 tickDay 只通知一次"
  expect(observed.length).toBe(1);
});
```

### 5.2 为什么这样断言有判别力（**不是恒真**）

- `grain > 0` 能区分：现状（#4 发 DAY_TICK，#5 未跑）⇒ 探针读到 `grain === 0` ⇒ **红**；B 落地 ⇒ `grain > 0` ⇒ 绿。
- 🔴 **反例警示（本仓在册失效模式）**：断言不能写成"两次 `getState()` 相等"式自比——`colony-plan-ledger` 在册的 `calendar.test.ts:21`「跨文件一致」断言在四季表唯一化后**比的是同一个对象＝恒真失效**。本探针两条读的是**不同时刻**（回调内 vs `tickDay` 后）的两次独立克隆，且 witness 字段由**另一个阶段**产生，**不同源**，因此具备判别力。写测试时必须守住这一点：**被断言的值不得由产生它的那个阶段自己读出**。
- 变异自证（必配）：临时把 `runCalendarEventsPhase` 的 emit 从 `:1052` 挪到 `tickDay` 末尾，断言必须**由绿变红再变绿**；若不动则测试是假绿。参照 §廿三「写探针必配鉴别力自证」。

### 5.3 落地次序建议：**先落契约测试，再改行为**

契约测试在现状下**必红** ⇒ 直接进全量会红基线。三种收容方式，**均需人工选**：

- (a) `it.fails(...)` 显式声明"这是已知违约" ⇒ 现状绿、实现 B 后**反而红**（因为不再违约），逼实现者回来删 `it.fails`。**推荐**，因为它把"改行为"与"删豁免"钉成同一笔，不留静默窗口。
- (b) `describe.skip` + 台账登记 ⇒ 有实现完忘记摘的风险（本仓 `drift_tracker` 式"有测试但整件跳过"的在册假象即此模式）。
- (c) 契约测试与 B 实现同 commit ⇒ 最干净，但要求"改行为"先获放行。

## 六、推荐与迁移分步

### 推荐：**A 先行作观测，B 收窄落地；两者不互斥**

1. **A 单独上**：零行为变化、零破坏，得到 `DAY_PHASE_END` 观测能力，且给契约测试提供"我在第几阶段被叫起来"的直接断言手段。**这一步可以今天就做，不需裁决。**
2. **B 的收窄版上**：批处理**只包住 `tickDay` 调用栈内到达 emit 唯一出口的事件**（靠 `batchDepth` flag ⇒ **含 §一.2 所说"经 helper 间接发出"的那一批**，不能按"是否阶段方法"判断）；`tickDay` 之外的 43 类站点（用户输入 / 读档）继续直发；flush 点固定在 `runDayPipeline` 返回后的 `finally`（§四 B.1）。**不动 22 阶段顺序、不动 payload 形状、不合并同类事件**——这三条"顺手优化"全部排除，各有独立行为后果（尤其 R4 的 toast 合并）。
3. **R1 的顺序反转必须先裁**：`WRATH_ALERT`(#22) 与 `DAY_TICK`(#4) 现在"日期通知在前、民怨警示在后"；B 后仍保持产生序，但与直发类事件不再可线性化。**若人工判定 UI 需要严格线性时序，则 B 必须扩展为"全局单队列 + 帧末 flush"，那是更大的一刀。**

### 迁移分步（每步都可独立回退）

| 步 | 动作 | 判据 | 是否需放行 |
|---|---|---|---|
| 1 | 落 A：`runDayPipeline` 加可选 `onBoundary` 注入 + `DAY_PHASE_END` 事件键 | 全量绿；`typedEvents.test.ts` 同笔补记账 | 否（零行为） |
| 2 | 落契约测试（§5.1）+ 变异自证，按 §5.3(a) 用 `it.fails` 收容 | 全量仍绿；删 `it.fails` 后必红（证明探针有牙） | 否 |
| 3 | 落 B 的 `emitNow`/`beginBatch`/`endBatch`，**flag 默认关** | `type-check` rc=0 ＋ 全量绿（行为应逐位不变） | 否 |
| 4 | `tickDay` 接线开 flag ⇒ 跑全量，**逐条比对红名集** | 红名必须可全部归因到 R1/R2/R3 三条已知代价；出现第 4 类即回退 | 🔴 **是** |
| 5 | 目检 HUD/GradePanel：日期与资源同帧一致（§一.4 实证点） | 人工截图；静态测不到 | 🔴 **是** |
| 6 | 删 A 的 `onBoundary`（或保留为长期观测），契约测试去 `it.fails` | 全量绿 | 否 |

**步骤 4/5 是本设计的裁决闸口**：在此之前全部是零行为改动，可放心做；跨过之后即"改日序语义"，须放行。

## 七、本单不做什么（划界）

- 不改 `DAY_PHASE_ORDER`（22 阶段顺序一字不动，`:56/:57/:65-72/:79-86` 四组守卫继续钉它）。
- 不改任何 emit 的 payload 形状、不合并同类事件、不改 `timeSystem` 的补日策略。
- 不碰经济平衡数值：`production`/`starvation`/`crisis` 各阶段的产出、消耗、阈值一个未动（本单零代码改动）。
- 不动 22 个订阅文件（129 个 on 点）的 on/off 配对。
