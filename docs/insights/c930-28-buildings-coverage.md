# public/art/buildings 资产覆盖度盘查·执行记录（c930-28，只读）

> **单号** `c930-28` · **执行班** `sweep-1001-0002` · **盘查时点** 2026-10-01 05:4x（实测）· git status 零变化（探针 tmp/c930-28-audit.mts 在 gitignore 区）

## 三桶对账（defs=BUILDING_REGISTRY 35 × disk=public/art/buildings 33 件）

| 桶 | 数 | 明细 |
|---|---|---|
| **双在**（def 引用＋磁盘在位） | **33** | 全部磁盘文件被引用（清单见探针输出，bld_farm…bld_nine_cauldrons） |
| **引用缺文件** | **2** | `bld_tin_mine → art/buildings/bld_tin_mine.webp`、`bld_hemp_field → art/buildings/bld_hemp_field.webp` |
| **文件无引用** | **0** | 空集 |

## 交叉核对（完成标准防重报）

- 引用缺 2 键＝**artManifest 待补素材清单同名两键**（required:false、NO_OWN_ART 集合，`art-exists-check` 的 unresolved=2 同源）——manifest 层与 def 层同报一件事，**非新缺陷**。
- c927-53 reconcile 口径覆盖 boot **加载面**（getBootLoadList('building') 7 件），本单覆盖 **def 全集**（35）——两口径无重叠报告面；reconcile --check rc=0 与本盘查不冲突。

## 复跑命令

```
$ npx tsx tmp/c930-28-audit.mts      # 探针在 gitignore 区；三桶计数即上面三行
```

## 遗留

tin_mine/hemp_field 立绘补齐与否属产品裁量（在册待补清单）；哨兵化（覆盖度进门禁）属裁决后置项，本单不做。
