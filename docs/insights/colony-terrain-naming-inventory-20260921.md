# colony B-139 地形命名三方差异盘点（重锚，只读；c921-06，2026-09-21 执行班）

> 任务源：zcode-bridge c921-06（BACKLOG 旧队列 B-139，9/18 起 queued 顺延）。
> 本盘点零代码改动；只新增本报告文件。

## 一、锚点重校（9/16 原文已漂移，按现值修正）

| 项 | 9/16 锚点原文 | 磁盘现值（实测） |
|---|---|---|
| BootScene 地形加载 | `BootScene.ts:53-55` 硬编码字面数组 | `BootScene.ts:51-53` 为 `for (const asset of TERRAIN_ART) this.load.image(asset.key, asset.path)`——**硬编码数组已在 c918-04/05 删除、改由 manifest 派生**（源码注释自证「B-139 销项」） |
| 文件格式 | `art/terrain`（png） | `public/art/terrain/*.webp`（c921-02 转码，png 原图已删 62 张，盘上 find *.png 零命中） |
| TERRAIN_ART 行号 | — | `artManifest.ts:88-94`（注释行 :87 写「BootScene.ts:50」，现值 :51，差 1 行） |

## 二、三方命名对账（实测脚本比对，全等）

- **来源 A｜类型/生成**：`mapSchema.ts:9` `TERRAIN_KINDS = ['plain','hills','forest','river','mountain']`
- **来源 B｜资源清单**：`artManifest.ts:88` `TERRAIN_ART` key=`terrain_<kind>`、path=`art/terrain/<kind>.webp`（5 型）
- **来源 C｜磁盘实存**：`public/art/terrain/` = forest/hills/mountain/plain/river 5 个 .webp
- **消费方｜渲染**：`MapRenderer.ts:535` `terrain_${terr}`（注释 :521 仍写 `(terrain_<t>.png)`，扩展名过时；回退逻辑 mapColors.ts:27 `terrainColor` 未知型返调试色＋warn）

三集合排序后**完全相等**（`{forest,hills,mountain,plain,river}` ×3）：**命名差异 = 0**。守护测试 `terrainPaths.test.ts` 两例已钉 A×C（5 型计数＋逐 path 实存＋.webp 后缀断言，c921-02 已翻桩）。

## 三、B-139 当年诉求的现况判定

「三方命名统一/硬编码清单」两点：**均已闭合**——
1. 第二事实源（BootScene 地形字面数组）→ 已删，地形是 boot 六类资产中唯一直接读 `asset.path` 的类目（colony-artmanifest-relink-20260920.md 二节同口径）。
2. 命名漂移风险 → 由 `terrainPaths.test.ts` 回归钉死，9/18 后无再生漂移（本次对账全等）。

## 四、剩余可清理项（低优先，均非命名差异本体）

1. `MapRenderer.ts:521` 注释 `.png` → `.webp`（一处措辞）。
2. `artManifest.ts:87` 注释行号 `BootScene.ts:50` → 用「TERRAIN_ART 循环」指代替代行号，避免再漂。
3. 旧队列台账 B-139 行：建议裁决**销项/降档**（本体已在 c918-04/05＋c921-02 闭合，本报告为销项证据）；顺延多夜占用真 queued 池。
4. （可选强化）`terrainPaths.test.ts` 加一条 A×B 集合相等断言（`TERRAIN_KINDS` ↔ `terrain_` 后缀），把「三方」钉成「三方互等」而非两两——留待下批，本报告不动码。

## 五、证据

- 采集命令：artManifest/mapSchema/public 目录三方集合 node 比对输出 `三方集合相等: true`（原文见 zcode-bridge/outbox/c921-06-colony-b139-terrain.result.md「证据」节）。
- 行号：`sed -n '40,80p' src/renderer/scenes/BootScene.ts`、`grep -n "TERRAIN_ART" -A 10 src/renderer/data/artManifest.ts`、`grep -n "terrain_" src/renderer/render/MapRenderer.ts` 实测摘录。
