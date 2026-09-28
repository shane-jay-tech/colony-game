# c927-67 · `viewportCenterTile` 删死码 vs 按 T5 原意接回——现状复核与裁决材料

> 班：`qoder-executor-20260929-0307-colony59`（只读位）｜2026-09-29T03:2x+08:00（`date` 现取 03:14，收口 claims 03:2x）
> 仓／HEAD：`D:\code\colony-game` @ `8a9eaea`（2026-09-28 17:29:47）
> 上游锚点：`zcode-bridge/done/c923-15.result.md` §遗留问题 1 ＋ 其设计稿 `docs/insights/colony-iso-unify-design-20260923.md` §3.2／§6 第 3 笔／§7 T7'-T11 ＋ 原意出处 `docs/decisions/2026-06-03-impl-iso-camera-readability-fix.md` :37-42
> 口径：**裁决材料单**，本单未删一行、未接一行、未跑任何写口。**推荐＝删（附三条连带账）**。
> 工作树 parity：`git status --porcelain src/renderer/render/MapRenderer.ts src/renderer/render/viewportMath.ts src/renderer/render/iso.ts src/renderer/scenes/GameScene.ts src/renderer/render/__tests__/MapRenderer.test.ts src/renderer/render/__tests__/viewportMath.test.ts` → **空** ⇒ **HEAD 版＝工作树版，无差**；唯一例外是台账 json（在册在途 ` M`），已按 §四 **双报两版**。

---

## 一、现状复核（锚点结论逐条，含 4 处漂移）

### 1.1 死码判定**仍成立**，且行号已漂（817 → **815**）

现值：`MapRenderer.ts:811-829`（19 行含 :811-814 的 doc 注释），`private viewportCenterTile()` 体为「屏幕中心→世界点→减 origin/isoOffset→`Math.round((a+bb)/2)`／`Math.round((bb-a)/2)`→`Math.max(0, Math.min(w-1, …))` 夹边」。

- 活引用 **0**：`grep -rnw "viewportCenterTile" src/ scripts/` = **4 命中**，扣除后＝**零可执行引用**——1 处声明（:815）＋ 3 处**文案引用**（`MapRenderer.ts:806` 注释、`viewportMath.ts:11` 契约 3、`viewportMath.test.ts:93` 的 `it()` 标题）。
- 码面从未有过调用方：`git log --oneline -S'this.viewportCenterTile' -- src/` → **空**（⚠ **不带路径限定的同款查询现在会假命中**：全仓 `-S` 多出 `32f2208`＝c923-15 设计稿 itself 提到该串。⇒ **未来查 D 必须 `-- src/`**，锚点当年写「空」时设计稿还不存在，这条是新增陷阱）。
- 编译期无人报：`grep -n "noUnusedLocals\|noUnusedParameters" tsconfig.base.json` → **0 命中**（只有 `strict: true`）⇒ 未用的 private 方法**不触门**，`npm run type-check` 现值 **rc=0** 已实测（覆盖 `src/renderer/**/*`，含 `MapRenderer.ts`）。

### 1.2 **漂移 1（本单最大）**：c924-27 已落，「四式逆投影」现值只剩**一式未并**

锚点数的是四站点（`iso.ts` 连续版／floor 版、`MapRenderer` E、`MapRenderer` D）。现值：

- `viewportMath.ts`（**49 行，c924-27 新建**，commit `71fa00f refactor(colony): c924-27 视口反投影收进纯函数模块`）已有 `worldToGridCell` = `Number.isFinite` guard ＋ `isoToGridF` ＋ floor ＋ 界外 `null`；`MapRenderer.screenToGrid`（:807-809）**只剩一行委托**。
- ⇒ **E 已被并入权威式**，`grep -rn "(a + bb) / 2|(bb - a) / 2" src/ scripts/` 现值 **4 行＝2 站点**：生产侧仅 `MapRenderer.ts:826-827`（**就在 D 体内**）＋ 测试侧复刻 `viewportMath.test.ts:170-171`（提取前的原文对照桩）。
- 连带订正锚点 §3.3：`isoToGridF` 的「生产 0 引用」**已不成立**——现值 `prod=4` 行（`iso.ts:54` 被 `isoToGrid` 内调 ＋ `viewportMath.ts:15` import／:44 调用），即**已上岗为权威式**；`isoToGrid` 仍 `prod=0/tests=8`、`isoMapBounds` 仍 `prod=0/tests=3`（锚点遗留 2 的去留问题面未变）。

**这条改变了本题的性质**：锚点时代「三合一再顺带处置 D」是主菜；现在 **D 是全仓最后一个未并的逆投影手抄本**，而三合一的其余部分已由 c924-27 单方面做完。留着 D 的代价已从「一行死码」升格为「**第二份比例事实源**」——`MapRenderer.ISO_HW/ISO_HH` 的除法在 :824-825 又被手抄了一遍，菱形比例一改即静默错位（正是设计稿 §6 第 4 笔点名的病）。

### 1.3 T5 原意线索现值：原意的** bug 已被别的路径修掉**，原意的**语义被 v2 反向决策覆盖了**

`docs/decisions/2026-06-03-impl-iso-camera-readability-fix.md` :37-42（同日追加修复，用户实测截图「地图缩在右下角、左上一片黑、没居中」）：

- 根因：`recenter()` 重算 origin 并平移图层，但**没同步相机 scroll**。
- 当时的修法（＝T5 原意）：**新增 `viewportCenterTile()` 记焦点格 → `recenter()` → 必要时 zoom 回概览 → `centerOnTile(焦点格)`**，「用格子坐标做锚，origin/zoom 怎么变都能正确回中；**用户已滚动到某处再 resize 也保留视角**」。
- **接线从未发生**（§1.1 的 `-S` 空证 ＋ 现值 0 活引用），但**那个 bug 已经修了**：现值 `rebuildAfterResize`（`MapRenderer.ts:354-369`）走的是 `recenter()` → `cam.setZoom(this.getDefaultZoom())` → `centerOnTile(Math.floor(w/2), Math.floor(h/2))`，即**强制回到「整图铺满＋对准地图中心」**；心跳兜底 `ensureFittedToViewport`（:394-408）同型。
- 而且它**在册钉住了**：`MapRenderer.test.ts:567`「v2: rebuildAfterResize re-fits to the whole-map max zoom」、`:577`「v2: …**never keeps an above-fit zoom**」、`:585`「v2: ensureFittedToViewport re-fits + centers on size change」；2026-06-03 承诺的 25%~75% 中央带回归**也在册**（`:598-599`、`:619-635`，其注释原文「复现截图 bug：开局窗口从 1366×800 最大化到 1920×1080，recenter 只挪 origin 不挪 scroll → 地图缩到右下角」）。
- 🔴 **决定性一格**：`getDefaultZoom() = coverZoom`（:231「v4：开局/重置的默认缩放 = **铺满整图并居中**」）。⇒ resize 时 zoom 已被强制拉到「整图刚好装下」，此时若改用「用户焦点格」做锚，地图必然偏离视口中心、**露出黑边**——即「焦点格锚」与「强制全图 fit」**在语义上互斥**，不是加一行调用就能并存的两件事。**接回 T5 ＝ 推翻 v2 的 resize 决策**（并动那 3 条在册 v2 桩），而非补一行遗漏的接线。

### 1.4 台账与「双口径」现值（删案的前置账，本单已代跑）

- 台账 `docs/insights/colony-dead-exports-20260914.json`：**HEAD 版** `generatedAt 2026-09-18T18:45:50.388Z`、**工作树版** `2026-09-18T19:39:52.078Z`（该件是 brief §C 的在册在途 ` M`，本单只读、**双报两版**），两版 `summary` 均为 `{dead: 0, testsOnly: 108, internalOnly: 0}`、`entries` 均 **108** 条。
- **两版都没有 `viewportCenterTile` 条目**（`viewportCenterTile in HEAD: False`；MapRenderer 名下 3 条目全是常量 `AVG_BUILDING_TILES`／`BUILDINGS_ON_SCREEN_TARGET`／`MAP_BUILDING_MAX_SCALE`）。原因写在脚本文义里：`scripts/audit-dead-exports.mjs:118` `rule: 'value-exports-only; word-boundary; buckets dead|tests-only|internal-only|wired-dynamically'` ⇒ **private 方法不入账**。⇒ **删了台账一字不变**，别让主班以为台账会自动收口（锚点遗留 1 的这条警告**现值仍真**，且本单给到了条目级证据）。
- c922-114 的「双口径复查」＝ HEAD 口径 ＋ 工作树口径各扫一次（其 result §1「不可达性双口径成立…零反例」）。**本单已按该手法代跑 D**：`git grep -w viewportCenterTile HEAD -- src scripts` → **4 行**（声明 1＋文案 3），工作树 `grep -rnw` → **4 行同一组** ⇒ **双口径零活引用，删案的前置复查已过**。
- ⚠ **本单未跑 `audit-dead-exports.mjs`**：该脚本有**两个写口**——`--out`（:111 解析，:130 `fs.writeFileSync`）与 `--write`（:113 解析，:137 写回 `DEFAULT_JSON`），只读位一条都不带；且默认路径虽自报 `[read-only]`（:140），仍**不必要地扫全仓并可能受兄弟班未跟踪件影响**，故以 `git grep`/`grep -rnw` 两路口径替代（同一判据，零写盘）。

---

## 二、两案矩阵

| 维度 | 案 甲｜**删死码**（`MapRenderer.ts:811-829`，19 行） | 案 乙｜**按 T5 原意接回**（`rebuildAfterResize` 记焦点格 → `centerOnTile(焦点格)`） |
|---|---|---|
| 行为面 | **零行为变化**（0 活引用，`grep -rnw` 扣声明后空集；57 例点名基线全绿⇒无可断的红） | **真行为改动**，且方向是**推翻 v2**：resize 不再强制「全图铺满＋地图中心」，改「保留用户视角锚」；与 `getDefaultZoom=coverZoom` 互斥（§1.3）⇒ 极可能重现 2026-06-03 那类黑边/显小 |
| 测试账 | 现值**无**任何针对 D 的断言（private 且无入口，锚点 §3.1 的「无法测」现值仍真）；**但有 3 处文案要同步改**（:806 注释／`viewportMath.ts:11` 契约 3／`viewportMath.test.ts:93` 标题），不改＝**注释说谎**＋T7' 桩失去参照物 | 至少动 **3 条在册 v2 桩**（`:567`／`:577`／`:585`）＋复核中央带 2 桩（`:598-599`、`:619-635`）；另需新写「resize 保留视角」的正向断言——**T7'／T11 也得同时钉**（设计稿 §7：T11＝±Infinity 经 `round+clip` 静默产出 `{39,0}`／`{0,39}` 可达角格，现值**未修**） |
| 防漂移收益 | **拿到**：全仓逆投影手抄本归零（D 是最后一个，§1.2），菱形比例单一事实源回到 `iso.ts` | 不拿到（反而多一条依赖 `ISO_HW/ISO_HH` 的活路径，且要为其补 guard） |
| 台账 | 不变（rule value-exports-only，两版 0 条目，§1.4）⇒ **需人工在主班台账另记一笔「D 已处置」**，不能指望 JSON 自收口 | 同左（接回后 D 变活码，仍不入账） |
| 锚点成本自估 | 设计稿 §6 第 3 笔：**删 0.2h** | 同笔：**接 0.5 人日**——⚠ 该估是**接线本身**，**不含**推翻 v2 与动 3 条在册桩，本单按现值上修 |
| 回滚 | `git revert` 干净（19 行，无资产无历史包袱） | 涉及相机/resize 时序（`GameScene.ts:546/:556` 的 80ms debounce ＋ 280ms 安全网 ＋ 心跳 `ensureFittedToViewport` 三处竞态面），回滚后仍可能留时序侧效应 |

**两案共同的前置事实**：无论删或接，`MapRenderer.ts:826-827` 手抄式与 `iso.ts` 权威式的**语义不可统一**这条仍然成立——floor vs round 在界内随机点分歧 **74.0%**（样本 5003，设计稿 §2 探针 [2]，本单未重跑探针、只引其结论并标注为**他班读数**）。所以案乙若落地，**不能**顺手把 D 改成走 `isoToGridF`（会静默改语义），必须保留 round＋显式 `Number.isFinite` guard（＝T11 的修法）。

---

## 三、推荐（供拍板）

**推荐案甲：删 `MapRenderer.ts:811-829`（19 行），并同笔清掉 3 处文案引用。** 三条依据都是盘上读数，不是审美：

1. **T5 要修的 bug 已经修了，而且是用另一条路径修的**：2026-06-03 承诺的中央带回归在册在 `MapRenderer.test.ts:619-635`，走的是「强制全图 fit＋地图中心」。⇒ 接回**不是补漏，是反向决策**，其真实成本要从 §6 第 3 笔的「0.5 人日」上修到「推翻 v2 resize 语义＋动 3 条在册桩」。
2. **焦点格锚与 `getDefaultZoom=coverZoom` 互斥**（§1.3）：接回会重新引入「黑边/显小」这一族已被用户实测否掉的表现。若真要「resize 保留用户视角」，那是**产品决策**（要先定 v2 的强制 fit 是否作废），不该由死码处置单顺手带。
3. **删除反而多拿一项收益**：D 是全仓**最后一个**逆投影手抄本（c924-27 已把 E 并进 `isoToGridF`），删掉即「菱形比例第二事实源」清零——这正是设计稿 §6 第 4 笔想解决的问题，**且不花额外成本**。

**若人工仍要保留 T5 意图**，比「接回原码」更便宜的第三条路（登记用，本单不做）：删 D ＋ 在 `viewportMath.ts` 加一个**纯函数** `worldToNearestTile()`（round＋`Number.isFinite` guard，即 T11 的正确形态），把「resize 锚点」留给将来真要改 resize 语义时再写。**死码的价值在于算法而非载体**——这段算法已被 §1.2 证明只值一个纯函数。

**删的三条连带账（必须同笔，否则留下会撒谎的文档面）**：
- `MapRenderer.ts:806` 注释「…越界返 null 的语义与 viewportCenterTile 的夹边语义保持两份」→ 改成只述 null 语义；
- `viewportMath.ts:11` 契约 3「越界返 null 的语义不与 viewportCenterTile 的『夹回边界』合并（材料档 T7）」→ 删该句或改注「历史：D 已于本笔移除」；
- `viewportMath.test.ts:93` 的 `it()` 标题「（T7：与 viewportCenterTile 的夹边语义不可合并）」→ 标题改文（**断言本体不动**，它测的是 `worldToGridCell` 的界外 null，删 D 不会让它红）。

**并笔建议（同一次提交内可判）**：主班待人工台账记「D 已处置＝删除」一条——台账 JSON **不会自动变**（§1.4 条目级已证）；设计稿 §6 第 3 笔与设计稿自身 §3.2 的「`git log -S` 空」结论可加一行**路径限定警示**（§1.1 的新陷阱）。⚠ 设计稿 `colony-iso-unify-design-20260923.md` 已 tracked，改它属另一笔文档单，本单不代改。

---

## 四、待人工 / 本位不可闭合项

1. 🔴 **需人工拍板**：案甲（删 19 行＋清 3 处文案）／案乙（接回＝推翻 v2 resize 语义）／登记项「删码＋留纯函数」。本单**一行未删、一行未接**。
2. 🔴 **resize 语义（强制全图 fit vs 保留用户视角）＝产品/UX 决策**：若要乙，先裁 v2 的三条在册桩（`MapRenderer.test.ts:567/:577/:585`）是否作废。
3. **T11 缺陷面仍未修且随甲案自动消失**：±Infinity 经 round+clip 产可达角格（设计稿 §4.2 实测 `{39,0}`／`{0,39}`，本单未重跑探针）。选甲＝该缺陷随码一起删；选乙＝必须同笔补 guard＋T11 断言，**不许默默留着**（设计稿 §7 原文）。
4. **判据要全量读数处落 partial 口径**：本位禁跑全量套件（colony 门禁约 40-60s、pre-commit 会把未跟踪测试件算进、同刻有兄弟班）。本班只给定向读数：`MapRenderer.test.ts` 41 例 ＋ `viewportMath.test.ts` 16 例 ＝ **57 例全绿**，`npm run type-check` **rc=0**（覆盖 `src/renderer/**/*`；⚠ 不覆盖 `src/main/index.ts`；`vitest` 不做类型检查）。全库红绿请主班收班统一取。
5. **`scripts/audit-dead-exports.mjs` 未跑**（两个写口 `--out`:111/:130、`--write`:113/:137，只读位一条不带，见 §1.4）⇒ 台账**刷新后**的读数由主班跑，本单只引其现值 JSON（且已双报 HEAD／工作树两版）。
6. **在途件保护（brief §C）**：台账 json 本体、其 `.bak`（` D`）、`colony-suite-timings-20260921.json`、`OPTIMIZATION_BACKLOG.md` 四枚**一律未碰未还原**；`?? docs/insights/c927-*.md` 9 枚（brief 写 8 枚 `-adjudication.md`，盘上 glob 实为 9 枚、带该后缀仅 2 枚）只指方向未引内容。
7. **本单产物**：仅本文件（留工作树待主班按精确路径代提交）；insights 索引未自登。**测试面**：本仓**无根 `tests/` 目录**，测试件一律在 `src/**/__tests__/`（本单点名的两支即 `src/renderer/render/__tests__/`）——卷宗与 brief 的该提醒与盘上相符，已按此口径执行。
