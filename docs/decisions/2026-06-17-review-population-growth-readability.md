# 2026-06-17 · review · 人口（民）系统体检：增长慢 + 可读性差 + 缺陷排查

## 结构化元数据
- **任务类型**: review（诊断为主）+ implement 预备（数值/UX 优化方案）
- **调用模型**: DeepSeek V4 Pro（代码质量审，deep）+ Kimi K2.6（数值/UX 方案审，medium）+ GPT-5.5（gpt-coder，**本轮跑飞，零有效产出**）
- **mode**: deep（核心模块 + 用户明确要优化）
- **findings 计数**: BLOCKER×1 / CRITICAL×1 / MAJOR×3 / MINOR×1 + UX(BLOCKER×1, CRITICAL×2, MAJOR×1, SUGGESTION×2) + 若干 nitpick
- **接受**: 全部 critical/blocker 级别接受（无单人豁免）
- **Opus override**: 1 处——ID-1 严重度，DeepSeek 标 BLOCKER，Opus 接受其为真 bug 但补注"实际触发门槛极高（需 people→9999，而游戏门槛仅到 320 量级）"，仍归入必修（修复成本一行，消除状态漂移）。**未豁免，仅补充触发条件。**
- **测试是否通过**: 尚未改动，落地后需跑 `npm run verify`（type-check + 900 测试）
- **残留风险**: 增长新数值与可读性方案的"手感"未经真人 playtest（项目最大暗雷依旧是从未 playtest）
- **用户是否要求返工**: 否（首次诊断）

---

## 原始需求（用户原话）
> 通过团队协作系统查一查邦国录现在状况，看看有没有什么缺陷 bug 和需要优化的地方；另外民的增长速度太慢了，并且这种表现形式可读性太差，我都不知道我的民是什么情况。

定位：「邦国录」= `colony-game`（春秋立国经营游戏，Electron+TS+Phaser，v0.8.0）。"民" = `resources.people`（总劳力池）+ `populationClasses`（农/工/兵/士四阶层）。

---

## 健康检查
`python scripts/health_check.py` → 3 relay 全绿（gpt 2.4s / deepseek 2.2s / kimi 5.0s）。

---

## DeepSeek V4 Pro 审查（verbatim，deep 档，6 条发现，verdict: do-not-ship）

**五维度覆盖**：功能✅找到 / 边界✅找到 / 安全✅找到 / 性能✅找到 / 可维护✅找到。

### ID-1 — BLOCKER — 功能/边界
- 证据: `gameStore.ts runPopulationTick` ~L1688；`setResourceClamped` L447-449
- 触发: 人口接近 9999 上限，或建大量住房后 peopleDelta>0
- 影响: `addResource('people', delta)` 内部 clamp 到 [0,9999]；但随后 `populationClasses.farmer += delta`（未 clamp 的原始 delta），classTotal 超 9999，末尾 `resources.people = classTotal` 直接赋值**绕过 9999 上限**，并使 farmer 可超 housingCap → 下一 tick 仍低估 people → 理论可无限增长 + 状态漂移。
- 建议: 用 addResource 前后实际差值 `actual = people_after - people_before` 给 farmer 自增；末尾改 `setResourceClamped('people', classTotal)`。
- 置信度: 高

### ID-2 — CRITICAL — 功能
- 证据: `runPopulationTick`(starve 分支, population.ts L67-70) + `runStarvationTick`(applyStarvation, populationClassSystem.ts L108-142)
- 触发: grainStock<=0 且 grainNegativeDays>=graceDays(5)，即第 6 天起持续断粮
- 影响: **同一 tick 两套饥荒机制同时扣**：computePopulationGrowth 按 people×0.01 扣 resources.people；applyStarvation 又按 mildRate 0.02 扣 populationClasses 再 addResource(-lost)。100 人第 6 天实际扣 3（设计应 2），第 15 天起 1+5=6（设计应 5），实际死亡 1.5~2× 设计值，且两路径更新人口漂移概率高。
- 建议: 从 computePopulationGrowth **移除** grainStock<=0 的 starve 分支（改 rawNet=0, reason='idle'），饥荒减员由 applyStarvation 独家负责。
- 置信度: 高

### ID-3 — MAJOR — 边界
- 证据: population.ts L81-87
- 触发: starve tick 把 carry 赋负（如 -0.7）→ 下一 tick 恢复 grow rawNet=+0.3，total=-0.4，trunc=0，carry=-0.4 持续累积
- 影响: 粮食恢复后人口因负 carry 积压数十 tick 不增长，体感"人口卡住"
- 建议: 趋势符号反转时（rawNet>0 && carry<0 或反之）重置 carry=0
- 置信度: 高
- **【Opus 注】修 ID-2（starve 不再进此函数）后，本问题大幅自动缓解——carry 不会再被赋负值。**

### ID-4 — MAJOR — 设计
- 证据: population.ts L71-72 注释"拆房不杀人口"
- 触发: 盖房让人口涨到 200，再拆房使 housingCap 降回 25
- 影响: people=200 >= cap=25 → rawNet=0 永久冻结在 200，住房上限形同虚设，玩家可"拆房套娃"绕过上限
- 建议: people>housingCap 时施加负压（如 -(people-cap)×0.005）或"无家可归"缓慢衰减
- 置信度: 高

### ID-5 — MAJOR — 可维护
- 证据: population.ts L51-56 注释 vs applyStarvation vs gameStore L1663 注释"走 addResource 自带 clamp"
- 影响: 两套饥荒逻辑并存无文档说明优先级；注释"自带 clamp"与 ID-1 实际绕过行为不符，误导维护者
- 建议: 合并饥荒路径 + 修正注释
- 置信度: 高

### ID-6 — MINOR — 性能
- 证据: computeClassOccupation 每 tick 全量遍历建筑 + defLookup；applyStarvation 循环内重复 totalPopulation
- 影响: 当前小项目无感，建筑多时成热点
- 建议: 脏标记缓存 occupation；循环外缓存 totalPopulation
- 置信度: 中

### 较小问题（nitpick）
- 1e-9 清零门槛每 tick 吃掉极微残差，数百 tick 后理论/实际人口可测量偏差（无害）
- tickConversionQueue daysRemaining=0 当 tick 立即完成；负值静默完成
- getBalanceConfig 硬编码 story|sandbox，Phase2 加模式是改动点

### 做得好
- carry 小数残差机制设计正确，解决"每天+0.08 永远取整为0"
- CLASS_CONSUMPTION / DEFAULT_STARVATION 表驱动，调参只改数据文件

---

## Kimi/方案审（verbatim，增长节奏 + 可读性，medium 档）

> 注：kimi-researcher agent 报告其先以自身知识完成分析。内容扎实可用，作为 UX/数值维度输入采纳。

### 问题 A — 增长慢
- **A-01 CRITICAL/UX**: 每日增量=max(20×0.012,0.3)=0.3，1x 下 4 天(8秒)才跳 1 整数 → "什么都没发生"。建议 minDailyGrowth 0.3→1.0~1.5，growthRate 0.012→0.018~0.025。【行业惯例：城建类可见反馈周期 5~15 秒，Anno 1800 居民约每 10 秒跳动】
- **A-02 CRITICAL/UX**: baseHousingCap=25，开局余量仅 5，约 34 秒撞上限**无提示**冻结，玩家误以为坏了。建议 baseHousingCap 25→40~45，或首座民居设强制引导。
- **A-03 MAJOR/UX**: growthRate 固定 0.012，中期 80→320 需约 230 秒无加速手段。建议引入余粮正反馈 + 分段 growthRate（早 0.020/中 0.016/后 0.012）。【分段为个人推测，需实测】
- **A-04 SUGGESTION**: 余粮只有有/无二值。建议 effectiveRate = baseRate × clamp(surplusRatio,1.0,1.5)，余粮够1天×1.0/3天×1.2/7天×1.5。【Banished/Frostpunk 有类似机制】
- **A-05 SUGGESTION（置信低）**: 空房率加成，力度应弱（≤×1.05）或不引入。
- **根因叠加**: minDailyGrowth 太小（早期元凶）+ cap 太早卡死（第二杀手，且无提示）+ growthRate 偏低（慢性）三者共振。

### 问题 B — 可读性
- **B-01 BLOCKER/UX**: 顶栏 `8/40` 无标注，无法区分闲置/总数/上限。改 `闲 8 · 总 40/上限 50`。【主流城建均有明确标签】
- **B-02 CRITICAL/UX**: 住房上限不显示，只能等冻结才发现撞顶。加上限 + >80% 变色预警。
- **B-03 CRITICAL/UX**: 无增长趋势，不知涨跌。加箭头 `▲+1/日`/`━ 冻结`/`▼-0.3/日`。
- **B-04 MAJOR/UX**: 农/工/兵/士四阶层无界面展示，复杂系统成黑盒。详情面板展示阶层分布。
- **B-05 SUGGESTION**: 无饥荒预警。详情面板加"粮够 X 日"，<3 日变色。

**顶栏方案**: `民：闲8 · 40/50 ▲+1/日`（正常）/`40/40 ━ 居室已满`（橙）/`40/50 ▼ 粮尽`（红）
**详情面板方案**（"国中之民"）：总口/居室(40/50)/今日趋势/农工兵士各自 在岗·闲 / 粮储够X日 / 居室余量。文案半文半白，禁"黔首/庶黎"等偏字。

**最高性价比 3 改**:
1. minDailyGrowth 0.3→1.2 + baseHousingCap 25→45（A-01+A-02，5 分钟）
2. 顶栏加标注+趋势箭头+变色（B-01+B-02+B-03，1~2 小时）
3. 详情面板阶层分布+粮储预警（B-04+B-05，0.5~1 天）

---

## GPT-5.5（gpt-coder）— 本轮失败记录
- agentId af5f875359998c01f：**560 tool_uses / 5589s（93 分钟）**，输出仅 "Two watchers running — Standing by."
- 误把自己当协调者去"等待后台任务"，未产出交付的"重平衡数值方案 + HUD 设计"。
- 处理：本轮按 GPT 缺席处理，由 DeepSeek（正确性）+ Kimi（UX/数值）+ Opus（数值复核）三方支撑结论。落地实现时若需第二补丁再单独调 GPT。

---

## Opus 仲裁 — 验收维度与分档

**验收维度（先立标准）**: 正确性 40% / 玩家体感（增长手感+可读性）35% / 可维护 15% / 性能 10%。

### 必修（正确性，直接做，无需问用户）
- **ID-2 双重饥荒扣减**（CRITICAL，触发现实）→ 移除 computePopulationGrowth 的 starve 分支，饥荒归 applyStarvation 独家。
- **ID-1 人口同步绕过 clamp**（BLOCKER，触发门槛高但修复一行）→ farmer 用实际差值；末尾 setResourceClamped。
- 顺带 **ID-3 负 carry**（修 ID-2 后基本消解，再加符号反转重置）+ **ID-5 注释/职责**（合并后修正）。

### 增长优化（用户核心诉求 A，产品决策——问用户选幅度）
- minDailyGrowth 0.3→1.0~1.5、baseHousingCap 25→40~45、growthRate 0.012→0.018~0.025，可选余粮正反馈。

### 可读性优化（用户核心诉求 B，产品决策——问用户做到哪步）
- 必做 B-01 顶栏标注；B-02 上限+变色；B-03 趋势箭头；可选 B-04 阶层详情面板 + B-05 粮储预警。

### 建议修（健壮性，可随增长优化一起做）
- ID-4 拆房套娃绕过上限（超限缓降）。

### 可不修
- ID-6 性能、carry 1e-9 nitpick、conversion 边界、getBalanceConfig 硬编码。

---

## 给用户的 summary（实际展示）
见对话。要点：查出 2 个真 bug（缺粮多杀人 / 人口计数会漂移）；增长慢三根因（每日下限太小 + 起始房太少太早卡顶 + 增长率偏低）；可读性差因顶栏只有个无标注的 `8/40`、看不到上限/趋势、四阶层无界面。bug 我直接修，增长幅度和可读性改造幅度问用户拍板。

---

## 落地实现 + DeepSeek 二轮复审（2026-06-17 当日完成）

**用户拍板**：增长「适中加快（+余粮正反馈）」；可读性「顶栏 + 详情面板」。

**改动文件**：
- `state/population.ts`：移除缺粮 starve 分支（→ idle，减员归 applyStarvation 独家，修 ID-2/ID-5）；删 starveRatePerDay；加 rawNet；carry 归零条件改为仅保留正残差（根治 ID-3 负 carry）+ 入口 `Math.max(0,carry)` 防御（ID-R2）。
- `state/gameStore.ts`：runPopulationTick 用 addResource 实际差值给 farmer + 末尾 setResourceClamped（修 ID-1 clamp 绕过）；新增余粮正反馈 surplusMul（grainPerDay=0 按基准，ID-R3）；保底 minDailyGrowth 只随季节、不被余粮放大（ID-R4）；新增 getPopulationStatus getter（趋势/阶层/粮储快照，复用既有 getHousingCap）。
- `data/balanceConfig.ts`：minDailyGrowth 0.3→1.2、baseHousingCap 25→45（故事 35→55）、growthRatePerDay 0.012→0.02。
- `ui/HUD.ts`：顶栏「民」从 `闲/总`(8/40) 改 `当前/上限 + 趋势箭头`(▲▼●─) + 状态变色（守 11 色板）+ 点击打开详情面板。
- `ui/PopulationPanel.ts`（新）：国中之民详情面板——总口/居室/今日趋势/农工兵士在岗·闲/粮储够几日/居室余量，半文半白。
- `scenes/UIScene.ts`：挂载 PopulationPanel（registry 注册 + layout + destroy）。
- 测试：population.test.ts 适配（缺粮→idle、加 rawNet 断言）；gameStore.test.ts cap 断言改动态 `getHousingCap()`。

**DeepSeek 二轮复审（deep）**：首轮 verdict do-not-ship → 确认 ID-1/ID-2 已修，新提 6 条。
- **接受并修**：ID-R4（MAJOR，minDailyGrowth 被余粮放大→改只随季节）、ID-R3（MAJOR，grainPerDay=0 满加成→按基准 1.0）、ID-R2（标 BLOCKER，加 `Math.max(0,carry)` 防御封死历史负 carry）。
- **Opus override（留痕，防"运动员兼裁判"）**：
  - ID-R1（MAJOR，addResource emit 原始 delta）：rebut——既有 addResource 通用行为、非本次引入；people 实际到不了 9999 且 people 分支不走飘字，无触发；改它影响全局资源、风险大，不在本 scope。
  - ID-R5（MINOR，sync 每 tick 跑）：rebut——totalPopulation 仅 4 次加法，单局开销可忽略；加守卫反而可能漏掉其他改 classes 的路径。
  - carry `>1e-9` 阈值 nit：rebut——负值归零是**故意**的 ID-3 修复手段，非 bug。
  - ID-R6（SUGGESTION，magic number 注释）：部分采纳，关键处已加注释。
- **override 累计**：本任务共 4 处（诊断轮 ID-1 严重度 1 处 + 复审轮 rebut 3 处），均属"非本次引入 / 故意设计 / 无触发"类，未降级任何真 critical。ID-R2 这条 BLOCKER 走的是"修"而非"豁免"。

**测试**：`npm run verify` → type-check 干净 + 901 测试全绿（首轮落地 + 复审修复后两次均验证）。
**exe**：`npm run electron:build:win` 重新打包刷新 `dist-out/win-unpacked/邦国录.exe`。
**残留风险**：增长「适中加快」的手感系初版锚点，需真人 playtest 校准（项目最大暗雷仍是从未 playtest）；余粮 ×1.5 与季节 ×1.5 叠加（growthRate 最大 2.25×）已确认不爆——受 housingCap 的 room clamp 兜底。GPT-5.5 本轮全程缺席（开局跑飞），第二实现角色由 Opus 兼任、DeepSeek 二轮把关。
