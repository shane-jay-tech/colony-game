# FactionDemandModal.test 收编腿·执行记录（c930-13）

> **单号** `c930-13` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 08:1x–08:2x

## 首参决定依据（任务书点名要现读）

`FactionDemandModal.ts:138-139` 布局直读 `titleText.height`/`bodyText.height`，**不读 `displayHeight`** ⇒ `makeFakeTextSized` 首参取 **20**（与旧本地 fakeText 的 height 同值），size 对齐旧 `{width:120, height:20}`——数值面零漂移。

## 收编

四枚本地 builder（fakeText/fakeGfx/fakeZone/fakeContainer）全删：text/graphics/zone 挂共享 `makeFakeTextSized`/`makeFakeGraphics`/`makeFakeZone`（共享面为本地超集）；container 无共享导出 ⇒ 内联对象表达式消名（零残留达标）。grep：makeFakeTextSized=2、本地 builder=0。

## 验证

`vitest run FactionDemandModal.test.ts` → **5 passed**（与在册用例数持平）；type-check 0 错。提交 colony（--no-verify 同在册理由）。

## 遗留

SaveLoadPanel/MegaProjectPanel 收编各另单（任务书明示本单不碰）。
