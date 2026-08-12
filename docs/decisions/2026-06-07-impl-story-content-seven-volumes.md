# Implement: 七卷剧情内容扩充（取材《天下人书记》）

Date: 2026-06-07
Supersedes: 部分延续 2026-06-01-impl-colony-phase3-story-content.md（Phase3 仅填了每卷 1 主干抉择）

## 原始需求
用户："把剧情也做了吧" + "把缺的全补上"。
现状：故事框架（StoryDriver/章节/双轴/三结局）已闭环，每卷只有 1 个关键抉择事件（共 9 个），120 天一章偏空。
目标：取材小说《天下人书记》(docs/design/_tianxiaren_source.md) 把七卷填饱满。

## 机制核查（动手前逐条验证，避免破推进）
- 事件调度 `sampleEventTrigger`：按**数组顺序**返回首个合格事件，一次一个（pendingEventId），故事冷却 `minDaysBetween=40`。
- 章节推进：`chapterGoalMet` 看 `advanceGoal.eventIds` 是否全在 `storyEventsTriggered`（**不按天数**；advanceAfterDays 仅 StoryBar 旧倒计时用）。
- 故事事件触发 `story_chapter == N`；沙盒 story_chapter=-1 → **永不触发，零污染**。
- `resolveEvent` 在选择/超时(选 0)路径，对 tag 含 '故事' 的事件记入 storyEventsTriggered。
- 结论：**补充事件加入对应章 advanceGoal.eventIds → 成为"必经剧情"**，按数组顺序逐个演（关键在前、补充在后），全部解决方推进，剧情更饱满而推进逻辑不破。沙盒零影响。

## 做了什么
1. **14 个剧情事件**（每卷 +2，取小说高光场景），合计 23 个（9 原 + 14 新）：
   - 卷一：arrest(裴绍处置裕王·活捉修堤赎债 vs 正法)、oath(教导队第一课·窝头分两半)
   - 卷二：shen(沈逸尘下狱·囚车撒土·公审"粮是你们自己种的吗")、zhou(周昭仪拆裹脚布·兴女学)
   - 卷三：arrest(马援朝囚车·亲笔信"这一路是你自己走的")、wang(王端立鉴台·"绑住天下人先绑住您")
   - 卷四：smith(赵铁锤炸炉七回·失指)、spy(种子与粮仓·失一眼·技术外授之界)
   - 卷五：gu(顾怀瑾博多湾守塔殉职·此灯之炬天下人之目)、ruan(阮小七援外·异乡稻穗)
   - 卷六：shen(沈逸尘自请轮换·"从我起")、yifa(议席把头·锄头放上议案·破把持)
   - 卷七：stele(裴绍境外立碑·护当地自决·不立功勋)、throne(撤龙椅·只留《天下人公约》白话册子)
   - 每个均双选抉择 + effects + 隐性双轴 storyAxisDelta（power 还权/集权、production 公有/私有），对齐该卷主题。
   - 角色：你=赵衍(不具名)；裴绍/沈逸尘/周昭仪/顾怀瑾/王端/马援朝/赵铁锤/阮小七为有名 NPC。
   - 意象：石碑/灯塔/蒸汽轮/囚车/白话册子。**架空名**（《社会主义纲要》→《天下人公约》、核查机构→"鉴台"），禁现实政治词。
2. **7 章 advanceGoal.eventIds 扩为全章事件 + hint 重写**（storyChapters.ts）。
3. **StoryBar 进度**：advanceGoal=story_events 时显"本章 X/Y 事"，替代会卡在"0 日"却不进章的天数倒计时（storyBar.ts）。

## 多模型审查（/review · DeepSeek 文案审）
DeepSeek 读全文按"必改/建议改/可不改"审 6 维度。**必改 5 条全采纳 + 建议改 5 条采纳**：
- 必改：yifa "工农"(×3 现代政治词)→"耕者匠人"；corruption "纪检之制"(现代词且与新"鉴台"冲突)→"明正其罪、立下纲纪"；smith descPlain "国帑"(偏字)→"朝廷的银子"；yifa "议事专业户"(现代词)→"议席把头"；yifa 纯抽象无场景→加"耕者陈情被斥、你把锄头搁上议案"画面。
- 建议改：arrest "大蛀虫"→"大贪官"；oath "被压榨的工匠"→"穷苦匠人"+"拉起"→"招募"；smith desc 补"坊间讥其奇技淫巧"使 desc/descPlain 一致；oath 口号句改为绑定"掰窝头分着吃"的动作。
- 未发现：其余现实政治词(社会主义/共产/无产阶级等)、已知禁字(玉圭/王畿等)、人物意象矛盾、标签格式——均干净。
- 暹罗：descPlain 本已写"外国"，desc 保留作远地名，不改。
（DeepSeek 全文审查记录见本会话 agent 输出。）

## 改了哪些文件
- src/renderer/data/storyEvents.ts（+14 事件，9→23；含 DeepSeek 采纳后的文案修订）
- src/renderer/data/storyChapters.ts（7 章 advanceGoal.eventIds + hint）
- src/renderer/ui/StoryBar.ts（进度显示改 X/Y 事）
- src/renderer/state/__tests__/gameStore.test.ts（3 处章节推进测试更新到新事件列表）
- src/renderer/data/__tests__/storyContent.test.ts（新增 4 条：无悬空引用 / 每卷≥3事件且tag故事 / 双选+推轴 / 三结局可达）

## 验证
- type-check（tsconfig.renderer）干净。
- npm test：657 passed（含新增 4 条剧情不变量；修订 3 条推进测试）。
- 禁忌词复查（工农/专业户/国帑/纪检/大蛀虫/被压榨）全清。
- electron:build:win 成功，桌面 exe 刷新。

## 待眼验/待续
- 节奏：每卷现 3-4 事件 × 40 天冷却 → 一卷约 120-160 天，全程约 1000+ 天。是否拖沓需真人试玩；可调 STORY_BALANCE.event.minDaysBetween。
- 油菜花意象在新事件暂缺位（结尾旁白可后补）；顾怀瑾/马援朝弧光已点到，深描留后续。
- 结局由双轴累积决定：一致"还权+公有"→公天下，一致集权→家天下，还权但守私有→货天下（测试已验三档可达）。
