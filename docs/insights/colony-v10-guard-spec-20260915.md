# colony 存档 v10 bump 前向守护测试设计稿（n915-63，不写实现）

- 任务：n915-63-colony-v10-guard（created 2026-09-15T23:39:01，cwd colony-game，软预算 ≤30 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 02:5x
- 代码锚点：`src/renderer/state/saveLoad.ts:19`（SAVE_SCHEMA_VERSION=9）、`:122`（migrations 表）、`:198-202`（while 循环＋「No migration path」抛错）、`:380-382`（future version 拒载）。
- 既有测试结构：`src/renderer/state/__tests__/saveMatrix.test.ts:25`（组 A：v1..VERSION-1 全档连通，遍历式）、`:42`（A 组收尾显式 failedVersions 断言）、`:48`（组 B：v8→9 通牒注入＋字段保留）、`:65`（组 C：版本号恒等守护）。

## 一、与现 v9 用例的差异点

1. 组 A 是**遍历式**（v1..SAVE_SCHEMA_VERSION-1 自动包含新档位）——bump 到 10 后组 A 自动覆盖 v9→10，但**没有 v9 fixture 就无法真正跑**（现组 A 用各档位老 fixture 驱动，v9 需新造）。
2. 组 B 是 v8 专例（8→9 通牒注入）——v10 需要新的「10→11」专例组，验证的是**未来 bump**，当前无意义；真正要补的是 v9 现档 fixture 化（为下次 bump 备料）。
3. 组 C 断言 `SAVE_SCHEMA_VERSION 恒为 9`——bump 时此处**有意变红**（提醒同步 migrations[9]），是设计内的红。

## 二、v10 bump 时需补用例规范（≥4 条；输入/断言/期望红形态）

| # | 用例 | 输入 | 断言 | 期望红形态（漏写时） |
|---|---|---|---|---|
| 1 | v9 fixture 固化 | 取当前 v9 存档样例（saveLoad v9 导出）固化为 `__fixtures__/save-v9.json` | 加载后 version=10 且业务字段不变 | 漏写 migrations[9] → 组 A 该档「No migration path from schema version 9」 |
| 2 | migrations[9] 存在性 | 静态断言 `migrations[9]` 为函数 | `typeof migrations[9] === 'function'` | 组 C 版本号断言红（「恒为 9」需同步改 10），双保险 |
| 3 | v9→10 字段保留 | v9 fixture＋玩家字段（grain/成员名） | 迁移后 grain/名册原值保留（组 B 同款形态） | 字段丢失即红（deepEqual 全量比对） |
| 4 | v10 新字段默认值 | v9 fixture 迁移 | 新增 v10 字段＝迁移函数注入的默认值（非 undefined） | 新代码读该字段 undefined 崩 → 红 |
| 5 | future version 拒载 | 构造 schemaVersion=11 存档 | 抛「future schema version 11」（:380-382） | 未维护上限时误迁 → 红 |

## 三、声明

未改 saveLoad.ts、未新增/修改测试文件（本文为设计稿）；引用组结构 file:line 见首节。

## 遗留问题

无（实施随 v10 bump 任务走，本稿即规范）。
