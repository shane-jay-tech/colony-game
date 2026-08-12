import { describe, it, expect } from 'vitest';
import { STORY_NPC_DEFS, makeStoryNpcStates, STORY_NPC_ARC_BEATS } from '../storyNpcs';

describe('C-4 story NPCs', () => {
  it('has exactly 4 story NPCs', () => {
    expect(STORY_NPC_DEFS).toHaveLength(4);
  });

  it('all have unique IDs', () => {
    const ids = STORY_NPC_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('includes at least 1 martial and 1 commercial', () => {
    expect(STORY_NPC_DEFS.some(d => d.archetype === 'martial')).toBe(true);
    expect(STORY_NPC_DEFS.some(d => d.archetype === 'commercial')).toBe(true);
  });

  it('invader has much higher military than others', () => {
    const invader = STORY_NPC_DEFS.find(d => d.id === 'npc_story_invader')!;
    const others = STORY_NPC_DEFS.filter(d => d.id !== 'npc_story_invader');
    const maxOther = Math.max(...others.map(d => d.initialMilitaryPower));
    expect(invader.initialMilitaryPower).toBeGreaterThan(maxOther * 1.5);
  });

  it('makeStoryNpcStates returns valid state objects', () => {
    const states = makeStoryNpcStates();
    expect(states).toHaveLength(4);
    for (const s of states) {
      expect(s.stance).toBeDefined();
      expect(s.militaryPower).toBeGreaterThan(0);
      expect(s.warStatus).toBe('peace');
      expect(s.allyIds).toEqual([]);
    }
  });

  it('arc beats cover chapters 2-7', () => {
    const chapters = [...new Set(STORY_NPC_ARC_BEATS.map(b => b.chapter))].sort();
    expect(chapters).toContain(2);
    expect(chapters).toContain(7);
  });

  it('arc beat npcIds reference valid story NPC IDs', () => {
    const validIds = STORY_NPC_DEFS.map(d => d.id);
    for (const beat of STORY_NPC_ARC_BEATS) {
      expect(validIds).toContain(beat.npcId);
    }
  });
});
