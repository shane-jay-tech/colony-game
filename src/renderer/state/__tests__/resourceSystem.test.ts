import { describe, it, expect } from 'vitest';
import { computeDayDeltas, tickModifierLifecycle } from '../resourceSystem';
import type { GameState } from '../gameStore';
import type { BuildingDef, ModifierInstance } from '../../data/schema';
import type { ResourceId } from '../../data/resourceRegistry';
import { generateMap } from '../mapGen';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    resources: {},
    buildings: [],
    policies: [],
    activeModifiers: [],
    activeDecrees: [],
    eventHistory: [],
    pendingEventId: null,
    pendingEventDayStart: null,
    tutorialStepId: null,
    seenJitHints: [],
    lastEventDay: 0,
    lastSeenTimestamp: 0,
    paused: false,
    speed: 1,
    lastTickTimestamp: 0,
    currentDay: 0,
    rngSeed: 12345,
    worldMap: generateMap({ width: 8, height: 8, seed: 1 }),
    productionCarry: {},
    panelCollapsed: { left: false, right: false },
    completedDecreeIds: [],
    npcCountries: [],
    playerMorale: 50,
    playerMilitaryPower: 30,
    grade: 0,
    gradeReached: 0,
    tianxiaAcknowledged: false,
    dualZeroDays: 0,
    crisisActive: false,
    crisisRecoverDays: 0,
    mode: 'sandbox',
    populationCarry: 0,
    crisisCount: 0,
    vassalOf: null,
    storyFlags: null,
    ...overrides,
  };
}

function makeDef(
  id: string,
  output: { resource: ResourceId; perDay: number }[] = [],
  upkeep: Partial<Record<ResourceId, number>> = {},
): BuildingDef {
  return {
    id, name: id, category: '民生', tier: 1, cost: {}, constructionTime: 5,
    output, upkeep, size: { width: 1, height: 1 },
    assetKey: id, upgradeRequires: [], badgeRules: [], description: '', descPlain: '',
  };
}

function makeModifier(id: string, remainingDays: number): ModifierInstance {
  return {
    id, name: id, category: 'economy', stackable: true,
    effects: [], visualBadge: null, remainingDays, description: '', descPlain: '',
  };
}

describe('computeDayDeltas', () => {
  it('working building with grain 10/day gives +10 delta', () => {
    const state = makeState({
      buildings: [{
        defId: 'farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
    });
    const defs = new Map([['farm', makeDef('farm', [{ resource: 'grain', perDay: 10 }])]]);
    const deltas = computeDayDeltas(state, defs);
    expect(deltas.grain).toBe(10);
  });

  it('constructing building does NOT contribute to delta', () => {
    const state = makeState({
      buildings: [{
        defId: 'farm', position: { x: 0, y: 0 }, status: 'constructing',
        tier: 1, constructionProgress: 50, modifiers: [],
      }],
    });
    const defs = new Map([['farm', makeDef('farm', [{ resource: 'grain', perDay: 10 }])]]);
    const deltas = computeDayDeltas(state, defs);
    expect(deltas.grain ?? 0).toBe(0);
  });

  it('add then mul: (base + add) * mul', () => {
    // base=10, add=5 => 15, mul=2 => 30
    const addMod: ModifierInstance = {
      id: 'add_mod', name: 'add', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_output', op: 'add', value: 5 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    };
    const mulMod: ModifierInstance = {
      id: 'mul_mod', name: 'mul', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_output', op: 'mul', value: 2 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    };
    const state = makeState({
      buildings: [{
        defId: 'farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
      activeModifiers: [addMod, mulMod],
    });
    const defs = new Map([['farm', makeDef('farm', [{ resource: 'grain', perDay: 10 }])]]);
    expect(computeDayDeltas(state, defs).grain).toBe(30);
  });

  it('mul modifier alone multiplies base', () => {
    const mulMod: ModifierInstance = {
      id: 'mul_mod', name: 'mul', category: 'economy', stackable: true,
      effects: [{ target: 'country_grain_output', op: 'mul', value: 2 }],
      visualBadge: null, remainingDays: -1, description: '', descPlain: '',
    };
    const state = makeState({
      buildings: [{
        defId: 'farm', position: { x: 0, y: 0 }, status: 'working',
        tier: 1, constructionProgress: 100, modifiers: [],
      }],
      activeModifiers: [mulMod],
    });
    const defs = new Map([['farm', makeDef('farm', [{ resource: 'grain', perDay: 10 }])]]);
    expect(computeDayDeltas(state, defs).grain).toBe(20);
  });
});

describe('tickModifierLifecycle', () => {
  it('remainingDays=0 is returned', () => {
    const state = makeState({ activeModifiers: [makeModifier('expiring', 0)] });
    expect(tickModifierLifecycle(state, 0)).toContain('expiring');
  });

  it('remainingDays=5 is NOT returned', () => {
    const state = makeState({ activeModifiers: [makeModifier('active', 5)] });
    expect(tickModifierLifecycle(state, 0)).not.toContain('active');
  });

  it('remainingDays=-1 (permanent) is NOT returned', () => {
    const state = makeState({ activeModifiers: [makeModifier('permanent', -1)] });
    expect(tickModifierLifecycle(state, 0)).not.toContain('permanent');
  });
});
