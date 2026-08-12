/**
 * B-4.3 国策互斥组。
 * 后期（诸侯+）解锁的国策出现互斥：选一锁一。
 */

export interface PolicyExclusionGroup {
  groupId: string;
  name: string;
  minGrade: number;
  policies: [PolicyOption, PolicyOption];
}

export interface PolicyOption {
  id: string;
  name: string;
  description: string;
  effects: PolicyEffects;
}

export interface PolicyEffects {
  goldMul?: number;
  grainMul?: number;
  militaryMul?: number;
  allResourceMul?: number;
  spyRisk?: boolean;
}

export const POLICY_EXCLUSION_GROUPS: PolicyExclusionGroup[] = [
  {
    groupId: 'economy_focus',
    name: '经济路线',
    minGrade: 4,
    policies: [
      {
        id: 'pol_mercantilism',
        name: '重商主义',
        description: '重利轻农，金产出大增而粮缺。',
        effects: { goldMul: 0.30, grainMul: -0.15 },
      },
      {
        id: 'pol_agrarianism',
        name: '重农主义',
        description: '以农为本，粮产出大增而商利薄。',
        effects: { grainMul: 0.30, goldMul: -0.15 },
      },
    ],
  },
  {
    groupId: 'military_stance',
    name: '军事路线',
    minGrade: 4,
    policies: [
      {
        id: 'pol_militarism',
        name: '扩军备战',
        description: '枕戈待旦，军力大增而民生受损。',
        effects: { militaryMul: 0.50 },
      },
      {
        id: 'pol_recuperation',
        name: '休养生息',
        description: '与民休息，全面产出提升但军力不增。',
        effects: { allResourceMul: 0.15 },
      },
    ],
  },
  {
    groupId: 'trade_stance',
    name: '对外贸易',
    minGrade: 4,
    policies: [
      {
        id: 'pol_open_trade',
        name: '开放边贸',
        description: '通商四海，金多但间谍频至。',
        effects: { goldMul: 0.20, spyRisk: true },
      },
      {
        id: 'pol_isolationism',
        name: '闭关锁国',
        description: '自给自足，安全但收入低。',
        effects: { goldMul: -0.10 },
      },
    ],
  },
];

export function getExclusionGroup(groupId: string): PolicyExclusionGroup | undefined {
  return POLICY_EXCLUSION_GROUPS.find(g => g.groupId === groupId);
}

export function getExcludedPolicyId(selectedPolicyId: string): string | undefined {
  for (const group of POLICY_EXCLUSION_GROUPS) {
    if (group.policies[0].id === selectedPolicyId) return group.policies[1].id;
    if (group.policies[1].id === selectedPolicyId) return group.policies[0].id;
  }
  return undefined;
}
