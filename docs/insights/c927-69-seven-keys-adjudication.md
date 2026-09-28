# c927-69 · §4.2 七个"有数据无读取"键的逐键裁决材料（只读，零改码）

- 班次：`qoder-executor-20260929-0345-colony60` · 模型 qoder · cwd `D:\code\colony-game`
- 收工时间戳：`date` 现取 ＝ **2026-09-29T03:47:34+08:00**（claim 时刻；done 时刻见 result 与台账行）
- 卷宗：`zcode-bridge/done/c927-69.task.md`。要求＝"§4.2 七个有数据无读取键的逐键裁决材料：行数面＋读取面各现值，逐键给『接线消费／退役数据』两案＋推荐"，并明示**退役＝删数据面动作，一律不落地、只出材料**。
- 授权边界：禁改产品码；`scripts/audit-dead-exports.mjs` 的 `--write`／`--out` 两个写口**一条都没带**（脚本 `:110-141` 实测确有这两口）；本仓无根 `tests/`，测试件在 `src/**/__tests__/`。

## 〇、先报锚点实况：这七键的落点在本仓当前版上**已不存在**（本单据此落 partial）

开工到收工之间盘又前移（开工 HEAD `3497702` → 现 `947075d`），且**卷宗点名的四个生产者文件全部查无**：

| 卷宗点名 | 盘上 | git 里 | 实测命令 |
|---|---|---|---|
| `src/main/game-loop.ts`（4 键） | **不存在** | **从未被版** | `ls src/main` → 只有 `index.ts`；`git log --all --oneline -- src/main/game-loop.ts` → 空；`git ls-files \| grep -cE "^src/(sim\|main/game-loop)"` → **0** |
| `src/sim/black-market.ts` | **不存在** | 从未被版 | `ls src/sim` → No such file or directory；`ls src` → `main preload renderer shared`（**无 `src/sim`、无 `src/storage`**） |
| `src/sim/government.ts` | 同上 | 同上 | 同上 |
| `src/sim/housing.ts` | 同上 | 同上 | 同上 |

另两条同向证据：

1. **账内已换代**：`docs/insights/colony-dead-exports-20260914.json`（HEAD 版与工作树版都是新 schema）顶层键＝`generatedAt/rule/summary/entries`，`summary`＝**`{"dead": 0, "testsOnly": 108, "internalOnly": 0}`**，`buckets` 只有 `{'tests-only'}` 一个值，条目形状＝`{file,line,name,bucket,hitsInTests}`（样例：`src\renderer\data\actTimeline.ts:29 ACT_TIMELINE tests-only hitsInTests=7`）⇒ **账上现在没有任何 dead 条目**，旧口径"12 条真死码＋`_label`/`_disposition` 字段"在现账里已不存在（我开工 03:2x 读到的正是那份旧 schema，现已被并发班次 `--write` 刷掉）。
2. **§4.2 整表消失**：`grep -n "^#\{2,4\} " docs/design/OPTIMIZATION_BACKLOG.md` → 只有 `已落地/P0/P1/P2/P3/P4/每轮纪律`，**无 §4.x**；`grep -n "4\.2\|有数据无读取\|死码\|无读取"` → **0 命中**；HEAD 版（`git show HEAD:...` → `tmp/c927-69/backlog-head.md`）与最近 6 个提交（`947075d 8a9eaea a203fb2 ff2a9e7 285b004 c9a3ffa`）逐个 `grep -c "4\.2"` **全部＝0** ⇒ §4.2 不是"被我改窄"，是**表面在本仓已不存在**。

⇒ 按纪律「点名文件在本仓查无 ⇒ 落 partial 走改投」「命中锚点已被前人闭合就按实况收窄并留证据，**不判 failed、不跨仓动手**」：本单**不**去别的工作区找这些文件，也**不**动任何码。下面给的是**当前版上逐键可核读数**＋两案的可行性判定＋改投建议。

## 一、逐键现值（七键 × 行数面／读取面，全部本班命令实测）

读数口径：**数据面**＝该键作为 state/字段被声明与被写入的行；**读取面**＝除声明与写入之外真正消费它的行（getter／渲染／存档）。测试里的**反向断言**（"这个键不该出现"）不计为读取。

| # | 键（卷宗位置） | 数据面现值（当前版） | 读取面现值 | 跨存档？ | 两案可行性 | 推荐 |
|---|---|---|---|---|---|---|
| 1 | `commandLog`（旧 `main/game-loop.ts:26`） | **0 行**：盘上无该字段。全仓命中 **1 处**＝`src/renderer/state/__tests__/replaySnapshotContent.test.ts:216` 的 `inputLogKeys` **否证清单**（`:217 expect(keys.filter(...)).toEqual([])`） | **0 行** | **否**（`replaySnapshotContent.test.ts:214` 注释：「仓内不存在"操作序列回放"制品 ⇒ 信封里也不可能有」） | 接线＝要从零造数据面（新写日志环＋入存档＝红线）；退役＝**无物可退** | **两案都不落地**。留 `replaySnapshotContent.test.ts:216` 那道否证作门禁即可；真要指令日志请**另开功能单**（涉存档兼容，属红线） |
| 2 | `speed`（旧 `main/game-loop.ts:17`） | 现役已有完整闭环：`src/renderer/state/gameStore.ts:213` 类型 `speed: 0\|1\|2\|3`、`:330` 初值 `speed: 1`、`:721-722` 写入（带同值短路） | **有**：`:462 getSpeed(): 0\|1\|2\|3 { return this.state.speed; }` ⇒ **读取面非零，键已接线** | 是（state 字段，随存档载荷走） | 接线＝**已完成**；退役＝删现役字段 ⇒ 红线，不动 | **判定：锚点已被闭合**。本键不需要裁决，请从待裁清单划掉 |
| 3 | `progress`（旧 `main/game-loop.ts:24`） | **0 行**（无该 state 键）。现役相近键是 `constructionProgress`：`gameStore.ts:1050 b.constructionProgress += (100 / time) * constructionSpeedMul` | `constructionProgress` 有读写（非本键） | 相近键入存档；本键无 | 接线＝无落点；退役＝无物可退 | **无对象**。若主班想裁的是"建造进度"，那是**另一枚卷宗**（口径不同） |
| 4 | `time`（旧 `main/game-loop.ts:25`） | **0 行**（无该 state 键）。`gameStore.ts` 里 `time` 只作**局部量**出现：`:1024 const time = isUpgrade ? … : targetDef.constructionTime`、`:1043 if (time <= 0)` | 局部量随即被读（`:1050`）⇒ 不构成"有数据无读取" | 否 | 同上 | **无对象**。局部量不需要接线也不需要退役 |
| 5 | `progress`（旧 `sim/black-market.ts:11`） | **文件查无**（`src/sim` 目录不存在，git 从未有） | 0 行 | 无法判（无载体） | 两案均无落点 | **改投**：黑市相关现役实现请先由主班点名文件（仓内无 `src/sim/*`，`git ls-files` 无 `black-market`） |
| 6 | `info`（旧 `sim/government.ts:69`） | **文件查无** | 0 行 | 无法判 | 两案均无落点 | 同上改投 |
| 7 | `remaining`（旧 `sim/housing.ts:12`） | **文件查无**。全仓 `remaining` 命中都是**局部量/局部数组**：`gameStore.ts:2003 const remaining: DefenseAlert[]`（`:2006` push、`:2009` 赋回 `defenseAlerts`）、`:2546 let remaining = Math.floor(n)`（`:2550/:2553` 读写）、`:2660 const { completed, remaining } = tickConversionQueue(...)`（`:2661` 用） | 每个局部量都在同函数内被消费 ⇒ **不属"有数据无读取"族** | 否 | 两案均无落点 | **无对象**（ housing 文件查无；`remaining` 作字段不存在） |

**汇总读数**：七键里 **1 键（speed）已由现役 `gameStore.ts` 接线闭合**、**6 键在当前版上无数据面无读取面**（4 键＝同名只作局部量或相近异名，2 组＝生产者文件整档查无）。本仓当前 `src/` 规模＝**287 个被版 `.ts`**（`git ls-files src \| wc -l`），主渲染态集中在 `src/renderer/state/gameStore.ts`（**2,918 行**，`wc -l` 现取）。

## 二、两案的通用判定（本单只给材料，一律不落地）

- **案 A 接线消费**：给键补读取面（UI 展示／存档导出）。风险面＝**存档兼容**（新键进 payload ⇒ 需 `schemaVersion` 迁移口径）＋经济／节奏数值上屏（属红线，只报读数不判定）。七键里**只有 `speed` 属这一案，且已经做完了**。
- **案 B 退役数据**：删数据面（字段＋写入点＋相关测试）。卷宗与本纪律都明示 **退役＝删数据面动作，一律不落地、只出材料**；且当前版上这 6 键**已无物可退**（删无可删）。
- ⇒ 本单的推荐是第三案：**案 C＝撤单／重发**。理由是锚点失效（点名文件查无＋账内 dead 桶归零＋backlog §4.2 表消失），不是材料质量。

## 三、改投建议（给主班的三条可选路径）

1. **重发卷宗、锚点换成现役载体**：审计口径若仍想要"有数据无读取"，应基于新账的 **`tests-only` 桶 108 条**（`summary.testsOnly=108`）出题——这一桶才是本仓当前真实形态："导出符号只在测试里被引用"。样例条目已实测：`src\renderer\data\actTimeline.ts:29 ACT_TIMELINE hitsInTests=7`。
2. **若要裁 `speed` 族**：改投 `src/renderer/state/gameStore.ts`（2,918 行）里的 state 字段接线审计——那才是今天的主渲染态单点；同批要复核 `replaySnapshotContent.test.ts:216` 的否证清单（`inputLog/actionLog/commandLog/intentLog/eventLog/replayFrames/userInputs/inputs` 八名）是否仍与产品意图一致。
3. **若旧口径的 `src/sim/*` 版另有归档仓**：请主班点名该仓后重发；本班按纪律**不跨仓动手**。

## 四、红线与自检

- 未改一行产品码、未改账、未改 backlog；审计脚本两个写口一条未带；未跑全量 vitest／build／type-check。
- 存档兼容／经济平衡／统计结论／放宽判据：全部**只出材料**，未动任何数值或字段。
- §C 在途件（含 §D 第 2 条那枚会把 pre-commit 全量门禁跑红的计时敏感测试件）**一字未碰**；`git status --porcelain` 收工前仍＝开工时的 `1 D / 3 M / 12 ??` 组（本单新增 `docs/insights/c927-69-seven-keys-adjudication.md` 与本 result，外加 `tmp/c927-69/backlog-head.md` 于 gitignored `tmp/`）。

## 五、关联自查（我名下已入库的三枚材料是否需要订正）

收工前对本班早前入库的三枚材料档做了路径复查——**结论：无需订正**，因为它们都不引用本次查无的那批路径：

```
grep -c "src/sim/ \| src/main/game-loop \| src/renderer/types/state \| src/storage/"
  docs/insights/c927-62-fonts5.md        → 0
  docs/insights/c927-66-g1g4.md          → 0
  docs/insights/c927-67-viewportcenter.md → 0
```

- 需要点名的一处**是我自己在本档前一轮起草时写错的**：§五 初稿写成"`docs/insights/c927-62-universal-setter.md` 的五处路径引用需重取"——**该文件名与那五处引用都不存在**，62 号材料档实名 `c927-62-fonts5.md`（字体 url 单）。已就地改为本段实测结论（Edit 修订，档内不留错误结论）。
- 保留一条**给主班的真实提醒**：本班 03:2x 读到的旧 schema 账（`_label`/`_disposition`/12 条 dead）与 §4.2 表在现盘/现版都已不可引用，凡**早前任何材料里若引用过那批旧行号，入库前请按 947075d 重取**；本班名下三枚经上述 grep 实测不含该批路径，故无返工项。
