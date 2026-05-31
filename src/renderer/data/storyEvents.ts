import type { CourtEvent } from './schema';

/**
 * 故事模式剧情事件（Phase 3）——取材《天下人书记》七卷，半文半白、不喊口号、架空名。
 *
 * 机制约定：
 *   - tag '故事' → 解决后记入 storyFlags.storyEventsTriggered（章节目标 advanceGoal 据此解锁下一章）。
 *   - trigger `story_chapter == N` 按章门控（沙盒 story_chapter=-1 → 永不触发，零污染）。
 *     不加 random 门控：剧情事件是章节必经，无挂起即触发，保证章节目标可达（不被坏运气卡章）。
 *   - choices.storyAxisDelta 悄悄推隐性双轴（power 负=集权/正=还权；production 负=私有/正=公有）。
 *   - OQ-S3 控量：1-2 章只 default context（零差异）；3/6 章起加按双轴的滤镜变体（同一事件多套文本）。
 *
 * 七卷各一关键🔀抉择事件（主干）。第五章 3 套独立内容（OQ-S3）后续按增量验证决定保 3 路/降 2 路。
 */
export const STORY_EVENTS: CourtEvent[] = [
  // ============ 一 · 血堤（破土：旧秩序裂缝中采火种） ============
  {
    id: 'evt_s_ch1_dike',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 1' }],
    contexts: [{
      condition: 'default',
      title: '江堤溃决',
      desc: '常州江堤夜溃，万民漂没；护堤之银，账上分明，库中却空。或彻查，或先抚乱。',
      descPlain: '大堤垮了，几万人没了，可修堤的钱账面在、库里空——查贪腐，还是先压住别出乱子？',
    }],
    choices: [
      {
        text: '起新人，彻查贪墨，不避权贵',
        textPlain: '【依法不依情】派信得过的新人去查，宁可得罪权门。民心+12、信誉+10。',
        effects: [
          { target: 'country_morale', op: 'add', value: 12 },
          { target: 'country_renown', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12 }, // 还权：把账交给众人看
      },
      {
        text: '压下风声，安定为先',
        textPlain: '【安定压一切】先弹压舆论，真相留待日后。军力+8、民心+4。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -15 }, // 集权：一纸令下压住
      },
    ],
    defaultTimeoutDays: 12,
  },
  {
    id: 'evt_s_ch1_cadre',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 1' }],
    contexts: [{
      condition: 'default',
      title: '谁来办事',
      desc: '查案要人。世家子弟谙熟旧例，流民工匠则只认道理不认门第。用谁？',
      descPlain: '办大事得有班底。是用熟门熟路的世家子弟，还是提拔认死理的流民工匠？',
    }],
    choices: [
      {
        text: '拔擢流民工匠，自成一队',
        textPlain: '【认道理不认血缘】组一支只认规矩的班底。信誉+8、民心+8。',
        effects: [
          { target: 'country_renown', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15 },
      },
      {
        text: '仍倚世家旧吏，稳妥办差',
        textPlain: '【倚重旧门】用熟手，办得快但欠人情。军力+5、钱+但欠新意。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 5 },
          { target: 'country_gold_output', op: 'add', value: 1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
      },
    ],
    defaultTimeoutDays: 12,
  },

  // ============ 二 · 分田（立碑：阶级斗争初展） ============
  {
    id: 'evt_s_ch2_grievance',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 2' }],
    contexts: [{
      condition: 'default',
      title: '诉苦之会',
      desc: '田在世家，耕者无获。公议局上，老农掏出布袋里一把土：这土的甜，他尝了一辈子，地却不是他的。',
      descPlain: '开了个评理会，佃农当众诉苦——种了一辈子地，地却归世家。你怎么办？',
    }],
    choices: [
      {
        text: '顺势分田，耕者有其田',
        textPlain: '【还地于民】推行分田。民心+18、粮产+5；触怒世家。',
        effects: [
          { target: 'country_morale', op: 'add', value: 18 },
          { target: 'country_grain_output', op: 'add', value: 5 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 10, production: 25 }, // 还权+公有
      },
      {
        text: '温言安抚，田制照旧',
        textPlain: '【护世家】安抚两边，维持旧制。民心+5、钱+2。',
        effects: [
          { target: 'country_morale', op: 'add', value: 5 },
          { target: 'country_gold_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: -15 }, // 私有固守
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch2_stele',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 2' }],
    contexts: [{
      condition: 'default',
      title: '勒石于市',
      desc: '新规要立得住，须刻于石、立于市，使人人能见、世代能查——不刻圣旨，刻大白话。豪绅夜里却来砸碑。',
      descPlain: '把新规矩刻成石碑立在集市，人人看得懂、改不了。可豪绅半夜来砸碑——你护不护？',
    }],
    choices: [
      {
        text: '遣队守碑，立制以恒',
        textPlain: '【制度长存】派人守碑护制。礼+2、信誉+10；耗粮守夜。',
        effects: [
          { target: 'country_rite_output', op: 'add', value: 2 },
          { target: 'country_renown', op: 'add', value: 10 },
          { target: 'country_grain_consumption', op: 'add', value: 1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12, production: 12 },
      },
      {
        text: '息事宁人，碑毁不究',
        textPlain: '【息事宁人】不追究，规矩成空文。军力+4。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10, production: -8 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  // ============ 三 · 淬火（自噬：自我革命）—— OQ-S3 起：3 章加滤镜变体 ============
  {
    id: 'evt_s_ch3_corruption',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 3' }],
    contexts: [
      {
        condition: 'default',
        title: '功臣之蠹',
        desc: '当年随你起事的老将，如今私吞军粮，且说得出一肚子苦衷——阵亡部下的遗属无人抚恤。查，还是不查？',
        descPlain: '老功臣贪了，理由还很"正当"（给阵亡兄弟的遗属）。要不要查自己人？',
      },
      {
        // 滤镜变体：玩家已偏还权（民意基础厚）→ 文本更强调"众人都在看"
        condition: 'story_power_axis > 30',
        title: '功臣之蠹（众目睽睽）',
        desc: '老将私吞军粮之事，已传遍市井。你立的规矩本说"无人例外"，如今第一个撞上来的，偏是自己人。',
        descPlain: '你定的规矩刚说"谁都不能例外"，第一个犯的就是老兄弟，而且全城都看着——你查不查？',
      },
    ],
    choices: [
      {
        text: '公审立纪，自己人也不例外',
        textPlain: '【革自己的命】公开审办，立纪检之制。信誉+15、民心+8；老臣寒心。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_morale', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 18 }, // 还权：制度高于人情
      },
      {
        text: '念旧情，私下了结',
        textPlain: '【容善意的例外】顾念旧情，悄悄抹平。军力+8、民心-4（风声渐坏）。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: -4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -15 }, // 集权庇护、坏制度根基
      },
    ],
    defaultTimeoutDays: 12,
  },

  // ============ 四 · 铁与火（熔铸：生产力革命）🔀③技术归公/归私——生产资料轴关键 ============
  {
    id: 'evt_s_ch4_patent',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 4' }],
    contexts: [{
      condition: 'default',
      title: '机巧之利',
      desc: '匠人炸了七回炉，终使铁器以水火自动。皇商愿出重金买断此术；亦有人言：此乃天下人之利，当公之于众。',
      descPlain: '蒸汽机造出来了。富商要花大钱买断专利独占；也有人说这是天下人的东西、该共享。',
    }],
    choices: [
      {
        text: '技术归公，匠人共享',
        textPlain: '【种子要撒出去】立专利共享之制。研究+12%、信誉+12；富商不悦。',
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.12 },
          { target: 'country_renown', op: 'add', value: 12 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: 30, power: 12 }, // 公有
      },
      {
        text: '专利归私，重金售于皇商',
        textPlain: '【粮仓锁起来】卖断专利换巨资。钱+大、军力+6；技术为一家所握。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 4 },
          { target: 'country_military_power', op: 'add', value: 6 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: -30 }, // 私有（货天下种子）
      },
    ],
    defaultTimeoutDays: 14,
  },

  // ============ 五 · 海与灯（远航：人类命运共同体）🔀④共同体/帝国殖民 ============
  {
    id: 'evt_s_ch5_lighthouse',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 5' }],
    contexts: [{
      condition: 'default',
      title: '海上之灯',
      desc: '邻邦渔民屡遭海寇劫掠。或遣师远征、立威海外；或筑灯塔之链，与各邦之人共守这一点光。',
      descPlain: '海上不太平。是出兵远征立威（顺势占地），还是建灯塔跟各邦一起守望、平等通好？',
    }],
    choices: [
      {
        text: '筑灯塔链，平等共守',
        textPlain: '【天下人之目】建灯塔、结平等之邦。信誉+15、外交+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_diplomacy_weight', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12, production: 10 },
      },
      {
        text: '遣师远征，立威拓土',
        textPlain: '【以威服远】远征海外、设据点。军力+12、钱+3；近殖民之道。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 12 },
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12, production: -10 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  // ============ 六 · 惊蛰（让权：制度性自我消解）🔀⑤让权/集权回潮——权力轴关键 ============
  {
    id: 'evt_s_ch6_term_limit',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 6' }],
    contexts: [
      {
        condition: 'default',
        title: '惊蛰之议',
        desc: '公议日久，竟生新的权门。有人提议立下任期，连你自己也不例外。革到最后一刀，敢不敢落在自己身上？',
        descPlain: '议事久了也出了新权贵。有人提议定任期限制，连你也得守。你让不让这个权？',
      },
      {
        condition: 'story_power_axis > 40',
        title: '惊蛰之议（众望所归）',
        desc: '还政于民已成大势，立任期之制，连你也甘为议席上一支写字的手——只待你点头。',
        descPlain: '还权已是大势所趋，定任期、连你也只是议事的一员——就差你松口。',
      },
    ],
    choices: [
      {
        text: '立任期之制，连君亦不例外',
        textPlain: '【绑住天下人先绑住自己】行任期限制。信誉+18、研究+10%；权门失势。',
        effects: [
          { target: 'country_renown', op: 'add', value: 18 },
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 40 }, // 还权（公天下临门一脚）
      },
      {
        text: '收拢权柄，以稳为重',
        textPlain: '【集权回潮】罢议事、收大权。军力+10、民心+4；制度名存实亡。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_morale', op: 'add', value: 4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -30 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  // ============ 七 · 归根（归去：个人退场，制度向前） ============
  {
    id: 'evt_s_ch7_war_vote',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 7' }],
    contexts: [{
      condition: 'default',
      title: '归根之战',
      desc: '外敌压境，而你已老。这一仗打不打、怎么打——是你乾纲独断，还是交由天下人共议？',
      descPlain: '强敌打来了，你也老了。这一仗的决定权，是你一个人定，还是交给大会一起定？',
    }],
    choices: [
      {
        text: '交付公议，天下人自定',
        textPlain: '【撤去龙椅】把战和之权交给大会。信誉+20、民心+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 20 },
          { target: 'country_morale', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 30 },
      },
      {
        text: '乾纲独断，亲掌征伐',
        textPlain: '【大权独揽】御驾亲征、独断战和。军力+15；龙椅仍在。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 15 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -20 },
      },
    ],
    defaultTimeoutDays: 14,
  },
];
