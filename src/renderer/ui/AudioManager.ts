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
    // 切歌：停旧
    if (this.currentBgm) { this.currentBgm.stop(); this.currentBgm.destroy(); this.currentBgm = null; }
    if (!this.has(key)) return; // 资产未就位 → 静音降级
    this.currentBgm = this.scene.sound.add(key, { loop: true, volume: 0.5 });
    this.currentBgm.play();
  }

  private playSfx(key: string, volume: number): void {
    if (this.destroyed || !this.has(key)) return;
    this.scene.sound.play(key, { volume });
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
    if (this.currentBgm) { this.currentBgm.stop(); this.currentBgm.destroy(); this.currentBgm = null; }
  }
}
