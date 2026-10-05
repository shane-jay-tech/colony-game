# SaveData.version 死版本字段处置材料（c1004-15，2026-10-06，只读）

- 承 b461 遗留 6。**现值复核**：schema.ts:423 `version: string; // '0.7.0'` 在位零漂移。**零读者实锤**：①saveLoad 只用 `schemaVersion`（number 轴，SAVE_SCHEMA_VERSION=9，:19/:201 while 迁移链）；②`"0.7.0"` 字面量全仓（src+tests）唯一命中=该注释本身；③`SaveData` 接口的 `.version` 属性消费 0 处（saveMatrix 的 `.version` 全是 schemaVersion number，不同字段）。**字段是类型定义层的死条目**——serialize/deserialize 都不产出/读取它（真存档 JSON 里亦无此键，仅类型声明的幽灵成员）。

## 一、两案与触发条款对照

### 删字段案

- 做法：删 schema.ts:423 一行（+注释）。
- **触发条款引用**：「存档兼容域→在册升级硬触发」（c927-22-savehash-impl-design.md:5「本档只出设计不落码」同域纪律；c927-59 :3 登记两单命中该触发）。**命中判定**：删的是**类型声明成员**而非存档 JSON 实键（真档零此键= deserialize 零读 = 删除不改变任何序列化输出）⇒ 严格说**不触存档兼容面**——「能读变拒读」风险为 0（类型层收紧，TS 编译期即可发现若有隐藏消费者，现值 0 消费者=编译必绿）。
- 红名单：零（0 消费者）；`npm run type-check` 一跑即验。
- 前置小坑：interface 若被外部 `as SaveData` 断言构造（字面量须含全字段）——`rg -n ": SaveData|as SaveData" src/` 现取：构造点若含 version 键需同删（预估 0-1 处）。

### 改注释案

- 做法：:423 改 `/** 未使用，实际版本轴见 saveLoad.ts SAVE_SCHEMA_VERSION */ version?: string;` 或直接标 `@deprecated`。
- 零红零风险；代价=幽灵成员永续（后续读者仍要花一次「这字段谁用」的考古——本单即此考古的产出）。

## 二、建议

**删字段案**——触发条款经判定**不命中**（类型声明成员非存档实键，零运行时面），零红可删；若主班从严把「改 SaveData 接口」一律视为硬触发，则退改注释案（@deprecated），二者皆一行级。
