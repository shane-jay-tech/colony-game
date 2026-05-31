import { describe, it, expect } from 'vitest';
import { NPC_POOL, selectNpcsForGame, getNpcDef, NPC_PER_GAME } from '../npcCountries';

describe('NPC 池', () => {
  it('池子 ≥7 且含 ≥1 蛮夷(tribal)', () => {
    expect(NPC_POOL.length).toBeGreaterThanOrEqual(7);
    expect(NPC_POOL.some(d => d.archetype === 'tribal')).toBe(true);
  });
  it('池内 id 唯一', () => {
    const ids = NPC_POOL.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('selectNpcsForGame', () => {
  it('同 seed → 同选取（确定性，存档一致前提）', () => {
    const a = selectNpcsForGame(42).map(s => s.id);
    const b = selectNpcsForGame(42).map(s => s.id);
    expect(a).toEqual(b);
  });
  it('恰好选 NPC_PER_GAME 个、无重复、都在池内', () => {
    const sel = selectNpcsForGame(7);
    expect(sel).toHaveLength(NPC_PER_GAME);
    const ids = sel.map(s => s.id);
    expect(new Set(ids).size).toBe(NPC_PER_GAME);
    for (const id of ids) expect(getNpcDef(id)).toBeDefined();
  });
  it('每局保证含 ≥1 蛮夷', () => {
    for (const seed of [1, 2, 3, 99, 12345, 777]) {
      const sel = selectNpcsForGame(seed);
      expect(sel.some(s => getNpcDef(s.id)?.archetype === 'tribal')).toBe(true);
    }
  });
  it('不同 seed 大概率给不同阵容', () => {
    const a = selectNpcsForGame(1).map(s => s.id).sort().join(',');
    const b = selectNpcsForGame(2).map(s => s.id).sort().join(',');
    const c = selectNpcsForGame(3).map(s => s.id).sort().join(',');
    // 三个种子至少有两个阵容不同
    expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(2);
  });
  it('选中 state 初始化动态字段', () => {
    const sel = selectNpcsForGame(5);
    for (const s of sel) {
      expect(Array.isArray(s.allyIds)).toBe(true);
      expect(s.allyIds).toHaveLength(0);
      expect(s.aggression).toBeGreaterThanOrEqual(0);
      expect(s.lastActionDay).toBe(-1);
    }
  });
});
