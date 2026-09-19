// c920-08：TransitionScene characterization——启动数据消费、点击/末段推进、onDone 回调。
// 递归 Proxy mock phaser；逐段推进契约（next→showLine→finish→onDone）钉桩，零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { TransitionScene } from '../TransitionScene';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore } = sceneClassMock;

function makeScene(): TransitionScene {
  return new TransitionScene();
}

function wireScene(scene: TransitionScene & Record<string, any>) {
  (scene as unknown as { scale: unknown }).scale = { width: 1366, height: 800, on: vi.fn(), off: vi.fn() };
  (scene as unknown as { input: unknown }).input = {
    on: vi.fn((ev: string, fn: () => void) => { (scene as unknown as Record<string, any>).__click = fn; }),
    removeAllListeners: vi.fn(),
  };
  (scene as unknown as { tweens: unknown }).tweens = { add: vi.fn((cfg: any) => { cfg.onComplete?.(); }) };
  (scene as unknown as { scene: unknown }).scene = { stop: vi.fn() };
  (scene as unknown as { textures: unknown }).textures = { exists: () => false, get: () => ({ getSourceImage: () => ({ width: 16, height: 9 }) }) };
  return scene;
}

describe('TransitionScene characterization（c920-08）', () => {
  beforeEach(() => {
    registryStore.clear();
  });

  it('启动数据消费：lines 逐段推进、末段后 onDone 恰一次（advance 防抖）', () => {
    const scene = makeScene();
    const wired = wireScene(scene as never as Record<string, any>);
    const onDone = vi.fn();
    scene.create({ lines: ['第一段', '第二段'], onDone });
    // 点击推进到第二段
    (wired.__click as () => void)();
    // 再点（已在末段）→ finish → onDone
    (wired.__click as () => void)();
    expect(onDone).toHaveBeenCalledTimes(1);
    // advance 防抖：finish 后再点不再触发 onDone
    (wired.__click as () => void)();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('空 lines 兜底：默认 [「……」] 单段，一次点击即完成', () => {
    const scene = makeScene();
    const wired = wireScene(scene as never as Record<string, any>);
    const onDone = vi.fn();
    scene.create({ lines: [], onDone });
    (wired.__click as () => void)();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('finish 清理：resize off + removeAllListeners（SHUTDOWN 泄漏守卫）', () => {
    const scene = makeScene();
    const wired = wireScene(scene as never as Record<string, any>);
    const onDone = vi.fn();
    scene.create({ lines: ['一段'], onDone });
    (wired.__click as () => void)();
    expect((wired.scale as { off: ReturnType<typeof vi.fn> }).off).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(wired.input.removeAllListeners).toHaveBeenCalled();
  });
});
