import Phaser from 'phaser';
import { validateStaticData, BUILDINGS } from '@/data';

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

    // J-3e v0.8：先进 IntroScene 选国号 + 身份 + 楔子，再到 GameScene
    // 若注册表已有 introDone 标志（hot reload / dev 重启），直接进 GameScene 避免重复展示
    if (this.registry.get('introDone')) {
      this.scene.start('GameScene');
    } else {
      this.scene.start('IntroScene');
    }
  }
}
