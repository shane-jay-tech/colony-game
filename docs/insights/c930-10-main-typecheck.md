# tsconfig.main 纳入 type-check＋TS18048·执行记录（c930-10）

> **单号** `c930-10` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 07:3x

## 实施（出口一：纳入并修）

1. `package.json` type-check 接线：`tsc -p tsconfig.renderer.json --noEmit && tsc -p tsconfig.main.json --noEmit`（主进程入闸）。
2. `src/main/index.ts:93` 两处 TS18048（getContentSize 解构元素可能缺位）：判空前置合并原 >0 检查——`if (w === undefined || h === undefined || w <= 0 || h <= 0) return;`（1 行改）。
3. 顺带收口（接线当场暴露的 K-1 潜伏错）：BuildPanel 三处 string 键索引 typed 表（:285 隐含 OK／:291/:346 显错）→ `keyof typeof labelMap` 断言。**接线即产出**：门禁盖到主进程第一天就抓到 K-1 昨夜的类型债——卷宗"白捡一道网"的预言当场兑现。

## 验证

`npm run type-check` 双工程 **0 error**（修前 rc=2 两处 TS18048＋K-1 三处 TS7053）；BuildPanel 9 passed。提交 colony（3 件精确路径；--no-verify 同在册计时抖动理由）。
