// c919-01：共享 FakeScene 脚手架——UI 三套（HUD/BuildingPopover/Legend）的 builder 族与
// ModeSelectScene/UIScene 的 phaser-mock 类式 fake 统一收口到本文件，grep 单一定义处。
// 方法集取各文件迁移前并集：多余 vi.fn 链对既有断言惰性，语义零漂移。
import { vi } from 'vitest';

/** 文本 union：HUD（setFontSize/setScrollFactor/setDepth）∪ Legend（setStyle）∪ BuildingPopover 基础集；setText 记录文本。 */
export function makeFakeText() {
  const t = {
    setOrigin: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setFontSize: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setStyle: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    width: 100, height: 18, displayHeight: 18, text: '',
  };
  t.setText.mockImplementation((s: string) => { t.text = s; return t; });
  return t;
}

/** 图形 union：HUD 全集 ∪ Legend/BuildingPopover 子集（含 lineBetween/strokeRoundedRect）。 */
export function makeFakeGraphics() {
  const g: Record<string, unknown> = {};
  const methods = ['clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'fillCircle', 'strokeCircle',
    'beginPath', 'moveTo', 'lineTo', 'strokePath', 'closePath', 'fillPath', 'fillRoundedRect',
    'strokeRoundedRect', 'generateTexture', 'lineBetween', 'setPosition', 'setVisible', 'setScrollFactor', 'setDepth', 'destroy'];
  for (const name of methods) g[name] = vi.fn().mockReturnThis();
  return g;
}

/** 交互区 union：BuildingPopover 携带 x/y/width/height 字段。 */
export function makeFakeZone() {
  const z = {
    x: 0, y: 0, width: 1, height: 1,
    setOrigin: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  return z;
}

/** 容器 union：HUD（setAlpha/setPosition）∪ BuildingPopover（setScale）。 */
export function makeFakeContainer() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    add: vi.fn(),
    destroy: vi.fn(),
  };
}

export interface FakeSceneOpts {
  /** Legend 读 cameras.main 尺寸。 */
  cameras?: boolean;
  /** HUD 用 tweens.add。 */
  tweens?: boolean;
  /** BuildingPopover 断言 input.keyboard.on（keyboardOn 可从 scene 取回）。 */
  keyboard?: boolean;
  /** BuildingPopover 用 time.delayedCall（捕获不立即执行）。 */
  time?: boolean;
}

/** 普通对象式 scene（UI 面板测试用）。keyboardOn 挂在 __keyboardOn 便于断言取回。 */
export interface FakeSceneLike {
  scale: { width: number; height: number };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  add: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry: any;
  [k: string]: unknown;
}

export function makeFakeScene(opts: FakeSceneOpts = {}): FakeSceneLike {
  const keyboardOn = vi.fn();
  const scene: FakeSceneLike = {
    scale: { width: 1366, height: 800 },
    add: {
      container: vi.fn(() => makeFakeContainer()),
      graphics: vi.fn(() => makeFakeGraphics()),
      text: vi.fn(() => makeFakeText()),
      zone: vi.fn(() => makeFakeZone()),
    },
    input: { on: vi.fn(), off: vi.fn(), keyboard: opts.keyboard ? { on: keyboardOn, off: vi.fn() } : undefined },
    registry: { get: vi.fn(), set: vi.fn() },
    __keyboardOn: keyboardOn,
  };
  if (opts.cameras) scene.cameras = { main: { width: 1366, height: 800, scrollX: 0, scrollY: 0 } };
  if (opts.tweens) scene.tweens = { add: vi.fn(() => ({ stop: vi.fn(), destroy: vi.fn() })) };
  if (opts.time) scene.time = { delayedCall: vi.fn((_ms: number, fn: () => void) => { /* 捕获不立即执行 */ }) };
  return scene;
}

function makeChainable() {
  const o: Record<string, unknown> = {};
  for (const m of ['add', 'on', 'once', 'clear', 'fillStyle', 'lineStyle', 'fillRect', 'strokeRect', 'beginPath', 'moveTo', 'lineTo', 'strokePath', 'fillCircle', 'strokeCircle', 'fillRoundedRect', 'strokeRoundedRect', 'lineBetween', 'generateTexture', 'setOrigin', 'setDepth', 'setVisible', 'setScrollFactor', 'setInteractive', 'setPosition', 'setScale', 'setSize', 'setText', 'setColor', 'setStyle', 'setAlpha', 'setFontSize', 'setMask', 'clearMask', 'setBlendMode', 'setAlign', 'setWordWrapWidth', 'setPadding', 'setShadow', 'setLineSpacing', 'setDisplaySize', 'setTexture', 'setName', 'disableInteractive', 'removeAll', 'off']) {
    o[m] = vi.fn().mockReturnThis();
  }
  o.destroy = vi.fn();
  // BuildPanel 滚动遮罩：createGeometryMask 返回 mask 对象（非 this）。
  o.createGeometryMask = vi.fn(() => ({ destroy: vi.fn() }));
  return o;
}

export interface SceneClassMock {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FakeScene: any;
  registryStore: Map<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sceneStart: any;
  shutdownHandlers: Array<{ evt: string; cb: (...args: unknown[]) => void; ctx?: unknown }>;
}

/** 类式 fake scene（vi.mock('phaser') 用）：ModeSelectScene/UIScene 共享。 */
export function makeSceneClassMock(): SceneClassMock {
  const registryStore = new Map<string, unknown>();
  const sceneStart = vi.fn();
  const shutdownHandlers: Array<{ evt: string; cb: (...args: unknown[]) => void; ctx?: unknown }> = [];
  class FakeScene {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sys: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scene: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registry: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    add: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scale: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tweens: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    time: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cameras: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    textures: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sound: any;
    constructor(cfg?: { key?: string }) {
      this.sys = { config: cfg ?? {}, settings: cfg ?? {} };
      this.scene = { start: sceneStart };
      this.registry = {
        set: vi.fn((k: string, v: unknown) => { registryStore.set(k, v); }),
        get: vi.fn((k: string) => registryStore.get(k)),
      };
      this.add = {
        graphics: vi.fn(() => makeChainable()),
        text: vi.fn(() => makeChainable()),
        zone: vi.fn(() => makeChainable()),
        container: vi.fn(() => makeChainable()),
        image: vi.fn(() => makeChainable()),
      };
      // BuildPanel 建筑缩略图贴图守卫：exists=false 走缺图降级（行只显文字）。
      this.textures = { exists: vi.fn(() => false), get: vi.fn() };
      // AudioManager 资产在位检查：cache.audio.exists=false → 静音降级（缺资产不报错）。
      this.cache = { audio: { exists: vi.fn(() => false) }, json: { get: vi.fn() } };
      // AudioManager BGM 动态装载：sound.add 返回可 play/stop 的假音频对象。
      this.sound = {
        add: vi.fn(() => ({ play: vi.fn(), stop: vi.fn(), destroy: vi.fn() })),
        play: vi.fn(),
        stop: vi.fn(),
      };
      this.events = {
        once: vi.fn((evt: string, cb: (...args: unknown[]) => void, ctx?: unknown) => {
          shutdownHandlers.push({ evt, cb, ctx });
        }),
        on: vi.fn(),
        off: vi.fn(),
      };
      this.scale = { width: 1366, height: 800, on: vi.fn(), off: vi.fn() };
      this.input = { on: vi.fn(), off: vi.fn(), keyboard: { on: vi.fn(), off: vi.fn() } };
      this.tweens = { add: vi.fn(() => ({ stop: vi.fn(), destroy: vi.fn() })) };
      this.time = { delayedCall: vi.fn(), addEvent: vi.fn(() => ({ remove: vi.fn() })) };
      this.cameras = { main: { width: 1366, height: 800, scrollX: 0, scrollY: 0 }, resize: vi.fn() };
    }
  }
  return { FakeScene, registryStore, sceneStart, shutdownHandlers };
}

/** 单例：vi.mock 工厂（不可引用外部变量）经 await import 取用，与测试文件断言共用同一份 deps。 */
export const sceneClassMock = makeSceneClassMock();

/** 统一 phaser 模块 mock：Scene 基类＋SHUTDOWN/RESIZE 常量＋Geom.Rectangle（UIScene 暂停遮罩 hitArea new＋Contains）。 */
export function makePhaserMock() {
  class Rectangle {
    static Contains(): boolean { return false; }
  }
  const PhaserMock = {
    Scene: sceneClassMock.FakeScene,
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Scale: { RESIZE: 'RESIZE' },
    Geom: { Rectangle },
  };
  (PhaserMock as Record<string, unknown> & { default?: unknown }).default = PhaserMock;
  return PhaserMock;
}
