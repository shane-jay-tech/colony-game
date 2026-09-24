# 典册补「危机」「邦交」两节设计稿（c924-37）

> 状态：**文案设计稿。不改 `CodexPanel.ts`、不改任何面板/结算代码**（本单 `git diff --stat -- src/` 为空）。
> 取数 HEAD：`7877bfd`（现取）。行号均现取并配唯一文本锚点；本仓今天实测锚点普遍漂 +1~+9，落码前请重取。
> 班：`qoder-executor-20260925-0220-colony30`
> 🔴 **数值口径**：下文所有数字（40 日 / 30 日 / 15% / 金 50 布 2 / 侧目 +10 …）**全部是"从现有源码常量抄来的现状陈述"**，不是提案。
> 本班**未改、也无权改**任何平衡数值；若要动这些数，另单走人工裁决（红线：经济平衡数值）。

---

## 一、现有节清单（完成标准 ①）

$ `rg -c "title: " src/renderer/ui/CodexPanel.ts` → **12**

🔴 **这个 12 不能直接当节数用**（卷宗 ① 说的"计数入档"必须带口径）。12 个 `title: ` 命中里含 2 个非主题项：

| 行 | 内容 | 是否主题 |
|---|---|---|
| `:18` | `interface Topic { title: string; body: string }` | ❌ 类型声明 |
| `:117` | `private readonly title: Phaser.GameObjects.Text;` | ❌ 面板标题字段 |

⇒ **真实节数 = 10**（现取双口径：`rg -n "title: " … \| wc -l` = 12；`TOPICS` 数组内字面量 = 10）。

在册 10 节（`TOPICS: Topic[]` 于 `:20` 起，数组下标 = 左侧 tab 序号 = `selected`）：

| idx | 节名 | 起始行 | 实测渲染行数* | 字数 | 首行口径 |
|---|---|---|---|---|---|
| 0 | 上手指引 | `:22` | 10 | 166 | 情景陈述句"你在经营一个春秋小邦…" |
| 1 | 资源 | `:33` | 8 | 161 | **枚举式**"粮：人口每天吃；…" |
| 2 | 建筑与劳力 | `:43` | 9 | 175 | 动作式"建造：点左侧「建造」栏…" |
| 3 | 国策与朝令 | `:52` | 8 | 135 | **入口式**"点顶栏「朝堂」打开全屏国策树（打开时游戏暂停）。" |
| 4 | 国格阶梯 | `:60` | 11 | 189 | **定义式**"六级：聚落 → 城邑 → …" |
| 5 | 军事与将领 | `:69` | 10 | 176 | 入口式"点顶栏「军务」打开。" |
| 6 | 阶层博弈 | `:78` | 5 | 103 | 定义式"人口超过 80 后，国中会出现三大势力：…" |
| 7 | 大业（巨型工程） | `:85` | 6 | 105 | 入口式"点顶栏「大业」打开。" |
| 8 | 经济与供养 | `:92` | 7 | 128 | 定义式"人口每天吃粮：农 1、工 1.5、兵 2、士 2（粮/天/人）。" |
| 9 | 操作与界面 | `:99` | 10 | 198 | 枚举式"地图：拖拽平移，滚轮缩放。" |

\* 渲染行数按面板真实约束算：内容 `wordWrap.width = PANEL_W - LIST_W - 64 = 486`（`CodexPanel.ts:143`）、`FONTS.body.fontSize = 16px`（`src/shared/palette.ts:74-78`）、`lineSpacing: 6`（`:143`）⇒ **每行约 30 个全角字、内容区 `py+68 → py+540` 约 18 视觉行**。测法见 `tmp/c924-37/measure.py`。

**文风结论（写稿据此对齐）**：
1. 首行只有两种合法形态：**入口式**（"点顶栏「X」打开。"，3/10 节用）或 **定义/枚举式**（"A：…"）。
2. 长度纪律：现役节 **5～11 视觉行 / 103～198 字**，无一贴 18 行上限 ⇒ 新节应落在 **≤11 行 / ≤200 字**，否则比现役任何一节都啰嗦。
3. 名词一律用「」括（「朝堂」「民」「拆除工具」）；序列用 `→`；条件用 `（）` 内插；节内用 `\n\n` 分块，块内单行 `\n`。
4. ⚠️ **`**粗体**` 是空头承诺**：正文走 `this.content.setText(topic.body)`（`:213`），Phaser 的 `Text.setText` **不解析 markdown** ⇒ 现有 4 处 `**…**`（`:57 :65 :104` 等）在屏上是**原样星号**。新稿**不沿用**这个写法（沿用即复制缺陷）；是否统一清理属人工裁决（见 §五 偏差 D5）。

---

## 二、危机节全文草稿（新节 A）

拟放 `TOPICS` 下标 5（国格阶梯之后），节名 **「低谷与危机」**（6 字内，与其它 tab 齐平）。

```
低谷与危机：国库（钱）和存粮（粮）同时见底、连续 40 天，就摊上一次危机——不会 Game Over，能翻身。

后果按你家当前处境挑一种：
· 有强邻（敌邦军力≥你的两倍）→ 纳贡附庸：此后每 30 日被宗主抽走一成半的钱和粮。
· 有外城（除农田/水井/民居外的在营建筑）→ 割地：最近建的那一座就此荒废、不再产出。
· 两者皆无 → 民变：人口流散约三成、士气大挫，国格再降一格（已是最低格则不降）。

钱或粮任一项回到正数就开始回血，连续 30 天双正解除危机态，之后可再次触发。
越拖越亏：每经历过一次危机，民变留下的人口再少 5%、民心再多挫 5——第一次翻身的代价最小。
```

实测（脚本 `tmp/c924-37/draftmetric.py`，与 §一 表同口径）：**15 视觉行 / 285 字符**。
→ 超现役最长节（国格阶梯 11 行 189 字），但仍在 18 行硬上限内；压缩建议见 §五 D6。

---

## 三、邦交节全文草稿（新节 B）

拟放 `TOPICS` 下标 6（危机之后、军事与将领之前）。

```
点顶栏「邦交」打开，一邦一卡（每局从列国池中选 4 家）。

每邦可做三件事：
· 通商（金 50＋布 2）：开出商路，此后每 30 日进账钱与布；已通商不能再开。
· 出使（金 30＋布 5）：修好感。文化邦（鲁）涨 25、寻常邦 18、武邦（晋）只涨 12；14 日一次。
· 兴师：动手。军力至少要是对方的一半才许宣战；胜了掠钱铜、败了折军力与士气，30 日一次。

交战中的邦既不能通商也不能遣使。面板上方「侧目」就是列国警惕：兴师 +10、晋国格 +8、通商出使 −2，
侧目到 70 就会招来合纵围攻——想降侧目，去顶栏「史官」花名望「遣使斡旋」。
```

实测（同口径）：**14 视觉行 / 272 字符**。

---

## 四、插入位置图（完成标准 ⑤）

```
下标   节名            状态            相邻理由
────────────────────────────────────────────────────────
 0    上手指引         在册
 1    资源             在册            ┐
 2    建筑与劳力        在册            │ 生存三件套
 3    国策与朝令        在册            ┘
 4    国格阶梯         在册            ← 现于 :66 一句带过危机，新节 A 就地承接
 5    低谷与危机        ★新节 A          前=国格阶梯(4) 后=邦交(6)
 6    邦交             ★新节 B          前=低谷与危机(5) 后=军事与将领(7)
 7    军事与将领        在册（原 5）     ← 邦交→军务：先睦邻后动兵，与「兴师升侧目」同一条因果
 8    阶层博弈          在册（原 6）
 9    大业（巨型工程）   在册（原 7）
10    经济与供养        在册（原 8）
11    操作与界面        在册（原 9）     ← 末节仍是"操作与界面"，收束位置不变
```

**排序理由（逐条可驳）**：
- A 紧跟国格阶梯：`民变→国格降一格` 是同一节里"晋上去"的反面，拆开放就丢因果；且 `:66` 那句原文就在国格阶梯体内。
- B 放在 A 之后、军事之前：`兴师` 是邦交动作却直接吃军力判定（`playerMP ≥ 对方 × 0.5`），先讲邦交三件事，再讲军务，玩家读到时已知道"为什么军力不够不许打"。
- 不插到末尾：`操作与界面`（现 idx 9）是全册收尾"遇到不懂的随时回来查本「典册」"，任何新节都不得排在它之后。

🔴 **落码前置条件（本单不做，交主班/人工）**：左侧 tab 列表**无滚动**。
- 底纹区：`bg.fillRect(px + 12, py + 60, LIST_W, PANEL_H - 76)` ⇒ 竖向下边界 = `py + 464`（`CodexPanel.ts:190`）。
- tab 行：`listY = py + 68`、`rowH = 40`、高 `rowH - 6 = 34`（`:200-208`）。
- 现 10 节：最后一格 `i=9` 占 `py+428 … py+462` ⇒ **离底纹边只剩 2px**（已经顶格）。
- 加 2 节到 12：`i=10` → `py+468…502`（**跳出底纹**）、`i=11` → `py+508…542`（**出血面板底 2px**，`PANEL_H=540`）。
⇒ 必须先解决列表容量（三选一：`rowH` 40→≤37、`PANEL_H` 540→≥572、或加滚动/分页），否则新节的 tab 看得到点不准、且与面板框打架。这是**布局改动**，超出"补文案"范围。

**会红的在册断言**：`CodexPanel.test.ts:48-49` 断言 `expect(panel.topicCount()).toBeGreaterThanOrEqual(8)` —— 10→12 仍绿。`:101-118` 的"点主题条 zone"真路径用例**全程按下标 `tabs[3]` 断言、不断言节名**，且两节插入点都在 idx ≥5 ⇒ `tabs[3]` 仍是「国策与朝令」，**不红**。现取：`rg -n "topicCount|tabs\[" src/renderer/ui/__tests__/CodexPanel.test.ts` 无按节名的断言。

---

## 五、行为口径核对表（完成标准 ②③）

### 5.1 危机节：文案 → 源码常量/结算点（逐条，全部 file:line 现取）

| 草稿措辞 | 代码事实 | file:line（唯一文本锚点） |
|---|---|---|
| "国库（钱）和存粮（粮）同时见底" | `(gold ?? 0) <= 0 && (grain ?? 0) <= 0`，**是"≤0"不是"=0"**，负值也算 | `src/renderer/state/crisis.ts:40-42 isDualZero()` |
| "连续 40 天" | `CRISIS_GRACE_DAYS = 40`；`dualZeroDays >= 40 && !crisisActive ⇒ applyCrisis()` | `crisis.ts:15`；`gameStore.ts:2698-2703`（`runCrisisTick`） |
| "不会 Game Over，能翻身" | 区块注释即此意；无 endgame 分支挂危机 | `gameStore.ts:2694` `// ============== Phase1：可翻身低谷（无 Game Over） ==============`；`crisis.ts:4-5` 引 GAME_DESIGN_LIFECYCLE §7 |
| "挑一种"（三选一、非叠加） | `chooseCrisisKind`：`hasStrongHostileNpc → vassalage`；`cedableBuildingCount > 0 → cession`；否则 `unrest` | `crisis.ts:55-59`；调用点 `gameStore.ts:2748-2753` |
| "强邻＝敌邦军力≥你的两倍" | `n.stance < 0 && n.militaryPower >= Math.max(20, pmp * 2)`（**另有 20 的地板值**，弱旅期 2 倍不足以触发时按 20 判） | `gameStore.ts:2734-2737 findStrongHostileNpc()` |
| （附庸不叠加） | 触发条件带 `&& this.state.vassalOf === null` ⇒ 已是附庸不会再判附庸 | `gameStore.ts:2751` |
| "每 30 日被宗主抽走一成半的钱和粮" | `currentDay % 30 === 0` 时 `planTribute(gold)`＋`planTribute(grain)`；`VASSAL_TRIBUTE_RATE = 0.15`，向下取整 | `gameStore.ts:2715-2720`；`crisis.ts:33`、`:86-88 planTribute()` |
| "外城＝除农田/水井/民居外的在营建筑" | `CORE_BUILDING_IDS = new Set(['bld_farm','bld_well','bld_house'])`；`cedable = status === 'working' && !CORE.has(defId)` | `gameStore.ts:2724`、`:2727-2731` |
| "最近建的那一座" | `cedable[cedable.length - 1]!`（注释："最近建的在数组末尾"） | `gameStore.ts:2726`、`:2767` |
| "就此荒废、不再产出" | `lost.status = 'derelict'` —— **不删除实例**，只翻状态；产出不计因 `accumulateRawProduction` 只扫 `status === 'working'` | `gameStore.ts:2768`；`productionSystem.ts:124`（`if (b.status !== 'working') continue;`） |
| "民变：人口流散约三成" | 留存率 `max(40, 70 − 5×crisisCount)%`、人口地板 `CRISIS_POP_FLOOR = 5` | `crisis.ts:17,19,21,27`；`:71-78 planUnrestEffects()` |
| "士气大挫" | `moraleDelta = −(20 + 5×crisisCount)` | `crisis.ts:23,29`；`:76` |
| "国格再降一格（已是最低格则不降）" | `if (this.state.grade > 0) { gradeTo = grade − 1 }` + `GRADE_CHANGED{reason:'crisis'}` | `gameStore.ts:2784-2792` |
| "连续 30 天双正解除" | 非双零分支 `crisisRecoverDays += 1`，达 `CRISIS_RECOVER_DAYS = 30` 复位 | `crisis.ts:25`；`gameStore.ts:2704-2712` |
| "每经历一次…再少 5%、再多挫 5" | `CRISIS_ESCALATION_POP_PCT = 5`、`CRISIS_ESCALATION_MORALE = 5`；`crisisCount += 1` 在施加后果之后 | `crisis.ts:27,29`；`gameStore.ts:2797` |
| 玩家在哪看到 | `CRISIS_TRIGGERED` → `CrisisModal` 居中弹（半文半白 summary），**一次性**；`summary` 文案在 gameStore 内硬编码 | `CrisisModal.ts:10`、`:78`；`gameStore.ts:2798`、`2764/2773/2794` 三条 summary |

**核对表里挑出的 4 处"现有文案/承诺 vs 行为"偏差（交人工，本单不改）**：

- **D1 🔴「赎身」在界面上不存在。** `crisis.ts:35 VASSAL_REDEEM_GOLD = 200` + `gameStore.ts:2802-2810 redeemVassalage()` 齐备，附庸 summary 原文亦称"可待来日赎身自主"（`gameStore.ts:2764`）。但现取 `rg -n "redeemVassalage" src/` ⇒ **调用者只有测试**（`gameStore.test.ts:1168/1170`），**零 UI 入口**。⇒ 玩家一旦成附庸就是**永久 15% 抽成**，"能赎身"是空头承诺。草稿因此**刻意不提赎身**；两条出口请人工选：补 UI 按钮 / 改掉 summary 文案。
- **D2 现役 `:66` 那句"会触发危机、可能降格或割地"口径不准。** 降格**只发生在民变**（`:2786-2792`）、割地**只发生在 cession 分支**（`:2765-2773`），二者**互斥**、不是"或"的随机池；且**漏了第三种（纳贡附庸）**——恰恰是三种里唯一带永久后果的那种。
- **D3 危机态在顶栏不可读。** `crisisActive` 的全部 UI 消费者现取只有 `AudioManager.ts:91`（换 BGM）。`rg -n "危机|isCrisisActive" src/renderer/ui/HUD.ts` → **0 命中** ⇒ 危机弹窗关掉后，玩家**没有任何常驻指示**知道自己还在危机里（还差多少天解除）。典册不能承诺"顶栏会提示"。
- **D4「割地」用词偏重。** 实际是把建筑翻 `derelict`（荒废、停产、仍占位、实例不删），不是地图丢格。草稿写"就此荒废、不再产出"是为对齐行为，但节名仍叫"割地"（沿用 summary 原文与 `kind` 名）。

- **D5（文风面）** `content.setText` 不解析 markdown ⇒ 在册 4 处 `**…**` 显示成字面星号。新稿不用该写法；是否回头统一清，属人工。
- **D6（长度）** 实测：危机草稿 **15 行 / 285 字符**、邦交草稿 **14 行 / 272 字符**，而现役 10 节最长仅 11 行 / 198 字（`tmp/c924-37/draftmetric.py`）。两稿都在 18 行硬上限内**但明显比全册啰嗦**。压点：删"（已是最低格则不降）""第一次翻身的代价最小""想降侧目去顶栏「史官」…"后半句可并入下条。
  ⚠️ 本单先记为"已知偏长"，不为了凑口径把 D1/D9 的必要信息删掉。

### 5.2 邦交节：文案 → DiplomacyPanel 实有功能（完成标准 ③）

面板公开面现取（`rg -n "^  (open|close|toggle|isVisible|layout|destroy)\(" src/renderer/ui/DiplomacyPanel.ts`）：
`:224 open()`、`:233 close()`、`:239 toggle()`、`:244 isVisible()`、`:246 layout()`、`:393 destroy()` —— **动作面只有开关与重排，三条玩家动作全在卡片按钮里**。

| 草稿措辞 | 代码事实 | file:line |
|---|---|---|
| "点顶栏「邦交」打开" | 主功能工具栏 `{ text: '邦交', reg: 'diplomacyPanel' }` | `HUD.ts:470`（表定义 `:468-473`） |
| "每局从列国池中选 4 家" | 注释"每局 NPC 阵容动态（池中选 4），卡片按 id 懒建/复用" | `DiplomacyPanel.ts:67-68`；卡片容器 `:68 cards = new Map` |
| "通商（金 50＋布 2）" | `const goldCost = 50; const clothCost = 2;`，按钮标签同值 `'通商(金50布2)'` | `diplomacySystem.ts:56-57`；`DiplomacyPanel.ts:370` |
| "此后每 30 日进账钱与布" | `TRADE_TICK_DAYS = 30`；`computeTradeTick` cooldown 归 0 时发 `gold 20 / cloth 3`（`archetype === 'commercial'` ×1.5） | `diplomacySystem.ts:41`、`computeTradeTick:76-101`（`baseGold/baseCloth:90-91`、发放 `:95-96`） |
| "已通商不能再开" | `if (npcState.tradeRoute) return { ok:false, reason:'already_trading' }` ⇒ toast"已通商" | `diplomacySystem.ts:53-54`；`DiplomacyPanel.ts:411` |
| "出使（金 30＋布 5）" | `goldCost = 30; clothCost = 5`；标签 `'出使(金30布5)'` | `diplomacySystem.ts:121-122`；`DiplomacyPanel.ts:371` |
| "文化邦涨 25、寻常 18、武邦 12" | `stanceGain = archetype==='cultural' ? 25 : archetype==='martial' ? 12 : 18` | `diplomacySystem.ts:129` |
| "出使 14 日一次" | `ENVOY_COOLDOWN_DAYS = 14`（`:39`），`lastEnvoyDay` 判定在 `:116-122` | `diplomacySystem.ts:39`、`:114-119` |
| "军力至少对方一半才许宣战" | `if (playerMilitaryPower < npcState.militaryPower * 0.5) return {…'insufficient_military'}` ⇒"兵力不足以兴师（至少需对方半数）" | `diplomacySystem.ts:163`；`DiplomacyPanel.ts:413` |
| "兴师 30 日一次" | `WAR_COOLDOWN_DAYS = 30`、`lastWarDay` 判定 | `diplomacySystem.ts:40`、`:157-161` |
| "胜了掠钱铜、败了折军力与士气" | 胜：`resourceDeltas {gold: loot, bronze: 5}`、`renown +10`、对方军力减半；败：`stance −90`、`warStatus:'tension'` ＋玩家军力/士气跌 | `diplomacySystem.ts:174-196`（`loot:175`，胜支 `:174-189`） |
| "交战中的邦既不能通商也不能遣使" | 两函数首条都 `if (npcState.warStatus === 'war') return {'already_at_war'}` ⇒"已交战，不可再议" | `diplomacySystem.ts:49-51`、`:110-112`；`DiplomacyPanel.ts:412` |
| "侧目 +10 / 晋国格 +8 / 通商出使 −2" | `WARINESS_DELTAS = { declareWar: 10, gradeAscend: 8, peaceAction: -2 }`；施加于 `applyDiplomacyResult` 与晋阶 | `wariness.ts:13-17`；`gameStore.ts:1518-1519`、`:1669` |
| "侧目到 70 招合纵" | `WARINESS_COALITION_THRESHOLD = 70`，注释"≥70 时即使玩家非强档，NPC 也按强档逻辑合纵" | `wariness.ts:11`、`:6` |
| "面板上方「侧目」" | subtitle 原文 `` `本邦：信誉 … · 侧目 ${w.value}（${w.band.text}）${reason}` ``；档位词 列国漠然/列国侧目/诸侯警惕/同仇敌忾 | `DiplomacyPanel.ts:325-329`；`wariness.ts:24-29 warinessBand()` |
| 「史官」花名望「遣使斡旋」降侧目 | `InfluencePanel` 三用"宣扬德政（压怨愤）/ 遣使斡旋（降警惕）/ 修史立传（升信誉）"，条目 `meta: '列国警惕 −8'`；由 HUD 工具栏「史官」开 | `InfluencePanel.ts:8`、`:44`（标题"史官 · 名望"）、`:62`；`HUD.ts:473` |
| "每邦一卡" | `makeCard(def)` 建 通商/出使/兴师 三区（`:180/:190/:200`），`refreshCard` 逐卡刷 | `DiplomacyPanel.ts:167`、`:180-201`、`:332` |

**邦交侧偏差**：

- **D7 `allyIds` 不是玩家能力。** 草稿刻意只写"合纵"作为威胁、**不写"可结盟"**：现取 `allyIds` 的写入全在 NPC 之间（`npcDynamics.ts:74-103`，注释"tribal 永不入盟""玩家非 strong 时联盟自然瓦解"），面板 `:341-342` 只是显示 `合纵：A、B`。若典册写"与某邦结盟"就是编造功能。
- **D8 冷却不在按钮上体现。** `envoyEnabled`/`warEnabled` 的置灰判据（`:363-367`）**只查战争态与资源/军力，不查 `lastEnvoyDay`/`lastWarDay`** ⇒ 冷却中按钮仍是金色可点，点了才吃 toast"下次出使需等 N 日"（`diplomacySystem.ts:118` 的 `details`）。兴师更弱：`on_cooldown` 无 `details`（`:160`）⇒ 只回"尚需时日"（`DiplomacyPanel.ts:409`）。典册可写"14 日/30 日一次"，但**不能说"灰掉就是冷却"**。
- **D9 顶栏主按钮是 5 个、现役文案只列 4 个。** `HUD.ts:469-473` 实为 朝堂/邦交/军务/大业/**史官**；而典册 `:102` 原文"顶栏下方一排大按钮=主功能（朝堂/邦交/军务/大业）"漏了「史官」——偏偏「史官」是本节"降侧目"的唯一入口。**建议随本节一起补 `:102`**（一行文案改动，非数值），否则邦交节把玩家指向一个册子里没登记的面板。
- **D10 术语撞车**：`peaceAction` 的 toast 文案是"通商睦邻/遣使修好"（`gameStore.ts:1519`），而 `InfluencePanel` 的第三个动作也叫"遣使斡旋"（`:62`）⇒ 典册里"遣使/出使/遣使斡旋"三词混用。草稿已统一为**出使（邦交卡）**/**遣使斡旋（史官）**，括注各自面板归属，避免玩家找错地方。

---

## 六、落地清单（交人工／后续单，本单全不做）

1. 解决 tab 列表容量（§四 🔴 前置条件：`rowH`／`PANEL_H`／滚动 三选一）——**这是唯一必须的前置改动**。
2. 把两段 body 以 TS 字符串数组字面量插入 `CodexPanel.ts` `TOPICS`（锚点：`title: '国格阶梯'` 之后、`title: '军事与将领'` 之前），行尾拼接风格照现役（`'…\n' +`，末行不带 `+`）。
3. 同批改 `:66` 那句（D2：删掉"或割地"的并列表述，改为指向新节的"详见「低谷与危机」"）＋ 改 `:102` 补「史官」（D9）。
4. D1（赎身无入口）与 D3（危机态无常驻指示）是**功能缺口**，不是文案能圆的：要么补 UI、要么删承诺。
5. 新增 2 节 → 建议同时给 `CodexPanel.test.ts` 补"每节渲染行数 ≤18 行"的门禁（现役最长 11 行，有空间），否则以后还会漂。

---

## 七、遗留问题

1. 渲染行数是**估算**（486px / 16px / lineSpacing 6 的算术模型，脚本 `tmp/c924-37/measure.py`），**未真机截图核对** CJK 实际换行与 `lineSpacing` 的 Phaser 语义；Phaser 按字宽（非严格全角宽）折行，±1 行属正常误差。落码前请以真机或 `fontSizeGuard` 类测试复核。
2. 未核对 `IntroScene`/`TutorialModal` 是否已有同主题讲解（可能与新节内容重复）——本单范围外，未 `rg`。
3. NPC 数量"4 家"取自 `DiplomacyPanel.ts:67` 的**注释**，未追到实际抽取函数确认常量恰为 4（`makeCard` 只按 `getNpcCountries()` 建卡）。若 `npcCountries` 条数另有来源，该处措辞需跟改。
4. 侧目阈值/抽成比例等**数值一律未改**；本稿只抄不改（红线）。
