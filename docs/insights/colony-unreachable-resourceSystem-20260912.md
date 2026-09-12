# colony resourceSystem.ts 不可达模块处置报告（h912-14，2026-09-13 夜班）

任务：按 PLAN.md:31 二分规则（移除或接入）处置 state/resourceSystem.ts；本单只处理该模块，不动 storyNpcs.ts / terrainTextures.ts。

## 一、引用取证（rg 原文，区分两类）

```
$ rg -n 'resourceSystem' --glob '!**/node_modules/**'
docs\history\SLICE_A_SPEC.md:137:## DELIVERABLE 3: src/renderer/state/resourceSystem.ts      ← 历史规格（非代码）
docs\history\SLICE_A_SPEC.md:287:### src/renderer/state/__tests__/resourceSystem.test.ts      ← 历史规格（非代码）
tmp\reach_table.md:86:| src/renderer/state/resourceSystem.ts | 2 | 0 | 0 | 1 | 0 | 疑似不可达（仅测试引用） |  ← 盘点工件
src\renderer\state\__tests__\resourceSystem.test.ts:2:import { computeDayDeltas, tickModifierLifecycle } from '../resourceSystem';  ← 自身 legacy 测试
docs\decisions\2026-06-07-impl-labor-occupancy-model.md:29 ← 历史决策：「该函数当前未被调用（已被 computeProductionTick 取代）」
docs\decisions\2026-06-15-impl-health-fixes-and-music-verify.md:13 ← 历史决策（测试夹具修补记录）
```

- **生产路径引用：0**；仅自身 legacy 测试引用 1 处。
- 佐证：2026-06-07 决策明确 computeDayDeltas 已被 computeProductionTick 取代、仅留防误引 guard。

> 注：任务书所引 `docs/insights/colony-module-reachability-20260911.md` 不存在（rg ls 实证）；盘点表实际在 `tmp/reach_table.md:86`，结论一致（疑似不可达，仅测试引用）。本单以自取证的 rg 原文为准。

## 二、处置：移除（二分的「删」支）

- 备份：`tmp/backup-colony-20260912/state/resourceSystem.ts`（79 行）＋ `tmp/backup-colony-20260912/state/resourceSystem.test.ts`（168 行）。
- `git rm src/renderer/state/resourceSystem.ts src/renderer/state/__tests__/resourceSystem.test.ts`。
- 该测试文件 import 的其余模块（gameStore/schema/resourceRegistry/mapGen/factionSystem）均为被其他测试共享的活模块，未受影响；无 barrel 再导出（rg 实证零命中）。

## 三、类型与测试门

- 命令：`npm run type-check`（= `tsc -p tsconfig.renderer.json --noEmit`；仓库根无 tsconfig.json，裸 `npx tsc --noEmit` 会落 help——沿用 h912-11 报告口径）。
- 改后：type-check **exit 0**（无新增错误）；`npm test` → **86 files / 1120 tests 全部通过**（改前 87/1127——恰减被删 legacy 测试 7 条，零新增失败）。

## 四、进度

PLAN.md:31 条目（不可达模块退役）：**已处理 1/3**（resourceSystem.ts ✓；storyNpcs.ts / terrainTextures.ts 留后续两单）。

## 遗留问题

- 恢复方式：从 tmp/backup-colony-20260912/state/ 拷回两文件即可（tmp 不入库，git 历史亦保留全量内容）。
- storyNpcs.ts / terrainTextures.ts 处置同规则，留 h912-14 后续单/批次二。
