# colony START_HERE 域计数漂移快照（R8 前置证据 · 2026-09-23）

> 班：`qoder-executor-20260923-0022-colony13`／单：`c923-34`／HEAD 取值时刻：`51d3b34`（本机 18:34）
> **本单零写**：`docs/design/00_上手须知_START_HERE.md` 一字未改、`scripts/domain-counts.mts` 一字未改。R8 仍未放行（台账 `colony-plan-ledger-20260922.md:115`），本文只是为**用户的放行决策**备实测证据，不代改。

## 一、结论（三句）

1. **五域现值**（实跑，非抄档）：建筑 35／国策 39／朝令 12／沙盒事件 48／故事事件 35。
2. **START_HERE 域计数面现漂 3 项**（国策 23→39、沙盒 40→48、故事 23→35），三项**全是文档低估**，落点全在**第 50 行**；另第 51 行还有 1 处**取数脚本看不见**的漂移（`:51` 剧情事件 23→35，见第四节）。**同一批行上还另成一族测试计数漂移**：`1154` 6 处／4 行、`91 文件` 2 处／2 行——这一族 r917-32（文内自述生成于 2026-09-20）已列过同一组行号，本单只复算确认它三天未变，见第五节②。
3. **取数工具本身从未接线**（实测，见第五节④）：`--check` 不进门禁、不进 npm scripts、不进 pre-commit，仓内**连 CI 配置目录都不存在** ⇒ 这条漂移链**没有任何自动看守**。这正是"9/17 落笔 → 9/23 已漂 3 项"的结构性原因，也是**放行决策真正该拍的那一块**：只改数字而不接线，等于预约下一份同样内容的快照（第五之二节已给出现成可粘贴部分与其过期处）。

## 二、两遍命令与退出码（全文照抄）

```
$ cd D:/code/colony-game
$ npx tsx scripts/domain-counts.mts ; echo rc=$?
```

```
# 内容域五计数（事实源＝数组 .length；生成于 c922-07 脚本 scripts/domain-counts.mts）
建筑 BUILDINGS = 35
国策 POLICIES = 39
朝令 DECREES = 12
沙盒事件 BASE+EXPANDED = 48
故事事件 STORY_EVENTS = 35
合并集 EVENTS = 83 （= 基础 8 + 扩展 40 + 故事 35，非「沙盒」口径，别填进 START_HERE）

# 对照 docs/design/00_上手须知_START_HERE.md 「已跑通」行
声称原文：- 🟢 **已跑通**：资源/建筑(35)/国策(23)/朝令(12)/事件(沙盒40+故事23)/邦交(NPC动态成长)/存档(游戏内三槽 UI)，**1154 测试 + type-check 干净**（2026-09-17 实测：91 文件 / 1154 用例全绿）。
✓ 建筑：START_HERE=35 实测=35
✗ 国策：START_HERE=23 实测=39 （漂 +16，正数＝文档低估）
✓ 朝令：START_HERE=12 实测=12
✗ 沙盒：START_HERE=40 实测=48 （漂 +8，正数＝文档低估）
✗ 故事：START_HERE=23 实测=35 （漂 +12，正数＝文档低估）

漂移 3 项。订正口径见本输出，或整行改写为「域计数运行 npx tsx scripts/domain-counts.mts 取当前值」。
rc=0
```

第二遍加 `--check`（**输出与第一遍逐字节相同，只差退出码**）：

```
$ npx tsx scripts/domain-counts.mts --check ; echo rc=$?
（正文与上完全一致，略）
rc=1
$ diff <(npx tsx scripts/domain-counts.mts 2>&1) <(npx tsx scripts/domain-counts.mts --check 2>&1) ; echo diff-rc=$?
diff-rc=0
```

⇒ 脚本第 9 行「`--check` 仅影响退出码」**实测成立**（无 flag rc=0 恒不拦；`--check` 下漂移 3 项 ⇒ rc=1）。

### 独立交叉复算（不信打印器自己）

```
$ npx tsx --input-type=module -e "import { BUILDINGS } from './src/renderer/data/buildings.ts'; import { POLICIES } from './src/renderer/data/policies.ts'; import { DECREES } from './src/renderer/data/decrees.ts'; import { EVENTS } from './src/renderer/data/events.ts'; import { ALL_EXPANDED_EVENTS } from './src/renderer/data/eventsExpanded.ts'; import { STORY_EVENTS } from './src/renderer/data/storyEvents.ts'; const dup=(a,label)=>{const s=new Set();const d=[];for(const x of a){if(s.has(x.id))d.push(x.id);s.add(x.id)}return label+': len='+a.length+' uniqId='+s.size+(d.length?' DUP=['+d.join(',')+']':' nodup');}; console.log(dup(BUILDINGS,'BUILDINGS')); console.log(dup(POLICIES,'POLICIES')); console.log(dup(DECREES,'DECREES')); console.log(dup(ALL_EXPANDED_EVENTS,'ALL_EXPANDED')); console.log(dup(STORY_EVENTS,'STORY')); console.log('EVENTS merged len='+EVENTS.length+' sandbox='+(EVENTS.length-STORY_EVENTS.length));"
BUILDINGS: len=35 uniqId=35 nodup
POLICIES: len=39 uniqId=39 nodup
DECREES: len=12 uniqId=12 nodup
ALL_EXPANDED: len=40 uniqId=40 nodup
STORY: len=35 uniqId=35 nodup
EVENTS merged len=83 sandbox=48
```

⇒ 五值逐个复算相符，且**五个数组都无重复 id**（"数组长度被重复条目灌水"这一失效模式实测排除）。合并式 `EVENTS(83) = 基础8 + 扩展40 + 故事35` 成立 ⇒ 脚本第 24-28 行的不变量未破裂（未走 `exit(3)`）。

## 三、漂移差异表（域 → 声称值 → 现值 → 建议改的落点行号）

| 域 | START_HERE 声称 | 实测现值 | 差 | 落点 | 建议改法（**未执行**） |
|---|---|---|---|---|---|
| 建筑 BUILDINGS | 35 | **35** | 0 | `:50` | 不动 |
| 国策 POLICIES | 23 | **39** | +16（低估） | `:50` | `国策(23)` → `国策(39)` |
| 朝令 DECREES | 12 | **12** | 0 | `:50` | 不动 |
| 沙盒事件 BASE+EXPANDED | 40 | **48** | +8 | `:50` | ⚠️ **不是纯低估**：`40` 恰等于 `ALL_EXPANDED_EVENTS.length`（实测 40），即当年写的是"扩展包单项"，脚本口径是"基础8+扩展40=48"。**填 48 等于同时改语义**，见第五节裁决项① |
| 故事事件 STORY_EVENTS | 23 | **35** | +12（低估） | `:50` | `故事(23)` → `故事(35)` |
| （第 51 行·脚本盲区）剧情事件 | 23 | **35** | +12 | `:51` | 见第四节 |

**逐行原文锚点**（`grep -n` 实测，非手数；下行的 `…` 是本档为排版所截，全行原文见第二节「声称原文」）：

```
$ grep -nE '建筑\([0-9]+\)/国策\([0-9]+\)' "docs/design/00_上手须知_START_HERE.md"
50:- 🟢 **已跑通**：资源/建筑(35)/国策(23)/朝令(12)/事件(沙盒40+故事23)/…，**1154 测试 + type-check 干净**（2026-09-17 实测：91 文件 / 1154 用例全绿）。
```

## 四、工具盲区：`claimed()` 正则只钉住第 50 行的一种写法

`scripts/domain-counts.mts:38` 的解析式是
`建筑\((\d+)\)\/国策\((\d+)\)\/朝令\((\d+)\)\/事件\(沙盒(\d+)\+故事(\d+)\)`
——它**只覆盖第 50 行那一处**。实测同文件里还有一处域计数在它视野外：

```
$ sed -n '51p' "docs/design/00_上手须知_START_HERE.md"
- 🟢 **原"待建"现已落地**（本节 2026-06 大更）：国格阶梯(6级)、动态邻国(合纵/朝贡/挑拨)、故事模式(七卷23剧情事件+56报文+三结局)、…
```

`:51` 的三项实测：**`七卷23剧情事件` 已漂**（现值 35，同 `:50` 那条），而 **`56 报文` 未漂、`6级` 未漂**：

```
$ npx tsx --input-type=module -e "import * as SG from './src/renderer/data/storyGoals.ts'; import { COUNTRY_GRADES } from './src/renderer/data/countryGrades.ts'; console.log('storyGoals exports:', Object.entries(SG).filter(([,v])=>Array.isArray(v)).map(([k,v])=>k+'='+v.length).join(' ')); console.log('COUNTRY_GRADES='+COUNTRY_GRADES.length);"
storyGoals exports: CHAPTER_GOALS=7 HISTORIAN_COMMENTS=7 NARRATIVE_BULLETINS=56
COUNTRY_GRADES=6
```

⇒ **同文件自相矛盾**：`:51` 说"23 剧情事件"、`:99` 说"七卷剧情事件 23→35（每卷恰 5 条）"。`:99` 与磁盘实况一致（7×5=35=`STORY_EVENTS.length`），`:51` 是残留旧数。**若只同步 `:50` 而漏 `:51`，放行后文件内部仍自打嘴巴** —— 这是本快照最重要的补漏。

`:51` 这一处**两份在册前置件都没覆盖**（实测，非推断）：

```
$ for f in docs/insights/colony-starthere-count-check-20260917.md docs/insights/colony-test-asset-map-20260921.md; do echo "=== $f ==="; rg -n '剧情事件|51|56 报文|国格' "$f" || echo "  (无命中)"; done
=== docs/insights/colony-starthere-count-check-20260917.md
  (无命中)
=== docs/insights/colony-test-asset-map-20260921.md
  (无命中)
```

⇒ r917-32 只核「测试计数类」主张（域计数面完全没进它的对账范围），c92x 的 9/21 草稿只给第 50 行文本 ⇒ **`:51` 的 23→35 与 `:51` 两项"未漂"排除，是本快照的净新增**。

## 五、需用户/主班裁决（放行前必须定的 4 件，本单一件未动）

**① 「沙盒 40→48」要不要改口径。** 40 与 48 都是"真数"，分别是扩展包单项与基础+扩展合计（脚本第 4 行注释早就把它叫作**口径歧义**）。放行时若机械填 48，读者对"沙盒事件"的理解会从"扩展包"变成"全部沙盒事件"。→ 建议连词一起改（如"事件(沙盒48=基础8+扩展40)"），别只换数字。

**② 第 50 行还挂着两个非域计数：`1154 测试` 与 `91 文件`，也都已漂。** 文件数实测：

```
$ find src scripts -name '*.test.ts' | wc -l
138
$ git ls-files '*.test.ts' | wc -l
138
```

⇒ 91→**138**（且当前无未跟踪测试件，两口径相等；`find` 的 138 与 vitest 报的 files 列同口径）。用例数在册口径为 **1478**（主班 2026-09-23 18:3x pre-commit 实测 138 files / 1478 tests）——**本单未跑全量**（子班禁跑全量），此数按在册口径引，复算命令 `npm run test`。这一处与 `c923-20`（README 计数）**不同文件不同关切**（实测：c923-20 改的是 `README.md:78`，本单零碰 README），但**同一行**：改 `:50` 就会同时碰它，属**连带一体**，不可只同步五域而把 1154/91 留在原地。

🔴 **且这条"测试面"漂移不止第 50 行 —— 它在 START_HERE 里出现 4 行 6 处**：

```
$ grep -no '1154' "docs/design/00_上手须知_START_HERE.md"
4:1154
4:1154
25:1154
38:1154
50:1154
50:1154
$ grep -no '91 文件' "docs/design/00_上手须知_START_HERE.md"
4:91 文件
50:91 文件
```

⇒ 精确形状：**`1154` 共 6 处、落 4 行（`:4`×2、`:25`、`:38`、`:50`×2）；`91 文件` 共 2 处（`:4`、`:50`）**。

⇒ **这 4 处不是本单新发现**：`docs/insights/colony-starthere-count-check-20260917.md`（r917-32；文件名写 20260917，**文内自述生成时间是 2026-09-20T12:47:55**，两处时间不一致本身是那份件的瑕疵）§一 早已逐行列出同一组 `:4/:25/:38/:50` 并判"全部数值主张均已漂移"——本单只复算确认它**自生成起 3 天仍是这 4 行**（`1154` 现读 6 处）。**放行若只改 `:50`，剩下 3 行会继续对读者撒谎**，且 `:25/:38` 是把 1154 当**验收硬指标**写的（"1154 条必须全绿"），误导性比 `:50` 更强。

**③ 最省事方案（整行换成"运行脚本取当前值"，即脚本第 70 行自己的建议）有一个必然后果：`--check` 会永久变 rc=2。** 依据 `:58-61`：解析不到声称原文时打印"无法解析"并 `process.exit(argv.includes('--check') ? 2 : 0)`。
⇒ 也就是说：一旦 START_HERE 不再写死数字（本单的**推荐终态**），**`--check` 的语义会从"漂移=1"退化为"恒 2"**，而 2 与"脚本坏了/不变量破裂(`:28` 的 exit 3)"同属异常码。若将来要把 `--check` 接进 CI，得先想清楚 2 是不是期望值。**本单未改脚本**（"不改脚本"是本单硬约束），只把这个后果摆出来。

**④ 取数器从未接线（实测）。**

```
$ grep -n "domain-counts\|START_HERE" .git/hooks/pre-commit || echo "(pre-commit 无引用)"
(pre-commit 无引用)
```

且 `package.json` 的 11 条 scripts 里无 `domain-counts`（现役 `verify` = `npm run type-check && npm run test`），仓内也无 CI 配置引它；测试套件里对 `START_HERE` 的唯一提及是 `src/renderer/state/__tests__/copyBias.test.ts:13` 的**注释**（禁偏字铁律，与计数无关）。
⇒ **c922-07 造出这个脚本时把"终结漂移链"写进了标题，但它只终结了"人怎么数"，没终结"没人来数"**。放行决策若只改数字而仍不接线，下一批内容落地必然再漂（现文自称「2026-09-17 实测」，至 9/23 已攒 3 项域计数漂移）。

## 五之二、放行决策其实有现成出口：9/21 已写好可粘贴草稿（本单核其过期处）

`docs/insights/colony-test-asset-map-20260921.md` §六（9/21）**已经给出整行替换文本**，且同样维持"只给草稿、不改文件"：

> `- 🟢 已跑通：资源/建筑(35)/国策(39)/朝令(12)/事件(沙盒48+故事35)/邦交(NPC动态成长)/存档(游戏内三槽 UI)，`
> `  124 文件 / 1291 测试 + type-check 干净（2026-09-21 实测…域计数随时复核：npx tsx scripts/domain-counts.mts）`

本单实测该草稿的**三点状态**（决定"能不能直接粘"）：

| 草稿里的数 | 本单实测 | 判定 |
|---|---|---|
| 建筑 35／国策 39／朝令 12／沙盒 48／故事 35 | 35／39／12／48／35 | ✅ **两天零变化，五域部分可直接用**（数组法独立复算逐位相符） |
| 124 文件 / 1291 测试 | 磁盘 **138** 文件；在册 **1478** 例 | ❌ **已过期**（当日 12:54 的 c923-20 才写 133/1409，18:3x 已 138/1478）——**粘它等于把一处漂移换成另一处** |
| 只给第 50 行的整行文本 | `:51` 剧情事件 1 处 + `:4`×3 + `:25` + `:38` | ❌ **漏 4 行 6 处**（草稿未覆盖，见第四、五节） |

⇒ **给裁决的一句话**：五域数**两天没动**（内容数组是慢变量），测试面**半天动一次**（快变量，同一天内 133/1409→138/1478）。**把快变量钉进文档＝必然再漂**；草稿那行"124 文件/1291 测试"就是 9/21 当场写、9/23 已过期的活证据。**可粘的部分只剩五域那半行**，测试那半行建议一次改成指针、此后不再参与同步。

## 六、零改动自证（完成标准 ③ 先收窄，再给逐位证据）

⚠️ **卷宗原句「`git diff --stat` = 0」按字面不成立**，且不是本单造成的：开工基线的工作树里已有 **3 件他班在册在途件**（`OPTIMIZATION_BACKLOG.md` ` M`、`colony-dead-exports-20260914.json` ` M`、其 `.bak` ` D`，三件全在硬禁碰清单），裸跑 `git diff --stat` 必然打出它们：

```
$ git diff --numstat | wc -l
3          # 三行全属他班；本单两件 0 行
```

⇒ 判据按**意图**收窄为「**本单对 START_HERE 与脚本零改动**」，用精确路径 + blob sha 双证：

```
$ git diff --stat -- "docs/design/00_上手须知_START_HERE.md" "scripts/domain-counts.mts"
（空输出＝本单两件零改动）

$ git rev-parse "HEAD:docs/design/00_上手须知_START_HERE.md" ; git hash-object "docs/design/00_上手须知_START_HERE.md"
99872bd0aebd9405c23937c6643215e0963fe0f6
99872bd0aebd9405c23937c6643215e0963fe0f6   # 逐位相同
$ git rev-parse "HEAD:scripts/domain-counts.mts" ; git hash-object "scripts/domain-counts.mts"
4f118a450d81e2ea66a1a31c28b1468fa95e9200
4f118a450d81e2ea66a1a31c28b1468fa95e9200   # 逐位相同
```

旁证（size/mtime/行尾三者皆未动，且两文件纯 LF、无 mixed 行尾）：

```
$ python -c "import hashlib,os; [print(p,'sha8='+hashlib.sha256(open(p,'rb').read()).hexdigest()[:8],'size='+str(os.path.getsize(p)),'CRLF='+str(open(p,'rb').read().count(b'\r\n')),'loneLF='+str(open(p,'rb').read().count(b'\n')-open(p,'rb').read().count(b'\r\n'))) for p in ['docs/design/00_上手须知_START_HERE.md','scripts/domain-counts.mts']]"
docs/design/00_上手须知_START_HERE.md sha8=6c0d3947 size=9855 CRLF=0 loneLF=128   # mtime 仍 2026-09-20 04:57
scripts/domain-counts.mts           sha8=8c883884 size=4339 CRLF=0 loneLF=71     # mtime 仍 2026-09-21 21:53
```

收班时工作树（**唯一新增＝本文 own 件**，余三件他班原样）：

```
$ git status --porcelain        # 计数用 python splitlines，不用 wc -l（末行无换行会少计）
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
?? docs/insights/colony-starthere-drift-20260923.md   # ← 本单产物（项数 3→4）
```

## 七、复算一遍（任何人 30 秒）

```
$ cd D:/code/colony-game
$ npx tsx scripts/domain-counts.mts ; echo rc=$?          # 期望 rc=0，漂移 3 项
$ npx tsx scripts/domain-counts.mts --check ; echo rc=$?  # 期望 rc=1，正文逐字节相同
$ grep -nE '建筑\([0-9]+\)/国策\([0-9]+\)' "docs/design/00_上手须知_START_HERE.md"   # 落点行号
$ sed -n '51p' "docs/design/00_上手须知_START_HERE.md"    # 脚本盲区的第 4 处漂移
```

若放行改码，**行号级完整改动面**（本单实测，一条未执行）：

| 落点 | 改动 | 前置裁决 |
|---|---|---|
| `:50` | `国策(23)→(39)`、`故事(23)→(35)` | 无（纯低估，直接可改） |
| `:50` | `沙盒40→48` | **裁决①**（改数＝改语义） |
| `:51` | `七卷23剧情事件→35` | 无（与 `:99` 自相矛盾，脚本看不见） |
| `:4 / :25 / :38 / :50` | `1154`（6 处）→ 现值或改口径 | **裁决②**（1478 系主班数，本单未复测；`:25/:38` 是"验收硬指标"语气） |
| `:4 / :50` | `91 文件`（2 处）→ `138 文件` | **裁决②**（138 为本单实测，可直接复算） |

⇒ 算术口径（12 处合计，可复算）：**五域轴 4 处**（`:50` 的国策/沙盒/故事 3 处 + `:51` 的剧情事件 1 处）＋**测试计数轴 8 处**（`1154` 6 处 + `91 文件` 2 处）＝**5 行 12 处**。
- **只同步五域** ＝ 动 2 行 4 处（其中沙盒那 1 处还卡在裁决①）；
- **放着不改** ＝ 那 8 处测试计数继续以 `1154/91` 示人，而 `:25` 是"必须全绿"的验收语气、`:38` 把它写进 `npm run verify` 的定义里。

⇒ **裁决建议**：五域是慢变量（实测两天零变化），测试计数是快变量（同日 12:54→18:3x 就 133/1409 → 138/1478）。**放行时把测试计数改写为「运行 `npm test` 现取」的指针、不再钉数字**，否则这次放行只是下一份漂移快照的起点。
