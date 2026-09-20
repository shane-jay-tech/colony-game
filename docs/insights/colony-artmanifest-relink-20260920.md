# colony-game 美术 manifest 双向断链修复（c921-01）

- 任务：c921-01-colony-artmanifest-relink
- 日期：2026-09-20
- 仓库：D:\code\colony-game
- 性质：**修数据（artManifest.ts 的 path/required）＋ 翻 3 条把缺陷当契约的断言**；零删除、零转码、零素材生成
- 复跑命令（三条，全文见下）：
  - `npx tsx tmp/art-exists-check.mts` —— 逐键存在性断言
  - `npx tsx tmp/art-reconcile.mts` —— c920-14 留的双向对账脚本
  - `npx tsx tmp/art-relink-table.mts` —— 生成本文第二节的 before/after 表

## 一、结论

| 项 | 改动前 | 改动后 |
|---|---|---|
| ART_MANIFEST 声明键 | 55 | 55（零增删） |
| path 在 `public/` 下**实存**的键 | 5（仅 terrain） | **53** |
| path 指向不存在文件的键 | **50** | **2**（全部在「待补素材清单」内） |
| `required=true` 键数 | 0 | 53（**每个 true 键都已由脚本断言在盘**） |
| `public/art` 下未被任何 path 声明的文件 | 61 | 13（scatter 9 ＋ manifest_portraits json 4） |

**一句最重要的话**：`ArtAssetDef.path` 字段在**改动前就没有被任何加载路径读取**——
- 建筑走 `getBootLoadList('building')`（`artManifest.ts:126` 的 URL 模板 `art/buildings/${复用目标}.png`）
- 将领走 `getBootLoadList('general')`（`:131` 模板）
- 事件走 `BootScene.ts:67` 的 `art/events/${name}.png` 模板
- **只有地形**（`BootScene.ts:51`）真的读 `asset.path`

也就是说：这次「断链」**从来不影响运行时**（跑起来一直是对的），它坏的是**注册表的可信度**——一张声明着 50 个不存在文件的表，任何人拿它做审计/打包/资源清理都会被带偏（c920-15 的资产普查就差点被它误导）。所以本单的收益是「注册表说真话」，不是「修好一个坏掉的功能」。这一点必须在报告里说清楚，避免后人误以为修了个大 bug。

## 二、55 键 before/after 全量映射表（判据逐行）

判据口径（任务书第 2 条）：
- **A（默认·改指 png）**：同 id 的 `.png` 已在 `public/art/**` 存在 → path 改为相对 `public/` 的真实 png。
- **B（待补素材）**：同 id 的 png **也不存在** → **不改 path**，保留占位、`required` 保持 `false`，列入「待补素材清单」。
- **不动 path ＋ required 校正**：path 本就实存（地形 5 型），只按任务书第 3 条把 `required` 校正为 `true`。

统计：**A=48 / B=2 / 仅 required 校正=5 / 合计 55**。

| # | key | category | 旧 path | 新 path | required | 判据 |
|---|---|---|---|---|---|---|
| 1 | bld_farm | building | assets/buildings/bld_farm.webp | art/buildings/bld_farm.png | false → true | A（改指实存 png） |
| 2 | bld_well | building | assets/buildings/bld_well.webp | art/buildings/bld_well.png | false → true | A（改指实存 png） |
| 3 | bld_house | building | assets/buildings/bld_house.webp | art/buildings/bld_house.png | false → true | A（改指实存 png） |
| 4 | bld_market | building | assets/buildings/bld_market.webp | art/buildings/bld_market.png | false → true | A（改指实存 png） |
| 5 | bld_woodcutter | building | assets/buildings/bld_woodcutter.webp | art/buildings/bld_woodcutter.png | false → true | A（改指实存 png） |
| 6 | bld_quarry | building | assets/buildings/bld_quarry.webp | art/buildings/bld_quarry.png | false → true | A（改指实存 png） |
| 7 | bld_tin_mine | building | assets/buildings/bld_tin_mine.webp | assets/buildings/bld_tin_mine.webp | false → false | B（待补素材：path 与 required 均保持原值） |
| 8 | bld_pottery_kiln | building | assets/buildings/bld_pottery_kiln.webp | art/buildings/bld_pottery_kiln.png | false → true | A（改指实存 png） |
| 9 | bld_loom_house | building | assets/buildings/bld_loom_house.webp | art/buildings/bld_loom_house.png | false → true | A（改指实存 png） |
| 10 | bld_smithy | building | assets/buildings/bld_smithy.webp | art/buildings/bld_smithy.png | false → true | A（改指实存 png） |
| 11 | bld_ancestor_shrine | building | assets/buildings/bld_ancestor_shrine.webp | art/buildings/bld_ancestor_shrine.png | false → true | A（改指实存 png） |
| 12 | bld_barracks | building | assets/buildings/bld_barracks.webp | art/buildings/bld_barracks.png | false → true | A（改指实存 png） |
| 13 | bld_academy | building | assets/buildings/bld_academy.webp | art/buildings/bld_academy.png | false → true | A（改指实存 png） |
| 14 | bld_palace | building | assets/buildings/bld_palace.webp | art/buildings/bld_palace.png | false → true | A（改指实存 png） |
| 15 | bld_beacon_tower | building | assets/buildings/bld_beacon_tower.webp | art/buildings/bld_beacon_tower.png | false → true | A（改指实存 png） |
| 16 | bld_post_road | building | assets/buildings/bld_post_road.webp | art/buildings/bld_post_road.png | false → true | A（改指实存 png） |
| 17 | bld_water_mill | building | assets/buildings/bld_water_mill.webp | art/buildings/bld_water_mill.png | false → true | A（改指实存 png） |
| 18 | bld_iron_forge | building | assets/buildings/bld_iron_forge.webp | art/buildings/bld_iron_forge.png | false → true | A（改指实存 png） |
| 19 | bld_mulberry_grove | building | assets/buildings/bld_mulberry_grove.webp | art/buildings/bld_mulberry_grove.png | false → true | A（改指实存 png） |
| 20 | bld_hemp_field | building | assets/buildings/bld_hemp_field.webp | assets/buildings/bld_hemp_field.webp | false → false | B（待补素材：path 与 required 均保持原值） |
| 21 | bld_stele_yard | building | assets/buildings/bld_stele_yard.webp | art/buildings/bld_stele_yard.png | false → true | A（改指实存 png） |
| 22 | bld_village_school | building | assets/buildings/bld_village_school.webp | art/buildings/bld_village_school.png | false → true | A（改指实存 png） |
| 23 | bld_envoy_lodge | building | assets/buildings/bld_envoy_lodge.webp | art/buildings/bld_envoy_lodge.png | false → true | A（改指实存 png） |
| 24 | bld_training_ground | building | assets/buildings/bld_training_ground.webp | art/buildings/bld_training_ground.png | false → true | A（改指实存 png） |
| 25 | bld_stable | building | assets/buildings/bld_stable.webp | art/buildings/bld_stable.png | false → true | A（改指实存 png） |
| 26 | bld_chariot_works | building | assets/buildings/bld_chariot_works.webp | art/buildings/bld_chariot_works.png | false → true | A（改指实存 png） |
| 27 | bld_city_wall | building | assets/buildings/bld_city_wall.webp | art/buildings/bld_city_wall.png | false → true | A（改指实存 png） |
| 28 | bld_imperial_guard | building | assets/buildings/bld_imperial_guard.webp | art/buildings/bld_imperial_guard.png | false → true | A（改指实存 png） |
| 29 | bld_granary | building | assets/buildings/bld_granary.webp | art/buildings/bld_granary.png | false → true | A（改指实存 png） |
| 30 | bld_watchtower | building | assets/buildings/bld_watchtower.webp | art/buildings/bld_watchtower.png | false → true | A（改指实存 png） |
| 31 | bld_censor | building | assets/buildings/bld_censor.webp | art/buildings/bld_censor.png | false → true | A（改指实存 png） |
| 32 | bld_grand_temple | building | assets/buildings/bld_grand_temple.webp | art/buildings/bld_grand_temple.png | false → true | A（改指实存 png） |
| 33 | bld_observatory | building | assets/buildings/bld_observatory.webp | art/buildings/bld_observatory.png | false → true | A（改指实存 png） |
| 34 | bld_relay_station | building | assets/buildings/bld_relay_station.webp | art/buildings/bld_relay_station.png | false → true | A（改指实存 png） |
| 35 | bld_nine_cauldrons | building | assets/buildings/bld_nine_cauldrons.webp | art/buildings/bld_nine_cauldrons.png | false → true | A（改指实存 png） |
| 36 | portrait_gen_pei_shao | general | assets/generals/gen_pei_shao.webp | art/generals/gen_pei_shao.png | false → true | A（改指实存 png） |
| 37 | portrait_gen_hu_ben | general | assets/generals/gen_hu_ben.webp | art/generals/gen_hu_ben.png | false → true | A（改指实存 png） |
| 38 | portrait_gen_xie_changqing | general | assets/generals/gen_xie_changqing.webp | art/generals/gen_xie_changqing.png | false → true | A（改指实存 png） |
| 39 | portrait_gen_tian_zhong | general | assets/generals/gen_tian_zhong.webp | art/generals/gen_tian_zhong.png | false → true | A（改指实存 png） |
| 40 | portrait_gen_barbarian | general | assets/generals/gen_barbarian.webp | art/generals/gen_barbarian.png | false → true | A（改指实存 png） |
| 41 | evt_art_unification | event | assets/events/unification.webp | art/events/unification.png | false → true | A（改指实存 png） |
| 42 | evt_art_coronation | event | assets/events/coronation.webp | art/events/coronation.png | false → true | A（改指实存 png） |
| 43 | evt_art_battle | event | assets/events/battle.webp | art/events/battle.png | false → true | A（改指实存 png） |
| 44 | evt_art_flood | event | assets/events/flood.webp | art/events/flood.png | false → true | A（改指实存 png） |
| 45 | evt_art_feast | event | assets/events/feast.webp | art/events/feast.png | false → true | A（改指实存 png） |
| 46 | evt_art_diplomacy | event | assets/events/diplomacy.webp | art/events/diplomacy.png | false → true | A（改指实存 png） |
| 47 | evt_art_rebellion | event | assets/events/rebellion.webp | art/events/rebellion.png | false → true | A（改指实存 png） |
| 48 | evt_art_ending_gong | event | assets/events/ending_gong.webp | art/events/ending_gong.png | false → true | A（改指实存 png） |
| 49 | evt_art_ending_jia | event | assets/events/ending_jia.webp | art/events/ending_jia.png | false → true | A（改指实存 png） |
| 50 | evt_art_ending_huo | event | assets/events/ending_huo.webp | art/events/ending_huo.png | false → true | A（改指实存 png） |
| 51 | terrain_forest | terrain | art/terrain/forest.png | art/terrain/forest.png | false → true | 不动 path ＋ required 校正为 true |
| 52 | terrain_hills | terrain | art/terrain/hills.png | art/terrain/hills.png | false → true | 不动 path ＋ required 校正为 true |
| 53 | terrain_mountain | terrain | art/terrain/mountain.png | art/terrain/mountain.png | false → true | 不动 path ＋ required 校正为 true |
| 54 | terrain_plain | terrain | art/terrain/plain.png | art/terrain/plain.png | false → true | 不动 path ＋ required 校正为 true |
| 55 | terrain_river | terrain | art/terrain/river.png | art/terrain/river.png | false → true | 不动 path ＋ required 校正为 true |

STATS A=48 B=2 K=5 total=55

## 三、「待补素材清单」（2 项，方案 B，零改动）

| key | 现状 path | 磁盘实况 | 运行时代偿 | required |
|---|---|---|---|---|
| `bld_tin_mine` | `assets/buildings/bld_tin_mine.webp` | `public/art/buildings/bld_tin_mine.png` **不存在** | `BUILDING_ART_REUSE` 复用 `bld_quarry`（挖掘族） | false |
| `bld_hemp_field` | `assets/buildings/bld_hemp_field.webp` | `public/art/buildings/bld_hemp_field.png` **不存在** | `BUILDING_ART_REUSE` 复用 `bld_mulberry_grove`（种植族） | false |

这两项**不是漏改**：它们本来就没有自有立绘，运行期由 `BUILDING_ART_REUSE`（n916d-23）复用同族贴图渲染，
且被 `artManifestReuse.test.ts` 锁定。按方案 B 保留占位口径，**不谎报一个同样不存在的 png**。
正式立绘制作完成后删掉 reuse 表项、把本表两行改成 `art/buildings/<id>.png` 并置 `required=true` 即可闭环。

**设计取舍留痕（备选方案未采用）**：也可以让这两条直接指向复用目标（`art/buildings/bld_quarry.png`），
那样 `unresolved` 会变成 0、表里不留任何非 png 声明。**未采用**的理由：本单的二选一判据写死了
「同 id 的 png 不存在 → 不改 path」，而「指向别人的图」会让 `path` 这个字段名（"本资产的路径"）说另一种谎——
那是注册表语义变更，不属本单授权范围。已在 outbox result 的遗留问题里点名，交后续拍板。

## 四、硬编码引用清单（任务书第 5 条：只登记不改）

```
$ Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Select-String -Pattern '\.png|/art/' | Where-Object { $_.Path -notmatch '__tests__' }
src\renderer\data\artManifest.ts:71-75   地形 5 型 path（本单已处理）
src\renderer\data\artManifest.ts:114      getBootLoadList('building') 的 URL 模板
src\renderer\data\artManifest.ts:119      getBootLoadList('general') 的 URL 模板
src\renderer\scenes\BootScene.ts:56       this.load.image(\`scatter_\${id}\`, \`art/scatter/\${id}.png\`)   ← manifest 之外的硬编码
src\renderer\scenes\BootScene.ts:67       this.load.image(asset.key, \`art/events/\${name}.png\`)      ← manifest 之外的硬编码
```

- **未改动**（按第 5 条只登记）。两条都在盘上真实存在（`public/art/scatter/` 9 个 png、`public/art/events/` 10 个 png），
  故不构成断链；但它们绕过了 manifest，属**第二事实源**——c921-02 若要改指 webp，**这两行必须一并改**。
- 其余命中项是注释文本与 manifest 自身，无路径语义。

## 五、翻转的三条断言（**超出任务书「代码改动仅限 artManifest.ts」的必要偏离，必须读**）

改完 `artManifest.ts` 后 `npx vitest run` 报 **3 failed**——三条断言**把本次要修的缺陷写成了契约**：

| 文件:行 | 旧断言 | 为什么必须翻 |
|---|---|---|
| `artManifest.test.ts:40` | 「非地形 path 一律 `.webp`」 | 这条正是「50 键指向不存在的 webp」的守卫；不翻则本单无法落地 |
| `artManifest.test.ts:61` | 「no required assets（required 恒 0）」 | 注释写的是「素材尚未制作」；现 53 个素材已实存，前提失效 |
| `bootLoadList.test.ts:88` | 「非地形 path 匹配 `assets/<category>s?/`」 | 直接要求指向那个整体不存在的目录 |

任务书「产出」写「代码改动仅限 artManifest.ts」，但「完成标准 c」要求 `vitest run` **0 failed**——
两者在磁盘上不可兼得。本单选择**翻断言**（把守卫改成钉新契约），并在两处留痕（提交信息 ＋ 本报告）。
翻后的断言**更强**：不只查后缀，还用 `existsSync` 断言每条 path 在 `public/` 下**真实存在**、
并断言 `required=true` 的键**逐个在盘**、`required=false` 的恰好是那 2 个待补键。

**若任务方不认可这一偏离，回滚方式**：`git revert <本单提交>` 即可（artManifest.ts 与两个测试文件在同一提交）。

## 六、验收自证（原文输出）

### a) 逐键存在性断言 —— 改动前
```
$ npx tsx tmp/art-exists-check.mts
...
manifestKeys=55
unresolved=50
unresolvedKeys=["bld_farm","bld_well","bld_house",...,"evt_art_ending_huo"]   （50 项，全部 assets/**.webp）
requiredTrue=0 requiredFalse=55
diskArtFiles=66
orphansArtFiles=61
```

### b) 逐键存在性断言 —— 改动后（原文）
```
$ npx tsx tmp/art-exists-check.mts
MISS  bld_tin_mine                 required=false assets/buildings/bld_tin_mine.webp
MISS  bld_hemp_field               required=false assets/buildings/bld_hemp_field.webp
（其余 53 行全部为 OK，逐键 path 见第二节表）
manifestKeys=55
unresolved=2
unresolvedKeys=["bld_tin_mine","bld_hemp_field"]
requiredTrue=53 requiredFalse=2
requiredTrueMissing=0
diskArtFiles=66
orphansArtFiles=13 ["art/manifest_portraits_1781872115.json","art/manifest_portraits_1781872230.json","art/manifest_portraits_1781872304.json","art/manifest_portraits_1781872377.json","art/scatter/bush_dry.png","art/scatter/bush_shrub.png","art/scatter/grass_tuft.png","art/scatter/reed_clump.png","art/scatter/rock_boulder.png","art/scatter/tree_locust.png","art/scatter/tree_mulberry.png","art/scatter/tree_pine.png","art/scatter/tree_willow.png"]
```

### c) 双向对账脚本（c920-14 留）
```
$ npx tsx tmp/art-reconcile.mts
{ "manifestKeys": 55, "missingCount": 50, ... }   ← 改动前
改动后 missingCount=2（同上，逐键 = 待补素材清单）
```
> ⚠️ 该脚本的 `orphansNotInManifest` 字段**自身有口径 bug**（它用 `path.relative(ROOT, full)` 得到 `public/art/...`，
> 却与 `a.path`（`art/...`）比较），所以改动前打印 `orphanCount: 81`（＝全部文件）。
> 本单不去改它（它属 c920-14 的产物），改在 `tmp/art-exists-check.mts` 里用归一化口径正确计算（13 个真 orphan）。

### d) vitest
```
$ npx vitest run
 Test Files  120 passed (120)
      Tests  1268 passed (1268)
   Duration  65.03s
```

### e) type-check
```
$ npm run type-check      # tsc -p tsconfig.renderer.json --noEmit
EXIT=0
```

## 七、遗留（交后续单）

1. **2 条待补素材**（`bld_tin_mine` / `bld_hemp_field`）：需美术出图后改指 png ＋ 置 required，见第三节。
2. **`BootScene.ts:56/67` 的第二事实源**：scatter 与 events 两处路径模板在 manifest 之外硬编码，
   c921-02 若改指 webp 必须同步这两行（第四节已列 file:line）。
3. **`tmp/art-reconcile.mts` 的 orphan 口径 bug**：登记，未修（属 c920-14 产物）。
4. `path` 字段与 URL 模板的**双轨**关系尚未合并（改后已同义，但仍有两处写法）；合并属重构，非本单范围。
