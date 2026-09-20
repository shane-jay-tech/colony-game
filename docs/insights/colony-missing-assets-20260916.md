# colony 启动面缺图清单核对（n916f-08，2026-09-16 建单 / 2026-09-17 夜执行）

只读核对：BootScene.preload 8 组被引用资源键 ↔ 磁盘实存。**重要背景：U1/U2 已由 n916d-22（rock_cluster 移除引用）与 n916d-23（BUILDING_ART_REUSE 复用贴图）修复，本单为修复后复核——结论＝8 组引用键 100% 可解析到实存文件，零加载缺失。**

## 一、计数命令与数字（先命令后数字）

```
$ grep -o "'bld_[a-z_]*'" src/renderer/data/artManifest.ts | wc -l   → 37（35 个 BUILDING_ART 键 + BUILDING_ART_REUSE 2 个 Record 键）
$ grep -o "'gen_[a-z_]*'"  src/renderer/data/artManifest.ts | wc -l   → 5
$ grep -c "key: 'evt_art_" src/renderer/data/artManifest.ts              → 10
$ grep -o "'bgm_[a-z_]*'" src/renderer/state/audioDirector.ts | wc -l → 13（ALL_BGM_KEYS 9 键 + 情绪选择 return 4 处同键引用）
$ grep -o "'sfx_[a-z_]*'" src/renderer/state/audioDirector.ts | wc -l → 6
$ ls public/art/buildings | wc -l → 33 | generals → 5 | events → 10 | terrain → 5 | scatter → 9
$ ls public/audio/*.mp3 | wc -l → 9 | public/audio/*.wav | wc -l → 6
$ rg -n 'rock_cluster' src/  → 仅 2 文件＝修复注释（scatterConfig.ts:42）＋防回潮用例（__tests__/scatterAssets.test.ts 正向断言不引用），零功能引用
```
被引用键总数 = 35+5+10+5+9+9+6 = **79**；下表行数 = 79。

## 二、引用键 → 落盘路径 → 存在性 全量表（79 行）

| # | 引用键 | 落盘路径（public/ 下） | 存在/缺失 | 所属组 | 缺图后果 |
|---|--------|------------------------|-----------|--------|----------|
| 1 | bld_farm | art/buildings/bld_farm.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 2 | bld_well | art/buildings/bld_well.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 3 | bld_house | art/buildings/bld_house.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 4 | bld_market | art/buildings/bld_market.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 5 | bld_woodcutter | art/buildings/bld_woodcutter.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 6 | bld_quarry | art/buildings/bld_quarry.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 7 | bld_tin_mine | art/buildings/bld_quarry.png | 存在（复用 bld_quarry.png；本体 png 缺） | building | 回退沙印/色块（当前全命中，无回退） |
| 8 | bld_pottery_kiln | art/buildings/bld_pottery_kiln.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 9 | bld_loom_house | art/buildings/bld_loom_house.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 10 | bld_smithy | art/buildings/bld_smithy.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 11 | bld_ancestor_shrine | art/buildings/bld_ancestor_shrine.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 12 | bld_barracks | art/buildings/bld_barracks.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 13 | bld_academy | art/buildings/bld_academy.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 14 | bld_palace | art/buildings/bld_palace.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 15 | bld_beacon_tower | art/buildings/bld_beacon_tower.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 16 | bld_post_road | art/buildings/bld_post_road.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 17 | bld_water_mill | art/buildings/bld_water_mill.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 18 | bld_iron_forge | art/buildings/bld_iron_forge.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 19 | bld_mulberry_grove | art/buildings/bld_mulberry_grove.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 20 | bld_hemp_field | art/buildings/bld_mulberry_grove.png | 存在（复用 bld_mulberry_grove.png；本体 png 缺） | building | 回退沙印/色块（当前全命中，无回退） |
| 21 | bld_stele_yard | art/buildings/bld_stele_yard.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 22 | bld_village_school | art/buildings/bld_village_school.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 23 | bld_envoy_lodge | art/buildings/bld_envoy_lodge.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 24 | bld_training_ground | art/buildings/bld_training_ground.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 25 | bld_stable | art/buildings/bld_stable.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 26 | bld_chariot_works | art/buildings/bld_chariot_works.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 27 | bld_city_wall | art/buildings/bld_city_wall.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 28 | bld_imperial_guard | art/buildings/bld_imperial_guard.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 29 | bld_granary | art/buildings/bld_granary.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 30 | bld_watchtower | art/buildings/bld_watchtower.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 31 | bld_censor | art/buildings/bld_censor.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 32 | bld_grand_temple | art/buildings/bld_grand_temple.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 33 | bld_observatory | art/buildings/bld_observatory.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 34 | bld_relay_station | art/buildings/bld_relay_station.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 35 | bld_nine_cauldrons | art/buildings/bld_nine_cauldrons.png | 存在 | building | 回退沙印/色块（当前全命中，无回退） |
| 36 | portrait_gen_pei_shao | art/generals/gen_pei_shao.png | 存在 | general | 军务面板回退文字 |
| 37 | portrait_gen_hu_ben | art/generals/gen_hu_ben.png | 存在 | general | 军务面板回退文字 |
| 38 | portrait_gen_xie_changqing | art/generals/gen_xie_changqing.png | 存在 | general | 军务面板回退文字 |
| 39 | portrait_gen_tian_zhong | art/generals/gen_tian_zhong.png | 存在 | general | 军务面板回退文字 |
| 40 | portrait_gen_barbarian | art/generals/gen_barbarian.png | 存在 | general | 军务面板回退文字 |
| 41 | evt_art_unification | art/events/unification.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 42 | evt_art_coronation | art/events/coronation.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 43 | evt_art_battle | art/events/battle.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 44 | evt_art_flood | art/events/flood.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 45 | evt_art_feast | art/events/feast.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 46 | evt_art_diplomacy | art/events/diplomacy.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 47 | evt_art_rebellion | art/events/rebellion.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 48 | evt_art_ending_gong | art/events/ending_gong.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 49 | evt_art_ending_jia | art/events/ending_jia.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 50 | evt_art_ending_huo | art/events/ending_huo.png | 存在 | event | 朝议弹窗/结局回退文字 |
| 51 | terrain_plain | art/terrain/plain.png | 存在 | terrain | MapRenderer 回退色块 |
| 52 | terrain_hills | art/terrain/hills.png | 存在 | terrain | MapRenderer 回退色块 |
| 53 | terrain_forest | art/terrain/forest.png | 存在 | terrain | MapRenderer 回退色块 |
| 54 | terrain_river | art/terrain/river.png | 存在 | terrain | MapRenderer 回退色块 |
| 55 | terrain_mountain | art/terrain/mountain.png | 存在 | terrain | MapRenderer 回退色块 |
| 56 | scatter_tree_pine | art/scatter/tree_pine.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 57 | scatter_tree_locust | art/scatter/tree_locust.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 58 | scatter_tree_mulberry | art/scatter/tree_mulberry.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 59 | scatter_tree_willow | art/scatter/tree_willow.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 60 | scatter_rock_boulder | art/scatter/rock_boulder.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 61 | scatter_bush_shrub | art/scatter/bush_shrub.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 62 | scatter_bush_dry | art/scatter/bush_dry.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 63 | scatter_reed_clump | art/scatter/reed_clump.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 64 | scatter_grass_tuft | art/scatter/grass_tuft.png | 存在 | scatter | MapRenderer 跳过该散布 |
| 65 | bgm_prosper_low | audio/bgm_prosper_low.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 66 | bgm_prosper_mid | audio/bgm_prosper_mid.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 67 | bgm_prosper_high | audio/bgm_prosper_high.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 68 | bgm_crisis | audio/bgm_crisis.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 69 | bgm_war | audio/bgm_war.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 70 | bgm_ritual | audio/bgm_ritual.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 71 | bgm_ending_gong | audio/bgm_ending_gong.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 72 | bgm_ending_jia | audio/bgm_ending_jia.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 73 | bgm_ending_huo | audio/bgm_ending_huo.mp3 | 存在 | BGM | AudioManager 静音降级 |
| 74 | sfx_bell | audio/sfx_bell.wav | 存在 | SFX | AudioManager 静音降级 |
| 75 | sfx_chime | audio/sfx_chime.wav | 存在 | SFX | AudioManager 静音降级 |
| 76 | sfx_gong | audio/sfx_gong.wav | 存在 | SFX | AudioManager 静音降级 |
| 77 | sfx_place | audio/sfx_place.wav | 存在 | SFX | AudioManager 静音降级 |
| 78 | sfx_click | audio/sfx_click.wav | 存在 | SFX | AudioManager 静音降级 |
| 79 | sfx_warn | audio/sfx_warn.wav | 存在 | SFX | AudioManager 静音降级 |

表内「缺失」行数 = 0。

## 三、U1/U2 逐项结论（复核命令与输出同段）

**U1 rock_cluster（scatterConfig 散布池）——已收口，引用侧零残留**

```
$ rg -n 'rock_cluster' src/renderer/data/scatterConfig.ts
42:      // rock_cluster 移除（n916d-22）：public/art/scatter/ 无此贴图，加载静默缺失；
$ ls public/art/scatter/ | wc -l            → 9
$ ls public/art/scatter/rock_cluster.png    → 不存在（有意不补，见下）
```
ALL_SCATTER_IDS（scatterConfig.ts:62-67）现仅 9 键、与磁盘 9 张一一对应；hills/mountain 两池均只引 rock_boulder（实存）。**处置建议：维持现状（删引用方案已实施）**——补图转正属美术拍板项（art-library/scatter_raw/rock_cluster.png 候选），非本单授权。

**U2 两建筑（bld_tin_mine / bld_hemp_field）——已收口，经 BUILDING_ART_REUSE 复用实存图**

```
$ rg -n 'BUILDING_ART_REUSE' src/renderer/data/artManifest.ts
96: export const BUILDING_ART_REUSE: Record<string, string> = {
97:   bld_tin_mine: 'bld_quarry',
98:   bld_hemp_field: 'bld_mulberry_grove',
$ ls public/art/buildings/bld_quarry.png public/art/buildings/bld_mulberry_grove.png  → 两文件均存在
$ ls public/art/buildings/bld_tin_mine.png public/art/buildings/bld_hemp_field.png    → 本体 png 仍缺（加载不受扰）
```
getBootLoadList('building')（artManifest.ts:101-105）把两键 URL 改指复用图，boot 加载 35/35 全命中、零 loaderror。**处置建议：维持占位（复用同族图）**——正式立绘完成后删 REUSE 表两行即可（代码内已自注）。

## 四、其余 77 键结论

general 5/5、event 10/10、terrain 5/5、scatter 9/9、BGM 9/9、SFX 6/6 全部键↔文件一一对应，零缺失、零多余引用。

## 五、验收情况

- 表行数 79＝被引用键数（35+5+10+5+9+9+6），rg/ls 计数命令与数字同段（见§一）。✅
- U1/U2 逐项存在性结论均附复核命令与输出（§三）。✅
- `npm.cmd test` 退出码 **0**（94 文件 / 1153 用例全绿，2026-09-17 23:07）。✅
- `git diff --stat` 空、`git status --porcelain` 仅本报告文件（src/配置零改动）。✅

## 六、遗留问题

无。U1 补图转正、U2 正式立绘两项属美术拍板项，不在本单授权（已在§三给处置建议）。

