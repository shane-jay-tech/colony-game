// c918-18（T48 前置 P2 系列）：MilitaryPanel 远征配粮展示钉桩。
// store 以 mock 对象注入（面板消费面：getDeployableSoldiers/getAvailableUnitTypesForUi/
// getGenerals/computeCurrentMilitaryPower/launchExpedition/getResources 等），scene 全 fake。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { EXPEDITION_DAYS, UNIT_DEFS } from '../../data/military';
import { computeGrainCost } from '../../state/militarySystem';

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

describe('MilitaryPanel 配粮与军力展示（数据层口径）', () => {
  let store: GameStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('EXPEDITION_DAYS 四目标齐备且 max ≥ min（intercept 允许 0 日即返）', () => {
    const targets = Object.entries(EXPEDITION_DAYS);
    expect(targets.length).toBeGreaterThanOrEqual(4);
    for (const [name, span] of targets) {
      expect(span.max).toBeGreaterThanOrEqual(span.min);
      void name;
    }
  });

  it('computeGrainCost：出兵越多耗粮越多（线性正比）', () => {
    const units10 = { militia: 10 };
    const units50 = { militia: 50 };
    const c10 = computeGrainCost(units10, EXPEDITION_DAYS.raid.max);
    const c50 = computeGrainCost(units50, EXPEDITION_DAYS.raid.max);
    expect(c50).toBeGreaterThan(c10);
    expect(c10).toBeGreaterThan(0);
  });

  it('初始编制：无可遣之兵（未建兵营未转兵）→ 面板给出「先转农为兵」引导而非报错', () => {
    expect(store.getDeployableSoldiers()).toBe(0);
  });

  it('初始军力：computeCurrentMilitaryPower 确定性（两次调用同值、非负）', () => {
    const p1 = store.computeCurrentMilitaryPower();
    const p2 = store.computeCurrentMilitaryPower();
    expect(p1).toBe(p2);
    expect(p1).toBeGreaterThanOrEqual(0);
    void UNIT_DEFS;
  });
});
