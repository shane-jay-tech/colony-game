import Phaser from 'phaser';
import { validateStaticData } from '@/data';
import { REGISTRY_KEYS, registryGet } from '../ui/registry';
import { ALL_BGM_KEYS, SFX_KEYS } from '../state/audioDirector';
import { ALL_SCATTER_IDS as SCATTER_IDS } from '../data/scatterConfig';
import { EVENT_ART, TERRAIN_ART, getBootLoadList } from '../data/artManifest';

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
    // 落在 public/art/buildings/<defId>.webp（c921-02 整批转码；原 png 保留在盘）；
    // 尚未生成的 defId 直接走 fallback。
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      // 仅打 debug，不污染 console.error——大量缺图属预期状态
      console.debug('[BootScene] sprite missing (fallback to sigil):', file.key);
    });
    // v0.9 Pillar 3.2 + h912-11 批次一：建筑加载清单改由 artManifest 派生（PLAN.md：manifest
    // 已描述的资产以 manifest 为权威 boot-loading 源）。键与顺序经单测与旧手写清单逐项相等。
    // 缺图不崩——loaderror 事件上报后 textures.exists(key) 返 false，
    // MapRenderer 据此自动回退到现有 fillRect+沙印渲染。审核通过的 baseline
    // 落在 public/art/buildings/<defId>.webp（c921-02 转码）；尚未生成的 defId 直接走 fallback。
    // （n916d-24：此处曾重复注册第二个 loaderror，同一失败双打日志——已合并为上方一处。）
    for (const item of getBootLoadList('building')) {
      this.load.image(item.key, item.url);
    }

    // W3：手绘地貌贴图（缺图 loaderror 静默 → MapRenderer 回退色块）。
    // c918-04/05：TERRAIN_ART 已 5 型且指向实存文件——清单改由 manifest 派生
    // （同 general 模式），删除硬编码字面数组（B-139 销项）。c921-02：path 已随转码改指 .webp。
    for (const asset of TERRAIN_ART) {
      this.load.image(asset.key, asset.path);
    }
    // W4：2.5D 散布素材（树/石/灌木/芦苇；缺则 MapRenderer 跳过散布）。
    // h912-11：manifest 无 scatter 类目，保留原清单。
    // c921-02：散布 9 图已整批转码为 .webp（原 png 保留在盘）——此处的硬编码路径同步改指，
    // 属「manifest 之外的第二事实源」，改扩展名时必须与本行一起改（c921-01 报告第四节已登记）。
    for (const id of SCATTER_IDS) {
      this.load.image(`scatter_${id}`, `art/scatter/${id}.webp`);
    }
    // 2026-06-19：将领立绘（军务面板）+ 事件插画（朝议弹窗/结局）。缺图静默 → 回退文字。
    // h912-11 批次一：将领加载清单改由 artManifest.GENERAL_ART 派生（键=portrait_${id}，
    // 与旧 GENERAL_POOL 派生序列经单测逐项相等）。
    for (const item of getBootLoadList('general')) {
      this.load.image(item.key, item.url);
    }
    // P0-3：事件插画清单以 artManifest.EVENT_ART 为唯一权威源（去重本地 EVENT_ART_NAMES）
    // c921-02：URL 模板同步改指 .webp（与 manifest 的 path 同扩展名；原 png 保留在盘）
    for (const asset of EVENT_ART) {
      const name = asset.key.startsWith('evt_art_') ? asset.key.slice('evt_art_'.length) : asset.key;
      this.load.image(asset.key, `art/events/${name}.webp`);
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
    if (registryGet(this.registry, REGISTRY_KEYS.introDone)) {
      this.scene.start('GameScene');
    } else {
      this.scene.start('ModeSelectScene');
    }
  }
}
