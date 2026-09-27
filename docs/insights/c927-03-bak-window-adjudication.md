# c927-03 · `.bak` 崩溃窗口退化（E3）写盘次序改法裁决材料

> 性质：**裁决材料，零产品码改动**（自证见 §7）。锚点：`done/20260925-120420-e89f.result.md` 遗留1-2
> （卷宗写 `outbox/…`，实体在 `done/`，8,700 B，mtime 9-25 16:11 —— 按波次 brief §3a 取用，不判锚点失效）。
> 仓现值 HEAD `102c65d`，`git status --porcelain` 开工 7 行（全他班在途件）。取证对象
> `src/main/index.ts`／`atomicSaveCrash.test.ts`／`fullLifecycleLayerTriage.test.ts`／`package.json`／三份 tsconfig
> 逐枚 `git diff --numstat HEAD -- <路径>` = **空** ⇒ 下文 file:line 对 HEAD 与工作树同时成立。

---

## 1. 现状钉桩：被测面与取法边界

`save-game` handler 正文（`src/main/index.ts:154-169`，逐字现取）：

```
158  const savesDir = join(app.getPath('userData'), 'saves');
159  await mkdir(savesDir, { recursive: true });
160  // 原子写：先落 .tmp 再 rename 替换，进程中断不会留下半截存档；
161  // 覆盖前把旧档复制为 .bak，每槽保留前一代以便回退。
162  const target = join(savesDir, `${slot}.json`);
163  const tmp    = join(savesDir, `${slot}.json.tmp`);
164  const bak    = join(savesDir, `${slot}.json.bak`);
165  await writeFile(tmp, json, 'utf-8');
166  if (existsSync(target)) await copyFile(target, bak);
167  await rename(tmp, target);
168  return true;
```

- 上限 `MAX_SAVE_BYTES = 10 * 1024 * 1024`（`:152`）⇒ `copyFile` 最长可跑 10 MB，**这正是"撕开窗口"的时长**。
- **取法约束沿用 e89f 的结论**：直调 `src/main/index.ts` 需整套 electron mock 且 import 期就跑 `ensureDDrivePaths()`
  （`:6-8`＋`:14-33` 无条件对 `D:/colony-game/user-data` 做 `mkdirSync`）⇒ 越"不得往用户目录写真文件"的线。
  本单的取证＝**把 handler 正文（:162-167 三步）逐字复刻成步骤表**，在 `os.tmpdir()` 下 `mkdtemp` 的真 FS 上跑，
  与在册先例 `atomicSaveCrash.test.ts:10-16 / :39-64` 同法；跑完整目录自删（探针尾行 `CLEANED=true`）。

---

## 2. ① 次序图（现次序 ＋ 四份改法，共五份）

`W` = writeFile(tmp)　`C[x→y]` = copyFile(x, y)　`R[x→y]` = rename(x, y)　`†` = 崩溃点

```
O0 现状（:165-167）
   W(tmp)† ─ C[target→bak]† ─ R[tmp→target]†
   注：C 之前不判 .bak 是否存在；首存不产生 .bak（atomicSaveCrash:190 钉过）

O1 锚点遗留1 的第一条写法：.bak 两阶段发布（复制仍在 rename 之前）
   W(tmp)† ─ C[target→bak.next]† ─ R[bak.next→bak]† ─ R[tmp→target]†

O2 锚点遗留1 的第二条写法：复制旧档挪到 rename 之后
   W(tmp)† ─ R[tmp→target]† ─ C[target→bak]†
   ⚠ 此刻 target 已经是**新代**——见 §3 的"成功路径读数"

O3 两条写法各取一半（rename 之后复制 ＋ .next 原子发布）
   W(tmp)† ─ R[tmp→target]† ─ C[target→bak.next]† ─ R[bak.next→bak]†

O4 零复制、双 rename 轮转（本单补的候选）
   W(tmp)† ─ R[target→bak]† ─ R[tmp→target]†

O5 本单推荐候选：现状的"两阶段化"，但把 .bak 的发布挪到 target 之后
   W(tmp)† ─ C[target→bak.next]† ─ R[tmp→target]† ─ R[bak.next→bak]†
   （旧档在 target 被替换**之前**就已经安全落进 .next，之后只是"何时宣布"）
```

---

## 3. ② 崩溃点矩阵（tmp / target / bak / bak.next 四文件全覆盖）

跑法（可复算）：

```
$ cd D:/code/colony-game && npx vite-node "D:/code/tmp/qoder-executor-20260927-1400-colony38/c927-03.probe.ts"   # RC=0
```

起点一律用现盘次序铺成 **target=g3、bak=g2**，本次写 **g4**。`g<n>`＝该文件里的 `state.currentDay`；
`—`＝文件不存在；`🔴TORN`＝存在但 JSON 不可解析。32 行全量读数留档 `c927-03.out.txt`。

| 次序 | 崩溃点 | target | **bak** | tmp | bak.next | 判读 |
|---|---|---|---|---|---|---|
| **O0** | （不崩） | g4 | **g3** | — | — | ✅ 成功语义：bak＝真前一代 |
| **O0** | W 之后 | g3 | g2 | g4 | — | ✅ 保存没发生，两代都在 |
| **O0** | **C 之后** | g3 | **g3** | g4 | — | 🔴 **同代覆盖**：g2 永久消失（锚点 E3／`atomicSaveCrash:211-223` 钉的就是这一格） |
| **O0** | **C（撕开）** | g3 | **🔴TORN** | g4 | — | 🔴🔴 **锚点没登记的一格**：`copyFile` 被打断 ⇒ .bak 变成**不可解析**，回退点整个作废（不是少一代，是零代） |
| **O0** | R 之后 | g4 | g3 | — | — | ＝不崩（末步之后无事可做） |
| **O1** | （不崩） | g4 | g3 | — | — | ✅ |
| **O1** | C[→.next] 之后 | g3 | g2 | g4 | g3 | ✅ .bak 未被碰 |
| **O1** | C[→.next]（撕开） | g3 | **g2** | g4 | 🔴TORN | ✅ **撕开被隔离进 .next**，.bak 完好 ← O1 的真收益 |
| **O1** | **R[.next→bak] 之后** | g3 | **g3** | g4 | — | 🔴 **同代覆盖仍然发生** ⇒ 锚点"最小改法"的第一条写法**没修住它点名的那个缺陷** |
| **O2** | （不崩） | g4 | **g4** | — | — | 🔴🔴 **成功路径就坏**：.bak 成了 target 的自我副本 ⇒ 「前一代」语义**彻底失效**（不是退化） |
| **O2** | W 之后 | g3 | g2 | g4 | — | ✅ |
| **O2** | R[tmp→target] 之后 | g4 | g2 | — | — | ⚠ 保存成功，但 .bak 落后**两代**（g3 从未落进任何文件） |
| **O2** | C（撕开） | g4 | **🔴TORN** | — | — | 🔴 撕开面**一点没修** |
| **O3** | （不崩） | g4 | **g4** | — | — | 🔴 同 O2：成功路径即失效 |
| **O3** | R[tmp→target] 之后 | g4 | g2 | — | — | ⚠ 落后两代 |
| **O3** | C[→.next] 撕开 | g4 | g2 | — | 🔴TORN | ✅ 撕开隔离进 .next |
| **O4** | （不崩） | g4 | g3 | — | — | ✅ 且**零复制**（最省 IO） |
| **O4** | **R[target→bak] 之后** | **—** | g3 | g4 | — | 🔴🔴 **target 凭空消失**：`load-game`（`:171-176`）只认 `<slot>.json` 且 `existsSync` 不成立 ⇒ 返回 `null` ⇒ 玩家看到的是**"这个槽位没有存档"**（数据其实在 .bak 里，但产品码读不到）。这一格被在册断言 `atomicSaveCrash:265-269` 反向锁死（"load-game 不得含 .tmp／只读 <slot>.json"） |
| **O5** | （不崩） | g4 | **g3** | — | — | ✅ **成功路径正确** |
| **O5** | C[→.next] 之后 | g3 | g2 | g4 | g3 | ✅ 两代都在 |
| **O5** | C[→.next] 撕开 | g3 | **g2** | g4 | 🔴TORN | ✅ 撕开隔离 |
| **O5** | **R[tmp→target] 之后** | g4 | **g2** | — | **g3** | ⚠ 唯一坏格：保存成功、.bak 暂时落后两代，**但 g3 就在 .next 残体里**，重启后下一次保存会把 .next 覆盖并 rename 上去 ⇒ 自愈；且 .bak 永不 TORN |
| **O5** | R[.next→bak] 之后 | g4 | g3 | — | — | ＝不崩 |

**横切三格结论（本单的承重读数）**：

1. 🔴 **否证锚点的"最小改法"**：遗留1 原文两条写法里，第一条（O1）**修不了它点名的同代覆盖**（矩阵 O1/`R[.next→bak]` 那格），
   第二条（O2）**在正常路径上就把 `.bak` 变成 target 的自我副本**（矩阵 O2/不崩＝`bak=g4`）——
   因为 rename 之后 target 已是新代，"从 target 复制"复制的是**新档**。⇒ **照锚点写会改出更坏的语义**，这是本材料最该被读到的一行。
2. 🔴 **锚点漏登记的一格**：`copyFile` 本身非原子 ⇒ 崩在中途 `.bak` 直接 `🔴TORN`（O0/C撕开），
   后果是"回退点作废"，比"少一代"重。任何改法若不做两阶段发布（.next＋rename），这一格都留着。
3. **没有任何次序能同时消掉全部三类**（同代覆盖／撕开／target 缺失）：
   O4 用零复制换来 target 缺失窗口；O2 用"保存必成功"换来 .bak 自我副本。
   **O5 是目前唯一"成功路径正确 ＋ .bak 永不 TORN ＋ target 永不为缺"的次序**，代价是最坏情形下 .bak 暂时落后两代（且残体自愈）。

### 3.1 附带实测：首存面会直接抛（草案必须带守卫）

同探针的 `FIRST` 组（空槽第一次存档，`target` 不存在）：

```
FIRST|O0|结果=OK       |t=g1 bak=—
FIRST|O1|结果=ENOENT   |rename '…fresh.json.bak.next' -> '…fresh.json.bak'  ← 首存直接失败
FIRST|O2|结果=OK       |t=g1 bak=g1  ← 首存即"自我副本"
FIRST|O3|结果=OK       |t=g1 bak=g1
FIRST|O4|结果=OK       |t=g1 bak=—
FIRST|O5|结果=ENOENT   |rename '…fresh.json.bak.next' -> '…fresh.json.bak'  ← 且发生在 target 已发布之后
```

⇒ **O1／O5 的草案必须写 `if (existsSync(bakNext)) await rename(bakNext, bak)`**（O5 尤其：否则第一次保存
"已经写成功但 IPC 抛错"，`saveToSlot`（`saveLoad.ts:847-856`）拿不到 `true` 会把它报成写盘失败）。
这一条在册锚点与既有测试都没覆盖（`atomicSaveCrash:190` 只钉"首存不产生 .bak"，没钉"首存不得抛"）。

---

## 4. ③ 对 type-check 覆盖面的影响（锚点这句需要改写）

锚点遗留1 的不改理由：「`src/main/index.ts` 不在 `npm run type-check`（只跑 tsconfig.renderer.json）覆盖面内」。

- **成立的部分**（现取 `package.json:17`）：`"type-check": "tsc -p tsconfig.renderer.json --noEmit"`，
  而 `tsconfig.renderer.json` 的 `include` 是 `["src/renderer/**/*"]` ⇒ `src/main/**` **确实不在 `npm run type-check` 内**。
- 🔴 **需要补正的部分（本单现取）**：仓内**本来就有点名可跑的主进程工程** `tsconfig.main.json`（`include:["src/main/**/*"]`、
  `types:["node"]`、`lib:["ES2022"]`）。跑它：

  ```
  $ cd D:/code/colony-game && npx tsc -p tsconfig.main.json --noEmit        # MAIN_TSC_RC=2
  src/main/index.ts(93,9): error TS18048: 'w' is possibly 'undefined'.
  src/main/index.ts(93,18): error TS18048: 'h' is possibly 'undefined'.
  $ cd D:/code/colony-game && npx tsc -p tsconfig.preload.json --noEmit     # PRELOAD_TSC_RC=0
  ```

  ⇒ 该工程**今天就是红的**：`:92` 的 `const [w, h] = mainWindow.getContentSize()` 在 `tsconfig.base.json`
  的 `noUncheckedIndexedAccess:true` 下元素类型为 `number | undefined`，`:93` 直接 `w > 0 && h > 0` 即报 TS18048。
  与写盘 handler **无关**，是存量红；但它意味着：
  ①**改主进程码没有绿色基线可比**（改后要能区分"我引入的"与"这 2 条存量"）；
  ②更准确的表述不是"覆盖不到 ⇒ 不能改"，而是**"改了没有门"** —— 而且这道门今天本身还挂着 2 条既存红。
  ③`npm run build`（`electron-vite build`）会**编译** main 但用 esbuild 剥类型不校验 ⇒ 类型错一路绿灯到运行时。
- **对落地次序的建议**：若真要改 `:165-167`，先在那一单里把 `:92-93` 的 2 条存量红一并收掉（改法＝`const [w, h] = …; if (w !== undefined && h !== undefined && w > 0 && h > 0)`
  或用 `as [number, number]` 加注释），**恢复 `npx tsc -p tsconfig.main.json --noEmit` rc=0 作为该单的验收项**；
  否则"跑一遍 main 工程"无法判红。这属于把锚点那句"不能改"翻译成"改之前先把门修好"。

---

## 5. 影响面清单

| # | 面 | 位置 | 走向 |
|---|---|---|---|
| S1 🔴 | **在册三步顺序钉桩必红** | `atomicSaveCrash.test.ts:235-242`（`body.indexOf('await copyFile(target, bak)')` 与 `indexOf('await rename(tmp, target)')` 比先后） | **O1-O5 五版全部撞红**：O1/O3/O5 的 copyFile 目标是 `bakNext` ⇒ 字面串查无（indexOf=-1）；O2 的 copy 在 rename 之后 ⇒ 序反；O4 根本没有 copyFile。⇒ 改产品码那单必须**同批**改写这枚钉桩，且要先看它改前是否真红（变异四步） |
| S2 🔴 | **现状登记用例必红** | `atomicSaveCrash.test.ts:211-223`（钉 `bak==target==gen81`，标题原文「🔴 登记（未改产品码）」） | 与 c927-01 的 I1 同形：这枚用例钉的是**缺陷存在**，改法落地即翻转；`FailurePoint` 联合类型（`:26`）也要随次序改名（`after-bak-copy` 在 O2/O5 下含义变了） |
| S3 | 组 2 其余三枚钉桩 | `:244-249`（只允许写 tmp）／`:251-255`（三个后缀字面）／`:257-263`（上限先于写盘）／`:265-269`（load-game 只认 `<slot>.json`） | 全绿（改法都不直写 target、都保留原三个 join 字面、都不动 load 面）。**但 `:265-269` 正是 O4 的死刑判决书**：产品码不会 fallback 到 `.bak`，所以 target 缺失窗口＝玩家档"消失" |
| S4 | **第三处复刻面会语义失真** | `fullLifecycleLayerTriage.test.ts:150-156`（colonyApi 替身：`if (existsSync(target)) copyFileSync(target, \`${target}.bak\`)`，注释自称「与主进程 handler 同语义」）＋ `:228-247`／`:309` 的「.bak 是 gen1、回退一代能追上被损坏的那一代」 | 该替身**自带实现** ⇒ 不会红；但产品码改次序后，注释里的"同语义"变成假话，且它演示的"回退 .bak 一代"流程与真盘形态不再一致。⇒ 改码那单要一并复核这 3 处注释／断言前提 |
| S5 | 磁盘残体面 | `O1/O3/O5` 新增 `<slot>.json.bak.next`；崩溃时可能长期滞留 | `list-saves`（`src/main/index.ts:178-183`）只收 `.json` 后缀 ⇒ 不进面板、不被读档看见（与 `.tmp` 同性质）。现状 `.tmp` 由"下次 rename 吃掉"（`atomicSaveCrash:150-158` 钉过），`.bak.next` 同理会被下次 copyFile 覆盖 ⇒ **无累积**，但每槽多一枚常驻文件的语义要写进注释 |
| S6 | IO 代价 | 10 MB 上限（`:152`） | O0 每存一次复制一份 ≤10 MB；O4 零复制（最省）；O5 与 O0 同量（一次 copy ＋ 一次 rename）。⇒ 性能不构成任一改法的闸 |
| S7 🔴 | **`.bak` 在产品码里没有任何读者** | 现取 `grep -rn "\.bak" src/ scripts/ --include=*.ts --include=*.tsx` ⇒ 产品码命中只有 `src/main/index.ts:161/164`（**写侧**）；其余全是测试件（`fullLifecycleLayerTriage`、`atomicSaveCrash`） | 「每槽保留前一代**以便回退**」目前**没有回退入口**：`load-game` 只读 `<slot>.json`，UI 无"回退上一代"动作 ⇒ 本案全部坏格子的实际受害者是**手工救档的玩家**，不是应用功能。这既是"不急着改"的最强论据，也是 `:161` 那句注释**超出实现**的事实 |

---

## 6. ④ 推荐案与最强反对意见

### 推荐（1 条）

**采 O5（`W(tmp) → C[target→bak.next] → R[tmp→target] → R[bak.next→bak]`，并带 `if (existsSync(bakNext))` 首存守卫），
但作为"改法"排到 S7 之后**：即先裁定 `.bak` 到底是不是一个**产品功能**——

- 若裁定"**是**"（打算做回退入口／或明写"手工救档受支持"）⇒ 落 **O5**：矩阵里唯一同时满足
  「成功路径 bak＝真前代」「target 永不为缺」「.bak 永不 TORN」的次序，最坏格只是 .bak 暂落后两代且自愈；
  落地同单必须带上 S1／S2 两枚在册桩的同批翻转、S4 三处注释复核，以及 §4 的 `tsc -p tsconfig.main.json` 基线复原（先收 `:92-93` 那 2 条存量红）。
- 若裁定"**不是**"（.bak 只是"尽量留一份"的运维便利）⇒ **不改次序**，只做两件事：
  ①把 `src/main/index.ts:160-161` 的注释改成与实现一致的措辞（明写"不提供回退入口；`.bak` 可能被同代覆盖或被撕开"），
  ②把本件 §3 矩阵登记进卷宗，作为将来真要做回退时的前置读数。

⇒ 无论哪条，**锚点遗留1 给的两条写法都不建议照抄**（O1 修不住它点名的缺陷，O2 把成功路径改坏）；
本单也**不建议 O4**（零复制虽省，但 target 缺失窗口＝玩家档凭空消失，且被在册断言反向锁死）。

### 最强反对意见（1 条）

**「S7 已经把结论说完了：产品码里没有任何人读 `.bak`，所以本案全部坏格子（同代覆盖／撕开／落后两代）的受害者只有
手改文件的玩家；而修它要付的代价是**翻转两枚在册现状钉桩**（S1/S2）＋**第三处测试替身的语义漂移**（S4）＋
**先修好一桩与本单无关的存量类型红**（§4）＋**引入一个常驻 `.bak.next` 文件面**（S5）。
在一个"回退"功能根本不存在的码上，用一次写盘次序改动换 3 个坏格子→1 个坏格子，
净收益接近 0，而风险落在**唯一没有类型门、且门今天还红着**的那份文件上。要真有价值，应该开的是
"给 .bak 做回退入口"的功能单，写盘次序只是那单的副产品——**先修需求，再修实现**。」**

**本材料的回应（供裁，不代表裁决）**：反对意见对"收益面"的量化是对的，但漏了一格：**O0 的 `C（撕开）`**——
它不是"少一代"，是 `.bak` 变成**不可解析**（矩阵 `🔴TORN`）。对没有回退入口的产品无感，
但对"档坏了才想起去看 .bak"的手工救档者，这一格把**唯一的希望也拿走了**，且它是 10 MB 复制时长内随时可发生的
（不是单次 rename 的微秒窗口）。⇒ 若主班接受"回退不是功能"的定性，那至少该把 `:161` 的注释改准（推荐案的第二条），
**因为现在的注释承诺得比实现多**；若不接受，那 O5 的代价清单已经逐条列好，可以直接批。

---

## 7. 守线自证

```
$ cd D:/code/colony-game && git rev-parse HEAD
102c65d225dd3631e17b486c5bb8c45144d85f4f
$ git status --porcelain      # ＝开工 7 行 ＋ 本班 3 枚未跟踪 docs/insights/c927-0*.md，src/ 无改动
```

- 本单唯一写入：`docs/insights/c927-03-bak-window-adjudication.md`（未跟踪，交主班按精确路径代提交）。**`src/` 零写入**，五份次序全部以图/表形态留在卷宗。
- 真 FS 写盘**只发生在 `os.tmpdir()` 下本班 `mkdtemp` 目录**（探针尾行 `CLEANED=true` 自证已删）；
  **未 import `src/main/index.ts`**（不触 `ensureDDrivePaths()`），`D:/colony-game/user-data` 全程未被本班创建或写入。
- 未跑全量 `npm test`（并发窗约束）；未跑 `npm run type-check` 之外的构建／打包／计划任务；未执行任何 git 写操作。
- 临时件：`D:\code\tmp\qoder-executor-20260927-1400-colony38\c927-03.probe.ts` ＋ `c927-03.out.txt`（32 行矩阵全量），本班收班自清。
- `docs/insights/` 索引本仓无权威版本 ⇒ **未代登**。
- 本件不含经济平衡／数值口径结论；写盘次序属存档面语义 ⇒ 按波次 brief §4 走人工闸，本班只出"可直接批的形状"。
