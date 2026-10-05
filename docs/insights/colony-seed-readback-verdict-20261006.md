# 新建局种子 UI 可读回核查（c1004-09，2026-10-06，只读）

- 承 6938 L3。**现值**：IntroScene.ts:580 `store.startNewGameNpcs(Math.floor(Math.random() * 0x7fffffff))`（矿 :571 漂 +9，语义零漂）——NPC 阵容种子由 **Math.random 现掷、不落任何展示面**。

## 一、二值结论

**rg 展示面命中：零**。全 UI 面（HUD/registry/各 Panel）`rngSeed`/`seed` 命中仅测试注入（ScoreCardPanel.test 等 `{ rngSeed: 20260814 }`）与 gameStore 内部（:216 state 字段/:333 构造/:424 消费），无任何「显示种子/复制种子/按种子开局」入口。

## 二、后果与最小方案

- **后果**：玩家遇到有趣 NPC 阵容/事件序列无法复现（seed 不可知 ⇒ 不可分享、不可回归）；且 `startNewGameNpcs` 的种子**只管 NPC 阵容**，游戏主 RNG seed 在 :333 另有来源（构造入参/默认）——两条种子轴并存，读回设计需先定「要复现哪条」。
- **最小方案**（2 文件估计）：
  1. IntroScene.ts:580 把掷得的 seed 存 `store.state`（或经 startNewGameNpcs 返回/入参透传）——**+1~2 行**；
  2. 设置面板/HUD 帮助区加「本局种子：{seed}（点击复制）」——**+5~8 行**（clipboard API 一行）。
- 扩展（可选，交主班裁）：「按种子开局」输入框（复现入口闭环）——+1 输入框＋startNewGameNpcs(seed?) 参数化，共 ~15 行。
