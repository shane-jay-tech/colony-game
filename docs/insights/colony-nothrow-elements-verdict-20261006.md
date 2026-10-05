# defenseAlerts/generals 元素缺字段 NO_THROW 收口材料（c1004-11，2026-10-06，只读）

- 承 82c6 遗留 4。**现值定位**：saveLoad.ts **:563-565**（generals map：`String(g.id)` ⇒ 缺 id 得 `"undefined"` 串、loyalty 兜 80）与 **:567-568**（defenseAlerts map：`{...a}` 浅拷 ⇒ 缺字段的 `{}` 原样入列）。**兜底输出样例实证**（node 直跑）：generals 缺 id ⇒ `[{"id":"undefined",...}]`；defenseAlerts 缺字段 ⇒ `[{},{"severity":"warn"}]`。**不抛**（NO_THROW 实锤）；null 元素则两处都会抛 TypeError（`g.id`/`...null`）——矿源「NO_THROW」口径限**对象元素缺字段**形态。
- 与 Slice-G「不让坏值沉默渗透」口径冲突实锤（82c6 原判）。

## 一、收口两案

### 案 A：元素级校验（复用 saveGuard 消息族）

- 做法：两 map 内逐元素 `typeof g === 'object' && g !== null && typeof g.id === 'string'` 检查，非法元素 `throw new SaveLoadError("saveGuard: generals[n] 非法元素…")`（消息族照 saveGuard「slot + 路径」形）。
- **老档拒读风险评估（R-2 同族「能读变拒读」）**：
  - 触发前提=存量档的 generals/defenseAlerts 数组里**已有**缺 id 元素。生产分布未普查（本单只读不扫库）——**风险敞口未知**，这是与 R-2 同判「高危」的唯一理由；缓解=先落「全量对账脚本」（只读扫真档统计坏元素数，0 条即可安全切 throw）。
  - 红名单：badSampleRestore.test 若有「缺字段数组静默通过」现状例需同笔翻正（rg 现取 :229 只有崩溃面负断言，预估零翻红或 1 例）。
- 附加收益：`"undefined"` 作主键渗入将领域（后续 loyalty 操作/展示按 id 查找会串行）的风险一并消灭。

### 案 B：维持兜底＋计数观测

- 做法：兜底保留，命中缺字段时 `console.warn`＋`this.state`（或模块级）计数器。
- 老档影响=零（永远能读）；代价=坏数据继续进域（id="undefined" 串），观测靠控制台。
- 红名单：零。

## 二、建议

**先 B 后 A 两步走**：B 的计数器跑一段拿真档坏元素分布 → 0 条则安全切 A；非 0 则先出数据修复单再切。与 R-2「能读变拒读」高危族纪律一致。
