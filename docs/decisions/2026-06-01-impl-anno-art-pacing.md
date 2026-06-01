# 向纪元1800看齐：美术质感 + 节奏放慢

- 日期：2026-06-01
- 模式：/implement deep（核心渲染 + 平衡），Opus 实现 + DeepSeek 复审
- 健康检查：relay 全绿（本轮 deepseek 复审已用）

## 需求
主理人：① 美术离纪元1800差距大（"特别是美术"）② 时间流逝 + 事件频率太快，都参考纪元1800。选定 美术 A+B、节奏纪元式沉稳。

## 定位（三真因）
- 建筑黑底方块贴图（不融入地面）；地面是 fillRect 色块（非手绘）；时间 250ms/天 + 事件无冷却接二连三。

## 落地
**W1 节奏**：`balanceConfig.time.msPerDay` 250→1400（5.6×慢，BALANCE+STORY 双表）；新增 `event.minDaysBetween`（沙盒50/故事40）。`GameState.lastEventDay` + saveLoad 三同步 + 3 fixture；tickDay 采样前加冷却闸，resolveEvent 结算写 lastEventDay。开局 50 天平静（有意）。

**W2 建筑扣底+投影**（零额度）：`scripts/postprocess_buildings.py`（Pillow）——多边缘点 floodfill 扣近黑 void→透明（保留内部暗部）+ alpha 剪影生成柔和投影。全 20 栋，原图备份 `art-library/buildings_raw/`。抽检水井/铁坊/祖庙/王宫合成草地预览均无黑残留、自然坐落。

**W3 手绘地貌**：`scripts/gen_terrain_art.py`（万相 pro，地貌专用 STYLE_TAIL：俯视/可平铺/均匀光照/无建筑）生成 5 型 `public/art/terrain/<type>.png`（plain/hills/forest/river/mountain，5/5 一次过）。`MapRenderer.bakeTerrain` 新增 RenderTexture 路径：贴图切 42×42 个 24px frame，逐 tile `tile%grid` 连续采样 batchDrawFrame 进单 RT（beginDraw/endDraw 批绘）；任一类型缺贴图 → 回退原 fillRect 色块（全有或全无优雅降级）。RT 接 viewportMask/recenter/destroy。离线 Python 模拟预览确认平铺连续、手绘质感、建筑透明坐落。

## DeepSeek 复审（do-not-ship → 修后通过）
1. [critical] frame 缓存命中未验 frame 仍在（贴图重建会丢）→ 加 `tex.has('t_0_0')` 校验，丢则重切。**采纳**。
2. [major] 损坏存档 lastEventDay 超大 → 事件永久不触发 → deserialize clamp 到 [0,currentDay]。**采纳**+测试。
3. [major] O(W×H) 扫描每次 bake → **驳回**：bakeTerrain 仅构造时跑一次，非每帧。
4. [major] map dims 变 RT 尺寸不更新 → dims 实例内不可变，但加廉价尺寸守卫重建。**采纳（轻）**。
5. [minor] terrainSliced Set 死代码 → 删。**采纳**。
6. [major] 回退路径旧 RT 残留透出 → 回退时 clear+setVisible(false)。**采纳**。

## 验证
- type-check 零错；npm test 626 全绿（新增 RT 烘焙 2 测试 + 事件冷却 + clamp）。
- 离线模拟预览：地貌连续手绘、建筑透明带投影坐落。

## 风险
- 地形类型边界是硬切（瓦片引擎非纪元 3D 混合），但游戏内地形是有机色块形状非方块，观感可接受；若要边缘羽化是后续大改。
- 贴图每 42 tile 重复一次，80 地图有 1-2 条接缝线，手绘纹理基本盖住。
- 节奏 1.4s/天 + 50 天冷却为初版锚点，最终手感待 playtest（集中常量一处可调）。
- BGM 仍带免费档水印（沿用上一轮）。

## 待主理人
- 跑起来看地貌拼缝/整体质感 + 节奏手感，不满意我调 prompt/旋转/降级/常量。
