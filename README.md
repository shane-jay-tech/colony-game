# 邦国录

春秋战国题材的小邦国经营游戏。你从一座聚落起步，种田、立市、修国策、会盟邻邦，一步步爬上「城邑 → 邦国 → 诸侯 → 霸主 → 天下共主」的国格阶梯；也可以走进故事模式，亲历从春秋到大梁「拆龙椅」的长线叙事。当前版本 v0.10.0。

## 技术架构

- TypeScript + Phaser 3.70 渲染与游戏逻辑
- Electron 28 + electron-vite 桌面打包
- vitest 测试与 tsc 类型检查
- free-tex-packer 精灵图打包、脚本化图标与素材后处理
- `.npmrc` 已配置国内镜像，依赖安装默认走 npmmirror

构建产物、依赖和本地缓存均被 Git 忽略；`dist-out/` 只用于本地发布。

## 环境要求

- Node.js 20+
- npm
- Windows 打包依赖：Git Bash、网络可访问 npmmirror 镜像

安装依赖：

```bash
npm install
```

## 启动

开发模式（热更新）：

```bash
npm run dev
```

仅构建、不打包：

```bash
npm run build
```

## 打包（Windows）

国内网络需显式注入镜像环境变量：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'
npm run electron:build:win
```

产物在 `dist-out/`：

- `邦国录-0.10.0-x64.exe`：安装版（带卸载器）
- `邦国录-0.10.0-portable-x64.exe`：免安装便携版，发给朋友最方便
- `win-unpacked\邦国录.exe`：免安装直启

## 玩法与系统

- **双模式**：沙盒（8 小时自由经营）与故事（七卷 · 三结局）。
- **经营核心**：8 资源 + 35 建筑 + 23 国策 + 12 朝令 + 40+ 沙盒事件与邦交。
- **2026-08 扩展**：双轴民心、阶层需求环、列国警惕值、影响力/史官三用、加工链中间品、古迹事件链、登顶后的终局波次。
- **v0.10 信息可视化**：
  - 点资源数字打开「国计 · 每日出入」面板——每种资源日产/日耗/净变一目了然，入不敷出时附补阙因果链（缺布 → 建桑园）。
  - 点顶栏国格徽章打开「升格之途」面板——下一国格还差什么（人口/资源/标志成就）逐项打勾。
  - 顶栏「记」打开「功业记分牌」——多维功业计分 + 历史最高；登顶天下共主或故事结局时自动结算。
  - 三幕大事件时间轴（群狼环伺 → 诸侯会盟 → 末世裂变）；怨愤 ≥85 触发民愤通牒倒计时。
  - 故事模式七卷剧情事件 23 → 35 条（每卷 5 条，取材小说高光场景）。
- **存档**：游戏内三槽存档/读档，schema v9 带从 v1 起的完整迁移。

## 操作速查

拖动平移 · 滚轮缩放 · 空格暂停 · `>` / `>>` / `>>>` 加速 · 顶栏「?」典册 · 顶栏「档」存档 · 顶栏「记」功业。

## 验证与质量

```bash
npm test             # 1076 条测试（含故事全流程无头试玩、存档 v1→v9 迁移回归）
npm run type-check   # TypeScript 类型检查
npm run verify       # type-check + 全部测试
npm run pack-sprites # 重新打包精灵图
npm run postprocess-png # AI 素材 PNG 后处理
```

开发纪律：

1. `npm run verify` 全绿才提交（已装 pre-commit 钩子）。
2. 每次代码落地后刷新 `dist-out` 的 exe。
3. 改存档结构必须递增 `SAVE_SCHEMA_VERSION` + 迁移 + 旧档回归。
4. 文案半文半白、禁偏字；UI 字号 ≥14px；地图渲染层不得出现格线。
5. 色板、字号与禁偏字由测试永久守护。

## 已知待办

- 麻田/锡矿 2 栋建筑暂用占位图。
- 8 小时沙盒曲线与国格节奏数值待真人试玩校准。

## 文档

- `docs/release-notes-v0.10.0.md`：v0.10.0 发行说明
- `docs/design/00_上手须知_START_HERE.md`：接手开发速览
- `docs/design/GAME_DESIGN_LIFECYCLE.md`：完整游戏设计
- `docs/design/BENCHMARK_INSPIRATION.md`：六款标杆游戏调研与扩展方案
- `docs/design/OPTIMIZATION_BACKLOG.md`：成品化待办与验收标准
- `docs/design/PLAYTEST_CHECKLIST.md`：试玩记录表

## 目录

```text
src/main/        Electron 主进程
src/preload/     预加载桥接
src/renderer/    游戏渲染层（场景、状态、UI）
scripts/         图标、精灵、素材与打包脚本
docs/            设计、发行说明与试玩文档
resources/       打包资源
public/          静态资源
```
