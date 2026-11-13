# 工具链升级战役基线（2026-11-14）

本文件为 2026-11-14 工具链升级战役（Electron 28→最新 / vitest 1→4 / vite 5→8 + electron-vite 2→3 / TS 复核）的**升级前基线快照**。后续每一步升级 commit 均以本基线为对照（测试数、绿基线）。

## 环境

| 项 | 值 |
| --- | --- |
| Node | v24.15.0 |
| npm | 11.12.1 |
| registry | npmmirror（.npmrc：`registry=https://registry.npmmirror.com`，cache=`D:\npm-cache`） |
| 平台 | Windows 10 x64（win32 10.0.26300） |
| git 分支 | `codex/architecture-hardening`（基于 `0d6f2d7`，工作树干净） |

## 依赖版本（升级前，取自 package-lock.json 实际锁定值）

| 依赖 | package.json 声明 | lock 实锁 |
| --- | --- | --- |
| electron | 28.2.5（精确 pin） | 28.2.5 |
| electron-vite | ^2.1.0 | 2.3.0 |
| electron-builder | ^24.13.3 | 24.13.3 |
| vite | ^5.1.4 | 5.4.21 |
| vitest | ^1.6.1 | 1.6.1 |
| typescript | ^5.3.3 | 5.9.3（已 >5.8，仍 <6） |
| phaser | ^3.70.0 | 3.90.0 |
| @types/node | ^20.11.5 | 20.19.41 |

## 基线 verify 结果（全绿）

`npm run verify` = `type-check && test && test:perf`，2026-11-14 实测：

| 门禁 | 结果 |
| --- | --- |
| type-check（tsconfig.renderer + tsconfig.main，双 tsc --noEmit） | 0 错误 |
| vitest run（vitest.config.ts） | **186 文件 / 2037 例全通过**，Duration ≈ 42.8s |
| test:perf（vitest.perf.config.ts，singleThread 串行，hudRefreshCost.test.ts） | 1/1 通过 |

### perf 基线读数（hudRefreshCost，c927-26）

- 单件读数（µs/call，热身 20＋测量 200 轮）：HUD 11.01 / BuildPanel 69.17 / DiplomacyPanel 789.09 / GradePanel 6.11 / JitHintManager 0.11 / MegaProjectPanel 30.77 / **MilitaryPanel 4473.99** / PolicyTreePanel 1.2 / PopulationPanel 18.91 / ProductionPanel 16.9
- 门槛：5000µs/call（MilitaryPanel 是唯一逼近项）；totalUsPerCallAll10=5417.3，perTickUpperMsAll10=30.282
- 本次 cpuShare=1.88（≈2＝独占读数，无外部抢核）
- 若后续 vitest 4.x 升级后计时器行为变化导致误报，按战役纪律重标阈值：跑 3 次取中位数 ×1.2，并在 commit message 说明

## 附：dist-out 清理（阶段 0 第 1 步，不入 git）

- 删除：v0.8.0 双 exe＋blockmap（~409MB）、v0.9.0 双 exe＋blockmap（~485MB）、win-unpacked/（429MB）、邦国录-0.10.0-发朋友.zip（220MB，与「发朋友-v0.10.0/」目录内容重复的孤立 zip）
- 保留：邦国录-0.10.0-x64.exe（NSIS）＋ portable exe＋其 blockmap（241KB，配对保留）＋「发朋友-v0.10.0/」目录＋builder-debug.yml
- 回收：dist-out 2.2G → 661M，**回收 ≈1.54GB**；`dist-out/` 已在 .gitignore（核实通过），无需 commit
