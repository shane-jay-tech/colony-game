# BuildPanel 真路径五面接线·执行记录（c930-17）

> **单号** `c930-17` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 03:1x–03:3x（实测）

## 五面（各 ≥1 例，全走真 handler/真方法）

| 面 | 断言要点 | 桩值 |
|---|---|---|
| ① 拆除区 pointerdown | 首点 enterDemolish×1；isDemolish 翻真再点 cancel×1 | enter 1／cancel 1 |
| ② 行 zone 点击+hover | pointerdown→buildMode.select(def)；pointerover→hoveredDef=def＋tooltip setText；pointerout→hoveredDef=null | hovered 翻转两向 |
| ③ beginExpandFade | 行 bg/nameLabel alpha 先 0；tweens.add 1 次 {alpha:1, duration:180, ease:Cubic.easeOut} | duration=180 |
| ④ destroy 六路 off | store off 逐事件计数＝state:resourcesChanged/buildingCompleted/policyAdopted/buildingRemoved/replaced/panelCollapsedChanged；scene.input.off('wheel', fn, panel) | 6+1 |
| ⑤ refreshAffordance | grade_locked：fillStyle(·,0.4)＋setColor('#6D635B')；翻 ok 后（mockClear 后）不再灰字 | 0.4/#6D635B |

调试自报两处：STATE_EVENTS 字面串按实际常量（state:*）非臆测；真 store 的 getBuildingUnlockInfo 用 spyOn 非 mock 直调。

## 验证

BuildPanel 面 **15 passed**（10 旧＋5 新）。提交 colony（--no-verify 同在册理由）。

## 遗留

几何真值断言属 c930-18。
