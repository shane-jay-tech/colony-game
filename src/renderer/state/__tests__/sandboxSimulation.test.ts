/**
 * P0-1 无头 8 小时沙盒模拟（设计稿最大风险「好不好玩未验证」的机械兜底）。
 *
 * 用生产同款内容（POLICIES/EVENTS/DECREES + BALANCE.startingResources）+ 固定种子，
 * 由「贪心玩家」驱动 720 游戏日：采纳国策/朝令、摆建筑、处理事件与诉求、定期通商。
 * 断言：可持续推进、资源有界非 NaN、人口成长、国格阶梯可达、外部张力真实存在。
 * 诊断数据 console.log 供平衡校准。
 *
 * 已发现的真实平衡信号（记录于此，供 P2-2 数值校准消化）：
 *  1) 后期木材/金币无消费出口，贪心玩家会冲到 9999 上限（B3 加工链应成为沉没出口）。
 *  2) 中期人口在 ~38 卡住且粮 0：劳动力池与农田/住房配比失衡，需求环（A2）打折叠加后中段收紧。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import { POLICIES, EVENTS, DECREES, BUILDINGS } from '../../data';
import { BALANCE } from '../../data/balanceConfig';
import type { ResourceId } from '../../data/resourceRegistry';
import { RESOURCE_IDS } from '../../data/resourceRegistry';
import { COUNTRY_GRADES } from '../../data/countryGrades';
import { getBuildingDef } from '../../data/buildingRegistry';

const HORIZON_DAYS = 720;
const MAP_W = 80;
const MAP_H = 80;
const TILE_COUNT = MAP_W * MAP_H;

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, { rngSeed: 20260813 }, {
    policies: POLICIES,
    events: EVENTS,
    decrees: DECREES,
  });
  for (const [id, amount] of Object.entries(BALANCE.startingResources)) {
    if (amount && amount > 0) store.addResource(id as ResourceId, amount);
  }
  return store;
}

function affordable(
  resources: Readonly<Partial<Record<ResourceId, number>>>,
  cost: Partial<Record<ResourceId, number>>,
): boolean {
  return Object.entries(cost).every(
    ([rid, v]) => (resources[rid as ResourceId] ?? 0) >= (v as number),
  );
}

interface SimStats {
  finalDay: number;
  finalPopulation: number;
  finalBuildings: number;
  gradeReached: number;
  crisisCount: number;
  hostileNpcActions: number;
  gradeMilestones: { day: number; grade: number }[];
  finalResources: Partial<Record<ResourceId, number>>;
  minResource: number;
  maxResource: number;
  badResource: string[];
  saturatedResources: string[];
}

function runSimulation(days: number): { store: GameStore; stats: SimStats } {
  const store = makeStore();
  let hostileNpcActions = 0;
  const gradeMilestones: { day: number; grade: number }[] = [];
  store.on(STATE_EVENTS.NPC_ACTION, (p: unknown) => {
    const kind = (p as { kind?: string }).kind;
    if (kind === 'harass_player' || kind === 'assault_player') hostileNpcActions++;
  });
  store.on(STATE_EVENTS.GRADE_CHANGED, (p: unknown) => {
    const g = p as { to?: number };
    if (g.to !== undefined) gradeMilestones.push({ day: store.getCurrentDay(), grade: g.to });
  });

  // 解锁链国策（出现在建筑 upgradeRequires 里的国策）豁免攒金规则，否则「通市→市集→产金」会死锁
  const unlockPolicies = new Set(BUILDINGS.flatMap((b) => b.upgradeRequires));

  let scanIdx = 0;
  for (let day = 0; day < days; day++) {
    // 1) 事件 / 诉求：确定性决策（选第一项 / 接受诉求）
    if (store.getPendingEventId() !== null) store.resolveEvent(0);
    if (store.getFactionState().activeDemand) store.resolveFactionDemand(true);

    // 2) 国策：每天最多 2 条，先低阶后高阶；攒金冲格——金币支出不得击穿下一国格的金币门槛
    const adopted = store.getAdoptedPolicyIds();
    const res = store.getResources();
    const grade = store.getState().grade;
    const goldTarget = COUNTRY_GRADES[Math.min(grade + 1, COUNTRY_GRADES.length - 1)]!.threshold.gold ?? 0;
    const reserveOk = (cost: Partial<Record<ResourceId, number>>): boolean =>
      ((cost.wood ?? 0) <= 0 || (res.wood ?? 0) - (cost.wood ?? 0) >= 20)
      && ((cost.stone ?? 0) <= 0 || (res.stone ?? 0) - (cost.stone ?? 0) >= 15);
    const policyCandidates = store.getPolicies()
      .filter((p) => !adopted.has(p.id) && store.isPolicyUnlocked(p) && affordable(res, p.cost)
        && (unlockPolicies.has(p.id) || day > 90)
        && reserveOk(p.cost)
        && (unlockPolicies.has(p.id) || (p.cost.gold ?? 0) === 0
          || (res.gold ?? 0) - (p.cost.gold ?? 0) >= goldTarget))
      .sort((a, b) => a.tier - b.tier);
    let adoptedToday = 0;
    for (const p of policyCandidates) {
      if (adoptedToday >= 1) break;
      if (store.adoptPolicy(p.id).ok) adoptedToday++;
    }

    // 3) 朝令：国力雄厚才动手（人口>80 且粮>200 且金>300），每天最多 1 条——早期乱下政令是死局主因
    if ((store.getResources().people ?? 0) > 80
      && (store.getResources().grain ?? 0) > 200
      && (store.getResources().gold ?? 0) > 300) {
      for (const d of DECREES) {
        if ((d.stages[0]!.cost.gold ?? 0) > 0
          && (store.getResources().gold ?? 0) - (d.stages[0]!.cost.gold ?? 0) < goldTarget) continue;
        if (store.adoptDecree(d.id).ok) break;
      }
    }

    // 4) 建筑：每天最多 2 栋，先低阶后高阶；再走一次升级链（纪元式：水井→市集、民居→宫室）
    const signatureIds = new Set(['bld_market', 'bld_ancestor_shrine', 'bld_palace']);
    const buildingCandidates = BUILDINGS
      .filter((b) => store.isBuildingUnlocked(b) && affordable(store.getResources(), b.cost))
      .sort((a, b) => {
        const pa = signatureIds.has(a.id) ? 0 : 1;
        const pb = signatureIds.has(b.id) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return a.tier - b.tier;
      });
    let placed = 0;
    for (const def of buildingCandidates) {
      if (placed >= 2) break;
      for (let k = 0; k < 60; k++) {
        const idx = (scanIdx + k) % TILE_COUNT;
        const x = idx % MAP_W;
        const y = Math.floor(idx / MAP_W);
        const r = store.placeBuilding(def, x, y, { width: MAP_W, height: MAP_H });
        if (r.ok) {
          placed++;
          scanIdx = (idx + 1) % TILE_COUNT;
          break;
        }
        if (r.reason === 'insufficient_resources' || r.reason === 'insufficient_labor') break;
      }
    }
    // 每天最多 1 次升级，且只走标志成就链（水井→市集 / 民居→宫室 等），不随意烧资源
    let upgraded = false;
    for (const inst of store.getBuildings()) {
      if (upgraded) break;
      if (inst.status !== 'working') continue;
      const def = getBuildingDef(inst.defId);
      if (!def?.upgradesTo) continue;
      const target = getBuildingDef(def.upgradesTo);
      if (!target) continue;
      if (!signatureIds.has(target.id)) continue;
      if (!affordable(store.getResources(), def.upgradeCost ?? {})) continue;
      if (store.upgradeBuilding(inst.position.x, inst.position.y).ok) upgraded = true;
    }

    // 5) 通商：每 30 天一次，且不击穿下一国格的金币门槛（通商是投资，不能把国库抽干）
    if (day % 30 === 0) {
      const r = store.getResources();
      if ((r.gold ?? 0) - 50 >= goldTarget && (r.cloth ?? 0) >= 2) store.tradeWithNpc('npc_qi');
    }

    store.tickDay();
  }

  const state = store.getState();
  let minResource = Number.POSITIVE_INFINITY;
  let maxResource = Number.NEGATIVE_INFINITY;
  const badResource: string[] = [];
  const saturatedResources: string[] = [];
  for (const id of RESOURCE_IDS) {
    const v = state.resources[id] ?? 0;
    if (!Number.isFinite(v) || v < 0 || v > 9999) badResource.push(`${id}=${v}`);
    if (v >= 9999) saturatedResources.push(id);
    if (Number.isFinite(v)) {
      minResource = Math.min(minResource, v);
      maxResource = Math.max(maxResource, v);
    }
  }

  return {
    store,
    stats: {
      finalDay: state.currentDay,
      finalPopulation: state.resources['people'] ?? 0,
      finalBuildings: state.buildings.length,
      gradeReached: state.gradeReached,
      crisisCount: state.crisisCount,
      hostileNpcActions,
      gradeMilestones,
      finalResources: { ...state.resources },
      minResource,
      maxResource,
      badResource,
      saturatedResources,
    },
  };
}

describe('P0-1 无头 8 小时沙盒模拟', () => {
  it('720 日贪心经营：持续推进、资源有界、人口成长、国格可达、外部张力存在', () => {
    const { stats } = runSimulation(HORIZON_DAYS);

    // 诊断输出（校准锚点）
    // eslint-disable-next-line no-console
    console.log('[P0-1]', JSON.stringify(stats, null, 0));

    // 不变量
    expect(stats.finalDay).toBe(HORIZON_DAYS);
    expect(stats.badResource).toEqual([]); // 无 NaN / 越界资源
    expect(stats.maxResource).toBeLessThanOrEqual(9999);
    expect(stats.minResource).toBeGreaterThanOrEqual(0);
    expect(stats.finalPopulation).toBeGreaterThan(20); // 从 20 民成长
    expect(stats.finalBuildings).toBeGreaterThanOrEqual(8); // 邦国有相当城建
    expect(stats.gradeReached).toBeGreaterThanOrEqual(1); // 8h 弧线至少到城邑（贪心策略实测第 33 天）
    expect(stats.hostileNpcActions).toBeGreaterThanOrEqual(1); // 钩子 3：外部张力真实存在
    expect(stats.crisisCount).toBeGreaterThanOrEqual(0);
    expect(stats.gradeMilestones.length).toBeGreaterThanOrEqual(1);
  }, 120000);
});
