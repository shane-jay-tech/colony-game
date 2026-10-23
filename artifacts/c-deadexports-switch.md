# dead-exports 工具 tests-only 降格开关材料单（c1023-16，两案并陈·零改动）

> 任务书：c1011-02 遗留「3 名 tests-only→internal-only 的降格若主班认为过严（测试 import 也算某种消费），可加开关」。**开关加否＝口径裁决归主班，本单只出材料**；colony-game 工作仓零改动（本件与 result 为全部产出）。

## 一、工具现行口径（读码留痕，scripts/audit-dead-exports.mjs @ a3eba14）

| 面 | 现行行为 | 出处 |
|---|---|---|
| 扫描对象 | 生产面＝src 非 `__tests__` .ts（128 件）；测试面＝`__tests__` 子树 .ts/.mts（B-151 口径） | :13-24、:26-51 |
| 值导出收集 | `export const\|function\|class\|let`（interface/type 不收） | :53 |
| **掩蔽计数**（c1011-02 aff4efd） | 其它文件（**含测试文件**）的 `import` 语句与 `export {...}` 再导出块整段掩蔽，命中落在这些行不计——「import≠消费」口径 | :69-115（classifyLines→linesOf→countHits） |
| 分桶 | dead（非测试 0＋测试 0）｜tests-only（非测试 0＋测试>0）｜internal-only（文件外 0 但本文件 ≥2 次） | :136-142 |
| 守卫 | G1 自比对 sha＋G2 结构不变量（bucket↔hitsInTests 自洽＋朴素重扫逐条一致，naive 重扫与 walkTests 同口径） | scripts/__tests__/auditDeadExportsEquivalence.test.ts |

## 二、3 名现值（2026-10-24 实跑，summary=122{dead 1, testsOnly 98, internalOnly 23}）

| 名 | 位置 | 现桶 | hitsInTests | 同文件自用（internal-only 成立的原因） | 测试 import 行 |
|---|---|---|---|---|---|
| TRADE_AGREEMENT_CONFIG | diplomacyExpanded.ts:41 | internal-only | 0 | :106（`stance < minStance` 闸） | diplomacyExpanded.test.ts:5（多名单行 import） |
| ALLIANCE_CONFIG | diplomacyExpanded.ts:54 | internal-only | 0 | :142（`stance < stanceRequired` 闸） | diplomacyExpanded.test.ts:6 |
| PERSONALITY_MUL | diplomacyExpanded.ts:67 | internal-only | 0 | :75（军力结算乘子） | diplomacyExpanded.test.ts:6 |

三名的「tests-only→internal-only 降格」机理：测试文件对它们的唯一引用是 import 行，c1011-02 掩蔽后 testHits 归零；同文件自用 ≥2 次故落 internal-only（**非 dead——删除会炸同文件生产逻辑**，两桶都不是「可删」信号）。

## 三、开关方案（案 B 载体设计：`--count-test-imports`）

- **语义**：旗开时，测试文件的计数不再跳过掩蔽行（import 行命中照计）；生产文件掩蔽**无条件保留**（c1011-02 盲区根治不回退——桶再导出掩护面在生产侧）。
- **默认关**：缺省口径维持「import≠消费」（与 dead-exports 语义一致，c1011-02 定谳口径不变）。
- **实现量级预估**：countHits 加参（或 linesOf 传旗）约 5-8 行；`--out` JSON 的 rule 字段加旗标注；G2 朴素重扫同笔加旗（守卫件 2 处）。
- **守卫耦合**：G1 sha 随旗变（旗开/关各成自洽集）；G2 的 naive 重扫必须与默认旗态一致，否则守卫误红——实施单须同笔改。

## 四、影响面量化（本单实扫）

- 复活面＝「dead/internal-only 且测试 import 行有命中」的条目：**恰 3 名**（全 internal-only，各 1 条 import 行命中）——无 dead 复活，OFFLINE_REWARD（唯一 dead）测试 import 零命中不受影响，其余 21 名 internal-only 同不受影响。
- 旗开后 summary：122{1, 98, 23} → 122{1, **101**, **20**}；3 名 hitsInTests 0→1、桶 internal-only→tests-only。
- 在档 JSON（docs/insights/colony-dead-exports-20260914.json，2026-09-18 旧口径 108{0,108,0}）与现值已脱节——两案任一落地时建议随批 `--write` 刷新在档 JSON（附 .bak 机制自带）。

## 五、两案利弊表

| 维度 | 案 A：不加开关（维持现口径） | 案 B：加 `--count-test-imports`（默认关） |
|---|---|---|
| 口径一致性 | ✓ import≠消费＝dead-exports 语义本义；「测试 import 了但测试体没用」恰是**测试断言缺口**的信号，降格把该信号显式化 | 旗开时口径变宽：import 即算消费 ⇒ 「测试只 import 不用」的信号被吞 |
| 3 名处置指引 | internal-only 明示「文件内自用、非死、export 面存疑」——若主班要收 export 面，走 internal-only→去 export 化（c1023-15 乙案 D 类已有先例） | tests-only 明示「测试面在用」——但实际上测试体零断言引用，指示偏乐观 |
| 守卫/维护成本 | ✓ 零改动 | +5-8 行工具＋G2 守卫同笔＋rule 字段版本注 |
| 溯源/复现 | ✓ 单一口径，历史对拍（tmp/dead-before/after-c1011-02.json）可直接续读 | 双口径并存：旗态须随档记（JSON rule 字段），否则跨时点对比失真 |
| 语义正字性 | ✗ 「测试 import 也算某种消费」的主张被硬拒——若主班认为测试依赖面本身有价值（如公开 API 契约钉），现口径无法表达 | ✓ 给主班保留口径选择权，且默认关不改变现行为 |
| 对 3 名的净效果 | 维持 internal-only（更保守的判罚） | 复活为 tests-only（桶位回 9/18 旧口径形态，但计数口径仍异） |

## 六、裁决辅助（非建议）

- 3 名无论落哪个桶都**不可删**（同文件生产自用实证）；桶位之争只影响「下一步处置单的方向」：internal-only → 收 export 面（去 export 化）；tests-only → 补测试体断言（让引用成真）。
- 若采案 B，建议实施单同时落：旗态入 rule 字段＋G2 同笔＋在档 JSON 刷新；若采案 A，建议在 c1023-15 三面复核底稿的 D 类（模块内自用去 export 化）排期面点名 3 名。
