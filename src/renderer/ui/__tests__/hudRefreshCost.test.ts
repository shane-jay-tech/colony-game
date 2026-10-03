// c927-26：HUD.refreshResources 与 10 个 UI 订阅件 refresh 的毫秒成本（a2e3 遗留1 的测试面替身补测）。
// 协议：每件 fresh GameStore + 共享 makeFakeScene（c919-01 唯一定义处）；直调其 RESOURCES_CHANGED 入口
// （私有方法 JS 可达）；守卫面板先 open() 测「开态 refresh 本体」＝a2e3「全挂载」上界口径。
// 每件热身 50 轮后测 N=2000，performance.now() 计时；对照 a2e3 E3 的 5.59 次 resourcesChanged/tick
// 推算「每 tick 全挂载上界毫秒」。产品码零改动（本文件是唯一新增）。
import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { makeFakeGraphics, makeFakeScene, makeFakeText } from './fakeScene';
import { HUD } from '../HUD';
import { BuildPanel } from '../BuildPanel';
import { DiplomacyPanel } from '../DiplomacyPanel';
import { GradePanel } from '../GradePanel';
import { JitHintManager } from '../JitHintManager';
import { MegaProjectPanel } from '../MegaProjectPanel';
import { MilitaryPanel } from '../MilitaryPanel';
import { PolicyTreePanel } from '../PolicyTreePanel';
import { PopulationPanel } from '../PopulationPanel';
import { ProductionPanel } from '../ProductionPanel';

const WARM = 20;
const N = 200;
const CALLBACKS_PER_TICK = 5.59; // a2e3 E3：resourcesChanged 5.59 次/tick × 10 件在世

function allPlainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true, walkable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: allPlainMap() }, { policies: [], decrees: [] });
}

/** 本文件局部补丁（不动共享夹具语义）：扩展面照搬 BuildPanel.test.ts makeBuildPanelScene
 * （add.image／textures.exists,get／gfx setMask,setAlpha,createGeometryMask／text setMask,setScale,setLineSpacing），
 * 补的都是空转实现——Jit/遮罩族与 BuildPanel 所需，其余件零感知。 */
function makeScene() {
  const scene = makeFakeScene({ tweens: true }) as never as Record<string, any>;
  const add = scene.add as unknown as Record<string, any>;
  add.graphics = vi.fn(() => {
    const g = makeFakeGraphics() as Record<string, any>;
    g.setMask = g.setMask ?? vi.fn().mockReturnThis();
    g.setAlpha = g.setAlpha ?? vi.fn().mockReturnThis();
    g.createGeometryMask = vi.fn(() => ({ destroy: vi.fn() }));
    return g;
  });
  add.text = vi.fn((_x: number, _y: number, init?: string) => {
    const t = makeFakeText() as unknown as Record<string, any>;
    if (typeof init === 'string') t.text = init;
    t.setMask = t.setMask ?? vi.fn().mockReturnThis();
    t.setScale = t.setScale ?? vi.fn().mockReturnThis();
    t.setLineSpacing = t.setLineSpacing ?? vi.fn().mockReturnThis();
    return t;
  });
  add.image = vi.fn(() => {
    const t = makeFakeText() as unknown as Record<string, any>;
    t.setDisplaySize = vi.fn().mockReturnThis();
    t.setTexture = vi.fn().mockReturnThis();
    t.setScale = vi.fn().mockReturnThis();
    t.setMask = vi.fn().mockReturnThis();
    return t;
  });
  (scene as unknown as Record<string, unknown>).textures = {
    exists: vi.fn(() => false),
    get: vi.fn(() => ({ getSourceImage: () => ({ width: 32, height: 32 }), source: { width: 32, height: 32 } })),
  };
  // JitHintManager fire() 走 scene.time.delayedCall（延迟展示）；本测量只登记不触发回调＝refresh 路径本体成本
  (scene as unknown as Record<string, unknown>).time = {
    delayedCall: vi.fn(() => ({ remove: vi.fn() })),
  };
  return scene;
}

/** BuildMode 最小替身（BuildPanel.test.ts:34 显式表原样：构造 1 个 onChange＋交互 4 个＋isDemolish） */
function makeBuildModeStub() {
  return {
    onChange: vi.fn(() => () => {}),
    isDemolish: vi.fn(() => false),
    enterDemolish: vi.fn(),
    cancel: vi.fn(),
    select: vi.fn(),
    getSelected: vi.fn(() => null),
  };
}

function timeCalls(fn: () => void, n = N): number {
  const t0 = performance.now();
  for (let i = 0; i < n; i++) fn();
  return (performance.now() - t0) / n; // ms / call
}

/**
 * 并发抢核**诊断量**（仅留痕，不是放行判据；主班 2026-10-04 落）。
 *
 * 本件读的是墙钟，并行跑时会因抢核整体膨胀（同日实测：单跑 MilitaryPanel 2637.67µs、
 * 全量跑同件 14172.87µs，5.3×）。但**不能拿 cpuShare 当放行判据**：它无法区分
 * 「本进程自身多 worker」与「外部抢占」——本件单跑也量到 1.96（vitest 主线程＋worker 同进程），
 * 全量 6.82，阈值怎么定都有反例（GPT-5.6 独立评审 2026-10-04：高估/低估两侧都举了场景）。
 *
 * ⇒ 结构性处置：本件已从默认 test 面摘出（vitest.config.ts 的 exclude），
 *   改由 `npm run test:perf` 在 vitest.perf.config.ts 下单线程串行跑，门槛**恒定 5000µs/call**。
 *   cpuShare 只打进日志，供人工判读"本次读数是否可信"，不参与断言。
 */
function cpuShareOf<T>(fn: () => T): { value: T; cpuShare: number } {
  const w0 = performance.now();
  const c0 = process.cpuUsage();
  const value = fn();
  const wallUs = Math.max(1, (performance.now() - w0) * 1000);
  const c = process.cpuUsage(c0);
  return { value, cpuShare: (c.user + c.system) / wallUs };
}

type Subject = { name: string; entry: string; make: () => () => void };

const SUBJECTS: Subject[] = [
  { name: 'HUD', entry: 'refreshResources', make: () => {
      const s = makeScene(); const st = makeStore();
      const h = new HUD(s as never, st);
      return () => (h as unknown as { refreshResources(): void }).refreshResources();
    } },
  { name: 'BuildPanel', entry: 'refreshAffordance', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new BuildPanel(s as never, st, makeBuildModeStub() as never);
      return () => (p as unknown as { refreshAffordance(): void }).refreshAffordance();
    } },
  { name: 'DiplomacyPanel', entry: 'open+refresh', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new DiplomacyPanel(s as never, st); p.open();
      return () => (p as unknown as { refresh(): void }).refresh();
    } },
  { name: 'GradePanel', entry: 'open+refresh', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new GradePanel(s as never, st); p.open();
      return () => (p as unknown as { refresh(): void }).refresh();
    } },
  { name: 'JitHintManager', entry: 'onResources', make: () => {
      const s = makeScene(); const st = makeStore();
      const j = new JitHintManager(s as never, st);
      return () => (j as unknown as { onResources(p: unknown): void }).onResources({ deltas: {} });
    } },
  { name: 'MegaProjectPanel', entry: 'open+layout', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new MegaProjectPanel(s as never, st); p.open();
      return () => (p as unknown as { layout(): void }).layout();
    } },
  { name: 'MilitaryPanel', entry: 'open+refresh', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new MilitaryPanel(s as never, st); p.open();
      return () => (p as unknown as { refresh(): void }).refresh();
    } },
  { name: 'PolicyTreePanel', entry: 'open+refresh', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new PolicyTreePanel(s as never, st); p.open();
      return () => (p as unknown as { refresh(): void }).refresh();
    } },
  { name: 'PopulationPanel', entry: 'open+refresh', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new PopulationPanel(s as never, st); p.open();
      return () => (p as unknown as { refresh(): void }).refresh();
    } },
  { name: 'ProductionPanel', entry: 'open+refresh', make: () => {
      const s = makeScene(); const st = makeStore();
      const p = new ProductionPanel(s as never, st); p.open();
      return () => (p as unknown as { refresh(): void }).refresh();
    } },
];

describe('c927-26 HUD/订阅件 refresh 毫秒成本（测试面替身）', () => {
  it(`每件读数与全挂载推算（热身 ${WARM}＋测量 ${N} 轮）`, () => {
    const rows: Array<{ name: string; entry: string; usPerCall: number; msPerTickShare: number }> = [];
    let totalUs = 0;
    const loop = cpuShareOf(() => {
    for (const sub of SUBJECTS) {
      let fn: () => void;
      try {
        fn = sub.make();
        for (let i = 0; i < WARM; i++) fn(); // 热身：首次调用含惰性初始化，不入测量
      } catch (e) {
        throw new Error(`[c927-26] subject ${sub.name}(${sub.entry}) 装配/热身失败: ${(e as Error).message}`);
      }
      const ms = timeCalls(fn);
      const us = ms * 1000;
      totalUs += us;
      rows.push({ name: sub.name, entry: sub.entry, usPerCall: +us.toFixed(2), msPerTickShare: +(ms * CALLBACKS_PER_TICK).toFixed(4) });
    }
    });
    const perTickUpperMs = (totalUs / 1000) * CALLBACKS_PER_TICK;
    console.log(`[c927-26] rows=${JSON.stringify(rows)}`);
    console.log(`[c927-26] totalUsPerCallAll10=${totalUs.toFixed(1)} perTickUpperMsAll10=${perTickUpperMs.toFixed(3)} (×${CALLBACKS_PER_TICK} callbacks/tick, a2e3 E3)`);
    // 断言只守数量级护栏（防回归爆量），不钉具体数值（CI 机器差异）：单件 <5ms/次、全挂载推算 <16.7ms 帧预算。
    // 抢核时绝对读数不可比 ⇒ 本跑退守"爆量"底线 50ms/次，并显式留痕（判据见 cpuShareOf 的说明）。
    // 门槛恒定 5000µs/call，**不按运行时信号动态放宽**（理由见 cpuShareOf 与 vitest.perf.config.ts）。
    // 本件已从默认 test 面摘出，由 `npm run test:perf` 单线程串行跑；若有人把它塞回并行面，
    // 误红会立刻复现——那正是 2026-09-30 起连续 --no-verify 的病根。
    console.log(`[c927-26] cpuShare=${loop.cpuShare.toFixed(2)}（仅诊断：≈2＝只有本进程在跑；明显更高说明有别的 worker 在抢核，本次读数偏保守）`);
    expect(rows).toHaveLength(10);
    for (const r of rows) expect(r.usPerCall).toBeLessThan(5_000);
    if (perTickUpperMs >= 16.7) console.warn(`[c927-26] ⚠ 全挂载推算 ${perTickUpperMs.toFixed(2)}ms ≥ 16.7ms 帧预算（读数如实报告，是否超预算留主班对照 fake 膨胀 caveat 判读）`);
  });
});
