# colony public/art 全量资产对账（n919-32 批次 c920-14，只读，零删除）

- 对账脚本：tmp/art-reconcile.mts（tsx 直跑，动态 import artManifest）
- 口径修正记录：manifest 的 path 字段相对 `public/`（assets/buildings/…webp），非 public/art/

## 双向差异表（本班实测）

| 维度 | 数值 | 说明 |
|---|---|---|
| ART_MANIFEST 声明键 | 55（building 32/general/event/terrain/scatter 族） | |
| **声明路径不存在（缺失）** | **50** | 50/55 指向 `public/assets/**`（目录整体不存在）；仅 5 个 terrain/scatter 类路径真实存在 |
| 磁盘文件（public/ 全量） | 81 | 其中 public/art/ 66（buildings/events/generals 的 **.png**＋manifest_portraits_*.json×4＋scatter）；atlas/audio/fonts 15 |
| **磁盘孤儿（manifest 未声明）** | **81** | 全部 81 个磁盘文件都不在任何 manifest path 内——含 art/buildings 的 35 张 .png |

## 定性结论

1. **manifest 是影子注册表**：55 键声明的 `assets/**.webp` 目标无一存在（除 5 个 terrain/scatter 例外）——buildings/generals/events 三族的视觉资产实际以 **.png 存于 public/art/**（与声明的 webp 路径双断裂：目录断裂＋格式断裂）。
2. **required 全 false**：50 个缺失键 required=false——运行时静默回退（不崩），与「art-or-fallback 哲学」一致，但等于“正式 art 管线未通”。
3. **同物双命名**：如 bld_academy.png（磁盘，public/art/buildings/）vs bld_academy.webp（manifest 声明，public/assets/buildings/）——同 id 双格式异位。

## 建议（后续批）

- 短期：manifest path 改指 public/art 实际 .png（50 键逐键核对映射），或约定资产落位规范后一次性迁移 webp。
- 长期：art 管线（Mureka/生成→png→webp→public/assets/）自动化 + CI 存在性门（防 50 键断链复发）。

## 复跑命令

```
npx tsx tmp/art-reconcile.mts   # 输出完整双向差异 JSON
```
