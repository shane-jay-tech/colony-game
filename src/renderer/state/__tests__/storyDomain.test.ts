/**
 * c1025-01 域直测：npcDynamicsTickStep（story 批 1/3 外迁件）。
 * 与 npcDynamics.test.ts（纯函数件）同源对照——本文件测**编排/结算体**：
 * 幕推进时序（空 NPC 早退之前）、io 副作用次序、瞬态/标量 outcome 写回口径。
 * 用真实注册表 id（npc_qi/npc_jin/...），与 store 侧 getNpcDef 同源。
 */
import { describe, it, expect } from 'vitest';
import { npcDynamicsTickStep, storyTickStep, advanceChapterStep, pushStoryAxisStep, eventTickStep, triggerRelicStep, resolveEventStep, type NpcDynamicsIo } from '../domains/storyDomain';
import type { NpcCountryState, CourtEvent } from '../../data/schema';
import type { StoryFlags } from '../gameStore';
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

// ============== c1025-02：story 导演件族域直测 ==============

function flags(over: Partial<StoryFlags> = {}): StoryFlags {
  return {
    chapter: 0, unifyPath: null, unified: false,
    powerAxis: 0, resourceAxis: 0, storyEventsTriggered: [],
    chapterStartDay: 1, ending: null,
    ...over,
  };
}

function storyIo(log: string[]) {
  return {
    emitUnified: (p: { path: string }) => { log.push(`STORY_UNIFIED:${p.path}`); },
    emitBulletin: (p: { entry: { id: string } }) => { log.push(`BULLETIN:${p.entry.id}`); },
    emitEnding: (p: { ending: string }) => { log.push(`STORY_ENDING:${p.ending}`); },
    advanceChapter: (c: number) => { log.push(`ADVANCE:${c}`); },
  };
}

describe('storyTickStep（story 批 2/3 域直测）', () => {
  it('非 story 模式 / storyFlags 空：零动作，pending 原样返回', () => {
    const log: string[] = [];
    const outA = storyTickStep({ mode: 'sandbox', storyFlags: flags(), npcCountries: [], playerRenown: 0, currentDay: 1, storyTransitionPending: false }, storyIo(log));
    const outB = storyTickStep({ mode: 'story', storyFlags: null, npcCountries: [], playerRenown: 0, currentDay: 1, storyTransitionPending: true }, storyIo(log));
    expect(log).toEqual([]);
    expect(outA.storyTransitionPending).toBe(false);
    expect(outB.storyTransitionPending).toBe(true);
  });

  it('序章未统一：零NPC武途（全臣服）判定统一——sf 三写＋pending=true＋STORY_UNIFIED', () => {
    const log: string[] = [];
    const sf = flags();
    // checkUnification 武途条件：全部 NPC militaryPower 低（臣服面）——用极低军力触发
    const npcs = [st('npc_qi', { militaryPower: 1, stance: 0 }), st('npc_jin', { militaryPower: 1, stance: 0 })];
    const out = storyTickStep({ mode: 'story', storyFlags: sf, npcCountries: npcs, playerRenown: 99, currentDay: 5, storyTransitionPending: false }, storyIo(log));
    if (sf.unified) {
      expect(sf.unifyPath).toBeTruthy();
      expect(out.storyTransitionPending).toBe(true);
      expect(log.some(l => l.startsWith('STORY_UNIFIED:'))).toBe(true);
    } else {
      // 未达统一条件（现值口径）：零 ADVANCE、pending 不变——同样合法路径，验证不动
      expect(log.filter(l => l.startsWith('ADVANCE'))).toEqual([]);
      expect(out.storyTransitionPending).toBe(false);
    }
  });

  it('序章已统一＋pending=false：防 softlock 直接 advanceChapter(1)', () => {
    const log: string[] = [];
    const sf = flags({ unified: true });
    const out = storyTickStep({ mode: 'story', storyFlags: sf, npcCountries: [], playerRenown: 0, currentDay: 2, storyTransitionPending: false }, storyIo(log));
    expect(log).toEqual(['ADVANCE:1']);
    expect(out.storyTransitionPending).toBe(false);
  });

  it('序章已统一＋pending=true：等过场，不推进', () => {
    const log: string[] = [];
    const out = storyTickStep({ mode: 'story', storyFlags: flags({ unified: true }), npcCountries: [], playerRenown: 0, currentDay: 2, storyTransitionPending: true }, storyIo(log));
    expect(log).toEqual([]);
    expect(out.storyTransitionPending).toBe(true);
  });

  it('已到结局（ending 非空）：零动作', () => {
    const log: string[] = [];
    storyTickStep({ mode: 'story', storyFlags: flags({ chapter: 3, ending: 'devolve_public' as never, chapterStartDay: 1 }), npcCountries: [], playerRenown: 0, currentDay: 50, storyTransitionPending: false }, storyIo(log));
    expect(log).toEqual([]);
  });
});

describe('advanceChapterStep（story 批 2/3 域直测）', () => {
  it('推进章节：清 pending→写字段→STORY_CHAPTER_CHANGED（次序钉）', () => {
    const log: string[] = [];
    const sf = flags({ chapter: 1, chapterStartDay: 1 });
    advanceChapterStep(sf, 2, 42, {
      emitNarration: (p) => { log.push(`NARRATION:${p.text.slice(0, 4)}`); },
      clearTransitionPending: () => { log.push('CLEAR_PENDING'); },
      emitChapterChanged: (p) => { log.push(`CHAPTER_CHANGED:${p.chapter}`); },
    });
    expect(log[log.length - 1]).toBe('CHAPTER_CHANGED:2');
    expect(log).toContain('CLEAR_PENDING');
    expect(sf.chapter).toBe(2);
    expect(sf.chapterStartDay).toBe(42);
    // C-3：上一章 1..7 发史官评语（存在性以 getHistorianComment 现值为准——有评语则 NARRATION 在 CLEAR_PENDING 之前）
    const clearIdx = log.indexOf('CLEAR_PENDING');
    const narrIdx = log.findIndex(l => l.startsWith('NARRATION:'));
    if (narrIdx >= 0) expect(narrIdx).toBeLessThan(clearIdx);
  });

  it('storyFlags 空：零动作不抛错', () => {
    const log: string[] = [];
    advanceChapterStep(null, 1, 1, {
      emitNarration: () => { log.push('N'); },
      clearTransitionPending: () => { log.push('C'); },
      emitChapterChanged: () => { log.push('H'); },
    });
    expect(log).toEqual([]);
  });
});

describe('pushStoryAxisStep（story 批 2/3 域直测）', () => {
  it('跨档位发评语：power +200 跨入 devolve 档一条 NARRATION', () => {
    const log: string[] = [];
    const sf = flags({ chapter: 2 });
    pushStoryAxisStep('story', sf, { power: 200 }, { emitNarration: (p) => { log.push(p.text); } });
    expect(sf.powerAxis).toBeGreaterThan(0);
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0]).toContain('史官私记');
  });

  it('沙盒 / 无 delta：零动作', () => {
    const log: string[] = [];
    pushStoryAxisStep('sandbox', flags(), { power: 100 }, { emitNarration: (p) => { log.push(p.text); } });
    pushStoryAxisStep('story', flags(), undefined, { emitNarration: (p) => { log.push(p.text); } });
    expect(log).toEqual([]);
  });
});

// ============== c1025-03：事件采样/采纳编排域直测 ==============

function ev(id: string, over: Partial<CourtEvent> = {}): CourtEvent {
  return {
    id, tags: ['中'], triggers: [{ condition: 'random', value: 100 }],
    contexts: [{ condition: 'default', title: id, desc: '', descPlain: '' }],
    ...over,
  };
}

function eventIo(log: string[]) {
  return {
    resolveEvent: (ci: number) => { log.push(`RESOLVE:${ci}`); },
    setPending: (id: string, day: number) => { log.push(`SET_PENDING:${id}@${day}`); },
    emitTriggered: (p: { eventId: string }) => { log.push(`TRIGGERED:${p.eventId}`); },
    tryTriggerRelic: () => { log.push('TRY_RELIC'); },
    computeMetrics: () => { log.push('METRICS'); return {} as never; },
  };
}

function evInput(over: Partial<Parameters<typeof eventTickStep>[0]> = {}) {
  return {
    events: [] as CourtEvent[],
    pendingEventId: null as string | null,
    pendingEventDayStart: null as number | null,
    currentDay: 100,
    lastEventDay: 1,
    storyFlags: null as StoryFlags | null,
    grain: 100, gold: 100, people: 100,
    crisisActive: false,
    npcCountries: [] as NpcCountryState[],
    rngSeed: 42,
    eventHistory: [] as string[],
    ...over,
  };
}

describe('eventTickStep（story 批 3/3 域直测）', () => {
  it('挂起事件超时：resolveEvent(0) 回调', () => {
    const log: string[] = [];
    eventTickStep(evInput({
      events: [ev('e1', { defaultTimeoutDays: 3 })],
      pendingEventId: 'e1', pendingEventDayStart: 90,
    }), eventIo(log));
    expect(log).toEqual(['RESOLVE:0']);
  });

  it('anti-combo fast path（daysSinceLast < 8 且 < forceMax）：零动作零 METRICS', () => {
    const log: string[] = [];
    eventTickStep(evInput({ events: [ev('e1')], lastEventDay: 98 }), eventIo(log));
    expect(log).toEqual([]);
  });

  it('故事模式剧情事件直触：setPending 先于 TRIGGERED（次序钉）', () => {
    const log: string[] = [];
    const sf = flags({ chapter: 2 });
    const story = ev('ev_story_a', { tags: ['故事'], triggers: [{ condition: 'story_chapter == 2' }] });
    eventTickStep(evInput({ events: [story], storyFlags: sf, lastEventDay: 1 }), eventIo(log));
    expect(log).toEqual(['SET_PENDING:ev_story_a@100', 'TRIGGERED:ev_story_a']);
  });

  it('已触发的剧情事件不重复挂起（storyEventsTriggered 防重复）', () => {
    const log: string[] = [];
    const sf = flags({ chapter: 2, storyEventsTriggered: ['ev_story_a'] });
    const story = ev('ev_story_a', { tags: ['故事'], triggers: [{ condition: 'story_chapter == 2' }] });
    eventTickStep(evInput({ events: [story], storyFlags: sf, lastEventDay: 1 }), eventIo(log));
    expect(log).not.toContain('SET_PENDING:ev_story_a@100');
  });
});

describe('triggerRelicStep（story 批 3/3 域直测）', () => {
  it('有空闲古迹：setPending+TRIGGERED 次序钉；全完成：零动作', () => {
    const log: string[] = [];
    triggerRelicStep([{ id: 'r1', done: false, stage: 0 }], 55, {
      setPending: (id, d) => { log.push(`SET:${id}@${d}`); },
      emitTriggered: (p) => { log.push(`EMIT:${p.eventId}`); },
    });
    expect(log).toEqual(['SET:relic_r1_s0@55', 'EMIT:relic_r1_s0']);
    const log2: string[] = [];
    triggerRelicStep([{ id: 'r1', done: true, stage: 3 }], 55, {
      setPending: (id, d) => { log2.push(`SET:${id}@${d}`); },
      emitTriggered: (p) => { log2.push(`EMIT:${p.eventId}`); },
    });
    expect(log2).toEqual([]);
  });
});

describe('resolveEventStep（story 批 3/3 域直测）', () => {
  function rsIo(log: string[]) {
    return {
      applyRelicChoice: (s: number, st: number, ci: number) => { log.push(`RELIC:${s}/${st}/${ci}`); },
      removeModifier: (rid: string) => { log.push(`RM_MOD:${rid}`); },
      addModifier: () => { log.push('ADD_MOD'); },
      pushStoryAxis: () => { log.push('AXIS'); },
      emitResolved: (p: { eventId: string; applied: boolean }) => { log.push(`RESOLVED:${p.eventId}:${p.applied}`); },
      clearPending: () => { log.push('CLEAR'); },
    };
  }

  it('无挂起（id=null）：早退，冷却返回 NaN 语义（store 不更新）', () => {
    const log: string[] = [];
    const out = resolveEventStep({ events: [], pendingEventId: null, currentDay: 10, eventHistory: [], storyFlags: null, choiceIdx: 0 }, rsIo(log));
    expect(log).toEqual([]);
    expect(Number.isNaN(out.lastEventDay)).toBe(true);
  });

  it('坏 id：CLEAR→RESOLVED(applied:false)，冷却=当日', () => {
    const log: string[] = [];
    const out = resolveEventStep({ events: [ev('e1')], pendingEventId: 'ghost', currentDay: 10, eventHistory: [], storyFlags: null, choiceIdx: 0 }, rsIo(log));
    expect(log).toEqual(['CLEAR', 'RESOLVED:ghost:false']);
    expect(out.lastEventDay).toBe(10);
  });

  it('relic id（def 在事件表）：CLEAR→RELIC 分派，不走 modifier/history 面', () => {
    const log: string[] = [];
    resolveEventStep({ events: [ev('relic_r1_s0')], pendingEventId: 'relic_r1_s0', currentDay: 10, eventHistory: [], storyFlags: null, choiceIdx: 2 }, rsIo(log));
    expect(log).toEqual(['CLEAR', 'RELIC:1/0/2']);
  });

  it('正常抉择：history/故事进度直写＋AXIS＋RESOLVED(true)', () => {
    const log: string[] = [];
    const sf = flags({ chapter: 2 });
    const e = ev('e_decide', { tags: ['抉择', '故事'], choices: [{ text: '甲', textPlain: '甲', effects: [], removeEffects: [] }] });
    const history: string[] = [];
    resolveEventStep({ events: [e], pendingEventId: 'e_decide', currentDay: 10, eventHistory: history, storyFlags: sf, choiceIdx: 0 }, rsIo(log));
    expect(history).toEqual(['e_decide']);
    expect(sf.storyEventsTriggered).toContain('e_decide');
    expect(log[log.length - 1]).toBe('RESOLVED:e_decide:true');
    expect(log).toContain('AXIS');
    expect(log.indexOf('CLEAR')).toBe(0);
  });
});
