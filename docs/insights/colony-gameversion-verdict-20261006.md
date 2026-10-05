# 存档快照无 gameVersion 字段材料（c1004-07，2026-10-06，只读）

- 承 6938 L1。**现值**：存档信封唯一版本坐标=`schemaVersion`（saveLoad.ts:32，现值 **9**；迁移族 :125-193 共 9 步 1→9）；**gameVersion（应用版本，如 0.10.0）不存在**——seedSnapshotDeterminism.test.ts:207-209 以 🔴 否证断言**主动钉死**「信封里没有 gameVersion」（键集双面：env 顶层＋state 内都不许出现）。schema.ts:442 同域（SerializedSave 形状面）。

## 一、现状语义

- schemaVersion 是**数据结构版本**（驱动 migrations 逐级回填，:202 `migrations[version]` 链）；它回答「这份档的结构是哪代」。
- gameVersion 是**应用发布版本**——现值系统没有这个轴 ⇒ 「这份档是哪个版本的程序写的」不可知；排障时只能靠 schemaVersion 粗定位（结构代差 ≠ 发布代差：同一 schemaVersion 可跨多个 app 版本）。

## 二、两案

### 加字段案（信封加 gameVersion）

- **做法**：serialize 时写 `gameVersion: __APP_VERSION__`（vite define 注入 package.json version——构建期常量，运行期零读取成本）；deserialize 对未知键**透传不校验**（老迁移链不动）；快照确定性测试 :207-209 的 🔴 否证断言**翻正**为「gameVersion 在场且等于构建版本」。
- **老档兼容**：读旧档无 gameVersion ⇒ 回填 `"unknown (<schemaVersion 9)"` 或缺省不写（展示层判空）——迁移步骤零步（纯加性键，schemaVersion 不 bump：结构未变只加元数据）。
- **红名单**：seedSnapshotDeterminism 两断言（同笔翻正）＋快照确定性例（键集变化会改 JSON.stringify 指纹——**注意**：若快照黄金件含信封全文，加键即变指纹，需重钉并注明「+gameVersion 元数据键」）。
- **收益**：排障「档来自哪版程序」可答；配合崩溃上报可按版本聚合。

### 维持案（schemaVersion 单轴＋文档化）

- 零改动；排障口径=「schemaVersion N 代≈某 app 版本区间」靠 git 考古（migrations 表演进对照 package.json 历史）。
- 代价：每次排障都重复考古；无版本聚合能力。

### 对照结论

加字段案是**纯加性低风险**（唯一硬点=确定性快照指纹重钉）；两案差异在「排障工效」不在「正确性」（现状不坏，只是盲）。建议排批与 s1002-40 案(a)（session_state 横幅族）同波（同为 saveLoad 域小改）。

## 附：现值命令

```
$ grep -n "schemaVersion = " src/renderer/state/saveLoad.ts   # :133/:137/…/:193 共 9 步迁移链
$ sed -n '207,209p' src/renderer/state/__tests__/seedSnapshotDeterminism.test.ts  # 🔴 否证断言
```
