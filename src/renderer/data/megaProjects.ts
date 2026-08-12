/**
 * B-4.2 巨型工程数据定义。
 * 每工程分多阶段，总耗时长、消耗大、奖励强。
 */

import type { ResourceId } from './resourceRegistry';

export interface MegaProjectPhase {
  durationDays: number;
  cost: Partial<Record<ResourceId, number>>;
  peopleLocked?: { class: 'farmer' | 'worker' | 'soldier' | 'scholar'; count: number };
}

export interface MegaProjectDef {
  id: string;
  name: string;
  description: string;
  prerequisiteBuilding?: string;
  phases: MegaProjectPhase[];
  reward: MegaProjectReward;
}

export interface MegaProjectReward {
  renown?: number;
  permanentDeter?: boolean;
  researchMul?: number;
  productionMul?: number;
  tradeMul?: number;
}

export const MEGA_PROJECTS: MegaProjectDef[] = [
  {
    id: 'proj_nine_cauldrons',
    name: '铸九鼎',
    description: '集天下铜铁，铸九州之鼎，传国重器。',
    prerequisiteBuilding: 'bld_grand_temple',
    phases: [
      { durationDays: 30, cost: { bronze: 70, rite: 30 } },
      { durationDays: 30, cost: { bronze: 70, rite: 35 } },
      { durationDays: 30, cost: { bronze: 60, rite: 35 } },
    ],
    reward: { renown: 50, permanentDeter: true },
  },
  {
    id: 'proj_spring_autumn',
    name: '作春秋',
    description: '笔削典籍，褒贬百王，以史昭后世。',
    prerequisiteBuilding: 'bld_grand_temple',
    phases: [
      { durationDays: 30, cost: { cloth: 20, gold: 40 }, peopleLocked: { class: 'scholar', count: 10 } },
      { durationDays: 30, cost: { cloth: 20, gold: 40 }, peopleLocked: { class: 'scholar', count: 10 } },
      { durationDays: 30, cost: { cloth: 20, gold: 40 }, peopleLocked: { class: 'scholar', count: 10 } },
      { durationDays: 30, cost: { cloth: 20, gold: 40 }, peopleLocked: { class: 'scholar', count: 10 } },
      { durationDays: 30, cost: { cloth: 20, gold: 40 }, peopleLocked: { class: 'scholar', count: 10 } },
    ],
    reward: { researchMul: 0.30 },
  },
  {
    id: 'proj_royal_road',
    name: '修直道',
    description: '修直道贯通四方，使车马如飞。',
    phases: [
      { durationDays: 30, cost: { stone: 75, wood: 50 }, peopleLocked: { class: 'farmer', count: 30 } },
      { durationDays: 30, cost: { stone: 75, wood: 50 }, peopleLocked: { class: 'farmer', count: 30 } },
      { durationDays: 30, cost: { stone: 75, wood: 50 }, peopleLocked: { class: 'farmer', count: 30 } },
      { durationDays: 30, cost: { stone: 75, wood: 50 }, peopleLocked: { class: 'farmer', count: 30 } },
    ],
    reward: { productionMul: 0.10, tradeMul: 0.50 },
  },
];

export function getMegaProject(id: string): MegaProjectDef | undefined {
  return MEGA_PROJECTS.find(p => p.id === id);
}
