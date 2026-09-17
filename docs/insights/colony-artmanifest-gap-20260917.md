# colony U2：artManifest 两建筑缺图处置（n916d-23）

- 班次：sweep-20260916-2300（9/17 08:2x 段）
- 结论：bld_tin_mine／bld_hemp_field＝35 项建筑清单中唯一缺盘的 2 项（public/art/buildings/ 实存 33 张）；采用 **BUILDING_ART_REUSE 同族复用表**（锡矿→采石场、麻田→桑园，key 不变）最小修复；新增对账用例 3 个；**npm test 全量 93 文件 1151 passed，failed=0**

## 一、核验（命令在前）

```
$ grep -rn "bld_hemp_field|tin_mine" src --include="*.ts"   → artManifest 清单 :27/:29、buildings.ts 数据表 :132/:430、buildingSigils :56（均为配置/数据引用，非贴图文件）
$ ls public/art/buildings/ | wc -l   → 33
$ find . -name "bld_tin_mine*" -o -name "bld_hemp_field*"（排除 node_modules）→ 零文件
35（清单项）− 33（磁盘）= 2 缺口＝bld_tin_mine、bld_hemp_field（与任务书点名一致）
```

真实加载路径＝`getBootLoadList`（artManifest.ts:102）派生 `art/buildings/${key}.png`——缺图 key 走 Phaser 失败→色块 fallback（非崩溃，但建筑无立绘）。

## 二、处置（同族复用，逐行标注）

```diff
 src/renderer/data/artManifest.ts（getBootLoadList 前）
+// n916d-23：缺图建筑复用同族既有美术（key 不变，存档/命名语义不受扰）——
+// 锡矿→采石场（挖掘族）、麻田→桑园（种植族）；正式立绘制作后删除本表即可。
+export const BUILDING_ART_REUSE: Record<string, string> = {
+  bld_tin_mine: 'bld_quarry',
+  bld_hemp_field: 'bld_mulberry_grove',
+};
 src/renderer/data/artManifest.ts:102 派生式
-  return BUILDING_ART.map(a => ({ key: a.key, url: `art/buildings/${a.key}.png` }));
+  return BUILDING_ART.map(a => ({
+    key: a.key,
+    url: `art/buildings/${BUILDING_ART_REUSE[a.key] ?? a.key}.png`,
+  }));
```

- **未新增美术资产**（复用 public/art/buildings/ 实存 bld_quarry.png / bld_mulberry_grove.png）；**未改建筑玩法数值**（buildings.ts 数据表零触碰；key 不变 ⇒ 存档//isArtAvailable 语义不受扰）。
- 随契约更新：bootLoadList.test.ts ① 的旧清单派生式同步加复用表（`BUILDING_ART_REUSE[def.id] ?? def.id`）——equality 断言语义保持（派生=权威序），仅 URL 计入别名。

## 三、对账锁定用例（新增 `src/renderer/data/__tests__/artManifestReuse.test.ts`，3 用例）

1. BUILDING_ART 全部 35 项经复用表后均可解析（missing=[]）；
2. 复用表双向核验：原图确实缺、复用目标实存；
3. 派生加载列表 35 条 URL 全部指向实存文件＋两别名 URL 逐字钉死（bld_quarry.png／bld_mulberry_grove.png）。

## 四、验收（命令在前）

```
$ npm.cmd test
Test Files 93 passed (93)
Tests      1151 passed (1148+3)         ← failed=0
两 id 解析 = 35/35（0 缺图；修复前 33/35）
```

`git diff` 仅 artManifest.ts（复用表＋派生式）、bootLoadList.test.ts（fixture 随契约）、新增测试文件——全部为配置与测试，零生产逻辑/数值改动。

——完。
