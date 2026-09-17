# colony U1：scatterConfig rock_cluster 引用落差最小修复（n916d-22）

- 班次：sweep-20260916-2300（9/17 08:1x–08:2x 段）
- 结论：采用「移除无效条目」方案——rock_cluster 从 hills/mountain 两池与 ALL_SCATTER_IDS 移除（rock_boulder 为既有等价岩石素材，池概率结构不变）；新增对账锁定用例 3 个；**npm test 全量 92 文件 1148 passed，failed=0**；配置↔磁盘落差归零

## 一、核验（命令在前）

```
$ ls public/art/scatter/ | sed 's/\.png//'     → 9 张（rock_boulder 有、rock_cluster 无）
$ grep -n "rock_cluster" src/renderer/data/scatterConfig.ts（修复前）
:42 hills 池、:47 mountain 池、:63 ALL_SCATTER_IDS   ← 三处引用全部指向缺盘贴图
```

与 a3-005 报告（colony-scatter-asset-gap-20260917.md）差集结论一致：rock_cluster＝唯一「清单有、磁盘无」缺口。**方案选择**：任务书二选一中，A「补齐引用指向已有等价贴图」的文件拷贝形态＝向 public/ 新增资产（违反禁止条款），故采 **B「移除无效条目」**；art-library/scatter_raw/rock_cluster.png 的正式转正留美术拍板（不在本单授权内）。

## 二、修复（逐行标注，仅配置与测试）

```diff
 src/renderer/data/scatterConfig.ts:42  hills 池
-  { prob: 0.22, pool: ['rock_boulder', 'rock_cluster'], minScale: 0.9, maxScale: 1.5 },
+  // rock_cluster 移除（n916d-22）：public/art/scatter/ 无此贴图，加载静默缺失；
+  // rock_boulder 为既有等价岩石素材，池概率结构与散布语义不变
+  { prob: 0.22, pool: ['rock_boulder'], minScale: 0.9, maxScale: 1.5 },
 src/renderer/data/scatterConfig.ts:47  mountain 池（同形）
-  { prob: 0.42, pool: ['rock_boulder', 'rock_cluster'], minScale: 1.1, maxScale: 1.9 },
+  { prob: 0.42, pool: ['rock_boulder'], minScale: 1.1, maxScale: 1.9 },
 src/renderer/data/scatterConfig.ts:63  ALL_SCATTER_IDS
-  'rock_boulder', 'rock_cluster', 'bush_shrub', 'bush_dry',
+  'rock_boulder', 'bush_shrub', 'bush_dry',
```

语义保持：池 prob（0.22/0.42）、minScale/maxScale、地形键全部不动——散布事件概率与尺寸分布不变，仅池内岩石多样度从 2→1（等价素材顶替）。**未新增/删除任何美术资产、未改地形语义与玩法数值。**

## 三、对账锁定用例（新增 `src/renderer/data/__tests__/scatterAssets.test.ts`，3 用例）

1. ALL_SCATTER_IDS 每项都有 `public/art/scatter/<id>.png`（existsSync 全查，missing=[]）；
2. 各地形池引用 id ⊆ ALL_SCATTER_IDS（无游离引用）；
3. rock_cluster 不再被清单与任何池引用＋hills/mountain 池概率 0.22/0.42 不变钉死。

## 四、验收（命令在前）

```
$ npm.cmd test
Test Files 92 passed (92)
Tests      1148 passed (1148)          ← failed=0（含新增 3 用例）
配置项 ↔ 磁盘资源落差 = 0（用例① missing=[]；ALL_SCATTER_IDS 9 项＝磁盘 9 张，逐一对上）
```

`git diff` 仅 scatterConfig.ts（池/清单条目＋注释）与新增测试文件；美术资产零增删。

——完。
