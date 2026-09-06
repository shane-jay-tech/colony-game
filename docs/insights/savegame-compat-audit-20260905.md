# 存档兼容性测试体系审计（只读，2026-09-05 夜 1025）

> 对象：`src/renderer/state/saveLoad.ts`（SAVE_SCHEMA_VERSION=9，migrations 1→8 全链）× 三个测试包（saveLoad 45 + saveGuard 14 + saveGuard2 17 = 76 用例）。
> 只读承诺：src/tests/fixtures 零改动（提交前 git status 核查）。

## 一、版本 × 覆盖矩阵

| 版本断点 | 迁移内容（saveLoad.ts:122-195） | 测试覆盖现状 |
|---|---|---|
| v1→v2 | 注入 populationClasses/conversionQueue/grainNegativeDays | ✅ saveGuard:39「v1→v9 迁移注入 populationClasses」（唯一迁移链用例） |
| v2→v3 | factionState/megaProjects/exclusivePolicies | ❌ 无独立断言（仅作为 v1→v9 链路中段被路过） |
| v3→v4 | publicWrath/lastWrathDemandDay | ❌ 同上 |
| v4→v5 | worldWariness 基线 | ❌ 同上 |
| v5→v6 | lastPropagandaDay | ❌ 同上 |
| v6→v7 | relicSites | ❌ 同上 |
| v7→v8 | endgameAscend/WaveDay | ❌ 同上 |
| v8→v9 | wrathUltimatumEndDay | ❌ 同上 |
| 未来版本 | — | ✅ schemaVersion=999 抛 future（saveLoad:97）；边界值 10 未单独测（同 class） |
| 缺版本号/类型错 | — | ✅ missing/null/number 输入四连（saveLoad:102-110） |
| 损坏字段 clamp | speed 异常五连 | ✅ saveLoad:114-138（仅 speed 一族） |
| worldMap 深校验 | 断代/长度/terrain/buildable/seed/width | ✅ saveGuard2 17 用例 + legacy 无 worldMap 重生成（saveLoad:139） |

## 二、缺口清单（每条有证据）

1. **中间版本入口无测试**：runMigrations（saveLoad.ts:197-207）支持任意 fromVersion 起步，但 76 用例中只有 v1 起点——v4/v7 等中间档存档回读行为零覆盖。证据：grep 迁移相关测试仅 saveGuard:39 一条。
2. **「No migration path」分支零覆盖**：migrations 是 Partial Record（:122），若某版本函数缺失，:202 抛错路径从未被任何用例触发。证据：grep "No migration" 测试目录零命中。
3. **截断/半损坏存档无防御测试**：损坏类只测了 speed 数值 clamp 与 worldMap 结构；JSON 截断（字符串半截）、顶层缺 state 键、state 为 null 三类未测。证据：saveLoad.test.ts:96-138 范围内无此类。
4. **迁移保真性无断言**：每个迁移只验证「注入新字段」，未验证「不破坏既有字段」（如 v3→v4 后 resources 是否原样）。v1→v9 全链用例只断言了 populationClasses 一个注入点（saveGuard:45 注释自认）。
5. **schemaVersion 边界值**：999 测了，10（恰好 future+1）未单列——低优先（同类路径）。

## 三、钉桩设计骨架（不实现，供 saveGuard3）

1. `中间版本起步：v4 存档（手工构造最小 blob）→ v9 可读且注入 worldWariness 基线`——fixture 来源：不用 git 历史恢复，直接按 migrations 反向剥离字段构造（比恢复旧档更可控）。
2. `中间版本起步：v7 → v9 注入 endgame 两字段且 relicSites 保留`。
3. `migration 缺失：构造 schemaVersion=5.5（浮点）或 monkeypatch migrations[6] 删除 → 抛 /No migration path/`。
4. `截断 JSON：serialize 产物切一半字符串 → deserialize 抛 SaveLoadError（不抛 SyntaxError 裸异常）`。
5. `顶层缺 state：{schemaVersion:9} → 明确 SaveLoadError 信息`；`state:null 同类`。
6. `迁移保真：v3 存档带 grain=123 → v9 后 grain 仍 123（逐迁移不丢字段）`。
7. `schemaVersion 恰为 10 → future 报错信息含 "10"`。

## 四、saveGuard3 候选用例清单（供日间拍板）

上节 7 条骨架即候选全集，建议优先级：#4/#5（损坏防御，玩家真实痛点）＞ #1/#2（中间断代，升级用户）＞ #3/#6（回归保险）＞ #7（边界）。预估一包 10-12 用例（7 骨架 + 变体），预算 35 分钟，与 saveGuard2 同风格（构造 blob、只断行为、可疑处 TODO 注释）。

## 五、零改动声明

提交前 `git status`：仅新增本报告；saveLoad.ts、三个测试包、`_archive/` 零触碰。
