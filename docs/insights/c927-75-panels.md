# c927-75 · BuildPanel／MilitaryPanel 夹具批一单：递归 Proxy 退场与两件首立真路径

> **班次**：`qoder-executor-20260928-1545-colony57`（波次 48 写位路）· cwd `D:\code\colony-game` · 开工 HEAD `ff2a9e7`
> **取数时刻**：2026-09-28T15:53–16:03+08:00（`date` 现取）
> **收口对象**：`zcode-bridge/done/c924-18.result.md` §遗留问题 1（"BuildPanel／MilitaryPanel 需先立夹具批"）
> **红线声明**：**生产码零净改动**（两件只被探针临时改、当场 `cp` 还原，sha1 前后同值
> `BuildPanel.ts=49f75f04`／`MilitaryPanel.ts=0d371b14`）；🔴 **共享件 `fakeScene.ts` 一字未动**；
> 经济数值／兵种平衡／存档／鉴权面零触碰；四枚未归因在途件零触碰。

---

## 〇、结论先行（五条）

1. **两件的夹具都立起来了，且两单判据闭合面没有溢出**：改动只落 `BuildPanel.test.ts`（152/18）与
   `MilitaryPanel.test.ts`（112/0）两枚测试件，各补 **2 例冒烟** ⇒ 本目录邻域现值 **27 files／176 tests 全绿**
   （本班两单净＋6：c927-74 的＋2 与本单的＋4；本单纯增前该目录为 170）。
2. 🔴 **递归 Proxy 已移除且可证**：`grep -c "new Proxy" BuildPanel.test.ts` → **0**（余 6 处 Proxy 字样全在注释里）、
   `makeStub` → **0**；`grep -c fakeScene` → **6**。store 由 Proxy 换成**真 GameStore**，
   buildMode 换成**显式方法表**（`onChange/isDemolish/enterDemolish/cancel/select/getSelected` 逐条列出）——
   Proxy 的"任何属性都是函数"是假象，现在缺方法当场 `TypeError`（本单实测撞到 `setLineSpacing` 缺失，见 §三）。
3. **MilitaryPanel 首次实例化**：`grep -cE 'new [A-Z][A-Za-z]*Panel' MilitaryPanel.test.ts` 由 c924-18 实测的 **0** → **1**；
   原 4 例（数据层口径）**一字未动**（numstat 删除行数 **0**）。
4. **判据有牙（三刀变异，各命中"只新例"）**：断开生产码的真登记 ⇒
   刀 C（`BuildPanel.ts:120` 折叠 zone `pointerdown→pointerup`）**恰 2 枚新例红、老 7 例全绿**；
   刀 D（`MilitaryPanel.ts:72` 遮罩外的 ✕ zone `pointerup→pointerdown`）**恰 2 枚新例红、老 4 例全绿**；
   刀 E（`BuildPanel.ts:187` `input.on('wheel'→'pointertap'`）**恰 1 枚新例红、其余 8 例全绿**。
   ⇒ 直接坐实 c924-18 §E1 的前提：**老例对"断线"失明**（它们覆写字段后直调私有方法，真登记断了也照绿）。
5. **未上"扩面即同笔"**：本单**没碰** `fakeScene.ts`（含 c927-65 刚入库的 `size?` 形参那条腿）。
   两件缺的 `add.image`／`textures.exists/get`／`setMask`／`createGeometryMask`／`setAlpha`／`setLineSpacing`
   全部在**各自文件内本地补面**。若主班日后要把这套"rich panel scene"收编进共享件，那是
   **共享件＋31 枚消费件的同笔活**（另议），本单刻意不触发。

## 一、夹具形状（两件各一份本地工厂，故意不共享）

`makeBuildPanelScene()`／`makePanelScene()` 都以 `makeFakeScene({ tweens: true })` 打底，再覆写三项、补两项：

| 面 | 为什么本地补 | 生产码调用点 |
|---|---|---|
| `add.graphics` 返回体加 `setMask`／`setAlpha`／`createGeometryMask` | 共享 `makeFakeGraphics` 方法表没有这三项 | `BuildPanel.ts:142`（滚动遮罩）、`:253/:258`（行套遮罩）、`:216-219`（淡入） |
| `add.text` 返回体加 `setMask`／`setScale`／`setLineSpacing` 并保留"第三参＝初始文本"语义 | 共享 `makeFakeText` 没有这三项；`text` 初值语义必须与 `makeFakeScene` 一致否则 `collapseLabel` 断言失真 | `BuildPanel.ts:392/:397`、`:259-260` |
| `add.image` | 共享 `makeFakeScene` 的 `add` 只有 container/graphics/text/zone | `BuildPanel.ts:251`、`MilitaryPanel.ts:183` |
| `textures.exists → false`／`get` | 本仓无纹理注册表夹具 ⇒ 立绘走"缺图"兜底分支（**在册缺席面，不假造**） | `BuildPanel.ts:250`、`MilitaryPanel.ts:182-184` |
| `tweens: true` | 共享件按 opts 给，`beginExpandFade` 要用 | `BuildPanel.ts:221` |

 rigs：`makeRig(targetCount)`（保留 c920-04 的特征化覆写 rows/rowsAreaRect/layout/store，**老 7 例期望值一字未改**）
 ＋ `makeRealRig()`（**不覆写任何字段**，构造期 `buildRows/layout/refreshAffordance` 全真跑，供新例用）。

## 二、新增 4 例各自钉住什么

| 例 | 断言要点 | 真路径形态 |
|---|---|---|
| BuildPanel 冒烟 | 不覆写字段也能构造；`rows.length > 0`、`titleText.text === '建造'`、`rowsMask` 真挂上、两枚 zone 的 `handlers.pointerdown` 是函数、`input.on` 里真取回 wheel 回调、`store.listenerCount(PANEL_COLLAPSED_CHANGED) === 1` | 回调从 `scene.input.on.mock.calls.find(c => c[0]==='wheel')?.[1]` 取（同 c924-18 §E3 手法） |
| BuildPanel 真路径折叠 | 点 collapse zone 的 `pointerdown` ⇒ **真 GameStore** 折叠位 `false→true`、标题转竖排 `'建\n造'`、`collapseLabel` `◀→▶`、`rowsAreaRect → null`、`demolishZone.setVisible(false)`；再点一次整套还原 | 触发面板自己写进 zone 的闭包，不经 `panel.close()`／私有方法后门 |
| MilitaryPanel 冒烟 | 首次实例化不抛、初始 `isVisible() === false` 且 `container.visible === false`、`title.text === '军务'`、✕ 与遮罩两枚 zone 的 `handlers.pointerup` 是函数、六路 store 监听各 1；`open()` 后 `body.text` 非空（**refresh 真跑通**）、`closeZone.setSize(32,32)` | `layout()`＋`refresh()` 全在 fake scene 上真执行 |
| MilitaryPanel 真路径开关 | 未开就点 ✕ ⇒ `close()` 早退（不开面板、不动时停）；`open()` 后点 ✕ ⇒ 关闭＋`isPaused()` 转 false；重放不复活也不多还；遮罩 zone 的 `pointerup` 同效 | 触发 `MilitaryPanel.ts:61/:72` 登记的闭包本体 |

**归因评估（卷宗点名"连带评估现有 7 例的归因"）**：BuildPanel 老 7 例换夹具后**逐条同名全绿、期望值零改动**
（它们靠覆写 `rows/rowsAreaRect/layout/store` 驱动纯计算，与 scene 形态正交）⇒ 夹具替换对它们**零翻案**；
但刀 C／刀 E 实测它们在"真登记被断开"时依旧绿 ⇒ 这 7 例**不看守 handler 接线**，看守面由本单新例补上。
MilitaryPanel 老 4 例是 store／纯函数账，同理不受夹具影响（本单对它们**零行改动**）。

## 三、变异自证读数（三刀，一次一处，当场还原）

```
$ cp src/renderer/ui/BuildPanel.ts tmp/c927-75-BuildPanel.ts.bak
$ cp src/renderer/ui/MilitaryPanel.ts tmp/c927-75-MilitaryPanel.ts.bak
$ sha1sum tmp/c927-75-BuildPanel.ts.bak tmp/c927-75-MilitaryPanel.ts.bak
49f75f0436d9f2a57e0cd05a1c880900609ab4d9 *tmp/c927-75-BuildPanel.ts.bak
0d371b14b488526bd6916bc666649cbeef73baca *tmp/c927-75-MilitaryPanel.ts.bak
```

**刀 C** `BuildPanel.ts:120  this.collapseZone.on('pointerdown' → 'pointerup'`

```
$ npx vitest run --reporter=verbose src/renderer/ui/__tests__/BuildPanel.test.ts     rc=1
 ✓ 特征化 7 例全绿（滚动半速／上界 clamp／下界 clamp／出界不滚／灰显计入／折叠 left／折叠 right）
 × 冒烟：不覆写任何字段也能真构造…           → expected 'undefined' to be 'function'
 × 真路径：点折叠 zone 的 pointerdown …      → TypeError: panel.collapseZone.handlers.pointerdown is not a function
 Test Files  1 failed (1)
      Tests  2 failed 与 7 passed (9)
```

**刀 D** `MilitaryPanel.ts:72  this.closeZone.on('pointerup' → 'pointerdown'`

```
$ npx vitest run --reporter=verbose src/renderer/ui/__tests__/MilitaryPanel.test.ts   rc=1
 ✓ 数据层 4 例全绿
 × 冒烟：首次实例化不抛…                    → expected 'undefined' to be 'function'
 × 真路径：点 ✕ zone 的 pointerup …          → TypeError: internals.closeZone.handlers.pointerup is not a function
 Test Files  1 failed (1)
      Tests  2 failed 与 4 passed (6)
```

**刀 E** `BuildPanel.ts:187  scene.input.on('wheel' → 'pointertap'`

```
$ npx vitest run --reporter=verbose src/renderer/ui/__tests__/BuildPanel.test.ts     rc=1
 × 冒烟：不覆写任何字段也能真构造…           → expected 'undefined' to be 'function'（wheelHandlerOf 取不到）
 ✓ 真路径折叠例绿（它不依赖 wheel）
 ✓ 特征化 7 例绿（它们直调 panel['onWheel']）
 Test Files  1 failed (1)
      Tests  1 failed 与 8 passed (9)
```

**还原与零净改动复验**

```
$ cp tmp/c927-75-BuildPanel.ts.bak src/renderer/ui/BuildPanel.ts
$ cp tmp/c927-75-MilitaryPanel.ts.bak src/renderer/ui/MilitaryPanel.ts
$ sha1sum src/renderer/ui/BuildPanel.ts src/renderer/ui/MilitaryPanel.ts
49f75f0436d9f2a57e0cd05a1c880900609ab4d9 *src/renderer/ui/BuildPanel.ts      ← 与开工同值
0d371b14b488526bd6916bc666649cbeef73baca *src/renderer/ui/MilitaryPanel.ts   ← 与开工同值
$ git diff --numstat -- src/renderer/ui/BuildPanel.ts src/renderer/ui/MilitaryPanel.ts | wc -l
0
$ grep -n "collapseZone.on(" src/renderer/ui/BuildPanel.ts
120:    this.collapseZone.on('pointerdown', () => {
$ grep -n "closeZone.on(" src/renderer/ui/MilitaryPanel.ts
72:    this.closeZone.on('pointerup', () => this.close());
```
（还原口径同 c927-74：**自存 `cp` 副本＋sha1 逐字节复验**，未用 `git apply -R`——本仓 `core.autocrlf=true`
且无 `.gitattributes`，反向 apply 会把整文件行尾翻掉而 porcelain 看不出来。两件测试件行尾复验 `grep -c $'\r'` ＝ **0**。）

## 四、验收读数

```
$ npx vitest run src/renderer/ui/__tests__/BuildPanel.test.ts src/renderer/ui/__tests__/MilitaryPanel.test.ts
 Test Files  2 passed (2)      Tests  15 passed (15)     rc=0     ← 基线 7 与 4 ⇒ 净增 4 例
$ npx vitest run src/renderer/ui/__tests__                 # 目录邻域（含本班 c927-74 那枚）
 Test Files  27 passed (27)    Tests  176 passed (176)   rc=0
$ npm run type-check > tmp/c927-75-typecheck.txt 2>&1; echo rc=$?
rc=0（`tsc -p tsconfig.renderer.json --noEmit`）
$ grep -c "new Proxy" src/renderer/ui/__tests__/BuildPanel.test.ts   → 0
$ grep -c "makeStub"  src/renderer/ui/__tests__/BuildPanel.test.ts   → 0
$ grep -cE "new [A-Z][A-Za-z]*Panel" src/renderer/ui/__tests__/MilitaryPanel.test.ts → 1
$ git diff --numstat -- src/renderer/ui/__tests__/BuildPanel.test.ts src/renderer/ui/__tests__/MilitaryPanel.test.ts
152     18      src/renderer/ui/__tests__/BuildPanel.test.ts
112     0       src/renderer/ui/__tests__/MilitaryPanel.test.ts      ← 老 4 例零删除
```
**未跑全量**（本域并发窗，按 w40 §5／w42 §B.4）⇒ 全量口径交主班 pre-commit 取。
途中一次 type-check **rc=2**（`Record<string, ReturnType<typeof vi.fn>>` 与共享件返回型不合），
已按 BuildPanel 侧同型写法改为 `Record<string, any>` 后 rc=0——**首跑红的这次如实记着**。

## 五、在册缺席与下一步（不在本单判据内）

1. **立绘面缺席**：`textures.exists` 恒 false ⇒ `BuildPanel.ts:250-261` 的缩略图分支（`thumb` 建与不建两条）
   与 `MilitaryPanel.ts:182-201` 的将领画廊**从未在本仓被测试执行过**。要收口得给 fake 补可控纹理，
   属**夹具二批**（且若收进共享件＝同笔 31 件），本单不越。
2. **BuildPanel 还有 5 个交互面未走真路径**：`demolishZone` 的 pointerdown（`:134`）、行 zone 的
   pointerdown/hover（`:243`、`showTooltip`）、`beginExpandFade` 的 tween 链、`destroy` 的六路 off、
   `refreshAffordance` 的可建／灰显着色。本单按卷宗只补 2 例冒烟 ⇒ 扩面单请以本文件夹具为底继续。
3. **`demolishRect`／`rowsAreaRect` 一类几何字段仍无断言**（老 7 例把 layout 覆写成 `vi.fn()`）。
4. **共享件那条腿不在本单**：`fakeScene.ts` 未动；`FactionDemandModal.test.ts` 的收编（c927-65 只落了共享件腿）
   **仍未做**，与本单无冲突（本单的本地补面与 `makeFakeTextSized(size?)` 形参零交集）。
