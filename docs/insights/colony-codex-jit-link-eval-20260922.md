# colony CodexPanel × JIT 联动最小接线评估（c922-120，2026-09-22）

> **性质：工程评估＋可实施方案设计，零实施。** 未改 `jitHints.ts`／`Toast.ts`／`CodexPanel.ts`／`JitHintManager.ts`／`UIScene.ts` 任何一行。
> 班次 `qoder-executor-20260922-0000-colony9`；HEAD `3f1c8d2`。

## 一、结论先给

**「JitHint 加 `codexTopic` 字段」不是成本所在，成本全在承载体上**：JIT 提示走的是 `Toast`，而 `Toast` 实测**完全不可交互**（只有 graphics＋text，5.2s 定时自毁，且后一条覆盖前一条），在其上加「详见典册」跳转按钮**超出 ≤30 行级**，且该组件有 **25 个生产调用点**。

⇒ 推荐**方案 C**（§五）：不动 `JitHint` 数据结构、不动 `TOPICS`，给 `Toast.show()` 加一个**向后兼容的可选尾参**（25 个现存调用点零改动），跳转表放在 `JitHintManager` 模块内。预估 **约 32 行**（略超 30，同量级）。

**并且必须先纠一条在册假象**：`pickJitHint` 在生产侧**零调用**（§二）。任何「给 pickJitHint 的返回对象加字段、它就自然带上」的默认设想会直接落在死码上。

## 二、锚点复核 ＋ 触发密度现状

### 2.1 三处锚点全部未漂（逐字）

| 锚点 | 磁盘 |
|---|---|
| `src/renderer/data/jitHints.ts:33` `export const JIT_HINTS: Readonly<Record<JitTrigger, JitHint>> = {` | 命中 |
| `src/renderer/data/jitHints.ts:54` `export function pickJitHint(trigger: JitTrigger, seen: ReadonlySet<string>): JitHint | null {` | 命中 |
| `src/renderer/ui/CodexPanel.ts:110` `export class CodexPanel {` | 命中 |

行尾实测（改动批照此拼，勿照抄「CRLF」笼统说法）：`jitHints.ts` **纯 CRLF 57/57**、`Toast.ts` **纯 CRLF 77/77**、`CodexPanel.ts` **纯 CRLF 226/226**、`JitHintManager.ts` **纯 CRLF 80/80**。四个目标文件一致，无混用。

### 2.2 `pickJitHint` 消费点全列（完成标准点名命令）

```
$ rg -n "pickJitHint" src/ --glob '!**/__tests__/**'
src/renderer/ui/JitHintManager.ts:12:  * 选择/去重逻辑在纯函数 pickJitHint + store.markJitHintSeen，本类只做事件→trigger 的接线。
src/renderer/data/jitHints.ts:54:      export function pickJitHint(...)
```

**两条都不是调用**：`:54` 是定义，`:12` 是类注释。补跑全仓（含测试）才看到真正的调用方只有它自己的测试：

```
$ rg -n "pickJitHint" src -g '*.ts'
   ＋ data/__tests__/jitHints.test.ts:2 (import) / :4 (describe) / :6 / :12
```

⇒ **生产侧零调用，函数是死码，但被测试钉着。** 生产真闸门是 `JitHintManager.ts:25` 的 `if (!this.store.markJitHintSeen(trigger)) return;`，其 `:23-24` 注释自述了换闸理由（「避免'先 pick 后 mark'两段式在理论上重复弹」）。⇒ `pickJitHint` 的 `seen` 参数语义**不在生产路径上被验证**：`jitHints.test.ts` 全文件 3 例，其中 **2 例（`:5` 未 seen 返回提示／`:11` 已 seen 返回 null）只测这条死路径**，另 1 例（`:14` 逐 trigger 校验 `JIT_HINTS[k].trigger===k` 且文案 >4 字）测的是活数据、有守护价值。这条属在册假绿面，本单只登记不修（删死码只连带 `:5/:11` 两例，`:14` 应留）。

### 2.2b `seenJitHints` 是跨系统复用的共享命名空间（本单不新增耦合，但影响收益判断）

```
$ rg -n "seenJitHints" src -g '*.ts' -g '!**/__tests__/**'
gameStore.ts:210  seenJitHints: string[];            :327 初值 []
gameStore.ts:594  getSeenJitHints(): ReadonlySet<string>   ← getter 存在
gameStore.ts:2233 seenIds: new Set(this.state.seenJitHints)   // 喂给 checkHistorian
gameStore.ts:2237 this.state.seenJitHints.push(result.advice.id)
saveLoad.ts:45/322/458  入档（:458 读回时 typeof string 过滤，防御性）
historianSystem.ts:4 「已触发 id 存入 GameState.seenJitHints（复用已有持久化字段）」
```

⇒ 同一个持久化数组里**混装两类键**：JIT 的 `JitTrigger` 名与史官谏言的 `hist_*` advice id。本方案 C **不往该数组写任何东西**（只在弹时查 `CODEX_TOPIC`）⇒ 不新增耦合；但它解释了为什么「终身一次」的语义不能只看 JIT 一侧，也说明任何日后给 `seenJitHints` 加校验/迁移的单必须同时管两类键。

### 2.3 触发密度现状

- `JitTrigger` **14 值**（`jitHints.ts:12-25`），`JIT_HINTS` 表 **14 条**（`:34-47`，逐条 `text` 抽取实测条数 14）。
- 文案字数实测 **31–88 字**（最长 88＝`game_start`），**含「典册」二字者 0 条** ⇒ 现状对典册**零指向**。
- 接线事件 **10 道**（`JitHintManager.ts:56-64`）＋开局延迟 800ms 一发（`:55`）。其中 `RESOURCES_CHANGED` 一发拆 4 个 trigger（`:41-44`，仅 gold/cloth/bronze/rite）。
- 去重持久化：`gameStore.ts:209` `seenJitHints`（注释「持久化，永不重复」），`markJitHintSeen` 实现 `:596-599`。
⇒ 单局内 JIT 最多发 14 次、**终身一次**，第二次进游戏起全部静默。所以「新玩家卡关自行翻典册」这个缺口只在**首局 14 个瞬间**里成立，跳转按钮的有效窗口也只有那 14 次。

## 三、CodexPanel 是否已有「按 topic 定位/高亮」能力（有，但键形不对）

条目数据源与展开逻辑锚点（≥2 处，实测）：

| 能力 | file:line | 实测细节 |
|---|---|---|
| 条目类型 | `CodexPanel.ts:18` | `interface Topic { title: string; body: string }` —— **无 id/slug 字段，只有标题** |
| 条目表 | `CodexPanel.ts:20` | `const TOPICS: Topic[] = [`，实测 **10 条**，顺序即索引 |
| 选中态 | `CodexPanel.ts:127` | `private selected = 0;`（**数字索引**，非 key） |
| 列表点击 | `CodexPanel.ts:152/156` | `TOPICS.forEach((t,i)=>...)` ＋ `zone.on('pointerup', () => { this.selected = i; this.layout(); })` |
| 正文渲染 | `CodexPanel.ts:212-213` | `const topic = TOPICS[this.selected]!; this.content.setText(topic.body)...` |
| **定位 API（现成）** | `CodexPanel.ts:224` | `selectTopic(i: number): void { this.selected = Math.max(0, Math.min(i, TOPICS.length - 1)); if (this.isOpen) this.layout(); }` —— 自带越界 clamp |
| 计数 API | `CodexPanel.ts:225` | `topicCount(): number` |
| 开合 | `CodexPanel.ts:162-163` | `toggle()` / `open()` |

测试面：`ui/__tests__/CodexPanel.test.ts:72` 断言 `topicCount() >= 8`（**下界松**，10 条时插第 11 条不会红）、`:94/:95` 只测 `selectTopic(2)` 与末位不抛。⇒ **没有任何守卫钉「标题↔索引」对应关系**。

**两处对本单定性很关键**：
1. `:223` 注释把 `selectTopic` 自称「**测试 hook**」——它今天只被测试用（`:94/:95`），生产侧唯一消费者将是本单要加的跳转。转正为公共 API 需改注释口径，否则下一班又会当它是假想接口。
2. 定位只吃 **number 索引**。若 `JitHint.codexTopic` 存索引 ⇒ 在 `TOPICS` 中间插一节（如新增「民心双轴」说明）会让**全部 JIT 跳转静默指向错节**，且因 `:72` 下界松、clamp 存在（越界也不抛），**测试不会红、玩家只会看到错内容**。若存标题字符串 ⇒ 需要 `title→index` 线性查表，且**文案改名即断链**，同样无守卫。这是本单真正的技术风险，与「加字段」的成本不在一处。

## 四、弹层落点与承载体（成本所在）

```
$ rg -n "toast[?]?.show\(" src -g '*.ts' -g '!**/__tests__/**' | wc -l  → 25
按文件：UIScene.ts 19 ／ ui/BuildingPopover.ts 4 ／ scenes/GameScene.ts 1 ／ ui/JitHintManager.ts 1
```

- 承载体：`JitHintManager.ts:28-29` `const toast = registryGet(..., REGISTRY_KEYS.toast); toast?.show(hint.text, 'info', 5200);`
- `Toast.show()` 实现（`Toast.ts:21-61`）：只建 `graphics`(bg) ＋ `text`，`:58` 淡入，`:60` `delayedCall(durationMs, clearCurrent)`；**无 `setInteractive`、无 zone、无 pointer 处理**（全文件仅 `:21/:11` 两处定义性命中，无任何输入代码）。`:27` 每次 `show` 先 `clearCurrent()` ⇒ **后到覆盖前到**（`:9` 注释自述）。
- ⇒ 「在 toast 里放一个可点按钮」＝给共用件加交互能力，还要处理「悬浮时暂停计时」，否则 5.2s 内按钮自己消失。**这不是 ≤30 行级，是 UI 能力新增**。
- 好消息（落点零新 wiring）：`UIScene.ts:213-214` 先建 `CodexPanel` 并 `registrySet(REGISTRY_KEYS.codexPanel, ...)`，`UIScene.ts:216-218` 建 toast，`UIScene.ts:246` 才建 `JitHintManager` ⇒ 取用顺序天然成立；`JitHintManager.ts:5` 已 `import { REGISTRY_KEYS, registryGet }`，照 `:28` 同一形状再取一个键即可。
- 同类先例可抄：`HUD.ts:339-342` 的「?」键就是 `registryGet(..., REGISTRY_KEYS.codexPanel)` → `codex?.toggle?.()`，含 `playUi('sfx_click')` 的音效位（`HUD.ts:340`）。

## 五、三案对比

| | A：加 `codexTopic` 字段＋toast 内按钮 | B：不加字段，文案手写「典册·某节」 | **C（推荐）：字段不加，映射表＋可选尾参** |
|---|---|---|---|
| 数据改动 | `JitHint` 加 `codexTopic?: number\|string`，14 条表逐条填 | `JIT_HINTS.text` 尾部追加「详见典册·资源」 | 不动 `jitHints.ts`；`JitHintManager` 模块内加 `Partial<Record<JitTrigger,string>>` 表 |
| 承载体改动 | Toast 加交互 zone＋hover 暂停计时（**新 UI 能力**） | 无 | `Toast.show()` 加**可选尾参** `onTap?: ()=>void` ＋ 命中区（≈10 行，25 个调用点零改动） |
| 典册侧改动 | 需 `openTopicByName` 或索引 | 无（但要求标题串与 `TOPICS[i].title` 逐字相同） | 加 `openTopicByName(title): boolean`（≈6 行，未命中返回 false） |
| 可点 | 是 | **否**（玩家得自己开典册再找） | 是 |
| 断链模式 | 索引位移／改名断链，静默指错节 | 改名断链，**文案与现实不符**（看得见） | 改名→查不到→`return false`→**静默不显按钮**（降级安全） |
| 规模 | 估 60–90 行，跨 4 文件＋共用件 | **0 行码＋14 条文案**（最省，但不解决「自行翻」） | **≈32 行，3 文件** |
| 存档 | 不碰（`JIT_HINTS` 是静态表，落盘的只有 `seenJitHints: string[]`——该数组已被史官系统混用，见 §2.2b） | 不碰 | 不碰（本方案不向该数组写入任何新键） |
| 判 | 超预算，不取 | 可作 A/C 落地前的**零成本过渡** | **取** |

**C 案的关键设计**：跳转键用**标题字符串**而非索引，未命中即不显按钮 ⇒ `TOPICS` 增删改名最坏退化成「今天的样子」（无按钮），不会指错节。这一条是 C 优于 A 的实质理由，不是省行数的理由。

## 六、C 案 diff 草案（设计用，未落盘）

```ts
// —— 1) src/renderer/ui/Toast.ts（纯 CRLF；约 +10 行）
-  show(message: string, kind: 'info' | 'error' = 'info', durationMs = 2200): void {
+  show(message: string, kind: 'info' | 'error' = 'info', durationMs = 2200,
+       onTap?: () => void): void {
   // …:39 现有 text 构造之后：
+  if (onTap) {
+    this.text.setStroke('#F5D07A', 1);                 // 可点暗示（不加光标态则仅靠描边）
+    this.text.setInteractive({ useHandCursor: true });
+    this.text.on('pointerup', onTap);
+    // ⚠ 必须同时暂停 :60 的 hideTimer，否则 5.2s 内自己消失：
+    //    把 :60 的 delayedCall 结果留字段，onTap 触发即 clearCurrent()
+  }
```

```ts
// —— 2) src/renderer/ui/JitHintManager.ts（纯 CRLF；约 +16 行）
+/** JIT → 典册章节标题。用标题不用索引：改名即降级为「不显按钮」，不会指错节。 */
+const CODEX_TOPIC: Partial<Record<JitTrigger, string>> = {
+  game_start: '上手指引', first_build: '建筑与劳力', first_complete: '建筑与劳力',
+  first_event: '国策与朝令', first_grade: '国格阶梯', first_policy: '国策与朝令',
+  first_decree: '国策与朝令', first_gold_income: '经济与供养',
+  first_cloth_income: '经济与供养', first_bronze_income: '军事与将领',
+  first_rite_income: '国格阶梯', first_labor_fail: '阶层博弈',
+};   // 未列 first_crisis / first_diplomacy：典册现无对应节（见 §七-3）
   // fire() 内 :28-29 改为：
-  const toast = registryGet(this.scene.registry, REGISTRY_KEYS.toast);
-  toast?.show(hint.text, 'info', 5200);
+  const toast = registryGet(this.scene.registry, REGISTRY_KEYS.toast);
+  const title = CODEX_TOPIC[trigger];
+  const codex = registryGet(this.scene.registry, REGISTRY_KEYS.codexPanel);
+  const jump = title && codex?.hasTopic?.(title) ? (): void => codex.openTopicByName(title) : undefined;
+  toast?.show(hint.text, 'info', jump ? 7000 : 5200, jump);   // 可点时给足读与点的时间
```

```ts
// —— 3) src/renderer/ui/CodexPanel.ts（纯 CRLF；约 +6 行，:224 旁）
+  hasTopic(title: string): boolean { return TOPICS.some((t) => t.title === title); }
+  /** 按标题定位并打开；未命中返回 false（调用方据此不显跳转）。索引不外泄。 */
+  openTopicByName(title: string): boolean {
+    const i = TOPICS.findIndex((t) => t.title === title);
+    if (i < 0) return false;
+    this.selectTopic(i);           // 复用 :224，含 clamp 与 isOpen 时自动 layout
+    if (!this.isOpen) this.open(); // :163
+    return true;
+  }
   // :223 注释「测试 hook」需同步改口径：selectTopic 自本批起有生产消费方
```

合计 **≈32 行／3 文件**（＋`Toast` 计时暂停的 2–3 行则 35）。`JitHint` 类型与 `JIT_HINTS` 表**一字未动**。

## 七、规模预估、回滚与风险

### 预估
- 实施：3 文件 ≈32–35 行；**必带测试 2 例**（`hasTopic('不存在')=false` 与 `openTopicByName` 命中后 `selected` 变化），否则 §三-2 的静默降级无人守。合计一个 25 分钟级班。
- 不动：`schema.ts`、`gameStore`、`saveLoad.ts`、任何经济数值。

### 回滚（三级，都不留残迹）
1. **文案级**：清空 `CODEX_TOPIC`（`Partial<Record>` 允许零键）⇒ 全部 trigger 无跳转，`Toast.show` 第 4 参缺省 ⇒ 行为逐字回到今天（`:29` 原调用形状未变）。
2. **单点级**：删 `JitHintManager` 的 `jump` 三行 ⇒ 14 条提示全部回到无按钮态，`Toast`/`CodexPanel` 新 API 变未使用（可留）。
3. **零存档风险**：落盘的只有 `seenJitHints: string[]`（trigger 名，`:209`），**不含跳转信息** ⇒ 回滚后旧档无需迁移。⚠ 反向注意：已看过某 trigger 的档**永不复弹**，故修复上线前已卡关的玩家拿不到新按钮——这与「不碰存档」不矛盾，但影响收益评估，别把上线后的体感算成本单收益。

### 风险与待裁决（勿在本单内自行拍）
1. **`Toast` 是 25 调用点的共用反馈件**：加 `setInteractive` ＋ 计时暂停会影响所有走它的反馈的可点观感（哪怕只有带 `onTap` 的显按钮，hover/光标态是全局样式判断）。若产品不接受动 `Toast`，唯一出口是走独立浮层（＝A 规模，超预算）。
2. **`selectTopic` 从「测试 hook」转正**：`:223` 注释口径要改，且它是 `public`，转正后属对外接口，后续改名需连带（现无外部消费方，成本此刻最低）。
3. **`first_crisis`／`first_diplomacy` 无对应典册节**：`TOPICS` 10 条标题实测无「危机」「邦交」二节（清单见 §三表）。要么留空（本草案做法，安全），要么补两节——**补节属内容域、且改变 `TOPICS` 索引**，正是 §三-2 的位移风险源，必须与本单解耦另派。
4. **`pickJitHint` 死码未清**（§二-2）：本方案不依赖它，但 `jitHints.test.ts:5/:11` 两例会继续给「JIT 选中逻辑已测」的假象（`:14` 那例是真守护，别一起删）。是否清（连带 2 例）请主班另派，本单按「不做顺手改动」未动。
5. 与 c918-24 缺口 3 的关系：本单只解「JIT→典册」单向跳转；**典册→JIT 反向（读到某节时高亮相关未完成提示）不在范围**。技术上它有现成取数口——`gameStore.ts:594` `getSeenJitHints(): ReadonlySet<string>` 已暴露只读集合，反向渲染＝`14 − seen` 的差集；但两件事别混做：反向会让 `TOPICS` 的**索引语义**变成对外契约（§三-2 的位移风险源），且要先定「史官 `hist_*` 键混在同一集合里」（§2.2b）怎么过滤。建议另单。
