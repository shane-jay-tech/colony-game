# colony saveGuard 双 TODO 日间材料（s918-11 / 只读核报，零源码改动）

> 2026-09-19｜执行班 sweep-20260918-2300。

## TODO ①：currentDay 上界（saveGuard.test.ts:104）

- **现实上界证据**：
  - 沙盒模拟长期基准 `HORIZON_DAYS = 720`（sandboxSimulation.test.ts:30，720 日终局仍资源有界、非 NaN）——游戏设计上的「一局自然寿命」。
  - 消费点：`gameStore.ts:1410`（事件冷却按 currentDay 差值）、:204-206（朝堂事件冷却/超时推导）——线性使用，超大值会流入 UI 显示与事件判定。
- **候选上界**：`currentDay ≤ 3600`（= 720 日 × 5 周余量；兼顾长命局与明显坏值）。
- **校验落点**：saveLoad 载入校验（参照 `buildings[].constructionProgress` 的 SaveLoadError 模式，saveLoad 相关 :722 起）＋ gameStore tick 推进处 clamp。
- **兼容性影响（旧档会不会被拒）**：现网正常档 currentDay ≤ 数百；3600 上界不会拒任何真实档。仅伪造/损坏档会被拒——语义为「拒绝损坏」而非「拒绝旧版」。

## TODO ②：constructionProgress 语义校验（saveGuard2.test.ts:156）

- **消费点全量（rg 实测）**：
  - src/renderer/data/schema.ts:131（字段定义）
  - gameStore.ts:794/886（新建置 0）
  - gameStore.ts:1029-1037（推进：`+= 100/time*speed`，`>= 99.999` 判完成）→ **语义天然是 [0,100] 百分比**
  - UI 侧进度条按同一 0-100 口径渲染。
- **候选校验**：载入时 `0 ≤ constructionProgress ≤ 100`，越界抛 SaveLoadError（或 clamp 至 [0,100] 并记日志——推荐 clamp，更宽容）。
- **兼容性影响**：旧档若有 100.4 这类浮点过冲（:1037 判定前会略超 100），**严格校验会拒旧档**——建议 clamp 而非 throw；clamp 无兼容风险。

## 汇总
| TODO | 校验 | 落点 | 旧档兼容 |
|---|---|---|---|
| currentDay 上界 | `≤ 3600` 拒绝损坏档 | saveLoad 载入校验＋tick clamp | 无风险（真实档远低于上界） |
| constructionProgress | `[0,100]` clamp（不 throw） | saveLoad 载入校验 | 无风险（浮点过冲被吸收） |
