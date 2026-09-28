# c927-72 `dataLayerBoundary` 两笔同笔提交协调单：在途现状核实（2026-09-29T05:2x，colony62 班）

> **性质**：只读核件单。**零 git 写操作、零代码改动**（本班只跑 `git status/log/show/diff/ls-files/merge-base` ＋ 两枚定向 vitest）。
> **HEAD** `6fbeb23` ／ 分支 `codex/architecture-hardening`。
> **纪律**：按横幅只报**形态**（哪件、几行、mtime、HEAD 有无该改动），**不下归属结论**——归属判定是人工裁。

## 一、结论先说（形态层）

卷宗点名的"两件"＝ `src/renderer/data/__tests__/dataLayerBoundary.test.ts`（瘦身件，−②）与 `src/renderer/state/__tests__/dslEvalCompat.test.ts`（新件，收 ②）。

**两件的在途状态都已终结：均在 `74cbfa6`（2026-09-23 09:58:53）同一笔提交入库，锚点要求的"必须同笔"已满足 ⇒ 本单无待提交清单。**
但**该提交尚未推远端**（`git merge-base --is-ancestor 74cbfa6 origin/codex/architecture-hardening` → **rc=1**）⇒ 入库只成立于本地这块盘，"远端可恢复"这一层此刻为假（与 c922-115 对退役件的判断方向相反，那是已推、这枚未推）。

## 二、两件现状（逐件，全部现跑）

| 项 | `dataLayerBoundary.test.ts` | `dslEvalCompat.test.ts` |
|---|---|---|
| porcelain | **不在其中**（clean） | **不在其中**（clean） |
| tracked | 是 | 是 |
| 首次入库提交 | `d52e1a0`（c922-11 建件） | `74cbfa6`（c923-09 新建） |
| 末次改动提交 | `74cbfa6` | `74cbfa6` |
| `74cbfa6..HEAD` 之间还有别人动过吗 | **无**（`git log --oneline 74cbfa6..HEAD -- <两件>` → 零行） | **无** |
| 该提交内 numstat | **`+9 / −15`** | **`+40 / −0`**（新文件） |
| HEAD 版本行数 / `it(` 数 | 54 行／**2 例**（①③） | 40 行／**1 例**（②） |
| 工作树版本行数 / `it(` 数 | 54／2（与 HEAD 逐字节同） | 40／1（与 HEAD 逐字节同） |
| 盘上 mtime | **2026-09-23 02:28:22.984** | **2026-09-23 02:29:12.164** |
| HEAD 内是否含被迁移的门禁 | 否（② 不在此件，`:6-:9` 注释自述已迁出） | **是**（`:33 toContain`／`:35-36` 两条实现体判据／`:37` `validateFromStateShim).toBe(validateFromCore)`／`:38` `ShimError).toBe(CoreError)` 五条断言齐备） |

🔴 **只报形态、不下结论的一条**：两件盘上 mtime（09-23 **02:28／02:29**）比入库时刻（09-23 **09:58:53**）早约 7.5 小时，且 `74cbfa6` 作者字段为通用名 `Colony Dev`。⇒ "mtime 早于 commit"是**先写后提**的正常形态，还是**另一路同内容改动被顺带入库**，本班不裁（这正是横幅点名的"前手未归因在途件"高危面）。锚点件 `c923-09.result.md` 自报 `finished: 2026-09-23T02:31`、申报 numstat `+9/−15` 与 `40 行／1 例`——**与 `74cbfa6` 内实测 numstat 逐位吻合**，这条一致性本班如实登记，但不等于归属已闭合。

## 三、同笔原则下的提交清单（本单产出）

**当前待提交清单＝空。** 两件均已在 HEAD，工作树对 HEAD 零差。

给后班/主班的**条件清单**（只在下列情形出现时才生效，仍必须同笔）：

| 情形 | 必须同笔的精确路径 | 缺筆后果 |
|---|---|---|
| 若要**回滚** c923-09 的迁移 | `src/renderer/data/__tests__/dataLayerBoundary.test.ts` ＋ `src/renderer/state/__tests__/dslEvalCompat.test.ts` | 只回滚瘦身件 ⇒ ② 双份（`Tests` 变 4，重复钉）；只删新件 ⇒ ② 消失（**静默失守**） |
| 若新件被移出其目录 | 同上两件 | 新件里 `resolve(__dirname,'..','dslEval.ts')` 依赖"件在 `state/__tests__`"这一层深，换目录即 ENOENT 红（c923-09 遗留 5 在册坑） |
| `74cbfa6` 推远端前该批被 reset | 该批 5 枚全在内（含 `GameScene.ts` 生产码 ＋ `artManifestEvtArtUsage.test.ts`，c923-08 的同笔约束也在同一笔） | 拆开提 ⇒ 另一路的门禁同时失守 |

`74cbfa6` 实际批内文件（`git show --name-only --format='' 74cbfa6`）：
```
docs/insights/colony-effects-shape-judges-design-20260923.md
src/renderer/data/__tests__/artManifestEvtArtUsage.test.ts
src/renderer/data/__tests__/dataLayerBoundary.test.ts
src/renderer/scenes/GameScene.ts
src/renderer/state/__tests__/dslEvalCompat.test.ts
```
⇒ 该笔把 **c923-08 与 c923-09 两条各自独立的"必须同笔"约束合进一笔**（提交标题自述），这是同笔原则的正例：**多约束用一笔满足，比多笔各满足一半更安全**。

## 四、静默失守风险的**在世性实测**（今天的盘上它仍成立吗）

锚点（`c923-09.result.md` 遗留 1）：「只提 dataLayerBoundary 的瘦身而不提新件 ⇒ 门禁 ② 直接消失（套件仍绿，**静默失守**，无任何红会提示）」。

本班把这条风险从"历史申报"变成**当前可复算判据**——它描述的是**结构**，不因已入库而失效：

```
$ npx vitest run src/renderer/data/__tests__/dataLayerBoundary.test.ts
→ Test Files 1 passed (1) ／ Tests 2 passed (2)          ※ 单跑瘦身件：全绿，且里面已经没有 ②
$ npx vitest run src/renderer/data/__tests__/dataLayerBoundary.test.ts src/renderer/state/__tests__/dslEvalCompat.test.ts
→ Test Files 2 passed (2) ／ Tests 3 passed (3) ／ Duration 1.53s
   ✓ dataLayerBoundary.test.ts  (2 tests) 8ms
   ✓ dslEvalCompat.test.ts     (1 test) 2ms
```

⇒ **失守形态**：新件一旦离场（删除／移出目录／被 revert 而未同步瘦身件），套件从 `3 passed` 退化为 `2 passed`、**零红**。
⇒ **唯一免费的机械哨兵是"合计 3 例"这个不变量**（c923-09 的「迁移非增删 ±0」口径）：`data/__tests__/dataLayerBoundary ＋ state/__tests__/dslEvalCompat` 两件合计必须＝3。
   本班实测该不变量在 HEAD 上**成立**（2＋1＝3）。
⇒ 仓内**没有任何测试或门禁钉住这个合计**。引用面实测：`git grep -n "dslEvalCompat" -- src scripts` → **恰 1 命中**，位置是 `src/renderer/data/__tests__/dataLayerBoundary.test.ts:7` 的**注释指针**（「已由 c923-09 整体迁至 state/__tests__/dslEvalCompat.test.ts（断言逐条不变，用例数 ±0）」），**不是代码消费者**；新件自身内容不含该文件名字面 ⇒ 除这行注释外全仓零引用。⇒ 守住"合计 3 例"只能靠收班读数，属人工/主班面，本班**未新增哨兵**（改门禁属越界）。
⇒ 门禁 ② 自身仍有牙（不是死断言）：`dslEvalCompat.test.ts:35-36` 两条源码文本正则判据钉 `state/dslEval.ts` 不得长出实现体、`:37-38` 钉函数与类**同一对象**。c923-09 曾以变异实测 P2 证明其咬合（`state/dslEval.ts` 尾部加 `export const DSL_SHIM_PROBE = 1;` ⇒ 红在该新件）。本班**未重跑变异**（要写生产码，越界），只登记"判据在 HEAD 内逐条在世"。

## 五、本班零改动自证

```
$ git status --porcelain | wc -l → 本班开工 19（含 c927-70／71 两枚产出与两枚在册档 M）；收口 20（＋本文档 1 枚 ??）
$ git diff --cached --numstat     → 0 行（全程未 add）
$ git status --porcelain -- src/renderer/data/__tests__/dataLayerBoundary.test.ts src/renderer/state/__tests__/dslEvalCompat.test.ts → 零行（未动这两件）
```
四枚禁碰在途件（`OPTIMIZATION_BACKLOG.md` ` M`／`colony-dead-exports-20260914.json` ` M`／其 `.bak` ` D`／`colony-suite-timings-20260921.json` ` M`）与前十枚前手段位**逐条状态字面未变**。
未跑全量 vitest、未跑 build、未跑 `audit-dead-exports.mjs` 任何形态。定向只跑点名两件（清单见 §四命令原文）。

**台账数引用口径（按横幅点名）**：本班未引 `dead` 数作任何结论。若主班需要，本班现跑两版同值——
`$ git show HEAD:docs/insights/colony-dead-exports-20260914.json | grep '"dead"\|"testsOnly"'` → `"dead": 0`、`"testsOnly": 108`；工作树版 → 同样 `0 / 108`（两版 `generatedAt` 分别 `2026-09-18T18:45:50.388Z`／`2026-09-18T19:39:52.078Z`，`git diff --numstat` 该件 **6/6**）。⇒ 复现上一波 c927-67 的实测，**两版一致**，引用时说明哪一版即可，不必怕选错。

## 六、交人工/主班项

1. **`74cbfa6` 未推远端**（rc=1，HEAD 领先 151 笔）⇒ 该批 5 枚（含生产码 `GameScene.ts`）目前只有本地一层。是否推、何时推属主班排程，本班不动 git。
2. **"两件合计 3 例"无机械哨兵**：要钉住它得改生产码或测试契约（把合计写成断言／或按 c927-53 型打印器落地），均属另单。本班只留复算命令。
3. §二 那条 mtime／commit 时刻 7.5 小时差＋通用作者名 `Colony Dev` 的**归因**：本班按纪律未裁，交人工与 `claims.log` × `outbox` 对账面处理。
4. 本文档**未进 `docs/insights/` 索引**（四份快照并存无权威，沿用 c927-53 遗留 3 口径）。
