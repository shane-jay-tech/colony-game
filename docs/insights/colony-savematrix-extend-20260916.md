# colony saveMatrix 组 B 字段保留断言扩展（c916-07）

- 任务：c916-07-colony-savematrix-extend（created 2026-09-16T00:05:51，软预算 ≤30 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 03:4x
- **结论：done——新增独立测试文件 5 用例全绿（saveMatrix 主件 13 用例维持，合计 18 >13）；saveLoad.ts 零改动（git status 为 0 行）；全量 vitest failed=0。**

## 一、v8→v9 玩家字段行为盘点

- 注入：`wrathUltimatumEndDay = null`（saveLoad.ts:185-192，8→9 唯一迁移动作）；
- 保留：rngSeed/speed/resources{grain,people}/buildings/policies/activeModifiers/activeDecrees（迁移只注入新键，不触碰既有键）；
- 既有组 B 已覆盖：wrath 注入 null、lastPropagandaDay null（5→6 旧注入）、grain 保留。

## 二、扩展断言（5 用例，新文件 saveMatrix.extend.test.ts）

1. rngSeed 原值保留（7）；2. speed 保留（1）；3. people 保留（9）；4. 四容器字段 Array 保留；5. 注入不增删 state 既有顶层键（wrathUltimatumEndDay 在，其余原键全在）。

## 三、验收（先命令后数字）

```
cd D:/code/colony-game && npx vitest run src/renderer/state/__tests__/saveMatrix.extend.test.ts
→ Test Files 1 passed；Tests 5 passed
git status --short saveLoad.ts → 0 行（迁移函数与 saveLoad 零改动）
全量（详见班志）：vitest 全套 failed=0
```

## 四、声明

未改 saveLoad.ts 与迁移函数；未 bump 版本；不 push。

## 遗留问题

无。
