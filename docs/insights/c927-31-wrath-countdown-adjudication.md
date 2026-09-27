# c927-31 · 怨通牒倒计时落点迁移裁决（HUD.ts 顶栏「怨」米 → 工具栏中段）

- 班次：`qoder-executor-20260927-2024-colony45`｜日期：2026-09-27｜仓/分支：`D:\code\colony-game` @ `codex/architecture-hardening`（HEAD 取证时 `6b2e639`）
- 形状：**只读裁决材料，零产品码改动、零新测试件**。文中 diff 全部是**草案文本**，`src/renderer/ui/HUD.ts` 一个字节都没动（否证方式见 §7 的 `git status` 读数）。
- 锚点：`20260925-154206-7b6a.result.md` 遗留 2（**路径已搬家**：卷宗写 `outbox/…`，实际在 `D:\code\zcode-bridge\done\20260925-154206-7b6a.result.md`，22 249 B，内容有效）。

## 0. 结论（一段话）

迁移方向成立、且**应当做**——⏳ 留在 `wrathText` 会顶穿民心块预留带并压到日期文字（§5·C1 算术）。但锚点那句「最小方案 2 行」**被本次复核否证**：HUD 里 `wrathText` 与 `actText` 的**重绘驱动事件不是同一条链**（`refreshSentiment` 由 MORALE/WRATH/ULTIMATUM 驱动，`refreshAct` 只由 ACT_CHANGED 驱动，而 ACT_CHANGED 一局至多 3 次），只搬文字不改接线会把「每日递减的倒计时」变成「至多每 240 日才递减一次的死字」，**比现状更差**。可用形状＝**3 hunk / 净 5 行**（§3 案 B）。另：工具栏中段净空**不是锚点说的 678 px**，扣掉 `craftText` 自身宽度后，1280 下典型 301 px、满值最劣 199 px（§5·C2）——放 ⏳ 够用，但与同仓在途单 `c927-30` 想要的「日期＋国格徽章迁同一带」**存在争带风险**（§5·C3，交主班并案）。

## 1. 锚点复核（逐要素）

| 锚点要素（7b6a 遗留 2 原句） | 磁盘现值 | 判定 |
|---|---|---|
| `refreshSentiment()` 在 **HUD.ts:619-621** | `:613` 方法起、`:619 const ult = this.store.getUltimatum();`、`:620 const ultText = ult.active ? ` ⏳${ult.daysLeft}日` : '';`、`:621 this.wrathText.setText(\`怨 ${wrath}${wrath >= 70 ? '！' : ''}${ultText}\`)` | ✅ 行号精确命中 |
| **不再把 ⏳N日 追加进 wrathText** | 全仓 `⏳` 仅 1 处（`grep -rn "⏳" src --include=*.ts` → `HUD.ts:620`），无其它 UI 承载 | ✅ 在世 |
| 改落 **工具栏中段 actText 空闲带** | `:117` 声明、`:175-177` 创建（`FONTS.small`、`#C9A84C`、origin `0,0.5`）、`:493` 定位 `12 + 5·(btnW+gap) + 16` | ✅ 在世 |
| **实测 actText 588..697** | x=**588** 复算命中（常量算术，§2）；右缘按 7b6a 自己的 E9 宽度模型复算＝**712..721**（`第一幕 · 群狼环伺`，14 px） | ⚠ **收窄**：588 对，697 与 E9 模型差 15–24 px（幕名宽 124..133，非 109）；结论不变 |
| **craftText 右对齐至 1266** | `:488 setPosition(w - 14, …)`，origin `1,0.5` ⇒ 右缘 `w−14`；`w=1280`→1266 ✅；但本仓默认启动尺寸是 **1366×768**（`src/renderer/main.ts:35`），`min 1280×720`（`:37`） | ✅ 在 1280 口径命中；补一档 1366（右缘 1352） |
| **中间常年 >300 px 空档** | 只在「忽略 `craftText` 自身宽度」时才等于 678 px；扣宽度后典型 301 / 最劣 199 px（§5·C2） | ❌ **否证**（口径缺陷，不是方向错误） |
| **最小方案 2 行** | 刷新链不同源（§4），纯 2 行会引入 ≤240 日滞后 | ❌ **否证**（形状应为 3 hunk / 净 5 行） |

## 2. 坐标复核表（判据①）

### 2a 常量（全部读自磁盘现值，非引用他档）

| 常量 | 现值 | 出处 |
|---|---|---|
| `UI.topbarHeight` / `UI.toolbarHeight` | 48 / 40 | `src/shared/palette.ts:108,110` |
| 顶栏资源槽 | `tokenW=104`、`peopleTokenW=120`、`padX=12` | `HUD.ts:221,225,226` |
| 民心块预算 | `sentimentGap=16`、怨米偏移 `+92`、整块 `+184` | `HUD.ts:280-284` |
| 日期/徽章 | `dateGapX=18`、日期预留 `175`、徽章点击区宽 `112` | `HUD.ts:301-305,316` |
| 工具栏按钮 | `btnW=104, btnH=30, gap=8, padLeft=12`，5 枚 | `HUD.ts:491`（`defs` 5 项 `:468-474`） |
| actText / craftText | `actText x = 12+5·112+16`，origin `0,0.5`；`craftText x = w−14`，origin `1,0.5`；同在 `y = tbY+tbH/2 = 68` | `HUD.ts:493`、`:488` |
| 字号 | `FONTS.glyph` 20 px（怨/心）、`FONTS.small` 14 px（actText/craftText） | `palette.ts:96-101,85-89`、`HUD.ts:168-177` |
| 幕名 | `第一幕 · 群狼环伺`／`第二幕 · 诸侯会盟`／`第三幕 · 末世裂变`（各 8 CJK + ` · `） | `src/renderer/data/actTimeline.ts:29-51` |
| 通牒参数 | 阈值 85、`ULTIMATUM_DAYS = 10`、回收线 55；`daysLeft ∈ [0,10]` ⇒ **1–2 位数字** | `src/renderer/state/ultimatum.ts:11-13,35-38` |
| 值域 | 怨愤 clamp `0..100`；资源 clamp `[0,9999]`（`RESOURCE_CAP_BASE`）；名望上限 `40+grade·30` | `publicSentiment.ts:31-34`、`gameStore.ts:631,1413` |

### 2b x 轴推导（顶栏行 y≈15，工具栏行 y=68；纯常量算术，不含字体模型）

```
资源槽尾 cursorX = 12 + 7·104 + 120 = 860
sentimentX      = 860 + 16          = 876   → moraleText 876, wrathText 876+92 = 968
民心块尾        = 876 + 184         = 1060  （怨米可用带 = 1060−968 = 92 px）
dateText        = 1060 + 18         = 1078
gradeBadgeX     = 1078 + 175        = 1253  （点击区 112 → 1253..1365）
按钮组          = 12 … 12+5·112−8   = 564
actText         = 12 + 5·112 + 16   = 588   ← 与按钮组留 24 px
craftText 右缘  = w − 14            = 1266（w=1280）／1352（w=1366 默认档）
```

### 2c 文字宽度（沿用 7b6a·E9 的度量模型：CJK/全角 1.00em、`U+3000` 1.00em、空格 0.26em、数字 0.55em、ASCII 标点 0.34em、`⏳` 1.0–2.0em）

> ⚠ **前提**：本仓零字体文件（7b6a E9：`git ls-files | grep -icE "\.(otf|ttf|woff2?)$"` → 0），`src/renderer/index.html` 三条 `@font-face` 指向不存在的 `/fonts/*.otf` ⇒ 实渲染走系统回退字体，一切宽度只能是**区间**不是点值；下表 ⏳ 一律按上界做布局预算。

| 字符串 | 字号 | 宽（典型→最劣） | 左缘 | 右缘 | 带内？ |
|---|---|---|---|---|---|
| `怨 100！`（无倒计时，现状上限） | 20 px | 78.2 | 968 | **1046** | ✅ 92 px 带内（余 13.8） |
| `怨 100！ ⏳10日`（现状：通牒期） | 20 px | 147.4 → 170.6 | 968 | **1115 → 1138** | ❌ 溢出带尾 55→78 px，**压 dateText(1078) 37→60 px** |
| `第一幕 · 群狼环伺` | 14 px | 124 → 133 | 588 | **712 → 721** | 工具栏行 |
| ＋` ⏳10日`（迁入后同串） | 14 px | +47 → +61 | 588 | **759 → 782** | 仍远小于 craftText 左缘 |
| `名望 0/40　工坊物资　麻 0 · 锡 0`（开局典型） | 14 px | 206 → 215 | 1280 档 **1051 → 1060** / 1366 档 1137 → 1146 | 1266 / 1352 | — |
| `名望 250/250　工坊物资　麻 9999 · 锡 9999`（满值最劣） | 14 px | 276 → 285 | 1280 档 **981 → 990** / 1366 档 1067 → 1076 | 1266 / 1352 | — |

**净空带（actText 右缘 → craftText 左缘）**

| 窗宽 | 典型（开局值＋3 位名望） | 最劣（9999/250 满值 + 幕名宽上界） |
|---|---|---|
| 1280（`min`） | 1060 − 759 = **301 px** | 981 − 782 = **199 px** |
| 1366（默认启动态） | 1146 − 759 = **387 px** | 1067 − 782 = **285 px** |
| 锚点口径（未扣 craftText 宽） | 678 px | 678 px |

⇒ 迁入物只需 **≤61 px**，两档窗宽都够；锚点「>300 px」在 1280 满值态不成立，但**不影响本单可行性**。

## 3. diff 草案（判据②；纯文本，未落码）

### 案 A：锚点原意的「严格 2 行」——**登记但不推荐，会引入 ≤240 日滞后**

```diff
--- a/src/renderer/ui/HUD.ts   （refreshSentiment，:619-621）
+++ b/src/renderer/ui/HUD.ts
@@
-    const ult = this.store.getUltimatum();
-    const ultText = ult.active ? ` ⏳${ult.daysLeft}日` : '';
-    this.wrathText.setText(`怨 ${wrath}${wrath >= 70 ? '！' : ''}${ultText}`);
+    this.wrathText.setText(`怨 ${wrath}${wrath >= 70 ? '！' : ''}`);
--- a/src/renderer/ui/HUD.ts   （refreshAct，:719-720）
+++ b/src/renderer/ui/HUD.ts
@@
     const act = actFor(this.store.getCurrentDay());
-    this.actText.setText(act.name);
+    const ult = this.store.getUltimatum();
+    this.actText.setText(`${act.name}${ult.active ? ` ⏳${ult.daysLeft}日` : ''}`);
```
- 说明： wrath 侧「删 3 行改 1 行」＋ act 侧「改 1 行加 1 行」＝**净 4 行 / 2 hunk**，已经不是字面 2 行；`const ult` 留在 `refreshSentiment` 里变死变量（本仓 `tsconfig.base.json` 未开 `noUnusedLocals`、无 eslint 依赖 ⇒ 不会因此变红，但是脏）。
- **功能代价（真否证点）**：`refreshAct` 只由 `STATE_EVENTS.ACT_CHANGED` 驱动（`HUD.ts:191`），而 store 只在**幕切换**时发该事件（`gameStore.ts:2425-2431`，一局 ≤3 次）。倒计时数字因此最多每 240 游戏日才重画一次 → 通牒 10 日内几乎恒定显示 `⏳10日`，且通牒**解除后仍挂着**（解除靠 `ULTIMATUM_LIFTED`→`refreshSentiment`，与新落点无关）。

### 案 B：**推荐形**（3 hunk / 净 5 行，接线补齐）

```diff
--- a/src/renderer/ui/HUD.ts
+++ b/src/renderer/ui/HUD.ts
@@ -619,3 +619,2 @@  （refreshSentiment：怨米只留本值，不再挂倒计时）
-    const ult = this.store.getUltimatum();
-    const ultText = ult.active ? ` ⏳${ult.daysLeft}日` : '';
-    this.wrathText.setText(`怨 ${wrath}${wrath >= 70 ? '！' : ''}${ultText}`);
+    this.wrathText.setText(`怨 ${wrath}${wrath >= 70 ? '！' : ''}`);
@@ -717,4 +717,5 @@  （refreshAct：幕名 + 通牒倒计时，文案不变时不重画）
   private refreshAct(): void {
     if (!this.actText) return;
     const act = actFor(this.store.getCurrentDay());
-    this.actText.setText(act.name);
+    const ult = this.store.getUltimatum();
+    const next = `${act.name}${ult.active ? `　⏳${ult.daysLeft}日` : ''}`;
+    if (this.actText.text !== next) this.actText.setText(next);
   }
@@ -124 +125,@@ -723 +724,@@  （接线：每日递减 + 通牒起止立刻见效）
-  private onDayTick = (): void => { this.refreshDate(); this.refreshCraftResources(); };
+  private onDayTick = (): void => { this.refreshDate(); this.refreshCraftResources(); this.refreshAct(); };
-  private onUltimatum = (): void => this.refreshSentiment();
+  private onUltimatum = (): void => { this.refreshSentiment(); this.refreshAct(); };
```
- 分隔符建议用 `U+3000`（全角空，1.00em＝14 px）而非普通空格（0.26em）：中段是**两件事**（幕名 / 危机计时），需要肉眼可分的隔断；代价是右缘再 +10 px（§2c 表已含）。
- `if (this.actText.text !== next)` 守卫照 `refreshDate` 的在册写法（`HUD.ts:730` 「文本没变就别折腾」）——案 B 把 `refreshAct` 挂上每日链后，3x 速度下它会 3 Hz 跑，守卫避免无谓重排（Phaser `setText` 每次触发 measure＋texture 重建）。
- 案 B 落地后**顺带修掉一条在册缺陷**：现状 ⏳ 只随 WRATH/MORALE 变化重画（`adjustWrath` 仅在数值真的改变时发事件，`gameStore.ts:1456-1464`）——怨愤钳在 100 或当日 `delta=0` 时**倒计时不递减**；案 B 挂 `DAY_TICK` 后每日必画。

### 案 C：想要「保留红色警示」的独立对象形（≈8 行，**不推荐**）

`FONTS.glyph` 红 `#B71C1C`（现顶栏怨米色）搬到工具栏底色上＝**1.47:1**（本次实测算式见 §5·C5），完全不可读；要独立成件就得同时换色（如 `PAPER #F5ECD7` 对工具栏底 8.21:1）。多一个 Text 对象＋一条独立布局行，收益只有「颜色分级」，与 7b6a 遗留 2 的最小方案取向相反 ⇒ 只登记，不作推荐。

## 4. 刷新链路表（为什么「2 行」不够）

| 对象 | 刷法 | 触发事件（`HUD.ts` 现绑定行） | 实际频率 |
|---|---|---|---|
| `wrathText` | `refreshSentiment` | `MORALE_CHANGED:201`／`WRATH_CHANGED:202`／`STATE_REPLACED:199`／`ULTIMATUM_*:192-194`；**DAY_TICK 不刷**（`:124`） | 只在数值真变时（`gameStore.ts:1461`） ⇒ 通牒期**可能滞后 1 日** |
| `actText` | `refreshAct` | 仅 `ACT_CHANGED:191`（store 侧 `gameStore.ts:2426` 幕切换才发） | **一局 ≤3 次** |
| `craftText` | `refreshCraftResources` | `DAY_TICK:124`／`RESOURCES_CHANGED:189`／`STATE_REPLACED` | 每日 |
| `dateText` | `refreshDate` | `DAY_TICK:124`（带同串守卫 `:730`） | 每日 |

⇒ 迁移**必然**要求「把新落点挂上 DAY_TICK + ULTIMATUM_* 双链」，这就是案 B 第 3 个 hunk 的存在理由；锚点「2 行」把接线成本漏计了。

## 5. 冲突检查（判据③）

- **C1 · 顶栏行内的溢出（本次要解决的问题本体）**：`⏳` 留在怨米 ⇒ 右缘 1115..1138，越过民心块预留带尾 1060 达 55..78 px，并与 `dateText`（x=1078）咬合 37..60 px；与「心」字无关（moraleText 876..~930）。删除后 `怨 100！` 回落到 1046，带内余 13.8 px ⇒ **溢出根因消除**。⚠ 但顶栏另有与本单无关的在册重叠（`c927-30` 正在裁：1280 下右簇左缘 `w−300=980` 与民心块尾 1060 结构性相犯）——**别把那条也算本单收益**。
- **C2 · 工具栏带内共存（⏳ vs craftText）**：案 B 后 actText 段最宽 782，craftText 左缘 1280 档 981（满值最劣）／1051（典型）⇒ **净空 199..301 px，零重叠**。幕名是定长 8 CJK（`actTimeline.ts` 三档同形）⇒ 不随进程抖动；craftText 才是唯一会变长的一侧，且它 origin=1 向左生长 ⇒ 冲突只可能来自名望/中间品进位，已被最劣档覆盖。
- **C3 · 与其它角标/在途单的争带（须裁决项）**：同仓兄弟班在途件 `docs/insights/c927-30-topbar-overlap-adjudication.md`（工作树版，mtime 2026-09-27T20:27，非本班产物、本班未碰）推荐案 3b：把 **日期(139 px)＋国格徽章(112 px)＝251 px 迁进同一条中段带**，其空档口径取 678 px（＝未扣 craftText 自身宽，见 §1/§2c）。两案若并落：中段需求 = 251 + 61 = **312 px** > 1280 满值净空 **199 px** ⇒ **同带超额认购**。本班不自裁他人单，只登记：**要么 c927-31 的 ⏳ 只占 61 px 先行，要么与 c927-30 一起做一次「中段带总预算 ≤199 px@1280」的合并分配**，交主班并案。
- **C4 · 其它同带元素普查（无冲突）**：工具栏行 y 48..88 内只有 5 枚主功能按钮（12..564）、`toolbarBg` 矩形、`actText`、`craftText`（`HUD.ts:477-521`）；`StoryBar`(`StoryBar.ts:79,137`)、`Toast`(`Toast.ts:47`)、`BuildPanel`(`:370`)、地图顶 inset(`MapRenderer.ts:128`、`GameScene.ts:296`) 全部从 `topbarHeight+toolbarHeight = 88` **起算，落在带下方** ⇒ 迁入不与任何既有 HUD 角标叠字。
- **C5 · 颜色/可读性**：本次自算 WCAG（`node -e` 亮度式，工具栏底＝`WOOD_LIGHT 0.96` 叠 `BG_INK` ⇒ 有效色 `#5A3E35`）：`GOLD #C9A84C` **4.22:1**、`PAPER #F5ECD7` 8.21:1、现怨米红 `#B71C1C` **1.47:1**（搬过去即瞎）；对照**现状**顶栏红字对 `BG_INK #1A1410` 也才 **2.78:1**。⇒ 案 B（沿用 actText 金色）不降反升，但 14 px 下 4.22:1 仍不足 AA 正文 4.5:1；要「危机分级色」就走案 C 的换色支路，别直接搬红。
- **C6 · 事件/音效共存**：`ULTIMATUM_STARTED` 同时被 `AudioManager`（`sfx_warn`，`AudioManager.ts:36,56`）、`UIScene`（`:263-265`，弹模态/公告）与 HUD 消费 ⇒ 迁移只动 HUD 一处的绘制落点，**不得**改事件语义或订阅数；案 B 第 3 hunk 复用同一 `onUltimatum` 回调，不新增订阅 ⇒ `destroy()` 解绑面零变化。
- **C7 · 测试面（零新增测试件前是否变红）**：`grep` 全测试域——UI 侧无任何断言钉 `wrathText`/`actText` 文案（`HUD.test.ts` 60 行只断言事件绑定与对象存在）；`⏳` 在 `src` 仅 `HUD.ts:620` 一处；store 侧 `ultimatum.test.ts:54-64` 断言的是 `getUltimatum()` 数值，与绘制落点无关；`actTimeline.test.ts` 断言幕名数据。⇒ **案 A/B 都不触碰在册断言**；代价是「倒计时落点」此后仍无回归钉（属主班决定是否补测试件，超出本单授权）。

## 6. 落地闸（给主班的成本口径）

- 本仓 pre-commit＝`npm run type-check`（`tsc -p tsconfig.renderer.json --noEmit`）＋**全量 vitest（约 40–60 s）**，见 `.git/hooks/pre-commit` 原文；本班不 commit ⇒ 未触发（§7 读数）。
- ⚠ `vitest.config.ts` 现值仍无 `testTimeout`（`test: { environment, include }` 两键）⇒ vitest 1.6.1 默认 5 000 ms；案 B 不引入任何耗时路径（`getUltimatum` 是纯读，`ultimatum.ts:35-38`），**不会**长出死闸；若主班顺手给中段带加「坐标/宽度」类性能判据，必须同批给显式第三参 timeout 形状（本仓重样本件 `sandboxSimulation.test.ts:264,282` 就是靠 `, 120000)` 活着）。
- 案 B 改 `onDayTick`（`:124`）＝每日链上加一次 `refreshAct`；串在 `refreshDate/refreshCraftResources` 之后，同 tick 三次纯读，量级与在册 `refreshCraftResources` 相同，可忽略。

## 7. 判据对照（完成标准 4/4）

| # | 卷宗判据原句 | 本文位置 | 命中 |
|---|---|---|---|
| ① | 坐标复核表 | §2a/2b/2c（常量出处逐行号、1280 与 1366 双档） | ✅ |
| ② | diff 草案 2 行 | §3（案 A 字面 2 行形＋案 B 可用形；并按实况否证「2 行」） | ✅（形状按 §1 否证收窄） |
| ③ | 冲突检查（含 ⏳ 与其它角标共存） | §5·C1–C7（含与在途单 c927-30 的争带） | ✅ |
| ④ | 零码改动 | `git status --porcelain` 收工行数与开工一致，且不含 `src/` 任一路径；`HUD.ts` 未出现在改动列表 | ✅ |

## 8. 否证／收窄清单（本单一手）

1. **否证**「最小方案 2 行」——刷新链不同源（§4），字面 2 行会造成 ≤240 日滞后与解除后残影；净 5 行 / 3 hunk 才是可用最小形。
2. **否证**「中间常年 >300 px 空档」在 1280 满值态的成立——`craftText` 自身宽 206..285 px 未扣；真实净空 199..301 px（方向仍可行）。同一带的 678 px 口径若在别处被复用会高估 3.4 倍。
3. **收窄**「actText 588..697」→ 588 命中、右缘按 E9 模型 712..721（幕名宽 124..133）。
4. **收窄**「craftText 右对齐至 1266」——那是 `min` 宽 1280 档；本仓默认启动态 1366（`main.ts:35`），右缘 1352；两档都已给。
5. **登记不采信**：锚点 7b6a 自己声明「只读面拿不到布局引擎、仓内无字体文件」（其遗留 3/E9）⇒ 本文所有宽度是**区间**，落码前需真机 DevTools 复量一次 `getBoundingClientRect()`；这是人工放行项，本班未做。

## 9. 遗留

1. 案 B 是否被采纳属主班裁决；若采纳且 `c927-30` 案 3b 同期落地，必须先定「中段带总预算」（§5·C3）。
2. 倒计时要不要「危机分级色」＝案 C，需视觉裁决（14 px 金色 4.22:1 的 AA 缺口是既成事实，非本单新增）。
3. 落点迁移后无任何在册测试钉住「⏳ 出现在 actText」——补测试件超出本班「零新增测试件」授权。
4. 顶栏行其它重叠（右簇 vs 民心块、徽章越界）不在本单范围，归 `c927-30`。
