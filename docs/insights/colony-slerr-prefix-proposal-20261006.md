# 前缀化提案材料（c1004-12，2026-10-06，零落码）

- 承 82c6 遗留 4③（九类字段错消息不含槽位名）。差异注：c930-11 只做 :172/:186 两处 invalid slot 一致化，本单做**全量槽位前缀化**。

## 一、现值与 ^ 锚复扫

- `throw new SaveLoadError` 全文件 **43 处**（行号：208/223/227/230/233/236/239/245/253/257/260/263/276/280/284/290/293/296/378/382/386/389/402/413/447/457/683/689/694/698/764/770/774/778/783/786/789/793/798/804/825/854/867）。
- **^ 锚复扫仍零命中**：state 测试面 toThrow 总数 138，其中 `^` 锚 **0**（python 正则复扫，82c6 时期的 rg 口径结论维持）⇒ 前缀化不翻任何既有断言（全部子串/toMatch 形态）。
- 现有带槽位先例：:867 JSON 损坏消息已含 `Save file in slot "${slot}"`——前缀化即把该形态推广。

## 二、前缀化 diff 提案

- **做法**：`loadFromSlot` 的 `return deserialize(parsed)` 改为 try/catch 包裹：
```ts
try { return deserialize(parsed); }
catch (err) {
  if (err instanceof SaveLoadError && !String(err.message).includes(`"${slot}"`))
    throw new SaveLoadError(`Save file in slot "${slot}" rejected: ${err.message}`);
  throw err;
}
```
- `includes` 幂等护栏：:867 已带槽位的消息不二次前缀。
- **九类消息清单**（deserialize 域 :223-457 段，槽位前缀生效域）：①worldMap malformed；②worldMap.width/height/seed/tiles/resourceNodes 五结构类；③tiles[i] 非对象/terrain/buildable/walkable 四项类；④policy/storyFlags 类（:276-296）；⑤research/科技类（:378-389）；⑥resources 形状类（:402-413）；⑦generals/defenseAlerts（:447/:457，与 c1004-11 前后呼应）；⑧schemaVersion 类（:208）；⑨其余 deserialize 域杂类——合计 43 处中 deserialize 域 **~24 处**，其余为 save/load 通道类（已有 slot 语境或经 :867 通道）。

## 三、影响

- 零红（^ 锚 0）；UI toast/日志可定位槽位；`includes` 护栏保证不双重前缀。
- 施工顺带：deserialize 域内部 43 处**不必逐处改**（前缀在 loadFromSlot 一处统一加）——这是本提案相对「逐条改消息」的核心优势。
