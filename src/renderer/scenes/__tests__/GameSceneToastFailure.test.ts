// c919-03（P2-3 首批·资源不足事件）：GameScene.toastFailure 资源不足→sfx_warn 接线钉桩。
// GameScene ctor 仅 super（轻量）；registry 用 sceneClassMock 的 Map——toast/audio 皆 spy 对象。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { GameScene } from '../GameScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore } = sceneClassMock;

function makeScene(): GameScene {
  return new GameScene();
}

describe('GameScene 建造失败反馈（P2-3 资源不足）', () => {
  beforeEach(() => {
    registryStore.clear();
  });

  it('insufficient_resources：toast.show(error)＋audio.playSfx(sfx_warn) 各≥1 次', () => {
    const scene = makeScene();
    const show = vi.fn();
    const playSfx = vi.fn();
    registryStore.set(REGISTRY_KEYS.toast, { show });
    registryStore.set(REGISTRY_KEYS.audioManager, { playSfx });

    (scene as unknown as { toastFailure: (r: string) => void }).toastFailure('insufficient_resources');

    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('资源不足，无法建造', 'error');
    expect(playSfx).toHaveBeenCalledWith('sfx_warn', 0.5);
  });

  it('insufficient_labor：劳力不足同享警告音', () => {
    const scene = makeScene();
    const show = vi.fn();
    const playSfx = vi.fn();
    registryStore.set(REGISTRY_KEYS.toast, { show });
    registryStore.set(REGISTRY_KEYS.audioManager, { playSfx });

    (scene as unknown as { toastFailure: (r: string) => void }).toastFailure('insufficient_labor');

    expect(show).toHaveBeenCalledWith('劳力不足——需要对应阶层的闲置民力', 'error');
    expect(playSfx).toHaveBeenCalledWith('sfx_warn', 0.5);
  });

  it('其余失败（overlap 等）：toast 照常、不响警告音（防噪声化守卫）', () => {
    const scene = makeScene();
    const show = vi.fn();
    const playSfx = vi.fn();
    registryStore.set(REGISTRY_KEYS.toast, { show });
    registryStore.set(REGISTRY_KEYS.audioManager, { playSfx });

    (scene as unknown as { toastFailure: (r: string) => void }).toastFailure('overlap');

    expect(show).toHaveBeenCalledWith('此处已有建筑', 'error');
    expect(playSfx).not.toHaveBeenCalled();
  });
});
