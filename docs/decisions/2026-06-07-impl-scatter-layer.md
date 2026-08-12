# Implement: 地形散布层(W4 渲染) + 弹窗相机变即关

Date: 2026-06-07

## 原始需求
> 继续吧，不在这个问题上纠结了（→ 推进地形质感）

## 弹窗（前置收尾）
三次没治好"飘移/闪动/缩放乱跑"后，改为**确定方案**：相机一动（zoom/scroll 变）就关 popover（GameScene.update 每帧比对 cam.zoom/scrollX/scrollY，变了就 hide；点击不移相机故开窗当帧不误关）。撤掉每 tick 重绘 + 跟随定位（坐标换算反复调不对）。

## 散布层（W4）—— 本轮主体
**重大发现**：scatterConfig.ts（SCATTER_BY_TERRAIN/RIVER_EDGE/ALL_SCATTER_IDS）+ BootScene 加载钩子 + 一批散布美术**早就存在**（上一轮 deferred 的只是渲染）。但旧美术**带方形土座**（用户嫌弃的色块感）。

做法：
1. **美术**：用 gen_scatter.py（D:\code\scripts）迭代提示词，去掉"isometric tile"措辞改"free-standing cut-out sprite, NO base/platform"，出**无座剪影**的柏树 + 石堆；key_black_bg 抠透明，覆盖 tree_pine/rock_cluster/rock_boulder；删掉其余带座旧美术（回头补剪影版）。
2. **渲染**：MapRenderer.bakeScatter()——按 SCATTER_BY_TERRAIN 每 tile 确定性 PRNG（createRng，per-tile 种子）roll 每个 slot，命中则从 pool 选有素材的项，jitter+缩放抖动+50%翻转，绝对坐标精灵，setDepth(基底世界y) 与建筑精灵正确穿插，viewportMask 裁剪。**一次性烘焙**（地形静态）；resize 由 recenter() 平移（同建筑精灵，避开 resize 敏感路径，不在热路径）。缺素材 pool 项自动跳过。

## 验证
type-check 干净；`npm test` **647 passed**；`electron:build:win` 成功。
未单独 DeepSeek：bakeScatter 与 bakeResourceNodes/建筑精灵同模式、一次性烘焙、缺图安全跳过、按 recenter 平移避开 resize 敏感路径；视觉留用户眼验。

## 现状/待续
- 现有素材仅 tree_pine + rock_cluster/boulder（剪影版）→ 林地撒柏树、山岳/丘陵撒石；平原/灌木/河岸的 pool 项已删（缺图跳过）→ 待补剪影版（tree_locust/willow/mulberry、bush、grass、reed）丰富。
- 地形本体仍是纯色菱形（地貌贴图未做，怕碰 iso 畸变）；河流硬边、黑底悬空仍待。

## 给用户摘要
林地现在长柏树、山岳丘陵有石堆（之前空地撒了自然散布，告别纯色块）；弹窗改为相机一动就关，不再飘闪。
