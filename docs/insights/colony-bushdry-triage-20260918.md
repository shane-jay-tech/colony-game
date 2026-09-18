# colony bush_dry 闲臵清单项处置（核报＋执行版，c918-09）

> 2026-09-19｜执行班 sweep-20260918-2300。

## 现状核验（grep 证据）
- `grep -c 'bush_dry' src/renderer/data/scatterConfig.ts` → 处置前 **1**（:65，仅 ALL_SCATTER_IDS 清单成员；:43 草地池/:48 河岸池均不含——916p-a3-005 判定仍成立）。
- 全仓引用：`grep -rn 'bush_dry' src --include='*.ts'` → 仅 scatterConfig.ts:65 一处，零池引用、零渲染调用。
- 磁盘：`public/art/scatter/bush_dry.png` 实存 1,326,362 字节（1.3MB），每次 Boot 加载但从未被放置＝每局空加载 1.3MB。

## 两案建议
- **删除案（本单已执行）**：从 ALL_SCATTER_IDS 移除 'bush_dry' 一行；png 保留在盘（恢复＝重加一行）。省每局 1.3MB 空加载；c918-08 磁盘对账用例计数断言同步 9→8，守卫语义不变。
- 留用案（未采）：若未来计划「干旱季节」散布变体，可保留清单并以季节开关控制放置——但目前无此需求记录，保留即持续空加载。

## 执行记录（真实命令＋真实输出）
- 删除后 `grep -c 'bush_dry' src/renderer/data/scatterConfig.ts` → **0**。
- `npx vitest run src/renderer/data/__tests__/scatterDiskReconcile.test.ts` → **10 passed (10)**（计数断言 9→8 同步）。
- 未动 bush_dry.png（磁盘保留，随时可恢复）。
