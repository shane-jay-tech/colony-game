# colony toPhaserStyle/getExclusionGroup 死码处置材料（n916x-33）——标的已不存在，核验收口

**结论：两函数已随 63dca27（2026-09-17 11:27，用户 9/17 晨拍板「按 916-01 报告应删清单」）作为 9 条静态真死导出一并删除——本单建单时点（9/16 21:12）早于删除落地，前提已被授权执行推翻。patch 草案不再需要（处置已完成且验收更充分：词边界全文件型零引用核验＋动态接线候选 3 条证伪＋type-check 0 错＋全量 1153 绿）。本单按核收口处理，零改动。**

## 一、零引用复跑（命令与数字同段）

```
$ rg -n "toPhaserStyle|getExclusionGroup" src          → 0 命中（src/ 全域含 __tests__）
$ rg -n "toPhaserStyle|getExclusionGroup" . --no-ignore -g '!node_modules' -g '!.git'
  → 仅 4 处非源码命中：tmp/dead-exports-check.json（审计快照）、
    docs/insights/colony-dead-exports-20260914.json（+.bak）（审计案卷）、
    docs/insights/colony-deadexports-readonly-20260916.md（报告表述）——均为记录性提及，非代码引用
```

## 二、删除在案证据（提交级）

```
$ git log -S 'toPhaserStyle' -- src/  → 63dca27 2026-09-17 11:27 refactor: 删除 9 条静态真死导出（…getExclusionGroup…toPhaserStyle…）；全仓零引用（词边界全文件型核验，含动态接线候选 3 条证伪）；type-check 0 错、全量 1153 绿
$ git log -S 'getExclusionGroup' -- src/ → 同上 63dca27
```
本班独立佐证：今晚 n916f-08 全量 `npm.cmd test` 实测 94 文件 1153 用例全绿（23:07），删除后的基线健康。

## 三、处置建议（替代原两方案）

- 方案 A（删除）与方案 B（@deprecated 保留）的抉择已由用户拍板执行＝方案 A，且验收强度（词边界核验＋全量绿）高于本单草案可承诺的水平——**无遗留动作**。
- 唯一残留建议：tmp/dead-exports-check.json 等审计快照属临时案卷，日间可随 tmp/ 清理策略一并处置（不入 git）。

## 四、验收情况

- ✅ 零引用复跑命中数（src=0）与报告一致（命令同段）；✅ 删除在案证据为提交级 hash（63dca27）＋本班全量绿实测；✅ 零删除零改动未 push。

## 遗留问题

无。
