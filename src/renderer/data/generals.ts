/**
 * B-2 将领系统数据定义。
 * 上限 4 位将领同时在编。
 */

export const GENERAL_TRAITS = ['attack_boost', 'defense_boost', 'ambush', 'inspire', 'frugal'] as const;
export type GeneralTrait = typeof GENERAL_TRAITS[number];

export const TRAIT_NAMES: Record<GeneralTrait, string> = {
  attack_boost: '善攻',
  defense_boost: '善守',
  ambush: '善伏击',
  inspire: '鼓舞',
  frugal: '节粮',
};

export const TRAIT_EFFECTS: Record<GeneralTrait, { attackMul?: number; defenseMul?: number; moraleFloor?: number; grainMul?: number; ambushBonus?: boolean }> = {
  attack_boost: { attackMul: 1.20 },
  defense_boost: { defenseMul: 1.20 },
  ambush: { ambushBonus: true },
  inspire: { moraleFloor: 50 },
  frugal: { grainMul: 0.70 },
};

export interface GeneralDef {
  id: string;
  name: string;
  command: number;
  traits: GeneralTrait[];
  source: 'story' | 'event' | 'grade_reward' | 'captured';
}

export const GENERAL_POOL: GeneralDef[] = [
  { id: 'gen_pei_shao', name: '裴绍', command: 15, traits: ['attack_boost', 'inspire'], source: 'story' },
  { id: 'gen_hu_ben', name: '虎贲子', command: 20, traits: ['attack_boost', 'ambush'], source: 'event' },
  { id: 'gen_xie_changqing', name: '谢长卿', command: 15, traits: ['defense_boost', 'frugal'], source: 'grade_reward' },
  { id: 'gen_tian_zhong', name: '田仲', command: 10, traits: ['inspire', 'frugal'], source: 'event' },
  { id: 'gen_barbarian', name: '降将', command: 10, traits: [], source: 'captured' },
];

export interface GeneralState {
  id: string;
  loyalty: number;
  /** 当前是否出征中（不可再派） */
  deployed: boolean;
}

export const MAX_GENERALS = 4;
export const LOYALTY_DEFECT_THRESHOLD = 30;
export const LOYALTY_DEFECT_CHANCE = 0.05;
export const LOYALTY_DECAY_PER_MONTH = 2;
export const LOYALTY_WIN_BONUS = 5;
export const LOYALTY_LOSS_PENALTY = 10;
