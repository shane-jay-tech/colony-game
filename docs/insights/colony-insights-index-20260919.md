# colony docs/insights 索引（c920-01 生成 / c922-01 刷新 2026-09-21T21:05 / c922-13 追加 1 条 2026-09-21T22:52 / c922-14 追加 1 条 2026-09-22T00:22 / c922-15 追加 1 条 2026-09-22T00:33 / c922-16 追加 1 条 2026-09-22T00:41 / c922-17 追加 1 条 2026-09-22T00:52 / c922-19 追加 1 条 2026-09-22T02:39 / **c923-01 条目区按 `ls | sort` 整体重建＋头部改为下述机读口径 2026-09-23T01:1x / c923-03 追加 1 条 2026-09-23T01:3x** / **c924-01 欠账收口第二波：补列 20260923 全部 14 份欠账档（每条读首行出一句话摘要）＋刷新三数与 comm 读数、并订正本块 comm -23 的「0 行」旧记 2026-09-24T01:11**）

> **机读口径：下面这组命令就是本档的全部自述数。改条目区必复跑并同步本块，勿抄旧数。取数时刻 2026-09-24T01:11（c924-01 复跑），cwd `D:\code\colony-game`，HEAD `c07c461`。**
> - 条目数（不含本索引自身）：`grep -c '^- ' docs/insights/colony-insights-index-20260919.md` → **111**（c923-03 后为 97，c923-15 记「磁盘 105／条目 97／欠 7」；本班开工实测磁盘 112／条目 97 ⇒ **欠 14**，本单补 14 条）
> - 磁盘 .md：`ls docs/insights/*.md | wc -l` → **112**（本档末行带换行，故 `wc -l` 与 `python splitlines()` 此处同数；末行不带换行时 `wc -l` 会少 1，一律以 splitlines 为准）
> - **恒等式（本档唯一设计约定＝本索引不自列）：磁盘 .md ＝ 条目数 ＋ 1** → 112 ＝ 111 ＋ 1 ✓
> - 双向差集两条，重建后两向皆空（左＝磁盘集，右＝条目集）：
>   `comm -23 <(ls docs/insights/*.md | xargs -n1 basename | sort) <(grep '^- ' docs/insights/colony-insights-index-20260919.md | sed 's/^- //;s/ —.*//' | sort)` ＝ 盘上有而索引漏列 → **1 行**（**这 1 行恒为本档自身 `colony-insights-index-20260919.md`，即恒等式里那个 ＋1；左集去掉本档后为 0 行 ⇒「漏列已清零」**。⚠ 本块旧记「→ 0 行」是**数学上不成立的笔误**：条目 97 < 磁盘 98 时 comm -23 至少 1 行，c923-01 落笔即错，非本单引入）
>   本单复算实证：补列前该命令 **15 行**（本档自身＋14 份 20260923 欠账档），补列后 **1 行**（仅本档自身）；要「字面两向皆空」就在左集加 `| grep -v '^colony-insights-index-20260919\.md$'`，实测该式 0 行
>   `comm -13 <(同上一条左段) <(同上一条右段)` ＝ 索引有而盘上没有（幽灵条目）→ **0 行**（本单前后皆 0 行）
>   注：`sed 's/ —.*//'` 顺手吃掉行尾 `\r`，所以纯 CRLF 档上 comm 可直接用；前提是**每条条目行都含 ` — ` 分隔符**（本档现 111/111 满足，python 逐行自证），否则该口径失真。
> - 条目区排序：`python` 逐行比对 `names == sorted(names)` → **True**（本单补列时按 ASCII 升序插位；两处易错已现场纠偏：`missing` < `modifier`（'i'<'o'）、`orphan-commit` < `orphans-family`（`-` < `s`））。
> - `.json` 台账现 2 份（`colony-dead-exports-20260914.json`／`colony-suite-timings-20260921.json`）**不入条目口径**，此现行口径保持不动。
> - 🔴 **条目计数禁用大小写敏感字符类**：`grep -oE '^- [a-z0-9-]+\.md' | wc -l` 在同一份文件上实跑比 `grep -c '^- '` **少 1**——本目录有 camelCase 文件名 `colony-unreachable-resourceSystem-20260912.md`（大写 `S` 不被 `[a-z0-9-]` 匹配），被该口径**静默漏计**。这就是 74/75 争议的根因。**条目数只认 `grep '^- '` ＋ sed 切分隔符这一条口径。**
> - 本机 `rg` 只在交互式 shell 里是 alias（指向 Qoder 内置 ripgrep），非全局可执行文件 ⇒ 跨班复算一律用 `grep`／`git grep`／python，别假设 `rg` 可脚本化调用。

> **74/75 条目数争议结案（c922-19 提出 → c923-01 结案；原出口见 colony-optibacklog-status-draft-20260922.md §四）**
> - 争议原句：c922-19 在本档头部写「本班后磁盘 .md 77 份＝条目 75 ＋ 本索引自身 1 ＋ 未列 1」，并称 comm 机验「条目实测只有 74」「少列 1 份＝colony-unreachable-resourceSystem-20260912.md（在盘且在 HEAD，非本单留下）」，据此「不代补他人条目」。
> - **否证「少列」**：`git log -S'colony-unreachable-resourceSystem-20260912.md —' --oneline -- docs/insights/colony-insights-index-20260919.md` → 唯一命中 `bb721ea`（c920-01 索引首次生成，2026-09-20T04:56）⇒ **该条自初版即在列，从未缺失**；本档重建后现列第 112 行（行号随条目增减漂移：c924-01 补列 14 条后为**第 127 行**，非口径数）。c922-114 早在 9/22 05:05 已现场复核并留话「实测该条已在列，人工复核时先确认再定 74/75 口径」，本单据此结案。
> - **「74」从哪来**：同一时点两条命令各自都真——`grep -c '^- '` → 75（正确口径）；`grep -oE '^- [a-z0-9-]+\.md' | wc -l` → 74（camelCase 盲区）。逐行 comm 差集实证：被吞掉的正是 unreachable 那一条 ⇒「少列 1 份」与「条目只有 74」是**同一条命令的两个症状，互为伪证**（用它自己漏计的那条去指控别人漏列）。
> - **头部加和式错位**：c922-19 落笔时（`3a47d59`）实测条目 76、磁盘 .md 77，正确分解＝`77 ＝ 条目 76 ＋ 自身 1`；其「条目 75」是**追加前**的读数写进了**追加后**的自述，再用「未列 1」把差补平。
> - **逐笔复算**（条目＝`grep -c '^- '`，磁盘＝`git ls-tree -r --name-only <c> -- docs/insights` 里的 .md 数）：`99dcaa7` 74/75 ✓、`5dc41f1` 75/76 ✓、`3a47d59` 76/77 ✓、`1bcf506` 88/97 ✗ ⇒ **恒等式在 c922-19 之前的每一笔提交上都成立，历史上不存在真缺列**。
> - **本单真补的是 8 行**（不是 1 行）：c922-105…c922-133 各批出稿时有 8 档没追加索引行——p23-batch1／scatter-bidir／b152-close／codex-jit-link-eval／deadexports-refresh-recon／intro-backflow-decision／econ-inventory-appendix-draft／p4-docs-audit。这才是 `磁盘 97 vs 条目 88` 的真实缺口；本单按 `ls | sort` 反推补入并把条目区重排为文件名升序（顺带修掉 c922-13 遗留的一处排序倒置：auditb151 曾排在 art-full 之前）。

---
- colony-aegis-cadence-20260915.md — aegis 索引校验纳入例行方案（n915-64，只出设计）
- colony-art-full-20260919.md — public/art 全量资产双向对账（n919-32 批次 c920-14，只读零删除）
- colony-artmanifest-coverage-20260917.md — colony artManifest 三类覆盖矩阵＋path 字段消费者核验（916p-a3-006，2026-09-17，只读）
- colony-artmanifest-gap-20260917.md — colony U2：artManifest 两建筑缺图处置（n916d-23）
- colony-artmanifest-relink-20260920.md — 美术 manifest 双向断链修复、55 键改指实存图（c921-01，修数据＋翻 3 条把缺陷当契约的断言）
- colony-assets-size-20260919.md — assets 体积与重复文件普查（c920-15，只读零删除，9/20 06:3x 复测）
- colony-assets-slim-20260920.md — 资产瘦身第一批 62 图 png→webp（c921-02，含授权后删除原 png）
- colony-auditb151-tmp-20260922.md — colony `.audit-b151-tmp/` 未跟踪残留处置三案建议（c922-133，2026-09-22，建议单零处置：4 件 sha256／3 口径引用面／22 条翻案全表誊写＋三案回滚说明）
- colony-b152-close-20260922.md — colony B-152 关单口径核对：把 917-33 方案 B 的注释改写做成可直接 apply 的一行 diff，并说清为什么执行班不能自己按下去（c922-108，2026-09-22T03:54，未落地待拍板；src/renderer/data/scatterConfig.ts 零字节改动）
- colony-backlog-dup-ids-20260917.md — colony OPTIMIZATION_BACKLOG 编号重号与状态冲突核验（916p-a2-007 任务书同名族，2026-09-17，只读）
- colony-bgm-audio-profile-20260922.md — colony BGM 音频体积画像：9 条 mp3 逐文件码率/采样率/时长实测 ＋ 96k/128k 两档收益估算（c922-14，2026-09-22T00:22，只读零资产改动；本机无 ffprobe，口径为自写帧走查＋四路互证）
- colony-bgm-decode-rss-20260923.md — colony BGM 解码内存实测：c922-14 的 606.06 MiB 推算值经真机解码坐实（差 −0.029%），但它是**下界**——设备率 48 kHz 重采样后真实常驻 659 MiB 量级，且实测为常驻而非瞬时峰（清空引用＋gc 即回落）（c923-23，2026-09-23，只读探针、不改任何 src/）
- colony-boot-manifest-gaps-20260913.md — colony 散布/音频/UI_ART 入 boot 清单差异核查（c-19，2026-09-13，零改码）
- colony-bootscene-loaderror-20260916.md — colony BootScene loaderror 重复注册核查（n916f-07，只读判定）
- colony-bootscene-runtime-test-design-20260923.md — colony BootScene 运行时错误面测试设计稿：两处 catch 真实覆盖面只有 4 条路径且其中 2 条在真链／现有测试环境下结构不可达，任务书「进度条副作用」前提按字面为假（BootScene 零 this.add／零 progress 监听），最高价值可钉物是 catch 抓不到的三类静默失败（c923-13，2026-09-23，只设计不实现、生产码与测试码零改动）
- colony-build-size-20260920.md — 构建产物体积基线（c921-09，仅新增报告档、零代码改动；文件名沿用 20260920 而取数在 9/21 凌晨，报告首行已声明）
- colony-bushdry-triage-20260918.md — colony bush_dry 闲置清单项处置（核报＋执行版，c918-09）
- colony-codex-jit-link-eval-20260922.md — colony CodexPanel × JIT 联动最小接线评估（c922-120，2026-09-22，工程评估＋可实施方案设计、零实施：jitHints/Toast/CodexPanel/JitHintManager/UIScene 一行未改）
- colony-day-sanitize-census-20260923.md — colony「day 入口净化链」普查：证 **「dayClamp」是个不存在的名字**（真身＝saveLoad 范围拒载 ＋ tickDay 就地封顶两处），并给出「有限、非负成立／整数不成立（deserialize 唯独对 currentDay 不取整）」的判据；据此答复 c922-12 的删 clamp 提案——只能删 `Math.max(0,` 半个表达式且须先补整数校验（c923-11，2026-09-23，只读零 src 改动）
- colony-daypipeline-phase-batch-design-20260923.md — colony R4：dayPipeline 阶段事件批界契约设计稿，先否证卷宗前提「DAY_PHASE_ORDER 21 阶段」为实测 22，并登记既有顺序守卫比卷宗所述多一层（c923-27，2026-09-23，只设计不实现、零代码改动；台账出处 colony-plan-ledger-20260922.md:110 R4）
- colony-deadcode-dispose-20260916.md — colony toPhaserStyle/getExclusionGroup 死码处置材料（n916x-33）——标的已不存在，核验收口
- colony-deadexports-entries-recon-20260917.md — colony dead-exports entries 三处数字链条对账（917-39，只读零回写）
- colony-deadexports-out-param-20260917.md — colony audit-dead-exports.mjs `--out`/`--write` 参数化（n916d-25）
- colony-deadexports-readonly-20260916.md — colony audit-dead-exports.mjs 只读化改造（n916f-04）
- colony-deadexports-refresh-exec-20260923.md — colony dead-exports 台账刷新批·前置核验执行档（c923-03，2026-09-23，**零写分支**：git status 核得 JSON ` M`／`.bak` ` D` 两笔均未收口 ⇒ 未跑 `--write`；记 `.bak` 复活点 audit-dead-exports.mjs:122、实测在途污染面（saveLoad.test.ts 使 SaveLoadError 测试面命中 99→103，余三件在途 src 文件对 107 符号零影响）、今日只读回放现值 124 文件/107 条/86+21，并对 `:28`「22/108」给出「加时效注记而非改数」的出口 A/B）
- colony-deadexports-refresh-recon-20260922.md — colony dead-exports 默认 JSON 108 vs 复跑值对账（c922-118，2026-09-22，只读对账：全程未写他班在途 ` M` 的 colony-dead-exports-20260914.json、未 git add 任何文件）
- colony-econ-inventory-appendix-draft-20260922.md — colony 0905 经济参数清单 · 附录增补稿：逐键全表＋行号化＋账实差异登记（c922-123，2026-09-22，只读增补稿；红线域经济平衡数值零改动，权威基线仍是 economy-params-inventory-20260905.md，本稿不替代它）
- colony-econ-params-audit-20260918.md — colony 经济参数对账只读审计（c918-25 / P2-2 收尾欠账）
- colony-effects-shape-judges-design-20260923.md — colony effects 形态判据设计稿：把 c922-09 遗留的三条未钉判据（value 是否为 0 的静默无操作／同事件两选项重复 effects／storyAxisDelta 键合法性）做成取舍结论，**一律不比对 value 大小**（c923-07，2026-09-23，设计稿不实现，零测试与生产码改动）
- colony-font-chain-gap-20260922.md — colony 字体链路缺口核查：3 处 @font-face 指向空且从未入库的 public/fonts/、本机因装了 Noto SC 系统字体而看不见缺口、构建产物 /fonts/ 绝对路径未重写⇒补资产也不生效、CSP font-src 拦死外链⇒三案建议＋体积 40.91 MiB 与 OFL 注意（c922-111，2026-09-22T04:2x，只读零改动；字体面测试断言为 0）
- colony-hardcoded-inventory-20260916.md — colony P1-4 terrain/scatter/audio 硬编码清单与切片设计（c916-03）
- colony-hills-naming-20260913.md — colony 地形清单 hills/hill 命名统一记录（a-46，2026-09-13）
- colony-hygiene-inventory-20260917.md — colony 仓库卫生异常文件盘点（917-40，只读零改动）
- colony-inflight-ownership-20260919.md — colony 在途 7 文件归属核报（s918-12 / 并发会话现场）
- colony-insights-index-20260915.md — colony docs/insights 与 README/索引一致性（n915-78，只读）
- colony-insights-index-recount-20260917.md — colony insights 索引与现实份数漂移重算（916p-a3-003 关联单，2026-09-17）
- colony-insights-unref-20260917.md — colony 未引用 insights 收口核对（r917-19，p917-19 重投，只读零改动；9/20 12:46 生成，晚于旧索引故此前未列）
- colony-intro-backflow-decision-20260922.md — colony IntroScene 单向门回流出口裁决材料：三落点〔A 左上常驻／B 首屏仅／C 迷路检测触发〕结论与存档兼容状态各异，不打包裁决（c922-121，2026-09-22，裁决材料不实施；⚠ §四方案 C 命中存档兼容硬触发，需 GPT 独立复核后方可当定稿）
- colony-introscene-slice-20260919.md — colony IntroScene 序章流程薄切片核报（c918-21 / 锚点漂移记录）
- colony-iso-unify-design-20260923.md — colony 等距逆投影三合一设计方案（`tileFromLayerLocal`）：否证「去重三份活代码」的设想（四式里只一份活着、D 出生起无调用方），并把「floor 与 round 两种语义绝不可统一」写成硬约束＋判别联合签名，让两个会静默改语义的态编译期不可表达（c923-15，2026-09-23，只设计不实现、git diff 净零）
- colony-kiln-market-semantics-20260916.md — colony 陶窑→市集多源指向语义材料（c916-02，只列不改）
- colony-loaderror-dedup-20260916.md — colony BootScene loaderror 重复注册核查与最小修复（n916e-08）
- colony-loaderror-dedup-20260917.md — colony O1：BootScene loaderror handler 重复注册去重（n916d-24）
- colony-manifest-authority-batch1-20260912.md — colony asset manifest 权威化批次一报告（h912-11，2026-09-13 夜班）
- colony-manifest-disk-snapshot-20260922.md — colony manifest 事实源×资源盘全表快照：现值 78 键（对 9/16 的 79 净减 1＝bush_dry 删键）、双轨 existsSync 全绿、孤儿 5 件与 c922-109 的 13 件按事实源集对平，附「grep -c key: 口径对 5/7 类不可用」与反向哨兵只覆盖 scatter 一条（c922-117，2026-09-22，分析级零改动）
- colony-manifest-equivalence-20260913.md — colony 清单等价断言补测（c-18，2026-09-13）
- colony-manifest-portraits-orphan-20260922.md — colony public/art 4 件 manifest_portraits_*.json 孤儿裁决材料：首发＋三次 429 重试链台账／生成器已因 gen_wanxiang_batch 缺盘不可重跑／真孤儿 4 vs scatter 假孤儿 9 分面／受控移件实测全量 1338 例零红＋三案回滚表（c922-109，2026-09-22T04:0x，只读＋探针还原）
- colony-maprenderer-viewport-material-20260922.md — colony MapRenderer 视口反向映射提取材料：cameraMath 已抽 6 函数账 ＋ 仍内联 8 段的行区间×依赖键×建议测试（c922-15，2026-09-22T00:33，只读；在途 MapRenderer.ts 未动）
- colony-migration-v10-guard-20260916.md — colony 存档迁移 v10 前向守护设计材料（c916-06，不实现）
- colony-missing-assets-20260916.md — colony 启动面缺图清单核对（n916f-08，2026-09-16 建单 / 2026-09-17 夜执行）
- colony-modifier-zeroconsumer-census-20260923.md — colony 修饰注册表「四表零消费」5 键普查：独立重跑 c922-128 判据区分预留位与死注册，档头先立红线声明——全程只读键名与 op 面、零 value 读取、不碰经济平衡数值（c923-06，2026-09-23，纯只读普查，零 src 与零数据表改动）
- colony-onboarding-walkthrough-20260918.md — colony P2-1 新手引导三件套只读走查（c918-24 材料单）
- colony-optibacklog-status-draft-20260922.md — colony OPTIMIZATION_BACKLOG 未勾 11 项逐行对账草稿：合入文本＋已勾项锚过期 5 处＋索引自身账不齐（c922-19，2026-09-22T02:39，只读零写入该 M 域文件）
- colony-orphan-commit-precheck-20260922.md — colony 孤儿交付物归位预检：四件在途 M 的 10 hunks 全归族 A/B、混入 0，附 2 笔精确路径 message 草案与门禁命令清单；否证 c922-08 两处锚点（族 A 实为 4 调用点非 5；用例跳变现口径 1341→1345 非 1268→1272）（c922-127，2026-09-22T07:0x，只读＋计划，零提交）
- colony-orphans-family-a-20260923.md — colony 孤儿交付物族 A（MASK_FILL_WHITE）归位核验记录：核验通过（diff 纯度高、门禁全绿），但因两层上位约束禁子班 commit/add 而**本单零提交**，status partial 交主班代提交（c923-04，2026-09-23）
- colony-orphans-family-b-20260923.md — colony 孤儿交付物族 B（saveLoad ＋4 例 ＋ saveGuard3 TODO 退役）归位核验记录：两文件 diff 与上游描述实质吻合、注释断言逐条为真、门禁全绿，同因零提交交主班代提交（c923-05，2026-09-23，status partial）
- colony-p23-batch1-20260922.md — colony P2-3 操作反馈钩子批次一核对（危机 warn ＋ 资源不足两族落地状态，供后续批次〔放置/完工/晋升〕派单用真实现值；c922-106，2026-09-22T03:44 取数，零代码改动、零测试新增、未触碰 public/ 与任何在途禁区文件）
- colony-p23-hooks-map-20260919.md — colony P2-3 操作反馈钩子盘点（s918-13 / 只读缺口表，零改动）
- colony-p32-closure-20260918.md — colony P3-2 闭单证据复核（s918-14 / 只读，backlog 文件未动）
- colony-p4-docs-audit-20260922.md — colony P4 发布域文档巡检：FRIEND_GUIDE／PLAYTEST_CHECKLIST × v0.10 现状对账（c922-124，2026-09-22，只读对账，两份文档修订一律「加订正行／头注、原句一字不删」沿 c922-114 口径；OPTIMIZATION_BACKLOG 他班在途只登记）
- colony-p43-dress-20260918.md — colony P4-3 终检预演：verify + build 证据（c918-27）
- colony-packsprites-deadtool-20260922.md — colony pack-sprites 死工具链核查（c922-112，2026-09-22，只读＋建议级，含实跑探针还原）
- colony-phaser-minify-diagnosis-20260923.md — colony phaser 6.78 MB 未 minify 根因诊断：既不是 electron-builder 也不是 `--mode`，而是 electron-vite 给 renderer 预置 `build.minify: false` 且本仓 renderer 块从未覆盖 ⇒ 从 dev 快照到正式发布 renderer 两个 JS chunk 一直没压过，影响面不止 phaser（c923-17，2026-09-23，只读诊断：零构建、零 src 改动、零 dist 写入；结案 c922-18 开放问题）
- colony-plan-ledger-20260922.md — colony PLAN.md 7 项工作条逐子条完成度对账（30 条子条 × 状态 × 文件锚）＋夜间可切残余清单 R1-R8（c922-16，2026-09-22T00:41，只读零改动）
- colony-registry-keys-20260913.md — colony registry key 集中化与类型化访问核验（c-14，2026-09-13）
- colony-retired-backup-verify-20260922.md — colony 退役模块备份件完整性对账：6 件 tmp 备份 raw md5 2/6 等、LF 归一 6/6 等（差异纯行尾），"备份在盘"保障语义与实况相反（git 侧已推远端／tmp 侧被 gitignore），附 18e4364 时间线与跨仓 check-ignore 归因（c922-115，2026-09-22，只读核查级，零删档）
- colony-retired-module-residual-20260916.md — colony c914-38 退役模块残留引用核查（b916-04，只读）
- colony-retired-outarg-recheck-20260922.md — colony 退役模块桥面 outbox/inbox/QUEUE 引用复核：活文档面三口径零命中、留痕面 58 件全保留，并抓到判据自身两处假绿（rg 扫信箱父目录静默空返回＋任务书 QUEUE 路径不存在 rc=2）（c922-116，2026-09-22，只读核查级，零改动）
- colony-retired-render-20260917.md — colony 渲染退役范围核验（916-07，2026-09-17，只读）
- colony-saturation-calibration-plan-20260920.md — colony 木材/金币饱和校准方案（c919-51，只出方案不改数值）
- colony-save-v3-test-20260913.md — colony 存档 schema v3 兼容读取回归（c-22，2026-09-13）
- colony-saveguard-bounds-20260918.md — colony saveGuard 双 TODO 日间材料（s918-11 / 只读核报，零源码改动）
- colony-saveguard-coverage-20260923.md — colony saveGuard 守卫 × 用例对账矩阵（段①）：saveLoad 的 38 处 SaveLoadError 守卫逐位对账，并否证段②卷宗前提——被点名的校验函数**根本不产报错**，按原式补用例等于给「静默消毒」语义背书，故段②落 partial 交裁决（c923-30，2026-09-23，只读对账，本档不新增用例）
- colony-saveguard2-20260911.md — colony saveGuard2：constructionProgress 钳制 + resources shape 校验（2026-09-12 夜间执行班，
- colony-saveload-ui-gap-20260913.md — colony 存档 UI 暴露现状核查与最小接线评估（c-21，2026-09-13，只读）
- colony-savematrix-extend-20260916.md — colony saveMatrix 组 B 字段保留断言扩展（c916-07）
- colony-scatter-asset-decision-20260917.md — colony scatter rock_cluster 替代方案拍板材料（917-33/B-152，只读零改动）
- colony-scatter-asset-gap-20260917.md — colony 散布资产缺口核验（916p-a3-005，2026-09-17，只读）
- colony-scatter-bidir-20260922.md — colony scatter 键×盘双向对账补强：登记散布素材族对账判据从单向改双向的现值与白名单裁决归属，供 c922-16 item2.3 接续（c922-107，2026-09-22T03:49，只改 1 个测试文件＋本档；public/ 零触碰、scatterConfig.ts 数据未动）
- colony-scatter-gap-20260917.md — colony U1：scatterConfig rock_cluster 引用落差最小修复（n916d-22）
- colony-scenes-di-census-20260923.md — colony scenes 五景（Game／UI／Transition／ModeSelect／Intro）依赖注入面盘点：每格给 file:line 或测试件名的 registry 读×写×create 注入形态×订阅↔反注册矩阵，刻意避开已由 c923-13 覆盖的 BootScene（c923-32，2026-09-23，只读、零受版件改动）；⚠ 该档档头自述「本档不入任何 insights 索引」（引纪律档 §廿五末条「主班已停止 colony 代登索引」）——本单按机读口径仍补列以使差集归零，是否撤条留主班裁决
- colony-scripts-consistency-20260918.md — colony package.json scripts 与文档一致性核对（c918-28 / 只读，零改动）
- colony-shared-visual-constants-20260913.md — colony render/UI 共用视觉常量抽离（c-15，2026-09-13）
- colony-slicea-spec-drift-20260923.md — colony docs/history 全目录巡检：SLICE_A_SPEC 与现状的偏差清单，并登记「docs/history 全目录实测仅 1 件」的盘态（c923-25，2026-09-23，只读巡检：docs/history 一字未动，本档是 docs/insights 下唯一新增件）
- colony-src-intransit-20260917.md — colony src 在途改动归属核验＋禁触碰清单（r917-14，p917-14 重投，只读；9/20 12:44 生成，晚于旧索引故此前未列）
- colony-start-here-count-drift-20260917.md — colony START_HERE 测试计数漂移订正（916p-a3-003，2026-09-17）
- colony-starthere-count-check-20260917.md — colony START_HERE 其余计数与实测一致性核验（r917-32，p917-32 重投，只读；9/20 12:47 生成，晚于旧索引故此前未列）
- colony-starthere-drift-20260923.md — colony START_HERE 域计数漂移快照（R8 放行决策的前置证据）：五域现值全部实跑而非抄档，START_HERE 域计数面现漂 3 项且全是文档低估，另指认 `:51` 一处取数脚本看不见的漂移；结论重点是**取数工具 `--check` 从未接进任何门禁／CI**⇒这条漂移链没有自动看守（c923-34，2026-09-23，本单零写，START_HERE 与 domain-counts 脚本一字未改，R8 仍未放行）
- colony-startup-config-audit-20260917.md — colony 启动配置分支可达性全量核验（916p-a3-009，2026-09-17，只读）
- colony-storybalance-20260919.md — colony STORY_BALANCE 现值重盘（c919-07，只读零改动）
- colony-storynpcs-terrain-reachability-20260913.md — colony storyNpcs/terrainTextures 可达性实证与退役记录（a-45，2026-09-13）
- colony-stray-eq-file-20260917.md — colony 仓根 0 字节误入库文件 `=` 处置（916p-a3-001，2026-09-17）
- colony-suite-slowtail-20260922.md — colony 测试套件慢尾定位：Top5 文件×慢因分类×墙钟口径×提速序列 S1-S5（c922-17，2026-09-22T00:52，只读未改测试码）
- colony-terrain-ab-equal-20260922.md — colony 地形三方互等钉桩：terrainPaths 补 A×B 集合相等／逐项拼接／size／A×B×C 四块（定向 6→14 例，全量 1310，swamp 变异 4 红，c922-101，2026-09-22T03:0x，仅动 1 测试文件）
- colony-terrain-comment-fix-20260922.md — colony 地形注释漂移清账：artManifest:87 行号已指代化（1+/1−），MapRenderer .png 按 MASK_FILL_WHITE 在途门控顺延并给出口（c922-102，2026-09-22T03:1x，零行为改动）
- colony-terrain-naming-inventory-20260921.md — colony B-139 地形命名三方差异盘点（c921-06，重锚，只读零代码改动，仅新增本报告）
- colony-test-asset-map-20260921.md — colony 测试资产分布图＋零直接测试模块清单（c922-13，基线纠正为 124 文件/1291 例，零生产码改动）
- colony-test-baseline-20260921.md — colony 测试基线常驻档：工作树 1302／HEAD 干净态推 1298 ＠9d418ee，两口径分列＋过期档点名（n922-09，2026-09-22T02:5x，只读零改码）
- colony-typed-events-20260913.md — colony 状态事件面类型化落地（c-13，2026-09-13）
- colony-ui-adapter-guard-20260913.md — colony UI 适配器守卫测试（c-16，2026-09-13）
- colony-ui-webp-reuse-20260914.md — colony assets/ui 6 个 webp 的 UI 复用核查（d914-35，2026-09-14，只读）
- colony-uncommitted-inventory-20260917.md — colony 未提交生产改动盘点与提交就绪度核验（916p-a3-010，2026-09-17，只读）
- colony-unreachable-recheck-20260922.md — colony 三退役模块不可达性双口径复查＋历史文档头注建议清单（c922-114，2026-09-22，只建议不改写历史正文）
- colony-unreachable-resourceSystem-20260912.md — colony resourceSystem.ts 不可达模块处置报告（h912-14，2026-09-13 夜班）
- colony-untracked-residue-20260917.md — colony tmp/ 与 _archive/ 未跟踪残留盘点＋.gitignore 补丁（916p-a3-008，2026-09-17）
- colony-untracked-tests-intake-20260917.md — colony 未跟踪测试与 src/shared 入库收口（916p-a3-002，2026-09-17）
- colony-v10-guard-impl-20260916.md — colony v10 迁移前向守护断言实现（n916x-34，设计稿 colony-migration-v10-guard-20260916 落地）
- colony-v10-guard-spec-20260915.md — colony 存档 v10 bump 前向守护测试设计稿（n915-63，不写实现）
- cross-build-deps-20260913.md — learning / colony 离线构建与依赖可复现性核对（c-48，2026-09-13）
- economy-params-inventory-20260905.md — 经济系统参数只读盘点与失衡信号（2026-09-05 夜 1024，零改动）
- savegame-compat-audit-20260905.md — 存档兼容性测试体系审计（只读，2026-09-05 夜 1025）
