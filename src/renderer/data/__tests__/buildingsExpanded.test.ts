import { describe, it, expect } from 'vitest';
import { BUILDINGS } from '../buildings';

describe('B-6 building expansion', () => {
  it('total buildings = 35', () => {
    expect(BUILDINGS).toHaveLength(35);
  });

  it('all buildings have unique IDs', () => {
    const ids = BUILDINGS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('new military buildings exist', () => {
    const militaryIds = ['bld_training_ground', 'bld_stable', 'bld_chariot_works', 'bld_city_wall', 'bld_imperial_guard', 'bld_watchtower'];
    for (const id of militaryIds) {
      expect(BUILDINGS.find(b => b.id === id)).toBeDefined();
    }
  });

  // 2026-06-20 回归守护：进阶军事/科技/礼制建筑必须由对应国策门控，否则只看国格会"提前解锁"。
  it('advanced gated buildings require a policy prereq (no grade-only unlock)', () => {
    const mustGate: Record<string, string> = {
      bld_training_ground: 'pol_militia',
      bld_stable: 'pol_militia',
      bld_chariot_works: 'pol_chariot_corps',
      bld_imperial_guard: 'pol_imperial',
      bld_grand_temple: 'pol_imperial',
      bld_observatory: 'pol_school',
      bld_relay_station: 'pol_post_road',
    };
    for (const [id, pol] of Object.entries(mustGate)) {
      const def = BUILDINGS.find(b => b.id === id);
      expect(def, id).toBeDefined();
      expect(def!.upgradeRequires, id).toContain(pol);
    }
  });

  it('new civil buildings exist', () => {
    const civilIds = ['bld_granary', 'bld_relay_station'];
    for (const id of civilIds) {
      expect(BUILDINGS.find(b => b.id === id)).toBeDefined();
    }
  });

  it('new ritual buildings exist', () => {
    const ritualIds = ['bld_censor', 'bld_grand_temple', 'bld_observatory', 'bld_nine_cauldrons'];
    for (const id of ritualIds) {
      expect(BUILDINGS.find(b => b.id === id)).toBeDefined();
    }
  });

  it('tier 4 buildings require high resources', () => {
    const tier4 = BUILDINGS.filter(b => b.tier === 4);
    expect(tier4.length).toBeGreaterThanOrEqual(3);
    for (const b of tier4) {
      const totalCost = Object.values(b.cost).reduce((s, v) => s + (v ?? 0), 0);
      expect(totalCost).toBeGreaterThan(100);
    }
  });

  it('all buildings have valid cost (no negative)', () => {
    for (const b of BUILDINGS) {
      for (const v of Object.values(b.cost)) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('grand_temple produces rite', () => {
    const temple = BUILDINGS.find(b => b.id === 'bld_grand_temple')!;
    expect(temple.output).toContainEqual({ resource: 'rite', perDay: 2 });
  });
});
