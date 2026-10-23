/**
 * 域三：军事/外交域外迁件直测（c1023-03 测试随迁批 3/5）。
 * 与 gameStore.test.ts 的军事 facade 用例（P4 军事+将领）互补：这里直接钉
 * domains/militaryDomain 纯函数，并含「域模块 ↔ GameStore 同源」对照例
 * （militaryPowerOf 同输入同输出，自证零行为漂移）。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  availableSoldiersOf, militaryPowerOf, bestDefenseUnit, diplomacyDayTick,
  clampNpcVitals, diplomacyRenownModifier, diplomacyWarinessAdjust,
} from '../domains/militaryDomain';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { BuildingInstance, NpcCountryState } from '../../data/schema';
import type { ActiveExpedition } from '../../data/military';
import { makeInitialNpcStates } from '../../data/npcCountries';

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function inst(defId: string, status: BuildingInstance['status'] = 'working'): BuildingInstance {
  return { defId, position: { x: 0, y: 0 }, status, tier: 1, constructionProgress: 100, modifiers: [] };
}

function expedition(units: Record<string, number>): ActiveExpedition {
  return {
    config: {
      npcId: 'npc_test', target: '边界', units: units as never, grainAllocated: 0,
      generalId: undefined, mode: 'raid',
    } as never,
    daysRemaining: 5, morale: 80, startedDay: 0,
  } as never;
}

describe('militaryDomain.availableSoldiersOf（原 availableSoldiers）', () => {
  it('无出征 → 兵阶层全数可用；有出征扣除出征兵；不足钳 0', () => {
    expect(availableSoldiersOf(20, [])).toBe(20);
    expect(availableSoldiersOf(20, [expedition({ militia: 5 }), expedition({ militia: 3 })])).toBe(12);
    expect(availableSoldiersOf(4, [expedition({ militia: 10 })])).toBe(0);
  });

  it('与 facade 同源：store.getDeployableSoldiers 一致', () => {
    const store = new GameStore(makeEmitter(), {
      resources: { people: 20 },
      populationClasses: { farmer: 0, worker: 0, soldier: 20, scholar: 0 },
    });
    expect(availableSoldiersOf(20, store.getActiveExpeditions()))
      .toBe(store.getDeployableSoldiers());
  });
});

describe('militaryDomain.militaryPowerOf ↔ GameStore.computeCurrentMilitaryPower 同源对照', () => {
  it('无兵无建筑：乡勇基数 20；有兵+兵营+将领：派生军力与 facade 全等', () => {
    const base = new GameStore(makeEmitter(), { grade: 1, buildings: [inst('bld_barracks')] });
    expect(militaryPowerOf(0, {
      grade: 1, buildings: [], adoptedPolicies: new Set(), soldierCount: 0, grain: 0,
    }, [], [])).toBe(base.computeCurrentMilitaryPower());
    expect(militaryPowerOf(0, {
      grade: 1, buildings: [], adoptedPolicies: new Set(), soldierCount: 0, grain: 0,
    }, [], [])).toBe(20); // 20=无常备兵时的乡勇守土基数

    const withArmy = new GameStore(makeEmitter(), {
      grade: 1, buildings: [inst('bld_barracks')],
      resources: { people: 20, grain: 200 },
      populationClasses: { farmer: 0, worker: 0, soldier: 20, scholar: 0 },
      generals: [{ id: 'gen_hu_ben', loyalty: 100, deployed: false }],
    });
    const st = withArmy.getState();
    expect(militaryPowerOf(st.populationClasses.soldier, {
      grade: st.grade,
      buildings: st.buildings,
      adoptedPolicies: withArmy.getAdoptedPolicyIds(),
      soldierCount: withArmy.getDeployableSoldiers(),
      grain: st.resources.grain ?? 0,
    }, st.generals, st.activeModifiers)).toBe(withArmy.computeCurrentMilitaryPower());
    expect(withArmy.computeCurrentMilitaryPower()).toBeGreaterThan(20);
  });
});

describe('militaryDomain.bestDefenseUnit（原 resolveIncomingAttack 选型段）', () => {
  it('无可解锁兵种 → militia 兜底；有兵营 → 取 defense 最高可用兵种', () => {
    expect(bestDefenseUnit({ grade: 0, buildings: [], adoptedPolicies: new Set(), soldierCount: 0, grain: 0 })).toBe('militia');
    const withBarracks = bestDefenseUnit({
      grade: 1, buildings: [inst('bld_barracks')], adoptedPolicies: new Set(), soldierCount: 10, grain: 100,
    });
    expect(withBarracks).toBe('militia'); // militia defense 4 > archer 3（grade 1 可用集内最高防御）
  });
});

describe('militaryDomain.diplomacyDayTick（原 runDiplomacyTick）', () => {
  it('未开通商 → 零 deltas 零触发；开通商+冷却归零 → 聚合入账并置 tradeIncomeFired', () => {
    const idle = makeInitialNpcStates().filter(s => !s.tradeRoute);
    const outIdle = diplomacyDayTick(idle, 50);
    expect(outIdle.tradeIncomeFired).toBe(false);
    expect(Object.keys(outIdle.deltas)).toHaveLength(0);

    const trading: NpcCountryState[] = makeInitialNpcStates()
      .filter(s => s.warStatus !== 'war')
      .slice(0, 2)
      .map(s => ({ ...s, tradeRoute: true, tradeCooldown: 0 }));
    const out = diplomacyDayTick(trading, 50);
    expect(out.tradeIncomeFired).toBe(true);
    const gold = Object.entries(out.deltas).filter(([k]) => k === 'gold').reduce((s, [, v]) => s + (v ?? 0), 0);
    expect(gold).toBeGreaterThan(0);
    expect(trading.every(s => s.tradeCooldown > 0)).toBe(true); // 30 日一轮重置
  });
});

describe('militaryDomain.clampNpcVitals / diplomacyRenownModifier / diplomacyWarinessAdjust', () => {
  it('钳制：stance∈[-100,100]，militaryPower∈[0,500]，renown∈[0,200]', () => {
    const s = makeInitialNpcStates()[0]!;
    s.stance = 150; s.militaryPower = -5; s.renown = 999;
    clampNpcVitals(s);
    expect(s.stance).toBe(100);
    expect(s.militaryPower).toBe(0);
    expect(s.renown).toBe(200);
  });

  it('声望 modifier：id 含 kind/npc/day，effects 走 country_renown add，描述透传 message', () => {
    const m = diplomacyRenownModifier('trade', 'npc_yan', 42, 5, '通商互利');
    expect(m.id).toBe('mod_diplomacy_renown_trade_npc_yan_42');
    expect(m.category).toBe('diplomacy');
    expect(m.stackable).toBe(true);
    expect(m.effects[0]!.target).toBe('country_renown');
    expect(m.description).toBe('通商互利');
  });

  it('警惕值映射：war→兴师宣战；trade→通商睦邻；envoy→遣使修好', () => {
    expect(diplomacyWarinessAdjust('war').reason).toBe('兴师宣战');
    expect(diplomacyWarinessAdjust('trade').reason).toBe('通商睦邻');
    expect(diplomacyWarinessAdjust('envoy').reason).toBe('遣使修好');
    expect(diplomacyWarinessAdjust('war').delta).not.toBe(0);
  });
});
