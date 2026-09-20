# colony STORY_BALANCE 现值重盘（c919-07，只读零改动）

- 执行: sweep-20260919-1343（GLM-5.3-Flash）
- 实测时戳: 2026-09-19 15:50–15:53（date 实测）
- 现值出处: `src/renderer/data/balanceConfig.ts:83-97`（工作树 clean，`git diff HEAD` 零 diff）
- 旧值出处: 0905 时点 git 快照＝`54eafe9`（2026-08-13「快照提交 6-7 月工作树」，该文件最后一次提交；0905 基线报告 economy-params-inventory-20260905.md **未收 STORY_BALANCE 段**，本单以 git 快照补基线）
- 关联: c918-25 遗留「STORY_BALANCE 重盘可选」；c918-25 只盘了沙盒 BALANCE

## 一、逐键对照表（STORY_BALANCE 9/5 快照 vs 现值）

| 键 | 9/5 值（54eafe9） | 现值 | 漂移 |
|---|---|---|---|
| startingResources.wood | 100 | 100 | 无 |
| startingResources.stone | 40 | 40 | 无 |
| startingResources.people | 30 | 30 | 无 |
| startingResources.grain | 320 | 320 | 无 |
| startingResources.gold | 50 | 50 | 无 |
| startingResources.cloth | 40 | 40 | 无 |
| startingResources.bronze | 25 | 25 | 无 |
| time.msPerDay (1/2/3) | 2000 / 1000 / 500 | 2000 / 1000 / 500 | 无 |
| event.minDaysBetween | 40 | 40 | 无 |
| population.baseHousingCap | 55 | 55 | 无 |
| population.growthRatePerDay | 0.02 | 0.02 | 无 |
| population.minDailyGrowth | 1.2 | 1.2 | 无 |
| population.homelessDeclineRate | 0.02 | 0.02 | 无 |
| population.homelessDeclineMax | 2 | 2 | 无 |

## 二、结论与注记

1. **零漂移**：STORY_BALANCE 全部 14 键与 9/5 时点逐字节一致；该文件最后一次提交＝2026-08-13（54eafe9），9 月以来零触及。
2. **基线报告缺口（顺带发现）**：0905 基线盘点（economy-params-inventory-20260905.md）只收了沙盒 BALANCE，STORY_BALANCE 段缺席——c918-25 沿用该口径故只盘 BALANCE；本单已用 git 快照补齐故事表基线，后续重盘以本表为旧值出处即可。
3. 数值语义注记（只读，不动值）：grain 320＝30 民×30 粮/天约 11 天起步窗口（BUG-B 注释口径）；msPerDay 与沙盒同表；minDaysBetween 40 短于沙盒 50（故事节奏更密，既有设计）。
4. `npm test` 全量 **111 文件/1227 测试全绿**（零改动状态实测）。

## 复跑命令

```bash
git show 54eafe9:src/renderer/data/balanceConfig.ts | sed -n "/export const STORY_BALANCE/,/^};/p"
git diff HEAD -- src/renderer/data/balanceConfig.ts   # 空＝零漂移
```
