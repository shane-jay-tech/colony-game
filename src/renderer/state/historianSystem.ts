/**
 * A-6 史官谏言系统 — 12 个情境触发点，每条只触发一次。
 * 每日 tick 检测条件，命中即发事件由 UI 层展示。
 * 已触发 id 存入 GameState.seenJitHints（复用已有持久化字段）。
 */

export interface HistorianAdvice {
  id: string;
  text: string;
  check: (ctx: HistorianContext) => boolean;
}

export interface HistorianContext {
  currentDay: number;
  isFirstDay: boolean;
  grainNegativeDays: number;
  gold: number;
  hasGoldCostBuilding: boolean;
  policyPanelUnlocked: boolean;
  hasHostileNpc: boolean;
  populationAtCap: boolean;
  gradeJustAscended: boolean;
  idleDays: number;
  crisisActive: boolean;
  noAdjacentBonus: boolean;
  isFirstWinter: boolean;
  hasAvailableGeneral: boolean;
  seenIds: Set<string>;
}

export const HISTORIAN_ADVICES: HistorianAdvice[] = [
  {
    id: 'hist_01_first_game',
    text: '大人，草庐数十，炊烟初起。先建农田养活众人罢。',
    check: ctx => ctx.isFirstDay,
  },
  {
    id: 'hist_02_grain_low',
    text: '粮已见底！速增农田，或减少徭役人口。',
    check: ctx => ctx.grainNegativeDays >= 3,
  },
  {
    id: 'hist_03_gold_empty',
    text: '库银空矣。市集能带来收入，但需先有驿道通商。',
    check: ctx => ctx.gold === 0 && ctx.hasGoldCostBuilding,
  },
  {
    id: 'hist_04_policy_unlock',
    text: '国策乃百年大计，采纳后不可撤回，望三思。',
    check: ctx => ctx.policyPanelUnlocked,
  },
  {
    id: 'hist_05_hostile_npc',
    text: '邻邦已露不善，当修兵备、或遣使周旋。',
    check: ctx => ctx.hasHostileNpc,
  },
  {
    id: 'hist_06_pop_cap',
    text: '民无所居。建屋安民方能继续增长。',
    check: ctx => ctx.populationAtCap,
  },
  {
    id: 'hist_07_grade_ascend',
    text: '恭喜升格！新建筑和国策已解锁，请查阅建造面板。',
    check: ctx => ctx.gradeJustAscended,
  },
  {
    id: 'hist_08_idle',
    text: '大人近日似无作为……是否需要臣提些建议？',
    check: ctx => ctx.idleDays >= 30,
  },
  {
    id: 'hist_09_crisis',
    text: '邦国虽入低谷，但不会亡。坚持住。',
    check: ctx => ctx.crisisActive,
  },
  {
    id: 'hist_10_no_adjacency',
    text: '此处无相邻加成。农田近水井可增产三成。',
    check: ctx => ctx.noAdjacentBonus,
  },
  {
    id: 'hist_11_first_winter',
    text: '入冬了。冬季不宜远征开工，但适合朝议外交。',
    check: ctx => ctx.isFirstWinter,
  },
  {
    id: 'hist_12_general',
    text: '有武将来投。可在军事面板中指派出征。',
    check: ctx => ctx.hasAvailableGeneral,
  },
];

export interface HistorianResult {
  advice: HistorianAdvice | null;
}

export function checkHistorian(ctx: HistorianContext): HistorianResult {
  for (const adv of HISTORIAN_ADVICES) {
    if (ctx.seenIds.has(adv.id)) continue;
    if (adv.check(ctx)) return { advice: adv };
  }
  return { advice: null };
}
