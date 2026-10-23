# B-152 终态核验表（c1023-19，移除+守护终态 vs 变体补图——只出佐证·零改判）

> 任务书：c1011-05 遗留「B-152 行终态：按 n1010-10 台账建议『改判 done＋注记（以移除+守护为终态）』——若主班裁『要变体补图』则翻守护 ③ 走新设计单」。**BACKLOG 改判归主班**（D:/code/docs/night-plans/BACKLOG.md:199 本单零触碰）；本件＝终态核验佐证表。取数 2026-10-24，colony-game HEAD 9120759。

## 一、两面现值（台账 × 守护）

| 面 | 现值（实测） | 出处 |
|---|---|---|
| BACKLOG 台账行 | `B-152 \| L3 \| colony scatter 贴图 rock_cluster 缺盘补图（清单 10/磁盘 9；现态＝引用已移除用 rock_boulder 顶替）… \| queued \| 09-17 19:52 规划脑投递（审稿 unreviewed）`——行内已带 **10-09 决议#19** 注（colony 资产清理执行批同域） | D:/code/docs/night-plans/BACKLOG.md:199（只读核，零改动） |
| 资产现值 | ALL_SCATTER_IDS/SCATTER_ART **8 项＝磁盘 8 webp 一一对应**，rock_cluster.webp 不在盘、rock_boulder.webp 在役——「清单 10/磁盘 9」的缺口前提**已消失** | `ls public/art/scatter/`（c1023-10 实测 8 件）；c1011-05 判读 |
| 台账建议源 | n1010-10 销项复核组：「B-152（c922-108 partial，**主判据已落仅文档尾项**）——建议改判 done 或销项」；其遗留 2：「partial 尾项（文档收尾）体量极小，可裁『行内注记文档尾项随销』一并对平」 | zcode-bridge/done/n1010-10.result.md:15/:45 |
| ⚠ 台账本体漂移 | `tmp/n1010-10/ledger.md` **已不在盘**（c1010-09 曾记「台账与素材全在」）——内容以 done/n1010-10.result.md 为准 | `ls tmp/n1010-10/` → No such file |

## 二、守护测试现值（rock_boulder 顶替形态，五哨兵全绿 @ a3eba14 全量）

| 守护 | 断言内容 | file:line |
|---|---|---|
| ③ rock_cluster 否定＋池概率钉 | rock_cluster 不在 ALL_SCATTER_IDS／**SCATTER_ART（c1023-10 扩展）**／地形池；hills 0.22／mountain 0.42 概率结构不变 | src/renderer/data/__tests__/scatterAssets.test.ts（test ③，c1023-10 后同锚 SCATTER_ART） |
| 逐键磁盘对账 | ALL_SCATTER_IDS 8 键每键有实存 webp＋孤儿白名单恒空（多一个即红） | scatterDiskReconcile.test.ts:10-43 |
| 唯一来源守卫 | BootScene 无散布字面清单，加载派生自 artManifest.SCATTER_ART（c1023-10 权威换代） | scatterSourceGuard.test.ts |
| 配置注释自证 | 「rock_cluster 移除（n916d-22）：public/art/scatter/ 无此贴图…rock_boulder 为既有等价岩石素材，池概率结构与散布语义不变」 | scatterConfig.ts:42-44 |
| 生成器停产链 | gen_scatter_art.py:48 仍留 rock_cluster prompt 条目（重跑会再产孤儿）——c923-18 停产链＋c1023-13 台账§8 停产件标注列在册 | scripts/gen_scatter_art.py:48 |

运行时零引用实证：`rg -n "rock_cluster" src/ scripts/`（排测试）＝仅 scatterConfig.ts:42 注释留痕＋gen_scatter_art.py:48 生成器条目，**零运行时消费**。

## 三、改判 done 佐证（五条）

1. **缺口前提消失**：任务书锚「清单 10/磁盘 9」→ 现值 8/8 全对齐（c1011-05 判读＋本单实测复核一致），「缺盘补图」失去标的。
2. **移除+守护＝设计态而非临时态**：守护③注释自证「防静默缺失回潮（rock_cluster 事件）」（n916d-22 建哨→c922-108 材料在案）；c922-108 曾核「临时」二字在 scatterConfig 出现 0 次——非临时顶替，是被守护的终态。
3. **演进方向背书**：c923-18 把「资产清理+停产」定为该域惯例（bush_dry 先例：停产→守护→台账§8 标注）；补图逆行。
4. **台账侧自身两次建议收口**：n1010-10「建议改判 done 或销项」＋c1011-05「荐销项（维持 8 贴图形态）」。
5. **主判据已落**：n1010-10 核 c922-108 partial「主判据已落仅文档尾项」，尾项体量极小可随销。

## 四、补图翻转条件（若主班裁「要第 10 张岩石变体」→ 新设计单域）

| # | 翻转动作 | 落点 |
|---|---|---|
| 1 | 翻守护③：删 rock_cluster 三重否定断言＋重设池概率钉 | scatterAssets.test.ts（test ③） |
| 2 | 池结构重调：rock_boulder 单元素池（0.22/0.42）→ 双元素概率重分配（**产品面拍板**） | scatterConfig.ts:40-51 |
| 3 | manifest 入表：SCATTER_ART 增第 9 项（c1023-10 后清单权威在 artManifest）＋artManifest.test 计数 63→64 | artManifest.ts SCATTER_ART 段 |
| 4 | PIL 派生补图（c1011-05 已验 PIL 12.2.0 在位、rock_boulder.webp 可作母本）＋盘面孤儿对账随动 | 生成器/资产批 |
| 5 | 停产链反向翻：gen_scatter_art.py:48 条目转正产＋c1023-13 台账§8 标注列更新 | 生成器域 |
| 6 | 测试计数基线随批（1947→+n）＋pre-commit 全量 | 常规 |

## 五、裁决选项（供主班勾选）

- **甲（c1011-05/n1010-10 双荐）**：BACKLOG 行改判 **done＋行内注记**（「以移除+守护为终态；文档尾项随销；变体补图诉求若有另立新设计单」）——零代码零资产动作。
- **乙**：维持「要变体补图」→ 翻第四节六条件走新设计单（补图+翻守护+池重调一笔）。
- 无论甲乙：本单零改判、零代码、零资产——执行权全在主班。
