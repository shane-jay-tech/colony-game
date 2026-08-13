/**
 * 故事模式章节定义（Phase 2 骨架）。
 *
 * 内容正源 = 小说《天下人书记》（docs/design/_tianxiaren_source.md），逐卷剧情事件 = Phase 3。
 * 本轮只填 序章 + 第一章「血堤」占位（banner + 一句取材小说意象的引子）。
 * 铁律：文案半文半白禁偏字；不喊口号、用情节演绎；社会形态一律用 公天下/家天下/货天下。
 */

export interface ChapterDef {
  /** 0=序章，1..7=七卷 */
  chapter: number;
  id: string;
  /** 卷名（带"序章/第一章"前缀） */
  title: string;
  /** 通俗副标题（降低理解门槛） */
  subtitle: string;
  /** 时代标签 */
  era: string;
  /** 进入本章时顶栏 banner + 引子 Toast 文案（半文半白） */
  intro: string;
  /** 占位推进目标：在本章度过 N 天即进下一章（无 advanceGoal 时的降级/兼容）。序章靠统一推进，无此值。 */
  advanceAfterDays?: number;
  /** Phase3 真实章节目标：达成即解锁下一章（优先于 advanceAfterDays）。 */
  advanceGoal?: ChapterAdvanceGoal;
}

/** 章节推进目标（达成"目标"解锁下一章，替代纯时间 dwell）。 */
export interface ChapterAdvanceGoal {
  /** story_events：本章关键剧情事件全部解决；days：度过天数（占位） */
  kind: 'story_events' | 'days';
  /** kind=story_events：需全部解决的剧情事件 id 列表 */
  eventIds?: string[];
  /** kind=days：度过天数 */
  days?: number;
  /** 给玩家的本章目标提示（半文半白） */
  hint: string;
}

/**
 * 判定章节目标是否达成（纯函数）。
 * @param resolved 已解决的剧情事件 id 集合（storyFlags.storyEventsTriggered）
 * @param daysInChapter 在本章已度过的天数
 */
export function chapterGoalMet(
  goal: ChapterAdvanceGoal | undefined,
  resolved: ReadonlySet<string>,
  daysInChapter: number,
): boolean {
  if (!goal) return false;
  if (goal.kind === 'days') return daysInChapter >= (goal.days ?? 0);
  // story_events：所有指定事件都已解决
  return (goal.eventIds ?? []).every(id => resolved.has(id));
}

export const STORY_CHAPTERS: ChapterDef[] = [
  {
    chapter: 0,
    id: 'prologue',
    title: '序章 · 立邦',
    subtitle: '白手起家，统一天下',
    era: '春秋 · 青铜 · 小邦',
    intro: '草庐数十，炊烟初起。或以兵威、或以信义，且看你如何把这一隅小邦，做成天下共主。',
  },
  {
    chapter: 1,
    id: 'ch1_blood_dike',
    title: '第一章 · 血堤',
    subtitle: '破土——在旧秩序的裂缝里采集新火种',
    era: '邦国初成',
    // 取材卷一"江堤溃决查贪 + 组建教导队"，不喊口号、用情节起手
    intro: '王朝立国已久，堤决而万民溺，库银却不知所踪。有人说该查，有人说该压。你坐在大殿上，第一次觉得这把椅子硌人。',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch1_dike', 'evt_s_ch1_cadre', 'evt_s_ch1_arrest', 'evt_s_ch1_oath', 'evt_s_ch1_stand'], hint: '查清江堤贪墨，定下办事的班底，再立起这支队伍的根。' },
  },
  {
    chapter: 2,
    id: 'ch2_steles',
    title: '第二章 · 分田',
    subtitle: '立碑——把说不清的道理刻成谁都看得懂的字',
    era: '封建鼎盛',
    intro: '田在世家手里，耕的人却吃不饱。有人请你把地分了、把规矩刻在石上让人人能看；也有人说，动了世家的田，根基就乱了。',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch2_grievance', 'evt_s_ch2_stele', 'evt_s_ch2_shen', 'evt_s_ch2_zhou', 'evt_s_ch2_night_watch'], hint: '回应诉苦之会，把规矩刻上石头，护住推行新政的人，再让认字的光照进闺阁。' },
  },
  {
    chapter: 3,
    id: 'ch3_temper',
    title: '第三章 · 淬火',
    subtitle: '自噬——最难的一刀，是革自己人的命',
    era: '吏治成熟',
    intro: '当年随你起事的功臣，如今也学会了中饱私囊，且说得出一肚子苦衷。要不要查？查下去，先寒的是自己人的心。',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch3_corruption', 'evt_s_ch3_arrest', 'evt_s_ch3_last_drink', 'evt_s_ch3_wang', 'evt_s_ch3_mirror'], hint: '面对功臣之蠹，做出裁断，并决定这把刀要不要也对着自己。' },
  },
  {
    chapter: 4,
    id: 'ch4_iron_fire',
    title: '第四章 · 铁与火',
    subtitle: '熔铸——以水替力、以火炼铁，天下人都能省点死力气',
    era: '工业前夜',
    intro: '匠人炸了七回炉，终于让铁器自己动了起来。这等利器，是该归一家独占、还是天下共用？一念之差，国势两途。',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch4_patent', 'evt_s_ch4_smith', 'evt_s_ch4_rail', 'evt_s_ch4_spy', 'evt_s_ch4_frontier'], hint: '护住炸了七回炉的匠人，决定机巧之利归公还是归私，再定技术外授之界。' },
  },
  {
    chapter: 5,
    id: 'ch5_sea_lamp',
    title: '第五章 · 海与灯',
    subtitle: '远航——这盏灯，是恩赐，还是众人共守的光',
    era: '海洋通联',
    intro: '海上风高浪急，邻邦渔民屡遭劫掠。你可以遣师远征立威，也可以筑一串灯塔，让各邦之人共守这一点光。',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch5_lighthouse', 'evt_s_ch5_gu', 'evt_s_ch5_cabinet', 'evt_s_ch5_watcher', 'evt_s_ch5_ruan'], hint: '在远征立威与平等共守之间抉择，并决定这盏灯、这把稻种要不要照向异乡。' },
  },
  {
    chapter: 6,
    id: 'ch6_awaken',
    title: '第六章 · 惊蛰',
    subtitle: '让权——连坐在椅子上的人，也该被规矩绑住',
    era: '制度成熟',
    intro: '公议日久，竟也生出新的权门。有人提议立下任期，连你自己也不例外。革到最后一刀，敢不敢落在自己身上？',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch6_term_limit', 'evt_s_ch6_shen', 'evt_s_ch6_sickbed', 'evt_s_ch6_title', 'evt_s_ch6_yifa'], hint: '在让权与集权回潮之间做最后一次自我革命，连"议席世家"也一并破掉。' },
  },
  {
    chapter: 7,
    id: 'ch7_roots',
    title: '第七章 · 归根',
    subtitle: '归去——人会退场，事还往前走',
    era: '终局',
    intro: '外敌压境，而你已老。这一回，把要不要打、怎么打，交给天下人自己定。你这一生，到底给后人留下了什么？',
    advanceAfterDays: 120,
    advanceGoal: { kind: 'story_events', eventIds: ['evt_s_ch7_debate', 'evt_s_ch7_war_vote', 'evt_s_ch7_stele', 'evt_s_ch7_charter', 'evt_s_ch7_throne'], hint: '把战和之权交付天下人，立一块护人自决的碑，最后决定那把龙椅——撤，还是传——终章见分晓。' },
  },
];

/**
 * 三结局占位旁白（Phase 2 骨架；Phase 3 取材小说细化）。半文半白、架空名、不喊口号——用画面说话。
 */
export const ENDING_NARRATION: Record<'gong' | 'jia' | 'huo', string[]> = {
  gong: [
    '田归耕者，技归众人，权归公议。',
    '到最后，你做的不是坐稳那把椅子，而是亲手把它撤了——只在原处留下一本写满大白话的册子。',
    '【公天下】大道之行，天下为公。山河无主，亦无不主；事在人为，人各得其所。',
  ],
  jia: [
    '你终究没舍得放手。权与利，仍系于一姓一门。',
    '世道清明，仓廪也实，史书称你一声明君。只是这盛景如花，开过便要谢，下一轮兴衰，又在路上。',
    '【家天下】天下为家，传之子孙。明君易得，长治难求——龙椅犹在，循环不止。',
  ],
  huo: [
    '机巧之利尽归商贾，田宅作坊皆可买卖。国是富了，人心却凉了。',
    '灯塔成了商路的招牌，海港成了逐利的据点。天下人辛苦挣来的，转眼又被一小撮人收了去。',
    '【货天下】天下为货，强而不安。富者愈富，劳者复为人所食——这不是你当年想要的。',
  ],
};

/** 统一→建朝的跳变旁白（全屏过场，时间快进、王朝渐腐，为第一章铺垫）。 */
export const DYNASTY_TRANSITION_NARRATION = [
  '于是天下一统，你受推为王，立宗庙、定都邑，是为开国之君。',
  '岁月流转，数百年如水。你立下的规矩渐渐成了世家的家业，仓廪的粮渐渐进了少数人的囤，当年"谁种地谁吃饱"的话，没人再提。',
  '你阖目又睁眼，已是几百年后——同一血脉的后人坐在同一把椅子上，看着自己理想建起的国，烂成了最痛恨的模样。',
  '该有人，革自己祖宗的命了。',
];

/** 取章节定义；索引越界先 clamp 到 [0, 末章]，避免 n>7 误回退到序章（dwell=0 致卡死）。 */
export function chapterAt(n: number): ChapterDef {
  const maxCh = STORY_CHAPTERS[STORY_CHAPTERS.length - 1]!.chapter;
  const clamped = Math.max(0, Math.min(maxCh, Math.floor(n)));
  return STORY_CHAPTERS.find(c => c.chapter === clamped) ?? STORY_CHAPTERS[0]!;
}
