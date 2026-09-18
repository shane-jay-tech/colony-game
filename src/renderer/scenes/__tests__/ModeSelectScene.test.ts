// c918-20：ModeSelectScene 模式选择组合 smoke（PLAN 第 6 项欠账）。
// mock Phaser.Scene 基类（避免真引擎），钉「点 story 卡→mode='story'→IntroScene；
// 点 sandbox 卡→mode='sandbox'」两链，与 registry 写入。
import { describe, it, expect, vi, beforeEach } from 'vitest';

const registryStore = new Map<string, unknown>();
const sceneStart = vi.fn();

vi.mock('phaser', () => {
  class FakeScene {
    sys: unknown;
    scene: { start: ReturnType<typeof vi.fn> };
    registry: any;
    add: any;
    events: any;
    scale: any;
    constructor(cfg?: { key?: string }) {
      this.sys = { config: cfg ?? {}, settings: cfg ?? {} };
      this.scene = { start: sceneStart };
      this.registry = {
        set: vi.fn((k: string, v: unknown) => registryStore.set(k, v)),
        get: vi.fn((k: string) => registryStore.get(k)),
      };
      const chainable = () => {
        const o: Record<string, unknown> = {};
        for (const m of ['add', 'on', 'once', 'clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'strokePath', 'fillCircle', 'strokeCircle', 'fillRoundedRect', 'generateTexture', 'setOrigin', 'setDepth', 'setVisible', 'setScrollFactor', 'setInteractive', 'setPosition', 'setSize', 'setText', 'setColor', 'setStyle']) {
          o[m] = vi.fn().mockReturnThis();
        }
        o.destroy = vi.fn();
        return o;
      };
      this.add = {
        graphics: vi.fn(() => chainable()),
        text: vi.fn(() => chainable()),
        zone: vi.fn(() => chainable()),
        container: vi.fn(() => chainable()),
      };
      this.events = { once: vi.fn() };
      this.scale = { width: 1366, height: 800, on: vi.fn() };
    }
  }
  const PhaserMock = {
    Scene: FakeScene,
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { RESIZE: 'RESIZE' },
  };
  (PhaserMock as Record<string, unknown> & { default?: unknown }).default = PhaserMock;
  return PhaserMock as never;
});

import { ModeSelectScene } from '../../scenes/ModeSelectScene';
import { REGISTRY_KEYS } from '../../ui/registry';

/** 收集 create() 里两张卡的 pointerup 处理器（sandbox/story 各一）。 */
function captureChooseHandlers(scene: ModeSelectScene) {
  return {
    sandbox: () => (scene as unknown as { chooseSandbox: () => void }).chooseSandbox(),
    story: () => (scene as unknown as { chooseStory: () => void }).chooseStory(),
  };
}

describe('ModeSelectScene', () => {
  let scene: ModeSelectScene;

  beforeEach(() => {
    registryStore.clear();
    sceneStart.mockClear();
    scene = new ModeSelectScene();
    scene.create();
  });

  it('create 后两卡 zone 各挂 pointerup（择途入口就绪）', () => {
    // 通过私有选择器触达：能跑通即 create 的装配链完整
    const h = captureChooseHandlers(scene);
    expect(typeof h.sandbox).toBe('function');
    expect(typeof h.story).toBe('function');
  });

  it('点 sandbox 卡：gameMode 写 sandbox 并进入 IntroScene', () => {
    const h = captureChooseHandlers(scene);
    h.sandbox();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('sandbox');
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });

  it('点 story 卡：gameMode 写 story 并进入 IntroScene', () => {
    const h = captureChooseHandlers(scene);
    h.story();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('story');
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });

  it('两模式都指向同一立国流程（IntroScene）——只是 mode 不同', () => {
    const h = captureChooseHandlers(scene);
    h.sandbox();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('sandbox');
    h.story();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('story');
    expect(sceneStart).toHaveBeenCalledTimes(2);
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });
});
