/**
 * 经济平衡结构性不变量（2026-06-07 平衡校准落地后锁定）。
 * 这些断言锚定本轮修掉的三类结构性硬伤，防止未来改动悄悄回退：
 *   1. 黄金死锁：起始必须有启动金（否则产金建筑被需花金的国策前置卡死）。
 *   2. 开局人口冻结：住房上限必须 ≥ 起始人口（否则开局"已满上限"不增长）。
 *   3. 劳力占用制半迁移：用工必须落在生效的 cost.people，upkeep.people 是死字段须清空。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { BALANCE, STORY_BALANCE } from '../balanceConfig';
import { BUILDINGS } from '../buildings';
import { GameStore, type IEventEmitter } from '../../state/gameStore';
import { CLASS_CONSUMPTION } from '../populationClass';
import type { WorldMap } from '../mapSchema';

function allPlainMap(width = 60, height = 60): WorldMap {
  const tiles = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  }
  return { width, height, tiles, resourceNodes: [], seed: 0 };
}

describe('经济平衡结构性不变量', () => {
  for (const [label, cfg] of [['沙盒', BALANCE], ['故事', STORY_BALANCE]] as const) {
    it(`${label}模式：起始有启动金，可破黄金死锁`, () => {
      // 最便宜的"产金建筑解锁国策"是 pol_market(gold 10)，起始金须够采纳它。
      expect(cfg.startingResources.gold ?? 0).toBeGreaterThanOrEqual(10);
    });

    it(`${label}模式：住房上限 ≥ 起始人口（开局不冻结增长）`, () => {
      expect(cfg.population.baseHousingCap).toBeGreaterThanOrEqual(
        cfg.startingResources.people ?? 0,
      );
    });
  }

  it('没有任何建筑把劳力写在 upkeep.people（死字段，占用制下被忽略）', () => {
    const offenders = BUILDINGS.filter(
      (b) => (b.upkeep as Record<string, number>).people !== undefined,
    ).map((b) => b.id);
    expect(offenders).toEqual([]);
  });

  it('重型生产/军政建筑确实占用劳力（cost.people > 0，让人口成为真实约束）', () => {
    const mustEmploy = [
      'bld_market', 'bld_woodcutter', 'bld_quarry', 'bld_smithy',
      'bld_barracks', 'bld_water_mill', 'bld_iron_forge',
    ];
    for (const id of mustEmploy) {
      const def = BUILDINGS.find((b) => b.id === id);
      expect(def, `缺建筑 ${id}`).toBeTruthy();
      expect(def!.cost.people ?? 0, `${id} 应占用劳力`).toBeGreaterThan(0);
    }
  });
});

// BUG-B（2026-06-19）：人口开始真实吃粮后的早期生存性不变量 + 模拟。
describe('BUG-B 粮食消耗：早期生存性', () => {
  for (const [label, cfg] of [['沙盒', BALANCE], ['故事', STORY_BALANCE]] as const) {
    it(`${label}模式：起始粮够撑过饥荒宽限期（startingGrain ≥ 起始人口 × 7 天）`, () => {
      const people = cfg.startingResources.people ?? 0;
      const grain = cfg.startingResources.grain ?? 0;
      // 起步窗口需覆盖"建出第一批农田回正"的时间 + 饥荒宽限 5 日，取 7 天保守锚点。
      expect(grain).toBeGreaterThanOrEqual(people * 7);
    });
  }

  it('单座农田净产粮 > 0：产出 ≥ 自身雇工的口粮（玩家可靠建农田持续养活增长）', () => {
    const farm = BUILDINGS.find((b) => b.id === 'bld_farm');
    expect(farm).toBeTruthy();
    const output = farm!.output.find((o) => o.resource === 'grain')?.perDay ?? 0;
    const workers = farm!.cost.people ?? 0;
    const workerGrain = workers * CLASS_CONSUMPTION.farmer.grain; // 农民每日吃粮
    // 农田产 10 粮、雇 5 农民吃 5 粮 → 净 +5。这是"经济能正向滚动"的根基。
    expect(output).toBeGreaterThan(workerGrain);
  });

  it('合理开局（4 座农田）模拟 30 天：不饿死、人口增长、粮食既不见底也不爆仓', () => {
    const ee = new EventEmitter() as unknown as IEventEmitter;
    const store = new GameStore(ee, {
      worldMap: allPlainMap(),
      resources: { ...BALANCE.startingResources }, // people:20 → 构造器同步为 20 farmer；grain:150
    });
    const farm = BUILDINGS.find((b) => b.id === 'bld_farm')!;
    const bounds = { width: 60, height: 60 };
    // 开局可雇工上限：20 民 / 每座 5 = 4 座农田（耗木 80 = 起始木）
    let placed = 0;
    for (let i = 0; i < 4; i++) {
      const r = store.placeBuilding(farm, i * 3, 0, bounds);
      if (r.ok) placed++;
    }
    expect(placed, '4 座农田应都能落地（木/劳力恰好够）').toBe(4);

    const cap = store.getResourceCap('grain');
    let minGrain = Infinity;
    let starved = false;
    const startPeople = store.getState().resources.people ?? 0;
    for (let day = 0; day < 30; day++) {
      const before = store.getState().resources.people ?? 0;
      store.tickDay();
      const after = store.getState().resources.people ?? 0;
      if (after < before) starved = true; // 30 天内不应出现减员
      const g = store.getState().resources.grain ?? 0;
      minGrain = Math.min(minGrain, g);
      expect(g, `第${day}天粮食不应见底`).toBeGreaterThan(0);
      expect(g, `第${day}天粮食不应爆仓`).toBeLessThan(cap);
    }
    expect(starved, '30 天内不应饿死减员').toBe(false);
    expect(store.getState().resources.people ?? 0, '人口应增长').toBeGreaterThan(startPeople);
    expect(minGrain).toBeGreaterThan(0);
  });
});
