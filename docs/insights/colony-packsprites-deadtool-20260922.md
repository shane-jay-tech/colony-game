# colony pack-sprites 死工具链核查（c922-112，只读＋建议级，不删脚本）

> 2026-09-22T04:4x｜执行班 `qoder-executor-20260922-0000-colony7`｜cwd `D:/code/colony-game`｜HEAD `e04e278`。
> 口径：核查＋处置建议。**未删任何脚本、未改 package.json / README / 任何 src 文件**；实跑探针已字节级还原（§四）。

## 一、四句结论

1. **三面皆死坐实**，且是**双向**证据（输入缺失＋输出空＋运行时零命中，外加「不在 .gitignore 内」这条排除性证据）：见 §三 A/B/C/D 四组读数。
2. 任务书问「该链何时断开」——**它从未在任何一次提交里通过**：`resources/sprites/` 与 `public/atlas/` 在 `git log --all` 与 `git ls-files` 上均为**零记录**，且二者都**不在** `.gitignore` 里（`git check-ignore` exit 1）。⇒ 措辞应从「何时断」改成「从未接」：本仓可见历史起点就是 `15769cb 2026-05-31 14:14 Initial commit v1.0`，那一次提交里输入目录就已经不存在。
3. **最坏形态不是报错而是 exit 0 假绿**（本单实测，§四）：空输入分支会 `mkdir resources/sprites/`（git 看不见空目录）并写一个 **226 字节、`frames:{}` 却声明 `image: main.png`（该文件永不生成）** 的占位 atlas，当场把工作树从 clean 变脏（`?? public/atlas/`）。谁为了「确认它还能跑」去跑一次，就会留下一个指向不存在图片的死声明。
4. **依赖不是"占一点 node_modules"而是占一整个闭包**：`free-tex-packer-core@0.3.4` 的依赖闭包 **109 个包（盘上实存 108）**，其中 **85 个只被这条链引用＝独占 15.3 MiB**（node_modules 总量 648.7 MiB 的 2.4%）。闭包内含 `jimp`、`pngjs`、`pixelmatch`、已废弃的 `request`，以及需要 API key 的 `tinify`。

## 二、锚点复核（漂移 0 处，但有 1 处任务书漏项）

| 任务书锚点 | 磁盘实况 | 判定 |
| --- | --- | --- |
| `package.json:15` `"pack-sprites": "node scripts/pack-sprites.mjs",` | 同文同处 | 未漂 |
| `scripts/pack-sprites.mjs:5` 「把 resources/sprites/ 下所有 PNG 打包成单张 atlas…」 | 同文同处 | 未漂 |

**漏项（按实况补，不据此判 failed）**：任务书把本单当「一个脚本」，磁盘上是**一条三级流水线**，且第一级连依赖都没装：

```
resources/ai-out/  --(npm run postprocess-png)-->  resources/sprites/  --(npm run pack-sprites)-->  public/atlas/  --(this.load.atlas)-->  ✗ 零消费者
   不存在                    sharp 不在 devDependencies        不存在                      空                    src/ 零命中
```

- `scripts/postprocess-ai-png.mjs:30/:31` 取的就是 `resources/ai-out` → `resources/sprites`，`:18` 明文教「之后 npm run pack-sprites 打 atlas」。
- 同文件 `:21` 自述「没装 sharp（devDependencies 没列）会 fail」，`:48-54` 用 `try{await import('sharp')}` 兜住并打印「跳过本次」——实测 `ls node_modules/sharp` → **No such file or directory**。⇒ 第一级今天跑了也只是 warn 一声，**同样假绿**。
- 结论：三面死的判定对**两级**同时成立，处置建议必须两行一起看，否则退役了 pack-sprites 会留下一个把 `resources/sprites/` 当输出目录的孤儿脚本。

## 三、三面证据（命令原文＋读数，全部现场跑）

### A 输入缺失
```
$ ls -la resources/            → 仅 icon.ico (370070 B)；目录 mtime May 30 21:23
$ git ls-files resources/      → resources/icon.ico        （1 行）
$ git log --all --oneline -- resources/sprites   → （空）
$ git check-ignore -v resources/sprites public/atlas/main.json → （空）exit=1
```
`check-ignore` exit 1 是关键排除项：**没有忽略规则替「从未存在」背锅**，是真没接。

### B 输出空
```
$ ls -la public/atlas/         → total 0，仅 . / .. ；目录 mtime May 28 22:07
$ git log --all --oneline -- public/atlas        → （空）
$ git ls-files public/atlas public/fonts        → 0
$ find dist -maxdepth 3 -iname "*atlas*"         → dist/renderer/atlas   （空目录，mtime Sep 21 00:37）
```
最后一条是本单第二有价值处：**上一次生产构建（9/21 00:37）已经如实把空 `public/atlas/` 原样拷进了 `dist/renderer/atlas/`**（`electron.vite.config.ts` renderer 段 `publicDir: resolve(__dirname,'public')`）。也就是说这层死壳每构建一次就复现一次，只是 `dist/` 被 gitignore ⇒ 在途探针与 `git status` 对它永久失明。

### C 运行时零引用（含动态拼装面）
```
$ rg -n "atlas" src/                                            → 0 命中，exit=1
$ rg -n "load\.atlas|addAtlas|AtlasJSON|atlas\.|'atlas'|\"atlas\"|/atlas/|main\.json|main\.png" \
      --glob '!node_modules' --glob '!dist*' --glob '!tmp' .    → 7 处命中，全部如下
```
命中集逐条定性：`scripts/pack-sprites.mjs:5/:6/:27`（脚本自述＋自己的 OUTPUT_DIR 常量）、`docs/insights/colony-font-chain-gap-20260922.md:11/:12/:16/:184`（c922-111 的同目录取证）。
⇒ **src/ 内既无字面引用，也无 `'/atlas/' + x + '.json'` 型动态拼装**；测试面同样零命中（`vitest.config.ts` include 为 `src/**/__tests__/**` 与 `scripts/__tests__/**`，前者已被上面 `rg src/` 覆盖）。
另附一条反向佐证：本仓唯一的存在性守卫 `bootLoadList.test.ts:137/:156/:164` 是「`LOAD_SOURCES` 逐条 URL × `existsSync(public/)`」，atlas 不在 5 个加载源里 ⇒ **它连被这条守卫红一次的机会都没有**。

### D 外部入口（唯一还活着的那条在文档里）
```
$ rg -n "pack-sprites|postprocess-png" --glob '!node_modules' --glob '!dist*' .
   package.json:15/:16   README.md:80/:81   scripts/postprocess-ai-png.mjs(9/17/18…)   scripts/pack-sprites.mjs(5/6/16/32)
$ grep -n "pack-sprites|atlas" docs/design/OPTIMIZATION_BACKLOG.md PLAN.md → 0 命中
$ cat .git/hooks/pre-commit  → 只有 npm run type-check + npm run test
```
`README.md:80-81` 在「操作速查 / 验证与质量」代码块里把两条命令当现役手段教给读者：
```
npm run pack-sprites # 重新打包精灵图
npm run postprocess-png # AI 素材 PNG 后处理
```
⇒ 这条死链**对人还活着、对机器已经全死**。任何「退役」动作必须与 README 同批改，否则制造出真·悬空引用（同段 `README.md:77` 的「npm test # 1076 条测试」另有一处计数漂移，见 §六.3）。

## 四、实跑一次（探针，已还原）

```
$ node scripts/pack-sprites.mjs
[pack-sprites] scanning D:\code\colony-game\resources\sprites
[pack-sprites] input dir not found, creating empty: D:\code\colony-game\resources\sprites
[pack-sprites] no PNG inputs; writing empty placeholder atlas
[pack-sprites] done (empty)
node-exit=0
```
产物与还原：
- `public/atlas/main.json`（226 B，`frames:{}`＋`meta.image:"main.png"`＋`size:{w:1,h:1}`）→ `rm -f` 后目录复为空。
- `resources/sprites/`（空目录）→ `rmdir` 后 `ls resources/` 回到仅 `icon.ico`。
- 跑探针的**当刻** `git status --porcelain` 由 8 项变 9 项（新增 `?? public/atlas/`），还原后回到 **8 项＝开工同数**（在册在途：`MapRenderer.ts`/`BuildPanel.ts`/`saveGuard3.test.ts`/`saveLoad.test.ts`/`OPTIMIZATION_BACKLOG.md`/`colony-dead-exports-20260914.json`＋其 `.bak` 删除态/未跟踪 `.audit-b151-tmp/`）。
- 还原后全量复跑：`npx vitest run --reporter=basic` → **Test Files 126 passed / Tests 1338 passed / rc=0 / 18.20s**，日志 `tmp/c922-112-vitest.log`（`tmp/` 已 gitignore，收尾自删另记 §七）。
- ⚠ 顺带一条对**别的班**有用的坑：这个空目录分支会造 `resources/sprites/`，而**空目录在 git 里是隐形的**——所以「跑一次看看」的代价里有一半根本不出现在 diff 里，只能靠 `ls` 自证。

## 五、处置建议（三案＋回滚；本单不执行任何一案）

| 案 | 内容 | 代价/风险 | 回滚 |
| --- | --- | --- | --- |
| **A 原样保留** | 零改动 | README 的误导继续存活；后来者仍可能"跑一次验证"从而留下占位 atlas 与隐形空目录 | 无需 |
| **B 退役（推荐，需授权）** | 一次提交删 4 行：`package.json:15`＋`:16`、`README.md:80`＋`:81`，并 `git rm scripts/pack-sprites.mjs`、`scripts/postprocess-ai-png.mjs`，devDependencies 去 `free-tex-packer-core` | 需连带 `npm install` 重锁 package-lock（`free-tex-packer` 在锁内 4 处命中），**属改构建配置＝不在执行班授权** | `git revert <sha>` 单提交复原；`git checkout 15769cb -- scripts/pack-sprites.mjs scripts/postprocess-ai-png.mjs` 逐件复原（两件自 Initial commit 起内容未变，`git log --follow` 各仅 1 条）；node_modules 侧不必单独删，重装即回收 15.3 MiB 独占闭包 |
| **C 复活接线** | 真去做 atlas 合图 | **不建议**：全仓美术现走 `ART_MANIFEST`＋分目录散图（`public/art` 66 件，c922-109 现值），atlas 是**同一需求的第二套事实源**，与 c922-110 `docs/design/p1-4-manifest-authority-20260922.md` 的「manifest 权威化、BootScene 不留第二源」方向正面冲突；且 `pack-sprites.mjs:95` 的 `prependFolderName:false`＋`removeFileExtension:true` 意味着帧键与现有 key 体系不兼容 | 不适用 |

配套（任一案之后都建议）：给 `scripts` 面补一条最小哨兵，**照抄既有范式不另造判据**——正向轨用 `bootLoadList.test.ts:137` 的 `existsSync(resolve(PUBLIC_DIR, …))`、反向轨用 `scatterDiskReconcile`（c922-107）的「盘有键无即报」，判据取「每个 `scripts/*.mjs` 的 `INPUT_DIR` 若不存在则该 script 必须不出现在 README 的操作速查段」。

## 六、为什么 scripts-consistency 报告没抓到（c918-28 盲区）

`docs/insights/colony-scripts-consistency-20260918.md` 结论是「**过期引用＝0**」「`pack-sprites` 未入文档属正常」。两个盲区使该结论与死工具**并存而不矛盾**：

1. **方向单一**：它只走 `doc → script`（文档里的 `npm run X` 是否实存），从不走 `script → 输入/输出/运行时消费者`。pack-sprites 恰好在第一方向干净（无文档引用），在第二方向三面全死。
2. **缺一条分流**：它把「scripts 中未被文档引用的 7 键」直接判为「均为工程内部键（构建/图标/贴图后处理），不入文档属正常」——把"没被引用"读成"内部键"，而不是"零消费者即待核"。本单就是这条分流该捞出来的东西。
3. **该档现值读数亦过期，引档前先复核**（本单实测）：自述「scripts 实有 **27 键**」、抽验「`npm test` → 105-107 文件全绿」。盘上 `python -c "json.load(open('package.json'))['scripts']"` → **11 键**；`git log --all -S'"backup"' -- package.json` 与 `-S'repair'` → **零命中**，即 backup/audit/repair 系键名在本仓可见历史里从未存在过；测试文件现值 **126**、用例 **1338 @ `e04e278`**。数字差异不属本单范围，**登记给人工/规划侧**（与主班 03:0x「引数一律现场重取」同口径）。
4. 同型盲区还有一处：`scripts/__tests__/auditDeadExportsReadonly.test.ts` 只守 `src/**/*.ts` 的值导出面（见 `scripts/audit-dead-exports.mjs:2-8` 规则注释），**工具面（scripts/*.mjs、*.py）不在它的扫描根内**——所以「零引用导出」盘点从来不可能顺手覆盖到 npm script。

## 七、遗留问题

- 案 B 是否执行、`free-tex-packer-core` 是否卸、README 两行怎么改：**待人工/构建侧授权**，本单零改动。
- `resources/sprites/` 与 `public/atlas/` 两个空目录现仍在盘上（本单探针已还原，但**它们本来就在**，是未跟踪的空壳）；若选案 B，可一并 `rmdir`，注意 git 对空目录不记账、删了也不会出现在任何 diff 里。
- 探针日志 `tmp/c922-112-vitest.log` 留在 `tmp/`（已 gitignore）。`tmp/` 内有大量来源不明的前浪残留，按纪律**不清别人的件**，本单只留这一份自产日志，交收班一次性处理。
- `docs/insights/colony-insights-index-20260919.md` 仅追加本档 1 行（第 44 行处，按字母序插在 `colony-p43-dress` 与 `colony-plan-ledger` 之间；原文件 83 行纯 CRLF，插入后 84 行无混行）。该档第 1 行自述条目数的 74/75 争议在册待人工（主班 03:0x），**本单未碰**。
