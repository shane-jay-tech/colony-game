# colony OFFLINE_REWARD 消费面普查与三案处置材料（只读落档 · 2026-09-25 实测）

- 班：`qoder-executor-20260924-2341-psy34`（信箱单 `c924-32`，cwd `D:\code\colony-game`，主班 `qoder-main-drain-20260924-2341` 收口）
- 性质：**只读普查＋处置材料**。零代码改动、零数值改动、未提交。
  ⚠ 经济平衡数值红线：本档**不判"离线收益该给多少"、不选案**，三案只列证据与影响面；裁决交主班＋owner（§5.3）。
- 盘面绑定：

```
$ git -C D:/code/colony-game rev-parse --short HEAD → cc29179（commit 时间 2026-09-24 23:18:53）
$ git -C D:/code/colony-game status --porcelain → 9 项，全部属他班在途（OPTIMIZATION_BACKLOG.md／colony-dead-exports-20260914.json 及其 .bak／
   docs/design 两件设计稿／colony24-25 的 4 份未提交测试件），本班未碰；本班新增本档后为 10 项
$ sha256sum src/renderer/data/offline.ts → 7e2be39c0974…   src/renderer/data/index.ts → c8b58fb1efcd…
   src/renderer/data/schema.ts → 3f22c6109e23…             src/renderer/state/saveLoad.ts → 1465cd7aa6ef…
$ git --no-pager log -S "OFFLINE_REWARD" --oneline -- src/ → 15769cb（Initial commit）  ← 自建仓以来从未有消费方被增删
```

## 1. 卷宗前提逐条实测（含否证）

| # | 卷宗前提 | 实测 | 命令 |
|---|---|---|---|
| 1 | `offline.ts:9` 是 `export const OFFLINE_REWARD: OfflineReward = {` | ✅ 逐字命中（:9），:10 是 `maxOfflineHours: 8,` | `$ sed -n '1,14p' src/renderer/data/offline.ts` |
| 2 | `data/index.ts:12` import／`:25` re-export | ✅ 两处逐字命中 | `$ rg -n "OFFLINE_REWARD" src/renderer/data/index.ts` |
| 3 | "`rg -n OFFLINE_REWARD src` 输出仅 **5 行**（定义 2＋导出 2＋schema 类型行另计）" | ❌ **否证**：该 pattern 在 `src/` 实测 **3 行**（定义 1＋桶 import 1＋桶 export 1）。`schema.ts` 里出现的是**类型名** `OfflineReward`（:398/:400-406），不含 `OFFLINE_REWARD` 串，所以它不可能出现在该 rg 的输出里——"5 行"把两件事混在一起了 | `$ rg -n "OFFLINE_REWARD" src/`；`$ rg -n "OfflineReward" src/` |
| 4 | "`schema.ts:400-402` 是 schema 类型" | ⚠️ **偏窄**：接口体是 `:398-407`（`export interface OfflineReward {` 在 :398，四个字段在 :400/:402/:404/:406） | `$ sed -n '396,408p' src/renderer/data/schema.ts` |
| 5 | "疑似零真消费" | ✅ 成立，且**比"疑似"更强**：见 §2 矩阵（含字段名级、动态键级、主进程级否证） | 见 §2 每行命令 |
| 6 | `docs/insights/colony-deadsave-reject-design-20260924.md:213` 的在册说法（"`getLastSeenTimestamp()` 零非测试调用方、`OFFLINE_REWARD` 只有再导出"） | ✅ 复证成立（本班独立测得同读数） | `$ rg -n "getLastSeenTimestamp" src/` → 定义 1＋测试 1 |

## 2. 消费面矩阵（每行一条可复算命令）

| 层 | 事实 | 证据 |
|---|---|---|
| 定义 | `OFFLINE_REWARD` 4 字段常量（`maxOfflineHours/decayFactor/applicableModifiers/snapshotResources`），无任何函数封装 | `sed -n '1,14p' src/renderer/data/offline.ts` |
| 导出 | 仅被桶 `data/index.ts` import（:12）＋再导出（:25）；桶里另有 9 个同类常量 | `rg -n "OFFLINE_REWARD" src/renderer/data/index.ts` |
| 消费（标识符级） | **零**：剔除定义件与桶件后全 `src/` 零命中；测试件零命中；`scripts/` 零命中；`src/main`＋`src/preload`＋`src/shared` 零命中 | `$ rg -n "\bOFFLINE_REWARD\b" src/ --glob '!src/renderer/data/index.ts' --glob '!src/renderer/data/offline.ts'` → rc=1<br>`$ rg -n "\bOFFLINE_REWARD\b" src/renderer/data/__tests__ src/renderer/state/__tests__ src/renderer/ui/__tests__` → rc=1<br>`$ rg -n "OFFLINE_REWARD" scripts/ src/main src/preload src/shared` → rc=1 |
| 消费（字段名级，防"绕过常量直接写数"） | 四个字段名只出现在 `offline.ts`（字面量）与 `schema.ts`（类型声明），**无任何第三处** ⇒ 连"不引用常量但读同名字段"的隐性消费也没有 | `$ rg -n "maxOfflineHours\|decayFactor\|snapshotResources\|applicableModifiers" --glob '!node_modules/**' --glob '!tmp/**' .` → 8 行，全在这两文件 |
| 消费（动态键级） | 无命名空间整体导入、无 `['OFFLINE_REWARD']` 式动态键、无对 `data/` 的运行时枚举；桶里唯一启动期校验 `validateStaticData()`（:33-38）只喂 `policies/events/decrees` 三表 ⇒ **不校验 offline** | `$ rg -n "import \* as" src/` → 3 处**全在测试件**且指向 `settingsStore`/`buildingRegistry`/`modifierAggregator`，非 data 桶<br>`$ rg -n "OFFLINE_REWARD'\]\|\['OFFLINE" src/` → rc=1<br>`sed -n '29,39p' src/renderer/data/index.ts` |
| 时间戳管道（半条活链） | 写侧**活着**：`saveLoad.ts:798 store.setLastSeenNow()`（在 `saveToSlot()` 内）→ `gameStore.ts:2816-2817` 写 `Date.now()`；序列化 :324／反序列化 :461 都在跑。读侧**死了**：`getLastSeenTimestamp()`（`gameStore.ts:554`）非测试调用方 **0** | `$ rg -n "lastSeen\|LastSeen" src/`；`sed -n '796,800p;807,821p' src/renderer/state/saveLoad.ts` |
| 读档链 | `loadFromSlot()` 只做 `validateSlot → loadGame → JSON.parse → deserialize`，**无任何按 elapsed 时间补发产出的分支** | `$ sed -n '807,821p' src/renderer/state/saveLoad.ts` |
| 幽灵引用 | `schema.ts:441` 注释写「上次离线的 timestamp（**用于 OfflineProgressionService**）」——该 service **全仓仅这一行注释命中，代码不存在** | `$ rg -n "OfflineProgressionService" --glob '!node_modules/**' .` → 1 命中（注释本身） |
| 既有死导出账 | `docs/insights/colony-dead-exports-20260914.json`（09-18 生成，108 条，`dead: 0`）**不含 `OFFLINE_REWARD`**，也不含同桶的另外 9 个数据常量。根因在扫描器口径：`scripts/audit-dead-exports.mjs:66-69`（累加在 `:68`）把"桶 re-export 那 2 处命中"算作**生产引用** → `:81 continue` 不入账。⇒ 凡"只被桶导出"的数据常量对该账**整体隐形**（本档不修扫描器，见 §5 交接口） | `$ sed -n '60,82p' scripts/audit-dead-exports.mjs`（`:68` 累加、`:81 continue; // 有生产引用 → 不是候选`）<br>`$ python -c "import json;d=json.load(open(r'docs/insights/colony-dead-exports-20260914.json',encoding='utf-8'));print({e['name'] for e in d['entries']}&{'OFFLINE_REWARD','TUTORIAL_STEPS','AUDIO_CUES'})"` → `set()` |

**一句话结论（实现事实，不是评价）**：`OFFLINE_REWARD` 是**生下来就没接线**的规则常量（初始提交至今零消费方、零测试、不在死导出账内），
唯一与它语义相连的活代码是"存档时刷新 `lastSeenTimestamp`"这一半条链——写侧在跑、读侧无人，注释里指向的那个消费者从未存在。

## 3. 三案处置材料（**不选案**，各带影响面）

### 案 ① 接线离线结算
| 项 | 内容 |
|---|---|
| 需要落地的点 | 新增消费方（注释已命名 `OfflineProgressionService`）：`loadFromSlot()` 之后按 `Date.now() - state.lastSeenTimestamp` 与 `maxOfflineHours` 上限折算 tick，再按 `decayFactor` 打折发放 `snapshotResources` 五资源，且只对 `applicableModifiers` 两类的 modifier 生效 |
| 现成可复用件 | `gameStore.ts:554 getLastSeenTimestamp()`（唯一无调用方的读口）；`:2816 setLastSeenNow()`；tick／resourceDeltas 聚合逻辑（`gameStore.ts:1493-1574` 一族） |
| 会惊动的在册账 | **`saveGuard3.test.ts`／`saveLoad.test.ts` 是禁碰区**（他班在途 `??`，纪律档 §九 未列但本班实测在 porcelain 内）；`serialize/deserialize` 快照口径（`saveLoad.ts:47/:324/:461`） |
| 红线暴露面 | **最高**——直接改玩家在离线时段拿到的资源量＝经济平衡数值本体；且 `decayFactor=0.5`、`maxOfflineHours=8` 这两个数一旦生效就进平衡曲线 ⇒ 本班一个数都没动，也不预测"接上会给多少" |
| 需先拍板的前置 | 离线期是否允许推进 `currentDay`（`schema.ts` 注释明确"人口与科技不自动增长"＝设计意图的一部分）；跨多槽/云档时以哪个 timestamp 为准 |

### 案 ② 退役（走 attic 流程）
| 项 | 内容 |
|---|---|
| 动作面 | 删 `data/offline.ts` ＋ `data/index.ts:12/:25` 两行 ＋ `schema.ts:398-407` 接口；`lastSeenTimestamp` 管道可留（存档元信息）也可一并退役 |
| 影响面 | 该常量零引用 ⇒ **类型层之外零连带**；`npm run type-check` 与全量 vitest 预期不动（本班未跑，见 §4 自证理由） |
| 需先补的账 | 它**不在** `colony-dead-exports-20260914.json` 里（§2 末行）⇒ 走"进 dead 账再退役"的标准流程会卡在第一步；要么先修扫描器的桶口径（属改判据，人工闸），要么为本案单开一条登记 |
| 已删原件的可回滚性 | 该件自 `15769cb` 起在 git 里 ⇒ 有还原点，与 `D:\attic` 那类"git 外原件"不同（attic 规矩见 `c924-33` 同批盘点） |
| 红线暴露面 | 低（不给玩家任何新数），但**等于永久放弃"离线收益"这条设计意图**（`offline.ts:4-7` 记着 Kimi 调研 B.8 ＋ 反审 #8"必修"）⇒ 属产品取舍，不归执行手 |

### 案 ③ 挂起登记（只记账，不动码）
| 项 | 内容 |
|---|---|
| 动作面 | 把本档 §2 矩阵登记进 `docs/design/OPTIMIZATION_BACKLOG.md`（**该件当前是他班在册 ` M`** ⇒ 须等其收口后由主班合入，本班未写一行）＋ 在死导出账口径修好后补一条 `dead` 记录 |
| 影响面 | 零运行时变化；风险是"未爆的雷"继续躺着：接线案（①）与退役案（②）的代价都会随 tick/存档结构演进而变 |
| 红线暴露面 | 无 |

### 建议单形态（**建议，不代拍板**）
1. 先落 ③（零风险、可逆），并把"扫描器对桶导出整体隐形"单独立一条**工具口径**项——它影响的不是这 1 个常量，而是 `data/index.ts` 里 10 个（§2 末行实测 `set()`）。
2. ①/② 的真拍板前置是**产品问题**（要不要离线收益），不是代码问题；建议出裁决材料时把 `offline.ts:4-7` 的原设计意图与"反审 #8 必修"的来账一并呈报，避免把 8 年注释当现状。
3. 若走 ①：接线单的产出面必然含 `src/renderer/state/**` ＋ `saveGuard3/saveLoad` 测试件 ⇒ 属写位＋禁碰区双重占用，须等 colony 在途 6 件收口后另派，不能挂在文档位上。

## 4. 红线与零改动自证

- 完成标准④"零代码改动"：`$ git -C D:/code/colony-game status --porcelain` 现值 10 项 ＝ 开工基线 9 项 ＋ 本档 1 项；
  `git diff --cached --name-only` = 0；未 add、未 commit。
- 未跑 `npm run type-check`／未跑 vitest（同仓他班 4 份测试件未提交、全量由 pre-commit 代跑，纪律档 §九／十"并发不跑全量"）
  ⇒ 本档 §3 案②的"预期不动"是**依据零引用的推断**，不是实测读数，主班代提交前若要背书请自己跑一次。
- 经济平衡数值红线：全程未改一个数值、未提出"应该给多少"；`maxOfflineHours: 8`／`decayFactor: 0.5` 只作为"实现在说什么"被引用。
- 未碰他班在途 9 件（含 `OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json` 与 4 份未提交测试件）；
  `D:\attic`／`D:/attic/colony-art-backup-20260920/` 类 cwd 外路径本单不涉及。
- 在册红未碰（台账 81／182／194／198／205⑥属 psy 域；colony 侧在册 3 项为 §七所记 docs/json/.bak，本班未动）。

## 5. 交接口（新踩到的分区坑 ＋ 待订正）

| # | 事实 | 现取命令 |
|---|---|---|
| 1 | **卷宗"rg 输出仅 5 行"不可复算**：同一 pattern 实测 3 行（§1 表第 3 行）；引这条判据的下一班会为凑数去找第 4、5 行 | `rg -n "OFFLINE_REWARD" src/` |
| 2 | **`rg` 不给显式路径时少报**：本班第一次跑 `rg -n "OFFLINE_REWARD" --glob '!node_modules/**' --glob '!dist/**' .` 只回 2 行，**漏掉了定义行 `offline.ts:9`**；改显式 `src/` 后回 3 行；python `os.walk` 第三轨回 10 处（含 `tmp/c924-06`、`tmp/c924-08` 两班沙盒副本 4 处）⇒ 判"零命中"式否证必须显式给路径＋双轨 | 对比：`rg -n … .` vs `rg -n … src/` vs python 轨 |
| 3 | **`rg` 对不存在的路径返回 rc=2 而不是 1**：colony 根下没有 `main/ preload/ tests/`（它们在 `src/main`、`src/preload`，测试在 `src/**/__tests__`），`rg … main/ preload/ tests/` → rc=2，极易被读成"文件不存在＝没搜" | `ls -d main preload tests` → No such file |
| 4 | **扫描器桶口径**：`scripts/audit-dead-exports.mjs:66-69`（累加在 `:68`）把 `data/index.ts` 的 re-export 计入 `nonTestHits` ⇒ `:81 continue` 使 10 个数据常量对该账整体隐形。改它＝改判据，人工闸后；本班未动 | `sed -n '60,82p' scripts/audit-dead-exports.mjs` |
| 5 | `docs/insights/colony-deadsave-reject-design-20260924.md:213` 的在册结论本班**独立复证成立**，无需订正；但它没提"注释指向的 `OfflineProgressionService` 根本不存在"——本档 §2 补上 | `rg -n "OfflineProgressionService" --glob '!node_modules/**' .` |
