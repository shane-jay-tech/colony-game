# colony 等距逆投影三合一设计方案（`tileFromLayerLocal`，c923-15，只设计不实现）

- 单号：`c923-15` · 班：`qoder-executor-20260923-0022-colony6` · 取数时刻 2026-09-23T11:4x（+08:00）
- cwd `D:\code\colony-game`，HEAD `127f4d0`；开工工作树 3 项在册他班件（`docs/design/OPTIMIZATION_BACKLOG.md` ` M`、`docs/insights/colony-dead-exports-20260914.json` ` M`、其 `.bak` ` D`），**本单零触碰**（json 只按"在册旁证"读，结论一律自建，理由见 §7）
- 上游：`zcode-bridge/done/c922-15-colony-maprenderer-material.result.md` ＋ 其产物 `docs/insights/colony-maprenderer-viewport-material-20260922.md` §三行 D/E、§四缺陷 1/2、§五 T5/T6/T7；卷宗原文「建议主班单开一单，勿混进『视口提取』」⇒ 本单即该独立设计单
- 性质：**设计稿**。生产码／测试码／经济数值零改动，`git diff --stat` 净零（口径见 §8）

---

## 1. 结论先行（四句）

1. **合并的"防漂移"价值成立，但"去重三份活代码"的设想不成立**：四式逆投影里**只有一份活着**——D（`viewportCenterTile`）**从出生起就没有调用方**（`git log -S` 证，§3.2），`isoToGrid`/`isoToGridF` **生产零引用**（§3.3）。真活链只有 E（`screenToGrid`，4 个 `GameScene` 调用点）。⇒ 三合一的实际工作量不在"改调用方"，而在"把两份没人调的实现**处置掉**"，而处置＝删码或接线，**都需裁决**，不该由提取单顺手做。
2. **两种语义绝不可统一成一种**（这是本设计的硬约束，不是口味）：界内随机点上 floor 与 round 的落点**分歧率实测 74.0%**（样本 5003，§4.3）。所以 `tileFromLayerLocal` 必须是"**一个核心 + 两个不可混用的出口态**"，且上游 T7「同一无效输入下 E 给 null、D 给边界格，两种语义不许在提取时统一」要**写进类型**，不能只写进注释。
3. **签名建议用判别联合而非两个布尔**（§5）：`{ mode:'floor', outOfMap:'null' } | { mode:'round', outOfMap:'clip' }`——上游草案 `tileFromLayerLocal(lx, ly, halfW, halfH, {mode:'round'|'floor', clip:boolean})` 是 2×2 = 4 个可表达态，其中 `floor+clip`、`round+null` **两个是现网无人要、且一旦写出来就静默改语义**的态；判别联合让它们在编译期不可表达。
4. **改名连锁比合并更贵，建议拆三笔**（§6）：`screenToGrid` 名不副实（实为 world→grid，上游缺陷 2）的实测连锁是**代码 19 处 ＋ 历史文档 5 处**，而三合一本身**零调用方改动**。把两件事混在一个 diff 里会让"机械改名"与"语义提取"互相遮蔽验收。

---

## 2. 锚点复核（卷宗每句前提的实测）

| # | 卷宗/上游前提 | 实测命令 | 读数 | 判定 |
|---|---|---|---|---|
| B1 | `iso.ts:44 isoToGridF(sx, sy): { gx; gy }` | `rg -n "export function isoToGridF" src` | `44:` ⇒ **0 漂移** | ✅ |
| B2 | `iso.ts:53 isoToGrid(sx, sy): GridPoint` | `rg -n "export function isoToGrid\b" src` | `53:` ⇒ **0 漂移** | ✅ |
| B3 | 「`MapRenderer.ts:284` panBy」（c923-14 锚，本单顺带复跑） | `rg -n "panBy" src/renderer/render/MapRenderer.ts` | 284 一处 | ✅（他班未推进该行） |
| B4 | 「三份等距逆投影」 | `rg -n --glob '!tmp/**' -e "\(a \+ b\) / 2" -e "\(a \+ bb\) / 2" -e "bb - a\) / 2" src scripts` | 命中 5 行＝**表达式站点 4 处**：`iso.ts:49`（连续版，一行含两轴）、`iso.ts:55`（floor 版 `{gx,gy}`）、`MapRenderer.ts:807-808`（E floor）、`MapRenderer.ts:828-829`（D round＋夹边） | ⚠ 口径澄清（非否证）：上游按**语义**算三份（把 iso.ts 那两个当一个"权威版"），按**代码站点**是四处。本档一律用四处口径，避免"合并了三处还剩一处"的漏网 |
| B5 | 「`screenToGrid` 改名连锁的 12 处测试引用」 | `rg -o "\bscreenToGrid\b" src/renderer/render/__tests__/MapRenderer.test.ts \| wc -l` | **12**（行数＝出现数，本文件每行 ≤1 次） | ✅ **精确命中，无漂移** |
| B6 | 「`isoToGrid` 一旦被生产引用就要重跑 `iso.test.ts` 往返口径」 | `rg -c "\bisoToGrid(F)?\b" src scripts`（逐文件） | `iso.ts` 自身 3 行 ＋ `iso.test.ts` 7 行；**生产文件 0 行** | ✅ 前提成立且"一旦"尚未发生 ⇒ 本单可先不跑该回归；§7 给"接线即触发"的清单 |
| B7 | 上游 E/D 行区间「800-811 / 819-831」 | 现读 `MapRenderer.ts` | E 定义在 **800**、体到 811；D 定义 **817**、体 822-831（上游写 819-831 是从 docstring 末行起算） | ⚠ 小幅漂移（D 定义行 −2），本档一律用现读值 817 |
| B8 | 上游 §四-3「实测 NaN 会**穿过 `clampScroll` 写进 `cam.scrollX`**」 | 本班 c923-14 走**真方法**复算（`MapRenderer.panby-nan.test.ts` 5 例，2 文件 46 例绿） | **否证**：`clampScroll` 读的是 `(cam.scrollX as number \| undefined) \|\| 0`，NaN 是 falsy ⇒ 被洗成 **0** 才进 `clampScrollFor`；最终相机**不是 NaN**，而是"已有 scroll 被归零"。±Infinity 是 truthy ⇒ 反被 clamp 顶到边界（上游这一条读数对，与他们的 node 复刻同向） | 🔴 已否证，根因＝**复刻式复算漏了链路里的一次 `|| 0` 再读**。方法论直接进本档 §7（T6/T7 必须走公开方法，不得抄公式） |

---

## 3. 引用面实测清单（完成标准 ②）

### 3.1 四个实现的现状归属

| 站点 | 签名／返回 | 前置守卫 | 取整 | 界外 | 生产调用方 | 测试调用方 | 台账 |
|---|---|---|---|---|---|---|---|
| `iso.ts:44 isoToGridF(sx, sy)` | `{ gx, gy }`（连续，不取整） | 无 | — | 无界概念 | **0** | `iso.test.ts:3,21` | tests-only |
| `iso.ts:53 isoToGrid(sx, sy)` | `GridPoint`（即 `{gx,gy}`） | 无 | `Math.floor` | **不查界** | **0** | `iso.test.ts:3,27,30,33` | tests-only |
| `MapRenderer.ts:800 screenToGrid(screenX, screenY)`（**E**） | `{ x, y } \| null` | `!Number.isFinite(lX/lY) → null`（:801） | `Math.floor` | 越界 `→ null`（:810） | **4**（`GameScene.ts:330,406,455,477`） | `MapRenderer.test.ts` 12 处 | 在册活码 |
| `MapRenderer.ts:817 private viewportCenterTile()`（**D**） | `{ x, y }` | **无** | `Math.round` | 越界 **夹回边界** | **0**（从未有过，§3.2） | **0**（无法测：private 且无入口） | 死码（不在台账内，因台账 rule=value-exports-only，private 不入账） |

> 输入域差异是命名的由来：iso.ts 两式收**投影后坐标**；E/D 先做 `lx = screenX − originX − isoOffsetX; ly = screenY − originY`（**图层局部**）再算 ⇒ 合并点只能落在"图层局部"这一层，故上游给的函数名 `tileFromLayerLocal` 是对的。

### 3.2 D 从未被调用（本单最有用的新事实）

```
$ git log --oneline -S'viewportCenterTile' -- src/renderer/render/MapRenderer.ts
54eafe9 chore: 快照提交 6-7 月工作树（iso 等距重画 / 国策树 HOI4 化 / …）      ← 唯一命中＝引入那次
$ git log --oneline -S'this.viewportCenterTile' -- src/renderer/render/MapRenderer.ts
（空）                                                                       ← 调用串从未出现/消失过
$ rg -c "\bviewportCenterTile\b" src scripts → 仅 MapRenderer.ts:817 一处
```
⇒ D 是**出生即死**的 private 方法（`docs/decisions/2026-06-03-impl-iso-camera-readability-fix.md` 记它"resize 时用"，但那次没接线；tsconfig `strict` 未开 `noUnusedLocals` ⇒ 编译器不报）。
**对本单的影响**：上游设想的"T5（`centerOnTile` ↔ `viewportCenterTile` 互逆）"与"T7（E 给 null、D 给边界格）"**目前都无法从公开 API 打靶**——D 只能靠提取后的纯函数测，或靠接线后才可测。这条必须在派实现单前裁决（§6 分单第 3 笔）。

### 3.3 `isoToGrid*` 生产零引用的双证（不采信在途 json）

```
$ rg -n "\bisoToGrid" src scripts            → iso.ts:44,53,54 ＋ iso.test.ts:3,21,27,30,33（生产 0）
$ rg -n "from './iso'" src/renderer/render/MapRenderer.ts
10: import { ISO_TILE_W, ISO_TILE_H, gridToIso, gridCenterToIso } from './iso';   ← 无 isoToGrid*
```
旁证（**只当旁证**）：`docs/insights/colony-dead-exports-20260914.json` 的 `iso.ts` 三条目 `bucket: "tests-only"`（`isoToGridF` hitsInTests 5、`isoToGrid` 5、`isoMapBounds` 4），`rule: "value-exports-only; word-boundary"`。
⚠ 该 json 工作树处于他班 ` M` 态、`summary={dead:0, testsOnly:108, internalOnly:0}` 被 c922-13 判为**污染口径**，且 `generatedAt` 是 2026-09-18；故本档结论以自跑 `rg` 为准，json 只用来证明"这件事早在册、不是本班新发现的意外"。
**顺带第 5 处重复（同族但不在本单范围）**：`isoMapBounds`（tests-only）与 `MapRenderer.ts:413-415` 手抄的 `isoOffsetX/mapPxW/mapPxH` 用**同一组公式**，与逆投影是同一个"改菱形比例会静默错位"的病。建议主班把 `isoMapBounds` 一并纳入第 1 笔的收口面（成本 +0.5h，判据现成）。

### 3.4 若 `screenToGrid` 改名（上游缺陷 2 的连锁账）

| 归属 | 文件 | 出现次数 | 处置 |
|---|---|---|---|
| 定义＋内部注释 | `src/renderer/render/MapRenderer.ts:800,815,1020` | 3 | 机械改 |
| 生产调用方 | `src/renderer/scenes/GameScene.ts:330,406,455,477` | 4 | 机械改（四处都是 `renderer.screenToGrid(pointer.worldX, pointer.worldY)` ⇒ 正是要点名"实为 world"的证据） |
| 测试 | `src/renderer/render/__tests__/MapRenderer.test.ts` | **12** | 机械改；含 :182-185 往返、:191-193/:197-200 的 null 语义断言（**判据不许顺手放宽**） |
| 历史文档（tracked） | `docs/insights/colony-maprenderer-viewport-material-20260922.md`(4)、`colony-plan-ledger-20260922.md`(1) | 5 | **不改写**（§十二 口径：历史档的当时盘态留痕），改名单里加一行"旧名 `screenToGrid` 见上述两档"的指认即可 |
| 合计 | — | **代码 19 ＋ 文档 5** | 建议独立一笔，diff 纯净 |

---

## 4. E / D 语义对照（完成标准 ① 的上半）

### 4.1 逐步对照表

| 维度 | **E `screenToGrid`**（:800-811） | **D `viewportCenterTile`**（:817-831） |
|---|---|---|
| 输入语义 | 名为 screen，**实为世界坐标**（无 `/zoom`、无 `-scroll`，上游缺陷 2） | 真屏幕→世界：`worldX = (cam.scrollX\|\|0) + (vp.x + vp.w/2)/z` 后才进同一段逆投影 |
| 相机依赖 | 无 | `cam.zoom` `cam.scrollX/Y` `computeViewportRect()` |
| 图层局部落地 | `lx = screenX − originX − isoOffsetX`；`ly = screenY − originY` | 同式（对 world 值做） |
| 半轴常量 | `MapRenderer.ISO_HW/HH`（`:137-138` = `ISO_TILE_W/2`、`ISO_TILE_H/2`） | 同 |
| 取整 | `Math.floor` | `Math.round` |
| 界外 | `x<0 \|\| y<0 \|\| x>=width \|\| y>=height` → **null** | `Math.max(0, Math.min(width-1, …))` → **夹边** |
| 非有限输入 | `!Number.isFinite` → **null**（测试 :197-200 钉住） | **无守卫**（见 4.2） |
| 返回形状 | `{ x, y } \| null` | `{ x, y }` |
| 现可测性 | 公开方法，已被 `MapRenderer.test.ts` 覆盖 | private 无调用方 ⇒ **今天不可测** |

### 4.2 脏值出口实测（探针 `tmp/c923-15/probe2.mts`／`probe3.mts`，`npx tsx` 现跑）

| 入（另一轴取 0，图 40×40） | E（isFinite→null，floor，界外 null） | D（round＋clip） | `isoToGrid`（floor，无守卫无界） |
|---|---|---|---|
| `lx = NaN` | `null` | **`{x: NaN, y: NaN}`** ← clip 对 NaN 无效（`Math.max(0, Math.min(39, NaN)) = NaN`） | `{gx: NaN, gy: NaN}` |
| `lx = +Infinity` | `null` | **`{x: 39, y: 0}`** ← **看起来完全合法的角落格** | `{gx: Infinity, gy: -Infinity}` |
| `lx = -Infinity` | `null` | **`{x: 0, y: 39}`** | `{gx: -Infinity, gy: Infinity}` |

⇒ 三合一**不能**把 D 的脏值面当成"有 clip 就安全"：±Infinity 经 `round+clip` 会**静默产出可达格**，比 NaN 更坏（NaN 至少 `Number.isNaN` 可测）。这条要作为 **T11**（新增，见 §7）钉进实现单判据。

### 4.3 相等口径（决定 T6 怎么钉）

```
[1] isoToGrid ≡ 「floor + 界内」在格点集上：顶点∪中心 3200 点 ⇒ 等 3200、不等 0
[2] 界内随机点 floor vs round 落点分歧：74.0%（样本 5003）
```
⇒ **T6 只能在格点集上钉"逐点相等"**：以 `gridToIso(gx,gy)` 顶点集与 `gridCenterToIso(gx,gy)` 中心集为输入域（现 `iso.test.ts:18-26` 已是这个域，可直接扩到 40×40 全格点）。**若在连续随机点上钉相等，74% 必红**——这是实现单最容易踩空的一处，务必写进判据。

---

## 5. 签名草案（完成标准 ① 的下半）

**核心放哪**：`iso.ts`（纯、无 Phaser、已有 `iso.test.ts`），不放 `cameraMath.ts`（后者是"相机/视口数学"，逆投影属"投影"，且 `iso.ts` 已是权威版所在 ⇒ 合并顺带把权威版**用起来**，不再是第 5 处手抄）。

```ts
/** 图层局部坐标（已减 originX/isoOffsetX 与 originY）→ 格子。两种出口态编译期不可混。 */
export type TileFromLayerLocalSpec =
  | { mode: 'floor'; outOfMap: 'null' }     // = 现网 E（screenToGrid）
  | { mode: 'round'; outOfMap: 'clip' };    // = 现网 D（viewportCenterTile）
// 明确不提供 floor+clip / round+null：现网无此语义，给出参数位＝给 future 一次静默改语义的机会。

export function tileFromLayerLocal(
  lx: number, ly: number, halfW: number, halfH: number,
  spec: TileFromLayerLocalSpec,
): { gx: number; gy: number } | null;
```

配套三条（缺一条合并就不算收口）：

1. **`finite: 'guard' | 'off'` 不进参数表**——E 的 `Number.isFinite → null` 守卫属"入口卫生"，应放在**包装层**（`screenToGrid`/`worldToGrid` 保持自己那行 guard），核心只声明"非有限输入的返回值不承诺"，并在 §4.2 的探针数字上钉 T11。理由：把守卫做成可关的参数＝把 D 现在"±Infinity 产出角落格"的坏行为变成可选项，等于替裁决预设立场。
2. **两个薄包装各保一半语义**：`screenToGrid = guard + (origin/isoOffset 落地) + tileFromLayerLocal({mode:'floor',outOfMap:'null'}) + 界外 null`；`viewportCenterTile = 屏幕→世界 + 落地 + tileFromLayerLocal({mode:'round',outOfMap:'clip'})`。⇒ **调用方 0 改动**（E 的 4 处、D 的 0 处），diff 只剩提取本身。
3. **`isoToGrid` / `isoToGridF` 的去留要一并裁**（否则合并后仍有第二份 floor 实现）：
   - 出口 α：`isoToGridF` 保留为公开"连续版"（它不是 floor 的退化，是真有独立用途的连续逆投影），`isoToGrid` 改为 `tileFromLayerLocal(..., {mode:'floor', outOfMap:'null'})` 的**投影坐标薄包装**（`null` 时抛？不可——无界信息）⇒ 实际只能让 `isoToGrid` 继续存在但**内部复用核心**，界外语义交给调用方。此路需给核心一个第三态 `{outOfMap:'none'}`，与上面"不给第 4 个态"的立场冲突 ⇒ **α 不推荐**。
   - 出口 β（**推荐**）：`isoToGrid`/`isoToGridF` 按 `tests-only` 在册事实**退役**（删除或降级为 `@internal`＋只在 `iso.test.ts` 内以核心函数复写），把 `iso.test.ts:18-26` 的往返口径**改钉到核心 + 投影坐标薄函数**上。代价：`iso.test.ts` 要动（B6 说的那次回归就在这一步发生）。
   - 出口 γ（**最省**）：本单只合并 E/D，iso.ts 两份**原样留着**并在文件头加"三份实现已并入 `tileFromLayerLocal`，本模块两份为兼容面，勿新增调用方"的护栏注释。残余风险：漂移仍在（c922-12 的 `SEASON_NAMES` 双表同族病没治完）。

---

## 6. 分单建议与估工

| 笔 | 内容 | 触碰面 | 判据 | 估工 |
|---|---|---|---|---|
| **1（可立即排）** | 在 `iso.ts` 落 `tileFromLayerLocal`（判别联合）＋ E/D 改薄包装；新增 `render/__tests__/isoUnify.test.ts` 钉 **T6（格点集逐点相等）／T7（null vs 夹边）／T11（±Infinity 不产出可达格的新契约，或如实钉现状）** | `iso.ts`、`MapRenderer.ts:800-831`、**零调用方改动** | 全量绿且 `MapRenderer.test.ts` 12 处 `screenToGrid` 断言**一字不改**；`git diff --numstat` 里 GameScene.ts 必须 0 行 | 0.5 人日 |
| **2（可与 1 并，也可后做）** | `screenToGrid` → `worldToGrid` 改名连锁 | §3.4 的 19 处代码 | 机械改名＋历史档加指认行；不改断言逻辑 | 0.5 人日 |
| **3（**先裁决再排**）** | D 的处置：删死码 ／ 接回 `recenter()`（上游 T5 的原始动机"resize 时用"）／ 保留并注释 | `MapRenderer.ts` 行为面 | 接线＝行为改动 ⇒ 要新测试；删除＝需 `dead-export` 台账与 c922-114 双口径复查先跑 | 删 0.2h／接 0.5 人日 |
| 4（顺带） | `isoMapBounds` vs `MapRenderer:413-415` 手抄公式并入单一源（§3.3） | 同上族 | `pxW/pxH` 等值断言 | +0.5h |

**不要做**：把 1、2 混成一次提交；在本单里"顺手"把 `round` 与 `floor` 统一（§4.3 的 74.0% 就是给这条准备的证据）。

---

## 7. 回归与风险清单

**`iso.test.ts` 往返口径回归清单（实现单第 1 必跑，5 例逐条）**：

| 用例（现行） | 合并后是否受影响 | 需要的动作 |
|---|---|---|
| `gridToIso(0,0)→{0,0}` | 否 | 不动 |
| 菱形朝向（`gridToIso(1,0)/(0,1)/(1,1)`） | 否 | 不动 |
| **`gridToIso → isoToGridF` 往返一致（顶点）** | **是**（若走出口 β，`isoToGridF` 退役） | 改钉到 `tileFromLayerLocal` 的连续版或新薄函数；`toBeCloseTo(...,6)` 容差照搬 |
| **`isoToGrid` 对 tile 内部任意点都 floor 回该格**（`iso.test.ts:27-33`） | **是** | 同上；**这条就是卷宗说的"一旦被生产引用就要重跑"的实体** |
| `gridCenterToIso` 低半 tile 高 ／ `isoMapBounds` 包围盒 | 后者受第 4 笔影响 | 包围盒那条与 `MapRenderer:413-415` 加等值断言 |

**新增必须钉的两条跨文件一致**（上游 T5/T6 的落地化版本）：
- **T6'**：同一格点集上 `tileFromLayerLocal(gridToIso(gx,gy), {floor,null})` ≡ 旧的 `isoToGrid` 结果（等价迁移自证，防"提取时手滑改了分母顺序"）。
- **T7'**：同一无效输入（界外 100000px 与 NaN/±Infinity 各一组）下 **E 给 `null`、D 给边界格**，两条断言写在同一用例里对照，防"日后有人觉得不一致就顺手统一"。
- **T11**（本单新提）：`±Infinity` 经 `round+clip` 会产出 `{39,0}`／`{0,39}` 这类**可达角格**（§4.2 实测）。要么在包装层加 `Number.isFinite`（＝改变 D 现行为，需裁决），要么现状钉＋注释；**不许默默留着**。

**方法论坑（本班用一次实测换来的，建议进纪律档 colony 节）**：上游 §四-3 的"NaN 一路写进 `cam.scrollX`"是**复刻 node 算式**得出的，复刻时漏了链路里 `clampScroll` 的第二次 `(cam.scrollX)||0` 读取 ⇒ 结论与真方法相反（c923-14 以 `renderer.panBy(...)` 真跑 5 例否证，NaN **不**流出）。⇒ **本单及后续所有"等价迁移"验收必须走 MapRenderer/iso 的公开方法打靶，不得以"复刻算式复算"充当回归证据**；复刻件只能用于设计期取证（本档的探针就放在 gitignored `tmp/c923-15/`，不进验收链）。

---

## 8. 自证（完成标准逐条）与红线

```
① 含 E/D 两语义对照与签名草案            → §4.1 逐步对照 ＋ §4.2 脏值实测 ＋ §5 判别联合签名（含三条配套约束）
② 含 iso.ts 与调用方（GameScene.ts 等）rg 实测清单 → §3.1 四实现归属表 ＋ §3.2 viewportCenterTile 零调用方（git log -S 双查）
                                            ＋ §3.3 isoToGrid* 生产 0 引用 ＋ §3.4 改名连锁 19 处（含 GameScene:330/406/455/477 逐行）
③ git diff --stat = 0                     → 本单只新建本文件（未跟踪）＋ gitignored 探针 3 支（tmp/，.gitignore:25）。
                                            本仓脏基线恒为 3 项他班件，故按 c923-13 同口径判"净零"：
                                            收工 `git diff --numstat` 与开工逐字相同（5/5、6/6、0/830），porcelain 仅增加未跟踪产物。
```
- **未跑全量**（并发纪律）：本单零代码改动，只跑 `npx tsx` 只读探针 3 次；未跑 `npm run type-check`、未跑 `vitest`。
- **红线零读写**：未触碰 `CRISIS_*`／`SAVE_SLOTS`／产出消耗常数；本档数字全是**坐标/取整/几何**，无经济量。§十二 的 `sandboxSimulation` 资源出口失明面与本单无交集（不新增资源出口）。
- **在册禁碰零触碰**：`OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json`（只读作旁证）、其 `.bak`（` D` 在册，未"顺手恢复"）。
- **不 add、不 commit**，产出精确路径见「改动清单」（result 内）。
