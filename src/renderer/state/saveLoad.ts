import type { GameState, GameStore } from './gameStore';
import { DEFAULT_MAP_SIZE } from './gameStore';
import type { ResourceId } from '../data/resourceRegistry';
import type { BuildingInstance, BuildingStatus, BuildingTier, ModifierInstance, NpcCountryState, WarStatus } from '../data/schema';
import { makeInitialNpcStates } from '../data/npcCountries';
import type { WorldMap, MapTile, ResourceNode } from '../data/mapSchema';
import { isValidTerrain, isValidResourceNodeKind } from '../data/mapSchema';
import { generateMap } from './mapGen';
import type { PopulationClasses, ConversionOrder, PopulationClass } from '../data/populationClass';
import { createDefaultPopulation, POPULATION_CLASSES } from '../data/populationClass';
import { type FactionState, createFactionState } from './factionSystem';
import type { MegaProjectProgress } from './megaProjectSystem';
import type { GeneralState } from '../data/generals';
import type { ActiveExpedition, DefenseAlert } from '../data/military';
import { clampSentiment } from './publicSentiment';
import { WARINESS_BASELINE, clampWariness } from './wariness';
import type { RelicSite } from './relicSystem';
import { JIT_HINTS } from '../data/jitHints';

export const SAVE_SCHEMA_VERSION = 9;

/** c919-04 TODO①：currentDay 存档上界——沙盒长期基准 HORIZON_DAYS=720 的 5 倍护栏；损坏档拒载。 */
export const MAX_SAVE_CURRENT_DAY = 3600;

export class SaveLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveLoadError';
  }
}

export interface SerializedSave {
  schemaVersion: number;
  savedAt: number;
  state: {
    resources: Partial<Record<ResourceId, number>>;
    buildings: BuildingInstance[];
    policies: { id: string; adopted: boolean }[];
    activeModifiers: ModifierInstance[];
    activeDecrees: { id: string; currentStage: number; daysElapsed: number }[];
    eventHistory: string[];
    pendingEventId?: string | null;
    pendingEventDayStart?: number | null;
    productionCarry?: Partial<Record<ResourceId, number>>;
    tutorialStepId: string | null;
    seenJitHints?: string[];
    lastEventDay?: number;
    lastSeenTimestamp: number;
    currentDay: number;
    rngSeed: number;
    speed: 0 | 1 | 2 | 3;
    worldMap?: WorldMap;
    /** v0.9：面板折叠态。旧存档没此字段时 deserialize 会兜底为 {left:false, right:false} */
    panelCollapsed?: { left: boolean; right: boolean };
    /** v1.0 #2：已完成的 decree id 列表。旧存档没此字段时 deserialize 兜底为 []（链路 decree 视为未解锁） */
    completedDecreeIds?: string[];
    /** v1.0 #6：NPC 邦国动态状态。旧存档没此字段时 deserialize 用 makeInitialNpcStates() 兜底 */
    npcCountries?: NpcCountryState[];
    /** v1.0 #6：玩家 morale (0..100, default 50)、militaryPower (0..500, default 30) */
    playerMorale?: number;
    playerMilitaryPower?: number;
    /** A1：怨愤（0..100, default 0）与上次民怨警示日（null=从未） */
    publicWrath?: number;
    lastWrathDemandDay?: number | null;
    /** B1：列国警惕值（0..100, default 20）与最近原因 */
    worldWariness?: number;
    lastWarinessReason?: string | null;
    /** B2：上次宣传日（7 日冷却用） */
    lastPropagandaDay?: number | null;
    /** C1：古迹点（旧档无此字段 → 空数组） */
    relicSites?: RelicSite[];
    /** C2：终局日期字段（旧档 null） */
    endgameAscendDay?: number | null;
    endgameLastWaveDay?: number | null;
  /** P2 通牒到期日（可选，旧档缺省） */
  wrathUltimatumEndDay?: number | null;
    /** Phase1 国格阶梯（旧存档缺则兜底 0 / false） */
    grade?: number;
    gradeReached?: number;
    tianxiaAcknowledged?: boolean;
    /** Phase1 低谷危机计数器（旧存档缺则兜底 0 / false） */
    dualZeroDays?: number;
    crisisActive?: boolean;
    crisisRecoverDays?: number;
    /** Phase1 模式（旧存档缺则兜底 'sandbox'） */
    mode?: 'sandbox' | 'story';
    /** Phase1 人口增长小数残差（旧存档缺则兜底 0） */
    populationCarry?: number;
    /** §7 危机次数（防刷递增） */
    crisisCount?: number;
    /** §7 附庸于哪个 NPC（null=独立） */
    vassalOf?: string | null;
    /** Phase2 故事 storyFlags（sandbox 存档为 null/缺省） */
    storyFlags?: {
      chapter?: number;
      unifyPath?: 'martial' | 'cultural' | null;
      unified?: boolean;
      powerAxis?: number;
      resourceAxis?: number;
      storyEventsTriggered?: string[];
      chapterStartDay?: number;
      ending?: 'gong' | 'jia' | 'huo' | null;
    } | null;
    /** B-0：人口阶层分布（旧存档无→全归farmer） */
    populationClasses?: PopulationClasses;
    /** B-0：阶层转化队列 */
    conversionQueue?: ConversionOrder[];
    /** B-0：缺粮连续天数 */
    grainNegativeDays?: number;
    /** B-4.1：阶层博弈状态 */
    factionState?: FactionState;
    /** B-4.2：巨型工程进度 */
    megaProjects?: MegaProjectProgress[];
    /** B-4.3：已选互斥国策 */
    exclusivePolicies?: string[];
    /** B-2：已招募将领（P4） */
    generals?: GeneralState[];
    /** B-1：进行中出征（P4） */
    activeExpeditions?: ActiveExpedition[];
    /** B-1：来犯预警（P4） */
    defenseAlerts?: DefenseAlert[];
  };
}

type MigrationFn = (old: unknown) => unknown;
const migrations: Partial<Record<number, MigrationFn>> = {
  1: (blob) => {
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    const people = (s['resources'] as Record<string, number>)?.['people'] ?? 0;
    s['populationClasses'] = createDefaultPopulation(people);
    s['conversionQueue'] = [];
    s['grainNegativeDays'] = 0;
    data.schemaVersion = 2;
    return data;
  },
  2: (blob) => {
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['factionState'] = createFactionState();
    s['megaProjects'] = [];
    s['exclusivePolicies'] = [];
    data.schemaVersion = 3;
    return data;
  },
  3: (blob) => {
    // A1 双轴民心：新增怨愤与警示冷却字段，旧存档给安全初值
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['publicWrath'] = 0;
    s['lastWrathDemandDay'] = null;
    data.schemaVersion = 4;
    return data;
  },
  4: (blob) => {
    // B1 列国警惕值：旧档给基线 20 / 无原因
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['worldWariness'] = WARINESS_BASELINE;
    s['lastWarinessReason'] = null;
    data.schemaVersion = 5;
    return data;
  },
  5: (blob) => {
    // B2 影响力：新增名望与宣传冷却字段，旧档给 null
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['lastPropagandaDay'] = null;
    data.schemaVersion = 6;
    return data;
  },
  6: (blob) => {
    // C1 古迹链：旧档无古迹点
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['relicSites'] = [];
    data.schemaVersion = 7;
    return data;
  },
  7: (blob) => {
    // C2 终局波次：旧档未登顶/未放波
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['endgameAscendDay'] = null;
    s['endgameLastWaveDay'] = null;
    data.schemaVersion = 8;
    return data;
  },
  8: (blob) => {
    // P2 通牒：旧档无民愤通牒
    const data = blob as { schemaVersion: number; state: Record<string, unknown> };
    const s = data.state;
    s['wrathUltimatumEndDay'] = null;
    data.schemaVersion = 9;
    return data;
  },
};

function runMigrations(blob: unknown, fromVersion: number): unknown {
  let current = blob;
  let version = fromVersion;
  while (version < SAVE_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) {
      // c922-104：断链定位补到「实际缺的档位」——version 是本次查表缺的 migrations[N]，
      // fromVersion 是档案自带版本；链中段断档时两者并不相同（如 v2 档缺 migrations[7]，
      // 旧串只报 “from schema version 2” 会误导定位）。控制流一字未动，仅改消息拼装，
      // 字段口径与 future-version 对齐：主句报原始档，括号给「缺何档 + 当前何版」。
      throw new SaveLoadError(
        `[saveLoad] No migration path from schema version ${fromVersion} to ${SAVE_SCHEMA_VERSION} ` +
          `(missing: migrations[${version}], current: ${SAVE_SCHEMA_VERSION})`,
      );
    }
    current = migrate(current);
    version++;
  }
  return current;
}

// Deep-validates a worldMap blob from disk. Bad terrain strings, non-boolean buildable,
// NaN positions etc. would otherwise crash the renderer mid-frame later.
function validateWorldMap(raw: unknown): WorldMap {
  if (typeof raw !== 'object' || raw === null) {
    throw new SaveLoadError('[saveLoad] worldMap is malformed (not an object)');
  }
  const wm = raw as Record<string, unknown>;
  if (!Number.isInteger(wm['width']) || (wm['width'] as number) <= 0) {
    throw new SaveLoadError('[saveLoad] worldMap.width must be a positive integer');
  }
  if (!Number.isInteger(wm['height']) || (wm['height'] as number) <= 0) {
    throw new SaveLoadError('[saveLoad] worldMap.height must be a positive integer');
  }
  if (!Number.isFinite(wm['seed'])) {
    throw new SaveLoadError('[saveLoad] worldMap.seed must be a finite number');
  }
  if (!Array.isArray(wm['tiles'])) {
    throw new SaveLoadError('[saveLoad] worldMap.tiles must be an array');
  }
  if (!Array.isArray(wm['resourceNodes'])) {
    throw new SaveLoadError('[saveLoad] worldMap.resourceNodes must be an array');
  }
  const width = wm['width'] as number;
  const height = wm['height'] as number;
  const rawTiles = wm['tiles'] as unknown[];
  if (rawTiles.length !== width * height) {
    throw new SaveLoadError(
      `[saveLoad] worldMap.tiles.length=${rawTiles.length} does not match width*height=${width * height}`,
    );
  }
  const tiles: MapTile[] = [];
  for (let i = 0; i < rawTiles.length; i++) {
    const t = rawTiles[i];
    if (typeof t !== 'object' || t === null) {
      throw new SaveLoadError(`[saveLoad] worldMap.tiles[${i}] is not an object`);
    }
    const rec = t as Record<string, unknown>;
    if (typeof rec['terrain'] !== 'string' || !isValidTerrain(rec['terrain'])) {
      throw new SaveLoadError(`[saveLoad] worldMap.tiles[${i}].terrain is not a valid terrain`);
    }
    if (typeof rec['buildable'] !== 'boolean') {
      throw new SaveLoadError(`[saveLoad] worldMap.tiles[${i}].buildable must be boolean`);
    }
    if (typeof rec['walkable'] !== 'boolean') {
      throw new SaveLoadError(`[saveLoad] worldMap.tiles[${i}].walkable must be boolean`);
    }
    tiles.push({
      terrain: rec['terrain'],
      buildable: rec['buildable'],
      walkable: rec['walkable'],
    });
  }
  const rawNodes = wm['resourceNodes'] as unknown[];
  const resourceNodes: ResourceNode[] = [];
  for (let i = 0; i < rawNodes.length; i++) {
    const n = rawNodes[i];
    if (typeof n !== 'object' || n === null) {
      throw new SaveLoadError(`[saveLoad] worldMap.resourceNodes[${i}] is not an object`);
    }
    const rec = n as Record<string, unknown>;
    if (typeof rec['kind'] !== 'string' || !isValidResourceNodeKind(rec['kind'])) {
      throw new SaveLoadError(`[saveLoad] worldMap.resourceNodes[${i}].kind is not a valid kind`);
    }
    const pos = rec['position'];
    if (typeof pos !== 'object' || pos === null) {
      throw new SaveLoadError(`[saveLoad] worldMap.resourceNodes[${i}].position is not an object`);
    }
    const posRec = pos as Record<string, unknown>;
    const px = posRec['x'];
    const py = posRec['y'];
    if (!Number.isInteger(px) || (px as number) < 0 || (px as number) >= width) {
      throw new SaveLoadError(`[saveLoad] worldMap.resourceNodes[${i}].position.x out of range`);
    }
    if (!Number.isInteger(py) || (py as number) < 0 || (py as number) >= height) {
      throw new SaveLoadError(`[saveLoad] worldMap.resourceNodes[${i}].position.y out of range`);
    }
    if (!Number.isFinite(rec['remaining']) || (rec['remaining'] as number) < 0) {
      throw new SaveLoadError(`[saveLoad] worldMap.resourceNodes[${i}].remaining must be a non-negative number`);
    }
    resourceNodes.push({
      kind: rec['kind'],
      position: { x: px as number, y: py as number },
      remaining: rec['remaining'] as number,
    });
  }
  return { width, height, tiles, resourceNodes, seed: wm['seed'] as number };
}

export function serialize(state: Readonly<GameState>): SerializedSave {
  // c1006-02（c1004-20 三选·推荐组合②）：存档前全资源 isFinite 终检——
  // 非 finite 记 warn（最终防线：保证落盘档干净；定位弱于 catch 处，属双保险位）。
  for (const [k, v] of Object.entries(state.resources)) {
    if (!Number.isFinite(v)) console.warn('[saveLoad] serialize: non-finite resource', k, v);
  }
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: Date.now(),
    state: {
      resources: state.resources,
      buildings: state.buildings,
      policies: state.policies,
      activeModifiers: state.activeModifiers,
      activeDecrees: state.activeDecrees,
      eventHistory: state.eventHistory,
      pendingEventId: state.pendingEventId,
      pendingEventDayStart: state.pendingEventDayStart,
      productionCarry: state.productionCarry,
      tutorialStepId: state.tutorialStepId,
      seenJitHints: state.seenJitHints,
      lastEventDay: state.lastEventDay,
      lastSeenTimestamp: state.lastSeenTimestamp,
      currentDay: state.currentDay,
      rngSeed: state.rngSeed,
      speed: state.speed,
      worldMap: state.worldMap,
      panelCollapsed: state.panelCollapsed,
      completedDecreeIds: state.completedDecreeIds,
      npcCountries: state.npcCountries,
      playerMorale: state.playerMorale,
      playerMilitaryPower: state.playerMilitaryPower,
      publicWrath: state.publicWrath,
      lastWrathDemandDay: state.lastWrathDemandDay,
      worldWariness: state.worldWariness,
      lastWarinessReason: state.lastWarinessReason,
      lastPropagandaDay: state.lastPropagandaDay,
      relicSites: state.relicSites,
      endgameAscendDay: state.endgameAscendDay,
      endgameLastWaveDay: state.endgameLastWaveDay,
    wrathUltimatumEndDay: state.wrathUltimatumEndDay,
      grade: state.grade,
      gradeReached: state.gradeReached,
      tianxiaAcknowledged: state.tianxiaAcknowledged,
      dualZeroDays: state.dualZeroDays,
      crisisActive: state.crisisActive,
      crisisRecoverDays: state.crisisRecoverDays,
      mode: state.mode,
      populationCarry: state.populationCarry,
      crisisCount: state.crisisCount,
      vassalOf: state.vassalOf,
      storyFlags: state.storyFlags ? {
        chapter: state.storyFlags.chapter,
        unifyPath: state.storyFlags.unifyPath,
        unified: state.storyFlags.unified,
        powerAxis: state.storyFlags.powerAxis,
        resourceAxis: state.storyFlags.resourceAxis,
        storyEventsTriggered: state.storyFlags.storyEventsTriggered,
        chapterStartDay: state.storyFlags.chapterStartDay,
        ending: state.storyFlags.ending,
      } : null,
      populationClasses: state.populationClasses,
      conversionQueue: state.conversionQueue,
      grainNegativeDays: state.grainNegativeDays,
      factionState: state.factionState,
      megaProjects: state.megaProjects,
      exclusivePolicies: state.exclusivePolicies,
      generals: state.generals,
      activeExpeditions: state.activeExpeditions,
      defenseAlerts: state.defenseAlerts,
    },
  };
}

export function deserialize(blob: unknown): GameState {
  if (typeof blob !== 'object' || blob === null) {
    throw new SaveLoadError('[saveLoad] Save data must be a non-null object');
  }
  const raw = blob as Record<string, unknown>;
  if (!('schemaVersion' in raw)) {
    throw new SaveLoadError('[saveLoad] Save data missing schemaVersion field');
  }
  const schemaVersion = raw['schemaVersion'] as number;
  if (typeof schemaVersion !== 'number') {
    throw new SaveLoadError('[saveLoad] schemaVersion must be a number');
  }
  if (schemaVersion > SAVE_SCHEMA_VERSION) {
    throw new SaveLoadError(
      `[saveLoad] Save created with future schema version ${schemaVersion} (current: ${SAVE_SCHEMA_VERSION})`,
    );
  }

  let migrated: unknown = blob;
  if (schemaVersion < SAVE_SCHEMA_VERSION) {
    migrated = runMigrations(blob, schemaVersion);
  }

  const data = migrated as { schemaVersion: number; state: SerializedSave['state'] };
  if (typeof data.state !== 'object' || data.state === null) {
    // 020c：缺 state 不再裸抛 TypeError，统一 SaveLoadError 通道
    throw new SaveLoadError('[saveLoad] Save data missing state field');
  }
  const s = data.state;

  // r5 B2（2026-09-27 用户裁决）：**载荷性字段缺失 = 拒载**，不再静默回填。
  // 旧行为（本文件 :413 回填 12345 ／ :453 回填 []）会让回放静默换轨——实测评测：
  // 删掉 rngSeed 后续跑事件流与真值不同（replaySnapshotContent.test.ts C2 组三条）。
  // 只对**当版**存档判缺；低版存档先走 runMigrations（迁移链负责补默认），不在此拦。
  if (schemaVersion === SAVE_SCHEMA_VERSION) {
    const missingLoadBearing = (['rngSeed', 'eventHistory'] as const).filter((k) => s[k] === undefined);
    if (missingLoadBearing.length > 0) {
      throw new SaveLoadError(
        `[saveLoad] Save missing load-bearing field(s): ${missingLoadBearing.join(', ')} ` +
          '(refusing to load: silent backfill would switch the replay track)',
      );
    }
  }

  // clamp speed to the literal union 0|1|2|3; a corrupted save shouldn't be able to
  // smuggle in 99 or -1 and crash downstream code that assumes the union.
  const rawSpeed = s.speed;
  const speed: 0 | 1 | 2 | 3 = rawSpeed === 0 || rawSpeed === 1 || rawSpeed === 2 || rawSpeed === 3
    ? rawSpeed
    : 1;

  const rngSeed = typeof s.rngSeed === 'number' && Number.isFinite(s.rngSeed) ? s.rngSeed : 12345;

  // worldMap: validate shape if present; regenerate from rngSeed for legacy saves missing the field
  let worldMap: WorldMap;
  if (s.worldMap === undefined || s.worldMap === null) {
    worldMap = generateMap({ width: DEFAULT_MAP_SIZE, height: DEFAULT_MAP_SIZE, seed: rngSeed });
  } else {
    worldMap = validateWorldMap(s.worldMap);
  }

  // Slice G hardening：buildings 必走 shape 校验（损坏 status/tier 会让 productionTick 静默不产出）
  const buildings = s.buildings === undefined ? [] : validateBuildingsArray(s.buildings);

  // p911r-40：resources shape 校验——必须是「有限数值」记录，异常统一 SaveLoadError
  const rawResources = (s.resources ?? {}) as Record<string, unknown>;
  if (
    typeof rawResources !== 'object' ||
    Array.isArray(rawResources) ||
    !Object.values(rawResources).every(v => typeof v === 'number' && Number.isFinite(v))
  ) {
    throw new SaveLoadError('[saveLoad] resources must be a record of finite numbers');
  }
  // c1006-02（案②，主班 2026-10-06 拍板）：负库存历史档钳 0——照 constructionProgress
  // p911r-40 双段式先例（先 finite throw 后负值钳）。现行写路径不产负库存 ⇒ 钳制只服务
  // 历史遗物档（非法态归零即合法态）；一次性 console.warn 留观测（c1004-02 同味）。
  let negativeCount = 0;
  for (const [k, v] of Object.entries(rawResources)) {
    if ((v as number) < 0) {
      (rawResources as Record<string, number>)[k] = 0;
      negativeCount += 1;
    }
  }
  if (negativeCount > 0) {
    console.warn(
      `[saveLoad] resources 负库存钳 0（历史档遗物，共 ${negativeCount} 项）：` +
      '现行写路径不产负库存，钳制即修复到合法态',
    );
  }

  // reconstruct GameState, adding runtime-only defaults
  // c919-04 TODO①：currentDay [0, MAX_SAVE_CURRENT_DAY] 校验——损坏档拒载有明确错误面（材料单 c918-11）。
  const rawCurrentDay = s.currentDay ?? 0;
  if (
    typeof rawCurrentDay !== 'number' || !Number.isFinite(rawCurrentDay)
    || rawCurrentDay < 0 || rawCurrentDay > MAX_SAVE_CURRENT_DAY
  ) {
    throw new SaveLoadError(
      `[saveLoad] currentDay out of range: ${String(s.currentDay)} (allowed 0..${MAX_SAVE_CURRENT_DAY})`,
    );
  }
  const gameState: GameState = {
    resources: rawResources as GameState['resources'],
    buildings,
    policies: s.policies ?? [],
    activeModifiers: s.activeModifiers ?? [],
    activeDecrees: s.activeDecrees ?? [],
    eventHistory: s.eventHistory ?? [],
    pendingEventId: s.pendingEventId ?? null,
    pendingEventDayStart: s.pendingEventDayStart ?? null,
    productionCarry: s.productionCarry ?? {},
    tutorialStepId: s.tutorialStepId ?? null,
    // c1007-29（c1007-10 遗留）：白名单 filter——删 JIT_HINTS 键后旧档残键（孤儿 trigger）
    // 若被保留，JitHintManager wouldSeen 判重会吞掉**新键**的首提示（同字符串碰撞面）或
    // 白白增长 seen 集。这里只留 JIT_HINTS 在册 trigger，孤儿键落盘即弃。
    seenJitHints: Array.isArray(s.seenJitHints)
      ? s.seenJitHints.filter((x): x is string =>
          typeof x === 'string' && Object.prototype.hasOwnProperty.call(JIT_HINTS, x))
      : [],
    // DeepSeek 复审[major]：clamp 到 [0, currentDay]，防损坏存档把 lastEventDay 设超大导致事件永久不触发
    lastEventDay: typeof s.lastEventDay === 'number' ? Math.max(0, Math.min(s.lastEventDay, rawCurrentDay)) : 0,
    lastSeenTimestamp: s.lastSeenTimestamp ?? 0,
    currentDay: rawCurrentDay,
    rngSeed,
    speed,
    worldMap,
    paused: false,
    lastTickTimestamp: 0,
    // v0.9：旧存档没有 panelCollapsed —— 默认全展开，玩家可手动折叠
    panelCollapsed: (s.panelCollapsed && typeof s.panelCollapsed === 'object'
      && typeof (s.panelCollapsed as { left?: unknown }).left === 'boolean'
      && typeof (s.panelCollapsed as { right?: unknown }).right === 'boolean')
      ? { left: (s.panelCollapsed as { left: boolean }).left, right: (s.panelCollapsed as { right: boolean }).right }
      : { left: false, right: false },
    // v1.0 #2：已完成的 decree id 列表（旧存档无此字段 → 空数组，链路 decree 视为未解锁）
    completedDecreeIds: Array.isArray(s.completedDecreeIds)
      ? s.completedDecreeIds.filter((x): x is string => typeof x === 'string')
      : [],
    // v1.0 #6：NPC 邦国动态（旧存档无 → 用 makeInitialNpcStates() 兜底）
    npcCountries: Array.isArray(s.npcCountries) && s.npcCountries.length > 0
      ? validateNpcCountriesArray(s.npcCountries)
      : makeInitialNpcStates(),
    playerMorale: typeof s.playerMorale === 'number' && Number.isFinite(s.playerMorale)
      ? Math.max(0, Math.min(100, s.playerMorale))
      : 50,
    publicWrath: clampSentiment(typeof s.publicWrath === 'number' ? s.publicWrath : 0),
    lastWrathDemandDay: typeof s.lastWrathDemandDay === 'number' && Number.isFinite(s.lastWrathDemandDay)
      ? Math.max(0, Math.floor(s.lastWrathDemandDay))
      : null,
    worldWariness: clampWariness(typeof s.worldWariness === 'number' ? s.worldWariness : WARINESS_BASELINE),
    lastWarinessReason: typeof s.lastWarinessReason === 'string' ? s.lastWarinessReason : null,
    lastPropagandaDay: typeof s.lastPropagandaDay === 'number' && Number.isFinite(s.lastPropagandaDay)
      ? Math.max(0, Math.floor(s.lastPropagandaDay))
      : null,
    relicSites: Array.isArray(s.relicSites)
      ? (s.relicSites as unknown[]).filter((r): r is RelicSite => {
        const o = r as Partial<RelicSite>;
        return !!o && typeof o.id === 'string' && typeof o.chainId === 'string'
          && typeof o.name === 'string' && typeof o.position?.x === 'number'
          && typeof o.position?.y === 'number';
      }).map(r => ({
        id: r.id,
        chainId: r.chainId,
        name: r.name,
        position: { x: Math.floor(r.position.x), y: Math.floor(r.position.y) },
        stage: Math.max(0, Math.min(2, Number.isFinite(r.stage) ? Math.floor(r.stage) : 0)),
        done: r.done === true,
      }))
      : [],
    endgameAscendDay: typeof s.endgameAscendDay === 'number' && Number.isFinite(s.endgameAscendDay)
      ? Math.max(0, Math.floor(s.endgameAscendDay))
      : null,
    endgameLastWaveDay: typeof s.endgameLastWaveDay === 'number' && Number.isFinite(s.endgameLastWaveDay)
      ? Math.max(0, Math.floor(s.endgameLastWaveDay))
      : null,
    // P2 通牒：number 且有限 → 取整；否则 null（旧档/损坏兜底）
    wrathUltimatumEndDay: typeof s.wrathUltimatumEndDay === 'number' && Number.isFinite(s.wrathUltimatumEndDay)
      ? Math.max(0, Math.floor(s.wrathUltimatumEndDay))
      : null,
    playerMilitaryPower: typeof s.playerMilitaryPower === 'number' && Number.isFinite(s.playerMilitaryPower)
      ? Math.max(0, Math.min(500, s.playerMilitaryPower))
      : 30,
    // Phase1 国格阶梯（旧存档无 → 0；clamp 0..5；gradeReached 不低于 grade）
    grade: clampGrade(finiteNum(s.grade, 0)),
    gradeReached: Math.max(clampGrade(finiteNum(s.grade, 0)), clampGrade(finiteNum(s.gradeReached, 0))),
    tianxiaAcknowledged: s.tianxiaAcknowledged === true,
    // Phase1 低谷危机计数器（旧存档无 → 0 / false）
    dualZeroDays: Math.max(0, Math.floor(finiteNum(s.dualZeroDays, 0))),
    crisisActive: s.crisisActive === true,
    crisisRecoverDays: Math.max(0, Math.floor(finiteNum(s.crisisRecoverDays, 0))),
    // Phase1 模式（旧存档无 → sandbox）
    mode: s.mode === 'story' ? 'story' : 'sandbox',
    // Phase1 人口增长残差（旧存档无 → 0）
    populationCarry: finiteNum(s.populationCarry, 0),
    // §7 危机次数 / 附庸
    crisisCount: Math.max(0, Math.floor(finiteNum(s.crisisCount, 0))),
    vassalOf: typeof s.vassalOf === 'string' ? s.vassalOf : null,
    // Phase2 故事 storyFlags（仅 story 存档有；sandbox → null）
    storyFlags: deserializeStoryFlags(s.storyFlags, s.mode === 'story', finiteNum(s.currentDay, 0)),
    // B-0 人口阶层（旧存档无 → 全归 farmer）
    populationClasses: deserializePopulationClasses(s.populationClasses, s.resources?.['people'] ?? 0),
    conversionQueue: deserializeConversionQueue(s.conversionQueue),
    grainNegativeDays: Math.max(0, Math.floor(finiteNum(s.grainNegativeDays, 0))),
    factionState: deserializeFactionState(s.factionState),
    megaProjects: deserializeMegaProjects(s.megaProjects),
    exclusivePolicies: Array.isArray(s.exclusivePolicies)
      ? s.exclusivePolicies.filter((x): x is string => typeof x === 'string')
      : [],
    // P4：军事/将领（旧存档无 → 空）。深拷贝防共享引用（含嵌套 config.units）+ 钳忠诚到 [0,100]。
    generals: Array.isArray(s.generals)
      ? s.generals.map(g => ({ id: String(g.id), loyalty: Math.max(0, Math.min(100, finiteNum(g.loyalty, 80))), deployed: !!g.deployed }))
      : [],
    activeExpeditions: deserializeActiveExpeditions(s.activeExpeditions),
    defenseAlerts: Array.isArray(s.defenseAlerts) ? s.defenseAlerts.map(a => ({ ...a })) : [],
  };
  return gameState;
}

/** 反序列化 storyFlags：sandbox 存档或缺省 → null；story 存档逐字段兜底 clamp。
 *  chapterStartDay 缺失时默认取存档当前日（而非 0），避免重载后"已过 currentДay 天"误判瞬间连跳章。 */
function deserializeStoryFlags(
  raw: SerializedSave['state']['storyFlags'],
  isStory: boolean,
  currentDay: number,
): GameState['storyFlags'] {
  if (!isStory || raw === null || raw === undefined || typeof raw !== 'object') return null;
  const up = (raw as { unifyPath?: unknown }).unifyPath;
  return {
    chapter: Math.max(0, Math.min(7, Math.floor(finiteNum((raw as { chapter?: unknown }).chapter, 0)))),
    unifyPath: up === 'martial' || up === 'cultural' ? up : null,
    unified: (raw as { unified?: unknown }).unified === true,
    powerAxis: Math.max(-100, Math.min(100, finiteNum((raw as { powerAxis?: unknown }).powerAxis, 0))),
    resourceAxis: Math.max(-100, Math.min(100, finiteNum((raw as { resourceAxis?: unknown }).resourceAxis, 0))),
    // 截断上限防损坏/恶意存档塞超长数组导致加载 OOM
    storyEventsTriggered: Array.isArray((raw as { storyEventsTriggered?: unknown }).storyEventsTriggered)
      ? ((raw as { storyEventsTriggered: unknown[] }).storyEventsTriggered)
          .slice(0, 500).filter((x): x is string => typeof x === 'string')
      : [],
    chapterStartDay: Math.max(0, Math.floor(finiteNum((raw as { chapterStartDay?: unknown }).chapterStartDay, currentDay))),
    ending: (() => {
      const e = (raw as { ending?: unknown }).ending;
      return e === 'gong' || e === 'jia' || e === 'huo' ? e : null;
    })(),
  };
}

function deserializePopulationClasses(raw: unknown, totalPeople: number): PopulationClasses {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return createDefaultPopulation(Math.max(0, Math.floor(totalPeople)));
  }
  const obj = raw as Record<string, unknown>;
  const result: PopulationClasses = { farmer: 0, worker: 0, soldier: 0, scholar: 0 };
  for (const cls of POPULATION_CLASSES) {
    const v = obj[cls];
    result[cls] = typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }
  if (result.farmer + result.worker + result.soldier + result.scholar === 0 && totalPeople > 0) {
    result.farmer = Math.floor(totalPeople);
  }
  return result;
}

function deserializeConversionQueue(raw: unknown): ConversionOrder[] {
  if (!Array.isArray(raw)) return [];
  const validClasses = new Set<string>(POPULATION_CLASSES);
  const out: ConversionOrder[] = [];
  for (const item of raw.slice(0, 50)) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (!validClasses.has(o['from'] as string) || !validClasses.has(o['to'] as string)) continue;
    const count = o['count'];
    const days = o['daysRemaining'];
    if (typeof count !== 'number' || count <= 0 || !Number.isFinite(count)) continue;
    if (typeof days !== 'number' || days <= 0 || !Number.isFinite(days)) continue;
    out.push({
      from: o['from'] as PopulationClass,
      to: o['to'] as PopulationClass,
      count: Math.floor(count),
      daysRemaining: Math.floor(days),
    });
  }
  return out;
}

function deserializeFactionState(raw: unknown): FactionState {
  if (raw === null || raw === undefined || typeof raw !== 'object') return createFactionState();
  const o = raw as Record<string, unknown>;
  return {
    active: o['active'] === true,
    lastEventDay: typeof o['lastEventDay'] === 'number' ? Math.floor(o['lastEventDay'] as number) : -1,
    nextEventDay: typeof o['nextEventDay'] === 'number' ? Math.floor(o['nextEventDay'] as number) : -1,
    activeDemand: null,
    acceptedDemands: Array.isArray(o['acceptedDemands'])
      ? (o['acceptedDemands'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    rejectedDemands: Array.isArray(o['rejectedDemands'])
      ? (o['rejectedDemands'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  };
}

function deserializeMegaProjects(raw: unknown): MegaProjectProgress[] {
  if (!Array.isArray(raw)) return [];
  const out: MegaProjectProgress[] = [];
  for (const item of (raw as unknown[]).slice(0, 10)) {
    if (typeof item !== 'object' || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o['projectId'] !== 'string') continue;
    out.push({
      projectId: o['projectId'] as string,
      currentPhase: typeof o['currentPhase'] === 'number' ? Math.max(0, Math.floor(o['currentPhase'] as number)) : 0,
      daysRemaining: typeof o['daysRemaining'] === 'number' ? Math.max(0, Math.floor(o['daysRemaining'] as number)) : 0,
      completed: o['completed'] === true,
    });
  }
  return out;
}

/**
 * 20260925-120418-82c6：出征记录 shape 校验。
 * 旧实现 `s.activeExpeditions.map(e => ({ ...e, config: { ...e.config, units: { ...e.config.units } } }))`
 * 在坏档（元素缺 config / config 缺 units / 元素非对象）上抛**裸 TypeError**
 * （`Cannot read properties of undefined (reading 'units')`），绕开 020c 立起来的
 * SaveLoadError 统一通道——面板只会显示一句与存档无关的栈内话术，玩家无从定位是哪个槽哪条记录。
 * 口径：只补「拒载 + 下标定位」，合法档的**逐条深拷贝**语义（读入状态与 blob 不共享嵌套引用）一字未改。
 */
function deserializeActiveExpeditions(raw: unknown): ActiveExpedition[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new SaveLoadError('[saveLoad] activeExpeditions must be an array');
  }
  const out: ActiveExpedition[] = [];
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i];
    if (typeof e !== 'object' || e === null || Array.isArray(e)) {
      throw new SaveLoadError(`[saveLoad] activeExpeditions[${i}] is not an object`);
    }
    const rec = e as Record<string, unknown>;
    const cfg = rec['config'];
    if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) {
      throw new SaveLoadError(`[saveLoad] activeExpeditions[${i}].config is missing or not an object`);
    }
    const units = (cfg as Record<string, unknown>)['units'];
    if (typeof units !== 'object' || units === null || Array.isArray(units)) {
      throw new SaveLoadError(`[saveLoad] activeExpeditions[${i}].config.units is missing or not an object`);
    }
    out.push({
      ...(e as ActiveExpedition),
      config: {
        ...(cfg as ActiveExpedition['config']),
        units: { ...(units as ActiveExpedition['config']['units']) },
      },
    });
  }
  return out;
}

const VALID_WAR_STATUS = new Set<WarStatus>(['peace', 'tension', 'war']);

/** 读一个有限数值字段，拒绝 NaN/Infinity（typeof 不过滤这两者，会绕过冷却或永久锁死）。 */
function finiteNum(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** 国格级钳制到 0..5 整数。 */
function clampGrade(v: number): number {
  return Math.max(0, Math.min(5, Math.floor(v)));
}

function validateNpcCountriesArray(arr: unknown): NpcCountryState[] {
  if (!Array.isArray(arr)) return makeInitialNpcStates();
  const out: NpcCountryState[] = [];
  for (const it of arr) {
    if (typeof it !== 'object' || it === null) continue;
    const o = it as Record<string, unknown>;
    if (typeof o['id'] !== 'string') continue;
    const ws = o['warStatus'];
    const warStatus: WarStatus = typeof ws === 'string' && VALID_WAR_STATUS.has(ws as WarStatus) ? (ws as WarStatus) : 'peace';
    out.push({
      id: o['id'] as string,
      stance: typeof o['stance'] === 'number' ? Math.max(-100, Math.min(100, o['stance'] as number)) : 0,
      militaryPower: typeof o['militaryPower'] === 'number' ? Math.max(0, Math.min(500, o['militaryPower'] as number)) : 50,
      renown: typeof o['renown'] === 'number' ? Math.max(0, Math.min(200, o['renown'] as number)) : 50,
      tradeRoute: o['tradeRoute'] === true,
      tradeCooldown: typeof o['tradeCooldown'] === 'number' ? Math.max(0, o['tradeCooldown'] as number) : 0,
      warStatus,
      // 向后兼容：旧存档只有共用的 lastActionDay。迁移时两路冷却都继承它——
      // 旧字段无法区分上次是出使还是兴师，故保守地两边都锁（至多一次性多等几日，
      // 不会产生"凭空解锁"漏洞）。NaN/Infinity 一律按 -1 处理。
      lastEnvoyDay: finiteNum(o['lastEnvoyDay'], finiteNum(o['lastActionDay'], -1)),
      lastWarDay: finiteNum(o['lastWarDay'], finiteNum(o['lastActionDay'], -1)),
      // Phase1 动态成长字段（旧存档无 → 兜底）
      allyIds: Array.isArray(o['allyIds']) ? (o['allyIds'] as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      aggression: Math.max(0, Math.min(100, finiteNum(o['aggression'], 40))),
      lastActionDay: finiteNum(o['lastActionDay'], -1),
    });
  }
  return out.length > 0 ? out : makeInitialNpcStates();
}

const VALID_BUILDING_STATUS = new Set<BuildingStatus>(['idle', 'constructing', 'working', 'paused', 'derelict']);
const VALID_BUILDING_TIER = new Set<BuildingTier>([1, 2, 3, 4]);

/**
 * Slice G hardening：deserialize 时校验 buildings 数组每条 shape。
 * tickDay/runProductionTick 假设 status/tier 字段合法；存档损坏让其沉默渗透
 * 会引发"建筑不产出但也不报错"的诡异 bug。
 */
function validateBuildingsArray(raw: unknown): BuildingInstance[] {
  if (!Array.isArray(raw)) {
    throw new SaveLoadError('[saveLoad] buildings must be an array');
  }
  const out: BuildingInstance[] = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    if (typeof b !== 'object' || b === null) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}] is not an object`);
    }
    const rec = b as Record<string, unknown>;
    if (typeof rec['defId'] !== 'string' || rec['defId'].length === 0) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].defId must be a non-empty string`);
    }
    const pos = rec['position'];
    if (typeof pos !== 'object' || pos === null) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].position is not an object`);
    }
    const px = (pos as Record<string, unknown>)['x'];
    const py = (pos as Record<string, unknown>)['y'];
    if (!Number.isInteger(px) || !Number.isInteger(py)) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].position.{x,y} must be integers`);
    }
    if (typeof rec['status'] !== 'string' || !VALID_BUILDING_STATUS.has(rec['status'] as BuildingStatus)) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].status invalid: "${String(rec['status'])}"`);
    }
    if (typeof rec['tier'] !== 'number' || !VALID_BUILDING_TIER.has(rec['tier'] as BuildingTier)) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].tier invalid: "${String(rec['tier'])}"`);
    }
    const rawProgress = rec['constructionProgress'];
    if (typeof rawProgress !== 'number' || !Number.isFinite(rawProgress)) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].constructionProgress must be finite number`);
    }
    // p911r-40：钳制到 [0,100]（游戏语义为百分比，gameStore productionTick 同口径；越界值来自损坏档）
    const progress = Math.min(100, Math.max(0, rawProgress));
    if (!Array.isArray(rec['modifiers']) || (rec['modifiers'] as unknown[]).some(m => typeof m !== 'string')) {
      throw new SaveLoadError(`[saveLoad] buildings[${i}].modifiers must be array of string ids`);
    }
    // v0.9：upgradingTo 可选；若存在必须是非空字符串
    let upgradingTo: string | undefined;
    if (rec['upgradingTo'] !== undefined && rec['upgradingTo'] !== null) {
      if (typeof rec['upgradingTo'] !== 'string' || rec['upgradingTo'].length === 0) {
        throw new SaveLoadError(`[saveLoad] buildings[${i}].upgradingTo must be a non-empty string when present`);
      }
      upgradingTo = rec['upgradingTo'];
    }
    out.push({
      defId: rec['defId'],
      position: { x: px as number, y: py as number },
      status: rec['status'] as BuildingStatus,
      tier: rec['tier'] as BuildingTier,
      constructionProgress: progress,
      modifiers: rec['modifiers'] as string[],
      ...(upgradingTo !== undefined ? { upgradingTo } : {}),
    });
  }
  return out;
}

const VALID_SLOT_RE = /^[a-z0-9_-]{1,32}$/;

export function validateSlot(slot: string): void {
  if (!VALID_SLOT_RE.test(slot)) {
    throw new SaveLoadError(
      `[saveLoad] Invalid save slot name "${slot}": must match [a-z0-9_-]{1,32}`,
    );
  }
}

type ColonyApiShape = {
  saveGame(slot: string, json: string): Promise<boolean>;
  loadGame(slot: string): Promise<string | null>;
  /** c1006-08：坏档只读回退通道（preload 未更新形态下可选） */
  loadGameBak?(slot: string): Promise<string | null>;
  getSaveMeta(slot: string): Promise<SaveMeta | null>;
};

export interface SaveMeta {
  slot: string;
  savedAt: number;
  currentDay: number | null;
}

function getColonyApi(): ColonyApiShape {
  return (window as unknown as { colonyApi: ColonyApiShape }).colonyApi;
}

export async function saveToSlot(slot: string, store: GameStore): Promise<void> {
  validateSlot(slot);
  store.setLastSeenNow();
  // c922-103：写档链路与读档链路语义对齐——主进程 saveGame 返回 false 即写盘未成功，
  // 原先整行丢弃返回值会让保存失败静默；统一走 SaveLoadError 通道（消息含槽位名）。
  const written = await getColonyApi().saveGame(slot, JSON.stringify(serialize(store.getState())));
  if (written === false) {
    throw new SaveLoadError(`[saveLoad] Save to slot "${slot}" failed: storage layer wrote nothing`);
  }
}

// c1006-08（坏档只读回退·保守形态）：读前一代 .bak 并走同一 deserialize 解析链。
// 只读语义：不提正、不覆盖坏档；.bak 缺失/不可解析 ⇒ null（UI 侧即停，不无限链）。
export async function loadFromSlotBak(slot: string): Promise<GameState | null> {
  validateSlot(slot);
  const api = getColonyApi();
  if (typeof api.loadGameBak !== 'function') return null;   // preload 未更新形态兜底
  const raw = await api.loadGameBak(slot);
  if (raw === null) return null;
  try {
    return deserialize(JSON.parse(raw));
  } catch (err) {
    console.warn(`[saveLoad] .bak 回退失败（slot=${slot}）：`, err);
    return null;
  }
}

export async function loadFromSlot(slot: string): Promise<GameState | null> {
  validateSlot(slot);
  const raw = await getColonyApi().loadGame(slot);
  if (raw === null) return null;
  // 020c：截断/损坏档不再裸抛 SyntaxError，统一 SaveLoadError 通道
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new SaveLoadError(
      `[saveLoad] Save file in slot "${slot}" is corrupted (not valid JSON): ${(err as Error).message}`,
    );
  }
  return deserialize(parsed);
}

/** 读取单个存档槽的元信息（不反序列化整份状态，供存档面板展示）。 */
export async function getSaveMeta(slot: string): Promise<SaveMeta | null> {
  validateSlot(slot);
  return getColonyApi().getSaveMeta(slot);
}
