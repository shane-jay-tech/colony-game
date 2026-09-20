# colony-game 资产瘦身第一批（c921-02）

- 任务：c921-02-colony-assets-slim
- 日期：2026-09-20
- 仓库：D:\code\colony-game
- 前置：c921-01（commit `39c90c6`，manifest 已改指实存 png）**已落盘**，本单在其上执行
- 性质：**art 整批 png→webp 转码 ＋ manifest/BootScene 同提交改指**；**零删除**（原 png 全部保留）
- 复跑命令：
  - `python tmp/assets_census.py tmp/assets-after-20260920.json` —— 体积普查
  - `python tmp/png2webp-20260920.py` —— 整批转码（幂等，可重跑覆盖）
  - `npx tsx tmp/art-exists-check.mts` —— manifest 逐键存在性断言
  - `npx vitest run` / `npm run type-check`

## 〇、达标结论（**先说清楚哪一列达标、哪一列不达标**）

| 口径 | 改动前 | 改动后 | 目标 | 结论 |
|---|---|---|---|---|
| **运行时载荷**（游戏实际加载/发布的那批文件） | 147.9 MiB | **67.03 MiB** | ≤100 MiB | ✅ **达标** |
| ├ art（webp） | 92.32 MiB（png） | **11.46 MiB** | ≤45 MiB | ✅ **达标** |
| ├ audio | 55.22 MiB | 55.22 MiB（不动） | 维持 | ✅ |
| └ resources/icon.ico | 0.35 MiB | 0.35 MiB | 0.36 | ✅ |
| **磁盘原始占用**（含保留的原 png） | 147.9 MiB | **159.35 MiB** | ≤100 MiB | ❌ **不达标（+59.35 MiB）** |
| ├ public/art（png 92.32 ＋ webp 11.46） | 92.33 MiB | **103.79 MiB** | ≤45 MiB | ❌ 不达标 |
| └ public/audio | 55.22 MiB | 55.22 MiB | 维持 | ✅ |

**为什么不达标的原因只有一个：任务书「本批零删除（原 png 全部保留，删除方案只写进报告留待拍板）」**。
原 png 92.32 MiB 一个没删，所以磁盘占用反而**涨了 11.46 MiB**（新增的 webp）。这是**设计如此**，不是失败：
- 若按下一批授权删除 62 个原 png：磁盘 = 67.03 MiB，**两列同时达标**（差额 0）。
- 删除方案见第五节（逐条列出、含回滚方式），**本单不执行**。

> 口径提示：游戏运行时只加载 webp（`getBootLoadList` / BootScene 三条模板已全部改指 .webp），
> 原 png 是**纯冗余副本**——它们不影响包体与加载，只占仓库磁盘。

## 一、改动前基线（复跑原文）

```
$ python tmp/assets_census.py tmp/assets-baseline-20260920.json
{ "file_count": 82, "total_bytes": 155079233, "total_mib": 147.9,
  "by_dir_mib": { "public/art": 92.33, "public/audio": 55.22, "resources": 0.35 },
  "by_ext_mib": { ".ico": 0.35, ".json": 0.0, ".mp3": 54.97, ".png": 92.32, ".wav": 0.24 },
  "art_png_count": 62, "art_png_mib": 92.32, "art_webp_count": 0,
  "md5_dup_groups": { "12800247256e64a7bbe6341269a4edd5": ["public/audio/sfx_click.wav","public/audio/sfx_warn.wav"] } }
```
与锚点（c920-15）逐项吻合：147.9 MiB / art 92.3 / audio 55.2 / 62 png / 1 组 md5 重复。

## 二、改动后（复跑原文）

```
$ python tmp/assets_census.py tmp/assets-after-20260920.json
{ "file_count": 144, "total_bytes": 167094867, "total_mib": 159.35,
  "by_dir_mib": { "public/art": 103.79, "public/audio": 55.22, "resources": 0.35 },
  "by_ext_mib": { ".ico": 0.35, ".json": 0.0, ".mp3": 54.97, ".png": 92.32, ".wav": 0.24, ".webp": 11.46 },
  "art_png_count": 62, "art_png_mib": 92.32, "art_webp_count": 62,
  "md5_dup_groups": { "12800247256e64a7bbe6341269a4edd5": ["public/audio/sfx_click.wav","public/audio/sfx_warn.wav"] } }
```

## 三、转码清单（62 行全量，含压缩率）

参数：Pillow 12.2.0 / libwebp 1.6.0，`quality=85, method=6`；原 png 一律保留。

| # | 原 png（保留） | 新 webp | 原 bytes | 新 bytes | 压缩率 |
|---|---|---|---|---|---|
| 1 | public/art/buildings/bld_academy.png | public/art/buildings/bld_academy.webp | 1254460 | 152060 | 12.12% |
| 2 | public/art/buildings/bld_ancestor_shrine.png | public/art/buildings/bld_ancestor_shrine.webp | 2565225 | 234422 | 9.14% |
| 3 | public/art/buildings/bld_barracks.png | public/art/buildings/bld_barracks.webp | 2701845 | 260354 | 9.64% |
| 4 | public/art/buildings/bld_beacon_tower.png | public/art/buildings/bld_beacon_tower.webp | 1329436 | 135442 | 10.19% |
| 5 | public/art/buildings/bld_censor.png | public/art/buildings/bld_censor.webp | 1306859 | 142508 | 10.90% |
| 6 | public/art/buildings/bld_chariot_works.png | public/art/buildings/bld_chariot_works.webp | 1452632 | 176116 | 12.12% |
| 7 | public/art/buildings/bld_city_wall.png | public/art/buildings/bld_city_wall.webp | 855407 | 92852 | 10.85% |
| 8 | public/art/buildings/bld_envoy_lodge.png | public/art/buildings/bld_envoy_lodge.webp | 1191084 | 141342 | 11.87% |
| 9 | public/art/buildings/bld_farm.png | public/art/buildings/bld_farm.webp | 1462634 | 148944 | 10.18% |
| 10 | public/art/buildings/bld_granary.png | public/art/buildings/bld_granary.webp | 1167129 | 126718 | 10.86% |
| 11 | public/art/buildings/bld_grand_temple.png | public/art/buildings/bld_grand_temple.webp | 1277470 | 149910 | 11.73% |
| 12 | public/art/buildings/bld_house.png | public/art/buildings/bld_house.webp | 1151647 | 136242 | 11.83% |
| 13 | public/art/buildings/bld_imperial_guard.png | public/art/buildings/bld_imperial_guard.webp | 1005201 | 110346 | 10.98% |
| 14 | public/art/buildings/bld_iron_forge.png | public/art/buildings/bld_iron_forge.webp | 1647905 | 193366 | 11.73% |
| 15 | public/art/buildings/bld_loom_house.png | public/art/buildings/bld_loom_house.webp | 1317351 | 158816 | 12.06% |
| 16 | public/art/buildings/bld_market.png | public/art/buildings/bld_market.webp | 1411710 | 185574 | 13.15% |
| 17 | public/art/buildings/bld_mulberry_grove.png | public/art/buildings/bld_mulberry_grove.webp | 1305030 | 177152 | 13.57% |
| 18 | public/art/buildings/bld_nine_cauldrons.png | public/art/buildings/bld_nine_cauldrons.webp | 1140260 | 124690 | 10.94% |
| 19 | public/art/buildings/bld_observatory.png | public/art/buildings/bld_observatory.webp | 1277684 | 141152 | 11.05% |
| 20 | public/art/buildings/bld_palace.png | public/art/buildings/bld_palace.webp | 1366423 | 165050 | 12.08% |
| 21 | public/art/buildings/bld_post_road.png | public/art/buildings/bld_post_road.webp | 1286840 | 133140 | 10.35% |
| 22 | public/art/buildings/bld_pottery_kiln.png | public/art/buildings/bld_pottery_kiln.webp | 1299791 | 140410 | 10.80% |
| 23 | public/art/buildings/bld_quarry.png | public/art/buildings/bld_quarry.webp | 1379160 | 177552 | 12.87% |
| 24 | public/art/buildings/bld_relay_station.png | public/art/buildings/bld_relay_station.webp | 1200645 | 134898 | 11.24% |
| 25 | public/art/buildings/bld_smithy.png | public/art/buildings/bld_smithy.webp | 1497424 | 186432 | 12.45% |
| 26 | public/art/buildings/bld_stable.png | public/art/buildings/bld_stable.webp | 1128130 | 129282 | 11.46% |
| 27 | public/art/buildings/bld_stele_yard.png | public/art/buildings/bld_stele_yard.webp | 1247265 | 153572 | 12.31% |
| 28 | public/art/buildings/bld_training_ground.png | public/art/buildings/bld_training_ground.webp | 1184635 | 140870 | 11.89% |
| 29 | public/art/buildings/bld_village_school.png | public/art/buildings/bld_village_school.webp | 1365680 | 171816 | 12.58% |
| 30 | public/art/buildings/bld_watchtower.png | public/art/buildings/bld_watchtower.webp | 1237528 | 127976 | 10.34% |
| 31 | public/art/buildings/bld_water_mill.png | public/art/buildings/bld_water_mill.webp | 1417457 | 183996 | 12.98% |
| 32 | public/art/buildings/bld_well.png | public/art/buildings/bld_well.webp | 1490291 | 185636 | 12.46% |
| 33 | public/art/buildings/bld_woodcutter.png | public/art/buildings/bld_woodcutter.webp | 1440482 | 193002 | 13.40% |
| 34 | public/art/events/battle.png | public/art/events/battle.webp | 1848719 | 264542 | 14.31% |
| 35 | public/art/events/coronation.png | public/art/events/coronation.webp | 1832571 | 253278 | 13.82% |
| 36 | public/art/events/diplomacy.png | public/art/events/diplomacy.webp | 1798611 | 245622 | 13.66% |
| 37 | public/art/events/ending_gong.png | public/art/events/ending_gong.webp | 1824887 | 253194 | 13.87% |
| 38 | public/art/events/ending_huo.png | public/art/events/ending_huo.webp | 1931592 | 285580 | 14.78% |
| 39 | public/art/events/ending_jia.png | public/art/events/ending_jia.webp | 1755794 | 238078 | 13.56% |
| 40 | public/art/events/feast.png | public/art/events/feast.webp | 1933796 | 287228 | 14.85% |
| 41 | public/art/events/flood.png | public/art/events/flood.webp | 1648189 | 221594 | 13.44% |
| 42 | public/art/events/rebellion.png | public/art/events/rebellion.webp | 1765186 | 243740 | 13.81% |
| 43 | public/art/events/unification.png | public/art/events/unification.webp | 1840936 | 254546 | 13.83% |
| 44 | public/art/generals/gen_barbarian.png | public/art/generals/gen_barbarian.webp | 1777159 | 238178 | 13.40% |
| 45 | public/art/generals/gen_hu_ben.png | public/art/generals/gen_hu_ben.webp | 1802969 | 246262 | 13.66% |
| 46 | public/art/generals/gen_pei_shao.png | public/art/generals/gen_pei_shao.webp | 1731982 | 224066 | 12.94% |
| 47 | public/art/generals/gen_tian_zhong.png | public/art/generals/gen_tian_zhong.webp | 1742586 | 230298 | 13.22% |
| 48 | public/art/generals/gen_xie_changqing.png | public/art/generals/gen_xie_changqing.webp | 1697845 | 219644 | 12.94% |
| 49 | public/art/scatter/bush_dry.png | public/art/scatter/bush_dry.webp | 1326362 | 118188 | 8.91% |
| 50 | public/art/scatter/bush_shrub.png | public/art/scatter/bush_shrub.webp | 1468625 | 145522 | 9.91% |
| 51 | public/art/scatter/grass_tuft.png | public/art/scatter/grass_tuft.webp | 1250508 | 109828 | 8.78% |
| 52 | public/art/scatter/reed_clump.png | public/art/scatter/reed_clump.webp | 1214220 | 109274 | 9.00% |
| 53 | public/art/scatter/rock_boulder.png | public/art/scatter/rock_boulder.webp | 1351001 | 117096 | 8.67% |
| 54 | public/art/scatter/tree_locust.png | public/art/scatter/tree_locust.webp | 1561272 | 169560 | 10.86% |
| 55 | public/art/scatter/tree_mulberry.png | public/art/scatter/tree_mulberry.webp | 1403336 | 127846 | 9.11% |
| 56 | public/art/scatter/tree_pine.png | public/art/scatter/tree_pine.webp | 1454571 | 133076 | 9.15% |
| 57 | public/art/scatter/tree_willow.png | public/art/scatter/tree_willow.webp | 1485899 | 170400 | 11.47% |
| 58 | public/art/terrain/forest.png | public/art/terrain/forest.webp | 2564430 | 448958 | 17.51% |
| 59 | public/art/terrain/hills.png | public/art/terrain/hills.webp | 2426928 | 386588 | 15.93% |
| 60 | public/art/terrain/mountain.png | public/art/terrain/mountain.webp | 2413734 | 388378 | 16.09% |
| 61 | public/art/terrain/plain.png | public/art/terrain/plain.webp | 2395739 | 376546 | 15.72% |
| 62 | public/art/terrain/river.png | public/art/terrain/river.webp | 2193944 | 296886 | 13.53% |

合计：png 96806111 bytes (92.32 MiB) → webp 12015634 bytes (11.46 MiB)，压缩率 12.41%，省 80.86 MiB

分组小计：
- buildings：45362720 → 5211638 bytes（43.26 → 4.97 MiB，压缩率 11.49%）
- events：18180281 → 2547402 bytes（17.34 → 2.43 MiB，压缩率 14.01%）
- generals：8752541 → 1158448 bytes（8.35 → 1.10 MiB，压缩率 13.24%）
- scatter：12515794 → 1200790 bytes（11.94 → 1.15 MiB，压缩率 9.59%）
- terrain：11994775 → 1897356 bytes（11.44 → 1.81 MiB，压缩率 15.82%）

## 四、重复组处置（md5 内容级重复 1 组）

`sfx_click.wav ≡ sfx_warn.wav`（逐字节相同，冗余 8,864 B）→ **硬链接**（Windows 内置 `fsutil hardlink create`，零依赖）：

```
$ Remove-Item public\audio\sfx_warn.wav ; fsutil hardlink create public\audio\sfx_warn.wav public\audio\sfx_click.wav
Hard link created for public\audio\sfx_warn.wav <<===>> public\audio\sfx_click.wav
(失败即从备份还原；本机 fsutil exit=0，还原分支未触发)

$ Get-FileHash public\audio\sfx_click.wav, public\audio\sfx_warn.wav   # 改后
sfx_click.wav  F971A9AAA8626894132D1D3D7139E0F06B01F3BEB894F680F5033ECCFBBCD969
sfx_warn.wav   F971A9AAA8626894132D1D3D7139E0F06B01F3BEB894F680F5033ECCFBBCD969

$ (Get-Item public\audio\sfx_click.wav).Length ; (Get-Item public\audio\sfx_warn.wav).Length
8864
8864

$ fsutil hardlink list public\audio\sfx_warn.wav
\code\colony-game\public\audio\sfx_click.wav
\code\colony-game\public\audio\sfx_warn.wav
```

两者哈希相同、都能读、且 `hardlink list` 证明**同一物理文件两个名字** ⇒ 磁盘实占减少 8,864 B（体积普查按逻辑大小统计故总量不变）。
收益极小（8.6 KB），按任务书要求**不为此冒任何风险**：失败分支仅登记不折腾。

## 五、删除方案（**未执行，需拍板**）

| 项 | 内容 |
|---|---|
| 待删 | `public/art/**` 下 62 个 `.png`（webp 版已全部就位且被 manifest/BootScene 引用） |
| 收益 | 磁盘 159.35 MiB → **67.03 MiB**；`public/art` 103.79 → **11.46 MiB** |
| 风险 | 低——原 png 已无任何代码引用（第五节的引用扫描为证）；但**转码是有损的**（q85），删图即放弃「无损回滚」 |
| 回滚方式 | `tmp/assets-backup-20260920/art/**` 保有全部 62 个原 png（备份在盘，见第六节）；或 `git checkout -- public/art` |
| 建议 | **保留一批**，等实机观感验收（webp q85 在这些 AI 大图上未见可见劣化，但本单**没有做过目视比对**，属未验证项） |

## 六、备份核对（完成标准 b）

```
$ (Get-ChildItem 'tmp/assets-backup-20260920' -Recurse -File).Count
64
$ (Get-ChildItem 'tmp/assets-backup-20260920\art' -Recurse -Filter *.png).Count
62
$ (Get-ChildItem 'tmp/assets-backup-20260920\audio' -File).Count
2
$ (Get-Content tmp/png2webp-20260920.json -Raw | Select-String -Pattern '"webp"' -AllMatches).Matches.Count
62
```
**备份 64 = 62 转码 png ＋ 2 处置 wav**，与「被替换/被转码文件数」精确相等（62 = 62）✓

## 七、硬编码引用改指清单（任务书第 3 条：发现的全部一并改指）

```
$ Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | Select-String -Pattern '\.png' | Where-Object { $_.Path -notmatch '__tests__' }
（改后残留全部是注释文本，无路径语义：artManifest.ts:43/115、MapRenderer.ts:80/521、scatterConfig.ts:25）
```

| file:line | 改动 | 说明 |
|---|---|---|
| `src/renderer/data/artManifest.ts` 建筑/将领/事件/地形 4 组 path | `.png` → `.webp` | 53 条（2 条待补素材保持占位不动） |
| `src/renderer/data/artManifest.ts:126` `getBootLoadList('building')` URL 模板 | `.png` → `.webp` | **运行时真加载路径** |
| `src/renderer/data/artManifest.ts:131` `getBootLoadList('general')` URL 模板 | `.png` → `.webp` | **运行时真加载路径** |
| `src/renderer/scenes/BootScene.ts:56` scatter 模板 | `.png` → `.webp` | **manifest 之外的第二事实源**（c921-01 报告已登记） |
| `src/renderer/scenes/BootScene.ts:67` events 模板 | `.png` → `.webp` | **manifest 之外的第二事实源** |
| `src/renderer/scenes/BootScene.ts:51` terrain | 无需改 | 直接读 `asset.path`，随 manifest 自动变 .webp |

## 八、翻桩的测试断言（**超范围偏离留痕，需知悉**）

任务书「产出」未限制改测试文件，但**翻断言是必须的**——改了扩展名而断言钉住 `.png` 会直接红：

| 文件 | 旧断言 | 翻后 |
|---|---|---|
| `artManifest.test.ts` | path 以 `.png` 结尾 | 以 `.webp` 结尾 ＋ existsSync 实存 |
| `terrainPaths.test.ts` | 地形 path 以 `.png` 结尾 | 以 `.webp` 结尾 ＋ existsSync 实存 |
| `bootLoadList.test.ts` ×3 | URL 模板 `.png` | `.webp`（与 `getBootLoadList` 实现对齐） |
| `artManifestReuse.test.ts` ×3 | 复用目标 `.png`；URL `.png` | 对账 object 换成**被加载的** `.webp`；URL `.webp` |
| `scatterAssets.test.ts` ① | 存在 `<id>.png` | 存在 `<id>.webp`（被加载的）＋ **新增 ①b** 断言原 png 仍在盘（零删除留证） |
| `scatterDiskReconcile.test.ts` | 存在 `<id>.png` | 存在 `<id>.webp` |

**注意**：`artManifestReuse.test.ts` 里「缺图建筑原图确实不存在」的断言（`bld_tin_mine.png` 不存在）
**保持不变且仍通过**——因为那两型本来就没有自有素材，与本次转码无关。

## 九、验收自证

### a) 体积 —— 见第 〇/一/二 节（原文输出已贴）
### c) manifest 存在性
```
$ npx tsx tmp/art-exists-check.mts
manifestKeys=55
unresolved=2
unresolvedKeys=["bld_tin_mine","bld_hemp_field"]
requiredTrue=53 requiredFalse=2
requiredTrueMissing=0
diskArtFiles=128
```
⚠️ **本条与完成标准 c 的「unresolved=0」有 2 之差**：这 2 条是 c921-01 就存在的**方案 B「待补素材」键**
（无自有立绘、由 `BUILDING_ART_REUSE` 复用同族贴图），**不是本次转码漏改**——它们的 path 保持 c921-01 时的占位值未动，
本次也没有为它们生成素材（任务禁令：不生成素材）。**关键指标 `requiredTrueMissing=0`**：53 个 true 键**逐个在盘**。
若要把 unresolved 压到 0，只能把这两条 path 改指复用目标（`bld_quarry.webp` / `bld_mulberry_grove.webp`）——
那是注册表语义变更，c921-01 已明确不采用并留痕，本单不擅自改。

### d) vitest / type-check
```
$ npx vitest run
 Test Files  120 passed (120)
      Tests  1269 passed (1269)
   Duration  45.54s

$ npm run type-check
> tsc -p tsconfig.renderer.json --noEmit
EXIT=0
```

### e) 重复组 —— 见第四节（哈希相同、可读、hardlink list 证明同体）
### f) 转码可逆性 —— 备份 png 62 = 转码 62；每个新 webp 一行「原路径→新路径→原 bytes→新 bytes→压缩率」，见第三节

## 十、BGM 降码率（本单不执行 · 只出方案）

状态：**未执行**（本机无 ffmpeg／ffprobe／cwebp／magick，任务禁止下载安装）。

| 项 | 内容 |
|---|---|
| 对象 | `public/audio/*.mp3` 9 个 BGM，54.97 MiB（占全仓 37%） |
| 最大 3 个 | `bgm_prosper_low.mp3` 7.17 MB、`bgm_crisis.mp3` 6.68 MB、`bgm_prosper_high.mp3` 6.55 MB |
| 方案 | `ffmpeg -i in.mp3 -b:a 128k -ac 2 out.mp3`（或 `-q:a 5` VBR） |
| 预期收益 | 320k → 128k 约 **-60%**：audio 55.2 → **≤23 MiB**；届时运行时载荷 67.03 → **≤35 MiB** |
| 需授权 | 安装 ffmpeg（本机缺，任务禁装）→ 需用户授权后方可执行 |
| 复跑命令 | `for f in public/audio/*.mp3; do ffmpeg -y -i "$f" -b:a 128k -ac 2 "tmp/bgm/$f"; done`，人工试听后替换 |
| 风险 | 有损；BGM 是氛围音，128k 通常不可辨，但**未试听验证** |

第二阶段 ≤75 MiB 目标（任务书提及）**在删除原 png 后即可达成**（67.03 ≤75），不必等 BGM；
若再加上 BGM 降码率，可降到 ≤35 MiB。

## 十一、遗留

1. **原 png 62 个仍占盘 92.32 MiB**：删除方案见第五节，需拍板。这也是「磁盘原始占用」不达标的唯一原因。
2. **unresolved=2**（`bld_tin_mine`/`bld_hemp_field` 待补素材）：需美术出图，见 c921-01 报告第三节。
3. **webp q85 未经目视验收**：本单只跑了程序化断言与测试，**没有做过像素级/人眼比对**，属未验证项。
4. **BGM 降码率需装 ffmpeg**：见第十节，需授权。
5. `tmp/` 下产物（backup 92 MB、普查 json、转码 json、脚本）**不入库**（`.gitignore:25 tmp/`），
   但**请勿清理 `tmp/assets-backup-20260920/`**——它是原 png 的唯一无损回滚副本（git 也能还原，双保险）。
