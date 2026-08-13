import Phaser from 'phaser';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import type { GameStateEventMap } from '../state/stateEvents';
import { REGISTRY_KEYS, registryGet } from './registry';
import { JIT_HINTS, type JitTrigger } from '../data/jitHints';

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
    // DeepSeek 复审：用 markJitHintSeen 的返回值做唯一去重闸（首次标记才弹），
    // 避免"先 pick 后 mark"两段式在理论上重复弹；事件派发是同步的，这里更简明也更稳。
    if (!this.store.markJitHintSeen(trigger)) return; // 早已弹过
    const hint = JIT_HINTS[trigger];
    if (!hint) return;
    const toast = registryGet(this.scene.registry, REGISTRY_KEYS.toast);
    toast?.show(hint.text, 'info', 5200);
  }

  private onPlaced = (): void => this.fire('first_build');
  private onCompleted = (): void => this.fire('first_complete');
  private onEvent = (): void => this.fire('first_event');
  private onCrisis = (): void => this.fire('first_crisis');
  private onNpcAction = (): void => this.fire('first_diplomacy');
  private onPolicy = (): void => this.fire('first_policy');
  private onDecree = (): void => this.fire('first_decree');
  private onResources = (payload: GameStateEventMap['state:resourcesChanged']): void => {
    const deltas = payload.deltas;
    if ((deltas.gold ?? 0) > 0) this.fire('first_gold_income');
    if ((deltas.cloth ?? 0) > 0) this.fire('first_cloth_income');
    if ((deltas.bronze ?? 0) > 0) this.fire('first_bronze_income');
    if ((deltas.rite ?? 0) > 0) this.fire('first_rite_income');
  };
  private onGrade = (payload: GameStateEventMap['state:gradeChanged']): void => {
    if (payload.reason !== 'ascend') return;
    this.fire('first_grade');
  };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    // 开局提示（延迟 800ms 让玩家先看到画面）
    scene.time.delayedCall(800, () => this.fire('game_start'));
    store.on(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.onCompleted);
    store.on(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
    store.on(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    store.on(STATE_EVENTS.NPC_ACTION, this.onNpcAction);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGrade);
    store.on(STATE_EVENTS.POLICY_ADOPTED, this.onPolicy);
    store.on(STATE_EVENTS.DECREE_ADOPTED, this.onDecree);
    store.on(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
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
    this.store.off(STATE_EVENTS.POLICY_ADOPTED, this.onPolicy);
    this.store.off(STATE_EVENTS.DECREE_ADOPTED, this.onDecree);
    this.store.off(STATE_EVENTS.RESOURCES_CHANGED, this.onResources);
  }
}
