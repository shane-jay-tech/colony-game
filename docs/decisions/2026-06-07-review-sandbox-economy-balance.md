# Review + Implement: 沙盒经济平衡校准（结构性审计 + 修复）

Date: 2026-06-07
模式: deep（核心玩法经济，多模型对抗审 + Opus 验证仲裁 + 落地）

## 原始需求
用户在"视觉线+音乐都已完成"后，从下一步内容方向中选择「沙盒平衡校准」。
目标：审查并调优主玩法经济，找结构性失衡（不纠结需试玩才能定的数字微调）。

## 经济数据快照（审计输入）
- 起始(沙盒,改前): wood80 stone30 people20 grain50，cloth/bronze/rite/gold=0。
- 20 栋建筑 cost/output/upkeep/housing（见 buildings.ts）。
- 国格 6 档 AND 门槛（聚落→城邑pop30 gold80→邦国→诸侯→霸主→天下共主pop320 gold1200 rite20）。
- 劳力占用制：employed=Σcost.people；idle=people−employed；建造门槛 idle≥cost.people；productionSystem/upkeep 跳过 people（→ upkeep.people 死字段）。
- 人口：baseHousingCap15(改前)，超上限仅冻结增长不饿死；grain≤0 才按 starveRate 流失。

## 多模型审查（verbatim 摘录）

### DeepSeek V4 Pro（deepseek-reviewer）— Verdict: broken
- C1 黄金死锁（最严重）：起始 gold=0，产金建筑(市集/驿道)被需花金的国策前置；无免费金源→城邑要 gold80 永远启动不了。修：起始给金 / 产金国策去金 / 加 T1 产金建筑。
- C2 开局人口超住房上限(20>15)：若触发惩罚则负螺旋。修：cap→25 或起始人口→12 或送一栋民居。
- C3 劳力一次性消耗、人口不可再生：建 2~3 栋耗尽，恢复极慢。**【Opus 验证：误读】** 实际是"占用释放"非"永久消耗"，拆除即归还，idle=people−employed。该条按事实驳回，但其底层关切（劳力经济）与 GPT C2 重叠为真问题。
- M4 时间尺度 1400ms/天 与 8h 严重失配（门槛几十秒达成）。修：放慢到 ~10000ms/天。
- M5 国策树全系依赖黄金，策略单一。
- M6 粮食中后期塌方（兵营5/王宫10 等累加，农田+10 难覆盖）。
- M7 礼器单一来源(祖庙+2)又被多处消耗(王宫10/共主门槛20)，过紧。
- minor：学塾性价比差近死内容；upkeep.people 死字段误导；相邻"取最高"需 UI 标注；石碑场耗礼无产出=陷阱。

### GPT-5.5 Pro（gpt-coder，交叉校验）
- CRITICAL1 Gold 完全死锁：与 DeepSeek C1 同，且明确指出"升城邑需市集→需cloth→需织官(t2)→需先升城邑"循环 + 驿道是唯一出路但路径不透明。修：加 t1 产金建筑 / 驿道降 t1 / 起始给金或降门槛。
- CRITICAL2 劳力约束几乎失效：15/20 栋 cost.people=0，用工误写在被忽略的 upkeep.people。修：upkeep.people 迁 cost.people，起始人口相应提到 25-30。**【Opus：采纳为头号修复】**
- CRITICAL3 开局 people20>cap15 增长锁死（必须先盖房，UX 不直觉）；与 C2 修复交叉可能形成劳力-住房双卡死。修：cap≥起始人口 / 起始人口<上限。
- MAJOR rite 链脆弱 + 石碑场陷阱；粮食后期需主动铺农田；bronze 链依赖城邑前置。
- minor 水碓定位模糊；纯消耗建筑(兵营/学宫/客馆/石碑场)需机制锚点；国格曲线后期三重瓶颈。

## Opus 验证（不照搬假设，逐条核代码）
1. **建筑被国策前置卡** ✓：market←pol_market、loom←pol_silkworm、post_road←pol_post_road…（upgradeRequires）。
2. **政策成本** ✓：pol_market{wood20,**gold10**}、pol_post_road{stone30,**gold20**}，prereq 均空。→ 两个唯一产金建筑都被需花金的国策锁住，起始 0 金 = **真硬死锁**。
3. **gold 旁路** 核查：diplomacy 通商给金但开通要先花 50 金（起始开不了）；events 有 +2 gold_output 但随机(≥50天)。→ 无可靠破局旁路，死锁坐实。
4. **占用制** ✓：getEmployedLabor 累加 cost.people（status constructing/working），getIdleLabor=people−employed clamp≥0。→ 占用非消耗，DeepSeek C3 驳回。
5. **人口超上限** ✓：population.ts grain≤0 才 starve；people≥cap 仅 reason='cap' rawNet=0 不回落。→ C2 是"冻结增长"非"饿死"，soft trap。
6. **石碑场** ✓：output[] upkeep{rite:1}，descPlain 称 +2信誉但无 effects 字段佐证 → 至少问题建筑，记入清单。

## 仲裁：本轮修（确认的结构性硬伤，不靠试玩即可定）
1. **破黄金死锁**：BALANCE.startingResources.gold=40（STORY=50）。够采纳 pol_market(10) 或 pol_post_road(20) 起步货币循环，并留缓冲让玩家做选择。保留国策金成本（有意义的支出）。
2. **解开局人口冻结**：baseHousingCap 15→25（STORY 18→35，故事起始 people30）。起始 people≤cap，开局即可增长。
3. **劳力占用制数据迁移（头号）**：把 13 栋建筑写在 upkeep.people 的用工搬进 cost.people，并清空 upkeep.people 死字段。新占用：market4/woodcutter2/quarry3/smithy5/barracks6/palace10/beacon2/water_mill3/iron_forge5（move）；farm5/loom8/post_road6/mulberry4/stele6（原 cost.people 保留，去掉重复的 upkeep.people）。单一事实源 = cost.people。修 farm/iron_forge descPlain"运营/日耗民"措辞为"占用 N 民"。
   - 效果：一局一之每建筑（除房/井）共占 ~69 劳力；起步 farm+woodcutter+quarry+mulberry=14，起始 20 人够；后期 pop 爬到 320 支撑扩张。**民重新成为真实约束**（核心机制复活）。

## 仲裁：本轮不动，留「待试玩校准」清单（避免无数据瞎调）
- 时间尺度 1400ms/天 是否配 8h 节奏（M4）——改动影响全局手感，须 playtest。
- 粮食中后期赤字（M6）——是否加"粮仓"缓冲 / 砍重型建筑耗粮。
- rite 链偏紧（M7）+ 石碑场信誉效果是否真接上——属内容/机制范畴。
- bronze 链、纯消耗建筑(兵营/学宫/客馆)价值——依赖邦交/战斗系统，by design。
- 学塾/水碓 性价比与定位 minor。

## 改了哪些文件
- src/renderer/data/balanceConfig.ts（起始金 + baseHousingCap，沙盒&故事两表）
- src/renderer/data/buildings.ts（13 栋 cost.people↑ + upkeep.people 清空 + 2 条 descPlain 措辞）
- src/renderer/state/__tests__/gameStore.test.ts（人口上限断言 15→25，意图不变）
- src/renderer/data/__tests__/economyBalance.test.ts（新增 6 条结构性不变量回归测试）

## 验证
- type-check（tsconfig.renderer）干净。
- npm test：653 passed（含新增 6 条）。
- electron:build:win 成功，桌面 exe 刷新。

## 给用户摘要见对话。
