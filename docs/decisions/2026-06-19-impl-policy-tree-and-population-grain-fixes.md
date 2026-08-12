# 2026-06-19 · impl · 国策树全屏界面 + 人口/粮食两个真 bug 修复

> 大型多阶段任务。本文档随实施推进增补。**阶段 1-2（两个真 bug）已落地并经团队评审；阶段 3-6（国策树 UI）进行中。**

## 结构化元数据（阶段 1-2）
- **任务类型**: implement（bug 修复 + 后续大功能）
- **调用模型**: DeepSeek V4 Pro（代码审，quick）+ Kimi K2.6（数值/手感审，medium）。GPT 未单独出实现（改动小且根因明确，单实现 + 独立评审符合基线）。
- **mode**: 核心数值模块 → 评审用 quick 档即可（改动局部）
- **findings 计数**: DeepSeek 1 MAJOR + 2 MINOR + 2 SUGGESTION + 3 nit；Kimi 1"CRITICAL"(设计向) + 3 MAJOR(设计向)
- **接受**: DeepSeek DOUBLE-PENALTY(MAJOR) 已修；Kimi 起始粮缓冲偏紧 → 采纳上调
- **Opus override**: 见下「仲裁」——GRANARY-PERF/CARRY-LOSS/SHRINK-ORDER/ZERO-GRAIN-IDLE 及 Kimi 的农田产出/仓廪重设计/流民UI 暂不改，理由逐条记录。均非 CRITICAL/BLOCKER，override 合规。
- **测试**: `npm run verify` = type-check + 921 测试全绿（新增 13 条：人口超限回落 8 + 双扣门控 2 + 仓廪上限 5 + 真实扣粮 2 + 经济模拟 3，部分合并）
- **残留风险**: 所有平衡数值（起始粮、回落速率、农田净产）未经真人 playtest；农田净产 +5 偏低与"缺粮食消耗出口"是已知设计债（Kimi 指出），留后续。
- **用户是否要求返工**: 否

---

## 原始需求
用户实际试玩截图发现：①国策/朝令看不懂效果没法颁布；②民187/175 人口超上限；③粮9999 粮食爆仓。决定：做 HOI4 式全屏国策树（取代右侧朝堂面板）+ 修两个真 bug。完整方案见计划文件 `agile-hugging-ember.md`。

## 健康检查
`python scripts/health_check.py` → 3 relay 全绿（gpt 2.6s / deepseek 1.7s / kimi 5.4s）。

---

## 阶段 1 — BUG-A 人口超住房上限温和回落

**根因**: `population.ts computePopulationGrowth` 在 `people>=cap` 仅置 rawNet=0、永不回落；cap 下降路径（危机割地/拆房/+cap modifier 到期）后 people>cap 永久滞留。

**改动**:
- `population.ts`: 新增 overflow 分支——`people>cap && grainStock>=dailyConsumption` 时按 `min(ceil(overflow×0.02), 2, people-minPop)` 温和回落，reason='overflow'，carry 清零。
- `gameStore.ts`: 新增 `shrinkPopulationClasses(n)`（农→工→兵→士级联，统一负增长出口）；runPopulationTick 负增量走它；传 minimumPopulation + dailyConsumption。
- `balanceConfig.ts`: population 新增 `homelessDeclineRate:0.02 / homelessDeclineMax:2`（双表）。
- `HUD.ts`: reason='overflow' → ▼ + 金色（玩家可见"超限正回落"）。

## 阶段 2 — BUG-B 人口每日真实扣粮 + 仓廪上限接线

**根因**: `runStarvationTick` 算了 `computeClassConsumption().totalGrain` 却只判饥荒、从不扣库存；productionSystem 显式跳过 people upkeep → 粮食几乎无消耗、爆仓。

**改动**:
- `gameStore.ts runStarvationTick`: 入口真实扣粮 `addResource('grain', -consumption.totalGrain)`；用**扣前库存 grainBefore** 判 grainNegativeDays（避免 clamp 误判）；缺口减员仍由 applyStarvation 独家负责（此处不额外减员，杜绝双扣）。
- `gameStore.ts getResourceCap(id)` + RESOURCE_CAP_BASE：接线 bld_granary"储量+50%"死功能——每座 working 仓廪 ×1.5 线性叠加、封顶 ×3；`setResourceClamped` 改用之。people 不受影响（住房上限另算）。
- `balanceConfig.ts`: 起始粮 sandbox 50→250、story 80→320（早期生存 + 评审建议放宽）。

**适配的旧测试**（旧测试编码了"粮食不被消耗"的 bug 世界，按新正确行为更新，非掩盖）:
- "working farm gives grain" 旧断言精确 +5 → 改断言"净增>0"（人口现真实吃粮，且 minDailyGrowth 让人口从 0 冒出进食）。
- "人口随天数增长" 旧设定无产粮源 → 注入 6 座 working 农田提供可持续余粮（否则 500 粮被吃光后饥荒回落到下限，恰是新正确行为）。

---

## DeepSeek V4 Pro 评审（verbatim 摘要，verdict: ship-with-fixes，五维度：功能✅/边界✅/安全 未发现/性能✅/可维护 未发现）

- **DOUBLE-PENALTY (MAJOR, 功能/边界)**: runPopulationTick(超限回落) 先于 runStarvationTick(饥荒减员)；当 `people>cap` 且 `0<grainStock<consumption` 时同 tick 双扣。建议：超限回落前检查粮是否够喂，不够则让位饥荒。→ **已修**（见下）。
- **GRANARY-PERF (MINOR, 性能)**: getResourceCap 每次 setResourceClamped 都遍历 buildings。建议缓存 granaryCount。
- **CARRY-LOSS-ON-OVERFLOW (SUGGESTION)**: overflow 返回 carry=0 丢弃增长残差。
- **ZERO-GRAIN-IDLE (MINOR, 边界)**: grainStock<=0 且 people>cap 时 idle、流民不流失。
- **SHRINK-ORDER (SUGGESTION)**: 总从 farmer 起扣或削弱产粮。
- nits: idle carry 重复 Math.max（已清理）；starvation 后 grainNegativeDays 未重置（轻微过罚）。
- 好评: 起始粮上调显著改善早期生存；grainBefore 口径正确避免误判。

## Kimi K2.6 评审（verbatim 摘要，方案/手感，均标注"行业惯例/推测"，未联网）

- **EARLY-FOOD (设计 CRITICAL)**: 7 天缓冲对新手太紧（《放逐之城》给 1-2 年、《纪元》开局自带产业链）。建议起始粮 sandbox 250-400。→ **部分采纳**（上调到 250/320）。
- **FARM-YIELD (设计 MAJOR)**: 农田净产 +5（产10雇5吃5）供养比 1:1 太紧，>50% 人口被锁死在农田，不敢养兵养士。建议净产提到 +10~+15。
- **OVERCAP-DECAY (设计 MAJOR)**: 单日掉 2 对百人国家几乎无感、玩家以为没修；建议加速 + 加流民 UI 红标。
- **GRANARY-CAP (设计 MAJOR)**: 抬上限只是把爆仓推迟，真正该做的是加粮食消耗出口（军粮俸禄/赈灾/酿酒加工链/腐败/季节）。
- 替代机制建议：农时+腐败、粮食三级响应(紧粮→罢耕→流民)、食物分级+军屯。

---

## 仲裁（Opus，按防偏置规则）

立标准：正确性 > 防雪崩安全 > 早期可玩性 > 手感打磨。

1. **DOUBLE-PENALTY (MAJOR) → 接受并已修**: `population.ts` 超限回落改为仅 `grainStock>=dailyConsumption`（真有余粮够喂当前人口）才触发；粮不足以喂饱时 reason='cap' 让位 applyStarvation。gameStore 传入 dailyConsumption=grainPerDay。新增 2 条测试证明门控（存粮10<口粮20→cap不回落；存粮100>口粮20→正常回落）。
2. **Kimi EARLY-FOOD → 部分采纳**: 起始粮 sandbox 150→250、story 220→320（约 11-13 天窗口）。未取 Kimi 上限 400，因更高值应由 playtest 定，避免盲目过调。
3. **暂不改、记录在案的 override**（均非 CRITICAL/BLOCKER，合规）:
   - GRANARY-PERF (MINOR): buildings 仅数十、addResource 每 tick 数十次 → 数百次迭代/2s，可忽略；缓存需在建造/拆除/状态变更多处同步、增 bug 面，性价比低，**接受现状**。
   - CARRY-LOSS (SUGGESTION): 回落期清零增长残差是**有意设计**（已注释），避免负 carry 拖延后续增长，**保留**。
   - ZERO-GRAIN-IDLE (MINOR): grainStock<=0 时 applyStarvation 会减员（grainNegativeDays→减员），并非"无限滞留"，**接受**（仅人口已到下限的极端边界停住，可接受）。
   - SHRINK-ORDER (SUGGESTION): 与 applyStarvation 的 STARVATION_ORDER 一致（计划明确要求同序），**保留**。
   - Kimi FARM-YIELD / GRANARY 真修=消耗出口 / 富流民UI: 改农田产出、加粮食消耗出口/腐败/军屯属**平衡重设计**，超本次"修两个 bug"范围，且需 playtest 才能定数值；HUD 已有 ▼+金色基础反馈。**记为后续 playtest/设计债**。

---

## 阶段 3-6（国策树 UI）

### 结构化元数据（阶段 3-6）
- **任务类型**: implement（新核心 UI 模块）
- **调用模型**: DeepSeek V4 Pro（代码审，quick）。Kimi 未单独再审（UX 已在阶段 1-2 概念性覆盖，渲染观感需真人 playtest）。
- **findings 计数**: DeepSeek 5 维度各 ≥1：Security/Edge/Perf/Readability/Design，无 BLOCKER/CRITICAL
- **接受**: treePanelOpen 复位、onPointerMove 死代码简化、平移 clamp（3 条）已修
- **Opus override**: scene.shutdown 自绑 / 全量重绘性能 / depth 冲突 / 若干 nit —— 见仲裁，均非 critical
- **测试**: `npm run verify` = type-check + 932 测试全绿（新增 21：PolicyTreePanel 12 + modifierDescriber 9；删除 CourtPanel.test 10）
- **残留风险**: 国策树渲染观感/可用性未经真人 playtest（节点重叠、连线清晰度、缩放手感）；右面板退休后地图右侧布局变化需肉眼确认
- **用户是否要求返工**: 否

### 实现摘要
- **阶段 3**: 新建 `state/modifierDescriber.ts`——TARGET_LABEL（26 个 modifier target 全覆盖中文）+ describeEffect（mul→%，add→带符号）+ describeEffects。9 单测，含"全 key 有标签"守护。
- **阶段 4+5**: 新建 `ui/PolicyTreePanel.ts`（全屏「朝堂」界面，两 tab）：
  - 照 EventModal 搭全屏遮罩 + 引用计数时停（requestPause/releasePause('policyTree')）；STATE_REPLACED 强制关闭。
  - 国策 tab：按 def.x/def.y 摆树、prerequisites 画正交连线、五态着色（已采纳/可采纳/资源不足/前置未足/互斥已锁）。
  - 朝令 tab：按 category 分行、chainPrev 串链、多阶进度格。
  - 内层 treeContainer 做 setScale(zoom)/setPosition(pan)，默认 fit-to-screen，滚轮锚点缩放 + 拖拽平移（4px 阈值区分点击）+ 平移 clamp。
  - 节点点击采纳（dragMoved 守卫防拖拽误触）、悬停浮窗（descPlain + describeEffects 精确数值 + 成本 + 状态）——**直击"看不懂效果"痛点**。
  - 新建 `ui/courtFormat.ts`（formatCost/RESOURCE_LABEL/failPolicyMsg/failDecreeMsg 共享 helper）。
  - 接线：UIScene 注册/销毁；HUD 加"朝堂"按钮；GameScene handleWheel/PointerMove/PointerDown 加 treePanelOpen 守卫（树开时地图不响应滚轮/拖拽/放置）。12 单测。
- **阶段 6**: 退休 CourtPanel——删 `ui/CourtPanel.ts` + 其测试；UIScene 移除引用；右面板视口预留改为与存档无关的常量（GameScene isRightCollapsed 恒 true + isPointerOverPanel rightW=28；ZoomControl rightPanelW=28），MapRenderer 视口数学未碰（复用既有"折叠"代码路径，零新风险）。地图右侧多占空间、留 28px 边距。

### DeepSeek V4 Pro 评审（verbatim 摘要，verdict: ship-with-fixes，五维度全覆盖）
1. **Security**: PolicyTreePanel 未自绑 scene 'shutdown' → 若 destroy 未被调用则监听/pause 泄漏。建议 scene.events.once('shutdown', destroy)。
2. **Edge**: destroy() 未复位 treePanelOpen → 异常拆解后地图永久锁死。建议 destroy 顶部复位。
3. **Perf**: 每次 store 事件全量重绘 edges/nodes；DAY_TICK 每卡 active.find() O(n)。建议缓存。
4. **Readability**: onPointerMove 拖拽判定有死代码 + 阈值逻辑不直观。建议简化。
5. **Design**: (a) 平移无 clamp，可把树拖出屏幕找不回；(b) 与 EventModal 同 depth 2000，同现时层叠不确定。

### 仲裁（Opus）
- **接受并已修**: #2 treePanelOpen 复位（destroy 顶部）；#4 onPointerMove 简化（采纳 DeepSeek 写法）；#5a 平移 clamp（新增 clampPan，保证 ≥160px 内容留在可视区）。
- **override（记录理由，均非 critical）**:
  - #1 scene.shutdown 自绑: **不改**——全项目所有面板（EventModal/DiplomacyPanel 等）都不自绑、统一靠 UIScene.shutdown 调 destroy()；PolicyTreePanel 遵循同约定，且 destroy() 有 destroyed 幂等守卫 + UIScene.shutdown 已可靠调用。自绑反而偏离约定。
  - #3 全量重绘: **不改**——面板仅在打开（=游戏暂停）时 refresh，暂停下 DAY_TICK 不推进、事件不触发，重绘只由用户采纳动作驱动（低频），且数据量小（24 国策/12 朝令）。无实际性能问题。
  - #5b depth 冲突: **不改**——树打开即暂停，事件不会在暂停时新触发，二者实际互斥；模态栈管理器超本次范围。已知极端边界。
  - nits（CATEGORY_ORDER 未知类别/toast 静默/tooltip 宽度/hint 碰撞/destroy 不置空）: 类别为类型封闭枚举无未知项；其余影响极小，沿用既有面板惯例，**接受**。

### 残留风险（需 playtest）
国策树的"好不好用"（节点是否重叠、连线是否清晰、缩放/平移手感、效果浮窗信息量）和右面板退休后的地图布局，都需真人开 exe 实际操作确认——本轮仅保证逻辑正确 + 测试绿，渲染观感未验证。

---

## Round 2（2026-06-19 同日）：首次真人 playtest 反馈修复

### 结构化元数据
- **任务类型**: 修 playtest 反馈（4 bug/体验 + 1 版本号）
- **调用模型**: DeepSeek V4 Pro（代码审，quick）。先派 3 路内部 Explore 定位根因。
- **findings 计数**: DeepSeek 1 CRITICAL + 3 MAJOR + 2 MINOR
- **接受**: CRITICAL(滚动口径) + 2 MAJOR(拆除无法平移/死代码) + 1 MAJOR(顶栏 1280 溢出，部分缓解) 已修
- **Opus override**: DOUBLE-REMOVE(同步移除不会双找)、VER-TEST-STALE(文件名 cosmetic) 不改
- **测试**: 932 全绿、type-check 干净
- **exe**: 0.9.0，win-unpacked 已更新（10:49）
- **残留风险**: 顶栏 1280 最小宽度下日期与右侧按钮仍可能轻微重叠（用户惯用最大化宽屏，未实测）；季节/起始粮/回落等数值仍待持续 playtest

### 玩家反馈 → 根因 → 修复
1. **"国策点了没生效"（采铜/兴学没解锁铜冶坊/学宫）** —— 真因不是 bug 也非回归：国策确实采纳成功，但这两栋是 tier-2 建筑，被 `isBuildingUnlocked` 的**国格门槛(需国格1·城邑)**挡住，且 BuildPanel **直接隐藏**未解锁建筑、零提示，玩家误以为国策没用。修复：gameStore 新增 `getBuildingUnlockInfo`（buildable/grade_locked/prereq_locked）；BuildPanel 把"前置已足仅差国格"的建筑**灰显 + 显示「需晋城邑」**而非隐藏，点击给 toast。让玩家明白国策已生效、还差升国格。
2. **拆建筑拆不了** —— 拆除本就绑左键，但走 pointerup + isLeftPanning + 4px 阈值，易被吞。修复：GameScene handlePointerDown **左键按下即拆**（点中建筑立拆，点空地不拦截、仍可拖动平移）。右键保留为"退出拆除"。
3. **季节粮食波动太大** —— 春粮×1.3/秋×1.2 + 冬耗×1.2，叠加新的恒定吃粮，农田数极难配平。修复：春粮 1.3→1.1、秋粮 1.2→1.15、冬耗 1.2→1.1，产出 swing ~30%→~15%。（数值待 playtest）
4. **顶栏「民120/120布」挤一起** —— tokenW=104 只够两位数，三位数 X/Y 溢出。修复：people token 单独加宽到 120 + 该数字字号调小到 16px。
5. **版本号没改** —— package.json 0.8.0→0.9.0；IntroScene 副标题 v0.8→v0.9。

### DeepSeek 评审 + 仲裁（Round 2）
- **CRITICAL 滚动口径不一致**（BuildPanel.onWheel 仍用 isBuildingUnlocked，与 layout 的 getBuildingUnlockInfo 口径不符→灰行滚不到底）→ **已修**（onWheel 改用同口径）。
- **MAJOR 拆除模式无法左键平移**（拆除分支无条件 return 吃掉平移）→ **已修**（仅拆到建筑才 return，点空地 fall through 到平移）。
- **MAJOR pointerup 拆除死代码** → 随上一条修复一并复活（点空地拖动后松手于建筑仍可拆），不再是死代码。
- **MAJOR 顶栏 1280 溢出**（peopleTokenW=150 把日期挤进按钮）→ **部分缓解**（150→120 + 字号 16px）；1280 极窄下残留风险已记，用户惯用宽屏。
- **MINOR 双拆 / 版本测试文件名** → override（removeBuilding 同步移除，findBuildingAt 不会二次命中；测试文件名 cosmetic）。

---

## Round 3（2026-06-19 同日）：补齐 13 栋缺图建筑美术

- **缘由**: 玩家反馈"占位文字方块（陶陶陶）玩起来难受"，先补美术。33 栋建筑原只有 20 栋有图、缺 13 栋；地形/草木已齐、人物为 0（本轮只补建筑）。
- **管线（已验证可跑，key 在 D:\code\.env.local 的 WANXIANG_API_KEY）**：
  1. `scripts/gen_buildings_art.py` 的 BUILDINGS 列表给 13 栋各写春秋写实英文 prompt（复用 ISO_STYLE 尾：真等距2:1 / 夯土原木灰陶瓦 / 黑底待扣 / Anno1404质感 / 禁秦汉后元素）。
  2. `python scripts/gen_buildings_art.py --model wan2.7-image-pro --only <ids>`（通义万相付费 API，~10-13s/张；4 并发偶发 429 限速→ `--workers 2` 重试）。
  3. `python scripts/postprocess_buildings.py`（抠黑底→透明+裁剪，从 buildings_raw 备份重做幂等）。
  4. `python scripts/gen_building_anchors.py`（重算地基锚点→ buildingAnchors.generated.ts，现 33 条；新图必跑否则浮空）。
- **质量把关**: Opus 逐张 Read 看图验收——13 栋全部等距、风格与既有 20 栋一致、达标。
- **覆盖率**: 建筑 20/33 → 33/33（100%）。人物立绘仍 0（用户本轮选择只补建筑）。
- **验证**: `npm run verify` 932 全绿（含锚点测试 33 条）；exe 重建 0.9.0（11:22）。
- **残留**: 人物/事件插画未补；既有 20 栋里仅约 3 栋是"质量标杆"，其余未重制。
