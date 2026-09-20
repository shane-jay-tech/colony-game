# colony P3-2 闭单证据复核（s918-14 / 只读，backlog 文件未动）

> 2026-09-19｜执行班 sweep-20260918-2300｜复测 20260917 覆盖结论是否仍成立。

## 复核方法与输出（rg 对照，0 差异）
1. **generals 覆盖**：GENERAL_POOL（src/renderer/data/generals.ts）实有 5 将（barbarian/hu_ben/pei_shao/tian_zhong/xie_changqing）；artManifest.ts:46 以 `portrait_${id}` 模板生成 → **5/5 全对齐** ✓（与 20260917 报告结论一致）。
2. **events 覆盖**：EVENT_ART 实有 10 键（battle/coronation/diplomacy/feast/flood/rebellion/unification + ending_gong/jia/huo）；渲染层实际引用 evt_art_* 键 6 个，**全部在 manifest 10 键内**（0 缺失）✓。

## 闭单证据链
- `grep -c` 口径：artManifest.ts 中 `portrait_` 模板 1 处（:46）覆盖 5 将；`evt_art_` 键 10 处全列举。
- src 层引用 evt_art_ 键与 manifest 差集＝空（唯一近名 'evt_art_ending_' 为 ending_gong/jia/huo 前缀截断，非独立键）。
- 结论：**P3-2「事件插画/将领立绘覆盖核对」可通过闭单**——manifest 与数据 id 完全对齐，无幽灵引用、无缺覆盖。

## 勾选建议（动作留日间）
- OPTIMIZATION_BACKLOG.md:62 `- [ ]` → `- [x]`，行尾附「复核证据：docs/insights/colony-p32-closure-20260918.md（5/5 将领、10/10 事件、差集 0）」。
- 勾选动作不在本单执行：该 backlog 文件属用户在途 M 域（并发会话），避免踩写。
