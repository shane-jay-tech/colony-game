/**
 * JIT（Just-In-Time）即时提示——首次遇到某情境时，弹一句大白话教学，**只弹一次**（seen 持久化）。
 *
 * 设计（§11.C 新手引导）：不在开头堆教程，而是"现学现用"。每条提示绑定一个 trigger（情境 key），
 * 该情境**首次**发生时由 JitHintManager 通过 Toast 弹出，随后写入 seenJitHints 永不再扰。
 *
 * 纯数据 + 纯函数，便于测试；实际弹出/持久化在 ui/JitHintManager.ts。
 * 文案守半文半白、禁偏字（记忆 colony-game-text-balance）。
 */

export type JitTrigger =
  | 'first_build'        // 首次落子建造
  | 'first_complete'     // 首座建筑营建完成
  | 'first_grade'        // 首次国格晋阶
  | 'first_crisis'       // 首次跌入低谷危机
  | 'first_event'        // 首次朝堂事件
  | 'first_diplomacy';   // 首次邻邦动作（邦交登场）

export interface JitHint {
  trigger: JitTrigger;
  /** Toast 一句话；可关、不重复 */
  text: string;
}

export const JIT_HINTS: Readonly<Record<JitTrigger, JitHint>> = {
  first_build: { trigger: 'first_build', text: '已落子动工。营建需时日，建好才出产；缺料会停工，留心仓廪。' },
  first_complete: { trigger: 'first_complete', text: '一座既成。建筑相邻可有加成——把同类或相生的挨着摆，事半功倍。' },
  first_grade: { trigger: 'first_grade', text: '国格晋阶了。国格越高，邻邦越敬，亦解锁更高阶的营建与国策。' },
  first_crisis: { trigger: 'first_crisis', text: '邦势跌入低谷。莫慌，稳住民心与口粮、削减入不敷出，假以时日可复元。' },
  first_event: { trigger: 'first_event', text: '朝堂有事待断。抉择无绝对对错，各有得失，相机而行即可。' },
  first_diplomacy: { trigger: 'first_diplomacy', text: '邻邦登场了。点开邦交可观各国亲疏；交好可免兵戈，结怨则恐遭袭扰。' },
};

/**
 * 纯函数：某 trigger 是否该弹提示。已 seen 或无此 trigger → null。
 * @param seen 已弹过的 trigger 集合（来自持久化 seenJitHints）
 */
export function pickJitHint(trigger: JitTrigger, seen: ReadonlySet<string>): JitHint | null {
  if (seen.has(trigger)) return null;
  return JIT_HINTS[trigger] ?? null;
}
