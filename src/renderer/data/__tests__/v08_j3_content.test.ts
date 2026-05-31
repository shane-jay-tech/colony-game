/**
 * J-3 v0.8 内容回归锁：确保 8 新建筑 + 5 新国策 + 2 新朝令 + 6 新事件
 * + 2 新 modifier target 进 ship list 后不被回退。
 *
 * 任何失败都说明 v0.7→v0.8 内容缺失或拼错；测试比读 PR 描述更可靠。
 */

import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../buildings';
import { POLICIES } from '../policies';
import { DECREES } from '../decrees';
import { EVENTS } from '../events';
import { MODIFIER_TARGETS, isValidModifierTarget } from '../resourceRegistry';
import { DEFAULT_MAP_SIZE } from '../../state/gameStore';

const NEW_BUILDING_IDS = [
  'bld_beacon_tower',
  'bld_post_road',
  'bld_water_mill',
  'bld_iron_forge',
  'bld_mulberry_grove',
  'bld_stele_yard',
  'bld_village_school',
  'bld_envoy_lodge',
] as const;

const NEW_POLICY_IDS = [
  'pol_lookout',
  'pol_post_road',
  'pol_water_works',
  'pol_iron_smelt',
  'pol_diplomacy',
] as const;

const NEW_DECREE_IDS = ['decree_cast_ding', 'decree_stele_market'] as const;

const NEW_EVENT_IDS = [
  'evt_drought_grain',
  'evt_river_flood',
  'evt_neighbor_starve',
  'evt_old_scholar',
  'evt_bandit_raid',
  'evt_artisan_offer',
] as const;

describe('v0.8 J-3 — 8 new buildings', () => {
  for (const id of NEW_BUILDING_IDS) {
    it(`${id} is in BUILDINGS`, () => {
      expect(BUILDINGS.some(b => b.id === id)).toBe(true);
    });
  }
  it('total count is 20 (12 v0.7 + 8 J-3)', () => {
    expect(BUILDINGS.length).toBe(20);
  });
  it('every new building has descPlain (Kimi 反审 #4 — 白话翻译)', () => {
    for (const id of NEW_BUILDING_IDS) {
      const def = BUILDINGS.find(b => b.id === id);
      expect(def, `def for ${id}`).toBeDefined();
      expect(def!.descPlain.length, `descPlain for ${id}`).toBeGreaterThan(0);
    }
  });
});

describe('v0.8 J-3 — 5 new policies', () => {
  for (const id of NEW_POLICY_IDS) {
    it(`${id} is in POLICIES`, () => {
      expect(POLICIES.some(p => p.id === id)).toBe(true);
    });
  }
});

describe('v0.8 J-3 — 石碑/铸鼎 二选一 decrees', () => {
  for (const id of NEW_DECREE_IDS) {
    it(`${id} is in DECREES`, () => {
      expect(DECREES.some(d => d.id === id)).toBe(true);
    });
  }
  it('decree_cast_ding has 2 stages (短快线)', () => {
    const def = DECREES.find(d => d.id === 'decree_cast_ding');
    expect(def?.stages.length).toBe(2);
  });
  it('decree_stele_market has 2 stages (慢深线)', () => {
    const def = DECREES.find(d => d.id === 'decree_stele_market');
    expect(def?.stages.length).toBe(2);
  });
  it('立碑线 stage 1 days > 铸鼎线 stage 1 days (民间向慢)', () => {
    const ding = DECREES.find(d => d.id === 'decree_cast_ding');
    const stele = DECREES.find(d => d.id === 'decree_stele_market');
    expect(stele?.stages[0]?.days).toBeGreaterThan(ding?.stages[0]?.days ?? 0);
  });
});

describe('v0.8 J-3 — 6 双向决策 events', () => {
  for (const id of NEW_EVENT_IDS) {
    it(`${id} is in EVENTS`, () => {
      expect(EVENTS.some(e => e.id === id)).toBe(true);
    });
  }
  it('every new event has 2 choices (为君之道 / 为民之道)', () => {
    for (const id of NEW_EVENT_IDS) {
      const def = EVENTS.find(e => e.id === id);
      expect(def?.choices?.length, `choices for ${id}`).toBe(2);
    }
  });
  it('every new event tagged 抉择', () => {
    for (const id of NEW_EVENT_IDS) {
      const def = EVENTS.find(e => e.id === id);
      expect(def?.tags.includes('抉择'), `tags for ${id}`).toBe(true);
    }
  });
});

describe('v0.8 J-3 — modifier target additions', () => {
  it('country_renown is registered (立信路径核心 metric)', () => {
    expect(isValidModifierTarget('country_renown')).toBe(true);
    expect(MODIFIER_TARGETS.includes('country_renown')).toBe(true);
  });
  it('building_output_area is registered', () => {
    expect(isValidModifierTarget('building_output_area')).toBe(true);
  });
});

describe('v0.8 J-3 — map size bump', () => {
  it('DEFAULT_MAP_SIZE is 80 (was 32 in v0.7, ×6.25 tile area)', () => {
    expect(DEFAULT_MAP_SIZE).toBe(80);
  });
});

// v1.0 #2：朝堂政令扩展 — 12+ 条朝令，分五大族；3 条以上链路
describe('v1.0 #2 — 朝堂政令扩展（广 + 深）', () => {
  const REQUIRED_NEW = [
    'decree_train_levy',     // 军事·二
    'decree_hegemony',       // 军事·三
    'decree_envoy_mission',  // 外交·一
    'decree_alliance_oath',  // 外交·二
    'decree_compile_rites',  // 礼制·长深二
    'decree_promote_agri',   // 内政·一
    'decree_tuntian',        // 内政·二
    'decree_workshop_levy',  // 工坊
  ] as const;

  it('总数 ≥ 12 条', () => {
    expect(DECREES.length).toBeGreaterThanOrEqual(12);
  });

  it('每条 decree 有 category 字段', () => {
    for (const d of DECREES) {
      expect(d.category, `category for ${d.id}`).toBeDefined();
    }
  });

  it('五大族都有覆盖：内政/军事/外交/礼制/工坊', () => {
    const cats = new Set(DECREES.map(d => d.category));
    expect(cats.has('内政')).toBe(true);
    expect(cats.has('军事')).toBe(true);
    expect(cats.has('外交')).toBe(true);
    expect(cats.has('礼制')).toBe(true);
    expect(cats.has('工坊')).toBe(true);
  });

  for (const id of REQUIRED_NEW) {
    it(`${id} is in DECREES`, () => {
      expect(DECREES.some(d => d.id === id)).toBe(true);
    });
  }

  it('链路：军事三阶 conscript → train_levy → hegemony', () => {
    const t = DECREES.find(d => d.id === 'decree_train_levy');
    const h = DECREES.find(d => d.id === 'decree_hegemony');
    expect(t?.chainPrev).toBe('decree_conscript');
    expect(h?.chainPrev).toBe('decree_train_levy');
  });

  it('链路：外交 envoy_mission → alliance_oath', () => {
    const a = DECREES.find(d => d.id === 'decree_alliance_oath');
    expect(a?.chainPrev).toBe('decree_envoy_mission');
  });

  it('链路：礼制 stele_market → compile_rites（长深线）', () => {
    const c = DECREES.find(d => d.id === 'decree_compile_rites');
    expect(c?.chainPrev).toBe('decree_stele_market');
  });

  it('链路：内政 promote_agri → tuntian', () => {
    const t = DECREES.find(d => d.id === 'decree_tuntian');
    expect(t?.chainPrev).toBe('decree_promote_agri');
  });

  it('每条 chainPrev 都指向真实存在的 decree id', () => {
    const ids = new Set(DECREES.map(d => d.id));
    for (const d of DECREES) {
      if (d.chainPrev) {
        expect(ids.has(d.chainPrev), `chainPrev ${d.chainPrev} from ${d.id}`).toBe(true);
      }
    }
  });

  it('每条都有 descPlain 白话说明（≥10 字）', () => {
    for (const d of DECREES) {
      expect(d.descPlain.length, `descPlain ${d.id}`).toBeGreaterThanOrEqual(10);
    }
  });
});

// v1.0 #1：国策深度（HOI4 树状递进）— 23+ 政策，6 大 branch 都有覆盖，至少 2 处互斥岔路
describe('v1.0 #1 — 国策深度（HOI4 树状递进）', () => {
  const REQUIRED_NEW_POLICIES = [
    'pol_grain_storage', 'pol_loom_workshop',     // 农桑·重粮 / 重桑
    'pol_mint', 'pol_iron_arms',                   // 工坊·商道 / 兵道
    'pol_ancestor_rites', 'pol_ritual_codex',      // 礼制 L1 / L2
    'pol_militia', 'pol_chariot_corps', 'pol_naval_corps', // 保甲 L2 / L3 二选一
    'pol_marriage_alliance',                       // 外交 L2
    'pol_classics_compile',                        // 学问 L2
  ] as const;

  it('总数 ≥ 22 条', () => {
    expect(POLICIES.length).toBeGreaterThanOrEqual(22);
  });

  it('六大分支都有政策：农桑/工坊/礼制/保甲/外交/学问', () => {
    const branches = new Set(POLICIES.map(p => p.branch));
    expect(branches.has('农桑')).toBe(true);
    expect(branches.has('工坊')).toBe(true);
    expect(branches.has('礼制')).toBe(true);
    expect(branches.has('保甲')).toBe(true);
    expect(branches.has('外交')).toBe(true);
    expect(branches.has('学问')).toBe(true);
  });

  it('每个分支至少 2 层深度（tier ≥ 2 各支至少 1 条）', () => {
    const branchMaxTier = new Map<string, number>();
    for (const p of POLICIES) {
      const cur = branchMaxTier.get(p.branch) ?? 0;
      if (p.tier > cur) branchMaxTier.set(p.branch, p.tier);
    }
    for (const [branch, maxTier] of branchMaxTier) {
      expect(maxTier, `branch ${branch} max tier`).toBeGreaterThanOrEqual(2);
    }
  });

  for (const id of REQUIRED_NEW_POLICIES) {
    it(`${id} is in POLICIES`, () => {
      expect(POLICIES.some(p => p.id === id)).toBe(true);
    });
  }

  it('至少 2 对互斥岔路（重粮/重桑、商道/兵道）', () => {
    const grain = POLICIES.find(p => p.id === 'pol_grain_storage');
    const loom = POLICIES.find(p => p.id === 'pol_loom_workshop');
    expect(grain?.mutuallyExclusive).toContain('pol_loom_workshop');
    expect(loom?.mutuallyExclusive).toContain('pol_grain_storage');

    const mint = POLICIES.find(p => p.id === 'pol_mint');
    const arms = POLICIES.find(p => p.id === 'pol_iron_arms');
    expect(mint?.mutuallyExclusive).toContain('pol_iron_arms');
    expect(arms?.mutuallyExclusive).toContain('pol_mint');
  });

  it('每条 prereq 都指向真实存在的 policy id', () => {
    const ids = new Set(POLICIES.map(p => p.id));
    for (const p of POLICIES) {
      for (const pre of p.prerequisites) {
        expect(ids.has(pre), `prereq ${pre} from ${p.id}`).toBe(true);
      }
    }
  });

  it('每条 mutuallyExclusive 都指向真实存在的 policy id', () => {
    const ids = new Set(POLICIES.map(p => p.id));
    for (const p of POLICIES) {
      for (const ex of p.mutuallyExclusive ?? []) {
        expect(ids.has(ex), `mutex ${ex} from ${p.id}`).toBe(true);
      }
    }
  });

  it('互斥关系对称（A.mutex 含 B → B.mutex 含 A）', () => {
    const byId = new Map(POLICIES.map(p => [p.id, p] as const));
    for (const a of POLICIES) {
      for (const exId of a.mutuallyExclusive ?? []) {
        const b = byId.get(exId);
        expect(b?.mutuallyExclusive ?? [], `${exId} should mark ${a.id} as mutex`).toContain(a.id);
      }
    }
  });
});

// v1.0 #4：阶段名（tierName）作为 invariant — 让 popover 显示「草庐/列肆/百炼」之类历史名而非笼统 T1/T2/T3
describe('v1.0 #4 — every BuildingDef has a tierName stage label', () => {
  it('every BUILDINGS def carries a tierName (1-4 chars)', () => {
    for (const def of BUILDINGS) {
      expect(def.tierName, `tierName for ${def.id}`).toBeDefined();
      expect(def.tierName!.length, `tierName length for ${def.id}`).toBeGreaterThan(0);
      expect(def.tierName!.length, `tierName length for ${def.id}`).toBeLessThanOrEqual(4);
    }
  });
  it('tierName is not the placeholder T1/T2/T3', () => {
    for (const def of BUILDINGS) {
      expect(def.tierName, `tierName for ${def.id}`).not.toMatch(/^T\d$/);
    }
  });
});
