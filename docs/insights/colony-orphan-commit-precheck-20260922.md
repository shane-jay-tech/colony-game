# colony 孤儿交付物归位预检（c922-127，2026-09-22，只读＋提交计划，零提交）

- 执行班：`qoder-executor-20260922-0000-colony12`
- 性质：**只读预检**。核对四件在途 `M` 的 diff 是否仍只含 c922-08 点名的族 A／族 B 内容、有无后续班混入，并给出可执行的按族精确路径提交计划。**本档不执行任何提交、不 stage、不改写任何受版文件**（执行提交属日间带授权动作）。
- 前提锚点：`D:/code/zcode-bridge/outbox/c922-08-colony-worktree-close.result.md`「遗留问题 1」——建议单开「colony 孤儿交付物归位提交」，按族分次精确路径提交。
- **锚点否证 2 处**（详见第四节）：族 A 的「5 处调用点」实测 **4** 处；「1268→1272」这个必须在 message 里写死的跳变数**已整体过期**，现口径是 HEAD 1341 → 提交后 1345，脏树读数不变。

---

## 一、命令与基线数字（先命令后数字）

```
$ git rev-parse --abbrev-ref HEAD ; git rev-parse --short HEAD
codex/architecture-hardening
a677bff

$ git status --short
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
 M src/renderer/render/MapRenderer.ts
 M src/renderer/state/__tests__/saveGuard3.test.ts
 M src/renderer/state/__tests__/saveLoad.test.ts
 M src/renderer/ui/BuildPanel.ts
?? .audit-b151-tmp/
（8 行 = 7 tracked ＋ 1 untracked；与 c922-08 当班同一集合，四件在途 M 自 c922-08 至今零增删）

$ git diff --stat -- src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts \
      src/renderer/state/__tests__/saveLoad.test.ts src/renderer/state/__tests__/saveGuard3.test.ts
 src/renderer/render/MapRenderer.ts              |  7 ++--
 src/renderer/state/__tests__/saveGuard3.test.ts |  3 +-
 src/renderer/state/__tests__/saveLoad.test.ts   | 49 +++++++++++++++++++++++++
 src/renderer/ui/BuildPanel.ts                   |  3 +-
 4 files changed, 56 insertions(+), 6 deletions(-)

$ git diff --numstat -- <同上四路径>
4	3	src/renderer/render/MapRenderer.ts
1	2	src/renderer/state/__tests__/saveGuard3.test.ts
49	0	src/renderer/state/__tests__/saveLoad.test.ts
2	1	src/renderer/ui/BuildPanel.ts
```

hunk 规模（`git diff -U3 -- <file> | grep '^@@'`）：MapRenderer 4 hunks（`-1,4 +1,5` / `-192,7 +193,7` / `-534,7 +535,7` / `-1134,7 +1135,7`）、BuildPanel 2 hunks（`-1,3 +1,4` / `-440,7 +441,7`）、saveLoad.test.ts 3 hunks（`-1,3 +1,4` / `-103,6 +104,18` / `-630,3 +643,39`）、saveGuard3.test.ts 1 hunk（`-45,8 +45,7`）。合计 10 hunks，全部归族完毕（见第二节）。

全量门禁现值（本档自己跑的，非引用）：

```
$ npx vitest run
 Test Files  127 passed (127)
      Tests  1345 passed (1345)
   Duration  31.37s
```

即 **含这四件在途态在内**的当前工作树 1345 例全绿——四件不拖红，这是「可以立即提交」而非「要先修」的前提。

---

## 二、逐文件逐 hunk 归族表

判据：hunk 内每个 `+`/`-` 行是否只服务于该族语义。三类 = 族 A（`MASK_FILL_WHITE` 接线，归属 d913c-15）／族 B（存档测试件，归属 d913c-22 ＋ d914-17 及收尾注释）／**混入**（不属于上述任何一族的后续班改动）。

| # | 文件 | hunk | 磁盘实物 | 归族 | 判据 |
|---|---|---|---|---|---|
| 1 | MapRenderer.ts | @@ -1,4 +1,5 | `+import { MASK_FILL_WHITE } from '../../shared/visualConstants';` | 族 A | 纯 import |
| 2 | MapRenderer.ts | @@ -192,7 +193,7 | `mg.fillStyle(0xffffff,1)` → `mg.fillStyle(MASK_FILL_WHITE,1)` | 族 A | 同形单行替换 |
| 3 | MapRenderer.ts | @@ -534,7 +535,7 | `maskGfx.fillStyle(0xffffff,1)` → 常量 | 族 A | 同上 |
| 4 | MapRenderer.ts | @@ -1134,7 +1135,7 | `g.fillStyle(0xffffff,0.8)` → `MASK_FILL_WHITE,0.8` | 族 A | 同上（alpha 0.8 未动，非数值改动） |
| 5 | BuildPanel.ts | @@ -1,3 +1,4 | `+import { MASK_FILL_WHITE } …` | 族 A | 纯 import |
| 6 | BuildPanel.ts | @@ -440,7 +441,7 | `this.rowsMaskGfx.fillStyle(0xffffff,1)` → 常量 | 族 A | 同形单行替换 |
| 7 | saveLoad.test.ts | @@ -1,3 +1,4 | `+import assert from 'node:assert';` | 族 B | 只服务 #8 里的 `assert.fail`，与 d914-17 例绑定，不得单独拆走 |
| 8 | saveLoad.test.ts | @@ -103,6 +104,18 | `it('d914-17：迁移入口（v2→current）遇畸形存档抛 SaveLoadError 而非 TypeError')` | 族 B（d914-17） | 用例名自带批次号 |
| 9 | saveLoad.test.ts | @@ -630,3 +643,39 | `describe('c22 schema v3 compat read')` ＋ 3 例 | 族 B（d913c-22） | describe 名自带批次号；3 例：v3 迁移读取／v3 钳制／v3 缺 state 抛错 |
| 10 | saveGuard3.test.ts | @@ -45,8 +45,7 | 删 2 行 `TODO(日间): loadFromSlot(saveLoad.ts:771) …`，加 1 行「磁盘路径的损坏档已于 saveLoadIo.test.ts 钉住（020c 已收敛）」 | 族 B 收尾注释 | 零代码语义改动；所指 `saveLoadIo.test.ts` 已在 HEAD 且跑绿 |

**归族小结**：10/10 hunks 全部归族，**混入 0**。

三条独立否证「有无混入」的取证命令（均实测）：

```
$ grep -n "0xffffff" src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts
（exit 1，零命中）           # 两文件字面量已清干净，不存在"半途接线"或第三族残留
$ grep -n "MASK_FILL_WHITE" src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts
MapRenderer.ts:2(import) :196 :538 :1138
BuildPanel.ts:1(import) :444      # 4 调用点 + 2 import，与 diff 一一对上，无多出的 hunk
$ git diff -- src/... 逐 hunk 目视（上表 10 行）
```

saveLoad.test.ts 的 +49 行里 3 处 v3 夹具含 `grain/gold/cloth/timber/tools` 字面数字，但那是**测试输入**、不是 `balanceConfig.ts`/`buildings.ts` 的经济平衡事实源，本单只读更不动它（提交时也不构成红线触碰）。

---

## 三、行尾与 `git add` 风险（colony 第 7 段坑：行尾要连 blob 一起量）

```
$ python 逐文件计数（工作树 bytes/CRLF/bareLF  vs  git show HEAD:<file> 的 blob）
MapRenderer.ts        worktree 58840B CRLF=1208 bareLF=0   |  HEAD blob 57547B CRLF=0 bareLF=1207
BuildPanel.ts         worktree 27619B CRLF= 601 bareLF=0   |  HEAD blob 26947B CRLF=0 bareLF= 600
saveLoad.test.ts      worktree 25628B CRLF= 681 bareLF=0   |  HEAD blob 22964B CRLF=0 bareLF= 632
saveGuard3.test.ts    worktree  6714B CRLF= 185 bareLF=0   |  HEAD blob  6642B CRLF=0 bareLF= 186
core.autocrlf = true ;  git check-attr text eol -- <四件> 全 unspecified
```

判读：四件工作树**纯 CRLF、HEAD blob 纯 LF** ⇒ CRLF 是 autocrlf 落盘翻转的产物，**不是他班翻了行尾**。`git add` 时会归一回 LF 入库，故两笔提交都是**纯内容 diff、零行尾噪声**；执行时不必也不得跑 `git add --renormalize`（那是空操作加噪声）。执行班仍应以 `git diff --cached --numstat` 复核暂存行数与第一节工作树 numstat 逐字节相同（4/3、2/1、49/0、1/2），这是「没夹带行尾改写」的唯一硬自证。

---

## 四、锚点否证（2 处，按磁盘实况修正，不据此判 failed）

1. **族 A 是 4 处调用点，不是 5 处。** c922-08 遗留问题 1 写「5 处 `MASK_FILL_WHITE` 调用点 ＋ 2 处 import」，但**同一份 result 的归属表自身**记的是「第 2 行加 import ＋ 196/538/1138 三处调用」＋ BuildPanel「2 hunk」= 3+1=4。磁盘实测（第二节 grep 三路）＝ **4 调用点 ＋ 2 import**，diff 里 `-0xffffff` 行数也恰为 4。采 4。
2. **「1268→1272」整体失效，须换成 1341→1345。** 该组数以 f4d4c21 为基线；现 HEAD 已是 a677bff，中间 8 笔提交（c922-113…c922-126）大量加测。实测：当前**脏树** 127 文件 / 1345 例全绿，其中 saveLoad.test.ts 在途 +4 例已计入 ⇒ **干净 HEAD 态 = 1341**。所以正确表述是：族 B 提交让 **HEAD 口径 1341 → 1345**；而任何人在脏树上量到的 1345 **提交前后不变**——若照抄「1268→1272」会被下一个班误判成掉用例（c922-08 自己正是这么提醒的，提醒的数本身已过期，这是本单最有价值的一条更正）。族 A 那笔**用例数不变**（纯生产码，`tsc` 面）。

复算命令（执行班可逐条重跑）：

```
$ git stash push -- src/renderer/state/__tests__/saveLoad.test.ts && npx vitest run ; git stash pop
（预期 1341 —— 若不想动他班文件，用下面的离线口径替代）
$ git diff --numstat -- src/renderer/state/__tests__/saveLoad.test.ts   # 49 0
$ grep -c "^  it(\|^    it(" <(git show HEAD:src/renderer/state/__tests__/saveLoad.test.ts)  vs 工作树同命令
```

> ⚠ 上面第一条 `git stash` **不建议执行**——它会连带动到他班在途件，违反本班纪律；给出仅作口径说明，离线口径（第二、三条 it 计数差）足以坐实 +4。

---

## 五、提交计划（2 笔，精确路径，逐笔过门禁）

> 顺序建议 **族 A 先**：纯生产码、不碰测试面，失败面最小；族 B 在后，用例数跳变的账更好核。两笔**各自单独跑 pre-commit**（钩子是 `npm run --silent type-check` ＋ `npm run --silent test`，见 `.git/hooks/pre-commit`），不合批——合批就分不清 1341/1345 的账归谁。

### 第 1 笔（族 A，d913c-15 欠账补交）

```
git add src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts
git diff --cached --numstat        # 必须是 4/3 与 2/1，多一行即拆重做
git commit -m "<草案 A>"
```

message 草案 A：

```
refactor(render): d913c-15 欠账补交——MapRenderer/BuildPanel 4 处 MASK_FILL_WHITE 接线(2文件)

共享常量 MASK_FILL_WHITE 自 d913c-15 起已在 HEAD（src/shared/visualConstants.ts:8），
但生产调用点一直没入库，git grep HEAD 显示零消费者 ⇒ 该单归档时未核对 git status，
交付物成孤儿（同族事故见 c922-08 遗留 4）。本笔补交接线面：

  MapRenderer.ts  +import:2，调用点 :196 / :538 / :1138（三处，含 0.8 alpha 处）
  BuildPanel.ts   +import:1，调用点 :444
  合计 4 处调用点 ＋ 2 处 import；两文件内 grep "0xffffff" 现零命中。

语义改动：仅字面量 0xffffff → 同值常量，零数值/零分支变化（alpha 参数原样保留）。
用例数不变（1345，纯生产码）。
不属 OPTIMIZATION_BACKLOG P1-6 任何条目（BACKLOG 的 P1-6 打勾是用户本人改动，与本笔无关），
提交信息自述为 d913c-15 欠账补交，避免被当 P1-6 重开。

验证：npm run type-check ＋ npx vitest run（pre-commit 内建，127 文件 / 1345 例全绿）。
红线：经济平衡数值未碰；存档面（save-v9.json／夹具／schema／serialize）零接触。
```

### 第 2 笔（族 B，d913c-22 ＋ d914-17 欠账补交）

```
git add src/renderer/state/__tests__/saveLoad.test.ts src/renderer/state/__tests__/saveGuard3.test.ts
git diff --cached --numstat        # 必须是 49/0 与 1/2
git commit -m "<草案 B>"
```

message 草案 B：

```
test(save): d913c-22＋d914-17 欠账补交——saveLoad 4 例＋saveGuard3 收尾注释(2文件)

用例数跳变（写死，防下一班误判掉用例）：HEAD 口径 1341 → 本笔后 1345（＋4）。
脏树读数本笔前后皆 1345——这 4 例此刻已在跑且已绿，提交不改变任何人的实跑数。
（c922-08 原写「1268→1272」，那个基线是 f4d4c21 时代，已被 c922-113…126 八笔提交推翻，
 现口径由 c922-127 预检重测并在档更正。）

  saveLoad.test.ts +49/-0，新增 4 例：
    d914-17 例 1：v2→current 迁移遇畸形存档抛 SaveLoadError 而非 TypeError（配 +import assert）
    c22 例 2-4：describe('c22 schema v3 compat read') —— v3 迁移读取补齐默认值 / v3 路径钳制 /
               v3 缺 state 在迁移链抛原生 TypeError（该例自述「非 SaveLoadError 类型，修复另批」）
  saveGuard3.test.ts +1/-2：删 2 行 TODO(日间) 注释，改指 saveLoadIo.test.ts 已钉住磁盘损坏档
               （020c 已收敛为 SaveLoadError）；零代码语义改动。

生产码零改动：saveLoad.ts / schema / serialize 一字未动。
本笔仅新增/改注释测试文件 ⇒ 但被测面是**存档兼容（v2/v3 迁移读取）**，
按派单红线，归档该笔时须标「需 GPT 独立复核」（复核对象＝这 4 例是否把错误行为当契约钉死，
尤其 c22 第 3 例明确把 TypeError 现行为钉成期望，属"待修边界"而非"已修守卫"）。

验证：npm run type-check ＋ npx vitest run（127 文件 / 1345 例全绿）。
```

### 门禁与只读自证命令清单（执行班逐条跑，取 `${PIPESTATUS[0]}`）

```
npm run --silent type-check; echo "rc=${PIPESTATUS[0]}"        # 0
npx vitest run; echo "rc=$?"                                  # 0，127 文件 / 1345 例
git status --short                                            # 两笔后仍应剩 4 项他班件＋1 untracked 目录
git show --stat HEAD                                          # 只含本笔 2 文件
git diff --numstat                                            # 剩余在途件不含已提交的两族
```

**范围外、明确不碰**（本计划的边界即 c922-08 的边界）：`docs/insights/colony-dead-exports-20260914.json`（族 C，现值是 355e9ec 修复前污染口径，须归属方 `node scripts/audit-dead-exports.mjs --write` 重刷后再提）、其 `.bak` 删除态（族 D，唯一存证 117 条，删前须移档）、`docs/design/OPTIMIZATION_BACKLOG.md`（用户本人改动，红线/拍板域）、`.audit-b151-tmp/`（c921-05 留档）。四件均不在上述两笔 `git add` 路径内。

---

## 六、本单零写自证

- 本单对仓库的**唯一**新增文件＝本档自身与索引登记 1 行（任务书点名的产出件）；四件在途 M 的 `git diff` md5 开收工一致。
- 未 stage、未 commit 任何在途件、未 `git stash`、未 `--renormalize`、未删任何文件。
