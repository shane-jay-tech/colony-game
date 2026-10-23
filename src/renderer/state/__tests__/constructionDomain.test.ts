/**
 * 域四：建设/生产域外迁件直测（c1023-04 测试随迁批 4/5）。
 * 与 gameStore.test.ts 的建筑/工期/升级 facade 用例互补：这里直接钉
 * domains/constructionDomain 纯函数（解锁三态/目标归一/费用预检与扣减/半价返还/
 * 可割让筛选/工期推进/生产组装），生产组装与 facade getDailyRates 的 factorFor 同源。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  buildingUnlocked, buildingUnlockInfo, policyUnlocked, normalizeUpgradeTargets,
  costUnaffordable, chargeBuildingCost, buildingRefundDeltas, cedableBuildings,
  constructionSpeedMultiplier, advanceConstruction,
} from '../domains/constructionDomain';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { BuildingDef, BuildingInstance, PolicyNode } from '../../data/schema';

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function inst(defId: string, status: BuildingInstance['status'] = 'working'): BuildingInstance {
  return { defId, position: { x: 0, y: 0 }, status, tier: 1, constructionProgress: 100, modifiers: [] };
}

function def(overrides: Partial<BuildingDef> = {}): BuildingDef {
  return {
    id: 'bld_test', name: 'Test', category: '民生', tier: 1, cost: {}, constructionTime: 5,
    output: [], upkeep: {}, size: { width: 1, height: 1 },
    assetKey: 'bld_test', upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
    ...overrides,
  };
}

const FULL_INPUT = {
  grade: 3,
  adoptedPolicyIds: new Set(['pol_a']),
  builtWorkingDefIds: new Set(['bld_barracks']),
  completedDecreeIds: new Set(['decree_a']),
};

describe('constructionDomain.buildingUnlocked / buildingUnlockInfo / policyUnlocked', () => {
  it('tier 门槛：国格不够 → false / grade_locked（含「需晋」文案）；前置未满足 → prereq_locked 隐藏', () => {
    const t3 = def({ id: 'bld_t3', tier: 3, upgradeRequires: ['pol_a'] });
    expect(buildingUnlocked({ ...FULL_INPUT, grade: 1 }, t3)).toBe(false);
    const info = buildingUnlockInfo({ ...FULL_INPUT, grade: 1 }, t3);
    expect(info.state).toBe('grade_locked');
    expect(info.reason).toContain('需晋');
    expect(buildingUnlocked({ ...FULL_INPUT, adoptedPolicyIds: new Set() }, t3)).toBe(false);
    expect(buildingUnlockInfo({ ...FULL_INPUT, adoptedPolicyIds: new Set() }, t3).state).toBe('prereq_locked');
  });

  it('三类前置（国策/建筑/朝令）任一满足即通过；与 facade 同源', () => {
    const mixed = def({ id: 'bld_mix', tier: 2, upgradeRequires: ['pol_a', 'bld_barracks', 'decree_a'] });
    expect(buildingUnlocked(FULL_INPUT, mixed)).toBe(true);
    expect(buildingUnlockInfo(FULL_INPUT, mixed).state).toBe('buildable');

    const store = new GameStore(makeEmitter(), { grade: 3 });
    const farmDef = def({ id: 'bld_farm', tier: 1 });
    expect(buildingUnlocked({ ...FULL_INPUT, grade: store.getGrade(), adoptedPolicyIds: store.getAdoptedPolicyIds(), builtWorkingDefIds: new Set(), completedDecreeIds: new Set() }, farmDef))
      .toBe(store.isBuildingUnlocked(farmDef));
  });

  it('国策解锁：国格门槛 + prerequisites 全采纳', () => {
    const pol = { id: 'pol_x', tier: 2, prerequisites: ['pol_a'] } as unknown as PolicyNode;
    expect(policyUnlocked(FULL_INPUT, pol)).toBe(true);
    expect(policyUnlocked({ ...FULL_INPUT, adoptedPolicyIds: new Set<string>() }, pol)).toBe(false);
  });
});

describe('constructionDomain.normalizeUpgradeTargets（c1012-01 案a 数组化归一）', () => {
  it('undefined → []；数组原样；旧标量 → 单元素数组', () => {
    expect(normalizeUpgradeTargets(def())).toEqual([]);
    expect(normalizeUpgradeTargets(def({ upgradesTo: ['bld_b'] }))).toEqual(['bld_b']);
    expect(normalizeUpgradeTargets(def({ upgradesTo: 'bld_b' } as never))).toEqual(['bld_b']);
  });
});

describe('constructionDomain.costUnaffordable / chargeBuildingCost / buildingRefundDeltas', () => {
  const cost = { grain: 30, wood: 10, people: 5 } as const;

  it('预检：people 不参检；任一不足 → true；全足 → false', () => {
    expect(costUnaffordable({ grain: 100, wood: 10 }, cost)).toBe(false); // people 5 不看
    expect(costUnaffordable({ grain: 29, wood: 10 }, cost)).toBe(true);
    expect(costUnaffordable({}, undefined)).toBe(false);
  });

  it('扣减：逐项 setClamped(current-amount)，deltas 记负值，people 跳过', () => {
    const res: Record<string, number> = { grain: 100, wood: 50 };
    const calls: [string, number][] = [];
    const deltas = chargeBuildingCost(res as never, cost, (id, v) => calls.push([id, v]));
    expect(calls).toEqual([['grain', 70], ['wood', 40]]);
    expect(deltas).toEqual({ grain: -30, wood: -10 });
  });

  it('返还：50% floor，≤0 跳过，people 不返还', () => {
    expect(buildingRefundDeltas({ grain: 31, wood: 1, people: 100 } as never)).toEqual({ grain: 15 });
    expect(buildingRefundDeltas(undefined)).toEqual({});
  });
});

describe('constructionDomain.cedableBuildings（原 cedableBuildings + CORE_BUILDING_IDS）', () => {
  it('只留 working 非核心（farm/well/house 除外）；在建/废弃剔除', () => {
    const buildings = [
      inst('bld_farm'), inst('bld_well'), inst('bld_house'),
      inst('bld_granary'), inst('bld_market', 'constructing'), inst('bld_smith', 'derelict'),
    ];
    expect(cedableBuildings(buildings).map(b => b.defId)).toEqual(['bld_granary']);
  });
});

describe('constructionDomain.constructionSpeedMultiplier / advanceConstruction（原 runConstructionPhase）', () => {
  it('无在建 → 乘数 1；facade 同源（有 farm 在建时与 store 内部口径一致性由 tickDay 用例守护）', () => {
    expect(constructionSpeedMultiplier([], [])).toBe(1);
    expect(constructionSpeedMultiplier([inst('bld_farm', 'constructing')], [])).toBe(1); // 无 modifier = 1
  });

  it('工期推进：未满进度仅累加；跨 99.999 闸门翻转 working 并回调 onCompleted', () => {
    // bld_barracks constructionTime=2 → 每日 +50（注册表无长工期建筑，2-3 日即最短可观察累加）
    const building = inst('bld_barracks', 'constructing');
    building.constructionProgress = 0;
    const completed: BuildingInstance[] = [];
    advanceConstruction([building], 1, { onCompleted: b => completed.push(b), finishUpgrade: () => { throw new Error('should not upgrade'); } });
    expect(building.constructionProgress).toBe(50);
    expect(building.status).toBe('constructing');
    expect(completed).toHaveLength(0);

    advanceConstruction([building], 1, { onCompleted: b => completed.push(b), finishUpgrade: () => { throw new Error('should not upgrade'); } });
    expect(building.constructionProgress).toBe(100);
    expect(building.status).toBe('working');
    expect(completed).toHaveLength(1);
  });

  it('升级完工走 finishUpgrade 回调（真实链 bld_well→bld_market；注册表无 0 工期建筑，ct<=0 分支保持逐字搬移原样）', () => {
    const upgrading = inst('bld_well', 'constructing');
    (upgrading as unknown as { upgradingTo?: string }).upgradingTo = 'bld_market';
    const upgraded: BuildingInstance[] = [];
    advanceConstruction([upgrading], 1, {
      onCompleted: () => { throw new Error('should be upgrade path'); },
      finishUpgrade: (b, targetDef) => {
        expect(targetDef.id).toBe('bld_market');
        b.defId = b.upgradingTo!;
        b.upgradingTo = undefined;
        upgraded.push(b);
      },
    });
    expect(upgraded).toHaveLength(1);
  });
});
