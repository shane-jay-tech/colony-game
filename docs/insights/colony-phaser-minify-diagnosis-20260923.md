# colony phaser 6.78 MB 未 minify 根因诊断（c923-17，2026-09-23）

> 只读诊断档。**零构建、零 `src/` 改动、零 `dist/` 写入**（自证见第九节）。
> 结案对象：`zcode-bridge/done/c922-18-colony-phaser-externality.result.md` 留的开放问题
> ——「为什么正式发布 asar 里 phaser 是未压缩的 6.78 MB」。

## 一、结论（一句话）

**不是 electron-builder 的问题，也不是 `--mode` 的问题：`electron-vite` 给 renderer 预置了 `build.minify: false`，本仓 `electron.vite.config.ts` 的 `renderer.build` 块从未覆盖它，于是 Vite 自己的 `"esbuild"` 默认值根本没机会生效 —— 从 dev 快照到 8/14 正式发布，renderer 的两个 JS chunk 从来没被压缩过。**

- 现值：`build.minify` 在两配置文件里**零命中**（第二、三节实测）⇒ 生效值 = `false`（第三方库预置）。
- 影响面：不只是 phaser。`index-*.js`（本仓自己的代码）同样未压 ⇒ renderer JS 现 shipped **7,577,356 B**，补 minify 后约 **2,063,457 B（−72.8% raw / −53.8% gzip）**。
- 修复只需一行配置（第六节草案），不碰 CSP（`src/renderer/index.html:7` 的 `script-src 'self'` 原样保留）、不碰网络、不加依赖 —— 与 c922-18 否决 externals 化的结论同向。

## 二、config 文件实测（判据②：`minify` 键命中数与现值）

```
$ rg -n "minify" electron-builder.yml electron.vite.config.ts
（无输出，rc=1 → 命中 0）
$ rg -n "minify|esbuild" electron.vite.config.ts tsconfig*.json package.json scripts/
（无输出，rc=1 → 命中 0）
```
取数时刻 2026-09-23T12:0x；ripgrep 15.0.0（非交互 bash；`command -v rg` 在本机先命中一个指向 Qoder 内置二进制的 alias，故判据命令可用 `rg`，本档另附绝对路径以防他班 shell 形态不同：
`/d/Qoder/.qoder-versions/0.3.4/resources/app.asar.unpacked/node_modules/@qoder-ai/qoder-agent-sdk/dist/_worker/vendor/ripgrep/x64-win32/rg.exe`）。

「**无显式 minify 配置**」这个否定式事实本身按纪律档要记档 —— 它正是本单的根因载体：缺失不是中性的，`electron-vite` 会把缺失填成 `false` 而不是留给 Vite 填 `esbuild`。

同屏核过的其它锚点：

| 锚点 | 卷宗说法 | 磁盘现值 | 判定 |
|---|---|---|---|
| `electron-builder.yml:45` | `asar: true` | 第 45 行正是 `asar: true` | ✅ 零漂移 |
| `electron.vite.config.ts` renderer.build | 未提 minify | 只有 `outDir` / `assetsInlineLimit: 0` / `rollupOptions`（:47-58） | ✅ |
| `phaser` 版本 | —— | 实装 **3.90.0**（`node_modules/phaser/package.json:3`），`exports` 字段 **null**；`main ./src/phaser.js`、`browser ./dist/phaser.js`、`module ./dist/phaser.esm.js` | 新事实，见第五节 |

## 三、传参链（逐跳，从 `npm run build` 到 chunk 落盘）

| # | 跳 | 位置 | 与 minify 的关系 |
|---|---|---|---|
| 1 | `npm run build` → `electron-vite build` | `package.json:10`（`build` 脚本）；发布走 `electron:build` = `gen-icon` + `patch-7za-wrapper` + `electron-vite build` + `electron-builder`（`package.json:12`） | 命令行**没有**任何 minify 相关旗标 |
| 2 | electron-vite CLI `build` 子命令 | `node_modules/electron-vite/dist/cli.mjs:76-89` ⇒ `createInlineConfig(root, options)`（:8-22） | inlineConfig 的 `build` 只带 `sourcemap` / `outDir` / `watch`；**2.3.0 的 CLI 根本没有 `--minify` 选项**（全量选项表面见 cli.mjs:24-33：`-c/-l/--clearScreen/-d/-f/-m/--ignoreConfigWarning/--sourcemap/--outDir/--entry`）⇒ 走命令行这条路修不了，只能改配置 |
| 3 | `mode` 传参 | `cli.mjs:11` `mode: options.mode`，`build` 子命令未声明 `-m` ⇒ 通常传下去是 `undefined`；Vite 再退回 `process.env.NODE_ENV \|\| 'production'`。electron-vite 另在 `chunks/lib-D1n7TA6K.mjs:18` 写 `process.env.NODE_ENV_ELECTRON_VITE = 'production'` | **与 minify 无关**：该变量只被 renderer 预置用于 `base` 判定（`lib-BmEkZIgk.mjs:490-491`）。本仓配置里 `mode` 的唯一消费者是 `loadEnv(mode, ...)`（`electron.vite.config.ts:18`）⇒ 只影响 `.env` 取哪一份。⇒ **判据「production 模式会不会压」= 与 mode 无关，任何 mode 都不压** |
| 4 | renderer 预置注入 | `node_modules/electron-vite/dist/chunks/lib-BmEkZIgk.mjs:505-522`（插件 `vite:electron-renderer-preset-config`，`apply:'build'`、`enforce:'pre'`）：`const defaultConfig = { build: { ..., reportCompressedSize: false, minify: false, ... } }` 然后 `mergeConfig(defaultConfig.build, config.build \|\| {})` | 🔴 **根因**：用户侧 `renderer.build` 没写 `minify` ⇒ 合并后 `minify:false` 存活。main（:277）与 preload（:382）预置同样写 `minify:false` |
| 5 | Vite 默认值 | `node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:65401-65408` `defaultBuildOptions = { ..., minify: raw?.ssr ? false : "esbuild" }`，:65422 `mergeConfig(defaultBuildOptions, raw)` | Vite 的 `"esbuild"` 是**兜底**，只在 `raw.build.minify` 为 `undefined` 时填空；第 4 步已把它写成 `false` ⇒ 兜底不生效 |
| 6 | 出 chunk 时是否压缩 | 同文件 :19351-19355 `resolveEsbuildTranspileOptions`：`const minify = config.build.minify === "esbuild"; if ((!target \|\| target === "esnext") && !minify) return null;` | `minify=false` ⇒ esbuild 只做 target 降级转译、**不做压缩**（这也解释了产物为何还带着 8,983 个注释块） |
| 7 | electron-builder 复制 | `electron-builder.yml:9-15` `files: dist/**/*` + 排除 node_modules；:45 `asar: true` | builder **不做任何 JS 压缩**，只打包进 asar ⇒ 它「原样搬」没有错；把责任记在 builder 上是误判 |

**旁证：为什么这个坑十年没人发现** —— 同一个预置还写死 `reportCompressedSize: false`（`lib-BmEkZIgk.mjs:513`），Vite 构建日志因此从不打印 gzip 列；未压产物在本地跑得完全正常（Electron 读本地文件，不受网络体积约束），只有当有人拿 asar 里的字节去比对官方 `phaser.min.js` 时才会露出来 —— 那正是 c922-18 做的事。

## 四、两份旁证读数引用 ＋「内容哈希相同」对照（判据①）

**旁证一（正式构建命令的产物）**：`docs/insights/colony-p43-dress-20260918.md`（c918-27）:13-14 逐字：

> - `npm run build` → **EXIT=0**，✓ built in 5.04s。
> - 产物：dist/renderer/index.html 2.00 kB；assets/index-*.js 726.80 kB；assets/phaser-*.js 6,777.62 kB（Phaser 体积为主，正常）。

⇒ 用**正式构建命令**产出的 phaser chunk 就是 6.78 MB，且当时代码里把它判成「正常」。同档的 `assets/index-*.js 726.80 kB` 说明**本仓自己的代码 chunk 也未压**（该次构建的 index chunk 与下面两个快照又不是同一次，见口径注记 N2）。

**旁证二（正式发布 asar 内的字节读数）**：`zcode-bridge/done/c922-18-colony-phaser-externality.result.md`「执行摘要」逐字：

> 实测 dist 快照与 8/14 正式发布 asar 里的 phaser chunk **文件名与字节数逐位相同**（同为 `phaser-CWlhwGg6.js` / 6,777,632 B，vite 内容哈希 ⇒ 内容相同）⇒ **连正式发布都没做过 minify**

**本单独立复算（不引用 c922-18 自报，改用手解 asar 头按 offset/size 直读切片）**：
`tmp/c923-17-asar-check.py`（gitignored）对 `dist-out/win-unpacked/resources/app.asar`（87 条目 / 162,292,509 B，头 pickle 23,828 B，数据段起点 23,836）：

| 对象 | 字节 | sha256（前 16） |
|---|---|---|
| asar 内 `/dist/renderer/assets/phaser-CWlhwGg6.js` | 6,777,632 | `ac55c7d0aaf1bd42` |
| asar 头里该节点的 `integrity.hash`（打包时写入） | —— | `ac55c7d0aaf1bd42…`（与切片计算值**一致**） |
| 本机 `dist/renderer/assets/phaser-CWlhwGg6.js`（mtime 2026-09-21 00:37:01） | 6,777,632 | `ac55c7d0aaf1bd42` |

⇒ **「内容哈希相同」这条推论从「同名 ⇒ 同内容」升级为逐字节 sha256 相同**：8/14 发布的 asar 与 9/21 的 dist 快照里，phaser chunk 是同一份未压字节流。两侧 `integrity` 与实测切片哈希吻合，也顺带证明本单的 asar 偏移算法没有读错位置。

## 五、"未 minify" 的字节级证据（不靠体积猜测）

| 对象 | raw | gzip-9 | 换行数 | `/*` 注释块 | 最长行 | 平均行长 |
|---|---|---|---|---|---|---|
| `dist/renderer/assets/phaser-CWlhwGg6.js`（=发布 asar） | 6,777,632 | 850,952 | 146,868 | **8,983** | 616 | 46.1 |
| `dist/renderer/assets/index-9DOBpPPC.js`（本仓代码） | 799,724 | 201,008 | 20,293 | 200 | 390 | 36 |
| asar 内 `/dist/renderer/assets/index-CvxggDtL.js`（8/14 那版） | 796,245 | —— | 20,234 | 199 | 390 | —— |
| `tmp/c922-18/phaser.min.est.js`（对上行补跑 esbuild --minify） | 1,478,613 | 335,213 | 1 | 0 | 超长单行 | —— |
| `tmp/c922-18/index.min.est.js` | 584,844 | 150,534 | —— | 0 | —— | —— |
| 官方 `node_modules/phaser/dist/phaser.min.js` | 1,196,122 | 315,602* | —— | —— | —— | —— |

\* 官方包的 gzip 取 c922-18 已实测的 `phaser.esm.min.js` 口径 315,602 B；本单只复算了 raw。

- 压缩后的代码不可能有 14.7 万行换行、8,983 个注释块、平均行长 46 字符 ⇒ **未压是确定的**，不是"phaser 本来就大"。
- `c922-18` 留下的两份 `.est.js` 本单复核**仍在原地且 md5 与它记录的逐位相同**（`6e4488d4661ebea1d7ae74456a0a100d` / `3f13dc35d0252b209efc6c878a6a7512`）⇒ 上表的「补 minify 后」列不是估算，是对**同一份 shipped 字节流**实测两次。
- 模块选择面（次要，但会误导下一波）：phaser 3.90 无 `exports` 字段，Vite renderer 侧按 `browser` 字段取 `dist/phaser.js`（未压 7,857,688 B）而非 `dist/phaser.min.js`（1,196,122 B）。**这不是缺陷** —— 只要第 4 步的 minify 打开，rollup 从原始模块自己压，还能 tree-shake；换用官方预压包反而把版本硬钉成单文件（c922-18 的 CSP/版本漂移顾虑同理）。

## 六、修复 diff 草案（本单不落码）

唯一必要的一行在 `electron.vite.config.ts` 的 `renderer.build` 块内：

```diff
     renderer: {
       root: resolve(__dirname, 'src/renderer'),
       publicDir: resolve(__dirname, 'public'),
       build: {
         outDir: resolve(__dirname, 'dist/renderer'),
         assetsInlineLimit: 0,
+        // electron-vite 2.3.0 的 renderer 预置把 minify 钉成 false（chunks/lib-BmEkZIgk.mjs:514），
+        // CLI 又没有 --minify 旗标可覆盖 ⇒ 不显式写就会以未压 JS 发布（c923-17 根因）。
+        minify: 'esbuild',
         rollupOptions: {
```

可选（同预置对 main/preload 也写了 `minify:false`，但它俩现值 6,834 B / 1,086 B，收益为零、风险是 CommonJS  interop 面，**不建议**在本单一起动）：

```diff
     main: {
       build: {
         outDir: 'dist/main',
+        minify: 'esbuild',   // 现值 6,834 B，纯观感；动它需另跑一次 electron:build 冒烟
```

- 用 `'esbuild'` 而非 `'terser'`：terser 在 Vite 5 里要**另装依赖**（违反「不下载安装依赖」），esbuild 已随 vite 在树里（c922-18 就是用 `./node_modules/.bin/esbuild` 0.21.5 复算的）。
- 预期收益（第四节实测口径）：renderer JS **−5,513,899 B raw（−72.8%）**／**−566,213 B gzip（−53.8%）**；相对 app.asar 162,292,509 B 是 **3.40%**，相对 NSIS 包 230,976,170 B 约 **0.245%**（安装包大头是 Electron 运行时 + ~55 MB BGM，见 c922-14/c922-18）。
  ⇒ **诚实定性**：这单的价值主要在「首屏本地解析的 JS 体量与内存」和「发布物观感」，不在安装包瘦身。别把它当性能大单排。
- 落地单必须做的验收（本单按卷宗禁止跑构建）：
  1. `npm run build` 后 `ls -l dist/renderer/assets/`，确认 phaser chunk 从 6,777,632 B 量级掉到 ~1.5 MB 量级、`index.html` 引用的哈希名同步变化（`dist/renderer/index.html` 只有 `./assets/index-*.js` 与 `./assets/phaser-*.js` 两处引用，无硬编码文件名）；
  2. `npm run verify`（= type-check + vitest 全量 130 文件/1395 例）；
  3. 真跑一次 `electron:build` 或至少 `electron-builder --dir` 复核 asar 内哈希；
  4. **游戏冒烟必做**：esbuild 压缩 phaser 这种量级的代码是首次，需目检地图渲染/音效/存档面板；`phaser` 的 `this.load` 与装饰器无关，风险面低但非零。
  5. 已核对的零风险项：全仓 `src/`＋`scripts/` **没有任何件读 `dist/`** —— 两法互验均 0 命中：
     `rg -n "dist/" src scripts`（去掉 node_modules 后按说明符/路径形态二次筛）与 python 扫描（`walk('src')+walk('scripts')` 匹配 `(from|import|require)\s*\(?\s*['"][^'"]*dist/` 及 `readFileSync(...dist...)`）。
     ⇒ 改 minify 不会碰任何在册测试断言（受版面无 dist 依赖）。

## 七、口径注记（本单否证/收窄的东西，别抄走）

- **N1（12 字节的换算差）**：c918-27 与 c921-09 把同一个 `phaser-CWlhwGg6.js` 记作 `6,777.62 kB`，而按 1 kB=1000 B 换算 6,777,632 B 应是 `6,777.63 kB`。差 0.01 kB（≈12 B，0.0002%），属**打印/换算层**，不构成"两次构建产物不同"的反证 —— 本单以 sha256 直读为准。引用体积请一律写**字节数**。
- **N2（三次 index chunk 读数互不相同是正常的）**：726.80 kB（c918-27，9/18 构建）、796,245 B（8/14 发布 asar，`index-CvxggDtL.js`）、799,724 B（9/21 dist 快照，`index-9DOBpPPC.js`）分属**不同构建**，哈希名都不同。只有 phaser chunk 因源码零变化而跨三次保持同一哈希 —— 这恰好是"未压"最省事的对照组：**同一份输入，字节数完全等于官方未压包的量级，且永远没有变化过**。
- **N3（`--mode` 不是凶手）**：c922-18 把待查方向写成"production 模式的 `build.minify` 生效值"。生效值确实是 `false`，但它**与 mode 无关**（第三节第 3 跳）：mode 在本仓只决定 `loadEnv` 读哪份 `.env`、在 electron-vite 里只决定 `base`。⇒ 不要再开"传 mode 参数"式的修复单。
- **N4（builder 免责）**：`asar: true` / `files: dist/**/*` 都不做 JS 压缩；c922-18 已实测 asar 内 `node_modules` 命中 0 条，本节进一步确认 asar 里的 chunk 与 dist **逐字节相同** ⇒ 责任链在 vite 配置侧，不在打包侧。
- **N5（纪律档 §四 的 colony 基线已过期）**：开工时 HEAD `32f2208`、`git status --porcelain` **3 项**（非 7 项），在册在途三件为 `docs/design/OPTIMIZATION_BACKLOG.md` ` M`、`docs/insights/colony-dead-exports-20260914.json` ` M`、其 `.bak` ` D`；本单一件未碰。

## 八、一句话给下一波

`electron-vite` 的 renderer 预置 `minify:false` 是**库给的默认**，本仓没覆盖 ⇒ 修复＝`renderer.build.minify:'esbuild'` 一行 ＋ 一次真构建 ＋ 一次冒烟；收益按上面的 raw/gzip 双口径报，别按安装包百分比报。

## 九、本单自证（判据③：零构建、零 src/ 改动）

```
$ git log --oneline -1       → 32f2208（与开工同值，本单未提交）
$ git diff --numstat         → 只有开工即在途的 3 件禁碰项（5/5、6/6、0/830），本单零受版件改动。
                               ⚠ 卷宗判据写的「git diff --stat = 0」在本仓开工基线上不可按字面满足（那 3 件开工就脏），
                               已收窄为「本单零增量」，并用 mtime 佐证两件 ` M` 分别是 09-15 03:08:29 / 09-19 03:39:52，
                               均早于本班开工时刻 ⇒ 非本单所改。详见 c923-17.result.md 的「证据 E1」。
$ git status --porcelain     → 5 行 = 上述 3 件 ＋ 本档（未跟踪）＋ c923-16 的新测试件（未跟踪）
                               本单另在 gitignored 的 tmp/ 落两个只读探针件（c923-17-asar-check.py / .cjs），不进 porcelain。
$ 未跑 npm run build / electron-vite build / electron-builder
$ dist/ 三件 JS 与 index.html 的 mtime 开工前后逐位相同（2026-09-21 00:36:53 / 00:37:01，size 亦逐位相同）
```
