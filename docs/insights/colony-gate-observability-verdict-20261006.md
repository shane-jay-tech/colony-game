# 资源闸口静默拒绝可观测性材料（c1004-02，2026-10-06，只读）

- 承 6c4b L3/L4。两处现值逐字复核在位。

## 一、L3 modifierValidator 判据差（现值 :46-55 注释自述段逐字在位）

- **现值判据**：`if (typeof e.value !== 'number' || Number.isNaN(e.value)) throw` —— 拦 NaN、**放行 ±Infinity**；:47 注释自认「文案 finite vs 代码 NaN 两关不等值」。
- **state 层对照**：saveLoad.ts:232/:431/:741 用 `Number.isFinite`（无穷也拦）；gameStore.setResourceClamped（:658-661）`Number.isNaN(value) return`（拦 NaN 静默、无穷钳 0/上限走 Math.min/max）。
- **统一表**：

| 层 | NaN | ±Infinity | 语义 |
|---|---|---|---|
| modifierValidator（DSL 校验） | throw | **通过** | 静默缺口 |
| saveLoad（存取档） | 拦 | 拦 | 最严 |
| gameStore.setResourceClamped（写库存） | 静默 return（不改值） | 钳 0/上限 | 静默+钳制 |
| canAfford（闸口） | false（拒） | 6c4b 已拦 false | 拒绝 |

- **三档可观测性对照（validator 侧）**：
  - 维持：零改动零红；Infinity 继续静默通过 DSL 校验进入运行期（潜在缺口，静态数据侧 2026-09-23 实测非有限值 0 条=非现存缺陷）。
  - 开发期 throw（判据换 `!Number.isFinite`）：**红名单**＝modifierValidator.test.ts:142 现状例＋storyEffectsTargets.test.ts「逐条不抛」例各一（矿源已点名，须同笔复核）；运行期静态数据若藏 Infinity 会从「放行」变「选卡即抛」——render 崩溃面=选卡打开路径，**建议随附 ErrorBoundary 确认**。
  - 日志计数：+1 行 console.warn/debug（去重按 op+path）；零红；观测弱（控制台可见性取决于构建档）。
  - **推荐**：开发期 throw（import.meta.env.DEV 门）＋生产档维持现状＝「开发期观测、生产零崩」双得；红名单两例同笔翻正。

## 二、L4 placeBuilding deltas 带原始 amount（:798-802 现值）

- **现值**：`deltas[id] = -amount`（原始造价，**不经 setResourceClamped 的钳制/NaN 拦截**）与 `this.setResourceClamped(id, current - amount)` 并行——若将来绕过 canPlace 的调用点让 amount=NaN：setResourceClamped 静默 return（库存不改＝闸口静默拒绝），而 `deltas[id]=-NaN` **仍写入** deltas ⇒ HUD 出「NaN」字样（可观测，但是脏值形态而非拒绝提示）。
- **三档**：
  - 维持：零改动；现状有 canPlace 收口 ⇒ 零实盘风险（6c4b 定谳），纯防御议题。
  - 开发期 throw：`setResourceClamped` 的 NaN-return 改 DEV 门 throw——**render 崩溃面=全资源写路径**（每日 tick 也走），风险最大，**不推荐**；替代=只在 placeBuilding deltas 写入前 DEV 断言 `Number.isFinite(amount)`（崩溃面=建造动作单点）。
  - 日志计数：NaN-return 分支 +1 行 `console.warn`（去重按 id）——零红零崩溃面，观测最弱但最安全。
  - **推荐**：日志计数（dev+prod 都落 console，一行级）；「开发期抛错」若主班要，限 placeBuilding deltas 单点（非 setResourceClamped 全路径）。
- **测试影响**：三档均零既有例翻红（现值钉的是「库存不改」语义，日志/DEV-throw 都不破坏它；DEV-throw 若用单点方案也不触 priceBoundaryClamp 例——它直接调 setResourceClamped 传 NaN 期待静默，**单点方案避开此面**）。

## 三、零码改自证

rg/sed 读码＋node 无；src/ 零触碰。
