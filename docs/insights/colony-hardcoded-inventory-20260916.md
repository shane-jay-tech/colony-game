# colony P1-4 terrain/scatter/audio 硬编码清单与切片设计（c916-03）

- 任务：c916-03-colony-hardcoded-inventory（created 2026-09-16T00:05:51，软预算 ≤40 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 03:3x
- P1-4 原文（OPTIMIZATION_BACKLOG.md:41）：「BootScene 以 artManifest 为唯一加载源，删除重复加载列表（现状：building/general/event 已派生（BootScene.ts:46/64/70）；terrain/scatter/audio 仍为硬编码清单（BootScene.ts:53/57/71），故未收口）」。

## 一、三域硬编码清单（rg 实测；条数与命令同段）

```
rg -n "terrain|scatter|audio|TERRAIN" src/renderer/scenes/BootScene.ts → 命中 10 行（三域加载与注释）
rg -c "" src/renderer/data/scatterConfig.ts audio.ts → 65 / 26 行
```

| 域 | 位置 | 硬编码内容 | 值/形态 |
|---|---|---|---|
| terrain | BootScene.ts:53-55（字面数组 ['plain','hills','forest','river','mountain']） | 5 型地形贴图 `art/terrain/{t}.png` | 注释声明与 manifest 命名不等价（hills vs hill、缺 3 型），h912-11 批次口径保留 |
| terrain（manifest 侧） | artManifest.ts:69-70 TERRAIN_ART | 仅 3 型且路径 .webp | 与 BootScene .png 5 型**不等价**（收口的真正障碍） |
| scatter | BootScene.ts:57-59 ← scatterConfig.ts（ALL_SCATTER_IDS） | 散布 id 全集（树/石/灌木/芦苇） | 已数据化（scatterConfig.ts:24 SCATTER_BY_TERRAIN、:54 RIVER_EDGE、:58 前缀），BootScene 经 import 引用——**半收口** |
| audio | BootScene.ts:76-79 ← state/audioDirector（ALL_BGM_KEYS/SFX_KEYS）；audio.ts AUDIO_CUES 26 行（volume 0.6/0.4/0.7 等逐条硬编码） | BGM/SFX 键集＋音量 | audio.ts 音量为内容常量（26 行） |

## 二、切片表（每片 ≤40 分钟；片号/目标/验收命令/写集）

| 片 | 目标 | 验收命令 | 写集 |
|---|---|---|---|
| S1 | terrain manifest 补齐：TERRAIN_ART 扩 5 型、命名统一（hills）＋与落盘文件名对齐 | `npx vitest run src/renderer/data/__tests__`（artManifest 测试）＋ node 校验 5 路径 exists | artManifest.ts（+2 型/改路径）；art/terrain/ 落盘文件名如不一致需资产侧先对齐 |
| S2 | BootScene terrain 改派生 | BootScene.ts:53-55 改遍历 TERRAIN_ART；BootScene 相关单测 | BootScene.ts |
| S3 | scatter 收口核验 | 确认 ALL_SCATTER_IDS 唯一来源＝scatterConfig（BootScene 已 import）＋补 1 条「无第二来源」守卫测试 | 测试文件 |
| S4 | audio 收口 | audioDirector 键集与 AUDIO_CUES 对齐断言 | audioDirector.ts＋测试 |

依赖：S2 依赖 S1；S3 独立；S4 独立。写集边界：S1-S4 均不触 done/任务书，不碰存档兼容层。

## 三、声明

rg 命中数与清单条数一致（terrain 5 型/scatter 全集/audio 26 行常量——三域都有明确硬编码，无「零命中」域）；未实施切片；不改源码与文档勾选状态；不 push。

## 遗留问题

S1 的前置＝art/terrain/ 落盘文件命名核实（hills vs hill 的差异是资产侧历史命名），建议切片开工前先盘点资产目录。
