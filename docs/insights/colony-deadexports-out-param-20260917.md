# colony audit-dead-exports.mjs `--out`/`--write` 参数化（n916d-25）

- 班次：sweep-20260916-2300（9/17 08:2x 段）
- 结论：写盘参数化落地——n916c-17 披露的「只读复核即覆盖」副作用清偿；判定逻辑与计数口径零改动

## 一、参数语义（改后）

| 调用 | 行为 |
|---|---|
| `node scripts/audit-dead-exports.mjs` | 默认：写 `docs/insights/colony-dead-exports-20260914.json`（兼容不变）；因目标已存在且未给 `--write`，先写 `colony-dead-exports-20260914.json.bak` 再覆盖 |
| `... --out tmp/dead-exports-check.json` | 输出到指定路径，**原 JSON 零触碰**；目标存在且未给 `--write` 同样先 .bak |
| `... --write`（可与 --out 连用） | 显式允许直接覆盖（不写 .bak） |

实现（audit-dead-exports.mjs 写盘段，逐行语义）：`--out` 取 argv 相邻项（缺省＝原路径）；`--write` 开关；覆盖前 `copyFileSync(outPath, outPath + '.bak')`。扫描/分桶/计数逻辑零改动。

**回退方式**：`git revert <本提交>` 即恢复固定路径直写；既有 JSON 的 .bak 即改前快照，可 `cp .bak 原名` 手工还原。

## 二、验证（命令在前）

```
$ node scripts/audit-dead-exports.mjs --out tmp/dead-exports-check.json
scanned files=123 entries=117 summary={"dead":0,"testsOnly":117,"internalOnly":0}
rc=0
原 JSON mtime: before=1789571078 after=1789571078   ← 相等＝未触碰 ✓

$ node scripts/audit-dead-exports.mjs               （默认行为）
scanned files=123 entries=117 summary={...}
rc=0                                                ✓ 仍产出原路径 JSON
docs/insights/colony-dead-exports-20260914.json.bak 生成 ✓（.bak＝改前内容快照，保留）
```

计数注记：entries 117 vs n916c-17 时点 116＝+1（其间 artManifest 新增 `BUILDING_ART_REUSE` 导出，归因明确非口径漂移）；dead/testsOnly/internalOnly 分桶结构与既往一致。

## 三、零改动声明

导出判定逻辑（EXPORT_RE、分桶规则、word-boundary 口径）与计数口径零改动；既有 JSON 未删（.bak 另存改前快照）；`git diff` 仅 audit-dead-exports.mjs 与本报告。

——完。
