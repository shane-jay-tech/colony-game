# colony 陶窑→市集多源指向语义材料（c916-02，只列不改）

- 任务：c916-02-colony-kiln-market-semantics（created 2026-09-16T00:05:51，软预算 ≤25 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 03:3x
- 代码基线：src/renderer/data/buildings.ts；`git status --porcelain` 无新增源码改动 ✓。

## 一、bld_pottery_kiln → bld_market 的全部指向来源（逐来源表）

| 文件:行 | 字段 | 值 | 语义 |
|---|---|---|---|
| buildings.ts:169 | upgradesTo | 'bld_market' | 陶窑升级链终点指向市集 |
| buildings.ts:171 | adjacencyBonus | partner=bld_market, range 3, gold ×1.25「市廛近窑，陶器速售」 | 邻接加成（非升级） |
| buildings.ts:151-152 | output | gold ×2/日 | 陶窑本体产出（临市集文案＋25% 与 adjacency 对应） |

反向与同目标来源（对照）：
- buildings.ts:44：bld_well.upgradesTo='bld_market'（水井亦指向市集）；
- buildings.ts:84：bld_market.upgradesFrom='bld_well'（单值来源语义——只记了水井，未记陶窑）→ 不对称即 TODO 所指（buildingRefs.test.ts:63-65 只记不改）。

## 二、多源是否冲突的判定

升级链语义上「多来源→同一目标」与「单值 upgradesFrom」天然不对称：bld_market 可由水井或陶窑升级而来（多源合法），但其 upgradesFrom 是单值字段只能记一个（记了水井）——这是**字段形态限制**，非数据错误；陶窑→市集的升级路径在正向（upgradesTo）仍可达。

## 三、候选口径（2–3 个，不改码）

| 候选 | 内容 | 影响行数 | 是否需改测试 |
|---|---|---:|---|
| A. upgradesFrom 改数组 | `upgradesFrom: ['bld_well','bld_pottery_kiln']`，反向配对测试改集合包含语义 | buildings.ts 1 行＋测试 2-3 行 | 是（测试④改断言） |
| B. 删陶窑 upgradesTo（升级链不指向市集，临市集仅邻接加成） | 陶窑无升级终点 | buildings.ts 1 行 | 否（测试已容忍） |
| C. 维持现状＋注释固化 | TODO 升为正式注释（多源合法、upgradesFrom 只记首源） | 1 行注释 | 否 |

影响面提示：A 改动面最大且涉及存档兼容（升级状态机）；C 零风险。需日间拍板后实施。

## 四、声明

`git status --porcelain` 无新增源码改动 ✓；未删 TODO；不 push。

## 遗留问题

无（三候选待拍板）。
