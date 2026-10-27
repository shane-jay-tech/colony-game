// c1028-04（OFFLINE_REWARD 甲案接线）：结算器钉桩（工单第二节测试 4-6 例）。
// 数值红线：断言全部从 data/offline.ts 常量推导，不在测试里另写魔法数。
import { describe, expect, it } from 'vitest';
import { OFFLINE_REWARD } from '../../data/offline';
import type { BuildingDef, BuildingInstance, ModifierInstance } from '../../data/schema';
import { settleOfflineReward } from '../offlineReward';

const NOW = 1_800_000_000_000;
const HOUR_MS = 3_600_000;

/** 最小农田 def：grain 12/日、wood 6/日；gold 链路不产出（验快照集外零结算）。 */
const FARM: BuildingDef = {
  id: 'bld_test_farm',
  name: '试验田',
  category: 'economy',
  tier: 1,
  cost: {},
  constructionTime: 0,
  output: [
    { resource: 'grain', perDay: 12 },
    { resource: 'wood', perDay: 6 },
    { resource: 'gold', perDay: 3 },
  ],
  upkeep: {},
  classType: 'farm',
  description: '',
  descPlain: '',
} as unknown as BuildingDef;

function mkBuilding(): BuildingInstance {
  return {
    id: 'inst-1', defId: 'bld_test_farm', position: { x: 0, y: 0 },
    status: 'working', constructionProgress: 100, upgradingTo: null,
  } as unknown as BuildingInstance;
}

const lookup = (defId: string) => (defId === 'bld_test_farm' ? FARM : undefined);

describe('settleOfflineReward（纯函数面）', () => {
  it('正常结算：2h 离线 = 产量 × (2/24) × decayFactor，gold 不在快照集不结算', () => {
    const b = mkBuilding();
    const days = (2 / 24) * OFFLINE_REWARD.decayFactor;
    const r = settleOfflineReward(NOW, NOW - 2 * HOUR_MS, [b], [], lookup);
    expect(r.hours).toBe(2);
    expect(r.deltas['grain']).toBe(Math.round(12 * days));
    expect(r.deltas['wood'] ?? 0).toBe(Math.round(6 * days));  // 2h 低产四舍五入后可为 0 ⇒ 缺席语义
    expect(r.deltas).not.toHaveProperty('gold'), 'gold 不在 snapshotResources';
  });

  it('上限 clamp：离线 99h 按 maxOfflineHours=8 结算', () => {
    const b = mkBuilding();
    const days = (OFFLINE_REWARD.maxOfflineHours / 24) * OFFLINE_REWARD.decayFactor;
    const r = settleOfflineReward(NOW, NOW - 99 * HOUR_MS, [b], [], lookup);
    expect(r.hours).toBe(OFFLINE_REWARD.maxOfflineHours);
    expect(r.deltas['grain']).toBe(Math.round(12 * days));
  });

  it('时钟回拨（时长为负）零结算；新局 lastSeen=0 同样零结算', () => {
    const b = mkBuilding();
    expect(settleOfflineReward(NOW, NOW + HOUR_MS, [b], [])).toEqual({ hours: 0, deltas: {} });
    expect(settleOfflineReward(NOW, 0, [b], [])).toEqual({ hours: 0, deltas: {} });
  });

  it('仅 economy/population 类 modifier 参与聚合：military 加成被剔除', () => {
    const b = mkBuilding();
    const eco: ModifierInstance = {
      id: 'm_eco', name: '经政', category: 'economy', stackable: false,
      effects: [{ target: 'country_grain_output', op: 'mul', value: 2 }],
      remainingDays: -1, description: '', descPlain: '',
    } as unknown as ModifierInstance;
    const mil: ModifierInstance = {
      ...eco, id: 'm_mil', name: '军屯', category: 'military',
    };
    const withEco = settleOfflineReward(NOW, NOW - 24 * HOUR_MS, [b], [eco], lookup);
    const withBoth = settleOfflineReward(NOW, NOW - 24 * HOUR_MS, [b], [eco, mil], lookup);
    expect(withEco.hours).toBe(8);
    expect(withBoth.deltas['grain']).toBe(withEco.deltas['grain']);
    // economy 加成确实生效（翻倍于无 modifier 基线）
    const base = settleOfflineReward(NOW, NOW - 24 * HOUR_MS, [b], [], lookup);
    expect(withEco.deltas['grain']).toBe(Math.round(12 * 2 * (8 / 24) * OFFLINE_REWARD.decayFactor));
    expect(withEco.deltas['grain']!).toBeGreaterThan(base.deltas['grain']!);
  });

  it('人口零增长：快照集外资源（people）与消耗（zero consumption 口径）都不出现在增量里', () => {
    const b = mkBuilding();
    const r = settleOfflineReward(NOW, NOW - 8 * HOUR_MS, [b], [], lookup);
    expect(Object.keys(r.deltas).every((k) => OFFLINE_REWARD.snapshotResources.includes(k as never)))
      .toBe(true);
    expect(r.deltas).not.toHaveProperty('people');
  });

  it('零产量（无建筑）零增量但时长照算', () => {
    const r = settleOfflineReward(NOW, NOW - 4 * HOUR_MS, [], []);
    expect(r.hours).toBe(4);
    expect(r.deltas).toEqual({});
  });
});
