# addBags 源头产 NaN 中间态修法裁决材料（c1004-01，2026-10-06，只读）

- 承 6c4b L2。**现值复核**：resourceRegistry.ts addBags def 已移至 **:104-111**（矿 :109-117 漂移 −5，实现零漂）：`av + bv !== 0` 才写格 ⇒ **任一侧 NaN 时 `NaN !== 0` 为 true，整格写入 NaN**（本班 node 直算复现：`addBags({wood:100},{wood:NaN})` ⇒ `{"wood":null}`——JSON 序列化后 NaN→null，运行时内存里是真 NaN）。

## 一、消费方 rg 清单（逐行）

| 位置 | 性质 |
|---|---|
| resourceRegistry.ts:104 | **定义点**（唯一生产定义） |
| data/__tests__/resourceRegistry.test.ts:36/:40 | 正常路径钉桩（合并/空袋） |
| state/__tests__/priceBoundaryClamp.test.ts:17/:99-104 | **NaN 语义钉桩**（现钉=「累加可 NaN，但 canAfford(NaN)=false」——矿源闸口拦住的现状契约） |
| **生产码消费方：0 处** | rg 全仓（排除测试）addBags 仅定义点命中 |

**要点**：addBags 当前是**无生产消费方的导出函数**（6c4b 时点「被非价格路径消费」的形态已随重构消失；价格累加路径现走 priceBoundaryClamp 域的 gameStore.addResource——其自带 NaN 全局拒绝闸，priceBoundaryClamp.test:108-111 在册）。矿源「收窄面外溢风险大于收益」的依据已随消费方清零而**失效**。

## 二、源头修两案（各带非价格路径外溢逐点标注）

### 案 A：NaN/±Infinity 入参显式抛错

```ts
if (!Number.isFinite(av) || !Number.isFinite(bv)) throw new RangeError(`addBags: non-finite ${id}`);
```
- 影响逐点：①priceBoundaryClamp.test:102-104「累加可 NaN」钉桩**必红**（翻正为 expect(throw)）；②无生产消费方 ⇒ 零运行时外溢；③未来消费方（若接线价格累加）将 fail-fast 而非静默产 NaN。
- 红名单：1 例（已知、设计内）。

### 案 B：NaN 夹 0＋日志

```ts
const av = Number.isFinite(a[id]) ? a[id]! : 0;   // bv 同型
```
- 影响逐点：①同钉桩红（NaN 袋结果变 0 合并——「累加可 NaN」断言仍红）；②静默吞错：上游 bug（NaN 源头）被夹 0 掩盖，产出「看似正常」的错误库存——与 6c4b「闸口拦住」哲学相反（把可见异常变不可见）；③零运行时外溢（同 A）。
- **案 B 的静默吞错与 c925-6c4b「NaN 静默放行」教训同构**（把 NaN 变成不可见），不推荐。

## 三、差异注与建议

- c927-05 裁「负库存进门」（canAfford 域）、c927-06 裁「展示层 formatRate」、本单裁**源头产 NaN**——三层互不重叠。
- **建议**：案 A＋同笔翻正 priceBoundaryClamp:102-104（两笔一体）；另注：addBags 现无生产消费方，也可顺势评估降级为测试工具函数（是否保留导出交主班）。
- 统计数值红线：两案均零平衡数值改动（纯入参校验/夹取）。

## 附：复现

```
$ node -e "…addBags({wood:100},{wood:NaN})…"  →  {"wood":null}（内存 NaN，JSON 化为 null）
$ rg -n "addBags" src/ --glob '!**__tests__**'  →  仅 resourceRegistry.ts:104 定义点
```
