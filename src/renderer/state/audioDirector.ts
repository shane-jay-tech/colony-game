/**
 * 音频导演（纯函数）——按 gameState 决定该放哪条 BGM。无副作用、可测。
 * AudioManager（Phaser 层）调用它，再做实际加载/淡入淡出/缺资产降级。
 *
 * §11.A 动态音乐：随①国格阶梯（繁荣床三档）②局势（危机/结局）切换；故事卷动机/结局专属曲。
 * 优先级：结局 > 危机 > （故事卷动机）> 国格繁荣床。
 */

export interface AudioDirectorInput {
  grade: number;              // 0..5
  crisisActive: boolean;
  /** 故事模式：当前章（null=沙盒） */
  storyChapter: number | null;
  /** 故事三结局（null=未到） */
  ending: 'gong' | 'jia' | 'huo' | null;
}

/** 返回应播放的 BGM 资产 key（AudioManager 据此切换；缺资产则静音降级）。 */
export function selectBgmKey(input: AudioDirectorInput): string {
  if (input.ending) return `bgm_ending_${input.ending}`;     // 结局专属（公天下=拆龙椅主题）
  if (input.crisisActive) return 'bgm_crisis';                // 危机情绪层
  // 国格繁荣床三档（聚落/城邑→初，邦国/诸侯→中，霸主/天下共主→盛）
  if (input.grade >= 4) return 'bgm_prosper_high';
  if (input.grade >= 2) return 'bgm_prosper_mid';
  return 'bgm_prosper_low';
}

/** 全部可能用到的 BGM key（BootScene 据此尝试加载存在的音频文件；不存在则跳过、静音降级）。 */
export const ALL_BGM_KEYS: readonly string[] = [
  'bgm_prosper_low', 'bgm_prosper_mid', 'bgm_prosper_high',
  'bgm_crisis', 'bgm_war', 'bgm_ritual',
  'bgm_ending_gong', 'bgm_ending_jia', 'bgm_ending_huo',
];

/** 音效 key（事件触发用，对齐 data/audio.ts AUDIO_CUES）。 */
export const SFX_KEYS: readonly string[] = ['sfx_bell', 'sfx_chime', 'sfx_gong', 'sfx_place', 'sfx_click', 'sfx_warn'];
