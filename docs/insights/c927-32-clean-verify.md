# c927-32 清洁目录安装验证·脚本与检查清单预备单（b461 三件套）

> 来源：`zcode-bridge/done/20260925-154207-b461.result.md` 遗留 1——清洁目录安装/启动验证需人工放行三件（下载依赖＋跑构建＋起 GUI）。
> 本单产出＝**预备**：脚本 `scripts/clean-install-verify.ps1`（本单新增，已过 DryRun 参数校验）＋本清单。**下载/构建/GUI 本单一步未执行**。

## 一、脚本使用

```powershell
# 干跑（零写入零联网，随时可跑；本单已实跑验证 rc=0）：
powershell -ExecutionPolicy Bypass -File scripts\clean-install-verify.ps1 -DryRun
# 真跑（人工放行后）：
powershell -ExecutionPolicy Bypass -File scripts\clean-install-verify.ps1
```

五步序列（每步带前置检查，任一步失败即停并留日志 `%TEMP%\clean-install-verify-<stamp>.log`）：

| # | 步骤 | 前置检查（干跑即验） |
|---|---|---|
| 1 | `robocopy <repo> D:\tmp\colony-clean /E /XD node_modules dist dist-out tmp _archive .git` | Source=仓根（package.json＋electron.vite.config.ts 在位）；Target 不在 Source 内部；目标盘 ≥6GB |
| 2 | `.npmrc` 备份为 `.npmrc.bak-cleanverify` 后删除 `cache=` 打头行（现值 `cache=D:\npm-cache`） | `.npmrc` 存在；**只改 Target 副本，本仓原件不动** |
| 3 | `npm ci --cache %TEMP%\npm-cache --registry=https://registry.npmmirror.com`（在 Target 内） | npm 在 PATH；独立缓存＝不污染全局旧缓存 |
| 4 | `npm run build`（＝electron-vite build；**明确不跑 electron:build:win**） | — |
| 5 | 产物断言：`dist/main/index.js`、`dist/preload/index.mjs`、`dist/renderer/index.html` 存在且非空 | ⚠ 锚点漂移修正：任务书原文「断言 BUILD_ID 存在」——全仓（含 b461 卷宗）rg `BUILD_ID` **0 命中**，无此字面量产物；按磁盘实况改为上述三件套断言并留痕 |

## 二、b461 三件注意事项覆盖清单（完成标准②）

**第 1 件·下载依赖**
- [ ] 真跑 Step 1–3 由脚本代劳；人工只看三处：① robocopy rc<8；② `.npmrc` 备份在位且 cache 行已除；③ `npm ci` rc=0。
- [ ] 独立缓存 `--cache %TEMP%\npm-cache`：验证「全局缓存污染」假设的关键——**不要**临时改回全局缓存跑。
- [ ] registry 锁 npmmirror（与仓内 `.npmrc` registry 行一致，避免双源差异混入结论）。

**第 2 件·跑构建**
- [ ] Step 4 只跑 `npm run build`；`electron:build:win`（打包 exe）**不在本次验证面**（b461 原文括号禁令）。
- [ ] Step 5 三件套断言通过后，人工补记：dist 产物字节数与构建墙钟（对照后续清洁/非清洁差异用）。

**第 3 件·起 GUI（脚本外，纯人工步）**
- [ ] 在 Target 目录 `npm run dev`（或 `npx electron .`）起 GUI；验证点＝主窗口出现、无白屏、控制台无模块解析错。
- [ ] 若需桌面 exe 级验证才涉及 `electron:build:win`——那是另一张放行单，勿顺手跑。
- [ ] GUI 起不来时的第一取数：`%TEMP%\clean-install-verify-*.log` 末段＋dev 控制台首条错误。

## 三、回滚说明

| 对象 | 回滚动作 |
|---|---|
| 本仓 `.npmrc` | **无需回滚**——脚本只改 Target 副本，原件全程未动（干跑/真跑同）；可 `git diff .npmrc` 自证为空 |
| Target 目录 `D:\tmp\colony-clean` | `Remove-Item -Recurse -Force D:\tmp\colony-clean`（整目录删除即净场；.npmrc 备份在其内，删前可取） |
| Target 内 `.npmrc.bak-cleanverify` | 如需单独还原：`Copy-Item .npmrc.bak-cleanverify .npmrc -Force` |
| 全局 npm 缓存 | 无接触（Step 3 用独立缓存），无需回滚 |
| 日志 | 留档不回收（`%TEMP%\clean-install-verify-<stamp>.log`） |

## 四、本单不执行自证（完成标准③）

```
$ powershell -ExecutionPolicy Bypass -File scripts/clean-install-verify.ps1 -DryRun
参数校验通过：Source=D:\code\colony-game Target=D:\tmp\colony-clean DryRun=True …
[step 1..5] 序列预告（零写入零联网）→ 干跑结束 rc=0
$ ls D:\tmp\colony-clean 2>/dev/null
（不存在＝Step1 未执行）
$ git diff --name-only -- src | wc -l   （src 零改动）
0
```

本单新增：`scripts/clean-install-verify.ps1`（UTF-8 **带 BOM**——Windows PowerShell 5.1 对无 BOM UTF-8 按 GBK 解析，本仓在册坑，首版即踩、已修）＋本档。树上网 在途脏项未碰。
