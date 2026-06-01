import Phaser from 'phaser';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { selectBgmKey } from '../state/audioDirector';

/**
 * AudioManager（Phaser 层）——解决"全程静音"（§11.A 头号短板）。
 *
 * 动态 BGM：按 gameState（国格/危机/结局）切换繁荣床/情绪层/结局曲（selectBgmKey 决定）。
 * 音效：建成/事件/危机/放置 触发短音。
 *
 * **优雅降级**：音频资产（Mureka 生成的 mp3）尚未就位时，cache 里没有对应 key → 全部 no-op、静音，
 * 绝不报错。资产 BootScene 加载进来后自动有声（同 image-or-fallback 哲学）。
 * 循环 BGM 设循环点避开尾部水印（资产就位后在 loadAudio 配 marker；此处先整体 loop）。
 */
export class AudioManager {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private currentBgmKey: string | null = null;
  private currentBgm: Phaser.Sound.BaseSound | null = null;
  private destroyed = false;
  /** 进行中的淡入淡出 tween（destroy 时停掉，避免回调在销毁后触发） */
  private fadeTweens: Phaser.Tweens.Tween[] = [];
  private static readonly BGM_VOL = 0.5;
  private static readonly FADE_MS = 900;

  private onBgmRefresh = (): void => this.refreshBgm();
  private onBuildingDone = (): void => this.playSfx('sfx_chime', 0.4);
  private onPlaced = (): void => this.playSfx('sfx_place', 0.3);
  private onEvent = (): void => this.playSfx('sfx_bell', 0.6);
  private onCrisis = (): void => { this.playSfx('sfx_gong', 0.7); this.refreshBgm(); };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.refreshBgm();

    store.on(STATE_EVENTS.GRADE_CHANGED, this.onBgmRefresh);
    store.on(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onBgmRefresh);
    store.on(STATE_EVENTS.STORY_ENDING, this.onBgmRefresh);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onBgmRefresh);
    store.on(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.onBuildingDone);
    store.on(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    store.on(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
  }

  /** 是否有该音频资产（缺则静音降级，不报错） */
  private has(key: string): boolean {
    return this.scene.cache.audio.exists(key);
  }

  private refreshBgm(): void {
    if (this.destroyed) return;
    const sf = this.store.getStoryFlags();
    const key = selectBgmKey({
      grade: this.store.getGrade(),
      crisisActive: this.store.isCrisisActive(),
      storyChapter: sf ? sf.chapter : null,
      ending: sf ? sf.ending : null,
    });
    if (key === this.currentBgmKey) return;
    this.currentBgmKey = key;
    // 切歌：旧曲淡出后停（不再硬切），新曲从 0 淡入——过渡平滑。
    const old = this.currentBgm;
    this.currentBgm = null;
    if (old) this.fadeOutAndStop(old);
    if (!this.has(key)) return; // 资产未就位 → 静音降级
    // DeepSeek 复审：play() 在音频上下文被锁/解码失败时可能抛异常——包 try-catch，宁可静音不崩游戏。
    try {
      const next = this.scene.sound.add(key, { loop: true, volume: 0 });
      next.play();
      this.currentBgm = next;
      this.fadeTween(next, AudioManager.BGM_VOL); // 淡入
    } catch {
      if (this.currentBgm) { this.currentBgm.destroy(); this.currentBgm = null; }
    }
  }

  /** 把某 sound 的 volume tween 到目标值（淡入/淡出通用）；记录 tween 供 destroy 停掉。 */
  private fadeTween(sound: Phaser.Sound.BaseSound, vol: number, onDone?: () => void): void {
    try {
      const tw = this.scene.tweens.add({
        targets: sound, volume: vol, duration: AudioManager.FADE_MS, ease: 'Linear',
        onComplete: () => { if (!this.destroyed && onDone) onDone(); },
      });
      this.fadeTweens.push(tw);
    } catch {
      // tween 不可用（极端 mock/环境）→ 直接设音量，不崩
      try { (sound as unknown as { setVolume?: (v: number) => void }).setVolume?.(vol); } catch { /* noop */ }
      if (onDone && !this.destroyed) onDone();
    }
  }

  /** 旧曲淡出到 0 后 stop+destroy。 */
  private fadeOutAndStop(sound: Phaser.Sound.BaseSound): void {
    this.fadeTween(sound, 0, () => { try { sound.stop(); sound.destroy(); } catch { /* noop */ } });
  }

  private playSfx(key: string, volume: number): void {
    if (this.destroyed || !this.has(key)) return;
    try {
      this.scene.sound.play(key, { volume });
    } catch {
      /* 音频上下文异常时静音降级，不崩 */
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.STORY_ENDING, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.onBuildingDone);
    this.store.off(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    this.store.off(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
    // 先停所有淡入淡出 tween（避免 onComplete 在销毁后触发），再停 BGM
    for (const tw of this.fadeTweens) { try { tw.stop(); } catch { /* noop */ } }
    this.fadeTweens = [];
    if (this.currentBgm) { try { this.currentBgm.stop(); this.currentBgm.destroy(); } catch { /* noop */ } this.currentBgm = null; }
  }
}
