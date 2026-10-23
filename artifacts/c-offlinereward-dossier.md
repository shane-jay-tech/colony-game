# OFFLINE_REWARD dead 名处置材料单——c1011-02 浮出 12 名三面复核·甲案裁决底稿（c1023-15）

- 性质：**只读材料单，零代码改动**。裁决点（接线 vs 删除）归主班，本底稿只报不裁。
- 锚点：c1011-02 遗留①「浮出的 12 名（尤其 dead OFFLINE_REWARD）处置归后续登记批：OFFLINE_REWARD 即 c1010-03 甲案（gameStore 离线结算接线）的标的」。
- 现值锚定（2026-10-23 实测）：`node scripts/audit-dead-exports.mjs --out tmp/c1023-15/dead-current-c1023-15.json` → `scanned files=128 entries=122 summary={"dead":1,"testsOnly":98,"internalOnly":23}`；与 c1011-02 后档（122 {1,97,24}）相比 12 名**桶位全稳定**，漂移仅 `canonicalJson` internal-only→tests-only 一名（不在本 12）。
- 历史口径：12 名＝c1011-02 对拍差集「新增浮出」（tmp/dead-{before,after}-c1011-02.json 重算：15 新增−3 同名 tests-only→internal-only 迁移＝12）。
- 三面搜索全文证据：`tmp/c1023-15/three-face.txt`（rg 逐名 × src/tests/scripts 三面，2026-10-23）。

## 0. 总表（12 名 × 三面命中 × 当前桶）

| # | 名 | 定义位 | 桶 | src 面（去掩蔽后） | tests 面 | scripts 面 |
|---|---|---|---|---|---|---|
| 1 | OFFLINE_REWARD | data/offline.ts:9 | **dead** | 仅 index.ts:12/:25 桶两行（掩蔽）＋本体 | 0 | 0 |
| 2 | FLOATING_TEXTS | data/particles.ts:8 | tests-only (6) | 仅 index.ts 桶 | particlesKeys.test.ts 7 行 | 0 |
| 3 | PARTICLES | data/particles.ts:35 | tests-only (7) | 仅 index.ts 桶 | particlesKeys.test.ts 8 行 | 0 |
| 4 | SHAKES | data/particles.ts:56 | tests-only (12) | 仅 index.ts 桶 | particlesKeys.test.ts 13 行 | 0 |
| 5 | ALL_SCATTER_IDS | data/scatterConfig.ts:63 | tests-only (18) | **BootScene.ts:5 alias import → :58 实用（在役）** | 4 测试件 22 行 | art-coverage-reconcile.mts:36 真消费＋gen_scatter_art.py 注记 |
| 6 | NODE_MARKER_INSET | render/mapColors.ts:59 | tests-only (3) | MapRenderer.ts:7 死 import（正文零使用） | mapColors.test.ts 4 行 | 0 |
| 7 | ENDGAME_WAVE_INTERVAL_DAYS | state/endgameEscalation.ts:7 | tests-only (2) | **本模块 :29-31 实用（在役）**；gameStore.ts:71 死 import | endgameEscalation.test.ts 3 行 | 0 |
| 8 | deployGeneral | state/generalSystem.ts:35 | tests-only (2) | **gameStore.ts:89 alias import → :2007 deployGeneralFn() 实调（在役）** | generals.test.ts 3 行 | 0 |
| 9 | returnGeneral | state/generalSystem.ts:39 | tests-only (2) | **gameStore.ts:90 alias import → :2082 returnGeneralFn() 实调（在役）** | generals.test.ts 3 行 | 0 |
| 10 | applyConversion | state/populationClassSystem.ts:72 | tests-only (2) | gameStore.ts:77 死 import（正文零调用；tickConversionQueue:2686 不经它） | populationClass.test.ts 3 行 | 0 |
| 11 | ULTIMATUM_RECOVER_WRATH | state/ultimatum.ts:15 | tests-only (3) | **本模块 :26 实用（在役）**；gameStore.ts:43 死 import | ultimatum.test.ts 4 行 | 0 |
| 12 | ULTIMATUM_WRATH_THRESHOLD | state/ultimatum.ts:11 | tests-only (6) | **本模块 :21 实用（在役）**；gameStore.ts:43 死 import | ultimatum.test.ts 7 行 | 0 |

## 1. 四类分层（裁决看这层就够）

- **A 真死（1 名）**：OFFLINE_REWARD——三面除桶管道与本体定义外全零。
- **B 前置资产待接线（3 名）**：FLOATING_TEXTS / PARTICLES / SHAKES——FX 数据表已建、生产消费面未建，c924-30 已立 fx_ id 守卫＋textureKey「接线时翻红」哨兵。
- **C alias 掩蔽的在役件（3 名）**：ALL_SCATTER_IDS / deployGeneral / returnGeneral——生产链真消费（alias import＋改名调用），**工具词命中盲区误判为 tests-only，删除案对这三名不成立**。
- **D 模块内自用、外部死 import（3 名）**：ENDGAME_WAVE_INTERVAL_DAYS / ULTIMATUM_WRATH_THRESHOLD / ULTIMATUM_RECOVER_WRATH——值在本模块逻辑内在役，`export` 与 gameStore 的 import 行是赘余面。
- **E 纯 tests-only（2 名）**：NODE_MARKER_INSET（连 MapRenderer import 都是死 import）/ applyConversion（gameStore 死 import＋全仓零调用）——真正「仅测试消费」。

## 2. 逐名两案影响

### A. OFFLINE_REWARD（c1010-03 甲案标的）
- **接线案**＝gameStore 读档/回归时按 OFFLINE_REWARD 结算离线收益。c1010-03 已备材料：gameStore 新方法 settleOfflineReward ≈40-60 行＋saveLoad.ts 时间戳承载＋测试 4-6 例。**风险：离线收益倍率/上限（decayFactor 0.5、maxOfflineHours 8）是经济数值生效行为，直入红线域，须主班带平衡验证专裁**。
- **删除案**＝offline.ts＋schema.ts:398 OfflineReward 接口＋index.ts:12/:25 ≈-25 行，零消费方无连带；代价=关闭「离线收益」设计保留位（Kimi 调研 B.8 产物，git 可回捞）。
- **c1010-03 荐案（仍在台面上）**：乙案维持现状零动作；真决策点=产品面要不要「离线收益」机制（挂机收益 vs「被代玩」防线张力，offline.ts 自注已示设计期意识）。

### B. particles 三表（FLOATING_TEXTS / PARTICLES / SHAKES）
- **接线案**＝把 FX 表接进渲染层（GameScene/战斗/收成时刻的浮字、粒子、震屏），先决条件=PARTICLES 两个 textureKey 资产三轨全查无（particlesKeys.test.ts:121 哨兵注记「接线时本例翻红要求同步更新」）——需先产资产。
- **删除案**＝删 particles.ts 三表＋index.ts:11/:22/:23/:24＋particlesKeys.test.ts 全件（5 例守卫连带消失）。代价=弃 c924-30 已建守卫与 FX 设计保留位；git 可回捞。

### C. alias 在役三名（ALL_SCATTER_IDS / deployGeneral / returnGeneral）
- **接线案不适用**（已在役）。**删除案不成立**：ALL_SCATTER_IDS 删→BootScene 散布加载崩；deployGeneral/returnGeneral 删→远征派出（gameStore.ts:2007）与结算（:2082）崩。
- **可行动作**＝登记 wired-by-alias 豁免，或 audit 工具加 alias 解析（工具升级属另单授权，本单不动）。

### D. 模块内自用三名（ENDGAME_WAVE_INTERVAL_DAYS / ULTIMATUM_*×2）
- **接线案不适用**（语义已在役：终局波次间隔 :29-31、通牒起/落阈 :21/:26，gameStore 经 shouldStartUltimatum/shouldLiftUltimatum 消费）。
- **删除案（实为「去 export 化」小批）**＝常量转模块私有＋删 gameStore.ts:43/:71 死 import 名＋重钉引用测试（endgameEscalation.test / ultimatum.test 改从模块内断言或经行为断言）。低风险清理批，非行为变更。

### E. 纯 tests-only 两名（NODE_MARKER_INSET / applyConversion）
- **NODE_MARKER_INSET**：删除案＝删 mapColors.ts:59＋MapRenderer.ts:7 import 名＋mapColors.test.ts:66-68 三断言，零行为面（MapRenderer 的 resourceNodeColor:643 在役不受累）；接线案＝未来资源节点标记渲染用（现渲染只上色不打点）。
- **applyConversion**：删除案＝删 populationClassSystem.ts:72＋gameStore.ts:77 import 名＋populationClass.test.ts:78-81 用例；**接线前须核产品意图**——人口转换现行走 tickConversionQueue（gameStore.ts:2686），applyConversion 是否「即时转换」预留入口须主班确认后再裁。

## 3. 荐案汇总（供拍板包，不代裁）

| 类 | 名 | 荐案 |
|---|---|---|
| A | OFFLINE_REWARD | 沿 c1010-03 荐案：乙案维持现状零动作；产品面决策先行，接线即红线域专裁 |
| B | particles 三表 | 保留待接线（守卫与哨兵在册），删除案不荐 |
| C | ALL_SCATTER_IDS / deployGeneral / returnGeneral | **不可删**；登记 alias 豁免或另单升级工具 |
| D | ENDGAME / ULTIMATUM×2 | 「去 export 化＋清死 import」低风险清理批（随任意实施批捎带） |
| E | NODE_MARKER_INSET | 删除案候选（零行为面） |
| E | applyConversion | 先核产品意图（tickConversionQueue 是否已覆盖），再裁删除 |

## 4. 工具口径注记（判罚语义，防误读总表）

- tests-only ≠ 死：桶序上 tests-only 优先于 internal-only（audit-dead-exports.mjs 分类 if 链），且**alias import＋改名调用不产词命中**（deployGeneralFn/SCATTER_IDS 即例）——本 12 名中 3 名（C 类）属工具盲区误判，3 名（D 类）属「值在役、export 赘余」。
- 三面口径：src＝rg 全 src/**.ts（含掩蔽行，已人工去掩蔽复核）；tests＝src/**/__tests__/**；scripts＝scripts/**（.mts/.mjs/.py＋scripts/__tests__）。
