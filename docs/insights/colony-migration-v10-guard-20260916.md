# colony 存档迁移 v10 前向守护设计材料（c916-06，不实现）

- 任务：c916-06-colony-migration-forward-guard（created 2026-09-16T00:05:51，软预算 ≤30 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 03:4x
- 与 n915-63 同源互补（该稿侧重用例规范，本稿侧重三落点与检查清单）。

## 一、bump v10 三落点（file:line）

| 落点 | 位置 | 动作 |
|---|---|---|
| 常量 | saveLoad.ts:19 `SAVE_SCHEMA_VERSION = 9` | → 10 |
| 迁移表 | saveLoad.ts:122 `migrations` 增 `9: (blob) => {...}`（v9→10 注入/变换） | 新增迁移函数 |
| fixture | saveMatrix.test.ts `blobAt()`（:9-21）可参数化生成 v9 档，无需新 fixture 文件 | bump 后 blobAt(9) 自动成为「旧档」输入 |

## 二、「漏写迁移即红」守护断言（基于现有组 A/C）

- 组 A（saveMatrix.test.ts:25-33）：遍历 v1..SAVE_SCHEMA_VERSION-1 逐档 deserialize——漏写 migrations[9] 时该档抛「No migration path from schema version 9」（saveLoad.ts:202）→ 组 A 红；
- 组 C（:65-66）：`SAVE_SCHEMA_VERSION 恒为 9` 的恒等断言——bump 时必须同步改 10，否则红（版本号与迁移表的双重确认）；
- 预期绿：bump 后组 A 全档连通＋组 C 改 10 后通过＋组 B 专例（wrath 注入）保持。

## 三、落地检查清单（不实现）

1. saveLoad.ts:19 版本 9→10；
2. saveLoad.ts:122 migrations 增 9→10 变换（业务字段注入/归并按当次需求）；
3. saveMatrix.test.ts 组 C 恒等断言改 10；
4. blobAt 已参数化，无需新 fixture；
5. `npx vitest run src/renderer/state/__tests__/saveMatrix` 全绿＋`npm run type-check` 0 error；
6. 组 A 收尾 failedVersions 显式断言通过（:42）。

## 四、声明

纯设计：`git diff --stat` 为空 ✓；不 bump 版本、不改 saveMatrix.test.ts、不 push。

## 遗留问题

无。
