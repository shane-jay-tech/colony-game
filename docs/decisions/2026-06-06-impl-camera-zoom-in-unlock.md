# Implement: 地图相机解锁放大上限（近景档）

Date: 2026-06-06
Supersedes: 2026-06-05-impl-map-camera-fit-center-drag.md（修订其"放大上限=cover/最大化锁止"的决定）

模式：**deep**（核心渲染/相机模块；resize 路径出过"最大化卡死"，敏感）

## 原始需求（用户原话，非技术用户）

> 你说得都对，其实最大的问题还是我不能放大地图，我觉得至少要能放大到屏幕里面能装下8个建筑的大小吧

诊断：上一版（2026-06-05 v3）把 `getMaxZoom = coverZoom`（铺满整图档 ≈0.3），且该方法同时被当作"放大上限"和"开局/resize 重新 fit 的目标 zoom"。导致玩家放大上限就是铺满档，根本无法看近景，建筑像蚂蚁。

## 架构决策（Opus）

核心难点：`getMaxZoom()` 被**双重使用**——
1. setMapZoom 的放大 clamp 上限；
2. initialZoom() + 两处 refit（rebuildAfterResize / ensureFittedToViewport）+ resetView 的"重新铺满整图"目标。

直接抬高 getMaxZoom 会让一 resize 就跳到近景。**解法 = 解耦**：
- 新增 `getDefaultZoom() = coverZoom`，承接所有"开局/重置/resize 铺满整图"职责（与原 getMaxZoom 返回值字节级等价 → resize 行为零变化，不碰"最大化卡死"敏感路径）。
- 重定义 `getMaxZoom()` 为"近景放大上限"：按 ISO tile 尺寸 + 建筑 footprint + 视口面积算出"约 8 栋建筑填满屏幕"对应 zoom，floor=coverZoom，ceil=MAP_ZOOM_MAX(2.0)。

健康检查：3 relay 全 OK（gpt 11.3s / deepseek 2.8s / kimi 6.4s）。GPT 今日在线。

## GPT-5.5 Pro（主程序员）产出

GPT 给出 6 处精确改动（与设计一致），并附"最不放心的 3 处"：
1. getMaxZoom 退化帧 fallback `max(coverZoom(),1)` 在 coverZoom 自身退化（返回 0.2）时得 1，合理。
2. resetView()→initialZoom()→getDefaultZoom()，重置回铺满档，符合预期。
3. 面积开方公式：1920×1080 算出 ≈2.5 被 cap 到 2.0；1366×768 算出 ≈1.78。数值健全。

GPT 代码片段（节选）：
```ts
export const AVG_BUILDING_TILES = 3;
export const BUILDINGS_ON_SCREEN_TARGET = 8;

getMaxZoom(): number {
  const cam = this.scene.cameras.main;
  const vp = this.computeViewportRect(cam.width, cam.height);
  const cover = this.coverZoom();
  if (vp.w <= 0 || vp.h <= 0) return Math.min(MAP_ZOOM_MAX, Math.max(cover, 1));
  const bw = AVG_BUILDING_TILES * ISO_TILE_W;
  const bh = AVG_BUILDING_TILES * ISO_TILE_H;
  const closeZoom = Math.sqrt((vp.w * vp.h) / (BUILDINGS_ON_SCREEN_TARGET * bw * bh));
  return Math.min(MAP_ZOOM_MAX, Math.max(cover, closeZoom));
}
getDefaultZoom(): number { return this.coverZoom(); }
// initialZoom → getDefaultZoom；两处 refit getMaxZoom() → getDefaultZoom()
```

## DeepSeek V4 Pro（评审官，deep）5 维度复审 — verdict: do-not-ship，5 条 objection

| # | 维度 | finding | Opus 仲裁 |
|---|---|---|---|
| 1 | 设计 | initialZoom()/resetView 若未改仍走新 getMaxZoom→开局跳近景 | **采纳**：GPT 方案已含 initialZoom→getDefaultZoom，落地确认到位 |
| 2 | 边界 | 两处 refit 后未 refreshViewportMask；高 zoom(2.0) 下 mask 错位放大 | **驳回**：refit 用 getDefaultZoom=coverZoom(≈0.3)，**根本不会到 2.0**（DeepSeek 误判）；mask 那半是既有行为 + 在"最大化卡死"敏感路径上，本任务范围外，保守不碰（同 2026-06-05 finding#4 处置） |
| 3 | 安全 | bw/bh=0 或 vp 异常 → 除法得 NaN/Infinity → NaN zoom 冻结渲染器 | **采纳**：加 `if (!Number.isFinite(closeZoom)) return fallback`。bw/bh 是编译期常量虽不可能为 0，但 NaN zoom 是本项目最该防的崩溃类，最廉价保险 |
| 4 | 性能 | getMaxZoom 每次滚轮都重算 coverZoom/computeViewportRect → 微卡 | **驳回**：现有代码本就每帧调 getMaxZoom(=coverZoom)+getMinZoom，新增近乎为零；加缓存反引入 stale 风险到敏感文件，无实测收益 |
| 5 | 可读 | getMaxZoom/initialZoom/常量头旧注释说"max=cover/最大化锁止"，语义已变 | **采纳**：常量头 v4 注释 + getMaxZoom/getDefaultZoom/initialZoom 注释 + ZoomControl 注释全部更新 |

二轮 cross-critique：DeepSeek 报了 #2 这一条偏向 critical 的，但经核验属误判（refit 不会到 2.0），未真正触发"必须二轮改代码"——按 #3/#5 采纳补强后直接落地。

## 最终落地

**改动文件：**
- `src/renderer/render/MapRenderer.ts`：+常量 AVG_BUILDING_TILES/BUILDINGS_ON_SCREEN_TARGET；getMaxZoom 重写为近景公式（含 Number.isFinite 兜底，采纳 DeepSeek#3）；新增 getDefaultZoom()；initialZoom→getDefaultZoom；两处 refit setZoom(getMaxZoom)→setZoom(getDefaultZoom)；注释更新（采纳 DeepSeek#5）。
- `src/renderer/ui/ZoomControl.ts`：refreshZoomText 注释更新，逻辑不动（getMaxZoom 自动正确判"（最近）"）。
- `src/renderer/render/__tests__/MapRenderer.test.ts`：4 处 refit/开局断言 getMaxZoom→getDefaultZoom（语义适配，非放宽）；+1 新测试锁定"getMaxZoom>cover 即放大已解锁 + setMapZoom 能到近景 + 永不 NaN + ≤MAP_ZOOM_MAX"。

**验证：**
- type-check 通过。
- `npm test`：**632 passed (36 files)**（原 631 + 新增 1）。
- `npm run electron:build:win`：成功，刷新 D:\colony-game\dist-out\（win-unpacked + NSIS + portable）。

## 给用户看的摘要（见对话）

解锁放大；refit/开局/缩放围绕中心不变；resize 敏感路径零改动；风险=放到最大可能略糊（位图 sprite 2× 放大）+ 8 这个数可一行调。
