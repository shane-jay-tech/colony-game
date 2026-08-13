import Phaser from 'phaser';
import { validateStaticData, BUILDINGS } from '@/data';
import { ALL_BGM_KEYS, SFX_KEYS } from '../state/audioDirector';
import { ALL_SCATTER_IDS as SCATTER_IDS } from '../data/scatterConfig';
import { GENERAL_POOL } from '../data/generals';
import { EVENT_ART } from '../data/artManifest';

/**
 * BootScene：
 *   1. 等字体（Kimi 反审 #4：file:// 下 @font-face 有 CORS 风险，必须 await）
 *   2. 跑静态数据校验（modifierValidator）
 *   3. v0.9 Pillar 3.2：试加载每个 building 的 sprite（缺图静默回退到沙印）
 *   4. Slice D：跳到 GameScene + UIScene
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 静态数据校验：拼错 modifier target / 非法 ResourceId 一律 throw
    try {
      validateStaticData();
    } catch (err) {
      console.error('[BootScene] static data validation failed:', err);
      throw err;
    }

    // v0.9 Pillar 3.2：尝试加载每个建筑的 sprite。
    // 缺图不崩——loaderror 事件上报后 textures.exists(key) 返 false，
    // MapRenderer 据此自动回退到现有 fillRect+沙印渲染。审核通过的 baseline
    // 落在 public/art/buildings/<defId>.png；尚未生成的 defId 直接走 fallback。
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // 仅打 debug，不污染 console.error——大量缺图属预期状态
      console.debug('[BootScene] sprite missing (fallback to sigil):', file.key);
    });
    for (const def of BUILDINGS) {
      this.load.image(def.assetKey, `art/buildings/${def.id}.png`);
    }

    // W3：手绘地貌贴图（缺图 loaderror 静默 → MapRenderer 回退色块）。
    for (const terr of ['plain', 'hills', 'forest', 'river', 'mountain']) {
      this.load.image(`terrain_${terr}`, `art/terrain/${terr}.png`);
    }
    // W4：2.5D 散布素材（树/石/灌木/芦苇；缺则 MapRenderer 跳过散布）。
    for (const id of SCATTER_IDS) {
      this.load.image(`scatter_${id}`, `art/scatter/${id}.png`);
    }
    // 2026-06-19：将领立绘（军务面板）+ 事件插画（朝议弹窗/结局）。缺图静默 → 回退文字。
    for (const g of GENERAL_POOL) {
      this.load.image(`portrait_${g.id}`, `art/generals/${g.id}.png`);
    }
    // P0-3：事件插画清单以 artManifest.EVENT_ART 为唯一权威源（去重本地 EVENT_ART_NAMES）
    for (const asset of EVENT_ART) {
      const name = asset.key.startsWith('evt_art_') ? asset.key.slice('evt_art_'.length) : asset.key;
      this.load.image(asset.key, `art/events/${name}.png`);
    }

    // Phase4 音频：试加载 BGM + 音效。同 sprite——缺文件 loaderror 静默，
    // AudioManager 通过 cache.audio.exists(key) 自动静音降级。资产（Mureka 生成的 mp3）
    // 落在 public/audio/<key>.mp3；尚未生成的 key 直接跳过、无声。
    for (const key of ALL_BGM_KEYS) {
      this.load.audio(key, `audio/${key}.mp3`); // BGM：Mureka 生成的 mp3
    }
    for (const key of SFX_KEYS) {
      this.load.audio(key, `audio/${key}.wav`); // 音效：本地合成的短 wav
    }
  }

  async create(): Promise<void> {
    // Kimi 反审 #4：等字体真正加载完成再启动后续 scene
    if (typeof document !== 'undefined' && (document as Document & { fonts?: FontFaceSet }).fonts) {
      try {
        await document.fonts.ready;
      } catch (err) {
        console.warn('[BootScene] fonts.ready rejected; FOUT may occur:', err);
      }
    }

    // Phase1：先进 ModeSelectScene 选模式（沙盒/故事）→ IntroScene 选国号身份楔子 → GameScene
    // 若注册表已有 introDone 标志（hot reload / dev 重启），直接进 GameScene 避免重复展示
    if (this.registry.get('introDone')) {
      this.scene.start('GameScene');
    } else {
      this.scene.start('ModeSelectScene');
    }
  }
}
