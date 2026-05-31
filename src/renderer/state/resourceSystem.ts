import type { GameState } from './gameStore';
import type { BuildingDef } from '../data/schema';
import { RESOURCE_IDS, isValidResourceId } from '../data/resourceRegistry';
import type { ResourceId } from '../data/resourceRegistry';
import { validateModifierEffect } from '../data/modifierValidator';

// Extracts ResourceId from targets like country_grain_output -> grain
function extractOutputResource(target: string): ResourceId | null {
  const match = target.match(/^country_(.+)_output$/);
  if (!match) return null;
  const candidate = match[1];
  if (!candidate || !isValidResourceId(candidate)) return null;
  return candidate;
}

// Pure function: computes per-day resource deltas from buildings + modifiers. Does NOT mutate state.
export function computeDayDeltas(
  state: GameState,
  buildingDefs: Map<string, BuildingDef>,
): Partial<Record<ResourceId, number>> {
  const totals = new Map<ResourceId, number>();

  // Step 1: sum working-building output; subtract upkeep
  for (const building of state.buildings) {
    if (building.status !== 'working') continue;
    const def = buildingDefs.get(building.defId);
    if (!def) continue;
    for (const out of def.output) {
      totals.set(out.resource, (totals.get(out.resource) ?? 0) + out.perDay);
    }
    for (const [res, cost] of Object.entries(def.upkeep)) {
      if (!isValidResourceId(res) || cost === undefined) continue;
      const rid = res as ResourceId;
      totals.set(rid, (totals.get(rid) ?? 0) - cost);
    }
  }

  // Step 2: apply add modifiers (must come before mul to preserve correct order)
  for (const modifier of state.activeModifiers) {
    for (let i = 0; i < modifier.effects.length; i++) {
      const effect = modifier.effects[i];
      if (!effect || effect.op !== 'add') continue;
      validateModifierEffect(effect, `Modifier(${modifier.id}).effects[${i}]`);
      const rid = extractOutputResource(effect.target);
      if (!rid) continue;
      totals.set(rid, (totals.get(rid) ?? 0) + effect.value);
    }
  }

  // Step 3: apply mul modifiers AFTER all adds
  for (const modifier of state.activeModifiers) {
    for (let i = 0; i < modifier.effects.length; i++) {
      const effect = modifier.effects[i];
      if (!effect || effect.op !== 'mul') continue;
      validateModifierEffect(effect, `Modifier(${modifier.id}).effects[${i}]`);
      const rid = extractOutputResource(effect.target);
      if (!rid) continue;
      const current = totals.get(rid) ?? 0;
      totals.set(rid, current * effect.value);
    }
  }

  // Build partial record, omitting zero/undefined entries
  const result: Partial<Record<ResourceId, number>> = {};
  for (const id of RESOURCE_IDS) {
    const val = totals.get(id);
    if (val !== undefined && val !== 0) result[id] = val;
  }
  return result;
}

// Returns ids of modifiers that have expired (remainingDays !== -1 and <= 0).
// Does NOT mutate state; caller passes each id to store.removeModifier().
export function tickModifierLifecycle(state: GameState, _currentDay: number): string[] {
  return state.activeModifiers
    .filter(m => m.remainingDays !== -1 && m.remainingDays <= 0)
    .map(m => m.id);
}
