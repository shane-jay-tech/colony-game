import { describe, it, expect } from 'vitest';
import { tryAdoptPolicy, isPolicyAvailable } from '../policySystem';
import type { PolicyNode } from '../../data/schema';

function policy(over: Partial<PolicyNode> = {}): PolicyNode {
  return {
    id: 'p1',
    name: '务农',
    branch: '农桑',
    x: 0, y: 0,
    cost: { gold: 20 },
    effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
    prerequisites: [],
    tier: 1,
    description: '',
    descPlain: '',
    ...over,
  };
}

describe('tryAdoptPolicy — happy path', () => {
  it('returns deltas + modifier when affordable', () => {
    const result = tryAdoptPolicy(policy(), new Set(), { gold: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deltas.gold).toBe(-20);
      expect(result.modifier.id).toBe('pol_modifier_p1');
      expect(result.modifier.remainingDays).toBe(-1);
      expect(result.modifier.effects).toHaveLength(1);
    }
  });

  it('branch 农桑 maps to economy category', () => {
    const result = tryAdoptPolicy(policy({ branch: '农桑' }), new Set(), { gold: 100 });
    if (result.ok) expect(result.modifier.category).toBe('economy');
  });

  it('branch 礼制 maps to culture category', () => {
    const result = tryAdoptPolicy(policy({ branch: '礼制' }), new Set(), { gold: 100 });
    if (result.ok) expect(result.modifier.category).toBe('culture');
  });

  it('branch 保甲 maps to military category', () => {
    const result = tryAdoptPolicy(policy({ branch: '保甲' }), new Set(), { gold: 100 });
    if (result.ok) expect(result.modifier.category).toBe('military');
  });
});

describe('tryAdoptPolicy — failure paths', () => {
  it('already_adopted', () => {
    const result = tryAdoptPolicy(policy(), new Set(['p1']), { gold: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('already_adopted');
  });

  it('prerequisites_unmet returns missing list', () => {
    const result = tryAdoptPolicy(
      policy({ prerequisites: ['p_root', 'p_other'] }),
      new Set(['p_root']),
      { gold: 100 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('prerequisites_unmet');
      expect(result.missingPrereqs).toEqual(['p_other']);
    }
  });

  it('insufficient_resources', () => {
    const result = tryAdoptPolicy(policy({ cost: { gold: 100 } }), new Set(), { gold: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_resources');
  });
});

// v1.0 #1：HOI4-style mutex
describe('tryAdoptPolicy — mutually_excluded (v1.0 #1)', () => {
  it('blocks when a sibling in mutuallyExclusive has been adopted', () => {
    const grain = policy({ id: 'pol_grain_storage', mutuallyExclusive: ['pol_loom_workshop'] });
    const result = tryAdoptPolicy(grain, new Set(['pol_loom_workshop']), { gold: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('mutually_excluded');
      expect(result.blockingExclusives).toEqual(['pol_loom_workshop']);
    }
  });

  it('allows when no sibling in mutuallyExclusive has been adopted', () => {
    const grain = policy({ id: 'pol_grain_storage', mutuallyExclusive: ['pol_loom_workshop'] });
    const result = tryAdoptPolicy(grain, new Set(), { gold: 100 });
    expect(result.ok).toBe(true);
  });

  it('mutex check happens before prereq check (clearer locked hint)', () => {
    const grain = policy({
      id: 'pol_grain_storage',
      mutuallyExclusive: ['pol_loom_workshop'],
      prerequisites: ['pol_unmet'],
    });
    const result = tryAdoptPolicy(grain, new Set(['pol_loom_workshop']), { gold: 100 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('mutually_excluded');
  });

  it('no mutuallyExclusive field: irrelevant', () => {
    const result = tryAdoptPolicy(policy(), new Set(['some_other']), { gold: 100 });
    expect(result.ok).toBe(true);
  });
});

describe('isPolicyAvailable', () => {
  it('returns true when no prerequisites and not adopted', () => {
    expect(isPolicyAvailable(policy(), new Set())).toBe(true);
  });
  it('returns false when adopted', () => {
    expect(isPolicyAvailable(policy(), new Set(['p1']))).toBe(false);
  });
  it('returns false when prereq missing', () => {
    expect(isPolicyAvailable(policy({ prerequisites: ['p_root'] }), new Set())).toBe(false);
  });
  it('returns true when prereq satisfied', () => {
    expect(isPolicyAvailable(policy({ prerequisites: ['p_root'] }), new Set(['p_root']))).toBe(true);
  });
});
