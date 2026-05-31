import type { CourtEvent } from './schema';

/**
 * v0.7 朝议事件。Part 1 给 2 个代表（负面 / 抉择），
 * Part 2 扩到 30+ 按 3:3:2:2 分布（正/负/中/抉择）。
 */
export const EVENTS: CourtEvent[] = [
  {
    id: 'evt_locust',
    tags: ['负'],
    triggers: [
      { condition: 'random', value: 0.15 },
      { condition: 'season == summer' },
    ],
    contexts: [
      {
        condition: 'default',
        title: '飞蝗蔽天',
        desc: '蝗虫过境，禾苗尽噬，仓廪告急。',
        descPlain: '夏季蝗灾，所有农田产量 -50%，持续两季。',
      },
    ],
  },
  {
    id: 'evt_emissary',
    tags: ['抉择'],
    triggers: [{ condition: 'country_morale > 60' }, { condition: 'year >= 5' }],
    contexts: [
      {
        condition: 'default',
        title: '邻邦遣使',
        desc: '齐使持璧来朝，欲求互通有无。',
        descPlain: '齐国使者带礼品来访，可结盟也可拒绝。',
      },
    ],
    choices: [
      {
        text: '设宴款待，缔交盟好',
        textPlain: '答应结盟。',
        effects: [
          { target: 'country_diplomacy_weight', op: 'add', value: 10 },
          { target: 'country_gold_output', op: 'add', value: 2 },
        ],
        removeEffects: [],
      },
      {
        text: '婉言辞之，避其锋芒',
        textPlain: '拒绝。',
        effects: [{ target: 'country_morale', op: 'add', value: 3 }],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 7,
  },

  // ===== J-3 v0.8：6 个双向决策事件（为君之道 vs 为民之道）=====
  // 设计原则：每个事件双 choice，一向"为君之道"（military/morale 短期收益）、
  // 一向"为民之道"（renown/diplomacy 长期收益），不分善恶简单二选一

  {
    id: 'evt_drought_grain',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.10 }, { condition: 'season == summer' }],
    contexts: [
      {
        condition: 'default',
        title: '旱魃肆虐',
        desc: '夏旱连月，民有饥色，群臣议赈。',
        descPlain: '夏季旱灾，民情焦灼。',
      },
    ],
    choices: [
      {
        text: '开仓放粮，与民共渡',
        textPlain: '【为民之道】开国库放粮 30，民心 +6 信誉 +5。',
        effects: [
          { target: 'country_morale', op: 'add', value: 6 },
          { target: 'country_renown', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
      {
        text: '严刑峻法，禁民私贾',
        textPlain: '【为君之道】禁市稳价，军力 +3，民心 -3。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 3 },
          { target: 'country_morale', op: 'add', value: -3 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_river_flood',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.08 }, { condition: 'season == autumn' }],
    contexts: [
      {
        condition: 'default',
        title: '河决泛滥',
        desc: '秋雨连旬，河水暴涨，沿岸告急。',
        descPlain: '秋季水患，需立即决断。',
      },
    ],
    choices: [
      {
        text: '征发民夫，筑堤束水',
        textPlain: '【为君之道】强征徭役筑堤，军威 +5 民心 -4。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 5 },
          { target: 'country_morale', op: 'add', value: -4 },
        ],
        removeEffects: [],
      },
      {
        text: '开渠导流，疏而非堵',
        textPlain: '【为民之道】兴水利疏河道，粮产 +5%、信誉 +6。',
        effects: [
          { target: 'country_grain_output', op: 'mul', value: 1.05 },
          { target: 'country_renown', op: 'add', value: 6 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 6,
  },
  {
    id: 'evt_neighbor_starve',
    tags: ['抉择'],
    triggers: [{ condition: 'random', value: 0.06 }, { condition: 'year >= 2' }],
    contexts: [
      {
        condition: 'default',
        title: '弱邻告饥',
        desc: '邻邦遭灾，民不聊生，使者跪求援助。',
        descPlain: '小邻国饥荒，遣使求援。',
      },
    ],
    choices: [
      {
        text: '封锁边境，严防流民',
        textPlain: '【为君之道】闭关自守，军力 +7、民心 +2，但外交 -3。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 7 },
          { target: 'country_morale', op: 'add', value: 2 },
          { target: 'country_diplomacy_weight', op: 'add', value: -3 },
        ],
        removeEffects: [],
      },
      {
        text: '济粮互市，怀柔远人',
        textPlain: '【为民之道】援助粮 20，信誉 +8、外交 +6，但民心 -2（民怨自家粮济他邦）。',
        effects: [
          { target: 'country_renown', op: 'add', value: 8 },
          { target: 'country_diplomacy_weight', op: 'add', value: 6 },
          { target: 'country_morale', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 8,
  },
  {
    id: 'evt_old_scholar',
    tags: ['抉择', '正'],
    triggers: [{ condition: 'random', value: 0.05 }, { condition: 'country_morale > 50' }],
    contexts: [
      {
        condition: 'default',
        title: '老儒来献',
        desc: '一白发老儒携简牍来朝，自陈先王之道。',
        descPlain: '老学者带古籍求见。',
      },
    ],
    choices: [
      {
        text: '设席讲经，礼之以师',
        textPlain: '【为民之道】尊师重道，研究 +10%、信誉 +4。',
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.1 },
          { target: 'country_renown', op: 'add', value: 4 },
        ],
        removeEffects: [],
      },
      {
        text: '辞之以礼，敬而远之',
        textPlain: '【为君之道】速决归政，军力 +3、民心 +1。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 3 },
          { target: 'country_morale', op: 'add', value: 1 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 7,
  },
  {
    id: 'evt_bandit_raid',
    tags: ['抉择', '负'],
    triggers: [{ condition: 'random', value: 0.10 }, { condition: 'country_military_power < 12' }],
    contexts: [
      {
        condition: 'default',
        title: '盗贼出没',
        desc: '山泽间贼匪渐起，劫掠商旅，扰我边氓。',
        descPlain: '盗匪侵扰边境。',
      },
    ],
    choices: [
      {
        text: '出兵围剿，斩首示众',
        textPlain: '【为君之道】军讨速决，军力 +10、民心 -2。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_morale', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
      {
        text: '招抚为农，编入保甲',
        textPlain: '【为民之道】抚而非剿，信誉 +5、农阶层增长 +5%、但军力 -2（贼归民则少兵）。',
        effects: [
          { target: 'country_renown', op: 'add', value: 5 },
          { target: 'population_class_growth_nong', op: 'mul', value: 1.05 },
          { target: 'country_military_power', op: 'add', value: -2 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 5,
  },
  {
    id: 'evt_artisan_offer',
    tags: ['抉择', '正'],
    triggers: [{ condition: 'random', value: 0.07 }, { condition: 'year >= 1' }],
    contexts: [
      {
        condition: 'default',
        title: '工师献艺',
        desc: '失意工匠自荐于市，愿献其制器之术。',
        descPlain: '工匠求职献艺。',
      },
    ],
    choices: [
      {
        text: '召入官署，专造军器',
        textPlain: '【为君之道】专攻兵器，军力 +8、铜产 +1，但布产 -1。',
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_bronze_output', op: 'add', value: 1 },
          { target: 'country_cloth_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
      },
      {
        text: '编入工坊，分授民间',
        textPlain: '【为民之道】民间普及，木 +2、布 +1、信誉 +3，但铜产 -1（无人专攻军器）。',
        effects: [
          { target: 'country_wood_output', op: 'add', value: 2 },
          { target: 'country_cloth_output', op: 'add', value: 1 },
          { target: 'country_renown', op: 'add', value: 3 },
          { target: 'country_bronze_output', op: 'add', value: -1 },
        ],
        removeEffects: [],
      },
    ],
    defaultTimeoutDays: 6,
  },
];
