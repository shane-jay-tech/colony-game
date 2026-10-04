import { describe, it, expect } from 'vitest';
import { JIT_HINTS, type JitTrigger } from '../jitHints';

// c1002-27（c922-120 遗留）：pickJitHint 死码退役（生产零调用，JitHintManager 实走
// markJitHintSeen 闸＋JIT_HINTS 直取）——只测死路径的两例随之删除，活数据守护例保留。
describe('JIT_HINTS 数据守护（c922-120 :14 活守护例承继）', () => {
  it('每个 trigger 都有一条文案且 trigger 字段自洽', () => {
    (Object.keys(JIT_HINTS) as JitTrigger[]).forEach((k) => {
      expect(JIT_HINTS[k].trigger).toBe(k);
      expect(JIT_HINTS[k].text.trim().length).toBeGreaterThan(4);
    });
  });
});
