# value 语义 5 键·存档历史取证（c930-27，B-退役前置材料）

> **单号** `c930-27` · **执行班** `sweep-1001-0002` · **取证时点** 2026-10-01 05:3x（实测）· **只读，git status 零变化**

## 逐键命令与命中读数（完成标准①）

五键各跑两条（命令同形，替换键名）：
```
$ git log -S"<key>" --oneline -- src/
$ git log -S"<key>" --oneline -- src/renderer/state/saveLoad.ts
```

| 键 | src/ 命中（3 笔，五键同构） | saveLoad.ts 命中 |
|---|---|---|
| `building_construction_cost` | `15769cb`（Initial，注册表数据行）→ `54eafe9`（6-7 月快照）→ `d9249f4`（c922-128 四表扫描测试）→ `c07c461`（pd09 门禁测试） | **0 条** |
| `building_efficiency` | 同上 4 笔（c923-31 validator 测试亦触） | **0 条** |
| `building_upkeep` | 同上 | **0 条** |
| `event_negative_probability` | 同上 | **0 条** |
| `population_class_growth_gong` | 同上 | **0 条** |

（src/ 命中全部落在 modifierRegistry 数据表＋effects 扫描/门禁**测试**；无任何一处在 serialize/deserialize/loadFromSlot/migrations。）

## 结论（完成标准②）

**5/5 键从未进过存档**：序列化面（`src/renderer/state/saveLoad.ts`）`git log -S` 全键 **0 命中**——历史上不存在任何一笔把它们写入 serialize 字面量、migrations 或 saveLoad 任何路径的提交。首次现身＝`15769cb`（v1.0 Initial 的注册表数据行），此后仅两笔**测试/扫描**触碰（c922-128 四表扫描、c927-76 前身的 pd09 门禁），与 c927-76 §〇「无运行时读取口」互证。

⇒ c924-06 遗留 2 的前置问句已闭合：**B-退役不存在存档兼容障碍**（裁决本身仍留人工，本单不加码）。

## 自证

本班零写入：只有 git log -S 与文档新增（本档）；`git status` 对 src/ 零变化。
