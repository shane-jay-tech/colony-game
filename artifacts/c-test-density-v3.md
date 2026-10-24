# colony 测试密度三版（c1025-10 · 2026-10-25 现值）

> 口径承 plan-0127 档（src 128 vs 测试 176）；本版＝gameStore 五批＋story 三批全部落地后复扫。

## 一、现值（2026-10-25 实测）

| 项 | plan-0127 旧值 | 现值 | Δ |
|---|---|---|---|
| src 文件（非测试 .ts） | 128 | **134** | +6（六域 domains/*.ts 新增 6，gameStore 无净增） |
| 测试文件 | 176 | **182** | +6（六域 *Domain.test.ts） |
| 测试用例（vitest 全量报数） | — | **2031** | 基线口径（c1025-03 后） |
| 测试用例（grep `it(`/`test(` 静态计数） | — | 1903 | 静态口径（与 vitest 报数差 128＝套件嵌套/参数化计数差，两口径并列记录不互换） |

按目录：state src=50/test=93 ｜ data src=34/test=26 ｜ ui src=30/test=31 ｜ scenes src=6/test=17 ｜ render src=9/test=14 ｜ shared src=2/test=1 ｜ main/preload src=2/test=0。

## 二、五批＋story 三批新增测试归因

| 批 | commit | 新增测试 |
|---|---|---|
| 批 1 域一资源 | 1952a08 | resourceDomain.test 12 例 |
| 批 2 域二人口 | 4521ea4 | populationDomain.test 13 例 |
| 批 3 域三军事 | 0a125d8 | militaryDomain.test 8 例＋ad32 门禁改钉 |
| 批 4 域四建设 | 19bb56f | constructionDomain.test 11 例 |
| 批 5 域五回合 | a90fa54 | turnDomain.test 10 例＋ad32 改钉（9→10 件） |
| story 批 1/3 | 7bf926c | storyDomain.test 5 例＋ad32 改钉（10→11 件，c1025-05 复核合理） |
| story 批 2/3 | e66c512 | storyDomain.test +9 例（softlock 双态/推进次序钉/跨档评语） |
| story 批 3/3 | bde01b2 | storyDomain.test +9 例（次序钉/防重复/relic 分派/坏 id） |
| 合计 | — | **六域 77 例**＋门禁改钉 3 次（钉名单 8→11 件） |

八批每笔均含全量回归（1966→1978→1987→1998→2008→2013→2022→2031 递增零红灯）。

## 三、未测件清单更新（v3）

- state 层 4 件无同名单测：generalSystem / militarySystem / populationClassSystem / publicSentiment（注：militarySystem/populationClassSystem 的核心件已随域直测间接覆盖——militaryDomain.test 直测 militaryPowerOf/getAvailableUnitTypes 面、populationDomain.test 直测 computeClassOccupation/applyStarvation 面；「无同名单测」≠「零覆盖」，间接覆盖面以域直测为准）。
- data 层 15 件无同名直测：audio/balanceConfig/breathingContent/buildings/countryGrades/dslCore/events/factions/index/mapSchema/megaProjects/offline/particles/scatterConfig/schema（多数为纯数据声明面，消费侧测试已覆盖：balanceConfig 经 housingCapFor 等域直测、events 经 eventEngine/eventTick 面、schema 经 saveLoad 迁移回归 71 例）。
- main/preload 2 件零测试（Electron 主进程面，历史口径维持——无测试基建）。

## 四、结论

拆分八批测试随迁纪律执行良好（每批域直测＋全量回归＋门禁改钉三件套）；密度现值 134/182（测试文件覆盖率 1.36:1 维持）；核心欠账面未变化：state 4 件同名直测与 main/preload 基建，均属既有欠账非八批引入。
