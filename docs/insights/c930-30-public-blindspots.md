# public/ 反向对账盲区盘点·执行记录（c930-30，只读）

> **单号** `c930-30` · **执行班** `sweep-1001-0002` · **盘点时点** 2026-10-01 06:0x（实测）· 零写入

## 盲区四域读数

| 域 | 盘面 | 反向对账结论 |
|---|---|---|
| `public/atlas/` | **0 件（空目录）** | 无引用无文件——**死目录**，删除候选（纯卫生，随下次 docs 批） |
| `public/fonts/` | **0 件（空目录）** | 同上，**死目录**候选；代码面 grep fonts/ 0 命中 |
| `public/audio/` | 15 件＝9 bgm(.mp3)＋6 sfx(.wav) | 加载口 `audio/${key}.mp3`（BootScene:78）＋audioDirector 键表；**缺键静音降级是设计内**（AudioManager cache.audio.exists 自动静音）⇒ 无「缺文件即坏」形态；audio.ts 表 assetKey 3 处（sfx）＋ALL_BGM_KEYS/SFX_KEYS 单源 |
| `public/art/generals/` | 5 件 `gen_*.webp`（对齐 GENERALS 五将 roster） | **键名/文件名两轴解耦**：加载键＝`portrait_${id}`（artManifest GENERAL_ART :58 → BootScene :62），url 才是 gen_*.webp—— MilitaryPanel `exists('portrait_*')` 与磁盘文件名**不冲突**（先疑后否，留痕） |
| `public/art/*.json`（art 根） | 4 份 `manifest_portraits_<ts>.json` | 生成物（已在 c930-21 art-exists-check orphans=12 内登记）——清理候选，归口同批 |

## 建议（不落笔）

1. atlas/fonts 两空目录删除（纯卫生）。
2. manifest_portraits_*.json 4 份生成物：移 results/ 类目录或加 .gitignore 规则＋清理（与 orphans 告警面同批裁决）。
3. audio 15 件无守卫（audioDirector 键表是单源，缺文件静音设计内）——不需要哨兵。

## 自证

零写入；只 ls/grep。复跑命令＝上面各 ls。
