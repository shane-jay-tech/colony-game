/**
 * B-5 事件系统扩展：B级（模板化2选项）+ C级（氛围自动结算）。
 * A级8个已在events.ts（需再补2个到10），这里加 B级20 + C级10 = 30个。
 * 分类覆盖：经济12 / 外交8 / 内政8 / 军事6 / 奇事6
 */

import type { CourtEvent } from './schema';

// ====================== A-level supplements (2 to reach 10 total) ============

export const A_LEVEL_EXTRA: CourtEvent[] = [
  // --- 8 新增 A 级事件（补 B-5 roadmap 要求的丰富度） ---
  {
    id: 'evt_a_flood_relief',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.07 }, { condition: 'season == summer' }],
    contexts: [{
      condition: 'default',
      title: '洪水泛滥',
      desc: '夏汛来势迅猛，河堤告急，低田尽没。',
      descPlain: '发大水了，庄稼被淹。',
    }],
    choices: [
      {
        text: '征民筑堤，力保良田',
        textPlain: '全力修堤坝。',
        effects: [
          { target: 'country_morale', op: 'add', value: -3 },
          { target: 'country_grain_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
      },
      {
        text: '弃低田、迁民于高处',
        textPlain: '放弃低洼区搬到高处。',
        effects: [
          { target: 'country_grain_output', op: 'add', value: -3 },
          { target: 'country_morale', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
      {
        text: '求邻邦开闸分洪',
        textPlain: '请邻国帮忙泄洪。',
        effects: [
          { target: 'country_diplomacy_weight', op: 'add', value: -10 },
          { target: 'country_grain_output', op: 'add', value: 1 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_a_foreign_envoy',
    tags: ['抉择', '正'],
    triggers: [{ condition: 'random', value: 0.07 }, { condition: 'grade >= 3' }],
    contexts: [{
      condition: 'default',
      title: '远邦来使',
      desc: '不曾交往的远方邦国派使求见，献珍宝求通好。',
      descPlain: '远方国家派人来想交朋友。',
    }],
    choices: [
      {
        text: '大礼接待，开放通商',
        textPlain: '隆重接待，开始贸易。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 3 },
          { target: 'country_renown', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
      {
        text: '收礼不回，保持距离',
        textPlain: '收下礼物但保持距离。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 1 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
      },
      {
        text: '扣使索赎，以示国威',
        textPlain: '扣留使者勒索赎金。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 5 },
          { target: 'country_renown', op: 'add', value: -8 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 7,
  },
  {
    id: 'evt_a_rebel_leader',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'grade >= 2' }],
    contexts: [{
      condition: 'default',
      title: '民变首领',
      desc: '边邑流民拥立首领，聚众数百抗税不从。',
      descPlain: '有人聚众造反了。',
    }],
    choices: [
      {
        text: '遣兵围剿，以儆效尤',
        textPlain: '武力镇压。',
        effects: [
          { target: 'country_morale', op: 'add', value: -5 },
          { target: 'country_renown', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
      {
        text: '招安抚慰，编入户籍',
        textPlain: '招安他们。',
        effects: [
          { target: 'country_population_growth', op: 'add', value: 3 },
          { target: 'country_gold_output', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
      {
        text: '任其自散，不予理会',
        textPlain: '不管他。',
        effects: [
          { target: 'country_morale', op: 'add', value: -2 },
          { target: 'country_renown', op: 'add', value: -3 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 6,
  },
  {
    id: 'evt_a_iron_technique',
    tags: ['抉择', '正'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'grade >= 3' }],
    contexts: [{
      condition: 'default',
      title: '铸铁新法',
      desc: '匠人献上新法冶铁之术，产量可倍，然需重金建炉。',
      descPlain: '发明了新的炼铁方法。',
    }],
    choices: [
      {
        text: '大兴铁炉，普及新法',
        textPlain: '花钱推广新技术。',
        effects: [
          { target: 'country_bronze_output', op: 'add', value: 4 },
          { target: 'country_gold_output', op: 'add', value: -3 },
        ],
        removeEffects: [],
      },
      {
        text: '先在官坊试行',
        textPlain: '小规模试验。',
        effects: [
          { target: 'country_bronze_output', op: 'add', value: 2 },
          { target: 'country_gold_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
      },
      {
        text: '封存新法，恐民间私铸',
        textPlain: '担心民间私铸武器，封锁技术。',
        effects: [
          { target: 'country_morale', op: 'add', value: -3 },
          { target: 'country_renown', op: 'add', value: 2 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 7,
  },
  {
    id: 'evt_a_heir_dispute',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.05 }, { condition: 'grade >= 4' }],
    contexts: [{
      condition: 'default',
      title: '嫡庶之争',
      desc: '嫡长子仁厚少断，庶子英武有谋。朝臣各有拥戴。',
      descPlain: '两个儿子争继承权，大臣们站队了。',
    }],
    choices: [
      {
        text: '立嫡以正纲常',
        textPlain: '按传统立长子。',
        effects: [
          { target: 'country_morale', op: 'add', value: 3 },
          { target: 'country_renown', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
      {
        text: '废嫡立贤，以强国本',
        textPlain: '选更有能力的庶子。',
        effects: [
          { target: 'country_morale', op: 'add', value: -5 },
          { target: 'country_gold_output', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
      {
        text: '暂不表态，令二子竞功',
        textPlain: '让他们竞争，先不决定。',
        effects: [
          { target: 'country_renown', op: 'add', value: -2 },
          { target: 'country_morale', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 10,
  },
  {
    id: 'evt_a_drought_prayer',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'season == summer' }],
    contexts: [{
      condition: 'default',
      title: '旱灾祈雨',
      desc: '连月无雨，禾苗枯萎。巫祝请主祭天祈雨。',
      descPlain: '大旱，有人建议祈雨。',
    }],
    choices: [
      {
        text: '大张旗鼓祭天求雨',
        textPlain: '办隆重的祈雨仪式。',
        effects: [
          { target: 'country_morale', op: 'add', value: 5 },
          { target: 'country_gold_output', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
      {
        text: '挖渠引远水灌田',
        textPlain: '务实修水利。',
        effects: [
          { target: 'country_grain_output', op: 'add', value: 2 },
          { target: 'country_morale', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
      {
        text: '减免当季赋税安民',
        textPlain: '免税让百姓缓口气。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: -3 },
          { target: 'country_morale', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_a_scholar_sect',
    tags: ['抉择', '正'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'grade >= 3' }],
    contexts: [{
      condition: 'default',
      title: '学派论争',
      desc: '法家与儒家学者在邑中公开论辩，各执一词。',
      descPlain: '两派学者公开辩论。',
    }],
    choices: [
      {
        text: '扶法抑儒，以刑治国',
        textPlain: '支持法家。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: 2 },
          { target: 'country_morale', op: 'add', value: -3 },
        ],
        removeEffects: [],
      },
      {
        text: '崇儒黜法，以礼化人',
        textPlain: '支持儒家。',
        effects: [
          { target: 'country_morale', op: 'add', value: 5 },
          { target: 'country_gold_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
      },
      {
        text: '兼容并蓄，不偏不党',
        textPlain: '两边都不偏袒。',
        effects: [
          { target: 'country_renown', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 7,
  },
  {
    id: 'evt_a_general_defect',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.05 }, { condition: 'grade >= 3' }],
    contexts: [{
      condition: 'default',
      title: '将领叛投',
      desc: '前线大将携兵投敌，边防空虚。朝堂震动。',
      descPlain: '将军带兵投奔敌国了。',
    }],
    choices: [
      {
        text: '急调禁卫补防',
        textPlain: '调近卫军补上缺口。',
        effects: [
          { target: 'country_morale', op: 'add', value: -3 },
          { target: 'country_renown', op: 'add', value: -5 },
        ],
        removeEffects: [],
      },
      {
        text: '遣使劝归，许以厚赏',
        textPlain: '派人去劝他回来。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: -4 },
          { target: 'country_diplomacy_weight', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
      {
        text: '悬赏其首，以正军法',
        textPlain: '悬赏通缉叛将。',
        effects: [
          { target: 'country_morale', op: 'add', value: 3 },
          { target: 'country_diplomacy_weight', op: 'add', value: -8 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 5,
  },
  // --- 原有 2 个 A 级补充 ---
  {
    id: 'evt_bronze_vein',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'grade >= 3' }],
    contexts: [{
      condition: 'default',
      title: '铜矿新脉',
      desc: '山民来报，北麓发现新铜矿脉，开采还是封禁？',
      descPlain: '发现新铜矿，可开采增产，但耗民力。',
    }],
    choices: [
      {
        text: '发民采铜，充实国库',
        textPlain: '开采铜矿。',
        effects: [
          { target: 'country_bronze_output', op: 'add', value: 4 },
          { target: 'country_morale', op: 'add', value: -5 },
        ],
        removeEffects: [],
      },
      {
        text: '封山养林，留待后用',
        textPlain: '暂不开采。',
        effects: [
          { target: 'country_renown', op: 'add', value: 5 },
          { target: 'country_wood_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
      },
      {
        text: '与邻邦共采，分利而交好',
        textPlain: '共享铜矿。',
        effects: [
          { target: 'country_bronze_output', op: 'add', value: 2 },
          { target: 'country_diplomacy_weight', op: 'add', value: 10 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 7,
  },
  {
    id: 'evt_plague_cattle',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.10 }, { condition: 'season == spring' }],
    contexts: [{
      condition: 'default',
      title: '牛疫',
      desc: '春耕之际牛群染疫，田间缺畜力，当如何？',
      descPlain: '牛瘟爆发，农业受影响。',
    }],
    choices: [
      {
        text: '尽杀病牛，以绝蔓延',
        textPlain: '宰杀病牛止损。',
        effects: [
          { target: 'country_grain_output', op: 'add', value: -3 },
          { target: 'country_morale', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
      {
        text: '隔栏医治，赌其自愈',
        textPlain: '尝试治疗。',
        effects: [
          { target: 'country_gold_output', op: 'add', value: -2 },
          { target: 'country_grain_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
      },
      {
        text: '向邻邦借牛，以布帛偿',
        textPlain: '借牛应急。',
        effects: [
          { target: 'country_cloth_output', op: 'add', value: -2 },
          { target: 'country_grain_output', op: 'add', value: 1 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 5,
  },
];

// ====================== B-level events (20): 2 choices, template-based ========

export const B_LEVEL_EVENTS: CourtEvent[] = [
  // --- 经济 (7) ---
  {
    id: 'evt_b_harvest_bumper',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.12 }, { condition: 'season == autumn' }],
    contexts: [{ condition: 'default', title: '丰年', desc: '五谷丰登，仓廪充盈。', descPlain: '秋收大丰。' }],
    choices: [
      { text: '开仓济民', textPlain: '分粮给百姓。', effects: [{ target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
      { text: '增储备战', textPlain: '囤粮备战。', effects: [{ target: 'country_grain_output', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_merchant_caravan',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.10 }],
    contexts: [{ condition: 'default', title: '商队过境', desc: '远方商队途经此地，愿留货交易。', descPlain: '商队来了。' }],
    choices: [
      { text: '重税通行', textPlain: '收过路税。', effects: [{ target: 'country_gold_output', op: 'add', value: 3 }], removeEffects: [] },
      { text: '免税结好', textPlain: '免费通行赢好名声。', effects: [{ target: 'country_renown', op: 'add', value: 3 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 4,
  },
  {
    id: 'evt_b_mine_collapse',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.08 }],
    contexts: [{ condition: 'default', title: '矿坑塌方', desc: '石料场坍塌，死伤数人。', descPlain: '矿难事故。' }],
    choices: [
      { text: '抚恤家属', textPlain: '花钱安抚。', effects: [{ target: 'country_gold_output', op: 'add', value: -2 }, { target: 'country_morale', op: 'add', value: 3 }], removeEffects: [] },
      { text: '加固复工', textPlain: '赶紧修好继续干。', effects: [{ target: 'country_stone_output', op: 'add', value: 1 }, { target: 'country_morale', op: 'add', value: -2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 4,
  },
  {
    id: 'evt_b_silk_demand',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.10 }, { condition: 'grade >= 2' }],
    contexts: [{ condition: 'default', title: '绢帛热销', desc: '四方争购本邦绢帛。', descPlain: '布匹卖得好。' }],
    choices: [
      { text: '加紧织造', textPlain: '多织布卖钱。', effects: [{ target: 'country_cloth_output', op: 'add', value: 2 }], removeEffects: [] },
      { text: '限量提价', textPlain: '限量涨价赚更多金。', effects: [{ target: 'country_gold_output', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_granary_fire',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.07 }],
    contexts: [{ condition: 'default', title: '粮仓失火', desc: '天干物燥，仓中粮草被引燃。', descPlain: '粮仓着火了。' }],
    choices: [
      { text: '全力救火', textPlain: '组织人手扑灭。', effects: [{ target: 'country_grain_output', op: 'add', value: -2 }], removeEffects: [] },
      { text: '弃仓保人', textPlain: '放弃粮仓避免伤亡。', effects: [{ target: 'country_grain_output', op: 'add', value: -4 }, { target: 'country_morale', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 3,
  },
  {
    id: 'evt_b_tax_dispute',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.09 }, { condition: 'grade >= 2' }],
    contexts: [{ condition: 'default', title: '征税争议', desc: '民间对今年赋税多有怨言。', descPlain: '百姓抱怨税重。' }],
    choices: [
      { text: '减税安民', textPlain: '降税。', effects: [{ target: 'country_gold_output', op: 'add', value: -2 }, { target: 'country_morale', op: 'add', value: 5 }], removeEffects: [] },
      { text: '维持原制', textPlain: '不改。', effects: [{ target: 'country_morale', op: 'add', value: -3 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_trade_route',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'grade >= 3' }],
    contexts: [{ condition: 'default', title: '新商路开通', desc: '探路者发现通往远方的捷径。', descPlain: '发现新商路。' }],
    choices: [
      { text: '修路通商', textPlain: '修路。', effects: [{ target: 'country_gold_output', op: 'add', value: 3 }, { target: 'country_wood_output', op: 'add', value: -1 }], removeEffects: [] },
      { text: '设关卡收费', textPlain: '设关收税。', effects: [{ target: 'country_gold_output', op: 'add', value: 2 }, { target: 'country_renown', op: 'add', value: -2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },

  // --- 外交 (5) ---
  {
    id: 'evt_b_refugee_influx',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.09 }],
    contexts: [{ condition: 'default', title: '流民涌入', desc: '邻邦战乱，流民来投。', descPlain: '难民想来我们这。' }],
    choices: [
      { text: '开城接纳', textPlain: '收留。', effects: [{ target: 'country_population_growth', op: 'add', value: 5 }, { target: 'country_grain_output', op: 'add', value: -2 }], removeEffects: [] },
      { text: '紧闭城门', textPlain: '拒绝。', effects: [{ target: 'country_renown', op: 'add', value: -3 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 4,
  },
  {
    id: 'evt_b_tribute_demand',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'grade >= 2' }],
    contexts: [{ condition: 'default', title: '邻邦索贡', desc: '强邻遣使索要岁贡。', descPlain: '邻国要我们进贡。' }],
    choices: [
      { text: '断然拒绝', textPlain: '拒绝。', effects: [{ target: 'country_morale', op: 'add', value: 5 }, { target: 'country_diplomacy_weight', op: 'add', value: -10 }], removeEffects: [] },
      { text: '忍辱纳贡', textPlain: '给钱求安。', effects: [{ target: 'country_gold_output', op: 'add', value: -3 }, { target: 'country_morale', op: 'add', value: -5 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_border_skirmish',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.10 }],
    contexts: [{ condition: 'default', title: '边境冲突', desc: '边民与邻邦牧民因水源起争端。', descPlain: '边境小冲突。' }],
    choices: [
      { text: '调兵镇压', textPlain: '武力解决。', effects: [{ target: 'country_morale', op: 'add', value: 2 }, { target: 'country_diplomacy_weight', op: 'add', value: -5 }], removeEffects: [] },
      { text: '遣使调停', textPlain: '外交解决。', effects: [{ target: 'country_gold_output', op: 'add', value: -1 }, { target: 'country_diplomacy_weight', op: 'add', value: 5 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_hostage_exchange',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'grade >= 3' }],
    contexts: [{ condition: 'default', title: '质子互换', desc: '邻邦提议互换宗室子弟为质，以示信约。', descPlain: '交换人质表示诚意。' }],
    choices: [
      { text: '送质结好', textPlain: '同意。', effects: [{ target: 'country_diplomacy_weight', op: 'add', value: 15 }], removeEffects: [] },
      { text: '婉言谢绝', textPlain: '拒绝。', effects: [{ target: 'country_morale', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 6,
  },
  {
    id: 'evt_b_spy_caught',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.07 }, { condition: 'grade >= 2' }],
    contexts: [{ condition: 'default', title: '捉获细作', desc: '巡夜卫士拿获邻邦密探。', descPlain: '抓到间谍了。' }],
    choices: [
      { text: '严刑审讯', textPlain: '审他。', effects: [{ target: 'country_morale', op: 'add', value: 3 }, { target: 'country_diplomacy_weight', op: 'add', value: -5 }], removeEffects: [] },
      { text: '遣返示好', textPlain: '放了他。', effects: [{ target: 'country_diplomacy_weight', op: 'add', value: 5 }, { target: 'country_renown', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 4,
  },

  // --- 内政 (4) ---
  {
    id: 'evt_b_talent_exam',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'grade >= 3' }],
    contexts: [{ condition: 'default', title: '野有遗贤', desc: '有乡间才俊毛遂自荐，请求为官。', descPlain: '有人才出现。' }],
    choices: [
      { text: '破格录用', textPlain: '直接录用。', effects: [{ target: 'country_renown', op: 'add', value: 3 }, { target: 'country_gold_output', op: 'add', value: 1 }], removeEffects: [] },
      { text: '循制考察', textPlain: '按规矩来。', effects: [{ target: 'country_morale', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_festival',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.10 }, { condition: 'season == spring' }],
    contexts: [{ condition: 'default', title: '春祭大典', desc: '百姓请举行春祭以祈丰年。', descPlain: '举行祭祀活动。' }],
    choices: [
      { text: '盛大操办', textPlain: '大办。', effects: [{ target: 'country_morale', op: 'add', value: 8 }, { target: 'country_gold_output', op: 'add', value: -2 }], removeEffects: [] },
      { text: '简礼薄祭', textPlain: '简单办。', effects: [{ target: 'country_morale', op: 'add', value: 3 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_road_repair',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.08 }],
    contexts: [{ condition: 'default', title: '官道失修', desc: '道路破败，商旅绕行。', descPlain: '路坏了。' }],
    choices: [
      { text: '征民修路', textPlain: '征役修路。', effects: [{ target: 'country_gold_output', op: 'add', value: 2 }, { target: 'country_morale', op: 'add', value: -3 }], removeEffects: [] },
      { text: '放任不管', textPlain: '不修。', effects: [{ target: 'country_gold_output', op: 'add', value: -1 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_b_corruption',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.07 }, { condition: 'grade >= 3' }],
    contexts: [{ condition: 'default', title: '贪墨案', desc: '有司贪渎，库银短少。', descPlain: '官员贪污了。' }],
    choices: [
      { text: '严刑处置', textPlain: '严办。', effects: [{ target: 'country_morale', op: 'add', value: 5 }, { target: 'country_renown', op: 'add', value: 2 }], removeEffects: [] },
      { text: '令其补齐', textPlain: '罚款了事。', effects: [{ target: 'country_gold_output', op: 'add', value: 2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },

  // --- 军事 (2) ---
  {
    id: 'evt_b_deserters',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.08 }],
    contexts: [{ condition: 'default', title: '士卒逃亡', desc: '营中有卒夜遁山林。', descPlain: '有士兵逃跑了。' }],
    choices: [
      { text: '追捕严惩', textPlain: '抓回来惩罚。', effects: [{ target: 'country_morale', op: 'add', value: -2 }], removeEffects: [] },
      { text: '赦免召回', textPlain: '赦免他们。', effects: [{ target: 'country_morale', op: 'add', value: 3 }, { target: 'country_renown', op: 'add', value: -2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 4,
  },
  {
    id: 'evt_b_weapon_cache',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'grade >= 2' }],
    contexts: [{ condition: 'default', title: '古兵器出土', desc: '修路挖出前朝兵器库。', descPlain: '挖到一批古代武器。' }],
    choices: [
      { text: '收编军用', textPlain: '拿来用。', effects: [{ target: 'country_bronze_output', op: 'add', value: 2 }], removeEffects: [] },
      { text: '献于太庙', textPlain: '供在庙里。', effects: [{ target: 'country_renown', op: 'add', value: 5 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 5,
  },

  // --- 奇事 (2) ---
  {
    id: 'evt_b_eclipse',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.05 }],
    contexts: [{ condition: 'default', title: '日食', desc: '天狗食日，民心惶惶。', descPlain: '日食了，百姓害怕。' }],
    choices: [
      { text: '设坛禳灾', textPlain: '做法事安抚。', effects: [{ target: 'country_morale', op: 'add', value: 5 }, { target: 'country_gold_output', op: 'add', value: -1 }], removeEffects: [] },
      { text: '告谕天象', textPlain: '解释这是自然现象。', effects: [{ target: 'country_renown', op: 'add', value: 3 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 3,
  },
  {
    id: 'evt_b_strange_beast',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.05 }],
    contexts: [{ condition: 'default', title: '异兽出没', desc: '山间有人目睹奇异大兽。', descPlain: '有人看到怪兽。' }],
    choices: [
      { text: '组队围猎', textPlain: '去捉。', effects: [{ target: 'country_morale', op: 'add', value: 5 }, { target: 'country_renown', op: 'add', value: 3 }], removeEffects: [] },
      { text: '敬而远之', textPlain: '别管它。', effects: [{ target: 'country_morale', op: 'add', value: -2 }], removeEffects: [] },
    ],
    defaultTimeoutDays: 4,
  },
];

// ====================== C-level events (10): no choices, auto-resolve =========

export const C_LEVEL_EVENTS: CourtEvent[] = [
  {
    id: 'evt_c_good_weather',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.12 }, { condition: 'season == spring' }],
    contexts: [{ condition: 'default', title: '风调雨顺', desc: '今春气候宜人，禾苗茁壮。', descPlain: '好天气。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_minor_quake',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.05 }],
    contexts: [{ condition: 'default', title: '轻微地动', desc: '地面微颤，有屋瓦坠落，幸无伤亡。', descPlain: '小地震。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_auspicious_cloud',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.06 }],
    contexts: [{ condition: 'default', title: '瑞云呈祥', desc: '五彩祥云现于天际，民皆以为吉兆。', descPlain: '出现彩云。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_wolf_sighting',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.07 }, { condition: 'season == winter' }],
    contexts: [{ condition: 'default', title: '狼迹', desc: '冬日猎户报有狼群近邑，牧民有失。', descPlain: '发现狼群。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_folk_song',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.08 }],
    contexts: [{ condition: 'default', title: '民歌传唱', desc: '田间新歌传唱我主贤德。', descPlain: '百姓唱歌夸你。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_well_dried',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'season == summer' }],
    contexts: [{ condition: 'default', title: '井涸', desc: '东坊三口井见底，民取水需远行。', descPlain: '水井干了。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_baby_boom',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'season == autumn' }],
    contexts: [{ condition: 'default', title: '添丁之喜', desc: '今秋多产，村中添丁甚众。', descPlain: '出生率增高。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_shooting_star',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.04 }],
    contexts: [{ condition: 'default', title: '流星划夜', desc: '深夜长星划过，老者言此乃变革之兆。', descPlain: '看到流星。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_heavy_snow',
    tags: ['负'],
    triggers: [{ condition: 'random', value: 0.10 }, { condition: 'season == winter' }],
    contexts: [{ condition: 'default', title: '大雪封路', desc: '暴雪连日，道路不通，商旅断绝。', descPlain: '大雪封路了。' }],
    defaultTimeoutDays: 1,
  },
  {
    id: 'evt_c_wild_bloom',
    tags: ['正'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'season == spring' }],
    contexts: [{ condition: 'default', title: '野花遍野', desc: '春风一过，满山野花竞放。', descPlain: '春天花开了。' }],
    defaultTimeoutDays: 1,
  },
];

export const ALL_EXPANDED_EVENTS: CourtEvent[] = [...A_LEVEL_EXTRA, ...B_LEVEL_EVENTS, ...C_LEVEL_EVENTS];
