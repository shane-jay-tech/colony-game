# colony B-152 关单口径核对（c922-108，2026-09-22T03:54）——**未落地，待拍板**

> 用途：把 917-33 方案 B 的注释改写做成**可直接 apply 的一行 diff**，同时说清为什么执行班不能自己按下去。
> 边界：**本单未改 `src/renderer/data/scatterConfig.ts` 一个字节**（`git status --porcelain -- src/renderer/data/` 空），零资产、零逻辑、零测试改动。取数 cwd `D:\code\colony-game`，HEAD `1ceea94`。
> 写档人：Qoder 执行班 `qoder-executor-20260922-0000-colony5`。

## 一、B-152 的归属现状（这就是不落地的理由）

| 位置 | 现值 | 含义 |
|---|---|---|
| `D:/code/docs/night-plans/BACKLOG.md:194`（**权威台账，在本单 cwd 之外**） | `B-152 \| L3 \| colony scatter 贴图 rock_cluster **缺盘补图**… \| 9/17 晨拍板 #5（**补图另排**） \| **queued** \| 09-17 19:52 规划脑投递` | 条目**至今 queued**，且它的标题写的是**补图＝方案 A** |
| `D:/code/docs/night-plans/2026-09-19-morning.md:45,58` | 「B-152 已被规划班翻 queued 投递」「B-152 queued 未投（plan-2021 裁定**待拍板**）」 | 9/19 晨报仍记为待拍板 |
| `docs/insights/colony-scatter-asset-decision-20260917.md` 末段 | 「B-152 关闭与否**留日间拍板**（本单材料仅供决策）」 | 材料本身**没声称已拍板** |
| `colony-game/docs/design/OPTIMIZATION_BACKLOG.md` | 全仓 `rg -no "B-1[0-9][0-9]"` 在本档内**零命中**（该文件用 P0–P4 编号） | B-152 在本仓无落点可勾 |

⇒ 冲突点：**「B-152 关闭」这句话现在只能由代码注释单方面宣布**——台账侧仍在 `queued` 且口径是「补图」。执行班若把「（B-152 关闭）」写进 `scatterConfig.ts`，就出现「代码说已关、规划台账说未决」的假闭环，而且台账在本单 cwd 外，我也无从同步它。按派单令（归属不清 → 登记后落 partial）停手。

## 二、磁盘实况与三处过期前提

1. **「从『临时移除』改为…」这个说法在盘上已不成立**：
   `rg -n "临时顶替|n916d-22" src/renderer/data/scatterConfig.ts` ＝ **1 命中**，且那 1 命中是 `:42` 的历史号 `n916d-22`；**`临时` 二字在该文件里出现 0 次**。现行原文是：

   ```
   42:      // rock_cluster 移除（n916d-22）：public/art/scatter/ 无此贴图，加载静默缺失；
   43:      // rock_boulder 为既有等价岩石素材，池概率结构与散布语义不变
   ```
   ⇒ 完成标准里的「临时口径清零」**当前即为真**，本单没有可清的临时字样；真正待改的是「无此贴图、加载**静默**缺失」这套**被动描述**（它已失真：见下条 3）。
2. **917-33 草案自带过期事实，不宜照抄**：草案写「`ALL_SCATTER_IDS` 维持 **9 键**」——现值是 **8 键**（c918-09 删 `bush_dry` 键）；材料 §一 对照表也称盘上「9 张 **png**」——c921-02 转码＋f0c9754 授权删原 png 后，`public/art/scatter/` 只有 9 个 **`.webp`**（键 8 ＋ 孤儿 `bush_dry.webp`，后者现由 c922-107 的反向用例白名单守）。
3. **「加载静默缺失」已经不成立**：n916d-22 之后本族有了硬对账——`scatterDiskReconcile.test.ts`（c918-08 建，缺盘即红）＋ `scatterAssets.test.ts` ③（钉 `rock_cluster` 不再被引用）。继续保留「静默缺失」字样会让下一个读码的人以为这里没有守卫。

## 三、待拍板后可直接落地的最小 diff（本单**未**应用）

```diff
--- a/src/renderer/data/scatterConfig.ts
+++ b/src/renderer/data/scatterConfig.ts
@@ -41,8 +41,9 @@ export const SCATTER_BY_TERRAIN: Record<string, TerrainScatter> = {
   hills: {
     slots: [
-      // rock_cluster 移除（n916d-22）：public/art/scatter/ 无此贴图，加载静默缺失；
-      // rock_boulder 为既有等价岩石素材，池概率结构与散布语义不变
+      // rock_cluster 正式移除（B-152 关闭）：以 rock_boulder 为永久岩石素材，
+      // 原三石堆概念并入 boulder 语义；art-library/scatter_raw 底稿不再转正。
+      // 历史：n916d-22 因缺盘先移除引用（86dd9bf），917-33 材料推荐方案 B，池概率结构与散布语义始终未变
       { prob: 0.22, pool: ['rock_boulder'], minScale: 0.9, maxScale: 1.5 },
     ],
   },
```
- 行尾：`scatterConfig.ts` 实测**纯 LF**（CRLF=0／LF=67），落地须按 LF 拼。
- 与草案的两处偏离（都是为免把过期事实写进码）：不写「9 键」；把 `n916d-22` 历史号**保留**在第三行注释里（完成标准允许保留，理由：它绑着 `86dd9bf` 这次真删引用的 commit，删掉就断了回滚线索）。
- 若人工改判**方案 A（补图）**，则本 diff 作废，出口变成：`art-library/scatter_raw/rock_cluster.png` 转正入 `public/art/scatter/` ＋ `ALL_SCATTER_IDS` 恢复该键 ＋ hills/mountain 池按原概率混入 ＋ c922-107 反向白名单需同步（若同时处理 `bush_dry.webp`）。
  ⚠️ A 案不是「零成本」——本浪实测底稿现状：`art-library/scatter_raw/rock_cluster.png` **在盘但被 gitignore**（`git check-ignore -v` → `.gitignore:24:art-library/`），单文件 **1,315,701 B（1.26 MiB）**、整目录 14 M；转正＝把这张 png 纳入版本库，并要跟上 c921-02 的 png→webp 管线（散布目录现只发 `.webp`，且 `scatterAssets.test.ts` ①b 正断言「原 png 不应在盘」）。⇒ 走 A 案的派单要连带这几处，别只写「补图」。

## 四、现值读数（拍板前后都该一致的部分）

- `npx vitest run src/renderer/data/__tests__/scatterAssets.test.ts src/renderer/data/__tests__/scatterDiskReconcile.test.ts` ⇒ **15 passed／rc=0**（4 例＋11 例；后者 10→11 是 c922-107 本班前一单所致）。
- 本单 `git diff` 仅注释行的判据不适用：**本单零 diff**（HEAD `1ceea94` 起算，工作树里 `src/renderer/data/` 干净）。
- type-check 未单独跑（无改动可检）；最近一次 pre-commit 全量为 `1ceea94`：126 文件／1338 例绿、type-check 0 错误。

## 五、给主班/人工的一句话

**要么把 `BACKLOG.md:194` 的 B-152 翻 closed(B) 再让下一班落本档第三节 diff，要么按「补图另排」重开 A 案单**——两条都由规划班/人工执行，执行班不宜自宣关单。
