# 孤儿建筑 defId 兜底设计稿（c924-36）

> 状态：**设计稿，未落任何生产码**。本单 `git diff --stat` 只含本文件。
> 完成标准 ④ 的诚实口径：`git diff --stat -- src/` **空**（生产码零改动）；本文件是 `??` 未跟踪新件。
> 整仓 `git diff --stat` 另有 3 项属**他班在册在途**（` M docs/design/OPTIMIZATION_BACKLOG.md`、` M docs/insights/colony-dead-exports-20260914.json`、` D …json.bak`），本班全程未碰、不归本单。
> 取数 HEAD：`7877bfd`（现取）。文中行号一律**同时给唯一文本锚点**，行号漂移时按锚点重定位。
> 班：`qoder-executor-20260925-0220-colony30` · 主班：`qoder-main-drain-20260924-2341`
> 🔴 **选案交人工**：本稿只列两案影响面与"改哪几条会红"，不在本单内定案。

---

## 一、结论先行（三句）

1. **派单说的"渲染侧炸"不成立**：`GameScene` 全部 5 个调用点今天都有空值兜底，`MapRenderer`/`productionSystem` 也都有——**没有 TypeError、没有 NaN 污染**（沙盒 D 例实测）。
2. **派单说的"永久卡"成立，但真因不在渲染层**：卡点在 `placementSystem.ts:61-66` 的 pessimistic 拒放——**存档里只要躺着 1 栋孤儿建筑，全图任意格子都建不了任何建筑**（沙盒 C 例实测 4 个坐标全 `overlap`）。
3. 该孤儿建筑同时**不可见**（`MapRenderer:675 continue`）+ **不可点选/不可拆**（`GameScene:498-499 continue`），所以软锁**无 UI 出口**；拆除逻辑本身是好的（沙盒 F 例：程序化 `removeBuilding` 直接成功）。

⇒ 缺陷类别应从"渲染崩溃"改判为"**可达性死锁 + 全局建造阻断**"。修复靶心是 `placementSystem`，不是 `GameScene`。

---

## 二、对派单前提的逐条复核（含否证）

| # | 派单/卷宗前提 | 实测 | 判定 |
|---|---|---|---|
| 1 | `saveLoad.ts:722` 只查非空字符串 | 该行原文 `if (typeof rec['defId'] !== 'string' \|\| rec['defId'].length === 0) {`，0 漂移 | ✅ 成立 |
| 2 | `saveLoad.ts:723` 抛 `must be a non-empty string` | 行号文本逐字对上了 | ✅ 成立 |
| 3 | `GameScene.ts:75` 取 def 后**无空值兜底** | 紧邻下一行 `:76` 即 `` `${def?.name ?? '营建'}　成` `` —— `?.` ＋ `??` 双兜底 | 🔴 **否证**（有兜底） |
| 4 | 对照 `:336` 有 `??` 兜底 | 原文 `getBuildingDef(inst.defId)?.name ?? '建筑'` | ✅ 成立 |
| 5 | 旧存档"在渲染侧**炸**" | 5/5 调用点有兜底；`MapRenderer` 3 处 `if (!def)` 早退、2 处 `?.`。无抛点 | 🔴 **否证**（不炸，是静默隐身） |
| 6 | "或永久卡" | `placementSystem:64-65` 全局拒放 ＋ `GameScene:499` 不可点选 | ✅ 成立，且**比卷宗描述更严重**（全局而非单栋） |

补充否证（避免后续班再踩）：**"≥24 份 fakeScene 消费件"之类的在册计数本单一律现场重取**，本稿不使用任何未现取的计数。

---

## 三、沙盒对照实测（完成标准 ②）

沙盒件：`tmp/c924-36/sandbox-orphan.test.ts` ＋ `tmp/c924-36/vitest.sandbox.config.ts`（`tmp/` 由 `.gitignore:25` 覆盖，`git check-ignore -v tmp/x.md` 已自证；**未改仓内 `vitest.config.ts`**，它 include 只认 `src/**/__tests__/**`，vitest 1.6.1 无 `--include` 选项，故用一次性 config 指过去）。

复算命令（定向 1 文件，**未跑全量**）：

```
npx vitest run --config tmp/c924-36/vitest.sandbox.config.ts
```

读数（`Test Files 1 passed` / `Tests 6 passed (6)`）：

| 例 | 构造 | 实测落点 |
|---|---|---|
| A | `defId: ''` | `deserialize` 抛 `SaveLoadError(/defId must be a non-empty string/)` —— 锚点 722-723 有效 |
| B | `defId: 'bld_ghost_from_renamed_def'`（非空、不在表） | **放行**：`out.buildings.length === 1`、`getBuildingDef(...)` 为 `undefined` ⇒ 残缺入档 |
| C | 载入 B 的孤儿档后 `canPlace(bld_farm, …)` | `0,0=overlap \| 5,5=overlap \| 6,6=overlap \| 3,7=overlap` —— **任意空地全拒**，与孤儿所在格 (1,1) 无关 |
| D | 孤儿(working) ＋ `bld_farm`(working) 同 tick | `deltas={"grain":12}`、`detail.grain={rawOutput:12,rawUpkeep:0,net:12}` —— 孤儿**零产出零维护**，全量数值 `Number.isFinite` 通过 |
| E | `getEmployedLabor()` | 孤儿 `=0`；`bld_farm` `=4` ⇒ 孤儿**不占劳力**，只锁建造 |
| F | 程序化 `store.removeBuilding(孤儿实例)` | 返回 `true`、`buildings.length = 0` ⇒ 拆除逻辑本身健康 |

C 例的诚实附注：第一次跑时我把探针点写成 `(9,9)`，实测 `out_of_bounds`（10×10 图放 2×2 农田越界），是我夹具错、非代码行为；改成 `(6,6)` 后 4 点齐 `overlap`。**这条区分要留着**，免得后人把 `out_of_bounds` 误读成"部分坐标还能建"。

---

## 四、`GameScene` 全部 `getBuildingDef` 调用点兜底现状表（完成标准 ①）

现取命令：`rg -n "getBuildingDef\(" src/renderer/scenes/GameScene.ts` → **5 处**（行号 75/336/342/458/498）。

| 行 | 原文锚点（唯一文本） | 取值后怎么用 | 有/无空值兜底 | 孤儿建筑在此处的表现 |
|---|---|---|---|---|
| 75 | `const def = getBuildingDef(b.defId);` | `:76` 飘字 `` `${def?.name ?? '营建'}　成` `` | ✅ 有（`?.`＋`??`） | 飘字显示"营建　成"，不崩。事件源是"建成"，孤儿 normally 走不到这里 |
| 336 | `const name = getBuildingDef(inst.defId)?.name ?? '建筑';` | `:338` toast `已拆除${name}` | ✅ 有 | 拆除 toast 显示"已拆除建筑"。**但 `inst` 来自 `:332 findBuildingAt`，孤儿永远取不到 ⇒ 本行对孤儿不可达** |
| 342 | `const def = getBuildingDef(inst.defId);` | `:343-344` 锚点 `def?.size.width ?? 1`；`:346` 转交 `buildingPopover?.show(inst, …)` | ✅ 有（尺寸兜 1）；**弹窗另有自己的兜底**（`BuildingPopover:99-100 if (!def) return;`） | 同上不可达；即便可达也只是 1×1 锚点＋弹窗早退（`BuildingPopover.test.ts:55` 已钉"未知 defId 早返回不建弹窗"） |
| 458 | `const name = getBuildingDef(inst.defId)?.name ?? '建筑';` | `:459 store.removeBuilding(inst)` ＋ `:460` toast | ✅ 有 | **`inst` 来自 `:456 findBuildingAt`**，与 336 同一条不可达链 |
| 498 | `const d = getBuildingDef(b.defId);` + `:499 if (!d) continue;` | `:502-503` 用 `d.size` 做 footprint 命中框 | ✅ 有（**continue 跳过**） | 🔴 **卡点**：孤儿不参与命中框 ⇒ 点不中 ⇒ 拆除模式与 popover 双双拿不到它 ⇒ 无 UI 出口 |

**"无兜底"在 `GameScene` 内为 0 处**。派单假设的"取 def 后裸解引用"在本文件不存在；真正的孤儿语义是**"有兜底但兜成隐身/不可达"**，这比崩更难发现（崩有栈、隐身只有玩家投诉"建不了了"）。

### 4.1 同一缺陷在 `GameScene` 之外的面（完整影响面，两案都要照这张表）

非测试代码共 **30 个调用点**（现取 `rg -c "getBuildingDef\(" src/ --glob '!**/__tests__/**'`：GameScene 5、MapRenderer 5、gameStore 9、BuildingPopover 6、MegaProjectPanel 2、GradePanel 1、ProductionPanel 1、placementSystem 1；另 `buildingRegistry.ts:37` 是定义行，不计）。

| 文件:行 | 锚点 | 兜底 | 孤儿语义 |
|---|---|---|---|
| `placementSystem.ts:61` | `const existingDef = getBuildingDef(existing.defId);` + `:64-65 return { ok: false, reason: 'overlap' }` | ✅（pessimistic） | 🔴 **全局建造阻断的唯一真因**；注释自述理由："beats silently using 1x1 fallback that would let new buildings overlap a corrupted footprint"——即**作者有意为之**，方案 B 若改成 1×1 容错等于推翻这条既有决策 |
| `productionSystem.ts:125` | `const def = defLookup(b.defId);` + `:126 if (!def) continue; // 损坏数据：跳过，不让 NaN 污染整体` | ✅ | 零产出零维护（沙盒 D）。**同样自述有意为之** |
| `productionSystem.ts:95` | `const otherDef = defLookup(other.defId);` + `:96 continue` | ✅ | 孤儿不能当相邻加成的 partner |
| `MapRenderer.ts:674` | `if (!def) continue;` | ✅ | **地图上不可见** |
| `MapRenderer.ts:794` | `const bw = bd?.size.width ?? 1;` | ✅ | 散布层按 1×1 占位（**与 :674 的"不可见"口径不一致**，是唯一兜底成"具体数值"而非"跳过"的点） |
| `MapRenderer.ts:870` / `:906` | `if (!def) return;` | ✅ | 脉冲特效 no-op（`MapRenderer.test.ts:661` 已钉桩） |
| `MapRenderer.ts:1057` | `if (!def) continue;` | ✅ | 不参与烟囱粒子 |
| `gameStore.ts:483` / `:2881` | `?.cost.people ?? 0` | ✅ | 不占劳力（沙盒 E）；`:2881` 的读档补足 people 逻辑因此**不会**为孤儿补 |
| `gameStore.ts:657` / `:1069` | `getBuildingDef(defId)?.classType` → `buildingFulfillmentFactor(classType \| undefined)`，`classNeeds.ts:105` 再 `classType ?? 'farmer'` | ✅ | 孤儿按农夫档算折扣，但因为它产 0 所以无实际影响 |
| `gameStore.ts:827-828` | `if (!fromDef) return { ok:false, reason:'unknown_def' };` | ✅ | 升级明确报 `unknown_def` |
| `gameStore.ts:906-907` | `const def = getBuildingDef(removed.defId); if (def) {…返还…}` | ✅ | 拆孤儿**零返还**（沙盒 F：能拆、不返还） |
| `gameStore.ts:1009-1010` | `if (!targetDef) continue;` | ✅ | `constructing` 的孤儿**永不竣工**，但也不占劳力 |
| `gameStore.ts:2769` | `?.name ?? '城邑'` | ✅ | 割地危机可把孤儿翻 `derelict`，文案显示"城邑" |
| `BuildingPopover.ts:99-100` | `if (!def) return;` | ✅ | 弹窗早退（`BuildingPopover.test.ts:55` 钉桩） |
| `GradePanel.ts:190`、`MegaProjectPanel.ts:143/238`、`ProductionPanel.ts:335` | `?.name ?? …` | ✅ | 展示兜底 |

⇒ **30/30 全有兜底，零裸解引用。** 这条是本稿最重要的实测结论：**不存在"补渲染兜底"这件事可做**，方案 B 的内容只能是"改变兜底的**语义**"（从静默跳过 → 改成显式可处置），不是"从零到有"。

---

## 五、两案对照（完成标准 ③）

### 案 A：校验层补"定义表存在性"（读档即拒）

改法：`saveLoad.ts` `validateBuildingsArray` 在 `:722-724` 的非空串判定后，追加一条 `getBuildingDef(rec['defId']) === undefined ⇒ throw SaveLoadError`。

- **收益**：孤儿永不入档，`placementSystem` 的全局阻断从根上不可能触发；错误信息带下标、可定位。
- **代价（存档兼容面）**：这是**改判**——今天能读的档变读不动。`loadFromSlot`（`:807-821`）**不吞** `SaveLoadError`，一路抛到 `SaveLoadPanel.ts:204-206` 的 `catch` ⇒ 用户看到"操作失败：buildings[0].defId …"，**整档不可读**（不是降级、不是跳过那一栋）。对"曾经能玩、只是某栋建筑改了名"的档，等于判死刑。
- **改了会红的断言（现取，逐条）**：`saveGuard2.test.ts:35-44` 的 `validBuilding()` 夹具默认 `defId: 'farm'`，而注册表里是 `bld_farm`（`buildings.ts:6 id: 'bld_farm'`）——**夹具本身就是孤儿 defId**。26 处 `validBuilding(` 调用中有 **7 个用例走"放行"路径（10 处 `= deserialize(...)` 裸取返回）**，案 A 一律转红：
  - `:146 upgradingTo 空字符串被拒、非空字符串放行（可选字段两态）`——半红（`toThrow` 那半仍绿，`market` 放行那半红）
  - `:154 constructionProgress 界内值（42）原样带出…`
  - `:164 constructionProgress 越界钳制到 [0,100]`
  - `:204 浮点过冲 100.4 / -0.4 被 clamp 吸收（材料点名的旧档场景：严格 throw 会误拒旧档）`
  - `:211 极端有限值收敛且不产生 NaN（1e308 → 100；-MAX_SAFE_INTEGER → 0）`
  - `:222 上界口径钉桩：界内值原样带出，证上界是 100 百分比而非 1 归一化`
  - `:229 clamp 只改数值不改 status（constructing + 150 载入后仍 constructing、进度归 100）`
  ⇒ 落地案 A **必须同时把夹具 `defId: 'farm'` 改成 `'bld_farm'`**（1 行，`saveGuard2.test.ts:37`），否则 7 红。但改夹具属"动测试面"，需人工确认这不是把守卫测试的空洞处补实——`'farm'` 与 `'bld_farm'` 在校验层当前等价，正是本单缺陷的镜像。
  - `:204` 的标题原文含一句既有裁决："**严格 throw 会误拒旧档**"（clamp 组为此选了钳制而非拒载）。案 A 与这条**同族决策直接冲突**，属人工裁决门，不由执行手定。
- 不会红：`MapRenderer.test.ts:425/:661`、`BuildingPopover.test.ts:55`（都直接调渲染/UI，不经 `deserialize`）。

### 案 B：保持入档、把"静默兜底"升级为"可处置"（渲染/状态层统一口径）

改法（三选一或组合，全部**不动 `saveLoad`**）：
- B1 渲染层给孤儿画占位（灰块＋"？"），`GameScene.findBuildingAt` 对孤儿按 1×1 参与命中框 ⇒ 可点选 ⇒ 可拆（复用 `gameStore:906` 已支持的零返还拆除）。
- B2 只在 `placementSystem.ts:64` 收窄：把"有任一孤儿 ⇒ 全图拒放"改成"仅当孤儿 footprint 与本格重叠才拒"（孤儿按 1×1 保守 footprint）。
- B3 读档后一次性把孤儿建筑自动移除／登进 UI 告警条。

- **收益**：既有存档全部仍可读（**不改判**）；直接对症"无 UI 出口"与"全局建造阻断"两条实测症状。
- **代价**：等于**推翻两处作者自述有意为之的保守兜底**——`placementSystem.ts:62-63` 的注释明确说"宁拒不放 1×1 容错，因为会让新建筑压在损坏 footprint 上"；选 B2 就要重写这条风险论断。B1 新增一种"画不出真身"的视觉态，属 UI 口径扩张。
- **改了会红的断言（现取）**：
  - `MapRenderer.test.ts:425 it('skips buildings whose defId is unknown')` → 断言 `expect(buildingsGfx.fillRect).not.toHaveBeenCalled()`，**B1 画占位必红**。
  - `MapRenderer.test.ts:661 it('unknown defId is a no-op (no graphics, no tween)')` → 断言图形数不变，**若占位画在 `MapRenderer` 也红**（若占位只画在 `GameScene` 层则不红，B1 的实现位置决定它红不红）。
  - `BuildingPopover.test.ts:55 it('show 未知 defId：早返回不建弹窗（不白开空窗）')` → 断言 `isVisible() === false`，**任何"给孤儿开弹窗"的改法必红**。
  - `buildingRegistry.test.ts:26 it('returns undefined for unknown id')` → 定义层契约，两案都不该碰。
  - B2 另需核 `placementSystem.test.ts:106 / :118 / :154` 三条优先级断言（`out_of_bounds wins over overlap`、`overlap wins over insufficient_resources`、`unbuildable_terrain wins over overlap`）——它们都用**合法 defId** 夹具，B2 不动 `overlap` 优先级则不红；但**孤儿拒放这条至今零测试覆盖**（现取双口径：`rg -n "bld_does_not_exist" src/renderer/state/__tests__/placementSystem.test.ts` → **0 命中**；该文件内唯一 `unknown` 命中是 `:29` 的 `as unknown as IEventEmitter` 类型转写，与孤儿建筑无关），也就是 B2 改完没有回归网接住，得配新测试（本单禁碰测试件，未写）。
- 经济面连带：B1/B3 会让"玩家白得一次拆除"（`gameStore:906-907` 对孤儿零返还，实测 F），**不涉及数值改动**；B3 若改成"退还原造价"则触及经济平衡数值 ⇒ 🔴 **禁直落**，需另单人工核。

### 对照表

| 维度 | 案 A（校验层拒档） | 案 B（入档后统一可处置） |
|---|---|---|
| 是否改判既有存档 | 🔴 **是**（孤儿档从可读变不可读） | 否 |
| 会红的在册断言数 | 7 用例（`saveGuard2`，另需改 1 行夹具） | 2～3 用例（`MapRenderer` ×2、`BuildingPopover` ×1，取决于实现位置） |
| 对"全局建造阻断"是否对症 | 间接（不让孤儿存在） | 🔴 直接（B2） |
| 对"不可点选/不可拆"是否对症 | 间接 | 🔴 直接（B1） |
| 触及既有自述裁决 | 与 `:204`"严格 throw 会误拒旧档"冲突 | 与 `placementSystem:62-63` 悲观注释冲突 |
| 经济平衡数值 | 不涉 | 不涉（除非 B3 改返还，禁直落） |
| 新增回归网需求 | 中（要钉"孤儿 defId 拒载"） | 高（`placementSystem` 孤儿分支至今 0 覆盖） |

---

## 六、建议单形态（🔴 交人工裁决，本单不落地）

**建议方向（仅建议）**：采 **B2 ＋ B1 的命中框半边** 为对症最小切口，理由三条：① 它只碰实测的两个真因；② 不改判任何既有存档（A 的 7 红＋夹具改动是净负债）；③ 与 `productionSystem:126`、`MapRenderer:675` 既有的"跳过但保命"口径同源，不新立"拒载"哲学。

🔴 但**不建议由执行手定案**的三个理由，全部要人工点头：
1. `placementSystem.ts:62-63` 的悲观注释是一条**在册的、有意的**取舍，推翻它需要游戏设计侧确认"允许新建筑压在损坏 footprint 上"可接受。
2. 案 A 的 `saveGuard2.test.ts:37` 夹具由 `'farm'` → `'bld_farm'` 会**改变守卫测试的覆盖面**（当前它其实从没测过真 defId），属"改判测试意图"，超出执行手授权。
3. B1 一旦画占位，`MapRenderer.test.ts:425` 的"skip"契约要改成"以占位方式 skip"，这是**行为契约变更**，不是 bugfix。

**待人工裁决出口（建议主班登记进待人工台账）**：
- 出口 1：孤儿存档处置哲学 = 拒载（A）还是可处置降级（B）。
- 出口 2：`placementSystem` 悲观拒放是否保留；若保留，是否至少补一条"孤儿存在时在 HUD 明示 N 栋残缺建筑"的可观测性（本稿新增建议，两案之外）。
- 出口 3：`saveGuard2.test.ts:37` 夹具 `defId: 'farm'` 是否改判（它让 7 条断言在案 A 下必红，且从未走过真 defId 路径）。
- 出口 4：`upgradingTo` 是否同受存在性校验约束。现取：`saveGuard2.test.ts:146-152` 明确钉"`upgradingTo: 'market'` 非空字符串**放行**"，而 `'market'` 不是建筑 id ⇒ 若案 A 顺手扩到 `upgradingTo`，`gameStore.ts:1009` 的 `getBuildingDef(b.upgradingTo!)` 分支语义也要一起改判。

---

## 七、遗留问题 / 未做面

1. 本单未做**真机（Electron）验证**：C 例走的是 `canPlace` 纯函数，`GameScene` 侧的"点不中"由 `:498-499` 代码读证 ＋ `findBuildingAt` 是 `:332`/`:456` 两处唯一命中源（现取，`rg -n "findBuildingAt" src/renderer/scenes/GameScene.ts`）推得，未在浏览器里点过。
2. 孤儿建筑能否从**其他入口**（朝令/割地/事件脚本）被清掉：只查到 `gameStore.ts:2769` 割地会把它翻 `derelict`（不消失、不解阻断）。未穷举全部事件 effect。
3. `MapRenderer.ts:794` 的 1×1 兜底与 `:674` 的 skip 属**同层不同口径**，本稿只登记不一致、未判该统一成哪种。
4. 沙盒件留在 `tmp/c924-36/`（gitignored）。若主班要把它转成在册回归测试，需另单（本单禁碰测试件）。

---

## 附：本单复算命令清单

```
# ① 调用点表
rg -n "getBuildingDef\(" src/renderer/scenes/GameScene.ts            # 5 处
rg -c "getBuildingDef\(" src/ --glob '!**/__tests__/**'              # 30 调用点 + 1 定义行
# ② 沙盒
npx vitest run --config tmp/c924-36/vitest.sandbox.config.ts         # 6 passed
# ③ 案 A 红名集
rg -n "defId: 'farm'" src/renderer/state/__tests__/saveGuard2.test.ts        # :37 夹具
rg -n "id: 'bld_farm'" src/renderer/data/buildings.ts                         # :6 真注册 id
# ④ 案 B 红名集
rg -n "it\('.*(unknown|defId)" src/renderer/render/__tests__/MapRenderer.test.ts   # :425 :661
rg -n "show 未知 defId" src/renderer/ui/__tests__/BuildingPopover.test.ts           # :55
# ⑤ 零生产码改动
git diff --stat
```
