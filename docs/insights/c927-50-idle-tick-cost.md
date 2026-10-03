# c927-50 productionTick / npcDynamicsTick 空转成本量化（a2e3 延伸·只读）

> 来源：a2e3 result——`state:npcDynamicsTick` 48 发中 97.9% 负载与上次逐字相同、`state:productionTick` 300 发中 57.7% 同（E5）。
> 本单补「空转值多少毫秒」：探针 `tmp/c927-50/idle-tick-cost.mts`（a2e3 ui-freq2.mts 同族夹具，gitignore 面零仓库足迹），**产品码零改动、零仓库写入**。基线 HEAD `8a9eaea`。

## 1. 探针命令与轮数（完成标准①）

```
$ node_modules/.bin/vite-node tmp/c927-50/idle-tick-cost.mts
```

- 夹具＝a2e3 同族：`rngSeed 7`、`people 200`、`populationClasses {140,40,20,20}`、40×`bld_farm`（working/tier1）、**300 日**。
- 计时：实例级包装 `runProductionTick`/`runNpcDynamicsTick`（私有方法 JS 可达，不改原型不改产品码），外层 `performance.now()` 测 300 次 `tickDay()` 全程；热身 20 日不入测量。
- 空转占比沿用 a2e3 E5 在册读数（57.7% / 97.9%），本探针不重复测负载逐字比对。
- 口径声明：**无头 CPU 计时**（无 Phaser 渲染）——读数不含 UI 回调成本。

## 2. 占比表（完成标准②；实测单轮，300 日）

| 相位 | 调用次数 | 合计 ms | µs/次 | 占 tickDay CPU % | 空转占比（a2e3 E5） | **空转 ms/全程** |
|---|---|---|---|---|---|---|
| productionTick | 300 | 17.62 | 58.7 | **56.7%** | 57.7% | **10.17** |
| npcDynamicsTick | 300 | 1.69 | 5.6 | 5.4% | 97.9% | **1.66** |
| 其余相位合计 | — | 11.75 | — | 37.9% | — | — |
| tickDay 全程 | 300 | 31.06（0.104 ms/日） | 104 | 100% | — | ≈11.8 |

## 3. 结论一句话（完成标准③）

**两 tick 的空转 CPU 成本实测极低——300 日全程合计 ≈11.8 ms（日均 ≈0.04 ms，占全天管线 CPU 的 ≈38%…即 production+npcDynamics 合计 62% 中真正空转的份额折 ~11.8 ms），按 1x 时速（2000ms/游戏日）折算不到每帧预算的十万分之一 ⇒「空转是否值得修」在 CPU 面不成立，该修的理由在渲染面**（a2e3 已测：空转广播驱动 55.9 次刷新回调/tick、61.5 次 setText/tick 的 UI churn）——加「值变了才发」守卫的正确立项理由是省渲染回调，不是省 CPU。

## 4. 零码改动自证（完成标准④）

探针在 `tmp/`（.gitignore:25）；报告只打 stdout 未写文件；`git status --porcelain` 零新增（本分析档自身 untracked 交主班代提交）；产品码与测试面零改动。
