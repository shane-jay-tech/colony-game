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

## 五、勘误追加（c927-71，2026-09-29T05:1x，colony62 班；**本节为纯插入，上方正文一字未改**）

改判出处＝`docs/insights/colony-retired-backup-verify-20260922.md`（c922-115 遗留 1 给主班的改判）。本班按盘上实况复核后落笔，只更新备份状态与恢复路径，不回写历史正文。

1. **:13「备份在盘」的保障方向与实况相反。** 六件 tmp 副本确在盘，但它们被 `.gitignore:25 tmp/` 覆盖 ⇒ 不受 git 看守、不被 `git status` 探针看见、只活在当前这块盘；而 git 侧权威副本**已推远端**。复核（本班 2026-09-29 现跑，HEAD `6fbeb23`）：
   - `$ git merge-base --is-ancestor 7d3aee3 origin/codex/architecture-hardening` → **rc=0**；`aad0592` → **rc=0**
   - `$ git check-ignore -v tmp/backup-colony-20260913-1532/storyNpcs.ts tmp/backup-colony-20260912/state/resourceSystem.ts` → 两条均 `.gitignore:25:tmp/`
   - ⇒ 读 :13 不要推出「tmp 清理前必须留档」；清 tmp **不损失恢复能力**。
2. **恢复路径唯一且更短**（本班实测行数）：`$ git show 7d3aee3^:src/renderer/render/terrainTextures.ts | wc -l` → **173**；`$ git show aad0592^:src/renderer/state/resourceSystem.ts | wc -l` → **79**。
3. **:11 口径残缺（沿用 c922-115 证据 8，本班独立复测仍成立）**：只记 `-168 行测试`、漏 `resourceSystem.ts` 本体 **79 行**；同档 :10 双数齐备。:9 的 `-173/-164` 实测正确。
4. **备份状态现值（本班现点，六件自写入后 mtime 未变、零删零改）**：

   | 备份件 | 字节 | mtime |
   |---|---|---|
   | `tmp/backup-colony-20260913-1532/storyNpcs.ts` | 3161 | 2026-09-13 15:32:35.628 |
   | `tmp/backup-colony-20260913-1532/storyNpcs.test.ts` | 1811 | 2026-09-13 15:32:35.640 |
   | `tmp/backup-colony-20260913-1532/terrainTextures.ts` | 7052 | 2026-09-13 15:32:35.655 |
   | `tmp/backup-colony-20260913-1532/terrainTextures.test.ts` | 6054 | 2026-09-13 15:32:35.666 |
   | `tmp/backup-colony-20260912/state/resourceSystem.ts` | 3435 | 2026-09-13 01:08:46.586 |
   | `tmp/backup-colony-20260912/state/resourceSystem.test.ts` | 6024 | 2026-09-13 01:08:46.623 |

   ⇒ :13 括号里的件数口径按实况为**四件＋两件＝六件**（c922-115 已把"4+1 件"改判为 6 件全集，本班复核 `find tmp/backup-colony-20260913-1532 tmp/backup-colony-20260912 -type f` 恰 6 条，别处无副本）。
5. **内容层复核（本班重跑 c922-115 判据，逐位同其 9/22 读数）**：`git show <退役>^:<path> | md5sum` 对 `md5sum tmp/<备份>` → **raw 相等 2/6**（terrainTextures 两件）、**LF 归一后相等 6/6** ⇒ 盘上副本不含任何 git 里没有的内容，四件 raw 差异纯由 `core.autocrlf=true` 行尾造成。等值件复算锚：`storyNpcs.ts` 归一后 `9bfd3e44824b568999b1224b6732d2c7`、`resourceSystem.ts` `d8877bb08a024bdc7abdf1dff400c20c`、`terrainTextures.ts` `e65022261d1bec4f9484d7b06043dbb8`。
6. **未处置项登记**：`docs/insights/colony-untracked-residue-20260917.md` 的跨仓取数嫌疑面（c922-115 遗留 3）与本档无涉，本班未碰；整档复核属人工/规划域。
