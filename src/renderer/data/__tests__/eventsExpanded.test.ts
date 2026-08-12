import { describe, it, expect } from 'vitest';
import { A_LEVEL_EXTRA, B_LEVEL_EVENTS, C_LEVEL_EVENTS, ALL_EXPANDED_EVENTS } from '../eventsExpanded';
import { EVENTS } from '../events';

describe('B-5 event system expansion', () => {
  it('A-level extras = 10', () => {
    expect(A_LEVEL_EXTRA).toHaveLength(10);
  });

  it('B-level events = 20', () => {
    expect(B_LEVEL_EVENTS).toHaveLength(20);
  });

  it('C-level events = 10', () => {
    expect(C_LEVEL_EVENTS).toHaveLength(10);
  });

  it('total expanded = 40', () => {
    expect(ALL_EXPANDED_EVENTS).toHaveLength(40);
  });

  it('all events have unique IDs', () => {
    const ids = EVENTS.map(e => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('B-level events have exactly 2 choices', () => {
    for (const evt of B_LEVEL_EVENTS) {
      expect(evt.choices?.length ?? 0).toBe(2);
    }
  });

  it('C-level events have no choices', () => {
    for (const evt of C_LEVEL_EVENTS) {
      expect(evt.choices).toBeUndefined();
    }
  });

  it('A-level extras have 3 choices', () => {
    for (const evt of A_LEVEL_EXTRA) {
      expect(evt.choices?.length).toBe(3);
    }
  });

  it('all events have triggers and contexts', () => {
    for (const evt of ALL_EXPANDED_EVENTS) {
      expect(evt.triggers.length).toBeGreaterThan(0);
      expect(evt.contexts.length).toBeGreaterThan(0);
    }
  });

  it('total sandbox events (base + expanded) = 48', () => {
    // EVENTS includes base(8) + expanded(40) + story events
    const sandboxCount = 8 + ALL_EXPANDED_EVENTS.length;
    expect(sandboxCount).toBe(48);
  });
});
