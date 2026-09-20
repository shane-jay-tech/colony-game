# colony 启动配置分支可达性全量核验（916p-a3-009，2026-09-17，只读）

## 一、启动链路文件清单（命令与数字同段）

```
$ find src/main -type f        → 1 文件：src/main/index.ts（Electron 主进程，226 行）
$ ls src/renderer/scenes/*.ts  → 6 文件：BootScene / GameScene / IntroScene /
                                 ModeSelectScene / TransitionScene / UIScene
$ ls src/renderer/main.ts      → 渲染入口（185 行，Phaser.Game 实例化 :55）
链路合计 8 文件（main/index.ts + renderer/main.ts + 6 场景）。
```

## 二、逐文件可达性（每文件一条 rg 与命中数，排除 __tests__）

| 文件 | rg 命令 | 命中数 | 判定 |
|---|---|---|---|
| BootScene.ts | rg -n "BootScene" src/ --glob '*.ts' --glob '!**/__tests__/**' | 17 | 可达（main.ts:3/52 注册＋autostart） |
| GameScene.ts | rg -n "GameScene" … | 33 | 可达 |
| IntroScene.ts | rg -n "IntroScene" … | 15 | 可达（main.ts:4/52） |
| ModeSelectScene.ts | rg -n "ModeSelectScene" … | 11 | 可达（main.ts:4/52） |
| TransitionScene.ts | rg -n "TransitionScene" … | 10 | 可达（main.ts:52） |
| UIScene.ts | rg -n "UIScene" … | 33 | 可达（main.ts:52） |
| main/index.ts | rg -n "main/index" src/ | 2 | 可达（electron 入口引用） |
| renderer/main.ts | rg -n "main.ts" src/main/index.ts | 2 | 可达（主进程加载渲染入口） |

无「仅测试可达」文件。

## 三、已退役 3 件零命中复核（exit=1 原文）

```
$ rg -c "resourceSystem|terrainTextures|storyNpcs" src/ -g "*.ts"
（无输出，exit=1）——退役 3 件零命中复核通过
```

## 四、结论

**启动配置全量复核已收口**：8 个链路文件全部可达、无仅测试可达/不可达启动配置分支；退役 3 件（resourceSystem/terrainTextures/storyNpcs）零残留。

覆盖到的文件数＝8（main/index.ts、renderer/main.ts、6 场景）。

已知非本审计范围的遗留（在 BACKLOG P1-4 在案、非启动配置分支）：terrain/scatter/audio 三处硬编码资产清单未走 artManifest（BootScene.ts:53-55/57/71）——属资产清单权威化口径，非可达性问题。

## 五、验收对照

- ✅ 链路清单条数=8（find/ls 命令同段）。
- ✅ 每文件一条 rg 与命中数同段。
- ✅ 退役 3 件零命中 exit=1 原文。
- ✅ 结论二选一：已收口＋覆盖文件数 8。
- ✅ 零删除/零 import 改动/零提交；不 push。
