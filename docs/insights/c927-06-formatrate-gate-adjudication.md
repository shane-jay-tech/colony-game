# c927-06 · formatRate 展示层无闸（Infinity/NaN/1e21）裁决材料

> 班次 `qoder-executor-20260927-1520-colony39` · 2026-09-27 · **零产品码改动／零展示层改动**（本 md 是在仓内唯一产物，diff 只以草案形态写在 §④）
> 卷宗锚点：`zcode-bridge/outbox/20260925-120431-24b8.result.md` 遗留 2 ⇒ 按波次 19 brief §3a 从 **`done/`** 取到（:106-108），锚点有效。
> 取法：异常值渲染形态**全部用纯函数复算 ＋ 既有夹具（`__fixtures__/save-v9.json`）复算**，未动展示层；探针在 `D:\code\tmp\qoder-executor-20260927-1520-colony39\`（4 份），命令见 §⑧，随班自清。
> 一句话结论：**锚点点名的三类都实测成立，但本单复算出"字面串"其实是 6 族而不是 3 族，其中一族（有限大数 → `"Infinity"`）是锚点没有的、且最小改法（入口 `isFinite` 闸）挡不住它；同时 `1e+21` 与 `±0` 两族闸不住/改不到。可达性侧本单未能给 `1e21` 找到任何实际触发路径（属防御面，不属事故面），这条要在裁决前说清，否则会为拿不到的东西付改动成本。**

---

## ① 调用面清单（file:line，全量）

`grep -rn "formatRate" src --include=*.ts` ⇒ **定义 1 处 ＋ import 1 处 ＋ 调用 5 处，全部集中在一个 UI 文件**：

| # | 位置 | 表达式（逐字） | 渲染到 | 拼接副作用 |
|---|---|---|---|---|
| D0 | `src/renderer/state/productionSystem.ts:290` | `export function formatRate(v: number): string`（体 `:291-293`） | — | `const rounded = Math.round(v * 10) / 10;` ⇒ **`v*10` 先溢出**，见 §②-E4 |
| U1 | `src/renderer/ui/ProductionPanel.ts:248` | `'+' + formatRate(produced)` | 名望行「产出」列 | 前缀硬拼 `+` |
| U2 | `:250` | `formatRate(produced)` | 名望行「净值」列 | 无前缀 |
| U3 | `:265` | `'+' + formatRate(row.produced)` | 资源行「产出」列 | 前缀硬拼 `+` |
| U4 | `:266` | `'-' + formatRate(row.consumed)` | 资源行「消耗」列 | **前缀硬拼 `-`**（不看值符号） |
| U5 | `:267` | `(row.net > 0 ? '+' : '') + formatRate(row.net)` | 资源行「净值」列 | 条件前缀（**对 NaN 恒假** ⇒ 不加 `+`） |
| 引 | `:6` | `import { formatRate } from '../state/productionSystem'` | — | — |

**唯一数据源与唯一消费者**（决定了改动爆炸半径只有一个文件）：
`ProductionPanel.ts:236 store.getDailyRates()` → `gameStore.ts:665 getDailyRates()` → `productionSystem.ts:247 computeDailyRates()`。
`grep -rn "getDailyRates" src` ⇒ 产品码只有这 2 处（定义＋U 面板调用）；`grep -rn "from '../state/productionSystem'"` ⇒ 展示层只有 `ProductionPanel.ts:6` 引 `formatRate`（`BuildingPopover.ts:6` 引的是 `computeAdjacencyMul`，不在此面）。

**同一面板里不经 formatRate 的兄弟串（列出以免被当成"改了就全一致"）**：
- `:249` 名望行消耗列硬编码 **`'—'`**（语义＝"此行无日耗"）⇒ 与案 A 的占位符**语义碰撞**，见 §⑥。
- `:257-259` 产耗双零行硬编码 `'0'`；`:270` 配色判据 `row.net > 1e-9 / < -1e-9`（**NaN 时两判据皆假 ⇒ 走"平"灰 `#6D6359`**）。
- `ScoreCardPanel.ts:210` 有同形 `'+' + item.points` 拼接（**不走 `formatRate`**）⇒ 本单不动它，但它是"两套并存数字呈现路径"在册项（`docs/insights/colony-hardcoded-copy-units-audit-20260925.md:63`）。

---

## ② 异常值在 HUD 的实际渲染形态（纯函数＋调用点复算，实测串）

### A · 锚点点名的三类（复算确认成立）

| 输入 | `formatRate` | U1/U3（`'+'+`） | U2 | U4（`'-'+`） | U5（条件`+`） |
|---|---|---|---|---|---|
| `+Infinity` | `Infinity` | `+Infinity` | `Infinity` | `-Infinity` | `+Infinity` |
| `-Infinity` | `-Infinity` | **`+-Infinity`** | `-Infinity` | **`--Infinity`** | `-Infinity` |
| `NaN` | `NaN` | `+NaN` | `NaN` | **`-NaN`** | `NaN`（`:270` 配色退化成"平"灰） |
| `1e21` | `1e+21` | `+1e+21` | `1e+21` | `-1e+21` | `+1e+21` |
| `-1e21` | `-1e+21` | **`+-1e+21`** | `-1e+21` | **`--1e+21`** | `-1e+21` |

### B · 本单复算新增的另 3 族（锚点未列，且**最小改法挡不住**）

| 编号 | 形态 | 实测读数 | 为什么锚点没有 |
|---|---|---|---|
| **E4** | 🔴 **有限输入 → `"Infinity"` 字面串** | `formatRate(1e308)=Infinity`、`formatRate(Number.MAX_VALUE)=Infinity`、`formatRate(-Number.MAX_VALUE)=-Infinity`；临界定位：`1e307` 正常出 `1e+307`，`1e308` 起 `v*10` 溢出 ⇒ **分界在 \|v\| > `Number.MAX_VALUE/10` ≈ 1.7976931348623158e+307**（实测该值本身仍输出 `1.7976931348623158e+307`） | 根因在 `:291` 的 `v * 10`：先乘后舍 ⇒ 溢出成 `Infinity`，`:292` 的 `Math.abs(Inf − Math.round(Inf))` 是 `NaN` ⇒ 落 `:293` `Infinity.toFixed(1)` = `"Infinity"`。**入口 `Number.isFinite(v)` 闸放它过去（输入确实有限）** |
| **E5** | 🔴 **调用点双符号串**（与值是否异常无关） | 良性负值即触发：U4 `'-'+formatRate(-5)` = **`--5`**；U1/U3 `'+'+formatRate(-3)` = **`+-3`**；同理 `+-Infinity`、`--Infinity`、`+-1e+21` | 符号在前缀里被拼了两次（值自带一个＋调用点硬给一个）。**两案（§④）都改不到**，要改的是 U1/U3/U4 的表达式 |
| **E6** | ⚠️ **`"-0"` / `"+0"` 是当前正常显示**（不是异常值才出现） | 夹具原样复算（§②-C）：`gold` 消耗 `0` → 消耗列 **`-0`**；`cloth` 产出 `0` → 产出列 **`+0`**。纯函数侧 `formatRate(-0)='0'`、`formatRate(-0.04)='0'`（既有钉桩 `rateDisplayBoundary.test.ts:48` 也钉了 `.not.toBe('-0')`）⇒ `"-0"` 全部来自 U4/U3 的前缀拼接 | 两案都改不到（同上）；`formatRate` 自身**不会**露出 `-0` |

### C · 既有夹具（`save-v9.json`，35,106 B）复算出的"玩家今天真实看到的串"

把夹具喂进真 `GameStore` → `getDailyRates()` → 按 U3/U4/U5 表达式拼串（探针 `c927-06-hud-fixture.ts`）：

```
grain: produced="+8.7"  consumed="-42.6"  net="-33.9"   raw=[8.700000000000001, 42.6, -33.9]
gold : produced="+2.5"  consumed="-0"     net="+2.5"    raw=[2.5, 0, 2.5]
cloth: produced="+0"    consumed="-0.8"   net="-0.8"    raw=[0, 0.8, -0.8]
```

⇒ **夹具面板 3 行里已经有 2 行出现 `"-0"`/`"+0"`**（E6 是现役文本，不是假想）。
⇒ 同一探针把 `grain` 灌 `NaN`、`wood` 灌 `+Infinity`、`gold` 灌 `-1e30` 再复算：**三行串逐字不变**（rate 面不吃库存数，`computeDailyRates` 用的是建筑／modifier／阶层消耗）；只有 `grain=1e308` 让 `buildingFulfillmentFactor` 的系数变化，串变成 `produced="+12.6" net="-30"`（**仍是良形**，没出 `Infinity`）。

### D · 半位不对称（锚点点名的第四项，复算＋**范围拓宽**）

根因实锤：`Math.round(-0.5) === -0`（向 +∞ 进位）。既有钉桩只钉了 `-0.05` 一个点，注释写"只有 .x5 这一点不对称"（`rateDisplayBoundary.test.ts:55`）——
本单普查发现**这一族覆盖任意量级**，不只是 1 以内：

| 输入 | 现状 | 对称取整后 | 变化 |
|---|---|---|---|
| `-0.05` | `0` | `-0.1` | 🔴 露出（锚点点名的正是这条） |
| `-1.25` | `-1.2` | `-1.3` | 🔴 |
| `-2.05` | `-2` | `-2.1` | 🔴 **整数串 → 小数串** |
| `-3.25` / `-10.55` / `-12.35` / `-123.45` | `-3.2` / `-10.5` / `-12.3` / `-123.4` | `-3.3` / `-10.6` / `-12.4` / `-123.5` | 🔴 各向远离零移 0.1 |
| `-99.95` | `-99.9` | `-100` | 🔴 **小数串 → 整数串** |
| `0.05` / `1.05` / `12.35` / `2.25` | `0.1` / `1.1` / `12.4` / `2.3` | 同 | ✅ 正侧零改动 |
| `-0.5` / `-1.5`（第一位小数=5） | `-0.5` / `-1.5` | 同 | ✅ 不变（`-0.5*10=-5` 本就精确） |
| `-0.049` / `0.049` / `1e-8` / `-1e-8` | `0` | `0` | ✅ 不变 |

⇒ 判据形状：**「负值 且 第二位小数恰为 5」的全族**（任意量级）显示值都会向"远离零"移动 0.1；正侧、第一位小数=5、`<0.05` 的极小量级全部不变。

### E · 可达性（这条决定该不该现在动展示层）

| 异常类 | 从存档（磁盘）可达？ | 从实时玩法可达？ | 依据 |
|---|---|---|---|
| `NaN` / `±Infinity` | ❌ **不可达**：JSON 文本没有 `NaN/Infinity` 字面量；`resources` 侧还另有 `Number.isFinite` 拒载闸（`saveLoad.ts:445`，实测字符串/null/bool 也拒） | ⚠️ **有条件可达（内存面）**：`replaceState` 可被灌值（`gameStore.ts:2836-2838` 注释自称服务 quick-save/测试场景，quick-save **尚未接线**）；而 `computeClassConsumption` 在阶层对象**缺键**时产出 `NaN`（`c927-05-probe3.ts` 实测 `totalGrain=NaN`）⇒ 一旦进 `computeDailyRates` 就是 `+NaN`。但 `deserialize` 恒产出完整四键（`saveLoad.ts:605`）⇒ **档面不可达** | §②-C 夹具复算：灌库存异常**不改 rate 串**（rate 源不读库存数） |
| `1e+21`（科学计数法） | ⚠️ 存档能存（有限数，实测进门，见 c927-05 案 A），但**存的是库存不是速率**；`saveLoad` 没有速率字段 | ❌ **本单未找到任何触发路径**：`produced/consumed/net` 由建筑定义＋modifier 派生，夹具实测最大 42.6；`1e21` 需要乘性/加性因子离谱到 21 个数量级 | 探针 §②-C；**诚实标注：属防御面，不属事故面** |
| `Infinity`（E4 溢出） | 同上（`1e308` 级速率不可达） | ❌ 同上 | 同上 |
| `--5` / `+-3`（E5）、`-0` / `+0`（E6） | — | ✅ **现役可达**：只要 `row.consumed`/`row.produced` 为 0 或负即出现；夹具面板实测已含 `-0`/`+0` | §②-C |

> ⇒ **"最扎眼的两类（E5/E6）不是 `formatRate` 内部的问题，而是调用点符号拼接的问题；而锚点点名的 `1e21` 反而拿不到触发路径。"**
> 这是本单要交的最要紧的口径修正。

---

## ③ 两案 diff 草案（**未落地**，产品码 0 改动）

### 案 A：入口加闸（锚点点名的最小改法）

```diff
--- a/src/renderer/state/productionSystem.ts   # :289-295
 /** 格式化速率展示：整数去小数、非整数保留 1 位（如 0.4/日、12/日）。 */
 export function formatRate(v: number): string {
+  if (!Number.isFinite(v)) return '—';   // 非有限值不进 UI 字面串
   const rounded = Math.round(v * 10) / 10;
   if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
   return rounded.toFixed(1);
 }
```

```diff
# 案 A′（A 的必要补全：E4 那族"有限输入 → Infinity 串"只有闸输出面才挡得住）
   const rounded = Math.round(v * 10) / 10;
+  if (!Number.isFinite(rounded)) return '—';
```

- 覆盖面：`NaN`/`±Infinity`（3 格）→ `'—'`；A′ 再加"有限但溢出"的 4 格（`1e308`/`MAX_VALUE` 正负）。
- **覆盖不到**：`1e+21`（有限 ⇒ 原样放行，既有钉桩 `rateDisplayBoundary.test.ts:50` 继续钉着 `1e+21`）、E5 双符号串、E6 `±0`。
- 副作用：`'—'` 与 `ProductionPanel.ts:249` 的"无日耗 `—`"**语义碰撞**；且 A/A′ 落地后 NaN 从"看得见"变成"看不见"（可观测性净下降，见 §⑥ 最强反对）。

### 案 B：对称量值取整（锚点点名的"要么对称要么文档写明"的对称支）

```diff
--- a/src/renderer/state/productionSystem.ts   # :291
-  const rounded = Math.round(v * 10) / 10;
+  const rounded = (v < 0 ? -1 : 1) * Math.round(Math.abs(v) * 10) / 10;
```

- 覆盖面：§②-D 全族（负・第二位小数=5・任意量级）显示值远离零移 0.1；**只改这一族**，正侧/`-0.5`/极小量级零改动（实测）。
- 覆盖不到：Infinity/NaN 字面串、E4 溢出、`1e+21`、E5、E6。
- 细节：`-0` 走正支（`-0 < 0` 为假）⇒ 输出仍 `'0'`，不引入 `"-0"`（实测）；E4 溢出支在 `Math.abs(-1e308)*10 = Infinity` 下仍给 `-Infinity` ⇒ 与 A 正交，可叠加。

### 案 C（两案都改不到、但 §② 实测显示这是**当前唯一玩家天天看到的异常**）：调用点符号拼接

```diff
--- a/src/renderer/ui/ProductionPanel.ts
-        t.produced.setText('+' + formatRate(produced));                       // :248
-      t.produced.setText('+' + formatRate(row.produced));                     // :265
-      t.consumed.setText('-' + formatRate(row.consumed));                     // :266
+        t.produced.setText(fmtSigned(produced, '+'));                          // 值为 0/负时不再硬拼前缀
+      t.produced.setText(fmtSigned(row.produced, '+'));
+      t.consumed.setText(fmtSigned(row.consumed, '-'));
```

（形态示例，非最终写法：`fmtSigned(v, sign)` 当 `formatRate(v)` 已自带符号或等于 `'0'`/`'—'` 时不拼前缀。落它就要同时决定 E6 的 `"-0"` 要不要显示成 `"0"`——这是**产品文案选择**，不是缺陷修复。）

---

## ④ 对玩家可见文本的改变清单（普查实测）

### 改变面普查（网格 788 个去重点：百分位 −2.00..2.00 步 0.01 ＋ 一元位 −20..20 步 0.1 ＋ 10 个量级点正负 ＋ `MAX_VALUE`/`MIN_VALUE`/`NaN`/`±Infinity`/`0`/`-0`）

| 方案 | 改变的格数 | 具体串 |
|---|---|---|
| **案 A** | **3 / 788** | `NaN → —`、`Infinity → —`、`-Infinity → —` |
| **案 A′** | **7 / 788** | A 的 3 条 ＋ `1e+308: Infinity → —`、`-1e+308: -Infinity → —`、`1.7976931348623157e+308: Infinity → —`、`-1.7976931348623157e+308: -Infinity → —` |
| **案 B** | **20 / 788** | 网格里全落在 `[-1.95, -0.05]` 带：`-0.05: 0→-0.1`、`-0.15: -0.1→-0.2`、`-0.25: -0.2→-0.3` … `-1.95: -1.9→-2`（逐条见 `c927-06-delta.out.txt`）；量级扩展实测另含 `-3.25→-3.3`、`-10.55→-10.6`、`-12.35→-12.4`、`-123.45→-123.5`、`-99.95→-100` |
| **良性值** | **0 改动**（A/A′/B 三案同） | `12→12`、`0.4→0.4`、`-3→-3`、`1.25→1.3`、`0→0`、`-0→0`、`0.05→0.1`、`-0.06→-0.1`、`1e20→100000000000000000000`、`1e-8→0`、`1510.5→1510.5`、`-1510.5→-1510.5` 逐格实测不变 |
| **两案都不改**（要案 C 才动） | — | `--5`、`+-3`、`-0`、`+0`、`+-Infinity`、`--Infinity`、`-NaN`、`+1e+21` |

### 面板逐列"今天 → 落地后"对照（取 §②-A/B 实测算串）

| 单元格 | 今天 | 案 A | 案 A′ | 案 B | 案 A＋B | 案 A＋B＋C |
|---|---|---|---|---|---|---|
| 名望/资源 产出列（U1/U3），值 `NaN` | `+NaN` | `+—` 🔴拼接怪 | `+—` 🔴 | `+NaN` | `+—` 🔴 | `—` ✅ |
| 同上，值 `-Infinity` | `+-Infinity` | `+—` 🔴 | `+—` 🔴 | `+-Infinity` | `+—` 🔴 | `—` ✅ |
| 消耗列（U4），值 `+Infinity` | `-Infinity` | `-—` 🔴 | `-—` 🔴 | `-Infinity` | `-—` 🔴 | `—` ✅ |
| 消耗列（U4），值 `-5`（良性负值） | `--5` | `--5` | `--5` | `--5` | `--5` | `-5` ✅ |
| 消耗列（U4），值 `0` | `-0` | `-0` | `-0` | `-0` | `-0` | `0` ✅（需文案决定） |
| 净值列（U5），值 `-0.05` | `0` | `0` | `0` | `-0.1` | `-0.1` | `-0.1` |
| 净值列（U5），值 `1e21` | `+1e+21` | `+1e+21` | `+1e+21` | `+1e+21` | `+1e+21` | `+1e+21` |
| 净值列配色（`:270`），值 `NaN` | 灰（"平"） | 灰 | 灰 | 灰 | 灰 | 灰 |

⇒ **清单里的硬结论：只做案 A/A′ 会把 `+NaN` 换成 `+—`／`-—` 这类拼接怪串**（因为符号在前缀里），"加闸"这一步**逻辑上必须和调用点一起裁**，否则新文本不比旧文本好。

### 翻桩清单（既有钉桩）

| 桩 | 位置 | 案 A | 案 A′ | 案 B |
|---|---|---|---|---|
| `formatRate(±Infinity)/NaN` 字面串 | `rateDisplayBoundary.test.ts:36-38` | 🔴 转红 | 🔴 转红 | ✅ 仍绿 |
| `formatRate(-0.05) === '0'` | `:54` | ✅ 仍绿 | ✅ | 🔴 转红（变 `-0.1`） |
| `formatRate(0.05) === '0.1'`／`-0.06 === '-0.1'` | `:53`／`:55` | ✅ | ✅ | ✅（`:55` 注释"只有 .x5 这一点不对称"**要改**，§②-D 已拓宽） |
| `formatRate(1e21) === '1e+21'` | `:50` | ✅ 仍绿（案 A 管不到） | ✅ | ✅ |
| `formatRate(-0.04) === '0'` 且 `.not.toBe('-0')` | `:44/:48` | ✅ | ✅ | ✅ |
| 良性四例 `12/0.4/-3/1.25` | `productionSystem.test.ts:313-316` | ✅ | ✅ | ✅（正侧与 `.25` 正例不变，实测） |

---

## ⑤ 推荐（一案）＋ 最强反对

**推荐：案 A′ ＋ 案 C 同批（B 单列缓裁）。**
理由（都指得上面实测）：
1. A 单独做**产不出更好的文本**——`+NaN` 只变成 `+—`（§④ 表内标红的三行），必须连调用点拼接（C）一起做，才真正做到"异常值不进玩家眼睛"。
2. A′ 而不是 A：E4 证明"入口 `isFinite`"会漏掉**有限但溢出**的一族，而那一族出来的正是同一个 `"Infinity"` 字面串——留着它就等于闸没达到目的。
3. B 挪后：它改的是 20+ 格的显示量级（含"整数串↔小数串"往返），属**取整惯例变更**而非缺陷修复；且现状不对称是"负侧被抹平成 0"，方向上更保守（不会把 0.05 的净耗喊成 -0.1 的警报）。要动就单独立项、单独配文案，别和加闸混在一批里（混批会让 §④ 的翻桩清单一次转红 4 条，归因困难）。

**最强反对（本单自己给）**：
**加闸会让这一类缺陷从"看得见"变成"看不见"，而本链路今天没有任何日志**——24b8 E4 已实测"产/耗/日结算链路上 `console.*` 零命中"，`ProductionPanel` 的 `+NaN` 目前是**唯一**的用户可见异常信号（虽然难看）。
叠加两条：① `'—'` 与 `:249` 的"无日耗 `—`"语义碰撞，玩家/复盘者无法区分"不适用""没数据""数值崩了"三种意思；② `:270` 配色在 NaN 时本来就退化成"平"灰，加闸后灰＋破折号＝完全静默。
⇒ 反对成立的条件是"不加日志面就先加闸"。若裁决同意这个前提，则**A′＋C 应当与可观测性（日志/记账/面板 tooltip 之一）同批，或干脆先只做 C**（C 单独做不损失任何可见信号，只修 `--5`/`+-3`/`-0` 这三族**玩家今天真的看得到**的串）。

---

## ⑥ 判据自查（卷宗「完成标准」逐句）

| 判据 | 命中 | 取证 |
|---|---|---|
| ① 调用面清单 file:line | ✅ | §①：定义 `:290`＋import `:6`＋调用 `:248/:250/:265/:266/:267`＝5 处，全仓 grep 无遗漏；含唯一数据源链与兄弟串划界 |
| ② 异常值渲染形态表 | ✅ | §②-A/B/C/D/E：锚点 3 类 ＋ 新增 3 族（E4 有限→`Infinity`、E5 双符号、E6 `±0`）＋半位不对称**量级拓宽**＋**既有夹具**逐行实串＋可达性表 |
| ③ 两案 diff 草案 | ✅ | §③：案 A／A′／B／C 四段 diff（**未落地**）；§④给出 788 格普查与逐列"今天→落地后"对照 |
| ④ 零产品码改动 | ✅ | `git status --porcelain`：外部在途 4 件未碰；本班仅新增 3 件 md（04/05/06）；`src/` 零改动；**展示层未动**（渲染形态全部用纯函数＋夹具在仓外探针复算） |

## ⑦ 与卷宗正文的一处口径差异（按 brief §3b 点名）

卷宗「做什么」写"…两案对玩家可见文本的改变清单，**推荐一案**"；派单横幅对 c927-06 只要求"两案 diff 草案＋改变清单"。
⇒ 按 brief §3b「卷宗正文与 brief 冲突时以卷宗为准」，本档**保留推荐**（§⑤）并同时给出最强反对，且不落地任何改动。
另：卷宗「完成标准」③只点名"两案"，本单实测发现两案都覆盖不到 §② 的 E5/E6 两族 ⇒ 增列**案 C 草案**（不作数于"两案"判据，属补充材料）。

## ⑧ 证据（命令＋读数；取 rc 一律重定向不接管道）

```
$ cd D:/code/colony-game && git rev-parse --short HEAD → 6f4057a
$ git status --porcelain → 4 枚外部在途件 ＋ ?? docs/insights/{c927-04,c927-05,c927-06}-…md
  ⇒ 本单引用的 productionSystem.ts / ProductionPanel.ts / gameStore.ts 均不在脏件列表 ⇒ 工作树版＝HEAD 版（无差）

$ grep -rn "formatRate" src --include=*.ts
  productionSystem.ts:290 | ProductionPanel.ts:6,248,250,265,266,267 | 两件测试（productionSystem.test.ts、rateDisplayBoundary.test.ts）
$ grep -rn "getDailyRates" src --include=*.ts | grep -v __tests__ → gameStore.ts:665 · ProductionPanel.ts:236
$ grep -n "setText" src/renderer/ui/ProductionPanel.ts → :243,:248,:249,:250,:257-259,:265-268,:289（:249 硬编码 '—'；:270 配色用 raw row.net）

# 渲染形态复算（纯函数；探针 4 份，仓外）
$ npx vite-node D:/code/tmp/qoder-executor-20260927-1520-colony39/c927-06-render-table.ts   RC=0
  27 个取值 × 5 个调用点全表（§②-A/B/D 的来源）：Infinity/NaN/1e+21/+-5/-0/+0/半位 各串
$ npx vite-node D:/code/tmp/qoder-executor-20260927-1520-colony39/c927-06-threshold.ts      RC=0
  strBoundary: 1e20 → 100000000000000000000 ｜ 1e21 → 1e+21        （科学计数法切换点 = 1e21）
  overflowScan: 1e307 → 1e+307 ｜ 1e308 → Infinity（v*10=Infinity）｜ MAX_VALUE → Infinity ｜ -MAX_VALUE → -Infinity
  mxOverTen: 1.7976931348623158e+307 → "1.7976931348623158e+307"（仍良形）⇒ 分界即 MAX_VALUE/10
  callShapes: -Infinity@U4="--Infinity" · NaN@U1="+NaN" · -5@U3="+-5" · 0@U4="-0" · 1e21@U4="-1e+21"
  placeholderCollision: 闸值 '—' 经 U1 → "+—"，经 U4 → "-—"；:249 已把 '—' 用作"无日耗"
$ npx vite-node …/c927-06-hud-fixture.ts   RC=0（**既有夹具 save-v9.json，35,106 B**，真 GameStore → getDailyRates）
  base: grain "+8.7"/"-42.6"/"-33.9" · gold "+2.5"/"-0"/"+2.5" · cloth "+0"/"-0.8"/"-0.8"
  灌 NaN/Infinity/-1e30 后三行串逐字不变；灌 1e308 → grain "+12.6"/"-30"（仍良形，未出 Infinity）
$ npx vite-node …/c927-06-delta-scan.ts    RC=0
  gridSize=788 · A_changed=3 · A′_extra=4（1e±308、±MAX_VALUE）· B_changed=20（全部为负・第二位小数=5）
$ npx vite-node …/c927-06-halfband.ts
  -2.05 现状 -2 → 案B -2.1 ｜ -3.25 → -3.3 ｜ -12.35 → -12.4 ｜ -123.45 → -123.5 ｜ -99.95 → -100
  正侧 1.05/2.25/12.35/0.05 与 -0.5/-1.5/-0.049/1e-8 全部不变

# 定向回归（未跑全量，并发窗禁跑）
$ npx vitest run src/renderer/state/__tests__/productionSystem.test.ts src/renderer/state/__tests__/rateDisplayBoundary.test.ts
  VITEST_RC=0 · Test Files 2 passed (2) · Tests 40 passed (40)（productionSystem 28 ＋ rateDisplayBoundary 12）

# type-check 两条口径
$ npm run type-check → TYPECHECK_RC=0（= tsc -p tsconfig.renderer.json --noEmit）
$ npx tsc -p tsconfig.main.json --noEmit → MAIN_RC=2（index.ts(93,9)/(93,18) TS18048，存量红，与本案无关，未动）

# 锚点复核（brief §3a：outbox → done）
$ ls D:/code/zcode-bridge/done/ | grep 24b8 → 20260925-120431-24b8.result.md ✅（遗留 2 在 :106-108）
```

## ⑨ 遗留问题

1. 🔴 **交人工裁**：案 A′／案 A′＋C／只做 C／B 单列 四条路的选择（§⑤ 给了推荐与最强反对，未落地任何一条）。
   本件属**玩家可见文本**面 ⇒ 不做也不影响数值正确性，无紧迫事故。
2. 🔴 **可观测性要先于加闸**（§⑤ 反对条）：若裁"先加闸"，本链路 `console.*` 零命中（24b8 E4）会让下一次 NaN 事故**完全静默** ⇒ 建议与"日志/记账/面板提示"三选一并列裁。
3. ⚠️ **`1e+21` 无触发路径**：本单在只读面上找不到它进入 HUD 的路（§②-E）。若主班知道有（例如某 modifier 的加算配置），请点名文件，否则建议**不为其付改动成本**——只留 §②-B 的记录即可。
4. ⚠️ **案 B 若落地，`rateDisplayBoundary.test.ts:55` 的注释"只有 .x5 这一点不对称"必须改**（§②-D 已证这族覆盖任意量级），否则误导后人。
5. ⚠️ **`"-0"`/`"+0"` 是现役文本**（夹具实测），案 A/B 都不改 ⇒ 别在验收时把"`-0` 消失"记为加闸的功劳。
6. ➖ 全量 `npm test` 现值未取（并发窗约束），交主班收班；本单只交 2 件／40 例定向基线（`productionSystem` 28 ＋ `rateDisplayBoundary` 12）。
7. ➖ 仓根零临时件；4 份探针与输出快照在 `D:\code\tmp\qoder-executor-20260927-1520-colony39\`，随班自清。
