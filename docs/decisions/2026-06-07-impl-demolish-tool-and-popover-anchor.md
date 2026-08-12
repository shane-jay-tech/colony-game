# Implement: 独立拆除工具(纪元式) + 修弹窗定位

Date: 2026-06-07
Supersedes: 2026-06-07-impl-demolish-building.md（弹窗内拆除按钮改为独立工具）

模式：deep（核心交互）

## 原始需求（用户原话）
> 我觉得可以像纪元1800那种，做一个专门的拆卸工具，不要让我点开建筑之后才能拆除；另外点开建筑之后的详细页面位置也很诡异

## 诊断
- 上轮把拆除做成了 popover 里的按钮（要先点开建筑）——用户要的是 Anno 式独立拆除工具（激活模式→点建筑即拆）。
- 弹窗定位 bug：`show(inst, pointer.x, pointer.y)` 锚在鼠标点。等距建筑精灵很高（屋顶上伸），点屋顶时点击点离地基很远 → 弹窗飘到上方。

## 落地（Opus 直接实现；GPT relay 大 prompt 持续掉线，跨5文件 UI 连线自写更稳）
1. **BuildMode**：加 `demolish` 态 + `isDemolish()/enterDemolish()`；`select` 进建造自动退拆除；`cancel/isActive` 含拆除态。
2. **MapRenderer**：加 `gridToScreenPixel(gx,gy)`（grid→含相机 scroll/zoom 的最终屏幕像素）。
3. **GameScene.handlePointerUp**：拆除态下点中建筑→`store.removeBuilding`+toast，保持模式连拆；非拆除态→popover 锚到**建筑地基中心屏幕坐标**（gridToScreenPixel(footprint center)）而非鼠标点。右键也退出拆除态。
4. **BuildPanel**：标题下方加红色"拆除工具" toggle 按钮（激活=朱砂底+"拆除中·点建筑拆"文案）；列表起点 rowsAreaTop 下移让位；buildMode.onChange 同步按钮视觉。
5. **BuildingPopover**：撤掉上轮加的拆除按钮（改用独立工具；弹窗更精简，配合定位修复）。

## 验证
type-check 干净；`npm test` **647 passed**（+BuildMode 拆除态 4 测试）；`electron:build:win` 成功。
未单独发起 DeepSeek：跨文件 UI 连线已逐行核对真实代码+类型+测试；视觉(按钮位置/弹窗锚点)留用户眼验。

## 待眼验
拆除工具按钮位置/手感；拆除态点建筑能否准确命中（等距高精灵点击仍用 screenToGrid，点近地基更准）；弹窗是否贴在建筑附近了。

## 给用户摘要
建造面板顶部加了"拆除工具"按钮：点亮后点建筑即拆(返还半数材料、释放劳力)，右键/ESC 退出；不用再点开建筑。弹窗改为锚在建筑地基处，不再乱飘。
