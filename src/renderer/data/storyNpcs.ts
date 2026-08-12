/**
 * C-4 故事模式固定 NPC（4 个，各有性格弧线）。
 * 与沙盒的随机 4 NPC 不同，故事模式使用固定阵容。
 * 第四个为外来强敌（第 7 章登场）。
 */

import type { NpcCountryDef, NpcCountryState } from './schema';

export const STORY_NPC_DEFS: NpcCountryDef[] = [
  {
    id: 'npc_story_qi',
    name: '齐',
    archetype: 'commercial',
    homeColor: 0xCAB47C,
    description: '东海通商，富甲一方。',
    descPlain: '【商】故事第一邦：齐。通商为本，前期友好，中期可能因利益翻脸。',
    initialStance: 20,
    initialMilitaryPower: 55,
    initialRenown: 50,
  },
  {
    id: 'npc_story_jin',
    name: '晋',
    archetype: 'martial',
    homeColor: 0x8B6F4A,
    description: '北地精兵，虎视中原。',
    descPlain: '【武】故事第二邦：晋。好战尚武，前期压力源。可通过联姻缓和。',
    initialStance: -20,
    initialMilitaryPower: 90,
    initialRenown: 40,
  },
  {
    id: 'npc_story_lu',
    name: '鲁',
    archetype: 'cultural',
    homeColor: 0xC9B27A,
    description: '周公之后，礼教正统。',
    descPlain: '【礼】故事第三邦：鲁。外交友好但军弱，可成稳定盟友。',
    initialStance: 30,
    initialMilitaryPower: 35,
    initialRenown: 65,
  },
  {
    id: 'npc_story_invader',
    name: '大梁',
    archetype: 'martial',
    homeColor: 0x4A3520,
    description: '铁骑南下，席卷万里。',
    descPlain: '【武】故事终章强敌：大梁。第 7 章登场，军力远超当前所有邦国。',
    initialStance: -80,
    initialMilitaryPower: 200,
    initialRenown: 80,
  },
];

export function makeStoryNpcStates(): NpcCountryState[] {
  return STORY_NPC_DEFS.map(def => ({
    id: def.id,
    stance: def.initialStance,
    militaryPower: def.initialMilitaryPower,
    renown: def.initialRenown,
    tradeRoute: false,
    tradeCooldown: 0,
    warStatus: 'peace' as const,
    lastEnvoyDay: -1,
    lastWarDay: -1,
    allyIds: [],
    aggression: def.archetype === 'martial' ? 70 : def.archetype === 'tribal' ? 80 : 30,
    lastActionDay: -1,
  }));
}

export interface StoryNpcArcBeat {
  chapter: number;
  npcId: string;
  stanceShift: number;
  narrativeNote: string;
}

export const STORY_NPC_ARC_BEATS: StoryNpcArcBeat[] = [
  { chapter: 2, npcId: 'npc_story_qi', stanceShift: 10, narrativeNote: '齐使来贺升邦。' },
  { chapter: 3, npcId: 'npc_story_jin', stanceShift: -10, narrativeNote: '晋对我扩张日益警惕。' },
  { chapter: 4, npcId: 'npc_story_lu', stanceShift: 15, narrativeNote: '鲁欲结盟对抗晋。' },
  { chapter: 5, npcId: 'npc_story_qi', stanceShift: -20, narrativeNote: '齐因贸易纠纷转冷。' },
  { chapter: 5, npcId: 'npc_story_jin', stanceShift: 10, narrativeNote: '晋面临蛮夷压力，对我缓和。' },
  { chapter: 6, npcId: 'npc_story_lu', stanceShift: -5, narrativeNote: '鲁对我权力集中有微词。' },
  { chapter: 7, npcId: 'npc_story_invader', stanceShift: -20, narrativeNote: '大梁铁骑南下！' },
];
