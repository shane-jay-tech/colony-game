# colony 零引用事件插画接线设计稿：coronation / feast / unification（c922-113，2026-09-22T04:5x）

> 性质：**设计级，本单不实施任何接线**（自证见 §九）。
> 判据不另造：清单层硬约束沿用 `docs/design/p1-4-manifest-authority-20260922.md`（c922-110）的 C1–C7 与「自反式假绿」风险条；
> 键用量对账沿用 `artManifestEvtArtUsage.test.ts`（c922-10，提交 `54e89a4`）的三面口径；孤儿面沿用 c922-107/c922-109。
> 本稿只补一层 c922-10/c922-110 都没走过的判据：**这三张画「画的是什么」的权威源在出图 prompt 里，不在事件表里。**

## 〇、结论三句

1. **三键的命运不同，不该一次裁决**：`unification` 有**现成宿主**（一处过场调用点，1 行 diff）；`coronation` 语义宿主存在但**不是事件**（是国格晋阶与同一条跳变旁白的后半句，且与 unification 争同一屏）；`feast` **没有任何合格宿主**——它的语义在「选项文本」粒度上，而 `CourtEventChoice` 没有插画字段。
2. 「在 events.ts / storyEvents.ts 里挑一条事件挂上去」这个任务书预设，对三键中的**两键不成立**：全 data 层扫不到任何登基类或一统类事件（§二 实证）。硬挂只能选**语义相反**的事件，那会把 P3-4「用画面说话」变成「用画面拆台」。
3. c922-10 的五例断言**不会因为"接线"而自动变绿**：本单用变异探针实测，场景侧接线会红 ②④⑤ 三例，且 ② 的红法与数据侧接线**不同**（§五），落地单必须重写对账模型而不是删断言。

## 一、锚点复核（漂移 0 处；措辞更正 2 处）

| 任务书锚点 | 磁盘现值 | 判定 |
|---|---|---|
| `artManifest.ts:71` `evt_art_unification` | **:71** | 未漂 |
| `artManifest.ts:72` `evt_art_coronation` | **:72** | 未漂 |
| `artManifest.ts:75` `evt_art_feast` | **:75** | 未漂 |

**措辞更正 2 处（按磁盘实况，不据此判 failed）**：

1. 「既有 `illustrationKey` 消费链（**TransitionScene**/朝议弹窗）」——`TransitionScene` **不读 `illustrationKey`**。它只读 `TransitionData.imageKey`（`TransitionScene.ts:20` 类型、`:52` 取值并 `textures.exists` 守卫、`:61-62` 绘制、`:95-96` 按源图宽高适配），而全仓唯一喂 `imageKey` 的调用点是 `GameScene.ts:138` 的 `` `evt_art_ending_${ending}` ``（`rg -n "imageKey" src/` 实测：其余命中全在 `TransitionScene.ts` 自身与类型定义）。⇒ 消费链其实是**两条互不相通的轨**：
   - 轨 A（事件粒度）：`CourtEvent.illustrationKey`（`schema.ts:236` 注释＋`:237` 字段）→ `EventModal.ts:271-272`（有 key 且纹理在 ⇒ banner 高 150×16/9，缺图 `illusH=0` 静默回退纯文字）；
   - 轨 B（过场粒度）：`TransitionData.imageKey` → `TransitionScene`，喂点在 `state/scenes` 层，**与 data 层无 import 关系**。
   **这个区分是本单全部价值的来源**：三键里最有可能接通的恰好不在轨 A 上。
2. 「朝议弹窗」成立＝`EventModal`（`schema.ts:200` 段标题即「Court Event (朝议事件)」）。

## 二、三键的画面语义权威源（新取证通道）

出图 prompt 原文留在 `scripts/gen_portraits_events.py:65-80`（**逐字引用**，中文场景设定块）。这张表的意义：判定「语义匹配」不必看图、也不必猜美术意图，且该生成器**今天已跑不动**（c922-109 实测：`python scripts/gen_portraits_events.py --help` → `ModuleNotFoundError: No module named 'gen_wanxiang_batch'`，默认模型属已退役万象）⇒ **prompt 是与图像同生、不可再生的语义底稿**。

| 键 | prompt 关键要素（:65-80 原文节选） |
|---|---|
| `unification` | "The moment of unification: … the banners of many small rival states **topple and fall**, while **one great banner rises**; rows of **vanquished feudal lords kneel** in submission" |
| `coronation` | "A pre-imperial **coronation ceremony**: a ruler … **ascends the broad … stair of a … timber ancestral hall**; **ranks of officials bow**; large **bronze ding** tripods flank the stair; **incense smoke**" |
| `feast` | "A Spring and Autumn **court banquet** inside an austere timber hall: nobles **seated on mats at low tables**, bronze wine vessels and ding, **musicians with bells and zithers**, warm lamplight. **Refined but unornamented**" |

**事件侧可用性实测**（完成标准要求的实证命令）：

```
$ rg -n "一统|登基|即位|嗣位|践阼|受禅|加冕|称制|混一|天下一" src/renderer/data/events.ts src/renderer/data/storyEvents.ts src/renderer/data/eventsExpanded.ts
   → 0 命中（exit=1）
$ rg -n "臣服|征服|附庸|并入" src/renderer/data/*.ts（排除 __tests__）
   → 仅 events.ts:6 的注释「Phase3：末尾并入 STORY_EVENTS」，非事件语义
$ rg -n "宴|酒|飨|庆典|笙歌" src/renderer/data/events.ts src/renderer/data/eventsExpanded.ts src/renderer/data/storyEvents.ts
   → 2 命中：events.ts:40（choice 文本「设宴款待，缔交盟好」）＋ storyEvents.ts:497（「摆了一桌酒」的 descPlain）
$ rg -n "宗庙|九鼎|会盟" src/renderer/data/countryGrades.ts
   → :70 立宗庙 / :84 会盟列邦 / :91 九鼎既铸
```
⇒ **一统与登基在事件层根本不存在**：一统发生在 `state/storyDriver.ts:43 checkUnification` → `gameStore.ts:2135-2140`（`sf.unified = true`）→ 发 `state:storyUnified`（`gameStore.ts:159`）→ `GameScene.ts:108 storyUnifiedListener` 播 `DYNASTY_TRANSITION_NARRATION`。**它是状态跳变，不是被编排的朝议事件**。

## 三、逐键候选宿主论证（候选表含行号与否决理由）

### 3.1 `unification` —— 有现成宿主，且宿主已经写好了那句话

| 候选 | 锚点 | 判定 |
|---|---|---|
| **序章→第一章跳变过场** | `GameScene.ts:108-123`（`storyUnifiedListener`，:115-117 构造 `TransitionData`，**只给 `lines` 不给 `imageKey`**）＋ `storyChapters.ts:159-164 DYNASTY_TRANSITION_NARRATION` 首行「**于是天下一统**，你受推为王，立宗庙、定都邑，是为开国之君。」 | ✅ **推荐**。文案第一句与 prompt 逐要素对应（列国.banner 倒 → 一 banner 立 → 诸侯跪），且这是全屏 16:9 过场，正是 800×450 事件图的用武之地 |
| 三结局过场之一 | `storyChapters.ts:140`（`ENDING_NARRATION`，gong :141／jia :146／huo :151） | ❌ 该屏已被 `evt_art_ending_*` 占用（`GameScene.ts:138`），一屏一图 |
| 任意朝议事件 | 二 节实测 0 命中 | ❌ 无宿主；为挂图而新造"一统事件"＝与 `checkUnification` 争事实源（统一时刻已由 state 层决定），属重复建设 |

### 3.2 `coronation` —— 语义宿主存在，但**两处都不是事件**，且与 3.1 争同一屏

| 候选 | 锚点 | 判定 |
|---|---|---|
| 国格晋阶「邦国」（level 2） | `countryGrades.ts:66-70`：`signature: { kind:'building', id:'bld_ancestor_shrine', label:'立宗庙' }`（:69）、`ascendBlurb:'宗庙既立，百业并兴——正式立国。'`（:70）；表现处 `UIScene.ts:79-83`（`toast.show('国格晋阶 · '+blurb,'info',3200)`） | ◐ **语义最强**（宗庙＋登阶＋百官拜＋鼎＋香烟＝prompt 五要素全中），但**表现面不匹配**：晋阶是右下角 Toast，插不进 800×450 插画；改走 `TransitionScene` ＝ 把"不打断经营流"的晋阶反馈升成全屏阻塞过场，属 UX 取向变更（同屏还有 `onActChanged`/`onUltimatumStarted`/`onTianxia` 三条 Toast，`UIScene.ts:84-100`，一并重排才不自相矛盾）⇒ **交人工，本稿不代选** |
| 同一条跳变旁白的后半句 | `storyChapters.ts:160`「你**受推为王，立宗庙、定都邑**，是为开国之君。」 | ◐ 语义成立但**被 3.1 挤掉**：`TransitionData.imageKey` 是单值（`TransitionScene.ts:33/:52`），一屏只能一张图。要给同一屏配两张图＝改 `TransitionScene` 支持逐行配图＝超出"接线"范围 |
| `evt_a_heir_dispute`「嫡庶之争」 | `eventsExpanded.ts:178-183`（choices 立嫡 / 立庶） | ❌ **剧透否决**：画面上已经有人受拜登阶，等于替玩家选完继承人 |
| `evt_s_ch6_title`「从天子到书记官」 | `storyEvents.ts:1062-1067`（拒尊号、改称公议书记） | ❌ **反义否决**：事件讲的是废礼仪，配图是礼成 |
| `evt_s_ch7_throne`「空椅与一本书」 | `storyEvents.ts:1233-1245`（撤龙椅） | ❌ **反义否决**：`ending_gong` 图（`gen_portraits_events.py:83+`）才是这一屏该用的画，而它已在 `evt_art_ending_gong` 名下 |
| `evt_b_festival`「春祭大典」 | `eventsExpanded.ts:577-580` | ❌ 主祭≠即位；且它抢的是 coronation 图的"宗庙"要素而非"登阶受拜"要素，用两次就贬值 |

### 3.3 `feast` —— **三键里唯一连合格候选都没有的**

| 候选 | 锚点 | 判定 |
|---|---|---|
| `evt_emissary`「邻邦遣使」的选项「设宴款待，缔交盟好」 | `events.ts:26/:40`，而 `:27` 已挂 `illustrationKey: 'evt_art_diplomacy'` | ❌ **粒度否决**：宴饮发生在**选项层**，`CourtEventChoice`（`schema.ts:210-217`：text/textPlain/effects/removeEffects/storyAxisDelta）**无插画字段**。要接通须把插画粒度从事件降到选项＝`schema` ＋ `EventModal`（:271-276 的面板高度算式随 `illusH` 变化）**双改**，远超接线 |
| `evt_s_ch3_last_drink`「一壶烧刀子」 | `storyEvents.ts:490-499`（老将摆一桌酒等旧友来抓自己） | ❌ 语义相反：prompt 是钟磬乐伎的**宫廷盛宴**，此景是两个人的断头酒；配盛图会消解事件的分量 |
| `evt_s_ch5_cabinet`「偏殿一顿饭」 | `storyEvents.ts:837-846`（`descPlain`：「没开朝会，就在小偏殿吃顿家常饭、直呼其名谈正事。礼官皱眉：君不君，臣不臣。」） | ❌ **文案自我声明为反礼制**，与"court banquet＋musicians"正面对打 |
| `bb_11`（丰收后百姓在祖庙前设宴） | `breathingContent.ts:62` | ❌ 它是 `kind:'bulletin'`（`BreathingKind = 'toast'|'bulletin'`，:7），走呼吸报文通道，不构造 `CourtEvent`、不进 `EventModal` ⇒ **没有 `illustrationKey` 可挂** |
| 新增一条宴饮朝议事件 | — | ◐ 可行但属**内容生产**（要给 effects/触发条件/半文半白文案并过 copyBias），不在接线设计范围 ⇒ 若走此路，建议与 coronation 的"新造事件"出口并一单，别拆两单 |

## 四、推荐落点与 diff 草案（一行式；**本单不落地**）

### 4.1 `unification`（推荐立即接线）

```diff
     const data: TransitionData = {
       lines: DYNASTY_TRANSITION_NARRATION,
+      imageKey: 'evt_art_unification', // c922-1xx：一统跳变配图（artManifest:71 在册、BootScene 已加载；缺图则 TransitionScene:52 静默回退纯文字）
       onDone: () => {
```
- 落点：`src/renderer/scenes/GameScene.ts:116` 之后插 1 行。**零 data 改动、零 manifest 改动**（不触 C1 `dataLayerBoundary`，不触 C2/C3 清单契约，不触 C4 条目和式，`LOAD_SOURCES` 63 条不变）。
- 风险面：仅 `artManifestEvtArtUsage.test.ts` 三例（§五），**必随本 diff 同批改**，否则提交即红。
- 视觉前提：`TransitionScene` 走全屏（:61-62 `add.image(0,0,key).setOrigin(.5,.5)` ＋ :95-96 按源图尺寸缩放适配），800×450 事件图与结局图同规格（结局三键同路径同尺寸已在用），故尺寸适配已被现网验证过一轮。

### 4.2 `coronation`（**不选边**，三条出口交裁决）

- 甲：晋阶 Toast 升级为过场配图（动 `UIScene.ts:79-83`，UX 取向变更，牵同文件另三条 Toast 的一致性）；
- 乙：新造一条"即位于宗庙"朝议事件（内容域，须过 copyBias，且要回答"为什么游戏里有一个登基事件而剧情序章也讲一遍"）；
- 丙：删键退役（成本见 §五之 3——**不免费**，且画与 prompt 是不可再生资产）。

### 4.3 `feast`（推荐走丙＝裁决退役，但**本单不删**）

理由：无宿主（§3.3 五选全否），且"为挂图而改 schema 粒度"的代价与收益不对称。
⚠ **不要用「`required: false` 挂着」当低成本折中**：`artManifest.test.ts:75-82` 把非 required 集**逐名锁定**为两型建筑（`NO_OWN_ART`），加一个名字＝改例外集契约（c922-110 C3 已取证）。真要走"保留但暂不接"，唯一低风险形态是**在本设计稿登记为待宿主**，清单原样不动。

## 五、c922-10 三面互等断言的翻桩迁移（**变异探针实测**，非推演）

探针做法：把 §4.1 那一行**临时**插入 `GameScene.ts:116` 之后 → 跑 `npx vitest run src/renderer/data/__tests__/artManifestEvtArtUsage.test.ts` → 按原始字节还原。

```
vitest rc = 1
❯ ② 静态引用键 ⊆ EVENT_ART 清单 → expected ['evt_art_battle', …(4)] to deeply equal ['evt_art_battle', …(3)]   （源码面多出 evt_art_unification）
❯ ④ 三键零引用现状钉桩        → expected ['evt_art_coronation', …(1)] to deeply equal ['evt_art_coronation', …(2)]  （zeroRef 3→2，正确收缩）
❯ ⑤ 用量对账合计              → expected [ 5, 3, 2 ] to deeply equal [ 4, 3, 3 ]
✓ ① 覆盖面自证、✓ ③ 动态前缀 未红
还原：RESTORE md5 equal = True；git status 8 项＝开工同数
```

迁移结论（落地单照此改，**别删断言了事**）：

1. **② 的红法暴露了 c922-10 的口径边界**：它的等式 `源码面 == 数据面` 把"任何 src 里的 `'evt_art_*'` 字面量"都当作**绕过数据层的硬写**（该例注释原话）。而 §4.1 的接线**合法地**发生在 scenes 层——轨 B 本就不该有数据面。⇒ 正确改法是把两面模型升级为**三面**：`事件面（EVENTS.illustrationKey）` / `过场面（src 里的非 ending 字面量）` / `动态后缀面（ending 模板）`，并令三者**互斥**（一个键不得同时出现在前两面）。**若只是把 unification 加进 `fromData` 的期望长度，就把这条守卫的原始目的（抓硬写）废掉了。**
2. **④/⑤ 接线后必须换成零容忍形**：三键全部接通后 `zeroRef` 应为 `[]`，`expect(zeroRef).toEqual([])` 反而是**更强**的守卫（此后任何"加图不接线"的新键立刻漂红）。⚠ 沿用 c922-110 §四 头号风险口径：新的"消费面"取数**不许与被测面同源**——不可改成"从 `EVENT_ART` 自己派生消费集"（那是自比假绿），必须继续走 `readFileSync`＋去注释＋排除定义面的源码轨（c922-10 已实测该轨首轮因未排除 `artManifest.ts` 而 size=10 假绿，降噪三招是既有资产，别重犯）。
3. **删键路径（丙）的翻桩面更大**：`EVENT_ART` 10→7 会连带红 ① 的两条（`MANIFEST_KEYS` 10→7、盘上 `public/art/events/*.webp` **仍是 10**）、`artManifest.test.ts:39` 的 `toHaveLength(55)`→52、`bootLoadList.test.ts:168` 的 `expect(total).toBe(63)`→**60**（event 源贡献 10 条）、`artManifest.test.ts:75-82` 的 `required` 53→50。**且删完留下 3 张盘上有图、清单无键的孤儿**——而 `scatterDiskReconcile`（c922-107）的反向哨兵**只扫 `public/art/scatter` 且只看 `.webp`**，事件目录**现无盘→键守护**（c922-109 §四已证同一失明面）⇒ 删键必须**同批删图或同批补一条 events 目录反向哨兵**，否则是把可读的失配变成不可读的失配。
4. **数据侧接线（若某键最终挂在事件上）的红法不同**：`fromData` 5→6、去重集 4→5、`staticKeysFromSource` 同步增长 ⇒ ② 的等式仍成立、④⑤ 收缩，红例数与上表同为 3 但**②不会红**。这条差别值得写进落地单，避免误以为两种接法可复用同一份改桩。

## 六、与 c922-10 / c922-110 / c922-109 的衔接

- **c922-10（`54e89a4`）**已钉死「资产在盘、`required:true`、消费者缺」＝**不是缺图**，本稿接受该结论为前提高度：故本稿全部力气花在"该挂哪儿"，不再复核 10 键与盘的对应。其⑤的 `10=4+3+3` 是 §五 的改动对象，其②的双轨降噪手法是 §五.2 的复用资产。
- **c922-110（P1-4 权威化）** §九.3 明文把「EVENT_ART 循环 :69-72 本地重拼 URL」列为**待裁决的病灶第三面**——与本单**正交但不冲突**：本单只加消费者，不动 `path` 的来源；**落地单不得顺手把 `BootScene.ts:69-72` 改成读 `asset.path`**，那属 P1-4，且会撞 §四(自反式假绿)风险。两单各自一提交，先后皆可（无相互翻桩：本单不碰 `LOAD_SOURCES` 的 63 条与 `ART_MANIFEST` 的 55 条）。
- **c922-109（manifest_portraits 孤儿）**：`public/art/manifest_portraits_*.json` 里正存着这三张图的**首次出图记录**（`id: feast/unification/coronation`，`saved: .../art/events/*.png`，实测 `rg -n -i "coronation|feast|unification" public/art/*.json` 7 处命中：三键各 1 条 `id` 加 1 条 `saved`，另 `feast` 在第二份 json 里重复出现一次）。⇒ 若走 §五.3 的删图路径，会把「资产＋出图流水」一起抹掉，可逆性最差；这也是本稿对"删"字保守的实证依据之一。

## 七、copyBias 口径自证（构造性）

`copyBias.test.ts:14` 的禁用字集是 14 个汉字（畿耒耜胄黔嵎泌镞鏖诰敕漕窳筚沤），扫描面为 `BUILDINGS/POLICIES/DECREES/RELIC_CHAINS/endgame/STORY_EVENTS` 的 `name/tierName/desc/descPlain/text/textPlain/title` 等**文案字段**（:31-49），**不含 `illustrationKey`**。本稿任一方案的落点都是 `imageKey`（scenes 层）或 `illustrationKey`（ASCII 纹理名），**不改任何文案串** ⇒ 过该判据是构造性成立，无需豁免。
（若日后走 §3.3「新增宴饮朝议事件」，那条事件的 title/desc 就要真过 copyBias 与「半文半白」铁律——那是内容单的事。）

## 八、交人工／主班裁决点

1. `coronation`：甲（晋阶 Toast→过场，UX）／乙（新造内容）／丙（删键＋删图＋补反向哨兵），三选一。
2. `feast`：本稿推荐丙（退役），但**删图与清单**均不在执行班授权内；若接受"长期待宿主"，则维持现状＋本稿登记即止。
3. `unification`：§4.1 是否直接开落地单（1 行生产码＋§五.1/.2 的改桩）。
4. 三条 Toast/过场反馈的一致性重排（§3.2 甲的连带面）是否立成新单——本稿只点名，不评估。

## 九、本单自证（零实施）

- **不写「零文件改动」**（本单产出本身是新档）；判据按 05:5x 新口径：**`git diff --name-only -- src/` 不超出在册在途集**。
  实测（写作前后各一次）：`git diff --name-only -- src/` → 恰为他班 4 件在途 `MapRenderer.ts` / `BuildPanel.ts` / `state/__tests__/saveGuard3.test.ts` / `state/__tests__/saveLoad.test.ts`，**本单零新增**；`git status --porcelain` 收班 8 项＝开工 8 项。
- 变异探针的还原自证四步：原始字节 `md5 2101e4e332157c497f47b8a77031cac3`（29608 B，**纯 CRLF 611 行／0 bare LF**）→ 还原后 `md5sum` 同值 → `grep -n "MUTATION-PROBE"` exit=1（无残留）→ `git add` 精确路径后 `git diff --cached --quiet HEAD` **rc=0**（blob 未变；未用 `git checkout --`）。
- 本单**未跑全量测试**：零生产码改动，且变异探针当场已跑过被牵动的那一族（§五 读数）。全量现值沿用主班 05:5x 在册 1338 例 @ `e04e278`，按 05:0x「中途不回写基线档」口径**未回写**任何基线档。
