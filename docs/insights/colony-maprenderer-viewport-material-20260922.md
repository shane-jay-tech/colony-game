# colony MapRenderer viewport 反向映射提取材料（c922-15，只读，2026-09-22T00:3x 取数）

> 用途：P1-6「视口/相机计算抽出纯函数」的**残余可提取面**清单，给夜间可切单直接用。
> 边界：**未改 `MapRenderer.ts`（它在途）、未改 `cameraMath.ts`、未跑 build**；本档只读磁盘源码＋一次 node 数值自证。
> 取数 cwd `D:\code\colony-game`，HEAD `9675475`（前一提交 `5205cd3`），`src/renderer/render/MapRenderer.ts` 为**他人并发会话在途 M**（归属见 `docs/insights/colony-inflight-ownership-20260919.md:11`，约定「勿动」）。

## 一、锚点复核（任务书锚点有漂移，按磁盘实况修正）

| 任务书锚点 | 磁盘实况 | 判定 |
|---|---|---|
| `MapRenderer.ts:184-207`（screen→world 反除 zoom＋scroll 补偿段） | 184-207 **跨了两个方法**：184 是 `refreshViewportMask` 注释末行、185-198 是 `refreshViewportMask` 全体、200-207 是 `setMapZoom` 的注释＋签名。真正的「反除 zoom＋scroll 补偿」算式**只有 197 一行**：`mg.fillRect(vp.x / z + sx, vp.y / z + sy, vp.w / z, vp.h / z)` | 漂移（区间偏大），不据此判 failed |
| 同区间含「锚点缩放段」 | `setMapZoom` 的锚点缩放**已抽走**：`MapRenderer.ts:216` 直接委托 `cameraMath.scrollForZoomAtAnchor`。该段残余只有锚点回退式 214-215 与 no-op 阈值 211 | 任务书把已提取项列进了待提取范围 |
| `git status` 显示该文件有未提交在途修改 | 成立：`M src/renderer/render/MapRenderer.ts`，`git diff --stat` ＝ **+4 −3**，内容与相机数学**无关**（见第六节） | 成立 |
| 行号换算 | 在途件在第 2 行新增了 1 条 import ⇒ **工作树行号 = HEAD 行号 + 1**（自第 2 行起）。本档一律引**工作树行号** | 换算规则随件留存 |

## 二、cameraMath.ts 已抽 6 函数（现状账）

`src/renderer/render/cameraMath.ts` 90 行（非空 79 行 / 代码 60 行；**在途 BACKLOG 里写的「79 行」是非空口径，不是行数错报**）。

| # | 函数（行号） | 签名 | MapRenderer 委托点 | 现有纯测试 |
|---|---|---|---|---|
| 1 | `fitZoomFor`（16-20） | `(vpW, vpH, mapPxW, mapPxH) → number` | 258（`fitMinZoom`） | `cameraMath.test.ts:12,22` |
| 2 | `coverZoomFor`（23-27） | 同上 | 265（`coverZoom`） | `:17,22` |
| 3 | `closeZoomFor`（30-35） | `(vpW, vpH, boxW, boxH, targetCount, cover) → number` | 246（`getMaxZoom`） | `:27` |
| 4 | `clampScrollFor`（42-69） | `(curX, curY, vp: Rect, zoom, mapLeft, mapTop, mapPxW, mapPxH) → {x,y}` | 324-329（`clampScroll`） | `:39,44,50` |
| 5 | `scrollForZoomAtAnchor`（72-82） | `(ax, ay, oldZoom, newZoom, oldScrollX, oldScrollY) → {x,y}` | 216（`setMapZoom`） | `:58` |
| 6 | `clampZoom`（85-88） | `(target, minZoom, maxZoom) → number` | 210 | `:65` |
| ＋ | 常量 `MAP_ZOOM_MIN=0.5`／`MAP_ZOOM_MAX=2.0`（7-8）、`Rect`（10） | — | `MapRenderer.ts:11,12,23` 导入并**转发导出**（`:23`）防环依赖 | — |

⇒ 「视口尺寸/锚点/夹紧」这一层**已经干净**。剩下的都是**屏幕↔世界↔格子**三段映射，全在 `MapRenderer.ts` 里内联。

## 三、仍内联的可提纯段（行区间 × 依赖键 × 建议测试）

行区间＝工作树 `MapRenderer.ts` 实况；「依赖键」＝该段真正读到的外部量（提纯时即参数表）；「建议测试」＝可写进 `cameraMath.test.ts` 或新 `viewportMath.test.ts` 的**纯**用例（不需 Phaser、不需 mock scene）。

| # | 行区间 | 现在的算式（磁盘原文） | 依赖键 | 建议签名（追加到 cameraMath.ts） | 建议测试（≥1 条/行，全表共 8 条见第四节） |
|---|---|---|---|---|---|
| A | **192-197**（`refreshViewportMask` 反向映射本体） | `z=(cam.zoom)||1; sx=(cam.scrollX)||0; sy=(cam.scrollY)||0; mg.fillRect(vp.x/z+sx, vp.y/z+sy, vp.w/z, vp.h/z)` | `cam.zoom` `cam.scrollX` `cam.scrollY` `computeViewportRect()` `viewportMaskGfx`（可空则早返）`MASK_FILL_WHITE`（**在途新增引用**）`destroyed` | `worldRectForMask(vp: Rect, zoom: number, sx: number, sy: number): Rect` | **T1 mask 屏幕不变性**（z=1∧s=0 时恒等 vp；z=2 时宽高减半且 4 角 `screenFromWorld(角)==vp 角`）、**T2 vp.w/h≤0 不产 Infinity** |
| B | **287-289**（`panBy` 平移） | `cam.scrollX = (cam.scrollX||0) - dxScreen/z`（y 同） | `cam.zoom` `cam.scrollX/Y` 入参 `dxScreen/dyScreen` → 尾随 `clampScroll()`＋`refreshViewportMask()` | `scrollForPan(curX, curY, dxScreen, dyScreen, zoom): {x,y}` | **T3 方向符号**（dx>0 ⇒ scroll 减小）＋ **T4 NaN 传播**（见第四节：实测 `NaN` 会**穿过 clamp 写进 cam.scrollX**） |
| C | **308-311**（`centerOnTile` 居中） | `cam.scrollX = (this.originX + c.x) - (vp.x + vp.w/2)/z` | `isoCenter()`→`gridCenterToIso`＋`isoOffsetX` `originX/Y` `cam.zoom` `computeViewportRect()` | `scrollToWorldCentered(worldX, worldY, vp: Rect, zoom): {x,y}` | **T5 与 viewportCenterTile 互逆**：`scrollToWorldCentered` 设出的 scroll 再喂 `worldFromScreen` 取回同一世界点（现两处式子手抄、无人钉） |
| D | **819-831**（`viewportCenterTile` 全链：屏幕→世界→图层局部→等距逆投影→取整夹边） | `worldX=(cam.scrollX||0)+(vp.x+vp.w/2)/z; lx=worldX-originX-isoOffsetX; a=lx/ISO_HW; bb=ly/ISO_HH; x=clamp(round((a+bb)/2),0,width-1)` | 同 C ＋ `this.width/height` `MapRenderer.ISO_HW/HH`（=ISO_TILE_W/2、/H/2，`:137-138`） | `worldFromScreen(p, zoom, sx, sy)` ＋ `tileFromLayerLocal(lx, ly, halfW, halfH, {mode:'round'\|'floor', clip:boolean})` | **T6 与 `iso.ts:isoToGrid` 逐点相等**（第四节缺陷 1 的收口钉） |
| E | **800-811**（`screenToGrid`，名为 screen 实为 world，见缺陷 2） | `lx=screenX-originX-isoOffsetX; …; x=floor((a+bb)/2); 越界 return null` | 调用方口径（`GameScene.ts:329` 传的是 **`pointer.worldX/worldY`**）`originX/Y` `isoOffsetX` `ISO_HW/HH` `this.width/height` | 复用 D 的 `tileFromLayerLocal(..., {mode:'floor', clip:false})` | **T7 越界返回 null vs 夹边返回格**：同一无效输入下 E 给 null、D 给边界格，两种语义**不许在提取时统一**（现有断言 `MapRenderer.test.ts:191-193` 依赖 null） |
| F | **841-848**（`gridToScreenPixel`，世界→屏幕正向） | `return { x:(w.x-sx)*z, y:(w.y-sy)*z }` | `gridToScreen()` `cam.zoom` `cam.scrollX/Y` | `screenFromWorld(p, zoom, sx, sy): {x,y}` | **T8 逆对**：`screenFromWorld(worldFromScreen(p))==p`（随机 1000 点、z∈[0.08,2.0]、误差 <1e-9；本次已用 node 手验一例误差 0） |
| G | **120-135**（`computeViewportRect`，A-F 全部依赖它） | 折叠态取 `PANEL_COLLAPSED_WIDTH` 否则 `UI.buildPanelWidth/rightPanelWidth`，inset 各 ±8，`w/h` 用 `Math.max(0, …)` | `panelSource?.isLeftCollapsed/isRightCollapsed`（注入式 adapter，可 null）、`UI.*`、`PANEL_COLLAPSED_WIDTH`、`cam.width/height` | 把**算 inset** 抽出为 `viewportRectFor(camW, camH, insets: {left,right,top,bottom}): Rect`（`panelSource` 留在类内，只把它降成 plain number） | **T9 折叠四态矩阵**（左/右 × 展开/折叠 4 组 × `camW < insets` 的 0 宽钳制），现 `MapRenderer.test.ts` 无该矩阵 |
| H | **8 处 zoom 读数行＋11 处 scroll 读数行**（zoom：192,208,277,287,308,323,819,844；scroll：193,194,216,288,289,325,326,822,823,845,846 ⇒ 全文件共出现 **20 次** `as number \| undefined`，216 行一行两处） | `(cam.zoom as number \| undefined) \|\| 1` 与 `(cam.scrollX \| scrollY …) \|\| 0` 这套「`as` ＋ `\|\|` 兜底」写法手写 20 次 | `Phaser.Camera` 上 `zoom/scrollX/scrollY` 本是必选 number ⇒ 兜底是给「测试替身／半成品 cam」用的 | `readZoom(cam: {zoom?: number}): number` ＋ `readScroll(cam): {x,y}`（放 cameraMath，不引入 Phaser） | **T10 口径单一化**：`readFinite(v, fb)` 对 `NaN` 的选择钉现状桩——现在 `\|\|` 把 NaN 变兜底值，而 `clampZoom`(cameraMath:86) 用 `Number.isFinite`，两套并存 |

> A-F 是任务书点名的「反向映射／锚点缩放残余」；G/H 是顺带查出来的**共享前置**（G 被 7 个方法调、H 是 11 处重复读法）。**优先级：A＋F 一起做**（互为逆、可当场钉 T8 逆对），再 C＋D＋E（三者共用地面真值），G/H 单独一小片，B 最后（含 NaN 语义裁决，见遗留）。

## 四、提取时会暴露的三处现网缺陷（不是本单要修，但必须写进排单前提）

1. **等距逆投影有三份实现，且生产代码绕过了 `iso.ts` 的权威版。**
   `iso.ts:44-56` 提供 `isoToGridF` / `isoToGrid`（纯、且 `iso.test.ts:18,27` 已测往返），**但生产侧零引用**：

   ```
   $ grep -rn "isoToGridF" src scripts --include='*.ts'
   src/renderer/render/iso.ts:44（定义）  :54（isoToGrid 内部）  src/renderer/render/__tests__/iso.test.ts:3,21（测试）
   $ grep -n "import .* from './iso'" src/renderer/render/MapRenderer.ts
   10:import { ISO_TILE_W, ISO_TILE_H, gridToIso, gridCenterToIso } from './iso';   ← 无 isoToGrid*
   ```

   另两份在 `MapRenderer.ts:805-808`（floor）与 `:826-829`（round＋夹边）。**这与 c922-12 点名的 `SEASON_NAMES` 双表同族**：任一处改菱形比例或取整口径，另外两处静默错位。提取 D/E 时应把三份并成一份（`tileFromLayerLocal` 收 `mode`＋`clip` 两个参数即兼容现语义），并补 T6 钉住「与 `isoToGrid` 逐点相等」。

2. **`screenToGrid` 的名字与入参口径不符，实为 world→grid。** `MapRenderer.ts:800` 的方法只做 `− originX − isoOffsetX` 再逆投影，**没有除 zoom、没减 scroll**；而唯一的运行时调用点传的正是世界坐标：

   ```
   src/renderer/scenes/GameScene.ts:329  const grid = renderer.screenToGrid(pointer.worldX, pointer.worldY);
   ```

   测试也按世界坐标喂（`MapRenderer.test.ts:182-185` `gridToScreen → screenToGrid` 往返）。⇒ **提取时绝不能「顺手补上 /z」**，否则点击落位全体偏移。建议改名 `worldToGrid`，或在文档＋签名里明写口径；真正的「屏幕→格子」需要 A/D/F 那条链（`viewportCenterTile` 才是它的实现）。

3. **`panBy` 无 NaN 守卫，且 NaN 会穿过 `clampScroll` 落到相机上**（`setMapZoom` 反而在 213-215 显式守卫了锚点，两者不对称）。实测（node 复刻 287-289 ＋ `clampScrollFor` 的算式）：

   ```
   dx=10       -> scrollAfterPan=90    isFinite=true   -> afterClampScroll=90
   dx=NaN      -> scrollAfterPan=NaN   isFinite=false  -> afterClampScroll=NaN      ← 一路写进 cam.scrollX
   dx=Infinity -> scrollAfterPan=-Infinity isFinite=false -> afterClampScroll=-508  ← Infinity 反被 clamp 兜住
   ```

   `Math.max(min, Math.min(max, NaN))` 返回 NaN，所以 B 提取时必须**先裁决**：`scrollForPan` 是拒绝非有限增量（改变现行为、需新测试）还是照抄现状并钉一条「NaN 入 → NaN 出」的现状桩（对齐 c922-12 对 `NaN` 的处理法：记录缺陷而非认可）。本单未定，留给执行班＋评审。

## 五、纯测试清单（可直接抄成排单验收，共 10 条，全部零 Phaser）

| 用例 | 咬什么 | 现成锚点/回归护栏 |
|---|---|---|
| T1 mask 屏幕不变性 | A 的语义而非公式字面 | 若只钉公式，日后把 `/z+sx` 写成 `+sx-/z` 也能绿；本条要求「render 后落回 vp」 |
| T2 退化视口 | `vp.w/h≤0` 不产 Infinity/NaN | 呼应 `refreshViewportMask` 的 hotfix#4 注释（184 段） |
| T3 pan 方向符号 | B 的正负号契约 | 现仅 `MapRenderer.test.ts` 有交互层测试，无符号钉 |
| T4 NaN 传播 | 第四节缺陷 3 | 采「现状桩」还是「守卫」需裁决 |
| T5 C↔D 互逆 | 居中后取视口中心回同一世界点 | 两处式子现各抄一份 |
| T6 与 `isoToGrid` 相等 | 三份逆投影并单源 | `iso.test.ts:18,27` 已有往返，缺跨文件一致（同 c922-12 的钉法） |
| T7 null vs 夹边 | E/D 语义不可合并 | `MapRenderer.test.ts:191-193,197-200` |
| T8 逆对 | `screenFromWorld ∘ worldFromScreen = id` | 本次 node 手验一点误差 0；随机 1000 点为正式版 |
| T9 折叠四态矩阵 | G 的 inset 组合 | 现无该矩阵 |
| T10 读数口径 | H 的 11 处 `as + \|\|` 与 `Number.isFinite` 双标 | 现无 |

## 六、在途保护账（这单为什么不能顺手改文件）

- 在途改动内容（`git diff -U0` 原文，共 **+4 −3**）：

  ```
  @@ -1,0 +2 @@  + import { MASK_FILL_WHITE } from '../../shared/visualConstants';
  @@ -195 +196 @@  - mg.fillStyle(0xffffff, 1);          + mg.fillStyle(MASK_FILL_WHITE, 1);
  @@ -537 +538 @@  - maskGfx.fillStyle(0xffffff, 1);    + maskGfx.fillStyle(MASK_FILL_WHITE, 1);
  @@ -1137 +1138 @@  - g.fillStyle(0xffffff, 0.8);        + g.fillStyle(MASK_FILL_WHITE, 0.8);
  ```

  ⇒ **与相机/视口数学零交集**，本档第三节行区间不受其影响；但 197 行所在的 `refreshViewportMask` 与其紧邻的 196 行属同一方法，**任何提取动作都会撞上这批在途行**，故本单纯材料。
- 该在途件**自洽可独立提交**：`MASK_FILL_WHITE` 已在 HEAD 的 `src/shared/visualConstants.ts:8`（`export const MASK_FILL_WHITE = 0xffffff;`，`git show HEAD:… | grep -c` ＝ 1）⇒ 不依赖任何其它未提交文件。这条对「归属方何时闭合」的判定有用：它不需要等谁。
- 归属与约定：`docs/insights/colony-inflight-ownership-20260919.md:11` 记 `MapRenderer.ts | M | +4 −3 | 63dca27 | **勿动**：并发会话散布/渲染在途`；c922-08 的闭合清单亦在册。本班未 add／未 checkout／未回退该文件（第七节自证）。
- 若夜间执行提取单，**必须等这批在途行闭合后 rebase 行号**：本档的工作树行号在该件提交后仍成立（提交只改内容不改行数），但该件若被**回退**则 −1 行偏移，第四节缺陷与第三节表需按 HEAD 口径重取。

## 七、零改动自证与复算命令

```
$ git status --short src/renderer/render/            → 仅他人 M MapRenderer.ts（本班未 add/未改）
$ git show --stat HEAD                              → 本单产出只含 docs/insights/ 两个路径
$ wc -l src/renderer/render/MapRenderer.ts          → 1208（HEAD: 1207，差 1 行＝在途 import）
$ wc -l src/renderer/render/cameraMath.ts           → 90（非空 79、代码 60）
$ grep -n "cam.zoom as number | undefined" MapRenderer.ts | wc -l   → 8（192,208,277,287,308,323,819,844）
$ grep -n "cam.scroll[XY] as number | undefined" MapRenderer.ts      → 11 行 / 12 次出现（20 次 as number|undefined 合计，见 H）
$ npx vitest run src/renderer/render/__tests__/cameraMath.test.ts src/renderer/render/__tests__/iso.test.ts src/renderer/render/__tests__/MapRenderer.test.ts
  → 3 文件 56 例全绿（cameraMath 9 / iso 6 / MapRenderer 41），Duration 680ms，Start at 2026-09-22T00:32:50
  （定向跑避开本仓三件慢尾 sandboxSnapshot/auditDeadExports/sandboxSimulation；第三节行区间与第五节用例名以该三文件现存用例为「不得转红」的下界）
```

判别力口径（本档结论怎么自证的）：
- **不靠 Read 的显示**：第三节的每条行区间都由 `grep -n` 的原文命中定位，且用 `sed -n` 复读该行确认（本仓 9/21 有 Read 返回磁盘不存在版本的先例，见 c922-12 记录）。
- **第四节缺陷 3 是跑出来的**，不是推理出来的（node 复刻算式，输出三条已在正文）。
- **T8 的逆等式**同样以 node 现场算一例（误差 0）后才写入清单，随机多点版留给执行单。
- 未做（会越界）：真改 `MapRenderer.ts` 看哪些用例转红的变异自证 —— 该文件在他人在途，**改它＝踩「不写在途文件」**，故本单只能以「新增测试在提取前必然转红（函数还不存在）」作为可执行性判据，而非红绿对照。
