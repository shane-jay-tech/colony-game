# c927-68 · `renderer.build.minify`（esbuild）开写位裁决材料（只读，零改码）

- 班次：`qoder-executor-20260929-0345-colony60` · 模型 qoder · cwd `D:\code\colony-game`
- 生成时间：2026-09-29 04:0x +08:00（`date` 现取见 result 档）
- 卷宗：`zcode-bridge/done/c927-68.task.md`（原文「复核该配置行现值与收益（构建体积/时长——静态推算或读档内实测），给裁决材料+落地验收清单引用，推荐开/不开」，产出 `docs/insights/c927-68-minify.md`，判据 ①现值+收益推算 ②两案 ③推荐）
- 授权边界：本单＝**只读诊断＋材料**；未改 `electron.vite.config.ts`、**未跑 `npm run build` / `electron-vite build` / `electron-builder`**。允许的"静态推算"路径＝对**既有产物**跑 esbuild 单文件压缩量测（不生成 dist 物，输出落 gitignored `tmp/`）——这正是 c923-17/c922-18 用过的口径。

## 一、现值（四读，全部本班命令实测）

| 项 | 现值 | 实测命令 |
|---|---|---|
| 配置行 | **不存在**：`renderer.build` 块（`electron.vite.config.ts:47-58`）只有 `outDir` / `assetsInlineLimit:0` / `rollupOptions`，**无 `minify` 键** | `cat -n electron.vite.config.ts` |
| 仓内 `minify` 命中 | **0 命中**（`electron.vite.config.ts`／`tsconfig*.json`／`package.json`／`scripts/`） | grep 面：`grep -rn "minify" electron.vite.config.ts tsconfig*.json package.json scripts/` → 空 |
| 工具链版本 | `electron-vite 2.3.0` ＋ `vite 5.4.21` ＋ `esbuild 0.21.5`（`npx esbuild --version` 现取） | `python -c "...package.json version"` |
| 生效值 | **`false`** —— 根因是 electron-vite 2.3.0 的 renderer 预置把 `minify` 钉成 false（本班实测在树件：`node_modules/electron-vite/dist/index.cjs:396` `const { sourcemap = false, minify = false } = options;`，同函数 :398 `delete options.minify`、:420/:429 组装进预置）⇒ Vite 自己的 `minify:'esbuild'` 默认**根本没机会生效**，且 CLI 无 `--minify` 旗标 ⇒ **只能显式写这一行** | grep `minify` on `node_modules/electron-vite/dist/index.cjs` |
| 产物形态（未压的直接指纹） | `dist/renderer/assets/index-9DOBpPPC.js` = **799,724 B / 20,293 行 / 最长行 390 字符**；`phaser-CWlhwGg6.js` = **6,777,632 B / 146,867 行**（`wc -l` 口径；c923-17 记 146,868 行＝尾换行计数差 1，不影响结论）。压缩产物不可能有这个形态 | `wc -l`／`wc -c`／`awk` 求最长行 |

> 口径提醒：**不要再去改 `--mode`**（c923-17 第七节 N3）——mode 在本仓只喂 `loadEnv`，在 electron-vite 里只决定 `base`，与 minify 无关。

## 二、收益实测（本班独立复算，非引用）

对**当前在树的产物文件**直接跑 `npx esbuild --minify`（输出落 `tmp/c927-68/`，gitignored）：

| chunk | 现值 raw | minify 后 | Δ raw | Δ% | gzip-9 raw | gzip-9 min | Δ gzip |
|---|---|---|---|---|---|---|---|
| `index-9DOBpPPC.js`（本仓自有码） | 799,724 B | **584,844 B** | −214,880 B | **−26.9%** | 201,008 B | 150,534 B | −50,474 B |
| `phaser-CWlhwGg6.js` | 6,777,632 B | **1,478,613 B** | −5,299,019 B | **−78.2%** | 850,952 B | 335,213 B | −515,739 B |
| **合计 renderer JS** | **7,577,356 B** | **2,063,457 B** | **−5,513,899 B** | **−72.8%** | 1,051,960 B | 485,747 B | **−566,213 B（−53.8%）** |

- **复算一致性（强证）**：phaser minify 后 **1,478,613 B** 与档内记录（c922-18 → c923-17 E3，`tmp/c922-18/phaser.min.est.js`，md5 `6e4488d4661ebea1d7ae74456a0a100d`）**逐字节同量**，gzip 两端（850,952→335,213 / 201,008→150,534）也与 c923-17 E3 逐位相同 ⇒ 三个班次三条独立路径同读数。
- **相对大盘**（引用 c923-17 第四/六节口径，本单未重跑打包）：app.asar 162,292,509 B ⇒ **3.40%**；NSIS 包 230,976,170 B ⇒ **约 0.245%**（安装包大头是 Electron 运行时 + ~55 MB BGM）。
- **构建时长**：本仓没有在册的"开 minify 后时长"实测点。可用锚：`docs/insights/colony-p43-dress-20260918.md:13`（c918-27）记 `npm run build` **EXIT=0、✓ built in 5.04s**，其产物正是**未压**的 726.80 kB + 6,777.62 kB 形态 ⇒ 5.04s 这个数**就是"不开"一侧的时长**。esbuild 侧 0.21.5 对 7.5 MB 输入的压缩（本班量测整条命令含 npx 冷启动 < 10 s，纯压缩为亚秒级）；**据此静态推算开 minify 后 `npm run build` 量级仍在个位数秒**（预估 +1~3 s）。⚠ 这一段是**推算不是实测**，落地单要落数就必须跑一次 build 计时。

## 三、两案

### 案 A：开写位（`renderer.build.minify:'esbuild'` 一行）
- 收益：renderer JS **−5,513,899 B raw（−72.8%）／−566,213 B gzip（−53.8%）**；首屏本地解析体量与内存下降（价值面在此，不在安装包）。
- 成本／风险面：① 首次以 esbuild 压 phaser 这种量级 ⇒ 需游戏冒烟（地图渲染／音效／存档面板目检）；② 发布物哈希全变（`index.html` 引用的两处哈希名同步变，无硬编码文件名 ⇒ c923-17 E6 实测 0 处 dist 依赖）；③ 生产栈映射：本仓 `sourcemap` 未开（预置默认 `false`），压后线上栈可读性下降——**本单不建议顺手开 sourcemap**（会再动产物面）。
- 前置：落地单需**主班授权跑构建**（`npm run build` ＋ `npm run verify` ＋ 至少 `electron-builder --dir` 复看 asar 内哈希 ＋ 冒烟）。

### 案 B：不开（保持现状）
- 收益 0；发布物继续带 7.58 MB 未压 JS。
- ⚠ 关键不对称：**"什么都不做"并不等于"默认安全"** —— 生效值是 electron-vite 预置钉的 `false`，不是 Vite 的 `esbuild` 默认。只要没人写这一行，未压发布就是**长期稳态**，且 CLI 无旗标可救，未来升级 electron-vite 若改掉预置 `minify:false`，本仓产物会在**无人改配置**的情况下突变 ⇒ 这一行的价值一半在收益、一半在**把口径写死防漂移**。

## 四、推荐

**推荐开（案 A），但按"低优先级＋需构建授权"排。** 理由：
1. 收益是**实测**而非估算（三班次独立复算同字节），且 `index` 面（本仓自有码 −26.9%）是 c923-17 才点出的增量事实——过去讨论都聚焦 phaser。
2. 改动面**一行、零断言触碰**（全仓 `src/`+`scripts/` 读 `dist/` 0 命中，两法互验）。
3. 反对理由只有一条且是排期性质：对安装包体积只有 ~0.245%，**别当性能大单排**（c923-17 遗留问题 3 原话）；而"必须跑构建＋冒烟"的门禁又落在主班手上。
4. **同批不动 main/preload**：它俩现值 6,834 B / 1,086 B（c923-17 E2），收益 ~8 KB、风险面是 CommonJS interop ⇒ 档内结论"不建议同批动"，本班复核 `dist/main/index.js`、`dist/preload/index.mjs` 未变，维持该判断。

## 五、落地验收清单（引用 c923-17 档第六节第 4-5 条原文，落地单逐条打勾）

> 出处：`docs/insights/colony-phaser-minify-diagnosis-20260923.md` 第六节「落地单必须做的验收」第 1-5 条，**第 4-5 条逐字**：
>
> 4. **游戏冒烟必做**：esbuild 压缩 phaser 这种量级的代码是首次，需目检地图渲染/音效/存档面板；`phaser` 的 `this.load` 与装饰器无关，风险面低但非零。
> 5. 已核对的零风险项：全仓 `src/`＋`scripts/` **没有任何件读 `dist/`** —— 两法互验均 0 命中：`rg -n "dist/" src scripts`（去掉 node_modules 后按说明符/路径形态二次筛）与 python 扫描（`walk('src')+walk('scripts')` 匹配 `(from|import|require)\s*\(?\s*['"][^'"]*dist/` 及 `readFileSync(...dist...)`）。⇒ 改 minify 不会碰任何在册测试断言（受版面无 dist 依赖）。
>
> 前 3 条（同节）：① `npm run build` 后 `ls -l dist/renderer/assets/` 确认 phaser chunk 从 6,777,632 B 量级掉到 ~1.5 MB 量级、`index.html` 哈希名同步变化；② `npm run verify`；③ 真跑一次 `electron:build` 或至少 `electron-builder --dir` 复核 asar 内哈希。

**本单补的第 6 条（防抄错）**：验收时体积一律写**字节数**，别写 kB——6,777.62 kB vs 6,777,632 B 的 0.01 kB 差属换算层（c923-17 E7①）；且 index chunk 历史上三次读数（726.80 kB／796,245 B／799,724 B）**分属不同构建**（哈希名各异），只有 phaser 跨三次同哈希。

## 六、必须同笔入库 / 待人工

- 本档 + `zcode-bridge/outbox/c927-68.result.md` 同笔；`tmp/c927-68/{index,phaser}.min.js` 是 gitignored 量测产物，**不提交、本班不删**（与 c923-17 的 `tmp/` 探针件同处理口径）。
- **人工拍板项**：① 开/不开（推荐＝开）；② 授权写位单跑构建与冒烟（本班与后续只读单都跑不了）；③ 若开，是否与 §C 在途的 `hud.test.ts`／计时敏感件同批（不同批更安全，判据②的 `npm run verify` 会把在途件算进全量）。
- **盘态告警（非本班造成，本班一字未动）**：开工 HEAD `3497702`，收工前 HEAD 已变为 `947075d docs(colony): c927-62／c927-66／c927-67 三枚只读裁决材料`；`docs/insights/colony-dead-exports-20260914.json` 现为 ` M`、其 `.bak` 现为 ` D` ⇒ 有并发班次带 `--write` 跑了审计（脚本 108-138 行确有 `--out`／`--write` 两个写口，且 `--write` 会把改前快照写成 `.bak`）。主班入库前请按精确路径复核这两个档的取舍，**别 `git add -A`**。
