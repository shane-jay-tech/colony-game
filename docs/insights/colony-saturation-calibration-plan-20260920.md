# colony 木材/金币饱和校准方案（c919-51，只出方案不改数值）

- 上游：colony-econ-params-audit-20260918.md（饱和仍活跃）＋economy-params-inventory-20260905.md（参数清单，本班已补 STORY_BALANCE 段）
- 红线声明：**数值改动属经济平衡红线，本方案不执行任何改动**；复核通过后另立 apply 单（单事务+备份+回读断言+k919-30 同款纪律）。

## 一、复现（真实输出，本班实跑 2026-09-20 04:2x）

命令：`npx vitest run src/renderer/state/__tests__/sandboxSimulation.test.ts`（诊断输出行）

```
[P0-1] {"finalDay":720,"finalPopulation":115,"finalBuildings":40,"gradeReached":1,"crisisCount":0,
"hostileNpcActions":26,"gradeMilestones":[{"day":36,"grade":1}],
"finalResources":{"wood":9999,"stone":4393,"people":115,"grain":9895,"gold":9999,"cloth":0,"bronze":6,
"influence":70,"rite":4},"minResource":0,"maxResource":9999,"badResource":[],
"saturatedResources":["wood","gold"]}
```

- 饱和实锤：wood 与 gold 双双触 9999 上限；grain 9895 逼近上限；stone 4393 偏高但未触顶。
- 时间形态：贪心策略 36 天即达城邑（grade1），此后 680 天无高级消耗出口→堆积饱和。

## 二、候选参数改动清单（每项：现值→建议值、依据、影响面、回滚）

| # | 项 | 现值→建议值 | 依据（模拟证据） | 影响面 | 回滚 |
|---|---|---|---|---|---|
| 1 | 伐木场产出 | 木 8/日 → 6/日 | wood 是唯一触顶资源；产出方单一（伐木+水碓副产） | 伐木线所有玩家；建筑节奏放缓 | balanceConfig/buildings 单键还原＋沙盒复跑对照 |
| 2 | 市集金币产出 | 金 5/日 → 3/日（维持布 5+粮 3 消耗） | gold 触顶而 cloth 0＝布被市集吃光换金，金无对应消耗出口 | 通商流（通商需金门槛）节奏 | 单键还原＋720 日复跑 |
| 3 | 仓储上限生效 | 结构化字段落地（descPlain 文案口径，仓廪 +50% 储量上限） | 饱和=无上限堆积的镜像问题；上限落地后 9999 触顶自然延迟 | 仓廪建筑语义明确化 | 字段回退（纯新增） |
| 4 | 通商金币门槛动态化 | `(gold - 50) >= goldTarget` → 按 grade 分档门槛 | 720 日通商 24 次＝每 30 日机械触发，金回收不足 | 通商策略深度 | 比较函数还原 |

## 三、执行约束（apply 单需含）

- 单事务+写前备份（VACUUM INTO / git 快照）+回读断言+沙盒 720 日复跑对照（saturatedResources 应从 ["wood","gold"] 收敛为 [] 或 ≤1 项）。
- 4 项建议**逐项分单**执行（每项独立回滚粒度），禁止打包。

## 四、零改动声明

本班仅改文档（0905 清单补 STORY_BALANCE 段＋本方案）；`src/renderer/data/balanceConfig.ts` 等生产数值文件零 diff；npm test 审计前后两次全绿（1227 passed，输出见 result）。
