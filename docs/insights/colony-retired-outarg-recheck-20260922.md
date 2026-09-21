# colony 退役模块 outbox/outarg 引用复核（桥面零残留验证）（c922-116，2026-09-22T05:2x，只读核查级）

> 判据沿用 c922-114：三模块名 + 9 导出符号（合并 12 项）双口径、`rg -w` 与 `git grep -w` 分开写（**不带 `-r`**，`rg -rn` 的 `-r` 是 `--replace`）。本单只把扫描面从仓内换到桥面，不另造符号清单。
> 本单零改动：未增删改任何信箱件、未删任何 result。

## 一、结论（四句）

1. **桥面零「活文档」残留**：三模块名 / 12 项合并符号 / 源码路径形态 三个口径扫 `zcode-bridge/README.md`、`zcode-bridge/inbox/`（含 `000-QUEUE.md`）、`docs/night-plans/BACKLOG.md`、`PROTOCOL.md`、`FOCUS-MAP.md` → **活文档面零命中**。三模块在桥面**没有**任何一处仍被当在册模块引导后人开单。
2. **留痕面命中不少，且派单预扫读数错**：任务书写「本班预扫为 0 文件命中」——实跑 **outbox 6 份 result 命中**（其中 1 份是本波 c922-115 今晨新写，**派单时点真值＝5**）。`done/` 33 份、`logs/` 8 份、桥 `tmp/` 10 份。这些**全部属执行留痕，按纪律保留、不动**。
3. **本单最大价值＝抓到完成标准命令自身的两处假绿面**（不是被测对象的问题，是判据的问题）：① 任务书点名的 `zcode-bridge/000-QUEUE.md` **在磁盘上不存在**（真身是 `zcode-bridge/inbox/000-QUEUE.md`），该命令因此 **rc=2**；② 更隐蔽——`rg <模式> zcode-bridge/`（扫父目录）**静默返回空**，因为 `outbox/`、`done/`、`logs/` 三层全被根仓 `.gitignore:32/:33/:43` 忽略，不带 `--no-ignore` 时"零命中"完全可以是假绿。⇒ 本单所有"零命中"结论均以**显式列文件**或 **`--no-ignore`** 两种取数法各自独立复现。
4. **12 项符号口径在桥面零增量**：`comm -13 <三词命中集> <12 词命中集>` → **空**（差集 0 件）⇒ 桥面不存在"只提 `computeDayDeltas` 之流、不提模块名"的隐性引导，扩口径不改变判定。

## 二、锚点复核（任务书两条，逐字对磁盘）

| 任务书锚点 | 磁盘实况 | 判定 |
|---|---|---|
| `colony-retired-module-residual-20260916.md:8`「**terrainTextures / storyNpcs 两退役模块在 src/ 全树（.ts）零引用残留**：」 | `awk 'NR==8'` 逐字相同 | **未漂** |
| `colony-retired-render-20260917.md:21`「| terrainTextures（模块名） | 0 | 零命中 exit=1 |」 | `grep -n` 命中在 **:21**，内容逐字相同 | **未漂**（同档 :22-:31 是其符号面，本单沿用该清单） |

## 三、完成标准命令与实数（字面先命令后数字）

```
$ rg -c "terrainTextures|storyNpcs|resourceSystem" zcode-bridge/outbox/ -g '*.md'
zcode-bridge/outbox/c922-115-retired-backup-verify.result.md:10     ← 本波同族今晨新写（派单时点不存在）
zcode-bridge/outbox/c922-114-unreachable-recheck.result.md:22
zcode-bridge/outbox/c922-16-colony-plan-ledger.result.md:3
zcode-bridge/outbox/c922-19-colony-optibacklog-draft.result.md:3
zcode-bridge/outbox/n921-22-pipe-b147-window-conflict.result.md:9
zcode-bridge/outbox/n922-09-colony-baseline-file.result.md:1
→ 命中文件数 6（派单时点 5）/ outbox 总件数 350（全部 .md，-g '*.md' 不减集）  ← 任务书预扫「0 文件命中」**不成立**

$ rg -ln "terrainTextures|storyNpcs|resourceSystem" zcode-bridge/inbox/ zcode-bridge/000-QUEUE.md
rg: zcode-bridge/000-QUEUE.md: 系统找不到指定的文件。 (os error 2)
zcode-bridge/inbox/c922-116-retired-outarg-recheck.task.md
rc=2                                                                  ← 任务书给的路径不存在
$ ls -la zcode-bridge/000-QUEUE.md → No such file
$ ls -la zcode-bridge/inbox/000-QUEUE.md → 35270 B（真身；被 inbox/ 参数顺带覆盖，QUEUE 面零命中）
$ rg -c "terrainTextures|storyNpcs|resourceSystem" zcode-bridge/inbox/ → 只有上面 1 件（＝本单自身任务书，自指）
  inbox 总 .md 185 件（184 任务书 + 000-QUEUE.md）
```

> **分母是当班快照**：本波另有 4 路并行子班正在消费 inbox，两次测量之间 inbox 187→185、done 4040→4042、outbox 348→350（成对移件所致）。**分子（命中集 58 件、六面分布）在两次口径下未变**。引用分母请认这个时刻。

**假绿陷阱复现（判据级发现，值得所有"零残留"类单抄）**：

```
$ rg -c "terrainTextures|storyNpcs|resourceSystem" zcode-bridge/            → 0 行输出（无任何提示）
$ rg -c "terrainTextures|storyNpcs|resourceSystem" zcode-bridge/outbox/     → 6 行
$ rg -c --no-ignore "terrainTextures|storyNpcs|resourceSystem" zcode-bridge/ → 58 份文件
$ git check-ignore -v zcode-bridge/outbox/<任一>.result.md zcode-bridge/done/ zcode-bridge/logs/claims.log
  .gitignore:32:zcode-bridge/outbox/    .gitignore:33:zcode-bridge/done/    .gitignore:43:zcode-bridge/logs/
⇒ 扫父目录时 rg 按 ignore 规则整层跳过 outbox/done/logs，且**不打印 skipped 提示**（不同于 --no-ignore 才有全集）。
   与主班 03:4x 那条「git status --porcelain 对信箱三层恒空」同根同源：信箱三层的探针必须显式列路径或带 --no-ignore。
```

## 四、命中集全景与逐件判定（留痕 / 活文档）

命中口径：`rg --no-ignore -w`，三词与 12 词两个口径命中集**逐件相同**（差集空）。

| 面 | 命中件数 | 该面总件数 | 性质判定 | 处置 |
|---|---|---|---|---|
| `zcode-bridge/outbox/` | **6** | 350 | **全部留痕**（历史 result，引用退役模块是当班取证原文） | **不动**（纪律：留痕类不动） |
| `zcode-bridge/inbox/`（含 `000-QUEUE.md`） | **1** | 185 .md | **自指**＝本单任务书 `c922-116-…task.md` 自身正文提三词 | 随本单收口移 `done/`，非引导 |
| `zcode-bridge/done/` | **33** | 4042 | **全部留痕**（已归档 task/result，含 `h912-14`、`c914-38`、`n916b-04`、`n916c-12`、`p912-41`、`0913-0620-05` 等退役族原件） | **不动** |
| `zcode-bridge/logs/` | **8** | 78（其中 .md 5） | `claims.log` 2 行（本波 c922-115 自记）＋`replan-request.md` 2 行（9/18 补料请求快照）＋`night-brain-planner-*.json` 2 份＋`logs/raw/*-proposal-*.json` 4 份 → **全部是当时投递轮的输入快照＝留痕** | **不动**（详见 §五逐行判定） |
| `zcode-bridge/tmp/` | **10** | 78（其中 .md 6） | 探针/夜脑中间产物（`focus/*.jsonl`、`done-leftover-ledger.json`、`harvest-matrix-src.json`、`d913d-*/report.md`）＝**留痕** | **不动**（来源不明的 tmp 残留不删） |
| **活文档面** `zcode-bridge/README.md` | **0** | 1 | — | 无需改 |
| **活文档面** `docs/night-plans/BACKLOG.md` | **2 行** | — | B-132（`:233`）与 B-141（`:183`），**状态列均为 `done`** ⇒ 不会被重排开单 | 无需改（见 §五） |
| **活文档面** `docs/night-plans/PROTOCOL.md` / `FOCUS-MAP.md` | **0** | 2 | — | 无需改 |
| 根仓 `CLAUDE.md` / `AGENTS.md`（协作活文档） | **0** | 2 | — | 无需改 |

**路径形态二次口径**（防"不写模块名只写文件路径"的漏网）：

```
$ rg -n --no-ignore "renderer/state/resourceSystem|renderer/data/storyNpcs|renderer/render/terrainTextures|backup-colony-2026091"
      zcode-bridge/README.md zcode-bridge/inbox/ docs/night-plans/BACKLOG.md docs/night-plans/PROTOCOL.md docs/night-plans/FOCUS-MAP.md
→ 0 命中（活文档面零）
$ 同模式扫全桥面 --no-ignore → 命中只落在 done(4 件) + outbox(3 件)，logs/inbox/tmp 零
⇒ 连「从 tmp 备份拷回」这类恢复指引也没有以路径形态渗进活文档。
```

## 五、logs 面与 BACKLOG 面的两处"看着像活文档"逐行判定

1. `zcode-bridge/logs/replan-request.md:82` — 「| B-132 | L5① | colony 3 个疑似不可达模块核查与处置建议（storyNpcs/terrainTextures/resourceSystem，只出核查与建议不删码） | … | **done** | …」
   `:43` — 「| B-141 | L2 | colony 渲染退役范围核验 | … | **done** | 9/17 09:15 晨报回收——916-07 done（退役范围 3 模块（7d3aee3×2+aad0592）12 符号 rg 全零命中＝残留清单空」
   → 文件 mtime **2026-09-18 06:42**、首行自述「补料请求 seq=37」＝**一次性已消费请求**（夜脑按 seq 取用），非在网引导 ⇒ 判 **留痕**。
2. `docs/night-plans/BACKLOG.md:183 / :233` 是同两行的权威态，状态列实测 **done / done** ⇒ 权威活文档**没有**把三模块当在册事项；不产生"引导后人开单"。
3. `logs/night-brain-planner-20260913-181722.json`（1 处 `resourceSystem`）与 `-20260916-004707.json`（`storyNpcs`/`terrainTextures`）＝规划脑**当时运行的输入留档**，文件名带时间戳、非在网队列 ⇒ 判 **留痕**。

## 六、建议（本单不实施）

- **无需对桥面做任何清理或改写**：三模块在桥面的全部引用都是留痕，且活文档状态列已 done。前两轮（仓内 src/docs）＋本轮（桥面）合起来，"退役后引导面清零"这件事**已可结案**。
- 一条**判据级建议给主班/规划侧**（属信箱域基础设施文案，不属本单动手范围）：今后凡"零残留 / 已清账"类完成标准，若扫描面含 `outbox/`、`done/`、`logs/`，命令里必须**显式列出这三个子目录或统一带 `--no-ignore`**，并把"不带 --no-ignore 的父目录扫会静默返回空"写进任务书模板，否则会复现本单 §三那个 0 行输出假绿。
- 顺带登记（不改）：任务书完成标准里的 `zcode-bridge/000-QUEUE.md` 是**不存在路径**，正确路径 `zcode-bridge/inbox/000-QUEUE.md`；照字面跑会 rc=2，而 stdout 仍有正常结果 ⇒ 取 `PIPESTATUS[0]` 才会看见红，只看输出会全绿通过。同型隐患在派单模板里应统一。

## 七、本单改动清单

- 新增：本档 `docs/insights/colony-retired-outarg-recheck-20260922.md`
- 追加：`docs/insights/colony-insights-index-20260919.md` 1 行（纯 CRLF 守恒，字母序插入）
- 生产码 **零改动**；`zcode-bridge/` 全目录 **零写入**（outbox/done/inbox/logs 一字未动，符合任务书「留痕类不动」）
- 两仓 `git status`：colony 侧仅他班在途 7 项＋`.audit-b151-tmp/` 与本单 2 件，根仓侧未动（本单只在根仓跑了只读 `rg`/`git check-ignore`）
