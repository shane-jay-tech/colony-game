# colony 退役模块备份件完整性对账（tmp 备份 vs git 退役前版本逐字节核）（c922-115，2026-09-22T05:14，只读核查级）

> 判据不另造：沿用 c922-114（`colony-unreachable-recheck-20260922.md`）立的「raw md5 双路 + LF 归一 md5」同一口径。
> 本单一字未改生产码、未删任何 tmp 件（来源不明残留不删）。

## 一、结论（三句）

1. **6 件备份逐字节核完**：raw md5 相等 **2/6**，LF 归一后相等 **6/6** ⇒ 复现并确认 c922-114 的否证——**盘上副本不含任何 git 里没有的内容**，4 件 raw 差异纯由 `core.autocrlf=true` 的行尾造成。
2. **「备份在盘＝回滚保险」这条在册语义不成立，且方向是反的**：git 侧权威副本**已推远端**（两笔退役提交都是 `origin/codex/architecture-hardening` 的祖先，`--is-ancestor` rc=0），而 tmp 侧被 `.gitignore` 覆盖、只活在当前这一块盘上。⇒ **tmp 是这条链最脆弱的一层，不是保障层**；「tmp 清理前必须留档」这个立项前提**证据不足**，实况是「清 tmp 不损失任何恢复能力」。
3. **顺带纠正 c922-114 的一处归因**：它把 `colony-untracked-residue-20260917.md:6` 的「check-ignore 无输出 exit=1」疑为「`--stdin` × `text=True` 致判定静默失效」。**不需要这个假设**——`git log -- .gitignore` 实测 `tmp/` 规则是 **2026-09-19 的 `18e4364` 才进仓**（备份写于 9/12、9/13），当班读到 exit=1 是**当时的真值**，只是过期了。同一份文档另有三处读数指向**根仓 `D:/code/.gitignore`**（见 §五），属跨仓取数而非工具失真。

## 二、锚点复核（任务书两条，逐字对磁盘）

| 任务书锚点 | 磁盘实况 | 判定 |
|---|---|---|
| `colony-retired-render-20260917.md:9` terrainTextures 行 `-173/-164 行` | 实测 `terrainTextures.ts` 173 行、`.test.ts` 164 行 | **未漂，数字正确** |
| `colony-retired-render-20260917.md:11` resourceSystem 行 `-168 行测试` | 实测 `.test.ts` 168 行、`resourceSystem.ts` **79 行** | **未漂但漏记实现 79 行**（c922-114 已点名，本单独立复测再次确认；同档 `:9/:10` 两格都是「实现/测试」双数） |

新增第三条锚点（本单取证需要）：`colony-retired-render-20260917.md:10` storyNpcs `-88/-49 行` → 实测 88/49，**正确**。

## 三、任务书「4+1 件」口径修正

任务书写「4+1 件备份（storyNpcs/terrainTextures 四件＋resourceSystem）」。**磁盘实况是 4+2＝6 个文件、3 个模块**：
`tmp/backup-colony-20260912/` 下只有一个 `state/` 子目录，里面有 `resourceSystem.ts` **和** `resourceSystem.test.ts` 两件。本单按 6 件全对账（不降规格）。

```
$ ls tmp/backup-colony-20260913-1532/ tmp/backup-colony-20260912/state | wc -l   → 9   ← 字面判据不可满足（多目录同行输出带目录头与空行）
$ ls tmp/backup-colony-20260913-1532/ | wc -l                                    → 4
$ ls tmp/backup-colony-20260912/state | wc -l                                    → 2
$ find tmp -type f | wc -l                                                       → 130（整个 tmp/ 现值）
$ find tmp/ -iname 'storyNpcs*' -o -iname 'terrainTextures*' -o -iname 'resourceSystem*' | wc -l → 6（备份族全集，别处无副本）
```

`git ls-files | grep -iE 'storyNpcs|terrainTextures|resourceSystem'` 只吐两份 **docs/**（`colony-storynpcs-terrain-reachability-20260913.md`、`colony-unreachable-resourceSystem-20260912.md`），源码六件在 HEAD 树内**均已不存在** ⇒ 与退役报告一致。

## 四、逐件对账（完成标准：每件一组命令＋数字，同段对照）

git 侧取「退役提交的父提交」＝**该路径的末次提交版本**（末次归属见 §六，已逐路径实证 `7d3aee3`/`aad0592` 就是各路径最后一次被触碰）。

```
### 1 storyNpcs.ts
$ git show 7d3aee3^:src/renderer/data/storyNpcs.ts | md5sum
9bfd3e44824b568999b1224b6732d2c7  *-
$ md5sum tmp/backup-colony-20260913-1532/storyNpcs.ts
c03516a4e813afa760f00d0eacb19c55  *tmp/backup-colony-20260913-1532/storyNpcs.ts        → raw 不等

### 2 storyNpcs.test.ts
$ git show 7d3aee3^:src/renderer/data/__tests__/storyNpcs.test.ts | md5sum
5881d29054f66353f9bb22db02a82ca8  *-
$ md5sum tmp/backup-colony-20260913-1532/storyNpcs.test.ts
91b6978d35eef92576ef3e2f9aa59205  *tmp/backup-colony-20260913-1532/storyNpcs.test.ts   → raw 不等

### 3 terrainTextures.ts
$ git show 7d3aee3^:src/renderer/render/terrainTextures.ts | md5sum
e65022261d1bec4f9484d7b06043dbb8  *-
$ md5sum tmp/backup-colony-20260913-1532/terrainTextures.ts
e65022261d1bec4f9484d7b06043dbb8  *tmp/backup-colony-20260913-1532/terrainTextures.ts  → raw 相等 ✓

### 4 terrainTextures.test.ts
$ git show 7d3aee3^:src/renderer/render/__tests__/terrainTextures.test.ts | md5sum
70452716c92b5183b58e8dd92082bb88  *-
$ md5sum tmp/backup-colony-20260913-1532/terrainTextures.test.ts
70452716c92b5183b58e8dd92082bb88  *tmp/backup-colony-20260913-1532/terrainTextures.test.ts → raw 相等 ✓

### 5 resourceSystem.ts
$ git show aad0592^:src/renderer/state/resourceSystem.ts | md5sum
d8877bb08a024bdc7abdf1dff400c20c  *-
$ md5sum tmp/backup-colony-20260912/state/resourceSystem.ts
00031b532cf3d692ce9225d035bc6f22  *tmp/backup-colony-20260912/state/resourceSystem.ts  → raw 不等

### 6 resourceSystem.test.ts
$ git show aad0592^:src/renderer/state/__tests__/resourceSystem.test.ts | md5sum
a4ab0681c11c88a3e1d3d86f349e5710  *-
$ md5sum tmp/backup-colony-20260912/state/resourceSystem.test.ts
fce03c64384e0a03316a9e74b1d75be6  *tmp/backup-colony-20260912/state/resourceSystem.test.ts → raw 不等
```

**LF 归一口径（4 件 raw 不等件，两侧同法去 CR）**——四件全部转为相等，且等于 git 侧 raw 值（证明 git blob 本就是 LF）：

```
$ git show 7d3aee3^:src/renderer/data/storyNpcs.ts | tr -d '\r' | md5sum         → 9bfd3e44824b568999b1224b6732d2c7
$ tr -d '\r' < tmp/backup-colony-20260913-1532/storyNpcs.ts | md5sum             → 9bfd3e44824b568999b1224b6732d2c7  ✓全等
$ git show 7d3aee3^:src/renderer/data/__tests__/storyNpcs.test.ts | tr -d '\r' | md5sum   → 5881d29054f66353f9bb22db02a82ca8
$ tr -d '\r' < tmp/backup-colony-20260913-1532/storyNpcs.test.ts | md5sum                 → 5881d29054f66353f9bb22db02a82ca8  ✓全等
$ git show aad0592^:src/renderer/state/resourceSystem.ts | tr -d '\r' | md5sum   → d8877bb08a024bdc7abdf1dff400c20c
$ tr -d '\r' < tmp/backup-colony-20260912/state/resourceSystem.ts | md5sum       → d8877bb08a024bdc7abdf1dff400c20c  ✓全等
$ git show aad0592^:src/renderer/state/__tests__/resourceSystem.test.ts | tr -d '\r' | md5sum → a4ab0681c11c88a3e1d3d86f349e5710
$ tr -d '\r' < tmp/backup-colony-20260912/state/resourceSystem.test.ts | md5sum              → a4ab0681c11c88a3e1d3d86f349e5710  ✓全等
```

汇总（字节级脚本 `tmp/c922-115/backup_md5_recon.py` 复核，与上面手跑逐位相同）：

| 件 | 末次提交 | git md5[:8] | tmp md5[:8] | raw | LF 归一 | 行尾 git / tmp | 字节 git / tmp | 行 git / tmp |
|---|---|---|---|---|---|---|---|---|
| storyNpcs.ts | `7d3aee3^` | `9bfd3e44` | `c03516a4` | 不等 | **等** | 纯 LF / 纯 CRLF | 3073 / 3161 | 88 / 88 |
| storyNpcs.test.ts | `7d3aee3^` | `5881d290` | `91b6978d` | 不等 | **等** | 纯 LF / 纯 CRLF | 1762 / 1811 | 49 / 49 |
| terrainTextures.ts | `7d3aee3^` | `e6502226` | `e6502226` | **等** | **等** | 纯 LF / 纯 LF | 7052 / 7052 | 173 / 173 |
| terrainTextures.test.ts | `7d3aee3^` | `70452716` | `70452716` | **等** | **等** | 纯 LF / 纯 LF | 6054 / 6054 | 164 / 164 |
| resourceSystem.ts | `aad0592^` | `d8877bb0` | `00031b53` | 不等 | **等** | 纯 LF / 纯 CRLF | 3356 / 3435 | 79 / 79 |
| resourceSystem.test.ts | `aad0592^` | `a4ab0681` | `fce03c64` | 不等 | **等** | 纯 LF / 纯 CRLF | 5856 / 6024 | 168 / 168 |

**计数：raw 一致 2 / 不一致 4；LF 归一一致 6 / 不一致 0。**

## 五、差异逐条归因（4 件不等件）

差异**只有一个来源＝行尾**，三条独立证据同向：

1. 归一后 md5 与 git raw md5 **逐位相同**（§四第二段）——最强证据，内容层面零差异。
2. **算术自证**：字节差恰等于行数（每行多一个 `0x0D`）。
   ```
   storyNpcs.ts          git=3073 tmp=3161 delta=88   gitlines=88   ✓
   storyNpcs.test.ts     git=1762 tmp=1811 delta=49   gitlines=49   ✓
   resourceSystem.ts     git=3356 tmp=3435 delta=79   gitlines=79   ✓
   resourceSystem.test.ts git=5856 tmp=6024 delta=168 gitlines=168  ✓
   ```
3. 四件 tmp 侧**纯 CRLF 无裸 LF**，等价的 terrainTextures 两件 tmp 侧**纯 LF**——同一批备份内部行尾就不一致，正是「从工作树直接 cp」的指纹（`core.autocrlf=true` 下 checkout 出 CRLF，但被别的工具链写回过的文件保持 LF）。⇒ 差异与备份时点无关，是复制手法造成的。

**「备份若来自更早时点」这条被否证（不是被解释）**：若备份早于末次提交，LF 归一后不可能与 `7d3aee3^`/`aad0592^` 的 blob 全等。四件全等 ⇒ **备份基准＝末次提交版本本身，无时点歧义**。
（旁证：storyNpcs/terrainTextures 备份 mtime 是 09-13 15:32，而 `7d3aee3` 落刀是 09-15 12:38——中间那两天这两组文件在 git 里没动过，见 §六逐路径末次归属。）

## 六、末次提交归属（逐路径实证，支撑 §五）

```
$ for p in <六个源路径>; do git log --format='%h %ad %s' --date=short -1 -- $p; done
src/renderer/data/storyNpcs.ts                     7d3aee3 2026-09-15  ← 删除即末次
src/renderer/data/__tests__/storyNpcs.test.ts      7d3aee3 2026-09-15
src/renderer/render/terrainTextures.ts             7d3aee3 2026-09-15
src/renderer/render/__tests__/terrainTextures.test.ts 7d3aee3 2026-09-15
src/renderer/state/resourceSystem.ts               aad0592 2026-09-13
src/renderer/state/__tests__/resourceSystem.test.ts aad0592 2026-09-13
```

六条路径的「最后一次提交」＝退役删除本身 ⇒ `^` 取到的就是**消失前的最后一版**，对账基准正确。

## 七、不一致件的 git 内替代恢复路径（完成标准点名项）

4 件 raw 不等件的恢复路径（其实 6 件都适用，且**只有这一条是权威路径**）：

```
git show 7d3aee3^:src/renderer/data/storyNpcs.ts                        > src/renderer/data/storyNpcs.ts
git show 7d3aee3^:src/renderer/data/__tests__/storyNpcs.test.ts         > src/renderer/data/__tests__/storyNpcs.test.ts
git show 7d3aee3^:src/renderer/render/terrainTextures.ts                > src/renderer/render/terrainTextures.ts
git show 7d3aee3^:src/renderer/render/__tests__/terrainTextures.test.ts > src/renderer/render/__tests__/terrainTextures.test.ts
git show aad0592^:src/renderer/state/resourceSystem.ts                  > src/renderer/state/resourceSystem.ts
git show aad0592^:src/renderer/state/__tests__/resourceSystem.test.ts   > src/renderer/state/__tests__/resourceSystem.test.ts
```

**不建议再用「从 tmp 拷回」**（`colony-unreachable-resourceSystem-20260912.md:39` 的荐法）：内容等价，但拷回件带 CRLF，而本仓 git 侧权威 blob 是 LF——多一次行尾归一动作、零收益。

远端可达性（本单新增，是 §一第 2 条的证据）：

```
$ git merge-base --is-ancestor 7d3aee3 origin/codex/architecture-hardening  → rc=0（是祖先）
$ git merge-base --is-ancestor aad0592 origin/codex/architecture-hardening  → rc=0（是祖先）
$ git rev-list --left-right --count origin/codex/architecture-hardening...HEAD → 0    43（behind 0 / ahead 43）
$ git reflog show origin/codex/architecture-hardening --date=iso -1
  e7cecd3 ...@{2026-09-20 11:05:03 +0800}: update by push
```

⇒ 退役前的两笔提交**已在远端**；HEAD 另有 43 条未推（属全域现状，非本单范围，登记给主班）。

## 八、文档读数与磁盘相反／指向他仓处（逐条点名，本单未回写）

| 位置 | 文档原述 | 现跑实况 | 判定 |
|---|---|---|---|
| `colony-retired-render-20260917.md:13` | 「**备份在盘**：tmp/backup-colony-20260913-1532/… tmp/backup-colony-20260912/…」 | 6 件内容 git 侧**全有**，且 git 侧已在远端、tmp 侧被 gitignore | **保障语义与实况相反**（最脆弱一层被写成保障）。建议头注：改指 `git show 7d3aee3^:<path>` / `aad0592^:<path>` |
| `colony-unreachable-resourceSystem-20260912.md:39` | 「恢复方式：从 tmp/backup-colony-20260912/state/ 拷回两文件即可」 | 拷回可行但带 CRLF；git 路径更短 | **荐法非最优**，指向 git 路径 |
| `colony-unreachable-resourceSystem-20260912.md:24` | 「备份 …resourceSystem.ts（79 行）＋ …test.ts（168 行）」 | 实测 79 / 168 | **正确**（反衬 `colony-retired-render:11` 漏记 79 行） |
| `colony-untracked-residue-20260917.md:6/:7` | check-ignore「无输出 exit=1（未被忽略）」 | 现跑 exit=0，吐 `.gitignore:25:tmp/` / `:26:_archive/` | **当班为真、现已过期**：`tmp/` 规则 2026-09-19 才由 `18e4364` 进仓（`git log -- .gitignore` 实测）。⇒ **更正 c922-114 的「--stdin × text=True 静默失效」猜测：本例不需要它** |
| `colony-untracked-residue-20260917.md:26/:27` | 复核记 `.gitignore:46:tmp/` / `:47:_archive/` | colony 侧真值 `:25` / `:26`；**根仓 `D:/code/.gitignore` 才是 `:46` / `:47`** | **跨仓取数**（同一命令 `cd /d/code` 跑 ⇒ 46/47，`cd /d/code/colony-game` 跑 ⇒ 25/26，两向都实测） |
| `colony-untracked-residue-20260917.md:13` | 「**_archive/ 当前磁盘不存在**」 | colony `_archive/` 在盘：`v0.5.bak.html` 70535B、`v0.6.bak.html` 55825B；根仓无 `_archive/`（`ls` rc=2） | **同上属跨仓取数**，与 :26/:27 同一根因（一处根因解释三处读数） |
| `colony-untracked-residue-20260917.md:12` | tmp「185 个文件、417MB」 | colony tmp 现值 **130 文件 / 100MB** | 时序变化（隔 5 天），**不归因跨仓**（根仓 tmp 是 205 文件 / 7.6M，两个数都对不上） |

## 九、给「tmp 清理前必须留档」的裁决材料（本单不代清理、不代留档）

- **留档必要性：低**。6 件内容 100% 已在 git（且已在远端），留档动作不会产生 git 里没有的信息。
- **清理风险评估**：清 tmp 唯一损失是「免记 commit 号的可读副本」，12K＋24K＝36K。恢复只需 §七 六行命令。
- **但**：本分区纪律「来源不明的 tmp 残留不要删」仍生效——`tmp/` 现值 130 件里只有 6 件属本族，其余未核；**要清就得整族逐件重做本单式对账**，不是按目录 `rm -rf`。
- 出口建议（交人工/规划，本班不实施）：`_archive/` 同样被忽略（`:26`），**不存在"移进 _archive 即算留档"这条路**；真要留档只有 `docs/` 内贴 diff 或打 `git tag` 两种，与 `colony-unreachable-recheck-20260922.md:112` 已登记的口径一致。

## 十、本单改动清单

- 新增：本档 `docs/insights/colony-retired-backup-verify-20260922.md`
- 追加：`docs/insights/colony-insights-index-20260919.md` 1 行（该档 85 行纯 CRLF，按字母序插在 `colony-registry-keys` 与 `colony-retired-module-residual` 之间；74/75 条目数争议在册待人工，**本单未碰**）
- 取证脚本：`tmp/c922-115/backup_md5_recon.py`（gitignored 临时件，非产出）
- 生产码：**零改动**；tmp 备份：**零删除、零写入**
