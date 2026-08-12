/**
 * C1 古迹事件链「山河探秘」（Stellaris 异常点/考古链 → 春秋古迹）。
 * 每条链 3 阶段、每阶段 2 个抉择；抉择结算 怨愤/民心/资源/信誉，后果可感知。
 * 站点由种子确定性生成（2~4 个、每条链每局至多一个），直接喂「涌现叙事矩阵」。
 */
import type { ResourceId } from '../data/resourceRegistry';

export interface RelicChoice {
  text: string;
  textPlain: string;
  wrathDelta: number;
  moraleDelta: number;
  resources: Partial<Record<ResourceId, number>>;
  renownDelta: number;
  /** 完成整链时的收尾一句话（半文白） */
  summary: string;
}

export interface RelicStage {
  title: string;
  desc: string;
  descPlain: string;
  choices: RelicChoice[];
}

export interface RelicChain {
  id: string;
  name: string;
  stages: RelicStage[];
}

export interface RelicSite {
  id: string;
  chainId: string;
  name: string;
  position: { x: number; y: number };
  /** 0..stages.length（未完成的当前阶段） */
  stage: number;
  done: boolean;
}

export const RELIC_CHAINS: readonly RelicChain[] = [
  {
    id: 'ancient_battlefield',
    name: '古战场',
    stages: [
      {
        title: '荒丘埋骨',
        desc: '牧竖报：野有枯骨，甲胄半腐，似百年前鏖战所遗。',
        descPlain: '城外发现古代战场遗骨，该如何处置？',
        choices: [
          { text: '收敛遗骨，立碑祭之', textPlain: '收敛祭之（民心 +5，怨愤 −3）', wrathDelta: -3, moraleDelta: 5, resources: {}, renownDelta: 2, summary: '古战场遗骨得敛，百姓称仁。' },
          { text: '搜检甲兵，充我武库', textPlain: '搜检甲兵（青铜 +8，怨愤 +5）', wrathDelta: 5, moraleDelta: 0, resources: { bronze: 8 }, renownDelta: 0, summary: '收得旧甲若干，怨言亦起。' },
        ],
      },
      {
        title: '掘得断戟',
        desc: '深掘得断戟一柄，锋刃虽残，寒光犹在。',
        descPlain: '出土一柄古断戟，如何处置？',
        choices: [
          { text: '交工坊重铸', textPlain: '重铸为器（耗木 5，青铜 +6）', wrathDelta: 0, moraleDelta: 0, resources: { wood: -5, bronze: 6 }, renownDelta: 0, summary: '断戟重铸，武库添新。' },
          { text: '献于祖庙', textPlain: '献于祖庙（礼器 +3，信誉 +4）', wrathDelta: 0, moraleDelta: 0, resources: { rite: 3 }, renownDelta: 4, summary: '断戟入庙，克绍先武。' },
        ],
      },
      {
        title: '古魂托梦',
        desc: '夜梦古卒列阵而言：愿恤其遗族，而后可安。',
        descPlain: '古卒托梦请求抚恤遗族。',
        choices: [
          { text: '寻访遗族，赐粟免役', textPlain: '抚恤遗族（耗钱 10，民心 +8，怨愤 −8）', wrathDelta: -8, moraleDelta: 8, resources: { gold: -10 }, renownDelta: 0, summary: '遗族得恤，古战场终归平静。' },
          { text: '建碑镇之，以彰武功', textPlain: '建碑纪功（信誉 +6）', wrathDelta: 0, moraleDelta: 0, resources: {}, renownDelta: 6, summary: '纪功碑成，邦誉远播。' },
        ],
      },
    ],
  },
  {
    id: 'ancient_altar',
    name: '古祭坛',
    stages: [
      {
        title: '石坛苔深',
        desc: '山间古坛，苔深草没，未知何代所立。',
        descPlain: '发现一座荒废古祭坛。',
        choices: [
          { text: '修葺祭之', textPlain: '修葺祭坛（礼器 +2，怨愤 −4）', wrathDelta: -4, moraleDelta: 0, resources: { rite: 2 }, renownDelta: 0, summary: '祭坛重光，鬼神不扰。' },
          { text: '拆石他用', textPlain: '拆石他用（石 +12，怨愤 +6）', wrathDelta: 6, moraleDelta: 0, resources: { stone: 12 }, renownDelta: 0, summary: '古坛拆尽，民有怨声。' },
        ],
      },
      {
        title: '坛底得玉',
        desc: '修坛得美玉一方，温润无瑕。',
        descPlain: '祭坛下出土美玉。',
        choices: [
          { text: '琢为礼器', textPlain: '琢为礼器（礼器 +6）', wrathDelta: 0, moraleDelta: 0, resources: { rite: 6 }, renownDelta: 0, summary: '美玉成器，礼乐有加。' },
          { text: '售于市贾', textPlain: '售于市（钱 +15，怨愤 +2）', wrathDelta: 2, moraleDelta: 0, resources: { gold: 15 }, renownDelta: 0, summary: '美玉换钱，或有失礼。' },
        ],
      },
      {
        title: '坛启古誓',
        desc: '坛底得竹简古誓：凡承此坛者，当恤其民。',
        descPlain: '古誓要求继任者恤民。',
        choices: [
          { text: '循誓恤民', textPlain: '循誓恤民（民心 +6，怨愤 −6）', wrathDelta: -6, moraleDelta: 6, resources: {}, renownDelta: 0, summary: '古誓得践，民心归附。' },
          { text: '借誓立威', textPlain: '借誓立威（信誉 +8，怨愤 +4）', wrathDelta: 4, moraleDelta: 0, resources: {}, renownDelta: 8, summary: '借古誓立威，誉与怨并至。' },
        ],
      },
    ],
  },
  {
    id: 'ancient_mine',
    name: '古矿坑',
    stages: [
      {
        title: '荒矿旧道',
        desc: '山阳有废弃矿道，洞口藤蔓垂蔽。',
        descPlain: '发现一条废弃古矿道。',
        choices: [
          { text: '遣人探查矿脉', textPlain: '探查矿脉（青铜 +5）', wrathDelta: 0, moraleDelta: 0, resources: { bronze: 5 }, renownDelta: 0, summary: '旧矿尚有余脉可采。' },
          { text: '封坑勿扰', textPlain: '封坑勿扰（怨愤 −3）', wrathDelta: -3, moraleDelta: 0, resources: {}, renownDelta: 0, summary: '封坑安民，不贪旧利。' },
        ],
      },
      {
        title: '旧道塌方',
        desc: '采矿忽闻轰然，旧道塌陷，工匠数人未出。',
        descPlain: '矿道塌方，工匠被困。',
        choices: [
          { text: '全力掘救', textPlain: '全力救出（耗木 5，民心 +4）', wrathDelta: 0, moraleDelta: 4, resources: { wood: -5 }, renownDelta: 0, summary: '工匠得救，人心大定。' },
          { text: '恐再塌，弃之', textPlain: '弃之而去（怨愤 +6）', wrathDelta: 6, moraleDelta: 0, resources: {}, renownDelta: 0, summary: '弃矿而去，怨声载道。' },
        ],
      },
      {
        title: '得古冶图',
        desc: '坑底得古冶图一卷，熔铸之法精妙。',
        descPlain: '获得古代冶炼图卷。',
        choices: [
          { text: '传诸工坊', textPlain: '传授工坊（青铜 +10）', wrathDelta: 0, moraleDelta: 0, resources: { bronze: 10 }, renownDelta: 0, summary: '古法得传，炉火更旺。' },
          { text: '秘藏于室', textPlain: '秘藏于室（信誉 +5，怨愤 +3）', wrathDelta: 3, moraleDelta: 0, resources: {}, renownDelta: 5, summary: '秘图藏室，誉怨参半。' },
        ],
      },
    ],
  },
];

/** 种子确定性生成 2~4 个古迹点（每条链每局至多一个）。 */
export function generateRelicSites(seed: number, mapWidth: number, mapHeight: number): RelicSite[] {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
  const count = 2 + Math.floor(rnd() * 3); // 2..4
  const pool = [...RELIC_CHAINS];
  const sites: RelicSite[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const chain = pool.splice(Math.floor(rnd() * pool.length), 1)[0]!;
    sites.push({
      id: `r${i}`,
      chainId: chain.id,
      name: chain.name,
      position: { x: Math.floor(rnd() * mapWidth), y: Math.floor(rnd() * mapHeight) },
      stage: 0,
      done: false,
    });
  }
  return sites;
}

export interface RelicAdvanceResult {
  site: RelicSite;
  effects: RelicChoice;
  completed: boolean;
}

/** 推进一阶段：choiceIdx 越界回退到 0；最后一阶段完成后 done=true。 */
export function advanceRelic(site: RelicSite, choiceIdx: number): RelicAdvanceResult {
  const chain = RELIC_CHAINS.find(c => c.id === site.chainId);
  if (!chain) throw new Error(`unknown relic chain: ${site.chainId}`);
  const stageDef = chain.stages[Math.min(site.stage, chain.stages.length - 1)]!;
  const choice = stageDef.choices[choiceIdx] ?? stageDef.choices[0]!;
  const nextStage = site.stage + 1;
  const completed = nextStage >= chain.stages.length;
  return {
    site: { ...site, stage: nextStage, done: completed },
    effects: choice,
    completed,
  };
}
