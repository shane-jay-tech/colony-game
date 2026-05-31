import type { BuildingDef } from './schema';
import { BUILDINGS } from './buildings';

export function validateBuildingDef(b: BuildingDef): void {
  if (b.size.width <= 0 || b.size.height <= 0) {
    throw new Error(`Building ${b.id} has non-positive size: ${b.size.width}x${b.size.height}`);
  }
  if (b.constructionTime < 0) {
    throw new Error(`Building ${b.id} has negative constructionTime: ${b.constructionTime}`);
  }
  for (const [res, amount] of Object.entries(b.cost)) {
    if (amount !== undefined && amount < 0) {
      throw new Error(`Building ${b.id} has negative cost for ${res}: ${amount}`);
    }
  }
  for (const [res, amount] of Object.entries(b.upkeep)) {
    if (amount !== undefined && amount < 0) {
      throw new Error(`Building ${b.id} has negative upkeep for ${res}: ${amount}`);
    }
  }
}

function createBuildingRegistry(buildings: readonly BuildingDef[]): ReadonlyMap<string, BuildingDef> {
  const registry = new Map<string, BuildingDef>();
  for (const b of buildings) {
    if (registry.has(b.id)) {
      throw new Error(`Duplicate building id: ${b.id}`);
    }
    validateBuildingDef(b);
    registry.set(b.id, b);
  }
  return registry;
}

export const BUILDING_REGISTRY: ReadonlyMap<string, BuildingDef> = createBuildingRegistry(BUILDINGS);

export function getBuildingDef(id: string): BuildingDef | undefined {
  return BUILDING_REGISTRY.get(id);
}
