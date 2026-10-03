# c927-10 硬编码文案 K/U/R/E 八条待裁项·裁决台材料

> 来源：`zcode-bridge/done/20260925-120436-970b.result.md` 遗留 1（8 条待裁项）。
> 本档为**裁决台材料汇总，零码改动**。锚点现势性：970b 钉 HEAD `63f0def`，本档复核于 `8a9eaea`，漂移三处已登记（见 §0）。
> 排序＝落地风险从高到低；「可派/须拍板」分栏见 §2 总表。

## 0. 锚点漂移登记（970b → 8a9eaea）

| # | 漂移 | 实测 | 对裁决的影响 |
|---|---|---|---|
| D1 | **新增先例：102c65d「存档缺载荷字段改为拒载」（9/27 用户裁决，r5 B2）** | `saveLoad.ts:411-414` 缺 `rngSeed`/`eventHistory` 即抛 `SaveLoadError`；`saveLoad.ts:221` `validateWorldMap` 深校验在位 | **直接改写 R-2 的先例面**：970b 判 R-2「风险最高」时仓内还没有拒载先例，现在拒载方向已有用户裁决背书 |
| D2 | `throw new Error` 计数 40 → 41 | `rg -e 'throw new Error\(' src -g '*.ts' --no-heading \| wc -l` = **41**（63f0def..8a9eaea 间 c927 批新增） | E-1 的换表面 +1，不影响定性 |
| D3 | `SaveLoadPanel.ts:206` toast 形状微变 | 现 `操作失败：${err instanceof Error ? err.message : String(err)}`（970b 记为 `操作失败：${err.message}`） | 行号未动、仍是玩家可见错误面唯一代表，E-1 锚点有效 |

其余锚点逐条复测零漂移（各条现状锚点行号与 970b 一致）。

## 1. 逐条五要素（按风险降序）

### R-2 存档侧 defId 可解析＋坐标界内校验 【风险最高】
- **现状锚点**：`src/renderer/render/MapRenderer.ts:675`、`:1058` 两处 `if (!def) continue;`——未注册 defId 的建筑被静默吞掉，无日志无红；加载侧已有 `validateWorldMap`（地形串/非布尔 buildable 深校验，`saveLoad.ts:221`）但**不含** defId 可解析性与坐标界内。
- **两案对比**：案 A（载荷级）——load 时对建筑实例校验 defId 可解析＋坐标界内，违者抛 `SaveLoadError` 拒载；与 102c65d 同向，坏档在门口死、绝不带病进场。案 B（渲染级）——保留宽容，把两处静默 `continue` 改为 `console.error('[MapRenderer] unknown building defId=… skip')`＋继续跑；老档永远能读，但病灶潜伏。
- **本仓先例**：**102c65d（9/27 用户裁决）已为「拒载」付过一次费**——rngSeed/eventHistory 缺失不做静默回填；`SaveLoadError` 类与消息形状已定型；saveMatrix 系列测试件可复用做兼容矩阵。
- **推荐**：**案 A**，但限「当版存档」口径（低版走迁移链后再判，同 102c65d）；渲染侧两处 `continue` 无论 A/B 都建议补日志（半条案 B 白送）。
- **落地代价**：案 A ≈ 40–60 行（校验函数＋迁移链接线）＋saveMatrix 兼容例 3–5 条；案 B ≈ 2 行日志。
- **分栏**：须产品拍板（拒载会拒掉真老档，"能读"→"拒读"的产品语义只有拍板能定）。

### E-1 错误串建稳定 key＋中文化（970b 唯一推荐的结构性改法）
- **现状锚点**：`throw new Error` 全仓 **41** 处（D2），文案侧全英文；玩家可见面＝`SaveLoadPanel.ts:206` toast（D3 形状）。`SaveLoadError`（`saveLoad.ts:24`）已带 `name='SaveLoadError'` 稳定名。
- **两案对比**：案 A（全量）——建 `errorMessages` 稳定 key 表（照 `JIT_HINTS` 类型穷尽键表先例），41 处 throw 全换 key＋文案中文化。案 B（分期）——只先做**玩家可见面**：SaveLoadPanel toast 一条路径接 key 表，内部错误维持英文，后续批次再扩。
- **本仓先例**：`JIT_HINTS: Readonly<Record<JitTrigger, JitHint>>` 类型穷尽键表；`SaveLoadError` 稳定错误类；102c65d 的英文错误串已被玩家面 toast 直达（`Save missing load-bearing field(s)…`），中文化绕不开它。
- **推荐**：**案 B 起步**（先玩家面 ~20 行见效，内部 41 处换表另拆实现单）；案 A 全量若拍板则一次到位避免两段式返工。
- **落地代价**：案 B ≈ 20 行（表 8–10 行＋接线 2–3 处＋测试期望 2–4 条）；案 A ≈ 80–100 行（表 30＋41 处替换＋断言同改）。
- **分栏**：须产品拍板（中文化范围＝产品文案决策）；拍板后可整批拆实现单。

### R-1 回退形态是否加标记
- **现状锚点**：`modifierDescriber.ts:53` `TARGET_LABEL[e.target] ?? e.target`、`courtFormat.ts:19` `RESOURCE_LABEL[k] ?? k`——查表脱靶时把内部 snake_case key 直接印上屏（可定位✓、可读✗）。
- **两案对比**：案 A——回退改为 `未知(${e.target})` 形态，玩家可读且保留可定位。案 B——回退时 `console.warn`＋显示通用词「未知」，不外泄内部 key。
- **本仓先例**：`GameScene.ts:171` `console.error('[GameScene] …')`＝"标记＋继续"先例；R-2 案 A 若拍板，此类脏数据在载荷层已被拦，渲染回退降级为兜底。
- **推荐**：案 A（改动最小、两诉求兼得）；R-2 拍板后本条降级为纯兜底语义，可随 E-1 文案批顺带。
- **落地代价**：≈ 2 行＋既有测试期望 2–4 条。
- **分栏**：须产品拍板（屏显文案措辞）；幅度极小可并入 E-1 案 B 同批。

### K-2 启动校验是否接线守卫
- **现状锚点**：`modifierDescriber.ts:71` `findUnlabeledTargets()` 定义在位；调用面＝`modifierDescriber.test.ts:47` **唯一一个测试**；boot 接线 **0**（970b 结论，复测不变）。
- **两案对比**：案 A——boot 早期调一次 `findUnlabeledTargets()`，非空则 `console.error('[GameScene] unlabeled modifier targets: …')`（不挡启动）。案 B——不接线，维持测试期守卫，等真出过一次脱靶再议。
- **本仓先例**：`GameScene.ts:171` boot 期 console.error 形态在位；该守卫本就是「供启动校验/测试用」的自述（970b 摘录）。
- **推荐**：**案 A**——守卫已写好、测试已锁空集，接线只是 3–5 行，白捡一道编译期后最后的网。
- **落地代价**：＋3–5 行（调用＋一条带前缀日志）。
- **分栏**：可派实现单（推荐已锚死，唯一悬念是"要不要"而代价近零；保守起见可随 K-1 同批派）。

### K-1 重复标签映射合一
- **现状锚点**：`grain: '粮'` 字面映射 **4 文件 / 6 处**（复测不变）：canonical=`courtFormat.ts:8` `RESOURCE_LABEL`；`HUD.ts:26` **整表私拷**；`BuildPanel.ts:283/291/349` 三处内联字面量；`BuildingPopover.ts:36` 一处内联。
- **两案对比**：案 A——全部改 import `courtFormat` 的 `RESOURCE_LABEL`，删私拷与内联。案 B——只删 `HUD.ts:26` 整表私拷（漂移风险最大的一处），内联三处暂留。
- **本仓先例**：`courtFormat.ts:8` 导出表即先例本身；`TARGET_LABEL` 单源（modifierDescriber）无重复＝同仓对照面。
- **推荐**：**案 A**——6 处同源不合一，将来加资源（如 mod 扩展）必然漂移成两套名字。
- **落地代价**：≈ −15 行净减（HUD −8/+2、BuildPanel 三处 −6/+3、BuildingPopover −8/+2），3–4 文件；vitest 面照常跑。
- **分栏**：**可派实现单**（方向唯一、纯机械、零语义变化）。

### E-2 `[模块]` 前缀约定
- **现状锚点**：先例形态＝`GameScene.ts:171` `[GameScene] missing store or buildMode in registry`；无全仓约定；落 E-1/R-2/K-2 时日志与错误串都会 proliferate，先定形再动笔。
- **两案对比**：案 A——定 `[组件名]`（驼峰，与 `[GameScene]` 同形）为全仓约定，写进 CONTRIBUTING 或 docs/design。案 B——不做全仓约定，各新日志随写随定。
- **本仓先例**：`saveIoSemantics.test.ts`（`src/renderer/state/__tests__/` 在盘）锁错误消息形状——**改约定必须同批改它的断言**（970b 原话）；`atomicSaveCrash.test.ts:8` 注释引用其 :71-89 为先例形态。
- **推荐**：案 A——本仓已有两种形态苗头（`[GameScene]`、无前缀），E-1/R-2 落地前不定形，断言面将来要返工两次。
- **落地代价**：约定本身 0 行（一页文档）；执行面随 E-1 批 ≈ 20–40 行＋saveIoSemantics 断言同改。
- **分栏**：须产品拍板（约定＝拍板项本身）。

### U-1 单位与空格统一（HUD 那一处空格）
- **现状锚点**：`HUD.ts:620` `` ` ⏳${ult.daysLeft}日` `` 缺空格；全仓手写「N 日」10 处中**唯一**异形（复测不变）。
- **两案对比**：案 A——补空格 `` ` ⏳${ult.daysLeft} 日` ``，与其余 9 处同形。案 B——不补，等 U-2 与日粒度裁决一起把量词面统一。
- **本仓先例**：其余 9 处「数字＋空格＋日」即先例本体（970b 实测）。
- **推荐**：**案 A**——1 字符改动、消掉唯一异形；970b 原话「推荐先只补 HUD 那一处空格」。
- **落地代价**：1 行。
- **分栏**：**可派实现单**（最小可执行件，甚至可夹在任一 HUD 相关单里）。

### U-2 `每日` 频率词与日粒度绑定
- **现状锚点**：「每日」非测试面分布（复测）：`buildings.ts` 17、`jitHints.ts` 3、`balanceConfig.ts`/`dayPipeline.ts`/`countryGrade.ts`/`diplomacy*`/`CodexPanel.ts` 等各 1——全部与 `BALANCE`（`src/renderer/data/balanceConfig.ts`）的日粒度数值**无绑定**，纯文案。
- **两案对比**：案 A——频率词改由 `BALANCE.time` 派生（模板串），数值改一处文案自动跟。案 B——维持文案，仅在日粒度裁决文档里登记"改粒度须全文搜每日/每日 N 处清单"。
- **本仓先例**：`formatCost`/`formatRate`/`formatSavedAt` 三个格式化助手（970b 实测）＝"数值集中格式化"先例；但 17 处散点绑定是新工程，仓内无同规模先例。
- **推荐**：**案 B 现在拍、案 A 并入日粒度裁决**——970b 原话「建议与日粒度裁决合并，勿单独动」；单独动会先于粒度语义锁死文案形态。
- **落地代价**：案 A ≈ 20+ 行（派生模板＋17+3 处替换）；案 B ≈ 0 行。
- **分栏**：须产品拍板（且被日粒度裁决阻塞，非独立可派）。

## 2. 可派 / 须拍板 总表（按 §1 风险序）

| 序 | 条目 | 可派实现单 | 须产品拍板 | 推荐出口 | 净代价 |
|---|---|---|---|---|---|
| 1 | R-2 存档校验 | （拍板后可拆） | 🔴 拒载 vs 宽容 | 案 A 当版拒载＋渲染补日志 | 40–60 行 |
| 2 | E-1 错误串 key | （拍板后可拆） | 🔴 中文化范围 | 案 B 先玩家面 | 20 行起 |
| 3 | R-1 回退标记 | 可并入 E-1 批 | 屏显措辞 | 案 A `未知(key)` | 2 行 |
| 4 | K-2 启动接线 | ✅ 可派 | — | 案 A 接线＋console.error | 3–5 行 |
| 5 | K-1 标签合一 | ✅ 可派 | — | 案 A 全部 import 单源 | −15 行 |
| 6 | E-2 前缀约定 | （约定后随批） | 约定本身 | 案 A `[组件名]` | 0 行（文档） |
| 7 | U-1 HUD 空格 | ✅ 可派 | — | 案 A 补空格 | 1 行 |
| 8 | U-2 频率词绑定 | ⛔ 被日粒度裁决阻塞 | 🔴 案 A/B | 先案 B 登记 | 0 行（暂） |

**可直接派的三件**：K-1（−15 行）、K-2（+3–5 行）、U-1（1 行）——方向都被先例锚死、零产品语义争议，合计一次小批即可收口。
**必须拍板的三件**：R-2、E-1、U-2——其中 U-2 已被日粒度裁决阻塞；R-2 的拒载方向已有 102c65d 用户裁决背书（D1 漂移），拍板难度较 970b 时点已下降。
**随批顺带的两件**：R-1（并 E-1 批）、E-2（约定先行，执行随 E-1/R-2 批）。
