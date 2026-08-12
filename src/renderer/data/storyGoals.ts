/**
 * C-1.2 推荐目标系统 + C-2 叙事报文 + 史官评语。
 * 每章 1-2 个推荐目标，显示在 StoryBar。
 * 每章 8 条叙事报文 + 末尾 1 条史官评语。
 */

export interface ChapterGoal {
  chapter: number;
  id: string;
  description: string;
  descPlain: string;
  condition: GoalCondition;
  reward: GoalReward;
  failBulletin?: string;
}

export type GoalCondition =
  | { type: 'population_gte'; value: number }
  | { type: 'building_exists'; buildingId: string }
  | { type: 'resource_output_gte'; resource: string; value: number }
  | { type: 'has_trade_agreement' }
  | { type: 'renown_gte'; value: number }
  | { type: 'military_gt_enemies' };

export interface GoalReward {
  description: string;
  effectType: 'general_event' | 'bonus_scene' | 'survival_bonus' | 'none';
}

export const CHAPTER_GOALS: ChapterGoal[] = [
  {
    chapter: 1,
    id: 'goal_ch1_pop40',
    description: '人口达到 40',
    descPlain: '发展人口到 40 人。',
    condition: { type: 'population_gte', value: 40 },
    reward: { description: '额外将领招募事件', effectType: 'general_event' },
  },
  {
    chapter: 2,
    id: 'goal_ch2_stele',
    description: '建成石碑场',
    descPlain: '建造一座石碑场。',
    condition: { type: 'building_exists', buildingId: 'bld_stele_yard' },
    reward: { description: '沈逸尘额外对话场景', effectType: 'bonus_scene' },
    failBulletin: '世家暗中串联，不满之声四起。',
  },
  {
    chapter: 3,
    id: 'goal_ch3_censor',
    description: '建成监察台',
    descPlain: '建造监察台以整肃纲纪。',
    condition: { type: 'building_exists', buildingId: 'bld_censor' },
    reward: { description: '王端提前登场', effectType: 'bonus_scene' },
    failBulletin: '贪墨之风渐起，民怨积聚。',
  },
  {
    chapter: 4,
    id: 'goal_ch4_bronze',
    description: '铜产出 ≥ 8/日',
    descPlain: '铜矿日产量达到 8。',
    condition: { type: 'resource_output_gte', resource: 'bronze', value: 8 },
    reward: { description: '赵铁锤锻造加速 5 天', effectType: 'bonus_scene' },
  },
  {
    chapter: 5,
    id: 'goal_ch5_trade',
    description: '拥有贸易协定',
    descPlain: '与任一邦国签订贸易协定。',
    condition: { type: 'has_trade_agreement' },
    reward: { description: '顾怀瑾生还率 +30%', effectType: 'survival_bonus' },
  },
  {
    chapter: 6,
    id: 'goal_ch6_renown',
    description: '信誉 ≥ 50',
    descPlain: '国家信誉达到 50 以上。',
    condition: { type: 'renown_gte', value: 50 },
    reward: { description: '沈逸尘主动退位场景', effectType: 'bonus_scene' },
  },
  {
    chapter: 7,
    id: 'goal_ch7_military',
    description: '军力 > 外敌',
    descPlain: '军事力量超过所有外敌。',
    condition: { type: 'military_gt_enemies' },
    reward: { description: '投票场景更从容', effectType: 'bonus_scene' },
    failBulletin: '外敌入侵，损失惨重。',
  },
];

// ====================== 叙事报文 (每章 8 条 × 7 章 = 56 条) ==================

export interface NarrativeBulletin {
  id: string;
  chapter: number;
  dayOffset: number;
  text: string;
  textPlain: string;
  axisCondition?: { axis: 'power' | 'resource'; band: 'high' | 'low' };
}

export const NARRATIVE_BULLETINS: NarrativeBulletin[] = [
  // Chapter 1
  { id: 'bul_1_1', chapter: 1, dayOffset: 10, text: '草创之初，百废待兴。', textPlain: '刚开始建设，什么都缺。' },
  { id: 'bul_1_2', chapter: 1, dayOffset: 25, text: '田畴初辟，民有可食。', textPlain: '开始有粮食了。' },
  { id: 'bul_1_3', chapter: 1, dayOffset: 40, text: '远近闻风来附者日众。', textPlain: '人口在增长。' },
  { id: 'bul_1_4', chapter: 1, dayOffset: 55, text: '夜来有虎啸于野，民心稍怯。', textPlain: '野兽出没，百姓有点害怕。' },
  { id: 'bul_1_5', chapter: 1, dayOffset: 70, text: '邻邦遣人来探，打量我辈虚实。', textPlain: '别国派人来打探情况。' },
  { id: 'bul_1_6', chapter: 1, dayOffset: 85, text: '有匠人自远方来，愿效力。', textPlain: '有工匠来投奔。' },
  { id: 'bul_1_7', chapter: 1, dayOffset: 100, text: '民间传言我主有德，当兴大事。', textPlain: '百姓开始传说你有出息。' },
  { id: 'bul_1_8', chapter: 1, dayOffset: 115, text: '第一年将尽，聚落渐具规模。', textPlain: '第一年快过去了，发展不错。' },

  // Chapter 2
  { id: 'bul_2_1', chapter: 2, dayOffset: 10, text: '城邑初成，可称一方之主。', textPlain: '升级为城邑了。' },
  { id: 'bul_2_2', chapter: 2, dayOffset: 25, text: '四方商贾闻利而来。', textPlain: '商人开始来了。' },
  { id: 'bul_2_3', chapter: 2, dayOffset: 40, text: '世家大族暗中角力，各怀心思。', textPlain: '大家族开始争权夺利。' },
  { id: 'bul_2_4', chapter: 2, dayOffset: 55, text: '军士操练有素，可堪一战。', textPlain: '军队训练好了。' },
  { id: 'bul_2_5', chapter: 2, dayOffset: 70, text: '邻邦来使，态度比从前恭敬。', textPlain: '别国对我们态度好了。' },
  { id: 'bul_2_6', chapter: 2, dayOffset: 85, text: '有贤士来投，言愿佐天下之治。', textPlain: '有读书人来帮忙。' },
  { id: 'bul_2_7', chapter: 2, dayOffset: 100, text: '境内刑狱清平，民安其业。', textPlain: '治安不错，百姓安居。' },
  { id: 'bul_2_8', chapter: 2, dayOffset: 115, text: '沈逸尘密信：世道将变，君当早备。', textPlain: '沈逸尘提醒你做好准备。' },

  // Chapter 3
  { id: 'bul_3_1', chapter: 3, dayOffset: 10, text: '升邦国之号，列国侧目。', textPlain: '升格为邦国了，别国关注你。' },
  { id: 'bul_3_2', chapter: 3, dayOffset: 25, text: '权臣渐有跋扈之态。', textPlain: '官员开始嚣张了。' },
  { id: 'bul_3_3', chapter: 3, dayOffset: 40, text: '民间有歌谣讽刺贪官。', textPlain: '百姓编歌骂贪官。' },
  { id: 'bul_3_4', chapter: 3, dayOffset: 55, text: '铜价上涨，军备开销日增。', textPlain: '军费越来越高。' },
  { id: 'bul_3_5', chapter: 3, dayOffset: 70, text: '邻邦或结盟或敌视，格局渐明。', textPlain: '外交格局开始明朗。' },
  { id: 'bul_3_6', chapter: 3, dayOffset: 85, text: '有人密报：外戚欲干政。', textPlain: '有人告密说外戚想干预政治。' },
  { id: 'bul_3_7', chapter: 3, dayOffset: 100, text: '粮价稳定，百姓称善。', textPlain: '物价平稳，民心好。' },
  { id: 'bul_3_8', chapter: 3, dayOffset: 115, text: '王端来书：肃正须从速，迟则生变。', textPlain: '王端提醒你赶紧整顿纪律。' },

  // Chapter 4
  { id: 'bul_4_1', chapter: 4, dayOffset: 10, text: '铸冶之声日夜不绝。', textPlain: '冶炼很忙碌。' },
  { id: 'bul_4_2', chapter: 4, dayOffset: 25, text: '工匠造出新式农具，田亩增产。', textPlain: '技术进步了。' },
  { id: 'bul_4_3', chapter: 4, dayOffset: 40, text: '商路畅通，百货云集。', textPlain: '贸易繁荣。' },
  { id: 'bul_4_4', chapter: 4, dayOffset: 55, text: '有间谍潜入，意图不明。', textPlain: '发现间谍了。' },
  { id: 'bul_4_5', chapter: 4, dayOffset: 70, text: '赵铁锤献新铸之剑，锋利无匹。', textPlain: '赵铁锤打了一把好剑。' },
  { id: 'bul_4_6', chapter: 4, dayOffset: 85, text: '北方蛮夷骚扰边境，未酿大患。', textPlain: '北方骚扰，不严重。' },
  { id: 'bul_4_7', chapter: 4, dayOffset: 100, text: '民富而知礼，学塾入读者众。', textPlain: '百姓有钱了开始读书。' },
  { id: 'bul_4_8', chapter: 4, dayOffset: 115, text: '局势稳定，可图大业。', textPlain: '现在稳定了，可以搞大事。' },

  // Chapter 5
  { id: 'bul_5_1', chapter: 5, dayOffset: 10, text: '商船出海，远交近攻。', textPlain: '开始远洋贸易。' },
  { id: 'bul_5_2', chapter: 5, dayOffset: 25, text: '顾怀瑾携重金出使远方。', textPlain: '顾怀瑾出使远国。' },
  { id: 'bul_5_3', chapter: 5, dayOffset: 40, text: '远方传来异域之物，民皆好奇。', textPlain: '带回外国新奇东西。' },
  { id: 'bul_5_4', chapter: 5, dayOffset: 55, text: '有邦求盟，愿共御强敌。', textPlain: '有国家想跟我们结盟。' },
  { id: 'bul_5_5', chapter: 5, dayOffset: 70, text: '阮澄来信：南方局势有变。', textPlain: '阮澄说南边情况变了。' },
  { id: 'bul_5_6', chapter: 5, dayOffset: 85, text: '商贸带来财富，亦带来觊觎。', textPlain: '有钱了但也引人注意。' },
  { id: 'bul_5_7', chapter: 5, dayOffset: 100, text: '民间有声音：当止戈为武。', textPlain: '百姓希望和平。' },
  { id: 'bul_5_8', chapter: 5, dayOffset: 115, text: '大势渐成，天下归心指日可待。', textPlain: '天下形势对我们有利。' },

  // Chapter 6
  { id: 'bul_6_1', chapter: 6, dayOffset: 10, text: '朝堂之上，众议纷纷。', textPlain: '朝堂上争论不休。' },
  { id: 'bul_6_2', chapter: 6, dayOffset: 25, text: '沈逸尘面有倦色，或已萌退意。', textPlain: '沈逸尘看起来想退休了。' },
  { id: 'bul_6_3', chapter: 6, dayOffset: 40, text: '民间开始讨论：天下该姓什么。', textPlain: '百姓开始讨论谁来当老大。' },
  { id: 'bul_6_4', chapter: 6, dayOffset: 55, text: '世家分化，有人投诚有人观望。', textPlain: '大家族开始站队了。' },
  { id: 'bul_6_5', chapter: 6, dayOffset: 70, text: '远方强敌有异动，斥候来报。', textPlain: '远处的强国有动作。' },
  { id: 'bul_6_6', chapter: 6, dayOffset: 85, text: '国库充盈，但人心浮动。', textPlain: '有钱但人心不稳。' },
  { id: 'bul_6_7', chapter: 6, dayOffset: 100, text: '史官执笔，欲为本朝立传。', textPlain: '史官开始写我们的历史。' },
  { id: 'bul_6_8', chapter: 6, dayOffset: 115, text: '大局将定，最后一步在前方。', textPlain: '快到最终决战了。' },

  // Chapter 7
  { id: 'bul_7_1', chapter: 7, dayOffset: 10, text: '天下瞩目，最后抉择在即。', textPlain: '所有人都看着你做最后决定。' },
  { id: 'bul_7_2', chapter: 7, dayOffset: 25, text: '百姓翘首以盼。', textPlain: '百姓很期待结果。' },
  { id: 'bul_7_3', chapter: 7, dayOffset: 40, text: '诸将请战，欲一举定乾坤。', textPlain: '将军们想打最后一仗。' },
  { id: 'bul_7_4', chapter: 7, dayOffset: 55, text: '文臣进言：可不战而胜。', textPlain: '文官们说不用打也能赢。' },
  { id: 'bul_7_5', chapter: 7, dayOffset: 70, text: '远方来使纳降。', textPlain: '远方的国家投降了。' },
  { id: 'bul_7_6', chapter: 7, dayOffset: 85, text: '最后的敌手犹在观望。', textPlain: '最后的对手还在犹豫。' },
  { id: 'bul_7_7', chapter: 7, dayOffset: 100, text: '万民山呼，大势已定。', textPlain: '百姓欢呼，大局已定。' },
  { id: 'bul_7_8', chapter: 7, dayOffset: 115, text: '史官落笔，一朝功业从此定论。', textPlain: '历史定格了你的功绩。' },
];

// ====================== 史官评语 (每章末 1 条 = 7 条) ========================

export interface HistorianComment {
  chapter: number;
  id: string;
  neutralText: string;
  centralizeText: string;
  devolveText: string;
}

export const HISTORIAN_COMMENTS: HistorianComment[] = [
  {
    chapter: 1, id: 'hist_ch1',
    neutralText: '草创之主，未见倾向。',
    centralizeText: '此主行事果断，颇有独揽之志。',
    devolveText: '此主善于纳言，有让贤之风。',
  },
  {
    chapter: 2, id: 'hist_ch2',
    neutralText: '城邑既成，路线未明。',
    centralizeText: '令出一门，上下肃然。',
    devolveText: '广开言路，众议而行。',
  },
  {
    chapter: 3, id: 'hist_ch3',
    neutralText: '邦国初立，尚在摸索。',
    centralizeText: '权柄日重，百官俯首。',
    devolveText: '分权于臣，社稷共治。',
  },
  {
    chapter: 4, id: 'hist_ch4',
    neutralText: '国力渐盛，前途未卜。',
    centralizeText: '铸器强兵，威加四方。',
    devolveText: '以商通四海，不以兵威人。',
  },
  {
    chapter: 5, id: 'hist_ch5',
    neutralText: '远交近攻，审时度势。',
    centralizeText: '天下畏其威，莫敢不从。',
    devolveText: '以德服人，远近来归。',
  },
  {
    chapter: 6, id: 'hist_ch6',
    neutralText: '大势将定，犹有变数。',
    centralizeText: '一言九鼎，乾纲独断。',
    devolveText: '众望所归，非私一人。',
  },
  {
    chapter: 7, id: 'hist_ch7',
    neutralText: '功过是非，留待后人评说。',
    centralizeText: '千秋功业系一身，是耶非耶后世论。',
    devolveText: '还政于民，天下为公。',
  },
];

export function getHistorianComment(chapter: number, powerAxis: number): string {
  const entry = HISTORIAN_COMMENTS.find(h => h.chapter === chapter);
  if (!entry) return '';
  if (powerAxis <= -34) return entry.centralizeText;
  if (powerAxis >= 34) return entry.devolveText;
  return entry.neutralText;
}

export function getBulletinsForChapter(chapter: number): NarrativeBulletin[] {
  return NARRATIVE_BULLETINS.filter(b => b.chapter === chapter);
}

export function getGoalsForChapter(chapter: number): ChapterGoal[] {
  return CHAPTER_GOALS.filter(g => g.chapter === chapter);
}
