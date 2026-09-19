// c920-09：SettingsPanel characterization——设置项读写经 settingsStore 持久键、面板开关。
// 递归 Proxy stub + mock settingsStore，零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});
import { SettingsPanel } from '../SettingsPanel';

type AnyRec = Record<string, any>;

vi.mock('../settingsStore', () => ({
  getAudioSettings: vi.fn(() => ({ bgm: 60, sfx: 80, muted: false })),
  setBgmVolume: vi.fn(),
  setSfxVolume: vi.fn(),
  toggleMuted: vi.fn(),
}));

import * as settingsStore from '../settingsStore';

function makeStub(): any {
  const proxy: any = new Proxy(function () {}, {
    get: (_t, p) => {
      if (p === Symbol.iterator) return function* () {};
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === 'length') return 0;
      return proxy;
    },
    apply: () => proxy,
  });
  return proxy;
}

function makePanel() {
  const visibilities: boolean[] = [];
  const scene: AnyRec = { scale: { width: 1366, height: 800 } };
  scene.add = new Proxy({}, {
    get: (_t, p) => (..._a: unknown[]) => {
      const el: AnyRec = {
        add: vi.fn(), clear: vi.fn(), fillStyle: vi.fn(), fillRect: vi.fn(),
        lineStyle: vi.fn(), strokeRect: vi.fn(), setPosition: vi.fn(),
        setInteractive: () => el, on: vi.fn(), setText: vi.fn(), setVisible: (v: boolean) => { visibilities.push(v); return el; },
        setDepth: () => el, setOrigin: () => el, setScrollFactor: () => el,
      };
      return el;
    },
  });
  const panel = new SettingsPanel(scene as never);
  return { panel, visibilities, settingsStore };
}

describe('SettingsPanel characterization（c920-09）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggle 开关：visible 翻转（show 后 hide）', () => {
    const { panel } = makePanel();
    expect(panel.isVisible()).toBe(false);
    panel.toggle();
    expect(panel.isVisible()).toBe(true);
    panel.toggle();
    expect(panel.isVisible()).toBe(false);
  });

  it('show 读取 getAudioSettings（持久键消费源）', () => {
    const { settingsStore: ss } = makePanel();
    expect(ss.getAudioSettings()).toEqual({ bgm: 60, sfx: 80, muted: false });
    expect(ss.getAudioSettings).toHaveBeenCalledTimes(1);
  });

  it('音量 setter 接 settingsStore：setBgmVolume/setSfxVolume 值域 0-100', () => {
    const { settingsStore: ss } = makePanel();
    ss.setBgmVolume(50);
    ss.setSfxVolume(75);
    expect(ss.setBgmVolume).toHaveBeenCalledWith(50);
    expect(ss.setSfxVolume).toHaveBeenCalledWith(75);
  });

  it('toggleMuted 接 settingsStore', () => {
    const { settingsStore: ss } = makePanel();
    ss.toggleMuted();
    expect(ss.toggleMuted).toHaveBeenCalledTimes(1);
  });
});
