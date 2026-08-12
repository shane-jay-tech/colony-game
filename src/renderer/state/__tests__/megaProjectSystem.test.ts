import { describe, it, expect } from 'vitest';
import {
  canStartProject, canAffordPhase, startProject, tickProject,
  getProjectReward, totalProjectDays,
} from '../megaProjectSystem';
import { MEGA_PROJECTS } from '../../data/megaProjects';

describe('B-4.2 mega project start validation', () => {
  it('rejects unknown project', () => {
    const result = canStartProject('nonexistent', [], []);
    expect(result).toEqual({ ok: false, reason: 'unknown_project' });
  });

  it('rejects already in progress', () => {
    const result = canStartProject('proj_nine_cauldrons', [{ defId: 'bld_grand_temple' }], [
      { projectId: 'proj_nine_cauldrons', currentPhase: 0, daysRemaining: 10, completed: false },
    ]);
    expect(result).toEqual({ ok: false, reason: 'already_in_progress' });
  });

  it('rejects missing prerequisite building', () => {
    const result = canStartProject('proj_nine_cauldrons', [], []);
    expect(result).toEqual({ ok: false, reason: 'missing_prerequisite' });
  });

  it('accepts valid start (with prerequisite)', () => {
    const result = canStartProject('proj_nine_cauldrons', [{ defId: 'bld_grand_temple' }], []);
    expect(result).toEqual({ ok: true });
  });

  it('accepts project without prerequisite building', () => {
    const result = canStartProject('proj_royal_road', [], []);
    expect(result).toEqual({ ok: true });
  });
});

describe('B-4.2 mega project phase affordability', () => {
  it('can afford phase 0 of nine cauldrons', () => {
    const def = MEGA_PROJECTS.find(p => p.id === 'proj_nine_cauldrons')!;
    expect(canAffordPhase(def, 0, { bronze: 100, rite: 50 })).toBe(true);
  });

  it('cannot afford without enough resources', () => {
    const def = MEGA_PROJECTS.find(p => p.id === 'proj_nine_cauldrons')!;
    expect(canAffordPhase(def, 0, { bronze: 10, rite: 5 })).toBe(false);
  });

  it('returns false for invalid phase index', () => {
    const def = MEGA_PROJECTS.find(p => p.id === 'proj_nine_cauldrons')!;
    expect(canAffordPhase(def, 99, { bronze: 999, rite: 999 })).toBe(false);
  });
});

describe('B-4.2 mega project progress', () => {
  it('startProject initializes phase 0', () => {
    const progress = startProject('proj_nine_cauldrons');
    expect(progress).not.toBeNull();
    expect(progress!.currentPhase).toBe(0);
    expect(progress!.daysRemaining).toBe(30);
    expect(progress!.completed).toBe(false);
  });

  it('tickProject decrements days', () => {
    const progress = startProject('proj_nine_cauldrons')!;
    const ticked = tickProject(progress);
    expect(ticked.daysRemaining).toBe(29);
    expect(ticked.currentPhase).toBe(0);
    expect(ticked.completed).toBe(false);
  });

  it('advances to next phase when days reach 0', () => {
    const progress = { projectId: 'proj_nine_cauldrons', currentPhase: 0, daysRemaining: 1, completed: false };
    const ticked = tickProject(progress);
    expect(ticked.currentPhase).toBe(1);
    expect(ticked.daysRemaining).toBe(30);
    expect(ticked.completed).toBe(false);
  });

  it('completes when last phase finishes', () => {
    const def = MEGA_PROJECTS.find(p => p.id === 'proj_nine_cauldrons')!;
    const lastPhase = def.phases.length - 1;
    const progress = { projectId: 'proj_nine_cauldrons', currentPhase: lastPhase, daysRemaining: 1, completed: false };
    const ticked = tickProject(progress);
    expect(ticked.completed).toBe(true);
  });

  it('no-op on already completed project', () => {
    const progress = { projectId: 'proj_nine_cauldrons', currentPhase: 2, daysRemaining: 0, completed: true };
    const ticked = tickProject(progress);
    expect(ticked).toEqual(progress);
  });
});

describe('B-4.2 mega project rewards', () => {
  it('nine cauldrons grants renown + permanent deter', () => {
    const reward = getProjectReward('proj_nine_cauldrons');
    expect(reward).not.toBeNull();
    expect(reward!.renown).toBe(50);
    expect(reward!.permanentDeter).toBe(true);
  });

  it('spring autumn grants research +30%', () => {
    const reward = getProjectReward('proj_spring_autumn');
    expect(reward!.researchMul).toBe(0.30);
  });

  it('royal road grants production +10% and trade +50%', () => {
    const reward = getProjectReward('proj_royal_road');
    expect(reward!.productionMul).toBe(0.10);
    expect(reward!.tradeMul).toBe(0.50);
  });

  it('unknown project returns null', () => {
    expect(getProjectReward('fake')).toBeNull();
  });
});

describe('B-4.2 total project days', () => {
  it('nine cauldrons = 90 days (3 × 30)', () => {
    expect(totalProjectDays('proj_nine_cauldrons')).toBe(90);
  });

  it('spring autumn = 150 days (5 × 30)', () => {
    expect(totalProjectDays('proj_spring_autumn')).toBe(150);
  });

  it('royal road = 120 days (4 × 30)', () => {
    expect(totalProjectDays('proj_royal_road')).toBe(120);
  });
});
