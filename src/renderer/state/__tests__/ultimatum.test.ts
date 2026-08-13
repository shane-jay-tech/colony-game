import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import type { WorldMap } from '../../data/mapSchema';
import {
  ULTIMATUM_WRATH_THRESHOLD, ULTIMATUM_DAYS, ULTIMATUM_RECOVER_WRATH,
  ULTIMATUM_EXPLOSION_WRATH_RESET,
  shouldStartUltimatum, shouldLiftUltimatum, shouldExplodeUltimatum, ultimatumDaysLeft,
} from '../ultimatum';
import { WRATH_PASSIVE_DECAY_PER_DAY } from '../publicSentiment';

/**
 * P2 通牒压力系统测试：纯函数边界 + GameStore 状态机（开启/解除/爆发）+ 存档 v8→v9。
 */

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap(), resources: { grain: 500, people: 40 } });
}

describe('ultimatum 纯函数', () => {
  it('shouldStartUltimatum：≥阈值且无进行中通牒才触发', () => {
    expect(shouldStartUltimatum(ULTIMATUM_WRATH_THRESHOLD - 1, null)).toBe(false);
    expect(shouldStartUltimatum(ULTIMATUM_WRATH_THRESHOLD, null)).toBe(true);
    expect(shouldStartUltimatum(ULTIMATUM_WRATH_THRESHOLD, 100)).toBe(false); // 已有通牒不重复
  });

  it('shouldLiftUltimatum：通牒中且怨愤 ≤ 回收线才解除', () => {
    expect(shouldLiftUltimatum(ULTIMATUM_RECOVER_WRATH, 100)).toBe(true);
    expect(shouldLiftUltimatum(ULTIMATUM_RECOVER_WRATH + 1, 100)).toBe(false);
    expect(shouldLiftUltimatum(30, null)).toBe(false); // 无通牒谈不上解除
  });

  it('shouldExplodeUltimatum：到期才爆发', () => {
    expect(shouldExplodeUltimatum(99, 100)).toBe(false);
    expect(shouldExplodeUltimatum(100, 100)).toBe(true);
    expect(shouldExplodeUltimatum(101, null)).toBe(false);
  });

  it('ultimatumDaysLeft：倒计时与兜底', () => {
    expect(ultimatumDaysLeft(95, 100)).toBe(5);
    expect(ultimatumDaysLeft(105, 100)).toBe(0); // 已过期不显示负数
    expect(ultimatumDaysLeft(50, null)).toBe(0);
  });
});

describe('GameStore 通牒状态机', () => {
  it('怨愤 ≥85 → 开启 10 日通牒（发事件 + getUltimatum 激活）', () => {
    const store = makeStore();
    const started: unknown[] = [];
    store.on(STATE_EVENTS.ULTIMATUM_STARTED, (p) => started.push(p));
    store.replaceState({ ...store.getState(), publicWrath: ULTIMATUM_WRATH_THRESHOLD });
    store.tickDay();
    expect(started).toHaveLength(1);
    const ult = store.getUltimatum();
    expect(ult.active).toBe(true);
    expect(ult.endDay).toBe(store.getCurrentDay() + ULTIMATUM_DAYS);
    expect(ult.daysLeft).toBe(ULTIMATUM_DAYS);
  });

  it('通牒中怨愤压回 55 → 解除（不爆发）', () => {
    const store = makeStore();
    const lifted: unknown[] = [];
    store.on(STATE_EVENTS.ULTIMATUM_LIFTED, (p) => lifted.push(p));
    store.replaceState({ ...store.getState(), publicWrath: ULTIMATUM_WRATH_THRESHOLD });
    store.tickDay(); // 开启
    store.replaceState({ ...store.getState(), publicWrath: ULTIMATUM_RECOVER_WRATH });
    store.tickDay(); // 解除
    expect(lifted).toHaveLength(1);
    expect(store.getUltimatum().active).toBe(false);
    expect(store.getState().wrathUltimatumEndDay).toBeNull();
  });

  it('到期仍高企 → 民变爆发：掉人口、挫士气、怨愤重置 60、通牒清除', () => {
    const store = makeStore();
    const exploded: unknown[] = [];
    store.on(STATE_EVENTS.ULTIMATUM_EXPLODED, (p) => exploded.push(p));
    store.replaceState({ ...store.getState(), publicWrath: ULTIMATUM_WRATH_THRESHOLD });
    store.tickDay(); // day1 开启（endDay = day1+10）
    const moraleBefore = store.getPlayerMorale();
    for (let i = 0; i < ULTIMATUM_DAYS - 1; i++) store.tickDay(); // 走到期限前一日（day 10）
    const peopleBeforeBoom = store.getResources().people ?? 0;
    store.tickDay(); // day 11 = 到期日：爆发（怨愤 85-9=76 仍 > 55，不解除）
    expect(exploded).toHaveLength(1);
    const p = exploded[0] as { lostPeople: number; moraleDrop: number; wrath: number };
    expect(p.lostPeople).toBeGreaterThan(0);
    // 爆发当 tick：单日人口增长 ~1.2 远小于流失 ~12 → 净减
    expect((store.getResources().people ?? 0)).toBeLessThan(peopleBeforeBoom);
    expect(store.getPlayerMorale()).toBeLessThan(moraleBefore);
    // 爆发重置 60 后，同日自然回落再扣 1（阶段顺序：通牒判定 → 自然回落）
    expect(store.getPublicWrath()).toBe(ULTIMATUM_EXPLOSION_WRATH_RESET - WRATH_PASSIVE_DECAY_PER_DAY);
    expect(store.getUltimatum().active).toBe(false);
  });
});
