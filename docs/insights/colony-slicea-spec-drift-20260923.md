# colony docs/history 全目录巡检：SLICE_A_SPEC 与现状偏差清单（c923-25，只读）

- 任务：`c923-25`　班：`qoder-executor-20260923-0022-colony10`　日期：2026-09-23
- 性质：**只读巡检**。本档是 `docs/insights/` 下唯一新增件，`docs/history/` **一字未动**，仓库受版件零改动。
- 取证时盘态：HEAD `c4c4a98`，`git status --porcelain` 3 项（全属他班在册件）。

## 一、巡检范围（现状）

`docs/history/` 全目录**仅 1 件**：

```
$ python -c "import os;[print(os.path.join(r,n), os.path.getsize(os.path.join(r,n))) for r,d,f in os.walk('docs/history') for n in sorted(f)]"
docs/history\SLICE_A_SPEC.md 19308
```

⇒ 卷宗「现仅 SLICE_A_SPEC.md 一件」前提**成立**。

## 二、重复头扫描（卷宗前提 ② 已复跑并加强）

```
$ python -c "import io;ls=io.open('docs/history/SLICE_A_SPEC.md',encoding='utf-8').read().splitlines();t='Implement Slice A (core state + time loop) for a TypeScript + Phaser 3 + Electron 28 offline game.';print('lines',len(ls));print('hits',[i+1 for i,l in enumerate(ls) if l.strip()==t]);print('block[1..36]==block[37..72]',ls[0:36]==ls[36:72])"
lines 342
hits [1, 37]
block[1..36]==block[37..72] True
```

**加强结论（超出卷宗口径）**：不止「:1 与 :37 同文头」——是**整个 36 行前言块（:1–36）与（:37–72）逐行、逐字节全等**，含 `EXISTING CODE` / `resourceRegistry.ts exports` / `schema.ts exports` / `modifierValidator.ts exports` / `src/main/index.ts (existing)` / `src/preload/index.ts (existing)` 六个小节被完整贴了两遍。全文件 342 行里这 36 行是纯冗余。

成因推测：prompt 拼接时把「系统前言」加了两次。**它会让任何按行号引用 spec 的下游文档漂 36 行**——本档因此对所有引用**同时给出 :N 与 :N+36 双锚**。

## 三、偏差矩阵（13 行；每行给 spec 双锚 + 现状 file:line + 可复算命令）

> 引用规约：`spec :N` 指第一份前言块；第二份在 `:N+36`。凡「方向」列：`spec 过时` = 代码已演进、文档没跟；`spec 仍对` = 复核后一致；`文档缺陷` = 与代码无关的排版问题。

| # | 主题 | spec 声称（双锚） | 现状 file:line（实证） | 方向 | 建议订正 |
|---|---|---|---|---|---|
| 1 | 重复前言块 | `:1–36` ≡ `:37–72` 整块同文 | `docs/history/SLICE_A_SPEC.md`（见第二节扫描） | 文档缺陷 | 删 `:37–73`（含其后空行），保留单份 |
| 2 | RESOURCE_IDS | `:7`/`:43`「= [grain,wood,stone,gold,people,cloth,bronze,rite]」**8 键** | `src/renderer/data/resourceRegistry.ts:11-30` **11 键**：`+hemp` `+tin` `+influence` | spec 过时 | 改 11 键，并注明 `TOP_BAR_RESOURCE_IDS:35` 只展示 8 键（另生口径） |
| 3 | MODIFIER_TARGETS | `:12`/`:48` 列 **24 键** | `src/renderer/data/resourceRegistry.ts:58-98` **27 键**；code-only=`country_wrath` `country_renown` `building_output_area`；spec-only=**0** | spec 过时 | 补 3 键；「includes」措辞可保留 |
| 4 | BuildingTier | `:22`/`:58`「type BuildingTier = 1 \| 2 \| 3」 | `src/renderer/data/schema.ts:61`「export type BuildingTier = 1 \| 2 \| 3 \| 4;」；真数据 `src/renderer/data/buildings.ts:587,659,713` 有 `tier: 4`；守门 `src/renderer/state/__tests__/saveGuard2.test.ts:129` | spec 过时 | 改 `1 \| 2 \| 3 \| 4`（**卷宗引的测试锚点已复验，原文一字不差**） |
| 5 | preload API 面 | `:36`/`:72`「Exposes colonyApi.getVersion()/saveGame(data)/loadGame()」**3 面** | `src/preload/index.ts:4,5,7,9,11,16` **6 面**：`getVersion` `saveGame` `loadGame` `listSaves` `getSaveMeta` `onWindowResized` | spec 过时（**卷宗前提「现状 4 面」亦被否证**） | 按 6 面重列；`onWindowResized` 是**订阅式推送**，与其余 invoke 语义不同，宜单列 |
| 6 | ipcMain handler | `:232-247`/`:268-283` 教 **3 个** handler，且用**同步** fs（`mkdirSync`/`writeFileSync`/`readFileSync`/`existsSync`） | `src/main/index.ts:154,171,178,185` **4 个 async handler**：`save-game` `load-game` `list-saves` `save-meta`；`src/main/index.ts:4` 已改 `import { readFile, writeFile, readdir, mkdir, stat, rename, copyFile } from 'fs/promises'` | spec 过时 | 补 `save-meta`；同步 fs 改述为 fs/promises，并说明 `rename`/`copyFile` 服务的写 tmp→rename 原子落盘 |
| 7 | userData 路径 | `:33`/`:69`「Sets userData to D:/colony-game/user-data」（无条件硬编码） | `src/main/index.ts:6` 常量 + `:16-31` `ensureDDrivePaths()` **try/catch 兜底链**（无 D 盘 → 退回 `%APPDATA%/<productName>` 并 `console.warn`）+ `:33` 顶层调用；`setPath` 实际覆盖 `userData/temp/logs/crashDumps/cache/sessionData` **6 项** | spec 过时 | 补兜底语义与 6 个 setPath 项；spec 只提 userData 一项 |
| 8 | SaveData.version 是字符串 | `:25`/`:61`「interface SaveData { **version: string**; … }」 | `src/renderer/data/schema.ts:422-423` 仍为 `version: string; // '0.7.0'` —— 但 `git grep -n --no-index "SaveData" -- src scripts` **仅命中声明 :422 与注释 :11，消费者 = 0** ⇒ `SaveData` 已是**死型**；真正在用的落盘形状是 `src/renderer/state/saveLoad.ts:31` `interface SerializedSave { schemaVersion: number; … }` | spec 字面仍对**但所指类型已死**（**卷宗「version 字符串 vs 现 schemaVersion 数字」的真实成因是两型并存，非同一型改名**） | 本行不宜「订正」成把 SaveData 改成数字：删死型属**行为/存档面改动**，见第五节停手项 |
| 9 | 存档版本号 | `:188`「Export const SAVE_SCHEMA_VERSION = 1」 | `src/renderer/state/saveLoad.ts:19`「export const SAVE_SCHEMA_VERSION = 9;」 | spec 过时 | 注记「spec 记录的是 Slice A 初值 1，现值 9」，**不要**把 spec 改成 9（spec 是历史规格档，改成现值会失去它作为 v1 时代证据的含义） |
| 10 | SerializedSave.state 字段数 | `:194`/`:229` 列 **13 项** | `src/renderer/state/saveLoad.ts:34-120` 顶层 **50 项**；spec-only=`defeatCount` `permanentBuffs`；code-only **38 项** | spec 过时 | 同 #8：按「历史快照」标注即可，不必逐字段追平 |
| 11 | spec 内部自相矛盾 | `:25`/`:61` 的 `SaveData.world` 含 `defeatCount`+`permanentBuffs` | 同文件的 `:88` GameState 与现码 `saveLoad.ts:34-120` 均**无此二键** ⇒ spec 自身三处字段清单互不一致（`defeatCount`/`permanentBuffs` 在 :25/:61/:88 出现，现码 0 命中） | spec 内部缺陷 | 这二键是 spec 唯一「写了但从未落地」的字段，宜加脚注说明 |
| 12 | HARD CONSTRAINT 2 | `:330`「No block comments. Only // inline comments, max one line.」 | `src/` 258 个 `.ts` 中 **178 个**含 `/**` 块注释（含 `resourceRegistry.ts:1-7`、`schema.ts`、`main/index.ts:10-15` 本身） | spec 从未生效 | 保留约束但标注「实际执行中废弃，JSDoc 为仓内主流」；**不建议改码去注释** |
| 13 | vitest include | `:321`「include: [src/**/**tests**/\*\*.test.ts]」1 项 | `vitest.config.ts:5` **2 项**：增 `'scripts/__tests__/**/*.test.ts'` ⇒ `scripts/` 侧测试件已在门内 | spec 过时 | 补第 2 项。位置声明 `:319`「Place at D:/code/colony-game/vitest.config.ts」**仍成立** |

**spec 仍对、不必订正**的复核项（反向证据，防「全表皆错」的偏向）：

- `:1`/`:37`「TypeScript + **Phaser 3** + **Electron 28** offline game」→ `package.json` `electron: 28.2.5`，与「Electron 28」一致。
- `:89` GameState 的 5 个运行时字段 `paused/speed/lastTickTimestamp/currentDay/rngSeed` → `src/renderer/state/gameStore.ts` **全部仍在**（`git grep -n "export const STATE_EVENTS" src/renderer/state/gameStore.ts` → `:114`，spec `:80` 声明的 STATE_EVENTS 常量亦在位）。

### 偏差矩阵复算命令（**每条已实跑**，期望读数附在下一行）

```
$ python -c "import io;ls=io.open('docs/history/SLICE_A_SPEC.md',encoding='utf-8').read().splitlines();t='Implement Slice A (core state + time loop) for a TypeScript + Phaser 3 + Electron 28 offline game.';print('lines',len(ls));print('hits',[i+1 for i,l in enumerate(ls) if l.strip()==t]);print('block[1..36]==block[37..72]',ls[0:36]==ls[36:72])"
lines 342 / hits [1, 37] / True            → 矩阵行 1、2（重复块）

$ python -c "import os;[print(os.path.join(r,n), os.path.getsize(os.path.join(r,n))) for r,d,f in os.walk('docs/history') for n in sorted(f)]"
docs/history\SLICE_A_SPEC.md 19308         → 全目录仅此 1 件

$ python -c "import io,re;s=io.open('src/renderer/data/resourceRegistry.ts',encoding='utf-8').read();print(len(re.findall(r\"'([a-z_]+)'\",re.search(r'export const RESOURCE_IDS = \[(.*?)\] as const',s,re.S).group(1))))"
11                                         → 矩阵行 2

$ python -c "import io,re;s=io.open('src/renderer/data/resourceRegistry.ts',encoding='utf-8').read();print(len(re.findall(r\"'([a-z_]+)'\",re.search(r'export const MODIFIER_TARGETS = \[(.*?)\] as const',s,re.S).group(1))))"
27                                         → 矩阵行 3

$ git grep -n "BuildingTier = " -- src/renderer/data/schema.ts
src/renderer/data/schema.ts:61:export type BuildingTier = 1 | 2 | 3 | 4;   → 矩阵行 4

$ git grep -n "ipcMain.handle(" -- src/main
（4 行：src/main/index.ts:154,171,178,185） → 矩阵行 6

$ python -c "import io,re;L=io.open('src/preload/index.ts',encoding='utf-8').read().split(chr(10));print([(i+1,l.split(':')[0].strip()) for i,l in enumerate(L) if re.match(r'^  [a-zA-Z]+: ',l)])"
6 个成员：:4 getVersion :5 saveGame :7 loadGame :9 listSaves :11 getSaveMeta :16 onWindowResized  → 矩阵行 5

$ python -c "import io,re;L=io.open('src/renderer/state/saveLoad.ts',encoding='utf-8').read().split(chr(10));i=[k for k,l in enumerate(L) if l=='  state: {'][0];j=next(k for k in range(i,len(L)) if L[k].startswith('  };'));print('lines',i+1,'to',j,'top-level fields',len([l for l in L[i+1:j] if re.match(r'    ([a-zA-Z_]+)\??:',l)]))"
lines 34 to 120 top-level fields 50        → 矩阵行 9、10

$ python -c "import io,glob;fs=glob.glob('src/**/*.ts',recursive=True);print(sum(1 for p in fs if '/**' in io.open(p,encoding='utf-8').read()),'of',len(fs),'src ts files use block comments')"
178 of 258 src ts files use block comments → 矩阵行 12

$ git grep -n --no-index "SaveData" -- src scripts
src/renderer/data/schema.ts:11:（注释）
src/renderer/data/schema.ts:422:export interface SaveData {      → 矩阵行 8：消费者 = 0

$ git diff --name-only -- docs/history | wc -l
0                                          → 本单对 docs/history 零改动
```

⚠️ 本机 shell / 正则注意（否则上面的命令会给出假读数）：

1. **`git grep` 默认查不到未跟踪件 ⇒ 判「零消费者」必须带 `--no-index`**（上面 SaveData 那条即如此）；但要留意 `--no-index` 会连**他班在途脏件**一起命中，引用范围要先收窄到 `-- src scripts`。
2. **`rg`/`grep` 判「零命中」一定要显式给路径参数**（不给路径 + stdin 是管道时会去读已耗尽的 stdin，rc=1 零输出，看着像全仓零命中）。
3. **控制台是 cp936**：直接 `print` 仓内中文注释会输出乱码（文件本身是纯 UTF-8）。跑取证命令前先 `export PYTHONIOENCODING=utf-8`，否则引文不可复算。
4. 🔴 **数 TS 可选字段要写 `\??:`，不能写 `\?:`**——本档首版在此踩过一次：`\?:` 是「字面 `?` 紧跟 `:`」的**强制**两段式，只命中 `name?:` 形式的可选字段，把 `resources:` 这类必填键全漏掉（实测 50 → 39，差 11 项恰为全部必填键）。**凡是「按正则数个数」的证据，落档前必须真跑一遍对读数**，别只写不跑。
5. **多行 `python -c` 不能靠换行续行**（首版把 `while` 循环写成三个 `$ ` 行，粘进 shell 会当成三条命令）⇒ 取证命令一律收窄成单行，用 `next(k for k in range(...) ...)` 取代 `while`。

## 四、结论：`docs/history/` 需不需要订正

**建议：只订正 #1（重复块），其余 12 行一律「不订正」。** 理由分三类：

- **纯排版缺陷、零语义风险 → 可修**：仅 **#1**。删掉 :37–73 的重复块不改变任何规格含义。
- **「历史规格档」的本征属性 → 不应追平现码**：**#2 #3 #4 #5 #6 #7 #9 #10 #13**。SLICE_A_SPEC 是 Slice A 立项时的 prompt 原文，它的价值恰恰在于「记录了当时的 8 键 / 3 面 / version=1」。把 `:188` 的 `= 1` 改成 `= 9` 会让这份档**失去 v1 时代证据含义**，且它已归档进 `docs/history/`（目录名本身即「不再维护」的声明）。**正解是在文件顶部加一行「本文档为历史快照，现值见 docs/insights/」的指引，而不是逐字段追平。**
- **需要裁决、执行手不代改**：**#8 #11 #12**。
  - **#8 命中红线域「存档兼容」**：`SaveData`（`version: string`，死型）与 `SerializedSave`（`schemaVersion: number`，活型）**并存**，删除死型或改名都触及存档 schema 语义 ⇒ 只登记，不处置。
  - **#11** 是 spec 自身三处清单不一致，属**上游 prompt 质量问题**，无现码对应物，改哪一侧都是解释性裁决。
  - **#12** 若要「按 spec 落实」＝删全仓 178 个文件的块注释，纯破坏性，显然不该做；登记为「约束已废弃」即可。

⇒ 换句话说：**这份 spec 不需要被更新成现状，需要的是被正确地标注为历史快照 + 修掉重复块。**

## 五、遗留 / 停手项

1. **#8 `SaveData` 死型（红线：存档兼容）**——`version: string` 与 `schemaVersion: number` 两型并存，死型零消费者。是否删除、是否合并命名，**交人工裁决**，本单零改动。关联在册件 `docs/insights/colony-dead-exports-20260914.json`（该件现处 ` M` 他班在途态，禁碰）。
2. **#1 重复块的删除**未执行——本单完成标准 ③ 要求 `git diff --stat = 0` 且「docs/history 不动一字」，故只登记出口，不动手。
3. **#12 块注释约束**登记为「事实废弃」，不建议任何收敛动作。
4. 本档是 `docs/insights/` 新增件，**未改索引表**（多班同改会互相覆盖）。索引在册件为 `docs/insights/colony-insights-index-20260919.md`（现共 3 份 index 件），**待主班代登**。
