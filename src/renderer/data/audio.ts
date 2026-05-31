import type { AudioCue } from './schema';

/**
 * 音效触发表（Kimi 反审 #8 必修第 7 项）。
 * Part 1 给骨架，资源后期补 mp3/ogg。
 */
export const AUDIO_CUES: AudioCue[] = [
  {
    eventTrigger: 'court_event_appear',
    assetKey: 'sfx_bell',
    volume: 0.6,
    loop: false,
  },
  {
    eventTrigger: 'building_complete',
    assetKey: 'sfx_chime',
    volume: 0.4,
    loop: false,
  },
  {
    eventTrigger: 'disaster',
    assetKey: 'sfx_gong',
    volume: 0.7,
    loop: false,
  },
];
