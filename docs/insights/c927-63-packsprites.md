# c927-63 packsprites 案 B 执行留档（半写位：四处删除已落工作树，两腿只出清单）

> 波次 87 执行班 `colony66`，2026-09-30T02:0x+08:00 现取。
> 仓＝`D:\code\colony-game`，开工 HEAD＝`9bc864a`，开工 `git status --porcelain` ＝ **15 行**。
> 主班改派口径（`tmp/w87-brief.md` §A）：`package.json`／`README` 的四处删除**可落工作树**；
> 两枚脚本的 `git rm` 与 `npm uninstall` **只出清单、零执行**（卷宗自身给了"夜间不可执行则留命令清单交日间"的分支）。
> **本波本班零 git 写**（未 add／commit／stash／checkout／restore／tag／push／`git rm`／`git mv`），未删任何文件，未动锁文件。

---

## 一、已落工作树的四处删除（逐字留档）

四处删除前先逐路径现证 clean：`git status --porcelain -- package.json` ＝ 空、`git status --porcelain -- README.md` ＝ 空 ⇒ **HEAD 版＝工作树版**。

### 1.1 `package.json`（两处，锚点未漂）

删掉的原文（含行首 4 空格，逐字）：

```json
    "pack-sprites": "node scripts/pack-sprites.mjs",
    "postprocess-png": "node scripts/postprocess-ai-png.mjs",
```

- 锚点核对：卷宗/案 B 写 `package.json:15`＋`:16` ⇒ **盘上现值同为 :15/:16，未漂**（开工态 `sed -n '15,16p'` 逐字对上）。
- 删除后 `scripts` 键数 **11 → 9**（`python json.load` 现取：`build / dev / electron:build / electron:build:win / gen-icon / preview / test / type-check / verify`）。
- `devDependencies` 的 `free-tex-packer-core`（`:30`）**本波未动** ⇒ 见 §二腿 B：它必须与 `package-lock.json` 同笔由 `npm uninstall` 一起改，单删 `package.json` 一行会让 `npm ci` 因锁与清单不一致而失败。

### 1.2 `README.md`（两行，锚点漂了 3 行，按磁盘实况修正）

删掉的原文（逐字）：

```markdown
npm run pack-sprites # 重新打包精灵图
npm run postprocess-png # AI 素材 PNG 后处理
```

- 锚点核对：案 B 档写 `README.md:80`＋`:81` ⇒ **盘上现值是 `:83`＋`:84`**（＋3 漂移，原因是 `:78-80` 的 `npm test` 注释段在 09-22 之后加了两行续注＋原有一行）。内容字面未变 ⇒ 按盘上实况删，锚点漂移在此留痕，**不判卷宗失效**。
- 两行同处 `## 验证与质量` 段的 ```bash 代码块内（`:77` 开栏、`:85` 闭栏），删除后代码块结构完整（见 §五 diff 原文）。

### 1.3 本班实测 numstat（主班按同一把命令复算）

```
$ git diff --numstat -- package.json README.md
0       2       README.md
0       2       package.json
```

两枚都是**纯删除、零新增、零行尾翻面**（本仓 `core.autocrlf` 开，`git ls-files --eol` 报两枚均 `i/lf w/crlf`；若整档翻行尾 numstat 会变成 34/120 级，实测不是）。

---

## 二、只出清单、零执行的两腿（交日间/主班执行）

### 腿 A：`git rm` 两枚脚本

| 脚本 | 开工态 | blob（`git rev-parse HEAD:<路径>`） | 行数 | 盘上 sha1 | 入库史 |
|---|---|---|---|---|---|
| `scripts/pack-sprites.mjs` | tracked ＋ `git status --porcelain` 空＝clean | `6d8449a0ac464923709a42685433520920f87748` | 126 | `e1ff37716ba57afe6d048ff3ff9a1d7c39455a19` | 仅 `15769cb` 2026-05-31 Initial commit（`git log --oneline -- <路径> \| wc -l` ＝ 1） |
| `scripts/postprocess-ai-png.mjs` | tracked ＋ clean | `c0e2805b032fa70ebcd89a52397dcc460508af0d` | 148 | `6bd2e6e62d86169fa84f2e3f2fc28d1f55b9d9ab` | 仅 `15769cb` 2026-05-31 Initial commit（同上＝1） |

**命令原文（可逐条粘贴）**

```sh
git rm scripts/pack-sprites.mjs scripts/postprocess-ai-png.mjs
```

**预期读数（执行后应逐条对上，对不上即停手）**

- `git status --porcelain` 出现且仅出现两行：
  ```
  D  scripts/pack-sprites.mjs
  D  scripts/postprocess-ai-png.mjs
  ```
  （首列 `D`＝已入索引的删除；本班零 git 写，所以此刻盘上**没有**这两行。）
- `git diff --cached --numstat` ＝ `0 126 scripts/pack-sprites.mjs` ＋ `0 148 scripts/postprocess-ai-png.mjs`（合计 −274）。
- 两枚文件从工作树消失（`ls scripts/*.mjs` 余 `audit-dead-exports.mjs`／`gen-icon.mjs`／`patch-7za-wrapper.mjs`，全仓 `.mjs` 由 5 枚降到 3 枚）。

**回滚方式（按代价从低到高）**

1. 未 commit 时：`git restore --source=HEAD --staged --worktree -- scripts/pack-sprites.mjs scripts/postprocess-ai-png.mjs`（或旧写法 `git checkout HEAD -- <两路径>`）⇒ 两枚原样回来，blob 与上表逐位一致。
2. 已 commit 时：`git revert <sha>` 单提交复原。
3. 逐件复原（案 B 档给的路径，本波复核仍成立）：`git checkout 15769cb -- scripts/pack-sprites.mjs scripts/postprocess-ai-png.mjs` ⇒ 两件自 Initial commit 起内容未变，所以任何基点复原都等价；上表 blob/sha1 是复原后的对账凭据。

**为什么本波不执行**：`git rm` ＝ 删跟踪件 **＋写索引**（首列会进 `D` 态），属 git 写面；本会话执行班体系零 git 写（`tmp/w86-brief.md` §C 第 3 条、`tmp/w80-brief.md` §A 第 4 条），且派单横幅把这条明确划进"只出清单"。另：`tmp/w87-brief.md` §C 点名零 git 写**含 `git rm`／`git mv`／`add`**。

### 腿 B：卸依赖 `free-tex-packer-core`

**命令原文（可逐条粘贴）**

```sh
npm uninstall free-tex-packer-core
```

⚠ 形态说明：**必须用 `npm uninstall`，不要手工删 `package.json:30` 那一行**。`npm uninstall` 会同时改 `package.json` 与 `package-lock.json`；手工删 `package.json` 而不同步锁 ⇒ `npm ci` 当场报"版本清单与锁不一致"，比不删更糟。
⚠ 本波**未跑**：它写 `package-lock.json`（重锁）＋ 动 `node_modules/`，且要联网核对 registry 元数据（本班禁联网）。

**预期读数（现值凭据已现取，执行后按此对账）**

- `package.json`：`devDependencies` 键数 9 → 8，numstat 含该文件 `1 1`（删 `:30` 一行、可能带尾行逗号改动）；`grep -c "free-tex-packer" package.json` **1 → 0**。
- `package-lock.json`（现值 7,252 行）：`grep -n "free-tex-packer"` 现值 **4 处命中**（`:19` 根 devDependencies 引用、`:3913` `node_modules/free-tex-packer-core` 条目、`:3915` `resolved` 指向 `free-tex-packer-core-0.3.5.tgz`、`:3927` 其内嵌 `node_modules/mustache`）⇒ 执行后应 **4 → 0**，同时其依赖闭包条目成批移除。
- 闭包量级（引 `docs/insights/colony-packsprites-deadtool-20260922.md` §一.4 的 09-22 实测：闭包 **109 包 / 盘上实存 108**，其中 **85 包仅本链独占＝15.3 MiB**，占 node_modules 648.7 MiB 的 2.4%，含 `jimp`／`pngjs`／`pixelmatch`／已废弃 `request`／需 API key 的 `tinify`）⇒ **该数字是 09-22 读数，本波未复算**（复算要解 7,252 行锁＋遍历 648 MiB `node_modules`，且与"重装即回收"的结论无因果）；执行日间请按现值重取后再引用，别把 15.3 MiB 当本班背书。
- 建议执行序：腿 A ＋ 腿 B ＋ 本档 §一 的四处删除**同一笔提交**（见 §六"必须同笔"集合）。
- 顺带清理（可选，git 不记空目录）：`public/atlas/` 现为空目录、未被跟踪、且**没有任何忽略规则覆盖**（`git check-ignore -v public/atlas` rc=1）⇒ 案 B 落地后可 `rmdir public/atlas`；`resources/sprites/` 此刻**不存在**（只有跑过 `pack-sprites` 才会被 mkdir 出来，见 §四假绿记录）。

**回滚方式**：`git checkout HEAD -- package.json package-lock.json` 后 `npm ci`（重锁回 HEAD 版）；或 `git revert <sha>`。node_modules 侧不必单独处理，重装即回收。

**为什么本波不执行**：`npm uninstall` ＝ 改 `package-lock.json`（重锁）＋写 `node_modules/`＋需联网 registry ⇒ 三条都撞禁令（本班禁联网；执行班不动锁文件；卷宗禁止事项"下载安装依赖"）。案 B 档 §五自述"属改构建配置＝不在执行班授权"，本波主班改派时亦写明"只出清单"。

---

## 三、动手前的"要命的事"核查：本仓**没有**逐键断言 `package.json` scripts 的测试

kaoyan 仓的 `tests/maintenance-scripts.test.ts` 那种 `assert.equal(packageJson.scripts['…'])` 会在删键时**必红**。本仓四路核查＝**零命中**，命令与原文如下：

```sh
$ git grep -n "package.json" -- '*test*' '*spec*'
# 命中 4 处，全在 docs／注释，无一处是断言：
#   docs/insights/c927-42-test-baseline-refresh.md:109（自述零改动）
#   docs/insights/colony-slicea-spec-drift-20260923.md:53（electron 版本对照）
#   docs/insights/colony-test-baseline-20260921.md:11（跑法口径表）
#   src/renderer/scenes/__tests__/pauseReachability.test.ts:9（**注释**，非断言，见下）

$ git grep -n -i "packageJson"                       → 零命中（rc=1）
$ git grep -n -E "(require|from) *\(? *['\"][^'\"]*package\.json"  → 零命中（rc=1）
$ git grep -n -E "scripts\[['\"]"                     → 零命中（rc=1）
$ grep -rn -E "pack-sprites|postprocess|free-tex" --include='*.test.ts' --include='*.test.tsx' src scripts
  → 零命中（删掉的两枚脚本无任何测试引用）
$ grep -rn "README" --include='*.test.ts' src scripts → 零命中（无"README↔package.json 一致性"门禁）
```

唯一提到 `package.json` 的测试件是 `pauseReachability.test.ts:7-11` 的**头注**：「`jsdom` 既不在 `package.json` 的 devDependencies 也不被任何配置引用」——纯叙述，件内 `grep readFileSync|fs\.` 零命中 ⇒ **不在运行时读 `package.json`**，且本班没动 `devDependencies`。

配置面复核：`vitest.config.ts` 的 `include` 只有 `src/**/__tests__/**/*.test.ts` 与 `scripts/__tests__/**/*.test.ts`（**不逐文件名硬编码**），`.git/hooks/pre-commit` 全文只跑 `npm run type-check` ＋ `npm run test`（不校验 scripts 键集）。

⇒ **结论：删 `package.json` 的两个键不会让任何测试变红**，四处删除可以安全先落工作树。这条核查是本单的前置闸，它成立 ⇒ 本班才动 `package.json`。

---

## 四、冒烟读数（只跑只读校验型，未跑 build）

| 命令 | rc | 读数 | 副作用 |
|---|---|---|---|
| `npm run type-check`（＝`tsc -p tsconfig.renderer.json --noEmit`） | **0** | 零诊断 | 无（`--noEmit`；跑后 porcelain 未增） |
| `npx vitest run scripts/__tests__/auditDeadExportsReadonly.test.ts` | **0** | Test Files 1 passed (1)／Tests 1 passed (1)／469ms／Duration 2.26s | 无新增件 |
| `npx vitest run src/shared/__tests__/visualConstants.test.ts` | **0** | Test Files 1 passed (1)／Tests 2 passed (2)／Duration 379ms | 无新增件 |
| `python json.load package.json` | 0 | scripts **9 键**、devDependencies **9 键**（`free-tex-packer-core` 仍在，符合预期） | 只读 |

**未跑的三项与理由（登记，不是漏做）**

1. `npm run build`（＝`electron-vite build`）：**不跑**。它写产物目录 `dist/`（案 B 档 §证据记 `dist/renderer/atlas` 等），派单横幅明确"会写 `.next`／`dist` 产物目录 ⇒ 不跑并登记理由"。且 build 对本次四处删除**不敏感**：`pack-sprites`／`postprocess-png` 只是 npm 脚本别名，`electron.vite.config.ts` 与 `electron-builder.yml` 均不引用它们（`git grep` 命中集里无这两个文件名）。
2. `npm run electron:build` / `:win`：**不跑**。除写 `dist/` 外还写 `dist-out/`（在册 0.10.0 安装包三件套），并会 `gen-icon`＋`patch-7za-wrapper` 动本机 7za wrapper——属打活产物＋跨出仓外写面。
3. 全量套件（`npm test` ＝ `vitest run`，现值量级 161 files／约 1,825 tests，36–38 s）：**不跑**。并发窗红不可归因（`tmp/w40-brief.md` §5）；本班入库时主班的 pre-commit 会跑全量，全量口径交主班收账窗取。⚠ 在册红别当本班引入：`tsc -p tsconfig.main.json` rc=2（`src/main/index.ts:93` 两处 TS18048）是 09-22 就在册的红，且**不在** `npm run type-check`（renderer 配置）覆盖面内。

**"死工具跑一次会自产脏件"的在册坑**（案 B 档 §四实测，本波未复现、也不该复现）：`node scripts/pack-sprites.mjs` 在输入目录缺失时**不报错**，而是 `mkdir resources/sprites/` ＋ 写 226 B 的 `frames:{}` 占位 atlas 到 `public/atlas/`，**exit 0 假绿**、`git status` 由 8 项变 9 项。⇒ 腿 A 落地前**别拿"跑一次看看"当验证**；退役它之后这类假绿随之消失。第一级 `postprocess-ai-png.mjs` 同型：`sharp` 不在 devDependencies、`node_modules/sharp` 不存在，`try{await import('sharp')}` 兜住后只 warn 一声"跳过本次"，同样假绿。

**本班留下的临时件**：日志写在仓外 `D:/code/tmp` 的 `/tmp/w87-c63-vitest*.log`（不在工作树内，`git status` 不见），**仓根零临时件**；收班自清。

---

## 五、diff 原文（本班唯一改动，两枚件共 −4/+0）

```diff
--- a/package.json
+++ b/package.json
@@ -12,8 +12,6 @@
     "electron:build": "node scripts/gen-icon.mjs && node scripts/patch-7za-wrapper.mjs && electron-vite build && electron-builder",
     "electron:build:win": "node scripts/gen-icon.mjs && node scripts/patch-7za-wrapper.mjs && electron-vite build && electron-builder --win",
     "gen-icon": "node scripts/gen-icon.mjs",
-    "pack-sprites": "node scripts/pack-sprites.mjs",
-    "postprocess-png": "node scripts/postprocess-ai-png.mjs",
     "type-check": "tsc -p tsconfig.renderer.json --noEmit",
     "test": "vitest run",
     "verify": "npm run type-check && npm run test"
--- a/README.md
+++ b/README.md
@@ -80,8 +80,6 @@ npm test             # 全量测试（含故事全流程无头试玩、存档 v1→v9 迁移回归）
                      # 现值现取——跑本行命令，读末行 `Test Files …`／`Tests …` 汇总（口径同 pre-commit）
 npm run type-check   # TypeScript 类型检查
 npm run verify       # type-check + 全部测试
-npm run pack-sprites # 重新打包精灵图
-npm run postprocess-png # AI 素材 PNG 后处理
 ```
 
 开发纪律：
```

---

## 六、必须同笔入库的集合（主班代提交按此核）

**最小一致集**（缺一样就会在 HEAD 留下"文档/脚本指向不存在对象"的悬空态）：

1. `package.json`（本班已改，`0 2`）
2. `README.md`（本班已改，`0 2`）
3. `docs/insights/c927-63-packsprites.md`（本档，新增未跟踪）
4. — 腿 A 的 `scripts/pack-sprites.mjs`／`scripts/postprocess-ai-png.mjs` 删除（**本波未执行**，索引仍为 tracked）
5. — 腿 B 的 `package.json` devDependencies 行 ＋ `package-lock.json`（**本波未执行**）

⚠ 4/5 未执行 ⇒ 若主班只提 1/2/3，`scripts/*.mjs` 两枚仍在盘上、`free-tex-packer-core` 仍装着＝**案 B 半落地态**（可运行、无红，但死工具未退役）。建议主班在同一提交窗补齐腿 A＋腿 B 再一笔收，或明确分两笔并在台账点名"案 B 未完"。

**绝不能一起提的他班件**（本仓开工即在途，本班一律避让、零触碰）：

- ` M docs/insights/colony-suite-timings-20260921.json`（c927-57 的目标基线档，未归因）——本班前后 sha1 逐位不变：`12ea4d46cc12a50228309a0682aef1af3458f87c`
- ` M docs/design/OPTIMIZATION_BACKLOG.md`、` M docs/insights/colony-dead-exports-20260914.json`（后者 sha1 `8ea50733dfb9343285c906909d3b6ddead8c622c`，本班前后不变）
- ` D docs/insights/colony-dead-exports-20260914.json.bak`（他班的 `.bak` 删除，别替人归位也别恢复）
- `?? docs/insights/c927-10-hardcode-adjudication-board.md`／`c927-13-building-validation-adjudication.md`／`c927-19-timeseries-instrument-design.md`／`c927-21-migration-design-gap.md`／`c927-22-savehash-impl-design.md`／`c927-23-migrations-value-adjudication.md`／`c927-26-hud-cost.md`／`c927-32-clean-verify.md`／`c927-50-idle-tick-cost.md`（10 枚未归因在途件中的 9 枚 docs）
- `?? scripts/clean-install-verify.ps1`、`?? src/renderer/ui/__tests__/hudRefreshCost.test.ts`（他班在途新件，**别当本单的脚本面一起删/提**）

`git add` 请用精确路径（本仓 autocrlf，禁 `-A/-u/.`）：
`git add package.json README.md docs/insights/c927-63-packsprites.md`

---

## 七、遗留问题（交主班/人工）

1. **两处悬空引用没删、也不属本单点名件** ⇒ 本班**未动**，请主班裁：
   - `README.md:10`：「- free-tex-packer 精灵图打包、脚本化图标与素材后处理」——技术架构段的能力清单行，删了脚本后这句不再成立。它在卷宗点名的"README 两行"**之外**（案 B 只算 `:83/:84` 两行），按 §B 第 1 条"只碰点名件"本班不自作主张删。修法候选：整行删，或改写为「脚本化图标与素材后处理」去掉 free-tex-packer 半句（**后者需人工点头**，属文案裁决）。
   - `docs/design/00_上手须知_START_HERE.md:124`／`:125`：scripts 速查表两行 `| pack-sprites | 打包精灵图 |`、`| postprocess-png | AI 生成 PNG 后处理 |`——文件不在本单点名范围。**腿 A 落地前必须一起删**，否则文档教一条不存在的命令。（同表 `:127`「test ｜ vitest 全量单测（1227 用例）」的行数是过期计数，与本案无关，另登记。）
2. **`docs/insights/colony-insights-index-*.md` 未加索引行**：`tmp/w42-brief.md` §C 点名本仓 `docs/insights` 现有四份索引快照、无权威无哨兵 ⇒ 本班不替人工选权威、不改旧快照；本档是否入索引、入哪一份，交主班随代提交决定。
3. **案 B 的"依赖卸载"腿按分支落成清单**（卷宗原文即给了"如夜间不可执行则留命令清单交日间"）⇒ 完成标准②按"清单"口径满足，`free-tex-packer-core` 与两枚脚本此刻仍在盘上、仍在索引里。
4. **闭包 15.3 MiB／109 包是 09-22 读数**，本波未复算 ⇒ 日间真要收这个成本时先重取现值。
5. `public/atlas/` 空目录（未跟踪、`git check-ignore` rc=1 无规则覆盖）是否随案 B `rmdir`：属可选清理，git 侧不进 diff，本班零删除动作。
6. **`c923-13` 的 fakeScene 裁决已作废**（三个方法早在 `986db17`）——本单不涉该域，按横幅要求登记：本班**未据此扩面**。

> 补注（c1001-03，2026-10-03）：腿 A 落地态见 docs/insights/c930-29-texpacker-precheck.md——本体 git rm、依赖卸载、README 案乙、START_HERE 删行改指已同笔落地。
