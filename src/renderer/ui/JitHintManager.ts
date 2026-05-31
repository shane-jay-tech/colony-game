import Phaser from 'phaser';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { Toast } from './Toast';
import { pickJitHint, type JitTrigger } from '../data/jitHints';

/**
 * JitHintManager（Phaser 层）——把 JIT 即时提示接到游戏事件上。
 *
 * 某情境**首次**发生 → 通过 Toast 弹一句大白话教学 → 写入 seenJitHints 永不再扰（持久化跨存档）。
 * 选择/去重逻辑在纯函数 pickJitHint + store.markJitHintSeen，本类只做事件→trigger 的接线。
 *
 * Toast 走 registry['toast']（UIScene 注册）；拿不到就静默跳过（不报错）。
 */
export class JitHintManager {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private destroyed = false;

  private fire(trigger: JitTrigger): void {
    if (this.destroyed) return;
    const hint = pickJitHint(trigger, this.store.getSeenJitHints());
    if (!hint) return; // 已弹过或无此提示
    this.store.markJitHintSeen(trigger);
    const toast = this.scene.registry.get('toast') as Toast | undefined;
    toast?.show(hint.text, 'info', 5200);
  }

  private onPlaced = (): void => this.fire('first_build');
  private onCompleted = (): void => this.fire('first_complete');
  private onEvent = (): void => this.fire('first_event');
  private onCrisis = (): void => this.fire('first_crisis');
  private onNpcAction = (): void => this.fire('first_diplomacy');
  private onGrade = (payload: unknown): void => {
    const reason = (payload && typeof payload === 'object') ? (payload as { reason?: string }).reason : undefined;
    if (reason !== 'ascend') return; // 仅晋阶教学；降格不弹"晋阶"提示
    this.fire('first_grade');
  };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    store.on(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.onCompleted);
    store.on(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
    store.on(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    store.on(STATE_EVENTS.NPC_ACTION, this.onNpcAction);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGrade);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.onCompleted);
    this.store.off(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
    this.store.off(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    this.store.off(STATE_EVENTS.NPC_ACTION, this.onNpcAction);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGrade);
  }
}
