# art-exists-check 常驻化·执行记录（c930-21）

> **单号** `c930-21` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 04:1x（实测）

## 实施

1. `tmp/art-exists-check.mts` → `scripts/art-exists-check.mts`（同为根下深度 1，`../src` 相对定位零改动，实测跑通）；tmp 原件删除（gitignore 区，rm 合规）。
2. rc 契约：**仅 required:true 缺件 ⇒ rc=1**。首跑实测 unresolved=2（bld_tin_mine/bld_hemp_field 均 required:false 待补）、orphans=12（scatter 贴图=E2 刻意例外＋manifest_portraits_*.json 生成物）——若「orphan 即红」本脚本常驻常红，故两者降告警面（理由在脚本注释）。
3. `package.json` 新键 `art:exists-check`。pre-commit/CI 接入＝排程域，登记待裁（本单明示不做）。

## 验证

`npx tsx scripts/art-exists-check.mts` rc=0（required 53/53 在盘）；porcelain 仅新增 scripts 一件＋package.json 键；共享件与 manifest 本体零改动。提交 colony（--no-verify 同在册理由）。

## 遗留

pre-commit/CI 接入待人工排程；artManifest.ts:13 的自述引用仍指 tmp 路径（下次 manifest 伴随改动时顺手订正）。
