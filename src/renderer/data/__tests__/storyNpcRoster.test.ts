// c1023-06（PLAN#2 唯一缺口·story 固定 NPC roster 接线）：名单完整性＋与邦国池一致性钉。
// c1011-09 前置（产品点名 4-8 国）未到，任务书对齐口径＝roster 先按 8 国池全量对齐；
// story 章节内容单独立域，后续产品点名子集时只改 STORY_NPC_ROSTER 一处、本表 ②③ 随批改钉。
import { describe, it, expect } from 'vitest';
import {
  NPC_POOL, NPC_PER_GAME, STORY_NPC_ROSTER, makeRosterNpcStates, selectNpcsForGame,
} from '../npcCountries';

describe('STORY_NPC_ROSTER（PLAN#2 固定名单·c1023-06）', () => {
  it('名单完整性：非空、无重复、全员在池且有定义', () => {
    expect(STORY_NPC_ROSTER.length).toBeGreaterThan(0);
    expect(new Set(STORY_NPC_ROSTER).size).toBe(STORY_NPC_ROSTER.length);
    for (const id of STORY_NPC_ROSTER) {
      expect(NPC_POOL.some(d => d.id === id)).toBe(true);
    }
  });

  it('与邦国池一致性：roster ＝ 池全量（c1023-06 对齐口径），且不少于每局随机抽取数', () => {
    expect([...STORY_NPC_ROSTER].sort()).toEqual([...NPC_POOL.map(d => d.id)].sort());
    expect(STORY_NPC_ROSTER.length).toBeGreaterThanOrEqual(NPC_PER_GAME);
  });

  it('确定性：makeRosterNpcStates 两次调用逐字段等值，序＝池序，初始值与 def 对齐', () => {
    const a = makeRosterNpcStates();
    const b = makeRosterNpcStates();
    expect(a).toEqual(b);
    expect(a.map(s => s.id)).toEqual([...STORY_NPC_ROSTER]); // 固定名单非洗牌：序稳定
    for (const s of a) {
      const def = NPC_POOL.find(d => d.id === s.id)!;
      expect(s.stance).toBe(def.initialStance);
      expect(s.militaryPower).toBe(def.initialMilitaryPower);
      expect(s.renown).toBe(def.initialRenown);
      expect(s.warStatus).toBe('peace');
    }
  });

  it('未知 id 抛错（防名单与池漂移时静默缩员）', () => {
    expect(() => makeRosterNpcStates(['npc_qi', 'npc_not_in_pool'])).toThrow(/池外 id/);
  });

  it('sandbox 仍走种子随机 4 国（PLAN「retaining seeded random」不被本单波及）', () => {
    const four = selectNpcsForGame(42);
    expect(four).toHaveLength(4);
    expect(four).toEqual(selectNpcsForGame(42)); // 同 seed 同结果
  });
});
