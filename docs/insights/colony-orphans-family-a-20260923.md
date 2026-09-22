# colony 孤儿交付物族 A（MASK_FILL_WHITE）归位核验记录 · 2026-09-23

- 任务：`c923-04`　班：`qoder-executor-20260923-0022-colony3`　cwd `D:\code\colony-game`
- 开工 HEAD：`c7171e9`（现场 `git rev-parse --short HEAD` 于 01:44 取）
- **结论：核验通过（diff 纯度高、门禁全绿），但按约束本单零提交 → status partial，交主班代提交。**

## 一、为什么没提交（约束冲突，非核验失败）

任务书要求「吻合则精确路径提交」，但本夜两层上位约束都禁止子班提交这两件：

1. 纪律档 `tmp/executor-drain-discipline-20260923.md` §三：**子班一律不 `git commit`、不 `git add`**，改动清单交主班代提交。
2. colony2 下传并已写进本班的硬约束：工作树基线 7 项**全是他班的**，其中 `MapRenderer.ts`、`BuildPanel.ts` 在列 ⇒ **禁碰禁提交；要动其中某件先落 partial 交主班**。

两条指向一致，任务书不能让子班越过上位约束。⇒ 本单做完「核验」这一半（任务书前半段实质判据），把「提交」这一半交主班。

## 二、核验记录（逐项对照任务书前提）

### 2.1 两文件 M diff 是否仅含 MASK_FILL_WHITE 族改动 ⇒ **是，零他人混入 hunk**

| 文件 | hunk 数 | 增/删行 | MASK_FILL_WHITE 行数 |
|---|---|---|---|
| `src/renderer/render/MapRenderer.ts` | 4 | +4 / -3 | 4（1 import + 3 调用点）|
| `src/renderer/ui/BuildPanel.ts` | 2 | +2 / -1 | 2（1 import + 1 调用点）|
| 合计 | 6 | +6 / -4 | 6 |

纯度自证命令（把不属于本族的改动行滤出来，输出应只剩 4 条被替换掉的旧硬编码行）：

```
git diff -- src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts \
  | grep -E "^[+-]" | grep -vE "^(\+\+\+|---)" | grep -viE "MASK_FILL_WHITE"
```
读数：恰好 4 行，全为 `-…fillStyle(0xffffff, …)`（即被替换的旧值），无任何第三方 hunk。

### 2.2 改动语义 = 常量提取，零行为变化

- 定义已在 HEAD：`src/shared/visualConstants.ts:8` → `export const MASK_FILL_WHITE = 0xffffff;`
- 该文件 `git diff --quiet` 干净 ⇒ 已在 `355e9ec` 之前的提交里入库，本笔提交不需要它。
- 替换前后字面量同值（`0xffffff`），且 `src/shared/__tests__/visualConstants.test.ts:8` 冻结 `expect(MASK_FILL_WHITE).toBe(0xffffff)` ⇒ 本笔是**纯符号化，运行时零差异**。

### 2.3 收敛完整性 ⇒ **src 已零残留**

```
git grep --no-index -n "fillStyle(0xffffff" -- src/     → 0 命中
git grep --no-index -n "0xffffff" -- src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts → 0 命中
```
即「MASK_FILL_WHITE 收敛」这件事在本笔提交后就彻底闭环，无遗留调用点。

## 三、否证的任务书前提（2 条，均为计数口径，不影响结论）

1. **`git diff --stat 实测 MapRenderer +7/-2、BuildPanel +3/-1` 不成立。**
   `git diff --numstat` 实读 **MapRenderer 4/3、BuildPanel 2/1**。任务书把 `--stat` 图形列的「7」「3」（= 增+删总行数）误读成了「+7/-2」「+3/-1」。
2. **上游 `c922-08` 的「5 处 `MASK_FILL_WHITE` 调用点」多算 1 处。**
   磁盘实为 **4 处调用点 + 2 处 import = 6 行**（`git grep --no-index -c` 读数 4 与 2，与本单标题「MapRenderer×4＋BuildPanel×2」一致，与 c922-08 正文不一致）。
   ⇒ 本笔提交后 `src/` 内 `MASK_FILL_WHITE` 全部消费方为：`MapRenderer.ts` 4、`BuildPanel.ts` 2、`visualConstants.ts` 1（定义）、`visualConstants.test.ts` 3。

## 四、门禁实测（代提交方可放心）

| 门 | 命令 | 读数 |
|---|---|---|
| type-check | `npm run type-check`（= `tsc -p tsconfig.renderer.json --noEmit`）| **rc=0，0 错误** |
| 定向测试 | `npx vitest run src/shared/__tests__/visualConstants.test.ts` | 1 文件 / **2 例全绿** |
| pre-commit 全量门 | `npx vitest run`（盘态 = HEAD `c7171e9` + 7 项在途）| **130 文件 / 1395 例 / 0 失败** |

⚠️ **本仓没有根 `tsconfig.json`**（只有 `tsconfig.base/main/preload/renderer.json`）⇒ 纪律档写的裸 `npx tsc --noEmit` 在此**会打帮助并 rc=1**，是假红。正解 `npm run type-check`。
另注：门禁只覆盖 `tsconfig.renderer.json`，`main`/`preload` 两个工程**不在 pre-commit 门内**（在册缺口，本单不改）。

## 五、交主班的代提交件（精确路径 + 建议 message）

```
git add -- src/renderer/render/MapRenderer.ts src/renderer/ui/BuildPanel.ts
git commit -m "refactor(render): MASK_FILL_WHITE 收敛补交（d913c-15 欠账）

MapRenderer 3 处 + BuildPanel 1 处 fillStyle(0xffffff) → MASK_FILL_WHITE 常量，
含各自 1 行 import；纯符号提取零行为变化（常量定义已在 HEAD）。
注：本族不属 BACKLOG P1-6 任何条目，此笔为 d913c-15 的欠账补交。
盘态门禁实测：type-check 0 错 + vitest 130 文件/1395 例全绿。"
```

## 六、遗留问题

1. 「禁碰禁提交」与本单「须提交」的冲突需主班裁决：**由主班提交本笔**，或**主班解禁 colony2 那条 7 项约束后另派一班**。本单不自行越权。
2. `dist/renderer/assets/index-9DOBpPPC.js` 里也有 5 处 `MASK_FILL_WHITE` ⇒ 构建产物已含此改动，源码却未提交，**产物与源码不同步**。是否重建 `dist/` 属主班决定（本班禁 `git push`/构建写盘）。
3. #7 `docs/design/OPTIMIZATION_BACKLOG.md` 的 P1-6 打勾与本族无关，仍在他班在途件内，本单未碰。
