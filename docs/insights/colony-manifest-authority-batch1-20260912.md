# colony asset manifest 权威化批次一报告（h912-11，2026-09-13 夜班）

任务：删除 BootScene 中与 artManifest 重复的加载列表，改为 manifest 派生；等价断言 same=true；≥2 单测。口径＝PLAN.md:30「Make the asset manifest the authoritative boot-loading source where it already describes assets」。

## 一、重复条目清单（改造前，file:line）

| 加载组 | BootScene 原位置 | 数据源 | 与 manifest 关系 |
|---|---|---|---|
| 建筑 35 | src/renderer/scenes/BootScene.ts:38-40（`for (def of BUILDINGS)`） | data/buildings.ts（id==assetKey） | **与 BUILDING_ART 完全重复**（集合相等；顺序差 2 项，见四） |
| 将领 5 | BootScene.ts:51-53（`for (g of GENERAL_POOL)`） | data/generals.ts GENERAL_POOL | **与 GENERAL_ART 完全重复**（key=portrait_${id}，顺序一致） |
| 事件 10 | BootScene.ts:55-58 | artManifest.EVENT_ART | 已是 manifest 权威（P0-3 先例），本单未动 |
| 地形 5 | BootScene.ts:43-45（硬编码数组） | 无 | **不等价**：TERRAIN_ART 仅 3 型且命名不一（hills vs hill、缺 forest/river/mountain）→ 按失败处理条款保留 |
| 散布/音频 | BootScene.ts:47-49/63-68 | scatterConfig/audioDirector | manifest 未描述 → 保留 |

## 二、改造

- `artManifest.ts` 新增 `getBootLoadList(category: 'building'|'general'): BootLoadItem[]`——manifest 为权威源派生键与顺序；URL 模板固化 `art/<类别>/<id>.png`（manifest 的 `assets/*.webp` 是 Phase D 占位约定、与实际落盘不符，故只派生键清单，这正是「只改可等价部分」的落点）。
- `BootScene.ts`：建筑/将领两段手写循环删除，改调 `getBootLoadList(...)`；**分段调用保持原全局加载序**（建筑→地形→散布→将领→事件→音频）；BUILDINGS/GENERAL_POOL 导入移除；地形/散布/音频原样保留并注释原因。

## 三、等价断言与单测（src/renderer/data/__tests__/bootLoadList.test.ts，2 条，全绿）

- ① 派生序列 vs 旧硬编码清单（BUILDINGS/GENERAL_POOL 快照）`toEqual`＋JSON.stringify 逐字 diff → **same=true**；
- ② 向 GENERAL_ART push 探针条目 → 派生列表自动包含且追加在尾部（finally 还原数组）。

## 四、调序披露（禁止条款边界处理）

equality 断言初跑失败：BUILDING_ART 与 buildings.ts **集合相等但顺序不等**（bld_tin_mine 数据表在第 7 位、清单在第 34；bld_hemp_field 第 20 位 vs 第 33）。直接派生会漂移这两项加载序、踩「不改加载顺序」；故将 BUILDING_ART 两条**移至与数据表一致的权威位**——条目内容零改动、仅调序，且 BUILDING_ART 无仓库内其他消费方（rg 实证仅 artManifest.ts 自身＋测试），外部影响为零。已在 manifest 内注释说明。

## 五、回归

- `npm run type-check`（tsc -p tsconfig.renderer.json --noEmit）→ exit 0（注：仓库根无 tsconfig.json，裸 `npx tsc --noEmit` 会落 help 页，须走 type-check 脚本）。
- `npm test` → **87 files / 1127 tests 全部通过**（原 1125＋新增 2）。

## 遗留问题

- 地形清单权威化需先统一命名（hills/hill）并补 forest/river/mountain 三型入 manifest——涉及 manifest 扩条目，属禁止项，留批次二。
- 散布/音频入 manifest 同上（批次二/三候选）。
- UI_ART（6 条）manifest 有述而 Boot 未加载——是否入 boot 清单属扩载行为，留拍板。
