# colony audit-dead-exports.mjs 只读化改造（n916f-04）

- 班次：日间续班（用户令继续）
- **语义演进说明**：本单与 n916d-25 同脚本两段制单。n916d-25（42ef2c5）已落「默认写原路径＋.bak 保护」；本单按更优语义演进为 **默认只读（无参数零写盘）**，`--out`/`--write` 分别显式指定输出/刷新默认——彻底消除「只读复核即覆盖」副作用（n916c-17 披露终清偿）。判定逻辑与计数口径零改动。

## 一、改后参数语义

| 调用 | 行为 |
|---|---|
| `node scripts/audit-dead-exports.mjs` | **只读**：仅打印 scanned/entries/summary，零写盘 |
| `... --out <path>` | 写指定路径；目标已存在先 `.bak` |
| `... --write` | 写回默认 JSON（`docs/insights/colony-dead-exports-20260914.json`）；已存在先 `.bak` |

## 二、实跑核验（命令在前）

```
$ node scripts/audit-dead-exports.mjs
[read-only] 未指定 --out/--write：仅打印，不写任何 JSON
scanned files=123 entries=108 summary={"dead":0,"testsOnly":108,"internalOnly":0}
rc=0
$ stat -c %Y docs/insights/colony-dead-exports-20260914.json   # 跑前＝跑后
1789604998 → 1789604998   （只读语义实证：默认 JSON mtime 不变）

$ node scripts/audit-dead-exports.mjs --out tmp/dead-exports-check.json
rc=0  （新文件生成；默认 JSON mtime 仍 1789604998＝未触碰）
```

## 三、entries 计数＝108（≠116，差异全归因）

| 时点 | entries | 事件 |
|---|---|---|
| n916c-17（9/16） | 116 | 基线 |
| n916d-23（本班 08:25） | 117 | **+1**＝artManifest 新增 `BUILDING_ART_REUSE` 导出（n916d-25 已录） |
| 63dca27（**另一日间会话**，用户 9/17 晨拍板） | **108** | **−9**＝删除 9 条静态真死导出（ALL_BREATHING/TRAIT_NAMES/getMegaProject/getExclusionGroup/MAP_ZOOM_STEP/MODE_REGISTRY_KEY/BUILD_MODE_EVENTS/PANEL_BOX_SHADOW/toPhaserStyle，与本班 tmp 前后快照 diff 逐条吻合） |

116＋1−9＝108 ✓ 差异全归因、无未解释条目。分桶（dead 0／testsOnly 108／internalOnly 0）与判定逻辑未改。

## 四、并发会话观察（如实记录，非本班产物）

核验期间发现 colony 仓有**另一日间会话在位**：63dca27（9/17 晨删 9 导出，工作树另存 MapRenderer.ts 4+/3- 未提交改动）——与本单只读核验无冲突，本班未触碰该文件。

## 五、回退方式

`git revert <本提交>` 恢复 n916d-25 语义（默认写原路径＋.bak）；再 revert 42ef2c5 可回到固定路径直写原型。

——完。
