# 几何字段真值断言·执行记录（c930-18）

> **单号** `c930-18` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 03:4x（实测）

## 推导（输入尺寸 → 输出 rect 四元组，可复算）

输入：makeFakeScene 默认 scale=1366×800；UI 常量 buildPanelWidth=256／topbarHeight=48／toolbarHeight=40（shared/palette.ts:108-111）；collapsed=false（store 初始）。

- `w = 256`；`top = 48+40+8 = 96`；`x = 8`；`h = 800−96−8 = 696`
- **demolishRect** = { x+8, top+40, w−16, DEMOLISH_H(26) } = **{ 16, 136, 240, 26 }**
- **rowsAreaRect** = { x+8, top+72, w−16, h−80 } = **{ 16, 168, 240, 616 }**（rowsAreaTop=top+72、Bottom=top+h−8 ⇒ h−(72+8)）

## 验证

不覆写 layout 真构造（makeBuildPanelScene 真链）→ 断言一次命中 **16 passed**（c927-75 老 7 例的 vi.fn() 覆写未动，独立 describe）。提交 colony（--no-verify 同在册理由）。
