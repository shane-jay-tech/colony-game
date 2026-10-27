/**
 * inbox `20260925-120427-a239`（风险档 B · 工作类型 test）
 *
 * 卷宗原文：「检查暂停、后台切换、窗口失焦和恢复后时间推进。验收：暂停期间没有隐藏资源扣减；恢复后事件顺序可解释。」
 *
 * 盘上实况（先证其在世再定判据）：
 *   - 游戏代码**自己不听** `visibilitychange` / `blur`（`src/renderer` 非测试源 0 处），失焦/后台完全交给
 *     Phaser 的 TimeStep（`node_modules/phaser@3.90.0/src/core/TimeStep.js`）。⇒ 「后台切换」这一半
 *     在测试面上只能钉**接缝**：① `main.ts` 的 `fps` 配置没关掉 `smoothStep`；② `GameScene.update`
 *     吃的是平滑后的 `delta`（不是 `rawDelta`）。这两条一旦被人改，后台时间就会从「丢弃」变成「补账」，
 *     下方 ② 组用例先红。
 *   - 「暂停」在本仓有两个口：用户口 `state.paused`（HUD/空格）与模态口 `pauseHolders`（`requestPause`/`releasePause`），
 *     `isPaused()` 是两者的或。`TimeSystem.update` 的第一条守卫在 `accumulator += realDeltaMs` **之前**
 *     ⇒ 暂停期间既不漏扣、也**不攒账**（③ 组里「无隐藏入账」那根桩钉的就是这个行序）。
 *   - 补账上限 `MAX_TICKS_PER_UPDATE = 400`（private static，未导出 ⇒ 件内从源码现读，别硬写第二份）。
 *
 * ⚠ 零生产码改动、零平衡数值改动。④ 组钉的是**在册缺陷的现状**（日历上界后 pipeline 照跑），
 *    不是"认可"它 —— 见 result 遗留问题。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { GameStore, STATE_EVENTS } from '../gameStore';
import type { GameState, IEventEmitter } from '../gameStore';
import { TimeSystem, SPEED_MS_PER_DAY } from '../timeSystem';
import { MAX_SAVE_CURRENT_DAY } from '../saveLoad';
import { POLICIES, EVENTS, DECREES } from '../../data';
import type { BuildingInstance } from '../../data/schema';
import type { WorldMap } from '../../data/mapSchema';

const RENDERER_ROOT = resolve(__dirname, '../..'); // src/renderer
const D1 = SPEED_MS_PER_DAY[1];
const D3 = SPEED_MS_PER_DAY[3];

/** 现读 TimeSystem 的补账上限（private static 未导出）。 */
function readMaxTicks(): number {
  const src = readFileSync(joinLike('state', 'timeSystem.ts'), 'utf8');
  const m = src.match(/MAX_TICKS_PER_UPDATE = (\d+)/);
  if (!m) throw new Error('timeSystem.ts 的 MAX_TICKS_PER_UPDATE 形态变了，本桩需同步');
  return Number(m[1]);
}
function joinLike(...parts: string[]): string {
  return resolve(RENDERER_ROOT, ...parts);
}

/** 递归列非测试源（跳过 __tests__ / node_modules），供静态接缝门禁用。 */
function listProdSources(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__' || ent.name === 'node_modules') continue;
      out.push(...listProdSources(p));
    } else if (ent.name.endsWith('.ts')) {
      out.push(p);
    }
  }
  return out;
}

function allPlainMap(w = 16, h = 16): WorldMap {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: w, height: h, tiles, resourceNodes: [], seed: 0 };
}

function farm(x: number, y: number): BuildingInstance {
  return { defId: 'bld_farm', position: { x, y }, status: 'working', tier: 1, constructionProgress: 100, modifiers: [] };
}

/**
 * 有意义的经营态：3 栋正在产粮的农田 + 人口 + 库存，**并注入真实静态数据表**
 * （policies/events/decrees ⇒ `events` 阶段真的会去采样，"恢复后事件顺序可解释"才不是空面对比）。
 * ⇒ 「暂停期间资源一字未动」这条断言也不是空图零产出的平凡真。
 */
function makeLiveStore(seed = 20260925): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  const store = new GameStore(ee, { rngSeed: seed, worldMap: allPlainMap() }, {
    policies: POLICIES, events: EVENTS, decrees: DECREES,
  });
  const s = store.getState();
  store.replaceState({
    ...s,
    resources: { ...s.resources, people: 60, grain: 1200, wood: 800, stone: 400, gold: 300 },
    populationClasses: { ...s.populationClasses, farmer: 45, worker: 10, soldier: 3, scholar: 2 },
    buildings: [farm(0, 0), farm(3, 0), farm(6, 0)],
  });
  return store;
}

function flatResources(store: GameStore): string {
  return JSON.stringify(store.getState().resources);
}

const WATCHED = [
  STATE_EVENTS.RESOURCES_CHANGED,
  STATE_EVENTS.DAY_TICK,
  STATE_EVENTS.SEASON_TICK,
  STATE_EVENTS.YEAR_TICK,
  STATE_EVENTS.MODIFIER_ADDED,
  STATE_EVENTS.MODIFIER_REMOVED,
  STATE_EVENTS.PRODUCTION_TICK,
  STATE_EVENTS.EVENT_TRIGGERED,
  STATE_EVENTS.BUILDING_COMPLETED,
  STATE_EVENTS.PAUSED_CHANGED,
] as const;

/** 按 emit 顺序记 `${当时的游戏日}|${事件名}`：日号取 store 的绝对游戏日，不取循环下标。 */
function attachLog(store: GameStore): string[] {
  const log: string[] = [];
  for (const name of WATCHED) {
    store.on(name, () => { log.push(`${store.getCurrentDay()}|${name}`); });
  }
  return log;
}

// ─────────────────────────────────────────────────────────────
// ① 暂停：两类暂停口都必须在「记账之前」拦下
// ─────────────────────────────────────────────────────────────
describe('a239 ① 暂停期间零隐藏扣减（用户口 ＋ 模态口）', () => {
  it('paused=true：连灌 50 帧大 delta ⇒ 资源/日号/事件计数一字未动', () => {
    const store = makeLiveStore();
    store.setPaused(true);
    const beforeRes = flatResources(store);
    const beforeDay = store.getCurrentDay();
    const log = attachLog(store);
    const ts = new TimeSystem(store);
    for (let i = 0; i < 50; i++) ts.update(D1 * 10); // 等价 500 游戏日的墙钟
    expect(store.getCurrentDay()).toBe(beforeDay);
    expect(flatResources(store)).toBe(beforeRes);
    expect(log).toEqual([]); // 连 RESOURCES_CHANGED / DAY_TICK 都没发过一条
  });

  it('speed=0（第三种停表）同样零扣减，且不攒 accumulator', () => {
    const store = makeLiveStore();
    store.setPaused(false);
    store.setSpeed(0);
    const beforeRes = flatResources(store);
    const ts = new TimeSystem(store);
    for (let i = 0; i < 20; i++) ts.update(D1 * 30);
    expect(flatResources(store)).toBe(beforeRes);
    expect(store.getCurrentDay()).toBe(0);
    store.setSpeed(1);
    ts.update(D1 * 3);
    expect(store.getCurrentDay()).toBe(3); // 只补这 3 帧的量，前 20 帧没欠账
  });

  it('模态软暂停：两个 holder 未全释放前一直冻结；release 陌生 holder 不会替别人解锁', () => {
    const store = makeLiveStore();
    store.setPaused(false);
    store.requestPause('EventModal');
    store.requestPause('TutorialModal');
    const beforeRes = flatResources(store);
    const ts = new TimeSystem(store);
    ts.update(D1 * 5);
    expect(store.getCurrentDay()).toBe(0);
    store.releasePause('EventModal');
    ts.update(D1 * 5); // 还剩一个 holder ⇒ 依旧冻结
    expect(store.getCurrentDay()).toBe(0);
    store.releasePause('某没登记过的面板'); // 陌生 key：no-op，不能把 TutorialModal 的锁解开
    ts.update(D1 * 5);
    expect(store.getCurrentDay()).toBe(0);
    expect(flatResources(store)).toBe(beforeRes);
    store.releasePause('TutorialModal');
    ts.update(D1 * 2);
    expect(store.getCurrentDay()).toBe(2);
  });

  it('无隐藏入账：暂停期喂进 500 日的墙钟，解暂停后只按解暂停后的 delta 补天', () => {
    const store = makeLiveStore();
    store.setPaused(true);
    const ts = new TimeSystem(store);
    for (let i = 0; i < 50; i++) ts.update(D1 * 10);
    store.setPaused(false);
    ts.update(D1 * 3 + Math.floor(D1 * 0.5));
    expect(store.getCurrentDay()).toBe(3); // 若是"暂停期照常攒账"，这里会是 503
  });
});

// ─────────────────────────────────────────────────────────────
// ② 后台切换／失焦：本仓不自己听事件，靠 Phaser 的平滑夹子 ⇒ 钉接缝
// ─────────────────────────────────────────────────────────────
describe('a239 ② 失焦/后台：delta 语义的两处接缝（改了就会把后台时间变成补账）', () => {
  it('main.ts 的 fps 配置没有关 smoothStep、也没往 update 里传 rawDelta', () => {
    const main = readFileSync(joinLike('main.ts'), 'utf8');
    expect(main, 'fps 块若消失，GameScene.update 的 delta 来源就没人管了').toMatch(/fps:\s*\{/);
    expect(main, '关掉 smoothStep ⇒ 后台 20 分钟会变成一个巨无霸 delta 灌进 TimeSystem').not.toMatch(/smoothStep:\s*false/);
    const scene = readFileSync(joinLike('scenes', 'GameScene.ts'), 'utf8');
    expect(scene).toMatch(/this\.timeSystem\?\.update\(delta\)/); // 平滑后的 delta，不是 rawDelta
    expect(scene).not.toMatch(/rawDelta/);
  });

  it('phaser@3.90 TimeStep 仍在「失焦 / 上下文丢失」时用上一帧 sane delta 兜底（升级 Phaser 会先红这里）', () => {
    const ts = readFileSync(resolve(RENDERER_ROOT, '../../node_modules/phaser/src/core/TimeStep.js'), 'utf8');
    expect(ts).toMatch(/this\.smoothStep = GetValue\(config, 'smoothStep', true\)/);
    expect(ts).toMatch(/if \(this\._coolDown > 0 \|\| !this\.inFocus\)/); // 失焦即压到 target
    expect(ts).toMatch(/delta = Math\.min\(delta, this\._target\);/);
    expect(ts).toMatch(/if \(delta > this\._min\)/); // 病态大 delta → 用 deltaHistory 里的旧值
    expect(ts).toMatch(/browser tab context loss/i);
  });

  it('本仓非测试源没有任何自建的 visibilitychange/blur **监听注册**（时间推进只有一个入口）', () => {
    // 只判"注册动作"，不判词面：main.ts:144 的注释里出现 visibilitychange 是散文，不是监听。
    const PATTERNS = [
      /addEventListener\(\s*['"]visibilitychange/i,
      /addEventListener\(\s*['"]blur['"]/i,
      /Phaser\.Core\.Events\.VISIBILITY_CHANGE/,
      /document\.hidden/,
    ] as const;
    const hits = listProdSources(RENDERER_ROOT)
      .map((p) => ({ rel: relative(RENDERER_ROOT, p).replace(/\\/g, '/'), src: readFileSync(p, 'utf8') }))
      .filter((f) => PATTERNS.some((re) => re.test(f.src)))
      .map((f) => f.rel);
    expect(hits).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// ③ 恢复：补账上限、丢弃余量、catch-up ≡ 逐日跑
// ─────────────────────────────────────────────────────────────
describe('a239 ③ 恢复后时间推进可解释', () => {
  const MAX_TICKS = readMaxTicks();

  it(`病态 delta（1x 下 ${MAX_TICKS * 2} 日量）只补 ${MAX_TICKS} 天，且日号连续 +1 无跳号`, () => {
    const store = makeLiveStore();
    const days: number[] = [];
    store.on(STATE_EVENTS.DAY_TICK, (d) => { days.push(d as number); });
    const ts = new TimeSystem(store);
    ts.update(D1 * MAX_TICKS * 2);
    expect(store.getCurrentDay()).toBe(MAX_TICKS);
    expect(days.length).toBe(MAX_TICKS);
    for (let i = 0; i < days.length; i++) expect(days[i]).toBe(i + 1); // 绝对日：1,2,3,…
  });

  it('上限触发后**积压被丢弃**（不延后到后续帧偷偷补天）', () => {
    const store = makeLiveStore();
    const ts = new TimeSystem(store);
    ts.update(D1 * 100_000); // 远超上限：200 万 ms
    expect(store.getCurrentDay()).toBe(MAX_TICKS);
    ts.update(D1); // 若余量没清，这一帧会一口气再补一大批
    expect(store.getCurrentDay()).toBe(MAX_TICKS + 1);
    ts.update(D1);
    expect(store.getCurrentDay()).toBe(MAX_TICKS + 2);
  });

  it(`catch-up ≡ 逐日跑：一次灌 ${MAX_TICKS} 日 与 ${MAX_TICKS} 次各灌 1 日，事件序列与终局状态逐位相同`, () => {
    const a = makeLiveStore(4242);
    const b = makeLiveStore(4242);
    const logA = attachLog(a);
    const logB = attachLog(b);
    const tsA = new TimeSystem(a);
    const tsB = new TimeSystem(b);
    tsA.update(D1 * MAX_TICKS);
    for (let i = 0; i < MAX_TICKS; i++) tsB.update(D1);
    expect(a.getCurrentDay()).toBe(b.getCurrentDay());
    // 自证比较非空对空：400 日 catch-up 的日志量级与"域"数（实测 1,200+ 条／≥8 种事件名，
    // 含 state:eventTriggered ＋ modifier 增删 ⇒ events/modifierExpiry 阶段确实进了比对面）
    expect(logA.length).toBeGreaterThan(500);
    const distinct = new Set(logA.map((l) => l.split('|')[1]!));
    expect(distinct.size).toBeGreaterThanOrEqual(6);
    expect(logA.some((l) => l.endsWith(`|${STATE_EVENTS.EVENT_TRIGGERED}`))).toBe(true);
    expect(logA).toEqual(logB);
    expect(JSON.stringify(a.getState())).toBe(JSON.stringify(b.getState()));
  });

  it('2x/3x 速度下同一病态 delta 补的天数按 speed 缩放且同样封顶', () => {
    for (const speed of [2, 3] as const) {
      const store = makeLiveStore(777);
      store.setSpeed(speed);
      const ts = new TimeSystem(store);
      ts.update(D1 * MAX_TICKS * 4);
      expect(store.getCurrentDay(), `speed=${speed}`).toBe(MAX_TICKS);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// ④ 日历上界的在册现状钉桩（**待人工裁决，本班未修**）
// ─────────────────────────────────────────────────────────────
describe('a239 ④ currentDay 上界：时间停走且全管线短路（c1028-05 L9 收口）', () => {
  function atCeiling(store: GameStore): void {
    const s = store.getState() as GameState;
    store.replaceState({ ...s, currentDay: MAX_SAVE_CURRENT_DAY });
  }

  it(`钳位本身成立：currentDay 不越过 ${MAX_SAVE_CURRENT_DAY}`, () => {
    const store = makeLiveStore();
    atCeiling(store);
    const ts = new TimeSystem(store);
    ts.update(D1 * 10);
    expect(store.getCurrentDay()).toBe(MAX_SAVE_CURRENT_DAY);
  });

  it('c1028-05（L9 收口）：上界后全管线短路——同一天不再被重复结算（DAY_TICK 归零）', () => {
    const store = makeLiveStore();
    atCeiling(store);
    const seen: number[] = [];
    store.on(STATE_EVENTS.DAY_TICK, (d) => { seen.push(d as number); });
    const ts = new TimeSystem(store);
    ts.update(D1 * 5);
    expect(seen.length).toBe(0); // 管线短路：无 DAY_TICK ⇒ production/starvation/波次不再重放
    expect(store.getCurrentDay()).toBe(MAX_SAVE_CURRENT_DAY);
  });
});
