/**
 * A-5 世界呼吸系统 — 通知内容池。
 * 轻通知(toast)：1 句话，经济/民生/季节/建筑状态。
 * 报文(bulletin)：3-5 句，NPC 动态/民间传闻/将领消息。
 */

export type BreathingKind = 'toast' | 'bulletin';

export interface BreathingEntry {
  id: string;
  kind: BreathingKind;
  text: string;
  condition: BreathingCondition;
}

export type BreathingCondition =
  | { type: 'always' }
  | { type: 'season'; season: 0 | 1 | 2 | 3 }
  | { type: 'resource_low'; resource: string; threshold: number }
  | { type: 'resource_high'; resource: string; threshold: number }
  | { type: 'population_ratio'; min?: number; max?: number }
  | { type: 'has_building'; defId: string }
  | { type: 'npc_hostile' }
  | { type: 'npc_friendly' }
  | { type: 'crisis_active' }
  | { type: 'grade_min'; grade: number };

export const BREATHING_TOASTS: BreathingEntry[] = [
  { id: 'bt_01', kind: 'toast', text: '集市传来喧哗声，百姓正在交换余粮。', condition: { type: 'has_building', defId: 'bld_market' } },
  { id: 'bt_02', kind: 'toast', text: '春耕正忙，田间牛马不歇。', condition: { type: 'season', season: 0 } },
  { id: 'bt_03', kind: 'toast', text: '夏日炎炎，工匠们在树荫下歇息。', condition: { type: 'season', season: 1 } },
  { id: 'bt_04', kind: 'toast', text: '秋收在即，仓中渐满。', condition: { type: 'season', season: 2 } },
  { id: 'bt_05', kind: 'toast', text: '朔风凛冽，民居升起炊烟。', condition: { type: 'season', season: 3 } },
  { id: 'bt_06', kind: 'toast', text: '有游商路过，带来远方消息。', condition: { type: 'always' } },
  { id: 'bt_07', kind: 'toast', text: '孩童们在祖庙前追逐嬉戏。', condition: { type: 'has_building', defId: 'bld_ancestor_shrine' } },
  { id: 'bt_08', kind: 'toast', text: '铜冶坊的烟囱日夜不歇。', condition: { type: 'has_building', defId: 'bld_smithy' } },
  { id: 'bt_09', kind: 'toast', text: '粮仓充盈，百姓安心。', condition: { type: 'resource_high', resource: 'grain', threshold: 100 } },
  { id: 'bt_10', kind: 'toast', text: '库银渐丰，可图远事。', condition: { type: 'resource_high', resource: 'gold', threshold: 80 } },
  { id: 'bt_11', kind: 'toast', text: '民力紧张，宜缓建新屋。', condition: { type: 'population_ratio', max: 0.2 } },
  { id: 'bt_12', kind: 'toast', text: '人丁兴旺，可以扩建了。', condition: { type: 'population_ratio', min: 0.8 } },
  { id: 'bt_13', kind: 'toast', text: '驿道畅通，商旅络绎。', condition: { type: 'has_building', defId: 'bld_post_road' } },
  { id: 'bt_14', kind: 'toast', text: '学塾中传来朗朗读书声。', condition: { type: 'has_building', defId: 'bld_academy' } },
  { id: 'bt_15', kind: 'toast', text: '今日天晴，宜动工。', condition: { type: 'season', season: 0 } },
  { id: 'bt_16', kind: 'toast', text: '粮草将尽，需多留意农田。', condition: { type: 'resource_low', resource: 'grain', threshold: 20 } },
  { id: 'bt_17', kind: 'toast', text: '木料充足，可兴土木。', condition: { type: 'resource_high', resource: 'wood', threshold: 80 } },
  { id: 'bt_18', kind: 'toast', text: '近日无事，天下太平。', condition: { type: 'always' } },
  { id: 'bt_19', kind: 'toast', text: '百姓称颂大人德政。', condition: { type: 'grade_min', grade: 3 } },
  { id: 'bt_20', kind: 'toast', text: '桑园蚕丝正旺，织户忙碌。', condition: { type: 'has_building', defId: 'bld_mulberry_grove' } },
];

export const BREATHING_BULLETINS: BreathingEntry[] = [
  { id: 'bb_01', kind: 'bulletin', text: '斥候来报：东方有商队欲来通市。据闻彼邦盛产铜器，或可互通有无。若我邦市集兴旺，定能引来更多商旅。', condition: { type: 'has_building', defId: 'bld_market' } },
  { id: 'bb_02', kind: 'bulletin', text: '民间传言：北境蛮夷近日频频越界猎鹿。虽未犯我城寨，但边民颇为不安。或许该加强巡逻，以安民心。', condition: { type: 'npc_hostile' } },
  { id: 'bb_03', kind: 'bulletin', text: '有老农进言：今年雨水丰沛，若在河畔多开良田，来年收成可期。但也需防范夏汛冲毁堤坝。', condition: { type: 'season', season: 0 } },
  { id: 'bb_04', kind: 'bulletin', text: '邻邦使者求见。据称其君主有意结好，愿以布帛换我铜器。邦交之事，利弊相随，需慎重考量。', condition: { type: 'npc_friendly' } },
  { id: 'bb_05', kind: 'bulletin', text: '冬日苦寒，有流民三十余口自北方来投。收容则耗粮，拒之于门外则损声誉。此事需大人定夺。', condition: { type: 'season', season: 3 } },
  { id: 'bb_06', kind: 'bulletin', text: '祖庙主祭报告：近日祭祀顺利，族老们对邦国前途颇为乐观。民心安定，正是扩张良机。', condition: { type: 'has_building', defId: 'bld_ancestor_shrine' } },
  { id: 'bb_07', kind: 'bulletin', text: '工匠头目来禀：铁器冶炼之法已渐纯熟，若能多建冶坊，军器产量可翻倍。但需大量木炭，恐伐木过甚。', condition: { type: 'has_building', defId: 'bld_iron_forge' } },
  { id: 'bb_08', kind: 'bulletin', text: '今日巡视城寨，只见屋舍井然、炊烟袅袅。比之初创时的数十草庐，已是天壤之别。继续努力。', condition: { type: 'grade_min', grade: 2 } },
  { id: 'bb_09', kind: 'bulletin', text: '有远方行者路过，言道南方大邦正在征伐四方。若不自强，恐怕迟早要面对他们的兵锋。', condition: { type: 'always' } },
  { id: 'bb_10', kind: 'bulletin', text: '连日暴雨，城外道路泥泞。有数户民居屋顶漏水，工匠已在抢修。幸无大碍，但提醒我们该多备石料。', condition: { type: 'season', season: 1 } },
  { id: 'bb_11', kind: 'bulletin', text: '丰收之后，百姓自发在祖庙前设宴庆贺。歌舞升平，好一派盛世景象。', condition: { type: 'resource_high', resource: 'grain', threshold: 150 } },
  { id: 'bb_12', kind: 'bulletin', text: '国库充盈，臣工建议修缮城墙、加固防御。太平日久容易懈怠，居安思危方是上策。', condition: { type: 'resource_high', resource: 'gold', threshold: 100 } },
  { id: 'bb_13', kind: 'bulletin', text: '危难之际，民心反而凝聚。百姓言道：只要大人在，便不怕难关。臣民齐心，何惧风雨？', condition: { type: 'crisis_active' } },
  { id: 'bb_14', kind: 'bulletin', text: '边境探马急报：邻邦似在调兵。未必是冲我而来，但也不可不防。当整军备战，以备不时之需。', condition: { type: 'npc_hostile' } },
  { id: 'bb_15', kind: 'bulletin', text: '学塾先生请命：欲带弟子游学四方，增长见闻。此去半月，归来后或能为邦国带回新知。', condition: { type: 'has_building', defId: 'bld_academy' } },
];

export const ALL_BREATHING: BreathingEntry[] = [...BREATHING_TOASTS, ...BREATHING_BULLETINS];
