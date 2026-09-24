# colony `D:\attic` 归档区台账登记材料（只读盘点 · 2026-09-25 实测）

- 班：`qoder-executor-20260924-2341-psy34`（信箱单 `c924-33`，cwd `D:\code\colony-game`，主班 `qoder-main-drain-20260924-2341` 收口）
- 性质：**全程只读**。`D:\attic` 是 cwd 外路径且 **git 无还原点** ⇒ 本班一个字节都没写、没移、没删；
  README 台账只出**草稿全文**（§5），实际落盘交人工（卷宗明令"子班不得代做"）。
- 盘面绑定：

```
$ git -C D:/code/colony-game rev-parse --short HEAD → cc29179（2026-09-24 23:18:53）
$ git -C D:/code/colony-game status --porcelain → 10 项（开工基线 9 ＋ 本班前一张 c924-32 产物 1；本档再 ＋1 ⇒ 收班时 11）
$ D:\attic\README.md → 733 B，mtime 2026-09-06T13:36:04（本班只 cat，未改）
```

## 1. 卷宗前提逐条实测（含否证）

| # | 卷宗前提 | 实测 | 命令 |
|---|---|---|---|
| 1 | 锚点 `src/renderer/scenes/BootScene.ts:32` 的回滚件注释 | ✅ 逐字命中（同一注释在 `:56`、`:68` 还有两处） | `$ sed -n '30,33p' src/renderer/scenes/BootScene.ts` |
| 2 | 锚点 `docs/WORKSPACE-MAP.md:65`（按 cwd 解析＝`colony-game/docs/`） | ❌ **否证（路径归属错）**：该文件**不在 colony-game**，而在**根仓** `D:\code\docs\WORKSPACE-MAP.md`；colony 的 `docs/` 下没有这件。行号 `:65` 与文本都对得上，只是 cwd 不同 ⇒ 按字面 `ls docs/WORKSPACE-MAP.md` 会得出"锚点不存在"的假结论 | `$ ls -la D:/code/colony-game/docs/WORKSPACE-MAP.md` → No such file<br>`$ sed -n '65p' D:/code/docs/WORKSPACE-MAP.md` → 逐字命中 |
| 3 | 锚点 `docs/insights/colony-auditb151-tmp-20260922.md:171`（"是否另存 D:/attic 归档 tar 由人工定"） | ✅ 逐字命中（第 171 行整行是该采纳步骤） | `$ sed -n '169,172p' docs/insights/colony-auditb151-tmp-20260922.md` |
| 4 | "交叉仓内**三处**引用" | ⚠️ **少计**：`attic` 在仓内实为 **10 个文件 / 14 处**（`rg -n -i attic src/ scripts/ docs/` 实测），其中 **13 处指向 `colony-art-backup-20260920`**、1 处（`colony-auditb151-tmp-20260922.md:171`）把 attic 当未来归档目标。含 `scripts/gen_scatter_art.py:39`、`artManifest.ts:44/:113`、6 个测试件共 7 处、`BootScene.ts:32/:56/:68`。漏掉的那批里有一条关键：**测试件把"原件已删、备份在 attic"钉成断言**（`scatterAssets.test.ts:28`）⇒ 备份目录本身是被 git 内代码引用的盘外依赖 | `$ rg -c -i attic src/ scripts/ docs/ --glob '!docs/insights/colony-offlinereward-deadface-20260924.md' --glob '!docs/insights/colony-attic-ledger-20260924.md' \| awk -F: '{n++;s+=$NF} END{print "文件",n,"处",s}'` → `文件 10 处 14`；`$ rg -n -i attic src/ -l` |
| 5 | WORKSPACE-MAP 的 "+2.6 GB zip" | ❌ **漂移**（现值 zip 1.171 GB＝1.09 GiB；attic 合计 1.268 GB）。`2.6 GB` 是**压缩前** EAC 口径——同一份地图自己第 73 行写着「`backups_old_on_c` 2.68 GB 已压缩进 D:\attic（**1,117 MB zip**）」，与实测 zip 1,116.6 MiB **逐位吻合** ⇒ 第 65 行把压缩前体积挂在了 zip 上 | `$ sed -n '65p;73p' D:/code/docs/WORKSPACE-MAP.md` ＋ §2 的 stat 命令 |
| 6 | WORKSPACE-MAP 的 "内有 SillyTavern…512 MB 待拍板" | ❌ **漂移（两件事都变了）**：`D:\attic\SillyTavern` 与 `D:\SillyTavern` 现**均不存在**；根仓 `docs/disk-organization/2026-09-20-ai-cleanup-record.md:50` 记「✅ 已删（先拆悬空 junction 再删，释放 548 MB）」、`:60` 合计里也计入 548 ⇒ 09-20 12:0x 已拍板执行，而地图（mtime 09-20 12:10）仍挂"待拍板"。同一文件内 512 与 548 两个数并存（表列"体积"与"释放"口径不同源） | `$ python -c "import os;print(os.path.exists(r'D:\attic\SillyTavern'),os.path.exists(r'D:\SillyTavern'))"` → `False False`<br>`$ sed -n '50p;60p' D:/code/docs/disk-organization/2026-09-20-ai-cleanup-record.md` |
| 7 | （新）attic 现顶 3 项里有 **2 项从未登记进 README**（README 只写了 SillyTavern） | ✅ 成立：README mtime 停在 09-06，zip 是 09-20 11:58 进、art 备份是 09-20 13:33 进 ⇒ 台账落后实盘 19 天、两个批次 | `$ ls -la /d/attic` ＋ §2 |

## 2. 条目表（完成标准①：行数＝`ls` 实测数 3；双轨核过 `os.listdir`/`os.scandir`/`ls -A` 均 3）

| # | 条目 | 类型 | 字节 | 换算 | mtime | 件数 |
|---|---|---|---|---|---|---|
| 1 | `DSH-EAC-backups_old_on_c-20260920.zip` | 文件 | 1,170,842,153 | 1.171 GB／1.09 GiB／**1,116.6 MiB** | 2026-09-20T11:58:57 | — |
| 2 | `README.md` | 文件 | 733 | 0.0007 GB | 2026-09-06T13:36:04 | — |
| 3 | `colony-art-backup-20260920/` | 目录 | 96,823,839 | 92.34 MiB | 2026-09-20T13:33 | 64 文件（62 .png ＋ 2 .wav）／7 子目录 |
| — | **合计** | | **1,267,666,725** | **1.268 GB／1.181 GiB** | | 66 项 |

```
$ ls -A /d/attic | wc -l → 3        （双轨：python os.listdir=3 / os.scandir=3，无隐藏件）
$ python - <<'PY'   # 逐文件 stat 求和（不用 du：纪律档 §廿三 记 du 对硬链接去重会少算）
import os
root=r'D:\attic'
tot=0
for r,ds,fs in os.walk(root):
    for f in fs: tot+=os.stat(os.path.join(r,f)).st_size
print(tot)   # → 1267666725
PY
$ python -c "…walk 后按扩展名分桶…"  → png 62 件 96,806,111 B＝92.322 MiB；wav 2 件 17,728 B
```

### 逐条目「来源批次／回滚指向」（完成标准③）

| 条目 | 来源批次（在册可追） | 回滚指向（它给谁兜底） | 完整性核对 |
|---|---|---|---|
| `DSH-EAC-backups_old_on_c-20260920.zip` | 根仓 `docs/WORKSPACE-MAP.md:73` ＋ `docs/disk-organization/2026-09-20-ai-cleanup-record.md`（09-20 C 盘清理）：C 盘 `AppData\Roaming\Deepseek Harness EAC\backups_old_on_c` 2.68 GB 压缩归档 | **与 colony 无关**（DSH-EAC 生态的回滚包）；仓内零引用 colony 侧需它之处 | zip 1,116.6 MiB 与地图写的"1,117 MB zip"吻合；**未解包验证内容**（越界且非必要） |
| `README.md` | 用户 2026-09-06 建区时手写（根仓 `docs/decisions/2026-09-06-impl-workspace-cleanup.md:41` 记着这次 mv 与 README 的建立） | 台账本体（"只进不出"规矩的载体） | 内容只登记 SillyTavern 一条 ⇒ 与 §2 现盘 3 项**不符**（见 §5 草稿要补的两件） |
| `colony-art-backup-20260920/` | colony 侧 `c921-02` 批次，commit **`f0c9754`**（2026-09-20 13:31:29）「删除 62 个转码后原 png（释放 92.32MiB，仅删有同名 webp 的）」 | **13 处仓内引用**指向它：`BootScene.ts:32/:56/:68`、`artManifest.ts:44/:113`、`scripts/gen_scatter_art.py:39`、测试件 `artManifest.test.ts:55`／`artManifestReuse.test.ts:35`／`bootLoadList.test.ts:12`／`scatterDiskReconcile.test.ts:11`／`scatterAssets.test.ts:22/:28`／`terrainPaths.test.ts:17`（另 `colony-auditb151-tmp-20260922.md:171` 是"把 attic 当未来归档目标"，不属本 13） | ✅ **对上了**：png 62 件合计 **92.322 MiB** ＝ commit 自述的 92.32 MiB；`art/buildings` 33 png ↔ `public/art/buildings` 33 webp（1:1）；`art/scatter` 9 png ↔ 现 8 webp（差的 1 ＝ `bush_dry`，在册 `scatterDiskReconcile.test.ts:11` 已述其退休链，且 `art/scatter/bush_dry.png` **实测在备份里**）|
| （同目录附带）`audio/sfx_click.wav`＋`sfx_warn.wav` | **无在册批次可追**（mtime 2026-09-04T23:54:39，与 art 转码批 09-20 不同日） | 不指向任何东西——两件的原件**至今仍在仓内且被 git 跟踪**（`public/audio/`，历史 commit `54eafe9`） | ⚠ 与 `public/audio/` 同名件 **sha256 逐位相同**（`f971a9aaa862…`）⇒ 纯冗余 17,728 B；另见 §6 的旁证发现 |

## 3. 与 WORKSPACE-MAP.md:65 两数字的核对结论（完成标准②）

| 地图在册值 | 现取实测 | 判定 |
|---|---|---|
| `+2.6 GB zip` | zip 1,170,842,153 B＝1.171 GB（1,116.6 MiB）；attic 全体 1.268 GB | **漂移**：2.6 GB 是压缩前 EAC 口径（地图自己第 73 行写 2.68 GB→1,117 MB zip），挂在"zip"上就少了一半多 |
| `内有 SillyTavern` | 不存在（`D:\attic\SillyTavern`、`D:\SillyTavern` 双双 NOT-FOUND） | **漂移**：09-20 已删（cleanup record:50） |
| `SillyTavern 512 MB 待拍板` | 已拍板并执行；且同 record 内 512（表列体积）／548（释放量）并存 | **状态过期 ＋ 同档双数**：待人工决定按哪个口径回写（本班不改他档） |

## 4. 规矩核对（"只进不出"）

`README.md` 与地图都把 attic 定性为「只进不出／搬进 ≠ 删除」。实测：09-20 那一轮把 **README 里唯一登记的条目整件删掉了**（不是搬回原位）
⇒ "只进不出"在字面上已被破一次（虽然是用户当天亲自拍板的删除，程序正义没问题，但**台账没记这一笔**）。
建议 §5 草稿把"出口"显式定义成三种：`搬回原位`／`用户拍板删除（要写记录行）`／`保留`，避免下次删除后又一处只剩盘外记忆。

## 5. `D:\attic\README.md` 台账草稿（全文，交人工落盘；本班未写）

> 用法：人工核对无误后整篇替换现 README（现件全文见 §5.0 留底）。**本班不得代做**（卷宗明令 cwd 外路径不代写）。

### 5.0 现件留底（733 B，2026-09-25 只读快照，git 无还原点 ⇒ 留底即唯一还原依据）

```markdown
# D:\attic — 归档区（2026-09-06 建立）

这里放「确认长时间没用、但不敢直接删」的东西。搬进来 ≠ 删除，想恢复搬回原位即可。

| 目录 | 原位置 | 归档日期 | 原因 | 如何恢复 |
|---|---|---|---|---|
| SillyTavern | D:\SillyTavern | 2026-09-06 | 酒馆（AI 角色扮演前端）+ 启动器，2026-05-25 后零活动；2026-09-04 全盘盘点已标为「疑似弃用下载残留」 | `mv /d/attic/SillyTavern /d/SillyTavern`（或资源管理器拖回 D:\ 根目录）；里面有 5 月的默认用户数据，若确认不要可整个删掉 |

备注：归档时 SillyTavern 内含 node_modules（占体积）；如以后确认永久不要，直接删整个文件夹即可。
```

### 5.1 建议替换稿

```markdown
# D:\attic — 归档区（2026-09-06 建立｜台账最近更新 2026-09-25，由 c924-33 只读盘点生成）

这里放「确认长时间没用、但不敢直接删」的东西。搬进来 ≠ 删除。
**出口只有三种，且都要在本表记一行**：`搬回原位` ／ `用户拍板删除（记 release 量与依据档）` ／ `保留`。

## 现存条目（实测 3 项，合计 1,267,666,725 B ＝ 1.268 GB）

| 条目 | 类型 | 字节 | 入库日期 | 来源批次 | 回滚指向 | 如何恢复／出处置 |
|---|---|---|---|---|---|---|
| `DSH-EAC-backups_old_on_c-20260920.zip` | zip | 1,170,842,153（1,116.6 MiB） | 2026-09-20 | DSH-EAC 09-20 C 盘清理：`AppData\Roaming\Deepseek Harness EAC\backups_old_on_c` 2.68 GB 压缩归档 | DSH-EAC 旧回滚包 | 解包前先核 `unzip -l`；依据档 `D:\code\docs\WORKSPACE-MAP.md:73` |
| `README.md` | 台账 | 733（旧版）→ 本件 | 2026-09-06 | 建区时手写 | 无（它自己是账） | 只追加不改写历史行 |
| `colony-art-backup-20260920/` | 目录 | 96,823,839（92.34 MiB；62 .png ＋ 2 .wav／7 子目录） | 2026-09-20 | colony `c921-02`（commit `f0c9754`，"删除 62 个转码后原 png，释放 92.32MiB，仅删有同名 webp 的"） | **游戏美术 png 原件**：仓内 13 处引用它（`BootScene.ts:32/:56/:68` 3 处、`artManifest.ts:44/:113` 2 处、`scripts/gen_scatter_art.py:39` 1 处、6 个测试件共 7 处）；`scatterAssets.test.ts:28` 更把"原件已删、备份在此"钉成断言 | 单件回滚示例：`cp /d/attic/colony-art-backup-20260920/art/scatter/bush_dry.png <目标>`；**删本目录前必须先处置那 13 处引用**（它们是 git 内的），否则测试与注释同时指向空处 |

### 本目录内的两处「无主件」提示
- `colony-art-backup-20260920/audio/sfx_click.wav`、`sfx_warn.wav`（各 8,864 B，mtime 2026-09-04T23:54）
  **不属于 09-20 那批 png**，且与仓内仍被 git 跟踪的 `public/audio/` 同名件 **sha256 逐位相同**（`f971a9aaa862…`）⇒ 纯冗余 17,728 B，可随手回收，删了不丢任何信息。

## 历史条目（已出库，仅记账不占位）

| 条目 | 原位置 | 归档日期 | 出口 | 依据档 |
|---|---|---|---|---|
| SillyTavern | D:\SillyTavern | 2026-09-06 | **2026-09-20 用户拍板整件删除**（先拆悬空 junction，释放 548 MB；表列体积写 512 MB——两口径并存，见依据档 :50 与 :60） | `D:\code\docs\disk-organization\2026-09-20-ai-cleanup-record.md:50`；建区记录 `D:\code\docs\decisions\2026-09-06-impl-workspace-cleanup.md:41` |
```

### 5.2 人工落盘指引

1. 先比对 §5.0 留底与盘上现件是否仍逐字相同（若已被别的会话改过就以盘上为准、只追加）：
   `sha256sum /d/attic/README.md` → 本班 2026-09-25 取值 `45dd839613b096c35179badb0ceab485f8ab2eb8c12601468a5f0a778d62fcd3`（733 B）
2. 落盘属 cwd 外写操作 ⇒ **子班一律不得代做**（`c924-33` 卷宗 ＋ `colony-auditb151-tmp-20260922.md:171` 双处规矩）。
3. 落盘后请同步回写 `D:\code\docs\WORKSPACE-MAP.md:65` 的三个漂移点（§3）——那是根仓受版件，走主班代提交。
4. 行尾提醒：`README.md` 若在 Windows 侧被写成 CRLF 而草稿是 LF，`git` 不涉及（attic 不在仓内）但人读会看到 `^M`；用 `python` 写而非 echo 追。

## 6. 旁证发现（**不属本单范围，交主班决定是否登记**）

`public/audio/sfx_click.wav` 与 `public/audio/sfx_warn.wav` **内容逐位相同**（同 8,864 B、同 sha256 前缀 `f971a9aaa862…`）
⇒ 两个不同的音效槽位共用同一个 wav。纪律档 §十二 另记着 `sfx_warn` 在资源不足路径叠播两次的在册缺陷，两件事是否同源未核。
```
$ sha256sum public/audio/sfx_click.wav public/audio/sfx_warn.wav
```

## 7. 零改动自证与遗留

- **完成标准④「D:\attic 零写入」**：本班对 `D:\attic` 只执行了 `os.listdir/os.walk/os.stat` 与 `cat`／`sha256sum`（纯读）。
  收班复核：`$ ls -la /d/attic` 应仍是 3 项、`README.md` mtime 仍是 `2026-09-06T13:36:04`、`$ find /d/attic -newermt "2026-09-25" | wc -l` → 0。
- colony 侧只新增本档 1 件（未 add／未 commit）；前一张单 `c924-32` 的产物另计；他班在途 9 件未碰。
- 未跑 type-check／vitest（并发纪律，且本单零代码改动无从验证）。
- 遗留给主班：①§3 三个漂移点的回写（在**根仓** `docs/WORKSPACE-MAP.md`，非 colony）；②§5 草稿落盘属人工；
  ③512 vs 548 两口径择一；④"只进不出"规矩是否要显式定义三种出口（§4）；⑤§6 旁证发现是否单开一单。
