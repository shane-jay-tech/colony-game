import type { RoyalDecree, StoryAxisDelta } from './schema';

/**
 * v1.0 #2：朝堂政令扩展。
 *
 * 设计原则（参考钢铁雄心 / 维多利亚 III 的 "Decisions" + 国策树）：
 *   - **广**：从 3 → 12 条，覆盖五大族（内政 / 军事 / 外交 / 礼制 / 工坊）
 *   - **深**：用 chainPrev 串成 2-3 条递进链，前一条完成才解锁后一条
 *   - **每条 2 阶段**，第一阶给即时收益（add）+ 资源前期成本，第二阶给倍率放大（mul）+ 重资源成本
 *
 * 链路示意（→ 表示 chainPrev 关系）：
 *   军事链： 徵役令 → 整军经武 → 武备称霸
 *   外交链： 通使邻邦 → 会盟立信
 *   礼制链： 铸鼎告民（短快）｜ 立碑于市 → 修典礼乐（长深）
 *   内政链： 劝农桑 → 屯田积谷
 *   工坊链： 通工易事 →（独立 decree, 无链）
 *
 * 没有链的 decree（独立可选）：通使邻邦的 prereq 已是建筑解锁，工坊单条独立。
 */
export const DECREES: RoyalDecree[] = [
  // ============ 军事链 ============================================
  {
    id: 'decree_conscript',
    name: '徵役令',
    category: '军事',
    description: '广征徭役，以备征伐。',
    descPlain: '【军事·一】征召民众扩军，2 阶段。短期军力 +8，再加 +20% 倍率。',
    unlockCondition: [{ type: 'country_population', value: 50 }],
    stages: [
      {
        order: 1,
        cost: { gold: 50 },
        days: 10,
        effects: [{ target: 'country_military_power', op: 'add', value: 8 }],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 80, people: 20 },
        days: 15,
        effects: [{ target: 'country_military_power', op: 'mul', value: 1.2 }],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_train_levy',
    name: '整军经武',
    category: '军事',
    description: '简练士卒，演武于庠。',
    descPlain: '【军事·二】徵役令完成后开放：操练既有兵员，军力 +10，士气 +5。',
    unlockCondition: [{ type: 'country_population', value: 80 }],
    chainPrev: 'decree_conscript',
    stages: [
      {
        order: 1,
        cost: { gold: 60, bronze: 4 },
        days: 12,
        effects: [
          { target: 'country_military_power', op: 'add', value: 10 },
          { target: 'country_morale', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 90, bronze: 8, people: 10 },
        days: 18,
        effects: [
          { target: 'country_military_power', op: 'mul', value: 1.15 },
          { target: 'country_morale', op: 'mul', value: 1.10 },
        ],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_hegemony',
    name: '武备称霸',
    category: '军事',
    description: '陈兵列鼎，号令诸邦。',
    descPlain: '【军事·三】整军经武完成后开放：终极军备线，军力 +20% 永久 mul，外交分量 +5。',
    unlockCondition: [{ type: 'country_population', value: 120 }],
    chainPrev: 'decree_train_levy',
    stages: [
      {
        order: 1,
        cost: { gold: 120, bronze: 15, rite: 4 },
        days: 16,
        effects: [
          { target: 'country_military_power', op: 'add', value: 15 },
          { target: 'country_diplomacy_weight', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 180, bronze: 25, rite: 8, people: 20 },
        days: 22,
        effects: [
          { target: 'country_military_power', op: 'mul', value: 1.20 },
          { target: 'country_diplomacy_weight', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
    ],
  },

  // ============ 外交链 ============================================
  {
    id: 'decree_envoy_mission',
    name: '通使邻邦',
    category: '外交',
    description: '使节往来，币帛相聘。',
    descPlain: '【外交·一】派遣使节出访，外交分量 +4，信誉 +6。',
    unlockCondition: [{ type: 'country_population', value: 40 }],
    stages: [
      {
        order: 1,
        cost: { gold: 40, cloth: 6 },
        days: 8,
        effects: [
          { target: 'country_diplomacy_weight', op: 'add', value: 4 },
          { target: 'country_renown', op: 'add', value: 6 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 60, cloth: 10, rite: 2 },
        days: 12,
        effects: [
          { target: 'country_diplomacy_weight', op: 'mul', value: 1.20 },
          { target: 'event_positive_probability', op: 'add', value: 0.05 },
        ],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_alliance_oath',
    name: '会盟立信',
    category: '外交',
    description: '歃血为盟，永结邻好。',
    descPlain: '【外交·二】通使邻邦完成后开放：盟誓加深，信誉 +15，正面事件概率 +8%。',
    unlockCondition: [{ type: 'country_population', value: 80 }],
    chainPrev: 'decree_envoy_mission',
    stages: [
      {
        order: 1,
        cost: { gold: 80, cloth: 15, rite: 4 },
        days: 14,
        effects: [
          { target: 'country_renown', op: 'add', value: 15 },
          { target: 'event_positive_probability', op: 'add', value: 0.08 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 100, rite: 8, bronze: 6 },
        days: 18,
        effects: [
          { target: 'country_renown', op: 'mul', value: 1.20 },
          { target: 'country_diplomacy_weight', op: 'add', value: 5 },
        ],
        removeEffects: [],
      },
    ],
  },

  // ============ 礼制：双线（铸鼎短快线 / 立碑→修典礼乐 长深线）======
  {
    id: 'decree_cast_ding',
    name: '铸鼎告民',
    category: '礼制',
    description: '熔铜铸鼎，以彰王命。',
    descPlain: '【礼制·短快】铜铸大鼎告示，2 阶段（熔范 5 日 / 铭文 8 日）。终极给军力 +10% 永久 mul（霸路放大器）。',
    unlockCondition: [{ type: 'country_population', value: 30 }],
    stages: [
      {
        order: 1,
        cost: { bronze: 8, rite: 2 },
        days: 5,
        effects: [
          { target: 'country_morale', op: 'add', value: 5 },
          { target: 'country_diplomacy_weight', op: 'add', value: 2 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { bronze: 12, gold: 30, rite: 4 },
        days: 8,
        effects: [
          { target: 'country_military_power', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 5 },
          { target: 'country_military_power', op: 'mul', value: 1.10 },
          { target: 'country_diplomacy_weight', op: 'add', value: 3 },
        ],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_stele_market',
    name: '立碑于市',
    category: '礼制',
    description: '勒石市井，使民共见。',
    descPlain: '【礼制·长深一】石碑立于市集让全民共见，2 阶段（凿石 8 日 / 刻铭 14 日）。解锁石碑场建筑。',
    unlockCondition: [{ type: 'country_population', value: 25 }],
    stages: [
      {
        order: 1,
        cost: { stone: 30, people: 4 },
        days: 8,
        effects: [
          { target: 'country_renown', op: 'add', value: 8 },
          { target: 'country_morale', op: 'add', value: 2 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { stone: 25, rite: 5, people: 6 },
        days: 14,
        effects: [
          { target: 'country_renown', op: 'add', value: 12 },
          { target: 'population_happiness', op: 'add', value: 4 },
          { target: 'population_class_growth_nong', op: 'mul', value: 1.1 },
        ],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_compile_rites',
    name: '修典礼乐',
    category: '礼制',
    description: '编次旧章，以兴王化。',
    descPlain: '【礼制·长深二】立碑于市完成后开放：编修典籍，研究 +12% 永久 mul，民心 +6。',
    unlockCondition: [{ type: 'country_population', value: 60 }],
    chainPrev: 'decree_stele_market',
    stages: [
      {
        order: 1,
        cost: { gold: 50, cloth: 10, rite: 6 },
        days: 14,
        effects: [
          { target: 'country_research_speed', op: 'add', value: 0.05 },
          { target: 'population_happiness', op: 'add', value: 6 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 80, cloth: 15, rite: 12 },
        days: 20,
        effects: [
          { target: 'country_research_speed', op: 'mul', value: 1.12 },
          { target: 'population_class_growth_shi', op: 'mul', value: 1.15 },
        ],
        removeEffects: [],
      },
    ],
  },

  // ============ 内政链 ============================================
  {
    id: 'decree_promote_agri',
    name: '劝农桑',
    category: '内政',
    description: '务本之教，男耕女织。',
    descPlain: '【内政·一】下劝农令，粮产 +8% 永久 mul，桑农阶层成长加速。',
    unlockCondition: [{ type: 'country_population', value: 30 }],
    stages: [
      {
        order: 1,
        cost: { gold: 30, grain: 20 },
        days: 8,
        effects: [
          { target: 'country_grain_output', op: 'mul', value: 1.05 },
          { target: 'population_class_growth_nong', op: 'add', value: 0.05 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 50, cloth: 8 },
        days: 12,
        effects: [
          { target: 'country_grain_output', op: 'mul', value: 1.08 },
          { target: 'country_cloth_output', op: 'mul', value: 1.10 },
        ],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_tuntian',
    name: '屯田积谷',
    category: '内政',
    description: '广开屯田，备凶年之患。',
    descPlain: '【内政·二】劝农桑完成后开放：边地屯田，粮再 +12% mul，人口上限 +20。',
    unlockCondition: [{ type: 'country_population', value: 70 }],
    chainPrev: 'decree_promote_agri',
    stages: [
      {
        order: 1,
        cost: { gold: 60, wood: 30, people: 10 },
        days: 14,
        effects: [
          { target: 'country_grain_output', op: 'add', value: 6 },
          { target: 'country_population_cap', op: 'add', value: 12 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 90, stone: 20, people: 15 },
        days: 20,
        effects: [
          { target: 'country_grain_output', op: 'mul', value: 1.12 },
          { target: 'country_population_cap', op: 'add', value: 8 },
        ],
        removeEffects: [],
      },
    ],
  },

  // ============ 工坊链 ============================================
  {
    id: 'decree_workshop_levy',
    name: '通工易事',
    category: '工坊',
    description: '调工易役，百器并兴。',
    descPlain: '【工坊·一】调拨工匠，木石铜布同时 +6% mul；建造速度 +10%。',
    unlockCondition: [{ type: 'country_population', value: 50 }],
    stages: [
      {
        order: 1,
        cost: { gold: 40, wood: 15, stone: 15 },
        days: 10,
        effects: [
          { target: 'country_wood_output', op: 'mul', value: 1.06 },
          { target: 'country_stone_output', op: 'mul', value: 1.06 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 70, bronze: 6, cloth: 8 },
        days: 14,
        effects: [
          { target: 'country_bronze_output', op: 'mul', value: 1.10 },
          { target: 'country_cloth_output', op: 'mul', value: 1.06 },
          { target: 'building_construction_speed', op: 'mul', value: 1.10 },
        ],
        removeEffects: [],
      },
    ],
  },
  {
    id: 'decree_hundred_crafts',
    name: '百工兴市',
    category: '工坊',
    description: '兴市集，百工归之，货殖以兴。',
    descPlain: '【工坊·二】通工易事完成后开放：百工聚集市集，铜布产 +12% mul，市集类建筑加成 +8%。',
    unlockCondition: [{ type: 'country_population', value: 90 }],
    chainPrev: 'decree_workshop_levy',
    stages: [
      {
        order: 1,
        cost: { gold: 80, bronze: 8, cloth: 12 },
        days: 14,
        effects: [
          { target: 'country_bronze_output', op: 'add', value: 4 },
          { target: 'country_cloth_output', op: 'add', value: 4 },
          { target: 'country_renown', op: 'add', value: 4 },
        ],
        removeEffects: [],
      },
      {
        order: 2,
        cost: { gold: 120, bronze: 14, rite: 4 },
        days: 18,
        effects: [
          { target: 'country_bronze_output', op: 'mul', value: 1.12 },
          { target: 'country_cloth_output', op: 'mul', value: 1.12 },
          { target: 'building_output_area', op: 'mul', value: 1.08 },
        ],
        removeEffects: [],
      },
    ],
  },
];

// 意识形态双轴（2026-06-20）：朝令同样推"封建→三主义"漂移。语义同 POLICY_AXIS。仅故事模式生效。
const DECREE_AXIS: Record<string, StoryAxisDelta> = {
  decree_conscript: { power: -4 },                  // 徵役令：集权
  decree_train_levy: { power: -3 },                 // 整军经武：集权
  decree_hegemony: { power: -4 },                   // 武备称霸：集权
  decree_alliance_oath: { power: 3 },               // 会盟立信：还权/多极
  decree_cast_ding: { power: 5, production: 3 },     // 铸鼎告民：公开法度→还权+公
  decree_stele_market: { power: 4 },                // 立碑于市：公开法→还权
  decree_compile_rites: { power: -3 },              // 修典礼乐：集权正统
  decree_promote_agri: { production: 2 },           // 劝农桑：轻公
  decree_tuntian: { power: -1, production: 5 },      // 屯田积谷：轻集权+公（国营集体耕作）
  decree_workshop_levy: { power: 1, production: -3 }, // 通工易事：松动专营→轻还权+私有
  decree_hundred_crafts: { power: 2, production: -5 }, // 百工兴市：货天下
  // decree_envoy_mission（通使邻邦）：中立，不推轴
};
for (const d of DECREES) {
  const a = DECREE_AXIS[d.id];
  if (a) d.storyAxisDelta = a;
}
