# scatter/event URL 模板单源化·执行记录（c930-20）

> **单号** `c930-20` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 04:0x（实测）

## 实施

常量落 **artManifest.ts**（`scatterArtUrl(id)`／`eventArtUrl(name)` 两函数导出）——任务书原写"BootScene.ts 抽导出"，但 BootScene import phaser，脚本(.mts) 不可导入；artManifest 是两侧既有共同依赖且纯数据，落此才是可导入单源（偏差已记）。

四消费点切换：
- BootScene.ts :59/:71（preload 两 load.image）
- scripts/art-coverage-reconcile.mts :50/:54（LOAD_SOURCES 复刻）
- bootLoadList.test.ts :147/:151（测试侧复刻）

`grep -rn "art/scatter/\${|art/events/\${" src/ scripts/` 清零（仅剩 artManifest 常量定义处）。X1 条数兜底未动。

## 验证

- `--check` rc=0（改造前基线同值，对照留痕）；X1 交叉核对 63=63 不变。
- 定向 vitest：bootLoadList＋artManifestEvtArtUsage＋BootScene.runtime-error＝**9 passed**。

## 遗留

ART_MANIFEST 里 event 全路径行（path: 'art/events/xxx.webp'）是清单数据非模板复刻，未动；后续若要再收敛可由 eventArtUrl 派生（另单）。
