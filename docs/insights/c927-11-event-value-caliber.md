# c927-11 事件 random 触发 value 范围校验：产品口径裁决材料

- 工单：`c927-11`（cwd `D:\code\colony-game`，软预算 ≤20 分钟）
- 班次：`qoder-executor-20260927-1820-colony40`（波次 22 只读采集班）
- 取证时点：2026-09-27 18:1x–18:2x；仓现值 HEAD `27c00b0`，`git status --porcelain -- src/` ＝ 0 行
- 锚点：`done/20260925-120439-1394.result.md:27`（`outbox/` 无此件，按 brief §3a 到 `done/` 取，3,584 B，mtime Sep 26 00:23）——原文「事件 random 触发的 value 范围校验未加（DSL 解析走 validateDslExpr 已覆盖 condition 面；value 语义宽，需产品口径后再收）」⇒ **锚点在世且成立**，本单不否证它，只把"语义宽"具体化
- **红线自觉**：概率值本身＝玩法/经济平衡数值 ⇒ 本档**不评"某个事件的概率该设多少"**，只界定"什么形态算非法配置"。任何调参建议不在此单范围（人工闸）。

---

## 0. 结论速览

1. **现役静态数据零风险**：47 处 random 触发的 value 全落在 `[0.04, 0.15] ⊂ (0,1)`，形态高度齐一（全部是 `{ condition: 'random', value: 0.0N }` 字面量，无缺省、无字符串、无变量）。⇒ 单纯加"界"对现役静态数据**零误伤**。
2. **但有一个必须先看一眼的例外，否则"加校验"会当场打掉古迹链**：`src/renderer/state/gameStore.ts:445` 的 `triggers: [{ condition: 'random', value: 0 }]` 是**语义位不是概率**——`:435` 注释写明「trigger 概率 0，只由 pendingEventId 显式唤起」。它由 `buildRelicEvents()` 在运行时逐 relic stage 合成。所幸现役启动校验只扫静态数组（`data/index.ts:33-39` ← `main.ts:164`、`BootScene.ts:23`），**不覆盖这批合成事件**⇒ 只要把校验加在 `validateCourtEvent`（启动面）就伤不到它；**一旦加在消费点（`eventEngine.ts:85-89`）就会全线拦死古迹链**。这是本案唯一的真误伤面，也是三案分野的地方。
3. **最坏的失败模式不是"越界"，是 NaN 被当成"恒触发"**：消费端 `eventEngine.ts:87` `const p = t.value ?? 0; if (metrics.rng() >= p) return false;`，而 `metrics.rng()` 是 mulberry32、值域 `[0,1)`（`src/renderer/state/rng.ts:15-23`）。⇒ `p = NaN` 时 `rng() >= NaN` 恒为 **false** ⇒ **不 return，判为通过** ⇒ 一个配坏的值让事件**每天必刷**；而 `p >= 1` 同样恒触发。方向上"配错＝更常触发"是最糟的静默口，**不管口径选哪案都该单独收掉**。

---

## 1. 判据①：random value 形态清单（全 src 穷举）

### 1a. 注册点普查

| 来源 | 处数 | 形态 | 取值 |
|---|---|---|---|
| `src/renderer/data/events.ts` | 7 | 字面量 `value: 0.0N` | `:13 0.15 / :65 0.10 / :100 0.08 / :134 0.06 / :170 0.05 / :205 0.10 / :240 0.07` |
| `src/renderer/data/eventsExpanded.ts` | 40 | 同上 | 见 1b 分布 |
| `src/renderer/state/gameStore.ts:445` | 1（×运行时逐 relic stage 复制） | **`value: 0` 语义位** | 0（永不随机触发，靠 `pendingEventId` 显式唤起） |
| 合计 | **48** | | |

静态 47 处的取值分布（`grep -rhoE "condition: 'random', value: [0-9.]+" | sort | uniq -c`）：

```
0.04 ×1    0.05 ×6    0.06 ×8    0.07 ×7    0.08 ×12
0.09 ×2    0.10 ×8    0.12 ×2    0.15 ×1    （Σ=47，min=0.04，max=0.15）
```

测试夹具面（`__tests__` 内，不进启动校验）：`value: 0.5` ×4、`value: 1` ×1 ⇒ **1.0 已在测试面被使用**。

### 1b. 类型面与消费面（"语义宽"具体在哪）

| 面 | 位置 | 现状 | 后果 |
|---|---|---|---|
| 类型 | `src/renderer/data/schema.ts:204-208` `CourtEventTrigger { condition: string; value?: number }` | `value` **可选**、无上界下界、`number` 允许 NaN/Infinity | TS 只挡得住"写了个字符串"，挡不住 0/负数/1.5/NaN |
| DSL 校验 | `src/renderer/data/modifierValidator.ts:91-103`（`validateCourtEvent` 只 `validateDslExpr(t.condition)`） | `'random'` 被 `dslCore.ts:189` `if (expr === 'random') return;` **显式跳过**，value **完全不看** | 锚点说的"condition 面已覆盖、value 面未加"＝此二者 |
| 消费 | `src/renderer/state/eventEngine.ts:85-89` `const p = t.value ?? 0; if (metrics.rng() >= p) return false;` | `?? 0` 只兜 null/undefined；无 clamp、无上界、无 NaN 守卫 | 见 §1c 语义表 |
| RNG 值域 | `src/renderer/state/rng.ts:15-23`（mulberry32 `/ UINT32_SIZE`） | `[0,1)` | 决定 §1c 每一行的判据 |

### 1c. `p` 的取值→实际语义对照（由 `rng() ∈ [0,1)` 推，全部可手验）

| 写入的 value | 实际行为 | 是否符合直觉 |
|---|---|---|
| 缺省（undefined） | `?? 0` ⇒ **永不随机触发**（保守，与 `:86` 注释一致） | 符合（但"忘了写"与"故意不设概率"不可区分） |
| `0` | 永不随机触发（现役**语义位**，relic 链靠 pendingEventId 唤起） | **现役唯一合法例外** |
| `0 < p < 1` | 概率 p（现役 47 处全在此） | 符合 |
| `1` | 恒触发（`rng()` 取不到 1） | 符合但"每天必刷"通常不是本意；测试面已用 1 |
| `> 1` / `Infinity` | 恒触发 | 与 1 不可区分 ⇒ 配错被吞 |
| 负数 | 永不触发 | 与 0 不可区分 ⇒ 配错被吞 |
| `NaN` | **恒触发**（`rng() >= NaN` 为 false ⇒ 不 return false） | 🔴 **反直觉且最坏**：配错方向是"更常触发" |

⇒ 需要产品裁的本质是三个问题：①`0` 是不是合法概率语义（现役依赖它当"手动唤起"旗标）；②`1`／`>1` 是否允许存在（现役静态数据没有，测试面有）；③NaN/Infinity 这类非有限值必须怎样（这条几乎不需要裁决，只需承认它是缺陷）。

---

## 2. 判据②：误伤面分析（加校验会拦住哪些现役合法值）

| 拟加规则 | 拦住的**静态现役** | 拦住的**运行时合成事件** | 拦住的**测试夹具** | 备注 |
|---|---|---|---|---|
| `0 < p ≤ 1`（严格下界） | **0 处** | `gameStore.ts:445` 的 relic 链（若校验覆盖到消费点则**全拦**） | `value:1` 那例仍过 | 下界 0 是最危险的一笔：古迹链的设计前提就是 0 |
| `0 ≤ p ≤ 1`（含端点） | **0 处** | 不拦（relic 的 0 合法） | 全过 | §0 结论 1＋2 的合取 |
| 白名单枚举（如 0.05/0.06/0.08/0.10 网格） | **6 处**：`0.04×1、0.09×2、0.12×2、0.15×1` | — | `0.5`、`1` 两形态全拦 | 误伤最大；且把平衡调参锁进校验器，每次改概率都要动校验器 |
| 上界收紧为 `p ≤ 0.5` | 0 处 | 不拦 | `value: 1` ×1 拦 | 现役用不到，但会禁掉"恒触发"这一合法调试态 |
| `Number.isFinite(p)`（只堵 NaN/Inf） | 0 处 | 不拦 | 全过 | 纯防御，零误伤，直接封掉 §1c 最后一行 |
| 要求 `value` 必填（去 optional） | 47 处全过 | relic 那 1 处也过（它写了 0） | 需查所有测试是否都写 value | 类型面改动，编译期即红，非运行期 |

**关键结构性结论（决定了"加在哪"比"加多严"更重要）**：

- 现役启动校验链＝`main.ts:164`／`BootScene.ts:23` → `data/index.ts:33 validateStaticData()` → `modifierValidator.ts:146 validateAllStaticData({policies,events,decrees})` → `:152 data.events.forEach(validateCourtEvent)`。它吃的是**静态 `EVENTS` 数组**。
- relic 合成事件走 `gameStore.ts:431-432` `this.events = [...this.baseEvents, ...this.buildRelicEvents()]`，**晚于且不进**该校验链。
- ⇒ 「把 random value 校验加在 `validateCourtEvent`」＝对现役数据零误伤、对 relic 链零波及（但**也管不到** relic 链，覆盖不完整）；「加在 `allTriggersPass` 消费点」＝**当场打死古迹链**，除非给 `value: 0` 开例外或给它一个显式旗标字段（后者属 schema 扩展＝写单）。
- 另注：启动校验被调用**两次**（`main.ts:164` 与 `BootScene.ts:23`），与本案判据无关但登记在此，供将来查"为什么抛错出现在两处栈"。

---

## 3. 判据③：口径建议三案

| 维度 | **案 A：白名单枚举合法概率** | **案 B：界限 + 非有限值守卫（推荐）** | **案 C：不加校验，只在消费点兜底** |
|---|---|---|---|
| 规则形状 | `value ∈ {0.05, 0.06, 0.08, 0.10, …}`（人工列） | `Number.isFinite(value) && 0 ≤ value ≤ 1`，`undefined` 单列（视为"手动唤起旗标"或视为待补） | `p = clamp(value ?? 0, 0, 1)` ＋ 非有限值 `console.warn` 后按 0 处理 |
| 挂载点 | `validateCourtEvent`（启动面） | `validateCourtEvent`（启动面）**＋** 决定 relic 链是否纳入校验（见下"要一并裁的") | `eventEngine.ts:87` 一行 |
| 拦住的现役 | **6 处静态事件当场抛错、游戏不能启动** | 0 处 | 0 处 |
| 误伤/波及 | 最大：把平衡调参变成"改两处"（数据＋校验器），且未来任何新概率先要过白名单 | 最小；代价是**没定义"配成 0 与忘了写如何区分"** | 无（但 NaN→恒触发被 clamp 顺手治好，"忘了写 value"继续静默） |
| 能否挡未来事故 | 能，但对 NaN/Infinity 反而不敏感（它们不在白名单里＝能挡，OK） | 能挡越界与非有限两类 | 只挡"崩"，不暴露配错（warn 不进门禁） |
| 回归面（测试） | 需查所有断言事件概率的测试；现役测试夹具 `0.5`/`1` 两形态**当场红** | 需为校验器加正/负例（含 NaN、-0.1、1.5、undefined、relic 的 0）；不动既有断言 | 若加 warn 断言则新增 1 例；不动既有 |
| 门禁 | 改 `src/` ⇒ pre-commit 跑 type-check＋全量（约 40–60 秒） | 同 | 同 |
| 与红线关系 | **不采**：白名单等于替产品定"允许的概率档位"，属玩法平衡数值口径（人工闸） | 界限是**类型/配置合法性**，不涉平衡取值 ⇒ 不碰红线 | 消费点兜底不涉平衡取值 |
| 一句话 | 用"合法值集合"表达口径，最严但把平衡决策焊进校验器 | 用"合法区间＋非有限守卫"表达口径，覆盖两类真风险且零误伤 | 最低成本，但放弃"启动即抛"的既有设计哲学 |

### 3a. 推荐：案 B（含一条附带动作）

推荐口径措辞（给裁决用）：

> `random` 触发的 `value` 合法域定为 **有限数且 `0 ≤ value ≤ 1`**；`0` 合法但语义是"不参与随机抽取，仅由显式唤起（pendingEventId）触发"，**必须与"忘了写 value"可区分**——故 `undefined` 在静态事件面上判为非法（写 `0` 表达"手动"），运行时 relic 合成事件走同一断言即自然合规。校验加在 `validateCourtEvent`（启动面，`main.ts:164`／`BootScene.ts:23` 两条入口已覆盖），**不加在 `allTriggersPass` 消费点**（会波及 relic 链）。
> 附带单独修一条与口径无关的缺陷：`eventEngine.ts:85-89` 对 `NaN/Infinity` 无守卫，`rng() >= NaN` 恒 false ⇒ **配坏的值会让事件每天必刷**；建议消费点加 `Number.isFinite(p)` 短路（属 `src/` 改动＝另开写单，本档只登记）。

**要一并裁的两个小问题**（不裁就会留下不一致口径）：

1. 静态事件里"故意永不随机、只由代码唤起"是否**允许**（若允许，则 `undefined` 判非法而 `0` 判合法，正好是上面那句话；若不允许，relic 链需要新字段如 `manualOnly: true`＝schema 扩展）。
2. `value: 1`（恒触发）是否允许进静态数据：测试面已在用 `1`；若裁"静态事件不许 1"，须同步那 1 例夹具。

### 3b. 落 BACKLOG 的拟登记条目（文本备好，本班**未写**，因该文是外部在途脏件且登记＝裁决动作）

> `[待裁] 事件 random 触发 value 范围校验（c927-11）：现无校验（`modifierValidator.ts:91-103` 只看 condition，`dslCore.ts:189` 显式跳过 'random'）。口径三案见 `docs/insights/c927-11-event-value-caliber.md §3`；推荐案 B＝`0 ≤ value ≤ 1 且 Number.isFinite`，加在启动面。附缺陷 1 条：`eventEngine.ts:87` 对 NaN 无守卫 ⇒ 配错值反而恒触发。现役 47 处静态取值全在 [0.04,0.15]，加界零误伤；`gameStore.ts:445` 的 `value: 0` 是语义位（relic 链），不可被下界 `>0` 拦。`

---

## 4. 取证命令（可复算）与零码改动自证

```
$ grep -rn "condition: 'random'" src/ --include=*.ts | grep -v __tests__ | awk -F: '{print $1}' | sort | uniq -c
      7 src/renderer/data/events.ts
     40 src/renderer/data/eventsExpanded.ts
      1 src/renderer/state/gameStore.ts
$ grep -rn "condition: 'random'" src/ --include=*.ts | grep -v __tests__ | wc -l
48
$ grep -rhoE "condition: 'random', value: [0-9.]+" src/renderer/data/*.ts | grep -oE "[0-9.]+$" | sort -n | uniq -c
（§1a 分布；Σ=47）
$ grep -rn "condition: 'random'" src/ --include=*.ts | grep __tests__ | grep -oE "value: [^,}]+" | sort | uniq -c
      4 value: 0.5 /      1 value: 1
$ sed -n '435p;445p' src/renderer/state/gameStore.ts        # relic：概率 0 ＝ 只由 pendingEventId 唤起
$ sed -n '85,89p' src/renderer/state/eventEngine.ts         # const p = t.value ?? 0; if (metrics.rng() >= p) return false;
$ sed -n '15,23p' src/renderer/state/rng.ts                 # mulberry32，返回 [0,1)
$ sed -n '204,208p' src/renderer/data/schema.ts             # value?: number（可选、无界）
$ sed -n '91,103p;146,154p' src/renderer/data/modifierValidator.ts   # 启动校验只看 condition；入口 validateAllStaticData
$ sed -n '189p' src/renderer/data/dslCore.ts                # if (expr === 'random') return;  ← 显式跳过
$ grep -rn "validateStaticData" src/ --include=*.ts | grep -v __tests__   # main.ts:164 ＋ BootScene.ts:23 两个调用点
$ git status --porcelain -- src/ | wc -l
0
```

未跑 type-check、未跑任何测试（并发窗禁跑全量；本单判据不含运行时读数，§1c 表由 `rng()` 值域与一句比较的语义推得，采方案时须实跑复核 NaN 行为）。

## 5. 遗留问题

1. **口径未拍**（§3 三案选一＋§3a 两个小问题）⇒ 本档只出材料，任何 `src/` 改动属写单。
2. **NaN 恒触发这条不依赖口径**，可单独开修单（`eventEngine.ts:87` 一行守卫）；本班会否把它误报为"缺陷"？——它**不是**现役缺陷（现役 48 处无 NaN 源），是"未来配错时的最坏方向"，措辞已按此收严。
3. **启动校验被调两次**（`main.ts:164`、`BootScene.ts:23`）：与本单判据无关，但意味着新加的 value 抛错会在两处栈里都出现，排错时别当成重复计数。
4. `validateCourtEvent` 不覆盖运行时合成事件（relic 链）⇒ 若裁"必须覆盖"，需把校验点后移或让 `buildRelicEvents()` 自证，属设计改动。
5. 本单未碰 `D:/colony-game/user-data/saves`（真存档目录）与任何存档读写路径；无 tmp 残留（本单无需复现件，未建目录文件）。
