# l1007_22_vis（38M 热图材料件）结案标记·留档/删除两案底稿（c1023-18）

- 性质：**只读材料单——零删除、零 src/docs 改动，裁定归主班**。
- 锚点：c1011-16 遗留 2「l1007_22_vis 38M（热图材料）在役：其消费单结案后应转入『留档或删』裁定——现无结案标记，建议随 n1007-28 热图单收口时一并定」。

## 0. 锚点复核（漂移留痕，按磁盘实况修正）

| 任务书断言 | 磁盘实况 | 判定 |
|---|---|---|
| 「n1007-28 result 在 done/（热图单已收）」 | n1007-28 **实为 pat_pref 引用审计单**（scripts/audit-pat-pref.py 重建，zcode-bridge commit 5d2cc60），与热图无涉 | **锚点漂移** |
| 热图消费单 | 真身＝**c1007-28**（Top10 热图其余 7 件批量出档，status: done 2026-10-08T03:09；上游 c1007-08 三优先件 2026-10-07） | 已修正执行路径 |

## 1. 结案条件核（「成熟」判定）

- **材料单收卷 ✓**：c1007-28 done，Top10 全集材料 10/10 就绪（3 优先件 c1007-08＋7 批量件 c1007-28）。
- **材料目的兑现 ✗**：c1007-28 遗留原文「c921-02『q85 可接受/删除原 png』终判待目视人工」——全 done/＋outbox 检索 **q85 终判无任何落地回执**（末次提及即 c1007-28 遗留行）；c1002-21 禁令「材料只供聚焦不代裁」维持。
- **判定：结案条件部分成立**——收卷≠终判落。c1011-16 要求的「消费单结案后转裁定」在「材料单已收」意义上成立，在「终判已落」意义上未成立，两案建议按此分叉。

## 2. 体积证据

```
$ python（os.walk 求和）→ files=10 bytes=39216950 (37.4 MiB)   ← du -sh 口径 38M
$ ls -la tmp/l1007_22_vis/ → 10 PNG（vis_buildings_*×3／vis_events_*×4／vis_terrain_*×3）
  单件 2.18-5.78 MB，mtime 2026-10-07/08（生成后零变更）
```

## 3. 引用面证据

```
$ rg -ln "l1007_22" --glob '!node_modules' --glob '!dist' .
  → docs/insights/colony-src-census-20261008.md:32（时点盘点：增量=l1007_22_vis 7 件）
  → docs/insights/tick-marginal-decomposition-20261007.md:4（提的是 tmp/l1007_22_marginal，非 vis）
  → src/ 零命中 ｜ tests/ 零命中 ｜ scripts/ 零命中
$ git check-ignore tmp/l1007_22_vis/vis_terrain_forest.png → 命中（tmp gitignore 域，git 零跟踪）
```

结论：**零功能性引用**——src/tests/scripts 三面全零；docs 两处均为时点性文字提及（非文件级依赖），删/留不破坏任何构建、测试或文档链。

## 4. 再生性证据

- png 母版：D:/attic/colony-art-backup-20260920/art/{buildings,events,terrain}/ 对应件在（c1007-08 自证「png 母版与 c1002-21 探针同源 D:/attic」，抽查 buildings/bld_mulberry_grove.png、terrain/forest.png 在盘）。
- 生成脚本：tmp/c1007-28-batch.py（2,756 B）＋tmp/c1002-21-psnr.py（2,202 B）均在 tmp 留档。
- **等价性警示**：热图并排的是「当时 public webp」——webp 若日后重转码，再生件≠今日件；材料含时点快照价值，非纯可再生。

## 5. 两案建议（裁定归主班）

### 留档案
- **A1 转 attic**：cp 10 PNG → D:/attic/colony-tmp-l1007-22-vis-backup-c1023-18/（沿 c1011-16 attic 双备份先例），tmp 桶清空、盘面干净；attic 台账（c924-33 规矩）记一行。适合「终判可能还会做」。
- **A2 维持在役**：零动作。代价=tmp 第三批清理单（c1011-16 遗留 1 悬置）会再次撞见 38M。

### 删除案
- 删 tmp/l1007_22_vis/ 10 PNG，释放 37.4 MiB。引用面零破坏（§3）；再生链在（§4，除时点快照价值）。
- **前置条件**：主班确认 c921-02 q85 目视终判不再做（或做完）——终判落地前删除＝材料目的作废，热图读数（PSNR/histΔ/聚焦区表）虽已内嵌 c1007-08/c1007-28 result 可追，但 PNG 本体的目视面不可恢复。

### 荐案（不代裁）
倾向 **A1 转 attic**：同时满足「tmp 在役桶出清」与「终判材料保全」，成本一次 cp；若主班裁 q85 终判永不落地，则降级删除案零风险。

## 6. 标记落地（本体零触碰）

- 本档（artifacts/c-l1007-22-vis-verdict.md，git 在案）＝正式结案注记。
- 盘面标记：tmp/l1007_22_vis/CLOSURE-MARKER-c1023-18.md（gitignore 域随目录同进退，未来清理单 ls 即见）。
- 10 PNG 本体：零删除、零改名、零内容触碰（本单全程只读＋标记两文件）。
