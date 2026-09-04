# Electron 升级路线调研（colony-B15，2026-09-04）

> ⚠️ **本文档基于本地信息撰写（package-lock 与 node_modules 内置文件），
> 最新版本号、EOL 公告与破坏性变更清单待日间联网核实后再定案。**

## 1. 现状版本矩阵（来自 package.json / package-lock.json / node_modules）

| 包 | 声明约束 | 实装版本 | 备注 |
|---|---|---|---|
| electron | `28.2.5`（精确锁定） | 28.2.5 | 2023-12 发布；E28 官方支持窗口已于 2025-06 前后结束（待核实） |
| electron-vite | `^2.1.0` | 2.3.0 | 构建/开发服务器层 |
| electron-builder | `^24.13.3` | 24.x | 打包与发布 |
| vitest | `^1.6.1` | 1.6.1 | 1076 条测试的载体 |
| typescript | `^5.3.3` | 5.x | type-check 门禁 |

## 2. 版本耦合点清单（带文件:行号）

| 耦合点 | 位置 | 现状 | 升级影响 |
|---|---|---|---|
| **sandbox: false** | `src/main/index.ts:69` | 显式关闭沙箱；注释（`src/main/index.ts:51`）说明 preload 走 electron-vite 默认输出的 **ESM `.mjs`**，依赖 E28 + sandbox=false 的组合 | E28+ 的 ESM preload 支持（`sandbox:false` + `.mjs`）是本次锁定的核心耦合；升级 Electron 后需重新验证 .mjs preload 加载（E30+ 对 sandbox 默认值有收紧趋势） |
| **contextIsolation: true / nodeIntegration: false** | `src/main/index.ts:70-71` | 安全三件套中的两项已开 | 与主流方向一致，升级风险低 |
| **contextBridge API 面** | `src/preload/index.ts:1,27` | `exposeInMainWorld('colonyApi', api)` 单一暴露点 | API 面收敛，升级主要回归 preload 是否正常注入 |
| **render-process-gone / 崩溃重载** | `src/main/index.ts:117-133` | 自实现 3 次重载上限 + showErrorBox（colony-B 刚加固） | 事件 API 稳定，低风险 |
| **协议白名单外链** | `src/main/index.ts:111-117` | setWindowOpenHandler 白名单（colony-B） | 低风险 |
| **save-game 原子写** | `src/main/index.ts:146-162` | fs/promises rename + bak（colony-A） | 纯 Node API，随 Node 运行时升级连带验证 |
| **CSP meta** | `src/renderer/index.html:5-7` | colony-B 引入 | 升级不改 CSP，但新 Chromium 可能对内联样式告警口径变化 |
| **electron-builder 打包** | `electron-builder.yml` + `dist-out/` | 0.10.0 产物已验证 | builder 大版本升级（24→26+）需重新出包并手工冒烟安装器 |

## 3. 分步升级草案（小步原则：一跳到最近 LTS 主线）

E 系列偶数为稳定线。从 28 出发，建议两跳：

1. **28 → 30（第一跳）**
   - 变化集中：sandbox 默认值收紧的适配、`app.getPath` 行为微调、Chromium 116→124 渲染差异。
   - 动作：改 `package.json` 精确版本为 `30.x.y` → `npm install` → 全量回归（见 §4）。
   - 重点验证 preload ESM：保留 `sandbox:false` 首跑；若 console 报 preload 加载失败，尝试 `sandbox:true` + preload 改 CJS（electron-vite 输出格式切换）。
2. **30 → 32（第二跳，视 30 稳定后再做）**
   - 变化集中：remote 模块残留清理、默认菜单/权限行为。
   - 此跳前先完成 30 的 3-5 天日常使用观察。

不推荐 28 直接跳 32+：一次引入两层 Chromium/Node 差异，崩溃归因困难。

## 4. 每步回归清单

- **自动化**：`npx vitest run`（1076 条，含 720 日沙盒模拟）+ `npm run verify`（type-check + 全量）。
- **手工冒烟**（每次升级必做）：
  1. 启动：窗口最大化正常、无白屏、地图渲染正常；
  2. 存档读写：三槽各存/读一次，确认 `<slot>.json`、`.json.bak`、`.json.tmp` 行为正确（colony-A 原子写）；
  3. 崩溃重载：devtools 制造崩溃 → 3 次重载后出现 showErrorBox（colony-B）；
  4. 外链：游戏内触发 window.open → 仅 http/https 打系统浏览器（colony-B）；
  5. CSP：console 无 `Content-Security-Policy` 违规报告（colony-B）；
  6. 打包链：electron-builder 出便携包并可启动（升级 builder 时）。

## 5. 风险与回滚

- **风险 1：preload ESM 加载失败**（`src/main/index.ts:51` 注释明示该耦合）。回滚：git revert package.json + lock，`npm ci` 回 28.2.5。
- **风险 2：electron-builder 新版对 NSIS/portable 配置不兼容**。回滚：锁回 builder 24.x，Electron 单独升级。
- **风险 3：Chromium 渲染差异导致 Phaser 画布问题**（项目有最大化 RESIZE 畸变史，见 `src/main/index.ts:100-106` 注释）。回滚同上；冒烟点 1 必查。
- **总回滚方式**：升级在独立分支进行（`codex/electron-30-upgrade`），不合入前不影响主线；存档格式与游戏数据无版本迁移（存档 schema v9 由游戏层自管，与 Electron 版本无关）。

## 6. 待日间联网核实清单

- E28 实际 EOL 日期与 E30/E32 当前补丁版本号；
- electron-vite 对新版 Electron 的支持矩阵；
- electron-builder 26 的 breaking changes（NSIS 配置、签名）；
- E30+ sandbox 默认值与 .mjs preload 的官方兼容声明。
