# 2026-06-19 · impl · 把"空壳系统"接进玩法（准完全体）

## 结构化元数据
- **任务类型**: implement（4 空壳系统接线 + 经济闭环 + UX 打磨）
- **调用模型**: DeepSeek V4 Pro（P3+P4 代码审，深度 high）。P1/P2 低风险 UI 接线未单独送审。三路 Explore 前期摸 API。
- **mode**: 核心/数值敏感（P4 军事）→ 评审重点压 P4
- **findings 计数（DeepSeek，P3+P4）**: do-not-ship；5 维度各 ≥1（含 NaN 除零、一兵两用、将领叛逃悬空、存档浅拷贝、军力覆盖erase NPC delta）+ 若干 nit
- **接受/已修**: resolveBattle 除零+伤亡封顶、守土用 availableSoldiers+最强守备兵种、将领出征中不叛逃/不可遣散、存档深拷贝 config.units+钳忠诚
- **Opus override**: 见仲裁——computeCurrentMilitaryPower 每 tick 覆盖 playerMilitaryPower（保留以让"军队驱动 NPC 尊重/兴师"，NPC 标量 delta 被军队派生重算取代属已知取舍，因真实攻防已改为减兵阶层而非扣标量）；getAvailableUnitTypes 性能 nit（数据小，可忽略）；按资源区分短缺反馈（暂只 morale，记后续）
- **测试**: `npm run verify` = type-check + 948 测试全绿（新增 ~16：FactionDemandModal 5 + MegaProjectPanel 5 + P3 供养 2 + P4 军事 4）
- **exe**: 0.9.0 重建（13:17）
- **残留风险**: 所有军事/经济数值（战斗胜率、兵种数值、将领忠诚、招募成本、阶层供养、来犯频率、起始缓冲）未经真人 playtest，落地即"待校准"

## 背景
首次 playtest 后用户要求把"代码写了、测试绿、玩家碰不到"的系统接成可玩，做到"准完全体、只差试玩"。军事选"全套真实"。

## 各阶段
- **P1 阶层博弈**: STATE_EVENTS 增 FACTION_DEMAND_TRIGGERED/RESOLVED；runFactionTick 设诉求时 emit（解静默死锁）；新建 `ui/FactionDemandModal.ts`（接受/拒绝→resolveFactionDemand）；effect 的 goldMul/researchMul 此前算了不落地，现包成永久 modifier 真正生效。
- **P2 巨型工程**: STATE_EVENTS 增 MEGA_PROJECT_STARTED/COMPLETED + emit；新建 `ui/MegaProjectPanel.ts`（铸九鼎/作春秋/修直道，前置太庙/阶段进度/兴建按钮）；HUD「大业」按钮。
- **P3 经济闭环**: runStarvationTick 追加真实扣 cloth/bronze/gold（工要布/兵要铜/士要钱），**非致命短缺**（扣到0即止 + 短缺 morale-1）；起始加 cloth/bronze 缓冲。
- **P4 军事+将领（全套）**: GameState 加 generals/activeExpeditions/defenseAlerts + saveLoad 序列化/迁移；gameStore computeCurrentMilitaryPower（兵×可用最强兵种×将领指挥，让兵/军事建筑/将领真正驱动军力）、recruit/dismissGeneral、launchExpedition、runMilitaryTick（出征推进+resolveBattle 结算 loot/伤亡/声望/将领忠诚、来犯预警倒计时+守土/劫掠结算、每月忠诚衰减、偶发来犯预警）；"兴师"改用军队派生军力；hasAvailableGeneral 真实化；新建 `ui/MilitaryPanel.ts`（军力/将领招募遣散/出征/来犯）+ HUD「军务」按钮 + 来犯/出征 toast。8 兵种与新补美术建筑(兵营/练兵场/马厩/战车坊/禁军府)对齐。
- **P5 UX 打磨**: Toast 从右下角挪到**正中偏上** + 加大字号/淡入（用户反馈不显眼）；国策树节点已采纳显 ✓、互斥显 ⊘（修"静态看不出已采纳"）。铜/礼获取专项引导**未做**（BuildPanel 灰显前置 + 国策树效果浮窗已部分覆盖），记后续。

## DeepSeek 评审 + 仲裁（P3+P4，verdict: do-not-ship）
- **除零 NaN（resolveBattle）+ 伤亡>己方兵** → 已修（denom>0 否则 0.5；unitsLost 封顶 myUnits、0 兵不损）。
- **守土用总兵含出征在外（一兵两用）** → 已修（resolveIncomingAttack 用 availableSoldiers + 最强守备兵种）。
- **将领出征中叛逃/被遣散 → 悬空 generalId** → 已修（tickLoyalty 跳过 deployed 叛逃；dismissGeneral 拒绝 deployed）。
- **存档浅拷贝 config.units 共享引用 + 无忠诚钳制** → 已修（深拷贝 units + 钳 loyalty[0,100]）。
- **computeCurrentMilitaryPower 每 tick 覆盖 playerMilitaryPower，erase NPC delta（Design MAJOR）** → **override（记录理由）**：保留覆盖以让"养兵→军力升→NPC 忌惮/兴师更易胜"这一核心诉求成立；NPC 的军事压力现以"防御战减兵阶层（killSoldiers，持久）+ 资源劫掠"体现，而非被重算掉的标量 delta，故标量 delta 被取代可接受。NPC 决策仍读 base 标量（未让其完全感知军队），记为后续可深化。
- nits（getAvailableUnitTypes 每 tick new Set / 按资源区分短缺反馈 / resolveDeter 0:0 / 早期 gold 多路扣预算）→ 数据量小可忽略 / 记后续 / 我的出征路径未用 resolveDeter / 起始无 scholar 时 gold 不被士俸扣，早期安全。

## 验证
948 测试全绿；exe 0.9.0 重建。真人 playtest 校准清单：战斗胜率手感、兵种/将领数值、招募与忠诚节奏、阶层供养(布/铜/钱)平衡、来犯频率、巨型工程工期、阶层诉求频率。
