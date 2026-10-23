# PLAN Work Items 复核单 A（#1-#2 段现值核验）——c1023-20，2026-10-24

> 取数时点：2026-10-24 02:30±，colony-game HEAD＝`50296ae`（本班 c1023-06 刚落）；分支 `codex/architecture-hardening`。
> 口径：逐条「条款声称态 vs 代码/测试现值（含 c1023-01..05 若已闭合则计入门——现值未闭合，见 A-9）」；在上批 c1023-22 对账（artifacts/c-doc-drift.md §二）基础上全量复验并刷新。零改动（本单只出核验表，PLAN.md 不动）。

## 一、#1 Establish a reproducible baseline（4 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :21 Create `codex/architecture-hardening` from `master` | `$ git branch --show-current` → `codex/architecture-hardening`（本班 5 笔提交均落此分支） | ✓ |
| :22 snapshot commit after sensitive-file audit | 44c57f8「2026-10-21 工作区快照提交」在链（更早 54eafe9/15769cb 同族）；.gitignore 守卫在役（dist/tmp/user-data 不入库，c1023-24 探针失明面实证） | ✓ |
| :23 install from lockfile + run existing verification | package.json:19 `"verify": "npm run type-check && npm run test && npm run test:perf"`；本班 pre-commit 全量绿 ×5（02:08/02:14/02:24 前后，type-check 0 错） | ✓ |
| :24 record pre-existing failures before edits | 历史基线档在册：`docs/insights/colony-test-baseline-20260921.md`、`colony-suite-timings-20260921.json`、c927-42 baseline-refresh、perf 单跑隔离记录（vitest.config.ts 注释） | ✓ |

## 二、#2 Repair composition and feature reachability（5 条）

| 条款（PLAN 行） | 现值实测 | 判定 |
|---|---|---|
| :28 story 固定 roster 接线（sandbox 保留种子随机） | **本班 c1023-06（50296ae）落地**：`STORY_NPC_ROSTER`＝8 国池全量（npcCountries.ts:145-152）＋`GameStore.startStoryRosterNpcs()`＋IntroScene.tryStart story 分支 `startStoryMode→startStoryRosterNpcs`（:574-576）、种子随机归 sandbox 分支（:577-580）；钉：storyNpcRoster.test 5 例＋IntroScene.test 改钉 2 例（story 次序 story→roster、sandbox 随机 4 国保留）。**对 c1023-22 P2「❌ 未达成」的翻正留痕** | ✓（本班落地） |
| :29 save/load in-game UI（Electron IPC＋saveLoad.ts） | `SaveLoadPanel.ts`＋`src/main/index.ts`/`src/preload/index.ts` IPC 桥在位（rg ipcMain/saveLoad 双命中）；SaveLoadPanel.test 9 绿＋saveLoad 域测试群（saveLoad 50/saveGuard×3/atomicSaveCrash/lie.Version 迁移等） | ✓ |
| :30 asset manifest 权威 boot 源＋删重复清单 | c1023-10（a3eba14）收口（c1023-22 P3 已证）：SCATTER_ART 8 项入 ART_MANIFEST、BootScene 直取 path；本班 fresh 探针：`requiredTrue=61 requiredFalse=2 / requiredTrueMissing=0 / diskArtFiles=65 / orphans=4`（63 键双向差集 0，c-b152-final 同口径） | ✓ |
| :31 remove superseded modules（或接线保留） | 退役先例：storyNpcs（7d3aee3）、pack-sprites＋依赖（c1001-03/dc1936d）、不可达模块三件（c927-43 复点 B 栏空）；**残余面**：dead-exports 122 名三桶（1/98/23）有双守卫测试（auditDeadExportsEquivalence/Readonly）＋c1023-15/16 材料待裁——「残余在册有守卫」非条款阻塞 | ✓（残余在册注记） |
| :32 stale/unreachable startup config：接线或删 | 退役路线闭环（c927-43/c922-114：承接件不在盘、需求侧已点名规划域）；现役入口＝ModeSelectScene→IntroScene 一致流程（ModeSelectScene.test 4＋Shutdown 3＋IntroScene 立国链路真链测试） | ✓ |

## 三、门条件与交叉项

- **c1023-01..05（gameStore 拆分五批）未闭合**（outbox/done 零 result、git log 零命中、porcelain 零在途——c1023-26 三路同证）：#2 段门条件不受其影响；相关影响计入门在 #4 段（B 单复核域）。
- 完成标准 ：81「Story and sandbox startup select the correct NPC strategy」：**本班后为全真**（story=固定 roster、sandbox=种子随机，双向钉在）。
- 段内共 9 条：✓×9（其中 :28 为本班翻正、:31 带在册残余注记）。

## 四、证据命令

```
$ git branch --show-current
codex/architecture-hardening
$ rg -n '"verify"' package.json
19:    "verify": "npm run type-check && npm run test && npm run test:perf"
$ rg -ln "ipcMain|saveLoad" src/main/ src/preload/
src/preload/index.ts  src/main/index.ts
$ npx tsx scripts/art-exists-check.mts | tail -4   # :30 现值（本班实测）
requiredTrue=61 requiredFalse=2 / requiredTrueMissing=0 / diskArtFiles=65 / orphansArtFiles=4[×manifest_portraits_*.json]
$ git log --oneline -1 --grep="c1023-06"
50296ae feat(story): c1023-06 story固定NPC roster接线…
```

## 五、遗留与建议

1. :28 落地后的文档翻正属他班档案（c-doc-drift.md P2 行、c1023-07 result 遗留）——按纪律不代改，主班对账时收口。
2. :31 残余面（dead-exports 三桶）待 c1023-16 两案裁决；裁决前守卫双测试维持在役即可。
3. 本单零改动；PLAN.md 原文未动。
