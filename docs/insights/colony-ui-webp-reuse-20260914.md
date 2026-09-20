# colony assets/ui 6 个 webp 的 UI 复用核查（d914-35，2026-09-14，只读）

命令：`find . -name '*.webp' -not -path './node_modules/*'`；`find . -name 'panel_bamboo*' …`；`ls assets/ui/`

## 结论：**零命中**——assets/ui/ 目录不存在，6 个 webp 物理文件已不在盘上

| 原清单条目（artManifest.ts 旧 :69-76） | 原路径 | 物理文件 | src/docs 引用 |
|---|---|---|---|
| ui_panel_bamboo | assets/ui/panel_bamboo.webp | **不存在** | 0 |
| ui_panel_silk | assets/ui/panel_silk.webp | **不存在** | 0 |
| ui_btn_wood | assets/ui/btn_wood.webp | **不存在** | 0 |
| ui_btn_bronze | assets/ui/btn_bronze.webp | **不存在** | 0 |
| ui_border_gold | assets/ui/border_gold.webp | **不存在** | 0 |
| ui_scroll_bg | assets/ui/scroll_bg.webp | **不存在** | 0 |

- 全仓 `find . -name '*.webp' -not -path './node_modules/*'` → 0 命中（colony 仓内无任何 webp 文件）。
- `assets/` 目录本身不存在于仓库根。
- src/ 与 docs/ 对上述 6 个文件名的引用 0 命中（artManifest.ts 已在 afbc 清除）。

## 判定

afbc 删除 manifest 条目时**物理文件已同步不在**（或从未在本工作树存在）。无需进一步处置。

## 验收

- `find` 命令零命中（全部 6 个文件名 + 全局 webp 泛搜均 0）✓
- `ls assets/ui/` → No such file or directory ✓
- 零删除零移动 ✓；git diff --stat 仅新增本报告 ✓
