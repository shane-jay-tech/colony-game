# aegis 索引校验纳入例行方案（n915-64，只出设计）

- 任务：n915-64-colony-aegis-cadence（created 2026-09-15T23:39:01，软预算 ≤20 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 02:5x
- **路径勘误：校验器实位于 `kaoyan-study-showcase/scripts/verify-aegis-index.mjs`**（d914-79 的 cwd 为 kaoyan-study-showcase；colony-game/scripts/ 下无此件——任务书写错仓）。colony-game 侧的 aegis 关联件为其 docs/aegis 索引的**收录对象**（colony-game 的 aegis 工作区文件被 showcase 索引收录）。

## 一、复跑输出（原样）

```
$ node scripts/verify-aegis-index.mjs   （kaoyan-study-showcase 内）
PASS 78/78
exit=0
```

边界：校验器只读（核对 aegis 索引收录 vs 磁盘文件，无写入、无网络）——纳入例行无副作用。

## 二、接入方案对比（≥3 路径，不实施）

| 路径 | 做法 | 需改文件 | 影响面 |
|---|---|---|---|
| ① npm script | showcase package.json 增 `"audit:aegis": "node scripts/verify-aegis-index.mjs"`，挂进既有 test/audit 链 | showcase package.json（1 行） | 最低；仅 showcase 仓内可发现性 |
| ② 夜班任务化 | 每周一次 bridge 任务（cwd showcase）跑校验并转录结果 | 无代码改动；投单即可 | 零侵入；靠夜班排期纪律 |
| ③ 文档例行 | showcase docs/aegis README 写入「改动收录对象后须跑校验」例行条 + colony-game docs 提示 | 2 个 md（各 1 行） | 零代码；依赖人工遵守 |
| ④ colony 侧联动 | colony-game package.json 加远程调用脚本 | colony package.json＋跨仓路径耦合 | **不推荐**（跨仓耦合） |

**建议 ①＋③**：npm script 让校验可发现可执行，文档例行条约束时机（收录对象变更后）。

## 三、声明

未修改 package.json、未注册 npm script；校验器只读、无副作用边界已核（exit 0，PASS 78/78）。

## 遗留问题

无（方案择一后实施为 1 行改动）。
