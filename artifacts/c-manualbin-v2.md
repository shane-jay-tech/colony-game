# 人工桶快裁菜单二版（c1025-17 · 2026-10-25 · 零删除更新件）

> 拍板现值：**D1025-nod #9「人工桶 6 件快裁→按菜单二版」**（2026-10-25 已落）——一版建议（c-manualbin-menu.md，c1023-17）获裁执行授权。本二版＝现值复扫确认＋建议生效注记；**盘上删/归档动作不在本单**（任务书零删除门），执行配方已备供执行单引用。
> 一版全文见 `artifacts/c-manualbin-menu.md`（本件只记增量，不重复论证）。

## 一、现值复扫（2026-10-25 实测）

| # | 件 | 一版读数 | 二版现值 | 漂移 |
|---|---|---|---|---|
| 1 | tmp/art-reconcile.mts | 1,646B·c920-14 | **1,646B（mtime 09-20）** | 零漂移；全仓零引用（scripts/art-coverage-reconcile.mts 经逐词核不含该名） |
| 2 | tmp/art-relink-table.mts | 3,027B·c921-01 | **3,027B（09-20）** | 零漂移 |
| 3 | tmp/art-verify-20260921.mts | 3,331B·c921-07 | **3,331B（09-21）** | 零漂移；bootLoadList.test.ts:118 注释引用（证据链注释，随批改指常驻件即可） |
| 4 | tmp/art-exists-check.mts | 不在盘（账外删除） | **ABSENT（维持）** | 零漂移；artManifest.ts:14/:62 引用悬空维持（订正挂 artManifest 下笔改动批） |
| 5 | tmp/c927-70-probe.mts | 5,210B·c927-70 | **5,210B（09-29）** | 零漂移；public/ 反向哨兵仍未落地（rg 常驻面零命中）→ 留置理由维持 |
| 6 | tmp/c922-09-probe.mts | 1,032B·c922-09 | **1,032B（09-21）** | 零漂移；扶正版 story-caliber.mts 在役（:2 注释自述） |

**结论：桶内 6 件相对一版全项零漂移**（体积/mtime/在盘态/引用面）——一版菜单建议**原样生效**，无需改判。

## 二、二版执行单配方（拍板 #9 已授权，供执行单直接引用）

1. **删**（#1 art-reconcile.mts＋#6 c922-09-probe.mts）：cp → `D:/attic/colony-tmp-probe-backup-c1025/` → sha256 对拍 PASS → unlink → 残留核 0（c1011-16 配方）。
2. **归档**（#2 art-relink-table.mts＋#3 art-verify-20260921.mts）：同上 attic 双备份后 unlink；bootLoadList.test.ts:118 注释随批改指常驻 art-coverage-reconcile.mts。
3. **留**（#5 c927-70-probe.mts）：零动作；public/ 反向哨兵落地批再转归档。
4. **销案**（#4 art-exists-check.mts）：零盘上动作维持；artManifest.ts:14/:62 引用订正挂下笔 artManifest 批。

预估净释放：tmp/ ≈9.0KB＋attic 入账 4 件；执行单预算 ≤8 分钟。

## 三、状态注记

- 一版菜单六件建议获 D1025-nod #9 终裁确认（删 2/归档 2/留 1/销案 1）；二版零漂移复扫在案，执行单可直接按 §二配方施工，无需再复核。
