# colony 字体链路缺口核查（@font-face 指向空目录 · c922-111，2026-09-22T04:2x）

> 性质：**只读盘存＋钉现状＋建议**，本单不补资产、不删声明、不改 `palette.ts`（`git diff --name-only src/` 见 §十）。
> 结论一句话：**三处 `@font-face` 指向的 `public/fonts/` 是空目录且从未入库，全部 UI 实际走系统字体**；
> 而缺口在本机**看不见**（这台机器装了 Noto SC 系统字体），并且**方案一（补 otf）单独做也不生效**（构建产物的绝对路径问题，§六）。

## 一、现场读数（先命令后数字）

```
$ ls public/fonts/            → （无输出）      $ ls public/fonts/ | wc -l        → 0
$ ls public/atlas/            → （无输出）      $ ls public/atlas/ | wc -l        → 0
$ ls public/fonts/ public/atlas/ | wc -l        → 3   ← 任务书该条按字面读不可满足
```

**口径更正（重要，否则下一班以为数错）**：`ls` 带**两个**目录参数时必打两行目录头 ＋ 一行空行 ＝ **恒 3 行**，
与目录是否为空无关。任务书完成标准写的「→ 0」只有**逐目录各跑一次**才成立（本档上方两行即各证一次：`public/fonts/` 0、`public/atlas/` 0）。
两目录 mtime 均为 `May 28 22:07`，且 `git ls-files public/fonts public/atlas` → **0**
（空目录不可能被 git 跟踪）⇒ **干净 clone 里这两个目录根本不存在**，连「空目录」这个占位都不在库内。

```
$ rg -c "@font-face" src/renderer/index.html
3
$ find . -name '*.otf' -not -path './node_modules/*' | wc -l
0        # find 退出码 = 0（find 无命中不置非零，别把 exit=0 读成“找到了”）
$ find . \( -name '*.otf' -o -name '*.ttf' -o -name '*.woff*' \) -not -path './node_modules/*' -not -path './.git/*' | wc -l
0        # 全仓零字体资产（连 ttf/woff 都没有）
$ git log --all --oneline -- '*.otf' '*.ttf' '*.woff*'
（空）    # 从未有任何字体文件入库 ⇒ “Kimi 反审 #7e 字体放 public/fonts”的意图确实从未兑现
$ rg -c "@font-face" src/renderer/scenes/BootScene.ts
1        # 这 1 处是注释提及（:11「file:// 下 @font-face 有 CORS 风险」），非声明面；声明面 3 处全在 index.html
```

## 二、声明面盘存（3 个 @font-face ＋ 1 个 body CSS ＋ 1 个 DOM 输入框）

| 锚点 | 内容 | 判定 |
|---|---|---|
| `index.html:12-18` | `@font-face 'Noto Serif SC'` → `url('/fonts/NotoSerifSC-Regular.otf')` `format('opentype')` weight 400 | 指向缺文件 |
| `index.html:19-25` | 同族 weight **700** → `/fonts/NotoSerifSC-Bold.otf` | 指向缺文件 |
| `index.html:26-32` | `'Noto Sans SC'` weight 400 → `/fonts/NotoSansSC-Regular.otf` | 指向缺文件 |
| `index.html:43` | `body { font-family: 'Noto Sans SC', system-ui, sans-serif }` | **唯一会真正触发字体请求的 DOM 消费点**（当前 404） |
| `IntroScene.ts:243` | DOM 输入框内联 `font-family:'Noto Serif SC','Source Han Serif SC',serif`（`add.dom().createFromHTML`，真 DOM 节点） | Serif 族的唯一 DOM 消费点，且只在序章出现 |

任务书锚点 `index.html:14` 未漂（`src:` 行确在 :14）。

**锚点不全 1 处**：任务书写「FONTS 常量两族（`palette.ts:52/58/64`）」，
实为 **7 处 `fontFamily`**——Serif 族 **:52 `title` / :58 `panelHeading` / :86 `glyph`**，
Sans 族 **:64 `body` / :69 `number` / :75 `small` / :80 `smallDim`**（键名与行号已逐行 `awk` 实读核对）。
锚点只列了前三处 ⇒ 按磁盘实况扩列如下。

### 对照表：`palette.ts` 两族 ↔ `@font-face` 声明族 ↔ 本机实际命中

| FONTS 条目（行号） | 声明的族链 | 有对应 @font-face？ | 本机（本台 dev 机）实际命中 | 干净 Windows 命中（推演，见 §五） |
|---|---|---|---|---|
| `title` :52、`panelHeading` :58、`glyph` :86（Serif 族 3 处） | `"Noto Serif SC", "Source Han Serif SC", serif` | **有**（但 404，且 canvas 不参与加载） | **系统已装的 `Noto Serif SC`**（`NotoSerifSC-VF.ttf`） | 无 Noto 时装 `Source Han Serif SC` 者（本机只有 **Heavy** 一档，家族名精确匹配存疑）→ 否则 `serif` 通用族 → 中文落到 **SimSun/宋体** |
| `body` :64、`number` :69、`small` :75、`smallDim` :80（Sans 族 4 处） | `"Noto Sans SC", "PingFang SC", sans-serif` | **有**（但 404） | **系统已装的 `Noto Sans SC`**（`NotoSansSC-VF.ttf`） | `PingFang SC` 是 **macOS 专有**（本机注册表实测 ABSENT）→ `sans-serif` 通用族 → 中文落到 **Microsoft YaHei/微软雅黑** |
| `index.html:43` body CSS | `'Noto Sans SC', system-ui, sans-serif` | 有（404） | 同上 | `system-ui` → Segoe UI（无中文字形覆盖则回落雅黑） |
| `IntroScene.ts:243` 输入框 | `'Noto Serif SC','Source Han Serif SC',serif` | 有（404） | 同上 | 同 Serif 行 |

⇒ **三条链没有一条经 @font-face 生效**；Serif 族今天在本机呈现「像是对的」，是因为**这台机器把 Noto SC 装进了系统字体**，
与仓库无关。**换一台没装 Noto 的 Windows，字面标题会从宋体衬线变成 SimSun、无衬线变成雅黑** —— 视觉评审的证据不可迁移（§四）。

**声明形态与现行发行不符（方案一的隐藏前置之二）**：本机实测已装的是**可变字体**
`NotoSerifSC-VF.ttf`（23.97 MiB）＋`NotoSansSC-VF.ttf`（16.95 MiB），即 `.ttf`/TrueType 容器、单文件覆盖 400-900 全字重；
而 `index.html` 要的是 **`.otf` + `format('opentype')` + 拆开的 Regular/Bold 两个文件**。
⇒ 即便补资产，也要同时改文件名与 `format()`（或改回 `truetype`／`woff2`），照旧声明去补 `.otf` 只是重演一次 404。

## 三、消费面分面（为什么「canvas 用不上 @font-face」这条要单列）

1. **DOM 面**：`index.html:43` 与 `IntroScene:243` 是 DOM，浏览器会去 fetch → 当前 **404**，静默回退。
2. **Canvas 面（游戏文字的绝大多数）**：`palette.ts` 的 `FONTS.*.fontFamily` 是给 **Phaser `Text`（canvas 2D `fillText`）** 用的样式串。
   canvas 字体解析**只看「已加载完成的字体」**，不会因为你在 `fillText` 里写了族名就去触发 webfont 下载。
   ⇒ **即使把 4 个 otf 放进 `public/fonts/`，若没有任何 DOM 元素先用它，canvas 首帧仍可能拿到回退字体**（FOUT 之后是否回流取决于浏览器与 Phaser 重绘）。
   这条决定了方案一必须连「显式 `document.fonts.load()` 或隐藏 DOM 预载」一起考虑，不能只补文件。
3. **BootScene 的等字体守卫今天是空转**：`BootScene.ts:89` `await document.fonts.ready`（:11 注释自述其动机是 file:// CORS 风险）。
   在**零个 face 成功加载**的状态下该 promise 立即 resolve ⇒ 这道守卫**没有可守的对象**。
   它不构成崩溃，但意味着「序章首帧文字已经是我们以为的那套字体」这句话目前**没有任何证据支撑**。

## 四、对「单帧不判小作坊」基线的影响（这是本单最实用的一格）

锚点在案：`docs/design/OPTIMIZATION_BACKLOG.md:63`（P3-3 地形与 UI 皮精修「按『单帧不判小作坊』基线自检截图」）、
`docs/decisions/2026-08-14-proposal-state-analysis-and-direction.md:84`、
`docs/insights/colony-optibacklog-status-draft-20260922.md:18/:113`（c922-19 已判 **⚑不可判：需人眼看图、无客观文件锚**）。

本单在其上补一条更具体的：**该判据的截图证据还被机器字体污染**。

- 现状是「本机装了 Noto SC」⇒ 任何在本机截的单帧，展示的是**目标视觉**，而不是**装机用户会看到的视觉**。
  于是 P3-3 那种「看一帧判质感」的评审会**系统性偏乐观**，且偏差量级正好是整个中文衬线字形（宋体 vs 思源宋体）。
- 反向也成立：**在没有 Noto 的机器上截图，会把系统字体缺失误判成“美术/排版做差了”**。
- 出口（不属本单实施）：视觉类评审单应先跑一次「字体命中自检」（读 `document.fonts.check('16px "Noto Serif SC"')` 或截图像素级比对），
  并在截图档里记录**取图机器的字体集**。这属规划/评审域，本单只登记前提失效，不代判 P3-3。

## 五、本机实测 vs 推演（口径显式分开）

实测（注册表 `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts`，170 条值，`winreg` 直读，零写操作）：

| 家族 | 命中 | 文件 | 体积 |
|---|---|---|---|
| Noto Serif SC | **HIT** | `NotoSerifSC-VF.ttf` | 23.97 MiB |
| Noto Sans SC（＋Bold/Medium） | **HIT** | `NotoSansSC-VF.ttf` | 16.95 MiB |
| Source Han Serif SC | HIT（**仅 Heavy 一档**） | — | — |
| PingFang SC | **ABSENT** | — | — |
| SimSun / SimHei / KaiTi / Microsoft YaHei | HIT | `simsun.ttc` / `simhei` / `kaiti` / `msyh.ttc`（18.79 MiB） | — |

推演（**未经浏览器目检或 Playwright 取证**，本仓无 playwright/puppeteer，实测手段不成立，故只作分析不作结论）：
「干净 Windows 上 Serif→SimSun、Sans→Microsoft YaHei」是**由 CSS 通用族 `serif`/`sans-serif` 在 zh-CN 环境的常规回退次序推得**，
且本机已装 SimSun/雅黑恰好使该推演**无法在本机被否证**。要落这条需一台无 Noto 的机器或 Playwright 计算样式，登记给视觉域单。

## 六、构建面实测：补了 otf 也拿不到（方案一被这一格卡住）

```
$ rg -c "url\('/fonts/" dist/renderer/index.html
3                                   # 构建产物里三条绝对路径原样保留，未被重写
$ grep -n 'src="./assets/' dist/renderer/index.html   → :59 ./assets/index-9DOBpPPC.js   （同文件里脚本却是相对路径）
$ ls dist/renderer/fonts/          → （空）            $ find dist -name '*.otf' | wc -l → 0
$ rg -n "publicDir" electron.vite.config.ts → :46  publicDir: resolve(__dirname,'public')
$ rg -n "loadFile|loadURL" src/main/index.ts → :145 loadURL(ELECTRON_RENDERER_URL)（dev）／:147 loadFile('../renderer/index.html')（prod）
```

⇒ 生产态经 `loadFile` 以 `file://` 打开时，CSS 里的 `/fonts/x.otf` 解析到**盘根**（`file:///D:/fonts/...`），
而 Vite **只重写了带 hash 的产物引用**（`./assets/…`）、**没有重写内联 `<style>` 里的绝对 `/fonts/`**。
即：`Kimi 反审 #7e` 注释声称的「字体放 `public/fonts/` 而非 `src/`，避免 Vite 打包后 file:// 路径错位」这一手段，
**实测并未避免错位**（dev 经 vite server 时 `/fonts/` 才对）。
⇒ **方案一必须连带把三处 `url('/fonts/…')` 改成相对口径**（`./fonts/…` 或经 Vite 资产管道），只丢文件进目录是无效动作。

## 七、CSP 面：外链 webfont 被现有策略拦死（方案三的前置）

```
$ sed -n '6,7p' src/renderer/index.html
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; …" />
```

`font-src 'self' data:` ⇒ 任何 `fonts.googleapis.com` / `fonts.gstatic.com` 的远程字体**一律被拦**。
方案三若要落地需同时改 CSP（开远端域），而离线桌宠式 Electron 客户端引入网络字体源＝
断网即回退、且把「字体面」变成依赖外网的运行时风险。若改为**自托管 woff2**，那实质上就归并到方案一（只是容器更省）。

## 八、门禁失明面（改动为什么"便宜"、现状为什么"没人发现"）

```
$ rg -n "fontFamily|Noto|font-face" src/ --glob '*.test.ts'   → 0 命中
```

全库测试**对字体面零断言**：`fontSizeGuard.test.ts` 只守「中文不得 <14px」的字号、`paletteGuard.test.ts` 只守色值，
都没读 `fontFamily`。⇒ 两个方向都成立且都要记账：
① **任何一方案的改动都是零测试红**（成本极低、也极易「悄悄改了没人知道」）；
② 现状缺口不会自己报警，这正是它从 6/19 存活到今天的原因。建议采纳方案后**补一条最小哨兵**（见 §九「配套」）。

## 九、三案建议（核查+建议级，本单不实施）

| 案 | 动作面 | 真实体积代价 | 版权 | 回滚 | 判断 |
|---|---|---|---|---|---|
| **一 补资产** | `public/fonts/` 放文件 ＋ **§六 的路径口径修正** ＋ **§二 的 format/文件名修正** ＋ §三 的显式预载（防 canvas FOUT） ＋ `@font-face` 数量可能从 3 减为 2（VF 单文件含全字重） | 若照本机已装的那套 VF 全量入包：**40.91 MiB**（`23.97＋16.95`）——而 c922-14 正在为 54.97 MiB 的 BGM 做**减重**，加 40 MiB 字体是反向操作，dist 会从 73.92 MiB 涨到 ~115 MiB。务实做法＝**按 GB2312/CJK 常用 3500 字子集化 woff2**，量级降到每档数百 KB（子集化属工具链动作，需单独授权） | 思源系（Source Han Serif/Sans）与 Noto CJK **同源、SIL OFL 1.1**，可再分发、须随包保留 OFL 许可文本 ⇒ 需新增 `licenses/` 一条。**注意 OFL 的保留义务**（不保留＝许可证瑕疵，比体积问题更硬） | 资产与 3 行 CSS 同提交，`git revert` 即回；字体文件一旦入库即永久留在历史（**体积不可回收**），这是本案唯一的单向门 | 视觉目标要它，但**不能只做一半**（只补文件＝§六/§二 两处不修则仍然 404，等于白加 40 MiB 进历史） |
| **二 删声明、走系统字体** | 删 `index.html:12-32` 三个 `@font-face` ＋ 把 `palette.ts` 的 7 处族链改成「通用族优先」（如标题 `serif`、正文 `system-ui, sans-serif`）；`index.html:43`、`IntroScene.ts:243` 同步 | 0（产物反而更干净） | 无（不引入任何第三方字形） | 纯文本改动，一次提交 `git revert` 干净 | **代价最低、语义最诚实**：把「我们并没有这套字体」写进代码事实。副作用＝视觉基线变化（标题变宋体系），需一次目检确认是否可接受，且与方案一的取舍本质是**产品决定而非工程决定** |
| **三 改 webfont（外链）** | 引 Google Fonts ＋ 放宽 CSP `font-src` | 包体 0，运行时按需下载（子集化后首屏数百 KB） | 同 OFL（由 Google 分发，仍建议随包留许可声明） | 改 CSP ＋ 加 link 两行，revert 即回 | **不推荐**：离线客户端引入外网字体源＝断网即回退，且 §七 的 CSP 是现成的安全收口，为了一个字体把它开洞不划算；若只是想要 woff2 收益，走方案一的自托管子集形态即可 |

**配套（任一方案都建议做，成本一行）**：补一条最小字体哨兵，把 §八 的失明面堵上——
断言「`@font-face` 里出现的每个 `url()` 都能在 `public/` 下 `existsSync`」，或反向断言
「`index.html` 不得出现 `/fonts/` 绝对路径」。范式照抄 `bootLoadList.test.ts` 的 `existsSync` 轨与 `scatterDiskReconcile` 的反向轨即可，**不必新造判据**。

**推荐**：若产品要求衬线中文观感 → 方案一（**子集化 woff2 ＋ 修路径 ＋ 修 format ＋ 预载 ＋ 许可留档**，五件一起做，缺任一件即无效或留隐患）。
若只要求「不装 Noto 的用户也别掉进宋体反差」→ **方案二**（一次纯文本提交，零体积、零版权负担），
并把「真上定制字体」留给美术域单独立项。两案**都不该顺带**在本单做。

## 十、本单零改动自证

```
$ git diff --name-only src/
（4 个文件，全部在册他班在途件：MapRenderer.ts / BuildPanel.ts / saveGuard3.test.ts / saveLoad.test.ts —— 本单一个未碰）
$ npx tsx -e "…仅只读：注册表 + os.path.getsize + readdir"   → 无任何写操作
$ find public/fonts public/atlas -mindepth 1 | wc -l → 0（收尾复验：两目录仍空，探针未在其中留件）
```

（说明：任务书完成标准末条「本单零改动（git status 归零）」与「产出＝新增本 insight 档」不可兼得，
按同波 c922-102 的口径读作「不伤资产、不留游离改动」：本单产出件经 pre-commit 入库后，
`git status --short` 回到开工的 8 项＝他班 7 项＋未跟踪 `.audit-b151-tmp/`。）

## 十一、待人工／主班裁决点

1. 走 §九 的方案一还是方案二（**产品/美术决定**，不是工程决定）。
2. 若方案一：允许向仓库永久写入多少 MiB 字体（子集化范围＝GB2312 全集／常用 3500 字／仅标题用字），
   以及与 c922-14 减重方向的对账口径（两者目标相反，需一次总量预算拍板）。
3. 字体许可文本随包保留的落点（新增 `licenses/` 属新建文档域，执行班未擅自建）。
4. 是否补 §九「配套」那条字体哨兵测试（属执行班可为，但它会把方案一的实施口径写死，故同样等拍板）。
5. `public/atlas/` 同为空目录且未被跟踪，但它是 `scripts/pack-sprites.mjs` 的输出目录，
   该工具的死活已在箱 `c922-112-packsprites-deadtool` ⇒ **本单不并入、只指个方向**，避免跨单抢判据。
