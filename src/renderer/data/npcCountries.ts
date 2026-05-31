import type { NpcCountryDef, NpcCountryState } from './schema';

/**
 * v1.0 #6：3 个 NPC 邦国 —— 解决"只有一个国家太单调"。
 *
 * 名称取自春秋早期诸侯国，避免明显的"中原核心"偏见：
 *   - 齐：东方商业大邦，通商最得利，开战不占优
 *   - 晋：北方军事强藩，骑战之利，外交不易动
 *   - 鲁：礼制传承之邦，文化感染好，正面事件触发概率较高
 */
export const NPC_COUNTRIES: NpcCountryDef[] = [
  {
    id: 'npc_qi',
    name: '齐',
    archetype: 'commercial',
    homeColor: 0xCAB47C,
    description: '东海濒临，鱼盐之利。',
    descPlain: '【商】东方大邦，重商善贾。通商收益最高，但军力中等。',
    initialStance: 10,
    initialMilitaryPower: 60,
    initialRenown: 50,
  },
  {
    id: 'npc_jin',
    name: '晋',
    archetype: 'martial',
    homeColor: 0x8B6F4A,
    description: '北方险塞，戎马之邦。',
    descPlain: '【武】山西高原，骁勇善战。军力最强，外交难动，开战要慎重。',
    initialStance: -10,
    initialMilitaryPower: 90,
    initialRenown: 40,
  },
  {
    id: 'npc_lu',
    name: '鲁',
    archetype: 'cultural',
    homeColor: 0xC9B27A,
    description: '周公之裔，礼乐所宗。',
    descPlain: '【礼】东方礼制传承之邦。外交事件触发概率高，军力较弱。',
    initialStance: 20,
    initialMilitaryPower: 40,
    initialRenown: 65,
  },
];

export function makeInitialNpcStates(): NpcCountryState[] {
  return NPC_COUNTRIES.map(def => ({
    id: def.id,
    stance: def.initialStance,
    militaryPower: def.initialMilitaryPower,
    renown: def.initialRenown,
    tradeRoute: false,
    tradeCooldown: 0,
    warStatus: 'peace' as const,
    lastActionDay: -1,
  }));
}

export function getNpcDef(id: string): NpcCountryDef | undefined {
  return NPC_COUNTRIES.find(d => d.id === id);
}
