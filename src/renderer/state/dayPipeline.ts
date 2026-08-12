/**
 * 每日阶段调度器的单一事实源。
 *
 * tickDay 里「日历推进」是前置步（day+1 + 快照），随后按 DAY_PHASE_ORDER 依次执行
 * 各域阶段。阶段顺序有跨域依赖（军事→NPC 决策→人口→饥荒→危机→国格→派系…），
 * 任何重排必须显式改 DAY_PHASE_ORDER 并补顺序测试，不许在调用点就地调换。
 */

export type DayPhaseId =
  | 'modifierExpiry'
  | 'seasonTransition'
  | 'construction'
  | 'calendarEvents'
  | 'production'
  | 'military'
  | 'decrees'
  | 'events'
  | 'diplomacy'
  | 'npcDynamics'
  | 'population'
  | 'conversion'
  | 'starvation'
  | 'crisis'
  | 'grade'
  | 'factions'
  | 'megaProjects'
  | 'story'
  | 'breathing'
  | 'historian';

export type DayPhaseDomain =
  | 'time'
  | 'economy'
  | 'population'
  | 'diplomacy'
  | 'military'
  | 'progression'
  | 'narrative';

export interface DayPhaseDef {
  domain: DayPhaseDomain;
  name: string;
}

export interface DayPhase extends DayPhaseDef {
  id: DayPhaseId;
  run: () => void;
}

export const DAY_PHASE_DEFS: Record<DayPhaseId, DayPhaseDef> = {
  modifierExpiry: { domain: 'economy', name: '调整到期' },
  seasonTransition: { domain: 'time', name: '季节切换' },
  construction: { domain: 'economy', name: '建造推进' },
  calendarEvents: { domain: 'time', name: '日历事件' },
  production: { domain: 'economy', name: '生产结算' },
  military: { domain: 'military', name: '军务节拍' },
  decrees: { domain: 'economy', name: '朝令推进' },
  events: { domain: 'progression', name: '事件采样' },
  diplomacy: { domain: 'diplomacy', name: '邦交节拍' },
  npcDynamics: { domain: 'diplomacy', name: '邻国动态' },
  population: { domain: 'population', name: '人口增长' },
  conversion: { domain: 'population', name: '阶层转化' },
  starvation: { domain: 'population', name: '饥荒结算' },
  crisis: { domain: 'progression', name: '危机判定' },
  grade: { domain: 'progression', name: '国格判定' },
  factions: { domain: 'population', name: '阶层博弈' },
  megaProjects: { domain: 'progression', name: '巨型工程' },
  story: { domain: 'narrative', name: '故事导演' },
  breathing: { domain: 'narrative', name: '世界呼吸' },
  historian: { domain: 'narrative', name: '史官谏言' },
};

export const DAY_PHASE_ORDER: readonly DayPhaseId[] = [
  'modifierExpiry',
  'seasonTransition',
  'construction',
  'calendarEvents',
  'production',
  'military',
  'decrees',
  'events',
  'diplomacy',
  'npcDynamics',
  'population',
  'conversion',
  'starvation',
  'crisis',
  'grade',
  'factions',
  'megaProjects',
  'story',
  'breathing',
  'historian',
];

/** 由 handler 表按 DAY_PHASE_ORDER 组装管道；缺 handler 直接抛错（顺序表与实现不同步即暴露）。 */
export function buildDayPipeline(handlers: Record<DayPhaseId, () => void>): DayPhase[] {
  const missing = DAY_PHASE_ORDER.filter((id) => typeof handlers[id] !== 'function');
  if (missing.length > 0) {
    throw new Error(`day pipeline missing handlers: ${missing.join(', ')}`);
  }
  return DAY_PHASE_ORDER.map((id) => ({
    id,
    domain: DAY_PHASE_DEFS[id].domain,
    name: DAY_PHASE_DEFS[id].name,
    run: handlers[id],
  }));
}

export function runDayPipeline(phases: readonly DayPhase[]): void {
  for (const phase of phases) phase.run();
}
