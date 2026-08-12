# Implement: 数据驱动的建筑精灵↔地块对齐

Date: 2026-06-06
Supersedes: none（与 2026-06-06-impl-camera-zoom-in-unlock.md 同日，独立问题）

模式：**deep**（核心渲染；用户要"质量最好的"）

## 原始需求（用户原话，非技术用户）

> 放大缩小这个问题解决了，但是建筑和地块还是无法完全对上 …… 我需要质量最好的

## 诊断（Opus）

建筑等距精灵原用统一公式摆放：`setOrigin(0.5,1)` + `setPosition(cx,frontY)` + `setScale(isoW*1.06/nativeW)`，**假设每张原画"地基占满图宽、底边在图正下中心"**。但 20 张 AI 原画尺寸各异（951×895~1640×1396），地基在图里的位置/占宽不一，有的伸出树/招幌 → 一个公式对不齐。查看 bld_house（带树）/bld_farm（地基填满方画）确认。

**根因**：缺少"原画↔地基"的逐图校准信息；且 AI 原画内部透视未必精确等于引擎 2:1 网格（这是 AI 美术固有限制，完美对齐最终需按引擎投影重做原画）。

## 方案：数据驱动锚点（等距游戏标准做法）

1. `scripts/gen_building_anchors.py`：扫每张 PNG，从不透明像素测 anchorYFrac（最低不透明行）、footprintWidthFrac（下半部最宽行跨度，floor 0.1）、anchorXFrac（该最宽行中点，与宽度量法几何一致）。生成 `buildingAnchors.generated.ts`（已 check-in）。
2. `buildingAnchorOverrides.ts`：手动覆写表 + `getBuildingAnchor()`（generated→override 浅合并→fallback 0.5/1/1，带 memo）。
3. `MapRenderer.rerenderBuildings`：按锚点摆放——origin=(anchorX,anchorY)、position=(cx, botV.y)、scale=isoW/(footprintWidthFrac×nativeW) 带 clamp(MAP_BUILDING_MAX_SCALE=1.5)+有限性兜底。

## 协作

- 健康检查：早些时候 3 relay OK。
- **GPT-5.5 Pro（主程序员）今日持续掉线**（RemoteProtocolError ×3）→ 降级：Sonnet 底座出草案，Opus 审核定稿（同 2026-06-05 降级模式）。
- **DeepSeek V4 Pro（评审官，deep）5 维度复审** verdict=ship-with-fixes，13 findings+4 nits。仲裁：

| # | 维度 | finding | 仲裁 |
|---|---|---|---|
| 5 | 边界 | setPosition 用 botV.x 而非 cx，非正方形 footprint 会侧偏 | **采纳**：X 用 cx，Y 用 botV.y |
| 12 | 设计 | anchorXFrac(全列均值) 与 footprintWidthFrac(最大跨度) 不一致→建筑歪 | **采纳**：anchorXFrac 改为最宽行中点 |
| 3+2 | 边界/安全 | 细高建筑 footprintWidthFrac 极小→scale 爆炸 | **采纳**：footprintWidthFrac floor 0.1 + scale clamp 1.5 |
| 6 | 边界 | Python 下半部全透明 np.mean([]) 出 NaN | **采纳**：每个 np.where 后空数组兜底 |
| 1 | 安全 | 文件名注入生成 TS | **采纳**：key 白名单 ^bld_[a-z0-9_]+$ |
| 8 | 性能 | getBuildingAnchor 每栋分配对象 | **采纳**：Map memo（实为事件触发非每帧，廉价加固） |
| 11/nit | 可读 | 魔法常量无注释、兜底 scale=1 不当 | **采纳**：注释 + 兜底改 isoW/nativeW |
| 7 | 边界 | anchorY<1 时深度错位 | **驳回**：anchorY=最低不透明行，其下无不透明像素，无深度问题（误读） |
| 9 | 性能 | setOrigin 每次标脏 | **驳回**：非每帧，微优化免 |
| 10/13/14 | 设计/可读 | build-check/形态学闭运算/anchorY 全手填 | **驳回/留覆写**：过度，覆写表已覆盖 |

- DeepSeek 明确确认：未触碰相机/resize/mask 路径，"最大化卡死"无复发风险。

## 落地结果

**新增**：scripts/gen_building_anchors.py、src/renderer/render/buildingAnchors.generated.ts、buildingAnchorOverrides.ts、__tests__/buildingAnchorOverrides.test.ts（4 新测试）。
**改**：MapRenderer.ts（import + MAP_BUILDING_MAX_SCALE 常量 + 精灵摆放块重写）。

**验证**：type-check 通过；`npm test` **636 passed**（632+4）；`npm run electron:build:win` 成功刷新 D:\colony-game\dist-out。

**实测发现**：自动测出多数建筑 ≈(0.5,1.0,1.0)（地基菱形几乎填满方画），仅祖庙/房屋/驿道有小幅修正。故自动校准改善有限，**真正逐栋严丝合缝需靠覆写表手调**（用户截图 → Opus 填 override），完美对齐的终极方案是按引擎 2:1 投影重做原画（留待正式美术阶段）。已向用户说明此迭代性质。

## 给用户的摘要

见对话：框架+正确缩放/居中已落地，给了逐建筑微调旋钮；请截图建筑供 Opus 填 override 调到完美；AI 原画透视是深层限制。
