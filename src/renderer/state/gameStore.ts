import { RESOURCE_IDS } from '../data/resourceRegistry';
import type { ResourceId } from '../data/resourceRegistry';
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
import { applyModifiers } from './modifierAggregator';
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
  private readonly events: readonly CourtEvent[];
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

  constructor(emitter: IEventEmitter, initialState?: Partial<GameState>, content?: GameStoreContent) {
    this.emitter = emitter;
    this.state = Object.assign(makeDefaultState(), initialState ?? {});
    this.worldMapAccessor = new WorldMapAccessor(this.state.worldMap);
    this.policies = content?.policies ?? [];
    this.decrees = content?.decrees ?? [];
    this.events = content?.events ?? [];
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

  private setResourceClamped(id: ResourceId, value: number): void {
    this.state.resources[id] = Math.min(9999, Math.max(0, Math.floor(value)));
  }

  addResource(id: ResourceId, amount: number, reason?: string): void {
    const current = this.state.resources[id] ?? 0;
    this.setResourceClamped(id, current + amount);
    const deltas: Partial<Record<ResourceId, number>> = { [id]: amount };
    this.emitter.emit(STATE_EVENTS.RESOURCES_CHANGED, { deltas, reason });
  }

  setSpeed(s: 0 | 1 | 2 | 3): void {
    if (this.state.speed === s) return;
    this.state.speed = s;
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

    const deltas: Partial<Record<ResourceId, number>> = {};
    for (const id of RESOURCE_IDS) {
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

    // 前置（同 placeBuilding：bld_*=已建建筑 id；pol_*=已采纳国策 id）
    const builtDefIds = new Set(
      this.state.buildings.filter(b => b.status === 'working').map(b => b.defId),
    );
    const adoptedPolicyIds = this.getAdoptedPolicyIds();
    const missing: string[] = [];
    for (const req of toDef.upgradeRequires) {
      if (req.startsWith('pol_')) {
        if (!adoptedPolicyIds.has(req)) missing.push(req);
      } else {
        if (!builtDefIds.has(req)) missing.push(req);
      }
    }
    if (missing.length > 0) return { ok: false, reason: 'prerequisites_unmet', missing };

    // 资源：升级专用 cost；未给则回退到 toDef.cost
    const cost = toDef.upgradeCost ?? toDef.cost;
    for (const id of RESOURCE_IDS) {
      const need = cost[id];
      if (need === undefined || need === 0) continue;
      if ((this.state.resources[id] ?? 0) < need) {
        return { ok: false, reason: 'insufficient_resources' };
      }
    }

    const deltas: Partial<Record<ResourceId, number>> = {};
    for (const id of RESOURCE_IDS) {
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
  tickDay(): void {
    const prevDay = this.state.currentDay;
    const calBefore = dayToCalendar(prevDay);
    this.state.currentDay = prevDay + 1;
    const calAfter = dayToCalendar(this.state.currentDay);

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
      b.constructionProgress += 100 / time;
      // 浮点累加可能停在 99.9999 而少建一天；以 99.999 为闸门兜底（DeepSeek findings）
      if (b.constructionProgress >= 99.999) {
        b.constructionProgress = 100;
        b.status = 'working';
        if (isUpgrade) finishUpgrade();
        else this.emitter.emit(STATE_EVENTS.BUILDING_COMPLETED, b);
      }
    }

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

    // Slice F: production / decree / event tick
    this.runProductionTick();
    this.runDecreeTick();
    this.runEventTick();
    // v1.0 #6：邦交节拍（通商收入 + stance 漂移）
    this.runDiplomacyTick();
    // Phase1：NPC 动态成长（军力增长 / 合纵结盟 / 骚扰围攻）。在 population 前，
    // 让骚扰劫掠的资源损失计入当日存粮判生养与双零危机判定。
    this.runNpcDynamicsTick();
    // Phase1：人口增长（用 production 后的存粮判生养；在 crisis 之前，让损失计入双零判定）
    this.runPopulationTick();
    // Phase1：低谷危机 → 国格晋阶。顺序固定 crisis→grade：
    // crisis 可能掉人口/降级，grade 判定要用 crisis 后的终值，避免同 tick 既升又降的矛盾。
    this.runCrisisTick();
    this.runGradeTick();
    // Phase2：故事导演（仅 story 模式；沙盒 early-return 零污染）
    this.runStoryTick();
  }

  /** 当日产出 / 维护开销 → 资源 deltas（grain 等） */
  private runProductionTick(): void {
    const result = computeProductionTick(
      this.state.buildings,
      getBuildingDef,
      this.state.activeModifiers,
      this.state.productionCarry,
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
    // 事件冷却：上次事件结算后至少隔 minDaysBetween 天才采样新事件（纪元式呼吸感，防接二连三）
    const minGap = getBalanceConfig(this.state.mode).event.minDaysBetween;
    if (this.state.currentDay - this.state.lastEventDay < minGap) return;
    const metrics = this.computeMetrics();
    const id = sampleEventTrigger(this.events, this.state.eventHistory, metrics);
    if (id === null) return;
    this.state.pendingEventId = id;
    this.state.pendingEventDayStart = this.state.currentDay;
    this.emitter.emit(STATE_EVENTS.EVENT_TRIGGERED, { eventId: id });
  }

  /** 用当前 state + activeModifiers 算 DSL/事件采样所需的国家级指标快照 */
  private computeMetrics(): CountryMetrics {
    const cal = dayToCalendar(this.state.currentDay);
    // Phase1：people 现在会真实增长 → population 直接取裸 people 资源（不再经 country_population_cap
    // 聚合，后者改作"住房上限"用于人口增长门槛，见 population.ts / runPopulationTick）。
    const population = this.state.resources['people'] ?? 0;
    const morale = applyModifiers(50, 'country_morale', this.state.activeModifiers);
    const militaryPower = applyModifiers(0, 'country_military_power', this.state.activeModifiers);
    // RNG：每次 metrics 推进一步 rngSeed，保证 day-to-day 不同。
    // 用箭头包裹以防 createRng 实现被换成需要 this 的形式（DeepSeek 防御）。
    const rngHandle = createRng(this.state.rngSeed ^ this.state.currentDay);
    const sf = this.state.storyFlags;
    return {
      resources: this.state.resources,
      population,
      morale,
      militaryPower,
      year: cal.year,
      season: cal.season,
      dayOfYear: this.state.currentDay % 120,
      rng: () => rngHandle.next(),
      // Phase3 故事维度（沙盒 storyFlags=null → chapter=-1、双轴=0，事件 trigger 的 story_* 条件自然不命中）
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
    return result;
  }

  // ============== v1.0 #6：NPC 邦国 / 邦交 ===============================

  getNpcCountries(): readonly NpcCountryState[] {
    return Object.freeze(this.state.npcCountries.map(s => ({ ...s })));
  }

  getPlayerMorale(): number { return this.state.playerMorale; }
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
      this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale + result.playerDeltas.morale));
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
    const result = tryDeclareWar(def, state, this.state.playerMilitaryPower, this.state.currentDay, rngFn);
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
    this.emitter.emit(STATE_EVENTS.GRADE_CHANGED, {
      from, to: next, def: gradeDefAt(next), reason: 'ascend',
    });
    if (next >= MAX_GRADE && !this.state.tianxiaAcknowledged) {
      this.state.tianxiaAcknowledged = true;
      this.emitter.emit(STATE_EVENTS.TIANXIA_ACKNOWLEDGED, { def: gradeDefAt(next) });
    }
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

  /** 推进到指定章节并发 banner 事件（GameScene 跳变过场结束 / runStoryTick 占位推进调用）。 */
  advanceStoryChapter(chapter: number): void {
    if (!this.state.storyFlags) return;
    this.storyTransitionPending = false; // 跳变过场已落地
    this.state.storyFlags.chapter = chapter;
    this.state.storyFlags.chapterStartDay = this.state.currentDay; // 重置本章计时
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
    const alliancePatch = computeNpcAlliances(npcs, getNpcDef, tier, rng);
    for (const s of npcs) {
      const next = alliancePatch[s.id];
      if (next && (next.length !== s.allyIds.length || next.some((id, i) => id !== s.allyIds[i]))) {
        s.allyIds = next;
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
        this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale + act.playerMoraleDelta));
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

    if (changed) this.emitter.emit(STATE_EVENTS.NPC_DYNAMICS_TICK, undefined);
  }

  // ============== Phase1：人口增长 ==============

  /** 每日：有余粮 + 未满住房上限 → 人口渐增；缺粮 → 流失。走 addResource 自带 clamp。 */
  private runPopulationTick(): void {
    const people = this.state.resources['people'] ?? 0;
    const grainStock = this.state.resources['grain'] ?? 0;
    // §8.1 双表：按模式取人口参数（故事用 STORY_BALANCE 覆盖）
    const popCfg = getBalanceConfig(this.state.mode).population;
    // 住房上限 = 基数 + working 建筑 housingCapacity，再经 country_population_cap modifier 聚合
    const housingBase = popCfg.baseHousingCap + sumHousingCapacity(this.state.buildings, getBuildingDef);
    const housingCap = applyModifiers(housingBase, 'country_population_cap', this.state.activeModifiers);
    const result = computePopulationGrowth(
      { people, housingCap, grainStock, carry: this.state.populationCarry },
      popCfg,
    );
    this.state.populationCarry = result.carry;
    if (result.peopleDelta !== 0) {
      this.addResource('people', result.peopleDelta, 'population');
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
    const n = this.state.crisisCount; // 本次之前的危机数（用于递增）

    let summary = '';
    if (kind === 'vassalage' && strongHostile) {
      // 纳贡附庸：强邻趁火打劫逼为附庸，每季抽成，可赎身
      this.state.vassalOf = strongHostile.id;
      strongHostile.stance = Math.max(-100, Math.min(100, strongHostile.stance + 30)); // 宗主缓和
      this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale - (10 + n * 5)));
      const lord = getNpcDef(strongHostile.id)?.name ?? '强邻';
      summary = `国弱不能自立，「${lord}」陈兵压境，迫我称臣纳贡。岁输其半，可待来日赎身自主。`;
    } else if (kind === 'cession' && cedable.length > 0) {
      // 割地：丢最近建的非核心 working 建筑
      const lost = cedable[cedable.length - 1]!;
      lost.status = 'derelict';
      const lostName = getBuildingDef(lost.defId)?.name ?? '城邑';
      const moraleDrop = planCessionMoraleDrop(n);
      this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale + moraleDrop));
      this.emitter.emit(STATE_EVENTS.BUILDING_UPGRADED, lost); // 复用刷新建筑视觉
      summary = `国库空、仓廪罄，旷日逾月。无力守土，「${lostName}」就此荒废。励精图治，尚可再起。`;
    } else {
      // 民变（默认）：掉人口 + 挫士气 + 降格
      const currentPeople = this.state.resources['people'] ?? 0;
      const eff = planUnrestEffects(currentPeople, n);
      if (eff.peopleDelta !== 0) this.addResource('people', eff.peopleDelta, 'crisis');
      this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale + eff.moraleDelta));
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
    this.state.playerMorale = Math.max(0, Math.min(100, this.state.playerMorale + 10));
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
    this.state = newState;
    this.worldMapAccessor = new WorldMapAccessor(newState.worldMap);
    this.emitter.emit(STATE_EVENTS.STATE_REPLACED, undefined);
  }
}
