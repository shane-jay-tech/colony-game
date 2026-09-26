# 邦国录 · 变更志（CHANGELOG）

> 窗口：**2026-09-05 → 2026-09-25**（该区间 188 笔提交，现取命令见文末「口径」）。
> 上一批**玩家可见**功能不在本窗口内，见 `docs/release-notes-v0.10.0.md`（版本号位 `ebb37db`，2026-08-13）。
> 本志按卷宗 `20260925-120445-68c1` 要求的四类分节：**功能 / 修复 / 兼容性 / 已知限制**；另立第五节承接重构族、末节给复算口径；
> 每条后面直接跟**证据提交短号**与（若有）**测试件路径**——不可追的条目不写。
> 记录日期 2026-09-25；记录者＝信箱执行班 colony35。**本文件不改任何业务码与数值。**

---

## 一、功能

**本窗口内玩家可见新功能＝0 条。** 唯一的 `feat` 笔是开发工具面，如实列在这里，不冒充玩法更新：

| 变更 | 证据 |
|---|---|
| 死导出审计脚本支持 `--out/--write` 参数化（默认写盘行为随之改变） | `42ef2c5`（2026-09-17，n916d-25） |
| 同脚本演进为**默认只读**（审计面不再顺手写仓内案卷） | `9652c32`（2026-09-17，n916f-04） |

> ⚠ 为什么这一节是空的：本窗口的提交集中在**测试钉桩、审计文档、纯函数化重构**三类（`docs` 42／`test` 39／`refactor` 9／`fix` 7 的分布见文末「口径」）。
> 把 `test`／`docs` 笔数折算成"功能"就是虚增，故单列第五节承接重构族。

## 二、修复

| 变更 | 证据提交 | 测试件 |
|---|---|---|
| 存档：坏档样例恢复面补测并修相关恢复路径；原子写崩溃点矩阵；速率显示边界 | `63f0def`（09-25） | `src/renderer/state/__tests__/badSampleRestore.test.ts`、`atomicSaveCrash.test.ts`、`rateDisplayBoundary.test.ts` |
| 造价 NaN 被静默放行 ⇒ 改为钳制并拒走；史官文案死源改直读持久字段 | `29619a4`（09-25） | `src/renderer/state/__tests__/priceBoundaryClamp.test.ts`、`starvationSequenceSaveUi.test.ts`（源：`state/gameStore.ts`、`data/resourceRegistry.ts`） |
| 美术 manifest **双向断链**修复：55 键中 50 键指向盘上不存在的 `public/assets/**.webp` | `39c90c6`（09-20，c921-01） | `src/renderer/data/__tests__/artManifest.test.ts`、`bootLoadList.test.ts`；案卷 `docs/insights/colony-artmanifest-relink-20260920.md` |
| BootScene `loaderror` 同回调双注册去重（单失败单日志） | `a009bdb`（09-17，n916d-24） | `src/renderer/scenes/__tests__/bootLoadErrorDedup.test.ts` |
| 两栋缺图建筑改走**同族复用**贴图（`bld_tin_mine→bld_quarry`、`bld_hemp_field→bld_mulberry_grove`，key 不变、零玩法改动） | `e4548ed`（09-17，n916d-23） | `src/renderer/data/__tests__/artManifestReuse.test.ts`；映射现值可读 `src/renderer/data/artManifest.ts:124` |
| 散布配置 `rock_cluster` 引用了不存在的贴图 ⇒ hills/mountain 池与清单改用既有等价 `rock_boulder`，池概率结构不变 | `86dd9bf`（09-17，n916d-22） | `src/renderer/data/__tests__/scatterAssets.test.ts` |
| 读档加固：`constructionProgress` 钳制 ＋ `resources` shape 校验（含 `noUncheckedIndexedAccess` 类型修正） | `e56d82a`（09-12，p911r-40） | `src/renderer/state/__tests__/saveGuard.test.ts`、`saveGuard2.test.ts`、`saveGuard3.test.ts` |

## 三、兼容性

**存档格式**

- 当前 schema 版本 **9**（`src/renderer/state/saveLoad.ts:19`），迁移表覆盖 `migrations[1..8]`（同文件 `:125` 起）⇒ **v1→v9 逐级升版**；
  超当前版本的档**拒载并报"future schema version"**（`:388`），缺迁移段报"missing: migrations[n]"（`:209`）。
  钉桩件：`src/renderer/state/__tests__/saveV9Fixture.test.ts`、`saveMatrix.test.ts`、`migrationGapMessage.test.ts`。
- 日历上界常量 `MAX_SAVE_CURRENT_DAY = 3600`（`:22`）；**已知在册缺陷见第四节 L9**（上界后日管线照跑，非本志新发现）。
- 事件定序写入快照（同一序列写入→读出的顺序稳定性）：`2deb7bf`（09-25）→ `src/renderer/state/__tests__/eventOrderingSnapshot.test.ts`。

**资产与运行时**

- 美术资产 **png→webp 第一批**（62 图）：`14336fc`（09-20，c921-02）。实测读数（唯一有依据的性能数字，出自
  `docs/insights/colony-assets-slim-20260920.md:18-23`）：运行时载荷 **147.9 → 67.03 MiB**（达标线 ≤100 MiB ✅）；
  同表另一半**同样如实写**：含保留原 png 的**磁盘总占用 147.9 → 159.35 MiB，不达标 ❌**。
  兼容面：贴图 key 与 boot 清单不变（`39c90c6` 的对账用例守着这条边）。
- 色板整体下沉 `src/shared/palette.ts`，`render ↛ ui` 的反向依赖归零：`a921b8a`（09-23，c923-26）；
  边界由 `src/renderer/render/__tests__/renderUiBoundary.test.ts` 常驻守护（跨模块 import 形态变化的兼容面）。

**构建与类型面**

- 三份 tsconfig 的 `tsBuildInfoFile` 由**仓外绝对路径**（`D:/colony-game/...`）收进仓内 `./.tsbuildinfo/`：`fee3d9c`（09-24，c924-15）
  ⇒ 换机/换盘符不再产生"缓存写到别人目录"的隐性不兼容。
- 🔴 现门 `npm run type-check` **只覆盖 renderer**（`tsc -p tsconfig.renderer.json`），`src/main/**`、`src/preload/**` 在覆盖面外；
  接线设计稿已出、未落地：`c48413a`（09-24，c924-04）→ `docs/insights/colony-typecheck-mainpreload-design-20260924.md`。
   ⇒ 本仓硬口径：**双读数**（vitest 绿 ＋ `npm run type-check` rc=0）只是"renderer 双读数"，main/preload 需人工/主班另断。
- 键位口径归一（README 与试玩清单不再各写一份键位）：`84fefe1`（09-24，c924-17）。

## 四、已知限制（在册，逐条可追；本志只登记不处置）

| # | 限制 | 证据 |
|---|---|---|
| L1 | 相机族 NaN 风险站点 **15 处**未完成收敛（census 已出、P0–P7 优先序已定，零 src 改动） | `ada965e`（09-24，c924-14）→ `docs/insights/colony-camera-nan-census-20260924.md` |
| L2 | **7 个数据修饰键零消费＝静默失效**（另 5 键属预留/退役）；处置稿待人工裁决 | `4bf5999`（09-24，c924-06）→ `docs/insights/colony-modifier-consumption-design-20260924.md` |
| L3 | `megaProjects` 14 个叶子字段里 **3 个零消费，其中 2 个仍在 UI 向玩家承诺** | `cc29179`（09-24，c924-28）→ `docs/insights/colony-megaprojects-dataface-20260924.md` |
| L4 | `rock_cluster` 三方不一致（生成器 9／键 8／盘 8），缺的是"生成器↔键"这条对账边 | `d48c2aa`（09-24，c924-16）→ `docs/insights/colony-rockcluster-mismatch-20260924.md` |
| L5 | 孤儿建筑 `defId` 与典册危机两节文案仍在处置稿阶段（未落码） | `c225857`（09-25，c924-36/37）→ `docs/design/defid-orphan-building-design-20260924.md`、`docs/design/codex-crisis-diplomacy-sections-design-20260924.md` |
| L6 | portraits 目录存在孤儿件（差异表＋四出口已列，零删档） | `7877bfd`（09-25，c924-35）→ `docs/insights/colony-portraits-orphan-triage-20260924.md` |
| L7 | 离线奖励死面与 `attic` 台账未收口 | `a75a7d5`（09-25，c924-32/33）→ `docs/insights/colony-offlinereward-deadface-20260924.md`、`colony-attic-ledger-20260924.md` |
| L8 | P1 六行仍未合入（对照表＋合入稿草稿已出，只读，处置交人工） | `32eec44`（09-25，c924-34）→ `docs/insights/colony-p1-premerge-verify-20260924.md` |
| L9 | **日历到 `MAX_SAVE_CURRENT_DAY` 上界后日管线照跑**（现状已被测试钉住，不＝认可） | `2deb7bf` → `src/renderer/state/__tests__/pauseResumeTimeAdvance.test.ts`（④ 组，件内注释已标在册缺陷） |
| L10 | 硬编码文案与单位仍在多处（审计案卷已出，未逐条改） | `17b8498`（09-25）→ `docs/insights/colony-hardcoded-copy-units-audit-20260925.md` |
| L11 | 麻田／锡矿**仍无自有立绘**：现走同族复用贴图，`NO_OWN_ART` 集合仍在（`data/artManifest.ts:28`），`required:false` 并登记在待补素材清单。⚠ 措辞漂移点名：`docs/release-notes-v0.10.0.md` 仍写"暂用占位图"，与现况（复用同族图）不符 | `e4548ed`（09-17）→ 源直读；文案面属产品裁量，本志未改 |
| L12 | SFX 硬链接方案实测**省的空间≈0**，真问题是连带改写风险 ⇒ 不再当瘦身抓手 | `455b337`（09-24，c924-23）→ `docs/insights/colony-sfx-hardlink-plan-20260924.md` |
| L13 | **键盘可达性缺口（本窗口新登记）**：进游戏前两屏（择途／立国）与四张模态的"选择·确认"**只有指针口**，全仓键盘绑定仅 `ESC/SPACE/ONE/TWO/THREE` 五键 ⇒「核心流程无需鼠标完成」不成立；且暂停遮罩 depth 900 **低于** HUD/面板 1000–2400，注释却自称"面板之上" ⇒ 暂停提示被面板遮挡 | 本班单 `20260925-120433-4686`（09-25 20:3x）→ 新增钉桩件 `src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts`（14 例，其中 ③⑤ 两组钉的是缺陷现状）；键位方案与遮罩语义落待人工裁决，**未改码** |
| L14 | 试玩校准欠账：8h 沙盒曲线与国格节奏数值待真人试玩（红线：执行班不改平衡数值） | `docs/release-notes-v0.10.0.md`「已知待办」＋ `docs/design/PLAYTEST_CHECKLIST.md` |

## 五、工程与重构（四类之外，另立一节以免塞进"功能"）

- 视口反投影收进纯函数模块 `viewportMath.ts`（MapRenderer 两处调用点改接）：`71fa00f`（09-25，c924-27）
- 四季名表唯一化＋类型收紧为 `readonly SeasonName[]`：`b8bb754`（09-22，c922-131）；`SEASON_NAMES_DSL` 改名等三单合并：`127f4d0`（09-23，c923-10/11/12）
- 测试脚手架收编（本地 fake 副本归零，唯一定义处）：`502125d`（09-23，c923-02）、`82206f7`（09-22，c920-11）、`2dd0dd1`（09-24，c924-13）
- 孤儿交付物族归位（MapRenderer／BuildPanel）：`86b27c7`（09-23，c923-04）
- 删除 9 条静态真死导出（用户 9/17 晨拍板）：`63dca27`
- `audit-dead-exports` 慢尾诊断：热点是**无缓存重复读盘**、不是正则：`02f356a`（09-24，c924-11）

## 口径（复算用）

- 窗口提交数：`git log --since=2026-09-05 --pretty='%h|%ad|%s' --date=short | wc -l` → **188**（本机现取 2026-09-25 20:3x）
- 类型分布（同窗口，按 Conventional 前缀）：`docs 42 / test 39 / refactor 9 / fix 7 / chore 5 / perf 1 / build 1 / feat 1`，其余为不带前缀的历史笔
  （复算：`git log --since=2026-09-05 --pretty='%s' | sed -E 's/^([a-z]+)\(.*$/\1/' | sort | uniq -c | sort -rn`）
- 用例计数**不引用旧档数字**（本仓 `84fefe1` 已把 README 的固定计数改成"如何现取"表述）：现取 = `npm test`（全量，本波并行不跑），
  单文件定向 = `npx vitest run <路径>`，类型门 = `npm run type-check; echo rc=$?`
- **本志不含任何未实测的性能收益**：唯一数字对（147.9→67.03 MiB）指到测量档行号，且连同"磁盘总占用不达标"一起写
- 每条变更的证据面：提交短号（可 `git show --stat <号>` 复算）＋测试件/案卷路径（可 `test -f` 复算）
