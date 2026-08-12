/**
 * C2 终局危机升级：纯节奏 + GameStore 波次效果 + 存档 v7→v8 迁移。
 */
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS, type IEventEmitter } from '../gameStore';
import { serialize, deserialize, SAVE_SCHEMA_VERSION } from '../saveLoad';
import type { WorldMap } from '../../data/mapSchema';
import {
  endgameSeverity, shouldFireEndgameWave, pickEndgameWave, ENDGAME_WAVE_INTERVAL_DAYS,
} from '../endgameEscalation';

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() });
}

describe('endgameEscalation 纯逻辑', () => {
  it('烈度随登顶持续天数三阶递增', () => {
    expect(endgameSeverity(0)).toBe(1);
    expect(endgameSeverity(239)).toBe(1);
    expect(endgameSeverity(240)).toBe(2);
    expect(endgameSeverity(720)).toBe(3);
  });

  it('节奏闸门：登顶后首个间隔满才放波，此后按固定间隔', () => {
    expect(shouldFireEndgameWave(19, null, 19)).toBe(false);
    expect(shouldFireEndgameWave(20, null, 20)).toBe(true);
    expect(shouldFireEndgameWave(39, 20, 39)).toBe(false);
    expect(shouldFireEndgameWave(40, 20, 40)).toBe(true);
  });

  it('pickEndgameWave 按索引取类、附半文白文案', () => {
    expect(pickEndgameWave(0, 2).kind).toBe('disaster');
    expect(pickEndgameWave(1, 2).kind).toBe('coalition');
    expect(pickEndgameWave(2, 2).kind).toBe('invasion');
    expect(pickEndgameWave(0, 2).text.length).toBeGreaterThan(0);
  });
});

describe('GameStore 终局波次', () => {
  it('登顶后每 20 日一波：结算惩罚 + 盛名 + ENDGAME_WAVE 事件', () => {
    const store = makeStore();
    const waves = vi.fn();
    store.on(STATE_EVENTS.ENDGAME_WAVE, waves);
    store.replaceState({
      ...store.getState(),
      grade: 5,
      gradeReached: 5,
      tianxiaAcknowledged: true,
      endgameAscendDay: 0,
      endgameLastWaveDay: null,
    });
    for (let i = 0; i < ENDGAME_WAVE_INTERVAL_DAYS; i++) store.tickDay();
    expect(store.getState().endgameLastWaveDay).toBe(ENDGAME_WAVE_INTERVAL_DAYS);
    expect(waves).toHaveBeenCalledOnce();
    expect(store.getState().activeModifiers.some(m => m.id.startsWith('mod_endgame_prestige_'))).toBe(true);
  });

  it('未登顶不放波', () => {
    const store = makeStore();
    const waves = vi.fn();
    store.on(STATE_EVENTS.ENDGAME_WAVE, waves);
    for (let i = 0; i < 60; i++) store.tickDay();
    expect(waves).not.toHaveBeenCalled();
  });
});

describe('存档 v7 → v8 迁移', () => {
  it('旧档补终局字段 null', () => {
    const store = makeStore();
    const blob = serialize(store.getState()) as { schemaVersion: number; savedAt: number; state: Record<string, unknown> };
    blob.schemaVersion = 7;
    delete blob.state['endgameAscendDay'];
    delete blob.state['endgameLastWaveDay'];
    const restored = deserialize(blob);
    expect(restored.endgameAscendDay).toBeNull();
    expect(restored.endgameLastWaveDay).toBeNull();
    expect(SAVE_SCHEMA_VERSION).toBe(8);
  });
});
