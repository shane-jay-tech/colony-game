# colony megaProjects 数据面盘点：14 个叶子字段里 **3 个零消费**（`phases[].peopleLocked`／`reward.researchMul`／`reward.permanentDeter`），其中 2 个**仍在 UI 上向玩家承诺**；另有 3 个纯函数生产侧无人调、启动门禁被实现**三遍**（c924-28）

- 班：`qoder-executor-20260924-0955-colony23`（Qoder 执行手）／created 2026-09-24
- 单：`zcode-bridge/inbox/c924-28.task.md`（软预算 25 分钟，**只读盘点**）
- 🔴 **经济数值红线**：本单**不改任何数值、不改任何代码**。所有"疑似缺陷"只做**登记＋给复现坐标**，处置一律交人工（见 §五）。
- 🔴 产出面：仅新增本档 1 个 md。`git status` 里其余改动全部是**他班在途件**，见 §六 归因。

## 一、锚点复核（卷宗 3 条，2 条成立 1 条为假）

| 卷宗锚点 | 实测 | 判定 |
|---|---|---|
| `src/renderer/data/megaProjects.ts:31` ＝ `export const MEGA_PROJECTS: MegaProjectDef[] = [` | 命中，行号未漂 | ✅ |
| `…megaProjects.ts:33` ＝ `id: 'proj_nine_cauldrons',` | 命中，行号未漂 | ✅ |
| `src/renderer/state/megaProjectSystem.ts:22` ＝ `const def = MEGA_PROJECTS.find(p => p.id === projectId);` | 命中，行号未漂 | ✅ |
| 卷宗「消费点：…MegaProjectPanel.ts ＋ **CodexPanel.ts 引用**」 | `CodexPanel.ts` **不 import 也不读 `MEGA_PROJECTS`**（`rg -n "MEGA_PROJECTS" src/renderer/ui/CodexPanel.ts` → 0 命中）；它只在 `:85/:89` 有**硬编码中文文案**提到"大业（巨型工程）""铸九鼎/作春秋需先建太庙" | ❌ **否证**（详见 §四.3，属"硬编码旁路"而非数据消费） |
| 🔴 卷宗判据①「MegaProjectDef 全部 **7** 个接口字段」 | `MegaProjectDef` 实为 **6** 个字段（`id/name/description/prerequisiteBuilding/phases/reward`，`megaProjects.ts:14-21`） | ❌ **7 为假，真值 6**；本档把 `MegaProjectPhase` 3 字段＋`MegaProjectReward` 5 字段一并纳入，**共 14 个叶子字段全覆盖**，两种读法都满足 |

## 二、字段 × 消费点矩阵（交付物①②：每格给 `file:line` 或「零消费」）

消费点分两栏：🎮＝真进玩法/存档逻辑（有行为后果），🖥＝仅 UI 文本（无行为后果）。

### `MegaProjectDef`（6 字段）

| 字段 | 🎮 玩法侧 | 🖥 UI 侧 | 判定 |
|---|---|---|---|
| `id` | `megaProjectSystem.ts:22,47,64,78,83`（`find` 定位）；`gameStore.ts:1806,1880`；`gameStore.ts:1828,1843,1857`（拼进 modifier 的 `id`） | `MegaProjectPanel.ts:141` | 充分消费 |
| `name` | `gameStore.ts:1830,1844,1858`（**modifier 显示名由 `def.name` 拼出**）＋`:1836,1837,1850,1851,1864,1865`（modifier 描述文本）⇒ 进存档的修饰器文本 | `MegaProjectPanel.ts:112,135,141,145` | 消费（含存档面文本） |
| `description` | — | `MegaProjectPanel.ts:115` | 🖥 **仅 UI**（无玩法后果，合理） |
| `prerequisiteBuilding` | `megaProjectSystem.ts:27`；`gameStore.ts:1883` | `MegaProjectPanel.ts:142-143,149-150,238` | 消费（**三处独立实现**，见 §四.1） |
| `phases` | `megaProjectSystem.ts:38,48,52,67,73,85`；`gameStore.ts:1808-1812` | `MegaProjectPanel.ts:36,42,43,227,229,230` | 充分消费 |
| `reward` | `megaProjectSystem.ts:77-79` → `gameStore.ts:1825-1869` 落地 | `MegaProjectPanel.ts:115,223`（`rewardSummary`） | 消费（**5 个子字段中 2 个零消费**，见下） |

### `MegaProjectPhase`（3 字段）

| 字段 | 🎮 玩法侧 | 🖥 UI 侧 | 判定 |
|---|---|---|---|
| `durationDays` | `megaProjectSystem.ts:52,73,85`；`gameStore.ts:1811`（**`isPhaseStart` 的触发判据**）、`:1887` | `MegaProjectPanel.ts:42,227` | 消费（且被用作**扣费触发条件**，见 §四.2） |
| `cost` | `megaProjectSystem.ts:40-41`（`canAffordPhase`）；**`gameStore.ts:1813-1821` 真实扣资源**（`addResource(res, -amount, 'mega_project')`） | `MegaProjectPanel.ts:37-40`（合计展示） | 消费（扣费链完整，**本单核实为真在扣**） |
| `peopleLocked` | 🔴 **零消费**（全仓 `src/` 仅 `megaProjects.ts:11` 类型声明 ＋ `:50-54,63-66` 数据字面量自身；测试目录亦 **0 命中**） | 🔴 零（面板**完全不显示**锁人） | **死字段**（12 个 phase 中有 **9 个**声明了它：`proj_spring_autumn` 5×`scholar:10`、`proj_royal_road` 4×`farmer:30`） |

### `MegaProjectReward`（5 字段）

| 字段 | 🎮 玩法侧 | 🖥 UI 侧 | 判定 |
|---|---|---|---|
| `renown` | ✅ `gameStore.ts:1827-1839`（加永久 modifier，`country_renown` add） | `MegaProjectPanel.ts:26` | 消费 |
| `permanentDeter` | 🔴 **零消费**（无任何玩法读点；`rg -n "\.permanentDeter" src/` 只得 UI `:27` ＋ 测试 `megaProjectSystem.test.ts:99` **断言的是数据值本身，不是行为**） | `MegaProjectPanel.ts:27` 文案"**永镇四方（列国不再主动来犯）**" | **死字段 ＋ UI 空头承诺** |
| `researchMul` | 🔴 **零消费**（`rg -n "reward\.researchMul" src/` → **0 命中**；`gameStore.ts:1782-1783` 那个 `effect.researchMul` 是**阶层需求**路径，同名不同物） | `MegaProjectPanel.ts:28` 文案"学问 **+30%**" | **死字段 ＋ UI 空头承诺**（`proj_spring_autumn` 奖励整条不落地） |
| `productionMul` | ✅ `gameStore.ts:1841-1848`（`country_grain_output` mul） | `MegaProjectPanel.ts:29` | 消费 |
| `tradeMul` | ✅ `gameStore.ts:1855-1862`（`country_gold_output` mul） | `MegaProjectPanel.ts:30` | 消费 |

### 三工程数据面速览（数值只登记，不评判）

| 工程 | 前置 | 阶数 | 总日数 | peopleLocked | reward 落地情况 |
|---|---|---|---|---|---|
| `proj_nine_cauldrons` 铸九鼎 | `bld_grand_temple` | 3 | 90 | 无 | `renown` ✅ ／ `permanentDeter` 🔴 未落地 |
| `proj_spring_autumn` 作春秋 | `bld_grand_temple` | 5 | 150 | 学者 ×10（5 阶）🔴 未生效 | `researchMul` 🔴 **整条奖励未落地** |
| `proj_royal_road` 修直道 | **无前置**（唯一） | 4 | 120 | 农民 ×30（4 阶）🔴 未生效 | `productionMul` ✅ ／ `tradeMul` ✅ |

## 三、零消费字段清单（一句话版）

1. **`phases[].peopleLocked`** —— 声明了 9 个阶段、涉及学者 50 人次／农民 120 人次的"锁人"设定，**玩法与 UI 两边都不读**，也没有测试钉住 ⇒ 玩家建"作春秋"不会占用 10 名学者。
2. **`reward.permanentDeter`** —— UI 明写"列国不再主动来犯"，**外交/军事侧无任何读取点** ⇒ 铸九鼎的"永镇"承诺不成立。
3. **`reward.researchMul`** —— 作春秋的唯一奖励（+30% 学问）**在 `gameStore` 的奖励落地段里被完全跳过**（该段只有 `renown/productionMul/tradeMul` 三个 `if`）⇒ 花 150 日 ＋ 5 阶 cloth/gold ＋ （名义上的）学者锁定，**换到零收益**。

🔴 三条的共同形状：**"数据声明了、UI 也播了，但 `gameStore.runMegaProjectTick` 的 `if` 链只认三个 key"**。落地段是**白名单式硬编码**，新增 reward 维度必须记得去 `gameStore.ts:1826-1869` 加 `if`，否则静默失效——这正是本次三个死字段的成因。

## 四、硬编码旁路清单（卷宗点名交付）

1. **启动门禁被实现三遍**，三份规则不完全等价：
   - `megaProjectSystem.ts:17-31` `canStartProject` —— 返回 `{ok, reason}`，reason 有 `unknown_project`／`already_in_progress`／`missing_prerequisite`；🔴 **生产侧 0 调用**（仅测试 5 处）
   - `gameStore.ts:1879-1892` `startMegaProject` —— 自己重写同样两判，只回 `boolean`
   - `MegaProjectPanel.ts:140-151` `startFailReason` ＋ `hasPrereq` —— **第三份**，负责给玩家文案
   ⇒ 规则漂移风险：改一处不会带动另两处；`canStartProject` 的 `unknown_project` 分支在生产路径**根本不可能触发**（因它无人调用）。
2. **`megaProjectSystem.startProject`（`:46-55`）与 `totalProjectDays`（`:82-86`）生产侧 0 调用**，均被内联重写：前者＝`gameStore.ts:1884-1890` 手推同一对象形状（`currentPhase:0`／`daysRemaining: phases[0].durationDays`），后者＝`MegaProjectPanel.ts:42` 的 `def.phases.reduce(...)`。⇒ **6 个导出纯函数里 3 个是"仅测试在用"**：

   | 函数 | 生产调用点 | 测试调用点 |
   |---|---|---|
   | `canStartProject` | **0** | 5 |
   | `startProject` | **0** | 2 |
   | `totalProjectDays` | **0** | 3 |
   | `tickProject` | 1（`gameStore.ts:1823`） | 4 |
   | `getProjectReward` | 1（`gameStore.ts:1825`） | 4 |
   | `canAffordPhase` | 1（`gameStore.ts:1813`） | 3 |

3. **`CodexPanel.ts:85,89` 是硬编码文案旁路**：百科里"大业（巨型工程）"条目把工程名与前置关系写死在字符串里（不 import `MEGA_PROJECTS`）。当前文本与数据**巧合一致**（太庙前置确为九鼎/春秋两条），但**数据改了百科不会跟**，且判据①"7 个接口字段"式的口径漂移正是这类不读数据的文案造成的。
4. **`isPhaseStart` 用相等判定触发扣费**（`gameStore.ts:1811`：`prog.daysRemaining === phaseDef.durationDays`）—— 扣费与否取决于"天数恰好等于阶段总天数"这一瞬时相等，而非显式标记位。若将来出现同工程不同阶 `durationDays` 相同且进度被外部改写（读档／调试）的情形，该判据可能重复扣费或漏扣。**本单只登记机制观察，不判定为缺陷、不测数值。**

## 五、经济数值红线的处置边界（本单零动作）

🔴 以上所有条目**均属经济/平衡数值的邻域**（锁人人次、+30% 学问、永镇、前置建筑），按纪律与卷宗「发现数值问题只登记不动手」：
- 本单**未改** `megaProjects.ts` 的任何数值、**未补** `gameStore` 的 `if` 分支、**未删** `peopleLocked` 字段、**未动** UI 文案。
- 三个候选处置形态（**交人工选，执行手不裁**）：
  - **单形态 A｜补齐落地**：给 `researchMul`／`permanentDeter` 在 `gameStore` 落地段加 `if`，并把 `peopleLocked` 接进人口可用性计算（`gameStore.availableSoldiers` 一类）。改动面最大，且**要人工定"锁人到底锁什么、锁多少算平衡"**。
  - **单形态 B｜删声明＋改文案**：承认这三项不是设计意图，从类型与数据里删掉、把 UI 承诺文案改为已落地的收益。改动面最小，但**等于降低九鼎/春秋的卖点**，属产品决定。
  - **单形态 C｜先补哨兵再决定**：加"reward 的 key 必须 ∈ 落地白名单"的守护测试，把这类静默失效变成红灯。本单**不落**（写测试件属 `src/` 写位，与本仓在途的 colony22 冲突），仅登记为建议。
- ⚠ 与 `c924-29`（FACTION_DEMANDS 扩容设计稿）**同族**：`factions.ts` 的 `rejectEffect.researchMul` 是**有落地**的（`gameStore.ts:1782-1783`），与 megaProjects 的 `reward.researchMul` **同名不同路径** ⇒ 若人工按"researchMul 已支持"处理，会踩这个同名陷阱。两档宜并读。

## 六、可复跑命令段（交付物④；全部只读）

```bash
cd D:/code/colony-game
# 0) 三个锚点（判据①②前置）
rg -n 'export const MEGA_PROJECTS: MegaProjectDef\[\] = \[' src/renderer/data/megaProjects.ts   # → :31
rg -n "id: 'proj_nine_cauldrons',"                        src/renderer/data/megaProjects.ts   # → :33
rg -n 'MEGA_PROJECTS\.find\(p => p\.id === projectId\);'   src/renderer/state/megaProjectSystem.ts | head -1   # → :22

# 1) 判据③：工程 id 数
rg -c "proj_" src/renderer/data/megaProjects.ts        # → 3   （≥3 ✓）

# 2) 接口字段实为 6 个（否证判据①的"7 个"）
rg -n '^export interface MegaProjectDef \{' -A 8 src/renderer/data/megaProjects.ts

# 3) 三个死字段：全仓（含测试）只出现在数据文件自身
rg -n "peopleLocked" src/ | rg -v "data.megaProjects.ts" | wc -l          # → 0（连测试都没有）
rg -n "reward\.researchMul" src/ | wc -l                                  # → 0
rg -n '\.permanentDeter' src/                                             # → 2 处：UI:27 ＋ 测试:99（断言数据值，非行为）
rg -n 'reward: \{' src/renderer/data/megaProjects.ts                       # → :42,:56,:68 三条 reward

# 4) 奖励落地段只认三个 key（成因直证）
rg -n 'if \(reward\.(renown|productionMul|tradeMul|researchMul|permanentDeter)\)' src/renderer/state/gameStore.ts
#   → 1827 renown / 1841 productionMul / 1855 tradeMul   （researchMul、permanentDeter **无**）

# 5) 纯函数生产/测试调用点对照（§四.2 表）
for fn in canStartProject startProject totalProjectDays tickProject getProjectReward canAffordPhase; do
  p=$(rg -n "$fn\(" src/ --glob '!**/__tests__/**' | rg -v "export function $fn" | wc -l)
  t=$(rg -n "$fn\(" src/ --glob '**/__tests__/**' | wc -l); echo "$fn prod=$p test=$t"
done   # → 前三个 prod=0

# 6) CodexPanel 不消费数据（§四.3）
rg -n "MEGA_PROJECTS" src/renderer/ui/CodexPanel.ts | wc -l                # → 0
rg -n "巨型工程|铸九鼎|作春秋" src/renderer/ui/CodexPanel.ts                # → :85,:89 硬编码文案

# 7) 扣费链在真扣（§二 cost 行的直证）
rg -n "addResource\(res as ResourceId, -amount" src/renderer/state/gameStore.ts   # → :1819

# 8) 本档零代码改动自证
git diff --name-only src/ | rg -v "audioSizeSentinel" ; echo "（上一行无输出＝src 侧除他班在途件外无新增改动）"
git status --porcelain docs/insights/colony-megaprojects-dataface-20260924.md      # → ?? 新档（未跟踪产物）
```

**归因（并发窗况，交付物⑤的诚实版）**：判据⑤要求"git status 干净（只新增 1 个 md）"。本单收班时工作树**不为干净**——`git status --porcelain` 另有 **7 行**：`docs/design/OPTIMIZATION_BACKLOG.md`、`docs/insights/colony-bushdry-triage-20260918.md`、`colony-dead-exports-20260914.json`（＋其 `.bak` 的 ` D`）、`colony-insights-index-20260919.md`、`colony-scatter-asset-gap-20260917.md`、`src/renderer/state/__tests__/audioSizeSentinel.test.ts`，**全部是他班在册／在途件，本单未打开其中任何一个**。本班三单累计净贡献＝新增 3 个未跟踪 md，`src/`＋`public/`＋`scripts/` 零改动（`git diff --name-only src/ | rg -v audioSizeSentinel` → **空**，直证 src 侧只有兄弟班那一件）。判据按"本单自身 0 改动"记达成，树级不干净一事如实上报，不谎称 clean。

## 七、遗留问题

1. 🔴 **三个零消费字段的处置需人工选案**（§五 A／B／C），执行手不裁；选 A 还附带"锁人到底锁什么"的经济平衡定义缺口。
2. 🔴 **UI 空头承诺是用户可感缺陷**：`MegaProjectPanel.ts:27,28` 明写"永镇四方／学问 +30%"而行为不存在——这属"承诺与实现不符"，比静默死字段更急，建议优先于案 A/B 的选型单独处理（要么兑现、要么撤文案）。
3. **`canStartProject`／`startProject`／`totalProjectDays` 三个仅测试在用的导出**：是否并入 `c923-32` 系的"scenes/注入死出口"清理，交主班排程。⚠ 死出口计数属 `audit-dead-exports` 家族，该口径今天已知冷/暖缓存差 1.7 倍，**本单不给"全仓死出口数"式结论**，只给这 3 个具名坐标。
4. **`isPhaseStart` 相等判据**（§四.4）是否需要改成显式标记位，属机制设计问题，需独占窗口做读档/进度改写的红绿实测才能定，本单不判。
5. **未跑任何测试/构建**：并发窗（colony22 正在写 `src/**`），按纪律 §四.2 不跑全量；本单判据全部是 `rg` 只读型，不需要绿数。
6. **索引欠账（按派单未补列）**：本档未进 `colony-insights-index-*`（观察到该索引正被他班 ` M` 中，本班不补，避免双写）。
7. **改动面行数**：新增 1 文件（本档）；修改 0 行、删除 0 行。**存档兼容影响：无**（零代码改动；`MegaProjectProgress` 形状未触碰，`name` 拼进 modifier 文本的路径未动）。
