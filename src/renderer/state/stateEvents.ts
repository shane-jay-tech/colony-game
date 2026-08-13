/**
 * P1 类型化事件面：每个 STATE_EVENTS 值 → 载荷类型的编译期契约。
 * GameStore.on/off/emit 用此映射泛型化；监听方仍可用 (payload: unknown)（逆变兼容）。
 * 覆盖完整性由 stateEvents.test 运行时守护（STATE_EVENTS 值必须全部是 map 的 key）。
 */
import type { BuildingInstance, ModifierInstance } from '../data/schema';
import type { ResourceId } from '../data/resourceRegistry';
import type { ProductionTickResult } from './productionSystem';
import type { DiplomacyResult } from './diplomacySystem';
import type { GradeDef } from '../data/countryGrades';
import type { ChapterDef } from '../data/storyChapters';

export interface GameStateEventMap {
  'state:resourcesChanged': { deltas: Partial<Record<ResourceId, number>>; reason?: string };
  'state:dayTick': number;
  'state:seasonTick': { season: 0 | 1 | 2 | 3; seasonName: string; year: number };
  'state:yearTick': { year: number };
  'state:modifierAdded': ModifierInstance | { id: string };
  'state:modifierRemoved': { id: string };
  'state:buildingPlaced': BuildingInstance;
  'state:buildingCompleted': BuildingInstance;
  'state:pausedChanged': boolean;
  'state:speedChanged': number;
  'state:replaced': void;
  'state:productionTick': ProductionTickResult;
  'state:policyAdopted': { policyId: string };
  'state:decreeAdopted': { decreeId: string };
  'state:decreeAdvanced': { decreeId: string; fromStage: number; toStage: number };
  'state:decreeCompleted': { decreeId: string; fromStage: number };
  'state:decreeStalled': { decreeId: string; stage: number };
  'state:eventTriggered': { eventId: string };
  'state:eventResolved': { eventId: string; choiceIdx: number; applied: boolean };
  'state:tutorialStepChanged': string;
  'state:panelCollapsedChanged': { side: 'left' | 'right'; collapsed: boolean };
  'state:buildingUpgraded': { instance: BuildingInstance; fromDefId: string; toDefId: string } | BuildingInstance;
  'state:buildingRemoved': { instance: BuildingInstance };
  'state:diplomacyAction': { npcId: string; kind: 'trade' | 'envoy' | 'war'; result: DiplomacyResult };
  'state:tradeTick': { deltas: Partial<Record<ResourceId, number>> };
  'state:gradeChanged': { from: number; to: number; def?: GradeDef; reason?: string };
  'state:tianxiaAcknowledged': { def: GradeDef };
  'state:crisisTriggered': { kind: string; summary: string; crisisCount: number };
  'state:npcAction': { kind: string; actorName: string; targetName: string; text: string };
  'state:npcDynamicsTick': void;
  'state:storyUnified': { path: string };
  'state:storyChapterChanged': { chapter: number; def: ChapterDef };
  'state:storyNarration': { text: string };
  'state:storyEnding': { ending: string };
  'state:breathingToast': { entry: unknown };
  'state:breathingBulletin': { entry: unknown };
  'state:historianAdvice': { advice: unknown };
  'state:factionDemandTriggered': { demand: unknown; factionName: string };
  'state:factionDemandResolved': { demandId: string; accepted: boolean };
  'state:megaProjectStarted': { projectId: string; def: unknown };
  'state:megaProjectCompleted': { projectId: string; def: unknown; reward: unknown };
  'state:expeditionResolved': unknown;
  'state:generalsChanged': { id?: string; defected?: string[] };
  'state:militaryChanged': Record<string, never>;
  'state:defenseAlert': { alert: unknown };
  'state:moraleChanged': { value: number; reason: string };
  'state:wrathChanged': { value: number; reason: string };
  'state:wrathAlert': { text: string };
  'state:worldWarinessChanged': { value: number; reason: string };
  'state:relicResolved': { name: string; summary: string };
  'state:endgameWave': { kind: string; severity: number; text: string };
  'state:actChanged': { id: string; name: string; subtitle: string; day: number };
}

export type StateEventName = keyof GameStateEventMap;

/** 运行时名单：与 GameStateEventMap 的 key 一一对应（stateEvents.test 守护同步）。 */
export const STATE_EVENT_NAMES = [
  'state:resourcesChanged',
  'state:dayTick',
  'state:seasonTick',
  'state:yearTick',
  'state:modifierAdded',
  'state:modifierRemoved',
  'state:buildingPlaced',
  'state:buildingCompleted',
  'state:pausedChanged',
  'state:speedChanged',
  'state:replaced',
  'state:productionTick',
  'state:policyAdopted',
  'state:decreeAdopted',
  'state:decreeAdvanced',
  'state:decreeCompleted',
  'state:decreeStalled',
  'state:eventTriggered',
  'state:eventResolved',
  'state:tutorialStepChanged',
  'state:panelCollapsedChanged',
  'state:buildingUpgraded',
  'state:buildingRemoved',
  'state:diplomacyAction',
  'state:tradeTick',
  'state:gradeChanged',
  'state:tianxiaAcknowledged',
  'state:crisisTriggered',
  'state:npcAction',
  'state:npcDynamicsTick',
  'state:storyUnified',
  'state:storyChapterChanged',
  'state:storyNarration',
  'state:storyEnding',
  'state:breathingToast',
  'state:breathingBulletin',
  'state:historianAdvice',
  'state:factionDemandTriggered',
  'state:factionDemandResolved',
  'state:megaProjectStarted',
  'state:megaProjectCompleted',
  'state:expeditionResolved',
  'state:generalsChanged',
  'state:militaryChanged',
  'state:defenseAlert',
  'state:moraleChanged',
  'state:wrathChanged',
  'state:wrathAlert',
  'state:worldWarinessChanged',
  'state:relicResolved',
  'state:endgameWave',
  'state:actChanged',
] as const satisfies readonly StateEventName[];
