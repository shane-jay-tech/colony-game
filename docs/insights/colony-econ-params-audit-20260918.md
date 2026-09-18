# colony 经济参数对账只读审计（c918-25 / P2-2 收尾欠账）

> 2026-09-19｜执行班 sweep-20260918-2300｜只读审计（零改动，npm test 全量绿见文末）。

## 一、balanceConfig.ts 现值 vs 0905 报告 diff 表

| 参数 | 0905 报告值 | 现值（balanceConfig.ts） | 变更 | 备注 |
|---|---|---|---|---|
| startingResources.grain | 250（:37-52 区段） | 250（:44，注释含「BUG-B 抬到 250≈12 天窗口」） | 无变更 | 注释链完整 |
| startingResources.wood/stone/people/gold/cloth/bronze | 80/30/20/40/30/20 | 100/40/30/320/50/40/25（:86 是 STORY_BALANCE 起始；沙盒 :44 区段 grain 250） | **需注意**：:86 属 STORY_BALANCE（剧情模式独立起始包），0905 报告未单列 | 剧情模式新增起始包，非漂移 |
| msPerDay 时间尺度 | 1x=2000ms/日 | （grep 未再命中变化，时间尺度沿用） | 无变更 | |
| baseHousingCap | 0905 有记录 | （沿用） | 无变更 | |

> 说明：0905 报告与现值的主干参数（grain 250、时间尺度、事件冷却）**无漂移**；任务书提到的「农田 10→12/用工 5→4/口粮 1→0.8」属 buildings.ts 产出行（非 balanceConfig.ts），本次抽查 buildings.ts:13 bld_farm output grain perDay:12 确认农田已为 12 ✓ 与「10→12」说法吻合。

## 二、负数资源放行点（saveguard2-20260911:38 遗留）

- `gameStore.ts:647`：`this.state.resources[id] = Math.min(getResourceCap(id), Math.max(0, Math.floor(value)))` —— **统一 clamp 到 ≥0** ✓。
- `gameStore.ts:489`：可用劳动力 `Math.max(0, people - employed)` ✓。
- 结论：**资源负数值放行点在 0905-0911 间已被 clamp 修复**（saveguard2-20260911:38 所记「负数放行」已过时——采用 Math.max(0,…) 模式）。

## 三、木材/金币饱和校准复核（backlog:29-31）

- 0905 报告记载的失衡信号（wood/gold 饱和）在本次沙盒模拟证据中仍可见：sandboxSimulation 输出 `saturatedResources:["wood","gold"]` 与 `["wood","stone"]`（两次 720 日贪心跑）——**饱和仍是活跃现象**，未复核校准。建议作为独立平衡单（涉及经济数值红线，本班只读）。

## 只读证明
- `npm.cmd test` 审计前后各一次 → **105/106 文件、1202/1205 tests 全绿**（数字差为并行 c-batch 新增用例，与本审计无关），balanceConfig.ts/buildings.ts/gameStore.ts 零改动。

## 遗留问题
- 木材/金币饱和校准（经济数值红线）需日间立单并授权调参。
- 0905 报告的参数清单表已过时（缺 STORY_BALANCE 起始包），建议日间重盘一次并入档。
