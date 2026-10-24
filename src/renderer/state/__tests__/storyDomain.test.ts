/**
 * c1025-01 域直测：npcDynamicsTickStep（story 批 1/3 外迁件）。
 * 与 npcDynamics.test.ts（纯函数件）同源对照——本文件测**编排/结算体**：
 * 幕推进时序（空 NPC 早退之前）、io 副作用次序、瞬态/标量 outcome 写回口径。
 * 用真实注册表 id（npc_qi/npc_jin/...），与 store 侧 getNpcDef 同源。
 */
import { describe, it, expect } from 'vitest';
import { npcDynamicsTickStep, type NpcDynamicsIo } from '../domains/storyDomain';
import type { NpcCountryState } from '../../data/schema';
import { actFor } from '../../data/actTimeline';

function st(id: string, over: Partial<NpcCountryState> = {}): NpcCountryState {
  return {
    id, stance: -30, militaryPower: 50, renown: 50, tradeRoute: false, tradeCooldown: 0,
    warStatus: 'peace', lastEnvoyDay: -1, lastWarDay: -1, allyIds: [], aggression: 50, lastActionDay: -1,
    ...over,
  };
}

interface SpyIo {
  io: NpcDynamicsIo;
  calls: string[];
  resources: [string, number, string][];
}

function makeIo(): SpyIo {
  const calls: string[] = [];
  const resources: [string, number, string][] = [];
  return {
    calls, resources,
    io: {
      addResource: (id, delta, reason) => { resources.push([id, delta, reason]); calls.push('addResource'); },
      adjustMorale: (delta, reason) => { calls.push(`adjustMorale(${delta},${reason})`); },
      adjustWrath: (delta, reason) => { calls.push(`adjustWrath(${delta},${reason})`); },
      emitActChanged: (p) => { calls.push(`ACT_CHANGED:${p.id}`); },
      emitNpcAction: (p) => { calls.push(`NPC_ACTION:${p.kind}:${p.actorName}`); },
      emitNpcDynamicsTick: () => { calls.push('NPC_DYNAMICS_TICK'); },
    },
  };
}

function baseInput(over: Partial<Parameters<typeof npcDynamicsTickStep>[0]> = {}) {
  return {
    npcCountries: [] as NpcCountryState[],
    currentDay: 1,
    grade: 0,
    playerMilitaryPower: 100,
    renown: 50,
    people: 100,
    rngSeed: 12345,
    worldWariness: 20,
    lastActId: actFor(0).id,
    ...over,
  };
}

describe('npcDynamicsTickStep（story 批 1/3 域直测）', () => {
  it('空 NPC：幕切换仍发 ACT_CHANGED（早退之前），且早退不发 NPC_DYNAMICS_TICK、警惕值不漂移', () => {
    const spy = makeIo();
    // actFor(day) 跨幕日（P2 三幕：找首个幕界）
    const day1Act = actFor(1);
    let crossDay = 1;
    for (let d = 2; d < 4000; d++) {
      if (actFor(d).id !== day1Act.id) { crossDay = d; break; }
    }
    const out = npcDynamicsTickStep(baseInput({ currentDay: crossDay, lastActId: day1Act.id }), spy.io);
    expect(spy.calls).toEqual([`ACT_CHANGED:${actFor(crossDay).id}`]);
    expect(out.lastActId).toBe(actFor(crossDay).id);
    expect(out.worldWariness).toBe(20); // 早退在漂移段前
    expect(spy.calls).not.toContain('NPC_DYNAMICS_TICK');
  });

  it('同幕：不重复发 ACT_CHANGED；警惕值 > 基线每日回落 1', () => {
    const spy = makeIo();
    const npcs = [st('npc_qi')];
    const out = npcDynamicsTickStep(baseInput({ npcCountries: npcs, worldWariness: 25 }), spy.io);
    expect(spy.calls).not.toContain('ACT_CHANGED');
    expect(out.worldWariness).toBe(24);
    expect(spy.calls).toContain('NPC_DYNAMICS_TICK'); // 漂移 changed=true
  });

  it('警惕值 < 基线每日回升 1', () => {
    const spy = makeIo();
    const npcs = [st('npc_qi')];
    const out = npcDynamicsTickStep(baseInput({ npcCountries: npcs, worldWariness: 18 }), spy.io);
    expect(out.worldWariness).toBe(19);
  });

  it('军力成长档（30 日倍数）：按 archetype 加档、封顶 NPC_MP_CAP=220', () => {
    const spy = makeIo();
    const npcs = [st('npc_jin', { militaryPower: 219 })]; // martial +4 → min(220, 223)=220
    npcDynamicsTickStep(baseInput({ npcCountries: npcs, currentDay: 30 }), spy.io);
    expect(npcs[0]!.militaryPower).toBe(220);
  });

  it('outcome 写回口径：playerMilitaryPower 保持入参（无行动结算时）且 rng 结果可复现', () => {
    const spyA = makeIo();
    const spyB = makeIo();
    const npcsA = [st('npc_qi'), st('npc_rong')];
    const npcsB = [st('npc_qi'), st('npc_rong')];
    const outA = npcDynamicsTickStep(baseInput({ npcCountries: npcsA, currentDay: 7 }), spyA.io);
    const outB = npcDynamicsTickStep(baseInput({ npcCountries: npcsB, currentDay: 7 }), spyB.io);
    expect(outA).toEqual(outB);
    expect(npcsA.map(n => [n.militaryPower, n.allyIds])).toEqual(npcsB.map(n => [n.militaryPower, n.allyIds]));
    expect(spyA.calls).toEqual(spyB.calls);
    expect(outA.playerMilitaryPower).toBe(outB.playerMilitaryPower);
    // 行动结算含 [0,500] clamp（rng 驱动的骚扰可产生 delta，值不定但必在界内）
    expect(outA.playerMilitaryPower).toBeGreaterThanOrEqual(0);
    expect(outA.playerMilitaryPower).toBeLessThanOrEqual(500);
  });
});
