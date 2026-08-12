/**
 * B-4.1 阶层博弈数据：人口>80后出现三大势力。
 * 参考 Frostpunk 法案 + CK3 派系。
 */

export const FACTION_IDS = ['tycoon', 'consort', 'literati'] as const;
export type FactionId = typeof FACTION_IDS[number];

export interface FactionDemand {
  factionId: FactionId;
  demandId: string;
  title: string;
  description: string;
  acceptEffect: FactionEffect;
  rejectEffect: FactionEffect;
}

export interface FactionEffect {
  morale?: number;
  goldMul?: number;
  researchMul?: number;
  loyaltyDelta?: number;
  policySlotCost?: number;
  axisShift?: { axis: 'power' | 'wealth'; delta: number };
}

export const FACTION_NAMES: Record<FactionId, string> = {
  tycoon: '豪强',
  consort: '外戚',
  literati: '士人',
};

export const FACTION_DEMANDS: FactionDemand[] = [
  {
    factionId: 'tycoon',
    demandId: 'demand_tax_cut',
    title: '豪强请减赋',
    description: '地方豪强联名上书，请求减轻商税。',
    acceptEffect: { goldMul: -0.20 },
    rejectEffect: { morale: -5 },
  },
  {
    factionId: 'consort',
    demandId: 'demand_reward',
    title: '外戚求封赏',
    description: '后宫亲族请求封地食邑。',
    acceptEffect: { policySlotCost: 1 },
    rejectEffect: { loyaltyDelta: -10 },
  },
  {
    factionId: 'literati',
    demandId: 'demand_court_debate',
    title: '士人请开朝议',
    description: '儒生要求开放朝堂辩论，广纳民言。',
    acceptEffect: { axisShift: { axis: 'power', delta: -10 } },
    rejectEffect: { researchMul: -0.20 },
  },
];

export const FACTION_TRIGGER_POPULATION = 80;
export const FACTION_EVENT_INTERVAL_MIN = 60;
export const FACTION_EVENT_INTERVAL_MAX = 90;
