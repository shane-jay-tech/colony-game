# dead-field 三枚归并裁决材料（c1007-23，2026-10-07，只读零生产码改动）

> 承 e118/a239/ad32 三单遗留归并。**现值复核（10-07）：三枚全部仍为 dead-field，零接线变化**。
> 与在途件 colony-dead-exports-20260914.json 零冲突（本档独立新档，不引用不改写该件——其在途 M 留痕未触）。

## 证据卡 1：walkable（tile 连通性标记）

- 定义：src/renderer/data/mapSchema.ts:17（`walkable: boolean`）；赋值集中 mapGen.ts:40/50/54/58（地形生成）；持久化校验 saveLoad.ts:262（`typeof rec['walkable'] !== 'boolean'`）。
- rg 命中面：全仓 8 处，**全部为 mapGen 写入/schema 声明/saveLoad 校验**三环路；`rg '\.walkable'` 排除三环后命中 0 ⇒ 无任何寻路/移动消费方读它（e118「拥堵=连通性是空概念」现值复核一致）。
- 处置两案：删＝动 mapGen 三赋值＋schema 字段＋saveLoad 校验＋存量存档兼容迁移（旧档含该键需迁移或宽松读取）；启用＝需新写移动/寻路系统消费它（新功能立项非修 bug）。

## 证据卡 2：lastTickTimestamp（gameStore tick 时戳）

- 定义/初始化：gameStore.ts:214（声明）/331（`= 0`）；saveLoad.ts:502（兜底 `= 0`）。
- rg 命中面：全仓 11 处，**全部为声明/初始化/兜底三环路**；`rg 'lastTickTimestamp\s*='` 排除 `: 0` 形态后 0 命中 ⇒ 无任何 tick 循环写入它（a239 判定现值一致）。
- 处置两案：删＝动 gameStore 两处＋saveLoad 兜底＋存档兼容（旧档键宽松读取即可，成本低）；启用＝在 tick 循环写 `performance.now()` 并接入暂停/恢复语义（需要 tick 系统设计输入）。

## 证据卡 3：badgeRules.priority（角标规则优先级）

- 定义：src/renderer/data/buildings.ts:19/:83/:111 等（`{ condition, badge, priority: 10 }` 规则数组，schema.ts:89 `badgeRules: BadgeRule[]`）。
- rg 命中面：`badgeRules` 生产消费＝**仅数据文件自身＋schema 类型声明**；`priority` 字段全仓 **零运行时读取者**（无 `.priority` 消费、无 evaluate/sort 引用；测试 4 件仅 fixture 传空数组或结构断言）。ad32「有名无实」现值一致。
- 处置两案：删字段＝动 buildings.ts 多处规则行＋schema.ts＋4 测试 fixture（机械，但**丢设计意图**——优先级择一显示是合理产品方向）；接线启用＝角标渲染处按 priority 排序择一（需 UI 角标消费点立项——当前角标显示逻辑在哪/是否多角标并存待查，启用成本高于删）。

## 归并建议（交主班一格裁决）

三枚同属「声明+写入+持久化三环路齐全、唯独无读者」形态。建议裁决序：walkable/lastTickTimestamp 删（成本低、无设计意图损失）→ badgeRules.priority 单独裁（删丢意图 vs 启用需 UI 立项）。

## 零冲突/零改动自证

- colony-dead-exports-20260914.json 在途 M：本班零触碰（diff 自证：本班活动面仅本新档＋tmp 无）。
- 生产码零改动：rg/git status 只读。
