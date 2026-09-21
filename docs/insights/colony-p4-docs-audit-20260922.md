# colony P4 发布域文档巡检：FRIEND_GUIDE / PLAYTEST_CHECKLIST × v0.10 现状对账

- 班次：`qoder-executor-20260922-0000-colony11`（c922-124-p4-docs-audit）
- 日期：2026-09-22 · HEAD 起点 `ea658ae`
- 口径：**只读对账**，两份文档的修订一律「加订正行／头注」，**原句一字不删**（历史留痕可审，沿 `c922-114` 口径）
- 范围：`docs/design/FRIEND_GUIDE.md`（44 行，实测**纯 CRLF 44/0**）＋ `docs/design/PLAYTEST_CHECKLIST.md`（68 行，实测**纯 CRLF 68/0**）
- 红线遵守：未改任何经济平衡数值、未改 `buildings.ts` / `countryGrades.ts`；涉及数值处一律「只读比对＋绑 commit」

## 一、取源口径（先说不能用哪条，再说用了哪条）

任务书完成标准给的两个取源命令，**第一条不可用**：

| 判据 | 实测 | 处置 |
|---|---|---|
| `git log --oneline v0.9.0..HEAD \| wc -l` | **0**（`git tag` 在本仓**无任何 tag**，区间不可解析） | 弃用，改用下面两源 |
| `README.md` v0.10 节 | 锚点 `README:62` **未漂**（`- **v0.10 信息可视化**：`） | 采用 |
| `docs/release-notes-v0.10.0.md`（任务书未列，本仓**唯一 v0.9→v0.10 差异权威档**） | `:7` 「本版新增（v0.9 → v0.10）」＋ `:14` 系统一览 | 采用为主源，新增取源已留痕 |

**v0.10 新系统清单（逐条绑锚点）**：每日出入面板＋补阙因果链（release-notes:9）／升格之途（:9）／功业记分牌（:10）／三幕大事件时间轴（:10，`src/renderer/data/actTimeline.ts`）／民愤通牒·怨愤≥85（:10，双轴民心见 `gameStore.ts:1228` `country_morale` 修饰符链）／故事事件 23→35（:11）／B2 名望资源＋史官三用（`:17`，`resourceRegistry.ts:28-29` `'influence' // 名望`）／终局波次（:17，`src/renderer/state/endgameEscalation.ts`）。

## 二、对账表 A：FRIEND_GUIDE.md（文档句 → 代码锚点）

| # | 文档行·句 | 代码锚点（rg 实证） | 判定 |
|---|---|---|---|
| A1 | :10 顶栏八资源「粮、木、石、钱、民、布、铜、礼」 | `resourceRegistry.ts:35-37` `TOP_BAR_RESOURCE_IDS` 8 项 ＋ `HUD.ts:26-37` `RESOURCE_LABEL` | **成立** |
| A2 | :11 点资源数字看每日出入／入不敷出告诉建什么 | release-notes:9；README:63 | **成立**（面板正名「国计 · 每日出入」） |
| A3 | :16 点顶栏国格徽章列升格条件 | `HUD.ts` 徽章 → `ui/GradePanel.ts`（升格之途） | **成立** |
| A4 | :18 升城邑要人口 30、钱 80、建「市集」 | `countryGrades.ts:61` `{ population: 30, gold: 80 }` ＋ `:62` `bld_market` | **成立** |
| A5 | :18 升邦国要布 40、建「祖庙」 | `countryGrades.ts:68` `{ population: 60, gold: 200, cloth: 40 }` ＋ `:69` `bld_ancestor_shrine`（`buildings.ts:237` `name: '祖庙'`） | **成立**（省略人口/钱，用「……」文体，不判错） |
| A6 | :19 布←桑园／铜←铜冶坊／礼←祖庙·太庙 | `buildings.ts:417/209/237/657` | **成立** |
| A7 | :24-28 「国策树（**顶栏**「朝堂」）／**邦交**（顶栏）／**军务**（顶栏）／**史官**（顶栏）／**大业**（顶栏）」 | `HUD.ts:466` `layoutFunctionToolbar` ＋ `:469-473` 五钮（朝堂/邦交/军务/大业/史官）——**是顶栏正下方独立一排，不是顶栏**（`:104` 注释自述 2026-06-19 移出） | **不成立（5 处）** |
| A8 | :29 功业分（顶栏「记」） | `HUD.ts:416` `scoreLabel` 在顶栏右组 | **成立** |
| A9 | :30 三幕大势（**工具栏中段**） | 同 A7 排布，`actTimeline.ts` | **成立**——但与 A7 **同段自相矛盾**：同一排 UI 一处叫「顶栏」一处叫「工具栏」 |
| A10 | :39 「空格暂停，`>`/`>>`/`>>>` 加速」 | 空格 ✓ `GameScene.ts:242` `keydown-SPACE`；`>`/`>>`/`>>>` 是**顶栏按钮字形**（`HUD.ts:322-326` `text`），键盘加速键实为 **1 / 2 / 3**（`GameScene.ts:243-245` `keydown-ONE/TWO/THREE`） | **半不成立** |
| A11 | :40 顶栏「?」是典册 | `HUD.ts:333` `helpLabel = '?'` | **成立** |
| A12 | :41 顶栏「档」三槽存档/读档 | `HUD.ts:388` ＋ `ui/SaveLoadPanel.ts:14-18` `SAVE_SLOTS` 恰 3 槽 | **成立** |
| A13 | （缺）顶栏「设」设置按钮 | `HUD.ts:356-361` `settingsLabel = '设'`（注释「A-1：设置按钮，顶栏右侧 ? 左侧」）；`REGISTRY_KEYS.settingsPanel` `:367-368/:395-396` 与「档」互斥开关 | **覆盖缺口**：全档零提及（`README.md:73` 操作速查同缺） |
| A14 | :42 故事模式 序章→七章→三结局（公/家/货） | release-notes:18 「序章统一（武/文双途）→ 七章 → 公天下/家天下/货天下」 | **成立** |
| A15 | :35 「扛终局风浪」 | `state/endgameEscalation.ts`；`HUD.ts` 民愤通牒倒计时 | **成立但不可操作**：无入口指引（与 §四 表同缺，见 B 节） |

**「三分钟叙事是否提及史官面板入口」专问**：**提了但入口不可用**——:27 有「史官」，① 位置写成「顶栏」实为工具栏第 5 钮（A7）；② 未给名望的来源与三用（`resourceRegistry.ts:28` 「产自国格，花在宣传/斡旋/修史」），玩家按文档找不到面板。

### 性质分类（本波纪律：不许并成一笔「陈旧」）

- **A7 / A10 = 原始算错（写定时就不成立，非授权漂移）**：工具栏 `layoutFunctionToolbar` 与 `keydown-ONE` 同入 `54eafe9`（快照 6-7 月工作树，代码注释自述 2026-06-19），史官钮入 `3994e30`（2026-08-13），而 FRIEND_GUIDE 建档于 `876f11f`（**2026-08-14**）——文档比现状**晚一天**，属落笔即错，**不得写成「随版本漂移过期」**。
- **A13 = 从未写入**（非过期）。
- **A1-A6 / A8 / A11 / A12 / A14 = 现状仍成立**，本次未加注。

## 三、对账表 B：PLAYTEST_CHECKLIST.md §四 评分表缺项

§四 现有 10 行：建造与相邻加成／国格升格／国策树／朝令／邦交·警惕值／人口阶层与需求／军事·将领／影响力·史官／古迹·大工程／功业记分牌。

| 缺项 | v0.10 权威锚点 | 后果（对试玩验收闸门） |
|---|---|---|
| B1 「国计 · 每日出入」＋补阙因果链 | release-notes:9 | v0.10 **头号交付**无评分行；:32 只有散文一问，采不到 1-5 分数据 |
| B2 三幕大势／大事件时间轴 | release-notes:10；`data/actTimeline.ts` | 「目标感」三支柱缺一 |
| B3 双轴民心（心/怨）＋民愤通牒 | release-notes:10「怨愤≥85 限期压平」；`gameStore.ts:1228` | 民变是崩盘主通道，无分即无校准数据 |
| B4 终局波次／登顶后风浪 | release-notes:17；`state/endgameEscalation.ts` | 8h 曲线后段完全没测感 |
| B5 §三:29 资源清单「粮/木/石/钱/布/铜/礼/麻/锡」 | `resourceRegistry.ts:11-30` 共 11 项 | **缺「民」与「望」**（民在顶栏、望为 v0.10 名望资源），问不出这两个的紧缺感 |

§四 其余 10 行**逐条仍成立**（`PolicyTreePanel`/朝令/`DiplomacyPanel` 警惕值/`PopulationPanel`/`MilitaryPanel`/`InfluencePanel`/`MegaProjectPanel`/`ScoreCardPanel` 均在盘且挂 `HUD.ts:469-473` 或顶栏）。

## 四、参照系：0905 两处回写的性质区分（本单沿用为主班点名的口径）

`docs/insights/economy-params-inventory-20260905.md:35` 的两处，**性质不同，本单未并笔**（只读比对，未回写该档）：

1. **「产出方 12 条」= 原始算错**：同句自列农田…太庙 **14 个**名，写定时即自相矛盾（非版本漂移）。
2. **「市集(金5…)」= 授权漂移，绑 commit `e7cecd3`**（2026-09-20 balance(colony) 市集金 5→3，c919-51 apply 单；盘上现值 `buildings.ts:77` `output: [{ resource: 'gold', perDay: 3 }]`）。

本单 A7/A10 归 (1) 类、A13 归「从未写入」，全表无 (2) 类条目。

## 五、修订做法（留痕，不涂改）

- 两份文档均在**文件顶部加头注**（说明建档 commit、本次巡检班、口径）＋**在受影响的节尾追加订正行**，**原句一字未动**。
- 追加一律按各档实测行尾 **CRLF** 写入，脚本内断言 **CR 守恒**（新增 CR ＝ 新增行数）。
- 未改 `README.md`（:73 操作速查同缺「设」、`>`/`>>`/`>>>` 与 :75 「1076 条测试」现值已涨）——**README 不在本单产出范围**，登记见第七节。

## 六、验收自证

- `git diff --name-only` 本单产出**仅** `docs/design/FRIEND_GUIDE.md`、`docs/design/PLAYTEST_CHECKLIST.md` ＋新增 `docs/insights/colony-p4-docs-audit-20260922.md` → **零 `src/` 面**，故「修订后 `npm run verify` 不受影响（文档零编译面）」结构性成立；实测全量读数随 c922-125 一并跑（见 result）。
- 任务书三处锚点复核：`FRIEND_GUIDE.md:1`／`FRIEND_GUIDE.md:37`／`PLAYTEST_CHECKLIST.md:34` **逐字命中，0 漂移**。

## 七、遗留与待人工（本单未实施）

1. **`docs/design/OPTIMIZATION_BACKLOG.md` 是他班在途 ` M`**：本单**只登记不回写**。其中 `P4-1` **重号两处**——`:61` 已 `[x]`、`:72` 仍 `[ ]`，即主班在册的「P4-1 重号三选一」，待人工裁决。
2. `README.md:73` 操作速查与本文档同错同缺（缺「设」、把按钮字形当键位），`:75` 「1076 条测试」为过期读数（**引数请现场重取**，基线档 `69b262a` 系口径）。README 非本单产出，未动。
3. 新档**未进** `docs/insights/colony-insights-index-20260919.md`（索引重建需授权，主班已登记条目数 75/74 不符）。
4. `countryGrades.ts:69` 标志成就 label 写「立宗庙」而 `buildings.ts:237` 建筑名「祖庙」——**码内文案不一致**，文档未错；属文案域，未动。
5. 若采纳「小抄补 1/2/3 加速键」「§四 补 B1-B4 四行」为**正式文案**（而非订正行），需 P4 文案归一单，本单按「只加注」未改写正文。
