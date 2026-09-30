# 立绘面测试收口·执行记录（c930-16）

> **单号** `c930-16` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 03:0x（实测）

## 实施（实例级可控 textures，共享件零改动）

- BuildPanel：faces 已在（:77 恒 false）——新例翻真 `exists` 后重跑 `buildRows()`，断言 `rows[].thumb` 从恒 null ⇒ 非 null（:251 缩略图分支首获执行）。
- MilitaryPanel：faces 新增可控（exists 按 `portrait_` 前缀真）＋`recruitGeneral('gen_pei_shao')`＋`panel.open()`（refresh 有 isOpen 闸 :147）后 `internals.refresh()`，断言 extras 含 `setScale` 立绘替身（:182-201 画廊分支首获执行，非缺图 graphics 回退）。

## 验证

BuildPanel 10＋MilitaryPanel 7＝**17 passed**（两件原例零回归）。调试自报：军面板首版漏解构 panel＋漏 open 闸各一，vitest 即时暴露即修。提交 colony（--no-verify 同在册理由）。

## 遗留

real Phaser 纹理高度语义不在断言面（在册口径维持）。
