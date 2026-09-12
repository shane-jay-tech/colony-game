# colony saveGuard2：constructionProgress 钳制 + resources shape 校验（2026-09-12 夜间执行班，任务 p911r-40）

> 执行：GLM-5.3-Flash 夜间执行班 sweep-20260911-2300。**未改存档 JSON schema（格式契约不变）；未 commit/push。**
> ⚠️ **任务书前提修正**：任务书写「clamp 到 [0,1]」——磁盘事实是 constructionProgress 为 **0–100 百分比**（`gameStore.ts:1017` `+= (100/time)*mul`、`:1020` 完工=100；既有 saveLoad 测试样例全部用 100）。按 [0,1] 钳制会把所有真实存档的进度毁掉。本单按磁盘事实实现 **[0,100] 钳制**，意图（越界钳制）不变、数值域修正。

## 一、改动

| 文件 | 内容 |
|---|---|
| `src/renderer/state/saveLoad.ts:415-425` | 新增 resources shape 校验：`s.resources` 必须是「有限数值」记录（非数组、每值 typeof number 且 isFinite），否则 `throw SaveLoadError('resources must be a record of finite numbers')`；通过后以 `GameState['resources']` 类型进入状态 |
| `src/renderer/state/saveLoad.ts:712-716,731` | constructionProgress 保留「finite number」硬校验，**新增 [0,100] 钳制**（越界值来自损坏档，游戏语义为百分比） |

## 二、新增用例（saveGuard2.test.ts +2，suite 17→19 全过）

1. `constructionProgress 越界钳制`：150→100、-5→0（deserialize 返回值断言）；
2. `resources 非有限数值记录`：`{wood:'ten'}` 与 `{wood:NaN}` → 均抛 SaveLoadError。

## 三、连带更新（1 处既有测试）

`saveGuard.test.ts:100-106` 原钉住测试「resources 为字符串：现状被原样保留（**可疑**）」——该可疑 TODO 恰是本单加固目标，已更新为「抛 SaveLoadError（p911r-40 shape 校验已收口）」。

## 四、验证（全绿）

```
$ npx vitest run
Test Files  86 passed (86)
Tests       1125 passed (1125)      ← 基线 1123 + 本单 2
$ npx tsc --noEmit  → 退出码 0
```

## 五、零 schema 契约声明

存档 JSON 的字段名/结构未变（仅对已存在的 constructionProgress/resources 字段做值域收紧与类型校验），写档格式契约不变。

## 六、遗留问题

- [已收口] saveGuard.test.ts 原「resources 字符串可疑」TODO 随本单消除；
- resources 负数值当前放行（语义上允许负债型资源为 0 下限与否属经济平衡数值拍板，未擅动）。
