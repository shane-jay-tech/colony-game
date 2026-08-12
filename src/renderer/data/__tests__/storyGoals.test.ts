import { describe, it, expect } from 'vitest';
import {
  CHAPTER_GOALS, NARRATIVE_BULLETINS, HISTORIAN_COMMENTS,
  getHistorianComment, getBulletinsForChapter, getGoalsForChapter,
} from '../storyGoals';

describe('C-1.2 chapter recommended goals', () => {
  it('has 7 goals (one per chapter)', () => {
    expect(CHAPTER_GOALS).toHaveLength(7);
  });

  it('covers chapters 1-7', () => {
    const chapters = CHAPTER_GOALS.map(g => g.chapter);
    expect(chapters).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('all goals have unique IDs', () => {
    const ids = CHAPTER_GOALS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getGoalsForChapter returns correct goals', () => {
    const ch3 = getGoalsForChapter(3);
    expect(ch3).toHaveLength(1);
    expect(ch3[0]!.id).toBe('goal_ch3_censor');
  });

  it('goals have condition and reward', () => {
    for (const goal of CHAPTER_GOALS) {
      expect(goal.condition).toBeDefined();
      expect(goal.reward).toBeDefined();
      expect(goal.description.length).toBeGreaterThan(0);
    }
  });
});

describe('C-2 narrative bulletins', () => {
  it('total = 56 (7 chapters × 8)', () => {
    expect(NARRATIVE_BULLETINS).toHaveLength(56);
  });

  it('each chapter has exactly 8 bulletins', () => {
    for (let ch = 1; ch <= 7; ch++) {
      expect(getBulletinsForChapter(ch)).toHaveLength(8);
    }
  });

  it('all bulletins have unique IDs', () => {
    const ids = NARRATIVE_BULLETINS.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('bulletins are ordered by dayOffset within chapter', () => {
    for (let ch = 1; ch <= 7; ch++) {
      const buls = getBulletinsForChapter(ch);
      for (let i = 1; i < buls.length; i++) {
        expect(buls[i]!.dayOffset).toBeGreaterThan(buls[i - 1]!.dayOffset);
      }
    }
  });

  it('all bulletins have text and textPlain', () => {
    for (const b of NARRATIVE_BULLETINS) {
      expect(b.text.length).toBeGreaterThan(0);
      expect(b.textPlain.length).toBeGreaterThan(0);
    }
  });
});

describe('C-2 historian comments', () => {
  it('has 7 comments (one per chapter)', () => {
    expect(HISTORIAN_COMMENTS).toHaveLength(7);
  });

  it('getHistorianComment returns centralize text for low power axis', () => {
    const text = getHistorianComment(1, -50);
    expect(text).toContain('独揽');
  });

  it('getHistorianComment returns devolve text for high power axis', () => {
    const text = getHistorianComment(1, 50);
    expect(text).toContain('让贤');
  });

  it('getHistorianComment returns neutral for middle range', () => {
    const text = getHistorianComment(1, 0);
    expect(text).toContain('未见倾向');
  });

  it('getHistorianComment returns empty for unknown chapter', () => {
    expect(getHistorianComment(99, 0)).toBe('');
  });
});
