// c920-10：AudioManager characterization——playSfx 音量链、cache 缺失静音降级、destroy 幂等。
// 递归 Proxy stub 场景（cache.audio.exists 可控 + sound.play spy），零生产码改动。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from '../AudioManager';

type AnyRec = Record<string, any>;

const audioSettings = { bgm: 70, sfx: 50, muted: false };
const shared = vi.hoisted(() => ({ bgmVolume: 70, sfxVolume: 50, muted: false }));

const settingsStore = vi.hoisted(() => ({
  getAudioSettings: () => ({ ...shared }),
  onSettingsChange: vi.fn(() => () => {}),
  setBgmVolume: vi.fn(),
  setSfxVolume: vi.fn(),
  toggleMuted: vi.fn(),
}));

vi.mock('../settingsStore', () => settingsStore);

function makeManager(existsKeys: string[] = ['sfx_chime'], muted = false) {
  shared.muted = muted;
  const soundPlay = vi.fn();
  const existing = new Set(existsKeys);
  const scene: AnyRec = {
    cache: { audio: { exists: (key: string) => existing.has(key) } },
    sound: { play: soundPlay },
    scale: { width: 1366, height: 800 },
    tweens: { add: vi.fn() },
    registry: {},
  };
  const store: AnyRec = {
    getStoryFlags: vi.fn(() => ({ chapter: 0, ending: null })),
    isCrisisActive: vi.fn(() => false),
    getGrade: vi.fn(() => 1),
    on: vi.fn(),
    off: vi.fn(),
  };
  const mgr = new AudioManager(scene as never, store as never);
  return { mgr, soundPlay };
}

function resetMocks() {
  shared.muted = false;
  shared.bgmVolume = 70;
  shared.sfxVolume = 50;
}

describe('AudioManager characterization（c920-10）', () => {
  beforeEach(() => resetMocks());

  it('playSfx：音量=base×sfxVolume/100 透传 sound.play', () => {
    const { mgr, soundPlay } = makeManager(['sfx_chime']);
    mgr.playSfx('sfx_chime', 0.4);
    expect(soundPlay).toHaveBeenCalledWith('sfx_chime', { volume: 0.2 });
  });

  it('cache.audio.exists false → 静音降级（不 play 不抛）', () => {
    const { mgr, soundPlay } = makeManager([]);
    expect(() => mgr.playSfx('sfx_missing', 0.5)).not.toThrow();
    expect(soundPlay).not.toHaveBeenCalled();
  });

  it('muted → 音量归零直接 return（不 play）', () => {
    const { mgr, soundPlay } = makeManager(['sfx_chime'], true);
    mgr.playSfx('sfx_chime', 0.4);
    expect(soundPlay).not.toHaveBeenCalled();
  });

  it('destroy 幂等：destroy 后 playSfx no-op', () => {
    const { mgr, soundPlay } = makeManager(['sfx_chime']);
    mgr.destroy();
    mgr.destroy();
    mgr.playSfx('sfx_chime', 0.4);
    expect(soundPlay).not.toHaveBeenCalled();
  });
});
