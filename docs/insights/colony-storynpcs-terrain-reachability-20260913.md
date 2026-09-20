# colony storyNpcs/terrainTextures 可达性实证与退役记录（a-45，2026-09-13）

## 一、零引用实证（全仓 rg，排除自身与测试）

| 文件 | 生产引用 | 测试引用 | 判定 |
|---|---|---|---|
| src/renderer/data/storyNpcs.ts | **0** | 仅 src/renderer/data/__tests__/storyNpcs.test.ts | 零生产引用 |
| src/renderer/render/terrainTextures.ts | **0**（MapRenderer.bakeTerrainTexture 为内部方法，不 import 本模块；:451 注释仅文字提及） | 仅 src/renderer/render/__tests__/terrainTextures.test.ts | 零生产引用 |

## 二、退役执行（h912-14 同规则：备份→移除→全量绿）

- 备份：`tmp/backup-colony-20260913-1537/`（4 文件全量，可整目录回滚）；
- 移除：上表 2 模块 + 2 legacy 测试文件；
- 全量测试：`npm test` → **1102 passed, 0 failed**（86→84 文件；1120−1102=18 条为本两 legacy 测试用例，随模块退役）。

## 三、与前序裁决的关系（如实披露）

- p912-41（9/12）曾判：storyNpcs=保留挂接线任务、terrainTextures=留日间拍板。本班 a-45（9/13 白天大补批授权单）明确「零引用者按 h912-14 同规则退役」，属更新授权；两文件均可经备份目录一键回滚，若 story mode 接线启动时需要，从备份/git 历史恢复即可。
- 未动 save schema、未重生成 art/audio、未 commit/push ✓。
