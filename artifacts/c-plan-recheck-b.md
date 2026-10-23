# PLAN Work Items 复核单 B（#3-末段现值核验）——c1023-21，2026-10-24

> 取数时点：2026-10-24 02:30±，colony-game HEAD＝`50296ae`；分支 `codex/architecture-hardening`。与 c1023-20（A 单）分段独立、并行成表。
> 口径：#3-#7 逐条＋Proof Commands＋Completion Criteria 全覆盖；上批底稿＝c1023-22 对账（artifacts/c-doc-drift.md §二 P4-P10）全量复验刷新。零改动。

## 一、#3 Type communication and composition boundaries（5 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :36 typed event map＋generic on/off/emit | STATE_EVENTS 枚举＋IStateEventEmitter 类型化接口＋typedEvents.test（3 绿）在役 | ✓ |
| :37 registry 键集中＋typed helpers | ui/registry.ts：REGISTRY_KEYS 22 键＋RegistryTypes 值类型映射＋registryGet/registrySet；**本班 fresh 扫描（c1023-27）**：在役 raw-string bypass（`.registry.get/set`）零命中 | ✓ |
| :38 UI as adapter | uiAdapterGuard.test（2）＋dataLayerBoundary.test（2）＋fakeSceneConsumerSentinel.test（2）三守卫在役 | ✓ |
| :39 shared visual constants 入中立层 | src/shared/（visualConstants.ts 等）＋visualConstants.test（2）；render/ui 双向消费 | ✓ |
| :40 DSL validation 移中性 data 边界 | data/dslCore.ts 在位、data→state 上行 import 零命中（核心意图已证）；**评估器 dslEval.ts 仍居 state 层**（dslEval 16＋dslEvalCompat 1 在役） | ◐ 部分（c1023-22 P7 同判，未变化） |

## 二、#4 Reduce simulation-kernel concentration（4 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :44 tickDay 相位调度抽 named pipeline | state/dayPipeline.ts：DAY_PHASE_DEFS/DAY_PHASE_ORDER/buildDayPipeline/runDayPipeline＋dayPipeline.test（5 绿） | ✓ |
| :45 相位按域分组且序不变 | DayPhaseDomain 域类型（economy/population、diplomacy/military、progression/narrative 分域）＋DAY_PHASE_ORDER 常量序钉＋dayPipeline.test 相位序断言 | ✓ |
| :46 GameStore 保持兼容 facade、编排下沉小模块 | facade 在役（UI/测试全走 GameStore）；**下沉未完**：gameStore.ts 仍 2400+ 行单件，拆分五批 c1023-01..05 已认领未落地（outbox/done 零 result、git log 零命中、porcelain 零在途三路证据，c1023-26 同证） | ◐ 在途 |
| :47 相位事件批量/分界（防订阅者见半日态） | runDayPipeline 为顺序 for-loop，事件随相位即发；分界现有形态＝域分组＋命名相位＋订阅侧测试（stateEvents/queueFairnessPins 等），**无显式批量门** | ◐ 部分（现形态满足「clearly delimit」的分组解读，批量机制未建） |

## 三、#5 Split renderer responsibilities（4 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :51 复用等距投影模块 | render/iso 模块＋iso.test（6 绿）（54eafe9 等距重画批落地） | ✓ |
| :52 viewport/camera＋map-layer 生命周期抽取（纯测试覆盖） | viewportMath.test（21）＋cameraMath.test（9）＋MapRenderer.viewport-residual（7）/centerOnTile-setMapZoom-nan（8）/panby-nan（5） | ✓ |
| :53 MapRenderer 公共 API 保留 | MapRenderer.test（41）＋GameScene 消费面未重写；mapRendererBoundary（19）B 组三重守卫钉 | ✓ |
| :54 terrain/building/scatter/effects 生命周期独立可拆、resize 安全 | MapRenderer.test 含 resize 面（rg resize 命中）；生命周期/关闭链路由 GameSceneLifecycle（5）＋IntroSceneShutdown（5）＋ModeSelectSceneShutdown（3）覆盖；scatter 独立生命周期由 scatterAssets/scatterSourceGuard/scatterDiskReconcile 三件守 | ✓ |

## 四、#6 Verification and documentation（4 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :58 五族测试（story/sandbox 组成、save/load UI、typed registry、tick 相位序、renderer 计算） | 全在役且本班增强：story/sandbox 组成＝IntroScene.test＋**storyNpcRoster.test（本班新增 5 例）**；save/load UI＝SaveLoadPanel.test；typed registry＝registry.test；相位序＝dayPipeline.test；renderer 计算＝viewportMath/cameraMath | ✓ |
| :59 scene/composition 冒烟（listener 清理或 registry 接线） | IntroSceneShutdown/ModeSelectSceneShutdown/GameSceneLifecycle＋registry.test | ✓ |
| :60 START_HERE/架构注记与现值同步 | **偏离在册**（c1023-22 §一）：README R1 国策 23→39、R2 加速键行号锚漂移 244-246→169-171/264-266，另有四域外同名漂移；START_HERE 主体符（R7-R12）。偏离未修（待裁） | ◐（偏离在册待修） |
| :61 type-check/unit/build/`git diff --check` | verify＝type-check+test+test:perf 本班 pre-commit 全量绿 ×5；`git diff --check` 本单 fresh 跑 rc=0；`npm run build` 键在位（electron-vite build）——重构建本班未复跑（离线预算限界，键与 c930-29 十键普查为证） | ✓（build 未复跑注记） |

## 五、#7 GitHub backup（4 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :65-:66 gh CLI＋private repo 建立 | origin＝`github.com/shane-jay-tech/colony-game.git` 已配（git remote -v 实查）；private 属性离线不可证（本班禁联网） | ◐（离线限界） |
| :67 push snapshot＋hardening branch | c1011-08 读数「origin 双远端分支在」；本班 5 笔新提交**未 push**（禁令守约），远端落后本地 | ◐（本地领先 5 笔，待授权 push） |
| :68 draft PR | 离线不可证（远端 PR 面需联网） | ◐（离线限界） |

## 六、Proof Commands＋Completion Criteria 总览

- Proof（PLAN:72-76）：`npm run verify`＝pre-commit 同义全量绿（本班 ×5）；`npm run build` 键在位未复跑；`git diff --check`＝rc 0（fresh）。
- 完成标准 ：80-:87 逐条：:80 reachable-or-removed ✓／:81 NPC 策略 ✓（c1023-06 后全真）／:82 UI 存读档 ✓／:83 编译期类型化（events+registry）✓／:84 相位序＋renderer 计算显式测试 ✓／:85 存档 fixtures 反序列化 ✓（saveV9Fixture 7＋liedVersionMigration 43＋badSampleRestore 21）／:86 proof 通过（build 未复跑注记）✓／:87 snapshot＋hardening 双在 private remote ◐（origin 在、private 离线不可证、本地领先 5 笔未 push）。

## 七、证据命令

```
$ git branch --show-current && git remote -v
codex/architecture-hardening / origin=https://github.com/shane-jay-tech/colony-game.git
$ git diff --check; echo "rc=$?"
rc=0
$ rg -n '"verify"' package.json → 19: "verify": "npm run type-check && npm run test && npm run test:perf"
$ rg -n "DayPhaseDomain|DAY_PHASE_ORDER" src/renderer/state/dayPipeline.ts → :33/:77（域分组＋序常量）
$ rg -ln "ipcMain|saveLoad" src/main/ src/preload/ → src/main/index.ts、src/preload/index.ts
$ rg -ln "startStoryRosterNpcs|STORY_NPC_ROSTER" src → npcCountries.ts/gameStore.ts/IntroScene.ts/两测试件（:81 翻正证据）
```

## 八、遗留与建议

1. ◐ 三类残余：dslEval 迁移（#3:40）、gameStore 拆分五批＋事件批量门（#4:46-47）、README 两偏离＋域外漂移（#6:60）——均已有登记/材料，处置待主班；本单零改动。
2. #7 push 面：本地领先 5 笔（25cc251..50296ae），push 属禁令区，待授权后由主班或另单执行。
