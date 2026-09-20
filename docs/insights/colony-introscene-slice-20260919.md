# colony IntroScene 序章流程薄切片核报（c918-21 / 锚点漂移记录）

> 2026-09-19｜执行班 sweep-20260918-2300｜只读核报（零写码、零测试文件落地），如实 partial。

## 锚点漂移发现（重要）
任务书前提「跳过序章→ModeSelect」出口与「故事 NPC 装配」在当前代码中**不成立**：
1. `grep -n 'ModeSelectScene' src/renderer/scenes/IntroScene.ts` → **零命中**——IntroScene 创建后唯一出口是 `this.scene.start('GameScene')`（:575，立邦按钮流程）；**没有任何回跳 ModeSelectScene 的路径**（ModeSelect 进入 IntroScene 是单向门）。
2. **无「跳过」语义**：`grep -n '跳过|skip' IntroScene.ts` 仅命中防抖注释，不存在跳过按钮/跳过分支。
3. 「故事 NPC 装配」：:563 附近为 Phase1/2 按 ModeSelectScene 选定模式落 state 的预留注释区，非装配实现。

## create() 实际装配顺序（file:line）
- :199 `events.once(SHUTDOWN, shutdown)`（resize 残留防护）
- :202-231 背景 graphics、标题/副标题/背景故事 text
- :234-238 「一、择邦名」标签与提示
- :240-248 DOM 输入框（`<input maxlength=3>`，邦名自取）
- 后续：邦名候选点选 → 国格/起始 modifier → 「立邦」按钮 → registry 写入 → :575 `scene.start('GameScene')`

## 薄切片测试为何未落地
「跳过→ModeSelect」「故事 NPC 装配」两用例的被测行为在码内不存在——按锚点漂移纪律不虚构测试。可测的真实行为＝「立邦按钮 → registry 写入邦名/modifier → scene.start('GameScene')」，但其装配链含 DOM 输入框（add.dom）与多步文本交互，mock 面大，超出本单薄切片预算。

## 下一步最小动作
1. 先由日间裁决产品语义：序章是否需要「跳过→ModeSelect」回流出口（当前单向前瞻设计）。
2. 测试切片改为钉真实行为：「立邦完成 → registry 邦名/modifier 写入 → scene.start('GameScene')」（mock add.dom＋registry＋scene.start，约 2 用例 20 分钟）。
