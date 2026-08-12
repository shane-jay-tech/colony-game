# 2026-06-03 · 等距地图综合修复：相机概览缩放 + 缩放下限锁止 + 地形可辨识

**模式**：/implement，core 模块（MapRenderer 相机/渲染）→ DeepSeek `--mode deep` 复审。health_check：GPT/DeepSeek/Kimi 全绿。

## 原始需求（用户原话）
- "看看还存在哪些问题，统一进行修复"
- "另外解决一下我说的地图认知压力大的问题"（色块认不出代表什么）
- "地图太小我指的是真的太小了，放不了几个建筑，不足以支撑游戏游玩，不是比例上面的大小"
- "另外我说的地图最大之后的锁止你也没加"

## 诊断
1. **"地图太小放不了几个建筑"**：地图实为 80×80 = 6400 格，约七成可建（≈4400 格，足够放数百栋 2×2~4×4 建筑），placementSystem 也无任何领土/范围限制。真因是**开局 zoom=1，等距大瓦片下只看到约 10 格**，玩家误以为没地方。
2. **"地图最大锁止没加"**：setMapZoom 其实已 clamp 到 fitMinZoom（缩到看全图就锁），但 **ZoomControl 的"（最远）"指示器用的是名义常量 MAP_ZOOM_MIN=0.5**，而真实下限是 fitMinZoom≈0.15 → 玩家缩到底也永远看不到"最远"提示，感觉"没锁止"。
3. **"认知压力大"**：terrainColor 原色板五型色相接近（河泽是棕色 WOOD_LIGHT，完全读不出是水）。

## 改动
- `mapColors.ts`：五型地形改成清楚分开的色相——平原 0xd9c79a 暖米 / 丘陵 0xb07d3e 赭 / 林地 0x4f7a45 绿 / **河泽 0x3f6f8f 水蓝**（关键）/ 山岳 0x8c8782 岩灰。Legend 图例同源（调 terrainColor）自动同步。
- `MapRenderer.ts`：
  - 新增 `initialZoom()`：开局/重置用"概览缩放" = clamp(fitMinZoom×1.8, fitMinZoom, 0.6)，一进游戏就看到大片可用空地，破除"太小"错觉，格子仍够大可直接落建筑。构造 + resetView 应用。
  - 新增 `getMinZoom()`：暴露真实缩放下限（=fitMinZoom）给 UI。
  - 魔法数提为 `OVERVIEW_ZOOM_FACTOR=1.8` / `OVERVIEW_ZOOM_CAP=0.6` 常量。
  - **rebuildAfterResize 重夹 zoom**（DeepSeek Finding 1）：视口变大后旧 zoom 可能 < 新 fitMin → 露黑边/显小；跌破 fit 时回概览缩放并重居中，否则保留用户缩放只重夹 scroll。
- `ZoomControl.ts`："（最远）"判定改用 `r.getMinZoom()`（替代 MAP_ZOOM_MIN），移除未用 import。

## DeepSeek 复审（deep 档，5 维度）
- **Finding 1 (Major) — 采纳**：resize 后概览缩放失效，旧 zoom < 新 fitMin 致黑边+显小。→ rebuildAfterResize 加 zoom 重夹（核心修复，正对应用户反复报的"放大缩小不居中/显小"）。
- **Finding 2 (Major) — 判为预期行为，驳回**：setMapZoom 锚点在地图边界被 clampScroll 拉回会破坏锚点世界坐标。这是**有界相机的正确行为**（不能滚出地图边，每个 RTS 都如此），且本作是离散滚轮步进非平滑插值，抖动不显著。不改。
- **Finding 3 (Minor) — 采纳**：魔法数提常量；MAP_ZOOM_MIN "名存实亡" → ZoomControl 改用 getMinZoom()，并在常量处加注释说明真实下限是 fitMinZoom。

## 验证
- type-check 0 错；npm test **627 passed**（+3 新回归：大图开局概览缩放≥下限 / resize 把过小 zoom 拉回 / 高于下限的用户缩放不被动）。
- electron:build:win 重建（桌面 .lnk 指向 dist-out/win-unpacked/邦国录.exe 自动最新）。

## 给用户的摘要（见对话）
结论 + 改了什么 + 风险≥2 + 反方 + 置信度 + 本归档路径。

## 追加修复（同日，用户实测截图反馈"一上来地图缩在右下角、左上一片黑、没居中"）
**根因**：开局窗口从 1366×800 **自动最大化**到 1920×1080 触发 resize；`recenter()` 重算 origin 并平移图层，但**没同步相机 scroll**——scroll 仍是构造时按旧视口算的，导致地图整体偏出右下角。我上一轮的 zoom 重夹 `else` 分支只 clampScroll（收边），不重新居中。
**修复**：
- 新增 `viewportCenterTile()`：算出 resize 前视口中心对准的格子（超界夹回边界，不返回 null）。
- `rebuildAfterResize` 改为：记焦点格 → recenter → （必要时）zoom 回概览 → `centerOnTile(焦点格)` 重新对准相机。用格子坐标做锚，origin/zoom 怎么变都能正确回中；用户已滚动到某处再 resize 也保留视角。
- 回归测试 +1（628）：模拟开局 1366→1920 最大化后，地图中心 tile 屏幕坐标必须落在中央 25%~75% 带内（不被推到角落）。
- 地形配色、缩放下限锁止、概览缩放本身经截图确认已生效（色块分明、HUD 显 ×0.3 概览）。

## 待用户实测（无显示器，无法目视确认）
开局是否看到大片空地（不再觉得太小）/ 缩到底是否显示"（最远）"/ 河泽是否一眼是蓝水 / 反复最大化↔还原是否不再黑边显小。
