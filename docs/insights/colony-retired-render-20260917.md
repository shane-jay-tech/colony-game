# colony 渲染退役范围核验（916-07，2026-09-17，只读）

## 一、退役范围定谳（依据 7d3aee3 实物）

退役渲染/数据面模块共 **3 个**，来自两个退役提交：

| 模块 | 退役提交 | 删除内容 |
|---|---|---|
| terrainTextures | 7d3aee3（c914-38） | src/renderer/render/terrainTextures.ts + __tests__（-173/-164 行） |
| storyNpcs | 7d3aee3（c914-38） | src/renderer/data/storyNpcs.ts + __tests__（-88/-49 行） |
| resourceSystem | aad0592（h912-14） | src/renderer/state/resourceSystem.ts + __tests__（-168 行测试） |

备份在盘：tmp/backup-colony-20260913-1532/（storyNpcs/terrainTextures 四件）、tmp/backup-colony-20260912/（resourceSystem）。当前工作树三文件均已不存在（ls 实证）。

## 二、逐符号 rg 核验（命令与数字同段）

扫描口径：`rg -n -w '<符号>' src/ tests/`（词边界；colony 测试均在 src/**/__tests__，根 tests/ 不存在故并入 src 树覆盖）。退役文件导出符号全量提取（git show 退役前版本 ^:path）后逐个扫描：

| 符号（所属退役模块） | rg 命中数 | 判定 |
|---|---|---|
| terrainTextures（模块名） | 0 | 零命中 exit=1 |
| makeTilePrng（terrainTextures） | 0 | 零命中 exit=1 |
| drawTerrainHatching（terrainTextures） | 0 | 零命中 exit=1 |
| TextureTarget（terrainTextures） | 0 | 零命中 exit=1 |
| storyNpcs（模块名） | 0 | 零命中 exit=1 |
| STORY_NPC_DEFS（storyNpcs） | 0 | 零命中 exit=1 |
| makeStoryNpcStates（storyNpcs） | 0 | 零命中 exit=1 |
| STORY_NPC_ARC_BEATS / StoryNpcArcBeat（storyNpcs） | 0 / 0 | 零命中 exit=1 |
| resourceSystem（模块名） | 0 | 零命中 exit=1 |
| computeDayDeltas（resourceSystem） | 0 | 零命中 exit=1 |
| tickModifierLifecycle（resourceSystem） | 0 | 零命中 exit=1 |

合并正则复核 `rg -n -w 'terrainTextures|storyNpcs|resourceSystem|makeTilePrng|drawTerrainHatching|STORY_NPC_DEFS|makeStoryNpcStates|computeDayDeltas|tickModifierLifecycle' src/ tests/` → **0 行输出（exit=1）**。

## 三、残留清单与口径对齐

- **残留清单：空（0 条）**——无任何 file:line 需列。
- 与 n916b-04（terrainTextures/storyNpcs src/ 零命中 exit=1）、n916c-12（同族复核同结论）**完全对齐**；本单在其基础上扩宽口径：①补入 resourceSystem（aad0592 退役，前两单未覆盖）；②除模块名外加扫**全部导出符号**（防「改名残留/部分引用」盲区），仍全零。

## 四、验收对照

- ✅ 每个模块/符号一条 rg 口径与命中数（命令与数字同段）。
- ✅ 残留清单逐条 file:line＝空；零残留符号全部标『零命中 exit=1』。
- ✅ 未删文件、未改 import、不 push、只读零触碰。
