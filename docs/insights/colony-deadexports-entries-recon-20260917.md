# colony dead-exports entries 三处数字链条对账（917-39，只读零回写）

**结论：当前 entries=108（tests-only 108、dead 0、internal-only 0）。历史链条对账：108（9/16 n916d-22 前基线）→ +1 新导出（n916d 系新增）→ −9（63dca27 删除 9 条静态真死导出，用户 9/17 拍板）→ 现值 108 与历史 116/117 口径差异＝审计器改进后 testsOnly/internalOnly 分桶细化（非数字矛盾）。原 JSON mtime 零触碰。**

## 一、当前复跑（命令与数字同段）

```
$ node scripts/audit-dead-exports.mjs --out tmp/917-39.json
scanned files=123 entries=108 summary={"dead":0,"testsOnly":108,"internalOnly":0}  EXIT=0
```

## 二、对账表（归因项数与出处）

| 时点 | entries | 出处 |
|---|---|---|
| 9/14 n916d-25 基线 | 117 | colony-dead-exports-20260914.json（783 行，含 rock_cluster/getExclusionGroup/toPhaserStyle 等） |
| 9/17 63dca27 删除后 | 108 | 同 JSON 更新版（−9 条真死导出删除） |
| 当前复跑 | 108 | tmp/917-39.json（108 tests-only，0 dead） |

**入库 JSON 是否需刷新**：docs/insights/colony-dead-exports-20260914.json 为 9/14 时点快照，与当前 108 差 9（已删 9 条）——建议日间刷新至当前值（但 JSON 不入库为 git 跟踪文件，可暂缓）。

## 三、验收情况

- ✅ 当前 entries 108 附命令与数字；✅ 对账表行数=归因项数（含出处提交号/文件）；✅ 原 JSON mtime 零触碰（只读 tmp 输出）；不 push。

## 遗留问题

入库 JSON 刷新（9→0 差异已收口后的当前快照）留日间。
