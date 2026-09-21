# colony 测试基线常驻档（n922-09，c921-08 转写＋当夜复跑刷新）

- 出稿：2026-09-22T02:5x（子班 `qoder-executor-20260922-0000-colony3`）
- 仓库：`D:/code/colony-game`，分支 `codex/architecture-hardening`，HEAD `9d418ee`（提交时刻 2026-09-22T02:50:53+08:00），本地领先 origin **26**，未 push
- 用途：**常驻基线档**。任何班次要引 colony 的用例数／文件数，先来这里对齐口径，再按下面的「复取命令」现场重取一次数——本档的数也只在它标注的 commit＋快照时刻上成立。

## 一、口径（先定口径，再谈数字）

| 项 | 现值 | 出处 |
|---|---|---|
| 跑法 | `npm test` → `vitest run`（无 watch） | `package.json` scripts |
| 用例发现 | `include: ['src/**/__tests__/**/*.test.ts', 'scripts/__tests__/**/*.test.ts']` | `vitest.config.ts:6` |
| 环境 | `environment: 'node'` | `vitest.config.ts:5` |
| 文件数拆分 | **124** ＝ src 侧 123 ＋ scripts 侧 1 | `find src\|scripts -path '*__tests__/*' -name '*.test.ts'` 分别 123／1 |
| 门禁 | pre-commit 跑 `type-check` ＋全量测试，实测 **19–25 s**，禁 `--no-verify` | `.git/hooks/pre-commit` |
| 声明数 ≠ 用例数 | `it.each`/循环会展开，**不许**用 grep 声明数当基线数（历史实测某提交声明 1206 vs 用例 1269，差 63） | `colony-test-asset-map-20260921.md:25` |

## 二、现值（本次实跑，两口径分开）

### 2.1 工作树口径（含他班在途未提交件）——**主口径**

> 快照时刻 **2026-09-22T02:55:59+08:00**（02:55:36 起跑），HEAD `9d418ee` ＋ 未提交在途件。
> ⚠️ 同夜 03:05 由 c922-101（`terrainPaths.test.ts` 补三方互等）再 ＋8 ⇒ 工作树现行 **1310**，见第三节末行；本节的 1302 只代表 `9d418ee` 时点。

```
Test Files  124 passed (124)
     Tests  1302 passed (1302)
  Duration  21.26s (transform 6.96s, setup 18ms, collect 28.67s, tests 51.90s, environment 45ms, prepare 26.53s)
```

- exit code **0**；`--reporter=json` 侧读数 `numPassedTests 1302 / numFailedTests 0 / numPendingTests 0 / numTodoTests 0`，`testResults` 长度 **124**，与默认 reporter 交叉一致。
- `numTotalTestSuites 431` 是 **suite** 数，不是用例数，别引。
- 本档只记全绿数，不记 stdout 里的沙盒终局读数——那属经济平衡数值（红线，只读），归 `sandboxSnapshot` 自家档。

### 2.2 HEAD 干净态口径（把在途件摘掉后 checkout 干净树会得到的数）

> **124 文件 / 1298 例** ＠ 推算基准 `9d418ee`（**推算，非独立实跑**：本机工作树脏，未用 stash/worktree 另立干净树跑）。

推算依据（逐项可复算）：

| 未提交测试文件 | HEAD 声明数 | 工作树声明数 | 差 | 差例名 |
|---|---|---|---|---|
| `src/renderer/state/__tests__/saveLoad.test.ts` | 45 | 49 | **+4** | `d914-17：迁移入口（v2→current）遇畸形存档抛 SaveLoadError 而非 TypeError`／`v3 存档经迁移链读取成功且补齐 v4+ 新字段的默认值`／`v3 路径钳制生效（speed=99 腐化值仍钳到 1）`／`v3 存档缺 state 形状非法 → 迁移中抛错而非静默` |
| `src/renderer/state/__tests__/saveGuard3.test.ts` | 14 | 14 | 0 | diff 是 1 加 2 删的**注释翻桩**，无用例增减 |

⇒ `1302 − 4 = 1298`；文件数两侧同为 124（`git ls-tree -r HEAD` 按同一 include 口径点数 124，未跟踪 `.test.ts` 为 0，`.audit-b151-tmp/` 落在 include 之外）。

## 三、基线变迁（引数请带 commit，不要只带数字）

| 读数（文件/例） | 载体 commit | 时刻 | 出处 | 状态 |
|---|---|---|---|---|
| 120 / 1269 | `f0c9754` | 2026-09-21 夜 | `outbox/c921-08-colony-test-baseline-run.result.md:10` | 已被 c922-13 判为失效 |
| 124 / 1295（工作树）、124 / 1291（HEAD 态） | `8580982` | 2026-09-21T22:52 | `colony-test-asset-map-20260921.md:23-24` | **已过期**（见第四节） |
| 124 / 1295 | `99dcaa7` | 2026-09-22T00:45 | `colony-suite-slowtail-20260922.md:5、85` | **已过期** |
| 124 / 1302（工作树）、124 / 1298（HEAD 态） | `9d418ee` | 2026-09-22T02:55 | 本档 | 同夜被 +8 顶掉（见下行） |
| 124 / **1310**（工作树，含 c922-101 的 `terrainPaths.test.ts` ＋8） | `69b262a`＋该测试件在途 | 2026-09-22T03:05 | `colony-terrain-ab-equal-20260922.md` 三节 | **现行** |

增量归因：`+7` 全部来自 `9d418ee`（c922-20 对 `constructionProgress` 的补盲，只动 1 个测试文件 ＋62 行，定向 vitest 该文件 19→26）。主班 03:0x 裁决**予以保留**，理由＝纯增量补盲、不改计数口径（与前浪 S2 那类「去重导致 −2」不同）。

## 四、点名：两份在档档的基线数已过期（本单不代改）

- `docs/insights/colony-test-asset-map-20260921.md:23、24、27、40`（c922-13）仍写 1295／1291，且 :27 结尾建议「后续班次引用基线请直接用 124 文件 / 1291 例（HEAD 态）」——**该指引已被本档取代**。
- `docs/insights/colony-suite-slowtail-20260922.md:5、85`（c922-17）仍写 1295。
- 刷新这两份档属他班产物，需人工/规划侧授权，**本单按令未动其一字**；后续班次**现场重取**，不要抄这两份。

## 五、已知会改变计数的未决动作（引数前先查）

- c922-17 的 **S2**（把 `runSimulation` harness 挪出 `*.test.ts`）会消掉重复注册的 2 例 ⇒ 例数 −2，主班尚未放行；若落地，本档第二、三节须整体刷新。
- 本机时钟会双向跳（休眠校时），故本档所有时刻均为命令实跑时现取，不接受「大概几点」。

## 六、复取命令（复制即用）

```bash
cd /d/code/colony-game && mkdir -p tmp/baseline \
  && npx vitest run --reporter=json --outputFile=tmp/baseline/vitest-baseline.json --reporter=default \
     > tmp/baseline/vitest-baseline.log 2>&1; echo "EXIT=$?"
grep -E "Test Files|Tests |Duration" tmp/baseline/vitest-baseline.log | tail -3
git ls-tree -r HEAD --name-only | grep -cE '^(src|scripts)/.*__tests__/.*\.test\.ts$'   # HEAD 侧文件数
for f in $(git diff --name-only | grep -E '__tests__/.*\.test\.ts$'); do
  printf '%s HEAD=%s WT=%s\n' "$f" \
    "$(git show HEAD:$f | grep -cE '^[[:space:]]*(test|it)(\.\w+)*\(')" \
    "$(grep -cE '^[[:space:]]*(test|it)(\.\w+)*\(' $f)"; done               # 干净态推算用（声明数只作差值，不作绝对数）
```

`tmp/` 已被 `.gitignore:25` 忽略，产物不入库。
