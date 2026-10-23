# colony 文档偏离对账（c1023-22，README/PLAN vs 现值·两档全覆盖·零改动）

> 任务书：近两批 c1011/c1012/c1014 落码后文档滞后面未对账（先例：n 域材料漂移族——c1014-05 五例点名）。本单只出偏离清单，**README/PLAN 零改动**；取数 2026-10-24，colony-game HEAD c078062。

## 一、README.md 逐项对账（12 项，2 偏离＋10 符）

| # | 位置 | 文档现文 | 实测现值 | 判定 |
|---|---|---|---|---|
| R1 | README:60 | 「**23 国策**」 | POLICIES 数组 **39 条**（全 `pol_*`，顶层条目 39） | ❌ **偏离**——git 历史（15769cb 初版→54eafe9 六七月快照批）显示 23 为 v1.0 时代数、快照批扩至 39 后文档未随；`docs/release-notes-v0.10.0.md:16`、`docs/design/GAME_DESIGN_LIFECYCLE.md:109/:399/:537`、`FULL_DEVELOPMENT_ROADMAP.md:15` 同记 23（域外同名漂移，一并点名） |
| R2 | README:73 | 「加速键见 `GameScene.ts:244-246`」 | 加速键实际在 **GameScene.ts:169-171**（speedKeyHandler1-3）＋**:264-266**（keydown-ONE/TWO/THREE 绑定）；:244-246 现为指针拖拽/悬停缓存逻辑 | ❌ **偏离**（行号锚漂移——c922-124 订正过的同族问题复发） |
| R3 | README:73 | 「设/档互斥开关（`HUD.ts:361/:367/:395`）」 | :361 settingsZone.setPosition／:367 settingsLabel／:395 saveLabel | ✓ 锚仍中 |
| R4 | README:60 | 「8 资源」 | TOP_BAR 8 资源（grain/wood/stone/gold/people/cloth/bronze/rite）✓（RESOURCE_IDS 全集 11＝8＋麻/锡中间品＋名望，与发行说明口径一致） | ✓ |
| R5 | README:60 | 「35 建筑＋12 朝令＋40+ 沙盒事件」 | BUILDINGS 35 ✓／DECREES 12 ✓／events.ts 8＋eventsExpanded.ts 40＝48 ✓ | ✓ |
| R6 | README:67 | 「七卷剧情事件 23→35 条（每卷 5 条）」 | STORY_EVENTS 35 条 ✓（7×5） | ✓ |
| R7 | README:3/:53 | v0.10.0 | package.json version=0.10.0 ✓ | ✓ |
| R8 | README:7-8 | Phaser 3.70／Electron 28 | ^3.70.0／28.2.5 ✓ | ✓ |
| R9 | README:68 | 「schema v9 带从 v1 起的完整迁移」 | SAVE_SCHEMA_VERSION=9 ✓（liedVersionMigration/saveV9Fixture 在役） | ✓ |
| R10 | README:66 | 「怨愤 ≥85 触发民愤通牒」 | ULTIMATUM_WRATH_THRESHOLD=85 ✓ | ✓ |
| R11 | README:95 | 「麻田/锡矿 2 栋无自有立绘」 | NO_OWN_ART=2（bld_tin_mine/bld_hemp_field）✓ | ✓ |
| R12 | README:100-118 文档清单＋目录 | 7 文档＋7 目录 | 7 件（CHANGELOG/release-notes/00_上手须知/GAME_DESIGN_LIFECYCLE/BENCHMARK/OPTIMIZATION_BACKLOG/PLAYTEST_CHECKLIST）全在盘；src/main、src/preload、src/renderer、scripts、docs、resources、public 全在盘 | ✓ |

**README 刻意不写测试例数（:79-80 自证「写死的数随套件增长必过期」）——该条款经受住了本班 1944→1947 的增长，防漂移设计有效。**

## 二、PLAN.md 条款态逐项对账（10 项，2 过期/未达＋1 部分达成＋7 达成）

| # | 条款 | 现值实测 | 判定 |
|---|---|---|---|
| P1 | :11「Preserve save **schema v3** compatibility」 | SAVE_SCHEMA_VERSION=**9**（v1→v9 迁移链在役，v3 兼容为其子集，约束精神仍守） | ⚠ **条款字面过期**——v3 写于计划立项时点，现值 v9；「migrations must remain able to read existing saves」持续为真 |
| P2 | :28「Wire story mode to the **fixed story NPC roster**」（完成标准 :81 同源） | **未接线**：c1011-09 核验 story＝sandbox 同随机路径、STORY_NPC_ROSTER 全仓零命中；姊妹单 c1023-06 至今未落码（本班实查） | ❌ **未达成（在途）**——唯一明确未落地项 |
| P3 | :30「Make the asset manifest the authoritative boot-loading source…remove duplicate loading lists」 | **c1023-10（a3eba14）收口**：SCATTER_ART 8 项入 ART_MANIFEST（63 键），BootScene 四类目 manifest 直取、零重复清单（音频面按原语义保留 audioDirector 单源 import，非重复清单）；PLAN#2 末条最后一公里已通 | ✓ **已达成（本班落地，文档无状态标注位）** |
| P4 | :36 typed event map | STATE_EVENTS 枚举＋typedEvents.test 在役 | ✓ |
| P5 | :37 registry typed helpers | REGISTRY_KEYS＋registryGet/registrySet 在役 | ✓ |
| P6 | :39 shared visual constants | src/shared/（palette.ts＋visualConstants.ts＋visualConstants.test）在役 | ✓ |
| P7 | :40 DSL validation 移中性层 | **部分**：data/dslCore.ts 在位＋data→state 上行 import **零命中**（静态数据不再上仰）；评估器 dslEval.ts 仍居 state（dslEval/dslEvalCompat 测试在役） | ⚠ **部分达成**——核心意图（data 不上仰）已证，评估器搬迁未做 |
| P8 | :44 daily phase scheduler 抽取 | state/dayPipeline.ts＋dayPipeline.test（5 绿）在役 | ✓ |
| P9 | :7/:21 snapshot commit | 44c57f8（2026-10-21 快照）在链；分支 codex/architecture-hardening 为当前 HEAD | ✓ |
| P10 | :87 snapshot＋hardening branch on private GitHub remote | origin=github.com/shane-jay-tech/colony-game.git 已配；分支在远端（c1011-08 读数「origin 双远端分支在」）；**private 属性离线不可证**（本单禁联网） | ⚠ 部分核（离线限界，非偏离） |

## 三、偏离清单汇总（建议处置，均零改动待裁）

1. **R1 国策数 23→39**（README:60）：建议随下一笔 README 修订改「39 国策」或改口径注（含 PolicyTree 结构说明）；四份域外文档同名漂移一并点名（release-notes/GAME_DESIGN_LIFECYCLE×3/FULL_DEVELOPMENT_ROADMAP）。
2. **R2 加速键行号锚漂移**（README:73）：建议改指 `GameScene.ts:169-171（handlers）/:264-266（绑定）`——或按 c1011-16 遗留思路改符号化描述（防再漂）。
3. **P1 schema v3 字面**（PLAN:11）：历史计划档按例可不回写；若主班要动，改「preserve save schema compatibility（现值 v9）」。
4. **P2 story roster 未接线**：c1023-06 排期即解——落地时 R 系无涉、c1023-07 立国序列断言需随批改钉（该单 result 遗留 1 已预告）。
5. **P7 dslEval 居 state**：残余项，若要清 PLAN 尾款需一次 data/state 分界重构单（非文档单域）。
