# colony scenes 五景依赖注入面盘点（卷宗 c923-32／只读）

- 取证时刻：2026-09-23 18:16–18:20（HEAD 现场取读，见文末命令）
- 班：`qoder-executor-20260923-0022-colony12`（colony 分区执行子班）
- 范围：**BootScene 之外的五景**（Game / UI / Transition / ModeSelect / Intro）。BootScene 的运行时面已由 c923-13 覆盖，本档刻意避开，只在两处必要处引它作对照（`introDone` 的唯一读取方）。
- 纪律：只读盘点。**零受版件改动**（判据 ④），产出即本文件。
- ⚠ **本档不入任何 insights 索引**：colony 盘上并存 3 份索引件、无一份自称权威、无计数哨兵（纪律档 §廿五末条 ⇒ 主班已停止"colony 代登索引"，台账 118 交人工择一）。子班不"顺手代登"。

## 一、五景 × 注入面矩阵（每格给 file:line 或测试件名）

| 景 | registry 读（registryGet 键） | registry 写（registrySet 键） | create 注入形态 | store 订阅↔SHUTDOWN 反注册 | 其它订阅↔清理 | 该面现有测试（件名／例数） |
|---|---|---|---|---|---|---|
| **GameScene**（612 行） | 6 键：`store`:168、`buildMode`:169、`toast`、`audioManager`、`mapRenderer`、`treePanelOpen` | 1 键：`mapRenderer`:189（shutdown:604 写回 `undefined`） | `create(): void` :164（**纯 registry 取件**）＋ :167 `events.once(SHUTDOWN, this.shutdown)` | `store.on(STATE_EVENTS.*)` **9** ↔ `store.off` **9**（:201-214 ↔ :588-596），差集为空 | `input.keyboard.on('keydown-*')` **5** ↔ `off` **5**（:240-246 ↔ :582-586，ESC/SPACE/ONE/TWO/THREE）；`scale.on('resize')` 1 ↔ off 1；`window.setTimeout` 2 ↔ `clearTimeout` 5 | `GameSceneLifecycle.test.ts` **5**、`GameSceneFeedbackBatch2.test.ts` **4**、`GameSceneToastFailure.test.ts` **3** |
| **UIScene**（437 行） | 3 键：`store`:196、`buildMode`:197、`mapRenderer` | **16 键**（面板/管理器注册 :207-255：policyTree/megaProject/military/codex/diplomacy/population/production/grade/scoreCard/audio/settings/saveLoad/influence + toast:218） | `create(): void` :193（**registry 取件 ＋ 自建自注入**）＋ :195 SHUTDOWN once | `store.on` **20** ↔ `store.off` **20**（:259-270 起 ↔ shutdown:347 内），差集为空 | `scale.on('resize')` 1（:293）↔ off 1（:348）；`setTimeout` 2 ↔ `clearTimeout` 4 | `UIScene.test.ts` **4**（含「create 全套面板注册进 registry」「SHUTDOWN 逐一 destroy」「toast 注册位清空」） |
| **TransitionScene**（146 行） | **0 键** | **0 键** | `create(data: TransitionData): void` :45（**scene data 载荷注入**，五景唯一）＋ :47 SHUTDOWN once | 0 ↔ 0（无 store 耦合） | `scale.on('resize')` 1 ↔ off **2**（双保险）；`setTimeout` 1（:42 layout debounce 80ms）↔ `clearTimeout` 3 | `TransitionScene.test.ts` **3**（含「finish 清理：resize off + removeAllListeners（SHUTDOWN 泄漏守卫）」） |
| **ModeSelectScene**（246 行） | 0 键 | 1 键：`gameMode`（:192 `'sandbox'` / :197 `'story'`） | `create(): void` :61（**零参自取＋写出**）＋ :65 SHUTDOWN once（:62-63 注释明写"不移除则 resize 泄漏"） | 0 ↔ 0 | `scale.on('resize')` 1 ↔ off 1；`setTimeout` 1 ↔ `clearTimeout` 2；pointerup 挂在 zone 上（场景随 SHUTDOWN 销毁） | `ModeSelectScene.test.ts` **4**（3 例写卡/模式，1 例 pointerup 就绪；**无一条 SHUTDOWN 清理断言**） |
| **IntroScene**（586 行） | 2 键：`store`:560、`gameMode` | 3 键：`countryName`:557、`identity`:558、`introDone`:574 | `create(): void` :196（**registry 取件＋写回**）＋ :199 SHUTDOWN once | 0 ↔ 0（加起始 modifier 走 store 方法面，不订阅事件） | **DOM**：`inputEl.addEventListener('input', …)` :254 ↔ `removeEventListener` :582（五景唯一 DOM 监听面）；`setTimeout` 1 ↔ `clearTimeout` 2 | `IntroScene.test.ts` **3**（registry 写回＋两道早返回守卫；**无 DOM 监听配对断言**） |

矩阵列数 6（≥4），行数 5。scenes/__tests__ 现役 **9 件 / 31 例全绿**（其中 BootScene 侧 2 件 5 例：`bootLoadErrorDedup` 2、`scatterSourceGuard` 3 ⇒ 五景净覆盖为 **7 件 26 例**）。

## 二、对照 PLAN.md:59 的逐景判定

判据原文（`PLAN.md:59`，实测零漂移）：`Add at least one scene/composition smoke test covering listener cleanup or registry wiring.`

PLAN.md:59 写的是「**至少一件**」⇒ 按字面，全仓已有 ≥1 件即满足。按**逐景**收紧判定（本档的实用口径，供派单用）：

| 景 | registry wiring 是否被钉 | listener cleanup 是否被钉 | 判定 |
|---|---|---|---|
| GameScene | 是（「create 守卫分支：registry 缺 store/buildMode → 错误文案且不订阅」） | **是，且最厚**（SHUTDOWN once 源级钉桩 ＋ store.off 9 事件 ＋ offBuildModeChange 调用并置空） | **已有** |
| UIScene | **是**（「create：全套面板/管理器注册进 registry」） | 半（钉了面板 `destroy` 与 `toast` 注册位清空，**未钉 20 组 store.on/off 的反注册集**） | **部分** |
| TransitionScene | n/a（该景零 registry 耦合，属设计） | **是**（「finish 清理：resize off + removeAllListeners」） | **已有** |
| ModeSelectScene | 是（gameMode 写入被 3 例钉住） | **缺位**（shutdown():242 的 resize off/clearTimeout 零断言） | **部分** |
| IntroScene | 是（countryName/identity/introDone 写回被钉） | **缺位**（DOM input 监听 :254↔:582 配对零断言） | **部分** |

## 三、缺口排序（≥3 条，各带证据与建议单形态）

**缺口 1｜UIScene 的 20 组 `store.on`↔`store.off` 事件名集合等式无人看守**
- 证据：本档计数（剥注释后）UIScene `store.on`=20、`store.off`=20，集合差集为空——但这是**本班脚本算出来的**，仓内**没有任何测试**钉它。`UIScene.test.ts` 的 4 例只覆盖 create 注册、面板 destroy、toast 位清空、危机 toast。同族对照：GameScene 的 9 事件反注册**已被 `GameSceneLifecycle.test.ts` 逐事件钉住**（用例名「shutdown：store.off 反注册 9 个事件」）⇒ 两景厚薄差 3 倍。
- 失效形态：将来给 UIScene 加一条 `store.on` 而忘加 `off`，**全量测试不会红**，热重载/回主菜单后留下幽灵 listener（该文件 :39 注释自己点名的正是这个）。
- 建议单形态：**写单，1 件新测试**（`state` 侧还是 `scenes` 侧见「四·注意」）——从 `store.on/off` 的运行时解析结果导两个集合，断言相等；用例数 ＋2～＋4。零生产码。

**缺口 2｜IntroScene 的 DOM `input` 监听配对零断言（五景唯一 DOM 面）**
- 证据：`IntroScene.ts:254` `inputEl.addEventListener('input', this.inputListener)` ↔ `:582` `removeEventListener(...)`；`IntroScene.test.ts` 3 例的标题集为「立邦完成 registry 写回」「邦名>3 字早返回」「未择身份早返回」，**无一例碰 shutdown 清理**。
- 失效形态：DOM element 不随 Phaser 场景销毁 ⇒ 切到 GameScene 后输入框监听仍活着，`this.inputListener` 闭包持有整景 ⇒ 单向前内存泄漏 ＋ 幽灵回调。TransitionScene 有「finish 清理」用例、本景没有，属**同族不对齐**。
- 建议单形态：**写单，1 件新测试**（假 dom node 计数 add/remove 各恰 1 次）——用例数 ＋2。零生产码。风险低（该文件已有 fake scene 夹具）。

**缺口 3｜ModeSelectScene `shutdown():242` 整体零断言**
- 证据：`ModeSelectScene.test.ts` 4 例全在 create/pointerup/gameMode 面；`shutdown` 字面在该测试件里 **0 命中**（本档脚本实测）。而 :62-63 注释明写「必须手动把 shutdown 绑到 SHUTDOWN 事件，否则场景切走后 scale 'resize' 监听**永不移除**」——即这个清理面**曾经坏过**、修好留了注释，但只留了注释没留用例。
- 失效形态：与缺口 2 同型（回归无看守）。
- 建议单形态：**与缺口 2 并一张单**（「五景 SHUTDOWN 清理面对齐」——逐景钉 resize off ＋ clearTimeout ＋ DOM remove），用例数 ＋4～＋6。合并理由：两案的断言手法与夹具同型，拆开做会写两遍 `fakeScene`。

**缺口 4（弱信号，登记不催办）｜6 个 registry 键有写无读**
- 证据：`tmp/colony12/keys.py`（剥注释后按 `registryGet/registrySet(….registry, REGISTRY_KEYS.X)` 全 src 扫描）读数——`countryName`、`identity`、`diplomacyPanel`、`megaProjectPanel`、`militaryPanel`、`policyTreePanel` 六键 **set=1／get=0**。同时另 16 键均有读取方（`toast` 被 9 处读、`audioManager` 3 处、`store` 3 处）。`countryName`/`identity` 由 IntroScene 写、无人经 registry 读（HUD 读的是另外几个 panel 键）。
- 口径注意：这条只统计**经 typed helper 的读取**，所以真正的否证方式是"有没有绕开 helper 的裸访问"——本档一并测了：全 src 的裸 `registry.get(`/`registry.set(` **仅 1 处命中且属另一个对象**（`data/buildingRegistry.ts:30`，非 Phaser DataManager）⇒ Phaser registry 侧**helper 覆盖率 100%**，"有写无读"不是扫描口径造成的假象。
- 但：这 6 个键可能是「为热重载留的位置」或「UI 面板持有者另有其人」，判死要先看 UIScene shutdown 的 destroy 是不是靠 registry 回读（现读是靠字段）。**属观察，不属缺陷定论** ⇒ 建议只作为 c923-13/台账 82 那条「死数据/闲置面」普查的一条输入，不单开单。

## 四、做单时的注意（避坑，非结论）

1. **`src/renderer/data/__tests__/` 有目录级字面门禁**：`rg -n '\.\./state/' src/renderer/data/__tests__/` 必须 0 命中（比"不得 import"更严，注释里出现字面也算）。因此缺口 1/2/3 这类测试**不要往 data/__tests__ 放**；钉 scenes 自身行为直接落 `scenes/__tests__/`，要把 data 与 state 钉成同集合的断言只能落 `state/__tests__/`。
2. **`fakeScene.ts` 在在册禁碰清单**（纪律档 colony 现值节）⇒ 写缺口 2/3 的夹具时**新建局部替身，不要改它**。
3. **体积门与音效门无关本档**，但改动若碰 `public/audio` 会顶红 `audioSizeSentinel.test.ts`（上限 63,687,734 B，口径禁 `du -sb`）。
4. 行数/键数一律来自**剥注释后的脚本计数**（`tmp/colony12/count.py`、`keys.py`）。首版未剥注释时，UIScene 的 `scale.on('resize')` 被数成 2（:38 注释里写了这个串），真值 1——这类假阳在本仓是复发面（§廿七② 同型）。
5. 本档所有 file:line 是 **18:16–18:20 的现场读数**；取证窗内 `GameScene.ts`/`UIScene.ts`/`MapRenderer.ts` 属他班在途面（`MapRenderer.ts`、`BuildPanel.ts` 曾在本夜在册 7 项里），引本档行号前先 `grep -n` 复锚。

## 五、否证掉的卷宗前提（一条）

- 卷宗：`src/renderer/scenes/GameScene.ts:167`「`const store = registryGet(this.registry, REGISTRY_KEYS.store);`」——**行号漂 1**：该语句实测在 **:168**，**:167** 是 `this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);`。
  ```
  $ grep -n "registryGet(this.registry, REGISTRY_KEYS.store)" src/renderer/scenes/GameScene.ts
  168:    const store = registryGet(this.registry, REGISTRY_KEYS.store);
  ```
  （另注：这个"漂 1 行"恰好漂在 SHUTDOWN 绑定那一行上——按 :167 读会把"关键修复"锚点读成 registry 锚点。本档两处都给了行号，不再引卷宗原行号。）
- 其余三条锚点实测**零漂移**：`ui/registry.ts:29`、`TransitionScene.ts:45`、`ModeSelectScene.ts:61`、`UIScene.ts:193`、`PLAN.md:59`。
- 卷宗「scenes/__tests__ 现有 **10** 件」——实测 **9 件 / 31 例**（`ls src/renderer/scenes/__tests__/` ＋ vitest json reporter 逐件例数）。卷宗自己列的构成（GameScene 3 ＋ Intro/ModeSelect/Transition/UIScene 各 1 ＋ bootLoadErrorDedup 等）数出来正是 8～9 件，"10" 是投料时的锚点过期（§十一「锚点计数常过期」同型）。**不影响本档矩阵成立**。

## 六、取证命令（可复算）

```
$ git rev-parse --short HEAD                # 本班开工第一步（17:58）现读 d3ef561；收班前（18:2x）复跑仍为 d3ef561
$ wc -l src/renderer/scenes/*.ts            # 五景＋BootScene 行数（612/437/146/246/586/103）
$ PYTHONIOENCODING=utf-8 python tmp/colony12/count.py      # 订阅/清理/registry 计数表（剥注释后）
$ PYTHONIOENCODING=utf-8 python tmp/colony12/keys.py        # 22 键的 set/get 生产-消费账（剥注释后）
$ PYTHONIOENCODING=utf-8 python tmp/colony12/titles.py      # 逐件 it() 标题（测试面判定依据）
$ npx vitest run src/renderer/scenes/__tests__/ --reporter=json --outputFile=tmp/colony12/scenes.json   # 9 files / 31 tests 全绿，例数按运行时收集导
$ rg -n "registry\.(get|set)\(" src -o --no-heading | rg -v "__tests__"   # 仅 data/buildingRegistry.ts:30（非 Phaser registry）
$ grep -n "scale.on('resize'" src/renderer/scenes/UIScene.ts            # 293 真订阅；:38 是注释
$ git diff --stat                            # 3 files/11+/841-，全为在册三件（OPTIMIZATION_BACKLOG、dead-exports json 与其 .bak），本班零贡献
```

`tmp/colony12/*.py` 是探针件，本班收工前删除；`.py` 件在 `tmp/`（`.gitignore:25`）内不入 porcelain。三份脚本若需复算本档表格，按上条命令重建即可（逻辑都在本档正文写明：剥注释 → 正则计数 → 集合差）。
