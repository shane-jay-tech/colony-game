# colony `rock_cluster` 三方不一致核因（生成器有／键无／盘无，哨兵为何失明）

> 班：`qoder-executor-20260924-0955-colony20`（信箱单 `c924-16`）· 2026-09-24 18:0x · cwd `D:\code\colony-game` · 开工 HEAD `fee3d9c`
> 边界：**只读核因**，零 `src/` 零 `scripts/` 改动（`git diff --stat -- src scripts` 空），未动资产、未改测试、未碰在册禁碰三件（`OPTIMIZATION_BACKLOG.md`／`colony-dead-exports-20260914.json`／其 `.bak`）。
> 卷宗锚点复核：`scripts/gen_scatter_art.py:48` 与 `src/renderer/data/scatterConfig.ts:42` **均无漂移**；唯 `colony-b152-close-20260922.md:11` 引的台账行号 `BACKLOG.md:194` 已漂 **1 行**（现值 :195，见 §五）。

## 一、三方（实为四方）对账现值

| 侧面 | 现值 | 含 `rock_cluster`？ | 取数命令 |
|---|---|---|---|
| **生成器声明** | `scripts/gen_scatter_art.py` 的 `SCATTER` 共 **9** 条 | **有**（:48，"三或四块风灰 Fieldstones 堆"） | `python -c` + `ast` 解析 `SCATTER` 列表首元（见 §六 C1） |
| **运行时键表** | `ALL_SCATTER_IDS` = **8** 键（:63-67） | **无** | `rg -n "ALL_SCATTER_IDS" -A5 src/renderer/data/scatterConfig.ts` |
| **磁盘发布面** | `public/art/scatter/` = **8 个 `.webp`、0 个 `.png`、0 个 manifest** | **无** | `python -c os.listdir` 按后缀计数（C2） |
| **地形池引用** | hills/mountain 均只 `rock_boulder` | **无**（且被 ③ 用例钉成"必须无"） | `rg -n "rock_cluster" src/` → 仅 2 处，全在测试注释/断言里 |

⇒ 键 8 ＝ 盘 8 ＝ 池引用 ⊆ 键，**唯一的不一致就是生成器多出的那 1 条**。三方差额逐名可解释：`生成器有盘无 = ['rock_cluster']`，`盘有生成器无 = []`（C1 同款脚本，双向差集）。

时间线（为何只剩它）：`f4a7d4b` W4-A 出 10 张散布图 → **`86dd9bf`（2026-09-17，n916d-22）** 因缺盘把 `rock_cluster` 从池与键表移除（键 10→9）→ c918-09 删 `bush_dry` 键（9→8）→ c921-02 整批 png→webp → `f0c9754` 授权删原 png → **c923-18 把 `bush_dry` 的孤儿 webp 与生成器条目一并收口**（生成器 10→9），同批 E6 第一次把 `rock_cluster` 记成"残留不一致"并留给裁决。⇒ **同一族的两个成员，bush_dry 走了两条出口，rock_cluster 停在原地**，这就是"孤儿面的下一个同型项"的来历。

## 二、哨兵为何失明：三条代码级根因

本族现有 4 个守卫文件，共 5 类判据。把它们画成图，缺的正好是 rock_cluster 住的那条边：

```
生成器 SCATTER(9)  ←— ✗ 零条边 —→  键 ALL_SCATTER_IDS(8)  ←— ✓ 双向 —→  磁盘 *.webp(8)
                                        ↑ ✓ ②/③ 池→键（含负向钉桩）
```

**R1 · 生成器↔键这条边在全仓不存在。** 实测：**没有任何测试读过任何 `.py`** —— `grep -rn "readFileSync|readFile" --include=*.test.ts src | grep -i "\.py|scripts"` 返回**空**（`scatterDiskReconcile.test.ts:32` 出现 `scripts/gen_scatter_art.py` 只是**注释里的文字**，不是 IO）。所有既有判据的枚举起点都是 `ALL_SCATTER_IDS` 或磁盘，二者都**已经把 rock_cluster 排除**，所以它天然进不了任何循环。缺边的后果不是"检查得不够严"，而是**这条不一致在任何判据里都无法被表达**。

**R2 · 反向哨兵有后缀过滤器，png 阶段结构性隐身。** `scatterDiskReconcile.test.ts:37` 是 `readdirSync(SCATTER_DIR).filter(f => f.endsWith('.webp'))` —— 只看 `.webp`。而散布素材的**整条产出链都是 png**：生成器 docstring 与 `--out` 默认值写 `public/art/scatter/<id>.png`（:5、:57）、`postprocess_sprites.py` 用 `--glob "*.png"` 就地覆写 png（:9、:51、:78）。png→webp 那一步（c921-02）**在仓内没有可复算的工具**：`grep -rn "cwebp" .` 只命中 `colony-assets-slim-20260920.md:252` 那句"本机无 ffmpeg／ffprobe／cwebp／magick"，`package.json` 也无转码脚本。⇒ 谁复活生成器，落进目录的 `rock_cluster.png` **既不会被 ①/①b 看见**（它们只按 8 个键枚举）**也不会被反向用例看见**（后缀不符）。同理生成器还会往同一目录写 `manifest_scatter_<ts>.json`（:89），也在过滤器之外 —— 与在册 4 件 `manifest_portraits_*.json` 孤儿同型。
　**探针实测（本单新证）**：临时放 `public/art/scatter/rock_cluster.png` → `npx vitest run scatterAssets scatterDiskReconcile` ⇒ **rc=0／15 passed 全绿**（`tmp/c924-16/probe-png.txt`），`rm -f` 后 `git status --porcelain -- public/` 空。对照组：c923-18 E3 用 `.webp` 探针 ⇒ 反向用例**当场红**。⇒ **同目录、同孤儿，换个后缀就从"必红"变成"必绿"，这就是失明的直接读数。**

**R3 · `scatterAssets.test.ts:41` 的 ③ 是负向钉桩，它把不一致读成"已处置"。** ③ 断言的是 `ALL_SCATTER_IDS).not.toContain('rock_cluster')` 与 `idsInPools()).not.toContain('rock_cluster')`——它守的是"**别把引用加回来**"，不是"**生成器别再产它**"。后果有两层：① 它的绿会被后来人（和晨报）当成"rock_cluster 事件已收口"，而它其实对 R1 那条缺边**零覆盖**；② 它和方案 A 是对撞关系——**走 A 案（补图复活键）必红 ③**，走 B 案（生成器停产）③ 无感。也就是说，现有断言面已经把"B 案是唯一不红的路"这条**裁决偏好**写进了代码，而台账侧（§五）此刻仍标着"补图＝A 案 queued"。这处口径反转是本单最需要在裁决前说清的一点。

## 三、顺带失真的注释（同一事件的第二次误导）

`scatterConfig.ts:42` 现文："rock_cluster 移除（n916d-22）：**public/art/scatter/ 无此贴图，加载静默缺失**"。两层已失真：
1. "加载静默缺失"这条代码路径**已不存在**——`BootScene` 只遍历 `ALL_SCATTER_IDS`（该唯一来源由 `scatterSourceGuard.test.ts` 三条用例钉死），键里没有它就**根本不会发起加载**，谈不上缺失；
2. "静默"二字对**键面**已不真（c918-08 建了缺盘即红的硬对账），但对**生成器面**仍然成立（R1/R2）。
⇒ 悖论式结论：注释承诺消灭的那个"静默"早就没了，从没进过任何判据的那个"静默"（生成器产出无人对账）一直在。b152 档 §二.3 已点名"静默"字样误导，但没看到 R1/R2 这层，所以它给的 diff（改注释口径）不足以消盲区。

## 四、当前会不会自己变坏？（风险边界）

不会即时变坏，因为生成器**当前不可执行**：`python scripts/gen_scatter_art.py --help` ⇒ **rc=1**、`ModuleNotFoundError: No module named 'gen_wanxiang_batch'`（:16 依赖 `D:/code/scripts/gen_wanxiang_batch.py`，该文件已缺盘、万象已退役；`os.path.exists` 为 False）。⇒ 本单把它定性为**声明面（source-list）债**，不是生产事故。触发条件是任一复活动作：换图像通道重写生成器、手工从 `art-library/scatter_raw/` 提图、或跑 `postprocess_sprites.py`（它只认 png，会把 raw 目录的 `rock_cluster.png` 直接拉进发布目录）。这三条路**都会穿过 R2 的后缀盲区**。

底稿现状（A 案成本实取，b152 §三 那个数仍有效）：`art-library/scatter_raw/rock_cluster.png` **在盘、1,315,701 B、被 gitignore**（`git check-ignore -v` → `.gitignore:24:art-library/`）。

## 五、与 B-152 的挂钩（裁决归属，本单不自宣关单）

- `D:/code/docs/night-plans/BACKLOG.md:195`（**在本班 cwd 之外，未动**）：B-152 仍 `queued`，标题写"colony scatter 贴图 rock_cluster **缺盘补图**（清单 **10**/磁盘 **9**）"。⇒ 台账侧口径**仍是 A 案**，且那两个数已是 `86dd9bf` 之前 epochs 的读数（现值：生成器 9／键 8／盘 8）。
- 待人工台账 `docs/insights/drain-20260923-pending-human.md`（**主班独占，本班只读**）：末条现为 **#204**；`rg "rock_cluster|B-152"` 在该文件 **零命中** ⇒ c923-18 遗留 2 只活在 result 里，**从未进待人工册**。建议主班补登一条并顺带订正 BACKLOG 标题数（否则下一条派单还会抄旧数）。
- b152 档 §五 的两句出口仍有效：要么把台账翻 `closed(B)` 再落注释 diff，要么按"补图另排"重开 A 案单。**执行班不宜自宣关单**，本单同样不改 `scatterConfig.ts` 一个字节。

## 六、处置建议（三条出口，附本单新测的连带面）

**甲 · 先消盲区、不谈去留（推荐做底座）**：补 R1 缺的那条边——新增一条哨兵，从 `scripts/gen_scatter_art.py` 解析 `SCATTER` ids，断言 `⊆ ALL_SCATTER_IDS`，不一致即红。
- 判别力现成可自证：加上就红（rock_cluster 是唯一违例），red 的 message 直接指出"生成器产它、键不认它"。
- 🔴 **落地面比"加一条用例"大**（本单新证）：族级复用要先解决"怎么从 .py 取 id"的解析约定——同一份 ast 抽取脚本对 `gen_scatter_art.py`/`gen_terrain_art.py` 可取（`list[tuple[str,str]]` 首元），但**首轮对 `gen_buildings_art.py` 用 `ast.Assign` 取回 0 条**（该列表是 `AnnAssign`，带类型标注），改对后 buildings 的读数是 **生成器 30／盘 33，盘多出的 3 件 = `bld_ancestor_shrine`、`bld_barracks`、`bld_house`**（这 3 件是否孤儿**本单未展开**，它们可能有键有引用、只是不由该生成器产出）。⇒ 若甲做成"三族通用"，首跑就会带 3 条待解释项；派单时要么限定只做 scatter 族，要么预留解释批。
- 若先做乙，则甲**零白名单**即可落地（见下）。

**乙 · B 案收口（最小 diff，建议与甲同批）**：像 c923-18 对 `bush_dry` 那样，把 `gen_scatter_art.py:48` 那一行删掉＋留来历注释 ⇒ 生成器 9→8，**三方归一（8/8/8）**，随后甲的哨兵零特例。
- 成本：1 行 py＋注释；零资产、零新美术、③ 用例不动。落盘须按 **LF**（本机 `core.autocrlf=true`，c923-18 E8 已据此提醒别用 `git checkout --` 还原）。
- 🔴 判据写法坑（纪律档 §九.4）：若沿用 c923-18 的"解释性注释也不得含该字面"口径，则 `rg rock_cluster scripts/gen_scatter_art.py` 必须 **0 命中** ⇒ 来历注释不能用词面（c923-18 当时改用"枯灌丛"这种描述性写法），或干脆把来历写进测试文件注释。
- 代价：**永久放弃"三石堆"视觉变体**（现由 `rock_boulder` 承担岩石语义），且必须同时把 BACKLOG 的 B-152 翻 `closed(B)`，否则又造一次"代码说关、台账说未决"。

**丙 · A 案补图（真美术裁决，本单不建议自动执行）**：连带面 = b152 §三 已列 4 项（raw 转正入 `public/art/scatter/`、恢复键、hills/mountain 池按原概率混入、③ 用例改写）＋ 本单新补 2 项：
1. 仓内**无可复算的 png→webp 管线**（§二 R2）⇒ A 案必须先补管线，否则新键会在 ① 处直接红（① 要的是 `<id>.webp`）；
2. 若 A 案想把 png 原件也留在发布目录，会撞 `scatterAssets.test.ts` ①b（现断言"原 png 不应在盘"）。
⇒ A 案**同时是 ③ 的破坏性变更**（R3），这两条要一起呈给拍板人，别只写"补图"。

**本单结论**：rock_cluster 不是"缺一张图"，而是**散布素材族少一条对账边 ＋ 反向哨兵只认一个后缀**这两处结构缺陷的联合产物；探针已证"放一张 png 孤儿进去，本族 15 条用例全部无感"。裁决（乙 or 丙）属人工/规划班，消盲区（甲）不需要裁决但要先定 id 抽取口径。

## 七、证据（命令原文与读数）

```
# C1 生成器侧 AST 计数 + 双向差集（scatter/buildings/terrain 三族一次跑齐）
$ cd D:/code/colony-game && python - <<'PY'   # ast 取 list[tuple] 首元，与 os.listdir 比对
SCATTER@gen_scatter_art.py: gen=9 disk=8 / 生成器有盘无: ['rock_cluster'] / 盘有生成器无: []
BUILDINGS@gen_buildings_art.py: gen=30 disk=33 / 生成器有盘无: [] / 盘有生成器无: ['bld_ancestor_shrine','bld_barracks','bld_house']
TERRAINS@gen_terrain_art.py: gen=5 disk=5 / 两侧差集皆空

# C2 磁盘发布面
$ python -c "import os,collections;fs=sorted(os.listdir('public/art/scatter'));print(len(fs),collections.Counter(...))"
files 8 ['.webp'×8]      # 无 png、无 manifest_scatter_*.json

# C3 无任何测试读 .py（R1 的否证式自证）
$ grep -rn "readFileSync\|readFile" --include=*.test.ts src | grep -i "\.py\|scripts"     # → 空

# C4 反向哨兵的后缀过滤器 与 ①b 的键枚举面（R2）
$ sed -n '37p' src/renderer/data/__tests__/scatterDiskReconcile.test.ts
  const onDisk = readdirSync(SCATTER_DIR).filter((f) => f.endsWith('.webp')).sort();
$ sed -n '23,33p' src/renderer/data/__tests__/scatterAssets.test.ts   # ①/①b 均以 ALL_SCATTER_IDS 为循环起点

# C5 ③ 的负向钉桩（R3）
$ sed -n '41,47p' src/renderer/data/__tests__/scatterAssets.test.ts   # not.toContain ×2 + 池概率 0.22/0.42

# C6 探针：png 孤儿 → 全绿
$ printf 'PROBE' > public/art/scatter/rock_cluster.png && npx vitest run <scatterAssets+scatterDiskReconcile>
rc=0 · Test Files 2 passed · Tests 15 passed (15)      # tmp/c924-16/probe-png.txt
$ rm -f public/art/scatter/rock_cluster.png && git status --porcelain -- public/    # → 空（零残留）

# C7 基线（改前后同读数，本单未改任何测试件）
$ npx vitest run src/renderer/data/__tests__/scatterAssets.test.ts src/renderer/data/__tests__/scatterDiskReconcile.test.ts > tmp/c924-16/baseline.txt 2>&1; echo rc=$?
rc=0 · 15 passed (15)                                   # 与 b152 档 §四 的 15 passed 一致，无漂移

# C8 生成器当前不可执行
$ python scripts/gen_scatter_art.py --help > tmp/c924-16/gen-run.txt 2>&1; echo rc=$?
rc=1 · ModuleNotFoundError: No module named 'gen_wanxiang_batch'

# C9 底稿与 gitignore
$ git check-ignore -v art-library/scatter_raw/rock_cluster.png   # → .gitignore:24:art-library/
$ python -c "import os;print(os.path.getsize('art-library/scatter_raw/rock_cluster.png'))"   # 1315701

# C10 台账侧现值（cwd 外，只读）
$ grep -n "B-152" docs/night-plans/BACKLOG.md | head    # → 195: | B-152 | L3 | …缺盘补图（清单 10/磁盘 9）… | queued |
$ grep -n "rock_cluster\|B-152" docs/insights/drain-20260923-pending-human.md   # → 空（从未入待人工册）
```

## 八、遗留（交主班）

1. **裁决出口**：乙（生成器停产 + BACKLOG 翻 closed(B)）还是丙（A 案补图，须连带 §六 丙 的 6 项）。甲不涉裁决，可先做，但要先定"从 .py 取 id"的口径与是否限定 scatter 族。
2. **待人工册补登**：rock_cluster/B-152 现为台账空档；BACKLOG 标题的"清单 10/磁盘 9"两个数需订正为"生成器 9／键 8／盘 8"。
3. **`scatterConfig.ts:42` 注释口径**：b152 档 §三 那份 diff 仍**未落地**，且它没覆盖 R1/R2 盲区；若走甲＋乙收口，注释宜改成"生成器已停产 ＋ 哨兵已双向对账"的新态，别只换措辞。
4. **buildings 族那 3 件**（`bld_ancestor_shrine`/`bld_barracks`/`bld_house`：盘有、生成器无）本单**未定性**，是同型待查面；若甲扩到族级，它们会首跑挂红，需另立单解释。
5. 本单产物 `docs/insights/colony-rockcluster-mismatch-20260924.md` **未自补 insights 索引**（按派单令交主班）。
