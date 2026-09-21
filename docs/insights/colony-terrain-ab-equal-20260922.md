# colony 地形三方互等钉桩（A×B 集合相等，c921-06 §四.4 预留项落地）

- 单号：c922-101-terrain-ab-equal｜执行：`qoder-executor-20260922-0000-colony3`｜2026-09-22T03:0x
- 仓库：`D:/code/colony-game`，分支 `codex/architecture-hardening`，开工 HEAD `69b262a`
- 改动面：**仅 1 个测试文件**（`src/renderer/data/__tests__/terrainPaths.test.ts`，＋42/−1 行）。生产码零改动，资产零改动。

## 一、三方定义与改前守护面

| 侧 | 事实源 | 现值 |
|---|---|---|
| A 资源清单 | `artManifest.ts:88-94` `TERRAIN_ART`，key=`terrain_<kind>`、path=`art/terrain/<kind>.webp` | 5 型 |
| B 类型/生成 | `mapSchema.ts:9` `TERRAIN_KINDS = ['plain','hills','forest','river','mountain'] as const` | 5 型 |
| C 磁盘实存 | `public/art/terrain/` = forest/hills/mountain/plain/river 5 个 `.webp` | 5 型 |
| 消费方 | `BootScene.ts:51-53` 直接 `for (const asset of TERRAIN_ART) this.load.image(asset.key, asset.path)` | 由 A 派生，无第二字面源 |

改前：`terrainPaths.test.ts` 只有 A×C（1 例长度钉桩 ＋ `test.each(TERRAIN_ART)` 5 例 path 后缀/实存）⇒ **B 侧完全无守护**：往 `TERRAIN_KINDS` 加/删一个地形型，全量测试一字不红，`Terrain` 类型与贴图静默脱钩（新增型直接吃 `mapColors` 调试色回退）。这正是 c921-06 §四.4 预留、当时明写「留待下批，本报告不动码」的口子。

## 二、本次新增（4 个 test 块 / 展开 8 例）

| # | 断言 | 打的漂移面 |
|---|---|---|
| 1 | **A×B 集合相等**：`TERRAIN_ART` 键去 `terrain_` 前缀后排序 `toStrictEqual` `TERRAIN_KINDS` 排序 | 任一侧增删型、改名 |
| 2 | **逐项拼接命中**（`test.each([...TERRAIN_KINDS])` 5 例）：`terrain_${kind}` 在清单中**唯一**命中（`toHaveLength(1)`）且 `path === 'art/terrain/'+kind+'.webp'` | 键↔path 不再同源派生、重复键、漏键 |
| 3 | **集合大小**：`new Set(keys).size === keys.length`、`new Set(TERRAIN_KINDS).size === length`、两侧长度互等 | deepEqual 之外的独立哨兵——重复项与漏项分得开 |
| 4 | **三方互等**：磁盘 `.webp` 文件名干 === `TERRAIN_KINDS` === 清单键去前缀 | C 侧多图/少图（旧 png 残留、忘转码） |

派生助手集中放文件末尾、既有两例**一字未动**（不重排、不改格式）：`TERRAIN_KEY_PREFIX` / `kindOfArtKey` / `kindOfDiskFile` / `sorted` / `TERRAIN_DIR`。

## 三、读数（命令在前，数字在后）

```
$ npx vitest run src/renderer/data/__tests__/terrainPaths.test.ts
 ✓ src/renderer/data/__tests__/terrainPaths.test.ts  (14 tests) 8ms
      Tests  14 passed (14)                                  exit=0
```

**原 6 例（＝2 个 test 块，`test.each` 展开成 5）＋ 新增 8 例 = 14 例全绿。**
全量：`npx vitest run` → **124 文件 / 1310 例全绿**，Duration 22.06s（03:05:02 起跑），exit 0。
类型：`npx tsc -p tsconfig.renderer.json --noEmit`（＝ `npm run type-check`）→ **exit 0**。

> 口径提醒：c921-06 与本单任务书所说的「两例/原 2 例」是 **test 块**数，展开后是 6 例；引基线一律用展开后的例数（见 `colony-test-baseline-20260921.md` 第一节「声明数 ≠ 用例数」）。

## 四、非空洞性：swamp 变异实测

```
$ PYTHONIOENCODING=utf-8 python tmp/c922-101/mutate_swamp.py
[MUTATE] TERRAIN_KINDS += 'swamp' 已落盘
[VITEST] exit=1
      Tests  4 failed | 11 passed (15)
 FAIL … > A×B 集合相等：TERRAIN_ART 键去前缀排序后 === TERRAIN_KINDS 排序后（deepEqual，非仅长度）
 FAIL … > A×B 逐项拼接命中：terrain_swamp 在清单中唯一存在且 path 由该型名派生        → expected [] to have a length of 1 but got +0
 FAIL … > A×B 集合大小：两侧各自无重复，且长度互等                                    → expected 5 to be 6
 FAIL … > 三方互等：A×B×C 同一集合                                                    → expected […(2)] to strictly equal […(3)]
[RESTORE] 字节级还原完成且全等，1481 bytes
```

- **新增 4 个块全红**（15 例＝原 6＋新增 8＋`test.each` 多出 1 例），既有 A×C 两例保持绿——分工正确，没有互相顶包。
- 还原按纪律四步走，**未用 `git checkout --`**（本仓 `core.autocrlf=true`，checkout 会把 LF 整份翻 CRLF 留下恒 ` M` 的 stat 缓存）：变异前 `read_bytes()` 存原始 → `finally: write_bytes(原始)` ＋断言读回全等 → `git add src/renderer/data/mapSchema.ts` 刷 index → `git diff --cached --quiet HEAD` **rc=0** 自证 blob 未变，`git status --short` 该文件已不出现。日志留 `tmp/c922-101/mutation-swamp.log`。

## 五、锚点复核（任务书 → 磁盘）

| 任务书锚点 | 磁盘实测 | 结论 |
|---|---|---|
| `mapSchema.ts:9` | :9 原文一致 | 未漂 |
| `artManifest.ts:88` | :88 `export const TERRAIN_ART: ArtAssetDef[] = [` | 未漂 |
| `colony-terrain-naming-inventory-20260921.md:34` §四.4 | :34 原文一致（"留待下批，本报告不动码"） | 未漂 |
| `terrainPaths.test.ts:8` `test('TERRAIN_ART 共 5 型'…` | **实为 :9** | 漂移 1 行，按实况修 |
| 「原 2 例」 | 2 个 test 块 / **6 个执行例** | 口径含糊，本档钉明 |

## 六、剩余面（本单不做）

- `TERRAIN_ART` ↔ `BootScene` 的加载接线由清单派生，已由 `bootLoadList.test.ts` 一族与 `terrainPaths` 覆盖，本单不重复钉。
- **真残余不在地形**：`BootScene.ts:58-60` 的 scatter 与 `:77-82` 的 audio 仍是「manifest 之外的第二事实源」（c921-06 §四、c922-19 旁证同口径）；`OPTIMIZATION_BACKLOG.md` P1-4 那句「terrain 仍硬编码」**已被前浪否证**，别据此排单。
- 反向哨兵（往 `TERRAIN_ART` 加幽灵键）本次未做变异实测，但块 1/2/3/4 的构成对其同样敏感（`test.each` 由 B 驱动、A 侧多键会撞块 1 与块 3 的长度/Set 断言）。
