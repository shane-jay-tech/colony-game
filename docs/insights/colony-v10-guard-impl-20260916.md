# colony v10 迁移前向守护断言实现（n916x-34，设计稿 colony-migration-v10-guard-20260916 落地）

**结论：saveMatrix.test.ts 落地两组守护增强——组 A 收尾遍历范围改版本常量派生（bump 后自动扩展）＋C 组配套「最新前一档必须有迁移路径」断言；守护有效性实跑证明＝临时禁用 migrations[8] → 18 failed/1 passed（No migration path from schema version 8 to 9），恢复 → 19 passed；全量 `npm test` 94 文件 1154 passed（1153＋本班新增 1），EXIT=0。版本号零 bump、生产迁移逻辑零改动。**

## 一、改动明细（仅测试文件）

| 处 | 原状 | 现状 |
|---|---|---|
| 组 A 收尾（:41-42） | `expect(collected).toEqual([1,...,8])` 手写清单 | `toEqual(Array.from({length: SAVE_SCHEMA_VERSION-1}, ...))` 派生——bump 后自动要求新档在列 |
| 守护 describe（:65-69） | 仅 SAVE_SCHEMA_VERSION 恒等断言 | 新增「C 组版本恒等配套」：`deserialize(blobAt(SAVE_SCHEMA_VERSION-1))` 不得抛 No migration path——直接证明「新版本号必须有迁移项」，无需导出 migrations（生产零触达） |

## 二、守护有效性实跑证明（命令与输出同段）

```
①临时禁用 migrations[8]（脚本化注释，备份 saveLoad.ts.n916x34-bak）：
  npx vitest run …/saveMatrix → Tests 18 failed | 1 passed (19)
  错误行×4：「No migration path from schema version 8 to 9」⇐ 组 A v8 档红＋C 配套红
②恢复备份（mv 还原）：
  git diff --stat src/renderer/state/saveLoad.ts → 空（零净改动）
  npx vitest run …/saveMatrix → Tests 19 passed (19)
$ npm test → Test Files 94 passed (94)；Tests 1154 passed (1154)；EXIT=0
```

## 三、验收情况

- ✅ `npm test` 全量 failed=0（94/1154，命令与数字同段）；✅ 『删迁移项→红／恢复→绿』两次实跑输出在册（§二）；✅ 版本号零 bump、迁移表零删除（临时禁用已还原、净 diff 空）；✅ fixture 复用 blobAt 未新增基建；测试改动精确路径 git add，未 push。

## 遗留问题

无。bump v10 的三落点操作按设计稿§三清单由未来实现单执行（守护现在会自动盯住）。
