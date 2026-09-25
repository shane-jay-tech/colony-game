# 硬编码文本 / 量词单位 / 错误信息 清点与待裁清单（20260925-970b）

> 取数班：`qoder-executor-20260925-1630-colony34`，cwd `D:\code\colony-game`，HEAD 钉 **`63f0def`**（改前基线，不用 `HEAD`）。
> 工作类型 **docs**：本档**只登记、不改任何生产码与文案**。所有"改法"都是待裁条目，未执行。
> 本档不触碰三件外部在途件（`docs/design/OPTIMIZATION_BACKLOG.md`／`docs/insights/colony-dead-exports-20260914.json`／其 `.bak` 删除）。
> 点名方式一律「文件名 ＋ 可 `rg` 的唯一锚串」，**不写行号**（本仓实测一次编辑就把注释里的行号推走 6 行）。

## 一、两条验收的判定（先给结论）

| 卷宗验收 | 判定 | 一句话理由（读数见下节） |
|---|---|---|
| ①「字符串有稳定 key」 | **部分成立** | 存在三处**真·稳定 key 表**（`JIT_HINTS` 以 `JitTrigger` 字面量联合为键、`TARGET_LABEL: Record<ModifierTargetKey,string>`、`RESOURCE_LABEL: Record<ResourceId,string>`），编译期即穷尽；但同一张资源标签在 UI 侧被**复制成 4 档文件 / 6 处字面映射**，稳定 key 只在类型层成立，**盘上字节不唯一** |
| ②「缺失翻译显示可定位回退」 | **成立但只覆盖两处，且回退形态对玩家不可读** | `modifierDescriber.ts` 与 `courtFormat.ts` 两处是 `?? e.target` / `?? k`——**回显原始 key**（可定位✓，可读✗）；其余查表点（建筑 sigil、图标、名称）**无回退**，命中不到就是 `undefined`/静默不画；启动侧的完整性守卫 `findUnlabeledTargets()` **只被一个测试调用**，未接进 boot |
| 附：卷宗点名的「复数」 | **本仓不适用（已否证）** | 全仓 UI 文案为中文，无 ICU/复数 machinery（`i18n`/`l10n`/`localization`/`intl`/`translation` 逐词 `rg` 计数 **0／0／0／0／0**，仅 `locale` 1 处命中且为 `seasonTint` 一类假阳性）。**等价风险在"量词＋空格"上**，见 §四 U-1 |

## 二、清点配方（每条都可复算）

```
$ rg -c -F --regexp "i18n" src -g '*.ts'      # → 0（l10n / localization / intl / translation 同形，逐词各跑）
$ rg -c -F --regexp "locale" src -g '*.ts'    # → 1（假阳性，非本地化面）
$ rg -n 'export const [A-Z_]*LABEL' src -g '*.ts'
  src\renderer\ui\courtFormat.ts:8:export const RESOURCE_LABEL: Record<ResourceId, string> = {
  src\renderer\state\modifierDescriber.ts:15:export const TARGET_LABEL: Record<ModifierTargetKey, string> = {
$ rg -c "grain: '粮'" src -g '!**/__tests__/**'
  src\renderer\ui\BuildingPopover.ts:1
  src\renderer\ui\BuildPanel.ts:3
  src\renderer\ui\courtFormat.ts:1
  src\renderer\ui\HUD.ts:1                     # 合计 6 处重复标签映射
$ rg -e 'throw new Error\(' src -g '*.ts' --no-heading | wc -l
40
$ rg -no '\$\{[A-Za-z_.()\[\]0-9]+\}( ?条| ?天| ?格| ?级| ?日|%)' src/renderer -g '!**/__tests__/**'
  # 10 条命中，全部是手写"数字＋量词"，无统一格式化助手
$ rg -n 'export function (fmt|format)[A-Za-z]*' src/renderer -g '*.ts'
  src\renderer\ui\courtFormat.ts:16:export function formatCost(...)
  src\renderer\state\productionSystem.ts:290:export function formatRate(v: number)
  src\renderer\ui\SaveLoadPanel.ts:29:export function formatSavedAt(ts: number)
```

双轨说明（§九.3 口径）：以上"多少处"式计数一律**正则读数＋人工逐条点名**对到位。`grain: '粮'` 的正则 6 处经逐条 `sed` 复核确认是**四张不同表**（`courtFormat`/`BuildPanel`×3/`HUD`/`BuildingPopover`），无一是测试夹具 ⇒ 差额归零。

## 三、待裁清单 · 稳定 key（K 组）

**K-1｜资源标签被复制成四张表**
- 锚点：`grain: '粮', wood: '木', stone: '石', gold: '钱'`（`ui/courtFormat.ts` 的 `RESOURCE_LABEL` 有；`ui/BuildPanel.ts` 内**三处**、`ui/HUD.ts`、`ui/BuildingPopover.ts` 各一处是就地字面量）
- 实况：同一 `ResourceId` 的显示名有 6 份独立副本。`buildingSigils.ts` 另有 `bld_quarry: '石'`（沙印字形）与资源名同名不同义，改一处极易漏其余。
- 影响：改「钱→铜钱」这类文案要命中 6 个点；漏掉的点在同一屏里显示不一致（HUD 与建筑浮窗对不上）。
- 出口 A：把 `RESOURCE_LABEL` 提为唯一来源，其余四处改 import（纯 UI 侧，不动数值）。
- 出口 B：保留现状＋加一条"字面量映射不得重复"的门禁测试（本仓已有 `copyBias.test.ts` 这类文案扫描先例）。
- 建议档位：B（低风险、可测）。

**K-2｜标签表有穷尽类型，但"新 key 漏配"只在两个面上成立**
- 锚点：`export function findUnlabeledTargets`（`state/modifierDescriber.ts`）
- 实况：函数自述「供启动校验/测试用」，调用面实测只有 `state/__tests__/modifierDescriber.test.ts` 里那句 `expect(findUnlabeledTargets()).toEqual([])`，**没有接进启动校验**。
- 影响：新增 modifier target 时，若 CI 未跑到该测试（例如只跑定向面），玩家侧会看到原始 key（见 R-1）。
- 出口 A：在 BootScene 启动校验里调用一次并把非空结果显示为开发告警（不弹窗、不阻断）。
- 出口 B：接受"测试即门禁"，删掉函数注释里"供启动校验"这句假承诺（文档一致性修法）。
- 建议档位：B 优先（零运行时风险），A 需与启动校验族一并裁。

## 四、待裁清单 · 单位与量词（U 组）

**U-1｜"数字＋日"手写且空格口径不一致**
- 锚点（同一形态 10 处，节选）：`日`：`${def.constructionTime} 日`（BuildPanel）、`${days} 日`（UIScene/MegaProjectPanel）、`${state.tradeCooldown} 日`（DiplomacyPanel）、`${remaining} 日`（EventModal）、`${e.daysRemaining} 日`（MilitaryPanel）、🔴 `${ult.daysLeft}日`（**HUD 缺空格**）
- 实况：单位由每处自己拼；HUD 那一处与其余 9 处**不同形**（无空格）。同类还有 `${pct}%`（BuildingPopover）与 `formatRate`（productionSystem）两套并存的数字呈现路径。
- 影响：跨面板观感不一致；将来若加"季/年"复合单位或做数值格式化统一（如 `formatDuration`），要再扫一遍全部拼点。
- 出口 A：加 `formatDuration(days)` / `formatPercent(v)` 到既有 `courtFormat.ts`（该文件已是"文案格式化"落点，先例清楚），逐面板替换。
- 出口 B：只统一现状（把 HUD 那处补空格）＋在 `docs/design` 记一条"单位一律走 courtFormat"约定。
- 建议档位：B 先行（一字面串），A 作为后续单。

**U-2｜频率单位"每日"写死在文案里，与 `BALANCE.time` 无绑定**
- 锚点：`data/jitHints.ts` 的 `每日+2`、`data/buildings.ts` 内 17 处 `每日|每季`
- 实况：产出速率的数值来自数据表，"每日"这个**单位词**是文案里的常量。仓内确有 `每日/每季` 与日历换算（`dayToCalendar`、`BALANCE.time.msPerDay`）。
- 影响：若一日长度或结算粒度变化（本仓在途有 `fractional-day-sandbox` 一族的讨论），文案单位会与新粒度说谎。
- 出口：登记，等"日粒度"结论定型后再决定是否把单位词也数据化。**本档不建议单独动**。
- 建议档位：C（需与日粒度裁决合并）。

## 五、待裁清单 · 缺失回退（R 组）

**R-1｜回退形态＝把内部 key 直接印给玩家**
- 锚点：`const label = TARGET_LABEL[e.target] ?? e.target;`（`state/modifierDescriber.ts`）、`parts.push(`${RESOURCE_LABEL[k as ResourceId] ?? k}${v}`)`（`ui/courtFormat.ts`）
- 实况：确实"可定位"（回显 `country_grain_output` 这种 key），满足验收②的字面；但玩家读到的是英文 snake_case。
- 出口 A：回退时改成 `「未命名(${key})」` 一类带标记的形态，让"漏配"在屏幕上自显形。
- 出口 B：保留 key 回显（开发期最有用），另在 toast/console 打一次 warn。
- 建议档位：A/B 均可，属文案裁决 ⇒ 交人工。

**R-2｜无回退的查表面：命中不到就静默消失**
- 锚点：`const def = getBuildingDef(b.defId); if (!def) continue;`（`render/MapRenderer.ts`）
- 实况（同波兄弟单 913e 已实测钉住）：存档层**不校验** `defId` 是否注册、也不校验坐标是否在地图界内；渲染层遇未注册 defId 直接 `continue`（`rg -n 'if \(!def\) continue' src/renderer/render/MapRenderer.ts` → **两处**：建筑精灵循环与另一处取 def 的循环），建筑凭空消失、无日志无红。
- 影响：这是"缺失文本/资产"最坏的一类回退——**不可定位**。与验收②正相反。
- 出口：① 校验侧（`saveLoad.validateBuildingsArray`）加"可解析＋界内"；② 渲染侧把 skip 变成一次性可观测计数。两条都会改既有行为（老档可能从"能读"变"拒读"），须人工裁。
- 建议档位：A，但**必须**与"老档兼容"一起裁。

## 六、待裁清单 · 错误信息（E 组）

**E-1｜英文开发者错误串会直达玩家 toast**
- 锚点：`操作失败：${err instanceof Error ? err.message : String(err)}`（`ui/SaveLoadPanel.ts`）
- 实况：全仓 `throw new Error(` 共 **40** 处，文案侧一律英文（`Save data missing schemaVersion field`／`resources must be a record of finite numbers`／`Save created with future schema version …`，见 `state/saveLoad.ts`；主进程侧 `invalid slot for save-game …`）。这些串经 `SaveLoadPanel` 原样进 toast。
- 影响：中文 UI 里弹英文技术串；且"档位在迁移链上断了"这类玩家可自救的情形（读老档）没有被翻译成可操作提示。
- 出口 A：给 `SaveLoadError` 的 message 建**稳定 key**（例如 `save.missing_schema_version`），UI 侧按 key 显示中文，英文原文进 console。这恰好同时满足验收①②（key 稳定＋缺失可定位回退）。
- 出口 B：只在 UI 侧做一张 `message → 中文` 的映射表（快，但等于再造一份会漂移的副本，与 K-1 同病）。
- 建议档位：**A**（本档唯一推荐的结构性改法；仍待裁，不在本单执行）。

**E-2｜同类错误分散三层，命名不带层前缀**
- 实况：`dayPipeline` 的 `day pipeline missing handlers: …`、`buildingRegistry` 的 `Building ${b.id} has non-positive size: …`、`GameStore.replaceState` 的 `[GameStore.replaceState] invalid activeModifier …` ——只有第三类带方括号前缀，前两类无来源标记。
- 影响：跨进程/控制台里难归因（本仓 §十四 已记"rc 对但细节丢"的同类坑）。
- 出口：统一 `[模块]` 前缀约定；属纯字符串加法，风险低但会改动多处断言正则（`saveIoSemantics.test.ts` 钉了消息形状）。
- 建议档位：B，且**必须连测试一起改**，不宜由执行手顺手做。

## 七、本档刻意没做的事

1. 未改任何生产码／文案／配置；未跑全量套件（本仓硬口径 2）。
2. 未给"硬编码文案"下总量结论——`rg -c '[\x{4e00}-\x{9fff}]'` 在 UI/渲染/场景三目录非测试件里最高 217 行（`render/MapRenderer.ts`）、次高 111（`scenes/GameScene.ts`）、105（`ui/HUD.ts`）……**多数是注释**，不区分就报数会造出假规模（§九.3 同类坑），故本档只登记**可定位的重复点与回退缺口**，不报"全仓多少条硬编码文案"。
3. 未新建 i18n 框架（卷宗没说要做，且属人工闸）。

## 八、复核配方（收工自证）

```
$ git status --porcelain          # 除本档 ＋ 兄弟单两枚测试件外，零新增
$ rg -c "grain: '粮'" src -g '!**/__tests__/**'
$ rg -e 'throw new Error\(' src -g '*.ts' --no-heading | wc -l      # → 40
$ rg -n 'findUnlabeledTargets' src                                  # → 定义 1 ＋ 测试调用 1，无启动接线
$ rg -n '\?\? e\.target|\?\? k\}' src/renderer/state/modifierDescriber.ts src/renderer/ui/courtFormat.ts
$ rg -n 'if \(!def\) continue' src/renderer/render/MapRenderer.ts
```
