# OFFLINE_REWARD 甲案接线实施工单（c1025-15 · 2026-10-25 · 待放行投放稿）

> 拍板现值：**D1025-nod #6「OFFLINE_REWARD 甲案接线工单放行」**（2026-10-25，docs/decisions/2026-10-25-gen1025-14decisions.md）——本工单为该拍板的实施投放稿（零改码产出；投放后由执行单施工）。
> 底稿：artifacts/c-offlinereward-dossier.md（c1023-15，12 名三面复核）；材料基线：c1010-03 甲案。

## 一、标的与现值

- 标的：`data/offline.ts` 的 `OFFLINE_REWARD` 常量（现值 **dead**——仅 data/index.ts:12/:25 桶两行掩蔽＋本体定义，全仓 0 消费）。
- 接线后语义：读档/回归时按离线时长结算离线收益（上限 `maxOfflineHours=8`、产出比 `decayFactor=0.5`、仅 `economy/population` 类 modifier 生效、快照资源集 `snapshotResources` 五种）。
- **数值红线边界（工单硬约束）**：maxOfflineHours/decayFactor/applicableModifiers/snapshotResources 四常量**逐字零改动**——本工单只接线让既有常量生效，任何数值调整（倍率/上限/资源集增删）另立专裁单（经济平衡数值域）。

## 二、实施方案（甲案，c1010-03 材料基线）

1. **时间戳承载**（saveLoad.ts）：存档信封增 `lastSeenTimestamp`（写档时刻；seedSnapshotDeterminism.test:117 已注「墙钟免疫面只余 lastSeenTimestamp 一键」——**该键已是 digest 免疫白名单成员，无需动 DIGEST_EXCLUDED_KEYS**，施工时以 rg 复核为准）。schema 注记加字段（GameState 容器约束：此为信封字段非 GameState 块，与 c1023-14 lastTickTimestamp 删除先例对称——信封字段增删允许、GameState 块零增删）。
2. **结算方法**（gameStore 新私有方法 `settleOfflineReward`，估 40-60 行）：读档/启动路径调用——时长＝now−lastSeenTimestamp（clamp [0, 8h]）；对 snapshotResources 五资源按日产量×decayFactor 结算；economy/population 类 modifier 参与聚合；人口/科技不增长（防代玩）。emit 一次离线收益摘要事件（STATE_EVENTS 新增 `OFFLINE_REWARD_SETTLED` 或复用 RESOURCES_CHANGED——施工时按 55 事件表现状择一，新事件须随 ad32 门禁与 stateEvents 表登记）。
3. **防滥用边界**：单局只结算一次（读档后即清 lastSeenTimestamp）；系统时钟回拨（时长<0）零结算静默通过。
4. **测试 4-6 例**：正常结算（2h 离线＝产量×2×0.5）/上限 clamp（>8h 按 8h）/回拨零结算/单局一次/快照资源集外资源零结算/人口零增长。

## 三、验收门

- 全量测试绿＋双 tsc 0 错；GameState 接口块逐行比对零增删（信封字段除外）；OFFLINE_REWARD 常量 diff 为零；`rg OFFLINE_REWARD` 消费点 ≥1（接线达成）；域直测（结算器纯函数面若外迁 domains/ 则随迁同源对照）。

## 四、预算与投放

- 估 1 执行单（max_minutes 28）；投放位 zcode-bridge/pending 经放行入 inbox；施工仓 colony-game；本工单自身零改码（已按 D1025-nod #6 放行，投放动作待主班排期或并入下批规划）。
