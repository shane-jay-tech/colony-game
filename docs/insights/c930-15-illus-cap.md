# EventModal 插画分支上限守卫·执行记录（c930-15）

> **单号** `c930-15` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 08:5x

## 前提订正与合规路线

任务书说「本件本地 fake scene」——c927-65/74 共享化后夹具已是共享 `makeFakeScene`，而任务明令**共享件扩面越界不做**（31 消费件同笔）。合规路线＝**测试文件内实例级扩面**：`(sc as …).textures = { exists: vi.fn(() => true) }`＋`sc.add.image = vi.fn(...)` 替身——共享 fakeScene.ts 零改动（git diff 自证空）。

## 守卫例（新例 3）

N=300 夹具＋illustrationKey＋textures.exists=true：imgBlock=166、raw=950 ⇒ 上限 **686=520+imgBlock**（fillRect (443,57,480,686)）；子件跟夹（c930-14 谓词）：bodyBudget=36 ⇒ countdown 599 落面板内（底 743）。

## 验证

EventModal 面 **16 passed**（15＋新例；新例数值全中＝c930-14 的 bodyBudget 公式在带插画分支同样成立）。提交 colony（--no-verify 同在册理由）。

## 遗留

无。
