const STORAGE_KEY = 'colony_audio_settings';

export interface AudioSettings {
  bgmVolume: number;   // 0-100
  sfxVolume: number;   // 0-100
  muted: boolean;
}

const DEFAULTS: AudioSettings = { bgmVolume: 70, sfxVolume: 80, muted: false };

let cache: AudioSettings | null = null;
const listeners: Array<(s: AudioSettings) => void> = [];

function load(): AudioSettings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AudioSettings>;
      cache = {
        bgmVolume: clamp(parsed.bgmVolume ?? DEFAULTS.bgmVolume),
        sfxVolume: clamp(parsed.sfxVolume ?? DEFAULTS.sfxVolume),
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULTS.muted,
      };
      return cache;
    }
  } catch { /* corrupt → defaults */ }
  cache = { ...DEFAULTS };
  return cache;
}

function persist(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch { /* quota/disabled */ }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function getAudioSettings(): AudioSettings {
  return load();
}

export function setBgmVolume(v: number): void {
  load();
  cache!.bgmVolume = clamp(v);
  persist();
  notify();
}

export function setSfxVolume(v: number): void {
  load();
  cache!.sfxVolume = clamp(v);
  persist();
  notify();
}

export function setMuted(m: boolean): void {
  load();
  cache!.muted = m;
  persist();
  notify();
}

export function toggleMuted(): void {
  setMuted(!load().muted);
}

export function onSettingsChange(fn: (s: AudioSettings) => void): () => void {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

function notify(): void {
  const s = load();
  for (const fn of listeners) fn(s);
}
