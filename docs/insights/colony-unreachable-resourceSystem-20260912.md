# colony resourceSystem.ts 不可达模块处置报告（h912-14，2026-09-13 夜班）

任务：按 PLAN.md:31 二分规则（移除或接入）处置 state/resourceSystem.ts；本单只处理该模块，不动 storyNpcs.ts / terrainTextures.ts。

## 一、引用取证（rg 原文，区分两类）

```
$ rg -n 'resourceSystem' --glob '!**/node_modules/**'
docs\history\SLICE_A_SPEC.md:137:## DELIVERABLE 3: src/renderer/state/resourceSystem.ts      ← 历史规格（非代码）
docs\history\SLICE_A_SPEC.md:287:### src/renderer/state/__tests__/resourceSystem.test.ts      ← 历史规格（非代码）
tmp\reach_table.md:86:| src/renderer/state/resourceSystem.ts | 2 | 0 | 0 | 1 | 0 | 疑似不可达（仅测试引用） |  ← 盘点工件
src\renderer\state\__tests__\resourceSystem.test.ts:2:import { computeDayDeltas, tickModifierLifecycle } from '../resourceSystem';  ← 自身 legacy 测试
docs\decisions\2026-06-07-impl-labor-occupancy-model.md:29 ← 历史决策：「该函数当前未被调用（已被 computeProductionTick 取代）」
docs\decisions\2026-06-15-impl-health-fixes-and-music-verify.md:13 ← 历史决策（测试夹具修补记录）
```

- **生产路径引用：0**；仅自身 legacy 测试引用 1 处。
- 佐证：2026-06-07 决策明确 computeDayDeltas 已被 computeProductionTick 取代、仅留防误引 guard。

> 注：任务书所引 `docs/insights/colony-module-reachability-20260911.md` 不存在（rg ls 实证）；盘点表实际在 `tmp/reach_table.md:86`，结论一致（疑似不可达，仅测试引用）。本单以自取证的 rg 原文为准。

## 二、处置：移除（二分的「删」支）

- 备份：`tmp/backup-colony-20260912/state/resourceSystem.ts`（79 行）＋ `tmp/backup-colony-20260912/state/resourceSystem.test.ts`（168 行）。
- `git rm src/renderer/state/resourceSystem.ts src/renderer/state/__tests__/resourceSystem.test.ts`。
- 该测试文件 import 的其余模块（gameStore/schema/resourceRegistry/mapGen/factionSystem）均为被其他测试共享的活模块，未受影响；无 barrel 再导出（rg 实证零命中）。

## 三、类型与测试门

- 命令：`npm run type-check`（= `tsc -p tsconfig.renderer.json --noEmit`；仓库根无 tsconfig.json，裸 `npx tsc --noEmit` 会落 help——沿用 h912-11 报告口径）。
- 改后：type-check **exit 0**（无新增错误）；`npm test` → **86 files / 1120 tests 全部通过**（改前 87/1127——恰减被删 legacy 测试 7 条，零新增失败）。

## 四、进度

PLAN.md:31 条目（不可达模块退役）：**已处理 1/3**（resourceSystem.ts ✓；storyNpcs.ts / terrainTextures.ts 留后续两单）。

## 遗留问题

- 恢复方式：从 tmp/backup-colony-20260912/state/ 拷回两文件即可（tmp 不入库，git 历史亦保留全量内容）。
- storyNpcs.ts / terrainTextures.ts 处置同规则，留 h912-14 后续单/批次二。

## 五、勘误追加（c927-71，2026-09-29T05:1x，colony62 班；**本节为纯插入，上方正文一字未改**）

改判出处＝`docs/insights/colony-retired-backup-verify-20260922.md`（c922-115 遗留 1 给主班的改判：本档 :39 与 `colony-retired-render-20260917.md` :13 两句"备份语义反向"）。

1. **:39「从 tmp/backup-colony-20260912/state/ 拷回两文件即可」的保障方向与实况相反。** 该 tmp 目录被 `.gitignore:25 tmp/` 覆盖 ⇒ 不受 git 看守、不进 `git status`、只活在当前这块盘；真正可靠的一层是 git。本班 2026-09-29 现跑（HEAD `6fbeb23`）：
   - `$ git check-ignore -v tmp/backup-colony-20260912/state/resourceSystem.ts` → `.gitignore:25:tmp/`（rc=0）
   - `$ git merge-base --is-ancestor aad0592 origin/codex/architecture-hardening` → **rc=0**（退役提交本体已在远端）
   - `$ git show aad0592^:src/renderer/state/resourceSystem.ts | wc -l` → **79**；同法取 `.test.ts` 归一后 md5 `a4ab0681c11c88a3e1d3d86f349e5710`
   - ⇒ **恢复路径以 git 为唯一权威**：`git show aad0592^:src/renderer/state/resourceSystem.ts > src/renderer/state/resourceSystem.ts`。:39 括注「git 历史亦保留全量内容」其实才是主路，tmp 是最弱一层。
2. **备份状态现值（本班现点；两件自写入后 mtime 未变、零删零改）**：`tmp/backup-colony-20260912/state/resourceSystem.ts` **3435 B / 2026-09-13 01:08:46.586**；`resourceSystem.test.ts` **6024 B / 2026-09-13 01:08:46.623**。
3. **内容与 git 无差（本班重跑 c922-115 判据，逐位同其 9/22 读数）**：本档两件 raw md5 `00031b532cf3d692ce9225d035bc6f22` / `fce03c64384e0a03316a9e74b1d75be6` **≠** git 侧 `d8877bb08a024bdc7abdf1dff400c20c` / `a4ab0681c11c88a3e1d3d86f349e5710`；`tr -d '\r'` 归一后**两侧全等** ⇒ 差异只是 `core.autocrlf=true` 的行尾（字节差恰等于行数：3356/3435 Δ79、5856/6024 Δ168，与本档 :24 记的 79／168 行吻合）。
4. **立项前提改判**：原「tmp 清理前必须留档」证据不足——内容 100% 在 git 且在远端。裁决材料在 c922-115 产出档 §九（含「移进 `_archive/` 同样被 `.gitignore:26` 忽略 ⇒ 不算留档」这条排雷）。
5. **本档正文的其余前提本班复核未漂**：:24 两件行数 79／168 ✓；:30 的 `npm run type-check`＝`tsc -p tsconfig.renderer.json --noEmit` 口径 ✓（仓根无 `tsconfig.json`）；:31 的 86 files／1120 tests 属**历史时点读数**，本班**未跑全量**（按 2026-09-29 纪律：pre-commit 全量门被前手在途件 `src/renderer/ui/__tests__/hudRefreshCost.test.ts` 常红），故不据现值翻改该数。
