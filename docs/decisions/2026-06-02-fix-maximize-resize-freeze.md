# 根治最大化↔窗口切换卡死 + 地貌重复 + 资源点方块

- 日期：2026-06-02
- 模式：bug 修复 + Kimi 调研 consult + DeepSeek 复审

## 问题
用户实测：静态最大化/静态窗口均正常，**仅"最大化↔窗口化切换瞬间"**画面畸变 + 点不中 + 不可恢复（必重开）；鼠标可动。另：截图美术仍违和（地面谷物行平铺重复明显 + 资源点刺眼方块）。

## 根因（Kimi+训练知识 consult 定位）
Phaser `Scale.RESIZE` 自带 window.resize 监听，在 Electron maximize/unmaximize 切换瞬间吃到退化中间帧（0×0/旧尺寸/DPR 抖），污染 ScaleManager 内部 displaySize → 画布缓冲与显示尺寸/宽高比脱钩、畸变且不自愈（refresh 救不回）。

## 修复
1. **主进程**（main/index.ts）：监听 `maximize`/`unmaximize`/`resize`，用 `getContentSize()` 把**最终稳定尺寸**经 IPC `'window-resized'` 推给渲染层；ready-to-show 后 +500ms 再补推一次（防订阅竞态，DeepSeek critical）。
2. **preload**：暴露 `onWindowResized(cb)`。
3. **渲染层**（main.ts）：`game.scale.stopListeners()` 停掉 Phaser 自动 resize（连带失去 visibilitychange 背景暂停——已 backgroundThrottling:false + 自带暂停，可接受）；收到 IPC 后尾随防抖 80ms 调 `game.scale.resize(w,h)`（非 refresh）。非 Electron 回退 ResizeObserver。
4. **MapRenderer.rebuildAfterResize**（持有 accessor）：recenter + 重烘焙 terrain/scatter/nodes RT（清切换可能污染的 framebuffer）。GameScene.handleResize debounce 触发，并清掉冗余安全网（DeepSeek perf：避免一次 resize 重烘焙两遍）。
5. **美术**：5 型地貌重生成"无行列/无方向有机随机"版（wan2.7-image），消除平原谷物行式可见平铺重复；资源点从刺眼实心方块改小柔半透明菱形 pip + 高光。

## DeepSeek 复审（ship-with-fixes）
- [critical] 启动 IPC 竞态 → 加 +500ms 补推。**采纳**。
- [perf] debounce 未清安全网致双重 rebuild → debounce 内清安全网。**采纳**。
- [design] stopListeners 移除全部 window 监听 → 文档化权衡（仅失背景暂停，可接受）。**采纳(文档)**。
- [leak] cleanup 未存 → 本作不重建 Phaser.Game，N/A。**驳回**。
- nits：记录。

## 验证
- type-check 零错；npm test 628 全绿。
- exe 重建。**最大化切换卡死需用户机器实测**（无显示器无法复现）；机制层已切断退化帧污染路径。

## 待用户
- 实测：① 反复最大化↔还原切换是否还卡死/畸变？② 地面重复感是否降低？
- 深层违和（2.5D 建筑 vs 俯视地面）未根治——真解需等距地面重写（重型，待用户拍板）。
