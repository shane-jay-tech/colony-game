# 邦国录

春秋战国题材的小邦国经营游戏。你从一座聚落起步，种田、立市、修国策、会盟邻邦，一步步爬上「城邑 → 邦国 → 诸侯 → 霸主 → 天下共主」的国格阶梯；也可以走进故事模式，亲历从春秋到大梁「拆龙椅」的长线叙事。

技术栈：TypeScript + Phaser 3.70 + Electron 28 + electron-vite。

## 玩法速览

- **双模式**：沙盒（8 小时自由经营）与故事（七卷 · 三结局）。
- **经营核心**：8 资源 + 35 建筑 + 23 国策 + 12 朝令 + 事件与邦交。
- **2026-08 扩展**：双轴民心、阶层需求环、列国警惕值、影响力/史官三用、加工链中间品、古迹事件链、登顶后的终局波次。
- **v0.10 目标与信息可视化**（本次更新）：
  - 点资源数字开「国计 · 每日出入」面板——每种资源日产/日耗/净变一目了然，入不敷出时附补阙因果链（缺布→建桑园）。
  - 点顶栏国格徽章开「升格之途」面板——下一国格还差什么（人口/资源/标志成就）逐项打勾。
  - 顶栏「记」开「功业记分牌」——多维功业计分 + 历史最高；登顶天下共主或故事结局时自动结算。
  - 故事模式七卷剧情事件 23→35 条（每卷 5 条，取材小说高光场景）。
- **存档**：游戏内三槽存档/读档，schema v8 带完整迁移。

## 运行

```bash
npm install          # 安装依赖（.npmrc 已配置 npmmirror）
npm run dev          # 开发模式（热更新）
npm test             # 1050 条测试（vitest）
npm run type-check   # TS 类型检查
npm run verify       # type-check + 全部测试
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

## 操作

- 建造：从顶栏「朝堂/邦交/军务/大业」进入对应面板，选中建筑放到地图
- 时间：顶栏右侧 `||` 暂停、`>`/`>>`/`>>>` 调速
- 存档：顶栏「档」按钮
- 典册：顶栏「?」（新手引导/百科）

## 文档

- `docs/design/00_上手须知_START_HERE.md`：接手开发速览
- `docs/design/GAME_DESIGN_LIFECYCLE.md`：完整游戏设计
- `docs/design/BENCHMARK_INSPIRATION.md`：六款标杆游戏调研与扩展方案
- `docs/design/OPTIMIZATION_BACKLOG.md`：成品化待办与验收标准

## 开发纪律

1. `npm run verify` 全绿才提交（已装 pre-commit 钩子）。
2. 每次代码落地后刷新 `dist-out` 的 exe。
3. 改存档结构必须递增 `SAVE_SCHEMA_VERSION` + 迁移 + 旧档回归。
4. 文案半文半白、禁偏字；UI 字号 ≥14px；地图渲染层不得出现格线。
