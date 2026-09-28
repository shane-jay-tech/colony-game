# c927-64 · `auditDeadExportsReadonly` 慢尾治理：案 B（文件内容记忆化）落地实录

> **班次**：`qoder-executor-20260928-1440-colony56`（zcode-bridge 波次 46 写位路）· cwd `D:\code\colony-game`
> **取数时刻**：2026-09-28T14:46–14:55+08:00（`date` 现取，独占窗＋暖缓存）· **开工 HEAD** `285b004`
> **上游**：`docs/insights/colony-de-slowtail-diagnosis-20260924.md`（c924-11，§4 案 B 行＝本单判据出处）、
> `zcode-bridge/done/c924-11.result.md`、`zcode-bridge/done/c923-12.result.md`（"94.7s／占全量 72%"叙事源）、
> `zcode-bridge/done/c924-12.result.md`（并发污染坐实）
> **红线声明**：改动只有 `scripts/audit-dead-exports.mjs` 一枚生产脚本；默认 JSON 未被本班写过
> （`docs/insights/colony-dead-exports-20260914.json` 跑前跑后 sha8 恒 `c531140e`、mtime 恒 `Sep 19 03:39:52 2026`），
> 全程未用 `--write`；测试件 `scripts/__tests__/auditDeadExportsReadonly.test.ts` **一字未改**（`git diff` 空）。

---

## 〇、结论先行

1. **案 B 已落地并实测复计时**：脚本裸跑 **17.07–17.42 s → 0.31–0.33 s（≈53×）**；
   测试件用例级 `durationMs` **17,350／18,287 ms → 332／334／343 ms（≈52×）**，件墙钟 **19.76–25.76 s → 1.84–1.98 s**。
   ⇒ c924-11 的"15.4 s → 约 0.7–1.0 s"预估**偏保守**，实测更好（本件现在是全量里的噪声级，top-1 换人）。
2. **语义零变化（sha 全等硬断言绿）**：改动前 3 份 ＋ 改动后 3 份共 6 份 `--out` JSON，去掉 `generatedAt` 后规范化
   sha256 **六份逐位相同** = `173b566e792f24e17ee76b49a5d842e3de9d9284bfd3eba9899cb01a03c013a7`；
   `entries=106`、`summary={"dead":0,"testsOnly":86,"internalOnly":20}`、`Σ hitsInTests=666` 三项也全等。
3. **判据有牙（变异自证）**：把缓存键从完整路径改成 `path.basename(p)`（本树真实存在同名碰撞：`index.ts` ×3、`palette.ts` ×2）
   ⇒ 输出立刻漂移：`entries 106→111`、`summary {"dead":0,"testsOnly":86} → {"dead":2,"testsOnly":89}`、规范化 sha8 `173b566e → 32fd1eee`。
   ⇒ 这条 sha 全等断言**能抓住 c924-11 遗留问题 2 警告的那一型回归**（缓存把 `hitsInTests` 算错而门禁不红）。
4. **在册数按今日树重算**：`导出数 × (非测试文件数 − 1 + 测试文件数) + 非测试文件数 = 420×(126−1+161)+126 = 120,246 次`
   （9/24 该式预测 110,059 并被实测逐位命中）。常驻内存代价＝脚本实际读到的源文本面 ≈ **2.26 MB**
   （`src` 下全部 `.ts`/`.mts` 合计 2,371,087 字节），**不是** 120,246 次读数对应的 ~760 MB。

---

## 一、案 B diff（唯一生产码改动，`scripts/audit-dead-exports.mjs`）

`git diff --numstat -- scripts/audit-dead-exports.mjs` = **16  added / 3 deleted**（其中 5 行是注释，代码净增 11 行；
诊断稿 §4 估的是"+3～+6 行 / −2 行"，本班多写的是 4 行出处的注释与 1 处 `:57` own-file 读——诊断稿说"顺手可含"）。

```diff
@@ EXPORT_RE / entries 之后，主循环之前 @@
 const EXPORT_RE = /^export\s+(?:const|function|class|let)\s+([A-Za-z_$][\w$]*)/gm;
 const entries = [];
 
+// c927-64 案 B（诊断见 docs/insights/colony-de-slowtail-diagnosis-20260924.md §4）：文件内容记忆化。
+// 热点是无缓存重复读盘——同一文件被重读约「值导出数」遍（readFileSync 占单轮 96.9%）。
+// 只加一层 path→内容 缓存，读法与编码（utf8）不变 ⇒ 判定逻辑与计数口径零改动。
+const contentCache = new Map();
+function readCached(p) {
+  let txt = contentCache.get(p);
+  if (txt === undefined) {
+    txt = fs.readFileSync(p, 'utf8');
+    contentCache.set(p, txt);
+  }
+  return txt;
+}
+
 for (const file of files) {
-  const src = fs.readFileSync(file, 'utf8');
+  const src = readCached(file);
@@ 内层两个站点 @@
-      nonTestHits += (fs.readFileSync(other, 'utf8').match(wordRe) || []).length;
+      nonTestHits += (readCached(other).match(wordRe) || []).length;
     }
     for (const t of testFiles) {
-      const txt = fs.readFileSync(t, 'utf8');
+      const txt = readCached(t);
```

**未碰**：CLI 三支（`--out` / `--write` / 无参只读）、`.bak` 逻辑、桶规则、排序、`[B-151]` 自检、输出文案。
全文只剩 **1 处** `fs.readFileSync`（在 `readCached` 内），可 `grep -n readFileSync scripts/audit-dead-exports.mjs` 复核。
行尾：改动前后均为 LF（`\r\n` 计数 0，`wc -l` 131→144），无行尾漂移。

---

## 二、前后耗时读数（同一独占窗、同机、暖缓存，命令内联可复算）

脚本裸跑（`--out` 落 `tmp/`，不碰默认 JSON）：

```
$ python -c "...subprocess.run('node scripts/audit-dead-exports.mjs --out tmp/c92764-base-<i>.json') 计时..."   # 案 B 前
warm(冷启) 18.78s ／ base1 17.42s ／ base2 17.22s ／ base3 17.07s      rc 均 0
scanned files=126 entries=106 summary={"dead":0,"testsOnly":86,"internalOnly":20}   （三轮逐字相同）

$ 同命令，案 B 后
warm 0.32s ／ after1 0.33s ／ after2 0.33s ／ after3 0.31s              rc 均 0
scanned files=126 entries=106 summary={"dead":0,"testsOnly":86,"internalOnly":20}   （三轮逐字相同，与改前同值）
```

测试件定向跑（卷宗口径：点名单文件，非全量）：

```
$ npx vitest run scripts/__tests__/auditDeadExportsReadonly.test.ts --reporter=json --outputFile=tmp/c92764-*.json
案 B 前：run1 rc=0 wall=25.76s duration=17350 ／ run2 rc=0 wall=19.76s duration=18287   （passed 1 / failed 0）
案 B 后：run1 rc=0 wall=1.84s  duration=332  ／ run2 wall=1.88s duration=334 ／ run3 wall=1.98s duration=343
        （passed=1 failed=0，三次；用例名不变）
```

⚠ **报数口径标注**（诊断稿 §6.3 的规矩）：以上全部是**独占窗＋暖缓存**读数；本班未跑全量套件，不提供套件总读数
（全量口径交主班收班统一取）。按 c924-11 的教训，94.7 s 那类数是并发污染读数，**不与本表可比**。

---

## 三、sha 全等硬断言（判据 ③）＋ 变异自证

```
$ python -c "…去 generatedAt 后 json.dumps(sort_keys=True,ensure_ascii=False,indent=1) 取 sha256…"
baseline sha256: ['173b566e', '173b566e', '173b566e']     ← 案 B 前三份
after    sha256: ['173b566e', '173b566e', '173b566e']     ← 案 B 后三份
normalized sha256 full: 173b566e792f24e17ee76b49a5d842e3de9d9284bfd3eba9899cb01a03c013a7
ASSERT all six normalized outputs byte-identical: PASS    verify rc=0
entries len 106 106 | summary equal: True | entries list equal: True | totalHitsInTests 666 666
```

- 与诊断稿记的 `46f724ba` **不同**是正常的：那是 9/24 树（`files=125 entries=107`）的读数，本树已长成
  `files=126 entries=106`。本班断言的是**同一棵树上改前＝改后**，不是跨时点对齐。
- **变异刀**（判据有牙自证）：`tmp/c92764-mutant.mjs` ＝ 在生产版基础上只改两行缓存键
  （`contentCache.get(p)`→`get(path.basename(p))`、`set(p, txt)`→`set(path.basename(p), txt)`，`difflib` 核过差异恰 2 行）：

```
$ node tmp/c92764-mutant.mjs --out tmp/c92764-mut.json
scanned files=126 entries=111 summary={"dead":2,"testsOnly":89,"internalOnly":20}     ← 与基线不同
baseline 173b566e ／ post-fix 173b566e (equal-> True) ／ MUTANT 32fd1eee (equal-> False)
MUTATION SELF-PROOF: assertion turns red? YES red (teeth confirmed)
```

⇒ 结论：`sha 全等` 这条断言对**静默语义漂移**（不是崩溃型）敏感，缓存实现写错会红。

---

## 四、给主班的可批形状：常驻"结果集等价"守卫（本班无权落，属测试件改动）

本单的 sha 全等是**一次性取证断言**（跑完即成立、不进门禁）。诊断稿 §4 案 B 行与 c924-11 遗留问题 2 都要求
**同批补一条常驻守卫**，但那是 `scripts/__tests__/auditDeadExportsReadonly.test.ts` 的改动，**不在本单「产出」点名范围内**
（w42 §B.1／§B.3）⇒ 本班没动它，此处给出三种形状：

| 形状 | 落点 | 优点 | 代价／风险 |
|---|---|---|---|
| **G1 自比对**：同一次运行里用 `--out` 跑两份（或跑一次脚本＋一次测试内朴素双读参照实现），去 `generatedAt` 后 sha 全等 | 该测试件加 1 个用例 | 不钉绝对值⇒**树变了不转红** | 参照实现要在测试里重写一遍，等于养第二套算法（易漂移） |
| **G2 结构不变量**：断言 `entries` 里每条 `bucket` 与 `nonTestHits/testHits/ownOccurrences` 的口径自洽（tests-only 必 `hitsInTests>0`），且 `Σ hitsInTests` 与朴素重扫一致 | 同上 | 能抓 `hitsInTests` 算错这一型（正是缓存最易错处） | 需要脚本暴露可注入的读取口（改动面比案 B 大） |
| **G3 金档钉值**：把本次 `173b566e…` 与 `summary` 三键钉进 fixture | 测试件＋1 份 fixture | 最便宜，直接复算即可 | **每次 src 导出面变动都要人工重钉**，与本仓"待删导出会自然减少"的方向冲突 ⇒ 不推荐单用 |

本班建议 **G1（自比对）＋ G2（Σ hitsInTests 口径）**，G3 只当排期外的手工复算脚本；
若主班授权，请连同本班这份 sha 值 `173b566e…`（HEAD `285b004` 树）一起写进派单，便于复核。

---

## 五、零越界自证

```
$ git status --porcelain                              # 开工时（4 项，全是他班在册）
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
 M docs/insights/colony-suite-timings-20260921.json
$ git status --porcelain                              # 收笔时（6 项 = 4 项在册 + 本班两件）
 M docs/design/OPTIMIZATION_BACKLOG.md
 M docs/insights/colony-dead-exports-20260914.json
 D docs/insights/colony-dead-exports-20260914.json.bak
 M docs/insights/colony-suite-timings-20260921.json
 M scripts/audit-dead-exports.mjs                     ← 本班：案 B
?? docs/insights/c927-64-slowtail.md                  ← 本班：本文件
```

- 四枚在途件**未碰、未提交、未"顺手还原"**（`--write` 全程未用＝默认 JSON 与其 `.bak` 的成因分支没被本班触发）。
- 原件自证：改前 pristine 副本 `D:\code\tmp\qoder-executor-20260928-1440-colony56\audit-dead-exports.mjs.orig`
  sha1 `5a6078f5681efc41a35021b672f65fbc2b243b6f`（与 `git show HEAD:…` 逐字节相等，本班复核过 `orig==HEAD` 为 True）；
  改后工作版 sha1 `790e0e31c840eafc0aa1376b3887e10690bc4268`；变异副本 sha1 `3c95941befc5a94b9a8da07096e6a12832726fe3`
  **跑完即删**（`tmp/` 由 `.gitignore:25` 覆盖，删前已把 diff 与两份输出 JSON 移存到上面那个班名目录）。
- 未跑 `npm run type-check`：本单 `src/**` 零改动，而 `type-check` 只覆盖 `tsconfig.renderer.json`（既查不到 `src/main/index.ts`
  也查不到 `scripts/*.mjs`）⇒ 对本改动无判定力，跑了只是空转。

---

## 六、遗留问题

1. 🔴 **常驻守卫未落**（§4，属测试件改动，需主班另派／在本卷宗追加授权）——现状＝案 B 的等价性只有本档的一次性取证在守。
2. **在册台账里的 94.7 s 与 13.85 s／15.4 s 全部过期**：案 B 落地后该件用例级已到 **~0.33 s** 量级。
   `docs/insights/colony-suite-timings-20260921.json`（他班在途 ` M`）与 `colony-suite-slowtail-20260922.md:48` 的
   "≈26,784 次／189 MiB"（诊断稿已订正，本档 §0.4 另给今日闭式 **120,246 次**）都待主班按收班口径一次性刷新⇒ **本班一份未改**。
3. **top-1 换人**：这一件从"占全量 72%"降到噪声级后，全量最长件会落到 `sandboxSimulation`／`sandboxSnapshot` 那一对
   （c922-17 已定性：`sandboxSnapshot` import 了 `sandboxSimulation.test` 导致隔壁用例重复注册）——**不属本单，未重开**。
4. **同集合提交提醒**（w46 §A.4）：`scripts/audit-dead-exports.mjs` 与本档可同笔入库；
   若主班把 §4 的常驻守卫也一次做掉，则生产脚本＋测试件**必须同笔**（分开＝门禁裸奔窗口）。
   注意 `docs/insights/colony-dead-exports-20260914.json` **不能进这一笔**（他班在途件）。
5. 冷/暖与并发差仍在（诊断稿记 14.8／15.6／26.6／94.7 s 四读数）⇒ 案 B 后该件绝对值已小到 0.3 s 级，
   负载抖动对它的读数影响不再是治理对象，但**全量墙钟读数仍需标独占窗**。
