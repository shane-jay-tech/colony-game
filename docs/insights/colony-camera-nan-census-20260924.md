# colony 相机兜底族 NaN/±Inf 语义普查（c924-14，2026-09-24）

> **性质：只读普查。** 本档零生产码改动、零测试码改动（`src/` 净 diff 见 §7）。
> 主班派单把本单列为只读 census，与卷宗正文一致；产物即本档 ＋ gitignored 探针。
>
> **一句话结论**：相机族的 **15 个数值兜底点**分属三类互不相同的守卫语义（§3 表 15 行，每行一站点），
> 其中 **11 处用 `x || k`——它只挡 falsy（NaN/0/-0），完全挡不住 ±Infinity**；
> 而 `±Infinity` 恰好是 Phaser 相机在极端缩放下最可能出现的形态。
> 全族**唯一**用对了 `Number.isFinite` 的是 `MapRenderer.ts:214`（锚点闸）与 `cameraMath.ts:33/:86`。
> 后果最重的一处是 `MapRenderer.ts:192`（`zoom=±Inf ⇒ mask 宽高变 0 ⇒ 全图不可见`），
> 而那正是它自己上面 `:181-183` 的 hotfix#4 注释**竭力要避免**的症状。

---

## 1. 前提复核（卷宗／上游档的三处否证）

| # | 卷宗或上游档的说法 | 现场实测 | 判定 |
|---|---|---|---|
| P1 | c923-14 result 遗留 2 点名同类面为「`centerOnTile`、`setMapZoom`、**`zoomAt`**、`clampScroll`、`refreshViewportMask`」 | `$ grep -rn "zoomAt" src scripts` → **零命中**（rc=1）；相机缩放的真实入口叫 `setMapZoom`（`MapRenderer.ts:205`），本仓**不存在 `zoomAt` 这个函数** | ❌ **幻影函数名**。且该句把 `setMapZoom` 与 `zoomAt` **并列**列出，等于把同一个函数数了两遍 ⇒ 在册"同类面 5 处"实际只有 4 处点名有效 |
| P2 | 同一句引「`cameraMath.ts:41` 的 `zoom \|\| 1`」 | `sed -n '41p' src/renderer/render/cameraMath.ts` → ` */`（注释行）；真锚点在 **`:47`** | ⚠ **锚点漂移 +6** |
| P3 | 同一句引「`MapRenderer.ts:286` 的是两处独立代码」 | `sed -n '286p'` → `const cam = this.scene.cameras.main;`；兜底在 **`:287`（z）/`:288`/`:289`** | ⚠ **锚点漂移 +1** |
| P4 | 卷宗「背景与锚点」引 c923-14：「`MapRenderer` panBy 邻域等 ≥6 处」 | `grep -nE "\|\| *(0\|1)" src/renderer/render/{cameraMath,MapRenderer}.ts` → cameraMath 3 处 ＋ MapRenderer 16 处 = **19 个 `||` 字面兜底点**，另有 `cameraMath.ts:17/:24` 两处 `<=0` 比较闸 ＋ `:33/:86` 两处 `isFinite` 闸 | ✅ 且**扩面**：卷宗说"等 ≥6 处"，本普查按语义去重后落到 **15 个判定点**（见 §3），全部有实测读数 |

> 🔴 **通用坑（建议进纪律档 colony 节）**：`zoomAt` 这一型"上游档点名一个不存在的函数名、并与它的真名并列"的错法，
> 会让下一班按 5 个名字去找而只找到 4 个，并可能为此**再造一个 `zoomAt` 别名**来"补齐"。
> 凡引上游档点名的函数清单，先 `grep -rw <名>` 自证存在。

## 2. 三类守卫语义（本普查的核心区分）

`||` 兜底不是"NaN 兜底"，是 **falsy 兜底**。三类的覆盖集互不相同，**没有任何一类全覆盖**：

| 类别 | 写法 | 挡住 NaN | 挡住 0/−0 | 挡住 ±Infinity | 本族站点数 |
|---|---|---|---|---|---|
| **F**（falsy 闸） | `const z = x \|\| 1` / `x \|\| 0` | ✅（NaN 是 falsy） | ✅（**连合法值一起吞**） | ❌ **Inf 是 truthy，原样穿透** | **11** |
| **I**（有限性闸） | `if (!Number.isFinite(v)) return …` | ✅ | ❌（0 是有限值，按合法处理） | ✅ | 2（`cameraMath:33`、`:86`）＋ 1（`MapRenderer:214`） |
| **L**（符号比较闸） | `if (vpW <= 0 …) return 0.2` | ❌ **`NaN <= 0` 为 false ⇒ 整闸失效** | ✅ | ❌ | 2（`cameraMath:17`、`:24`） |

三条实测出来的"违反直觉"读数（都能复算，命令见 §6）：

1. **`clampZoom(NaN)`、`clampZoom(+Inf)`、`clampZoom(-Inf)` 全返回 `1`** —— 这一处是对的（类别 I）。
2. **`fitZoomFor(NaN, 800, 4096, 4096)` 返回 `NaN`，不是它自己注释承诺的 `0.2`** ——
   `cameraMath.ts:14` 的注释写着「退化视口/地图 → 0.2 兜底」，而 `:17` 的闸是 `<= 0`，
   `NaN <= 0 === false` ⇒ **NaN 从注释承诺的兜底里漏出去了**。同类 `coverZoomFor` 亦然。
   ⇒ **这是"文档说有条地板、实际只对 0 和负数成立"的口径缺口**，不是数值 bug，是**契约与实现不一致**。
3. **`getMapZoom()` 在 `cam.zoom = +Infinity` 时返回 `+Infinity`**（不夹、不转 1）⇒
   getter 把脏值**原样再传播**给调用方，而 `ZoomControl.ts:60` 正是
   `r.setMapZoom(r.getMapZoom() * MAP_ZOOM_STEP_FACTOR)` —— 链条闭合后
   实测 `setMapZoom(+Inf)` **返回并写入 `1`**：用户点一下"放大"，缩放倍率**被静默重置成 1**
   （既不保持原位、也不 clamp 到上限）。**这是本普查唯一在真实调用链上落地的缺陷。**

## 3. 普查表（15 行，全部 `文件:行号 ＋ 实测落点`）

读数格式：`NaN / 0 / −0 / +Inf / −Inf` 各档下**实际返回或写入的值**。探针原文读数在
`tmp/c924-14/census.txt`（81 行，gitignored）。

| # | 文件:行号 | 成员（可见性） | 守卫类别 | 实测语义（NaN 路 ／ ±Inf 路） | 是否在册已钉 |
|---|---|---|---|---|---|
| 1 | `cameraMath.ts:47` | `clampScrollFor`（export） | **F** `zoom \|\| 1` | NaN/0/−0 → 全部等价于 `z=1`（`x=500,y=400`）；**±Inf 不守**：大地图夹取分支下与 `z=1` 同落点（`500/400`），但**小地图居中分支（`:55`）下落点变成 `500/400` 而非 `−633/−350`** ⇒ 该兜底**可观测**，需配对夹具才看得见（见 §5 夹具坑） | ❌ |
| 2 | `cameraMath.ts:77` | `scrollForZoomAtAnchor`（export） | **F** `oldZoom \|\| 1` | NaN/0/−0 → `100/80`（同 `old=1`）；**`old=+Inf` → `-500/-320`**（与基线差 600px） | ❌ |
| 3 | `cameraMath.ts:78` | 同上 | **F** `newZoom \|\| 1` | NaN → `100/80`；**`new=+Inf` → `700/480`**（差 600px） | ❌ |
| 4 | `cameraMath.ts:17` | `fitZoomFor`（export） | **L** `vpW<=0 \|\| vpH<=0 \|\| mapPxW<=0 \|\| mapPxH<=0` | `0/-1` → `0.2`（兑现注释）；**`NaN` → `NaN`（穿透，与 `:14` 注释矛盾）**；`+Inf` → `0.195`（夹到底板 0.08 之上，合法值域内） | ❌ |
| 5 | `cameraMath.ts:24` | `coverZoomFor`（export） | **L** 同形 | 同上：`NaN` → **`NaN`**；`+Inf` → `2`（顶到 `MAP_ZOOM_MAX`） | ❌ |
| 6 | `cameraMath.ts:33` | `closeZoomFor`（export） | **I** `!Number.isFinite(close)` | `bw=NaN/0/-1` → `1`（回退，正确）；`bw=+Inf` → `0.5`（`close` 变 0，**0 是有限值故不触发回退**，被 `max(cover,0)` 抬到 cover） | ❌ |
| 7 | `cameraMath.ts:86` | `clampZoom`（export） | **I** `!Number.isFinite(target) → 1` | `NaN/+Inf/-Inf` → **全部 `1`**（本族唯一三类脏值一锅端的站点）；`0/-0/0.05` → `0.5`（按下限夹，**不当非法**） | ❌ |
| 8 | `MapRenderer.ts:192-194` | `refreshViewportMask`（**private**） | **F** `zoom\|\|1`，`scrollX\|\|0`，`scrollY\|\|0` | NaN/0 → `fillRect(572,296,798,696)`（与 `z=1` 逐位同）；**`zoom=+Inf` → `fillRect(300,200,0,0)`** ⇒ **mask 宽/高 = 0**。`vp.w/Inf = 0`。这正是 `:181-183` hotfix#4 注释写"0×0 会让整个地图层不可见，肉眼看就是卡死"而专门加了 `vp.w<=0` 早退所要避免的形态——**但那条早退只看 vp，不看 zoom，所以从 zoom 这一侧又回来了** | ❌ |
| 9 | `MapRenderer.ts:208`＋`:216` | `setMapZoom`（public） | **F**（两处）＋ `:214` 是 **I** | `target=NaN` → 经 `clampZoom` 得 `1`；`target=+Inf` → `1`（**见 §2-3 的静默重置链**）；`anchorX=NaN` → 走 `:214` 的 `isFinite` 回退到视口中心（`sx` 由 `400` 变 `411.833`，说明锚点确被替换） | ❌ |
| 10 | `MapRenderer.ts:277` | `getMapZoom`（public） | **F** `zoom \|\| 1` | NaN/0/−0 → `1`；**`+Inf` → `+Inf`、`-Inf` → `-Inf`（原样吐回调用方）** | ❌ |
| 11 | `MapRenderer.ts:287-289` | `panBy`（public） | **F** | NaN 位移 → **已有 scroll 被归零后再 clamp**（`100/80 → 0/0`）；**`zoom=+Inf` ⇒ `dx/Inf = 0` ⇒ 平移静默失效**（`dx=10` 后 scroll 仍 `100/80`，表现是"拖不动"，无 NaN 无告警） | ✅ **c923-14 已钉 NaN 路（5 例）**；⚠ **`±Inf` 那一路它未测**（其 result 只说"±Inf 走 clamp 顶到边界"，未测 pan 失效形态） |
| 12 | `MapRenderer.ts:307-308` | `centerOnTile`（public） | **F**（`:308`）＋ **无闸**（`:307 isoCenter`） | `zoom=NaN/0/−0` → `-48/24`（同 `z=1`，被兜底救回）；**`zoom=+Inf` → `623/468`**（相机瞬移到别处，差 671px）；`gx=NaN` → 最终 `0/0`（NaN 先写进 scroll，再被下游 `clampScroll` 的 `\|\|0` 洗成 0） | ❌ |
| 13 | `MapRenderer.ts:323-326` | `clampScroll`（**private**） | **F**（一处 `\|\|1` ＋ 两处 `\|\|0`） | `scroll=NaN` → **`0/0`**（NaN 被 `|| 0` 静默改写，非保持原位）；`zoom=NaN/0/+Inf` 三档本夹具落点均 `300/200`（夹取区间宽，z 项不显）；⚠ **它从不回写 `cam.zoom`** ⇒ 脏 zoom 一旦进入相机，本函数**不会**修复，只可能反复被下游读取 | ⚠ 仅 `clampScroll` 名在 `MapRenderer.test.ts` 出现 1 次且**不含 NaN 入参** |
| 14 | `MapRenderer.ts:819-823` | `viewportCenterTile`（private） | **F**（一处 `\|\|1` ＋ 两处 `\|\|0`） | NaN/0 → `48/41`（与 `z=1` 同＝被兜底救回），**`+Inf` → `32/38`（算出一个错格子坐标，无 NaN 无告警＝"读到错答案"型，最难发现）** | ❌ |
| 15 | `MapRenderer.ts:844-846` | `gridToScreenPixel`（**public，被 `GameScene.ts:345` 用于建筑弹窗定位**） | **F**（一处 `\|\|1` ＋ 两处 `\|\|0`） | NaN/0 → `323/268`（正常），**`+Inf` → `+Inf/+Inf`** ⇒ 交给 `buildingPopover.show(inst, x, y)` 的是无穷坐标 | ❌ |

**小结（完成标准 ①：15 行 ≥ 6，每行含文件:行号＋可复算实测语义）**：
15 站点 = **类别 F 11 处 ＋ 类别 L 2 处（`cameraMath:17/:24` 的 `<=0` 闸）＋ 类别 I 2 处（`clampZoom`/`closeZoomFor`）**；
NaN 路在 F 类 **11 处全部**被兜住（因 NaN falsy），却在 **L 类 2 处漏出去**（实测返回 NaN）；
**±Infinity 路：F 类 11 处全不守**，L 类把 ±Inf 当合法输入算成有限值，只有 I 类（2 处）真挡。
其中**后果可见**的三档：`#8` 全图黑（mask 0×0）、`#12`/`#14` 相机或弹窗落到错位置、`#10→#9` 缩放倍率静默重置。

---

## 4. 「一单一函数」钉桩优先序（完成标准 ②：含理由）

排序依据三条，**不按行号、不按"哪个先坏"，按〔真实调用链 × 后果可见度 × 钉桩成本〕**：

| 优先 | 目标 | 理由（含实测锚点） | 建议钉什么 | 成本 |
|---|---|---|---|---|
| **P0** | `MapRenderer.ts:192-194`（`refreshViewportMask`） | **后果最重且类别错配**：`:181-183` 已为"0×0 mask＝肉眼卡死"写过一条早退守卫，但那道守卫**只看 `vp.w/h`、不看 zoom** ⇒ `zoom=±Inf` 从另一侧把同一个 0×0 形态造回来了（实测 `fillRect(...,0,0)`）。"自己修过的症状以另一条路径复活"是本普查里唯一**用户可见黑屏**级 | 现状记录桩（照 c923-14 形态，**只钉不改**）：`+Inf ⇒ fillRect 的 w/h 为 0`＋`NaN ⇒ 与 z=1 逐位同`。**断言取 `viewportMaskGfx.fillRect` 的实参**，不取 cam | 低（探针已给出可照抄的夹具，含拦截 `fillRect` 实参的写法） |
| **P1** | `MapRenderer.ts:277` ＋ `:205-222`（`getMapZoom` → `setMapZoom` **一条链**） | **唯一在真实调用链上落地的缺陷**：`ZoomControl.ts:60/66` 把 `getMapZoom()` 乘方后再喂 `setMapZoom`，实测该链把 `+Inf` 变成**静默 `zoom=1`**（既不保持也不夹顶）。且它同时覆盖两处站点 ⇒ 一单两钉，性价比最高。⚠ 拆成两单会让第二单看不到"重置成 1"这个净效果（它只在链上出现） | 链桩：`cam.zoom=+Inf` ⇒ `getMapZoom()===+Inf` **且** `setMapZoom(getMapZoom()*1.25)===1`。外加 `clampZoom` 的 I 类语义当对照臂（说明 1 是从 `:86` 来的，不是 `||` 来的） | 低 |
| **P2** | `cameraMath.ts:17`／`:24`（`fitZoomFor`／`coverZoomFor`） | **契约与实现不一致**（不是数值错）：`:14` 注释承诺"退化 → 0.2 兜底"，实测 NaN 穿透返回 NaN。纯函数、零 Phaser、`npx tsx` 就能跑（**本普查唯一不必借 vitest 的族**）⇒ 是 15 处里**最便宜**的两钉。且 NaN 一旦从这里出去，会经 `initialZoom/getDefaultZoom` 把相机整体弄脏，**它是上游污染源** | 两钉：`fit(NaN,…)`/`cover(NaN,…)` 现值 **`NaN`**（＝记录注释撒谎），并把 `:14` 注释**改口**另立裁决（改注释＝认账，不属本普查授权） | 极低 |
| **P3** | `MapRenderer.ts:307-308`（`centerOnTile`） | 纯 `|| 1` 不守 ±Inf（实测 `+Inf → 623/468`，偏移 671px＝肉眼可见跳屏），且它是 `resetView()`（`:299`）与开局初始化的必经路 ⇒ **开局即经过**。但**无真实脏源**（zoom 由 `setZoom` 写入，正常态不会 Inf）⇒ 排在已有链缺陷之后 | 三臂：NaN/0（被救回＝与 z=1 同）＋ `+Inf`（不被救回）＋ `gx=NaN`（最终 `0/0`，顺带钉住"NaN 被下游 `\|\|0` 洗掉"这一路） | 低 |
| **P4** | `MapRenderer.ts:844-846`（`gridToScreenPixel`） | 有 public 消费方（`GameScene.ts:345` 弹窗锚点），`+Inf ⇒ +Inf/+Inf`。**但**它只在"相机已被弄脏"之后才脏 ⇒ 属**二阶放大**而非独立缺陷；且钉它需要多搭一层 GameScene 夹具 | 单钉：`zoom=+Inf ⇒ {x:+Inf,y:+Inf}`；`NaN/0 ⇒ 与 z=1 同` | 中 |
| **P5** | `cameraMath.ts:47/:77/:78`（`clampScrollFor`／`scrollForZoomAtAnchor`） | 语义清楚、纯函数、可钉，**但**它们是被 `MapRenderer` 调的下层，上层 P0/P1/P3 的桩已把净效果覆盖；单独钉它们**只能钉"等价改写不敏感"的文本级信息**。⚠ 若要钉 `:47`，**必须配非零视口原点＋小地图**（见 §5），否则六档输入全等、假绿 | 若做：`scrollForZoomAtAnchor(old=+Inf)` 与 `(new=+Inf)` 两臂（实测各偏 600px，判别力现成） | 低（但夹具要求高） |
| **P6** | `cameraMath.ts:33`／`:86`（`closeZoomFor`／`clampZoom`） | **已经是正确类别（I）**，属"本族的正解样板"，**不建议再钉**——钉它等于用测试认可 `clampZoom(0)=0.5` 这种"0 被当合法值"的口径（那是**改计数口径**式判断，纪律档 §五.4 该停手）。要留只留一句"作为其余 13 处应改成的形态" | 不钉（登记为模板） | — |
| **P7** | `MapRenderer.ts:323-326`（`clampScroll`） | 与 P0 同为 private、同为 `||` 族，但它**只在内部被调**且**从不回写 zoom** ⇒ 它自身产不出用户可见症状，症状都归因到 P0/P3。**⚠ 唯一值得留的一条**："`clampScroll` 不修 zoom，故脏 zoom 会在相机上常驻"——这条宜作为**注记**并入 P0 或 P1 的桩，不单独占一单 | 作注记 | — |
| **已在册** | `MapRenderer.ts:287-289`（`panBy`） | c923-14 已 5 例钉死 NaN 路，**不要重复建**。但本班实测出它**未覆盖的一路**：`zoom=+Inf ⇒ dx/Inf=0 ⇒ 平移静默失效（scroll 原值不动）`。其 result 现只写"±Inf 走 clamp 顶到边界"，**与实测的"位移直接归零、根本不到 clamp"不同** | 出口：**在 c923-14 那件里净加 1 例**（不新开会话件），并顺手订正它 docstring 那句 ±Inf 描述 | 极低 |

**总建议**：按 `P0 → P1 → P2 → P3` 四单排（约 0.5 人日），`P4/P5` 视是否要"全类一次收口"再定，
`P6` 不钉，`P7` 作注记。
🔴 **全部按 c923-14 的「现状记录桩＝记录缺陷不是认可缺陷」形态做，加守卫＝改变现行为，裁决另单**——
本普查**不授权**任何数值或守卫改动。

---

## 5. 夹具坑（写给下一班，避免假绿）

1. 🔴 **`clampScrollFor` 用 `vp.x = 0` 会得到"六档输入全等"的零判别力读数**：
   该项在 `vp.x / z` 的分子上，`0 / 任何值 = 0` ⇒ `z` 取 NaN、1、+Inf 结果一模一样。
   本班实测：`vp.x=0` 时 6 档全 `500/400`；改 `vp.x=200` **仍**全 `500/400`（夹取区间太宽），
   **必须再把地图缩小到 `500×400` 走 `:55` 的居中分支**，才出现 `±Inf → 500/400` vs 其余 `−633/−350` 的分野。
   ⇒ **钉 `:47` 的夹具硬要求：非零视口原点 ＋ 小地图（触发 `minX > maxX` 居中分支）**。
2. `MapRenderer` 的 private 成员（`refreshViewportMask`/`clampScroll`/`viewportCenterTile`）**无法直调**，
   本班用 `panBy(dx=0,dy=0)` 作**触发入口**、用「拦截 `viewportMaskGfx.fillRect` 实参」作**观测口**——
   这比"调 private 再断言内部字段"更接近真实渲染路径，且零改生产码。
3. **本仓只有 vitest 面能 import `phaser`**：`npx tsx` 直跑会在
   `node_modules/phaser/src/device/index.js:32` 抛（node 无 DOM）。
   ⇒ `cameraMath` 族可在 tmp 用 tsx 跑；**`MapRenderer` 族的探针必须借 vitest 的收集面**
   （`tmp/` 不在 `vitest.config.ts` 的 `include` 里，本班做法见 §6）。
4. 探针里 `new MapRenderer(...)` 的构造期会**自行居中并按 fit 设 zoom** ⇒
   建完必须**再写一次** `cam.zoom/scrollX/scrollY` 才拿到本用例要的初始态（照 `MapRenderer.panby-nan.test.ts:91-99 makeAt` 同一手）。

## 6. 复算配方（探针可复算，完成标准 ①④）

```
$ cd /d/code/colony-game
$ # 探针 durable 副本（gitignored）：tmp/c924-14/probe.test.ts.src —— 它自身不入库，
$ # 但要跑就得借 vitest 收集面（见 §5-3），跑完立刻删掉副本，仓库零残留。
$ cp tmp/c924-14/probe.test.ts.src src/renderer/render/__tests__/zprobe-c92414.test.ts
$ npx vitest run src/renderer/render/__tests__/zprobe-c92414.test.ts > tmp/c924-14/raw.txt 2>&1; echo rc=$?
rc=0
$ rm -f src/renderer/render/__tests__/zprobe-c92414.test.ts
$ # 81 条结构化读数（去掉 ANSI 后按 'CENSUS;;' 前缀过滤）：
$ python -c "import re,io;s=re.sub(r'\x1b\[[0-9;]*m','',io.open('tmp/c924-14/raw.txt','rb').read().decode('utf-8','replace'));print(sum('CENSUS;;' in l for l in s.splitlines()))"
81
$ # 关键单点复算（纯函数，tsx 即可）：
$ npx tsx -e "import {fitZoomFor,clampZoom} from './src/renderer/render/cameraMath'; console.log(fitZoomFor(NaN,800,4096,4096), clampZoom(Number.POSITIVE_INFINITY,0.5,2))"
NaN 1
```

## 7. 验收自证（本单口径）

* **完成标准 ①（≥6 行，各含 文件:行号 ＋ 探针实测语义）**：§3 表 **15 行**，逐行带 `文件:行号`、守卫类别、NaN/±Inf 两路实测落点、在册覆盖标记；读数源 `tmp/c924-14/census.txt`（81 行）。
* **完成标准 ②（优先序 ＋ 理由）**：§4，P0–P7 ＋「已在册」共 9 档，每档给〔真实调用链 × 后果 × 成本〕三因子理由，并标出 3 处「不建议做」（P6 不钉、P7 作注记、panBy 不重开单）。
* **完成标准 ③（`src` git diff=0）**：本单**对 `src/` 净改动 0**。
  如实声明：claim 本单时 `src/` 已有 **c924-13 留下的 2 件**在册改动
  （`src/renderer/ui/__tests__/fakeScene.ts`、新建 `src/renderer/scenes/__tests__/BootScene.runtime-error.test.ts`），
  那是**前一单的产物、不是本单**的；本单收工 `git status --porcelain` 与 claim 时**逐行相同**（证据见 result）。
  期间为跑探针**临时创建又删除**的 `src/renderer/render/__tests__/zprobe-c92414.test.ts` 已确认不在 porcelain 中。
* **完成标准 ④（tmp 探针不入库）**：`tmp/c924-14/{probe.test.ts.src,census.txt,raw.txt}`；
  `git check-ignore -v tmp/x` → `.gitignore:25:tmp/`。
* **未跑全量套件**（并发纪律 §四.2；本单是只读 census，卷宗未点名全量读数）。

## 8. 本单否证／新踩清单（供主班入台账）

1. ❌ `zoomAt` 不存在（幻影函数名，源自 c923-14 result 遗留 2）；同句把 `setMapZoom` 数了两遍。
2. ⚠ 锚点漂移：`cameraMath.ts:41`→实为 `:47`（+6）；`MapRenderer.ts:286`→实为 `:287/:288`（+1）。
3. ❌ `cameraMath.ts:14` 注释「退化视口/地图 → 0.2 兜底」对 **NaN 不成立**（实测返回 NaN）。**改注释属认账式行为改动，本单未动**。
4. ⚠ c923-14 对 `panBy` 的 `±Inf` 描述（"被 clamp 顶到边界"）与实测（`zoom=+Inf ⇒ dx/Inf=0 ⇒ 位移直接归零、到不了 clamp 的边界逻辑，scroll 保持原值`）不符。
5. 🔴 新机制：**相机族的 `|| 1` 兜底集体不防 ±Infinity（11/15 站点，F 类全中）**，而 `±Inf` 在"无限放大/fit 计算溢出"路径上是可达形态；唯一正确样板是 `MapRenderer.ts:214` 与 `cameraMath.ts:33/:86` 的 `Number.isFinite`。
6. ⚠ `clampScroll` **从不回写 `cam.zoom`** ⇒ 脏 zoom 一旦进入相机即常驻，只被反复读取、不被修复。
7. ℹ 本机 `npx tsx` 不能 import `phaser`（`phaser/src/device/index.js:32` 需 DOM）⇒ colony 的探针分两档：`cameraMath` 可 tsx，`MapRenderer` 必须借 vitest 收集面。
