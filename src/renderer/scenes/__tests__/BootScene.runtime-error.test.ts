/**
 * c924-13：BootScene **运行时错误面**行为桩测试（c923-13 设计稿 §5 档 B ＋ §6 用例表落地）。
 *
 * 存在理由（本仓 BootScene 此前只有文本轨）：既有 3 件（`bootLoadErrorDedup`／`scatterSourceGuard`／
 * `bootLoadList`）全在 `readFileSync` 上钉源码字面，**没有一件真跑过 preload/create** ⇒
 * 设计稿 §2 A6 实测「`new BootScene().preload()` 会在 `BootScene.ts:34` 抛 TypeError」，
 * 因为共享 fake 的字段表里没有 `load`。本件补的就是那条**行为轨**：
 *   - 依赖 `fakeScene.ts` 新增的 load facet（image/audio 记值 ＋ handlers 触发面）；
 *   - 依赖 `vitest.config.ts` 补的 `@` 别名（本班实测否证：BootScene.ts:2 的 `'@/data'`
 *     在测试面根本不可解析，收集期即 `Failed to load url @/data`——设计稿未记此前提）。
 *
 * 与在册 4 例的映射（卷宗只写「4 例」未点名编号，此处如实交代收窄）：
 *   ① = 设计稿 U3（＋顺带钉 U1 的行为半：console.error 恰 1 条 ＋ 原样重抛）
 *   ② = 设计稿 B2 的**行为补半**（文本轨已由 bootLoadErrorDedup 钉，行为轨此前零覆盖）
 *   ③ = 设计稿 U4 ＋ U5 合臂（字体守卫的「reject ⇒ warn 继续」与「无 DOM ⇒ 整块跳过」两面）
 *   ④ = 设计稿 U6
 *   未落地：U2/U7/U8（档 A 文本轨，不属本档 B 批次）、U9（档 C canary）。
 *
 * ⚠ 判别力声明（勿当"覆盖了 Loader.start"）：BootScene.preload **自身从不叫** `load.start()`
 *   （start 由 Phaser `SceneManager.bootScene` 代发，见设计稿 §4-1），故本件**不**对
 *   `image/audio/start` 的 start 计数下断言——设计稿 U3 原句含 start，在该桩下恒真、零判别力。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});
// mock 路径必须与 BootScene.ts:2 的 import specifier **逐字相同**（设计稿 §5 档 B 口径）。
vi.mock('@/data', () => ({ validateStaticData: vi.fn() }));

import { BootScene } from '../BootScene';
import { validateStaticData } from '@/data';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore, sceneStart } = sceneClassMock;
const mockedValidate = vi.mocked(validateStaticData);

/** fakeScene.ts 新增 load facet 的读型视图（本件唯一依赖的共享面）。 */
interface LoadFacet {
  handlers: Record<string, (...args: unknown[]) => void>;
  onceHandlers: Record<string, (...args: unknown[]) => void>;
  imageCalls: Array<{ key: string; url: string | string[] }>;
  audioCalls: Array<{ key: string; url: string | string[] }>;
}

function makeBoot(): BootScene {
  return new BootScene();
}

function loadOf(scene: BootScene): LoadFacet {
  return (scene as unknown as { load: LoadFacet }).load;
}

/** 取 spy 首调实参（本仓 tsconfig 开了 noUncheckedIndexedAccess ⇒ 直接下标必红）。
 *  抛错而非 `!`：调用数已在前一条断言钉过，这里再兜一层可读消息，避免 undefined 被 String() 吞成 "undefined" 假绿。 */
function firstCall(spy: { mock: { calls: unknown[][] } }, what: string): unknown[] {
  const call = spy.mock.calls[0];
  if (!call) throw new Error(`${what}：spy 零调用，断言前置失败`);
  return call;
}

/** 从 handlers 表里取 loaderror 回调（同上，且把「触发面失效」显式成错而不是静默跳过）。 */
function takeHandler(handlers: Record<string, (...args: unknown[]) => void>, ev: string): (...args: unknown[]) => void {
  const cb = handlers[ev];
  if (typeof cb !== 'function') throw new Error(`load facet 的 handlers['${ev}'] 未登记 ⇒ 触发面失效`);
  return cb;
}

describe('BootScene 运行时错误面（c924-13 档 B）', () => {
  beforeEach(() => {
    registryStore.clear();
    sceneStart.mockClear();
    mockedValidate.mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('① 静态校验抢先抛 ⇒ Loader 一个加载项都不排、loaderror 一次未注册（含对照臂）', () => {
    // 对照臂：不抛 ⇒ preload 走到底，五个图片循环 ＋ 两个音频循环各自排队。
    const ok = makeBoot();
    ok.preload();
    const okLoad = loadOf(ok);
    const image = okLoad.imageCalls.length;
    const audio = okLoad.audioCalls.length;
    expect(image).toBeGreaterThan(0);
    expect(audio).toBeGreaterThan(0);
    expect(okLoad.handlers['loaderror']).toBeTypeOf('function');

    // 抛错臂：BootScene.ts:22-27 的 try 只包 validateStaticData，且 :26 原样重抛 ⇒
    // :34 之后的全部加载语句都不执行。断言用**独立新实例**，免得与对照臂共用记值数组。
    const boom = new Error('modifier target unknown');
    mockedValidate.mockImplementation(() => {
      throw boom;
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = makeBoot();
    expect(() => bad.preload()).toThrow(boom);
    const badLoad = loadOf(bad);
    expect(badLoad.imageCalls).toHaveLength(0);
    expect(badLoad.audioCalls).toHaveLength(0);
    expect(badLoad.handlers['loaderror']).toBeUndefined();
    // U1 的行为半：catch 的唯一作用是多打一条 error，随后原样重抛（禁吞成 warn）。
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(firstCall(errSpy, 'console.error')[0])).toContain('static data validation failed');
    errSpy.mockRestore();
  });

  it('② loaderror 触发面：缺图回调只打一条 debug（带 file.key），不 error、不抛', () => {
    const scene = makeBoot();
    scene.preload();
    const handlers = loadOf(scene).handlers;
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 行为轨：文本轨（bootLoadErrorDedup）钉的是"源码里注册恰 1 处"，
    // 这里钉"手动触发一次 ⇒ 恰好一条 debug、零 error、不抛"——缺图属预期状态，不得污染 console.error。
    takeHandler(handlers, 'loaderror')({ key: 'building_farm' });
    expect(debug).toHaveBeenCalledTimes(1);
    const dbg = firstCall(debug, 'console.debug');
    expect(String(dbg[0])).toContain('sprite missing (fallback to sigil)');
    expect(String(dbg[1])).toBe('building_farm');
    expect(err).not.toHaveBeenCalled();
    debug.mockRestore();
    err.mockRestore();
  });

  it('③ 字体守卫两面：fonts.ready 被拒 ⇒ warn 且不抛、继续启动；无 DOM ⇒ 整块跳过且零 warn', async () => {
    // 甲面（设计稿 U4，:88-92）：必须注入 document——vitest 是 environment:'node'，
    // :89 在默认环境下 100% 不可达（设计稿 A7 实测）。全仓首例 stubGlobal，故 finally 必 unstub。
    const warnA = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('document', { fonts: { ready: Promise.reject(new Error('font load aborted')) } });
    await expect(makeBoot().create()).resolves.toBeUndefined();
    expect(warnA).toHaveBeenCalledTimes(1);
    expect(String(firstCall(warnA, 'console.warn')[0])).toContain('fonts.ready rejected');
    expect(firstCall(warnA, 'console.warn')[1]).toBeInstanceOf(Error);
    expect(sceneStart).toHaveBeenCalledTimes(1);
    warnA.mockRestore();
    vi.unstubAllGlobals();

    // 乙面（设计稿 U5 / B6）：守卫写的是 typeof document !== 'undefined' ⇒ node 下整块跳过，
    // 不得把后续 `:97` 的启动分支一起吞掉。
    sceneStart.mockClear();
    expect(typeof document).toBe('undefined');
    const warnB = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await makeBoot().create();
    expect(warnB).not.toHaveBeenCalled();
    expect(sceneStart).toHaveBeenCalledTimes(1);
    warnB.mockRestore();
  });

  it('④ introDone 双分支：真 → GameScene；假/缺 → ModeSelectScene（:97-101）', async () => {
    sceneStart.mockClear();
    registryStore.set(REGISTRY_KEYS.introDone, true);
    await makeBoot().create();
    expect(sceneStart).toHaveBeenCalledTimes(1);
    expect(sceneStart).toHaveBeenCalledWith('GameScene');

    sceneStart.mockClear();
    registryStore.set(REGISTRY_KEYS.introDone, false);
    await makeBoot().create();
    expect(sceneStart).toHaveBeenCalledWith('ModeSelectScene');

    // 缺键臂：registryGet 返回 undefined ⇒ falsy ⇒ 与显式 false 同路（热重载前不重复展示楔子）。
    sceneStart.mockClear();
    registryStore.clear();
    await makeBoot().create();
    expect(sceneStart).toHaveBeenCalledWith('ModeSelectScene');
  });
});
