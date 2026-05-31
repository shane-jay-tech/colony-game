import { describe, it, expect } from 'vitest';
import { pickJitHint, JIT_HINTS, type JitTrigger } from '../jitHints';

describe('pickJitHint（JIT 即时提示选择，纯函数）', () => {
  it('未 seen 的 trigger 返回对应提示', () => {
    const h = pickJitHint('first_build', new Set());
    expect(h).not.toBeNull();
    expect(h!.trigger).toBe('first_build');
    expect(h!.text.length).toBeGreaterThan(0);
  });
  it('已 seen 的 trigger 返回 null（不重复）', () => {
    expect(pickJitHint('first_crisis', new Set(['first_crisis']))).toBeNull();
  });
  it('每个 trigger 都有一条文案且 trigger 字段自洽', () => {
    (Object.keys(JIT_HINTS) as JitTrigger[]).forEach((k) => {
      expect(JIT_HINTS[k].trigger).toBe(k);
      expect(JIT_HINTS[k].text.trim().length).toBeGreaterThan(4);
    });
  });
});
