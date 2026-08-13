import { describe, it, expect } from 'vitest';
import {
  npcMilitaryGrowthStep,
  evaluatePlayerStrength,
  computeNpcAlliances,
  computeNpcActions,
} from '../npcDynamics';
import type { NpcArchetype, NpcCountryDef, NpcCountryState } from '../../data/schema';

function def(id: string, archetype: NpcArchetype): NpcCountryDef {
  return {
    id, name: id, archetype, homeColor: 0, description: '', descPlain: '',
    initialStance: 0, initialMilitaryPower: 50, initialRenown: 50,
  };
}
function st(id: string, over: Partial<NpcCountryState> = {}): NpcCountryState {
  return {
    id, stance: -30, militaryPower: 50, renown: 50, tradeRoute: false, tradeCooldown: 0,
    warStatus: 'peace', lastEnvoyDay: -1, lastWarDay: -1, allyIds: [], aggression: 50, lastActionDay: -1,
    ...over,
  };
}
const DEFS: Record<string, NpcCountryDef> = {
  a: def('a', 'martial'), b: def('b', 'commercial'), c: def('c', 'cultural'), r: def('r', 'tribal'),
};
const defOf = (id: string) => DEFS[id];

describe('npcMilitaryGrowthStep', () => {
  it('archetype 决定速率：武>夷>礼>商', () => {
    expect(npcMilitaryGrowthStep('martial')).toBe(4);
    expect(npcMilitaryGrowthStep('tribal')).toBe(3);
    expect(npcMilitaryGrowthStep('cultural')).toBe(2);
    expect(npcMilitaryGrowthStep('commercial')).toBe(1);
  });
});

describe('evaluatePlayerStrength', () => {
  it('低国力 → weak', () => {
    expect(evaluatePlayerStrength({ grade: 0, militaryPower: 30, renown: 40, population: 20 })).toBe('weak');
  });
  it('登顶高军力 → strong', () => {
    expect(evaluatePlayerStrength({ grade: 5, militaryPower: 200, renown: 90, population: 300 })).toBe('strong');
  });
  it('中等 → balanced', () => {
    expect(evaluatePlayerStrength({ grade: 2, militaryPower: 60, renown: 50, population: 60 })).toBe('balanced');
  });
});

describe('computeNpcAlliances', () => {
  it('玩家非 strong → 解散现有联盟', () => {
    const states = [st('a', { allyIds: ['b'] }), st('b', { allyIds: ['a'] })];
    const patch = computeNpcAlliances(states, defOf, 'balanced', () => 0);
    expect(patch['a']).toEqual([]);
    expect(patch['b']).toEqual([]);
  });
  it('玩家 strong → 敌对非蛮夷两两结盟（rng 命中）', () => {
    const states = [st('a'), st('b'), st('r')]; // a/b 敌对非夷，r 蛮夷
    const patch = computeNpcAlliances(states, defOf, 'strong', () => 0); // 0<0.5 必结盟
    expect(patch['a']).toContain('b');
    expect(patch['b']).toContain('a');
    expect(patch['r']).toBeUndefined(); // 蛮夷不入盟
  });
  it('stance≥0 的不结盟', () => {
    const states = [st('a', { stance: 10 }), st('b', { stance: 20 })];
    const patch = computeNpcAlliances(states, defOf, 'strong', () => 0);
    expect(Object.keys(patch)).toHaveLength(0);
  });
});

describe('computeNpcActions', () => {
  it('蛮夷任何阶段都可能骚扰（rng 命中 → harass_player）', () => {
    const acts = computeNpcActions([st('r')], defOf, 'balanced', 100, () => 0);
    expect(acts).toHaveLength(1);
    expect(acts[0]!.kind).toBe('harass_player');
    expect(acts[0]!.resourceRaid).toBeDefined();
  });
  it('冷却期内不行动', () => {
    const acts = computeNpcActions([st('r', { lastActionDay: 90 })], defOf, 'balanced', 100, () => 0);
    expect(acts).toHaveLength(0); // 100-90=10 < 24 冷却
  });
  it('玩家 strong + 有盟友 + 敌对 → 联军压境 assault', () => {
    const acts = computeNpcActions([st('a', { allyIds: ['b'], stance: -40 })], defOf, 'strong', 100, () => 0);
    expect(acts[0]!.kind).toBe('assault_player');
    expect(acts[0]!.playerMilitaryDelta).toBeLessThan(0);
  });
  it('玩家 weak → 强 NPC 攻伐弱 NPC', () => {
    const states = [st('a', { militaryPower: 100 }), st('b', { militaryPower: 30 })];
    const acts = computeNpcActions(states, defOf, 'weak', 100, () => 0);
    expect(acts.some(x => x.kind === 'npc_vs_npc' && x.actorId === 'a' && x.targetId === 'b')).toBe(true);
  });
  it('rng 不命中 → 无行动', () => {
    const acts = computeNpcActions([st('r')], defOf, 'balanced', 100, () => 0.99);
    expect(acts).toHaveLength(0);
  });
  it('单日对玩家敌对行动有上限（防多邦齐揍）', () => {
    // 4 个高侵略蛮夷，rng 全命中，但对玩家敌对行动应被 MAX_PLAYER_HOSTILE_PER_DAY 截断
    const states = [st('r'), st('r2'), st('r3'), st('r4')];
    const defs: Record<string, NpcCountryDef> = {
      r: def('r', 'tribal'), r2: def('r2', 'tribal'), r3: def('r3', 'tribal'), r4: def('r4', 'tribal'),
    };
    const acts = computeNpcActions(states, (id) => defs[id], 'balanced', 100, () => 0);
    const hostile = acts.filter(a => a.kind === 'harass_player' || a.kind === 'assault_player');
    expect(hostile.length).toBeLessThanOrEqual(2);
  });

  // P2 三幕时间轴参数
  it('第一幕 tribalRaidMul 1.6：rng=0.2 时蛮夷犯边（base 0.15+0.5*0.25=0.275 本就命中，乘数加剧）', () => {
    const base = computeNpcActions([st('r')], defOf, 'balanced', 100, () => 0.35); // base 0.275 → 0.35 不犯
    expect(base).toHaveLength(0);
    const boosted = computeNpcActions(
      [st('r')], defOf, 'balanced', 100, () => 0.35,
      { tribalRaidMul: 1.6, allianceBias: 0, assaultMul: 1 }, // 0.275*1.6=0.44 → 0.35 犯边
    );
    expect(boosted.some(a => a.kind === 'harass_player')).toBe(true);
  });

  it('allianceBias 负值压制结盟：rng=0.4 在 base 0.5 下结盟、bias -0.4（0.1）下不结盟', () => {
    const states = [st('a'), st('b')];
    const base = computeNpcAlliances(states, defOf, 'strong', () => 0.4);
    expect(base['a']).toContain('b');
    const damped = computeNpcAlliances(
      states, defOf, 'strong', () => 0.4,
      { tribalRaidMul: 1, allianceBias: -0.4, assaultMul: 1 },
    );
    expect(damped['a'] ?? []).not.toContain('b');
  });

  it('assaultMul 抬高联军压境：rng=0.35 在 base 0.2+0.5*0.2=0.3 下不压、×1.6=0.48 下压境', () => {
    const states = [st('a', { allyIds: ['b'] }), st('b', { allyIds: ['a'] })];
    const base = computeNpcActions(states, defOf, 'strong', 100, () => 0.35);
    expect(base.some(a => a.kind === 'assault_player')).toBe(false);
    const boosted = computeNpcActions(
      states, defOf, 'strong', 100, () => 0.35,
      { tribalRaidMul: 1, allianceBias: 0, assaultMul: 1.6 },
    );
    expect(boosted.some(a => a.kind === 'assault_player')).toBe(true);
  });
});
