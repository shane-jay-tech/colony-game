# 2D 散布层 + 视角统一 + 音效收尾（瞄准《法老》/《尼布甲尼撒》）

- 日期：2026-06-01/02
- 模式：/implement deep（核心渲染），Opus 实现 + DeepSeek 复审

## 需求
主理人定标杆《法老》重制/《尼布甲尼撒》手绘等距古城建（纪元1800 是 3D，2D 引擎到不了，已确认）。并精准指出真问题：**建筑是 2.5D 斜视原画、地面是正俯视贴图 → 视角矛盾违和**。另：本轮把音效一并收尾（主理人对 SFX 质量满意）。

## 落地
**W4-A 散布素材**：`scripts/gen_scatter_art.py`（万相 pro，2.5D 单体专用 STYLE_TAIL：斜 45° 同建筑角、单体、黑底、无地面、光右下）生成 10 个：树×4(松/槐/桑/柳)、石×2、灌木×2、芦苇、草丛。`scripts/postprocess_sprites.py`（通用化自 buildings 版）扣黑底→透明 + 贴地接触影。森林贴图从"树冠俯视"改为"林地地表"（forest 改由一棵棵树表现）。原图备份 art-library/scatter_raw（gitignore）。

**W4-B 散布渲染**：`data/scatterConfig.ts`（每地形密度/素材表：forest 密集树、plain 稀疏灌木孤树、hills 石、mountain 石、river 仅边缘芦苇）。`MapRenderer.bakeScatter` 构造时一次性确定性烘焙（`makeTilePrng` 复用，同 seed+tile→同布局、存档重载不变）进 `scatterRT`（深度 -5，地貌-10 与建筑0 之间）：逐 tile roll slot → 选素材 + jitter + 缩放抖动 + 50% 翻转 → beginDraw/batchDraw(复用 tmp Image)/endDraw。缺素材优雅降级（不建 RT）。建筑层(0)自然盖住其下散布=清地建房。BootScene 加载 scatter；导出 makeTilePrng。

**这如何化解违和**：森林=一棵棵 2.5D 树（同建筑角），平原点缀同角灌木石，整个"立起来的世界"统一斜视 → 地面退化为地板，眼睛不再纠结地面视角；散布同时遮地形硬边接缝。离线 Python 模拟整图预览确认：森林成有机林、建筑embedded其中、协调度明显提升（《法老》方向）。

**音效收尾**：AudioManager BGM 切歌从硬切改 **淡入淡出过渡**（旧曲淡出后停、新曲从 0 淡入，FADE_MS=900）；fadeTweens 在 destroy 时停掉防回调泄漏。SFX 维持（主理人满意）。

## DeepSeek 复审（do-not-ship → 修后过）
1. [critical 标级] 散布 `draw()` 未包 beginDraw/endDraw → 实测 draw() 本身即时安全，但逐个 4k 次 = 4k 次 GPU flush 且与 terrain 不对称 → **改 beginDraw/batchDraw/endDraw 批绘**（batchDraw 即时拷顶点，复用 tmp 安全）。**采纳**。
2. [major] scatterRT 尺寸变化不重建 → 加守卫（与 terrain 对齐）。**采纳**。
3. [major] 巨图 RT DoS → **驳回**：mapGen MAX_DIM=200 已限，terrainRT 同等暴露非散布独有，单机无外部地图。
4. [major] 性能逐个 draw → 由 #1 批绘解决。
5. [minor] 可读性/"river 截断" → river 代码完整（导出片段截断假象）；tmp 复用是标准烘焙范式。保留。
- 确定性：DeepSeek 确认每 tile 独立 makeTilePrng、分支不串扰，无隐患。

## 验证
- type-check 零错；npm test 628 全绿（+散布确定性/降级 2 测试 + 既有）。
- 离线模拟预览：森林一棵棵树/平原点缀/河岸芦苇/建筑接触影 embedded，违和明显降。
- 缺素材优雅回退（无散布不报错）。

## 风险
- 仍是"地面正俯视 + 建筑/散布斜视"——散布把违和降到《法老》级可接受，但未 100% 消除；要彻底消需真等距地面重写（坐标/拾取/相机，重型，列后续可选）。
- plain 地貌贴图偏密（干草感），叠草丛散布略busy——scatterConfig 密度集中常量，playtest 后可调。
- 散布素材每类 1 张，重复靠 jitter/翻转/缩放破；密集森林近看仍有重复感。
- BGM 仍带免费档水印（去水印需付费重生成，待主理人定）。

## 待主理人
- 跑起来看协调度是否到《法老》级；不够再决定要不要上"真等距地面"重型大改。
- 散布密度/plain 调色手感（scatterConfig 一处可调）。
