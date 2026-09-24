// c924-26（c923-32 盘点档缺口 3）：ModeSelectScene 的 shutdown 清理面守护（与 IntroScene 缺口 2 并单）。
// 该面**曾经坏过**：`ModeSelectScene.ts:62-63` 注释自己写着「必须手动把 shutdown 绑到 SHUTDOWN 事件，
// 否则场景切走后 scale 'resize' 监听**永不移除**」——修好只留了注释、没留用例，`ModeSelectScene.test.ts`
// 里 `shutdown` 字面 0 命中（缺口 3 原话）。本件把这三件事钉成用例：
//   ① SHUTDOWN once 绑定在位（cb 就是本景 prototype.shutdown、ctx 就是场景实例）
//   ② `scale.on('resize', fn)` ↔ `scale.off('resize', **同一个 fn**)` 配对
//   ③ `clearTimeout` 清的是 `scheduleLayout` 拿到的**那个真实句柄**（不是无条件瞎清）
// 🔴 恒真防线：③ 同时钉「没排程时 SHUTDOWN 一次 clearTimeout 都不该调」——否则「clearTimeout 0 次」
//    与「clearTimeout 该清的那次没清」两种坏形态都测不出来。
// ⚠ 零生产码改动；夹具复用 `fakeScene.ts`（未改），`window` 用 `vi.stubGlobal` 在本件局部打桩
//    （node 环境本无 window，生产码只在 scheduleLayout/shutdown 两处碰它）。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { ModeSelectScene } from '../ModeSelectScene';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore, shutdownHandlers } = sceneClassMock;

interface ModeSelectSceneInternals {
  layoutTimer: number | null;
  scheduleLayout: () => void;
  scale: { on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> };
}
interface FakeWindow {
  setTimeout: () => number;
  clearTimeout: (id: number) => void;
}
/** 本件局部 window 替身：setTimeout 递增发号，clearTimeout 记账（返回值交回给用例直读 spy）。 */
function installFakeWindow(firstId = 4242) {
  let next = firstId;
  const setTimeoutSpy = vi.fn(() => next++);
  const clearTimeoutSpy = vi.fn();
  vi.stubGlobal('window', { setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy } satisfies FakeWindow);
  return { setTimeoutSpy, clearTimeoutSpy };
}

function makeScene(): ModeSelectScene {
  registryStore.clear();
  const scene = new ModeSelectScene();
  scene.create();
  return scene;
}

function callsFor(spy: ReturnType<typeof vi.fn>, ev: string): unknown[][] {
  return spy.mock.calls.filter((c: unknown[]) => c[0] === ev);
}

function fireShutdown(): void {
  for (const h of shutdownHandlers.splice(0)) h.cb.call(h.ctx);
}

describe('ModeSelectScene shutdown 清理面（c923-32 缺口 3）', () => {
  beforeEach(() => {
    registryStore.clear();
    shutdownHandlers.length = 0;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SHUTDOWN once 绑定：create 只登记 1 个 shutdown 处理器，且 cb 是本景 prototype.shutdown、ctx 是场景实例', () => {
    const scene = makeScene();
    expect(shutdownHandlers.length).toBe(1);
    const h = shutdownHandlers[0]!;
    expect(h.evt).toBe('shutdown');
    expect(h.cb).toBe((ModeSelectScene.prototype as unknown as { shutdown: unknown }).shutdown);
    expect(h.ctx).toBe(scene);
  });

  it('resize 反注册配对：create 交给 scale.on("resize") 的那个 fn，正是 shutdown 交给 scale.off 的那个（换闭包＝解不掉）', () => {
    const scene = makeScene();
    const inner = scene as unknown as ModeSelectSceneInternals;
    const ons = callsFor(inner.scale.on, 'resize');
    const offsBefore = callsFor(inner.scale.off, 'resize');
    expect(ons.length).toBe(1);
    expect(offsBefore.length).toBe(0);
    const registered = ons[0]![1];

    fireShutdown();
    const offs = callsFor(inner.scale.off, 'resize');
    expect(offs.length).toBe(1);
    // :62-63 注释点名的失效形态就是「off 传了新闭包 ⇒ resize 监听永不移除」⇒ 必须比引用。
    expect(offs[0]![1], 'scale.off 传的不是 scale.on 那个 fn：resize 监听残留，切场景后对已销毁文字跑 layout').toBe(
      registered,
    );
  });

  it('clearTimeout 用真句柄：scheduleLayout 领到的 id 在 SHUTDOWN 时被精确清掉、layoutTimer 归 null；未排程则一次都不调', () => {
    const win = installFakeWindow();

    // 负向对照（先跑）：这台从未排程 ⇒ 「clearTimeout 0 次」才是有意义的读数。
    const idle = makeScene();
    expect((idle as unknown as ModeSelectSceneInternals).layoutTimer).toBeNull();
    fireShutdown();
    expect(win.clearTimeoutSpy).not.toHaveBeenCalled();

    // 正向：排程领到的**那个**句柄必须被 clearTimeout 精确回收。
    const scene = makeScene();
    const inner = scene as unknown as ModeSelectSceneInternals;
    inner.scheduleLayout();
    expect(win.setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(inner.layoutTimer).toBe(4242);

    fireShutdown();
    expect(win.clearTimeoutSpy.mock.calls).toEqual([[4242]]);
    expect(inner.layoutTimer).toBeNull();
  });
});
