// c1007-24：ErrorBoundary 组件测试（c1006-05 遗留 1——UI 基建）。
// 注入形态（vitest node 环境零 DOM）：targets/report 假件收集分发行为；
// ③ 号例钉 modifierValidator 双 throw（生产面降级撤销的翻正锚）。
import { describe, expect, it, vi } from 'vitest';
import {
  formatErrorEventDetail,
  formatRejectionDetail,
  installErrorBoundary,
  resetErrorBoundaryForTests,
} from '../ErrorBoundary';

function makeTarget() {
  const handlers = new Map<string, (event: unknown) => void>();
  return {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers.set(type, handler);
    },
    dispatch(type: string, event: unknown) {
      handlers.get(type)?.(event);
    },
  };
}

describe('c1007-24 ErrorBoundary', () => {
  it('① window error 事件 → report 被调，报告含 message/位置/stack', () => {
    resetErrorBoundaryForTests();
    const target = makeTarget();
    const report = vi.fn();
    installErrorBoundary({ report, targets: [target] });
    expect(report).not.toHaveBeenCalled();
    target.dispatch('error', {
      message: 'boom at update',
      filename: 'renderer.bundle.js',
      lineno: 42,
      colno: 7,
      error: { stack: 'stack-lines' },
    });
    expect(report).toHaveBeenCalledTimes(1);
    const [title, detail] = report.mock.calls[0] as [string, string];
    expect(title).toBe('JS 错误');
    expect(detail).toContain('boom at update');
    expect(detail).toContain('renderer.bundle.js:42:7');
    expect(detail).toContain('stack-lines');
  });

  it('② rejection → report；decodeAudioData 噪声被过滤不进崩溃层', () => {
    resetErrorBoundaryForTests();
    const target = makeTarget();
    const report = vi.fn();
    installErrorBoundary({ report, targets: [target] });
    target.dispatch('unhandledrejection', { reason: { message: 'real failure', stack: 'stk' } });
    expect(report).toHaveBeenCalledTimes(1);
    const [title, detail] = report.mock.calls[0] as [string, string];
    expect(title).toBe('Promise 未捕获');
    expect(detail).toContain('stk');
    // 噪声过滤（main.ts 原内联逻辑迁移，行为不变）
    target.dispatch('unhandledrejection', { reason: { message: 'decodeAudioData failed' } });
    target.dispatch('unhandledrejection', { reason: 'Unable to decode audio' });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it('③ 重复安装 no-op（防双报）＋ modifierValidator 双 throw（生产面降级撤销）', async () => {
    resetErrorBoundaryForTests();
    const target = makeTarget();
    const report = vi.fn();
    installErrorBoundary({ report, targets: [target] });
    installErrorBoundary({ report, targets: [target] }); // 第二次安装应 no-op
    target.dispatch('error', { message: 'once only' });
    expect(report).toHaveBeenCalledTimes(1);

    // 双 throw 翻正锚：NODE_ENV=production 下校验失败也 throw（c1006-05 降级路径撤销）
    const { validateModifierEffect, ModifierValidationError } = await import('../modifierValidator');
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        validateModifierEffect({ target: 'country_grain_output', op: 'add', value: Number.NaN }, 'P'),
      ).toThrow(ModifierValidationError);
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it('格式化纯函数：截断 1500 与 rejection 字符串化', () => {
    expect(formatRejectionDetail('plain string reason')).toBe('plain string reason');
    expect(formatRejectionDetail({ stack: 's'.repeat(2000) }).length).toBe(1500);
    expect(formatErrorEventDetail({ message: 'm' })).toContain('m');
  });
});
