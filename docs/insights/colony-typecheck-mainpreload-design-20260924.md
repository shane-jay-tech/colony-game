# colony main/preload type-check 接线设计稿（现门只覆盖 renderer）

- 单号：c924-04（只读设计稿）· 班：`qoder-executor-20260924-0955-colony16` · 取数时刻：2026-09-24T10:53–10:57（HEAD `7b68673`）
- 授权位：**只读**——本档之外零改动：不改 `package.json`、不改任何 `tsconfig*`、不改生产码、不补 `docs/insights` 索引。
- 一句话结论：**推荐"扩 `type-check` 为三工程串行"（方案 A），但它被 2 条在册红硬挡**——`src/main/index.ts:93` 今天在自己的工程里就是 rc=2，接进门即拦下每一笔提交。消红是 1 行生产码改动，属主班/人工裁决，不在本单授权内。

---

## 1. 现状盘点（完成标准①：三 tsconfig 存在性＋include 面实测）

四个配置文件在盘，**根 `tsconfig.json` 确实不存在**（所以上游纪律档"裸 `npx tsc --noEmit` 只打帮助、rc=1 是假红"成立）：

```
$ ls -1 tsconfig*.json
tsconfig.base.json  tsconfig.main.json  tsconfig.preload.json  tsconfig.renderer.json
```

| 工程 | include（原文） | lib | types | 程序内仓库文件数（`--listFilesOnly` 实测） | 耗时 cold／warm | rc | 在册红 |
|---|---|---|---|---|---|---|---|
| renderer | `src/renderer/**/*` | ES2022, DOM, DOM.Iterable | `[]` | **262** | 3.61s／3.79s | **0** | — |
| main | `src/main/**/*` | ES2022 | `["node"]` | **1** | 1.52s／1.44s | **2** | `src/main/index.ts(93,9) TS18048: 'w' is possibly 'undefined'.`／`(93,18) ... 'h' ...` |
| preload | `src/preload/**/*` | ES2022 | `["node"]` | **1** | 1.47s／1.51s | **0** | — |

`tsconfig.base.json` 关键点（三工程共用）：`strict: true`、**`noUncheckedIndexedAccess: true`**（＝§2 那 2 红的根因）、`skipLibCheck`、`isolatedModules`、`paths: {"@/*": ["./src/renderer/*"]}`。
⚠ 别名是**三工程共用**且指向 renderer：实测在"main 型"配置（`lib: ES2022`、`types: ["node"]`、无 DOM）下 `import { COLORS } from "@/ui/palette"` **照样解析成功、rc=0** ⇒ main/preload 里一旦出现 `@/…`（现役只有 `src/renderer/scenes/BootScene.ts:2` 一处用 `@/data`），会把 renderer 模块整片拖进 main 程序编译。扩门前不要往 main/preload 引别名，接线后如要引，得先确认拖进来的 DOM 用法在 `lib: ES2022` 下必红。

取数命令（逐工程，可复算）：

```
$ npx tsc -p tsconfig.renderer.json --noEmit   # rc=0，3.6s
$ npx tsc -p tsconfig.main.json --noEmit       # rc=2，1.5s，2 条 TS18048
$ npx tsc -p tsconfig.preload.json --noEmit    # rc=0，1.5s
$ npx tsc -p tsconfig.main.json --listFilesOnly | rg colony-game | rg -v node_modules   # 只有 src/main/index.ts
$ npx tsc --version                            # Version 5.9.3（package.json 声明 ^5.3.3）
```
逐工程计时＋错误名由探针脚本一次跑完（含 warm 二跑）：`tmp/c924-04-timing-probe.py` → `tmp/c924-04/timings.json`（gitignored，非入库件）。

## 2. 硬阻塞：main 今天就不是绿的（这是本档最重要的发现）

`src/main/index.ts:90-94`（原文）：

```
90   const sendCleanSize = (cause: string): void => {
91     if (!mainWindow || mainWindow.isDestroyed()) return;
92     const [w, h] = mainWindow.getContentSize();
93     if (w > 0 && h > 0) mainWindow.webContents.send('window-resized', { w, h, cause });
94   };
```

`getContentSize()` 的类型是 `number[]`（不是元组），叠加 base 的 `noUncheckedIndexedAccess` ⇒ 解构出的 `w`/`h` 是 `number | undefined`，`:93` 两处比较即 TS18048。**该文件从未经门看守**（§1：main 不在 `type-check` 面内），所以红在盘上而不红在 CI——典型的"门外的码在长红"。

三个消红选项（**都属生产码改动，本单一律未做**）：

| 选项 | 改法 | 判别力／风险 |
|---|---|---|
| ①（推荐） | `const [w = 0, h = 0] = mainWindow.getContentSize();` | 1 行；`0` 走不到 `w>0 && h>0` 的发送分支，与"拿不到尺寸就不推送"的现有语义一致 ⇒ **零行为变化** |
| ② | `const size = mainWindow.getContentSize(); const w = size[0] ?? 0; const h = size[1] ?? 0;` | 同上，3 行，啰嗦但意图最显 |
| ③ | 给 main/preload 的 compilerOptions 关掉 `noUncheckedIndexedAccess` | **降基线**：把守卫从整个工程撤掉，只为绕 1 行——不建议，且属"改判据"级动作 |

⚠ 这不是红线域（窗口像素尺寸，不涉经济平衡／资金／统计结论），但仍是生产码语义面 ⇒ 按纪律档 §五.3 的口径交主班裁决并择一执行。

## 3. 门与成本（pre-commit 影响面）

```
$ cat .git/hooks/pre-commit
#!/bin/sh
npm run --silent type-check || { echo "[pre-commit] 拦截：type-check 红。修完类型错误再提交。"; exit 1; }
npm run --silent test      || { echo "[pre-commit] 拦截：测试未全绿。"; exit 1; }
```

- `package.json:17` `"type-check": "tsc -p tsconfig.renderer.json --noEmit"`；`:19` `"verify": "npm run type-check && npm run test"` ⇒ **改 `:17` 一处，pre-commit 与 `npm run verify` 同时生效**（无需动钩子文件，钩子在 `.git/` 内、不受版）。
- 门里已经有**全量 vitest**（`npm run test` = `vitest run`，本仓现役 139 文件级）⇒ 扩 type-check 的边际成本只有秒级，不会改变"提交要跑全量"这一既有事实。
- 另两枚钩子（`post-commit`／`post-checkout`）是 Qoder 埋点件、`|| true` 结尾，与本议题无关。

## 4. 方案对比（完成标准②：耗时实测）

| 方案 | 改法 | 实测墙钟 | 结论 |
|---|---|---|---|
| **A 串行扩口**（推荐） | `:17` 改三工程 `&&` 串联（便宜在前） | **7.50s**（三工程一把跑完；三次单跑 cold 合计 6.60s，差额 ~0.9s 属噪声量级，两侧都含各自的 npx 启动） | 比现状 +约 3.9s。失败即停、归因最清楚，零配置文件改动 |
| **A′ 并行扩口** | 三路 `&` ＋ `wait`（Git Bash 实测可用） | **5.39s／4.95s**（两次） | 再省 ~2s，但脚本要自收三路 rc；pre-commit 本来就带全量 vitest，这 2s 不值得引入 shell 复杂度 |
| **B references 复合**（`tsc -b`） | 三 cfg 各加 `composite: true` ＋ 新增根 solution `tsconfig.json` | 真实工程**不可测**（要先改配置，超只读位授权）；沙盒机制实测见下 | 不推荐：收益（增量 no-op）在 pre-commit 场景几乎不发生，代价是 3 处配置＋buildinfo 状态件 |
| **C 并进单工程** | 把 `src/main/**/*` 塞进 renderer 的 include | — | 不推荐：见下方反向探针（白拿 DOM 全局，守卫力下降） |

**方案 B 的机制实测**（沙盒 `tmp/c924-04/compexp`，2 文件，TS 5.9.3）：

- `composite` ＋ `tsBuildInfoFile` 指向**不存在的嵌套目录** → `tsc -b` **rc=0 且自动创建该目录**（`find` 见 `deep/nested/where/x.tsbuildinfo`）。
- `tsc -b --noEmit` **不产出 `.d.ts`**（同沙盒 `find` 只有 tsbuildinfo；对照不带 `--noEmit` 时 `out/a.d.ts`、`out/b.d.ts` 都生成）。
- 增量确实生效：删掉产物后首次 `-b --noEmit` 会报"some of the changes were not emitted"并重建一次，此后连跑 3 次均 `up to date`（no-op ≈0.94–1.07s，**几乎全是 npx 启动**，故真实工程的 no-op 收益上限就是"省掉 ~6.6s 的编译"，而这在提交场景里每轮都要重付一次）。
- 🔴 **失败不被缓存成假绿**（关键反向自证）：把沙盒里 `b.ts` 改成类型错误后连跑 3 次 `-b --noEmit`，**每次 rc=1 且重报同一条 TS2322** ⇒ 复合方案不会"红一次之后偷偷变绿"。

**方案 C 的反向探针**（同一件探针文件，只换 `--lib`）：

```
$ npx tsc --noEmit --lib ES2022 --types node tmp/c924-04/domprobe.ts
tmp/c924-04/domprobe.ts(1,11): error TS2304: Cannot find name 'HTMLElement'.
tmp/c924-04/domprobe.ts(1,25): error TS2584: Cannot find name 'document'. ...
rc=2
$ npx tsc --noEmit --lib ES2022,DOM,DOM.Iterable tmp/c924-04/domprobe.ts
rc=0        # 探针内容只有 `const el: HTMLElement = document.body`
```
⇒ 用 renderer 的编译器选项编 main **今天不会造假红**（实测：`include: src/main/**/*` ＋ renderer 的 `lib`/`types: []` → 只多出与 main 工程完全相同的 2 条 TS18048，无新增），但 main 代码会白拿 DOM 全局（上面 rc=0 那条就是证据）——写错 `window`/`document` 不再报错，属**守卫力净损失**，故否掉。

## 5. `tsBuildInfoFile` 的在册缺陷（扩门前要顺手处理，本单未动）

三份工程配置都把 buildinfo 写成**仓库外绝对路径**：

```
$ rg -n "tsBuildInfoFile" tsconfig.main.json tsconfig.preload.json tsconfig.renderer.json
tsconfig.main.json:6:    "tsBuildInfoFile": "D:/colony-game/.tsbuildinfo/main.tsbuildinfo",
tsconfig.preload.json:6:    "tsBuildInfoFile": "D:/colony-game/.tsbuildinfo/preload.tsbuildinfo",
tsconfig.renderer.json:6:    "tsBuildInfoFile": "D:/colony-game/.tsbuildinfo/renderer.tsbuildinfo",
```
- 仓库真实路径是 `D:/code/colony-game` ⇒ `D:/colony-game` 是**另一台机器的布局残留**，且**本机盘上确实存在该目录**（`ls -d D:/colony-game` 命中，里面有 `dist-out`／`art-library` 等历史件），而 `D:/colony-game/.tsbuildinfo` 尚不存在。
- 现状无害：三处都不带 `incremental`/`composite`，`--noEmit` 下 tsc **从不写 buildinfo**（实测：跑完三次 `--noEmit` 后 `D:/colony-game/.tsbuildinfo` 仍不存在）。
- 🔴 一旦走方案 B（`composite` 隐含 incremental），按 §4 沙盒实测"缺失目录会被自动创建"，**buildinfo 会静默写到仓库外**——换机器/别人 clone 就变成写到不存在的路径。⇒ 方案 B 的**前置**是先把这三行改成仓库内相对路径（如 `"./node_modules/.tmp/<name>.tsbuildinfo"`）并加 `.gitignore`，属独立的卫生单，不该塞进本议题偷做。

## 6. 扩门顺带能收的看守缺口（今天零工程覆盖 4 件）

以"三工程 `--listFilesOnly` 并集 vs 盘上 ts/tsx"逐件核 membership：

```
OUT  src/shared/__tests__/visualConstants.test.ts        -> 无任何工程
OUT  scripts/__tests__/auditDeadExportsReadonly.test.ts  -> 无任何工程
OUT  electron.vite.config.ts                             -> 无任何工程
OUT  vitest.config.ts                                    -> 无任何工程
IN   src/shared/palette.ts, src/shared/visualConstants.ts -> ['renderer']（被 import 拖入，非 include 命中）
```
⇒ 若只做"三工程"扩门，这 4 件仍在门外。要一并收：给 renderer 的 include 加 `src/shared/**/*`（`scripts/__tests__` 与两份根配置各属 vite/vitest 自己的世界，建议**先不收**——`vitest.config.ts` 进 tsc 程序会牵出 vite 类型面，属另一个成本）。

## 7. 落地清单（谁做、改哪几行、跑什么验收）

1. **人工／主班裁决**：§2 选项 ①／②／③ 择一。推荐 ①。
2. **消红改动**（1 行生产码）：`src/main/index.ts:92`。
3. **扩门改动**（1 行 `package.json:17`）：
   `"type-check": "tsc -p tsconfig.main.json --noEmit && tsc -p tsconfig.preload.json --noEmit && tsc -p tsconfig.renderer.json --noEmit"`
   （便宜工程在前，红得早；实测合计 7.5s。）
4. **可选（同一笔带上更好）**：`tsconfig.renderer.json` 的 include 加 `"src/shared/**/*"`，把 `src/shared/__tests__/visualConstants.test.ts` 拉进门（§6）。
5. **验收口径**：`npm run type-check`（应 rc=0）→ 定向 `npx vitest run src/shared/__tests__/visualConstants.test.ts`（若做了第 4 步）→ 提交时 pre-commit 自会跑全量。**不需要为这件事单独跑全量**：门里本来就带。
6. **不要做**：把 `--noEmit` 换成 `tsc -b`（§4/§5 的 buildinfo 前置没清之前，复合方案会把状态件写到仓库外）。

## 8. 与在册口径的关系

- 上游 `zcode-bridge/done/c923-04.result.md:49` 记的"本仓无根 tsconfig／`type-check` 只覆盖 renderer／main、preload 不在 pre-commit 门内"——**本档逐条复验成立**，本档只是把"那三工程现在什么状态、接进来要花多少秒"补上。
- 判据③「`git diff --stat`=0」的口径说明：本单唯一盘上产物是**本档一件新增未跟踪文件**；`git diff --stat` 里出现的受版件改动全部来自同班 c924-02／c924-03 与他班在册 3 项（`OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json` 及其 `.bak` 的 ` D`），**本单未碰**（精确读数见 result 的验收节）。
- 本仓 `docs/insights/` 有 3 份索引件并存（`colony-insights-index-20260915.md`／`-20260919.md`／`-recount-20260917.md`，盘上 md 共 112 份）**且无权威、无计数哨兵** ⇒ 按派单令**本档不自行补任何索引**，登记归主班（待人工台账已记该"择一"事项）。
