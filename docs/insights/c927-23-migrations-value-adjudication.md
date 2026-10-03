# c927-23 migrations 全 8 步价值裁决材料（E5+E6 综合判读）

> 来源：`zcode-bridge/done/20260925-154159-e29e.result.md` 遗留 2（E5 谎标版本擦 4 字段＋E6 迁移层对真缺字段老档净贡献 0 ⇒「只 redundancy 不 protection」）＋在册设计稿 `colony-migration-deserialize-dualwrite-design-20260924.md` §2.2/§2.3。
> 复核基线 HEAD `8a9eaea`。零码改动，全部只读读数；判定留主班。

## 0. 一个关键精化：链骨架是 protection，注入行才是 redundancy

e29e 的「只 redundancy 不 protection」判语对**注入行为**成立；但对**步骤函数的存在性**不成立——`runMigrations` 逐级查表、缺一步即抛 `No migration path … missing: migrations[N]` **拒载**（saveLoad.ts:198-217；n916x-34 守护实测「临时禁用 migrations[8] → 18 failed」）。因此正确切分是：

> **迁移链的版本号推进骨架＝protection（删步即拒载老档）；每步体内的「无条件注入默认值」行＝redundancy（兜底层同源全覆盖）且带擦除面。**

本档裁决材料按此两层展开。

## 1. 八步逐条分类表（完成标准①）

注入行分类口径：**redundant**＝`deserialize` 兜底层对缺键注入同值（E6：稀疏 11 键老档标 v1 走全链 vs 标 v9 零迁移，校验和逐位相同 `9b1951cb…=9b1951cb…`）；**擦除面**＝该步注入行在谎标版本真档上产生过净损失（E5 逐字段读数）；**保护性**＝仅指步骤存在性（缺步即拒载）。

| 步 | 版本 | 注入键 | 分类 | 擦除面实测（E5） |
|---|---|---|---|---|
| 1 | 1→2 | `populationClasses`、`conversionQueue`、`grainNegativeDays` | 注入行 redundant | 🔴 v1 档 2 键：`populationClasses {farmer:42,worker:4,…}→{farmer:46,worker:0,…}`（玩家阶层结构被重置）、`grainNegativeDays 13→0`（饥荒计数清零） |
| 2 | 2→3 | `factionState`、`megaProjects`、`exclusivePolicies` | 注入行 redundant | 无读数损失（E5 v2/v3 起点未列此三键＝注入值与真档现值同或档缺键） |
| 3 | 3→4 | `publicWrath`、`lastWrathDemandDay` | 注入行 redundant | 无读数损失（同上口径） |
| 4 | 4→5 | `worldWariness`、`lastWarinessReason` | 注入行 redundant | 🔴 v1–v4 档 1 键：`lastWarinessReason "国格晋阶"→null`（警示原因被抹） |
| 5 | 5→6 | `lastPropagandaDay` | 注入行 redundant | 无读数损失 |
| 6 | 6→7 | `relicSites` | 注入行 redundant | 🔴 v1–v6 档 1 键：`relicSites` 1 条（序列化 305 B）→ `[]`（**玩家遗产实体被清空，E5 最重损失**） |
| 7 | 7→8 | `endgameAscendDay`、`endgameLastWaveDay` | 注入行 redundant | 无（v7/v8 起点 0 键被改写） |
| 8 | 8→9 | `wrathUltimatumEndDay` | 注入行 redundant | 无（v7/v8 起点 0 键）＋**删行仍绿直接实证**（§2） |
| 骨架 | 1→…→9 逐级推进 | —（schemaVersion=N+1） | **protective** | 缺任一步 → `No migration path` 拒载；删注入行保留骨架则全绿（§2）⇒ 保护价值全部在骨架 |

E5 损失-步骤归因：v1 档损失 4 键 = 步 1（2 键）＋步 4（1 键）＋步 6（1 键）；v2/v3/v4 损失 2 键 = 步 4＋步 6；v5/v6 损失 1 键 = 步 6；v7/v8 零损失。

## 2. 证据引用（完成标准②；全部为 e29e/dualwrite 在册实测，本班复核其锚点仍在）

```
$ sed -n '110,131p' D:/code/zcode-bridge/done/20260925-154159-e29e.result.md
E5 · 无条件覆盖造成的字段擦除（谎标版本的真档，逐字段读数）… ⇒ 15 个注入键里实测有 4 个在真档谎标下产生净损失
E6 · 等价性与幂等 … sparse_layersEquivalent=true, sparse_divergingKeys=[] ⇒ 对"真·缺字段老档"，迁移层净贡献为 0
$ sed -n '77,84p' docs/insights/colony-migration-deserialize-dualwrite-design-20260924.md
§2.2 判别力归零的直接实跑：整行删掉 migrations[8] 注入行 → npx vitest run {saveMatrix,saveV9Fixture,saveIoSemantics,saveGuard3,ultimatum,saveLoad}
  rc=0  Test Files 6 passed / Tests 全绿 ⇒ 今天没有任何一条用例能证明 migrations[8]（注入行为）存在
$ sed -n '86,97p' 同稿
§2.3 分叉面考古：15 个注入字段 state首现 commit == saveLoad首现 commit（同一笔，git log -S 全量）
  ⇒ 本仓历史存档不可能在低版本带上"该版本还不存在"的键；无条件覆盖的擦除面只打谎标/手改档与未来的「先加字段后补 bump」
```

## 3. 收窄建议（完成标准③；供拍板，非本单执行）

| # | 建议 | 动作面 | 效果 | 代价 |
|---|---|---|---|---|
| 收-1 | **注入行加护栏**：8 步全部改 `if (!(k in s)) s[k] = default`（缺才注，有则留） | saveLoad.ts migrations 表 ~15 行 | E5 全部擦除面归零；redundancy 语义保留为「缺字段默认」而非「无条件重置」；dualwrite §2.2 已证测试只断结果值 ⇒ 现有断言应仍绿（落地时按 §2.2 同法实跑验证） | 最小 diff，一单可收；**推荐默认案** |
| 收-2 | **注出行全删、只留骨架**（dualwrite 案 B 侧）：8 步变纯 `schemaVersion+1` 直通 | migrations 表 -20 行 | 兜底层单源化；与 dualwrite 的案 A/案 B「单一事实源」裁决绑定——**不可单独拍**，须与该稿一起出改判单 | 行为与收-1 在历史档上等价（§2.3 考古），差异只在未来的「先加字段后补 bump」档：案 B 保留玩家误带值、案 A/收-1 也不清（有护栏后） |
| 收-3 | **结构合并**：8 步体内注入清单改声明式 `DEFAULTS_BY_VERSION: Record<number, string[]>`＋通用直通函数，版本推进骨架不变 | 同表重构 | 行为与收-1 后等价，防未来再犯「注入即覆盖」手误；与收-2 互斥二选一 | 中等重构，纯等价变换 |
| 收-4 | **维持现状＋登记**：不改码，只把 E5/E6 结论挂待人工台账 | 0 码 | 擦除面继续存在（只打谎标/手改档） | 零 |

**可合并/可删除清单**（完成标准③附项）：
- **可合并**：步 2/3/5/7/8 的注入行形态完全同构（「N 个新增键 → 安全初值」），声明式合并零语义损失（收-3）。
- **不可删除**：8 个步骤函数**本身**（骨架 protection，n916x-34 守护在位）。
- **可删除（条件）**：全部注入**行**（收-2），条件＝与 dualwrite 案 A/B 单一事实源裁决合并拍板。

## 4. 零码改动自证（完成标准④）

本档只读成稿：引用面为 e29e/dualwrite 两份在册实测＋saveLoad.ts 锚点复核（sed 只读）；`git status` 零新增（本档自身 untracked 交主班代提交）；未跑任何测试（E5/E6/§2.2 的实跑数据全部引用在册读数，不复跑、不产生新写入）。

## 5. 遗留问题

1. **收-1 vs 收-2 的捆绑关系**：收-2（删注入行）本质是 dualwrite 稿案 B 的迁移侧动作，该稿的案 A/案 B 还涉及 deserialize 兜底层是否收敛——两稿必须一张改判单出，勿拆开执行。
2. 收-1 落地单的验收必须含 dualwrite §2.2 同款实跑（删护栏复测红/复装绿），防止「护栏版注入」也被测试恒绿掩盖回归。
3. E5 的 `populationClasses` 重置读数（farmer:42→46, worker:4→0）提示步 1 的 `createDefaultPopulation(people)` 以当档 people 总数重算阶层——即使加护栏，**档缺 populationClasses 键时**仍按 people 总数分配默认阶层，该默认分配是否合理属产品语义，留主班（非本档范围）。
