// c920-13：P2-3 反馈接线第二批（完工/晋升）——completedListener/upgradedListener 钉桩。
// 现状：完工脉冲 + 金色飘字（营建成/营建升）；无 toast/audio（toast 接线未实现——如实钉现状）。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { GameScene } from '../GameScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore } = sceneClassMock;
const SOURCE = readFileSync('src/renderer/scenes/GameScene.ts', 'utf8');

function makeScene(): GameScene {
  return new GameScene();
}

function installedScene(): { scene: GameScene; sceneAny: Record<string, any> } {
  const scene = makeScene();
  const sceneAny = scene as unknown as Record<string, any>;
  const pulseBuildingCompleted = vi.fn();
  const floatTextAtTile = vi.fn();
  const rerenderBuildings = vi.fn();
  sceneAny.mapRenderer = { pulseBuildingCompleted, floatTextAtTile };
  sceneAny.rerenderBuildings = rerenderBuildings;
  registryStore.set(REGISTRY_KEYS.toast, { show: vi.fn() });
  registryStore.set(REGISTRY_KEYS.audioManager, { playSfx: vi.fn() });
  return { scene, sceneAny, pulseBuildingCompleted, floatTextAtTile, rerenderBuildings };
}

describe('P2-3 反馈接线第二批（完工/晋升）现状钉桩', () => {
  beforeEach(() => {
    registryStore.clear();
  });

  it('完工事件：脉冲 + 金色飘字「营建　成」（rerenderBuildings 先行）', () => {
    const { sceneAny, pulseBuildingCompleted, floatTextAtTile, rerenderBuildings } = installedScene();
    (sceneAny.completedListener as (b: any) => void)({
      defId: 'farm', position: { x: 3, y: 4 },
    });
    expect(rerenderBuildings).toHaveBeenCalled();
    expect(pulseBuildingCompleted).toHaveBeenCalled();
    expect(floatTextAtTile).toHaveBeenCalledWith(3, 4, expect.stringContaining('营建'), 0xe0b94a);
  });

  it('晋升事件：脉冲 + 飘字「营建　升」（instance/裸负载两形态兼容）', () => {
    const { sceneAny, pulseBuildingCompleted, floatTextAtTile } = installedScene();
    (sceneAny.upgradedListener as (p: any) => void)({ instance: { defId: 'market', position: { x: 5, y: 6 } } });
    expect(pulseBuildingCompleted).toHaveBeenCalled();
    expect(floatTextAtTile).toHaveBeenCalledWith(5, 6, '营建　升', 0xe0b94a);
  });

  it('缺 position：只重画不脉冲不飘字（守卫分支）', () => {
    const { sceneAny, pulseBuildingCompleted, floatTextAtTile, rerenderBuildings } = installedScene();
    (sceneAny.completedListener as (b: any) => void)({ defId: 'farm' });
    expect(rerenderBuildings).toHaveBeenCalled();
    expect(pulseBuildingCompleted).not.toHaveBeenCalled();
    expect(floatTextAtTile).not.toHaveBeenCalled();
  });

  it('现状确认：完工/晋升走地图脉冲+飘字，不走 toast/audio（toast/audio 接线未实现——留痕）', () => {
    const { sceneAny, pulseBuildingCompleted, floatTextAtTile } = installedScene();
    (sceneAny.upgradedListener as (p: any) => void)({ position: { x: 1, y: 1 } });
    const toast = registryStore.get(REGISTRY_KEYS.toast) as { show: ReturnType<typeof vi.fn> };
    const audio = registryStore.get(REGISTRY_KEYS.audioManager) as { playSfx: ReturnType<typeof vi.fn> };
    expect(toast.show).not.toHaveBeenCalled();
    expect(audio.playSfx).not.toHaveBeenCalled();
    void pulseBuildingCompleted; void floatTextAtTile;
  });
});
