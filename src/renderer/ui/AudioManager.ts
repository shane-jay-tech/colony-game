import Phaser from 'phaser';
import type { GameStore } from '../state/gameStore';
import { STATE_EVENTS } from '../state/gameStore';
import { selectBgmKey } from '../state/audioDirector';
import { getAudioSettings, onSettingsChange, type AudioSettings } from './settingsStore';

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
  private static readonly FADE_MS = 900;
  private offSettings: (() => void) | null = null;

  private onBgmRefresh = (): void => this.refreshBgm();
  private onBuildingDone = (): void => this.playSfx('sfx_chime', 0.4);
  private onPlaced = (): void => this.playSfx('sfx_place', 0.3);
  private onEvent = (): void => this.playSfx('sfx_bell', 0.6);
  private onCrisis = (): void => { this.playSfx('sfx_gong', 0.7); this.refreshBgm(); };
  // 2026-06-19：补齐"警告/提醒"类音效——之前 sfx_warn 只能手动播，重要警报无声
  private onDefenseAlert = (): void => this.playSfx('sfx_warn', 0.55);          // 邻邦来犯预警
  private onFactionDemand = (): void => this.playSfx('sfx_bell', 0.5);          // 阶层上书（待决模态）
  private onGradeSfx = (payload: unknown): void => {
    const reason = (payload && typeof payload === 'object') ? (payload as { reason?: string }).reason : undefined;
    this.playSfx(reason === 'ascend' ? 'sfx_gong' : 'sfx_warn', 0.5);           // 晋格庆祝 / 降格警示
  };

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.refreshBgm();

    store.on(STATE_EVENTS.GRADE_CHANGED, this.onBgmRefresh); // GRADE_CHANGED [1/2] 切 BGM（与下方 onGradeSfx 是两个独立监听，删除时务必成对处理）
    store.on(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onBgmRefresh);
    store.on(STATE_EVENTS.STORY_ENDING, this.onBgmRefresh);
    store.on(STATE_EVENTS.STATE_REPLACED, this.onBgmRefresh);
    store.on(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    store.on(STATE_EVENTS.BUILDING_COMPLETED, this.onBuildingDone);
    store.on(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    store.on(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
    store.on(STATE_EVENTS.DEFENSE_ALERT, this.onDefenseAlert);
    store.on(STATE_EVENTS.FACTION_DEMAND_TRIGGERED, this.onFactionDemand);
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGradeSfx); // GRADE_CHANGED [2/2] 晋格/降格音效（见上方 [1/2]）

    this.offSettings = onSettingsChange(() => this.applyVolumeSettings());
  }

  /** 是否有该音频资产（缺则静音降级，不报错） */
  private has(key: string): boolean {
    return this.scene.cache.audio.exists(key);
  }

  private getBgmTarget(): number {
    const s = getAudioSettings();
    if (s.muted) return 0;
    return (s.bgmVolume / 100) * 0.7; // 0.7 = max perceived BGM level (leave headroom for SFX)
  }

  private getSfxScale(): number {
    const s = getAudioSettings();
    if (s.muted) return 0;
    return s.sfxVolume / 100;
  }

  private applyVolumeSettings(): void {
    if (this.destroyed || !this.currentBgm) return;
    const target = this.getBgmTarget();
    this.fadeTween(this.currentBgm, target);
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
    const old = this.currentBgm;
    this.currentBgm = null;
    if (old) this.fadeOutAndStop(old);
    if (!this.has(key)) return;
    try {
      const next = this.scene.sound.add(key, { loop: true, volume: 0 });
      next.play();
      this.currentBgm = next;
      this.fadeTween(next, this.getBgmTarget());
    } catch {
      if (this.currentBgm) { this.currentBgm.destroy(); this.currentBgm = null; }
    }
  }

  /** 把某 sound 的 volume tween 到目标值（淡入/淡出通用）；记录 tween 供 destroy 停掉。 */
  private fadeTween(sound: Phaser.Sound.BaseSound, vol: number, onDone?: () => void): void {
    try {
      const tw = this.scene.tweens.add({
        targets: sound, volume: vol, duration: AudioManager.FADE_MS, ease: 'Linear',
        // DeepSeek F-02：完成后把自己从 fadeTweens 移除，否则长会话里数组无限增长、已完成 tween 不被 GC
        onComplete: () => {
          const i = this.fadeTweens.indexOf(tw);
          if (i >= 0) this.fadeTweens.splice(i, 1);
          if (!this.destroyed && onDone) onDone();
        },
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

  private playSfx(key: string, baseVolume: number): void {
    if (this.destroyed || !this.has(key)) return;
    const vol = baseVolume * this.getSfxScale();
    if (vol <= 0) return;
    try {
      this.scene.sound.play(key, { volume: vol });
    } catch {
      /* 音频上下文异常时静音降级，不崩 */
    }
  }

  /** 供外部 UI 调用的公开音效接口（按钮点击、警告等非 store-event 驱动的音效）。 */
  playUi(key: 'sfx_click' | 'sfx_warn'): void {
    const vol = key === 'sfx_click' ? 0.25 : 0.5;
    this.playSfx(key, vol);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.offSettings?.();
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.STORY_ENDING, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.STATE_REPLACED, this.onBgmRefresh);
    this.store.off(STATE_EVENTS.CRISIS_TRIGGERED, this.onCrisis);
    this.store.off(STATE_EVENTS.BUILDING_COMPLETED, this.onBuildingDone);
    this.store.off(STATE_EVENTS.BUILDING_PLACED, this.onPlaced);
    this.store.off(STATE_EVENTS.EVENT_TRIGGERED, this.onEvent);
    this.store.off(STATE_EVENTS.DEFENSE_ALERT, this.onDefenseAlert);
    this.store.off(STATE_EVENTS.FACTION_DEMAND_TRIGGERED, this.onFactionDemand);
    this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGradeSfx);
    for (const tw of this.fadeTweens) { try { tw.stop(); } catch { /* noop */ } }
    this.fadeTweens = [];
    if (this.currentBgm) { try { this.currentBgm.stop(); this.currentBgm.destroy(); } catch { /* noop */ } this.currentBgm = null; }
  }
}
