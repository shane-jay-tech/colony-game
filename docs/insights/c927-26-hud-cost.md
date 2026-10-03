# c927-26 HUD.refreshResources 与 10 订阅件 refresh 毫秒成本（测试面替身测量）

> 来源：`zcode-bridge/done/20260925-154203-a2e3.result.md` 遗留 1①——「HUD.refreshResources() 与 10 个订阅件各自 refresh 的毫秒成本（需为 Phaser container/text/tween 造替身）」。
> 测量件：`src/renderer/ui/__tests__/hudRefreshCost.test.ts`（本单唯一新增，**产品码零改动**）。基线 HEAD `8a9eaea`。

## 1. 替身清单（完成标准①）

| 替身 | 来源 | 本单补面（均空转实现，**不动共享件**） |
|---|---|---|
| scene/container/text/graphics/tween | 共享 `ui/__tests__/fakeScene.ts`（c919-01 唯一定义处，34 消费者）`makeFakeScene({tweens:true})` | — |
| gfx 扩展 | BuildPanel.test.ts `makeBuildPanelScene` 同款 | `setMask`/`setAlpha`/`createGeometryMask` |
| text 扩展 | 同上 | `setMask`/`setScale`/`setLineSpacing` |
| `add.image` / `textures.exists,get` | 同上 | 纹理走「不存在」分支（在册事实，不假造） |
| `scene.time.delayedCall` | 本文件 | JitHintManager fire() 延迟展示：**只登记不触发回调**＝refresh 路径本体成本 |
| BuildMode 替身 | BuildPanel.test.ts:34 显式表原样 | onChange/isDemolish/enterDemolish/cancel/select/getSelected |
| store | **真实 GameStore**（16×16 全平原地图，非 stub） | — |

## 2. 每件毫秒读数表（完成标准②；热身 20＋测量 200 轮，performance.now，两轮实测取整）

| # | 组件 | 入口（开态直调，绕 isOpen 守卫＝「全挂载」口径） | µs/次 | ×5.59 次/tick 摊入 |
|---|---|---|---|---|
| 1 | HUD | `refreshResources()`（11 token 逐个 setText） | 6–8 | ≈0.04 |
| 2 | BuildPanel | `refreshAffordance()` | ≈50 | ≈0.28 |
| 3 | DiplomacyPanel | `open()+refresh()` | ≈520–536 | ≈2.9 |
| 4 | GradePanel | `open()+refresh()` | ≈5 | ≈0.03 |
| 5 | JitHintManager | `onResources({deltas:{}})` | ≈0.1 | ≈0.001 |
| 6 | MegaProjectPanel | `open()+layout()` | ≈19–21 | ≈0.11 |
| 7 | **MilitaryPanel** | `open()+refresh()` | **≈2870–2910** | **≈16.0** |
| 8 | PolicyTreePanel | `open()+refresh()` | ≈0.4–0.6 | ≈0.003 |
| 9 | PopulationPanel | `open()+refresh()` | ≈8–10 | ≈0.05 |
| 10 | ProductionPanel | `open()+refresh()` | ≈10–72 | ≈0.04–0.40 |
| — | **十件合计** | — | **≈3547 µs/次** | **≈19.8 ms/tick** |

复现：`npx vitest run src/renderer/ui/__tests__/hudRefreshCost.test.ts`（读数打在 stdout `[c927-26]` 行；断言护栏＝单件 <5ms/次防爆量回归）。

## 3. 与 a2e3 上界 55.9 的对照结论（完成标准③）

a2e3 E3 的 55.9 是**次数**上界（5.59 次 resourcesChanged/tick × 10 件全挂载）；本单补的是**每次回调的毫秒成本**，两者相乘即每 tick 全挂载毫秒上界 ≈ **19.8 ms**——**量级上已接近 60 FPS 帧预算 16.7 ms**，且被 MilitaryPanel 一件独占 ≈16.0 ms/tick（81%）。

**三条 caveat（如实登记，判读留主班）**：
1. **替身方向性**：fake text/graphics 方法是空转 vi.fn，比真 Phaser 渲染调用**便宜**；但 fake 对象分配（ MilitaryPanel 每次 refresh 重建全部行件）比真机重用路径**贵**。两向偏差部分抵消，方向不定 ⇒ 本读数是**量级仪**，不是真机值；真机插桩复核仍属人工放行域。
2. **空态下界**：PolicyTreePanel（≈0.5µs）与 JitHintManager（≈0.1µs）走的是空数据早退路径（无采纳国策/无金布铜礼入账），是有意义的**下界**而非典型态。
3. **摊入口径**：×5.59 假设 10 件全挂载且每次 resourcesChanged 全体命中；a2e3 自己已注明 55.9 是「全挂载上界，不是稳态值」——稳态只开 HUD 时每 tick 摊入 ≈0.04 ms，可忽略。

**可操作线索（供主班，非本单执行）**：若真机复测坐实，优化顺序＝MilitaryPanel.refresh（疑每次全量重建行件，可改 diff 更新）≫ DiplomacyPanel（≈0.5ms）≫ 其余可忽略；合帧广播（a2e3 遗留方案：5.59→1.0–1.5 次/tick）落地后上界自动除以 ~4。

## 4. 产品码零改动自证（完成标准④）

```
$ git status --porcelain | grep -v "^ M\|^ D"
?? docs/insights/c927-26-hud-cost.md            ← 本档
?? src/renderer/ui/__tests__/hudRefreshCost.test.ts   ← 测量件（任务授权新增测试面）
$ git diff --name-only -- src | wc -l
0                                                ← src 零修改（含产品码与既有测试）
```

树上在途脏项（OPTIMIZATION_BACKLOG.md 等）非本班所动、一字未碰。
