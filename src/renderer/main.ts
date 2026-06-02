import Phaser from 'phaser';
import { EventEmitter } from 'eventemitter3';
import { BootScene } from './scenes/BootScene';
import { ModeSelectScene } from './scenes/ModeSelectScene';
import { IntroScene } from './scenes/IntroScene';
import { GameScene } from './scenes/GameScene';
import { TransitionScene } from './scenes/TransitionScene';
import { UIScene } from './scenes/UIScene';
import { COLORS } from './ui/palette';
import { GameStore } from './state/gameStore';
import type { IEventEmitter } from './state/gameStore';
import { BuildMode } from './state/buildMode';
import { POLICIES, EVENTS, DECREES, validateStaticData } from './data';
import { BALANCE } from './data/balanceConfig';
import type { ResourceId } from './data/resourceRegistry';

/**
 * Renderer 入口。
 *
 * v0.9 hotfix #5：解决高 DPI 文字糊。
 *   - antialias: true —— WebGL 文字纹理升采样必须打开（之前关掉是 v0.7 误判）
 *   - roundPixels: false —— 高 DPI 下整数化反而把亚像素抗锯齿丢了
 *   - 后段 game 实例化后调 setupHighDpiCanvas() —— 强制 canvas backing store
 *     按 devicePixelRatio 放大，scene 坐标系不变；这是 Phaser 3 在 RESIZE 模式
 *     下唯一稳定的"逻辑像素归一 + 物理像素清晰"方案
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: COLORS.BG_INK,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: 1366,
    height: 800,
    min: { width: 1280, height: 720 },
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  // J-3e+ v0.8：IntroScene 邦名输入框需要 DOM 容器
  dom: {
    createContainer: true,
  },
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  scene: [BootScene, ModeSelectScene, IntroScene, GameScene, TransitionScene, UIScene],
};

// 实例化 Phaser.Game。BootScene autostart，其余 scene 由 BootScene.create 在 part 2 启动。
const game = new Phaser.Game(config);

/**
 * 崩溃捕捉器（2026-06-02 诊断）：resize 切换崩溃三次 targeted 修复均未中，需拿到**真正的报错**。
 * 在屏幕弹红色覆盖层显示 JS 错误 / Promise 拒绝 / **WebGL 上下文丢失**（最可能的真凶之一），
 * 用户截图即可，无需开 DevTools。覆盖层 z-index 极高、可点掉。
 */
function setupCrashDiagnostics(): void {
  const show = (title: string, detail: string): void => {
    try {
      console.error(`[CRASH] ${title}: ${detail}`);
      let el = document.getElementById('crash-overlay');
      if (!el) {
        el = document.createElement('div');
        el.id = 'crash-overlay';
        el.style.cssText =
          'position:fixed;left:0;right:0;top:0;z-index:999999;background:rgba(140,10,10,0.96);' +
          'color:#fff;font:13px/1.5 monospace;padding:10px 14px;white-space:pre-wrap;max-height:45vh;' +
          'overflow:auto;border-bottom:2px solid #ff0;cursor:pointer';
        el.title = '点此关闭';
        el.addEventListener('click', () => el?.remove());
        document.body.appendChild(el);
      }
      el.textContent = `⚠ 崩溃捕捉 ⚠\n${title}\n${detail}\n（截图发给开发；点此关闭）`;
    } catch { /* 诊断本身别再抛 */ }
  };
  window.addEventListener('error', (e) => {
    show('JS 错误', `${e.message}\n@ ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack ?? ''}`.slice(0, 1500));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    show('Promise 未捕获', String(r?.stack ?? r ?? '').slice(0, 1500));
  });
  game.events.once(Phaser.Core.Events.READY, () => {
    const canvas = game.canvas;
    if (!canvas) return;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      show('WebGL 上下文丢失', '画布尺寸切换导致 GPU 上下文丢失——这会让所有纹理/RT 失效、画面畸变且不自愈。这正是 resize 崩溃的根因候选。');
    });
    canvas.addEventListener('webglcontextrestored', () => show('WebGL 上下文已恢复', '（若你看到这条，说明上下文恢复了）'));
  });
}
setupCrashDiagnostics();

/**
 * v0.9 hotfix #5：高 DPI 文字清晰度。
 *
 * Windows 缩放 >100% 时，Phaser Text 默认 resolution=1，文字纹理在低分辨率烘焙后
 * 被 GPU 升采样到物理像素，肉眼看就是糊。把全局 Text resolution 拉到 DPR，让每个
 * Text 自动用更高分辨率烘焙——是 Phaser 3 在 WebGL 路径下唯一稳定的字体清晰方案。
 *
 * 实现：每个 scene boot 后给 add.text 加一道 wrapper，新创建的 text 自动 setResolution。
 */
function setupGlobalTextResolution(): void {
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  game.events.once(Phaser.Core.Events.READY, () => {
    // 给每个 scene 在 boot 时改写 add.text，用 closure 捕获 dpr
    game.scene.scenes.forEach(scene => patchSceneAddText(scene, dpr));
    // 之后新加的 scene（一般没有，但稳一点）
    game.events.on('addedtoscene', (scene: Phaser.Scene) => patchSceneAddText(scene, dpr));
  });
}
function patchSceneAddText(scene: Phaser.Scene, dpr: number): void {
  const orig = scene.add.text.bind(scene.add);
  // 仅 dpr>1 时改写；=1 不动
  if (dpr <= 1) return;
  scene.add.text = ((x: number, y: number, text?: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => {
    const t = orig(x, y, text ?? '', style);
    t.setResolution(dpr);
    return t;
  }) as typeof scene.add.text;
}
setupGlobalTextResolution();

/**
 * v0.9 hotfix#6：Phaser ScaleManager 在 Electron 28 BrowserWindow maximize→restore
 * 路径上的 window 'resize' 监听不可靠——maximize 还原后 canvas 还停在 max 物理尺寸，
 * 导致 HUD/面板按 1920px 算位置，右面板被推到 windowed 窗口外。
 *
 * 用 ResizeObserver 监听 #game-container 实际 DOM 尺寸变化（保证 BrowserWindow 任何
 * 缩放路径都能触发），强制 game.scale.refresh() 让 Phaser 重新读 parent 尺寸 +
 * 重发 'resize' 事件给所有 scene。绕开 Phaser/Chromium 内部事件链不可靠性。
 */
function setupBulletproofResize(): void {
  game.events.once(Phaser.Core.Events.READY, () => {
    // 回归 Phaser 原生 RESIZE（保留其 window 监听 + visibilitychange 等）。崩溃真因是
    // scene.shutdown 未注册导致监听泄漏（已在各 scene create 里绑 SHUTDOWN 修复），
    // 与 resize 机制无关。此前的 stopListeners + 手动 scale.resize(getContentSize) 是错判，
    // 反而可能让画布与显示尺寸脱钩 → 缩放/最大化时画面形变；故移除，改回轻量 refresh。
    const container = document.getElementById('game-container');
    if (!container || typeof ResizeObserver === 'undefined') return;
    let timer = 0;
    const ro = new ResizeObserver(() => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = 0;
        if (game.scale) game.scale.refresh(); // 让 Phaser 重读 parent 尺寸，1:1 不拉伸
      }, 100);
    });
    ro.observe(container);
  });
}
setupBulletproofResize();

// Slice F：启动期一次性校验静态数据（policies/events/decrees DSL 字符串等）
validateStaticData();

// Slice D/E/F：把 GameStore + BuildMode 单例放到 game.registry，供所有 scene 取用
const emitter = new EventEmitter() as unknown as IEventEmitter;
const store = new GameStore(emitter, undefined, {
  policies: POLICIES,
  events: EVENTS,
  decrees: DECREES,
});
const buildMode = new BuildMode();
game.registry.set('store', store);
game.registry.set('buildMode', buildMode);

// Slice E：一次性初始资源（数值集中在 balanceConfig.BALANCE.startingResources）。
// 放在这里而不是 GameScene.create 里：scene 重启或 STATE_REPLACED 加载存档不会再次触发，
// 避免污染玩家的合法存档（包括资源恰好为 0 的临时存档）。
for (const [id, amount] of Object.entries(BALANCE.startingResources)) {
  if (amount && amount > 0) store.addResource(id as ResourceId, amount);
}
