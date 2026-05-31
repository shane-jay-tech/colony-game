import type { NpcArchetype, NpcCountryDef, NpcCountryState } from './schema';

/**
 * NPC 邦国池（Phase1 动态成长）——从前固定齐晋鲁 3 邦，现扩成 8 邦的池子，
 * 每局开局用种子确定性随机抽 4 个（保证含 ≥1 蛮夷），不同局阵容不同。
 *
 * archetype：
 *   commercial 商（通商利高、军弱中）/ martial 武（军强、外交难动）/
 *   cultural 礼（外交事件多、军弱）/ tribal 夷（戎狄，不结盟、任何阶段骚扰）。
 */
export const NPC_POOL: NpcCountryDef[] = [
  {
    id: 'npc_qi', name: '齐', archetype: 'commercial', homeColor: 0xCAB47C,
    description: '东海濒临，鱼盐之利。',
    descPlain: '【商】东方大邦，重商善贾。通商收益最高，军力中等。',
    initialStance: 10, initialMilitaryPower: 60, initialRenown: 50,
  },
  {
    id: 'npc_jin', name: '晋', archetype: 'martial', homeColor: 0x8B6F4A,
    description: '北方险塞，戎马之邦。',
    descPlain: '【武】北地高原，骁勇善战。军力强，外交难动，开战要慎重。',
    initialStance: -10, initialMilitaryPower: 90, initialRenown: 40,
  },
  {
    id: 'npc_lu', name: '鲁', archetype: 'cultural', homeColor: 0xC9B27A,
    description: '周公之裔，礼乐所宗。',
    descPlain: '【礼】东方礼制之邦。外交事件多，军力较弱。',
    initialStance: 20, initialMilitaryPower: 40, initialRenown: 65,
  },
  {
    id: 'npc_song', name: '宋', archetype: 'commercial', homeColor: 0xB89A6A,
    description: '殷商遗民，居中通货。',
    descPlain: '【商】商旅辐辏的中原之邦，富而军弱。',
    initialStance: 5, initialMilitaryPower: 45, initialRenown: 55,
  },
  {
    id: 'npc_chu', name: '楚', archetype: 'martial', homeColor: 0x7A5C3A,
    description: '南方大邦，问鼎之志。',
    descPlain: '【武】南方强藩，军力雄厚而傲慢，对外邦态度冷淡。',
    initialStance: -20, initialMilitaryPower: 100, initialRenown: 45,
  },
  {
    id: 'npc_zheng', name: '郑', archetype: 'cultural', homeColor: 0xC0A86E,
    description: '居天下之中，长袖善舞。',
    descPlain: '【礼】中原枢纽小霸，外交最活跃，善于纵横。',
    initialStance: 15, initialMilitaryPower: 50, initialRenown: 50,
  },
  {
    id: 'npc_ju', name: '莒', archetype: 'commercial', homeColor: 0xCDB985,
    description: '东夷小邦，海岱之间。',
    descPlain: '【商】东方小邦，富庶而军力薄弱，易成众矢之的。',
    initialStance: 0, initialMilitaryPower: 35, initialRenown: 40,
  },
  {
    id: 'npc_rong', name: '戎狄', archetype: 'tribal', homeColor: 0x6E5230,
    description: '逐水草而居，剽悍善寇。',
    descPlain: '【夷】塞外游牧之众，不通礼盟，任何时候都可能南下劫掠。',
    initialStance: -40, initialMilitaryPower: 70, initialRenown: 20,
  },
];

/** 兼容旧引用：原 3 邦定义即池子前三。 */
export const NPC_COUNTRIES = NPC_POOL;

/** 每局选取的 NPC 数（主理人定：一局限定 4 个）。 */
export const NPC_PER_GAME = 4;
/** makeInitialNpcStates 的默认种子（构造器/测试/兜底用；真实新局由 IntroScene 用随机种子重选）。 */
const DEFAULT_NPC_SEED = 12345;

/** archetype → 初始攻击/骚扰倾向。 */
function initialAggression(a: NpcArchetype): number {
  switch (a) {
    case 'tribal': return 80;
    case 'martial': return 60;
    case 'commercial': return 30;
    case 'cultural': return 25;
    default: return 40;
  }
}

function makeNpcState(def: NpcCountryDef): NpcCountryState {
  return {
    id: def.id,
    stance: def.initialStance,
    militaryPower: def.initialMilitaryPower,
    renown: def.initialRenown,
    tradeRoute: false,
    tradeCooldown: 0,
    warStatus: 'peace',
    lastEnvoyDay: -1,
    lastWarDay: -1,
    allyIds: [],
    aggression: initialAggression(def.archetype),
    lastActionDay: -1,
  };
}

/** 内联确定性 RNG（mulberry32），避免 data 层依赖 state/rng。 */
function mulberry32(seed: number): () => number {
  let a = (seed || 1) >>> 0; // 防 seed=0 退化
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 用种子洗牌一个副本（Fisher-Yates）。 */
function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * 从池子按种子确定性抽 count 个 NPC（保证含 ≥1 tribal，若池中有）。
 * 同 seed → 同结果（存档一致 + 可测）；新局用随机 seed 得不同阵容。
 */
export function selectNpcsForGame(seed: number, count: number = NPC_PER_GAME): NpcCountryState[] {
  const rng = mulberry32(seed);
  const order = shuffled(NPC_POOL, rng);
  const n = Math.min(count, order.length);
  const picked = order.slice(0, n);
  // 保证含 ≥1 蛮夷：若未选中且池里有，替换掉最后一个
  if (!picked.some(d => d.archetype === 'tribal')) {
    const tribal = order.slice(n).find(d => d.archetype === 'tribal');
    if (tribal && picked.length > 0) picked[picked.length - 1] = tribal;
  }
  return picked.map(makeNpcState);
}

/** 兼容旧调用点（构造器/saveLoad 兜底/测试）：默认种子选取。 */
export function makeInitialNpcStates(seed: number = DEFAULT_NPC_SEED): NpcCountryState[] {
  return selectNpcsForGame(seed);
}

export function getNpcDef(id: string): NpcCountryDef | undefined {
  return NPC_POOL.find(d => d.id === id);
}
