import type { PolicyNode, StoryAxisDelta } from './schema';

/**
 * v1.0 #1：国策深度（HOI4 树状递进）
 *
 * 设计原则（参考钢铁雄心 IV / 维多利亚 III 的 "Focus Tree"）：
 *   - **每个 branch 至少 3 层深度**：L1 入门 → L2 进阶 → L3 终极（保甲/工坊/农桑 走到 L4）
 *   - **关键节点二选一**（mutuallyExclusive）：玩家做出"重粮 / 重桑"、"商道 / 兵道" 这种路径分歧
 *   - **focus 子标签**标注亚路径，UI 用其分组显示同一分支下的两条岔路
 *   - 互斥规则：一旦采纳 A，所有列在 A.mutuallyExclusive 的兄弟（B、C…）永久锁死
 *
 * 布局坐标约定（2026-06-20 HOI4 化重排）：每个 branch = 一条竖直列（x 固定区间），
 * tier = 水平行（y：T1=100 / T2=230 / T3=360，自上而下递增），互斥/多根在同行左右并排。
 * 连线一律父在上、子在下（PolicyTreePanel 据此画向下折线）；互斥兄弟用红色横杠×连接。
 *
 * 分支结构（共 39 条；2026-06-20 扩至第四层；"双父分叉"而非单父）：
 *   农桑（8）：[重粮] iron_tool→deep_plow→grain_storage→常平仓 ；[重桑] silkworm→蚕政→loom_workshop→织锦院 ；grain_storage ⊕ loom_workshop 互斥
 *   工坊（9）：三根 market / metallurgy / water_works ；water_works→沟洫；metallurgy→iron_smelt ；[商道] market→mint→列肆 ⊕ [兵道] iron_smelt→iron_arms→武库
 *   礼制（4）：ancestor_rites → ritual_codex → imperial(王制) → 受命于天
 *   保甲（8）：lookout→边塞 ；conscript→militia→{chariot_corps→铁骑 ⊕ naval_corps→楼船}（共父分叉）
 *   外交（6）：post_road→朝贡 ；diplomacy→marriage_alliance→会盟称霸→合纵连横
 *   学问（4）：school → classics_compile → 稷下学宫 → 百家争鸣
 */
export const POLICIES: PolicyNode[] = [
  // ============== 农桑 branch（5 条，含 重粮 / 重桑 二选一）===============
  {
    id: 'pol_iron_tool',
    name: '铁农具推广',
    branch: '农桑',
    x: 70, y: 100,
    cost: { gold: 30, wood: 10 },
    effects: [{ target: 'country_grain_output', op: 'mul', value: 1.2 }],
    prerequisites: [],
    tier: 1,
    description: '冶铁为锄，岁稔有期。',
    descPlain: '【农桑·一】采纳后所有农田粮食产出 +20%。',
  },
  {
    id: 'pol_deep_plow',
    name: '深耕法',
    branch: '农桑',
    x: 70, y: 230,
    cost: { grain: 30, people: 2 },
    effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
    prerequisites: ['pol_iron_tool'],
    tier: 2,
    description: '深耕易耨，收成倍增。',
    descPlain: '【农桑·二】粮食产出再 +5（叠加在 +20% 之后）。',
  },
  {
    id: 'pol_silkworm',
    name: '育蚕',
    branch: '农桑',
    x: 230, y: 100,
    cost: { wood: 15, people: 3 },
    effects: [{ target: 'country_cloth_output', op: 'add', value: 2 }],
    prerequisites: [],
    tier: 1,
    description: '采桑育蚕，机杼有声。',
    descPlain: '【农桑·一】解锁"织官"建筑；布产出 +2。',
  },
  // —— 重粮 / 重桑 二选一岔路 —— //
  {
    id: 'pol_grain_storage',
    name: '仓储有制',
    branch: '农桑',
    x: 70, y: 360,
    cost: { stone: 30, wood: 20, people: 4 },
    effects: [
      { target: 'country_grain_output', op: 'mul', value: 1.15 },
      { target: 'country_population_cap', op: 'add', value: 15 },
    ],
    prerequisites: ['pol_deep_plow'],
    tier: 3,
    focus: '重粮',
    mutuallyExclusive: ['pol_loom_workshop'],
    description: '仓廪实则知礼节。',
    descPlain: '【农桑·三·重粮路】粮再 +15%、人口上限 +15。\n注：与"织室广设"互斥（已采纳后者则锁死本条）。',
  },
  {
    id: 'pol_loom_workshop',
    name: '织室广设',
    branch: '农桑',
    x: 230, y: 360,
    cost: { gold: 30, cloth: 8, people: 4 },
    effects: [
      { target: 'country_cloth_output', op: 'mul', value: 1.25 },
      { target: 'country_renown', op: 'add', value: 5 },
    ],
    prerequisites: ['pol_sericulture'],
    tier: 3,
    focus: '重桑',
    mutuallyExclusive: ['pol_grain_storage'],
    description: '织室既兴，缯帛充府。',
    descPlain: '【农桑·三·重桑路】布产 +25%、信誉 +5。\n注：与"仓储有制"互斥（重粮路采纳后锁死本条）。',
  },

  // ============== 工坊 branch（7 条，含 商道 / 兵道 二选一）===============
  {
    id: 'pol_market',
    name: '通市',
    branch: '工坊',
    x: 480, y: 100,
    cost: { wood: 20, gold: 10 },
    effects: [{ target: 'country_gold_output', op: 'add', value: 2 }],
    prerequisites: [],
    tier: 1,
    description: '设市于邦，货殖以兴。',
    descPlain: '【工坊·一】解锁市集（升级水井或陶窑可得）；钱产出 +2。',
  },
  {
    id: 'pol_metallurgy',
    name: '采铜',
    branch: '工坊',
    x: 640, y: 100,
    cost: { stone: 25, gold: 15 },
    effects: [{ target: 'country_bronze_output', op: 'add', value: 1 }],
    prerequisites: [],
    tier: 1,
    description: '凿山取铜，铸器有方。',
    descPlain: '【工坊·一】解锁"铜冶坊"建筑；铜产出 +1。',
  },
  {
    id: 'pol_water_works',
    name: '水利',
    branch: '工坊',
    x: 800, y: 100,
    cost: { wood: 25, stone: 25, people: 4 },
    effects: [{ target: 'country_grain_output', op: 'mul', value: 1.1 }],
    prerequisites: [],
    tier: 1,
    description: '导水溉田，岁稔无虞。',
    descPlain: '【工坊·一】解锁"水碓"建筑；全部粮产 +10%。',
  },
  {
    id: 'pol_iron_smelt',
    name: '冶铁',
    branch: '工坊',
    x: 640, y: 230,
    cost: { stone: 30, bronze: 5 },
    effects: [{ target: 'country_military_power', op: 'add', value: 5 }],
    prerequisites: ['pol_metallurgy'],
    tier: 2,
    description: '炼石为铁，国之利兵。',
    descPlain: '【工坊·二】解锁"冶铁坊"建筑；军力 +5。需先采纳"采铜"。',
  },
  // —— 商道 / 兵道 二选一岔路 —— //
  {
    id: 'pol_mint',
    name: '铸币流通',
    branch: '工坊',
    x: 480, y: 360,
    cost: { gold: 50, bronze: 8 },
    effects: [
      { target: 'country_gold_output', op: 'mul', value: 1.25 },
      { target: 'country_diplomacy_weight', op: 'add', value: 4 },
    ],
    prerequisites: ['pol_market'],
    tier: 3,
    focus: '商道',
    mutuallyExclusive: ['pol_iron_arms'],
    description: '范铜为币，市易无碍。',
    descPlain: '【工坊·三·商道】钱产 +25%、外交 +4。\n注：与"铁兵戎"互斥（兵道采纳后锁死本条）。',
  },
  {
    id: 'pol_iron_arms',
    name: '铁兵戎',
    branch: '工坊',
    x: 640, y: 360,
    cost: { bronze: 12, stone: 20 },
    effects: [
      { target: 'country_military_power', op: 'mul', value: 1.20 },
      { target: 'country_morale', op: 'add', value: 3 },
    ],
    prerequisites: ['pol_iron_smelt'],
    tier: 3,
    focus: '兵道',
    mutuallyExclusive: ['pol_mint'],
    description: '铸铁为戈，列阵以待。',
    descPlain: '【工坊·三·兵道】军力 +20%、士气 +3。\n注：与"铸币流通"互斥（商道采纳后锁死本条）。',
  },

  // ============== 礼制 branch（3 条，单一直线递进）========================
  {
    id: 'pol_ancestor_rites',
    name: '祭祖',
    branch: '礼制',
    x: 1010, y: 100,
    cost: { rite: 4, cloth: 4 },
    effects: [
      { target: 'country_morale', op: 'add', value: 4 },
      { target: 'country_renown', op: 'add', value: 2 },
    ],
    prerequisites: [],
    tier: 1,
    description: '春秋祭祀，宗庙有典。',
    descPlain: '【礼制·一】民心 +4、信誉 +2；为后续礼制立基。',
  },
  {
    id: 'pol_ritual_codex',
    name: '修礼经',
    branch: '礼制',
    x: 1010, y: 230,
    cost: { rite: 8, gold: 30 },
    effects: [
      { target: 'country_research_speed', op: 'mul', value: 1.10 },
      { target: 'population_class_growth_shi', op: 'mul', value: 1.10 },
    ],
    prerequisites: ['pol_ancestor_rites'],
    tier: 2,
    description: '编次旧章，士有所习。',
    descPlain: '【礼制·二】研究 +10%、士阶层成长 +10%。',
  },
  {
    id: 'pol_imperial',
    name: '王制',
    branch: '礼制',
    x: 1010, y: 360,
    cost: { rite: 12, bronze: 10, gold: 50 },
    effects: [
      { target: 'country_morale', op: 'add', value: 10 },
      { target: 'country_renown', op: 'mul', value: 1.20 },
    ],
    prerequisites: ['pol_ritual_codex'],
    tier: 3,
    description: '正名列仪，王城初成。',
    descPlain: '【礼制·三】解锁"王宫"建筑；民心 +10、信誉 +20% mul。',
  },

  // ============== 保甲 branch（5 条，含 车马 / 舟师 二选一）================
  {
    id: 'pol_lookout',
    name: '烽燧守望',
    branch: '保甲',
    x: 1240, y: 100,
    cost: { stone: 20, people: 5 },
    effects: [{ target: 'country_renown', op: 'add', value: 3 }],
    prerequisites: [],
    tier: 1,
    description: '燔燧达境，邻邦闻警。',
    descPlain: '【保甲·一】解锁"烽燧"建筑；信誉 +3。',
  },
  {
    id: 'pol_conscript',
    name: '征兵',
    branch: '保甲',
    x: 1400, y: 100,
    cost: { gold: 30, grain: 20 },
    effects: [{ target: 'country_military_power', op: 'add', value: 5 }],
    prerequisites: [],
    tier: 1,
    description: '编户为伍，备兵以时。',
    descPlain: '【保甲·一】解锁"兵营"建筑；军力 +5。',
  },
  {
    id: 'pol_militia',
    name: '民兵',
    branch: '保甲',
    x: 1400, y: 230,
    cost: { grain: 30, people: 6, bronze: 4 },
    effects: [
      { target: 'country_military_power', op: 'add', value: 8 },
      { target: 'population_happiness', op: 'add', value: 2 },
    ],
    prerequisites: ['pol_conscript'],
    tier: 2,
    description: '田则耕之，战则备之。',
    descPlain: '【保甲·二】民兵兼耕兼战，军力 +8、民心 +2。',
  },
  // —— 车马 / 舟师 二选一岔路 —— //
  {
    id: 'pol_chariot_corps',
    name: '车马军制',
    branch: '保甲',
    x: 1320, y: 360,
    cost: { wood: 30, bronze: 15, people: 8 },
    effects: [
      { target: 'country_military_power', op: 'mul', value: 1.25 },
      { target: 'country_diplomacy_weight', op: 'add', value: 4 },
    ],
    prerequisites: ['pol_militia'],
    tier: 3,
    focus: '车马',
    mutuallyExclusive: ['pol_naval_corps'],
    description: '驷马同辕，威震列邦。',
    descPlain: '【保甲·三·车马】军力 +25%、外交 +4。\n注：与"舟师之制"互斥（舟师采纳后锁死本条）。',
  },
  {
    id: 'pol_naval_corps',
    name: '舟师之制',
    branch: '保甲',
    x: 1480, y: 360,
    cost: { wood: 50, cloth: 12, people: 10 },
    effects: [
      { target: 'country_military_power', op: 'mul', value: 1.18 },
      { target: 'country_renown', op: 'add', value: 8 },
    ],
    prerequisites: ['pol_militia'],
    tier: 3,
    focus: '舟师',
    mutuallyExclusive: ['pol_chariot_corps'],
    description: '舟楫纵横，江汉无虞。',
    descPlain: '【保甲·三·舟师】军力 +18%、信誉 +8。\n注：与"车马军制"互斥（车马采纳后锁死本条）。',
  },

  // ============== 外交 branch（3 条）======================================
  {
    id: 'pol_post_road',
    name: '驿道开通',
    branch: '外交',
    x: 1700, y: 100,
    cost: { stone: 30, gold: 20 },
    effects: [{ target: 'country_diplomacy_weight', op: 'add', value: 5 }],
    prerequisites: [],
    tier: 1,
    description: '舆梁通衢，邦交无壅。',
    descPlain: '【外交·一】解锁"驿道"建筑；外交权重 +5。',
  },
  {
    id: 'pol_diplomacy',
    name: '邦交',
    branch: '外交',
    x: 1860, y: 100,
    cost: { gold: 40, cloth: 5 },
    effects: [
      { target: 'country_diplomacy_weight', op: 'add', value: 8 },
      { target: 'event_positive_probability', op: 'mul', value: 1.2 },
    ],
    prerequisites: [],
    tier: 1,
    description: '修睦诸侯，远人来归。',
    descPlain: '【外交·一】解锁"客馆"建筑；外交权重 +8、正面事件概率 +20%。',
  },
  {
    id: 'pol_marriage_alliance',
    name: '联姻通好',
    branch: '外交',
    x: 1860, y: 230,
    cost: { gold: 60, cloth: 12, rite: 4 },
    effects: [
      { target: 'country_diplomacy_weight', op: 'mul', value: 1.30 },
      { target: 'country_renown', op: 'add', value: 10 },
    ],
    prerequisites: ['pol_diplomacy'],
    tier: 2,
    description: '联姻列邦，亲好以延。',
    descPlain: '【外交·二】外交权重 +30% mul、信誉 +10。',
  },

  // ============== 学问 branch（2 条）======================================
  {
    id: 'pol_school',
    name: '兴学',
    branch: '学问',
    x: 2060, y: 100,
    cost: { cloth: 5, gold: 25 },
    effects: [{ target: 'country_research_speed', op: 'mul', value: 1.15 }],
    prerequisites: [],
    tier: 1,
    description: '设庠讲学，士习其礼。',
    descPlain: '【学问·一】解锁"学宫"建筑；研究速度 +15%。',
  },
  {
    id: 'pol_classics_compile',
    name: '编修六艺',
    branch: '学问',
    x: 2060, y: 230,
    cost: { rite: 6, gold: 40, cloth: 8 },
    effects: [
      { target: 'country_research_speed', op: 'mul', value: 1.20 },
      { target: 'population_class_growth_shi', op: 'mul', value: 1.15 },
      { target: 'country_renown', op: 'add', value: 6 },
    ],
    prerequisites: ['pol_school'],
    tier: 2,
    description: '编六艺以正风俗。',
    descPlain: '【学问·二】研究再 +20% mul、士阶层成长 +15%、信誉 +6。',
  },

  // ============================================================================
  // 2026-06-20 扩充（HOI4 复杂度）：每分支延伸至第四层 + 补中层，24→39 节点，填满树面。
  // 新节点皆为纯增益（不解锁建筑），自洽于本文件，无需改 buildings.ts。
  // ============================================================================

  // —— 农桑：重桑补 T2 + 双路 T4 capstone ——
  {
    id: 'pol_sericulture', name: '蚕政', branch: '农桑',
    x: 230, y: 230,
    cost: { wood: 20, people: 3 },
    effects: [{ target: 'country_cloth_output', op: 'add', value: 3 }],
    prerequisites: ['pol_silkworm'], tier: 2, focus: '重桑',
    description: '课蚕缫丝，机杼日繁。',
    descPlain: '【农桑·二·重桑】布产出 +3；为"织室广设"前置。',
  },
  {
    id: 'pol_ever_granary', name: '常平仓', branch: '农桑',
    x: 70, y: 490,
    cost: { stone: 60, gold: 60, people: 8 },
    effects: [
      { target: 'country_grain_output', op: 'mul', value: 1.20 },
      { target: 'country_population_cap', op: 'add', value: 25 },
    ],
    prerequisites: ['pol_grain_storage'], tier: 4, focus: '重粮',
    description: '丰籴歉粜，平准万民。',
    descPlain: '【农桑·四·重粮】粮再 +20%、人口上限 +25。重粮路终极。',
  },
  {
    id: 'pol_brocade', name: '织锦院', branch: '农桑',
    x: 230, y: 490,
    cost: { cloth: 30, gold: 50, people: 6 },
    effects: [
      { target: 'country_cloth_output', op: 'mul', value: 1.30 },
      { target: 'country_gold_output', op: 'add', value: 4 },
      { target: 'country_renown', op: 'add', value: 8 },
    ],
    prerequisites: ['pol_loom_workshop'], tier: 4, focus: '重桑',
    description: '织纹为锦，贡赋称美。',
    descPlain: '【农桑·四·重桑】布 +30%、钱 +4、信誉 +8。重桑路终极。',
  },

  // —— 工坊：水利补 T2 + 商道/兵道 T4 capstone ——
  {
    id: 'pol_irrigation', name: '沟洫', branch: '工坊',
    x: 800, y: 230,
    cost: { wood: 25, stone: 25, people: 5 },
    effects: [{ target: 'country_grain_output', op: 'mul', value: 1.12 }],
    prerequisites: ['pol_water_works'], tier: 2,
    description: '浚渠通沟，旱涝有备。',
    descPlain: '【工坊·二】全部粮产再 +12%。',
  },
  {
    id: 'pol_great_market', name: '列肆通衢', branch: '工坊',
    x: 480, y: 490,
    cost: { gold: 80, bronze: 10 },
    effects: [
      { target: 'country_gold_output', op: 'mul', value: 1.30 },
      { target: 'country_diplomacy_weight', op: 'add', value: 6 },
    ],
    prerequisites: ['pol_mint'], tier: 4, focus: '商道',
    description: '百货骈集，列肆万家。',
    descPlain: '【工坊·四·商道】钱 +30%、外交 +6。商道终极。',
  },
  {
    id: 'pol_armory', name: '武库', branch: '工坊',
    x: 640, y: 490,
    cost: { bronze: 30, stone: 40, people: 8 },
    effects: [
      { target: 'country_military_power', op: 'mul', value: 1.25 },
      { target: 'country_morale', op: 'add', value: 4 },
    ],
    prerequisites: ['pol_iron_arms'], tier: 4, focus: '兵道',
    description: '甲兵充库，战必有备。',
    descPlain: '【工坊·四·兵道】军力 +25%、士气 +4。兵道终极。',
  },

  // —— 礼制：T4 capstone ——
  {
    id: 'pol_mandate', name: '受命于天', branch: '礼制',
    x: 1010, y: 490,
    cost: { rite: 20, gold: 80, bronze: 15 },
    effects: [
      { target: 'country_renown', op: 'mul', value: 1.30 },
      { target: 'country_morale', op: 'add', value: 12 },
    ],
    prerequisites: ['pol_imperial'], tier: 4,
    description: '受天明命，以君万邦。',
    descPlain: '【礼制·四】信誉 +30% mul、民心 +12。礼制终极。',
  },

  // —— 保甲：烽燧补 T2 + 车马/舟师 T4 capstone ——
  {
    id: 'pol_border_forts', name: '边塞屯戍', branch: '保甲',
    x: 1240, y: 230,
    cost: { stone: 30, people: 6 },
    effects: [
      { target: 'country_military_power', op: 'add', value: 6 },
      { target: 'country_renown', op: 'add', value: 3 },
    ],
    prerequisites: ['pol_lookout'], tier: 2,
    description: '列戍边陲，烽堠相望。',
    descPlain: '【保甲·二】军力 +6、信誉 +3。',
  },
  {
    id: 'pol_iron_cavalry', name: '铁骑', branch: '保甲',
    x: 1320, y: 490,
    cost: { bronze: 40, wood: 40, people: 10 },
    effects: [
      { target: 'country_military_power', op: 'mul', value: 1.30 },
      { target: 'country_diplomacy_weight', op: 'add', value: 5 },
    ],
    prerequisites: ['pol_chariot_corps'], tier: 4, focus: '车马',
    description: '甲骑具装，奔冲无前。',
    descPlain: '【保甲·四·车马】军力 +30%、外交 +5。车马终极。',
  },
  {
    id: 'pol_grand_fleet', name: '楼船军', branch: '保甲',
    x: 1480, y: 490,
    cost: { wood: 80, cloth: 20, people: 12 },
    effects: [
      { target: 'country_military_power', op: 'mul', value: 1.25 },
      { target: 'country_renown', op: 'add', value: 10 },
    ],
    prerequisites: ['pol_naval_corps'], tier: 4, focus: '舟师',
    description: '楼船蔽江，威加四海。',
    descPlain: '【保甲·四·舟师】军力 +25%、信誉 +10。舟师终极。',
  },

  // —— 外交：驿道补 T2 + T3 + T4 ——
  {
    id: 'pol_tribute', name: '朝贡之制', branch: '外交',
    x: 1700, y: 230,
    cost: { gold: 30, rite: 4 },
    effects: [
      { target: 'country_gold_output', op: 'add', value: 3 },
      { target: 'country_diplomacy_weight', op: 'add', value: 5 },
    ],
    prerequisites: ['pol_post_road'], tier: 2,
    description: '万邦来贡，玉帛盈庭。',
    descPlain: '【外交·二】钱 +3、外交权重 +5。',
  },
  {
    id: 'pol_hegemon', name: '会盟称霸', branch: '外交',
    x: 1860, y: 360,
    cost: { gold: 70, rite: 8, cloth: 10 },
    effects: [
      { target: 'country_diplomacy_weight', op: 'mul', value: 1.30 },
      { target: 'country_renown', op: 'add', value: 12 },
    ],
    prerequisites: ['pol_marriage_alliance'], tier: 3,
    description: '九合诸侯，一匡天下。',
    descPlain: '【外交·三】外交权重 +30% mul、信誉 +12。',
  },
  {
    id: 'pol_alliance_league', name: '合纵连横', branch: '外交',
    x: 1860, y: 490,
    cost: { gold: 100, rite: 12 },
    effects: [
      { target: 'country_diplomacy_weight', op: 'mul', value: 1.40 },
      { target: 'country_renown', op: 'add', value: 15 },
      { target: 'event_positive_probability', op: 'mul', value: 1.20 },
    ],
    prerequisites: ['pol_hegemon'], tier: 4,
    description: '纵横捭阖，运策决胜。',
    descPlain: '【外交·四】外交 +40% mul、信誉 +15、正面事件 +20%。外交终极。',
  },

  // —— 学问：T3 + T4 ——
  {
    id: 'pol_academy_hall', name: '稷下学宫', branch: '学问',
    x: 2060, y: 360,
    cost: { gold: 60, rite: 10, cloth: 10 },
    effects: [
      { target: 'country_research_speed', op: 'mul', value: 1.25 },
      { target: 'population_class_growth_shi', op: 'mul', value: 1.20 },
    ],
    prerequisites: ['pol_classics_compile'], tier: 3,
    description: '稷下高门，群儒论道。',
    descPlain: '【学问·三】研究 +25% mul、士阶层成长 +20%。',
  },
  {
    id: 'pol_hundred_schools', name: '百家争鸣', branch: '学问',
    x: 2060, y: 490,
    cost: { gold: 100, rite: 15, cloth: 15 },
    effects: [
      { target: 'country_research_speed', op: 'mul', value: 1.30 },
      { target: 'country_renown', op: 'add', value: 12 },
      { target: 'event_positive_probability', op: 'mul', value: 1.25 },
    ],
    prerequisites: ['pol_academy_hall'], tier: 4,
    description: '九流并起，百家争鸣。',
    descPlain: '【学问·四】研究 +30% mul、信誉 +12、正面事件 +25%。学问终极。',
  },
];

// ============================================================================
// 意识形态双轴（2026-06-20）：让"封建帝国 → 三主义"由国策驱动，而非只堆数值。
//   power  : 负=集权(家天下) / 正=还权(公天下倾向)
//   production: 负=私有(货天下) / 正=公有(公天下)
// 仅故事模式生效（沙盒 storyFlags 为空，gameStore.pushStoryAxis 自动跳过）。
// 三结局阈值 ±34（storyDriver）：家=集权；公=还权+公有；货=其余。数值待 playtest 校准。
// ============================================================================
const POLICY_AXIS: Record<string, StoryAxisDelta> = {
  // 农桑
  pol_grain_storage: { power: -2, production: 3 }, // 国家仓储：轻集权+公
  pol_sericulture: { production: -2 },             // 私营蚕织
  pol_loom_workshop: { production: -4 },           // 私营织室：私有
  pol_ever_granary: { power: 0, production: 10 },    // 常平仓：平准民生→纯公有(不再拖向集权，助力公天下)
  pol_brocade: { power: 2, production: -8 },        // 织锦贡市：私有/货
  // 工坊
  pol_market: { power: 1, production: -3 },          // 通市：商贸松动中央→轻还权+私有
  pol_water_works: { production: 2 },
  pol_irrigation: { production: 3 },                // 集体水利：公
  pol_mint: { power: 3, production: -6 },            // 铸币流通：重商→还权+私有(货天下骨干)
  pol_iron_arms: { power: -5 },                      // 国家武备：集权
  pol_great_market: { power: 3, production: -8 },    // 列肆通衢：货天下
  pol_armory: { power: -8 },                         // 武库：集权
  // 礼制（家天下主干）
  pol_ancestor_rites: { power: -2 },
  pol_ritual_codex: { power: -3 },
  pol_imperial: { power: -8 },                       // 王制：家天下核心
  pol_mandate: { power: -12 },                       // 受命于天：极集权
  // 保甲
  pol_conscript: { power: -4 },
  pol_militia: { power: 4, production: 3 },           // 民兵：武装人民→还权+公
  pol_chariot_corps: { power: -5 },                  // 贵族车马：集权
  pol_naval_corps: { power: -3 },
  pol_border_forts: { power: -2, production: 2 },     // 屯戍：轻集权+公
  pol_iron_cavalry: { power: -6 },
  pol_grand_fleet: { power: -4 },
  // 外交
  pol_post_road: { power: -2 },
  pol_marriage_alliance: { power: -4 },              // 联姻：家天下
  pol_tribute: { power: -4 },                        // 朝贡：集权
  pol_hegemon: { power: 3, production: 1 },
  pol_alliance_league: { power: 6, production: 2 },  // 合纵：多极共治→还权+轻公
  // 学问（还权/公天下助力）
  pol_school: { power: 2, production: 1 },
  pol_classics_compile: { power: -2 },               // 经学正统：轻集权
  pol_academy_hall: { power: 5, production: 4 },      // 稷下学宫：还权+公（学在民间）
  pol_hundred_schools: { power: 8, production: 4 },   // 百家争鸣：强还权+公（公天下基石）
};
for (const p of POLICIES) {
  const a = POLICY_AXIS[p.id];
  if (a) p.storyAxisDelta = a;
}
