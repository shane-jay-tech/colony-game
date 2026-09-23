# colony saveGuard 守卫 × 用例对账矩阵（c923-30 段①・2026-09-23）

> 只读对账产物。**零生产码改动、零测试件改动**：本档不新增用例，因此"未坐实守卫数"改前＝改后（见第五节）。
> 段②（补 `saveGuard4.test.ts` 的 npcCountries 坏档用例）**未落地**，原因见第四节——那不是"缺用例"，
> 而是**该函数根本不产报错**，按卷宗原式写用例等于给"静默消毒"语义背书。已落 partial 交裁决。

## 一、被扫面与口径

- 守卫全集：`rg -c 'SaveLoadError\(' src/renderer/state/saveLoad.ts` → **38**；本班用 python 逐行同判据自证亦为 38 行
  （`$ python -c "... if 'SaveLoadError(' in l ..."` → 38），两处**逐位相同**：
  `208 223 227 230 233 236 239 245 253 257 260 263 276 280 284 290 293 296 378 382 386 389 402 433 443 713 719 723 727 732 735 738 742 747 753 774 803 816`
- 卷宗把 `validateNpcCountriesArray`（`:672`）列在守卫面里，但它**不在上述 38 行内**（一节即可见）：它一个 `SaveLoadError` 都不抛。
- 测试语料（存档域）：**所有引用 `saveLoad` 的 `*.test.ts`**，实测 20 件（不是只看件名含 save 的 4 件——
  那样会漏掉 `migrationGapMessage.test.ts` 这类真正点名消息的件，本班第一版判据就这么漏过，已改）。
- 抓的断言形态：`.toThrow(...)` ＋ `.toContain(...)` ＋ `.toMatch(...)`，实测仓库共 260 条，其中存档域语料内参与匹配者参与分层。
- 消息文本比较前统一折叠：`${插值}`→`#`、`[…]`下标组→`[#]`、数字串→`#`、去正则转义、压空白、转小写。
  ⇒ 测试里写 `/tiles\[2\]\.terrain is not a valid terrain/` 能对上守卫的 `` `worldMap.tiles[${i}].terrain …` ``。

### 四档判据（宁可低估覆盖，不许凭文案相似就宣布已测）

| 档 | 含义 | 判据 |
|---|---|---|
| **A 已测（文案点名）** | 断言能命中本支消息，且歧义可消 | 该片段在 38 支里**唯一**命中本支，**或**断言所在 `it` 块含本支区分词（如 buildings / resourceNodes） |
| **B 同形歧义（不计已测）** | 文案对上但对不上支 | 片段同形命中多支、块内无区分词（典型：`/must be an array/` 同时形于 `worldMap.tiles`／`worldMap.resourceNodes`／`buildings` 三支） |
| **C 仅类型点名（弱）** | 只证"这一族会抛" | 同测试文件里有 `toThrow(SaveLoadError)` 且出现本支家族词；未点名到支 |
| **D 未测（零命中）** | 连"同形片段"都不存在 | 语料里查无 |

⚠ 已知盲区（判据本身的上限，别把 A 档当"分支级覆盖已证"）：
1. 参数化循环里的 `toThrow(SaveLoadError)`（如 `saveGuard2.test.ts:55-62` 用 `[0,-3,2.5,'4']` 逐个喂 width）**确实会走到 227 支**，
   但断言不点名消息 ⇒ 按本口径只能落 C。要把这类升成 A，得改成读消息或按支拆断言，那是**改测试语义**，不属本单。
2. try/catch ＋ `toContain(模板串)` 型断言（`migrationGapMessage.test.ts:36`）里的插值变量名无法静态展开，
   行 1（`runMigrations:208`）是靠 `GAP_OLD_PREFIX` 字面量对上才落到 A 的；同类写法仍可能漏判成 C。

## 二、矩阵（38 行）

| # | 守卫 file:line | 所属顶层函数 | 报错文案摘录（静态段，插值记作 …） | 判定 | 证据（测试侧 file:line ＋ 断言原文／歧义说明） |
|---|---|---|---|---|---|
| 1 | `saveLoad.ts:208` | `runMigrations` | No migration path from schema version … to … ` + `(missing: migrations | A 已测（文案点名） | migrationGapMessage.test.ts:43 toContain('missing: migrations[5.5]') |
| 2 | `saveLoad.ts:223` | `validateWorldMap` | 'worldMap is malformed (not an object)' | A 已测（文案点名） | saveGuard2.test.ts:51 toThrow(/malformed/) |
| 3 | `saveLoad.ts:227` | `validateWorldMap` | 'worldMap.width must be a positive integer' | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 4 | `saveLoad.ts:230` | `validateWorldMap` | 'worldMap.height must be a positive integer' | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 5 | `saveLoad.ts:233` | `validateWorldMap` | 'worldMap.seed must be a finite number' | B 同形歧义（不计已测） | saveGuard2.test.ts:136 toThrow(/finite number/) ｜该片段同形命中 3 支，断言块内无区分词 a；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 6 | `saveLoad.ts:236` | `validateWorldMap` | 'worldMap.tiles must be an array' | B 同形歧义（不计已测） | saveGuard2.test.ts:107 toThrow(/must be an array/) ｜该片段同形命中 3 支，断言块内无区分词 tiles；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 7 | `saveLoad.ts:239` | `validateWorldMap` | 'worldMap.resourceNodes must be an array' | B 同形歧义（不计已测） | saveGuard2.test.ts:107 toThrow(/must be an array/) ｜该片段同形命中 3 支，断言块内无区分词 resourcenodes；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 8 | `saveLoad.ts:245` | `validateWorldMap` | worldMap.tiles.length=… does not match width*height=…`, | A 已测（文案点名） | saveGuard2.test.ts:79 toThrow(/does not match width\*height/) |
| 9 | `saveLoad.ts:253` | `validateWorldMap` | worldMap.tiles[…] is not an object | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 10 | `saveLoad.ts:257` | `validateWorldMap` | worldMap.tiles[…].terrain is not a valid terrain | A 已测（文案点名） | saveGuard2.test.ts:86 toThrow(/tiles\[2\]\.terrain is not a valid terrain/) |
| 11 | `saveLoad.ts:260` | `validateWorldMap` | worldMap.tiles[…].buildable must be boolean | A 已测（文案点名） | saveGuard2.test.ts:93 toThrow(/buildable must be boolean/) |
| 12 | `saveLoad.ts:263` | `validateWorldMap` | worldMap.tiles[…].walkable must be boolean | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 13 | `saveLoad.ts:276` | `validateWorldMap` | worldMap.resourceNodes[…] is not an object | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 14 | `saveLoad.ts:280` | `validateWorldMap` | worldMap.resourceNodes[…].kind is not a valid kind | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 15 | `saveLoad.ts:284` | `validateWorldMap` | worldMap.resourceNodes[…].position is not an object | B 同形歧义（不计已测） | saveGuard2.test.ts:120 toThrow(/position/) ｜该片段同形命中 5 支，断言块内无区分词 ?；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 16 | `saveLoad.ts:290` | `validateWorldMap` | worldMap.resourceNodes[…].position.x out of range | B 同形歧义（不计已测） | saveGuard2.test.ts:120 toThrow(/position/) ｜该片段同形命中 5 支，断言块内无区分词 ?；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 17 | `saveLoad.ts:293` | `validateWorldMap` | worldMap.resourceNodes[…].position.y out of range | B 同形歧义（不计已测） | saveGuard2.test.ts:120 toThrow(/position/) ｜该片段同形命中 5 支，断言块内无区分词 ?；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 18 | `saveLoad.ts:296` | `validateWorldMap` | worldMap.resourceNodes[…].remaining must be a non-negative number | C 仅类型点名（弱） | saveGuard2.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 worldMap，未点名本支 |
| 19 | `saveLoad.ts:378` | `deserialize` | 'Save data must be a non-null object' | A 已测（文案点名） | saveGuard3.test.ts:51 toThrow(/must be a non-null object/) |
| 20 | `saveLoad.ts:382` | `deserialize` | 'Save data missing schemaVersion field' | C 仅类型点名（弱） | saveGuard.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 Save，未点名本支 |
| 21 | `saveLoad.ts:386` | `deserialize` | 'schemaVersion must be a number' | A 已测（文案点名） | saveGuard.test.ts:77 toThrow(/schemaVersion must be a number/) |
| 22 | `saveLoad.ts:389` | `deserialize` | Save created with future schema version … (current: …)`, | A 已测（文案点名） | saveGuard.test.ts:118 toThrow(/future schema version/) |
| 23 | `saveLoad.ts:402` | `deserialize` | 'Save data missing state field' | A 已测（文案点名） | saveGuard.test.ts:95 toThrow('missing state field') |
| 24 | `saveLoad.ts:433` | `deserialize` | 'resources must be a record of finite numbers' | B 同形歧义（不计已测） | saveGuard2.test.ts:136 toThrow(/finite number/) ｜该片段同形命中 3 支，断言块内无区分词 of；本支另有类型点名 saveGuard.test.ts:61 toThrow(SaveLoadError) |
| 25 | `saveLoad.ts:443` | `deserialize` | currentDay out of range: … (allowed 0..…)`, | C 仅类型点名（弱） | saveGuard.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 currentDay，未点名本支 |
| 26 | `saveLoad.ts:713` | `validateBuildingsArray` | 'buildings must be an array' | A 已测（文案点名） | saveGuard2.test.ts:107 toThrow(/must be an array/) ｜共享片段但块内含区分词 'buildings |
| 27 | `saveLoad.ts:719` | `validateBuildingsArray` | buildings[…] is not an object | A 已测（文案点名） | saveGuard2.test.ts:111 toThrow(/buildings\[0\] is not an object/) |
| 28 | `saveLoad.ts:723` | `validateBuildingsArray` | buildings[…].defId must be a non-empty string | A 已测（文案点名） | saveGuard2.test.ts:115 toThrow(/defId/) |
| 29 | `saveLoad.ts:727` | `validateBuildingsArray` | buildings[…].position is not an object | B 同形歧义（不计已测） | saveGuard2.test.ts:120 toThrow(/position/) ｜该片段同形命中 5 支，断言块内无区分词 ?；本支另有类型点名 saveGuard2.test.ts:61 toThrow(SaveLoadError) |
| 30 | `saveLoad.ts:732` | `validateBuildingsArray` | buildings[…].position.{x,y} must be integers | A 已测（文案点名） | saveGuard2.test.ts:121 toThrow(/integers/) |
| 31 | `saveLoad.ts:735` | `validateBuildingsArray` | buildings[…].status invalid: "…" | A 已测（文案点名） | saveGuard2.test.ts:126 toThrow(/status invalid/) |
| 32 | `saveLoad.ts:738` | `validateBuildingsArray` | buildings[…].tier invalid: "…" | A 已测（文案点名） | saveGuard2.test.ts:130 toThrow(/tier invalid/) |
| 33 | `saveLoad.ts:742` | `validateBuildingsArray` | buildings[…].constructionProgress must be finite number | A 已测（文案点名） | saveGuard2.test.ts:191 toThrow(/constructionProgress must be finite number/) |
| 34 | `saveLoad.ts:747` | `validateBuildingsArray` | buildings[…].modifiers must be array of string ids | A 已测（文案点名） | saveGuard2.test.ts:143 toThrow(/modifiers must be array of string/) |
| 35 | `saveLoad.ts:753` | `validateBuildingsArray` | buildings[…].upgradingTo must be a non-empty string when present | A 已测（文案点名） | saveGuard2.test.ts:148 toThrow(/upgradingTo must be a non-empty string/) |
| 36 | `saveLoad.ts:774` | `validateSlot` | Invalid save slot name "…": must match [a-z0-9_-]{1,32}`, | A 已测（文案点名） | saveIoSemantics.test.ts:79 toContain('must match [a-z0-9_-]{1,32}') |
| 37 | `saveLoad.ts:803` | `saveToSlot` | Save to slot "…" failed: storage layer wrote nothing | C 仅类型点名（弱） | saveGuard.test.ts:61 toThrow(SaveLoadError) ｜同文件出现家族词 Save，未点名本支 |
| 38 | `saveLoad.ts:816` | `loadFromSlot` | Save file in slot "…" is corrupted (not valid JSON): …`, | A 已测（文案点名） | saveLoadIo.test.ts:31 toThrow(/not valid JSON/) |

## 三、按函数汇总

| 所属函数 | 支数 | A 已测 | B 歧义 | C 仅类型 | D 未测 | 一句话 |
|---|---|---|---|---|---|---|
| `runMigrations`（迁移断链） | 1 | 1 | 0 | 0 | 0 | 唯一被 `migrationGapMessage` 专档点名的一支 |
| `validateWorldMap`（含其内层 helper） | 17 | 4 | 6 | 7 | 0 | **最薄的族**：17 支里精确点名只有 4 支；`tiles/resourceNodes` 的子字段几乎全靠类型点名 |
| `deserialize`（顶层壳） | 7 | 4 | 1 | 2 | 0 | 消息各不相同，判得动 |
| `validateBuildingsArray` | 10 | 9 | 1 | 0 | 0 | **最厚的族**：`saveGuard2` 的 buildings 段逐支点了名 |
| `validateSlot` | 1 | 1 | 0 | 0 | 0 | — |
| `saveToSlot` | 1 | 0 | 0 | 1 | 0 | "写空了"这种 IO 半态只能类型点名 |
| `loadFromSlot` | 1 | 1 | 0 | 0 | 0 | — |
| **合计** | **38** | **20** | **8** | **10** | **0** | 未坐实到支 ＝ B＋C ＝ **18** |

两处对照先例的结论：卷宗引 `saveGuard2.test.ts:50`（实测该 `describe` 在 **`:49`**，锚点 +1 漂移——该件昨夜是他班在途件，行号随提交动过）「worldMap 深校验对抗」为格局样板，实测**恰恰是 worldMap 族的按支点名最薄**（4/17），
而 buildings 族（10 支）点名最厚（9/10）——同一件测试文件里两族的用力差了近一倍。

## 四、段②否证：`validateNpcCountriesArray` 不产错，"坏档拒载用例"无从按原式落地

卷宗段②要求：「照 saveGuard2 worldMap 对抗手法，基于 save-v9.json 变异补 `validateNpcCountriesArray` 的
**坏档拒载**用例（非数组／元素非对象／字段类型错／越界值，**按实现实取断言与报错文案**）」。实测不成立：

```
$ sed -n '672,679p' src/renderer/state/saveLoad.ts
function validateNpcCountriesArray(arr: unknown): NpcCountryState[] {
  if (!Array.isArray(arr)) return makeInitialNpcStates();          ← :673 非数组 ⇒ 静默换初值，不抛
  const out: NpcCountryState[] = [];
  for (const it of arr) {
    if (typeof it !== 'object' || it === null) continue;           ← :676 元素非对象 ⇒ 静默丢弃，不抛
    const o = it as Record<string, unknown>;
    if (typeof o['id'] !== 'string') continue;                     ← :678 id 非串 ⇒ 静默丢弃，不抛
```
- 函数体到 `:699` 结束，**零 `SaveLoadError`**（第一节的 38 行清单里没有 672-699 区间任何一行）。
- 字段级也不是校验：`stance` 钳到 -100..100、`militaryPower` 钳到 0..500、`renown` 钳到 0..200、
  `aggression` 钳到 0..100、`tradeCooldown` 取下界 0、`lastEnvoyDay/lastWarDay` 经 `finiteNum(…, -1)` 把
  **NaN/Infinity 折成 -1**（`:663` 注释自述"typeof 不过滤这两者，会绕过冷却或永久锁死"）。
  ⇒ 「报错文案」列对本支**恒空**；能钉的只有"消毒后的形状"。
- 于是按卷宗原式写用例，只会写出这样一组断言：`非数组 → 不抛且返回初值`、`元素非对象 → 不抛且被丢掉`。
  **这是在把"坏档静默消毒"钉成受保护语义**，而该语义与同族 worldMap/buildings 的"坏档即抛"是**相反的产品选择**。
  两件事因此都超出执行手授权：①判定"npcCountries 该抛还是该消毒"＝改判据/改语义（红线：门禁判据、存档兼容）；
  ②要断"钳到 ±100/0..500"＝把**外交与军力平衡数值**钉进测试（红线：经济平衡数值）。
- 同型"静默消毒"不止一处：`saveLoad.ts:609-615`（阶层迁移数组）与 `:647-649`（工程项）用同一手 `continue` 丢元素
  ⇒ 若真要处置，是一次**一族**的裁决，不是补 4 个用例能收口的。

**结论**：段②不落。`saveGuard4.test.ts` 本班**未创建**（不造"为凑判据而把现状当期望钉住"的用例）。
待人工在两条路里择一：**(a)** 认定 npcCountries 族应"坏档即抛"→ 改 `validateNpcCountriesArray` 语义（存档兼容改动，
老档含脏字段时会从"能读"变"读不开"，影响面需人工评估）后，再照 worldMap 手法补对抗例；
**(b)** 认定"消毒即正确"→ 补的用例应显式命名为**消毒语义**钉桩（并连带 `:609/:647` 两族一起钉），
而不是叫"深校验对抗"。两条都不是执行手能替产品签的。

## 五、缺口账（完成标准③）

| 指标 | 改前（本档之前） | 改后（本档之时） | 差值＝本单消化数 |
|---|---|---|---|
| 未坐实到支的守卫（B＋C） | 18 | 18 | **0** |
| 严格零命中（D） | 0 | 0 | 0 |
| 存档域守卫总数 | 38 | 38 | 0 |

"改前"与"改后"相等，是因为本班只出对账档、未新增用例（段②按第四节否证后停手）。
本档的价值不在消缺口，而在把缺口**换成可裁决的两条路**，并给出优先序建议：
worldMap 族里 **227／230／253／263／276／280／296** 这 7 支是"数组/对象子字段形状"，
变异代价低（照 `saveGuard2.test.ts:55-62` 的参数化手法把 `toThrow(SaveLoadError)` 换成读消息即可点名），
是性价比最高的一批——但那是**新增测试语义**，需主班另派写位。

## 六、复算配方

```
# 守卫全集（38）
rg -c 'SaveLoadError\(' src/renderer/state/saveLoad.ts
rg -n 'SaveLoadError\(' src/renderer/state/saveLoad.ts
# 某支是否被文案点名（矩阵每行的证据列即可这样复算）
rg -n 'defId|finite number|must be an array|is not an object' src/renderer/state/__tests__/
# npcCountries 在守卫三件里零命中（卷宗前提，成立；但件名无 saveGuard1，是 saveGuard.test.ts）
rg -c 'npcCountries' src/renderer/state/__tests__/saveGuard.test.ts src/renderer/state/__tests__/saveGuard2.test.ts src/renderer/state/__tests__/saveGuard3.test.ts
# 消毒语义现场
sed -n '672,699p' src/renderer/state/saveLoad.ts
```
分层算法（折叠规则＋四档判据）的完整实现落在 `tmp/c923-30-guard-matrix.py`，
`tmp/` 在本仓 `.gitignore:29` 内 ⇒ **脚本不入库**；矩阵每行的 file:line 证据都是独立可眼校的，
不必依赖该脚本即可复核本档。
