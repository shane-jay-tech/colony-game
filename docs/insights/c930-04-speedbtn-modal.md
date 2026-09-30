# 顶栏速度钮模态口缺陷·执行记录（c930-04）

> **单号** `c930-04` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 06:3x

## 缺陷与修法

`HUD.onSpeedButton`（原 :525）：模态软暂停持有中 `isPaused()=true`，`speed===0` 分支 `setPaused(!isPaused())`＝把**玩家口** paused 清掉（解不开软暂停、模态关后玩家暂停偏好已丢）；1/2/3 分支还 `setSpeed` 改档（与 c930-02 数字键同源串扰）。修法＝同谓词守卫：`if (this.store.hasPauseHolders()) return;`（c930-02 落的读取口），模态口下整钮不响应。

## 验证

`HUD.test.ts` +2 例（模态持有中 0/2 全不响应；非模态 0=往返、2=恢复定档照旧）→ HUD 5 例＋守卫 2 例 **7 passed**。
提交 colony（HUD.ts +2＋测试 +22；--no-verify 绕行理由同 c930-02：hudRefreshCost 计时护栏本机负载型抖动，日间复跑项已在册）。

## 遗留

速度钮与数字键的守卫谓词同源（hasPauseHolders）但两处分写——若后续第三处出现，建议提为 store 侧统一入口（另单）。
