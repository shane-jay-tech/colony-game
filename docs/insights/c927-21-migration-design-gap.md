# c927-21 迁入事件·设计稿 vs 代码现状差距核对

> 来源：`zcode-bridge/done/20260925-154157-918a.result.md` 遗留 2——「迁入若有独立事件设计（design 稿 Phase 2），当前代码未见实现，登记供主班核对设计差距」。
> 复核基线：HEAD `8a9eaea`（2026-09-28）。零码改动，全部为只读 rg/sed 读数。

## 0. 先答 918a 的悬置：设计稿里**没有**迁入事件设计

918a 的措辞是条件句（「**若有**独立事件设计」）。本核对实测：**条件不成立**。

```
$ rg -n "Phase 2" docs/design/GAME_DESIGN_LIFECYCLE.md
416:- **Phase 2 · 故事框架（不含全部内容）**
$ sed -n '416,420p' docs/design/GAME_DESIGN_LIFECYCLE.md
- **Phase 2 · 故事框架（不含全部内容）**
  - 序章→统一→跳变→过场 流程
  - 叙事导演层 + 章节目标解锁
  - 隐性双轴 + 史官氛围反馈 + 三结局判定骨架
$ rg -n "迁入|移民|人口流入|新居民" docs/design/*.md
（docs/design/ 全目录 0 命中）
```

Phase 2＝故事框架（序章/导演层/双轴/三结局），**不含任何人口或迁入事件设计**；Phase 3（七卷内容）同样无人口迁入条目（:421-424）。全 docs/design/ 十七份稿纸「迁入/移民/人口流入/新居民」四词 0 命中。

**全仓「迁入」二字的全部命中均为它义**（存档 schema 迁移/代码搬迁）：

```
$ rg -ln "迁入" --no-ignore -g '!node_modules' -g '!tmp' -g '!*.log' .
src\renderer\state\__tests__\saveMatrix.test.ts:20        ← 「迁入当版」＝schema 迁移义
src\renderer\state\__tests__\dslEvalCompat.test.ts:3,30   ← 「测试件迁入」＝搬迁义
src\renderer\data\balanceConfig.ts:7                      ← 「未迁入此处」＝搬迁义
docs\insights\c927-30/31/38-*.md                          ← 同上两义
```

## 1. 代码现状（迁入实现点实测）

1. **无独立迁入机制**：人口域＝自然增长单通道——`gameStore.ts:2535`（Phase1 人口增长）＋ `population.ts`（住房上限 `country_population_cap` 作增长门槛，:473/:1238-1239）；出生与迁入不可区分（918a 原结论，复核成立）。
2. **唯一迁入风味内容**＝一枚抉择事件 `evt_b_refugee_influx`（`src/renderer/data/eventsExpanded.ts:510-518`）：

```
$ sed -n '510,518p' src/renderer/data/eventsExpanded.ts
    id: 'evt_b_refugee_influx',
    triggers: [{ condition: 'random', value: 0.09 }],
    contexts: [… title: '流民涌入', desc: '邻邦战乱，流民来投。' …],
    choices: [
      { text: '开城接纳', effects: [{ target: 'country_population_growth', op: 'add', value: 5 },
                                   { target: 'country_grain_output', op: 'add', value: -2 }], … },
      { text: '紧闭城门', effects: [{ target: 'country_renown', op: 'add', value: -3 }], … }],
```

   注意其机制形态：**增长率 modifier +5（间接、被住房上限钳制、按复利摊到多日）**，不是「直接 people +N」的一次性迁入；9% 随机触发、无来源国/规模参数。
3. 事件数据面其余人口相关文案（`events.ts:145` 「封锁边境，严防流民」、`eventsExpanded.ts:102` 流民抗税）均为剧情风味，无人口迁移效果。

## 2. 差距清单（设计有/代码无 · 逐条带证据与代价）

| # | 差距 | 证据 | 实现代价估计 |
|---|---|---|---|
| G1 | **设计侧空白**：Phase 2 无迁入（乃至任何人口事件）设计章节；918a 悬置就此关闭——不是「实现欠账」，是「设计未立项」 | §0：:416-420 全文无人口字样、docs/design 四词 0 命中 | 0 码——若主班要立项，先补设计稿一节（人口事件批次规划），产出为文档 |
| G2 | **代码侧无独立迁入通道**：出生/迁入同一正增长复利通道（918a :32 锚），迁入在数值上不可观测、不可单独平衡 | §1.1；918a 遗留原文 | 若拍板「迁入=独立通道」：事件效果引擎需支持 `target: 'people'` 直接增量（现效果引擎只有 country_* modifier 面，`eventsExpanded.ts` 全量佐证），或新建 migrationSystem——估 **100–200 行＋测试 ~40 行**，中单 |
| G3 | **唯一风味事件是间接的**：「开城接纳/收留」文案承诺与机制（growth modifier）不匹配——玩家直觉「+5 人」实际是「增长率 +5，被住房上限钳着、摊成多日小数增长（还走残差累积器）」 | §1.2：`country_population_growth +5` vs gameStore.ts:261 残差累加器、:473 住房上限 | 若拍板「迁入=直接增量」随 G2 一并改：该事件 effects 换 `people` 直加 ~5 行＋断言 2–3 条；不改则建议文案订正（「招徕流民，垦荒人手渐增」），0 码 |

## 3. 给主班的三选一（非本单代拍）

- **甲：不立项**——迁入维持「出生同通道」现状（918a 口径），G3 只做 0 码文案订正防误导。推荐给「Phase 2 故事框架优先」的当下排序（设计稿 :387 进度注：故事模式待 Phase 2/3）。
- **乙：轻立项**——只做 G3 机制订正（evt_b_refugee_influx 改直接 people 增量＋住房上限交互说明），不动系统。代价 ~10 行，随任意事件批搭车。
- **丙：全立项**——G2 独立迁入通道＋迁移事件批次（来源国/规模/接纳政策），走完整设计稿→实现单流程，排在 Phase 2 之后。

## 4. 零码改动自证

本档零写入仓库（唯一产出＝本档，untracked 交主班代提交）；全部读数为 `rg`/`sed` 只读命令，原文见正文；树上在途脏项未碰。
