/**
 * c1007-24：全局错误边界（ErrorBoundary，Phaser/无 React 架构的全局等价物）。
 *
 * 背景（c1006-05 遗留 1）：生产面 console.error 为降级形态——本 Boundary 补建后，
 * modifierValidator 等数据面校验升回 DEV/生产双 throw：错误统一冒泡到 window 级
 * error/unhandledrejection 监听，由宿主注入的 report 回调呈现（main.ts 注入红色
 * crash overlay），不再整页无声崩死。
 *
 * 测试形态：targets/report 均可注入（vitest node 环境零 DOM 依赖）；
 * decodeAudioData 噪声过滤（main.ts 原内联逻辑）一并迁入，行为不变。
 */
export interface ErrorBoundaryOptions {
  /** 呈现回调（main.ts 注入 crash overlay；测试注入收集器）。 */
  report: (title: string, detail: string) => void;
  /** 事件目标（默认 window；测试注入假 target）。 */
  targets?: Array<{
    addEventListener: (type: string, handler: (event: unknown) => void) => void;
  }>;
}

export interface ErrorBoundaryHandle {
  /** 已注册的监听类型（自证用）。 */
  readonly listening: readonly string[];
}

let installed = false;

/** 提取 Promise 拒绝原因的可展示文本。 */
export function formatRejectionDetail(reason: unknown): string {
  const r = reason as { message?: string; stack?: string } | null | undefined;
  return String(r?.stack ?? r ?? '').slice(0, 1500);
}

/** window error 事件的报告体（message + 位置 + stack）。 */
export function formatErrorEventDetail(event: {
  message?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  error?: { stack?: string } | null;
}): string {
  return `${event.message ?? ''}\n@ ${event.filename ?? ''}:${event.lineno ?? ''}:${event.colno ?? ''}\n${event.error?.stack ?? ''}`.slice(0, 1500);
}

/**
 * 安装全局错误边界。重复安装是 no-op（防 HMR/多次启动双报）。
 * 返回句柄供测试断言监听面。
 */
export function installErrorBoundary(options: ErrorBoundaryOptions): ErrorBoundaryHandle {
  if (installed) return { listening: ['error', 'unhandledrejection'] };
  const targets = options.targets ?? [window];
  const onWindowError = (event: unknown): void => {
    const e = event as { message?: string; filename?: string; lineno?: number; colno?: number; error?: { stack?: string } | null };
    options.report('JS 错误', formatErrorEventDetail(e));
  };
  const onUnhandledRejection = (event: unknown): void => {
    const r = (event as { reason?: unknown }).reason;
    const msg = String((r as { message?: string } | null | undefined)?.message ?? r ?? '');
    // main.ts 原内联过滤（2026-06-02）：音频解码失败的拒绝是资产面噪声，不进崩溃层。
    if (msg.includes('decodeAudioData') || msg.includes('Unable to decode audio')) return;
    options.report('Promise 未捕获', formatRejectionDetail(r));
  };
  for (const target of targets) {
    target.addEventListener('error', onWindowError);
    target.addEventListener('unhandledrejection', onUnhandledRejection);
  }
  installed = true;
  return { listening: ['error', 'unhandledrejection'] };
}

/** 测试专用复位（生产零调用）。 */
export function resetErrorBoundaryForTests(): void {
  installed = false;
}
