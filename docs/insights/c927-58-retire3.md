# c927-58 · evtart 零引用键退役单（9/21 拍板⑤）——只读位复核＋可批形状，零 git rm／零删文件

- 班名：`qoder-executor-20260928-0210-colony51`｜档位：**只读位**（波次 41 横幅）
- cwd：`D:\code\colony-game`｜分支：`codex/architecture-hardening`｜取数时 HEAD：`cc75103`（2026-09-28 01:46:48 +0800）
- 取数时戳：`date` 现取 11:40:45（定向测试）／11:47（本档）；跨时点引用请复跑 §1 命令
- 性质：**裁决材料**。`git rm`／删 `.webp`／改 manifest／改测试判据 **一律未做**（横幅只读＋波次 brief §5 红线＋w41 §A 末句）
- 闸标自查：卷宗「背景与锚点」段对四枚标准闸标（停人工闸／人工闸后／需人工放行／主班定口径）**rc=1 无命中**；
  但该段逐字抄着上游两句「处置**需人工判定**：接线还是退役」「coronation 三出口**需人工选**（甲/乙/丙）」⇒ 语义闸在世，见 §5。

---

## 0. 结论速览

1. 🔴 **拍板⑤的"三键"前提已过期 1/3**：9/21 裁决 ⑤ 写「零引用三键（feast/coronation/unification）取**退役**」，
   但 **`evt_art_unification` 已于 2026-09-23 由 `c923-08` 接线并入库**（`src/renderer/scenes/GameScene.ts:117` 的
   `TransitionData.imageKey: 'evt_art_unification'`，序章→第一章「天下一统」跳变配图，承 `docs/design/evt-art-wiring-20260922.md` §4.1）。
   现盘上零引用面**只有 2 键**：`coronation`、`feast` —— 这一条不是本班的推断，而是**在册测试判据本身**：
   `src/renderer/data/__tests__/artManifestEvtArtUsage.test.ts:140` `expect(zeroRef).toEqual(['evt_art_coronation', 'evt_art_feast'])`。
   ⇒ **按拍板⑤字面删三键 ＝ 删一枚在世功能**，且当场红三处（见 §2 丙案行）。
2. 「删 manifest 条项＋对应 .webp」这两步**远小于实际写面**：真做要动 **1 枚受版码 ＋ 3 枚测试件的 11 处硬编码判据 ＋ 2 枚二进制 ＋ 1 段不可再生语义底稿**（§2）。
   其中测试判据的改动属**改门禁判据**（与波次 brief §4 同型的人工闸），不是"顺手同步数字"。
3. 🔴 **完成标准③的 B-152 是误引**：`B-152` 在权威台账里是 **colony scatter 贴图 `rock_cluster` 缺盘补图**
   （`D:/code/docs/night-plans/BACKLOG.md:197`，状态 `queued`，标题口径＝**方案 A 补图**），与 evtart 三键无关；
   `docs/insights/colony-b152-close-20260922.md` 早已就此停手并给出同一否决理由（「代码说已关、规划台账说未决」＝假闭环）。
   而 evtart 退役在台账侧**根本没有可翻的行**：裁决⑤ 所在那段明写「同批裁决注记（**逐 id 不入本表**，供规划班拆单）」，
   且待人工台账 `D:/code/docs/insights/drain-20260923-pending-human.md`（320,221 B，mtime 09-28 11:31）对 `evt_art`／`零引用三键`／`B-152` **三项全 0 命中**（`grep -c` 实测）。
   ⇒ 两张登记面都在本班 cwd 之外、且都是波次 brief §1/§D 的主班独占件（`docs/night-plans/**`＝闸②）⇒ **关联登记这一步只能由主班做**，本班连落点都没有。
4. 定向测试在 `cc75103` **全绿**（26 例，见 §4）：即"退役前基线"是干净的，任何红都可直接归因给退役改动本身——这是本班能给的最好验收面。
5. 退役收益实测很小：两枚 webp 共 **540,506 B（≈528 KB）**，且 `required=true ⇔ 文件实存` 这条契约（`artManifest.test.ts:74-80`）
   决定了**键与图必须同批**，否则当场红；留着不动也不违反任何在册纪律（"资产在而消费者缺"是 c922-10 的定性，不是缺陷）。

---

## 1. 盘上现值（`cc75103`，命令均可复跑）

```
$ grep -n "evt_art" src/renderer/data/artManifest.ts        → :71 unification / :72 coronation / :75 feast（10 键 EVENT_ART，:70-80）
$ git grep -l "coronation" -- .                             → 12 枚：4 枚 src/docs 在册件 + public/art/manifest_portraits_1781872230.json + scripts/gen_portraits_events.py + 8 枚 docs/insights 历史档
$ python（os.path.getsize）
coronation.webp 253278   feast.webp 287228   unification.webp 254546   → 两键合计 540506 B，三键合计 795052 B
$ ls public/art/events/                                     → 10 个 .webp 与 10 键逐名对应（mtime 全为 09-20 12:4x）
$ grep -n "evt_art_unification" src/renderer/scenes/GameScene.ts → :117（c923-08 接线，注释自述"键在册 artManifest:71、BootScene 已把该纹理装进来"）
$ git blame -L 117,117 --date=iso -- src/renderer/scenes/GameScene.ts
  74cbfa67 (Colony Dev 2026-09-23 09:58:53 +0800 117)  imageKey: 'evt_art_unification', // c923-08 接线（承 c922-113 §4.1）…
$ git log --oneline -1 -- src/renderer/scenes/GameScene.ts → 74cbfa6 test(colony): c923-07/08/09 三单合并入账…
  ⇒ 接线入账实锤时点＝**2026-09-23 09:58**，晚于 9/21 23:1x 的拍板⑤ 约 35 小时
```

三面/四面口径现值（`artManifestEvtArtUsage.test.ts` 自证，非本班重算）：事件面 4 ＋ 过场面 1 ＋ 动态后缀面 3 ＋ **零引用面 2** ＝ 10。

引用面全集（退役影响面）：`BootScene.ts:69-70` 与 `bootLoadList.test.ts:149` 都由 `EVENT_ART` **派生**（改清单即自动跟随，无需改码）；
`artManifest.test.ts:26/:39/:77` 与 `artManifestEvtArtUsage.test.ts` 共 **11 处硬编码**要跟着改。

---

## 2. 可批形状：逐处改动面（**本班一步未做**）

### 甲案（推荐）｜退役 2 键（`coronation` ＋ `feast`），unification 保留

| # | 文件:行 | 现值 | 改后 | 为什么必须一起改 |
|---|---|---|---|---|
| 1 | `src/renderer/data/artManifest.ts:72` | `{ key: 'evt_art_coronation', … required: true }` | 删行 | 主改动 |
| 2 | `src/renderer/data/artManifest.ts:75` | `{ key: 'evt_art_feast', … required: true }` | 删行 | 主改动 |
| 3 | `src/renderer/data/__tests__/artManifest.test.ts:26` | `expect(EVENT_ART).toHaveLength(10)` | `8` | 清单条数 |
| 4 | 同上 `:39` | `expect(ART_MANIFEST).toHaveLength(35 + 5 + 10 + 5)` | `35 + 5 + 8 + 5` | 并集和式 |
| 5 | 同上 `:77` | `expect(required).toHaveLength(53)` | `51` | `required=true ⇔ 文件实存` 契约（`:74-80`），键图同批才不红 |
| 6 | `…/artManifestEvtArtUsage.test.ts:86` | `MANIFEST_KEYS` 长度 10 | 8 | 覆盖面自证 |
| 7 | 同上 `:87` | `new Set(...).size` 10 | 8 | 同上 |
| 8 | 同上 `:88` | `readdirSync(EVENTS_DIR) … toHaveLength(10)` | 8 | 删图后磁盘枚举 |
| 9 | 同上 `:140` | `expect(zeroRef).toEqual(['evt_art_coronation','evt_art_feast'])` | `toEqual([])` | 键没了 ⇒ 零引用面空 |
| 10 | 同上 `:142-146` | 逐键循环内两条守卫（`required`／`existsSync`） | **该例失去牙齿**，需改判据（例如改钉"清单内每键均有实存图"） | ⚠ 退役把一条活守卫变成空转——这是本单最容易被忽略的成本 |
| 11 | 同上 `:148` 与 `:159`/`:162` | 并集 10；四面 `[4,1,3,2]` | 8；`[4,1,3,0]` | 合计式与逐面数 |
| 12 | `public/art/events/coronation.webp`／`feast.webp` | 540,506 B | `git rm` 精确路径（**不 commit**＝留档） | 主改动 |
| 13 | `scripts/gen_portraits_events.py:65-80` | 三键出图 prompt 底稿 | 建议**保留**并加一行注释指向退役决定 | c922-113 实证该生成器已跑不动（`ModuleNotFoundError`，c922-109）⇒ prompt 与图同生、**不可再生** |
| 14 | 台账侧 | `OPTIMIZATION_BACKLOG.md` P3-1 行「事件 10/10」、P3-2 未勾 | 需同步 | **该件当前是用户本人 ` M` 在途改动（d914-85），属拍板域，任何代提交都不碰**（c927-41 §2.1／本波横幅在册） |

- 不需要动：`BootScene.ts`（派生）、`bootLoadList.test.ts`（派生）、`GameScene.ts`（只涉 unification，甲案保留）。
- 最小改动面＝**2 行受版码 ＋ 9 处测试判据 ＋ 2 枚二进制**；回滚成本＝单 `git revert`（webp 是二进制但 tracked，blob 永久可达）。
- 验收复算：`npx vitest run src/renderer/data/__tests__/artManifest.test.ts …/artManifestEvtArtUsage.test.ts …/bootLoadList.test.ts`
  ＋ `node scripts/audit-dead-exports.mjs`（会顺带报 `artManifest` 行号漂移，见 c927-56）。

### 乙案｜只退役 `feast`（c922-113 的丙案推荐：feast 连合格宿主都没有；coronation 语义最强但宿主是 Toast，进不了 800×450 插画）

改动面同甲案减半（表 #1/#3-#5 等数字由 -2 改 -1：`EVENT_ART` 9、`ART_MANIFEST` 54、`required` 52、`zeroRef` 剩 `[coronation]`），
**且 :142-146 那条守卫不空转**（仍有 1 键可钉）⇒ 从"判据不退化"角度看乙案比甲案干净。`coronation` 留待 c922-113 甲/乙案（Toast→过场属 UX 取向变更，需人工选）。

### 丙案｜按拍板⑤字面退役 3 键（含 `unification`）—— 🔴 **不建议，本班不出可批形状**

除甲案全部改动外还要：
- 删 `src/renderer/scenes/GameScene.ts:117` **在世生产码一行**（序章→第一章过场配图，缺图时 `TransitionScene:52` 静默回退纯文字）；
- `artManifestEvtArtUsage.test.ts:113` `expect(SCENE_FACE).toEqual(['evt_art_unification'])` → `[]`、`:115` 互斥检查随之空转、
  `:148/:159/:162` 变 `[4,0,3,0]` 与总数 7；
- 若**只删键不删 GameScene 行**，则 `:110-111` 的「清单外字面量」守卫当场红（`unknown` 多出 `evt_art_unification`）——
  这恰好证明该守卫设计的目的：**删掉它等于废掉"抓绕过数据层硬写"这条守卫**（c922-113 §五.1 明令）。
⇒ 丙案实质是「9/21 拍板」与「9/23 已获准接线」两条决定的正面冲突，**不是执行细节，是裁决冲突**，必须回人工（或回规划班重拍⑤）。

---

## 3. 语义闸说明（为何横幅给我写位也不做）

- 卷宗锚点原文即两道「需人工判定／需人工选」；拍板⑤ 只裁了"取退役"这个**方向**，没裁：
  ①退役几个键（前提已变）、②`artManifestEvtArtUsage` 的空转守卫怎么补（判据设计）、③台账侧 P3-1「事件 10/10」与 night-plans 注记如何同步（两张台账都在我 cwd 外且属主班独占件）。
- 波次 brief §4：改门禁判据＝人工闸；w41 §A：闸标优先于横幅；本波横幅另给**只读位**。三条一致指向"只出材料"。

## 4. 测试与门禁读数（现取）

```
$ npx vitest run src/renderer/data/__tests__/artManifestEvtArtUsage.test.ts src/renderer/data/__tests__/artManifest.test.ts src/renderer/data/__tests__/bootLoadList.test.ts
 ✓ src/renderer/data/__tests__/artManifest.test.ts  (11 tests) 30ms
 ✓ src/renderer/data/__tests__/bootLoadList.test.ts  (10 tests) 22ms
 ✓ src/renderer/data/__tests__/artManifestEvtArtUsage.test.ts  (5 tests) 9ms
 Test Files  3 passed (3)      Tests  26 passed (26)      Duration  2.03s
（11:40:39 → 11:40:45，rc=0；只跑定向文件，未跑全量——并发窗纪律）
$ npm run --silent type-check   → rc=0，4 s（11:35:31 现取；pre-commit 内建的另一腿是全量 vitest，本班未跑）
$ python -c "…getsize…"         → coronation 253278 / feast 287228 / unification 254546
```

## 5. 完成标准对照

| 卷宗完成标准 | 结论 | 说明 |
|---|---|---|
| ① 三键＋webp 清除清单 | **给出，但不是"三键"** | §1/§2：盘上零引用面现值 2 键（coronation/feast）；unification 已在世 ⇒ 三键清单＝丙案，本班判为裁决冲突 |
| ② 相关测试绿 | **通过（退役前基线）** | 定向 3 files／26 tests 全绿 rc=0；退役后的绿**必须在写位后取**，只读位不可得 |
| ③ B-152 关联登记（翻 closed(B)） | **判据本身失效，未做** | B-152＝scatter `rock_cluster` 缺盘补图（night-plans BACKLOG:197 queued，A 案口径），与 evtart 无关；evtart 退役在两张台账里都无可翻行，且台账面＝主班独占＋cwd 外 ⇒ 交主班补登（建议补进 `drain-20260923-pending-human.md`，勿动 night-plans 表正文） |

## 6. 只读自证

- 本班对 colony 仓的**既有受版文件零改动**：`git status --porcelain` 写本档时 6 行＝开工 4 行（同一集合，逐字未变）＋本波新增未跟踪档 2 枚（`c927-56-orphan-commit.md`、本档）；
  本班下一枚产物 `c927-59-gpt-review-request.md` 落盘后为 7 行。**零删除、零改写**。
- 未执行：`git add`／`commit`／`stash`／`checkout`／`restore`／`clean`／`git rm`／`rm` 任何受版文件／`--write`／全量套件。
- 临时件在 `D:\code\tmp\qoder-executor-20260928-0210-colony51\`，本班自清；仓根零残留。

## 7. 遗留（交人工／主班）

1. **请重拍⑤或收窄⑤**：拍板时点是 9/21 23:1x，接线发生在 9/23；两条决定都出自合法授权，冲突不该由执行班消解。可选口径＝甲（退 2 键）／乙（只退 feast）／丙（连在世键一起退）。
2. 若走甲或乙：`artManifestEvtArtUsage.test.ts:142-146` 的守卫退化要给替代判据（否则"加一张不接线的图"这条漂红机制被削弱）。
3. 台账登记面：night-plans `BACKLOG.md` 裁决注记段（闸②，主班件）＋待人工册补登一条；colony `OPTIMIZATION_BACKLOG.md` P3-1 的「事件 10/10」是用户本人改动域，别在代提交里顺手改。
4. `public/art/manifest_portraits_1781872230.json` 等 4 枚出图流水仍在仓（含 coronation/feast 字样，且 `git check-ignore` rc=1 ⇒ **tracked**），
   属 c922-109／c927-40 F 栏的 **portraits 孤儿族**（另一枚人工裁决），**不随本单退役**，别混批。
5. 退役只影响后续构建，**历史出包不追改**：`coronation` 字样另命中 3 枚构建产物
   （`dist/renderer/art/manifest_portraits_1781872230.json`、`dist/renderer/assets/index-9DOBpPPC.js`、`dist-out/win-unpacked/resources/app.asar`），
   前两者分别由 `.gitignore:2 dist/`、`:3 dist-out/` 覆盖 ⇒ 不在受版面，无需也无法随单清除。
