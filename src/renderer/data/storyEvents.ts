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
 * 七卷主干🔀抉择事件 + 每卷取材小说高光场景的剧情事件（共扩充至每卷 3-4 个）。
 * 补充事件同样按 story_chapter 门控、tag '故事'、并已纳入各章 advanceGoal.eventIds（见 storyChapters.ts），
 * 故为"必经剧情"——按数组顺序逐个触发（关键事件在前、补充在后），全部解决方推进下章，剧情更饱满而推进逻辑不破。
 * 角色：你=赵衍（不具名，玩家本人）；裴绍/沈逸尘/周昭仪/顾怀瑾/王端/马援朝/赵铁锤/阮小七为有名 NPC。
 * 意象贯穿：石碑/灯塔/蒸汽轮/囚车/白话册子《天下人公约》（架空名，禁现实政治词）/油菜花。
 */
export const STORY_EVENTS: CourtEvent[] = [
  // ============ 一 · 血堤（破土：旧秩序裂缝中采火种） ============
  {
    id: 'evt_s_ch1_dike',
    illustrationKey: 'evt_art_flood',
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

  {
    id: 'evt_s_ch1_arrest',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 1' }],
    contexts: [{
      condition: 'default',
      title: '抓人，活着',
      desc: '裴绍率众围住裕王府，遣人来问如何处置。你给的密旨只八字：抓人，不要杀人，活着。',
      descPlain: '裴绍围了贪墨主谋的府邸，来问怎么发落。死了的人能被装成忠臣烈士，活着的贪官才一直是贪官——你怎么定？',
    }],
    choices: [
      {
        text: '活捉示众，令其亲手修堤赎债',
        textPlain: '【让天下人看着】不杀，押去常州天天背石头修堤，让人人看见——天家的人也是人，也得用双手还债。民心+8、信誉+10。',
        effects: [
          { target: 'country_morale', op: 'add', value: 8 },
          { target: 'country_renown', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 10 },
      },
      {
        text: '就地正法，以儆余党',
        textPlain: '【雷霆立威】当场处决，震慑同党，一了百了。军力+10、民心+4。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_morale', op: 'add', value: 4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
      },
    ],
    defaultTimeoutDays: 12,
  },
  {
    id: 'evt_s_ch1_oath',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 1' }],
    contexts: [{
      condition: 'default',
      title: '窝头分两半',
      desc: '城西废营，新募的流民、伤兵、工徒围坐土上。有人问："咱们听谁的？"你掰开一只黑面窝头，分与身旁老兵。',
      descPlain: '新招募的队伍是流民、伤残老兵、穷苦匠人。有人问"听谁的"。你把一个粗面窝头掰成两半分出去——这第一课，你怎么上？',
    }],
    choices: [
      {
        text: '听道理——谁砌堤谁打铁谁种地，谁就该先吃饱',
        textPlain: '【认道理不认门第】坐到地上跟大家围一圈，把窝头掰开分着吃：谁砌堤、谁打铁、谁种地，谁就该先吃饱。民心+10、信誉+8。',
        effects: [
          { target: 'country_morale', op: 'add', value: 10 },
          { target: 'country_renown', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12 },
      },
      {
        text: '立军规——令行禁止，只认号令',
        textPlain: '【先立规矩】不讲那么多，先把纪律立起来，号令如山。军力+8。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
      },
    ],
    defaultTimeoutDays: 12,
  },

  {
    id: 'evt_s_ch1_stand',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 1' }],
    contexts: [{
      condition: 'default',
      title: '公道不是跪出来的',
      desc: '一个常州流民跪在营前，说他爹死在堤下时留话——天底下没公道。你伸手把他拉起来。',
      descPlain: '一个逃难来的灾民跪在门口，说他爹临死前说这世上没有公道。你把他扶起来——然后呢？',
    }],
    choices: [
      {
        text: '授以锄镐，教他自立——公道不是跪出来的，是站出来的',
        textPlain: '【先扶人站起来】发给他农具和地，让他自己站着挣回公道，不靠人施舍。民心+10、信誉+8。',
        effects: [
          { target: 'country_morale', op: 'add', value: 10 },
          { target: 'country_renown', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12 },
      },
      {
        text: '赐粮赐帛，好言抚慰',
        textPlain: '【给鱼不给渔】赏些钱粮安抚，先别闹出事。民心+6、钱-1。',
        effects: [
          { target: 'country_morale', op: 'add', value: 6 },
          { target: 'country_gold_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -8 },
      },
    ],
    defaultTimeoutDays: 12,
  },

  // ============ 二 · 分田（立碑：阶级斗争初展） ============
  {
    id: 'evt_s_ch2_grievance',
    illustrationKey: 'evt_art_rebellion',
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

  {
    id: 'evt_s_ch2_shen',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 2' }],
    contexts: [{
      condition: 'default',
      title: '囚车前的泥土',
      desc: '推行分田的寒门官员沈逸尘，被七县田主联名弹劾，押回京下狱。囚车过城门，路两侧跪满从江南赶来的农人，将一把把泥土撒在车前。',
      descPlain: '帮你推分田的清官沈逸尘，被世家告倒下了狱。囚车过城，农民们跪在两边往车前撒土送他。怎么办？',
    }],
    choices: [
      {
        text: '公开审理，准各州县派人旁听',
        textPlain: '【摆到台面上】让各地派代表来听审。当堂只问原告一句：你们田里的粮，是你们自己种的吗？满堂寂静。信誉+12、民心+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 12 },
          { target: 'country_morale', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12, production: 12 },
      },
      {
        text: '私下从轻，息事宁人',
        textPlain: '【大事化小】悄悄轻判放人，不把世家逼到墙角，先稳住局面。民心+4、钱+2。',
        effects: [
          { target: 'country_morale', op: 'add', value: 4 },
          { target: 'country_gold_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10, production: -8 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch2_zhou',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 2' }],
    contexts: [{
      condition: 'default',
      title: '拆下的裹脚布',
      desc: '周昭仪入乡教农女识字。有母言："认字的女娃嫁不出去。"她当众拆下自己的裹脚布，伸足于前："您看我，没缠脚，认字，活得挺好。"',
      descPlain: '周昭仪下乡教农家女孩认字，有母亲说"认字的女娃嫁不掉"。她当场拆了自己的裹脚布给那母亲看："我没缠脚，我认字，我活得挺好。"要不要把女学办起来？',
    }],
    choices: [
      {
        text: '广设女学，农女皆可入塾',
        textPlain: '【天亮一分】分到地，还得认得契上的字才不被骗回去。让女子也进学堂。民心+8、信誉+10。',
        effects: [
          { target: 'country_morale', op: 'add', value: 8 },
          { target: 'country_renown', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 10, production: 10 },
      },
      {
        text: '循其旧俗，此事从缓',
        textPlain: '【不动旧规】乡里风俗根深，暂不强求，免生事端。钱+2。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: -8 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  {
    id: 'evt_s_ch2_night_watch',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 2' }],
    contexts: [{
      condition: 'default',
      title: '碑下的土还在喘气',
      desc: '豪绅私兵夜袭湖州，砸碑吊人。你遣队入村，不搜不剿，只令守碑护夜。一老农深夜拉战士听碑底之土：「听见没？地底下的人还在喘气——他们等着看这块碑能不能立住。」',
      descPlain: '豪绅半夜带人砸了分田的石碑，把带头的农户吊在树上。你派人进村——怎么处置？',
    }],
    choices: [
      {
        text: '守夜护碑，白日助耕，夜里讲课',
        textPlain: '【碑在人在】不剿不杀，只守碑：白天帮种地，晚上给村民讲碑上的大白话。民心+12、信誉+10；耗粮守夜。',
        effects: [
          { target: 'country_morale', op: 'add', value: 12 },
          { target: 'country_renown', op: 'add', value: 10 },
          { target: 'country_grain_consumption', op: 'add', value: 1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15, production: 10 },
      },
      {
        text: '调兵清剿，以儆效尤',
        textPlain: '【立威镇场】把砸碑的人抓起来从重处置，杀鸡儆猴。军力+8、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12 },
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
        textPlain: '【革自己的命】公开审办，明正其罪、立下纲纪。信誉+15、民心+8；老臣寒心。',
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

  {
    id: 'evt_s_ch3_arrest',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 3' }],
    contexts: [{
      condition: 'default',
      title: '囚车里的信',
      desc: '当年常州背石头的流犯，十二年间积功升至将军，竟成第二个裕王。裴绍亲手押他入囚车——车中不置刑具，只待放一物。',
      descPlain: '一个当年苦出身、靠你起家的老将，十二年里贪成了又一个大贪官。裴绍把他押上囚车。这一程，你给他留下什么？',
    }],
    choices: [
      {
        text: '只留一封亲笔信：这一路是你自己走的',
        textPlain: '【仁至义尽，法不容情】不加刑，只在车里放一封信——"老马，这一路是你自己走的，我没能拉住你。"信誉+12。',
        effects: [
          { target: 'country_renown', op: 'add', value: 12 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12 },
      },
      {
        text: '当众加刑，夷其党羽',
        textPlain: '【铁腕清剿】公开重刑，连根带党一起清算，震慑百官。军力+10、民心-4。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_morale', op: 'add', value: -4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12 },
      },
    ],
    defaultTimeoutDays: 12,
  },
  {
    id: 'evt_s_ch3_wang',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 3' }],
    contexts: [
      {
        condition: 'default',
        title: '不容善意的例外',
        desc: '狱卒之子王端，二十年阅尽千份贪墨案卷，悟出一理："无人生来该杀；仁心未丧时，已开邪门。"他请立一台专司核查，直对你言："制度要绑住天下人，就不能不绑住陛下。"',
        descPlain: '一个把上千贪案看穿的人发现：倒下的官没一个一开始就坏。他要建个谁都管得着的核查机构，还当面说——规矩要绑住所有人，就不能不绑住你这个皇帝。你准不准？',
      },
      {
        condition: 'story_power_axis > 30',
        title: '不容善意的例外（连你也绑）',
        desc: '你立的规矩已传遍朝野："无人例外。"王端捧来核查之制的草案，最刺人的一条赫然在首：此制亦及君上。满殿屏息，只待你一句话。',
        descPlain: '你定的规矩早就说了"谁都不例外"。如今草案第一条就是"连皇帝也归它管"，满朝都在看你点不点头。',
      },
    ],
    choices: [
      {
        text: '准立鉴台，朕亦受其绑',
        textPlain: '【先绑住自己】立独立核查之台（取"鉴"为记），直对天下人公议负责，连君上也不例外。信誉+15、研究+10%。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 20 },
      },
      {
        text: '留君上余地，此制不及朕身',
        textPlain: '【网开一面】核查可设，但君上不在其列，免得自缚手脚。军力+8。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -15 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  {
    id: 'evt_s_ch3_last_drink',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 3' }],
    contexts: [{
      condition: 'default',
      title: '一壶烧刀子',
      desc: '裴绍围宅那夜，马援朝没有反抗，坐在中堂等他，两人喝了一顿烧刀子。「你也是苦出身，怎么走到这一步？」「记别人的仇太容易，记自己的——太难。」',
      descPlain: '老将马援朝没跑没反抗，摆了一桌酒等裴绍来抓。两个老兄弟喝最后一顿——你要裴绍怎么收这个场？',
    }],
    choices: [
      {
        text: '听他把话说完，再按律收押',
        textPlain: '【把账问明白】让他把十二年怎么一步步走错的说清楚，记下来做天下的镜子，然后照章办。信誉+10、民心+6。',
        effects: [
          { target: 'country_renown', op: 'add', value: 10 },
          { target: 'country_morale', op: 'add', value: 6 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12 },
      },
      {
        text: '不必多言，就地收押，免生枝节',
        textPlain: '【雷厉风行】这种人多说无益，直接押走，防他串供生变。军力+8、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
      },
    ],
    defaultTimeoutDays: 12,
  },
  {
    id: 'evt_s_ch3_mirror',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 3' }],
    contexts: [{
      condition: 'default',
      title: '以人为镜',
      desc: '马援朝案结。有人谏言密办，保住朝廷体面；亦有人言：当把阵亡将士名册与克扣账册并刊天下，让所有人看看，钱是从谁的抚恤里抠出来的。',
      descPlain: '贪案查完了。是悄悄办掉保住面子，还是把「阵亡将士名册」和「贪污账本」印在一起发往全国，让天下人都看见？',
    }],
    choices: [
      {
        text: '并刊天下，只题一字——鉴',
        textPlain: '【阳光照账本】名册和账册印在一起发全国，封面只写一个字《鉴》，让后来者照照自己。信誉+15、民心+8。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_morale', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15 },
      },
      {
        text: '密存档案，内部通报，勿摇民心',
        textPlain: '【家丑不外扬】只发各衙门内部通报，对外按下不表。军力+6、民心-2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 6 },
          { target: 'country_morale', op: 'add', value: -2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
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

  {
    id: 'evt_s_ch4_smith',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 4' }],
    contexts: [{
      condition: 'default',
      title: '炸了七回的炉',
      desc: '铁匠赵铁锤造以水火自动之器，三年炸炉七回，一次削去左手三指。坊间讥其耗费靡费、奇技淫巧；徒弟亦哭劝勿再。他举起缠绷带的残手："蒸汽比手劲大，装上轮子，天下人就再不用使死力气了。"',
      descPlain: '一个铁匠在试造蒸汽机，三年炸了七回，炸掉三根手指还要干。有人骂他白花朝廷的银子、尽搞些没用的奇巧。你支持，还是叫停？',
    }],
    choices: [
      {
        text: '倾力护其试炉，续拨料工',
        textPlain: '【护住种子】顶住非议，给料给人让他接着试——这东西成了，天下人就省一辈子死力气。研究+10%、信誉+8。',
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
          { target: 'country_renown', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: 15 },
      },
      {
        text: '斥为奇技淫巧，封场停工',
        textPlain: '【先顾眼前】耗钱又危险，封了工场把钱省下来稳妥。钱+3。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: -15 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch4_spy',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 4' }],
    contexts: [{
      condition: 'default',
      title: '种子与粮仓',
      desc: '掌关键之术的匠人被北人策反，借"共享"之名外泄图纸。赵铁锤追捕中又伤一目，醒来抚眼罩道："技术不是粮仓，是种子，须撒出去——但撒往何处，天下人得商量着来。"',
      descPlain: '有匠人被敌国收买、借"共享"的名义偷传图纸。赵铁锤追贼又瞎了一只眼。技术到底该怎么管——锁死，还是放开但定好规矩？',
    }],
    choices: [
      {
        text: '立公议，定技术外授之界',
        textPlain: '【种子要撒，但商量着撒】技术归公、人人可用，但传到哪儿、传给谁，由天下人公议定规。研究+12%、信誉+10。',
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.12 },
          { target: 'country_renown', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: 20, power: 12 },
      },
      {
        text: '严锁技术，军工独占',
        textPlain: '【锁进粮仓】关键技术一律封禁，只供官营军工，绝不外流。军力+10、钱+3。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: -20, power: -10 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  {
    id: 'evt_s_ch4_rail',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 4' }],
    contexts: [{
      condition: 'default',
      title: '会跑的车',
      desc: '蒸汽机车已成。首趟公开货运，从矿场到城邑，万人围观，车鸣一响，天下震动。有人惊惧：此物一出，夫役尽可歇矣，将生大变。',
      descPlain: '蒸汽机车造出来了，第一次公开拉货，万人围观。有人害怕：这铁家伙要是遍地都是，靠力气吃饭的人怎么办？',
    }],
    choices: [
      {
        text: '令机车行于官道，广开货运，教民习之',
        textPlain: '【把死力气省下来】推广机车货运，让更多人把力气的活儿交给机器，人去做更值当的事。研究+10%、信誉+10。',
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
          { target: 'country_renown', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: 15 },
      },
      {
        text: '暂限军用，缓行于市',
        textPlain: '【怕变天】先只给军队运粮运械，民间缓一缓，稳住夫役生计。军力+8、钱+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_gold_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: -12 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch4_frontier',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 4' }],
    contexts: [{
      condition: 'default',
      title: '北境抢矿',
      desc: '北方朔方汗国探得我技术渐强，屡犯边矿——不攻城不占地，只抢矿石、绑工匠。边军请战，亦有言：当建一支会修路架桥的工兵营，把边地种成铁打的江山。',
      descPlain: '北方敌人不抢地，专抢矿石和抓工匠。是增兵死守，还是建一支「既会修路架桥、又能护矿」的新工兵队伍？',
    }],
    choices: [
      {
        text: '组建新式工兵营——修路筑闸，屯垦守矿',
        textPlain: '【把边地种活】抽精锐组工兵营，能修路、能架桥、能屯田，把矿区变成守得住的产业。研究+10%、军力+6。',
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
          { target: 'country_military_power', op: 'add', value: 6 },
        ],
        removeEffects: [],
        storyAxisDelta: { production: 12 },
      },
      {
        text: '增派戍卒，死守矿脉',
        textPlain: '【严防死守】多派兵、多修工事，把矿看死。军力+12、钱-1。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 12 },
          { target: 'country_gold_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -8 },
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

  {
    id: 'evt_s_ch5_gu',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 5' }],
    contexts: [{
      condition: 'default',
      title: '守塔三日',
      desc: '世家子弃产外放，于博多湾建三方共管之灯塔。海寇围攻三日，倭人守塔者以最后一壶水让他。塔成而人亡，塔基刻八字：此灯之炬，天下人之目。',
      descPlain: '一个抛弃家产、远赴海外的官员，在海岛上跟邻邦渔民一起建灯塔。海盗围攻三天，他战死了，临终在塔基刻下"此灯之炬，天下人之目"。这盏灯，要怎么定性？',
    }],
    choices: [
      {
        text: '旌其志，灯塔归公，与各邦共守',
        textPlain: '【共守的光】把灯塔链定为各邦共有、平等守望，不归一国一姓。信誉+15、外交+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_diplomacy_weight', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12, production: 12 },
      },
      {
        text: '厚葬抚恤，撤使止损',
        textPlain: '【止损为先】重恤其家、撤回使团，不在险地空耗。军力+8、钱+3。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12, production: -10 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch5_ruan',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 5' }],
    contexts: [{
      condition: 'default',
      title: '异乡的稻穗',
      desc: '农技援外的阮小七在暹罗教人种稻，一去八年，死于田头。墓碑刻两种文字，汉文一行：粒粒皆辛苦。王端低语："陛下说的天下人，如今不只是大梁了。"',
      descPlain: '一个去外国教人种水稻的农技员，干了八年死在田里，外国人只叫他"老师"。这样的援外，还要不要继续派？',
    }],
    choices: [
      {
        text: '续派援队，薪火不绝',
        textPlain: '【天下人不只大梁】接着往外派农技队，把稻种和法子传到更远的地方。信誉+12、粮产+3。',
        effects: [
          { target: 'country_renown', op: 'add', value: 12 },
          { target: 'country_grain_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 10, production: 12 },
      },
      {
        text: '召队归国，固守本土',
        textPlain: '【先顾自家】把人召回来，先把本国的事办好，不为外人耗人命。军力+6、钱+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 6 },
          { target: 'country_gold_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10, production: -8 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  {
    id: 'evt_s_ch5_cabinet',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 5' }],
    contexts: [{
      condition: 'default',
      title: '偏殿一顿饭',
      desc: '五位辅政首次齐聚，不在朝堂，在偏殿一顿粗茶淡饭。无人称万岁，彼此以名相称，议的是灯塔选址、工匠纠纷、学员去留。礼官皱眉：君不君，臣不臣。',
      descPlain: '五个核心帮手第一次凑齐，没开朝会，就在小偏殿吃顿家常饭、直呼其名谈正事。管礼仪的人看不过去了——要不要立回规矩？',
    }],
    choices: [
      {
        text: '就这么坐——议事不议礼，务实在先',
        textPlain: '【先把事办了】名字怎么叫不重要，把灯塔、工匠、学员的事议透才要紧。信誉+10、外交+8。',
        effects: [
          { target: 'country_renown', op: 'add', value: 10 },
          { target: 'country_diplomacy_weight', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15 },
      },
      {
        text: '重立君臣之礼，尊卑有序',
        textPlain: '【规矩不能乱】议事可以，但礼数是纲，该跪的跪、该称的称。军力+6、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 6 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch5_watcher',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 5' }],
    contexts: [{
      condition: 'default',
      title: '少一笔的字',
      desc: '北端海岬的倭人守塔者不写汉文，却把灯塔八言用毛笔歪歪扭扭摹在底座——有一字少了一笔。有臣请遣师以正其文；亦有言：心意既通，何拘笔划。',
      descPlain: '邻国的守塔人不会写汉字，却照猫画虎把灯塔上的八个字摹了下来，有一个字少写了一笔。要不要派人去纠正？',
    }],
    choices: [
      {
        text: '不必纠笔——灯是众人共守的光，非我之赐',
        textPlain: '【少一笔也没关系】字少一笔，心意不差；这灯不是谁的恩赐，是大家一起守的光。外交+12、信誉+10。',
        effects: [
          { target: 'country_diplomacy_weight', op: 'add', value: 12 },
          { target: 'country_renown', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 12, production: 10 },
      },
      {
        text: '遣师正字，昭我文教',
        textPlain: '【正本清源】派先生去把字写对，顺便传我文字教化，扬我国威。军力+6、外交+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 6 },
          { target: 'country_diplomacy_weight', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
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

  {
    id: 'evt_s_ch6_shen',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 6' }],
    contexts: [{
      condition: 'default',
      title: '从我沈逸尘起',
      desc: '制度奠基之臣沈逸尘，众请其终身在位。他当众回绝："革了世家的命、革了富户的命，最后一刀，不敢革自己的命？代表轮换，我第一个，从我沈逸尘起。"',
      descPlain: '最有威望的老臣沈逸尘，本可终身任职。他却带头说：连任不能没个头，我第一个退、第一个轮换。你准不准这条规矩？',
    }],
    choices: [
      {
        text: '准其首倡，立代表轮换之制',
        textPlain: '【谁也不能是铁帽子】定下：公议代表连任有限、到期轮换，从最有功的人开始。信誉+18、研究+10%。',
        effects: [
          { target: 'country_renown', op: 'add', value: 18 },
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 25 },
      },
      {
        text: '留任元勋，以稳为重',
        textPlain: '【老成持重】这等栋梁岂能轻去，挽留续任，求个稳当。军力+8、民心+4。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 4 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -20 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch6_yifa',
    tags: ['故事'],
    triggers: [
      { condition: 'story_chapter == 6' },
    ],
    contexts: [
      {
        condition: 'default',
        title: '议席把头',
        desc: '公议行之既久，竟生出久据议席之人——熟谙议程、把持言路、彼此输利。一耕者起身陈情，话未半即被斥令噤声。你取一柄锄头，搁在议案之上，满堂遂静。',
        descPlain: '议事开久了，出了一批老占着代表位的人：熟门熟路、把着话语权、互相分好处。一个种地的刚开口就被喝止。你把一柄锄头放到议桌上——这局面，要不要动？',
      },
      {
        condition: 'story_power_axis > 40',
        title: '议席把头（众望催逼）',
        desc: '还政于民已成大势，乡野代表联名上书，请破"议席把头"、还言路于耕者匠人。万目睽睽，只待你裁断。',
        descPlain: '还权已是大势，乡里代表联名上书，要求打破那帮把持议席的人。大家都看着你怎么定。',
      },
    ],
    choices: [
      {
        text: '立耕者匠人直谏之权，破其把持',
        textPlain: '【言路还给耕匠】给种地的、做工的直接陈情提案的权，打散把持议席的小圈子。信誉+12、民心+8。',
        effects: [
          { target: 'country_renown', op: 'add', value: 12 },
          { target: 'country_morale', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15, production: 12 },
      },
      {
        text: '倚重熟手，维持议效',
        textPlain: '【讲究效率】这些人熟门熟路，办事快，先靠着他们维持运转。钱+3。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12, production: -8 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  {
    id: 'evt_s_ch6_sickbed',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 6' }],
    contexts: [{
      condition: 'default',
      title: '病中一问',
      desc: '任期之争最烈时，你两度病倒。周昭仪自南赶来，日夜守榻。你问：「朕是不是做错了？」她答：「您让出来的是权力，他们舍不得的也是权力。人和人争的从来都是同一个东西——只是有人用它压别人，有人用它扶别人。」',
      descPlain: '让权之争最激烈的时候你病倒了。身边人劝：这事是不是做错了？有人却说——你让出去的是权力，他们不肯放的也是权力。你怎么办？',
    }],
    choices: [
      {
        text: '继续让——权力是用来扶人的，不是压人的',
        textPlain: '【让到底】既已看清权力是怎么回事，就更不能让它在手里多留一天。民心+10、信誉+12。',
        effects: [
          { target: 'country_morale', op: 'add', value: 10 },
          { target: 'country_renown', op: 'add', value: 12 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15 },
      },
      {
        text: '缓一缓——权力先稳在手里，待人心定再让',
        textPlain: '【以稳为先】让权可以，但不能急，等局面稳了再说。军力+8、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -10 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch6_title',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 6' }],
    contexts: [{
      condition: 'default',
      title: '从天子到书记官',
      desc: '任期之制既立，只差称谓。礼部拟了十来个尊号，你一个没看，只说：以后叫我公议书记。满殿愕然，唯沈逸尘点头。',
      descPlain: '任期限制都定了，最后差个称呼。礼部拟了一堆尊号，你却让所有人以后直呼你「公议书记」。这称呼，改还是不改？',
    }],
    choices: [
      {
        text: '改称公议书记——与众人同为议席上写字的手',
        textPlain: '【手和人一样多，才叫公议】不要尊号，自称公议书记，跟所有人一样只是议事的一员。信誉+15、民心+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_morale', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 25 },
      },
      {
        text: '保留尊号，以安人心',
        textPlain: '【名分是纲】制度可以变，天子的名分不能去，留着才能稳住人心。军力+8、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -15 },
      },
    ],
    defaultTimeoutDays: 14,
  },

  // ============ 七 · 归根（归去：个人退场，制度向前） ============
  {
    id: 'evt_s_ch7_debate',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 7' }],
    contexts: [{
      condition: 'default',
      title: '七日七夜',
      desc: '战和大计交付公议，大会议了七日七夜，几近吵翻。有人主战到底，有人主和不割地。终须立个章法：这一仗打不打、怎么打、打赢了之后怎么办。',
      descPlain: '仗要不要打交给了大会。会上吵了七天七夜没结论。你得出面立规矩——这一仗的底线是什么？',
    }],
    choices: [
      {
        text: '立约：不割地、不赔款、所取之地归当地人民',
        textPlain: '【打是为了不打】打得赢就守，打不赢就谈；不打不平等之约，打下的地归当地人民自决。信誉+15、民心+8。',
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'country_morale', op: 'add', value: 8 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 15, production: 12 },
      },
      {
        text: '授统帅全权，便宜行事，以胜为先',
        textPlain: '【兵贵神速】议来议去误战机，把全权交给前线，打赢了再说。军力+15、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 15 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -12 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch7_charter',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 7' }],
    contexts: [{
      condition: 'default',
      title: '定稿之册',
      desc: '《天下人公约》定稿在即。撰稿之人问：此册一经颁行，是否即为万世之法？你翻着那本夹满批注的册子，笔悬在扉页上。',
      descPlain: '那本写满大白话的《天下人公约》要定稿了。有人问：是不是从今往后一个字都不能改？',
    }],
    choices: [
      {
        text: '每一条都注明来处与修订之次——仍待后人续改',
        textPlain: '【制度是临时的，人才是长久的】每一条都写下「经过多少次公议实践修订、仍待后人完善」，制度要跟着人往前走。信誉+18、民心+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 18 },
          { target: 'country_morale', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 20, production: 10 },
      },
      {
        text: '立为万世之法，一字不易',
        textPlain: '【定死了才稳】规矩定死不能改，江山才能万万年。军力+8、民心+2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -15, production: -8 },
      },
    ],
    defaultTimeoutDays: 14,
  },
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
  {
    id: 'evt_s_ch7_stele',
    tags: ['故事'],
    triggers: [{ condition: 'story_chapter == 7' }],
    contexts: [{
      condition: 'default',
      title: '不立功勋的碑',
      desc: '老将裴绍年逾六旬，亲赴前线。新附之地本有共耕之俗，他不强推分田，只立一碑：此地人民，自古与天地共生；外人不得夺占，内人不得买卖；公约自定，天下共守。阵亡者亦不立个人之功，只留一行——事迹由当地人自记。',
      descPlain: '打下的新地方本来就有自己的共耕老规矩。老将裴绍不硬塞你的分田法，只立块碑保护当地人自己说了算；连战死的将士也不立功劳碑，只写"事迹由当地人自己记"。你认不认这块碑？',
    }],
    choices: [
      {
        text: '依其碑，护当地自决，不立个人之功',
        textPlain: '【连分田都不强加】只护人民自决的权，不夺不买；境外不立功勋碑。信誉+18、外交+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 18 },
          { target: 'country_diplomacy_weight', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 20, production: 20 },
      },
      {
        text: '设官分治，立威纪功',
        textPlain: '【纳入治理】派官治理新地、立碑纪功，把威信和秩序一并立起来。军力+12、钱+3。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 12 },
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -15, production: -12 },
      },
    ],
    defaultTimeoutDays: 14,
  },
  {
    id: 'evt_s_ch7_throne',
    tags: ['故事', '抉择'],
    triggers: [{ condition: 'story_chapter == 7' }],
    contexts: [
      {
        condition: 'default',
        title: '空椅与一本书',
        desc: '你已老。最后一次走上大殿，不着衮服，只穿与众人一样的灰蓝罩袍。手中是一本翻得起毛、夹满批注的白话册子——《天下人公约》。放，还是不放？',
        descPlain: '你老了，最后一次上朝，不穿龙袍，只穿和大家一样的工作罩袍，手里是一本写满大白话、改了又改的册子。这把龙椅，撤掉，还是传给子孙？',
      },
      {
        condition: 'story_power_axis > 40',
        title: '空椅与一本书（众皆同袍）',
        desc: '殿上众人皆着同色罩袍而立，无人称万岁。还政已成大势，只待你把那本《天下人公约》放在榻上，转身离去。',
        descPlain: '满殿的人都穿着和你一样的罩袍站着，没人喊万岁。该来的都来了，就差你把那本册子放下、转身走开。',
      },
    ],
    choices: [
      {
        text: '撤去龙椅，只留一册于榻',
        textPlain: '【永远撤掉那把椅子】不是换个人坐上去，而是把椅子撤了，只在原处留一本写满白话、注明"仍待后人续改"的册子。信誉+20、民心+10。',
        effects: [
          { target: 'country_renown', op: 'add', value: 20 },
          { target: 'country_morale', op: 'add', value: 10 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: 30, production: 15 },
      },
      {
        text: '传之子孙，守此家业',
        textPlain: '【守成传家】终究没舍得放手，把这江山与规矩，传给同姓后人守着。军力+10、钱+3；龙椅犹在。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
        storyAxisDelta: { power: -25 },
      },
    ],
    defaultTimeoutDays: 14,
  },
];
