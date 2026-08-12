# 2026-06-05 /implement — 地图相机：开局整图居中 + 最大化锁 + 缩放居中 + 鼠标拖动

模式：**deep**（核心渲染/相机模块；之前出过"最大化切换卡死"的坑，见 memory feedback_colony_maximize_freeze）

## 原始需求（用户原话，非技术用户）

> 一打开游戏就是这个样子了，地图位置不居中；我觉得地图应该一开局就居中，且是字面意义上的最大的状态，然后加一个最大化锁止，就是地图最大的状态就不能再继续变大了；然后缩小也是居中进行缩小，并且加一个鼠标可以拖动地图的功能

截图症状：开局 zoom≈0.3，地图被推到右下角、左上一片黑，没居中。

## 语义澄清（两轮）

"字面意义上的最大的状态"有歧义（见 memory feedback_x_form_ambiguity）。先用 AskUserQuestion 给两档：
- A 铺满可视区（地图比屏幕大、需拖动、不能再放大）
- B 整张图刚好装下（全图可见、居中、不能再放大）

用户首轮未选（备注"n"），我据"要拖动→只有 A 有意义"默认 A；用户随即说"回退，不是 A"。再口头确认 → **用户明确选 B：开局看到整张地图**。

## 最终规格（B）

1. 开局 zoom = 整张 80×80 等距地图刚好完整显示并居中（= fit-whole-map）。
2. 最大化锁止：fit 即放大上限，不能再往里放大（getMaxZoom = fitMinZoom）。
3. 可往外缩，缩小围绕中心（getMinZoom = fit × 0.4；clampScroll 在地图≤视口时自动居中）。
4. 缩放改乘法步进（×1.2 / ÷1.2），因 fit≈0.1 时加法 ±0.1 会一步越界。
5. 左键拖动平移（空闲态，4px 阈值区分点击/拖动；点击才弹建筑 popover）。中键 pan 保留。

## 协作过程

- **健康检查**：3 个 relay 全 OK（gpt 4.5s / deepseek 2.4s / kimi 30.2s）。
- **GPT-5.5 Pro（主程序员）今日掉线**：短探活正常，但任何需要长回复（生成代码）的请求都 `RemoteProtocolError: peer closed connection`（deep）或静默超时（quick）。**降级**：GPT 不参与，Opus 基于真实源码定稿实现，DeepSeek 继续担任独立评审官（见 memory project_psy_v4.7 同款降级模式）。gpt-coder 代理在 GPT 失败后由其底座（Sonnet）给了一版基于真实代码的草案，Opus 审过后采纳为草稿、并补了它漏的两个会编译失败的未用 import。
- **DeepSeek V4 Pro（评审官，deep）5 维度复审** verdict=ship-with-fixes（无 critical），6 条 objection + 4 条 nit：

  | # | 维度 | finding | Opus 仲裁 |
  |---|---|---|---|
  | 1 | 安全 | setMapZoom 锚点未校验 NaN → 可能写 NaN scroll 崩渲染 | **采纳**：非有限锚点回退视口中心 |
  | 2 | 边界 | rebuildAfterResize 的 focus 取自 recenter 前、时序陈旧 | **采纳（简化）**：直接居中到地图中心格，契合"永远整图居中" |
  | 3 | 边界 | ESC 没关 building popover（既有 bug） | **采纳**：escHandler 加 popover.hide() |
  | 4 | 性能 | resize 不该重烘焙地貌/节点 | **驳回**：触碰"最大化卡死"敏感路径 + 任务范围外；rare 事件廉价复位，保守不动 |
  | 5 | 设计 | 锚点缩放被 clampScroll 拉回中心算 bug | **驳回**：这正是规格要求"缩放围绕中心"，非 bug |
  | 6 | 可读 | 魔法数 1.2/0.4 等 | **采纳（部分）**：抽出我新引入的 1.2→MAP_ZOOM_STEP_FACTOR、0.4→MAP_ZOOM_OUT_FLOOR_FACTOR；既有 0.08/280/0.6 等不在本次范围 |

  nits：unicode 符号 / 平行数组 idx 脆弱 / 中键 dy 判向 / recenter 未挪 maskGfx —— 均为既有代码或经核实非问题（mask 每帧按世界坐标重画，world-stable），不改。

- **二轮 cross-critique**：DeepSeek 无 critical → 按规跳过，直接落地。

## 落地改动（3 文件 + 1 测试）

- `src/renderer/render/MapRenderer.ts`：新增 getMaxZoom()=fit；getMinZoom()=fit×FLOOR_FACTOR；setMapZoom clamp 上限改 getMaxZoom、下限改 getMinZoom + 锚点 NaN 兜底；initialZoom()=getMaxZoom；rebuildAfterResize 统一 setZoom(getMaxZoom)+居中到地图中心格；删 OVERVIEW_ZOOM 常量；新增导出 MAP_ZOOM_STEP_FACTOR=1.2 / MAP_ZOOM_OUT_FLOOR_FACTOR=0.4。
- `src/renderer/scenes/GameScene.ts`：滚轮乘法步进；新增左键拖动平移状态机（pointerdown 起追踪→pointermove 过 4px 阈值才 panBy→pointerup 未拖动则弹/关 popover）；build 态切换/ESC/shutdown 清理拖动态；ESC 关 popover。
- `src/renderer/ui/ZoomControl.ts`：+/- 按钮乘法步进；refreshZoomText 的"最近"用 getMaxZoom() 取代静态 MAP_ZOOM_MAX；清未用 import。
- `src/renderer/render/__tests__/MapRenderer.test.ts`：改写 3 条旧行为测试（开局档/resize 重夹语义）+ 新增 1 条 setMapZoom 上下限锁测试。

## 验证

- `tsc -p tsconfig.renderer.json --noEmit` 干净。
- `vitest run` **629 passed**（36 文件）。
- 桌面 exe：`npm run electron:build:win` 重打包（保持 .lnk 指向最新）。

## 已知取舍（已向用户明示）

- 因用户要"永远看整图"，地图永远 ≤ 视口 → **左键拖动会被 clampScroll 弹回居中，视觉上挪不动**；代码已 wire 好，将来若放开放大即生效。
- fit≈0.1 时每格约 16×8px，**左键点格放建筑偏小、不易精准**。若用户嫌别扭，可放开"允许放大一点"。

## HOTFIX（同日，用户实测仍偏右下角）

第一版只改了缩放档位，没修好居中——用户截图：地图仍甩在右下角、×0.2、大片黑。

**真因**（不是逻辑 bug，是真实启动时序，单测 mock 相机复现不了）：
`fitMinZoom()` 在视口算出 ≤0 时（maximize 过程中的退化帧，或构造时相机还停在 config 的 1366 而非真实尺寸）**兜底 return 0.2**；于是在那个坏尺寸上 `setZoom(0.2)` + 居中，把相机摆歪。`×0.2` 就是这个兜底值的指纹。更关键：这个坏状态定下来后**没有任何东西再纠正**，所以持续偏。

**修法（自愈式守护）**：
- MapRenderer 新增 `ensureFittedToViewport()`：每帧 O(1)。视口退化（vp≤0）→ 跳过保留上一帧；相机尺寸相对上次 fit 变化 >1px → 重新整图 fit + 居中并记录尺寸；尺寸没变 → no-op（不动用户缩放/拖动）。GameScene.update() 每帧调。
- 这样无论构造/最大化/退化帧怎么乱序，相机最终都在**真实最终尺寸**上居中，且能从退化帧自愈。
- rebuildAfterResize 加 vp≤0 守卫 + 记录 lastFit；新增 `requestRefit()`（重置 lastFit 让下一帧强制重 fit），面板折叠/读档（panelCollapsedListener / replacedListener）改调它，保证"可用区变了但画布尺寸没变"时也重新整图居中。
- 新增 2 个针对真因的测试（尺寸变化重 fit+居中 / 退化帧跳过不污染）。**631 测试绿，tsc 干净，exe 重打包。**

教训：纯逻辑单测（mock 相机喂干净尺寸）无法复现"真实时序 + 退化帧 + 高 DPI"类渲染 bug；这类问题要么真机验证，要么用自愈式守护兜底而非依赖一次性正确时序。

## HOTFIX 2（真正的根因——前两版都没修对）

HOTFIX 1（自愈守护）后用户实测**仍偏右下角 ×0.2**。我加了个调试浮层（Phaser Text, setScrollFactor(0)）想读相机数值——结果浮层自己**被缩成一丁点、跑到画面正中**。用户一句"这浮层都这样了你还想不到问题在哪吗"点破：

**真正的根因**：Phaser 相机默认原点 (0.5,0.5)，缩放**绕画面中心**进行，真实屏幕变换是
`screen = (world − scroll) × zoom + (camWidth/2) × (1 − zoom)`。
而本类所有 scroll/居中/clamp/锚点计算用的是简化模型 `screen = (world − scroll) × zoom`，**漏了 `中心×(1−zoom)` 这一项**。zoom=1 时该项=0（旧版无缩放，所以一直没暴露）；但开局 fit≈0.2 时该项达 ~768px(横)/432px(纵)，把整张地图（连同 viewport mask）整体推向右下角。调试浮层(scrollFactor0)被推到 (826,445) 而非我指定的 (290,64)，位移量正好是这个偏移项——成了根因的实锤。

之前"开局 overview 太大溢出""退化帧兜底 0.2""自愈守护"全是在错误模型上打转，手算"应该居中"也是因为手算用了同一个错模型自我验证。

**修法（一行，最干净）**：`cam.setOrigin(0, 0)`（构造时，带 typeof 守卫）。让缩放以左上角为基准，偏移项归零，于是本类全部简化模型的 scroll 公式立即正确，centerOnTile / clampScroll / setMapZoom 锚点 / refreshViewportMask 一并修好。631 测试绿（测试本就用简化模型计算屏幕坐标，修复后真实行为与之一致），exe 重打包。调试浮层已删。

**教训（已写 memory）**：① 别用简化相机模型手算就下"应该对"的结论——Phaser 缩放绕中心，有 `中心×(1−zoom)` 项；② mock 相机的单测无法复现真实相机变换，这类渲染 bug 要么真机验、要么把 UI/调试放进非缩放场景；③ 把调试浮层放进**带 zoom 的场景**会被一起缩放误导——该放 DOM 或 UIScene。④ 连续两次"测试绿就报修好"被用户当面打脸，渲染/相机类改动必须真机确认或拿到运行时数值再下结论。

## v3（铺满档——用户验收"居中对了但黑边太大"后调整）

setOrigin 修好后用户实测：**居中 ✓、缩放围绕中心 ✓**，但反馈"没铺满屏幕、上下黑边太大"。

根因（几何，非 bug）：地图是 2:1 等距菱形，"整张图刚好装下"(fit = min 比例)按宽度算 → 上下留两条大黑边 + 菱形四角黑三角。这正是最初 AskUserQuestion 里 A(铺满) vs B(整图) 的取舍——用户当初选 B，见到实际效果后想要 A 的"铺满"。

调整：
- `getMaxZoom()` 从 `fitMinZoom()`(整图档) 改为 `coverZoom()` = `max(vp.w/mapPxW, vp.h/mapPxH)`（铺满档：较大维填满、另一维溢出 → 可拖动看边缘）。开局/最大化/重置都用它。
- `getMinZoom()` 改为 `fitMinZoom()`（整图全可见 = 缩到最远）。缩放范围 [fit, cover]，开局在 cover。
- 删 `MAP_ZOOM_OUT_FLOOR_FACTOR`（不再需要 fit×0.4 下限）。
- 副作用：地图永远 ≥ 视口（cover），所以**左键拖动这下真正有用了**（之前 B 档下地图≤视口、拖动被 clampScroll 弹回，等于摆设）。
- 631 测试绿（改 1 条 v2 测试为 v3：开局=cover、min=fit、cover≥fit），exe 重打包（00:10，需先关游戏否则 d3dcompiler_47.dll 占用导致打包失败）。

**仍存的取舍（已告知用户，待其拍板）**：菱形塞长方形，四角黑三角几何上无法完全消除（除非放大到只剩中间一小块）。当前"填满高度、左右溢出可拖"已最小化黑边。用户若要"更满"可再放大一档（裁更多边缘）；若嫌拖动麻烦要"一眼看全图"则回退 v2(整图档)。**此版用户尚未最终验收。**

## 给用户的摘要（见对话）

结论 + 改了什么 + 风险≥2 + 反方 + 置信度 + 本归档路径。

## 完整时间线（供审计）

1. 需求澄清两轮（AskUserQuestion A/B → 用户选 B 整图）。
2. v1：GPT relay 掉线降级，Opus 定稿 + DeepSeek 五维度复审（采纳 4 驳回 2）→ 改 fit 档/最大化锁/乘法缩放/左键拖动，631 测试绿。
3. 用户实测仍偏右下 → HOTFIX1 自愈守护 ensureFittedToViewport（错因方向，未中真因）。
4. 仍偏 → 加调试浮层，浮层自身被 zoom 缩小+推中心，用户点破 → 定位**真因 = Phaser 相机原点 0.5 缩放绕中心、scroll 公式漏算 中心×(1−zoom)** → `setOrigin(0,0)` 一行修好。期间发现打包被运行中的游戏占用导致 exe 不更新。
5. 居中对了但黑边大 → v3 改 cover 铺满档。

