import { describe, it, expect } from 'vitest';
import { selectBgmKey } from '../audioDirector';

describe('selectBgmKey（动态 BGM 选择）', () => {
  const base = { grade: 0, crisisActive: false, storyChapter: null as number | null, ending: null as 'gong' | 'jia' | 'huo' | null };
  it('国格繁荣床三档', () => {
    expect(selectBgmKey({ ...base, grade: 0 })).toBe('bgm_prosper_low');
    expect(selectBgmKey({ ...base, grade: 1 })).toBe('bgm_prosper_low');
    expect(selectBgmKey({ ...base, grade: 2 })).toBe('bgm_prosper_mid');
    expect(selectBgmKey({ ...base, grade: 3 })).toBe('bgm_prosper_mid');
    expect(selectBgmKey({ ...base, grade: 4 })).toBe('bgm_prosper_high');
    expect(selectBgmKey({ ...base, grade: 5 })).toBe('bgm_prosper_high');
  });
  it('危机优先于繁荣床', () => {
    expect(selectBgmKey({ ...base, grade: 5, crisisActive: true })).toBe('bgm_crisis');
  });
  it('结局优先级最高', () => {
    expect(selectBgmKey({ ...base, grade: 5, crisisActive: true, ending: 'gong' })).toBe('bgm_ending_gong');
    expect(selectBgmKey({ ...base, ending: 'jia' })).toBe('bgm_ending_jia');
    expect(selectBgmKey({ ...base, ending: 'huo' })).toBe('bgm_ending_huo');
  });
});
