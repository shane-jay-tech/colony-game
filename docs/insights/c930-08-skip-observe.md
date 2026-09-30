# 第二处静默 continue 案②·执行记录（c930-08）

> **单号** `c930-08` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 07:1x

## 实施（案② 保险丝，双位同改，+6/−2）

`MapRenderer.ts` 两处 `getBuildingDef` 查表失败的静默 continue（syncBuildings 主渲染环＋particles 环）按裁决件 §5.2 草案改可观测：循环外 `skippedUnknownN` 计数＋`unknownDefIdsN` Set，`if (!def) { 计数; 收集; continue; }`，循环尾一次性 `console.error('[MapRenderer] N building(s) skipped, unknown defId: [...])')`。真毒档形态（未注册 defId）从「一画一吞」变为启动渲染即点名。

## 验证

MapRenderer 面 **41 passed**（毒条目不在场 ⇒ 零输出零行为变化；计数器为纯观测面）。提交 colony（--no-verify 同在册理由）。

## 遗留

案①（校验侧当版拒载，经济面主刀）仍待主班拍板——本保险丝只治视觉静默，治不了 runProductionTick 吃坏数据（裁决件 :49 明示）。
