# c927-19 每资源日产出/消耗时间序列·统计埋点设计稿（0304 遗留2）

> 来源：`zcode-bridge/done/20260925-154156-0304.result.md` 遗留 2——「每资源日产出/日消耗时间序列（而非期末快照）需给模拟 harness 加统计埋点」。**本档只出设计、零码改动**；复核基线 HEAD `8a9eaea`（2026-09-28）。
> 红线声明：本稿只定义「怎么量」，不含任何经济平衡数值结论；后续读数产出另行走取证口径。

## 0. 关键前提：资源记账已有单一汇聚点（设计可行性的根基）

全仓生产性写入 `state.resources` 只有一处——`setResourceClamped`（`src/renderer/state/gameStore.ts:655`，赋值在 :657）：

```
$ rg -n "state\.resources\[[^\]]+\]\s*=" src/renderer -g '*.ts' | grep -v setResourceClamped
（src/__tests__ 一处测试夹具，生产码零旁路）
```

所有加减都漏斗到此：`addResource`（:686）、建造扣费（:798）、升级扣费（:894）、其余散点（:928 等）最终全部调 `setResourceClamped`。**在 :655 一处挂钩即得全量流水量**，无需在各业务点散埋。

## 1. 埋点位置（file:line）

| # | 位置 | 挂什么 | 为什么 |
|---|---|---|---|
| P1 | `gameStore.ts:655` `setResourceClamped` 入口 | 流水记录：`(day, resourceId, appliedDelta, rawDelta)`。appliedDelta＝钳制后实际变动（`newValue − (state.resources[id] ?? 0)`），rawDelta＝钳前意图（`value − current`），两者差即**上限截断/下限截断量** | 单一汇聚点，一处挂钩全覆盖；同时抓「想产产不进（触顶）」与「想扣扣不动（触底）」 |
| P2 | `dayPipeline.ts` `buildDayPipeline` 相位包装层（文件级，函数在 `gameStore.ts:961-984` 组装） | 相位作用域标记：production/military/population/conversion/starvation 五个经济相位执行前置当前相位名，退出清除。探针按相位名分流 produced/consumed 桶 | 产出/消耗的语义归属由相位给（P1 只知数值不知语义）；包装层零改业务函数体 |
| P3 | `gameStore.ts:953` `tickDay` 末尾 | 日切：把当日桶冻结成一行时间序列，清桶 | 日粒度闭合点；day 取 `state.currentDay` |
| P4 | harness（`sandboxSimulation.test.ts:207` `store.tickDay()` 调用处） | 收集器装配：`store.attachFlowProbe(probe)`（设计新增的挂载口，探针关闭时为 null 无开销）＋模拟结束导出 | 只动测试面 harness，不触任何生产调用方 |

**分桶语义**：`production` 相位（`runProductionTick` :1079）→ produced；`military`（:1987 军粮）/`population`（:2564 口粮）/`starvation` → consumed；`conversion`（:2658）→ 单列 transfer 桶（进出同记，避免把转换误读成净产）；其余相位变动入 other 桶（应近零，非零即发现未归类经济流）。

## 2. 数据结构

```ts
/** 单日单资源流水行（冻结后不可变） */
interface ResourceDayFlow {
  day: number;                    // state.currentDay（日切时点）
  resourceId: ResourceId;         // 资源 id，清单取 RESOURCE_IDS（resourceRegistry，类型穷尽）
  produced: number;               // 该日 produced 桶 appliedDelta 合计
  consumed: number;               // 该日 consumed 桶 appliedDelta 合计（恒 ≥0 语义，取负向 applied 绝对值）
  transferredIn: number;          // conversion 相位净入（转换不折算净产）
  other: number;                  // 未归类相位净变动（健康应为 0）
  rawProduced: number;            // 钳前意图产出（与 produced 之差＝上限截断，wood 触顶 9999 场景即由此显形）
  endStock: number;               // 日切时库存快照（对账锚）
  clampHits: number;              // 当日该资源被钳制次数（触顶/触底事件计数）
}
```

内存形态：`Float64Array(RESOURCE_IDS.length × 8)` 按日复用两个日桶（避免每笔变动分配对象），日切时才物化一行普通对象。720 日 × 10 资源 ≈ 7,200 行 ≈ 每行 8 数 + 3 字段，全量 < 300 KB。

## 3. 落盘格式

- **主格式 JSONL**（每行一资源一日的 JSON 对象，append 友好、逐行可 diff、双策略文件天然分离）：
  `tmp/sim/<strategy>-<seed>-<days>.jsonl`，行如 `{"day":305,"resourceId":"wood","produced":8,"consumed":0,"transferredIn":0,"other":0,"rawProduced":9,"endStock":9999,"clampHits":1}`
- **导出 CSV**（同目录 `.csv`，pivot 长表 `day,resource,produced,consumed,transferred_in,other,raw_produced,end_stock,clamp_hits`）供表格透视；由 JSONL 一次性导出，不双写。
- 命名带 strategy/seed/days 三元组，与 0304 的「贪心/均衡、seed=0、720 日」样本对齐。

## 4. 性能影响估算（有依据）

| 项 | 估算 | 依据 |
|---|---|---|
| 每笔变动增量成本 | 1 次查表 + 2~4 次浮点加减 + 可选判空（探针未挂载时早退 ≈1 次null比较） | P1 是既有必经路径，只加算术不加 I/O；`Float64Array` 日桶零分配 |
| 每日变动笔数 | 10² 量级（40 栋产出/维持 + 各相位散点，harness 规模见 0304） | 建筑数 ~40 × 产出+维持 2 笔 + 人口/军事/转换散点 |
| 全程增量 | 720 日 × 10² 笔 ≈ 7×10⁴ 次 O(1) 记账 ≈ **毫秒级** | JS 简单数值操作 ~10⁻⁸s/次 |
| 与既有基线对照 | 0304 两条 720 日策略实测共耗 ~6 分钟墙钟（13:34–13:40），瓶颈在引擎逻辑与 Phaser 场景构造，不在资源算术 | 埋点增量预计 **<0.1%**，量级上不可测 |
| 落盘 I/O | 720 行 × ~150 B ≈ 110 KB/策略，模拟结束一次性写 | 出模拟路径，不在热循环 |

## 5. 测试方案

1. **守恒不变量**（逐日硬断言）：`endStock(d) = endStock(d−1) + produced(d) − consumed(d) + transferredIn(d) + other(d)`——appliedDelta 口径下**精确成立**（钳制后的实际变动自洽）；raw 与 applied 之差另断言 `≤ clampHits 对应截断量`。
2. **快照对账**：序列首行 endStock 前推初值，末行 endStock 必等于 0304 同款期末快照 stats（两口径互证，防漏记相位）。
3. **确定性**：同 seed 同策略重跑两次，JSONL 逐字节相同（sha1 断言）——RNG 已定，流水不允许抖动。
4. **钳制显形**：构造 wood 必然触顶的种子/策略，断言 `rawProduced > produced` 且 `clampHits > 0`（验证 P1 双口径有效，这正是 0304 观测到触顶却无法定位发生日的痛点）。
5. **零探针零开销**：不挂 probe 跑既有全量 vitest，断言全部既有用例读数不变（守卫 P1 早退分支不引入行为差异）。

## 6. 落地拆单建议（供主班排产，非本单执行）

- 单 A（实现）：P1+P2+P3+P4 ≈ 60–80 行（探针类 ~40 + 相位包装 ~15 + 挂载口 ~10）＋测试 5 条 ≈ 100 行，一单可收。
- 单 B（消费）：harness 出 JSONL/CSV＋0304 样本复跑出序列——**读数结论属统计数值域，须按红线走人工放行**，与本设计单分离。

## 7. 零码改动自证

本档为设计稿，未新增/修改任何仓库文件（含 tmp）；全部锚点为只读 `rg`/`sed` 读数，命令原文见正文。
