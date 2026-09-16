# colony insights 索引与现实份数漂移重算（916p-a3-003 关联单，2026-09-17）

## 实测（命令与数字同段）

```
$ ls docs/insights/*.md | wc -l
29
```

（任务书作者快照 25 份；本班又新增 4 份 kyn/cwd/hygiene 类报告后为 29。）

## 重算节已追加到索引

`docs/insights/colony-insights-index-20260915.md` 末尾追加「## 2026-09-17 重算（916p-a3-004）」节：

- 实际份数 **29**；被引用（README.md/docs/design rg 命中）**1** 份；未引用 **28** 份（清单 29 行全列在索引文件内）。
- 9/16 新增 5 份已补登（hardcoded-inventory/kiln-market-semantics/migration-v10-guard/savematrix-extend/retired-module-residual）。
- 旧节历史表述未改（历史快照原则）。

## 逐份引用面表

29 行完整表已写入索引文件重算节（本报告不重复展开）；未引用 28 份清单以其为准。

## 验收对照

- ✅ 份数实测 29（同段）与索引重算节一致。
- ✅ 逐份引用面表行数=29=实际份数。
- ✅ 只改索引文件（追加节），未删任何 insights 文件、未改 README/OPTIMIZATION_BACKLOG 正文。
- ✅ 精确路径提交；不 push。
