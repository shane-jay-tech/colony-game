# c927-51 · 批四「8 个本地 makeFakeZone/makeFakeContainer」收编清单（实况：**已闭合**）＋ 两枚未在册件的交接清单

- 工单：`c927-51`（cwd `D:\code\colony-game`，档位＝写位，软预算 ≤25 分钟）
- 班名：`qoder-executor-20260928-0340-colony54`｜取数时 HEAD `504c36e`（分支 `codex/architecture-hardening`）
- 时戳：2026-09-28 13:59（`date` 现取）｜开工 `git status --porcelain` 4 行，全部为在册在途件，本班未动
- 🔴 **本班零代码改动**：批四那 8 个文件的本地 fake **早已不在盘上**（详见 §1），
  卷宗锚点（`c922-02` result 遗留 1）是 c922-125 入库前的旧态 ⇒ 本班不"顺手重做"，只出清单与交接。
- 硬闸（c923-13 共享件处置＝在册未放行的人工裁决）**未被本班触发**：`fakeScene.ts` 一行未改。
  但它会拦住 §2 里那枚 `FactionDemandModal` ⇒ 该枚按班令落成**交接清单交主班裁**，未自行改共享件。

---

## 1. 批四 8 文件收编清单（逐枚现取，判据①）

命令：`cd D:/code/colony-game && grep -n "from './fakeScene'" src/renderer/ui/__tests__/<F>.test.ts`
＋ `grep -cE "^(function|const) +(makeFakeZone|makeFakeContainer|fakeZone|fakeContainer)" <同件>`（要求 0）

| # | 文件 | 现状 import 行 | 本地 builder 定义数 | 定向测试 |
|---|---|---|---|---|
| 1 | `CodexPanel.test.ts` | `:11` `makeFakeContainer, makeFakeGraphics, makeFakeText, makeFakeZone` | **0** | 7 例 ✔ |
| 2 | `DiplomacyPanel.test.ts` | `:12` 同上四符号 | **0** | 5 例 ✔ |
| 3 | `EventModal.test.ts` | `:13` 含 `makeFakeTextSized`（c923-02 为它专设） | **0** | 13 例 ✔ |
| 4 | `PolicyTreePanel.test.ts` | `:13` 四符号 | **0** | 16 例 ✔ |
| 5 | `PopulationPanel.test.ts` | `:42` `makeFakeGraphics, makeFakeText, makeFakeZone` | **0** | 4 例 ✔ |
| 6 | `ProductionGradePanels.test.ts` | `:9` 四符号 | **0** | 5 例 ✔ |
| 7 | `ScoreCardPanel.test.ts` | `:8` 四符号 | **0** | 3 例 ✔ |
| 8 | `TutorialModal.test.ts` | `:12` 含 `makeFakeTextSized` | **0** | 13 例 ✔ |
| （附） | `SaveLoadPanel.test.ts` | `:12` 批三本体 | **0** | 6 例 ✔ |

合跑读数（11 件，含 §2 两枚）：`Test Files 11 passed (11) / Tests 84 passed (84) / Duration 1.13s`。
全仓 `makeFakeZone\|makeFakeContainer` 命中面：除 `fakeScene.ts` 本体（4 处＝两枚定义＋两处文档），
其余 10 件**全部是 import 与调用**，无第二定义处 ⇒ `fakeScene.ts:10` 的「唯一定义处」宣称在 zone/container 这一族**成立**。

### 1.1 谁闭合的（git 考古，逐件 `git log --oneline -- <file>`）

| commit | 说明 |
|---|---|
| `c3d0a16` | `test(ui): c922-125 fakescene 批四——共享件补 handlers＋8 文件本地 builder 收编(9件)` ← **就是本单点名的那 8 个（＋SaveLoadPanel＝9）** |
| `82206f7` | `refactor(colony): fakeScene收编管道批一3/4件(c920-11)`（CodexPanel/PopulationPanel/ScoreCardPanel 先行） |
| `1b7142c` | c921-02 批二：共享件补 alpha/handlers union 后收编 SaveLoadPanel |
| `502125d` | c923-02 批五：五件 `makeFakeText/makeFakeGraphics` 归零（净 −144 行） |
| `986db17` | c924-02：DiplomacyPanel 内联 container 副本收编 |
| `2dd0dd1` | c924-13：fakeScene 补 `load` facet |

⇒ `c922-02` result 遗留 1 的两条前置（"共享 `makeFakeZone.on` 不登记 handlers"、"直接替换会让点击模拟静默失效"）
**已被 `c922-125` 在共享件里补掉**，现值见 `fakeScene.ts:70-89`（`handlers` ＋ `on.mockImplementation` 登记，
注释自述"对既有消费者为超集"）。遗留 2（union 注释过时）也已随批五/c924-02 逐条刷新（`:8-12`、`:91-96`）。
**结论：c927-51 与 `c922-125` 是同一件工作的两次投递，属队列侧的 stale 锚点重复建设**，不是盘上缺陷。

---

## 2. 交接清单：同族仍有本地 fake 的 2 个文件（**批四名单未含它们**，本班不擅自扩面）

全仓复扫（`grep -rniE "(function|const) *(makefake)?(zone|container)|(make|fake)(zone|container)[a-z]* *(=|\()" src/renderer/ui/__tests__/*.ts`，
排除 `fakeScene.ts`）实测只剩 **2 枚**真的自带本地 zone/container builder：

### 2.1 `MegaProjectPanel.test.ts`（:11 fakeText / :20 fakeGfx / :29 fakeZone / :36 fakeContainer）——**可只改 import，不需动共享件**

逐条依据（全部现取）：
- **zone 面**：本地 `fakeZone` 的 7 个方法（`setOrigin/setInteractive/setPosition/setSize/setVisible/on/destroy`）
  **全在** `makeFakeZone` 里（`fakeScene.ts:77-83`）；链式语义不塌——面板里真实存在的链是
  `add.zone(...).setOrigin(0,0).setInteractive(...)`（`MegaProjectPanel.ts:97/:126`，共享件这两个方法是 `mockReturnThis`）
  与 `setPosition(0,0).setSize(sw,sh)`（共享件 `:85-86` 的 `mockImplementation` 显式 `return z`）⇒ 两条都还链得动。
- **点击真路径**：该件 `c924-18` 加的两例从 `zone.on.mock.calls` 取回面板自己登记的回调（`MegaProjectPanel.ts:86/:98/:127` 的 `zone.on('pointerup', …)`），
  文件内 `:101-102` 注释已自述"本地 `fakeZone.on` 不建 handlers 表，故从 `on.mock.calls` 取回"。
  共享件 `on` 仍是 `vi.fn` **且额外登记 handlers** ⇒ `mock.calls` 口径不丢，属**超集替换**（正是 `fakeScene.ts:71-72` 自述的那条性质）。
- **container 面**：本地 `fakeContainer` 5 个方法是 `makeFakeContainer`（`:98-119`）的子集。
  唯一语义差＝共享件 `visible: false` 初值＋`setVisible` 记值，而本地件根本没有 `visible` 字段；
  该面板 `isVisible()` 读的是 `this.isOpen`（`MegaProjectPanel.ts:167`），**不读 container.visible** ⇒ 差值无读者。
- **text 面**：本地 `width: 80` 与共享 `width: 100` 不同，但 `MegaProjectPanel.ts` 全文只读
  `scene.scale.width/height`（`:84/:171/:172`），**零处读 text 的 width/height/displayHeight** ⇒ 死字段，压成共享默认不改任何分支。
- **graphics 面**：本地 `fakeGfx` 16 个方法是 `makeFakeGraphics`（`:63-65`）的真子集。
- ⚠ **必须保留它自己的 `fakeScene()`（:41-46）**：它把 toast 走 `registry.get('toast')` 接进去，
  而共享 `makeFakeScene` 的 `registry: { get: vi.fn() }`（`:159`）恒返回 `undefined` ⇒
  连 `MegaProjectPanel.ts:134-136` 的 `toast?.show?.()` 会静默不执行、该件 toast 断言全红。
  **收编面按本单口径只是 builder 族**（与 PopulationPanel 同法：本地 `add.zone = vi.fn(() => makeFakeZone())`），
  故此项不构成动共享件的理由。

### 2.2 `FactionDemandModal.test.ts`（:11 fakeText / :20 fakeGfx / :27 fakeZone / :35 fakeContainer）——🔴 **非要动共享件不可**

- 决定性一条：`FactionDemandModal.ts:138-141` 把 **`this.titleText.height` / `this.bodyText.height` 当活布局输入**
  （`panelH = 24 + titleH + 14 + bodyH + 20 + btnH + 24` → `py` → `setPosition`/`fillRect` 实参）。
  本地 `fakeText` 的 `height: 20`（`:16`），而共享 `makeFakeText` 的 `height: 18`（`fakeScene.ts:30`）
  ⇒ 换 import 就是**改夹具语义**（这正是 c923-02 立 `makeFakeTextSized` 时写下的理由，见 `fakeScene.ts:40-47`）。
- 而现有的 `makeFakeTextSized(displayHeight)` **只参数化 `displayHeight`**，不含 `height`/`width`
  ⇒ 想按原语义收编，必须给共享件**新增尺寸参数或新工厂**＝改 `fakeScene.ts`。
- ⇒ **命中 c923-13 那枚在册未放行的人工裁决（"维持／作废"二分）**，本班按班令**立即停手**，未动共享件、未动该测试件。
  今天它 5 例全绿（§1 合跑内），**没有急迫性**，可放心等裁决。
- 若裁决给"允许扩共享件"，最小形状（交主班，非本班实施）：
  `makeFakeTextSized(displayHeight: number, size?: { width?: number; height?: number })`——
  对既有 2 个消费者（EventModal/TutorialModal）为**纯可选参**，零翻转风险；回滚＝删一个可选形参。

### 2.3 两条易误判为"未收编"的命中（**已排除，别当新账**）

- `Legend.test.ts:44/:54`：命中的是 `(legend as …).toggleZone` 的 `vi.fn` 取回，不是 builder 定义。
- `StoryBar.test.ts:64`：命中的是 `(bar as AnyRec).container?.__visible` 直读属性，不是 builder。

---

## 3. 本班交付与后续建议

1. 本档＝批四闭合确认＋**唯一**产出物；`diff` 面为空（无代码改动，判据③「共享件零改动」以"未触碰"满足）。
2. 建议主班：① 把 `c927-51` 与在册 `c922-125` 标为同源重复，从 backlog 里并掉，防它再被投一次；
   ② 若还要收编同族，**只开 §2.1 一枚**（可只改 import，零闸）；§2.2 那枚挂到 c923-13 裁决之后。
3. 索引处置：`docs/insights` 四份索引快照（`colony-insights-index-20260915/-recount-20260917/-20260919/-20260927.md`）
   **无权威、无哨兵** ⇒ 本班未选权威、未改旧快照，本档入不入交主班随代提交定。
