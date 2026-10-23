# manifest_portraits_*.json×4 ＋ postprocess-ai-png.mjs 裁决底稿（c1023-24，2026-10-23）

> 性质：**只出底稿材料，零改动**——删除/归档/保留的裁决权在主班（c1012-05 遗留原文明示「独立裁决归主班——本单出底稿」）。
> 本单为 c922-109 底稿（`docs/insights/colony-manifest-portraits-orphan-20260922.md`）的**现值复核＋扩展至 postprocess 本体**。

## 一、五件台账 × 三面证据

### A. `public/art/manifest_portraits_1781872115/2230/2304/2377.json` ×4（生成物）

| 面 | 证据 | 读数 |
|---|---|---|
| ① 代码/工具引用面 | `rg -n "manifest_portraits" src/` | **零命中**——运行时（含 BootScene/artManifest）从不加载这四件；`scripts/art-exists-check.mts:52` 仅注释将其归类为孤儿告警面（不失败）；`scripts/gen_portraits_events.py:154-155` 经 c1023-11 已改**稳定名 `manifest_portraits.json` 覆盖写**，时间戳命名已成旧版遗留，四件不会再被同型再生 |
| ② 文档引用面 | `rg -l "manifest_portraits" docs/ README.md PLAN.md` | README/PLAN **零命中**；活引用仅三处材料性档案：`docs/design/p1-4-manifest-authority-20260922.md:203`（「四件处置等授权」条款）、c922-109 底稿本体、`colony-art-full-20260919.md:12` 的「public/art 66」文字账 |
| ③ git/运行态 | `git ls-files`＋探针 | 4 件全部 tracked（入库于 54eafe9 快照）；`dist/renderer/art/` 另有 4 件同名 ignored 镜像（构建产物，随构建再生、不在裁决面）；现值探针 **orphansArtFiles=4 且恰为这四件**；无任何测试枚举 `public/art` 根目录 JSON（c922-109 §四.3 实证，至今未变） |

内容语义（承 c922-0922 台账，本轮未复刻逐件读数）：同一次 6/19 出图的「首发＋三次限流重试」链（112 秒跨度），26 条记录 = 15 成功 + 11 条 429；四件合计 5112 B，`saved` 字段硬编码绝对路径且所指 `.png` 100% 已不存在（c921-02 已转码 `.webp`）。

### B. `scripts/postprocess-ai-png.mjs`（本体）

| 面 | 证据 | 读数 |
|---|---|---|
| ① 代码/工具引用面 | `rg -n "postprocess" package.json`＋`rg -l "postprocess-ai-png" src/ scripts/` | package.json **零键**（`postprocess-png` npm 键已由主班按 c930-29 方案删除）；src/scripts 无 import（独立 node CLI，无被调面）；全仓唯一脚本本体自引 |
| ② 文档引用面 | `rg -l "postprocess-ai-png" docs/` | 活引用 1 处：`docs/design/00_上手须知_START_HERE.md:125`「postprocess 处理（无固定命令，见 scripts/postprocess-ai-png.mjs）｜AI 生成 PNG 后处理」；材料性档案 3 处（c927-63 建议 git rm 双脚本／c927-77／c930-29「键删本体留」现值核） |
| ③ git/运行态 | `git log -- scripts/postprocess-ai-png.mjs` | tracked、clean、**仅 15769cb Initial 一笔**（入库后从未改动）、4750 B；同型先例：`pack-sprites.mjs` 本体已由 c1001-03（dc1936d）rm 落地 |

## 二、现值探针读数（本单实测）

```
$ npx tsx scripts/art-exists-check.mts | tail -4
requiredTrue=61 requiredFalse=2
requiredTrueMissing=0
diskArtFiles=65
orphansArtFiles=4 ["art/manifest_portraits_1781872115.json","art/manifest_portraits_1781872230.json","art/manifest_portraits_1781872304.json","art/manifest_portraits_1781872377.json"]
```

对照漂移点（对 c922-109/c930-21 旧读数）：orphans **13 → 12 → 4**——P1-4/c1023-10 清单权威化后 8 件 scatter 假孤儿已声明、`bush_dry.webp` 已离场（现值 not in orphan 集），**孤儿面剩纯本四件**；`art-exists-check.mts` 已从 `tmp/` 进 `scripts/`（c930-21 转正）。若四件获授权删除，orphans 落 **0**。

## 三、建议（裁决材料，本单不代决）

| 件 | 建议 | 理由（现值强化） | 备选 |
|---|---|---|---|
| manifest_portraits_*.json ×4 | **删除**（= c922-109 案 A，一次一提交 `git rm` 四件同批） | ① 零运行时/文档活引用、零测试枚举，c922-109 §五实测移件后全量 1338 例零牵动；② 6/19 出图任务 15 id 全集成功且成品 `.webp` 已在盘，JSON 无后续决策用途；③ 增殖机制已断（c1023-11 稳定名覆盖写；且 `gen_wanxiang_batch` 依赖仍缺盘——`ls D:/code/scripts/gen_wanxiang_batch.py` 不存在，脚本依旧跑不动，时间戳件无再生途径）；④ 删后探针 orphans→0，清理口径一次性收口 | 保守案：`git mv` 至 `_archive/`（仓内留痕、跟踪数不变，但 orphans 探针仍报 4）；**不建议** tmp/ 案（c922-109 已评级「中」——失明面）与 .gitignore 脱管案（评级「中偏低」） |
| postprocess-ai-png.mjs | **删除**（须与 START_HERE:125 行同笔收口） | ① 唯一 npm 键已删、全仓无调用面，c927-63「必须同删」预警的下半只剩本体；② 其服务对象（AI 出图→后处理流水线）依赖已退役的万象通道，`gen_wanxiang_batch` 缺盘使整链停摆，工具无再运行场景；③ 同型先例 pack-sprites.mjs 已按 c1001-03 rm 落地，留此一件即口径不一致 | 保守案：归档 `_archive/`（若主班认为 AI 出图流程可能换管线复活——届时从 git 历史取回成本同样为零，归档的增量价值有限）。**不建议**维持现状：START_HERE:125 教一个无入口的死命令面，文档漂移持续在册 |

两案均满足 c1012-05「零数值行为变更」约束：纯资产/工具退役，无任何 src/ 行为改动。若采删除案，连带文字账两处（`colony-art-full-20260919.md:12` 的 66、本档第二节读数）由执行单按当班纪律处理（他班档案不代改）。

## 四、锚点与漂移留痕

- c1012-05 遗留原文锚点有效（四件＋本体均在盘、均维持登记未越界处置）。
- 漂移修正三处：orphans 现值 4（旧档 13/12）；`art-exists-check.mts` 已转正 scripts/；`gen_portraits_events.py` 已稳定名改造（c1023-11）。
- 本单零改动：仓内仅新增本底稿一件；五件标的未动。
