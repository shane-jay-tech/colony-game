# 离线补日结算正确性取证设计（c1004-06，2026-10-06，设计稿零跑零改）

- 承 db58 L5。**现值定谳（读码口径）**：离线结算链路**当前是死线**——①`OFFLINE_REWARD`（offline.ts，max 8h/decay 0.5/五资源快照）**全仓零消费**（仅 data/index.ts 再导出）；②`lastSeenTimestamp` 仅 saveToSlot 写（:849 setLastSeenNow）、loadFromSlot/SaveLoadPanel 读档后**无人比对**（replaceState 直接灌态，无 `Date.now()-lastSeen` 结算分支）；③`tickDay` 只由游戏内速度驱动，无按墙钟差补日的入口。⇒ 「离线补日」现值=**不结算**（离线零产出零消耗，非「结算多次」）——取证设计的对象是「接入时确保只结算一次」。

## 一、端到端取证设计（三档注入）

### 夹具与隔离

- 用 `createTempDbPath` 同款 tmp 隔离；GameStore 走 `new GameStore()` 纯内存（不触生产 quick-save）；
- 时钟注入：`vi.useFakeTimers()`（或注入 `Date.now` stub）控三档墙钟差；
- 前置态：seed 资源 grain=1000/wood=500、每日生产速率经 buildings 固定（1 农田 working）⇒ 期望终值可手算。

### 注入操作

1. `store.setLastSeenNow()`（=T0）；
2. `saveToSlot` 等价序列化→`replaceState` 回灌（模拟关游戏→读档）；
3. stub `Date.now()` 返回 T0+Δ；
4. 调「离线结算入口」（案 A 接线后的 `applyOfflineCatchUp(store)`——设计面新函数）；
5. 读终值断言。

### 断言表（期望资源终值）

| 档 | Δ | 期望 | 断言要点 |
|---|---|---|---|
| 跨 1 日 | 24h | 离线产出=min(24,8h 上限)×0.5×日速率；**tickDay 补日=1** | ①grain/wood 终值=手算值（±0）；②currentDay 只 +1；③再跑一次结算入口 ⇒ **资源零变化**（幂等=只结算一次本体） |
| 跨 7 日 | 168h | 产出仍按 **8h 上限**封顶（防 7 日爆仓）；currentDay +1（离线不推多日——OFFLINE_REWARD 语义「人口科技不自动增长」的对称口径需设计稿确认：补 N 日 tickDay 或仅经济快照，二选一在接线单拍板） | ①终值==1 日档终值（上限封顶实证）；②二次调用零变化 |
| 36h 漏发警告界 | 36h | 现值无警告面；接线时若加「离线超 24h 提示」toast ⇒ 断言 toast 在场且资源同 8h 上限 | ①toast 在/不在按接线裁决；②结算幂等同上 |

### 「只结算一次」的三重断言（核心）

1. 结算入口把 `lastSeenTimestamp` 更新为 `Date.now()` ⇒ 同 Δ 二次调用差=0 ⇒ 产出零增；
2. `replaceState` 后立即结算一次的终值 == 「不关游戏直接玩 Δ 墙钟（speed 暂停）」的终值（等价性对照）；
3. 幂等破坏变异（移除 lastSeen 更新一行）⇒ 断言 1 红（判别力自证，照 s1002-19 变异纪律）。

## 二、与 c1002-28 差异注

c1002-28 做「离线 toast 合并 flush」（提示面）；本单做「结算正确性取证」（数值面）——互补不重叠；接线单落地时两者共用同一结算入口断言（toast 文案可挂结算返回值）。

## 三、回滚与风险

- 回滚：结算入口独立函数，回滚=摘调用点一行；FakeTimers 用后必 restore（夹具 after 钩）。
- 风险：真机时钟回拨（用户手调）⇒ Δ<0 时结算入口必须 no-op（断言表追加第 4 行：Δ=-1h ⇒ 终值零变化）。
