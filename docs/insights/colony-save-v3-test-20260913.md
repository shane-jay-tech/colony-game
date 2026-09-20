# colony 存档 schema v3 兼容读取回归（c-22，2026-09-13）

## 新增 3 用例（saveLoad.test.ts「c22 schema v3 compat read」describe）

1. v3 存档经 3→9 迁移链读取成功（currentDay/rngSeed 保留）；
2. v3 路径钳制生效（speed=99 腐化值钳到 1）；
3. v3 缺 state（形状非法）→ 抛错非静默——**现行为注记**：迁移链解引用抛原生 TypeError 而非 SaveLoadError 类型，「明确报错非静默」满足但错误类型欠规范，修复（迁移入口包 SaveLoadError）留另批。

- fixture：内联合成 v3 blob（makeV3Blob，无需外部文件；字段依据 migrations[2] 迁移目标态构造）；
- 全量 `npm test`：**87 文件 / 1117 passed, 0 failed**（1114+3）；既有 saveGuard1-3/saveLoad 测试全数保留。
- 未改存档格式、未写真实用户存档 ✓。
