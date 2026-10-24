# PLAN#4 收口材料单（c1025-09 · 2026-10-25）

> 性质：材料件（零改码）。范围：①五批拆分「未落地三路证」补齐；②dslEval 居 state 残余两案；③事件批量门闸设计（与 c1025-04 事件转发设计联动、不重复——本单只出**闸**不出**案**）。

## 一、三路证：五批拆分＋story 三批落地证据链（◐→✓）

**路证 1 · commits**：八批拆分全在链——
- 五批（c1023-01..05）：1952a08（域一经济/资源）/4521ea4（域二人口/社会）/0a125d8（域三军事/外交）/19bb56f（域四建设/生产）/a90fa54（域五回合/系统）
- story 三批（c1025-01..03，本班）：7bf926c（runNpcDynamicsTick）/e66c512（runStoryTick 族三件）/bde01b2（事件采样/采纳三件）
- 复现：`git log --oneline | grep -E "c1023-0[1-5] gameStore拆分批"`＝5 笔；story 三笔同法

**路证 2 · tests（域直测随迁同源对照）**：
| 域 | 直测用例 | 域 | 直测用例 |
|---|---|---|---|
| resourceDomain | 12 | constructionDomain | 11 |
| populationDomain | 13 | turnDomain | 10 |
| militaryDomain | 8 | storyDomain（本班三批） | 23 |
合计 **77 例**；全量基线 2031 绿（c1025-03 后现值）。复现：`grep -cE "^\s*it\(" src/renderer/state/__tests__/*Domain.test.ts`

**路证 3 · 容器零变更**：schema.ts 在八批拆分期间**零 commit**——其最近三笔均在拆分链之前（23c2d08=c1012-01 数组化 / 4009066=c1006-07 死字段 / 6f7a4c9=B3 加工链），拆分八笔的 diff 均不含 schema.ts。复现：`git log --oneline -5 -- src/renderer/data/schema.ts`＋八笔各自 `git show <sha> --stat` 无 schema.ts。

## 二、dslEval 居 state 残余两案（#3 ◐ 处置材料）

**现值核（2026-10-25 实测，较 c1023-21 登记有重大更新）**：dslEval.ts 已是 **9 行纯再导出壳**（`export * from '../data/dslCore'`，c922-11 已把实现整体下沉 data/dslCore.ts——state/dslEvalCompat.ts 已不存在）；「居 state 残余」的实际残余面＝**壳文件归位**：3 个消费点仍走兼容 import（eventEngine/decreeSystem/gameStore 各 1 处 `from './dslEval'`）。

- **甲案·迁出（清壳）**：3 消费点 import 改 `../data/dslCore`（gameStore 为 `./dslEval`→改 data 路径）＋删 9 行壳＋dslEval 两测试文件 import 同步。成本：**半个执行单**（5 文件小改＋全量回归）；收益：data 不上仰口径彻底闭合（PLAN P7 核心意图已证，此为最后一公里）；风险：低（纯 import 改址，tsc 兜底）。
- **乙案·维持（壳存续）**：保留兼容层原状。理由：壳自带文档注释（「新代码请直接 import dslCore」）已足够导流；改址收益仅审美。风险：壳文件长期存活，下一个 c1023-21 式盘点仍会点名。
- **推荐：甲案**（成本极低且彻底清欠；c1025-04 B 案注册表实施时 gameStore import 面本来要动，可同批顺带）。

## 三、事件批量门闸设计（「事件批量门未建」◐ 的闸面；案面在 c1025-04）

适用场景：B 案（域回调注册表）实施时，把散在各薄委托内的 io 闭包装配**批量**收敛到注册表——批量搬移 emit 装配面的三道闸：

1. **分批闸**：单批搬移 ≤2 个域（六域三批收口）；每批独立 commit（可独立 revert）；批内 grep 自证零散装配残留（`rg "setPending|emitTriggered" src/renderer/state/gameStore.ts` 计数随批递减、注册表侧递增，双向对账）。
2. **行为保真门**：批前批后各跑一次 emit 次序快照（现有 eventOrderingSnapshot.test 14 例＋dayPipeline 相位序钉），次序 diff 必须为零；c1025-03 实证的「监听者回调内读 state」次序敏感面（EventModal 读 getPendingEventId）作为专项回归钉（storyDomain.test 次序钉 3 例已有，随批扩充）。
3. **门禁联动闸**：每批收口跑 `--gate` 同款三查（ad32 枚举序门禁计数变更须随批改钉＋人工 review 注记；全量测试基线 2031 递增零红灯；双 tsc 0 错）。

**成本**：闸本身零新增代码——1/2 闸是流程约束（commit 粒度＋既有测试），3 闸是既有门禁的随批执行；仅次序钉随批扩充属测试增量。与 c1025-04 §3 成本估算（B 案 1-2 执行单）吻合，无重复建设。

## 四、结论（材料，非裁决）

- #4 两◐：三路证已补齐（本单 §一，◐→✓ 材料在档）；事件批量门设计就绪（§三），实施随 B 案注册表单走。
- #3 ◐（dslEval）：现值已是 9 行壳，两案中**甲案清壳**成本半单、推荐执行（待主班排单）。
