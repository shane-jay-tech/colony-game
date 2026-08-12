# Implement: 拆除建筑（收尾占用制闭环）

Date: 2026-06-07
Supersedes: none（承接 2026-06-07-impl-labor-occupancy-model.md）

模式：deep（核心交互；占用制收尾）

## 背景
刚上的占用制是单向的：建筑只能建不能拆，占用的劳力还不回来（DeepSeek 在占用制复审里也点到）。补"拆除"闭环。

## 落地
- gameStore：STATE_EVENTS 加 BUILDING_REMOVED；`removeBuilding(instance)` —— 按引用或位置匹配（位置唯一；调用方可能传 getState() 的 structuredClone，纯引用匹配会失效，故加位置兜底）→ splice 移除 → 返还 50% 非民材料(setResourceClamped + RESOURCES_CHANGED reason='building_refund') → emit BUILDING_REMOVED。释放占用劳力由 getEmployedLabor 自动重算。
- GameScene：removedListener 订阅 BUILDING_REMOVED → rerenderBuildings；shutdown off。
- BuildPanel：BUILDING_REMOVED 接到 onUnlock（拆除释放劳力→可建判定变；可能锁回以其为前置的建筑→重排）。
- BuildingPopover：新增红色"拆除"按钮，**两段确认**（首点→"确认拆除？再点一次"，再点才真拆）→ removeBuilding + toast + hide。totalH/demolishY 按真实布局适配（升级行有/无两种情况）。

## 协作
- 健康检查 3 relay OK。
- **GPT relay 持续 RemoteProtocolError 掉线**，gpt-coder 降级到 DeepSeek 底座出草案（且中文串有 GBK 乱码）。Opus **逐行核对真实代码**后重写落地（BuildingPopover 的常量/颜色/cy 布局流/totalH 都按真实文件适配，未采信草案的占位假设）。
- 本次未单独发起 DeepSeek 评审：拆除是刚 deep 审过的占用制的小收尾，状态逻辑简单+已测+按位置匹配硬化，UI 已逐行核对；布局视觉留用户眼验。

## 验证
type-check 干净；`npm test` **643 passed**（+removeBuilding 移除/释放劳力/返还/重复拆 false 测试）；`electron:build:win` 成功。

## 待眼验
拆除按钮在 popover 里的位置/高度（升级行有无两种情况下不应重叠/溢出）；两段确认手感。

## 给用户摘要
点建筑弹窗里加了红色"拆除"按钮（两段确认防误触），拆掉返还半数材料、释放占用的劳力——占用制闭环补完。
