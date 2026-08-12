# Implement: 民居原画重做样板（对齐根治探索）+ "民"资源纪元式显示

Date: 2026-06-06
Supersedes: none（承接 2026-06-06-impl-building-anchor-alignment.md 的"原画是对齐瓶颈"结论）

## 原始需求（用户原话）

> 先试试民居吧，另外民这种容易引起误会的资源改成纪元那种显示形式
> 我觉得你在美术生成的时候，可以先自我迭代一下提示词，把质量弄高一点

## 背景

上一轮结论：建筑对不齐的根因是 AI 原画自带院墙/院子/树、按自身透视画、超出建筑格子。要"质量最好的"对齐必须重做原画为"单格内自包含、透明背景、精确 2:1 等距"。用户同意先试民居，并要求生成时自我迭代提示词提质量。

## 做法（GPT relay 今日掉线，Opus 直接执行美术管线 + 代码）

### A) 民居样板生成（self-iterating prompt，wan2.7-image-pro）
新脚本 `scripts/gen_house_test.py`（D:\code\scripts），并行出变体到 art-library/house_test。
- **第 1 轮**：V1 极简 / V2 带树院。确认"建筑收进单个等距菱形地块、黑底"方向成立。
- **第 2 轮（按用户要求提质量）**：prompt 加"建筑占地块 70-80%、masterpiece/award-winning/razor-sharp/8k/volumetric light"等质量词；出 V3 干净草庐 / V4 带棚农家院。**选 V3**（最干净、最适合基础民居、茅+瓦顶贴合"草庐"）。
- `scripts/key_black_bg.py`：边缘泛洪抠黑底→透明（保留屋顶内部暗部，66% 像素转透明）。
- V3 抠图后替换 `public/art/buildings/bld_house.png`（原图备份于 art-library/house_test/bld_house_ORIGINAL_backup.png）。
- 重跑 gen_building_anchors.py：bld_house 新锚点 = anchorX 0.5005 / anchorY 0.824 / footW 0.9697（识别到干净菱形）。

### B) "民"纪元式显示
- `gameStore.getHousingCap()`：与 runPopulationTick 同口径（baseHousingCap + sumHousingCapacity，经 country_population_cap modifier）。
- `HUD.refreshResources()`：people 特判为 `现有/上限`（如 0/40），跳过数字 tween。理由：民是建造消耗+回涨的人力池，单显"民0"被误读为没人。

## 验证
type-check 干净；`npm test` 636 passed；`npm run electron:build:win` 成功刷新 dist-out。

## 待用户验收
1. 民居在游戏里是否对齐 + 质量是否满意 → 满意则用同管线（gen→key→anchor）重做其余 19 栋。
2. "民 X/Y" 显示是否清晰。

## 注
- GPT-5.5 Pro relay 今日持续掉线，本轮代码与美术由 Opus 直接执行。
- DeepSeek 复审：本轮以美术/显示为主，代码改动小（store getter + HUD 特判 + 已审过的锚点系统），未单独发起 deep 评审；锚点系统本身已于同日 deep 审过。
- 完美对齐天花板仍受 AI 原画透视限制；V3 路线是"明显变好"，非像素级保证。
