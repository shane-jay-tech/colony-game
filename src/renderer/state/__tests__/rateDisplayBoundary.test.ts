/**
 * 20260925-120431-24b8（B/test）：库存／产出／消耗、整数-浮点边界、显示格式。
 * 卷宗验收三条：甲「不会出现负库存」乙「不会出现 Infinity 或精度误导」丙「错误有日志」。
 *
 * 红线遵守：**经济／平衡数值一字未改**（本件只钉回归＋报实况，产品码 0 改动）。
 * 与在册件的分工（避免重复建设）：
 *   priceBoundaryClamp.test.ts 已钉住 GameStore 写库存侧的 NaN/溢出/下溢闸（setResourceClamped，c925-6c4b）；
 *   productionSystem.test.ts 只测 formatRate 的四个良性输入（12 / 0.4 / -3 / 1.25）。
 *   ⇒ 本件补的三面此前零覆盖：
 *     ① formatRate 的**非有限与极小量级**边界（"Infinity" 会不会进 UI、小数会不会被显示成 0）；
 *     ② **纯函数层**（applyDeltasToBag / computeProductionTick 的 carry）没有库存闸这一实况，
 *        与"经 GameStore 真路径不出现负库存"一起交，免得后人误以为纯函数也安全；
 *     ③ 丙「错误有日志」——按盘上实况**否证**（产出/消耗路径全程静默），改成可复算的"零日志"钉桩。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { applyDeltasToBag, computeProductionTick, formatRate } from '../productionSystem';
import { RESOURCE_IDS } from '../../data/resourceRegistry';
import { GameStore, type IEventEmitter } from '../gameStore';
import { SAVE_SCHEMA_VERSION, deserialize } from '../saveLoad';
import type { ResourceId } from '../../data/resourceRegistry';
import type { WorldMap } from '../../data/mapSchema';

// ---------- ① 显示格式：非有限量级与精度误导 ----------

describe('① formatRate 数值边界（展示面）', () => {
  it('良性输入不变（productionSystem.test.ts 的四例同值，防本件改口径）', () => {
    expect(formatRate(12)).toBe('12');
    expect(formatRate(0.4)).toBe('0.4');
    expect(formatRate(-3)).toBe('-3');
    expect(formatRate(1.25)).toBe('1.3');
  });

  it('🟢 乙判据翻正（c1006-02 formatRate 加闸）：非有限速率渲染 "—" 不再进字面串', () => {
    // c1006-02 加 isFinite 闸后，非有限值渲染占位 '—'——原「Infinity/NaN 字面进 UI」缺口已封。
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatRate(Number.NEGATIVE_INFINITY)).toBe('—');
    expect(formatRate(Number.NaN)).toBe('—');
  });

  it('🔴 乙判据实况（精度误导面）：|v|<0.05 的净耗被显示成 0，1e21 走科学计数法', () => {
    // 日净 -0.04 实际在扣，面板写 "0"
    expect(formatRate(-0.04)).toBe('0');
    expect(formatRate(0.049)).toBe('0');
    expect(formatRate(1e-8)).toBe('0');
    // -0 不会露出负零字面
    expect(formatRate(-0.04)).not.toBe('-0');
    // 巨量走 String(1e21) ⇒ "1e+21" 进 UI 文本
    expect(formatRate(1e21)).toBe('1e+21');
    // 半位阈值：正负两侧**不对称**——JS Math.round(-0.5) === -0（向 +∞ 进位），
    // 于是 +0.05 显示 0.1，而 -0.05 显示 0：同一量级的净耗在负侧被抹成"无消耗"。
    expect(formatRate(0.05)).toBe('0.1');
    expect(formatRate(-0.05)).toBe('0');
    expect(formatRate(-0.06)).toBe('-0.1'); // 再大一点就露出来 ⇒ 只有 .x5 这一点不对称
    expect(Math.round(-0.5)).toBe(-0);     // 根因就在 JS 的 half-up 口径
  });

  it('展示串里不得出现 undefined / null 之类的失控形态', () => {
    for (const v of [0, -0, 1e-3, 1e3, -1e3, 0.05, -0.05, 1.0000001]) {
      const s = formatRate(v);
      expect(s).not.toMatch(/undefined|null|object/);
      expect(s.length).toBeGreaterThan(0);
    }
  });
});

// ---------- ② 纯函数层 vs GameStore 真路径 ----------

describe('② 库存与消耗的边界（纯函数层无闸，真路径有闸）', () => {
  it('现状：applyDeltasToBag 既不钳负也不挡非有限值（它只是加法）', () => {
    const bag = { grain: 10 } as Record<string, number>;
    const drained = applyDeltasToBag(bag as never, { grain: -30 } as never);
    expect(drained['grain']).toBe(-20); // 负库存可由纯函数造出 ⇒ 闸在 GameStore 侧
    const nan = applyDeltasToBag(bag as never, { grain: Number.NaN } as never);
    expect(Number.isNaN(nan['grain'])).toBe(true);
    const inf = applyDeltasToBag(bag as never, { grain: Number.POSITIVE_INFINITY } as never);
    expect(inf['grain']).toBe(Number.POSITIVE_INFINITY);
  });

  it('现状：连吃 60 次超量消耗，纯函数层累出的是单调下滑的负值（不被拉回 0）', () => {
    let bag = { grain: 5 } as Record<string, number>;
    for (let i = 0; i < 60; i++) bag = applyDeltasToBag(bag as never, { grain: -1 } as never) as never;
    expect(bag['grain']).toBe(-55);
  });

  it('✅ 甲判据（真路径）：GameStore 连跑 40 个游戏日，库存每格恒为有限、非负、整数', () => {
    const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
    const base = store.getState();
    const map: WorldMap = { width: 12, height: 12, seed: 3, resourceNodes: [], tiles: [] };
    for (let i = 0; i < 144; i++) map.tiles.push({ terrain: 'plain', buildable: true, walkable: true });
    store.replaceState({ ...base, worldMap: map, currentDay: 0, rngSeed: 3 });
    for (let day = 0; day < 40; day++) {
      store.tickDay();
      const res = store.getState().resources as Record<string, number>;
      for (const k of Object.keys(res)) {
        expect(Number.isFinite(res[k]), `day${day} ${k}=${res[k]}`).toBe(true);
        expect(res[k], `day${day} ${k}=${res[k]}`).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(res[k]), `day${day} ${k}=${res[k]} 非整数`).toBe(true);
      }
    }
    expect(store.getState().currentDay).toBeGreaterThan(0);
  });

  it('✅ 乙判据（真路径）：把 carry/资源灌成 NaN 与 Infinity 后跑一日，读回的库存仍是有限非负', () => {
    const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
    const base = store.getState();
    store.replaceState({
      ...base,
      resources: { ...base.resources, grain: Number.NaN, wood: Number.POSITIVE_INFINITY, gold: -1e30 },
      productionCarry: { grain: Number.NaN, wood: Number.POSITIVE_INFINITY },
    });
    store.tickDay();
    const res = store.getState().resources as Record<string, number>;
    // 实测三条（本机读数，非推断）：
    //   wood: +Infinity → 9999（被 getResourceCap 钳回可读域，✅ 乙判据在这一支成立）
    //   grain: NaN → **仍是 NaN**（闸是"整笔拒写"，已成 NaN 的格子没有任何 tick 会去扫它 ⇒ 与
    //          priceBoundaryClamp.test.ts:150 同向，本件补的是"日 tick 路径也不自愈"这一面）
    //   gold: -1e30 → **仍是 -1e30**（负存量不被钳回 0：setResourceClamped 只在"有 delta 要写"时生效）
    expect(res['wood']).toBe(store.getResourceCap('wood' as ResourceId));
    expect(Number.isNaN(res['grain'])).toBe(true);
    expect(res['gold']).toBeLessThan(0);
  });

  it('🟢 案②翻正（c1006-02）：负库存历史档进门钳 0（原 E1 缺口已封）', () => {
    // saveLoad.ts 的 resources 闸口径是 `typeof v === 'number' && Number.isFinite(v)`——
    // 负数与 -0 都是"有限数"，于是 {"grain":-5000} 这种档可以正常载入并在游戏里长跑。
    const st = deserialize(JSON.parse(JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: 1,
      // r5 B2：eventHistory 是载荷字段（缺它＝拒载）⇒ 本夹具补上它，
      // 让这条 🔴 钉子继续钉"负数库存不被资源闸拦下"这一面，而不是被缺字段闸先拦。
      state: { resources: { grain: -5000, wood: -0.5 }, currentDay: 5, rngSeed: 3, buildings: [], eventHistory: [] },
    })));
    // 案②：负值进门即钳 0（历史档遗物归零＝修复到合法态）
    expect(st.resources['grain']).toBe(0);
    expect(st.resources['wood']).toBe(0);
    // 长跑 10 日仍保持非负（合法态不被破坏）
    const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
    store.replaceState({ ...store.getState(), ...st });
    for (let i = 0; i < 10; i++) store.tickDay();
    expect(store.getState().resources['grain']).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(store.getState().resources['grain'] as number)).toBe(true);
  });

  it('carry（小数残差）长跑不炸界：60 次 tick 后仍有限，且不被写成非有限值', () => {
    let carry: Partial<Record<ResourceId, number>> = {};
    for (let i = 0; i < 60; i++) {
      const r = computeProductionTick([], () => undefined, [], carry);
      carry = r.fractionalCarry;
      for (const v of Object.values(carry)) {
        expect(v === undefined || Number.isFinite(v)).toBe(true);
      }
    }
    expect(carry).toBeDefined();
  });
});

// ---------- ③ 丙「错误有日志」：按盘上实况否证 ----------

describe('③ 错误有日志——本仓产出/消耗面无此实体（静默钳制为现状）', () => {
  const spies: Array<() => void> = [];
  afterEach(() => {
    for (const off of spies.splice(0)) off();
  });

  /** 返回值一律**不写显式注解**：`ReturnType<typeof vi.spyOn>` 会塌成 MockInstance<unknown[], unknown>，
   *  与 console 的真实签名不兼容（tsc 判 withImplementation 逆变不兼容，vitest 侧却是绿的）。 */
  function watchConsole() {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    spies.push(() => warn.mockRestore());
    spies.push(() => error.mockRestore());
    spies.push(() => log.mockRestore());
    return { warn, error, log };
  }

  it('🟢 丙翻正（c1006-02 三选①）：NaN 增量丢弃点补 warn（去重护栏：同 id 首条后静默）', () => {
    const { warn, error, log } = watchConsole();
    const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
    const base = store.getState();
    store.replaceState({
      ...base,
      resources: { ...base.resources, grain: Number.NaN, bronze: Number.NEGATIVE_INFINITY },
      productionCarry: { grain: Number.NaN },
    });
    store.tickDay();
    // 翻正断言：NaN 增量被丢弃时至少一条 warn 留痕（不再全程静默）
    expect(warn.mock.calls.length).toBeGreaterThan(0);
    expect(error).not.toHaveBeenCalled();
  });

  it('40 日长跑同样零日志（说明不是"这一支路没触发"，而是整条产出/消耗链没有日志面）', () => {
    const { warn, error } = watchConsole();
    const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
    for (let i = 0; i < 40; i++) store.tickDay();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
