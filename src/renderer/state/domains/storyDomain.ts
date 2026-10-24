/**
 * 域六：story 导演件（gameStore 拆分 story 批 1/3 · c1025-01 外迁件）。
 *
 * 拆分约束（done/c1011-13 存档兼容面）：「拆逻辑不拆 GameState 容器；字段全集零增删改」——
 * 本模块收 NPC 动态日 tick 的**编排/结算体**（原 runNpcDynamicsTick 主体，逐字搬运）；
 * addResource / adjustMorale / adjustWrath 与三处 emit 副作用经 GameStore 注入回调保留在原位，
 * 调用次序逐字保持（ACT_CHANGED 幕推进 → 军力成长 → 合纵 → B-3 决策 → 行动结算 → 警惕值漂移 → NPC_DYNAMICS_TICK）。
 * store 私有瞬态 lastActId 经 outcome 写回（同 populationTick 的 reason/rawNet 口径）。
 * 纯结构重构授权：零数值行为变更；rng.ts 未触（createRng 只读调用）。
 */
import type { ResourceId } from '../../data/resourceRegistry';
import type { NpcCountryState } from '../../data/schema';
import { createRng } from '../rng';
import { actFor, type ActDef } from '../../data/actTimeline';
import { getNpcDef } from '../../data/npcCountries';
import {
  npcMilitaryGrowthStep, evaluatePlayerStrength, computeNpcAlliances, computeNpcActions,
  NPC_MP_GROWTH_INTERVAL, NPC_MP_CAP,
} from '../npcDynamics';
import { computeNpcDecision } from '../diplomacyExpanded';
import { WARINESS_BASELINE, WARINESS_DRIFT_PER_DAY, WARINESS_COALITION_THRESHOLD } from '../wariness';
import {
  checkUnification, axisSeedForPath, clampAxis, powerBand, resourceBand, checkEnding, type EndingId,
} from '../storyDriver';
import { chapterAt, chapterGoalMet } from '../../data/storyChapters';
import { getBulletinsForChapter, getHistorianComment } from '../../data/storyGoals';
import type { StoryFlags } from '../gameStore';
import type { CourtEvent } from '../../data/schema';
import type { CountryMetrics } from '../dslEval';
import { sampleEventTrigger, applyEventChoice, checkEventTimeout } from '../eventEngine';
import { assessNationState, shouldSampleEvent, filterEventsByState, DEFAULT_TEMPO_CONFIG, type NationStateInput } from '../eventTempo';

export interface NpcDynamicsInput {
  npcCountries: NpcCountryState[];
  currentDay: number;
  grade: number;
  playerMilitaryPower: number;
  renown: number;
  people: number;
  rngSeed: number;
  worldWariness: number;
  /** store 私有瞬态（运行时，不入存档）——上一 tick 的幕 id。 */
  lastActId: string;
}

export interface NpcDynamicsIo {
  addResource(id: ResourceId, delta: number, reason: string): void;
  adjustMorale(delta: number, reason: string): void;
  adjustWrath(delta: number, reason: string): void;
  emitActChanged(payload: { id: string; name: string; subtitle: string; day: number }): void;
  emitNpcAction(payload: { kind: string; actorName: string; targetName: string; text: string }): void;
  emitNpcDynamicsTick(): void;
}

export interface NpcDynamicsOutcome {
  /** store 写回私有瞬态 this.lastActId。 */
  lastActId: string;
  /** 行动结算后的玩家军力（含 [0,500] clamp，直写同址）。 */
  playerMilitaryPower: number;
  /** B1 漂移后的警惕值（store 写回 state.worldWariness）。 */
  worldWariness: number;
}

/**
 * 每日：NPC 军力随季成长 + 玩家强弱驱动合纵/骚扰/内斗（原 runNpcDynamicsTick 主体，逐字搬运）。
 * 行动结算（扣玩家资源/军力/民心、NPC 互削）在此，纯函数只给意图。
 */
export function npcDynamicsTickStep(input: NpcDynamicsInput, io: NpcDynamicsIo): NpcDynamicsOutcome {
  const npcs = input.npcCountries;
  let playerMilitaryPower = input.playerMilitaryPower;
  let worldWariness = input.worldWariness;
  let lastActId = input.lastActId;

  // P2 三幕时间轴：按当前日取幕；幕切换时发 banner（一局至多两次），幕参数喂给结盟/犯边概率。
  // 放在空 NPC 早退之前：即使无邻邦（读档/故事序章）幕也照常推进。
  const act: ActDef = actFor(input.currentDay);
  if (act.id !== lastActId) {
    lastActId = act.id;
    io.emitActChanged({
      id: act.id, name: act.name, subtitle: act.subtitle, day: input.currentDay,
    });
  }

  if (npcs.length === 0) {
    return { lastActId, playerMilitaryPower, worldWariness };
  }

  let changed = false;

  // 1) 军力成长：每 NPC_MP_GROWTH_INTERVAL 日按 archetype 加一档
  if (input.currentDay > 0 && input.currentDay % NPC_MP_GROWTH_INTERVAL === 0) {
    for (const s of npcs) {
      const def = getNpcDef(s.id);
      if (!def) continue;
      const next = Math.min(NPC_MP_CAP, s.militaryPower + npcMilitaryGrowthStep(def.archetype));
      if (next !== s.militaryPower) { s.militaryPower = next; changed = true; }
    }
  }

  // 2) 玩家强弱档
  const tier = evaluatePlayerStrength({
    grade: input.grade,
    militaryPower: playerMilitaryPower,
    renown: input.renown,
    population: input.people,
  });

  const rngHandle = createRng((input.rngSeed ^ input.currentDay ^ 0x5eed) >>> 0);
  const rng = (): number => rngHandle.next();

  // 3) 合纵结盟（玩家 strong 时形成、否则解散）
  // B1：警惕值 ≥ 阈值时即使玩家非强档，列国也同仇敌忾（按强档合纵）——张力提前可读。
  const warinessTier = tier !== 'strong' && worldWariness >= WARINESS_COALITION_THRESHOLD
    ? 'strong'
    : tier;
  const alliancePatch = computeNpcAlliances(npcs, getNpcDef, warinessTier, rng, act.params);
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
      s, playerMilitaryPower, otherNpcs, input.currentDay, rngHandle,
    );
    if (decision) {
      s.lastActionDay = input.currentDay;
      changed = true;
    }
  }

  // 4) NPC 行动（骚扰 / 联军压境 / 内斗）
  const actions = computeNpcActions(npcs, getNpcDef, tier, input.currentDay, rng, act.params);
  for (const action of actions) {
    const actor = npcs.find(n => n.id === action.actorId);
    if (!actor) continue;
    actor.lastActionDay = input.currentDay;
    changed = true;

    // 对玩家资源劫掠
    if (action.resourceRaid) {
      for (const [rid, v] of Object.entries(action.resourceRaid) as [ResourceId, number][]) {
        if (v) io.addResource(rid, v, 'npc_action');
      }
    }
    // 对玩家军力 / 民心
    if (action.playerMilitaryDelta) {
      playerMilitaryPower = Math.max(0, Math.min(500, playerMilitaryPower + action.playerMilitaryDelta));
    }
    if (action.playerMoraleDelta) {
      io.adjustMorale(action.playerMoraleDelta, `npc_${action.kind}`);
    }
    if (action.playerWrathDelta) {
      io.adjustWrath(action.playerWrathDelta, `npc_${action.kind}`);
    }
    // NPC 互削
    if (action.kind === 'npc_vs_npc' && action.targetId && action.targetMilitaryDelta) {
      const target = npcs.find(n => n.id === action.targetId);
      if (target) target.militaryPower = Math.max(10, target.militaryPower + action.targetMilitaryDelta);
    }

    const actorName = getNpcDef(action.actorId)?.name ?? action.actorId;
    const targetName = action.targetId ? (getNpcDef(action.targetId)?.name ?? action.targetId) : '';
    const text = action.kind === 'npc_vs_npc'
      ? `「${actorName}」兴兵伐「${targetName}」`
      : `「${actorName}」${action.summary}`;
    io.emitNpcAction({ kind: action.kind, actorName, targetName, text });
  }

  // B1：太平日子警惕值每日向基线回落（静默漂移，不发事件——面板每天随 DAY_TICK 刷新）
  if (worldWariness > WARINESS_BASELINE) {
    worldWariness = Math.max(WARINESS_BASELINE, worldWariness - WARINESS_DRIFT_PER_DAY);
    changed = true;
  } else if (worldWariness < WARINESS_BASELINE) {
    worldWariness = Math.min(WARINESS_BASELINE, worldWariness + WARINESS_DRIFT_PER_DAY);
    changed = true;
  }

  if (changed) io.emitNpcDynamicsTick();

  return { lastActId, playerMilitaryPower, worldWariness };
}

// ============== c1025-02：story 导演件族（runStoryTick / advanceStoryChapter / pushStoryAxis 主体外迁） ==============

export interface StoryTickInput {
  mode: 'sandbox' | 'story';
  storyFlags: StoryFlags | null;
  npcCountries: NpcCountryState[];
  playerRenown: number;
  currentDay: number;
  /** store 私有瞬态（不持久化）：序章统一后等 GameScene 过场，期间不重复推进。 */
  storyTransitionPending: boolean;
}

export interface StoryTickIo {
  emitUnified(payload: { path: 'martial' | 'cultural' }): void;
  emitBulletin(payload: { entry: { id: string; text: string; textPlain: string } }): void;
  emitEnding(payload: { ending: EndingId }): void;
  /** 调用 GameStore 公共方法 advanceStoryChapter（防 softlock 恢复与章节推进两处）。 */
  advanceChapter(chapter: number): void;
}

export interface StoryTickOutcome {
  storyTransitionPending: boolean;
}

/**
 * 每日故事 tick（原 runStoryTick 主体，逐字搬运）：序章未统一时判定多途径统一，
 * 达成则播种双轴 + emit STORY_UNIFIED（场景接管跳变）；已统一但过场未推进（防 softlock）直接进第一章；
 * 第 1..7 章达成章节目标解锁下一章（advanceGoal 优先；无则降级 advanceAfterDays 占位 dwell）。
 * sf 直写（unified/unifyPath/powerAxis/resourceAxis/ending）；瞬态 pending 经 outcome 写回。
 */
export function storyTickStep(input: StoryTickInput, io: StoryTickIo): StoryTickOutcome {
  if (input.mode !== 'story' || !input.storyFlags) {
    return { storyTransitionPending: input.storyTransitionPending };
  }
  const sf = input.storyFlags;
  let storyTransitionPending = input.storyTransitionPending;
  // 序章：靠统一推进（建朝跳变由 GameScene 接 STORY_UNIFIED 处理，过场后 advanceStoryChapter(1)）
  if (sf.chapter === 0) {
    if (!sf.unified) {
      const result = checkUnification({
        npcs: input.npcCountries.map(n => ({ militaryPower: n.militaryPower, stance: n.stance })),
        playerRenown: input.playerRenown,
      });
      if (result.unified && result.path) {
        sf.unified = true;
        sf.unifyPath = result.path;
        const seed = axisSeedForPath(result.path);
        sf.powerAxis = clampAxis(sf.powerAxis + seed.power);
        sf.resourceAxis = clampAxis(sf.resourceAxis + seed.resource);
        storyTransitionPending = true; // 等 GameScene 播完建朝过场再 advanceStoryChapter(1)
        io.emitUnified({ path: result.path });
      }
    } else if (!storyTransitionPending) {
      // 防 softlock：已统一但过场未推进（如在过场中存档→重载，过场丢失）→ 直接进第一章恢复
      io.advanceChapter(1);
    }
    return { storyTransitionPending };
  }
  // 第 1..7 章：达成章节目标解锁下一章（advanceGoal 优先；无则降级 advanceAfterDays 占位 dwell）
  if (sf.ending !== null) return { storyTransitionPending }; // 已到结局
  const def = chapterAt(sf.chapter);
  const daysInChapter = input.currentDay - sf.chapterStartDay;

  // C-2：叙事报文（章节 dwell 期间按 dayOffset 精确触发）
  const bulletins = getBulletinsForChapter(sf.chapter);
  for (const bul of bulletins) {
    if (daysInChapter === bul.dayOffset) {
      io.emitBulletin({ entry: { id: bul.id, text: bul.text, textPlain: bul.textPlain } });
    }
  }

  const met = def.advanceGoal
    ? chapterGoalMet(def.advanceGoal, new Set(sf.storyEventsTriggered), daysInChapter)
    : (def.advanceAfterDays ?? 0) > 0 && daysInChapter >= (def.advanceAfterDays ?? 0);
  if (!met) return { storyTransitionPending };
  if (sf.chapter < 7) {
    io.advanceChapter(sf.chapter + 1);
  } else {
    // 终章：双轴判定三结局
    const ending = checkEnding(sf.powerAxis, sf.resourceAxis);
    sf.ending = ending;
    io.emitEnding({ ending });
  }
  return { storyTransitionPending };
}

export interface AdvanceChapterIo {
  emitNarration(payload: { text: string }): void;
  /** 原 `this.storyTransitionPending = false` 直写（调用次序保持：评语 emit 之后、章节字段写之前）。 */
  clearTransitionPending(): void;
  emitChapterChanged(payload: { chapter: number; def: ReturnType<typeof chapterAt> }): void;
}

/** 推进到指定章节并发 banner 事件（原 advanceStoryChapter 主体，逐字搬运；公共签名留在 GameStore）。 */
export function advanceChapterStep(
  sf: StoryFlags | null,
  chapter: number,
  currentDay: number,
  io: AdvanceChapterIo,
): void {
  if (!sf) return;
  // C-3：切章时为上一章发史官评语（基于权力轴判断倾向）
  const prevChapter = sf.chapter;
  if (prevChapter >= 1 && prevChapter <= 7) {
    const comment = getHistorianComment(prevChapter, sf.powerAxis);
    if (comment) {
      io.emitNarration({ text: '史官评曰：' + comment });
    }
  }
  io.clearTransitionPending();
  sf.chapter = chapter;
  sf.chapterStartDay = currentDay;
  io.emitChapterChanged({ chapter, def: chapterAt(chapter) });
}

export interface PushAxisIo {
  emitNarration(payload: { text: string }): void;
}

/**
 * 隐性双轴累积（仅 story 模式，原 pushStoryAxis 主体，逐字搬运）：
 * 抉择（国策/朝令/事件）携带的 storyAxisDelta 累加，跨档位时发一条史官氛围评语（半可视化反馈）。
 */
export function pushStoryAxisStep(
  mode: 'sandbox' | 'story',
  storyFlags: StoryFlags | null,
  delta: { power?: number; production?: number } | undefined,
  io: PushAxisIo,
): void {
  if (mode !== 'story' || !storyFlags || !delta) return;
  const sf = storyFlags;
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
    io.emitNarration({ text });
  }
  if (rAfter !== rBefore) {
    const text = rAfter === 'public' ? '民间流言：田土工技，渐为众人所共。'
      : rAfter === 'private' ? '民间流言：田宅作坊，多入豪右之家。'
      : '民间流言：贫富之间，一时各执一词。';
    io.emitNarration({ text });
  }
}

// ============== c1025-03：事件采样/采纳编排残余段（runEventTick / tryTriggerRelic / resolveEvent 主体外迁） ==============

export interface EventTickInput {
  events: readonly CourtEvent[];
  pendingEventId: string | null;
  pendingEventDayStart: number | null;
  currentDay: number;
  lastEventDay: number;
  storyFlags: StoryFlags | null;
  /** resources 切片（grain/gold/people——NationStateInput 构成）。 */
  grain: number;
  gold: number;
  people: number;
  crisisActive: boolean;
  npcCountries: NpcCountryState[];
  rngSeed: number;
  /** 采样防重复用（原 this.state.eventHistory）。 */
  eventHistory: string[];
}

export interface EventTickIo {
  /** 超时回退（原 `this.resolveEvent(0)` 公共方法回调）。 */
  resolveEvent(choiceIdx: number): void;
  /** 挂起事件写入（原 state 直写；**必须在 emitTriggered 之前调用**——EventModal 在事件回调里读 getPendingEventId()）。 */
  setPending(eventId: string, dayStart: number): void;
  emitTriggered(payload: { eventId: string }): void;
  /** 普通朝议无戏时的古迹回退（原 `this.tryTriggerRelic()`）。 */
  tryTriggerRelic(): void;
  /** 原采样序内取指标快照（过滤后调用，保序）。 */
  computeMetrics(): CountryMetrics;
}

/**
 * 朝议事件采样 + 超时回退（原 runEventTick 主体，逐字搬运）：
 * 挂起超时→resolveEvent(0)；anti-combo fast path；故事模式剧情事件「无挂起即触发」
 * （只守 8 日防连击底线，不受沙盒节奏拖累）；状态节奏采样（tempo 流与选事件流分离 0x1F4E9）。
 */
export function eventTickStep(input: EventTickInput, io: EventTickIo): void {
  if (input.pendingEventId !== null) {
    // 已有挂起事件：检查是否超时
    const def = input.events.find(e => e.id === input.pendingEventId);
    if (def && input.pendingEventDayStart !== null) {
      const elapsed = input.currentDay - input.pendingEventDayStart;
      if (checkEventTimeout(def, elapsed) === 'pick0') {
        io.resolveEvent(0);
      }
    }
    return;
  }
  if (input.events.length === 0) return;
  // A-7：状态驱动事件节奏（替代固定 minDaysBetween）
  const daysSinceLast = input.currentDay - input.lastEventDay;
  // Fast path: skip state assessment during anti-combo window (unless force-trigger)
  if (daysSinceLast < DEFAULT_TEMPO_CONFIG.antiComboDays && daysSinceLast < DEFAULT_TEMPO_CONFIG.forceMaxDays) return;

  // P2 修正：故事模式剧情事件「无挂起即触发」（设计 §storyEvents 注释原意）——
  // 只守 8 日防连击底线，不受沙盒 25-50 日状态节奏拖累；否则每章 5 事件要 200+ 天才凑齐，
  // 七卷合计近 2000 天，故事节奏被沙盒节拍拖垮（无头试玩实测暴露）。
  if (input.storyFlags && input.storyFlags.chapter >= 1 && input.storyFlags.ending === null) {
    const chapter = input.storyFlags.chapter;
    const nextStory = input.events.find(ev =>
      ev.tags.includes('故事')
      && ev.triggers.some(t => t.condition === `story_chapter == ${chapter}`)
      && !input.storyFlags!.storyEventsTriggered.includes(ev.id)
    );
    if (nextStory) {
      io.setPending(nextStory.id, input.currentDay);
      io.emitTriggered({ eventId: nextStory.id });
      return;
    }
  }
  const grain = input.grain;
  const grainCap = Math.max(1, input.people * 5);
  const nationInput: NationStateInput = {
    crisisActive: input.crisisActive,
    npcCountries: input.npcCountries,
    grainCapacityRatio: grain / grainCap,
    goldAmount: input.gold,
  };
  const nationState = assessNationState(nationInput);
  // Discriminant 0x1F4E9 separates tempo stream from event-selection stream (avoids correlation)
  const tempoRng = createRng(input.rngSeed ^ (input.currentDay * 7919) ^ 0x1F4E9);
  const decision = shouldSampleEvent(daysSinceLast, nationState, tempoRng.next(), DEFAULT_TEMPO_CONFIG);
  if (!decision.shouldSample) return;
  // 按状态过滤事件池
  const filteredEvents = filterEventsByState(input.events, nationState);
  if (filteredEvents.length === 0) return;
  const metrics = io.computeMetrics();
  const id = sampleEventTrigger(filteredEvents, input.eventHistory, metrics);
  if (id === null) { io.tryTriggerRelic(); return; }
  io.setPending(id, input.currentDay);
  io.emitTriggered({ eventId: id });
}

/** C1：普通朝议无戏时，唤起下一个空闲古迹阶段（与朝议共用一条叙事流，互不抢占）（原 tryTriggerRelic 主体）。
 *  setPending 先于 emitTriggered（同 eventTickStep 次序口径）。 */
export function triggerRelicStep(
  relicSites: { id: string; done: boolean; stage: number }[],
  currentDay: number,
  io: { setPending(eventId: string, dayStart: number): void; emitTriggered(payload: { eventId: string }): void },
): void {
  const readyRelic = relicSites.find(s => !s.done);
  if (!readyRelic) return;
  const pendingEventId = `relic_${readyRelic.id}_s${readyRelic.stage}`;
  io.setPending(pendingEventId, currentDay);
  io.emitTriggered({ eventId: pendingEventId });
}

export interface ResolveEventIo {
  /** C1 古迹合成事件走专用结算（relic_rX_sY 形态，留在 GameStore）。 */
  applyRelicChoice(siteIdx: number, stageIdx: number, choiceIdx: number): void;
  removeModifier(modifierId: string): void;
  addModifier(mod: NonNullable<ReturnType<typeof applyEventChoice>['modifierToAdd']>): void;
  pushStoryAxis(delta: { power?: number; production?: number } | undefined): void;
  emitResolved(payload: { eventId: string; choiceIdx: number; applied: boolean }): void;
  /** 挂起清空（原 def 查找后直写两位 null；**必须在 emitResolved 之前**——modal 在回调里读 pending）。 */
  clearPending(): void;
}

/**
 * 玩家点 choice 或 timeout 自动 0：清掉 pendingEventId + 应用 effects + 写 history
 * （原 resolveEvent 主体，逐字搬运；公共签名留在 GameStore）。
 * eventHistory / storyFlags 直写（可变引用同址）；pending 清空与冷却起点经 outcome 写回。
 */
export function resolveEventStep(
  input: {
    events: readonly CourtEvent[];
    pendingEventId: string | null;
    currentDay: number;
    eventHistory: string[];
    storyFlags: StoryFlags | null;
    choiceIdx: number;
  },
  io: ResolveEventIo,
): { lastEventDay: number } {
  const id = input.pendingEventId;
  if (id === null) return { lastEventDay: NaN };
  const def = input.events.find(e => e.id === id);
  io.clearPending();
  // 事件冷却起点：本次结算日（含找不到 def 的清理路径，避免坏 id 绕过冷却）
  const lastEventDay = input.currentDay;
  if (!def) {
    // 静态数据找不到：仅清理状态
    io.emitResolved({ eventId: id, choiceIdx: input.choiceIdx, applied: false });
    return { lastEventDay };
  }
  // C1：古迹合成事件走专用结算（一次性资源/民心/怨愤，不经永久 modifier）
  const relicMatch = /^relic_r(\d+)_s(\d+)$/.exec(id);
  if (relicMatch) {
    io.applyRelicChoice(Number(relicMatch[1]), Number(relicMatch[2]), input.choiceIdx);
    return { lastEventDay };
  }
  const result = applyEventChoice(def, input.choiceIdx);
  for (const rid of result.modifiersToRemove) {
    io.removeModifier(rid);
  }
  if (result.modifierToAdd) {
    io.addModifier(result.modifierToAdd);
  }
  input.eventHistory.push(id);
  io.pushStoryAxis(def.choices?.[input.choiceIdx]?.storyAxisDelta); // Phase2：抉择悄悄推双轴
  // Phase3：'故事' 标签事件解决后记入进度（章节目标 advanceGoal 据此判定解锁）
  if (input.storyFlags && def.tags.includes('故事') && !input.storyFlags.storyEventsTriggered.includes(id)) {
    input.storyFlags.storyEventsTriggered.push(id);
  }
  io.emitResolved({ eventId: id, choiceIdx: input.choiceIdx, applied: true });
  return { lastEventDay };
}
