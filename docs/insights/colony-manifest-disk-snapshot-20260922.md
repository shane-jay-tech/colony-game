# colony manifest 事实源 × 资源盘全表一致性快照（webp 转码后 78 键复跑）（c922-117，2026-09-22T05:3x，分析级只读）

> 复跑对象＝`docs/insights/colony-missing-assets-20260916.md`（n916f-08）的 79 键 png 时代全表。
> 本单零改动：`public/` 与 `src/` 一字未动；取数脚本落 `tmp/c922-117/`（gitignored），只 import + `existsSync`/`readdirSync`。

## 一、结论（五句）

1. **现值＝78 个引用键**（35+5+10+5+8+9+6），**全表行数＝引用键总数＝78**；相对 9/16 的 79 **净减 1**＝`scatter_bush_dry` 删键（`6664f01`，2026-09-19）。
2. **盘侧全绿**：七类里除两型占位建筑外 **76/76 键的 path 与 loadUrl 两轨均实存**；唯二不存在的两条 path 是 `assets/buildings/bld_{tin_mine,hemp_field}.webp`，它们是**方案 B 有意留的占位**（`required=false`，且 `public/assets/` 整目录不存在），不是缺图。
3. **孤儿面 5 件**（`public/` 81 文件 − 实存被引用 76）＝ `art/scatter/bush_dry.webp` ＋ `art/manifest_portraits_*.json` ×4。前者**已有反向哨兵并走白名单豁免**（`scatterDiskReconcile.test.ts:35` `KNOWN_SCATTER_ORPHANS`），属"已钉待人工"；后者四件**任何哨兵都扫不到**（见 §六）。
4. **与 c922-109 的 `orphansArtFiles=13` 不矛盾，差 8 件的根因是事实源取窄了**：那份口径只读 `ART_MANIFEST`，而 scatter 的权威源是 `scatterConfig.ALL_SCATTER_IDS` ⇒ 8 张**有键**的 scatter 图被误判成孤儿（假孤儿）。⇒ **任何新对账测试的事实源必须是七源并集，不是 `ART_MANIFEST` 自身**（这条同时是 c922-110 §四「自反式假绿」风险在孤儿面的对应形态）。
5. **哨兵覆盖现状＝正向 7/7、反向 1/7**：七类全部有「键→盘」正向断言（与本单 `missing=0` 自洽），但只有 scatter 有「盘→键」反向断言 ⇒ buildings/generals/events/terrain/audio 五类的残留图**静默**（4 件 json 就是这么活了 3 个月）。

## 二、锚点复核（任务书三条，逐字对磁盘）

| 任务书锚点 | 磁盘实况 | 判定 |
|---|---|---|
| `src/renderer/data/artManifest.ts:30`「export const BUILDING_ART: ArtAssetDef[] = [」 | `awk NR==30` 逐字相同 | **未漂** |
| `:124`「export const BUILDING_ART_REUSE: Record<string, string> = {」 | `awk NR==124` 逐字相同 | **未漂** |
| `colony-missing-assets-20260916.md:17`「被引用键总数 = 35+5+10+5+9+9+6 = **79**；下表行数 = 79。」 | 命中仍在 `:17`，加和式与旧表分组行数（35/5/10/5/9/9/6）**逐组吻合并＝79** | **位置未漂，但基准已过期**（scatter 9→8）⇒ 本单按任务书令改判为 78 并逐项归因，不回写旧档 |

## 三、各类目计数（先命令后数字）

**任务书给的 `grep -c "key: '…'"` 口径只对 7 类中的 2 类成立**——BUILDING_ART 与 GENERAL_ART 的表体是 **id 字符串数组 + `.map()` 派生**（`artManifest.ts:33-51`、`:56-63`），源码里根本没有字面 `key: 'bld_'`；BGM/SFX 则不叫 `key:`。⇒ 照字面跑会得到 `BUILDING=0 / GENERAL=0` 这种**看着像"表空了"的假读数**。本单因此统一改为**运行时取键**（`npx tsx` import 真表），并把字面命令的实测值一并留下，供后续班次避坑。

```
# 任务书字面口径（逐类目一条，原样跑）
$ grep -c "key: 'bld_"      src/renderer/data/artManifest.ts                → 0   ← 假读数（表体是 id 列表）
$ grep -c "key: 'gen_"      src/renderer/data/artManifest.ts                → 0   ← 同上；真实键是 portrait_${id}
$ grep -c "key: 'portrait_" src/renderer/data/artManifest.ts                → 0   ← 键是模板串，不是字面量
$ grep -c "key: 'evt_art_"  src/renderer/data/artManifest.ts                → 10  ✓ 仅此类字面成立
$ grep -c "key: 'terrain_"  src/renderer/data/artManifest.ts                → 5   ✓
$ grep -o "'sfx_[a-z_]*'"   src/renderer/state/audioDirector.ts | wc -l     → 6   ✓（SFX_KEYS 单行数组）
$ grep -c "bgm_"            src/renderer/state/audioDirector.ts             → 8   ✗ 少 1：ALL_BGM_KEYS 首行不含键名，
                                                                                 且 33-36 行有 4 处同键复用 ⇒ 字面计数两头都可能错
$ awk 'NR>=63 && NR<=72' src/renderer/data/scatterConfig.ts | grep -o "'[a-z_]*'" | wc -l → 8 ✓（行号锚，易漂）

# 本单采用的口径：运行时从事实源取键（tmp/c922-117/snapshot.mts，零写入）
BUILDING_ART               keys=35     ← 事实源 artManifest.ts:30（.map 派生）
GENERAL_ART                keys=5      ← :55
EVENT_ART                  keys=10     ← :70
TERRAIN_ART                keys=5      ← :88
SCATTER(ALL_SCATTER_IDS)   keys=8      ← scatterConfig.ts:63
BGM(ALL_BGM_KEYS)          keys=9      ← audioDirector.ts:29
SFX(SFX_KEYS)              keys=6      ← audioDirector.ts:36
合计引用键总数 = 78
ART_MANIFEST.length=55 唯一key=55 category 分布={"building":35,"general":5,"event":10,"terrain":5}
required true=53 false=2   扩展名分布={".webp":55}
```

**逐键 existsSync（path 轨 / loadUrl 轨双列）**：

```
BUILDING_ART               n=35  path 轨 missing=2   loadUrl 轨 missing=0
  path 轨缺的两条 = ["bld_tin_mine->assets/buildings/bld_tin_mine.webp",
                     "bld_hemp_field->assets/buildings/bld_hemp_field.webp"]
GENERAL_ART                n=5   missing=0     EVENT_ART n=10 missing=0     TERRAIN_ART n=5 missing=0
SCATTER                    n=8   missing=0     BGM       n=9  missing=0     SFX       n=6 missing=0
REUSE 覆盖键数 2 = {"bld_tin_mine":"bld_quarry","bld_hemp_field":"bld_mulberry_grove"}，两个复用目标均在盘（true/true）
盘上 buildings .webp = 33，被 loadUrl 引用 = 33，盘有键无 = []
```

（复用现成只读脚本 `tmp/art-verify-20260921.mts` 交叉核对，读数同向：`loadUrlTotal=63 loadUrlMissing=0`、`manifestKeys=55 consumedByBoot=55`、`dualTrackDrift=2` 即上面那两型。）

## 四、78 行全表（键 → path 轨 → 存在 → loadUrl 轨 → 存在 → 组）

表头：`| # | 引用键 | manifest.path | 盘 | loadUrl | 盘 | 组 |`。两轨分列是本单相对 9/16 旧表的**口径修正**——旧表每行只有一个路径，把两轨合并成一格，导致 REUSE 两型在旧表里记成「`bld_quarry.png` 存在」而**看不见 manifest.path 轨其实指向不存在的 `assets/…`**（旧表 79 行「缺失」列为空、零报缺）。

| # | 引用键 | manifest.path | 盘 | loadUrl | 盘 | 组 |
|---|---|---|---|---|---|---|
| 1 | bld_farm | art/buildings/bld_farm.webp | 存 | art/buildings/bld_farm.webp | 存 | building |
| 2 | bld_well | art/buildings/bld_well.webp | 存 | art/buildings/bld_well.webp | 存 | building |
| 3 | bld_house | art/buildings/bld_house.webp | 存 | art/buildings/bld_house.webp | 存 | building |
| 4 | bld_market | art/buildings/bld_market.webp | 存 | art/buildings/bld_market.webp | 存 | building |
| 5 | bld_woodcutter | art/buildings/bld_woodcutter.webp | 存 | art/buildings/bld_woodcutter.webp | 存 | building |
| 6 | bld_quarry | art/buildings/bld_quarry.webp | 存 | art/buildings/bld_quarry.webp | 存 | building |
| 7 | bld_tin_mine | assets/buildings/bld_tin_mine.webp | **缺** | art/buildings/bld_quarry.webp | 存 | building |
| 8 | bld_pottery_kiln | art/buildings/bld_pottery_kiln.webp | 存 | art/buildings/bld_pottery_kiln.webp | 存 | building |
| 9 | bld_loom_house | art/buildings/bld_loom_house.webp | 存 | art/buildings/bld_loom_house.webp | 存 | building |
| 10 | bld_smithy | art/buildings/bld_smithy.webp | 存 | art/buildings/bld_smithy.webp | 存 | building |
| 11 | bld_ancestor_shrine | art/buildings/bld_ancestor_shrine.webp | 存 | art/buildings/bld_ancestor_shrine.webp | 存 | building |
| 12 | bld_barracks | art/buildings/bld_barracks.webp | 存 | art/buildings/bld_barracks.webp | 存 | building |
| 13 | bld_academy | art/buildings/bld_academy.webp | 存 | art/buildings/bld_academy.webp | 存 | building |
| 14 | bld_palace | art/buildings/bld_palace.webp | 存 | art/buildings/bld_palace.webp | 存 | building |
| 15 | bld_beacon_tower | art/buildings/bld_beacon_tower.webp | 存 | art/buildings/bld_beacon_tower.webp | 存 | building |
| 16 | bld_post_road | art/buildings/bld_post_road.webp | 存 | art/buildings/bld_post_road.webp | 存 | building |
| 17 | bld_water_mill | art/buildings/bld_water_mill.webp | 存 | art/buildings/bld_water_mill.webp | 存 | building |
| 18 | bld_iron_forge | art/buildings/bld_iron_forge.webp | 存 | art/buildings/bld_iron_forge.webp | 存 | building |
| 19 | bld_mulberry_grove | art/buildings/bld_mulberry_grove.webp | 存 | art/buildings/bld_mulberry_grove.webp | 存 | building |
| 20 | bld_hemp_field | assets/buildings/bld_hemp_field.webp | **缺** | art/buildings/bld_mulberry_grove.webp | 存 | building |
| 21 | bld_stele_yard | art/buildings/bld_stele_yard.webp | 存 | art/buildings/bld_stele_yard.webp | 存 | building |
| 22 | bld_village_school | art/buildings/bld_village_school.webp | 存 | art/buildings/bld_village_school.webp | 存 | building |
| 23 | bld_envoy_lodge | art/buildings/bld_envoy_lodge.webp | 存 | art/buildings/bld_envoy_lodge.webp | 存 | building |
| 24 | bld_training_ground | art/buildings/bld_training_ground.webp | 存 | art/buildings/bld_training_ground.webp | 存 | building |
| 25 | bld_stable | art/buildings/bld_stable.webp | 存 | art/buildings/bld_stable.webp | 存 | building |
| 26 | bld_chariot_works | art/buildings/bld_chariot_works.webp | 存 | art/buildings/bld_chariot_works.webp | 存 | building |
| 27 | bld_city_wall | art/buildings/bld_city_wall.webp | 存 | art/buildings/bld_city_wall.webp | 存 | building |
| 28 | bld_imperial_guard | art/buildings/bld_imperial_guard.webp | 存 | art/buildings/bld_imperial_guard.webp | 存 | building |
| 29 | bld_granary | art/buildings/bld_granary.webp | 存 | art/buildings/bld_granary.webp | 存 | building |
| 30 | bld_watchtower | art/buildings/bld_watchtower.webp | 存 | art/buildings/bld_watchtower.webp | 存 | building |
| 31 | bld_censor | art/buildings/bld_censor.webp | 存 | art/buildings/bld_censor.webp | 存 | building |
| 32 | bld_grand_temple | art/buildings/bld_grand_temple.webp | 存 | art/buildings/bld_grand_temple.webp | 存 | building |
| 33 | bld_observatory | art/buildings/bld_observatory.webp | 存 | art/buildings/bld_observatory.webp | 存 | building |
| 34 | bld_relay_station | art/buildings/bld_relay_station.webp | 存 | art/buildings/bld_relay_station.webp | 存 | building |
| 35 | bld_nine_cauldrons | art/buildings/bld_nine_cauldrons.webp | 存 | art/buildings/bld_nine_cauldrons.webp | 存 | building |
| 36 | portrait_gen_pei_shao | art/generals/gen_pei_shao.webp | 存 | art/generals/gen_pei_shao.webp | 存 | general |
| 37 | portrait_gen_hu_ben | art/generals/gen_hu_ben.webp | 存 | art/generals/gen_hu_ben.webp | 存 | general |
| 38 | portrait_gen_xie_changqing | art/generals/gen_xie_changqing.webp | 存 | art/generals/gen_xie_changqing.webp | 存 | general |
| 39 | portrait_gen_tian_zhong | art/generals/gen_tian_zhong.webp | 存 | art/generals/gen_tian_zhong.webp | 存 | general |
| 40 | portrait_gen_barbarian | art/generals/gen_barbarian.webp | 存 | art/generals/gen_barbarian.webp | 存 | general |
| 41 | evt_art_unification | art/events/unification.webp | 存 | art/events/unification.webp | 存 | event |
| 42 | evt_art_coronation | art/events/coronation.webp | 存 | art/events/coronation.webp | 存 | event |
| 43 | evt_art_battle | art/events/battle.webp | 存 | art/events/battle.webp | 存 | event |
| 44 | evt_art_flood | art/events/flood.webp | 存 | art/events/flood.webp | 存 | event |
| 45 | evt_art_feast | art/events/feast.webp | 存 | art/events/feast.webp | 存 | event |
| 46 | evt_art_diplomacy | art/events/diplomacy.webp | 存 | art/events/diplomacy.webp | 存 | event |
| 47 | evt_art_rebellion | art/events/rebellion.webp | 存 | art/events/rebellion.webp | 存 | event |
| 48 | evt_art_ending_gong | art/events/ending_gong.webp | 存 | art/events/ending_gong.webp | 存 | event |
| 49 | evt_art_ending_jia | art/events/ending_jia.webp | 存 | art/events/ending_jia.webp | 存 | event |
| 50 | evt_art_ending_huo | art/events/ending_huo.webp | 存 | art/events/ending_huo.webp | 存 | event |
| 51 | terrain_forest | art/terrain/forest.webp | 存 | art/terrain/forest.webp | 存 | terrain |
| 52 | terrain_hills | art/terrain/hills.webp | 存 | art/terrain/hills.webp | 存 | terrain |
| 53 | terrain_mountain | art/terrain/mountain.webp | 存 | art/terrain/mountain.webp | 存 | terrain |
| 54 | terrain_plain | art/terrain/plain.webp | 存 | art/terrain/plain.webp | 存 | terrain |
| 55 | terrain_river | art/terrain/river.webp | 存 | art/terrain/river.webp | 存 | terrain |
| 56 | scatter_tree_pine | art/scatter/tree_pine.webp | 存 | art/scatter/tree_pine.webp | 存 | scatter |
| 57 | scatter_tree_locust | art/scatter/tree_locust.webp | 存 | art/scatter/tree_locust.webp | 存 | scatter |
| 58 | scatter_tree_mulberry | art/scatter/tree_mulberry.webp | 存 | art/scatter/tree_mulberry.webp | 存 | scatter |
| 59 | scatter_tree_willow | art/scatter/tree_willow.webp | 存 | art/scatter/tree_willow.webp | 存 | scatter |
| 60 | scatter_rock_boulder | art/scatter/rock_boulder.webp | 存 | art/scatter/rock_boulder.webp | 存 | scatter |
| 61 | scatter_bush_shrub | art/scatter/bush_shrub.webp | 存 | art/scatter/bush_shrub.webp | 存 | scatter |
| 62 | scatter_reed_clump | art/scatter/reed_clump.webp | 存 | art/scatter/reed_clump.webp | 存 | scatter |
| 63 | scatter_grass_tuft | art/scatter/grass_tuft.webp | 存 | art/scatter/grass_tuft.webp | 存 | scatter |
| 64 | bgm_prosper_low | audio/bgm_prosper_low.mp3 | 存 | audio/bgm_prosper_low.mp3 | 存 | BGM |
| 65 | bgm_prosper_mid | audio/bgm_prosper_mid.mp3 | 存 | audio/bgm_prosper_mid.mp3 | 存 | BGM |
| 66 | bgm_prosper_high | audio/bgm_prosper_high.mp3 | 存 | audio/bgm_prosper_high.mp3 | 存 | BGM |
| 67 | bgm_crisis | audio/bgm_crisis.mp3 | 存 | audio/bgm_crisis.mp3 | 存 | BGM |
| 68 | bgm_war | audio/bgm_war.mp3 | 存 | audio/bgm_war.mp3 | 存 | BGM |
| 69 | bgm_ritual | audio/bgm_ritual.mp3 | 存 | audio/bgm_ritual.mp3 | 存 | BGM |
| 70 | bgm_ending_gong | audio/bgm_ending_gong.mp3 | 存 | audio/bgm_ending_gong.mp3 | 存 | BGM |
| 71 | bgm_ending_jia | audio/bgm_ending_jia.mp3 | 存 | audio/bgm_ending_jia.mp3 | 存 | BGM |
| 72 | bgm_ending_huo | audio/bgm_ending_huo.mp3 | 存 | audio/bgm_ending_huo.mp3 | 存 | BGM |
| 73 | sfx_bell | audio/sfx_bell.wav | 存 | audio/sfx_bell.wav | 存 | SFX |
| 74 | sfx_chime | audio/sfx_chime.wav | 存 | audio/sfx_chime.wav | 存 | SFX |
| 75 | sfx_gong | audio/sfx_gong.wav | 存 | audio/sfx_gong.wav | 存 | SFX |
| 76 | sfx_place | audio/sfx_place.wav | 存 | audio/sfx_place.wav | 存 | SFX |
| 77 | sfx_click | audio/sfx_click.wav | 存 | audio/sfx_click.wav | 存 | SFX |
| 78 | sfx_warn | audio/sfx_warn.wav | 存 | audio/sfx_warn.wav | 存 | SFX |


**行数自证**：`ROWS=78` ＝ §三 的「合计引用键总数 78」＝表体数据行数 78，三口径一致。

## 五、相对 9/16 的差集归因（逐项）

| 差项 | 旧（9/16） | 新（9/22） | 归因 | 证据 |
|---|---|---|---|---|
| 键总数 | 79 | **78** | `scatter_bush_dry` 删键 | `git log -S"bush_dry" -- scatterConfig.ts` → `6664f01 c918-09: bush_dry 闲置清单项删除(…png保留可恢复;对账用例9→8同步)`，同提交改 `scatterConfig.ts` 1 行 + `scatterDiskReconcile.test.ts` 1 行 |
| scatter 组行数 | 9 | 8 | 同上 | `ALL_SCATTER_IDS` 现 8（`scatterConfig.ts:63-67`） |
| 图行扩展名 | 64 行 `.png` | 63 行 `.webp` | 整批转码 c921-02 | 旧表数据行第 3 列扩展名分布实测 `9 mp3 / 64 png / 6 wav`；`f0c9754 c921-02 授权闭环: 删除 62 个转码后原 png…连带修正 2 条把'原 png 仍在'写死的断言` |
| 音频行 | 15（9 mp3＋6 wav） | 15（不变） | 音频未参与转码 | `public/audio` 现值 9 mp3＋6 wav |
| 单轨 vs 双轨 | 每行 1 路径 | 每行 2 路径 | `BUILDING_ART_REUSE` 上位（n916d-23）后两轨不再同义 | 旧表 :29 那行把 `bld_tin_mine` 记成 `art/buildings/bld_quarry.png 存在（复用…；本体 png 缺）`，把两轨压进一格并加了括注——新表用两列消掉这种压缩 |
| 「全表零缺图」这句话 | 成立（79 行全「存在」） | **只在对账 loadUrl 轨时成立** | path 轨恒有 2 个有意占位 | 旧表 `awk $5 !~ /存在/` → 0 行；本单 path 轨 missing=2 |

**未被 9/16 之后事件影响的组**：BUILDING 35（键数未变，但其中 2 键的实存性从「靠本体图」改成「靠复用图」）、GENERAL 5、EVENT 10、TERRAIN 5、BGM 9、SFX 6 ⇒ **差集只有 scatter −1 与扩展名改写两类，无隐藏漂移**。

## 六、孤儿面（盘有键无）单列

```
public/ 文件总数 = 81   七源并集引用的不同 URL 数 = 78   其中盘上不存在（空槽）= 2
孤儿 = 81 − (78 − 2) = 5 件：
  ORPHAN art/manifest_portraits_1781872115.json
  ORPHAN art/manifest_portraits_1781872230.json
  ORPHAN art/manifest_portraits_1781872304.json
  ORPHAN art/manifest_portraits_1781872377.json
  ORPHAN art/scatter/bush_dry.webp
public/ 扩展名分布 = {".webp":62, ".json":4, ".mp3":9, ".wav":6}
   自洽核对：被引用的非 webp 只有 9 mp3 + 6 wav = 15 条 ⇒ 被引用的 webp = 76 − 15 = 61；
   盘上 62 = 61 引用 + 1 孤儿（bush_dry.webp），4 json 全是孤儿 ⇒ 81 = 76 引用 + 5 孤儿 ✓
```

| 孤儿 | 谁生成的 | 现有哪些哨兵能看到它 | 交叉引用 |
|---|---|---|---|
| `bush_dry.webp`（118,188 B，mtime 09-20 12:46） | c921-02 转码时随 png 一起产出的产物；键在 `6664f01` 删除，图未同批删（提交信息自述「png 保留可恢复」） | **看得到并已豁免**：`scatterDiskReconcile.test.ts:33-40` 反向用例 + `KNOWN_SCATTER_ORPHANS = ['bush_dry.webp']` 白名单，注释里写明「去留不在本单裁决」 | `docs/insights/colony-scatter-bidir-20260922.md:59` 出口 A；主班 05:5x 交接「落 0 还需处置 bush_dry.webp＝待人工」 |
| `manifest_portraits_*.json` ×4 | 生成器 `scripts/gen_portraits_events.py:154` 的 `manifest_portraits_{int(time.time())}.json`（每次出图写一份，时间戳命名 ⇒ 天然增殖） | **没有任何哨兵看得到**：它们不在 `public/art/` 的任何类别子目录里，而现有反向用例只扫 `public/art/scatter`；正向用例只遍历键 ⇒ 双向都覆盖不到 | `docs/insights/colony-manifest-portraits-orphan-20260922.md`（c922-109，三案 A/B/D 已备）；`docs/design/p1-4-manifest-authority-20260922.md:203` 已把它列为待授权处置项 |

**与 c922-109 的 `orphansArtFiles=13` 对平**：13 − 5 = 8，正是 8 张**有键**的 scatter 图被当成孤儿（那份口径把「事实源」限定在 `ART_MANIFEST` 的 55 键上，scatter 的权威源在 `scatterConfig.ts`）。⇒ 两个数都对，**差别在事实源集合**；本单 5 件是七源并集口径下的真孤儿。

## 七、差集项该不该固化成对账测试（本单的评估结论）

**现状盘点（先列命令后结论）**：

```
$ rg -n "existsSync\(" src/renderer/data/__tests__/*.test.ts src/renderer/state/__tests__/audioKeys.test.ts
正向（键→盘）已有覆盖：
  building  artManifestReuse.test.ts:13/33 + bootLoadList.test.ts:137/164
  general   同上（getBootLoadList('general') 进 LOAD_SOURCES 面）
  event     artManifest.test.ts:57 + artManifestEvtArtUsage.test.ts:86/101
  terrain   terrainPaths.test.ts:20
  scatter   scatterDiskReconcile.test.ts:19 + scatterAssets.test.ts:24
  BGM/SFX   audioKeys.test.ts:25/33
反向（盘→键）覆盖：只有 scatterDiskReconcile.test.ts:38-40（rg -l readdirSync 全仓共 9 个文件，其中扫 public 的只有这一个）
```

**评估结论（三条，建议级，本单不实施）**：

1. **正向不必再补**——七类各有钉桩，且与本单 `missing=0` 互相自证。
2. **反向该补，但只补"一条总的"，别补七条**：新增一条「`public/` 全量文件 ⊆ 七源并集 ∪ 显式白名单」的对账用例即可，事实源集合**必须显式列出七个**（`BUILDING_ART`+`GENERAL_ART`+`EVENT_ART`+`TERRAIN_ART`+`ALL_SCATTER_IDS`+`ALL_BGM_KEYS`+`SFX_KEYS`）；照 ART_MANIFEST 单源写会**第一天就红 8 件假孤儿**（= §六 与 c922-109 差 8 的那笔账）。
3. **补这条反向用例时必须避开三处雷**：
   - **不得从被守护的表自身派生期望集**（自反式假绿，沿用 c922-110 §四头号风险；本单语境下＝不能用 `ART_MANIFEST.map(a=>a.path)` 反推"盘上应该有什么"）；
   - **不得顺手把 `BootScene.ts:69-72` 的 EVENT_ART URL 重拼面收进同一条用例**——那是 c922-110 §九.3 / P1-4 的活，两单合批必翻桩；本单的 loadUrl 轨只取 `getBootLoadList()`，事件轨在 `artManifest` 侧就是 `a.path` 本身；
   - **既有两条契约的豁免集是硬编码副本**：`bootLoadList.test.ts:87`（`PENDING`）、`:128`（`NO_OWN_ART_KEYS`）、`artManifest.test.ts:13`、`artManifest.ts:28`（`NO_OWN_ART`，未 export）＋ `artManifest.ts:125` REUSE 表 ⇒ **同一对键在仓内抄了 5 份**（`rg -c bld_tin_mine src/ scripts/` 按文件计 6 文件 13 处）。第二型待补素材进表时要同时改 5 处——**登记为重复建设，属人工/规划域，本单不动**。
   - 另须同批决定 4 件 json 的归属（c922-109 三案 A/B/D）：反向用例落地前它们必然红，先处置或先入白名单，**顺序不能反**。

## 八、本单改动清单

- 新增：本档 `docs/insights/colony-manifest-disk-snapshot-20260922.md`（含 §四 78 行全表）
- 追加：`docs/insights/colony-insights-index-20260919.md` 1 行（纯 CRLF 守恒，字母序）
- 只读取数件（gitignored，非产出）：`tmp/c922-117/snapshot.mts`、`tmp/c922-117/table.mts`、`tmp/c922-117/parse_manifest.py`
- `public/`、`src/`、`scripts/` **零改动**；未跑生成器、未删任何孤儿件、未碰 `BootScene.ts:69-72`、未碰经济平衡数值
