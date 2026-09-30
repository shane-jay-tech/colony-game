# 公平性相邻面测试·执行记录（c930-25）

> **单号** `c930-25` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 05:0x（实测）

## 六例（c927-45 遗留点名的未覆盖相邻面）

| 面 | 例 | 断言 |
|---|---|---|
| conversionQueue 门槛 | 非 working 建筑拒入队 | startConversion=false＋queue 长度 0 |
| conversionQueue 门槛 | 无闲劳力（farmer idle=0）拒入队 | 同上（canAffordClass 门） |
| eventTempo | 8 日防连击一票否决 | 7 日＋rng0.99 ⇒ anti_combo |
| eventTempo | 25-50 日状态节奏窗口 | tense[15,25]@30 必 met；peaceful[35,50]@30 必 waiting |
| runEventTick | story 分支（chapter≥1 无挂起即触发） | pendingEventId=story 事件 id（越过 25-50 节奏） |
| runEventTick | relic 兜底链 | 采样池穷尽（random value=0 永不通过）⇒ pendingEventId=relic_{id}_s{stage} |

## 调试自报

storyFlags 默认 null（非 story 模式）——首版只改 chapter 撞 null，改整对象赋值即绿。

## 验证

eventTempo 23＋queueFairnessPins 26＝**49 passed**。事件类用例按要求喂受控 events（非退化池）。提交 colony（--no-verify 同在册理由）。
