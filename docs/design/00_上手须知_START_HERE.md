# 邦国录 · 接手开发者上手须知（START HERE）

> 你接手的是一款**春秋立国题材的策略经营游戏**（Electron + TypeScript + Phaser）。
> 当前 = v0.10.0，**能跑、1050 测试绿、type-check 干净**；系统广度已铺得很开（见下方第 4 节"当前状态速览"已更新），完整愿景在设计稿里。
> **最大的债不是代码，是从未真人 playtest（好不好玩未验证）**。先花 30 分钟读完本页，再动手。

---

## 1. 先读什么（按顺序）

1. **本页**（上手须知）。
2. **`docs/design/GAME_DESIGN_LIFECYCLE.md`** ← **设计圣经，最重要**。10 节玩法 + 1 节非玩法质量，带文件路径锚点、验收标准、4 期路线图。
   - 第 0 节有"给实现 agent 的说明"；第 9.1 节是"v1.0 已有 vs 待建"的**完成度差距地图**（先看这个建立全局认知）；第 10 节是**分期路线图（从这开干）**。
3. **`docs/design/_tianxiaren_source.md`** = 故事模式剧本源（小说《天下人书记》七卷），故事内容直接取材于此。
4. **`docs/decisions/`** = 历次决策/团队压测归档（想知道"为什么这么定"时查）。
5. 根目录 **`CLAUDE.md`**（如有）= 协作与项目规则。

---

## 2. 怎么跑起来

```bash
npm install            # 装依赖
npm run dev            # 开发模式（electron-vite，热更新）
npm test               # 跑测试（vitest，1021 条必须全绿）
npm run type-check     # TS 类型检查（必须 0 错误）
npm run verify         # = type-check && test，提交前跑这个；已装 git pre-commit 钩子自动拦截
npm run electron:build:win   # 打包 Windows 桌面 exe → dist-out/win-unpacked/邦国录.exe
```

技术栈：Phaser 3.70（游戏渲染）/ Electron 28 / electron-vite / TypeScript。
源码在 `src/`（`main` 主进程 / `preload` / `renderer` 游戏本体）。

---

## 3. 铁律（不可违反，违反必被打回）

1. **测试不破 + type-check 干净**：改完跑 `npm run verify`（= type-check && 1021 测试）全绿；新功能补测试。已装 git pre-commit 钩子，红了拦截提交（勿用 `--no-verify` 绕过）。
2. **每次代码落地后**跑 `npm run electron:build:win`，让 `D:\colony-game\dist-out\win-unpacked\邦国录.exe` 始终最新（桌面 .lnk 不用改）。
3. **文案半文半白**：保留古典韵味但**禁偏字**——玉圭/卿大夫/贵胄/弑/无嗣/耒耜/王畿/方伯/泗水/海岱 等一律不用，非历史专业玩家要一遍看懂。
4. **地图无格线**：渲染层必须像《纪元 1800》，底层可方格但视觉上**完全无格线**（已明确否决"小作坊"程序化色块）。
5. **美术质量基线**：单看一帧不能让人判断成简陋小作坊（参照纪元气质）。生成管线见 `D:\code\scripts\gen_wanxiang_batch.py`（通义万相 wan2.7-image-pro，1664²，春秋校正 prompt）。
6. **Windows 编码**：`.bat` 必须 GBK + CRLF（UTF-8/LF 会崩中文）；**console 输出禁 emoji**（GBK 码页不支持，用 ASCII 标记，emoji 只放 markdown）。
7. **删缓存/二进制目录前先 grep tests/scripts/CI**（运行时依赖常只在测试出现）。

---

## 4. 当前状态速览（详见设计稿 9.1）

- 🟢 **已跑通**：资源/建筑(35)/国策(23)/朝令(12)/事件(沙盒40+故事23)/邦交(NPC动态成长)/存档(游戏内三槽 UI)，**1021 测试 + type-check 干净**。
- 🟢 **原"待建"现已落地**（本节 2026-06 大更）：国格阶梯(6级)、动态邻国(合纵/朝贡/挑拨)、故事模式(七卷23剧情事件+56报文+三结局)、手感(季节色调/雪花粒子/散布层/呼吸历史官)、史官谏言引导、**动态音乐(BGM 已接入并按国格/危机/结局切换，非静音；见 AudioManager/audioDirector)**。
- 🟢 **存档扎实**：`saveLoad.ts` 有版本号 + 迁移 + 校验。
- 🟡 **美术覆盖仍稀缺**：约 10-15% 建筑质量达标（民居/兵营/祖庙等），其余占位；人物/地形基本无。
- 🔴 **最大暗雷仍未解**：**从没真人 playtest，"好不好玩"完全未验证**；经济/故事时长一堆数值标着"待试玩校准"。继续叠系统前，强烈建议先跑一次 2-4h 自测。

---

## 5. 从哪开始（路线图 Phase 1 · 沙盒先行）

按设计稿第 10 节，**先做出"能玩的 8 小时沙盒切片"尽早 playtest**：
国格阶梯系统 → 8h 经济重平衡 → NPC 动态成长 → 失败模型重写（去肉鸽，见第 7 节）→ 模式选择外壳。
验收：能从聚落爬到天下共主、8h 不崩盘不无聊、501 测试适配后全绿。

> 故事模式 / 音乐 / 美术大批量都排在后面的 Phase，别一上来全吃。

---

## 6. 关键文件地图

| 要改什么 | 去哪 |
|---|---|
| 资源/Modifier 注册 | `src/renderer/data/resourceRegistry.ts` |
| 建筑 / 国策 / 朝令 / 事件 / 邦交 / 失败 | `src/renderer/data/{buildings,policies,decrees,events,npcCountries,defeat}.ts` |
| 核心循环/状态/各 System | `src/renderer/state/`（gameStore/timeSystem/*System.ts） |
| 渲染 / 场景 / UI | `src/renderer/{render,scenes,ui}/` |
| 美术资产 | `public/art/`、`art-library/` |
| 音乐生成脚本 | `scripts/gen_music.py`（已验证可用） |

---

## 7. 外部服务 / 密钥

- **音乐 = Mureka**（昆仑万维 `api.mureka.cn`，国内支付）。key 在 **`.env.local` 的 `MUREKA_API_KEY`**（已 gitignore，勿提交）。
  - 生成：`POST /v1/instrumental/generate`；查询：`GET /v1/instrumental/query/{id}`；脚本 `scripts/gen_music.py`。
  - 商用授权 ✓；**水印在音频尾部**（合规标识，**别强删**）——循环 BGM 设循环点避开结尾即可，玩家听不到。
  - 曲目清单见设计稿 11.A.1。
- **音效 = Freesound.org**（免费 CC 素材）；**公版古曲**打底。

---

**一句话**：读 `GAME_DESIGN_LIFECYCLE.md`（尤其 9.1 差距地图 + 第 10 节路线图）→ 守住第 3 节铁律 → 从 Phase 1 沙盒切片动手 → 尽早 playtest。

---

## 8. 2026-08-14 信息可视化与目标感批次（本轮已落地）

- **P1 信息可视化**：供需速率面板（点顶栏资源数字开「国计 · 每日出入」：日产/日耗/净变 + 入不敷出补阙因果链 + 民足系数行）；升格目标面板（点国格徽章开「升格之途」：下一格还差什么逐项打勾）；供应链提示纯函数 `state/supplyChain.ts`；`computeDailyRates` 与生产 tick 同源口径。
- **P2 目标感**：终局记分牌（`state/scoreCard.ts` 多维功业计分 + `ui/ScoreCardPanel.ts`，HUD「记」入口；登顶/三结局自动结算；历史最高分存 localStorage 不进存档 schema）。
- **P3 故事填肉**：七卷剧情事件 23→35（每卷恰 5 条，取材小说高光场景：公道站起/碑下之土/烧刀子/以人为镜/会跑的车/北境抢矿/偏殿一顿饭/少一笔的字/病中一问/书记官/七日七夜/定稿之册）；copyBias 禁偏字守护扩展到故事事件。
- **无头模拟 harness 修复 + 多策略**：起始资源走 initialState 同步农民阶层（旧 harness 0 农民致农田建不了）；摆放死锁修复；均衡策略（产布）第 53 天到邦国——国格阶梯可达性有了实证。
- 测试 1036 → 1050；版本 0.9.0 → 0.10.0。
- **待办**：麻田/锡矿 2 张建筑图（缺 WANXIANG_API_KEY 未生成）；P1 架构剩余项；真人 playtest（P1+P2 落地后阶段验收）。

## 8b. 2026-08 硬化与扩展批次（此前已落地）

- **仓库/分发**：代码与存档已备份至私有仓库 `github.com/shane-jay-tech/colony-game`（分支 `codex/architecture-hardening` 领先 master）；`npm run electron:build:win` 全链路跑通，产出 `dist-out/` 下 0.9.0 安装版/便携版/win-unpacked。国内网络需显式注入镜像：
  `$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'; $env:ELECTRON_BUILDER_BINARIES_MIRROR='https://npmmirror.com/mirrors/electron-builder-binaries/'`
- **存档**：SchemaVersion 已推进到 **v8**（迁移链 v1→v8 完整，旧档自动补齐新字段）；游戏内三槽存档/读档 UI。
- **架构硬化**：tickDay 每日阶段抽取为 `dayPipeline` 单一事实源；事件面类型化（`stateEvents.ts` 的 `GameStateEventMap` + 泛型 on/off/emit）；存档引擎沿用旧有深度校验。
- **手感/内容扩展（benchmark 采纳）**：双轴民心（民心/怨愤+颂声/民变）、阶层需求环、列国警惕值（合纵闸门）、影响力/史官三用（宣传/斡旋/修史）、加工链中间品（麻/锡）、古迹事件链（古战场/古祭坛/古矿坑）、登顶后终局波次压力阶梯。详见 `BENCHMARK_INSPIRATION.md` 与 `OPTIMIZATION_BACKLOG.md`。
- **自检闸门**：无头 720 日沙盒模拟 `sandboxSimulation.test.ts`——改数值必重跑；当前模拟显示「第 40 天晋城邑、37 栋建筑、26 次敌对张力」。
- **仍未完成（待办）**：P0-3 主包 7.4MB 性能拆分；P1 逐订阅点渐进迁移；中期粮/人口数值的真人试玩校准。
