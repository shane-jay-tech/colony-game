import { RESOURCE_IDS } from '../data/resourceRegistry';
import type { ResourceId, ModifierTargetKey } from '../data/resourceRegistry';
import type { ModifierInstance, BuildingDef, BuildingInstance, PolicyNode, RoyalDecree, CourtEvent, CourtEventContext, NpcCountryState } from '../data/schema';
import { makeInitialNpcStates, getNpcDef, selectNpcsForGame } from '../data/npcCountries';
import {
  tryTrade,
  trySendEnvoy,
  tryDeclareWar,
  computeTradeTick,
  computeStanceDrift,
  type DiplomacyResult,
} from './diplomacySystem';
import type { WorldMap } from '../data/mapSchema';
import { validateModifierInstance } from '../data/modifierValidator';
import { getBuildingDef } from '../data/buildingRegistry';
import { dayToCalendar, SEASON_NAMES } from './calendar';
import { canPlace } from './placementSystem';
import type { MapBounds, PlacementResult } from './placementSystem';
import { generateMap } from './mapGen';
import { WorldMapAccessor } from './worldMap';
import { computeProductionTick } from './productionSystem';
import { tryAdoptPolicy, type AdoptPolicyResult } from './policySystem';
import { tryAdoptDecree, tickActiveDecree, type AdoptDecreeResult } from './decreeSystem';
import { sampleEventTrigger, applyEventChoice, checkEventTimeout, selectContext } from './eventEngine';
import { applyModifiers, aggregateModifiers } from './modifierAggregator';
import type { CountryMetrics } from './dslEval';
import { createRng } from './rng';
import { evaluateGrade, type GradeInput } from './countryGrade';
import { gradeDefAt, MAX_GRADE, DIPLO_FLAG_ALL_FRIENDLY } from '../data/countryGrades';
import {
  isDualZero, chooseCrisisKind, planUnrestEffects, planCessionMoraleDrop, planTribute,
  CRISIS_GRACE_DAYS, CRISIS_RECOVER_DAYS, VASSAL_REDEEM_GOLD, type CrisisKind,
} from './crisis';
import { computePopulationGrowth, sumHousingCapacity } from './population';
import { BALANCE, getBalanceConfig } from '../data/balanceConfig';
import {
  npcMilitaryGrowthStep, evaluatePlayerStrength, computeNpcAlliances, computeNpcActions,
  NPC_MP_GROWTH_INTERVAL, NPC_MP_CAP,
} from './npcDynamics';
import { checkUnification, axisSeedForPath, clampAxis, powerBand, resourceBand, checkEnding, type EndingId } from './storyDriver';
import { chapterAt, chapterGoalMet } from '../data/storyChapters';
import { getBulletinsForChapter, getHistorianComment } from '../data/storyGoals';
import { assessNationState, shouldSampleEvent, filterEventsByState, DEFAULT_TEMPO_CONFIG, type NationStateInput } from './eventTempo';
import { applySeasonTransition, isSeasonModifier } from './seasonSystem';
import { createBreathingState, tickBreathingToast, tickBreathingBulletin, type BreathingState, type BreathingContext } from './breathingSystem';
import { checkHistorian, type HistorianContext } from './historianSystem';
import { buildDayPipeline, runDayPipeline } from './dayPipeline';
import {
  WRATH_CRISIS_DELTA, WRATH_DEMAND_ACCEPTED, WRATH_DEMAND_REJECTED,
  WRATH_PASSIVE_DECAY_PER_DAY, PRAISE_MORALE_THRESHOLD, PRAISE_MORALE_FALLBACK,
  clampSentiment, shouldForceWrathDemand,
} from './publicSentiment';
import {
  computeClassNeedState, populationFulfillment, buildingFulfillmentFactor,
} from './classNeeds';
import {
  WARINESS_BASELINE, WARINESS_DRIFT_PER_DAY, WARINESS_COALITION_THRESHOLD,
  WARINESS_DELTAS, warinessBand, clampWariness, type WarinessBand,
} from './wariness';
import {
  RELIC_CHAINS, generateRelicSites, advanceRelic, type RelicSite,
} from './relicSystem';
import type { PopulationClasses, PopulationClass, ConversionOrder } from '../data/populationClass';
import { createDefaultPopulation, totalPopulation, CONVERSION_DAYS, CONVERSION_REQUIRES, POPULATION_CLASSES, DEFAULT_STARVATION } from '../data/populationClass';
import { computeClassOccupation, getIdleByClass, canAffordClass, tickConversionQueue, applyConversion, applyStarvation, computeClassConsumption, type ClassOccupation } from './populationClassSystem';
import { type FactionState, createFactionState, tickFaction, resolveDemand, scheduleFactionEvent } from './factionSystem';
import { FACTION_NAMES } from '../data/factions';
import { type MegaProjectProgress, tickProject, getProjectReward, canAffordPhase } from './megaProjectSystem';
import { MEGA_PROJECTS } from '../data/megaProjects';
// P4：军事 + 将领（此前为死代码，现接进玩法）
import {
  type MilitaryContext, getAvailableUnitTypes, computeArmyStrength, computeDefenseStrength,
  canLaunchExpedition, createExpedition, tickExpedition, resolveBattle, computeNoInterceptLoss,
} from './militarySystem';
import { UNIT_DEFS, type ActiveExpedition, type ExpeditionConfig, type DefenseAlert, type UnitType } from '../data/military';
import {
  recruitGeneral as recruitGeneralFn, dismissGeneral as dismissGeneralFn, deployGeneral as deployGeneralFn,
  returnGeneral as returnGeneralFn, computeGeneralBonus, tickLoyalty, applyBattleResult, getGeneralDef, canRecruit,
} from './generalSystem';
import { type GeneralState, GENERAL_POOL } from '../data/generals';
import { computeNpcDecision, type NpcDecision } from './diplomacyExpanded';
import { getExcludedPolicyId, POLICY_EXCLUSION_GROUPS } from '../data/policyExclusions';

export interface IEventEmitter {
  on(event: string, fn: (...args: unknown[]) => void): void;
  off(event: string, fn: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  listenerCount(event: string): number;
}

export const STATE_EVENTS = {
  RESOURCES_CHANGED: 'state:resourcesChanged',
  DAY_TICK: 'state:dayTick',
  SEASON_TICK: 'state:seasonTick',
  YEAR_TICK: 'state:yearTick',
  MODIFIER_ADDED: 'state:modifierAdded',
  MODIFIER_REMOVED: 'state:modifierRemoved',
  BUILDING_PLACED: 'state:buildingPlaced',
  BUILDING_COMPLETED: 'state:buildingCompleted',
  PAUSED_CHANGED: 'state:pausedChanged',
  SPEED_CHANGED: 'state:speedChanged',
  STATE_REPLACED: 'state:replaced',
  PRODUCTION_TICK: 'state:productionTick',
  POLICY_ADOPTED: 'state:policyAdopted',
  DECREE_ADOPTED: 'state:decreeAdopted',
  DECREE_ADVANCED: 'state:decreeAdvanced',
  DECREE_COMPLETED: 'state:decreeCompleted',
  DECREE_STALLED: 'state:decreeStalled',
  EVENT_TRIGGERED: 'state:eventTriggered',
  EVENT_RESOLVED: 'state:eventResolved',
  TUTORIAL_STEP_CHANGED: 'state:tutorialStepChanged',
  // v0.9：用户原话「如果非要重合，加折叠展开按钮」。左/右面板收/展时通知地图重算视口
  PANEL_COLLAPSED_CHANGED: 'state:panelCollapsedChanged',
  // v0.9：建筑升级（纪元 1800 风格 chain）
  BUILDING_UPGRADED: 'state:buildingUpgraded',
  BUILDING_REMOVED: 'state:buildingRemoved', // 拆除：移除 + 返还半数材料 + 释放占用劳力
  // v1.0 #6：邦交动作产生结果（trade/envoy/war 任一）→ UI refresh + toast
  DIPLOMACY_ACTION: 'state:diplomacyAction',
  // v1.0 #6：通商每 30 日入账时发；UI 给玩家飘一个 +X gold +Y cloth 反馈
  TRADE_TICK: 'state:tradeTick',
  // Phase1：国格晋阶/降格（payload { from, to, def, reason }）→ HUD 徽章刷新 + Toast
  GRADE_CHANGED: 'state:gradeChanged',
  // Phase1：登顶天下共主软认可（仅一次）→ 长 Toast 祝贺，不暂停不结束
  TIANXIA_ACKNOWLEDGED: 'state:tianxiaAcknowledged',
  // Phase1：低谷危机触发（payload { summary, peopleDelta, moraleDelta, gradeFrom, gradeTo }）→ 居中通告模态
  CRISIS_TRIGGERED: 'state:crisisTriggered',
  // Phase1：NPC 动态行动（payload { kind, actorName, targetName?, text }）→ Toast 提示
  NPC_ACTION: 'state:npcAction',
  // Phase1：NPC 结盟/军力等动态更新 → DiplomacyPanel 刷新
  NPC_DYNAMICS_TICK: 'state:npcDynamicsTick',
  // Phase2：序章统一达成（payload { path }）→ 触发建朝跳变过场
  STORY_UNIFIED: 'state:storyUnified',
  // Phase2：章节切换（payload { chapter, def }）→ HUD 章节 banner + 引子 Toast
  STORY_CHAPTER_CHANGED: 'state:storyChapterChanged',
  // Phase2：隐性双轴跨档 → 史官氛围评语 Toast（payload { text }）
  STORY_NARRATION: 'state:storyNarration',
  // Phase2：终章三结局兑现（payload { ending }）→ 结局画面
  STORY_ENDING: 'state:storyEnding',
  // A-5：世界呼吸通知（payload { entry }）→ toast 或 bulletin UI
  BREATHING_TOAST: 'state:breathingToast',
  BREATHING_BULLETIN: 'state:breathingBulletin',
  HISTORIAN_ADVICE: 'state:historianAdvice',
  // A1：双轴民心——怨愤变化（payload { value, reason }）/ 怨愤临界警示（payload { text }）
  MORALE_CHANGED: 'state:moraleChanged',
  WRATH_CHANGED: 'state:wrathChanged',
  WRATH_ALERT: 'state:wrathAlert',
  // B1：列国警惕值变化（payload { value, reason }）
  WORLD_WARINESS_CHANGED: 'state:worldWarinessChanged',
  // C1：古迹链完整探索结束（payload { name, summary }）
  RELIC_RESOLVED: 'state:relicResolved',
  // B-4.1：阶层博弈诉求出现/解决（payload { demand, factionName } / { demandId, accepted }）→ 诉求弹窗
  FACTION_DEMAND_TRIGGERED: 'state:factionDemandTriggered',
  FACTION_DEMAND_RESOLVED: 'state:factionDemandResolved',
  // B-4.2：巨型工程开始/完成（payload { projectId, def } / { projectId, def, reward }）→ 工程面板刷新 + toast
  MEGA_PROJECT_STARTED: 'state:megaProjectStarted',
  MEGA_PROJECT_COMPLETED: 'state:megaProjectCompleted',
  // B-1/B-2：军事——出征结算/将领变动/军务面板刷新/来犯预警
  EXPEDITION_RESOLVED: 'state:expeditionResolved',
  GENERALS_CHANGED: 'state:generalsChanged',
  MILITARY_CHANGED: 'state:militaryChanged',
  DEFENSE_ALERT: 'state:defenseAlert',
} as const;

export type PanelSide = 'left' | 'right';

export interface GameState {
  resources: Partial<Record<ResourceId, number>>;
  buildings: BuildingInstance[];
  policies: { id: string; adopted: boolean }[];
  activeModifiers: ModifierInstance[];
  activeDecrees: { id: string; currentStage: number; daysElapsed: number }[];
  eventHistory: string[];
  /** 当前等待玩家处理的朝议事件 id；null 表示没有待办 */
  pendingEventId: string | null;
  /** pendingEventId 被设上时的 currentDay；用于计算 timeout */
  pendingEventDayStart: number | null;
  /** 上一次朝堂事件结算的 currentDay；事件冷却（balanceConfig.event.minDaysBetween）据此计算 */
  lastEventDay: number;
  tutorialStepId: string | null;
  /** Phase4 新手引导：已弹过的 JIT 即时提示 trigger（持久化，永不重复） */
  seenJitHints: string[];
  lastSeenTimestamp: number;
  paused: boolean;
  speed: 0 | 1 | 2 | 3;
  lastTickTimestamp: number;
  currentDay: number;
  rngSeed: number;
  worldMap: WorldMap;
  /** 分数累加器：上一 tick 没取整完的资源残差（Slice G hardening — 解决 0.4 grain 永远=0） */
  productionCarry: Partial<Record<ResourceId, number>>;
  /** v0.9：左右面板折叠态（用户截图反馈 → 不能让 HUD/侧栏渗到地图后） */
  panelCollapsed: { left: boolean; right: boolean };
  /** v1.0 #2：已完成的 decree id 列表（chainPrev 链路解锁需要） */
  completedDecreeIds: string[];
  /** v1.0 #6：NPC 邦国动态状态（stance/militaryPower/renown/tradeRoute/...） */
  npcCountries: NpcCountryState[];
  /** v1.0 #6：玩家国家级 metric（renown 用 modifier 系统聚合，但 morale / militaryPower 由 diplomacy 直接调） */
  playerMorale: number;
  /** A1 双轴民心：怨愤（0..100）。民心高=颂声，怨愤高=民变诉求。 */
  publicWrath: number;
  /** 上次「民怨沸腾」警示日（冷却用；null=从未触发） */
  lastWrathDemandDay: number | null;
  /** B1：列国警惕值（0..100，基线 20）。宣战/称霸升，通商/出使降，太平日回落。 */
  worldWariness: number;
  /** 最近一次警惕值变动原因（邦交面板展示「侧目原因」） */
  lastWarinessReason: string | null;
  /** B2：上次「宣扬德政」日（7 日内重复使用效果减半；null=从未） */
  lastPropagandaDay: number | null;
  /** C1：本局古迹点（种子确定性生成 2~4 个） */
  relicSites: RelicSite[];
  playerMilitaryPower: number;
  /** Phase1 国格阶梯：当前国格级（0..5，0=聚落） */
  grade: number;
  /** Phase1：历史最高国格（不随降格回退；用于软认可只触发一次 + HUD 不倒退里程感） */
  gradeReached: number;
  /** Phase1：登顶天下共主软认可是否已弹过（防重复祝贺） */
  tianxiaAcknowledged: boolean;
  /** Phase1 低谷：国库+存粮双零的连续天数计数器 */
  dualZeroDays: number;
  /** Phase1 低谷：当前是否处于危机态（恢复 CRISIS_RECOVER_DAYS 天双正后复位，可再次触发） */
  crisisActive: boolean;
  /** Phase1：危机解除前资源连续双正的天数计数器 */
  crisisRecoverDays: number;
  /** Phase1 模式外壳：sandbox（无限经营）/ story（Phase2 叙事） */
  mode: 'sandbox' | 'story';
  /** Phase1 人口增长的小数残差累加器（独立于 productionCarry） */
  populationCarry: number;
  /** §7 防刷：已经历的危机次数（惩罚随之递增） */
  crisisCount: number;
  /** §7 纳贡附庸：附庸于哪个 NPC id（null=独立）；每季被抽成，可赎身 */
  vassalOf: string | null;
  /** Phase2 故事专属：叙事导演层状态。sandbox 模式恒为 null（不污染沙盒） */
  storyFlags: StoryFlags | null;
  /** B-0 人口阶层分布（Σ = resources.people） */
  populationClasses: PopulationClasses;
  /** B-0 阶层转化队列（farmer→worker等，每条 CONVERSION_DAYS 天完成） */
  conversionQueue: ConversionOrder[];
  /** B-0 缺粮连续天数（饥饿减员用） */
  grainNegativeDays: number;
  /** B-4.1 阶层博弈状态 */
  factionState: FactionState;
  /** B-4.2 巨型工程进度列表 */
  megaProjects: MegaProjectProgress[];
  /** B-4.3 已选的互斥国策 id 列表 */
  exclusivePolicies: string[];
  /** B-2 已招募将领（忠诚/出征态）。P4 接入。 */
  generals: GeneralState[];
  /** B-1 进行中的出征。P4 接入。 */
  activeExpeditions: ActiveExpedition[];
  /** B-1 来犯预警（NPC 决定攻击 → 给玩家反应窗口）。P4 接入。 */
  defenseAlerts: DefenseAlert[];
}

/** Phase2 故事模式状态（StoryDriver 层；隐性双轴 + 章节进度）。 */
export interface StoryFlags {
  /** 0=序章，1..7=七卷 */
  chapter: number;
  /** 序章统一途径：武途偏集权 / 文途偏还权 / 未定 */
  unifyPath: 'martial' | 'cultural' | null;
  /** 序章是否已统一（防重复触发建朝跳变） */
  unified: boolean;
  /** 权力轴 -100(集权) .. +100(还权于民) */
  powerAxis: number;
  /** 生产资料轴 -100(私有) .. +100(公有) */
  resourceAxis: number;
  /** 已触发的故事事件 id（防重复） */
  storyEventsTriggered: string[];
  /** 当前章节起始那一日（占位推进：度过 advanceAfterDays 天进下章） */
  chapterStartDay: number;
  /** 终章兑现的结局（null=未到结局） */
  ending: EndingId | null;
}

// J-3a v0.8 缺陷 #8：地图扩 32×32(1024 tile) → 80×80(6400 tile)，承载 ~3 小时单次游玩
// 80² 在 mapGen MAX_DIM=200 内；DEFAULT_MAP_SIZE² × DEFAULT_TILE_SIZE_PX 不影响 viewport（相机随玩家拖）
export const DEFAULT_MAP_SIZE = 80;

function makeDefaultState(): GameState {
  const seed = 12345;
  return {
    resources: {},
    buildings: [],
    policies: [],
    activeModifiers: [],
    activeDecrees: [],
    eventHistory: [],
    pendingEventId: null,
    pendingEventDayStart: null,
    lastEventDay: 0,
    // Slice G 教程：新建游戏默认显示欢迎引导；存档读回的 state 会覆盖此值
    tutorialStepId: 'tut_welcome',
    seenJitHints: [],
    lastSeenTimestamp: 0,
    paused: false,
    speed: 1,
    lastTickTimestamp: 0,
    currentDay: 0,
    rngSeed: seed,
    worldMap: generateMap({ width: DEFAULT_MAP_SIZE, height: DEFAULT_MAP_SIZE, seed }),
    productionCarry: {},
    panelCollapsed: { left: false, right: false },
    completedDecreeIds: [],
    npcCountries: makeInitialNpcStates(),
    playerMorale: 50,
    publicWrath: 0,
    lastWrathDemandDay: null,
    worldWariness: WARINESS_BASELINE,
    lastWarinessReason: null,
    lastPropagandaDay: null,
    relicSites: [],
    playerMilitaryPower: 30,
    grade: 0,
    gradeReached: 0,
    tianxiaAcknowledged: false,
    dualZeroDays: 0,
    crisisActive: false,
    crisisRecoverDays: 0,
    mode: 'sandbox',
    populationCarry: 0,
    crisisCount: 0,
    vassalOf: null,
    storyFlags: null,
    populationClasses: createDefaultPopulation(0),
    conversionQueue: [],
    grainNegativeDays: 0,
    factionState: createFactionState(),
    megaProjects: [],
    exclusivePolicies: [],
    generals: [],
    activeExpeditions: [],
    defenseAlerts: [],
  };
}

export interface GameStoreContent {
  policies?: readonly PolicyNode[];
  decrees?: readonly RoyalDecree[];
  events?: readonly CourtEvent[];
}

export class GameStore {
  private state: GameState;
  private readonly emitter: IEventEmitter;
  private worldMapAccessor: WorldMapAccessor;
  private readonly policies: readonly PolicyNode[];
  private readonly decrees: readonly RoyalDecree[];
  private events: readonly CourtEvent[];
  /** 内容层事件（不含古迹合成事件；replaceState 重建事件表时以此为基础） */
  private readonly baseEvents: readonly CourtEvent[];
  /**
   * Slice G UI 暂停 refcount：模态（EventModal / TutorialModal）通过 holder 名注册暂停，
   * 多模态嵌套时不会互相覆盖玩家手动暂停状态。
   * - state.paused 仅由 setPaused 写（HUD 速度按钮）
   * - effective isPaused = state.paused || pauseHolders.size > 0
   * - 不持久化（模态生命周期外应该没有 holder；hot reload 时由 destroy 释放）
   */
  private pauseHolders: Set<string> = new Set();
  /** Phase2 瞬态（不持久化）：序章统一后等 GameScene 播完建朝过场再 advanceStoryChapter(1)。
   *  重载时默认 false → 若 storyFlags.unified 仍停在 chapter 0，runStoryTick 自动恢复进第一章，防 softlock。 */
  private storyTransitionPending = false;
  /** A-5 瞬态：世界呼吸系统状态（不持久化） */
  private breathingState: BreathingState = createBreathingState();
  /** A-6 瞬态：史官谏言追踪（不持久化，重载后从 0 开始累积） */
  private historianGrainNegDays = 0;
  private historianIdleDays = 0;
  private historianGradeAscended = false;

  constructor(emitter: IEventEmitter, initialState?: Partial<GameState>, content?: GameStoreContent) {
    this.emitter = emitter;
    this.state = Object.assign(makeDefaultState(), initialState ?? {});
    // B-0：如果外部传了 people 但没传 populationClasses，同步到 farmer
    const peoplePassed = this.state.resources['people'] ?? 0;
    if (peoplePassed > 0 && totalPopulation(this.state.populationClasses) === 0) {
      this.state.populationClasses = createDefaultPopulation(peoplePassed);
    }
    this.worldMapAccessor = new WorldMapAccessor(this.state.worldMap);
    // C1：古迹点按种子确定性生成（旧档自带 relicSites 则沿用）
    if (!Array.isArray(this.state.relicSites) || this.state.relicSites.length === 0) {
      this.state.relicSites = generateRelicSites(
        this.state.rngSeed,
        this.state.worldMap.width,
        this.state.worldMap.height,
      );
    }
    this.policies = content?.policies ?? [];
    this.decrees = content?.decrees ?? [];
    this.baseEvents = content?.events ?? [];
    this.events = [...this.baseEvents, ...this.buildRelicEvents()];
  }

  /** C1：把古迹链的每一阶段物化为一条合成事件（trigger 概率 0，只由 pendingEventId 显式唤起）。 */
  private buildRelicEvents(): CourtEvent[] {
    const out: CourtEvent[] = [];
    for (const site of this.state.relicSites) {
      const chain = RELIC_CHAINS.find(c => c.id === site.chainId);
      if (!chain) continue;
      chain.stages.forEach((st, i) => {
        out.push({
          id: `relic_${site.id}_s${i}`,
          tags: ['抉择'],
          triggers: [{ condition: 'random', value: 0 }],
          contexts: [{ condition: 'default', title: st.title, desc: st.desc, descPlain: st.descPlain }],
          choices: st.choices.map(c => ({
            text: c.text, textPlain: c.textPlain, effects: [], removeEffects: [],
          })),
        });
      });
    }
    return out;
  }

  // full snapshot for UI rendering; per-frame hot paths should use lightweight getters below
  getState(): Readonly<GameState> {
    return Object.freeze(structuredClone(this.state));
  }

  // lightweight getters: zero / shallow copy, safe to call every frame
  getSpeed(): 0 | 1 | 2 | 3 { return this.state.speed; }
  // Slice G：含模态 holder 的有效暂停态；timeSystem / HUD 都读这一份
  isPaused(): boolean { return this.state.paused || this.pauseHolders.size > 0; }
  /** 仅用于诊断 / 测试：玩家手动暂停标志（不含模态 holder） */
  getUserPaused(): boolean { return this.state.paused; }
  getCurrentDay(): number { return this.state.currentDay; }
  // returns a frozen shallow copy; safe to hold but not safe to mutate (callers shouldn't try)
  getActiveModifiers(): readonly ModifierInstance[] { return Object.freeze([...this.state.activeModifiers]); }
  getBuildings(): readonly BuildingInstance[] { return Object.freeze([...this.state.buildings]); }
  // shallow copy of resources dict; ~8 keys, cheap enough for per-frame use (Slice E Critical)
  getResources(): Readonly<Partial<Record<ResourceId, number>>> { return Object.freeze({ ...this.state.resources }); }
  /** 当前住房上限（人口可增长到的最大值）= 基数 + working 建筑 housingCapacity，经 country_population_cap modifier 聚合。
   *  与 runPopulationTick 同口径，供 HUD 把"民"显示为 现有/上限（纪元式）。 */
  getHousingCap(): number {
    const popCfg = getBalanceConfig(this.state.mode).population;
    const base = popCfg.baseHousingCap + sumHousingCapacity(this.state.buildings, getBuildingDef);
    return Math.round(applyModifiers(base, 'country_population_cap', this.state.activeModifiers));
  }
  /** 占用制：在役建筑(constructing+working)占用的劳力总和 = Σ def.cost.people。paused/derelict 不占编制。 */
  getEmployedLabor(): number {
    let total = 0;
    for (const b of this.state.buildings) {
      if (b.status !== 'constructing' && b.status !== 'working') continue;
      total += getBuildingDef(b.defId)?.cost.people ?? 0;
    }
    return total;
  }
  /** 占用制：闲置劳力 = 总人口 − 已占用，clamp≥0。HUD 显示"民 闲置/总人口"，建造门槛用它。 */
  getIdleLabor(): number {
    return Math.max(0, (this.state.resources['people'] ?? 0) - this.getEmployedLabor());
  }
  /** B-0：各阶层当前人口 */
  getPopulationClasses(): Readonly<PopulationClasses> { return { ...this.state.populationClasses }; }
  /** B-0：各阶层占用详情 */
  getClassOccupation() { return computeClassOccupation(this.state.buildings, getBuildingDef); }
  /** B-0：各阶层闲置人口 */
  getIdleByClass() { return getIdleByClass(this.state.populationClasses, this.getClassOccupation()); }
  /** B-0：转化队列 */
  getConversionQueue(): readonly ConversionOrder[] { return this.state.conversionQueue; }
  /** B-0：发起阶层转化。返回 false = 条件不满足 */
  startConversion(from: PopulationClass, to: PopulationClass, count: number): boolean {
    const key = `${from}->${to}`;
    const reqBuilding = CONVERSION_REQUIRES[key];
    if (reqBuilding) {
      const hasBuilding = this.state.buildings.some(b => b.defId === reqBuilding && b.status === 'working');
      if (!hasBuilding) return false;
    }
    const occ = this.getClassOccupation();
    if (!canAffordClass(this.state.populationClasses, occ, from, count)) return false;
    this.state.conversionQueue.push({ from, to, count, daysRemaining: CONVERSION_DAYS });
    this.state.populationClasses[from] -= count;
    return true;
  }
  /** 分阶段：建筑是否在当前阶段已解锁。
   *  条件一：tier 对应国格门槛（T1→grade0, T2→grade1, T3→grade2, T4→grade3）
   *  条件二：upgradeRequires 全满足（国策/前置建筑）。 */
  isBuildingUnlocked(def: BuildingDef): boolean {
    const requiredGrade = Math.max(0, def.tier - 1);
    if (this.state.grade < requiredGrade) return false;
    if (def.upgradeRequires.length === 0) return true;
    const adopted = this.getAdoptedPolicyIds();
    const built = new Set(this.state.buildings.filter(b => b.status === 'working').map(b => b.defId));
    const decrees = new Set(this.state.completedDecreeIds);
    return def.upgradeRequires.every(req => adopted.has(req) || built.has(req) || decrees.has(req));
  }
  /**
   * 建筑解锁详情（供 BuildPanel 区分展示，解决"国策采纳了但建筑没出现、玩家以为没生效"）：
   *  - buildable：可建（= isBuildingUnlocked true）
   *  - grade_locked：前置(国策/前置建筑/朝令)已满足，但国格不够 → 灰显 + "需晋X"提示
   *  - prereq_locked：前置未满足 → 仍隐藏（不剧透后期内容）
   */
  getBuildingUnlockInfo(def: BuildingDef): { state: 'buildable' | 'grade_locked' | 'prereq_locked'; reason: string } {
    const requiredGrade = Math.max(0, def.tier - 1);
    const adopted = this.getAdoptedPolicyIds();
    const built = new Set(this.state.buildings.filter(b => b.status === 'working').map(b => b.defId));
    const decrees = new Set(this.state.completedDecreeIds);
    const prereqMet = def.upgradeRequires.length === 0
      || def.upgradeRequires.every(req => adopted.has(req) || built.has(req) || decrees.has(req));
    if (!prereqMet) return { state: 'prereq_locked', reason: '' };
    if (this.state.grade < requiredGrade) {
      const gname = gradeDefAt(requiredGrade)?.name ?? `国格${requiredGrade}`;
      return { state: 'grade_locked', reason: `需晋「${gname}」` };
    }
    return { state: 'buildable', reason: '' };
  }

  /** 分阶段：国策是否已解锁（国格门槛 + prerequisites 全部已采纳）。 */
  isPolicyUnlocked(def: PolicyNode): boolean {
    const requiredGrade = Math.max(0, def.tier - 1);
    if (this.state.grade < requiredGrade) return false;
    if (def.prerequisites.length === 0) return true;
    const adopted = this.getAdoptedPolicyIds();
    return def.prerequisites.every(p => adopted.has(p));
  }
  getLastSeenTimestamp(): number { return this.state.lastSeenTimestamp; }
  getWorldMap(): WorldMapAccessor { return this.worldMapAccessor; }
  getPendingEventId(): string | null { return this.state.pendingEventId; }
  getActiveDecrees(): readonly { id: string; currentStage: number; daysElapsed: number }[] {
    return Object.freeze(this.state.activeDecrees.map(d => ({ ...d })));
  }
  /** v1.0 #2：已完成的 decree id（链路解锁判定 + 历史记录） */
  getCompletedDecreeIds(): readonly string[] {
    return Object.freeze([...this.state.completedDecreeIds]);
  }
  getAdoptedPolicyIds(): ReadonlySet<string> {
    return new Set(this.state.policies.filter(p => p.adopted).map(p => p.id));
  }
  // Slice G UI：暴露静态内容给右侧政策/朝令面板与朝议对话框
  getPolicies(): readonly PolicyNode[] { return this.policies; }
  getDecrees(): readonly RoyalDecree[] { return this.decrees; }
  getEvents(): readonly CourtEvent[] { return this.events; }
  /** 把 pendingEventId 解析成完整 CourtEvent 对象；找不到返回 null */
  getPendingEvent(): CourtEvent | null {
    const id = this.state.pendingEventId;
    if (id === null) return null;
    return this.events.find(e => e.id === id) ?? null;
  }
  getPendingEventDayStart(): number | null { return this.state.pendingEventDayStart; }
  /** Phase3：按当前状态（含故事双轴）选事件呈现文本变体（OQ-S3 控量）。EventModal 用之取代 contexts[0]。 */
  pickEventContext(event: CourtEvent): CourtEventContext {
    return selectContext(event, this.computeMetrics());
  }
  // Slice G 教程：当前 tutorialStepId（'tut_welcome' | 具体 step id | null=已结束）
  getTutorialStepId(): string | null { return this.state.tutorialStepId; }
  setTutorialStepId(id: string | null): void {
    if (this.state.tutorialStepId === id) return;
    this.state.tutorialStepId = id;
    this.emitter.emit(STATE_EVENTS.TUTORIAL_STEP_CHANGED, id);
  }

  // Phase4 新手引导：JIT 即时提示去重（已弹过的 trigger 持久化）
  getSeenJitHints(): ReadonlySet<string> { return new Set(this.state.seenJitHints); }
  /** 标记某 JIT trigger 已弹过。返回 true=本次首标记（调用方据此决定是否真的弹），false=早已弹过。 */
  markJitHintSeen(trigger: string): boolean {
    if (this.state.seenJitHints.includes(trigger)) return false;
    this.state.seenJitHints.push(trigger);
    return true;
  }

  // v0.9 panel collapse — MapRenderer 算视口、BuildPanel/CourtPanel 自渲染
  getPanelCollapsed(side: PanelSide): boolean {
    return side === 'left' ? this.state.panelCollapsed.left : this.state.panelCollapsed.right;
  }
  setPanelCollapsed(side: PanelSide, collapsed: boolean): void {
    const cur = side === 'left' ? this.state.panelCollapsed.left : this.state.panelCollapsed.right;
    if (cur === collapsed) return;
    if (side === 'left') this.state.panelCollapsed.left = collapsed;
    else this.state.panelCollapsed.right = collapsed;
    this.emitter.emit(STATE_EVENTS.PANEL_COLLAPSED_CHANGED, { side, collapsed });
  }

  // subscribe API; emitter is intentionally not exposed publicly to prevent external emit injection
  on(event: string, fn: (...args: unknown[]) => void): void { this.emitter.on(event, fn); }
  off(event: string, fn: (...args: unknown[]) => void): void { this.emitter.off(event, fn); }
  listenerCount(event: string): number { return this.emitter.listenerCount(event); }

  /** 资源存储上限基数（无仓廪时）。 */
  private static readonly RESOURCE_CAP_BASE = 9999;

  /**
   * 资源存储上限。BUG-B（2026-06-19）：接线 bld_granary 的"储量上限 +50%"死功能——
   * 每座 working 仓廪让存储类资源上限 ×1.5 线性叠加、封顶 ×3（防把"爆仓"重新架空）。
   * people 不走此路（其真实约束是住房上限 getHousingCap），仅用基数防溢出。
   */
  getResourceCap(id: ResourceId): number {
    if (id === 'people') return GameStore.RESOURCE_CAP_BASE;
    let granaries = 0;
    for (const b of this.state.buildings) {
      if (b.status === 'working' && b.defId === 'bld_granary') granaries++;
    }
    const mul = Math.min(3, 1 + granaries * 0.5);
    return Math.round(GameStore.RESOURCE_CAP_BASE * mul);
  }

  private setResourceClamped(id: ResourceId, value: number): void {
    this.state.resources[id] = Math.min(this.getResourceCap(id), Math.max(0, Math.floor(value)));
  }

  addResource(id: ResourceId, amount: number, reason?: string): void {
    const current = this.state.resources[id] ?? 0;
    this.setResourceClamped(id, current + amount);
    const deltas: Partial<Record<ResourceId, number>> = { [id]: amount };
    this.emitter.emit(STATE_EVENTS.RESOURCES_CHANGED, { deltas, reason });
  }

  /** 开局暂停保护：玩家第一次有意义操作时自动启动时间流 */
  private autoUnpause(): void {
    if (this.state.paused && this.state.currentDay === 0) {
      this.setPaused(false);
    }
  }

  /** 自动招募：将闲置人口从其他阶层转入目标阶层，优先从农民抽调。 */
  private autoRecruitToClass(targetCls: PopulationClass, needed: number): void {
    if (needed <= 0) return;
    const occ = this.getClassOccupation();
    const alreadyIdle = Math.max(0, this.state.populationClasses[targetCls] - occ[targetCls]);
    let deficit = needed - alreadyIdle;
    if (deficit <= 0) return;
    const sourceOrder: PopulationClass[] = (['farmer', 'worker', 'soldier', 'scholar'] as const)
      .filter(c => c !== targetCls) as unknown as PopulationClass[];
    for (const src of sourceOrder) {
      if (deficit <= 0) break;
      const srcIdle = Math.max(0, this.state.populationClasses[src] - occ[src]);
      const transfer = Math.min(deficit, srcIdle);
      if (transfer > 0) {
        this.state.populationClasses[src] -= transfer;
        this.state.populationClasses[targetCls] += transfer;
        deficit -= transfer;
      }
    }
  }

  setSpeed(s: 0 | 1 | 2 | 3): void {
    if (this.state.speed === s) return;
    this.state.speed = s;
    this.autoUnpause();
    this.emitter.emit(STATE_EVENTS.SPEED_CHANGED, s);
  }

  setPaused(b: boolean): void {
    if (this.state.paused === b) return;
    const wasEffective = this.isPaused();
    this.state.paused = b;
    const isEffective = this.isPaused();
    if (wasEffective !== isEffective) {
      this.emitter.emit(STATE_EVENTS.PAUSED_CHANGED, isEffective);
    }
  }

  /**
   * Slice G：模态（EventModal/TutorialModal）请求"软暂停"。
   * - holder 是字符串 key（同 holder 重入是 idempotent）
   * - 仅当 effective paused 由 false→true 时才 emit PAUSED_CHANGED
   */
  requestPause(holder: string): void {
    if (this.pauseHolders.has(holder)) return;
    const wasEffective = this.isPaused();
    this.pauseHolders.add(holder);
    if (!wasEffective) this.emitter.emit(STATE_EVENTS.PAUSED_CHANGED, true);
  }

  /** 与 requestPause 配对；同 holder 多次释放是 idempotent */
  releasePause(holder: string): void {
    if (!this.pauseHolders.has(holder)) return;
    this.pauseHolders.delete(holder);
    if (!this.isPaused()) this.emitter.emit(STATE_EVENTS.PAUSED_CHANGED, false);
  }

  addModifier(instance: ModifierInstance): void {
    validateModifierInstance(instance);
    if (!instance.stackable) {
      const existing = this.state.activeModifiers.find(m => m.id === instance.id);
      if (existing) return;
    }
    this.state.activeModifiers.push(instance);
    this.emitter.emit(STATE_EVENTS.MODIFIER_ADDED, instance);
  }

  removeModifier(id: string): void {
    this.state.activeModifiers = this.state.activeModifiers.filter(m => m.id !== id);
    this.emitter.emit(STATE_EVENTS.MODIFIER_REMOVED, { id });
  }

  placeBuilding(def: BuildingDef, gridX: number, gridY: number, bounds: MapBounds): PlacementResult {
    const result = canPlace(
      this.state.resources, this.state.buildings, def, gridX, gridY, bounds, this.worldMapAccessor,
    );
    if (!result.ok) return result;

    // B-0 占用制：检查总闲置人口是否足够（任意阶层可被建筑招募）。
    const requiredPeople = def.cost.people ?? 0;
    if (requiredPeople > 0) {
      const occ = this.getClassOccupation();
      const totalIdle = totalPopulation(this.state.populationClasses)
        - (occ.farmer + occ.worker + occ.soldier + occ.scholar);
      if (totalIdle < requiredPeople) {
        return { ok: false, reason: 'insufficient_labor' };
      }
      const cls: PopulationClass = def.classType ?? 'farmer';
      this.autoRecruitToClass(cls, requiredPeople);
    }

    const deltas: Partial<Record<ResourceId, number>> = {};
    for (const id of RESOURCE_IDS) {
      if (id === 'people') continue; // 民=占用制劳力，不作为造价消耗（占用由 employedLabor 计算）
      const amount = def.cost[id];
      if (amount === undefined || amount === 0) continue;
      const current = this.state.resources[id] ?? 0;
      this.setResourceClamped(id, current - amount);
      deltas[id] = -amount;
    }

    const building: BuildingInstance = {
      defId: def.id,
      position: { x: gridX, y: gridY },
      status: 'constructing',
      tier: def.tier,
      constructionProgress: 0,
      modifiers: [],
    };
    this.state.buildings.push(building);
    if (Object.keys(deltas).length > 0) {
      this.emitter.emit(STATE_EVENTS.RESOURCES_CHANGED, { deltas, reason: 'building_cost' });
    }
    this.emitter.emit(STATE_EVENTS.BUILDING_PLACED, building);
    this.historianIdleDays = 0;
    this.autoUnpause();
    return { ok: true };
  }

  /**
   * v0.9 建筑升级（纪元 1800 风格 chain）：原地把 T1 → T2 / T2 → T3。
   *
   * 失败原因：
   * - unknown_building: 该坐标没有建筑
   * - not_working: 建筑还在建造 / 升级中 / 废弃，不能起新升级
   * - already_upgrading: upgradingTo 已被设
   * - no_upgrade_path: 当前 def 没有 upgradesTo
   * - unknown_def / unknown_target_def: 数据丢失
   * - prerequisites_unmet: target def 的 upgradeRequires（前置建筑/国策）未满足
   * - insufficient_resources: 资源不足
   *
   * 成功路径：扣 upgradeCost → status='constructing' + upgradingTo=target →
   * tickDay 推进 upgradeTime 天后 finishUpgrade()（事件 BUILDING_UPGRADED）。
   */
  upgradeBuilding(x: number, y: number): { ok: true } | { ok: false; reason: string; missing?: string[] } {
    const inst = this.state.buildings.find(b => b.position.x === x && b.position.y === y);
    if (!inst) return { ok: false, reason: 'unknown_building' };
    if (inst.upgradingTo) return { ok: false, reason: 'already_upgrading' };
    if (inst.status !== 'working') return { ok: false, reason: 'not_working' };
    const fromDef = getBuildingDef(inst.defId);
    if (!fromDef) return { ok: false, reason: 'unknown_def' };
    if (!fromDef.upgradesTo) return { ok: false, reason: 'no_upgrade_path' };
    const toDef = getBuildingDef(fromDef.upgradesTo);
    if (!toDef) return { ok: false, reason: 'unknown_target_def' };

    // 前置（bld_*=已建建筑；pol_*=已采纳国策；decree_*=已完成朝令）
    const builtDefIds = new Set(
      this.state.buildings.filter(b => b.status === 'working').map(b => b.defId),
    );
    const adoptedPolicyIds = this.getAdoptedPolicyIds();
    const completedDecrees = new Set(this.state.completedDecreeIds);
    const missing: string[] = [];
    for (const req of toDef.upgradeRequires) {
      if (req.startsWith('pol_')) {
        if (!adoptedPolicyIds.has(req)) missing.push(req);
      } else if (req.startsWith('decree_')) {
        if (!completedDecrees.has(req)) missing.push(req);
      } else {
        if (!builtDefIds.has(req)) missing.push(req);
      }
    }
    if (missing.length > 0) return { ok: false, reason: 'prerequisites_unmet', missing };

    // B-0 占用制：升级需要额外总闲置人口（net = 新需求 - 旧占用）
    const toRequiredPeople = toDef.cost.people ?? 0;
    const fromPeople = fromDef.cost.people ?? 0;
    const netNeeded = Math.max(0, toRequiredPeople - fromPeople);
    if (netNeeded > 0) {
      const occ = this.getClassOccupation();
      const totalIdle = totalPopulation(this.state.populationClasses)
        - (occ.farmer + occ.worker + occ.soldier + occ.scholar);
      if (totalIdle < netNeeded) {
        return { ok: false, reason: 'insufficient_labor' };
      }
    }

    // 资源：升级专用 cost；未给则回退到 toDef.cost
    const cost = toDef.upgradeCost ?? toDef.cost;
    for (const id of RESOURCE_IDS) {
      if (id === 'people') continue; // 民=占用制劳力，升级不消耗人口
      const need = cost[id];
      if (need === undefined || need === 0) continue;
      if ((this.state.resources[id] ?? 0) < need) {
        return { ok: false, reason: 'insufficient_resources' };
      }
    }

    const deltas: Partial<Record<ResourceId, number>> = {};
    for (const id of RESOURCE_IDS) {
      if (id === 'people') continue; // 民=占用制劳力，升级不消耗人口
      const need = cost[id];
      if (need === undefined || need === 0) continue;
      const cur = this.state.resources[id] ?? 0;
      this.setResourceClamped(id, cur - need);
      deltas[id] = -need;
    }

    inst.upgradingTo = toDef.id;
    inst.constructionProgress = 0;
    inst.status = 'constructing';

    if (Object.keys(deltas).length > 0) {
      this.emitter.emit(STATE_EVENTS.RESOURCES_CHANGED, { deltas, reason: 'building_upgrade' });
    }
    return { ok: true };
  }

  /** 拆除建筑（按引用定位）。返还 50% 非民材料；释放占用劳力（employedLabor 自动重算）。
   *  constructing/working 都可拆。找不到返回 false。 */
  removeBuilding(instance: BuildingInstance): boolean {
    // 按引用或位置匹配（位置唯一，见 canPlace overlap）——调用方可能传 getState() 的克隆，引用匹配会失效。
    let idx = this.state.buildings.indexOf(instance);
    if (idx === -1) {
      idx = this.state.buildings.findIndex(b => b.position.x === instance.position.x && b.position.y === instance.position.y);
    }
    const removed = idx !== -1 ? this.state.buildings[idx] : undefined;
    if (!removed) return false;
    this.state.buildings.splice(idx, 1);
    const def = getBuildingDef(removed.defId);
    const deltas: Partial<Record<ResourceId, number>> = {};
    if (def) {
      for (const id of RESOURCE_IDS) {
        if (id === 'people') continue; // 占用制：民没被消耗，不返还
        const amount = def.cost[id];
        if (!amount || amount <= 0) continue;
        const refund = Math.floor(amount * 0.5);
        if (refund <= 0) continue;
        const cur = this.state.resources[id] ?? 0;
        this.setResourceClamped(id, cur + refund);
        deltas[id] = refund;
      }
    }
    if (Object.keys(deltas).length > 0) {
      this.emitter.emit(STATE_EVENTS.RESOURCES_CHANGED, { deltas, reason: 'building_refund' });
    }
    this.emitter.emit(STATE_EVENTS.BUILDING_REMOVED, { instance });
    return true;
  }

  applyDayDeltas(deltas: Partial<Record<ResourceId, number>>): void {
    for (const id of RESOURCE_IDS) {
      const delta = deltas[id];
      if (delta === undefined) continue;
      const current = this.state.resources[id] ?? 0;
      this.setResourceClamped(id, current + delta);
    }
    this.emitter.emit(STATE_EVENTS.RESOURCES_CHANGED, { deltas });
  }

  // Advance exactly ONE day. TimeSystem calls this in a loop; emitting per-day ensures
  // multi-season / multi-year boundaries are not silently skipped.
  // 日历推进是前置步；随后按 dayPipeline.DAY_PHASE_ORDER 依次执行各域阶段。
  tickDay(): void {
    const prevDay = this.state.currentDay;
    const calBefore = dayToCalendar(prevDay);
    this.state.currentDay = prevDay + 1;
    const calAfter = dayToCalendar(this.state.currentDay);

    runDayPipeline(buildDayPipeline({
      modifierExpiry: () => this.runModifierExpiryPhase(),
      seasonTransition: () => this.runSeasonTransitionPhase(calBefore, calAfter),
      construction: () => this.runConstructionPhase(),
      calendarEvents: () => this.runCalendarEventsPhase(calBefore, calAfter),
      production: () => this.runProductionTick(),
      military: () => this.runMilitaryTick(),
      decrees: () => this.runDecreeTick(),
      events: () => this.runEventTick(),
      diplomacy: () => this.runDiplomacyTick(),
      npcDynamics: () => this.runNpcDynamicsTick(),
      population: () => this.runPopulationTick(),
      conversion: () => this.runConversionTick(),
      starvation: () => this.runStarvationTick(),
      crisis: () => this.runCrisisTick(),
      grade: () => this.runGradeTick(),
      factions: () => this.runFactionTick(),
      megaProjects: () => this.runMegaProjectTick(),
      story: () => this.runStoryTick(),
      breathing: () => this.runBreathingTick(),
      historian: () => this.runHistorianTick(),
      sentimentSettle: () => this.runSentimentSettlePhase(),
    }));
  }

  private runModifierExpiryPhase(): void {
    for (const m of this.state.activeModifiers) {
      if (m.remainingDays > 0) m.remainingDays -= 1;
    }
    const expired = this.state.activeModifiers.filter(m => m.remainingDays === 0);
    if (expired.length > 0) {
      this.state.activeModifiers = this.state.activeModifiers.filter(m => m.remainingDays !== 0);
      for (const m of expired) {
        this.emitter.emit(STATE_EVENTS.MODIFIER_REMOVED, { id: m.id });
      }
    }
  }

  private runSeasonTransitionPhase(
    calBefore: ReturnType<typeof dayToCalendar>,
    calAfter: ReturnType<typeof dayToCalendar>,
  ): void {
    // A-3：季节切换优先于 construction/production，保证新季节第一天就生效
    if (calAfter.season === calBefore.season) return;
    const removed = this.state.activeModifiers.filter(isSeasonModifier);
    this.state.activeModifiers = applySeasonTransition(this.state.activeModifiers, calAfter.season);
    for (const m of removed) this.emitter.emit(STATE_EVENTS.MODIFIER_REMOVED, { id: m.id });
    this.emitter.emit(STATE_EVENTS.MODIFIER_ADDED, { id: `season_modifier_${calAfter.season}` });
  }

  private runConstructionPhase(): void {
    // A-3：季节影响建筑工期（春 +20% 速度 / 冬 -33% 速度）— 仅有在建时才算
    const hasConstructing = this.state.buildings.some(b => b.status === 'constructing');
    const constructionSpeedMul = hasConstructing
      ? applyModifiers(1, 'building_construction_speed', this.state.activeModifiers)
      : 1;
    for (const b of this.state.buildings) {
      if (b.status !== 'constructing') continue;
      const isUpgrade = !!b.upgradingTo;
      // 升级用 target def 的 upgradeTime；新建用 def.constructionTime
      const targetDef = isUpgrade ? getBuildingDef(b.upgradingTo!) : getBuildingDef(b.defId);
      if (!targetDef) continue;
      const time = isUpgrade ? (targetDef.upgradeTime ?? 1) : targetDef.constructionTime;
      const finishUpgrade = (): void => {
        const oldDefId = b.defId;
        b.defId = b.upgradingTo!;
        b.tier = targetDef.tier;
        b.upgradingTo = undefined;
        // 阶层招募：升级完成后自动将人力转为新建筑所需阶层。
        // defId 已切换 → occ 自动从 fromCls 释放旧人力、toCls 占新人力。
        // 只需确保 populationClasses[toCls] 有足够人数覆盖新占用。
        const toCls: PopulationClass = targetDef.classType ?? 'farmer';
        const toPeople = targetDef.cost.people ?? 0;
        if (toPeople > 0) {
          this.autoRecruitToClass(toCls, toPeople);
        }
        this.emitter.emit(STATE_EVENTS.BUILDING_UPGRADED, {
          instance: b, fromDefId: oldDefId, toDefId: b.defId,
        });
      };
      // ct<=0 means instant build (degenerate static-content case); complete in this tick
      if (time <= 0) {
        b.constructionProgress = 100;
        b.status = 'working';
        if (isUpgrade) finishUpgrade();
        else this.emitter.emit(STATE_EVENTS.BUILDING_COMPLETED, b);
        continue;
      }
      b.constructionProgress += (100 / time) * constructionSpeedMul;
      // 浮点累加可能停在 99.9999 而少建一天；以 99.999 为闸门兜底（DeepSeek findings）
      if (b.constructionProgress >= 99.999) {
        b.constructionProgress = 100;
        b.status = 'working';
        if (isUpgrade) finishUpgrade();
        else this.emitter.emit(STATE_EVENTS.BUILDING_COMPLETED, b);
      }
    }
  }

  private runCalendarEventsPhase(
    calBefore: ReturnType<typeof dayToCalendar>,
    calAfter: ReturnType<typeof dayToCalendar>,
  ): void {
    this.emitter.emit(STATE_EVENTS.DAY_TICK, this.state.currentDay);
    if (calAfter.season !== calBefore.season) {
      this.emitter.emit(STATE_EVENTS.SEASON_TICK, {
        season: calAfter.season,
        seasonName: SEASON_NAMES[calAfter.season] ?? 'unknown',
        year: calAfter.year,
      });
    }
    if (calAfter.year !== calBefore.year) {
      this.emitter.emit(STATE_EVENTS.YEAR_TICK, { year: calAfter.year });
    }
  }

  /** 当日产出 / 维护开销 → 资源 deltas（grain 等） */
  private runProductionTick(): void {
    // A2：每栋建筑按自己阶层的需求满足度打折（缺市集的工匠低效）
    const factorFor = (defId: string): number => buildingFulfillmentFactor(
      getBuildingDef(defId)?.classType,
      this.state.buildings,
      this.state.resources,
    );
    const result = computeProductionTick(
      this.state.buildings,
      getBuildingDef,
      this.state.activeModifiers,
      this.state.productionCarry,
      factorFor,
    );
    // 把本 tick 的小数残差留到下一 tick（Slice G hardening 分数累加器）
    this.state.productionCarry = result.fractionalCarry;
    if (Object.keys(result.deltas).length > 0) {
      this.applyDayDeltas(result.deltas);
    }
    this.emitter.emit(STATE_EVENTS.PRODUCTION_TICK, result);
  }

  /**
   * 推进 active decrees；阶段到期 → 应用 modifier / 扣下阶 cost / stall 处理。
   *
   * 关键不变量（DeepSeek 二审 #4）：循环开始前对 resources 取一次快照，每个 decree
   * 都基于同一份快照评估 affordability；扣费 deltas 累积到末尾一次性应用。这样多个
   * decree 同日推进时不再依赖 activeDecrees 的插入顺序——任意一个 decree 是否能
   * advance 只取决于"日初资源 vs 自己一阶 cost"。
   */
  private runDecreeTick(): void {
    const next: { id: string; currentStage: number; daysElapsed: number }[] = [];
    // 快照：所有 decree 同步评估的资源基准
    const resourcesSnapshot = { ...this.state.resources };
    const accumulatedDeltas: Partial<Record<ResourceId, number>> = {};
    for (const rec of this.state.activeDecrees) {
      const def = this.decrees.find(d => d.id === rec.id);
      if (!def) {
        // 未知 decree（数据丢失 / 已被移除）：保留但不推进，避免崩溃
        next.push(rec);
        continue;
      }
      const advance = tickActiveDecree(def, rec, resourcesSnapshot);
      if (advance === null) {
        // 未到期 OR 仍 stalled：daysElapsed +1（stall 状态下也累加，纯纯诊断用）
        next.push({ ...rec, daysElapsed: rec.daysElapsed + 1 });
        continue;
      }

      // 仅当 applyEffects=true 时才发 modifier 增删（防止 stall 重复 apply）
      if (advance.applyEffects) {
        for (const id of advance.modifiersToRemove) {
          this.removeModifier(id);
        }
        this.addModifier(advance.modifier);
      }

      if (advance.next === null) {
        // decree 完成 — v1.0 #2：记入 completedDecreeIds，给链路解锁用
        if (!this.state.completedDecreeIds.includes(rec.id)) {
          this.state.completedDecreeIds.push(rec.id);
        }
        this.emitter.emit(STATE_EVENTS.DECREE_COMPLETED, { decreeId: rec.id, fromStage: advance.fromStage });
        continue; // 不 push 进 next（从 active 列表移除）
      }

      if (advance.didStall) {
        // 首次卡住：保留 record（daysElapsed 推到 stage.days+1 sentinel），不扣 cost
        next.push({ id: rec.id, currentStage: advance.next.currentStage, daysElapsed: advance.next.daysElapsed });
        this.emitter.emit(STATE_EVENTS.DECREE_STALLED, { decreeId: rec.id, stage: advance.next.currentStage });
        continue;
      }

      // 正常 advance（含从 stall 中恢复的"补 advance"）：把下阶 cost 累积到末尾再应用
      for (const [k, v] of Object.entries(advance.costDeltas) as [ResourceId, number | undefined][]) {
        if (v === undefined) continue;
        accumulatedDeltas[k] = (accumulatedDeltas[k] ?? 0) + v;
      }
      next.push({ id: rec.id, currentStage: advance.next.currentStage, daysElapsed: advance.next.daysElapsed });
      this.emitter.emit(STATE_EVENTS.DECREE_ADVANCED, { decreeId: rec.id, fromStage: advance.fromStage, toStage: advance.next.currentStage });
    }
    this.state.activeDecrees = next;
    if (Object.keys(accumulatedDeltas).length > 0) {
      this.applyDayDeltas(accumulatedDeltas);
    }
  }

  /** 朝议事件采样 + 超时回退 */
  private runEventTick(): void {
    if (this.state.pendingEventId !== null) {
      // 已有挂起事件：检查是否超时
      const def = this.events.find(e => e.id === this.state.pendingEventId);
      if (def && this.state.pendingEventDayStart !== null) {
        const elapsed = this.state.currentDay - this.state.pendingEventDayStart;
        if (checkEventTimeout(def, elapsed) === 'pick0') {
          this.resolveEvent(0);
        }
      }
      return;
    }
    if (this.events.length === 0) return;
    // A-7：状态驱动事件节奏（替代固定 minDaysBetween）
    const daysSinceLast = this.state.currentDay - this.state.lastEventDay;
    // Fast path: skip state assessment during anti-combo window (unless force-trigger)
    if (daysSinceLast < DEFAULT_TEMPO_CONFIG.antiComboDays && daysSinceLast < DEFAULT_TEMPO_CONFIG.forceMaxDays) return;
    const grain = this.state.resources['grain'] ?? 0;
    const grainCap = Math.max(1, (this.state.resources['people'] ?? 20) * 5);
    const nationInput: NationStateInput = {
      crisisActive: this.state.crisisActive,
      npcCountries: this.state.npcCountries,
      grainCapacityRatio: grain / grainCap,
      goldAmount: this.state.resources['gold'] ?? 0,
    };
    const nationState = assessNationState(nationInput);
    // Discriminant 0x1F4E9 separates tempo stream from event-selection stream (avoids correlation)
    const tempoRng = createRng(this.state.rngSeed ^ (this.state.currentDay * 7919) ^ 0x1F4E9);
    const decision = shouldSampleEvent(daysSinceLast, nationState, tempoRng.next(), DEFAULT_TEMPO_CONFIG);
    if (!decision.shouldSample) return;
    // 按状态过滤事件池
    const filteredEvents = filterEventsByState(this.events, nationState);
    if (filteredEvents.length === 0) return;
    const metrics = this.computeMetrics();
    const id = sampleEventTrigger(filteredEvents, this.state.eventHistory, metrics);
    if (id === null) { this.tryTriggerRelic(); return; }
    this.state.pendingEventId = id;
    this.state.pendingEventDayStart = this.state.currentDay;
    this.emitter.emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: id });
  }

  /** C1：普通朝议无戏时，唤起下一个空闲古迹阶段（与朝议共用一条叙事流，互不抢占）。 */
  private tryTriggerRelic(): void {
    const readyRelic = this.state.relicSites.find(s => !s.done);
    if (!readyRelic) return;
    this.state.pendingEventId = `relic_${readyRelic.id}_s${readyRelic.stage}`;
    this.state.pendingEventDayStart = this.state.currentDay;
    this.emitter.emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: this.state.pendingEventId });
  }

  /** 用当前 state + activeModifiers 算 DSL/事件采样所需的国家级指标快照 */
  private computeMetrics(): CountryMetrics {
    const cal = dayToCalendar(this.state.currentDay);
    // Phase1：people 现在会真实增长 → population 直接取裸 people 资源（不再经 country_population_cap
    // 聚合，后者改作"住房上限"用于人口增长门槛，见 population.ts / runPopulationTick）。
    const population = this.state.resources['people'] ?? 0;
    const morale = applyModifiers(50, 'country_morale', this.state.activeModifiers);
    const wrath = clampSentiment(
      this.state.publicWrath + aggregateModifiers('country_wrath', this.state.activeModifiers).addSum,
    );
    const militaryPower = applyModifiers(0, 'country_military_power', this.state.activeModifiers);
    // RNG：每次 metrics 推进一步 rngSeed，保证 day-to-day 不同。
    // 用箭头包裹以防 createRng 实现被换成需要 this 的形式（DeepSeek 防御）。
    const rngHandle = createRng(this.state.rngSeed ^ this.state.currentDay);
    const sf = this.state.storyFlags;
    return {
      resources: this.state.resources,
      population,
      morale,
      wrath,
      militaryPower,
      year: cal.year,
      season: cal.season,
      dayOfYear: this.state.currentDay % 120,
      rng: () => rngHandle.next(),
      grade: this.state.grade,
      storyChapter: sf ? sf.chapter : -1,
      storyPowerAxis: sf ? sf.powerAxis : 0,
      storyResourceAxis: sf ? sf.resourceAxis : 0,
    };
  }

  /** 玩家点 choice 或 timeout 自动 0：清掉 pendingEventId + 应用 effects + 写 history */
  resolveEvent(choiceIdx: number): void {
    const id = this.state.pendingEventId;
    if (id === null) return;
    const def = this.events.find(e => e.id === id);
    this.state.pendingEventId = null;
    this.state.pendingEventDayStart = null;
    // 事件冷却起点：本次结算日（含找不到 def 的清理路径，避免坏 id 绕过冷却）
    this.state.lastEventDay = this.state.currentDay;
    if (!def) {
      // 静态数据找不到：仅清理状态
      this.emitter.emit(STATE_EVENTS.EVENT_RESOLVED, { eventId: id, choiceIdx, applied: false });
      return;
    }
    // C1：古迹合成事件走专用结算（一次性资源/民心/怨愤，不经永久 modifier）
    const relicMatch = /^relic_r(\d+)_s(\d+)$/.exec(id);
    if (relicMatch) {
      this.applyRelicChoice(Number(relicMatch[1]), Number(relicMatch[2]), choiceIdx);
      return;
    }
    const result = applyEventChoice(def, choiceIdx);
    for (const rid of result.modifiersToRemove) {
      this.removeModifier(rid);
    }
    if (result.modifierToAdd) {
      this.addModifier(result.modifierToAdd);
    }
    this.state.eventHistory.push(id);
    this.pushStoryAxis(def.choices?.[choiceIdx]?.storyAxisDelta); // Phase2：抉择悄悄推双轴
    // Phase3：'故事' 标签事件解决后记入进度（章节目标 advanceGoal 据此判定解锁）
    if (this.state.storyFlags && def.tags.includes('故事') && !this.state.storyFlags.storyEventsTriggered.includes(id)) {
      this.state.storyFlags.storyEventsTriggered.push(id);
    }
    this.emitter.emit(STATE_EVENTS.EVENT_RESOLVED, { eventId: id, choiceIdx, applied: true });
  }

  /** C1：结算一次古迹抉择并推进阶段；最后一阶段完成发 RELIC_RESOLVED。 */
  private applyRelicChoice(siteIdx: number, stageIdx: number, choiceIdx: number): void {
    const site = this.state.relicSites[siteIdx];
    if (!site || site.done || site.stage !== stageIdx) return;
    const adv = advanceRelic(site, choiceIdx);
    this.state.relicSites[siteIdx] = adv.site;
    const e = adv.effects;
    this.adjustWrath(e.wrathDelta, `relic_${site.chainId}`);
    this.adjustMorale(e.moraleDelta, `relic_${site.chainId}`);
    for (const [rid, v] of Object.entries(e.resources) as [ResourceId, number][]) {
      if (v) this.addResource(rid, v, 'relic');
    }
    if (e.renownDelta !== 0) {
      this.addModifier({
        id: `mod_relic_${site.id}_${stageIdx}`,
        name: `古迹之誉·${site.name}`,
        category: 'culture',
        stackable: true,
        effects: [{ target: 'country_renown', op: 'add', value: e.renownDelta }],
        visualBadge: null,
        remainingDays: -1,
        description: '探得古迹，邦誉有加。',
        descPlain: '探得古迹，邦誉有加。',
      });
    }
    this.state.eventHistory.push(`relic_${site.id}_s${stageIdx}`);
    if (adv.completed) {
      this.emitter.emit(STATE_EVENTS.RELIC_RESOLVED, { name: site.name, summary: e.summary });
    }
    this.emitter.emit(STATE_EVENTS.EVENT_RESOLVED, {
      eventId: `relic_${site.id}_s${stageIdx}`, choiceIdx, applied: true,
    });
  }

  /** 玩家采纳 policy；返回 result 给 UI（成功 / 失败原因） */
  adoptPolicy(policyId: string): AdoptPolicyResult {
    const def = this.policies.find(p => p.id === policyId);
    if (!def) return { ok: false, reason: 'unknown_policy' };
    const adoptedSet = this.getAdoptedPolicyIds();
    const result = tryAdoptPolicy(def, adoptedSet, this.state.resources);
    if (!result.ok) return result;

    // 落盘：扣资源 / 推进 policies 列表 / addModifier
    this.applyDayDeltas(result.deltas);
    const existing = this.state.policies.find(p => p.id === policyId);
    if (existing) existing.adopted = true;
    else this.state.policies.push({ id: policyId, adopted: true });
    this.addModifier(result.modifier);
    this.pushStoryAxis(def.storyAxisDelta); // Phase2：国策推双轴
    this.emitter.emit(STATE_EVENTS.POLICY_ADOPTED, { policyId });
    this.historianIdleDays = 0;
    this.autoUnpause();
    return result;
  }

  /** 玩家采纳 decree；返回 result 给 UI */
  adoptDecree(decreeId: string): AdoptDecreeResult {
    const def = this.decrees.find(d => d.id === decreeId);
    if (!def) return { ok: false, reason: 'unknown_decree' };
    const metrics = this.computeMetrics();
    const result = tryAdoptDecree(
      def,
      this.state.activeDecrees,
      this.state.resources,
      metrics,
      this.state.completedDecreeIds,
    );
    if (!result.ok) return result;

    this.applyDayDeltas(result.deltas);
    this.state.activeDecrees.push({ ...result.activeRecord });
    this.pushStoryAxis(def.storyAxisDelta); // Phase2：朝令推双轴
    this.emitter.emit(STATE_EVENTS.DECREE_ADOPTED, { decreeId });
    this.historianIdleDays = 0;
    this.autoUnpause();
    return result;
  }

  // ============== v1.0 #6：NPC 邦国 / 邦交 ===============================

  getNpcCountries(): readonly NpcCountryState[] {
    return Object.freeze(this.state.npcCountries.map(s => ({ ...s })));
  }

  getPlayerMorale(): number { return this.state.playerMorale; }
  /** A2：各阶层当前未满足的需求名（供人口面板显示缺口）。 */
  getClassNeedsGaps(): Record<PopulationClass, string[]> {
    const out = {} as Record<PopulationClass, string[]>;
    for (const cls of POPULATION_CLASSES) {
      out[cls] = computeClassNeedState(cls, this.state.buildings, this.state.resources).unmet;
    }
    return out;
  }
  /** 现行怨愤 = 明文状态 + country_wrath modifier 累加（让朝令/事件能推动米值），clamp 0..100。 */
  getPublicWrath(): number {
    return clampSentiment(
      this.state.publicWrath + aggregateModifiers('country_wrath', this.state.activeModifiers).addSum,
    );
  }
  getWorldWariness(): number { return this.state.worldWariness; }
  /** B1：邦交面板用的警惕值快照（值 + 档位文案 + 最近原因）。 */
  getWarinessInfo(): { value: number; band: WarinessBand; reason: string | null } {
    return {
      value: this.state.worldWariness,
      band: warinessBand(this.state.worldWariness),
      reason: this.state.lastWarinessReason,
    };
  }
  /** B2：名望（影响力）现值与上限（上限随国格涨，逼着玩家花，不然就浪费）。 */
  getInfluence(): number { return this.state.resources['influence'] ?? 0; }
  getInfluenceCap(): number { return 40 + this.state.grade * 30; }
  /** 名望支出：不足返回 false（调用方各自提示）。 */
  private spendInfluence(cost: number): boolean {
    if (this.getInfluence() < cost) return false;
    this.addResource('influence', -cost, 'influence_spend');
    return true;
  }
  /** B2·宣传：短期压民怨、涨民心；7 日内重复使用效果减半（粉饰不能持久）。 */
  spendPropaganda(): { ok: boolean; reason?: string; diminished?: boolean } {
    const COST = 20;
    if (!this.spendInfluence(COST)) return { ok: false, reason: '名望不足' };
    const recent = this.state.lastPropagandaDay !== null
      && this.state.currentDay - this.state.lastPropagandaDay < 7;
    this.adjustWrath(recent ? -6 : -12, 'propaganda');
    this.adjustMorale(recent ? 3 : 6, 'propaganda');
    this.state.lastPropagandaDay = this.state.currentDay;
    return { ok: true, diminished: recent };
  }
  /** B2·斡旋：花名望降低列国警惕值。 */
  spendDiplomacyInfluence(): { ok: boolean; reason?: string } {
    if (!this.spendInfluence(15)) return { ok: false, reason: '名望不足' };
    this.adjustWariness(-8, '遣使斡旋');
    return { ok: true };
  }
  /** B2·修史：花名望换来 30 日信誉加成（进行中不可重复）。 */
  spendChronicle(): { ok: boolean; reason?: string } {
    if (this.state.activeModifiers.some(m => m.id === 'mod_chronicle_renown')) {
      return { ok: false, reason: '修史未竟，不可重开' };
    }
    if (!this.spendInfluence(25)) return { ok: false, reason: '名望不足' };
    this.addModifier({
      id: 'mod_chronicle_renown',
      name: '修史之誉',
      category: 'culture',
      stackable: false,
      effects: [{ target: 'country_renown', op: 'add', value: 8 }],
      visualBadge: null,
      remainingDays: 30,
      description: '史官秉笔，邦誉渐隆。',
      descPlain: '史官修史，30 日内信誉 +8。',
    });
    return { ok: true };
  }
  /** 调整怨愤（clamp 0..100），变化时发 WRATH_CHANGED 供 HUD 双米刷新。 */
  private adjustWrath(delta: number, reason: string): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    const before = this.state.publicWrath;
    this.state.publicWrath = clampSentiment(this.state.publicWrath + delta);
    if (this.state.publicWrath !== before) {
      this.emitter.emit(STATE_EVENTS.WRATH_CHANGED, { value: this.state.publicWrath, reason });
    }
  }
  /** 调整民心（clamp 0..100），变化时发 MORALE_CHANGED 供 HUD 米刷新。 */
  private adjustMorale(delta: number, reason: string): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    const before = this.state.playerMorale;
    this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale + delta));
    if (this.state.playerMorale !== before) {
      this.emitter.emit(STATE_EVENTS.MORALE_CHANGED, { value: this.state.playerMorale, reason });
    }
  }
  /** 调整列国警惕值（clamp 0..100），变化时发 WORLD_WARINESS_CHANGED。 */
  private adjustWariness(delta: number, reason: string): void {
    if (!Number.isFinite(delta) || delta === 0) return;
    const before = this.state.worldWariness;
    this.state.worldWariness = clampWariness(this.state.worldWariness + delta);
    if (this.state.worldWariness !== before) {
      this.state.lastWarinessReason = reason;
      this.emitter.emit(STATE_EVENTS.WORLD_WARINESS_CHANGED, { value: this.state.worldWariness, reason });
    }
  }
  getPlayerMilitaryPower(): number { return this.state.playerMilitaryPower; }
  /** 国家级声誉（renown）：聚合 modifier 系统的 country_renown，base = 50 */
  getPlayerRenown(): number {
    return applyModifiers(50, 'country_renown', this.state.activeModifiers);
  }

  // Phase1 模式外壳：仅记录玩法模式，沙盒/故事外壳用；不 emit（无 UI 实时依赖）
  getMode(): 'sandbox' | 'story' { return this.state.mode; }
  setMode(mode: 'sandbox' | 'story'): void { this.state.mode = mode; }

  private findNpcState(id: string): NpcCountryState | undefined {
    return this.state.npcCountries.find(s => s.id === id);
  }

  private applyDiplomacyResult(npcId: string, result: DiplomacyResult, kind: 'trade' | 'envoy' | 'war'): DiplomacyResult {
    if (!result.ok) return result;
    const npcState = this.findNpcState(npcId)!;
    Object.assign(npcState, result.stateDelta);
    // stance / militaryPower / renown clamp（防溢出）
    npcState.stance = Math.max(-100, Math.min(100, npcState.stance));
    npcState.militaryPower = Math.max(0, Math.min(500, npcState.militaryPower));
    npcState.renown = Math.max(0, Math.min(200, npcState.renown));
    if (Object.keys(result.resourceDeltas).length > 0) {
      this.applyDayDeltas(result.resourceDeltas);
    }
    if (result.playerDeltas.morale !== undefined) {
      this.adjustMorale(result.playerDeltas.morale, 'diplomacy');
    }
    if (result.playerDeltas.militaryPower !== undefined) {
      this.state.playerMilitaryPower = Math.max(0, Math.min(500, this.state.playerMilitaryPower + result.playerDeltas.militaryPower));
    }
    // renown 通过临时 modifier 加（因为 renown 走 modifier 聚合）
    if (result.playerDeltas.renown !== undefined && result.playerDeltas.renown !== 0) {
      this.addModifier({
        id: `mod_diplomacy_renown_${kind}_${npcId}_${this.state.currentDay}`,
        name: kind === 'trade' ? '通商之誉' : kind === 'envoy' ? '使节之誉' : '征伐之誉',
        category: 'diplomacy',
        stackable: true,
        effects: [{ target: 'country_renown', op: 'add', value: result.playerDeltas.renown }],
        visualBadge: null,
        remainingDays: -1,
        description: result.message,
        descPlain: result.message,
      });
    }
    this.emitter.emit(STATE_EVENTS.DIPLOMACY_ACTION, { npcId, kind, result });
    // B1：宣战升警惕、通商/出使降警惕（放在结算之后，UI 读终态）
    if (kind === 'war') this.adjustWariness(WARINESS_DELTAS.declareWar, '兴师宣战');
    else this.adjustWariness(WARINESS_DELTAS.peaceAction, kind === 'trade' ? '通商睦邻' : '遣使修好');
    return result;
  }

  tradeWithNpc(npcId: string): DiplomacyResult {
    const def = getNpcDef(npcId);
    if (!def) return { ok: false, reason: 'unknown_npc' };
    const state = this.findNpcState(npcId);
    if (!state) return { ok: false, reason: 'unknown_npc' };
    const result = tryTrade(def, state, this.state.resources);
    return this.applyDiplomacyResult(npcId, result, 'trade');
  }

  sendEnvoyTo(npcId: string): DiplomacyResult {
    const def = getNpcDef(npcId);
    if (!def) return { ok: false, reason: 'unknown_npc' };
    const state = this.findNpcState(npcId);
    if (!state) return { ok: false, reason: 'unknown_npc' };
    const result = trySendEnvoy(def, state, this.state.resources, this.state.currentDay);
    return this.applyDiplomacyResult(npcId, result, 'envoy');
  }

  declareWarOn(npcId: string, rng?: () => number): DiplomacyResult {
    const def = getNpcDef(npcId);
    if (!def) return { ok: false, reason: 'unknown_npc' };
    const state = this.findNpcState(npcId);
    if (!state) return { ok: false, reason: 'unknown_npc' };
    const rngFn = rng ?? createRng(this.state.rngSeed ^ this.state.currentDay ^ 0xdeadbeef).next;
    // P4：用"军队派生军力"而非旧静态标量——兵/军事建筑/将领越强，兴师胜率越高。
    const result = tryDeclareWar(def, state, this.computeCurrentMilitaryPower(), this.state.currentDay, rngFn);
    return this.applyDiplomacyResult(npcId, result, 'war');
  }

  /** 每日：通商节拍 + stance 漂移；放在 tickDay 末尾跑 */
  private runDiplomacyTick(): void {
    const playerRenown = this.getPlayerRenown();
    const aggregateDeltas: Partial<Record<ResourceId, number>> = {};
    let tradeIncomeFired = false;
    for (const npcState of this.state.npcCountries) {
      const def = getNpcDef(npcState.id);
      if (!def) continue;
      // 通商
      const tick = computeTradeTick(def, npcState);
      Object.assign(npcState, tick.stateDelta);
      for (const [k, v] of Object.entries(tick.resourceDeltas) as [ResourceId, number | undefined][]) {
        if (v === undefined || v === 0) continue;
        aggregateDeltas[k] = (aggregateDeltas[k] ?? 0) + v;
        tradeIncomeFired = true;
      }
      // stance 漂移
      const drift = computeStanceDrift(def, npcState, playerRenown);
      if (drift !== 0) {
        npcState.stance = Math.max(-100, Math.min(100, npcState.stance + drift));
      }
    }
    if (Object.keys(aggregateDeltas).length > 0) {
      this.applyDayDeltas(aggregateDeltas);
    }
    if (tradeIncomeFired) {
      this.emitter.emit(STATE_EVENTS.TRADE_TICK, { deltas: aggregateDeltas });
    }
  }

  // ============== Phase1：国格阶梯 ==============

  getGrade(): number { return this.state.grade; }
  getGradeReached(): number { return this.state.gradeReached; }
  getGradeDef() { return gradeDefAt(this.state.grade); }

  /** NPC 邦交"友好"阈值：stance ≥ 20（与 stanceLabel 的"友好"档一致） */
  private static readonly NPC_FRIENDLY_STANCE = 20;

  /** 收集国格判定所需快照（人口口径与 computeMetrics 一致）。 */
  private buildGradeInput(): GradeInput {
    // Phase1：国格人口门槛用裸 people（与 computeMetrics 一致）；country_population_cap 改作住房上限。
    const population = this.state.resources['people'] ?? 0;
    const builtDefIds = new Set<string>();
    for (const b of this.state.buildings) {
      if (b.status === 'working') builtDefIds.add(b.defId);
    }
    const diplomacyFlags = new Set<string>();
    if (this.state.npcCountries.length > 0
      && this.state.npcCountries.every(n => n.stance >= GameStore.NPC_FRIENDLY_STANCE)) {
      diplomacyFlags.add(DIPLO_FLAG_ALL_FRIENDLY);
    }
    return {
      population,
      resources: this.state.resources,
      builtDefIds,
      adoptedPolicyIds: this.getAdoptedPolicyIds(),
      completedDecreeIds: new Set(this.state.completedDecreeIds),
      diplomacyFlags,
    };
  }

  /** 每日：综合门槛 + 标志成就都满足 → 晋一级国格（一次最多 +1，不降级）。 */
  private runGradeTick(): void {
    // 终局免扫：已是天下共主无可再升，跳过整套建筑/资源扫描。
    if (this.state.grade >= MAX_GRADE) return;
    // 危机恢复期不晋阶：避免"国势倾颓"当 tick 又立刻"国格晋阶"的矛盾，
    // 也契合"崩溃后励精图治、缓过来才谈晋升"的语义。crisisActive 在双正 30 日后自动解除。
    if (this.state.crisisActive) return;
    const next = evaluateGrade(this.state.grade, this.buildGradeInput());
    if (next <= this.state.grade) return;
    const from = this.state.grade;
    this.state.grade = next;
    if (next > this.state.gradeReached) this.state.gradeReached = next;
    this.historianGradeAscended = true;
    this.adjustWariness(WARINESS_DELTAS.gradeAscend, '国格晋阶');
    this.emitter.emit(STATE_EVENTS.GRADE_CHANGED, {
      from, to: next, def: gradeDefAt(next), reason: 'ascend',
    });
    if (next >= MAX_GRADE && !this.state.tianxiaAcknowledged) {
      this.state.tianxiaAcknowledged = true;
      this.emitter.emit(STATE_EVENTS.TIANXIA_ACKNOWLEDGED, { def: gradeDefAt(next) });
    }
  }

  // ============== B-4.1：阶层博弈 ==============

  /**
   * 监察台（bld_censor）加成：每座 working 监察台让阶层诉求间隔拉长 30%（"处理效率 +30%"→诉求更稀、少烦你）。
   * 多座叠乘但封顶 2.0（最多间隔翻倍），避免堆监察台后诉求几乎绝迹。
   */
  private factionIntervalFactor(): number {
    const censors = this.state.buildings.filter(b => b.defId === 'bld_censor' && b.status === 'working').length;
    if (censors <= 0) return 1;
    return Math.min(2.0, Math.pow(1.3, censors));
  }

  private runFactionTick(): void {
    const people = this.state.resources['people'] ?? 0;
    const hadDemand = this.state.factionState.activeDemand !== null;
    const rngHandle = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0xfac7) >>> 0);
    const next = tickFaction(this.state.factionState, people, this.state.currentDay, rngHandle, this.factionIntervalFactor());
    this.state.factionState = next;
    // B-4.1：新诉求出现（null→有）时通知 UI 弹窗（之前从不 emit → 静默死锁，玩家永远看不到）
    if (!hadDemand && next.activeDemand) {
      this.emitter.emit(STATE_EVENTS.FACTION_DEMAND_TRIGGERED, {
        demand: next.activeDemand,
        factionName: FACTION_NAMES[next.activeDemand.factionId],
      });
    }
  }

  resolveFactionDemand(accepted: boolean): void {
    const demand = this.state.factionState.activeDemand;
    if (!demand) return;
    const { effect, demandId } = resolveDemand(demand, accepted);
    if (accepted) {
      this.state.factionState.acceptedDemands.push(demandId);
    } else {
      this.state.factionState.rejectedDemands.push(demandId);
    }
    this.adjustWrath(
      accepted ? WRATH_DEMAND_ACCEPTED : WRATH_DEMAND_REJECTED,
      accepted ? 'demand_accepted' : 'demand_rejected',
    );
    this.state.factionState.activeDemand = null;
    const fRng = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0xfac8) >>> 0);
    this.state.factionState.nextEventDay = scheduleFactionEvent(this.state.currentDay, fRng, this.factionIntervalFactor());
    const moraleDelta = (effect.morale ?? 0) + (effect.loyaltyDelta ?? 0);
    if (moraleDelta !== 0) {
      this.adjustMorale(moraleDelta, 'faction');
    }
    if (effect.axisShift && this.state.storyFlags) {
      if (effect.axisShift.axis === 'power') {
        this.state.storyFlags.powerAxis = Math.max(-100, Math.min(100, this.state.storyFlags.powerAxis + effect.axisShift.delta));
      } else {
        this.state.storyFlags.resourceAxis = Math.max(-100, Math.min(100, this.state.storyFlags.resourceAxis + effect.axisShift.delta));
      }
    }
    // 资源/研究类后果（如豪强减赋 goldMul、士人拒绝 researchMul）此前被算出却从不落地——
    // 用永久 modifier 真正生效，否则选择是空的。goldMul=-0.2 → 产金 ×0.8。
    if (effect.goldMul) {
      this.addModifier(this.makeFactionModifier(demandId, 'country_gold_output', 1 + effect.goldMul, '阶层博弈·赋税'));
    }
    if (effect.researchMul) {
      this.addModifier(this.makeFactionModifier(demandId, 'country_research_speed', 1 + effect.researchMul, '阶层博弈·学问'));
    }
    this.emitter.emit(STATE_EVENTS.FACTION_DEMAND_RESOLVED, { demandId, accepted });
  }

  /** B-4.1：把阶层诉求的乘法后果包成永久 modifier。 */
  private makeFactionModifier(demandId: string, target: ModifierTargetKey, value: number, name: string): ModifierInstance {
    return {
      id: `faction_${demandId}_${target}`, name, category: 'economy', stackable: false,
      effects: [{ target, op: 'mul', value }], visualBadge: null, remainingDays: -1,
      description: name, descPlain: name,
    };
  }

  getFactionState(): Readonly<FactionState> { return { ...this.state.factionState }; }

  // ============== B-4.2：巨型工程 ==============

  private runMegaProjectTick(): void {
    if (this.state.megaProjects.length === 0) return;
    const updated: MegaProjectProgress[] = [];
    for (const prog of this.state.megaProjects) {
      if (prog.completed) { updated.push(prog); continue; }
      const def = MEGA_PROJECTS.find(p => p.id === prog.projectId);
      if (!def) { updated.push(prog); continue; }
      const phaseDef = def.phases[prog.currentPhase];
      if (!phaseDef) { updated.push(prog); continue; }
      // 阶段首日扣费（daysRemaining 等于阶段总天数 = 刚进入该阶段）
      const isPhaseStart = prog.daysRemaining === phaseDef.durationDays;
      if (isPhaseStart) {
        if (!canAffordPhase(def, prog.currentPhase, this.state.resources)) {
          updated.push(prog);
          continue;
        }
        for (const [res, amount] of Object.entries(phaseDef.cost)) {
          if (amount && amount > 0) {
            this.addResource(res as ResourceId, -amount, 'mega_project');
          }
        }
      }
      const next = tickProject(prog);
      if (next.completed && !prog.completed) {
        const reward = getProjectReward(prog.projectId);
        if (reward) {
          if (reward.renown) {
            const renowMod: ModifierInstance = {
              id: `megaproj_${prog.projectId}_renown`,
              name: def.name + '（声望）',
              category: 'economy',
              stackable: false,
              effects: [{ target: 'country_renown', op: 'add', value: reward.renown }],
              visualBadge: null,
              remainingDays: -1,
              description: def.name + '功成，天下仰望。',
              descPlain: def.name + '完工，声望大增。',
            };
            this.state.activeModifiers.push(renowMod);
          }
          if (reward.productionMul) {
            const prodMod: ModifierInstance = {
              id: `megaproj_${prog.projectId}_prod`,
              name: def.name + '（产出）',
              category: 'economy',
              stackable: false,
              effects: [{ target: 'country_grain_output', op: 'mul', value: reward.productionMul }],
              visualBadge: null,
              remainingDays: -1,
              description: def.name + '贯通四方，百工兴旺。',
              descPlain: def.name + '完工，产出提升。',
            };
            this.state.activeModifiers.push(prodMod);
          }
          if (reward.tradeMul) {
            const tradeMod: ModifierInstance = {
              id: `megaproj_${prog.projectId}_trade`,
              name: def.name + '（贸易）',
              category: 'economy',
              stackable: false,
              effects: [{ target: 'country_gold_output', op: 'mul', value: reward.tradeMul }],
              visualBadge: null,
              remainingDays: -1,
              description: def.name + '通达天下，商贾辐辏。',
              descPlain: def.name + '完工，贸易收入提升。',
            };
            this.state.activeModifiers.push(tradeMod);
          }
        }
        this.emitter.emit(STATE_EVENTS.MEGA_PROJECT_COMPLETED, { projectId: prog.projectId, def, reward });
      }
      updated.push(next);
    }
    this.state.megaProjects = updated;
  }

  getMegaProjects(): readonly MegaProjectProgress[] { return this.state.megaProjects; }

  startMegaProject(projectId: string): boolean {
    const def = MEGA_PROJECTS.find(p => p.id === projectId);
    if (!def || def.phases.length === 0) return false;
    if (this.state.megaProjects.some(p => p.projectId === projectId)) return false;
    if (def.prerequisiteBuilding && !this.state.buildings.some(b => b.defId === def.prerequisiteBuilding)) return false;
    this.state.megaProjects.push({
      projectId,
      currentPhase: 0,
      daysRemaining: def.phases[0]!.durationDays,
      completed: false,
    });
    this.emitter.emit(STATE_EVENTS.MEGA_PROJECT_STARTED, { projectId, def });
    return true;
  }

  // ============== B-1 / B-2：军事 + 将领（P4 接入，此前为死代码） ==============

  private militaryContext(): MilitaryContext {
    return {
      grade: this.state.grade,
      buildings: this.state.buildings,
      adoptedPolicies: this.getAdoptedPolicyIds(),
      soldierCount: this.availableSoldiers(),
      grain: this.state.resources['grain'] ?? 0,
    };
  }

  /** 可调遣的兵 = 兵阶层 − 已在出征中的兵（防重复派同一批）。 */
  private availableSoldiers(): number {
    const onExpedition = this.state.activeExpeditions.reduce(
      (s, e) => s + Object.values(e.config.units).reduce((a, n) => a + (n ?? 0), 0), 0);
    return Math.max(0, this.state.populationClasses.soldier - onExpedition);
  }

  /** 常备军力：基础征召 + 兵阶层×可用最强兵种攻击×最强将领指挥，再经 country_military_power modifier。
   *  让"兵阶层 + 军事建筑 + 将领"真正驱动军力（此前是与之无关的标量）。 */
  computeCurrentMilitaryPower(): number {
    const soldiers = this.state.populationClasses.soldier;
    const available = getAvailableUnitTypes(this.militaryContext());
    const bestAtk = available.length
      ? Math.max(...available.map(u => UNIT_DEFS[u].attack))
      : UNIT_DEFS.militia.attack;
    const bestCmd = this.state.generals.reduce((m, g) => Math.max(m, getGeneralDef(g.id)?.command ?? 0), 0);
    const raw = 20 + soldiers * bestAtk * (1 + bestCmd / 100); // 20=无常备兵时的乡勇守土基数
    return Math.round(applyModifiers(raw, 'country_military_power', this.state.activeModifiers));
  }

  getGenerals(): readonly GeneralState[] { return this.state.generals; }
  hasAvailableGeneral(): boolean { return this.state.generals.some(g => !g.deployed); }
  getActiveExpeditions(): readonly ActiveExpedition[] { return this.state.activeExpeditions; }
  getDefenseAlerts(): readonly DefenseAlert[] { return this.state.defenseAlerts; }
  getAvailableUnitTypesForUi(): UnitType[] { return getAvailableUnitTypes(this.militaryContext()); }
  getDeployableSoldiers(): number { return this.availableSoldiers(); }

  /** 可招募将领（池中未招 + 未满编）。 */
  getRecruitableGenerals(): readonly { id: string; name: string; command: number }[] {
    if (!canRecruit(this.state.generals)) return [];
    const have = new Set(this.state.generals.map(g => g.id));
    return GENERAL_POOL.filter(g => !have.has(g.id)).map(g => ({ id: g.id, name: g.name, command: g.command }));
  }

  recruitGeneral(id: string): boolean {
    if (!canRecruit(this.state.generals)) return false;
    if (this.state.generals.some(g => g.id === id) || !getGeneralDef(id)) return false;
    const COST = 40;
    if ((this.state.resources['gold'] ?? 0) < COST) return false;
    this.addResource('gold', -COST, 'recruit_general');
    this.state.generals = recruitGeneralFn(id, this.state.generals);
    this.emitter.emit(STATE_EVENTS.GENERALS_CHANGED, { id });
    return true;
  }

  dismissGeneral(id: string): boolean {
    const g = this.state.generals.find(x => x.id === id);
    if (!g) return false;
    if (g.deployed) return false; // 出征中不可遣散（防 activeExpeditions 悬空 generalId）
    this.state.generals = dismissGeneralFn(id, this.state.generals);
    this.emitter.emit(STATE_EVENTS.GENERALS_CHANGED, { id });
    return true;
  }

  launchExpedition(config: ExpeditionConfig): { ok: boolean; reason?: string } {
    const check = canLaunchExpedition(config, this.militaryContext());
    if (!check.ok) return check;
    if (config.generalId && !this.state.generals.some(g => g.id === config.generalId && !g.deployed)) {
      return { ok: false, reason: 'general_unavailable' };
    }
    this.addResource('grain', -config.grainAllocated, 'expedition');
    if (config.generalId) this.state.generals = deployGeneralFn(config.generalId, this.state.generals);
    const rng = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0x6217) >>> 0);
    this.state.activeExpeditions.push(createExpedition(config, rng));
    this.emitter.emit(STATE_EVENTS.MILITARY_CHANGED, {});
    return { ok: true };
  }

  private runMilitaryTick(): void {
    // 1. 常备军力随兵/建筑/将领刷新（NPC/外交据此判断）
    this.state.playerMilitaryPower = this.computeCurrentMilitaryPower();
    // 2. 出征推进 + 到期结算
    if (this.state.activeExpeditions.length > 0) {
      const grain = this.state.resources['grain'] ?? 0;
      const ongoing: ActiveExpedition[] = [];
      for (const exp of this.state.activeExpeditions) {
        const ticked = tickExpedition(exp, grain);
        if (ticked.daysRemaining > 0) { ongoing.push(ticked); continue; }
        this.resolveExpedition(ticked);
      }
      this.state.activeExpeditions = ongoing;
    }
    // 3. 来犯预警倒计时 + 结算
    if (this.state.defenseAlerts.length > 0) {
      const remaining: DefenseAlert[] = [];
      for (const alert of this.state.defenseAlerts) {
        const next = { ...alert, daysUntilAttack: alert.daysUntilAttack - 1 };
        if (next.daysUntilAttack > 0) { remaining.push(next); continue; }
        this.resolveIncomingAttack(next);
      }
      this.state.defenseAlerts = remaining;
    }
    // 4. 每月将领忠诚衰减 + 叛逃
    if (this.state.currentDay > 0 && this.state.currentDay % 30 === 0 && this.state.generals.length > 0) {
      const rng = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0x10a1) >>> 0);
      const { generals, defected } = tickLoyalty(this.state.generals, rng);
      this.state.generals = generals;
      if (defected.length > 0) this.emitter.emit(STATE_EVENTS.GENERALS_CHANGED, { defected });
    }
    // 5. 偶发来犯预警：敌对(stance<-40)且更强的邻国可能来犯，给 3 日反应窗口。低频，避免压垮玩家。
    //    玩家的"应对"=平时养兵——有兵则守土结算，无兵则被劫掠（见 resolveIncomingAttack）。
    if (this.state.defenseAlerts.length === 0 && this.state.currentDay > 0) {
      const rng = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0xa1e27) >>> 0);
      if (rng.next() < 0.012) {
        const hostile = this.state.npcCountries.filter(n => n.stance < -40 && n.militaryPower > this.state.playerMilitaryPower);
        if (hostile.length > 0) {
          const pick = hostile[rng.nextInt(0, hostile.length - 1)]!;
          const alert: DefenseAlert = { npcId: pick.id, daysUntilAttack: 3, npcStrength: pick.militaryPower };
          this.state.defenseAlerts.push(alert);
          this.emitter.emit(STATE_EVENTS.DEFENSE_ALERT, { alert });
        }
      }
    }
  }

  private resolveExpedition(exp: ActiveExpedition): void {
    const npc = this.findNpcState(exp.config.npcId);
    const bonus = exp.config.generalId ? computeGeneralBonus(exp.config.generalId) : null;
    const myStrength = computeArmyStrength(exp.config.units, exp.morale, bonus?.command) * (bonus?.attackMul ?? 1);
    const enemyStrength = npc?.militaryPower ?? 30;
    const totalUnits = Object.values(exp.config.units).reduce((s, n) => s + (n ?? 0), 0);
    const rng = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0xba77e) >>> 0);
    const r = resolveBattle(myStrength, enemyStrength, totalUnits, rng, false);
    if (r.lootGrain > 0) this.addResource('grain', r.lootGrain, 'war_loot');
    if (r.lootGold > 0) this.addResource('gold', r.lootGold, 'war_loot');
    if (r.unitsLost > 0) this.killSoldiers(r.unitsLost);
    if (npc) npc.stance = Math.max(-100, Math.min(100, npc.stance + r.npcStanceDelta));
    if (r.renownGain !== 0) {
      this.addModifier({
        id: `war_renown_${this.state.currentDay}_${exp.config.npcId}`, name: '战功声望', category: 'military', stackable: true,
        effects: [{ target: 'country_renown', op: 'add', value: r.renownGain }], visualBadge: null,
        remainingDays: -1, description: '战功声望', descPlain: '战功声望',
      });
    }
    if (exp.config.generalId) {
      this.state.generals = applyBattleResult(this.state.generals, exp.config.generalId, r.outcome !== 'defeat');
      this.state.generals = returnGeneralFn(exp.config.generalId, this.state.generals);
    }
    this.emitter.emit(STATE_EVENTS.EXPEDITION_RESOLVED, { result: r, npcId: exp.config.npcId, target: exp.config.target });
  }

  private resolveIncomingAttack(alert: DefenseAlert): void {
    // 守土只算"不在外出征的兵"（出征在外的兵不能同时守家——修 DeepSeek 一兵两用）。
    const soldiers = this.availableSoldiers();
    const rng = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0xdefe2) >>> 0);
    if (soldiers <= 0) {
      const loss = computeNoInterceptLoss({
        grain: this.state.resources['grain'] ?? 0, gold: this.state.resources['gold'] ?? 0, people: this.state.resources['people'] ?? 0,
      }, rng);
      if (loss.grainLost > 0) this.addResource('grain', -loss.grainLost, 'raided');
      if (loss.goldLost > 0) this.addResource('gold', -loss.goldLost, 'raided');
      if (loss.peopleLost > 0) {
        this.shrinkPopulationClasses(loss.peopleLost);
        this.setResourceClamped('people', totalPopulation(this.state.populationClasses));
      }
      this.emitter.emit(STATE_EVENTS.EXPEDITION_RESOLVED, { defense: true, intercepted: false, npcId: alert.npcId });
      return;
    }
    // 守军以"现有最强可用兵种"列阵（而非恒按民兵），让练兵场/马厩等防御也增益。
    const available = getAvailableUnitTypes(this.militaryContext());
    const bestDef: UnitType = available.length
      ? available.reduce((a, b) => (UNIT_DEFS[b].defense > UNIT_DEFS[a].defense ? b : a))
      : 'militia';
    const myDef = computeDefenseStrength({ [bestDef]: soldiers }, 80);
    const r = resolveBattle(myDef, alert.npcStrength, soldiers, rng, true);
    if (r.unitsLost > 0) this.killSoldiers(r.unitsLost);
    this.emitter.emit(STATE_EVENTS.EXPEDITION_RESOLVED, { defense: true, intercepted: true, result: r, npcId: alert.npcId });
  }

  /** 战损：从兵阶层扣，并同步 people。 */
  private killSoldiers(n: number): void {
    const lost = Math.min(this.state.populationClasses.soldier, Math.max(0, Math.floor(n)));
    if (lost <= 0) return;
    this.state.populationClasses.soldier -= lost;
    this.addResource('people', -lost, 'war_loss');
  }

  // ============== B-4.3：互斥国策 ==============

  getExclusivePolicies(): readonly string[] { return this.state.exclusivePolicies; }

  adoptExclusivePolicy(policyId: string): boolean {
    const excluded = getExcludedPolicyId(policyId);
    if (excluded === undefined) return false;
    const group = POLICY_EXCLUSION_GROUPS.find(g =>
      g.policies[0].id === policyId || g.policies[1].id === policyId);
    if (!group) return false;
    if (this.state.grade < group.minGrade) return false;
    if (this.state.exclusivePolicies.includes(policyId)) return false;
    const idx = this.state.exclusivePolicies.indexOf(excluded);
    if (idx >= 0) this.state.exclusivePolicies.splice(idx, 1);
    this.state.exclusivePolicies.push(policyId);
    return true;
  }

  // ============== Phase2：故事导演层（仅 story 模式） ==============

  getStoryFlags(): Readonly<StoryFlags> | null {
    return this.state.storyFlags ? { ...this.state.storyFlags } : null;
  }

  /** 进故事模式：初始化 storyFlags = 序章态 + 应用故事双表起始资源（覆盖沙盒基线）。IntroScene 立国时调。 */
  startStoryMode(): void {
    this.state.mode = 'story';
    this.state.storyFlags = {
      chapter: 0,
      unifyPath: null,
      unified: false,
      powerAxis: 0,
      resourceAxis: 0,
      storyEventsTriggered: [],
      chapterStartDay: this.state.currentDay,
      ending: null,
    };
    // §8.1 双表：故事起始资源覆盖（main.ts 已发沙盒基线，这里改写为故事 drama 基线）
    const start = getBalanceConfig('story').startingResources;
    for (const id of RESOURCE_IDS) {
      const v = start[id];
      if (v !== undefined) this.setResourceClamped(id, v);
    }
  }

  /** 每日故事 tick：序章未统一时判定多途径统一，达成则播种双轴 + emit STORY_UNIFIED（场景接管跳变）。 */
  private runStoryTick(): void {
    if (this.state.mode !== 'story' || !this.state.storyFlags) return;
    const sf = this.state.storyFlags;
    // 序章：靠统一推进（建朝跳变由 GameScene 接 STORY_UNIFIED 处理，过场后 advanceStoryChapter(1)）
    if (sf.chapter === 0) {
      if (!sf.unified) {
        const result = checkUnification({
          npcs: this.state.npcCountries.map(n => ({ militaryPower: n.militaryPower, stance: n.stance })),
          playerRenown: this.getPlayerRenown(),
        });
        if (result.unified && result.path) {
          sf.unified = true;
          sf.unifyPath = result.path;
          const seed = axisSeedForPath(result.path);
          sf.powerAxis = clampAxis(sf.powerAxis + seed.power);
          sf.resourceAxis = clampAxis(sf.resourceAxis + seed.resource);
          this.storyTransitionPending = true; // 等 GameScene 播完建朝过场再 advanceStoryChapter(1)
          this.emitter.emit(STATE_EVENTS.STORY_UNIFIED, { path: result.path });
        }
      } else if (!this.storyTransitionPending) {
        // 防 softlock：已统一但过场未推进（如在过场中存档→重载，过场丢失）→ 直接进第一章恢复
        this.advanceStoryChapter(1);
      }
      return;
    }
    // 第 1..7 章：达成章节目标解锁下一章（advanceGoal 优先；无则降级 advanceAfterDays 占位 dwell）
    if (sf.ending !== null) return; // 已到结局
    const def = chapterAt(sf.chapter);
    const daysInChapter = this.state.currentDay - sf.chapterStartDay;

    // C-2：叙事报文（章节 dwell 期间按 dayOffset 精确触发）
    const bulletins = getBulletinsForChapter(sf.chapter);
    for (const bul of bulletins) {
      if (daysInChapter === bul.dayOffset) {
        this.emitter.emit(STATE_EVENTS.BREATHING_BULLETIN, { entry: { id: bul.id, text: bul.text, textPlain: bul.textPlain } });
      }
    }

    const met = def.advanceGoal
      ? chapterGoalMet(def.advanceGoal, new Set(sf.storyEventsTriggered), daysInChapter)
      : (def.advanceAfterDays ?? 0) > 0 && daysInChapter >= (def.advanceAfterDays ?? 0);
    if (!met) return;
    if (sf.chapter < 7) {
      this.advanceStoryChapter(sf.chapter + 1);
    } else {
      // 终章：双轴判定三结局
      const ending = checkEnding(sf.powerAxis, sf.resourceAxis);
      sf.ending = ending;
      this.emitter.emit(STATE_EVENTS.STORY_ENDING, { ending });
    }
  }

  private runBreathingTick(): void {
    const cal = dayToCalendar(this.state.currentDay);
    const buildingDefIds = new Set(this.state.buildings.filter(b => b.status === 'working').map(b => b.defId));
    const totalPop = this.state.resources.people ?? 0;
    const idleLabor = this.getIdleLabor();
    const populationRatio = totalPop > 0 ? idleLabor / totalPop : 1;
    const ctx: BreathingContext = {
      currentDay: this.state.currentDay,
      season: cal.season,
      resources: this.state.resources as Record<string, number>,
      populationRatio,
      buildingDefIds,
      hasHostileNpc: this.state.npcCountries.some(n => n.stance <= -30),
      hasFriendlyNpc: this.state.npcCountries.some(n => n.stance >= 30),
      crisisActive: this.state.crisisActive,
      grade: this.state.grade,
      lastEventDay: this.state.lastEventDay,
    };
    const rng = createRng(this.state.rngSeed ^ (this.state.currentDay * 0x2B57));
    const rngFn = () => rng.next();
    const toast = tickBreathingToast(this.breathingState, ctx, rngFn);
    if (toast.entry) {
      this.emitter.emit(STATE_EVENTS.BREATHING_TOAST, { entry: toast.entry });
    }
    const bulletin = tickBreathingBulletin(this.breathingState, ctx, rngFn);
    if (bulletin.entry) {
      this.emitter.emit(STATE_EVENTS.BREATHING_BULLETIN, { entry: bulletin.entry });
    }
  }

  private runHistorianTick(): void {
    const grain = this.state.resources.grain ?? 0;
    this.historianGrainNegDays = grain < 0 ? this.historianGrainNegDays + 1 : 0;
    this.historianIdleDays++;

    const cal = dayToCalendar(this.state.currentDay);
    const buildingDefIds = new Set(this.state.buildings.filter(b => b.status === 'working').map(b => b.defId));
    const ctx: HistorianContext = {
      currentDay: this.state.currentDay,
      isFirstDay: this.state.currentDay === 1,
      grainNegativeDays: this.historianGrainNegDays,
      gold: this.state.resources.gold ?? 0,
      hasGoldCostBuilding: this.state.buildings.some(b => b.status === 'constructing'),
      policyPanelUnlocked: this.state.grade >= 1 && this.state.policies.every(p => !p.adopted),
      hasHostileNpc: this.state.npcCountries.some(n => n.stance <= -30),
      populationAtCap: (this.state.resources.people ?? 0) >= this.getHousingCap() && this.getHousingCap() > 0,
      gradeJustAscended: this.historianGradeAscended,
      idleDays: this.historianIdleDays,
      crisisActive: this.state.crisisActive,
      noAdjacentBonus: buildingDefIds.has('bld_farm') && !buildingDefIds.has('bld_well') && this.state.buildings.length >= 5,
      isFirstWinter: cal.season === 3,
      hasAvailableGeneral: this.hasAvailableGeneral(),
      seenIds: new Set(this.state.seenJitHints),
    };
    const result = checkHistorian(ctx);
    if (result.advice) {
      this.state.seenJitHints.push(result.advice.id);
      this.emitter.emit(STATE_EVENTS.HISTORIAN_ADVICE, { advice: result.advice });
    }
    if (result.advice?.id === 'hist_07_grade_ascend') {
      this.historianGradeAscended = false;
    }
  }

  /** A1：每日民心/怨愤沉淀——怨愤自然回落、颂声加成可逆、怨愤临界强推阶层诉求。 */
  private runSentimentSettlePhase(): void {
    // B2：名望每日产出（随国格递增；有上限，逼着玩家花，否则溢出浪费）
    const influenceCap = this.getInfluenceCap();
    const influenceCur = this.getInfluence();
    if (influenceCur < influenceCap) {
      this.addResource('influence', Math.min(this.state.grade + 1, influenceCap - influenceCur), 'influence');
    }
    // 怨愤临界 → 强推阶层诉求（复用 factionSystem 诉求模态）+ 可见警示
    // 注意：判定必须在「自然回落」之前，否则 70 阈值当天会先掉到 69 漏判。
    if (shouldForceWrathDemand(this.getPublicWrath(), this.state.lastWrathDemandDay, this.state.currentDay)) {
      this.state.lastWrathDemandDay = this.state.currentDay;
      this.state.factionState.nextEventDay = Math.min(this.state.factionState.nextEventDay, this.state.currentDay + 1);
      this.emitter.emit(STATE_EVENTS.WRATH_ALERT, { text: '民怨沸腾，举国侧目——不日必有诉求上达，速思抚民之策。' });
    }
    // 太平日子怨愤每天自然回落（危机期间不回落）
    if (!this.state.crisisActive && this.state.publicWrath > 0) {
      this.adjustWrath(-WRATH_PASSIVE_DECAY_PER_DAY, 'settle');
    }
    // 民心鼎盛给「颂声」加成（可逆：民心回落即移除）
    const praiseId = 'mod_praise_of_people';
    const hasPraise = this.state.activeModifiers.some(m => m.id === praiseId);
    if (this.state.playerMorale >= PRAISE_MORALE_THRESHOLD && !hasPraise) {
      this.addModifier({
        id: praiseId,
        name: '民心颂声',
        category: 'culture',
        stackable: false,
        effects: [{ target: 'population_happiness', op: 'add', value: 5 }],
        visualBadge: null,
        remainingDays: -1,
        description: '民心鼎盛，百姓颂声载道。',
        descPlain: '民心鼎盛，百姓颂声载道。',
      });
    } else if (this.state.playerMorale < PRAISE_MORALE_FALLBACK && hasPraise) {
      this.removeModifier(praiseId);
    }
  }

  /** 推进到指定章节并发 banner 事件（GameScene 跳变过场结束 / runStoryTick 占位推进调用）。 */
  advanceStoryChapter(chapter: number): void {
    if (!this.state.storyFlags) return;
    // C-3：切章时为上一章发史官评语（基于权力轴判断倾向）
    const prevChapter = this.state.storyFlags.chapter;
    if (prevChapter >= 1 && prevChapter <= 7) {
      const comment = getHistorianComment(prevChapter, this.state.storyFlags.powerAxis);
      if (comment) {
        this.emitter.emit(STATE_EVENTS.STORY_NARRATION, { text: '史官评曰：' + comment });
      }
    }
    this.storyTransitionPending = false;
    this.state.storyFlags.chapter = chapter;
    this.state.storyFlags.chapterStartDay = this.state.currentDay;
    this.emitter.emit(STATE_EVENTS.STORY_CHAPTER_CHANGED, { chapter, def: chapterAt(chapter) });
  }

  /**
   * 隐性双轴累积（仅 story 模式）：抉择（国策/朝令/事件）携带的 storyAxisDelta 累加，
   * 跨档位时发一条史官氛围评语（半可视化反馈）。
   */
  private pushStoryAxis(delta: { power?: number; production?: number } | undefined): void {
    if (this.state.mode !== 'story' || !this.state.storyFlags || !delta) return;
    const sf = this.state.storyFlags;
    const pBefore = powerBand(sf.powerAxis);
    const rBefore = resourceBand(sf.resourceAxis);
    if (delta.power) sf.powerAxis = clampAxis(sf.powerAxis + delta.power);
    if (delta.production) sf.resourceAxis = clampAxis(sf.resourceAxis + delta.production);
    const pAfter = powerBand(sf.powerAxis);
    const rAfter = resourceBand(sf.resourceAxis);
    if (pAfter !== pBefore) {
      const text = pAfter === 'devolve' ? '史官私记：朝堂之上，渐有"还政于民"之议。'
        : pAfter === 'centralize' ? '史官私记：大权愈归于上，群臣噤声。'
        : '史官私记：权柄之争，一时未分高下。';
      this.emitter.emit(STATE_EVENTS.STORY_NARRATION, { text });
    }
    if (rAfter !== rBefore) {
      const text = rAfter === 'public' ? '民间流言：田土工技，渐为众人所共。'
        : rAfter === 'private' ? '民间流言：田宅作坊，多入豪右之家。'
        : '民间流言：贫富之间，一时各执一词。';
      this.emitter.emit(STATE_EVENTS.STORY_NARRATION, { text });
    }
  }

  // ============== Phase1：NPC 动态成长 ==============

  /** 新局重置 NPC 阵容（用随机种子从池中选 4，含 ≥1 蛮夷）。IntroScene 立国时调，使每局不同。 */
  startNewGameNpcs(seed: number): void {
    this.state.npcCountries = selectNpcsForGame(seed);
    // A-3：新游戏注入当前季节 modifier
    if (!this.state.activeModifiers.some(isSeasonModifier)) {
      const cal = dayToCalendar(this.state.currentDay);
      this.state.activeModifiers = applySeasonTransition(this.state.activeModifiers, cal.season);
    }
  }

  /**
   * 每日：NPC 军力随季成长 + 玩家强弱驱动合纵/骚扰/内斗。
   * 行动结算（扣玩家资源/军力/民心、NPC 互削）在此，纯函数只给意图。
   */
  private runNpcDynamicsTick(): void {
    const npcs = this.state.npcCountries;
    if (npcs.length === 0) return;

    let changed = false;

    // 1) 军力成长：每 NPC_MP_GROWTH_INTERVAL 日按 archetype 加一档
    if (this.state.currentDay > 0 && this.state.currentDay % NPC_MP_GROWTH_INTERVAL === 0) {
      for (const s of npcs) {
        const def = getNpcDef(s.id);
        if (!def) continue;
        const next = Math.min(NPC_MP_CAP, s.militaryPower + npcMilitaryGrowthStep(def.archetype));
        if (next !== s.militaryPower) { s.militaryPower = next; changed = true; }
      }
    }

    // 2) 玩家强弱档
    const tier = evaluatePlayerStrength({
      grade: this.state.grade,
      militaryPower: this.state.playerMilitaryPower,
      renown: this.getPlayerRenown(),
      population: this.state.resources['people'] ?? 0,
    });

    const rngHandle = createRng((this.state.rngSeed ^ this.state.currentDay ^ 0x5eed) >>> 0);
    const rng = (): number => rngHandle.next();

    // 3) 合纵结盟（玩家 strong 时形成、否则解散）
    // B1：警惕值 ≥ 阈值时即使玩家非强档，列国也同仇敌忾（按强档合纵）——张力提前可读。
    const warinessTier = tier !== 'strong' && this.state.worldWariness >= WARINESS_COALITION_THRESHOLD
      ? 'strong'
      : tier;
    const alliancePatch = computeNpcAlliances(npcs, getNpcDef, warinessTier, rng);
    for (const s of npcs) {
      const next = alliancePatch[s.id];
      if (next && (next.length !== s.allyIds.length || next.some((id, i) => id !== s.allyIds[i]))) {
        s.allyIds = next;
        changed = true;
      }
    }

    // B-3: NPC AI 决策（30天一次简单规则：攻击/求贸/求盟/合纵）
    for (const s of npcs) {
      const otherNpcs = npcs.filter(n => n.id !== s.id);
      const decision = computeNpcDecision(
        s, this.state.playerMilitaryPower, otherNpcs, this.state.currentDay, rngHandle,
      );
      if (decision) {
        s.lastActionDay = this.state.currentDay;
        changed = true;
      }
    }

    // 4) NPC 行动（骚扰 / 联军压境 / 内斗）
    const actions = computeNpcActions(npcs, getNpcDef, tier, this.state.currentDay, rng);
    for (const act of actions) {
      const actor = npcs.find(n => n.id === act.actorId);
      if (!actor) continue;
      actor.lastActionDay = this.state.currentDay;
      changed = true;

      // 对玩家资源劫掠
      if (act.resourceRaid) {
        for (const [rid, v] of Object.entries(act.resourceRaid) as [ResourceId, number][]) {
          if (v) this.addResource(rid, v, 'npc_action');
        }
      }
      // 对玩家军力 / 民心
      if (act.playerMilitaryDelta) {
        this.state.playerMilitaryPower = Math.max(0, Math.min(500, this.state.playerMilitaryPower + act.playerMilitaryDelta));
      }
      if (act.playerMoraleDelta) {
        this.adjustMorale(act.playerMoraleDelta, `npc_${act.kind}`);
      }
      if (act.playerWrathDelta) {
        this.adjustWrath(act.playerWrathDelta, `npc_${act.kind}`);
      }
      // NPC 互削
      if (act.kind === 'npc_vs_npc' && act.targetId && act.targetMilitaryDelta) {
        const target = npcs.find(n => n.id === act.targetId);
        if (target) target.militaryPower = Math.max(10, target.militaryPower + act.targetMilitaryDelta);
      }

      const actorName = getNpcDef(act.actorId)?.name ?? act.actorId;
      const targetName = act.targetId ? (getNpcDef(act.targetId)?.name ?? act.targetId) : '';
      const text = act.kind === 'npc_vs_npc'
        ? `「${actorName}」兴兵伐「${targetName}」`
        : `「${actorName}」${act.summary}`;
      this.emitter.emit(STATE_EVENTS.NPC_ACTION, { kind: act.kind, actorName, targetName, text });
    }

    // B1：太平日子警惕值每日向基线回落（静默漂移，不发事件——面板每天随 DAY_TICK 刷新）
    if (this.state.worldWariness > WARINESS_BASELINE) {
      this.state.worldWariness = Math.max(WARINESS_BASELINE, this.state.worldWariness - WARINESS_DRIFT_PER_DAY);
      changed = true;
    } else if (this.state.worldWariness < WARINESS_BASELINE) {
      this.state.worldWariness = Math.min(WARINESS_BASELINE, this.state.worldWariness + WARINESS_DRIFT_PER_DAY);
      changed = true;
    }

    if (changed) this.emitter.emit(STATE_EVENTS.NPC_DYNAMICS_TICK, undefined);
  }

  // ============== Phase1：人口增长 ==============

  /** 最近一次 runPopulationTick 的增长趋势与浮点日增量（运行时，不入存档）——供 HUD/详情面板。 */
  private lastPopReason: 'grow' | 'cap' | 'idle' | 'overflow' = 'idle';
  private lastPopRawNet = 0;

  /**
   * BUG-A：负增长（超住房上限的"无家可归"流失）唯一出口——从农→工→兵→士级联扣减、不扣穿 0。
   * 与 applyStarvation 的 STARVATION_ORDER 同序，保证负增长口径单一、不分裂。返回实际扣减数。
   */
  private shrinkPopulationClasses(n: number): number {
    let remaining = Math.floor(n);
    let removed = 0;
    for (const cls of POPULATION_CLASSES) {
      if (remaining <= 0) break;
      const take = Math.min(this.state.populationClasses[cls], remaining);
      if (take > 0) {
        this.state.populationClasses[cls] -= take;
        remaining -= take;
        removed += take;
      }
    }
    return removed;
  }

  /**
   * 每日：有余粮 + 未满住房上限 → 人口渐增。缺粮减员**不在此**（由 runStarvationTick 独家负责，
   * 避免双重扣减）。余粮正反馈：粮储够的天数越多增长越快，封顶 ×1.5。
   */
  private runPopulationTick(): void {
    const people = this.state.resources['people'] ?? 0;
    const grainStock = this.state.resources['grain'] ?? 0;
    // §8.1 双表：按模式取人口参数（故事用 STORY_BALANCE 覆盖）
    const popCfg = getBalanceConfig(this.state.mode).population;
    // A-3：季节 modifier 影响人口增长率（夏 +50%）
    const growthMul = applyModifiers(1, 'country_population_growth', this.state.activeModifiers);
    // A2：民足系数（阶层需求满足度加权）影响人口增长——缺安居/市集/营伍会压慢生养
    const fulfillMul = populationFulfillment(
      this.state.populationClasses,
      this.state.buildings,
      this.state.resources,
    );
    // 余粮正反馈（2026-06-17）：surplusDays = 存粮 / 当日阶层粮耗；够 1 日 ×1.0、3 日 ×1.2、≥6 日 ×1.5。
    // 缺粮时不起作用（computePopulationGrowth 会判 idle）。给"攒粮"一个正向回报，也加速中后期。
    const grainPerDay = computeClassConsumption(this.state.populationClasses).totalGrain;
    // 无消耗者（grainPerDay=0）按基准、不额外奖励，避免"撤掉所有消耗以刷满加成"（DeepSeek 复审 ID-R3）
    const surplusDays = grainPerDay > 0 ? grainStock / grainPerDay : 1;
    const surplusMul = Math.max(1, Math.min(1.5, 1 + (surplusDays - 1) * 0.1));
    const totalMul = growthMul * surplusMul * fulfillMul;
    const effectiveCfg = totalMul === 1 ? popCfg : {
      ...popCfg,
      // 季节(growthMul) + 余粮(surplusMul) 共同加速"百分比增长"；但保底 minDailyGrowth 只随季节、
      // 不被余粮抬高，否则夏季囤粮时保底被放大到 2.7/天、开局几天就撞顶（DeepSeek 复审 ID-R4）。
      growthRatePerDay: popCfg.growthRatePerDay * totalMul,
      minDailyGrowth: popCfg.minDailyGrowth * growthMul,
    };
    const housingCap = this.getHousingCap();
    const result = computePopulationGrowth(
      {
        people, housingCap, grainStock, carry: this.state.populationCarry,
        minimumPopulation: DEFAULT_STARVATION.minimumPopulation,
        dailyConsumption: grainPerDay, // 仅"够喂当前人口的真余粮"才触发超限回落，防与饥荒双扣
      },
      effectiveCfg,
    );
    this.state.populationCarry = result.carry;
    // 趋势快照（运行时）——供 HUD 顶栏箭头 + 详情面板"今日约 +X"
    this.lastPopReason = result.reason;
    this.lastPopRawNet = result.rawNet;
    if (result.peopleDelta !== 0) {
      // ID-1 修复：addResource 内部 clamp 到 [0,9999]，故用"调用前后的实际差值"同步阶层，
      // 不能直接用 result.peopleDelta（否则 clamp 掉的部分会经 classTotal 回写、绕过 9999 上限）。
      const before = this.state.resources['people'] ?? 0;
      this.addResource('people', result.peopleDelta, 'population');
      const actual = (this.state.resources['people'] ?? 0) - before;
      if (actual > 0) {
        // B-0：新增人口全部归入 farmer（最基础阶层）
        this.state.populationClasses.farmer += actual;
      } else if (actual < 0) {
        // BUG-A：超上限回落，从农→工→兵→士级联扣减（统一出口，不只扣 farmer）
        this.shrinkPopulationClasses(-actual);
      }
    }
    // B-0：同步 populationClasses 总和 → resources.people（防漂移）；经 setResourceClamped，不绕过 [0,9999]
    const classTotal = totalPopulation(this.state.populationClasses);
    if (classTotal !== (this.state.resources['people'] ?? 0)) {
      this.setResourceClamped('people', classTotal);
    }
  }

  /**
   * 人口状态快照（供 HUD 顶栏 + 详情面板）。reason 含 UI 专用的 'starve'：
   * 缺粮时（即便仍在 applyStarvation 宽限期内）也提前飘红预警，让玩家及时补粮。
   */
  getPopulationStatus(): {
    total: number;
    idle: number;
    cap: number;
    reason: 'grow' | 'cap' | 'idle' | 'starve' | 'overflow';
    dailyRaw: number;
    classes: Readonly<PopulationClasses>;
    occupation: ClassOccupation;
    grainDays: number;
  } {
    const total = this.state.resources['people'] ?? 0;
    const grainStock = this.state.resources['grain'] ?? 0;
    const grainPerDay = computeClassConsumption(this.state.populationClasses).totalGrain;
    const grainDays = grainPerDay > 0 ? grainStock / grainPerDay : Infinity;
    let reason: 'grow' | 'cap' | 'idle' | 'starve' | 'overflow' = this.lastPopReason;
    if (grainStock <= 0 && total > 0) reason = 'starve';
    return {
      total,
      idle: this.getIdleLabor(),
      cap: this.getHousingCap(),
      reason,
      dailyRaw: this.lastPopRawNet,
      classes: this.getPopulationClasses(),
      occupation: this.getClassOccupation(),
      grainDays,
    };
  }

  /** B-0：每日转化队列推进（4 天完成一批转化） */
  private runConversionTick(): void {
    if (this.state.conversionQueue.length === 0) return;
    const { completed, remaining } = tickConversionQueue(this.state.conversionQueue);
    this.state.conversionQueue = remaining;
    for (const order of completed) {
      this.state.populationClasses[order.to] += order.count;
    }
  }

  /** B-0：缺粮饥饿减员（宽限 5 日 → 温和 2% → 15 日后严重 5%） */
  private runStarvationTick(): void {
    const grainBefore = this.state.resources['grain'] ?? 0;
    const consumption = computeClassConsumption(this.state.populationClasses);
    // BUG-B（2026-06-19）：人口每日真实吃粮——此前只比较不扣库存，导致粮食爆仓(粮9999)、
    // 粮食几乎无消耗。现真实扣减（addResource 已 clamp≥0，扣到 0 即止）。
    if (consumption.totalGrain > 0) {
      this.addResource('grain', -consumption.totalGrain, 'consumption');
    }
    // 缺口判定用"扣前库存 grainBefore"：用扣后会被 clamp 到 0 而误判永久缺粮。
    if (grainBefore < consumption.totalGrain) {
      this.state.grainNegativeDays += 1;
    } else {
      this.state.grainNegativeDays = 0;
    }
    // P3（2026-06-19）：中后期供养闭环——工要布、兵要铜、士要钱。此前 computeClassConsumption 算了却不扣
    // → 布/铜囤到爆仓、阶层资源无意义。现真实扣减形成消耗出口。短缺**非致命**（不像缺粮饿死）：扣到 0 即止，
    // 仅按是否短缺给轻微民心下滑（-1/日，可随补给恢复），提示玩家"该建蚕桑/铸造、给士发俸"。
    let supplyShort = false;
    for (const [res, need] of [['cloth', consumption.totalCloth], ['bronze', consumption.totalBronze], ['gold', consumption.totalGold]] as const) {
      if (need > 0) {
        const before = this.state.resources[res] ?? 0;
        this.addResource(res, -need, 'consumption');
        if (before < need) supplyShort = true;
      }
    }
    if (supplyShort) {
      this.state.playerMorale = Math.max(0, this.state.playerMorale - 1);
    }
    if (this.state.grainNegativeDays <= 0) return;
    // 缺口造成的减员由 applyStarvation 独家负责；此处只扣粮、不额外减员，杜绝双扣。
    const result = applyStarvation(this.state.populationClasses, this.state.grainNegativeDays);
    if (result.peopleLost > 0) {
      this.state.populationClasses = result.pop;
      this.addResource('people', -result.peopleLost, 'starvation');
    }
    if (result.moralePenalty > 0) {
      this.adjustMorale(-result.moralePenalty, 'starvation');
      this.adjustWrath(2, 'starvation');
    }
  }

  // ============== Phase1：可翻身低谷（无 Game Over） ==============

  /** 每日：国库+存粮双零累计达 §7 阈值 → 触发危机；资源回正连续 N 日 → 解除危机态。附庸态每季抽成。 */
  private runCrisisTick(): void {
    if (isDualZero(this.state.resources)) {
      this.state.dualZeroDays += 1;
      this.state.crisisRecoverDays = 0;
      if (this.state.dualZeroDays >= CRISIS_GRACE_DAYS && !this.state.crisisActive) {
        this.applyCrisis();
      }
    } else {
      this.state.dualZeroDays = 0;
      if (this.state.crisisActive) {
        this.state.crisisRecoverDays += 1;
        if (this.state.crisisRecoverDays >= CRISIS_RECOVER_DAYS) {
          this.state.crisisActive = false;
          this.state.crisisRecoverDays = 0;
        }
      }
    }
    // 纳贡附庸：每季（30 日）向宗主抽成 gold/grain，直到赎身（redeemVassalage）
    if (this.state.vassalOf !== null && this.state.currentDay > 0 && this.state.currentDay % 30 === 0) {
      const goldTribute = planTribute(this.state.resources['gold'] ?? 0);
      const grainTribute = planTribute(this.state.resources['grain'] ?? 0);
      if (goldTribute > 0) this.addResource('gold', -goldTribute, 'tribute');
      if (grainTribute > 0) this.addResource('grain', -grainTribute, 'tribute');
    }
  }

  /** 核心建筑（不可被割让）：基本民生。 */
  private static readonly CORE_BUILDING_IDS = new Set(['bld_farm', 'bld_well', 'bld_house']);

  /** 可被割让的 working 非核心建筑（最近建的在数组末尾）。 */
  private cedableBuildings(): BuildingInstance[] {
    return this.state.buildings.filter(
      b => b.status === 'working' && !GameStore.CORE_BUILDING_IDS.has(b.defId),
    );
  }

  /** 是否存在军力远超玩家(≥2×)的敌对 NPC——可逼为附庸。 */
  private findStrongHostileNpc(): NpcCountryState | undefined {
    const pmp = this.state.playerMilitaryPower;
    return this.state.npcCountries.find(n => n.stance < 0 && n.militaryPower >= Math.max(20, pmp * 2));
  }

  /**
   * 施加低谷危机（§7）：按情境选 民变/纳贡附庸/割地，防刷递增。无 Game Over、同局可恢复。
   * emit 顺序：先施加后果 → 末发 CRISIS_TRIGGERED（带 kind + summary），保证 UI 读到终态。
   */
  private applyCrisis(): void {
    this.state.crisisActive = true;
    this.state.dualZeroDays = 0;
    this.state.crisisRecoverDays = 0;

    const strongHostile = this.findStrongHostileNpc();
    const cedable = this.cedableBuildings();
    const kind: CrisisKind = chooseCrisisKind({
      hasStrongHostileNpc: !!strongHostile && this.state.vassalOf === null,
      cedableBuildingCount: cedable.length,
    });
    this.adjustWrath(WRATH_CRISIS_DELTA[kind], `crisis_${kind}`);
    const n = this.state.crisisCount; // 本次之前的危机数（用于递增）

    let summary = '';
    if (kind === 'vassalage' && strongHostile) {
      // 纳贡附庸：强邻趁火打劫逼为附庸，每季抽成，可赎身
      this.state.vassalOf = strongHostile.id;
      strongHostile.stance = Math.max(-100, Math.min(100, strongHostile.stance + 30)); // 宗主缓和
      this.adjustMorale(-(10 + n * 5), 'crisis_vassalage');
      const lord = getNpcDef(strongHostile.id)?.name ?? '强邻';
      summary = `国弱不能自立，「${lord}」陈兵压境，迫我称臣纳贡。岁输其半，可待来日赎身自主。`;
    } else if (kind === 'cession' && cedable.length > 0) {
      // 割地：丢最近建的非核心 working 建筑
      const lost = cedable[cedable.length - 1]!;
      lost.status = 'derelict';
      const lostName = getBuildingDef(lost.defId)?.name ?? '城邑';
      const moraleDrop = planCessionMoraleDrop(n);
      this.adjustMorale(moraleDrop, 'crisis_cession');
      this.emitter.emit(STATE_EVENTS.BUILDING_UPGRADED, lost); // 复用刷新建筑视觉
      summary = `国库空、仓廪罄，旷日逾月。无力守土，「${lostName}」就此荒废。励精图治，尚可再起。`;
    } else {
      // 民变（默认）：掉人口 + 挫士气 + 降格
      const currentPeople = this.state.resources['people'] ?? 0;
      const eff = planUnrestEffects(currentPeople, n);
      if (eff.peopleDelta !== 0) this.addResource('people', eff.peopleDelta, 'crisis');
      this.adjustMorale(eff.moraleDelta, 'crisis_unrest');
      const gradeFrom = this.state.grade;
      let gradeTo = gradeFrom;
      if (this.state.grade > 0) {
        gradeTo = this.state.grade - 1;
        this.state.grade = gradeTo;
        this.emitter.emit(STATE_EVENTS.GRADE_CHANGED, {
          from: gradeFrom, to: gradeTo, def: gradeDefAt(gradeTo), reason: 'crisis',
        });
      }
      const demoted = gradeTo !== gradeFrom ? `，国格降为「${gradeDefAt(gradeTo).name}」` : '';
      summary = `国库空、仓廪罄，旷日逾月。民有流散、士气大挫${demoted}。励精图治，尚可再起。`;
    }

    this.state.crisisCount += 1; // 防刷递增：下次更狠
    this.emitter.emit(STATE_EVENTS.CRISIS_TRIGGERED, { kind, summary, crisisCount: this.state.crisisCount });
  }

  /** 赎身：附庸态下攒够 gold 可一次性恢复自主。 */
  redeemVassalage(): { ok: boolean; reason?: string } {
    if (this.state.vassalOf === null) return { ok: false, reason: 'not_vassal' };
    if ((this.state.resources['gold'] ?? 0) < VASSAL_REDEEM_GOLD) return { ok: false, reason: 'insufficient_resources' };
    this.addResource('gold', -VASSAL_REDEEM_GOLD, 'redeem_vassalage');
    this.state.vassalOf = null;
    this.adjustMorale(10, 'redeem_vassalage');
    this.emitter.emit(STATE_EVENTS.NPC_DYNAMICS_TICK, undefined);
    return { ok: true };
  }

  isVassal(): boolean { return this.state.vassalOf !== null; }
  getVassalOf(): string | null { return this.state.vassalOf; }
  isCrisisActive(): boolean { return this.state.crisisActive; }

  setLastSeenNow(): void {
    this.state.lastSeenTimestamp = Date.now();
  }

  replaceState(newState: GameState): void {
    // Slice G hardening：deserialize 已经在 saveLoad.ts 做过深度校验，但 replaceState
    // 也可能从内存里灌进 quick-save / 测试场景。运行时 modifier shape 出错会让 tickDay
    // NaN 蔓延，所以这里再过一道：每条 activeModifier.effects 走一遍 validateModifierEffect。
    for (const m of newState.activeModifiers) {
      try { validateModifierInstance(m); }
      catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`[GameStore.replaceState] invalid activeModifier "${m.id}": ${msg}`);
      }
    }
    // productionCarry 在旧存档里可能不存在 — saveLoad 会注入 {}，但内存路径要兜一道
    if (!newState.productionCarry) newState.productionCarry = {};
    // v0.9：旧存档没有 panelCollapsed —— 兜底默认全展开
    if (!newState.panelCollapsed) newState.panelCollapsed = { left: false, right: false };
    // v1.0 #2：旧存档没有 completedDecreeIds —— 兜底空数组
    if (!Array.isArray(newState.completedDecreeIds)) newState.completedDecreeIds = [];
    // v1.0 #6：旧存档没有 NPC 邦国字段 —— 兜底初始化
    if (!Array.isArray(newState.npcCountries) || newState.npcCountries.length === 0) {
      newState.npcCountries = makeInitialNpcStates();
    }
    if (typeof newState.playerMorale !== 'number') newState.playerMorale = 50;
    if (typeof newState.playerMilitaryPower !== 'number') newState.playerMilitaryPower = 30;
    // A1：怨愤与警示冷却字段（内存/旧测试路径可能缺）
    if (typeof newState.publicWrath !== 'number') newState.publicWrath = 0;
    if (typeof newState.lastWrathDemandDay !== 'number') newState.lastWrathDemandDay = null;
    // B1：警惕值/原因字段（内存/旧测试路径可能缺）
    if (typeof newState.worldWariness !== 'number') newState.worldWariness = WARINESS_BASELINE;
    if (typeof newState.lastWarinessReason !== 'string') newState.lastWarinessReason = null;
    // B2：宣传冷却字段（内存/旧测试路径可能缺）
    if (typeof newState.lastPropagandaDay !== 'number') newState.lastPropagandaDay = null;
    // C1：古迹点（旧档/内存路径可能缺 → 空数组，不重新生成以尊重存档）
    if (!Array.isArray(newState.relicSites)) newState.relicSites = [];
    // Phase1：国格/低谷/模式字段——内存路径（quick-save/旧测试态）可能缺，兜底
    if (typeof newState.grade !== 'number') newState.grade = 0;
    if (typeof newState.gradeReached !== 'number') newState.gradeReached = newState.grade;
    if (typeof newState.tianxiaAcknowledged !== 'boolean') newState.tianxiaAcknowledged = false;
    if (typeof newState.dualZeroDays !== 'number') newState.dualZeroDays = 0;
    if (typeof newState.crisisActive !== 'boolean') newState.crisisActive = false;
    if (typeof newState.crisisRecoverDays !== 'number') newState.crisisRecoverDays = 0;
    if (newState.mode !== 'story' && newState.mode !== 'sandbox') newState.mode = 'sandbox';
    if (typeof newState.populationCarry !== 'number' || !Number.isFinite(newState.populationCarry)) newState.populationCarry = 0;
    // §7 / Phase2 字段兜底
    if (typeof newState.crisisCount !== 'number' || !Number.isFinite(newState.crisisCount)) newState.crisisCount = 0;
    if (typeof newState.vassalOf !== 'string') newState.vassalOf = newState.vassalOf === null ? null : null;
    if (newState.storyFlags === undefined) newState.storyFlags = null;
    // B-0：人口阶层（内存路径可能缺 → 全归 farmer）
    if (!newState.populationClasses || typeof newState.populationClasses !== 'object') {
      newState.populationClasses = createDefaultPopulation(newState.resources['people'] ?? 0);
    }
    if (!Array.isArray(newState.conversionQueue)) newState.conversionQueue = [];
    if (typeof newState.grainNegativeDays !== 'number') newState.grainNegativeDays = 0;
    // 占用制迁移：旧档 people 曾被"建筑消耗 people"的老 bug 吃空，但建筑仍在、仍占编制。
    // 若 people < 已占用劳力，读档后闲置劳力恒为 0 → 一栋都建不了的硬软锁。补足 people 到已占用量解死局。
    {
      let employed = 0;
      for (const b of newState.buildings) {
        if (b.status !== 'constructing' && b.status !== 'working') continue;
        employed += getBuildingDef(b.defId)?.cost.people ?? 0;
      }
      const curPeople = newState.resources.people ?? 0;
      if (curPeople < employed) newState.resources.people = employed;
    }
    // A-3：存档加载时强制修正季节 modifier（防重复/损坏堆叠）
    {
      const cal = dayToCalendar(newState.currentDay);
      newState.activeModifiers = applySeasonTransition(newState.activeModifiers, cal.season);
    }
    this.state = newState;
    this.worldMapAccessor = new WorldMapAccessor(newState.worldMap);
    // C1：读档后按新 state 的古迹点重建合成事件表（避免旧种子事件残留）
    this.events = [...this.baseEvents, ...this.buildRelicEvents()];
    // 瞬态字段重置：防止旧会话的暂停/呼吸/史官状态泄漏到新存档
    this.pauseHolders.clear();
    this.storyTransitionPending = false;
    this.breathingState = createBreathingState();
    this.historianGrainNegDays = 0;
    this.historianIdleDays = 0;
    this.historianGradeAscended = false;
    this.emitter.emit(STATE_EVENTS.STATE_REPLACED, undefined);
  }
}
