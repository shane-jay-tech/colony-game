// c918-07（S4）：audio 键集对齐断言——audioDirector 的 ALL_BGM_KEYS/SFX_KEYS
// 与 data/audio.ts AUDIO_CUES（事件→assetKey 触发表）及磁盘实存音频对齐。
// 磁盘 9mp3+6wav 实存（colony-missing-assets 报告在案，无需重复盘查）。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';
import { ALL_BGM_KEYS, SFX_KEYS } from '../audioDirector';
import { AUDIO_CUES } from '../../data/audio';

const AUDIO_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'audio');
const audioTs = readFileSync(
  join(__dirname, '..', '..', 'data', 'audio.ts'),
  'utf8',
);

/** AUDIO_CUES 触发表引用的 assetKey 集合（源码正则抽取，避免引实现细节）。 */
function cueAssetKeys(): string[] {
  const block = audioTs.slice(audioTs.indexOf('AUDIO_CUES'));
  return [...block.matchAll(/assetKey:\s*'([^']+)'/g)].map(m => m[1] as string);
}

test('BGM：ALL_BGM_KEYS 9 键逐一对齐磁盘 bgm_*.mp3', () => {
  expect(ALL_BGM_KEYS.length).toBe(9);
  for (const key of ALL_BGM_KEYS) {
    expect(existsSync(join(AUDIO_DIR, `bgm_${key.replace(/^bgm_/, '')}.mp3`))
      || existsSync(join(AUDIO_DIR, `${key}.mp3`))).toBe(true);
  }
});

test('SFX：SFX_KEYS 6 键逐一对齐磁盘 sfx_*.wav', () => {
  expect(SFX_KEYS.length).toBe(6);
  for (const key of SFX_KEYS) {
    expect(existsSync(join(AUDIO_DIR, `${key}.wav`))).toBe(true);
  }
});

test('AUDIO_CUES 触发表引用的 assetKey ⊆ SFX_KEYS（不触发未知音效）', () => {
  for (const assetKey of cueAssetKeys()) {
    expect(SFX_KEYS).toContain(assetKey);
  }
});
