# colony 散布资产缺口核验（916p-a3-005，2026-09-17，只读）

## 三条命令与数字（同段）

```
$ ls public/art/scatter/ | sed 's/\.png//'     → 磁盘 9 张：
  bush_dry, bush_shrub, grass_tuft, reed_clump, rock_boulder,
  tree_locust, tree_mulberry, tree_pine, tree_willow
$ rg -n "ALL_SCATTER_IDS" -A 6 src/renderer/data/scatterConfig.ts
  :61 清单 10 条（tree_pine/tree_locust/tree_mulberry/tree_willow/
  rock_boulder/rock_cluster/bush_shrub/bush_dry/reed_clump/grass_tuft）
差集条数 = 1
```

## 差集表

| 方向 | 条目 | 说明 |
|---|---|---|
| 清单有、磁盘无 | **rock_cluster** | 唯一缺口 |
| 磁盘有、清单无 | 无 | — |
| 清单有但池无引用 | **bush_dry** | 仅 :63 出现在 ALL_SCATTER_IDS，:42/:47 两处 pool 均无 |

## 池引用核对（rg 行号同段）

```
$ rg -n "rock_cluster|bush_dry|rock_boulder" src/renderer/data/scatterConfig.ts
:42  { prob: 0.22, pool: ['rock_boulder', 'rock_cluster'], ... }   ← hills 丘陵
:47  { prob: 0.42, pool: ['rock_boulder', 'rock_cluster'], ... }   ← mountain 山地
:63  'rock_boulder', 'rock_cluster', 'bush_shrub', 'bush_dry',     ← ALL_SCATTER_IDS
```

- rock_cluster：hills（prob 0.22）与 mountain（prob 0.42）两池引用。
- bush_dry：仅清单成员，无池引用（闲置）。

## 结论：丘陵/山地散布会因缺图静默缺失吗？

**会。**BootScene.ts:5 引 ALL_SCATTER_IDS，:58-59 `for (const id of SCATTER_IDS) this.load.image(\`scatter_${id}\`, \`art/scatter/${id}.png\`)` ——rock_cluster.png 缺盘，Phaser 加载失败被静默跳过；渲染池抽中 rock_cluster（hills 22%/山地 42% 概率的池内成员）时该散布项无贴图缺失呈现。

## 处置二选一（供拍板，本单零改动）

- **补图**：新增 `public/art/scatter/rock_cluster.png`（1 个文件），配置零改动；
- **移除**：改 scatterConfig.ts 3 行（:61 清单删 1 项＋:42/:47 两池各删 1 引用；bush_dry 是否同批清理另议）。

## 验收对照

- ✅ 三命令三数字同段（10/9/1）。- ✅ 差集表三行。- ✅ rg 行号逐条。- ✅ 结论明确附行号证据。- ✅ 零改动零删除；不 push。
