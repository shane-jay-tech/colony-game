/**
 * B-4.2 巨型工程逻辑（纯函数）。
 * 分阶段建造，每阶段有独立耗时和消耗。
 */

import type { MegaProjectDef } from '../data/megaProjects';
import { MEGA_PROJECTS } from '../data/megaProjects';
import type { ResourceId } from '../data/resourceRegistry';

export interface MegaProjectProgress {
  projectId: string;
  currentPhase: number;
  daysRemaining: number;
  completed: boolean;
}

export function canStartProject(
  projectId: string,
  buildings: readonly { defId: string }[],
  activeProjects: readonly MegaProjectProgress[],
): { ok: boolean; reason?: string } {
  const def = MEGA_PROJECTS.find(p => p.id === projectId);
  if (!def) return { ok: false, reason: 'unknown_project' };
  if (activeProjects.some(p => p.projectId === projectId)) {
    return { ok: false, reason: 'already_in_progress' };
  }
  if (def.prerequisiteBuilding && !buildings.some(b => b.defId === def.prerequisiteBuilding)) {
    return { ok: false, reason: 'missing_prerequisite' };
  }
  return { ok: true };
}

export function canAffordPhase(
  def: MegaProjectDef,
  phase: number,
  resources: Readonly<Partial<Record<ResourceId, number>>>,
): boolean {
  const phaseDef = def.phases[phase];
  if (!phaseDef) return false;
  for (const [res, amount] of Object.entries(phaseDef.cost)) {
    if ((resources[res as ResourceId] ?? 0) < (amount ?? 0)) return false;
  }
  return true;
}

export function startProject(projectId: string): MegaProjectProgress | null {
  const def = MEGA_PROJECTS.find(p => p.id === projectId);
  if (!def || def.phases.length === 0) return null;
  return {
    projectId,
    currentPhase: 0,
    daysRemaining: def.phases[0]!.durationDays,
    completed: false,
  };
}

export function tickProject(progress: MegaProjectProgress): MegaProjectProgress {
  if (progress.completed) return progress;
  const newDays = progress.daysRemaining - 1;
  if (newDays > 0) {
    return { ...progress, daysRemaining: newDays };
  }
  // Phase completed
  const def = MEGA_PROJECTS.find(p => p.id === progress.projectId);
  if (!def) return { ...progress, completed: true };
  const nextPhase = progress.currentPhase + 1;
  if (nextPhase >= def.phases.length) {
    return { ...progress, daysRemaining: 0, completed: true };
  }
  return {
    ...progress,
    currentPhase: nextPhase,
    daysRemaining: def.phases[nextPhase]!.durationDays,
  };
}

export function getProjectReward(projectId: string): MegaProjectDef['reward'] | null {
  const def = MEGA_PROJECTS.find(p => p.id === projectId);
  return def?.reward ?? null;
}

export function totalProjectDays(projectId: string): number {
  const def = MEGA_PROJECTS.find(p => p.id === projectId);
  if (!def) return 0;
  return def.phases.reduce((sum, p) => sum + p.durationDays, 0);
}
