# colony SFX 硬链接复核与拆分方案（`sfx_click` ↔ `sfx_warn`）：三证全部吻合在册，但**硬链接省的空间几乎为零**（`.git` 侧同一 blob／`dist` 侧根本没链／重新检出直接就是两个 inode）——真正该管的是「一个 inode 挂两条资产」的连带风险与**这两条 wav 没有生成器**（c924-23）

- 班：`qoder-executor-20260924-0955-colony23`（Qoder 执行手）／created 2026-09-24
- 单：`zcode-bridge/inbox/c924-23.task.md`（软预算 25 分钟，**只读复核＋出方案**）
- 上游：`zcode-bridge/done/c923-24.result.md` 的硬链接登记（"是否拆开／是否算重复资产属产品决定，本单只登记"）
- 🔴 **本单零写零删**：两条 wav 的 mtime／inode／nlink 复核前后逐位不变，`git status --porcelain public/audio/` 空。方案只交人工选，不落任何处置。

## 一、三证复核（交付物①：与在册逐位一致）

| 证据 | `sfx_click.wav` | `sfx_warn.wav` | 与 c923-24 在册锚点 |
|---|---|---|---|
| `st_ino` | `2814749767321656` | `2814749767321656` | **同一 inode ✓ 逐位相符** |
| `st_nlink` | **2** | **2** | ✓ |
| `md5` | `12800247256e64a7bbe6341269a4edd5` | `12800247256e64a7bbe6341269a4edd5` | ✓ |
| `st_size` | 8,864 B | 8,864 B | ✓ |
| `st_mtime` | `1788537279.780688`（2026-09-04 23:54:39） | **同一个数**（硬链接共享 inode ⇒ 共享 mtime） | 在册未记，本单补 |

- 🔴 **inode 共享是"一份字节两条路径"，不是"两份文件被去重"**：改任一条的内容或时间戳，**另一条同步变**（见 §三 后果②）。
- 全仓音频面扫：`public/audio/` 15 件／**14 个不同 inode** ⇒ **这一对是全目录唯一的硬链接**，没有第三例。
- git 侧：两条路径的 index 条目指向**同一个 blob** `9e3dff107bc025ab4050314129d931c25764308d`（`git ls-files -s public/audio/` 末二行同哈希；`git cat-file blob 9e3dff…` 读出 8,864 B、md5 与工作树逐位相同）。
- 入库史：两条只在 **一个提交**里出现过——`54eafe9`（2026-08-13 "chore: 快照提交 6-7 月工作树（… 音频接入等）"）⇒ 硬链接**不是提交产生的**（git 不存硬链接），是这台机器工作树里的本地形态（文件 mtime 2026-09-04 晚于该提交，说明后续被就地重写/重拷过，内容未变所以 `git status` 干净）。

## 二、这条硬链接到底省了多少（本单最大的翻案）

| 位置 | 是否因硬链接省了字节 | 实测证据 |
|---|---|---|
| **`.git` 仓库** | **省 0 B** | 内容寻址本来就去重：两路径同一 blob `9e3dff…`，拆链后仍是这一条 blob |
| **`dist/`（构建产物）** | **省 0 B** | `dist/renderer/audio/sfx_click.wav` ino=`37436171902597229` nlink=**1**；`sfx_warn.wav` ino=`40813871623125113` nlink=**1** ⇒ **打包链早就把它们落成两个独立文件**，硬链接没穿过构建 |
| **本工作树** | 省 **8,864 B** | apparent 57,897,940 B vs 按 inode 去重 57,889,076 B，差 **恰 8,864 B** |
| **任何新克隆／CI／同事机器** | **省 0 B** | 🔴 实测：`git checkout-index` 把两条同时落盘 ⇒ 得到**两个互不相同的新 inode、`st_nlink` 均为 1**、`SAME_INODE? False`。**硬链接不可由仓库复现，是单机工件**（复算见 §六.4） |

⇒ **结论：这条链的"体积收益"= 8,864 B，且只在当前这一台机器的工作树里成立**；发布物、仓库、任何新检出都是 2 份。为省 8.7 KiB（占 15 件音频总盘的 **0.015%**）保留一个跨资产耦合点，**性价比是负的**。（另注：体积哨兵件 `src/renderer/state/__tests__/audioSizeSentinel.test.ts:14` 已在册提醒"不要用 `du -sb public/audio`，它少算 8,864 B"，与本单独立复算的 57,889,076 B **逐位吻合**。）

## 三、三后果处置表（卷宗点名交付）

| # | 后果 | 现状读数 | 若不处理 | 拆链后 | 证据 |
|---|---|---|---|---|---|
| ① | **`du` 少算 8,864 B** | 去重口径 57,889,076 B ／ 按路径口径 57,897,940 B | 任何用 `du` 估体积的人都会拿错基数；体积门若改用 `du` 即静默放走 8.7 KiB | **消失**（两口径归一） | §二 第 3 行；哨兵件 `:14` 已在册 |
| ② | **连带改写（同一 inode）** | nlink=2、mtime 同一个数 | 🔴 **风险最高点**：一次就地写（`open(p,'w')`／`fs.writeFile` 到任一文件）会**同时改掉另一条**，而两者语义不同（按钮声 vs 警报声）⇒ 表面看只动了一个资产，实际两个都变，且**内容分叉后无人知道自己覆盖了谁**；反向同理，一次误截断**同时摧毁两条 SFX** | **隔离**：各自独立 inode，互不影响 | §一 mtime/ino 读数 |
| ③ | **换音联动** | `SFX_KEYS`（`src/renderer/state/audioDirector.ts:36`）6 键含二者；`gen_sfx.py` **只生成 4 条**（bell/chime/gong/place，见其 `:92-96` 与 docstring "合成 4 个短音效"） | 换 `sfx_warn` 音 ⇒ 若新音更长，会撞兄弟班 c924-22 **正在写的 SFX 分桶上限**（在途未入库：基线 254,278 B → 上限 **279,706 B**，余量仅 **25,428 B**）。按 44.1 kHz 单声道 16-bit = 88,200 B/s 折算 ⇒ **新 warn 最长只能到 ≈0.388 s**（现为 0.100 s，即最多 **3.88 倍**），超一点即把该哨兵用例顶红 | 仍需守同一条上限；拆链不改变③的算术 | 余量算式见 §五.3 |

## 四、两个方案（本单**不选案**，交人工）

### 案 A：`copy` 断链（保内容不变，只解除耦合）

做法（**本单未执行**）：把任一文件读进内存 → 删除该路径 → 原字节写回 ⇒ nlink 归 1、字节逐位不变。

| 面 | 评估 |
|---|---|
| 成本 | 工作树 **+8,864 B**（仅此机器）；`.git`/`dist`/新检出 **0 变化** |
| 风险 | **最低**：md5 不变 ⇒ `git status` 干净（同 blob）、体积哨兵 `57,897,940 B`／`254,278 B` 两个基线**都不动**，不与他班 c924-22 的分桶上限冲突 |
| 副作用 | **不解决产品问题**：按钮声与警报声仍是同一个音色（§五.2），只是不再有连带改写风险 |
| 改动面 | 0 行代码；1 次文件操作（可用一次性脚本，不落仓） |
| 存档兼容 | **无影响**（音频不进存档，不涉及序列化字段） |

### 案 B：换独立音源（给 `sfx_warn` 一条真的警报声）

做法：在 `scripts/gen_sfx.py` 里新增 `warn()`（并可顺带补 `click()`，见 §五.1 的孤儿问题），重新生成后写回 `public/audio/sfx_warn.wav`。

| 面 | 评估 |
|---|---|
| 成本 | Python 约 **+15～30 行**（参照现有 `place()` `:80-89` 的合成范式）；**必须先断链**（案 A）或用 `wave.open(…, 'w')` 全新写——🔴 若沿用就地写，会把 `sfx_click` 一起改掉（后果②） |
| 风险 | **中**：① 属产品/听感决定，需人工选音，执行手无权定；② 🔴 **体积联动**——新 warn 若超 0.388 s 即撞兄弟班在途的 SFX 分桶上限 279,706 B，**该上限本身尚未入库、口径可能变**；③ 换音后必须同步更新 `c923-24` 的 `BASELINE_BYTES` 类基线（他班在册件） |
| 副作用 | 正面：消除"点击＝警报"的语义混淆；`sfx_warn` 有 5 处语义调用（预警 0.55／通牒 0.6／降格 0.5／Toast error 0.5／`GameScene.ts:523` 0.5）vs `sfx_click` 4 处按钮调用（`HUD.ts:340/394/422/505`，0.25）⇒ 二者混用同一音色是**真实可感的 UX 缺陷**，不只是洁癖 |
| 改动面 | `scripts/gen_sfx.py` ＋ 1 条 wav ＋ 可能的基线常量更新（**跨他班在册件，需主班排程**） |
| 存档兼容 | **无影响** |

### 案 C（登记为默认出口）：不处置，维持现状
c923-24 已"只登记不处置"。若人工判"8,864 B 与连带风险都不值得动"，则维持——但 §五.1 的**无生成器**问题独立成立，不因维持现状而消失。

⇒ **执行手推荐序（仅供参考，不构成裁决）**：案 A 先做（消风险、零基线冲击），案 B 排到产品选音之后再议。**最终选案交人工。**

## 五、附带发现（超出卷宗范围，只报不改）

1. 🔴 **`sfx_click.wav` / `sfx_warn.wav` 在仓内没有生成来源。** `scripts/gen_sfx.py`（97 行）docstring 自陈"合成 **4** 个短音效"，`__main__` 只调 `bell/chime/gong/place`；而 `SFX_KEYS`（`audioDirector.ts:36`）是 **6** 条 ⇒ 这 2 条 wav 既无合成器函数、`art-library/audio/` 下也**只有 `music/`（BGM 母带）**、无 SFX 母带。它们可恢复（git blob `9e3dff…` 在册）但**不可再生**（无参数化源）——想改这两个音，只能新写合成函数，或改派外部音频。**这是比硬链接更值得排的事**。
2. **"重复资产"之判成立但半对**：字节层面二者**完全相同**（同 md5）⇒ 存储层面确是重复；但**语义层面不是**——`playUi('sfx_click')` 走 0.25 音量给按钮，`playUi('sfx_warn')`/`playSfx('sfx_warn',0.5~0.6)` 给警报通牒。所以"删掉一条共用"这种最省的解法**会直接改变警报的听感**，不能算无害去重。
3. 🔴 **运行内存侧省不到**（与 `c924-21` 同口径互证）：`BootScene.ts:81` 对 6 个 key 逐个 `load.audio` ⇒ `cache.audio` 里 `sfx_click`/`sfx_warn` 是**两个不同 key、两份独立解码的 AudioBuffer**，即使盘上是同一 inode。单条 0.1 s 在 48 kHz 设备率下 ≈ 19,200 B ⇒ 两份 ≈ **38.4 KB 常驻**。拆链／去重**都不减这份内存**；要减得改加载逻辑（超出本单授权）。
4. **`dist/` 与 `public/` 不同源形态**：`dist` 两条 nlink=1、mtime 与 `public` 相同（1788537279）⇒ 构建是**按内容复制**、不保留硬链接。任何"靠硬链接给产物瘦身"的想法在现有构建链下**不成立**。

## 六、复算命令（全部只读；探针落 `tmp/c924-23/`，跑完已删）

```bash
cd D:/code/colony-game
# 1) 三证 + 全目录硬链接普查（交付物①）
python -c "
import os,glob,hashlib,collections
c=collections.defaultdict(list)
for p in sorted(glob.glob('public/audio/*')):
    s=os.stat(p); c[s.st_ino].append(p)
    if s.st_nlink>1: print(p, s.st_ino, 'nlink=',s.st_nlink, 'mtime=%.6f'%s.st_mtime,
                          'md5=',hashlib.md5(open(p,'rb').read()).hexdigest())
print('files',sum(len(v) for v in c.values()),'distinct inodes',len(c))
"
#   → 两行同 ino=2814749767321656 nlink=2 md5=12800247256e64a7bbe6341269a4edd5 ；15 files / 14 inodes

# 2) git 侧同 blob（证明仓库根本不省）
git ls-files -s public/audio/ | rg "sfx_(click|warn)"     # → 两行哈希同为 9e3dff107bc025ab4050314129d931c25764308d
git cat-file blob 9e3dff107bc025ab4050314129d931c25764308d | python -c "import sys,hashlib;d=sys.stdin.buffer.read();print(len(d),hashlib.md5(d).hexdigest())"
#   → 8864 12800247256e64a7bbe6341269a4edd5

# 3) 磁盘两口径差额
python -c "
import os,glob
a=sum(os.path.getsize(p) for p in glob.glob('public/audio/*'))
seen=set();u=0
for p in glob.glob('public/audio/*'):
    s=os.stat(p)
    if s.st_ino not in seen: seen.add(s.st_ino); u+=s.st_size
print('apparent',a,'unique',u,'delta',a-u)
"   # → 57897940 57889076 8864

# 4) 🔴 决定性：重新检出会不会复现硬链接？（案 A 之外的"反正会复现"直觉被此条否证）
mkdir -p tmp/c924-23/checkout && git ls-files public/audio/sfx_click.wav public/audio/sfx_warn.wav \
  | git checkout-index -f --stdin --prefix=tmp/c924-23/checkout/
python -c "
import os
b='tmp/c924-23/checkout/public/audio/'
x,y=os.stat(b+'sfx_click.wav'),os.stat(b+'sfx_warn.wav')
print(x.st_ino,y.st_ino,x.st_nlink,y.st_nlink,'SAME_INODE?',x.st_ino==y.st_ino)
"   # → 实测 2814749767375246 / 3377699720796986，nlink 均 1，SAME_INODE? False
    #   （具体 ino 号每次落盘都会变，**要点是两个号不同且 nlink=1**）；⚠ 跑完 rm -rf tmp/c924-23（tmp/ 由 .gitignore:25 忽略，已自证）

# 5) 生成器覆盖面（§五.1）
rg -n "^def |^    (bell|chime|gong|place|click|warn)\(\)|合成 [0-9]+ 个" scripts/gen_sfx.py   # → 只有 4 个音效函数，main 里只调 4 个
rg -n "SFX_KEYS" src/renderer/state/audioDirector.ts                                          # → :36，6 键
find art-library/audio -maxdepth 1 -type d                                                    # → 只有 music/

# 6) 零写零删自证（交付物③）：跑完本档所有命令后，下面三个读数必须与 §一 完全相同
python -c "
import os
for p in ['public/audio/sfx_click.wav','public/audio/sfx_warn.wav']:
    s=os.stat(p); print(p,'%.6f'%s.st_mtime,s.st_ino,s.st_nlink,s.st_size)
"   # → mtime 1788537279.780688 / ino 2814749767321656 / nlink 2 / 8864，两行完全一致
git status --porcelain public/audio/    # → 空
```

## 七、遗留问题（交人工／交主班）

1. 🔴 **选案交人工**：案 A（断链保声）／案 B（换独立警报声）／案 C（维持）。执行手推荐序 A→B 仅供参考，**本单未执行任何一项**。
2. **案 B 的前置未清**：需产品先定"警报声该是什么样"，且需人工确认是否顺带补 `click()` 生成器（§五.1）。
3. 🔴 **与兄弟班在途件的耦合**：`sfx_warn` 换音的体积余量（279,706 B 上限／最长 0.388 s）出自 `...-colony22` **未入库**的 c924-22 分桶改动；该上限一旦调整，§三③ 的算术要重取。本单**未打开**该测试件正文（只在 `git diff` 输出里读到其自述），排期请主班协调。
4. **`dist/` 侧结论的时效性**：§二 第 2 行与 §五.4 读的是当前磁盘上的 `dist/renderer/audio/`（构建产物、未跟踪件）；下次打包后需复采。本单不判定构建链正确性（那是 c924-22 在册范围）。
5. **索引欠账（按派单未补列）**：本档未进任何 `colony-insights-index-*`。
6. **`OPTIMIZATION_BACKLOG.md` 未追加**：他班在册 ` M` 件，禁碰；两条待裁决事项（本案选案、§五.1 无生成器）需主班代转。
7. **改动面行数**：新增 1 文件（本档），修改 0 行、删除 0 行；`src/`、`public/`、`scripts/`、测试件、配置件全部 0 改动。**存档兼容：无影响。**
