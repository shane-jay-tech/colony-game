/**
 * 域五：回合/系统域外迁件直测（c1023-05 测试随迁批 5/5）。
 * 与既有 decree/国格/事件门用例互补：这里直接钉 domains/turnDomain 纯函数
 * （modifier 到期 / 换季 / 朝令推进 ops 序 / 国家指标 / 国格输入装配），
 * 并含「域模块 ↔ GameStore 私有计算」同源对照例（零行为漂移自证）。
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  expireModifiersStep, seasonTransitionStep, advanceDecrees,
  computeCountryMetrics, buildGradeInput, NPC_FRIENDLY_STANCE,
} from '../domains/turnDomain';
import type { DecreeTickOp } from '../domains/turnDomain';
import { applySeasonTransition } from '../seasonSystem';
import { GameStore } from '../gameStore';
import type { IEventEmitter } from '../gameStore';
import type { CountryMetrics } from '../dslEval';
import type { ModifierInstance, RoyalDecree } from '../../data/schema';
import type { ResourceId } from '../../data/resourceRegistry';

function makeEmitter(): IEventEmitter {
  return new EventEmitter() as unknown as IEventEmitter;
}

function mod(id: string, remainingDays: number): ModifierInstance {
  return {
    id, name: id, category: 'economy', stackable: true,
    effects: [{ target: 'country_grain_output', op: 'add', value: 1 }],
    visualBadge: null, remainingDays, description: '', descPlain: '',
  };
}

const DECREE: RoyalDecree = {
  id: 'dec_test', name: '测试令', category: '内政', description: '测', descPlain: '测',
  unlockCondition: [],
  stages: [
    { order: 1, cost: {}, days: 2, effects: [], removeEffects: [] },
    { order: 2, cost: { gold: 5 }, days: 1, effects: [], removeEffects: ['mod_old'] },
  ],
};

describe('turnDomain.expireModifiersStep（原 runModifierExpiryPhase 核）', () => {
  it('正数递减；归 0 到期；permanent(-1) 与既有 0 不被递减但 0 计到期', () => {
    const ms = [mod('a', 3), mod('b', 1), mod('perm', -1), mod('zero', 0)];
    const out = expireModifiersStep(ms);
    expect(out.expired.map(m => m.id)).toEqual(['b', 'zero']);
    expect(out.kept.map(m => m.id)).toEqual(['a', 'perm']);
    expect(out.kept[0]!.remainingDays).toBe(2); // 3 → 2
    expect(out.kept[1]!.remainingDays).toBe(-1); // permanent 不动
  });
});

describe('turnDomain.seasonTransitionStep（原 runSeasonTransitionPhase 核）', () => {
  it('与直接调 applySeasonTransition 同源；removedIds 只含季节 modifier', () => {
    const ms = [mod('season_modifier_summer', -1), mod('mod_plain', 5), mod('season_modifier_winter', -1)];
    const out = seasonTransitionStep(ms, 0);
    expect(out.next).toEqual(applySeasonTransition(ms, 0));
    expect(out.removedIds).toEqual(['season_modifier_summer', 'season_modifier_winter']);
  });
});

describe('turnDomain.advanceDecrees（原 runDecreeTick 核，ops 有序保真）', () => {
  it('未知 decree：原样保留（daysElapsed 不增）、零 ops', () => {
    const out = advanceDecrees([{ id: 'dec_ghost', currentStage: 0, daysElapsed: 9 }], [DECREE], {});
    expect(out.next).toEqual([{ id: 'dec_ghost', currentStage: 0, daysElapsed: 9 }]);
    expect(out.ops).toEqual([]);
    expect(out.accumulatedDeltas).toEqual({});
  });

  it('未到期：daysElapsed+1、零 ops', () => {
    const out = advanceDecrees([{ id: 'dec_test', currentStage: 0, daysElapsed: 0 }], [DECREE], { gold: 100 });
    expect(out.next).toEqual([{ id: 'dec_test', currentStage: 0, daysElapsed: 1 }]);
    expect(out.ops).toEqual([]);
  });

  it('首阶到期+下阶可付：addModifier → advanced op 序；cost 聚合 gold:-5', () => {
    const out = advanceDecrees([{ id: 'dec_test', currentStage: 0, daysElapsed: 1 }], [DECREE], { gold: 100 });
    expect(out.next).toEqual([{ id: 'dec_test', currentStage: 1, daysElapsed: 0 }]);
    expect(out.accumulatedDeltas).toEqual({ gold: -5 });
    expect(out.ops.map(o => (o as DecreeTickOp).kind)).toEqual(['addModifier', 'advanced']);
    const addOp = out.ops[0] as Extract<DecreeTickOp, { kind: 'addModifier' }>;
    expect(addOp.modifier.id).toBe('decree_modifier_dec_test_stage1');
  });

  it('首阶到期+下阶付不起：addModifier → stalled op；record 推到 stall sentinel（days+1）', () => {
    const out = advanceDecrees([{ id: 'dec_test', currentStage: 0, daysElapsed: 1 }], [DECREE], { gold: 0 });
    expect(out.next).toEqual([{ id: 'dec_test', currentStage: 0, daysElapsed: 3 }]);
    expect(out.ops.map(o => (o as DecreeTickOp).kind)).toEqual(['addModifier', 'stalled']);
    expect((out.ops[1] as Extract<DecreeTickOp, { kind: 'stalled' }>).stage).toBe(0);
  });

  it('末阶到期：remove+add modifier → completed op；decree 移出 next；cost 零聚合', () => {
    const out = advanceDecrees([{ id: 'dec_test', currentStage: 1, daysElapsed: 0 }], [DECREE], { gold: 100 });
    expect(out.next).toEqual([]);
    expect(out.ops.map(o => (o as DecreeTickOp).kind)).toEqual(['removeModifier', 'addModifier', 'completed']);
    expect((out.ops[0] as Extract<DecreeTickOp, { kind: 'removeModifier' }>).id).toBe('mod_old');
    expect((out.ops[2] as Extract<DecreeTickOp, { kind: 'completed' }>).fromStage).toBe(1);
    expect(out.accumulatedDeltas).toEqual({});
  });

  it('多条 decree：ops 严格按遍历序（DeepSeek #4 快照同源口径下的次序保真）', () => {
    const out = advanceDecrees(
      [
        { id: 'dec_test', currentStage: 1, daysElapsed: 0 },
        { id: 'dec_other', currentStage: 0, daysElapsed: 1 }, // 首到期日（daysElapsed>days 会走 stall-retry 静默分支）
        { id: 'dec_test', currentStage: 0, daysElapsed: 1 },
      ],
      [DECREE, {
        ...DECREE,
        id: 'dec_other',
        stages: [
          { ...DECREE.stages[0]!, cost: { grain: 0 } },
          { ...DECREE.stages[1]!, cost: { grain: 2 }, removeEffects: [] },
        ],
      }],
      { gold: 100, grain: 0 },
    );
    expect(out.ops.map(o => (o as DecreeTickOp).kind)).toEqual([
      'removeModifier', 'addModifier', 'completed',   // dec_test 末阶：stage2 removeEffects + 完成
      'addModifier', 'stalled',                        // dec_other 首阶到期、下阶 grain:2 付不起（stage1 无 removeEffects）
      'addModifier', 'advanced',                       // dec_test 首阶到期，gold 付得起下阶
    ]);
  });
});

describe('turnDomain.computeCountryMetrics / buildGradeInput ↔ GameStore 同源对照', () => {
  it('metrics：同输入下标量字段全等、rng 流前三位一致', () => {
    const store = new GameStore(makeEmitter(), {
      resources: { people: 42, grain: 300, gold: 10 },
      publicWrath: 17,
      rngSeed: 4321,
      currentDay: 66,
      grade: 2,
    });
    const facade = (store as unknown as { computeMetrics(): CountryMetrics }).computeMetrics();
    const dom = computeCountryMetrics({
      currentDay: 66,
      resources: { people: 42, grain: 300, gold: 10 },
      activeModifiers: [],
      publicWrath: 17,
      rngSeed: 4321,
      grade: 2,
      storyFlags: null,
    });
    expect(dom.population).toBe(facade.population);
    expect(dom.morale).toBe(facade.morale);
    expect(dom.wrath).toBe(facade.wrath);
    expect(dom.militaryPower).toBe(facade.militaryPower);
    expect(dom.year).toBe(facade.year);
    expect(dom.season).toBe(facade.season);
    expect(dom.dayOfYear).toBe(facade.dayOfYear);
    expect(dom.grade).toBe(facade.grade);
    expect(dom.storyChapter).toBe(facade.storyChapter);
    expect([dom.rng(), dom.rng(), dom.rng()]).toEqual([facade.rng(), facade.rng(), facade.rng()]);
  });

  it('grade input：与 facade getGradeProgress().input 全等（含全友邦 DIPLO 旗标）', () => {
    const store = new GameStore(makeEmitter(), {
      resources: { people: 30 },
      buildings: [],
      npcCountries: [],
    });
    const facade = store.getGradeProgress().input;
    const dom = buildGradeInput({
      people: 30,
      resources: { people: 30 },
      buildings: [],
      npcCountries: [],
      adoptedPolicyIds: store.getAdoptedPolicyIds(),
      completedDecreeIds: [],
    });
    expect(dom).toEqual(facade);
    expect(NPC_FRIENDLY_STANCE).toBe(20);
  });
});
