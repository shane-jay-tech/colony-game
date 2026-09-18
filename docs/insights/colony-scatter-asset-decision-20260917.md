# colony scatter rock_cluster 替代方案拍板材料（917-33/B-152，只读零改动）

**结论：10 引用键对照＝9 实存＋rock_cluster 缺失（现态已由 n916d-22 移除引用、渲染用 rock_boulder 顶替，池概率结构不变）。三方案对比后**推荐「永久沿用 boulder」**——影响面最小（改清单名与注释 1 行）、语义诚实；补图与移除两案的代价/收益见§二。材料均不落地，待日间拍板。零改动（art 资产与清单 mtime 改前后相同）。**

## 一、引用键↔磁盘对照表（10 行＝引用键数；命令与数字同段）

```
$ ls public/art/scatter/
→ 9 张 png（bush_dry/bush_shrub/grass_tuft/reed_clump/rock_boulder/tree_locust/tree_mulberry/tree_pine/tree_willow）
```

| # | 引用键 | 磁盘实存 | 顶替状态 |
|---|---|---|---|
| 1 | tree_pine | ✓ 实存 | — |
| 2 | tree_locust | ✓ 实存 | — |
| 3 | tree_mulberry | ✓ 实存 | — |
| 4 | tree_willow | ✓ 实存 | — |
| 5 | rock_boulder | ✓ 实存 | **顶替 rock_cluster 生效中** |
| 6 | rock_cluster | ✗ 缺失 | 已移除引用（n916d-22） |
| 7 | bush_shrub | ✓ 实存 | — |
| 8 | bush_dry | ✓ 实存 | — |
| 9 | reed_clump | ✓ 实存 | — |
| 10 | grass_tuft | ✓ 实存 | — |

## 二、三方案对比（影响面＋回滚）

| 方案 | 做法 | 影响面 | 回滚 |
|---|---|---|---|
| A 补图 | art-library/scatter_raw/rock_cluster.png 转正入 public/art/scatter/；ALL_SCATTER_IDS 恢复引用＋hills/mountain 池按原概率混入 | 需美术资产审核（尺寸/风格/底色）；散布密度回归原设计 | 删新文件＋revert 清单 commit |
| **B 永久沿用 boulder（推荐）** | 清单/注释语义化：ALL_SCATTER_IDS 维持 9 键；scatterConfig 注释从「临时顶替」改「正式口径」；B-152 关闭 | 零资产零逻辑改动；仅文档语义确认 | 无需（纯注释） |
| C 从清单移除该项 | 无操作（n916d-22 已移除）——同 B 但更显式关闭 B-152 | 与 B 相同 | 同 B |

**推荐 B**：现状（boulder 顶替）已稳定运行一夜全量绿，视觉风险已由「山岳/丘陵散布密度」吸收；rock_cluster 原素材（三石堆）与 boulder（巨岩）语义重叠度高，补图的边际收益低。

## 三、「永久沿用」最小文本改动草案（不落地）

```
目标 file:line：src/renderer/data/scatterConfig.ts:56-58（hills 池注释行）
拟改：注释「rock_cluster 移除（n916d-22）：public/art/scatter/ 无此贴图，加载静默缺失；
      rock_boulder 为既有等价岩石素材」
  → 「rock_cluster 正式移除（B-152 关闭）：以 rock_boulder 为永久岩石素材，
     原三石堆概念并入 boulder 语义；art-library 底稿不再转正」
验收命令：npx vitest run src/renderer/data/__tests__/scatterAssets.test.ts（3 用例仍绿）
回滚命令：git revert <commit>（注释回退，零逻辑影响）
```

## 四、验收情况

- ✅ 对照表 10 行＝引用键数（9 实存＋1 缺失，顶替状态注明，命令与数字同段）；✅ 三方案含影响面与回滚；✅ 草案给 file:line；✅ 零改动（art 与清单 mtime 不变）；不 push。

## 遗留问题

B-152 关闭与否留日间拍板（本单材料仅供决策）。
