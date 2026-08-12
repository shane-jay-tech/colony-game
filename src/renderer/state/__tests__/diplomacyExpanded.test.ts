import { describe, it, expect } from 'vitest';
import {
  tryTribute, tryTradeAgreement, tryMarriage, tryAlliance, tryProvoke,
  computeNpcDecision, computeNpcMilitary, tickNpcGrowth,
  TRIBUTE_CONFIG, TRADE_AGREEMENT_CONFIG, MARRIAGE_CONFIG,
  ALLIANCE_CONFIG, PROVOKE_CONFIG, PERSONALITY_MUL,
} from '../diplomacyExpanded';
import type { NpcCountryState } from '../../data/schema';
import { createRng } from '../rng';

function makeNpc(overrides: Partial<NpcCountryState> = {}): NpcCountryState {
  return {
    id: 'npc_qi',
    stance: 0,
    militaryPower: 60,
    renown: 50,
    tradeRoute: false,
    tradeCooldown: 0,
    warStatus: 'peace',
    lastEnvoyDay: -1,
    lastWarDay: -1,
    allyIds: [],
    aggression: 30,
    lastActionDay: -1,
    ...overrides,
  };
}

describe('B-3 tribute (朝贡)', () => {
  it('succeeds when NPC military > player * 1.3', () => {
    const npc = makeNpc({ militaryPower: 200 });
    const result = tryTribute(npc, 100);
    expect(result.ok).toBe(true);
    expect(result.npcStateDelta?.stance).toBe(0 + TRIBUTE_CONFIG.stanceBonus);
  });

  it('fails when NPC is too weak', () => {
    const npc = makeNpc({ militaryPower: 50 });
    const result = tryTribute(npc, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('npc_too_weak');
  });

  it('stance clamps at 100', () => {
    const npc = makeNpc({ militaryPower: 200, stance: 90 });
    const result = tryTribute(npc, 100);
    expect(result.ok).toBe(true);
    expect(result.npcStateDelta?.stance).toBe(100);
  });
});

describe('B-3 trade agreement (贸易协定)', () => {
  it('succeeds when stance >= 0', () => {
    const npc = makeNpc({ stance: 0 });
    const result = tryTradeAgreement(npc);
    expect(result.ok).toBe(true);
  });

  it('fails when stance < 0', () => {
    const npc = makeNpc({ stance: -5 });
    const result = tryTradeAgreement(npc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stance_too_low');
  });

  it('fails when at war', () => {
    const npc = makeNpc({ stance: 10, warStatus: 'war' });
    const result = tryTradeAgreement(npc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('at_war');
  });
});

describe('B-3 marriage (联姻)', () => {
  it('succeeds with stance >= 30 and rite >= 10', () => {
    const npc = makeNpc({ stance: 30 });
    const result = tryMarriage(npc, { rite: 10 });
    expect(result.ok).toBe(true);
    expect(result.resourceDeltas?.rite).toBe(-MARRIAGE_CONFIG.riteCost);
    expect(result.npcStateDelta?.stance).toBe(80); // 30 + 50
  });

  it('fails when stance too low', () => {
    const npc = makeNpc({ stance: 20 });
    const result = tryMarriage(npc, { rite: 20 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stance_too_low');
  });

  it('fails when not enough rite', () => {
    const npc = makeNpc({ stance: 30 });
    const result = tryMarriage(npc, { rite: 5 });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_rite');
  });
});

describe('B-3 alliance (结盟)', () => {
  it('succeeds with stance >= 50', () => {
    const npc = makeNpc({ stance: 50 });
    const result = tryAlliance(npc);
    expect(result.ok).toBe(true);
  });

  it('fails when stance < 50', () => {
    const npc = makeNpc({ stance: 49 });
    const result = tryAlliance(npc);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stance_too_low');
  });
});

describe('B-3 provoke (挑拨)', () => {
  it('succeeds with enough gold and renown', () => {
    const result = tryProvoke('npc_qi', 'npc_jin', { gold: 30 }, 20);
    expect(result.ok).toBe(true);
    expect(result.resourceDeltas?.gold).toBe(-PROVOKE_CONFIG.goldCost);
    expect(result.secondNpcId).toBe('npc_jin');
    expect(result.secondNpcStanceDelta).toBe(PROVOKE_CONFIG.stanceDelta);
  });

  it('fails targeting same NPC', () => {
    const result = tryProvoke('npc_qi', 'npc_qi', { gold: 30 }, 20);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('same_target');
  });

  it('fails with insufficient gold', () => {
    const result = tryProvoke('npc_qi', 'npc_jin', { gold: 10 }, 20);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_gold');
  });

  it('fails with insufficient renown', () => {
    const result = tryProvoke('npc_qi', 'npc_jin', { gold: 30 }, 5);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_renown');
  });
});

describe('B-3 NPC military growth', () => {
  it('martial archetype gets 1.3x multiplier', () => {
    const power = computeNpcMilitary(100, 'martial');
    expect(power).toBe(Math.round(100 * 0.4 * 1.3)); // 52
  });

  it('commercial archetype gets 0.8x multiplier', () => {
    const power = computeNpcMilitary(100, 'commercial');
    expect(power).toBe(Math.round(100 * 0.4 * 0.8)); // 32
  });

  it('national power grows over time', () => {
    const np0 = 100;
    const np30 = tickNpcGrowth(np0, 0);
    expect(np30).toBeGreaterThan(np0);
    const np360 = tickNpcGrowth(np0, 360);
    expect(np360).toBeGreaterThan(np30); // later = faster growth
  });

  it('growth formula: += 2 * (1 + day/360)', () => {
    expect(tickNpcGrowth(100, 0)).toBeCloseTo(102); // +2*(1+0) = +2
    expect(tickNpcGrowth(100, 360)).toBeCloseTo(104); // +2*(1+1) = +4
    expect(tickNpcGrowth(100, 720)).toBeCloseTo(106); // +2*(1+2) = +6
  });
});

describe('B-3 NPC AI decision', () => {
  const rng = createRng(42);

  it('attacks weak hostile player', () => {
    const npc = makeNpc({ militaryPower: 100, stance: -30, lastActionDay: -1 });
    const decision = computeNpcDecision(npc, 50, [], 60, createRng(1));
    expect(decision).not.toBeNull();
    expect(decision!.kind).toBe('attack');
    expect(decision!.daysUntilExecution).toBeGreaterThanOrEqual(5);
    expect(decision!.daysUntilExecution).toBeLessThanOrEqual(10);
  });

  it('seeks trade when player is much stronger', () => {
    const npc = makeNpc({ militaryPower: 30, stance: 10, lastActionDay: -1 });
    const decision = computeNpcDecision(npc, 100, [], 60, createRng(1));
    expect(decision).not.toBeNull();
    expect(decision!.kind).toBe('seek_trade');
  });

  it('seeks alliance when threatened by another NPC', () => {
    const npc = makeNpc({ militaryPower: 40, stance: 10, lastActionDay: -1 });
    const dominant = makeNpc({ id: 'npc_jin', militaryPower: 80 });
    const decision = computeNpcDecision(npc, 50, [dominant], 60, createRng(1));
    expect(decision).not.toBeNull();
    expect(decision!.kind).toBe('seek_alliance');
  });

  it('unites against strongest when balance broken', () => {
    const npc = makeNpc({ militaryPower: 50, stance: 10, lastActionDay: -1 });
    const others = [makeNpc({ id: 'npc_jin', militaryPower: 70 })];
    const decision = computeNpcDecision(npc, 60, others, 60, createRng(1));
    expect(decision).not.toBeNull();
    expect(decision!.kind).toBe('unite_against');
    expect(decision!.targetId).toBe('npc_jin');
  });

  it('returns null when cooldown not expired', () => {
    const npc = makeNpc({ lastActionDay: 50 });
    const decision = computeNpcDecision(npc, 50, [], 60, createRng(1));
    expect(decision).toBeNull();
  });

  it('returns null in balanced state with neutral stance', () => {
    const npc = makeNpc({ militaryPower: 50, stance: 0, lastActionDay: -1 });
    const decision = computeNpcDecision(npc, 50, [], 60, createRng(1));
    expect(decision).toBeNull();
  });
});
